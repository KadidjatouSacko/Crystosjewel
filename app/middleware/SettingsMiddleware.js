
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
            
            // Récupérer TOUS les paramètres
            const settings = await Setting.findAll();
            
            settingsCache = {};
            settings.forEach(setting => {
                if (!settingsCache[setting.section]) {
                    settingsCache[setting.section] = {};
                }
                
                let value = setting.value;
                
                // ✅ CORRECTION: Meilleur parsing des types
                if (setting.type === 'boolean') {
                    // Gérer tous les cas possibles
                    value = value === 'true' || value === true || value === 'on' || value === '1' || value === 1;
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
        // VÉRIFICATION MAINTENANCE PROGRAMMÉE
        // =====================================================
        

        // Variables de commodité
        res.locals.siteName = settingsCache?.company?.company_name || 'Crystos Jewel';
        res.locals.companyEmail = settingsCache?.company?.company_email || 'contact@crystosjewel.com';
        res.locals.companyPhone = settingsCache?.company?.company_phone || '+33 1 23 45 67 89';
        
        // *** FIX CRITIQUE: S'assurer que maintenanceActive est toujours défini ***
        res.locals.maintenanceActive = settingsCache?.maintenance?.maintenanceActive || false;

        if (settingsCache?.maintenance) {
            const maintenanceSettings = settingsCache.maintenance;

            let maintenanceActive = Boolean(maintenanceSettings.is_active);

            
            // Vérifier si on doit activer/désactiver la maintenance programmée
            if (maintenanceSettings.scheduled_start && maintenanceSettings.scheduled_end) {
                const nowTime = new Date();
                const startTime = new Date(maintenanceSettings.scheduled_start);
                const endTime = new Date(maintenanceSettings.scheduled_end);
                
                // Activer si on est dans la période programmée
                if (nowTime >= startTime && nowTime <= endTime && !maintenanceActive) {
                    console.log('🔧 Activation maintenance programmée');
                    await updateMaintenanceSetting('is_active', true);
                    settingsCache.maintenance.is_active = true;
                    maintenanceActive = true;
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
            
            // VÉRIFICATION ADMIN - MÉTHODE ROBUSTE
            let isAdmin = false;
            if (req.session?.user) {
                // Vérifier le role_id OU la propriété isAdmin
                isAdmin = req.session.user.role_id === 2 || req.session.user.isAdmin === true;
            }

            console.log('🔍 Vérification maintenance:', {
    maintenanceActive,
    maintenanceActiveRaw: maintenanceSettings.is_active,
    maintenanceActiveType: typeof maintenanceSettings.is_active,
    isAdmin,
    path: req.path,
    userId: req.session?.user?.id,
    roleId: req.session?.user?.role_id
});
            const allowAdminAccess = maintenanceSettings.allow_admin_access !== false;
            
            // Routes TOUJOURS exclues de la maintenance
            const excludedPaths = [
                '/api/admin/maintenance',
                '/admin/maintenance',
                '/admin/parametres',
                '/admin/stats',
                '/admin/',
                '/api/admin/',
                '/api/placeholder',
                '/api/test',
                '/public/',
                '/uploads/',
                '/favicon.ico',
                '/maintenance/emergency-disable',
                '/connexion-inscription',
                '/api/bijoux/sante'
            ];
            
            const isExcludedPath = excludedPaths.some(path => req.path.startsWith(path));
            
            // Si maintenance active ET que ce n'est pas un admin autorisé ET que la route n'est pas exclue
            if (maintenanceActive && !isExcludedPath && !(isAdmin && allowAdminAccess)) {
                console.log('🚧 Redirection maintenance pour:', req.path, 'isAdmin:', isAdmin);
                
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
        
        // Injecter SEULEMENT les paramètres publics dans les vues (exclure maintenance)
        const publicSettings = {};
        Object.keys(settingsCache || {}).forEach(section => {
            if (section !== 'maintenance') { // Maintenance reste privée
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

        
        // *** FIX CRITIQUE: Toujours définir maintenanceActive ***
        res.locals.maintenanceActive = false;

        
        next();
    }
    let isAdmin = false;
if (req.session?.user) {
    // Debug complet
    console.log('🔍 DEBUG SESSION COMPLÈTE:', {
        hasSession: !!req.session,
        hasUser: !!req.session.user,
        userKeys: req.session.user ? Object.keys(req.session.user) : 'N/A',
        userId: req.session.user?.id,
        email: req.session.user?.email,
        role_id: req.session.user?.role_id,
        isAdminProp: req.session.user?.isAdmin,
        typeOfRoleId: typeof req.session.user?.role_id,
        valueOfRoleId: req.session.user?.role_id
    });
    
    // Vérifier le role_id OU la propriété isAdmin
    isAdmin = req.session.user.role_id === 2 || req.session.user.isAdmin === true;
}

console.log('🔍 Vérification maintenance:', {
    maintenanceActive,
    isAdmin,
    path: req.path,
    userId: req.session?.user?.id,
    roleId: req.session?.user?.role_id,
    sessionExists: !!req.session,
    userExists: !!req.session?.user
});
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

// Fonction utilitaire pour mettre à jour un paramètre de maintenance
async function updateMaintenanceSetting(key, value) {
    try {
        await Setting.updateOrCreate('maintenance', key, value);
        global.settingsCacheExpired = true; // Forcer le rechargement du cache
    } catch (error) {
        console.error(`❌ Erreur mise à jour paramètre maintenance ${key}:`, error);
    }
}


