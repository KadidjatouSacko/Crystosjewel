// controllers/guestOrderController.js

import { Order } from '../models/orderModel.js';
import { OrderItem } from '../models/orderItem.js';
import { Customer } from '../models/customerModel.js';
import { Jewel } from '../models/jewelModel.js';
import { Cart } from '../models/cartModel.js';
import { sequelize } from '../models/sequelize-client.js';
import { cartController } from '../controlleurs/cartControlleur.js';
import crypto from 'crypto';

export const guestOrderController = {

  /**
   * 📋 Afficher le récapitulatif de commande (connecté ou invité)
   */
  async renderOrderSummary(req, res) {
    try {
      console.log('📋 Affichage récapitulatif commande');

      // Récupérer le panier selon le type d'utilisateur
      const cartDetails = await cartController.getCartDetails(req);
      
      if (!cartDetails.items || cartDetails.items.length === 0) {
        req.session.flashMessage = {
          type: 'warning',
          message: 'Votre panier est vide.'
        };
        return res.redirect('/panier');
      }

      // Calculer les totaux avec codes promo
      const appliedPromo = req.session.appliedPromo || null;
      let discount = 0;
      let discountedSubtotal = cartDetails.totalPrice;

      if (appliedPromo && appliedPromo.discountPercent) {
        const discountPercent = parseFloat(appliedPromo.discountPercent);
        discount = (cartDetails.totalPrice * discountPercent) / 100;
        discountedSubtotal = cartDetails.totalPrice - discount;
      }

      // Frais de livraison
      const shippingThreshold = 50;
      const baseDeliveryFee = 5.90;
      const deliveryFee = discountedSubtotal >= shippingThreshold ? 0 : baseDeliveryFee;
      const finalTotal = discountedSubtotal + deliveryFee;

      // Préparer les items avec totaux
      const cartItems = cartDetails.items.map(item => ({
        ...item,
        itemTotal: item.jewel.price_ttc * item.quantity
      }));

      console.log(`💰 Totaux calculés:
        - Sous-total: ${cartDetails.totalPrice.toFixed(2)}€
        - Réduction: -${discount.toFixed(2)}€
        - Après réduction: ${discountedSubtotal.toFixed(2)}€
        - Livraison: ${deliveryFee.toFixed(2)}€
        - Total final: ${finalTotal.toFixed(2)}€`);

      res.render('summary', {
        title: 'Récapitulatif de commande',
        cartItems,
        subtotal: cartDetails.totalPrice,
        discount,
        discountedSubtotal,
        deliveryFee,
        finalTotal,
        appliedPromo: appliedPromo ? {
          code: appliedPromo.code,
          discountPercent: parseFloat(appliedPromo.discountPercent)
        } : null,
        user: req.session.user || null,
        isGuest: !req.session.user && !req.session.customerId
      });

    } catch (error) {
      console.error('❌ Erreur récapitulatif commande:', error);
      res.status(500).render('error', {
        title: 'Erreur',
        message: 'Erreur lors de l\'affichage du récapitulatif'
      });
    }
  },

  /**
   * 💾 Sauvegarder les informations client (connecté ou invité)
   */
  async saveCustomerInfo(req, res) {
    try {
      console.log('💾 Sauvegarde informations client');
      
      const { firstName, lastName, email, phone, address, deliveryMode, notes } = req.body;
      
      // Validation des données
      if (!firstName || !lastName || !email || !phone || !address) {
        return res.status(400).json({
          success: false,
          message: 'Tous les champs obligatoires doivent être remplis'
        });
      }

      // Validation email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Format d\'email invalide'
        });
      }

      // Sauvegarder en session pour les invités ou utilisateurs connectés
      req.session.customerInfo = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        deliveryMode: deliveryMode || 'standard',
        notes: notes?.trim() || ''
      };

      console.log('✅ Informations client sauvegardées en session');

      res.json({
        success: true,
        message: 'Informations sauvegardées avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur sauvegarde infos client:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sauvegarde'
      });
    }
  },

  /**
   * 🛒 Valider et créer la commande (connecté ou invité)
   */
