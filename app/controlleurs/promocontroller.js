// controllers/promoController.js
import { PromoCode } from '../models/Promocode.js';
import { Op } from 'sequelize';

async function getPromoStats() {
  try {
    console.log('📊 Calcul des statistiques des codes promo...');
    
    // Statistiques de base
    const totalPromos = await PromoCode.count();
    
    const activePromos = await PromoCode.count({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { expires_at: null },
              { expires_at: { [Op.gt]: new Date() } }
            ]
          },
          literal('used_count < usage_limit')
        ]
      }
    });

    const expiredPromos = await PromoCode.count({
      where: {
        expires_at: { [Op.lt]: new Date() }
      }
    });

    const exhaustedPromos = await PromoCode.count({
      where: literal('used_count >= usage_limit')
    });

    // Utilisation totale
    const totalUsage = await PromoCode.sum('used_count') || 0;

    // CA généré avec codes promo (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueWithPromo = await Order.sum('total', {
      where: {
        promo_code: { [Op.not]: null },
        created_at: { [Op.gte]: thirtyDaysAgo }
      }
    }) || 0;

    const totalDiscountGiven = await Order.sum('promo_discount_amount', {
      where: {
        promo_code: { [Op.not]: null },
        created_at: { [Op.gte]: thirtyDaysAgo }
      }
    }) || 0;

    // Commandes avec codes promo
    const ordersWithPromo = await Order.count({
      where: {
        promo_code: { [Op.not]: null },
        created_at: { [Op.gte]: thirtyDaysAgo }
      }
    });

    const totalOrders = await Order.count({
      where: {
        created_at: { [Op.gte]: thirtyDaysAgo }
      }
    });

    const promoUsageRate = totalOrders > 0 ? ((ordersWithPromo / totalOrders) * 100).toFixed(1) : 0;

    const stats = {
      totalPromos,
      activePromos,
      expiredPromos,
      exhaustedPromos,
      totalUsage,
      revenueWithPromo: parseFloat(revenueWithPromo).toFixed(2),
      totalDiscountGiven: parseFloat(totalDiscountGiven).toFixed(2),
      ordersWithPromo,
      totalOrders,
      promoUsageRate
    };

    console.log('✅ Statistiques calculées:', stats);
    return stats;

  } catch (error) {
    console.error('❌ Erreur calcul stats promo:', error);
    return {
      totalPromos: 0,
      activePromos: 0,
      expiredPromos: 0,
      exhaustedPromos: 0,
      totalUsage: 0,
      revenueWithPromo: '0.00',
      totalDiscountGiven: '0.00',
      ordersWithPromo: 0,
      totalOrders: 0,
      promoUsageRate: 0
    };
  }
}

