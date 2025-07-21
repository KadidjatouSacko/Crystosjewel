// ================================
// CONTRÔLEUR BAGUES AMÉLIORÉ
// Filtres dynamiques avec compteurs
// ================================

import { Jewel, Category } from '../models/associations.js';
import { Type } from '../models/TypeModel.js';
import { Material } from '../models/MaterialModel.js';
import { discountService } from '../services/discountService.js';
import { sequelize } from '../models/sequelize-client.js';
import Sequelize from 'sequelize';

const { Op } = Sequelize;

// ================================
// FONCTIONS UTILITAIRES
// ================================

function calculateFinalPrice(jewel) {
  return discountService.calculateFinalPrice(jewel);
}

function determineBadges(jewel) {
  const now = new Date();
  const createdDate = new Date(jewel.created_at);
  const daysDiff = (now - createdDate) / (1000 * 60 * 60 * 24);
  const priceInfo = calculateFinalPrice(jewel);
  
  if (priceInfo.hasDiscount) {
    return {
      badge: `Promo -${jewel.discount_percentage}%`,
      badgeClass: 'promo'
    };
  } else if (daysDiff <= 14) {
    return {
      badge: 'Nouveau',
      badgeClass: 'nouveau'
    };
  } else if (jewel.views_count > 50 || jewel.sales_count > 10) {
    return {
      badge: 'Populaire',
      badgeClass: 'populaire'
    };
  } else if (jewel.stock <= 3 && jewel.stock > 0) {
    return {
      badge: 'Dernière Chance',
      badgeClass: 'derniere-chance'
    };
  }
  
  return null;
}

/**
 * Récupère les filtres disponibles avec compteurs dynamiques
 */
