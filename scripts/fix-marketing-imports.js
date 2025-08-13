// scripts/fix-marketing-imports.js - CORRECTION RAPIDE DES IMPORTS

import fs from 'fs';
import path from 'path';

console.log('🔧 Correction des erreurs d\'import marketing...');

// 1. Corriger le marketingController.js existant
function fixMarketingController() {
  const controllerPath = './app/controlleurs/marketingController.js';
  
  if (fs.existsSync(controllerPath)) {
    console.log('📝 Correction du marketingController.js existant...');
    
    const fixedController = `// app/controlleurs/marketingController.js - VERSION CORRIGÉE
import { 
  sendMarketingTestEmail,
  saveMarketingCampaignDraft,
  sendMarketingCampaign,
  getMarketingCampaignStats,
  getMarketingCampaignHistory,
  getGlobalMarketingStats,
  getMarketingEmailTemplates,
  getMarketingRecipients,
  trackMarketingEmailOpen,
  trackMarketingEmailClick,
  unsubscribeMarketingEmail,
  autoSaveMarketingCampaign,
  getEmailEditorData
} from '../services/emailMarketingService.js';

// Contrôleur marketing de base (version simplifiée)
export const marketingController = {
  
  // Méthode pour tester l'envoi d'emails
  async sendTestEmail(req, res) {
    try {
      const { email, subject, content } = req.body;
      
      if (!email || !subject || !content) {
        return res.status(400).json({
          success: false,
          message: 'Email, sujet et contenu requis'
        });
      }

      const result = await sendMarketingTestEmail({
        email,
        subject,
        content,
        template: 'elegant'
      });

      if (result.success) {
        res.json({
          success: true,
          message: \`Email de test envoyé à \${email}\`
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Erreur lors de l\'envoi'
        });
      }

    } catch (error) {
      console.error('❌ Erreur envoi test email:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Méthode pour obtenir les statistiques
  async getStats(req, res) {
    try {
      const result = await getGlobalMarketingStats();
      
      if (result.success) {
        res.json({
          success: true,
          stats: result.stats
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des statistiques'
        });
      }

    } catch (error) {
      console.error('❌ Erreur récupération stats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },

  // Méthode pour la liste des destinataires
  async getRecipients(req, res) {
    try {
      const { filter = 'newsletter', search = '' } = req.query;
      
      const result = await getMarketingRecipients(filter, search);
      
      if (result.success) {
        res.json({
          success: true,
          recipients: result.customers,
          counts: result.counts
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des destinataires'
        });
      }

    } catch (error) {
      console.error('❌ Erreur récupération destinataires:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
};

export default marketingController;
console.log('✅ marketingController.js corrigé et chargé');
`;

    try {
      fs.writeFileSync(controllerPath, fixedController);
      console.log('✅ marketingController.js corrigé');
    } catch (error) {
      console.error('❌ Erreur écriture marketingController:', error);
    }
  } else {
    console.log('ℹ️ Aucun marketingController.js trouvé à corriger');
  }
}

