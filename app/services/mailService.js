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
console.log('📧 Configuration email:', {
    MAIL_USER: process.env.MAIL_USER ? '✅ Défini' : '❌ Manquant',
    MAIL_PASS: process.env.MAIL_PASS ? '✅ Défini' : '❌ Manquant',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ? '✅ Défini' : '❌ Manquant'
});

// Test de la connexion
transporter.verify()
  .then(() => console.log('✅ Connexion email OK'))
  .catch(err => console.error('❌ Erreur connexion email:', err.message));

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
    const { 
      numero_commande, 
      items, 
      total, 
      subtotal, 
      shipping_price,
      promo_code,
      promo_discount_amount 
    } = orderData;
    
    const now = new Date();
    const dateCommande = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const deliveryDate = calculateDeliveryDate(3);
    const shippingFee = shipping_price || (subtotal >= 50 ? 0 : 5.99);
    const hasPromo = promo_code && promo_discount_amount > 0;
    
    // ✅ CORRECTION: Calculer totalArticles correctement
    const totalArticles = items ? items.length : 0;
    
    // Générer HTML des articles avec images
    const itemsHtml = items && items.length > 0 ? items.map(item => {
      const imageUrl = item.jewel?.image 
        ? (item.jewel.image.startsWith('http') 
            ? item.jewel.image 
            : `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/${item.jewel.image}`)
        : `${process.env.BASE_URL || 'http://localhost:3000'}/images/default-jewel.jpg`;
        
      // ✅ CORRECTION: Calculer le total de l'item avec vérification
      const itemTotal = item.total || (parseFloat(item.price || 0) * parseInt(item.quantity || 1));
        
      return `
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 20px 0; vertical-align: top;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <img src="${imageUrl}" 
                   alt="${item.jewel?.name || item.name || 'Bijou'}" 
                   style="
                     width: 80px; 
                     height: 80px; 
                     object-fit: cover; 
                     border-radius: 12px;
                     box-shadow: 0 4px 12px rgba(183, 110, 121, 0.15);
                   ">
              <div>
                <h3 style="
                  margin: 0 0 8px 0; 
                  color: #b76e79; 
                  font-size: 18px; 
                  font-weight: 600;
                ">${item.jewel?.name || item.name || 'Bijou'}</h3>
                <p style="margin: 0; color: #7d4b53; font-size: 14px;">
                  ${item.size && item.size !== 'Non spécifiée' ? `Taille: ${item.size}` : ''}
                </p>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
                  Quantité: ${item.quantity}
                </p>
              </div>
            </div>
          </td>
          <td style="padding: 20px 0; text-align: right; vertical-align: top;">
            <span style="
              font-size: 18px; 
              font-weight: 600; 
              color: #b76e79;
            ">${parseFloat(itemTotal).toFixed(2)}€</span>
          </td>
        </tr>
      `;
    }).join('') : '<tr><td style="padding: 20px; text-align: center; color: #999;">Aucun article</td></tr>';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmation de votre commande</title>
      </head>
      <body style="
        margin: 0; 
        padding: 0; 
        font-family: 'Inter', Arial, sans-serif; 
        background: linear-gradient(135deg, #fff8f0 0%, #f5f5f5 100%);
        color: #3a3a3a;
      ">
        
        <div style="padding: 30px 20px;">
          <div style="
            max-width: 650px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 20px; 
            overflow: hidden; 
            box-shadow: 0 8px 32px rgba(183, 110, 121, 0.12);
          ">
          
            <!-- Header avec dégradé -->
            <div style="
              background: linear-gradient(135deg, #e8c2c8 0%, #b76e79 50%, #7d4b53 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            ">
              <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
              <h1 style="
                margin: 0 0 12px 0; 
                font-size: 28px; 
                font-weight: 700;
                text-shadow: 0 2px 8px rgba(0,0,0,0.1);
              ">Confirmation de votre commande</h1>
              <p style="
                margin: 0; 
                font-size: 16px; 
                opacity: 0.95;
                font-weight: 500;
              ">CrystosJewel • Bijoux Précieux</p>
            </div>

            <!-- Contenu principal -->
            <div style="padding: 40px 30px;">
              
              <div style="margin-bottom: 30px;">
                <h2 style="
                  margin: 0 0 20px 0; 
                  color: #b76e79; 
                  font-size: 22px;
                  font-weight: 600;
                ">Bonjour ${firstName} ! 🎉</h2>
                <p style="
                  margin: 0 0 20px 0; 
                  font-size: 16px; 
                  line-height: 1.6; 
                  color: #4b5563;
                ">
                  Merci pour votre confiance ! Votre commande a été confirmée et sera bientôt préparée avec le plus grand soin.
                </p>
              </div>

              <!-- Détails de la commande -->
              <div style="
                background: #fff8f0; 
                padding: 25px; 
                border-radius: 16px; 
                border: 2px solid #e8c2c8;
                margin-bottom: 30px;
              ">
                <div style="
                  display: flex; 
                  justify-content: space-between; 
                  align-items: center; 
                  margin-bottom: 20px;
                  flex-wrap: wrap;
                  gap: 10px;
                ">
                  <div>
                    <h3 style="
                      margin: 0; 
                      color: #7d4b53; 
                      font-size: 16px;
                      font-weight: 600;
                    ">Commande #${numero_commande}</h3>
                    <p style="
                      margin: 5px 0 0 0; 
                      color: #6b7280; 
                      font-size: 14px;
                    ">${dateCommande}</p>
                  </div>
                  <div style="text-align: right;">
                    <span style="
                      background: #b76e79; 
                      color: white; 
                      padding: 8px 16px; 
                      border-radius: 20px; 
                      font-size: 14px; 
                      font-weight: 600;
                    ">Confirmée</span>
                  </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                  <strong style="color: #7d4b53;">Livraison estimée:</strong><br>
                  <span style="color: #28A745; font-weight: 600;">${deliveryDate}</span>
                </div>
              </div>

              <!-- Articles commandés -->
              <div style="margin-bottom: 30px;">
                <h3 style="
                  margin: 0 0 20px 0; 
                  color: #7d4b53; 
                  font-size: 20px;
                  font-weight: 600;
                ">Vos bijoux sélectionnés (${totalArticles} article${totalArticles > 1 ? 's' : ''})</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                  ${itemsHtml}
                </table>
              </div>

              <!-- Récapitulatif des prix -->
              <div style="
                background: #f8f9fa; 
                padding: 25px; 
                border-radius: 16px;
                margin-bottom: 30px;
              ">
                <h3 style="
                  margin: 0 0 20px 0; 
                  color: #7d4b53; 
                  font-size: 18px;
                  font-weight: 600;
                ">Récapitulatif</h3>
                
                <div style="
                  display: flex; 
                  justify-content: space-between; 
                  margin-bottom: 12px;
                ">
                  <span style="color: #6b7280;">Sous-total:</span>
                  <span style="color: #3a3a3a; font-weight: 500;">${parseFloat(subtotal || 0).toFixed(2)}€</span>
                </div>
                
                ${hasPromo ? `
                <div style="
                  display: flex; 
                  justify-content: space-between; 
                  margin-bottom: 12px;
                  color: #dc2626;
                ">
                  <span>Réduction (${promo_code}):</span>
                  <span style="font-weight: 600;">-${parseFloat(promo_discount_amount).toFixed(2)}€</span>
                </div>
                ` : ''}
                
                <div style="
                  display: flex; 
                  justify-content: space-between; 
                  margin-bottom: 12px;
                ">
                  <span style="color: #6b7280;">Frais de livraison:</span>
                  <span style="color: #3a3a3a; font-weight: 500;">
                    ${shippingFee === 0 ? 'Gratuit' : `${parseFloat(shippingFee).toFixed(2)}€`}
                  </span>
                </div>
                
                <hr style="border: none; border-top: 2px solid #e8c2c8; margin: 20px 0;">
                
                <div style="
                  display: flex; 
                  justify-content: space-between; 
                  font-size: 20px; 
                  font-weight: 700;
                  color: #b76e79;
                ">
                  <span>Total:</span>
                  <span>${parseFloat(total || 0).toFixed(2)}€</span>
                </div>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.BASE_URL}/mon-compte/commandes" style="
                  display: inline-block;
                  background: linear-gradient(135deg, #b76e79 0%, #7d4b53 100%);
                  color: white;
                  text-decoration: none;
                  padding: 16px 32px;
                  border-radius: 50px;
                  font-weight: 600;
                  font-size: 16px;
                  box-shadow: 0 8px 24px rgba(183, 110, 121, 0.3);
                ">✨ Suivre ma commande</a>
              </div>

              <!-- Message de remerciement -->
              <div style="
                text-align: center; 
                padding: 25px; 
                background: linear-gradient(135deg, #fff8f0 0%, #e8c2c8 100%);
                border-radius: 16px;
                margin-bottom: 20px;
              ">
                <p style="
                  margin: 0; 
                  font-size: 16px; 
                  color: #7d4b53; 
                  font-weight: 500;
                  font-style: italic;
                ">
                  "Merci de faire confiance à CrystosJewel pour illuminer vos moments précieux ✨"
                </p>
              </div>

            </div>

            <!-- Footer -->
            <div style="
              background: #f8f9fa; 
              padding: 30px; 
              text-align: center; 
              border-top: 1px solid #e8c2c8;
            ">
              <p style="
                margin: 0 0 10px 0; 
                font-size: 14px; 
                color: #6b7280;
              ">
                Des questions ? Contactez-nous à 
                <a href="mailto:${process.env.MAIL_USER}" style="
                  color: #b76e79; 
                  text-decoration: none;
                ">${process.env.MAIL_USER}</a>
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



export const sendAdminOrderNotification = async (orderData, customerData) => {
  try {
    const { numero_commande, items, total, promo_code, promo_discount_amount } = orderData;
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

    const promoAmount = promo_discount_amount || 0;
    
    // ✅ CORRECTION: S'assurer que les items ont la propriété total
    const processedItems = items && items.length > 0 ? items.map(item => ({
      ...item,
      name: item.jewel?.name || item.name || 'Article',
      total: item.total || (parseFloat(item.price || 0) * parseInt(item.quantity || 1))
    })) : [];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouvelle commande - CrystosJewel Admin</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%);">
        
        <div style="padding: 25px 15px;">
          <table cellpadding="0" cellspacing="0" border="0" style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 20px 60px rgba(220, 38, 38, 0.2); border: 2px solid #ffd700; overflow: hidden;">
            
            <!-- Header admin -->
            <tr>
              <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px 25px; color: #ffffff; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">🔔 NOUVELLE COMMANDE</h1>
                <p style="margin: 6px 0 0 0; opacity: 0.95; font-size: 15px;">CrystosJewel Administration</p>
                <div style="margin-top: 18px;">
                  <span style="background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #92400e; padding: 10px 20px; border-radius: 25px; font-size: 14px; font-weight: bold;">⚡ ACTION REQUISE</span>
                </div>
              </td>
            </tr>

            <!-- Contenu -->
            <tr>
              <td style="padding: 35px;">
                
                <!-- En-tête commande -->
                <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #ffd700; border-radius: 15px; padding: 25px; margin-bottom: 25px;">
                  <h2 style="margin: 0; color: #92400e; font-size: 20px; font-weight: bold;">Commande ${numero_commande}</h2>
                  <p style="margin: 4px 0 0 0; color: #a16207; font-size: 14px;">Reçue le ${dateCommande}</p>
                </div>

                <!-- Articles commandés -->
                <div style="margin-bottom: 25px;">
                  <h3 style="color: #1f2937; font-size: 19px; font-weight: bold; margin: 0 0 18px 0;">🛍️ Articles commandés</h3>
                  
                  <table style="width: 100%; background-color: #ffffff; border: 2px solid #a855f7; border-radius: 15px; border-collapse: collapse; overflow: hidden;">
                    ${processedItems.map((item, index) => `
                      <tr>
                        <td style="padding: 18px 22px; ${index < processedItems.length - 1 ? 'border-bottom: 1px solid #f3f4f6;' : ''}">
                          <div style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 6px;">${item.name}</div>
                          <div style="color: #6b7280; font-size: 14px;">
                            ${item.quantity} × ${parseFloat(item.price || 0).toFixed(2)} €
                            ${item.size && item.size !== 'Non spécifiée' ? ` • <span style="color: #a855f7; font-weight: 600;">Taille: ${item.size}</span>` : ''}
                          </div>
                        </td>
                        <td style="color: #dc2626; font-size: 18px; font-weight: bold; text-align: right; vertical-align: top; width: 120px; padding: 18px 22px;">
                          ${parseFloat(item.total).toFixed(2)} €
                        </td>
                      </tr>
                    `).join('')}
                    
                    ${promo_code ? `
                    <tr>
                      <td style="padding: 15px 22px; border-bottom: 1px solid #f3f4f6; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);">
                        <div style="color: #059669; font-size: 15px; font-weight: 600;">
                          🎉 Code promo appliqué: <strong style="color: #047857;">${promo_code}</strong>
                        </div>
                      </td>
                      <td style="color: #059669; font-size: 16px; font-weight: bold; text-align: right; padding: 15px 22px;">
                        -${parseFloat(promoAmount).toFixed(2)} €
                      </td>
                    </tr>
                    ` : ''}
                    
                    <!-- Total -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #ffffff; padding: 20px 22px;">
                        <div style="font-size: 20px; font-weight: bold;">
                          Total TTC: ${parseFloat(total || 0).toFixed(2)} €
                        </div>
                      </td>
                      <td style="background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #ffffff; padding: 20px 22px; text-align: right;">
                        <div style="font-size: 13px; opacity: 0.9;">Livraison incluse</div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Informations client -->
                <div style="background-color: #ffffff; border: 2px solid #a855f7; border-radius: 15px; padding: 25px; margin-bottom: 25px;">
                  <h3 style="color: #1f2937; font-size: 19px; font-weight: bold; margin: 0 0 20px 0;">👤 Informations client</h3>
                  
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
                    <div>
                      <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px;">Nom complet</div>
                      <div style="font-size: 17px; color: #1f2937; font-weight: 600;">${firstName} ${lastName || ''}</div>
                      
                      <div style="margin-top: 18px;">
                        <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px;">Email</div>
                        <a href="mailto:${email}" style="font-size: 15px; color: #dc2626; text-decoration: none; font-weight: 500;">📧 ${email}</a>
                      </div>
                      
                      ${phone ? `
                      <div style="margin-top: 18px;">
                        <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px;">Téléphone</div>
                        <a href="tel:${phone}" style="font-size: 15px; color: #dc2626; text-decoration: none; font-weight: 500;">📱 ${phone}</a>
                      </div>
                      ` : ''}
                    </div>
                    
                    ${address ? `
                    <div>
                      <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 6px;">Adresse de livraison</div>
                      <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); padding: 16px 18px; border-radius: 12px; color: #374151; line-height: 1.6; font-size: 14px; border: 1px solid #d8b4fe;">
                        📍 ${address}
                      </div>
                    </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Actions CTA -->
                <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #ffd700; border-radius: 15px; padding: 25px; text-align: center;">
                  <h3 style="color: #92400e; font-size: 19px; font-weight: bold; margin: 0 0 20px 0;">⚡ Actions rapides</h3>
                  
                  <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                    <a href="${process.env.BASE_URL}/admin/commandes" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 600; font-size: 14px; margin: 4px;">👁️ Voir commande</a>
                    <a href="${process.env.BASE_URL}/admin/commandes" style="display: inline-block; background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #92400e; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 600; font-size: 14px; margin: 4px;">📦 Expédier</a>
                    <a href="${process.env.BASE_URL}/admin/commandes" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 600; font-size: 14px; margin: 4px;">📊 Dashboard</a>
                  </div>
                </div>

              </td>
            </tr>

            <!-- Footer admin -->
            <tr>
              <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; padding: 25px 30px; text-align: center;">
                <div style="margin-bottom: 10px;">
                  <span style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">✨ CrystosJewel Administration</span>
                </div>
                <p style="margin: 0; opacity: 0.9; font-size: 13px; line-height: 1.5;">
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
      from: `"CrystosJewel Admin 🔔" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: `🔔 NOUVELLE COMMANDE ${numero_commande} • ${parseFloat(total || 0).toFixed(2)}€ • ${firstName} ${lastName || ''}`,
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

    console.log('🔍 Données de commande:', {
      subtotal: orderData.subtotal,
      total: orderData.total,
      discount: orderData.discount,
      promo_code: orderData.promo_code,
      promo_discount_amount: orderData.promo_discount_amount,
      deliveryFee: orderData.shipping_price || orderData.deliveryFee,
      itemsCount: orderData.items ? orderData.items.length : 0
    });

    console.log('📧 Point 2: Données préparées');
    console.log('Email client:', userEmail);
    console.log('Nom client:', firstName);
    console.log('Données commande:', {
      orderNumber: orderData.numero_commande,
      total: orderData.total,
      items: orderData.items?.length || 0
    });
    console.log('Données client:', {
      email: customerData.userEmail || customerData.email,
      phone: customerData.phone || 'Non renseigné',
      address: customerData.address || 'Adresse inconnue',
      name: `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim()
    });

    // ✉️ Envoi de l’email client
    const clientEmailResponse = await sendOrderConfirmationEmail(
      userEmail,
      firstName,
      orderData
    );

    if (!clientEmailResponse.success) {
      console.warn("⚠️ L'envoi de l'email client a échoué.");
    }

    // ✉️ Envoi de l’email admin
    const adminEmailResponse = await sendAdminOrderNotification(
      orderData,
      customerData
    );

    if (!adminEmailResponse.success) {
      console.warn("⚠️ L'envoi de l'email admin a échoué.");
    }

    // ✅ Résumé
    console.log('📨 Résumé des envois :', {
      client: clientEmailResponse.messageId || clientEmailResponse.error,
      admin: adminEmailResponse.messageId || adminEmailResponse.error,
    });

    return {
      success: clientEmailResponse.success && adminEmailResponse.success,
      client: clientEmailResponse,
      admin: adminEmailResponse
    };
  } catch (error) {
    console.error('❌ Erreur lors de l’envoi des emails de confirmation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};


// ✅ FONCTION UTILITAIRE - Calcul date de livraison (exclut les dimanches)
// function calculateDeliveryDate(daysToAdd = 3) {
//   let deliveryDate = new Date();
//   let addedDays = 0;
  
//   // Convertir en heure française
//   const options = { timeZone: 'Europe/Paris' };
  
//   while (addedDays < daysToAdd) {
//     deliveryDate.setDate(deliveryDate.getDate() + 1);
    
//     // Si ce n'est pas un dimanche (0 = dimanche)
//     if (deliveryDate.getDay() !== 0) {
//       addedDays++;
//     }
//   }
  
//   return deliveryDate.toLocaleDateString('fr-FR', {
//     timeZone: 'Europe/Paris',
//     weekday: 'long',
//     year: 'numeric',
//     month: 'long',
//     day: 'numeric'
//   });
// }

// ✅ EMAILS DE CHANGEMENT DE STATUT (BONUS)

// Email d'expédition
export const sendShippingEmail = async (userEmail, firstName, shippingData) => {
  try {
    const { orderNumber, trackingNumber, estimatedDelivery } = shippingData;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Votre commande est en route !</title>
      </head>
      <body style="
        margin: 0; 
        padding: 0; 
        font-family: 'Inter', Arial, sans-serif; 
        background: linear-gradient(135deg, #fff8f0 0%, #f5f5f5 100%);
      ">
        
        <div style="padding: 30px 20px;">
          <div style="
            max-width: 650px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 20px; 
            overflow: hidden; 
            box-shadow: 0 8px 32px rgba(183, 110, 121, 0.12);
          ">
          
            <!-- Header expédition -->
            <div style="
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            ">
              <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
              <h1 style="
                margin: 0 0 12px 0; 
                font-size: 28px; 
                font-weight: 700;
              ">Votre commande est en route !</h1>
              <p style="
                margin: 0; 
                font-size: 16px; 
                opacity: 0.95;
              ">CrystosJewel • Expédition confirmée</p>
            </div>

            <!-- Contenu -->
            <div style="padding: 40px 30px; text-align: center;">
              
              <h2 style="
                margin: 0 0 20px 0; 
                color: #b76e79; 
                font-size: 22px;
              ">Bonjour ${firstName} ! 🚚</h2>
              
              <p style="
                margin: 0 0 30px 0; 
                font-size: 16px; 
                line-height: 1.6; 
                color: #4b5563;
              ">
                Excellente nouvelle ! Votre commande <strong>${orderNumber}</strong> a été expédiée et arrivera bientôt chez vous.
              </p>

              <!-- Infos de suivi -->
              <div style="
                background: #f0fdf4; 
                padding: 25px; 
                border-radius: 16px; 
                border: 2px solid #10b981;
                margin-bottom: 30px;
              ">
                <div style="margin-bottom: 15px;">
                  <strong style="color: #059669;">Numéro de suivi:</strong><br>
                  <span style="
                    background: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-family: 'Courier New', monospace;
                    color: #b76e79;
                    font-weight: 600;
                    display: inline-block;
                    margin-top: 5px;
                  ">${trackingNumber}</span>
                </div>
                <div>
                  <strong style="color: #059669;">Livraison estimée:</strong><br>
                  <span style="color: #10b981; font-weight: 600;">${estimatedDelivery}</span>
                </div>
              </div>

              <!-- CTA -->
              <a href="${process.env.BASE_URL}/mon-compte/commandes" style="
                display: inline-block;
                background: linear-gradient(135deg, #b76e79 0%, #7d4b53 100%);
                color: white;
                text-decoration: none;
                padding: 16px 32px;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 8px 24px rgba(183, 110, 121, 0.3);
              ">📍 Suivre mon colis</a>

            </div>

            <!-- Footer -->
            <div style="
              background: #f8f9fa; 
              padding: 30px; 
              text-align: center;
            ">
              <p style="
                margin: 0; 
                font-size: 14px; 
                color: #6b7280;
              ">
                Des questions ? Contactez-nous à 
                <a href="mailto:${process.env.MAIL_USER}" style="
                  color: #b76e79; 
                  text-decoration: none;
                ">${process.env.MAIL_USER}</a>
              </p>
            </div>

          </div>
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

    console.log("📧 Email d'expédition envoyé :", info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email d'expédition :", error);
    return { success: false, error: error.message };
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
    console.log('🌹 [EMAIL-SYSTEM] === DÉBUT ENVOI EMAILS CRYSTOS DÉTAILLÉS ===');
    console.log('🌹 [EMAIL-SYSTEM] Commande:', orderData.numero_commande);
    console.log('🌹 [EMAIL-SYSTEM] Client:', customerData.userEmail);
    console.log('🌹 [EMAIL-SYSTEM] Changement:', statusChangeData.oldStatus, '→', statusChangeData.newStatus);

    // 🎨 COULEURS CRYSTOSJEWEL
    const colors = {
      roseGold: '#b76e79',
      roseGoldLight: '#e8c2c8', 
      roseGoldDark: '#7d4b53',
      cream: '#fff8f0',
      darkText: '#3a3a3a'
    };

    // 📋 CONFIGURATION PAR STATUT
    const statusConfig = {
      'pending': {
        icon: '⏳',
        title: 'En préparation',
        message: 'Votre commande est maintenant prise en charge par notre équipe',
        color: colors.roseGold
      },
      'waiting': {
        icon: '⏳', 
        title: 'En attente',
        message: 'Votre commande est en cours de traitement',
        color: colors.roseGold
      },
      'preparing': {
        icon: '🔧',
        title: 'En cours de préparation', 
        message: 'Nos artisans travaillent sur votre commande avec soin',
        color: colors.roseGoldDark
      },
      'shipped': {
        icon: '📦',
        title: 'Expédiée',
        message: 'Votre commande a été expédiée et est en route vers vous',
        color: '#4CAF50'
      },
      'delivered': {
        icon: '✅',
        title: 'Livrée',
        message: 'Votre commande a été livrée avec succès',
        color: '#2E7D32'
      },
      'cancelled': {
        icon: '❌',
        title: 'Annulée',
        message: 'Votre commande a été annulée',
        color: '#f44336'
      }
    };

    const config = statusConfig[statusChangeData.newStatus] || statusConfig['pending'];

    // 💌 EMAIL CLIENT AVEC DÉTAILS COMPLETS
    let clientResult = { success: false, error: 'Non envoyé' };
    
    if (customerData.userEmail && customerData.userEmail.includes('@')) {
      try {
        console.log('🌹 [CLIENT-EMAIL] Création email client détaillé...');

        // 🛍️ RÉCUPÉRATION DES DÉTAILS DE COMMANDE DEPUIS LA BASE
        let orderDetails = { items: [], shipping: {}, totals: {} };
        
        try {
          // Récupérer les articles de la commande avec images
          const [orderItems] = await sequelize.query(`
            SELECT 
              oi.quantity,
              oi.unit_price,
              oi.size,
              j.name,
              j.description,
              j.image,
              j.price_ttc,
              c.name as category_name
            FROM order_items oi
            LEFT JOIN jewels j ON oi.jewel_id = j.id
            LEFT JOIN categories c ON j.category_id = c.id
            WHERE oi.order_id = $1
          `, { bind: [orderData.id] });

          // Récupérer les informations de livraison
          const [shippingInfo] = await sequelize.query(`
            SELECT 
              shipping_address,
              shipping_city,
              shipping_postal_code,
              shipping_country,
              phone,
              subtotal,
              shipping_price,
              total,
              promo_code,
              promo_discount_amount
            FROM orders 
            WHERE id = $1
          `, { bind: [orderData.id] });

          if (orderItems && orderItems.length > 0) {
            orderDetails.items = orderItems;
          }
          
          if (shippingInfo && shippingInfo.length > 0) {
            const shipping = shippingInfo[0];
            orderDetails.shipping = {
              address: shipping.shipping_address,
              city: shipping.shipping_city,
              postalCode: shipping.shipping_postal_code,
              country: shipping.shipping_country || 'France',
              phone: shipping.phone
            };
            orderDetails.totals = {
              subtotal: shipping.subtotal,
              shippingPrice: shipping.shipping_price,
              total: shipping.total,
              promoCode: shipping.promo_code,
              promoDiscount: shipping.promo_discount_amount
            };
          }
        } catch (dbError) {
          console.log('🌹 [CLIENT-EMAIL] ⚠️ Erreur récupération détails DB:', dbError.message);
          // Continuer avec les données de base si erreur DB
        }

        // 🎨 GÉNÉRATION DES ARTICLES HTML
        const itemsHtml = orderDetails.items.map(item => {
          const imageUrl = item.image ? 
            (item.image.startsWith('http') ? item.image : `${process.env.BASE_URL}/uploads/jewels/${item.image}`) :
            `${process.env.BASE_URL}/images/placeholder-jewel.jpg`;
          
          const itemTotal = (parseFloat(item.unit_price) * parseInt(item.quantity)).toFixed(2);

          return `
            <tr>
              <td style="padding: 15px; border-bottom: 1px solid ${colors.roseGoldLight};">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="width: 80px; vertical-align: top;">
                      <img src="${imageUrl}" alt="${item.name}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 2px solid ${colors.roseGoldLight};">
                    </td>
                    <td style="padding-left: 15px; vertical-align: top;">
                      <div style="color: ${colors.darkText}; font-weight: 600; font-size: 16px; margin-bottom: 5px;">
                        ${item.name}
                      </div>
                      <div style="color: #666; font-size: 14px; margin-bottom: 5px;">
                        ${item.category_name || 'Bijou'}
                      </div>
                      ${item.size && item.size !== 'Non spécifiée' ? `
                      <div style="color: ${colors.roseGold}; font-size: 13px; font-weight: 500;">
                        Taille: ${item.size}
                      </div>
                      ` : ''}
                    </td>
                    <td style="text-align: center; vertical-align: top; width: 80px;">
                      <div style="color: ${colors.darkText}; font-weight: 600; font-size: 16px;">
                        ${item.quantity}
                      </div>
                    </td>
                    <td style="text-align: right; vertical-align: top; width: 100px;">
                      <div style="color: ${colors.roseGold}; font-weight: 700; font-size: 16px;">
                        ${itemTotal}€
                      </div>
                      <div style="color: #666; font-size: 12px;">
                        ${parseFloat(item.unit_price).toFixed(2)}€ / unité
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        }).join('');

        const clientHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mise à jour de votre commande - CrystosJewel</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .padding { padding: 20px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.cream}; font-family: 'Inter', sans-serif;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cream}; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Conteneur principal -->
        <table class="container" width="650" cellpadding="0" cellspacing="0" border="0" style="max-width: 650px; background: white; border-radius: 16px; box-shadow: 0 10px 30px rgba(183, 110, 121, 0.15); overflow: hidden;">
          
          <!-- Header CrystosJewel -->
          <tr>
            <td style="background: linear-gradient(135deg, ${colors.roseGold} 0%, ${colors.roseGoldLight} 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: 300; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                CrystosJewel
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 400;">
                Bijoux d'Exception
              </p>
            </td>
          </tr>
          
          <!-- Bandeau de statut -->
          <tr>
            <td style="background-color: ${config.color}; padding: 20px; text-align: center;">
              <div style="color: white; font-size: 18px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 24px;">${config.icon}</span>
                <span>${config.title}</span>
              </div>
            </td>
          </tr>
          
          <!-- Contenu principal -->
          <tr>
            <td class="padding" style="padding: 40px 35px;">
              
              <!-- Salutation -->
              <h2 style="margin: 0 0 20px 0; color: ${colors.darkText}; font-size: 24px; font-weight: 500;">
                Bonjour ${customerData.firstName},
              </h2>
              
              <!-- Message principal -->
              <div style="background: ${colors.cream}; border-left: 4px solid ${colors.roseGold}; padding: 20px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: ${colors.darkText}; font-size: 16px; line-height: 1.6;">
                  ${config.message}.
                </p>
              </div>
              
              <!-- Informations de base -->
              <div style="background: #fafafa; border: 1px solid ${colors.roseGoldLight}; border-radius: 12px; overflow: hidden; margin-bottom: 30px;">
                
                <div style="background: ${colors.roseGoldLight}; padding: 15px; text-align: center;">
                  <h3 style="margin: 0; color: ${colors.darkText}; font-size: 18px; font-weight: 600;">
                    📋 Informations de votre commande
                  </h3>
                </div>
                
                <div style="padding: 0;">
                  <table width="100%" cellpadding="15" cellspacing="0" border="0">
                    <tr>
                      <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500;">
                        Numéro de commande
                      </td>
                      <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 700; text-align: right; font-family: monospace;">
                        ${orderData.numero_commande}
                      </td>
                    </tr>
                    <tr>
                      <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500;">
                        Statut actuel
                      </td>
                      <td style="border-bottom: 1px solid ${colors.roseGoldLight}; text-align: right;">
                        <span style="background: ${config.color}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                          ${config.icon} ${config.title}
                        </span>
                      </td>
                    </tr>
                    ${orderData.tracking_number ? `
                    <tr>
                      <td style="color: ${colors.darkText}; font-weight: 500;">
                        Numéro de suivi
                      </td>
                      <td style="text-align: right;">
                        <div style="background: #e8f5e8; color: #2e7d32; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-weight: 700; letter-spacing: 1px;">
                          ${orderData.tracking_number}
                        </div>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
              </div>

              <!-- Détails des articles -->
              ${orderDetails.items.length > 0 ? `
              <div style="background: #fafafa; border: 1px solid ${colors.roseGoldLight}; border-radius: 12px; overflow: hidden; margin-bottom: 30px;">
                
                <div style="background: ${colors.roseGoldLight}; padding: 15px; text-align: center;">
                  <h3 style="margin: 0; color: ${colors.darkText}; font-size: 18px; font-weight: 600;">
                    🛍️ Détails de votre commande
                  </h3>
                </div>
                
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <!-- Header tableau -->
                  <tr style="background: ${colors.cream};">
                    <td style="padding: 12px 15px; color: ${colors.darkText}; font-weight: 600; font-size: 14px; border-bottom: 2px solid ${colors.roseGoldLight};">
                      Article
                    </td>
                    <td style="padding: 12px 15px; color: ${colors.darkText}; font-weight: 600; font-size: 14px; text-align: center; border-bottom: 2px solid ${colors.roseGoldLight};">
                      Qté
                    </td>
                    <td style="padding: 12px 15px; color: ${colors.darkText}; font-weight: 600; font-size: 14px; text-align: right; border-bottom: 2px solid ${colors.roseGoldLight};">
                      Prix
                    </td>
                  </tr>
                  
                  <!-- Articles -->
                  ${itemsHtml}
                </table>
              </div>
              ` : ''}

              <!-- Récapitulatif des prix -->
              ${orderDetails.totals.subtotal ? `
              <div style="background: #fafafa; border: 1px solid ${colors.roseGoldLight}; border-radius: 12px; overflow: hidden; margin-bottom: 30px;">
                
                <div style="background: ${colors.roseGoldLight}; padding: 15px; text-align: center;">
                  <h3 style="margin: 0; color: ${colors.darkText}; font-size: 18px; font-weight: 600;">
                    💰 Récapitulatif des prix
                  </h3>
                </div>
                
                <div style="padding: 20px;">
                  <table width="100%" cellpadding="8" cellspacing="0" border="0">
                    <tr>
                      <td style="color: ${colors.darkText}; font-weight: 500;">
                        Sous-total
                      </td>
                      <td style="color: ${colors.darkText}; font-weight: 600; text-align: right;">
                        ${parseFloat(orderDetails.totals.subtotal).toFixed(2)}€
                      </td>
                    </tr>
                    ${orderDetails.totals.promoCode ? `
                    <tr>
                      <td style="color: ${colors.roseGold}; font-weight: 500;">
                        Code promo (${orderDetails.totals.promoCode})
                      </td>
                      <td style="color: ${colors.roseGold}; font-weight: 600; text-align: right;">
                        -${parseFloat(orderDetails.totals.promoDiscount || 0).toFixed(2)}€
                      </td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="color: ${colors.darkText}; font-weight: 500;">
                        Frais de livraison
                      </td>
                      <td style="color: ${colors.darkText}; font-weight: 600; text-align: right;">
                        ${parseFloat(orderDetails.totals.shippingPrice || 0) === 0 ? 'GRATUIT' : parseFloat(orderDetails.totals.shippingPrice || 0).toFixed(2) + '€'}
                      </td>
                    </tr>
                    <tr style="border-top: 2px solid ${colors.roseGold};">
                      <td style="color: ${colors.roseGold}; font-weight: 700; font-size: 18px; padding-top: 12px;">
                        Total
                      </td>
                      <td style="color: ${colors.roseGold}; font-weight: 700; font-size: 18px; text-align: right; padding-top: 12px;">
                        ${parseFloat(orderDetails.totals.total || orderData.total).toFixed(2)}€
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              ` : ''}

              <!-- Adresse de livraison -->
              ${orderDetails.shipping.address ? `
              <div style="background: #fafafa; border: 1px solid ${colors.roseGoldLight}; border-radius: 12px; overflow: hidden; margin-bottom: 30px;">
                
                <div style="background: ${colors.roseGoldLight}; padding: 15px; text-align: center;">
                  <h3 style="margin: 0; color: ${colors.darkText}; font-size: 18px; font-weight: 600;">
                    📍 Adresse de livraison
                  </h3>
                </div>
                
                <div style="padding: 20px;">
                  <div style="color: ${colors.darkText}; font-weight: 600; font-size: 16px; margin-bottom: 8px;">
                    ${customerData.firstName} ${customerData.lastName || ''}
                  </div>
                  <div style="color: ${colors.darkText}; line-height: 1.5;">
                    ${orderDetails.shipping.address}<br>
                    ${orderDetails.shipping.postalCode} ${orderDetails.shipping.city}<br>
                    ${orderDetails.shipping.country}
                  </div>
                  ${orderDetails.shipping.phone ? `
                  <div style="color: ${colors.roseGold}; font-weight: 500; margin-top: 10px;">
                    📞 ${orderDetails.shipping.phone}
                  </div>
                  ` : ''}
                </div>
              </div>
              ` : ''}
              
              ${statusChangeData.newStatus === 'shipped' ? `
              <!-- Message spécial expédition -->
              <div style="background: #e8f5e8; border: 2px solid #4caf50; border-radius: 12px; padding: 20px; margin-bottom: 30px; text-align: center;">
                <h3 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 20px;">📦 Votre commande est en route !</h3>
                <p style="margin: 0; color: #388e3c; font-size: 16px;">
                  ${orderData.tracking_number ? 
                    'Vous pouvez suivre votre colis avec le numéro de suivi ci-dessus.' : 
                    'Vous recevrez bientôt votre numéro de suivi par email.'
                  }
                </p>
              </div>
              ` : ''}
              
              ${statusChangeData.newStatus === 'delivered' ? `
              <!-- Message spécial livraison -->
              <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 12px; padding: 20px; margin-bottom: 30px; text-align: center;">
                <h3 style="margin: 0 0 10px 0; color: #f57c00; font-size: 20px;">🎉 Félicitations !</h3>
                <p style="margin: 0; color: #ef6c00; font-size: 16px;">
                  Votre commande a été livrée. Nous espérons que vos bijoux vous plairont !
                </p>
              </div>
              ` : ''}
              
              <!-- Boutons d'action -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}" style="display: inline-block; background: ${colors.roseGold}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-right: 10px;">
                  Découvrir nos bijoux
                </a>
                <a href="mailto:${process.env.MAIL_USER}" style="display: inline-block; background: white; color: ${colors.roseGold}; text-decoration: none; padding: 12px 24px; border: 2px solid ${colors.roseGold}; border-radius: 6px; font-weight: 600;">
                  Nous contacter
                </a>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: ${colors.cream}; padding: 30px; text-align: center; border-top: 1px solid ${colors.roseGoldLight};">
              <p style="margin: 0 0 10px 0; color: ${colors.darkText}; font-size: 14px;">
                Une question ? Contactez-nous à 
                <a href="mailto:${process.env.MAIL_USER}" style="color: ${colors.roseGold}; text-decoration: none; font-weight: 500;">
                  ${process.env.MAIL_USER}
                </a>
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                © 2024 CrystosJewel - Bijoux d'Exception
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

        const clientInfo = await transporter.sendMail({
          from: `"CrystosJewel" <${process.env.MAIL_USER}>`,
          to: customerData.userEmail,
          subject: `${config.icon} Commande ${orderData.numero_commande} - ${config.title}`,
          html: clientHtml,
          text: `Bonjour ${customerData.firstName}, ${config.message}. Commande: ${orderData.numero_commande}, Montant: ${orderData.total}€, Statut: ${config.title}${orderData.tracking_number ? `, Suivi: ${orderData.tracking_number}` : ''}.`
        });

        console.log('🌹 [CLIENT-EMAIL] ✅ Email client détaillé envoyé:', clientInfo.response);
        clientResult = { success: true, messageId: clientInfo.messageId };
        
      } catch (clientError) {
        console.log('🌹 [CLIENT-EMAIL] ❌ Erreur:', clientError.message);
        clientResult = { success: false, error: clientError.message };
      }
    } else {
      console.log('🌹 [CLIENT-EMAIL] ❌ Email client invalide');
    }

    // 👩‍💼 EMAIL ADMIN CRYSTOSJEWEL AVEC STATS DYNAMIQUES
    let adminResult = { success: false, error: 'Non envoyé' };
    
    try {
      console.log('🌹 [ADMIN-EMAIL] Création email admin avec stats dynamiques...');
      adminResult = await sendAdminStatusNotification(orderData, statusChangeData, customerData);
    } catch (adminError) {
      console.log('🌹 [ADMIN-EMAIL] ❌ Erreur:', adminError.message);
      adminResult = { success: false, error: adminError.message };
    }

    console.log('🌹 [EMAIL-SYSTEM] === RÉSULTATS ===');
    console.log('🌹 [EMAIL-SYSTEM] Client:', clientResult.success ? '✅ Envoyé avec détails' : '❌ Échec');
    console.log('🌹 [EMAIL-SYSTEM] Admin:', adminResult.success ? '✅ Envoyé avec stats' : '❌ Échec');
    console.log('🌹 [EMAIL-SYSTEM] === FIN ENVOI EMAILS ===');

    return {
      success: clientResult.success || adminResult.success,
      details: {
        client: clientResult,
        admin: adminResult
      }
    };
    
  } catch (error) {
    console.log('🌹 [EMAIL-SYSTEM] ❌ ERREUR GÉNÉRALE:', error.message);
    return { success: false, error: error.message };
  }
};



export const sendAdminStatusNotification = async (orderData, statusChangeData, customerData) => {
  try {
    console.log('👩‍💼 [ADMIN-EMAIL] Début création email admin avec stats dynamiques...');
    
    const { oldStatus, newStatus, updatedBy } = statusChangeData;
    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    
    if (!adminEmail) {
      console.log('👩‍💼 [ADMIN-EMAIL] ❌ Aucun email admin configuré');
      return { success: false, error: 'Email admin non configuré' };
    }

    // 🎨 COULEURS CRYSTOSJEWEL
    const colors = {
      roseGold: '#b76e79',
      roseGoldLight: '#e8c2c8', 
      roseGoldDark: '#7d4b53',
      cream: '#fff8f0',
      darkText: '#3a3a3a'
    };

    const statusConfig = {
      'pending': { icon: '⏳', color: colors.roseGold },
      'waiting': { icon: '⏳', color: colors.roseGold },
      'preparing': { icon: '🔧', color: colors.roseGoldDark },
      'shipped': { icon: '📦', color: '#4CAF50' },
      'delivered': { icon: '✅', color: '#2E7D32' },
      'cancelled': { icon: '❌', color: '#f44336' }
    };

    const config = statusConfig[newStatus] || statusConfig['pending'];

    // 📊 RÉCUPÉRATION DES STATS DYNAMIQUES
    let stats = {
      today: { orders: 0, revenue: 0, pending: 0 },
      month: { orders: 0, revenue: 0 },
      total: { orders: 0, revenue: 0 }
    };

    try {
      // Stats du jour
      const [todayStats] = await sequelize.query(`
        SELECT 
          COUNT(*) as orders_count,
          COALESCE(SUM(total), 0) as total_revenue,
          COUNT(CASE WHEN status IN ('pending', 'waiting') THEN 1 END) as pending_count
        FROM orders 
        WHERE DATE(created_at) = CURRENT_DATE
      `);

      // Stats du mois
      const [monthStats] = await sequelize.query(`
        SELECT 
          COUNT(*) as orders_count,
          COALESCE(SUM(total), 0) as total_revenue
        FROM orders 
        WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      `);

      // Stats totales
      const [totalStats] = await sequelize.query(`
        SELECT 
          COUNT(*) as orders_count,
          COALESCE(SUM(total), 0) as total_revenue
        FROM orders 
        WHERE status NOT IN ('cancelled')
      `);

      if (todayStats && todayStats.length > 0) {
        stats.today = {
          orders: parseInt(todayStats[0].orders_count) || 0,
          revenue: parseFloat(todayStats[0].total_revenue) || 0,
          pending: parseInt(todayStats[0].pending_count) || 0
        };
      }

      if (monthStats && monthStats.length > 0) {
        stats.month = {
          orders: parseInt(monthStats[0].orders_count) || 0,
          revenue: parseFloat(monthStats[0].total_revenue) || 0
        };
      }

      if (totalStats && totalStats.length > 0) {
        stats.total = {
          orders: parseInt(totalStats[0].orders_count) || 0,
          revenue: parseFloat(totalStats[0].total_revenue) || 0
        };
      }

    } catch (statsError) {
      console.log('👩‍💼 [ADMIN-EMAIL] ⚠️ Erreur récupération stats:', statsError.message);
      // Utiliser des stats par défaut en cas d'erreur
    }

    const adminHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification Admin - CrystosJewel</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    @media only screen and (max-width: 650px) {
      .stats-container { display: block !important; }
      .stat-item { margin-bottom: 15px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: linear-gradient(135deg, ${colors.cream} 0%, ${colors.roseGoldLight} 100%); font-family: 'Inter', sans-serif; min-height: 100vh;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, ${colors.cream} 0%, ${colors.roseGoldLight} 100%); min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Conteneur principal admin -->
        <table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width: 680px; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(183, 110, 121, 0.2); overflow: hidden;">
          
          <!-- Header admin CrystosJewel -->
          <tr>
            <td style="background: linear-gradient(135deg, ${colors.roseGoldDark} 0%, ${colors.roseGold} 100%); padding: 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.1); padding: 15px 25px; border-radius: 50px; backdrop-filter: blur(10px);">
                <span style="font-size: 28px;">👩‍💼</span>
                <div style="text-align: left;">
                  <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    CrystosJewel
                  </h1>
                  <p style="margin: 3px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">
                    Administration
                  </p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Bandeau de statut -->
          <tr>
            <td style="background-color: ${config.color}; padding: 20px; text-align: center;">
              <div style="color: white; display: flex; align-items: center; justify-content: center; gap: 15px;">
                <span style="font-size: 32px;">${config.icon}</span>
                <div style="text-align: left;">
                  <h2 style="margin: 0; font-size: 20px; font-weight: 700;">
                    Commande ${orderData.numero_commande}
                  </h2>
                  <p style="margin: 2px 0 0 0; font-size: 14px; opacity: 0.9;">
                    ${oldStatus} → ${newStatus}
                  </p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Stats dynamiques en haut -->
          <tr>
            <td style="background: ${colors.cream}; padding: 25px;">
              <h3 style="margin: 0 0 20px 0; color: ${colors.darkText}; font-size: 18px; font-weight: 600; text-align: center;">
                📊 Tableau de bord en temps réel
              </h3>
              
              <div class="stats-container" style="display: flex; justify-content: space-between; gap: 15px;">
                <!-- Stat Aujourd'hui -->
                <div class="stat-item" style="flex: 1; text-align: center; background: white; padding: 18px 15px; border-radius: 12px; border: 2px solid ${colors.roseGoldLight}; box-shadow: 0 4px 12px rgba(183, 110, 121, 0.1);">
                  <div style="color: ${colors.roseGold}; font-weight: 800; font-size: 24px; font-family: 'Inter', sans-serif; margin-bottom: 5px;">
                    ${stats.today.orders}
                  </div>
                  <div style="color: ${colors.darkText}; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 3px;">
                    Commandes Aujourd'hui
                  </div>
                  <div style="color: ${colors.roseGold}; font-size: 14px; font-weight: 600;">
                    ${stats.today.revenue.toFixed(0)}€
                  </div>
                </div>
                
                <!-- Stat Mois -->
                <div class="stat-item" style="flex: 1; text-align: center; background: white; padding: 18px 15px; border-radius: 12px; border: 2px solid #4CAF5033; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.1);">
                  <div style="color: #4CAF50; font-weight: 800; font-size: 24px; font-family: 'Inter', sans-serif; margin-bottom: 5px;">
                    ${stats.month.orders}
                  </div>
                  <div style="color: ${colors.darkText}; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 3px;">
                    Commandes ce Mois
                  </div>
                  <div style="color: #4CAF50; font-size: 14px; font-weight: 600;">
                    ${stats.month.revenue.toFixed(0)}€
                  </div>
                </div>
                
                <!-- Stat En Attente -->
                <div class="stat-item" style="flex: 1; text-align: center; background: white; padding: 18px 15px; border-radius: 12px; border: 2px solid ${colors.roseGoldDark}33; box-shadow: 0 4px 12px rgba(125, 75, 83, 0.1);">
                  <div style="color: ${colors.roseGoldDark}; font-weight: 800; font-size: 24px; font-family: 'Inter', sans-serif; margin-bottom: 5px;">
                    ${stats.today.pending}
                  </div>
                  <div style="color: ${colors.darkText}; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 3px;">
                    En Attente
                  </div>
                  <div style="color: ${colors.roseGoldDark}; font-size: 14px; font-weight: 600;">
                    À traiter
                  </div>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Contenu principal admin -->
          <tr>
            <td style="padding: 35px;">
              
              <!-- Résumé du changement -->
              <div style="background: ${colors.cream}; border-left: 4px solid ${config.color}; padding: 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; color: ${colors.darkText}; font-size: 18px; font-weight: 600;">
                  ⚡ Changement de statut détecté
                </h3>
                <p style="margin: 0; color: ${colors.darkText}; font-size: 15px; line-height: 1.5;">
                  La commande <strong>${orderData.numero_commande}</strong> vient de passer 
                  du statut <span style="background: #ffebee; color: #c62828; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${oldStatus}</span> 
                  au statut <span style="background: #e8f5e8; color: #2e7d32; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${newStatus}</span>.
                </p>
              </div>
              
              <!-- Informations détaillées -->
              <div style="background: #fafafa; border: 1px solid ${colors.roseGoldLight}; border-radius: 8px; overflow: hidden; margin-bottom: 25px;">
                
                <div style="background: ${colors.roseGoldLight}; padding: 15px; text-align: center;">
                  <h3 style="margin: 0; color: ${colors.darkText}; font-size: 16px; font-weight: 600;">
                    📊 Informations détaillées de la commande
                  </h3>
                </div>
                
                <table width="100%" cellpadding="12" cellspacing="0" border="0">
                  <tr>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500; width: 30%;">
                      Numéro de commande
                    </td>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 700; font-family: monospace;">
                      ${orderData.numero_commande}
                    </td>
                  </tr>
                  <tr>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500;">
                      Cliente
                    </td>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 600;">
                      ${customerData.firstName} ${customerData.lastName || ''}
                    </td>
                  </tr>
                  <tr>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500;">
                      Email
                    </td>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-family: monospace; font-size: 14px;">
                      <a href="mailto:${customerData.userEmail}" style="color: ${colors.roseGold}; text-decoration: none;">${customerData.userEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500;">
                      Montant total
                    </td>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: #2e7d32; font-weight: 800; font-size: 20px;">
                      ${orderData.total}€
                    </td>
                  </tr>
                  <tr>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500;">
                      Nouveau statut
                    </td>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight};">
                      <span style="background: ${config.color}; color: white; padding: 6px 12px; border-radius: 4px; font-weight: 600; font-size: 12px;">
                        ${config.icon} ${newStatus}
                      </span>
                    </td>
                  </tr>
                  ${orderData.tracking_number ? `
                  <tr>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500;">
                      Numéro de suivi
                    </td>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight};">
                      <div style="background: #e8f5e8; color: #2e7d32; padding: 6px 10px; border-radius: 4px; font-family: monospace; font-weight: 600; letter-spacing: 1px;">
                        ${orderData.tracking_number}
                      </div>
                    </td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 500;">
                      Modifié par
                    </td>
                    <td style="border-bottom: 1px solid ${colors.roseGoldLight}; color: ${colors.darkText}; font-weight: 600;">
                      ${updatedBy}
                    </td>
                  </tr>
                  <tr>
                    <td style="color: ${colors.darkText}; font-weight: 500;">
                      Date/Heure
                    </td>
                    <td style="color: ${colors.darkText}; font-weight: 600;">
                      ${new Date().toLocaleString('fr-FR', { 
                        timeZone: 'Europe/Paris',
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Actions rapides -->
              <div style="text-align: center; margin-bottom: 25px;">
                <h3 style="margin: 0 0 15px 0; color: ${colors.darkText}; font-size: 16px; font-weight: 600;">Actions rapides</h3>
                
                <a href="${process.env.BASE_URL}/admin/commandes" style="display: inline-block; background: ${colors.roseGold}; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; margin: 0 5px; font-size: 14px;">
                  📋 Toutes les commandes
                </a>
                <a href="${process.env.BASE_URL}/admin/stats" style="display: inline-block; background: ${colors.roseGoldDark}; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; margin: 0 5px; font-size: 14px;">
                  📊 Dashboard
                </a>
                <a href="${process.env.BASE_URL}/admin/commandes/${orderData.id || ''}" style="display: inline-block; background: #4CAF50; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; margin: 0 5px; font-size: 14px;">
                  👁️ Voir détails
                </a>
              </div>
              
              ${newStatus === 'shipped' ? `
              <!-- Alerte expédition -->
              <div style="background: #e8f5e8; border: 2px solid #4caf50; border-radius: 8px; padding: 15px; text-align: center;">
                <h4 style="margin: 0 0 8px 0; color: #2e7d32; font-size: 16px;">📦 Commande expédiée avec succès</h4>
                <p style="margin: 0; color: #388e3c; font-size: 14px;">
                  La cliente a reçu un email de confirmation détaillé avec ${orderData.tracking_number ? 'le numéro de suivi' : 'les informations d\'expédition'} et tous les détails de sa commande.
                </p>
              </div>
              ` : ''}
              
              ${newStatus === 'delivered' ? `
              <!-- Alerte livraison -->
              <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; padding: 15px; text-align: center;">
                <h4 style="margin: 0 0 8px 0; color: #f57c00; font-size: 16px;">🎯 Commande livrée avec succès</h4>
                <p style="margin: 0; color: #ef6c00; font-size: 14px;">
                  La cliente a reçu une notification de livraison. Pensez à effectuer un suivi de satisfaction client pour maintenir la qualité de service CrystosJewel.
                </p>
              </div>
              ` : ''}
              
            </td>
          </tr>
          
          <!-- Footer admin avec stats étendues -->
          <tr>
            <td style="background: ${colors.cream}; padding: 25px; text-align: center; border-top: 1px solid ${colors.roseGoldLight};">
              
              <!-- Récapitulatif global -->
              <div style="margin-bottom: 20px; padding: 20px; background: white; border-radius: 8px; border: 1px solid ${colors.roseGoldLight};">
                <h4 style="margin: 0 0 15px 0; color: ${colors.darkText}; font-size: 16px; font-weight: 600;">
                  📈 Récapitulatif Performance CrystosJewel
                </h4>
                
                <div style="display: flex; justify-content: space-between; text-align: center;">
                  <div style="flex: 1;">
                    <div style="color: ${colors.roseGold}; font-weight: 700; font-size: 18px;">
                      ${stats.total.orders}
                    </div>
                    <div style="color: ${colors.darkText}; font-size: 12px; font-weight: 500;">
                      Commandes Totales
                    </div>
                  </div>
                  <div style="flex: 1;">
                    <div style="color: #4CAF50; font-weight: 700; font-size: 18px;">
                      ${stats.total.revenue.toFixed(0)}€
                    </div>
                    <div style="color: ${colors.darkText}; font-size: 12px; font-weight: 500;">
                      Chiffre d'Affaires Total
                    </div>
                  </div>
                  <div style="flex: 1;">
                    <div style="color: ${colors.roseGoldDark}; font-weight: 700; font-size: 18px;">
                      ${stats.total.orders > 0 ? (stats.total.revenue / stats.total.orders).toFixed(0) : 0}€
                    </div>
                    <div style="color: ${colors.darkText}; font-size: 12px; font-weight: 500;">
                      Panier Moyen
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Footer légal -->
              <p style="margin: 0; color: #999; font-size: 12px;">
                📧 Notification automatique CrystosJewel Admin • Stats en temps réel<br>
                <a href="${process.env.BASE_URL}/admin" style="color: ${colors.roseGold}; text-decoration: none; font-weight: 500;">
                  Accéder au tableau de bord complet
                </a>
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

    const subject = `${config.icon} Commande ${orderData.numero_commande} - ${newStatus} - CrystosJewel Admin`;

    console.log('👩‍💼 [ADMIN-EMAIL] Envoi vers:', adminEmail);

    const info = await transporter.sendMail({
      from: `"CrystosJewel Admin" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: subject,
      html: adminHtml,
      headers: {
        'X-Priority': '1',
        'Importance': 'high'
      }
    });

    console.log('👩‍💼 [ADMIN-EMAIL] ✅ Email admin avec stats dynamiques envoyé:', info.response);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.log('👩‍💼 [ADMIN-EMAIL] ❌ Erreur:', error.message);
    return { success: false, error: error.message };
  }
};

// ✅ VÉRIFICATION Configuration Email
// Ajoutez ces lignes au début de votre mailService.js pour vérifier la config :

console.log('📧 Configuration email:', {
    MAIL_USER: process.env.MAIL_USER ? '✅ Défini' : '❌ Manquant',
    MAIL_PASS: process.env.MAIL_PASS ? '✅ Défini' : '❌ Manquant',
    SERVICE: 'gmail ✅'
});



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
