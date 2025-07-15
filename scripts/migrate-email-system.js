// ===================================
// scripts/migrate-email-system-compatible.js - POUR VOTRE BDD EXISTANTE
// ===================================

import { sequelize } from '../app/models/sequelize-client.js';
import { DataTypes } from 'sequelize';

console.log('🚀 === MIGRATION SYSTÈME EMAIL (Compatible BDD existante) ===');

async function migrateEmailSystemCompatible() {
    try {
        console.log('📊 Synchronisation avec votre BDD existante...');
        
        // Test de connexion
        await sequelize.authenticate();
        console.log('✅ Connexion à la base de données réussie');

        // ===================================
        // 1. ADAPTER LA TABLE email_templates EXISTANTE
        // ===================================
        console.log('🔧 Adaptation de la table email_templates existante...');
        
        try {
            // Ajouter les colonnes manquantes une par une (si elles n'existent pas)
            const columnsToAdd = [
                { name: 'name', type: 'VARCHAR(255)', constraint: 'NULL' },
                { name: 'description', type: 'TEXT', constraint: 'NULL' },
                { name: 'type', type: 'VARCHAR(50)', constraint: 'DEFAULT \'custom\'' },
                { name: 'category', type: 'VARCHAR(100)', constraint: 'NULL' },
                { name: 'is_default', type: 'BOOLEAN', constraint: 'DEFAULT FALSE' },
                { name: 'thumbnail', type: 'TEXT', constraint: 'NULL' },
                { name: 'metadata', type: 'JSON', constraint: 'NULL' },
                { name: 'usage_count', type: 'INTEGER', constraint: 'DEFAULT 0' },
                { name: 'last_used_at', type: 'TIMESTAMP', constraint: 'NULL' },
                { name: 'updated_at', type: 'TIMESTAMP', constraint: 'DEFAULT CURRENT_TIMESTAMP' }
            ];

            for (const column of columnsToAdd) {
                try {
                    await sequelize.query(`ALTER TABLE email_templates ADD COLUMN ${column.name} ${column.type} ${column.constraint}`);
                    console.log(`✅ Colonne ${column.name} ajoutée`);
                } catch (error) {
                    if (error.message.includes('existe déjà') || error.message.includes('already exists')) {
                        console.log(`ℹ️  Colonne ${column.name} existe déjà`);
                    } else {
                        console.log(`⚠️  Erreur colonne ${column.name}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.log('⚠️  Erreur adaptation email_templates:', error.message);
        }

        // ===================================
        // 2. CRÉER LES NOUVELLES TABLES
        // ===================================
        console.log('📋 Création des nouvelles tables...');

        // Table email_campaigns
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS email_campaigns (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    subject VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    template_id INTEGER REFERENCES email_templates(id),
                    status VARCHAR(20) DEFAULT 'draft',
                    scheduled_at TIMESTAMP NULL,
                    sent_at TIMESTAMP NULL,
                    total_recipients INTEGER DEFAULT 0,
                    total_sent INTEGER DEFAULT 0,
                    total_delivered INTEGER DEFAULT 0,
                    total_opened INTEGER DEFAULT 0,
                    total_clicked INTEGER DEFAULT 0,
                    total_bounced INTEGER DEFAULT 0,
                    total_unsubscribed INTEGER DEFAULT 0,
                    sender_email VARCHAR(255) NOT NULL,
                    sender_name VARCHAR(255) NOT NULL,
                    reply_to VARCHAR(255) NULL,
                    tracking_enabled BOOLEAN DEFAULT TRUE,
                    metadata JSON DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Table email_campaigns créée');
        } catch (error) {
            console.log('ℹ️  Table email_campaigns:', error.message);
        }

        // Table email_campaign_recipients
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS email_campaign_recipients (
                    id SERIAL PRIMARY KEY,
                    campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
                    email VARCHAR(255) NOT NULL,
                    customer_id INTEGER REFERENCES customer(id) ON DELETE SET NULL,
                    first_name VARCHAR(100) NULL,
                    last_name VARCHAR(100) NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    sent_at TIMESTAMP NULL,
                    delivered_at TIMESTAMP NULL,
                    opened_at TIMESTAMP NULL,
                    clicked_at TIMESTAMP NULL,
                    bounced_at TIMESTAMP NULL,
                    bounce_reason TEXT NULL,
                    open_count INTEGER DEFAULT 0,
                    click_count INTEGER DEFAULT 0,
                    tracking_token VARCHAR(255) UNIQUE NULL,
                    metadata JSON DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Table email_campaign_recipients créée');
        } catch (error) {
            console.log('ℹ️  Table email_campaign_recipients:', error.message);
        }

        // Table email_unsubscribes
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS email_unsubscribes (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    token VARCHAR(255) UNIQUE NOT NULL,
                    reason VARCHAR(50) NULL,
                    other_reason TEXT NULL,
                    feedback_allowed BOOLEAN DEFAULT FALSE,
                    unsubscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ip_address VARCHAR(45) NULL,
                    user_agent TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Table email_unsubscribes créée');
        } catch (error) {
            console.log('ℹ️  Table email_unsubscribes:', error.message);
        }

        // ===================================
        // 3. CRÉER LES INDEX POUR LES PERFORMANCES
        // ===================================
        console.log('🔍 Création des index...');

        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status)',
            'CREATE INDEX IF NOT EXISTS idx_email_campaigns_sent_at ON email_campaigns(sent_at)',
            'CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign_id ON email_campaign_recipients(campaign_id)',
            'CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_email ON email_campaign_recipients(email)',
            'CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_status ON email_campaign_recipients(status)',
            'CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_tracking_token ON email_campaign_recipients(tracking_token)',
            'CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON email_unsubscribes(email)',
            'CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_token ON email_unsubscribes(token)'
        ];

        for (const indexSQL of indexes) {
            try {
                await sequelize.query(indexSQL);
            } catch (error) {
                // Les index peuvent déjà exister, on ignore l'erreur
            }
        }
        console.log('✅ Index créés');

        // ===================================
        // 4. INSÉRER LES TEMPLATES PAR DÉFAUT
        // ===================================
        console.log('📋 Insertion des templates par défaut...');
        await insertCompatibleTemplates();
        
        console.log('🎉 Migration terminée avec succès !');
        console.log('');
        console.log('📋 === RÉCAPITULATIF ===');
        console.log('✅ Table email_templates adaptée');
        console.log('✅ Table email_campaigns créée');
        console.log('✅ Table email_campaign_recipients créée');
        console.log('✅ Table email_unsubscribes créée');
        console.log('✅ Templates par défaut insérés');
        console.log('✅ Index de performance créés');
        console.log('');
        console.log('🚀 Vous pouvez maintenant accéder à /admin/emails');
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    }
}

async function insertCompatibleTemplates() {
    try {
        // Vérifier d'abord si des templates existent déjà
        const [existingTemplates] = await sequelize.query(
            "SELECT COUNT(*) as count FROM email_templates WHERE template_name LIKE '%CrystosJewel%'"
        );

        if (existingTemplates[0].count > 0) {
            console.log('ℹ️  Templates CrystosJewel déjà présents');
            return;
        }

        const templates = [
            {
                template_name: 'CrystosJewel Élégant',
                subject: 'Message important de CrystosJewel',
                html_content: `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CrystosJewel</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; line-height: 1.6;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 300; letter-spacing: 1px;">
                                💎 CrystosJewel
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #2d3748; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">
                                Bonjour {{first_name}},
                            </h2>
                            <div style="color: #4a5568; font-size: 16px; line-height: 1.8;">
                                <p style="margin: 0 0 20px 0;">
                                    Nous espérons que vous allez bien. Nous tenions à partager avec vous quelques nouvelles importantes.
                                </p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="#" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                        Découvrir
                                    </a>
                                </div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <div style="text-align: center; color: #718096; font-size: 14px;">
                                <p style="margin: 0 0 10px 0;">
                                    Merci de votre confiance,<br>
                                    <strong>L'équipe CrystosJewel</strong>
                                </p>
                                <p style="margin: 0; font-size: 12px;">
                                    <a href="{{unsubscribe_url}}" style="color: #667eea; text-decoration: none;">Se désinscrire</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
                text_content: 'Bonjour {{first_name}}, Message de CrystosJewel...',
                variables: '{"first_name": "Prénom du client", "unsubscribe_url": "Lien de désinscription"}',
                is_active: true,
                name: 'Template Élégant',
                type: 'custom',
                category: 'general'
            },
            {
                template_name: 'CrystosJewel Promotion',
                subject: '🔥 OFFRE SPÉCIALE CrystosJewel',
                html_content: `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offre Spéciale CrystosJewel</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #1a202c;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1a202c;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background: linear-gradient(90deg, #ff6b6b, #ee5a24); border-radius: 12px 12px 0 0;">
                    <tr>
                        <td style="padding: 15px; text-align: center;">
                            <p style="color: #ffffff; font-size: 14px; font-weight: 700; margin: 0; text-transform: uppercase;">
                                ⏰ OFFRE LIMITÉE - Se termine bientôt !
                            </p>
                        </td>
                    </tr>
                </table>
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff;">
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <h1 style="color: #ffffff; font-size: 32px; margin: 0; font-weight: 800;">
                                💎 CrystosJewel
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; background: #fff5f5;">
                            <div style="display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: #ffffff; padding: 20px 40px; border-radius: 50px;">
                                <h2 style="font-size: 48px; margin: 0; font-weight: 900;">-30%</h2>
                                <p style="font-size: 18px; margin: 5px 0 0 0; font-weight: 600;">SUR TOUT !</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px;">
                            <h3 style="color: #2d3748; font-size: 24px; text-align: center; margin: 0 0 20px 0;">
                                {{first_name}}, cette offre est pour VOUS ! 🎁
                            </h3>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 50px; font-weight: 700; font-size: 18px; text-transform: uppercase;">
                                    🛍️ PROFITER DE L'OFFRE
                                </a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
                text_content: 'Offre spéciale {{first_name}} : -30% sur tout !',
                variables: '{"first_name": "Prénom du client"}',
                is_active: true,
                name: 'Template Promotion',
                type: 'promotion',
                category: 'sales'
            }
        ];

        for (const template of templates) {
            try {
                await sequelize.query(`
                    INSERT INTO email_templates (
                        template_name, subject, html_content, text_content, 
                        variables, is_active, name, type, category, created_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                    )
                `, {
                    replacements: [
                        template.template_name,
                        template.subject,
                        template.html_content,
                        template.text_content,
                        template.variables,
                        template.is_active,
                        template.name,
                        template.type,
                        template.category
                    ]
                });
                
                console.log(`✅ Template "${template.name}" créé`);
            } catch (error) {
                console.log(`⚠️  Erreur template "${template.name}":`, error.message);
            }
        }
    } catch (error) {
        console.log('⚠️  Erreur insertion templates:', error.message);
    }
}

// Exécuter la migration
migrateEmailSystemCompatible()
    .then(() => {
        console.log('🎉 Migration terminée avec succès !');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erreur lors de la migration:', error);
        process.exit(1);
    });