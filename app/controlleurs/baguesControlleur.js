// baguesControlleur.js - VERSION CORRIGÉE POUR VOTRE BDD
import { Jewel } from '../models/jewelModel.js';
import { Material } from '../models/materialModel.js';
import { Type } from '../models/TypeModel.js';
import { Category } from '../models/categoryModel.js';
import { Op } from 'sequelize';

const baguesControlleur = {
  
  /**
   * Affiche la page des bagues - CORRIGÉ pour vos colonnes BDD
   */
  async showRings(req, res) {
    try {
      console.log('🔍 === DEBUT showRings - Version corrigée BDD ===');
      
      // ==========================================
      // 1. RÉCUPÉRATION ET NORMALISATION DES FILTRES
      // ==========================================
      
      const filters = {
        matiere: req.query.matiere || [],
        prix: req.query.prix || [],
        tailles: req.query.tailles || [], // ✅ Corrigé: tailles (pluriel)
        carat: req.query.carat || [],
        type: req.query.type || [],
        sort: req.query.sort || 'newest'
      };

      // Normaliser tous les filtres en tableaux
      Object.keys(filters).forEach(key => {
        if (key !== 'sort' && !Array.isArray(filters[key])) {
          filters[key] = filters[key] ? [filters[key]] : [];
        }
      });

      console.log('Filtres reçus:', Object.keys(req.query).length, 'paramètres');

      // ==========================================
      // 2. PAGINATION
      // ==========================================
      
      const page = parseInt(req.query.page) || 1;
      const limit = 12;
      const offset = (page - 1) * limit;

      // ==========================================
      // 3. CONSTRUCTION DE LA CLAUSE WHERE
      // ==========================================
      
      let whereClause = { category_id: 3 }; // Bagues

      // Filtre par matériau
      if (filters.matiere.length > 0) {
        whereClause.matiere = { [Op.in]: filters.matiere };
      }

      // Filtre par type
      if (filters.type.length > 0) {
        whereClause.type_id = { [Op.in]: filters.type.map(t => parseInt(t)) };
      }

      // Filtre par carat
      if (filters.carat.length > 0) {
        whereClause.carat = { [Op.in]: filters.carat.map(c => parseFloat(c)) };
      }

      // ✅ Filtre par tailles (JSON) - CORRIGÉ
      if (filters.tailles.length > 0) {
        // Pour un champ JSON comme [{"taille":"5","stock":5}]
        const tailleConditions = filters.tailles.map(taille => ({
          tailles: {
            [Op.contains]: [{ taille: taille }]
          }
        }));
        
        if (tailleConditions.length === 1) {
          whereClause = { ...whereClause, ...tailleConditions[0] };
        } else {
          whereClause[Op.or] = tailleConditions;
        }
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
          // Combiner avec les conditions existantes
          if (whereClause[Op.or]) {
            whereClause[Op.and] = [
              { [Op.or]: whereClause[Op.or] },
              { [Op.or]: priceConditions }
            ];
            delete whereClause[Op.or];
          } else {
            whereClause[Op.or] = priceConditions;
          }
        }
      }

      // ==========================================
      // 4. GESTION DU TRI
      // ==========================================
      
      let orderClause = [['created_at', 'DESC']];

      switch (filters.sort) {
        case 'price_asc':
          orderClause = [['price_ttc', 'ASC']];
          break;
        case 'price_desc':
          orderClause = [['price_ttc', 'DESC']];
          break;
        case 'popular':
          orderClause = [
            ['popularity_score', 'DESC'], 
            ['favorites_count', 'DESC'], 
            ['views_count', 'DESC']
          ];
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
      // 5. REQUÊTE PRINCIPALE
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
            required: false,
            attributes: ['id', 'name']
          }
        ]
      });

      console.log(`Bagues trouvées: ${count}, page ${page}`);

      // ==========================================
      // 6. FORMATAGE DES BIJOUX
      // ==========================================
      
      const formattedJewels = jewels.map(jewel => {
        const jewelData = jewel.toJSON();
        
        // Calcul des prix et réductions
        const originalPrice = parseFloat(jewelData.price_ttc || 0);
        const discountPercent = parseFloat(jewelData.discount_percentage || 0);
        
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
        } else if (jewelData.created_at && isNewProduct(jewelData.created_at)) {
          badge = 'Nouveau';
          badgeClass = 'nouveau';
        } else if (jewelData.is_featured) {
          badge = 'Populaire';
          badgeClass = 'populaire';
        }

        return {
          ...jewelData,
          formattedCurrentPrice: formatPrice(currentPrice),
          formattedOriginalPrice: hasDiscount ? formatPrice(originalPrice) : null,
          formattedPrice: formatPrice(originalPrice),
          hasDiscount,
          badge,
          badgeClass,
          slug: jewelData.slug || generateSlug(jewelData.name, jewelData.id)
        };
      });

      // ==========================================
      // 7. CALCUL DES FILTRES DISPONIBLES
      // ==========================================
      
      // Récupérer tous les bijoux de la catégorie pour le calcul
      const allRings = await Jewel.findAll({
        where: { category_id: 3 },
        attributes: ['id', 'matiere', 'tailles', 'carat', 'type_id', 'price_ttc'], // ✅ tailles corrigé
        include: [
          {
            model: Type,
            as: 'type',
            required: false,
            attributes: ['id', 'name']
          }
        ]
      });

      // Calcul des filtres disponibles avec les bonnes colonnes
      const availableFilters = calculateFiltersFromDB(allRings, filters);

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
        nextPage: page < totalPages ? page + 1 : page,
        prevPage: page > 1 ? page - 1 : page
      };

      // ==========================================
      // 9. DONNÉES POUR LA VUE
      // ==========================================
      
      const viewData = {
        title: 'Bagues Élégantes - Éclat Doré',
        pageTitle: 'Nos Bagues Élégantes',
        jewels: formattedJewels,
        filters: filters,
        availableFilters: availableFilters,
        pagination: pagination,
        user: req.session?.user || null,
        req: req
      };

      console.log(`✅ Rendu: ${formattedJewels.length} bijoux formatés`);
      console.log(`🔧 Filtres disponibles calculés depuis BDD`);

      res.render('bagues', viewData);

    } catch (error) {
      console.error('❌ Erreur dans showRings:', error.message);
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

// ==========================================
// FONCTIONS UTILITAIRES HORS DE L'OBJET
// ==========================================

/**
 * Calcul des filtres basé sur votre structure BDD réelle
 */
function calculateFiltersFromDB(allRings, currentFilters) {
  console.log(`📊 Calcul filtres sur ${allRings.length} bagues`);

  // Matériaux disponibles
  const materials = {};
  allRings.forEach(ring => {
    if (ring.matiere) {
      materials[ring.matiere] = (materials[ring.matiere] || 0) + 1;
    }
  });

  // ✅ Tailles depuis le champ JSON tailles
  const sizes = {};
  allRings.forEach(ring => {
    if (ring.tailles && Array.isArray(ring.tailles)) {
      ring.tailles.forEach(tailleObj => {
        if (tailleObj.taille) {
          sizes[tailleObj.taille] = (sizes[tailleObj.taille] || 0) + 1;
        }
      });
    }
  });

  // Carats disponibles
  const carats = {};
  allRings.forEach(ring => {
    if (ring.carat) {
      carats[ring.carat] = (carats[ring.carat] || 0) + 1;
    }
  });

  // Types disponibles
  const types = {};
  allRings.forEach(ring => {
    if (ring.type && ring.type_id) {
      const typeKey = ring.type_id;
      if (!types[typeKey]) {
        types[typeKey] = {
          id: ring.type_id,
          name: ring.type?.name || `Type ${ring.type_id}`,
          count: 0
        };
      }
      types[typeKey].count++;
    }
  });

  // Prix par tranches
  const priceRanges = [
    { value: '0-20', label: 'Moins de 20€', min: 0, max: 20 },
    { value: '21-40', label: '21€ - 40€', min: 21, max: 40 },
    { value: '41-60', label: '41€ - 60€', min: 41, max: 60 },
    { value: '61-80', label: '61€ - 80€', min: 61, max: 80 },
    { value: '80+', label: 'Plus de 80€', min: 80, max: Infinity }
  ];

  const priceRangeOptions = priceRanges.map(range => ({
    ...range,
    count: allRings.filter(ring => {
      const price = parseFloat(ring.price_ttc || 0);
      return price >= range.min && (range.max === Infinity ? true : price <= range.max);
    }).length
  }));

  return {
    materials: Object.entries(materials)
      .map(([name, count]) => ({ name, count }))
      .filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count),
      
    sizes: Object.entries(sizes)
      .map(([name, count]) => ({ name, count }))
      .filter(s => s.count > 0)
      .sort((a, b) => {
        const aNum = parseFloat(a.name);
        const bNum = parseFloat(b.name);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.name.localeCompare(b.name);
      }),
      
    carats: Object.entries(carats)
      .map(([carat, count]) => ({ carat: parseFloat(carat), count }))
      .filter(c => c.count > 0)
      .sort((a, b) => a.carat - b.carat),
      
    types: Object.values(types)
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count),
      
    priceRangeOptions: priceRangeOptions.filter(p => p.count > 0)
  };
}

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price);
}

function isNewProduct(createdAt) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return new Date(createdAt) > thirtyDaysAgo;
}

function generateSlug(name, id) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}-${id}`;
}

export { baguesControlleur };