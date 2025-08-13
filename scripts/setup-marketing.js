// scripts/setup-marketing.js - SCRIPT D'INSTALLATION DU SYSTÈME MARKETING
import { sequelize } from '../app/models/sequelize-client.js';
import { initializeMarketingService } from '../app/services/emailMarketingService.js';

console.log('🚀 Installation du système marketing CrystosJewel...');

async function setupMarketing() {
  try {
    console.log('📊 Création des tables marketing...');

    // Créer toutes les tables nécessaires
    await sequelize.query(`
      -- Table des campagnes email
      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        preheader TEXT,
        content TEXT NOT NULL,
        template VARCHAR(50) DEFAULT 'elegant',
        status VARCHAR(20) DEFAULT 'draft',
        from_name VARCHAR(100) DEFAULT 'CrystosJewel',
        recipients_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        open_count INTEGER DEFAULT 0,
        click_count INTEGER DEFAULT 0,
        unsubscribe_count INTEGER DEFAULT 0,
        created_by VARCHAR(100),
        scheduled_at TIMESTAMP,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table des destinataires de campagnes
      CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
        customer_id INTEGER REFERENCES customer(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        sent_at TIMESTAMP,
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        unsubscribed_at TIMESTAMP,
        bounce_reason TEXT,
        tracking_token VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table des templates email
      CREATE TABLE IF NOT EXISTS marketing_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        template_type VARCHAR(50) NOT NULL UNIQUE,
        content TEXT NOT NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table des désabonnements globaux
      CREATE TABLE IF NOT EXISTS marketing_unsubscribes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        unsubscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT
      );

      -- Table des logs d'emails (si elle n'existe pas déjà)
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        email_type VARCHAR(50) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        customer_id INTEGER REFERENCES customer(id) ON DELETE SET NULL,
        subject VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      );

      -- Index pour les performances
      CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_at ON marketing_campaigns(created_at);
      CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_campaign_id ON marketing_campaign_recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_email ON marketing_campaign_recipients(email);
      CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_tracking_token ON marketing_campaign_recipients(tracking_token);
      CREATE INDEX IF NOT EXISTS idx_marketing_unsubscribes_email ON marketing_unsubscribes(email);
      CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);
      CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);
    `);

    console.log('✅ Tables marketing créées avec succès');

    // Insérer les templates par défaut
    await insertDefaultTemplates();

    // Insérer des données de test
    await insertTestData();

    console.log('🎉 Installation du système marketing terminée avec succès !');
    console.log('');
    console.log('📝 Prochaines étapes :');
    console.log('1. Ajoutez les routes marketing dans votre app.js');
    console.log('2. Configurez vos variables d\'environnement email');
    console.log('3. Testez l\'éditeur d\'emails : /admin/marketing/email-editor');
    console.log('4. Consultez le dashboard : /admin/marketing/campaigns');

  } catch (error) {
    console.error('❌ Erreur lors de l\'installation:', error);
    process.exit(1);
  }
}

