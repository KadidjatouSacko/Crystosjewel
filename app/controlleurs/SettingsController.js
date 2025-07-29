// app/controlleurs/SettingsController.js - VERSION CORRIGÉE COMPLÈTE

import Setting from '../models/SettingModel.js';

export class SettingsController {
    
    // Afficher la page des paramètres - VERSION CORRIGÉE
    static async showPageSettings(req, res) {
        try {
            console.log('🔧 Chargement page paramètres avec maintenance');

            // Récupérer tous les paramètres
            let allSettings = [];
            try {
                allSettings = await Setting.findAll({
                    order: [['section', 'ASC'], ['key', 'ASC']]
                });
            } catch (error) {
                console.warn('⚠️ Pas de paramètres en base, utilisation des défauts');
            }

            // Grouper par section
            const settingsBySection = {};
            if (allSettings.length > 0) {
                allSettings.forEach(setting => {
                    if (!settingsBySection[setting.section]) {
                        settingsBySection[setting.section] = {};
                    }
                    settingsBySection[setting.section][setting.key] = {
                        value: setting.value,
                        type: setting.type,
                        description: setting.description
                    };
                });
            } else {
                // Paramètres par défaut si vides
                settingsBySection.payment = {
                    stripe_public_key: { value: "", type: "string", description: "Clé publique Stripe" },
                    stripe_secret_key: { value: "", type: "string", description: "Clé secrète Stripe" },
                    paypal_client_id: { value: "", type: "string", description: "Client ID PayPal" },
                    accept_credit_cards: { value: true, type: "boolean", description: "Accepter les cartes" },
                    accept_paypal: { value: true, type: "boolean", description: "Accepter PayPal" }
                };
                
                settingsBySection.shipping = {
                    free_shipping_threshold: { value: "100", type: "number", description: "Livraison gratuite à partir de (€)" },
                    standard_shipping_cost: { value: "7.50", type: "number", description: "Frais livraison standard (€)" },
                    express_shipping_cost: { value: "15.00", type: "number", description: "Frais livraison express (€)" },
                    shipping_zones: { value: "France, Europe, International", type: "string", description: "Zones de livraison" }
                };
                
                settingsBySection.company = {
                    company_name: { value: "Crystos Jewel", type: "string", description: "Nom de l'entreprise" },
                    company_email: { value: "contact@crystosjewel.com", type: "string", description: "Email de contact" },
                    company_phone: { value: "+33 1 23 45 67 89", type: "string", description: "Téléphone" }
                };

                // ✅ AJOUTER LA SECTION MAINTENANCE
                settingsBySection.maintenance = {
                    enabled: { value: false, type: "boolean", description: "Maintenance manuelle activée" },
                    scheduled_start: { value: "", type: "string", description: "Début maintenance programmée" },
                    scheduled_end: { value: "", type: "string", description: "Fin maintenance programmée" },
                    message: { value: "Site en maintenance. Veuillez revenir plus tard.", type: "string", description: "Message de maintenance" },
                    allowed_ips: { value: "[]", type: "json", description: "IPs autorisées (JSON)" }
                };
            }

            // ✅ VÉRIFIER LE STATUT DE MAINTENANCE (si les paramètres existent)
            let maintenanceActive = false;
            try {
                if (settingsBySection.maintenance) {
                    const maintenanceEnabled = settingsBySection.maintenance.enabled?.value === true || 
                                             settingsBySection.maintenance.enabled?.value === 'true';
                    
                    let scheduledActive = false;
                    if (settingsBySection.maintenance.scheduled_start?.value && 
                        settingsBySection.maintenance.scheduled_end?.value) {
                        const now = new Date();
                        const start = new Date(settingsBySection.maintenance.scheduled_start.value);
                        const end = new Date(settingsBySection.maintenance.scheduled_end.value);
                        scheduledActive = now >= start && now <= end;
                    }
                    
                    maintenanceActive = maintenanceEnabled || scheduledActive;
                }
            } catch (maintenanceError) {
                console.error('❌ Erreur vérification maintenance:', maintenanceError);
                maintenanceActive = false;
            }

            // Données à passer à la vue
            const viewData = {
                title: 'Paramètres du Site',
                settingsBySection,
                maintenanceActive, // ✅ VARIABLE DÉFINIE
                
                // Données utilisateur
                user: req.session?.user || null,
                isAuthenticated: !!req.session?.user,
                isAdmin: req.session?.user?.role_id === 2,
                
                // Messages vides par défaut
                success: [],
                error: [],
                info: []
            };

            console.log('✅ Paramètres essentiels avec maintenance chargés');
            
            // ✅ IMPORTANT: UN SEUL RENDU DE RÉPONSE
            res.render('admin/settings', viewData); // ou 'settings' selon votre structure

        } catch (error) {
            console.error('❌ Erreur chargement paramètres:', error);
            
            // ✅ IMPORTANT: Ne pas envoyer de JSON si on a déjà essayé de render
            if (!res.headersSent) {
                res.status(500).render('error', {
                    title: 'Erreur',
                    message: 'Erreur lors du chargement des paramètres',
                    user: req.session?.user || null,
                    isAuthenticated: !!req.session?.user,
                    isAdmin: req.session?.user?.role_id === 2
                });
            }
        }
    }

    // Sauvegarder les paramètres - VERSION CORRIGÉE
    static async saveSettings(req, res) {
        try {
            console.log('💾 Sauvegarde paramètres:', req.body);

            const { section, settings } = req.body;

            if (!section || !settings) {
                return res.status(400).json({
                    success: false,
                    message: 'Section et paramètres requis'
                });
            }

            // Sauvegarder chaque paramètre
            const savedSettings = [];
            for (const [key, value] of Object.entries(settings)) {
                try {
                    const [setting, created] = await Setting.findOrCreate({
                        where: { section, key },
                        defaults: {
                            section,
                            key,
                            value: String(value),
                            type: SettingsController.getValueType(value),
                            description: `Paramètre ${key}`,
                            is_public: section === 'footer' || section === 'company' || section === 'maintenance'
                        }
                    });

                    if (!created) {
                        setting.value = String(value);
                        setting.type = SettingsController.getValueType(value);
                        setting.updated_at = new Date();
                        await setting.save();
                    }

                    savedSettings.push({
                        section,
                        key,
                        value: setting.value,
                        created
                    });

                } catch (settingError) {
                    console.error(`Erreur paramètre ${key}:`, settingError);
                }
            }

            console.log('✅ Paramètres sauvegardés:', savedSettings.length);

            // Invalider le cache pour que les changements soient visibles immédiatement
            SettingsController.invalidateCache();

            // ✅ IMPORTANT: Une seule réponse
            res.json({
                success: true,
                message: `${savedSettings.length} paramètres sauvegardés`,
                data: savedSettings
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde paramètres:', error);
            
            // ✅ IMPORTANT: Vérifier si les headers ne sont pas déjà envoyés
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la sauvegarde',
                    error: error.message
                });
            }
        }
    }

    // Fonctions utilitaires
    static getValueType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (!isNaN(parseFloat(value)) && isFinite(value)) return 'number';
        return 'string';
    }

    // Fonction pour invalider le cache
    static invalidateCache() {
        global.settingsCacheExpired = true;
        console.log('💨 Cache paramètres invalidé');
    }
}