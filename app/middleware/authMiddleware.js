// middleware/authMiddleware.js - VERSION CORRIGÉE
import { Role } from '../models/roleModel.js';
import { Customer } from '../models/customerModel.js';

export const isAuthenticated = (req, res, next) => {
    if (!req.session?.user) {
        return res.redirect('/connexion-inscription');
    }
    next();
};

export const isAdmin = async (req, res, next) => {
    try {
        console.log('🔐 Vérification admin pour:', req.session?.user?.email);
        
        // EN MODE MAINTENANCE: Vérifier d'abord si l'utilisateur a déjà les droits admin en session
        if (res.locals.isMaintenanceMode && req.session?.user?.role_id === 2) {
            console.log('🛡️ Accès admin autorisé en mode maintenance');
            return next();
        }
        
        if (!req.session?.user) {
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Non authentifié' 
                });
            }
            return res.redirect('/connexion-inscription?admin=1');
        }

        // Récupérer l'utilisateur avec son rôle complet
        const user = await Customer.findByPk(req.session.user.id, {
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!user) {
            console.log('❌ Utilisateur non trouvé en base');
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Utilisateur non trouvé' 
                });
            }
            return res.redirect('/connexion-inscription?admin=1');
        }

        // VÉRIFICATION STRICTE : SEULEMENT role_id = 2
        const isUserAdmin = user.role_id === 2;

        if (!isUserAdmin) {
            console.log('❌ Accès refusé - role_id:', user.role_id, '(attendu: 2)');
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Accès refusé - Droits administrateur requis' 
                });
            }
            return res.status(403).render('error', { 
                statusCode: 403,
                message: 'Accès refusé - Droits administrateur requis',
                title: 'Accès refusé',
                user: req.session?.user || null,
                isAuthenticated: !!req.session?.user,
                isAdmin: false
            });
        }

        console.log('✅ Accès admin accordé pour role_id:', user.role_id);

        // Mettre à jour la session avec les données complètes
        req.session.user = {
            ...req.session.user,
            role: user.role,
            role_id: user.role_id,
            isAdmin: true
        };

        next();
        
    } catch (error) {
        console.error('❌ Erreur dans isAdmin:', error);
        
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur lors de la vérification des permissions' 
            });
        }
        
        return res.status(500).render('error', { 
            message: 'Erreur serveur',
            user: req.session?.user || null,
            isAuthenticated: !!req.session?.user,
            isAdmin: false
        });
    }
};


// MIDDLEWARE POUR RENDRE LES DONNÉES UTILISATEUR DISPONIBLES
export const setUserForViews = async (req, res, next) => {
    try {
        // Données de base
        res.locals.user = req.session?.user || null;
        res.locals.isAuthenticated = !!req.session?.user;
        
        // Déterminer si l'utilisateur est admin - LOGIQUE STRICTE
        let isAdmin = false;
        if (req.session?.user) {
            // SEULEMENT role_id = 2 est admin
            isAdmin = req.session.user.role_id === 2;
        }
        res.locals.isAdmin = isAdmin;
        
        console.log('🎭 Données vues définies:', {
            isAuthenticated: res.locals.isAuthenticated,
            isAdmin: res.locals.isAdmin,
            userId: req.session?.user?.id,
            role_id: req.session?.user?.role_id
        });
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur dans setUserForViews:', error);
        
        // Valeurs par défaut en cas d'erreur
        res.locals.user = null;
        res.locals.isAuthenticated = false;
        res.locals.isAdmin = false;
        
        next();
    }
};

// MIDDLEWARE pour les pages client uniquement
export const clientOnly = (req, res, next) => {
    if (!req.session?.user) {
        return res.redirect('/connexion-inscription');
    }
    
    // Vérifier que ce n'est PAS un admin (role_id = 2)
    const isAdmin = req.session.user.role_id === 2;
    
    if (isAdmin) {
        return res.redirect('/admin/stats'); // Rediriger les admins vers leur dashboard
    }
    
    next();
};