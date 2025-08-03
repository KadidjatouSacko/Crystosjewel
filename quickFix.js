// quickFix.js - SOLUTION EXPRESS pour tout réparer d'un coup !
import fs from 'fs';
import path from 'path';

console.log('🚀 RÉPARATION EXPRESS DE CRYSTOSJEWEL');
console.log('=====================================\n');

function createDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Dossier créé: ${dir}`);
    }
}

function createFile(filePath, content) {
    const dir = path.dirname(filePath);
    createDirectory(dir);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fichier créé: ${filePath}`);
}

// 1. CRÉER LES DOSSIERS NÉCESSAIRES
console.log('📁 Création des dossiers...');
createDirectory('./scripts');
createDirectory('./app/models');
createDirectory('./app/views');
createDirectory('./app/middleware');

// 2. CRÉER LE MODÈLE SETTINGS (le plus important)
console.log('\n📝 Création du modèle Settings...');
const settingsModel = `// app/models/settingsModel.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class Setting extends Model {}

Setting.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    section: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    key: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    type: {
        type: DataTypes.STRING(20),
        defaultValue: 'string'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    sequelize,
    tableName: "settings",
    timestamps: true,
    underscored: true
});

export default Setting;`;

createFile('./app/models/settingsModel.js', settingsModel);

// 3. MAINTENANCE MIDDLEWARE SIMPLIFIÉ
console.log('\n🔧 Création du middleware de maintenance...');
const maintenanceMiddleware = `// app/middleware/maintenanceMiddleware.js
import { sequelize } from '../models/sequelize-client.js';

export async function maintenanceMiddleware(req, res, next) {
    try {
        // Variables par défaut
        let maintenanceActive = false;
        let maintenanceMessage = 'Site en maintenance temporaire';
        
        // Vérification simple dans la base
        try {
            const [results] = await sequelize.query(
                "SELECT value FROM settings WHERE section = 'maintenance' AND key = 'enabled' LIMIT 1"
            );
            
            if (results.length > 0) {
                maintenanceActive = results[0].value === 'true';
            }
        } catch (dbError) {
            // Si erreur DB, maintenance = false
            maintenanceActive = false;
        }
        
        // Vérifier si admin
        const isAdmin = req.session?.user?.role_id === 2 || req.session?.user?.isAdmin === true;
        
        console.log('🔍 Maintenance:', { active: maintenanceActive, isAdmin, path: req.path });
        
        // Si maintenance active et pas admin
        if (maintenanceActive && !isAdmin) {
            const excludedPaths = ['/admin', '/css', '/js', '/images', '/uploads'];
            const isExcluded = excludedPaths.some(path => req.path.startsWith(path));
            
            if (!isExcluded) {
                return res.status(503).send(\`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Maintenance - CrystosJewel</title>
                        <style>
                            body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
                            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                            .icon { font-size: 60px; margin-bottom: 20px; }
                            h1 { color: #333; margin-bottom: 20px; }
                            p { color: #666; line-height: 1.6; }
                            .admin-link { position: fixed; bottom: 20px; right: 20px; padding: 10px; background: #333; color: white; text-decoration: none; border-radius: 5px; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="icon">🔧</div>
                            <h1>Site en maintenance</h1>
                            <p>\${maintenanceMessage}</p>
                            <p>Nous travaillons pour améliorer votre expérience. Le site sera de nouveau disponible très prochainement.</p>
                        </div>
                        <a href="/admin" class="admin-link">Admin</a>
                        <script>
                            setTimeout(() => window.location.reload(), 30000);
                        </script>
                    </body>
                    </html>
                \`);
            }
        }
        
        // Ajouter aux locals
        res.locals.maintenanceActive = maintenanceActive;
        res.locals.isMaintenanceMode = maintenanceActive;
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur middleware maintenance:', error);
        res.locals.maintenanceActive = false;
        res.locals.isMaintenanceMode = false;
        next();
    }
}

export default maintenanceMiddleware;`;

createFile('./app/middleware/maintenanceMiddleware.js', maintenanceMiddleware);

