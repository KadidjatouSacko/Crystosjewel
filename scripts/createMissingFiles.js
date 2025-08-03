// scripts/createMissingFiles.js
import fs from 'fs';
import path from 'path';

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Dossier créé: ${dirPath}`);
    }
}

function createFile(filePath, content) {
    const dir = path.dirname(filePath);
    ensureDirectoryExists(dir);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`📝 Fichier créé: ${filePath}`);
}

// 1. Créer le dossier scripts
ensureDirectoryExists('./scripts');

// 2. Créer initMaintenanceSettings.js
const initMaintenanceSettings = `// scripts/initMaintenanceSettings.js
import "dotenv/config";
import { sequelize } from '../app/models/sequelize-client.js';

async function initMaintenanceSettings() {
    try {
        console.log('🔧 Initialisation des paramètres de maintenance...');
        
        // Connexion
        await sequelize.authenticate();
        console.log('✅ Connexion réussie');
        
        // Créer la table settings si elle n'existe pas
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
        
        console.log('✅ Table settings créée/vérifiée');
        
        // Insérer les paramètres de maintenance par défaut
        const maintenanceSettings = [
            {
                section: 'maintenance',
                key: 'enabled',
                value: 'false',
                type: 'boolean',
                description: 'Active ou désactive le mode maintenance'
            },
            {
                section: 'maintenance', 
                key: 'message',
                value: 'Site temporairement indisponible pour maintenance technique',
                type: 'string',
                description: 'Message affiché pendant la maintenance'
            },
            {
                section: 'maintenance',
                key: 'allowed_ips',
                value: '["127.0.0.1", "localhost"]',
                type: 'json',
                description: 'IPs autorisées pendant la maintenance'
            }
        ];
        
        for (const setting of maintenanceSettings) {
            await sequelize.query(\`
                INSERT INTO settings (section, key, value, type, description, is_public)
                VALUES (:section, :key, :value, :type, :description, :is_public)
                ON CONFLICT (section, key) DO UPDATE SET
                    description = EXCLUDED.description,
                    type = EXCLUDED.type,
                    updated_at = NOW()
            \`, {
                replacements: {
                    ...setting,
                    is_public: false
                }
            });
        }
        
        console.log('✅ Paramètres de maintenance initialisés');
        
        // Vérifier les paramètres créés
        const [results] = await sequelize.query(\`
            SELECT section, key, value, type 
            FROM settings 
            WHERE section = 'maintenance'
            ORDER BY key
        \`);
        
        console.log('\\n📋 Paramètres de maintenance créés:');
        results.forEach(row => {
            console.log(\`   \${row.section}.\${row.key} = \${row.value} (\${row.type})\`);
        });
        
        console.log('\\n✅ Initialisation terminée avec succès');
        
    } catch (error) {
        console.error('❌ Erreur lors de l\\'initialisation:', error);
        throw error;
        
    } finally {
        await sequelize.close();
    }
}

// Lancer l'initialisation
initMaintenanceSettings();`;

createFile('./scripts/initMaintenanceSettings.js', initMaintenanceSettings);

// 3. Créer testPostgreSQL.js (version corrigée)
const testPostgreSQL = `// scripts/testPostgreSQL.js
import "dotenv/config";
import { sequelize } from '../app/models/sequelize-client.js';

async function testPostgreSQLConfig() {
    try {
        console.log('🔍 Test de la configuration PostgreSQL...');
        
        // Test de connexion
        await sequelize.authenticate();
        console.log('✅ Connexion PostgreSQL réussie');
        
        // Vérifier les paramètres critiques (version corrigée)
        const configChecks = [
            'max_locks_per_transaction',
            'shared_buffers',
            'max_connections'
        ];
        
        for (const param of configChecks) {
            try {
                const [results] = await sequelize.query(\`SHOW \${param};\`);
                const value = results[0][param];
                console.log(\`📋 \${param}: \${value}\`);
                
                if (param === 'max_locks_per_transaction' && parseInt(value) < 128) {
                    console.log(\`⚠️  ATTENTION: \${param} devrait être >= 128 (actuellement \${value})\`);
                }
            } catch (error) {
                console.log(\`❌ Impossible de vérifier \${param}: \${error.message}\`);
            }
        }
        
        // Test de création de table simple
        console.log('\\n🧪 Test de création de table...');
        
        try {
            await sequelize.query(\`
                CREATE TABLE IF NOT EXISTS test_locks (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100),
                    created_at TIMESTAMP DEFAULT NOW()
                );
            \`);
            
            await sequelize.query(\`ALTER TABLE test_locks ADD COLUMN IF NOT EXISTS test_col VARCHAR(50);\`);
            await sequelize.query(\`DROP TABLE IF EXISTS test_locks;\`);
            
            console.log('✅ Test de création/modification de table réussi');
            
        } catch (error) {
            console.log('❌ Échec du test de table:', error.message);
            
            if (error.message.includes('mémoire partagée épuisée')) {
                console.log('\\n🚨 PROBLÈME DÉTECTÉ:');
                console.log('La mémoire partagée PostgreSQL est épuisée.');
                console.log('\\n📋 SOLUTIONS:');
                console.log('1. Trouvez postgresql.conf avec: SHOW config_file;');
                console.log('2. Décommentez: max_locks_per_transaction = 256');
                console.log('3. Ajoutez: shared_buffers = 256MB');
                console.log('4. Redémarrez PostgreSQL avec: net restart postgresql-x64-17');
            }
        }
        
        console.log('\\n✅ Test terminé');
        
    } catch (error) {
        console.error('❌ Erreur de test:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\\n🚨 PostgreSQL ne semble pas démarré');
            console.log('📋 Vérifiez le service PostgreSQL');
        }
        
    } finally {
        await sequelize.close();
    }
}

// Lancer le test
testPostgreSQLConfig();`;

createFile('./scripts/testPostgreSQL.js', testPostgreSQL);

// 4. Créer settingsModel.js
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
        allowNull: false,
        comment: 'Section du paramètre (maintenance, general, etc.)'
    },
    key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Clé unique du paramètre'
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Valeur du paramètre'
    },
    type: {
        type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
        defaultValue: 'string',
        comment: 'Type de donnée'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Description du paramètre'
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Paramètre visible côté client'
    }
}, {
    sequelize,
    tableName: "settings",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['section', 'key'],
            name: 'settings_section_key_unique'
        },
        {
            fields: ['section'],
            name: 'settings_section_idx'
        },
        {
            fields: ['is_public'],
            name: 'settings_public_idx'
        }
    ]
});

export default Setting;`;

createFile('./app/models/settingsModel.js', settingsModel);

console.log('\n✅ Tous les fichiers manquants ont été créés !');
console.log('\n📋 Prochaines étapes:');
console.log('1. Redémarrez PostgreSQL: net restart postgresql-x64-17');
console.log('2. Lancez: node scripts/initMaintenanceSettings.js');
console.log('3. Testez: node scripts/testPostgreSQL.js');
console.log('4. Démarrez l\\'app: npm run dev');`;

createFile('./scripts/createMissingFiles.js', createMissingFiles);

console.log('🎯 Script de création des fichiers manquants créé !');
console.log('📋 Exécutez: node scripts/createMissingFiles.js');