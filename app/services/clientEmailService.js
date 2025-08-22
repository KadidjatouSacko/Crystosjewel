// ===================================================
// SERVICE EMAIL POUR GESTION CLIENTS
// ===================================================

import nodemailer from 'nodemailer';

// ✅ Configuration du transporteur (utilisez vos variables d'environnement)
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: process.env.MAIL_PORT == 465,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// ===================================================
// TEMPLATES D'EMAILS POUR CLIENTS
// ===================================================

// 📧 Email de bienvenue pour nouveau client
export const sendWelcomeEmail = async (clientEmail, clientName) => {
    try {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bienvenue chez CrystosJewel</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #d89ab3 0%, #b5869e 100%); color: white; padding: 25px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">✨ Bienvenue chez CrystosJewel !</h1>
                        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Votre compte a été créé avec succès</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px;">
                        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Bonjour ${clientName} 👋</h2>
                        
                        <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                            Nous sommes ravis de vous accueillir dans notre univers de bijoux d'exception. 
                            Votre compte administrateur a été créé et vous pouvez maintenant explorer notre collection.
                        </p>
                        
                        <div style="background: #f8fafc; border-left: 4px solid #d89ab3; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">🎁 Avantages de votre compte :</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #374151;">
                                <li>Suivi de vos commandes en temps réel</li>
                                <li>Historique de vos achats</li>
                                <li>Offres exclusives et avant-premières</li>
                                <li>Programme de fidélité</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.BASE_URL || 'https://crystosjewel.com'}" 
                               style="display: inline-block; background: #d89ab3; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                🛍️ Découvrir notre collection
                            </a>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
                            Pour toute question : 
                            <a href="mailto:${process.env.MAIL_USER}" style="color: #d89ab3; text-decoration: none;">
                                ${process.env.MAIL_USER}
                            </a>
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
                        © 2025 CrystosJewel • Bijoux d'exception
                    </div>
                </div>
            </body>
            </html>
        `;

        const info = await transporter.sendMail({
            from: `"CrystosJewel ✨" <${process.env.MAIL_USER}>`,
            to: clientEmail,
            subject: '✨ Bienvenue chez CrystosJewel !',
            html: htmlContent
        });

        console.log('📧 Email de bienvenue envoyé:', info.response);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Erreur email bienvenue:', error);
        return { success: false, error: error.message };
    }
};

// 📧 Email personnalisé pour client
export const sendCustomEmail = async (clientEmail, clientName, subject, message, adminName = 'L\'équipe CrystosJewel') => {
    try {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${subject}</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 25px; text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 18px;">✨</span>
                            <span style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">CrystosJewel</span>
                        </div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 600;">${subject}</h1>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px;">
                        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px;">Bonjour ${clientName} 👋</h2>
                        
                        <div style="color: #374151; line-height: 1.6; margin-bottom: 25px; 
                                    white-space: pre-line; font-size: 15px; 
                                    background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                            ${message}
                        </div>
                        
                        <div style="margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #fef3f2 0%, #fef2f2 100%); 
                                    border-left: 4px solid #d89ab3; border-radius: 0 8px 8px 0;">
                            <p style="margin: 0; color: #374151; font-size: 14px;">
                                💬 <strong>Besoin d'aide ?</strong><br>
                                N'hésitez pas à nous contacter pour toute question ou assistance.
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="${process.env.BASE_URL || 'https://crystosjewel.com'}" 
                               style="display: inline-block; background: #d89ab3; color: white; padding: 12px 25px; 
                                      text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                                🏠 Retour au site
                            </a>
                        </div>
                        
                        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                            <p style="color: #6b7280; font-size: 13px; margin: 0;">
                                Cordialement,<br>
                                <strong style="color: #374151;">${adminName}</strong>
                            </p>
                        </div>
                        
                        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 25px;">
                            Contact : 
                            <a href="mailto:${process.env.MAIL_USER}" style="color: #d89ab3; text-decoration: none;">
                                ${process.env.MAIL_USER}
                            </a>
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 11px; color: #64748b;">
                        © 2025 CrystosJewel • Message envoyé depuis l'administration
                    </div>
                </div>
            </body>
            </html>
        `;

        const info = await transporter.sendMail({
            from: `"CrystosJewel Admin 💎" <${process.env.MAIL_USER}>`,
            to: clientEmail,
            subject: subject,
            html: htmlContent,
            replyTo: process.env.MAIL_USER
        });

        console.log('📧 Email personnalisé envoyé:', info.response);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Erreur email personnalisé:', error);
        return { success: false, error: error.message };
    }
};

