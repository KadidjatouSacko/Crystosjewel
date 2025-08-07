// app/controlleurs/maintenanceController.js

import Setting from '../models/SettingModel.js';
// import { invalidateMaintenanceCache, getMaintenanceStatus } from '../middleware/MaintenanceMiddleware.js';

/**
 * Contrôleur pour la gestion de la maintenance du site
 */
export const maintenanceController = {

    /**
     * Page d'administration de la maintenance
     */
    async renderAdminPage(req, res) {
        try {
            console.log('🔧 Chargement page admin maintenance');

            // Récupérer le statut actuel
            const status = await getMaintenanceStatus();

            // Messages flash
            const flashMessages = [];
            if (req.session.flashMessage) {
                flashMessages.push(req.session.flashMessage);
                delete req.session.flashMessage;
            }

            res.render('admin/maintenance', {
                title: 'Gestion de la Maintenance',
                maintenance: status,
                flashMessages,
                user: req.session.user,
                currentTime: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Erreur page admin maintenance:', error);
            
            req.session.flashMessage = {
                type: 'error',
                message: 'Erreur lors du chargement de la page de maintenance'
            };
            
            res.redirect('/admin');
        }
    },

    /**
     * Activer/désactiver la maintenance immédiatement
     */
    async toggleMaintenance(req, res) {
        try {
            const { enabled } = req.body;
            const isEnabled = enabled === true || enabled === 'true';

            console.log(`🔧 ${isEnabled ? 'Activation' : 'Désactivation'} maintenance immédiate`);

            // Sauvegarder le paramètre
            await Setting.setValue('maintenance', 'enabled', isEnabled, 'boolean', 
                'Maintenance manuelle activée/désactivée');

            // Si on désactive, nettoyer aussi la programmation
            if (!isEnabled) {
                await Setting.setValue('maintenance', 'scheduled_start', null, 'string');
                await Setting.setValue('maintenance', 'scheduled_end', null, 'string');
            }

            // Invalider le cache
            const status = { isActive: false, message: 'Maintenance désactivée' };;

            // Log et notification
            const message = isEnabled ? 
                'Maintenance activée immédiatement' : 
                'Maintenance désactivée';

            console.log(`✅ ${message}`);

            // Réponse JSON
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.json({
                    success: true,
                    message,
                    enabled: isEnabled,
                    timestamp: new Date().toISOString()
                });
            }

            // Réponse formulaire
            req.session.flashMessage = {
                type: 'success',
                message
            };

            res.redirect('/admin/maintenance');

        } catch (error) {
            console.error('❌ Erreur toggle maintenance:', error);

            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la modification du statut'
                });
            }

            req.session.flashMessage = {
                type: 'error',
                message: 'Erreur lors de la modification du statut de maintenance'
            };

            res.redirect('/admin/maintenance');
        }
    },

    /**
     * Programmer la maintenance
     */
    async scheduleMaintenance(req, res) {
        try {
            const { scheduled_start, scheduled_end, message } = req.body;

            console.log('📅 Programmation maintenance:', { scheduled_start, scheduled_end });

            // Validation des dates
            if (!scheduled_start || !scheduled_end) {
                throw new Error('Dates de début et fin requises');
            }

            const startDate = new Date(scheduled_start);
            const endDate = new Date(scheduled_end);
            const now = new Date();

            if (startDate <= now) {
                throw new Error('La date de début doit être dans le futur');
            }

            if (endDate <= startDate) {
                throw new Error('La date de fin doit être après la date de début');
            }

            // Sauvegarder les paramètres
            await Setting.setValue('maintenance', 'scheduled_start', 
                startDate.toISOString(), 'string', 'Date/heure de début de maintenance programmée');
            
            await Setting.setValue('maintenance', 'scheduled_end', 
                endDate.toISOString(), 'string', 'Date/heure de fin de maintenance programmée');

            if (message) {
                await Setting.setValue('maintenance', 'message', 
                    message, 'string', 'Message affiché pendant la maintenance');
            }

            // Désactiver la maintenance manuelle si elle était active
            await Setting.setValue('maintenance', 'enabled', false, 'boolean');

            // Invalider le cache
            const status = { isActive: false, message: 'Maintenance désactivée' };;

            const successMessage = `Maintenance programmée du ${startDate.toLocaleString('fr-FR')} au ${endDate.toLocaleString('fr-FR')}`;
            console.log(`✅ ${successMessage}`);

            // Réponse JSON
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.json({
                    success: true,
                    message: successMessage,
                    scheduled_start: startDate.toISOString(),
                    scheduled_end: endDate.toISOString()
                });
            }

            // Réponse formulaire
            req.session.flashMessage = {
                type: 'success',
                message: successMessage
            };

            res.redirect('/admin/maintenance');

        } catch (error) {
            console.error('❌ Erreur programmation maintenance:', error);

            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            req.session.flashMessage = {
                type: 'error',
                message: error.message
            };

            res.redirect('/admin/maintenance');
        }
    },

    /**
     * Annuler la maintenance programmée
     */
    async cancelScheduledMaintenance(req, res) {
        try {
            console.log('❌ Annulation maintenance programmée');

            // Supprimer les paramètres de programmation
            await Setting.setValue('maintenance', 'scheduled_start', null, 'string');
            await Setting.setValue('maintenance', 'scheduled_end', null, 'string');
            await Setting.setValue('maintenance', 'enabled', false, 'boolean');

            // Invalider le cache
            const status = { isActive: false, message: 'Maintenance désactivée' };;

            const message = 'Maintenance programmée annulée';
            console.log(`✅ ${message}`);

            // Réponse JSON
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.json({
                    success: true,
                    message
                });
            }

            // Réponse formulaire
            req.session.flashMessage = {
                type: 'success',
                message
            };

            res.redirect('/admin/maintenance');

        } catch (error) {
            console.error('❌ Erreur annulation maintenance:', error);

            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de l\'annulation'
                });
            }

            req.session.flashMessage = {
                type: 'error',
                message: 'Erreur lors de l\'annulation de la maintenance'
            };

            res.redirect('/admin/maintenance');
        }
    },

    /**
     * Mettre à jour le message de maintenance
     */
    async updateMessage(req, res) {
        try {
            const { message } = req.body;

            console.log('💬 Mise à jour message maintenance');

            await Setting.setValue('maintenance', 'message', 
                message || 'Site en maintenance. Veuillez revenir plus tard.', 
                'string', 'Message affiché pendant la maintenance');

            // Invalider le cache
            const status = { isActive: false, message: 'Maintenance désactivée' };;

            const successMessage = 'Message de maintenance mis à jour';
            console.log(`✅ ${successMessage}`);

            // Réponse JSON
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.json({
                    success: true,
                    message: successMessage
                });
            }

            // Réponse formulaire
            req.session.flashMessage = {
                type: 'success',
                message: successMessage
            };

            res.redirect('/admin/maintenance');

        } catch (error) {
            console.error('❌ Erreur mise à jour message:', error);

            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la mise à jour du message'
                });
            }

            req.session.flashMessage = {
                type: 'error',
                message: 'Erreur lors de la mise à jour du message'
            };

            res.redirect('/admin/maintenance');
        }
    },

    /**
     * API pour obtenir le statut de maintenance
     */
    async getStatus(req, res) {
        try {
            const status = await getMaintenanceStatus();
            
            res.json({
                success: true,
                data: status
            });

        } catch (error) {
            console.error('❌ Erreur API statut maintenance:', error);
            
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du statut'
            });
        }
    },

    /**
     * Gérer les IPs autorisées
     */
    async updateAllowedIPs(req, res) {
        try {
            const { allowed_ips } = req.body;
            
            // Parser et valider les IPs
            let ips = [];
            if (typeof allowed_ips === 'string') {
                ips = allowed_ips.split(',').map(ip => ip.trim()).filter(ip => ip);
            } else if (Array.isArray(allowed_ips)) {
                ips = allowed_ips;
            }

            console.log('🌐 Mise à jour IPs autorisées:', ips);

            await Setting.setValue('maintenance', 'allowed_ips', 
                ips, 'json', 'Adresses IP autorisées pendant la maintenance');

            // Invalider le cache
            const status = { isActive: false, message: 'Maintenance désactivée' };;

            const message = `${ips.length} adresse(s) IP autorisée(s)`;
            console.log(`✅ ${message}`);

            // Réponse JSON
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.json({
                    success: true,
                    message,
                    allowed_ips: ips
                });
            }

            // Réponse formulaire
            req.session.flashMessage = {
                type: 'success',
                message
            };

            res.redirect('/admin/maintenance');

        } catch (error) {
            console.error('❌ Erreur IPs autorisées:', error);

            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la mise à jour des IPs'
                });
            }

            req.session.flashMessage = {
                type: 'error',
                message: 'Erreur lors de la mise à jour des IPs autorisées'
            };

            res.redirect('/admin/maintenance');
        }
    },
 // Page de maintenance pour les visiteurs
   showMaintenancePage: (req, res) => {
        console.log('🔧 Affichage page maintenance pour:', {
            isAdmin: req.session?.user?.role_id === 2,
            userId: req.session?.user?.id,
            maintenanceActive: global.maintenanceMode || false
        });

        const estimatedDuration = global.maintenanceEstimatedEnd || null;
        const message = global.maintenanceMessage || 'Site temporairement indisponible pour maintenance.';
        
        res.render('maintenance', {
            title: 'Maintenance en cours',
            message,
            estimatedDuration,
            user: req.session?.user || null,
            isAdmin: req.session?.user?.role_id === 2,
            isAuthenticated: !!req.session?.user
        });
    },
    
    
    // API: Activer la maintenance (instantané)
    activateMaintenance: (req, res) => {
        try {
            const { message, estimatedDuration } = req.body;
            
            global.maintenanceMode = true;
            global.maintenanceMessage = message || 'Site en maintenance. Nous reviendrons bientôt !';
            global.maintenanceEstimatedEnd = estimatedDuration || null;
            global.scheduledMaintenance = null; // Annuler toute maintenance programmée
            
            console.log('🔧 Maintenance activée immédiatement par admin:', req.session.user.email);
            
            res.json({
                success: true,
                message: 'Maintenance activée',
                status: {
                    active: true,
                    message: global.maintenanceMessage,
                    estimatedEnd: global.maintenanceEstimatedEnd
                }
            });
            
        } catch (error) {
            console.error('❌ Erreur activation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'activation de la maintenance'
            });
        }
    },
    
    // API: Programmer la maintenance
    scheduleMaintenance: (req, res) => {
        try {
            const { scheduledTime, message, estimatedDuration } = req.body;
            
            if (!scheduledTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Heure de maintenance requise'
                });
            }
            
            const scheduledDate = new Date(scheduledTime);
            if (scheduledDate <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'L\'heure de maintenance doit être dans le futur'
                });
            }
            
            global.scheduledMaintenance = scheduledDate.toISOString();
            global.maintenanceMessage = message || 'Maintenance programmée en cours';
            global.maintenanceEstimatedEnd = estimatedDuration || null;
            
            console.log('⏰ Maintenance programmée pour:', scheduledDate, 'par admin:', req.session.user.email);
            
            res.json({
                success: true,
                message: `Maintenance programmée pour ${scheduledDate.toLocaleString('fr-FR')}`,
                scheduledFor: scheduledDate.toISOString()
            });
            
        } catch (error) {
            console.error('❌ Erreur programmation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la programmation'
            });
        }
    },
    
    // API: Désactiver la maintenance
    deactivateMaintenance: (req, res) => {
        try {
            global.maintenanceMode = false;
            global.maintenanceMessage = null;
            global.maintenanceEstimatedEnd = null;
            global.scheduledMaintenance = null;
            
            console.log('✅ Maintenance désactivée par admin:', req.session.user.email);
            
            res.json({
                success: true,
                message: 'Maintenance désactivée',
                status: {
                    active: false
                }
            });
            
        } catch (error) {
            console.error('❌ Erreur désactivation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la désactivation'
            });
        }
    },
    
   async getMaintenanceStatus(req, res) {
        try {
            console.log('📊 Statut maintenance demandé par:', {
                isAdmin: req.session?.user?.role_id === 2,
                userId: req.session?.user?.id
            });

            res.json({
                success: true,
                status: {
                    active: global.maintenanceMode || false,
                    message: global.maintenanceMessage || null,
                    estimatedEnd: global.maintenanceEstimatedEnd || null,
                    scheduledFor: global.scheduledMaintenance || null
                }
            });
        } catch (error) {
            console.error('❌ Erreur statut maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du statut'
            });
        }
    },
  
    
     // Page de gestion de la maintenance (admin)
    async renderMaintenancePage(req, res) {
        try {
            // Récupérer les paramètres de maintenance actuels depuis la base
            const maintenanceSettings = await SiteSetting.findAll({
                where: { 
                    setting_key: [
                        'maintenance_mode', 
                        'maintenance_duration', 
                        'maintenance_message', 
                        'maintenance_end_time',
                        'maintenance_start_time'
                    ] 
                }
            });
            
            const settings = {};
            maintenanceSettings.forEach(setting => {
                settings[setting.setting_key] = setting.setting_value;
            });
            
            const isActive = settings.maintenance_mode === 'true';
            const endTime = settings.maintenance_end_time ? new Date(settings.maintenance_end_time) : null;
            const isExpired = endTime && new Date() > endTime;
            
            // Si maintenance expirée, la désactiver automatiquement
            if (isActive && isExpired) {
                await this.disableMaintenance();
            }
            
            res.render('admin/maintenance-settings', {
                title: 'Gestion de la Maintenance',
                user: req.session.user,
                isAuthenticated: true,
                isAdmin: true,
                settings,
                isActive: isActive && !isExpired,
                endTime,
                timeRemaining: this.getTimeRemaining(endTime)
            });
            
        } catch (error) {
            console.error('Erreur page maintenance:', error);
            res.status(500).render('error', { 
                message: 'Erreur lors du chargement de la page de maintenance'
            });
        }
    },
    
    // Activer le mode maintenance avec durée personnalisée
    async enableMaintenance(req, res) {
        try {
            const { duration, unit, message } = req.body;
            
            // Validation des données
            if (!duration || !unit || isNaN(duration) || duration <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Durée invalide. Veuillez entrer un nombre positif.'
                });
            }
            
            // Convertir en millisecondes
            let durationMs;
            switch(unit) {
                case 'minutes':
                    durationMs = parseInt(duration) * 60 * 1000;
                    break;
                case 'hours':
                    durationMs = parseInt(duration) * 60 * 60 * 1000;
                    break;
                case 'days':
                    durationMs = parseInt(duration) * 24 * 60 * 60 * 1000;
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Unité non supportée. Utilisez minutes, hours ou days.'
                    });
            }
            
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + durationMs);
            
            // Sauvegarder en base de données
            const settingsToSave = [
                { setting_key: 'maintenance_mode', setting_value: 'true' },
                { setting_key: 'maintenance_duration', setting_value: duration.toString() },
                { setting_key: 'maintenance_unit', setting_value: unit },
                { setting_key: 'maintenance_message', setting_value: message || 'Maintenance en cours...' },
                { setting_key: 'maintenance_start_time', setting_value: startTime.toISOString() },
                { setting_key: 'maintenance_end_time', setting_value: endTime.toISOString() }
            ];
            
            for (const setting of settingsToSave) {
                await SiteSetting.upsert({
                    setting_key: setting.setting_key,
                    setting_value: setting.setting_value,
                    setting_type: 'string',
                    description: `Paramètre de maintenance: ${setting.setting_key}`
                });
            }
            
            // Activer globalement
            global.maintenanceMode = true;
            global.maintenanceData = {
                startTime,
                endTime,
                duration: parseInt(duration),
                unit,
                message: message || 'Maintenance en cours...',
                adminBypass: true
            };
            
            console.log(`🔧 Maintenance activée pour ${duration} ${unit}, fin prévue: ${endTime.toLocaleString('fr-FR')}`);
            
            // Programmer la désactivation automatique
            const timeoutId = setTimeout(async () => {
                console.log('⏰ Timeout de maintenance atteint, désactivation automatique...');
                await this.disableMaintenance();
            }, durationMs);
            
            // Stocker l'ID du timeout pour pouvoir l'annuler si nécessaire
            global.maintenanceTimeoutId = timeoutId;
            
            res.json({
                success: true,
                message: `Maintenance activée pour ${duration} ${unit}`,
                data: {
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    duration,
                    unit,
                    message: message || 'Maintenance en cours...'
                }
            });
            
        } catch (error) {
            console.error('Erreur activation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'activation de la maintenance'
            });
        }
    },
    
    // Désactiver le mode maintenance
    async disableMaintenance(req = null, res = null) {
        try {
            // Mettre à jour en base
            await SiteSetting.update(
                { setting_value: 'false' },
                { where: { setting_key: 'maintenance_mode' } }
            );
            
            // Désactiver globalement
            global.maintenanceMode = false;
            global.maintenanceData = null;
            
            // Annuler le timeout si il existe
            if (global.maintenanceTimeoutId) {
                clearTimeout(global.maintenanceTimeoutId);
                global.maintenanceTimeoutId = null;
            }
            
            console.log('🔧 Maintenance désactivée');
            
            if (res) {
                res.json({
                    success: true,
                    message: 'Maintenance désactivée avec succès'
                });
            }
            
        } catch (error) {
            console.error('Erreur désactivation maintenance:', error);
            if (res) {
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la désactivation'
                });
            }
        }
    },
    
    // Obtenir le statut de la maintenance
    async getStatus(req, res) {
        try {
            // Vérifier si la maintenance est expirée
            if (global.maintenanceData && global.maintenanceData.endTime) {
                const now = new Date();
                const endTime = new Date(global.maintenanceData.endTime);
                
                if (now > endTime) {
                    await this.disableMaintenance();
                }
            }
            
            res.json({
                success: true,
                isActive: !!global.maintenanceMode,
                data: global.maintenanceData || null,
                timeRemaining: global.maintenanceData ? 
                    this.getTimeRemaining(global.maintenanceData.endTime) : null
            });
        } catch (error) {
            console.error('Erreur status maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du statut'
            });
        }
    },
    
    // Fonction utilitaire pour calculer le temps restant
    getTimeRemaining(endTime) {
        if (!endTime) return null;
        
        const now = new Date();
        const end = new Date(endTime);
        const remaining = end.getTime() - now.getTime();
        
        if (remaining <= 0) return null;
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        return {
            hours,
            minutes,
            totalMinutes: Math.floor(remaining / (1000 * 60))
        };
    }
};

