// orderController.js - Version corrigée avec gestion email
import pkg from 'pg';
const { Pool } = pkg;
import { Cart } from '../models/cartModel.js';
import { Jewel } from '../models/jewelModel.js';
import { Customer } from '../models/customerModel.js';
import { Order } from '../models/orderModel.js';
import { OrderItem } from '../models/orderItem.js';
import { Payment } from '../models/paymentModel.js';
import { PromoCode } from '../models/Promocode.js';
import { sequelize } from '../models/sequelize-client.js';
import { sendOrderConfirmationEmails } from '../services/mailService.js';
import { sendOrderConfirmationWithSMS } from '../services/mailService.js';

// import { mailService } from '../services/mailService.js';


// Configuration de votre pool PostgreSQL
const pool = new Pool({
  connectionString: process.env.PG_URL || 'postgres://bijoux:bijoux@localhost:5432/bijoux',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});


function calculateOrderTotals(cartItems, appliedPromo = null) {
    let subtotal = 0;
    
    cartItems.forEach(item => {
        const price = parseFloat(item.jewel.price_ttc) || 0;
        const quantity = parseInt(item.quantity) || 0;
        const itemTotal = price * quantity;
        
        item.itemTotal = Math.round(itemTotal * 100) / 100;
        subtotal += itemTotal;
    });
    
    subtotal = Math.round(subtotal * 100) / 100;
    console.log('📊 Sous-total calculé:', subtotal);
    
    let discount = 0;
    let discountedSubtotal = subtotal;
    
    if (appliedPromo) {
        // ✅ GÉRER LES DEUX STRUCTURES (ancienne et nouvelle)
        if (appliedPromo.type === 'percentage' || appliedPromo.discountPercent) {
            const percent = appliedPromo.discountPercent || 
                          (appliedPromo.originalData?.discount_value) || 
                          appliedPromo.discount_value || 0;
            discount = Math.round((subtotal * percent / 100) * 100) / 100;
        } else if (appliedPromo.type === 'fixed' || appliedPromo.discountAmount) {
            const fixedAmount = appliedPromo.discountAmount || 
                              (appliedPromo.originalData?.discount_value) || 
                              appliedPromo.discount_value || 0;
            discount = Math.min(fixedAmount, subtotal);
        }
        
        if (appliedPromo.maxDiscount && discount > appliedPromo.maxDiscount) {
            discount = appliedPromo.maxDiscount;
        }
        
        discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;
        
        if (discountedSubtotal < 0) {
            discountedSubtotal = 0;
            discount = subtotal;
        }
        
        console.log(`💰 Code promo ${appliedPromo.code}: -${discount}€`);
    }
    
    const deliveryFee = discountedSubtotal >= 50 ? 0 : 5.99;
    const finalTotal = Math.round((discountedSubtotal + deliveryFee) * 100) / 100;
    
    return {
        subtotal,
        discount,
        discountedSubtotal,
        deliveryFee,
        finalTotal,
        appliedPromo
    };
};
 
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
    
   const freeShippingThreshold = res.locals.freeShippingThreshold || 100;
const standardShippingCost = res.locals.standardShippingCost || 7.50;
const shipping = discountedSubtotal >= freeShippingThreshold ? 0 : standardShippingCost;
const deliveryFee = subtotal >= freeShippingThreshold ? 0 : standardShippingCost;
    // const total = discountedSubtotal + shipping;
    
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



  


// orderController.js - CORRECTION COMPLÈTE méthode updateOrder

/**
 * 🔧 MÉTHODE updateOrder CORRIGÉE - SANS o.email qui n'existe pas
 */