async function getAvailableFiltersWithCount(categoryId, currentFilters = {}) {
  try {
    console.log('🔍 Récupération des filtres avec compteurs...');
    
    // Construction de la clause WHERE de base
    let baseWhere = `category_id = ${categoryId} AND is_active = true`;
    
    // Appliquer les filtres existants pour le comptage (sauf le filtre en cours)
    if (currentFilters.taille && currentFilters.taille.length > 0) {
      const tailles = currentFilters.taille.map(t => `'${t}'`).join(',');
      baseWhere += ` AND taille IN (${tailles})`;
    }
    
    if (currentFilters.type && currentFilters.type.length > 0) {
      const types = currentFilters.type.map(t => parseInt(t)).join(',');
      baseWhere += ` AND type_id IN (${types})`;
    }
    
    if (currentFilters.carat && currentFilters.carat.length > 0) {
      const carats = currentFilters.carat.map(c => parseInt(c)).join(',');
      baseWhere += ` AND carat IN (${carats})`;
    }

    // 1. MATÉRIAUX avec compteurs (sans filtre matière appliqué)
    const materialsQuery = `
      SELECT 
        COALESCE(matiere, 'Non spécifié') as name,
        COUNT(*) as count
      FROM jewel
      WHERE ${baseWhere} AND matiere IS NOT NULL AND TRIM(matiere) != ''
      GROUP BY matiere
      HAVING COUNT(*) > 0
      ORDER BY count DESC, matiere ASC
    `;
    
    const materials = await sequelize.query(materialsQuery, { type: sequelize.QueryTypes.SELECT });

    // 2. TAILLES avec compteurs (sans filtre taille appliqué)
    let sizeBaseWhere = `category_id = ${categoryId} AND is_active = true`;
    if (currentFilters.matiere && currentFilters.matiere.length > 0) {
      const matieres = currentFilters.matiere.map(m => `'${m}'`).join(',');
      sizeBaseWhere += ` AND matiere IN (${matieres})`;
    }
    if (currentFilters.type && currentFilters.type.length > 0) {
      const types = currentFilters.type.map(t => parseInt(t)).join(',');
      sizeBaseWhere += ` AND type_id IN (${types})`;
    }
    if (currentFilters.carat && currentFilters.carat.length > 0) {
      const carats = currentFilters.carat.map(c => parseInt(c)).join(',');
      sizeBaseWhere += ` AND carat IN (${carats})`;
    }

    const sizesQuery = `
      SELECT 
        taille as name,
        COUNT(*) as count
      FROM jewel
      WHERE ${sizeBaseWhere} AND taille IS NOT NULL AND TRIM(taille) != ''
      GROUP BY taille
      HAVING COUNT(*) > 0
      ORDER BY count DESC, taille ASC
    `;
    
    const sizes = await sequelize.query(sizesQuery, { type: sequelize.QueryTypes.SELECT });

    // 3. CARATS avec compteurs
    let caratBaseWhere = `category_id = ${categoryId} AND is_active = true`;
    if (currentFilters.matiere && currentFilters.matiere.length > 0) {
      const matieres = currentFilters.matiere.map(m => `'${m}'`).join(',');
      caratBaseWhere += ` AND matiere IN (${matieres})`;
    }
    if (currentFilters.taille && currentFilters.taille.length > 0) {
      const tailles = currentFilters.taille.map(t => `'${t}'`).join(',');
      caratBaseWhere += ` AND taille IN (${tailles})`;
    }
    if (currentFilters.type && currentFilters.type.length > 0) {
      const types = currentFilters.type.map(t => parseInt(t)).join(',');
      caratBaseWhere += ` AND type_id IN (${types})`;
    }

    const caratsQuery = `
      SELECT 
        carat,
        COUNT(*) as count
      FROM jewel
      WHERE ${caratBaseWhere} AND carat IS NOT NULL
      GROUP BY carat
      HAVING COUNT(*) > 0
      ORDER BY carat ASC
    `;
    
    const carats = await sequelize.query(caratsQuery, { type: sequelize.QueryTypes.SELECT });

    // 4. FOURCHETTES DE PRIX avec compteurs
    let priceBaseWhere = `category_id = ${categoryId} AND is_active = true`;
    if (currentFilters.matiere && currentFilters.matiere.length > 0) {
      const matieres = currentFilters.matiere.map(m => `'${m}'`).join(',');
      priceBaseWhere += ` AND matiere IN (${matieres})`;
    }
    if (currentFilters.taille && currentFilters.taille.length > 0) {
      const tailles = currentFilters.taille.map(t => `'${t}'`).join(',');
      priceBaseWhere += ` AND taille IN (${tailles})`;
    }
    if (currentFilters.type && currentFilters.type.length > 0) {
      const types = currentFilters.type.map(t => parseInt(t)).join(',');
      priceBaseWhere += ` AND type_id IN (${types})`;
    }
    if (currentFilters.carat && currentFilters.carat.length > 0) {
      const carats = currentFilters.carat.map(c => parseInt(c)).join(',');
      priceBaseWhere += ` AND carat IN (${carats})`;
    }

    const priceRangesQuery = `
      SELECT 
        CASE 
          WHEN price_ttc <= 20 THEN '0-20'
          WHEN price_ttc > 20 AND price_ttc <= 40 THEN '21-40'
          WHEN price_ttc > 40 AND price_ttc <= 60 THEN '41-60'
          WHEN price_ttc > 60 AND price_ttc <= 80 THEN '61-80'
          WHEN price_ttc > 80 THEN '80+'
        END as price_range,
        COUNT(*) as count
      FROM jewel
      WHERE ${priceBaseWhere} AND price_ttc IS NOT NULL
      GROUP BY 
        CASE 
          WHEN price_ttc <= 20 THEN '0-20'
          WHEN price_ttc > 20 AND price_ttc <= 40 THEN '21-40'
          WHEN price_ttc > 40 AND price_ttc <= 60 THEN '41-60'
          WHEN price_ttc > 60 AND price_ttc <= 80 THEN '61-80'
          WHEN price_ttc > 80 THEN '80+'
        END
      HAVING COUNT(*) > 0
      ORDER BY 
        CASE 
          WHEN price_range = '0-20' THEN 1
          WHEN price_range = '21-40' THEN 2
          WHEN price_range = '41-60' THEN 3
          WHEN price_range = '61-80' THEN 4
          WHEN price_range = '80+' THEN 5
        END
    `;
    
    const priceRanges = await sequelize.query(priceRangesQuery, { type: sequelize.QueryTypes.SELECT });

    // 5. TYPES avec compteurs
    let types = [];
    try {
      let typeBaseWhere = `t.category_id = ${categoryId}`;
      let joinCondition = 'LEFT JOIN jewel j ON j.type_id = t.id';
      let jewelWhere = 'j.is_active = true';
      
      if (currentFilters.matiere && currentFilters.matiere.length > 0) {
        const matieres = currentFilters.matiere.map(m => `'${m}'`).join(',');
        jewelWhere += ` AND j.matiere IN (${matieres})`;
      }
      if (currentFilters.taille && currentFilters.taille.length > 0) {
        const tailles = currentFilters.taille.map(t => `'${t}'`).join(',');
        jewelWhere += ` AND j.taille IN (${tailles})`;
      }
      if (currentFilters.carat && currentFilters.carat.length > 0) {
        const carats = currentFilters.carat.map(c => parseInt(c)).join(',');
        jewelWhere += ` AND j.carat IN (${carats})`;
      }

      const typesQuery = `
        SELECT 
          t.id,
          t.name,
          COUNT(j.id) as count
        FROM "Types" t
        ${joinCondition}
        WHERE ${typeBaseWhere} AND ${jewelWhere}
        GROUP BY t.id, t.name
        HAVING COUNT(j.id) > 0
        ORDER BY t.name ASC
      `;
      
      types = await sequelize.query(typesQuery, { type: sequelize.QueryTypes.SELECT });
    } catch (typeError) {
      console.log('Types non disponibles:', typeError.message);
    }

    console.log('✅ Filtres récupérés:', {
      materials: materials.length,
      sizes: sizes.length,
      carats: carats.length,
      priceRanges: priceRanges.length,
      types: types.length
    });

    return {
      materials: materials || [],
      sizes: sizes || [],
      types: types || [],
      carats: carats || [],
      priceRanges: priceRanges || [],
      priceRangeOptions: [
        { value: '0-20', label: 'Moins de 20€', count: 0 },
        { value: '21-40', label: '21€ - 40€', count: 0 },
        { value: '41-60', label: '41€ - 60€', count: 0 },
        { value: '61-80', label: '61€ - 80€', count: 0 },
        { value: '80+', label: 'Plus de 80€', count: 0 }
      ].map(option => {
        const found = priceRanges.find(pr => pr.price_range === option.value);
        return {
          ...option,
          count: found ? found.count : 0
        };
      }).filter(option => option.count > 0)
    };
  } catch (error) {
    console.error('Erreur getAvailableFiltersWithCount:', error);
    return {
      materials: [],
      sizes: [],
      types: [],
      carats: [],
      priceRanges: [],
      priceRangeOptions: []
    };
  }
}

