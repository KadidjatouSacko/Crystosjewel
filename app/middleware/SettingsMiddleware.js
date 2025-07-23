// ==========================================
// 2. MISE À JOUR DU MIDDLEWARE - app/middleware/SettingsMiddleware.js
// ==========================================

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
            
            const settings = await Setting.findAll({
                where: { is_public: true }
            });
            
            settingsCache = {};
            settings.forEach(setting => {
                if (!settingsCache[setting.section]) {
                    settingsCache[setting.section] = {};
                }
                
                let value = setting.value;
                if (setting.type === 'boolean') {
                    value = value === 'true' || value === true;
                } else if (setting.type === 'number') {
                    value = parseFloat(value);
                }
                
                settingsCache[setting.section][setting.key] = value;
            });
            
            lastUpdate = now;
            global.settingsCacheExpired = false;
            
            console.log('✅ Cache paramètres rechargé:', Object.keys(settingsCache));
        }
        
        // Injecter dans toutes les vues
        res.locals.siteSettings = settingsCache || {};
        
        // Variables de commodité pour les vues
        res.locals.siteName = settingsCache?.company?.company_name || 'Crystos Jewel';
        res.locals.companyEmail = settingsCache?.company?.company_email || 'crystosjewel@gmail.com';
        res.locals.companyPhone = settingsCache?.company?.company_phone || '+33 1 23 45 67 89';
        res.locals.companyAddress = settingsCache?.company?.company_address || '';
        res.locals.companyVat = settingsCache?.company?.vat_number || '';
        res.locals.companySiret = settingsCache?.company?.siret || '';
        
        // Réseaux sociaux
        res.locals.footerFacebook = settingsCache?.footer?.facebook_url || '';
        res.locals.footerInstagram = settingsCache?.footer?.instagram_url || '';
        res.locals.footerTwitter = settingsCache?.footer?.twitter_url || '';
        res.locals.footerLinkedin = settingsCache?.footer?.linkedin_url || '';
        res.locals.footerYoutube = settingsCache?.footer?.youtube_url || '';
        res.locals.copyrightText = settingsCache?.footer?.copyright_text || '© 2025 Crystos Jewel';
        
        // Paiements
        res.locals.stripeEnabled = settingsCache?.payment?.stripe_enabled || false;
        res.locals.paypalEnabled = settingsCache?.payment?.paypal_enabled || false;
        res.locals.minimumOrder = settingsCache?.payment?.minimum_order || '50';
        
        // Livraison
        res.locals.freeShippingThreshold = settingsCache?.shipping?.free_shipping_threshold || '100';
        res.locals.standardShippingCost = settingsCache?.shipping?.standard_shipping_cost || '5.99';
        res.locals.expressShippingCost = settingsCache?.shipping?.express_shipping_cost || '12.99';
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur injection paramètres:', error);
        
        // Valeurs par défaut en cas d'erreur
        res.locals.siteSettings = {};
        res.locals.siteName = 'Crystos Jewel';
        res.locals.companyEmail = 'crystosjewel@gmail.com';
        res.locals.companyPhone = '+33 1 23 45 67 89';
        res.locals.companyAddress = '';
        res.locals.footerFacebook = '';
        res.locals.footerInstagram = '';
        res.locals.footerTwitter = '';
        res.locals.copyrightText = '© 2025 Crystos Jewel';
        res.locals.minimumOrder = '50';
        res.locals.freeShippingThreshold = '100';
        
        next();
    }
};
