// controllers/promoAdminController.js - VERSION COMPLÈTE CORRIGÉE
import { PromoCode } from '../models/Promocode.js';
import { Order } from '../models/orderModel.js';
import { Customer } from '../models/customerModel.js';
import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../models/sequelize-client.js';
import { QueryTypes } from 'sequelize';
import { Jewel } from '../models/jewelModel.js';
import { Category } from '../models/categoryModel.js';
import { Material } from '../models/MaterialModel.js';
import { Type } from '../models/TypeModel.js';
import { JewelImage } from '../models/jewelImage.js';

// ===================================================================
// FONCTIONS UTILITAIRES AUTONOMES (en dehors de l'objet)
// ===================================================================

/**
 * Fonction utilitaire pour les statistiques des promotions publiques
 */
async function getPromoStatsForPublic() {
    try {
        const [results] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_on_sale,
                AVG(discount_percentage) as avg_discount,
                MAX(discount_percentage) as max_discount,
                MIN(discount_percentage) as min_discount,
                SUM(price_ttc * discount_percentage / 100) as total_savings
            FROM jewel 
            WHERE discount_percentage > 0
        `);

        return {
            totalOnSale: results[0]?.total_on_sale || 0,
            avgDiscount: Math.round(results[0]?.avg_discount || 0),
            maxDiscount: results[0]?.max_discount || 0,
            minDiscount: results[0]?.min_discount || 0,
            totalSavings: results[0]?.total_savings || 0,
            categoryStats: []
        };
    } catch (error) {
        console.error('❌ Erreur calcul stats promotions publiques:', error);
        return {
            totalOnSale: 0,
            avgDiscount: 0,
            maxDiscount: 0,
            minDiscount: 0,
            totalSavings: 0,
            categoryStats: []
        };
    }
}

/**
 * 🔧 FONCTION UTILITAIRE pour les stats admin (codes promo)
 */
async function getPromoStats() {
  try {
    console.log('📊 Calcul des statistiques des codes promo...');
    
    // Statistiques de base
    const totalPromos = await PromoCode.count();
    
    const activePromos = await PromoCode.count({
      where: {
        is_active: true,
        [Op.and]: [
          {
            [Op.or]: [
              { expires_at: null },
              { expires_at: { [Op.gt]: new Date() } }
            ]
          }
        ]
      }
    });

    const expiredPromos = await PromoCode.count({
      where: {
        expires_at: { [Op.lt]: new Date() }
      }
    });

    // ✅ CORRECTION: Calcul correct des utilisations totales
    const totalUsage = await sequelize.query(`
      SELECT COALESCE(COUNT(*), 0) as total_uses
      FROM orders 
      WHERE promo_code IS NOT NULL 
      AND promo_code != ''
    `, {
      type: QueryTypes.SELECT,
      raw: true
    });

    const actualTotalUsage = parseInt(totalUsage[0]?.total_uses || 0);

    // ✅ CORRECTION: CA avec codes promo (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueData = await sequelize.query(`
      SELECT 
        COALESCE(SUM(total), 0) as revenue_with_promo,
        COALESCE(SUM(promo_discount_amount), 0) as total_discount_given,
        COALESCE(COUNT(*), 0) as orders_with_promo
      FROM orders 
      WHERE promo_code IS NOT NULL 
      AND promo_code != ''
      AND created_at >= :thirtyDaysAgo
    `, {
      replacements: { thirtyDaysAgo },
      type: QueryTypes.SELECT,
      raw: true
    });

    const revenueInfo = revenueData[0] || {};

    // Commandes totales pour le taux d'utilisation
    const totalOrdersResult = await sequelize.query(`
      SELECT COUNT(*) as total_orders
      FROM orders 
      WHERE created_at >= :thirtyDaysAgo
    `, {
      replacements: { thirtyDaysAgo },
      type: QueryTypes.SELECT,
      raw: true
    });

    const totalOrders = parseInt(totalOrdersResult[0]?.total_orders || 0);
    const ordersWithPromo = parseInt(revenueInfo.orders_with_promo || 0);
    const promoUsageRate = totalOrders > 0 ? ((ordersWithPromo / totalOrders) * 100).toFixed(1) : 0;

    const stats = {
      totalPromos,
      activePromos,
      expiredPromos,
      exhaustedPromos: 0,
      totalUsage: actualTotalUsage,
      revenueWithPromo: parseFloat(revenueInfo.revenue_with_promo || 0).toFixed(2),
      totalDiscountGiven: parseFloat(revenueInfo.total_discount_given || 0).toFixed(2),
      ordersWithPromo,
      totalOrders,
      promoUsageRate
    };

    console.log('✅ Statistiques admin calculées:', stats);
    return stats;

  } catch (error) {
    console.error('❌ Erreur calcul stats admin promo:', error);
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

/**
 * Fonction de calcul des totaux panier avec promo
 */
function calculateCartTotalsWithPromo(subtotal, appliedPromo, shippingThreshold = 50, baseShippingFee = 5.90) {
  let discount = 0;
  let discountedSubtotal = subtotal;
  let discountPercent = 0;

  if (appliedPromo && appliedPromo.discountPercent) {
    discountPercent = parseFloat(appliedPromo.discountPercent);
    discount = (subtotal * discountPercent) / 100;
    discountedSubtotal = subtotal - discount;
  }

  const shippingFee = discountedSubtotal >= shippingThreshold ? 0 : baseShippingFee;
  const finalTotal = discountedSubtotal + shippingFee;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    discountedSubtotal: parseFloat(discountedSubtotal.toFixed(2)),
    shippingFee: parseFloat(shippingFee.toFixed(2)),
    finalTotal: parseFloat(finalTotal.toFixed(2)),
    discountPercent: discountPercent,
    freeShipping: discountedSubtotal >= shippingThreshold
  };
}

// ===================================================================
// CONTRÔLEUR PRINCIPAL
// ===================================================================

export const promoAdminController = {

    /**
     * ✅ MÉTHODE CORRIGÉE - Affiche la page des promotions avec TOUS les bijoux en promotion
     */
    async showPromotions(req, res) {
        try {
            console.log('🎯 Affichage de la page promotions');
            
            const {
                category = 'all',
                min_discount = 0,
                max_discount = 100,
                prix_min,
                prix_max,
                matiere = [],
                sort = 'discount_desc',
                page = 1,
                limit = 12
            } = req.query;

            const offset = (page - 1) * limit;
            let whereClause = {
                discount_percentage: {
                    [Op.gt]: 0  // Seulement les bijoux avec réduction
                }
            };

            // ===== FILTRES =====
            
            // Filtrer par catégorie
            if (category && category !== 'all') {
                const categoryMap = {
                    'bagues': 1,
                    'colliers': 2, 
                    'bracelets': 3,
                    'boucles-oreilles': 4
                };
                if (categoryMap[category]) {
                    whereClause.category_id = categoryMap[category];
                }
            }

            // Filtrer par pourcentage de réduction
            if (min_discount > 0 || max_discount < 100) {
                whereClause.discount_percentage = {
                    ...whereClause.discount_percentage,
                    [Op.gte]: parseInt(min_discount),
                    [Op.lte]: parseInt(max_discount)
                };
            }

            // Filtrer par prix
            if (prix_min) {
                whereClause.price_ttc = {
                    ...whereClause.price_ttc,
                    [Op.gte]: parseFloat(prix_min)
                };
            }
            if (prix_max) {
                whereClause.price_ttc = {
                    ...whereClause.price_ttc,
                    [Op.lte]: parseFloat(prix_max)
                };
            }

            // Filtrer par matière
            if (Array.isArray(matiere) && matiere.length > 0) {
                whereClause.matiere = {
                    [Op.in]: matiere
                };
            }

            // ===== TRI =====
            let orderClause = [];
            switch (sort) {
                case 'discount_desc':
                    orderClause = [['discount_percentage', 'DESC']];
                    break;
                case 'discount_asc':
                    orderClause = [['discount_percentage', 'ASC']];
                    break;
                case 'price_asc':
                    orderClause = [
                        [sequelize.literal('(price_ttc * (1 - discount_percentage / 100))'), 'ASC']
                    ];
                    break;
                case 'price_desc':
                    orderClause = [
                        [sequelize.literal('(price_ttc * (1 - discount_percentage / 100))'), 'DESC']
                    ];
                    break;
                case 'newest':
                    orderClause = [['created_at', 'DESC']];
                    break;
                case 'popular':
                    orderClause = [['views_count', 'DESC']];
                    break;
                default:
                    orderClause = [['discount_percentage', 'DESC']];
            }

            // ===== RÉCUPÉRATION DES DONNÉES =====
            
            const { count: totalJewels, rows: jewels } = await Jewel.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Type,
                        as: 'type',
                        attributes: ['id', 'name'],
                        required: false
                    }
                ],
                order: orderClause,
                limit: parseInt(limit),
                offset,
                distinct: true
            });

            // ===== FORMATAGE DES BIJOUX =====
            const formattedJewels = jewels.map(jewel => {
                const jewelData = jewel.toJSON();
                
                // Calcul des prix avec réduction
                const originalPrice = jewelData.price_ttc;
                const discountAmount = originalPrice * (jewelData.discount_percentage / 100);
                const finalPrice = originalPrice - discountAmount;
                
                return {
                    ...jewelData,
                    originalPrice,
                    finalPrice,
                    discountAmount,
                    savings: discountAmount,
                    formattedOriginalPrice: new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(originalPrice),
                    formattedFinalPrice: new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(finalPrice),
                    formattedSavings: new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(discountAmount),
                    badge: `${jewelData.discount_percentage}%`,
                    badgeClass: 'promo',
                    image: jewelData.image || 'no-image.jpg'
                };
            });

            // ===== STATISTIQUES =====
            // ✅ CORRECTION: Appel direct de la fonction utilitaire
            const stats = await getPromoStatsForPublic();

            // ===== DONNÉES POUR LES FILTRES =====
            const [categories, materials] = await Promise.all([
                Category.findAll({
                    attributes: ['id', 'name'],
                    order: [['name', 'ASC']]
                }),
                sequelize.query(`
                    SELECT DISTINCT matiere as name, COUNT(*) as count
                    FROM jewel 
                    WHERE discount_percentage > 0 AND matiere IS NOT NULL 
                    GROUP BY matiere 
                    ORDER BY matiere ASC
                `, { type: sequelize.QueryTypes.SELECT })
            ]);

            // ===== PAGINATION =====
            const totalPages = Math.ceil(totalJewels / limit);
            const pagination = {
                currentPage: parseInt(page),
                totalPages,
                totalJewels,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: parseInt(page) + 1,
                prevPage: parseInt(page) - 1
            };

            console.log(`✅ ${formattedJewels.length} bijoux en promotion trouvés`);

            // ===== RENDU DE LA VUE =====
            res.render('promotions', {
                title: 'Bijoux en Promotion - CrystosJewel',
                pageTitle: 'Nos Promotions',
                jewels: formattedJewels,
                stats,
                categories,
                materials,
                pagination,
                filters: {
                    category,
                    min_discount: parseInt(min_discount),
                    max_discount: parseInt(max_discount),
                    prix_min,
                    prix_max,
                    matiere: Array.isArray(matiere) ? matiere : (matiere ? [matiere] : []),
                    sort
                },
                user: req.session?.user || null,
                error: null,
                success: null
            });

        } catch (error) {
            console.error('❌ Erreur affichage promotions:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement des promotions',
                user: req.session?.user || null
            });
        }
    },

    /**
     * Récupère les statistiques des promotions (pour compatibilité)
     */
    async getPromotionStats() {
        return await getPromoStatsForPublic();
    },

/**
 * 📊 Page principale d'administration des codes promo - VERSION COMPLÈTE CORRIGÉE
 */
async renderAdminPage(req, res) {
  try {
    console.log('🎫 Chargement page admin codes promo...');
    
    // ===== PARAMÈTRES DE FILTRAGE =====
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    console.log(`📋 Paramètres: search="${search}", status="${status}", page=${page}`);

    // ===== CALCUL DES STATISTIQUES GLOBALES =====
    const stats = await getPromoStats();

    // ===== CONSTRUCTION DE LA REQUÊTE DE FILTRAGE =====
    let whereClause = {};
    
    // Filtre de recherche
    if (search && search.trim()) {
      whereClause.code = { [Op.iLike]: `%${search.trim().toUpperCase()}%` };
    }

    // Filtres par statut
    const now = new Date();
    switch (status) {
      case 'active':
        whereClause.is_active = true;
        whereClause[Op.and] = [
          {
            [Op.or]: [
              { expires_at: null },
              { expires_at: { [Op.gt]: now } }
            ]
          }
        ];
        break;
      
      case 'expired':
        whereClause.expires_at = { [Op.lt]: now };
        break;
      
      case 'inactive':
        whereClause.is_active = false;
        break;
      
      case 'exhausted':
        // Pour les codes épuisés, on fera le tri après la requête
        break;
      
      default: // 'all'
        // Pas de filtre
        break;
    }

    console.log('🔍 Clause WHERE construite:', JSON.stringify(whereClause, null, 2));

    // ===== RÉCUPÉRATION DES CODES PROMO =====
    let promoCodes = [];
    let count = 0;
    
    try {
      const result = await PromoCode.findAndCountAll({
        where: whereClause,
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC']
        ],
        limit,
        offset,
        raw: false
      });
      
      promoCodes = result.rows;
      count = result.count;
      
      console.log(`📋 ${promoCodes.length} codes promo récupérés sur ${count} total`);

    } catch (queryError) {
      console.error('❌ Erreur requête codes promo:', queryError);
      
      try {
        console.log('🔄 Tentative avec requête de fallback...');
        const fallbackResult = await PromoCode.findAndCountAll({
          order: [['id', 'DESC']],
          limit,
          offset
        });
        
        promoCodes = fallbackResult.rows;
        count = fallbackResult.count;
        console.log(`✅ Fallback réussi: ${promoCodes.length} codes`);
        
      } catch (fallbackError) {
        console.error('❌ Même le fallback a échoué:', fallbackError);
        promoCodes = [];
        count = 0;
      }
    }

    // ===== ENRICHISSEMENT DES CODES PROMO AVEC STATISTIQUES RÉELLES =====
    console.log('🔄 Enrichissement des codes promo avec statistiques...');
    
    const enrichedPromoCodes = await Promise.all(
      promoCodes.map(async (promo) => {
        try {
          let ordersCount = 0;
          let totalRevenue = 0;
          let actualUsedCount = 0;

          try {
            const statsResult = await sequelize.query(`
              SELECT 
                COUNT(*) as orders_count,
                COALESCE(SUM(total), 0) as total_revenue
              FROM orders 
              WHERE promo_code = :promoCode
            `, {
              replacements: { promoCode: promo.code },
              type: QueryTypes.SELECT,
              raw: true
            });

            const codeStats = statsResult[0] || {};
            ordersCount = parseInt(codeStats.orders_count || 0);
            totalRevenue = parseFloat(codeStats.total_revenue || 0);
            actualUsedCount = ordersCount;

          } catch (orderError) {
            console.warn(`⚠️ Stats indisponibles pour ${promo.code}:`, orderError.message);
          }

          // Calcul précis du statut
          const now = new Date();
          let statusInfo = 'active';
          
          if (!promo.is_active) {
            statusInfo = 'inactive';
          } else if (promo.expires_at && now > new Date(promo.expires_at)) {
            statusInfo = 'expired';
          } else if (actualUsedCount >= promo.usage_limit) {
            statusInfo = 'exhausted';
          }

          const enrichedPromo = {
            ...promo.toJSON(),
            ordersCount,
            totalRevenue: totalRevenue.toFixed(2),
            actualUsedCount,
            statusInfo,
            discount_percent: promo.discount_value || promo.discount_percent || 0,
            discount_value: promo.discount_value || promo.discount_percent || 0,
            formatted_created_at: promo.created_at ? new Date(promo.created_at).toLocaleDateString('fr-FR') : 'N/A',
            formatted_expires_at: promo.expires_at ? new Date(promo.expires_at).toLocaleDateString('fr-FR') : 'Aucune',
            usage_percentage: promo.usage_limit > 0 ? ((actualUsedCount / promo.usage_limit) * 100).toFixed(1) : 0,
            is_deletable: ordersCount === 0
          };

          console.log(`📊 ${promo.code}: ${ordersCount} commandes, ${totalRevenue.toFixed(2)}€ CA, statut: ${statusInfo}`);
          
          return enrichedPromo;

        } catch (error) {
          console.error(`❌ Erreur enrichissement ${promo.code}:`, error);
          return {
            ...promo.toJSON(),
            ordersCount: 0,
            totalRevenue: '0.00',
            actualUsedCount: 0,
            statusInfo: 'unknown',
            discount_percent: promo.discount_value || promo.discount_percent || 0,
            formatted_created_at: 'N/A',
            formatted_expires_at: 'Aucune',
            usage_percentage: 0,
            is_deletable: true
          };
        }
      })
    );

    // Filtre post-requête pour les codes épuisés
    let finalPromoCodes = enrichedPromoCodes;
    if (status === 'exhausted') {
      finalPromoCodes = enrichedPromoCodes.filter(promo => promo.statusInfo === 'exhausted');
      count = finalPromoCodes.length;
    }

    // ===== COMMANDES RÉCENTES AVEC CODES PROMO =====
    let recentOrders = [];
    try {
      console.log('📦 Récupération des commandes récentes...');
      
      const recentOrdersResult = await sequelize.query(`
        SELECT 
          id, numero_commande, promo_code, promo_discount_amount, 
          total, customer_name, created_at, status
        FROM orders 
        WHERE promo_code IS NOT NULL 
        AND promo_code != ''
        ORDER BY created_at DESC
        LIMIT 10
      `, {
        type: QueryTypes.SELECT,
        raw: true
      });

      recentOrders = recentOrdersResult;
      console.log(`📦 ${recentOrders.length} commandes récentes récupérées`);
      
    } catch (ordersError) {
      console.warn('⚠️ Commandes récentes indisponibles:', ordersError.message);
      recentOrders = [];
    }

    // ===== CALCULS DE PAGINATION =====
    const totalPages = Math.ceil(count / limit);

    // ===== MESSAGES FLASH =====
    const flashMessages = [];
    if (req.session.flashMessage) {
      flashMessages.push(req.session.flashMessage);
      delete req.session.flashMessage;
    }

    console.log(`📊 Résumé de la page:`);
    console.log(`   - ${finalPromoCodes.length} codes affichés`);
    console.log(`   - ${recentOrders.length} commandes récentes`);
    console.log(`   - Page ${page}/${totalPages}`);

    // ===== RENDU DE LA VUE =====
    res.render('admin/promo-admin', {
      title: 'Administration des Codes Promo',
      stats,
      promoCodes: finalPromoCodes,
      recentOrders,
      search,
      status,
      pagination: {
        page,
        totalPages,
        total: count,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      flashMessages,
      user: req.session.user,
      currentDate: new Date().toISOString(),
      filters: {
        search,
        status,
        page
      }
    });

    console.log('✅ Page admin codes promo rendue avec succès');

  } catch (error) {
    console.error('❌ Erreur critique page admin:', error);
    
    let errorMessage = 'Erreur lors du chargement de la page d\'administration';
    if (error.message.includes('relation') || error.message.includes('table')) {
      errorMessage = 'Erreur de base de données: vérifiez que les tables existent';
    } else if (error.message.includes('column')) {
      errorMessage = 'Erreur de base de données: colonnes manquantes';
    }
    
    req.session.flashMessage = {
      type: 'error',
      message: `${errorMessage}: ${error.message}`
    };
    
    res.redirect('/admin');
  }
},

  /**
   * 📝 Page de création d'un nouveau code promo
   */
  async renderCreatePage(req, res) {
    try {
      console.log('➕ Page création code promo');
      
      const flashMessages = [];
      if (req.session.flashMessage) {
        flashMessages.push(req.session.flashMessage);
        delete req.session.flashMessage;
      }

      res.render('admin/promo-create', {
        title: 'Créer un Code Promo',
        promo: null,
        isEdit: false,
        flashMessages,
        user: req.session.user
      });

    } catch (error) {
      console.error('❌ Erreur page création:', error);
      res.redirect('/admin/promos');
    }
  },

  /**
   * ➕ Créer un nouveau code promo
   */
  async createPromo(req, res) {
  try {
    console.log('➕ Création nouveau code promo:', req.body);
    
    const {
      code,
      discountPercent,
      expiresAt,
      usageLimit,
      minOrderAmount,
      isActive
    } = req.body;

    if (!code || !discountPercent) {
      req.session.flashMessage = {
        type: 'error',
        message: 'Code et pourcentage de réduction requis'
      };
      return res.redirect('/admin/promos/create');
    }

    const discountValue = parseFloat(discountPercent);
    if (isNaN(discountValue) || discountValue < 1 || discountValue > 100) {
      req.session.flashMessage = {
        type: 'error',
        message: 'Le pourcentage doit être un nombre entre 1 et 100'
      };
      return res.redirect('/admin/promos/create');
    }

    const existingPromo = await PromoCode.findOne({
      where: { code: code.trim().toUpperCase() }
    });

    if (existingPromo) {
      req.session.flashMessage = {
        type: 'error',
        message: 'Ce code promo existe déjà'
      };
      return res.redirect('/admin/promos/create');
    }

    const promoData = {
      code: code.trim().toUpperCase(),
      discount_type: 'percentage',
      discount_value: discountValue,
      discount_percent: discountValue,
      expires_at: expiresAt ? new Date(expiresAt) : null,
      usage_limit: parseInt(usageLimit) || 100,
      used_count: 0,
      min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
      is_active: isActive === 'true',
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('📝 Données à créer:', promoData);

    const promoCode = await PromoCode.create(promoData);

    console.log(`✅ Code promo créé avec ID: ${promoCode.id}, Code: ${promoCode.code} (${promoCode.discount_value}%)`);

    req.session.flashMessage = {
      type: 'success',
      message: `Code promo ${promoCode.code} créé avec succès !`
    };

    res.redirect('/admin/promos');

  } catch (error) {
    console.error('❌ Erreur création code promo:', error);
    
    if (error.name === 'SequelizeValidationError') {
      console.error('Erreurs de validation:', error.errors);
    }
    
    req.session.flashMessage = {
      type: 'error',
      message: `Erreur lors de la création: ${error.message || 'Erreur inconnue'}`
    };
    res.redirect('/admin/promos/create');
  }
},

  /**
   * 📝 Page d'édition d'un code promo
   */
  async renderEditPage(req, res) {
    try {
      const { id } = req.params;
      console.log(`✏️ Page édition code promo ID: ${id}`);

      const promo = await PromoCode.findByPk(id);
      
      if (!promo) {
        req.session.flashMessage = {
          type: 'error',
          message: 'Code promo non trouvé'
        };
        return res.redirect('/admin/promos');
      }

      let ordersCount = 0;
      try {
        const statsResult = await sequelize.query(`
          SELECT COUNT(*) as orders_count
          FROM orders 
          WHERE promo_code = :promoCode
        `, {
          replacements: { promoCode: promo.code },
          type: QueryTypes.SELECT,
          raw: true
        });
        
        ordersCount = parseInt(statsResult[0]?.orders_count || 0);
      } catch (error) {
        console.warn('⚠️ Impossible de charger le nombre de commandes:', error.message);
      }

      const flashMessages = [];
      if (req.session.flashMessage) {
        flashMessages.push(req.session.flashMessage);
        delete req.session.flashMessage;
      }

      res.render('admin/promo-create', {
        title: 'Modifier le Code Promo',
        promo: {
          ...promo.toJSON(),
          ordersCount
        },
        isEdit: true,
        flashMessages,
        user: req.session.user
      });

    } catch (error) {
      console.error('❌ Erreur page édition:', error);
      req.session.flashMessage = {
        type: 'error',
        message: 'Erreur lors du chargement du code promo'
      };
      res.redirect('/admin/promos');
    }
  },

  /**
   * ✏️ Modifier un code promo
   */
  async updatePromo(req, res) {
    try {
      const { id } = req.params;
      console.log(`✏️ Modification code promo ID: ${id}`, req.body);
      
      const {
        discountPercent,
        expiresAt,
        usageLimit,
        minOrderAmount,
        isActive
      } = req.body;

      const promoCode = await PromoCode.findByPk(id);
      
      if (!promoCode) {
        req.session.flashMessage = {
          type: 'error',
          message: 'Code promo non trouvé'
        };
        return res.redirect('/admin/promos');
      }

      const updateData = {};
      
      if (discountPercent) {
        const discountValue = parseFloat(discountPercent);
        if (isNaN(discountValue) || discountValue < 1 || discountValue > 100) {
          req.session.flashMessage = {
            type: 'error',
            message: 'Le pourcentage doit être un nombre entre 1 et 100'
          };
          return res.redirect(`/admin/promos/${id}/edit`);
        }
        updateData.discount_value = discountValue;
      }
      
      if (expiresAt !== undefined) {
        updateData.expires_at = expiresAt ? new Date(expiresAt) : null;
      }
      
      if (usageLimit) {
        const limit = parseInt(usageLimit);
        if (limit < 1) {
          req.session.flashMessage = {
            type: 'error',
            message: 'La limite d\'utilisation doit être d\'au moins 1'
          };
          return res.redirect(`/admin/promos/${id}/edit`);
        }
        updateData.usage_limit = limit;
      }
      
      if (minOrderAmount !== undefined) {
        const minAmount = parseFloat(minOrderAmount) || 0;
        if (minAmount < 0) {
          req.session.flashMessage = {
            type: 'error',
            message: 'Le montant minimum ne peut pas être négatif'
          };
          return res.redirect(`/admin/promos/${id}/edit`);
        }
        updateData.min_order_amount = minAmount;
      }
      
      if (isActive !== undefined) {
        updateData.is_active = isActive === 'true';
      }

      console.log('📝 Données à mettre à jour:', updateData);

      await promoCode.update(updateData);

      console.log(`✅ Code promo modifié: ${promoCode.code}`);

      req.session.flashMessage = {
        type: 'success',
        message: `Code promo ${promoCode.code} modifié avec succès !`
      };

      res.redirect('/admin/promos');

    } catch (error) {
      console.error('❌ Erreur modification code promo:', error);
      req.session.flashMessage = {
        type: 'error',
        message: 'Erreur lors de la modification du code promo'
      };
      res.redirect('/admin/promos');
    }
  },

  /**
   * 📊 Page de détails d'un code promo
   */
async renderDetailsPage(req, res) {
  try {
    const { id } = req.params;
    console.log(`📊 Page détails code promo ID: ${id}`);

    const promo = await PromoCode.findByPk(id);
    
    if (!promo) {
      req.session.flashMessage = {
        type: 'error',
        message: 'Code promo non trouvé'
      };
      return res.redirect('/admin/promos');
    }

    let orders = [];
    let totalRevenue = 0;
    let totalDiscount = 0;
    
    try {
      const ordersResult = await sequelize.query(`
        SELECT 
          id, numero_commande, customer_name, customer_email,
          total, promo_discount_amount, created_at, status
        FROM orders 
        WHERE promo_code = :promoCode
        ORDER BY created_at DESC
        LIMIT 50
      `, {
        replacements: { promoCode: promo.code },
        type: QueryTypes.SELECT,
        raw: true
      });

      orders = ordersResult;
      
      totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
      totalDiscount = orders.reduce((sum, order) => sum + parseFloat(order.promo_discount_amount || 0), 0);
      
    } catch (error) {
      console.warn('⚠️ Impossible de charger les commandes:', error.message);
    }

    const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

    let monthlyStats = [];

    const flashMessages = [];
    if (req.session.flashMessage) {
      flashMessages.push(req.session.flashMessage);
      delete req.session.flashMessage;
    }

    res.render('admin/promo-details', {
      title: `Code Promo ${promo.code}`,
      promo: promo.toJSON(),
      orders,
      monthlyStats,
      statistics: {
        totalOrders: orders.length,
        totalRevenue: totalRevenue.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        averageOrderValue: averageOrderValue.toFixed(2),
        usageRate: promo.usage_limit > 0 ? ((orders.length / promo.usage_limit) * 100).toFixed(1) : 0
      },
      flashMessages,
      user: req.session.user
    });

  } catch (error) {
    console.error('❌ Erreur page détails:', error);
    req.session.flashMessage = {
      type: 'error',
      message: 'Erreur lors du chargement des détails'
    };
    res.redirect('/admin/promos');
  }
},

  /**
   * 🗑️ Supprimer un code promo
   */
async deletePromo(req, res) {
  try {
    const { id } = req.params;
    console.log(`🗑️ Suppression code promo ID: ${id}`);

    const promoCode = await PromoCode.findByPk(id);
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Code promo non trouvé'
      });
    }

    const ordersResult = await sequelize.query(`
      SELECT COUNT(*) as orders_count
      FROM orders 
      WHERE promo_code = :promoCode
    `, {
      replacements: { promoCode: promoCode.code },
      type: QueryTypes.SELECT,
      raw: true
    });

    const ordersCount = parseInt(ordersResult[0]?.orders_count || 0);

    if (ordersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer ce code : ${ordersCount} commande(s) l'utilisent`
      });
    }

    await promoCode.destroy();

    console.log(`🗑️ Code promo supprimé: ${promoCode.code}`);

    res.json({
      success: true,
      message: `Code promo ${promoCode.code} supprimé avec succès !`
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
   * 📊 Export des données en CSV
   */
  async exportData(req, res) {
    try {
      console.log('📊 Export données codes promo:', req.query);
      
      const { type, promoId } = req.query;

      let csvData = '';
      let filename = 'export-codes-promo.csv';

      if (type === 'promo-list' || !type) {
        const promoCodes = await PromoCode.findAll({
          order: [['created_at', 'DESC']]
        });

        csvData = 'Code,Réduction (%),Montant Min,Utilisé/Limite,Date expiration,Date création,Statut\n';
        
        promoCodes.forEach(promo => {
          const now = new Date();
          const isExpired = promo.expires_at && now > new Date(promo.expires_at);
          const isExhausted = promo.used_count >= promo.usage_limit;
          const isInactive = promo.is_active === false;
          
          let status = 'Actif';
          if (isInactive) status = 'Inactif';
          else if (isExpired) status = 'Expiré';
          else if (isExhausted) status = 'Épuisé';

          const expirationDate = promo.expires_at ? 
            new Date(promo.expires_at).toLocaleDateString('fr-FR') : 'Aucune';
          const minAmount = parseFloat(promo.min_order_amount) || 0;

          csvData += `"${promo.code}",${promo.discount_value},"${minAmount.toFixed(2)}€","${promo.used_count}/${promo.usage_limit}","${expirationDate}","${new Date(promo.created_at).toLocaleDateString('fr-FR')}","${status}"\n`;
        });

        filename = `codes-promo-${new Date().toISOString().split('T')[0]}.csv`;

      } else if (type === 'promo-orders' && promoId) {
        const promoCode = await PromoCode.findByPk(promoId);
        
        if (!promoCode) {
          req.session.flashMessage = {
            type: 'error',
            message: 'Code promo non trouvé'
          };
          return res.redirect('/admin/promos');
        }

        const ordersResult = await sequelize.query(`
          SELECT 
            numero_commande, customer_name, customer_email,
            total, promo_discount_amount, created_at, status
          FROM orders 
          WHERE promo_code = :promoCode
          ORDER BY created_at DESC
        `, {
          replacements: { promoCode: promoCode.code },
          type: QueryTypes.SELECT,
          raw: true
        });

        csvData = 'Numéro commande,Client,Email,Total,Réduction,Date,Statut\n';
        
        ordersResult.forEach(order => {
          csvData += `"${order.numero_commande}","${order.customer_name}","${order.customer_email}",${order.total},${order.promo_discount_amount},"${new Date(order.created_at).toLocaleDateString('fr-FR')}","${order.status}"\n`;
        });

        filename = `commandes-${promoCode.code}-${new Date().toISOString().split('T')[0]}.csv`;
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\ufeff' + csvData);

    } catch (error) {
      console.error('❌ Erreur export CSV:', error);
      req.session.flashMessage = {
        type: 'error',
        message: 'Erreur lors de l\'export'
      };
      res.redirect('/admin/promos');
    }
  },

  /**
   * 🐛 Méthode de debug pour vérifier les codes promo
   */
async debugPromoCodes(req, res) {
  try {
    console.log('🐛 DEBUG: Vérification des codes promo en base');
    
    const allPromos = await PromoCode.findAll({
      order: [['created_at', 'DESC']],
      raw: true
    });
    
    console.log(`📊 Total codes en base: ${allPromos.length}`);
    
    allPromos.forEach((promo, index) => {
      console.log(`${index + 1}. ID: ${promo.id}, Code: ${promo.code}, Discount: ${promo.discount_value}%, Active: ${promo.is_active}, Created: ${promo.created_at}`);
    });
    
    const tableDescription = await sequelize.getQueryInterface().describeTable('promo_codes');
    console.log('📋 Structure table promo_codes:', Object.keys(tableDescription));
    
    res.json({
      success: true,
      totalCodes: allPromos.length,
      codes: allPromos,
      tableStructure: Object.keys(tableDescription)
    });
    
  } catch (error) {
    console.error('❌ Erreur debug:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

};