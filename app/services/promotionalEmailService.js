// app/services/promotionalEmailService.js

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// ✅ CONFIGURATION DU TRANSPORTEUR EMAIL
const transporter = nodemailer.createTransporter({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: process.env.MAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

// ========================================
// 🎨 TEMPLATES D'EMAIL
// ========================================

const emailTemplates = {
    newsletter: {
        getHtml: (data) => `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${data.subject}</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #d89ab3 0%, #b794a8 100%); padding: 40px 30px; text-align: center;">
                        <h1 style="margin: 0; color: white; font-size: 32px; font-weight: 700;">
                            💎 Bijouterie Élégance
                        </h1>
                        <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                            Votre bijoutier de confiance
                        </p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #1e293b; font-size: 28px; margin-bottom: 20px; text-align: center;">
                            ${data.title}
                        </h2>
                        
                        <div style="color: #64748b; font-size: 16px; line-height: 1.7; margin-bottom: 30px;">
                            ${data.content.replace(/\n/g, '<br>')}
                        </div>

                        ${data.discount && data.discount > 0 ? `
                            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0;">
                                <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 24px;">
                                    🎉 Offre Spéciale ${data.discount}% de réduction !
                                </h3>
                                ${data.promoCode ? `
                                    <div style="background: white; border: 1px dashed #f59e0b; border-radius: 8px; padding: 15px; margin: 15px 0;">
                                        <p style="margin: 0; color: #78350f; font-size: 14px; font-weight: 600;">
                                            Code promo : <span style="font-family: monospace; font-size: 18px; color: #92400e;">${data.promoCode}</span>
                                        </p>
                                    </div>
                                ` : ''}
                                <p style="margin: 15px 0 0 0; color: #78350f; font-size: 14px;">
                                    Valable jusqu'à épuisement des stocks
                                </p>
                            </div>
                        ` : ''}

                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/bijoux" 
                               style="background: linear-gradient(135deg, #d89ab3 0%, #b794a8 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(216, 154, 179, 0.3);">
                                Découvrir nos bijoux ✨
                            </a>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <div style="margin-bottom: 20px;">
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}" style="color: #d89ab3; text-decoration: none; margin: 0 15px;">
                                🏠 Boutique
                            </a>
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/contact" style="color: #d89ab3; text-decoration: none; margin: 0 15px;">
                                📞 Contact
                            </a>
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/profil" style="color: #d89ab3; text-decoration: none; margin: 0 15px;">
                                👤 Mon compte
                            </a>
                        </div>
                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                            Bijouterie Élégance - Votre spécialiste en bijoux précieux
                        </p>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                            Vous recevez cet email car vous êtes inscrit à notre newsletter.
                            <br>
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/unsubscribe" style="color: #9ca3af;">Se désabonner</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    },

    promotion: {
        getHtml: (data) => `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${data.subject}</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    
                    <!-- Header Promo -->
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; position: relative;">
                        <div style="background: rgba(255,255,255,0.2); border-radius: 50px; padding: 10px 20px; display: inline-block; margin-bottom: 15px;">
                            <span style="color: white; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                🔥 Promotion Spéciale
                            </span>
                        </div>
                        <h1 style="margin: 0; color: white; font-size: 36px; font-weight: 800;">
                            ${data.discount}% DE RÉDUCTION
                        </h1>
                        <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">
                            ${data.title}
                        </p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 15px;">
                                Une occasion en or ! ✨
                            </h2>
                            <div style="color: #64748b; font-size: 16px; line-height: 1.7;">
                                ${data.content.replace(/\n/g, '<br>')}
                            </div>
                        </div>

                        ${data.promoCode ? `
                            <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border: 2px dashed #ef4444; border-radius: 15px; padding: 25px; text-align: center; margin: 30px 0;">
                                <p style="margin: 0 0 10px 0; color: #7f1d1d; font-size: 16px; font-weight: 600;">
                                    Votre code promo exclusif :
                                </p>
                                <div style="background: white; border-radius: 10px; padding: 15px; font-family: monospace; font-size: 28px; font-weight: bold; color: #ef4444; letter-spacing: 2px; margin: 10px 0;">
                                    ${data.promoCode}
                                </div>
                                <p style="margin: 10px 0 0 0; color: #7f1d1d; font-size: 14px;">
                                    Copiez ce code lors de votre commande
                                </p>
                            </div>
                        ` : ''}

                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/bijoux" 
                               style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 18px 40px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4); text-transform: uppercase; letter-spacing: 1px;">
                                🛍️ Profiter de l'offre
                            </a>
                        </div>

                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 8px;">
                            <p style="margin: 0; color: #78350f; font-size: 14px; font-weight: 600;">
                                ⏰ Offre limitée dans le temps - Ne tardez pas !
                            </p>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="background-color: #f8fafc; padding: 25px; text-align: center;">
                        <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px;">
                            Bijouterie Élégance - Des bijoux d'exception
                        </p>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/unsubscribe" style="color: #9ca3af;">Se désabonner</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    },

    welcome: {
        getHtml: (data) => `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${data.subject}</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 15px 40px rgba(0,0,0,0.1);">
                    
                    <!-- Header Welcome -->
                    <div style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); padding: 40px 30px; text-align: center;">
                        <div style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 40px;">💎</span>
                        </div>
                        <h1 style="margin: 0; color: white; font-size: 32px; font-weight: 700;">
                            ${data.title}
                        </h1>
                        <p style="margin: 15px 0 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">
                            Bienvenue dans notre univers de bijoux d'exception
                        </p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 20px;">
                                Merci de nous faire confiance ! 🌟
                            </h2>
                            <div style="color: #64748b; font-size: 16px; line-height: 1.7;">
                                ${data.content.replace(/\n/g, '<br>')}
                            </div>
                        </div>

                        ${data.discount && data.discount > 0 ? `
                            <div style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border: 2px solid #10b981; border-radius: 15px; padding: 25px; text-align: center; margin: 30px 0;">
                                <h3 style="color: #065f46; margin: 0 0 15px 0; font-size: 22px;">
                                    🎁 Cadeau de bienvenue
                                </h3>
                                <p style="margin: 0 0 15px 0; color: #047857; font-size: 18px; font-weight: 600;">
                                    ${data.discount}% de réduction sur votre première commande
                                </p>
                                ${data.promoCode ? `
                                    <div style="background: white; border: 1px solid #10b981; border-radius: 10px; padding: 15px; margin: 15px 0;">
                                        <p style="margin: 0; color: #065f46; font-size: 14px;">Code : </p>
                                        <span style="font-family: monospace; font-size: 20px; color: #047857; font-weight: bold;">${data.promoCode}</span>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}

                        <!-- CTA Buttons -->
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/bijoux" 
                               style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; margin: 5px 10px; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);">
                                Découvrir nos collections
                            </a>
                            <br>
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/profil" 
                               style="background: transparent; color: #ec4899; border: 2px solid #ec4899; padding: 12px 25px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px; display: inline-block; margin: 5px 10px;">
                                Mon compte
                            </a>
                        </div>

                        <!-- Features -->
                        <div style="border-top: 1px solid #e5e7eb; padding-top: 30px; margin-top: 30px;">
                            <h3 style="text-align: center; color: #1e293b; margin-bottom: 25px;">Pourquoi choisir Bijouterie Élégance ?</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div style="text-align: center; padding: 15px;">
                                    <div style="font-size: 32px; margin-bottom: 10px;">✨</div>
                                    <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">Qualité Premium</h4>
                                    <p style="margin: 0; color: #64748b; font-size: 14px;">Bijoux sélectionnés avec soin</p>
                                </div>
                                <div style="text-align: center; padding: 15px;">
                                    <div style="font-size: 32px; margin-bottom: 10px;">🚚</div>
                                    <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">Livraison Gratuite</h4>
                                    <p style="margin: 0; color: #64748b; font-size: 14px;">Dès 50€ d'achat</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="background-color: #f8fafc; padding: 25px; text-align: center;">
                        <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px;">
                            L'équipe Bijouterie Élégance vous souhaite la bienvenue ! 💕
                        </p>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/unsubscribe" style="color: #9ca3af;">Se désabonner</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    },

    custom: {
        getHtml: (data) => `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${data.subject}</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);">
                    
                    <!-- Simple Header -->
                    <div style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); padding: 30px; text-align: center;">
                        <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">
                            💎 Bijouterie Élégance
                        </h1>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 20px;">
                            ${data.title}
                        </h2>
                        
                        <div style="color: #64748b; font-size: 16px; line-height: 1.7; margin-bottom: 30px;">
                            ${data.content.replace(/\n/g, '<br>')}
                        </div>

                        ${data.discount && data.discount > 0 ? `
                            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                                <h3 style="color: #1e293b; margin: 0 0 10px 0;">Offre spéciale ${data.discount}%</h3>
                                ${data.promoCode ? `
                                    <p style="margin: 0; font-family: monospace; font-size: 18px; color: #475569;">${data.promoCode}</p>
                                ` : ''}
                            </div>
                        ` : ''}

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/bijoux" 
                               style="background: #64748b; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                                Visiter notre boutique
                            </a>
                        </div>
                    </div>

                    <!-- Simple Footer -->
                    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                            Bijouterie Élégance
                        </p>
                        <p style="margin: 5px 0 0 0; color: #9ca3af; font-size: 12px;">
                            <a href="${process.env.SITE_URL || 'https://votre-site.com'}/unsubscribe" style="color: #9ca3af;">Se désabonner</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    }
};

// ========================================
// 📧 FONCTION PRINCIPALE D'ENVOI EMAIL PROMOTIONNEL
// ========================================
export const sendPromotionalEmail = async (recipientEmail, recipientName, emailData) => {
    try {
        console.log(`📧 Envoi email promotionnel à: ${recipientEmail}`);

        // ✅ SÉLECTIONNER LE TEMPLATE
        const template = emailTemplates[emailData.template] || emailTemplates.newsletter;
        
        // ✅ PRÉPARER LES DONNÉES
        const templateData = {
            subject: emailData.subject,
            title: emailData.title,
            content: emailData.content,
            discount: emailData.discount,
            promoCode: emailData.promoCode,
            recipientName: recipientName || 'Cher client'
        };

        // ✅ GÉNÉRER LE HTML
        const htmlContent = template.getHtml(templateData);

        // ✅ PRÉPARER L'EMAIL
        const mailOptions = {
            from: `"Bijouterie Élégance 💎" <${process.env.MAIL_USER}>`,
            to: recipientEmail,
            subject: emailData.subject,
            html: htmlContent,
            // Version texte pour les clients qui ne supportent pas HTML
            text: `
${emailData.title}

${emailData.content}

${emailData.discount && emailData.discount > 0 ? `
Offre spéciale: ${emailData.discount}% de réduction
${emailData.promoCode ? `Code promo: ${emailData.promoCode}` : ''}
` : ''}

Visitez notre boutique: ${process.env.SITE_URL || 'https://votre-site.com'}/bijoux

---
Bijouterie Élégance
Pour vous désabonner: ${process.env.SITE_URL || 'https://votre-site.com'}/unsubscribe
            `.trim()
        };

        // ✅ ENVOYER L'EMAIL
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Email envoyé avec succès à ${recipientEmail}: ${info.messageId}`);
        
        return {
            success: true,
            messageId: info.messageId,
            recipient: recipientEmail
        };

    } catch (error) {
        console.error(`❌ Erreur envoi email à ${recipientEmail}:`, error);
        
        return {
            success: false,
            error: error.message,
            recipient: recipientEmail
        };
    }
};

// ========================================
// 📧 FONCTION POUR EMAIL DE BIENVENUE
// ========================================
export const sendWelcomeEmail = async (recipientEmail, recipientName, promoCode = null) => {
    const emailData = {
        subject: '🌟 Bienvenue chez Bijouterie Élégance !',
        title: `Bienvenue ${recipientName} !`,
        content: `Nous sommes ravis de vous accueillir dans notre univers de bijoux d'exception.

Découvrez notre collection soigneusement sélectionnée de bijoux élégants, parfaits pour sublimer tous vos moments précieux.

En tant que nouveau membre, profitez de nos avantages exclusifs et de notre service clientèle dédié.`,
        template: 'welcome',
        discount: promoCode ? 10 : 0,
        promoCode: promoCode
    };

    return await sendPromotionalEmail(recipientEmail, recipientName, emailData);
};

// ========================================
// 📧 FONCTION POUR EMAIL DE PROMOTION
// ========================================
export const sendPromotionEmail = async (recipientEmail, recipientName, promotion) => {
    const emailData = {
        subject: `🔥 ${promotion.title} - Offre limitée !`,
        title: promotion.title,
        content: promotion.description || `Ne manquez pas cette offre exceptionnelle !

Profitez de ${promotion.discount}% de réduction sur notre sélection de bijoux premium.

Cette promotion est valable pour une durée limitée, alors n'attendez plus pour faire plaisir ou vous faire plaisir.`,
        template: 'promotion',
        discount: promotion.discount,
        promoCode: promotion.code
    };

    return await sendPromotionalEmail(recipientEmail, recipientName, emailData);
};

// ========================================
// 🔧 FONCTION DE TEST DE CONFIGURATION
// ========================================
export const testEmailConfiguration = async () => {
    try {
        console.log('🔧 Test de la configuration email...');
        
        // Vérifier la connexion
        await transporter.verify();
        
        console.log('✅ Configuration email valide');
        return { success: true, message: 'Configuration email valide' };
        
    } catch (error) {
        console.error('❌ Erreur configuration email:', error);
        return { success: false, error: error.message };
    }
};

export default {
    sendPromotionalEmail,
    sendWelcomeEmail,
    sendPromotionEmail,
    testEmailConfiguration
};