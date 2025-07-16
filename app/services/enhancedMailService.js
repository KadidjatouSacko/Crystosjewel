// ==========================================
// 📧 SERVICE MAIL ENRICHI POUR CAMPAGNES
// ==========================================

import nodemailer from 'nodemailer';
import { EmailLog } from '../models/emailLogModel.js';
import { EmailTemplate } from '../models/emailTemplateModel.js';

// Configuration du transporteur
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

// Vérifier la configuration au démarrage
transporter.verify()
    .then(() => {
        console.log('✅ Service email configuré correctement');
    })
    .catch((error) => {
        console.error('❌ Erreur configuration email:', error);
    });

export const enhancedMailService = {

    // ==========================================
    // 📤 ENVOI D'EMAIL BRUT
    // ==========================================
    async sendRawEmail(to, subject, htmlContent, textContent = '', options = {}) {
        try {
            const mailOptions = {
                from: `"${process.env.MAIL_FROM_NAME || 'CrystosJewel'}" <${process.env.MAIL_USER}>`,
                to: to,
                subject: subject,
                html: htmlContent,
                text: textContent || this.htmlToText(htmlContent),
                ...options
            };

            // Ajouter le pixel de tracking si demandé
            if (options.trackOpens && options.campaignId) {
                mailOptions.html = this.addTrackingPixel(mailOptions.html, options.campaignId, to);
            }

            // Ajouter le tracking des liens si demandé
            if (options.trackClicks && options.campaignId) {
                mailOptions.html = this.addLinkTracking(mailOptions.html, options.campaignId, to);
            }

            const info = await transporter.sendMail(mailOptions);

            // Logger l'envoi
            if (options.logEmail !== false) {
                await this.logEmail({
                    recipient_email: to,
                    subject: subject,
                    html_content: htmlContent,
                    text_content: textContent,
                    email_type: options.emailType || 'campaign',
                    campaign_id: options.campaignId,
                    template_id: options.templateId,
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
                    template_id: options.templateId,
                    status: 'failed',
                    error_message: error.message
                });
            }

            return { success: false, error: error.message };
        }
    },

    // ==========================================
    // 📧 ENVOI AVEC TEMPLATE
    // ==========================================
    async sendWithTemplate(to, templateName, variables = {}, options = {}) {
        try {
            const template = await EmailTemplate.findOne({
                where: { 
                    template_name: templateName,
                    is_active: true 
                }
            });

            if (!template) {
                throw new Error(`Template "${templateName}" non trouvé`);
            }

            // Remplacer les variables dans le contenu
            const processedHtml = this.replaceVariables(template.html_content, variables);
            const processedSubject = this.replaceVariables(template.subject, variables);
            const processedText = template.text_content ? 
                this.replaceVariables(template.text_content, variables) : '';

            return await this.sendRawEmail(
                to, 
                processedSubject, 
                processedHtml, 
                processedText,
                {
                    ...options,
                    templateId: template.id
                }
            );

        } catch (error) {
            console.error('❌ Erreur envoi avec template:', error);
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

        const batchSize = options.batchSize || 10;
        const delayBetweenBatches = options.delayBetweenBatches || 1000;
        const campaignId = options.campaignId || `campaign_${Date.now()}`;

        console.log(`📧 Début campagne ${campaignId} - ${recipients.length} destinataires`);

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (recipient) => {
                try {
                    // Personnaliser le contenu pour chaque destinataire
                    const personalizedContent = this.personalizeContent(htmlContent, recipient);
                    const personalizedSubject = this.personalizeContent(subject, recipient);

                    const result = await this.sendRawEmail(
                        recipient.email,
                        personalizedSubject,
                        personalizedContent,
                        '',
                        {
                            ...options,
                            campaignId: campaignId,
                            trackOpens: true,
                            trackClicks: true
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

            // Pause entre les lots pour éviter les limites de taux
            if (i + batchSize < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }

            console.log(`📧 Lot ${Math.floor(i / batchSize) + 1} terminé - ${results.sent}/${results.total} envoyés`);
        }

        console.log(`✅ Campagne ${campaignId} terminée - ${results.sent} succès, ${results.failed} échecs`);
        return results;
    },

    // ==========================================
    // 🎯 EMAILS TRANSACTIONNELS SPÉCIALISÉS
    // ==========================================
    async sendWelcomeEmail(userEmail, firstName) {
        const variables = {
            first_name: firstName,
            company_name: 'CrystosJewel',
            current_date: new Date().toLocaleDateString('fr-FR'),
            website_url: process.env.BASE_URL || 'http://localhost:3000'
        };

        return await this.sendWithTemplate(
            userEmail,
            'welcome_email',
            variables,
            { emailType: 'welcome' }
        );
    },

    async sendOrderConfirmationEmail(userEmail, firstName, orderData) {
        const variables = {
            first_name: firstName,
            order_number: orderData.orderNumber,
            total_amount: orderData.total,
            items: orderData.items,
            shipping_address: orderData.shippingAddress,
            estimated_delivery: orderData.estimatedDelivery,
            company_name: 'CrystosJewel',
            current_date: new Date().toLocaleDateString('fr-FR')
        };

        return await this.sendWithTemplate(
            userEmail,
            'order_confirmation',
            variables,
            { emailType: 'order_confirmation' }
        );
    },

    async sendShippingNotificationEmail(userEmail, firstName, trackingData) {
        const variables = {
            first_name: firstName,
            order_number: trackingData.orderNumber,
            tracking_number: trackingData.trackingNumber,
            carrier: trackingData.carrier,
            tracking_url: trackingData.trackingUrl,
            estimated_delivery: trackingData.estimatedDelivery,
            company_name: 'CrystosJewel'
        };

        return await this.sendWithTemplate(
            userEmail,
            'shipping_notification',
            variables,
            { emailType: 'shipping' }
        );
    },

    async sendPromotionalEmail(userEmail, firstName, promoData) {
        const variables = {
            first_name: firstName,
            promo_title: promoData.title,
            promo_description: promoData.description,
            discount_amount: promoData.discount,
            promo_code: promoData.promoCode,
            expiry_date: promoData.expiryDate,
            shop_url: `${process.env.BASE_URL}/bijoux`,
            company_name: 'CrystosJewel',
            current_date: new Date().toLocaleDateString('fr-FR')
        };

        return await this.sendWithTemplate(
            userEmail,
            'promotional_email',
            variables,
            { emailType: 'promotional' }
        );
    },

    // ==========================================
    // 🔧 MÉTHODES UTILITAIRES
    // ==========================================
    replaceVariables(content, variables) {
        let processedContent = content;

        // Variables par défaut
        const defaultVariables = {
            company_name: 'CrystosJewel',
            current_date: new Date().toLocaleDateString('fr-FR'),
            current_year: new Date().getFullYear(),
            website_url: process.env.BASE_URL || 'http://localhost:3000',
            support_email: process.env.MAIL_USER,
            unsubscribe_url: `${process.env.BASE_URL}/newsletter/unsubscribe`
        };

        const allVariables = { ...defaultVariables, ...variables };

        // Remplacer toutes les variables {{variable}}
        Object.keys(allVariables).forEach(key => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            processedContent = processedContent.replace(regex, allVariables[key] || '');
        });

        return processedContent;
    },

    personalizeContent(content, recipient) {
        const variables = {
            first_name: recipient.firstName || recipient.first_name || 'Cher client',
            last_name: recipient.lastName || recipient.last_name || '',
            email: recipient.email,
            full_name: `${recipient.firstName || recipient.first_name || ''} ${recipient.lastName || recipient.last_name || ''}`.trim()
        };

        return this.replaceVariables(content, variables);
    },

    addTrackingPixel(htmlContent, campaignId, email) {
        const trackingUrl = `${process.env.BASE_URL}/email/track/open/${campaignId}/${encodeURIComponent(email)}`;
        const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="">`;
        
        // Ajouter le pixel juste avant la fermeture du body
        if (htmlContent.includes('</body>')) {
            return htmlContent.replace('</body>', `${trackingPixel}</body>`);
        } else {
            return htmlContent + trackingPixel;
        }
    },

    addLinkTracking(htmlContent, campaignId, email) {
        // Remplacer tous les liens href par des liens de tracking
        return htmlContent.replace(
            /href="([^"]+)"/g, 
            (match, url) => {
                if (url.startsWith('http') && !url.includes('/email/track/')) {
                    const trackingUrl = `${process.env.BASE_URL}/email/track/click/${campaignId}/${encodeURIComponent(email)}/${encodeURIComponent(url)}`;
                    return `href="${trackingUrl}"`;
                }
                return match;
            }
        );
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
    // 📊 MÉTHODES DE STATISTIQUES
    // ==========================================
    async getEmailStats(period = 30) {
        try {
            return await EmailLog.getStatsByPeriod(period);
        } catch (error) {
            console.error('❌ Erreur stats email:', error);
            return [];
        }
    },

    async getCampaignPerformance(campaignId) {
        try {
            return await EmailLog.getCampaignStats(campaignId);
        } catch (error) {
            console.error('❌ Erreur performance campagne:', error);
            return null;
        }
    },

    async getTopPerformingCampaigns(limit = 10) {
        try {
            return await EmailLog.getTopCampaigns(limit);
        } catch (error) {
            console.error('❌ Erreur top campagnes:', error);
            return [];
        }
    },

    // ==========================================
    // 🔧 MÉTHODES DE MAINTENANCE
    // ==========================================
    async cleanOldLogs(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const deleted = await EmailLog.destroy({
                where: {
                    created_at: {
                        [sequelize.Op.lt]: cutoffDate
                    }
                }
            });

            console.log(`🧹 ${deleted} anciens logs email supprimés`);
            return deleted;
        } catch (error) {
            console.error('❌ Erreur nettoyage logs:', error);
            return 0;
        }
    },

    async testEmailConfiguration() {
        try {
            const testResult = await transporter.verify();
            console.log('✅ Configuration email testée avec succès');
            return { success: true, result: testResult };
        } catch (error) {
            console.error('❌ Erreur test configuration email:', error);
            return { success: false, error: error.message };
        }
    }
};

export default enhancedMailService;