async validateOrder(req, res) {
  let transaction;
  
  try {
    console.log('🛒 === DÉBUT VALIDATION COMMANDE COMPLÈTE ===');
    
    // Démarrer la transaction
    transaction = await sequelize.transaction();
    
    const { paymentMethod, customerInfo } = req.body;
    const userId = req.session?.user?.id || req.session?.customerId;
    const isGuest = !userId;

    console.log('👤 Type utilisateur:', isGuest ? 'Invité' : 'Connecté', `(ID: ${userId || 'N/A'})`);

    // ========================================
    // 🔍 ÉTAPE 1: RÉCUPÉRER LES INFORMATIONS CLIENT
    // ========================================
    let finalCustomerInfo;
    
    if (isGuest) {
      // Invité - utiliser les données du formulaire ou de la session
      finalCustomerInfo = customerInfo || req.session.customerInfo;
      
      if (!finalCustomerInfo) {
        throw new Error('Informations client manquantes pour l\'invité');
      }
      
      console.log('👥 Client invité:', finalCustomerInfo.email);
    } else {
      // Utilisateur connecté - récupérer depuis la BDD
      const customer = await Customer.findByPk(userId, { transaction });
      if (!customer) {
        throw new Error('Client connecté non trouvé');
      }
      
      finalCustomerInfo = {
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        address: customerInfo?.address || customer.address,
        deliveryMode: customerInfo?.deliveryMode || 'standard',
        notes: customerInfo?.notes || ''
      };
      
      console.log('👤 Client connecté:', customer.email);
    }

    // ========================================
    // 🛒 ÉTAPE 2: RÉCUPÉRER LE PANIER AVEC TAILLES
    // ========================================
    console.log('🛒 Récupération du panier...');
    const cartDetails = await cartController.getCartDetails(req);
    
    if (!cartDetails.items || cartDetails.items.length === 0) {
      throw new Error('Panier vide');
    }

    console.log(`📦 Panier: ${cartDetails.items.length} articles, Total: ${cartDetails.totalPrice.toFixed(2)}€`);
    
    // Log des tailles pour debug
    cartDetails.items.forEach(item => {
      console.log(`   - ${item.jewel.name}: Qté ${item.quantity}, Taille: ${item.size || 'Non spécifiée'}, Prix: ${item.jewel.price_ttc}€`);
    });

    // ========================================
    // 💰 ÉTAPE 3: CALCULER LES TOTAUX AVEC CODES PROMO
    // ========================================
    const appliedPromo = req.session.appliedPromo;
    let discount = 0;
    let discountedSubtotal = cartDetails.totalPrice;
    let discountPercent = 0;

    if (appliedPromo && appliedPromo.discountPercent) {
      discountPercent = parseFloat(appliedPromo.discountPercent);
      discount = (cartDetails.totalPrice * discountPercent) / 100;
      discountedSubtotal = cartDetails.totalPrice - discount;
      
      console.log(`🎫 Code promo appliqué: ${appliedPromo.code} (-${discountPercent}% = -${discount.toFixed(2)}€)`);
    }

    // Calculer frais de livraison
    const shippingThreshold = 50;
    const baseDeliveryFee = 5.90;
    const deliveryFee = discountedSubtotal >= shippingThreshold ? 0 : baseDeliveryFee;
    const finalTotal = discountedSubtotal + deliveryFee;

    console.log(`💰 Totaux finaux:
      - Sous-total: ${cartDetails.totalPrice.toFixed(2)}€
      - Réduction: -${discount.toFixed(2)}€
      - Après réduction: ${discountedSubtotal.toFixed(2)}€
      - Livraison: ${deliveryFee.toFixed(2)}€
      - TOTAL FINAL: ${finalTotal.toFixed(2)}€`);

    // ========================================
    // 🔍 ÉTAPE 4: VÉRIFIER LE STOCK
    // ========================================
    console.log('📦 Vérification du stock...');
    for (const item of cartDetails.items) {
      const currentJewel = await Jewel.findByPk(item.jewel.id, { transaction });
      if (!currentJewel || currentJewel.stock < item.quantity) {
        throw new Error(`Stock insuffisant pour ${item.jewel.name}. Stock disponible: ${currentJewel?.stock || 0}`);
      }
    }
    console.log('✅ Stock vérifié pour tous les articles');

    // ========================================
    // 👤 ÉTAPE 5: GÉRER LE CLIENT (CONNECTÉ OU INVITÉ)
    // ========================================
    let customerId = userId;
    
    if (isGuest) {
      console.log('👥 Gestion client invité...');
      
      // Chercher d'abord par email
      let existingCustomer = await Customer.findOne({
        where: { email: finalCustomerInfo.email },
        transaction
      });

      if (existingCustomer) {
        // Client existant - mettre à jour l'adresse si nécessaire
        if (existingCustomer.address !== finalCustomerInfo.address) {
          await existingCustomer.update({
            address: finalCustomerInfo.address,
            updated_at: new Date()
          }, { transaction });
          console.log('👤 Client existant mis à jour:', existingCustomer.id);
        } else {
          console.log('👤 Client existant trouvé:', existingCustomer.id);
        }
        customerId = existingCustomer.id;
      } else {
        // Créer un nouveau client invité
        const newCustomer = await Customer.create({
          first_name: finalCustomerInfo.firstName,
          last_name: finalCustomerInfo.lastName,
          email: finalCustomerInfo.email,
          phone: finalCustomerInfo.phone || '',
          address: finalCustomerInfo.address,
          password: '$2b$10$guestpassword.dummy.hash.for.guest.accounts',
          role_id: 2,
          is_guest: true,
          email_verified: false,
          is_email_verified: false,
          is_email_verified_new: false,
          email_notifications: true,
          marketing_opt_in: false,
          total_orders: 0,
          total_spent: '0.00',
          preferred_delivery_mode: 'standard',
          createdat: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }, { transaction });
        
        customerId = newCustomer.id;
        console.log('👥 Nouveau client invité créé:', customerId);
      }
    }

    // ========================================
    // 📋 ÉTAPE 6: CRÉER LA COMMANDE
    // ========================================
    console.log('📋 Création de la commande...');
    
    // Générer numéro de commande unique
    const orderNumber = 'CMD-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const orderData = {
      // Informations client
      customer_id: customerId,
      customer_email: finalCustomerInfo.email,
      customer_name: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
      customer_phone: finalCustomerInfo.phone || '',
      
      // Numéro de commande
      numero_commande: orderNumber,
      
      // Totaux financiers
      subtotal: cartDetails.totalPrice,
      original_total: cartDetails.totalPrice,
      original_amount: cartDetails.totalPrice,
      total: finalTotal,
      
      // Livraison
      shipping_price: deliveryFee,
      delivery_fee: deliveryFee,
      shipping_address: finalCustomerInfo.address,
      delivery_address: finalCustomerInfo.address,
      shipping_phone: finalCustomerInfo.phone || '',
      delivery_mode: finalCustomerInfo.deliveryMode || 'standard',
      delivery_notes: finalCustomerInfo.notes || '',
      
      // Taxes
      tax_amount: 0,
      
      // Code promo
      promo_code: appliedPromo?.code || null,
      promo_code_used: appliedPromo?.code || null,
      promo_discount_percent: discountPercent,
      promo_discount_amount: discount,
      discount_percent: discountPercent,
      discount_amount: discount,
      promo_discount: discount,
      
      // Paiement
      payment_method: paymentMethod || 'card',
      payment_status: 'pending',
      
      // Statut
      status: 'confirmed',
      
      // Invité
      is_guest_order: isGuest,
      guest_session_id: req.session.guestId || null,
      
      // Emails
      email_confirmation_sent: false,
      email_shipping_sent: false,
      
      // Timestamps
      order_date: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    const order = await Order.create(orderData, { transaction });
    console.log('✅ Commande créée avec ID:', order.id);

    // ========================================
    // 📦 ÉTAPE 7: CRÉER LES ARTICLES DE COMMANDE AVEC TAILLES
    // ========================================
    console.log('📦 Création des articles de commande avec tailles...');
    
    for (const item of cartDetails.items) {
      console.log(`   📦 Article: ${item.jewel.name}, Taille: ${item.size || 'Standard'}, Prix: ${item.jewel.price_ttc}€`);
      
      // Vérification du prix
      if (!item.jewel.price_ttc || item.jewel.price_ttc <= 0) {
        console.warn(`⚠️ Prix invalide pour ${item.jewel.name}: ${item.jewel.price_ttc}`);
        const currentJewel = await Jewel.findByPk(item.jewel.id, { transaction });
        item.jewel.price_ttc = currentJewel.price_ttc;
      }

     await OrderItem.create({
  order_id: order.id,
  jewel_id: item.jewel.id,
  quantity: item.quantity,
  price: parseFloat(item.jewel.price_ttc)
  // ✅ Seulement les colonnes qui existent
}, { transaction });

      // Décrémenter le stock
      await Jewel.decrement('stock', {
        by: item.quantity,
        where: { id: item.jewel.id },
        transaction
      });
    }

    console.log('✅ Tous les articles créés avec leurs tailles');

    // ========================================
    // 💾 ÉTAPE 8: VALIDER LA TRANSACTION
    // ========================================
    await transaction.commit();
    transaction = null; // Marquer comme terminée
    
    console.log('✅ Transaction validée avec succès');

    // ========================================
    // 📧 ÉTAPE 9: ENVOI DES EMAILS
    // ========================================
    console.log('📧 Préparation et envoi des emails...');
    
    try {
      // Préparer les données pour l'email avec TOUTES les informations
      const emailOrderData = {
        id: order.id,
        numero_commande: orderNumber,
        customer_name: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
        customer_email: finalCustomerInfo.email,
        shipping_address: finalCustomerInfo.address,
        shipping_phone: finalCustomerInfo.phone || '',
        
        // Totaux financiers
        subtotal: cartDetails.totalPrice,
        total: finalTotal,
        shipping_price: deliveryFee,
        
        // Code promo
        promo_code: appliedPromo?.code || null,
        promo_discount_amount: discount,
        promo_discount_percent: discountPercent,
        
        // Articles AVEC tailles
        items: cartDetails.items.map(item => ({
          name: item.jewel.name,
          quantity: item.quantity,
          price: item.jewel.price_ttc,
          size: item.size || 'Standard',
          total: item.jewel.price_ttc * item.quantity,
          image: item.jewel.image
        }))
      };

      const emailCustomerData = {
        firstName: finalCustomerInfo.firstName,
        lastName: finalCustomerInfo.lastName,
        email: finalCustomerInfo.email,
        phone: finalCustomerInfo.phone,
        address: finalCustomerInfo.address
      };

      // Importer et envoyer les emails
      const { sendOrderConfirmationEmails } = await import('../services/mailService.js');
      
      const emailResults = await sendOrderConfirmationEmails(
        finalCustomerInfo.email,
        finalCustomerInfo.firstName,
        emailOrderData,
        emailCustomerData
      );
      
      console.log('📧 Résultats envoi emails:', {
        client: emailResults.customer.success ? '✅ Envoyé' : `❌ ${emailResults.customer.error}`,
        admin: emailResults.admin.success ? '✅ Envoyé' : `❌ ${emailResults.admin.error}`
      });
      
    } catch (emailError) {
      console.error('❌ Erreur envoi emails (commande créée avec succès):', emailError);
    }

    // ========================================
    // 🧹 ÉTAPE 10: NETTOYAGE DU PANIER ET SESSION
    // ========================================
    console.log('🧹 Nettoyage du panier et session...');
    
    if (isGuest) {
      req.session.cart = { items: [] };
    } else {
      await Cart.destroy({
        where: { customer_id: userId }
      });
    }

    delete req.session.customerInfo;
    delete req.session.appliedPromo;

    console.log('✅ Panier et session nettoyés');

    // ========================================
    // 🎉 ÉTAPE 11: RÉPONSE FINALE
    // ========================================
    console.log('🎉 === COMMANDE VALIDÉE AVEC SUCCÈS ===');
    console.log(`   📋 Numéro: ${orderNumber}`);
    console.log(`   💰 Total: ${finalTotal.toFixed(2)}€`);
    console.log(`   👤 Client: ${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`);
    console.log(`   📧 Email: ${finalCustomerInfo.email}`);
    console.log(`   📦 Articles: ${cartDetails.items.length}`);
    if (appliedPromo) {
      console.log(`   🎫 Promo: ${appliedPromo.code} (-${discount.toFixed(2)}€)`);
    }
    console.log('==========================================');

    res.json({
      success: true,
      message: appliedPromo 
        ? `Commande créée avec succès ! Code promo ${appliedPromo.code} appliqué (-${discount.toFixed(2)}€). Un email de confirmation vous a été envoyé.`
        : 'Commande créée avec succès ! Un email de confirmation vous a été envoyé.',
      order: {
        id: order.id,
        numero: orderNumber,
        customer_email: finalCustomerInfo.email,
        total: finalTotal,
        isGuest: isGuest,
        itemsCount: cartDetails.items.length,
        hasPromo: !!appliedPromo
      },
      redirectUrl: `/commande/confirmation?orderId=${order.id}&orderNumber=${orderNumber}`
    });

  } catch (error) {
    // ========================================
    // ❌ GESTION D'ERREUR AVEC ROLLBACK
    // ========================================
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
        console.log('🔄 Transaction annulée suite à l\'erreur');
      } catch (rollbackError) {
        console.error('❌ Erreur lors du rollback:', rollbackError);
      }
    }
    
    console.error('❌ Erreur validation commande:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la création de la commande',
      debug: process.env.NODE_ENV === 'development' ? {
        error: error.message,
        stack: error.stack
      } : undefined
    });
  }
},


  /**
   * 📧 Envoyer l'email de confirmation (optionnel)
   */
  async sendOrderConfirmation(orderData) {
    try {
      console.log('📧 Envoi email de confirmation pour:', orderData.numero);
      
      // TODO: Implémenter l'envoi d'email
      // const emailService = await import('../services/emailService.js');
      // await emailService.sendOrderConfirmation(orderData);
      
      console.log('✅ Email de confirmation envoyé');
      
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      // Ne pas faire échouer la commande pour un problème d'email
    }
  },

  /**
   * 🔄 Convertir un invité en client enregistré (optionnel)
   */
  async convertGuestToCustomer(req, res) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email et mot de passe requis'
        });
      }

      // Chercher le client invité
      const guestCustomer = await Customer.findOne({
        where: { 
          email: email.toLowerCase(),
          isGuest: true 
        }
      });

      if (!guestCustomer) {
        return res.status(404).json({
          success: false,
          message: 'Aucun compte invité trouvé avec cet email'
        });
      }

      // Hasher le mot de passe
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Convertir en compte normal
      await guestCustomer.update({
        password: hashedPassword,
        isGuest: false,
        isEmailVerified: true,
        updated_at: new Date()
      });

      console.log(`🔄 Invité converti en client: ${email}`);

      res.json({
        success: true,
        message: 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.'
      });

    } catch (error) {
      console.error('❌ Erreur conversion invité:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du compte'
      });
    }
  },

  // Ajouter ces méthodes manquantes dans guestOrderController.js

