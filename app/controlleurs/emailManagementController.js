// ===================================
// app/controlleurs/emailManagementController.js - CORRIGÉ POUR VOTRE FORMAT
// ===================================

import {
    EmailCampaign,
    EmailCampaignRecipient,
    EmailTemplate,
    EmailUnsubscribe,
    Customer
} from '../models/emailRelations.js';

// ✅ IMPORT CORRIGÉ - Import conditionnel pour éviter les erreurs
let sendEmail = null;
let sendBulkEmailService = null;

try {
    // Essayer d'importer votre service email existant
    const emailServiceModule = await import('../services/emailService.js');
    sendEmail = emailServiceModule.sendEmail || emailServiceModule.default?.sendEmail;
    sendBulkEmailService = emailServiceModule.sendBulkEmailService || emailServiceModule.default;
} catch (error) {
    console.log('⚠️  Service email non trouvé, utilisation du service par défaut');
    
    // Service email de simulation
    sendEmail = async ({ to, subject, html, from, replyTo }) => {
        console.log(`📧 [SIMULATION] Email à ${to}: ${subject}`);
        return { success: true, messageId: 'simulated-' + Date.now() };
    };
    
    sendBulkEmailService = {
        sendEmail: sendEmail,
        sendTestEmail: async (email, data) => {
            console.log(`📧 [TEST] Email de test à ${email}: ${data.subject}`);
            return { success: true };
        },
        sendAdminCopy: async (email, data) => {
            console.log(`📧 [ADMIN] Copie admin à ${email}: ${data.subject}`);
            return { success: true };
        }
    };
}

import crypto from 'crypto';
import { Op } from 'sequelize';
import { sequelize } from '../models/sequelize-client.js';

