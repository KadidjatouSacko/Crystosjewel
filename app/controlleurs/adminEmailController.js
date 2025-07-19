// app/controlleurs/adminEmailController.js
import { sequelize } from '../models/sequelize-client.js';
import { Order } from '../models/orderModel.js';
import { Customer } from '../models/customerModel.js';
import { sendOrderConfirmationEmail, sendAdminOrderNotification, sendOrderStatusUpdateEmail } from '../services/mailService.js';
import nodemailer from 'nodemailer';

export const adminEmailController = {

    /**
     * 📧 Afficher la page de gestion des emails
     */
    async showEmailManagement(req, res) {
        try {
            console.log('📧 === Chargement page gestion emails ===');

            // 1. Statistiques des emails
            const emailStats = await this.getEmailStats();

            // 2. Historique des emails récents
            const recentEmails = await this.getRecentEmails(20);

            // 3. Test de configuration email
            const configTest = await this.testEmailConfig();

            // 4. Commandes avec emails manquants
            const missingEmails = await this.getOrdersWithMissingEmails();

            console.log('📊 Statistiques emails:', emailStats);

            res.render('admin/email-management', {
                title: 'Gestion des Emails - Administration',
                emailStats,
                recentEmails,
                configTest,
                missingEmails,
                // Configuration pour les modales
                emailTypes: [
                    { id: 'order_confirmation', name: 'Confirmation de commande', description: 'Email envoyé au client après validation de commande' },
                    { id: 'order_shipped', name: 'Commande expédiée', description: 'Notification d\'expédition avec suivi' },
                    { id: 'order_delivered', name: 'Commande livrée', description: 'Confirmation de livraison' },
                    { id: 'admin_notification', name: 'Notification admin', description: 'Alertes pour les administrateurs' },
                    { id: 'status_update', name: 'Mise à jour statut', description: 'Changement de statut de commande' }
                ]
            });

        } catch (error) {
            console.error('❌ Erreur dans showEmailManagement:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement de la gestion des emails',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    },

    /**
     * 📊 Récupérer les statistiques des emails
     */
    async getEmailStats() {
        try {
            // Simuler les statistiques d'emails (vous pouvez créer une table email_logs pour un vrai tracking)
            const [ordersStats] = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN customer_email IS NOT NULL AND customer_email != '' AND customer_email != 'N/A' THEN 1 END) as orders_with_email,
                    COUNT(CASE WHEN customer_email IS NULL OR customer_email = '' OR customer_email = 'N/A' THEN 1 END) as orders_missing_email,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as orders_today,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as orders_week
                FROM orders
            `);

            const stats = ordersStats[0];

            return {
                totalEmailsSent: parseInt(stats.orders_with_email) * 2, // Client + Admin
                emailsToday: parseInt(stats.orders_today) * 2,
                emailsThisWeek: parseInt(stats.orders_week) * 2,
                failureRate: stats.total_orders > 0 ? 
                    ((parseInt(stats.orders_missing_email) / parseInt(stats.total_orders)) * 100).toFixed(1) : '0.0',
                ordersWithMissingEmails: parseInt(stats.orders_missing_email),
                emailDeliveryRate: stats.total_orders > 0 ? 
                    ((parseInt(stats.orders_with_email) / parseInt(stats.total_orders)) * 100).toFixed(1) : '100.0'
            };

        } catch (error) {
            console.error('❌ Erreur getEmailStats:', error);
            return {
                totalEmailsSent: 0,
                emailsToday: 0,
                emailsThisWeek: 0,
                failureRate: '0.0',
                ordersWithMissingEmails: 0,
                emailDeliveryRate: '100.0'
            };
        }
    },

    /**
     * 📜 Récupérer l'historique des emails récents
     */
    async getRecentEmails(limit = 20) {
        try {
            // Récupérer les commandes récentes avec emails
            const [recentOrders] = await sequelize.query(`
                SELECT 
                    o.id,
                    o.numero_commande,
                    o.customer_email,
                    o.total,
                    o.status,
                    o.created_at,
                    COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as customer_name
                FROM orders o
                LEFT JOIN customer c ON o.customer_id = c.id
                WHERE o.customer_email IS NOT NULL 
                AND o.customer_email != '' 
                AND o.customer_email != 'N/A'
                ORDER BY o.created_at DESC
                LIMIT $1
            `, { bind: [limit] });

            return recentOrders.map(order => ({
                id: order.id,
                orderNumber: order.numero_commande || `CMD-${order.id}`,
                customerEmail: order.customer_email,
                customerName: order.customer_name,
                total: parseFloat(order.total || 0).toFixed(2),
                status: order.status,
                sentAt: order.created_at,
                emailTypes: ['Confirmation', 'Admin'], // Types d'emails envoyés
                success: true // Simulé - à remplacer par un vrai tracking
            }));

        } catch (error) {
            console.error('❌ Erreur getRecentEmails:', error);
            return [];
        }
    },

    /**
     * 🧪 Tester la configuration email
     */
    async testEmailConfig() {
        try {
            const transporter = nodemailer.createTransporter({
                service: 'gmail',
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASS
                }
            });

            // Vérifier la configuration
            await transporter.verify();

            return {
                status: 'success',
                message: 'Configuration email valide',
                details: {
                    service: 'Gmail',
                    user: process.env.MAIL_USER,
                    configured: true
                }
            };

        } catch (error) {
            console.error('❌ Erreur test email config:', error);
            return {
                status: 'error',
                message: 'Erreur de configuration email',
                details: {
                    error: error.message,
                    configured: false
                }
            };
        }
    },

    /**
     * 📧 Récupérer les commandes avec emails manquants
     */
    async getOrdersWithMissingEmails() {
        try {
            const [missingEmails] = await sequelize.query(`
                SELECT 
                    o.id,
                    o.numero_commande,
                    o.customer_id,
                    o.total,
                    o.status,
                    o.created_at,
                    COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as customer_name,
                    c.email as customer_table_email
                FROM orders o
                LEFT JOIN customer c ON o.customer_id = c.id
                WHERE (o.customer_email IS NULL OR o.customer_email = '' OR o.customer_email = 'N/A')
                ORDER BY o.created_at DESC
                LIMIT 50
            `);

            return missingEmails.map(order => ({
                id: order.id,
                orderNumber: order.numero_commande || `CMD-${order.id}`,
                customerName: order.customer_name,
                total: parseFloat(order.total || 0).toFixed(2),
                status: order.status,
                createdAt: order.created_at,
                suggestedEmail: order.customer_table_email,
                canRepair: !!order.customer_table_email
            }));

        } catch (error) {
            console.error('❌ Erreur getOrdersWithMissingEmails:', error);
            return [];
        }
    },

    /**
     * 🧪 Envoyer un email de test
     */
    async sendTestEmail(req, res) {
        try {
            const { testEmail, emailType } = req.body;

            if (!testEmail || !emailType) {
                return res.status(400).json({
                    success: false,
                    message: 'Email et type requis'
                });
            }

            console.log(`🧪 Envoi email test vers: ${testEmail}, type: ${emailType}`);

            let result;

            switch (emailType) {
                case 'order_confirmation':
                    // Email de test avec données fictives
                    const testOrderData = {
                        orderNumber: 'TEST-' + Date.now(),
                        items: [
                            { 
                                name: 'Collier en Or Rose - Test', 
                                quantity: 1, 
                                price: 89.99,
                                size: '45cm'
                            }
                        ],
                        subtotal: 89.99,
                        total: 89.99,
                        deliveryFee: 0,
                        shipping_address: 'Adresse de test'
                    };
                    
                    result = await sendOrderConfirmationEmail(testEmail, 'Test', testOrderData);
                    break;

                case 'admin_notification':
                    const adminTestData = {
                        orderNumber: 'TEST-' + Date.now(),
                        total: 89.99,
                        items: [{ name: 'Produit de test', quantity: 1, price: 89.99 }]
                    };
                    const customerTestData = {
                        firstName: 'Test',
                        lastName: 'User',
                        email: testEmail
                    };
                    
                    result = await sendAdminOrderNotification(adminTestData, customerTestData);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Type d\'email non supporté'
                    });
            }

            if (result.success) {
                res.json({
                    success: true,
                    message: `Email de test envoyé avec succès à ${testEmail}`,
                    messageId: result.messageId
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de l\'envoi: ' + result.error
                });
            }

        } catch (error) {
            console.error('❌ Erreur sendTestEmail:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de l\'email de test'
            });
        }
    },

    /**
     * 🔧 Réparer les emails manquants
     */
    async repairMissingEmails(req, res) {
        try {
            console.log('🔧 Réparation des emails manquants...');

            // Récupérer les commandes avec emails manquants mais récupérables
            const [ordersToRepair] = await sequelize.query(`
                SELECT 
                    o.id,
                    o.numero_commande,
                    c.email as customer_email
                FROM orders o
                LEFT JOIN customer c ON o.customer_id = c.id
                WHERE (o.customer_email IS NULL OR o.customer_email = '' OR o.customer_email = 'N/A')
                AND c.email IS NOT NULL 
                AND c.email != ''
            `);

            let repairedCount = 0;
            const errors = [];

            for (const order of ordersToRepair) {
                try {
                    await sequelize.query(`
                        UPDATE orders 
                        SET customer_email = $1
                        WHERE id = $2
                    `, {
                        bind: [order.customer_email, order.id]
                    });

                    repairedCount++;
                    console.log(`✅ Email réparé pour commande ${order.numero_commande}: ${order.customer_email}`);

                } catch (error) {
                    console.error(`❌ Erreur réparation commande ${order.id}:`, error);
                    errors.push({
                        orderId: order.id,
                        error: error.message
                    });
                }
            }

            console.log(`🎉 Réparation terminée: ${repairedCount} emails réparés`);

            res.json({
                success: true,
                message: `${repairedCount} emails ont été réparés avec succès`,
                details: {
                    repaired: repairedCount,
                    errors: errors.length,
                    errorDetails: errors
                }
            });

        } catch (error) {
            console.error('❌ Erreur repairMissingEmails:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la réparation des emails'
            });
        }
    },

    /**
     * 📧 Renvoyer un email pour une commande
     */
    async resendOrderEmail(req, res) {
        try {
            const { orderId, emailType } = req.body;

            if (!orderId || !emailType) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de commande et type d\'email requis'
                });
            }

            // Récupérer les détails de la commande
            const [orderResult] = await sequelize.query(`
                SELECT 
                    o.*,
                    COALESCE(o.customer_name, CONCAT(c.first_name, ' ', c.last_name), 'Client inconnu') as customer_name,
                    c.first_name,
                    c.last_name,
                    c.email as customer_table_email
                FROM orders o
                LEFT JOIN customer c ON o.customer_id = c.id
                WHERE o.id = $1
            `, { bind: [orderId] });

            if (orderResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Commande non trouvée'
                });
            }

            const order = orderResult[0];
            const customerEmail = order.customer_email || order.customer_table_email;

            if (!customerEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun email disponible pour cette commande'
                });
            }

            // Récupérer les articles de la commande
            const [orderItems] = await sequelize.query(`
                SELECT 
                    oi.*,
                    COALESCE(j.name, jw.name, 'Article supprimé') as name,
                    COALESCE(j.price_ttc, jw.price_ttc, oi.price) as price
                FROM order_items oi
                LEFT JOIN jewel j ON oi.jewel_id = j.id
                LEFT JOIN jewels jw ON oi.jewel_id = jw.id
                WHERE oi.order_id = $1
            `, { bind: [orderId] });

            const orderData = {
                orderNumber: order.numero_commande || `CMD-${order.id}`,
                items: orderItems.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: parseFloat(item.price || 0),
                    size: item.size || 'Non spécifiée'
                })),
                subtotal: parseFloat(order.subtotal || order.total || 0),
                total: parseFloat(order.total || 0),
                deliveryFee: parseFloat(order.shipping_price || 0),
                promo_code: order.promo_code,
                promo_discount_amount: parseFloat(order.promo_discount_amount || 0)
            };

            let result;

            switch (emailType) {
                case 'customer':
                    const firstName = order.first_name || order.customer_name.split(' ')[0] || 'Client';
                    result = await sendOrderConfirmationEmail(customerEmail, firstName, orderData);
                    break;

                case 'admin':
                    const customerData = {
                        firstName: order.first_name || 'Client',
                        lastName: order.last_name || 'Inconnu',
                        email: customerEmail
                    };
                    result = await sendAdminOrderNotification(orderData, customerData);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Type d\'email non supporté'
                    });
            }

            if (result.success) {
                console.log(`✅ Email ${emailType} renvoyé pour commande ${order.numero_commande}`);
                res.json({
                    success: true,
                    message: `Email ${emailType} renvoyé avec succès`,
                    details: {
                        orderId: orderId,
                        email: customerEmail,
                        messageId: result.messageId
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de l\'envoi: ' + result.error
                });
            }

        } catch (error) {
            console.error('❌ Erreur resendOrderEmail:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du renvoi de l\'email'
            });
        }
    },

    /**
     * 📊 Exporter les logs d'emails
     */
    async exportEmailLogs(req, res) {
        try {
            const format = req.query.format || 'csv';

            // Récupérer l'historique des emails
            const emailHistory = await this.getRecentEmails(1000);

            if (format === 'csv') {
                const csvHeaders = [
                    'Date', 'Commande', 'Client', 'Email', 'Type', 'Statut', 'Montant'
                ];

                const csvRows = emailHistory.map(email => [
                    new Date(email.sentAt).toLocaleDateString('fr-FR'),
                    email.orderNumber,
                    email.customerName,
                    email.customerEmail,
                    email.emailTypes.join(', '),
                    email.success ? 'Envoyé' : 'Échec',
                    email.total + '€'
                ]);

                const csvContent = [csvHeaders, ...csvRows]
                    .map(row => row.map(field => `"${field}"`).join(','))
                    .join('\n');

                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename=email_logs_export.csv');
                res.send('\ufeff' + csvContent); // BOM pour UTF-8
            } else {
                res.json({
                    success: true,
                    data: emailHistory,
                    count: emailHistory.length
                });
            }

        } catch (error) {
            console.error('❌ Erreur exportEmailLogs:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export des logs'
            });
        }
    }
};