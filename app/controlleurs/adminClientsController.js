// ===================================================
// CONTRÔLEUR ADMIN CLIENTS AVEC FONCTIONNALITÉS EMAIL
// ===================================================

import { sendClientEmail } from '../services/clientEmailService.js';
import Customer from '../models/customerModel.js';
import { Order } from '../models/orderModel.js';
import { Op } from 'sequelize';

export const adminClientsController = {

    // ===================================================
    // AFFICHAGE DE LA PAGE GESTION CLIENTS
    // ===================================================
    
    async renderGestionClients(req, res) {
        try {
            console.log('📋 Chargement page gestion clients...');
            
            // Récupérer tous les clients avec leurs statistiques
            const customers = await Customer.findAll({
                attributes: [
                    'id', 'first_name', 'last_name', 'email', 'phone', 
                    'address', 'created_at', 'updated_at', 'status'
                ],
                order: [['created_at', 'DESC']]
            });

            // Calculer les statistiques pour chaque client
            const clientsStats = [];
            for (const customer of customers) {
                try {
                    // Récupérer les commandes du client
                    const orders = await Order.findAll({
                        where: {
                            [Op.or]: [
                                { customer_email: customer.email },
                                { client_email: customer.email }
                            ]
                        },
                        attributes: ['total', 'created_at', 'status']
                    });

                    // Calculer les statistiques
                    const totalOrders = orders.length;
                    const totalSpent = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
                    const averageBasket = totalOrders > 0 ? (totalSpent / totalOrders) : 0;
                    
                    // Dernière commande
                    const lastOrder = orders.length > 0 ? 
                        orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] : null;
                    
                    // Statut client basé sur l'activité
                    let clientStatus = 'Nouveau';
                    if (totalOrders === 0) {
                        clientStatus = 'Inactif';
                    } else if (totalOrders >= 5) {
                        clientStatus = 'VIP';
                    } else if (totalOrders >= 2) {
                        clientStatus = 'Fidèle';
                    } else {
                        clientStatus = 'Actif';
                    }

                    clientsStats.push({
                        id: customer.id,
                        firstName: customer.first_name,
                        lastName: customer.last_name,
                        email: customer.email,
                        phone: customer.phone,
                        address: customer.address,
                        createdAt: customer.created_at,
                        status: clientStatus,
                        stats: {
                            totalOrders,
                            totalSpent: totalSpent.toFixed(2),
                            averageBasket: averageBasket.toFixed(2),
                            lastOrderDate: lastOrder ? lastOrder.created_at : null,
                            daysSinceLastOrder: lastOrder ? 
                                Math.floor((new Date() - new Date(lastOrder.created_at)) / (1000 * 60 * 60 * 24)) : null
                        }
                    });
                    
                } catch (customerError) {
                    console.error(`Erreur stats client ${customer.id}:`, customerError.message);
                    
                    // Client avec stats par défaut en cas d'erreur
                    clientsStats.push({
                        id: customer.id,
                        firstName: customer.first_name,
                        lastName: customer.last_name,
                        email: customer.email,
                        phone: customer.phone,
                        address: customer.address,
                        createdAt: customer.created_at,
                        status: 'Inconnu',
                        stats: {
                            totalOrders: 0,
                            totalSpent: '0.00',
                            averageBasket: '0.00',
                            lastOrderDate: null,
                            daysSinceLastOrder: null
                        }
                    });
                }
            }

            // Statistiques globales
            const totalClients = clientsStats.length;
            const activeClients = clientsStats.filter(cs => cs.stats.totalOrders > 0).length;
            const vipClients = clientsStats.filter(cs => cs.status === 'VIP').length;
            const totalRevenue = clientsStats.reduce((sum, cs) => sum + parseFloat(cs.stats.totalSpent), 0);
            const averageBasketGlobal = activeClients > 0 ? (totalRevenue / activeClients) : 0;

            const statsGlobales = {
                totalClients,
                activeClients,
                vipClients,
                inactiveClients: totalClients - activeClients,
                totalRevenue: totalRevenue.toFixed(2),
                averageBasket: averageBasketGlobal.toFixed(2),
                conversionRate: totalClients > 0 ? ((activeClients / totalClients) * 100).toFixed(1) : '0'
            };

            console.log(`✅ Clients chargés: ${totalClients} (${activeClients} actifs)`);

            // Rendu de la page avec les données
            res.render('admin/gestion-clients', {
                title: 'Gestion des Clients',
                clientsStats,
                statsGlobales,
                user: req.session.user,
                isAuthenticated: !!req.session.user,
                isAdmin: true
            });

        } catch (error) {
            console.error('❌ Erreur chargement gestion clients:', error);
            res.status(500).render('error', {
                message: 'Erreur lors du chargement de la page',
                error: process.env.NODE_ENV === 'development' ? error : {},
                user: req.session.user,
                isAuthenticated: !!req.session.user,
                isAdmin: true
            });
        }
    },

    // ===================================================
    // ENVOI EMAIL DE BIENVENUE
    // ===================================================
    
    async sendWelcomeEmail(req, res) {
        try {
            const clientId = req.params.id;
            
            console.log(`📧 Envoi email bienvenue client ${clientId}...`);
            
            // Récupérer les données du client
            const client = await Customer.findByPk(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client non trouvé'
                });
            }
            
            const clientData = {
                email: client.email,
                name: `${client.first_name} ${client.last_name}`.trim()
            };
            
            // Envoyer l'email de bienvenue
            const result = await sendClientEmail('welcome', clientData);
            
            if (result.success) {
                console.log(`✅ Email bienvenue envoyé à ${clientData.email}`);
                res.json({
                    success: true,
                    message: 'Email de bienvenue envoyé avec succès',
                    messageId: result.messageId
                });
            } else {
                console.error(`❌ Échec email bienvenue ${clientData.email}:`, result.error);
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de l\'envoi de l\'email',
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('❌ Erreur route welcome email:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: error.message
            });
        }
    },

    // ===================================================
    // ENVOI EMAIL PERSONNALISÉ
    // ===================================================
    
    async sendCustomEmail(req, res) {
        try {
            const clientId = req.params.id;
            const { subject, message } = req.body;
            
            console.log(`📧 Envoi email personnalisé client ${clientId}...`);
            
            // Validation des données
            if (!subject || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Sujet et message requis'
                });
            }
            
            // Récupérer les données du client
            const client = await Customer.findByPk(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client non trouvé'
                });
            }
            
            const clientData = {
                email: client.email,
                name: `${client.first_name} ${client.last_name}`.trim()
            };
            
            const customData = {
                subject: subject.trim(),
                message: message.trim(),
                adminName: req.session.user?.first_name 
                    ? `${req.session.user.first_name} ${req.session.user.last_name || ''}`.trim()
                    : 'L\'équipe CrystosJewel'
            };
            
            // Envoyer l'email personnalisé
            const result = await sendClientEmail('custom', clientData, customData);
            
            if (result.success) {
                console.log(`✅ Email personnalisé envoyé à ${clientData.email}`);
                res.json({
                    success: true,
                    message: 'Email personnalisé envoyé avec succès',
                    messageId: result.messageId
                });
            } else {
                console.error(`❌ Échec email personnalisé ${clientData.email}:`, result.error);
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de l\'envoi de l\'email',
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('❌ Erreur route custom email:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: error.message
            });
        }
    },

    // ===================================================
    // ENVOI EMAIL DE RELANCE
    // ===================================================
    
    async sendReactivationEmail(req, res) {
        try {
            const clientId = req.params.id;
            
            console.log(`📧 Envoi email relance client ${clientId}...`);
            
            // Récupérer les données du client
            const client = await Customer.findByPk(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client non trouvé'
                });
            }
            
            // Récupérer la dernière commande du client
            let lastOrderDate = null;
            try {
                const lastOrder = await Order.findOne({
                    where: {
                        [Op.or]: [
                            { customer_email: client.email },
                            { client_email: client.email }
                        ]
                    },
                    order: [['created_at', 'DESC']]
                });
                
                if (lastOrder) {
                    lastOrderDate = new Date(lastOrder.created_at).toLocaleDateString('fr-FR');
                }
            } catch (orderError) {
                console.log('Impossible de récupérer la dernière commande:', orderError.message);
            }
            
            const clientData = {
                email: client.email,
                name: `${client.first_name} ${client.last_name}`.trim()
            };
            
            const customData = {
                lastOrderDate
            };
            
            // Envoyer l'email de relance
            const result = await sendClientEmail('reactivation', clientData, customData);
            
            if (result.success) {
                console.log(`✅ Email relance envoyé à ${clientData.email}`);
                res.json({
                    success: true,
                    message: 'Email de relance envoyé avec succès',
                    messageId: result.messageId
                });
            } else {
                console.error(`❌ Échec email relance ${clientData.email}:`, result.error);
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de l\'envoi de l\'email',
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('❌ Erreur route reactivation email:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: error.message
            });
        }
    },

    // ===================================================
    // ENVOI EMAIL GROUPÉ
    // ===================================================
    
    async sendBulkEmail(req, res) {
        try {
            const { clientIds, emailType, customData = {} } = req.body;
            
            console.log(`📧 Envoi email groupé: ${emailType} à ${clientIds?.length} clients...`);
            
            if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Liste de clients requise'
                });
            }
            
            if (!emailType || !['welcome', 'custom', 'reactivation'].includes(emailType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Type d\'email invalide'
                });
            }
            
            // Pour les emails personnalisés, vérifier les données
            if (emailType === 'custom' && (!customData.subject || !customData.message)) {
                return res.status(400).json({
                    success: false,
                    message: 'Sujet et message requis pour un email personnalisé'
                });
            }
            
            // Récupérer tous les clients
            const clients = await Customer.findAll({
                where: {
                    id: clientIds
                }
            });
            
            if (clients.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Aucun client trouvé'
                });
            }
            
            // Préparer les données personnalisées
            if (emailType === 'custom') {
                customData.adminName = req.session.user?.first_name 
                    ? `${req.session.user.first_name} ${req.session.user.last_name || ''}`.trim()
                    : 'L\'équipe CrystosJewel';
            }
            
            // Envoyer les emails en parallèle avec limite de concurrence
            const emailPromises = clients.map(async (client) => {
                const clientData = {
                    email: client.email,
                    name: `${client.first_name} ${client.last_name}`.trim()
                };
                
                try {
                    const result = await sendClientEmail(emailType, clientData, customData);
                    return {
                        clientId: client.id,
                        email: client.email,
                        name: clientData.name,
                        success: result.success,
                        error: result.error || null
                    };
                } catch (error) {
                    return {
                        clientId: client.id,
                        email: client.email,
                        name: clientData.name,
                        success: false,
                        error: error.message
                    };
                }
            });
            
            // Exécuter avec limitation pour éviter la surcharge
            const batchSize = 5; // Traiter 5 emails en parallèle max
            const results = [];
            
            for (let i = 0; i < emailPromises.length; i += batchSize) {
                const batch = emailPromises.slice(i, i + batchSize);
                const batchResults = await Promise.all(batch);
                results.push(...batchResults);
                
                // Petit délai entre les batches pour ne pas surcharger
                if (i + batchSize < emailPromises.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;
            
            console.log(`✅ Envoi groupé terminé: ${successCount} succès, ${failureCount} échecs`);
            
            res.json({
                success: true,
                message: `Emails envoyés: ${successCount} succès, ${failureCount} échecs`,
                totalSent: successCount,
                totalFailed: failureCount,
                results: results
            });
            
        } catch (error) {
            console.error('❌ Erreur route bulk email:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: error.message
            });
        }
    },

    // ===================================================
    // GESTION CLIENTS CRUD (fonctions existantes améliorées)
    // ===================================================
    
    async updateClient(req, res) {
        try {
            const clientId = req.params.id;
            const { editFirstName, editLastName, editEmail, editPhone, editAddress, editStatus } = req.body;
        
            await Customer.update({
                first_name: editFirstName,
                last_name: editLastName,
                email: editEmail,
                phone: editPhone,
                address: editAddress,
                status: editStatus
            }, {
                where: { id: clientId }
            });
        
            console.log(`✅ Client ${clientId} mis à jour`);
            res.json({ success: true });
            
        } catch (err) {
            console.error('❌ Erreur update client:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },

    async deleteClient(req, res) {
        try {
            const clientId = req.params.id;
        
            const deletedCount = await Customer.destroy({
                where: { id: clientId }
            });
        
            if (deletedCount === 0) {
                return res.status(404).json({ error: 'Client non trouvé' });
            }
        
            console.log(`✅ Client ${clientId} supprimé`);
            res.json({ success: true, message: 'Client supprimé avec succès' });
            
        } catch (err) {
            console.error('❌ Erreur delete client:', err);
            res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
        }
    },
    
    async addClient(req, res) {
        try {
            const { firstName, lastName, email, phone, address } = req.body;
        
            const newClient = await Customer.create({
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
                address
            });

            console.log(`✅ Nouveau client créé: ${newClient.id}`);
            res.status(201).json({ 
                success: true,
                message: "Client ajouté",
                clientId: newClient.id
            });
            
        } catch (err) {
            console.error("❌ Erreur ajout client:", err);
            res.status(500).json({ error: 'Erreur lors de l\'ajout du client' });
        }
    }
};

export default adminClientsController;