// ===================================
// scripts/migrate-email-system.js - COMPLET
// ===================================

import { sequelize } from '../app/models/sequelize-client.js';
import {
    EmailCampaign,
    EmailCampaignRecipient,
    EmailTemplate,
    EmailUnsubscribe
} from '../app/models/emailRelations.js';

console.log('🚀 === MIGRATION SYSTÈME EMAIL ===');

async function migrateEmailSystem() {
    try {
        console.log('📊 Synchronisation des tables...');
        
        // Synchroniser les tables dans l'ordre des dépendances
        await EmailTemplate.sync({ alter: true });
        console.log('✅ Table email_templates créée/mise à jour');
        
        await EmailCampaign.sync({ alter: true });
        console.log('✅ Table email_campaigns créée/mise à jour');
        
        await EmailCampaignRecipient.sync({ alter: true });
        console.log('✅ Table email_campaign_recipients créée/mise à jour');
        
        await EmailUnsubscribe.sync({ alter: true });
        console.log('✅ Table email_unsubscribes créée/mise à jour');

        console.log('📋 Insertion des templates par défaut...');
        await insertDefaultTemplates();
        
        console.log('🎉 Migration terminée avec succès !');
        console.log('');
        console.log('📋 === RÉCAPITULATIF ===');
        console.log('✅ Tables créées :');
        console.log('   - email_templates');
        console.log('   - email_campaigns');
        console.log('   - email_campaign_recipients');
        console.log('   - email_unsubscribes');
        console.log('✅ 4 Templates par défaut insérés');
        console.log('');
        console.log('🚀 Vous pouvez maintenant accéder à /admin/emails');
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    }
}

