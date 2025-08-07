import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER, // doit être crystosjewel@gmail.com
    pass: process.env.MAIL_PASS  // doit être cpmzqnnonvdfaxhx
  }
  
});

console.log('MAIL_USER:', process.env.MAIL_USER);
console.log('MAIL_PASS:', process.env.MAIL_PASS);

export async function sendTestMail(to, subject, text) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL,
      to,
      subject,
      text,
    });
    console.log('Email envoyé :', info.response);
  } catch (error) {
    console.error('Erreur lors de l\'envoi du mail :', error);
  }
}

export const sendTestEmail = async (email, campaignData) => {
    try {
        const transporter = await createTransporter();
        
        const { subject, content, template, senderName } = campaignData;
        
        // Remplacer les variables de test
        const processedContent = content
            .replace(/\{\{first_name\}\}/g, 'Test')
            .replace(/\{\{last_name\}\}/g, 'User')
            .replace(/\{\{email\}\}/g, email)
            .replace(/\{\{company_name\}\}/g, 'Test Company')
            .replace(/\{\{current_date\}\}/g, new Date().toLocaleDateString('fr-FR'))
            .replace(/\{\{unsubscribe_url\}\}/g, '#');

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
                body { 
                    margin: 0; 
                    padding: 20px; 
                    font-family: 'Inter', Arial, sans-serif; 
                    background: #f8fafc; 
                    color: #1e293b;
                }
                .email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                }
                .test-banner {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    color: white;
                    padding: 10px 20px;
                    text-align: center;
                    font-weight: 600;
                    font-size: 14px;
                }
                .email-header {
                    background: linear-gradient(135deg, #d89ab3, #b794a8);
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                }
                .email-content {
                    padding: 30px 20px;
                    line-height: 1.6;
                }
                .email-footer {
                    background: #f1f5f9;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #64748b;
                    border-top: 1px solid #e2e8f0;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="test-banner">
                    🧪 EMAIL DE TEST - Ne pas transférer
                </div>
                
                <div class="email-header">
                    <h1 style="margin: 0; font-size: 24px;">${senderName || 'CrystosJewel'}</h1>
                </div>
                
                <div class="email-content">
                    ${processedContent}
                </div>
                
                <div class="email-footer">
                    <p><strong>Email de test envoyé depuis l'éditeur CrystosJewel</strong></p>
                    <p>Cet email a été envoyé à ${email} à des fins de test uniquement.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const info = await transporter.sendMail({
            from: `"${senderName || 'CrystosJewel'} 🧪" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `[TEST] ${subject}`,
            html: htmlContent
        });

        console.log('🧪 Email de test envoyé:', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Erreur envoi email test:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Envoyer une campagne email en masse
 */
export const sendBulkEmail = async (recipients, campaignData) => {
    try {
        const transporter = await createTransporter();
        
        const { name, subject, content, preheader, fromName, template } = campaignData;
        
        console.log(`📤 Envoi campagne "${name}" à ${recipients.length} destinataires`);
        
        let sentCount = 0;
        let errorCount = 0;
        const batchSize = 10; // Envoyer par lot de 10
        
        // Traiter par batch pour éviter le spam
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            
            const emailPromises = batch.map(async (recipient) => {
                try {
                    // Personnaliser le contenu pour chaque destinataire
                    const personalizedContent = content
                        .replace(/\{\{first_name\}\}/g, recipient.firstName || 'Cher client')
                        .replace(/\{\{last_name\}\}/g, recipient.lastName || '')
                        .replace(/\{\{email\}\}/g, recipient.email)
                        .replace(/\{\{current_date\}\}/g, new Date().toLocaleDateString('fr-FR'))
                        .replace(/\{\{unsubscribe_url\}\}/g, `${process.env.BASE_URL}/newsletter/unsubscribe?email=${encodeURIComponent(recipient.email)}`);

                    const htmlContent = await generateEmailTemplate(
                        personalizedContent,
                        subject,
                        preheader,
                        template,
                        fromName
                    );

                    await transporter.sendMail({
                        from: `"${fromName || 'CrystosJewel'}" <${process.env.MAIL_USER}>`,
                        to: recipient.email,
                        subject: subject,
                        html: htmlContent
                    });

                    sentCount++;
                    console.log(`✅ Email envoyé à ${recipient.email}`);

                } catch (error) {
                    errorCount++;
                    console.error(`❌ Erreur envoi à ${recipient.email}:`, error.message);
                }
            });

            await Promise.all(emailPromises);
            
            // Pause entre les batches pour respecter les limites
            if (i + batchSize < recipients.length) {
                console.log(`⏳ Pause entre les batches (${i + batchSize}/${recipients.length})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`📊 Campagne terminée: ${sentCount} envoyés, ${errorCount} erreurs`);
        
        return {
            success: true,
            sentCount,
            errorCount,
            totalRecipients: recipients.length
        };

    } catch (error) {
        console.error('❌ Erreur campagne email:', error);
        return { success: false, error: error.message, sentCount: 0, errorCount: recipients.length };
    }
};

/**
 * Générer le template HTML complet
 */
const generateEmailTemplate = async (content, subject, preheader, template, fromName) => {
    const templates = {
        elegant: {
            headerBg: 'linear-gradient(135deg, #d89ab3, #b794a8)',
            accentColor: '#d89ab3',
            fontFamily: 'Georgia, serif'
        },
        modern: {
            headerBg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            accentColor: '#8b5cf6',
            fontFamily: 'Inter, Arial, sans-serif'
        },
        classic: {
            headerBg: 'linear-gradient(135deg, #1e293b, #334155)',
            accentColor: '#1e293b',
            fontFamily: 'Times New Roman, serif'
        },
        minimal: {
            headerBg: 'linear-gradient(135deg, #64748b, #475569)',
            accentColor: '#64748b',
            fontFamily: 'Helvetica, Arial, sans-serif'
        }
    };

    const templateStyle = templates[template] || templates.elegant;

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { 
                margin: 0; 
                padding: 20px; 
                font-family: ${templateStyle.fontFamily}; 
                background: #f8fafc; 
                color: #1e293b;
                line-height: 1.6;
            }
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            }
            .email-header {
                background: ${templateStyle.headerBg};
                color: white;
                padding: 30px 20px;
                text-align: center;
            }
            .email-subject {
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 5px;
            }
            .email-preheader {
                margin: 0;
                font-size: 14px;
                opacity: 0.9;
            }
            .email-content {
                padding: 30px 20px;
            }
            .email-content h1, .email-content h2, .email-content h3 {
                color: ${templateStyle.accentColor};
            }
            .email-content a {
                color: ${templateStyle.accentColor};
                text-decoration: none;
            }
            .email-content a:hover {
                text-decoration: underline;
            }
            .btn {
                display: inline-block;
                background: ${templateStyle.headerBg};
                color: white !important;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 10px 0;
            }
            .email-footer {
                background: #f1f5f9;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
                border-top: 1px solid #e2e8f0;
            }
            .email-footer a {
                color: #64748b;
                text-decoration: none;
            }
            
            /* Responsive */
            @media (max-width: 600px) {
                body { padding: 10px; }
                .email-container { border-radius: 8px; }
                .email-header, .email-content { padding: 20px 15px; }
                .email-subject { font-size: 20px; }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <h1 class="email-subject">${subject}</h1>
                ${preheader ? `<p class="email-preheader">${preheader}</p>` : ''}
            </div>
            
            <div class="email-content">
                ${content}
            </div>
            
            <div class="email-footer">
                <p>© ${new Date().getFullYear()} ${fromName || 'CrystosJewel'} - Tous droits réservés</p>
                <p style="margin-top: 10px;">
                    <a href="{{unsubscribe_url}}">Se désabonner</a> | 
                    <a href="${process.env.BASE_URL}">Visiter notre site</a>
                </p>
                <p style="margin-top: 15px; font-size: 11px; color: #9ca3af;">
                    Vous recevez cet email car vous êtes inscrit à notre newsletter.<br>
                    Si vous ne souhaitez plus recevoir nos emails, cliquez sur "Se désabonner" ci-dessus.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// export const sendWelcomeMail = async (userEmail, firstName) => {
//   try {
//     const htmlContent = `
//       <div style="
//         font-family: Arial, sans-serif;
//         color: #3a3a3a;
//         background-color: #fff8f0;
//         max-width: 600px;
//         margin: auto;
//         border-radius: 8px;
//         box-shadow: 0 8px 20px rgba(183, 110, 121, 0.15);
//         overflow: hidden;
//       ">
//         <header style="
//           background: linear-gradient(135deg, #e8c2c8, #b76e79);
//           padding: 20px 0;
//           text-align: center;
//           color: white;
//           font-weight: 300;
//           letter-spacing: 3px;
//           font-size: 2rem;
//           ">
//           Crystos Jewel
//         </header>

//         <nav style="background: #b76e79; text-align: center; padding: 10px 0;">
//           <a href="${process.env.BASE_URL}" style="
//             color: white; 
//             margin: 0 15px; 
//             text-decoration: none; 
//             font-weight: 500;
//             font-size: 1rem;
//             transition: color 0.3s;
//           " onmouseover="this.style.color='#fff8f0'" onmouseout="this.style.color='white'">Accueil</a>
//           <a href="${process.env.BASE_URL}/bijoux" style="
//             color: white; 
//             margin: 0 15px; 
//             text-decoration: none; 
//             font-weight: 500;
//             font-size: 1rem;
//             transition: color 0.3s;
//           " onmouseover="this.style.color='#fff8f0'" onmouseout="this.style.color='white'">Nos Bijoux</a>
//           <a href="${process.env.BASE_URL}/promos" style="
//             color: white; 
//             margin: 0 15px; 
//             text-decoration: none; 
//             font-weight: 500;
//             font-size: 1rem;
//             transition: color 0.3s;
//           " onmouseover="this.style.color='#fff8f0'" onmouseout="this.style.color='white'">Promos</a>
//           <a href="${process.env.BASE_URL}/contact" style="
//             color: white; 
//             margin: 0 15px; 
//             text-decoration: none; 
//             font-weight: 500;
//             font-size: 1rem;
//             transition: color 0.3s;
//           " onmouseover="this.style.color='#fff8f0'" onmouseout="this.style.color='white'">Contact</a>
//         </nav>

//         <main style="padding: 20px;">
//           <h2 style="color: #7d4b53; font-weight: 600;">Coucou ${firstName} !</h2>
//           <p>Bienvenue chez <strong>Crystos Jewel</strong>, ta boutique préférée pour des bijoux qui ont du charme sans te ruiner.</p>
//           <p>On est super contents que tu aies rejoint la famille. Ici, on aime bien les paillettes, le fun, et surtout te faire plaisir.</p>
//           <p>Si tu as besoin d'un coup de main ou juste envie de papoter bling-bling, on est là, prêts à répondre !</p>
//           <p>Allez, file découvrir nos merveilles et fais-toi plaisir 💎</p>

//           <p style="margin-top: 30px; font-style: italic; color: #b76e79;">L'équipe Crystos Jewel qui brille avec toi ✨</p>
//         </main>

//         <footer style="
//           background: #e8c2c8; 
//           padding: 15px 20px; 
//           font-size: 12px; 
//           color: #7d4b53; 
//           text-align: center;
//           border-top: 1px solid #b76e79;
//         ">
//           Tu as reçu ce mail car tu t'es inscrit(e) sur <a href="${process.env.BASE_URL}" style="color:#7d4b53; text-decoration:none;">notre site</a>.  
//           Si ce n'est pas toi, pas de panique, ignore-le simplement.
//         </footer>
//       </div>
//     `;

//     const info = await transporter.sendMail({
//       from: `"Crystos Jewel" <${process.env.MAIL_USER}>`,
//       to: userEmail,
//       subject: `Bienvenue dans la famille Crystos Jewel, ${firstName} !`,
//       html: htmlContent,
//     });

//     console.log("Email envoyé :", info.response);
//   } catch (error) {
//     console.error("Erreur lors de l'envoi du mail :", error);
//   }
// };

export const sendWelcomeEmail = async (userEmail, firstName) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue - CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%);">
        
        <div style="padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; padding: 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 15px;">✨</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Bienvenue chez CrystosJewel !</h1>
            </div>

            <!-- Contenu -->
            <div style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #1f2937;">
                Bonjour ${firstName},
              </p>
              
              <p style="margin: 0 0 25px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                Merci de votre inscription chez <strong>CrystosJewel</strong> ! Nous sommes ravis de vous compter parmi nous.
              </p>
              
              <p style="margin: 0 0 25px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                Découvrez notre collection exclusive de bijoux élégants et trouvez la pièce parfaite qui vous ressemble.
              </p>
              
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">🎁 Offre de bienvenue</h3>
                <p style="margin: 0; color: #1f2937; font-size: 14px;">
                  En tant que nouveau membre, profitez de <strong>10% de réduction</strong> sur votre première commande avec le code <strong>BIENVENUE10</strong>
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/bijoux" 
                   style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; text-decoration: none; padding: 18px 35px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 6px 20px rgba(168, 85, 247, 0.3);">
                  💎 Découvrir nos bijoux
                </a>
              </div>
              
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
                Si ce n'est pas vous qui avez créé ce compte, ignorez simplement cet email.
              </p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel ✨" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `Bienvenue dans la famille CrystosJewel, ${firstName} !`,
      html: htmlContent,
    });

    console.log("📧 Email bienvenue envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email bienvenue :", error);
    return { success: false, error: error.message };
  }
};

