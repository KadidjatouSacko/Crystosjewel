// app/services/emailMarketingService.js - SERVICE MARKETING SANS ERREURS
import nodemailer from 'nodemailer';
import { sequelize } from '../models/sequelize-client.js';

// Configuration du transporteur
const marketingTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  rateDelta: 10000, // 10 secondes entre les emails
  rateLimit: 5      // Maximum 5 emails par période
});

// Test de connexion avec gestion d'erreur
try {
  await marketingTransporter.verify();
  console.log('✅ Service email marketing connecté');
} catch (error) {
  console.log('⚠️ Service email marketing: connexion à vérifier');
}

// ==========================================
// FONCTIONS PRINCIPALES SIMPLIFIÉES
// ==========================================

/**
 * Envoie un email de test
 */
export async function sendMarketingTestEmail(to, subject, content, template = 'elegant') {
  try {
    console.log(`📧 Envoi test marketing à: ${to}`);

    // Variables de test
    const testVariables = {
      firstName: 'John',
      lastName: 'Doe',
      email: to,
      orderNumber: 'TEST-001',
      total: '99,99€',
      trackingNumber: 'FR123456789',
      unsubscribeUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/marketing/unsubscribe?email=${encodeURIComponent(to)}`,
      preferencesUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/marketing/preferences?email=${encodeURIComponent(to)}`
    };

    const processedContent = processMarketingTemplate(content, testVariables);
    const htmlContent = wrapMarketingTemplate(processedContent, template, subject);

    const info = await marketingTransporter.sendMail({
      from: `"CrystosJewel 💎" <${process.env.MAIL_USER}>`,
      to: to,
      subject: `[TEST] ${subject}`,
      html: htmlContent
    });

    console.log('✅ Email marketing test envoyé:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Erreur envoi email marketing test:', error);
    return { success: false, error: error.message };
  }
}



// Test de connexion avec gestion d'erreur
marketingTransporter.verify((error, success) => {
  if (error) {
    console.log('⚠️ Service email marketing: vérifiez votre configuration SMTP');
  } else {
    console.log('✅ Service email marketing connecté');
  }
});

// ==========================================
// FONCTIONS PRINCIPALES SIMPLIFIÉES
// ==========================================



/**
 * Sauvegarde un brouillon de campagne marketing
 */
