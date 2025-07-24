// app/middleware/SettingsMiddleware.js - MODIFIÉ pour inclure la maintenance

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
            
            // MODIFICATION: Récupérer TOUS les paramètres (pas seulement publics)
            const settings = await Setting.findAll();
            
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
        
        // =====================================================
        // NOUVELLE PARTIE: VÉRIFICATION MAINTENANCE
        // =====================================================
        
        // Vérifier la maintenance programmée
        if (settingsCache?.maintenance) {
            const maintenanceSettings = settingsCache.maintenance;
            let maintenanceActive = maintenanceSettings.is_active || false;
            
            // Vérifier si on doit activer/désactiver la maintenance programmée
            if (maintenanceSettings.scheduled_start && maintenanceSettings.scheduled_end) {
                const nowTime = new Date();
                const startTime = new Date(maintenanceSettings.scheduled_start);
                const endTime = new Date(maintenanceSettings.scheduled_end);
                
                // Activer si on est dans la période programmée
                if (nowTime >= startTime && nowTime <= endTime) {
                    if (!maintenanceActive) {
                        console.log('🔧 Activation maintenance programmée');
                        await updateMaintenanceSetting('is_active', true);
                        settingsCache.maintenance.is_active = true;
                        maintenanceActive = true;
                    }
                }
                // Désactiver si la période est terminée
                else if (nowTime > endTime && maintenanceActive) {
                    console.log('✅ Fin maintenance programmée');
                    await updateMaintenanceSetting('is_active', false);
                    await updateMaintenanceSetting('scheduled_start', '');
                    await updateMaintenanceSetting('scheduled_end', '');
                    settingsCache.maintenance.is_active = false;
                    settingsCache.maintenance.scheduled_start = '';
                    settingsCache.maintenance.scheduled_end = '';
                    maintenanceActive = false;
                }
            }
            
            // Si maintenance active et ce n'est pas un admin
            const isAdmin = req.session?.user?.role_id === 2;
            const allowAdminAccess = maintenanceSettings.allow_admin_access !== false;
            
            if (maintenanceActive && !(isAdmin && allowAdminAccess)) {
                // Routes exclues de la maintenance
                const excludedPaths = [
                    '/api/admin/maintenance',
                    '/admin/maintenance',
                    '/api/placeholder',
                    '/api/test',
                    '/public/',
                    '/uploads/',
                    '/favicon.ico',
                    '/maintenance'
                ];
                
                const isExcluded = excludedPaths.some(path => req.path.startsWith(path));
                
                if (!isExcluded) {
                    console.log('🚧 Redirection maintenance pour:', req.path);
                    
                    // Pour les requêtes AJAX/API
                    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                        return res.status(503).json({
                            success: false,
                            message: maintenanceSettings.message || 'Site en maintenance',
                            maintenanceMode: true,
                            scheduledEnd: maintenanceSettings.scheduled_end
                        });
                    }
                    
                    // Pour les requêtes normales, afficher la page de maintenance
                    return res.status(503).render('maintenance', {
                        message: maintenanceSettings.message || 'Site en maintenance. Nous revenons bientôt !',
                        scheduledEnd: maintenanceSettings.scheduled_end,
                        title: 'Maintenance en cours'
                    });
                }
            }
        }
        
        // Injecter dans toutes les vues (SEULEMENT les paramètres publics)
        const publicSettings = {};
        Object.keys(settingsCache || {}).forEach(section => {
            if (section !== 'maintenance') { // Exclure les paramètres de maintenance des vues publiques
                publicSettings[section] = settingsCache[section];
            }
        });
        
        res.locals.siteSettings = publicSettings;
        
        // Variables de commodité
        res.locals.siteName = publicSettings?.company?.company_name || 'Crystos Jewel';
        res.locals.companyEmail = publicSettings?.company?.company_email || 'contact@crystosjewel.com';
        res.locals.companyPhone = publicSettings?.company?.company_phone || '+33 1 23 45 67 89';
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur injection paramètres:', error);
        
        // Valeurs par défaut en cas d'erreur
        res.locals.siteSettings = {};
        res.locals.siteName = 'Crystos Jewel';
        res.locals.companyEmail = 'contact@crystosjewel.com';
        res.locals.companyPhone = '+33 1 23 45 67 89';
        
        next();
    }
};

// Fonction utilitaire pour mettre à jour un paramètre de maintenance
async function updateMaintenanceSetting(key, value) {
    try {
        await Setting.updateOrCreate('maintenance', key, value);
        global.settingsCacheExpired = true; // Forcer le rechargement du cache
    } catch (error) {
        console.error(`❌ Erreur mise à jour paramètre maintenance ${key}:`, error);
    }
}