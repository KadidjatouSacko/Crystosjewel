// app/controlleurs/customerManagementController.js

import { sequelize } from '../models/sequelize-client.js';
import { Op } from 'sequelize';

export const customerManagementController = {

    // ========================================
    // 📊 PAGE PRINCIPALE - GESTION DES CLIENTS
    // ========================================
    async renderCustomerManagement(req, res) {
        try {
            console.log('🎯 Chargement page gestion clients...');

            // ✅ REQUÊTE COMPLÈTE pour récupérer tous les clients avec leurs statistiques
            const customersQuery = `
                SELECT 
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.email,
                    c.phone,
                    c.address,
                    c.is_guest,
                    c.marketing_opt_in,
                    c.email_notifications,
                    c.created_at,
                    c.last_order_date,
                    c.total_orders,
                    c.total_spent,
                    
                    -- ✅ Compter les commandes réelles
                    COALESCE(COUNT(DISTINCT o.id), 0) as order_count,
                    COALESCE(SUM(o.total), 0) as total_revenue,
                    MAX(o.created_at) as last_order
                    
                FROM customer c
                LEFT JOIN orders o ON c.id = o.customer_id
                WHERE c.email IS NOT NULL
                GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.address, 
                         c.is_guest, c.marketing_opt_in, c.email_notifications, c.created_at, 
                         c.last_order_date, c.total_orders, c.total_spent
                ORDER BY c.created_at DESC
            `;

            const customers = await sequelize.query(customersQuery, {
                type: sequelize.QueryTypes.SELECT
            });

            // ✅ STATISTIQUES GLOBALES
            const statsQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN NOT is_guest THEN 1 END) as with_accounts,
                    COUNT(CASE WHEN marketing_opt_in = true OR email_notifications = true THEN 1 END) as newsletter,
                    COUNT(CASE WHEN total_orders > 0 THEN 1 END) as with_orders
                FROM customer 
                WHERE email IS NOT NULL
            `;

            const [statsResult] = await sequelize.query(statsQuery, {
                type: sequelize.QueryTypes.SELECT
            });

            // ✅ ENRICHIR LES DONNÉES DES CLIENTS
            const enrichedCustomers = customers.map(customer => ({
                ...customer,
                // Utiliser les vraies données de commandes
                total_orders: customer.order_count || customer.total_orders || 0,
                total_spent: customer.total_revenue || customer.total_spent || 0,
                last_order_date: customer.last_order || customer.last_order_date,
                // Formatage pour l'affichage
                display_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
                has_account: !customer.is_guest,
                newsletter_status: customer.marketing_opt_in || customer.email_notifications
            }));

            console.log(`✅ ${enrichedCustomers.length} clients chargés avec succès`);

            // ✅ RENDER avec toutes les données
            res.render('customer-management', {
                title: 'Gestion des Clients - Bijouterie',
                customers: enrichedCustomers,
                customersStats: {
                    total: statsResult.total,
                    withAccounts: statsResult.with_accounts,
                    newsletter: statsResult.newsletter,
                    withOrders: statsResult.with_orders
                },
                user: req.session?.user,
                isAuthenticated: !!req.session?.user,
                isAdmin: req.session?.user?.role_id === 2
            });

        } catch (error) {
            console.error('❌ Erreur chargement gestion clients:', error);
            res.status(500).render('error', {
                message: 'Erreur lors du chargement de la gestion des clients',
                error: error
            });
        }
    },

    // ========================================
    // 👤 DÉTAILS D'UN CLIENT SPÉCIFIQUE
    // ========================================
    async getCustomerDetails(req, res) {
        try {
            const { customerId } = req.params;
            console.log(`🔍 Récupération détails client #${customerId}`);

            // ✅ REQUÊTE pour récupérer le client avec ses commandes récentes
            const customerQuery = `
                SELECT 
                    c.*,
                    COUNT(DISTINCT o.id) as total_orders_count,
                    COALESCE(SUM(o.total), 0) as total_spent_amount
                FROM customer c
                LEFT JOIN orders o ON c.id = o.customer_id
                WHERE c.id = $1
                GROUP BY c.id
            `;

            const [customer] = await sequelize.query(customerQuery, {
                bind: [customerId],
                type: sequelize.QueryTypes.SELECT
            });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Client non trouvé'
                });
            }

            // ✅ RÉCUPÉRER LES COMMANDES RÉCENTES
            const recentOrdersQuery = `
                SELECT 
                    id,
                    numero_commande,
                    total,
                    status,
                    created_at
                FROM orders 
                WHERE customer_id = $1
                ORDER BY created_at DESC
                LIMIT 5
            `;

            const recentOrders = await sequelize.query(recentOrdersQuery, {
                bind: [customerId],
                type: sequelize.QueryTypes.SELECT
            });

            // ✅ ENRICHIR LES DONNÉES
            const enrichedCustomer = {
                ...customer,
                total_orders: customer.total_orders_count,
                total_spent: customer.total_spent_amount,
                recentOrders: recentOrders
            };

            res.json({
                success: true,
                message: 'Client mis à jour avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur mise à jour client:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du client'
            });
        }
    },

    // ========================================
    // 📧 ENVOI D'EMAILS EN MASSE
    // ========================================
    async sendBulkEmail(req, res) {
        try {
            const {
                recipients,
                selectedCustomers,
                template,
                subject,
                title,
                content,
                discount,
                promoCode
            } = req.body;

            console.log(`📧 Envoi email en masse - Type: ${recipients}`);

            // ✅ VALIDATION
            if (!subject || !title || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Sujet, titre et contenu requis'
                });
            }

            // ✅ DÉTERMINER LES DESTINATAIRES
            let whereClause = 'WHERE email IS NOT NULL';
            let bindParams = [];

            switch (recipients) {
                case 'selected':
                    if (!selectedCustomers || selectedCustomers.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'Aucun client sélectionné'
                        });
                    }
                    whereClause += ` AND id IN (${selectedCustomers.map((_, i) => `${i + 1}`).join(',')})`;
                    bindParams = selectedCustomers;
                    break;
                    
                case 'with-orders':
                    whereClause += ' AND total_orders > 0';
                    break;
                    
                case 'newsletter':
                    whereClause += ' AND (marketing_opt_in = true OR email_notifications = true)';
                    break;
                    
                case 'no-orders':
                    whereClause += ' AND (total_orders = 0 OR total_orders IS NULL)';
                    break;
                    
                case 'guests':
                    whereClause += ' AND is_guest = true';
                    break;
                    
                case 'all':
                default:
                    // Pas de filtre supplémentaire
                    break;
            }

            // ✅ RÉCUPÉRER LES DESTINATAIRES
            const recipientsQuery = `
                SELECT id, first_name, last_name, email
                FROM customer 
                ${whereClause}
                ORDER BY email
            `;

            const emailRecipients = await sequelize.query(recipientsQuery, {
                bind: bindParams,
                type: sequelize.QueryTypes.SELECT
            });

            if (emailRecipients.length === 0) {
                return res.json({
                    success: false,
                    message: 'Aucun destinataire trouvé avec ces critères'
                });
            }

            console.log(`📧 ${emailRecipients.length} destinataires trouvés`);

            // ✅ PRÉPARER LES DONNÉES DE L'EMAIL
            const emailData = {
                subject,
                title,
                content,
                template,
                discount: discount ? parseInt(discount) : 0,
                promoCode: promoCode || null
            };

            // ✅ ENVOYER LES EMAILS (par lots pour éviter la surcharge)
            let sentCount = 0;
            let errorCount = 0;
            const batchSize = 10;

            // Importer le service d'email
            const { sendPromotionalEmail } = await import('../services/mailService.js');

            for (let i = 0; i < emailRecipients.length; i += batchSize) {
                const batch = emailRecipients.slice(i, i + batchSize);
                
                const emailPromises = batch.map(async (recipient) => {
                    try {
                        const result = await sendPromotionalEmail(
                            recipient.email,
                            recipient.first_name || 'Cher client',
                            emailData
                        );
                        
                        // ✅ ENREGISTRER DANS LES LOGS D'EMAIL
                        await sequelize.query(`
                            INSERT INTO email_logs 
                            (customer_id, email_type, recipient_email, subject, status, created_at)
                            VALUES ($1, $2, $3, $4, $5, NOW())
                        `, {
                            bind: [
                                recipient.id,
                                'promotional',
                                recipient.email,
                                subject,
                                result.success ? 'sent' : 'failed'
                            ]
                        });
                        
                        if (result.success) {
                            sentCount++;
                        } else {
                            errorCount++;
                        }
                        
                        return result;
                    } catch (error) {
                        console.error(`❌ Erreur email pour ${recipient.email}:`, error);
                        errorCount++;
                        
                        // Enregistrer l'erreur
                        await sequelize.query(`
                            INSERT INTO email_logs 
                            (customer_id, email_type, recipient_email, subject, status, error_message, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, NOW())
                        `, {
                            bind: [
                                recipient.id,
                                'promotional',
                                recipient.email,
                                subject,
                                'failed',
                                error.message
                            ]
                        });
                        
                        return { success: false };
                    }
                });

                await Promise.all(emailPromises);
                
                // ✅ PAUSE entre les lots pour éviter les limites de taux
                if (i + batchSize < emailRecipients.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`✅ Emails envoyés: ${sentCount}, Erreurs: ${errorCount}`);

            res.json({
                success: true,
                message: `Emails envoyés avec succès`,
                sentCount,
                errorCount,
                totalRecipients: emailRecipients.length
            });

        } catch (error) {
            console.error('❌ Erreur envoi email masse:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi des emails'
            });
        }
    },

    // ========================================
    // 📤 EXPORTER LA LISTE DES CLIENTS
    // ========================================
    async exportCustomers(req, res) {
        try {
            const { type, customers: selectedIds } = req.query;
            console.log(`📤 Export clients - Type: ${type}`);

            // ✅ DÉTERMINER LES CLIENTS À EXPORTER
            let whereClause = 'WHERE email IS NOT NULL';
            let bindParams = [];

            if (type === 'selected' && selectedIds) {
                const ids = selectedIds.split(',').filter(id => id);
                if (ids.length > 0) {
                    whereClause += ` AND id IN (${ids.map((_, i) => `${i + 1}`).join(',')})`;
                    bindParams = ids;
                }
            }

            // ✅ RÉCUPÉRER LES DONNÉES COMPLÈTES
            const exportQuery = `
                SELECT 
                    c.id,
                    c.first_name as "Prénom",
                    c.last_name as "Nom",
                    c.email as "Email",
                    c.phone as "Téléphone",
                    c.address as "Adresse",
                    CASE WHEN c.is_guest THEN 'Invité' ELSE 'Compte' END as "Type de compte",
                    CASE WHEN (c.marketing_opt_in OR c.email_notifications) THEN 'Oui' ELSE 'Non' END as "Newsletter",
                    COALESCE(c.total_orders, 0) as "Nombre de commandes",
                    COALESCE(c.total_spent, 0) as "Total dépensé",
                    TO_CHAR(c.created_at, 'DD/MM/YYYY') as "Date d'inscription",
                    TO_CHAR(c.last_order_date, 'DD/MM/YYYY') as "Dernière commande"
                FROM customer c
                ${whereClause}
                ORDER BY c.created_at DESC
            `;

            const customers = await sequelize.query(exportQuery, {
                bind: bindParams,
                type: sequelize.QueryTypes.SELECT
            });

            if (customers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Aucun client à exporter'
                });
            }

            // ✅ GÉNÉRER LE CSV
            const csvHeaders = Object.keys(customers[0]).filter(key => key !== 'id');
            const csvContent = [
                csvHeaders.join(';'), // Headers
                ...customers.map(customer => 
                    csvHeaders.map(header => {
                        const value = customer[header];
                        // Échapper les guillemets et encapsuler si nécessaire
                        if (value === null || value === undefined) return '';
                        const stringValue = String(value);
                        if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
                            return `"${stringValue.replace(/"/g, '""')}"`;
                        }
                        return stringValue;
                    }).join(';')
                )
            ].join('\n');

            // ✅ ENVOYER LE FICHIER
            const filename = `clients_export_${new Date().toISOString().split('T')[0]}.csv`;
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));
            
            // Ajouter BOM pour Excel
            res.write('\uFEFF');
            res.end(csvContent, 'utf8');

            console.log(`✅ Export de ${customers.length} clients généré`);

        } catch (error) {
            console.error('❌ Erreur export clients:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export'
            });
        }
    },

    // ========================================
    // ➕ AJOUTER UN NOUVEAU CLIENT
    // ========================================
    async addCustomer(req, res) {
        try {
            const {
                firstName,
                lastName,
                email,
                phone,
                address,
                newsletterOpt,
                emailNotifications,
                isGuest
            } = req.body;

            console.log(`➕ Ajout nouveau client: ${email}`);

            // ✅ VALIDATION
            if (!email || !firstName || !lastName) {
                return res.status(400).json({
                    success: false,
                    message: 'Email, prénom et nom requis'
                });
            }

            // ✅ VÉRIFIER QUE L'EMAIL N'EXISTE PAS DÉJÀ
            const existingCustomer = await sequelize.query(
                'SELECT id FROM customer WHERE email = $1',
                {
                    bind: [email],
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (existingCustomer.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Un client avec cet email existe déjà'
                });
            }

            // ✅ CRÉER LE NOUVEAU CLIENT
            const [newCustomer] = await sequelize.query(`
                INSERT INTO customer 
                (first_name, last_name, email, phone, address, marketing_opt_in, 
                 email_notifications, is_guest, created_at, role_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 1)
                RETURNING id
            `, {
                bind: [
                    firstName,
                    lastName,
                    email,
                    phone || null,
                    address || null,
                    newsletterOpt || false,
                    emailNotifications || false,
                    isGuest || false
                ],
                type: sequelize.QueryTypes.SELECT
            });

            console.log(`✅ Nouveau client créé avec ID: ${newCustomer.id}`);

            res.json({
                success: true,
                message: 'Client ajouté avec succès',
                customerId: newCustomer.id
            });

        } catch (error) {
            console.error('❌ Erreur ajout client:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'ajout du client'
            });
        }
    },

    // ========================================
    // 🗑️ SUPPRIMER UN CLIENT
    // ========================================
    async deleteCustomer(req, res) {
        try {
            const { customerId } = req.params;
            console.log(`🗑️ Suppression client #${customerId}`);

            // ✅ VÉRIFIER QUE LE CLIENT EXISTE
            const existingCustomer = await sequelize.query(
                'SELECT id, email FROM customer WHERE id = $1',
                {
                    bind: [customerId],
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (existingCustomer.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Client non trouvé'
                });
            }

            // ✅ VÉRIFIER S'IL Y A DES COMMANDES
            const orderCount = await sequelize.query(
                'SELECT COUNT(*) as count FROM orders WHERE customer_id = $1',
                {
                    bind: [customerId],
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (orderCount[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Impossible de supprimer un client ayant des commandes'
                });
            }

            // ✅ SUPPRIMER LE CLIENT
            await sequelize.query('DELETE FROM customer WHERE id = $1', {
                bind: [customerId]
            });

            console.log(`✅ Client #${customerId} supprimé avec succès`);

            res.json({
                success: true,
                message: 'Client supprimé avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur suppression client:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression du client'
            });
        }
    },

    // ========================================
    // 📊 STATISTIQUES AVANCÉES
    // ========================================
    async getCustomerStats(req, res) {
        try {
            console.log('📊 Récupération statistiques clients...');

            const statsQuery = `
                SELECT 
                    -- Statistiques générales
                    COUNT(*) as total_customers,
                    COUNT(CASE WHEN NOT is_guest THEN 1 END) as customers_with_accounts,
                    COUNT(CASE WHEN is_guest THEN 1 END) as guest_customers,
                    COUNT(CASE WHEN marketing_opt_in = true OR email_notifications = true THEN 1 END) as newsletter_subscribers,
                    
                    -- Statistiques de commandes
                    COUNT(CASE WHEN total_orders > 0 THEN 1 END) as customers_with_orders,
                    COUNT(CASE WHEN total_orders = 0 OR total_orders IS NULL THEN 1 END) as customers_without_orders,
                    
                    -- Statistiques financières
                    AVG(total_spent) as avg_customer_value,
                    SUM(total_spent) as total_revenue_all_customers,
                    MAX(total_spent) as highest_customer_value,
                    
                    -- Statistiques temporelles
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_customers_30d,
                    COUNT(CASE WHEN last_order_date >= NOW() - INTERVAL '30 days' THEN 1 END) as active_customers_30d
                    
                FROM customer 
                WHERE email IS NOT NULL
            `;

            const [stats] = await sequelize.query(statsQuery, {
                type: sequelize.QueryTypes.SELECT
            });

            res.json({
                success: true,
                stats: {
                    total: parseInt(stats.total_customers),
                    withAccounts: parseInt(stats.customers_with_accounts),
                    guests: parseInt(stats.guest_customers),
                    newsletter: parseInt(stats.newsletter_subscribers),
                    withOrders: parseInt(stats.customers_with_orders),
                    withoutOrders: parseInt(stats.customers_without_orders),
                    avgValue: parseFloat(stats.avg_customer_value || 0),
                    totalRevenue: parseFloat(stats.total_revenue_all_customers || 0),
                    highestValue: parseFloat(stats.highest_customer_value || 0),
                    newLast30Days: parseInt(stats.new_customers_30d),
                    activeLast30Days: parseInt(stats.active_customers_30d)
                }
            });

        } catch (error) {
            console.error('❌ Erreur statistiques clients:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des statistiques'
            });
        }
    },

    async updateCustomer(req, res) {
    try {
        const {
            customerId,
            firstName,
            lastName,
            email,
            phone,
            address,
            newsletterOpt,
            emailNotifications
        } = req.body;

        console.log(`💾 Mise à jour client #${customerId}`);

        // ✅ VALIDATION
        if (!customerId || !email) {
            return res.status(400).json({
                success: false,
                message: 'ID client et email requis'
            });
        }

        // ✅ VÉRIFIER QUE LE CLIENT EXISTE
        const existingCustomer = await sequelize.query(
            'SELECT id FROM customer WHERE id = $1',
            {
                bind: [customerId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (existingCustomer.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Client non trouvé'
            });
        }

        // ✅ MISE À JOUR
        await sequelize.query(`
            UPDATE customer 
            SET 
                first_name = $2,
                last_name = $3,
                email = $4,
                phone = $5,
                address = $6,
                marketing_opt_in = $7,
                email_notifications = $8,
                updated_at = NOW()
            WHERE id = $1
        `, {
            bind: [
                customerId,
                firstName,
                lastName,
                email,
                phone,
                address,
                newsletterOpt,
                emailNotifications
            ]
        });

        console.log(`✅ Client #${customerId} mis à jour avec succès`);

        return res.json({
            success: true,
            message: 'Client mis à jour avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour du client :', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la mise à jour du client'
        });
    }
}

}