// ================================
// CONTRÔLEUR PRINCIPAL
// ================================

export const baguesControlleur = {
  
async showRings(req, res) {
    console.log('🔍 === DEBUT showRings ===');
    console.log('Paramètres reçus:', req.query);
    
    try {
      // ==========================================
      // 1. RÉCUPÉRATION DES PARAMÈTRES DE FILTRAGE
      // ==========================================
      
      const filters = {
        matiere: req.query.matiere || [],
        prix: req.query.prix || [],
        taille: req.query.taille || [],
        carat: req.query.carat || [],
        type: req.query.type || [],
        sort: req.query.sort || 'newest'
      };

      // Normaliser les filtres (s'assurer que c'est un tableau)
      Object.keys(filters).forEach(key => {
        if (key !== 'sort' && !Array.isArray(filters[key])) {
          filters[key] = filters[key] ? [filters[key]] : [];
        }
      });

      console.log('Filtres normalisés:', filters);

      // ==========================================
      // 2. PAGINATION
      // ==========================================
      
      const page = parseInt(req.query.page) || 1;
      const limit = 12; // 12 produits par page
      const offset = (page - 1) * limit;

      // ==========================================
      // 3. CONSTRUCTION DE LA CLAUSE WHERE
      // ==========================================
      
      let whereClause = { 
        category_id: 1 // ID de la catégorie "bagues"
      };

      // Filtre par matériau
      if (filters.matiere.length > 0) {
        whereClause.matiere = { 
          [Op.in]: filters.matiere 
        };
      }

      // Filtre par type (si vous avez une table types)
      if (filters.type.length > 0) {
        whereClause.type_id = { 
          [Op.in]: filters.type.map(t => parseInt(t)) 
        };
      }

      // Filtre par taille (si applicable)
      if (filters.taille.length > 0) {
        whereClause.taille = { 
          [Op.in]: filters.taille 
        };
      }

      // Filtre par carat (si applicable)
      if (filters.carat.length > 0) {
        whereClause.carat = { 
          [Op.in]: filters.carat.map(c => parseFloat(c)) 
        };
      }

      // Filtre par prix
      if (filters.prix.length > 0) {
        const priceConditions = [];
        
        filters.prix.forEach(range => {
          switch (range) {
            case '0-20':
              priceConditions.push({ price_ttc: { [Op.between]: [0, 20] } });
              break;
            case '21-40':
              priceConditions.push({ price_ttc: { [Op.between]: [21, 40] } });
              break;
            case '41-60':
              priceConditions.push({ price_ttc: { [Op.between]: [41, 60] } });
              break;
            case '61-80':
              priceConditions.push({ price_ttc: { [Op.between]: [61, 80] } });
              break;
            case '80+':
              priceConditions.push({ price_ttc: { [Op.gte]: 80 } });
              break;
          }
        });

        if (priceConditions.length > 0) {
          whereClause[Op.or] = priceConditions;
        }
      }

      console.log('Clause WHERE construite:', JSON.stringify(whereClause, null, 2));

      // ==========================================
      // 4. GESTION DU TRI
      // ==========================================
      
      let orderClause = [['created_at', 'DESC']]; // Par défaut

      switch (filters.sort) {
        case 'price_asc':
          orderClause = [['price_ttc', 'ASC']];
          break;
        case 'price_desc':
          orderClause = [['price_ttc', 'DESC']];
          break;
        case 'popular':
          orderClause = [['popularity_score', 'DESC'], ['created_at', 'DESC']];
          break;
        case 'name_asc':
          orderClause = [['name', 'ASC']];
          break;
        case 'name_desc':
          orderClause = [['name', 'DESC']];
          break;
        case 'newest':
        default:
          orderClause = [['created_at', 'DESC']];
          break;
      }

      // ==========================================
      // 5. REQUÊTE PRINCIPALE AVEC PAGINATION
      // ==========================================
      
      const { count, rows: jewels } = await Jewel.findAndCountAll({
        where: whereClause,
        order: orderClause,
        limit: limit,
        offset: offset,
        include: [
          {
            model: Type,
            as: 'type',
            required: false
          }
        ]
      });

      console.log(`${count} bagues trouvées, affichage de ${jewels.length} sur la page ${page}`);

      // ==========================================
      // 6. FORMATAGE DES DONNÉES PRODUITS
      // ==========================================
      
      const formattedJewels = jewels.map(jewel => {
        // Calcul des prix et réductions
        const originalPrice = parseFloat(jewel.price_ttc);
        const discountPercent = parseFloat(jewel.discount_percent || 0);
        
        let currentPrice = originalPrice;
        let hasDiscount = false;
        
        if (discountPercent > 0) {
          currentPrice = originalPrice * (1 - discountPercent / 100);
          hasDiscount = true;
        }

        // Détermination du badge
        let badge = null;
        let badgeClass = '';
        
        if (hasDiscount) {
          badge = `-${Math.round(discountPercent)}%`;
          badgeClass = 'promo';
        } else if (jewel.is_new) {
          badge = 'Nouveau';
          badgeClass = 'nouveau';
        } else if (jewel.is_featured) {
          badge = 'Populaire';
          badgeClass = 'populaire';
        }

        return {
          ...jewel.toJSON(),
          formattedCurrentPrice: `${currentPrice.toFixed(2)}€`,
          formattedOriginalPrice: hasDiscount ? `${originalPrice.toFixed(2)}€` : null,
          formattedPrice: `${originalPrice.toFixed(2)}€`,
          hasDiscount,
          badge,
          badgeClass,
          slug: jewel.slug || `bague-${jewel.id}`
        };
      });

      // ==========================================
      // 7. CALCUL DES FILTRES DISPONIBLES
      // ==========================================
      
      // Récupérer tous les bijoux de la catégorie pour calculer les options de filtres
      const allRings = await Jewel.findAll({
        where: { category_id: 1 },
        include: [
          {
            model: Type,
            as: 'type',
            required: false
          }
        ]
      });

      // Calculer les matériaux disponibles
      const availableMaterials = {};
      const availableTypes = {};
      const availableSizes = {};
      const availableCarats = {};

      allRings.forEach(ring => {
        // Matériaux
        if (ring.matiere) {
          availableMaterials[ring.matiere] = (availableMaterials[ring.matiere] || 0) + 1;
        }

        // Types
        if (ring.type) {
          const typeKey = ring.type.id;
          if (!availableTypes[typeKey]) {
            availableTypes[typeKey] = {
              id: ring.type.id,
              name: ring.type.name,
              count: 0
            };
          }
          availableTypes[typeKey].count++;
        }

        // Tailles (si applicable)
        if (ring.taille) {
          availableSizes[ring.taille] = (availableSizes[ring.taille] || 0) + 1;
        }

        // Carats (si applicable)
        if (ring.carat) {
          availableCarats[ring.carat] = (availableCarats[ring.carat] || 0) + 1;
        }
      });

      // Formatage des filtres pour la vue
      const availableFilters = {
        materials: Object.entries(availableMaterials).map(([name, count]) => ({ name, count })),
        types: Object.values(availableTypes),
        sizes: Object.entries(availableSizes).map(([name, count]) => ({ name, count })),
        carats: Object.entries(availableCarats).map(([carat, count]) => ({ 
          carat: parseFloat(carat), 
          count 
        })),
        priceRangeOptions: [
          { value: '0-20', label: 'Moins de 20€', count: allRings.filter(r => r.price_ttc <= 20).length },
          { value: '21-40', label: '21€ - 40€', count: allRings.filter(r => r.price_ttc > 20 && r.price_ttc <= 40).length },
          { value: '41-60', label: '41€ - 60€', count: allRings.filter(r => r.price_ttc > 40 && r.price_ttc <= 60).length },
          { value: '61-80', label: '61€ - 80€', count: allRings.filter(r => r.price_ttc > 60 && r.price_ttc <= 80).length },
          { value: '80+', label: 'Plus de 80€', count: allRings.filter(r => r.price_ttc > 80).length }
        ]
      };

      // ==========================================
      // 8. PAGINATION
      // ==========================================
      
      const totalPages = Math.ceil(count / limit);
      const pagination = {
        currentPage: page,
        totalPages: totalPages,
        totalItems: count,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      };

      // ==========================================
      // 9. DONNÉES POUR LA VUE
      // ==========================================
      
      const viewData = {
        title: 'Bagues - Éclat Doré',
        pageTitle: 'Nos Bagues Élégantes',
        jewels: formattedJewels,
        filters: filters,
        availableFilters: availableFilters,
        pagination: pagination,
        user: req.session?.user || null,
        req: req // Pour la construction des URLs de pagination
      };

      console.log('✅ Données préparées pour la vue');
      console.log(`📊 ${formattedJewels.length} bijoux formatés`);
      console.log(`🔧 Filtres disponibles: ${availableFilters.materials.length} matériaux, ${availableFilters.types.length} types`);

      // ==========================================
      // 10. RENDU DE LA VUE
      // ==========================================
      
      res.render('bagues', viewData);

    } catch (error) {
      console.error('❌ Erreur dans showRings:', error);
      console.error('Stack:', error.stack);
      
      return res.status(500).render('error', {
        title: 'Erreur serveur',
        message: 'Une erreur est survenue lors du chargement des bagues.',
        statusCode: 500,
        user: req.session?.user || null
      });
    }
  }
};