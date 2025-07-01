// controlleurs/adminOrdersController.js - Version corrigée pour base de données existante
import { Order } from '../models/orderModel.js';

import { sequelize } from '../models/sequelize-client.js';

export const adminOrdersController = {


    // Normalisation des statuts
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
                END
                WHERE status IS NULL 
                OR status = '' 
                OR LOWER(status) NOT IN ('waiting', 'preparing', 'shipped', 'delivered', 'cancelled')
            `;
            
            await sequelize.query(updateQuery);
        } catch (error) {
            console.error('❌ Erreur normalisation statuts:', error);
        }
    },



    // 🕒 Fonction utilitaire pour calculer le temps écoulé
    getTimeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
        return past.toLocaleDateString('fr-FR');
    },


  // Fonction pour normaliser un statut individuel
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
    const normalizedStatus = this.normalizeStatus(status);
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
    const normalizedStatus = this.normalizeStatus(status);
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
 

  async showDashboard(req, res) {
        try {
            console.log('🎯 Chargement dashboard admin avec gestion complète des tailles');
            
            // Normaliser les statuts avant affichage
            await adminOrdersController.normalizeOrderStatuses();

            // 📊 RÉCUPÉRER LES STATISTIQUES GÉNÉRALES
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

            // 🛒 RÉCUPÉRER LES COMMANDES AVEC INFORMATIONS COMPLÈTES DE TAILLES
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
                    
                    -- ✅ RÉCUPÉRATION DES TAILLES COMMANDÉES
                    (
                        SELECT STRING_AGG(
                            CASE 
                                WHEN oi.size IS NOT NULL AND oi.size != '' 
                                THEN oi.size
                                WHEN ct.size IS NOT NULL AND ct.size != '' 
                                THEN ct.size
                                ELSE 'Standard'
                            END, ', '
                        )
                        FROM order_items oi
                        LEFT JOIN cart ct ON ct.jewel_id = oi.jewel_id AND ct.customer_id = o.customer_id
                        WHERE oi.order_id = o.id
                    ) as tailles_commandees,
                    
                    -- ✅ COMPTER LES ARTICLES AVEC TAILLES SPÉCIFIÉES
                    (
                        SELECT COUNT(*)
                        FROM order_items oi
                        LEFT JOIN cart ct ON ct.jewel_id = oi.jewel_id AND ct.customer_id = o.customer_id
                        WHERE oi.order_id = o.id
                        AND (
                            (oi.size IS NOT NULL AND oi.size != '') 
                            OR (ct.size IS NOT NULL AND ct.size != '')
                        )
                    ) as articles_avec_tailles,
                    
                    -- ✅ COMPTER LE TOTAL D'ARTICLES
                    (
                        SELECT COUNT(*)
                        FROM order_items oi
                        WHERE oi.order_id = o.id
                    ) as total_articles,
                    
                    -- ✅ DÉTAIL DES TAILLES PAR ARTICLE
                    (
                        SELECT JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'nom_article', COALESCE(j.name, jw.name, 'Article'),
                                'taille', CASE 
                                    WHEN oi.size IS NOT NULL AND oi.size != '' 
                                    THEN oi.size
                                    WHEN ct.size IS NOT NULL AND ct.size != '' 
                                    THEN ct.size
                                    ELSE NULL
                                END,
                                'quantite', oi.quantity
                            )
                        )
                        FROM order_items oi
                        LEFT JOIN cart ct ON ct.jewel_id = oi.jewel_id AND ct.customer_id = o.customer_id
                        LEFT JOIN jewel j ON oi.jewel_id = j.id
                        LEFT JOIN jewels jw ON oi.jewel_id = jw.id
                        WHERE oi.order_id = o.id
                    ) as detail_tailles_articles
                    
                FROM orders o
                LEFT JOIN customer c ON o.customer_id = c.id
                ORDER BY o.created_at DESC
                LIMIT 100
            `;

            const [ordersResult] = await sequelize.query(ordersQuery);
            
            // 🎨 FORMATAGE DES COMMANDES AVEC CALCULS DE TAILLES
            const commandes = ordersResult.map(order => {
                // Calculs financiers existants
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

                // ✅ TRAITEMENT DES INFORMATIONS TAILLES
                const totalArticles = parseInt(order.total_articles) || 0;
                const articlesAvecTailles = parseInt(order.articles_avec_tailles) || 0;
                const taillesCommandees = order.tailles_commandees || '';
                const detailTaillesArticles = order.detail_tailles_articles || [];

                // Calculer la couverture des tailles
                const pourcentageCouverture = totalArticles > 0 ? 
                    Math.round((articlesAvecTailles / totalArticles) * 100) : 0;

                // Nettoyer l'affichage des tailles
                let affichageTailles = 'Non spécifiées';
                if (taillesCommandees) {
                    const taillesUniques = [...new Set(
                        taillesCommandees.split(', ').filter(t => t && t !== 'Standard')
                    )];
                    affichageTailles = taillesUniques.length > 0 ? 
                        taillesUniques.join(', ') : 
                        'Tailles standard';
                }

                // Créer l'objet sizesInfo pour la vue
                const sizesInfo = {
                    totalItems: totalArticles,
                    itemsWithSizes: articlesAvecTailles,
                    sizesDisplay: affichageTailles,
                    hasSizeInfo: articlesAvecTailles > 0,
                    sizesCoverage: pourcentageCouverture,
                    detailArticles: Array.isArray(detailTaillesArticles) ? detailTaillesArticles : []
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
                    
                    // ✅ INFORMATIONS TAILLES POUR LA VUE
                    sizesInfo: sizesInfo
                };
            });

            // 🎭 RENDU DE LA PAGE AVEC TOUTES LES DONNÉES
            res.render('commandes', {
                title: 'Administration - Suivi des Commandes',
                user: req.session.user,
                stats: stats,
                statusStats: statusStats,
                commandes: commandes,
                getStatusClass: adminOrdersController.getStatusClass.bind(adminOrdersController),
                translateStatus: adminOrdersController.translateStatus.bind(adminOrdersController),
                
                // ✅ HELPERS POUR LES TAILLES ET CODES PROMO
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
                    
                    // ✅ HELPERS POUR LES TAILLES
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
  // 🔍 DÉTAILS AVEC TOUTES LES COLONNES DE RÉDUCTION
  // ========================================
async getOrderDetails(req, res) {
        try {
            const { id } = req.params;
            console.log(`🔍 Récupération détails commande #${id}`);

            // 1. Détails de la commande
            const orderQuery = `
                SELECT 
                    o.*,
                    COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as customer_name,
                    COALESCE(o.customer_email, c.email, 'N/A') as customer_email,
                    c.phone,
                    COALESCE(o.shipping_address, c.address) as shipping_address,
                    c.created_at as customer_since,
                    c.first_name,
                    c.last_name,
                    COALESCE(o.status, o.status_suivi, 'waiting') as current_status,
                    o.notes,
                    COALESCE(o.original_total, o.total) as original_total,
                    o.promo_code,
                    COALESCE(o.discount_amount, 0) as discount_amount,
                    COALESCE(o.discount_percent, 0) as discount_percent,
                    COALESCE(o.promo_discount_amount, 0) as promo_discount_amount,
                    COALESCE(o.promo_discount_percent, 0) as promo_discount_percent,
                    COALESCE(o.promo_discount, 0) as promo_discount
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

            // Calculs de réduction
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
            const finalTotal = parseFloat(order.total) || 0;
            
            const calculatedOriginal = discountAmount > 0 && originalAmount === finalTotal 
                ? finalTotal + discountAmount 
                : originalAmount;

            // 2. Articles de la commande
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
                    (COALESCE(oi.quantity, 1) * COALESCE(oi.price, j.price_ttc, jw.price_ttc, 0)) as total_price
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
                        (COALESCE(ohj.quantity, 1) * COALESCE(ohj.unit_price, j.price_ttc, jw.price_ttc, 0)) as total_price
                    FROM order_has_jewel ohj
                    LEFT JOIN jewel j ON ohj.jewel_id = j.id
                    LEFT JOIN jewels jw ON ohj.jewel_id = jw.id
                    LEFT JOIN category c ON COALESCE(j.category_id, jw.category_id) = c.id
                    WHERE ohj.order_id = $1
                    ORDER BY ohj.jewel_id
                `;

                [itemsResult] = await sequelize.query(itemsQuery, { bind: [id] });
            }

            // Traitement des articles
            const processedItems = itemsResult.map(item => {
                return {
                    ...item,
                    name: item.jewel_name,
                    price: parseFloat(item.unit_price || 0),
                    total: parseFloat(item.total_price || 0),
                    quantity: parseInt(item.quantity || 1),
                    size: 'Non spécifiée',
                    sizeDisplay: 'Gestion des tailles en cours de développement',
                    availableSizes: [],
                    hasSizeInfo: false,
                    matiere: item.matiere,
                    carat: item.carat,
                    poids: item.poids
                };
            });

            // 3. Historique et suivi
            let history = [];
            try {
                const historyQuery = `
                    SELECT 
                        id, old_status, new_status, notes, updated_by, created_at,
                        TO_CHAR(created_at, 'DD/MM/YYYY à HH24:MI:SS') as formatted_date
                    FROM order_status_history 
                    WHERE order_id = $1 
                    ORDER BY created_at DESC
                    LIMIT 50
                `;
                const [historyResult] = await sequelize.query(historyQuery, { bind: [id] });
                history = historyResult.map(h => ({
                    ...h,
                    old_status_display: adminOrdersController.translateStatus(h.old_status),
                    new_status_display: adminOrdersController.translateStatus(h.new_status),
                    time_ago: adminOrdersController.getTimeAgo(h.created_at)
                }));
            } catch (historyError) {
                console.log('⚠️ Table order_status_history non disponible');
            }

            let tracking = [];
            try {
                const trackingQuery = `
                    SELECT 
                        id, status, description, location, created_at,
                        TO_CHAR(created_at, 'DD/MM/YYYY à HH24:MI:SS') as formatted_date
                    FROM order_tracking 
                    WHERE order_id = $1 
                    ORDER BY created_at DESC
                    LIMIT 20
                `;
                const [trackingResult] = await sequelize.query(trackingQuery, { bind: [id] });
                tracking = trackingResult.map(t => ({
                    ...t,
                    status_display: adminOrdersController.translateStatus(t.status),
                    time_ago: adminOrdersController.getTimeAgo(t.created_at)
                }));
            } catch (trackingError) {
                console.log('⚠️ Table order_tracking non disponible');
            }

            // 4. Informations de paiement
            let paymentInfo = null;
            try {
                const paymentQuery = `
                    SELECT method, status, payment_date, amount
                    FROM payment 
                    WHERE order_id = $1
                    ORDER BY payment_date DESC
                    LIMIT 1
                `;
                const [paymentResult] = await sequelize.query(paymentQuery, { bind: [id] });
                paymentInfo = paymentResult[0] || null;
            } catch (paymentError) {
                console.log('⚠️ Table payment non disponible');
            }

            // 5. Calculs finaux
            const subtotalAfterDiscount = calculatedOriginal - discountAmount;
            const shipping = parseFloat(order.shipping_price) || 0;

            // 6. Réponse
            const response = {
                success: true,
                order: {
                    ...order,
                    status: adminOrdersController.normalizeStatus(order.current_status),
                    date: new Date(order.created_at).toLocaleDateString('fr-FR'),
                    dateTime: new Date(order.created_at).toLocaleString('fr-FR'),
                    payment_method: paymentInfo?.method || 'Carte bancaire',
                    payment_status: paymentInfo?.status || 'Confirmé',
                    customer_since_display: order.customer_since ? 
                        new Date(order.customer_since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 
                        'Client récent',
                    promo_code: order.promo_code,
                    discount_amount: discountAmount,
                    discount_percent: discountPercent,
                    original_amount: calculatedOriginal,
                    total: finalTotal,
                    hasDiscount: discountAmount > 0 || order.promo_code
                },
                items: processedItems,
                tracking: tracking,
                history: history,
                summary: {
                    originalSubtotal: calculatedOriginal,
                    discount: discountAmount,
                    subtotal: subtotalAfterDiscount,
                    shipping: shipping,
                    total: finalTotal
                }
            };

            console.log(`✅ Détails commande #${id} récupérés`);
            res.json(response);

        } catch (error) {
            console.error('❌ Erreur détails commande:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des détails: ' + error.message
            });
        }
    },


    async updateOrder(req, res) {
        try {
            const { id } = req.params;
            const { status, tracking_number, notes, promo_code, discount_amount } = req.body;

            console.log(`✏️ Modification commande ID: ${id}`, req.body);

            const checkQuery = `
                SELECT 
                    id,
                    COALESCE(status, status_suivi, 'waiting') as current_status,
                    customer_name,
                    customer_email,
                    total,
                    COALESCE(original_total, total) as original_total
                FROM orders 
                WHERE id = $1
            `;
            const [checkResult] = await sequelize.query(checkQuery, { bind: [id] });
            
            if (checkResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Commande non trouvée'
                });
            }

            const currentOrder = checkResult[0];
            const oldStatus = currentOrder.current_status;

            await sequelize.transaction(async (transaction) => {
                const updateFields = [];
                const values = [];
                let paramIndex = 1;

                if (status) {
                    const normalizedStatus = adminOrdersController.normalizeStatus(status);
                    updateFields.push(`status = $${paramIndex}, status_suivi = $${paramIndex}`);
                    values.push(normalizedStatus);
                    paramIndex++;
                }
                
                if (tracking_number !== undefined) {
                    updateFields.push(`tracking_number = $${paramIndex}`);
                    values.push(tracking_number || null);
                    paramIndex++;
                }
                
                if (notes !== undefined) {
                    updateFields.push(`notes = $${paramIndex}`);
                    values.push(notes || null);
                    paramIndex++;
                }

                if (promo_code !== undefined) {
                    updateFields.push(`promo_code = $${paramIndex}`);
                    values.push(promo_code || null);
                    paramIndex++;
                }

                if (discount_amount !== undefined && parseFloat(discount_amount) >= 0) {
                    updateFields.push(`discount_amount = $${paramIndex}`);
                    values.push(parseFloat(discount_amount));
                    paramIndex++;
                    
                    const originalTotal = parseFloat(currentOrder.original_total);
                    const newTotal = originalTotal - parseFloat(discount_amount);
                    updateFields.push(`total = $${paramIndex}`);
                    values.push(newTotal);
                    paramIndex++;
                }

                updateFields.push('updated_at = CURRENT_TIMESTAMP');

                if (updateFields.length === 1) {
                    throw new Error('Aucune modification fournie');
                }

                const updateQuery = `
                    UPDATE orders 
                    SET ${updateFields.join(', ')}
                    WHERE id = $${paramIndex}
                `;
                values.push(id);

                await sequelize.query(updateQuery, { bind: values, transaction });

                // Enregistrer l'historique
                const adminName = req.session?.user?.name || 
                                 req.session?.user?.first_name || 
                                 req.session?.user?.email || 
                                 'Administrateur';

                let changeMessage = [];
                if (status && status !== oldStatus) {
                    changeMessage.push(`Statut: ${adminOrdersController.translateStatus(oldStatus)} → ${adminOrdersController.translateStatus(status)}`);
                }
                if (tracking_number) {
                    changeMessage.push(`Numéro de suivi: ${tracking_number}`);
                }
                if (promo_code !== undefined) {
                    changeMessage.push(`Code promo: ${promo_code || 'retiré'}`);
                }
                if (discount_amount !== undefined) {
                    changeMessage.push(`Réduction: ${discount_amount}€`);
                }
                if (notes) {
                    changeMessage.push(`Notes: ${notes}`);
                }

                const fullNotes = changeMessage.join(' | ');

                try {
                    await sequelize.query(`
                        INSERT INTO order_status_history (order_id, old_status, new_status, notes, updated_by, created_at)
                        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                    `, {
                        bind: [id, oldStatus, status || oldStatus, fullNotes, adminName],
                        transaction
                    });
                } catch (historyError) {
                    console.log('⚠️ Impossible d\'enregistrer l\'historique:', historyError.message);
                }

                if (status) {
                    try {
                        const trackingDescription = `${adminOrdersController.getTrackingDescription(status)} - Modifié par ${adminName}`;
                        
                        await sequelize.query(`
                            INSERT INTO order_tracking (order_id, status, description, location, created_at)
                            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                        `, {
                            bind: [id, status, trackingDescription, 'Interface Administration'],
                            transaction
                        });
                    } catch (trackingError) {
                        console.log('⚠️ Impossible d\'ajouter l\'événement de suivi:', trackingError.message);
                    }
                }
            });

            console.log(`✅ Commande ${id} mise à jour avec succès`);

            res.json({
                success: true,
                message: 'Commande mise à jour avec succès',
                order: {
                    id: id,
                    status: status ? adminOrdersController.normalizeStatus(status) : undefined,
                    tracking_number: tracking_number,
                    promo_code: promo_code,
                    discount_amount: discount_amount
                }
            });

        } catch (error) {
            console.error('❌ Erreur modification commande:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Erreur lors de la modification de la commande'
            });
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

            const adminName = req.session?.user?.name || req.session?.user?.first_name || 'Admin';
            
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

  // ========================================
  // 📊 EXPORT CSV AVEC TOUTES LES RÉDUCTIONS
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
                    -- ✅ COLONNES TAILLES POUR EXPORT
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

            // ✅ GÉNÉRER LE CSV AVEC COLONNES TAILLES
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
                END
                WHERE status IS NULL 
                OR status = '' 
                OR LOWER(status) NOT IN ('waiting', 'preparing', 'shipped', 'delivered', 'cancelled')
            `;
            
            await sequelize.query(updateQuery);
        } catch (error) {
            console.error('❌ Erreur normalisation statuts:', error);
        }
    },

    // Fonction pour normaliser un statut individuel
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
        const normalizedStatus = this.normalizeStatus(status);
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
        const normalizedStatus = this.normalizeStatus(status);
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

    // 🕒 Fonction utilitaire pour calculer le temps écoulé
    getTimeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
        return past.toLocaleDateString('fr-FR');
    },

  

  // Mise à jour du statut avec transaction
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

      // console.log(`🔄 Mise à jour statut commande #${orderId}: ${status}`);

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

        // Mettre à jour le statut (les deux colonnes pour compatibilité)
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
          // console.log('⚠️ Impossible d\'enregistrer l\'historique');
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

      // console.log(`✅ Statut mis à jour pour commande #${orderId}`);

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


  // Sauvegarde complète des modifications
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

      const adminName = req.session?.user?.name || req.session?.user?.first_name || 'Admin';

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




 
};