/**
 * 📝 Afficher le formulaire informations client (connecté ou invité)
 */
async renderCustomerForm(req, res) {
  try {
    console.log('📝 Formulaire informations client');
    
    const userId = req.session?.user?.id || req.session?.customerId;
    const isGuest = !userId;
    
    // Vérifier le panier
    const cartDetails = await cartController.getCartDetails(req);
    
    if (!cartDetails.items || cartDetails.items.length === 0) {
      req.session.flashMessage = {
        type: 'warning',
        message: 'Votre panier est vide. Ajoutez des articles avant de continuer.'
      };
      return res.redirect('/panier');
    }

    // Pré-remplir les informations si utilisateur connecté
    let customerInfo = {};
    
    if (!isGuest) {
      try {
        const customer = await Customer.findByPk(userId);
        if (customer) {
          customerInfo = {
            firstName: customer.first_name || '',
            lastName: customer.last_name || '',
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.address || ''
          };
        }
      } catch (error) {
        console.log('⚠️ Erreur récupération client:', error.message);
      }
    }

    // Utiliser les données de session si disponibles
    if (req.session.customerInfo) {
      customerInfo = { ...customerInfo, ...req.session.customerInfo };
    }

    res.render('customer-form', {
      title: 'Informations de livraison',
      customerInfo,
      user: req.session.user || null,
      isGuest,
      cartItemCount: cartDetails.items.length
    });

  } catch (error) {
    console.error('❌ Erreur formulaire client:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      message: 'Erreur lors du chargement du formulaire',
      statusCode: 500
    });
  }
},