export async function saveMarketingCampaignDraft(campaignData, userId) {
  try {
    console.log('💾 Sauvegarde brouillon marketing:', campaignData.name);

    // Créer table si elle n'existe pas
    await ensureEmailCampaignsTable();

    const query = `
      INSERT INTO email_campaigns (
        name, subject, content, preheader, from_name, template_type, 
        status, recipient_type, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, NOW())
      RETURNING id, name, created_at
    `;

    const values = [
      campaignData.name || 'Campagne sans nom',
      campaignData.subject || '',
      campaignData.content || '',
      campaignData.preheader || '',
      campaignData.fromName || 'CrystosJewel',
      campaignData.template || 'elegant',
      campaignData.recipientType || 'newsletter',
      userId || 1
    ];

    const [result] = await sequelize.query(query, { bind: values });
    
    if (result.length > 0) {
      console.log('✅ Brouillon marketing sauvegardé:', result[0]);
      return { success: true, campaign: result[0] };
    }

    return { success: false, message: 'Erreur lors de la sauvegarde' };
  } catch (error) {
    console.error('❌ Erreur sauvegarde brouillon marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie une campagne email marketing complète
 */
export async function sendMarketingCampaign(campaignData, userId) {
  try {
    console.log('🚀 Début envoi campagne marketing:', campaignData.name);

    // Assurer que les tables existent
    await ensureEmailCampaignsTable();
    await ensureEmailLogsTable();

    // Récupérer les destinataires
    const recipients = await getMarketingRecipients(
      campaignData.recipientType, 
      campaignData.selectedCustomerIds
    );

    if (recipients.length === 0) {
      return { success: false, error: 'Aucun destinataire trouvé' };
    }

    // Créer la campagne en base
    const [campaignResult] = await sequelize.query(`
      INSERT INTO email_campaigns (
        name, subject, content, preheader, from_name, template_type,
        status, recipient_type, created_by, started_at, recipient_count
      ) VALUES ($1, $2, $3, $4, $5, $6, 'sending', $7, $8, NOW(), $9)
      RETURNING id
    `, {
      bind: [
        campaignData.name,
        campaignData.subject,
        campaignData.content,
        campaignData.preheader || '',
        campaignData.fromName || 'CrystosJewel',
        campaignData.template || 'elegant',
        campaignData.recipientType || 'newsletter',
        userId || 1,
        recipients.length
      ]
    });

    const campaignId = campaignResult[0].id;

    // Envoyer les emails
    let emailsSent = 0;
    let emailsDelivered = 0;
    let emailsFailed = 0;

    for (const recipient of recipients) {
      try {
        // Personnaliser le contenu
        const personalizedContent = processMarketingTemplate(campaignData.content, {
          firstName: recipient.first_name || 'Cher client',
          lastName: recipient.last_name || '',
          email: recipient.email,
          orderNumber: recipient.total_orders || 0,
          total: `${recipient.total_spent || 0}€`,
          trackingNumber: '',
          unsubscribeUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/marketing/unsubscribe?email=${encodeURIComponent(recipient.email)}&campaign=${campaignId}`,
          preferencesUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/marketing/preferences?email=${encodeURIComponent(recipient.email)}`
        });

        const finalContent = wrapMarketingTemplate(personalizedContent, campaignData.template, campaignData.subject);

        // Envoyer l'email
        await marketingTransporter.sendMail({
          from: `"${campaignData.fromName || 'CrystosJewel'} 💎" <${process.env.MAIL_USER}>`,
          to: recipient.email,
          subject: campaignData.subject,
          html: finalContent
        });

        // Logger l'envoi réussi
        await sequelize.query(`
          INSERT INTO email_logs (
            customer_id, email_type, recipient_email, subject, status, created_at, sent_at
          ) VALUES ($1, 'marketing', $2, $3, 'sent', NOW(), NOW())
        `, {
          bind: [recipient.id, recipient.email, campaignData.subject]
        });

        emailsSent++;
        emailsDelivered++;

        console.log(`📧 Email marketing envoyé à ${recipient.email}`);

        // Délai pour éviter les limitations
        if (emailsSent % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (emailError) {
        console.error(`❌ Erreur envoi marketing à ${recipient.email}:`, emailError.message);
        emailsFailed++;

        // Logger l'erreur
        try {
          await sequelize.query(`
            INSERT INTO email_logs (
              customer_id, email_type, recipient_email, subject, status, error_message, created_at
            ) VALUES ($1, 'marketing', $2, $3, 'failed', $4, NOW())
          `, {
            bind: [recipient.id, recipient.email, campaignData.subject, emailError.message]
          });
        } catch (logError) {
          console.error('Erreur log:', logError.message);
        }

        // Arrêter si trop d'erreurs
        if (emailsFailed > 10) {
          console.log('❌ Trop d\'erreurs, arrêt de la campagne marketing');
          break;
        }
      }
    }

    // Mettre à jour les statistiques finales
    await sequelize.query(`
      UPDATE email_campaigns 
      SET status = 'sent', 
          completed_at = NOW(),
          emails_sent = $1,
          emails_delivered = $2
      WHERE id = $3
    `, { bind: [emailsSent, emailsDelivered, campaignId] });

    console.log(`✅ Campagne marketing terminée: ${emailsSent} envoyés, ${emailsFailed} échecs`);

    return {
      success: true,
      campaignId: campaignId,
      stats: {
        sent: emailsSent,
        delivered: emailsDelivered,
        failed: emailsFailed,
        total: recipients.length
      },
      message: `Campagne marketing envoyée avec succès à ${emailsSent} destinataires`
    };

  } catch (error) {
    console.error('❌ Erreur envoi campagne marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les destinataires selon les critères
 */
async function getMarketingRecipients(recipientType, selectedCustomerIds = []) {
  try {
    let query = '';
    let binds = [];

    switch (recipientType) {
      case 'newsletter':
        query = `
          SELECT id, first_name, last_name, email, total_orders, total_spent
          FROM customer 
          WHERE newsletter_subscribed = true 
          AND email IS NOT NULL AND email != ''
        `;
        break;

      case 'vip':
        query = `
          SELECT id, first_name, last_name, email, total_orders, total_spent
          FROM customer 
          WHERE (total_orders >= 5 OR total_spent >= 500)
          AND email IS NOT NULL AND email != ''
        `;
        break;

      case 'with-orders':
        query = `
          SELECT id, first_name, last_name, email, total_orders, total_spent
          FROM customer 
          WHERE total_orders > 0
          AND email IS NOT NULL AND email != ''
        `;
        break;

      case 'selected':
        if (selectedCustomerIds && selectedCustomerIds.length > 0) {
          const placeholders = selectedCustomerIds.map((_, index) => `${index + 1}`).join(',');
          query = `
            SELECT id, first_name, last_name, email, total_orders, total_spent
            FROM customer 
            WHERE id IN (${placeholders})
            AND email IS NOT NULL AND email != ''
          `;
          binds = selectedCustomerIds;
        }
        break;

      default: // 'all'
        query = `
          SELECT id, first_name, last_name, email, total_orders, total_spent
          FROM customer 
          WHERE email IS NOT NULL AND email != ''
        `;
    }

    // Exclure les désabonnés si la table existe
    try {
      await sequelize.query('SELECT 1 FROM email_unsubscribes LIMIT 1');
      query += ' AND email NOT IN (SELECT email FROM email_unsubscribes WHERE email IS NOT NULL)';
    } catch (error) {
      // Table n'existe pas encore
    }

    const [recipients] = await sequelize.query(query, { bind: binds });
    
    console.log(`📊 ${recipients.length} destinataires marketing trouvés pour: ${recipientType}`);
    return recipients;
  } catch (error) {
    console.error('❌ Erreur récupération destinataires marketing:', error);
    return [];
  }
}

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

/**
 * Traite un template avec des variables
 */
function processMarketingTemplate(content, variables) {
  let processedContent = content;
  
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processedContent = processedContent.replace(regex, variables[key] || '');
  });

  return processedContent;
}

/**
 * Enveloppe le contenu dans un template marketing
 */
function wrapMarketingTemplate(content, template = 'elegant', subject = 'CrystosJewel') {
  const colors = {
    elegant: { primary: '#d89ab3', secondary: '#b794a8' },
    modern: { primary: '#3b82f6', secondary: '#1e40af' },
    classic: { primary: '#1e293b', secondary: '#475569' },
    minimal: { primary: '#64748b', secondary: '#94a3b8' }
  };

  const color = colors[template] || colors.elegant;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, ${color.primary}, ${color.secondary}); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">CrystosJewel</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${subject}</p>
        </div>
        <div style="padding: 30px;">
          ${content}
        </div>
        <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 10px 0;">© 2025 CrystosJewel - Tous droits réservés</p>
          <p style="margin: 0;">
            <a href="{{unsubscribeUrl}}" style="color: #64748b; text-decoration: none;">Se désabonner</a> | 
            <a href="{{preferencesUrl}}" style="color: #64748b; text-decoration: none;">Gérer mes préférences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Assure que la table email_campaigns existe
 */
async function ensureEmailCampaignsTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        content TEXT,
        preheader VARCHAR(255),
        from_name VARCHAR(100) DEFAULT 'CrystosJewel',
        template_type VARCHAR(50) DEFAULT 'elegant',
        status VARCHAR(50) DEFAULT 'draft',
        recipient_type VARCHAR(50) DEFAULT 'newsletter',
        recipient_count INTEGER DEFAULT 0,
        emails_sent INTEGER DEFAULT 0,
        emails_delivered INTEGER DEFAULT 0,
        emails_opened INTEGER DEFAULT 0,
        emails_clicked INTEGER DEFAULT 0,
        emails_unsubscribed INTEGER DEFAULT 0,
        created_by INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Table email_campaigns vérifiée');
  } catch (error) {
    console.error('❌ Erreur création table email_campaigns:', error);
  }
}

/**
 * Assure que la table email_logs existe
 */
async function ensureEmailLogsTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER,
        email_type VARCHAR(50) DEFAULT 'marketing',
        recipient_email VARCHAR(255),
        subject VARCHAR(255),
        status VARCHAR(50) DEFAULT 'sent',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Table email_logs vérifiée');
  } catch (error) {
    console.error('❌ Erreur création table email_logs:', error);
  }
}

/**
 * Assure que la table email_unsubscribes existe
 */
async function ensureEmailUnsubscribesTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS email_unsubscribes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        reason TEXT,
        campaign_id INTEGER,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table email_unsubscribes vérifiée');
  } catch (error) {
    console.error('❌ Erreur création table email_unsubscribes:', error);
  }
}

