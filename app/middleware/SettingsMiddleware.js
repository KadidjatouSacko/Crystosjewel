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
            
            try {
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
            } catch (dbError) {
                console.log('⚠️ Erreur accès DB pour settings, utilisation valeurs par défaut');
                settingsCache = {
                    maintenance: { enabled: false },
                    company: { company_name: 'CrystosJewel' }
                };
            }
        }
        
        // *** FIX CRITIQUE: Définir maintenanceActive avant toute utilisation ***
        const maintenanceActive = settingsCache?.maintenance?.enabled || false;
        
        // VÉRIFICATION ADMIN - MÉTHODE ROBUSTE
        let isAdmin = false;
        if (req.session?.user) {
            // Vérifier le role_id OU la propriété isAdmin
            isAdmin = req.session.user.role_id === 2 || req.session.user.isAdmin === true;
        }

        console.log('🔍 Vérification maintenance:', {
            maintenanceActive,
            isAdmin,
            path: req.path,
            userId: req.session?.user?.id,
            roleId: req.session?.user?.role_id
        });
        
        // Debug session seulement si on a une session
        if (req.session?.user) {
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
        }
        
        // Éviter les doubles réponses
        if (res.headersSent) {
            return next();
        }
        
        // Gestion de la maintenance
        if (maintenanceActive && !isAdmin) {
            const excludedPaths = [
                '/admin',
                '/api/admin',
                '/connexion-inscription',
                '/css',
                '/js',
                '/images',
                '/uploads',
                '/favicon'
            ];
            
            const isExcludedPath = excludedPaths.some(path => req.path.startsWith(path));
            
            if (!isExcludedPath) {
                // Pour les requêtes AJAX/API
                if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                    return res.status(503).json({
                        success: false,
                        message: 'Site en maintenance',
                        maintenanceMode: true
                    });
                }
                
                // Pour les requêtes normales, afficher la page de maintenance
                try {
                    return res.status(503).render('maintenance', {
                        message: 'Site en maintenance. Nous revenons bientôt !',
                        title: 'Maintenance en cours'
                    });
                } catch (renderError) {
                    return res.status(503).send(`
                        <h1>Site en maintenance</h1>
                        <p>Nous revenons bientôt !</p>
                    `);
                }
            }
        }
        
        // Variables pour les vues
        res.locals.siteName = settingsCache?.company?.company_name || 'CrystosJewel';
        res.locals.companyEmail = settingsCache?.company?.company_email || 'contact@crystosjewel.com';
        res.locals.companyPhone = settingsCache?.company?.company_phone || '+33 1 23 45 67 89';
        res.locals.maintenanceActive = maintenanceActive;
        res.locals.siteSettings = settingsCache || {};
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur injection paramètres:', error);
        
        // Éviter les doubles réponses
        if (res.headersSent) {
            return next();
        }
        
        // Valeurs par défaut en cas d'erreur
        res.locals.siteSettings = {};
        res.locals.siteName = 'CrystosJewel';
        res.locals.companyEmail = 'contact@crystosjewel.com';
        res.locals.companyPhone = '+33 1 23 45 67 89';
        res.locals.maintenanceActive = false;
        
        next();
    }
};

// Middleware spécifique pour la vérification de maintenance
export const checkMaintenanceMode = async (req, res, next) => {
    try {
        // Éviter les doubles réponses
        if (res.headersSent) {
            return next();
        }
        
        const maintenanceActive = res.locals.maintenanceActive || false;
        const isAdmin = res.locals.isAdmin || false;
        
        if (maintenanceActive && !isAdmin && req.path !== '/maintenance') {
            return res.redirect('/maintenance');
        }
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur vérification maintenance:', error);
        next();
    }
};