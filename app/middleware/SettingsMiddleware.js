// app/middleware/SettingsMiddleware.js - VERSION CORRIGÉE

import Setting from '../models/SettingModel.js';

let settingsCache = null;
let lastUpdate = null;


export const injectSiteSettings = async (req, res, next) => {
    try {
        // Rafraîchir le cache toutes les 5 minutes OU si invalidé manuellement
        const now = Date.now();
        const shouldRefresh = !settingsCache || 
                             !lastUpdate || 
                             (now - lastUpdate) > 300000 || 
                             global.settingsCacheExpired;

        if (shouldRefresh) {
            console.log('🔄 Rechargement du cache des paramètres...');
            
            const settings = await Setting.findAll({
                where: { is_public: true }
            });
            
            settingsCache = {};
            settings.forEach(setting => {
                if (!settingsCache[setting.section]) {
                    settingsCache[setting.section] = {};
                }
                
                let value = setting.value;
                if (setting.type === 'boolean') {
                    value = value === 'true' || value === true;
                } else if (setting.type === 'number') {
                    value = parseFloat(value);
                }
                
                settingsCache[setting.section][setting.key] = value;
            });
            
            lastUpdate = now;
            global.settingsCacheExpired = false;
            
            console.log('✅ Cache paramètres rechargé:', Object.keys(settingsCache));
        }
        
        // Injecter dans toutes les vues
        res.locals.siteSettings = settingsCache || {};
        
        // Variables de commodité
        res.locals.siteName = settingsCache?.company?.company_name || 'Crystos Jewel';
        res.locals.companyEmail = settingsCache?.company?.company_email || 'contact@crystosjewel.com';
        res.locals.companyPhone = settingsCache?.company?.company_phone || '+33 1 23 45 67 89';
        
        // *** FIX CRITIQUE: S'assurer que maintenanceActive est toujours défini ***
        res.locals.maintenanceActive = settingsCache?.maintenance?.maintenanceActive || false;
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur injection paramètres:', error);
        
        // Valeurs par défaut en cas d'erreur
        res.locals.siteSettings = {};
        res.locals.siteName = 'Crystos Jewel';
        res.locals.companyEmail = 'contact@crystosjewel.com';
        res.locals.companyPhone = '+33 1 23 45 67 89';
        
        // *** FIX CRITIQUE: Toujours définir maintenanceActive ***
        res.locals.maintenanceActive = false;
        
        next();
    }
};

// *** NOUVEAU: Middleware spécifique pour la vérification de maintenance ***
export const checkMaintenanceMode = async (req, res, next) => {
    try {
        console.log('🔍 Vérification maintenance:', {
            maintenanceActive: res.locals.maintenanceActive,
            maintenanceActiveRaw: res.locals.siteSettings?.maintenance?.maintenanceActive,
            maintenanceActiveType: typeof res.locals.siteSettings?.maintenance?.maintenanceActive,
            isAdmin: res.locals.isAdmin,
            path: req.path,
            userId: req.session?.user?.id,
            roleId: req.session?.user?.role_id
        });

        // Si maintenanceActive n'est pas encore défini, aller le chercher
        if (typeof res.locals.maintenanceActive === 'undefined') {
            console.log('🔄 Vérification statut maintenance...');
            
            const maintenanceSettings = await Setting.findAll({
                where: { section: 'maintenance' }
            });
            
            const maintenanceSetting = maintenanceSettings.find(s => s.key === 'maintenanceActive');
            const isMaintenanceActive = maintenanceSetting ? 
                (maintenanceSetting.value === 'true' || maintenanceSetting.value === true) : 
                false;
            
            res.locals.maintenanceActive = isMaintenanceActive;
            
            console.log('🔧 Statut maintenance récupéré:', isMaintenanceActive);
        }

        // Vérifier si le mode maintenance est activé
        if (res.locals.maintenanceActive === true) {
            // Permettre l'accès aux admins
            if (res.locals.isAdmin) {
                console.log('✅ Admin détecté - accès autorisé malgré la maintenance');
                return next();
            }

            // Permettre l'accès à la page de maintenance elle-même
            if (req.path === '/maintenance') {
                return next();
            }

            // Rediriger vers la page de maintenance
            console.log('🚧 Mode maintenance actif - redirection');
            return res.redirect('/maintenance');
        }

        // Mode maintenance désactivé - continuer
        next();
        
    } catch (error) {
        console.error('❌ Erreur vérification maintenance:', error);
        
        // En cas d'erreur, désactiver la maintenance et continuer
        res.locals.maintenanceActive = false;
        next();
    }
};