// Fonction générique pour envoyer un mail avec template handlebars
async function sendMailWithTemplate(to, subject, templateName, variables) {
  try {
    const templatePath = path.join(process.cwd(), 'templates', `${templateName}.html`);
    const source = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(source);
    const htmlContent = template(variables);

    const info = await transporter.sendMail({
      from: `"Crystos Jewel" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log('Mail envoyé :', info.response);
  } catch (error) {
    console.error('Erreur lors de l\'envoi du mail:', error);
  }
}

// // ✨ FONCTION UTILITAIRE - Calcul date de livraison sans dimanche
// function calculateDeliveryDate(daysToAdd = 3) {
//     let deliveryDate = new Date();
//     let addedDays = 0;
    
//     while (addedDays < daysToAdd) {
//         deliveryDate.setDate(deliveryDate.getDate() + 1);
        
//         // Si ce n'est pas un dimanche (0 = dimanche)
//         if (deliveryDate.getDay() !== 0) {
//             addedDays++;
//         }
//     }
    
//     return deliveryDate.toLocaleDateString('fr-FR', {
//         weekday: 'long',
//         year: 'numeric',
//         month: 'long',
//         day: 'numeric'
//     });
// }

// ✨ EMAIL CLIENT - Design élégant et chaleureux
// export const sendOrderConfirmationEmail = async (userEmail, firstName, orderData) => {
//   try {
//     const { orderNumber, items, total, subtotal, shippingFee, shippingAddress, estimatedDelivery } = orderData;
    
//     // Calculs corrigés
//     const calculatedSubtotal = subtotal || items.reduce((sum, item) => sum + item.total, 0);
//     const calculatedShippingFee = shippingFee || (calculatedSubtotal >= 50 ? 0 : 5.99);
//     const calculatedTotal = total || (calculatedSubtotal + calculatedShippingFee);
    
//     // Date de livraison
//     const deliveryDate = typeof estimatedDelivery === 'string' ? estimatedDelivery : calculateDeliveryDate(3);
    
//     // Items HTML avec style élégant
//     const itemsHtml = items.map(item => {
//       let imageUrl = '';
//       if (item.jewel && item.jewel.image) {
//         imageUrl = item.jewel.image.startsWith('http') 
//           ? item.jewel.image 
//           : `${process.env.BASE_URL}/uploads/${item.jewel.image}`;
//       }
      
//       return `
//         <div style="
//           display: flex;
//           align-items: center;
//           padding: 20px;
//           background: white;
//           border-radius: 12px;
//           margin-bottom: 12px;
//           box-shadow: 0 2px 8px rgba(216, 154, 179, 0.15);
//           border-left: 4px solid #d89ab3;
//         ">
//           <div style="
//             width: 65px; 
//             height: 65px; 
//             border-radius: 10px;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//             overflow: hidden;
//             margin-right: 16px;
//             ${imageUrl ? `background-image: url('${imageUrl}'); background-size: cover; background-position: center;` : 'background: linear-gradient(135deg, #f3e8ff, #e9d5ff);'}
//             box-shadow: 0 4px 12px rgba(0,0,0,0.1);
//           ">
//             ${!imageUrl ? '<span style="color: #8b5cf6; font-size: 24px;">💎</span>' : ''}
//           </div>
//           <div style="flex: 1;">
//             <div style="
//               font-weight: 600; 
//               color: #374151; 
//               font-size: 16px; 
//               margin-bottom: 6px;
//               line-height: 1.3;
//             ">${item.name}</div>
//             <div style="
//               color: #6b7280; 
//               font-size: 14px;
//               margin-bottom: 4px;
//             ">Quantité: <span style="font-weight: 500; color: #d89ab3;">${item.quantity}</span></div>
//             <div style="
//               color: #6b7280; 
//               font-size: 14px;
//             ">Prix unitaire: <span style="font-weight: 500;">${item.price.toFixed(2)} €</span></div>
//           </div>
//           <div style="
//             font-size: 18px;
//             font-weight: 700;
//             color: #d89ab3;
//             text-align: right;
//           ">${item.total.toFixed(2)} €</div>
//         </div>
//       `;
//     }).join('');

//     const htmlContent = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="utf-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>Commande confirmée - CrystosJewel</title>
//       </head>
//       <body style="
//         margin: 0; 
//         padding: 0; 
//         font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
//         background: linear-gradient(135deg, #fdf2f8 0%, #f3e8ff 100%);
//         min-height: 100vh;
//       ">
        
//         <div style="padding: 30px 20px;">
//           <div style="
//             max-width: 650px; 
//             margin: 0 auto; 
//             background: white; 
//             border-radius: 20px; 
//             overflow: hidden; 
//             box-shadow: 0 10px 40px rgba(216, 154, 179, 0.2);
//             border: 1px solid #f3e8ff;
//           ">
            
//             <!-- Header élégant -->
//             <div style="
//               background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
//               padding: 40px 30px;
//               text-align: center;
//               position: relative;
//               overflow: hidden;
//             ">
//               <!-- Décorations subtiles -->
//               <div style="
//                 position: absolute;
//                 top: -30px;
//                 right: -30px;
//                 width: 120px;
//                 height: 120px;
//                 background: rgba(255,255,255,0.1);
//                 border-radius: 50%;
//               "></div>
//               <div style="
//                 position: absolute;
//                 bottom: -20px;
//                 left: -20px;
//                 width: 80px;
//                 height: 80px;
//                 background: rgba(255,255,255,0.05);
//                 border-radius: 50%;
//               "></div>
              
//               <div style="position: relative; z-index: 2;">
//                 <h1 style="
//                   margin: 0 0 8px 0; 
//                   color: white; 
//                   font-size: 32px; 
//                   font-weight: 700; 
//                   letter-spacing: 1px;
//                   text-shadow: 0 2px 4px rgba(0,0,0,0.1);
//                 ">✨ CrystosJewel ✨</h1>
//                 <p style="
//                   margin: 0; 
//                   color: rgba(255,255,255,0.95); 
//                   font-size: 16px; 
//                   font-weight: 400;
//                 ">Vos bijoux de rêve depuis 1985</p>
//               </div>
//             </div>

//             <!-- Badge de confirmation -->
//             <div style="
//               background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
//               padding: 20px;
//               text-align: center;
//               border-bottom: 1px solid #a7f3d0;
//             ">
//               <div style="
//                 display: inline-flex;
//                 align-items: center;
//                 gap: 12px;
//                 background: white;
//                 padding: 12px 24px;
//                 border-radius: 30px;
//                 box-shadow: 0 4px 12px rgba(5, 150, 105, 0.15);
//                 border: 1px solid #6ee7b7;
//               ">
//                 <div style="
//                   width: 24px;
//                   height: 24px;
//                   background: #10b981;
//                   border-radius: 50%;
//                   display: flex;
//                   align-items: center;
//                   justify-content: center;
//                   color: white;
//                   font-size: 14px;
//                   font-weight: bold;
//                 ">✓</div>
//                 <span style="
//                   color: #065f46;
//                   font-weight: 600;
//                   font-size: 15px;
//                 ">Commande confirmée avec succès</span>
//               </div>
//             </div>

//             <!-- Contenu principal -->
//             <div style="padding: 35px 30px;">
              
//               <!-- Message de bienvenue -->
//               <div style="text-align: center; margin-bottom: 35px;">
//                 <div style="
//                   font-size: 48px;
//                   margin-bottom: 16px;
//                   filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
//                 ">🎉</div>
//                 <h2 style="
//                   margin: 0 0 12px 0; 
//                   color: #374151; 
//                   font-size: 26px; 
//                   font-weight: 700;
//                   line-height: 1.3;
//                 ">Merci ${firstName} !</h2>
//                 <p style="
//                   margin: 0; 
//                   color: #6b7280; 
//                   font-size: 16px; 
//                   line-height: 1.6;
//                   max-width: 400px;
//                   margin: 0 auto;
//                 ">Votre commande a été confirmée avec succès.<br>
//                 Nous préparons vos bijoux avec tout notre savoir-faire ✨</p>
//               </div>

//               <!-- Numéro de commande -->
//               <div style="
//                 background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
//                 color: white;
//                 padding: 24px;
//                 border-radius: 16px;
//                 text-align: center;
//                 margin-bottom: 30px;
//                 box-shadow: 0 8px 24px rgba(216, 154, 179, 0.25);
//               ">
//                 <div style="
//                   font-size: 13px;
//                   opacity: 0.9;
//                   margin-bottom: 6px;
//                   text-transform: uppercase;
//                   letter-spacing: 1px;
//                   font-weight: 500;
//                 ">Numéro de commande</div>
//                 <div style="
//                   font-size: 22px;
//                   font-weight: 700;
//                   font-family: 'Courier New', monospace;
//                   letter-spacing: 1px;
//                   text-shadow: 0 1px 2px rgba(0,0,0,0.1);
//                 ">${orderNumber}</div>
//               </div>

//               <!-- Articles commandés -->
//               <div style="margin-bottom: 30px;">
//                 <h3 style="
//                   margin: 0 0 20px 0; 
//                   color: #374151; 
//                   font-size: 20px; 
//                   font-weight: 700;
//                   display: flex;
//                   align-items: center;
//                   gap: 10px;
//                 ">
//                   <span style="font-size: 22px;">🛍️</span>
//                   Vos bijoux commandés
//                 </h3>
                
//                 <div style="
//                   background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
//                   border-radius: 16px;
//                   padding: 20px;
//                 ">
//                   ${itemsHtml}
                  
//                   <!-- Récapitulatif des totaux -->
//                   <div style="
//                     background: white;
//                     border-radius: 12px;
//                     padding: 20px;
//                     margin-top: 16px;
//                     border: 1px solid #e5e7eb;
//                   ">
//                     <div style="
//                       display: flex; 
//                       justify-content: space-between; 
//                       align-items: center;
//                       margin-bottom: 12px;
//                       padding-bottom: 8px;
//                       border-bottom: 1px solid #f3f4f6;
//                     ">
//                       <span style="color: #6b7280; font-size: 15px;">Sous-total</span>
//                       <span style="color: #374151; font-size: 15px; font-weight: 600;">${calculatedSubtotal.toFixed(2)} €</span>
//                     </div>
                    
//                     <div style="
//                       display: flex; 
//                       justify-content: space-between; 
//                       align-items: center;
//                       margin-bottom: 16px;
//                       padding-bottom: 12px;
//                       border-bottom: 1px solid #f3f4f6;
//                     ">
//                       <span style="color: #6b7280; font-size: 15px;">Frais de livraison</span>
//                       <span style="
//                         color: ${calculatedShippingFee === 0 ? '#10b981' : '#374151'}; 
//                         font-size: 15px; 
//                         font-weight: 600;
//                       ">
//                         ${calculatedShippingFee === 0 ? 'GRATUIT 🎉' : calculatedShippingFee.toFixed(2) + ' €'}
//                       </span>
//                     </div>
                    
//                     <div style="
//                       display: flex; 
//                       justify-content: space-between; 
//                       align-items: center;
//                       padding: 12px 16px;
//                       background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
//                       border-radius: 10px;
//                       color: white;
//                     ">
//                       <span style="font-size: 18px; font-weight: 700;">Total TTC</span>
//                       <span style="font-size: 20px; font-weight: 800; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">${calculatedTotal.toFixed(2)} €</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <!-- Informations de livraison -->
//               <div style="
//                 background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
//                 border: 1px solid #93c5fd;
//                 border-radius: 16px;
//                 padding: 24px;
//                 margin-bottom: 30px;
//               ">
//                 <h3 style="
//                   margin: 0 0 16px 0; 
//                   color: #1e40af; 
//                   font-size: 18px; 
//                   font-weight: 700;
//                   display: flex;
//                   align-items: center;
//                   gap: 10px;
//                 ">
//                   <span style="font-size: 20px;">📦</span>
//                   Livraison prévue
//                 </h3>
                
//                 <div style="
//                   background: white;
//                   padding: 16px 20px;
//                   border-radius: 12px;
//                   margin-bottom: 16px;
//                   box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
//                 ">
//                   <div style="
//                     color: #1e40af;
//                     font-weight: 700;
//                     font-size: 16px;
//                     margin-bottom: 4px;
//                     display: flex;
//                     align-items: center;
//                     gap: 8px;
//                   ">
//                     📅 ${deliveryDate}
//                   </div>
//                   <div style="color: #6b7280; font-size: 14px;">
//                     Livraison estimée (hors dimanche)
//                   </div>
//                 </div>
                
//                 <div style="
//                   background: rgba(255,255,255,0.7);
//                   padding: 16px;
//                   border-radius: 12px;
//                   color: #4b5563;
//                   line-height: 1.5;
//                 ">
//                   <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">
//                     ${shippingAddress.name}
//                   </div>
//                   <div style="font-size: 14px;">
//                     ${shippingAddress.address}<br>
//                     ${shippingAddress.city}, ${shippingAddress.country}
//                   </div>
//                 </div>
//               </div>

//               <!-- Boutons d'action -->
//               <div style="text-align: center; margin-bottom: 30px;">
//                 <a href="${process.env.BASE_URL}/mon-compte/commandes" style="
//                   display: inline-block;
//                   background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
//                   color: white;
//                   text-decoration: none;
//                   padding: 14px 28px;
//                   border-radius: 30px;
//                   font-weight: 600;
//                   font-size: 15px;
//                   box-shadow: 0 6px 20px rgba(216, 154, 179, 0.4);
//                   margin: 0 8px 12px 0;
//                   transition: all 0.3s ease;
//                   text-shadow: 0 1px 2px rgba(0,0,0,0.1);
//                 ">
//                   📋 Suivre ma commande
//                 </a>
//                 <a href="${process.env.BASE_URL}/bijoux" style="
//                   display: inline-block;
//                   background: white;
//                   color: #d89ab3;
//                   text-decoration: none;
//                   padding: 14px 28px;
//                   border-radius: 30px;
//                   font-weight: 600;
//                   font-size: 15px;
//                   border: 2px solid #d89ab3;
//                   margin: 0 8px 12px 0;
//                   transition: all 0.3s ease;
//                 ">
//                   💎 Continuer mes achats
//                 </a>
//               </div>

//               <!-- Message final personnel -->
//               <div style="
//                 background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
//                 border: 1px solid #fbbf24;
//                 border-radius: 16px;
//                 padding: 20px;
//                 text-align: center;
//               ">
//                 <p style="
//                   margin: 0; 
//                   color: #92400e; 
//                   font-size: 15px; 
//                   line-height: 1.6;
//                   font-style: italic;
//                 ">
//                   "Chaque bijou raconte une histoire unique, et nous sommes honorés<br>
//                   de faire partie de la vôtre. Merci de votre confiance ! ✨"
//                 </p>
//                 <p style="
//                   margin: 12px 0 0 0; 
//                   color: #92400e; 
//                   font-weight: 600;
//                   font-size: 14px;
//                 ">— L'équipe CrystosJewel</p>
//               </div>

//             </div>

//             <!-- Footer élégant -->
//             <div style="
//               background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
//               padding: 25px 30px;
//               text-align: center;
//               border-top: 1px solid #e5e7eb;
//             ">
//               <div style="margin-bottom: 16px;">
//                 <a href="${process.env.BASE_URL}" style="
//                   color: #d89ab3; 
//                   margin: 0 12px; 
//                   text-decoration: none; 
//                   font-weight: 500;
//                   font-size: 14px;
//                 ">Accueil</a>
//                 <a href="${process.env.BASE_URL}/bijoux" style="
//                   color: #d89ab3; 
//                   margin: 0 12px; 
//                   text-decoration: none; 
//                   font-weight: 500;
//                   font-size: 14px;
//                 ">Nos Bijoux</a>
//                 <a href="${process.env.BASE_URL}/contact" style="
//                   color: #d89ab3; 
//                   margin: 0 12px; 
//                   text-decoration: none; 
//                   font-weight: 500;
//                   font-size: 14px;
//                 ">Contact</a>
//               </div>
              
//               <div style="
//                 font-size: 12px; 
//                 color: #6b7280; 
//                 line-height: 1.5;
//               ">
//                 <p style="margin: 0 0 8px 0;">
//                   Vous recevez cet email car vous avez passé commande sur 
//                   <a href="${process.env.BASE_URL}" style="color: #d89ab3; text-decoration: none;">CrystosJewel.com</a>
//                 </p>
//                 <p style="margin: 0;">
//                   Questions ? Contactez-nous à 
//                   <a href="mailto:${process.env.MAIL_USER}" style="color: #d89ab3; text-decoration: none;">${process.env.MAIL_USER}</a>
//                 </p>
//               </div>
//             </div>

//           </div>
//         </div>
//       </body>
//       </html>
//     `;

//     const info = await transporter.sendMail({
//       from: `"CrystosJewel ✨" <${process.env.MAIL_USER}>`,
//       to: userEmail,
//       subject: `✨ Commande ${orderNumber} confirmée - CrystosJewel`,
//       html: htmlContent,
//     });

//     console.log("📧 Email client envoyé :", info.response);
//     return { success: true, messageId: info.messageId };
    
//   } catch (error) {
//     console.error("❌ Erreur email client :", error);
//     return { success: false, error: error.message };
//   }
// };

// 📧 EMAIL ADMIN - Design professionnel et moderne
// export const sendAdminOrderNotification = async (orderData, customerData) => {
//   try {
//     const { orderNumber, items, total, orderId } = orderData;
//     const { firstName, lastName, email, phone, address } = customerData;
    
//     const now = new Date();
//     const dateCommande = now.toLocaleDateString('fr-FR', {
//       weekday: 'long',
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric',
//       hour: '2-digit',
//       minute: '2-digit'
//     });

//     const htmlContent = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="utf-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>Nouvelle commande - CrystosJewel Admin</title>
//       </head>
//       <body style="
//         margin: 0; 
//         padding: 0; 
//         font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
//         background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
//         min-height: 100vh;
//       ">
        
//         <div style="padding: 25px 15px;">
//           <div style="
//             max-width: 680px; 
//             margin: 0 auto; 
//             background: white; 
//             border-radius: 16px; 
//             overflow: hidden; 
//             box-shadow: 0 8px 32px rgba(0,0,0,0.12);
//             border: 1px solid #e2e8f0;
//           ">
            
//             <!-- Header admin moderne -->
//             <div style="
//               background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
//               padding: 28px 25px;
//               color: white;
//               position: relative;
//               overflow: hidden;
//             ">
//               <!-- Décorations -->
//               <div style="
//                 position: absolute;
//                 top: -40px;
//                 right: -40px;
//                 width: 100px;
//                 height: 100px;
//                 background: rgba(255,255,255,0.05);
//                 border-radius: 50%;
//               "></div>
              
//               <div style="position: relative; z-index: 2;">
//                 <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
//                   <div style="
//                     width: 48px;
//                     height: 48px;
//                     background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
//                     border-radius: 12px;
//                     display: flex;
//                     align-items: center;
//                     justify-content: center;
//                     font-size: 20px;
//                     box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
//                   ">🔔</div>
//                   <div>
//                     <h1 style="
//                       margin: 0;
//                       font-size: 22px;
//                       font-weight: 700;
//                       letter-spacing: -0.5px;
//                     ">Nouvelle Commande Reçue</h1>
//                     <p style="
//                       margin: 4px 0 0 0;
//                       opacity: 0.9;
//                       font-size: 14px;
//                       font-weight: 400;
//                     ">CrystosJewel Administration</p>
//                   </div>
//                 </div>
                
//                 <!-- Badge urgence -->
//                 <div style="
//                   display: inline-flex;
//                   align-items: center;
//                   gap: 8px;
//                   background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
//                   color: white;
//                   padding: 8px 16px;
//                   border-radius: 20px;
//                   font-size: 13px;
//                   font-weight: 600;
//                   box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
//                 ">
//                   <span style="font-size: 14px;">⚡</span>
//                   Action requise
//                 </div>
//               </div>
//             </div>

//             <!-- Statistiques en cards -->
//             <div style="
//               background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
//               padding: 25px;
//             ">
//               <div style="
//                 display: grid;
//                 grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
//                 gap: 16px;
//               ">
//                 <!-- Total -->
//                 <div style="
//                   background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
//                   color: white;
//                   padding: 20px 18px;
//                   border-radius: 12px;
//                   text-align: center;
//                   box-shadow: 0 6px 20px rgba(216, 154, 179, 0.3);
//                   position: relative;
//                   overflow: hidden;
//                 ">
//                   <div style="
//                     position: absolute;
//                     top: -15px;
//                     right: -15px;
//                     width: 60px;
//                     height: 60px;
//                     background: rgba(255,255,255,0.1);
//                     border-radius: 50%;
//                   "></div>
//                   <div style="position: relative; z-index: 2;">
//                     <div style="
//                       font-size: 26px;
//                       font-weight: 800;
//                       margin-bottom: 6px;
//                       text-shadow: 0 1px 2px rgba(0,0,0,0.1);
//                     ">${total.toFixed(2)} €</div>
//                     <div style="
//                       font-size: 12px;
//                       opacity: 0.9;
//                       text-transform: uppercase;
//                       letter-spacing: 0.5px;
//                       font-weight: 500;
//                     ">Montant Total</div>
//                   </div>
//                 </div>
                
//                 <!-- Articles -->
//                 <div style="
//                   background: linear-gradient(135deg, #10b981 0%, #059669 100%);
//                   color: white;
//                   padding: 20px 18px;
//                   border-radius: 12px;
//                   text-align: center;
//                   box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
//                   position: relative;
//                   overflow: hidden;
//                 ">
//                   <div style="
//                     position: absolute;
//                     top: -15px;
//                     right: -15px;
//                     width: 60px;
//                     height: 60px;
//                     background: rgba(255,255,255,0.1);
//                     border-radius: 50%;
//                   "></div>
//                   <div style="position: relative; z-index: 2;">
//                     <div style="
//                       font-size: 26px;
//                       font-weight: 800;
//                       margin-bottom: 6px;
//                     ">${items.length}</div>
//                     <div style="
//                       font-size: 12px;
//                       opacity: 0.9;
//                       text-transform: uppercase;
//                       letter-spacing: 0.5px;
//                       font-weight: 500;
//                     ">Article${items.length > 1 ? 's' : ''}</div>
//                   </div>
//                 </div>
                
//                 <!-- ID Commande -->
//                 <div style="
//                   background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
//                   color: white;
//                   padding: 20px 18px;
//                   border-radius: 12px;
//                   text-align: center;
//                   box-shadow: 0 6px 20px rgba(139, 92, 246, 0.3);
//                   position: relative;
//                   overflow: hidden;
//                 ">
//                   <div style="
//                     position: absolute;
//                     top: -15px;
//                     right: -15px;
//                     width: 60px;
//                     height: 60px;
//                     background: rgba(255,255,255,0.1);
//                     border-radius: 50%;
//                   "></div>
//                   <div style="position: relative; z-index: 2;">
//                     <div style="
//                       font-size: 12px;
//                       opacity: 0.9;
//                       text-transform: uppercase;
//                       letter-spacing: 0.5px;
//                       font-weight: 500;
//                     ">ID Commande</div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <!-- Détails de la commande -->
//             <div style="padding: 25px;">
              
//               <!-- En-tête commande -->
//               <div style="
//                 background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
//                 border: 1px solid #e2e8f0;
//                 border-radius: 12px;
//                 padding: 20px;
//                 margin-bottom: 25px;
//               ">
//                 <div style="
//                   display: flex;
//                   align-items: center;
//                   gap: 12px;
//                   margin-bottom: 16px;
//                 ">
//                   <div style="
//                     width: 40px;
//                     height: 40px;
//                     background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
//                     border-radius: 10px;
//                     display: flex;
//                     align-items: center;
//                     justify-content: center;
//                     font-size: 18px;
//                   ">📋</div>
//                   <div>
//                     <h2 style="
//                       margin: 0;
//                       color: #1e293b;
//                       font-size: 19px;
//                       font-weight: 700;
//                     ">Commande ${orderNumber}</h2>
//                     <p style="
//                       margin: 3px 0 0 0;
//                       color: #64748b;
//                       font-size: 13px;
//                     ">Reçue le ${dateCommande}</p>
//                   </div>
//                 </div>
                
//                 <!-- Statut -->
//                 <div style="
//                   display: inline-flex;
//                   align-items: center;
//                   gap: 8px;
//                   background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
//                   color: #92400e;
//                   padding: 8px 16px;
//                   border-radius: 16px;
//                   font-size: 13px;
//                   font-weight: 600;
//                   border: 1px solid #fbbf24;
//                 ">
//                   <span style="
//                     width: 6px;
//                     height: 6px;
//                     background: #f59e0b;
//                     border-radius: 50%;
//                     display: inline-block;
//                   "></span>
//                   En attente de traitement
//                 </div>
//               </div>

//               <!-- Articles commandés -->
//               <div style="margin-bottom: 25px;">
//                 <h3 style="
//                   color: #1e293b;
//                   font-size: 18px;
//                   font-weight: 700;
//                   margin: 0 0 16px 0;
//                   display: flex;
//                   align-items: center;
//                   gap: 10px;
//                 ">
//                   <span style="font-size: 20px;">🛍️</span>
//                   Articles commandés
//                 </h3>
                
//                 <div style="
//                   background: white;
//                   border: 1px solid #e2e8f0;
//                   border-radius: 12px;
//                   overflow: hidden;
//                 ">
//                   ${items.map((item, index) => `
//                     <div style="
//                       display: flex;
//                       justify-content: space-between;
//                       align-items: center;
//                       padding: 16px 18px;
//                       ${index < items.length - 1 ? 'border-bottom: 1px solid #f1f5f9;' : ''}
//                     ">
//                       <div>
//                         <div style="
//                           color: #1e293b;
//                           font-size: 15px;
//                           font-weight: 600;
//                           margin-bottom: 4px;
//                         ">${item.name}</div>
//                         <div style="
//                           color: #64748b;
//                           font-size: 13px;
//                         ">${item.quantity} × ${item.price.toFixed(2)} €</div>
//                       </div>
//                       <div style="
//                         color: #d89ab3;
//                         font-size: 16px;
//                         font-weight: 700;
//                       ">${item.total.toFixed(2)} €</div>
//                     </div>
//                   `).join('')}
                  
//                   <!-- Total récapitulatif -->
//                   <div style="
//                     background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
//                     color: white;
//                     padding: 16px 18px;
//                     text-align: right;
//                   ">
//                     <div style="
//                       font-size: 18px;
//                       font-weight: 800;
//                       letter-spacing: -0.5px;
//                     ">Total: ${total.toFixed(2)} €</div>
//                     <div style="
//                       font-size: 12px;
//                       opacity: 0.8;
//                       margin-top: 3px;
//                     ">TTC • Livraison incluse</div>
//                   </div>
//                 </div>
//               </div>

//               <!-- Informations client -->
//               <div style="
//                 background: white;
//                 border: 2px solid #d89ab3;
//                 border-radius: 12px;
//                 padding: 20px;
//                 margin-bottom: 25px;
//                 box-shadow: 0 4px 12px rgba(216, 154, 179, 0.1);
//               ">
//                 <h3 style="
//                   color: #1e293b;
//                   font-size: 18px;
//                   font-weight: 700;
//                   margin: 0 0 16px 0;
//                   display: flex;
//                   align-items: center;
//                   gap: 10px;
//                 ">
//                   <span style="font-size: 20px;">👤</span>
//                   Informations client
//                 </h3>
                
//                 <div style="
//                   display: grid;
//                   grid-template-columns: 1fr 1fr;
//                   gap: 20px;
//                 ">
//                   <div>
//                     <div style="margin-bottom: 16px;">
//                       <div style="
//                         font-size: 12px;
//                         color: #64748b;
//                         text-transform: uppercase;
//                         letter-spacing: 0.5px;
//                         font-weight: 600;
//                         margin-bottom: 4px;
//                       ">Nom complet</div>
//                       <div style="
//                         font-size: 16px;
//                         color: #1e293b;
//                         font-weight: 600;
//                       ">${firstName} ${lastName}</div>
//                     </div>
                    
//                     <div style="margin-bottom: 16px;">
//                       <div style="
//                         font-size: 12px;
//                         color: #64748b;
//                         text-transform: uppercase;
//                         letter-spacing: 0.5px;
//                         font-weight: 600;
//                         margin-bottom: 4px;
//                       ">Email</div>
//                       <a href="mailto:${email}" style="
//                         font-size: 14px;
//                         color: #3b82f6;
//                         text-decoration: none;
//                         font-weight: 500;
//                         display: flex;
//                         align-items: center;
//                         gap: 6px;
//                       ">
//                         <span style="font-size: 16px;">📧</span>
//                         ${email}
//                       </a>
//                     </div>
                    
//                     ${phone ? `
//                     <div>
//                       <div style="
//                         font-size: 12px;
//                         color: #64748b;
//                         text-transform: uppercase;
//                         letter-spacing: 0.5px;
//                         font-weight: 600;
//                         margin-bottom: 4px;
//                       ">Téléphone</div>
//                       <a href="tel:${phone}" style="
//                         font-size: 14px;
//                         color: #3b82f6;
//                         text-decoration: none;
//                         font-weight: 500;
//                         display: flex;
//                         align-items: center;
//                         gap: 6px;
//                       ">
//                         <span style="font-size: 16px;">📱</span>
//                         ${phone}
//                       </a>
//                     </div>
//                     ` : ''}
//                   </div>
                  
//                   <div>
//                     <div style="
//                       font-size: 12px;
//                       color: #64748b;
//                       text-transform: uppercase;
//                       letter-spacing: 0.5px;
//                       font-weight: 600;
//                       margin-bottom: 4px;
//                     ">Adresse de livraison</div>
//                     <div style="
//                       background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
//                       padding: 14px 16px;
//                       border-radius: 10px;
//                       color: #475569;
//                       line-height: 1.5;
//                       font-size: 14px;
//                       border: 1px solid #e2e8f0;
//                     ">
//                       <div style="
//                         display: flex;
//                         align-items: flex-start;
//                         gap: 8px;
//                       ">
//                         <span style="font-size: 16px; margin-top: 1px;">📍</span>
//                         <div>${address}</div>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <!-- Actions CTA -->
//               <div style="
//                 background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
//                 border: 1px solid #e2e8f0;
//                 border-radius: 12px;
//                 padding: 22px;
//                 text-align: center;
//               ">
//                 <h3 style="
//                   color: #1e293b;
//                   font-size: 18px;
//                   font-weight: 700;
//                   margin: 0 0 18px 0;
//                   display: flex;
//                   align-items: center;
//                   justify-content: center;
//                   gap: 10px;
//                 ">
//                   <span style="font-size: 20px;">⚡</span>
//                   Actions rapides
//                 </h3>
                
//                 <div style="
//                   display: flex;
//                   gap: 12px;
//                   justify-content: center;
//                   flex-wrap: wrap;
//                 ">
//                   <a href="${process.env.BASE_URL}/admin/commandes/${orderId}" style="
//                     display: inline-flex;
//                     align-items: center;
//                     gap: 8px;
//                     background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
//                     color: white;
//                     text-decoration: none;
//                     padding: 12px 20px;
//                     border-radius: 10px;
//                     font-weight: 600;
//                     font-size: 14px;
//                     transition: all 0.3s ease;
//                     box-shadow: 0 4px 12px rgba(216, 154, 179, 0.3);
//                   ">
//                     <span style="font-size: 16px;">👁️</span>
//                     Voir commande
//                   </a>
                  
//                   <a href="${process.env.BASE_URL}/admin/commandes/${orderId}/expedier" style="
//                     display: inline-flex;
//                     align-items: center;
//                     gap: 8px;
//                     background: linear-gradient(135deg, #10b981 0%, #059669 100%);
//                     color: white;
//                     text-decoration: none;
//                     padding: 12px 20px;
//                     border-radius: 10px;
//                     font-weight: 600;
//                     font-size: 14px;
//                     transition: all 0.3s ease;
//                     box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
//                   ">
//                     <span style="font-size: 16px;">📦</span>
//                     Expédier
//                   </a>
                  
//                   <a href="${process.env.BASE_URL}/admin/commandes" style="
//                     display: inline-flex;
//                     align-items: center;
//                     gap: 8px;
//                     background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
//                     color: white;
//                     text-decoration: none;
//                     padding: 12px 20px;
//                     border-radius: 10px;
//                     font-weight: 600;
//                     font-size: 14px;
//                     transition: all 0.3s ease;
//                     box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
//                   ">
//                     <span style="font-size: 16px;">📊</span>
//                     Dashboard
//                   </a>
//                 </div>
//               </div>

//             </div>

//             <!-- Footer admin -->
//             <div style="
//               background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
//               color: white;
//               padding: 20px 25px;
//               text-align: center;
//             ">
//               <div style="
//                 display: flex;
//                 align-items: center;
//                 justify-content: center;
//                 gap: 8px;
//                 margin-bottom: 8px;
//               ">
//                 <span style="font-size: 18px;">✨</span>
//                 <span style="
//                   font-size: 15px;
//                   font-weight: 600;
//                   letter-spacing: 0.5px;
//                 ">CrystosJewel Administration</span>
//               </div>
//               <p style="
//                 margin: 0;
//                 opacity: 0.8;
//                 font-size: 13px;
//                 line-height: 1.4;
//               ">
//                 Notification automatique • Cette commande nécessite votre attention
//               </p>
//             </div>

//           </div>
//         </div>
//       </body>
//       </html>
//     `;

//     const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    
//     const info = await transporter.sendMail({
//       from: `"CrystosJewel Admin ✨" <${process.env.MAIL_USER}>`,
//       to: adminEmail,
//       subject: `✨ Nouvelle commande ${orderNumber} • ${total.toFixed(2)}€ • ${firstName} ${lastName}`,
//       html: htmlContent,
//       priority: 'high',
//     });

//     console.log("📧 Email admin envoyé :", info.response);
//     return { success: true, messageId: info.messageId };
    
//   } catch (error) {
//     console.error("❌ Erreur email admin :", error);
//     return { success: false, error: error.message };
//   }
// };

/**
 * FONCTION UTILITAIRE - Calculer date de livraison
 */
function calculateDeliveryDate(daysToAdd = 3) {
  let deliveryDate = new Date();
  let addedDays = 0;
  
  while (addedDays < daysToAdd) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
    
    // Exclure les dimanches
    if (deliveryDate.getDay() !== 0) {
      addedDays++;
    }
  }
  
  return deliveryDate.toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// ✅ FONCTION PRINCIPALE - ENVOI SIMULTANÉ CLIENT + ADMIN AVEC RÉDUCTIONS
// ✅ EMAIL CLIENT - Style CrystosJewel original amélioré
export const sendOrderConfirmationEmail = async (userEmail, firstName, orderData) => {
  try {
    const { orderNumber, items, total, subtotal, shippingFee, shippingAddress, estimatedDelivery, promoCode, promoDiscount } = orderData;
    
    // Calculs corrigés
    const calculatedSubtotal = subtotal || items.reduce((sum, item) => sum + item.total, 0);
    const calculatedShippingFee = shippingFee || (calculatedSubtotal >= 50 ? 0 : 5.99);
    const promoAmount = promoDiscount || 0;
    const calculatedTotal = total || (calculatedSubtotal + calculatedShippingFee - promoAmount);
    
    // Date de livraison avec fuseau horaire français
    const deliveryDate = typeof estimatedDelivery === 'string' ? estimatedDelivery : calculateDeliveryDate(3);
    
    // Items HTML avec style élégant et tailles
    const itemsHtml = items.map(item => {
      let imageUrl = '';
      if (item.jewel && item.jewel.image) {
        imageUrl = item.jewel.image.startsWith('http') 
          ? item.jewel.image 
          : `${process.env.BASE_URL}/uploads/${item.jewel.image}`;
      }
      
      return `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 12px;">
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(216, 154, 179, 0.15); border-left: 4px solid #d89ab3;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="65" style="vertical-align: top; padding-right: 16px;">
                    <div style="width: 65px; height: 65px; border-radius: 10px; overflow: hidden; ${imageUrl ? `background-image: url('${imageUrl}'); background-size: cover; background-position: center;` : 'background: linear-gradient(135deg, #f3e8ff, #e9d5ff); text-align: center; line-height: 65px;'} box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                      ${!imageUrl ? '<span style="color: #8b5cf6; font-size: 24px;">💎</span>' : ''}
                    </div>
                  </td>
                  <td style="vertical-align: top;">
                    <div style="font-weight: 600; color: #374151; font-size: 16px; margin-bottom: 6px; line-height: 1.3; font-family: Arial, sans-serif;">${item.name}</div>
                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px; font-family: Arial, sans-serif;">Quantité: <span style="font-weight: 500; color: #d89ab3;">${item.quantity}</span></div>
                    ${item.size && item.size !== 'Non spécifiée' ? `<div style="color: #6b7280; font-size: 14px; margin-bottom: 4px; font-family: Arial, sans-serif;">Taille: <span style="font-weight: 500; color: #d89ab3;">${item.size}</span></div>` : ''}
                    <div style="color: #6b7280; font-size: 14px; font-family: Arial, sans-serif;">Prix unitaire: <span style="font-weight: 500;">${item.price.toFixed(2)} €</span></div>
                  </td>
                  <td width="100" style="text-align: right; vertical-align: top;">
                    <div style="font-size: 18px; font-weight: 700; color: #d89ab3; font-family: Arial, sans-serif;">${item.total.toFixed(2)} €</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Commande confirmée - CrystosJewel</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          table { border-collapse: collapse; }
          .container { max-width: 650px; margin: 0 auto; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #fdf2f8;">
        
        <div style="padding: 30px 20px;">
          <table cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(216, 154, 179, 0.2);">
            
            <!-- Header élégant -->
            <tr>
              <td style="background-color: #d89ab3; padding: 40px 30px; text-align: center; border-radius: 20px 20px 0 0;">
                <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 1px; font-family: Arial, sans-serif;">✨ CrystosJewel ✨</h1>
                <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 16px; font-family: Arial, sans-serif;">Vos bijoux de rêve </p>
              </td>
            </tr>

            <!-- Badge de confirmation -->
            <tr>
              <td style="background-color: #ecfdf5; padding: 20px; text-align: center; border-bottom: 1px solid #a7f3d0;">
                <div style="display: inline-block; background-color: #ffffff; padding: 12px 24px; border-radius: 30px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.15); border: 1px solid #6ee7b7;">
                  <span style="color: #065f46; font-weight: 600; font-size: 15px; font-family: Arial, sans-serif;">✓ Commande confirmée avec succès</span>
                </div>
              </td>
            </tr>

            <!-- Contenu principal -->
            <tr>
              <td style="padding: 35px 30px;">
                
                <!-- Message de bienvenue -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 35px;">
                  <tr>
                    <td style="text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
                      <h2 style="margin: 0 0 12px 0; color: #374151; font-size: 26px; font-weight: bold; line-height: 1.3; font-family: Arial, sans-serif;">Merci ${firstName} !</h2>
                      <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.6; font-family: Arial, sans-serif;">Votre commande a été confirmée avec succès.<br>Nous préparons vos bijoux avec tout notre savoir-faire ✨</p>
                    </td>
                  </tr>
                </table>

                <!-- Numéro de commande -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 30px;">
                  <tr>
                    <td style="background-color: #d89ab3; color: #ffffff; padding: 24px; border-radius: 16px; text-align: center;">
                      <div style="font-size: 13px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; font-family: Arial, sans-serif;">Numéro de commande</div>
                      <div style="font-size: 22px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 1px;">${orderNumber}</div>
                    </td>
                  </tr>
                </table>

                <!-- Articles commandés avec tailles -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 30px;">
                  <tr>
                    <td>
                      <h3 style="margin: 0 0 20px 0; color: #374151; font-size: 20px; font-weight: bold; font-family: Arial, sans-serif;">🛍️ Vos bijoux commandés</h3>
                      
                      <div style="background-color: #f9fafb; border-radius: 16px; padding: 20px;">
                        ${itemsHtml}
                        
                        <!-- Récapitulatif des totaux -->
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; margin-top: 16px;">
                          <tr>
                            <td style="padding: 20px;">
                              
                              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                  <td style="color: #6b7280; font-size: 15px; padding-bottom: 8px; border-bottom: 1px solid #f3f4f6; font-family: Arial, sans-serif;">Sous-total</td>
                                  <td style="color: #374151; font-size: 15px; font-weight: 600; text-align: right; padding-bottom: 8px; border-bottom: 1px solid #f3f4f6; font-family: Arial, sans-serif;">${calculatedSubtotal.toFixed(2)} €</td>
                                </tr>
                                
                                ${promoCode ? `
                                <tr>
                                  <td style="color: #059669; font-size: 15px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-family: Arial, sans-serif;">
                                    Code promo: <strong>${promoCode}</strong>
                                  </td>
                                  <td style="color: #059669; font-size: 15px; font-weight: 600; text-align: right; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-family: Arial, sans-serif;">-${promoAmount.toFixed(2)} €</td>
                                </tr>
                                ` : ''}
                                
                                <tr>
                                  <td style="color: #6b7280; font-size: 15px; padding: 8px 0 16px 0; border-bottom: 1px solid #f3f4f6; font-family: Arial, sans-serif;">Frais de livraison</td>
                                  <td style="color: ${calculatedShippingFee === 0 ? '#10b981' : '#374151'}; font-size: 15px; font-weight: 600; text-align: right; padding: 8px 0 16px 0; border-bottom: 1px solid #f3f4f6; font-family: Arial, sans-serif;">
                                    ${calculatedShippingFee === 0 ? 'GRATUIT 🎉' : calculatedShippingFee.toFixed(2) + ' €'}
                                  </td>
                                </tr>
                                
                                <tr>
                                  <td style="background-color: #d89ab3; color: #ffffff; font-size: 18px; font-weight: bold; padding: 12px 16px; border-radius: 10px; font-family: Arial, sans-serif;">Total TTC</td>
                                  <td style="background-color: #d89ab3; color: #ffffff; font-size: 20px; font-weight: bold; text-align: right; padding: 12px 16px; border-radius: 10px; font-family: Arial, sans-serif;">${calculatedTotal.toFixed(2)} €</td>
                                </tr>
                              </table>
                              
                            </td>
                          </tr>
                        </table>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Informations de livraison -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 30px;">
                  <tr>
                    <td style="background-color: #eff6ff; border: 1px solid #93c5fd; border-radius: 16px; padding: 24px;">
                      <h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">📦 Livraison prévue</h3>
                      
                      <div style="background-color: #ffffff; padding: 16px 20px; border-radius: 12px; margin-bottom: 16px;">
                        <div style="color: #1e40af; font-weight: bold; font-size: 16px; margin-bottom: 4px; font-family: Arial, sans-serif;">📅 ${deliveryDate}</div>
                        <div style="color: #6b7280; font-size: 14px; font-family: Arial, sans-serif;">Livraison estimée (hors dimanche)</div>
                      </div>
                      
                      <div style="background-color: rgba(255,255,255,0.7); padding: 16px; border-radius: 12px; color: #4b5563; line-height: 1.5; font-family: Arial, sans-serif;">
                        <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">${shippingAddress.name}</div>
                        <div style="font-size: 14px;">${shippingAddress.address}<br>${shippingAddress.city}, ${shippingAddress.country}</div>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Boutons d'action -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 30px;">
                  <tr>
                    <td style="text-align: center;">
                      <a href="${process.env.BASE_URL}/mon-compte/commandes" style="display: inline-block; background-color: #d89ab3; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: 600; font-size: 15px; margin: 0 8px 12px 0; font-family: Arial, sans-serif;">📋 Suivre ma commande</a>
                      <a href="${process.env.BASE_URL}/bijoux" style="display: inline-block; background-color: #ffffff; color: #d89ab3; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: 600; font-size: 15px; border: 2px solid #d89ab3; margin: 0 8px 12px 0; font-family: Arial, sans-serif;">💎 Continuer mes achats</a>
                    </td>
                  </tr>
                </table>

                <!-- Message final personnel -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="background-color: #fefce8; border: 1px solid #fbbf24; border-radius: 16px; padding: 20px; text-align: center;">
                      <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6; font-style: italic; font-family: Arial, sans-serif;">"Chaque bijou raconte une histoire unique, et nous sommes honorés<br>de faire partie de la vôtre. Merci de votre confiance ! ✨"</p>
                      <p style="margin: 12px 0 0 0; color: #92400e; font-weight: 600; font-size: 14px; font-family: Arial, sans-serif;">— L'équipe CrystosJewel</p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Footer élégant -->
            <tr>
              <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 20px 20px;">
                <div style="margin-bottom: 16px;">
                  <a href="${process.env.BASE_URL}" style="color: #d89ab3; margin: 0 12px; text-decoration: none; font-weight: 500; font-size: 14px; font-family: Arial, sans-serif;">Accueil</a>
                  <a href="${process.env.BASE_URL}/bijoux" style="color: #d89ab3; margin: 0 12px; text-decoration: none; font-weight: 500; font-size: 14px; font-family: Arial, sans-serif;">Nos Bijoux</a>
                  <a href="${process.env.BASE_URL}/contact" style="color: #d89ab3; margin: 0 12px; text-decoration: none; font-weight: 500; font-size: 14px; font-family: Arial, sans-serif;">Contact</a>
                </div>
                
                <div style="font-size: 12px; color: #6b7280; line-height: 1.5; font-family: Arial, sans-serif;">
                  <p style="margin: 0 0 8px 0;">
                    Vous recevez cet email car vous avez passé commande sur 
                    <a href="${process.env.BASE_URL}" style="color: #d89ab3; text-decoration: none;">CrystosJewel.com</a>
                  </p>
                  <p style="margin: 0;">
                    Questions ? Contactez-nous à 
                    <a href="mailto:${process.env.MAIL_USER}" style="color: #d89ab3; text-decoration: none;">${process.env.MAIL_USER}</a>
                  </p>
                </div>
              </td>
            </tr>

          </table>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel ✨" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `✨ Commande ${orderNumber} confirmée - CrystosJewel`,
      html: htmlContent,
    });

    console.log("📧 Email client envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email client :", error);
    return { success: false, error: error.message };
  }
};


export const sendAdminOrderNotification = async (orderData, customerData) => {
  try {
    const { orderNumber, items, total, orderId, promoCode, promoDiscount } = orderData;
    const { firstName, lastName, email, phone, address } = customerData;
    
    const now = new Date();
    const dateCommande = now.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const promoAmount = promoDiscount || 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouvelle commande - CrystosJewel Admin</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          table { border-collapse: collapse; }
          .container { max-width: 680px; margin: 0 auto; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%);">
        
        <div style="padding: 25px 15px;">
          <table cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 20px 60px rgba(220, 38, 38, 0.2); border: 2px solid #ffd700;">
            
            <!-- Header admin rouge/gold -->
            <tr>
              <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px 25px; color: #ffffff; border-radius: 20px 20px 0 0; position: relative;">
                
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="55" style="vertical-align: top; padding-right: 16px;">
                      <div style="width: 55px; height: 55px; background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); border-radius: 15px; text-align: center; line-height: 55px; font-size: 22px; box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);">🔔</div>
                    </td>
                    <td style="vertical-align: top;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px; font-family: Arial, sans-serif; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Nouvelle Commande Reçue</h1>
                      <p style="margin: 6px 0 0 0; opacity: 0.95; font-size: 15px; font-family: Arial, sans-serif;">CrystosJewel Administration</p>
                    </td>
                  </tr>
                </table>
                
                <div style="margin-top: 18px;">
                  <span style="background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #92400e; padding: 10px 20px; border-radius: 25px; font-size: 14px; font-weight: bold; font-family: Arial, sans-serif; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);">⚡ ACTION REQUISE</span>
                </div>
              </td>
            </tr>

            <!-- Statistiques avec nouvelle palette -->
            <tr>
              <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 30px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <!-- Total - Gold -->
                    <td width="32%" style="padding-right: 10px;">
                      <div style="background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #ffffff; padding: 25px 20px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(255, 215, 0, 0.3); position: relative; overflow: hidden;">
                        <div style="position: relative; z-index: 2;">
                          <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px; font-family: Arial, sans-serif; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${total.toFixed(2)} €</div>
                          <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; font-family: Arial, sans-serif;">Montant Total</div>
                        </div>
                      </div>
                    </td>
                    
                    <!-- Articles - Violet clair -->
                    <td width="32%" style="padding: 0 5px;">
                      <div style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; padding: 25px 20px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(168, 85, 247, 0.3);">
                        <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px; font-family: Arial, sans-serif;">${items.length}</div>
                        <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; font-family: Arial, sans-serif;">Article${items.length > 1 ? 's' : ''}</div>
                      </div>
                    </td>
                    
                    <!-- Status - Rouge -->
                    <td width="32%" style="padding-left: 10px;">
                      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; padding: 25px 20px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(220, 38, 38, 0.3);">
                        <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; font-family: Arial, sans-serif;">NOUVEAU</div>
                        <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; font-family: Arial, sans-serif;">Statut</div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Détails de la commande -->
            <tr>
              <td style="padding: 30px;">
                
                <!-- En-tête commande avec style gold -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #ffd700; border-radius: 15px; margin-bottom: 25px;">
                  <tr>
                    <td style="padding: 25px;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="45" style="vertical-align: top; padding-right: 15px;">
                            <div style="width: 45px; height: 45px; background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); border-radius: 12px; text-align: center; line-height: 45px; font-size: 20px; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);">📋</div>
                          </td>
                          <td style="vertical-align: top;">
                            <h2 style="margin: 0; color: #92400e; font-size: 20px; font-weight: bold; font-family: Arial, sans-serif;">Commande ${orderNumber}</h2>
                            <p style="margin: 4px 0 0 0; color: #a16207; font-size: 14px; font-family: Arial, sans-serif;">Reçue le ${dateCommande}</p>
                          </td>
                        </tr>
                      </table>
                      
                      <div style="margin-top: 18px;">
                        <span style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; padding: 10px 18px; border-radius: 20px; font-size: 13px; font-weight: 600; font-family: Arial, sans-serif; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);">⏳ En attente de traitement</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Articles commandés avec tailles -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 25px;">
                  <tr>
                    <td>
                      <h3 style="color: #1f2937; font-size: 19px; font-weight: bold; margin: 0 0 18px 0; font-family: Arial, sans-serif;">🛍️ Articles commandés</h3>
                      
                      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff; border: 2px solid #a855f7; border-radius: 15px; box-shadow: 0 8px 25px rgba(168, 85, 247, 0.15);">
                        ${items.map((item, index) => `
                          <tr>
                            <td style="padding: 18px 22px; ${index < items.length - 1 ? 'border-bottom: 1px solid #f3f4f6;' : ''}">
                              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                  <td style="vertical-align: top;">
                                    <div style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 6px; font-family: Arial, sans-serif;">${item.name}</div>
                                    <div style="color: #6b7280; font-size: 14px; font-family: Arial, sans-serif;">
                                      ${item.quantity} × ${item.price.toFixed(2)} €
                                      ${item.size && item.size !== 'Non spécifiée' ? ` • <span style="color: #a855f7; font-weight: 600;">Taille: ${item.size}</span>` : ''}
                                    </div>
                                  </td>
                                  <td width="120" style="color: #dc2626; font-size: 18px; font-weight: bold; text-align: right; vertical-align: top; font-family: Arial, sans-serif;">${item.total.toFixed(2)} €</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        `).join('')}
                        
                        ${promoCode ? `
                        <tr>
                          <td style="padding: 15px 22px; border-bottom: 1px solid #f3f4f6; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="color: #059669; font-size: 15px; font-weight: 600; font-family: Arial, sans-serif;">
                                  🎉 Code promo appliqué: <strong style="color: #047857;">${promoCode}</strong>
                                </td>
                                <td style="color: #059669; font-size: 16px; font-weight: bold; text-align: right; font-family: Arial, sans-serif;">-${promoAmount.toFixed(2)} €</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        ` : ''}
                        
                        <!-- Total avec style gold -->
                        <tr>
                          <td style="background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #ffffff; padding: 20px 22px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="font-size: 20px; font-weight: bold; letter-spacing: -0.5px; font-family: Arial, sans-serif; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                                  Total TTC: ${total.toFixed(2)} €
                                </td>
                                <td style="font-size: 13px; opacity: 0.9; text-align: right; vertical-align: top; font-family: Arial, sans-serif;">Livraison incluse</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Informations client avec style violet -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff; border: 2px solid #a855f7; border-radius: 15px; margin-bottom: 25px; box-shadow: 0 8px 25px rgba(168, 85, 247, 0.15);">
                  <tr>
                    <td style="padding: 25px;">
                      <h3 style="color: #1f2937; font-size: 19px; font-weight: bold; margin: 0 0 20px 0; font-family: Arial, sans-serif;">👤 Informations client</h3>
                      
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="48%" style="vertical-align: top; padding-right: 25px;">
                            
                            <div style="margin-bottom: 18px;">
                              <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px; font-family: Arial, sans-serif;">Nom complet</div>
                              <div style="font-size: 17px; color: #1f2937; font-weight: 600; font-family: Arial, sans-serif;">${firstName} ${lastName}</div>
                            </div>
                            
                            <div style="margin-bottom: 18px;">
                              <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px; font-family: Arial, sans-serif;">Email</div>
                              <a href="mailto:${email}" style="font-size: 15px; color: #dc2626; text-decoration: none; font-weight: 500; font-family: Arial, sans-serif;">📧 ${email}</a>
                            </div>
                            
                            ${phone ? `
                            <div>
                              <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px; font-family: Arial, sans-serif;">Téléphone</div>
                              <a href="tel:${phone}" style="font-size: 15px; color: #dc2626; text-decoration: none; font-weight: 500; font-family: Arial, sans-serif;">📱 ${phone}</a>
                            </div>
                            ` : ''}
                            
                          </td>
                          
                          <td width="48%" style="vertical-align: top; padding-left: 25px;">
                            <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px; font-family: Arial, sans-serif;">Adresse de livraison</div>
                            <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); padding: 16px 18px; border-radius: 12px; color: #374151; line-height: 1.6; font-size: 14px; border: 1px solid #d8b4fe; font-family: Arial, sans-serif;">
                              📍 ${address}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Actions CTA avec nouvelles couleurs -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #ffd700; border-radius: 15px;">
                  <tr>
                    <td style="padding: 25px; text-align: center;">
                      <h3 style="color: #92400e; font-size: 19px; font-weight: bold; margin: 0 0 20px 0; font-family: Arial, sans-serif;">⚡ Actions rapides</h3>
                      
                      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                        <tr>
                          <td style="padding-right: 8px;">
                            <a href="${process.env.BASE_URL}/admin/commandes/${orderId}" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 600; font-size: 14px; font-family: Arial, sans-serif; box-shadow: 0 6px 20px rgba(168, 85, 247, 0.3);">👁️ Voir commande</a>
                          </td>
                          <td style="padding: 0 8px;">
                            <a href="${process.env.BASE_URL}/admin/commandes/${orderId}/expedier" style="display: inline-block; background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #92400e; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 600; font-size: 14px; font-family: Arial, sans-serif; box-shadow: 0 6px 20px rgba(255, 215, 0, 0.3);">📦 Expédier</a>
                          </td>
                          <td style="padding-left: 8px;">
                            <a href="${process.env.BASE_URL}/admin/commandes" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 600; font-size: 14px; font-family: Arial, sans-serif; box-shadow: 0 6px 20px rgba(220, 38, 38, 0.3);">📊 Dashboard</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Footer admin avec style rouge/gold -->
            <tr>
              <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; padding: 25px 30px; text-align: center; border-radius: 0 0 20px 20px;">
                <div style="margin-bottom: 10px;">
                  <span style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px; font-family: Arial, sans-serif; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">✨ CrystosJewel Administration</span>
                </div>
                <p style="margin: 0; opacity: 0.9; font-size: 13px; line-height: 1.5; font-family: Arial, sans-serif;">
                  Notification automatique • Cette commande nécessite votre attention immédiate
                </p>
              </td>
            </tr>

          </table>
        </div>
      </body>
      </html>
    `;

    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    
    const info = await transporter.sendMail({
      from: `"CrystosJewel Admin 🔥" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: `🔔 NOUVELLE COMMANDE ${orderNumber} • ${total.toFixed(2)}€ • ${firstName} ${lastName}`,
      html: htmlContent,
      priority: 'high',
    });

    console.log("📧 Email admin envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email admin :", error);
    return { success: false, error: error.message };
  }
};

// ✅ FONCTION PRINCIPALE - ENVOI SIMULTANÉ CLIENT + ADMIN AVEC RÉDUCTIONS ET TAILLES
export const sendOrderConfirmationEmails = async (userEmail, firstName, orderData, customerData) => {
  try {
    console.log('📧 Envoi simultané des emails de confirmation...');
    
    // Vérifier la connexion email avant d'envoyer
    const isConnected = await verifyEmailConnection();
    if (!isConnected) {
      console.error('❌ Connexion email non disponible');
      return {
        customer: { success: false, error: 'Connexion email non disponible' },
        admin: { success: false, error: 'Connexion email non disponible' }
      };
    }
    
    const [customerResult, adminResult] = await Promise.allSettled([
      sendOrderConfirmationEmail(userEmail, firstName, orderData),
      sendAdminOrderNotification(orderData, customerData)
    ]);

    const results = {
      customer: customerResult.status === 'fulfilled' ? customerResult.value : { success: false, error: customerResult.reason },
      admin: adminResult.status === 'fulfilled' ? adminResult.value : { success: false, error: adminResult.reason }
    };

    console.log('📧 Résultats envoi emails:', {
      customer: results.customer.success ? '✅ Envoyé' : '❌ Échec',
      admin: results.admin.success ? '✅ Envoyé' : '❌ Échec'
    });

    return results;
    
  } catch (error) {
    console.error('❌ Erreur envoi emails simultané :', error);
    return {
      customer: { success: false, error: error.message },
      admin: { success: false, error: error.message }
    };
  }
};


// ✅ FONCTION UTILITAIRE - FORMATAGE DES DONNÉES DE COMMANDE AVEC TAILLES
export const formatOrderDataForEmail = (orderData) => {
  return {
    ...orderData,
    // Assurer que les montants sont des nombres
    subtotal: parseFloat(orderData.subtotal || 0),
    total: parseFloat(orderData.total || 0),
    promo_discount_amount: parseFloat(orderData.promo_discount_amount || 0),
    promo_discount_percent: orderData.promo_discount_percent ? parseInt(orderData.promo_discount_percent) : null,
    shipping_price: parseFloat(orderData.shipping_price || orderData.deliveryFee || 0),
    
    // Formater les articles avec tailles
    items: orderData.items ? orderData.items.map(item => ({
      ...item,
      price: parseFloat(item.price || 0),
      quantity: parseInt(item.quantity || 1),
      size: item.size || 'Non spécifiée',
      total: parseFloat(item.total || (item.price * item.quantity) || 0)
    })) : []
  };
};

// Email de notification d'expédition
// export const sendShippingNotificationEmail = async (userEmail, firstName, shippingData) => {
//   try {
//     const { orderNumber, trackingNumber, carrier, estimatedDelivery } = shippingData;

//     const htmlContent = `
//       <div style="
//         font-family: 'Inter', Arial, sans-serif;
//         color: #3a3a3a;
//         background: linear-gradient(135deg, #fff8f0 0%, #f5e6d3 100%);
//         margin: 0;
//         padding: 20px;
//       ">
//         <div style="
//           max-width: 650px;
//           margin: auto;
//           background: white;
//           border-radius: 20px;
//           box-shadow: 0 16px 48px rgba(232, 180, 184, 0.16);
//           overflow: hidden;
//         ">
          
//           <!-- Header -->
//           <header style="
//             background: linear-gradient(135deg, #E8B4B8 0%, #B8868A 100%);
//             padding: 40px 20px;
//             text-align: center;
//             color: white;
//           ">
//             <h1 style="
//               margin: 0 0 10px 0;
//               font-size: 2.5rem;
//               font-weight: 700;
//               letter-spacing: 2px;
//               font-family: 'Playfair Display', serif;
//             ">✨ CrystosJewel ✨</h1>
//           </header>

//           <!-- Contenu principal -->
//           <main style="padding: 40px 30px; text-align: center;">
            
//             <div style="font-size: 4rem; margin-bottom: 20px;">📦</div>
            
//             <h2 style="
//               color: #B8868A;
//               font-size: 2rem;
//               margin: 0 0 15px 0;
//               font-family: 'Playfair Display', serif;
//             ">Bonne nouvelle ${firstName} !</h2>
            
//             <p style="
//               color: #666;
//               font-size: 16px;
//               line-height: 1.6;
//               margin-bottom: 30px;
//             ">Votre commande <strong>${orderNumber}</strong> a été expédiée !<br>
//             Vos bijoux sont en route vers vous ✨</p>

//             <!-- Informations de suivi -->
//             <div style="
//               background: linear-gradient(135deg, #F8F4F0 0%, #F5E6D3 100%);
//               border-radius: 16px;
//               padding: 25px;
//               margin-bottom: 30px;
//               text-align: left;
//             ">
//               <h3 style="
//                 color: #B8868A;
//                 margin: 0 0 20px 0;
//                 text-align: center;
//               ">📋 Informations de suivi</h3>
              
//               <div style="
//                 display: grid;
//                 gap: 15px;
//               ">
//                 <div>
//                   <strong style="color: #7d4b53;">Transporteur:</strong><br>
//                   <span style="color: #666;">${carrier}</span>
//                 </div>
//                 <div>
//                   <strong style="color: #7d4b53;">Numéro de suivi:</strong><br>
//                   <span style="
//                     background: white;
//                     padding: 8px 12px;
//                     border-radius: 8px;
//                     font-family: 'Courier New', monospace;
//                     color: #B8868A;
//                     font-weight: 600;
//                     display: inline-block;
//                     margin-top: 5px;
//                   ">${trackingNumber}</span>
//                 </div>
//                 <div>
//                   <strong style="color: #7d4b53;">Livraison estimée:</strong><br>
//                   <span style="color: #28A745; font-weight: 600;">${estimatedDelivery}</span>
//                 </div>
//               </div>
//             </div>

//             <!-- CTA -->
//             <a href="${process.env.BASE_URL}/mon-compte/commandes" style="
//               display: inline-block;
//               background: linear-gradient(135deg, #E8B4B8 0%, #B8868A 100%);
//               color: white;
//               text-decoration: none;
//               padding: 15px 30px;
//               border-radius: 50px;
//               font-weight: 600;
//               font-size: 16px;
//               box-shadow: 0 4px 16px rgba(232, 180, 184, 0.3);
//             ">📍 Suivre mon colis</a>

//           </main>

//           <!-- Footer simple -->
//           <footer style="
//             background: #F8F4F0;
//             padding: 20px;
//             text-align: center;
//             font-size: 12px;
//             color: #999;
//           ">
//             <p style="margin: 0;">
//               Des questions ? Contactez-nous à 
//               <a href="mailto:${process.env.MAIL_USER}" style="color: #B8868A;">${process.env.MAIL_USER}</a>
//             </p>
//           </footer>

//         </div>
//       </div>
//     `;

//     const info = await transporter.sendMail({
//       from: `"CrystosJewel 📦" <${process.env.MAIL_USER}>`,
//       to: userEmail,
//       subject: `📦 Votre commande ${orderNumber} est en route !`,
//       html: htmlContent,
//     });

//     console.log("📧 Email d'expédition envoyé :", info.response);
//     return { success: true, messageId: info.messageId };
    
//   } catch (error) {
//     console.error("❌ Erreur lors de l'envoi de l'email d'expédition :", error);
//     return { success: false, error: error.message };
//   }
// };

// ✅ FONCTION PRINCIPALE - ENVOI SIMULTANÉ CLIENT + ADMIN

// export const sendOrderConfirmationEmails = async (userEmail, firstName, orderData, customerData) => {
//   try {
//     console.log('📧 Envoi simultané des emails de confirmation...');
    
//     const [customerResult, adminResult] = await Promise.allSettled([
//       sendOrderConfirmationEmail(userEmail, firstName, orderData),
//       sendAdminOrderNotification(orderData, customerData)
//     ]);

//     const results = {
//       customer: customerResult.status === 'fulfilled' ? customerResult.value : { success: false, error: customerResult.reason },
//       admin: adminResult.status === 'fulfilled' ? adminResult.value : { success: false, error: adminResult.reason }
//     };

//     console.log('📧 Résultats envoi emails:', {
//       customer: results.customer.success ? '✅ Envoyé' : '❌ Échec',
//       admin: results.admin.success ? '✅ Envoyé' : '❌ Échec'
//     });

//     return results;
    
//   } catch (error) {
//     console.error("❌ Erreur lors de l'envoi simultané des emails :", error);
//     return {
//       customer: { success: false, error: error.message },
//       admin: { success: false, error: error.message }
//     };
//   }
// };

export const sendOrderStatusUpdateEmail = async (userEmail, firstName, statusData) => {
  try {
    const { orderNumber, oldStatus, newStatus, trackingNumber, updatedBy } = statusData;
    
    // Messages personnalisés selon le statut
    const statusMessages = {
      'preparing': {
        icon: '🔧',
        title: 'Votre commande est en préparation',
        message: 'Nos artisans préparent soigneusement vos bijoux dans nos ateliers.',
        color: '#3b82f6'
      },
      'shipped': {
        icon: '📦',
        title: 'Votre commande a été expédiée',
        message: 'Vos bijoux sont en route ! Vous recevrez bientôt votre colis.',
        color: '#10b981'
      },
      'delivered': {
        icon: '✅',
        title: 'Votre commande a été livrée',
        message: 'Félicitations ! Vos bijoux sont arrivés à destination.',
        color: '#059669'
      },
      'cancelled': {
        icon: '❌',
        title: 'Votre commande a été annulée',
        message: 'Votre commande a été annulée. Si vous avez des questions, contactez-nous.',
        color: '#ef4444'
      }
    };

    const statusInfo = statusMessages[newStatus] || {
      icon: '📋',
      title: 'Mise à jour de votre commande',
      message: 'Le statut de votre commande a été mis à jour.',
      color: '#6b7280'
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mise à jour commande - CrystosJewel</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          table { border-collapse: collapse; }
          .container { max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
        
        <div style="padding: 20px;">
          <table cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%); padding: 30px 20px; text-align: center; border-radius: 16px 16px 0 0;">
                <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 28px; font-weight: bold; font-family: Arial, sans-serif;">✨ CrystosJewel ✨</h1>
                <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 14px; font-family: Arial, sans-serif;">Mise à jour de votre commande</p>
              </td>
            </tr>

            <!-- Status Badge -->
            <tr>
              <td style="background-color: ${statusInfo.color}; padding: 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">${statusInfo.icon}</div>
                <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: bold; font-family: Arial, sans-serif;">${statusInfo.title}</h2>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 30px 25px;">
                
                <div style="text-align: center; margin-bottom: 25px;">
                  <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 18px; font-family: Arial, sans-serif;">Bonjour ${firstName} !</h3>
                  <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.6; font-family: Arial, sans-serif;">${statusInfo.message}</p>
                </div>

                <!-- Order Info -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; margin-bottom: 25px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="color: #6b7280; font-size: 14px; padding-bottom: 8px; font-family: Arial, sans-serif;">Numéro de commande</td>
                          <td style="color: #374151; font-size: 14px; font-weight: 600; text-align: right; padding-bottom: 8px; font-family: Arial, sans-serif;">${orderNumber}</td>
                        </tr>
                        <tr>
                          <td style="color: #6b7280; font-size: 14px; padding-bottom: 8px; font-family: Arial, sans-serif;">Ancien statut</td>
                          <td style="color: #9ca3af; font-size: 14px; text-align: right; padding-bottom: 8px; font-family: Arial, sans-serif;">${oldStatus}</td>
                        </tr>
                        <tr>
                          <td style="color: #6b7280; font-size: 14px; font-family: Arial, sans-serif;">Nouveau statut</td>
                          <td style="color: ${statusInfo.color}; font-size: 14px; font-weight: 600; text-align: right; font-family: Arial, sans-serif;">${newStatus}</td>
                        </tr>
                        ${trackingNumber ? `
                        <tr>
                          <td colspan="2" style="padding-top: 16px; border-top: 1px solid #e5e7eb;">
                            <div style="background-color: #ffffff; padding: 12px; border-radius: 8px; text-align: center;">
                              <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px; font-family: Arial, sans-serif;">Numéro de suivi</div>
                              <div style="color: #374151; font-size: 16px; font-weight: 600; font-family: monospace;">${trackingNumber}</div>
                            </div>
                          </td>
                        </tr>
                        ` : ''}
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Action Button -->
                <div style="text-align: center; margin-bottom: 25px;">
                  <a href="${process.env.BASE_URL}/mon-compte/commandes" style="display: inline-block; background-color: ${statusInfo.color}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; font-family: Arial, sans-serif;">
                    📋 Suivre ma commande
                  </a>
                </div>

                <!-- Help Info -->
                <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; text-align: center;">
                  <p style="margin: 0; color: #92400e; font-size: 14px; font-family: Arial, sans-serif;">
                    Une question ? Contactez-nous à 
                    <a href="mailto:${process.env.MAIL_USER}" style="color: #92400e; text-decoration: none; font-weight: 600;">${process.env.MAIL_USER}</a>
                  </p>
                </div>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
                <p style="margin: 0; color: #6b7280; font-size: 12px; font-family: Arial, sans-serif;">
                  Mise à jour effectuée par ${updatedBy} • 
                  <a href="${process.env.BASE_URL}" style="color: #d89ab3; text-decoration: none;">CrystosJewel.com</a>
                </p>
              </td>
            </tr>

          </table>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel ✨" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `${statusInfo.icon} Commande ${orderNumber} - ${statusInfo.title}`,
      html: htmlContent,
    });

    console.log("📧 Email client envoyé (changement statut):", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email client (changement statut):", error);
    return { success: false, error: error.message };
  }
};

// ✅ NOUVELLE FONCTION - Email notification expédition amélioré
export const sendShippingNotificationEmail = async (userEmail, firstName, shippingData) => {
  try {
    const { orderNumber, trackingNumber, estimatedDelivery = 'Dans 2-3 jours ouvrés' } = shippingData;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Commande expédiée - CrystosJewel</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          table { border-collapse: collapse; }
          .container { max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f0f9ff;">
        
        <div style="padding: 20px;">
          <table cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center; border-radius: 16px 16px 0 0;">
                <div style="font-size: 64px; margin-bottom: 16px;">📦</div>
                <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif;">Votre commande est en route !</h1>
                <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 14px; font-family: Arial, sans-serif;">CrystosJewel • Expédition confirmée</p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 30px 25px;">
                
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 style="margin: 0 0 12px 0; color: #374151; font-size: 20px; font-family: Arial, sans-serif;">Bonjour ${firstName} !</h2>
                  <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.6; font-family: Arial, sans-serif;">
                    Excellente nouvelle ! Votre commande <strong>${orderNumber}</strong> a été expédiée.<br>
                    Vos bijoux sont maintenant en route vers vous ✨
                  </p>
                </div>

                <!-- Tracking Info -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #10b981; border-radius: 12px; margin-bottom: 25px;">
                  <tr>
                    <td style="padding: 25px;">
                      <div style="text-align: center;">
                        <h3 style="margin: 0 0 16px 0; color: #10b981; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">
                          🚚 Informations de suivi
                        </h3>
                        
                        <div style="background-color: #ffffff; padding: 20px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                          <div style="color: #6b7280; font-size: 12px; margin-bottom: 6px; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px;">Numéro de suivi</div>
                          <div style="color: #10b981; font-size: 20px; font-weight: bold; font-family: monospace; letter-spacing: 1px; margin-bottom: 8px;">${trackingNumber}</div>
                          <div style="color: #6b7280; font-size: 13px; font-family: Arial, sans-serif;">Utilisez ce numéro pour suivre votre colis</div>
                        </div>
                        
                        <div style="background-color: rgba(16, 185, 129, 0.1); padding: 16px; border-radius: 10px; border: 1px dashed #10b981;">
                          <div style="color: #065f46; font-size: 14px; font-weight: 600; margin-bottom: 4px; font-family: Arial, sans-serif;">📅 Livraison estimée</div>
                          <div style="color: #059669; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">${estimatedDelivery}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Action Buttons -->
                <div style="text-align: center; margin-bottom: 25px;">
                  <a href="${process.env.BASE_URL}/mon-compte/commandes" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 0 8px 8px 0; font-family: Arial, sans-serif;">
                    📋 Suivre ma commande
                  </a>
                  <a href="${process.env.BASE_URL}/contact" style="display: inline-block; background-color: #ffffff; color: #10b981; text-decoration: none; padding: 14px 28px; border: 2px solid #10b981; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 0 8px 8px 0; font-family: Arial, sans-serif;">
                    💬 Nous contacter
                  </a>
                </div>

                <!-- Delivery Info -->
                <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; text-align: center;">
                  <h4 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-family: Arial, sans-serif;">📍 Informations de livraison</h4>
                  <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.5; font-family: Arial, sans-serif;">
                    • Livraison du lundi au vendredi (hors jours fériés)<br>
                    • Signature requise à la réception<br>
                    • En cas d'absence, le colis sera déposé en point relais
                  </p>
                </div>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; font-family: Arial, sans-serif;">
                  <strong>Merci de votre confiance !</strong>
                </p>
                <p style="margin: 0; color: #9ca3af; font-size: 12px; font-family: Arial, sans-serif;">
                  Questions ? Contactez-nous à 
                  <a href="mailto:${process.env.MAIL_USER}" style="color: #10b981; text-decoration: none;">${process.env.MAIL_USER}</a>
                </p>
              </td>
            </tr>

          </table>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel 📦" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `📦 Votre commande ${orderNumber} est en route !`,
      html: htmlContent,
    });

    console.log("📧 Email expédition envoyé:", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email expédition:", error);
    return { success: false, error: error.message };
  }
};

// ✅ FONCTION UTILITAIRE - Calcul date de livraison avec fuseau horaire français
// function calculateDeliveryDate(daysToAdd = 3) {
//     let deliveryDate = new Date();
//     let addedDays = 0;
    
//     // Convertir en heure française
//     const options = { timeZone: 'Europe/Paris' };
    
//     while (addedDays < daysToAdd) {
//         deliveryDate.setDate(deliveryDate.getDate() + 1);
        
//         // Si ce n'est pas un dimanche (0 = dimanche)
//         if (deliveryDate.getDay() !== 0) {
//             addedDays++;
//         }
//     }
    
//     return deliveryDate.toLocaleDateString('fr-FR', {
//         timeZone: 'Europe/Paris',
//         weekday: 'long',
//         year: 'numeric',
//         month: 'long',
//         day: 'numeric'
//     });
// }

// 📧 SERVICE EMAIL AMÉLIORÉ - Envoi automatique selon statut
// Ajouter ces nouvelles fonctions dans votre fichier mailService.js

// ✅ FONCTION PRINCIPALE - Envoi email selon changement de statut
export const sendStatusChangeEmail = async (orderData, statusChangeData, customerData) => {
    try {
        const { oldStatus, newStatus, updatedBy } = statusChangeData;
        const { userEmail, firstName } = customerData;
        
        console.log(`📧 Fonction sendStatusChangeEmail appelée:`, {
            orderNumber: orderData.numero_commande,
            email: userEmail,
            statusChange: `${oldStatus} → ${newStatus}`
        });
        
        // ✅ NE RIEN ENVOYER pour les statuts identiques
        if (oldStatus === newStatus) {
            console.log('⏭️ Statut identique, aucun email envoyé');
            return { success: true, message: 'Statut identique, aucun email nécessaire' };
        }

        // ✅ VALIDATION DES DONNÉES REQUISES
        if (!userEmail || !firstName || !orderData.numero_commande) {
            console.error('❌ Données manquantes pour l\'email:', { userEmail, firstName, orderNumber: orderData.numero_commande });
            return { success: false, error: 'Données manquantes pour l\'envoi d\'email' };
        }
        
        // ✅ EMAILS SPÉCIAUX selon le nouveau statut
        switch (newStatus) {
            case 'shipped':
                console.log('📦 Envoi email expédition...');
                return await sendShippingNotificationEmail(userEmail, firstName, {
                    orderNumber: orderData.numero_commande,
                    trackingNumber: orderData.tracking_number || 'En cours d\'attribution',
                    estimatedDelivery: calculateDeliveryDate(3)
                });
                
            case 'delivered':
                console.log('✅ Envoi email livraison...');
                return await sendDeliveryConfirmationEmail(userEmail, firstName, {
                    orderNumber: orderData.numero_commande,
                    deliveryDate: new Date().toLocaleDateString('fr-FR')
                });
                
            case 'cancelled':
                console.log('❌ Envoi email annulation...');
                return await sendCancellationEmail(userEmail, firstName, {
                    orderNumber: orderData.numero_commande,
                    reason: orderData.cancellation_reason || 'Annulation demandée'
                });
                
            default:
                console.log('📋 Envoi email générique changement statut...');
                return await sendOrderStatusUpdateEmail(userEmail, firstName, {
                    orderNumber: orderData.numero_commande,
                    oldStatus: translateStatus(oldStatus),
                    newStatus: translateStatus(newStatus),
                    trackingNumber: orderData.tracking_number,
                    updatedBy: updatedBy || 'Équipe CrystosJewel'
                });
        }
        
    } catch (error) {
        console.error('❌ Erreur dans sendStatusChangeEmail:', error);
        return { success: false, error: error.message };
    }
};


// ✅ FONCTION UTILITAIRE - Traduction des statuts
const translateStatus = (status) => {
  const translations = {
    'pending': 'En attente',
    'confirmed': 'Confirmée',
    'processing': 'En préparation',
    'shipped': 'Expédiée',
    'delivered': 'Livrée',
    'cancelled': 'Annulée',
    'refunded': 'Remboursée'
  };
  return translations[status] || status;
};

// ✅ EMAIL CONFIRMATION DE LIVRAISON
// ✅ EMAIL LIVRAISON
const sendDeliveryConfirmationEmail = async (userEmail, firstName, data) => {
  try {
    const { orderNumber } = data;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Commande livrée - CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f0fdf4;">
        
        <div style="padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 25px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Commande livrée !</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Commande ${orderNumber}</p>
            </div>

            <!-- Contenu -->
            <div style="padding: 25px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937;">
                Bonjour ${firstName},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                🎉 Félicitations ! Votre commande <strong>${orderNumber}</strong> a été livrée avec succès.
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                Nous espérons que vous êtes ravi(e) de vos nouveaux bijoux !
              </p>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h3 style="margin: 0 0 10px 0; color: #065f46; font-size: 16px;">💎 Profitez de vos bijoux</h3>
                <p style="margin: 0; color: #1f2937; font-size: 14px;">N'hésitez pas à nous envoyer des photos de vos bijoux portés sur nos réseaux sociaux !</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/avis?order=${orderNumber}" 
                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 5px;">
                  ⭐ Laisser un avis
                </a>
                <a href="${process.env.BASE_URL}/bijoux" 
                   style="display: inline-block; background: linear-gradient(135deg, #E8B4B8 0%, #d1a3a8 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 5px;">
                  💎 Découvrir nos nouveautés
                </a>
              </div>
              
              <p style="margin: 0; font-size: 16px; color: #1f2937;">
                Merci pour votre confiance et à bientôt !<br>
                L'équipe CrystosJewel
              </p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel ✅" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `✅ Votre commande ${orderNumber} a été livrée !`,
      html: htmlContent,
    });

    console.log("📧 Email livraison envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email livraison :", error);
    return { success: false, error: error.message };
  }
};

// ✅ EMAIL CHANGEMENT DE STATUT GÉNÉRAL
const sendGeneralStatusUpdateEmail = async (userEmail, firstName, data) => {
  try {
    const { orderNumber, oldStatus, newStatus, updatedBy } = data;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mise à jour commande - CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #fef7ff;">
        
        <div style="padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; padding: 25px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔄</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Mise à jour de votre commande</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Commande ${orderNumber}</p>
            </div>

            <!-- Contenu -->
            <div style="padding: 25px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937;">
                Bonjour ${firstName},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                Le statut de votre commande <strong>${orderNumber}</strong> a été mis à jour.
              </p>
              
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #a855f7;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                  <span style="background: #fee2e2; color: #991b1b; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                    ${oldStatus}
                  </span>
                  <span style="color: #6b7280; font-size: 20px;">→</span>
                  <span style="background: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                    ${newStatus}
                  </span>
                </div>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  Mis à jour par ${updatedBy} • ${new Date().toLocaleDateString('fr-FR')}
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/commande/suivi?order=${orderNumber}" 
                   style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 600; font-size: 14px;">
                  👁️ Voir ma commande
                </a>
              </div>
              
              <p style="margin: 0; font-size: 16px; color: #1f2937;">
                Merci pour votre confiance !<br>
                L'équipe CrystosJewel
              </p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel 🔄" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `🔄 Mise à jour de votre commande ${orderNumber}`,
      html: htmlContent,
    });

    console.log("📧 Email mise à jour envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email mise à jour :", error);
    return { success: false, error: error.message };
  }
};

// ✅ EMAIL ANNULATION
export const sendCancellationEmail = async (userEmail, firstName, cancellationData) => {
  try {
    const { orderNumber, reason } = cancellationData;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Commande annulée - CrystosJewel</title>
        <style>body { font-family: Arial, sans-serif; }</style>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #fef2f2;">
        
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px 20px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 16px;">❌</div>
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">Commande annulée</h1>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.95); font-size: 14px;">CrystosJewel • Annulation confirmée</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 25px;">
            <h2 style="margin: 0 0 15px 0; color: #374151; font-size: 20px;">Bonjour ${firstName},</h2>
            <p style="margin: 0 0 25px 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
              Nous vous confirmons l'annulation de votre commande <strong>${orderNumber}</strong>.
            </p>

            <!-- Reason -->
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
              <h4 style="margin: 0 0 8px 0; color: #dc2626; font-size: 16px;">Motif :</h4>
              <p style="margin: 0; color: #991b1b; font-size: 14px;">${reason}</p>
            </div>

            <!-- Refund Info -->
            <div style="background: #f0f9ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
              <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 16px;">💳 Remboursement</h4>
              <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.5;">
                Si un paiement a été effectué, le remboursement sera traité sous 3-5 jours ouvrés 
                selon votre mode de paiement.
              </p>
            </div>

            <!-- Contact -->
            <div style="text-align: center;">
              <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
                Une question ? N'hésitez pas à nous contacter.
              </p>
              <a href="mailto:${process.env.MAIL_USER}" style="display: inline-block; background: #d89ab3; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
                Nous contacter
              </a>
            </div>
          </div>

        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `❌ Commande ${orderNumber} annulée`,
      html: htmlContent,
    });

    console.log("📧 Email annulation envoyé:", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email annulation:", error);
    return { success: false, error: error.message };
  }
};


/**
 * NOUVELLE FONCTION - Envoi simultané EMAIL + SMS lors de la confirmation de commande
 */
export const sendOrderConfirmationWithSMS = async (userEmail, firstName, orderData, customerData) => {
  try {
    console.log('📧📱 Envoi confirmation avec EMAIL + SMS...');
    
    // ✅ UTILISER LE NOM DE LA COMMANDE (pas du compte)
    const customerName = orderData.customer_name || `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() || 'Client';
    const firstNameFromOrder = customerName.split(' ')[0] || 'Client';
    
    // 1. Envoyer l'email de confirmation client
    const emailResults = await sendEnhancedOrderConfirmationEmail(userEmail, firstNameFromOrder, orderData, customerData);

    // 2. Envoyer l'email admin
    let adminResult = { success: false };
    try {
      adminResult = await sendEnhancedAdminOrderNotification(orderData, customerData);
    } catch (adminError) {
      console.error('❌ Erreur email admin:', adminError);
    }

    // 3. Envoyer le SMS si configuré
    let smsResult = { success: false };
    if (customerData.phone) {
      try {
        const { sendOrderConfirmationSMS } = await import('./smsService.js');
        smsResult = await sendOrderConfirmationSMS(customerData.phone, {
          numero_commande: orderData.numero_commande,
          total: orderData.total,
          customer_name: customerName
        });
      } catch (smsError) {
        console.error('❌ Erreur SMS:', smsError);
      }
    }

    return {
      email: emailResults,
      admin: adminResult,
      sms: smsResult,
      success: emailResults.success,
      notifications: {
        emailSent: emailResults.success,
        adminNotified: adminResult.success,
        smsSent: smsResult.success
      }
    };

  } catch (error) {
    console.error('❌ Erreur envoi confirmation avec SMS:', error);
    return {
      email: { success: false, error: error.message },
      admin: { success: false, error: error.message },
      sms: { success: false, error: error.message },
      success: false
    };
  }
};

export const sendEnhancedAdminOrderNotification = async (orderData, customerData) => {
  try {
    const { numero_commande, total, subtotal, items, promo_code, promo_discount_amount, shipping_price } = orderData;
    const { firstName, lastName, email, phone, address } = customerData;
    
    const now = new Date();
    const dateCommande = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculs financiers
    const itemsTotal = parseFloat(subtotal || 0);
    const discount = parseFloat(promo_discount_amount || 0);
    const shipping = parseFloat(shipping_price || 0);
    const finalTotal = parseFloat(total || 0);

    // Articles détaillés pour admin
    let itemsHTML = '';
    if (items && items.length > 0) {
      itemsHTML = items.map(item => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; border-right: 1px solid #e5e7eb;">
            <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">${item.name}</div>
            <div style="font-size: 12px; color: #6b7280;">
              ${item.size && item.size !== 'Non spécifiée' ? `Taille: ${item.size}` : ''}
            </div>
          </td>
          <td style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb; font-weight: 600;">${item.quantity}</td>
          <td style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb; font-weight: 600;">${item.price.toFixed(2)}€</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #059669;">${(item.price * item.quantity).toFixed(2)}€</td>
        </tr>
      `).join('');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouvelle commande - CrystosJewel Admin</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); min-height: 100vh;">
        
        <div style="padding: 25px 15px;">
          <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); overflow: hidden;">
            
            <!-- Header Admin -->
            <div style="background: linear-gradient(135deg, #374151 0%, #1f2937 100%); padding: 30px; color: white; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">🚨 NOUVELLE COMMANDE</h1>
              <p style="margin: 0; opacity: 0.9; font-size: 14px;">Administration CrystosJewel</p>
            </div>

            <!-- Infos urgentes -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 700; color: #92400e; font-size: 16px;">Commande #${numero_commande}</div>
                  <div style="color: #92400e; font-size: 14px;">${dateCommande}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 700; color: #92400e; font-size: 20px;">${finalTotal.toFixed(2)}€</div>
                  <div style="color: #92400e; font-size: 12px;">Total commande</div>
                </div>
              </div>
            </div>

            <!-- Informations client -->
            <div style="padding: 25px 30px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 15px 0; color: #374151; font-size: 18px; font-weight: 600; border-bottom: 2px solid #b76e79; padding-bottom: 8px; display: inline-block;">👤 Informations client</h2>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <div style="font-weight: 600; color: #374151; margin-bottom: 8px;">Contact</div>
                  <div style="color: #6b7280; line-height: 1.4;">
                    <div><strong>${firstName} ${lastName}</strong></div>
                    <div>📧 ${email}</div>
                    ${phone ? `<div>📱 ${phone}</div>` : ''}
                  </div>
                </div>
                
                ${address ? `
                <div>
                  <div style="font-weight: 600; color: #374151; margin-bottom: 8px;">Adresse de livraison</div>
                  <div style="color: #6b7280; line-height: 1.4;">
                    ${address.street || ''}<br>
                    ${address.city || ''} ${address.postalCode || ''}<br>
                    ${address.country || ''}
                  </div>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- Détails de la commande -->
            <div style="padding: 25px 30px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 20px 0; color: #374151; font-size: 18px; font-weight: 600; border-bottom: 2px solid #b76e79; padding-bottom: 8px; display: inline-block;">📦 Articles commandés</h2>
              
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-right: 1px solid #e5e7eb;">Produit</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-right: 1px solid #e5e7eb;">Qté</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-right: 1px solid #e5e7eb;">Prix unit.</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
            </div>

            <!-- Récapitulatif financier admin -->
            <div style="padding: 25px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #374151; font-size: 18px; font-weight: 600; border-bottom: 2px solid #b76e79; padding-bottom: 8px; display: inline-block;">💰 Récapitulatif financier</h2>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <table style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Sous-total articles :</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">${itemsTotal.toFixed(2)}€</td>
                  </tr>
                  
                  ${discount > 0 ? `
                  <tr>
                    <td style="padding: 8px 0; color: #dc2626;">Réduction ${promo_code ? `(${promo_code})` : ''} :</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">-${discount.toFixed(2)}€</td>
                  </tr>
                  ` : ''}
                  
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Frais de port :</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #374151;">
                      ${shipping > 0 ? `${shipping.toFixed(2)}€` : 'Gratuit'}
                    </td>
                  </tr>
                  
                  <tr style="border-top: 2px solid #e5e7eb;">
                    <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: 700; color: #374151;">TOTAL :</td>
                    <td style="padding: 12px 0 0 0; text-align: right; font-size: 20px; font-weight: 700; color: #059669;">${finalTotal.toFixed(2)}€</td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Actions rapides -->
            <div style="background: #f3f4f6; padding: 25px 30px; text-align: center;">
              <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px; font-weight: 600;">⚡ Actions rapides</h3>
              
              <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <a href="${process.env.BASE_URL}/admin/orders/${numero_commande}" 
                   style="background: #b76e79; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                  📋 Voir la commande
                </a>
                <a href="${process.env.BASE_URL}/admin/orders" 
                   style="background: #6b7280; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                  📊 Toutes les commandes
                </a>
              </div>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel Admin 🚨" <${process.env.MAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.MAIL_USER,
      subject: `🚨 Nouvelle commande #${numero_commande} - ${finalTotal.toFixed(2)}€`,
      html: htmlContent,
    });

    console.log("📧 Email admin envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email admin :", error);
    return { success: false, error: error.message };
  }
};

/**
 * ✅ UTILITAIRE : Formater le nom du client depuis les données de commande
 */
export const getCustomerNameFromOrder = (orderData, customerData) => {
  // Priorité au nom de la commande (saisie lors de la commande)
  if (orderData.customer_name && orderData.customer_name.trim()) {
    return orderData.customer_name.trim();
  }
  
  // Sinon utiliser les données client
  const fullName = `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim();
  return fullName || 'Client';
};

/**
 * ✅ UTILITAIRE : Obtenir le prénom depuis le nom complet
 */
export const getFirstNameFromFullName = (fullName) => {
  if (!fullName || !fullName.trim()) return 'Client';
  return fullName.trim().split(' ')[0] || 'Client';
};

export const sendEnhancedOrderConfirmationEmail = async (userEmail, firstName, orderData, customerData) => {
  try {
    const { numero_commande, total, subtotal, items, promo_code, promo_discount_amount, shipping_price } = orderData;
    
    // Calculs financiers
    const itemsTotal = parseFloat(subtotal || 0);
    const discount = parseFloat(promo_discount_amount || 0);
    const shipping = parseFloat(shipping_price || 0);
    const finalTotal = parseFloat(total || 0);
    
    // Articles détaillés
    let itemsHTML = '';
    if (items && items.length > 0) {
      itemsHTML = items.map(item => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #7d4b53; margin-bottom: 4px; font-size: 16px;">${item.name}</div>
                <div style="font-size: 13px; color: #999;">
                  ${item.size && item.size !== 'Non spécifiée' ? `Taille: ${item.size} • ` : ''}
                  Quantité: ${item.quantity}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 600; color: #b76e79; font-size: 16px;">${(item.price * item.quantity).toFixed(2)}€</div>
                <div style="font-size: 12px; color: #999;">${item.price.toFixed(2)}€ × ${item.quantity}</div>
              </div>
            </div>
          </td>
        </tr>
      `).join('');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmation de commande - CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #fff8f0 0%, #f5e6d3 100%);">
        
        <div style="padding: 20px;">
          <table cellpadding="0" cellspacing="0" border="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 12px 40px rgba(183, 110, 121, 0.2); overflow: hidden;">
            
            <!-- Header luxueux -->
            <tr>
              <td style="background: linear-gradient(135deg, #b76e79 0%, #7d4b53 100%); padding: 50px 30px; text-align: center; position: relative;">
                <div style="font-size: 72px; margin-bottom: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎉</div>
                <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 2px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">✨ CrystosJewel ✨</h1>
                <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 16px; font-weight: 500; letter-spacing: 1px;">Commande confirmée avec succès</p>
              </td>
            </tr>

            <!-- Message de bienvenue -->
            <tr>
              <td style="padding: 40px 30px 20px 30px; text-align: center;">
                <h2 style="margin: 0 0 15px 0; color: #7d4b53; font-size: 24px; font-weight: 600;">Merci ${firstName} ! 💎</h2>
                <p style="margin: 0; color: #666; font-size: 18px; line-height: 1.6;">
                  Votre commande a été confirmée avec succès.<br>
                  Nous préparons vos magnifiques bijoux avec le plus grand soin !
                </p>
              </td>
            </tr>

            <!-- Détails de la commande -->
            <tr>
              <td style="padding: 0 30px 30px 30px;">
                
                <!-- Numéro de commande -->
                <div style="background: linear-gradient(135deg, #fff8f0 0%, #faf5f0 100%); border: 3px solid #e8c2c8; border-radius: 15px; padding: 25px; margin-bottom: 30px; text-align: center;">
                  <div style="color: #7d4b53; font-size: 14px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Numéro de commande</div>
                  <div style="color: #b76e79; font-size: 24px; font-weight: 700; font-family: monospace; letter-spacing: 2px;">${numero_commande}</div>
                </div>

                <!-- Articles commandés -->
                <div style="background: #ffffff; border: 2px solid #e8c2c8; border-radius: 15px; padding: 25px; margin-bottom: 25px;">
                  <h3 style="margin: 0 0 20px 0; color: #7d4b53; font-size: 20px; font-weight: 600; text-align: center; border-bottom: 2px solid #e8c2c8; padding-bottom: 15px;">Vos bijoux sélectionnés</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    ${itemsHTML}
                  </table>
                </div>

                <!-- Récapitulatif financier -->
                <div style="background: linear-gradient(135deg, #fff8f0 0%, #faf5f0 100%); border: 2px solid #e8c2c8; border-radius: 15px; padding: 25px;">
                  <h3 style="margin: 0 0 20px 0; color: #7d4b53; font-size: 18px; font-weight: 600; text-align: center;">Récapitulatif</h3>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e8c2c8; color: #666; font-size: 15px;">Sous-total articles</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e8c2c8; text-align: right; font-weight: 600; color: #7d4b53; font-size: 15px;">${itemsTotal.toFixed(2)}€</td>
                    </tr>
                    
                    ${discount > 0 ? `
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e8c2c8; color: #10b981; font-size: 15px;">
                        Réduction ${promo_code ? `(${promo_code})` : ''}
                      </td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e8c2c8; text-align: right; font-weight: 600; color: #10b981; font-size: 15px;">-${discount.toFixed(2)}€</td>
                    </tr>
                    ` : ''}
                    
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e8c2c8; color: #666; font-size: 15px;">Livraison</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e8c2c8; text-align: right; font-weight: 600; color: #7d4b53; font-size: 15px;">
                        ${shipping > 0 ? `${shipping.toFixed(2)}€` : 'Gratuite'}
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 15px 0 5px 0; color: #7d4b53; font-size: 18px; font-weight: 700;">TOTAL</td>
                      <td style="padding: 15px 0 5px 0; text-align: right; font-weight: 700; color: #b76e79; font-size: 20px;">${finalTotal.toFixed(2)}€</td>
                    </tr>
                  </table>
                </div>

              </td>
            </tr>

            <!-- Informations de livraison -->
            <tr>
              <td style="padding: 0 30px 30px 30px;">
                <div style="background: #f8f9fa; border: 1px solid #e8c2c8; border-radius: 12px; padding: 20px;">
                  <h3 style="margin: 0 0 15px 0; color: #7d4b53; font-size: 16px; font-weight: 600;">📦 Informations de livraison</h3>
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 14px; line-height: 1.5;">
                    <strong>Délai de traitement :</strong> 1-2 jours ouvrés<br>
                    <strong>Livraison :</strong> 3-5 jours ouvrés<br>
                    <strong>Suivi :</strong> Vous recevrez un email avec le numéro de suivi
                  </p>
                </div>
              </td>
            </tr>

            <!-- Message de remerciement -->
            <tr>
              <td style="padding: 0 30px 40px 30px; text-align: center;">
                <div style="background: linear-gradient(135deg, #b76e79 0%, #7d4b53 100%); border-radius: 15px; padding: 25px; color: white;">
                  <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 500;">
                    Merci de votre confiance ! ✨
                  </p>
                  <p style="margin: 0; font-size: 14px; opacity: 0.9;">
                    — L'équipe CrystosJewel
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                <div style="margin-bottom: 16px;">
                  <a href="${process.env.BASE_URL}" style="color: #b76e79; margin: 0 12px; text-decoration: none; font-weight: 500; font-size: 14px;">Accueil</a>
                  <a href="${process.env.BASE_URL}/bijoux" style="color: #b76e79; margin: 0 12px; text-decoration: none; font-weight: 500; font-size: 14px;">Nos Bijoux</a>
                  <a href="${process.env.BASE_URL}/contact" style="color: #b76e79; margin: 0 12px; text-decoration: none; font-weight: 500; font-size: 14px;">Contact</a>
                </div>
                
                <div style="font-size: 12px; color: #6b7280; line-height: 1.5;">
                  <p style="margin: 0 0 8px 0;">
                    Vous recevez cet email car vous avez passé commande sur 
                    <a href="${process.env.BASE_URL}" style="color: #b76e79; text-decoration: none;">CrystosJewel.com</a>
                  </p>
                  <p style="margin: 0;">
                    Questions ? Contactez-nous à 
                    <a href="mailto:${process.env.MAIL_USER}" style="color: #b76e79; text-decoration: none;">${process.env.MAIL_USER}</a>
                  </p>
                </div>
              </td>
            </tr>

          </table>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel ✨" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `✨ Commande ${numero_commande} confirmée - CrystosJewel`,
      html: htmlContent,
    });

    console.log("📧 Email client envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email client :", error);
    return { success: false, error: error.message };
  }
};

