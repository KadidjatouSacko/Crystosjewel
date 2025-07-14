// app/services/smsService.js
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Configuration Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let client;

// Initialiser le client Twilio
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  console.warn('⚠️ Configuration Twilio manquante. Les SMS ne seront pas envoyés.');
}

/**
 * Fonction utilitaire pour formater le numéro de téléphone français
 */
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;
  
  // Nettoyer le numéro
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Si le numéro commence par 0, remplacer par +33
  if (cleaned.startsWith('0')) {
    cleaned = '+33' + cleaned.substring(1);
  }
  
  // Si le numéro ne commence pas par +, ajouter +33
  if (!cleaned.startsWith('+')) {
    cleaned = '+33' + cleaned;
  }
  
  return cleaned;
};

/**
 * Messages SMS selon le statut de la commande
 */
const getSMSMessageByStatus = (status, orderData) => {
  const { numero_commande, tracking_number, customer_name } = orderData;
  const firstName = customer_name?.split(' ')[0] || 'Client';

  const messages = {
    pending: {
      message: `🔔 CrystosJewel: Bonjour ${firstName}, votre commande ${numero_commande} est en attente de traitement. Nous vous tiendrons informé(e) !`,
      priority: 'low'
    },
    confirmed: {
      message: `✅ CrystosJewel: ${firstName}, votre commande ${numero_commande} est confirmée ! Préparation en cours. Merci pour votre confiance 💎`,
      priority: 'normal'
    },
    processing: {
      message: `🔄 CrystosJewel: ${firstName}, votre commande ${numero_commande} est en préparation dans nos ateliers. Expédition prévue sous 24-48h ⏰`,
      priority: 'normal'
    },
    shipped: {
      message: `📦 CrystosJewel: ${firstName}, votre commande ${numero_commande} est expédiée ! ${tracking_number ? `Suivi: ${tracking_number}` : 'Numéro de suivi à venir.'} Livraison 2-3 jours 🚚`,
      priority: 'high'
    },
    delivered: {
      message: `🎉 CrystosJewel: ${firstName}, votre commande ${numero_commande} est livrée ! Nous espérons que vous adorez votre bijou. Merci ! ✨`,
      priority: 'high'
    },
    cancelled: {
      message: `❌ CrystosJewel: ${firstName}, votre commande ${numero_commande} a été annulée. Un remboursement sera effectué sous 3-5 jours. Support: ${process.env.SUPPORT_PHONE || 'via email'}`,
      priority: 'high'
    },
    refunded: {
      message: `💰 CrystosJewel: ${firstName}, le remboursement de votre commande ${numero_commande} a été traité. Vous devriez le recevoir sous 3-5 jours bancaires 🏦`,
      priority: 'normal'
    },
    returned: {
      message: `📋 CrystosJewel: ${firstName}, nous avons reçu le retour de votre commande ${numero_commande}. Traitement en cours, remboursement sous 3-5 jours 🔄`,
      priority: 'normal'
    }
  };

  return messages[status] || {
    message: `📱 CrystosJewel: ${firstName}, votre commande ${numero_commande} a été mise à jour (statut: ${status}).`,
    priority: 'normal'
  };
};

/**
 * Envoyer un SMS de changement de statut
 */
export const sendStatusChangeSMS = async (phoneNumber, orderData, statusChangeData) => {
  try {
    // Vérifier la configuration Twilio
    if (!client) {
      console.log('⚠️ SMS non envoyé: Configuration Twilio manquante');
      return { success: false, error: 'Configuration Twilio manquante' };
    }

    const { newStatus, oldStatus } = statusChangeData;
    
    // Ne pas envoyer si le statut n'a pas changé
    if (oldStatus === newStatus) {
      console.log('⏭️ SMS non envoyé: Statut identique');
      return { success: true, message: 'Statut identique, SMS non nécessaire' };
    }

    // Formater le numéro de téléphone
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      console.log('⚠️ SMS non envoyé: Numéro de téléphone invalide');
      return { success: false, error: 'Numéro de téléphone invalide' };
    }

    // Obtenir le message selon le statut
    const smsData = getSMSMessageByStatus(newStatus, orderData);
    
    console.log(`📱 Envoi SMS pour commande ${orderData.numero_commande}:`, {
      to: formattedPhone,
      status: `${oldStatus} → ${newStatus}`,
      priority: smsData.priority
    });

    // Envoyer le SMS via Twilio
    const message = await client.messages.create({
      body: smsData.message,
      from: twilioPhoneNumber,
      to: formattedPhone,
      // Priorité optionnelle (dépend du plan Twilio)
      ...(smsData.priority === 'high' && { priority: 'high' })
    });

    console.log(`✅ SMS envoyé avec succès:`, {
      sid: message.sid,
      to: formattedPhone,
      status: message.status
    });

    return {
      success: true,
      messageId: message.sid,
      status: message.status,
      to: formattedPhone
    };

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du SMS:', error);
    
    // Gérer les erreurs spécifiques Twilio
    if (error.code) {
      const errorMessages = {
        21211: 'Numéro de téléphone invalide',
        21614: 'Numéro de téléphone non valide pour SMS',
        21408: 'Autorisation d\'envoyer des SMS non accordée pour cette région',
        20003: 'Authentification Twilio échouée'
      };
      
      const friendlyError = errorMessages[error.code] || `Erreur Twilio: ${error.message}`;
      return { success: false, error: friendlyError, code: error.code };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Envoyer un SMS de confirmation de commande
 */
export const sendOrderConfirmationSMS = async (phoneNumber, orderData) => {
  try {
    if (!client) {
      console.log('⚠️ SMS confirmation non envoyé: Configuration Twilio manquante');
      return { success: false, error: 'Configuration Twilio manquante' };
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return { success: false, error: 'Numéro de téléphone invalide' };
    }

    const { numero_commande, total, customer_name } = orderData;
    const firstName = customer_name?.split(' ')[0] || 'Client';

    const message = `🎉 CrystosJewel: Merci ${firstName} ! Votre commande ${numero_commande} (${total?.toFixed(2)}€) est confirmée. Vous recevrez un email de confirmation 📧✨`;

    const sms = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: formattedPhone
    });

    console.log(`✅ SMS confirmation envoyé: ${sms.sid}`);
    return { success: true, messageId: sms.sid };

  } catch (error) {
    console.error('❌ Erreur SMS confirmation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Vérifier la configuration SMS
 */
export const checkSMSConfiguration = () => {
  const isConfigured = !!(accountSid && authToken && twilioPhoneNumber);
  
  return {
    isConfigured,
    accountSid: accountSid ? `${accountSid.substring(0, 8)}...` : 'Non configuré',
    phoneNumber: twilioPhoneNumber || 'Non configuré'
  };
};

/**
 * Test d'envoi SMS (pour debug)
 */
export const sendTestSMS = async (phoneNumber, testMessage = 'Test SMS CrystosJewel 📱') => {
  try {
    if (!client) {
      return { success: false, error: 'Configuration Twilio manquante' };
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return { success: false, error: 'Numéro de téléphone invalide' };
    }

    const message = await client.messages.create({
      body: testMessage,
      from: twilioPhoneNumber,
      to: formattedPhone
    });

    return { success: true, messageId: message.sid, status: message.status };

  } catch (error) {
    console.error('❌ Erreur test SMS:', error);
    return { success: false, error: error.message };
  }
};