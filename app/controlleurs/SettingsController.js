// app/controlleurs/SettingsController.js - VERSION CORRIGÉE COMPLÈTE

import Setting from '../models/SettingModel.js';

export default class SettingsController {
    
    // Affichage de la page paramètres
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
                // Paramètres par défaut existants
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
                
                settingsBySection.security = {
                    session_timeout: { value: "3600", type: "number", description: "Timeout session (secondes)" },
                    max_login_attempts: { value: "5", type: "number", description: "Tentatives de connexion max" },
                    require_email_verification: { value: true, type: "boolean", description: "Vérification email requise" }
                };
                
                settingsBySection.company = {
                    company_name: { value: "Crystos Jewel", type: "string", description: "Nom de l'entreprise" },
                    company_email: { value: "contact@crystosjewel.com", type: "string", description: "Email de contact" },
                    company_phone: { value: "+33 1 23 45 67 89", type: "string", description: "Téléphone" },
                    company_address: { value: "", type: "string", description: "Adresse complète" }
                };
                
                settingsBySection.footer = {
                    facebook_url: { value: "", type: "string", description: "URL Facebook" },
                    instagram_url: { value: "", type: "string", description: "URL Instagram" },
                    twitter_url: { value: "", type: "string", description: "URL Twitter" },
                    copyright_text: { value: "© 2025 Crystos Jewel", type: "string", description: "Texte copyright" },
                    about_us_link: { value: "/notre-histoire", type: "string", description: "Lien Notre histoire" },
                    values_link: { value: "/nos-valeurs", type: "string", description: "Lien Nos valeurs" }
                };
            }

            // =====================================================
            // NOUVELLE SECTION MAINTENANCE
            // =====================================================
            
            if (!settingsBySection.maintenance) {
                settingsBySection.maintenance = {
                    is_active: { value: false, type: "boolean", description: "Maintenance active" },
                    message: { value: "Site en maintenance. Nous revenons bientôt !", type: "string", description: "Message de maintenance" },
                    scheduled_start: { value: "", type: "string", description: "Début maintenance programmée" },
                    scheduled_end: { value: "", type: "string", description: "Fin maintenance programmée" },
                    allow_admin_access: { value: true, type: "boolean", description: "Autoriser accès admin" }
                };
            }

            // Configuration des sections MISE À JOUR
            const sections = {
                payment: {
                    title: 'Paiements',
                    icon: 'fas fa-credit-card',
                    description: 'Configuration des moyens de paiement'
                },
                shipping: {
                    title: 'Livraison',
                    icon: 'fas fa-truck',
                    description: 'Frais et zones de livraison'
                },
                security: {
                    title: 'Sécurité',
                    icon: 'fas fa-shield-alt',
                    description: 'Paramètres de sécurité'
                },
                company: {
                    title: 'Coordonnées Entreprise',
                    icon: 'fas fa-building',
                    description: 'Informations pour les factures'
                },
                footer: {
                    title: 'Footer & Réseaux sociaux',
                    icon: 'fas fa-link',
                    description: 'Liens du pied de page'
                },
                // NOUVELLE SECTION
                maintenance: {
                    title: 'Maintenance du Site',
                    icon: 'fas fa-tools',
                    description: 'Gestion de la maintenance'
                }
            };

            // Données pour la vue
            const viewData = {
                title: 'Paramètres Essentiels',
                pageTitle: 'Configuration du Site',
                
                settings: settingsBySection,
                sections: sections,
                
                // Données utilisateur
                user: req.session?.user || null,
                isAuthenticated: !!req.session?.user,
                isAdmin: req.session?.user?.role_id === 2,
                
                // Messages vides
                success: [],
                error: [],
                info: []
            };

            console.log('✅ Paramètres essentiels avec maintenance chargés');
            res.render('settings', viewData);

        } catch (error) {
            console.error('❌ Erreur chargement paramètres:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du chargement des paramètres',
                error: error.message
            });
        }
    }

    // ==========================================
    // MÉTHODE SAUVEGARDE PARAMÈTRES
    // ==========================================

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

            // Sauvegarder chaque paramètre avec findOrCreate
            const savedSettings = [];
            const errors = [];

            for (const [key, value] of Object.entries(settings)) {
                try {
                    console.log(`🔄 Traitement ${section}.${key} = "${value}"`);

                    const [setting, created] = await Setting.findOrCreate({
                        where: { 
                            section: section, 
                            key: key 
                        },
                        defaults: {
                            section: section,
                            key: key,
                            value: String(value),
                            type: SettingsController.getValueType(value),
                            description: `Paramètre ${key}`,
                            is_public: section === 'footer' || section === 'company'
                        }
                    });

                    // Si le paramètre existe déjà, le mettre à jour
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
                        created,
                        action: created ? 'créé' : 'mis à jour'
                    });

                    console.log(`✅ ${section}.${key} ${created ? 'créé' : 'mis à jour'}`);

                } catch (settingError) {
                    console.error(`❌ Erreur paramètre ${key}:`, settingError.message);
                    errors.push(`${key}: ${settingError.message}`);
                }
            }

            console.log('✅ Paramètres traités:', savedSettings.length);
            if (errors.length > 0) {
                console.warn('⚠️ Erreurs:', errors);
            }

            // Invalider le cache pour que les changements soient visibles immédiatement
            SettingsController.invalidateCache();

            // Réponse détaillée
            res.json({
                success: true,
                message: `${savedSettings.length} paramètres sauvegardés avec succès`,
                data: savedSettings,
                errors: errors.length > 0 ? errors : undefined,
                summary: {
                    total: Object.keys(settings).length,
                    saved: savedSettings.length,
                    errors: errors.length,
                    section: section
                }
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde paramètres:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde',
                error: error.message
            });
        }
    }

    // ==========================================
    // MÉTHODES MAINTENANCE
    // ==========================================

    static async activateMaintenance(req, res) {
        try {
            const { message } = req.body;
            
            await Setting.updateOrCreate('maintenance', 'is_active', true);
            
            if (message) {
                await Setting.updateOrCreate('maintenance', 'message', message);
            }
            
            // Invalider le cache
            global.settingsCacheExpired = true;
            
            console.log('🔧 Maintenance activée par admin:', req.session.user.email);
            res.json({
                success: true,
                message: 'Maintenance activée avec succès'
            });
            
        } catch (error) {
            console.error('❌ Erreur activation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de l\'activation'
            });
        }
    }

    static async deactivateMaintenance(req, res) {
        try {
            await Setting.updateOrCreate('maintenance', 'is_active', false);
            await Setting.updateOrCreate('maintenance', 'scheduled_start', '');
            await Setting.updateOrCreate('maintenance', 'scheduled_end', '');
            
            // Invalider le cache
            global.settingsCacheExpired = true;
            
            console.log('✅ Maintenance désactivée par admin:', req.session.user.email);
            res.json({
                success: true,
                message: 'Maintenance désactivée avec succès'
            });
            
        } catch (error) {
            console.error('❌ Erreur désactivation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de la désactivation'
            });
        }
    }

    static async scheduleMaintenance(req, res) {
        try {
            const { startTime, endTime, message } = req.body;
            
            // Validation des dates
            const start = new Date(startTime);
            const end = new Date(endTime);
            const now = new Date();
            
            if (start < now) {
                return res.status(400).json({
                    success: false,
                    message: 'La date de début ne peut pas être dans le passé'
                });
            }
            
            if (end <= start) {
                return res.status(400).json({
                    success: false,
                    message: 'La date de fin doit être après la date de début'
                });
            }
            
            // Sauvegarder les paramètres
            await Setting.updateOrCreate('maintenance', 'scheduled_start', startTime);
            await Setting.updateOrCreate('maintenance', 'scheduled_end', endTime);
            
            if (message) {
                await Setting.updateOrCreate('maintenance', 'message', message);
            }
            
            // Invalider le cache
            global.settingsCacheExpired = true;
            
            console.log('📅 Maintenance programmée par admin:', {
                admin: req.session.user.email,
                startTime,
                endTime
            });
            
            res.json({
                success: true,
                message: 'Maintenance programmée avec succès',
                scheduledStart: startTime,
                scheduledEnd: endTime
            });
            
        } catch (error) {
            console.error('❌ Erreur programmation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de la programmation'
            });
        }
    }

   static async getMaintenanceStatus(req, res) {
    try {
        // ✅ VÉRIFICATION: Ne pas répondre si déjà répondu
        if (res.headersSent) {
            console.log('⚠️ Headers déjà envoyés, abandon de la réponse');
            return;
        }
        
        const maintenanceSettings = await Setting.findAll({
            where: { section: 'maintenance' }
        });
        
        const status = {};
        maintenanceSettings.forEach(setting => {
            let value = setting.value;
            if (setting.type === 'boolean') {
                // ✅ CORRECTION: Gérer les différents formats
                value = value === 'true' || value === true || value === 'on' || value === '1';
            }
            status[setting.key] = value;
        });
        
        res.json({
            success: true,
            ...status,
            currentTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erreur récupération statut maintenance:', error);
        
        // ✅ VÉRIFICATION avant de répondre
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du statut'
            });
        }
    }
}

    // ==========================================
    // MÉTHODES UTILITAIRES
    // ==========================================

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

// IMPORTANT: Export par défaut du CONSTRUCTEUR, pas de la classe
// export { SettingsController }; // Ancienne syntaxe
// export default SettingsController; // Nouvelle syntaxe correcte