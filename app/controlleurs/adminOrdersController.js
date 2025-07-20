
import { Order } from '../models/orderModel.js';
import { QueryTypes, Op } from 'sequelize';

import { sequelize } from '../models/sequelize-client.js';
import { sendStatusChangeEmail } from '../services/mailService.js';

export const adminOrdersController = {

      formatDateTime(dateString) {
        if (!dateString) return 'Non spécifié';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Date invalide';
            }
            
            return date.toLocaleString('fr-FR', {
                timeZone: 'Europe/Paris',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch (error) {
            console.error('❌ Erreur formatage date:', error);
            return dateString;
        }
    },

    // ========================================
    // 🛠️ FONCTIONS UTILITAIRES
    // ========================================

    // Normalisation des statuts en base de données
     async normalizeOrderStatuses() {
        try {
            const updateQuery = `
                UPDATE orders 
                SET status = CASE 
                    WHEN COALESCE(status, status_suivi) IS NULL OR COALESCE(status, status_suivi) = '' THEN 'waiting'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('en attente', 'en_attente') THEN 'waiting'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('préparation', 'preparation', 'preparing') THEN 'preparing'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('expédiée', 'expediee', 'shipped') THEN 'shipped'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('livrée', 'livree', 'delivered') THEN 'delivered'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('annulée', 'annulee', 'cancelled') THEN 'cancelled'
                    ELSE COALESCE(status, status_suivi, 'waiting')
                END,
                status_suivi = CASE 
                    WHEN COALESCE(status, status_suivi) IS NULL OR COALESCE(status, status_suivi) = '' THEN 'waiting'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('en attente', 'en_attente') THEN 'waiting'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('préparation', 'preparation', 'preparing') THEN 'preparing'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('expédiée', 'expediee', 'shipped') THEN 'shipped'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('livrée', 'livree', 'delivered') THEN 'delivered'
                    WHEN LOWER(COALESCE(status, status_suivi)) IN ('annulée', 'annulee', 'cancelled') THEN 'cancelled'
                    ELSE COALESCE(status, status_suivi, 'waiting')
                END,
                updated_at = CURRENT_TIMESTAMP
                WHERE status IS NULL 
                OR status = '' 
                OR LOWER(status) NOT IN ('waiting', 'preparing', 'shipped', 'delivered', 'cancelled')
            `;
            
            await sequelize.query(updateQuery);
        } catch (error) {
            console.error('❌ Erreur normalisation statuts:', error);
        }
    },

    // Normaliser un statut individuel
    normalizeStatus(status) {
        if (!status) return 'waiting';
        const statusMap = {
            'en attente': 'waiting',
            'en_attente': 'waiting',
            'préparation': 'preparing',
            'preparation': 'preparing',
            'preparing': 'preparing',
            'expédiée': 'shipped',
            'expediee': 'shipped',
            'shipped': 'shipped',
            'livrée': 'delivered',
            'livree': 'delivered',
            'delivered': 'delivered',
            'annulée': 'cancelled',
            'annulee': 'cancelled',
            'cancelled': 'cancelled'
        };
        return statusMap[status.toLowerCase()] || status;
    },

    // Classes CSS pour les statuts
    getStatusClass(status) {
        const normalizedStatus = adminOrdersController.normalizeStatus(status);
        const statusMap = {
            'waiting': 'en-attente',
            'preparing': 'preparation',
            'shipped': 'expediee',
            'delivered': 'livree',
            'cancelled': 'annulee'
        };
        return statusMap[normalizedStatus] || 'en-attente';
    },

    // Traduction des statuts
    translateStatus(status) {
        const normalizedStatus = adminOrdersController.normalizeStatus(status);
        const statusMap = {
            'waiting': 'En attente',
            'preparing': 'En préparation',
            'shipped': 'Expédiée',
            'delivered': 'Livrée',
            'cancelled': 'Annulée'
        };
        return statusMap[normalizedStatus] || 'En attente';
    },

    // Description pour les événements de suivi
    getTrackingDescription(status) {
        const descriptions = {
            'waiting': 'Commande reçue et en attente de traitement',
            'preparing': 'Commande en cours de préparation dans nos ateliers',
            'shipped': 'Commande expédiée et en cours de livraison',
            'delivered': 'Commande livrée avec succès',
            'cancelled': 'Commande annulée'
        };
        return descriptions[status] || 'Mise à jour du statut de la commande';
    },

    // Calculer le temps écoulé
   getTimeAgo(dateString) {
        if (!dateString) return 'Non spécifié';
        try {
            // ✅ CORRECTION: Conversion correcte des dates avec fuseau horaire
            const date = new Date(dateString);
            const now = new Date();
            
            // Vérifier si la date est valide
            if (isNaN(date.getTime())) {
                return 'Date invalide';
            }
            
            const diffMs = Math.abs(now - date);
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays > 0) {
                return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
            } else if (diffHours > 0) {
                return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
            } else if (diffMinutes > 0) {
                return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
            } else {
                return 'À l\'instant';
            }
        } catch (error) {
            console.error('❌ Erreur calcul temps écoulé:', error);
            return 'Erreur de date';
        }
    },

    
      calculateStats(commandes) {
        const total = commandes.length;
        const totalRevenue = commandes.reduce((sum, cmd) => sum + parseFloat(cmd.amount || 0), 0);
        const withPromo = commandes.filter(cmd => cmd.promo_code).length;
        const totalSavings = commandes.reduce((sum, cmd) => sum + parseFloat(cmd.discountAmount || 0), 0);

        return {
            totalCommandes: { value: total, trend: 0, direction: 'up', compared: 'vs mois dernier' },
            chiffreAffaires: { value: totalRevenue, trend: 0, direction: 'up', compared: 'vs mois dernier' },
            codesPromoUtilises: { value: withPromo, trend: 0, direction: 'up', compared: 'vs mois dernier' },
            economiesClients: { value: totalSavings, trend: 0, direction: 'down', compared: 'réductions totales' }
        };
    },

    // ✅ FONCTION CORRIGÉE - Calcul stats par statut
    calculateStatusStats(commandes) {
        return {
            waiting: commandes.filter(cmd => cmd.status === 'waiting').length,
            preparing: commandes.filter(cmd => cmd.status === 'preparing').length,
            shipped: commandes.filter(cmd => cmd.status === 'shipped').length,
            delivered: commandes.filter(cmd => cmd.status === 'delivered').length,
            cancelled: commandes.filter(cmd => cmd.status === 'cancelled').length
        };
    },

    // ✅ FONCTION POUR RÉCUPÉRER LA LISTE DES COMMANDES
// app/controlleurs/adminOrdersController.js - MÉTHODE getAllOrders COMPLÈTE

/**
 * ✅ MÉTHODE COMPLÈTE getAllOrders SANS o.email
 */
async getAllOrders(req, res) {
    try {
        console.log('📋 Récupération commandes avec emails clients et dates corrigés');

        // ✅ REQUÊTE CORRIGÉE AVEC TOUTES LES SOURCES D'EMAIL ET DATES
        const commandesQuery = `
            SELECT 
                o.id,
                o.numero_commande,
                o.customer_id,
                
                -- ✅ RÉCUPÉRATION COMPLÈTE DES EMAILS
                COALESCE(
                    o.customer_email,
                    c.email,
                    'N/A'
                ) as customer_email,
                
                -- ✅ RÉCUPÉRATION COMPLÈTE DES NOMS CLIENTS
                COALESCE(
                    o.customer_name,
                    CONCAT(TRIM(COALESCE(c.first_name, '')), ' ', TRIM(COALESCE(c.last_name, ''))),
                    'Client inconnu'
                ) as customer_name,
                
                -- ✅ RÉCUPÉRATION TÉLÉPHONE ET ADRESSE
                COALESCE(o.customer_phone, c.phone, 'N/A') as customer_phone,
                COALESCE(o.shipping_address, c.address, 'N/A') as customer_address,
                
                -- ✅ DATES CORRECTES (sans 00:00)
                o.created_at,
                o.updated_at,
                DATE_FORMAT(o.created_at, '%d/%m/%Y %H:%i') as formatted_date,
                
                -- ✅ MONTANTS AVEC CALCULS CORRECTS
                COALESCE(o.subtotal, o.original_total, o.total, 0) as subtotal,
                COALESCE(o.total, 0) as total,
                COALESCE(o.original_total, o.subtotal, o.total, 0) as original_total,
                
                -- ✅ INFORMATIONS PROMO COMPLÈTES
                o.promo_code,
                COALESCE(o.promo_discount_amount, o.discount_amount, 0) as discount_amount,
                COALESCE(o.promo_discount_percent, o.discount_percent, 0) as discount_percent,
                COALESCE(o.shipping_price, o.delivery_fee, 0) as shipping_price,
                
                -- ✅ STATUT ET PAIEMENT
                COALESCE(o.status, o.status_suivi, 'waiting') as status,
                COALESCE(o.payment_method, 'card') as payment_method,
                COALESCE(o.payment_status, 'pending') as payment_status,
                
                -- ✅ SUIVI LIVRAISON
                o.tracking_number,
                o.delivery_notes
                
            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            ORDER BY o.created_at DESC
        `;

        const [result] = await sequelize.query(commandesQuery);

        // ✅ TRAITEMENT DES DONNÉES AVEC CALCULS CORRECTS
        const commandes = result.map(commande => {
            
            // ✅ CALCULS FINANCIERS CORRECTS
            const subtotal = parseFloat(commande.subtotal || 0);
            const discountAmount = parseFloat(commande.discount_amount || 0);
            const shippingPrice = parseFloat(commande.shipping_price || 0);
            const finalTotal = parseFloat(commande.total || 0);
            
            // Prix avant réduction = total final + réduction
            const originalTotal = discountAmount > 0 ? finalTotal + discountAmount : finalTotal;
            
            return {
                id: commande.id,
                numero_commande: commande.numero_commande || `CMD-${commande.id}`,
                
                // ✅ DATE CORRECTE (pas 00:00)
                created_at: commande.created_at,
                formatted_date: commande.formatted_date,
                date: commande.formatted_date,
                
                // ✅ INFORMATIONS CLIENT COMPLÈTES
                customer_name: commande.customer_name,
                customer_email: commande.customer_email,
                customer_phone: commande.customer_phone,
                customer_address: commande.customer_address,
                
                // ✅ MONTANTS CORRECTS
                subtotal: subtotal.toFixed(2),
                original_total: originalTotal.toFixed(2),
                discount_amount: discountAmount.toFixed(2),
                shipping_price: shippingPrice.toFixed(2),
                total: finalTotal.toFixed(2),
                
                // ✅ PROMO INFOS
                promo_code: commande.promo_code,
                discount_percent: parseFloat(commande.discount_percent || 0),
                hasDiscount: discountAmount > 0 || commande.promo_code,
                
                // ✅ STATUT ET PAIEMENT
                status: this.normalizeStatus(commande.status),
                payment_method: commande.payment_method,
                payment_status: commande.payment_status,
                
                // ✅ SUIVI
                tracking_number: commande.tracking_number,
                delivery_notes: commande.delivery_notes
            };
        });

        // ✅ DEBUG INFO
        console.log(`📊 ${commandes.length} commandes récupérées`);
        const emailsManquants = commandes.filter(cmd => cmd.customer_email === 'N/A').length;
        console.log(`📧 Emails manquants: ${emailsManquants}/${commandes.length}`);

        res.render('commandes', {
            title: 'Gestion des Commandes',
            commandes: commandes,
            stats: this.calculateStats(commandes),
            statusStats: this.calculateStatusStats(commandes),
            // ✅ HELPERS POUR LA VUE
            helpers: {
                formatPrice: (price) => parseFloat(price || 0).toFixed(2),
                formatDate: (date) => this.formatDateTime(date),
                getTimeAgo: (date) => this.getTimeAgo(date),
                translateStatus: (status) => this.translateStatus(status),
                getPaymentMethodDisplay: (method) => this.getPaymentMethodDisplay(method)
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération commandes:', error);
        res.status(500).render('error', {
            message: 'Erreur lors de la récupération des commandes',
            error: error
        });
    }
},


// Calcul des statistiques par statut
calculateStatusStats(orders) {
    return {
        pending: orders.filter(order => order.status === 'pending').length,
        confirmed: orders.filter(order => order.status === 'confirmed').length,
        preparing: orders.filter(order => order.status === 'preparing').length,
        shipped: orders.filter(order => order.status === 'shipped').length,
        delivered: orders.filter(order => order.status === 'delivered').length,
        cancelled: orders.filter(order => order.status === 'cancelled').length,
        refunded: orders.filter(order => order.status === 'refunded').length
    };
},





// async getOrderDetails(req, res) {
//     try {
//         const { id } = req.params;
//         console.log(`🔍 Récupération détails commande #${id} avec email client corrigé`);

//         // ✅ REQUÊTE CORRIGÉE AVEC TOUS LES CHAMPS EMAIL POSSIBLES
//         const orderQuery = `
//             SELECT 
//                 o.*,
                
//                 -- ✅ RÉCUPÉRATION COMPLÈTE DES EMAILS
//                 COALESCE(
//                     o.customer_email,
//                     o.email,
//                     o.user_email,
//                     c.email,
//                     c.user_email,
//                     'N/A'
//                 ) as customer_email,
                
//                 -- ✅ RÉCUPÉRATION COMPLÈTE DES NOMS
//                 COALESCE(
//                     o.customer_name,
//                     CONCAT(TRIM(c.first_name), ' ', TRIM(c.last_name)),
//                     CONCAT(TRIM(c.prenom), ' ', TRIM(c.nom)),
//                     c.name,
//                     c.username,
//                     'Client inconnu'
//                 ) as customer_name,
                
//                 -- ✅ DONNÉES SÉPARÉES POUR DEBUG
//                 c.first_name,
//                 c.last_name,
//                 c.prenom,
//                 c.nom,
//                 c.phone,
                
//                 COALESCE(o.shipping_address, c.address, c.adresse) as shipping_address,
//                 COALESCE(o.status, o.status_suivi, 'waiting') as current_status,
//                 COALESCE(o.payment_method, 'card') as payment_method,
//                 COALESCE(o.payment_status, 'pending') as payment_status
//             FROM orders o
//             LEFT JOIN customer c ON o.customer_id = c.id
//             WHERE o.id = $1
//         `;

//         const [orderResult] = await sequelize.query(orderQuery, { bind: [id] });
        
//         if (orderResult.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Commande non trouvée'
//             });
//         }

//         const order = orderResult[0];
        
//         // ✅ DEBUG DE L'EMAIL RÉCUPÉRÉ
//         console.log(`📧 Email pour commande #${id}:`, {
//             customer_id: order.customer_id,
//             customer_email_final: order.customer_email,
//             first_name: order.first_name,
//             last_name: order.last_name
//         });

//         // ... reste du code pour items, history, etc. ...

//         const response = {
//             success: true,
//             order: {
//                 ...order,
//                 status: this.normalizeStatus(order.current_status),
//                 date: new Date(order.created_at).toLocaleDateString('fr-FR'),
//                 dateTime: new Date(order.created_at).toLocaleString('fr-FR'),
//                 hasDiscount: parseFloat(order.promo_discount_amount || 0) > 0 || order.promo_code,
//                 payment_method: order.payment_method,
//                 payment_status: order.payment_status,
//                 payment_method_display: this.getPaymentMethodDisplay(order.payment_method)
//             },
//             items: [], // processedItems,
//             tracking: [], // tracking,
//             history: [], // history,
//             summary: {
//                 originalSubtotal: parseFloat(order.original_amount || order.total || 0),
//                 discount: parseFloat(order.promo_discount_amount || 0),
//                 subtotal: parseFloat(order.subtotal || order.total || 0),
//                 shipping: parseFloat(order.shipping_price || 0),
//                 total: parseFloat(order.total || 0)
//             }
//         };

//         res.json(response);

//     } catch (error) {
//         console.error('❌ Erreur détails commande:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Erreur lors de la récupération des détails: ' + error.message
//         });
//     }
// },


getPaymentMethodDisplay(paymentMethod) {
    console.log(`💳 Conversion méthode paiement: "${paymentMethod}"`);
    
    const methods = {
        'card': 'Carte bancaire',
        'credit_card': 'Carte bancaire',
        'debit_card': 'Carte de débit',
        'paypal': 'PayPal',
        'apple': 'Apple Pay',           // ✅ CORRECTION: 'apple' au lieu de 'apple_pay'
        'apple_pay': 'Apple Pay',       // ✅ GARDER AUSSI POUR COMPATIBILITÉ
        'google': 'Google Pay',         // ✅ CORRECTION: 'google' au lieu de 'google_pay'
        'google_pay': 'Google Pay',     // ✅ GARDER AUSSI POUR COMPATIBILITÉ
        'bank_transfer': 'Virement bancaire',
        'check': 'Chèque',
        'cash': 'Espèces',
        'stripe': 'Stripe',
        'klarna': 'Klarna'
    };
    
    const result = methods[paymentMethod] || 'Carte bancaire';
    console.log(`💳 Résultat: "${result}"`);
    return result;
},

async getDashboardData(period = 'month') {
    try {
        console.log(`📊 Récupération données dashboard pour: ${period}`);
        
        const { startDate, endDate } = this.getDateRange(period);
        
        // Toutes les données en parallèle
        const [
            financialData,
            siteStats,
            inventoryStats,
            recentOrders,
            visitorsData
        ] = await Promise.all([
            this.getFinancialData(startDate, endDate),
            this.getSiteStats(startDate, endDate),
            this.getInventoryStats(),
            this.getRecentOrders(10),
            this.getVisitorsData()
        ]);

        // Traduire les status des commandes récentes
        const translatedOrders = recentOrders.map(order => ({
            ...order,
            status: translateOrderStatus(order.status || 'waiting'),
            statusClass: this.getStatusClass(order.status || 'waiting')
        }));

        return {
            ...financialData,
            siteStats,
            inventoryStats,
            recentOrders: translatedOrders,
            visitorsData,
            period,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Erreur getDashboardData:', error);
        throw error;
    }
},


// ========================================
// 📊 DASHBOARD PRINCIPAL AVEC HELPERS INTÉGRÉS
// ========================================

async showDashboard(req, res) {
    try {
        console.log('🎯 Chargement dashboard admin avec gestion des tailles');
        
        // Normaliser les statuts avant affichage
        await adminOrdersController.normalizeOrderStatuses();

        // ========================================
        // 🔧 FONCTIONS HELPER INTÉGRÉES
        // ========================================
        
        const calculateCorrectPrices = (commande) => {
            const total = parseFloat(commande.total || commande.amount || 0);
            const discountAmount = parseFloat(commande.promo_discount_amount || commande.discount_amount || 0);
            const originalAmount = parseFloat(commande.original_amount || (total + discountAmount) || total);
            const subtotal = parseFloat(commande.subtotal || (total - (commande.shipping_price || 0)) || total);
            
            return {
                originalAmount: originalAmount,
                discountAmount: discountAmount,
                subtotalAfterDiscount: subtotal,
                finalTotal: total,
                hasDiscount: discountAmount > 0
            };
        };

        const getTaillesFromOrder = (commande) => {
            return commande.sizesInfo || null;
        };

        const formatSizesDisplay = (sizesInfo) => {
            if (!sizesInfo || !sizesInfo.hasSizeInfo) {
                return 'Non spécifiées';
            }
            return sizesInfo.sizesDisplay || 'Tailles standards';
        };

        const getSizesCoverageIndicator = (sizesInfo) => {
            if (!sizesInfo || sizesInfo.totalItems === 0) {
                return '❓ En développement';
            }
            
            const coverage = sizesInfo.sizesCoverage || 0;
            if (coverage === 100) return '🎯 Complète';
            if (coverage > 50) return '📏 Partielle';
            if (coverage > 0) return '📐 Limitée';
            return '❓ Aucune';
        };

        const getStatusClass = (status) => {
            const normalizedStatus = status || 'waiting';
            const statusMap = {
                'waiting': 'en-attente',
                'preparing': 'preparation',
                'shipped': 'expediee',
                'delivered': 'livree',
                'cancelled': 'annulee',
                'en_attente': 'en-attente',
                'preparation': 'preparation',
                'expediee': 'expediee',
                'livree': 'livree',
                'annulee': 'annulee'
            };
            return statusMap[normalizedStatus] || 'en-attente';
        };

        const translateStatus = (status) => {
            const normalizedStatus = status || 'waiting';
            const statusMap = {
                'waiting': 'En attente',
                'preparing': 'En préparation',
                'shipped': 'Expédiée',
                'delivered': 'Livrée',
                'cancelled': 'Annulée',
                'en_attente': 'En attente',
                'preparation': 'En préparation',
                'expediee': 'Expédiée',
                'livree': 'Livrée',
                'annulee': 'Annulée'
            };
            return statusMap[normalizedStatus] || 'En attente';
        };

        const formatDateTime = (dateString) => {
            if (!dateString) return 'N/A';
            try {
                const date = new Date(dateString);
                return date.toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                return dateString;
            }
        };

        const getPaymentMethodDisplay = (paymentMethod) => {
            const methods = {
                'card': 'Carte bancaire',
                'credit_card': 'Carte bancaire', 
                'paypal': 'PayPal',
                'apple': 'Apple Pay',
                'apple_pay': 'Apple Pay',
                'google': 'Google Pay',
                'google_pay': 'Google Pay',
                'bank_transfer': 'Virement bancaire',
                'check': 'Chèque',
                'cash': 'Espèces'
            };
            return methods[paymentMethod] || 'Carte bancaire';
        };

        const formatPrice = (price) => {
            return parseFloat(price || 0).toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        // ========================================
        // 📊 RÉCUPÉRATION DES STATISTIQUES
        // ========================================

        const statsQuery = `
            WITH order_stats AS (
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN COALESCE(status, status_suivi) IN ('waiting', 'en attente') THEN 1 END) as waiting_orders,
                    COUNT(CASE WHEN COALESCE(status, status_suivi) IN ('preparing', 'preparation', 'préparation') THEN 1 END) as preparing_orders,
                    COUNT(CASE WHEN COALESCE(status, status_suivi) IN ('shipped', 'expediee', 'expédiée') THEN 1 END) as shipped_orders,
                    COUNT(CASE WHEN COALESCE(status, status_suivi) IN ('delivered', 'livree', 'livrée') THEN 1 END) as delivered_orders,
                    COUNT(CASE WHEN COALESCE(status, status_suivi) IN ('cancelled', 'annulee', 'annulée') THEN 1 END) as cancelled_orders,
                    COALESCE(SUM(total), 0) as total_revenue,
                    COALESCE(SUM(COALESCE(original_total, total)), 0) as revenue_before_discounts,
                    COUNT(CASE WHEN promo_code IS NOT NULL AND promo_code != '' THEN 1 END) as orders_with_promo,
                    COALESCE(SUM(COALESCE(discount_amount, promo_discount_amount, promo_discount, 0)), 0) as total_discounts,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as orders_last_month,
                    COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN total ELSE 0 END), 0) as revenue_last_month,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' AND promo_code IS NOT NULL THEN 1 END) as promo_orders_last_month
                FROM orders
            ),
            previous_month AS (
                SELECT
                    COUNT(*) as orders_prev_month,
                    COALESCE(SUM(total), 0) as revenue_prev_month,
                    COUNT(CASE WHEN promo_code IS NOT NULL THEN 1 END) as promo_orders_prev_month
                FROM orders
                WHERE created_at >= CURRENT_DATE - INTERVAL '60 days'
                AND created_at < CURRENT_DATE - INTERVAL '30 days'
            )
            SELECT
                sc.*,
                pm.orders_prev_month,
                pm.revenue_prev_month,
                pm.promo_orders_prev_month,
                CASE WHEN pm.orders_prev_month > 0
                     THEN ROUND(((sc.orders_last_month - pm.orders_prev_month)::NUMERIC / pm.orders_prev_month) * 100, 1)
                     ELSE 100 END as orders_trend_percent,
                CASE WHEN pm.revenue_prev_month > 0
                     THEN ROUND(((sc.revenue_last_month - pm.revenue_prev_month) / pm.revenue_prev_month) * 100, 1)
                     ELSE 100 END as revenue_trend_percent,
                CASE WHEN pm.promo_orders_prev_month > 0
                     THEN ROUND(((sc.promo_orders_last_month - pm.promo_orders_prev_month)::NUMERIC / pm.promo_orders_prev_month) * 100, 1)
                     ELSE 100 END as promo_trend_percent
            FROM order_stats sc, previous_month pm
        `;

        const [statsResult] = await sequelize.query(statsQuery);
        const rawStats = statsResult[0] || {};

        // ========================================
        // 📋 RÉCUPÉRATION DES COMMANDES DÉTAILLÉES
        // ========================================

        const ordersQuery = `
            SELECT
                o.id,
                o.numero_commande,
                COALESCE(o.created_at, o.order_date, NOW()) as created_at_safe,
                COALESCE(o.order_date, o.created_at, NOW()) as order_date_safe,
                o.created_at as original_created_at,

                -- ✅ FIX NOMS/EMAILS pour les invités
                CASE
                    WHEN o.is_guest_order = true AND (o.customer_name IS NULL OR o.customer_name = '')
                    THEN 'Client invité'
                    ELSE COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu')
                END as customer_name,

                COALESCE(o.customer_email, c.email, 'email@inconnu.com') as customer_email,

                -- ✅ RÉCUPÉRATION CORRECTE DU PAYMENT_METHOD
                COALESCE(o.payment_method, 'card') as payment_method,
                COALESCE(o.payment_status, 'paid') as payment_status,

                o.total,
                COALESCE(o.original_total, o.total) as original_total,
                o.promo_code,
                COALESCE(o.discount_amount, 0) as discount_amount,
                COALESCE(o.discount_percent, 0) as discount_percent,
                COALESCE(o.promo_discount_amount, 0) as promo_discount_amount,
                COALESCE(o.promo_discount_percent, 0) as promo_discount_percent,
                COALESCE(o.promo_discount, 0) as promo_discount,
                COALESCE(o.shipping_method, 'Standard') as shipping_method,
                COALESCE(o.status, o.status_suivi, 'waiting') as status,
                o.tracking_number,
                c.phone,
                o.shipping_address,
                o.shipping_city,
                o.notes,
                o.customer_id,
                o.is_guest_order,

                -- ✅ INFORMATIONS TAILLES ET ARTICLES
                (
                    SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'nom_article', COALESCE(oi.jewel_name, j.name, jw.name, 'Article'),
                            'taille', COALESCE(oi.size, 'Standard'),
                            'quantite', COALESCE(oi.quantity, 1),
                            'prix', COALESCE(oi.price, j.price_ttc, jw.price_ttc, 0),
                            'matiere', COALESCE(j.matiere, jw.matiere, ''),
                            'image', COALESCE(oi.jewel_image, j.image, jw.image, '/images/placeholder.jpg')
                        )
                        ORDER BY oi.id
                    )
                    FROM order_items oi
                    LEFT JOIN jewel j ON oi.jewel_id = j.id
                    LEFT JOIN jewels jw ON oi.jewel_id = jw.id
                    WHERE oi.order_id = o.id
                ) as articles_details,

                -- ✅ Fallback amélioré : ORDER_HAS_JEWEL si ORDER_ITEMS est vide
                (
                    SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'nom_article', COALESCE(j.name, jw.name, 'Article'),
                            'taille', 'Standard',
                            'quantite', COALESCE(ohj.quantity, 1),
                            'prix', COALESCE(ohj.unit_price, j.price_ttc, jw.price_ttc, 0),
                            'matiere', COALESCE(j.matiere, jw.matiere, ''),
                            'image', COALESCE(j.image, jw.image, '/images/placeholder.jpg')
                        )
                        ORDER BY ohj.jewel_id
                    )
                    FROM order_has_jewel ohj
                    LEFT JOIN jewel j ON ohj.jewel_id = j.id
                    LEFT JOIN jewels jw ON ohj.jewel_id = jw.id
                    WHERE ohj.order_id = o.id
                ) as articles_details_fallback,

                -- ✅ COMPTER LES ARTICLES AVEC TAILLES SPÉCIFIÉES
                (
                    SELECT COUNT(*)
                    FROM order_items oi
                    WHERE oi.order_id = o.id
                    AND oi.size IS NOT NULL
                    AND oi.size NOT IN ('Standard', '', 'Non spécifiée', 'null')
                ) as articles_avec_tailles,

                -- ✅ COMPTER LE TOTAL D'ARTICLES
                (
                    SELECT COUNT(*)
                    FROM order_items oi
                    WHERE oi.order_id = o.id
                ) as total_articles_order_items,

                -- Fallback count pour ORDER_HAS_JEWEL
                (
                    SELECT COUNT(*)
                    FROM order_has_jewel ohj
                    WHERE ohj.order_id = o.id
                ) as total_articles_fallback

            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            ORDER BY COALESCE(o.created_at, o.order_date, NOW()) DESC
            LIMIT 100
        `;

        const [ordersResult] = await sequelize.query(ordersQuery);

        // ========================================
        // 🔄 TRAITEMENT DES COMMANDES
        // ========================================

        const processedCommandes = ordersResult.map(order => {
            console.log(`📋 Traitement commande #${order.id} (${order.is_guest_order ? 'Invité' : 'Connecté'})`);

            // Calcul des articles et tailles
            const totalArticles = order.total_articles_order_items || order.total_articles_fallback || 0;
            const articlesAvecTailles = order.articles_avec_tailles || 0;
            const articlesDetails = order.articles_details || order.articles_details_fallback || [];

            console.log(`   📦 ${totalArticles} articles depuis order_items, ${articlesAvecTailles} avec tailles spécifiées`);

            // Calcul de la couverture des tailles
            const pourcentageCouverture = totalArticles > 0 ? 
                Math.round((articlesAvecTailles / totalArticles) * 100) : 0;

            // Créer l'affichage des tailles
            let affichageTailles = 'Non spécifiées';
            let detailTailles = [];

            if (articlesDetails && articlesDetails.length > 0) {
                detailTailles = articlesDetails
                    .filter(article => article.taille && article.taille !== 'Non spécifiée')
                    .map(article => `${article.nom_article} (${article.taille})`);
                
                if (detailTailles.length > 0) {
                    affichageTailles = detailTailles.length <= 3 
                        ? detailTailles.join(', ')
                        : `${detailTailles.slice(0, 2).join(', ')} et ${detailTailles.length - 2} autre(s)`;
                }
            }

            // Créer l'objet sizesInfo pour la vue
            const sizesInfo = {
                totalItems: totalArticles,
                itemsWithSizes: articlesAvecTailles,
                sizesDisplay: affichageTailles,
                hasSizeInfo: articlesAvecTailles > 0,
                sizesCoverage: pourcentageCouverture,
                detailArticles: articlesDetails || []
            };

            // Calculer les montants corrects
            const discountAmount = parseFloat(order.promo_discount_amount || order.discount_amount || 0);
            const calculatedOriginal = parseFloat(order.original_total || order.total || 0);
            const finalAmount = parseFloat(order.total || 0);

            // Conversion méthode de paiement
            console.log(`💳 Conversion méthode paiement: "${order.payment_method}"`);
            const paymentMethodDisplay = getPaymentMethodDisplay(order.payment_method);
            console.log(`💳 Résultat: "${paymentMethodDisplay}"`);

            return {
                id: order.id,
                numero_commande: order.numero_commande || `CMD-${order.id}`,
                date: new Date(order.created_at_safe).toLocaleDateString('fr-FR'),
                dateTime: new Date(order.created_at_safe).toLocaleString('fr-FR'),
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                amount: finalAmount,
                originalAmount: calculatedOriginal,
                deliveryMode: order.shipping_method,
                status: adminOrdersController.normalizeStatus(order.status),
                promo_code: order.promo_code,
                hasDiscount: discountAmount > 0,
                sizesInfo: sizesInfo,
                payment_method: order.payment_method,
                payment_method_display: paymentMethodDisplay,
                payment_status: order.payment_status,
                tracking_number: order.tracking_number,
                isGuestOrder: order.is_guest_order,
                phone: order.phone,
                shipping_address: order.shipping_address,
                shipping_city: order.shipping_city,
                notes: order.notes,
                customer_id: order.customer_id
            };
        });

        console.log(`✅ ${processedCommandes.length} commandes traitées avec informations de tailles`);

        // ========================================
        // 📊 PRÉPARATION DES STATISTIQUES POUR LA VUE
        // ========================================

        const stats = {
            totalCommandes: {
                value: rawStats.total_orders || 0,
                trend: rawStats.orders_trend_percent || 0,
                direction: (rawStats.orders_trend_percent || 0) >= 0 ? 'up' : 'down',
                compared: 'vs mois dernier'
            },
            chiffreAffaires: {
                value: rawStats.total_revenue || 0,
                trend: rawStats.revenue_trend_percent || 0,
                direction: (rawStats.revenue_trend_percent || 0) >= 0 ? 'up' : 'down',
                compared: 'vs mois dernier'
            },
            codesPromoUtilises: {
                value: rawStats.orders_with_promo || 0,
                trend: rawStats.promo_trend_percent || 0,
                direction: (rawStats.promo_trend_percent || 0) >= 0 ? 'up' : 'down',
                compared: 'vs mois dernier'
            },
            economiesClients: {
                value: rawStats.total_discounts || 0,
                compared: 'Total économisé'
            }
        };

        const statusStats = {
            waiting: rawStats.waiting_orders || 0,
            preparing: rawStats.preparing_orders || 0,
            shipped: rawStats.shipped_orders || 0,
            delivered: rawStats.delivered_orders || 0,
            cancelled: rawStats.cancelled_orders || 0
        };

        const getTimeAgo = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
        } else if (diffHours > 0) {
            return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
        } else {
            return 'Récemment';
        }
    } catch (error) {
        return 'Date invalide';
    }
};

        // ========================================
        // 🎨 RENDU DE LA VUE AVEC HELPERS
        // ========================================

        res.render('commandes', {
            title: 'Administration - Suivi des Commandes',
            commandes: processedCommandes,
            stats,
            statusStats,
            helpers: {
                calculateCorrectPrices,
                getTaillesFromOrder,
                formatSizesDisplay,
                getSizesCoverageIndicator,
                getStatusClass,
                translateStatus,
                formatDateTime,
                getPaymentMethodDisplay,
                formatPrice,
                 getTimeAgo 
            }
        });

    } catch (error) {
        console.error('❌ Erreur showDashboard:', error);
        res.status(500).render('error', {
            message: 'Erreur lors du chargement du dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
},

    // ========================================
    // 🔍 DÉTAILS D'UNE COMMANDE
    // ========================================

// CORRECTION MINIMALE - SEULEMENT getOrderDetails dans adminOrdersController.js

/**
 * ✅ CORRECTION UNIQUEMENT DE getOrderDetails - SUPPRESSION o.email
 */
// VERSION ULTRA-MINIMALE - Seulement les colonnes de base qui existent forcément

/**
 * ✅ getOrderDetails ULTRA-MINIMAL - Colonnes de base uniquement
 */
// ✅ FONCTION getOrderDetails COMPLÈTE ET CORRIGÉE
async getOrderDetails(req, res) {
    try {
        const { id } = req.params;
        console.log(`🔍 Récupération détails commande #${id}`);

        // ========================================
        // 1️⃣ REQUÊTE PRINCIPALE - DÉTAILS COMMANDE
        // ========================================
        const orderQuery = `
            SELECT 
                o.*,
                -- ✅ DONNÉES CLIENT (pour fallback uniquement)
                c.first_name as customer_first_name,
                c.last_name as customer_last_name,
                c.email as customer_table_email,
                c.address as customer_table_address,
                c.phone as customer_table_phone,
                
                -- ✅ DONNÉES DE LIVRAISON (priorité absolue)
                COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as display_customer_name,
                COALESCE(o.customer_email, c.email, 'N/A') as display_customer_email,
                
                -- ✅ ADRESSE DE LIVRAISON SPÉCIFIQUE
                o.shipping_address as delivery_address,
                o.shipping_city as delivery_city,
                o.shipping_postal_code as delivery_postal_code,
                o.shipping_country as delivery_country,
                o.shipping_phone as delivery_phone,
                
                -- ✅ STATUT ET PAIEMENT
                COALESCE(o.status, o.status_suivi, 'waiting') as current_status,
                COALESCE(o.payment_method, 'card') as payment_method,
                COALESCE(o.payment_status, 'pending') as payment_status
            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            WHERE o.id = $1
        `;

        const [orderResult] = await sequelize.query(orderQuery, { bind: [id] });
        
        if (orderResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }

        const order = orderResult[0];

        // ========================================
        // 2️⃣ REQUÊTE ARTICLES - ORDER_ITEMS
        // ========================================
        const itemsQuery = `
            SELECT 
                oi.id,
                oi.jewel_id,
                oi.quantity,
                oi.price,
                oi.size,
                COALESCE(oi.jewel_name, j.name, jw.name, 'Article') as jewel_name,
                COALESCE(oi.jewel_image, j.image, jw.image, '/images/placeholder.jpg') as jewel_image,
                COALESCE(j.matiere, jw.matiere, '') as matiere,
                COALESCE(j.description, jw.description, '') as description
            FROM order_items oi
            LEFT JOIN jewel j ON oi.jewel_id = j.id
            LEFT JOIN jewels jw ON oi.jewel_id = jw.id
            WHERE oi.order_id = $1
            ORDER BY oi.id
        `;

        const [itemsResult] = await sequelize.query(itemsQuery, { bind: [id] });

        // ✅ TRAITEMENT DES ARTICLES (processedItems)
        const processedItems = itemsResult.map(item => ({
            id: item.id,
            jewel_id: item.jewel_id,
            name: item.jewel_name,
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price) || 0,
            size: item.size || 'Non spécifiée',
            image: item.jewel_image || '/images/placeholder.jpg',
            matiere: item.matiere || '',
            description: item.description || '',
            total: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)
        }));

        console.log(`📦 ${processedItems.length} articles trouvés pour la commande #${id}`);

        // ========================================
        // 3️⃣ REQUÊTE TRACKING
        // ========================================
        const trackingQuery = `
            SELECT 
                id,
                status,
                description,
                location,
                created_at
            FROM order_tracking 
            WHERE order_id = $1 
            ORDER BY created_at DESC
        `;

        const [trackingResult] = await sequelize.query(trackingQuery, { bind: [id] });

        const tracking = trackingResult.map(t => ({
            id: t.id,
            status: t.status,
            description: t.description,
            location: t.location,
            date: new Date(t.created_at).toLocaleString('fr-FR')
        }));

        // ========================================
        // 4️⃣ REQUÊTE HISTORIQUE STATUTS
        // ========================================
        const historyQuery = `
            SELECT 
                id,
                old_status,
                new_status,
                notes,
                updated_by,
                created_at
            FROM order_status_history 
            WHERE order_id = $1 
            ORDER BY created_at DESC
        `;

        const [historyResult] = await sequelize.query(historyQuery, { bind: [id] });

        const history = historyResult.map(h => ({
            id: h.id,
            old_status: h.old_status,
            new_status: h.new_status,
            notes: h.notes,
            updated_by: h.updated_by,
            date: new Date(h.created_at).toLocaleString('fr-FR')
        }));

        // ========================================
        // 5️⃣ REQUÊTE MODIFICATIONS
        // ========================================
        const modificationsQuery = `
            SELECT 
                id,
                modified_by,
                modification_type,
                old_value,
                new_value,
                description,
                created_at
            FROM order_modifications 
            WHERE order_id = $1 
            ORDER BY created_at DESC
        `;

        const [modificationsResult] = await sequelize.query(modificationsQuery, { bind: [id] });

        const modifications = modificationsResult.map(m => ({
            id: m.id,
            modified_by: m.modified_by,
            type: m.modification_type,
            old_value: m.old_value,
            new_value: m.new_value,
            description: m.description,
            date: new Date(m.created_at).toLocaleString('fr-FR')
        }));

        // ========================================
        // 6️⃣ CALCULS FINANCIERS
        // ========================================
        const originalAmount = parseFloat(order.original_total || order.subtotal || order.total || 0);
        const discountAmount = parseFloat(order.promo_discount_amount || order.discount_amount || 0);
        const shipping = parseFloat(order.shipping_price || order.delivery_fee || 0);
        const finalTotal = parseFloat(order.total || 0);

        // ========================================
        // 7️⃣ FONCTION HELPER POUR STATUTS
        // ========================================
        const normalizeStatus = (status) => {
            const statusMap = {
                'waiting': 'En attente',
                'preparing': 'En préparation', 
                'shipped': 'Expédiée',
                'delivered': 'Livrée',
                'cancelled': 'Annulée',
                'en_attente': 'En attente',
                'en_preparation': 'En préparation',
                'expediee': 'Expédiée',
                'livree': 'Livrée',
                'annulee': 'Annulée'
            };
            return statusMap[status] || status || 'En attente';
        };

        // ========================================
        // 8️⃣ FONCTION HELPER POUR MÉTHODES PAIEMENT
        // ========================================
        const getPaymentMethodDisplay = (paymentMethod) => {
            const methods = {
                'card': 'Carte bancaire',
                'credit_card': 'Carte bancaire',
                'debit_card': 'Carte de débit',
                'paypal': 'PayPal',
                'bank_transfer': 'Virement bancaire',
                'check': 'Chèque',
                'cash': 'Espèces',
                'apple_pay': 'Apple Pay',
                'google_pay': 'Google Pay',
                'stripe': 'Stripe',
                'klarna': 'Klarna'
            };
            return methods[paymentMethod] || 'Carte bancaire';
        };

        // ========================================
        // 9️⃣ CONSTRUCTION DE LA RÉPONSE FINALE
        // ========================================
        const response = {
            success: true,
            order: {
                ...order,
                status: normalizeStatus(order.current_status),
                date: new Date(order.created_at).toLocaleDateString('fr-FR'),
                dateTime: new Date(order.created_at).toLocaleString('fr-FR'),
                hasDiscount: discountAmount > 0 || order.promo_code,
                payment_method: order.payment_method,
                payment_status: order.payment_status,
                payment_method_display: getPaymentMethodDisplay(order.payment_method),
                
                // ✅ INFORMATIONS DE LIVRAISON SPÉCIFIQUES
                customer_name: order.display_customer_name,
                customer_email: order.display_customer_email,
                
                // ✅ ADRESSE DE LIVRAISON (pas l'adresse du compte client)
                shipping_address: order.delivery_address || order.shipping_address || 'Adresse non renseignée',
                shipping_city: order.delivery_city || order.shipping_city || '',
                shipping_postal_code: order.delivery_postal_code || order.shipping_postal_code || '',
                shipping_country: order.delivery_country || order.shipping_country || 'France',
                shipping_phone: order.delivery_phone || order.shipping_phone || order.customer_table_phone || '',
                
                // ✅ DONNÉES CLIENT (pour référence uniquement)
                customer_account: {
                    first_name: order.customer_first_name,
                    last_name: order.customer_last_name,
                    email: order.customer_table_email,
                    address: order.customer_table_address,
                    phone: order.customer_table_phone
                },
                
                // ✅ EMAIL FINAL À UTILISER
                email: {
                    from_order: order.customer_email,
                    from_customer: order.customer_table_email,
                    final_used: order.display_customer_email
                }
            },
            items: processedItems, // ✅ VARIABLE MAINTENANT DÉFINIE
            tracking: tracking,
            history: history,
            modifications: modifications,
            summary: {
                originalSubtotal: originalAmount,
                discount: discountAmount,
                subtotal: originalAmount - discountAmount,
                shipping: shipping,
                total: finalTotal
            }
        };

        console.log(`✅ Détails commande #${id} - ${processedItems.length} articles`);
        console.log(`📧 Email final: "${response.order.email.final_used}"`);
        console.log(`📍 Adresse livraison: "${response.order.shipping_address}"`);
        console.log(`🏠 Ville livraison: "${response.order.shipping_city}"`);
        console.log(`📞 Téléphone livraison: "${response.order.shipping_phone}"`);
        
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur détails commande:', error);
        console.error('Stack complet:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des détails: ' + error.message,
            debug: {
                error_message: error.message,
                error_stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
},



    // ========================================
    // ✏️ MODIFICATION D'UNE COMMANDE
    // ========================================

async updateOrder(req, res) {
    const orderId = req.params.id;
    const { status, tracking_number, notes, internal_notes } = req.body;
    
    try {
        console.log(`🔄 Mise à jour commande ${orderId}:`, {
            status,
            tracking_number,
            notes: notes?.substring(0, 50) + '...',
            internal_notes: internal_notes?.substring(0, 50) + '...'
        });

        // ✅ RÉCUPÉRER L'ANCIEN STATUT ET NOTES
        const [existingOrder] = await sequelize.query(`
            SELECT 
                status, 
                status_suivi, 
                notes, 
                internal_notes,
                tracking_number,
                customer_email,
                customer_name
            FROM orders 
            WHERE id = $1
        `, { bind: [orderId] });

        if (existingOrder.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }

        const currentOrder = existingOrder[0];
        const oldStatus = currentOrder.status || currentOrder.status_suivi;
        const statusChanged = status !== oldStatus;
        const notesChanged = notes !== currentOrder.notes;
        const internalNotesChanged = internal_notes !== currentOrder.internal_notes;
        const trackingChanged = tracking_number !== currentOrder.tracking_number;

        await sequelize.transaction(async (t) => {
            // ✅ MISE À JOUR DE LA COMMANDE AVEC TOUTES LES NOTES
            await sequelize.query(`
                UPDATE orders 
                SET 
                    status = $2,
                    status_suivi = $2,
                    tracking_number = $3,
                    notes = $4,
                    internal_notes = $5,
                    updated_at = NOW() AT TIME ZONE 'Europe/Paris'
                WHERE id = $1
            `, {
                bind: [orderId, status, tracking_number || null, notes || null, internal_notes || null],
                transaction: t
            });

            // ✅ ENREGISTRER DANS L'HISTORIQUE POUR CHAQUE MODIFICATION AVEC TIMEZONE
                const adminName = req.session?.user?.first_name || 
                  req.session?.user?.name || 
                  req.session?.user?.email?.split('@')[0] || 
                  (req.session?.customerId ? `User-${req.session.customerId}` : 'Admin');

                console.log(`👤 Modification par: ${adminName}`, {
                    session_user: req.session?.user,
                    customerId: req.session?.customerId
                });

            // Changement de statut
            if (statusChanged) {
                await sequelize.query(`
                    INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
                    VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'Europe/Paris')
                `, {
                    bind: [
                        orderId, 
                        oldStatus, 
                        status, 
                        `Statut modifié: ${oldStatus} → ${status}`,
                        adminName
                    ],
                    transaction: t
                });
            }

            // ✅ MODIFICATION DES NOTES CLIENTS
            if (notesChanged) {
    const noteText = notes ? `Notes client modifiées: "${notes}"` : 'Notes client supprimées';
    await sequelize.query(`
        INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'Europe/Paris')
    `, {
        bind: [orderId, status, status, noteText, adminName],
        transaction: t
    });
}

// ✅ MODIFICATION DES NOTES INTERNES (VERSION CORRIGÉE)
if (internalNotesChanged) {
    const internalNoteText = internal_notes ? `Notes internes modifiées: "${internal_notes}"` : 'Notes internes supprimées';
    await sequelize.query(`
        INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'Europe/Paris')
    `, {
        bind: [orderId, status, status, internalNoteText, adminName],
        transaction: t
    });
}

            // ✅ MODIFICATION DU TRACKING
            if (trackingChanged && tracking_number) {
                await sequelize.query(`
                    INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
                    VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'Europe/Paris')
                `, {
                    bind: [
                        orderId, 
                        status, 
                        status, 
                        `Numéro de suivi ajouté: ${tracking_number}`,
                        adminName
                    ],
                    transaction: t
                });
            }
        });

        res.json({
            success: true,
            message: 'Commande mise à jour avec succès',
            changes: {
                status: statusChanged,
                notes: notesChanged,
                internal_notes: internalNotesChanged,
                tracking: trackingChanged
            }
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour commande:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour: ' + error.message
        });
    }
},


// ========================================
// 5. SCRIPT DE RÉPARATION DES EMAILS
// ========================================

// ✅ SCRIPT À EXÉCUTER UNE FOIS pour corriger les emails manquants
async repairMissingEmails() {
    try {
        console.log('🔧 Réparation des emails manquants...');
        
        // Vérifier combien de commandes ont des emails manquants
        const [missingEmails] = await sequelize.query(`
            SELECT 
                o.id,
                o.customer_id,
                o.customer_email,
                c.email as customer_table_email
            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            WHERE (o.customer_email IS NULL OR o.customer_email = '' OR o.customer_email = 'N/A')
            AND c.email IS NOT NULL
            AND c.email != ''
        `);
        
        console.log(`📊 Trouvé ${missingEmails.length} commandes avec emails manquants mais récupérables`);
        
        // Réparer les emails
        for (const order of missingEmails) {
            await sequelize.query(`
                UPDATE orders 
                SET customer_email = $1
                WHERE id = $2
            `, {
                bind: [order.customer_table_email, order.id]
            });
            
            console.log(`✅ Réparé email pour commande ${order.id}: ${order.customer_table_email}`);
        }
        
        console.log('🎉 Réparation terminée !');
        
    } catch (error) {
        console.error('❌ Erreur réparation emails:', error);
    }
},




// ✅ MÉTHODE POUR ENVOYER LES EMAILS SELON LE STATUT
async sendStatusChangeEmail(order, oldStatus, newStatus, updatedBy) {
    try {
        // Import dynamique pour éviter les erreurs de dépendance
        const mailService = await import('../services/mailService.js');
        const { sendStatusChangeEmail } = mailService;
        
        // Préparer les données de la commande
        const orderData = {
            id: order.id,
            numero_commande: order.numero_commande || `CMD-${order.id}`,
            tracking_number: order.tracking_number,
            total: order.total,
            subtotal: order.subtotal,
            promo_code: order.promo_code,
            promo_discount_amount: order.promo_discount_amount
        };

        // Préparer les données client
        const customerData = {
            userEmail: order.customer_email || order.client_email,
            firstName: order.first_name || order.customer_name?.split(' ')[0] || 'Client',
            lastName: order.last_name || order.customer_name?.split(' ').slice(1).join(' ') || ''
        };

        // Préparer les données de changement de statut
        const statusChangeData = {
            oldStatus,
            newStatus,
            updatedBy
        };

        console.log('📧 Envoi email changement statut:', {
            order: orderData.numero_commande,
            customer: customerData.userEmail,
            change: `${oldStatus} → ${newStatus}`
        });

        // Appeler le service d'email
        const result = await sendStatusChangeEmail(orderData, statusChangeData, customerData);
        
        return result;
        
    } catch (error) {
        console.error('❌ Erreur dans sendStatusChangeEmail:', error);
        // Ne pas faire échouer la mise à jour si l'email échoue
        return { success: false, error: error.message };
    }
},

// ✅ MÉTHODE POUR ENVOYER LES EMAILS SELON LE STATUT
async sendStatusChangeEmail(order, oldStatus, newStatus, updatedBy) {
    try {
        const { sendStatusChangeEmail } = require('../services/mailService');
        
        // Préparer les données de la commande
        const orderData = {
            id: order.id,
            numero_commande: order.numero_commande || `CMD-${order.id}`,
            tracking_number: order.tracking_number,
            total: order.total,
            subtotal: order.subtotal,
            promo_code: order.promo_code,
            promo_discount_amount: order.promo_discount_amount
        };

        // Préparer les données client
        const customerData = {
            userEmail: order.customer_email || order.client_email,
            firstName: order.first_name || order.customer_name?.split(' ')[0] || 'Client',
            lastName: order.last_name || order.customer_name?.split(' ').slice(1).join(' ') || ''
        };

        // Préparer les données de changement de statut
        const statusChangeData = {
            oldStatus,
            newStatus,
            updatedBy
        };

        console.log('📧 Envoi email changement statut:', {
            order: orderData.numero_commande,
            customer: customerData.userEmail,
            change: `${oldStatus} → ${newStatus}`
        });

        // Appeler le service d'email
        const result = await sendStatusChangeEmail(orderData, statusChangeData, customerData);
        
        return result;
        
    } catch (error) {
        console.error('❌ Erreur dans sendStatusChangeEmail:', error);
        throw error;
    }
},


    // ========================================
    // 📍 AJOUT D'ÉVÉNEMENT DE SUIVI
    // ========================================

    async addTrackingEvent(req, res) {
        try {
            const { orderId, status, location, description } = req.body;

            if (!orderId || !status || !location || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Tous les champs sont requis'
                });
            }

            console.log(`📍 Ajout événement suivi commande #${orderId}`);

            const adminName = req.session?.user?.first_name || req.session?.user?.name || 'Admin';
            
            await sequelize.query(`
                INSERT INTO order_tracking (order_id, status, description, location, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            `, {
                bind: [orderId, status, `${description} (par ${adminName})`, location]
            });

            res.json({
                success: true,
                message: 'Événement de suivi ajouté avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur ajout tracking:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'ajout de l\'événement'
            });
        }
    },

    getPaymentMethodDisplay(paymentMethod) {
    console.log(`💳 Conversion méthode paiement: "${paymentMethod}"`);
    
    const methods = {
        'card': 'Carte bancaire',
        'credit_card': 'Carte bancaire',
        'debit_card': 'Carte de débit',
        'paypal': 'PayPal',
        'apple': 'Apple Pay',           // ✅ CORRECTION: 'apple' au lieu de 'apple_pay'
        'apple_pay': 'Apple Pay',       // ✅ GARDER AUSSI POUR COMPATIBILITÉ
        'google': 'Google Pay',         // ✅ CORRECTION: 'google' au lieu de 'google_pay'
        'google_pay': 'Google Pay',     // ✅ GARDER AUSSI POUR COMPATIBILITÉ
        'bank_transfer': 'Virement bancaire',
        'check': 'Chèque',
        'cash': 'Espèces',
        'stripe': 'Stripe',
        'klarna': 'Klarna'
    };
    
    const result = methods[paymentMethod] || 'Carte bancaire';
    console.log(`💳 Résultat: "${result}"`);
    return result;
},

    // ========================================
    // 📊 EXPORT CSV
    // ========================================

    async exportOrders(req, res) {
        try {
            const { status, dateFilter, search, promo } = req.query;

            let query = `
                SELECT 
                    o.id,
                    COALESCE(o.numero_commande, CONCAT('CMD-', o.id)) as numero_commande,
                    TO_CHAR(o.created_at, 'DD/MM/YYYY') as date_commande,
                    COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as client,
                    COALESCE(o.customer_email, c.email, 'N/A') as email,
                    COALESCE(o.original_total, o.total, 0) as montant_original,
                    GREATEST(
                        COALESCE(o.discount_amount, 0),
                        COALESCE(o.promo_discount_amount, 0),
                        COALESCE(o.promo_discount, 0)
                    ) as reduction,
                    COALESCE(o.total, 0) as montant_final,
                    COALESCE(o.promo_code, 'Aucun') as code_promo,
                    GREATEST(
                        COALESCE(o.discount_percent, 0),
                        COALESCE(o.promo_discount_percent, 0)
                    ) as pourcentage_reduction,
                    COALESCE(o.status, o.status_suivi, 'waiting') as statut,
                    COALESCE(o.shipping_method, 'Standard') as mode_livraison,
                    o.tracking_number,
                    -- Colonnes tailles pour export
                    (
                        SELECT STRING_AGG(
                            CONCAT(
                                COALESCE(j.name, jw.name, 'Article'), 
                                ' (Taille: ', 
                                COALESCE(
                                    CASE WHEN oi.size IS NOT NULL AND oi.size != '' THEN oi.size ELSE 'Standard' END, 
                                    'Non spécifiée'
                                ), 
                                ')'
                            ), 
                            ' | '
                        )
                        FROM order_items oi
                        LEFT JOIN jewel j ON oi.jewel_id = j.id
                        LEFT JOIN jewels jw ON oi.jewel_id = jw.id
                        WHERE oi.order_id = o.id
                    ) as articles_et_tailles,
                    (
                        SELECT COUNT(*)
                        FROM order_items oi
                        WHERE oi.order_id = o.id
                        AND (oi.size IS NOT NULL AND oi.size != '')
                    ) as articles_avec_taille,
                    (
                        SELECT COUNT(*)
                        FROM order_items oi
                        WHERE oi.order_id = o.id
                    ) as total_articles,
                    (SELECT updated_by FROM order_status_history 
                     WHERE order_id = o.id 
                     ORDER BY created_at DESC LIMIT 1) as traite_par
                FROM orders o
                LEFT JOIN customer c ON o.customer_id = c.id
                WHERE 1=1
            `;

            const replacements = [];
            let paramIndex = 1;

            // Appliquer les filtres
            if (status && status !== 'all') {
                query += ` AND (o.status = ${paramIndex} OR o.status_suivi = ${paramIndex})`;
                replacements.push(status);
                paramIndex++;
            }

            if (promo === 'with-promo') {
                query += ` AND (
                    o.promo_code IS NOT NULL AND o.promo_code != ''
                    OR COALESCE(o.discount_amount, 0) > 0
                    OR COALESCE(o.promo_discount_amount, 0) > 0
                    OR COALESCE(o.promo_discount, 0) > 0
                )`;
            } else if (promo === 'without-promo') {
                query += ` AND (
                    (o.promo_code IS NULL OR o.promo_code = '')
                    AND COALESCE(o.discount_amount, 0) = 0
                    AND COALESCE(o.promo_discount_amount, 0) = 0
                    AND COALESCE(o.promo_discount, 0) = 0
                )`;
            }

            if (search) {
                query += ` AND (
                    LOWER(COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name))) LIKE ${paramIndex}
                    OR LOWER(COALESCE(o.customer_email, c.email)) LIKE ${paramIndex}
                    OR LOWER(o.numero_commande) LIKE ${paramIndex}
                    OR LOWER(o.promo_code) LIKE ${paramIndex}
                )`;
                replacements.push(`%${search.toLowerCase()}%`);
                paramIndex++;
            }

            if (dateFilter) {
                switch (dateFilter) {
                    case 'today':
                        query += ` AND DATE(o.created_at) = CURRENT_DATE`;
                        break;
                    case 'week':
                        query += ` AND o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`;
                        break;
                    case 'month':
                        query += ` AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
                        break;
                }
            }

            query += ` ORDER BY o.created_at DESC`;

            const [result] = await sequelize.query(query, { bind: replacements });

            // Générer le CSV avec colonnes tailles
            const csvHeader = 'N° Commande,Date,Client,Email,Montant Original (€),Code Promo,% Réduction,Réduction (€),Montant Final (€),Économie (€),Statut,Mode Livraison,N° Suivi,Articles avec Tailles,Couverture Tailles (%),Détail Articles et Tailles,Traité par\n';
            const csvRows = result.map(order => {
                const statut = adminOrdersController.translateStatus(adminOrdersController.normalizeStatus(order.statut));
                const economie = parseFloat(order.montant_original) - parseFloat(order.montant_final);
                const totalArticles = parseInt(order.total_articles) || 0;
                const articlesAvecTaille = parseInt(order.articles_avec_taille) || 0;
                const couvertureTailles = totalArticles > 0 ? Math.round((articlesAvecTaille / totalArticles) * 100) : 0;
                
                return [
                    order.numero_commande,
                    order.date_commande,
                    order.client,
                    order.email,
                    order.montant_original,
                    order.code_promo,
                    order.pourcentage_reduction > 0 ? `${order.pourcentage_reduction}%` : '',
                    order.reduction,
                    order.montant_final,
                    economie.toFixed(2),
                    statut,
                    order.mode_livraison,
                    order.tracking_number || '',
                    `${articlesAvecTaille}/${totalArticles}`,
                    `${couvertureTailles}%`,
                    order.articles_et_tailles || 'Aucun détail',
                    order.traite_par || 'Système'
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            }).join('\n');

            const csvContent = csvHeader + csvRows;
            const fileName = `commandes_avec_tailles_export_${new Date().toISOString().split('T')[0]}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send('\ufeff' + csvContent);

        } catch (error) {
            console.error('❌ Erreur export:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export'
            });
        }
    },

    // ========================================
    // 🔄 MISE À JOUR RAPIDE DE STATUT
    // ========================================

//    async updateOrderStatus(req, res) {
//     try {
//       const { orderId } = req.params;
//       const { status: newStatus, trackingNumber, carrier, notes } = req.body;
//       const updatedBy = req.session?.user?.email || 'Admin';

//       console.log(`🔄 Mise à jour statut commande ${orderId}:`, {
//         newStatus,
//         trackingNumber,
//         updatedBy
//       });

//       // Récupérer la commande
//       const order = await Order.findByPk(orderId, {
//         include: [
//           {
//             model: User,
//             as: 'customer',
//             attributes: ['first_name', 'last_name', 'email', 'phone']
//           }
//         ]
//       });

//       if (!order) {
//         return res.status(404).json({
//           success: false,
//           message: 'Commande non trouvée'
//         });
//       }

//       const oldStatus = order.status;

//       // Mettre à jour la commande
//       await order.update({
//         status: newStatus,
//         tracking_number: trackingNumber || order.tracking_number,
//         carrier: carrier || order.carrier,
//         notes: notes || order.notes,
//         updated_at: new Date()
//       });

//       console.log(`✅ Statut commande ${orderId} mis à jour: ${oldStatus} → ${newStatus}`);

//       // Préparer les données pour les notifications
//       const orderData = {
//         id: order.id,
//         numero_commande: order.numero_commande || `CMD-${order.id}`,
//         tracking_number: order.tracking_number,
//         total: order.total,
//         subtotal: order.subtotal,
//         customer_name: order.customer ? 
//           `${order.customer.first_name} ${order.customer.last_name}` : 
//           order.customer_name || 'Client'
//       };

//       const customerData = {
//         userEmail: order.customer?.email || order.customer_email,
//         firstName: order.customer?.first_name || order.customer_name?.split(' ')[0] || 'Client',
//         lastName: order.customer?.last_name || order.customer_name?.split(' ').slice(1).join(' ') || '',
//         phone: order.customer?.phone || order.customer_phone
//       };

//       const statusChangeData = {
//         oldStatus,
//         newStatus,
//         updatedBy
//       };

//       // 🆕 ENVOI EMAIL + SMS selon le nouveau statut
//       let notificationResults = {
//         email: { success: false },
//         sms: { success: false },
//         success: false
//       };

//       try {
//         console.log('📧📱 Envoi notifications changement statut...');
        
//         notificationResults = await sendStatusChangeNotifications(
//           orderData,
//           statusChangeData,
//           customerData
//         );

//         console.log('📊 Résultats notifications:', {
//           email: notificationResults.email.success ? '✅' : '❌',
//           sms: notificationResults.sms.success ? '✅' : '❌',
//           customerEmail: customerData.userEmail,
//           customerPhone: customerData.phone ? `${customerData.phone.substring(0, 4)}...` : 'Non disponible'
//         });

//       } catch (notificationError) {
//         console.error('❌ Erreur notifications:', notificationError);
//         notificationResults = {
//           email: { success: false, error: notificationError.message },
//           sms: { success: false, error: notificationError.message },
//           success: false
//         };
//       }

//       // Réponse avec détails des notifications
//       const response = {
//         success: true,
//         message: 'Statut de commande mis à jour',
//         data: {
//           order: {
//             id: order.id,
//             numero_commande: order.numero_commande,
//             status: order.status,
//             tracking_number: order.tracking_number,
//             oldStatus,
//             newStatus
//           },
//           statusChanged: oldStatus !== newStatus,
//           notifications: {
//             emailSent: notificationResults.email.success,
//             smsSent: notificationResults.sms.success,
//             anyNotificationSent: notificationResults.success,
//             details: {
//               email: notificationResults.email,
//               sms: notificationResults.sms
//             }
//           }
//         }
//       };

//       res.json(response);

//     } catch (error) {
//       console.error('❌ Erreur mise à jour statut commande:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Erreur lors de la mise à jour du statut',
//         error: error.message
//       });
//     }
//   },

async updateOrderStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, tracking_number, admin_notes } = req.body;

        console.log(`🔄 Mise à jour commande #${id}:`, { status, tracking_number });

        // Récupérer la commande existante
        const existingOrder = await sequelize.query(`
            SELECT 
                o.*,
                COALESCE(o.customer_email, c.email, 'N/A') as customer_email,
                COALESCE(o.first_name, c.firstName, SPLIT_PART(o.customer_name, ' ', 1)) as first_name,
                COALESCE(o.last_name, c.lastName, SPLIT_PART(o.customer_name, ' ', 2)) as last_name
            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            WHERE o.id = $1
        `, {
            bind: [id],
            type: QueryTypes.SELECT
        });

        if (!existingOrder.length) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }

        const order = existingOrder[0];
        const oldStatus = order.status;
        const customerEmail = order.customer_email;

        // Mettre à jour la commande
        await sequelize.query(`
            UPDATE orders 
            SET 
                status = $1,
                tracking_number = $2,
                admin_notes = $3,
                updated_at = NOW()
            WHERE id = $4
        `, {
            bind: [status, tracking_number || order.tracking_number, admin_notes || order.admin_notes, id]
        });

        console.log(`✅ Commande #${id} mise à jour: ${oldStatus} → ${status}`);

        // ✅ ENVOI EMAIL SI STATUT CHANGÉ ET EMAIL DISPONIBLE
        let emailResult = { success: false, message: 'Aucun email envoyé' };
        
        if (status !== oldStatus && customerEmail && customerEmail !== 'N/A' && customerEmail.includes('@')) {
            try {
                console.log('📧 Tentative envoi email changement statut...');
                
                // Import dynamique du service email
                const { sendStatusChangeEmail } = await import('../services/mailService.js');
                
                const orderData = {
                    id: order.id,
                    numero_commande: order.numero_commande || `CMD-${order.id}`,
                    tracking_number: tracking_number || order.tracking_number,
                    total: order.total,
                    customer_name: order.customer_name,
                    customer_email: customerEmail
                };

                const statusChangeData = {
                    oldStatus,
                    newStatus: status,
                    updatedBy: req.session?.user?.name || 'Admin'
                };

                const customerData = {
                    userEmail: customerEmail,
                    firstName: order.first_name || order.customer_name?.split(' ')[0] || 'Client',
                    lastName: order.last_name || order.customer_name?.split(' ').slice(1).join(' ') || ''
                };

                console.log('📧 Données email:', { orderData: orderData.numero_commande, customerData: customerData.userEmail });

                emailResult = await sendStatusChangeEmail(orderData, statusChangeData, customerData);
                
            } catch (emailError) {
                console.error('⚠️ Erreur envoi email:', emailError);
                emailResult = { success: false, error: emailError.message };
            }
        } else {
            console.log('⚠️ Email non envoyé:', {
                statusChanged: status !== oldStatus,
                hasEmail: !!customerEmail,
                emailValue: customerEmail,
                isValidEmail: customerEmail && customerEmail.includes('@')
            });
        }

        res.json({
            success: true,
            message: 'Commande mise à jour avec succès',
            data: {
                order: {
                    id: order.id,
                    numero_commande: order.numero_commande,
                    status: status,
                    tracking_number: tracking_number || order.tracking_number,
                    customer_email: customerEmail
                },
                statusChanged: status !== oldStatus,
                emailSent: emailResult?.success || false,
                emailDetails: emailResult
            }
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour commande:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour: ' + error.message
        });
    }
},
  /**
   * 🆕 NOUVELLE MÉTHODE - Test des notifications SMS
   */
  async testSMSConfiguration(req, res) {
    try {
      const { testPhone } = req.body;
      
      if (!testPhone) {
        return res.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis pour le test'
        });
      }

      // Vérifier la configuration SMS
      const smsConfig = checkSMSConfiguration();
      
      if (!smsConfig.isConfigured) {
        return res.status(400).json({
          success: false,
          message: 'Configuration SMS non complète',
          config: smsConfig
        });
      }

      // Envoyer SMS de test
      const { sendTestSMS } = await import('../services/smsService.js');
      const testResult = await sendTestSMS(
        testPhone, 
        '🧪 Test SMS CrystosJewel - Configuration OK ! 📱✅'
      );

      if (testResult.success) {
        res.json({
          success: true,
          message: 'SMS de test envoyé avec succès',
          data: {
            messageId: testResult.messageId,
            status: testResult.status,
            phone: testPhone,
            config: smsConfig
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Échec envoi SMS de test',
          error: testResult.error,
          config: smsConfig
        });
      }

    } catch (error) {
      console.error('❌ Erreur test SMS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du test SMS',
        error: error.message
      });
    }
  },

  /**
   * 🆕 NOUVELLE MÉTHODE - Obtenir le statut des notifications
   */
  async getNotificationStatus(req, res) {
    try {
      const { checkSMSConfiguration } = await import('../services/smsService.js');
      const smsConfig = checkSMSConfiguration();

      const emailConfig = {
        isConfigured: !!(process.env.MAIL_USER && process.env.MAIL_PASS),
        mailUser: process.env.MAIL_USER || 'Non configuré'
      };

      res.json({
        success: true,
        data: {
          email: emailConfig,
          sms: smsConfig,
          bothConfigured: emailConfig.isConfigured && smsConfig.isConfigured
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération statut notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du statut',
        error: error.message
      });
    }
  },

  /**
   * 🆕 NOUVELLE MÉTHODE - Renvoyer les notifications pour une commande
   */
  async resendNotifications(req, res) {
    try {
      const { orderId } = req.params;
      const { notificationType = 'both' } = req.body; // 'email', 'sms', ou 'both'

      const order = await Order.findByPk(orderId, {
        include: [
          {
            model: User,
            as: 'customer',
            attributes: ['first_name', 'last_name', 'email', 'phone']
          }
        ]
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      // Préparer les données
      const orderData = {
        id: order.id,
        numero_commande: order.numero_commande || `CMD-${order.id}`,
        tracking_number: order.tracking_number,
        total: order.total,
        customer_name: order.customer ? 
          `${order.customer.first_name} ${order.customer.last_name}` : 
          order.customer_name || 'Client'
      };

      const customerData = {
        userEmail: order.customer?.email || order.customer_email,
        firstName: order.customer?.first_name || order.customer_name?.split(' ')[0] || 'Client',
        phone: order.customer?.phone || order.customer_phone
      };

      const statusChangeData = {
        oldStatus: 'previous',
        newStatus: order.status,
        updatedBy: req.session?.user?.email || 'Admin (Renvoi)'
      };

      // Renvoyer selon le type demandé
      let results = { email: { success: false }, sms: { success: false } };

      if (notificationType === 'email' || notificationType === 'both') {
        const { sendGenericStatusChangeEmail } = await import('../services/mailService.js');
        results.email = await sendGenericStatusChangeEmail(
          customerData.userEmail,
          customerData.firstName,
          orderData.numero_commande,
          'previous',
          order.status,
          order.tracking_number
        );
      }

      if (notificationType === 'sms' || notificationType === 'both') {
        if (customerData.phone) {
          const { sendStatusChangeSMS } = await import('../services/smsService.js');
          results.sms = await sendStatusChangeSMS(customerData.phone, orderData, statusChangeData);
        } else {
          results.sms = { success: false, error: 'Numéro de téléphone non disponible' };
        }
      }

      res.json({
        success: results.email.success || results.sms.success,
        message: 'Notifications renvoyées',
        data: {
          order: {
            id: order.id,
            numero_commande: order.numero_commande,
            status: order.status
          },
          notifications: {
            emailSent: results.email.success,
            smsSent: results.sms.success,
            details: results
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur renvoi notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du renvoi des notifications',
        error: error.message
      });
    }
  },


    // ========================================
    // 💾 SAUVEGARDE COMPLÈTE DES MODIFICATIONS
    // ========================================

    async saveOrderModifications(req, res) {
        try {
            const { 
                orderId, 
                status, 
                paymentMethod, 
                paymentRef, 
                shippingMethod, 
                trackingNumber,
                shippingAddress,
                shippingCity,
                shippingNotes,
                items
            } = req.body;

            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de commande requis'
                });
            }

            const adminName = req.session?.user?.first_name || 
                  req.session?.user?.name || 
                  req.session?.user?.email?.split('@')[0] || 
                  'Admin';
            
            await sequelize.transaction(async (t) => {
                // Mettre à jour les informations principales
                await sequelize.query(`
                    UPDATE orders 
                    SET 
                        status = COALESCE($2, status),
                        status_suivi = COALESCE($2, status_suivi),
                        shipping_method = COALESCE($3, shipping_method),
                        tracking_number = COALESCE($4, tracking_number),
                        shipping_address = COALESCE($5, shipping_address),
                        shipping_city = COALESCE($6, shipping_city),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, {
                    bind: [orderId, status, shippingMethod, trackingNumber, shippingAddress, shippingCity],
                    transaction: t
                });

                // Enregistrer l'historique complet
                const changes = [];
                if (status) changes.push(`Statut: ${status}`);
                if (trackingNumber) changes.push(`Suivi: ${trackingNumber}`);
                if (shippingMethod) changes.push(`Livraison: ${shippingMethod}`);
                
                if (changes.length > 0) {
                    try {
                        await sequelize.query(`
                            INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
                            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                        `, {
                            bind: [orderId, status || 'unchanged', status || 'unchanged', changes.join(' | '), adminName],
                            transaction: t
                        });
                    } catch (historyError) {
                        console.log('⚠️ Impossible d\'enregistrer l\'historique complet');
                    }
                }

                // Mettre à jour les quantités d'articles si fournies
                if (items && Array.isArray(items)) {
                    for (const item of items) {
                        if (item.id && item.quantity) {
                            try {
                                await sequelize.query(`
                                    UPDATE order_items 
                                    SET quantity = $2
                                    WHERE id = $1 AND order_id = $3
                                `, {
                                    bind: [item.id, item.quantity, orderId],
                                    transaction: t
                                });
                            } catch (itemsError) {
                                await sequelize.query(`
                                    UPDATE order_has_jewel 
                                    SET quantity = $2
                                    WHERE jewel_id = $1 AND order_id = $3
                                `, {
                                    bind: [item.id, item.quantity, orderId],
                                    transaction: t
                                });
                            }
                        }
                    }
                }
            });

            res.json({
                success: true,
                message: 'Modifications sauvegardées avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde modifications:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde: ' + error.message
            });
        }
    },



// ✅ FONCTION ENVOI EMAIL EXPÉDITION
async sendShippingEmail(orderData) {
    try {
        const { email, firstName, orderNumber, trackingNumber, orderId } = orderData;
        
        const emailContent = {
            to: email,
            subject: `📦 Votre commande ${orderNumber} a été expédiée !`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #E8B4B8; color: white; padding: 20px; text-align: center;">
                        <h1>📦 Commande Expédiée</h1>
                    </div>
                    
                    <div style="padding: 20px;">
                        <p>Bonjour ${firstName},</p>
                        
                        <p>Excellente nouvelle ! Votre commande <strong>${orderNumber}</strong> a été expédiée et est en route vers vous.</p>
                        
                        ${trackingNumber ? `
                        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <h3>🚚 Suivi de votre colis</h3>
                            <p><strong>Numéro de suivi :</strong> ${trackingNumber}</p>
                            <p>Vous pouvez suivre votre colis en temps réel avec ce numéro.</p>
                        </div>
                        ` : ''}
                        
                        <p>Votre commande sera livrée dans les prochains jours ouvrés.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.SITE_URL || 'https://crystosjewel.com'}/commande/suivi?order=${orderNumber}" 
                               style="background: #E8B4B8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                Suivre ma commande
                            </a>
                        </div>
                        
                        <p>Merci pour votre confiance !</p>
                        <p>L'équipe CrystosJewel</p>
                    </div>
                </div>
            `
        };

        // Utiliser votre service d'email existant
        const result = await this.sendEmail(emailContent);
        return result.success;
        
    } catch (error) {
        console.error('❌ Erreur envoi email expédition:', error);
        return false;
    }
},

// ✅ FONCTION ENVOI EMAIL LIVRAISON
async sendDeliveryEmail(orderData) {
    try {
        const { email, firstName, orderNumber, orderId } = orderData;
        
        const emailContent = {
            to: email,
            subject: `✅ Votre commande ${orderNumber} a été livrée !`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #10b981; color: white; padding: 20px; text-align: center;">
                        <h1>✅ Commande Livrée</h1>
                    </div>
                    
                    <div style="padding: 20px;">
                        <p>Bonjour ${firstName},</p>
                        
                        <p>🎉 Félicitations ! Votre commande <strong>${orderNumber}</strong> a été livrée avec succès.</p>
                        
                        <p>Nous espérons que vous êtes ravi(e) de vos nouveaux bijoux !</p>
                        
                        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <h3>💎 Profitez de vos bijoux</h3>
                            <p>N'hésitez pas à nous envoyer des photos de vos bijoux portés sur nos réseaux sociaux !</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.SITE_URL || 'https://crystosjewel.com'}/avis?order=${orderNumber}" 
                               style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">
                                Laisser un avis
                            </a>
                            <a href="${process.env.SITE_URL || 'https://crystosjewel.com'}/bijoux" 
                               style="background: #E8B4B8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">
                                Découvrir nos nouveautés
                            </a>
                        </div>
                        
                        <p>Merci pour votre confiance et à bientôt !</p>
                        <p>L'équipe CrystosJewel</p>
                    </div>
                </div>
            `
        };

        const result = await this.sendEmail(emailContent);
        return result.success;
        
    } catch (error) {
        console.error('❌ Erreur envoi email livraison:', error);
        return false;
    }
},

// ✅ FONCTION GÉNÉRIQUE D'ENVOI EMAIL (à adapter selon votre service)
async sendEmail(emailContent) {
    try {
        // Adaptez cette partie selon votre service d'email (Nodemailer, SendGrid, etc.)
        // Exemple avec Nodemailer :
        
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransporter({
            // Votre configuration SMTP
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const info = await transporter.sendMail({
            from: `"CrystosJewel" <${process.env.SMTP_FROM}>`,
            to: emailContent.to,
            subject: emailContent.subject,
            html: emailContent.html
        });

        console.log('📧 Email envoyé:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Erreur envoi email:', error);
        return { success: false, error: error.message };
    }
},

 // ✅ NOUVELLE FONCTION - Envoyer email changement de statut
    async sendStatusChangeEmail(orderData, oldStatus, newStatus, adminName) {
        try {
            console.log(`📧 Envoi email changement statut: ${oldStatus} → ${newStatus}`);
            
            // Email client si statut important
            const importantStatuses = ['shipped', 'delivered'];
            if (importantStatuses.includes(newStatus) && orderData.customer_email) {
                const emailData = {
                    orderNumber: orderData.numero_commande,
                    customerName: orderData.customer_name,
                    oldStatus: this.translateStatus(oldStatus),
                    newStatus: this.translateStatus(newStatus),
                    trackingNumber: orderData.tracking_number,
                    updatedBy: adminName
                };

                if (newStatus === 'shipped') {
                    await sendShippingNotificationEmail(orderData.customer_email, orderData.customer_name.split(' ')[0], emailData);
                } else {
                    await sendOrderStatusUpdateEmail(orderData.customer_email, orderData.customer_name.split(' ')[0], emailData);
                }
            }

            // ✅ EMAIL ADMIN SYSTÉMATIQUE pour toute modification
            const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
            if (adminEmail) {
                const adminEmailData = {
                    orderNumber: orderData.numero_commande,
                    orderId: orderData.id,
                    customerName: orderData.customer_name,
                    oldStatus: this.translateStatus(oldStatus),
                    newStatus: this.translateStatus(newStatus),
                    updatedBy: adminName,
                    timestamp: this.formatDateTime(new Date())
                };

                // Utiliser le service d'email pour notifier l'admin
                await this.sendAdminStatusNotification(adminEmailData);
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Erreur envoi email statut:', error);
            return { success: false, error: error.message };
        }
    },

    // ✅ NOUVELLE FONCTION - Email notification admin
    async sendAdminStatusNotification(emailData) {
        try {
            const transporter = await import('../utils/mailService.js').then(m => m.transporter);
            
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px;">🔄 Modification de Commande</h1>
                        <p style="margin: 8px 0 0 0; opacity: 0.9;">CrystosJewel Administration</p>
                    </div>
                    
                    <div style="padding: 25px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                            <h2 style="margin: 0 0 15px 0; color: #1e293b;">Commande ${emailData.orderNumber}</h2>
                            <div style="margin-bottom: 10px;">
                                <strong>Client:</strong> ${emailData.customerName}
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong>Ancien statut:</strong> 
                                <span style="color: #64748b;">${emailData.oldStatus}</span>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong>Nouveau statut:</strong> 
                                <span style="color: #059669; font-weight: 600;">${emailData.newStatus}</span>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong>Modifié par:</strong> ${emailData.updatedBy}
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong>Date/Heure:</strong> ${emailData.timestamp}
                            </div>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${process.env.BASE_URL}/admin/commandes/${emailData.orderId}" 
                               style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; 
                                      text-decoration: none; border-radius: 8px; font-weight: 600;">
                                👁️ Voir la commande
                            </a>
                        </div>
                    </div>
                    
                    <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                        Notification automatique de modification de commande
                    </div>
                </div>
            `;

            await transporter.sendMail({
                from: `"CrystosJewel Admin" <${process.env.MAIL_USER}>`,
                to: process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                subject: `🔄 Commande ${emailData.orderNumber} - Statut: ${emailData.newStatus}`,
                html: htmlContent,
            });

            console.log('📧 Email admin envoyé avec succès');
        } catch (error) {
            console.error('❌ Erreur envoi email admin:', error);
        }
    },

};