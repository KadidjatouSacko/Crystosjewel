// orderController.js - Version corrigée avec gestion email
import pkg from 'pg';
const { Pool } = pkg;
import { Cart } from '../models/cartModel.js';
import { Jewel } from '../models/jewelModel.js';
import { Customer } from '../models/customerModel.js';
import { Order } from '../models/orderModel.js';
import { OrderItem } from '../models/orderItem.js';
import { Payment } from '../models/paymentModel.js';
import { sendOrderConfirmationEmails } from '../services/mailService.js';
// import { mailService } from '../services/mailService.js';


// Configuration de votre pool PostgreSQL
const pool = new Pool({
  connectionString: process.env.PG_URL || 'postgres://bijoux:bijoux@localhost:5432/bijoux',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function calculateOrderTotals(cartItems, appliedPromo = null) {
    let subtotal = 0;
    
    // Calculer le sous-total
    cartItems.forEach(item => {
        const price = parseFloat(item.jewel.price_ttc) || 0;
        const quantity = parseInt(item.quantity) || 0;
        const itemTotal = price * quantity;
        
        item.itemTotal = Math.round(itemTotal * 100) / 100;
        subtotal += itemTotal;
    });
    
    subtotal = Math.round(subtotal * 100) / 100;
    console.log('📊 Sous-total calculé:', subtotal);
    
    // Variables par défaut
    let discount = 0;
    let discountedSubtotal = subtotal;
    
    // ⚡ CALCUL DE LA RÉDUCTION SI CODE PROMO APPLIQUÉ
    if (appliedPromo && appliedPromo.discountPercent) {
        // Calculer la réduction en pourcentage
        discount = Math.round((subtotal * appliedPromo.discountPercent / 100) * 100) / 100;
        
        // Appliquer une réduction maximale si définie
        if (appliedPromo.maxDiscount && discount > appliedPromo.maxDiscount) {
            discount = appliedPromo.maxDiscount;
        }
        
        // Calculer le sous-total après réduction
        discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;
        
        // S'assurer que le total ne devient pas négatif
        if (discountedSubtotal < 0) {
            discountedSubtotal = 0;
            discount = subtotal;
        }
        
        console.log(`💰 Code promo ${appliedPromo.code}: -${appliedPromo.discountPercent}% = -${discount}€`);
        console.log(`💰 Sous-total après réduction: ${discountedSubtotal}€`);
    }
    
    // Calculer les frais de livraison (gratuits dès 50€ après réduction)
    const deliveryFee = discountedSubtotal >= 50 ? 0 : 5.99;
    
    // Total final
    const finalTotal = Math.round((discountedSubtotal + deliveryFee) * 100) / 100;
    
    console.log('📋 Résumé des calculs:');
    console.log(`  - Sous-total: ${subtotal}€`);
    console.log(`  - Réduction: -${discount}€`);
    console.log(`  - Après réduction: ${discountedSubtotal}€`);
    console.log(`  - Livraison: ${deliveryFee}€`);
    console.log(`  - Total final: ${finalTotal}€`);
    
    return {
        subtotal,
        discount,
        discountedSubtotal,
        deliveryFee,
        finalTotal,
        appliedPromo
    };
}
 
/**
 * 🧮 FONCTION HELPER EXTERNE pour calculer les totaux avec promo
 */
function calculateTotalsWithPromo(subtotal, appliedPromo) {
    let discount = 0;
    let discountedSubtotal = subtotal;
    
    if (appliedPromo) {
        if (appliedPromo.type === 'percentage') {
            discount = (subtotal * appliedPromo.discountPercent) / 100;
        } else if (appliedPromo.type === 'fixed') {
            discount = Math.min(appliedPromo.discountAmount, subtotal);
        }
        
        discountedSubtotal = Math.max(0, subtotal - discount);
    }
    
    const shipping = discountedSubtotal >= 50 ? 0 : 5.99;
    const total = discountedSubtotal + shipping;
    
    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        discountedSubtotal: parseFloat(discountedSubtotal.toFixed(2)),
        shipping: parseFloat(shipping.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        freeShipping: discountedSubtotal >= 50
    };
}


export const orderController = {

  



/**
   * Calcule une date de livraison estimée
   */
  async calculateEstimatedDelivery(daysToAdd = 3) {
    let deliveryDate = new Date();
    let addedDays = 0;
    
    // Boucle jusqu'à avoir ajouté le nombre de jours souhaité (en excluant les dimanches)
    while (addedDays < daysToAdd) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      
      // Si ce n'est pas un dimanche (0 = dimanche), on compte ce jour
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
  },
  
  /**
   * Calcule les frais de livraison
   */
  calculateShippingCost(total, method = 'standard') {
    if (total >= 100) return 0; // Livraison gratuite au-dessus de 100€
    
    switch (method) {
      case 'express':
        return 9.90;
      case 'premium':
        return 15.90;
      default:
        return 4.90;
    }
  },
  
  /**
   * Génère un numéro de commande unique
   */
  generateOrderNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.getTime();
    const random = Math.floor(Math.random() * 999) + 1;
    
    return `CMD-${year}${month}${day}-${timestamp}-${String(random).padStart(3, '0')}`;
  },










    // Afficher la page de paiement
    async renderPaymentDynamicPage(req, res) {
        try {
            if (!req.session?.user) {
                return res.redirect('/connexion-inscription');
            }

            const cart = req.session.cart;
            const customerInfo = req.session.customerInfo;

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect('/panier');
            }

            if (!customerInfo) {
                return res.redirect('/commande/informations');
            }

            // Calculer les totaux
            let subtotal = 0;
            for (const item of cart.items) {
                const price = parseFloat(item.price) || 0;
                const quantity = parseInt(item.quantity) || 1;
                subtotal += price * quantity;
            }

            const deliveryFee = subtotal >= 50 ? 0 : 5.99;
            const total = subtotal + deliveryFee;

            res.render('payment', {
                title: 'Paiement',
                user: req.session.user,
                customerInfo: customerInfo,
                cart: cart,
                subtotal: subtotal,
                deliveryFee: deliveryFee,
                total: total,
                itemsCount: cart.items.length
            });

        } catch (error) {
            console.error('Erreur page paiement:', error);
            res.status(500).send('Erreur serveur');
        }
    },

  /**
   * Afficher la confirmation de commande
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
          },
          {
            model: Customer,
            as: 'customer',
            attributes: ['first_name', 'last_name', 'email']
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

      // Vérifier que la commande appartient à l'utilisateur connecté
      if (req.session?.user && order.customer_id !== req.session.user.id) {
        return res.status(403).send('Accès non autorisé');
      }

      res.render('order-confirmation', {
        order: order,
        user: req.session.user,
        title: 'Confirmation de commande'
      });

    } catch (error) {
      console.error('Erreur confirmation commande:', error);
      res.status(500).send('Erreur serveur');
    }
  },



  


  // 🔥 VALIDATION ET SAUVEGARDE DE LA COMMANDE AVEC EMAIL (VERSION CORRIGÉE)
// 🔍 VERSION DEBUG - Pour identifier le problème exactement



/**
 * ✅ FONCTION COMPLÈTE: validateOrderAndSave
 * Valide et sauvegarde une commande avec envoi d'emails automatique
 */
/**
 * ✅ FONCTION COMPLÈTE: validateOrderAndSave
 * Valide et sauvegarde une commande avec envoi d'emails automatique
 */
async validateOrderAndSave(req, res) {
    const client = await pool.connect();
    
    // 🔍 Détection du type de requête (AJAX vs Formulaire)
    const isAjaxRequest = req.headers['content-type'] === 'application/json' || 
                         req.headers.accept?.includes('application/json') ||
                         req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    console.log('🔍 === DÉBUT VALIDATION COMMANDE ===');
    console.log('📱 Type de requête:', isAjaxRequest ? 'AJAX' : 'Formulaire HTML');
    console.log('🔍 Headers:', req.headers);
    console.log('🔍 Body reçu:', req.body);
    
    try {
        // ========================================
        // 🛡️ ÉTAPE 1: VALIDATION DE L'UTILISATEUR
        // ========================================
        const userId = req.session?.user?.id;
        console.log('🆔 UserId de session:', userId);
        
        if (!userId) {
            console.log('❌ Utilisateur non connecté');
            
            if (isAjaxRequest) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Vous devez être connecté pour passer commande',
                    redirectUrl: '/connexion-inscription'
                });
            }
            
            req.flash('error', 'Veuillez vous connecter pour passer commande');
            return res.redirect('/connexion-inscription');
        }

        // ========================================
        // 🛒 ÉTAPE 2: RÉCUPÉRATION DU PANIER
        // ========================================
        console.log('🛒 Récupération du panier pour userId:', userId);
        
        const cartItems = await Cart.findAll({
            where: { customer_id: userId },
            include: [{ 
                model: Jewel, 
                as: 'jewel', 
                required: true,
                attributes: ['id', 'name', 'description', 'price_ttc', 'image', 'slug', 'stock']
            }]
        });
        
        console.log(`📦 Articles trouvés dans le panier: ${cartItems.length}`);
        
        if (cartItems.length === 0) {
            console.log('❌ Panier vide');
            
            if (isAjaxRequest) {
                return res.status(400).json({
                    success: false,
                    message: 'Votre panier est vide. Veuillez ajouter des articles avant de commander.',
                    redirectUrl: '/bijoux'
                });
            }
            
            req.flash('error', 'Votre panier est vide. Veuillez ajouter des articles avant de commander.');
            return res.redirect('/panier');
        }

        // ========================================
        // 👤 ÉTAPE 3: VALIDATION DES INFORMATIONS CLIENT
        // ========================================
        const customer = req.session.customerInfo;
        console.log('👤 Informations client:', customer ? 'Présentes' : 'Manquantes');
        
        if (!customer) {
            console.log('❌ Informations client manquantes en session');
            
            if (isAjaxRequest) {
                return res.status(400).json({
                    success: false,
                    message: 'Informations de livraison manquantes. Veuillez compléter vos informations.',
                    redirectUrl: '/commande/informations'
                });
            }
            
            req.flash('error', 'Informations de livraison manquantes. Veuillez compléter vos informations.');
            return res.redirect('/commande/informations');
        }

        // Validation des champs obligatoires
        const requiredFields = ['firstName', 'lastName', 'email', 'address'];
        const missingFields = requiredFields.filter(field => !customer[field]);
        
        if (missingFields.length > 0) {
            console.log('❌ Champs manquants:', missingFields);
            
            const message = `Informations manquantes: ${missingFields.join(', ')}`;
            
            if (isAjaxRequest) {
                return res.status(400).json({
                    success: false,
                    message: message,
                    missingFields: missingFields,
                    redirectUrl: '/commande/informations'
                });
            }
            
            req.flash('error', message);
            return res.redirect('/commande/informations');
        }

        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer.email)) {
            console.log('❌ Email invalide:', customer.email);
            
            if (isAjaxRequest) {
                return res.status(400).json({
                    success: false,
                    message: 'Adresse email invalide.',
                    redirectUrl: '/commande/informations'
                });
            }
            
            req.flash('error', 'Adresse email invalide.');
            return res.redirect('/commande/informations');
        }

        // ========================================
        // 📊 ÉTAPE 4: CALCULS ET VÉRIFICATIONS
        // ========================================
        console.log('📊 Calcul des totaux et vérification des stocks...');
        
        let subtotal = 0;
        const orderItems = [];
        const stockErrors = [];
        
        // Traitement de chaque article
        for (const item of cartItems) {
            const quantity = parseInt(item.quantity) || 1;
            const price = parseFloat(item.jewel.price_ttc) || 0;
            const jewelStock = parseInt(item.jewel.stock) || 0;
            
            // Vérification du stock
            if (quantity > jewelStock) {
                stockErrors.push({
                    name: item.jewel.name,
                    requested: quantity,
                    available: jewelStock
                });
                continue;
            }
            
            const itemTotal = price * quantity;
            subtotal += itemTotal;
            
            orderItems.push({
                jewelId: item.jewel.id,
                name: item.jewel.name,
                quantity: quantity,
                price: price,
                total: itemTotal,
                jewel: {
                    id: item.jewel.id,
                    name: item.jewel.name,
                    image: item.jewel.image,
                    slug: item.jewel.slug
                }
            });
            
            console.log(`  ✅ ${item.jewel.name} x${quantity} = ${itemTotal.toFixed(2)}€`);
        }
        
        // Gestion des erreurs de stock
        if (stockErrors.length > 0) {
            console.log('❌ Erreurs de stock détectées:', stockErrors);
            
            const errorMessage = stockErrors.map(error => 
                `${error.name}: ${error.requested} demandé(s) mais seulement ${error.available} disponible(s)`
            ).join(', ');
            
            if (isAjaxRequest) {
                return res.status(400).json({
                    success: false,
                    message: 'Stock insuffisant pour certains articles',
                    stockErrors: stockErrors,
                    redirectUrl: '/panier'
                });
            }
            
            req.flash('error', `Stock insuffisant: ${errorMessage}`);
            return res.redirect('/panier');
        }
        
        // Calcul des frais de livraison
        const deliveryFee = subtotal >= 50 ? 0 : 5.99;
        const finalTotal = subtotal + deliveryFee;
        
        console.log(`💰 Sous-total: ${subtotal.toFixed(2)}€`);
        console.log(`🚚 Frais de livraison: ${deliveryFee.toFixed(2)}€`);
        console.log(`💎 Total final: ${finalTotal.toFixed(2)}€`);

        // ========================================
        // 🏗️ ÉTAPE 5: CRÉATION DE LA COMMANDE
        // ========================================
        console.log('🏗️ Début de la transaction de commande...');
        await client.query('BEGIN');

        // Génération du numéro de commande unique
        const orderNumber = orderController.generateOrderNumber();
        console.log('📋 Numéro de commande généré:', orderNumber);

        // Insertion de la commande principale
        const orderQuery = `
            INSERT INTO orders (
                customer_id, numero_commande, customer_name, customer_email, 
                shipping_address, shipping_city, shipping_postal_code, shipping_phone,
                total, subtotal, shipping_price, status, shipping_method, shipping_notes,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()) 
            RETURNING id, numero_commande, created_at
        `;

        const orderValues = [
            userId, 
            orderNumber, 
            `${customer.firstName} ${customer.lastName}`,
            customer.email, 
            customer.address, 
            customer.city || '',
            customer.postalCode || '', 
            customer.phone || null,
            finalTotal, 
            subtotal, 
            deliveryFee, 
            'en_attente',
            customer.deliveryMode || 'standard', 
            customer.notes || null
        ];

        const orderResult = await client.query(orderQuery, orderValues);
        const orderId = orderResult.rows[0].id;
        const createdOrderNumber = orderResult.rows[0].numero_commande;
        const orderCreatedAt = orderResult.rows[0].created_at;

        console.log(`✅ Commande créée avec succès:`);
        console.log(`   📋 ID: ${orderId}`);
        console.log(`   🔢 Numéro: ${createdOrderNumber}`);
        console.log(`   📅 Date: ${orderCreatedAt}`);

        // ========================================
        // 📝 ÉTAPE 6: AJOUT DES ARTICLES DE COMMANDE
        // ========================================
        console.log('📝 Ajout des articles de commande...');
        
        for (const item of orderItems) {
            await client.query(`
                INSERT INTO order_items (order_id, jewel_id, quantity, price)
                VALUES ($1, $2, $3, $4)
            `, [orderId, item.jewelId, item.quantity, item.price]);
            
            console.log(`  ✅ Article ajouté: ${item.name} x${item.quantity}`);
        }

        // ========================================
        // 📦 ÉTAPE 7: MISE À JOUR DES STOCKS
        // ========================================
        console.log('📦 Mise à jour des stocks...');
        
        for (const item of cartItems) {
            const result = await client.query(`
                UPDATE jewel 
                SET stock = stock - $1 
                WHERE id = $2 
                RETURNING stock
            `, [item.quantity, item.jewel.id]);
            
            const newStock = result.rows[0].stock;
            console.log(`  📦 ${item.jewel.name}: stock mis à jour (reste: ${newStock})`);
        }

        // ========================================
        // 💾 ÉTAPE 8: VALIDATION DE LA TRANSACTION
        // ========================================
        await client.query('COMMIT');
        console.log('💾 Transaction validée avec succès !');

        // ========================================
        // 🧹 ÉTAPE 9: NETTOYAGE DU PANIER (SEULEMENT APRÈS SUCCÈS)
        // ========================================
        console.log('🧹 Nettoyage du panier après succès...');
        
        await Cart.destroy({ where: { customer_id: userId } });
        req.session.cart = null;
        req.session.customerInfo = null;
        
        console.log('✅ Panier vidé et session nettoyée APRÈS validation de la commande');

        // ========================================
        // 📧 ÉTAPE 10: ENVOI DES EMAILS
        // ========================================
        console.log('📧 === ENVOI DES EMAILS DE CONFIRMATION ===');
        
        // Calcul de la date de livraison estimée (sans dimanche)
        let deliveryDate = new Date();
        let addedDays = 0;
        const targetDays = 3;
        
        while (addedDays < targetDays) {
            deliveryDate.setDate(deliveryDate.getDate() + 1);
            
            // Si ce n'est pas un dimanche (0 = dimanche)
            if (deliveryDate.getDay() !== 0) {
                addedDays++;
            }
        }
        
        const estimatedDelivery = deliveryDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        try {
            // Préparation des données pour les emails
            const orderData = {
                orderNumber: createdOrderNumber,
                items: orderItems,
                total: finalTotal,
                subtotal: subtotal,
                shippingFee: deliveryFee,
                orderId: orderId,
                shippingAddress: {
                    name: `${customer.firstName} ${customer.lastName}`,
                    address: customer.address,
                    city: customer.city || '',
                    country: 'France'
                },
                estimatedDelivery: estimatedDelivery
            };

            const customerData = {
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phone: customer.phone || '',
                address: customer.address
            };

            console.log('📧 Données email préparées:');
            console.log(`   📋 Commande: ${orderData.orderNumber}`);
            console.log(`   💰 Total: ${orderData.total.toFixed(2)}€`);
            console.log(`   📅 Livraison: ${estimatedDelivery}`);
            console.log(`   👤 Client: ${customerData.firstName} ${customerData.lastName}`);
            console.log(`   📧 Email: ${customerData.email}`);

            // Envoi simultané des emails client et admin
            console.log('🚀 Envoi simultané des emails...');
            
            const emailResults = await sendOrderConfirmationEmails(
                customer.email,
                customer.firstName,
                orderData,
                customerData
            );

            // Analyse des résultats d'envoi
            console.log('📊 === RÉSULTATS ENVOI EMAILS ===');
            
            if (emailResults.customer.success) {
                console.log(`✅ Email client envoyé: ${emailResults.customer.messageId}`);
            } else {
                console.error(`❌ Échec email client: ${emailResults.customer.error}`);
            }

            if (emailResults.admin.success) {
                console.log(`✅ Email admin envoyé: ${emailResults.admin.messageId}`);
            } else {
                console.error(`❌ Échec email admin: ${emailResults.admin.error}`);
            }

            // Résumé final des emails
            const emailSummary = {
                client: emailResults.customer.success ? '✅ Succès' : '❌ Échec',
                admin: emailResults.admin.success ? '✅ Succès' : '❌ Échec',
                commande: createdOrderNumber,
                montant: `${finalTotal.toFixed(2)}€`,
                client_email: customer.email
            };
            
            console.log('📈 Résumé final emails:', emailSummary);

        } catch (emailError) {
            console.error('❌ ERREUR CRITIQUE lors de l\'envoi des emails:');
            console.error('   Message:', emailError.message);
            console.error('   Stack:', emailError.stack);
            // Note: On ne fait pas échouer la commande si les emails échouent
        }

        // ========================================
        // 🎉 ÉTAPE 11: RÉPONSE FINALE
        // ========================================
        console.log('🎉 === COMMANDE CRÉÉE AVEC SUCCÈS ===');
        console.log(`   📋 Numéro: ${createdOrderNumber}`);
        console.log(`   💰 Montant: ${finalTotal.toFixed(2)}€`);
        console.log(`   👤 Client: ${customer.firstName} ${customer.lastName}`);
        console.log(`   📧 Email: ${customer.email}`);
        console.log('=====================================');

        if (isAjaxRequest) {
            console.log('📤 Retour JSON pour requête AJAX');
            
            return res.status(200).json({
                success: true,
                message: 'Commande créée avec succès ! Un email de confirmation vous a été envoyé.',
                order: {
                    id: orderId,
                    numero: createdOrderNumber,
                    total: finalTotal,
                    subtotal: subtotal,
                    deliveryFee: deliveryFee,
                    itemsCount: orderItems.length,
                    customer_email: customer.email,
                    estimatedDelivery: estimatedDelivery
                },
                redirectUrl: `/commande/confirmation?orderId=${orderId}&orderNumber=${encodeURIComponent(createdOrderNumber)}`
            });
            
        } else {
            console.log('🔄 Redirection pour requête formulaire HTML');
            
            req.flash('success', `Commande ${createdOrderNumber} créée avec succès ! Un email de confirmation vous a été envoyé.`);
            return res.redirect(`/commande/confirmation?orderId=${orderId}&orderNumber=${encodeURIComponent(createdOrderNumber)}`);
        }
        
    } catch (error) {
        // ========================================
        // ❌ GESTION DES ERREURS
        // ========================================
        console.error('💥 === ERREUR LORS DE LA CRÉATION DE COMMANDE ===');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('===============================================');
        
        // Rollback de la transaction
        try {
            await client.query('ROLLBACK');
            console.log('🔄 Transaction annulée (ROLLBACK effectué)');
        } catch (rollbackError) {
            console.error('❌ Erreur lors du ROLLBACK:', rollbackError.message);
        }
        
        // Réponse d'erreur appropriée selon le type de requête
        const errorMessage = error.message || 'Une erreur inattendue est survenue lors de la création de votre commande';
        
        if (isAjaxRequest) {
            return res.status(500).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                redirectUrl: '/panier'
            });
            
        } else {
            req.flash('error', `Erreur lors de la création de la commande: ${errorMessage}`);
            return res.redirect('/panier');
        }
        
    } finally {
        // ========================================
        // 🔌 NETTOYAGE DES RESSOURCES
        // ========================================
        if (client) {
            client.release();
            console.log('🔌 Connexion base de données libérée');
        }
        
        console.log('🏁 === FIN DE validateOrderAndSave ===');
    }
},

     // Calculer les taxes (TVA)
   calculateTax(subtotal, taxRate = 20) { return (subtotal * taxRate) / 100; },
    

 // ========================================
  // 🎫 GESTION DES CODES PROMO
  // ========================================

  /**
   * 🎫 Appliquer un code promo
   */
  async applyPromoCode(req, res) {
    try {
      const { code } = req.body;
      const userId = req.session?.user?.id;

      console.log('🎫 Application code promo:', { code, userId });

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Vous devez être connecté pour utiliser un code promo'
        });
      }

      if (!code || code.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Veuillez saisir un code promo valide'
        });
      }

      // Nettoyer le code (majuscules, trim)
      const cleanCode = code.trim().toUpperCase();

      // Vérifier si un code promo est déjà appliqué
      if (req.session.appliedPromo) {
        return res.status(400).json({
          success: false,
          message: 'Un code promo est déjà appliqué. Veuillez le retirer avant d\'en appliquer un nouveau.'
        });
      }

      // Récupérer le panier de l'utilisateur
      const cartItems = await Cart.findAll({
        where: { customer_id: userId },
        include: [{ 
          model: Jewel, 
          as: 'jewel', 
          required: true,
          attributes: ['price_ttc']
        }]
      });

      if (cartItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Votre panier est vide. Ajoutez des articles avant d\'appliquer un code promo.'
        });
      }

      // Calculer le sous-total
      const subtotal = cartItems.reduce((total, item) => 
        total + (parseFloat(item.jewel.price_ttc) * item.quantity), 0);

      // 🔧 SIMULATION : Code promo en dur pour les tests
      // À remplacer par une vraie requête DB quand la table existe
      const validCodes = {
        'DALLA30': {
          id: 7,
          code: 'DALLA30',
          discount_percent: 20,
          discount_amount: null,
          discount_type: 'percentage',
          minimum_amount: 0,
          usage_limit: null,
          usage_count: 0,
          expiry_date: null,
          is_active: true,
          description: 'Code promo test - 20% de réduction'
        },
        'WELCOME10': {
          id: 1,
          code: 'WELCOME10',
          discount_percent: 10,
          discount_amount: null,
          discount_type: 'percentage',
          minimum_amount: 50,
          usage_limit: 100,
          usage_count: 5,
          expiry_date: '2025-12-31',
          is_active: true,
          description: 'Code de bienvenue - 10% de réduction'
        },
        'FIXED5': {
          id: 2,
          code: 'FIXED5',
          discount_percent: null,
          discount_amount: 5,
          discount_type: 'fixed',
          minimum_amount: 25,
          usage_limit: null,
          usage_count: 0,
          expiry_date: null,
          is_active: true,
          description: 'Réduction fixe de 5€'
        }
      };

      const promoCode = validCodes[cleanCode];

      if (!promoCode) {
        return res.status(404).json({
          success: false,
          message: 'Code promo invalide ou expiré'
        });
      }

      // Vérifier la date d'expiration
      const now = new Date();
      if (promoCode.expiry_date && new Date(promoCode.expiry_date) < now) {
        return res.status(400).json({
          success: false,
          message: 'Ce code promo a expiré'
        });
      }

      // Vérifier le montant minimum
      if (promoCode.minimum_amount && subtotal < promoCode.minimum_amount) {
        return res.status(400).json({
          success: false,
          message: `Montant minimum de ${promoCode.minimum_amount}€ requis pour ce code promo`
        });
      }

      // Vérifier limite d'usage
      if (promoCode.usage_limit && promoCode.usage_count >= promoCode.usage_limit) {
        return res.status(400).json({
          success: false,
          message: 'Ce code promo a atteint sa limite d\'utilisation'
        });
      }

      // Calculer la réduction
      let discount = 0;
      if (promoCode.discount_type === 'percentage') {
        discount = (subtotal * promoCode.discount_percent) / 100;
      } else if (promoCode.discount_type === 'fixed') {
        discount = Math.min(promoCode.discount_amount, subtotal);
      }

      // Appliquer le code promo en session
      req.session.appliedPromo = {
        id: promoCode.id,
        code: promoCode.code,
        discountPercent: promoCode.discount_percent || 0,
        discountAmount: promoCode.discount_amount || 0,
        type: promoCode.discount_type,
        description: promoCode.description
      };

      console.log('✅ Code promo appliqué:', req.session.appliedPromo);

      res.json({
        success: true,
        message: `Code promo "${cleanCode}" appliqué avec succès !`,
        promo: req.session.appliedPromo
      });

    } catch (error) {
      console.error('❌ Erreur application code promo:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'application du code promo'
      });
    }
  },

  /**
   * 🗑️ Retirer un code promo
   */
  async removePromoCode(req, res) {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Vous devez être connecté'
        });
      }

      if (!req.session.appliedPromo) {
        return res.status(400).json({
          success: false,
          message: 'Aucun code promo à retirer'
        });
      }

      const removedPromo = req.session.appliedPromo;
      req.session.appliedPromo = null;

      console.log('🗑️ Code promo retiré:', removedPromo.code);

      res.json({
        success: true,
        message: `Code promo "${removedPromo.code}" retiré avec succès`
      });

    } catch (error) {
      console.error('❌ Erreur suppression code promo:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du code promo'
      });
    }
  },

  // ========================================
  // 🛒 GESTION DES COMMANDES
  // ========================================

  /**
   * 📊 Afficher le récapitulatif de commande (MAINTENANT calculateTotalsWithPromo est accessible)
   */
