// app/controlleurs/MaintenanceController.js

import Setting from '../models/SettingModel.js';
import { invalidateMaintenanceCache } from '../middleware/MaintenanceMiddleware.js';

export const maintenanceController = {
    
    /**
     * Afficher la page de maintenance
     */
    showMaintenancePage: async (req, res) => {
        try {
            console.log('🚧 Page de maintenance demandée');
            
            // Récupérer le message personnalisé de maintenance
            const messageSettings = await Setting.findAll({
                where: { section: 'maintenance' }
            });
            
            const settings = {};
            messageSettings.forEach(setting => {
                settings[setting.key] = setting.value;
            });
            
            const maintenanceMessage = settings.message || 
                'Nous effectuons actuellement une maintenance pour améliorer votre expérience. Merci de votre patience !';
            
            // Données pour le template
            const templateData = {
                title: 'Site en maintenance | Crystos Jewel',
                message: maintenanceMessage,
                scheduledEnd: settings.scheduled_end || null,
                user: req.session?.user || null,
                isAuthenticated: !!req.session?.user,
                isAdmin: req.session?.user?.role_id === 2,
                cartItemCount: 0, // Pas de panier en maintenance
                siteSettings: res.locals.siteSettings || {},
                siteName: res.locals.siteName || 'Crystos Jewel',
                companyEmail: res.locals.companyEmail || 'contact@crystosjewel.com',
                companyPhone: res.locals.companyPhone || '+33 1 23 45 67 89'
            };
            
            res.render('maintenance', templateData);
            
        } catch (error) {
            console.error('❌ Erreur page maintenance:', error);
            // Page de maintenance de secours en HTML pur
            res.status(500).send(`
                <!DOCTYPE html>
                <html lang="fr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Maintenance - Crystos Jewel</title>
                    <style>
                        body { 
                            font-family: 'Segoe UI', sans-serif; 
                            text-align: center; 
                            padding: 50px; 
                            background: linear-gradient(135deg, #b76e79 0%, #8a5465 100%);
                            color: white;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .maintenance { 
                            background: rgba(255,255,255,0.1); 
                            padding: 40px; 
                            border-radius: 15px; 
                            max-width: 500px; 
                            backdrop-filter: blur(10px);
                        }
                        h1 { margin-bottom: 20px; }
                        .icon { font-size: 4rem; margin-bottom: 20px; }
                    </style>
                </head>
                <body>
                    <div class="maintenance">
                        <div class="icon">🔧</div>
                        <h1>Site en maintenance</h1>
                        <p>Nous effectuons actuellement une maintenance technique.</p>
                        <p>Merci de votre patience !</p>
                        <hr style="margin: 20px 0; opacity: 0.3;">
                        <p><strong>Contact :</strong> contact@crystosjewel.com</p>
                    </div>
                </body>
                </html>
            `);
        }
    },

    /**
     * Activer/désactiver la maintenance (API)
     */
    toggleMaintenance: async (req, res) => {
        try {
            const { enabled, message, allowAdminAccess } = req.body;
            
            console.log('🔧 Toggle maintenance:', { enabled, message, allowAdminAccess });
            
            // Mettre à jour les paramètres en base
            const updates = [
                { key: 'is_active', value: enabled ? 'true' : 'false', type: 'boolean' },
                { key: 'allow_admin_access', value: allowAdminAccess !== false ? 'true' : 'false', type: 'boolean' }
            ];
            
            if (message) {
                updates.push({ key: 'message', value: message, type: 'string' });
            }
            
            // Sauvegarder chaque paramètre
            for (const update of updates) {
                await Setting.setSetting('maintenance', update.key, update.value, update.type);
            }
            
            // Invalider le cache pour effet immédiat
            invalidateMaintenanceCache();
            
            console.log(`🚧 Mode maintenance ${enabled ? 'activé' : 'désactivé'}`);
            
            res.json({
                success: true,
                message: `Mode maintenance ${enabled ? 'activé' : 'désactivé'}`,
                enabled: enabled,
                allowAdminAccess: allowAdminAccess !== false
            });
            
        } catch (error) {
            console.error('❌ Erreur toggle maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la modification du mode maintenance',
                error: error.message
            });
        }
    },

    /**
     * Obtenir le statut de la maintenance (API)
     */
    getMaintenanceStatus: async (req, res) => {
        try {
            const maintenanceSettings = await Setting.findAll({
                where: { section: 'maintenance' }
            });

            const settings = {};
            maintenanceSettings.forEach(setting => {
                let value = setting.value;
                if (setting.type === 'boolean') {
                    value = value === 'true' || value === 'on' || value === true;
                }
                settings[setting.key] = value;
            });

            res.json({
                success: true,
                maintenance: {
                    isActive: settings.is_active || false,
                    allowAdminAccess: settings.allow_admin_access !== false,
                    message: settings.message || 'Site en maintenance',
                    scheduledEnd: settings.scheduled_end || null
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Erreur statut maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la vérification du statut',
                maintenance: { isActive: false } // Mode sécurisé
            });
        }
    },

    /**
     * Programmer une maintenance (optionnel)
     */
    scheduleMaintenance: async (req, res) => {
        try {
            const { scheduledStart, scheduledEnd, message } = req.body;
            
            const updates = [];
            
            if (scheduledStart) {
                updates.push({ key: 'scheduled_start', value: scheduledStart, type: 'string' });
            }
            
            if (scheduledEnd) {
                updates.push({ key: 'scheduled_end', value: scheduledEnd, type: 'string' });
            }
            
            if (message) {
                updates.push({ key: 'message', value: message, type: 'string' });
            }
            
            // Sauvegarder
            for (const update of updates) {
                await Setting.setSetting('maintenance', update.key, update.value, update.type);
            }
            
            invalidateMaintenanceCache();
            
            res.json({
                success: true,
                message: 'Maintenance programmée avec succès'
            });
            
        } catch (error) {
            console.error('❌ Erreur programmation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la programmation',
                error: error.message
            });
        }
    }
};