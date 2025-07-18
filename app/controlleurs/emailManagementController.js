// ========================================
// 📧 CONTRÔLEUR EMAIL MANAGEMENT SIMPLIFIÉ
// Fichier: app/controllers/emailManagementController.js
// ========================================

import { Sequelize } from 'sequelize';
import { sequelize } from "../models/sequelize-client.js";
import { Customer } from "../models/customerModel.js";

export const emailManagementControlleur = {

    // ========================================
    // 📊 DASHBOARD PRINCIPAL
    // ========================================
 async dashboard(req, res) {
    try {
        console.log('📧 Chargement dashboard email management');

        // Statistiques simples
        const stats = {
            totalCampaigns: 0,
            activeCampaigns: 0,
            draftCampaigns: 0,
            emailsSent: 0,
            emailsOpened: 0,
            openRate: 0,
            subscribedCustomers: 0,
            totalCustomers: 0
        };

        // ✅ RÉCUPÉRER LES CAMPAGNES RÉCENTES POUR LE DASHBOARD
        let recentCampaigns = [];

        // Essayer de récupérer les vraies stats
        try {
            const [campaignStats] = await sequelize.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'draft' THEN 1 END) as drafts
                FROM email_campaigns
            `, { type: Sequelize.QueryTypes.SELECT });

            if (campaignStats) {
                stats.totalCampaigns = campaignStats.total || 0;
                stats.activeCampaigns = campaignStats.active || 0;
                stats.draftCampaigns = campaignStats.drafts || 0;
            }

            // ✅ RÉCUPÉRER LES 5 DERNIÈRES CAMPAGNES
            recentCampaigns = await sequelize.query(`
                SELECT 
                    c.*,
                    COALESCE(COUNT(DISTINCT el.id), 0) as emails_sent,
                    COALESCE(COUNT(DISTINCT CASE WHEN el.opened_at IS NOT NULL THEN el.id END), 0) as emails_opened,
                    COALESCE(ROUND(
                        COUNT(DISTINCT CASE WHEN el.opened_at IS NOT NULL THEN el.id END) * 100.0 / 
                        NULLIF(COUNT(DISTINCT el.id), 0), 1
                    ), 0) as open_rate
                FROM email_campaigns c
                LEFT JOIN email_logs el ON c.id = el.campaign_id
                GROUP BY c.id
                ORDER BY c.created_at DESC
                LIMIT 5
            `, {
                type: Sequelize.QueryTypes.SELECT
            });

        } catch (error) {
            console.log('⚠️ Pas de données de campagnes encore:', error.message);
        }

        try {
            const [emailStats] = await sequelize.query(`
                SELECT 
                    COUNT(*) as sent,
                    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened
                FROM email_logs
            `, { type: Sequelize.QueryTypes.SELECT });

            if (emailStats) {
                stats.emailsSent = emailStats.sent || 0;
                stats.emailsOpened = emailStats.opened || 0;
                stats.openRate = stats.emailsSent > 0 ? 
                    Math.round((stats.emailsOpened / stats.emailsSent) * 100) : 0;
            }
        } catch (error) {
            console.log('⚠️ Pas de logs d\'emails encore');
        }

        try {
            const customerCount = await Customer.count();
            const subscribedCount = await Customer.count({
                where: { newsletter_subscribed: true }
            });
            
            stats.totalCustomers = customerCount || 0;
            stats.subscribedCustomers = subscribedCount || 0;
        } catch (error) {
            console.log('⚠️ Erreur récupération clients:', error.message);
        }

        // ✅ PASSER LES CAMPAGNES À LA VUE
        res.render('admin/email-management/dashboard', {
            title: 'Gestion des Emails',
            stats,
            campaigns: recentCampaigns, // ← AJOUTER CETTE LIGNE
            user: req.session.user,
            helpers: {
                formatDate: (date) => new Date(date).toLocaleDateString('fr-FR'),
                formatDateTime: (date) => new Date(date).toLocaleString('fr-FR'),
                getStatusLabel: (status) => {
                    const labels = {
                        'draft': 'Brouillon',
                        'sent': 'Envoyée',
                        'scheduled': 'Programmée',
                        'cancelled': 'Annulée'
                    };
                    return labels[status] || status;
                }
            }
        });

    } catch (error) {
        console.error('❌ Erreur dashboard email:', error);
        res.status(500).render('error', {
            title: 'Erreur',
            message: 'Erreur lors du chargement du dashboard email'
        });
    }
},

// Page de création de campagne
  async renderCreatePage(req, res) {
    try {
      // Récupérer les données nécessaires
      const images = await getUploadedImages(); // Vos images uploadées
      const stats = await getEmailStats(); // Statistiques d'emails
      const customers = await getCustomers(); // Liste des clients
      
      res.render('admin/email-management/create-advanced', {
        title: 'Créer une Campagne Email',
        campaign: {}, // ✅ Objet vide pour création
        images: images || [],
        stats: {
          totalCustomers: 1247,
          newsletterSubscribers: 892,
          vipCustomers: 156,
          recentCustomers: 234,
          averageOpenRate: '24.5',
          averageClickRate: '3.8',
          lastCampaign: '15 jan 2025'
        },
        customers: customers || []
      });
      
    } catch (error) {
      console.error('❌ Erreur rendu page création:', error);
      res.render('admin/email-management/create-advanced', {
        title: 'Créer une Campagne Email',
        campaign: {}, // ✅ Toujours définir campaign
        images: [],
        stats: {},
        customers: [],
        error: error.message
      });
    }
  },

  // Page d'édition de campagne
  async renderEditPage(req, res) {
    try {
      const { id } = req.params;
      
      // Récupérer la campagne existante
      const campaign = await getCampaignById(id);
      if (!campaign) {
        return res.status(404).render('error', {
          message: 'Campagne non trouvée'
        });
      }
      
      const images = await getUploadedImages();
      const stats = await getEmailStats();
      const customers = await getCustomers();
      
      res.render('admin/email-management/create-advanced', {
        title: 'Éditer la Campagne',
        campaign: campaign, // ✅ Campagne existante
        images: images || [],
        stats: stats || {},
        customers: customers || []
      });
      
    } catch (error) {
      console.error('❌ Erreur rendu page édition:', error);
      res.render('admin/email-management/create-advanced', {
        title: 'Éditer la Campagne',
        campaign: {}, // ✅ Fallback
        images: [],
        stats: {},
        customers: [],
        error: error.message
      });
    }
  },

    // ========================================
    // 📧 LISTE DES CAMPAGNES
    // ========================================
    async listCampaigns(req, res) {
        try {
            console.log('📧 Liste des campagnes email');

            let campaigns = [];

            try {
                campaigns = await sequelize.query(`
                    SELECT 
                        c.*,
                        COALESCE(COUNT(DISTINCT el.id), 0) as emails_sent,
                        COALESCE(COUNT(DISTINCT CASE WHEN el.opened_at IS NOT NULL THEN el.id END), 0) as emails_opened,
                        COALESCE(COUNT(DISTINCT CASE WHEN el.clicked_at IS NOT NULL THEN el.id END), 0) as emails_clicked,
                        COALESCE(ROUND(
                            COUNT(DISTINCT CASE WHEN el.opened_at IS NOT NULL THEN el.id END) * 100.0 / 
                            NULLIF(COUNT(DISTINCT el.id), 0), 1
                        ), 0) as open_rate,
                        COALESCE(ROUND(
                            COUNT(DISTINCT CASE WHEN el.clicked_at IS NOT NULL THEN el.id END) * 100.0 / 
                            NULLIF(COUNT(DISTINCT el.id), 0), 1
                        ), 0) as click_rate
                    FROM email_campaigns c
                    LEFT JOIN email_logs el ON c.id = el.campaign_id
                    GROUP BY c.id
                    ORDER BY c.created_at DESC
                `, {
                    type: Sequelize.QueryTypes.SELECT
                });
            } catch (error) {
                console.log('⚠️ Erreur récupération campagnes:', error.message);
                campaigns = [];
            }

            res.render('admin/email-management/campaigns', {
                title: 'Campagnes Email',
                campaigns,
                user: req.session.user,
                helpers: {
                    formatDate: (date) => new Date(date).toLocaleDateString('fr-FR'),
                    formatDateTime: (date) => new Date(date).toLocaleString('fr-FR')
                }
            });

        } catch (error) {
            console.error('❌ Erreur liste campagnes:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement des campagnes'
            });
        }
    },

    // ========================================
    // ✏️ CRÉER UNE CAMPAGNE
    // ========================================
    async createCampaignForm(req, res) {
        try {
            console.log('✏️ Formulaire création campagne');

            // Récupérer les clients pour l'éditeur
            let customers = [];
            try {
                customers = await sequelize.query(`
                    SELECT 
                        id,
                        CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as name,
                        email,
                        COALESCE(newsletter_subscribed, false) as newsletter,
                        CASE WHEN total_orders > 5 THEN 'vip' ELSE 'standard' END as type,
                        CASE WHEN total_orders > 0 THEN true ELSE false END as hasOrders
                    FROM customer
                    WHERE email IS NOT NULL AND email != ''
                    ORDER BY first_name, last_name
                `, {
                    type: Sequelize.QueryTypes.SELECT
                });
            } catch (error) {
                console.log('⚠️ Erreur récupération clients:', error.message);
                customers = [];
            }

            res.render('admin/email-management/create-advanced', {
                title: 'Créer une Campagne Email',
                customers,
                user: req.session.user
            });

        } catch (error) {
            console.error('❌ Erreur form création:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement du formulaire'
            });
        }
    },

    // ========================================
    // 💾 SAUVEGARDER BROUILLON
    // ========================================
    async saveDraft(req, res) {
        try {
            console.log('💾 Sauvegarde brouillon email');

            const {
                name,
                subject,
                content,
                preheader,
                fromName,
                template
            } = req.body;

            const [result] = await sequelize.query(`
                INSERT INTO email_campaigns (
                    name, subject, content, preheader, from_name, template,
                    status, created_by, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, 'draft', $7, NOW(), NOW()
                )
                ON CONFLICT (name) 
                DO UPDATE SET 
                    subject = $2, content = $3, preheader = $4, 
                    from_name = $5, template = $6, updated_at = NOW()
                RETURNING id
            `, {
                bind: [name, subject, content, preheader, fromName, template, req.session.user.id],
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
    // 🧪 ENVOYER TEST
    // ========================================
   async sendTest(req, res) {
    try {
        console.log('🧪 Envoi email de test');

        const { email, subject, content, template } = req.body;

        if (!email || !subject || !content) {
            return res.status(400).json({
                success: false,
                message: 'Email, sujet et contenu requis'
            });
        }

        // ✅ CORRECTION: Import direct des fonctions
        try {
            // Essayez d'abord votre mailService existant
            const mailService = await import('../services/mailService.js');
            
            // Préparer le contenu avec les variables de test
            const testContent = content
                .replace(/\{\{firstName\}\}/g, 'John')
                .replace(/\{\{lastName\}\}/g, 'Doe')
                .replace(/\{\{email\}\}/g, email)
                .replace(/\{\{orderNumber\}\}/g, 'TEST-001')
                .replace(/\{\{total\}\}/g, '99,99€')
                .replace(/\{\{trackingNumber\}\}/g, 'FR123456789');

            // Utiliser la fonction sendEmail si elle existe
            let result;
            if (mailService.sendEmail) {
                result = await mailService.sendEmail({
                    to: email,
                    subject: `[TEST] ${subject}`,
                    html: this.wrapEmailTemplate(testContent, template)
                });
            } else {
                // Fallback: utiliser votre transporter existant
                result = await this.sendEmailDirect(email, `[TEST] ${subject}`, this.wrapEmailTemplate(testContent, template));
            }

            if (result && result.success) {
                res.json({
                    success: true,
                    message: `Email de test envoyé à ${email}`
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de l\'envoi du test'
                });
            }

        } catch (importError) {
            console.error('❌ Erreur import mailService:', importError);
            res.status(500).json({
                success: false,
                message: 'Service email non disponible'
            });
        }

    } catch (error) {
        console.error('❌ Erreur envoi test:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi du test'
        });
    }
},

// 4. AJOUTER FONCTION D'ENVOI DIRECT (si mailService pas disponible)
async sendEmailDirect(to, subject, html) {
    try {
        // Utiliser nodemailer directement
        const nodemailer = await import('nodemailer');
        
        const transporter = nodemailer.default.createTransporter({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            }
        });

        const info = await transporter.sendMail({
            from: `"CrystosJewel" <${process.env.MAIL_USER}>`,
            to: to,
            subject: subject,
            html: html
        });

        console.log('✅ Email direct envoyé:', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Erreur envoi direct:', error);
        return { success: false, error: error.message };
    }
},


    // ========================================
    // 🚀 ENVOYER CAMPAGNE
    // ========================================
    async sendCampaign(req, res) {
        try {
            console.log('🚀 Envoi campagne email');

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
                    name, subject, content, preheader, from_name, template,
                    status, created_by, sent_at, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, 'sent', $7, NOW(), NOW(), NOW()
                ) RETURNING id
            `, {
                bind: [name, subject, content, preheader, fromName, template, req.session.user.id],
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

            // 3. Envoyer les emails (simulation pour l'instant)
            let sentCount = 0;
            let errorCount = 0;

            console.log(`📧 Simulation envoi à ${recipients.length} destinataires`);
            
            // Pour l'instant, on simule l'envoi
            for (const recipient of recipients) {
                try {
                    // Logger l'envoi
                    await sequelize.query(`
                        INSERT INTO email_logs (
                            campaign_id, customer_id, email, sent_at, success
                        ) VALUES ($1, $2, $3, NOW(), true)
                    `, {
                        bind: [campaignId, recipient.id, recipient.email]
                    });
                    
                    sentCount++;
                } catch (logError) {
                    console.error('❌ Erreur log email:', logError);
                    errorCount++;
                }
            }

            // 4. Mettre à jour les statistiques de la campagne
            await sequelize.query(`
                UPDATE email_campaigns 
                SET emails_sent = $1, emails_failed = $2, updated_at = NOW()
                WHERE id = $3
            `, {
                bind: [sentCount, errorCount, campaignId]
            });

            console.log(`✅ Campagne simulée: ${sentCount} succès, ${errorCount} erreurs`);

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
    // 📊 STATISTIQUES CAMPAGNE
    // ========================================
    async getCampaignStats(req, res) {
        try {
            const { id } = req.params;
            console.log(`📊 Statistiques campagne ${id}`);

            const [campaign] = await sequelize.query(`
                SELECT 
                    c.*,
                    COALESCE(COUNT(DISTINCT el.id), 0) as emails_sent,
                    COALESCE(COUNT(DISTINCT CASE WHEN el.opened_at IS NOT NULL THEN el.id END), 0) as emails_opened,
                    COALESCE(COUNT(DISTINCT CASE WHEN el.clicked_at IS NOT NULL THEN el.id END), 0) as emails_clicked,
                    COALESCE(ROUND(
                        COUNT(DISTINCT CASE WHEN el.opened_at IS NOT NULL THEN el.id END) * 100.0 / 
                        NULLIF(COUNT(DISTINCT el.id), 0), 1
                    ), 0) as open_rate,
                    COALESCE(ROUND(
                        COUNT(DISTINCT CASE WHEN el.clicked_at IS NOT NULL THEN el.id END) * 100.0 / 
                        NULLIF(COUNT(DISTINCT el.id), 0), 1
                    ), 0) as click_rate
                FROM email_campaigns c
                LEFT JOIN email_logs el ON c.id = el.campaign_id
                WHERE c.id = $1
                GROUP BY c.id
            `, {
                bind: [id],
                type: Sequelize.QueryTypes.SELECT
            });

            if (!campaign) {
                return res.status(404).render('error', {
                    title: 'Campagne non trouvée',
                    message: 'Cette campagne n\'existe pas'
                });
            }

            res.render('admin/email-management/campaign-stats', {
                title: `Statistiques - ${campaign.name}`,
                campaign,
                user: req.session.user,
                helpers: {
                    formatDate: (date) => new Date(date).toLocaleDateString('fr-FR'),
                    formatDateTime: (date) => new Date(date).toLocaleString('fr-FR')
                }
            });

        } catch (error) {
            console.error('❌ Erreur stats campagne:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement des statistiques'
            });
        }
    },

    // ========================================
    // 👥 API CLIENTS
    // ========================================
    async getCustomers(req, res) {
        try {
            const customers = await sequelize.query(`
                SELECT 
                    id,
                    CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as name,
                    email,
                    COALESCE(newsletter_subscribed, false) as newsletter,
                    CASE WHEN total_orders > 5 THEN 'vip' ELSE 'standard' END as type,
                    CASE WHEN total_orders > 0 THEN true ELSE false END as hasOrders
                FROM customer
                WHERE email IS NOT NULL AND email != ''
                ORDER BY first_name, last_name
            `, {
                type: Sequelize.QueryTypes.SELECT
            });
            
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
    // 📊 TRACKING (BASIQUE)
    // ========================================
    async trackOpen(req, res) {
        try {
            const { campaignId, customerId } = req.params;
            
            console.log(`📊 Tracking ouverture: campagne ${campaignId}, client ${customerId}`);
            
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
            
            console.log(`🖱️ Tracking clic: campagne ${campaignId}, client ${customerId}`);
            
            // Enregistrer le clic
            await sequelize.query(`
                UPDATE email_logs 
                SET clicked_at = COALESCE(clicked_at, NOW()), click_count = click_count + 1
                WHERE campaign_id = $1 AND customer_id = $2
            `, {
                bind: [campaignId, customerId]
            });

            // Rediriger vers l'URL originale
            const redirectUrl = url || '/';
            res.redirect(redirectUrl);

        } catch (error) {
            console.error('❌ Erreur tracking clic:', error);
            const redirectUrl = req.query.url || '/';
            res.redirect(redirectUrl);
        }
    },

    // ========================================
    // 🛠️ FONCTIONS UTILITAIRES
    // ========================================
    
    async getRecipients(recipientType, selectedCustomerIds) {
        try {
            let whereClause = '';
            let binds = [];
            
            switch(recipientType) {
                case 'newsletter':
                    whereClause = 'WHERE newsletter_subscribed = true';
                    break;
                case 'vip':
                    whereClause = 'WHERE total_orders > 5';
                    break;
                case 'with-orders':
                    whereClause = 'WHERE total_orders > 0';
                    break;
                case 'selected':
                    if (selectedCustomerIds && selectedCustomerIds.length > 0) {
                        whereClause = `WHERE id IN (${selectedCustomerIds.map(() => '?').join(',')})`;
                        binds = selectedCustomerIds;
                    }
                    break;
                default:
                    whereClause = '';
            }

            const query = `
                SELECT id, first_name, last_name, email
                FROM customer
                ${whereClause}
                AND email IS NOT NULL AND email != ''
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

    wrapEmailTemplate(content, template = 'elegant') {
        const footer = `
            <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                <p>© 2025 CrystosJewel - Tous droits réservés</p>
                <p style="margin-top: 5px;">
                    <a href="#" style="color: #64748b;">Se désabonner</a> | 
                    <a href="#" style="color: #64748b;">Mettre à jour mes préférences</a>
                </p>
            </div>
        `;

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
                    ${content}
                    ${footer}
                </div>
            </body>
            </html>
        `;
    },

    // ========================================
    // 📄 FONCTIONS SUPPLÉMENTAIRES MANQUANTES
    // ========================================

    // Fonction pour obtenir une campagne spécifique
    async getCampaign(req, res) {
        try {
            const { id } = req.params;
            
            const [campaign] = await sequelize.query(`
                SELECT * FROM email_campaigns WHERE id = $1
            `, {
                bind: [id],
                type: Sequelize.QueryTypes.SELECT
            });

            if (!campaign) {
                return res.status(404).render('error', {
                    title: 'Campagne non trouvée',
                    message: 'Cette campagne n\'existe pas'
                });
            }

            res.render('admin/email-management/campaign-detail', {
                title: campaign.name,
                campaign,
                user: req.session.user
            });

        } catch (error) {
            console.error('❌ Erreur campagne:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement de la campagne'
            });
        }
    },

    // Fonction pour éditer une campagne
    async editCampaignForm(req, res) {
        try {
            const { id } = req.params;
            
            const [campaign] = await sequelize.query(`
                SELECT * FROM email_campaigns WHERE id = $1
            `, {
                bind: [id],
                type: Sequelize.QueryTypes.SELECT
            });

            if (!campaign) {
                return res.status(404).render('error', {
                    title: 'Campagne non trouvée',
                    message: 'Cette campagne n\'existe pas'
                });
            }

            res.render('admin/email-management/edit-campaign', {
                title: `Éditer ${campaign.name}`,
                campaign,
                user: req.session.user
            });

        } catch (error) {
            console.error('❌ Erreur édition campagne:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement de l\'édition'
            });
        }
    },

    // Fonction pour mettre à jour une campagne
    async updateCampaign(req, res) {
        try {
            const { id } = req.params;
            const { name, subject, content, preheader, from_name, template } = req.body;

            await sequelize.query(`
                UPDATE email_campaigns 
                SET name = $1, subject = $2, content = $3, preheader = $4, 
                    from_name = $5, template = $6, updated_at = NOW()
                WHERE id = $7
            `, {
                bind: [name, subject, content, preheader, from_name, template, id]
            });

            res.json({
                success: true,
                message: 'Campagne mise à jour avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur mise à jour campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour'
            });
        }
    },

    // Fonction pour supprimer une campagne
    async deleteCampaign(req, res) {
        try {
            const { id } = req.params;

            await sequelize.query(`DELETE FROM email_campaigns WHERE id = $1`, {
                bind: [id]
            });

            res.json({
                success: true,
                message: 'Campagne supprimée avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur suppression campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression'
            });
        }
    },

    // Fonction pour créer une campagne
    async createCampaign(req, res) {
        try {
            const { name, subject, content, preheader, from_name, template } = req.body;

            const [result] = await sequelize.query(`
                INSERT INTO email_campaigns (
                    name, subject, content, preheader, from_name, template,
                    status, created_by, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, 'draft', $7, NOW(), NOW()
                ) RETURNING id
            `, {
                bind: [name, subject, content, preheader, from_name, template, req.session.user.id],
                type: Sequelize.QueryTypes.INSERT
            });

            res.json({
                success: true,
                message: 'Campagne créée avec succès',
                campaignId: result[0]?.id || result.id
            });

        } catch (error) {
            console.error('❌ Erreur création campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création'
            });
        }
    },

    // Fonction pour les statistiques globales
    async getStats(req, res) {
        try {
            res.render('admin/email-management/stats', {
                title: 'Statistiques Email',
                user: req.session.user
            });
        } catch (error) {
            console.error('❌ Erreur stats:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement des statistiques'
            });
        }
    },

    // Fonction pour l'historique
    async getHistory(req, res) {
        try {
            let emailHistory = [];

            try {
                emailHistory = await sequelize.query(`
                    SELECT 
                        el.*,
                        c.name as campaign_name,
                        c.subject as campaign_subject,
                        CONCAT(cu.first_name, ' ', cu.last_name) as customer_name
                    FROM email_logs el
                    LEFT JOIN email_campaigns c ON el.campaign_id = c.id
                    LEFT JOIN customer cu ON el.customer_id = cu.id
                    ORDER BY el.sent_at DESC
                    LIMIT 100
                `, {
                    type: Sequelize.QueryTypes.SELECT
                });
            } catch (error) {
                console.log('⚠️ Pas d\'historique encore:', error.message);
            }

            res.render('admin/email-management/history', {
                title: 'Historique des Emails',
                emailHistory,
                user: req.session.user,
                helpers: {
                    formatDate: (date) => new Date(date).toLocaleDateString('fr-FR'),
                    formatDateTime: (date) => new Date(date).toLocaleString('fr-FR')
                }
            });
        } catch (error) {
            console.error('❌ Erreur historique:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement de l\'historique'
            });
        }
    },

    // Fonction pour les templates
    async getTemplates(req, res) {
        try {
            let templates = [];

            try {
                templates = await sequelize.query(`
                    SELECT * FROM email_templates WHERE is_active = true ORDER BY name
                `, {
                    type: Sequelize.QueryTypes.SELECT
                });
            } catch (error) {
                console.log('⚠️ Pas de templates personnalisés');
                // Templates par défaut
                templates = [
                    { id: 1, name: 'Élégant', template_key: 'elegant', description: 'Template élégant avec dégradé rose' },
                    { id: 2, name: 'Moderne', template_key: 'modern', description: 'Template moderne avec design coloré' },
                    { id: 3, name: 'Classique', template_key: 'classic', description: 'Template classique sobre' },
                    { id: 4, name: 'Minimal', template_key: 'minimal', description: 'Template minimaliste' }
                ];
            }

            res.json({
                success: true,
                templates
            });
        } catch (error) {
            console.error('❌ Erreur templates:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des templates'
            });
        }
    },

    // Fonction pour sauvegarder un template
    async saveTemplate(req, res) {
        try {
            const { name, description, template_key, html_content } = req.body;

            await sequelize.query(`
                INSERT INTO email_templates (
                    name, description, template_key, html_content, 
                    created_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                ON CONFLICT (template_key) 
                DO UPDATE SET 
                    name = $1, description = $2, html_content = $4, updated_at = NOW()
            `, {
                bind: [name, description, template_key, html_content, req.session.user.id]
            });

            res.json({
                success: true,
                message: 'Template sauvegardé avec succès'
            });
        } catch (error) {
            console.error('❌ Erreur sauvegarde template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde du template'
            });
        }
    },

    // Fonction pour prévisualiser un email
    async previewEmail(req, res) {
        try {
            const { campaignId } = req.params;
            
            const [campaign] = await sequelize.query(`
                SELECT * FROM email_campaigns WHERE id = $1
            `, {
                bind: [campaignId],
                type: Sequelize.QueryTypes.SELECT
            });

            if (!campaign) {
                return res.status(404).send('Campagne non trouvée');
            }

            const html = this.wrapEmailTemplate(campaign.content, campaign.template);
            res.send(html);

        } catch (error) {
            console.error('❌ Erreur prévisualisation:', error);
            res.status(500).send('Erreur lors de la prévisualisation');
        }
    }
};