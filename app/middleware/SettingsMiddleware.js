// middleware/settingsMiddleware.js
import Setting from './models/SettingModel.js';



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
        
        // Variables de commodité
        res.locals.siteName = settingsCache?.company?.company_name || 'Crystos Jewel';
        res.locals.companyEmail = settingsCache?.company?.company_email || 'contact@crystosjewel.com';
        res.locals.companyPhone = settingsCache?.company?.company_phone || '+33 1 23 45 67 89';
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur injection paramètres:', error);
        
        // Valeurs par défaut en cas d'erreur
        res.locals.siteSettings = {};
        res.locals.siteName = 'Crystos Jewel';
        res.locals.companyEmail = 'contact@crystosjewel.com';
        res.locals.companyPhone = '+33 1 23 45 67 89';
        
        next();
    }
};