async updateOrder(req, res) {
    const orderId = req.params.id;
    const { status, tracking_number, notes } = req.body;
    
    try {
        console.log(`🔄 Mise à jour commande ${orderId}:`, { status, tracking_number, notes });

        // ✅ REQUÊTE SQL COMPLÈTEMENT CORRIGÉE - SANS o.email
        const existingOrderQuery = `
            SELECT 
                o.id,
                o.numero_commande,
                o.customer_id,
                o.status,
                o.total,
                o.subtotal,
                o.tracking_number,
                o.notes,
                o.created_at,
                o.updated_at,
                
                -- ✅ EMAIL CLIENT - SEULEMENT LES COLONNES QUI EXISTENT
                COALESCE(
                    o.customer_email,
                    c.email
                ) as customer_email,
                
                -- ✅ NOM CLIENT
                COALESCE(
                    o.customer_name,
                    CONCAT(TRIM(COALESCE(c.first_name, '')), ' ', TRIM(COALESCE(c.last_name, ''))),
                    'Client inconnu'
                ) as customer_name,
                
                -- ✅ TÉLÉPHONE CLIENT
                COALESCE(
                    o.customer_phone,
                    c.phone
                ) as customer_phone,
                
                -- ✅ STATUT ACTUEL
                COALESCE(o.status, 'pending') as current_status,
                
                -- ✅ INFOS CLIENT POUR FALLBACK
                c.first_name,
                c.last_name,
                c.email as client_email,
                c.phone as client_phone
                
            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            WHERE o.id = $1
        `;
        
        console.log('📋 Exécution requête SQL corrigée...');
        
        const [existingResult] = await sequelize.query(existingOrderQuery, { 
            bind: [orderId],
            type: sequelize.QueryTypes.SELECT
        });
        
        if (!existingResult) {
            console.error(`❌ Commande ${orderId} non trouvée`);
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }

        const existingOrder = existingResult;
        const oldStatus = existingOrder.current_status || existingOrder.status;
        const customerEmail = existingOrder.customer_email;
        const customerPhone = existingOrder.customer_phone;

        console.log(`📧 Email client trouvé: "${customerEmail}"`);
        console.log(`📱 Téléphone client: "${customerPhone || 'Non fourni'}"`);
        console.log(`🔄 Changement statut: "${oldStatus}" → "${status}"`);

        // ✅ MISE À JOUR EN BASE DE DONNÉES AVEC TRANSACTION
        await sequelize.transaction(async (t) => {
            // Mise à jour de la commande
            await sequelize.query(`
                UPDATE orders 
                SET 
                    status = $2,
                    tracking_number = $3,
                    notes = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, {
                bind: [orderId, status, tracking_number || null, notes || null],
                transaction: t
            });

            console.log(`✅ Commande ${orderId} mise à jour en base`);

            // ✅ HISTORIQUE DU CHANGEMENT DE STATUT
            if (status !== oldStatus) {
                const adminName = req.session?.user?.email || req.session?.user?.name || 'Admin';
                
                // Vérifier si la table order_status_history existe
                try {
                    await sequelize.query(`
                        INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
                        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                    `, {
                        bind: [
                            orderId, 
                            oldStatus, 
                            status, 
                            `Statut modifié: ${oldStatus} → ${status}${notes ? `. Notes: ${notes}` : ''}`, 
                            adminName
                        ],
                        transaction: t
                    });
                    console.log('✅ Historique ajouté à order_status_history');
                } catch (historyError) {
                    console.warn('⚠️ Table order_status_history inexistante:', historyError.message);
                    // Alternative: ajouter l'historique dans les notes de la commande
                    const historyNote = `\n[${new Date().toISOString()}] ${adminName}: ${oldStatus} → ${status}`;
                    await sequelize.query(`
                        UPDATE orders 
                        SET notes = CONCAT(COALESCE(notes, ''), $2)
                        WHERE id = $1
                    `, {
                        bind: [orderId, historyNote],
                        transaction: t
                    });
                    console.log('✅ Historique ajouté dans notes');
                }
            }
        });

        console.log(`✅ Commande ${orderId} mise à jour: ${oldStatus} → ${status}`);

        // ✅ ENVOI DES NOTIFICATIONS (EMAIL + SMS) si statut changé
        let notificationResults = {
            email: { success: false, message: 'Statut inchangé' },
            sms: { success: false, message: 'Statut inchangé' },
            success: false
        };
        
        if (status !== oldStatus) {
            if (customerEmail && customerEmail.includes('@')) {
                try {
                    console.log('📧📱 Envoi notifications changement statut...');
                    
                    // Import dynamique pour éviter les erreurs de dépendance circulaire
                    const { sendStatusChangeNotifications } = await import('../services/mailService.js');
                    
                    const orderData = {
                        id: existingOrder.id,
                        numero_commande: existingOrder.numero_commande || `CMD-${existingOrder.id}`,
                        tracking_number: tracking_number || existingOrder.tracking_number,
                        total: existingOrder.total,
                        customer_name: existingOrder.customer_name
                    };

                    const statusChangeData = {
                        oldStatus,
                        newStatus: status,
                        updatedBy: req.session?.user?.email || 'Admin'
                    };

                    const customerData = {
                        userEmail: customerEmail,
                        firstName: existingOrder.first_name || existingOrder.customer_name?.split(' ')[0] || 'Client',
                        lastName: existingOrder.last_name || existingOrder.customer_name?.split(' ').slice(1).join(' ') || '',
                        phone: customerPhone
                    };

                    notificationResults = await sendStatusChangeNotifications(orderData, statusChangeData, customerData);
                    
                    console.log('📊 Résultats notifications:', {
                        email: notificationResults.email.success ? '✅' : '❌',
                        sms: notificationResults.sms.success ? '✅' : '❌'
                    });
                    
                } catch (notificationError) {
                    console.error('⚠️ Erreur notifications (non bloquante):', notificationError);
                    notificationResults = {
                        email: { success: false, error: notificationError.message },
                        sms: { success: false, error: notificationError.message },
                        success: false
                    };
                }
            } else {
                console.log('⚠️ Notifications non envoyées - Email invalide:', customerEmail);
                notificationResults = {
                    email: { success: false, message: 'Email invalide ou manquant' },
                    sms: { success: false, message: 'Email invalide ou manquant' },
                    success: false
                };
            }
        }

        // ✅ RÉPONSE AVEC DÉTAILS DES NOTIFICATIONS
        const response = {
            success: true,
            message: 'Commande mise à jour avec succès',
            data: {
                order: {
                    id: existingOrder.id,
                    numero_commande: existingOrder.numero_commande,
                    status: status,
                    tracking_number: tracking_number || existingOrder.tracking_number,
                    customer_email: customerEmail,
                    customer_phone: customerPhone
                },
                statusChanged: status !== oldStatus,
                notifications: {
                    emailSent: notificationResults.email.success,
                    smsSent: notificationResults.sms.success,
                    anyNotificationSent: notificationResults.success
                },
                notificationDetails: notificationResults
            }
        };

        console.log('✅ Réponse envoyée:', response.message);
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur mise à jour commande:', error);
        console.error('Stack trace:', error.stack);
        
        // Analyser l'erreur pour donner plus de détails
        let errorMessage = error.message;
        if (error.message.includes('column') && error.message.includes('does not exist')) {
            errorMessage = 'Erreur de structure de base de données. Veuillez vérifier la table orders.';
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour: ' + errorMessage,
            debug: process.env.NODE_ENV === 'development' ? {
                error: error.message,
                stack: error.stack,
                query: 'Requête SQL mise à jour'
            } : undefined
        });
    }
},

/**
 * 🆕 MÉTHODE ALTERNATIVE - Mise à jour du statut avec notifications améliorées
 */
async updateOrderStatus (req, res)  {
    try {
        const { orderId } = req.params;
        const { status, trackingNumber } = req.body;
        
        console.log(`📦 Mise à jour statut commande ${orderId} vers: ${status}`);
        
        // Récupérer la commande complète avec les détails
        const order = await db.query(`
            SELECT o.*, c.firstName, c.lastName, c.email, c.address, c.city, c.postal_code
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.id = ?
        `, [orderId]);
        
        if (order.length === 0) {
            return res.status(404).json({ success: false, message: 'Commande non trouvée' });
        }
        
        const orderData = order[0];
        
        // Mettre à jour le statut dans la base de données
        await db.query(`
            UPDATE orders 
            SET status = ?, tracking_number = ?, updated_at = NOW()
            WHERE id = ?
        `, [status, trackingNumber || null, orderId]);
        
        // Envoyer l'email correspondant au nouveau statut
        try {
            let emailResult = null;
            
            switch (status) {
                case 'shipped':
                case 'expediee':
                    // Import de la fonction d'email d'expédition
                    const { sendShippingEmail } = await import('../services/mailService.js');
                    
                    const estimatedDelivery = calculateDeliveryDate(3);
                    emailResult = await sendShippingEmail(orderData.email, orderData.firstName, {
                        orderNumber: orderData.orderNumber,
                        trackingNumber: trackingNumber || 'En cours d\'attribution',
                        estimatedDelivery
                    });
                    break;
                    
                case 'delivered':
                case 'livree':
                    // Import de la fonction d'email de livraison
                    const { sendDeliveryEmail } = await import('../services/mailService.js');
                    
                    emailResult = await sendDeliveryEmail(orderData.email, orderData.firstName, {
                        orderNumber: orderData.orderNumber
                    });
                    break;
            }
            
            if (emailResult && emailResult.success) {
                console.log(`✅ Email de ${status} envoyé avec succès`);
            } else if (emailResult) {
                console.error(`❌ Échec envoi email de ${status}:`, emailResult.error);
            }
            
        } catch (emailError) {
            console.error('❌ Erreur lors de l\'envoi de l\'email de statut:', emailError);
            // On continue même si l'email échoue
        }
        
        res.json({ 
            success: true, 
            message: `Statut mis à jour vers: ${status}${trackingNumber ? ` (Suivi: ${trackingNumber})` : ''}` 
        });
        
    } catch (error) {
        console.error('❌ Erreur mise à jour statut:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du statut' });
    }
},

// ✅ FONCTION UTILITAIRE POUR CALCULER LA DATE DE LIVRAISON
 calculateDeliveryDate(daysToAdd = 3) {
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
        timeZone: 'Europe/Paris',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
},

/**
 * ✅ FONCTION COMPLÈTE: validateOrderAndSave
 * Valide et sauvegarde une commande avec envoi d'emails automatique
 */
async validateOrderAndSave(req, res) {
    const transaction = await sequelize.transaction();
    
    const isAjaxRequest = req.headers['content-type'] === 'application/json' || 
                         req.headers.accept?.includes('application/json') ||
                         req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    console.log('🔍 === DÉBUT VALIDATION COMMANDE ===');
    console.log('📱 Type de requête:', isAjaxRequest ? 'AJAX' : 'Standard');
    
    try {
        // ========================================
        // 🔐 ÉTAPE 1: VÉRIFICATION UTILISATEUR
        // ========================================
        if (!req.session?.user?.id) {
            console.log('❌ Utilisateur non connecté');
            if (isAjaxRequest) {
                return res.status(401).json({
                    success: false,
                    message: 'Vous devez être connecté pour passer commande'
                });
            }
            return res.redirect('/connexion-inscription');
        }

        const userId = req.session.user.id;
        console.log(`👤 Utilisateur connecté: ID ${userId}`);

        // ========================================
        // 🛒 ÉTAPE 2: RÉCUPÉRATION DU PANIER
        // ========================================
        console.log('🛒 Récupération du panier...');
        
        const cartItems = await Cart.findAll({
            where: { customer_id: userId },
            include: [{
                model: Jewel,
                as: 'jewel',
                required: true,
                attributes: ['id', 'name', 'price_ttc', 'stock', 'image']
            }],
            transaction
        });

        if (cartItems.length === 0) {
            console.log('❌ Panier vide');
            if (isAjaxRequest) {
                return res.status(400).json({
                    success: false,
                    message: 'Votre panier est vide'
                });
            }
            req.flash('error', 'Votre panier est vide');
            return res.redirect('/panier');
        }

        console.log(`✅ Panier récupéré: ${cartItems.length} articles`);

        // ========================================
        // 📦 ÉTAPE 3: VÉRIFICATION DU STOCK
        // ========================================
        console.log('📦 Vérification du stock...');
        
        for (const item of cartItems) {
            if (item.jewel.stock < item.quantity) {
                console.log(`❌ Stock insuffisant pour ${item.jewel.name}`);
                await transaction.rollback();
                if (isAjaxRequest) {
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuffisant pour ${item.jewel.name}`
                    });
                }
                req.flash('error', `Stock insuffisant pour ${item.jewel.name}`);
                return res.redirect('/panier');
            }
        }

        // ========================================
        // 👤 ÉTAPE 4: RÉCUPÉRATION DES INFOS CLIENT
        // ========================================
        console.log('👤 Récupération des informations client...');
        
        const customer = await Customer.findByPk(userId, { transaction });
        if (!customer) {
            console.log('❌ Client non trouvé');
            await transaction.rollback();
            if (isAjaxRequest) {
                return res.status(404).json({
                    success: false,
                    message: 'Informations client non trouvées'
                });
            }
            return res.redirect('/connexion-inscription');
        }

        console.log(`✅ Client récupéré: ${customer.first_name} ${customer.last_name}`);

        // ========================================
        // 💰 ÉTAPE 5: CALCULS FINANCIERS
        // ========================================
        console.log('💰 Calculs financiers...');
        
        // Utiliser votre fonction existante calculateOrderTotals
        const totals = calculateOrderTotals(cartItems, req.session.appliedPromo);
        
        const { subtotal, discountedSubtotal, discount, deliveryFee, total } = totals;
        const promoCodeInfo = req.session.appliedPromo;

        console.log(`💰 === RÉCAPITULATIF FINANCIER ===`);
        console.log(`   📊 Sous-total: ${subtotal.toFixed(2)}€`);
        if (discount > 0) {
            console.log(`   🎫 Réduction: -${discount.toFixed(2)}€`);
            console.log(`   📉 Sous-total après réduction: ${discountedSubtotal.toFixed(2)}€`);
        }
        console.log(`   🚚 Frais de livraison: ${deliveryFee.toFixed(2)}€`);
        console.log(`   💎 Total final: ${total.toFixed(2)}€`);
        console.log(`=====================================`);

        // ========================================
        // 🏗️ ÉTAPE 6: CRÉATION DE LA COMMANDE
        // ========================================
        console.log('🏗️ Création de la commande...');
        
        // Génération du numéro de commande unique
        const orderNumber = generateOrderNumber();
        console.log(`📋 Numéro de commande généré: ${orderNumber}`);

        // Insertion de la commande avec vos colonnes existantes
        const orderQuery = `
            INSERT INTO orders (
                numero_commande, customer_id, subtotal, shipping_price, total,
                promo_code, promo_discount_amount, status, created_at, updated_at,
                shipping_address, shipping_city, shipping_postal_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', NOW(), NOW(), ?, ?, ?)
            RETURNING id
        `;

        const orderValues = [
            orderNumber,
            userId,
            parseFloat(discountedSubtotal.toFixed(2)),
            parseFloat(deliveryFee.toFixed(2)),
            parseFloat(total.toFixed(2)),
            promoCodeInfo?.code || null,
            discount > 0 ? parseFloat(discount.toFixed(2)) : null,
            customer.address || '',
            customer.city || '',
            customer.postal_code || ''
        ];

        const [orderResult] = await sequelize.query(orderQuery, {
            replacements: orderValues,
            transaction
        });

        const orderId = orderResult[0]?.id;
        if (!orderId) {
            throw new Error('Impossible de récupérer l\'ID de la commande créée');
        }

        console.log(`✅ Commande créée avec ID: ${orderId}`);

        // ========================================
        // 📝 ÉTAPE 7: AJOUT DES ARTICLES
        // ========================================
        console.log('📝 Ajout des articles de commande...');
        
        const orderItems = [];
        
        for (const item of cartItems) {
            const itemTotal = item.jewel.price_ttc * item.quantity;
            
            // Insertion de l'article avec vos colonnes existantes
            const itemQuery = `
                INSERT INTO order_items (order_id, jewel_id, quantity, price, size)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await sequelize.query(itemQuery, {
                replacements: [
                    orderId,
                    item.jewel.id,
                    item.quantity,
                    parseFloat(item.jewel.price_ttc.toFixed(2)),
                    item.size || 'Standard'
                ],
                transaction
            });

            // Décrémenter le stock
            await Jewel.decrement('stock', {
                by: item.quantity,
                where: { id: item.jewel.id },
                transaction
            });

            // Préparer les données pour l'email
            orderItems.push({
                jewel: {
                    id: item.jewel.id,
                    name: item.jewel.name,
                    image: item.jewel.image
                },
                quantity: item.quantity,
                size: item.size || 'Standard',
                total: itemTotal
            });

            console.log(`  📦 ${item.jewel.name} x${item.quantity} - ${itemTotal.toFixed(2)}€`);
        }

        console.log(`✅ ${orderItems.length} articles ajoutés à la commande`);

        // ========================================
        // 🎫 ÉTAPE 8: MISE À JOUR DU CODE PROMO
        // ========================================
        if (promoCodeInfo && discount > 0) {
            console.log('🎫 Mise à jour du code promo...');
            
            await sequelize.query(`
                UPDATE promo_codes 
                SET used_count = used_count + 1 
                WHERE code = ?
            `, {
                replacements: [promoCodeInfo.code],
                transaction
            });

            console.log(`✅ Code promo ${promoCodeInfo.code} mis à jour`);
        }

        // ========================================
        // 🧹 ÉTAPE 9: NETTOYAGE
        // ========================================
        console.log('🧹 Nettoyage du panier et session...');
        
        // Vider le panier
        await Cart.destroy({
            where: { customer_id: userId },
            transaction
        });

        // Supprimer le code promo de la session
        if (req.session.appliedPromo) {
            delete req.session.appliedPromo;
        }

        console.log('✅ Panier vidé et session nettoyée');

        // ========================================
        // ✅ ÉTAPE 10: VALIDATION DE LA TRANSACTION
        // ========================================
        await transaction.commit();
        console.log('✅ Transaction validée en base de données');
console.log('🔍 === DÉBOGAGE EMAILS DE COMMANDE ===');
console.log('📧 Point 1: Vérification de l\'import');
console.log('Type de sendOrderConfirmationEmails:', typeof sendOrderConfirmationEmails);
console.log('Fonction disponible:', !!sendOrderConfirmationEmails);

// Juste avant l'appel de sendOrderConfirmationEmails :
console.log('📧 Point 2: Données préparées');
console.log('Email client:', customer.email);
console.log('Nom client:', customer.firstName);
console.log('Données commande:', {
    orderNumber: emailOrderData.orderNumber,
    total: emailOrderData.total,
    items: emailOrderData.items?.length || 0
});
console.log('Données client:', {
    email: emailCustomerData.email,
    firstName: emailCustomerData.firstName
});
        // ========================================
        // 📧 ÉTAPE 11: ENVOI DES EMAILS (CRITIQUE!)
        // ========================================
        console.log('📧 === DÉBUT ENVOI DES EMAILS ===');
        
        try {
            // Préparer les données pour les emails
            const emailOrderData = {
                orderNumber,
                orderId,
                items: orderItems,
                total: total,
                subtotal: discountedSubtotal,
                shipping_price: deliveryFee,
                shippingAddress: {
                    address: customer.address || '',
                    city: customer.city || '',
                    postal_code: customer.postal_code || ''
                },
                promo_code: promoCodeInfo?.code || null,
                promo_discount_amount: discount || 0
            };

            const emailCustomerData = {
                firstName: customer.first_name,
                lastName: customer.last_name,
                email: customer.email,
                phone: customer.phone,
                address: {
                    address: customer.address || '',
                    city: customer.city || '',
                    postal_code: customer.postal_code || ''
                }
            };

            console.log('📧 Données préparées pour les emails:', {
                orderNumber,
                customerEmail: customer.email,
                total: total,
                itemsCount: orderItems.length
            });

            // 🚀 ENVOI DES EMAILS (FONCTION IMPORTÉE)
            const emailResults = await sendOrderConfirmationEmails(
                customer.email,
                customer.first_name,
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
            console.error('❌ ERREUR CRITIQUE lors de l\'envoi des emails:', emailError);
            console.error('Stack trace:', emailError.stack);
            // On continue - la commande est créée même si l'email échoue
        }

        console.log('📧 === FIN ENVOI DES EMAILS ===');

        // ========================================
        // 🎉 ÉTAPE 12: RÉPONSE FINALE
        // ========================================
        console.log('🎉 === COMMANDE CRÉÉE AVEC SUCCÈS ===');
        console.log(`   📋 Numéro: ${orderNumber}`);
        console.log(`   💰 Montant: ${total.toFixed(2)}€`);
        if (promoCodeInfo) {
            console.log(`   🎫 Code promo: ${promoCodeInfo.code} (-${discount.toFixed(2)}€)`);
        }
        console.log(`   👤 Client: ${customer.first_name} ${customer.last_name}`);
        console.log(`   📧 Email: ${customer.email}`);
        console.log('=====================================');

        const successMessage = promoCodeInfo 
            ? `Commande ${orderNumber} créée avec succès ! Code promo ${promoCodeInfo.code} appliqué (-${discount.toFixed(2)}€). Un email de confirmation vous a été envoyé.`
            : `Commande ${orderNumber} créée avec succès ! Un email de confirmation vous a été envoyé.`;

        if (isAjaxRequest) {
            return res.status(200).json({
                success: true,
                message: successMessage,
                order: {
                    numero: orderNumber,
                    id: orderId,
                    total: total,
                    customer_email: customer.email
                },
                redirectUrl: `/commande/confirmation?orderNumber=${encodeURIComponent(orderNumber)}`
            });
        } else {
            req.flash('success', successMessage);
            return res.redirect(`/commande/confirmation?orderNumber=${encodeURIComponent(orderNumber)}`);
        }

    } catch (error) {
        // ========================================
        // ❌ GESTION DES ERREURS
        // ========================================
        console.error('💥 === ERREUR LORS DE LA CRÉATION DE COMMANDE ===');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('===============================================');
        
        // Rollback de la transaction si elle n'est pas encore committée
        try {
            await transaction.rollback();
            console.log('🔄 Transaction annulée (ROLLBACK effectué)');
        } catch (rollbackError) {
            console.error('❌ Erreur lors du ROLLBACK:', rollbackError.message);
        }
        
        const errorMessage = error.message || 'Une erreur inattendue est survenue lors de la création de votre commande';
        
        if (isAjaxRequest) {
            return res.status(500).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } else {
            req.flash('error', `Erreur lors de la création de la commande: ${errorMessage}`);
            return res.redirect('/panier');
        }
        
    } finally {
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

      console.log('🎫 Tentative d\'application du code:', code);

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

      const cleanCode = code.trim().toUpperCase();

      if (req.session.appliedPromo) {
        return res.status(400).json({
          success: false,
          message: 'Un code promo est déjà appliqué. Veuillez le retirer avant d\'en appliquer un nouveau.'
        });
      }

      // ✅ RECHERCHER LE CODE PROMO avec la méthode statique
      const promoCode = await PromoCode.findValidByCode(cleanCode);

      if (!promoCode) {
        console.log('❌ Code promo non trouvé ou invalide:', cleanCode);
        return res.status(404).json({
          success: false,
          message: 'Code promo invalide ou expiré'
        });
      }

      console.log('✅ Code promo trouvé:', {
        code: promoCode.code,
        type: promoCode.discount_type,
        value: promoCode.effectiveDiscountValue,
        used: promoCode.used_count,
        limit: promoCode.effectiveUsageLimit
      });

      // Vérifier le panier
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

      const subtotal = cartItems.reduce((total, item) => 
        total + (parseFloat(item.jewel.price_ttc) * item.quantity), 0);

      console.log('💰 Sous-total du panier:', subtotal);

      // Vérifier si le code peut être utilisé pour ce montant
      if (!promoCode.canBeUsedFor(subtotal)) {
        const minAmount = promoCode.min_order_amount || 0;
        return res.status(400).json({
          success: false,
          message: `Montant minimum de ${minAmount}€ requis pour ce code promo`
        });
      }

      // Calculer la réduction
      const discount = promoCode.calculateDiscount(subtotal);
      console.log('💸 Réduction calculée:', discount);

      // ✅ STOCKER EN SESSION avec structure unifiée
      req.session.appliedPromo = {
        id: promoCode.id,
        code: promoCode.code,
        type: promoCode.discount_type,
        discountPercent: promoCode.discount_type === 'percentage' ? promoCode.effectiveDiscountValue : 0,
        discountAmount: promoCode.discount_type === 'fixed' ? promoCode.effectiveDiscountValue : 0,
        calculatedDiscount: discount,
        originalData: {
          discount_value: promoCode.discount_value,
          discount_percent: promoCode.discount_percent,
          discount_type: promoCode.discount_type,
          min_order_amount: promoCode.min_order_amount
        }
      };

      console.log('✅ Code promo appliqué en session:', req.session.appliedPromo);

      res.json({
        success: true,
        message: `Code "${cleanCode}" appliqué ! Réduction de ${promoCode.effectiveDiscountValue}${promoCode.discount_type === 'percentage' ? '%' : '€'}`,
        discount: discount,
        discountType: promoCode.discount_type,
        code: promoCode.code
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

  // ✅ FONCTION CORRIGÉE calculateOrderTotals
  calculateOrderTotals(cartItems, appliedPromo = null) {
    let subtotal = 0;
    
    cartItems.forEach(item => {
      const price = parseFloat(item.jewel.price_ttc) || 0;
      const quantity = parseInt(item.quantity) || 0;
      const itemTotal = price * quantity;
      
      item.itemTotal = Math.round(itemTotal * 100) / 100;
      subtotal += itemTotal;
    });
    
    subtotal = Math.round(subtotal * 100) / 100;
    console.log('📊 Sous-total calculé:', subtotal);
    
    let discount = 0;
    let discountedSubtotal = subtotal;
    
    if (appliedPromo) {
      // ✅ Utiliser la réduction pré-calculée ou la calculer
      if (appliedPromo.calculatedDiscount) {
        discount = appliedPromo.calculatedDiscount;
      } else {
        // Calculer selon le type
        if (appliedPromo.type === 'percentage' && appliedPromo.discountPercent) {
          discount = Math.round((subtotal * appliedPromo.discountPercent / 100) * 100) / 100;
        } else if (appliedPromo.type === 'fixed' && appliedPromo.discountAmount) {
          discount = Math.min(appliedPromo.discountAmount, subtotal);
        }
      }
      
      discountedSubtotal = Math.max(0, subtotal - discount);
      console.log(`💰 Code promo ${appliedPromo.code}: -${discount}€`);
    }
    
    const deliveryFee = discountedSubtotal >= 50 ? 0 : 5.99;
    const finalTotal = Math.round((discountedSubtotal + deliveryFee) * 100) / 100;
    
    return {
      subtotal,
      discount,
      discountedSubtotal,
      deliveryFee,
      finalTotal,
      appliedPromo
    };
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
            console.log('🛒 Accès récapitulatif commande avec tailles');
            
            // Support des utilisateurs connectés ET invités
            const userId = req.session?.user?.id || req.session?.customerId;
            const isGuest = !req.session?.user && !req.session?.customerId;
            
            let cartItems = [];
            
            if (userId) {
                // ✅ RÉCUPÉRATION DEPUIS BDD AVEC TAILLES
                const dbCartItems = await Cart.findAll({
                    where: { customer_id: userId },
                    include: [{ 
                        model: Jewel, 
                        as: 'jewel', 
                        required: true,
                        attributes: ['id', 'name', 'description', 'price_ttc', 'image', 'slug', 'tailles', 'stock', 'matiere', 'carat', 'poids']
                    }],
                    // ✅ INCLURE LA COLONNE SIZE que vous avez ajoutée
                    attributes: ['id', 'customer_id', 'jewel_id', 'quantity', 'size', 'added_at']
                });
                
                cartItems = dbCartItems.map(item => {
                    const jewelData = item.jewel.toJSON();
                    
                    // Parser les tailles disponibles du bijou
                    if (typeof jewelData.tailles === 'string') {
                        try {
                            jewelData.tailles = JSON.parse(jewelData.tailles);
                        } catch (error) {
                            jewelData.tailles = [];
                        }
                    }
                    if (!Array.isArray(jewelData.tailles)) {
                        jewelData.tailles = [];
                    }
                    
                    const quantity = parseInt(item.quantity) || 1;
                    const price = parseFloat(jewelData.price_ttc) || 0;
                    const itemTotal = price * quantity;

                    return {
                        id: item.id,
                        jewelId: jewelData.id,
                        jewel: jewelData,
                        quantity: quantity,
                        price: price,
                        itemTotal: itemTotal,
                        size: item.size // ✅ TAILLE SÉLECTIONNÉE DEPUIS LA BDD
                    };
                });
                
            } else {
                // ✅ RÉCUPÉRATION DEPUIS SESSION AVEC TAILLES
                const sessionCart = req.session.cart || { items: [] };
                
                for (const item of sessionCart.items) {
                    if (item.jewel && item.jewel.id) {
                        const currentJewel = await Jewel.findByPk(item.jewel.id, {
                            attributes: ['id', 'name', 'description', 'price_ttc', 'image', 'slug', 'tailles', 'stock', 'matiere', 'carat', 'poids']
                        });
                        
                        if (currentJewel) {
                            const jewelData = currentJewel.toJSON();
                            
                            // Parser les tailles
                            if (typeof jewelData.tailles === 'string') {
                                try {
                                    jewelData.tailles = JSON.parse(jewelData.tailles);
                                } catch (error) {
                                    jewelData.tailles = [];
                                }
                            }
                            if (!Array.isArray(jewelData.tailles)) {
                                jewelData.tailles = [];
                            }
                            
                            const quantity = Math.min(parseInt(item.quantity) || 1, currentJewel.stock);
                            const price = parseFloat(jewelData.price_ttc) || 0;
                            const itemTotal = price * quantity;

                            cartItems.push({
                                jewelId: jewelData.id,
                                jewel: jewelData,
                                quantity: quantity,
                                price: price,
                                itemTotal: itemTotal,
                                size: item.size // ✅ TAILLE DEPUIS LA SESSION
                            });
                        }
                    }
                }
            }
            
            console.log(`📦 Articles trouvés: ${cartItems.length}`);
            
            if (cartItems.length === 0) {
                req.flash('error', 'Votre panier est vide. Ajoutez des articles avant de continuer.');
                return res.redirect('/panier');
            }
            
            // ✅ RÉCUPÉRER LE CODE PROMO (VOTRE LOGIQUE EXISTANTE)
            const appliedPromo = req.session.appliedPromo || null;
            
            // ✅ CALCULS AVEC VOTRE FONCTION EXISTANTE
            const totals = calculateOrderTotals(cartItems, appliedPromo);
            
            // ✅ DONNÉES POUR LE TEMPLATE (compatibles avec votre vue cart)
            const templateData = {
                title: 'Récapitulatif de commande',
                
                // 🛒 STRUCTURE CART (format de votre vue panier)
                cart: {
                    items: cartItems,
                    totalPrice: totals.subtotal
                },
                
                // 📦 Variables individuelles (compatibilité)
                cartItems: cartItems,
                totalPrice: totals.subtotal.toFixed(2),
                
                // 💰 Totaux financiers (noms identiques à votre cart)
                subtotal: totals.subtotal,
                discount: totals.discount,
                discountedSubtotal: totals.discountedSubtotal,
                shippingFee: totals.deliveryFee,
                deliveryFee: totals.deliveryFee, // Alias
                finalTotal: totals.finalTotal,
                
                // 🎫 Code promo (format identique)
                appliedPromo: totals.appliedPromo ? {
                    code: totals.appliedPromo.code,
                    discountPercent: parseFloat(totals.appliedPromo.discountPercent)
                } : null,
                
                // 👤 Utilisateur
                user: req.session.user || null,
                isAuthenticated: !!req.session.user,
                isGuest: isGuest,
                
                // 🎯 Autres données nécessaires
                currentYear: new Date().getFullYear(),
                recommendations: [] // Vide pour le moment
            };

            console.log('📄 Rendu template summary avec structure cart identique');
            
            // ✅ UTILISER LA VUE SUMMARY (qui aura la même structure que cart)
            res.render('summary', templateData);
            
        } catch (error) {
            console.error('❌ Erreur renderOrderSummary:', error);
            req.flash('error', 'Erreur lors du chargement du récapitulatif');
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



async renderCustomerForm(req, res) {
        try {
            console.log('📝 Formulaire informations client');
            
            if (!req.session?.user) {
                return res.redirect('/connexion-inscription');
            }

            const userId = req.session.user.id || req.session.customerId;
            
            // ✅ MÊME LOGIQUE QUE renderOrderSummary pour les données
            const cartItems = await Cart.findAll({
                where: { customer_id: userId },
                include: [{ 
                    model: Jewel, 
                    as: 'jewel', 
                    required: true,
                    attributes: ['id', 'name', 'description', 'price_ttc', 'image', 'slug', 'tailles', 'stock', 'matiere', 'carat', 'poids']
                }],
                attributes: ['id', 'customer_id', 'jewel_id', 'quantity', 'size', 'added_at']
            });
            
            if (cartItems.length === 0) {
                req.flash('error', 'Votre panier est vide. Ajoutez des articles avant de continuer.');
                return res.redirect('/panier');
            }
            
            // Traitement identique des articles avec tailles
            const processedCartItems = cartItems.map(item => {
                const jewelData = item.jewel.toJSON();
                
                // Parser tailles
                if (typeof jewelData.tailles === 'string') {
                    try {
                        jewelData.tailles = JSON.parse(jewelData.tailles);
                    } catch (error) {
                        jewelData.tailles = [];
                    }
                }
                if (!Array.isArray(jewelData.tailles)) {
                    jewelData.tailles = [];
                }
                
                const quantity = parseInt(item.quantity) || 1;
                const price = parseFloat(jewelData.price_ttc) || 0;
                const itemTotal = price * quantity;
                
                return {
                    id: item.id,
                    jewelId: jewelData.id,
                    jewel: jewelData,
                    quantity: quantity,
                    price: price,
                    itemTotal: itemTotal,
                    size: item.size // ✅ CONSERVER LA TAILLE
                };
            });
            
            // Calculs avec code promo
            const appliedPromo = req.session.appliedPromo || null;
            const totals = calculateOrderTotals(processedCartItems, appliedPromo);

            // ✅ DONNÉES IDENTIQUES AU RÉCAPITULATIF + infos client
            const templateData = {
                title: 'Informations de livraison',
                
                // Structure cart identique
                cart: {
                    items: processedCartItems,
                    totalPrice: totals.subtotal
                },
                cartItems: processedCartItems,
                totalPrice: totals.subtotal.toFixed(2),
                
                // Totaux identiques
                subtotal: totals.subtotal,
                discount: totals.discount,
                discountedSubtotal: totals.discountedSubtotal,
                shippingFee: totals.deliveryFee,
                deliveryFee: totals.deliveryFee,
                finalTotal: totals.finalTotal,
                
                // Code promo identique
                appliedPromo: totals.appliedPromo ? {
                    code: totals.appliedPromo.code,
                    discountPercent: parseFloat(totals.appliedPromo.discountPercent)
                } : null,
                
                // Utilisateur + préremplissage
                user: req.session.user,
                isAuthenticated: true,
                customerInfo: req.session.customerInfo || {
                    firstName: req.session.user.first_name || '',
                    lastName: req.session.user.last_name || '',
                    email: req.session.user.email || '',
                    phone: req.session.user.phone || '',
                    address: req.session.user.address || ''
                },
                
                currentYear: new Date().getFullYear(),
                recommendations: []
            };

            // ✅ MÊME VUE SUMMARY mais avec des données enrichies pour le formulaire
            res.render('summary', templateData);
            
        } catch (error) {
            console.error('❌ Erreur formulaire client:', error);
            req.flash('error', 'Erreur lors du chargement du formulaire');
            res.redirect('/panier');
        }
    },

 async renderPaymentDynamicPage(req, res) {
        try {
            return await this.renderOrderSummary(req, res);
        } catch (error) {
            console.error('❌ Erreur renderPaymentDynamicPage:', error);
            res.redirect('/panier');
        }
    },

    async renderPaymentPage(req, res) {
        try {
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


/**
 * ✅ FONCTION PRINCIPALE - Création et validation de commande avec emails
 */
async createOrder(req, res) {
    const transaction = await sequelize.transaction();
    
    const isAjaxRequest = req.headers['content-type'] === 'application/json' || 
                         req.headers.accept?.includes('application/json') ||
                         req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    console.log('🛒 === DÉBUT CRÉATION COMMANDE ===');
    console.log('📱 Type de requête:', isAjaxRequest ? 'AJAX' : 'Standard');
    
    try {
        // ========================================
        // 🔐 ÉTAPE 1: VÉRIFICATION UTILISATEUR
        // ========================================
        if (!req.session?.user?.id) {
            console.log('❌ Utilisateur non connecté');
            if (isAjaxRequest) {
                return res.status(401).json({
                    success: false,
                    message: 'Vous devez être connecté pour passer commande'
                });
            }
            return res.redirect('/connexion-inscription');
        }

        const userId = req.session.user.id;
        console.log(`👤 Utilisateur connecté: ID ${userId}`);

        // ========================================
        // 🛒 ÉTAPE 2: RÉCUPÉRATION DU PANIER
        // ========================================
        console.log('🛒 Récupération du panier...');
        
        const cartItems = await Cart.findAll({
            where: { customer_id: userId },
            include: [{
                model: Jewel,
                as: 'jewel',
                required: true,
                attributes: ['id', 'name', 'price_ttc', 'stock', 'image']
            }],
            transaction
        });

        if (cartItems.length === 0) {
            console.log('❌ Panier vide');
            if (isAjaxRequest) {
                return res.status(400).json({
                    success: false,
                    message: 'Votre panier est vide'
                });
            }
            req.flash('error', 'Votre panier est vide');
            return res.redirect('/panier');
        }

        console.log(`✅ Panier récupéré: ${cartItems.length} articles`);

        // ========================================
        // 📦 ÉTAPE 3: VÉRIFICATION DU STOCK
        // ========================================
        console.log('📦 Vérification du stock...');
        
        for (const item of cartItems) {
            if (item.jewel.stock < item.quantity) {
                console.log(`❌ Stock insuffisant pour ${item.jewel.name}: demandé ${item.quantity}, disponible ${item.jewel.stock}`);
                if (isAjaxRequest) {
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuffisant pour ${item.jewel.name}. Quantité disponible: ${item.jewel.stock}`
                    });
                }
                req.flash('error', `Stock insuffisant pour ${item.jewel.name}`);
                return res.redirect('/panier');
            }
        }

        console.log('✅ Stock vérifié pour tous les articles');

        // ========================================
        // 👤 ÉTAPE 4: RÉCUPÉRATION DES INFOS CLIENT
        // ========================================
        console.log('👤 Récupération des informations client...');
        
        const customer = await Customer.findByPk(userId, { transaction });
        if (!customer) {
            console.log('❌ Client non trouvé');
            if (isAjaxRequest) {
                return res.status(404).json({
                    success: false,
                    message: 'Informations client non trouvées'
                });
            }
            return res.redirect('/connexion-inscription');
        }

        // Vérifier que les informations requises sont présentes
        if (!customer.first_name || !customer.last_name || !customer.email || !customer.address) {
            console.log('❌ Informations client incomplètes');
            if (isAjaxRequest) {
                return res.status(400).json({
                    success: false,
                    message: 'Veuillez compléter vos informations de livraison'
                });
            }
            req.flash('error', 'Veuillez compléter vos informations de livraison');
            return res.redirect('/commande/informations');
        }

        console.log(`✅ Client récupéré: ${customer.first_name} ${customer.last_name}`);

        // ========================================
        // 💰 ÉTAPE 5: CALCULS FINANCIERS
        // ========================================
        console.log('💰 Calculs financiers...');
        
        // Calcul du sous-total
        const subtotal = cartItems.reduce((sum, item) => {
            return sum + (item.jewel.price_ttc * item.quantity);
        }, 0);
        
        console.log(`💰 Sous-total calculé: ${subtotal.toFixed(2)}€`);

        // Gestion des codes promo
        let promoCodeData = null;
        let discount = 0;
        let finalSubtotal = subtotal;

        if (req.session.appliedPromo) {
            console.log('🎫 Application du code promo...');
            
            const promoCode = await PromoCode.findValidByCode(req.session.appliedPromo.code);
            if (promoCode && promoCode.isUsable()) {
                promoCodeData = {
                    code: promoCode.code,
                    discount_type: promoCode.discount_type,
                    discount_value: promoCode.discount_value
                };

                // Calcul de la réduction
                if (promoCode.discount_type === 'percentage') {
                    discount = (subtotal * promoCode.discount_value) / 100;
                } else {
                    discount = Math.min(promoCode.discount_value, subtotal);
                }
                
                finalSubtotal = subtotal - discount;
                console.log(`🎫 Code promo appliqué: ${promoCode.code} (-${discount.toFixed(2)}€)`);
            } else {
                console.log('❌ Code promo invalide ou expiré');
                delete req.session.appliedPromo;
            }
        }

        // Frais de livraison
        const shippingFee = finalSubtotal >= 50 ? 0 : 5.99;
        const finalTotal = finalSubtotal + shippingFee;

        console.log(`💰 === RÉCAPITULATIF FINANCIER ===`);
        console.log(`   📊 Sous-total: ${subtotal.toFixed(2)}€`);
        if (discount > 0) {
            console.log(`   🎫 Réduction: -${discount.toFixed(2)}€`);
            console.log(`   📉 Sous-total après réduction: ${finalSubtotal.toFixed(2)}€`);
        }
        console.log(`   🚚 Frais de livraison: ${shippingFee.toFixed(2)}€`);
        console.log(`   💎 Total final: ${finalTotal.toFixed(2)}€`);
        console.log(`=====================================`);

        // ========================================
        // 🏗️ ÉTAPE 6: CRÉATION DE LA COMMANDE
        // ========================================
        console.log('🏗️ Création de la commande...');
        
        // Génération du numéro de commande unique
        const orderNumber = generateOrderNumber();
        console.log(`📋 Numéro de commande généré: ${orderNumber}`);

        // Insertion de la commande
        const orderQuery = `
            INSERT INTO orders (
                numero_commande, customer_id, subtotal, shipping_price, total,
                promo_code, promo_discount_amount, status, created_at, updated_at,
                shipping_address, shipping_city, shipping_postal_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', NOW(), NOW(), ?, ?, ?)
        `;

        const orderValues = [
            orderNumber,
            userId,
            parseFloat(finalSubtotal.toFixed(2)),
            parseFloat(shippingFee.toFixed(2)),
            parseFloat(finalTotal.toFixed(2)),
            promoCodeData?.code || null,
            discount > 0 ? parseFloat(discount.toFixed(2)) : null,
            customer.address,
            customer.city,
            customer.postal_code
        ];

        const [orderResult] = await sequelize.query(orderQuery, {
            replacements: orderValues,
            transaction
        });

        const orderId = orderResult.insertId || orderResult[0]?.id;
        if (!orderId) {
            throw new Error('Impossible de récupérer l\'ID de la commande créée');
        }

        console.log(`✅ Commande créée avec ID: ${orderId}`);

        // ========================================
        // 📝 ÉTAPE 7: AJOUT DES ARTICLES
        // ========================================
        console.log('📝 Ajout des articles de commande...');
        
        const orderItems = [];
        
        for (const item of cartItems) {
            const itemTotal = item.jewel.price_ttc * item.quantity;
            
            // Insertion de l'article
            const itemQuery = `
                INSERT INTO order_items (order_id, jewel_id, quantity, price, size)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await sequelize.query(itemQuery, {
                replacements: [
                    orderId,
                    item.jewel.id,
                    item.quantity,
                    parseFloat(item.jewel.price_ttc.toFixed(2)),
                    item.size || 'Standard'
                ],
                transaction
            });

            // Décrémenter le stock
            await Jewel.decrement('stock', {
                by: item.quantity,
                where: { id: item.jewel.id },
                transaction
            });

            // Préparer les données pour l'email
            orderItems.push({
                jewel: {
                    id: item.jewel.id,
                    name: item.jewel.name,
                    image: item.jewel.image
                },
                quantity: item.quantity,
                size: item.size || 'Standard',
                total: itemTotal
            });

            console.log(`  📦 ${item.jewel.name} x${item.quantity} - ${itemTotal.toFixed(2)}€`);
        }

        console.log(`✅ ${orderItems.length} articles ajoutés à la commande`);

        // ========================================
        // 🎫 ÉTAPE 8: MISE À JOUR DU CODE PROMO
        // ========================================
        if (promoCodeData && discount > 0) {
            console.log('🎫 Mise à jour du code promo...');
            
            await sequelize.query(`
                UPDATE promo_codes 
                SET used_count = used_count + 1 
                WHERE code = ?
            `, {
                replacements: [promoCodeData.code],
                transaction
            });

            console.log(`✅ Code promo ${promoCodeData.code} mis à jour`);
        }

        // ========================================
        // 🧹 ÉTAPE 9: NETTOYAGE
        // ========================================
        console.log('🧹 Nettoyage du panier et session...');
        
        // Vider le panier
        await Cart.destroy({
            where: { customer_id: userId },
            transaction
        });

        // Supprimer le code promo de la session
        if (req.session.appliedPromo) {
            delete req.session.appliedPromo;
        }

        console.log('✅ Panier vidé et session nettoyée');

        // ========================================
        // 📧 ÉTAPE 10: ENVOI DES EMAILS
        // ========================================
        console.log('📧 Préparation et envoi des emails...');
        
        // Préparer les données pour les emails
        const emailOrderData = {
            orderNumber,
            orderId,
            items: orderItems,
            total: finalTotal,
            subtotal: finalSubtotal,
            shipping_price: shippingFee,
            shippingAddress: {
                address: customer.address,
                city: customer.city,
                postal_code: customer.postal_code
            },
            promo_code: promoCodeData?.code || null,
            promo_discount_amount: discount || 0
        };

        const emailCustomerData = {
            firstName: customer.first_name,
            lastName: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            address: {
                address: customer.address,
                city: customer.city,
                postal_code: customer.postal_code
            }
        };

        // Valider la transaction AVANT l'envoi des emails
        await transaction.commit();
        console.log('✅ Transaction validée en base de données');

        // Envoi des emails (après commit pour éviter les rollbacks liés aux emails)
        try {
            const emailResults = await sendOrderConfirmationEmails(
                customer.email,
                customer.first_name,
                emailOrderData,
                emailCustomerData
            );
            
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
            console.error('❌ Erreur lors de l\'envoi des emails:', emailError);
            // On continue - la commande est créée même si l'email échoue
        }

        // ========================================
        // 🎉 ÉTAPE 11: RÉPONSE FINALE
        // ========================================
        console.log('🎉 === COMMANDE CRÉÉE AVEC SUCCÈS ===');
        console.log(`   📋 Numéro: ${orderNumber}`);
        console.log(`   💰 Montant: ${finalTotal.toFixed(2)}€`);
        if (promoCodeData) {
            console.log(`   🎫 Code promo: ${promoCodeData.code} (-${discount.toFixed(2)}€)`);
        }
        console.log(`   👤 Client: ${customer.first_name} ${customer.last_name}`);
        console.log(`   📧 Email: ${customer.email}`);
        console.log('=====================================');

        const successMessage = promoCodeData 
            ? `Commande ${orderNumber} créée avec succès ! Code promo ${promoCodeData.code} appliqué (-${discount.toFixed(2)}€). Un email de confirmation vous a été envoyé.`
            : `Commande ${orderNumber} créée avec succès ! Un email de confirmation vous a été envoyé.`;

        if (isAjaxRequest) {
            return res.status(200).json({
                success: true,
                message: successMessage,
                orderNumber: orderNumber,
                total: finalTotal,
                discount: discount,
                redirectUrl: `/commande/confirmation?orderNumber=${encodeURIComponent(orderNumber)}`
            });
        } else {
            req.flash('success', successMessage);
            return res.redirect(`/commande/confirmation?orderNumber=${encodeURIComponent(orderNumber)}`);
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
            await transaction.rollback();
            console.log('🔄 Transaction annulée (ROLLBACK effectué)');
        } catch (rollbackError) {
            console.error('❌ Erreur lors du ROLLBACK:', rollbackError.message);
        }
        
        const errorMessage = error.message || 'Une erreur inattendue est survenue lors de la création de votre commande';
        
        if (isAjaxRequest) {
            return res.status(500).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } else {
            req.flash('error', `Erreur lors de la création de la commande: ${errorMessage}`);
            return res.redirect('/panier');
        }
        
    } finally {
        console.log('🏁 === FIN DE createOrder ===');
    }
}

// ========================================
// 🔧 FONCTIONS UTILITAIRES
// ========================================


 
};