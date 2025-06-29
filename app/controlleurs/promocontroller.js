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

      // Rechercher le code promo
      const promoCode = await PromoCode.findOne({
        where: {
          code: code.trim().toUpperCase()
        }
      });

      if (!promoCode) {
        return res.status(404).json({
          success: false,
          message: 'Code promo invalide'
        });
      }

      // Vérifier la date d'expiration
      if (promoCode.expires_at && new Date() > new Date(promoCode.expires_at)) {
        return res.status(400).json({
          success: false,
          message: 'Ce code promo a expiré'
        });
      }

      // Vérifier la limite d'usage
      if (promoCode.used_count >= promoCode.usage_limit) {
        return res.status(400).json({
          success: false,
          message: 'Ce code promo a atteint sa limite d\'utilisation'
        });
      }

      // Stocker le code promo dans la session
      req.session.appliedPromo = {
        code: promoCode.code,
        discountPercent: promoCode.discount_percent,
        id: promoCode.id
      };

      console.log('✅ Code promo appliqué:', promoCode.code, promoCode.discount_percent + '%');

      res.json({
        success: true,
        message: `Code appliqué ! Réduction de ${promoCode.discount_percent}%`,
        discount: promoCode.discount_percent,
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
  calculateDiscount(subtotal, discountPercent) {
    if (!subtotal || !discountPercent || discountPercent <= 0) {
      return 0;
    }
    
    return Math.round((subtotal * discountPercent / 100) * 100) / 100;
  },

  /**
   * 🧮 Calculer les totaux avec promo
   */
  calculateTotalsWithPromo(subtotal, appliedPromo, shippingFee = 5.90) {
    let discount = 0;
    let finalShipping = subtotal >= 100 ? 0 : shippingFee;

    if (appliedPromo && appliedPromo.discountPercent) {
      discount = this.calculateDiscount(subtotal, appliedPromo.discountPercent);
    }

    const discountedSubtotal = subtotal - discount;
    
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
      freeShipping: finalShipping === 0
    };
  },

  /**
   * ✅ Valider et utiliser un code promo lors de la commande
   */
  async usePromoCode(promoId) {
    try {
      if (!promoId) return { success: true };

      const promoCode = await PromoCode.findByPk(promoId);
      
      if (!promoCode) {
        throw new Error('Code promo non trouvé');
      }

      // Vérifications de validité
      if (promoCode.expires_at && new Date() > new Date(promoCode.expires_at)) {
        throw new Error('Code promo expiré');
      }

      if (promoCode.used_count >= promoCode.usage_limit) {
        throw new Error('Code promo épuisé');
      }

      // Incrémenter le compteur d'usage
      await promoCode.increment('used_count');

      console.log(`✅ Code promo ${promoCode.code} utilisé. Utilisations: ${promoCode.used_count + 1}/${promoCode.usage_limit}`);

      return {
        success: true,
        code: promoCode.code,
        discount: promoCode.discount_percent
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
      const promoCodes = await PromoCode.findAll({
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