import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Vérification de la configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Erreur configuration email:', error);
    } else {
        console.log('✅ Service email prêt');
    }
});

// Templates d'email avec designs avancés
const emailTemplateDesigns = {
    elegant: {
        name: 'Élégant',
        colors: { primary: '#d89ab3', secondary: '#b794a8', accent: '#8b5cf6' },
        backgroundColor: '#f8fafc',
        textColor: '#1e293b',
        headerImage: '💎'
    },
    modern: {
        name: 'Moderne', 
        colors: { primary: '#3b82f6', secondary: '#1d4ed8', accent: '#06b6d4' },
        backgroundColor: '#ffffff',
        textColor: '#111827',
        headerImage: '🌟'
    },
    promo: {
        name: 'Promotion',
        colors: { primary: '#f59e0b', secondary: '#d97706', accent: '#ef4444' },
        backgroundColor: '#fef3c7',
        textColor: '#92400e',
        headerImage: '🔥'
    },
    newsletter: {
        name: 'Newsletter',
        colors: { primary: '#10b981', secondary: '#059669', accent: '#8b5cf6' },
        backgroundColor: '#ecfdf5',
        textColor: '#064e3b',
        headerImage: '📧'
    }
};

export const sendBulkEmailService = {

    // Envoyer un email avec template personnalisé
    async sendEmail(recipientEmail, emailData) {
        try {
            const { subject, content, template = 'elegant', preheader, fromName = 'CrystosJewel' } = emailData;
            
            const templateDesign = emailTemplateDesigns[template] || emailTemplateDesigns.elegant;
            
            // Générer le HTML avec le template
            const htmlContent = this.generateEmailHTML(templateDesign, {
                subject,
                preheader,
                fromName,
                content,
                recipientEmail
            });

            const info = await transporter.sendMail({
                from: `"${fromName}" <${process.env.MAIL_USER}>`,
                to: recipientEmail,
                subject: subject,
                html: htmlContent,
                text: this.stripHtml(content) // Version texte
            });

            console.log(`✅ Email envoyé à ${recipientEmail}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error(`❌ Erreur envoi email à ${recipientEmail}:`, error);
            return { success: false, error: error.message };
        }
    },

    // Envoyer un email de test
    async sendTestEmail(recipientEmail, emailData) {
        try {
            const testData = {
                ...emailData,
                subject: `[TEST] ${emailData.subject}`,
                content: `
                    <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="color: #92400e; margin: 0 0 10px 0;">🧪 EMAIL DE TEST</h4>
                        <p style="color: #92400e; margin: 0; font-size: 14px;">Ceci est un email de test. En production, cet avertissement ne sera pas visible.</p>
                    </div>
                    ${emailData.content}
                `
            };

            return await this.sendEmail(recipientEmail, testData);

        } catch (error) {
            console.error('❌ Erreur envoi email test:', error);
            return { success: false, error: error.message };
        }
    },

    // Envoyer une copie à l'administrateur
    async sendAdminCopy(adminEmail, emailData) {
        try {
            const { subject, content, template, recipientCount } = emailData;
            
            const adminContent = `
                <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                    <h3 style="color: #1d4ed8; margin: 0 0 15px 0;">📧 COPIE ADMINISTRATEUR</h3>
                    <p style="color: #1e40af; margin: 0 0 8px 0;"><strong>Campagne envoyée à:</strong> ${recipientCount} destinataire(s)</p>
                    <p style="color: #1e40af; margin: 0 0 8px 0;"><strong>Template utilisé:</strong> ${emailTemplateDesigns[template]?.name || template}</p>
                    <p style="color: #1e40af; margin: 0;"><strong>Date d'envoi:</strong> ${new Date().toLocaleDateString('fr-FR', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}</p>
                </div>
                <div style="border-left: 4px solid #e5e7eb; padding-left: 20px;">
                    <h4 style="color: #6b7280; margin: 0 0 15px 0;">Contenu envoyé aux clients :</h4>
                    ${content}
                </div>
            `;

            const adminData = {
                subject: `[COPIE ADMIN] ${subject}`,
                content: adminContent,
                template: 'modern'
            };

            return await this.sendEmail(adminEmail, adminData);

        } catch (error) {
            console.error('❌ Erreur envoi copie admin:', error);
            return { success: false, error: error.message };
        }
    },

    // Générer le HTML complet avec template
    generateEmailHTML(templateDesign, emailData) {
        const { subject, preheader, fromName, content, recipientEmail } = emailData;
        
        return `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
                @media screen and (max-width: 600px) {
                    .container { width: 100% !important; }
                    .content { padding: 20px !important; }
                    .header { padding: 20px !important; }
                    h1 { font-size: 24px !important; }
                    h2 { font-size: 20px !important; }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
            
            <!-- Preheader caché -->
            ${preheader ? `<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all;">${preheader}</div>` : ''}
            
            <!-- Container principal -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
                <tr>
                    <td align="center" style="padding: 20px 0;">
                        
                        <!-- Email container -->
                        <table class="container" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: ${templateDesign.backgroundColor}; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1);">
                            
                            <!-- Header -->
                            <tr>
                                <td class="header" style="background: linear-gradient(135deg, ${templateDesign.colors.primary} 0%, ${templateDesign.colors.secondary} 100%); color: white; padding: 40px 30px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 32px; font-weight: 700; line-height: 1.2;">
                                        ${templateDesign.headerImage} ${fromName}
                                    </h1>
                                    ${preheader ? `<p style="margin: 15px 0 0 0; opacity: 0.9; font-size: 16px; line-height: 1.4;">${preheader}</p>` : ''}
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td class="content" style="padding: 40px 30px; color: ${templateDesign.textColor}; line-height: 1.7; font-size: 16px;">
                                    ${this.processContent(content, templateDesign)}
                                </td>
                            </tr>
                            
                            <!-- Call to Action -->
                            <tr>
                                <td style="padding: 0 30px 30px; text-align: center;">
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <a href="${process.env.BASE_URL}" style="
                                                    display: inline-block;
                                                    background: linear-gradient(135deg, ${templateDesign.colors.primary} 0%, ${templateDesign.colors.secondary} 100%);
                                                    color: white;
                                                    padding: 15px 30px;
                                                    text-decoration: none;
                                                    border-radius: 50px;
                                                    font-weight: 600;
                                                    font-size: 16px;
                                                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                                                    transition: transform 0.3s ease;
                                                ">
                                                    ✨ Découvrir nos bijoux
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                    <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                                        <strong>${fromName}</strong><br>
                                        Bijouterie d'exception depuis 1985<br>
                                        📍 123 Avenue des Bijoux, 75001 Paris<br>
                                        📞 01 23 45 67 89
                                    </p>
                                    
                                    <!-- Social Links -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <a href="#" style="color: ${templateDesign.colors.primary}; text-decoration: none; margin: 0 10px; font-size: 24px;">📘</a>
                                                <a href="#" style="color: ${templateDesign.colors.primary}; text-decoration: none; margin: 0 10px; font-size: 24px;">📷</a>
                                                <a href="#" style="color: ${templateDesign.colors.primary}; text-decoration: none; margin: 0 10px; font-size: 24px;">🐦</a>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px;">
                                        Vous recevez cet email car vous êtes inscrit à notre newsletter.<br>
                                        <a href="${process.env.BASE_URL}/unsubscribe?email=${encodeURIComponent(recipientEmail)}" style="color: ${templateDesign.colors.primary}; text-decoration: none;">Se désabonner</a> | 
                                        <a href="${process.env.BASE_URL}/preferences?email=${encodeURIComponent(recipientEmail)}" style="color: ${templateDesign.colors.primary}; text-decoration: none;">Gérer mes préférences</a>
                                    </p>
                                </td>
                            </tr>
                            
                        </table>
                        
                    </td>
                </tr>
            </table>
            
        </body>
        </html>
        `;
    },

    // Traiter le contenu pour appliquer les styles du template
    processContent(content, templateDesign) {
        let processedContent = content;
        
        // Appliquer les couleurs du template aux éléments
        processedContent = processedContent.replace(
            /<h1([^>]*)>/g, 
            `<h1$1 style="color: ${templateDesign.colors.primary}; font-size: 28px; font-weight: 700; margin: 0 0 20px 0; line-height: 1.2;">`
        );
        
        processedContent = processedContent.replace(
            /<h2([^>]*)>/g, 
            `<h2$1 style="color: ${templateDesign.colors.secondary}; font-size: 24px; font-weight: 600; margin: 25px 0 15px 0; line-height: 1.3;">`
        );
        
        processedContent = processedContent.replace(
            /<h3([^>]*)>/g, 
            `<h3$1 style="color: ${templateDesign.colors.primary}; font-size: 20px; font-weight: 600; margin: 20px 0 12px 0; line-height: 1.3;">`
        );
        
        processedContent = processedContent.replace(
            /<p([^>]*)>/g, 
            `<p$1 style="margin: 0 0 16px 0; line-height: 1.6; color: ${templateDesign.textColor};">`
        );
        
        processedContent = processedContent.replace(
            /<a([^>]*href[^>]*)>/g, 
            `<a$1 style="color: ${templateDesign.colors.primary}; text-decoration: none; font-weight: 500;">`
        );
        
        processedContent = processedContent.replace(
            /<strong([^>]*)>/g, 
            `<strong$1 style="font-weight: 600; color: ${templateDesign.colors.secondary};">`
        );
        
        return processedContent;
    },

    // Convertir HTML en texte simple
    stripHtml(html) {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    },

    // Valider une adresse email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Obtenir les statistiques du service
    async getEmailStats() {
        try {
            // Ici vous pourriez implémenter des statistiques réelles
            return {
                dailyLimit: 500,
                dailySent: 0, // À implémenter avec un système de comptage
                queueSize: 0,
                lastError: null
            };
        } catch (error) {
            console.error('❌ Erreur récupération stats email:', error);
            return null;
        }
    }
};