// import { EmailCampaign } from '../models/emailCampaignModel.js';
// import { EmailCampaignRecipient } from '../models/emailCampaignRecipientModel.js';
// import { EmailTemplate } from '../models/emailTemplateModel.js';
import { Customer } from '../models/customerModel.js';
import { sendBulkEmailService } from '../services/emailService.js';
import { Op } from 'sequelize';
import { sequelize } from '../models/sequelize-client.js';
import {
    EmailCampaign,
    EmailCampaignRecipient,
    EmailTemplate,
    EmailUnsubscribe
} from '../models/emailRelations.js';
import crypto from 'crypto';

export const emailManagementController = {

    // Afficher la page de gestion des emails
    async renderEmailManagement(req, res) {
        try {
            console.log('📧 Affichage page gestion emails');

            // Récupérer les statistiques récentes
            const [recentCampaigns, totalCampaigns, totalSent, avgOpenRate] = await Promise.all([
                EmailCampaign.findAll({
                    limit: 5,
                    order: [['created_at', 'DESC']],
                    include: [{
                        model: Customer,
                        as: 'creator',
                        attributes: ['first_name', 'last_name']
                    }]
                }),
                EmailCampaign.count(),
                EmailCampaign.sum('sent_count'),
                EmailCampaign.findAll({
                    attributes: [[sequelize.fn('AVG', sequelize.col('opened_count')), 'avg_opened']],
                    where: { sent_count: { [Op.gt]: 0 } }
                })
            ]);

            // Calculer le taux d'ouverture moyen
            const openRate = avgOpenRate[0]?.dataValues?.avg_opened || 0;

            // Récupérer les clients pour la sélection
            const customers = await Customer.findAll({
                attributes: ['id', 'first_name', 'last_name', 'email', 'marketing_opt_in', 'total_orders', 'is_guest'],
                order: [['first_name', 'ASC']]
            });

            // Récupérer les templates disponibles
            const templates = await EmailTemplate.findAll({
                where: { is_active: true },
                order: [['name', 'ASC']]
            });

            res.render('admin/email-management', {
                title: 'Gestion des Emails - Administration',
                stats: {
                    totalCampaigns: totalCampaigns || 0,
                    totalSent: totalSent || 0,
                    avgOpenRate: Math.round(openRate) || 0,
                    activeTemplates: templates.length
                },
                recentCampaigns: recentCampaigns || [],
                customers: customers || [],
                templates: templates || [],
                user: req.session.user
            });

        } catch (error) {
            console.error('❌ Erreur page gestion emails:', error);
            req.flash('error', 'Erreur lors du chargement de la page');
            res.redirect('/admin');
        }
    },

    // Récupérer la liste des clients avec filtres
    async getCustomers(req, res) {
        try {
            const { type, search } = req.query;
            
            let whereConditions = {};
            
            // Appliquer les filtres
            switch (type) {
                case 'with-orders':
                    whereConditions.total_orders = { [Op.gt]: 0 };
                    break;
                case 'no-orders':
                    whereConditions.total_orders = { [Op.eq]: 0 };
                    break;
                case 'newsletter':
                    whereConditions.marketing_opt_in = true;
                    break;
                case 'vip':
                    whereConditions.total_spent = { [Op.gte]: 1000 };
                    break;
                case 'inactive':
                    whereConditions.last_order_date = { 
                        [Op.or]: [
                            { [Op.lt]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
                            { [Op.is]: null }
                        ]
                    };
                    break;
            }

            // Filtre de recherche
            if (search) {
                whereConditions[Op.or] = [
                    { first_name: { [Op.iLike]: `%${search}%` } },
                    { last_name: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } }
                ];
            }

            const customers = await Customer.findAll({
                where: whereConditions,
                attributes: ['id', 'first_name', 'last_name', 'email', 'marketing_opt_in', 'total_orders', 'total_spent'],
                order: [['first_name', 'ASC']],
                limit: 100 // Limiter pour les performances
            });

            res.json({
                success: true,
                customers: customers.map(customer => ({
                    id: customer.id,
                    name: `${customer.first_name} ${customer.last_name}`.trim() || 'Client',
                    email: customer.email,
                    type: customer.total_spent >= 1000 ? 'vip' : 'regular',
                    hasOrders: customer.total_orders > 0,
                    newsletter: customer.marketing_opt_in
                }))
            });

        } catch (error) {
            console.error('❌ Erreur récupération clients:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des clients'
            });
        }
    },

    // Créer et envoyer une campagne email
    async createAndSendCampaign(req, res) {
        try {
            console.log('📧 Création nouvelle campagne email');
            
            const {
                name,
                subject,
                preheader,
                fromName,
                template,
                content,
                recipientType,
                selectedCustomerIds
            } = req.body;

            // Validation
            if (!subject || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Le sujet et le contenu sont obligatoires'
                });
            }

            // Déterminer les destinataires
            let recipients = [];
            
            if (recipientType === 'selected' && selectedCustomerIds?.length > 0) {
                // Clients sélectionnés manuellement
                recipients = await Customer.findAll({
                    where: { id: { [Op.in]: selectedCustomerIds } },
                    attributes: ['id', 'email', 'first_name', 'last_name']
                });
            } else {
                // Appliquer les filtres automatiques
                let whereConditions = { email: { [Op.ne]: null } };
                
                switch (recipientType) {
                    case 'with-orders':
                        whereConditions.total_orders = { [Op.gt]: 0 };
                        break;
                    case 'newsletter':
                        whereConditions.marketing_opt_in = true;
                        break;
                    case 'vip':
                        whereConditions.total_spent = { [Op.gte]: 1000 };
                        break;
                    case 'no-orders':
                        whereConditions.total_orders = { [Op.eq]: 0 };
                        break;
                    // 'all' = pas de filtre supplémentaire
                }

                recipients = await Customer.findAll({
                    where: whereConditions,
                    attributes: ['id', 'email', 'first_name', 'last_name']
                });
            }

            if (recipients.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun destinataire trouvé avec ces critères'
                });
            }

            // Créer la campagne
            const campaign = await EmailCampaign.create({
                name: name || `Campagne ${new Date().toLocaleDateString('fr-FR')}`,
                subject,
                preheader,
                from_name: fromName || 'CrystosJewel',
                from_email: process.env.EMAIL_FROM,
                template_name: template || 'elegant',
                content_html: content,
                recipient_filter: recipientType === 'selected' ? null : { type: recipientType },
                selected_customers: recipientType === 'selected' ? selectedCustomerIds : null,
                total_recipients: recipients.length,
                created_by: req.session.user.id,
                status: 'sending'
            });

            // Créer les entrées destinataires
            const recipientEntries = recipients.map(recipient => ({
                campaign_id: campaign.id,
                customer_id: recipient.id,
                email: recipient.email,
                tracking_id: generateTrackingId()
            }));

            await EmailCampaignRecipient.bulkCreate(recipientEntries);

            // Envoyer les emails en arrière-plan
            sendCampaignEmails(campaign.id, recipients, {
                subject,
                preheader,
                fromName: fromName || 'CrystosJewel',
                template: template || 'elegant',
                content
            });

            // Envoyer une copie à l'admin
            if (process.env.ADMIN_EMAIL) {
                try {
                    await sendBulkEmailService.sendAdminCopy(process.env.ADMIN_EMAIL, {
                        subject: `[COPIE] ${subject}`,
                        content,
                        template,
                        recipientCount: recipients.length
                    });
                } catch (adminEmailError) {
                    console.error('❌ Erreur envoi copie admin:', adminEmailError);
                }
            }

            res.json({
                success: true,
                message: `Campagne créée et envoi en cours vers ${recipients.length} destinataire(s)`,
                campaignId: campaign.id,
                recipientCount: recipients.length
            });

        } catch (error) {
            console.error('❌ Erreur création campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création de la campagne'
            });
        }
    },

    // Récupérer l'historique des campagnes
    async getCampaignHistory(req, res) {
        try {
            const { page = 1, limit = 20, search } = req.query;
            
            let whereConditions = {};
            
            if (search) {
                whereConditions[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { subject: { [Op.iLike]: `%${search}%` } }
                ];
            }

            const { count, rows: campaigns } = await EmailCampaign.findAndCountAll({
                where: whereConditions,
                include: [{
                    model: Customer,
                    as: 'creator',
                    attributes: ['first_name', 'last_name']
                }],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: (parseInt(page) - 1) * parseInt(limit)
            });

            res.json({
                success: true,
                campaigns: campaigns.map(campaign => ({
                    id: campaign.id,
                    name: campaign.name,
                    subject: campaign.subject,
                    status: campaign.status,
                    template: campaign.template_name,
                    totalRecipients: campaign.total_recipients,
                    sentCount: campaign.sent_count,
                    openedCount: campaign.opened_count,
                    clickedCount: campaign.clicked_count,
                    sentAt: campaign.sent_at,
                    createdAt: campaign.created_at,
                    creator: campaign.creator ? `${campaign.creator.first_name} ${campaign.creator.last_name}` : 'Inconnu'
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    pages: Math.ceil(count / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('❌ Erreur récupération historique:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération de l\'historique'
            });
        }
    },

    // Récupérer les détails d'une campagne
    async getCampaignDetails(req, res) {
        try {
            const { id } = req.params;
            
            const campaign = await EmailCampaign.findByPk(id, {
                include: [
                    {
                        model: Customer,
                        as: 'creator',
                        attributes: ['first_name', 'last_name']
                    }
                ]
            });

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            // Récupérer les statistiques détaillées
            const recipients = await EmailCampaignRecipient.findAll({
                where: { campaign_id: id },
                include: [{
                    model: Customer,
                    attributes: ['first_name', 'last_name', 'email']
                }],
                order: [['sent_at', 'DESC']]
            });

            const stats = {
                sent: recipients.filter(r => r.status === 'sent').length,
                failed: recipients.filter(r => r.status === 'failed').length,
                opened: recipients.filter(r => r.opened_at).length,
                clicked: recipients.filter(r => r.clicked_at).length
            };

            res.json({
                success: true,
                campaign: {
                    ...campaign.toJSON(),
                    stats,
                    recipients: recipients.map(r => ({
                        id: r.id,
                        email: r.email,
                        status: r.status,
                        sentAt: r.sent_at,
                        openedAt: r.opened_at,
                        clickedAt: r.clicked_at,
                        customer: r.Customer ? `${r.Customer.first_name} ${r.Customer.last_name}` : 'Client supprimé'
                    }))
                }
            });

        } catch (error) {
            console.error('❌ Erreur détails campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des détails'
            });
        }
    },

    // Envoyer un email de test
    async sendTestEmail(req, res) {
        try {
            const { email, subject, content, template } = req.body;

            if (!email || !subject || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Email, sujet et contenu sont requis'
                });
            }

            await sendBulkEmailService.sendTestEmail(email, {
                subject: `[TEST] ${subject}`,
                content,
                template: template || 'elegant'
            });

            res.json({
                success: true,
                message: `Email de test envoyé à ${email}`
            });

        } catch (error) {
            console.error('❌ Erreur envoi test:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi du test'
            });
        }
    },

// ===== FONCTIONS UTILITAIRES =====

 generateTrackingId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
},

