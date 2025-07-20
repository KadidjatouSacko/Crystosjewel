import { sequelize } from '../app/models/sequelize-client.js';
import { EmailTemplate } from '../app/models/emailTemplateModel.js';
import { EmailLog } from '../app/models/emailLogModel.js';

async function initEmailSystem() {
    try {
        console.log('🚀 Initialisation du système email...');
        
        // ✅ CRÉER LES TABLES SI ELLES N'EXISTENT PAS
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
        
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS email_logs (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER REFERENCES customer(id),
                email_type VARCHAR(100) NOT NULL,
                recipient_email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                sent_at TIMESTAMP
            );
        `);
        
        console.log('✅ Tables email créées');
        
        // ✅ CRÉER LES TEMPLATES PAR DÉFAUT
        const defaultTemplates = [
            {
                template_name: 'welcome',
                subject: 'Bienvenue chez CrystosJewel !',
                html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #a855f7;">Bienvenue {{firstName}} !</h1>
                        <p>Merci de rejoindre la famille CrystosJewel.</p>
                        <p>Découvrez notre collection exclusive de bijoux élégants.</p>
                    </div>
                `,
                variables: { firstName: 'Prénom du client' }
            },
            {
                template_name: 'order_confirmation',
                subject: 'Confirmation de votre commande {{orderNumber}}',
                html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #10b981;">Commande confirmée !</h1>
                        <p>Bonjour {{firstName}},</p>
                        <p>Votre commande {{orderNumber}} a été confirmée.</p>
                        <p>Total: {{total}}€</p>
                    </div>
                `,
                variables: { firstName: 'Prénom', orderNumber: 'Numéro commande', total: 'Montant total' }
            },
            {
                template_name: 'shipping_notification',
                subject: 'Votre commande {{orderNumber}} est expédiée',
                html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #0ea5e9;">Commande expédiée !</h1>
                        <p>Bonjour {{firstName}},</p>
                        <p>Votre commande {{orderNumber}} est en route.</p>
                        <p>Numéro de suivi: {{trackingNumber}}</p>
                    </div>
                `,
                variables: { firstName: 'Prénom', orderNumber: 'Numéro commande', trackingNumber: 'Numéro de suivi' }
            }
        ];
        
        for (const template of defaultTemplates) {
            const existing = await EmailTemplate.findOne({
                where: { template_name: template.template_name }
            });
            
            if (!existing) {
                await EmailTemplate.create(template);
                console.log(`✅ Template créé: ${template.template_name}`);
            }
        }
        
        // ✅ VÉRIFIER LA CONFIGURATION EMAIL
        const { verifyEmailConnection } = await import('../app/services/mailService.js');
        const isConnected = await verifyEmailConnection();
        
        console.log(`📧 Connexion email: ${isConnected ? '✅ OK' : '❌ ERREUR'}`);
        
        if (!isConnected) {
            console.log('⚠️ Vérifiez vos variables d\'environnement:');
            console.log('  - MAIL_USER');
            console.log('  - MAIL_PASS');
            console.log('  - BASE_URL');
            console.log('  - ADMIN_EMAIL');
        }
        
        console.log('🎉 Système email initialisé avec succès !');
        
    } catch (error) {
        console.error('❌ Erreur initialisation système email:', error);
    }
}

// Exporter pour utilisation
export { initEmailSystem };

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    initEmailSystem().then(() => process.exit(0));
}