/**
 * 💾 Sauvegarder les informations client
 */
async saveCustomerInfo(req, res) {
  try {
    console.log('💾 Sauvegarde informations client');
    
    const { firstName, lastName, email, phone, address, city, postalCode } = req.body;
    
    // Validation des champs obligatoires
    const requiredFields = { firstName, lastName, email, address };
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value || value.trim() === '')
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Champs requis manquants: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Adresse email invalide'
      });
    }

    // Sauvegarder en session
    const customerInfo = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      address: address.trim(),
      city: city ? city.trim() : '',
      postalCode: postalCode ? postalCode.trim() : ''
    };

    req.session.customerInfo = customerInfo;

    console.log('✅ Informations client sauvegardées:', {
      email: customerInfo.email,
      name: `${customerInfo.firstName} ${customerInfo.lastName}`
    });

    res.json({ 
      success: true, 
      message: 'Informations sauvegardées',
      redirectUrl: '/commande/recapitulatif'
    });

  } catch (error) {
    console.error('❌ Erreur sauvegarde infos client:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la sauvegarde' 
    });
  }
},

/**
 * 💳 Afficher la page de paiement
 */
async renderPaymentPage(req, res) {
  try {
    console.log('💳 Page de paiement');

    // Vérifier les informations client
    if (!req.session.customerInfo) {
      return res.redirect('/commande/informations');
    }

    // Récupérer le panier
    const cartDetails = await cartController.getCartDetails(req);
    
    if (!cartDetails.items || cartDetails.items.length === 0) {
      return res.redirect('/panier');
    }

    // Calculer les totaux
    const appliedPromo = req.session.appliedPromo || null;
    let discount = 0;
    let discountedSubtotal = cartDetails.totalPrice;

    if (appliedPromo && appliedPromo.discountPercent) {
      const discountPercent = parseFloat(appliedPromo.discountPercent);
      discount = (cartDetails.totalPrice * discountPercent) / 100;
      discountedSubtotal = cartDetails.totalPrice - discount;
    }

    const shippingThreshold = 50;
    const baseDeliveryFee = 5.90;
    const deliveryFee = discountedSubtotal >= shippingThreshold ? 0 : baseDeliveryFee;
    const finalTotal = discountedSubtotal + deliveryFee;

    res.render('payment', {
      title: 'Paiement',
      customerInfo: req.session.customerInfo,
      cartItems: cartDetails.items,
      subtotal: cartDetails.totalPrice,
      discount,
      discountedSubtotal,
      deliveryFee,
      finalTotal,
      appliedPromo,
      user: req.session.user || null,
      itemsCount: cartDetails.items.length
    });

  } catch (error) {
    console.error('❌ Erreur page paiement:', error);
    res.status(500).send('Erreur serveur');
  }
},