// 4. SCRIPT D'INITIALISATION SIMPLE
console.log('\n📋 Création du script d\'initialisation...');
const initScript = `// scripts/initMaintenanceSettings.js
import "dotenv/config";
import { sequelize } from '../app/models/sequelize-client.js';

async function init() {
    try {
        console.log('🔧 Initialisation rapide...');
        
        await sequelize.authenticate();
        console.log('✅ Connexion DB OK');
        
        // Créer table settings
        await sequelize.query(\`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                section VARCHAR(50) NOT NULL,
                key VARCHAR(100) NOT NULL,
                value TEXT,
                type VARCHAR(20) DEFAULT 'string',
                description TEXT,
                is_public BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(section, key)
            );
        \`);
        
        // Insérer paramètres
        await sequelize.query(\`
            INSERT INTO settings (section, key, value, type, description) 
            VALUES ('maintenance', 'enabled', 'false', 'boolean', 'Mode maintenance')
            ON CONFLICT (section, key) DO NOTHING;
        \`);
        
        await sequelize.query(\`
            INSERT INTO settings (section, key, value, type, description) 
            VALUES ('maintenance', 'message', 'Site en maintenance technique', 'string', 'Message maintenance')
            ON CONFLICT (section, key) DO NOTHING;
        \`);
        
        console.log('✅ Paramètres initialisés');
        
        const [results] = await sequelize.query("SELECT * FROM settings WHERE section = 'maintenance'");
        console.log('📋 Paramètres:', results);
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    } finally {
        await sequelize.close();
    }
}

init();`;

createFile('./scripts/initMaintenanceSettings.js', initScript);

// 5. VUE DE MAINTENANCE SIMPLE
console.log('\n🎨 Création de la vue maintenance...');
const maintenanceView = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maintenance - CrystosJewel</title>
    <style>
        body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: white; border-radius: 15px; padding: 40px; text-align: center; max-width: 500px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .icon { font-size: 60px; margin-bottom: 20px; color: #f39c12; }
        h1 { color: #2c3e50; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; margin-bottom: 15px; }
        .progress { width: 100%; height: 4px; background: #ecf0f1; border-radius: 2px; margin: 20px 0; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #f39c12, #e67e22); animation: loading 2s infinite; }
        @keyframes loading { 0% { width: 0%; } 50% { width: 70%; } 100% { width: 100%; } }
        .contact { margin-top: 20px; font-size: 14px; color: #888; }
        .contact a { color: #f39c12; text-decoration: none; }
        .admin { position: fixed; bottom: 20px; right: 20px; padding: 10px; background: rgba(0,0,0,0.7); color: white; text-decoration: none; border-radius: 5px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔧</div>
        <h1>Site en maintenance</h1>
        <p><%= message || 'Nous effectuons une maintenance pour améliorer votre expérience.' %></p>
        <p>Le site sera de nouveau disponible très prochainement.</p>
        <div class="progress"><div class="progress-bar"></div></div>
        <div class="contact">
            Questions ? <a href="mailto:contact@crystosjewel.com">contact@crystosjewel.com</a>
        </div>
    </div>
    <a href="/admin" class="admin">Admin</a>
    <script>setTimeout(() => window.location.reload(), 30000);</script>
</body>
</html>`;

createFile('./app/views/maintenance.ejs', maintenanceView);

// 6. INSTRUCTIONS FINALES
console.log('\n🎯 RÉPARATION TERMINÉE !');
console.log('================================');
console.log('');
console.log('✅ Tous les fichiers nécessaires ont été créés');
console.log('');
console.log('📋 POUR REDÉMARRER POSTGRESQL :');
console.log('1. Ouvrez une invite de commande EN TANT QU\'ADMINISTRATEUR');
console.log('2. Tapez: net stop postgresql-x64-17');
console.log('3. Tapez: net start postgresql-x64-17');
console.log('');
console.log('📋 POUR TERMINER LA CONFIGURATION :');
console.log('1. node scripts/initMaintenanceSettings.js');
console.log('2. npm run dev');
console.log('');
console.log('🚀 Votre application devrait maintenant fonctionner !');
console.log('');
console.log('💡 Si PostgreSQL refuse de redémarrer, utilisez le Gestionnaire de Services Windows :');
console.log('   - Windows + R → services.msc → Chercher PostgreSQL → Clic droit → Redémarrer');

// Vérifier si les fichiers ont été créés
const filesToCheck = [
    './app/models/settingsModel.js',
    './app/middleware/maintenanceMiddleware.js',
    './scripts/initMaintenanceSettings.js',
    './app/views/maintenance.ejs'
];

console.log('\n📋 VÉRIFICATION DES FICHIERS :');
filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(\`✅ \${file}\`);
    } else {
        console.log(\`❌ \${file} - ÉCHEC\`);
    }
});`;

createFile('./quickFix.js', quickFix);

console.log('\n🎯 Script de réparation express créé !');
console.log('📋 Exécutez maintenant: node quickFix.js');