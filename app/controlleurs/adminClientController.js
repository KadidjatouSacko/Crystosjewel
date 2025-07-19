// app/controlleurs/adminClientController.js
import { Customer } from '../models/customerModel.js';
import { Order } from '../models/orderModel.js';
import { sequelize } from '../models/sequelize-client.js';
import { Sequelize } from 'sequelize';

export const adminClientController = {

    /**
     * 📊 Afficher la page de suivi des clients avec statistiques
     */
    async showClientManagement(req, res) {
        try {
            console.log('📊 === Chargement page suivi clients ===');

            // 1. Récupérer tous les clients avec leurs statistiques de commandes
            const clientsQuery = `
                SELECT 
                    c.*,
                    COUNT(DISTINCT o.id) as total_orders,
                    COALESCE(SUM(o.total), 0) as total_spent,
                    COALESCE(AVG(o.total), 0) as average_basket,
                    MAX(o.created_at) as last_order_date,
                    MIN(o.created_at) as first_order_date,
                    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as completed_orders
                FROM customer c
                LEFT JOIN orders o ON c.id = o.customer_id
                GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.address, c.password, c.created_at
                ORDER BY total_spent DESC, c.created_at DESC
            `;

            const [clients] = await sequelize.query(clientsQuery);

            // 2. Calculer les statistiques globales
            const statsQuery = `
                SELECT 
                    COUNT(DISTINCT c.id) as total_clients,
                    COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN c.id END) as active_clients,
                    COALESCE(AVG(order_totals.total_spent), 0) as average_customer_value,
                    COALESCE(AVG(order_totals.avg_basket), 0) as global_average_basket
                FROM customer c
                LEFT JOIN (
                    SELECT 
                        customer_id,
                        SUM(total) as total_spent,
                        AVG(total) as avg_basket
                    FROM orders 
                    GROUP BY customer_id
                ) order_totals ON c.id = order_totals.customer_id
            `;

            const [statsResult] = await sequelize.query(statsQuery);
            const stats = statsResult[0];

            // 3. Calculer le taux de conversion
            const conversionRate = stats.total_clients > 0 ? 
                ((stats.active_clients / stats.total_clients) * 100).toFixed(1) : '0';

            // 4. Formater les données clients
            const clientsStats = clients.map(client => ({
                customer: {
                    id: client.id,
                    first_name: client.first_name,
                    last_name: client.last_name,
                    email: client.email,
                    phone: client.phone || 'Non renseigné',
                    address: client.address || 'Non renseignée',
                    created_at: client.created_at
                },
                stats: {
                    totalOrders: parseInt(client.total_orders) || 0,
                    totalSpent: parseFloat(client.total_spent) || 0,
                    averageBasket: parseFloat(client.average_basket) || 0,
                    lastOrderDate: client.last_order_date,
                    firstOrderDate: client.first_order_date,
                    completedOrders: parseInt(client.completed_orders) || 0,
                    status: this.getClientStatus(client)
                }
            }));

            console.log(`📊 Clients trouvés: ${clientsStats.length}`);
            console.log('📈 Statistiques:', {
                totalClients: stats.total_clients,
                activeClients: stats.active_clients,
                conversionRate: conversionRate + '%'
            });

            // 5. Rendre la vue
            res.render('follow-customer', {
                title: 'Suivi Clients - Administration',
                clientsStats,
                statsGlobales: {
                    totalClients: parseInt(stats.total_clients) || 0,
                    activeClients: parseInt(stats.active_clients) || 0,
                    panierMoyen: parseFloat(stats.global_average_basket).toFixed(2),
                    conversionRate: conversionRate
                },
                // Données pour les filtres (si nécessaire)
                filters: {
                    status: req.query.status || 'all',
                    dateRange: req.query.dateRange || 'all',
                    search: req.query.search || ''
                }
            });

        } catch (error) {
            console.error('❌ Erreur dans showClientManagement:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement des données clients',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    },

    /**
     * 📝 Ajouter un nouveau client
     */
    async addClient(req, res) {
        try {
            const { firstName, lastName, email, phone, address } = req.body;

            // Validation
            if (!firstName || !lastName || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'Les champs prénom, nom et email sont obligatoires'
                });
            }

            // Vérifier si l'email existe déjà
            const existingClient = await Customer.findOne({ where: { email } });
            if (existingClient) {
                return res.status(400).json({
                    success: false,
                    message: 'Un client avec cet email existe déjà'
                });
            }

            // Créer le client
            const newClient = await Customer.create({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone?.trim() || null,
                address: address?.trim() || null,
                password: 'temp_password_' + Date.now() // Mot de passe temporaire
            });

            console.log('✅ Nouveau client créé:', newClient.id);

            res.json({
                success: true,
                message: 'Client ajouté avec succès',
                client: {
                    id: newClient.id,
                    first_name: newClient.first_name,
                    last_name: newClient.last_name,
                    email: newClient.email
                }
            });

        } catch (error) {
            console.error('❌ Erreur addClient:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'ajout du client'
            });
        }
    },

    /**
     * ✏️ Modifier un client
     */
    async updateClient(req, res) {
        try {
            const { id } = req.params;
            const { editFirstName, editLastName, editEmail, editPhone, editAddress } = req.body;

            // Vérifier que le client existe
            const client = await Customer.findByPk(id);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client non trouvé'
                });
            }

            // Vérifier l'unicité de l'email (si modifié)
            if (editEmail && editEmail !== client.email) {
                const existingClient = await Customer.findOne({ 
                    where: { 
                        email: editEmail,
                        id: { [Sequelize.Op.ne]: id }
                    }
                });
                if (existingClient) {
                    return res.status(400).json({
                        success: false,
                        message: 'Un autre client utilise déjà cet email'
                    });
                }
            }

            // Mettre à jour
            await client.update({
                first_name: editFirstName?.trim() || client.first_name,
                last_name: editLastName?.trim() || client.last_name,
                email: editEmail?.trim().toLowerCase() || client.email,
                phone: editPhone?.trim() || client.phone,
                address: editAddress?.trim() || client.address
            });

            console.log('✅ Client mis à jour:', id);

            res.json({
                success: true,
                message: 'Client mis à jour avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur updateClient:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour'
            });
        }
    },

    /**
     * 🗑️ Supprimer un client
     */
    async deleteClient(req, res) {
        try {
            const { id } = req.params;

            // Vérifier que le client existe
            const client = await Customer.findByPk(id);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client non trouvé'
                });
            }

            // Vérifier s'il a des commandes
            const orderCount = await Order.count({ where: { customer_id: id } });
            if (orderCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Impossible de supprimer ce client car il a ${orderCount} commande(s)`
                });
            }

            // Supprimer
            await client.destroy();

            console.log('✅ Client supprimé:', id);

            res.json({
                success: true,
                message: 'Client supprimé avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur deleteClient:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression'
            });
        }
    },

    /**
     * 👁️ Voir les détails d'un client
     */
    async getClientDetails(req, res) {
        try {
            const { id } = req.params;

            // Récupérer le client avec ses commandes
            const clientQuery = `
                SELECT 
                    c.*,
                    COUNT(DISTINCT o.id) as total_orders,
                    COALESCE(SUM(o.total), 0) as total_spent,
                    COALESCE(AVG(o.total), 0) as average_basket,
                    MAX(o.created_at) as last_order_date,
                    MIN(o.created_at) as first_order_date
                FROM customer c
                LEFT JOIN orders o ON c.id = o.customer_id
                WHERE c.id = $1
                GROUP BY c.id
            `;

            const [clientResult] = await sequelize.query(clientQuery, { bind: [id] });
            if (clientResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Client non trouvé'
                });
            }

            const client = clientResult[0];

            // Récupérer les dernières commandes
            const recentOrders = await Order.findAll({
                where: { customer_id: id },
                order: [['created_at', 'DESC']],
                limit: 10,
                attributes: ['id', 'numero_commande', 'total', 'status', 'created_at']
            });

            res.json({
                success: true,
                client: {
                    ...client,
                    recentOrders: recentOrders.map(order => ({
                        id: order.id,
                        numero: order.numero_commande || `CMD-${order.id}`,
                        total: parseFloat(order.total).toFixed(2),
                        status: order.status,
                        date: order.created_at
                    }))
                }
            });

        } catch (error) {
            console.error('❌ Erreur getClientDetails:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des détails'
            });
        }
    },

    /**
     * 📈 Exporter les données clients
     */
    async exportClients(req, res) {
        try {
            const format = req.query.format || 'csv';

            const clients = await sequelize.query(`
                SELECT 
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.email,
                    c.phone,
                    c.address,
                    c.created_at,
                    COUNT(DISTINCT o.id) as total_orders,
                    COALESCE(SUM(o.total), 0) as total_spent,
                    COALESCE(AVG(o.total), 0) as average_basket,
                    MAX(o.created_at) as last_order_date
                FROM customer c
                LEFT JOIN orders o ON c.id = o.customer_id
                GROUP BY c.id
                ORDER BY total_spent DESC
            `);

            if (format === 'csv') {
                // Générer CSV
                const csvHeaders = [
                    'ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Adresse',
                    'Date inscription', 'Nb commandes', 'Total dépensé', 'Panier moyen', 'Dernière commande'
                ];

                const csvRows = clients[0].map(client => [
                    client.id,
                    client.first_name,
                    client.last_name,
                    client.email,
                    client.phone || '',
                    client.address || '',
                    new Date(client.created_at).toLocaleDateString('fr-FR'),
                    client.total_orders,
                    parseFloat(client.total_spent).toFixed(2) + '€',
                    parseFloat(client.average_basket).toFixed(2) + '€',
                    client.last_order_date ? new Date(client.last_order_date).toLocaleDateString('fr-FR') : 'Jamais'
                ]);

                const csvContent = [csvHeaders, ...csvRows]
                    .map(row => row.map(field => `"${field}"`).join(','))
                    .join('\n');

                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename=clients_export.csv');
                res.send('\ufeff' + csvContent); // BOM pour UTF-8
            } else {
                res.json({
                    success: true,
                    data: clients[0]
                });
            }

        } catch (error) {
            console.error('❌ Erreur exportClients:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export'
            });
        }
    },

    /**
     * 🏷️ Déterminer le statut d'un client
     */
    getClientStatus(client) {
        const totalOrders = parseInt(client.total_orders) || 0;
        const totalSpent = parseFloat(client.total_spent) || 0;
        const lastOrderDate = client.last_order_date;

        if (totalOrders === 0) {
            return 'Prospect';
        }

        if (totalSpent >= 500) {
            return 'VIP';
        }

        if (totalOrders >= 3) {
            return 'Fidèle';
        }

        // Vérifier si commande récente (moins de 30 jours)
        if (lastOrderDate) {
            const daysSinceLastOrder = (Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastOrder <= 30) {
                return 'Actif';
            }
        }

        return 'Inactif';
    }
};