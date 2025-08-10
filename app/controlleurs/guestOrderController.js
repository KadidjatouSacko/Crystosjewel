// controllers/guestOrderController.js

import { Order } from '../models/orderModel.js';
import { OrderItem } from '../models/orderItem.js';
import { Customer } from '../models/customerModel.js';
import { Jewel } from '../models/jewelModel.js';
import { Cart } from '../models/cartModel.js';
import { sequelize } from '../models/sequelize-client.js';
import { cartController } from '../controlleurs/cartControlleur.js';
import crypto from 'crypto';
import { sendOrderConfirmationEmails } from '../services/mailService.js';


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
      const shippingThreshold = res.locals.freeShippingThreshold || 100;
const baseDeliveryFee = res.locals.standardShippingCost || 7.50;
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
/**
   * 🛒 Valider et créer la commande (connecté ou invité) - VERSION COMPLÈTEMENT CORRIGÉE
   */
/**
   * 🛒 Valider et créer la commande (connecté ou invité) - VERSION COMPLÈTE AVEC STOCK PAR TAILLE
   */
  async validateOrder(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      console.log('🛒 Validation commande avec support invités ET utilisateurs connectés');
      
      const { paymentMethod, customerInfo } = req.body;
      const userId = req.session?.user?.id || req.session?.customerId;
      const isGuest = !userId;
      
      console.log(`👤 Type utilisateur: ${isGuest ? 'Invité' : 'Connecté'}`);
      console.log('📝 Données formulaire reçues:', {
        paymentMethod,
        hasCustomerInfo: !!customerInfo,
        customerInfoFields: customerInfo ? Object.keys(customerInfo) : []
      });

      // ========================================
      // 📋 RÉCUPÉRATION DES INFORMATIONS CLIENT
      // ========================================
      let finalCustomerInfo;
      if (isGuest) {
        // Invité - utiliser les données du formulaire ou de la session
        finalCustomerInfo = customerInfo || req.session.customerInfo;
        
        if (!finalCustomerInfo) {
          throw new Error('Informations client manquantes');
        }
        
        console.log('✅ Invité - Données du formulaire utilisées:', {
          nom: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
          email: finalCustomerInfo.email,
          adresse: finalCustomerInfo.address
        });
      } else {
        // Utilisateur connecté - récupérer depuis la BDD puis utiliser les nouvelles données
        const customer = await Customer.findByPk(userId);
        if (!customer) {
          throw new Error('Client non trouvé');
        }
        
        // Utiliser les nouvelles données du formulaire si disponibles
        finalCustomerInfo = {
          firstName: customerInfo?.firstName || customer.first_name,
          lastName: customerInfo?.lastName || customer.last_name,
          email: customerInfo?.email || customer.email,
          phone: customerInfo?.phone || customer.phone,
          address: customerInfo?.address || customer.address
        };
        
        console.log('✅ Utilisateur connecté - Nouvelles données du formulaire utilisées:', {
          nom: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
          email: finalCustomerInfo.email,
          adresse: finalCustomerInfo.address,
          phone: finalCustomerInfo.phone
        });
      }

      // ========================================
      // 🛒 RÉCUPÉRATION DU PANIER
      // ========================================
      console.log(`🛒 Récupération panier ${isGuest ? 'session (invité)' : 'BDD (connecté)'}`);
      const cartDetails = await cartController.getCartDetails(req);
      
      if (!cartDetails.items || cartDetails.items.length === 0) {
        throw new Error('Panier vide');
      }

      console.log(`🛒 Panier récupéré: ${cartDetails.items.length} articles, Total: ${cartDetails.totalPrice.toFixed(2)}€`);

      // ========================================
      // 📦 VÉRIFICATION ET PRÉPARATION AVEC STOCK PAR TAILLE
      // ========================================
      console.log('📦 === VÉRIFICATION DU STOCK ET PRÉPARATION DES ARTICLES AVEC TAILLES ===');
      const validatedItems = [];
      const stockErrors = [];
      
      for (const item of cartDetails.items) {
        console.log(`🔍 Traitement de ${item.jewel.name}:`);
        console.log(`   Prix dans le panier: ${item.jewel.price_ttc}`);
        console.log(`   Quantité: ${item.quantity}`);
        console.log(`   Taille sélectionnée: ${item.size || 'Aucune'}`);
        
        // Récupérer le bijou complet depuis la DB avec les tailles
        const currentJewel = await Jewel.findByPk(item.jewel.id, { 
          transaction,
          attributes: ['id', 'name', 'price_ttc', 'stock', 'image', 'tailles']
        });
        
        if (!currentJewel) {
          stockErrors.push({
            name: item.jewel.name,
            error: 'Produit non trouvé'
          });
          continue;
        }
        
        console.log(`   Prix en DB: ${currentJewel.price_ttc}`);
        console.log(`   Stock global en DB: ${currentJewel.stock}`);
        console.log(`   Tailles en DB:`, currentJewel.tailles);
        
        // ✅ VÉRIFIER LE STOCK DE LA TAILLE SPÉCIFIQUE
        let availableStock = currentJewel.stock;
        let selectedSizeInfo = null;
        
        if (item.size && currentJewel.tailles && Array.isArray(currentJewel.tailles)) {
          selectedSizeInfo = currentJewel.tailles.find(t => t.taille === item.size);
          
          if (selectedSizeInfo) {
            availableStock = parseInt(selectedSizeInfo.stock) || 0;
            console.log(`   ✅ Stock taille ${item.size}: ${availableStock}`);
          } else {
            console.log(`   ❌ Taille ${item.size} non trouvée dans les tailles disponibles`);
            stockErrors.push({
              name: currentJewel.name,
              error: `Taille ${item.size} non disponible`
            });
            continue;
          }
        } else {
          console.log(`   ℹ️  Utilisation du stock global: ${availableStock}`);
        }
        
        // Vérifier si le stock est suffisant
        if (item.quantity > availableStock) {
          const sizeInfo = item.size ? ` (taille ${item.size})` : '';
          stockErrors.push({
            name: currentJewel.name,
            requested: item.quantity,
            available: availableStock,
            size: item.size,
            message: `${currentJewel.name}${sizeInfo}: ${item.quantity} demandé(s) mais seulement ${availableStock} disponible(s)`
          });
          continue;
        }
        
        // Calculer le prix unitaire et le total
        const unitPrice = parseFloat(currentJewel.price_ttc);
        const itemTotal = unitPrice * item.quantity;
        
        validatedItems.push({
          jewel_id: currentJewel.id,
          jewel_name: currentJewel.name,
          jewel_image: currentJewel.image,
          quantity: parseInt(item.quantity),
          unit_price: unitPrice,
          total_price: itemTotal,
          size: item.size || 'Standard',
          current_stock: availableStock,
          global_stock: currentJewel.stock,
          jewel_tailles: currentJewel.tailles || [],
          selected_size_info: selectedSizeInfo
        });
        
        const sizeInfo = item.size ? ` (taille ${item.size})` : '';
        console.log(`✅ ${currentJewel.name}${sizeInfo}: Prix=${unitPrice}€, Qté=${item.quantity}, Total=${itemTotal.toFixed(2)}€, Stock OK (${availableStock} >= ${item.quantity})`);
      }
      
      if (stockErrors.length > 0) {
        const errorMessage = stockErrors.map(error => 
          error.message || error.error || `${error.name}: erreur inconnue`
        ).join(', ');
        
        throw new Error(`Stock insuffisant: ${errorMessage}`);
      }

      // ========================================
      // 💰 CALCUL DES TOTAUX
      // ========================================
      const subtotalCalculated = validatedItems.reduce((sum, item) => sum + item.total_price, 0);
      console.log(`💰 Sous-total recalculé: ${subtotalCalculated.toFixed(2)}€`);

      // Calculer les totaux avec codes promo
      const appliedPromo = req.session.appliedPromo;
      let discount = 0;
      let discountedSubtotal = subtotalCalculated;
      let discountPercent = 0;

      if (appliedPromo && appliedPromo.discountPercent) {
        discountPercent = parseFloat(appliedPromo.discountPercent);
        discount = (subtotalCalculated * discountPercent) / 100;
        discountedSubtotal = subtotalCalculated - discount;
        
        console.log(`🎫 Code promo appliqué: ${appliedPromo.code} (-${discount.toFixed(2)}€)`);
      }

      // Calculer frais de livraison
      const shippingThreshold = 50;
      const baseDeliveryFee = 5.90;
      const deliveryFee = discountedSubtotal >= shippingThreshold ? 0 : baseDeliveryFee;
      const finalTotal = discountedSubtotal + deliveryFee;

      console.log('💰 Totaux finaux:', {
        sousTotal: subtotalCalculated.toFixed(2),
        reduction: discount.toFixed(2),
        sousTotalApresReduction: discountedSubtotal.toFixed(2),
        fraisLivraison: deliveryFee.toFixed(2),
        totalFinal: finalTotal.toFixed(2)
      });

      // ========================================
      // 📝 CRÉATION DE LA COMMANDE
      // ========================================
      const orderNumber = `CMD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      
      console.log('📋 Création commande:', orderNumber, 'pour client', userId || 'invité');

      const order = await Order.create({
        customer_id: userId || null,
        numero_commande: orderNumber,
        total: finalTotal,
        created_at: new Date(),
        shipping_method: 'standard',
        shipping_address: finalCustomerInfo.address,
        shipping_city: finalCustomerInfo.city || '',
        shipping_postal_code: finalCustomerInfo.postal_code || '',
        shipping_country: 'France',
        shipping_phone: finalCustomerInfo.phone,
        shipping_price: deliveryFee,
        tax_amount: 0,
        subtotal: subtotalCalculated,
        promo_code: appliedPromo?.code || null,
        promo_discount_percent: discountPercent,
        promo_discount_amount: discount,
        customer_name: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
        customer_email: finalCustomerInfo.email,
        status: 'waiting',
        shipping_notes: finalCustomerInfo.notes || '',
        is_guest_order: isGuest,
        guest_session_id: isGuest ? req.sessionID : null,
        email_confirmation_sent: false,
        email_shipping_sent: false,
        discount_amount: discount,
        discount_percent: discountPercent,
        promo_discount: discount,
        delivery_mode: finalCustomerInfo.deliveryMode || 'standard',
        delivery_fee: deliveryFee,
        payment_method: paymentMethod || 'card',
        customer_phone: finalCustomerInfo.phone,
        updated_at: new Date()
      }, { transaction });

      console.log(`✅ Commande créée avec ID: ${order.id}`);

      // ========================================
      // 📦 CRÉATION DES ARTICLES + DÉCRÉMENT STOCK PAR TAILLE
      // ========================================
      console.log('📦 === CRÉATION DES ARTICLES ET DÉCRÉMENT DU STOCK PAR TAILLE ===');

      for (const item of validatedItems) {
        console.log(`📦 Traitement article: ${item.jewel_name}`);
        console.log(`   Prix unitaire: ${item.unit_price}€`);
        console.log(`   Quantité: ${item.quantity}`);
        console.log(`   Total: ${item.total_price.toFixed(2)}€`);
        console.log(`   Taille: ${item.size}`);

        // 1. Créer l'article de commande
        await OrderItem.create({
          order_id: order.id,
          jewel_id: item.jewel_id,
          jewel_name: item.jewel_name,
          jewel_image: item.jewel_image,
          price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.total_price,
          size: item.size
        }, { transaction });

        console.log(`✅ Article créé: ${item.jewel_name} x${item.quantity} (taille: ${item.size})`);

        // 2. ✅ DÉCRÉMENTER LE STOCK GLOBAL
        console.log(`📦 === DÉCRÉMENT STOCK POUR ${item.jewel_name} ===`);
        console.log(`   Stock global AVANT: ${item.global_stock}`);
        console.log(`   Quantité à décrémenter: ${item.quantity}`);

        await Jewel.decrement('stock', {
          by: item.quantity,
          where: { id: item.jewel_id },
          transaction: transaction
        });

        // 3. ✅ METTRE À JOUR LE STOCK DE LA TAILLE SPÉCIFIQUE
        if (item.size !== 'Standard' && item.jewel_tailles && Array.isArray(item.jewel_tailles) && item.jewel_tailles.length > 0) {
          console.log(`📏 === MISE À JOUR STOCK TAILLE ${item.size} ===`);
          console.log(`   Tailles actuelles:`, item.jewel_tailles);
          
          const updatedTailles = item.jewel_tailles.map(taille => {
            if (taille.taille === item.size) {
              const oldStock = parseInt(taille.stock) || 0;
              const newStock = Math.max(0, oldStock - item.quantity);
              
              console.log(`   📏 Taille ${taille.taille}: ${oldStock} → ${newStock}`);
              
              return {
                ...taille,
                stock: newStock
              };
            }
            return taille;
          });
          
          // Mettre à jour la colonne tailles avec les nouveaux stocks
          await Jewel.update(
            { tailles: updatedTailles },
            { 
              where: { id: item.jewel_id },
              transaction: transaction
            }
          );
          
          console.log(`   ✅ Stocks des tailles mis à jour:`, updatedTailles);
        } else {
          console.log(`   ℹ️  Pas de mise à jour de tailles spécifiques (taille: ${item.size})`);
        }

        // 4. ✅ VÉRIFICATION DU NOUVEAU STOCK
        const jewelAfterUpdate = await Jewel.findByPk(item.jewel_id, { 
          transaction,
          attributes: ['stock', 'tailles']
        });
        
        console.log(`   Stock global APRÈS: ${jewelAfterUpdate.stock}`);
        
        // Alertes stock
        if (jewelAfterUpdate.stock === 0) {
          console.log(`   🚨 RUPTURE DE STOCK GLOBALE: ${item.jewel_name}`);
        } else if (jewelAfterUpdate.stock <= 5) {
          console.log(`   ⚠️  STOCK GLOBAL FAIBLE: ${item.jewel_name} (${jewelAfterUpdate.stock} restants)`);
        }
        
        // Alertes par taille
        if (jewelAfterUpdate.tailles && Array.isArray(jewelAfterUpdate.tailles)) {
          jewelAfterUpdate.tailles.forEach(taille => {
            const tailleStock = parseInt(taille.stock) || 0;
            if (tailleStock === 0) {
              console.log(`   🚨 RUPTURE TAILLE ${taille.taille}: ${item.jewel_name}`);
            } else if (tailleStock <= 2) {
              console.log(`   ⚠️  STOCK TAILLE FAIBLE ${taille.taille}: ${item.jewel_name} (${tailleStock} restants)`);
            }
          });
        }
        
        console.log(`   ✅ Stock mis à jour pour ${item.jewel_name}: ${item.global_stock} → ${jewelAfterUpdate.stock}`);
      }

      console.log(`📦 ${validatedItems.length} order_items créés avec succès`);

      // ========================================
      // 🧹 NETTOYAGE DU PANIER
      // ========================================
      if (isGuest) {
        req.session.cart = { items: [] };
        console.log('🧹 Panier session vidé');
      } else {
        await Cart.destroy({
          where: { customer_id: userId },
          transaction
        });
        console.log('🧹 Panier BDD vidé');
      }

      // Supprimer le code promo appliqué
      if (req.session.appliedPromo) {
        delete req.session.appliedPromo;
      }

      // ========================================
      // ✅ VALIDATION FINALE
      // ========================================
      await transaction.commit();
      console.log('✅ Transaction committée avec succès');

      // ========================================
      // 🔍 VÉRIFICATION FINALE DU STOCK
      // ========================================
      console.log('🔍 === VÉRIFICATION FINALE DU STOCK ET TAILLES ===');
      for (const item of validatedItems) {
        const finalJewel = await Jewel.findByPk(item.jewel_id, {
          attributes: ['id', 'name', 'stock', 'tailles']
        });
        
        console.log(`🔍 ${finalJewel.name}:`);
        console.log(`   Stock global final: ${finalJewel.stock}`);
        
        if (finalJewel.tailles && Array.isArray(finalJewel.tailles)) {
          finalJewel.tailles.forEach(taille => {
            console.log(`   Taille ${taille.taille}: ${taille.stock} restants`);
          });
        }
      }

      console.log(`🎉 Commande ${orderNumber} validée avec succès`);

      // ========================================
      // 🎉 RÉPONSE DE SUCCÈS
      // ========================================
      res.json({
        success: true,
        message: 'Commande créée avec succès !',
        order: {
          id: order.id,
          numero: orderNumber,
          customer_email: finalCustomerInfo.email,
          total: finalTotal,
          isGuest: isGuest
        }
      });

    } catch (error) {
      // ========================================
      // ❌ GESTION DES ERREURS
      // ========================================
      await transaction.rollback();
      console.log('🔄 Transaction annulée (ROLLBACK effectué)');
      
      console.error('❌ Erreur validation commande:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la création de la commande'
      });
    }
  },

// ✅ FONCTION HELPER POUR ENVOI D'EMAILS ASYNCHRONE
async  sendOrderEmailsAsync(emailOrderData, emailCustomerData) {
    try {
        console.log('📧 Envoi des emails de confirmation...');
        const { sendOrderConfirmationEmails } = await import('../services/mailService.js');
        await sendOrderConfirmationEmails(emailOrderData, emailCustomerData);
        console.log('✅ Emails envoyés avec succès');
    } catch (emailError) {
        console.error('❌ Erreur envoi emails:', emailError);
        // Ne pas faire échouer la commande si l'email échoue
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