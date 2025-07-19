// app/middleware/authMiddleware.js - VERSION SIMPLIFIÉE ET FONCTIONNELLE
import { Role } from '../models/roleModel.js';
import { Customer } from '../models/customerModel.js';

// ✅ MIDDLEWARE SIMPLE POUR VÉRIFIER LA CONNEXION
export const isAuthenticated = (req, res, next) => {
    console.log('🔐 Vérification authentification');
    console.log('Session user:', !!req.session?.user);
    console.log('Session customerId:', !!req.session?.customerId);
    
    // Vérifier les deux types de session
    const isLoggedIn = !!(req.session?.customerId || req.session?.user?.id);
    
    if (!isLoggedIn) {
        console.log('❌ Utilisateur non connecté');
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentification requise',
                redirect: '/connexion-inscription'
            });
        }
        return res.redirect('/connexion-inscription');
    }
    
    console.log('✅ Utilisateur authentifié');
    next();
};

// ✅ MIDDLEWARE ADMIN ULTRA-SIMPLIFIÉ
export const isAdmin = (req, res, next) => {
    console.log('🔐 Debug session admin:', {
        hasSession: !!req.session,
        customerId: req.session?.customerId,
        userExists: !!req.session?.user,
        roleId: req.session?.user?.role_id
    });
    
    // Accepter si customerId = 1 (votre account) et role_id = 2
    if (req.session?.customerId === 1 && req.session?.user?.role_id === 2) {
        console.log('✅ Admin autorisé');
        return next();
    }
    
    console.log('❌ Accès refusé');
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentification requise',
            redirect: '/connexion-inscription'
        });
    }
    return res.redirect('/connexion-inscription');
};

// ✅ MIDDLEWARE POUR CHARGER LES DONNÉES UTILISATEUR (UNE SEULE FOIS)
export const loadUserData = async (req, res, next) => {
    try {
        const userId = req.session?.customerId || req.session?.user?.id;
        
        if (!userId) {
            // Pas connecté
            res.locals.user = null;
            res.locals.isAuthenticated = false;
            res.locals.isAdmin = false;
            return next();
        }

        // Si on a déjà toutes les données en session, les utiliser
        if (req.session.user && req.session.user.role_id !== undefined) {
            res.locals.user = req.session.user;
            res.locals.isAuthenticated = true;
            res.locals.isAdmin = req.session.user.role_id === 2;
            return next();
        }

        // Sinon, charger depuis la base UNE SEULE FOIS
        console.log('🔄 Chargement données utilisateur depuis la base');
        const user = await Customer.findByPk(userId, {
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name'],
                    required: false // Pas obligatoire
                }
            ]
        });

        if (!user) {
            // Utilisateur supprimé, nettoyer la session
            req.session.destroy();
            res.locals.user = null;
            res.locals.isAuthenticated = false;
            res.locals.isAdmin = false;
            return next();
        }

        // ✅ METTRE À JOUR LA SESSION AVEC TOUTES LES DONNÉES
        req.session.user = {
            id: user.id,
            name: user.first_name,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            role: user.role ? {
                id: user.role.id,
                name: user.role.name
            } : { id: 1, name: 'client' },
            role_id: user.role_id || 1,
            isAdmin: user.role_id === 2,
            lastActivity: new Date()
        };

        req.session.customerId = user.id; // Pour compatibilité

        // Variables pour les vues
        res.locals.user = req.session.user;
        res.locals.isAuthenticated = true;
        res.locals.isAdmin = user.role_id === 2;
        
        console.log('✅ Données utilisateur chargées:', {
            id: user.id,
            email: user.email,
            role_id: user.role_id,
            isAdmin: user.role_id === 2
        });
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur loadUserData:', error);
        
        // Valeurs par défaut en cas d'erreur
        res.locals.user = null;
        res.locals.isAuthenticated = false;
        res.locals.isAdmin = false;
        
        next();
    }
};

// ✅ MIDDLEWARE ADMIN AVEC CHARGEMENT SI NÉCESSAIRE
export const requireAdmin = async (req, res, next) => {
    try {
        console.log('🔐 Vérification admin avec chargement');
        
        const userId = req.session?.customerId || req.session?.user?.id;
        
        if (!userId) {
            console.log('❌ Pas d\'ID utilisateur');
            return redirectToLogin(req, res);
        }

        // Si on a déjà le role_id en session, l'utiliser
        if (req.session.user && req.session.user.role_id !== undefined) {
            if (req.session.user.role_id === 2) {
                console.log('✅ Admin vérifié via session');
                return next();
            } else {
                console.log('❌ Pas admin via session');
                return handleAccessDenied(req, res);
            }
        }

        // Sinon, charger depuis la base
        console.log('🔄 Chargement role depuis la base pour admin');
        const user = await Customer.findByPk(userId, {
            attributes: ['id', 'email', 'first_name', 'last_name', 'role_id'],
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name'],
                    required: false
                }
            ]
        });

        if (!user) {
            console.log('❌ Utilisateur non trouvé');
            req.session.destroy();
            return redirectToLogin(req, res);
        }

        console.log('👤 Utilisateur chargé:', {
            id: user.id,
            email: user.email,
            role_id: user.role_id
        });

        // Mettre à jour la session
        req.session.user = {
            id: user.id,
            name: user.first_name,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            role: user.role ? {
                id: user.role.id,
                name: user.role.name
            } : { id: user.role_id || 1, name: user.role_id === 2 ? 'administrateur' : 'client' },
            role_id: user.role_id || 1,
            isAdmin: user.role_id === 2,
            lastActivity: new Date()
        };

        req.session.customerId = user.id;

        // Vérifier les droits admin
        if (user.role_id === 2) {
            console.log('✅ Accès admin accordé');
            next();
        } else {
            console.log(`❌ Accès refusé - role_id: ${user.role_id}`);
            handleAccessDenied(req, res);
        }
        
    } catch (error) {
        console.error('❌ Erreur requireAdmin:', error);
        return res.status(500).render('error', {
            statusCode: 500,
            message: 'Erreur serveur lors de la vérification des permissions',
            title: 'Erreur serveur'
        });
    }
};

// ✅ ALIAS POUR COMPATIBILITÉ
export const setUserForViews = loadUserData;

// ✅ MIDDLEWARE CLIENT SEULEMENT
export const clientOnly = (req, res, next) => {
    if (!req.session?.user && !req.session?.customerId) {
        return res.redirect('/connexion-inscription');
    }
    
    // Empêcher les admins d'accéder aux pages client
    if (req.session?.user?.role_id === 2) {
        return res.redirect('/admin/mon-suivi');
    }
    
    next();
};

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

function redirectToLogin(req, res) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentification requise',
            redirect: '/connexion-inscription'
        });
    }
    return res.redirect('/connexion-inscription');
}

function handleAccessDenied(req, res) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({ 
            success: false, 
            message: 'Accès refusé - Droits administrateur requis'
        });
    }
    
    return res.status(403).render('error', { 
        statusCode: 403,
        message: 'Accès refusé - Vous devez être administrateur pour accéder à cette page',
        title: 'Accès refusé',
        user: req.session?.user || null,
        isAuthenticated: !!req.session?.user,
        isAdmin: false
    });
}