async function insertDefaultTemplates() {
  try {
    console.log('📄 Insertion des templates par défaut...');

    const templates = [
      {
        name: 'Élégant',
        template_type: 'elegant',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #d89ab3, #b794a8); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">{{subject}}</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">{{preheader}}</p>
            </div>
            <div style="padding: 30px 20px; background: white;">
              {{content}}
            </div>
            <div style="background: #f8fafc; padding: 15px 20px; font-size: 12px; color: #64748b; text-align: center;">
              <p>© 2025 CrystosJewel - Tous droits réservés</p>
              <p><a href="{{unsubscribeUrl}}" style="color: #64748b;">Se désabonner</a></p>
            </div>
          </div>
        `,
        is_default: true
      },
      {
        name: 'Moderne',
        template_type: 'modern',
        content: `
          <div style="font-family: 'Helvetica', sans-serif; max-width: 600px; margin: 0 auto; background: white;">
            <div style="background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 25px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 300;">{{subject}}</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">{{preheader}}</p>
            </div>
            <div style="padding: 40px 25px;">
              {{content}}
            </div>
            <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
              <p>CrystosJewel | <a href="{{unsubscribeUrl}}" style="color: #3b82f6;">Préférences</a></p>
            </div>
          </div>
        `
      },
      {
        name: 'Classique',
        template_type: 'classic',
        content: `
          <div style="font-family: 'Times New Roman', serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
            <div style="background: #1e293b; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">{{subject}}</h1>
              <p style="margin: 5px 0 0 0;">{{preheader}}</p>
            </div>
            <div style="padding: 25px; background: white; line-height: 1.6;">
              {{content}}
            </div>
            <div style="background: #f8fafc; padding: 15px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
              <p>CrystosJewel - Bijouterie d'exception</p>
              <p><a href="{{unsubscribeUrl}}" style="color: #64748b;">Se désabonner</a></p>
            </div>
          </div>
        `
      },
      {
        name: 'Minimal',
        template_type: 'minimal',
        content: `
          <div style="font-family: 'Helvetica', sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="padding: 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <h1 style="margin: 0; font-size: 20px; color: #64748b; font-weight: 300;">{{subject}}</h1>
              <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;">{{preheader}}</p>
            </div>
            <div style="padding: 30px 20px; background: white;">
              {{content}}
            </div>
            <div style="padding: 15px; text-align: center; font-size: 11px; color: #94a3b8;">
              <p><a href="{{unsubscribeUrl}}" style="color: #94a3b8;">Unsubscribe</a></p>
            </div>
          </div>
        `
      }
    ];

    for (const template of templates) {
      await sequelize.query(`
        INSERT INTO marketing_templates (name, template_type, content, is_default)
        VALUES (:name, :template_type, :content, :is_default)
        ON CONFLICT (template_type) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = CURRENT_TIMESTAMP
      `, {
        replacements: template
      });
    }

    console.log('✅ Templates par défaut insérés');
  } catch (error) {
    console.error('❌ Erreur insertion templates:', error);
    throw error;
  }
}

async function insertTestData() {
  try {
    console.log('🧪 Insertion des données de test...');

    // Campagne de démonstration
    await sequelize.query(`
      INSERT INTO marketing_campaigns 
      (name, subject, preheader, content, template, status, from_name, recipients_count, sent_count, open_count, click_count, created_by)
      VALUES 
      (
        'Campagne de Bienvenue',
        '🎉 Bienvenue chez CrystosJewel !',
        'Découvrez notre collection exclusive de bijoux artisanaux',
        '<h2 style="color: #d89ab3; text-align: center;">Bienvenue {{firstName}} !</h2>
         <p>Nous sommes ravis de vous compter parmi nos clients privilégiés.</p>
         <p>Découvrez notre collection exclusive de bijoux créés avec passion par nos artisans.</p>
         <div style="text-align: center; margin: 30px 0;">
           <a href="/bijoux" style="display: inline-block; background: linear-gradient(135deg, #d89ab3, #b794a8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
             🛍️ Découvrir la Collection
           </a>
         </div>
         <p>Profitez de <strong>10% de réduction</strong> sur votre première commande avec le code <code>BIENVENUE10</code></p>',
        'elegant',
        'sent',
        'CrystosJewel',
        150,
        148,
        42,
        8,
        'admin'
      )
      ON CONFLICT DO NOTHING
    `);

    // Campagne promotionnelle
    await sequelize.query(`
      INSERT INTO marketing_campaigns 
      (name, subject, preheader, content, template, status, from_name, recipients_count, sent_count, open_count, click_count, created_by)
      VALUES 
      (
        'Soldes d''Hiver 2025',
        '❄️ Soldes Exceptionnels - Jusqu''à -50% !',
        'Derniers jours pour profiter des soldes d''hiver',
        '<h2 style="color: #3b82f6; text-align: center;">Soldes d''Hiver Exceptionnels</h2>
         <p>Cher(e) {{firstName}},</p>
         <p>Ne ratez pas nos soldes d''hiver avec des réductions allant jusqu''à <strong>50%</strong> sur une sélection de bijoux.</p>
         <div style="text-align: center; margin: 30px 0;">
           <a href="/soldes" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
             🏷️ Voir les Soldes
           </a>
         </div>
         <p><em>Offre valable jusqu''au 31 janvier 2025</em></p>',
        'modern',
        'sent',
        'CrystosJewel',
        320,
        318,
        89,
        23,
        'admin'
      )
      ON CONFLICT DO NOTHING
    `);

    // Campagne en brouillon
    await sequelize.query(`
      INSERT INTO marketing_campaigns 
      (name, subject, content, template, status, from_name, created_by)
      VALUES 
      (
        'Newsletter Février 2025',
        'Nouveautés du mois de février',
        '<h2>Les nouveautés de février vous attendent !</h2>
         <p>Découvrez les dernières créations de nos artisans...</p>',
        'elegant',
        'draft',
        'CrystosJewel',
        'admin'
      )
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Données de test insérées');
  } catch (error) {
    console.error('❌ Erreur insertion données test:', error);
    // Ne pas faire échouer l'installation pour les données de test
  }
}

// Exécuter l'installation
setupMarketing()
  .then(() => {
    console.log('🎉 Installation terminée !');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Échec de l\'installation:', error);
    process.exit(1);
  });

// ===== INSTRUCTIONS D'INSTALLATION POUR app.js =====
/*

AJOUTEZ CES LIGNES DANS VOTRE app.js :

// Import des routes marketing
import marketingRoutes from './routes/adminMarketingRoutes.js';

// Routes marketing (après vos autres routes)
app.use('/admin/marketing', marketingRoutes);
app.use('/marketing', marketingRoutes); // Pour les routes publiques (tracking, désabonnement)

// Variables d'environnement requises dans .env :
MAIL_USER=votre-email@gmail.com
MAIL_PASS=votre-mot-de-passe-application
BASE_URL=http://localhost:3000
ADMIN_EMAIL=admin@votre-domaine.com

// Permissions admin requises :
// Assurez-vous que votre middleware d'authentification admin fonctionne

*/

export { setupMarketing };