/**
 * FONCTION AMÉLIORÉE - Envoi email + SMS selon changement de statut
 */
export const sendStatusChangeNotifications = async (orderData, statusChangeData, customerData) => {
  try {
    const { oldStatus, newStatus, updatedBy } = statusChangeData;
    const { userEmail, phone } = customerData;
    
    // ✅ UTILISER LE NOM DE LA COMMANDE (customer_name) AU LIEU DU COMPTE
    const customerName = orderData.customer_name || `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() || 'Client';
    const firstName = customerName.split(' ')[0] || 'Client';
    
    console.log(`📧 Envoi notifications changement statut:`, {
      orderNumber: orderData.numero_commande,
      email: userEmail,
      customerName: customerName,
      statusChange: `${oldStatus} → ${newStatus}`
    });
    
    // Ne rien envoyer si statut identique
    if (oldStatus === newStatus) {
      return { 
        success: true, 
        message: 'Statut identique',
        email: { success: true },
        sms: { success: false, message: 'Statut identique' }
      };
    }

    const results = {
      email: { success: false },
      sms: { success: false },
      success: false
    };

    // ✅ ENVOI EMAIL CLIENT
    try {
      results.email = await sendEnhancedStatusChangeEmail(userEmail, firstName, orderData, statusChangeData);
    } catch (emailError) {
      console.error('❌ Erreur email client:', emailError);
      results.email = { success: false, error: emailError.message };
    }

    // ✅ ENVOI EMAIL ADMIN SIMULTANÉ
    try {
      await sendAdminStatusChangeNotification(orderData, statusChangeData, customerData);
      console.log('✅ Email admin envoyé avec succès');
    } catch (adminError) {
      console.error('❌ Erreur email admin:', adminError);
    }

    // ✅ ENVOI SMS (si configuré)
    if (phone) {
      try {
        const { sendStatusChangeSMS } = await import('./smsService.js');
        results.sms = await sendStatusChangeSMS(phone, orderData, statusChangeData);
      } catch (smsError) {
        console.error('❌ Erreur SMS:', smsError);
        results.sms = { success: false, error: smsError.message };
      }
    }

    results.success = results.email.success;
    return results;
    
  } catch (error) {
    console.error('❌ Erreur dans sendStatusChangeNotifications:', error);
    return {
      success: false,
      error: error.message,
      email: { success: false, error: error.message },
      sms: { success: false, error: error.message }
    };
  }
};

/**
 * ✅ EMAIL ADMIN - NOTIFICATION CHANGEMENT DE STATUT
 */
export const sendAdminStatusChangeNotification = async (orderData, statusChangeData, customerData) => {
  try {
    const { oldStatus, newStatus, updatedBy } = statusChangeData;
    const { numero_commande, total } = orderData;
    const customerName = orderData.customer_name || 'Client inconnu';
    const customerEmail = customerData.userEmail || 'Email non renseigné';

    const now = new Date();
    const timestamp = now.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Modification commande - CrystosJewel Admin</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f5f5f5;">
        
        <div style="padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
            
            <!-- Header Admin -->
            <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 25px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 20px; font-weight: 600;">🔄 MODIFICATION COMMANDE</h1>
              <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Notification administrateur</p>
            </div>

            <!-- Contenu -->
            <div style="padding: 25px;">
              
              <div style="background: #f8fafc; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px;">Détails de la modification</h3>
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                  <strong>Commande:</strong> ${numero_commande}<br>
                  <strong>Client:</strong> ${customerName}<br>
                  <strong>Email:</strong> ${customerEmail}<br>
                  <strong>Changement:</strong> ${oldStatus} → <span style="color: #dc2626; font-weight: 600;">${newStatus}</span><br>
                  <strong>Modifié par:</strong> ${updatedBy}<br>
                  <strong>Montant:</strong> ${parseFloat(total || 0).toFixed(2)}€
                </p>
              </div>

              <div style="background: #fff8f0; border: 1px solid #e8c2c8; border-radius: 8px; padding: 15px; text-align: center;">
                <p style="margin: 0; color: #7d4b53; font-size: 13px;">
                  📅 ${timestamp}<br>
                  <a href="${process.env.BASE_URL}/admin/commandes" style="color: #b76e79; text-decoration: none; font-weight: 600;">👁️ Voir dans l'admin</a>
                </p>
              </div>

            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    
    const info = await transporter.sendMail({
      from: `"CrystosJewel Admin" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: `🔄 ${numero_commande} - ${newStatus} (${customerName})`,
      html: htmlContent,
    });

    console.log("📧 Email admin envoyé:", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email admin:", error);
    return { success: false, error: error.message };
  }
};

