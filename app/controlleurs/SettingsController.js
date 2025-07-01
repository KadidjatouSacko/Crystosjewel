// SettingsController.js - VERSION SIMPLE ET ESSENTIELLE
import Setting from '../models/SettingModel.js';

export class SettingsController {
    
    // Afficher la page des paramètres
    static async showPageSettings(req, res) {
        try {
            console.log('🔧 Chargement page paramètres simple');

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
                // Paramètres par défaut
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
                    require_email_verification: { value: true, type: "boolean", description: "Vérification email obligatoire" }
                };
                
                settingsBySection.company = {
                    company_name: { value: "Crystos Jewel", type: "string", description: "Nom de l'entreprise" },
                    company_address: { value: "123 Rue de la Paix, 75001 Paris", type: "string", description: "Adresse facturation" },
                    company_phone: { value: "+33 1 23 45 67 89", type: "string", description: "Téléphone" },
                    company_email: { value: "contact@crystosjewel.com", type: "string", description: "Email officiel" },
                    siret: { value: "", type: "string", description: "Numéro SIRET" },
                    vat_number: { value: "", type: "string", description: "Numéro TVA" }
                };
                
                settingsBySection.footer = {
                    instagram_url: { value: "https://instagram.com/crystosjewel", type: "string", description: "Lien Instagram" },
                    facebook_url: { value: "https://facebook.com/crystosjewel", type: "string", description: "Lien Facebook" },
                    pinterest_url: { value: "https://pinterest.com/crystosjewel", type: "string", description: "Lien Pinterest" },
                    tiktok_url: { value: "https://tiktok.com/@crystosjewel", type: "string", description: "Lien TikTok" },
                    copyright_text: { value: "2025 CrystosJewel - Tous droits réservés.", type: "string", description: "Texte copyright" },
                    about_us_link: { value: "/notre-histoire", type: "string", description: "Lien Notre histoire" },
                    values_link: { value: "/nos-valeurs", type: "string", description: "Lien Nos valeurs" }
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

            console.log('✅ Paramètres essentiels chargés');
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

    // Sauvegarder les paramètres
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
                            is_public: section === 'footer' || section === 'company' // Footer et coordonnées publiques
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

            res.json({
                success: true,
                message: `${savedSettings.length} paramètres sauvegardés`,
                data: savedSettings
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