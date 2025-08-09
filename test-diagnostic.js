// ✅ 1. CRÉEZ LE FICHIER test-diagnostic.js dans la racine de votre projet

import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

console.log('🔍 DIAGNOSTIC COMPLET DU SYSTÈME EMAIL');
console.log('=====================================\n');

// Configuration du transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  debug: true,
  logger: true
});

async function runDiagnostic() {
  console.log('📧 Configuration actuelle:');
  console.log('- MAIL_USER:', process.env.MAIL_USER);
  console.log('- MAIL_PASS:', process.env.MAIL_PASS ? 'Défini ✅' : 'Manquant ❌');
  console.log('- BASE_URL:', process.env.BASE_URL);
  console.log('\n');

  // Test 1: Vérification de la connexion
  console.log('🔌 Test 1: Vérification de la connexion Gmail...');
  try {
    await transporter.verify();
    console.log('✅ Connexion Gmail OK\n');
  } catch (error) {
    console.log('❌ Erreur connexion Gmail:', error.message);
    return;
  }

  // Test 2: Email simple vers Hotmail
  console.log('📤 Test 2: Email simple vers Hotmail...');
  try {
    const info = await transporter.sendMail({
      from: `"Test CrystosJewel" <${process.env.MAIL_USER}>`,
      to: 'dalla.Sacko@hotmail.com',
      subject: 'Test diagnostic - Email simple',
      text: 'Ceci est un test simple pour vérifier la livraison vers Hotmail.',
      html: `
        <h2>Test Diagnostic</h2>
        <p>Ceci est un email de test simple.</p>
        <p>Si vous recevez cet email, la configuration de base fonctionne.</p>
        <p>Heure: ${new Date().toLocaleString('fr-FR')}</p>
      `
    });
    
    console.log('✅ Email simple envoyé');
    console.log('Response:', info.response);
    console.log('MessageId:', info.messageId);
    console.log('\n');
  } catch (error) {
    console.log('❌ Erreur email simple:', error.message);
  }

  // Test 3: Email vers Gmail (pour comparaison)
  console.log('📤 Test 3: Email vers Gmail (test de contrôle)...');
  try {
    const info = await transporter.sendMail({
      from: `"Test CrystosJewel" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER, // Vers vous-même
      subject: 'Test diagnostic - Email vers Gmail',
      text: 'Test de contrôle vers Gmail',
      html: `
        <h2>Test de Contrôle</h2>
        <p>Cet email teste l'envoi vers Gmail.</p>
        <p>Si vous recevez celui-ci mais pas celui vers Hotmail, le problème vient de Hotmail.</p>
      `
    });
    
    console.log('✅ Email Gmail envoyé');
    console.log('Response:', info.response);
    console.log('\n');
  } catch (error) {
    console.log('❌ Erreur email Gmail:', error.message);
  }

  // Test 4: Email automatique simulé
  console.log('📤 Test 4: Simulation email automatique commande...');
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test Commande</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color: #f5f5f5; padding: 20px;">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: white; border-radius: 8px;">
                <tr>
                  <td style="background-color: #B8868A; padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">CrystosJewel</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    <h2>Test Email Automatique</h2>
                    <p>Votre commande TEST-123 a été expédiée.</p>
                    <p>Numéro de suivi: FR123456789</p>
                    <p>Montant: 49.99€</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                    <p>CrystosJewel - Test Diagnostic</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"CrystosJewel" <${process.env.MAIL_USER}>`,
      to: 'dalla.Sacko@hotmail.com',
      subject: 'Commande TEST-123 expédiée - CrystosJewel',
      text: 'Votre commande TEST-123 a été expédiée. Numéro de suivi: FR123456789',
      html: htmlContent,
      headers: {
        'X-Priority': '1',
        'Importance': 'high'
      }
    });
    
    console.log('✅ Email automatique simulé envoyé');
    console.log('Response:', info.response);
    console.log('MessageId:', info.messageId);
    console.log('\n');
  } catch (error) {
    console.log('❌ Erreur email automatique:', error.message);
  }

  console.log('🎯 RÉSULTATS DU DIAGNOSTIC:');
  console.log('===========================');
  console.log('1. Vérifiez votre boîte Gmail - vous devriez avoir reçu l\'email de contrôle');
  console.log('2. Vérifiez Hotmail dans TOUS ces dossiers:');
  console.log('   📥 Boîte de réception');
  console.log('   📁 Courrier indésirable/SPAM');
  console.log('   📁 Autres');
  console.log('   📁 Promotions');
  console.log('   📁 Éléments supprimés');
  console.log('\n3. Si les emails n\'arrivent pas dans Hotmail:');
  console.log('   - Le problème vient des filtres Hotmail');
  console.log('   - Testez avec une autre adresse email');
  console.log('   - Configurez Hotmail pour accepter les emails de', process.env.MAIL_USER);
}

runDiagnostic().then(() => {
  console.log('\n✅ Diagnostic terminé!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erreur diagnostic:', error);
  process.exit(1);
});

// ✅ 2. VÉRIFICATION DE LA FONCTION ACTUELLE
// Vérifiez que votre fonction sendStatusChangeEmail dans mailService.js ressemble à ceci:

export const sendStatusChangeEmail = async (orderData, statusChangeData, customerData) => {
  try {
    console.log('📧 [AUTO-EMAIL] === DÉBUT EMAIL AUTOMATIQUE ===');
    console.log('📧 [AUTO-EMAIL] Commande:', orderData.numero_commande);
    console.log('📧 [AUTO-EMAIL] Destinataire:', customerData.userEmail);
    console.log('📧 [AUTO-EMAIL] Changement:', statusChangeData.oldStatus, '→', statusChangeData.newStatus);

    // Vérification email
    if (!customerData.userEmail || !customerData.userEmail.includes('@')) {
      console.log('📧 [AUTO-EMAIL] ❌ Email invalide');
      return { success: false, error: 'Email invalide' };
    }

    // Messages simples
    const statusMessages = {
      'pending': 'Votre commande est en cours de préparation',
      'waiting': 'Votre commande est en cours de préparation',
      'preparing': 'Votre commande est en cours de traitement', 
      'shipped': 'Votre commande a été expédiée',
      'delivered': 'Votre commande a été livrée',
      'cancelled': 'Votre commande a été annulée'
    };

    const statusMessage = statusMessages[statusChangeData.newStatus] || `Statut mis à jour : ${statusChangeData.newStatus}`;
    
    // Email simple et propre
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Mise à jour commande</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
          <tr>
            <td align="center" style="padding: 20px;">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: white; border-radius: 8px;">
                
                <!-- Header -->
                <tr>
                  <td style="background-color: #B8868A; padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">CrystosJewel</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 30px;">
                    <h2 style="color: #B8868A; margin-top: 0;">Bonjour ${customerData.firstName},</h2>
                    
                    <p style="font-size: 16px; line-height: 1.6;">
                      ${statusMessage}.
                    </p>
                    
                    <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 8px; margin: 20px 0;">
                      <tr>
                        <td><strong>Numéro de commande:</strong></td>
                        <td>${orderData.numero_commande}</td>
                      </tr>
                      <tr>
                        <td><strong>Montant:</strong></td>
                        <td>${orderData.total}€</td>
                      </tr>
                      <tr>
                        <td><strong>Statut:</strong></td>
                        <td>${statusChangeData.newStatus}</td>
                      </tr>
                      ${orderData.tracking_number ? `
                      <tr>
                        <td><strong>Numéro de suivi:</strong></td>
                        <td style="font-family: monospace;">${orderData.tracking_number}</td>
                      </tr>
                      ` : ''}
                    </table>
                    
                    ${statusChangeData.newStatus === 'shipped' ? `
                    <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <strong>Votre colis est en route!</strong><br>
                      ${orderData.tracking_number ? 
                        'Utilisez le numéro de suivi ci-dessus.' : 
                        'Vous recevrez bientôt le numéro de suivi.'
                      }
                    </div>
                    ` : ''}
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                    <p style="margin: 0; color: #666;">
                      Questions? Contactez-nous: 
                      <a href="mailto:${process.env.MAIL_USER}" style="color: #B8868A;">
                        ${process.env.MAIL_USER}
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

    // Version texte obligatoire
    const textContent = `
CrystosJewel - Mise à jour de votre commande

Bonjour ${customerData.firstName},

${statusMessage}.

Détails:
- Commande: ${orderData.numero_commande}
- Montant: ${orderData.total}€
- Statut: ${statusChangeData.newStatus}
${orderData.tracking_number ? `- Suivi: ${orderData.tracking_number}` : ''}

Questions? ${process.env.MAIL_USER}

CrystosJewel
    `;

    console.log('📧 [AUTO-EMAIL] Préparation envoi...');
    console.log('📧 [AUTO-EMAIL] Sujet: Commande', orderData.numero_commande, 'mise à jour');

    // Configuration d'envoi
    const mailOptions = {
      from: `"CrystosJewel" <${process.env.MAIL_USER}>`,
      to: customerData.userEmail,
      subject: `Commande ${orderData.numero_commande} mise à jour - CrystosJewel`,
      html: htmlContent,
      text: textContent
    };

    console.log('📧 [AUTO-EMAIL] 🚀 ENVOI EN COURS...');
    
    // Envoi
    const info = await transporter.sendMail(mailOptions);

    console.log('📧 [AUTO-EMAIL] ✅ EMAIL ENVOYÉ AVEC SUCCÈS!');
    console.log('📧 [AUTO-EMAIL] Response:', info.response);
    console.log('📧 [AUTO-EMAIL] Message ID:', info.messageId);
    console.log('📧 [AUTO-EMAIL] === FIN EMAIL AUTOMATIQUE ===');
    
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.log('📧 [AUTO-EMAIL] ❌ ERREUR:', error.message);
    console.log('📧 [AUTO-EMAIL] Stack:', error.stack);
    return { success: false, error: error.message };
  }
};

// ✅ 3. INSTRUCTIONS D'UTILISATION
/*
1. Créez le fichier test-diagnostic.js avec le code ci-dessus
2. Lancez: node test-diagnostic.js
3. Vérifiez Gmail (vous devriez recevoir l'email de contrôle)
4. Vérifiez TOUS les dossiers Hotmail
5. Si Hotmail ne reçoit rien, le problème vient de leurs filtres
*/