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

export const sendWelcomeMail = async (userEmail, firstName) => {
  try {
    const htmlContent = `
      <div style="
        font-family: Arial, sans-serif;
        color: #3a3a3a;
        background-color: #fff8f0;
        max-width: 600px;
        margin: auto;
        border-radius: 8px;
        box-shadow: 0 8px 20px rgba(183, 110, 121, 0.15);
        overflow: hidden;
      ">
        <header style="
          background: linear-gradient(135deg, #e8c2c8, #b76e79);
          padding: 20px 0;
          text-align: center;
          color: white;
          font-weight: 300;
          letter-spacing: 3px;
          font-size: 2rem;
          ">
          Crystos Jewel
        </header>

        <nav style="background: #b76e79; text-align: center; padding: 10px 0;">
          <a href="${process.env.BASE_URL}" style="
            color: white; 
            margin: 0 15px; 
            text-decoration: none; 
            font-weight: 500;
            font-size: 1rem;
            transition: color 0.3s;
          " onmouseover="this.style.color='#fff8f0'" onmouseout="this.style.color='white'">Accueil</a>
          <a href="${process.env.BASE_URL}/bijoux" style="
            color: white; 
            margin: 0 15px; 
            text-decoration: none; 
            font-weight: 500;
            font-size: 1rem;
            transition: color 0.3s;
          " onmouseover="this.style.color='#fff8f0'" onmouseout="this.style.color='white'">Nos Bijoux</a>
          <a href="${process.env.BASE_URL}/promos" style="
            color: white; 
            margin: 0 15px; 
            text-decoration: none; 
            font-weight: 500;
            font-size: 1rem;
            transition: color 0.3s;
          " onmouseover="this.style.color='#fff8f0'" onmouseout="this.style.color='white'">Promos</a>
          <a href="${process.env.BASE_URL}/contact" style="
            color: white; 
            margin: 0 15px; 
            text-decoration: none; 
            font-weight: 500;
            font-size: 1rem;
            transition: color 0.3s;
          " onmouseover="this.style.color='#fff8f0'" onmouseout="this.style.color='white'">Contact</a>
        </nav>

        <main style="padding: 20px;">
          <h2 style="color: #7d4b53; font-weight: 600;">Coucou ${firstName} !</h2>
          <p>Bienvenue chez <strong>Crystos Jewel</strong>, ta boutique préférée pour des bijoux qui ont du charme sans te ruiner.</p>
          <p>On est super contents que tu aies rejoint la famille. Ici, on aime bien les paillettes, le fun, et surtout te faire plaisir.</p>
          <p>Si tu as besoin d'un coup de main ou juste envie de papoter bling-bling, on est là, prêts à répondre !</p>
          <p>Allez, file découvrir nos merveilles et fais-toi plaisir 💎</p>

          <p style="margin-top: 30px; font-style: italic; color: #b76e79;">L'équipe Crystos Jewel qui brille avec toi ✨</p>
        </main>

        <footer style="
          background: #e8c2c8; 
          padding: 15px 20px; 
          font-size: 12px; 
          color: #7d4b53; 
          text-align: center;
          border-top: 1px solid #b76e79;
        ">
          Tu as reçu ce mail car tu t'es inscrit(e) sur <a href="${process.env.BASE_URL}" style="color:#7d4b53; text-decoration:none;">notre site</a>.  
          Si ce n'est pas toi, pas de panique, ignore-le simplement.
        </footer>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"Crystos Jewel" <${process.env.MAIL_USER}>`,
      to: userEmail,
      subject: `Bienvenue dans la famille Crystos Jewel, ${firstName} !`,
      html: htmlContent,
    });

    console.log("Email envoyé :", info.response);
  } catch (error) {
    console.error("Erreur lors de l'envoi du mail :", error);
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

// ✨ FONCTION UTILITAIRE - Calcul date de livraison sans dimanche
function calculateDeliveryDate(daysToAdd = 3) {
    let deliveryDate = new Date();
    let addedDays = 0;
    
    while (addedDays < daysToAdd) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
        
        // Si ce n'est pas un dimanche (0 = dimanche)
        if (deliveryDate.getDay() !== 0) {
            addedDays++;
        }
    }
    
    return deliveryDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ✨ EMAIL CLIENT - Design élégant et chaleureux
export const sendOrderConfirmationEmail = async (userEmail, firstName, orderData) => {
  try {
    const { orderNumber, items, total, subtotal, shippingFee, shippingAddress, estimatedDelivery } = orderData;
    
    // Calculs corrigés
    const calculatedSubtotal = subtotal || items.reduce((sum, item) => sum + item.total, 0);
    const calculatedShippingFee = shippingFee || (calculatedSubtotal >= 50 ? 0 : 5.99);
    const calculatedTotal = total || (calculatedSubtotal + calculatedShippingFee);
    
    // Date de livraison
    const deliveryDate = typeof estimatedDelivery === 'string' ? estimatedDelivery : calculateDeliveryDate(3);
    
    // Items HTML avec style élégant
    const itemsHtml = items.map(item => {
      let imageUrl = '';
      if (item.jewel && item.jewel.image) {
        imageUrl = item.jewel.image.startsWith('http') 
          ? item.jewel.image 
          : `${process.env.BASE_URL}/uploads/${item.jewel.image}`;
      }
      
      return `
        <div style="
          display: flex;
          align-items: center;
          padding: 20px;
          background: white;
          border-radius: 12px;
          margin-bottom: 12px;
          box-shadow: 0 2px 8px rgba(216, 154, 179, 0.15);
          border-left: 4px solid #d89ab3;
        ">
          <div style="
            width: 65px; 
            height: 65px; 
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            margin-right: 16px;
            ${imageUrl ? `background-image: url('${imageUrl}'); background-size: cover; background-position: center;` : 'background: linear-gradient(135deg, #f3e8ff, #e9d5ff);'}
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          ">
            ${!imageUrl ? '<span style="color: #8b5cf6; font-size: 24px;">💎</span>' : ''}
          </div>
          <div style="flex: 1;">
            <div style="
              font-weight: 600; 
              color: #374151; 
              font-size: 16px; 
              margin-bottom: 6px;
              line-height: 1.3;
            ">${item.name}</div>
            <div style="
              color: #6b7280; 
              font-size: 14px;
              margin-bottom: 4px;
            ">Quantité: <span style="font-weight: 500; color: #d89ab3;">${item.quantity}</span></div>
            <div style="
              color: #6b7280; 
              font-size: 14px;
            ">Prix unitaire: <span style="font-weight: 500;">${item.price.toFixed(2)} €</span></div>
          </div>
          <div style="
            font-size: 18px;
            font-weight: 700;
            color: #d89ab3;
            text-align: right;
          ">${item.total.toFixed(2)} €</div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Commande confirmée - CrystosJewel</title>
      </head>
      <body style="
        margin: 0; 
        padding: 0; 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
        background: linear-gradient(135deg, #fdf2f8 0%, #f3e8ff 100%);
        min-height: 100vh;
      ">
        
        <div style="padding: 30px 20px;">
          <div style="
            max-width: 650px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 20px; 
            overflow: hidden; 
            box-shadow: 0 10px 40px rgba(216, 154, 179, 0.2);
            border: 1px solid #f3e8ff;
          ">
            
            <!-- Header élégant -->
            <div style="
              background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
              padding: 40px 30px;
              text-align: center;
              position: relative;
              overflow: hidden;
            ">
              <!-- Décorations subtiles -->
              <div style="
                position: absolute;
                top: -30px;
                right: -30px;
                width: 120px;
                height: 120px;
                background: rgba(255,255,255,0.1);
                border-radius: 50%;
              "></div>
              <div style="
                position: absolute;
                bottom: -20px;
                left: -20px;
                width: 80px;
                height: 80px;
                background: rgba(255,255,255,0.05);
                border-radius: 50%;
              "></div>
              
              <div style="position: relative; z-index: 2;">
                <h1 style="
                  margin: 0 0 8px 0; 
                  color: white; 
                  font-size: 32px; 
                  font-weight: 700; 
                  letter-spacing: 1px;
                  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">✨ CrystosJewel ✨</h1>
                <p style="
                  margin: 0; 
                  color: rgba(255,255,255,0.95); 
                  font-size: 16px; 
                  font-weight: 400;
                ">Vos bijoux de rêve depuis 1985</p>
              </div>
            </div>

            <!-- Badge de confirmation -->
            <div style="
              background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
              padding: 20px;
              text-align: center;
              border-bottom: 1px solid #a7f3d0;
            ">
              <div style="
                display: inline-flex;
                align-items: center;
                gap: 12px;
                background: white;
                padding: 12px 24px;
                border-radius: 30px;
                box-shadow: 0 4px 12px rgba(5, 150, 105, 0.15);
                border: 1px solid #6ee7b7;
              ">
                <div style="
                  width: 24px;
                  height: 24px;
                  background: #10b981;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 14px;
                  font-weight: bold;
                ">✓</div>
                <span style="
                  color: #065f46;
                  font-weight: 600;
                  font-size: 15px;
                ">Commande confirmée avec succès</span>
              </div>
            </div>

            <!-- Contenu principal -->
            <div style="padding: 35px 30px;">
              
              <!-- Message de bienvenue -->
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="
                  font-size: 48px;
                  margin-bottom: 16px;
                  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
                ">🎉</div>
                <h2 style="
                  margin: 0 0 12px 0; 
                  color: #374151; 
                  font-size: 26px; 
                  font-weight: 700;
                  line-height: 1.3;
                ">Merci ${firstName} !</h2>
                <p style="
                  margin: 0; 
                  color: #6b7280; 
                  font-size: 16px; 
                  line-height: 1.6;
                  max-width: 400px;
                  margin: 0 auto;
                ">Votre commande a été confirmée avec succès.<br>
                Nous préparons vos bijoux avec tout notre savoir-faire ✨</p>
              </div>

              <!-- Numéro de commande -->
              <div style="
                background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
                color: white;
                padding: 24px;
                border-radius: 16px;
                text-align: center;
                margin-bottom: 30px;
                box-shadow: 0 8px 24px rgba(216, 154, 179, 0.25);
              ">
                <div style="
                  font-size: 13px;
                  opacity: 0.9;
                  margin-bottom: 6px;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  font-weight: 500;
                ">Numéro de commande</div>
                <div style="
                  font-size: 22px;
                  font-weight: 700;
                  font-family: 'Courier New', monospace;
                  letter-spacing: 1px;
                  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                ">${orderNumber}</div>
              </div>

              <!-- Articles commandés -->
              <div style="margin-bottom: 30px;">
                <h3 style="
                  margin: 0 0 20px 0; 
                  color: #374151; 
                  font-size: 20px; 
                  font-weight: 700;
                  display: flex;
                  align-items: center;
                  gap: 10px;
                ">
                  <span style="font-size: 22px;">🛍️</span>
                  Vos bijoux commandés
                </h3>
                
                <div style="
                  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
                  border-radius: 16px;
                  padding: 20px;
                ">
                  ${itemsHtml}
                  
                  <!-- Récapitulatif des totaux -->
                  <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin-top: 16px;
                    border: 1px solid #e5e7eb;
                  ">
                    <div style="
                      display: flex; 
                      justify-content: space-between; 
                      align-items: center;
                      margin-bottom: 12px;
                      padding-bottom: 8px;
                      border-bottom: 1px solid #f3f4f6;
                    ">
                      <span style="color: #6b7280; font-size: 15px;">Sous-total</span>
                      <span style="color: #374151; font-size: 15px; font-weight: 600;">${calculatedSubtotal.toFixed(2)} €</span>
                    </div>
                    
                    <div style="
                      display: flex; 
                      justify-content: space-between; 
                      align-items: center;
                      margin-bottom: 16px;
                      padding-bottom: 12px;
                      border-bottom: 1px solid #f3f4f6;
                    ">
                      <span style="color: #6b7280; font-size: 15px;">Frais de livraison</span>
                      <span style="
                        color: ${calculatedShippingFee === 0 ? '#10b981' : '#374151'}; 
                        font-size: 15px; 
                        font-weight: 600;
                      ">
                        ${calculatedShippingFee === 0 ? 'GRATUIT 🎉' : calculatedShippingFee.toFixed(2) + ' €'}
                      </span>
                    </div>
                    
                    <div style="
                      display: flex; 
                      justify-content: space-between; 
                      align-items: center;
                      padding: 12px 16px;
                      background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
                      border-radius: 10px;
                      color: white;
                    ">
                      <span style="font-size: 18px; font-weight: 700;">Total TTC</span>
                      <span style="font-size: 20px; font-weight: 800; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">${calculatedTotal.toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Informations de livraison -->
              <div style="
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                border: 1px solid #93c5fd;
                border-radius: 16px;
                padding: 24px;
                margin-bottom: 30px;
              ">
                <h3 style="
                  margin: 0 0 16px 0; 
                  color: #1e40af; 
                  font-size: 18px; 
                  font-weight: 700;
                  display: flex;
                  align-items: center;
                  gap: 10px;
                ">
                  <span style="font-size: 20px;">📦</span>
                  Livraison prévue
                </h3>
                
                <div style="
                  background: white;
                  padding: 16px 20px;
                  border-radius: 12px;
                  margin-bottom: 16px;
                  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
                ">
                  <div style="
                    color: #1e40af;
                    font-weight: 700;
                    font-size: 16px;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                  ">
                    📅 ${deliveryDate}
                  </div>
                  <div style="color: #6b7280; font-size: 14px;">
                    Livraison estimée (hors dimanche)
                  </div>
                </div>
                
                <div style="
                  background: rgba(255,255,255,0.7);
                  padding: 16px;
                  border-radius: 12px;
                  color: #4b5563;
                  line-height: 1.5;
                ">
                  <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">
                    ${shippingAddress.name}
                  </div>
                  <div style="font-size: 14px;">
                    ${shippingAddress.address}<br>
                    ${shippingAddress.city}, ${shippingAddress.country}
                  </div>
                </div>
              </div>

              <!-- Boutons d'action -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.BASE_URL}/mon-compte/commandes" style="
                  display: inline-block;
                  background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
                  color: white;
                  text-decoration: none;
                  padding: 14px 28px;
                  border-radius: 30px;
                  font-weight: 600;
                  font-size: 15px;
                  box-shadow: 0 6px 20px rgba(216, 154, 179, 0.4);
                  margin: 0 8px 12px 0;
                  transition: all 0.3s ease;
                  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                ">
                  📋 Suivre ma commande
                </a>
                <a href="${process.env.BASE_URL}/bijoux" style="
                  display: inline-block;
                  background: white;
                  color: #d89ab3;
                  text-decoration: none;
                  padding: 14px 28px;
                  border-radius: 30px;
                  font-weight: 600;
                  font-size: 15px;
                  border: 2px solid #d89ab3;
                  margin: 0 8px 12px 0;
                  transition: all 0.3s ease;
                ">
                  💎 Continuer mes achats
                </a>
              </div>

              <!-- Message final personnel -->
              <div style="
                background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
                border: 1px solid #fbbf24;
                border-radius: 16px;
                padding: 20px;
                text-align: center;
              ">
                <p style="
                  margin: 0; 
                  color: #92400e; 
                  font-size: 15px; 
                  line-height: 1.6;
                  font-style: italic;
                ">
                  "Chaque bijou raconte une histoire unique, et nous sommes honorés<br>
                  de faire partie de la vôtre. Merci de votre confiance ! ✨"
                </p>
                <p style="
                  margin: 12px 0 0 0; 
                  color: #92400e; 
                  font-weight: 600;
                  font-size: 14px;
                ">— L'équipe CrystosJewel</p>
              </div>

            </div>

            <!-- Footer élégant -->
            <div style="
              background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
              padding: 25px 30px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            ">
              <div style="margin-bottom: 16px;">
                <a href="${process.env.BASE_URL}" style="
                  color: #d89ab3; 
                  margin: 0 12px; 
                  text-decoration: none; 
                  font-weight: 500;
                  font-size: 14px;
                ">Accueil</a>
                <a href="${process.env.BASE_URL}/bijoux" style="
                  color: #d89ab3; 
                  margin: 0 12px; 
                  text-decoration: none; 
                  font-weight: 500;
                  font-size: 14px;
                ">Nos Bijoux</a>
                <a href="${process.env.BASE_URL}/contact" style="
                  color: #d89ab3; 
                  margin: 0 12px; 
                  text-decoration: none; 
                  font-weight: 500;
                  font-size: 14px;
                ">Contact</a>
              </div>
              
              <div style="
                font-size: 12px; 
                color: #6b7280; 
                line-height: 1.5;
              ">
                <p style="margin: 0 0 8px 0;">
                  Vous recevez cet email car vous avez passé commande sur 
                  <a href="${process.env.BASE_URL}" style="color: #d89ab3; text-decoration: none;">CrystosJewel.com</a>
                </p>
                <p style="margin: 0;">
                  Questions ? Contactez-nous à 
                  <a href="mailto:${process.env.MAIL_USER}" style="color: #d89ab3; text-decoration: none;">${process.env.MAIL_USER}</a>
                </p>
              </div>
            </div>

          </div>
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

// 📧 EMAIL ADMIN - Design professionnel et moderne
export const sendAdminOrderNotification = async (orderData, customerData) => {
  try {
    const { orderNumber, items, total, orderId } = orderData;
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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouvelle commande - CrystosJewel Admin</title>
      </head>
      <body style="
        margin: 0; 
        padding: 0; 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        min-height: 100vh;
      ">
        
        <div style="padding: 25px 15px;">
          <div style="
            max-width: 680px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 16px; 
            overflow: hidden; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
            border: 1px solid #e2e8f0;
          ">
            
            <!-- Header admin moderne -->
            <div style="
              background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
              padding: 28px 25px;
              color: white;
              position: relative;
              overflow: hidden;
            ">
              <!-- Décorations -->
              <div style="
                position: absolute;
                top: -40px;
                right: -40px;
                width: 100px;
                height: 100px;
                background: rgba(255,255,255,0.05);
                border-radius: 50%;
              "></div>
              
              <div style="position: relative; z-index: 2;">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                  <div style="
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                  ">🔔</div>
                  <div>
                    <h1 style="
                      margin: 0;
                      font-size: 22px;
                      font-weight: 700;
                      letter-spacing: -0.5px;
                    ">Nouvelle Commande Reçue</h1>
                    <p style="
                      margin: 4px 0 0 0;
                      opacity: 0.9;
                      font-size: 14px;
                      font-weight: 400;
                    ">CrystosJewel Administration</p>
                  </div>
                </div>
                
                <!-- Badge urgence -->
                <div style="
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                  color: white;
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-size: 13px;
                  font-weight: 600;
                  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                ">
                  <span style="font-size: 14px;">⚡</span>
                  Action requise
                </div>
              </div>
            </div>

            <!-- Statistiques en cards -->
            <div style="
              background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
              padding: 25px;
            ">
              <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 16px;
              ">
                <!-- Total -->
                <div style="
                  background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
                  color: white;
                  padding: 20px 18px;
                  border-radius: 12px;
                  text-align: center;
                  box-shadow: 0 6px 20px rgba(216, 154, 179, 0.3);
                  position: relative;
                  overflow: hidden;
                ">
                  <div style="
                    position: absolute;
                    top: -15px;
                    right: -15px;
                    width: 60px;
                    height: 60px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 50%;
                  "></div>
                  <div style="position: relative; z-index: 2;">
                    <div style="
                      font-size: 26px;
                      font-weight: 800;
                      margin-bottom: 6px;
                      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    ">${total.toFixed(2)} €</div>
                    <div style="
                      font-size: 12px;
                      opacity: 0.9;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      font-weight: 500;
                    ">Montant Total</div>
                  </div>
                </div>
                
                <!-- Articles -->
                <div style="
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 20px 18px;
                  border-radius: 12px;
                  text-align: center;
                  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
                  position: relative;
                  overflow: hidden;
                ">
                  <div style="
                    position: absolute;
                    top: -15px;
                    right: -15px;
                    width: 60px;
                    height: 60px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 50%;
                  "></div>
                  <div style="position: relative; z-index: 2;">
                    <div style="
                      font-size: 26px;
                      font-weight: 800;
                      margin-bottom: 6px;
                    ">${items.length}</div>
                    <div style="
                      font-size: 12px;
                      opacity: 0.9;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      font-weight: 500;
                    ">Article${items.length > 1 ? 's' : ''}</div>
                  </div>
                </div>
                
                <!-- ID Commande -->
                <div style="
                  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                  color: white;
                  padding: 20px 18px;
                  border-radius: 12px;
                  text-align: center;
                  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.3);
                  position: relative;
                  overflow: hidden;
                ">
                  <div style="
                    position: absolute;
                    top: -15px;
                    right: -15px;
                    width: 60px;
                    height: 60px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 50%;
                  "></div>
                  <div style="position: relative; z-index: 2;">
                    <div style="
                      font-size: 12px;
                      opacity: 0.9;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      font-weight: 500;
                    ">ID Commande</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Détails de la commande -->
            <div style="padding: 25px;">
              
              <!-- En-tête commande -->
              <div style="
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 25px;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  margin-bottom: 16px;
                ">
                  <div style="
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                  ">📋</div>
                  <div>
                    <h2 style="
                      margin: 0;
                      color: #1e293b;
                      font-size: 19px;
                      font-weight: 700;
                    ">Commande ${orderNumber}</h2>
                    <p style="
                      margin: 3px 0 0 0;
                      color: #64748b;
                      font-size: 13px;
                    ">Reçue le ${dateCommande}</p>
                  </div>
                </div>
                
                <!-- Statut -->
                <div style="
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                  color: #92400e;
                  padding: 8px 16px;
                  border-radius: 16px;
                  font-size: 13px;
                  font-weight: 600;
                  border: 1px solid #fbbf24;
                ">
                  <span style="
                    width: 6px;
                    height: 6px;
                    background: #f59e0b;
                    border-radius: 50%;
                    display: inline-block;
                  "></span>
                  En attente de traitement
                </div>
              </div>

              <!-- Articles commandés -->
              <div style="margin-bottom: 25px;">
                <h3 style="
                  color: #1e293b;
                  font-size: 18px;
                  font-weight: 700;
                  margin: 0 0 16px 0;
                  display: flex;
                  align-items: center;
                  gap: 10px;
                ">
                  <span style="font-size: 20px;">🛍️</span>
                  Articles commandés
                </h3>
                
                <div style="
                  background: white;
                  border: 1px solid #e2e8f0;
                  border-radius: 12px;
                  overflow: hidden;
                ">
                  ${items.map((item, index) => `
                    <div style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      padding: 16px 18px;
                      ${index < items.length - 1 ? 'border-bottom: 1px solid #f1f5f9;' : ''}
                    ">
                      <div>
                        <div style="
                          color: #1e293b;
                          font-size: 15px;
                          font-weight: 600;
                          margin-bottom: 4px;
                        ">${item.name}</div>
                        <div style="
                          color: #64748b;
                          font-size: 13px;
                        ">${item.quantity} × ${item.price.toFixed(2)} €</div>
                      </div>
                      <div style="
                        color: #d89ab3;
                        font-size: 16px;
                        font-weight: 700;
                      ">${item.total.toFixed(2)} €</div>
                    </div>
                  `).join('')}
                  
                  <!-- Total récapitulatif -->
                  <div style="
                    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                    color: white;
                    padding: 16px 18px;
                    text-align: right;
                  ">
                    <div style="
                      font-size: 18px;
                      font-weight: 800;
                      letter-spacing: -0.5px;
                    ">Total: ${total.toFixed(2)} €</div>
                    <div style="
                      font-size: 12px;
                      opacity: 0.8;
                      margin-top: 3px;
                    ">TTC • Livraison incluse</div>
                  </div>
                </div>
              </div>

              <!-- Informations client -->
              <div style="
                background: white;
                border: 2px solid #d89ab3;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 25px;
                box-shadow: 0 4px 12px rgba(216, 154, 179, 0.1);
              ">
                <h3 style="
                  color: #1e293b;
                  font-size: 18px;
                  font-weight: 700;
                  margin: 0 0 16px 0;
                  display: flex;
                  align-items: center;
                  gap: 10px;
                ">
                  <span style="font-size: 20px;">👤</span>
                  Informations client
                </h3>
                
                <div style="
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
                ">
                  <div>
                    <div style="margin-bottom: 16px;">
                      <div style="
                        font-size: 12px;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        font-weight: 600;
                        margin-bottom: 4px;
                      ">Nom complet</div>
                      <div style="
                        font-size: 16px;
                        color: #1e293b;
                        font-weight: 600;
                      ">${firstName} ${lastName}</div>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                      <div style="
                        font-size: 12px;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        font-weight: 600;
                        margin-bottom: 4px;
                      ">Email</div>
                      <a href="mailto:${email}" style="
                        font-size: 14px;
                        color: #3b82f6;
                        text-decoration: none;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                      ">
                        <span style="font-size: 16px;">📧</span>
                        ${email}
                      </a>
                    </div>
                    
                    ${phone ? `
                    <div>
                      <div style="
                        font-size: 12px;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        font-weight: 600;
                        margin-bottom: 4px;
                      ">Téléphone</div>
                      <a href="tel:${phone}" style="
                        font-size: 14px;
                        color: #3b82f6;
                        text-decoration: none;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                      ">
                        <span style="font-size: 16px;">📱</span>
                        ${phone}
                      </a>
                    </div>
                    ` : ''}
                  </div>
                  
                  <div>
                    <div style="
                      font-size: 12px;
                      color: #64748b;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      font-weight: 600;
                      margin-bottom: 4px;
                    ">Adresse de livraison</div>
                    <div style="
                      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                      padding: 14px 16px;
                      border-radius: 10px;
                      color: #475569;
                      line-height: 1.5;
                      font-size: 14px;
                      border: 1px solid #e2e8f0;
                    ">
                      <div style="
                        display: flex;
                        align-items: flex-start;
                        gap: 8px;
                      ">
                        <span style="font-size: 16px; margin-top: 1px;">📍</span>
                        <div>${address}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Actions CTA -->
              <div style="
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 22px;
                text-align: center;
              ">
                <h3 style="
                  color: #1e293b;
                  font-size: 18px;
                  font-weight: 700;
                  margin: 0 0 18px 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 10px;
                ">
                  <span style="font-size: 20px;">⚡</span>
                  Actions rapides
                </h3>
                
                <div style="
                  display: flex;
                  gap: 12px;
                  justify-content: center;
                  flex-wrap: wrap;
                ">
                  <a href="${process.env.BASE_URL}/admin/commandes/${orderId}" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: linear-gradient(135deg, #d89ab3 0%, #c084a1 100%);
                    color: white;
                    text-decoration: none;
                    padding: 12px 20px;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(216, 154, 179, 0.3);
                  ">
                    <span style="font-size: 16px;">👁️</span>
                    Voir commande
                  </a>
                  
                  <a href="${process.env.BASE_URL}/admin/commandes/${orderId}/expedier" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    text-decoration: none;
                    padding: 12px 20px;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                  ">
                    <span style="font-size: 16px;">📦</span>
                    Expédier
                  </a>
                  
                  <a href="${process.env.BASE_URL}/admin/commandes" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    text-decoration: none;
                    padding: 12px 20px;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                  ">
                    <span style="font-size: 16px;">📊</span>
                    Dashboard
                  </a>
                </div>
              </div>

            </div>

            <!-- Footer admin -->
            <div style="
              background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
              color: white;
              padding: 20px 25px;
              text-align: center;
            ">
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                margin-bottom: 8px;
              ">
                <span style="font-size: 18px;">✨</span>
                <span style="
                  font-size: 15px;
                  font-weight: 600;
                  letter-spacing: 0.5px;
                ">CrystosJewel Administration</span>
              </div>
              <p style="
                margin: 0;
                opacity: 0.8;
                font-size: 13px;
                line-height: 1.4;
              ">
                Notification automatique • Cette commande nécessite votre attention
              </p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    
    const info = await transporter.sendMail({
      from: `"CrystosJewel Admin ✨" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: `✨ Nouvelle commande ${orderNumber} • ${total.toFixed(2)}€ • ${firstName} ${lastName}`,
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


// Email de notification d'expédition
export const sendShippingNotificationEmail = async (userEmail, firstName, shippingData) => {
  try {
    const { orderNumber, trackingNumber, carrier, estimatedDelivery } = shippingData;

    const htmlContent = `
      <div style="
        font-family: 'Inter', Arial, sans-serif;
        color: #3a3a3a;
        background: linear-gradient(135deg, #fff8f0 0%, #f5e6d3 100%);
        margin: 0;
        padding: 20px;
      ">
        <div style="
          max-width: 650px;
          margin: auto;
          background: white;
          border-radius: 20px;
          box-shadow: 0 16px 48px rgba(232, 180, 184, 0.16);
          overflow: hidden;
        ">
          
          <!-- Header -->
          <header style="
            background: linear-gradient(135deg, #E8B4B8 0%, #B8868A 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
          ">
            <h1 style="
              margin: 0 0 10px 0;
              font-size: 2.5rem;
              font-weight: 700;
              letter-spacing: 2px;
              font-family: 'Playfair Display', serif;
            ">✨ CrystosJewel ✨</h1>
          </header>

          <!-- Contenu principal -->
          <main style="padding: 40px 30px; text-align: center;">
            
            <div style="font-size: 4rem; margin-bottom: 20px;">📦</div>
            
            <h2 style="
              color: #B8868A;
              font-size: 2rem;
              margin: 0 0 15px 0;
              font-family: 'Playfair Display', serif;
            ">Bonne nouvelle ${firstName} !</h2>
            
            <p style="
              color: #666;
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: 30px;
            ">Votre commande <strong>${orderNumber}</strong> a été expédiée !<br>
            Vos bijoux sont en route vers vous ✨</p>

            <!-- Informations de suivi -->
            <div style="
              background: linear-gradient(135deg, #F8F4F0 0%, #F5E6D3 100%);
              border-radius: 16px;
              padding: 25px;
              margin-bottom: 30px;
              text-align: left;
            ">
              <h3 style="
                color: #B8868A;
                margin: 0 0 20px 0;
                text-align: center;
              ">📋 Informations de suivi</h3>
              
              <div style="
                display: grid;
                gap: 15px;
              ">
                <div>
                  <strong style="color: #7d4b53;">Transporteur:</strong><br>
                  <span style="color: #666;">${carrier}</span>
                </div>
                <div>
                  <strong style="color: #7d4b53;">Numéro de suivi:</strong><br>
                  <span style="
                    background: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-family: 'Courier New', monospace;
                    color: #B8868A;
                    font-weight: 600;
                    display: inline-block;
                    margin-top: 5px;
                  ">${trackingNumber}</span>
                </div>
                <div>
                  <strong style="color: #7d4b53;">Livraison estimée:</strong><br>
                  <span style="color: #28A745; font-weight: 600;">${estimatedDelivery}</span>
                </div>
              </div>
            </div>

            <!-- CTA -->
            <a href="${process.env.BASE_URL}/mon-compte/commandes" style="
              display: inline-block;
              background: linear-gradient(135deg, #E8B4B8 0%, #B8868A 100%);
              color: white;
              text-decoration: none;
              padding: 15px 30px;
              border-radius: 50px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 16px rgba(232, 180, 184, 0.3);
            ">📍 Suivre mon colis</a>

          </main>

          <!-- Footer simple -->
          <footer style="
            background: #F8F4F0;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
          ">
            <p style="margin: 0;">
              Des questions ? Contactez-nous à 
              <a href="mailto:${process.env.MAIL_USER}" style="color: #B8868A;">${process.env.MAIL_USER}</a>
            </p>
          </footer>

        </div>
      </div>
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

// ✅ FONCTION PRINCIPALE - ENVOI SIMULTANÉ CLIENT + ADMIN
export const sendOrderConfirmationEmails = async (userEmail, firstName, orderData, customerData) => {
  try {
    console.log('📧 Envoi simultané des emails de confirmation...');
    
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
    console.error("❌ Erreur lors de l'envoi simultané des emails :", error);
    return {
      customer: { success: false, error: error.message },
      admin: { success: false, error: error.message }
    };
  }
};