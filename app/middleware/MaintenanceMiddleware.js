// ====================================
        // REDIRECTION EN MODE MAINTENANCE
        // ====================================// middleware/maintenanceMiddleware.js - VERSION CORRIGÉE
import Setting from '../models/SettingModel.js';
import { Customer } from '../models/customerModel.js';
import { Role } from '../models/roleModel.js';

/**
 * Middleware de maintenance avec exception pour les administrateurs
 */
export const maintenanceMiddleware = async (req, res, next) => {
    try {
        console.log('🔧 Vérification mode maintenance...');
        
        // Vérifier si le mode maintenance est activé en utilisant la table 'settings'
        const maintenanceSetting = await Setting.findOne({
            where: { 
                section: 'maintenance', 
                key: 'maintenance_enabled' 
            }
        });

        const isMaintenanceMode = maintenanceSetting?.value === 'true';
        console.log(`🔧 Mode maintenance: ${isMaintenanceMode ? 'ACTIF' : 'INACTIF'}`);

        if (!isMaintenanceMode) {
            // Pas en maintenance, continuer normalement
            return next();
        }

        // ====================================
        // EXCEPTIONS POUR LES ADMINISTRATEURS
        // ====================================

        // 1. Vérifier si l'utilisateur est connecté et est admin
        if (req.session?.user?.role_id === 2) {
            console.log('🛡️ Admin détecté, bypass maintenance autorisé');
            // Ajouter des variables pour indiquer que le site est en maintenance
            res.locals.isMaintenanceMode = true;
            res.locals.isAdminBypass = true;
            return next();
        }

        // 2. Vérifier si c'est une requête vers l'interface admin
        const adminPaths = [
            '/admin',
            '/connexion-inscription',
            '/connexion',  // Ajouter pour votre route de connexion
            '/login',      // Au cas où
            '/api/admin',
            '/login-admin'
        ];

        const isAdminPath = adminPaths.some(path => 
            req.path.startsWith(path)
        );

        if (isAdminPath) {
            console.log('🔧 Chemin admin détecté, autorisation d\'accès:', req.path);
            res.locals.isMaintenanceMode = true;
            return next();
        }

        // 3. Permettre l'accès aux assets statiques nécessaires ET aux routes de connexion
        const allowedStaticPaths = [
            '/css/',
            '/js/',
            '/images/',
            '/favicon.ico',
            '/assets/',
            '/fonts/',
            '/api/auth/',      // Routes d'authentification
            '/deconnexion',    // Déconnexion
            '/logout'          // Déconnexion alternative
        ];

        const isStaticPath = allowedStaticPaths.some(path => 
            req.path.startsWith(path)
        );

        if (isStaticPath) {
            console.log('🔧 Chemin autorisé détecté:', req.path);
            return next();
        }

        // 4. Ignorer les requêtes de Chrome DevTools et autres outils
        const ignoredPaths = [
            '/.well-known/',
            '/manifest.json',
            '/robots.txt',
            '/sitemap.xml'
        ];

        const isIgnoredPath = ignoredPaths.some(path => 
            req.path.startsWith(path)
        );

        if (isIgnoredPath) {
            console.log('🔧 Chemin ignoré:', req.path);
            return next();
        }

        console.log('🚫 Accès bloqué - Mode maintenance actif pour:', req.path);

        // Récupérer le message et les infos de maintenance
        const maintenanceMessage = await Setting.findOne({
            where: { section: 'maintenance', key: 'maintenance_message' }
        });

        const estimatedTime = await Setting.findOne({
            where: { section: 'maintenance', key: 'maintenance_estimated_time' }
        });

        const contactEmail = await Setting.findOne({
            where: { section: 'maintenance', key: 'maintenance_contact_email' }
        });

        // Pour tous les autres utilisateurs, afficher la page de maintenance
        return res.status(503).render('maintenance', {
            title: 'Site en maintenance',
            message: maintenanceMessage?.value || 'Le site est temporairement en maintenance. Nous serons de retour très bientôt !',
            estimatedTime: estimatedTime?.value || null,
            contactEmail: contactEmail?.value || 'crystosjewel@gmail.com',
            user: null,
            isAuthenticated: false,
            isAdmin: false
        });

    } catch (error) {
        console.error('❌ Erreur dans maintenanceMiddleware:', error);
        // En cas d'erreur, laisser passer pour éviter de bloquer le site
        next();
    }
};

/**
 * Middleware spécifique pour forcer l'accès admin en maintenance
 */
export const forceAdminAccessMiddleware = async (req, res, next) => {
    try {
        // Si on est déjà identifié comme admin, passer
        if (req.session?.user?.role_id === 2) {
            return next();
        }

        // Vérifier si l'utilisateur a un token de session valide mais role non défini
        if (req.session?.user?.id) {
            const user = await Customer.findByPk(req.session.user.id, {
                include: [
                    {
                        model: Role,
                        as: 'role',
                        attributes: ['id', 'name']
                    }
                ]
            });

            if (user && user.role_id === 2) {
                // Mettre à jour la session avec les droits admin
                req.session.user = {
                    ...req.session.user,
                    role_id: user.role_id,
                    role: user.role,
                    isAdmin: true
                };
                
                console.log('🔄 Session admin restaurée pendant la maintenance');
                return next();
            }
        }

        next();
    } catch (error) {
        console.error('❌ Erreur dans forceAdminAccessMiddleware:', error);
        next();
    }
};

/**
 * Route API pour toggle la maintenance
 */
export const toggleMaintenanceAPI = async (req, res) => {
    try {
        const { enabled, estimatedTime } = req.body;
        
        console.log('🔧 Toggle maintenance:', { enabled, estimatedTime });
        
        // Mettre à jour le paramètre de maintenance
        await Setting.upsert({
            section: 'maintenance',
            key: 'maintenance_enabled',
            value: enabled ? 'true' : 'false',
            type: 'boolean',
            description: 'Mode maintenance du site'
        });

        if (estimatedTime) {
            await Setting.upsert({
                section: 'maintenance',
                key: 'maintenance_estimated_time',
                value: estimatedTime,
                type: 'string',
                description: 'Temps estimé de retour'
            });
        }

        console.log(`🔧 Mode maintenance ${enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'} par admin:`, req.session.user.email);

        res.json({
            success: true,
            message: `Mode maintenance ${enabled ? 'activé' : 'désactivé'}`,
            maintenanceMode: enabled
        });

    } catch (error) {
        console.error('❌ Erreur toggle maintenance:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du changement de statut'
        });
    }
};