// Correction pour orderController.js - Support invités

async renderOrderSummary(req, res) {
    try {
        console.log('🛒 Accès à /commande avec support invités');
        
        // ✅ SUPPORT INVITÉS : Vérifier utilisateur connecté OU session invité
        const userId = req.session?.user?.id || req.session?.customerId;
        const isGuest = !req.session?.user && !req.session?.customerId;
        
        console.log('🆔 User ID:', userId, 'Invité:', isGuest);
        
        let cartItems = [];
        
        if (userId) {
            // Utilisateur connecté - récupérer depuis la DB
            cartItems = await Cart.findAll({
                where: { customer_id: userId },
                include: [{ 
                    model: Jewel, 
                    as: 'jewel', 
                    required: true,
                    attributes: ['id', 'name', 'description', 'price_ttc', 'image', 'slug']
                }]
            });
            
            cartItems = cartItems.map(item => ({
                id: item.id,
                jewelId: item.jewel.id,
                jewel: item.jewel,
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.jewel.price_ttc) || 0,
                itemTotal: (parseFloat(item.jewel.price_ttc) || 0) * (parseInt(item.quantity) || 1)
            }));
            
        } else {
            // Invité - récupérer depuis la session
            const sessionCart = req.session.cart || { items: [] };
            
            for (const item of sessionCart.items) {
                if (item.jewel && item.jewel.id) {
                    // Vérifier que le bijou existe encore
                    const currentJewel = await Jewel.findByPk(item.jewel.id);
                    if (currentJewel) {
                        cartItems.push({
                            jewelId: currentJewel.id,
                            jewel: currentJewel,
                            quantity: parseInt(item.quantity) || 1,
                            price: parseFloat(currentJewel.price_ttc) || 0,
                            itemTotal: (parseFloat(currentJewel.price_ttc) || 0) * (parseInt(item.quantity) || 1)
                        });
                    }
                }
            }
        }
        
        console.log(`📦 Articles trouvés: ${cartItems.length}`);
        
        if (cartItems.length === 0) {
            console.log('❌ Panier vide');
            req.flash('error', 'Votre panier est vide. Ajoutez des articles avant de continuer.');
            return res.redirect('/panier');
        }
        
        // 🎯 RÉCUPÉRER LE CODE PROMO DE LA SESSION
        const appliedPromo = req.session.appliedPromo || null;
        console.log('🎫 Code promo en session:', appliedPromo);
        
        // ⚡ CALCULER LES TOTAUX AVEC LE CODE PROMO
        const totals = calculateOrderTotals(cartItems, appliedPromo);
        
        console.log('💰 Totaux calculés:', {
            subtotal: totals.subtotal,
            discount: totals.discount,
            discountedSubtotal: totals.discountedSubtotal,
            deliveryFee: totals.deliveryFee,
            finalTotal: totals.finalTotal
        });

        // Variables pour le template
        const templateData = {
            title: 'Récapitulatif de commande',
            cartItems: cartItems,
            subtotal: totals.subtotal,
            discount: totals.discount,
            discountedSubtotal: totals.discountedSubtotal,
            deliveryFee: totals.deliveryFee,
            finalTotal: totals.finalTotal,
            appliedPromo: totals.appliedPromo,
            user: req.session.user || null,
            isAuthenticated: !!req.session.user,
            isGuest: isGuest,
            currentYear: new Date().getFullYear()
        };

        console.log('📄 Rendu template avec support invités');
        
        // ✅ Utiliser le bon template (commande ou summary selon votre structure)
        res.render('commande', templateData);
        
    } catch (error) {
        console.error('❌ Erreur dans renderOrderSummary:', error);
        console.error('Stack:', error.stack);
        req.flash('error', 'Une erreur est survenue lors du chargement du récapitulatif');
        res.redirect('/panier');
    }
},

