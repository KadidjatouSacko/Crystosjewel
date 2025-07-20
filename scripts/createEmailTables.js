// ===================================================================
// 1. SCRIPT POUR CRÉER LES TABLES EMAIL (scripts/createEmailTables.js)
// ===================================================================

import { sequelize } from '../app/models/sequelize-client.js';

async function createEmailTables() {
    try {
        console.log('🔧 Création des tables email...');
        
        // ✅ CRÉER LA TABLE EMAIL_TEMPLATES
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS email_templates (
                id SERIAL PRIMARY KEY,
                template_name VARCHAR(255) UNIQUE NOT NULL,
                subject VARCHAR(255) NOT NULL,
                html_content TEXT NOT NULL,
                text_content TEXT,
                variables JSON,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        
        console.log('✅ Table email_templates créée');
        
        // ✅ CRÉER LA TABLE EMAIL_LOGS
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS email_logs (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER,
                email_type VARCHAR(100) NOT NULL,
                recipient_email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                sent_at TIMESTAMP
            );
        `);
        
        console.log('✅ Table email_logs créée');
        
        // ✅ AJOUTER DES TEMPLATES PAR DÉFAUT
        const templates = [
            {
                template_name: 'welcome',
                subject: 'Bienvenue chez CrystosJewel !',
                html_content: '<h1>Bienvenue {{firstName}} !</h1><p>Merci de rejoindre CrystosJewel.</p>',
                variables: '{"firstName": "Prénom du client"}'
            },
            {
                template_name: 'order_confirmation',
                subject: 'Confirmation de votre commande {{orderNumber}}',
                html_content: '<h1>Commande confirmée !</h1><p>Bonjour {{firstName}}, votre commande {{orderNumber}} a été confirmée.</p>',
                variables: '{"firstName": "Prénom", "orderNumber": "Numéro commande"}'
            }
        ];
        
        for (const template of templates) {
            try {
                await sequelize.query(`
                    INSERT INTO email_templates (template_name, subject, html_content, variables)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (template_name) DO NOTHING
                `, {
                    bind: [template.template_name, template.subject, template.html_content, template.variables]
                });
                console.log(`✅ Template ${template.template_name} ajouté`);
            } catch (error) {
                console.log(`⏭️ Template ${template.template_name} existe déjà`);
            }
        }
        
        console.log('🎉 Tables email créées avec succès !');
        
    } catch (error) {
        console.error('❌ Erreur création tables email:', error);
    }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    createEmailTables().then(() => process.exit(0));
}

export { createEmailTables };