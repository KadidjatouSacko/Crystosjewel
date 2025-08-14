import { Jewel } from '../models/jewelModel.js';
import { Material } from '../models/MaterialModel.js';
import { Type } from '../models/TypeModel.js';
import { Category } from '../models/categoryModel.js';
import { Op } from 'sequelize';
import { sequelize } from '../models/sequelize-client.js';

export const baguesControlleur = {
  
  /**
   * Affiche la page des bagues avec filtres fonctionnels
   */
  async showRings(req, res) {
    try {
      console.log('🔍 === DEBUT showRings - Version finale ===');
      
      // ==========================================
      // 1. RÉCUPÉRATION ET NORMALISATION DES FILTRES
      // ==========================================
      
      const filters = {
        matiere: req.query.matiere || [],
        prix: req.query.prix || [],
        tailles: req.query.tailles || [], // Depuis le JSON tailles
        carat: req.query.carat || [],
        type: req.query.type || [],
        sort: req.query.sort || 'newest'
      };

      // Normaliser tous les filtres en tableaux sauf sort
      Object.keys(filters).forEach(key => {
        if (key !== 'sort' && !Array.isArray(filters[key])) {
          filters[key] = filters[key] ? [filters[key]] : [];
        }
      });

      console.log('📋 Filtres reçus:', filters);

      // ==========================================
      // 2. PAGINATION
      // ==========================================
      
      const page = parseInt(req.query.page) || 1;
      const limit = 12;
      const offset = (page - 1) * limit;

      // ==========================================
      // 3. CONSTRUCTION DE LA CLAUSE WHERE
      // ==========================================
      
      let whereClause = { category_id: 3 }; // Bagues = catégorie 3

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

      // ✅ Filtre par tailles depuis JSON
      if (filters.tailles.length > 0) {
        // Recherche dans le JSON tailles
        const tailleConditions = filters.tailles.map(taille => 
          sequelize.literal(`JSON_SEARCH(tailles, 'one', '${taille}', NULL, '$[*].taille') IS NOT NULL`)
        );
        
        if (tailleConditions.length === 1) {
          whereClause[Op.and] = whereClause[Op.and] || [];
          whereClause[Op.and].push(tailleConditions[0]);
        } else {
          whereClause[Op.and] = whereClause[Op.and] || [];
          whereClause[Op.and].push({ [Op.or]: tailleConditions });
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
          whereClause[Op.and] = whereClause[Op.and] || [];
          whereClause[Op.and].push({ [Op.or]: priceConditions });
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
            ['created_at', 'DESC']
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

      console.log('🔍 Clause WHERE finale:', JSON.stringify(whereClause, null, 2));

      // ==========================================
      // 5. REQUÊTE PRINCIPALE AVEC INCLUDES
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
          },
          {
            model: Category,
            as: 'category',
            required: false,
            attributes: ['id', 'name']
          }
        ]
      });

      console.log(`✅ Bagues trouvées: ${count}, page ${page}`);

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

        // Générer le slug si manquant
        const slug = jewelData.slug || generateSlug(jewelData.name, jewelData.id);

        return {
          ...jewelData,
          formattedPrice: formatPrice(originalPrice),
          hasDiscount,
          slug
        };
      });

      // ==========================================
      // 7. CALCUL DES FILTRES DISPONIBLES DEPUIS LA BDD
      // ==========================================
      
      // Récupérer TOUS les bijoux de la catégorie pour calculer les filtres
      const allRings = await Jewel.findAll({
        where: { category_id: 3 },
        attributes: ['id', 'matiere', 'tailles', 'carat', 'type_id', 'price_ttc'],
        include: [
          {
            model: Type,
            as: 'type',
            required: false,
            attributes: ['id', 'name']
          }
        ]
      });

      // Calculer les filtres disponibles
      const availableFilters = calculateAvailableFilters(allRings);

      // Récupérer les matériaux et types pour les filtres
      const [allMaterials, allTypes] = await Promise.all([
        Material.findAll({ 
          order: [['name', 'ASC']] 
        }),
        Type.findAll({ 
          where: { category_id: 3 }, // Types pour bagues
          order: [['name', 'ASC']] 
        })
      ]);

      // Ajouter les comptes aux matériaux et types
      const materialsWithCount = allMaterials.map(material => ({
        ...material.toJSON(),
        count: allRings.filter(ring => ring.matiere === material.name).length
      })).filter(m => m.count > 0);

      const typesWithCount = allTypes.map(type => ({
        ...type.toJSON(),
        count: allRings.filter(ring => ring.type_id === type.id).length
      })).filter(t => t.count > 0);

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
        title: 'Bagues Élégantes - CrystoJewel',
        pageTitle: 'Nos Bagues Élégantes',
        jewels: formattedJewels,
        filters: filters,
        availableFilters: availableFilters,
        materials: materialsWithCount,
        types: typesWithCount,
        pagination: pagination,
        user: req.session?.user || null,
        cartItemCount: 0 // À implémenter selon votre logique panier
      };

      console.log(`✅ Rendu: ${formattedJewels.length} bijoux formatés`);
      console.log(`🔧 Filtres: ${materialsWithCount.length} matériaux, ${typesWithCount.length} types`);
      console.log(`📊 Tailles disponibles: ${availableFilters.sizes.length}`);

      res.render('bagues', viewData);

    } catch (error) {
      console.error('❌ Erreur dans showRings:', error.message);
      console.error('📍 Stack:', error.stack);
      
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
// FONCTIONS UTILITAIRES
// ==========================================

/**
 * Calcule les filtres disponibles depuis les données BDD
 */
function calculateAvailableFilters(allRings) {
  console.log(`📊 Calcul filtres sur ${allRings.length} bagues`);

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
    if (ring.carat && ring.carat > 0) {
      carats[ring.carat] = (carats[ring.carat] || 0) + 1;
    }
  });

  // Prix par tranches avec calcul dynamique
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
  })).filter(p => p.count > 0);

  return {
    sizes: Object.entries(sizes)
      .map(([name, count]) => ({ name, count }))
      .filter(s => s.count > 0)
      .sort((a, b) => {
        // Tri numérique pour les tailles
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
      
    priceRangeOptions: priceRangeOptions
  };
}

/**
 * Formate un prix en euros
 */
function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price);
}

/**
 * Vérifie si un produit est nouveau (moins de 30 jours)
 */
function isNewProduct(createdAt) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return new Date(createdAt) > thirtyDaysAgo;
}

/**
 * Génère un slug pour une URL friendly
 */
function generateSlug(name, id) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^a-z0-9]+/g, '-')     // Remplacer par des tirets
    .replace(/^-+|-+$/g, '');        // Supprimer tirets début/fin
  return `${slug}-${id}`;
}