/**
 * Sauvegarder les informations client (compatible invités)
 */
async saveCustomerInfo(req, res) {
    try {
        console.log('💾 Sauvegarde infos client:', req.body);
        
        const { firstName, lastName, email, phone, address, deliveryMode, notes } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !address) {
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
                message: 'Adresse email invalide.'
            });
        }

        // ✅ Sauvegarder en session (pour invités ET connectés)
        req.session.customerInfo = {
            firstName,
            lastName,
            email,
            phone,
            address,
            deliveryMode: deliveryMode || 'standard',
            notes: notes || ''
        };

        // Créer un ID invité si nécessaire
        if (!req.session.user && !req.session.guestId) {
            req.session.guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        console.log('✅ Infos client sauvegardées pour:', req.session.user ? 'utilisateur connecté' : 'invité');

        res.json({ 
            success: true, 
            message: 'Informations sauvegardées',
            redirectUrl: '/commande/paiement'
        });

    } catch (error) {
        console.error('Erreur sauvegarde infos client:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
},

  // ========================================
  // 📦 AUTRES MÉTHODES (gardées telles quelles)
  // ========================================

  async getCartAPI(req, res) {
    try {
      const userId = req.session?.user?.id || req.session?.customerId;
      let cart = { items: [], totalPrice: 0, itemCount: 0 };

      if (userId) {
        // Récupérer depuis la base de données
        const cartItems = await Cart.findAll({
          where: { customer_id: userId },
          include: [{ model: Jewel, as: 'jewel', required: true }]
        });

        if (cartItems.length > 0) {
          cart = {
            items: cartItems.map(item => ({
              jewelId: item.jewel.id,
              jewel: {
                id: item.jewel.id,
                name: item.jewel.name,
                description: item.jewel.description || '',
                price_ttc: parseFloat(item.jewel.price_ttc),
                image: item.jewel.image
              },
              quantity: item.quantity
            })),
            totalPrice: cartItems.reduce((total, item) => 
              total + (parseFloat(item.jewel.price_ttc) * item.quantity), 0),
            itemCount: cartItems.reduce((total, item) => total + item.quantity, 0)
          };
        }
      } else {
        // Récupérer depuis la session
        cart = req.session.cart || { items: [], totalPrice: 0, itemCount: 0 };
      }

      if (!cart.items || cart.items.length === 0) {
        return res.json({ success: false, message: 'Panier vide' });
      }

      res.json({ success: true, cart });

    } catch (error) {
      console.error('❌ Erreur API cart:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération du panier' });
    }
  },

  async renderPaymentDynamicPage(req, res) {
    try {
      // Appeler directement la fonction renderOrderSummary
      return await this.renderOrderSummary(req, res);
    } catch (error) {
      console.error('❌ Erreur dans renderPaymentDynamicPage:', error);
      res.redirect('/panier');
    }
  },

  async renderCustomerForm(req, res) {
    try {
      console.log('📝 Accès formulaire informations client');
      
      if (!req.session?.user) {
        return res.redirect('/connexion-inscription');
      }

      const userId = req.session.user.id || req.session.customerId;
      
      // Sync du panier depuis la DB (même logique que renderOrderSummary)
      const cartItems = await Cart.findAll({
        where: { customer_id: userId },
        include: [{ 
          model: Jewel, 
          as: 'jewel', 
          required: true,
          attributes: ['id', 'name', 'description', 'price_ttc', 'image', 'slug']
        }]
      });
      
      if (cartItems.length === 0) {
        req.flash('error', 'Votre panier est vide. Ajoutez des articles avant de continuer.');
        return res.redirect('/panier');
      }
      
      // Construire les données du panier
      let subtotal = 0;
      let itemCount = 0;
      
      const processedCartItems = cartItems.map(item => {
        const quantity = parseInt(item.quantity) || 1;
        const price = parseFloat(item.jewel.price_ttc) || 0;
        const itemTotal = price * quantity;
        
        subtotal += itemTotal;
        itemCount += quantity;
        
        return {
          id: item.id,
          jewelId: item.jewel.id,
          jewel: {
            id: item.jewel.id,
            name: item.jewel.name,
            description: item.jewel.description || '',
            price_ttc: price,
            image: item.jewel.image,
            slug: item.jewel.slug
          },
          quantity: quantity,
          price: price,
          itemTotal: itemTotal
        };
      });
      
      const deliveryFee = subtotal >= 50 ? 0 : 5.99;
      const total = subtotal + deliveryFee;

      // Données pour le template (identique à renderOrderSummary)
      const templateData = {
        title: 'Informations de livraison',
        cartItems: processedCartItems,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        total: total,
        shippingFee: deliveryFee,
        finalTotal: total,
        totalPrice: subtotal,
        itemCount: itemCount,
        cart: {
          items: processedCartItems,
          totalPrice: subtotal,
          itemCount: itemCount
        },
        user: req.session.user,
        isAuthenticated: true,
        currentYear: new Date().getFullYear(),
        // Informations client préremplies
        customerInfo: req.session.customerInfo || {
          firstName: req.session.user.first_name || '',
          lastName: req.session.user.last_name || '',
          email: req.session.user.email || '',
          phone: req.session.user.phone || '',
          address: req.session.user.address || ''
        }
      };

      // 🔥 UTILISER LA MÊME VUE QUE LE RÉCAPITULATIF
      res.render('summary', templateData);
      
    } catch (error) {
      console.error('❌ Erreur formulaire client:', error);
      req.flash('error', 'Erreur lors du chargement du formulaire');
      res.redirect('/panier');
    }
  },

  async renderPaymentPage(req, res) {
    try {
      console.log('💳 Redirection vers récapitulatif pour paiement');
      
      if (!req.session?.user) {
        return res.redirect('/connexion-inscription');
      }
      
      return res.redirect('/commande/recapitulatif');
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      res.redirect('/panier');
    }
  },



 // Envoi d'email de confirmation (à implémenter)
  async sendOrderConfirmationEmail(email, orderId, numeroCommande) {
    // Implémentation de l'envoi d'email
    console.log(`Email de confirmation envoyé à ${email} pour la commande ${numeroCommande} (ID: ${orderId})`);
  }, 



  /**
   * Met à jour le statut d'une commande et envoie des notifications
   */
  async updateOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { status, trackingNumber, carrier } = req.body;

      const order = await Order.findByPk(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      // Mettre à jour le statut
      await order.update({
        status,
        tracking_number: trackingNumber || order.tracking_number,
        carrier: carrier || order.carrier,
        updated_at: new Date()
      });

      console.log('✅ Statut commande mis à jour:', { orderId, status });

      // Envoyer notification selon le statut
      if (status === 'shipped' && trackingNumber) {
        const shippingData = {
          orderNumber: order.order_number,
          trackingNumber,
          carrier: carrier || 'Transporteur',
          estimatedDelivery: orderController.calculateEstimatedDelivery()
        };

        const emailResult = await emailService.sendShippingNotificationEmail(
          order.customer_email,
          order.customer_name.split(' ')[0], // Prénom
          shippingData
        );

        if (emailResult.success) {
          console.log('✅ Email d\'expédition envoyé');
        } else {
          console.error('❌ Erreur envoi email expédition:', emailResult.error);
        }
      }

      res.json({
        success: true,
        message: 'Statut de commande mis à jour',
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          tracking_number: order.tracking_number
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour statut commande:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }
  },

  /**
   * Envoie un email promotionnel à une liste d'utilisateurs
   */
  async sendPromotionalEmail(req, res) {
    try {
      const {
        subject,
        title,
        description,
        discount,
        promoCode,
        expiryDate,
        targetUsers // 'all', 'verified', ou array d'IDs
      } = req.body;

      // Validation
      if (!subject || !title || !description) {
        return res.status(400).json({
          success: false,
          message: 'Informations manquantes pour l\'email promotionnel'
        });
      }

      // Définir les utilisateurs cibles
      let whereClause = {};
      
      if (targetUsers === 'verified') {
        whereClause.email_verified = true;
      } else if (Array.isArray(targetUsers)) {
        whereClause.id = { [Op.in]: targetUsers };
      }
      // 'all' = pas de filtre

      const users = await User.findAll({
        where: whereClause,
        attributes: ['id', 'firstName', 'email']
      });

      console.log(`📧 Envoi email promotionnel à ${users.length} utilisateurs`);

      const promoData = {
        subject,
        title,
        description,
        discount: discount || 0,
        promoCode: promoCode || '',
        expiryDate: expiryDate || 'Durée limitée'
      };

      // Envoyer les emails (en lot pour éviter le spam)
      const batchSize = 10;
      let sentCount = 0;
      let errorCount = 0;

      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const emailPromises = batch.map(async (user) => {
          try {
            const result = await emailService.sendPromotionalEmail(
              user.email,
              user.firstName,
              promoData
            );
            
            if (result.success) {
              sentCount++;
            } else {
              errorCount++;
            }
            
            return result;
          } catch (error) {
            console.error(`Erreur email pour ${user.email}:`, error);
            errorCount++;
            return { success: false };
          }
        });

        await Promise.all(emailPromises);
        
        // Pause entre les lots pour éviter les limites de taux
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Emails envoyés: ${sentCount}, Erreurs: ${errorCount}`);

      res.json({
        success: true,
        message: `Email promotionnel envoyé avec succès`,
        stats: {
          total: users.length,
          sent: sentCount,
          errors: errorCount
        }
      });

    } catch (error) {
      console.error('❌ Erreur envoi email promotionnel:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi de l\'email promotionnel'
      });
    }
  },

  async syncCartFromDatabase(userId) {
    try {
        console.log('🔄 Synchronisation panier depuis la DB pour userId:', userId);
        
        const cartItems = await Cart.findAll({
            where: { customer_id: userId },
            include: [{ 
                model: Jewel, 
                as: 'jewel', 
                required: true,
                attributes: ['id', 'name', 'price_ttc', 'image', 'slug']
            }]
        });
        
        if (cartItems.length === 0) {
            console.log('📦 Aucun article en DB');
            return { items: [], totalPrice: 0, itemCount: 0 };
        }
        
        let totalPrice = 0;
        let itemCount = 0;
        
        const items = cartItems.map(item => {
            const quantity = parseInt(item.quantity) || 1;
            const price = parseFloat(item.jewel.price_ttc) || 0;
            
            totalPrice += price * quantity;
            itemCount += quantity;
            
            return {
                jewelId: item.jewel.id,
                jewel: {
                    id: item.jewel.id,
                    name: item.jewel.name,
                    price_ttc: price,
                    image: item.jewel.image,
                    slug: item.jewel.slug
                },
                quantity: quantity,
                price: price
            };
        });
        
        console.log(`✅ Panier synchronisé: ${items.length} articles, total: ${totalPrice}€`);
        
        return {
            items: items,
            totalPrice: totalPrice,
            itemCount: itemCount
        };
        
    } catch (error) {
        console.error('❌ Erreur synchronisation panier:', error);
        return { items: [], totalPrice: 0, itemCount: 0 };
    }
},


 
};