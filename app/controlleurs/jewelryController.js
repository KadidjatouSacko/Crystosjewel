// controlleurs/jewelryController.js - Version améliorée pour votre schéma DB
import { sequelize } from '../models/sequelize-client.js';


export const jewelryController = {

    // ==========================================
    // FONCTIONS UTILITAIRES POUR LES FAVORIS
    // ==========================================
    async checkIfFavorite(jewelId, userId) {
        try {
            // Adapter selon votre modèle de favoris
            const result = await sequelize.query(`
                SELECT COUNT(*) as count 
                FROM favorites 
                WHERE jewel_id = :jewelId AND user_id = :userId
            `, {
                type: QueryTypes.SELECT,
                replacements: { jewelId, userId }
            });
            
            return result[0].count > 0;
        } catch (error) {
            console.error('Erreur checkIfFavorite:', error);
            return false;
        }
    },
    
   // ==========================================
    // PAGE PRINCIPALE DU DASHBOARD
    // ==========================================
    async dashboard(req, res) {
        try {
            console.log('🎯 Chargement du dashboard bijoux dynamique');
            
            const lowStockThreshold = parseInt(req.query.stockThreshold) || 3;
            
            // Récupération des statistiques
            const stats = await this.getEnhancedStats(lowStockThreshold);
            
            // Pagination
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;
            const offset = (page - 1) * limit;
            
            // Récupération des bijoux avec filtres
            const { jewels, totalJewels } = await this.getJewelsWithFilters(req.query, limit, offset, lowStockThreshold);
            
            // Données pour les filtres
            const [categories, materials, types] = await Promise.all([
                this.getCategoriesWithCount(),
                this.getMaterialsWithCount(),
                this.getTypesWithCount()
            ]);
            
            // Données spéciales pour la sidebar
            const [lowStockJewels, mostViewedJewels, mostSoldJewels] = await Promise.all([
                this.getLowStockJewels(lowStockThreshold),
                this.getMostViewedJewels(),
                this.getMostSoldJewels()
            ]);
            
            const totalPages = Math.ceil(totalJewels / limit);

            res.render('admin/jewelry-dashboard', {
                title: 'Dashboard Bijoux - Gestion Avancée',
                stats,
                jewels,
                categories,
                materials,
                types,
                lowStockJewels,
                mostViewedJewels,
                mostSoldJewels,
                lowStockThreshold,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: totalJewels,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: req.query,
                user: req.session?.user || null
            });
        } catch (error) {
            console.error('Erreur dashboard:', error);
            res.status(500).render('error', { 
                statusCode: 500,
                message: 'Erreur lors du chargement du dashboard',
                title: 'Erreur',
                user: req.session?.user || null
            });
        }
    },


     // ==========================================
    // STATISTIQUES ENRICHIES
    // ==========================================
    async getEnhancedStats(lowStockThreshold = 3) {
        try {
            // Utilisation de votre modèle Jewel existant
            const jewelStats = await Jewel.findAll({
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_jewels'],
                    [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('stock')), 0), 'total_stock'],
                    [sequelize.fn('COUNT', sequelize.literal(`CASE WHEN stock <= ${lowStockThreshold} AND stock > 0 THEN 1 END`)), 'low_stock'],
                    [sequelize.fn('COUNT', sequelize.literal('CASE WHEN stock = 0 THEN 1 END')), 'out_of_stock'],
                    [sequelize.fn('COALESCE', sequelize.fn('AVG', sequelize.col('price_ttc')), 0), 'avg_price'],
                    [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('views_count')), 0), 'total_views'],
                    [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('favorites_count')), 0), 'total_favorites'],
                    [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('cart_additions')), 0), 'total_cart_additions']
                ],
                raw: true
            });

            // Statistiques des commandes (adapter selon votre modèle de commandes)
            const orderStats = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_orders,
                    COALESCE(SUM(total_amount), 0) as total_revenue,
                    COALESCE(AVG(total_amount), 0) as avg_order_value,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_orders
                FROM orders
                WHERE status != 'cancelled' OR status IS NULL
            `, { type: QueryTypes.SELECT });

            // Catégorie la plus populaire
            const topCategory = await Category.findOne({
                attributes: [
                    'name',
                    [sequelize.fn('COUNT', sequelize.col('Jewels.id')), 'jewel_count']
                ],
                include: [{
                    model: Jewel,
                    attributes: [],
                    required: false
                }],
                group: ['Category.id', 'Category.name'],
                order: [[sequelize.literal('jewel_count'), 'DESC']],
                raw: true
            });

            const jewelStatsData = jewelStats[0] || {};
            const orderStatsData = orderStats[0] || {};
            const topCategoryData = topCategory || { name: 'Aucune', jewel_count: 0 };

            return {
                totalJewels: parseInt(jewelStatsData.total_jewels) || 0,
                totalStock: parseInt(jewelStatsData.total_stock) || 0,
                lowStock: parseInt(jewelStatsData.low_stock) || 0,
                outOfStock: parseInt(jewelStatsData.out_of_stock) || 0,
                avgPrice: parseFloat(jewelStatsData.avg_price) || 0,
                totalViews: parseInt(jewelStatsData.total_views) || 0,
                totalFavorites: parseInt(jewelStatsData.total_favorites) || 0,
                totalCartAdditions: parseInt(jewelStatsData.total_cart_additions) || 0,
                totalOrders: parseInt(orderStatsData.total_orders) || 0,
                totalRevenue: parseFloat(orderStatsData.total_revenue) || 0,
                avgOrderValue: parseFloat(orderStatsData.avg_order_value) || 0,
                todayOrders: parseInt(orderStatsData.today_orders) || 0,
                topCategory: topCategoryData
            };
        } catch (error) {
            console.error('Erreur getEnhancedStats:', error);
            return {
                totalJewels: 0,
                totalStock: 0,
                lowStock: 0,
                outOfStock: 0,
                avgPrice: 0,
                totalViews: 0,
                totalFavorites: 0,
                totalCartAdditions: 0,
                totalOrders: 0,
                totalRevenue: 0,
                avgOrderValue: 0,
                todayOrders: 0,
                topCategory: { name: 'Aucune', jewel_count: 0 }
            };
        }
    },


// ==========================================
// NOUVELLES MÉTHODES POUR LE CONTRÔLEUR
// ==========================================

// Ajoutez ces méthodes à votre jewelControlleur.js :

// ==========================================
    // RÉCUPÉRATION DES BIJOUX AVEC FILTRES
    // ==========================================
    async getJewelsWithFilters(filters, limit, offset, lowStockThreshold = 3) {
        try {
            let whereConditions = {};
            let includeConditions = [];
            
            // Filtres de base
            if (filters.category && filters.category !== 'all') {
                if (!isNaN(parseInt(filters.category))) {
                    whereConditions.category_id = parseInt(filters.category);
                } else {
                    // Recherche par nom de catégorie
                    includeConditions.push({
                        model: Category,
                        where: { name: { [Op.iLike]: `%${filters.category}%` } },
                        required: true
                    });
                }
            }
            
            if (filters.material && filters.material !== 'all') {
                whereConditions.matiere = { [Op.iLike]: `%${filters.material}%` };
            }
            
            if (filters.search) {
                whereConditions[Op.or] = [
                    { name: { [Op.iLike]: `%${filters.search}%` } },
                    { description: { [Op.iLike]: `%${filters.search}%` } }
                ];
            }
            
            // Filtres de stock avec seuil configurable
            if (filters.stock === 'low') {
                whereConditions.stock = { [Op.lte]: lowStockThreshold, [Op.gt]: 0 };
            } else if (filters.stock === 'out') {
                whereConditions.stock = 0;
            } else if (filters.stock === 'available') {
                whereConditions.stock = { [Op.gt]: 0 };
            }
            
            if (filters.sale === 'true') {
                whereConditions.discount_percentage = { [Op.gt]: 0 };
            }
            
            // Options de tri
            const sortOptions = {
                'newest': [['created_at', 'DESC']],
                'oldest': [['created_at', 'ASC']],
                'price_asc': [['price_ttc', 'ASC']],
                'price_desc': [['price_ttc', 'DESC']],
                'popular': [[sequelize.literal('(COALESCE(views_count, 0) + COALESCE(favorites_count, 0) * 2)'), 'DESC']],
                'most_sold': [[sequelize.literal('COALESCE(sales_count, 0)'), 'DESC']],
                'most_viewed': [[sequelize.literal('COALESCE(views_count, 0)'), 'DESC']],
                'stock_asc': [['stock', 'ASC']],
                'stock_desc': [['stock', 'DESC']],
                'name_asc': [['name', 'ASC']],
                'name_desc': [['name', 'DESC']]
            };
            
            const orderBy = sortOptions[filters.sort] || sortOptions.newest;
            
            // Ajouter la catégorie dans les includes si pas déjà présente
            if (!includeConditions.some(include => include.model === Category)) {
                includeConditions.push({
                    model: Category,
                    required: false,
                    attributes: ['id', 'name']
                });
            }
            
            // Requête avec Sequelize
            const result = await Jewel.findAndCountAll({
                where: whereConditions,
                include: includeConditions,
                order: orderBy,
                limit: limit,
                offset: offset,
                attributes: {
                    include: [
                        [
                            sequelize.literal(`
                                CASE 
                                    WHEN discount_percentage > 0 
                                    THEN price_ttc * (1 - discount_percentage / 100) 
                                    ELSE price_ttc 
                                END
                            `),
                            'final_price'
                        ],
                        [
                            sequelize.literal('discount_percentage > 0'),
                            'is_on_sale'
                        ],
                        [
                            sequelize.literal('created_at > NOW() - INTERVAL \'7 days\''),
                            'is_new'
                        ]
                    ]
                },
                distinct: true
            });
            
            // Formatage des résultats
            const jewels = result.rows.map(jewel => {
                const jewelData = jewel.toJSON();
                return {
                    ...jewelData,
                    category_name: jewelData.Category?.name || 'Non catégorisé',
                    views_count: jewelData.views_count || 0,
                    favorites_count: jewelData.favorites_count || 0,
                    cart_additions: jewelData.cart_additions || 0,
                    sales_count: jewelData.sales_count || 0
                };
            });
            
            return {
                jewels,
                totalJewels: result.count
            };
        } catch (error) {
            console.error('Erreur getJewelsWithFilters:', error);
            return { jewels: [], totalJewels: 0 };
        }
    },


async getJewelSizes(jewelId) {
    try {
        const sizes = await sequelize.query(`
            SELECT 
                s.name,
                js.stock
            FROM jewel_size js
            JOIN size s ON js.size_id = s.id
            WHERE js.jewel_id = :jewelId
            ORDER BY s.name
        `, {
            type: QueryTypes.SELECT,
            replacements: { jewelId }
        });
        
        return sizes;
    } catch (error) {
        console.error('Erreur getJewelSizes:', error);
        return [];
    }
},

    // ==========================================
    // DONNÉES POUR LES FILTRES
    // ==========================================
    async getCategoriesWithCount() {
        try {
            const categories = await Category.findAll({
                attributes: [
                    'id',
                    'name',
                    [sequelize.fn('COUNT', sequelize.col('Jewels.id')), 'jewels_count']
                ],
                include: [{
                    model: Jewel,
                    attributes: [],
                    required: false
                }],
                group: ['Category.id', 'Category.name'],
                order: [['name', 'ASC']]
            });
            
            return categories.map(cat => cat.toJSON());
        } catch (error) {
            console.error('Erreur getCategoriesWithCount:', error);
            return [];
        }
    },

    async getMaterialsWithCount() {
        try {
            const materials = await Jewel.findAll({
                attributes: [
                    ['matiere', 'name'],
                    [sequelize.fn('COUNT', '*'), 'count']
                ],
                where: {
                    matiere: { [Op.not]: null, [Op.ne]: '' }
                },
                group: ['matiere'],
                order: [[sequelize.literal('count'), 'DESC'], ['matiere', 'ASC']],
                raw: true
            });
            
            return materials;
        } catch (error) {
            console.error('Erreur getMaterialsWithCount:', error);
            return [];
        }
    },

    async getTypesWithCount() {
        try {
            // Adapter selon votre modèle Type
            const types = await sequelize.query(`
                SELECT 
                    t.id,
                    t.name,
                    COUNT(j.id) as jewels_count
                FROM type t
                LEFT JOIN jewel j ON t.id = j.type_id
                GROUP BY t.id, t.name
                ORDER BY t.name ASC
            `, { type: QueryTypes.SELECT });
            
            return types;
        } catch (error) {
            console.error('Erreur getTypesWithCount:', error);
            return [];
        }
    },

async getLowStockJewelsEnhanced(threshold = 3) {
    try {
        const lowStockJewels = await sequelize.query(`
            SELECT 
                j.id,
                j.name,
                j.stock,
                j.price_ttc,
                c.name as category_name,
                ARRAY_AGG(
                    CASE 
                        WHEN js.stock <= :threshold AND js.stock >= 0 
                        THEN s.name 
                        ELSE NULL 
                    END
                ) FILTER (WHERE js.stock <= :threshold AND js.stock >= 0) as critical_sizes
            FROM jewel j
            LEFT JOIN category c ON j.category_id = c.id
            LEFT JOIN jewel_size js ON j.id = js.jewel_id
            LEFT JOIN size s ON js.size_id = s.id
            WHERE j.stock <= :threshold AND j.stock > 0
            GROUP BY j.id, j.name, j.stock, j.price_ttc, c.name
            ORDER BY j.stock ASC, j.name ASC
        `, {
            type: QueryTypes.SELECT,
            replacements: { threshold }
        });
        
        return lowStockJewels;
    } catch (error) {
        console.error('Erreur getLowStockJewelsEnhanced:', error);
        return [];
    }
},

/**
     * Fonction utilitaire pour calculer automatiquement les badges
     * Peut être appelée depuis d'autres parties de l'application
     */
    async updateJewelBadges() {
        try {
            console.log('🔄 Mise à jour automatique des badges...');
            
            const allJewels = await Jewel.findAll({
                attributes: ['id', 'created_at', 'discount_percentage', 'discount_start_date', 'discount_end_date', 'stock', 'sales_count', 'favorites_count', 'views_count']
            });
            
            for (const jewel of allJewels) {
                const badgeInfo = calculateJewelBadge(jewel.toJSON());
                
                // Vous pouvez stocker le badge en base si nécessaire
                // await jewel.update({ 
                //     badge: badgeInfo?.badge || null,
                //     badge_class: badgeInfo?.badgeClass || null 
                // });
            }
            
            console.log(`✅ ${allJewels.length} bijoux traités pour les badges`);
            
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour des badges:', error);
        }
    }, 

async getMostViewedJewelsEnhanced() {
    try {
        const mostViewed = await sequelize.query(`
            SELECT 
                j.id,
                j.name,
                j.price_ttc,
                j.views_count as total_views,
                COUNT(jv.id) FILTER (WHERE jv.viewed_at > NOW() - INTERVAL '7 days') as recent_views
            FROM jewel j
            LEFT JOIN jewel_view jv ON j.id = jv.jewel_id
            WHERE j.views_count > 0
            GROUP BY j.id, j.name, j.price_ttc, j.views_count
            ORDER BY j.views_count DESC
            LIMIT 10
        `, { type: QueryTypes.SELECT });
        
        return mostViewed;
    } catch (error) {
        console.error('Erreur getMostViewedJewelsEnhanced:', error);
        return [];
    }
},

async getMostSoldJewelsEnhanced() {
    try {
        const mostSold = await sequelize.query(`
            SELECT 
                j.id,
                j.name,
                j.price_ttc,
                COALESCE(j.sales_count, 0) as total_sold,
                COUNT(oi.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days') as recent_sold,
                SUM(oi.price * oi.quantity) as total_revenue
            FROM jewel j
            LEFT JOIN order_item oi ON j.id = oi.jewel_id
            LEFT JOIN "order" o ON oi.order_id = o.id
            WHERE o.status = 'completed' OR o.status IS NULL
            GROUP BY j.id, j.name, j.price_ttc, j.sales_count
            HAVING COALESCE(j.sales_count, 0) > 0
            ORDER BY j.sales_count DESC
            LIMIT 10
        `, { type: QueryTypes.SELECT });
        
        return mostSold;
    } catch (error) {
        console.error('Erreur getMostSoldJewelsEnhanced:', error);
        return [];
    }
},

// ==========================================
    // MÉTRIQUES TEMPS RÉEL
    // ==========================================
    async getRealtimeStats(req, res) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const thisWeek = new Date();
            thisWeek.setDate(thisWeek.getDate() - 7);
            
            const lowStockThreshold = parseInt(req.query.threshold) || 3;
            
            // Statistiques du jour (simulation temps réel)
            const dailyViews = Math.floor(Math.random() * 200) + 100;
            const weeklyViews = Math.floor(Math.random() * 1000) + 500;
            const todayFavorites = Math.floor(Math.random() * 50) + 10;
            const todayCart = Math.floor(Math.random() * 30) + 5;
            
            // Stocks critiques réels
            const criticalStock = await Jewel.count({
                where: {
                    stock: { [Op.lte]: lowStockThreshold, [Op.gt]: 0 }
                }
            });
            
            const outOfStock = await Jewel.count({
                where: { stock: 0 }
            });
            
            const totalStockResult = await Jewel.findAll({
                attributes: [[sequelize.fn('SUM', sequelize.col('stock')), 'total']],
                raw: true
            });
            
            const totalStock = totalStockResult[0]?.total || 0;
            
            // Métriques par bijou (top 20)
            const jewelMetrics = await Jewel.findAll({
                attributes: [
                    ['id', 'jewelId'],
                    [sequelize.literal('COALESCE(views_count, 0)'), 'views'],
                    [sequelize.literal('COALESCE(favorites_count, 0)'), 'favorites'],
                    [sequelize.literal('COALESCE(cart_additions, 0)'), 'cartAdditions'],
                    [sequelize.literal('COALESCE(sales_count, 0)'), 'sales']
                ],
                where: {
                    views_count: { [Op.gt]: 0 }
                },
                order: [[sequelize.literal('COALESCE(views_count, 0)'), 'DESC']],
                limit: 20,
                raw: true
            });
            
            res.json({
                success: true,
                dailyViews,
                weeklyViews,
                todayViews: dailyViews,
                todayFavorites,
                todayCart,
                criticalStock,
                outOfStock,
                totalStock,
                jewelMetrics
            });
        } catch (error) {
            console.error('Erreur getRealtimeStats:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du chargement des statistiques'
            });
        }
    },


// ==========================================
    // SUIVI DES VUES
    // ==========================================
    async trackView(req, res) {
        try {
            const { id } = req.params;
            const userAgent = req.get('User-Agent') || '';
            const sessionId = req.sessionID;
            
            // Éviter les bots et les rechargements
            if (userAgent.includes('bot') || userAgent.includes('crawler')) {
                return res.json({ success: true, counted: false });
            }
            
            // Vérifier si déjà vu dans cette session
            const sessionKey = `viewed_${id}`;
            if (req.session && req.session[sessionKey]) {
                return res.json({ success: true, counted: false });
            }
            
            const jewel = await Jewel.findByPk(id);
            if (!jewel) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            // Incrémenter le compteur de vues
            await jewel.update({
                views_count: (jewel.views_count || 0) + 1
            });
            
            // Marquer comme vu dans la session
            if (req.session) {
                req.session[sessionKey] = true;
            }
            
            res.json({ success: true, counted: true });
        } catch (error) {
            console.error('Erreur trackView:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du suivi des vues'
            });
        }
    },

    // ==========================================
    // SUIVI DES FAVORIS
    // ==========================================
    async trackFavorite(req, res) {
        try {
            const { id } = req.params;
            const { action } = req.body;
            
            if (!req.session?.user?.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Connexion requise'
                });
            }
            
            const jewel = await Jewel.findByPk(id);
            if (!jewel) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            if (action === 'add') {
                await jewel.update({
                    favorites_count: (jewel.favorites_count || 0) + 1
                });
            } else if (action === 'remove') {
                await jewel.update({
                    favorites_count: Math.max(0, (jewel.favorites_count || 0) - 1)
                });
            }
            
            res.json({ success: true });
        } catch (error) {
            console.error('Erreur trackFavorite:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du suivi des favoris'
            });
        }
    },


     // ==========================================
    // SUIVI DES AJOUTS AU PANIER
    // ==========================================
    async trackCartAddition(req, res) {
        try {
            const { id } = req.params;
            const { quantity = 1 } = req.body;
            
            const jewel = await Jewel.findByPk(id);
            if (!jewel) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            await jewel.update({
                cart_additions: (jewel.cart_additions || 0) + parseInt(quantity)
            });
            
            res.json({ success: true });
        } catch (error) {
            console.error('Erreur trackCartAddition:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du suivi des ajouts panier'
            });
        }
    },

    // ==========================================
    // GESTION DES STOCKS PAR TAILLE
    // ==========================================
    async updateSizeStock(req, res) {
        try {
            const { id } = req.params;
            const { sizeName, stock } = req.body;
            
            // Cette fonctionnalité nécessiterait une table jewel_sizes
            // Pour l'instant, retourner une réponse simple
            res.json({
                success: true,
                message: 'Fonctionnalité stock par taille à implémenter'
            });
        } catch (error) {
            console.error('Erreur updateSizeStock:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du stock par taille'
            });
        }
    },

// Méthodes pour les routes par slug
async showJewelDetailsBySlug(req, res) {
    try {
        const { slug } = req.params;
        
        const jewel = await sequelize.query(`
            SELECT 
                j.*,
                c.name as category_name,
                t.name as type_name
            FROM jewel j
            LEFT JOIN category c ON j.category_id = c.id
            LEFT JOIN type t ON j.type_id = t.id
            WHERE j.slug = :slug
        `, {
            type: QueryTypes.SELECT,
            replacements: { slug }
        });

        if (!jewel.length) {
            return res.status(404).render('404', { 
                title: 'Bijou non trouvé',
                message: 'Ce bijou n\'existe pas ou a été supprimé.'
            });
        }

        // Enregistrer la vue (sans compter les rechargements de page)
        const sessionKey = `viewed_${jewel[0].id}`;
        if (req.session && !req.session[sessionKey]) {
            await this.trackView({ params: { id: jewel[0].id }, ...req }, res, false);
            req.session[sessionKey] = true;
        }

        // Récupérer les bijoux similaires
        const similarJewels = await sequelize.query(`
            SELECT j.*, c.name as category_name
            FROM jewel j
            LEFT JOIN category c ON j.category_id = c.id
            WHERE j.id != :jewelId 
            AND j.category_id = :categoryId
            AND j.stock > 0
            ORDER BY j.views_count DESC
            LIMIT 4
        `, {
            type: QueryTypes.SELECT,
            replacements: { 
                jewelId: jewel[0].id,
                categoryId: jewel[0].category_id
            }
        });

        res.render('jewelry/details', {
            title: jewel[0].name,
            jewel: jewel[0],
            similarJewels,
            currentUser: req.session?.user || null
        });

    } catch (error) {
        console.error('Erreur showJewelDetailsBySlug:', error);
        res.status(500).render('500', {
            title: 'Erreur serveur',
            message: 'Une erreur est survenue lors du chargement du bijou.'
        });
    }
},

async deleteJewelBySlug(req, res) {
    try {
        const { slug } = req.params;
        
        const result = await sequelize.query(`
            DELETE FROM jewel WHERE slug = :slug
            RETURNING id, name
        `, {
            type: QueryTypes.DELETE,
            replacements: { slug }
        });
        
        if (!result.length) {
            return res.status(404).json({ 
                success: false, 
                message: 'Bijou non trouvé' 
            });
        }

        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            res.json({ 
                success: true, 
                message: 'Bijou supprimé avec succès' 
            });
        } else {
            req.flash('success', 'Bijou supprimé avec succès');
            res.redirect('/admin/bijoux');
        }

    } catch (error) {
        console.error('Erreur deleteJewelBySlug:', error);
        
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de la suppression' 
            });
        } else {
            req.flash('error', 'Erreur lors de la suppression');
            res.redirect('/admin/bijoux');
        }
    }
},

async editJewelBySlug(req, res) {
    try {
        const { slug } = req.params;
        
        const jewel = await sequelize.query(`
            SELECT 
                j.*,
                c.name as category_name,
                t.name as type_name
            FROM jewel j
            LEFT JOIN category c ON j.category_id = c.id
            LEFT JOIN type t ON j.type_id = t.id
            WHERE j.slug = :slug
        `, {
            type: QueryTypes.SELECT,
            replacements: { slug }
        });

        if (!jewel.length) {
            req.flash('error', 'Bijou non trouvé');
            return res.redirect('/admin/bijoux');
        }

        const categories = await sequelize.query(`
            SELECT id, name FROM category ORDER BY name ASC
        `, { type: QueryTypes.SELECT });

        const types = await sequelize.query(`
            SELECT id, name FROM type ORDER BY name ASC
        `, { type: QueryTypes.SELECT });

        const sizes = await sequelize.query(`
            SELECT 
                s.id,
                s.name,
                js.stock
            FROM size s
            LEFT JOIN jewel_size js ON s.id = js.size_id AND js.jewel_id = :jewelId
            ORDER BY s.name ASC
        `, {
            type: QueryTypes.SELECT,
            replacements: { jewelId: jewel[0].id }
        });

        res.render('admin/jewelry/edit', {
            title: `Modifier ${jewel[0].name}`,
            jewel: jewel[0],
            categories,
            types,
            sizes
        });

    } catch (error) {
        console.error('Erreur editJewelBySlug:', error);
        req.flash('error', 'Erreur lors du chargement du bijou');
        res.redirect('/admin/bijoux');
    }
},

async updateJewelBySlug(req, res) {
    try {
        const { slug } = req.params;
        const updateData = req.body;
        
        // Vérifier que le bijou existe
        const existingJewel = await sequelize.query(`
            SELECT id, name FROM jewel WHERE slug = :slug
        `, {
            type: QueryTypes.SELECT,
            replacements: { slug }
        });
        
        if (!existingJewel.length) {
            req.flash('error', 'Bijou non trouvé');
            return res.redirect('/admin/bijoux');
        }

        const jewelId = existingJewel[0].id;

        // Générer un nouveau slug si le nom a changé
        let newSlug = slug;
        if (updateData.name && updateData.name !== existingJewel[0].name) {
            newSlug = updateData.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }

        // Construire la requête de mise à jour
        const updateFields = [];
        const replacements = { jewelId };

        if (updateData.name) {
            updateFields.push('name = :name');
            replacements.name = updateData.name;
        }
        if (updateData.description) {
            updateFields.push('description = :description');
            replacements.description = updateData.description;
        }
        if (updateData.price_ttc) {
            updateFields.push('price_ttc = :price_ttc');
            replacements.price_ttc = parseFloat(updateData.price_ttc);
        }
        if (updateData.stock !== undefined) {
            updateFields.push('stock = :stock');
            replacements.stock = parseInt(updateData.stock);
        }
        if (updateData.category_id) {
            updateFields.push('category_id = :category_id');
            replacements.category_id = parseInt(updateData.category_id);
        }
        if (updateData.type_id) {
            updateFields.push('type_id = :type_id');
            replacements.type_id = parseInt(updateData.type_id);
        }
        if (updateData.matiere) {
            updateFields.push('matiere = :matiere');
            replacements.matiere = updateData.matiere;
        }
        if (updateData.carat) {
            updateFields.push('carat = :carat');
            replacements.carat = parseFloat(updateData.carat);
        }
        if (newSlug !== slug) {
            updateFields.push('slug = :slug');
            replacements.slug = newSlug;
        }

        if (updateFields.length > 0) {
            await sequelize.query(`
                UPDATE jewel 
                SET ${updateFields.join(', ')}, updated_at = NOW()
                WHERE id = :jewelId
            `, {
                type: QueryTypes.UPDATE,
                replacements
            });
        }

        // Mettre à jour les stocks par taille si fournis
        if (updateData.sizeStocks) {
            const sizeStocks = JSON.parse(updateData.sizeStocks);
            for (const sizeStock of sizeStocks) {
                await sequelize.query(`
                    INSERT INTO jewel_size (jewel_id, size_id, stock)
                    VALUES (:jewelId, :sizeId, :stock)
                    ON CONFLICT (jewel_id, size_id)
                    DO UPDATE SET stock = :stock
                `, {
                    type: QueryTypes.UPSERT,
                    replacements: {
                        jewelId,
                        sizeId: sizeStock.sizeId,
                        stock: sizeStock.stock
                    }
                });
            }
        }

        req.flash('success', 'Bijou mis à jour avec succès');
        res.redirect(`/admin/bijoux/${newSlug}/edit`);

    } catch (error) {
        console.error('Erreur updateJewelBySlug:', error);
        req.flash('error', 'Erreur lors de la mise à jour');
        res.redirect(`/admin/bijoux/${req.params.slug}/edit`);
    }
},

    // ==========================================
    // GESTION DES STOCKS
    // ==========================================
    async updateStock(req, res) {
        try {
            const { id } = req.params;
            const { stock, action } = req.body;
            
            if (!id || stock === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'ID et stock requis'
                });
            }
            
            const jewel = await Jewel.findByPk(id);
            if (!jewel) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            let newStock = parseInt(stock);
            
            switch (action) {
                case 'add':
                    newStock = (jewel.stock || 0) + newStock;
                    break;
                case 'subtract':
                    newStock = Math.max(0, (jewel.stock || 0) - newStock);
                    break;
                case 'set':
                default:
                    // newStock reste tel quel
                    break;
            }
            
            await jewel.update({ stock: newStock });
            
            res.json({
                success: true,
                message: 'Stock mis à jour avec succès',
                jewel: {
                    id: jewel.id,
                    name: jewel.name,
                    stock: newStock
                }
            });
        } catch (error) {
            console.error('Erreur updateStock:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du stock'
            });
        }
    },

     // ==========================================
    // SUGGESTIONS DE RECHERCHE
    // ==========================================
    async searchSuggestions(req, res) {
        try {
            const { q } = req.query;
            
            if (!q || q.length < 2) {
                return res.json({ success: true, suggestions: [] });
            }
            
            const suggestions = await Jewel.findAll({
                where: {
                    [Op.or]: [
                        { name: { [Op.iLike]: `%${q}%` } },
                        { description: { [Op.iLike]: `%${q}%` } },
                        { matiere: { [Op.iLike]: `%${q}%` } }
                    ]
                },
                attributes: ['id', 'name', 'price_ttc', 'stock'],
                include: [{
                    model: Category,
                    attributes: ['name'],
                    required: false
                }],
                limit: 10,
                order: [['views_count', 'DESC']]
            });
            
            const formattedSuggestions = suggestions.map(jewel => ({
                id: jewel.id,
                name: jewel.name,
                category: jewel.Category?.name || 'Non catégorisé',
                price: jewel.price_ttc,
                stock: jewel.stock,
                inStock: jewel.stock > 0
            }));
            
            res.json({
                success: true,
                suggestions: formattedSuggestions
            });
        } catch (error) {
            console.error('Erreur searchSuggestions:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la recherche'
            });
        }
    },

async getJewelryStats(req, res) {
        try {
            const threshold = parseInt(req.query.threshold) || 3;
            const stats = await this.getEnhancedStats(threshold);
            
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Erreur getJewelryStats:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du chargement des statistiques'
            });
        }
    },

    // ==========================================
    // TOGGLE FAVORIS (POUR LES UTILISATEURS CONNECTÉS)
    // ==========================================
    async toggleFavorite(req, res) {
        try {
            const { jewelId } = req.params;
            
            if (!req.session?.user?.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Connexion requise'
                });
            }
            
            const jewel = await Jewel.findByPk(jewelId);
            if (!jewel) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            // Vérifier si le bijou est déjà en favoris
            // Cette logique dépend de votre modèle de favoris
            const isFavorite = await this.checkIfFavorite(jewelId, req.session.user.id);
            
            if (isFavorite) {
                // Retirer des favoris
                await this.removeFromFavorites(jewelId, req.session.user.id);
                await jewel.update({
                    favorites_count: Math.max(0, (jewel.favorites_count || 0) - 1)
                });
                
                res.json({
                    success: true,
                    action: 'removed',
                    message: 'Retiré des favoris'
                });
            } else {
                // Ajouter aux favoris
                await this.addToFavorites(jewelId, req.session.user.id);
                await jewel.update({
                    favorites_count: (jewel.favorites_count || 0) + 1
                });
                
                res.json({
                    success: true,
                    action: 'added',
                    message: 'Ajouté aux favoris'
                });
            }
        } catch (error) {
            console.error('Erreur toggleFavorite:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la gestion des favoris'
            });
        }
    },

    async removeFromFavorites(jewelId, userId) {
        try {
            await sequelize.query(`
                DELETE FROM favorites 
                WHERE jewel_id = :jewelId AND user_id = :userId
            `, {
                type: QueryTypes.DELETE,
                replacements: { jewelId, userId }
            });
        } catch (error) {
            console.error('Erreur removeFromFavorites:', error);
            throw error;
        }
    },

     // ==========================================
    // INITIALISATION DES COLONNES NÉCESSAIRES
    // ==========================================
    async initializeTrackingColumns() {
        try {
            console.log('🔧 Vérification des colonnes de suivi...');
            
            // Vérifier et ajouter les colonnes manquantes
            await sequelize.query(`
                ALTER TABLE jewel 
                ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS favorites_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS cart_additions INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS discount_start_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS discount_end_date TIMESTAMP;
            `);
            
            // Créer les index pour les performances
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_jewel_views_count ON jewel(views_count);
                CREATE INDEX IF NOT EXISTS idx_jewel_stock ON jewel(stock);
                CREATE INDEX IF NOT EXISTS idx_jewel_discount ON jewel(discount_percentage);
            `);
            
            console.log('✅ Colonnes de suivi initialisées');
            return true;
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation des colonnes:', error);
            return false;
        }
    },


    // ==========================================
    // MISE À JOUR DES COMPTEURS DE VENTES
    // ==========================================
    async updateSalesCounters() {
        try {
            console.log('📈 Mise à jour des compteurs de ventes...');
            
            // Mettre à jour les compteurs basés sur les commandes
            await sequelize.query(`
                UPDATE jewel 
                SET sales_count = COALESCE(sales_data.total_sold, 0)
                FROM (
                    SELECT 
                        oi.jewel_id,
                        SUM(oi.quantity) as total_sold
                    FROM order_item oi
                    JOIN "order" o ON oi.order_id = o.id
                    WHERE o.status IN ('completed', 'delivered', 'paid')
                    GROUP BY oi.jewel_id
                ) sales_data
                WHERE jewel.id = sales_data.jewel_id
            `);
            
            console.log('✅ Compteurs de ventes mis à jour');
            return true;
        } catch (error) {
            console.error('❌ Erreur mise à jour compteurs ventes:', error);
            return false;
        }
    },

   // ==========================================
    // FONCTION DE MAINTENANCE
    // ==========================================
    async performMaintenance() {
        try {
            console.log('🧹 Maintenance du module bijoux...');
            
            // Nettoyer les anciennes données de suivi si nécessaire
            // Recalculer les statistiques
            // Optimiser les index
            
            await this.updateSalesCounters();
            
            console.log('✅ Maintenance terminée');
            return true;
        } catch (error) {
            console.error('❌ Erreur lors de la maintenance:', error);
            return false;
        }
    },



   async addToFavorites(jewelId, userId) {
        try {
            await sequelize.query(`
                INSERT INTO favorites (jewel_id, user_id, created_at)
                VALUES (:jewelId, :userId, NOW())
                ON CONFLICT (jewel_id, user_id) DO NOTHING
            `, {
                type: QueryTypes.INSERT,
                replacements: { jewelId, userId }
            });
        } catch (error) {
            console.error('Erreur addToFavorites:', error);
            throw error;
        }
    },

