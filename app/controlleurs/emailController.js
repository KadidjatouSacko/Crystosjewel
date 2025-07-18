// ==========================================
// 📧 CONTRÔLEUR EMAIL COMPLET
// ==========================================

import { Op } from 'sequelize';
import { sequelize } from '../models/sequelize-client.js';
import { EmailTemplate } from '../models/emailTemplateModel.js';
import { EmailLog } from '../models/emailLogModel.js';
import { Jewel } from '../models/jewelModel.js';
import { JewelImage } from '../models/jewelImage.js';
// Seulement Customer, pas de User
import { Customer } from '../models/customerModel.js';
// Import du service email simplifié
import emailCampaignService from '../services/emailCampaignService.js';
import fs from 'fs';
import path from 'path';
import { emailManagementControlleur } from './emailManagementController.js';


export const emailController = {

    // ==========================================
    // 📄 PAGE PRINCIPALE ÉDITEUR D'EMAILS
    // ==========================================
    async showEmailEditor(req, res) {
        try {
            console.log('📧 Affichage éditeur email');

            // Récupérer les modèles disponibles
            let templates = [];
            try {
                templates = await EmailTemplate.findAll({
                    where: { is_active: true },
                    order: [['created_at', 'DESC']]
                });
            } catch (error) {
                console.log('⚠️ Pas de templates disponibles:', error.message);
                templates = [];
            }

            // Statistiques rapides - seulement Customer
            let stats = {
                totalRecipients: 0,
                totalCustomers: 0,
                totalUsers: 0
            };

            try {
                const totalCustomers = await Customer.count();
                stats = {
                    totalRecipients: totalCustomers,
                    totalCustomers: totalCustomers,
                    totalUsers: 0 // Pas de table User
                };
            } catch (error) {
                console.log('⚠️ Erreur stats:', error.message);
            }

            // Dernières campagnes
            let recentCampaigns = [];
            try {
                recentCampaigns = await EmailLog.findAll({
                    where: {
                        email_type: 'campaign'
                    },
                    attributes: [
                        'id',
                        'subject',
                        'status',
                        'created_at',
                        [sequelize.fn('COUNT', sequelize.col('id')), 'recipients']
                    ],
                    group: ['subject', 'id', 'status', 'created_at'],
                    order: [['created_at', 'DESC']],
                    limit: 5
                });
            } catch (error) {
                console.log('⚠️ Pas de campagnes récentes:', error.message);
                recentCampaigns = [];
            }

            res.render('admin/email-editor', {
                title: 'Éditeur d\'Emails',
                templates: templates,
                stats: stats,
                recentCampaigns: recentCampaigns
            });

        } catch (error) {
            console.error('❌ Erreur éditeur email:', error);
            res.status(500).render('error', {
                message: 'Erreur lors du chargement de l\'éditeur',
                error: error
            });
        }
    },

    // ==========================================
    // 📄 HISTORIQUE DES CAMPAGNES
    // ==========================================
    async showHistory(req, res) {
        try {
            console.log('📧 Affichage historique des campagnes');

            // Récupérer toutes les campagnes (groupées par subject)
            const campaignsQuery = `
                SELECT 
                    MIN(id) as id,
                    subject as name,
                    email_type,
                    status,
                    MIN(created_at) as created_at,
                    COUNT(*) as recipients_count,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
                FROM email_logs 
                WHERE email_type IN ('campaign', 'promotional', 'newsletter')
                GROUP BY subject, email_type, status
                ORDER BY MIN(created_at) DESC
                LIMIT 50
            `;

            const [campaigns] = await sequelize.query(campaignsQuery);

            // Formatage des données
            const formattedCampaigns = campaigns.map(campaign => ({
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                type: campaign.email_type,
                created_at: campaign.created_at,
                recipients: parseInt(campaign.recipients_count),
                sent: parseInt(campaign.sent_count),
                failed: parseInt(campaign.failed_count),
                success_rate: campaign.recipients_count > 0 
                    ? Math.round((campaign.sent_count / campaign.recipients_count) * 100)
                    : 0
            }));

            // Statistiques globales
            const totalSent = formattedCampaigns.reduce((sum, c) => sum + c.sent, 0);
            const totalFailed = formattedCampaigns.reduce((sum, c) => sum + c.failed, 0);
            const avgSuccessRate = formattedCampaigns.length > 0
                ? Math.round(formattedCampaigns.reduce((sum, c) => sum + c.success_rate, 0) / formattedCampaigns.length)
                : 0;

            res.render('admin/email-history', {
                title: 'Historique des Campagnes',
                campaigns: formattedCampaigns,
                stats: {
                    total: formattedCampaigns.length,
                    sent: totalSent,
                    failed: totalFailed,
                    successRate: avgSuccessRate
                }
            });

        } catch (error) {
            console.error('❌ Erreur historique email:', error);
            res.status(500).render('error', {
                message: 'Erreur lors du chargement de l\'historique',
                error: error
            });
        }
    },

    // ==========================================
    // 💾 GESTION DES BROUILLONS
    // ==========================================
    async saveDraft(req, res) {
        try {
            const { subject, content, preheader, recipients } = req.body;

            if (!subject || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Sujet et contenu requis'
                });
            }

            // Sauvegarder comme template
            const template = await EmailTemplate.create({
                template_name: `Brouillon - ${subject}`,
                subject: subject,
                html_content: content,
                text_content: preheader || '',
                variables: { recipients: recipients || 'all' },
                is_active: false // Brouillon = inactif
            });

            res.json({
                success: true,
                message: 'Brouillon sauvegardé',
                draftId: template.id
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde brouillon:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde'
            });
        }
    },

    // ==========================================
    // 📤 ENVOI D'EMAIL DE TEST
    // ==========================================
    async sendTest(req, res) {
        try {
            const { testEmail, subject, content, preheader } = req.body;

            if (!testEmail || !subject || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Email de test, sujet et contenu requis'
                });
            }

            // Validation email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(testEmail)) {
                return res.status(400).json({
                    success: false,
                    message: 'Adresse email invalide'
                });
            }

            // Remplacer les variables par des données de test
            const testContent = content
                .replace(/\{\{first_name\}\}/g, 'Test')
                .replace(/\{\{last_name\}\}/g, 'User')
                .replace(/\{\{email\}\}/g, testEmail)
                .replace(/\{\{company_name\}\}/g, 'CrystosJewel')
                .replace(/\{\{current_date\}\}/g, new Date().toLocaleDateString('fr-FR'))
                .replace(/\{\{unsubscribe_url\}\}/g, `${process.env.BASE_URL}/newsletter/unsubscribe?email=${testEmail}`);

            // Envoi via le service email
            const result = await emailCampaignService.sendEmail(
                testEmail,
                `[TEST] ${subject}`,
                testContent,
                { 
                    emailType: 'test',
                    logEmail: true 
                }
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: `Email de test envoyé à ${testEmail}`
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: result.error || 'Erreur lors de l\'envoi du test'
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

    // ==========================================
    // 📤 ENVOI DE CAMPAGNE
    // ==========================================
    async sendCampaign(req, res) {
        try {
            const { subject, content, preheader, recipients, scheduleDate } = req.body;

            if (!subject || !content || !recipients) {
                return res.status(400).json({
                    success: false,
                    message: 'Sujet, contenu et destinataires requis'
                });
            }

            // Définir les destinataires - seulement Customer
            let recipientList = [];
            
            if (recipients === 'all' || recipients === 'customers') {
                // Tous les clients (pas de distinction user/customer)
                const customers = await Customer.findAll({
                    attributes: ['email', 'first_name', 'last_name'],
                    where: {
                        email: { [Op.ne]: null }
                    }
                });
                
                recipientList = customers.map(c => ({
                    email: c.email,
                    firstName: c.first_name,
                    lastName: c.last_name
                }));
            }

            console.log(`📧 Envoi campagne à ${recipientList.length} destinataires`);

            // Envoi en lot via le service simplifié
            const results = await emailCampaignService.sendBulkCampaign(
                recipientList, // Pas de uniqueRecipients car une seule source
                subject,
                content,
                {
                    campaignId: `campaign_${Date.now()}`,
                    emailType: 'campaign'
                }
            );

            console.log(`✅ Campagne terminée: ${results.sent} envoyés, ${results.failed} échecs`);

            res.json({
                success: true,
                message: `Campagne envoyée avec succès`,
                stats: {
                    total: results.total,
                    sent: results.sent,
                    failed: results.failed,
                    successRate: results.total > 0 
                        ? Math.round((results.sent / results.total) * 100)
                        : 0
                }
            });

        } catch (error) {
            console.error('❌ Erreur envoi campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de la campagne'
            });
        }
    },

    // ==========================================
    // 📊 STATISTIQUES DES EMAILS
    // ==========================================
    async getEmailStats(req, res) {
        try {
            const { period = '30' } = req.query;
            
            const stats = await emailCampaignService.getEmailStats(parseInt(period));

            res.json({
                success: true,
                stats: stats
            });

        } catch (error) {
            console.error('❌ Erreur stats email:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des statistiques'
            });
        }
    },

    // ==========================================
    // 👥 RÉCUPÉRER LES CLIENTS
    // ==========================================
    async getCustomers(req, res) {
        try {
            const { type = 'all' } = req.query;

            // Seulement Customer, pas de User
            const customers = await Customer.findAll({
                attributes: ['id', 'email', 'first_name', 'last_name', 'created_at'],
                where: {
                    email: { [Op.ne]: null }
                },
                order: [['created_at', 'DESC']]
            });

            const allCustomers = customers.map(c => ({
                id: c.id,
                email: c.email,
                firstName: c.first_name,
                lastName: c.last_name,
                fullName: `${c.first_name} ${c.last_name}`,
                type: 'customer',
                createdAt: c.created_at
            }));

            res.json({
                success: true,
                customers: allCustomers,
                total: allCustomers.length
            });

        } catch (error) {
            console.error('❌ Erreur récupération clients:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des clients'
            });
        }
    },

    // ==========================================
    // 🎯 GESTION DES CAMPAGNES
    // ==========================================
    async previewCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            
            const campaign = await EmailLog.findByPk(campaignId);
            
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            res.json({
                success: true,
                campaign: {
                    id: campaign.id,
                    subject: campaign.subject,
                    status: campaign.status,
                    createdAt: campaign.created_at,
                    sentAt: campaign.sent_at
                }
            });

        } catch (error) {
            console.error('❌ Erreur preview campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la prévisualisation'
            });
        }
    },

    async duplicateCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            
            const campaign = await EmailLog.findByPk(campaignId);
            
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            res.json({
                success: true,
                message: 'Campagne dupliquée',
                duplicatedCampaign: {
                    subject: `Copie de ${campaign.subject}`,
                    content: 'Contenu original...' // À implémenter
                }
            });

        } catch (error) {
            console.error('❌ Erreur duplication campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la duplication'
            });
        }
    },

    async deleteCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            
            const deleted = await EmailLog.destroy({
                where: { id: campaignId }
            });

            if (deleted) {
                res.json({
                    success: true,
                    message: 'Campagne supprimée'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

        } catch (error) {
            console.error('❌ Erreur suppression campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression'
            });
        }
    },

    // ==========================================
    // 📈 TRACKING DES EMAILS
    // ==========================================
    async trackOpen(req, res) {
        try {
            const { campaignId, customerEmail } = req.params;
            
            // Log de l'ouverture
            console.log(`📧 Email ouvert - Campagne: ${campaignId}, Email: ${customerEmail}`);
            
            // Retourner une image pixel transparente
            const pixel = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                'base64'
            );
            
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': pixel.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            
            res.end(pixel);

        } catch (error) {
            console.error('❌ Erreur tracking ouverture:', error);
            res.status(500).end();
        }
    },

    async trackClick(req, res) {
        try {
            const { campaignId, customerEmail, linkId } = req.params;
            
            // Log du clic
            console.log(`🔗 Lien cliqué - Campagne: ${campaignId}, Email: ${customerEmail}, Lien: ${linkId}`);
            
            // Rediriger vers l'URL originale (à définir selon vos besoins)
            res.redirect('/');

        } catch (error) {
            console.error('❌ Erreur tracking clic:', error);
            res.redirect('/');
        }
    }
};

export default emailController;