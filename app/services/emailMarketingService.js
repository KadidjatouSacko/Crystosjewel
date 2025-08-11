// app/services/emailMarketingService.js - SERVICE MARKETING DÉDIÉ
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import handlebars from 'handlebars';
import { sequelize } from '../models/sequelize-client.js';

dotenv.config();

// Configuration du transporteur dédié au marketing
const marketingTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ==========================================
// GESTION DES CAMPAGNES EMAIL MARKETING
// ==========================================

/**
 * Envoie un email de test pour les campagnes marketing
 */
export async function sendMarketingTestEmail(to, subject, content, template = 'elegant') {
  try {
    const htmlContent = await processMarketingTemplate(content, template, {
      firstName: 'Test',
      email: to,
      subject: subject
    });

    const info = await marketingTransporter.sendMail({
      from: `"CrystosJewel 💎" <${process.env.MAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent
    });

    console.log('📧 Email marketing de test envoyé:', info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Erreur envoi email marketing test:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sauvegarde un brouillon de campagne marketing
 */
export async function saveMarketingCampaignDraft(campaignData, userId) {
  try {
    const query = `
      INSERT INTO email_campaigns (
        name, subject, content, preheader, from_name, from_email,
        template_type, status, recipient_type, created_by, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10)
      RETURNING id, name, created_at
    `;

    const values = [
      campaignData.name,
      campaignData.subject,
      campaignData.content,
      campaignData.preheader || null,
      campaignData.fromName || 'CrystosJewel',
      campaignData.fromEmail || process.env.MAIL_USER,
      campaignData.template || 'elegant',
      campaignData.recipientType || 'newsletter',
      userId,
      JSON.stringify(campaignData.metadata || {})
    ];

    const [result] = await sequelize.query(query, { bind: values });
    
    if (result.length > 0) {
      console.log('💾 Brouillon marketing sauvegardé:', result[0]);
      return { success: true, campaign: result[0] };
    }

    return { success: false, message: 'Erreur lors de la sauvegarde' };
  } catch (error) {
    console.error('❌ Erreur sauvegarde brouillon marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère la liste des destinataires marketing selon les critères
 */
export async function getMarketingRecipients(recipientType, selectedCustomerIds = []) {
  try {
    let query = '';
    let values = [];

    switch (recipientType) {
      case 'newsletter':
        query = `
          SELECT id, email, 
                 COALESCE(first_name, prenom) as first_name,
                 COALESCE(last_name, nom) as last_name,
                 total_orders, total_spent
          FROM customer 
          WHERE newsletter_subscribed = true 
          AND email IS NOT NULL 
          AND email != ''
          AND email NOT IN (SELECT email FROM email_unsubscribes)
        `;
        break;

      case 'vip':
        query = `
          SELECT id, email,
                 COALESCE(first_name, prenom) as first_name,
                 COALESCE(last_name, nom) as last_name,
                 total_orders, total_spent
          FROM customer 
          WHERE (total_orders >= 5 OR total_spent >= 500)
          AND email IS NOT NULL 
          AND email != ''
          AND email NOT IN (SELECT email FROM email_unsubscribes)
        `;
        break;

      case 'with-orders':
        query = `
          SELECT id, email,
                 COALESCE(first_name, prenom) as first_name,
                 COALESCE(last_name, nom) as last_name,
                 total_orders, total_spent
          FROM customer 
          WHERE total_orders > 0
          AND email IS NOT NULL 
          AND email != ''
          AND email NOT IN (SELECT email FROM email_unsubscribes)
        `;
        break;

      case 'custom':
        if (selectedCustomerIds.length === 0) {
          return { success: false, message: 'Aucun client sélectionné' };
        }
        query = `
          SELECT id, email,
                 COALESCE(first_name, prenom) as first_name,
                 COALESCE(last_name, nom) as last_name,
                 total_orders, total_spent
          FROM customer 
          WHERE id = ANY($1)
          AND email IS NOT NULL 
          AND email != ''
          AND email NOT IN (SELECT email FROM email_unsubscribes)
        `;
        values = [selectedCustomerIds];
        break;

      default: // 'all'
        query = `
          SELECT id, email,
                 COALESCE(first_name, prenom) as first_name,
                 COALESCE(last_name, nom) as last_name,
                 total_orders, total_spent
          FROM customer 
          WHERE email IS NOT NULL 
          AND email != ''
          AND email NOT IN (SELECT email FROM email_unsubscribes)
        `;
    }

    const [recipients] = await sequelize.query(query, { bind: values });
    
    console.log(`📊 ${recipients.length} destinataires marketing trouvés pour le type: ${recipientType}`);
    return { success: true, recipients };
  } catch (error) {
    console.error('❌ Erreur récupération destinataires marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie une campagne email marketing complète
 */
export async function sendMarketingCampaign(campaignData, userId) {
  try {
    console.log('🚀 Début envoi campagne marketing:', campaignData.name);

    // 1. Créer ou mettre à jour la campagne
    let campaignId;
    if (campaignData.campaignId) {
      // Mettre à jour campagne existante
      await sequelize.query(`
        UPDATE email_campaigns 
        SET status = 'sending', started_at = CURRENT_TIMESTAMP,
            name = $1, subject = $2, content = $3
        WHERE id = $4
      `, { 
        bind: [campaignData.name, campaignData.subject, campaignData.content, campaignData.campaignId] 
      });
      campaignId = campaignData.campaignId;
    } else {
      // Créer nouvelle campagne
      const [result] = await sequelize.query(`
        INSERT INTO email_campaigns (
          name, subject, content, preheader, from_name, template_type,
          status, recipient_type, created_by, started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'sending', $7, $8, CURRENT_TIMESTAMP)
        RETURNING id
      `, { 
        bind: [
          campaignData.name, campaignData.subject, campaignData.content,
          campaignData.preheader, campaignData.fromName || 'CrystosJewel',
          campaignData.template || 'elegant', campaignData.recipientType || 'newsletter',
          userId
        ] 
      });
      campaignId = result[0].id;
    }

    // 2. Récupérer les destinataires
    const recipientsResult = await getMarketingRecipients(
      campaignData.recipientType, 
      campaignData.selectedCustomerIds
    );

    if (!recipientsResult.success) {
      throw new Error(recipientsResult.error || recipientsResult.message);
    }

    const recipients = recipientsResult.recipients;
    
    // Mettre à jour le nombre de destinataires
    await sequelize.query(`
      UPDATE email_campaigns 
      SET recipient_count = $1 
      WHERE id = $2
    `, { bind: [recipients.length, campaignId] });

    // 3. Envoyer les emails un par un
    let emailsSent = 0;
    let emailsDelivered = 0;
    let emailsFailed = 0;

    for (const recipient of recipients) {
      try {
        // Insérer le destinataire dans la base
        const [recipientResult] = await sequelize.query(`
          INSERT INTO campaign_recipients (
            campaign_id, customer_id, email, name, status
          ) VALUES ($1, $2, $3, $4, 'pending')
          RETURNING id
        `, { 
          bind: [
            campaignId, 
            recipient.id, 
            recipient.email, 
            `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim()
          ] 
        });

        const recipientId = recipientResult[0].id;

        // Traiter le template avec les données du destinataire
        const personalizedContent = await processMarketingTemplate(
          campaignData.content, 
          campaignData.template || 'elegant',
          {
            firstName: recipient.first_name || 'Cher client',
            lastName: recipient.last_name || '',
            email: recipient.email,
            subject: campaignData.subject,
            orderNumber: recipient.total_orders || 0,
            total: recipient.total_spent || 0,
            trackingUrl: `${process.env.BASE_URL}/tracking?email=${encodeURIComponent(recipient.email)}`,
            unsubscribeUrl: `${process.env.BASE_URL}/unsubscribe?email=${encodeURIComponent(recipient.email)}&campaign=${campaignId}`,
            campaignId: campaignId,
            recipientId: recipientId
          }
        );

        // Ajouter tracking pixel
        const trackingPixel = `<img src="${process.env.BASE_URL}/email/track-open/${campaignId}/${recipientId}" width="1" height="1" style="display:none;" />`;
        const finalContent = personalizedContent + trackingPixel;

        // Envoyer l'email marketing
        const info = await marketingTransporter.sendMail({
          from: `"${campaignData.fromName || 'CrystosJewel'} 💎" <${process.env.MAIL_USER}>`,
          to: recipient.email,
          subject: campaignData.subject,
          html: finalContent
        });

        // Marquer comme envoyé
        await sequelize.query(`
          UPDATE campaign_recipients 
          SET status = 'sent', sent_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, { bind: [recipientId] });

        emailsSent++;
        emailsDelivered++; // On considère comme délivré si pas d'erreur

        console.log(`📧 Email marketing envoyé à ${recipient.email}`);

        // Petit délai pour éviter la limitation des emails
        if (emailsSent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (emailError) {
        console.error(`❌ Erreur envoi marketing à ${recipient.email}:`, emailError.message);
        emailsFailed++;

        // Marquer comme échoué
        await sequelize.query(`
          UPDATE campaign_recipients 
          SET status = 'failed', failed_at = CURRENT_TIMESTAMP, failure_reason = $1
          WHERE campaign_id = $2 AND email = $3
        `, { bind: [emailError.message, campaignId, recipient.email] });
      }
    }

    // 4. Mettre à jour les statistiques finales
    await sequelize.query(`
      UPDATE email_campaigns 
      SET status = 'sent', 
          completed_at = CURRENT_TIMESTAMP,
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
    
    // Marquer la campagne comme échouée
    if (campaignId) {
      await sequelize.query(`
        UPDATE email_campaigns 
        SET status = 'failed' 
        WHERE id = $1
      `, { bind: [campaignId] });
    }

    return { success: false, error: error.message };
  }
}

