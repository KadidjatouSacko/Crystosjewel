import { EmailCampaign } from '../models/emailCampaignModel.js';
import { EmailCampaignRecipient } from '../models/emailCampaignRecipientModel.js';
import { EmailTemplate } from '../models/emailTemplateModel.js';
import { Customer } from '../models/customerModel.js';
import { sendBulkEmailService } from '../services/emailService.js';
import { Op } from 'sequelize';

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
    }
};

// ===== FONCTIONS UTILITAIRES =====

function generateTrackingId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function sendCampaignEmails(campaignId, recipients, emailData) {
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
    }
}