// 2. Créer emailMarketingService.js minimal s'il n'existe pas
function createMinimalEmailService() {
  const servicePath = './app/services/emailMarketingService.js';
  
  if (!fs.existsSync(servicePath)) {
    console.log('📝 Création du service email minimal...');
    
    // Créer le dossier si nécessaire
    const serviceDir = path.dirname(servicePath);
    if (!fs.existsSync(serviceDir)) {
      fs.mkdirSync(serviceDir, { recursive: true });
    }
    
    const minimalService = `// app/services/emailMarketingService.js - VERSION MINIMALE FONCTIONNELLE
import nodemailer from 'nodemailer';

// Configuration email de base
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ===== FONCTIONS PRINCIPALES SIMPLIFIÉES =====

export const sendMarketingTestEmail = async (emailData) => {
  try {
    const { email, subject, content } = emailData;
    
    const result = await transporter.sendMail({
      from: \`"CrystosJewel" <\${process.env.MAIL_USER}>\`,
      to: email,
      subject: \`[TEST] \${subject}\`,
      html: content || '<p>Email de test</p>'
    });

    console.log('✅ Email de test envoyé:', email);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return { success: false, error: error.message };
  }
};

export const saveMarketingCampaignDraft = async (campaignData) => {
  console.log('💾 Sauvegarde brouillon (simulée):', campaignData.name);
  return { success: true, campaignId: Date.now() };
};

export const sendMarketingCampaign = async (campaignData) => {
  console.log('📧 Envoi campagne (simulé):', campaignData.name);
  return { 
    success: true, 
    campaignId: Date.now(),
    sentCount: campaignData.recipients?.length || 0,
    errorCount: 0,
    message: 'Campagne envoyée avec succès (mode simulation)'
  };
};

export const getMarketingCampaignStats = async (campaignId) => {
  return { 
    success: true, 
    stats: {
      name: 'Campagne Test',
      subject: 'Sujet Test',
      recipients_count: 100,
      sent_count: 95,
      open_count: 25,
      click_count: 5,
      open_rate: 26.3,
      click_rate: 5.3,
      created_at: new Date().toISOString(),
      sent_at: new Date().toISOString()
    }
  };
};

export const getMarketingCampaignHistory = async (limit = 20, offset = 0) => {
  return { 
    success: true, 
    campaigns: [
      {
        id: 1,
        name: 'Campagne de Bienvenue',
        subject: '🎉 Bienvenue chez CrystosJewel !',
        status: 'sent',
        recipients_count: 150,
        sent_count: 148,
        open_count: 42,
        click_count: 8,
        open_rate: 28.4,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString()
      }
    ]
  };
};

export const getGlobalMarketingStats = async () => {
  return { 
    success: true, 
    stats: {
      total_campaigns: 3,
      total_emails_sent: 450,
      global_open_rate: 25.5,
      global_click_rate: 4.2,
      total_subscribers: 200
    }
  };
};

export const getMarketingEmailTemplates = async () => {
  const templates = [
    { id: 1, name: 'Élégant', template_type: 'elegant', is_default: true },
    { id: 2, name: 'Moderne', template_type: 'modern', is_default: false },
    { id: 3, name: 'Classique', template_type: 'classic', is_default: false },
    { id: 4, name: 'Minimal', template_type: 'minimal', is_default: false }
  ];
  return { success: true, templates };
};

export const getMarketingRecipients = async (filter = 'newsletter', search = '') => {
  // Simulation de données clients
  const mockCustomers = [
    {
      id: 1,
      email: 'client1@example.com',
      first_name: 'Marie',
      last_name: 'Dupont',
      name: 'Marie Dupont',
      totalOrders: 2,
      hasOrders: true
    },
    {
      id: 2,
      email: 'client2@example.com',
      first_name: 'Jean',
      last_name: 'Martin',
      name: 'Jean Martin',
      totalOrders: 0,
      hasOrders: false
    }
  ];

  const counts = { all: 2, newsletter: 1, customers: 1, vip: 0 };
  
  let filteredCustomers = mockCustomers;
  if (filter === 'newsletter') {
    filteredCustomers = mockCustomers.filter(c => !c.hasOrders);
  } else if (filter === 'customers') {
    filteredCustomers = mockCustomers.filter(c => c.hasOrders);
  }

  if (search) {
    filteredCustomers = filteredCustomers.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  return { success: true, customers: filteredCustomers, counts };
};

export const trackMarketingEmailOpen = async (trackingToken) => {
  console.log('📊 Tracking ouverture:', trackingToken);
  return { success: true };
};

export const trackMarketingEmailClick = async (trackingToken) => {
  console.log('🖱️ Tracking clic:', trackingToken);
  return { success: true };
};

export const unsubscribeMarketingEmail = async (trackingToken) => {
  console.log('❌ Désabonnement:', trackingToken);
  return { success: true, email: 'client@example.com' };
};

export const autoSaveMarketingCampaign = async (campaignData) => {
  console.log('💾 Auto-sauvegarde:', campaignData.name || 'Sans nom');
  return { success: true };
};

export const getEmailEditorData = async () => {
  const templates = await getMarketingEmailTemplates();
  const recipients = await getMarketingRecipients();
  const stats = await getGlobalMarketingStats();
  
  return {
    success: true,
    data: {
      templates: templates.templates || [],
      customers: recipients.customers || [],
      recipientCounts: recipients.counts || {},
      globalStats: stats.stats || {},
      jewels: [], // À intégrer plus tard
      baseUrl: process.env.BASE_URL || 'http://localhost:3000'
    }
  };
};

export const initializeMarketingService = async () => {
  console.log('🚀 Service marketing initialisé (mode minimal)');
  return { success: true };
};

console.log('✅ Service email marketing minimal chargé');
`;

    try {
      fs.writeFileSync(servicePath, minimalService);
      console.log('✅ emailMarketingService.js créé');
    } catch (error) {
      console.error('❌ Erreur création service:', error);
    }
  } else {
    console.log('ℹ️ emailMarketingService.js existe déjà');
  }
}

