// app/middleware/MaintenanceMiddleware.js

import Setting from '../models/SettingModel.js';

let maintenanceCache = null;
let lastCheck = null;

export const maintenanceMiddleware = async (req, res, next) => {
    try {
        // Rafraîchir le cache toutes les 10 secondes
        const now = Date.now();
        const shouldRefresh = !maintenanceCache || 
                             !lastCheck || 
                             (now - lastCheck) > 10000;

        if (shouldRefresh) {
            console.log('🔄 Vérification statut maintenance...');
            
            const maintenanceSettings = await Setting.findAll({
                where: { 
                    section: 'maintenance'
                }
            });
            
            maintenanceCache = {};
            maintenanceSettings.forEach(setting => {
                maintenanceCache[setting.key] = setting.value;
            });
            
            // ✅ VÉRIFIER SI LA MAINTENANCE DOIT SE DÉSACTIVER AUTOMATIQUEMENT
            if (maintenanceCache.maintenance_enabled === 'true' && maintenanceCache.maintenance_end_time) {
                const endTime = new Date(maintenanceCache.maintenance_end_time);
                const currentTime = new Date();
                
                if (currentTime >= endTime) {
                    console.log('⏰ Heure de fin de maintenance atteinte, désactivation automatique...');
                    
                    // Désactiver la maintenance automatiquement
                    await Setting.update(
                        { value: 'false' },
                        { where: { section: 'maintenance', key: 'maintenance_enabled' } }
                    );
                    
                    // Mettre à jour le cache
                    maintenanceCache.maintenance_enabled = 'false';
                    
                    console.log('✅ Maintenance désactivée automatiquement');
                }
            }
            
            lastCheck = now;
            
            if (maintenanceCache.maintenance_enabled === 'true') {
                console.log('🚧 Mode maintenance ACTIVÉ');
            }
        }

        // Vérifier si la maintenance est activée
        const isMaintenanceEnabled = maintenanceCache.maintenance_enabled === 'true';
        
        if (!isMaintenanceEnabled) {
            return next(); // Pas de maintenance, continuer normalement
        }

        // ✅ EXCEPTIONS : Laisser passer les cas autorisés
        const isAdminUser = req.session?.user?.role_id === 2;
        const isAdminRoute = req.path.startsWith('/admin');
        const isLoginRoute = req.path === '/connexion-inscription' || req.path === '/login';
        const isApiRoute = req.path.startsWith('/api');
        const isAssets = req.path.includes('/css/') || 
                        req.path.includes('/js/') || 
                        req.path.includes('/images/') ||
                        req.path.includes('/uploads/') ||
                        req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/);

        // Laisser passer les admins, les routes admin, les assets et la page de connexion
        if (isAdminUser || isAdminRoute || isAssets || isApiRoute || isLoginRoute) {
            return next();
        }

        // ❌ MAINTENANCE ACTIVE : Bloquer les autres pages
        console.log(`🚧 Accès bloqué par maintenance: ${req.path}`);
        
        const maintenanceMessage = maintenanceCache.maintenance_message || 'Site en maintenance. Nous revenons bientôt !';
        const maintenanceEndTime = maintenanceCache.maintenance_end_time || '';
        const contactEmail = maintenanceCache.maintenance_contact_email || 'crystosjewel@gmail.com';

        // Page de maintenance avec lien vers la vraie route admin
        res.status(503).send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Site en Maintenance - Crystos Jewel</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <meta http-equiv="refresh" content="30">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #b76e79 0%, #e8c2c8 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            position: relative;
            overflow: hidden;
        }
        
        .background-animation {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: 0;
        }
        
        .floating-icon {
            position: absolute;
            color: rgba(255, 255, 255, 0.1);
            animation: float 6s ease-in-out infinite;
        }
        
        .floating-icon:nth-child(1) { top: 20%; left: 10%; font-size: 2rem; animation-delay: 0s; }
        .floating-icon:nth-child(2) { top: 60%; left: 80%; font-size: 1.5rem; animation-delay: 2s; }
        .floating-icon:nth-child(3) { top: 30%; left: 70%; font-size: 1.8rem; animation-delay: 4s; }
        
        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(10deg); }
        }
        
        .maintenance-container {
            text-align: center;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(15px);
            padding: 3rem;
            border-radius: 25px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
            max-width: 700px;
            margin: 2rem;
            position: relative;
            z-index: 1;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            margin-bottom: 2rem;
            opacity: 0.95;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        
        .maintenance-icon {
            font-size: 5rem;
            margin-bottom: 2rem;
            color: #fff;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        .maintenance-title {
            font-size: 3rem;
            margin-bottom: 1.5rem;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .maintenance-message {
            font-size: 1.3rem;
            margin-bottom: 2.5rem;
            line-height: 1.7;
            opacity: 0.95;
            white-space: pre-line;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        
        .maintenance-info {
            background: rgba(255, 255, 255, 0.15);
            padding: 2rem;
            border-radius: 15px;
            margin-bottom: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .maintenance-time {
            font-size: 1.2rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        
        .countdown {
            font-size: 1.5rem;
            font-weight: bold;
            color: #fff;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            margin: 1rem 0;
        }
        
        .contact-info {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .contact-link {
            color: #fff;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
            font-size: 1.1rem;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .contact-link:hover {
            opacity: 0.8;
            text-decoration: underline;
            transform: translateY(-2px);
        }
        
        .admin-links {
            position: fixed;
            bottom: 30px;
            right: 30px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .admin-link {
            background: rgba(255, 255, 255, 0.25);
            padding: 15px 20px;
            border-radius: 15px;
            text-decoration: none;
            color: white;
            font-size: 1rem;
            font-weight: 500;
            transition: all 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.3);
            backdrop-filter: blur(10px);
            text-align: center;
        }
        
        .admin-link:hover {
            background: rgba(255, 255, 255, 0.35);
            color: white;
            text-decoration: none;
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }
        
        .refresh-info {
            margin-top: 1rem;
            font-size: 0.9rem;
            opacity: 0.7;
        }
        
        @media (max-width: 768px) {
            .maintenance-container {
                padding: 2rem;
                margin: 1rem;
            }
            
            .maintenance-title {
                font-size: 2.2rem;
            }
            
            .maintenance-icon {
                font-size: 4rem;
            }
            
            .logo {
                font-size: 1.5rem;
            }
            
            .admin-links {
                bottom: 20px;
                right: 20px;
            }
            
            .admin-link {
                padding: 12px 16px;
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <div class="background-animation">
        <div class="floating-icon"><i class="fas fa-gem"></i></div>
        <div class="floating-icon"><i class="fas fa-tools"></i></div>
        <div class="floating-icon"><i class="fas fa-cog"></i></div>
    </div>

    <div class="maintenance-container">
        <div class="logo">
            <i class="fas fa-gem"></i>
            Crystos Jewel
        </div>
        
        <div class="maintenance-icon">
            <i class="fas fa-tools"></i>
        </div>
        
        <h1 class="maintenance-title">Site en Maintenance</h1>
        
        <p class="maintenance-message">${maintenanceMessage}</p>
        
        <div class="maintenance-info">
            ${maintenanceEndTime ? `
                <div class="maintenance-time">
                    <i class="fas fa-clock"></i>
                    <span>Retour prévu : ${new Date(maintenanceEndTime).toLocaleString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</span>
                </div>
                
                <div class="countdown" id="countdown">
                    <i class="fas fa-hourglass-half"></i>
                    <span id="countdown-text">Calcul en cours...</span>
                </div>
                
                <script>
                    function updateCountdown() {
                        const endTime = new Date('${maintenanceEndTime}');
                        const now = new Date();
                        const diff = endTime - now;
                        
                        if (diff <= 0) {
                            document.getElementById('countdown-text').innerHTML = 
                                '<i class="fas fa-check"></i> Maintenance terminée ! Rechargement...';
                            setTimeout(() => window.location.reload(), 2000);
                            return;
                        }
                        
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                        
                        document.getElementById('countdown-text').textContent = 
                            hours > 0 ? 
                            \`\${hours}h \${minutes}m \${seconds}s\` : 
                            \`\${minutes}m \${seconds}s\`;
                    }
                    
                    updateCountdown();
                    setInterval(updateCountdown, 1000);
                </script>
            ` : ''}
            
            <div class="maintenance-time">
                <i class="fas fa-heart"></i>
                <span>Merci pour votre patience</span>
            </div>
            
            <div class="refresh-info">
                <i class="fas fa-sync-alt"></i>
                Page actualisée automatiquement toutes les 30 secondes
            </div>
        </div>
        
        <div class="contact-info">
            <p style="margin-bottom: 1rem;">Pour toute urgence :</p>
            <a href="mailto:${contactEmail}" class="contact-link">
                <i class="fas fa-envelope"></i>
                ${contactEmail}
            </a>
        </div>
    </div>
    
    <div class="admin-links">
        <a href="/admin/parametres" class="admin-link">
            <i class="fas fa-cogs"></i> Paramètres
        </a>
        <a href="/connexion-inscription" class="admin-link">
            <i class="fas fa-sign-in-alt"></i> Connexion
        </a>
    </div>
</body>
</html>
        `);

    } catch (error) {
        console.error('❌ Erreur middleware maintenance:', error);
        next(); // En cas d'erreur, laisser passer pour éviter de casser le site
    }
};

// Fonction utilitaire pour vérifier le statut de maintenance
export const getMaintenanceStatus = async () => {
    try {
        const setting = await Setting.findOne({
            where: { 
                section: 'maintenance',
                key: 'maintenance_enabled'
            }
        });
        
        return {
            enabled: setting?.value === 'true',
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Erreur vérification maintenance:', error);
        return { enabled: false, error: error.message };
    }
};