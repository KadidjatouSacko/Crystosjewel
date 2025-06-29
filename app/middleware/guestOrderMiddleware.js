// middleware/guestOrderMiddleware.js

/**
 * Middleware pour permettre aux invités de passer commande
 * Génère un ID de session temporaire pour les utilisateurs non connectés
 */

export const guestOrderMiddleware = (req, res, next) => {
  // Si l'utilisateur est connecté, continuer normalement
  if (req.session?.user?.id || req.session?.customerId) {
    console.log('👤 Utilisateur connecté détecté');
    return next();
  }

  // Pour les invités, générer un ID de session temporaire s'il n'existe pas
  if (!req.session.guestId) {
    req.session.guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('👥 Nouvel invité créé:', req.session.guestId);
  }

  // Initialiser le panier session si nécessaire
  if (!req.session.cart) {
    req.session.cart = { items: [] };
  }

  console.log('👥 Invité identifié:', req.session.guestId);
  next();
};

/**
 * Middleware pour vérifier qu'il y a des articles dans le panier
 */
export const cartNotEmptyMiddleware = async (req, res, next) => {
  try {
    const userId = req.session?.user?.id || req.session?.customerId;
    
    let hasItems = false;

    if (userId) {
      // Vérifier panier BDD
      const { sequelize } = await import('../models/sequelize-client.js');
      const { QueryTypes } = await import('sequelize');
      
      const result = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM cart 
        WHERE customer_id = :userId
      `, {
        replacements: { userId },
        type: QueryTypes.SELECT
      });
      
      hasItems = parseInt(result[0]?.count || 0) > 0;
    } else {
      // Vérifier panier session
      hasItems = req.session.cart && 
                 Array.isArray(req.session.cart.items) && 
                 req.session.cart.items.length > 0;
    }

    if (!hasItems) {
      console.log('🛒 Panier vide détecté, redirection');
      
      if (req.xhr || req.get('accept')?.includes('json')) {
        return res.status(400).json({
          success: false,
          message: 'Votre panier est vide',
          redirect: '/panier'
        });
      } else {
        req.session.flashMessage = {
          type: 'warning',
          message: 'Votre panier est vide. Ajoutez des articles avant de passer commande.'
        };
        return res.redirect('/panier');
      }
    }

    next();
  } catch (error) {
    console.error('❌ Erreur vérification panier:', error);
    next();
  }
};

/**
 * Middleware pour valider les données de commande invité
 */
export const validateGuestOrderMiddleware = (req, res, next) => {
  // Si utilisateur connecté, passer la validation
  if (req.session?.user?.id || req.session?.customerId) {
    return next();
  }

  // Pour les invités, vérifier les données requises
  const { customerInfo } = req.body;
  
  if (!customerInfo) {
    return res.status(400).json({
      success: false,
      message: 'Informations client manquantes'
    });
  }

  const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'address'];
  const missingFields = requiredFields.filter(field => !customerInfo[field]?.trim());

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Champs requis manquants: ${missingFields.join(', ')}`,
      missingFields
    });
  }

  // Validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerInfo.email)) {
    return res.status(400).json({
      success: false,
      message: 'Adresse email invalide'
    });
  }

  console.log('✅ Données invité validées');
  next();
};