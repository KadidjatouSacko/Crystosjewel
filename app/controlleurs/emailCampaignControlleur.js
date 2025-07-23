// app/controlleurs/emailCampaignControlleur.js
import { Campaign } from '../models/campaignModel.js';
import { EmailLog } from '../models/emailLogModel.js';
import { CampaignStats } from '../models/campaignStatsModel.js';
import { Customer } from '../models/customerModel.js';
import { Op, fn, col } from 'sequelize';
import nodemailer from 'nodemailer';

export const emailCampaignControlleur = {

    // Dashboard email marketing
   async dashboard(req, res) {
    try {
        const recentCampaigns = await Campaign.findAll({
            limit: 5,
            order: [['created_at', 'DESC']],
            include: [{ 
                model: CampaignStats, 
                as: 'Stats',
                required: false
            }]
        });

        const totalCampaigns = await Campaign.count();
        const activeCampaigns = await Campaign.count({ 
            where: { status: { [Op.in]: ['sending', 'scheduled'] } }
        });
        const totalSubscribers = await Customer.count({ 
            where: { marketing_opt_in: true }
        });

        // Stats des 30 derniers jours
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentActivity = await EmailLog.findAll({
            where: {
                sent_at: { [Op.gte]: thirtyDaysAgo }
            },
            attributes: [
                [fn('DATE', col('sent_at')), 'date'],
                [fn('COUNT', col('*')), 'count'],
                'status'
            ],
            group: [fn('DATE', col('sent_at')), 'status'],
            order: [[fn('DATE', col('sent_at')), 'ASC']],
            raw: true
        });

        // AJOUTER LES SEGMENTS ICI pour éviter l'erreur
        const segments = {
            all_subscribers: totalSubscribers,
            recent_buyers: await Customer.count({
                where: {
                    marketing_opt_in: true,
                    last_order_date: {
                        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 jours
                    }
                }
            }),
            new_customers: await Customer.count({
                where: {
                    marketing_opt_in: true,
                    created_at: {
                        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 jours
                    }
                }
            }),
            high_value: await Customer.count({
                where: {
                    marketing_opt_in: true,
                    total_spent: { [Op.gte]: 500 }
                }
            })
        };

        res.render('admin/dashboard', {
            recentCampaigns,
            stats: {
                totalCampaigns,
                activeCampaigns,
                totalSubscribers
            },
            recentActivity,
            segments, // AJOUTER cette ligne
            title: 'Email Marketing - Dashboard'
        });
    } catch (error) {
        console.error('❌ Erreur dashboard email:', error);
        res.status(500).render('error', { error });
    }
},
    // Créer une nouvelle campagne
    async createCampaign(req, res) {
        try {
            // Récupérer les segments d'audience disponibles
            const totalSubscribers = await Customer.count({ 
                where: { marketing_opt_in: true }
            });
            
            const recentBuyers = await Customer.count({
                where: {
                    marketing_opt_in: true,
                    last_order_date: {
                        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 jours
                    }
                }
            });

            const segments = {
                all_subscribers: totalSubscribers,
                recent_buyers: recentBuyers,
                new_customers: await Customer.count({
                    where: {
                        marketing_opt_in: true,
                        created_at: {
                            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 jours
                        }
                    }
                })
            };

            res.render('admin/email-marketing/campaign-create', {
                segments,
                title: 'Créer une campagne'
            });
        } catch (error) {
            console.error('❌ Erreur création campagne:', error);
            res.status(500).render('error', { error });
        }
    },

    // Sauvegarder une campagne
    async saveCampaign(req, res) {
        try {
            const {
                name, subject, content, content_type, sender_name, sender_email,
                recipient_filters, scheduled_at, bcc_email, template_data, status
            } = req.body;

            console.log('💾 Sauvegarde campagne:', { name, status });

            const campaign = await Campaign.create({
                name,
                subject,
                content,
                content_type: content_type || 'html',
                sender_name,
                sender_email,
                recipient_filters: typeof recipient_filters === 'string' 
                    ? JSON.parse(recipient_filters) 
                    : recipient_filters || {},
                scheduled_at: scheduled_at || null,
                bcc_email,
                template_data: typeof template_data === 'string' 
                    ? JSON.parse(template_data) 
                    : template_data || {},
                status: status || 'draft'
            });

            // Si c'est programmé, planifier l'envoi
            if (status === 'scheduled' && scheduled_at) {
                console.log('📅 Campagne programmée pour:', scheduled_at);
                // TODO: Implémenter le système de programmation
            }

            // Si c'est un envoi immédiat
            if (status === 'sending') {
                await this.sendCampaignNow(campaign.id);
            }

            res.json({ 
                success: true, 
                campaignId: campaign.id,
                message: 'Campagne sauvegardée avec succès'
            });
        } catch (error) {
            console.error('❌ Erreur sauvegarde campagne:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    },

    // Éditer une campagne
    async editCampaign(req, res) {
        try {
            const { id } = req.params;
            const campaign = await Campaign.findByPk(id);
            
            if (!campaign) {
                return res.status(404).render('error', { 
                    error: 'Campagne non trouvée' 
                });
            }

            // Ne pas permettre l'édition des campagnes envoyées
            if (campaign.status === 'sent') {
                return res.redirect('/admin/email-marketing/campaigns?error=cannot_edit_sent');
            }

            res.render('admin/email-marketing/campaign-edit', {
                campaign,
                title: `Éditer: ${campaign.name}`
            });
        } catch (error) {
            console.error('❌ Erreur édition campagne:', error);
            res.status(500).render('error', { error });
        }
    },

    // Mettre à jour les statistiques de campagne
    async updateCampaignStats(campaignId) {
        try {
            const logs = await EmailLog.findAll({
                where: { campaign_id: campaignId },
                attributes: [
                    'status',
                    [fn('COUNT', col('*')), 'count']
                ],
                group: ['status'],
                raw: true
            });

            const stats = logs.reduce((acc, log) => {
                const status = log.status.charAt(0).toUpperCase() + log.status.slice(1);
                acc[`emails${status}`] = parseInt(log.count);
                return acc;
            }, {
                emailsSent: 0,
                emailsDelivered: 0,
                emailsOpened: 0,
                emailsClicked: 0,
                emailsBounced: 0,
                emailsFailed: 0
            });

            // Calculer les taux
            const totalSent = stats.emailsSent || 1;
            stats.open_rate = ((stats.emailsOpened / totalSent) * 100).toFixed(2);
            stats.click_rate = ((stats.emailsClicked / totalSent) * 100).toFixed(2);
            stats.bounce_rate = ((stats.emailsBounced / totalSent) * 100).toFixed(2);

            // Mettre à jour les stats
            await CampaignStats.update(stats, {
                where: { campaign_id: campaignId }
            });

            return stats;
        } catch (error) {
            console.error('❌ Erreur mise à jour stats:', error);
            throw error;
        }
    },

    // Exporter les données de campagne
    async exportCampaign(req, res) {
        try {
            const { id } = req.params;
            const { format = 'csv' } = req.query;

            const campaign = await Campaign.findByPk(id, {
                include: [
                    {
                        model: EmailLog,
                        as: 'EmailLogs',
                        include: [{ 
                            model: Customer, 
                            as: 'Customer',
                            attributes: ['email', 'first_name', 'last_name']
                        }]
                    }
                ]
            });

            if (!campaign) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Campagne non trouvée' 
                });
            }

            const data = campaign.EmailLogs.map(log => ({
                'Email': log.Customer.email,
                'Prénom': log.Customer.first_name || '',
                'Nom': log.Customer.last_name || '',
                'Statut': log.status,
                'Envoyé le': log.sent_at,
                'Ouvert le': log.opened_at || '',
                'Cliqué le': log.clicked_at || '',
                'Erreur': log.error_message || ''
            }));

            if (format === 'csv') {
                const csv = this.convertToCSV(data);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="campaign_${campaign.name}_${Date.now()}.csv"`);
                res.send(csv);
            } else {
                res.json({ success: true, data });
            }
        } catch (error) {
            console.error('❌ Erreur export campagne:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    },

    // Convertir en CSV
    convertToCSV(data) {
        if (!data.length) return '';
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => `"${row[header] || ''}"`).join(',')
            )
        ].join('\n');
        
        return csvContent;
    },

     // Lister toutes les campagnes avec pagination et filtres
    async listCampaigns(req, res) {
        try {
            const { page = 1, status, search } = req.query;
            const limit = 10;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (status) whereClause.status = status;
            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { subject: { [Op.iLike]: `%${search}%` } }
                ];
            }

            const { rows: campaigns, count } = await Campaign.findAndCountAll({
                where: whereClause,
                include: [{ 
                    model: CampaignStats, 
                    as: 'Stats',
                    required: false
                }],
                order: [['created_at', 'DESC']],
                limit,
                offset
            });

            const totalPages = Math.ceil(count / limit);

            res.render('admin/email-marketing/campaigns-list', {
                campaigns,
                currentPage: parseInt(page),
                totalPages,
                totalCampaigns: count,
                filters: { status, search },
                title: 'Gestion des campagnes',
                success: req.query.success,
                error: req.query.error
            });
        } catch (error) {
            console.error('❌ Erreur liste campagnes:', error);
            res.status(500).render('error', { error });
        }
    },

    // Mettre à jour une campagne existante
    async updateCampaign(req, res) {
        try {
            const { id } = req.params;
            const campaign = await Campaign.findByPk(id);
            
            if (!campaign) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Campagne non trouvée' 
                });
            }

            // Ne pas permettre la modification des campagnes envoyées
            if (campaign.status === 'sent') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Impossible de modifier une campagne envoyée' 
                });
            }

            const {
                name, subject, content, content_type, sender_name, sender_email,
                recipient_filters, scheduled_at, bcc_email, template_data, status
            } = req.body;

            console.log('🔄 Mise à jour campagne:', { id, name, status });

            await campaign.update({
                name,
                subject,
                content,
                content_type,
                sender_name,
                sender_email,
                recipient_filters: typeof recipient_filters === 'string' 
                    ? JSON.parse(recipient_filters) 
                    : recipient_filters,
                scheduled_at,
                bcc_email,
                template_data: typeof template_data === 'string' 
                    ? JSON.parse(template_data) 
                    : template_data,
                status,
                updated_at: new Date()
            });

            // Si le statut change vers "sending", envoyer immédiatement
            if (status === 'sending' && campaign.status !== 'sending') {
                await this.sendCampaignNow(campaign.id);
            }

            res.json({ 
                success: true, 
                message: 'Campagne mise à jour avec succès' 
            });
        } catch (error) {
            console.error('❌ Erreur mise à jour campagne:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    },

    // Dupliquer une campagne existante
    async duplicateCampaign(req, res) {
        try {
            const { id } = req.params;
            const originalCampaign = await Campaign.findByPk(id);
            
            if (!originalCampaign) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Campagne non trouvée' 
                });
            }

            console.log('📋 Duplication campagne:', originalCampaign.name);

            const duplicatedCampaign = await Campaign.create({
                name: `${originalCampaign.name} (Copie)`,
                subject: originalCampaign.subject,
                content: originalCampaign.content,
                content_type: originalCampaign.content_type,
                sender_name: originalCampaign.sender_name,
                sender_email: originalCampaign.sender_email,
                recipient_filters: originalCampaign.recipient_filters,
                template_data: originalCampaign.template_data,
                bcc_email: originalCampaign.bcc_email,
                status: 'draft'
            });

            res.json({ 
                success: true, 
                campaignId: duplicatedCampaign.id,
                message: 'Campagne dupliquée avec succès'
            });
        } catch (error) {
            console.error('❌ Erreur duplication campagne:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    },

    // Supprimer une campagne
    async deleteCampaign(req, res) {
        try {
            const { id } = req.params;
            const campaign = await Campaign.findByPk(id);
            
            if (!campaign) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Campagne non trouvée' 
                });
            }

            // Ne pas supprimer si en cours d'envoi
            if (campaign.status === 'sending') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Impossible de supprimer une campagne en cours d\'envoi' 
                });
            }

            console.log('🗑️ Suppression campagne:', campaign.name);

            // Supprimer les logs et stats associés (CASCADE devrait le faire automatiquement)
            await EmailLog.destroy({ where: { campaign_id: id } });
            await CampaignStats.destroy({ where: { campaign_id: id } });
            await campaign.destroy();

            res.json({ 
                success: true,
                message: 'Campagne supprimée avec succès'
            });
        } catch (error) {
            console.error('❌ Erreur suppression campagne:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    },

    // Afficher les statistiques détaillées d'une campagne
    async campaignStats(req, res) {
        try {
            const { id } = req.params;
            const campaign = await Campaign.findByPk(id, {
                include: [
                    { 
                        model: CampaignStats, 
                        as: 'Stats'
                    },
                    {
                        model: EmailLog,
                        as: 'EmailLogs',
                        include: [{ 
                            model: Customer, 
                            as: 'Customer',
                            attributes: ['email', 'first_name', 'last_name']
                        }],
                        order: [['sent_at', 'DESC']],
                        limit: 100 // Limiter pour la performance
                    }
                ]
            });

            if (!campaign) {
                return res.status(404).render('error', { 
                    error: 'Campagne non trouvée' 
                });
            }

            // Données pour les graphiques par jour
            const dailyStats = await EmailLog.findAll({
                where: { campaign_id: id },
                attributes: [
                    [fn('DATE', col('sent_at')), 'date'],
                    [fn('COUNT', col('*')), 'count'],
                    'status'
                ],
                group: [fn('DATE', col('sent_at')), 'status'],
                order: [[fn('DATE', col('sent_at')), 'ASC']],
                raw: true
            });

            // Statistiques par statut
            const statusStats = await EmailLog.findAll({
                where: { campaign_id: id },
                attributes: [
                    'status',
                    [fn('COUNT', col('*')), 'count']
                ],
                group: ['status'],
                raw: true
            });

            console.log('📊 Affichage stats campagne:', campaign.name);

            res.render('admin/email-marketing/campaign-stats', {
                campaign,
                dailyStats,
                statusStats,
                title: `Statistiques: ${campaign.name}`
            });
        } catch (error) {
            console.error('❌ Erreur stats campagne:', error);
            res.status(500).render('error', { error });
        }
    },

    // Tracking des ouvertures d'email (pixel invisible)
    async trackOpen(req, res) {
        try {
            const { campaignId, customerId } = req.params;
            
            console.log('👁️ Tracking ouverture:', { campaignId, customerId });

            // Mettre à jour le log d'email seulement s'il n'a pas déjà été ouvert
            const [updatedCount] = await EmailLog.update(
                { 
                    status: 'opened',
                    opened_at: new Date()
                },
                { 
                    where: { 
                        campaign_id: campaignId, 
                        customer_id: customerId,
                        opened_at: null // Seulement si pas déjà ouvert
                    }
                }
            );

            // Mettre à jour les stats de la campagne si un email a été marqué comme ouvert
            if (updatedCount > 0) {
                await this.updateCampaignStats(campaignId);
            }

            // Retourner un pixel transparent 1x1
            const pixel = Buffer.from(
                'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                'base64'
            );
            
            res.writeHead(200, {
                'Content-Type': 'image/gif',
                'Content-Length': pixel.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(pixel);
        } catch (error) {
            console.error('❌ Erreur tracking ouverture:', error);
            // Toujours retourner un pixel même en cas d'erreur
            const pixel = Buffer.from(
                'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                'base64'
            );
            res.writeHead(200, {
                'Content-Type': 'image/gif',
                'Content-Length': pixel.length
            });
            res.end(pixel);
        }
    },

    // Tracking des clics sur les liens
    async trackClick(req, res) {
        try {
            const { campaignId, customerId } = req.params;
            const { url } = req.query;

            console.log('🖱️ Tracking clic:', { campaignId, customerId, url });

            if (!url) {
                return res.redirect('/');
            }

            // Mettre à jour le log d'email seulement s'il n'a pas déjà été cliqué
            const [updatedCount] = await EmailLog.update(
                { 
                    status: 'clicked',
                    clicked_at: new Date()
                },
                { 
                    where: { 
                        campaign_id: campaignId, 
                        customer_id: customerId,
                        clicked_at: null // Seulement si pas déjà cliqué
                    }
                }
            );

            // Mettre à jour les stats de la campagne si un email a été marqué comme cliqué
            if (updatedCount > 0) {
                await this.updateCampaignStats(campaignId);
            }

            // Rediriger vers l'URL originale
            const decodedUrl = decodeURIComponent(url);
            res.redirect(decodedUrl);
        } catch (error) {
            console.error('❌ Erreur tracking clic:', error);
            // Rediriger vers l'accueil en cas d'erreur
            res.redirect('/');
        }
    },

// =============================================
// CONFIGURATION GMAIL POUR NODEMAILER
// =============================================

    // Configuration spéciale pour Gmail
    createGmailTransporter() {
        return nodemailer.createTransporter({
            service: 'gmail', // Utilise le service Gmail pré-configuré
            auth: {
                user: process.env.GMAIL_USER, // Votre adresse Gmail
                pass: process.env.GMAIL_APP_PASSWORD // Mot de passe d'application Gmail
            },
            // Options spécifiques pour Gmail
            pool: true, // Utilise un pool de connexions
            maxConnections: 5, // Maximum 5 connexions simultanées
            maxMessages: 100, // Maximum 100 emails par connexion
            rateDelta: 1000, // Attendre 1 seconde entre les emails
            rateLimit: 5 // Maximum 5 emails par seconde
        });
    },

    // Version modifiée de sendCampaignNow pour Gmail
    async sendCampaignNow(campaignId) {
        try {
            const campaign = await Campaign.findByPk(campaignId);
            if (!campaign) throw new Error('Campagne non trouvée');

            console.log('📧 Début envoi campagne Gmail:', campaign.name);

            // Mettre à jour le statut
            await campaign.update({ status: 'sending' });

            // Obtenir les destinataires selon les filtres
            const recipients = await this.getFilteredRecipients(campaign.recipient_filters);
            console.log(`👥 ${recipients.length} destinataires trouvés`);

            if (recipients.length === 0) {
                await campaign.update({ status: 'failed' });
                throw new Error('Aucun destinataire trouvé');
            }

            // Créer les stats de campagne
            const stats = await CampaignStats.create({
                campaign_id: campaign.id,
                total_recipients: recipients.length
            });

            // Configuration Gmail
            const transporter = this.createGmailTransporter();

            // Vérifier la connexion Gmail
            await transporter.verify();
            console.log('✅ Connexion Gmail établie');

            // Envoyer les emails par lots pour respecter les limites Gmail
            let sent = 0, failed = 0;
            const batchSize = 10; // Envoyer par lots de 10
            
            for (let i = 0; i < recipients.length; i += batchSize) {
                const batch = recipients.slice(i, i + batchSize);
                
                console.log(`📦 Envoi du lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(recipients.length/batchSize)}`);
                
                // Envoyer chaque email du lot
                for (const recipient of batch) {
                    try {
                        // Personnaliser le contenu
                        const personalizedContent = this.personalizeContent(
                            campaign.content, 
                            recipient, 
                            campaign.template_data
                        );

                        // Ajouter le tracking
                        const contentWithTracking = this.addEmailTracking(
                            personalizedContent, 
                            campaign.id, 
                            recipient.id
                        );

                        const mailOptions = {
                            from: `${campaign.sender_name} <${campaign.sender_email}>`,
                            to: recipient.email,
                            subject: this.personalizeContent(campaign.subject, recipient, campaign.template_data),
                            html: campaign.content_type === 'html' ? contentWithTracking : undefined,
                            text: campaign.content_type === 'text' ? personalizedContent : undefined,
                            bcc: campaign.bcc_email || process.env.ADMIN_EMAIL,
                            headers: {
                                'X-Campaign-ID': campaign.id,
                                'X-Recipient-ID': recipient.id,
                                'List-Unsubscribe': `<${process.env.APP_URL}/unsubscribe/${recipient.id}>`,
                                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
                            }
                        };

                        const info = await transporter.sendMail(mailOptions);
                        sent++;

                        console.log(`✅ Email envoyé à ${recipient.email} (${info.messageId})`);

                        // Logger l'envoi
                        await EmailLog.create({
                            campaign_id: campaign.id,
                            customer_id: recipient.id,
                            status: 'sent',
                            sent_at: new Date(),
                            tracking_data: { messageId: info.messageId }
                        });

                    } catch (error) {
                        failed++;
                        console.error(`❌ Erreur envoi à ${recipient.email}:`, error.message);

                        // Logger l'erreur
                        await EmailLog.create({
                            campaign_id: campaign.id,
                            customer_id: recipient.id,
                            status: 'failed',
                            error_message: error.message,
                            sent_at: new Date()
                        });
                    }
                }

                // Pause entre les lots pour respecter les limites Gmail (500 emails/jour pour comptes gratuits)
                if (i + batchSize < recipients.length) {
                    console.log('⏳ Pause entre les lots...');
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 secondes de pause
                }
            }

            // Fermer le transporteur
            transporter.close();

            // Mettre à jour les stats
            await stats.update({
                emails_sent: sent,
                emails_failed: failed
            });

            // Mettre à jour le statut de la campagne
            await campaign.update({ 
                status: sent > 0 ? 'sent' : 'failed',
                sent_at: new Date()
            });

            console.log(`✅ Campagne terminée: ${sent} succès, ${failed} échecs`);
            return { success: true, sent, failed };

        } catch (error) {
            console.error('❌ Erreur envoi campagne Gmail:', error);
            await Campaign.update(
                { status: 'failed' },
                { where: { id: campaignId } }
            );
            throw error;
        }
    },

    // Ajouter le tracking des ouvertures et clics dans le contenu
    addEmailTracking(content, campaignId, customerId) {
        let trackedContent = content;

        // Ajouter le pixel de tracking d'ouverture
        const trackingPixel = `<img src="${process.env.APP_URL}/email/track/open/${campaignId}/${customerId}" width="1" height="1" style="display:none;" alt="" />`;
        
        if (trackedContent.includes('</body>')) {
            trackedContent = trackedContent.replace('</body>', `${trackingPixel}</body>`);
        } else {
            trackedContent += trackingPixel;
        }

        // Ajouter le tracking des clics sur tous les liens
        const linkRegex = /<a([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;
        trackedContent = trackedContent.replace(linkRegex, (match, before, url, after) => {
            // Ne pas tracker les liens de désabonnement ou de tracking
            if (url.includes('unsubscribe') || url.includes('/email/track/')) {
                return match;
            }
            
            const trackingUrl = `${process.env.APP_URL}/email/track/click/${campaignId}/${customerId}?url=${encodeURIComponent(url)}`;
            return `<a${before}href="${trackingUrl}"${after}>`;
        });

        return trackedContent;
    }

};