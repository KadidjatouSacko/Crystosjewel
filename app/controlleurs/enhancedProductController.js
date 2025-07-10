// ===================================================================
// FICHIER 2: app/controlleurs/enhancedProductController.js
// ===================================================================

import { Jewel } from "../models/jewelModel.js";
import { Category } from "../models/categoryModel.js";
import { Type } from '../models/TypeModel.js';
import { JewelImage } from '../models/jewelImage.js';
import { 
    determineBadges, 
    calculateFinalPrice, 
    getAvailableFilters, 
    // buildFilterWhereClause,
    // buildOrderClause 
} from '../utils/productHelpers.js';

export const enhancedProductController = {
    
    /**
     * Contrôleur générique pour toutes les pages de produits
     */
    async showProductsPage(req, res, options = {}) {
        try {
            const {
                categoryId = null,
                categoryName = 'Tous les bijoux',
                pageTitle = 'Nos Bijoux',
                templateName = 'products',
                baseRoute = '/bijoux'
            } = options;
            
            // Récupération des paramètres de filtrage
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
            
            // Construction de la clause WHERE de base
            let baseWhere = { is_active: true };
            if (categoryId) {
                baseWhere.category_id = categoryId;
            }
            
            // Application des filtres
            const whereClause = buildFilterWhereClause(filters, baseWhere);
            const orderClause = buildOrderClause(filters.sort);
            
            // Récupération des bijoux
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
                    },
                    {
                        model: JewelImage,
                        as: 'additionalImages',
                        required: false,
                        limit: 1
                    }
                ],
                order: orderClause,
                limit,
                offset,
                distinct: true
            });
            
            // Formatage des bijoux avec badges et prix
            const formattedJewels = jewels.map(jewel => {
                const jewelData = jewel.toJSON();
                const priceInfo = calculateFinalPrice(jewelData);
                const badge = determineBadges(jewelData);
                
                return {
                    ...jewelData,
                    ...priceInfo,
                    badge,
                    formattedOriginalPrice: new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(priceInfo.originalPrice),
                    formattedFinalPrice: new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(priceInfo.finalPrice),
                    formattedSavings: priceInfo.hasDiscount ? new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(priceInfo.savings) : null,
                    image: jewelData.image || (jewelData.additionalImages?.[0]?.image_url) || 'no-image.jpg'
                };
            });
            
            // Récupération des filtres disponibles
            const availableFilters = await getAvailableFilters(categoryId);
            
            // Pagination
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
            
            // Bannières dynamiques selon les filtres appliqués
            const banners = this.generateBanners(filters, availableFilters, categoryName);
            
            // Rendu de la vue
            res.render(templateName, {
                title: `${pageTitle} - CrystosJewel`,
                pageTitle,
                categoryName,
                jewels: formattedJewels,
                filters,
                availableFilters,
                pagination,
                banners,
                baseRoute,
                user: req.session?.user || null,
                cartItemCount: req.session?.cartItemCount || 0
            });
            
        } catch (error) {
            console.error('❌ Erreur affichage produits:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement des produits',
                user: req.session?.user || null
            });
        }
    },
    
    /**
     * Génère les bannières dynamiques
     */
    generateBanners(filters, availableFilters, categoryName) {
        const banners = [];
        
        // Bannière principale selon la catégorie
        banners.push({
            type: 'main',
            title: `Découvrez nos ${categoryName}`,
            subtitle: 'Des créations uniques pour tous les styles',
            class: 'banner-main',
            background: this.getCategoryBackground(categoryName)
        });
        
        // Bannière promotions si des promos sont disponibles
        if (availableFilters.availability.on_sale > 0) {
            banners.push({
                type: 'promotion',
                title: `🏷️ ${availableFilters.availability.on_sale} ${categoryName} en promotion`,
                subtitle: 'Profitez de réductions exceptionnelles',
                class: 'banner-promotion',
                link: `?disponibilite=en_promo`,
                background: 'linear-gradient(135deg, #e74c3c, #c0392b)'
            });
        }
        
        // Bannière nouveautés
        if (availableFilters.availability.new_items > 0) {
            banners.push({
                type: 'nouveau',
                title: `✨ ${availableFilters.availability.new_items} Nouveautés`,
                subtitle: 'Découvrez nos dernières créations',
                class: 'banner-nouveau',
                link: `?disponibilite=nouveau`,
                background: 'linear-gradient(135deg, #27ae60, #229954)'
            });
        }
        
        // Bannière stock limité si applicable
        if (filters.disponibilite === 'en_stock') {
            banners.push({
                type: 'stock',
                title: '🔥 Dernières chances',
                subtitle: 'Ces bijoux partent vite !',
                class: 'banner-stock',
                background: 'linear-gradient(135deg, #e67e22, #d68910)'
            });
        }
        
        return banners;
    },
    
    /**
     * Détermine l'arrière-plan selon la catégorie
     */
    getCategoryBackground(categoryName) {
        const backgrounds = {
            'Bagues': 'linear-gradient(135deg, #b76e79, #a05d68)',
            'Colliers': 'linear-gradient(135deg, #8e44ad, #7d3c98)',
            'Bracelets': 'linear-gradient(135deg, #2980b9, #2471a3)',
            'Boucles d\'oreilles': 'linear-gradient(135deg, #e67e22, #d68910)'
        };
        
        return backgrounds[categoryName] || 'linear-gradient(135deg, #b76e79, #a05d68)';
    },
    
    /**
     * Méthodes spécifiques pour chaque catégorie
     */
    async showBagues(req, res) {
        return this.showProductsPage(req, res, {
            categoryId: 1,
            categoryName: 'Bagues',
            pageTitle: 'Nos Bagues',
            templateName: 'enhanced-products',
            baseRoute: '/bijoux/bagues'
        });
    },
    
    async showColliers(req, res) {
        return this.showProductsPage(req, res, {
            categoryId: 2,
            categoryName: 'Colliers',
            pageTitle: 'Nos Colliers',
            templateName: 'enhanced-products',
            baseRoute: '/bijoux/colliers'
        });
    },
    
    async showBracelets(req, res) {
        return this.showProductsPage(req, res, {
            categoryId: 3,
            categoryName: 'Bracelets',
            pageTitle: 'Nos Bracelets',
            templateName: 'enhanced-products',
            baseRoute: '/bijoux/bracelets'
        });
    },
    
    async showPromotions(req, res) {
        // Forcer le filtre promotions
        req.query.disponibilite = 'en_promo';
        
        return this.showProductsPage(req, res, {
            categoryId: null,
            categoryName: 'Bijoux en promotion',
            pageTitle: 'Nos Promotions',
            templateName: 'enhanced-products',
            baseRoute: '/on-sale'
        });
    }
};