async sendCampaignEmails(campaignId, recipients, emailData) {
    try {
        console.log(`📧 Démarrage envoi campagne ${campaignId} vers ${recipients.length} destinataires`);
        
        let sentCount = 0;
        let failedCount = 0;
        
        // Envoyer par lots pour éviter la surcharge
        const batchSize = 10;
        
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            
            const emailPromises = batch.map(async (recipient) => {
                try {
                    const personalizedContent = emailData.content.replace(
                        /\[NOM_CLIENT\]/g, 
                        recipient.first_name || 'Client'
                    );

                    const result = await sendBulkEmailService.sendEmail(recipient.email, {
                        ...emailData,
                        content: personalizedContent
                    });
                    
                    if (result.success) {
                        await EmailCampaignRecipient.update(
                            { status: 'sent', sent_at: new Date() },
                            { where: { campaign_id: campaignId, customer_id: recipient.id } }
                        );
                        sentCount++;
                    } else {
                        await EmailCampaignRecipient.update(
                            { status: 'failed', error_message: result.error },
                            { where: { campaign_id: campaignId, customer_id: recipient.id } }
                        );
                        failedCount++;
                    }
                    
                } catch (error) {
                    console.error(`❌ Erreur envoi à ${recipient.email}:`, error);
                    await EmailCampaignRecipient.update(
                        { status: 'failed', error_message: error.message },
                        { where: { campaign_id: campaignId, customer_id: recipient.id } }
                    );
                    failedCount++;
                }
            });

            await Promise.all(emailPromises);
            
            // Pause entre les lots
            if (i + batchSize < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Mettre à jour la campagne
        await EmailCampaign.update({
            status: 'sent',
            sent_count: sentCount,
            failed_count: failedCount,
            sent_at: new Date()
        }, {
            where: { id: campaignId }
        });

        console.log(`✅ Campagne ${campaignId} terminée: ${sentCount} envoyés, ${failedCount} échecs`);
        
    } catch (error) {
        console.error(`❌ Erreur envoi campagne ${campaignId}:`, error);
        
        await EmailCampaign.update({
            status: 'failed'
        }, {
            where: { id: campaignId }
        });
    }},

     // ===================================
    // PAGE D'ADMINISTRATION PRINCIPALE
    // ===================================
    async showAdminPage(req, res) {
        try {
            console.log('📧 Affichage page administration email');

            // Récupérer les statistiques
            const stats = await this.getEmailStats();
            
            // Récupérer les campagnes récentes
            const recentCampaigns = await EmailCampaign.findAll({
                limit: 10,
                order: [['created_at', 'DESC']],
                include: [{
                    model: EmailTemplate,
                    as: 'template'
                }]
            });

            // Récupérer les templates
            const templates = await EmailTemplate.findAll({
                where: { is_active: true },
                order: [['name', 'ASC']]
            });

            res.render('admin/email-management', {
                title: 'Gestion des Emails',
                stats,
                campaigns: recentCampaigns,
                templates
            });

        } catch (error) {
            console.error('❌ Erreur affichage page admin email:', error);
            res.status(500).render('error', {
                message: 'Erreur lors du chargement de la page',
                error: error
            });
        }
    },

    // ===================================
    // STATISTIQUES EMAIL
    // ===================================
    async getEmailStats() {
        try {
            const [
                totalCampaigns,
                totalSent,
                totalDelivered,
                totalOpened,
                totalClicked,
                totalUnsubscribed
            ] = await Promise.all([
                EmailCampaign.count(),
                EmailCampaignRecipient.count({ where: { status: 'sent' } }),
                EmailCampaignRecipient.count({ where: { status: 'delivered' } }),
                EmailCampaignRecipient.count({ where: { status: 'opened' } }),
                EmailCampaignRecipient.count({ where: { status: 'clicked' } }),
                EmailUnsubscribe.count()
            ]);

            const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0';
            const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0.0';
            const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0.0';

            return {
                totalCampaigns,
                totalSent,
                totalDelivered,
                totalOpened,
                totalClicked,
                totalUnsubscribed,
                openRate,
                clickRate,
                deliveryRate
            };
        } catch (error) {
            console.error('❌ Erreur calcul stats email:', error);
            return {
                totalCampaigns: 0,
                totalSent: 0,
                totalDelivered: 0,
                totalOpened: 0,
                totalClicked: 0,
                totalUnsubscribed: 0,
                openRate: '0.0',
                clickRate: '0.0',
                deliveryRate: '0.0'
            };
        }
    },

    // ===================================
    // CRÉER UNE CAMPAGNE
    // ===================================
    async createCampaign(req, res) {
        try {
            console.log('📧 Création nouvelle campagne email');
            const { name, subject, content, template_id, recipients, scheduled_at } = req.body;

            // Validation
            if (!name || !subject || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Nom, sujet et contenu sont requis'
                });
            }

            // Créer la campagne
            const campaign = await EmailCampaign.create({
                name,
                subject,
                content,
                template_id: template_id || null,
                scheduled_at: scheduled_at || null,
                status: scheduled_at ? 'scheduled' : 'draft',
                sender_email: process.env.MAIL_USER,
                sender_name: 'CrystosJewel',
                reply_to: process.env.ADMIN_EMAIL || process.env.MAIL_USER
            });

            // Traiter les destinataires
            if (recipients && recipients.length > 0) {
                const recipientData = recipients.map(recipient => ({
                    campaign_id: campaign.id,
                    email: recipient.email,
                    customer_id: recipient.customer_id || null,
                    first_name: recipient.first_name || null,
                    last_name: recipient.last_name || null,
                    tracking_token: crypto.randomBytes(32).toString('hex')
                }));

                await EmailCampaignRecipient.bulkCreate(recipientData);
                
                // Mettre à jour le total des destinataires
                await campaign.update({ total_recipients: recipients.length });
            }

            console.log(`✅ Campagne créée: ${campaign.name} (ID: ${campaign.id})`);

            res.json({
                success: true,
                message: 'Campagne créée avec succès',
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    status: campaign.status
                }
            });

        } catch (error) {
            console.error('❌ Erreur création campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création de la campagne'
            });
        }
    },

    // ===================================
    // ENVOYER UNE CAMPAGNE
    // ===================================
    async sendCampaign(req, res) {
        try {
            const { id } = req.params;
            console.log(`📧 Envoi campagne ID: ${id}`);

            const campaign = await EmailCampaign.findByPk(id, {
                include: [{
                    model: EmailCampaignRecipient,
                    as: 'recipients',
                    where: { status: 'pending' }
                }]
            });

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            if (campaign.status === 'sent') {
                return res.status(400).json({
                    success: false,
                    message: 'Cette campagne a déjà été envoyée'
                });
            }

            // Marquer la campagne comme en cours d'envoi
            await campaign.update({ 
                status: 'sending',
                sent_at: new Date()
            });

            // Traitement asynchrone de l'envoi
            this.processCampaignSending(campaign);

            res.json({
                success: true,
                message: 'Envoi de la campagne en cours'
            });

        } catch (error) {
            console.error('❌ Erreur envoi campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de la campagne'
            });
        }
    },

    // ===================================
    // TRAITEMENT ASYNCHRONE DE L'ENVOI
    // ===================================
    async processCampaignSending(campaign) {
        try {
            console.log(`📧 Traitement envoi campagne: ${campaign.name}`);
            
            const recipients = campaign.recipients || [];
            let sentCount = 0;
            let failedCount = 0;

            for (const recipient of recipients) {
                try {
                    // Personnaliser le contenu
                    const personalizedContent = this.personalizeContent(campaign.content, {
                        first_name: recipient.first_name,
                        last_name: recipient.last_name,
                        email: recipient.email,
                        tracking_token: recipient.tracking_token
                    });

                    // Envoyer l'email
                    const result = await sendEmail({
                        to: recipient.email,
                        subject: campaign.subject,
                        html: personalizedContent,
                        from: `"${campaign.sender_name}" <${campaign.sender_email}>`,
                        replyTo: campaign.reply_to
                    });

                    if (result.success) {
                        await recipient.update({ 
                            status: 'sent',
                            sent_at: new Date()
                        });
                        sentCount++;
                    } else {
                        await recipient.update({ 
                            status: 'failed',
                            bounce_reason: result.error
                        });
                        failedCount++;
                    }

                } catch (error) {
                    console.error(`❌ Erreur envoi à ${recipient.email}:`, error);
                    await recipient.update({ 
                        status: 'failed',
                        bounce_reason: error.message
                    });
                    failedCount++;
                }

                // Délai entre les envois pour éviter la limitation
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Mettre à jour les statistiques de la campagne
            await campaign.update({
                status: 'sent',
                total_sent: sentCount,
                total_failed: failedCount
            });

            console.log(`✅ Campagne ${campaign.name} envoyée: ${sentCount} succès, ${failedCount} échecs`);

        } catch (error) {
            console.error('❌ Erreur traitement campagne:', error);
            await campaign.update({ status: 'failed' });
        }
    },

    // ===================================
    // PERSONNALISATION DU CONTENU
    // ===================================
    personalizeContent(content, data) {
        let personalizedContent = content;
        
        // Remplacer les variables
        personalizedContent = personalizedContent.replace(/\{\{first_name\}\}/g, data.first_name || '');
        personalizedContent = personalizedContent.replace(/\{\{last_name\}\}/g, data.last_name || '');
        personalizedContent = personalizedContent.replace(/\{\{email\}\}/g, data.email || '');
        
        // Ajouter les liens de tracking
        if (data.tracking_token) {
            const trackingPixel = `<img src="${process.env.BASE_URL}/api/email/track/open/${data.tracking_token}" width="1" height="1" style="display:none;">`;
            personalizedContent += trackingPixel;
            
            // Ajouter lien de désinscription
            const unsubscribeLink = `${process.env.BASE_URL}/unsubscribe?token=${data.tracking_token}&email=${encodeURIComponent(data.email)}`;
            personalizedContent = personalizedContent.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeLink);
        }
        
        return personalizedContent;
    },

    // ===================================
    // GESTION DES TEMPLATES
    // ===================================
    async getTemplates(req, res) {
        try {
            const templates = await EmailTemplate.findAll({
                where: { is_active: true },
                order: [['name', 'ASC']]
            });

            res.json({
                success: true,
                templates
            });

        } catch (error) {
            console.error('❌ Erreur récupération templates:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des templates'
            });
        }
    },

    async createTemplate(req, res) {
        try {
            const { name, description, subject, content, type, category } = req.body;

            const template = await EmailTemplate.create({
                name,
                description,
                subject,
                content,
                type: type || 'custom',
                category
            });

            console.log(`✅ Template créé: ${template.name}`);

            res.json({
                success: true,
                message: 'Template créé avec succès',
                template
            });

        } catch (error) {
            console.error('❌ Erreur création template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création du template'
            });
        }
    },

    // ===================================
    // TRACKING DES EMAILS
    // ===================================
    async trackOpen(req, res) {
        try {
            const { token } = req.params;
            
            const recipient = await EmailCampaignRecipient.findOne({
                where: { tracking_token: token }
            });

            if (recipient && recipient.status !== 'opened') {
                await recipient.update({
                    status: 'opened',
                    opened_at: new Date(),
                    open_count: recipient.open_count + 1
                });

                // Mettre à jour les stats de la campagne
                const campaign = await EmailCampaign.findByPk(recipient.campaign_id);
                if (campaign) {
                    await campaign.increment('total_opened');
                }

                console.log(`📧 Ouverture trackée pour token: ${token}`);
            }

            // Retourner un pixel transparent
            const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
            
            res.set({
                'Content-Type': 'image/png',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            res.send(pixel);

        } catch (error) {
            console.error('❌ Erreur tracking ouverture:', error);
            res.status(200).send(''); // Ne pas faire échouer l'affichage de l'email
        }
    },

    async trackClick(req, res) {
        try {
            const { token } = req.params;
            const { url } = req.query;
            
            const recipient = await EmailCampaignRecipient.findOne({
                where: { tracking_token: token }
            });

            if (recipient) {
                await recipient.update({
                    status: 'clicked',
                    clicked_at: new Date(),
                    click_count: recipient.click_count + 1
                });

                // Mettre à jour les stats de la campagne
                const campaign = await EmailCampaign.findByPk(recipient.campaign_id);
                if (campaign) {
                    await campaign.increment('total_clicked');
                }

                console.log(`📧 Clic tracké pour token: ${token}`);
            }

            // Rediriger vers l'URL cible
            res.redirect(url || '/');

        } catch (error) {
            console.error('❌ Erreur tracking clic:', error);
            res.redirect('/');
        }
    },

    // ===================================
    // DÉSINSCRIPTION
    // ===================================
    async showUnsubscribePage(req, res) {
        try {
            const { token, email } = req.query;
            
            res.render('unsubscribe', {
                title: 'Désinscription',
                email: email || '',
                token: token || ''
            });

        } catch (error) {
            console.error('❌ Erreur page désinscription:', error);
            res.status(500).render('error', {
                message: 'Erreur lors du chargement de la page',
                error: error
            });
        }
    },

    async processUnsubscribe(req, res) {
        try {
            const { email, token, reason, otherReason, feedback } = req.body;

            // Vérifier le token
            const recipient = await EmailCampaignRecipient.findOne({
                where: { tracking_token: token, email: email }
            });

            if (!recipient) {
                return res.status(400).json({
                    success: false,
                    message: 'Token invalide ou email non trouvé'
                });
            }

            // Enregistrer la désinscription
            await EmailUnsubscribe.create({
                email,
                token: crypto.randomBytes(32).toString('hex'),
                reason,
                other_reason: otherReason,
                feedback_allowed: feedback === true,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            console.log(`📧 Désinscription enregistrée pour: ${email}`);

            res.json({
                success: true,
                message: 'Désinscription effectuée avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur désinscription:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la désinscription'
            });
        }
    },

    async updatePreferences(req, res) {
        try {
            const { email, token, newsletter, promotions, newProducts, orderUpdates } = req.body;

            // Ici, vous pouvez implémenter la logique de mise à jour des préférences
            // selon votre système de gestion des abonnements

            console.log(`📧 Préférences mises à jour pour: ${email}`);

            res.json({
                success: true,
                message: 'Préférences mises à jour avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur mise à jour préférences:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour des préférences'
            });
        }
    },

    // ===================================
    // ANALYTICS ET RAPPORTS
    // ===================================
    async getAnalytics(req, res) {
        try {
            const { campaignId, dateFrom, dateTo } = req.query;
            
            let whereClause = {};
            if (campaignId) whereClause.campaign_id = campaignId;
            if (dateFrom && dateTo) {
                whereClause.sent_at = {
                    [Op.between]: [new Date(dateFrom), new Date(dateTo)]
                };
            }

            const analytics = await EmailCampaignRecipient.findAll({
                where: whereClause,
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['status']
            });

            res.json({
                success: true,
                analytics
            });

        } catch (error) {
            console.error('❌ Erreur analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des analytics'
            });
        }
    },

    async exportData(req, res) {
        try {
            const { type, campaignId } = req.query;
            
            if (type === 'campaigns') {
                const campaigns = await EmailCampaign.findAll({
                    include: [{
                        model: EmailTemplate,
                        as: 'template'
                    }]
                });

                // Convertir en CSV
                const csvData = this.convertToCSV(campaigns, [
                    'id', 'name', 'subject', 'status', 'total_recipients', 
                    'total_sent', 'total_opened', 'total_clicked', 'created_at'
                ]);

                res.set({
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="campaigns.csv"'
                });
                
                res.send(csvData);
            }

        } catch (error) {
            console.error('❌ Erreur export:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export'
            });
        }
    },

    // ===================================
    // UTILITAIRES
    // ===================================
    convertToCSV(data, fields) {
        const header = fields.join(',') + '\n';
        const rows = data.map(item => {
            return fields.map(field => {
                const value = item[field] || '';
                return `"${value.toString().replace(/"/g, '""')}"`;
            }).join(',');
        }).join('\n');
        
        return header + rows;
    }
}