
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
async getAllOrders(req, res) {
    try {
        console.log('📋 Récupération commandes avec emails clients corrigés');

        // ✅ REQUÊTE CORRIGÉE AVEC TOUTES LES SOURCES D'EMAIL POSSIBLES
        const commandesQuery = `
            SELECT 
                o.id,
                o.numero_commande,
                o.customer_id,
                
                -- ✅ RÉCUPÉRATION COMPLÈTE DES EMAILS
                COALESCE(
                    o.customer_email,     -- Email stocké directement dans orders
                    o.email,              -- Autre colonne possible dans orders
                    o.user_email,         -- Encore une autre possibilité
                    c.email,              -- Email depuis la table customer
                    c.user_email,         -- Autre colonne possible dans customer
                    'N/A'
                ) as customer_email,
                
                -- ✅ RÉCUPÉRATION COMPLÈTE DES NOMS
                COALESCE(
                    o.customer_name,
                    CONCAT(TRIM(c.first_name), ' ', TRIM(c.last_name)),
                    CONCAT(TRIM(c.prenom), ' ', TRIM(c.nom)),
                    c.name,
                    c.username,
                    'Client inconnu'
                ) as customer_name,
                
                -- ✅ COLONNES SÉPARÉES POUR DEBUG
                o.customer_email as order_email,
                o.email as order_email_alt,
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
            ORDER BY o.created_at DESC
        `;

        const [commandesResult] = await sequelize.query(commandesQuery);
        
        // ✅ DEBUG DES EMAILS RÉCUPÉRÉS
        console.log('🔍 DEBUG EMAILS pour les 3 premières commandes:');
        commandesResult.slice(0, 3).forEach((cmd, index) => {
            console.log(`Commande ${index + 1} (ID: ${cmd.id}):`, {
                customer_id: cmd.customer_id,
                customer_email_final: cmd.customer_email,
                order_email: cmd.order_email,
                order_email_alt: cmd.order_email_alt,
                customer_table_email: cmd.customer_table_email,
                customer_user_email: cmd.customer_user_email,
                customer_name: cmd.customer_name
            });
        });

        // ✅ TRAITEMENT AVEC VALIDATION EMAIL
        const commandes = commandesResult.map(commande => {
            const total = parseFloat(commande.total || 0);
            const discountAmount = parseFloat(commande.promo_discount_amount || commande.discount_amount || 0);
            const originalAmount = parseFloat(commande.original_amount || commande.original_total || (total + discountAmount));
            
            const mainDate = commande.created_at_local || commande.order_date_local || commande.created_at;

            return {
                ...commande,
                // ✅ DATES CORRIGÉES
                date: this.formatDateTime(mainDate).split(' ')[0],
                dateTime: this.formatDateTime(mainDate),
                timeAgo: this.getTimeAgo(mainDate),
                
                // ✅ CALCULS FINANCIERS
                amount: total,
                finalTotal: total,
                originalAmount: originalAmount,
                discountAmount: discountAmount,
                hasDiscount: discountAmount > 0,
                
                // ✅ PAIEMENT
                payment_method: commande.payment_method,
                payment_method_display: this.getPaymentMethodDisplay(commande.payment_method),
                payment_status: commande.payment_status,
                
                // ✅ STATUT NORMALISÉ
                status: this.normalizeStatus(commande.status),
                
                // ✅ INFORMATIONS CLIENT AVEC VALIDATION
                customerName: commande.customer_name,
                customerEmail: commande.customer_email, // Déjà traité par COALESCE
                phone: commande.shipping_phone || commande.phone,
                
                // ✅ DEBUG INFO (à retirer plus tard)
                _debug: {
                    customer_id: commande.customer_id,
                    emails_found: {
                        order_email: commande.order_email,
                        customer_table_email: commande.customer_table_email,
                        final_email: commande.customer_email
                    }
                }
            };
        });

        // ✅ COMPTER LES EMAILS MANQUANTS
        const emailsManquants = commandes.filter(cmd => cmd.customerEmail === 'N/A').length;
        console.log(`📊 Emails manquants: ${emailsManquants}/${commandes.length} commandes`);

        // Render normal...
        res.render('commandes', {
            title: 'Gestion des Commandes',
            commandes: commandes,
            stats: this.calculateStats(commandes),
            statusStats: this.calculateStatusStats(commandes),
            helpers: {
                formatPrice: (price) => parseFloat(price || 0).toFixed(2),
                formatDate: (date) => this.formatDateTime(date),
                getTimeAgo: (date) => this.getTimeAgo(date)
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



async getOrderDetails(req, res) {
    try {
        const { id } = req.params;
        console.log(`🔍 Récupération détails commande #${id} avec email client corrigé`);

        // ✅ REQUÊTE CORRIGÉE AVEC TOUS LES CHAMPS EMAIL POSSIBLES
        const orderQuery = `
            SELECT 
                o.*,
                
                -- ✅ RÉCUPÉRATION COMPLÈTE DES EMAILS
                COALESCE(
                    o.customer_email,
                    o.email,
                    o.user_email,
                    c.email,
                    c.user_email,
                    'N/A'
                ) as customer_email,
                
                -- ✅ RÉCUPÉRATION COMPLÈTE DES NOMS
                COALESCE(
                    o.customer_name,
                    CONCAT(TRIM(c.first_name), ' ', TRIM(c.last_name)),
                    CONCAT(TRIM(c.prenom), ' ', TRIM(c.nom)),
                    c.name,
                    c.username,
                    'Client inconnu'
                ) as customer_name,
                
                -- ✅ DONNÉES SÉPARÉES POUR DEBUG
                c.first_name,
                c.last_name,
                c.prenom,
                c.nom,
                c.phone,
                
                COALESCE(o.shipping_address, c.address, c.adresse) as shipping_address,
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
        
        // ✅ DEBUG DE L'EMAIL RÉCUPÉRÉ
        console.log(`📧 Email pour commande #${id}:`, {
            customer_id: order.customer_id,
            customer_email_final: order.customer_email,
            first_name: order.first_name,
            last_name: order.last_name
        });

        // ... reste du code pour items, history, etc. ...

        const response = {
            success: true,
            order: {
                ...order,
                status: this.normalizeStatus(order.current_status),
                date: new Date(order.created_at).toLocaleDateString('fr-FR'),
                dateTime: new Date(order.created_at).toLocaleString('fr-FR'),
                hasDiscount: parseFloat(order.promo_discount_amount || 0) > 0 || order.promo_code,
                payment_method: order.payment_method,
                payment_status: order.payment_status,
                payment_method_display: this.getPaymentMethodDisplay(order.payment_method)
            },
            items: [], // processedItems,
            tracking: [], // tracking,
            history: [], // history,
            summary: {
                originalSubtotal: parseFloat(order.original_amount || order.total || 0),
                discount: parseFloat(order.promo_discount_amount || 0),
                subtotal: parseFloat(order.subtotal || order.total || 0),
                shipping: parseFloat(order.shipping_price || 0),
                total: parseFloat(order.total || 0)
            }
        };

        res.json(response);

    } catch (error) {
        console.error('❌ Erreur détails commande:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des détails: ' + error.message
        });
    }
},

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
        console.log(`🔍 Récupération détails commande #${id}`);

        // ✅ REQUÊTE SIMPLIFIÉE SANS FORCER 'N/A'
        const orderQuery = `
            SELECT 
                o.*,
                COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as customer_name,
                COALESCE(o.customer_email, c.email) as customer_email,
                c.phone,
                c.first_name,
                c.last_name,
                c.email as client_table_email,
                COALESCE(o.shipping_address, c.address) as shipping_address,
                COALESCE(o.status, o.status_suivi, 'waiting') as current_status,
                o.tracking_number,
                o.notes as internal_notes
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

        // ✅ DEBUG EMAIL
        console.log(`📧 Email debug commande #${id}:`, {
            customer_email: order.customer_email,
            client_table_email: order.client_table_email,
            final: order.customer_email || order.client_table_email
        });

        // ✅ ARTICLES DE LA COMMANDE
        let itemsQuery = `
            SELECT 
                oi.*,
                COALESCE(j.name, jw.name, 'Article supprimé') as jewel_name,
                COALESCE(j.description, jw.description, '') as description,
                COALESCE(j.image, jw.image, '/images/placeholder.jpg') as image,
                COALESCE(j.matiere, jw.matiere, 'N/A') as matiere,
                COALESCE(j.carat, jw.carat) as carat,
                COALESCE(j.poids, jw.poids) as poids,
                COALESCE(c.name, 'Bijoux') as category_name,
                COALESCE(oi.price, j.price_ttc, jw.price_ttc, 0) as unit_price,
                (COALESCE(oi.quantity, 1) * COALESCE(oi.price, j.price_ttc, jw.price_ttc, 0)) as total_price,
                COALESCE(
                    CASE 
                        WHEN oi.size IS NOT NULL AND oi.size != '' AND oi.size != 'null' 
                        THEN oi.size 
                        ELSE NULL 
                    END, 
                    'Non spécifiée'
                ) as size_commandee
            FROM order_items oi
            LEFT JOIN jewel j ON oi.jewel_id = j.id
            LEFT JOIN jewels jw ON oi.jewel_id = jw.id
            LEFT JOIN category c ON COALESCE(j.category_id, jw.category_id) = c.id
            WHERE oi.order_id = $1
            ORDER BY oi.id
        `;

        let [itemsResult] = await sequelize.query(itemsQuery, { bind: [id] });

        // Si order_items est vide, essayer order_has_jewel
        if (itemsResult.length === 0) {
            console.log('⚠️ order_items vide, utilisation de order_has_jewel...');
            itemsQuery = `
                SELECT 
                    ohj.order_id,
                    ohj.jewel_id as jewel_id,
                    ohj.quantity,
                    ohj.unit_price as price,
                    COALESCE(j.name, jw.name, 'Article supprimé') as jewel_name,
                    COALESCE(j.description, jw.description, '') as description,
                    COALESCE(j.image, jw.image, '/images/placeholder.jpg') as image,
                    COALESCE(j.matiere, jw.matiere, 'N/A') as matiere,
                    COALESCE(j.carat, jw.carat) as carat,
                    COALESCE(j.poids, jw.poids) as poids,
                    COALESCE(c.name, 'Bijoux') as category_name,
                    COALESCE(ohj.unit_price, j.price_ttc, jw.price_ttc, 0) as unit_price,
                    (COALESCE(ohj.quantity, 1) * COALESCE(ohj.unit_price, j.price_ttc, jw.price_ttc, 0)) as total_price,
                    'Non spécifiée' as size_commandee
                FROM order_has_jewel ohj
                LEFT JOIN jewel j ON ohj.jewel_id = j.id
                LEFT JOIN jewels jw ON ohj.jewel_id = jw.id
                LEFT JOIN category c ON COALESCE(j.category_id, jw.category_id) = c.id
                WHERE ohj.order_id = $1
                ORDER BY ohj.jewel_id
            `;
            [itemsResult] = await sequelize.query(itemsQuery, { bind: [id] });
        }

        // ✅ TRAITEMENT DES ARTICLES
        const processedItems = itemsResult.map(item => ({
            ...item,
            name: item.jewel_name,
            price: parseFloat(item.unit_price || 0),
            total: parseFloat(item.total_price || 0),
            quantity: parseInt(item.quantity || 1),
            size: item.size_commandee || 'Non spécifiée',
            sizeDisplay: item.size_commandee && item.size_commandee !== 'Non spécifiée' 
                ? `Taille commandée: ${item.size_commandee}`
                : 'Taille non spécifiée lors de la commande',
            hasSizeInfo: item.size_commandee && item.size_commandee !== 'Non spécifiée',
            matiere: item.matiere,
            carat: item.carat,
            poids: item.poids
        }));

        // ✅ RÉCUPÉRER L'HISTORIQUE - SANS MÉTHODES this.
        let history = [];
        let modifications = [];

        try {
            const historyQuery = `
                SELECT 
                    old_status,
                    new_status,
                    notes,
                    updated_by,
                    created_at,
                    DATE_FORMAT(created_at, '%d/%m/%Y à %H:%i') as formatted_date
                FROM order_status_history 
                WHERE order_id = $1 
                ORDER BY created_at DESC
            `;
            const [historyResult] = await sequelize.query(historyQuery, { bind: [id] });
            
            // ✅ FONCTIONS UTILITAIRES LOCALES
            const translateStatus = (status) => {
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
                return statusMap[status] || status;
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
            
            history = historyResult.map(h => ({
                ...h,
                modification_type: 'status_change',
                description: h.notes || `Statut modifié: ${h.old_status} → ${h.new_status}`,
                modified_by: h.updated_by,
                old_status_display: translateStatus(h.old_status),
                new_status_display: translateStatus(h.new_status),
                time_ago: getTimeAgo(h.created_at)
            }));
            
            modifications = history; // ✅ POUR LA SECTION JAUNE
            console.log(`📋 ${history.length} modifications trouvées`);
        } catch (historyError) {
            console.log('⚠️ Erreur récupération historique:', historyError.message);
        }

        // ✅ RÉCUPÉRER LE SUIVI
        let tracking = [];
        try {
            const trackingQuery = `
                SELECT 
                    status,
                    description,
                    location,
                    created_at,
                    created_at as formatted_date
                FROM order_tracking 
                WHERE order_id = $1 
                ORDER BY created_at DESC
            `;
            const [trackingResult] = await sequelize.query(trackingQuery, { bind: [id] });
            
            const translateStatus = (status) => {
                const statusMap = {
                    'waiting': 'En attente',
                    'preparing': 'En préparation', 
                    'shipped': 'Expédiée',
                    'delivered': 'Livrée',
                    'cancelled': 'Annulée'
                };
                return statusMap[status] || status;
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
            
            tracking = trackingResult.map(t => ({
                ...t,
                status_display: translateStatus(t.status),
                time_ago: getTimeAgo(t.created_at)
            }));
            console.log(`📦 ${tracking.length} événements de suivi trouvés`);
        } catch (trackingError) {
            console.log('⚠️ Erreur récupération suivi:', trackingError.message);
        }

        // ✅ CALCULS FINAUX
        const originalAmount = parseFloat(order.original_total) || parseFloat(order.total) || 0;
        const discountAmount = parseFloat(order.discount_amount) || parseFloat(order.promo_discount_amount) || 0;
        const finalTotal = parseFloat(order.total) || 0;
        const shipping = parseFloat(order.shipping_price) || 0;

        // ✅ FONCTION DE NORMALISATION DE STATUT LOCALE
        const normalizeStatus = (status) => {
            const statusMap = {
                'en_attente': 'waiting',
                'preparation': 'preparing',
                'expediee': 'shipped', 
                'livree': 'delivered',
                'annulee': 'cancelled'
            };
            return statusMap[status] || status;
        };

        // ✅ RÉPONSE FINALE
        const response = {
            success: true,
            order: {
                ...order,
                // ✅ EMAIL CORRECT SANS "N/A" FORCÉ
                email: order.customer_email || order.client_table_email || 'Email non renseigné',
                customer_email: order.customer_email || order.client_table_email || 'Email non renseigné',
                status: normalizeStatus(order.current_status),
                date: new Date(order.created_at).toLocaleDateString('fr-FR'),
                dateTime: new Date(order.created_at).toLocaleString('fr-FR'),
                hasDiscount: discountAmount > 0 || order.promo_code,
                // ✅ DEBUG INFO
                email_debug: {
                    from_orders: order.customer_email,
                    from_customer: order.client_table_email,
                    final_used: order.customer_email || order.client_table_email || 'Email non renseigné'
                }
            },
            items: processedItems,
            tracking: tracking,
            history: history,
            modifications: modifications, // ✅ POUR LA SECTION HISTORIQUE JAUNE
            summary: {
                originalSubtotal: originalAmount,
                discount: discountAmount,
                subtotal: originalAmount - discountAmount,
                shipping: shipping,
                total: finalTotal
            }
        };

        console.log(`✅ Détails commande #${id} - Email final: "${response.order.email}"`);
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

   // ✏️ MODIFICATION SIMPLE D'UNE COMMANDE  
// 🔧 MÉTHODE updateOrder CORRIGÉE - Nom de table customer (sans 's')
async updateOrder(req, res) {
    const orderId = req.params.id;
    const { status, tracking_number, notes } = req.body;
    
    try {
        // ✅ REQUÊTE AVEC TOUS LES CHAMPS EMAIL POSSIBLES
        const existingOrderQuery = `
            SELECT 
                o.*,
                
                -- ✅ EMAIL CLIENT AVEC TOUTES LES SOURCES POSSIBLES
                COALESCE(
                    o.customer_email,
                    o.email,
                    o.user_email,
                    c.email,
                    c.user_email
                ) as customer_email,
                
                -- ✅ NOM CLIENT AVEC TOUTES LES SOURCES POSSIBLES
                COALESCE(
                    o.customer_name,
                    CONCAT(TRIM(c.first_name), ' ', TRIM(c.last_name)),
                    CONCAT(TRIM(c.prenom), ' ', TRIM(c.nom)),
                    c.name,
                    c.username,
                    'Client inconnu'
                ) as customer_name,
                
                COALESCE(o.status, 'waiting') as current_status,
                c.first_name,
                c.last_name,
                c.prenom,
                c.nom
            FROM orders o
            LEFT JOIN customer c ON o.customer_id = c.id
            WHERE o.id = $1
        `;
        
        const [existingResult] = await sequelize.query(existingOrderQuery, { 
            bind: [orderId]
        });
        
        if (!existingResult || existingResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }

        const existingOrder = existingResult[0];
        const oldStatus = existingOrder.current_status || existingOrder.status;
        const customerEmail = existingOrder.customer_email;

        // ✅ DEBUG DE L'EMAIL AVANT ENVOI
        console.log(`📧 Préparation email pour commande ${orderId}:`, {
            customerEmail,
            statusChange: `${oldStatus} → ${status}`,
            hasValidEmail: customerEmail && customerEmail !== 'N/A' && customerEmail.includes('@')
        });

        // Mise à jour en base de données...
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

            // Historique...
            if (status !== oldStatus) {
                const adminName = req.session?.user?.name || 'Admin';
                await sequelize.query(`
                    INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
                    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                `, {
                    bind: [orderId, oldStatus, status, `Statut modifié: ${oldStatus} → ${status}`, adminName],
                    transaction: t
                });
            }
        });

        // ✅ ENVOI EMAIL SEULEMENT SI EMAIL VALIDE
        let emailResult = { success: false, message: 'Aucun changement de statut' };
        
        if (status !== oldStatus && customerEmail && customerEmail !== 'N/A' && customerEmail.includes('@')) {
            try {
                const { sendStatusChangeEmail } = await import('../services/mailService.js');
                
                const orderData = {
                    id: existingOrder.id,
                    numero_commande: existingOrder.numero_commande || `CMD-${existingOrder.id}`,
                    tracking_number: tracking_number || existingOrder.tracking_number,
                    total: existingOrder.total,
                    customer_name: existingOrder.customer_name,
                    customer_email: customerEmail
                };

                const statusChangeData = {
                    oldStatus,
                    newStatus: status,
                    updatedBy: req.session?.user?.name || 'Admin'
                };

                const customerData = {
                    userEmail: customerEmail,
                    firstName: existingOrder.first_name || existingOrder.prenom || existingOrder.customer_name?.split(' ')[0] || 'Client',
                    lastName: existingOrder.last_name || existingOrder.nom || existingOrder.customer_name?.split(' ').slice(1).join(' ') || ''
                };

                console.log('📧 Envoi email avec données:', { orderData, statusChangeData, customerData });

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
                    id: existingOrder.id,
                    numero_commande: existingOrder.numero_commande,
                    status: status,
                    tracking_number: tracking_number || existingOrder.tracking_number,
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
            const { orderId, status, notes } = req.body;

            if (!orderId || !status) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de commande et statut requis'
                });
            }

            // Validation du statut
            const validStatuses = ['waiting', 'preparing', 'shipped', 'delivered', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Statut invalide'
                });
            }

            await sequelize.transaction(async (t) => {
                // Récupérer l'ancien statut
                const [currentOrder] = await sequelize.query(
                    'SELECT COALESCE(status, status_suivi, \'waiting\') as current_status FROM orders WHERE id = $1', 
                    { bind: [orderId], transaction: t }
                );

                if (currentOrder.length === 0) {
                    throw new Error('Commande non trouvée');
                }

                const oldStatus = currentOrder[0].current_status;

                // Mettre à jour le statut
                await sequelize.query(`
                    UPDATE orders 
                    SET status = $2, status_suivi = $2, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = $1
                `, {
                    bind: [orderId, status],
                    transaction: t
                });

                // Enregistrer dans l'historique
                try {
                    const adminName = req.session?.user?.name || req.session?.user?.first_name || req.body.userName || 'Admin';
                    await sequelize.query(`
                        INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
                        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                    `, {
                        bind: [orderId, oldStatus, status, notes || 'Mise à jour via interface admin', adminName],
                        transaction: t
                    });
                } catch (historyError) {
                    console.log('⚠️ Impossible d\'enregistrer l\'historique');
                }

                // Ajouter un événement de suivi automatique
                try {
                    const trackingDescription = adminOrdersController.getTrackingDescription(status);
                    await sequelize.query(`
                        INSERT INTO order_tracking (order_id, status, description, location, created_at)
                        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    `, {
                        bind: [orderId, status, trackingDescription, 'Système administratif'],
                        transaction: t
                    });
                } catch (trackingError) {
                    console.log('⚠️ Impossible d\'ajouter l\'événement de suivi');
                }
            });

            res.json({
                success: true,
                message: 'Statut mis à jour avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur mise à jour statut:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Erreur lors de la mise à jour'
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