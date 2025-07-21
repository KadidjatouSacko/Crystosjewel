import { Jewel, Category } from '../models/associations.js';
import { Type } from '../models/TypeModel.js';
import { Material } from '../models/MaterialModel.js';
import Sequelize from 'sequelize';

const { Op } = Sequelize;

export const baguesControlleur = {
  async showRings(req, res) {
        try {
            console.log('🔍 Affichage des bagues avec système complet');
            
            // Paramètres de filtrage et pagination
            const { 
                page = 1, 
                limit = 12, 
                matiere, 
                type, 
                prix, 
                sort = 'newest' 
            } = req.query;
            
            const offset = (parseInt(page) - 1) * parseInt(limit);
            
            // Construction des conditions WHERE
            let whereConditions = { category_id: 1 }; // ID catégorie bagues
            
            // Filtre par matériau
            if (matiere) {
                const materiaux = Array.isArray(matiere) ? matiere : [matiere];
                whereConditions.material_id = { [Op.in]: materiaux };
            }
            
            // Filtre par type
            if (type) {
                const types = Array.isArray(type) ? type : [type];
                whereConditions.type_id = { [Op.in]: types };
            }
            
            // Filtre par prix
            if (prix) {
                const priceRanges = Array.isArray(prix) ? prix : [prix];
                const priceConditions = [];
                
                priceRanges.forEach(range => {
                    switch(range) {
                        case '0-100':
                            priceConditions.push({ price_ttc: { [Op.between]: [0, 100] } });
                            break;
                        case '100-200':
                            priceConditions.push({ price_ttc: { [Op.between]: [100, 200] } });
                            break;
                        case '200-500':
                            priceConditions.push({ price_ttc: { [Op.between]: [200, 500] } });
                            break;
                        case '500+':
                            priceConditions.push({ price_ttc: { [Op.gte]: 500 } });
                            break;
                    }
                });
                
                if (priceConditions.length > 0) {
                    whereConditions[Op.or] = priceConditions;
                }
            }
            
            // Construction de l'ordre de tri
            let orderClause;
            switch(sort) {
                case 'price_asc':
                    orderClause = [['price_ttc', 'ASC']];
                    break;
                case 'price_desc':
                    orderClause = [['price_ttc', 'DESC']];
                    break;
                case 'popularity':
                    orderClause = [
                        ['sales_count', 'DESC'],
                        ['favorites_count', 'DESC'],
                        ['views_count', 'DESC']
                    ];
                    break;
                case 'newest':
                default:
                    orderClause = [['created_at', 'DESC']];
                    break;
            }
            
            // Récupération des bijoux avec relations
            const { count, rows: rings } = await Jewel.findAndCountAll({
                where: whereConditions,
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
                    },
                    {
                        model: Material,
                        as: 'material',
                        attributes: ['id', 'name'],
                        required: false
                    }
                ],
                order: orderClause,
                limit: parseInt(limit),
                offset: offset,
                distinct: true
            });
            
            console.log(`✅ ${rings.length} bagues récupérées sur ${count} total`);
            
            // Formatage des bijoux avec badges et prix
            const formattedRings = rings.map(ring => {
                const ringData = ring.toJSON();
                
                // Calcul du badge automatique
                const badgeInfo = calculateJewelBadge(ringData);
                
                // Formatage des prix
                const pricingInfo = formatJewelPricing(ringData);
                
                return {
                    ...ringData,
                    ...badgeInfo,
                    ...pricingInfo,
                    image: ringData.image || 'no-image.jpg'
                };
            });
            
            // Récupération des données pour les filtres
            const [allMaterials, allTypes] = await Promise.all([
                Material.findAll({ 
                    order: [['name', 'ASC']] 
                }),
                Type.findAll({ 
                    where: { category_id: 1 },
                    order: [['name', 'ASC']] 
                })
            ]);
            
            // Calcul de la pagination
            const totalPages = Math.ceil(count / parseInt(limit));
            const currentPage = parseInt(page);
            
            // Données pour la vue
            const viewData = {
                title: 'Bagues - Éclat Doré',
                pageTitle: 'Nos Bagues',
                jewels: formattedRings,
                
                // Pagination
                pagination: {
                    currentPage,
                    totalPages,
                    totalJewels: count,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1,
                    nextPage: currentPage < totalPages ? currentPage + 1 : currentPage,
                    prevPage: currentPage > 1 ? currentPage - 1 : currentPage
                },
                
                // Filtres
                filters: {
                    matiere: Array.isArray(matiere) ? matiere : (matiere ? [matiere] : []),
                    type: Array.isArray(type) ? type : (type ? [type] : []),
                    prix: Array.isArray(prix) ? prix : (prix ? [prix] : []),
                    sort
                },
                
                // Données pour les filtres
                materials: allMaterials || [],
                types: allTypes || [],
                
                // Utilisateur
                user: req.session?.user || null,
                isAuthenticated: !!req.session?.user,
                cartItemCount: 0, // À implémenter selon votre système
                
                // Messages
                error: null,
                success: null
            };
            
            res.render('bracelets', viewData);
            
        } catch (error) {
            console.error('❌ Erreur dans showBracelets:', error);
            
            res.status(500).render('bracelets', {
                title: 'Nos Bracelets - Erreur',
                pageTitle: 'Nos Bracelets',
                jewels: [],
                bracelets: [],
                pagination: { currentPage: 1, totalPages: 1, totalJewels: 0, hasNextPage: false, hasPrevPage: false },
                filters: { matiere: [], type: [], prix: [], sort: 'newest' },
                materials: [],
                types: [],
                user: req.session?.user || null,
                isAuthenticated: false,
                cartItemCount: 0,
                error: `Erreur lors du chargement des bracelets: ${error.message}`,
                success: null
            });
        }
    },

    

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