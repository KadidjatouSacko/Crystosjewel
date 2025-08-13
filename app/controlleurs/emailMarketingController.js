// app/controlleurs/emailMarketingController.js
import { Sequelize } from 'sequelize';
import { sequelize } from "../models/sequelize-client.js";
import { Customer } from "../models/customerModel.js";
import { Jewel } from "../models/jewelModel.js";
import { Category } from "../models/categoryModel.js";
import { JewelImage } from "../models/jewelImage.js";
import nodemailer from 'nodemailer';
import handlebars from 'handlebars';

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

export const emailMarketingController = {

  // ========================================
  // PAGE PRINCIPALE ÉDITEUR
  // ========================================
  async showEmailEditor(req, res) {
    try {
      console.log('📧 Chargement éditeur email marketing');

      // Récupérer les clients avec leurs statistiques
      const customers = await sequelize.query(`
        SELECT 
          c.id,
          CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as name,
          c.email,
          COALESCE(c.marketing_opt_in, false) as newsletter_subscribed,
          COALESCE(c.total_orders, 0) as total_orders,
          COALESCE(c.total_spent, 0) as total_spent,
          CASE 
            WHEN c.total_orders >= 5 OR c.total_spent >= 500 THEN 'vip'
            WHEN c.total_orders > 0 THEN 'client'
            ELSE 'prospect'
          END as customer_type
        FROM customer c
        WHERE c.email IS NOT NULL 
        AND c.email != ''
        ORDER BY c.created_at DESC
      `, { type: Sequelize.QueryTypes.SELECT });

      // Récupérer les produits pour l'éditeur
      const products = await sequelize.query(`
        SELECT 
          j.id,
          j.name,
          j.slug,
          j.price_ttc as price,
          j.image,
          COALESCE(ji.image_path, j.image) as image_url,
          c.name as category_name
        FROM jewel j
        LEFT JOIN jewel_image ji ON j.id = ji.jewel_id AND ji.image_order = 1
        LEFT JOIN category c ON j.category_id = c.id
        WHERE j.is_active = true
        AND j.stock > 0
        ORDER BY j.created_at DESC
        LIMIT 20
      `, { type: Sequelize.QueryTypes.SELECT });

      // Statistiques des campagnes précédentes
      let campaignStats = {
        totalCampaigns: 0,
        totalEmailsSent: 0,
        averageOpenRate: 0,
        averageClickRate: 0,
        totalSubscribers: customers.filter(c => c.newsletter_subscribed).length
      };

      try {
        const [stats] = await sequelize.query(`
          SELECT 
            COUNT(*) as total_campaigns,
            COALESCE(SUM(emails_sent), 0) as total_emails_sent,
            COALESCE(AVG(CASE WHEN emails_sent > 0 THEN (emails_opened * 100.0 / emails_sent) END), 0) as avg_open_rate,
            COALESCE(AVG(CASE WHEN emails_opened > 0 THEN (emails_clicked * 100.0 / emails_opened) END), 0) as avg_click_rate
          FROM email_campaigns
          WHERE status = 'sent'
        `, { type: Sequelize.QueryTypes.SELECT });

        if (stats) {
          campaignStats = {
            ...campaignStats,
            totalCampaigns: stats.total_campaigns || 0,
            totalEmailsSent: stats.total_emails_sent || 0,
            averageOpenRate: Math.round(stats.avg_open_rate || 0),
            averageClickRate: Math.round(stats.avg_click_rate || 0)
          };
        }
      } catch (error) {
        console.log('⚠️ Pas de données campagnes encore');
      }

      // Filtrer les clients par type
      const customerStats = {
        newsletter: customers.filter(c => c.newsletter_subscribed).length,
        all: customers.length,
        vip: customers.filter(c => c.customer_type === 'vip').length,
        withOrders: customers.filter(c => c.total_orders > 0).length
      };

      res.render('admin/email-marketing/editor', {
        title: 'Éditeur d\'Emails Marketing',
        customers,
        products,
        campaignStats,
        customerStats,
        user: req.session.user
      });

    } catch (error) {
      console.error('❌ Erreur éditeur email:', error);
      res.status(500).render('error', {
        title: 'Erreur',
        message: 'Erreur lors du chargement de l\'éditeur'
      });
    }
  },

  // ========================================
  // API - RÉCUPÉRER LES CLIENTS
  // ========================================
  async getCustomersList(req, res) {
    try {
      const { filter } = req.query;
      
      let whereClause = '';
      let binds = [];

      switch(filter) {
        case 'newsletter':
          whereClause = 'WHERE c.marketing_opt_in = true';
          break;
        case 'vip':
          whereClause = 'WHERE (c.total_orders >= 5 OR c.total_spent >= 500)';
          break;
        case 'with-orders':
          whereClause = 'WHERE c.total_orders > 0';
          break;
        default:
          whereClause = '';
      }

      const customers = await sequelize.query(`
        SELECT 
          c.id,
          CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as name,
          c.email,
          COALESCE(c.marketing_opt_in, false) as newsletter_subscribed,
          COALESCE(c.total_orders, 0) as total_orders,
          COALESCE(c.total_spent, 0) as total_spent,
          CASE 
            WHEN c.total_orders >= 5 OR c.total_spent >= 500 THEN 'vip'
            WHEN c.total_orders > 0 THEN 'client'
            ELSE 'prospect'
          END as customer_type
        FROM customer c
        ${whereClause}
        AND c.email IS NOT NULL 
        AND c.email != ''
        ORDER BY c.created_at DESC
      `, { bind: binds, type: Sequelize.QueryTypes.SELECT });

      res.json({
        success: true,
        customers
      });

    } catch (error) {
      console.error('❌ Erreur récupération clients:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des clients'
      });
    }
  },

  // ========================================
  // SAUVEGARDER BROUILLON
  // ========================================
  async saveDraft(req, res) {
    try {
      console.log('💾 Sauvegarde brouillon email marketing');

      const {
        name,
        subject,
        content,
        preheader,
        fromName,
        template,
        recipientType,
        selectedCustomerIds
      } = req.body;

      // Créer ou mettre à jour la campagne
      const [result] = await sequelize.query(`
        INSERT INTO email_campaigns (
          name, subject, content, preheader, from_name, template_type,
          status, recipient_type, created_by, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, NOW(), NOW()
        )
        ON CONFLICT (name) 
        DO UPDATE SET 
          subject = $2, content = $3, preheader = $4, 
          from_name = $5, template_type = $6, recipient_type = $7,
          metadata = $9, updated_at = NOW()
        RETURNING id
      `, {
        bind: [
          name, subject, content, preheader, fromName || 'CrystosJewel', 
          template || 'elegant', recipientType || 'newsletter', 
          req.session.user.id,
          JSON.stringify({ selectedCustomerIds: selectedCustomerIds || [] })
        ],
        type: Sequelize.QueryTypes.INSERT
      });

      res.json({
        success: true,
        message: 'Brouillon sauvegardé avec succès',
        campaignId: result[0]?.id || result.id
      });

    } catch (error) {
      console.error('❌ Erreur sauvegarde brouillon:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sauvegarde: ' + error.message
      });
    }
  },

  // ========================================
  // ENVOYER EMAIL DE TEST
  // ========================================
  async sendTest(req, res) {
    try {
      console.log('🧪 Envoi email de test marketing');

      const { email, subject, content, template } = req.body;

      if (!email || !subject || !content) {
        return res.status(400).json({
          success: false,
          message: 'Email, sujet et contenu requis'
        });
      }

      // Traiter le contenu avec des variables de test
      const testContent = this.processEmailTemplate(content, {
        firstName: 'John',
        lastName: 'Doe',
        email: email,
        orderNumber: 'TEST-001',
        total: '99,99€',
        trackingNumber: 'FR123456789',
        unsubscribeUrl: `${process.env.BASE_URL}/marketing/unsubscribe?email=${email}`,
        preferencesUrl: `${process.env.BASE_URL}/marketing/preferences?email=${email}`
      });

      const finalContent = this.wrapEmailTemplate(testContent, template);

      // Envoyer l'email
      const info = await transporter.sendMail({
        from: `"CrystosJewel 💎" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `[TEST] ${subject}`,
        html: finalContent
      });

      console.log('✅ Email test envoyé:', info.messageId);

      res.json({
        success: true,
        message: `Email de test envoyé à ${email}`
      });

    } catch (error) {
      console.error('❌ Erreur envoi test:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du test: ' + error.message
      });
    }
  },

  // ========================================
  // ENVOYER CAMPAGNE COMPLÈTE
  // ========================================
  async sendCampaign(req, res) {
    try {
      console.log('🚀 Envoi campagne email marketing');

      const {
        name,
        subject,
        content,
        preheader,
        fromName,
        template,
        recipientType,
        selectedCustomerIds
      } = req.body;

      if (!subject || !content) {
        return res.status(400).json({
          success: false,
          message: 'Sujet et contenu requis'
        });
      }

      // 1. Créer la campagne
      const [campaign] = await sequelize.query(`
        INSERT INTO email_campaigns (
          name, subject, content, preheader, from_name, template_type,
          status, recipient_type, created_by, started_at, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'sending', $7, $8, NOW(), $9, NOW(), NOW()
        ) RETURNING id
      `, {
        bind: [
          name, subject, content, preheader, fromName || 'CrystosJewel',
          template || 'elegant', recipientType || 'newsletter', 
          req.session.user.id,
          JSON.stringify({ selectedCustomerIds: selectedCustomerIds || [] })
        ],
        type: Sequelize.QueryTypes.INSERT
      });

      const campaignId = campaign[0]?.id || campaign.id;

      // 2. Récupérer les destinataires
      const recipients = await this.getRecipients(recipientType, selectedCustomerIds);

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucun destinataire trouvé'
        });
      }

      // 3. Envoyer les emails
      let sentCount = 0;
      let errorCount = 0;

      for (const recipient of recipients) {
        try {
          // Personnaliser le contenu
          const personalizedContent = this.processEmailTemplate(content, {
            firstName: recipient.first_name || 'Cher client',
            lastName: recipient.last_name || '',
            email: recipient.email,
            orderNumber: recipient.total_orders || 0,
            total: `${recipient.total_spent || 0}€`,
            trackingNumber: '',
            unsubscribeUrl: `${process.env.BASE_URL}/marketing/unsubscribe?email=${encodeURIComponent(recipient.email)}&campaign=${campaignId}`,
            preferencesUrl: `${process.env.BASE_URL}/marketing/preferences?email=${encodeURIComponent(recipient.email)}`
          });

          const finalContent = this.wrapEmailTemplate(personalizedContent, template);

          // Ajouter pixel de tracking
          const trackingPixel = `<img src="${process.env.BASE_URL}/marketing/track-open/${campaignId}/${recipient.id}" width="1" height="1" style="display:none;" />`;
          const contentWithTracking = finalContent + trackingPixel;

          // Envoyer l'email
          await transporter.sendMail({
            from: `"${fromName || 'CrystosJewel'} 💎" <${process.env.MAIL_USER}>`,
            to: recipient.email,
            subject: subject,
            html: contentWithTracking
          });

          // Logger l'envoi
          await sequelize.query(`
            INSERT INTO email_logs (
              campaign_id, customer_id, email, sent_at, success
            ) VALUES ($1, $2, $3, NOW(), true)
          `, {
            bind: [campaignId, recipient.id, recipient.email]
          });

          sentCount++;

          // Délai pour éviter les limitations
          if (sentCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (emailError) {
          console.error(`❌ Erreur envoi à ${recipient.email}:`, emailError.message);
          errorCount++;

          // Logger l'erreur
          await sequelize.query(`
            INSERT INTO email_logs (
              campaign_id, customer_id, email, sent_at, success, error_message
            ) VALUES ($1, $2, $3, NOW(), false, $4)
          `, {
            bind: [campaignId, recipient.id, recipient.email, emailError.message]
          });
        }
      }

      // 4. Mettre à jour les statistiques
      await sequelize.query(`
        UPDATE email_campaigns 
        SET status = 'sent', completed_at = NOW(),
            emails_sent = $1, emails_delivered = $2, recipient_count = $3
        WHERE id = $4
      `, {
        bind: [sentCount, sentCount, recipients.length, campaignId]
      });

      console.log(`✅ Campagne envoyée: ${sentCount} succès, ${errorCount} erreurs`);

      res.json({
        success: true,
        message: `Campagne envoyée avec succès à ${sentCount} destinataires`,
        stats: {
          sent: sentCount,
          failed: errorCount,
          total: recipients.length
        }
      });

    } catch (error) {
      console.error('❌ Erreur envoi campagne:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi de la campagne: ' + error.message
      });
    }
  },

  // ========================================
  // FONCTIONS UTILITAIRES
  // ========================================

  async getRecipients(recipientType, selectedCustomerIds) {
    try {
      let whereClause = '';
      let binds = [];
      
      switch(recipientType) {
        case 'newsletter':
          whereClause = 'WHERE c.marketing_opt_in = true';
          break;
        case 'vip':
          whereClause = 'WHERE (c.total_orders >= 5 OR c.total_spent >= 500)';
          break;
        case 'with-orders':
          whereClause = 'WHERE c.total_orders > 0';
          break;
        case 'selected':
          if (selectedCustomerIds && selectedCustomerIds.length > 0) {
            whereClause = `WHERE c.id = ANY($1)`;
            binds = [selectedCustomerIds];
          }
          break;
        default:
          whereClause = '';
      }

      const query = `
        SELECT c.id, c.first_name, c.last_name, c.email, c.total_orders, c.total_spent
        FROM customer c
        ${whereClause}
        AND c.email IS NOT NULL AND c.email != ''
      `;

      const recipients = await sequelize.query(query, {
        bind: binds,
        type: Sequelize.QueryTypes.SELECT
      });

      return recipients;
    } catch (error) {
      console.error('❌ Erreur récupération destinataires:', error);
      return [];
    }
  },

  processEmailTemplate(content, variables) {
    let processedContent = content;
    
    // Remplacer les variables
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, variables[key] || '');
    });

    return processedContent;
  },

  wrapEmailTemplate(content, template = 'elegant') {
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
        <title>CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: linear-gradient(135deg, ${color.primary}, ${color.secondary}); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">CrystosJewel</h1>
          </div>
          <div style="padding: 30px;">
            ${content}
          </div>
          <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
            <p>© 2025 CrystosJewel - Tous droits réservés</p>
            <p style="margin-top: 5px;">
              <a href="{{unsubscribeUrl}}" style="color: #64748b;">Se désabonner</a> | 
              <a href="{{preferencesUrl}}" style="color: #64748b;">Gérer mes préférences</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // ========================================
  // TRACKING
  // ========================================

  async trackOpen(req, res) {
    try {
      const { campaignId, customerId } = req.params;
      
      // Enregistrer l'ouverture
      await sequelize.query(`
        UPDATE email_logs 
        SET opened_at = COALESCE(opened_at, NOW()), open_count = open_count + 1
        WHERE campaign_id = $1 AND customer_id = $2
      `, {
        bind: [campaignId, customerId]
      });

      // Retourner un pixel transparent
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.send(pixel);

    } catch (error) {
      console.error('❌ Erreur tracking ouverture:', error);
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.send(pixel);
    }
  },

  async trackClick(req, res) {
    try {
      const { campaignId, customerId } = req.params;
      const { url } = req.query;
      
      // Enregistrer le clic
      await sequelize.query(`
        UPDATE email_logs 
        SET clicked_at = COALESCE(clicked_at, NOW()), click_count = click_count + 1
        WHERE campaign_id = $1 AND customer_id = $2
      `, {
        bind: [campaignId, customerId]
      });

      // Rediriger vers l'URL originale
      res.redirect(url || '/');

    } catch (error) {
      console.error('❌ Erreur tracking clic:', error);
      res.redirect(req.query.url || '/');
    }
  },

   async showEmailEditor(req, res) {
    try {
      console.log('📧 Chargement éditeur email marketing');

      // Récupérer les clients avec leurs statistiques
      const customers = await sequelize.query(`
        SELECT 
          c.id,
          CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as name,
          c.email,
          COALESCE(c.marketing_opt_in, false) as newsletter_subscribed,
          COALESCE(c.total_orders, 0) as total_orders,
          COALESCE(c.total_spent, 0) as total_spent,
          CASE 
            WHEN c.total_orders >= 5 OR c.total_spent >= 500 THEN 'vip'
            WHEN c.total_orders > 0 THEN 'client'
            ELSE 'prospect'
          END as customer_type
        FROM customer c
        WHERE c.email IS NOT NULL 
        AND c.email != ''
        ORDER BY c.created_at DESC
      `, { type: Sequelize.QueryTypes.SELECT });

      // Récupérer les produits pour l'éditeur
      const products = await sequelize.query(`
        SELECT 
          j.id,
          j.name,
          j.slug,
          j.price_ttc as price,
          j.image,
          COALESCE(ji.image_path, j.image) as image_url,
          c.name as category_name
        FROM jewel j
        LEFT JOIN jewel_image ji ON j.id = ji.jewel_id AND ji.image_order = 1
        LEFT JOIN category c ON j.category_id = c.id
        WHERE j.is_active = true
        AND j.stock > 0
        ORDER BY j.created_at DESC
        LIMIT 20
      `, { type: Sequelize.QueryTypes.SELECT });

      // Statistiques des campagnes (utilisation de la table email_logs existante)
      let campaignStats = {
        totalCampaigns: 0,
        totalEmailsSent: 0,
        averageOpenRate: 0,
        averageClickRate: 0,
        totalSubscribers: customers.filter(c => c.newsletter_subscribed).length
      };

      try {
        const [stats] = await sequelize.query(`
          SELECT 
            COUNT(DISTINCT DATE(created_at)) as total_campaigns,
            COUNT(*) as total_emails_sent,
            COUNT(CASE WHEN status = 'sent' THEN 1 END) as emails_delivered
          FROM email_logs
          WHERE email_type = 'marketing'
        `, { type: Sequelize.QueryTypes.SELECT });

        if (stats) {
          campaignStats = {
            ...campaignStats,
            totalCampaigns: stats.total_campaigns || 0,
            totalEmailsSent: stats.total_emails_sent || 0,
            averageOpenRate: 0, // À implémenter avec le tracking
            averageClickRate: 0 // À implémenter avec le tracking
          };
        }
      } catch (error) {
        console.log('⚠️ Pas de données campagnes encore');
      }

      // Filtrer les clients par type
      const customerStats = {
        newsletter: customers.filter(c => c.newsletter_subscribed).length,
        all: customers.length,
        vip: customers.filter(c => c.customer_type === 'vip').length,
        withOrders: customers.filter(c => c.total_orders > 0).length
      };

      res.render('admin/email-marketing/editor', {
        title: 'Éditeur d\'Emails Marketing',
        customers,
        products,
        campaignStats,
        customerStats,
        user: req.session.user
      });

    } catch (error) {
      console.error('❌ Erreur éditeur email:', error);
      res.status(500).render('error', {
        title: 'Erreur',
        message: 'Erreur lors du chargement de l\'éditeur',
        user: req.session.user
      });
    }
  },

  // ========================================
  // API - RÉCUPÉRER LES CLIENTS
  // ========================================
  async getCustomersList(req, res) {
    try {
      const { filter } = req.query;
      
      let whereClause = '';

      switch(filter) {
        case 'newsletter':
          whereClause = 'WHERE c.marketing_opt_in = true';
          break;
        case 'vip':
          whereClause = 'WHERE (c.total_orders >= 5 OR c.total_spent >= 500)';
          break;
        case 'with-orders':
          whereClause = 'WHERE c.total_orders > 0';
          break;
        default:
          whereClause = '';
      }

      const customers = await sequelize.query(`
        SELECT 
          c.id,
          CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as name,
          c.email,
          COALESCE(c.marketing_opt_in, false) as newsletter_subscribed,
          COALESCE(c.total_orders, 0) as total_orders,
          COALESCE(c.total_spent, 0) as total_spent,
          CASE 
            WHEN c.total_orders >= 5 OR c.total_spent >= 500 THEN 'vip'
            WHEN c.total_orders > 0 THEN 'client'
            ELSE 'prospect'
          END as customer_type
        FROM customer c
        ${whereClause}
        AND c.email IS NOT NULL 
        AND c.email != ''
        ORDER BY c.created_at DESC
      `, { type: Sequelize.QueryTypes.SELECT });

      res.json({
        success: true,
        customers
      });

    } catch (error) {
      console.error('❌ Erreur récupération clients:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des clients'
      });
    }
  },

  // ========================================
  // SAUVEGARDER BROUILLON
  // ========================================
  async saveDraft(req, res) {
    try {
      console.log('💾 Sauvegarde brouillon email marketing');

      const {
        name,
        subject,
        content,
        preheader,
        fromName,
        template,
        recipientType,
        selectedCustomerIds
      } = req.body;

      // Pour cette version simplifiée, on sauvegarde dans localStorage côté client
      // et optionnellement en base de données dans une table drafts (à créer)
      
      res.json({
        success: true,
        message: 'Brouillon sauvegardé avec succès',
        data: {
          name,
          subject,
          content,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Erreur sauvegarde brouillon:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sauvegarde: ' + error.message
      });
    }
  },

  // ========================================
  // ENVOYER EMAIL DE TEST
  // ========================================
  async sendTest(req, res) {
    try {
      console.log('🧪 Envoi email de test marketing');

      const { email, subject, content, template } = req.body;

      if (!email || !subject || !content) {
        return res.status(400).json({
          success: false,
          message: 'Email, sujet et contenu requis'
        });
      }

      // Traiter le contenu avec des variables de test
      const testContent = this.processEmailTemplate(content, {
        firstName: 'John',
        lastName: 'Doe',
        email: email,
        orderNumber: 'TEST-001',
        total: '99,99€',
        trackingNumber: 'FR123456789',
        unsubscribeUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/marketing/unsubscribe?email=${email}`,
        preferencesUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/marketing/preferences?email=${email}`
      });

      const finalContent = this.wrapEmailTemplate(testContent, template);

      // Envoyer l'email
      const info = await transporter.sendMail({
        from: `"CrystosJewel 💎" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `[TEST] ${subject}`,
        html: finalContent
      });

      console.log('✅ Email test envoyé:', info.messageId);

      res.json({
        success: true,
        message: `Email de test envoyé à ${email}`
      });

    } catch (error) {
      console.error('❌ Erreur envoi test:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du test: ' + error.message
      });
    }
  },

  // ========================================
  // ENVOYER CAMPAGNE COMPLÈTE
  // ========================================
  async sendCampaign(req, res) {
    try {
      console.log('🚀 Envoi campagne email marketing');

      const {
        name,
        subject,
        content,
        preheader,
        fromName,
        template,
        recipientType,
        selectedCustomerIds
      } = req.body;

      if (!subject || !content) {
        return res.status(400).json({
          success: false,
          message: 'Sujet et contenu requis'
        });
      }

      // Récupérer les destinataires
      const recipients = await this.getRecipients(recipientType, selectedCustomerIds);

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucun destinataire trouvé'
        });
      }

      // Envoyer les emails
      let sentCount = 0;
      let errorCount = 0;

      for (const recipient of recipients) {
        try {
          // Personnaliser le contenu
          const personalizedContent = this.processEmailTemplate(content, {
            firstName: recipient.first_name || 'Cher client',
            lastName: recipient.last_name || '',
            email: recipient.email,
            orderNumber: recipient.total_orders || 0,
            total: `${recipient.total_spent || 0}€`,
            trackingNumber: '',
            unsubscribeUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/marketing/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
            preferencesUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/marketing/preferences?email=${encodeURIComponent(recipient.email)}`
          });

          const finalContent = this.wrapEmailTemplate(personalizedContent, template);

          // Envoyer l'email
          await transporter.sendMail({
            from: `"${fromName || 'CrystosJewel'} 💎" <${process.env.MAIL_USER}>`,
            to: recipient.email,
            subject: subject,
            html: finalContent
          });

          // Logger l'envoi dans email_logs
          await sequelize.query(`
            INSERT INTO email_logs (
              customer_id, email_type, recipient_email, subject, status, created_at, sent_at
            ) VALUES ($1, 'marketing', $2, $3, 'sent', NOW(), NOW())
          `, {
            bind: [recipient.id, recipient.email, subject]
          });

          sentCount++;

          // Délai pour éviter les limitations
          if (sentCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (emailError) {
          console.error(`❌ Erreur envoi à ${recipient.email}:`, emailError.message);
          errorCount++;

          // Logger l'erreur
          await sequelize.query(`
            INSERT INTO email_logs (
              customer_id, email_type, recipient_email, subject, status, error_message, created_at
            ) VALUES ($1, 'marketing', $2, $3, 'failed', $4, NOW())
          `, {
            bind: [recipient.id, recipient.email, subject, emailError.message]
          });
        }
      }

      console.log(`✅ Campagne envoyée: ${sentCount} succès, ${errorCount} erreurs`);

      res.json({
        success: true,
        message: `Campagne envoyée avec succès à ${sentCount} destinataires`,
        stats: {
          sent: sentCount,
          failed: errorCount,
          total: recipients.length
        }
      });

    } catch (error) {
      console.error('❌ Erreur envoi campagne:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi de la campagne: ' + error.message
      });
    }
  },

  // ========================================
  // FONCTIONS UTILITAIRES
  // ========================================

  async getRecipients(recipientType, selectedCustomerIds) {
    try {
      let whereClause = '';
      let binds = [];
      
      switch(recipientType) {
        case 'newsletter':
          whereClause = 'WHERE c.marketing_opt_in = true';
          break;
        case 'vip':
          whereClause = 'WHERE (c.total_orders >= 5 OR c.total_spent >= 500)';
          break;
        case 'with-orders':
          whereClause = 'WHERE c.total_orders > 0';
          break;
        case 'selected':
          if (selectedCustomerIds && selectedCustomerIds.length > 0) {
            whereClause = `WHERE c.id = ANY($1)`;
            binds = [selectedCustomerIds];
          }
          break;
        default:
          whereClause = '';
      }

      const query = `
        SELECT c.id, c.first_name, c.last_name, c.email, c.total_orders, c.total_spent
        FROM customer c
        ${whereClause}
        AND c.email IS NOT NULL AND c.email != ''
      `;

      const recipients = await sequelize.query(query, {
        bind: binds,
        type: Sequelize.QueryTypes.SELECT
      });

      return recipients;
    } catch (error) {
      console.error('❌ Erreur récupération destinataires:', error);
      return [];
    }
  },

  processEmailTemplate(content, variables) {
    let processedContent = content;
    
    // Remplacer les variables
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, variables[key] || '');
    });

    return processedContent;
  },

  wrapEmailTemplate(content, template = 'elegant') {
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
        <title>CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: linear-gradient(135deg, ${color.primary}, ${color.secondary}); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">CrystosJewel</h1>
          </div>
          <div style="padding: 30px;">
            ${content}
          </div>
          <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
            <p>© 2025 CrystosJewel - Tous droits réservés</p>
            <p style="margin-top: 5px;">
              <a href="{{unsubscribeUrl}}" style="color: #64748b;">Se désabonner</a> | 
              <a href="{{preferencesUrl}}" style="color: #64748b;">Gérer mes préférences</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // ========================================
  // TRACKING (Simplifiés)
  // ========================================

  async trackOpen(req, res) {
    try {
      const { campaignId, customerId } = req.params;
      
      // Log simple dans email_logs
      await sequelize.query(`
        UPDATE email_logs 
        SET status = 'opened'
        WHERE customer_id = $1 AND email_type = 'marketing'
        AND DATE(created_at) = CURRENT_DATE
      `, {
        bind: [customerId]
      });

      // Retourner un pixel transparent
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.send(pixel);

    } catch (error) {
      console.error('❌ Erreur tracking ouverture:', error);
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.send(pixel);
    }
  },

  async trackClick(req, res) {
    try {
      const { campaignId, customerId } = req.params;
      const { url } = req.query;
      
      // Log simple
      console.log(`🖱️ Clic détecté: client ${customerId}, URL: ${url}`);

      // Rediriger vers l'URL originale
      res.redirect(url || '/');

    } catch (error) {
      console.error('❌ Erreur tracking clic:', error);
      res.redirect(req.query.url || '/');
    }
  },
};