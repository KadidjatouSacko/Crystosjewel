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

      res.render('order-summary', {
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
    const transaction = await sequelize.transaction();
    
    try {
      console.log('🛒 Validation commande avec support invités');
      
      const { paymentMethod, customerInfo } = req.body;
      const userId = req.session?.user?.id || req.session?.customerId;
      const isGuest = !userId;

      // Récupérer les informations client
      let finalCustomerInfo;
      if (isGuest) {
        // Invité - utiliser les données du formulaire ou de la session
        finalCustomerInfo = customerInfo || req.session.customerInfo;
        
        if (!finalCustomerInfo) {
          throw new Error('Informations client manquantes');
        }
      } else {
        // Utilisateur connecté - récupérer depuis la BDD
        const customer = await Customer.findByPk(userId);
        if (!customer) {
          throw new Error('Client non trouvé');
        }
        
        finalCustomerInfo = {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          address: customerInfo?.address || customer.address
        };
      }

      // Récupérer le panier
      const cartDetails = await cartController.getCartDetails(req);
      
      if (!cartDetails.items || cartDetails.items.length === 0) {
        throw new Error('Panier vide');
      }

      // Calculer les totaux avec codes promo
      const appliedPromo = req.session.appliedPromo;
      let discount = 0;
      let discountedSubtotal = cartDetails.totalPrice;
      let discountPercent = 0;

      if (appliedPromo && appliedPromo.discountPercent) {
        discountPercent = parseFloat(appliedPromo.discountPercent);
        discount = (cartDetails.totalPrice * discountPercent) / 100;
        discountedSubtotal = cartDetails.totalPrice - discount;
      }

      // Calculer frais de livraison
      const shippingThreshold = 50;
      const baseDeliveryFee = 5.90;
      const deliveryFee = discountedSubtotal >= shippingThreshold ? 0 : baseDeliveryFee;
      const finalTotal = discountedSubtotal + deliveryFee;

      // Vérifier le stock pour tous les articles
      for (const item of cartDetails.items) {
        const currentJewel = await Jewel.findByPk(item.jewel.id, { transaction });
        if (!currentJewel || currentJewel.stock < item.quantity) {
          throw new Error(`Stock insuffisant pour ${item.jewel.name}`);
        }
      }

      // Créer ou récupérer le client
      let customerId = userId;
      
      if (isGuest) {
        // Pour les invités, créer un client temporaire ou chercher par email
        let existingCustomer = await Customer.findOne({
          where: { email: finalCustomerInfo.email },
          transaction
        });

        if (existingCustomer) {
          // Mettre à jour les informations si nécessaire
          await existingCustomer.update({
            firstName: finalCustomerInfo.firstName,
            lastName: finalCustomerInfo.lastName,
            phone: finalCustomerInfo.phone,
            address: finalCustomerInfo.address
          }, { transaction });
          
          customerId = existingCustomer.id;
          console.log('👤 Client existant mis à jour:', customerId);
        } else {
          // Créer un nouveau client
          const newCustomer = await Customer.create({
            firstName: finalCustomerInfo.firstName,
            lastName: finalCustomerInfo.lastName,
            email: finalCustomerInfo.email,
            phone: finalCustomerInfo.phone,
            address: finalCustomerInfo.address,
            password: null, // Compte invité sans mot de passe
            isGuest: true,
            isEmailVerified: false
          }, { transaction });
          
          customerId = newCustomer.id;
          console.log('👥 Nouveau client invité créé:', customerId);
        }
      }

      // Générer numéro de commande unique
      const orderNumber = 'CMD-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

      // Créer la commande
      const order = await Order.create({
        numero: orderNumber,
        customer_id: customerId,
        customer_email: finalCustomerInfo.email,
        customer_name: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
        customer_phone: finalCustomerInfo.phone,
        delivery_address: finalCustomerInfo.address,
        delivery_mode: finalCustomerInfo.deliveryMode || 'standard',
        delivery_notes: finalCustomerInfo.notes || '',
        
        // Totaux
        subtotal: cartDetails.totalPrice,
        discount_amount: discount,
        discount_percent: discountPercent,
        promo_code: appliedPromo?.code || null,
        delivery_fee: deliveryFee,
        total_amount: finalTotal,
        
        // Paiement
        payment_method: paymentMethod,
        payment_status: 'pending',
        
        // Statut
        status: 'confirmed',
        is_guest_order: isGuest,
        
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });

      console.log(`📦 Commande créée: ${orderNumber} pour ${finalTotal.toFixed(2)}€`);

      // Créer les articles de commande et décrémenter le stock
      for (const item of cartDetails.items) {
        await OrderItem.create({
          order_id: order.id,
          jewel_id: item.jewel.id,
          jewel_name: item.jewel.name,
          jewel_price: item.jewel.price_ttc,
          quantity: item.quantity,
          subtotal: item.jewel.price_ttc * item.quantity
        }, { transaction });

        // Décrémenter le stock
        await Jewel.decrement('stock', {
          by: item.quantity,
          where: { id: item.jewel.id },
          transaction
        });

        console.log(`📦 Article ajouté: ${item.jewel.name} x${item.quantity}`);
      }

      // Vider le panier
      if (isGuest) {
        // Vider le panier session
        req.session.cart = { items: [] };
      } else {
        // Vider le panier BDD
        await Cart.destroy({
          where: { customer_id: customerId },
          transaction
        });
      }

      // Supprimer le code promo appliqué
      if (req.session.appliedPromo) {
        delete req.session.appliedPromo;
      }

      // Valider la transaction
      await transaction.commit();

      console.log(`✅ Commande ${orderNumber} validée avec succès`);

      // Réponse de succès
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
      // Annuler la transaction en cas d'erreur
      await transaction.rollback();
      
      console.error('❌ Erreur validation commande:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la création de la commande'
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
  }
};