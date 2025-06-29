import { Category } from '../models/categoryModel.js';
import { Jewel } from '../models/jewelModel.js';
import { Type } from '../models/TypeModel.js';
import { Material } from '../models/MaterialModel.js';
import Sequelize from 'sequelize';
const { Op } = Sequelize;

export const braceletsControlleur = {
  async showBracelets(req, res) {
    try {
      console.log('🚀 === DEBUT showBracelets ===');
      
      // **CORRECTION** : Utiliser l'ID fixe de la catégorie bracelets (1)
      const categoryId = 1; // Bracelets = catégorie 1 selon votre BDD
      
      console.log('🔍 Recherche des bracelets avec category_id:', categoryId);

      // Récupération des filtres et tri depuis les paramètres de requête
      const {
        matiere = [],
        type = [],
        prix = [],
        sort = 'newest',
        page = 1
      } = req.query;

      console.log('📋 Filtres reçus:', { matiere, type, prix, sort, page });

      // Construction de la clause WHERE
      let whereClause = { category_id: categoryId };
      
      // Filtre par matériau
      if (Array.isArray(matiere) && matiere.length > 0) {
        const materiaux = await Material.findAll({
          where: { id: { [Op.in]: matiere } }
        });
        if (materiaux.length > 0) {
          whereClause.matiere = { 
            [Op.in]: materiaux.map(m => m.name) 
          };
        }
      } else if (matiere && matiere.length > 0) {
        const materiau = await Material.findByPk(matiere);
        if (materiau) {
          whereClause.matiere = materiau.name;
        }
      }

      // Filtre par type
      if (Array.isArray(type) && type.length > 0) {
        whereClause.type_id = { [Op.in]: type };
      } else if (type && type.length > 0) {
        whereClause.type_id = type;
      }

      // Filtre par prix
      if (Array.isArray(prix) && prix.length > 0) {
        const priceConditions = [];
        prix.forEach(range => {
          switch (range) {
            case '0-100':
              priceConditions.push({ [Op.between]: [0, 100] });
              break;
            case '100-200':
              priceConditions.push({ [Op.between]: [100, 200] });
              break;
            case '200-500':
              priceConditions.push({ [Op.between]: [200, 500] });
              break;
            case '500+':
              priceConditions.push({ [Op.gte]: 500 });
              break;
          }
        });
        if (priceConditions.length > 0) {
          whereClause.price_ttc = { [Op.or]: priceConditions };
        }
      } else if (prix && prix.length > 0) {
        switch (prix) {
          case '0-100':
            whereClause.price_ttc = { [Op.between]: [0, 100] };
            break;
          case '100-200':
            whereClause.price_ttc = { [Op.between]: [100, 200] };
            break;
          case '200-500':
            whereClause.price_ttc = { [Op.between]: [200, 500] };
            break;
          case '500+':
            whereClause.price_ttc = { [Op.gte]: 500 };
            break;
        }
      }

      console.log('🔍 Clause WHERE finale:', whereClause);

      // Définition du tri
      let orderClause = [['created_at', 'DESC']];
      switch (sort) {
        case 'price_asc':
          orderClause = [['price_ttc', 'ASC']];
          break;
        case 'price_desc':
          orderClause = [['price_ttc', 'DESC']];
          break;
        case 'popularity':
          orderClause = [['popularity_score', 'DESC']];
          break;
        case 'newest':
          orderClause = [['created_at', 'DESC']];
          break;
        default:
          orderClause = [['created_at', 'DESC']];
      }

      // Pagination
      const limit = 12;
      const offset = (parseInt(page) - 1) * limit;

      // Requête principale pour récupérer les bijoux
      const { rows: bracelets, count: totalBracelets } = await Jewel.findAndCountAll({
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

      console.log(`✅ ${bracelets.length} bracelets récupérés sur ${totalBracelets} total`);

      // Formatage des bijoux pour l'affichage
      const formattedBracelets = bracelets.map(bracelet => {
        const now = new Date();
        const createdAt = new Date(bracelet.created_at);
        const daysDiff = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        
        // Déterminer le badge
        let badge = null;
        let badgeClass = '';
        
        if (daysDiff <= 7) {
          badge = 'Nouveau';
          badgeClass = 'nouveau';
        } else if (bracelet.popularity_score > 80) {
          badge = 'Populaire';
          badgeClass = 'populaire';
        } else if (bracelet.discount_percentage > 0) {
          badge = 'Promo';
          badgeClass = 'promo';
        }

        // Gestion des prix avec réductions
        const currentPrice = bracelet.discount_percentage > 0 
          ? bracelet.price_ttc * (1 - bracelet.discount_percentage / 100)
          : bracelet.price_ttc;

        return {
          ...bracelet.toJSON(),
          badge,
          badgeClass,
          hasDiscount: bracelet.discount_percentage > 0,
          formattedCurrentPrice: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(currentPrice),
          formattedOriginalPrice: bracelet.discount_percentage > 0 
            ? new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
              }).format(bracelet.price_ttc)
            : null,
          image: bracelet.image || 'no-image.jpg'
        };
      });

      // Récupération des données pour les filtres
      const [allMaterials, allTypes] = await Promise.all([
        Material.findAll({ order: [['name', 'ASC']] }),
        Type.findAll({ 
          where: { category_id: categoryId },
          include: [{ 
            model: Category, 
            as: 'category',
            attributes: ['id', 'name']
          }],
          order: [['name', 'ASC']] 
        })
      ]);

      console.log(`📊 Matériaux disponibles: ${allMaterials.length}`);
      console.log(`📊 Types disponibles: ${allTypes.length}`);

      // Calcul de la pagination
      const totalPages = Math.ceil(totalBracelets / limit);
      const currentPage = parseInt(page);

      // Obtenir le nombre d'articles dans le panier
      const cartItemCount = 0; // Valeur par défaut

      // Préparation des données pour la vue
      const viewData = {
        // **CORRECTION** : Utiliser 'bracelets' au lieu de 'jewels' pour correspondre au template
        bracelets: formattedBracelets,
        
        // Pagination
        pagination: {
          currentPage,
          totalPages,
          totalBracelets,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
          nextPage: currentPage + 1,
          prevPage: currentPage - 1
        },
        
        // Alternative pour la pagination (format du template bracelets)
        currentPage,
        totalPages,
        
        // Filtres et tri
        filters: {
          matiere: Array.isArray(matiere) ? matiere : (matiere ? [matiere] : []),
          type: Array.isArray(type) ? type : (type ? [type] : []),
          prix: Array.isArray(prix) ? prix : (prix ? [prix] : []),
          sort,
          sortBy: sort // Alias pour compatibilité
        },
        
        // Données pour les filtres
        materials: allMaterials,
        types: allTypes,
        styles: allTypes.map(t => t.name), // Pour compatibilité avec le template
        
        // Données supplémentaires demandées par le template
        sizes: [], // À remplir si nécessaire
        carats: [], // À remplir si nécessaire
        
        // Métadonnées
        title: 'Bracelets - Éclat Doré',
        pageTitle: 'Nos Bracelets',
        metaDescription: 'Découvrez notre collection de bracelets élégants',
        
        // Utilisateur et panier
        user: req.user || null,
        cartItemCount
      };

      console.log('📊 Données envoyées à la vue:', {
        bracelets: viewData.bracelets.length,
        totalPages: viewData.totalPages,
        currentPage: viewData.currentPage,
        materialsCount: viewData.materials.length,
        typesCount: viewData.types.length
      });

      console.log('🎉 === FIN showBracelets ===');
      
      // Rendre la vue bracelets
      res.render('bracelets', viewData);

    } catch (error) {
      console.error('❌ Erreur dans showBracelets:', error);
      console.error('📍 Stack trace:', error.stack);
      
      return res.status(500).render('error', {
        title: 'Erreur serveur',
        message: 'Une erreur est survenue lors de l\'affichage des bracelets.',
        statusCode: 500,
        user: req.user || null
      });
    }
  }
};