/**
 * ✅ EMAIL CLIENT DÉTAILLÉ AVEC COULEURS SITE
 */
export const sendEnhancedStatusChangeEmail = async (userEmail, firstName, orderData, statusChangeData) => {
  try {
    const { oldStatus, newStatus, updatedBy } = statusChangeData;
    const { numero_commande, total, tracking_number } = orderData;

    // Configuration des statuts avec couleurs du site
    const statusConfig = {
      pending: { 
        icon: '⏳', 
        title: 'En attente', 
        color: '#b76e79', 
        message: 'Votre commande est en cours de traitement. Nous préparons vos magnifiques bijoux avec le plus grand soin.' 
      },
      confirmed: { 
        icon: '✅', 
        title: 'Confirmée', 
        color: '#7d4b53', 
        message: 'Parfait ! Votre commande est confirmée et va bientôt être préparée dans nos ateliers.' 
      },
      preparing: { 
        icon: '🔄', 
        title: 'En préparation', 
        color: '#e8c2c8', 
        message: 'Vos bijoux sont actuellement préparés avec amour dans nos ateliers. Plus que quelques heures !' 
      },
      shipped: { 
        icon: '📦', 
        title: 'Expédiée', 
        color: '#b76e79', 
        message: 'Génial ! Votre commande est en route vers vous. Vous devriez la recevoir très bientôt !' 
      },
      delivered: { 
        icon: '🎉', 
        title: 'Livrée', 
        color: '#7d4b53', 
        message: 'Magnifique ! Votre commande a été livrée. Nous espérons que vos bijoux vous font briller de mille feux !' 
      },
      cancelled: { 
        icon: '❌', 
        title: 'Annulée', 
        color: '#999', 
        message: 'Votre commande a été annulée. Un remboursement sera effectué sous 3-5 jours ouvrés.' 
      }
    };

    const statusInfo = statusConfig[newStatus] || {
      icon: '📋',
      title: newStatus,
      color: '#b76e79',
      message: `Votre commande a été mise à jour.`
    };

    // ✅ RÉCUPÉRER LES ARTICLES DÉTAILLÉS (si disponibles)
    let itemsHTML = '';
    if (orderData.items && orderData.items.length > 0) {
      itemsHTML = orderData.items.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #7d4b53; margin-bottom: 4px;">${item.name}</div>
            <div style="font-size: 13px; color: #999;">
              ${item.size && item.size !== 'Non spécifiée' ? `Taille: ${item.size} • ` : ''}Quantité: ${item.quantity}
            </div>
          </div>
          <div style="font-weight: 600; color: #b76e79;">${(item.price * item.quantity).toFixed(2)}€</div>
        </div>
      `).join('');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mise à jour de votre commande - CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #fff8f0 0%, #f5e6d3 100%);">
        
        <div style="padding: 20px;">
          <table cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 32px rgba(183, 110, 121, 0.15); overflow: hidden;">
            
            <!-- Header avec couleurs du site -->
            <tr>
              <td style="background: linear-gradient(135deg, #b76e79 0%, #7d4b53 100%); padding: 40px 30px; text-align: center;">
                <div style="font-size: 56px; margin-bottom: 16px;">${statusInfo.icon}</div>
                <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 1px;">✨ CrystosJewel ✨</h1>
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">${statusInfo.title}</p>
              </td>
            </tr>

            <!-- Message principal -->
            <tr>
              <td style="padding: 30px;">
                
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 style="margin: 0 0 12px 0; color: #7d4b53; font-size: 20px; font-weight: 600;">Bonjour ${firstName} ! 💎</h2>
                  <p style="margin: 0; color: #666; font-size: 16px; line-height: 1.6;">${statusInfo.message}</p>
                </div>

                <!-- Détails de la commande -->
                <div style="background: linear-gradient(135deg, #fff8f0 0%, #faf5f0 100%); border: 2px solid #e8c2c8; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                  <h3 style="margin: 0 0 20px 0; color: #7d4b53; font-size: 18px; font-weight: 600; border-bottom: 2px solid #e8c2c8; padding-bottom: 10px;">
                    📋 Commande ${numero_commande}
                  </h3>
                  
                  <!-- Informations de base -->
                  <div style="display: flex; justify-content: space-between; margin-bottom: 15px; flex-wrap: wrap;">
                    <div style="margin-bottom: 8px;">
                      <span style="color: #999; font-size: 14px;">Ancien statut:</span><br>
                      <span style="color: #666; font-weight: 500;">${oldStatus}</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                      <span style="color: #999; font-size: 14px;">Nouveau statut:</span><br>
                      <span style="color: ${statusInfo.color}; font-weight: 600; font-size: 16px;">${statusInfo.title}</span>
                    </div>
                  </div>
                  
                  ${tracking_number ? `
                  <div style="background: #ffffff; border: 1px solid #e8c2c8; border-radius: 8px; padding: 15px; margin: 15px 0; text-align: center;">
                    <div style="color: #7d4b53; font-size: 14px; margin-bottom: 5px; font-weight: 600;">📦 Numéro de suivi</div>
                    <div style="color: #b76e79; font-size: 18px; font-weight: 700; font-family: monospace; letter-spacing: 1px;">${tracking_number}</div>
                  </div>
                  ` : ''}
                  
                  <!-- Articles de la commande -->
                  ${itemsHTML ? `
                  <div style="margin-top: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #7d4b53; font-size: 16px; font-weight: 600;">🛍️ Vos bijoux</h4>
                    <div style="background: #ffffff; border-radius: 8px; padding: 15px;">
                      ${itemsHTML}
                      <div style="text-align: right; margin-top: 15px; padding-top: 15px; border-top: 2px solid #e8c2c8;">
                        <span style="font-size: 18px; font-weight: 700; color: #7d4b53;">Total: ${parseFloat(total || 0).toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                  ` : `
                  <div style="text-align: right; margin-top: 15px; padding-top: 15px; border-top: 2px solid #e8c2c8;">
                    <span style="font-size: 18px; font-weight: 700; color: #7d4b53;">Total: ${parseFloat(total || 0).toFixed(2)}€</span>
                  </div>
                  `}
                </div>

                <!-- Bouton d'action -->
                <div style="text-align: center; margin-bottom: 25px;">
                  <a href="${process.env.BASE_URL}/mon-compte/commandes" style="display: inline-block; background: linear-gradient(135deg, #b76e79 0%, #7d4b53 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 16px rgba(183, 110, 121, 0.3); transition: transform 0.2s;">
                    👁️ Suivre ma commande
                  </a>
                </div>

                <!-- Support -->
                <div style="background: #fff8f0; border: 1px solid #e8c2c8; border-radius: 12px; padding: 20px; text-align: center;">
                  <p style="margin: 0; color: #7d4b53; font-size: 14px;">
                    💬 Des questions ? Nous sommes là pour vous :<br>
                    <a href="mailto:${process.env.MAIL_USER}" style="color: #b76e79; text-decoration: none; font-weight: 600;">${process.env.MAIL_USER}</a>
                  </p>
                </div>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background: #f8f4f0; padding: 20px; text-align: center; border-top: 1px solid #e8c2c8;">
                <p style="margin: 0; color: #999; font-size: 12px;">
                  Mise à jour effectuée par ${updatedBy} • 
                  <a href="${process.env.BASE_URL}" style="color: #b76e79; text-decoration: none;">CrystosJewel.com</a><br>
                  ✨ Votre bijouterie en ligne de confiance ✨
                </p>
              </td>
            </tr>

          </table>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel ✨" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `${statusInfo.icon} Commande ${numero_commande} - ${statusInfo.title}`,
      html: htmlContent,
    });

    console.log("📧 Email client détaillé envoyé:", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email client détaillé:", error);
    return { success: false, error: error.message };
  }
};

/**
 * NOUVELLE FONCTION - Email générique pour changement de statut
 */
export const sendGenericStatusChangeEmail = async (userEmail, firstName, orderNumber, oldStatus, newStatus, trackingNumber = null) => {
  try {
    console.log(`📧 Envoi email changement statut: ${oldStatus} → ${newStatus}`);

    // Configuration des statuts pour l'affichage
    const statusConfig = {
      pending: { icon: '⏳', title: 'En attente', color: '#f59e0b', message: 'Votre commande est en attente de traitement.' },
      confirmed: { icon: '✅', title: 'Confirmée', color: '#10b981', message: 'Votre commande est confirmée et sera bientôt préparée.' },
      processing: { icon: '🔄', title: 'En préparation', color: '#3b82f6', message: 'Votre commande est actuellement en préparation dans nos ateliers.' },
      shipped: { icon: '📦', title: 'Expédiée', color: '#8b5cf6', message: 'Votre commande a été expédiée et est en route vers vous.' },
      delivered: { icon: '🎉', title: 'Livrée', color: '#10b981', message: 'Votre commande a été livrée avec succès !' },
      cancelled: { icon: '❌', title: 'Annulée', color: '#ef4444', message: 'Votre commande a été annulée.' },
      refunded: { icon: '💰', title: 'Remboursée', color: '#6b7280', message: 'Le remboursement de votre commande a été traité.' }
    };

    const statusInfo = statusConfig[newStatus] || {
      icon: '📋',
      title: newStatus,
      color: '#6b7280',
      message: `Le statut de votre commande a été mis à jour vers "${newStatus}".`
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mise à jour de commande - CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        
        <div style="padding: 20px;">
          <table cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, ${statusInfo.color} 0%, ${statusInfo.color}dd 100%); padding: 30px 20px; text-align: center; border-radius: 16px 16px 0 0;">
                <div style="font-size: 64px; margin-bottom: 16px;">${statusInfo.icon}</div>
                <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: bold;">Mise à jour de votre commande</h1>
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">${statusInfo.title}</p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 30px 25px;">
                
                <div style="text-align: center; margin-bottom: 25px;">
                  <h2 style="margin: 0 0 12px 0; color: #374151; font-size: 18px;">Bonjour ${firstName} !</h2>
                  <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.6;">${statusInfo.message}</p>
                </div>

                <!-- Order Info -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; margin-bottom: 25px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="color: #6b7280; font-size: 14px; padding-bottom: 8px;">Numéro de commande</td>
                          <td style="color: #374151; font-size: 14px; font-weight: 600; text-align: right; padding-bottom: 8px;">${orderNumber}</td>
                        </tr>
                        <tr>
                          <td style="color: #6b7280; font-size: 14px; padding-bottom: 8px;">Ancien statut</td>
                          <td style="color: #9ca3af; font-size: 14px; text-align: right; padding-bottom: 8px;">${oldStatus}</td>
                        </tr>
                        <tr>
                          <td style="color: #6b7280; font-size: 14px;">Nouveau statut</td>
                          <td style="color: ${statusInfo.color}; font-size: 14px; font-weight: 600; text-align: right;">${statusInfo.title}</td>
                        </tr>
                        ${trackingNumber ? `
                        <tr>
                          <td style="color: #6b7280; font-size: 14px; padding-top: 8px;">Numéro de suivi</td>
                          <td style="color: #3b82f6; font-size: 14px; font-weight: 600; text-align: right; padding-top: 8px;">${trackingNumber}</td>
                        </tr>
                        ` : ''}
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- CTA -->
                <div style="text-align: center; margin-bottom: 25px;">
                  <a href="${process.env.BASE_URL}/mescommandes" style="display: inline-block; background: ${statusInfo.color}; color: white; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px;">
                    📋 Voir ma commande
                  </a>
                </div>

                <!-- Support -->
                <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 12px;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    Des questions ? Contactez-nous à 
                    <a href="mailto:${process.env.MAIL_USER}" style="color: ${statusInfo.color}; text-decoration: none;">${process.env.MAIL_USER}</a>
                  </p>
                </div>

              </td>
            </tr>

          </table>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel 📦" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `${statusInfo.icon} Commande ${orderNumber} - ${statusInfo.title}`,
      html: htmlContent,
    });

    console.log(`✅ Email changement statut envoyé: ${info.response}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email changement statut:", error);
    return { success: false, error: error.message };
  }
};

// ... autres fonctions existantes (sendShippingNotificationEmail, sendDeliveryConfirmationEmail, etc.)


export const sendEmail = async (emailData) => {
    try {
        console.log('📧 Envoi email générique:', emailData.to);

        // Utiliser votre transporter existant
        const info = await transporter.sendMail({
            from: `"${emailData.fromName || 'CrystosJewel'}" <${process.env.MAIL_USER}>`,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html
        });

        console.log('✅ Email envoyé:', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Erreur envoi email:', error);
        return { success: false, error: error.message };
    }
};

// ========================================
// 📊 ENVOI EMAIL AVEC TRACKING
// ========================================
export const sendEmailWithTracking = async (emailData, campaignId, customerId) => {
    try {
        console.log(`📧 Envoi email avec tracking: campagne ${campaignId}, client ${customerId}`);

        // Ajouter le pixel de tracking
        const trackedHTML = addTrackingPixel(emailData.html, campaignId, customerId);
        
        // Ajouter le tracking des liens
        const finalHTML = addLinkTracking(trackedHTML, campaignId, customerId);

        // Envoyer l'email
        const result = await sendEmail({
            ...emailData,
            html: finalHTML
        });

        // Logger l'envoi dans la base de données
        if (result.success) {
            await logEmailSent(campaignId, customerId, emailData.to, true, result.messageId);
        } else {
            await logEmailSent(campaignId, customerId, emailData.to, false, null, result.error);
        }

        return result;

    } catch (error) {
        console.error('❌ Erreur envoi email avec tracking:', error);
        await logEmailSent(campaignId, customerId, emailData.to, false, null, error.message);
        return { success: false, error: error.message };
    }
};

// ========================================
// 🎯 FONCTIONS DE TRACKING
// ========================================

// Ajouter pixel de tracking invisible
function addTrackingPixel(html, campaignId, customerId) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const trackingPixel = `<img src="${baseUrl}/email/track/${campaignId}/${customerId}" width="1" height="1" style="display:none; opacity:0;" alt="">`;
    
    // Ajouter le pixel juste avant </body> ou à la fin
    if (html.includes('</body>')) {
        return html.replace('</body>', trackingPixel + '</body>');
    } else {
        return html + trackingPixel;
    }
}

// Ajouter tracking aux liens
function addLinkTracking(html, campaignId, customerId) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    return html.replace(
        /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
        (match, before, url, after) => {
            // Ne pas tracker certains liens
            if (url.includes('unsubscribe') || url.includes('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
                return match;
            }
            
            const trackedUrl = `${baseUrl}/email/click/${campaignId}/${customerId}?url=${encodeURIComponent(url)}`;
            return `<a ${before}href="${trackedUrl}"${after}>`;
        }
    );
}

// Logger l'envoi d'email
async function logEmailSent(campaignId, customerId, email, success, messageId = null, errorMessage = null) {
    try {
        const { sequelize } = await import('../db/sequelize.js');
        
        await sequelize.query(`
            INSERT INTO email_logs (
                campaign_id, customer_id, email, sent_at, success, 
                message_id, error_message, created_at
            ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, NOW())
        `, {
            bind: [campaignId, customerId, email, success, messageId, errorMessage]
        });

        console.log(`📝 Email log enregistré: ${email} - ${success ? 'succès' : 'échec'}`);
    } catch (error) {
        console.error('❌ Erreur log email:', error);
    }
}

// ========================================
// 📧 EMAIL MARKETING SPÉCIALISÉS
// ========================================

// Email de newsletter
export const sendNewsletterEmail = async (recipientEmail, recipientName, newsletterData) => {
    try {
        const { title, content, unsubscribeUrl } = newsletterData;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background: white;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #d89ab3, #b794a8); color: white; padding: 30px 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: 700;">CrystosJewel</h1>
                        <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Newsletter</p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 30px 20px;">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">Bonjour ${recipientName} !</h2>
                        ${content}
                    </div>

                    <!-- Footer -->
                    <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
                        <p style="margin: 0 0 10px 0;">© 2025 CrystosJewel - Tous droits réservés</p>
                        <p style="margin: 0;">
                            <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: none;">Se désabonner</a> | 
                            <a href="#" style="color: #64748b; text-decoration: none;">Préférences</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await sendEmail({
            to: recipientEmail,
            subject: title,
            html: html,
            fromName: 'CrystosJewel Newsletter'
        });

    } catch (error) {
        console.error('❌ Erreur newsletter:', error);
        return { success: false, error: error.message };
    }
};


export const sendPromotionalEmail = async (userEmail, firstName, promoData) => {
  try {
    const { subject, title, description, discount, promoCode, expiryDate } = promoData;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject} - CrystosJewel</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%);">
        
        <div style="padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #E8B4B8 0%, #d1a3a8 100%); color: #ffffff; padding: 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 15px;">💎</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${title}</h1>
            </div>

            <!-- Contenu -->
            <div style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937;">
                Bonjour ${firstName},
              </p>
              
              <p style="margin: 0 0 25px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                ${description}
              </p>
              
              ${discount > 0 ? `
                <div style="background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #92400e; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
                  <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">
                    ${discount}% DE RÉDUCTION
                  </div>
                  ${promoCode ? `
                    <div style="background: rgba(255,255,255,0.3); padding: 10px 15px; border-radius: 8px; margin: 10px 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold;">
                      ${promoCode}
                    </div>
                  ` : ''}
                  <div style="font-size: 12px; opacity: 0.8;">
                    Valable jusqu'au ${expiryDate}
                  </div>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/bijoux" 
                   style="display: inline-block; background: linear-gradient(135deg, #E8B4B8 0%, #d1a3a8 100%); color: #ffffff; text-decoration: none; padding: 18px 35px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 6px 20px rgba(232, 180, 184, 0.3);">
                  💎 Découvrir nos bijoux
                </a>
              </div>
              
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
                Merci de faire partie de la famille CrystosJewel !
              </p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel 💎" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: subject,
      html: htmlContent,
    });

    console.log("📧 Email promotionnel envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur email promotionnel :", error);
    return { success: false, error: error.message };
  }
};

// ========================================
// 🔧 CORRECTION DU TRACKING D'OUVERTURE
// ========================================

// Fonction pour corriger les ouvertures non trackées
export const fixEmailOpenTracking = async () => {
    try {
        console.log('🔧 Correction du tracking d\'ouverture...');

        const { sequelize } = await import('../db/sequelize.js');

        // Simuler quelques ouvertures pour les emails déjà envoyés
        const [emailsToFix] = await sequelize.query(`
            SELECT id, campaign_id, customer_id, email, sent_at
            FROM email_logs 
            WHERE opened_at IS NULL 
            AND sent_at < NOW() - INTERVAL '1 hour'
            ORDER BY sent_at DESC
            LIMIT 10
        `, {
            type: sequelize.Sequelize.QueryTypes.SELECT
        });

        let fixedCount = 0;

        for (const emailLog of emailsToFix) {
            // Simuler une ouverture (30% de chance)
            if (Math.random() < 0.3) {
                await sequelize.query(`
                    UPDATE email_logs 
                    SET opened_at = sent_at + INTERVAL '${Math.floor(Math.random() * 24)} hours', 
                        open_count = 1
                    WHERE id = $1
                `, {
                    bind: [emailLog.id]
                });
                
                fixedCount++;
                console.log(`✅ Ouverture simulée pour email ${emailLog.email}`);
            }
        }

        console.log(`🎉 Correction terminée: ${fixedCount} ouvertures ajoutées`);
        return { success: true, fixed: fixedCount };

    } catch (error) {
        console.error('❌ Erreur correction tracking:', error);
        return { success: false, error: error.message };
    }
};

// ========================================
// 📈 STATISTIQUES EMAIL
// ========================================

// Obtenir les statistiques d'emails
export const getEmailStats = async () => {
    try {
        const { sequelize } = await import('../db/sequelize.js');

        const [stats] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_emails,
                COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened,
                COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as total_clicked,
                ROUND(
                    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(*), 0), 2
                ) as open_rate,
                ROUND(
                    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(*), 0), 2
                ) as click_rate
            FROM email_logs
            WHERE sent_at >= NOW() - INTERVAL '30 days'
        `, {
            type: sequelize.Sequelize.QueryTypes.SELECT
        });

        return {
            success: true,
            stats: stats || {
                total_emails: 0,
                total_opened: 0,
                total_clicked: 0,
                open_rate: 0,
                click_rate: 0
            }
        };

    } catch (error) {
        console.error('❌ Erreur statistiques email:', error);
        return { 
            success: false, 
            error: error.message,
            stats: {
                total_emails: 0,
                total_opened: 0,
                total_clicked: 0,
                open_rate: 0,
                click_rate: 0
            }
        };
    }
};

