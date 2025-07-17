import { sequelize } from '../models/sequelize-client.js';
import { QueryTypes } from 'sequelize';

export const emailManagementControlleur = {

    // Dashboard Email Management
    async dashboard(req, res) {
        try {
            console.log('📧 Chargement dashboard email management');

            // Stats principales utilisant vos tables existantes
            const emailStats = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_campaigns,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_campaigns,
                    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_campaigns,
                    COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_campaigns
                FROM email_campaigns
            `, { type: QueryTypes.SELECT });

            // Stats des recipients
            const recipientStats = await sequelize.query(`
                SELECT 
                    COUNT(DISTINCT email) as total_recipients,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as emails_sent,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as emails_delivered,
                    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as emails_opened,
                    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as emails_clicked
                FROM email_campaign_recipients
                WHERE created_at >= NOW() - INTERVAL '30 days'
            `, { type: QueryTypes.SELECT });

            // Campagnes récentes
            const recentCampaigns = await sequelize.query(`
                SELECT 
                    ec.*,
                    COUNT(ecr.id) as total_recipients,
                    COUNT(CASE WHEN ecr.status = 'sent' THEN 1 END) as sent_count,
                    COUNT(CASE WHEN ecr.opened_at IS NOT NULL THEN 1 END) as opened_count
                FROM email_campaigns ec
                LEFT JOIN email_campaign_recipients ecr ON ec.id = ecr.campaign_id
                GROUP BY ec.id
                ORDER BY ec.created_at DESC
                LIMIT 10
            `, { type: QueryTypes.SELECT });

            // Données pour graphique (30 derniers jours)
            const chartData = await sequelize.query(`
                SELECT 
                    DATE(sent_at) as date,
                    COUNT(*) as emails_sent,
                    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as emails_opened
                FROM email_campaign_recipients
                WHERE sent_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(sent_at)
                ORDER BY date
            `, { type: QueryTypes.SELECT });

            // Stats des abonnés
            const subscriberStats = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_customers,
                    COUNT(CASE WHEN marketing_opt_in = true THEN 1 END) as opted_in,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week
                FROM customer
            `, { type: QueryTypes.SELECT });

            res.render('admin/email-management/dashboard', {
                title: 'Email Marketing - Dashboard',
                emailStats: emailStats[0],
                recipientStats: recipientStats[0],
                subscriberStats: subscriberStats[0],
                recentCampaigns,
                chartData
            });

        } catch (error) {
            console.error('❌ Erreur dashboard email management:', error);
            res.status(500).render('error', { 
                error: 'Erreur lors du chargement du dashboard email'
            });
        }
    },

    // Lister toutes les campagnes
    async listCampaigns(req, res) {
        try {
            const { page = 1, status, search } = req.query;
            const limit = 15;
            const offset = (page - 1) * limit;

            let whereClause = '';
            let params = [];

            if (status) {
                whereClause += ' WHERE ec.status = $' + (params.length + 1);
                params.push(status);
            }

            if (search) {
                const searchCondition = status ? ' AND ' : ' WHERE ';
                whereClause += searchCondition + '(ec.name ILIKE $' + (params.length + 1) + ' OR ec.subject ILIKE $' + (params.length + 2) + ')';
                params.push(`%${search}%`, `%${search}%`);
            }

            const campaigns = await sequelize.query(`
                SELECT 
                    ec.*,
                    COUNT(ecr.id) as total_recipients,
                    COUNT(CASE WHEN ecr.status = 'sent' THEN 1 END) as sent_count,
                    COUNT(CASE WHEN ecr.opened_at IS NOT NULL THEN 1 END) as opened_count,
                    COUNT(CASE WHEN ecr.clicked_at IS NOT NULL THEN 1 END) as clicked_count,
                    ROUND(
                        CASE 
                            WHEN COUNT(CASE WHEN ecr.status = 'sent' THEN 1 END) > 0 
                            THEN (COUNT(CASE WHEN ecr.opened_at IS NOT NULL THEN 1 END)::float / COUNT(CASE WHEN ecr.status = 'sent' THEN 1 END)::float) * 100
                            ELSE 0 
                        END, 2
                    ) as open_rate
                FROM email_campaigns ec
                LEFT JOIN email_campaign_recipients ecr ON ec.id = ecr.campaign_id
                ${whereClause}
                GROUP BY ec.id
                ORDER BY ec.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `, { 
                bind: [...params, limit, offset],
                type: QueryTypes.SELECT 
            });

            const totalCampaigns = await sequelize.query(`
                SELECT COUNT(*) as count FROM email_campaigns ec ${whereClause}
            `, { 
                bind: params,
                type: QueryTypes.SELECT 
            });

            const totalPages = Math.ceil(totalCampaigns[0].count / limit);

            res.render('admin/email-management/campaigns-list', {
                title: 'Gestion des Campagnes Email',
                campaigns,
                currentPage: parseInt(page),
                totalPages,
                filters: { status, search }
            });

        } catch (error) {
            console.error('❌ Erreur liste campagnes:', error);
            res.status(500).render('error', { 
                error: 'Erreur lors du chargement des campagnes'
            });
        }
    },

    // Créer une nouvelle campagne
    async createCampaign(req, res) {
        try {
            // Templates disponibles
            const templates = await sequelize.query(`
                SELECT * FROM email_templates 
                WHERE is_active = true 
                ORDER BY template_name
            `, { type: QueryTypes.SELECT });

            // Stats des segments d'audience
            const audienceStats = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_opted_in,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_customers,
                    COUNT(CASE WHEN last_order_date >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_buyers,
                    COUNT(CASE WHEN total_spent >= 500 THEN 1 END) as premium_customers
                FROM customer 
                WHERE marketing_opt_in = true
            `, { type: QueryTypes.SELECT });

            res.render('admin/email-management/campaign-create', {
                title: 'Créer une Campagne Email',
                templates,
                audienceStats: audienceStats[0]
            });

        } catch (error) {
            console.error('❌ Erreur création campagne:', error);
            res.status(500).render('error', { 
                error: 'Erreur lors du chargement de la création de campagne'
            });
        }
    },

    // Sauvegarder une campagne
    async saveCampaign(req, res) {
        try {
            const {
                name, subject, content, template_id, sender_name, sender_email,
                reply_to, audience_segment, scheduled_at, status = 'draft'
            } = req.body;

            console.log('💾 Sauvegarde campagne:', { name, status, audience_segment });

            // Créer la campagne
            const campaign = await sequelize.query(`
                INSERT INTO email_campaigns (
                    name, subject, content, template_id, sender_name, sender_email,
                    reply_to, status, scheduled_at, tracking_enabled, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                RETURNING *
            `, {
                bind: [name, subject, content, template_id || null, sender_name, sender_email, 
                       reply_to || sender_email, status, scheduled_at || null, true],
                type: QueryTypes.SELECT
            });

            const campaignId = campaign[0].id;

            // Ajouter les destinataires selon le segment
            await this.addRecipientsToCampaign(campaignId, audience_segment);

            // Si envoi immédiat, déclencher l'envoi
            if (status === 'sending') {
                // Utiliser votre système d'email existant
                setTimeout(() => this.sendCampaign(campaignId), 1000);
            }

            res.json({
                success: true,
                campaignId,
                message: 'Campagne créée avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde campagne:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    // Ajouter des destinataires à une campagne
    async addRecipientsToCamera(campaignId, segment) {
        let query = '';
        let params = [campaignId];

        switch (segment) {
            case 'all':
                query = `
                    INSERT INTO email_campaign_recipients (
                        campaign_id, email, customer_id, first_name, last_name, 
                        status, tracking_token, created_at, updated_at
                    )
                    SELECT 
                        $1, email, id, first_name, last_name, 
                        'pending', 
                        md5(random()::text || clock_timestamp()::text),
                        NOW(), NOW()
                    FROM customer 
                    WHERE marketing_opt_in = true
                `;
                break;

            case 'new_customers':
                query = `
                    INSERT INTO email_campaign_recipients (
                        campaign_id, email, customer_id, first_name, last_name, 
                        status, tracking_token, created_at, updated_at
                    )
                    SELECT 
                        $1, email, id, first_name, last_name, 
                        'pending',
                        md5(random()::text || clock_timestamp()::text),
                        NOW(), NOW()
                    FROM customer 
                    WHERE marketing_opt_in = true 
                    AND created_at >= NOW() - INTERVAL '7 days'
                `;
                break;

            case 'recent_buyers':
                query = `
                    INSERT INTO email_campaign_recipients (
                        campaign_id, email, customer_id, first_name, last_name, 
                        status, tracking_token, created_at, updated_at
                    )
                    SELECT 
                        $1, email, id, first_name, last_name, 
                        'pending',
                        md5(random()::text || clock_timestamp()::text),
                        NOW(), NOW()
                    FROM customer 
                    WHERE marketing_opt_in = true 
                    AND last_order_date >= NOW() - INTERVAL '30 days'
                `;
                break;

            case 'premium':
                query = `
                    INSERT INTO email_campaign_recipients (
                        campaign_id, email, customer_id, first_name, last_name, 
                        status, tracking_token, created_at, updated_at
                    )
                    SELECT 
                        $1, email, id, first_name, last_name, 
                        'pending',
                        md5(random()::text || clock_timestamp()::text),
                        NOW(), NOW()
                    FROM customer 
                    WHERE marketing_opt_in = true 
                    AND total_spent >= 500
                `;
                break;
        }

        if (query) {
            await sequelize.query(query, {
                bind: params,
                type: QueryTypes.INSERT
            });
        }
    },

    // Envoyer une campagne (utilise votre système d'email existant)
    async sendCampaign(campaignId) {
        try {
            console.log('📧 Envoi campagne:', campaignId);

            // Récupérer la campagne
            const campaign = await sequelize.query(`
                SELECT * FROM email_campaigns WHERE id = $1
            `, {
                bind: [campaignId],
                type: QueryTypes.SELECT
            });

            if (!campaign[0]) throw new Error('Campagne non trouvée');

            // Récupérer les destinataires
            const recipients = await sequelize.query(`
                SELECT * FROM email_campaign_recipients 
                WHERE campaign_id = $1 AND status = 'pending'
            `, {
                bind: [campaignId],
                type: QueryTypes.SELECT
            });

            // Utiliser votre système d'email existant (comme dans adminOrdersController)
            const { sendEmail } = await import('../services/mailService.js');

            let sentCount = 0;
            let failedCount = 0;

            for (const recipient of recipients) {
                try {
                    // Personnaliser le contenu
                    const personalizedContent = this.personalizeEmailContent(
                        campaign[0].content, 
                        recipient
                    );

                    const emailData = {
                        to: recipient.email,
                        subject: campaign[0].subject,
                        html: personalizedContent
                    };

                    // Envoyer avec votre système existant
                    await sendEmail(emailData);

                    // Marquer comme envoyé
                    await sequelize.query(`
                        UPDATE email_campaign_recipients 
                        SET status = 'sent', sent_at = NOW(), updated_at = NOW()
                        WHERE id = $1
                    `, {
                        bind: [recipient.id],
                        type: QueryTypes.UPDATE
                    });

                    // Logger dans email_logs
                    await sequelize.query(`
                        INSERT INTO email_logs (
                            customer_id, email_type, recipient_email, subject, 
                            status, created_at, sent_at
                        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                    `, {
                        bind: [
                            recipient.customer_id, 
                            'campaign', 
                            recipient.email, 
                            campaign[0].subject, 
                            'sent'
                        ],
                        type: QueryTypes.INSERT
                    });

                    sentCount++;

                } catch (error) {
                    console.error(`❌ Erreur envoi à ${recipient.email}:`, error);
                    
                    // Marquer comme échec
                    await sequelize.query(`
                        UPDATE email_campaign_recipients 
                        SET status = 'failed', updated_at = NOW()
                        WHERE id = $1
                    `, {
                        bind: [recipient.id],
                        type: QueryTypes.UPDATE
                    });

                    failedCount++;
                }

                // Pause entre envois
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Mettre à jour les stats de la campagne
            await sequelize.query(`
                UPDATE email_campaigns 
                SET 
                    status = 'sent',
                    sent_at = NOW(),
                    total_recipients = $2,
                    total_sent = $3,
                    updated_at = NOW()
                WHERE id = $1
            `, {
                bind: [campaignId, recipients.length, sentCount],
                type: QueryTypes.UPDATE
            });

            console.log(`✅ Campagne envoyée: ${sentCount} succès, ${failedCount} échecs`);

        } catch (error) {
            console.error('❌ Erreur envoi campagne:', error);
            
            // Marquer la campagne comme échouée
            await sequelize.query(`
                UPDATE email_campaigns 
                SET status = 'failed', updated_at = NOW()
                WHERE id = $1
            `, {
                bind: [campaignId],
                type: QueryTypes.UPDATE
            });
        }
    },

    // Personnaliser le contenu email
    personalizeEmailContent(content, recipient) {
        let personalizedContent = content;

        const variables = {
            '{{firstName}}': recipient.first_name || '',
            '{{lastName}}': recipient.last_name || '',
            '{{email}}': recipient.email,
            '{{fullName}}': `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim()
        };

        for (const [placeholder, value] of Object.entries(variables)) {
            personalizedContent = personalizedContent.replace(
                new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                value
            );
        }

        // Ajouter tracking
        personalizedContent += `<img src="${process.env.APP_URL || 'http://localhost:3000'}/email/track/${recipient.tracking_token}" width="1" height="1" style="display:none;" />`;

        return personalizedContent;
    },

    // Historique des emails
    async emailHistory(req, res) {
        try {
            const { page = 1, customer_id, email_type, status } = req.query;
            const limit = 20;
            const offset = (page - 1) * limit;

            let whereClause = '';
            let params = [];

            if (customer_id) {
                whereClause += ' WHERE el.customer_id = $' + (params.length + 1);
                params.push(customer_id);
            }

            if (email_type) {
                const condition = params.length > 0 ? ' AND ' : ' WHERE ';
                whereClause += condition + 'el.email_type = $' + (params.length + 1);
                params.push(email_type);
            }

            if (status) {
                const condition = params.length > 0 ? ' AND ' : ' WHERE ';
                whereClause += condition + 'el.status = $' + (params.length + 1);
                params.push(status);
            }

            const emailHistory = await sequelize.query(`
                SELECT 
                    el.*,
                    c.first_name,
                    c.last_name,
                    c.email as customer_email
                FROM email_logs el
                LEFT JOIN customer c ON el.customer_id = c.id
                ${whereClause}
                ORDER BY el.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `, {
                bind: [...params, limit, offset],
                type: QueryTypes.SELECT
            });

            // Stats pour les filtres
            const stats = await sequelize.query(`
                SELECT 
                    email_type,
                    status,
                    COUNT(*) as count
                FROM email_logs
                GROUP BY email_type, status
                ORDER BY email_type, status
            `, { type: QueryTypes.SELECT });

            res.render('admin/email-management/history', {
                title: 'Historique des Emails',
                emailHistory,
                stats,
                currentPage: parseInt(page),
                filters: { customer_id, email_type, status }
            });

        } catch (error) {
            console.error('❌ Erreur historique emails:', error);
            res.status(500).render('error', { 
                error: 'Erreur lors du chargement de l\'historique'
            });
        }
    },

    // Statistiques détaillées d'une campagne
    async campaignStats(req, res) {
        try {
            const { id } = req.params;

            // Infos de la campagne
            const campaign = await sequelize.query(`
                SELECT * FROM email_campaigns WHERE id = $1
            `, {
                bind: [id],
                type: QueryTypes.SELECT
            });

            if (!campaign[0]) {
                return res.status(404).render('error', { 
                    error: 'Campagne non trouvée'
                });
            }

            // Stats générales
            const stats = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_recipients,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
                    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
                    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked_count,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
                    ROUND(
                        CASE 
                            WHEN COUNT(CASE WHEN status = 'sent' THEN 1 END) > 0 
                            THEN (COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::float / COUNT(CASE WHEN status = 'sent' THEN 1 END)::float) * 100
                            ELSE 0 
                        END, 2
                    ) as open_rate,
                    ROUND(
                        CASE 
                            WHEN COUNT(CASE WHEN status = 'sent' THEN 1 END) > 0 
                            THEN (COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::float / COUNT(CASE WHEN status = 'sent' THEN 1 END)::float) * 100
                            ELSE 0 
                        END, 2
                    ) as click_rate
                FROM email_campaign_recipients 
                WHERE campaign_id = $1
            `, {
                bind: [id],
                type: QueryTypes.SELECT
            });

            // Données par jour pour graphique
            const dailyStats = await sequelize.query(`
                SELECT 
                    DATE(sent_at) as date,
                    COUNT(*) as sent_count,
                    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count
                FROM email_campaign_recipients
                WHERE campaign_id = $1 AND sent_at IS NOT NULL
                GROUP BY DATE(sent_at)
                ORDER BY date
            `, {
                bind: [id],
                type: QueryTypes.SELECT
            });

            // Liste des destinataires avec leur statut
            const recipients = await sequelize.query(`
                SELECT 
                    ecr.*,
                    c.first_name,
                    c.last_name
                FROM email_campaign_recipients ecr
                LEFT JOIN customer c ON ecr.customer_id = c.id
                WHERE ecr.campaign_id = $1
                ORDER BY ecr.sent_at DESC
                LIMIT 100
            `, {
                bind: [id],
                type: QueryTypes.SELECT
            });

            res.render('admin/email-management/campaign-stats', {
                title: `Statistiques: ${campaign[0].name}`,
                campaign: campaign[0],
                stats: stats[0],
                dailyStats,
                recipients
            });

        } catch (error) {
            console.error('❌ Erreur stats campagne:', error);
            res.status(500).render('error', { 
                error: 'Erreur lors du chargement des statistiques'
            });
        }
    },

    // Tracking email ouverture (utilise votre table tracking)
    async trackEmailOpen(req, res) {
        try {
            const { token } = req.params;

            // Trouver le destinataire
            const recipient = await sequelize.query(`
                SELECT * FROM email_campaign_recipients 
                WHERE tracking_token = $1 AND opened_at IS NULL
            `, {
                bind: [token],
                type: QueryTypes.SELECT
            });

            if (recipient[0]) {
                // Marquer comme ouvert
                await sequelize.query(`
                    UPDATE email_campaign_recipients 
                    SET opened_at = NOW(), open_count = open_count + 1, updated_at = NOW()
                    WHERE id = $1
                `, {
                    bind: [recipient[0].id],
                    type: QueryTypes.UPDATE
                });

                // Logger dans email_tracking
                await sequelize.query(`
                    INSERT INTO email_tracking (
                        campaign_id, customer_email, action_type, 
                        action_data, user_agent, ip_address, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                `, {
                    bind: [
                        recipient[0].campaign_id,
                        recipient[0].email,
                        'open',
                        JSON.stringify({ tracking_token: token }),
                        req.headers['user-agent'] || '',
                        req.ip || req.connection.remoteAddress
                    ],
                    type: QueryTypes.INSERT
                });
            }

            // Retourner pixel transparent
            const pixel = Buffer.from(
                'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                'base64'
            );
            
            res.writeHead(200, {
                'Content-Type': 'image/gif',
                'Content-Length': pixel.length,
                'Cache-Control': 'no-cache'
            });
            res.end(pixel);

        } catch (error) {
            console.error('❌ Erreur tracking ouverture:', error);
            res.status(200).end();
        }
    },

    // Supprimer une campagne
    async deleteCampaign(req, res) {
        try {
            const { id } = req.params;

            // Vérifier que la campagne existe et n'est pas en cours d'envoi
            const campaign = await sequelize.query(`
                SELECT status FROM email_campaigns WHERE id = $1
            `, {
                bind: [id],
                type: QueryTypes.SELECT
            });

            if (!campaign[0]) {
                return res.status(404).json({
                    success: false,
                    error: 'Campagne non trouvée'
                });
            }

            if (campaign[0].status === 'sending') {
                return res.status(400).json({
                    success: false,
                    error: 'Impossible de supprimer une campagne en cours d\'envoi'
                });
            }

            // Supprimer les destinataires d'abord
            await sequelize.query(`
                DELETE FROM email_campaign_recipients WHERE campaign_id = $1
            `, {
                bind: [id],
                type: QueryTypes.DELETE
            });

            // Supprimer la campagne
            await sequelize.query(`
                DELETE FROM email_campaigns WHERE id = $1
            `, {
                bind: [id],
                type: QueryTypes.DELETE
            });

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
    }
};
