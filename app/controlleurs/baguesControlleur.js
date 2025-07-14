import { Jewel, Category } from '../models/associations.js';
import { Type } from '../models/TypeModel.js';
import { Material } from '../models/MaterialModel.js';
import Sequelize from 'sequelize';

const { Op } = Sequelize;

export const baguesControlleur = {
  async showRings(req, res) {
    try {
      console.log('🔍 Affichage des bagues avec filtres/tri');
      console.log('📋 Query params reçus:', JSON.stringify(req.query, null, 2));

      // ===== RÉCUPÉRATION DES FILTRES =====
      const filters = {
        matiere: Array.isArray(req.query.matiere) ? req.query.matiere : (req.query.matiere ? [req.query.matiere] : []),
        taille: Array.isArray(req.query.taille) ? req.query.taille : (req.query.taille ? [req.query.taille] : []),
        type: Array.isArray(req.query.type) ? req.query.type : (req.query.type ? [req.query.type] : []),
        prix_min: req.query.prix_min,
        prix_max: req.query.prix_max,
        disponibilite: req.query.disponibilite,
        sort: req.query.sort || 'newest',
        carat: Array.isArray(req.query.carat) ? req.query.carat : (req.query.carat ? [req.query.carat] : []),
      };

      const page = parseInt(req.query.page) || 1;
      const limit = 12; // Bijoux par page
      const offset = (page - 1) * limit;

      console.log('🎯 Filtres traités:', JSON.stringify(filters, null, 2));

      // ===== CONSTRUCTION DE LA CLAUSE WHERE =====
      let whereClause = {
        category_id: 3, // ID catégorie bagues
        // Enlever is_active si cette colonne n'existe pas
      };

      // Filtre par matériau
      if (filters.matiere.length > 0) {
        whereClause.matiere = { [Op.in]: filters.matiere };
        console.log('🎯 Filtre matière appliqué:', filters.matiere);
      }

      // Filtre par type
      if (filters.type.length > 0) {
        whereClause.type_id = { [Op.in]: filters.type.map(t => parseInt(t)) };
        console.log('🎯 Filtre type appliqué:', filters.type);
      }

      // Filtre par prix
      if (filters.prix_min || filters.prix_max) {
        whereClause.price_ttc = {};
        if (filters.prix_min) {
          whereClause.price_ttc[Op.gte] = parseFloat(filters.prix_min);
        }
        if (filters.prix_max) {
          whereClause.price_ttc[Op.lte] = parseFloat(filters.prix_max);
        }
        console.log('🎯 Filtre prix appliqué:', whereClause.price_ttc);
      }

      // Filtre par disponibilité
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
        case 'popular':
          orderClause = [['views_count', 'DESC']];
          break;
        case 'newest':
        default:
          orderClause = [['created_at', 'DESC']];
      }

      console.log('🔍 Clause WHERE finale:', JSON.stringify(whereClause, null, 2));
      console.log('📊 Ordre de tri:', orderClause);

      // ===== RÉCUPÉRATION DES BAGUES =====
      const { count: totalJewels, rows: rings } = await Jewel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name'],
            required: false
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

      // ===== FORMATAGE DES BAGUES =====
      const formattedRings = rings.map(ring => {
        const ringData = ring.toJSON();
        
        // Calcul des prix et réductions
        const originalPrice = parseFloat(ringData.price_ttc) || 0;
        let finalPrice = originalPrice;
        let hasDiscount = false;
        let discountPercentage = 0;

        // Gestion des réductions
        if (ringData.discount_percentage && ringData.discount_percentage > 0) {
          discountPercentage = parseFloat(ringData.discount_percentage);
          finalPrice = originalPrice - (originalPrice * discountPercentage / 100);
          hasDiscount = true;
        }

        // Détermination des badges
        let badge = null;
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        
        if (new Date(ringData.created_at) >= fourteenDaysAgo) {
          badge = { type: 'new', text: 'Nouveau' };
        } else if (hasDiscount) {
          badge = { type: 'sale', text: `-${Math.round(discountPercentage)}%` };
        } else if (ringData.stock <= 5 && ringData.stock > 0) {
          badge = { type: 'limited', text: 'Stock limité' };
        }

        return {
          ...ringData,
          finalPrice,
          hasDiscount,
          discountPercentage: Math.round(discountPercentage),
          badge,
          formattedPrice: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(finalPrice),
          formattedOriginalPrice: hasDiscount ? new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(originalPrice) : null,
          formattedSalePrice: hasDiscount ? new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(finalPrice) : null,
          image: ringData.image || 'no-image.jpg',
          // Simuler note et avis
          average_rating: Math.random() * 2 + 3, // Entre 3 et 5
          reviews_count: Math.floor(Math.random() * 50) + 1
        };
      });

      // ===== RÉCUPÉRATION DES DONNÉES POUR LES FILTRES =====
      
      // Récupérer tous les matériaux disponibles
      const allMaterials = await Material.findAll({
        order: [['name', 'ASC']]
      });

      const materialsWithCount = allMaterials.map(material => ({
        id: material.id,
        name: material.name,
        count: 5 // Valeur factice, vous pouvez calculer le vrai count plus tard
      }));

      // Récupérer tous les types de bagues
      const allTypes = await Type.findAll({
        where: { category_id: 3 },
        order: [['name', 'ASC']]
      });

      const typesWithCount = allTypes.map(type => ({
        id: type.id,
        name: type.name,
        count: 3 // Valeur factice
      }));

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

      console.log('📊 Pagination:', pagination);

      // ===== RENDU DE LA PAGE =====
      const renderData = {
        title: 'Nos Bagues - Éclat Doré',
        pageTitle: 'Nos Bagues',
        jewels: formattedRings,
        pagination,
        filters,
        materials: materialsWithCount,
        types: typesWithCount,
        carats: ['9', '14', '18'], // Valeurs factices
        availableFilters: {
          materials: materialsWithCount,
          types: typesWithCount,
          carats: [
            { value: '9', count: 2 },
            { value: '14', count: 5 },
            { value: '18', count: 3 }
          ],
          sizes: [
            { value: '50', count: 4 },
            { value: '52', count: 6 },
            { value: '54', count: 8 },
            { value: '56', count: 5 }
          ]
        },
        user: req.session?.user || null,
        cartItemCount: req.session?.cartItemCount || 0,
        error: null,
        success: null
      };

      console.log('🎯 Rendu page avec:', {
        bijoux: formattedRings.length,
        filtres: Object.keys(filters).filter(key => filters[key] && filters[key].length > 0).length,
        pagination: `${page}/${totalPages}`
      });

      res.render('bagues', renderData);

    } catch (error) {
      console.error('❌ Erreur dans showRings:', error);
      console.error('Stack:', error.stack);

      // Page d'erreur avec structure minimale
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
          carat: [],
          prix_min: null,
          prix_max: null,
          disponibilite: null,
          sort: 'newest'
        },
        availableFilters: {
          materials: [],
          sizes: [],
          types: [],
          carats: []
        },
        materials: [],
        types: [],
        carats: [],
        user: req.session?.user || null,
        cartItemCount: 0,
        error: `Erreur : ${error.message}`,
        success: null
      });
    }
  }
};

// === API ENDPOINTS ===
export const toggleWishlistAPI = async (req, res) => {
  try {
    const { jewelId } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vous devez être connecté pour gérer vos favoris'
      });
    }

    // Simuler la gestion des favoris (remplacez par votre logique)
    const isInWishlist = Math.random() > 0.5;

    res.json({
      success: true,
      added: !isInWishlist,
      message: isInWishlist ? 'Retiré des favoris' : 'Ajouté aux favoris'
    });

  } catch (error) {
    console.error('Erreur toggleWishlistAPI:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};