// services/discountService.js - Service de gestion des réductions

import { Jewel } from '../models/jewelModel.js';
import { Op } from 'sequelize';

export const discountService = {

  /**
   * Applique une réduction à un bijou
   */
  async applyDiscount(jewelId, discountData) {
    try {
      const { discount_percentage, discount_start_date, discount_end_date } = discountData;
      
      // Validation du pourcentage
      const percentage = parseFloat(discount_percentage) || 0;
      if (percentage < 0 || percentage > 90) {
        throw new Error('Le pourcentage de réduction doit être entre 0 et 90');
      }
      
      // Validation des dates
      let startDate = null;
      let endDate = null;
      
      if (discount_start_date) {
        startDate = new Date(discount_start_date);
        if (isNaN(startDate.getTime())) {
          throw new Error('Date de début invalide');
        }
      }
      
      if (discount_end_date) {
        endDate = new Date(discount_end_date);
        if (isNaN(endDate.getTime())) {
          throw new Error('Date de fin invalide');
        }
      }
      
      // Vérifier que la date de fin est postérieure à la date de début
      if (startDate && endDate && endDate <= startDate) {
        throw new Error('La date de fin doit être postérieure à la date de début');
      }
      
      // Trouver le bijou
      const jewel = await Jewel.findByPk(jewelId);
      if (!jewel) {
        throw new Error('Bijou non trouvé');
      }
      
      // Mettre à jour la réduction
      await jewel.update({
        discount_percentage: percentage,
        discount_start_date: startDate,
        discount_end_date: endDate,
        updated_at: new Date()
      });
      
      return {
        success: true,
        message: percentage > 0 
          ? `Réduction de ${percentage}% appliquée avec succès`
          : 'Réduction supprimée avec succès',
        jewel: {
          id: jewel.id,
          name: jewel.name,
          originalPrice: jewel.price_ttc,
          discountPercentage: percentage,
          finalPrice: percentage > 0 
            ? jewel.price_ttc * (1 - percentage / 100) 
            : jewel.price_ttc,
          savings: percentage > 0 
            ? jewel.price_ttc * (percentage / 100) 
            : 0,
          discountStartDate: startDate,
          discountEndDate: endDate
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur applyDiscount:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  /**
   * Vérifie si une réduction est active pour un bijou
   */
  isDiscountActive(jewel) {
    if (!jewel.discount_percentage || jewel.discount_percentage <= 0) {
      return false;
    }
    
    const now = new Date();
    
    // Vérifier la date de début
    if (jewel.discount_start_date) {
      const startDate = new Date(jewel.discount_start_date);
      if (now < startDate) {
        return false;
      }
    }
    
    // Vérifier la date de fin
    if (jewel.discount_end_date) {
      const endDate = new Date(jewel.discount_end_date);
      if (now > endDate) {
        return false;
      }
    }
    
    return true;
  },

  /**
   * Calcule le prix final avec réduction
   */
  calculateFinalPrice(jewel) {
    if (!this.isDiscountActive(jewel)) {
      return {
        originalPrice: jewel.price_ttc,
        finalPrice: jewel.price_ttc,
        hasDiscount: false,
        discountPercentage: 0,
        savings: 0
      };
    }
    
    const originalPrice = jewel.price_ttc;
    const discountPercentage = jewel.discount_percentage;
    const finalPrice = originalPrice * (1 - discountPercentage / 100);
    const savings = originalPrice - finalPrice;
    
    return {
      originalPrice,
      finalPrice,
      hasDiscount: true,
      discountPercentage,
      savings
    };
  },

  /**
   * Applique une réduction en masse
   */
  async applyBulkDiscount(filters, discountData) {
    try {
      const { discount_percentage, discount_start_date, discount_end_date } = discountData;
      
      // Validation
      const percentage = parseFloat(discount_percentage) || 0;
      if (percentage < 0 || percentage > 90) {
        throw new Error('Le pourcentage de réduction doit être entre 0 et 90');
      }
      
      // Construire la clause WHERE selon les filtres
      let whereClause = {};
      
      if (filters.category_id) {
        whereClause.category_id = filters.category_id;
      }
      
      if (filters.material) {
        whereClause.matiere = filters.material;
      }
      
      if (filters.minPrice && filters.maxPrice) {
        whereClause.price_ttc = {
          [Op.between]: [filters.minPrice, filters.maxPrice]
        };
      } else if (filters.minPrice) {
        whereClause.price_ttc = {
          [Op.gte]: filters.minPrice
        };
      } else if (filters.maxPrice) {
        whereClause.price_ttc = {
          [Op.lte]: filters.maxPrice
        };
      }
      
      // Préparer les données de mise à jour
      const updateData = {
        discount_percentage: percentage,
        updated_at: new Date()
      };
      
      if (discount_start_date) {
        updateData.discount_start_date = new Date(discount_start_date);
      }
      
      if (discount_end_date) {
        updateData.discount_end_date = new Date(discount_end_date);
      }
      
      // Appliquer la réduction
      const [affectedRows] = await Jewel.update(updateData, {
        where: whereClause
      });
      
      return {
        success: true,
        message: `Réduction de ${percentage}% appliquée à ${affectedRows} bijou(s)`,
        affectedCount: affectedRows
      };
      
    } catch (error) {
      console.error('❌ Erreur applyBulkDiscount:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  /**
   * Supprime les réductions expirées
   */
  async removeExpiredDiscounts() {
    try {
      const now = new Date();
      
      const [affectedRows] = await Jewel.update(
        {
          discount_percentage: 0,
          discount_start_date: null,
          discount_end_date: null,
          updated_at: now
        },
        {
          where: {
            discount_end_date: {
              [Op.lt]: now
            },
            discount_percentage: {
              [Op.gt]: 0
            }
          }
        }
      );
      
      console.log(`🧹 ${affectedRows} réduction(s) expirée(s) supprimée(s)`);
      
      return {
        success: true,
        message: `${affectedRows} réduction(s) expirée(s) supprimée(s)`,
        removedCount: affectedRows
      };
      
    } catch (error) {
      console.error('❌ Erreur removeExpiredDiscounts:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  /**
   * Obtient les statistiques des réductions
   */
  async getDiscountStats() {
    try {
      const now = new Date();
      
      // Compter les bijoux avec réductions actives
      const activeDiscounts = await Jewel.count({
        where: {
          discount_percentage: {
            [Op.gt]: 0
          },
          [Op.or]: [
            { discount_start_date: null },
            { discount_start_date: { [Op.lte]: now } }
          ],
          [Op.or]: [
            { discount_end_date: null },
            { discount_end_date: { [Op.gte]: now } }
          ]
        }
      });
      
      // Compter les bijoux avec réductions programmées
      const scheduledDiscounts = await Jewel.count({
        where: {
          discount_percentage: {
            [Op.gt]: 0
          },
          discount_start_date: {
            [Op.gt]: now
          }
        }
      });
      
      // Compter les bijoux avec réductions expirées
      const expiredDiscounts = await Jewel.count({
        where: {
          discount_percentage: {
            [Op.gt]: 0
          },
          discount_end_date: {
            [Op.lt]: now
          }
        }
      });
      
      // Calculer le pourcentage moyen de réduction
      const avgDiscount = await Jewel.findOne({
        attributes: [
          [Jewel.sequelize.fn('AVG', Jewel.sequelize.col('discount_percentage')), 'avgDiscount']
        ],
        where: {
          discount_percentage: {
            [Op.gt]: 0
          }
        },
        raw: true
      });
      
      return {
        success: true,
        stats: {
          activeDiscounts,
          scheduledDiscounts,
          expiredDiscounts,
          averageDiscount: parseFloat(avgDiscount?.avgDiscount || 0).toFixed(1),
          totalWithDiscounts: activeDiscounts + scheduledDiscounts + expiredDiscounts
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur getDiscountStats:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  /**
   * Trouve les bijoux avec les meilleures réductions
   */
  async getBestDeals(limit = 10) {
    try {
      const now = new Date();
      
      const bestDeals = await Jewel.findAll({
        where: {
          discount_percentage: {
            [Op.gt]: 0
          },
          [Op.or]: [
            { discount_start_date: null },
            { discount_start_date: { [Op.lte]: now } }
          ],
          [Op.or]: [
            { discount_end_date: null },
            { discount_end_date: { [Op.gte]: now } }
          ]
        },
        order: [['discount_percentage', 'DESC']],
        limit: limit,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          }
        ]
      });
      
      const processedDeals = bestDeals.map(jewel => {
        const priceInfo = this.calculateFinalPrice(jewel);
        return {
          ...jewel.toJSON(),
          ...priceInfo
        };
      });
      
      return {
        success: true,
        deals: processedDeals
      };
      
    } catch (error) {
      console.error('❌ Erreur getBestDeals:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  /**
   * Valide les données de réduction
   */
  validateDiscountData(data) {
    const errors = [];
    
    // Validation du pourcentage
    const percentage = parseFloat(data.discount_percentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 90) {
      errors.push('Le pourcentage de réduction doit être entre 0 et 90');
    }
    
    // Validation des dates
    if (data.discount_start_date) {
      const startDate = new Date(data.discount_start_date);
      if (isNaN(startDate.getTime())) {
        errors.push('Date de début invalide');
      }
    }
    
    if (data.discount_end_date) {
      const endDate = new Date(data.discount_end_date);
      if (isNaN(endDate.getTime())) {
        errors.push('Date de fin invalide');
      }
    }
    
    // Validation de la cohérence des dates
    if (data.discount_start_date && data.discount_end_date) {
      const startDate = new Date(data.discount_start_date);
      const endDate = new Date(data.discount_end_date);
      
      if (endDate <= startDate) {
        errors.push('La date de fin doit être postérieure à la date de début');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Formate les données de réduction pour l'affichage
   */
  formatDiscountData(jewel) {
    const priceInfo = this.calculateFinalPrice(jewel);
    
    return {
      hasDiscount: priceInfo.hasDiscount,
      discountPercentage: priceInfo.discountPercentage,
      originalPrice: priceInfo.originalPrice,
      finalPrice: priceInfo.finalPrice,
      savings: priceInfo.savings,
      formattedOriginalPrice: new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(priceInfo.originalPrice),
      formattedFinalPrice: new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(priceInfo.finalPrice),
      formattedSavings: new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(priceInfo.savings),
      discountStartDate: jewel.discount_start_date,
      discountEndDate: jewel.discount_end_date,
      isActive: this.isDiscountActive(jewel)
    };
  }

};