/**
 * Traite un template email marketing avec les variables
 */
async function processMarketingTemplate(content, templateType, variables) {
  try {
    // Récupérer le template de base
    const [templateResult] = await sequelize.query(`
      SELECT content 
      FROM email_templates 
      WHERE template_type = $1 AND is_active = true
      ORDER BY is_default DESC, id ASC
      LIMIT 1
    `, { bind: [templateType] });

    let baseTemplate = '';
    if (templateResult.length > 0) {
      baseTemplate = templateResult[0].content;
    } else {
      // Template marketing par défaut si aucun trouvé
      baseTemplate = `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #d89ab3, #b794a8); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0;">{{subject}}</h1>
          </div>
          <div style="padding: 30px;">
            {{content}}
          </div>
          <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
            <p>© 2025 CrystosJewel - Tous droits réservés</p>
            <p><a href="{{unsubscribeUrl}}" style="color: #64748b;">Se désabonner</a></p>
          </div>
        </div>
      `;
    }

    // Compiler avec Handlebars
    const template = handlebars.compile(baseTemplate);
    const processedTemplate = template(variables);

    // Remplacer le contenu dans le template
    const finalTemplate = handlebars.compile(processedTemplate);
    const result = finalTemplate({ ...variables, content });

    // Traiter les liens pour le tracking marketing
    const trackedContent = addMarketingClickTracking(result, variables.campaignId, variables.recipientId);

    return trackedContent;
  } catch (error) {
    console.error('❌ Erreur traitement template marketing:', error);
    return content; // Retourner le contenu brut en cas d'erreur
  }
}