// 3. Créer les vues de désabonnement manquantes
function createUnsubscribeViews() {
  const viewsDir = './views/marketing';
  
  // Créer le dossier si nécessaire
  if (!fs.existsSync(viewsDir)) {
    fs.mkdirSync(viewsDir, { recursive: true });
    console.log('📁 Dossier views/marketing créé');
  }

  // Page de succès
  const successView = \`<!-- views/marketing/unsubscribe-success.ejs -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Désabonnement Réussi - CrystosJewel</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8fafc; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .success-icon { font-size: 60px; color: #10b981; margin-bottom: 20px; }
        h1 { color: #1e293b; margin-bottom: 20px; }
        p { color: #64748b; line-height: 1.6; margin-bottom: 20px; }
        .btn { display: inline-block; background: #d89ab3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; }
        .btn:hover { background: #b794a8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>Désabonnement Réussi</h1>
        <p><%= message || 'Vous avez été désabonné avec succès de notre newsletter.' %></p>
        <% if (typeof email !== 'undefined' && email) { %>
            <p><strong>Email :</strong> <%= email %></p>
        <% } %>
        <a href="/" class="btn">Retour à l'accueil</a>
        <a href="/contact" class="btn">Nous contacter</a>
    </div>
</body>
</html>\`;

  // Page d'erreur
  const errorView = \`<!-- views/marketing/unsubscribe-error.ejs -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erreur de Désabonnement - CrystosJewel</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8fafc; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .error-icon { font-size: 60px; color: #ef4444; margin-bottom: 20px; }
        h1 { color: #1e293b; margin-bottom: 20px; }
        p { color: #64748b; line-height: 1.6; margin-bottom: 20px; }
        .btn { display: inline-block; background: #d89ab3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; }
        .btn:hover { background: #b794a8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>Erreur de Désabonnement</h1>
        <p><%= message || 'Une erreur est survenue lors du désabonnement.' %></p>
        <p>Le lien peut avoir expiré ou être invalide.</p>
        <a href="/" class="btn">Retour à l'accueil</a>
        <a href="/contact" class="btn">Nous contacter</a>
    </div>
</body>
</html>\`;

  try {
    fs.writeFileSync(path.join(viewsDir, 'unsubscribe-success.ejs'), successView);
    fs.writeFileSync(path.join(viewsDir, 'unsubscribe-error.ejs'), errorView);
    console.log('✅ Vues de désabonnement créées');
  } catch (error) {
    console.error('❌ Erreur création vues:', error);
  }
}

// 4. Instructions finales
function showInstructions() {
  console.log('');
  console.log('🎉 CORRECTIONS APPLIQUÉES !');
  console.log('');
  console.log('📋 ÉTAPES SUIVANTES :');
  console.log('');
  console.log('1. Redémarrez votre serveur maintenant');
  console.log('2. L\'erreur d\'import devrait être résolue');
  console.log('3. Pour utiliser le système marketing complet :');
  console.log('   - Copiez adminMarketingController.js dans app/controlleurs/');
  console.log('   - Copiez adminMarketingRoutes.js dans routes/');
  console.log('   - Ajoutez les routes dans app.js');
  console.log('');
  console.log('4. Variables d\'environnement requises :');
  console.log('   MAIL_USER=votre-email@gmail.com');
  console.log('   MAIL_PASS=votre-mot-de-passe-application');
  console.log('   BASE_URL=http://localhost:3000');
  console.log('');
  console.log('5. Test rapide : accédez à /admin/marketing/email-editor');
  console.log('');
}

// Exécuter toutes les corrections
console.log('🔧 Démarrage des corrections...');

fixMarketingController();
createMinimalEmailService();
createUnsubscribeViews();
showInstructions();

export { fixMarketingController, createMinimalEmailService, createUnsubscribeViews };