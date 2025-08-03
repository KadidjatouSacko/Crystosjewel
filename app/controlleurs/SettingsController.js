// app/controlleurs/SettingsController.js - VERSION COMPLÈTE CORRIGÉE

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
                    company_address: { value: "123 Rue de la Paix, 75001 Paris", type: "string", description: "Adresse de facturation" },
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
                    copyright_text: { value: "2025 CrystosJewel - Tous droits réservés.", type: "string", description: "Texte copyright" }
                };

                // ✅ PAIEMENTS EN DERNIER
                settingsBySection.payment = {
                    stripe_public_key: { value: "", type: "string", description: "Clé publique Stripe" },
                    stripe_secret_key: { value: "", type: "string", description: "Clé secrète Stripe" },
                    paypal_client_id: { value: "", type: "string", description: "Client ID PayPal" },
                    accept_credit_cards: { value: true, type: "boolean", description: "Accepter les cartes" },
                    accept_paypal: { value: true, type: "boolean", description: "Accepter PayPal" }
                };
            }

            // Vérifier le statut de maintenance
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

            // ✅ Configuration des sections DANS L'ORDRE SOUHAITÉ
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
                // ✅ PAIEMENTS EN DERNIER
                payment: {
                    title: 'Paiements',
                    icon: 'fas fa-credit-card',
                    description: 'Configuration des moyens de paiement'
                }
            };

            // Données à passer à la vue
            const viewData = {
                // Variables de titre
                title: 'Paramètres du Site',
                pageTitle: 'Paramètres Essentiels',
                
                // Données des paramètres
                settingsBySection,
                settings: settingsBySection,  // Alias pour compatibilité template
                sections,
                maintenanceActive,
                
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
            console.log('🔍 ViewData keys:', Object.keys(viewData));
            
            // Rendu de la page
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

    // ✅ CORRECTION : Sauvegarder les paramètres avec la bonne route
    static async saveSettings(req, res) {
        try {
            console.log('💾 Sauvegarde paramètres reçue:', req.body);
            console.log('💾 URL appelée:', req.originalUrl);

            const { section, settings } = req.body;

            if (!section || !settings) {
                console.error('❌ Données manquantes:', { section, settings });
                return res.status(400).json({
                    success: false,
                    message: 'Section et paramètres requis'
                });
            }

            console.log(`📝 Traitement section: ${section}, ${Object.keys(settings).length} paramètres`);

            // Sauvegarder chaque paramètre
            const savedSettings = [];
            for (const [key, value] of Object.entries(settings)) {
                try {
                    console.log(`💾 Sauvegarde ${section}.${key} = ${value}`);

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
                        created: created ? 'créé' : 'mis à jour'
                    });

                    console.log(`✅ ${created ? 'Créé' : 'Mis à jour'}: ${section}.${key}`);

                } catch (settingError) {
                    console.error(`❌ Erreur paramètre ${key}:`, settingError);
                }
            }

            console.log(`✅ ${savedSettings.length} paramètres sauvegardés pour ${section}`);

            // Invalider le cache pour que les changements soient visibles immédiatement
            SettingsController.invalidateCache();

            // Réponse de succès
            res.json({
                success: true,
                message: `${savedSettings.length} paramètres sauvegardés pour ${section}`,
                data: savedSettings
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde paramètres:', error);
            console.error('❌ Stack:', error.stack);
            
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