/**
 * Ajoute le tracking des clics aux liens pour le marketing
 */
function addMarketingClickTracking(content, campaignId, recipientId) {
  if (!campaignId || !recipientId) return content;

  // Remplacer tous les liens href par des liens trackés
  return content.replace(/href="([^"]+)"/g, (match, url) => {
    if (url.startsWith('mailto:') || url.startsWith('#') || url.includes('/email/track-click/')) {
      return match; // Ne pas tracker les emails, ancres et liens déjà trackés
    }
    
    const trackingUrl = `${process.env.BASE_URL}/email/track-click/${campaignId}/${recipientId}?url=${encodeURIComponent(url)}`;
    return `href="${trackingUrl}"`;
  });
}

// ==========================================
// STATISTIQUES ET ANALYTICS MARKETING
// ==========================================

/**
 * Récupère les statistiques d'une campagne marketing
 */
export async function getMarketingCampaignStats(campaignId) {
  try {
    const [stats] = await sequelize.query(`
      SELECT 
        c.*,
        COUNT(cr.id) as total_recipients,
        COUNT(CASE WHEN cr.status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN cr.status = 'delivered' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN cr.status = 'failed' THEN 1 END) as failed_count,
        COUNT(DISTINCT eo.email) as unique_opens,
        COUNT(eo.id) as total_opens,
        COUNT(DISTINCT ec.email) as unique_clicks,
        COUNT(ec.id) as total_clicks
      FROM email_campaigns c
      LEFT JOIN campaign_recipients cr ON c.id = cr.campaign_id
      LEFT JOIN email_opens eo ON c.id = eo.campaign_id
      LEFT JOIN email_clicks ec ON c.id = ec.campaign_id
      WHERE c.id = $1
      GROUP BY c.id
    `, { bind: [campaignId] });

    if (stats.length === 0) {
      return { success: false, message: 'Campagne marketing non trouvée' };
    }

    const campaign = stats[0];
    
    // Calculer les taux marketing
    const deliveryRate = campaign.sent_count > 0 ? 
      (campaign.delivered_count / campaign.sent_count * 100).toFixed(2) : 0;
    const openRate = campaign.delivered_count > 0 ? 
      (campaign.unique_opens / campaign.delivered_count * 100).toFixed(2) : 0;
    const clickRate = campaign.unique_opens > 0 ? 
      (campaign.unique_clicks / campaign.unique_opens * 100).toFixed(2) : 0;

    return {
      success: true,
      stats: {
        ...campaign,
        delivery_rate: deliveryRate,
        open_rate: openRate,
        click_rate: clickRate
      }
    };
  } catch (error) {
    console.error('❌ Erreur récupération stats marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère l'historique des campagnes marketing
 */
export async function getMarketingCampaignHistory(limit = 50, offset = 0) {
  try {
    const [campaigns] = await sequelize.query(`
      SELECT 
        c.id,
        c.name,
        c.subject,
        c.status,
        c.recipient_type,
        c.recipient_count,
        c.emails_sent,
        c.emails_delivered,
        c.emails_opened,
        c.emails_clicked,
        c.created_at,
        c.completed_at,
        CASE 
          WHEN c.emails_sent > 0 THEN ROUND((c.emails_delivered::decimal / c.emails_sent) * 100, 2)
          ELSE 0 
        END as delivery_rate,
        CASE 
          WHEN c.emails_delivered > 0 THEN ROUND((c.emails_opened::decimal / c.emails_delivered) * 100, 2)
          ELSE 0 
        END as open_rate,
        CASE 
          WHEN c.emails_opened > 0 THEN ROUND((c.emails_clicked::decimal / c.emails_opened) * 100, 2)
          ELSE 0 
        END as click_rate
      FROM email_campaigns c
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `, { bind: [limit, offset] });

    const [totalResult] = await sequelize.query(`
      SELECT COUNT(*) as total FROM email_campaigns
    `);

    return {
      success: true,
      campaigns,
      total: parseInt(totalResult[0].total),
      limit,
      offset
    };
  } catch (error) {
    console.error('❌ Erreur récupération historique marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les statistiques globales du marketing
 */
export async function getGlobalMarketingStats() {
  try {
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_campaigns,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_campaigns,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_campaigns,
        COUNT(CASE WHEN status = 'sending' THEN 1 END) as sending_campaigns,
        SUM(emails_sent) as total_emails_sent,
        SUM(emails_delivered) as total_emails_delivered,
        SUM(emails_opened) as total_emails_opened,
        SUM(emails_clicked) as total_emails_clicked,
        SUM(emails_unsubscribed) as total_unsubscribes
      FROM email_campaigns
    `);

    const [subscribersResult] = await sequelize.query(`
      SELECT COUNT(*) as total_subscribers
      FROM customer 
      WHERE newsletter_subscribed = true 
      AND email IS NOT NULL 
      AND email != ''
      AND email NOT IN (SELECT email FROM email_unsubscribes)
    `);

    const globalStats = stats[0];
    const subscriberCount = subscribersResult[0].total_subscribers;

    // Calculer les taux globaux marketing
    const globalDeliveryRate = globalStats.total_emails_sent > 0 ? 
      (globalStats.total_emails_delivered / globalStats.total_emails_sent * 100).toFixed(2) : 0;
    const globalOpenRate = globalStats.total_emails_delivered > 0 ? 
      (globalStats.total_emails_opened / globalStats.total_emails_delivered * 100).toFixed(2) : 0;
    const globalClickRate = globalStats.total_emails_opened > 0 ? 
      (globalStats.total_emails_clicked / globalStats.total_emails_opened * 100).toFixed(2) : 0;

    return {
      success: true,
      stats: {
        ...globalStats,
        total_subscribers: subscriberCount,
        global_delivery_rate: globalDeliveryRate,
        global_open_rate: globalOpenRate,
        global_click_rate: globalClickRate
      }
    };
  } catch (error) {
    console.error('❌ Erreur stats globales marketing:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// TRACKING MARKETING
// ==========================================

/**
 * Gère le tracking des ouvertures d'emails marketing
 */
export async function trackMarketingEmailOpen(campaignId, recipientId, userAgent, ipAddress) {
  try {
    // Récupérer les infos du destinataire
    const [recipientResult] = await sequelize.query(`
      SELECT customer_id, email FROM campaign_recipients WHERE id = $1
    `, { bind: [recipientId] });

    if (recipientResult.length === 0) {
      return { success: false, message: 'Destinataire marketing non trouvé' };
    }

    const recipient = recipientResult[0];

    // Enregistrer l'ouverture marketing
    await sequelize.query(`
      INSERT INTO email_opens (campaign_id, recipient_id, customer_id, email, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, { 
      bind: [campaignId, recipientId, recipient.customer_id, recipient.email, ipAddress, userAgent] 
    });

    // Mettre à jour le statut du destinataire (si pas déjà ouvert)
    await sequelize.query(`
      UPDATE campaign_recipients 
      SET status = 'opened', opened_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status NOT IN ('opened', 'clicked')
    `, { bind: [recipientId] });

    // Mettre à jour les stats de la campagne marketing
    await sequelize.query(`
      UPDATE email_campaigns 
      SET emails_opened = (
        SELECT COUNT(DISTINCT recipient_id) 
        FROM email_opens 
        WHERE campaign_id = $1
      )
      WHERE id = $1
    `, { bind: [campaignId] });

    return { success: true };
  } catch (error) {
    console.error('❌ Erreur tracking ouverture marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gère le tracking des clics marketing
 */
export async function trackMarketingEmailClick(campaignId, recipientId, targetUrl, userAgent, ipAddress) {
  try {
    // Récupérer les infos du destinataire
    const [recipientResult] = await sequelize.query(`
      SELECT customer_id, email FROM campaign_recipients WHERE id = $1
    `, { bind: [recipientId] });

    if (recipientResult.length === 0) {
      return { success: false, message: 'Destinataire marketing non trouvé' };
    }

    const recipient = recipientResult[0];

    // Enregistrer le clic marketing
    await sequelize.query(`
      INSERT INTO email_clicks (campaign_id, recipient_id, customer_id, email, url, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, { 
      bind: [campaignId, recipientId, recipient.customer_id, recipient.email, targetUrl, ipAddress, userAgent] 
    });

    // Mettre à jour le statut du destinataire
    await sequelize.query(`
      UPDATE campaign_recipients 
      SET status = 'clicked', clicked_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, { bind: [recipientId] });

    // Mettre à jour les stats de la campagne marketing
    await sequelize.query(`
      UPDATE email_campaigns 
      SET emails_clicked = (
        SELECT COUNT(DISTINCT recipient_id) 
        FROM email_clicks 
        WHERE campaign_id = $1
      )
      WHERE id = $1
    `, { bind: [campaignId] });

    return { success: true, targetUrl };
  } catch (error) {
    console.error('❌ Erreur tracking clic marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gère les désabonnements marketing
 */
export async function unsubscribeMarketingEmail(email, campaignId, reason, ipAddress) {
  try {
    // Vérifier si déjà désabonné
    const [existingResult] = await sequelize.query(`
      SELECT id FROM email_unsubscribes WHERE email = $1
    `, { bind: [email] });

    if (existingResult.length > 0) {
      return { success: true, message: 'Déjà désabonné' };
    }

    // Ajouter à la liste des désabonnements marketing
    await sequelize.query(`
      INSERT INTO email_unsubscribes (email, reason, campaign_id, ip_address)
      VALUES ($1, $2, $3, $4)
    `, { bind: [email, reason, campaignId, ipAddress] });

    // Désactiver la newsletter pour ce client
    await sequelize.query(`
      UPDATE customer 
      SET newsletter_subscribed = false 
      WHERE email = $1
    `, { bind: [email] });

    // Mettre à jour les stats de la campagne marketing
    if (campaignId) {
      await sequelize.query(`
        UPDATE email_campaigns 
        SET emails_unsubscribed = emails_unsubscribed + 1
        WHERE id = $1
      `, { bind: [campaignId] });
    }

    return { success: true, message: 'Désabonnement marketing effectué' };
  } catch (error) {
    console.error('❌ Erreur désabonnement marketing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les templates marketing disponibles
 */
export async function getMarketingEmailTemplates() {
  try {
    const [templates] = await sequelize.query(`
      SELECT id, name, description, template_type, thumbnail_url, is_default
      FROM email_templates 
      WHERE is_active = true
      ORDER BY is_default DESC, name ASC
    `);

    return { success: true, templates };
  } catch (error) {
    console.error('❌ Erreur récupération templates marketing:', error);
    return { success: false, error: error.message };
  }
}

console.log('✅ Service Email Marketing CrystosJewel initialisé');