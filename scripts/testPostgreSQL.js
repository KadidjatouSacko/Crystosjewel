// scripts/testPostgreSQL.js
import "dotenv/config";
import { sequelize } from '../app/models/sequelize-client.js';

async function testPostgreSQLConfig() {
    try {
        console.log('🔍 Test de la configuration PostgreSQL...');
        
        // Test de connexion
        await sequelize.authenticate();
        console.log('✅ Connexion PostgreSQL réussie');
        
        // Vérifier les paramètres critiques
        const configChecks = [
            'max_locks_per_transaction',
            'shared_buffers',
            'max_connections'
        ];
        
        for (const param of configChecks) {
            try {
                const result = await sequelize.query(`SHOW ${param};`);
                const value = result[0][0][param];
                console.log(`📋 ${param}: ${value}`);
                
                if (param === 'max_locks_per_transaction' && parseInt(value) < 128) {
                    console.log(`⚠️  ATTENTION: ${param} devrait être >= 128 (actuellement ${value})`);
                }
            } catch (error) {
                console.log(`❌ Impossible de vérifier ${param}: ${error.message}`);
            }
        }
        
        // Test de création de table simple
        console.log('\n🧪 Test de création de table...');
        
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS test_locks (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100),
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            
            await sequelize.query(`ALTER TABLE test_locks ADD COLUMN IF NOT EXISTS test_col VARCHAR(50);`);
            await sequelize.query(`DROP TABLE IF EXISTS test_locks;`);
            
            console.log('✅ Test de création/modification de table réussi');
            
        } catch (error) {
            console.log('❌ Échec du test de table:', error.message);
            
            if (error.message.includes('mémoire partagée épuisée')) {
                console.log('\n🚨 PROBLÈME DÉTECTÉ:');
                console.log('La mémoire partagée PostgreSQL est épuisée.');
                console.log('\n📋 SOLUTIONS:');
                console.log('1. Trouvez postgresql.conf avec: SHOW config_file;');
                console.log('2. Ajoutez: max_locks_per_transaction = 256');
                console.log('3. Ajoutez: shared_buffers = 256MB');
                console.log('4. Redémarrez PostgreSQL');
            }
        }
        
        console.log('\n✅ Test terminé');
        
    } catch (error) {
        console.error('❌ Erreur de test:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n🚨 PostgreSQL ne semble pas démarré');
            console.log('📋 Vérifiez le service PostgreSQL');
        }
        
    } finally {
        await sequelize.close();
    }
}

// Lancer le test
testPostgreSQLConfig();