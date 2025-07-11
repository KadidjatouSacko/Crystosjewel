// ==========================================
// MIDDLEWARE POUR LES FILTRES DE BIJOUX
// app/middleware/filtersMiddleware.js
// ==========================================

import { Jewel, Category, Type } from '../models/associations.js';
import Sequelize from 'sequelize';

const { Op } = Sequelize;

export const filtersMiddleware = {
    
    /**
     * Nettoyer et valider les paramètres de filtres
     */
    sanitizeFilters: (req, res, next) => {
        console.log('🧹 Nettoyage des filtres:', req.query);
        
        try {
            // Listes de valeurs autorisées
            const allowedSorts = ['newest', 'oldest', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'popularity'];
            const allowedPriceRanges = ['0-100', '100-300', '300-600', '600-1000', '1000+'];
            const allowedStockFilters = ['available', 'sale', 'new'];
            const allowedMaterials = ['Or', 'Argent', 'Platine', 'Acier inoxydable', 'Titanium', 'Cuivre'];
            
            // 1. VALIDATION DU TRI
            if (req.query.sort && !allowedSorts.includes(req.query.sort)) {
                console.log(`⚠️ Tri invalide: ${req.query.sort}, remplacé par 'newest'`);
                req.query.sort = 'newest';
            }
            
            // 2. VALIDATION DES PRIX NUMÉRIQUES
            if (req.query.minPrice !== undefined) {
                const minPrice = parseFloat(req.query.minPrice);
                if (isNaN(minPrice) || minPrice < 0) {
                    console.log(`⚠️ Prix minimum invalide: ${req.query.minPrice}`);
                    delete req.query.minPrice;
                } else {
                    req.query.minPrice = Math.round(minPrice * 100) / 100; // Arrondir à 2 décimales
                }
            }
            
            if (req.query.maxPrice !== undefined) {
                const maxPrice = parseFloat(req.query.maxPrice);
                if (isNaN(maxPrice) || maxPrice < 0) {
                    console.log(`⚠️ Prix maximum invalide: ${req.query.maxPrice}`);
                    delete req.query.maxPrice;
                } else {
                    req.query.maxPrice = Math.round(maxPrice * 100) / 100;
                    
                    // S'assurer que max >= min
                    if (req.query.minPrice && req.query.maxPrice < req.query.minPrice) {
                        console.log(`⚠️ Prix max < prix min, correction appliquée`);
                        req.query.maxPrice = req.query.minPrice;
                    }
                }
            }
            
            // 3. VALIDATION DES FILTRES DE PRIX PAR TRANCHES
            if (req.query.price) {
                const priceFilters = Array.isArray(req.query.price) ? req.query.price : [req.query.price];
                const validPriceFilters = priceFilters.filter(p => allowedPriceRanges.includes(p));
                
                if (validPriceFilters.length !== priceFilters.length) {
                    console.log(`⚠️ Filtres de prix invalides supprimés:`, 
                        priceFilters.filter(p => !allowedPriceRanges.includes(p)));
                }
                
                req.query.price = validPriceFilters.length > 0 ? validPriceFilters : undefined;
            }
            
            // 4. VALIDATION DES FILTRES DE STOCK
            if (req.query.stock) {
                const stockFilters = Array.isArray(req.query.stock) ? req.query.stock : [req.query.stock];
                const validStockFilters = stockFilters.filter(s => allowedStockFilters.includes(s));
                
                if (validStockFilters.length !== stockFilters.length) {
                    console.log(`⚠️ Filtres de stock invalides supprimés:`, 
                        stockFilters.filter(s => !allowedStockFilters.includes(s)));
                }
                
                req.query.stock = validStockFilters.length > 0 ? validStockFilters : undefined;
            }
            
            // 5. VALIDATION DES MATÉRIAUX
            if (req.query.material) {
                const materialFilters = Array.isArray(req.query.material) ? req.query.material : [req.query.material];
                const validMaterialFilters = materialFilters.filter(m => 
                    allowedMaterials.includes(m) || m.length <= 50 // Permettre d'autres matériaux mais limiter la longueur
                );
                
                req.query.material = validMaterialFilters.length > 0 ? validMaterialFilters : undefined;
            }
            
            // 6. VALIDATION DES TYPES
            if (req.query.type) {
                const typeFilters = Array.isArray(req.query.type) ? req.query.type : [req.query.type];
                // Validation basique : longueur et caractères
                const validTypeFilters = typeFilters.filter(t => 
                    typeof t === 'string' && t.length <= 50 && /^[a-zA-ZÀ-ÿ\s\-']+$/.test(t)
                );
                
                req.query.type = validTypeFilters.length > 0 ? validTypeFilters : undefined;
            }
            
            // 7. VALIDATION DES TAILLES
            if (req.query.size) {
                const sizeFilters = Array.isArray(req.query.size) ? req.query.size : [req.query.size];
                // Validation basique : longueur et format
                const validSizeFilters = sizeFilters.filter(s => 
                    typeof s === 'string' && s.length <= 20 && /^[a-zA-Z0-9\s\-cm]+$/.test(s)
                );
                
                req.query.size = validSizeFilters.length > 0 ? validSizeFilters : undefined;
            }
            
            // 8. VALIDATION DES CARATS
            if (req.query.carat) {
                const caratFilters = Array.isArray(req.query.carat) ? req.query.carat : [req.query.carat];
                const validCaratFilters = caratFilters.filter(c => {
                    const caratValue = parseInt(c);
                    return !isNaN(caratValue) && caratValue > 0 && caratValue <= 24;
                });
                
                req.query.carat = validCaratFilters.length > 0 ? validCaratFilters : undefined;
            }
            
            // 9. VALIDATION DE LA RECHERCHE TEXTUELLE
            if (req.query.search) {
                // Nettoyer et limiter la recherche
                req.query.search = req.query.search.trim().substring(0, 100);
                
                // Supprimer si vide après nettoyage
                if (!req.query.search) {
                    delete req.query.search;
                }
                
                // Échapper les caractères spéciaux pour éviter les injections
                req.query.search = req.query.search.replace(/[<>\"'&]/g, '');
            }
            
            // 10. VALIDATION DE LA PAGINATION
            if (req.query.page) {
                const page = parseInt(req.query.page);
                if (isNaN(page) || page < 1) {
                    req.query.page = 1;
                } else if (page > 1000) { // Limite arbitraire
                    req.query.page = 1000;
                } else {
                    req.query.page = page;
                }
            }
            
            if (req.query.limit) {
                const limit = parseInt(req.query.limit);
                if (isNaN(limit) || limit < 1 || limit > 100) {
                    delete req.query.limit; // Utiliser la valeur par défaut
                } else {
                    req.query.limit = limit;
                }
            }
            
            // 11. NETTOYER LES PARAMÈTRES VIDES
            Object.keys(req.query).forEach(key => {
                const value = req.query[key];
                
                // Supprimer les valeurs vides, nulles ou undefined
                if (value === '' || value === null || value === undefined) {
                    delete req.query[key];
                }
                
                // Supprimer les tableaux vides
                if (Array.isArray(value) && value.length === 0) {
                    delete req.query[key];
                }
                
                // Supprimer les chaînes qui ne contiennent que des espaces
                if (typeof value === 'string' && value.trim() === '') {
                    delete req.query[key];
                }
            });
            
            console.log('✅ Filtres nettoyés:', req.query);
            next();
            
        } catch (error) {
            console.error('❌ Erreur lors du nettoyage des filtres:', error);
            // En cas d'erreur, vider les query params et continuer
            req.query = {};
            next();
        }
    },

    /**
     * Ajouter des données communes pour les filtres
     */
    addCommonFilterData: async (req, res, next) => {
        try {
            console.log('📊 Ajout des données communes pour les filtres...');
            
            // Données communes disponibles pour tous les templates
            res.locals.commonFilterData = {
                sortOptions: [
                    { value: 'newest', label: 'Plus récents' },
                    { value: 'oldest', label: 'Plus anciens' },
                    { value: 'price_asc', label: 'Prix croissant' },
                    { value: 'price_desc', label: 'Prix décroissant' },
                    { value: 'name_asc', label: 'Nom A-Z' },
                    { value: 'name_desc', label: 'Nom Z-A' },
                    { value: 'popularity', label: 'Popularité' }
                ],
                priceRanges: [
                    { value: '0-100', label: 'Moins de 100€' },
                    { value: '100-300', label: '100€ - 300€' },
                    { value: '300-600', label: '300€ - 600€' },
                    { value: '600-1000', label: '600€ - 1000€' },
                    { value: '1000+', label: 'Plus de 1000€' }
                ],
                stockOptions: [
                    { value: 'available', label: 'En stock' },
                    { value: 'sale', label: 'En promotion' },
                    { value: 'new', label: 'Nouveautés' }
                ]
            };

            // Fonction helper pour construire les query strings
            res.locals.buildQueryString = function(params) {
                return Object.entries(params)
                    .filter(([key, value]) => {
                        if (value === null || value === undefined || value === '') return false;
                        if (Array.isArray(value) && value.length === 0) return false;
                        if (key === 'sort' && value === 'newest') return false; // Valeur par défaut
                        return true;
                    })
                    .map(([key, value]) => {
                        if (Array.isArray(value)) {
                            return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
                        }
                        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
                    })
                    .join('&');
            };

            console.log('✅ Données communes ajoutées');
            next();
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'ajout des données communes:', error);
            // Continuer même en cas d'erreur
            res.locals.commonFilterData = {};
            res.locals.buildQueryString = () => '';
            next();
        }
    },

    /**
     * Valider les paramètres spécifiques à une catégorie
     */
    validateCategoryFilters: (categoryId) => {
        return async (req, res, next) => {
            try {
                console.log(`🔍 Validation des filtres pour la catégorie ${categoryId}...`);
                
                // Vérifier que les matériaux existent pour cette catégorie
                if (req.query.material) {
                    const materials = Array.isArray(req.query.material) ? req.query.material : [req.query.material];
                    
                    const availableMaterials = await Jewel.findAll({
                        where: {
                            category_id: categoryId,
                            is_active: true,
                            stock: { [Op.gt]: 0 }
                        },
                        attributes: ['matiere'],
                        group: ['matiere']
                    });
                    
                    const validMaterials = availableMaterials.map(m => m.matiere);
                    const filteredMaterials = materials.filter(m => validMaterials.includes(m));
                    
                    if (filteredMaterials.length !== materials.length) {
                        console.log(`⚠️ Matériaux non disponibles supprimés:`, 
                            materials.filter(m => !validMaterials.includes(m)));
                    }
                    
                    req.query.material = filteredMaterials.length > 0 ? filteredMaterials : undefined;
                }
                
                // Vérifier que les types existent pour cette catégorie
                if (req.query.type) {
                    const types = Array.isArray(req.query.type) ? req.query.type : [req.query.type];
                    
                    const availableTypes = await Jewel.findAll({
                        where: {
                            category_id: categoryId,
                            is_active: true,
                            type_id: { [Op.not]: null },
                            stock: { [Op.gt]: 0 }
                        },
                        include: [{
                            model: Type,
                            as: 'type',
                            attributes: ['name']
                        }],
                        group: ['type.name']
                    });
                    
                    const validTypes = availableTypes.map(t => t.type.name);
                    const filteredTypes = types.filter(t => validTypes.includes(t));
                    
                    req.query.type = filteredTypes.length > 0 ? filteredTypes : undefined;
                }
                
                console.log('✅ Filtres de catégorie validés');
                next();
                
            } catch (error) {
                console.error('❌ Erreur lors de la validation des filtres de catégorie:', error);
                // Continuer même en cas d'erreur
                next();
            }
        };
    },

    /**
     * Logger les filtres appliqués (pour le debugging)
     */
    logFilters: (req, res, next) => {
        if (process.env.NODE_ENV === 'development') {
            const appliedFilters = Object.keys(req.query).filter(key => 
                req.query[key] !== undefined && req.query[key] !== '' && 
                !(Array.isArray(req.query[key]) && req.query[key].length === 0)
            );
            
            if (appliedFilters.length > 0) {
                console.log('🔍 Filtres appliqués:', appliedFilters.reduce((acc, key) => {
                    acc[key] = req.query[key];
                    return acc;
                }, {}));
            } else {
                console.log('📄 Aucun filtre appliqué');
            }
        }
        
        next();
    },

    /**
     * Ajouter des métadonnées de performance
     */
    addPerformanceData: (req, res, next) => {
        // Marquer le début du traitement
        req.filtersStartTime = Date.now();
        
        // Ajouter une fonction pour calculer le temps de traitement
        res.locals.getProcessingTime = () => {
            return req.filtersStartTime ? Date.now() - req.filtersStartTime : 0;
        };
        
        next();
    },

    /**
     * Gérer les erreurs de filtrage
     */
    handleFilterErrors: (err, req, res, next) => {
        console.error('❌ Erreur dans le middleware de filtres:', err);
        
        // Si c'est une erreur de base de données liée aux filtres
        if (err.name === 'SequelizeError' || err.name === 'DatabaseError') {
            console.log('🔄 Redirection vers la page sans filtres...');
            
            // Rediriger vers la page sans paramètres de filtres
            const basePath = req.path;
            return res.redirect(basePath);
        }
        
        // Pour les autres erreurs, continuer vers le gestionnaire d'erreur global
        next(err);
    },

    /**
     * Optimiser les requêtes selon les filtres
     */
    optimizeQuery: (req, res, next) => {
        // Suggestions d'optimisation basées sur les filtres appliqués
        const hints = [];
        
        if (req.query.price || req.query.minPrice || req.query.maxPrice) {
            hints.push('price_index');
        }
        
        if (req.query.material) {
            hints.push('material_index');
        }
        
        if (req.query.sort === 'popularity') {
            hints.push('popularity_index');
        }
        
        // Stocker les hints pour utilisation dans les contrôleurs
        req.queryHints = hints;
        
        next();
    },

    /**
     * Middleware de cache (pour les filtres fréquents)
     */
    cacheCommonFilters: (req, res, next) => {
        // Identifier les combinaisons de filtres fréquentes
        const filterSignature = JSON.stringify({
            sort: req.query.sort || 'newest',
            price: req.query.price,
            material: req.query.material,
            stock: req.query.stock
        });
        
        // Stocker la signature pour un éventuel cache
        req.filterSignature = filterSignature;
        
        // Pour l'instant, juste passer au suivant
        // Dans une vraie application, vous pourriez vérifier un cache Redis ici
        next();
    },

    /**
     * Limiter le taux de requêtes pour éviter le spam
     */
    rateLimitFilters: (req, res, next) => {
        // Implémenter une limite de taux simple en mémoire
        const clientIP = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const maxRequests = 100; // 100 requêtes par minute
        
        // Initialiser le store de rate limiting si nécessaire
        if (!req.app.locals.rateLimitStore) {
            req.app.locals.rateLimitStore = new Map();
        }
        
        const store = req.app.locals.rateLimitStore;
        const clientData = store.get(clientIP) || { count: 0, resetTime: now + windowMs };
        
        // Réinitialiser si la fenêtre a expiré
        if (now >= clientData.resetTime) {
            clientData.count = 0;
            clientData.resetTime = now + windowMs;
        }
        
        // Incrémenter le compteur
        clientData.count++;
        store.set(clientIP, clientData);
        
        // Vérifier la limite
        if (clientData.count > maxRequests) {
            console.log(`⚠️ Rate limit dépassé pour IP: ${clientIP}`);
            return res.status(429).json({
                error: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
                retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
            });
        }
        
        // Nettoyer les anciennes entrées périodiquement
        if (store.size > 1000 && Math.random() < 0.01) { // 1% de chance
            const cutoff = now - windowMs;
            for (const [ip, data] of store.entries()) {
                if (data.resetTime < cutoff) {
                    store.delete(ip);
                }
            }
        }
        
        next();
    },

    /**
     * Ajouter des headers de sécurité pour les filtres
     */
    addSecurityHeaders: (req, res, next) => {
        // Empêcher la mise en cache de pages avec des filtres sensibles
        if (Object.keys(req.query).length > 0) {
            res.set({
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            });
        }
        
        // Ajouter des headers CSP spécifiques aux filtres
        res.set('Content-Security-Policy-Report-Only', 
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com"
        );
        
        next();
    },

    /**
     * Middleware de développement pour débugger les filtres
     */
    debugFilters: (req, res, next) => {
        if (process.env.NODE_ENV === 'development' && req.query.debug === 'filters') {
            console.log('🐛 DEBUG MODE ACTIVÉ');
            console.log('📊 Query params originaux:', req.originalUrl);
            console.log('🧹 Query params nettoyés:', req.query);
            console.log('⏱️ Timestamp:', new Date().toISOString());
            console.log('🌐 User Agent:', req.get('User-Agent'));
            console.log('📍 IP:', req.ip);
            
            // Ajouter des données de debug dans la réponse
            res.locals.debugInfo = {
                originalQuery: req.originalUrl,
                cleanedQuery: req.query,
                timestamp: new Date().toISOString(),
                userAgent: req.get('User-Agent'),
                ip: req.ip
            };
        }
        
        next();
    }
};

// ==========================================
// FONCTIONS UTILITAIRES SUPPLÉMENTAIRES
// ==========================================

/**
 * Créer une chaîne de middleware pour une catégorie spécifique
 */
export function createCategoryFilterMiddleware(categoryId, options = {}) {
    const middleware = [
        filtersMiddleware.addPerformanceData,
        filtersMiddleware.sanitizeFilters,
        filtersMiddleware.addCommonFilterData
    ];
    
    // Ajouter la validation spécifique à la catégorie si demandée
    if (options.validateCategory !== false) {
        middleware.push(filtersMiddleware.validateCategoryFilters(categoryId));
    }
    
    // Ajouter le rate limiting si demandé
    if (options.enableRateLimit) {
        middleware.push(filtersMiddleware.rateLimitFilters);
    }
    
    // Ajouter le cache si demandé
    if (options.enableCache) {
        middleware.push(filtersMiddleware.cacheCommonFilters);
    }
    
    // Ajouter le logging si en développement
    if (process.env.NODE_ENV === 'development') {
        middleware.push(filtersMiddleware.logFilters);
        middleware.push(filtersMiddleware.debugFilters);
    }
    
    // Ajouter l'optimisation des requêtes
    middleware.push(filtersMiddleware.optimizeQuery);
    
    // Ajouter les headers de sécurité
    middleware.push(filtersMiddleware.addSecurityHeaders);
    
    return middleware;
}

/**
 * Créer un middleware pour les API AJAX
 */
export function createAjaxFilterMiddleware() {
    return [
        filtersMiddleware.addPerformanceData,
        filtersMiddleware.rateLimitFilters,
        filtersMiddleware.sanitizeFilters,
        filtersMiddleware.addCommonFilterData,
        filtersMiddleware.optimizeQuery,
        filtersMiddleware.logFilters
    ];
}

/**
 * Valider les paramètres de filtres côté serveur
 */
export function validateFiltersServer(filters) {
    const errors = [];
    
    // Valider les prix
    if (filters.minPrice !== undefined && (isNaN(filters.minPrice) || filters.minPrice < 0)) {
        errors.push('Prix minimum invalide');
    }
    
    if (filters.maxPrice !== undefined && (isNaN(filters.maxPrice) || filters.maxPrice < 0)) {
        errors.push('Prix maximum invalide');
    }
    
    if (filters.minPrice && filters.maxPrice && filters.minPrice > filters.maxPrice) {
        errors.push('Le prix minimum ne peut pas être supérieur au prix maximum');
    }
    
    // Valider les tableaux
    ['price', 'material', 'type', 'size', 'carat', 'stock'].forEach(field => {
        if (filters[field] && !Array.isArray(filters[field])) {
            errors.push(`Le filtre ${field} doit être un tableau`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Construire une signature de cache pour les filtres
 */
export function buildFilterCacheKey(filters, categoryId) {
    const keyData = {
        category: categoryId,
        sort: filters.sort || 'newest',
        price: filters.price ? filters.price.sort().join(',') : null,
        material: filters.material ? filters.material.sort().join(',') : null,
        type: filters.type ? filters.type.sort().join(',') : null,
        size: filters.size ? filters.size.sort().join(',') : null,
        carat: filters.carat ? filters.carat.sort().join(',') : null,
        stock: filters.stock ? filters.stock.sort().join(',') : null,
        minPrice: filters.minPrice || null,
        maxPrice: filters.maxPrice || null,
        search: filters.search || null
    };
    
    // Supprimer les valeurs nulles
    Object.keys(keyData).forEach(key => {
        if (keyData[key] === null || keyData[key] === undefined) {
            delete keyData[key];
        }
    });
    
    // Créer un hash simple
    return 'filters_' + Buffer.from(JSON.stringify(keyData)).toString('base64').slice(0, 32);
}

// ==========================================
// EXPORT DES MIDDLEWARES PRÊTS À L'EMPLOI
// ==========================================

// Middleware pour les bagues
export const baguesFilterMiddleware = createCategoryFilterMiddleware(3, {
    validateCategory: true,
    enableRateLimit: true,
    enableCache: false
});

// Middleware pour les bracelets
export const braceletsFilterMiddleware = createCategoryFilterMiddleware(2, {
    validateCategory: true,
    enableRateLimit: true,
    enableCache: false
});

// Middleware pour les colliers
export const colliersFilterMiddleware = createCategoryFilterMiddleware(1, {
    validateCategory: true,
    enableRateLimit: true,
    enableCache: false
});

// Middleware pour les API AJAX
export const ajaxFilterMiddleware = createAjaxFilterMiddleware();

// Export par défaut
export default filtersMiddleware;