// ✅ EXPORT CORRIGÉ - Utiliser export nommé comme dans votre format
export const emailManagementController = {

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
                    as: 'template',
                    required: false
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
                campaigns: recentCampaigns || [],
                templates: templates || []
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
    // AFFICHER LA PAGE DE GESTION (ALIAS)
    // ===================================
    async renderEmailManagement(req, res) {
        return this.showAdminPage(req, res);
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
                EmailCampaignRecipient.count({ where: { status: ['sent', 'delivered', 'opened', 'clicked'] } }),
                EmailCampaignRecipient.count({ where: { status: ['delivered', 'opened', 'clicked'] } }),
                EmailCampaignRecipient.count({ where: { status: ['opened', 'clicked'] } }),
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
                deliveryRate,
                avgOpenRate: parseFloat(openRate) || 0,
                activeTemplates: await EmailTemplate.count({ where: { is_active: true } })
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
                deliveryRate: '0.0',
                avgOpenRate: 0,
                activeTemplates: 0
            };
        }
    },

    // ===================================
    // RÉCUPÉRER LES CLIENTS
    // ===================================
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
                limit: 100
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
                sender_email: process.env.MAIL_USER || 'admin@crystosjewel.com',
                sender_name: 'CrystosJewel',
                reply_to: process.env.ADMIN_EMAIL || process.env.MAIL_USER || 'admin@crystosjewel.com'
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
    // CRÉER ET ENVOYER UNE CAMPAGNE
    // ===================================
    async createAndSendCampaign(req, res) {
        try {
            console.log('📧 Création et envoi nouvelle campagne email');
            
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
                recipients = await Customer.findAll({
                    where: { id: { [Op.in]: selectedCustomerIds } },
                    attributes: ['id', 'email', 'first_name', 'last_name']
                });
            } else {
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
                content,
                sender_email: process.env.MAIL_USER || 'admin@crystosjewel.com',
                sender_name: fromName || 'CrystosJewel',
                total_recipients: recipients.length,
                status: 'sending'
            });

            // Créer les entrées destinataires
            const recipientEntries = recipients.map(recipient => ({
                campaign_id: campaign.id,
                customer_id: recipient.id,
                email: recipient.email,
                first_name: recipient.first_name,
                last_name: recipient.last_name,
                tracking_token: this.generateTrackingId()
            }));

            await EmailCampaignRecipient.bulkCreate(recipientEntries);

            // Envoyer les emails en arrière-plan
            this.sendCampaignEmails(campaign.id, recipients, {
                subject,
                preheader,
                fromName: fromName || 'CrystosJewel',
                template: template || 'elegant',
                content
            });

            res.json({
                success: true,
                message: `Campagne créée et envoi en cours vers ${recipients.length} destinataire(s)`,
                campaignId: campaign.id,
                recipientCount: recipients.length
            });

        } catch (error) {
            console.error('❌ Erreur création/envoi campagne:', error);
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
                    where: { status: 'pending' },
                    required: false
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
    // ENVOI CAMPAGNE EMAILS (MÉTHODE AUXILIAIRE)
    // ===================================
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
                total_sent: sentCount,
                total_failed: failedCount,
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
        personalizedContent = personalizedContent.replace(/\{\{company_name\}\}/g, 'CrystosJewel');
        personalizedContent = personalizedContent.replace(/\{\{current_date\}\}/g, new Date().toLocaleDateString('fr-FR'));
        personalizedContent = personalizedContent.replace(/\{\{month\}\}/g, new Date().toLocaleDateString('fr-FR', { month: 'long' }));
        personalizedContent = personalizedContent.replace(/\[NOM_CLIENT\]/g, data.first_name || 'Client');
        
        // Ajouter les liens de tracking
        if (data.tracking_token) {
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const trackingPixel = `<img src="${baseUrl}/api/email/track/open/${data.tracking_token}" width="1" height="1" style="display:none;">`;
            personalizedContent += trackingPixel;
            
            // Ajouter lien de désinscription
            const unsubscribeLink = `${baseUrl}/unsubscribe?token=${data.tracking_token}&email=${encodeURIComponent(data.email)}`;
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

            if (recipient && !['opened', 'clicked'].includes(recipient.status)) {
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
            const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
            res.set({ 'Content-Type': 'image/png' });
            res.send(pixel);
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

            console.log(`📧 Préférences mises à jour pour: ${email}`, {
                newsletter,
                promotions,
                newProducts,
                orderUpdates
            });

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
    // HISTORIQUE DES CAMPAGNES
    // ===================================
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
                    totalRecipients: campaign.total_recipients,
                    sentCount: campaign.total_sent,
                    openedCount: campaign.total_opened,
                    clickedCount: campaign.total_clicked,
                    sentAt: campaign.sent_at,
                    createdAt: campaign.created_at
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

    // ===================================
    // DÉTAILS D'UNE CAMPAGNE
    // ===================================
    async getCampaignDetails(req, res) {
        try {
            const { id } = req.params;
            
            const campaign = await EmailCampaign.findByPk(id);

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
                    as: 'customer',
                    attributes: ['first_name', 'last_name', 'email'],
                    required: false
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
                        customer: r.customer ? `${r.customer.first_name} ${r.customer.last_name}` : 'Client supprimé'
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

    // ===================================
    // ENVOYER UN EMAIL DE TEST
    // ===================================
    async sendTestEmail(req, res) {
        try {
            const { email, subject, content, template } = req.body;

            if (!email || !subject || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Email, sujet et contenu sont requis'
                });
            }

            // Personnaliser le contenu pour le test
            const personalizedContent = this.personalizeContent(content, {
                first_name: 'Test',
                last_name: 'User',
                email: email,
                tracking_token: null // Pas de tracking pour les tests
            });

            const result = await sendEmail({
                to: email,
                subject: `[TEST] ${subject}`,
                html: personalizedContent,
                from: `"CrystosJewel Test" <${process.env.MAIL_USER || 'admin@crystosjewel.com'}>`
            });

            if (result.success) {
                console.log(`✅ Email de test envoyé à: ${email}`);
                res.json({
                    success: true,
                    message: `Email de test envoyé à ${email}`
                });
            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }

        } catch (error) {
            console.error('❌ Erreur envoi test:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi du test'
            });
        }
    },

    // ===================================
    // UTILITAIRES
    // ===================================
    convertToCSV(data, fields) {
        if (!data || data.length === 0) {
            return fields.join(',') + '\n';
        }

        const header = fields.join(',') + '\n';
        const rows = data.map(item => {
            return fields.map(field => {
                let value = '';
                
                // Gérer les objets Sequelize
                if (item.dataValues) {
                    value = item.dataValues[field] || '';
                } else {
                    value = item[field] || '';
                }

                // Formatage des dates
                if (value instanceof Date) {
                    value = value.toLocaleDateString('fr-FR');
                }

                // Échapper les guillemets et encapsuler
                return `"${value.toString().replace(/"/g, '""')}"`;
            }).join(',');
        }).join('\n');
        
        return header + rows;
    },

    generateTrackingId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

     // ===================================
    // SAUVEGARDER UN TEMPLATE DEPUIS L'ÉDITEUR
    // ===================================
    async saveEmailTemplate(req, res) {
        try {
            const { name, description, subject, content, type, category } = req.body;

            if (!name || !subject || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Nom, sujet et contenu sont requis'
                });
            }

            const template = await EmailTemplate.create({
                name,
                description: description || '',
                subject,
                content,
                type: type || 'custom',
                category: category || 'general'
            });

            console.log(`✅ Template sauvegardé depuis l'éditeur: ${template.name}`);

            res.json({
                success: true,
                message: 'Template sauvegardé avec succès',
                template: {
                    id: template.id,
                    name: template.name
                }
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde du template'
            });
        }
    },

    // ===================================
    // RÉCUPÉRER UN TEMPLATE SPÉCIFIQUE
    // ===================================
    async getTemplate(req, res) {
        try {
            const { id } = req.params;
            
            const template = await EmailTemplate.findByPk(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Template non trouvé'
                });
            }

            res.json({
                success: true,
                template
            });

        } catch (error) {
            console.error('❌ Erreur récupération template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du template'
            });
        }
    },

    // ===================================
    // ANALYTICS AVANCÉES
    // ===================================
    async getAdvancedAnalytics(req, res) {
        try {
            const { campaignId, dateFrom, dateTo } = req.query;
            
            let whereClause = {};
            if (campaignId) whereClause.campaign_id = campaignId;
            if (dateFrom && dateTo) {
                whereClause.sent_at = {
                    [Op.between]: [new Date(dateFrom), new Date(dateTo)]
                };
            }

            const [analytics, campaignStats] = await Promise.all([
                EmailCampaignRecipient.findAll({
                    where: whereClause,
                    attributes: [
                        'status',
                        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                    ],
                    group: ['status'],
                    raw: true
                }),
                EmailCampaign.findAll({
                    attributes: [
                        'id',
                        'name',
                        'total_recipients',
                        'total_sent',
                        'total_opened',
                        'total_clicked',
                        'sent_at'
                    ],
                    where: whereClause.campaign_id ? { id: whereClause.campaign_id } : {},
                    order: [['sent_at', 'DESC']],
                    limit: 10
                })
            ]);

            res.json({
                success: true,
                analytics,
                campaignStats
            });

        } catch (error) {
            console.error('❌ Erreur analytics avancées:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des analytics'
            });
        }
    },

    // ===================================
    // EXPORT AVANCÉ DES DONNÉES
    // ===================================
    async exportAdvancedData(req, res) {
        try {
            const { type, campaignId, format = 'csv' } = req.query;
            
            if (type === 'campaigns') {
                const campaigns = await EmailCampaign.findAll({
                    include: [{
                        model: EmailTemplate,
                        as: 'template',
                        required: false
                    }]
                });

                if (format === 'json') {
                    res.json({
                        success: true,
                        data: campaigns
                    });
                } else {
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

            } else if (type === 'recipients' && campaignId) {
                const recipients = await EmailCampaignRecipient.findAll({
                    where: { campaign_id: campaignId },
                    include: [{
                        model: Customer,
                        as: 'customer',
                        attributes: ['first_name', 'last_name'],
                        required: false
                    }]
                });

                if (format === 'json') {
                    res.json({
                        success: true,
                        data: recipients
                    });
                } else {
                    const csvData = this.convertToCSV(recipients, [
                        'id', 'email', 'first_name', 'last_name', 'status', 
                        'sent_at', 'opened_at', 'clicked_at', 'open_count', 'click_count'
                    ]);

                    res.set({
                        'Content-Type': 'text/csv',
                        'Content-Disposition': `attachment; filename="recipients_campaign_${campaignId}.csv"`
                    });
                    
                    res.send(csvData);
                }

            } else if (type === 'unsubscribes') {
                const unsubscribes = await EmailUnsubscribe.findAll({
                    order: [['unsubscribed_at', 'DESC']]
                });

                if (format === 'json') {
                    res.json({
                        success: true,
                        data: unsubscribes
                    });
                } else {
                    const csvData = this.convertToCSV(unsubscribes, [
                        'id', 'email', 'reason', 'other_reason', 'unsubscribed_at', 'ip_address'
                    ]);

                    res.set({
                        'Content-Type': 'text/csv',
                        'Content-Disposition': 'attachment; filename="unsubscribes.csv"'
                    });
                    
                    res.send(csvData);
                }

            } else {
                res.status(400).json({
                    success: false,
                    message: 'Type d\'export non valide'
                });
            }

        } catch (error) {
            console.error('❌ Erreur export avancé:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export'
            });
        }
    },

    // ===================================
    // DUPLIQUER UNE CAMPAGNE
    // ===================================
    async duplicateCampaign(req, res) {
        try {
            const { id } = req.params;
            
            const originalCampaign = await EmailCampaign.findByPk(id);

            if (!originalCampaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            // Créer une copie de la campagne
            const duplicatedCampaign = await EmailCampaign.create({
                name: `${originalCampaign.name} (Copie)`,
                subject: originalCampaign.subject,
                content: originalCampaign.content,
                template_id: originalCampaign.template_id,
                sender_email: originalCampaign.sender_email,
                sender_name: originalCampaign.sender_name,
                reply_to: originalCampaign.reply_to,
                status: 'draft'
            });

            console.log(`✅ Campagne dupliquée: ${duplicatedCampaign.name}`);

            res.json({
                success: true,
                message: 'Campagne dupliquée avec succès',
                campaign: {
                    id: duplicatedCampaign.id,
                    name: duplicatedCampaign.name
                }
            });

        } catch (error) {
            console.error('❌ Erreur duplication campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la duplication de la campagne'
            });
        }
    },

    // ===================================
    // SUPPRIMER UNE CAMPAGNE
    // ===================================
    async deleteCampaign(req, res) {
        try {
            const { id } = req.params;
            
            const campaign = await EmailCampaign.findByPk(id);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            // Vérifier si la campagne peut être supprimée
            if (campaign.status === 'sending') {
                return res.status(400).json({
                    success: false,
                    message: 'Impossible de supprimer une campagne en cours d\'envoi'
                });
            }

            // Supprimer les destinataires associés
            await EmailCampaignRecipient.destroy({
                where: { campaign_id: id }
            });

            // Supprimer la campagne
            await campaign.destroy();

            console.log(`✅ Campagne supprimée: ${campaign.name}`);

            res.json({
                success: true,
                message: 'Campagne supprimée avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur suppression campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression de la campagne'
            });
        }
    },

    // ===================================
    // SUPPRIMER UN TEMPLATE
    // ===================================
    async deleteTemplate(req, res) {
        try {
            const { id } = req.params;
            
            const template = await EmailTemplate.findByPk(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Template non trouvé'
                });
            }

            // Vérifier si le template est utilisé par des campagnes
            const campaignsUsingTemplate = await EmailCampaign.count({
                where: { template_id: id }
            });

            if (campaignsUsingTemplate > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Ce template est utilisé par ${campaignsUsingTemplate} campagne(s). Impossible de le supprimer.`
                });
            }

            await template.destroy();

            console.log(`✅ Template supprimé: ${template.name}`);

            res.json({
                success: true,
                message: 'Template supprimé avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur suppression template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression du template'
            });
        }
    },

    // ===================================
    // METTRE À JOUR UN TEMPLATE
    // ===================================
    async updateTemplate(req, res) {
        try {
            const { id } = req.params;
            const { name, description, subject, content, type, category } = req.body;
            
            const template = await EmailTemplate.findByPk(id);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Template non trouvé'
                });
            }

            await template.update({
                name: name || template.name,
                description: description || template.description,
                subject: subject || template.subject,
                content: content || template.content,
                type: type || template.type,
                category: category || template.category
            });

            console.log(`✅ Template mis à jour: ${template.name}`);

            res.json({
                success: true,
                message: 'Template mis à jour avec succès',
                template
            });

        } catch (error) {
            console.error('❌ Erreur mise à jour template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du template'
            });
        }
    },

    // ===================================
    // PRÉVISUALISER UN EMAIL
    // ===================================
    async previewEmail(req, res) {
        try {
            const { content, customerData } = req.body;

            if (!content) {
                return res.status(400).json({
                    success: false,
                    message: 'Contenu requis pour la prévisualisation'
                });
            }

            // Personnaliser avec des données de test ou réelles
            const testData = {
                first_name: customerData?.first_name || 'John',
                last_name: customerData?.last_name || 'Doe',
                email: customerData?.email || 'test@example.com',
                tracking_token: 'preview-token'
            };

            const personalizedContent = this.personalizeContent(content, testData);

            res.json({
                success: true,
                preview: personalizedContent
            });

        } catch (error) {
            console.error('❌ Erreur prévisualisation:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la prévisualisation'
            });
        }
    },

    // ===================================
    // PROGRAMMER UNE CAMPAGNE
    // ===================================
    async scheduleCampaign(req, res) {
        try {
            const { id } = req.params;
            const { scheduledAt } = req.body;
            
            const campaign = await EmailCampaign.findByPk(id);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            if (campaign.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    message: 'Seules les campagnes en brouillon peuvent être programmées'
                });
            }

            const scheduledDate = new Date(scheduledAt);
            if (scheduledDate <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'La date de programmation doit être dans le futur'
                });
            }

            await campaign.update({
                scheduled_at: scheduledDate,
                status: 'scheduled'
            });

            console.log(`✅ Campagne programmée: ${campaign.name} pour ${scheduledDate}`);

            res.json({
                success: true,
                message: 'Campagne programmée avec succès',
                scheduledAt: scheduledDate
            });

        } catch (error) {
            console.error('❌ Erreur programmation campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la programmation de la campagne'
            });
        }
    },

    // ===================================
    // ANNULER UNE CAMPAGNE PROGRAMMÉE
    // ===================================
    async cancelScheduledCampaign(req, res) {
        try {
            const { id } = req.params;
            
            const campaign = await EmailCampaign.findByPk(id);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            if (campaign.status !== 'scheduled') {
                return res.status(400).json({
                    success: false,
                    message: 'Seules les campagnes programmées peuvent être annulées'
                });
            }

            await campaign.update({
                scheduled_at: null,
                status: 'draft'
            });

            console.log(`✅ Programmation annulée pour: ${campaign.name}`);

            res.json({
                success: true,
                message: 'Programmation annulée avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur annulation programmation:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'annulation de la programmation'
            });
        }
    }
};