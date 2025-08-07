export const maintenanceCheck = (req, res, next) => {
    try {
        console.log('🔍 Vérification maintenance:', {
            maintenanceActive: global.maintenanceMode || false,
            isAdmin: req.session?.user?.role_id === 2,
            path: req.path,
            userId: req.session?.user?.id,
            roleId: req.session?.user?.role_id
        });

        // Vérifier si le site est en maintenance
        const maintenanceMode = global.maintenanceMode || false;
        const scheduledMaintenance = global.scheduledMaintenance || null;
        
        // Vérifier la maintenance programmée
        if (scheduledMaintenance && new Date() >= new Date(scheduledMaintenance)) {
            global.maintenanceMode = true;
            global.scheduledMaintenance = null;
            console.log('🔧 Maintenance programmée activée automatiquement');
        }
        
        // ✅ Si pas en maintenance, continuer normalement
        if (!global.maintenanceMode) {
            console.log('✅ Pas de maintenance active, accès normal');
            return next();
        }
        
        // ✅ TOUJOURS PERMETTRE L'ACCÈS À CES PAGES (même en maintenance)
        const allowedPaths = [
            '/connexion-inscription',
            '/connexion', 
            '/inscription',
            '/api/auth/login',
            '/api/auth/register',
            '/login',
            '/register',
            '/maintenance'
        ];
        
        const allowedStatic = [
            '/css/',
            '/js/',
            '/images/',
            '/public/',
            '/favicon.ico'
        ];
        
        // Vérifier les chemins autorisés
        if (allowedPaths.includes(req.path) || 
            allowedStatic.some(path => req.path.startsWith(path))) {
            console.log('✅ Chemin autorisé pendant maintenance:', req.path);
            return next();
        }
        
        // ✅ Permettre l'accès aux admins connectés (role_id = 2)
        if (req.session?.user?.role_id === 2) {
            console.log('👑 Admin autorisé pendant la maintenance');
            return next();
        }
        
        // ✅ Permettre l'accès aux routes API de maintenance pour les admins
        if (req.path.startsWith('/api/maintenance')) {
            if (req.session?.user?.role_id === 2) {
                console.log('🔧 API maintenance autorisée pour admin');
                return next();
            } else {
                console.log('❌ API maintenance refusée pour non-admin');
                return res.status(403).json({
                    success: false,
                    message: 'Accès administrateur requis'
                });
            }
        }
        
        console.log('🚫 Redirection vers maintenance pour:', req.path);
        
        // Rediriger tous les autres utilisateurs vers la page de maintenance
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(503).json({
                success: false,
                message: 'Site en maintenance',
                maintenanceMode: true
            });
        }
        
        return res.redirect('/maintenance');
        
    } catch (error) {
        console.error('❌ Erreur middleware maintenance:', error);
        next();
    }
};

export const maintenanceMiddleware = async (req, res, next) => {
    try {
        // Routes toujours autorisées (même en maintenance)
        const allowedPaths = [
            '/css',           // Ressources CSS
            '/js',            // Ressources JS
            '/images',        // Images
            '/uploads',       // Uploads
            '/favicon',       // Favicon
            '/connexion-inscription',  // Page de connexion
            '/login',         // Alternative login
            '/auth/login',    // API login
            '/deconnexion',   // Déconnexion
            '/admin/maintenance', // Gestion maintenance
            '/api/maintenance'    // API maintenance
        ];
        
        // Vérifier si la route est autorisée
        const isAllowedPath = allowedPaths.some(path => req.path.startsWith(path));
        
        // Vérifier si c'est un admin connecté (role_id = 2)
        const isAdmin = req.session?.user?.role_id === 2;
        
        // IMPORTANT: Initialiser les variables globales si elles n'existent pas
        if (global.maintenanceMode === undefined) {
            await initMaintenanceFromDatabase();
        }
        
        // Vérifier si la maintenance a expiré
        if (global.maintenanceMode && global.maintenanceData?.endTime) {
            const now = new Date();
            const endTime = new Date(global.maintenanceData.endTime);
            
            if (now > endTime) {
                console.log('⏰ Maintenance expirée, désactivation automatique...');
                global.maintenanceMode = false;
                global.maintenanceData = null;
                
                // Mettre à jour en base
                await SiteSetting.update(
                    { setting_value: 'false' },
                    { where: { setting_key: 'maintenance_mode' } }
                );
            }
        }
        
        // Autoriser l'accès si :
        // - Route autorisée OU
        // - Admin connecté OU  
        // - Maintenance désactivée
        if (isAllowedPath || isAdmin || !global.maintenanceMode) {
            return next();
        }
        
        // Sinon, afficher la page de maintenance
        const maintenanceData = global.maintenanceData || {
            message: 'Site en maintenance',
            startTime: new Date(),
            endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h par défaut
            duration: 2,
            unit: 'hours'
        };
        
        return res.render('maintenance', {
            title: 'Maintenance en cours',
            maintenanceData,
            user: null,
            isAuthenticated: false,
            isAdmin: false
        });
        
    } catch (error) {
        console.error('❌ Erreur middleware maintenance:', error);
        // En cas d'erreur, laisser passer pour éviter de casser le site
        next();
    }
};

// Fonction pour initialiser les paramètres de maintenance depuis la base
async function initMaintenanceFromDatabase() {
    try {
        const maintenanceMode = await SiteSetting.findOne({
            where: { setting_key: 'maintenance_mode' }
        });
        
        if (maintenanceMode && maintenanceMode.setting_value === 'true') {
            // Récupérer tous les paramètres de maintenance
            const settings = await SiteSetting.findAll({
                where: {
                    setting_key: [
                        'maintenance_end_time',
                        'maintenance_start_time', 
                        'maintenance_message',
                        'maintenance_duration',
                        'maintenance_unit'
                    ]
                }
            });
            
            const settingsObj = {};
            settings.forEach(s => {
                settingsObj[s.setting_key] = s.setting_value;
            });
            
            global.maintenanceMode = true;
            global.maintenanceData = {
                startTime: new Date(settingsObj.maintenance_start_time),
                endTime: new Date(settingsObj.maintenance_end_time),
                message: settingsObj.maintenance_message || 'Maintenance en cours...',
                duration: parseInt(settingsObj.maintenance_duration) || 2,
                unit: settingsObj.maintenance_unit || 'hours',
                adminBypass: true
            };
            
            console.log('🔧 Paramètres de maintenance restaurés depuis la base');
        } else {
            global.maintenanceMode = false;
            global.maintenanceData = null;
        }
        
    } catch (error) {
        console.error('❌ Erreur initialisation maintenance:', error);
        global.maintenanceMode = false;
        global.maintenanceData = null;
    }
}