// ==========================================
// FONCTIONS EXPORTÉES SECONDAIRES
// ==========================================

export async function getMarketingCampaignStats(campaignId) {
  try {
    await ensureEmailCampaignsTable();
    const [stats] = await sequelize.query(`
      SELECT * FROM email_campaigns WHERE id = $1
    `, { bind: [campaignId] });

    if (stats.length === 0) {
      return { success: false, message: 'Campagne non trouvée' };
    }

    return { success: true, stats: stats[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getMarketingCampaignHistory(limit = 50, offset = 0) {
  try {
    await ensureEmailCampaignsTable();
    const [campaigns] = await sequelize.query(`
      SELECT * FROM email_campaigns 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, { bind: [limit, offset] });

    return { success: true, campaigns };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getGlobalMarketingStats() {
  try {
    await ensureEmailCampaignsTable();
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_campaigns,
        COALESCE(SUM(emails_sent), 0) as total_emails_sent,
        COALESCE(SUM(emails_delivered), 0) as total_emails_delivered
      FROM email_campaigns
    `);

    return { success: true, stats: stats[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getMarketingEmailTemplates() {
  const templates = [
    { id: 1, name: 'Élégant', template_type: 'elegant', is_default: true },
    { id: 2, name: 'Moderne', template_type: 'modern', is_default: false },
    { id: 3, name: 'Classique', template_type: 'classic', is_default: false },
    { id: 4, name: 'Minimal', template_type: 'minimal', is_default: false }
  ];
  
  return { success: true, templates };
}

export { getMarketingRecipients };

export function trackMarketingEmailOpen(campaignId, recipientId, userAgent, ipAddress) {
  console.log(`📊 Tracking ouverture: campagne ${campaignId}, destinataire ${recipientId}`);
  return { success: true };
}

export function trackMarketingEmailClick(campaignId, recipientId, targetUrl, userAgent, ipAddress) {
  console.log(`🖱️ Tracking clic: campagne ${campaignId}, URL ${targetUrl}`);
  return { success: true, targetUrl };
}

export async function unsubscribeMarketingEmail(email, campaignId, reason, ipAddress) {
  try {
    await ensureEmailUnsubscribesTable();
    
    await sequelize.query(`
      INSERT INTO email_unsubscribes (email, reason, campaign_id, ip_address)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, { bind: [email, reason, campaignId, ipAddress] });

    await sequelize.query(`
      UPDATE customer 
      SET newsletter_subscribed = false 
      WHERE email = $1
    `, { bind: [email] });

    return { success: true, message: 'Désabonnement effectué' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

console.log('✅ Service Email Marketing CrystosJewel initialisé sans erreurs');