// ==========================================
// 1. CORRECTION DU CONTROLLER - app/controlleurs/SettingsController.js
// ==========================================

import Setting from '../models/SettingModel.js';

export default class SettingsController {
    
    // Affichage de la page paramètres
  static async showPageSettings(req, res) {
    try {
        console.log('🔧 Chargement page paramètres');

        // ✅ TOUJOURS récupérer les paramètres depuis la BDD
        const allSettings = await Setting.findAll({
            order: [['section', 'ASC'], ['key', 'ASC']]
        });

        const settingsBySection = {};
        allSettings.forEach(setting => {
            if (!settingsBySection[setting.section]) {
                settingsBySection[setting.section] = {};
            }
            settingsBySection[setting.section][setting.key] = setting.value;
        });

        console.log('📊 Paramètres chargés depuis BDD:', {
            sections: Object.keys(settingsBySection),
            total: allSettings.length
        });

        // Ajouter les valeurs par défaut SEULEMENT si les sections sont complètement vides
        if (!settingsBySection.company || Object.keys(settingsBySection.company).length === 0) {
            settingsBySection.company = {
                company_name: "Crystos Jewel",
                company_email: "crystosjewel@gmail.com", 
                company_phone: "+33 1 23 45 67 89",
                company_address: "123 Rue de la Joaillerie, 75001 Paris",
                vat_number: "",
                siret: ""
            };
        }

        if (!settingsBySection.footer || Object.keys(settingsBySection.footer).length === 0) {
            settingsBySection.footer = {
                facebook_url: "https://facebook.com/crystosjewel",
                instagram_url: "https://instagram.com/crystosjewel", 
                twitter_url: "",
                linkedin_url: "",
                youtube_url: "",
                copyright_text: "© 2025 Crystos Jewel. Tous droits réservés.",
                about_us_link: "/notre-histoire",
                values_link: "/nos-valeurs"
            };
        }

        if (!settingsBySection.payment || Object.keys(settingsBySection.payment).length === 0) {
            settingsBySection.payment = {
                stripe_enabled: "true",
                paypal_enabled: "false",
                bank_transfer_enabled: "true",
                minimum_order: "50"
            };
        }

        if (!settingsBySection.shipping || Object.keys(settingsBySection.shipping).length === 0) {
            settingsBySection.shipping = {
                free_shipping_threshold: "100",
                standard_shipping_cost: "5.99",
                express_shipping_cost: "12.99",
                international_shipping: "true"
            };
        }

        if (!settingsBySection.security || Object.keys(settingsBySection.security).length === 0) {
            settingsBySection.security = {
                require_email_verification: "true",
                password_min_length: "8",
                max_login_attempts: "5",
                session_timeout: "30"
            };
        }

        // Configuration des sections
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

        console.log('✅ Paramètres affichés:', {
            company: Object.keys(settingsBySection.company || {}),
            footer: Object.keys(settingsBySection.footer || {}),
            payment: Object.keys(settingsBySection.payment || {}),
            shipping: Object.keys(settingsBySection.shipping || {}),
            security: Object.keys(settingsBySection.security || {})
        });

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
// AMÉLIORATION DE LA MÉTHODE saveSettings
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

        // ✅ FORCER le rechargement du cache immédiatement
        global.settingsCacheExpired = true;

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