/**
 * ✅ Afficher la confirmation de commande
 */
async renderConfirmation(req, res) {
  try {
    const { orderId, orderNumber } = req.query;
    
    if (!orderId && !orderNumber) {
      return res.redirect('/');
    }

    let whereClause = {};
    if (orderId) {
      whereClause.id = orderId;
    } else {
      whereClause.order_number = orderNumber;
    }

    const order = await Order.findOne({
      where: whereClause,
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Jewel,
              as: 'jewel',
              attributes: ['name', 'image', 'price_ttc']
            }
          ]
        }
      ]
    });

    if (!order) {
      return res.status(404).render('error', {
        title: 'Commande non trouvée',
        message: 'Cette commande n\'existe pas.',
        statusCode: 404
      });
    }

    // Nettoyer la session après commande réussie
    delete req.session.cart;
    delete req.session.customerInfo;
    delete req.session.appliedPromo;

    res.render('order-confirmation', {
      order: order,
      user: req.session.user,
      title: 'Confirmation de commande'
    });

  } catch (error) {
    console.error('❌ Erreur confirmation commande:', error);
    res.status(500).send('Erreur serveur');
  }
},

/**
 * 🔄 Convertir un invité en client enregistré
 */
async convertGuestToCustomer(req, res) {
  try {
    const { password, confirmPassword } = req.body;
    
    if (!req.session.customerInfo) {
      return res.status(400).json({
        success: false,
        message: 'Aucune information client en session'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Les mots de passe ne correspondent pas'
      });
    }

    const customerInfo = req.session.customerInfo;

    // Vérifier si l'email existe déjà
    const existingCustomer = await Customer.findOne({
      where: { email: customerInfo.email }
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Un compte existe déjà avec cette adresse email'
      });
    }

    // Créer le compte
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    const newCustomer = await Customer.create({
      first_name: customerInfo.firstName,
      last_name: customerInfo.lastName,
      email: customerInfo.email,
      phone: customerInfo.phone,
      address: customerInfo.address,
      password: hashedPassword,
      email_verified: false
    });

    // Connecter automatiquement
    req.session.user = {
      id: newCustomer.id,
      email: newCustomer.email,
      first_name: newCustomer.first_name,
      last_name: newCustomer.last_name
    };

    console.log('✅ Invité converti en client:', newCustomer.email);

    res.json({
      success: true,
      message: 'Compte créé avec succès',
      redirectUrl: '/commande/recapitulatif'
    });

  } catch (error) {
    console.error('❌ Erreur conversion invité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte'
    });
  }
}
};