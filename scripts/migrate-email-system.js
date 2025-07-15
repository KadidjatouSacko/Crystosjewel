// scripts/migrate-email-system.js

import { sequelize } from '../app/models/sequelize-client.js';
import { EmailCampaign, EmailCampaignRecipient, EmailTemplate } from '../app/models/index.js';

export async function migrateEmailSystem() {
    try {
        console.log('🚀 Migration du système d\'emails...');

        // Synchroniser les nouveaux modèles
        await EmailCampaign.sync({ alter: true });
        await EmailCampaignRecipient.sync({ alter: true });
        await EmailTemplate.sync({ alter: true });

        // Insérer les templates par défaut
        const defaultTemplates = [
            {
                template_key: 'elegant',
                name: 'Élégant',
                description: 'Template élégant pour les communications premium',
                category: 'newsletter',
                html_content: `
                    <div style="font-family: Arial, sans-serif; color: #1e293b;">
                        <h2 style="color: #d89ab3;">{{subject}}</h2>
                        <p>Bonjour {{customer_name}},</p>
                        {{{content}}}
                        <p>Cordialement,<br><strong>L'équipe CrystosJewel</strong></p>
                    </div>
                `,
                variables: ['customer_name', 'subject', 'content']
            },
            {
                template_key: 'modern',
                name: 'Moderne',
                description: 'Template moderne pour les actualités',
                category: 'newsletter',
                html_content: `
                    <div style="font-family: Arial, sans-serif; color: #111827;">
                        <h1 style="color: #3b82f6;">{{subject}}</h1>
                        <p><strong>Bonjour {{customer_name}},</strong></p>
                        {{{content}}}
                        <p>À bientôt,<br>CrystosJewel</p>
                    </div>
                `,
                variables: ['customer_name', 'subject', 'content']
            },
            {
                template_key: 'promo',
                name: 'Promotion',
                description: 'Template pour les offres spéciales',
                category: 'promotion',
                html_content: `
                    <div style="font-family: Arial, sans-serif; color: #92400e;">
                        <h1 style="color: #f59e0b; text-align: center;">🔥 {{subject}} 🔥</h1>
                        <p><strong>Bonjour {{customer_name}},</strong></p>
                        {{{content}}}
                        <p>Ne manquez pas cette opportunité unique !</p>
                    </div>
                `,
                variables: ['customer_name', 'subject', 'content']
            },
            {
                template_key: 'newsletter',
                name: 'Newsletter',
                description: 'Template pour les newsletters mensuelles',
                category: 'newsletter',
                html_content: `
                    <div style="font-family: Arial, sans-serif; color: #064e3b;">
                        <h2 style="color: #10b981;">Newsletter CrystosJewel</h2>
                        <p>Bonjour {{customer_name}},</p>
                        {{{content}}}
                        <p>Bonne lecture !<br>L'équipe CrystosJewel</p>
                    </div>
                `,
                variables: ['customer_name', 'subject', 'content']
            }
        ];

        for (const template of defaultTemplates) {
            await EmailTemplate.findOrCreate({
                where: { template_key: template.template_key },
                defaults: template
            });
        }

        console.log('✅ Migration système d\'emails terminée');
        
    } catch (error) {
        console.error('❌ Erreur migration emails:', error);
        throw error;
    }
}

// Lancer la migration si ce script est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateEmailSystem()
        .then(() => {
            console.log('✅ Migration terminée avec succès');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erreur migration:', error);
            process.exit(1);
        });
}