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
async validateOrderAndSave(req, res) {
    // ✅ UTILISER SEQUELIZE TRANSACTION au lieu de PostgreSQL manuel
    const transaction = await sequelize.transaction();
    
    const isAjaxRequest = req.headers['content-type'] === 'application/json' || 
                         req.headers.accept?.includes('application/json') ||
                         req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    console.log('🔍 === DÉBUT VALIDATION COMMANDE ===');
    console.log('📱 Type de requête:', isAjaxRequest ? 'AJAX' : 'Formulaire HTML');
    
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
            }],
            transaction
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
        // 📊 ÉTAPE 4: CALCULS INITIAUX ET VÉRIFICATIONS STOCK
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
                size: item.size || 'Standard',
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

        // ========================================
        // 🎫 ÉTAPE 5: GESTION DU CODE PROMO AVEC DEBUG AVANCÉ
        // ========================================
        console.log('🎫 === GESTION DU CODE PROMO AVEC DEBUG ===');

        let promoCodeInfo = null;
        let calculatedDiscount = 0;
        let originalSubtotal = subtotal;
        let discountedSubtotal = subtotal;

        // ✅ DEBUG COMPLET DE LA SESSION
        console.log('🔍 DEBUG SESSION COMPLÈTE:');
        console.log('   req.session.appliedPromo:', JSON.stringify(req.session.appliedPromo, null, 2));
        console.log('   req.session.user?.id:', req.session.user?.id);
        console.log('   Toutes les clés de session:', Object.keys(req.session));

        const appliedPromo = req.session.appliedPromo;
        if (appliedPromo && appliedPromo.id) {
            try {
                console.log('🎫 Code promo trouvé en session:', appliedPromo);
                console.log('   ID du code promo:', appliedPromo.id);
                console.log('   Code:', appliedPromo.code);
                
                // ✅ CHERCHER LE CODE PROMO EN BASE
                console.log('🔍 Recherche du code promo en base...');
                const promoCode = await PromoCode.findByPk(appliedPromo.id, { transaction });
                
                console.log('📋 Résultat de la recherche:', promoCode ? 'TROUVÉ' : 'NON TROUVÉ');
                
                if (promoCode) {
                    console.log('🔍 Détails du code promo trouvé:', {
                        id: promoCode.id,
                        code: promoCode.code,
                        discount_type: promoCode.discount_type,
                        discount_value: promoCode.discount_value,
                        is_active: promoCode.is_active,
                        expires_at: promoCode.expires_at,
                        used_count: promoCode.used_count,
                        max_uses: promoCode.max_uses,
                        usage_limit: promoCode.usage_limit
                    });
                    
                    // ✅ VÉRIFIER LA VALIDITÉ ÉTAPE PAR ÉTAPE
                    console.log('🔍 Vérification de validité:');
                    
                    // Test 1: Code actif
                    const isActive = promoCode.is_active;
                    console.log(`   ✓ Actif: ${isActive}`);
                    
                    // Test 2: Date d'expiration
                    const isNotExpired = !promoCode.expires_at || new Date() <= new Date(promoCode.expires_at);
                    console.log(`   ✓ Non expiré: ${isNotExpired} (expire le: ${promoCode.expires_at || 'jamais'})`);
                    
                    // Test 3: Limite d'usage
                    const effectiveLimit = promoCode.max_uses || promoCode.usage_limit;
                    const hasUsageLeft = !effectiveLimit || promoCode.used_count < effectiveLimit;
                    console.log(`   ✓ Usage disponible: ${hasUsageLeft} (${promoCode.used_count}/${effectiveLimit || '∞'})`);
                    
                    // Test 4: Montant minimum
                    const meetMinAmount = !promoCode.min_order_amount || subtotal >= promoCode.min_order_amount;
                    console.log(`   ✓ Montant minimum: ${meetMinAmount} (besoin: ${promoCode.min_order_amount || 0}€, panier: ${subtotal}€)`);
                    
                    const isValid = isActive && isNotExpired && hasUsageLeft && meetMinAmount;
                    console.log(`🎯 CODE VALIDE: ${isValid}`);

                    if (isValid) {
                        // ✅ CALCULER LA RÉDUCTION
                        console.log('💰 Calcul de la réduction...');
                        
                        if (promoCode.discount_type === 'percentage') {
                            calculatedDiscount = Math.round((subtotal * promoCode.discount_value / 100) * 100) / 100;
                            console.log(`   Réduction pourcentage: ${subtotal}€ × ${promoCode.discount_value}% = ${calculatedDiscount}€`);
                        } else if (promoCode.discount_type === 'fixed') {
                            calculatedDiscount = Math.min(promoCode.discount_value, subtotal);
                            console.log(`   Réduction fixe: min(${promoCode.discount_value}€, ${subtotal}€) = ${calculatedDiscount}€`);
                        }
                        
                        discountedSubtotal = Math.max(0, subtotal - calculatedDiscount);
                        
                        // ✅ CRÉER L'OBJET promoCodeInfo AVEC TOUTES LES DONNÉES
                        promoCodeInfo = {
                            id: promoCode.id,
                            code: promoCode.code,
                            discount_amount: calculatedDiscount,
                            discount_percent: promoCode.discount_type === 'percentage' ? promoCode.discount_value : null,
                            discount_type: promoCode.discount_type,
                            discount_value: promoCode.discount_value,
                            original_amount: subtotal
                        };
                        
                        console.log(`✅ Code promo ${promoCode.code} validé et configuré:`);
                        console.log(`   📊 Sous-total original: ${subtotal.toFixed(2)}€`);
                        console.log(`   💰 Réduction: ${calculatedDiscount.toFixed(2)}€`);
                        console.log(`   📉 Sous-total après réduction: ${discountedSubtotal.toFixed(2)}€`);
                        console.log(`   🎫 PromoCodeInfo créé:`, promoCodeInfo);
                        
                    } else {
                        console.log('❌ Code promo invalide - Nettoyage de la session');
                        req.session.appliedPromo = null;
                        
                        // ✅ DÉTAILS DES ÉCHECS
                        if (!isActive) console.log('   ❌ Échec: Code inactif');
                        if (!isNotExpired) console.log('   ❌ Échec: Code expiré');
                        if (!hasUsageLeft) console.log('   ❌ Échec: Limite d\'usage atteinte');
                        if (!meetMinAmount) console.log('   ❌ Échec: Montant minimum non atteint');
                    }
                } else {
                    console.log('❌ Code promo non trouvé en base avec ID:', appliedPromo.id);
                    req.session.appliedPromo = null;
                }
                
            } catch (error) {
                console.error('❌ Erreur validation code promo:', error);
                console.error('   Stack:', error.stack);
                req.session.appliedPromo = null;
            }
        } else {
            console.log('ℹ️ Aucun code promo appliqué en session');
        }

        // ✅ RÉSUMÉ FINAL DU CODE PROMO
        console.log('🎯 === RÉSUMÉ FINAL CODE PROMO ===');
        console.log('   Code promo validé:', !!promoCodeInfo);
        console.log('   Code:', promoCodeInfo?.code || 'Aucun');
        console.log('   Réduction:', calculatedDiscount || 0);
        console.log('   Sous-total original:', originalSubtotal);
        console.log('   Sous-total après réduction:', discountedSubtotal);
        console.log('================================');

        // ========================================
        // 🚚 ÉTAPE 6: CALCUL FINAL DES FRAIS DE LIVRAISON
        // ========================================
        const deliveryFee = discountedSubtotal >= 50 ? 0 : 5.99;
        const finalTotal = discountedSubtotal + deliveryFee;
        
        console.log(`💰 === RÉCAPITULATIF FINANCIER ===`);
        console.log(`   📊 Sous-total original: ${originalSubtotal.toFixed(2)}€`);
        if (calculatedDiscount > 0) {
            console.log(`   🎫 Code promo (${promoCodeInfo.code}): -${calculatedDiscount.toFixed(2)}€`);
            console.log(`   📉 Sous-total après réduction: ${discountedSubtotal.toFixed(2)}€`);
        }
        console.log(`   🚚 Frais de livraison: ${deliveryFee.toFixed(2)}€`);
        console.log(`   💎 Total final: ${finalTotal.toFixed(2)}€`);

        // ========================================
        // 🏗️ ÉTAPE 7: CRÉATION DE LA COMMANDE AVEC TYPES CORRIGÉS
        // ========================================
        console.log('🏗️ Création de la commande avec SQL brut (types corrigés)...');

        // Génération du numéro de commande unique
        const orderNumber = orderController.generateOrderNumber();
        console.log('📋 Numéro de commande généré:', orderNumber);

        // ✅ RÉCUPÉRER L'INSTANCE SEQUELIZE
        const sequelize = PromoCode.sequelize || Order.sequelize || Cart.sequelize;

        // ✅ PRÉPARER LES DONNÉES AVEC LES BONS TYPES
        console.log('🔧 Préparation des données avec conversion de types...');

        const promoDiscountPercent = promoCodeInfo?.discount_type === 'percentage' 
            ? Math.round(parseFloat(promoCodeInfo.discount_value) || 0)
            : null;

        const promoDiscountAmount = parseFloat(calculatedDiscount) || 0;

        console.log('📋 Données codes promo avec types corrigés:', {
            promo_code: promoCodeInfo?.code || null,
            promo_discount_amount: promoDiscountAmount,
            promo_discount_percent: promoDiscountPercent,
            calculated_discount: calculatedDiscount,
            discount_type: promoCodeInfo?.discount_type,
            original_discount_value: promoCodeInfo?.discount_value
        });

        const orderQuery = `
            INSERT INTO orders (
                customer_id, numero_commande, customer_name, customer_email, 
                shipping_address, shipping_city, shipping_postal_code, shipping_phone,
                total, subtotal, shipping_price, status, shipping_method, shipping_notes,
                promo_code, promo_discount_amount, promo_discount_percent,
                tax_amount, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) 
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
            parseFloat(finalTotal),
            parseFloat(originalSubtotal),
            parseFloat(deliveryFee),
            'en_attente',
            customer.deliveryMode || 'standard',
            customer.notes || null,
            promoCodeInfo?.code || null,
            promoDiscountAmount,
            promoDiscountPercent,
            0.00
        ];

        console.log('📋 Valeurs finales à insérer:', {
            customer_id: userId,
            numero_commande: orderNumber,
            total: parseFloat(finalTotal),
            subtotal: parseFloat(originalSubtotal),
            promo_code: promoCodeInfo?.code || 'Aucun',
            promo_discount_amount: promoDiscountAmount,
            promo_discount_percent: promoDiscountPercent
        });

        // ✅ DÉCLARER LES VARIABLES DANS LA BONNE PORTÉE
        let orderId;
        let createdOrderNumber;

        try {
            const orderResult = await sequelize.query(orderQuery, {
                replacements: orderValues,
                type: sequelize.QueryTypes.INSERT,
                transaction
            });

            // ✅ ASSIGNER LES VALEURS
            orderId = orderResult[0][0].id;
            createdOrderNumber = orderResult[0][0].numero_commande;

            console.log(`✅ Commande créée avec succès (types corrigés):`);
            console.log(`   📋 ID: ${orderId}`);
            console.log(`   🔢 Numéro: ${createdOrderNumber}`);

            if (promoCodeInfo) {
                console.log(`🎫 === CODE PROMO APPLIQUÉ AVEC SUCCÈS ===`);
                console.log(`   📋 Code: ${promoCodeInfo.code}`);
                console.log(`   💰 Type: ${promoCodeInfo.discount_type}`);
                console.log(`   📊 Valeur: ${promoCodeInfo.discount_value}${promoCodeInfo.discount_type === 'percentage' ? '%' : '€'}`);
                console.log(`   💸 Réduction calculée: ${calculatedDiscount.toFixed(2)}€`);
                console.log(`   🎯 Sous-total original: ${originalSubtotal.toFixed(2)}€`);
                console.log(`   📉 Sous-total après réduction: ${discountedSubtotal.toFixed(2)}€`);
                console.log(`   💾 Stocké en BDD:`);
                console.log(`      - promo_code: "${promoCodeInfo.code}"`);
                console.log(`      - promo_discount_amount: ${promoDiscountAmount}`);
                console.log(`      - promo_discount_percent: ${promoDiscountPercent}`);
                console.log(`============================`);
            }

        } catch (insertError) {
            console.error('❌ Erreur lors de l\'insertion:', insertError.message);
            console.error('   Valeurs problématiques:', orderValues);
            throw insertError;
        }

        // ✅ VÉRIFIER QUE orderId EST DÉFINI AVANT UTILISATION
        if (!orderId) {
            throw new Error('orderId non défini après création de commande');
        }

        // ========================================
        // 📝 ÉTAPE 8: AJOUT DES ARTICLES DE COMMANDE AVEC TAILLES
        // ========================================
        console.log('📝 Ajout des articles de commande avec tailles...');
        console.log(`   🆔 Utilisation orderId: ${orderId}`);

        for (const item of orderItems) {
            const selectedSize = item.size || 'Standard';
            
            console.log(`  📦 ${item.name} - Quantité: ${item.quantity} - Taille: ${selectedSize} - OrderID: ${orderId}`);
            
            const orderItemQuery = `
                INSERT INTO order_items (order_id, jewel_id, quantity, price, size)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await sequelize.query(orderItemQuery, {
                replacements: [
                    orderId,
                    item.jewelId, 
                    parseInt(item.quantity),
                    parseFloat(item.price),
                    selectedSize
                ],
                type: sequelize.QueryTypes.INSERT,
                transaction
            });
            
            console.log(`  ✅ Article ajouté avec taille: ${item.name} (${selectedSize})`);
        }

        // ========================================
        // 📦 ÉTAPE 9: MISE À JOUR DES STOCKS
        // ========================================
        console.log('📦 Mise à jour des stocks...');

        for (const item of cartItems) {
            await Jewel.update(
                { stock: sequelize.literal(`stock - ${parseInt(item.quantity)}`) },
                { 
                    where: { id: item.jewel.id },
                    transaction
                }
            );
            
            const updatedJewel = await Jewel.findByPk(item.jewel.id, { 
                attributes: ['stock'],
                transaction 
            });
            
            console.log(`  📦 ${item.jewel.name}: stock mis à jour (reste: ${updatedJewel.stock})`);
        }

        // ========================================
        // 🎫 ÉTAPE 10: INCRÉMENTER L'USAGE DU CODE PROMO
        // ========================================
        if (promoCodeInfo && promoCodeInfo.id) {
            try {
                console.log('🎫 Incrémentation de l\'usage du code promo...');
                
                const incrementResult = await PromoCode.increment('used_count', {
                    where: { id: promoCodeInfo.id },
                    transaction
                });
                
                console.log(`✅ Usage du code ${promoCodeInfo.code} incrémenté`);
                
                const updatedPromo = await PromoCode.findByPk(promoCodeInfo.id, { transaction });
                console.log(`📊 Nouvelles utilisations: ${updatedPromo.used_count}/${updatedPromo.max_uses || updatedPromo.usage_limit || '∞'}`);
                
            } catch (promoError) {
                console.error('❌ Erreur incrémentation code promo:', promoError.message);
            }
        }

        // ========================================
        // 💾 ÉTAPE 11: VALIDATION DE LA TRANSACTION
        // ========================================
        await transaction.commit();
        console.log('💾 Transaction Sequelize validée avec succès !');

        // ========================================
        // 🧹 ÉTAPE 12: NETTOYAGE DU PANIER ET SESSION
        // ========================================
        console.log('🧹 Nettoyage du panier après succès...');

        await Cart.destroy({ where: { customer_id: userId } });
        req.session.cart = null;
        req.session.customerInfo = null;
        req.session.appliedPromo = null;

        console.log('✅ Panier et session nettoyés APRÈS validation de la commande');

        // ========================================
        // 📧 ÉTAPE 13: ENVOI DES EMAILS (AVANT LES RETURN!)
        // ========================================
        console.log('📧 Préparation des emails avec données de réduction...');

        // ✅ PRÉPARER LES DONNÉES COMPLÈTES POUR L'EMAIL
        const emailOrderData = {
            id: orderId,
            numero_commande: createdOrderNumber,
            customer_name: `${customer.firstName} ${customer.lastName}`,
            customer_email: customer.email,
            shipping_address: customer.address,
            shipping_city: customer.city || '',
            shipping_postal_code: customer.postalCode || '',
            shipping_phone: customer.phone || '',
            
            // ✅ DONNÉES FINANCIÈRES AVEC RÉDUCTIONS
            subtotal: originalSubtotal,
            total: finalTotal,
            shipping_price: deliveryFee,
            
            // ✅ DONNÉES CODE PROMO
            promo_code: promoCodeInfo?.code || null,
            promo_discount_amount: calculatedDiscount,
            promo_discount_percent: promoCodeInfo?.discount_type === 'percentage' ? promoCodeInfo.discount_value : null,
            
            // ✅ ARTICLES AVEC TAILLES
            items: orderItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                size: item.size || 'Standard',
                total: item.total
            }))
        };

        const emailCustomerData = {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            city: customer.city,
            postalCode: customer.postalCode
        };

        console.log('📧 Données email préparées:', {
            orderId: emailOrderData.id,
            numeroCommande: emailOrderData.numero_commande,
            hasPromoCode: !!emailOrderData.promo_code,
            promoCode: emailOrderData.promo_code,
            discountAmount: emailOrderData.promo_discount_amount,
            originalSubtotal: emailOrderData.subtotal,
            finalTotal: emailOrderData.total,
            itemsCount: emailOrderData.items.length
        });

        // ✅ ENVOI DES EMAILS (SANS BLOQUER LA RÉPONSE)
        try {
            console.log('📧 Envoi des emails de confirmation...');
            
            const emailResults = await sendOrderConfirmationEmails(
                customer.email,
                customer.firstName,
                emailOrderData,
                emailCustomerData
            );
            
            console.log('📧 Résultats envoi emails:', emailResults);
            
            if (emailResults.customer.success) {
                console.log('✅ Email client envoyé avec succès');
                if (promoCodeInfo) {
                    console.log(`🎫 Code promo ${promoCodeInfo.code} inclus dans l'email client`);
                }
            } else {
                console.error('❌ Échec envoi email client:', emailResults.customer.error);
            }
            
            if (emailResults.admin.success) {
                console.log('✅ Email admin envoyé avec succès');
                if (promoCodeInfo) {
                    console.log(`🎫 Code promo ${promoCodeInfo.code} signalé dans l'email admin`);
                }
            } else {
                console.error('❌ Échec envoi email admin:', emailResults.admin.error);
            }
            
        } catch (emailError) {
            console.error('❌ Erreur lors de l\'envoi des emails:', emailError);
            // On continue même si l'email échoue - la commande est créée
        }

        // ========================================
        // 🎉 ÉTAPE 14: RÉPONSE FINALE (MAINTENANT APRÈS LES EMAILS)
        // ========================================
        console.log('🎉 === COMMANDE CRÉÉE AVEC SUCCÈS ===');
        console.log(`   📋 Numéro: ${createdOrderNumber}`);
        console.log(`   💰 Montant: ${finalTotal.toFixed(2)}€`);
        if (promoCodeInfo) {
            console.log(`   🎫 Code promo: ${promoCodeInfo.code} (-${calculatedDiscount.toFixed(2)}€)`);
        }
        console.log(`   👤 Client: ${customer.firstName} ${customer.lastName}`);
        console.log(`   📧 Email: ${customer.email}`);
        console.log('=====================================');

        if (isAjaxRequest) {
            console.log('📤 Retour JSON pour requête AJAX');
            
            return res.status(200).json({
                success: true,
                message: promoCodeInfo 
                    ? `Commande créée avec succès ! Code promo ${promoCodeInfo.code} appliqué (-${calculatedDiscount.toFixed(2)}€). Un email de confirmation vous a été envoyé.`
                    : 'Commande créée avec succès ! Un email de confirmation vous a été envoyé.',
                order: {
                    id: orderId,
                    numero: createdOrderNumber,
                    total: finalTotal,
                    subtotal: originalSubtotal,
                    discount: calculatedDiscount,
                    deliveryFee: deliveryFee,
                    itemsCount: orderItems.length,
                    customer_email: customer.email,
                    promoCode: promoCodeInfo?.code || null,
                    promoDetails: promoCodeInfo ? {
                        code: promoCodeInfo.code,
                        type: promoCodeInfo.discount_type,
                        value: promoCodeInfo.discount_value,
                        discountAmount: calculatedDiscount
                    } : null
                },
                redirectUrl: `/commande/confirmation?orderId=${orderId}&orderNumber=${encodeURIComponent(createdOrderNumber)}`
            });
            
        } else {
            console.log('🔄 Redirection pour requête formulaire HTML');
            
            const successMessage = promoCodeInfo 
                ? `Commande ${createdOrderNumber} créée avec succès ! Code promo ${promoCodeInfo.code} appliqué (-${calculatedDiscount.toFixed(2)}€). Un email de confirmation vous a été envoyé.`
                : `Commande ${createdOrderNumber} créée avec succès ! Un email de confirmation vous a été envoyé.`;
                
            req.flash('success', successMessage);
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
        
        // ✅ Rollback de la transaction Sequelize
        try {
            await transaction.rollback();
            console.log('🔄 Transaction Sequelize annulée (ROLLBACK effectué)');
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