async function insertDefaultTemplates() {
    const templates = [
        {
            name: 'Template Élégant',
            description: 'Template minimaliste et professionnel pour tous types de communications',
            subject: 'Message important de CrystosJewel',
            type: 'custom',
            category: 'general',
            content: `
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
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 300; letter-spacing: 1px;">
                                💎 CrystosJewel
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #2d3748; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">
                                Bonjour {{first_name}},
                            </h2>
                            
                            <div style="color: #4a5568; font-size: 16px; line-height: 1.8;">
                                <p style="margin: 0 0 20px 0;">
                                    Nous espérons que vous allez bien. Nous tenions à partager avec vous quelques nouvelles importantes.
                                </p>
                                
                                <p style="margin: 0 0 20px 0;">
                                    [Votre contenu personnalisé ici]
                                </p>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="#" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                        Découvrir
                                    </a>
                                </div>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
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
</html>`
        },
        
        {
            name: 'Template Moderne',
            description: 'Design contemporain avec des éléments visuels dynamiques',
            subject: '🚀 Nouveautés chez CrystosJewel',
            type: 'newsletter',
            category: 'marketing',
            content: `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CrystosJewel Newsletter</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td align="center" style="padding: 20px;">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);">
                    <!-- Dynamic Header -->
                    <tr>
                        <td style="background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4); background-size: 400% 400%; padding: 50px 40px; text-align: center;">
                            <h1 style="color: #ffffff; font-size: 36px; margin: 0; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.3); letter-spacing: -1px;">
                                💎 CrystosJewel
                            </h1>
                            <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 10px 0 0 0; font-weight: 300;">
                                Innovation • Élégance • Excellence
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Content with Cards -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            <h2 style="color: #2d3748; font-size: 28px; margin: 0 0 30px 0; text-align: center; font-weight: 700;">
                                Salut {{first_name}} ! 👋
                            </h2>
                            
                            <!-- Card Style Content -->
                            <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #667eea;">
                                <h3 style="color: #2d3748; font-size: 20px; margin: 0 0 15px 0;">🎉 Actualités Excitantes</h3>
                                <p style="color: #4a5568; margin: 0; line-height: 1.7;">
                                    Découvrez nos dernières créations et les tendances qui façonnent l'avenir de la joaillerie.
                                </p>
                            </div>
                            
                            <!-- CTA Section -->
                            <div style="text-align: center; margin: 40px 0;">
                                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 48px; font-weight: 700; font-size: 16px;">
                                    Voir les Nouveautés →
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Modern Footer -->
                    <tr>
                        <td style="background: #2d3748; padding: 40px; text-align: center;">
                            <div style="color: #ffffff; font-size: 16px; margin-bottom: 20px;">
                                <strong>Restez connecté avec nous</strong>
                            </div>
                            <p style="color: #a0aec0; font-size: 14px; margin: 10px 0 0 0;">
                                © 2025 CrystosJewel - Tous droits réservés<br>
                                <a href="{{unsubscribe_url}}" style="color: #667eea; text-decoration: none;">Se désinscrire</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
        },
        
        {
            name: 'Template Promotion',
            description: 'Template optimisé pour les offres spéciales et promotions',
            subject: '🔥 OFFRE SPÉCIALE : -30% de réduction !',
            type: 'promotion',
            category: 'sales',
            content: `
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
                <!-- Urgent Banner -->
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background: linear-gradient(90deg, #ff6b6b, #ee5a24); border-radius: 12px 12px 0 0;">
                    <tr>
                        <td style="padding: 15px; text-align: center;">
                            <p style="color: #ffffff; font-size: 14px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                                ⏰ OFFRE LIMITÉE - Se termine bientôt !
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Main Content -->
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <h1 style="color: #ffffff; font-size: 32px; margin: 0; font-weight: 800;">
                                💎 CrystosJewel
                            </h1>
                            <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 5px 0 0 0;">
                                Bijoux d'Exception
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Big Discount -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; background: #fff5f5;">
                            <div style="display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: #ffffff; padding: 20px 40px; border-radius: 50px;">
                                <h2 style="font-size: 48px; margin: 0; font-weight: 900;">
                                    -30%
                                </h2>
                                <p style="font-size: 18px; margin: 5px 0 0 0; font-weight: 600;">
                                    SUR TOUT !
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Personalized Message -->
                    <tr>
                        <td style="padding: 30px 40px;">
                            <h3 style="color: #2d3748; font-size: 24px; text-align: center; margin: 0 0 20px 0;">
                                {{first_name}}, cette offre est pour VOUS ! 🎁
                            </h3>
                            
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 25px 0;">
                                Profitez de <strong>30% de réduction</strong> sur toute notre collection de bijoux d'exception.
                            </p>
                            
                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 50px; font-weight: 700; font-size: 18px; text-transform: uppercase;">
                                    🛍️ PROFITER DE L'OFFRE
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #2d3748; text-align: center;">
                            <p style="color: #a0aec0; font-size: 14px; margin: 0;">
                                © 2025 CrystosJewel - Tous droits réservés<br>
                                <a href="{{unsubscribe_url}}" style="color: #667eea; text-decoration: none;">Se désinscrire</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
        },
        
        {
            name: 'Template Newsletter',
            description: 'Template pour newsletters et communications régulières',
            subject: '📰 Newsletter CrystosJewel - Les actualités du mois',
            type: 'newsletter',
            category: 'communication',
            content: `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Newsletter CrystosJewel</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Georgia', serif; background-color: #f8f9fa; line-height: 1.6;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa;">
        <tr>
            <td align="center" style="padding: 30px 20px;">
                <table cellpadding="0" cellspacing="0" border="0" width="650" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px; border-bottom: 3px solid #667eea;">
                            <h1 style="color: #2d3748; font-size: 28px; margin: 0; font-weight: 400;">
                                💎 CrystosJewel Newsletter
                            </h1>
                            <p style="color: #718096; font-size: 16px; margin: 5px 0 0 0; font-style: italic;">
                                Votre dose mensuelle d'inspiration
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Welcome -->
                    <tr>
                        <td style="padding: 30px 40px 20px 40px;">
                            <h2 style="color: #2d3748; font-size: 22px; margin: 0 0 15px 0; font-weight: 400;">
                                Cher {{first_name}},
                            </h2>
                            <p style="color: #4a5568; font-size: 16px; margin: 0 0 20px 0;">
                                Bienvenue dans notre newsletter mensuelle ! Découvrez nos dernières créations, 
                                les tendances du moment et les événements à venir.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Article 1 -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <div style="border-left: 4px solid #667eea; padding-left: 20px; margin: 20px 0;">
                                <h3 style="color: #2d3748; font-size: 20px; margin: 0 0 10px 0; font-weight: 500;">
                                    🌟 Nouvelle Collection Printemps
                                </h3>
                                <p style="color: #4a5568; font-size: 15px; margin: 0 0 15px 0; line-height: 1.7;">
                                    Laissez-vous séduire par notre nouvelle collection printemps, inspirée des jardins 
                                    à la française. Des pièces délicates qui célèbrent la renaissance de la nature.
                                </p>
                                <a href="#" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 14px;">
                                    Découvrir la collection →
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- CTA Section -->
                    <tr>
                        <td style="padding: 30px 40px;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center;">
                                <h3 style="color: #ffffff; font-size: 22px; margin: 0 0 15px 0; font-weight: 500;">
                                    Restez connecté avec nous
                                </h3>
                                <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0 0 20px 0;">
                                    Suivez-nous sur nos réseaux sociaux pour ne rien manquer de l'actualité CrystosJewel
                                </p>
                                <a href="#" style="display: inline-block; background: #ffffff; color: #667eea; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">
                                    Nous suivre
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e2e8f0;">
                            <div style="text-align: center;">
                                <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0;">
                                    Merci de faire partie de la famille CrystosJewel
                                </p>
                                <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                                    © 2025 CrystosJewel - Tous droits réservés<br>
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
</html>`
        }
    ];

    // Insérer les templates s'ils n'existent pas déjà
    for (const templateData of templates) {
        const [template, created] = await EmailTemplate.findOrCreate({
            where: { name: templateData.name },
            defaults: templateData
        });
        
        if (created) {
            console.log(`✅ Template "${templateData.name}" créé`);
        } else {
            console.log(`ℹ️  Template "${templateData.name}" existe déjà`);
        }
    }
}

// Exécuter la migration
migrateEmailSystem()
    .then(() => {
        console.log('🎉 Migration terminée avec succès !');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erreur lors de la migration:', error);
        process.exit(1);
    });