export const promoController = {
  
  /**
   * 🎫 Appliquer un code promo
   */
async applyPromoCode(req, res) {
    try {
      const { code } = req.body;
      const userId = req.session?.user?.id || req.session?.customerId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Veuillez vous connecter pour utiliser un code promo'
        });
      }

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Code promo requis'
        });
      }

      // ✅ RECHERCHER DANS LA NOUVELLE TABLE promo_codes
      const promoCode = await PromoCode.findOne({
        where: {
          code: code.trim().toUpperCase(),
          is_active: true, // ✅ Vérifier que le code est actif
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: new Date() } }
          ]
        }
      });

      if (!promoCode) {
        return res.status(404).json({
          success: false,
          message: 'Code promo invalide ou expiré'
        });
      }

      // ✅ VÉRIFIER LA LIMITE D'USAGE (nouvelle table)
      if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
        return res.status(400).json({
          success: false,
          message: 'Ce code promo a atteint sa limite d\'utilisation'
        });
      }

      // ✅ VÉRIFIER LE MONTANT MINIMUM (nouvelle table)
      const cartItems = await Cart.findAll({
        where: { customer_id: userId },
        include: [{ 
          model: Jewel, 
          as: 'jewel', 
          required: true,
          attributes: ['price_ttc']
        }]
      });

      if (cartItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Votre panier est vide. Ajoutez des articles avant d\'appliquer un code promo.'
        });
      }

      const subtotal = cartItems.reduce((total, item) => 
        total + (parseFloat(item.jewel.price_ttc) * item.quantity), 0);

      if (promoCode.min_order_amount && subtotal < promoCode.min_order_amount) {
        return res.status(400).json({
          success: false,
          message: `Montant minimum de ${promoCode.min_order_amount}€ requis pour ce code promo`
        });
      }

      // ✅ ADAPTER LA STRUCTURE POUR LA SESSION (compatible avec l'ancienne logique)
      req.session.appliedPromo = {
        id: promoCode.id,
        code: promoCode.code,
        // ✅ CONVERSION : discount_value → discountPercent
        discountPercent: promoCode.discount_type === 'percentage' ? promoCode.discount_value : 0,
        discountAmount: promoCode.discount_type === 'fixed' ? promoCode.discount_value : 0,
        type: promoCode.discount_type,
        minAmount: promoCode.min_order_amount || 0,
        // ✅ Conserver les informations originales
        originalData: {
          discount_value: promoCode.discount_value,
          discount_type: promoCode.discount_type,
          min_order_amount: promoCode.min_order_amount,
          max_uses: promoCode.max_uses,
          used_count: promoCode.used_count
        }
      };

      console.log('✅ Code promo appliqué:', promoCode.code, promoCode.discount_value + (promoCode.discount_type === 'percentage' ? '%' : '€'));

      res.json({
        success: true,
        message: `Code appliqué ! Réduction de ${promoCode.discount_value}${promoCode.discount_type === 'percentage' ? '%' : '€'}`,
        discount: promoCode.discount_value,
        discountType: promoCode.discount_type,
        code: promoCode.code
      });

    } catch (error) {
      console.error('❌ Erreur application code promo:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'application du code promo'
      });
    }
  },

  /**
   * 🗑️ Retirer un code promo
   */
  async removePromoCode(req, res) {
    try {
      delete req.session.appliedPromo;
      
      res.json({
        success: true,
        message: 'Code promo retiré'
      });

    } catch (error) {
      console.error('❌ Erreur suppression code promo:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du code promo'
      });
    }
  },

  /**
   * 💰 Calculer la réduction
   */
   calculateDiscount(subtotal, appliedPromo) {
    if (!subtotal || !appliedPromo) {
      return 0;
    }
    
    // ✅ GÉRER LES DEUX TYPES DE RÉDUCTION
    if (appliedPromo.type === 'percentage') {
      const percent = appliedPromo.discountPercent || appliedPromo.originalData?.discount_value || 0;
      return Math.round((subtotal * percent / 100) * 100) / 100;
    } else if (appliedPromo.type === 'fixed') {
      const fixedAmount = appliedPromo.discountAmount || appliedPromo.originalData?.discount_value || 0;
      return Math.min(fixedAmount, subtotal); // Ne pas dépasser le total
    }
    
    return 0;
  },

  /**
   * 🧮 Calculer les totaux avec promo
   */
  calculateTotalsWithPromo(subtotal, appliedPromo, shippingFee = 5.90) {
    let discount = 0;
    let finalShipping = subtotal >= 100 ? 0 : shippingFee;

    if (appliedPromo) {
      discount = this.calculateDiscount(subtotal, appliedPromo);
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);
    
    // Recalculer la livraison après réduction si nécessaire
    if (discountedSubtotal >= 100 && subtotal < 100) {
      finalShipping = 0;
    }

    const total = discountedSubtotal + finalShipping;

    return {
      subtotal,
      discount,
      discountedSubtotal,
      shipping: finalShipping,
      total: Math.max(0, total),
      freeShipping: finalShipping === 0,
      appliedPromo
    };
  },

  /**
   * ✅ Valider et utiliser un code promo lors de la commande
   */
   async usePromoCode(promoId) {
    try {
      if (!promoId) return { success: true };

      // ✅ CHERCHER DANS LA NOUVELLE TABLE
      const promoCode = await PromoCode.findByPk(promoId);
      
      if (!promoCode) {
        throw new Error('Code promo non trouvé');
      }

      // Vérifications de validité (nouvelle structure)
      if (promoCode.expires_at && new Date() > new Date(promoCode.expires_at)) {
        throw new Error('Code promo expiré');
      }

      if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
        throw new Error('Code promo épuisé');
      }

      // ✅ INCRÉMENTER LE COMPTEUR D'USAGE (nouvelle colonne)
      await promoCode.increment('used_count');

      console.log(`✅ Code promo ${promoCode.code} utilisé. Utilisations: ${promoCode.used_count + 1}/${promoCode.max_uses || '∞'}`);

      return {
        success: true,
        code: promoCode.code,
        discount: promoCode.discount_value,
        discountType: promoCode.discount_type
      };

    } catch (error) {
      console.error('❌ Erreur utilisation code promo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * 📋 Lister les codes promo actifs (admin)
   */
  async listPromoCodes(req, res) {
    try {
      // ✅ RÉCUPÉRER DEPUIS LA NOUVELLE TABLE
      const promoCodes = await PromoCode.findAll({
        attributes: [
          'id', 'code', 'discount_type', 'discount_value', 
          'min_order_amount', 'max_uses', 'used_count', 
          'start_date', 'expires_at', 'is_active', 'created_at'
        ],
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        promoCodes
      });

    } catch (error) {
      console.error('❌ Erreur liste codes promo:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des codes promo'
      });
    }
  },

  /**
   * ➕ Créer un code promo (admin)
   */
  async createPromoCode(req, res) {
    try {
      const { code, discountPercent, expiresAt, usageLimit } = req.body;

      if (!code || !discountPercent) {
        return res.status(400).json({
          success: false,
          message: 'Code et pourcentage de réduction requis'
        });
      }

      const promoCode = await PromoCode.create({
        code: code.trim().toUpperCase(),
        discount_percent: parseInt(discountPercent),
        expires_at: expiresAt ? new Date(expiresAt) : null,
        usage_limit: parseInt(usageLimit) || 1
      });

      res.json({
        success: true,
        message: 'Code promo créé avec succès',
        promoCode
      });

    } catch (error) {
      console.error('❌ Erreur création code promo:', error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Ce code promo existe déjà'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du code promo'
      });
    }
  }
};