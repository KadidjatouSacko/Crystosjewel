// app/middleware/maintenanceMiddleware.js

import Setting from '../models/SettingModel.js';

let maintenanceCache = null;
let lastMaintenanceCheck = null;

/**
 * Middleware de maintenance pour gérer l'accès au site
 * Permet l'activation/désactivation immédiate et programmée
 */
export const maintenanceMiddleware = async (req, res, next) => {
    try {
        const now = new Date();
        
        // Vérifier le cache (rafraîchir toutes les 30 secondes)
        const shouldRefresh = !maintenanceCache || 
                             !lastMaintenanceCheck || 
                             (now.getTime() - lastMaintenanceCheck) > 30000;

        if (shouldRefresh) {
            console.log('🔄 Vérification statut maintenance...');
            
            // Récupérer les paramètres de maintenance
            const settings = await Setting.findAll({
                where: {
                    section: 'maintenance',
                    key: ['enabled', 'scheduled_start', 'scheduled_end', 'message', 'allowed_ips']
                }
            });

            maintenanceCache = {};
            settings.forEach(setting => {
                let value = setting.value;
                if (setting.type === 'boolean') {
                    value = value === 'true' || value === true;
                } else if (setting.type === 'json') {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        value = [];
                    }
                }
                maintenanceCache[setting.key] = value;
            });

            lastMaintenanceCheck = now.getTime();
        }

        // Déterminer si la maintenance est active
        let isMaintenanceActive = false;
        let maintenanceMessage = maintenanceCache.message || 'Site en maintenance. Veuillez revenir plus tard.';

        // 1. Maintenance manuelle activée
        if (maintenanceCache.enabled === true) {
            isMaintenanceActive = true;
            console.log('🚧 Maintenance manuelle active');
        }
        
        // 2. Maintenance programmée
        if (maintenanceCache.scheduled_start && maintenanceCache.scheduled_end) {
            const scheduledStart = new Date(maintenanceCache.scheduled_start);
            const scheduledEnd = new Date(maintenanceCache.scheduled_end);
            
            if (now >= scheduledStart && now <= scheduledEnd) {
                isMaintenanceActive = true;
                maintenanceMessage = `Maintenance programmée en cours. Fin prévue à ${scheduledEnd.toLocaleString('fr-FR')}.`;
                console.log('🚧 Maintenance programmée active');
            }
        }

        // Si pas de maintenance, continuer normalement
        if (!isMaintenanceActive) {
            return next();
        }

        // Vérifier les exceptions

        // 1. Utilisateur admin connecté (role_id = 2)
        if (req.session?.user?.role_id === 2) {
            console.log('🛡️ Admin détecté, bypass maintenance');
            
            // Ajouter un header pour notifier l'admin
            res.locals.maintenanceActive = true;
            res.locals.maintenanceMessage = maintenanceMessage;
            
            return next();
        }

        // 2. Routes admin (pour la connexion admin)
        if (req.path.startsWith('/admin') || req.path === '/connexion-inscription') {
            console.log('🔐 Route admin/connexion autorisée pendant maintenance');
            return next();
        }

        // 3. IP autorisées
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const allowedIPs = maintenanceCache.allowed_ips || [];
        
        if (allowedIPs.includes(clientIP)) {
            console.log(`🌐 IP autorisée: ${clientIP}`);
            return next();
        }

        // 4. Routes API essentielles
        if (req.path.startsWith('/api/maintenance') || req.path.startsWith('/api/health')) {
            return next();
        }

        // Bloquer l'accès - afficher page de maintenance
        console.log(`🚧 Accès bloqué pour: ${req.path} (IP: ${clientIP})`);

        // Réponse JSON pour les requêtes AJAX
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(503).json({
                success: false,
                maintenance: true,
                message: maintenanceMessage,
                estimatedEnd: maintenanceCache.scheduled_end || null
            });
        }

        // Page de maintenance HTML
        return res.status(503).render('maintenance', {
            title: 'Site en maintenance',
            message: maintenanceMessage,
            estimatedEnd: maintenanceCache.scheduled_end || null,
            siteName: res.locals.siteName || 'Crystos Jewel'
        });

    } catch (error) {
        console.error('❌ Erreur middleware maintenance:', error);
        
        // En cas d'erreur, laisser passer (éviter de casser le site)
        next();
    }
};

/**
 * Fonction utilitaire pour invalider le cache maintenance
 */
export const invalidateMaintenanceCache = () => {
    maintenanceCache = null;
    lastMaintenanceCheck = null;
    console.log('💨 Cache maintenance invalidé');
};

/**
 * Fonction pour obtenir le statut actuel de la maintenance
 */
export const getMaintenanceStatus = async () => {
    try {
        const settings = await Setting.findAll({
            where: {
                section: 'maintenance'
            }
        });

        const status = {};
        settings.forEach(setting => {
            let value = setting.value;
            if (setting.type === 'boolean') {
                value = value === 'true' || value === true;
            } else if (setting.type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    value = setting.type === 'json' ? [] : setting.value;
                }
            }
            status[setting.key] = value;
        });

        // Déterminer si maintenance active
        const now = new Date();
        let isActive = status.enabled === true;
        
        if (status.scheduled_start && status.scheduled_end) {
            const start = new Date(status.scheduled_start);
            const end = new Date(status.scheduled_end);
            if (now >= start && now <= end) {
                isActive = true;
            }
        }

        return {
            ...status,
            isActive,
            currentTime: now.toISOString()
        };

    } catch (error) {
        console.error('❌ Erreur getMaintenanceStatus:', error);
        return {
            enabled: false,
            isActive: false,
            message: 'Erreur lors de la vérification du statut'
        };
    }
};