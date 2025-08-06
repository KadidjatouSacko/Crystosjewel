import Setting from '../models/SettingModel.js';

export class SettingsController {
    
    static async showPageSettings(req, res) {
        try {
            console.log('🔧 Chargement page paramètres avec encodage UTF-8');

            // Force l'encodage UTF-8 pour la réponse
            res.setHeader('Content-Type', 'text/html; charset=utf-8');

            let allSettings = [];
            try {
                allSettings = await Setting.findAll({
                    order: [['section', 'ASC'], ['key', 'ASC']]
                });
                console.log('📊 Paramètres récupérés de la base:', allSettings.length);
            } catch (error) {
                console.warn('⚠️ Pas de paramètres en base, utilisation des défauts');
            }

            const settingsBySection = {};
            if (allSettings.length > 0) {
                allSettings.forEach(setting => {
                    if (!settingsBySection[setting.section]) {
                        settingsBySection[setting.section] = {};
                    }
                    
                    // ✅ FORCER L'ENCODAGE UTF-8 pour les descriptions
                    let description = setting.description;
                    if (description && typeof description === 'string') {
                        // Nettoyer les caractères d'encodage corrompu
                        description = description
                            .replace(/Â/g, '')
                            .replace(/â€™/g, "'")
                            .replace(/â€œ/g, '"')
                            .replace(/â€/g, '"')
                            .replace(/Ã©/g, 'é')
                            .replace(/Ã¨/g, 'è')
                            .replace(/Ã /g, 'à')
                            .replace(/Ã§/g, 'ç')
                            .replace(/Ã¹/g, 'ù')
                            .replace(/â€¦/g, '…');
                    }
                    
                    settingsBySection[setting.section][setting.key] = {
                        value: setting.value,
                        type: setting.type,
                        description: description
                    };
                });
            } else {
                // ✅ Paramètres par défaut avec encodage UTF-8 correct
                settingsBySection.maintenance = {
                    enabled: { value: false, type: "boolean", description: "Maintenance manuelle activée" },
                    scheduled_start: { value: "", type: "string", description: "Début maintenance programmée" },
                    scheduled_end: { value: "", type: "string", description: "Fin maintenance programmée" },
                    message: { value: "Site en maintenance. Veuillez revenir plus tard.", type: "string", description: "Message de maintenance" },
                    allowed_ips: { value: "[]", type: "json", description: "IPs autorisées (JSON)" }
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
                    company_address: { value: "", type: "string", description: "Adresse de facturation" },
                    company_phone: { value: "<%= companyPhone || '+33 1 23 45 67 89' %>", type: "string", description: "Téléphone" },
                    company_email: { value: "<%= companyEmail || 'contact@crystosjewel.com' %>", type: "string", description: "Email officiel" },
                    siret: { value: "", type: "string", description: "Numéro SIRET" },
                    vat_number: { value: "", type: "string", description: "Numéro TVA" }
                };

                settingsBySection.footer = {
                    instagram_url: { value: "https://instagram.com/crystosjewel", type: "string", description: "Lien Instagram" },
                    facebook_url: { value: "https://facebook.com/crystosjewel", type: "string", description: "Lien Facebook" },
                    pinterest_url: { value: "https://pinterest.com/crystosjewel", type: "string", description: "Lien Pinterest" },
                    tiktok_url: { value: "https://tiktok.com/@crystosjewel", type: "string", description: "Lien TikTok" },
                    copyright_text: { value: "2025 CrystosJewel - Tous droits réservés.", type: "string", description: "Texte copyright" }
                };

                settingsBySection.payment = {
                    stripe_public_key: { value: "", type: "string", description: "Clé publique Stripe" },
                    stripe_secret_key: { value: "", type: "string", description: "Clé secrète Stripe" },
                    paypal_client_id: { value: "", type: "string", description: "Client ID PayPal" },
                    accept_credit_cards: { value: true, type: "boolean", description: "Accepter les cartes" },
                    accept_paypal: { value: true, type: "boolean", description: "Accepter PayPal" }
                };
            }

            // Vérifier la maintenance
            let maintenanceActive = false;
            try {
                if (settingsBySection.maintenance) {
                    const maintenanceEnabled = settingsBySection.maintenance.enabled?.value === true || 
                                             settingsBySection.maintenance.enabled?.value === 'true';
                    maintenanceActive = maintenanceEnabled;
                }
            } catch (maintenanceError) {
                console.error('❌ Erreur vérification maintenance:', maintenanceError);
                maintenanceActive = false;
            }

            const sections = {
                maintenance: {
                    title: 'Mode Maintenance',
                    icon: 'fas fa-tools',
                    description: 'Contrôle de la maintenance du site'
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
                payment: {
                    title: 'Paiements',
                    icon: 'fas fa-credit-card',
                    description: 'Configuration des moyens de paiement'
                }
            };

            const viewData = {
                title: 'Paramètres du Site',
                pageTitle: 'Paramètres Essentiels',
                settingsBySection,
                settings: settingsBySection,
                sections,
                maintenanceActive,
                user: req.session?.user || null,
                isAuthenticated: !!req.session?.user,
                isAdmin: req.session?.user?.role_id === 2,
                success: [],
                error: [],
                info: []
            };

            console.log('✅ Rendu de la page avec encodage UTF-8');
            res.render('settings', viewData);

        } catch (error) {
            console.error('❌ Erreur chargement paramètres:', error);
            if (!res.headersSent) {
                res.status(500).render('error', {
                    title: 'Erreur',
                    pageTitle: 'Erreur',
                    message: 'Erreur lors du chargement des paramètres',
                    user: req.session?.user || null,
                    isAuthenticated: !!req.session?.user,
                    isAdmin: req.session?.user?.role_id === 2
                });
            }
        }
    }

    static async saveSettings(req, res) {
        try {
            console.log('💾 Sauvegarde paramètres avec encodage UTF-8');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');

            const { section, settings } = req.body;

            if (!section || !settings) {
                return res.status(400).json({
                    success: false,
                    message: 'Section et paramètres requis'
                });
            }

            const savedSettings = [];
            for (const [key, value] of Object.entries(settings)) {
                try {
                    // ✅ DESCRIPTIONS CORRECTES AVEC ENCODAGE UTF-8
                    const descriptions = {
                        // Company
                        'company_name': 'Nom de l\'entreprise',
                        'company_address': 'Adresse de facturation',
                        'company_phone': 'Téléphone',
                        'company_email': 'Email officiel',
                        'siret': 'Numéro SIRET',
                        'vat_number': 'Numéro TVA',
                        
                        // Shipping
                        'free_shipping_threshold': 'Livraison gratuite à partir de (€)',
                        'standard_shipping_cost': 'Frais livraison standard (€)',
                        'express_shipping_cost': 'Frais livraison express (€)',
                        'shipping_zones': 'Zones de livraison',
                        
                        // Security
                        'session_timeout': 'Timeout session (secondes)',
                        'max_login_attempts': 'Tentatives de connexion max',
                        'require_email_verification': 'Vérification email obligatoire',
                        
                        // Payment
                        'stripe_public_key': 'Clé publique Stripe',
                        'stripe_secret_key': 'Clé secrète Stripe',
                        'paypal_client_id': 'Client ID PayPal',
                        'accept_credit_cards': 'Accepter les cartes',
                        'accept_paypal': 'Accepter PayPal',
                        
                        // Footer
                        'instagram_url': 'Lien Instagram',
                        'facebook_url': 'Lien Facebook',
                        'pinterest_url': 'Lien Pinterest',
                        'tiktok_url': 'Lien TikTok',
                        'copyright_text': 'Texte copyright',
                        
                        // Maintenance
                        'enabled': 'Maintenance manuelle activée',
                        'message': 'Message de maintenance',
                        'allowed_ips': 'IPs autorisées (JSON)'
                    };

                    const description = descriptions[key] || `Paramètre ${key}`;
                    
                    const [setting, created] = await Setting.findOrCreate({
                        where: { section, key },
                        defaults: {
                            section,
                            key,
                            value: String(value),
                            type: SettingsController.getValueType(value),
                            description: description, // ✅ Description UTF-8 correcte
                            is_public: section === 'footer' || section === 'company' || section === 'maintenance'
                        }
                    });

                    if (!created) {
                        setting.value = String(value);
                        setting.type = SettingsController.getValueType(value);
                        setting.description = description; // ✅ Mise à jour de la description
                        setting.updated_at = new Date();
                        await setting.save();
                    }

                    savedSettings.push({
                        section,
                        key,
                        value: setting.value,
                        description: setting.description,
                        created: created ? 'créé' : 'mis à jour'
                    });

                    console.log(`✅ ${created ? 'Créé' : 'Mis à jour'}: ${section}.${key} = "${description}"`);

                } catch (settingError) {
                    console.error(`❌ Erreur paramètre ${key}:`, settingError);
                }
            }

            console.log(`✅ ${savedSettings.length} paramètres sauvegardés pour ${section}`);
            SettingsController.invalidateCache();

            res.json({
                success: true,
                message: `${savedSettings.length} paramètres sauvegardés pour ${section}`,
                data: savedSettings
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde paramètres:', error);
            
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la sauvegarde',
                    error: error.message
                });
            }
        }
    }

    static getValueType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (!isNaN(parseFloat(value)) && isFinite(value)) return 'number';
        return 'string';
    }

    static invalidateCache() {
        global.settingsCacheExpired = true;
        console.log('💨 Cache paramètres invalidé');
    }
}