// 📧 Email de relance pour client inactif
export const sendReactivationEmail = async (clientEmail, clientName, lastOrderDate = null) => {
    try {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Nous vous avons manqué !</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 25px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">💜 Nous vous avons manqué !</h1>
                        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Revenez découvrir nos nouveautés</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px;">
                        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Bonjour ${clientName} 💜</h2>
                        
                        <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                            Cela fait un moment que nous ne vous avons pas vu ! 
                            ${lastOrderDate ? `Votre dernière commande remonte au ${lastOrderDate}.` : ''}
                        </p>
                        
                        <p style="color: #374151; line-height: 1.6; margin-bottom: 25px;">
                            Nous avons ajouté de magnifiques nouveautés à notre collection et nous aimerions 
                            vous faire profiter d'une <strong>offre spéciale de retour</strong> !
                        </p>
                        
                        <div style="background: linear-gradient(135deg, #fef3f2 0%, #fff1f2 100%); 
                                    border: 2px solid #d89ab3; padding: 25px; margin: 25px 0; border-radius: 12px; text-align: center;">
                            <h3 style="margin: 0 0 15px 0; color: #be185d; font-size: 18px;">🎁 OFFRE SPÉCIALE</h3>
                            <p style="margin: 0 0 15px 0; color: #374151; font-size: 16px; font-weight: 600;">
                                <span style="background: #be185d; color: white; padding: 8px 16px; border-radius: 20px;">
                                    -15% sur votre prochaine commande
                                </span>
                            </p>
                            <p style="margin: 0; color: #6b7280; font-size: 13px;">
                                Code : <strong>RETOUR15</strong> • Valable 30 jours
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.BASE_URL || 'https://crystosjewel.com'}/bijoux" 
                               style="display: inline-block; background: #be185d; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                💎 Découvrir les nouveautés
                            </a>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
                            Nous avons hâte de vous retrouver !<br>
                            L'équipe CrystosJewel ✨
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
                        © 2025 CrystosJewel • Si vous ne souhaitez plus recevoir ces emails, 
                        <a href="#" style="color: #6b7280;">cliquez ici</a>
                    </div>
                </div>
            </body>
            </html>
        `;

        const info = await transporter.sendMail({
            from: `"CrystosJewel 💜" <${process.env.MAIL_USER}>`,
            to: clientEmail,
            subject: '💜 Nous vous avons manqué ! Offre spéciale de retour',
            html: htmlContent
        });

        console.log('📧 Email de relance envoyé:', info.response);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Erreur email relance:', error);
        return { success: false, error: error.message };
    }
};

// ===================================================
// FONCTION PRINCIPALE D'ENVOI D'EMAIL
// ===================================================

export const sendClientEmail = async (emailType, clientData, customData = {}) => {
    try {
        console.log(`📧 Envoi email type "${emailType}" à ${clientData.email}`);
        
        let result;
        
        switch (emailType) {
            case 'welcome':
                result = await sendWelcomeEmail(clientData.email, clientData.name);
                break;
                
            case 'custom':
                result = await sendCustomEmail(
                    clientData.email, 
                    clientData.name, 
                    customData.subject, 
                    customData.message,
                    customData.adminName
                );
                break;
                
            case 'reactivation':
                result = await sendReactivationEmail(
                    clientData.email, 
                    clientData.name, 
                    customData.lastOrderDate
                );
                break;
                
            default:
                throw new Error(`Type d'email non reconnu: ${emailType}`);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Erreur dans sendClientEmail:', error);
        return { success: false, error: error.message };
    }
};

export default {
    sendWelcomeEmail,
    sendCustomEmail,
    sendReactivationEmail,
    sendClientEmail
};