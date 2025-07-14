
import { Order } from '../models/orderModel.js';
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
        console.log('📋 Récupération de toutes les commandes avec emails corrigés');

        // ✅ PARAMÈTRES DE FILTRAGE
        const { status: filterStatus, date: filterDate, search: filterSearch, promo: filterPromo } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // ✅ CONSTRUCTION DE LA CLAUSE WHERE
        let whereConditions = [];
        let replacements = [];
        let paramIndex = 1;

        // Filtre par statut
        if (filterStatus && filterStatus !== 'all') {
            whereConditions.push(`COALESCE(o.status, o.status_suivi, 'pending') = $${paramIndex}`);
            replacements.push(filterStatus);
            paramIndex++;
        }

        // Filtre par date
        if (filterDate) {
            switch (filterDate) {
                case 'today':
                    whereConditions.push(`DATE(o.created_at) = CURRENT_DATE`);
                    break;
                case 'week':
                    whereConditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
                    break;
                case 'month':
                    whereConditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
                    break;
                case 'year':
                    whereConditions.push(`o.created_at >= DATE_TRUNC('year', CURRENT_DATE)`);
                    break;
            }
        }

        // Filtre par code promo
        if (filterPromo) {
            if (filterPromo === 'with-promo') {
                whereConditions.push(`(o.promo_code IS NOT NULL AND o.promo_code != '')`);
            } else if (filterPromo === 'without-promo') {
                whereConditions.push(`(o.promo_code IS NULL OR o.promo_code = '')`);
            }
        }

        // Filtre par recherche
        if (filterSearch && filterSearch.trim()) {
            whereConditions.push(`(
                LOWER(COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name))) LIKE $${paramIndex}
                OR LOWER(COALESCE(o.customer_email, c.email)) LIKE $${paramIndex}
                OR LOWER(o.numero_commande) LIKE $${paramIndex}
                OR LOWER(o.promo_code) LIKE $${paramIndex}
            )`);
            replacements.push(`%${filterSearch.toLowerCase()}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // ✅ REQUÊTE PRINCIPALE SANS o.email
        const ordersQuery = `
            SELECT 
                o.id,
                COALESCE(o.numero_commande, CONCAT('CMD-', o.id)) as numero_commande,
                o.customer_id,
                
                -- ✅ EMAIL CLIENT SANS o.email QUI N'EXISTE PAS
                COALESCE(
                    o.customer_email,
                    o.user_email,
                    c.email,
                    c.user_email,
                    'Email non renseigné'
                ) as customer_email,
                
                -- ✅ NOM CLIENT COMPLET
                COALESCE(
                    o.customer_name,
                    CONCAT(TRIM(COALESCE(c.first_name, '')), ' ', TRIM(COALESCE(c.last_name, ''))),
                    CONCAT(TRIM(COALESCE(c.prenom, '')), ' ', TRIM(COALESCE(c.nom, ''))),
                    c.name,
                    c.username,
                    'Client inconnu'
                ) as customer_name,
                
                -- ✅ INFORMATIONS FINANCIÈRES
                COALESCE(o.total, 0) as total,
                COALESCE(o.subtotal, o.original_total, o.total, 0) as subtotal,
                COALESCE(o.discount_amount, o.promo_discount_amount, 0) as discount_amount,
                COALESCE(o.promo_discount_percent, o.discount_percent, 0) as discount_percent,
                o.promo_code,
                
                -- ✅ STATUT ET DATES
                COALESCE(o.status, o.status_suivi, 'pending') as status,
                o.created_at,
                o.updated_at,
                o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris' as created_at_local,
                o.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris' as updated_at_local,
                
                -- ✅ INFORMATIONS LIVRAISON
                o.tracking_number,
                COALESCE(o.shipping_method, 'Standard') as shipping_method,
                COALESCE(o.payment_method, 'card') as payment_method,
                COALESCE(o.payment_status, 'completed') as payment_status,
                
                -- ✅ CONTACT CLIENT
                COALESCE(o.customer_phone, c.phone) as customer_phone,
                COALESCE(o.shipping_address, c.address) as shipping_address,
                
                -- ✅ INFORMATIONS ARTICLES ET TAILLES
                (
                    SELECT COUNT(*)
                    FROM order_items oi
                    WHERE oi.order_id = o.id
                ) as total_items,
                
                (
                    SELECT COUNT(*)
                    FROM order_items oi
                    WHERE oi.order_id = o.id
                    AND oi.size IS NOT NULL 
                    AND oi.size != '' 
                    AND oi.size != 'Non spécifiée'
                    AND oi.size != 'null'
                ) as items_with_size,
                
                -- ✅ DÉTAILS ARTICLES AVEC TAILLES
                (
                    SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'name', COALESCE(oi.jewel_name, j.name, 'Article'),
                            'quantity', oi.quantity,
                            'price', oi.price_ttc,
                            'size', CASE 
                                WHEN oi.size IS NOT NULL AND oi.size != '' AND oi.size != 'Non spécifiée' AND oi.size != 'null'
                                THEN oi.size 
                                ELSE 'Non spécifiée' 
                            END,
                            'image', COALESCE(oi.jewel_image, j.image, '/images/placeholder.jpg')
                        )
                        ORDER BY oi.id
                    )
                    FROM order_items oi
                    LEFT JOIN jewel j ON oi.jewel_id = j.id
                    WHERE oi.order_id = o.id
                ) as items_details,
                
                -- ✅ COLONNES DEBUG (optionnelles, pour identifier les problèmes)
                o.customer_email as order_customer_email,
                c.email as customer_table_email,
                c.first_name as customer_first_name,
                c.last_name as customer_last_name

            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        // Ajouter pagination aux paramètres
        replacements.push(limit, offset);

        console.log('📋 Exécution requête commandes avec paramètres:', replacements);

        // ✅ EXÉCUTION REQUÊTE PRINCIPALE
        const [orders] = await sequelize.query(ordersQuery, { bind: replacements });

        // ✅ REQUÊTE COUNT POUR PAGINATION
        const countQuery = `
            SELECT COUNT(*) as total
            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            ${whereClause}
        `;

        const [countResult] = await sequelize.query(countQuery, { 
            bind: replacements.slice(0, -2) // Enlever limit et offset pour le count
        });

        const totalOrders = parseInt(countResult[0].total);
        const totalPages = Math.ceil(totalOrders / limit);

        // ✅ TRAITEMENT DES DONNÉES DE COMMANDES
        const processedOrders = orders.map(order => {
            // Calcul des informations de tailles
            const totalItems = parseInt(order.total_items) || 0;
            const itemsWithSize = parseInt(order.items_with_size) || 0;
            const sizesCoverage = totalItems > 0 ? Math.round((itemsWithSize / totalItems) * 100) : 0;

            // Parse des détails d'articles
            let itemsDetails = [];
            try {
                itemsDetails = order.items_details ? JSON.parse(order.items_details) : [];
            } catch (e) {
                console.warn(`⚠️ Erreur parsing items pour commande ${order.id}:`, e.message);
                itemsDetails = [];
            }

            // Calcul des montants
            const subtotal = parseFloat(order.subtotal) || 0;
            const discountAmount = parseFloat(order.discount_amount) || 0;
            const total = parseFloat(order.total) || 0;
            const savings = subtotal - total;

            return {
                id: order.id,
                numero_commande: order.numero_commande,
                customer_id: order.customer_id,
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                customerPhone: order.customer_phone,
                
                // Montants
                total: total,
                subtotal: subtotal,
                discountAmount: discountAmount,
                savings: Math.max(savings, discountAmount),
                
                // Statut et dates
                status: this.normalizeStatus(order.status),
                statusDisplay: this.translateStatus(this.normalizeStatus(order.status)),
                statusClass: this.getStatusClass(this.normalizeStatus(order.status)),
                createdAt: order.created_at,
                updatedAt: order.updated_at,
                createdAtLocal: order.created_at_local,
                dateDisplay: this.formatDateTime(order.created_at_local),
                timeAgo: this.getTimeAgo(order.created_at),
                
                // Code promo
                promoCode: order.promo_code,
                hasPromo: !!order.promo_code,
                discountPercent: parseFloat(order.discount_percent) || 0,
                
                // Livraison
                trackingNumber: order.tracking_number,
                shippingMethod: order.shipping_method,
                paymentMethod: order.payment_method,
                paymentMethodDisplay: this.getPaymentMethodDisplay(order.payment_method),
                paymentStatus: order.payment_status,
                
                // Tailles
                totalItems: totalItems,
                itemsWithSize: itemsWithSize,
                sizesCoverage: sizesCoverage,
                sizesInfo: {
                    totalItems,
                    itemsWithSize,
                    sizesCoverage,
                    hasSizeInfo: itemsWithSize > 0,
                    sizesDisplay: itemsWithSize > 0 ? 
                        `${itemsWithSize}/${totalItems} articles` : 
                        'Aucune taille',
                    coverageClass: sizesCoverage === 100 ? 'success' : 
                                   sizesCoverage > 50 ? 'warning' : 'danger'
                },
                
                // Articles
                itemsDetails: itemsDetails,
                itemsCount: itemsDetails.length,
                
                // Adresse
                shippingAddress: order.shipping_address,
                
                // Debug (à retirer en production)
                _debug: {
                    orderEmail: order.order_customer_email,
                    customerTableEmail: order.customer_table_email,
                    firstName: order.customer_first_name,
                    lastName: order.customer_last_name,
                    finalEmail: order.customer_email
                }
            };
        });

        // ✅ CALCUL DES STATISTIQUES
        const stats = this.calculateOrderStats(processedOrders);
        const statusStats = this.calculateStatusStats(processedOrders);

        // ✅ LOG DES RÉSULTATS
        const emailsManquants = processedOrders.filter(cmd => 
            cmd.customerEmail === 'Email non renseigné'
        ).length;
        
        console.log(`📊 Commandes récupérées: ${processedOrders.length}/${totalOrders}`);
        console.log(`📧 Emails manquants: ${emailsManquants} commandes`);
        console.log(`📏 Commandes avec tailles: ${processedOrders.filter(cmd => cmd.itemsWithSize > 0).length}`);

        // ✅ RENDU DE LA VUE
        res.render('commandes', {
            title: 'Gestion des Commandes',
            user: req.session.user,
            
            // Données principales
            commandes: processedOrders,
            stats: stats,
            statusStats: statusStats,
            
            // Filtres actuels
            filters: {
                status: filterStatus || 'all',
                date: filterDate || '',
                search: filterSearch || '',
                promo: filterPromo || ''
            },
            
            // Pagination
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalOrders: totalOrders,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                limit: limit
            },
            
            // Fonctions helpers pour le template
            helpers: {
                formatPrice: (price) => (parseFloat(price) || 0).toLocaleString('fr-FR', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                }),
                formatDate: (date) => this.formatDateTime(date),
                formatTimeAgo: (date) => this.getTimeAgo(date),
                translateStatus: (status) => this.translateStatus(status),
                getStatusClass: (status) => this.getStatusClass(status),
                hasPromoCode: (order) => !!order.promoCode,
                getSizesCoverageIndicator: (sizesInfo) => {
                    if (!sizesInfo || sizesInfo.totalItems === 0) return '❓ Non défini';
                    const coverage = sizesInfo.sizesCoverage || 0;
                    if (coverage === 100) return '🎯 Complète';
                    if (coverage > 50) return '📏 Partielle';
                    if (coverage > 0) return '📐 Limitée';
                    return '❓ Aucune';
                }
            }
        });

    } catch (error) {
        console.error('❌ Erreur lors de la récupération des commandes:', error);
        console.error('Stack trace:', error.stack);
        
        res.status(500).render('error', {
            title: 'Erreur',
            message: 'Erreur lors de la récupération des commandes',
            error: process.env.NODE_ENV === 'development' ? error : {},
            user: req.session.user
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

// ✅ AJOUT DE LA FONCTION HELPER DANS LE CONTROLLER
getPaymentMethodDisplay(paymentMethod) {
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
    // 📊 DASHBOARD PRINCIPAL
    // ========================================

    async showDashboard(req, res) {
        try {
            console.log('🎯 Chargement dashboard admin avec gestion des tailles');
            
            
            // Normaliser les statuts avant affichage
            await adminOrdersController.normalizeOrderStatuses();

            // Récupérer les statistiques générales
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
            const statsData = statsResult[0] || {};

            // Formater les statistiques
            const stats = {
                totalCommandes: {
                    label: "Total commandes",
                    value: parseInt(statsData.total_orders) || 0,
                    trend: parseFloat(statsData.orders_trend_percent) || 0,
                    direction: (parseFloat(statsData.orders_trend_percent) || 0) >= 0 ? 'up' : 'down',
                    compared: "vs mois dernier"
                },
                chiffreAffaires: {
                    label: "Chiffre d'affaires",
                    value: parseFloat(statsData.total_revenue) || 0,
                    trend: parseFloat(statsData.revenue_trend_percent) || 0,
                    direction: (parseFloat(statsData.revenue_trend_percent) || 0) >= 0 ? 'up' : 'down',
                    compared: "vs mois dernier"
                },
                codesPromoUtilises: {
                    label: "Codes promo utilisés",
                    value: parseInt(statsData.orders_with_promo) || 0,
                    trend: parseFloat(statsData.promo_trend_percent) || 0,
                    direction: (parseFloat(statsData.promo_trend_percent) || 0) >= 0 ? 'up' : 'down',
                    compared: "vs mois dernier"
                },
                economiesClients: {
                    label: "Économies clients",
                    value: parseFloat(statsData.total_discounts) || 0,
                    trend: parseFloat(statsData.promo_trend_percent) || 0,
                    direction: 'down',
                    compared: "réductions totales"
                }
            };

            const statusStats = {
                waiting: parseInt(statsData.waiting_orders) || 0,
                preparing: parseInt(statsData.preparing_orders) || 0,
                shipped: parseInt(statsData.shipped_orders) || 0,
                delivered: parseInt(statsData.delivered_orders) || 0,
                cancelled: parseInt(statsData.cancelled_orders) || 0
            };

            // Récupérer les commandes avec informations complètes de tailles
            const ordersQuery = `
                SELECT 
                    o.id,
                    o.numero_commande,
                    o.created_at,
                    COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as customer_name,
                    COALESCE(o.customer_email, c.email, 'N/A') as customer_email,
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
                    
                    -- Récupération des tailles depuis ORDER_ITEMS
                    (
                        SELECT JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'nom_article', COALESCE(j.name, jw.name, 'Article'),
                                'taille', COALESCE(oi.size, 'Non spécifiée'),
                                'quantite', COALESCE(oi.quantity, 1),
                                'prix', COALESCE(oi.price, j.price_ttc, jw.price_ttc, 0),
                                'matiere', COALESCE(j.matiere, jw.matiere, ''),
                                'image', COALESCE(j.image, jw.image, '/images/placeholder.jpg')
                            )
                            ORDER BY oi.id
                        )
                        FROM order_items oi
                        LEFT JOIN jewel j ON oi.jewel_id = j.id
                        LEFT JOIN jewels jw ON oi.jewel_id = jw.id
                        WHERE oi.order_id = o.id
                    ) as articles_details,
                    
                    -- Fallback : ORDER_HAS_JEWEL si ORDER_ITEMS est vide
                    (
                        SELECT JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'nom_article', COALESCE(j.name, jw.name, 'Article'),
                                'taille', 'Non spécifiée',
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
                    
                    -- Compter les articles avec tailles spécifiées
                    (
                        SELECT COUNT(*)
                        FROM order_items oi
                        WHERE oi.order_id = o.id
                        AND oi.size IS NOT NULL 
                        AND oi.size != '' 
                        AND oi.size != 'Non spécifiée'
                    ) as articles_avec_tailles,
                    
                    -- Compter le total d'articles
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
                ORDER BY o.created_at DESC
                LIMIT 100
            `;

            const [ordersResult] = await sequelize.query(ordersQuery);
            
            // Formatage des commandes avec calculs de tailles
            const commandes = ordersResult.map(order => {
                console.log(`📋 Traitement commande #${order.id}`);

                // Calculs financiers
                const originalAmount = parseFloat(order.original_total) || parseFloat(order.total) || 0;
                const discountAmount = Math.max(
                    parseFloat(order.discount_amount) || 0,
                    parseFloat(order.promo_discount_amount) || 0,
                    parseFloat(order.promo_discount) || 0
                );
                const discountPercent = Math.max(
                    parseInt(order.discount_percent) || 0,
                    parseInt(order.promo_discount_percent) || 0
                );
                const finalAmount = parseFloat(order.total) || 0;
                
                const calculatedOriginal = discountAmount > 0 && originalAmount === finalAmount 
                    ? finalAmount + discountAmount 
                    : originalAmount;

                // Traitement des articles et tailles
                let articlesDetails = [];
                let totalArticles = 0;
                let articlesAvecTailles = 0;

                // Priorité 1: order_items (plus récent et complet)
                if (order.articles_details && Array.isArray(order.articles_details)) {
                    articlesDetails = order.articles_details;
                    totalArticles = parseInt(order.total_articles_order_items) || 0;
                    articlesAvecTailles = parseInt(order.articles_avec_tailles) || 0;
                }
                // Fallback: order_has_jewel (ancien système)
                else if (order.articles_details_fallback && Array.isArray(order.articles_details_fallback)) {
                    articlesDetails = order.articles_details_fallback;
                    totalArticles = parseInt(order.total_articles_fallback) || 0;
                    articlesAvecTailles = 0; // Ancien système sans tailles
                }

                // Calculer la couverture des tailles
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

                return {
                    id: order.id,
                    numero_commande: order.numero_commande || `CMD-${order.id}`,
                    date: new Date(order.created_at).toLocaleDateString('fr-FR'),
                    dateTime: new Date(order.created_at).toLocaleString('fr-FR'),
                    customerName: order.customer_name,
                    customerEmail: order.customer_email,
                    amount: finalAmount,
                    originalAmount: calculatedOriginal,
                    deliveryMode: order.shipping_method,
                    status: adminOrdersController.normalizeStatus(order.status),
                    trackingNumber: order.tracking_number,
                    phone: order.phone,
                    shippingAddress: order.shipping_address,
                    shippingCity: order.shipping_city,
                    notes: order.notes,
                    
                    // Codes promo
                    promo_code: order.promo_code,
                    discount_amount: discountAmount,
                    discount_percent: discountPercent,
                    hasDiscount: discountAmount > 0 || order.promo_code,
                    savings: discountAmount,
                    
                    // Informations tailles
                    sizesInfo: sizesInfo,
                    articlesDetails: articlesDetails
                };
            });

            // Rendu de la page avec toutes les données
            res.render('commandes', {
                title: 'Administration - Suivi des Commandes',
                user: req.session.user,
                stats: stats,
                statusStats: statusStats,
                commandes: commandes,
                getStatusClass: adminOrdersController.getStatusClass.bind(adminOrdersController),
                translateStatus: adminOrdersController.translateStatus.bind(adminOrdersController),
                
                // Fonctions helpers pour les tailles dans EJS
                getTaillesFromOrder: function(commande) {
                    return commande.sizesInfo || null;
                },
                
                formatSizesDisplay: function(sizesInfo) {
                    if (!sizesInfo || !sizesInfo.hasSizeInfo) {
                        return 'Non spécifiées';
                    }
                    return sizesInfo.sizesDisplay || 'Tailles standards';
                },
                
                getSizesCoverageIndicator: function(sizesInfo) {
                    if (!sizesInfo || sizesInfo.totalItems === 0) {
                        return '❓ En développement';
                    }
                    
                    const coverage = sizesInfo.sizesCoverage || 0;
                    if (coverage === 100) return '🎯 Complète';
                    if (coverage > 50) return '📏 Partielle';
                    if (coverage > 0) return '📐 Limitée';
                    return '❓ Aucune';
                },
                
                // Helpers existants
                helpers: {
                    formatDate: (date) => date ? new Date(date).toLocaleDateString('fr-FR') : 'N/A',
                    formatPrice: (price) => (parseFloat(price) || 0).toLocaleString('fr-FR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    }),
                    
                    // Helpers codes promo
                    hasPromoCode: (commande) => !!(commande.promo_code || commande.hasDiscount),
                    getPromoSavings: (commande) => commande.discount_amount > 0 ? `-${commande.discount_amount.toFixed(2)}€` : '',
                    formatPercent: (percent) => percent > 0 ? `${percent}%` : '',
                    formatPromoCode: (promoCode) => promoCode ? promoCode.toUpperCase() : 'Aucun',
                    calculateSavings: (originalAmount, finalAmount) => {
                        const savings = parseFloat(originalAmount) - parseFloat(finalAmount);
                        return savings > 0 ? savings.toFixed(2) : '0.00';
                    },
                    hasSignificantDiscount: (discountAmount) => parseFloat(discountAmount) >= 5,
                    
                    // Helpers pour les tailles
                    formatSizes: (sizesInfo) => {
                        if (!sizesInfo || !sizesInfo.hasSizeInfo) return 'Non spécifiées';
                        return sizesInfo.sizesDisplay;
                    },
                    getSizesCoverage: (sizesInfo) => {
                        if (!sizesInfo) return 0;
                        return sizesInfo.sizesCoverage || 0;
                    },
                    getSizesIndicator: (sizesInfo) => {
                        if (!sizesInfo || sizesInfo.totalItems === 0) return '❓ En développement';
                        const coverage = sizesInfo.sizesCoverage || 0;
                        if (coverage === 100) return '🎯 Complète';
                        if (coverage > 50) return '📏 Partielle';
                        if (coverage > 0) return '📐 Limitée';
                        return '❓ Aucune';
                    },
                    
                    // Helper pour les couleurs des badges
                    getStatusBadgeColor: (status) => {
                        const colors = {
                            'waiting': '#f59e0b',
                            'preparing': '#3b82f6', 
                            'shipped': '#10b981',
                            'delivered': '#059669',
                            'cancelled': '#ef4444'
                        };
                        return colors[status] || '#6b7280';
                    }
                }
            });

        } catch (error) {
            console.error("❌ Erreur dashboard admin:", error);
            res.status(500).render('error', { 
                message: 'Erreur lors du chargement des commandes: ' + error.message,
                user: req.session.user 
            });
        }
    },

    // ========================================
    // 🔍 DÉTAILS D'UNE COMMANDE
    // ========================================

   // 🔧 FIX ERREUR 500 - getOrderDetails sans erreurs de méthodes

async getOrderDetails(req, res) {
    try {
        const { id } = req.params;
        console.log(`🔍 Récupération détails commande #${id} avec email client corrigé`);

        // ✅ REQUÊTE CORRIGÉE SANS o.email
        const orderQuery = `
            SELECT 
                o.*,
                
                -- ✅ EMAIL CLIENT SANS o.email
                COALESCE(
                    o.customer_email,
                    o.user_email,
                    c.email,
                    c.user_email,
                    'N/A'
                ) as customer_email,
                
                -- ✅ NOM CLIENT
                COALESCE(
                    o.customer_name,
                    CONCAT(TRIM(c.first_name), ' ', TRIM(c.last_name)),
                    CONCAT(TRIM(c.prenom), ' ', TRIM(c.nom)),
                    c.name,
                    c.username,
                    'Client inconnu'
                ) as customer_name,
                
                -- ✅ COLONNES DEBUG SANS o.email
                o.customer_email as order_email,
                c.email as customer_table_email,
                c.user_email as customer_user_email,
                c.first_name,
                c.last_name,
                c.prenom,
                c.nom,
                
                o.total,
                o.status,
                o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris' as created_at_local,
                o.order_date AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris' as order_date_local,
                o.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris' as updated_at_local,
                o.promo_code,
                o.promo_discount_amount,
                o.promo_discount_percent,
                o.discount_amount,
                o.original_amount,
                o.original_total,
                o.subtotal,
                o.tracking_number,
                COALESCE(o.payment_method, 'card') as payment_method,
                COALESCE(o.payment_status, 'pending') as payment_status,
                o.shipping_address,
                o.shipping_phone,
                c.phone
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
        
        // ✅ DEBUG DE L'EMAIL RÉCUPÉRÉ
        console.log(`📧 Email pour commande #${id}:`, {
            customer_id: order.customer_id,
            customer_email_final: order.customer_email,
            first_name: order.first_name,
            last_name: order.last_name
        });

        // ... reste du code pour items, tracking, history ...

        const response = {
            success: true,
            order: {
                ...order,
                email: {
                    display: order.customer_email,
                    final_used: order.customer_email || 'Email non renseigné'
                }
            },
            // ... autres données ...
        };

        console.log(`✅ Détails commande #${id} - Email final: "${response.order.email.final_used}"`);
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur détails commande:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des détails: ' + error.message
        });
    }
},

    // ========================================
    // ✏️ MODIFICATION D'UNE COMMANDE
    // ========================================

   // ✏️ MODIFICATION SIMPLE D'UNE COMMANDE  
async updateOrder(req, res) {
    const orderId = req.params.id;
    const { status, tracking_number, notes } = req.body;
    
    try {
        console.log(`🔄 Mise à jour commande ${orderId}:`, { status, tracking_number, notes });

        // ✅ REQUÊTE SQL SANS o.email
        const existingOrderQuery = `
            SELECT 
                o.*,
                
                -- ✅ EMAIL CLIENT SANS o.email
                COALESCE(
                    o.customer_email,
                    o.user_email,
                    c.email,
                    c.user_email
                ) as customer_email,
                
                -- ✅ NOM CLIENT
                COALESCE(
                    o.customer_name,
                    CONCAT(TRIM(c.first_name), ' ', TRIM(c.last_name)),
                    CONCAT(TRIM(c.prenom), ' ', TRIM(c.nom)),
                    c.name,
                    c.username,
                    'Client inconnu'
                ) as customer_name,
                
                -- ✅ TÉLÉPHONE CLIENT
                COALESCE(
                    o.customer_phone,
                    c.phone,
                    c.telephone
                ) as customer_phone,
                
                COALESCE(o.status, 'pending') as current_status,
                c.first_name,
                c.last_name,
                c.prenom,
                c.nom
            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            WHERE o.id = $1
        `;
        
        console.log('📋 Exécution requête SQL corrigée...');
        
        const [existingResult] = await sequelize.query(existingOrderQuery, { 
            bind: [orderId]
        });
        
        if (!existingResult || existingResult.length === 0) {
            console.error(`❌ Commande ${orderId} non trouvée`);
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }

        const existingOrder = existingResult[0];
        const oldStatus = existingOrder.current_status || existingOrder.status;
        const customerEmail = existingOrder.customer_email;
        const customerPhone = existingOrder.customer_phone;

        console.log(`📧 Email client trouvé: "${customerEmail}"`);
        console.log(`📱 Téléphone client: "${customerPhone || 'Non fourni'}"`);
        console.log(`🔄 Changement statut: "${oldStatus}" → "${status}"`);

        // ✅ MISE À JOUR EN BASE DE DONNÉES
        await sequelize.transaction(async (t) => {
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

            // Historique...
            if (status !== oldStatus) {
                const adminName = req.session?.user?.email || 'Admin';
                try {
                    await sequelize.query(`
                        INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
                        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                    `, {
                        bind: [orderId, oldStatus, status, `Statut: ${oldStatus} → ${status}`, adminName],
                        transaction: t
                    });
                } catch (historyError) {
                    console.warn('⚠️ Historique non ajouté:', historyError.message);
                }
            }
        });

        console.log(`✅ Commande ${orderId} mise à jour: ${oldStatus} → ${status}`);

        // ✅ NOTIFICATIONS (EMAIL + SMS)
        let notificationResults = { email: { success: false }, sms: { success: false }, success: false };
        
        if (status !== oldStatus && customerEmail && customerEmail !== 'N/A' && customerEmail.includes('@')) {
            try {
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
                console.error('⚠️ Erreur notifications:', notificationError);
                notificationResults = {
                    email: { success: false, error: notificationError.message },
                    sms: { success: false, error: notificationError.message },
                    success: false
                };
            }
        }

        // ✅ RÉPONSE FINALE
        res.json({
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
                }
            }
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour commande:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour: ' + error.message,
            debug: process.env.NODE_ENV === 'development' ? {
                error: error.message,
                stack: error.stack,
                orderId: orderId
            } : undefined
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

   async updateOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { status: newStatus, trackingNumber, carrier, notes } = req.body;
      const updatedBy = req.session?.user?.email || 'Admin';

      console.log(`🔄 Mise à jour statut commande ${orderId}:`, {
        newStatus,
        trackingNumber,
        updatedBy
      });

      // Récupérer la commande
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

      const oldStatus = order.status;

      // Mettre à jour la commande
      await order.update({
        status: newStatus,
        tracking_number: trackingNumber || order.tracking_number,
        carrier: carrier || order.carrier,
        notes: notes || order.notes,
        updated_at: new Date()
      });

      console.log(`✅ Statut commande ${orderId} mis à jour: ${oldStatus} → ${newStatus}`);

      // Préparer les données pour les notifications
      const orderData = {
        id: order.id,
        numero_commande: order.numero_commande || `CMD-${order.id}`,
        tracking_number: order.tracking_number,
        total: order.total,
        subtotal: order.subtotal,
        customer_name: order.customer ? 
          `${order.customer.first_name} ${order.customer.last_name}` : 
          order.customer_name || 'Client'
      };

      const customerData = {
        userEmail: order.customer?.email || order.customer_email,
        firstName: order.customer?.first_name || order.customer_name?.split(' ')[0] || 'Client',
        lastName: order.customer?.last_name || order.customer_name?.split(' ').slice(1).join(' ') || '',
        phone: order.customer?.phone || order.customer_phone
      };

      const statusChangeData = {
        oldStatus,
        newStatus,
        updatedBy
      };

      // 🆕 ENVOI EMAIL + SMS selon le nouveau statut
      let notificationResults = {
        email: { success: false },
        sms: { success: false },
        success: false
      };

      try {
        console.log('📧📱 Envoi notifications changement statut...');
        
        notificationResults = await sendStatusChangeNotifications(
          orderData,
          statusChangeData,
          customerData
        );

        console.log('📊 Résultats notifications:', {
          email: notificationResults.email.success ? '✅' : '❌',
          sms: notificationResults.sms.success ? '✅' : '❌',
          customerEmail: customerData.userEmail,
          customerPhone: customerData.phone ? `${customerData.phone.substring(0, 4)}...` : 'Non disponible'
        });

      } catch (notificationError) {
        console.error('❌ Erreur notifications:', notificationError);
        notificationResults = {
          email: { success: false, error: notificationError.message },
          sms: { success: false, error: notificationError.message },
          success: false
        };
      }

      // Réponse avec détails des notifications
      const response = {
        success: true,
        message: 'Statut de commande mis à jour',
        data: {
          order: {
            id: order.id,
            numero_commande: order.numero_commande,
            status: order.status,
            tracking_number: order.tracking_number,
            oldStatus,
            newStatus
          },
          statusChanged: oldStatus !== newStatus,
          notifications: {
            emailSent: notificationResults.email.success,
            smsSent: notificationResults.sms.success,
            anyNotificationSent: notificationResults.success,
            details: {
              email: notificationResults.email,
              sms: notificationResults.sms
            }
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('❌ Erreur mise à jour statut commande:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut',
        error: error.message
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