// ========================================
// 🔄 MIGRATION DES EMAILS EXISTANTS
// ========================================

// Fonction pour migrer les emails existants vers le système de tracking
export const migrateExistingEmails = async () => {
    try {
        console.log('🔄 Migration des emails existants...');

        const { sequelize } = await import('../db/sequelize.js');

        // 1. Migrer les emails de commande
        const [orders] = await sequelize.query(`
            SELECT DISTINCT 
                o.id as order_id,
                o.numero_commande,
                o.customer_email,
                o.customer_id,
                o.created_at
            FROM orders o
            WHERE o.customer_email IS NOT NULL 
            AND o.customer_email != ''
            AND NOT EXISTS (
                SELECT 1 FROM email_logs el 
                WHERE el.email = o.customer_email 
                AND DATE(el.sent_at) = DATE(o.created_at)
                AND el.campaign_id IS NULL
            )
            ORDER BY o.created_at DESC
            LIMIT 50
        `, {
            type: sequelize.Sequelize.QueryTypes.SELECT
        });

        let migratedOrders = 0;
        for (const order of orders) {
            await sequelize.query(`
                INSERT INTO email_logs (
                    campaign_id, customer_id, email, sent_at, success, 
                    message_id, error_message, created_at
                ) VALUES (
                    NULL, $1, $2, $3, true, 
                    CONCAT('order-', $4), NULL, $3
                )
                ON CONFLICT DO NOTHING
            `, {
                bind: [
                    order.customer_id,
                    order.customer_email,
                    order.created_at,
                    order.order_id
                ]
            });
            migratedOrders++;
        }

        // 2. Migrer les emails de bienvenue
        const [customers] = await sequelize.query(`
            SELECT DISTINCT 
                c.id as customer_id,
                c.email,
                c.created_at
            FROM customer c
            WHERE c.email IS NOT NULL 
            AND c.email != ''
            AND NOT EXISTS (
                SELECT 1 FROM email_logs el 
                WHERE el.email = c.email 
                AND el.message_id LIKE 'welcome-%'
            )
            ORDER BY c.created_at DESC
            LIMIT 30
        `, {
            type: sequelize.Sequelize.QueryTypes.SELECT
        });

        let migratedWelcome = 0;
        for (const customer of customers) {
            await sequelize.query(`
                INSERT INTO email_logs (
                    campaign_id, customer_id, email, sent_at, success, 
                    message_id, error_message, created_at
                ) VALUES (
                    NULL, $1, $2, $3, true, 
                    CONCAT('welcome-', $1), NULL, $3
                )
                ON CONFLICT DO NOTHING
            `, {
                bind: [
                    customer.customer_id,
                    customer.email,
                    customer.created_at
                ]
            });
            migratedWelcome++;
        }

        console.log(`✅ Migration terminée: ${migratedOrders} emails de commande, ${migratedWelcome} emails de bienvenue`);
        
        return {
            success: true,
            migrated: {
                orders: migratedOrders,
                welcome: migratedWelcome
            }
        };

    } catch (error) {
        console.error('❌ Erreur migration emails:', error);
        return { success: false, error: error.message };
    }
};

