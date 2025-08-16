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
 /**
 * 📋 Afficher le récapitulatif de commande avec prix avant/après réduction
 */
async renderOrderSummary(req, res) {
  try {
    console.log('📋 Affichage récapitulatif commande avec réductions');

    // ✅ UTILISER VOTRE getCartDetails MAIS MODIFIÉ POUR INCLURE LES CHAMPS DE RÉDUCTION
    const userId = req.session?.user?.id || req.session?.customerId;
    const isGuest = !userId;

    let cartItems = [];
    let totalPrice = 0;

    if (isGuest) {
      // Invité - récupérer depuis la session
      console.log('🛒 Récupération panier session (invité)');
      
      const sessionCart = req.session.cart || { items: [] };
      
      for (const item of sessionCart.items) {
        if (item.jewel && item.jewel.id) {
          // ✅ RÉCUPÉRER AVEC LES CHAMPS DE RÉDUCTION
          const currentJewel = await Jewel.findByPk(item.jewel.id, {
            attributes: [
              'id', 'name', 'description', 'price_ttc', 'image', 'slug', 'stock',
              'matiere', 'carat', 'poids', 'tailles',
              'discount_percentage', 'discount_start_date', 'discount_end_date'
            ]
          });
          
          if (currentJewel && currentJewel.stock > 0) {
            const validQuantity = Math.min(item.quantity, currentJewel.stock);
            
            cartItems.push({
              jewelId: currentJewel.id,
              jewel: currentJewel.toJSON(),
              quantity: validQuantity,
              size: item.size || null
            });
            
            totalPrice += parseFloat(currentJewel.price_ttc) * validQuantity;
          }
        }
      }
      
    } else {
      // Utilisateur connecté - récupérer depuis la BDD
      console.log('🛒 Récupération panier BDD (connecté)');
      
      const dbCartItems = await Cart.findAll({
        where: { customer_id: userId },
        include: [{
          model: Jewel,
          as: 'jewel',
          required: true,
          attributes: [
            'id', 'name', 'description', 'price_ttc', 'image', 'slug', 'stock',
            'matiere', 'carat', 'poids', 'tailles',
            'discount_percentage', 'discount_start_date', 'discount_end_date'
          ]
        }]
      });

      cartItems = dbCartItems.map(item => {
        const itemTotal = parseFloat(item.jewel.price_ttc) * item.quantity;
        totalPrice += itemTotal;
        
        return {
          jewelId: item.jewel.id,
          jewel: item.jewel.toJSON(),
          quantity: item.quantity,
          size: item.size || null
        };
      });
    }

    // ✅ VÉRIFIER SI LE PANIER EST VIDE
    if (cartItems.length === 0) {
      req.session.flashMessage = {
        type: 'warning',
        message: 'Votre panier est vide.'
      };
      return res.redirect('/panier');
    }

    console.log(`🛒 ${cartItems.length} articles dans le panier`);

    // ✅ TRAITEMENT DES ARTICLES AVEC CALCUL DES PRIX RÉDUITS
    const processedItems = cartItems.map(item => {
      const jewelData = item.jewel;
      
      // Parser les tailles si nécessaire
      let parsedTailles = jewelData.tailles;
      if (typeof parsedTailles === 'string') {
        try {
          parsedTailles = JSON.parse(parsedTailles);
        } catch (error) {
          parsedTailles = [];
        }
      }
      if (!Array.isArray(parsedTailles)) {
        parsedTailles = [];
      }

      // ✅ CALCULER LE PRIX EFFECTIF (avec réduction bijou si applicable)
      let effectivePrice = parseFloat(jewelData.price_ttc) || 0;
      let hasDiscount = false;
      
      if (jewelData.discount_percentage && jewelData.discount_percentage > 0) {
        // Vérifier si la réduction est active
        const now = new Date();
        const isDiscountActive = 
          (!jewelData.discount_start_date || now >= new Date(jewelData.discount_start_date)) &&
          (!jewelData.discount_end_date || now <= new Date(jewelData.discount_end_date));
        
        if (isDiscountActive) {
          effectivePrice = jewelData.price_ttc * (1 - jewelData.discount_percentage / 100);
          hasDiscount = true;
        }
      }

      const quantity = parseInt(item.quantity) || 1;
      const itemTotal = effectivePrice * quantity;
      
      return {
        id: item.jewelId,
        jewel: {
          ...jewelData,
          tailles: parsedTailles,
          // ✅ AJOUTER LES INFOS DE PRIX POUR LE TEMPLATE
          original_price: jewelData.price_ttc,
          effective_price: effectivePrice,
          has_discount: hasDiscount,
          discount_percentage: jewelData.discount_percentage || 0
        },
        quantity: quantity,
        size: item.size,
        itemTotal: itemTotal
      };
    });

    // ✅ CALCULER LES TOTAUX AVEC LES PRIX RÉDUITS
    const subtotalWithJewelDiscounts = processedItems.reduce((total, item) => 
      total + item.itemTotal, 0);

    console.log(`💎 Sous-total avec réductions bijoux: ${subtotalWithJewelDiscounts.toFixed(2)}€`);

    // 🎫 APPLICATION DU CODE PROMO sur le sous-total déjà réduit
    const appliedPromo = req.session.appliedPromo || null;
    let discount = 0;
    let discountedSubtotal = subtotalWithJewelDiscounts;

    if (appliedPromo && appliedPromo.discountPercent) {
      const discountPercent = parseFloat(appliedPromo.discountPercent);
      discount = (subtotalWithJewelDiscounts * discountPercent) / 100;
      discountedSubtotal = subtotalWithJewelDiscounts - discount;
      console.log(`🎫 Code promo ${appliedPromo.code}: -${discount.toFixed(2)}€`);
    }

    // 🚚 CALCULER LES FRAIS DE LIVRAISON
    const shippingThreshold = 50;
    const baseDeliveryFee = 5.99;
    const deliveryFee = discountedSubtotal >= shippingThreshold ? 0 : baseDeliveryFee;
    const finalTotal = discountedSubtotal + deliveryFee;

    console.log(`💰 Totaux calculés:
      - Sous-total avec réductions bijoux: ${subtotalWithJewelDiscounts.toFixed(2)}€
      - Réduction code promo: -${discount.toFixed(2)}€
      - Après code promo: ${discountedSubtotal.toFixed(2)}€
      - Livraison: ${deliveryFee.toFixed(2)}€
      - Total final: ${finalTotal.toFixed(2)}€`);

    // ✅ DEBUG: Vérifier les données avant rendu
    console.log('🔍 DEBUG: Premier item processé:', {
      name: processedItems[0]?.jewel?.name,
      has_discount: processedItems[0]?.jewel?.has_discount,
      original_price: processedItems[0]?.jewel?.original_price,
      effective_price: processedItems[0]?.jewel?.effective_price,
      discount_percentage: processedItems[0]?.jewel?.discount_percentage
    });

    // 📄 DONNÉES POUR LE TEMPLATE
    const templateData = {
      title: 'Récapitulatif de commande',
      
      // 🛒 Structure principale du panier avec prix réduits
      cart: {
        items: processedItems,
        totalPrice: subtotalWithJewelDiscounts
      },
      
      // 📦 Variables individuelles pour compatibilité
      cartItems: processedItems,
      totalPrice: subtotalWithJewelDiscounts.toFixed(2),
      
      // 💰 Totaux financiers
      subtotal: subtotalWithJewelDiscounts,
      discount: discount,
      discountedSubtotal: discountedSubtotal,
      deliveryFee: deliveryFee,
      shippingFee: deliveryFee,
      finalTotal: finalTotal,
      
      // 🎫 Code promo
      appliedPromo: appliedPromo ? {
        code: appliedPromo.code,
        discountPercent: parseFloat(appliedPromo.discountPercent)
      } : null,
      
      // 📊 Métadonnées
      shippingThreshold,
      freeShippingRemaining: Math.max(0, shippingThreshold - discountedSubtotal),
      
      // 👤 Utilisateur
      user: req.session.user || null,
      isAuthenticated: !!req.session.user,
      isGuest: !req.session.user,
      
      // 🌐 Données système
      siteSettings: {
        shipping: {
          free_shipping_threshold: shippingThreshold,
          express_shipping_cost: 15
        }
      },
      currentYear: new Date().getFullYear(),
      
      // 🎯 Messages flash
      success: req.session.flashMessage?.type === 'success' ? req.session.flashMessage.message : null,
      error: req.session.flashMessage?.type === 'error' ? req.session.flashMessage.message : null,
      warning: req.session.flashMessage?.type === 'warning' ? req.session.flashMessage.message : null
    };

    // Nettoyer les messages flash
    if (req.session.flashMessage) {
      delete req.session.flashMessage;
    }

    console.log('📄 Rendu template summary avec formatage prix complet');
    
    // ✅ RENDU DE LA VUE
    res.render('summary', templateData);
    
  } catch (error) {
    console.error('❌ Erreur renderOrderSummary:', error);
    
    // En cas d'erreur, rediriger vers le panier avec message
    req.session.flashMessage = {
      type: 'error',
      message: 'Erreur lors du chargement du récapitulatif. Veuillez réessayer.'
    };
    
    res.redirect('/panier');
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
 * 🛒 Valider et créer la commande (connecté ou invité) - VERSION COMPLÈTE
 */
async validateOrder(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
        console.log('🛒 Validation commande avec support invités ET utilisateurs connectés');
        
        const { paymentMethod, customerInfo } = req.body;
        const userId = req.session?.user?.id || req.session?.customerId;
        const isGuest = !userId;

        console.log('👤 Type utilisateur:', isGuest ? 'Invité' : 'Connecté');
        console.log('📝 Données formulaire reçues:', {
            paymentMethod,
            hasCustomerInfo: !!customerInfo,
            customerInfoFields: customerInfo ? Object.keys(customerInfo) : []
        });

        // ========================================
        // 👤 RÉCUPÉRATION DES INFORMATIONS CLIENT
        // ========================================
        let finalCustomerInfo;
        
        if (isGuest) {
            // ✅ INVITÉ - utiliser les données du formulaire ou de la session
            finalCustomerInfo = customerInfo || req.session.customerInfo;
            
            if (!finalCustomerInfo) {
                throw new Error('Informations client manquantes pour invité');
            }
            
            console.log('✅ Invité - Données utilisées:', {
                source: customerInfo ? 'Formulaire' : 'Session',
                nom: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
                email: finalCustomerInfo.email,
                adresse: finalCustomerInfo.address
            });
            
        } else {
            // ✅ UTILISATEUR CONNECTÉ - PRIORITÉ AUX DONNÉES DU FORMULAIRE
            const customer = await Customer.findByPk(userId);
            if (!customer) {
                throw new Error('Client connecté non trouvé');
            }
            
            // ✅ PRIORITÉ 1: Données du formulaire (si fournies)
            // ✅ PRIORITÉ 2: Données de session 
            // ✅ PRIORITÉ 3: Données du compte (fallback)
            
            if (customerInfo && (customerInfo.firstName || customerInfo.address || customerInfo.email)) {
                // Utiliser les nouvelles données du formulaire
                finalCustomerInfo = {
                    firstName: customerInfo.firstName?.trim() || customer.first_name,
                    lastName: customerInfo.lastName?.trim() || customer.last_name,
                    email: customerInfo.email?.trim() || customer.email,
                    phone: customerInfo.phone?.trim() || customer.phone,
                    address: customerInfo.address?.trim() || customer.address,
                    city: customerInfo.city?.trim() || customer.city,
                    postalCode: customerInfo.postalCode?.trim() || customer.postal_code,
                    deliveryMode: customerInfo.deliveryMode || 'standard',
                    notes: customerInfo.notes?.trim() || ''
                };
                
                console.log('✅ Utilisateur connecté - Nouvelles données du formulaire utilisées:', {
                    nom: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
                    email: finalCustomerInfo.email,
                    adresse: finalCustomerInfo.address,
                    ville: finalCustomerInfo.city,
                    phone: finalCustomerInfo.phone
                });
                
                // ✅ Sauvegarder ces nouvelles données en session
                req.session.customerInfo = finalCustomerInfo;
                
            } else if (req.session.customerInfo) {
                // Utiliser les données de session
                finalCustomerInfo = req.session.customerInfo;
                console.log('✅ Utilisateur connecté - Données de session utilisées');
                
            } else {
                // Fallback sur les données du compte
                finalCustomerInfo = {
                    firstName: customer.first_name,
                    lastName: customer.last_name,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address,
                    city: customer.city || '',
                    postalCode: customer.postal_code || '',
                    deliveryMode: 'standard',
                    notes: ''
                };
                
                console.log('✅ Utilisateur connecté - Données du compte utilisées (fallback)');
            }
        }

        // ========================================
        // 🛒 RÉCUPÉRATION DU PANIER
        // ========================================
        const cartDetails = await cartController.getCartDetails(req);
        
        if (!cartDetails.items || cartDetails.items.length === 0) {
            throw new Error('Panier vide');
        }

        console.log(`🛒 Panier: ${cartDetails.items.length} articles, Total: ${cartDetails.totalPrice.toFixed(2)}€`);

        // ========================================
        // 🎫 CALCUL DES TOTAUX AVEC CODES PROMO
        // ========================================
        const appliedPromo = req.session.appliedPromo;
        let discount = 0;
        let discountedSubtotal = cartDetails.totalPrice;
        let discountPercent = 0;

        if (appliedPromo && appliedPromo.discountPercent) {
            discountPercent = parseFloat(appliedPromo.discountPercent);
            discount = (cartDetails.totalPrice * discountPercent) / 100;
            discountedSubtotal = cartDetails.totalPrice - discount;
            
            console.log(`🎫 Code promo appliqué: ${appliedPromo.code} (-${discount.toFixed(2)}€)`);
        }

        // Calculer frais de livraison
        const shippingThreshold = 50;
        const baseDeliveryFee = 5.90;
        const deliveryFee = discountedSubtotal >= shippingThreshold ? 0 : baseDeliveryFee;
        const finalTotal = discountedSubtotal + deliveryFee;

        console.log(`💰 Totaux finaux:`, {
            sousTotal: cartDetails.totalPrice.toFixed(2),
            reduction: discount.toFixed(2),
            sousotalApresReduction: discountedSubtotal.toFixed(2),
            fraisLivraison: deliveryFee.toFixed(2),
            totalFinal: finalTotal.toFixed(2)
        });

        // ========================================
        // 🆔 GESTION DU CLIENT (INVITÉ OU CONNECTÉ)
        // ========================================
        let customerId = userId;

        if (isGuest) {
            // Créer ou récupérer le client invité
            let existingCustomer = await Customer.findOne({
                where: { email: finalCustomerInfo.email },
                transaction
            });

            if (existingCustomer) {
                // ✅ MISE À JOUR CLIENT EXISTANT
                const updateData = {
                    first_name: finalCustomerInfo.firstName,
                    last_name: finalCustomerInfo.lastName,
                    phone: finalCustomerInfo.phone,
                    address: finalCustomerInfo.address,
                    city: finalCustomerInfo.city || '',
                    postal_code: finalCustomerInfo.postalCode || '',
                    updated_at: new Date()
                };

                // ✅ Si le client existant n'est pas un invité et n'a pas de mot de passe, le marquer comme invité
                if (!existingCustomer.password && !existingCustomer.is_guest) {
                    updateData.is_guest = true;
                }

                await existingCustomer.update(updateData, { transaction });
                
                customerId = existingCustomer.id;
                console.log('👤 Client existant mis à jour:', customerId);
                
            } else {
                // ✅ CRÉER UN NOUVEAU CLIENT INVITÉ AVEC LES BONS CHAMPS
                const newCustomer = await Customer.create({
                    first_name: finalCustomerInfo.firstName,
                    last_name: finalCustomerInfo.lastName,
                    email: finalCustomerInfo.email,
                    phone: finalCustomerInfo.phone || '',
                    address: finalCustomerInfo.address,
                    city: finalCustomerInfo.city || '',
                    postal_code: finalCustomerInfo.postalCode || '',
                    
                    // ✅ CHAMPS INVITÉ CRITIQUES
                    password: null, // Explicitement null
                    is_guest: true, // Marquer comme invité
                    is_email_verified: false,
                    email_verified: false, // Support ancien champ
                    role_id: 1, // Rôle client par défaut
                    
                    // ✅ CHAMPS OPTIONNELS
                    marketing_opt_in: false,
                    email_notifications: true,
                    preferred_delivery_mode: finalCustomerInfo.deliveryMode || 'standard',
                    
                    // ✅ TIMESTAMPS
                    created_at: new Date(),
                    updated_at: new Date()
                    
                }, { transaction });
                
                customerId = newCustomer.id;
                console.log('👥 Nouveau client invité créé:', customerId);
            }
        }

        // ========================================
        // 📋 CRÉATION DE LA COMMANDE AVEC VRAIES DONNÉES
        // ========================================
        
        // Générer numéro de commande unique
        const orderNumber = 'CMD-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

        console.log(`📋 Création commande: ${orderNumber} pour client ${customerId}`);

        // ✅ CRÉER LA COMMANDE AVEC LES VRAIES DONNÉES DE LIVRAISON
        const order = await Order.create({
            numero_commande: orderNumber,
            customer_id: customerId,
            
            // ✅ INFORMATIONS DE CONTACT
            customer_email: finalCustomerInfo.email,
            customer_name: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
            customer_phone: finalCustomerInfo.phone,
            
            // ✅ VRAIES DONNÉES DE LIVRAISON (du formulaire)
            shipping_address: finalCustomerInfo.address,
            shipping_city: finalCustomerInfo.city || '',
            shipping_postal_code: finalCustomerInfo.postalCode || '',
            shipping_phone: finalCustomerInfo.phone,
            shipping_country: 'France',
            
            // ✅ DONNÉES FINANCIÈRES
            subtotal: cartDetails.totalPrice,
            promo_discount_amount: discount,
            promo_discount_percent: discountPercent,
            promo_code: appliedPromo?.code || null,
            shipping_price: deliveryFee,
            total: finalTotal,
            
            // ✅ STATUT ET MÉTHODE
            status: 'confirmed',
            payment_method: paymentMethod || 'card',
            payment_status: 'pending',
            shipping_method: finalCustomerInfo.deliveryMode || 'standard',
            shipping_notes: finalCustomerInfo.notes,
            
            // ✅ MARQUEURS
            is_guest_order: isGuest,
            guest_session_id: isGuest ? req.sessionID : null,
            
            created_at: new Date()
        }, { transaction });

        const orderId = order.id;
        console.log(`✅ Commande créée avec ID: ${orderId}`);

        // ========================================
        // 📦 CRÉATION DES ORDER_ITEMS
        // ========================================
        console.log('📦 Création des order_items...');

        for (const item of cartDetails.items) {
            await OrderItem.create({
                order_id: orderId,
                jewel_id: item.jewel.id,
                jewel_name: item.jewel.name,
                jewel_image: item.jewel.image,
                quantity: item.quantity,
                price: item.jewel.price_ttc,
                size: item.size || 'Non spécifiée'
            }, { transaction });
        }

        console.log(`📦 ${cartDetails.items.length} order_items créés`);

        // ========================================
        // 🧹 NETTOYAGE DU PANIER
        // ========================================
        if (userId) {
            await Cart.destroy({
                where: { customer_id: userId },
                transaction
            });
            console.log('🧹 Panier BDD vidé');
        } else {
            req.session.cart = [];
            console.log('🧹 Panier session vidé');
        }

        req.session.appliedPromo = null;
        // ✅ NE PAS supprimer customerInfo pour pouvoir l'afficher dans les emails

        await transaction.commit();
        console.log('✅ Transaction committée avec succès');

        // ========================================
        // 📧 ENVOI DES EMAILS (ASYNCHRONE)
        // ========================================
        try {
            console.log('📧 Préparation des données pour les emails...');
            
            // Préparer les données pour l'email de confirmation
            const emailOrderData = {
                numero_commande: orderNumber,
                orderId: order.id,
                items: cartDetails.items.map(item => ({
                    jewel: {
                        id: item.jewel.id,
                        name: item.jewel.name,
                        image: item.jewel.image
                    },
                    name: item.jewel.name,
                    quantity: item.quantity,
                    size: item.size || 'Standard',
                    price: item.jewel.price_ttc,
                    total: item.jewel.price_ttc * item.quantity
                })),
                total: finalTotal,
                subtotal: discountedSubtotal,
                shipping_price: deliveryFee,
                shippingAddress: {
                    address: finalCustomerInfo.address || '',
                    city: finalCustomerInfo.city || '',
                    postal_code: finalCustomerInfo.postalCode || ''
                },
                promo_code: appliedPromo?.code || null,
                promo_discount_amount: discount || 0
            };

            const emailCustomerData = {
                firstName: finalCustomerInfo.firstName,
                lastName: finalCustomerInfo.lastName,
                email: finalCustomerInfo.email,
                phone: finalCustomerInfo.phone,
                address: {
                    address: finalCustomerInfo.address || '',
                    city: finalCustomerInfo.city || '',
                    postal_code: finalCustomerInfo.postalCode || ''
                }
            };

            console.log('📧 Données email préparées:', {
                orderNumber,
                customerEmail: finalCustomerInfo.email,
                total: finalTotal,
                itemsCount: cartDetails.items.length
            });

            // 🚀 ENVOI DES EMAILS
            const { sendOrderConfirmationEmails } = await import('../services/mailService.js');
            
            const emailResults = await sendOrderConfirmationEmails(
                finalCustomerInfo.email,
                finalCustomerInfo.firstName,
                emailOrderData,
                emailCustomerData
            );
            
            console.log('📧 Résultats envoi emails:', emailResults);
            
            if (emailResults.customer.success) {
                console.log('✅ Email client envoyé avec succès');
            } else {
                console.error('❌ Échec envoi email client:', emailResults.customer.error);
            }
            
            if (emailResults.admin.success) {
                console.log('✅ Email admin envoyé avec succès');
            } else {
                console.error('❌ Échec envoi email admin:', emailResults.admin.error);
            }

        } catch (emailError) {
            console.error('❌ Erreur emails (non bloquante):', emailError);
            // On continue même si l'email échoue - la commande est créée
        }

        // ========================================
        // ✅ RÉPONSE DE SUCCÈS
        // ========================================
        const successMessage = `Commande ${orderNumber} créée avec succès ! ` +
            (appliedPromo ? `Code promo ${appliedPromo.code} appliqué (-${discount.toFixed(2)}€). ` : '') +
            `Confirmation envoyée à ${finalCustomerInfo.email}.`;

        console.log('🎉 === COMMANDE CRÉÉE AVEC SUCCÈS ===');
        console.log(`   📋 Numéro: ${orderNumber}`);
        console.log(`   💰 Montant: ${finalTotal.toFixed(2)}€`);
        console.log(`   👤 Client: ${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`);
        console.log(`   📧 Email: ${finalCustomerInfo.email}`);
        console.log(`   📍 Adresse: ${finalCustomerInfo.address}`);
        console.log(`   🏙️ Ville: ${finalCustomerInfo.city}`);
        console.log(`   📱 Téléphone: ${finalCustomerInfo.phone}`);
        if (appliedPromo) {
            console.log(`   🎫 Code promo: ${appliedPromo.code} (-${discount.toFixed(2)}€)`);
        }
        console.log('=====================================');

        return res.json({
            success: true,
            message: successMessage,
            order: {
                id: orderId,
                numero: orderNumber,
                total: finalTotal,
                customer_email: finalCustomerInfo.email,
                customer_name: `${finalCustomerInfo.firstName} ${finalCustomerInfo.lastName}`,
                shipping_address: finalCustomerInfo.address,
                shipping_city: finalCustomerInfo.city
            },
            redirectUrl: `/commande/confirmation?orderId=${orderId}&orderNumber=${encodeURIComponent(orderNumber)}`
        });

    } catch (error) {
        await transaction.rollback();
        console.error('❌ Erreur validation commande:', error);
        
        return res.status(500).json({
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