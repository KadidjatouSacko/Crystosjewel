// ==========================================
// 📧 SERVICE EMAIL SIMPLIFIÉ COMPATIBLE
// ==========================================
// Créer ce fichier : app/services/emailCampaignService.js

import nodemailer from 'nodemailer';
import { EmailLog } from '../models/emailLogModel.js';
import { EmailTemplate } from '../models/emailTemplateModel.js';

// Réutiliser la configuration existante de votre mailService.js
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER, // doit être crystosjewel@gmail.com
    pass: process.env.MAIL_PASS  // doit être cpmzqnnonvdfaxhx
  },
   pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5
});

export const emailCampaignService = {

    // ==========================================
    // 📤 ENVOI D'EMAIL SIMPLE
    // ==========================================
    async sendEmail(to, subject, htmlContent, options = {}) {
        try {
            const mailOptions = {
                from: `"CrystosJewel" <${process.env.MAIL_USER}>`,
                to: to,
                subject: subject,
                html: htmlContent,
                text: this.htmlToText(htmlContent)
            };

            const info = await transporter.sendMail(mailOptions);

            // Logger l'envoi si demandé
            if (options.logEmail !== false) {
                await this.logEmail({
                    recipient_email: to,
                    subject: subject,
                    html_content: htmlContent,
                    email_type: options.emailType || 'campaign',
                    campaign_id: options.campaignId,
                    status: 'sent',
                    sent_at: new Date()
                });
            }

            console.log('📧 Email envoyé:', info.messageId);
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error('❌ Erreur envoi email:', error);

            // Logger l'erreur
            if (options.logEmail !== false) {
                await this.logEmail({
                    recipient_email: to,
                    subject: subject,
                    html_content: htmlContent,
                    email_type: options.emailType || 'campaign',
                    campaign_id: options.campaignId,
                    status: 'failed',
                    error_message: error.message
                });
            }

            return { success: false, error: error.message };
        }
    },

    // ==========================================
    // 📊 ENVOI DE CAMPAGNE EN MASSE
    // ==========================================
    async sendBulkCampaign(recipients, subject, htmlContent, options = {}) {
        const results = {
            total: recipients.length,
            sent: 0,
            failed: 0,
            errors: []
        };

        const batchSize = 5; // Réduit pour éviter les limites Gmail
        const delayBetweenBatches = 2000; // 2 secondes entre les lots
        const campaignId = options.campaignId || `campaign_${Date.now()}`;

        console.log(`📧 Début campagne ${campaignId} - ${recipients.length} destinataires`);

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (recipient) => {
                try {
                    // Personnaliser le contenu
                    const personalizedContent = this.personalizeContent(htmlContent, recipient);
                    const personalizedSubject = this.personalizeContent(subject, recipient);

                    const result = await this.sendEmail(
                        recipient.email,
                        personalizedSubject,
                        personalizedContent,
                        {
                            campaignId: campaignId,
                            emailType: 'campaign'
                        }
                    );

                    if (result.success) {
                        results.sent++;
                    } else {
                        results.failed++;
                        results.errors.push({
                            email: recipient.email,
                            error: result.error
                        });
                    }

                    return result;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        email: recipient.email,
                        error: error.message
                    });
                    return { success: false, error: error.message };
                }
            });

            await Promise.all(batchPromises);

            // Pause entre les lots
            if (i + batchSize < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }

            console.log(`📧 Lot ${Math.floor(i / batchSize) + 1} terminé - ${results.sent}/${results.total} envoyés`);
        }

        console.log(`✅ Campagne ${campaignId} terminée - ${results.sent} succès, ${results.failed} échecs`);
        return results;
    },

    // ==========================================
    // 🔧 MÉTHODES UTILITAIRES
    // ==========================================
    personalizeContent(content, recipient) {
        const variables = {
            first_name: recipient.firstName || recipient.first_name || 'Cher client',
            last_name: recipient.lastName || recipient.last_name || '',
            email: recipient.email,
            company_name: 'CrystosJewel',
            current_date: new Date().toLocaleDateString('fr-FR'),
            website_url: process.env.BASE_URL || 'http://localhost:3000',
            unsubscribe_url: `${process.env.BASE_URL || 'http://localhost:3000'}/newsletter/unsubscribe?email=${recipient.email}`
        };

        let processedContent = content;

        // Remplacer toutes les variables {{variable}}
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            processedContent = processedContent.replace(regex, variables[key] || '');
        });

        return processedContent;
    },

    htmlToText(html) {
        // Conversion simple HTML vers texte
        return html
            .replace(/<style[^>]*>.*?<\/style>/gs, '')
            .replace(/<script[^>]*>.*?<\/script>/gs, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    async logEmail(emailData) {
        try {
            await EmailLog.create(emailData);
        } catch (error) {
            console.error('❌ Erreur log email:', error);
        }
    },

    // ==========================================
    // 📊 STATISTIQUES SIMPLIFIÉES
    // ==========================================
    async getEmailStats(period = 30) {
        try {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - period);

            const totalEmails = await EmailLog.count({
                where: {
                    created_at: { [sequelize.Op.gte]: daysAgo }
                }
            });

            const sentEmails = await EmailLog.count({
                where: {
                    created_at: { [sequelize.Op.gte]: daysAgo },
                    status: 'sent'
                }
            });

            const failedEmails = await EmailLog.count({
                where: {
                    created_at: { [sequelize.Op.gte]: daysAgo },
                    status: 'failed'
                }
            });

            return {
                total: totalEmails,
                sent: sentEmails,
                failed: failedEmails,
                successRate: totalEmails > 0 ? Math.round((sentEmails / totalEmails) * 100) : 0
            };
        } catch (error) {
            console.error('❌ Erreur stats email:', error);
            return { total: 0, sent: 0, failed: 0, successRate: 0 };
        }
    }
};

export default emailCampaignService;