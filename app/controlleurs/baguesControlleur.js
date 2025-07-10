import { Jewel, Category } from '../models/associations.js';
import { Type } from '../models/TypeModel.js';
import { Material } from '../models/MaterialModel.js';
import Sequelize from 'sequelize';
import { 
    determineBadges, 
    calculateFinalPrice, 
    getAvailableFilters 
} from '../utils/productHelpers.js';

const { Op } = Sequelize;

export const baguesControlleur = {
  // Méthode améliorée pour afficher les bagues avec filtres
  async showRings(req, res) {
    try {
      console.log('🔍 Affichage des bagues avec filtres');
      
      // ===== RÉCUPÉRATION DES FILTRES =====
      const filters = {
        matiere: Array.isArray(req.query.matiere) ? req.query.matiere : (req.query.matiere ? [req.query.matiere] : []),
        taille: Array.isArray(req.query.taille) ? req.query.taille : (req.query.taille ? [req.query.taille] : []),
        type: Array.isArray(req.query.type) ? req.query.type : (req.query.type ? [req.query.type] : []),
        prix_min: req.query.prix_min,
        prix_max: req.query.prix_max,
        disponibilite: req.query.disponibilite,
        sort: req.query.sort || 'newest'
      };
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;
      const offset = (page - 1) * limit;
      
      // ===== CONSTRUCTION DE LA CLAUSE WHERE =====
      let whereClause = { 
        category_id: 3, // 
        is_active: true 
      };
      
      // Filtrer par matière
      if (filters.matiere.length > 0) {
        whereClause.matiere = { [Op.in]: filters.matiere };
      }
      
      // Filtrer par taille
      if (filters.taille.length > 0) {
        whereClause.taille = { [Op.in]: filters.taille };
      }
      
      // Filtrer par type
      if (filters.type.length > 0) {
        whereClause.type_id = { [Op.in]: filters.type };
      }
      
      // Filtrer par prix
      if (filters.prix_min || filters.prix_max) {
        whereClause.price_ttc = {};
        if (filters.prix_min) {
          whereClause.price_ttc[Op.gte] = parseFloat(filters.prix_min);
        }
        if (filters.prix_max) {
          whereClause.price_ttc[Op.lte] = parseFloat(filters.prix_max);
        }
      }
      
      // Filtrer par disponibilité
      if (filters.disponibilite === 'en_stock') {
        whereClause.stock = { [Op.gt]: 0 };
      } else if (filters.disponibilite === 'en_promo') {
        whereClause.discount_percentage = { [Op.gt]: 0 };
      } else if (filters.disponibilite === 'nouveau') {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        whereClause.created_at = { [Op.gte]: fourteenDaysAgo };
      }
      
      // ===== ORDRE DE TRI =====
      let orderClause = [];
      switch (filters.sort) {
        case 'price_asc':
          orderClause = [['price_ttc', 'ASC']];
          break;
        case 'price_desc':
          orderClause = [['price_ttc', 'DESC']];
          break;
        case 'name_asc':
          orderClause = [['name', 'ASC']];
          break;
        case 'name_desc':
          orderClause = [['name', 'DESC']];
          break;
        case 'newest':
          orderClause = [['created_at', 'DESC']];
          break;
        case 'oldest':
          orderClause = [['created_at', 'ASC']];
          break;
        case 'popular':
          orderClause = [['views_count', 'DESC']];
          break;
        case 'bestseller':
          orderClause = [['sales_count', 'DESC']];
          break;
        default:
          orderClause = [['created_at', 'DESC']];
      }
      
      // ===== RÉCUPÉRATION DES BAGUES =====
      const { count: totalJewels, rows: rings } = await Jewel.findAndCountAll({
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
        limit,
        offset,
        distinct: true
      });

      console.log(`✅ ${rings.length} bagues récupérées sur ${totalJewels} total`);

      // ===== FORMATAGE DES BAGUES AVEC BADGES ET PRIX =====
      const formattedRings = rings.map(ring => {
        const ringData = ring.toJSON();
        const priceInfo = calculateFinalPrice(ringData);
        const badge = determineBadges(ringData);
        
        return {
          ...ringData,
          ...priceInfo,
          badge,
          // Formatage des prix
          formattedPrice: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(priceInfo.finalPrice),
          formattedOriginalPrice: priceInfo.hasDiscount ? new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(priceInfo.originalPrice) : null,
          formattedSavings: priceInfo.hasDiscount ? new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(priceInfo.savings) : null,
          // Image
          image: ringData.image || 'no-image.jpg'
        };
      });
      
      // ===== RÉCUPÉRATION DES FILTRES DISPONIBLES =====
      const availableFilters = await getAvailableFilters(1); // categoryId = 1 pour bagues
      
      // ===== PAGINATION =====
      const totalPages = Math.ceil(totalJewels / limit);
      const pagination = {
        currentPage: page,
        totalPages,
        totalJewels,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      };
      
      // ===== RENDU AVEC VOTRE TEMPLATE ACTUEL =====
      res.render('bagues', {
        title: 'Nos Bagues - CrystosJewel',
        pageTitle: 'Nos Bagues',
        jewels: formattedRings,
        
        // Données de pagination
        pagination,
        
        // Filtres appliqués
        filters,
        
        // Filtres disponibles (NOUVEAU)
        availableFilters,
        
        // Données pour les anciens filtres (compatibilité)
        materials: availableFilters.materials || [],
        types: availableFilters.types || [],
        
        // Utilisateur
        user: req.session?.user || null,
        cartItemCount: req.session?.cartItemCount || 0,
        
        // Messages
        error: null,
        success: null
      });

    } catch (error) {
      console.error('❌ Erreur dans showRings:', error);
      
      // Rendu d'urgence avec données minimales
      res.status(500).render('bagues', {
        title: 'Nos Bagues - Erreur',
        pageTitle: 'Nos Bagues',
        jewels: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalJewels: 0,
          hasNextPage: false,
          hasPrevPage: false,
          nextPage: 1,
          prevPage: 1
        },
        filters: {
          matiere: [],
          taille: [],
          type: [],
          prix_min: null,
          prix_max: null,
          disponibilite: null,
          sort: 'newest'
        },
        availableFilters: {
          materials: [],
          sizes: [],
          types: [],
          priceRange: { min: 0, max: 1000 },
          availability: { in_stock: 0, on_sale: 0, new_items: 0, total: 0 }
        },
        materials: [],
        types: [],
        user: req.session?.user || null,
        cartItemCount: 0,
        error: `Erreur : ${error.message}`,
        success: null
      });
    }
  }
};