// app/controlleurs/adminMarketingController.js - CONTRÔLEUR MARKETING COMPLET
import { 
  sendMarketingTestEmail, 
  saveMarketingCampaignDraft, 
  sendMarketingCampaign,
  getMarketingCampaignStats,
  getMarketingCampaignHistory,
  getGlobalMarketingStats,
  getMarketingEmailTemplates,
  getMarketingRecipients,
  trackMarketingEmailOpen,
  trackMarketingEmailClick,
  unsubscribeMarketingEmail
} from '../services/emailMarketingService.js';
import { sequelize } from '../models/sequelize-client.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ==========================================
// CONFIGURATION UPLOAD D'IMAGES MARKETING
// ==========================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './public/uploads/email-assets';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'marketing-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif, webp)'));
    }
  }
});

export const adminMarketingController = {

  // ==========================================
  // PAGES D'ADMINISTRATION MARKETING
  // ==========================================

  /**
   * Page principale de l'éditeur d'emails marketing
   */
  async showEmailEditor(req, res) {
    try {
      console.log('📧 Affichage éditeur d\'emails marketing');
      
      // Récupérer les templates marketing disponibles
      const templatesResult = await getMarketingEmailTemplates();
      const templates = templatesResult.success ? templatesResult.templates : [];

      // Récupérer les statistiques marketing globales
      const statsResult = await getGlobalMarketingStats();
      const globalStats = statsResult.success ? statsResult.stats : {};

      // Récupérer les destinataires pour les compteurs
      const newsletterResult = await getMarketingRecipients('newsletter');
      const vipResult = await getMarketingRecipients('vip');
      const customersResult = await getMarketingRecipients('with-orders');
      const allResult = await getMarketingRecipients('all');

      const recipientCounts = {
        newsletter: newsletterResult.success ? newsletterResult.recipients.length : 0,
        vip: vipResult.success ? vipResult.recipients.length : 0,
        customers: customersResult.success ? customersResult.recipients.length : 0,
        all: allResult.success ? allResult.recipients.length : 0
      };

      res.render('admin/email-editor', {
        title: 'Éditeur d\'Emails Marketing - CrystosJewel',
        templates,
        globalStats,
        recipientCounts,
        baseUrl: process.env.BASE_URL
      });
    } catch (error) {
      console.error('❌ Erreur affichage éditeur marketing:', error);
      res.status(500).render('error', {
        message: 'Erreur lors du chargement de l\'éditeur d\'emails marketing',
        error: error
      });
    }
  },

  /**
   * Dashboard des campagnes marketing
   */
  async showCampaignDashboard(req, res) {
    try {
      console.log('📊 Affichage dashboard campagnes marketing');

      // Récupérer l'historique des campagnes marketing
      const historyResult = await getMarketingCampaignHistory(20, 0);
      const campaigns = historyResult.success ? historyResult.campaigns : [];

      // Récupérer les statistiques marketing globales
      const statsResult = await getGlobalMarketingStats();
      const globalStats = statsResult.success ? statsResult.stats : {};

      // Récupérer les campagnes récentes par statut
      const [recentCampaigns] = await sequelize.query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(emails_sent) as total_sent,
          AVG(CASE WHEN emails_delivered > 0 THEN (emails_opened::decimal / emails_delivered) * 100 ELSE 0 END) as avg_open_rate
        FROM email_campaigns
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY status
        ORDER BY count DESC
      `);

      // Récupérer les meilleures campagnes marketing du mois
      const [topCampaigns] = await sequelize.query(`
        SELECT 
          id, name, subject, emails_sent, emails_opened, emails_clicked,
          CASE 
            WHEN emails_delivered > 0 THEN ROUND((emails_opened::decimal / emails_delivered) * 100, 2)
            ELSE 0 
          END as open_rate,
          CASE 
            WHEN emails_opened > 0 THEN ROUND((emails_clicked::decimal / emails_opened) * 100, 2)
            ELSE 0 
          END as click_rate,
          created_at
        FROM email_campaigns
        WHERE status = 'sent' AND created_at >= NOW() - INTERVAL '30 days'
        ORDER BY open_rate DESC, click_rate DESC
        LIMIT 10
      `);

      res.render('admin/marketing-campaign-dashboard', {
        title: 'Dashboard Campagnes Marketing - CrystosJewel',
        campaigns,
        globalStats,
        recentCampaigns,
        topCampaigns,
        helpers: {
          formatDate: (date) => new Date(date).toLocaleDateString('fr-FR'),
          formatDateTime: (date) => new Date(date).toLocaleString('fr-FR'),
          formatNumber: (num) => parseInt(num || 0).toLocaleString('fr-FR'),
          formatPercent: (num) => parseFloat(num || 0).toFixed(1) + '%'
        }
      });
    } catch (error) {
      console.error('❌ Erreur dashboard campagnes marketing:', error);
      res.status(500).render('error', {
        message: 'Erreur lors du chargement du dashboard marketing',
        error: error
      });
    }
  },

  /**
   * Page de détails d'une campagne marketing
   */
  async showCampaignDetails(req, res) {
    try {
      const { id } = req.params;
      console.log(`📋 Affichage détails campagne marketing #${id}`);

      // Récupérer les détails de la campagne marketing
      const statsResult = await getMarketingCampaignStats(id);
      if (!statsResult.success) {
        return res.status(404).render('error', {
          message: 'Campagne marketing non trouvée'
        });
      }

      const campaign = statsResult.stats;

      // Récupérer les destinataires avec leurs statuts
      const [recipients] = await sequelize.query(`
        SELECT 
          cr.*,
          CASE 
            WHEN cr.customer_id IS NOT NULL THEN 'client'
            ELSE 'prospect'
          END as recipient_type
        FROM campaign_recipients cr
        WHERE cr.campaign_id = $1
        ORDER BY cr.sent_at DESC
        LIMIT 100
      `, { bind: [id] });

      // Récupérer les clics groupés par URL
      const [clicksByUrl] = await sequelize.query(`
        SELECT 
          url,
          COUNT(*) as click_count,
          COUNT(DISTINCT email) as unique_clicks
        FROM email_clicks
        WHERE campaign_id = $1
        GROUP BY url
        ORDER BY click_count DESC
        LIMIT 20
      `, { bind: [id] });

      // Récupérer l'évolution des ouvertures par heure
      const [opensByHour] = await sequelize.query(`
        SELECT 
          DATE_TRUNC('hour', opened_at) as hour,
          COUNT(*) as opens
        FROM email_opens
        WHERE campaign_id = $1
        GROUP BY hour
        ORDER BY hour
      `, { bind: [id] });

      res.render('admin/marketing-campaign-details', {
        title: `Campagne Marketing: ${campaign.name} - CrystosJewel`,
        campaign,
        recipients,
        clicksByUrl,
        opensByHour,
        helpers: {
          formatDate: (date) => new Date(date).toLocaleDateString('fr-FR'),
          formatDateTime: (date) => new Date(date).toLocaleString('fr-FR'),
          getStatusBadge: (status) => {
            const badges = {
              'sent': 'success',
              'delivered': 'info',
              'opened': 'warning',
              'clicked': 'primary',
              'failed': 'danger',
              'pending': 'secondary'
            };
            return badges[status] || 'secondary';
          }
        }
      });
    } catch (error) {
      console.error('❌ Erreur détails campagne marketing:', error);
      res.status(500).render('error', {
        message: 'Erreur lors du chargement des détails marketing',
        error: error
      });
    }
  },

  // ==========================================
  // API ENDPOINTS MARKETING
  // ==========================================

  /**
   * API: Récupérer la liste des clients pour l'éditeur marketing
   */
  async getCustomersList(req, res) {
    try {
      const { filter = 'newsletter', search = '' } = req.query;
      
      let query = `
        SELECT 
          id,
          email,
          COALESCE(first_name, prenom) as first_name,
          COALESCE(last_name, nom) as last_name,
          total_orders,
          total_spent,
          newsletter_subscribed,
          CASE 
            WHEN total_orders >= 5 OR total_spent >= 500 THEN 'vip'
            WHEN total_orders > 0 THEN 'customer'
            ELSE 'subscriber'
          END as customer_type
        FROM customer 
        WHERE email IS NOT NULL 
        AND email != ''
        AND email NOT IN (SELECT email FROM email_unsubscribes)
      `;

      const params = [];
      let paramIndex = 1;

      // Filtres marketing
      switch (filter) {
        case 'newsletter':
          query += ` AND newsletter_subscribed = true`;
          break;
        case 'vip':
          query += ` AND (total_orders >= 5 OR total_spent >= 500)`;
          break;
        case 'with-orders':
          query += ` AND total_orders > 0`;
          break;
        // 'all' = pas de filtre supplémentaire
      }

      // Recherche
      if (search.trim()) {
        query += ` AND (
          LOWER(COALESCE(first_name, prenom, '')) LIKE LOWER($${paramIndex}) OR
          LOWER(COALESCE(last_name, nom, '')) LIKE LOWER($${paramIndex}) OR
          LOWER(email) LIKE LOWER($${paramIndex})
        )`;
        params.push(`%${search.trim()}%`);
        paramIndex++;
      }

      query += ` ORDER BY 
        CASE WHEN total_orders >= 5 OR total_spent >= 500 THEN 1 ELSE 2 END,
        total_orders DESC,
        first_name ASC
        LIMIT 200`;

      const [customers] = await sequelize.query(query, { bind: params });

      res.json({
        success: true,
        customers: customers.map(customer => ({
          id: customer.id,
          name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Client sans nom',
          email: customer.email,
          newsletter: customer.newsletter_subscribed,
          type: customer.customer_type,
          hasOrders: customer.total_orders > 0,
          totalOrders: customer.total_orders || 0,
          totalSpent: customer.total_spent || 0
        }))
      });
    } catch (error) {
      console.error('❌ Erreur récupération clients marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Sauvegarder un brouillon marketing
   */
  async saveDraft(req, res) {
    try {
      console.log('💾 Sauvegarde brouillon marketing');

      const result = await saveMarketingCampaignDraft(req.body, req.session.user?.id);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Brouillon marketing sauvegardé avec succès',
          campaign: result.campaign
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || result.error
        });
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde brouillon marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Envoyer un email de test marketing
   */
  async sendTest(req, res) {
    try {
      const { email, subject, content, template } = req.body;
      
      console.log(`📧 Envoi test marketing à: ${email}`);

      if (!email || !subject || !content) {
        return res.status(400).json({
          success: false,
          message: 'Email, sujet et contenu requis'
        });
      }

      const result = await sendMarketingTestEmail(email, subject, content, template);
      
      if (result.success) {
        res.json({
          success: true,
          message: `Email de test marketing envoyé avec succès à ${email}`
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('❌ Erreur envoi test marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Envoyer une campagne marketing
   */
  async sendCampaign(req, res) {
    try {
      console.log('🚀 Lancement campagne marketing');

      const campaignData = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur non authentifié'
        });
      }

      if (!campaignData.subject || !campaignData.content) {
        return res.status(400).json({
          success: false,
          message: 'Sujet et contenu requis'
        });
      }

      const result = await sendMarketingCampaign(campaignData, userId);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          campaignId: result.campaignId,
          stats: result.stats
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('❌ Erreur envoi campagne marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Upload d'image pour les emails marketing
   */
  async uploadImage(req, res) {
    try {
      upload.single('image')(req, res, async (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Aucun fichier fourni'
          });
        }

        // Enregistrer dans la base de données
        const [result] = await sequelize.query(`
          INSERT INTO email_assets (
            filename, original_name, file_path, file_size, mime_type,
            uploaded_by
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, filename, file_path
        `, {
          bind: [
            req.file.filename,
            req.file.originalname,
            `/uploads/email-assets/${req.file.filename}`,
            req.file.size,
            req.file.mimetype,
            req.session.user?.id
          ]
        });

        const asset = result[0];

        res.json({
          success: true,
          message: 'Image uploadée avec succès',
          asset: {
            id: asset.id,
            filename: asset.filename,
            url: `${process.env.BASE_URL}${asset.file_path}`,
            path: asset.file_path
          }
        });
      });
    } catch (error) {
      console.error('❌ Erreur upload image marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Récupérer les images uploadées
   */
  async getUploadedImages(req, res) {
    try {
      const [images] = await sequelize.query(`
        SELECT 
          id, filename, original_name, file_path, file_size,
          created_at
        FROM email_assets
        ORDER BY created_at DESC
        LIMIT 50
      `);

      res.json({
        success: true,
        images: images.map(img => ({
          id: img.id,
          filename: img.filename,
          originalName: img.original_name,
          url: `${process.env.BASE_URL}${img.file_path}`,
          size: img.file_size,
          uploadedAt: img.created_at
        }))
      });
    } catch (error) {
      console.error('❌ Erreur récupération images marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Récupérer les templates marketing
   */
  async getTemplates(req, res) {
    try {
      const result = await getMarketingEmailTemplates();
      
      if (result.success) {
        res.json({
          success: true,
          templates: result.templates
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('❌ Erreur récupération templates marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Statistiques d'une campagne marketing
   */
  async getCampaignStats(req, res) {
    try {
      const { id } = req.params;
      const result = await getMarketingCampaignStats(id);
      
      if (result.success) {
        res.json({
          success: true,
          stats: result.stats
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error('❌ Erreur stats campagne marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Historique des campagnes marketing
   */
  async getCampaignHistory(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      
      const result = await getMarketingCampaignHistory(limit, offset);
      
      if (result.success) {
        res.json({
          success: true,
          campaigns: result.campaigns,
          total: result.total,
          limit,
          offset
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('❌ Erreur historique campagnes marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Statistiques globales marketing
   */
  async getGlobalStats(req, res) {
    try {
      const result = await getGlobalMarketingStats();
      
      if (result.success) {
        res.json({
          success: true,
          stats: result.stats
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('❌ Erreur stats globales marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Supprimer une campagne marketing
   */
  async deleteCampaign(req, res) {
    try {
      const { id } = req.params;
      
      // Vérifier que la campagne existe et n'est pas en cours d'envoi
      const [campaignResult] = await sequelize.query(`
        SELECT status FROM email_campaigns WHERE id = $1
      `, { bind: [id] });

      if (campaignResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Campagne marketing non trouvée'
        });
      }

      const campaign = campaignResult[0];
      if (campaign.status === 'sending') {
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer une campagne marketing en cours d\'envoi'
        });
      }

      // Supprimer la campagne marketing (CASCADE supprimera les données liées)
      await sequelize.query(`
        DELETE FROM email_campaigns WHERE id = $1
      `, { bind: [id] });

      res.json({
        success: true,
        message: 'Campagne marketing supprimée avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur suppression campagne marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Dupliquer une campagne marketing
   */
  async duplicateCampaign(req, res) {
    try {
      const { id } = req.params;
      const userId = req.session.user?.id;

      // Récupérer la campagne marketing à dupliquer
      const [campaignResult] = await sequelize.query(`
        SELECT name, subject, content, preheader, from_name, template_type, recipient_type
        FROM email_campaigns WHERE id = $1
      `, { bind: [id] });

      if (campaignResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Campagne marketing non trouvée'
        });
      }

      const originalCampaign = campaignResult[0];

      // Créer la copie marketing
      const [newCampaign] = await sequelize.query(`
        INSERT INTO email_campaigns (
          name, subject, content, preheader, from_name, template_type,
          recipient_type, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)
        RETURNING id, name, created_at
      `, {
        bind: [
          `${originalCampaign.name} (Copie Marketing)`,
          originalCampaign.subject,
          originalCampaign.content,
          originalCampaign.preheader,
          originalCampaign.from_name,
          originalCampaign.template_type,
          originalCampaign.recipient_type,
          userId
        ]
      });

      res.json({
        success: true,
        message: 'Campagne marketing dupliquée avec succès',
        campaign: newCampaign[0]
      });
    } catch (error) {
      console.error('❌ Erreur duplication campagne marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // ==========================================
  // GESTION DES TEMPLATES MARKETING
  // ==========================================

  /**
   * API: Créer un nouveau template marketing
   */
  async createTemplate(req, res) {
    try {
      const { name, description, template_type, content, thumbnail_url } = req.body;
      const userId = req.session.user?.id;

      if (!name || !template_type || !content) {
        return res.status(400).json({
          success: false,
          message: 'Nom, type et contenu requis pour le template'
        });
      }

      const [result] = await sequelize.query(`
        INSERT INTO email_templates (
          name, description, template_type, content, thumbnail_url, 
          is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, true, $6)
        RETURNING id, name, created_at
      `, {
        bind: [name, description, template_type, content, thumbnail_url, userId]
      });

      res.json({
        success: true,
        message: 'Template marketing créé avec succès',
        template: result[0]
      });
    } catch (error) {
      console.error('❌ Erreur création template marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Mettre à jour un template marketing
   */
  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const { name, description, content, thumbnail_url, is_active } = req.body;

      const [result] = await sequelize.query(`
        UPDATE email_templates 
        SET name = $1, description = $2, content = $3, thumbnail_url = $4, 
            is_active = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, name, updated_at
      `, {
        bind: [name, description, content, thumbnail_url, is_active, id]
      });

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Template marketing non trouvé'
        });
      }

      res.json({
        success: true,
        message: 'Template marketing mis à jour avec succès',
        template: result[0]
      });
    } catch (error) {
      console.error('❌ Erreur mise à jour template marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Supprimer un template marketing
   */
  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;

      // Vérifier si le template est utilisé dans des campagnes
      const [usageResult] = await sequelize.query(`
        SELECT COUNT(*) as usage_count 
        FROM email_campaigns 
        WHERE template_type = (SELECT template_type FROM email_templates WHERE id = $1)
      `, { bind: [id] });

      const usageCount = parseInt(usageResult[0].usage_count);
      if (usageCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Ce template est utilisé dans ${usageCount} campagne(s). Impossible de le supprimer.`
        });
      }

      const [result] = await sequelize.query(`
        DELETE FROM email_templates WHERE id = $1 RETURNING name
      `, { bind: [id] });

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Template marketing non trouvé'
        });
      }

      res.json({
        success: true,
        message: `Template marketing "${result[0].name}" supprimé avec succès`
      });
    } catch (error) {
      console.error('❌ Erreur suppression template marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // ==========================================
  // TRACKING ET ANALYTICS MARKETING
  // ==========================================

  /**
   * Tracking des ouvertures d'emails marketing (pixel invisible)
   */
  async trackOpen(req, res) {
    try {
      const { campaignId, recipientId } = req.params;
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip || req.connection.remoteAddress;

      await trackMarketingEmailOpen(campaignId, recipientId, userAgent, ipAddress);

      // Retourner un pixel transparent 1x1
      const pixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 
        'base64'
      );

      res.set({
        'Content-Type': 'image/png',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.send(pixel);
    } catch (error) {
      console.error('❌ Erreur tracking ouverture marketing:', error);
      // Retourner quand même le pixel
      const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      res.send(pixel);
    }
  },

  /**
   * Tracking des clics sur les liens marketing
   */
  async trackClick(req, res) {
    try {
      const { campaignId, recipientId } = req.params;
      const { url } = req.query;
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip || req.connection.remoteAddress;

      if (!url) {
        return res.status(400).send('URL manquante');
      }

      const result = await trackMarketingEmailClick(campaignId, recipientId, url, userAgent, ipAddress);

      if (result.success) {
        // Rediriger vers l'URL cible
        res.redirect(result.targetUrl);
      } else {
        // En cas d'erreur, rediriger quand même vers l'URL
        res.redirect(url);
      }
    } catch (error) {
      console.error('❌ Erreur tracking clic marketing:', error);
      // Rediriger vers l'URL en cas d'erreur
      res.redirect(req.query.url || process.env.BASE_URL);
    }
  },

  /**
   * Page de désabonnement marketing
   */
  async showUnsubscribePage(req, res) {
    try {
      const { email, campaign } = req.query;

      if (!email) {
        return res.status(400).render('error', {
          message: 'Email manquant pour le désabonnement'
        });
      }

      res.render('email/unsubscribe', {
        title: 'Se désabonner - CrystosJewel',
        email: email,
        campaignId: campaign
      });
    } catch (error) {
      console.error('❌ Erreur page désabonnement marketing:', error);
      res.status(500).render('error', {
        message: 'Erreur lors du chargement de la page',
        error: error
      });
    }
  },

  /**
   * Traitement du désabonnement marketing
   */
  async processUnsubscribe(req, res) {
    try {
      const { email, reason, campaign } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email requis'
        });
      }

      const result = await unsubscribeMarketingEmail(email, campaign, reason, ipAddress);

      if (result.success) {
        res.json({
          success: true,
          message: 'Désabonnement marketing effectué avec succès'
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('❌ Erreur désabonnement marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // ==========================================
  // ANALYTICS AVANCÉS MARKETING
  // ==========================================

  /**
   * API: Rapport détaillé d'une campagne marketing
   */
  async getCampaignReport(req, res) {
    try {
      const { id } = req.params;
      
      // Récupérer les statistiques détaillées
      const [reportData] = await sequelize.query(`
        SELECT 
          c.*,
          COUNT(DISTINCT cr.id) as total_recipients,
          COUNT(DISTINCT CASE WHEN eo.id IS NOT NULL THEN cr.id END) as unique_openers,
          COUNT(DISTINCT CASE WHEN ec.id IS NOT NULL THEN cr.id END) as unique_clickers,
          COUNT(eo.id) as total_opens,
          COUNT(ec.id) as total_clicks,
          
          -- Analyse temporelle
          DATE_TRUNC('hour', c.started_at) as start_hour,
          DATE_TRUNC('hour', c.completed_at) as end_hour,
          
          -- Top devices
          STRING_AGG(DISTINCT 
            CASE 
              WHEN eo.user_agent ILIKE '%mobile%' THEN 'Mobile'
              WHEN eo.user_agent ILIKE '%tablet%' THEN 'Tablet'
              ELSE 'Desktop'
            END, ', '
          ) as device_types,
          
          -- Géolocalisation (approximative par IP)
          COUNT(DISTINCT eo.ip_address) as unique_ip_opens,
          COUNT(DISTINCT ec.ip_address) as unique_ip_clicks
          
        FROM email_campaigns c
        LEFT JOIN campaign_recipients cr ON c.id = cr.campaign_id
        LEFT JOIN email_opens eo ON cr.id = eo.recipient_id
        LEFT JOIN email_clicks ec ON cr.id = ec.recipient_id
        WHERE c.id = $1
        GROUP BY c.id
      `, { bind: [id] });

      if (reportData.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Campagne marketing non trouvée'
        });
      }

      // Récupérer les détails par heure
      const [hourlyStats] = await sequelize.query(`
        SELECT 
          DATE_TRUNC('hour', eo.opened_at) as hour,
          COUNT(eo.id) as opens,
          COUNT(ec.id) as clicks
        FROM email_opens eo
        LEFT JOIN email_clicks ec ON eo.recipient_id = ec.recipient_id 
          AND DATE_TRUNC('hour', eo.opened_at) = DATE_TRUNC('hour', ec.clicked_at)
        WHERE eo.campaign_id = $1
        GROUP BY hour
        ORDER BY hour
      `, { bind: [id] });

      // Top URLs cliquées
      const [topUrls] = await sequelize.query(`
        SELECT 
          url,
          COUNT(*) as clicks,
          COUNT(DISTINCT email) as unique_clicks
        FROM email_clicks
        WHERE campaign_id = $1
        GROUP BY url
        ORDER BY clicks DESC
        LIMIT 10
      `, { bind: [id] });

      res.json({
        success: true,
        report: {
          campaign: reportData[0],
          hourlyStats,
          topUrls,
          summary: {
            deliveryRate: reportData[0].emails_sent > 0 ? 
              ((reportData[0].emails_delivered / reportData[0].emails_sent) * 100).toFixed(2) : 0,
            openRate: reportData[0].emails_delivered > 0 ? 
              ((reportData[0].unique_openers / reportData[0].emails_delivered) * 100).toFixed(2) : 0,
            clickRate: reportData[0].unique_openers > 0 ? 
              ((reportData[0].unique_clickers / reportData[0].unique_openers) * 100).toFixed(2) : 0,
            engagement: reportData[0].total_opens + reportData[0].total_clicks
          }
        }
      });
    } catch (error) {
      console.error('❌ Erreur rapport campagne marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Statistiques de performance par segment
   */
  async getSegmentPerformance(req, res) {
    try {
      const { period = '30' } = req.query; // Jours
      
      const [segmentStats] = await sequelize.query(`
        SELECT 
          c.recipient_type as segment,
          COUNT(c.id) as total_campaigns,
          SUM(c.emails_sent) as total_sent,
          SUM(c.emails_delivered) as total_delivered,
          SUM(c.emails_opened) as total_opened,
          SUM(c.emails_clicked) as total_clicked,
          
          AVG(CASE WHEN c.emails_sent > 0 THEN (c.emails_delivered::decimal / c.emails_sent) * 100 ELSE 0 END) as avg_delivery_rate,
          AVG(CASE WHEN c.emails_delivered > 0 THEN (c.emails_opened::decimal / c.emails_delivered) * 100 ELSE 0 END) as avg_open_rate,
          AVG(CASE WHEN c.emails_opened > 0 THEN (c.emails_clicked::decimal / c.emails_opened) * 100 ELSE 0 END) as avg_click_rate
          
        FROM email_campaigns c
        WHERE c.created_at >= NOW() - INTERVAL '${period} days'
        AND c.status = 'sent'
        GROUP BY c.recipient_type
        ORDER BY total_sent DESC
      `);

      res.json({
        success: true,
        segmentPerformance: segmentStats
      });
    } catch (error) {
      console.error('❌ Erreur performance segments marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Tableau de bord des tendances
   */
  async getTrends(req, res) {
    try {
      // Tendances sur 7 jours vs 7 jours précédents
      const [trends] = await sequelize.query(`
        WITH current_week AS (
          SELECT 
            COUNT(*) as campaigns,
            SUM(emails_sent) as emails_sent,
            AVG(CASE WHEN emails_delivered > 0 THEN (emails_opened::decimal / emails_delivered) * 100 ELSE 0 END) as avg_open_rate
          FROM email_campaigns
          WHERE created_at >= NOW() - INTERVAL '7 days'
          AND status = 'sent'
        ),
        previous_week AS (
          SELECT 
            COUNT(*) as campaigns,
            SUM(emails_sent) as emails_sent,
            AVG(CASE WHEN emails_delivered > 0 THEN (emails_opened::decimal / emails_delivered) * 100 ELSE 0 END) as avg_open_rate
          FROM email_campaigns
          WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days'
          AND status = 'sent'
        )
        SELECT 
          cw.campaigns as current_campaigns,
          pw.campaigns as previous_campaigns,
          CASE WHEN pw.campaigns > 0 THEN 
            ((cw.campaigns - pw.campaigns)::decimal / pw.campaigns * 100) 
          ELSE 0 END as campaigns_growth,
          
          cw.emails_sent as current_emails,
          pw.emails_sent as previous_emails,
          CASE WHEN pw.emails_sent > 0 THEN 
            ((cw.emails_sent - pw.emails_sent)::decimal / pw.emails_sent * 100) 
          ELSE 0 END as emails_growth,
          
          cw.avg_open_rate as current_open_rate,
          pw.avg_open_rate as previous_open_rate,
          (cw.avg_open_rate - pw.avg_open_rate) as open_rate_change
          
        FROM current_week cw, previous_week pw
      `);

      res.json({
        success: true,
        trends: trends[0] || {
          campaigns_growth: 0,
          emails_growth: 0,
          open_rate_change: 0
        }
      });
    } catch (error) {
      console.error('❌ Erreur tendances marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // ==========================================
  // GESTION DES LISTES ET SEGMENTATION
  // ==========================================

  /**
   * API: Créer une liste de diffusion personnalisée
   */
  async createCustomList(req, res) {
    try {
      const { name, description, criteria } = req.body;
      const userId = req.session.user?.id;

      // Construire la requête SQL basée sur les critères
      let query = `
        SELECT id, email, 
               COALESCE(first_name, prenom) as first_name,
               COALESCE(last_name, nom) as last_name
        FROM customer 
        WHERE email IS NOT NULL 
        AND email != ''
        AND email NOT IN (SELECT email FROM email_unsubscribes)
      `;

      // Appliquer les critères
      if (criteria.hasOrders) {
        query += ` AND total_orders > 0`;
      }
      if (criteria.minSpent) {
        query += ` AND total_spent >= ${criteria.minSpent}`;
      }
      if (criteria.newsletter) {
        query += ` AND newsletter_subscribed = true`;
      }
      if (criteria.lastOrderDays) {
        query += ` AND last_order_date >= NOW() - INTERVAL '${criteria.lastOrderDays} days'`;
      }

      const [recipients] = await sequelize.query(query);

      // Sauvegarder la liste (table personnalisée si nécessaire)
      const listData = {
        name,
        description,
        criteria,
        recipientCount: recipients.length,
        createdBy: userId,
        recipients: recipients.map(r => r.id)
      };

      res.json({
        success: true,
        message: `Liste "${name}" créée avec ${recipients.length} destinataires`,
        list: listData
      });
    } catch (error) {
      console.error('❌ Erreur création liste marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * API: Prévisualiser une segmentation
   */
  async previewSegmentation(req, res) {
    try {
      const { criteria } = req.body;

      let query = `
        SELECT 
          COUNT(*) as total_count,
          COUNT(CASE WHEN newsletter_subscribed = true THEN 1 END) as newsletter_count,
          COUNT(CASE WHEN total_orders >= 5 OR total_spent >= 500 THEN 1 END) as vip_count,
          COUNT(CASE WHEN total_orders > 0 THEN 1 END) as customer_count,
          AVG(total_spent) as avg_spent,
          MAX(total_spent) as max_spent,
          AVG(total_orders) as avg_orders
        FROM customer 
        WHERE email IS NOT NULL 
        AND email != ''
        AND email NOT IN (SELECT email FROM email_unsubscribes)
      `;

      // Appliquer les critères de prévisualisation
      if (criteria.hasOrders) {
        query += ` AND total_orders > 0`;
      }
      if (criteria.minSpent) {
        query += ` AND total_spent >= ${criteria.minSpent}`;
      }
      if (criteria.newsletter) {
        query += ` AND newsletter_subscribed = true`;
      }

      const [preview] = await sequelize.query(query);

      res.json({
        success: true,
        preview: preview[0]
      });
    } catch (error) {
      console.error('❌ Erreur prévisualisation segmentation:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // ==========================================
  // EXPORT ET RAPPORTS
  // ==========================================

  /**
   * API: Exporter les données d'une campagne en CSV
   */
  async exportCampaignData(req, res) {
    try {
      const { id } = req.params;
      const { format = 'csv' } = req.query;

      // Récupérer les données de la campagne
      const [campaignData] = await sequelize.query(`
        SELECT 
          c.name as campaign_name,
          c.subject,
          cr.email,
          cr.name as recipient_name,
          cr.status,
          cr.sent_at,
          cr.opened_at,
          cr.clicked_at,
          cr.failed_at,
          cr.failure_reason
        FROM email_campaigns c
        JOIN campaign_recipients cr ON c.id = cr.campaign_id
        WHERE c.id = $1
        ORDER BY cr.sent_at DESC
      `, { bind: [id] });

      if (format === 'csv') {
        // Générer CSV
        const csvHeader = 'Email,Nom,Statut,Envoyé le,Ouvert le,Cliqué le,Echec,Raison échec\n';
        const csvData = campaignData.map(row => [
          row.email,
          row.recipient_name || '',
          row.status,
          row.sent_at ? new Date(row.sent_at).toLocaleString('fr-FR') : '',
          row.opened_at ? new Date(row.opened_at).toLocaleString('fr-FR') : '',
          row.clicked_at ? new Date(row.clicked_at).toLocaleString('fr-FR') : '',
          row.failed_at ? 'Oui' : 'Non',
          row.failure_reason || ''
        ].map(field => `"${field}"`).join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="campagne-${id}-export.csv"`);
        res.send('\ufeff' + csvHeader + csvData); // \ufeff = BOM pour Excel
      } else {
        res.json({
          success: true,
          data: campaignData
        });
      }
    } catch (error) {
      console.error('❌ Erreur export campagne marketing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

};

// ==========================================
// FONCTIONS UTILITAIRES MARKETING
// ==========================================

/**
 * Middleware pour vérifier les permissions admin marketing
 */
// Exemple : admin = role_id 2
export function requireMarketingAdminAuth(req, res, next) {
  if (!req.session.user || req.session.user.role_id !== 2) {
    return res.status(403).render('error', {
      message: 'Accès non autorisé aux fonctionnalités marketing'
    });
  }
  next();
}


/**
 * Validation des données de campagne marketing
 */
export function validateMarketingCampaignData(req, res, next) {
  const { name, subject, content } = req.body;
  
  if (!name || name.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Le nom de la campagne marketing doit contenir au moins 3 caractères'
    });
  }
  
  if (!subject || subject.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Le sujet doit contenir au moins 5 caractères'
    });
  }
  
  if (!content || content.trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Le contenu doit contenir au moins 10 caractères'
    });
  }
  
  next();
}

/**
 * Middleware de limitation du taux d'envoi
 */
export function rateLimitMarketing(req, res, next) {
  // Simple limitation basée sur la session
  const now = Date.now();
  const sessionKey = 'marketing_last_send';
  
  if (req.session[sessionKey] && (now - req.session[sessionKey]) < 60000) { // 1 minute
    return res.status(429).json({
      success: false,
      message: 'Veuillez attendre avant d\'envoyer une autre campagne'
    });
  }
  
  req.session[sessionKey] = now;
  next();
}

/**
 * Fonction utilitaire pour nettoyer les anciennes données
 */
export async function cleanupOldMarketingData() {
  try {
    // Supprimer les données de tracking anciennes (> 2 ans)
    await sequelize.query(`
      DELETE FROM email_opens WHERE opened_at < NOW() - INTERVAL '2 years'
    `);
    
    await sequelize.query(`
      DELETE FROM email_clicks WHERE clicked_at < NOW() - INTERVAL '2 years'
    `);
    
    console.log('✅ Nettoyage des anciennes données marketing terminé');
  } catch (error) {
    console.error('❌ Erreur nettoyage données marketing:', error);
  }
}

export default adminMarketingController;

console.log('✅ Contrôleur Marketing CrystosJewel initialisé avec toutes les fonctionnalités');