// ==========================================
// MÉTHODES POUR LES TABLES DE SUIVI (À CRÉER)
// ==========================================

async createTrackingTables() {
    try {
        // Table pour les vues détaillées
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS jewel_view (
                id SERIAL PRIMARY KEY,
                jewel_id INTEGER REFERENCES jewel(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                ip_address INET,
                user_agent TEXT,
                viewed_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_jewel_view_jewel_id ON jewel_view(jewel_id);
            CREATE INDEX IF NOT EXISTS idx_jewel_view_viewed_at ON jewel_view(viewed_at);
        `);

        // Table pour les favoris
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS jewel_favorite (
                id SERIAL PRIMARY KEY,
                jewel_id INTEGER REFERENCES jewel(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(jewel_id, user_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_jewel_favorite_user_id ON jewel_favorite(user_id);
        `);

        // Table pour les stocks par taille
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS jewel_size (
                id SERIAL PRIMARY KEY,
                jewel_id INTEGER REFERENCES jewel(id) ON DELETE CASCADE,
                size_id INTEGER REFERENCES size(id) ON DELETE CASCADE,
                stock INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(jewel_id, size_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_jewel_size_jewel_id ON jewel_size(jewel_id);
        `);

        // Ajouter les colonnes de métriques si elles n'existent pas
        await sequelize.query(`
            ALTER TABLE jewel 
            ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS favorites_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS cart_additions INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
            
            CREATE INDEX IF NOT EXISTS idx_jewel_slug ON jewel(slug);
            CREATE INDEX IF NOT EXISTS idx_jewel_views_count ON jewel(views_count);
            CREATE INDEX IF NOT EXISTS idx_jewel_stock ON jewel(stock);
        `);

        // Générer les slugs pour les bijoux existants qui n'en ont pas
        await sequelize.query(`
            UPDATE jewel 
            SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
            WHERE slug IS NULL OR slug = '';
        `);

        console.log('✅ Tables de suivi créées avec succès');

    } catch (error) {
        console.error('Erreur lors de la création des tables de suivi:', error);
        throw error;
    }
},

// ==========================================
// EXPORT ET INITIALISATION
// ==========================================

// Ajoutez cette méthode d'initialisation à appeler au démarrage de votre app
async initializeEnhancedFeatures() {
    try {
        await this.createTrackingTables();
        console.log('✅ Fonctionnalités améliorées initialisées');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
    }
},
    // Récupération des statistiques CORRIGÉE
    async getStats() {
        try {
            // Statistiques bijoux - CORRECTION: utiliser la bonne table
            const jewelStatsQuery = `
                SELECT 
                    COUNT(*) as total_jewels,
                    COUNT(CASE WHEN stock <= 5 THEN 1 END) as low_stock,
                    COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock,
                    COALESCE(AVG(price_ttc), 0) as avg_price,
                    COALESCE(SUM(stock), 0) as total_stock
                FROM jewels
                WHERE stock IS NOT NULL
            `;
            
            // Statistiques commandes - CORRECTION: structure simplifiée
            const orderStatsQuery = `
                SELECT 
                    COUNT(*) as total_orders,
                    COALESCE(SUM(total), 0) as total_revenue,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_orders,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_orders,
                    COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN total ELSE 0 END), 0) as month_revenue
                FROM orders
                WHERE (status IS NULL OR status != 'cancelled') AND total IS NOT NULL
            `;
            
            // Top catégorie - CORRECTION
            const topCategoryQuery = `
                SELECT c.name, COUNT(j.id) as jewels_count
                FROM category c
                LEFT JOIN jewels j ON c.id = j.category_id
                GROUP BY c.id, c.name
                ORDER BY jewels_count DESC
                LIMIT 1
            `;
            
            const [jewelStats] = await sequelize.query(jewelStatsQuery);
            const [orderStats] = await sequelize.query(orderStatsQuery);
            const [topCategory] = await sequelize.query(topCategoryQuery);
            
            console.log('📊 Stats récupérées:', {
                jewels: jewelStats[0],
                orders: orderStats[0],
                topCat: topCategory[0]
            });
            
            // Calcul du panier moyen
            const avgOrderValue = orderStats[0]?.total_orders > 0 
                ? parseFloat(orderStats[0].total_revenue) / parseInt(orderStats[0].total_orders)
                : 0;
            
            return {
                totalJewels: parseInt(jewelStats[0]?.total_jewels) || 0,
                totalOrders: parseInt(orderStats[0]?.total_orders) || 0,
                totalRevenue: parseFloat(orderStats[0]?.total_revenue) || 0,
                lowStock: parseInt(jewelStats[0]?.low_stock) || 0,
                outOfStock: parseInt(jewelStats[0]?.out_of_stock) || 0,
                todayOrders: parseInt(orderStats[0]?.today_orders) || 0,
                monthlyRevenue: parseFloat(orderStats[0]?.month_revenue) || 0,
                totalStock: parseInt(jewelStats[0]?.total_stock) || 0,
                avgPrice: parseFloat(jewelStats[0]?.avg_price) || 0,
                topCategory: topCategory[0] || { name: 'Aucune', jewels_count: 0 },
                avgOrderValue: avgOrderValue
            };
        } catch (error) {
            console.error('Erreur stats:', error);
            return {
                totalJewels: 0,
                totalOrders: 0,
                totalRevenue: 0,
                lowStock: 0,
                outOfStock: 0,
                todayOrders: 0,
                monthlyRevenue: 0,
                totalStock: 0,
                avgPrice: 0,
                topCategory: { name: 'Aucune', jewels_count: 0 },
                avgOrderValue: 0
            };
        }
    },
    
// Récupération des bijoux avec filtres CORRIGÉE
    async getJewelsWithFilters(filters = {}, limit = 12, offset = 0) {
        try {
            let whereClause = '1=1';
            const replacements = [];
            let paramIndex = 1;
            
            // CORRECTION: Query simplifiée et compatible
            let query = `
                SELECT 
                    j.*,
                    c.name as category_name,
                    t.name as type_name,
                    CASE 
                        WHEN j.discount_percentage > 0 
                        AND (j.discount_start_date IS NULL OR j.discount_start_date <= NOW()) 
                        AND (j.discount_end_date IS NULL OR j.discount_end_date >= NOW())
                        THEN true 
                        ELSE false 
                    END as is_on_sale,
                    CASE 
                        WHEN j.discount_percentage > 0 
                        AND (j.discount_start_date IS NULL OR j.discount_start_date <= NOW()) 
                        AND (j.discount_end_date IS NULL OR j.discount_end_date >= NOW())
                        THEN j.price_ttc * (1 - COALESCE(j.discount_percentage, 0) / 100)
                        ELSE j.price_ttc 
                    END as final_price,
                    COALESCE((SELECT COUNT(*) FROM favorites f WHERE f.jewel_id = j.id), 0) as favorites_count,
                    COALESCE((SELECT COUNT(*) FROM cart ca WHERE ca.jewel_id = j.id), 0) as cart_count,
                    COALESCE((SELECT COUNT(*) FROM jewel_views jv WHERE jv.jewel_id = j.id), 0) as views_count,
                    COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.jewel_id = j.id), 0) as sales_count
                FROM jewels j
                LEFT JOIN category c ON j.category_id = c.id
                LEFT JOIN types t ON j.type_id = t.id
                WHERE
            `;
            
            // Application des filtres avec validation
            if (filters.category && filters.category !== 'all' && !isNaN(parseInt(filters.category))) {
                whereClause += ` AND j.category_id = $${paramIndex}`;
                replacements.push(parseInt(filters.category));
                paramIndex++;
            }
            
            if (filters.type && filters.type !== 'all' && !isNaN(parseInt(filters.type))) {
                whereClause += ` AND j.type_id = $${paramIndex}`;
                replacements.push(parseInt(filters.type));
                paramIndex++;
            }
            
            if (filters.material && filters.material !== 'all') {
                whereClause += ` AND j.matiere ILIKE $${paramIndex}`;
                replacements.push(`%${filters.material}%`);
                paramIndex++;
            }
            
            if (filters.minPrice && !isNaN(parseFloat(filters.minPrice))) {
                whereClause += ` AND j.price_ttc >= $${paramIndex}`;
                replacements.push(parseFloat(filters.minPrice));
                paramIndex++;
            }
            
            if (filters.maxPrice && !isNaN(parseFloat(filters.maxPrice))) {
                whereClause += ` AND j.price_ttc <= $${paramIndex}`;
                replacements.push(parseFloat(filters.maxPrice));
                paramIndex++;
            }
            
            if (filters.search && filters.search.trim() !== '') {
                whereClause += ` AND (j.name ILIKE $${paramIndex} OR j.description ILIKE $${paramIndex})`;
                replacements.push(`%${filters.search.trim()}%`);
                paramIndex++;
            }
            
            if (filters.stock === 'low') {
                whereClause += ` AND j.stock <= 5`;
            } else if (filters.stock === 'out') {
                whereClause += ` AND j.stock = 0`;
            } else if (filters.stock === 'available') {
                whereClause += ` AND j.stock > 0`;
            }
            
            if (filters.sale === 'true') {
                whereClause += ` AND j.discount_percentage > 0 
                               AND (j.discount_start_date IS NULL OR j.discount_start_date <= NOW()) 
                               AND (j.discount_end_date IS NULL OR j.discount_end_date >= NOW())`;
            }
            
            query += ` ${whereClause}`;
            
            // Tri CORRIGÉ
            const sortOptions = {
                'newest': 'j.created_at DESC NULLS LAST',
                'oldest': 'j.created_at ASC NULLS LAST',
                'price_asc': 'final_price ASC NULLS LAST',
                'price_desc': 'final_price DESC NULLS LAST',
                'popular': 'COALESCE(j.popularity_score, 0) DESC, views_count DESC',
                'most_sold': 'sales_count DESC',
                'most_viewed': 'views_count DESC',
                'stock_asc': 'COALESCE(j.stock, 0) ASC',
                'stock_desc': 'COALESCE(j.stock, 0) DESC',
                'name_asc': 'j.name ASC',
                'name_desc': 'j.name DESC'
            };
            
            const sortBy = filters.sort || 'newest';
            query += ` ORDER BY ${sortOptions[sortBy] || sortOptions.newest}`;
            
            // Compter le total
            const countQuery = `
                SELECT COUNT(*) as total
                FROM jewels j
                WHERE ${whereClause}
            `;
            
            console.log('🔍 Query count:', countQuery);
            console.log('🔍 Replacements:', replacements);
            
            const [countResult] = await sequelize.query(countQuery, { bind: replacements });
            const totalJewels = parseInt(countResult[0]?.total) || 0;
            
            // Pagination
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            replacements.push(limit, offset);
            
            console.log('🔍 Query final:', query);
            
            const [jewels] = await sequelize.query(query, { bind: replacements });
            
            console.log(`📦 ${jewels.length} bijoux récupérés sur ${totalJewels} total`);
            
            return { jewels, totalJewels };
        } catch (error) {
            console.error('Erreur getJewelsWithFilters:', error);
            return { jewels: [], totalJewels: 0 };
        }
    },
    
    // ==========================================
    // BIJOUX EN STOCK FAIBLE
    // ==========================================
    async getLowStockJewels(threshold = 3) {
        try {
            const jewels = await Jewel.findAll({
                where: {
                    stock: { [Op.lte]: threshold }
                },
                include: [{
                    model: Category,
                    required: false,
                    attributes: ['name']
                }],
                order: [['stock', 'ASC'], ['name', 'ASC']],
                limit: 20,
                attributes: {
                    include: [
                        [
                            sequelize.literal(`
                                CASE 
                                    WHEN discount_percentage > 0 
                                    THEN price_ttc * (1 - discount_percentage / 100) 
                                    ELSE price_ttc 
                                END
                            `),
                            'final_price'
                        ]
                    ]
                }
            });
            
            return jewels.map(jewel => ({
                ...jewel.toJSON(),
                category_name: jewel.Category?.name || 'Non catégorisé'
            }));
        } catch (error) {
            console.error('Erreur getLowStockJewels:', error);
            return [];
        }
    },
    
    
    // ==========================================
    // BIJOUX LES PLUS VUS
    // ==========================================
    async getMostViewedJewels() {
        try {
            const jewels = await Jewel.findAll({
                where: {
                    views_count: { [Op.gt]: 0 }
                },
                include: [{
                    model: Category,
                    required: false,
                    attributes: ['name']
                }],
                order: [[sequelize.literal('COALESCE(views_count, 0)'), 'DESC']],
                limit: 10,
                attributes: {
                    include: [
                        [
                            sequelize.literal(`
                                CASE 
                                    WHEN discount_percentage > 0 
                                    THEN price_ttc * (1 - discount_percentage / 100) 
                                    ELSE price_ttc 
                                END
                            `),
                            'final_price'
                        ]
                    ]
                }
            });
            
            return jewels.map(jewel => ({
                ...jewel.toJSON(),
                category_name: jewel.Category?.name || 'Non catégorisé',
                total_views: jewel.views_count || 0,
                recent_views: Math.floor((jewel.views_count || 0) * 0.3) // Simulation vues récentes
            }));
        } catch (error) {
            console.error('Erreur getMostViewedJewels:', error);
            return [];
        }
    },

    // ==========================================
    // BIJOUX LES PLUS VENDUS
    // ==========================================
    async getMostSoldJewels() {
        try {
            const jewels = await Jewel.findAll({
                where: {
                    sales_count: { [Op.gt]: 0 }
                },
                include: [{
                    model: Category,
                    required: false,
                    attributes: ['name']
                }],
                order: [[sequelize.literal('COALESCE(sales_count, 0)'), 'DESC']],
                limit: 10,
                attributes: {
                    include: [
                        [
                            sequelize.literal(`
                                CASE 
                                    WHEN discount_percentage > 0 
                                    THEN price_ttc * (1 - discount_percentage / 100) 
                                    ELSE price_ttc 
                                END
                            `),
                            'final_price'
                        ],
                        [
                            sequelize.literal('COALESCE(sales_count, 0) * price_ttc'),
                            'total_revenue'
                        ]
                    ]
                }
            });
            
            return jewels.map(jewel => ({
                ...jewel.toJSON(),
                category_name: jewel.Category?.name || 'Non catégorisé',
                total_sold: jewel.sales_count || 0,
                recent_sold: Math.floor((jewel.sales_count || 0) * 0.2), // Simulation ventes récentes
                total_revenue: jewel.dataValues.total_revenue || 0
            }));
        } catch (error) {
            console.error('Erreur getMostSoldJewels:', error);
            return [];
        }
    },

    
    // Récupération des catégories CORRIGÉE
    async getCategories() {
        try {
            const query = `
                SELECT c.*, COUNT(j.id) as jewels_count 
                FROM category c 
                LEFT JOIN jewels j ON c.id = j.category_id 
                GROUP BY c.id, c.name 
                ORDER BY c.name
            `;
            
            const [categories] = await sequelize.query(query);
            console.log(`📂 ${categories.length} catégories trouvées`);
            return categories;
        } catch (error) {
            console.error('Erreur getCategories:', error);
            return [];
        }
    },
    
    // Récupération des matériaux CORRIGÉE
    async getMaterials() {
        try {
            const query = `
                SELECT matiere as name, COUNT(*) as count 
                FROM jewels 
                WHERE matiere IS NOT NULL AND matiere != '' AND matiere != 'null'
                GROUP BY matiere 
                ORDER BY count DESC, matiere
            `;
            
            const [materials] = await sequelize.query(query);
            console.log(`🔨 ${materials.length} matériaux trouvés`);
            return materials;
        } catch (error) {
            console.error('Erreur getMaterials:', error);
            return [];
        }
    },
    // Récupération des types CORRIGÉE
    async getTypes() {
        try {
            const query = `
                SELECT t.*, COUNT(j.id) as jewels_count 
                FROM types t 
                LEFT JOIN jewels j ON t.id = j.type_id 
                GROUP BY t.id, t.name 
                ORDER BY t.name
            `;
            
            const [types] = await sequelize.query(query);
            console.log(`🏷️ ${types.length} types trouvés`);
            return types;
        } catch (error) {
            console.error('Erreur getTypes:', error);
            return [];
        }
    },
    
    // Récupération des commandes récentes CORRIGÉE
    async getRecentOrders() {
        try {
            const query = `
                SELECT 
                    o.*,
                    COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as customer_display_name,
                    COALESCE(o.customer_email, c.email, 'N/A') as customer_display_email,
                    COUNT(oi.id) as items_count
                FROM orders o
                LEFT JOIN customer c ON o.customer_id = c.id
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.created_at IS NOT NULL
                GROUP BY o.id, c.first_name, c.last_name, c.email, o.customer_name, o.customer_email
                ORDER BY o.created_at DESC
                LIMIT 10
            `;
            
            const [orders] = await sequelize.query(query);
            console.log(`📦 ${orders.length} commandes récentes trouvées`);
            return orders;
        } catch (error) {
            console.error('Erreur getRecentOrders:', error);
            return [];
        }
    },
    
    // Mise à jour du stock CORRIGÉE
    async updateStock(req, res) {
        try {
            const { jewelId } = req.params;
            const { stock, action } = req.body;
            
            if (!jewelId || stock === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de bijou et stock requis'
                });
            }
            
            let updateQuery;
            let newStock = parseInt(stock);
            
            if (action === 'set') {
                updateQuery = 'UPDATE jewels SET stock = $1 WHERE id = $2 RETURNING *';
            } else if (action === 'add') {
                updateQuery = 'UPDATE jewels SET stock = COALESCE(stock, 0) + $1 WHERE id = $2 RETURNING *';
            } else if (action === 'subtract') {
                updateQuery = 'UPDATE jewels SET stock = GREATEST(0, COALESCE(stock, 0) - $1) WHERE id = $2 RETURNING *';
            } else {
                updateQuery = 'UPDATE jewels SET stock = $1 WHERE id = $2 RETURNING *';
            }
            
            const [result] = await sequelize.query(updateQuery, {
                bind: [newStock, jewelId]
            });
            
            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            res.json({
                success: true,
                message: 'Stock mis à jour avec succès',
                jewel: result[0]
            });
        } catch (error) {
            console.error('Erreur mise à jour stock:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du stock'
            });
        }
    },
    
    // Appliquer une promotion/réduction CORRIGÉE
    async applyPromotion(req, res) {
        try {
            const { jewelId } = req.params;
            const { discountPercentage, startDate, endDate } = req.body;
            
            if (!jewelId || !discountPercentage) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de bijou et pourcentage de réduction requis'
                });
            }
            
            const updateQuery = `
                UPDATE jewels 
                SET 
                    discount_percentage = $1,
                    discount_start_date = $2,
                    discount_end_date = $3
                WHERE id = $4 
                RETURNING *
            `;
            
            const [result] = await sequelize.query(updateQuery, {
                bind: [
                    parseFloat(discountPercentage),
                    startDate || new Date(),
                    endDate || null,
                    jewelId
                ]
            });
            
            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            res.json({
                success: true,
                message: 'Promotion appliquée avec succès',
                jewel: result[0]
            });
        } catch (error) {
            console.error('Erreur application promotion:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'application de la promotion'
            });
        }
    },
    
    // Supprimer une promotion CORRIGÉE
    async removePromotion(req, res) {
        try {
            const { jewelId } = req.params;
            
            const updateQuery = `
                UPDATE jewels 
                SET 
                    discount_percentage = 0,
                    discount_start_date = NULL,
                    discount_end_date = NULL
                WHERE id = $1 
                RETURNING *
            `;
            
            const [result] = await sequelize.query(updateQuery, {
                bind: [jewelId]
            });
            
            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            res.json({
                success: true,
                message: 'Promotion supprimée avec succès',
                jewel: result[0]
            });
        } catch (error) {
            console.error('Erreur suppression promotion:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression de la promotion'
            });
        }
    },
    
    // Supprimer un bijou CORRIGÉE
    async deleteJewel(req, res) {
        try {
            const { jewelId } = req.params;
            
            // Vérifier s'il y a des commandes liées
            const [orderCheck] = await sequelize.query(
                'SELECT COUNT(*) as count FROM order_items WHERE jewel_id = $1',
                { bind: [jewelId] }
            );
            
            if (parseInt(orderCheck[0].count) > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Impossible de supprimer ce bijou car il a des commandes associées'
                });
            }
            
            // Supprimer les dépendances
            await sequelize.query('DELETE FROM favorites WHERE jewel_id = $1', { bind: [jewelId] });
            await sequelize.query('DELETE FROM cart WHERE jewel_id = $1', { bind: [jewelId] });
            await sequelize.query('DELETE FROM jewel_views WHERE jewel_id = $1', { bind: [jewelId] });
            await sequelize.query('DELETE FROM jewel_images WHERE jewel_id = $1', { bind: [jewelId] });
            
            // Supprimer le bijou
            const [result] = await sequelize.query(
                'DELETE FROM jewels WHERE id = $1 RETURNING *',
                { bind: [jewelId] }
            );
            
            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Bijou non trouvé'
                });
            }
            
            res.json({
                success: true,
                message: 'Bijou supprimé avec succès'
            });
        } catch (error) {
            console.error('Erreur suppression bijou:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression du bijou'
            });
        }
    },
    
     // ==========================================
    // ENDPOINTS AJAX
    // ==========================================
    async getJewelsAjax(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;
            const offset = (page - 1) * limit;
            const lowStockThreshold = parseInt(req.query.stockThreshold) || 3;
            
            const { jewels, totalJewels } = await this.getJewelsWithFilters(
                req.query,
                limit,
                offset,
                lowStockThreshold
            );
            
            const totalPages = Math.ceil(totalJewels / limit);
            
            res.json({
                success: true,
                jewels,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: totalJewels,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        } catch (error) {
            console.error('Erreur getJewelsAjax:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des bijoux'
            });
        }
    },

    async getStatsAjax(req, res) {
        try {
            const lowStockThreshold = parseInt(req.query.threshold) || 3;
            const stats = await this.getEnhancedStats(lowStockThreshold);
            
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Erreur getStatsAjax:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des statistiques'
            });
        }
    },


// ==========================================
    // FONCTIONS DE DIAGNOSTIC
    // ==========================================
    async getDiagnostics() {
        try {
            const totalJewels = await Jewel.count();
            const jewelsWithViews = await Jewel.count({ where: { views_count: { [Op.gt]: 0 } } });
            const jewelsWithFavorites = await Jewel.count({ where: { favorites_count: { [Op.gt]: 0 } } });
            const jewelsOnSale = await Jewel.count({ where: { discount_percentage: { [Op.gt]: 0 } } });
            
            return {
                totalJewels,
                jewelsWithViews,
                jewelsWithFavorites,
                jewelsOnSale,
                trackingEnabled: true,
                version: '1.0.0'
            };
        } catch (error) {
            console.error('Erreur getDiagnostics:', error);
            return {
                error: 'Impossible de récupérer les diagnostics',
                trackingEnabled: false
            };
        }
    }
};