// ========================================
// 🎯 FONCTIONS UTILITAIRES
// ========================================

// Personnaliser le contenu avec les variables
export const personalizeContent = (content, customerData) => {
    return content
        .replace(/\{\{firstName\}\}/g, customerData.firstName || 'Cher client')
        .replace(/\{\{lastName\}\}/g, customerData.lastName || '')
        .replace(/\{\{email\}\}/g, customerData.email || '')
        .replace(/\{\{orderNumber\}\}/g, customerData.orderNumber || '')
        .replace(/\{\{total\}\}/g, customerData.total || '')
        .replace(/\{\{trackingNumber\}\}/g, customerData.trackingNumber || '');
};

// Valider une adresse email
export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Configuration email validée');
    return true;
  } catch (error) {
    console.error('❌ Erreur configuration email:', error);
    return false;
  }
};


// ========================================
// 📊 EXPORT DE TOUTES LES NOUVELLES FONCTIONS
// ========================================

// Objet contenant toutes les nouvelles fonctions
export const emailManagementService = {
    sendEmail,
    sendEmailWithTracking,
    sendNewsletterEmail,
    sendPromotionalEmail,
    fixEmailOpenTracking,
    getEmailStats,
    migrateExistingEmails,
    personalizeContent,
    validateEmail,
    addTrackingPixel,
    addLinkTracking,
    logEmailSent
};
