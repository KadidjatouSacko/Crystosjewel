// app/controlleurs/emailController.js
import{ Customer}from '../models/customerModel.js';
import { Order } from '../models/orderModel.js';
import { Op } from 'sequelize';
import { sequelize } from '../models/sequelize-client.js';

/**
 * Contrôleur pour la gestion des emails et campagnes
 */
export const emailController = {

    /**
     * Afficher l'éditeur d'emails
     */
    async showEmailEditor(req, res) {
        try {
            console.log('📧 Chargement de l\'éditeur d\'emails...');

            // Récupérer les clients pour la liste des destinataires
            const customers = await Customer.findAll({
                attributes: ['id', 'firstName', 'lastName', 'email', 'newsletter', 'created_at'],
                where: {
                    email: {
                        [Op.not]: null
                    }
                },
                order: [['created_at', 'DESC']]
            });

            // Compter les commandes par client pour déterminer les VIP
            const customersWithOrders = await Promise.all(
                customers.map(async (customer) => {
                    const orderCount = await Order.count({
                        where: { 
                            [Op.or]: [
                                { customer_email: customer.email },
                                { client_email: customer.email }
                            ]
                        }
                    });
                    
                    return {
                        id: customer.id,
                        name: `${customer.firstName} ${customer.lastName}`,
                        email: customer.email,
                        newsletter: customer.newsletter || false,
                        hasOrders: orderCount > 0,
                        type: orderCount >= 3 ? 'vip' : 'regular',
                        orderCount
                    };
                })
            );

            console.log(`📊 ${customersWithOrders.length} clients chargés`);

            res.render('admin/email-editor', {
                title: 'Éditeur d\'Emails - CrystosJewel',
                customers: customersWithOrders,
                user: req.session.user
            });

        } catch (error) {
            console.error('❌ Erreur chargement éditeur emails:', error);
            res.status(500).render('error', { 
                message: 'Erreur lors du chargement de l\'éditeur d\'emails',
                error: error 
            });
        }
    },

    /**
     * Sauvegarder un brouillon
     */
    async saveDraft(req, res) {
        try {
            const {
                name,
                subject,
                content,
                preheader,
                fromName,
                template
            } = req.body;

            console.log('💾 Sauvegarde brouillon:', { name, subject });

            // TODO: Implémenter sauvegarde en base de données
            // Pour l'instant, on simule la sauvegarde
            const draftData = {
                id: Date.now(),
                name: name || 'Brouillon sans nom',
                subject,
                content,
                preheader,
                fromName,
                template,
                status: 'draft',
                createdBy: req.session.user?.id,
                createdAt: new Date()
            };

            // Dans une vraie implémentation :
            // const draft = await EmailCampaign.create(draftData);

            console.log('✅ Brouillon sauvegardé avec succès');

            res.json({
                success: true,
                message: 'Brouillon sauvegardé avec succès',
                draftId: draftData.id
            });

        } catch (error) {
            console.error('❌ Erreur sauvegarde brouillon:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde'
            });
        }
    },

    /**
     * Envoyer un email de test
     */
    async sendTest(req, res) {
        try {
            const { email, subject, content, template } = req.body;

            if (!email || !subject) {
                return res.status(400).json({
                    success: false,
                    message: 'Email et sujet requis'
                });
            }

            // Validation email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Adresse email invalide'
                });
            }

            console.log(`📧 Envoi email de test à ${email}`);

            // Utiliser le service d'email
            const { sendTestEmail } = await import('../services/mailService.js');
            
            const result = await sendTestEmail(email, {
                subject,
                content,
                template,
                senderName: 'CrystosJewel Test'
            });

            if (result.success) {
                console.log('✅ Email de test envoyé avec succès');
                res.json({
                    success: true,
                    message: `Email de test envoyé avec succès à ${email}`
                });
            } else {
                console.error('❌ Échec envoi email test:', result.error);
                res.status(500).json({
                    success: false,
                    message: result.error || 'Erreur lors de l\'envoi du test'
                });
            }

        } catch (error) {
            console.error('❌ Erreur envoi test:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi du test'
            });
        }
    },

    /**
     * Envoyer une campagne email
     */
    async sendCampaign(req, res) {
        try {
            const {
                name,
                subject,
                content,
                preheader,
                fromName,
                template,
                recipientType,
                selectedCustomerIds
            } = req.body;

            if (!subject || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Sujet et contenu requis'
                });
            }

            console.log(`🚀 Envoi campagne "${name}" - Type: ${recipientType}`);

            // Déterminer les destinataires
            let whereClause = {
                email: { [Op.not]: null }
            };
            
            switch (recipientType) {
                case 'newsletter':
                    whereClause.newsletter = true;
                    break;
                case 'vip':
                    // Clients avec 3+ commandes
                    const vipEmails = await sequelize.query(`
                        SELECT DISTINCT customer_email as email
                        FROM orders 
                        WHERE customer_email IS NOT NULL
                        GROUP BY customer_email 
                        HAVING COUNT(*) >= 3
                        UNION
                        SELECT DISTINCT client_email as email
                        FROM orders 
                        WHERE client_email IS NOT NULL
                        GROUP BY client_email 
                        HAVING COUNT(*) >= 3
                    `, { type: sequelize.QueryTypes.SELECT });
                    
                    const vipEmailList = vipEmails.map(row => row.email);
                    if (vipEmailList.length > 0) {
                        whereClause.email = { [Op.in]: vipEmailList };
                    } else {
                        whereClause.id = -1; // Aucun résultat
                    }
                    break;
                case 'with-orders':
                    const orderEmails = await sequelize.query(`
                        SELECT DISTINCT customer_email as email FROM orders WHERE customer_email IS NOT NULL
                        UNION
                        SELECT DISTINCT client_email as email FROM orders WHERE client_email IS NOT NULL
                    `, { type: sequelize.QueryTypes.SELECT });
                    
                    const orderEmailList = orderEmails.map(row => row.email);
                    if (orderEmailList.length > 0) {
                        whereClause.email = { [Op.in]: orderEmailList };
                    } else {
                        whereClause.id = -1; // Aucun résultat
                    }
                    break;
                case 'all':
                default:
                    // Tous les clients avec email
                    break;
            }

            // Si des clients spécifiques sont sélectionnés
            if (selectedCustomerIds && selectedCustomerIds.length > 0) {
                whereClause.id = { [Op.in]: selectedCustomerIds };
            }

            const recipients = await Customer.findAll({
                where: whereClause,
                attributes: ['id', 'firstName', 'lastName', 'email']
            });

            if (recipients.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun destinataire trouvé pour les critères sélectionnés'
                });
            }

            console.log(`📊 ${recipients.length} destinataires trouvés`);

            // Envoyer les emails par batch
            const { sendBulkEmail } = await import('../services/mailService.js');
            
            const campaignData = {
                name: name || 'Campagne sans nom',
                subject,
                content,
                preheader,
                fromName: fromName || 'CrystosJewel',
                template
            };

            const result = await sendBulkEmail(recipients, campaignData);

            if (result.success) {
                console.log(`✅ Campagne envoyée: ${result.sentCount}/${recipients.length}`);

                // TODO: Sauvegarder la campagne en base
                // await EmailCampaign.create({
                //     name: campaignData.name,
                //     subject,
                //     content,
                //     preheader,
                //     from_name: fromName,
                //     template,
                //     status: 'sent',
                //     recipient_type: recipientType,
                //     sent_count: result.sentCount,
                //     created_by: req.session.user?.id
                // });

                res.json({
                    success: true,
                    message: `Campagne envoyée avec succès à ${result.sentCount} destinataires`,
                    sentCount: result.sentCount,
                    errorCount: result.errorCount,
                    totalRecipients: recipients.length
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de l\'envoi de la campagne',
                    sentCount: result.sentCount || 0,
                    errorCount: result.errorCount || recipients.length
                });
            }

        } catch (error) {
            console.error('❌ Erreur envoi campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de la campagne'
            });
        }
    },

    /**
     * Afficher l'historique des campagnes
     */
    async showHistory(req, res) {
        try {
            console.log('📋 Chargement historique des campagnes...');

        

           
            const campaigns = await EmailCampaign.findAll({
                order: [['created_at', 'DESC']],
                include: [
                    {
                        model: Customer,
                        as: 'creator',
                        attributes: ['firstName', 'lastName']
                    }
                ]
            });

            res.render('admin/email-history', {
                title: 'Historique des Emails - CrystosJewel',
                campaigns,
                user: req.session.user
            });

        } catch (error) {
            console.error('❌ Erreur chargement historique:', error);
            res.status(500).render('error', { 
                message: 'Erreur lors du chargement de l\'historique',
                error: error 
            });
        }
    },

    /**
     * Récupérer les statistiques des emails
     */
    async getEmailStats(req, res) {
        try {
            // TODO: Calculer les vraies statistiques
            const stats = {
                totalCampaigns: 12,
                totalSent: 2847,
                avgOpenRate: 24.5,
                avgClickRate: 5.8,
                lastCampaign: {
                    name: 'Newsletter Janvier',
                    sentAt: new Date(),
                    recipients: 245
                }
            };

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            console.error('❌ Erreur stats emails:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du calcul des statistiques'
            });
        }
    },

    /**
     * Dupliquer une campagne
     */
    async duplicateCampaign(req, res) {
        try {
            const { campaignId } = req.params;

            // TODO: Récupérer et dupliquer la campagne
            console.log(`📋 Duplication campagne ${campaignId}`);

            res.json({
                success: true,
                message: 'Campagne dupliquée avec succès',
                newCampaignId: Date.now()
            });

        } catch (error) {
            console.error('❌ Erreur duplication:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la duplication'
            });
        }
    },

    /**
     * Supprimer une campagne
     */
    async deleteCampaign(req, res) {
        try {
            const { campaignId } = req.params;

            // TODO: Supprimer la campagne
            console.log(`🗑️ Suppression campagne ${campaignId}`);

            res.json({
                success: true,
                message: 'Campagne supprimée avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur suppression:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression'
            });
        }
    },

    /**
     * Prévisualiser une campagne
     */
    async previewCampaign(req, res) {
        try {
            const { campaignId } = req.params;

            // TODO: Récupérer la campagne et générer l'aperçu
            console.log(`👁️ Aperçu campagne ${campaignId}`);

            res.render('admin/email-preview', {
                title: 'Aperçu Email',
                campaign: {
                    id: campaignId,
                    subject: 'Aperçu de la campagne',
                    content: '<h1>Contenu de la campagne</h1>'
                }
            });

        } catch (error) {
            console.error('❌ Erreur aperçu:', error);
            res.status(500).render('error', {
                message: 'Erreur lors de l\'aperçu'
            });
        }
    },

    /**
     * API pour récupérer les clients
     */
    async getCustomers(req, res) {
        try {
            const { filter, search } = req.query;

            let whereClause = {
                email: { [Op.not]: null }
            };

            // Appliquer les filtres
            if (filter === 'newsletter') {
                whereClause.newsletter = true;
            }

            // Appliquer la recherche
            if (search) {
                whereClause[Op.or] = [
                    { firstName: { [Op.iLike]: `%${search}%` } },
                    { lastName: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } }
                ];
            }

            const customers = await Customer .findAll({
                where: whereClause,
                attributes: ['id', 'firstName', 'lastName', 'email', 'newsletter'],
                order: [['firstName', 'ASC']],
                limit: 100
            });

            // Ajouter les infos de commandes
            const customersWithOrders = await Promise.all(
                customers.map(async (customer) => {
                    const orderCount = await Order.count({
                        where: { 
                            [Op.or]: [
                                { customer_email: customer.email },
                                { client_email: customer.email }
                            ]
                        }
                    });
                    
                    return {
                        id: customer.id,
                        name: `${customer.firstName} ${customer.lastName}`,
                        email: customer.email,
                        newsletter: customer.newsletter || false,
                        hasOrders: orderCount > 0,
                        type: orderCount >= 3 ? 'vip' : 'regular',
                        orderCount
                    };
                })
            );

            res.json({
                success: true,
                customers: customersWithOrders
            });

        } catch (error) {
            console.error('❌ Erreur récupération clients:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des clients'
            });
        }
    },

    /**
     * Marquer un email comme ouvert (tracking)
     */
    async trackOpen(req, res) {
        try {
            const { campaignId, customerEmail } = req.params;

            // TODO: Enregistrer l'ouverture
            console.log(`📊 Tracking ouverture: ${customerEmail} - ${campaignId}`);

            // Retourner un pixel transparent
            const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            
            res.set({
                'Content-Type': 'image/gif',
                'Content-Length': pixel.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            res.send(pixel);

        } catch (error) {
            console.error('❌ Erreur tracking ouverture:', error);
            res.status(500).send();
        }
    },

    /**
     * Tracker un clic (tracking)
     */
    async trackClick(req, res) {
        try {
            const { campaignId, customerEmail, linkId } = req.params;
            const { url } = req.query;

            // TODO: Enregistrer le clic
            console.log(`📊 Tracking clic: ${customerEmail} - ${campaignId} - ${linkId}`);

            // Rediriger vers l'URL originale
            if (url) {
                res.redirect(decodeURIComponent(url));
            } else {
                res.redirect('/');
            }

        } catch (error) {
            console.error('❌ Erreur tracking clic:', error);
            res.redirect('/');
        }
    },

    /**
     * API pour récupérer les bijoux (pour les blocs produits)
     */
    async getJewelsForEmail(req, res) {
        try {
            const { Jewel, JewelImage } = await import('../models/index.js');
            
            const jewels = await Jewel.findAll({
                where: {
                    is_active: true,
                    stock: { [Op.gt]: 0 }
                },
                include: [
                    {
                        model: JewelImage,
                        as: 'additionalImages',
                        attributes: ['image_path'],
                        limit: 1
                    }
                ],
                attributes: ['id', 'name', 'price', 'discounted_price', 'slug'],
                order: [['created_at', 'DESC']],
                limit: 20
            });

            const jewelData = jewels.map(jewel => ({
                id: jewel.id,
                name: jewel.name,
                price: jewel.discounted_price || jewel.price,
                originalPrice: jewel.discounted_price ? jewel.price : null,
                image: jewel.additionalImages?.[0]?.image_path || '/images/placeholder-image.jpg',
                url: `/bijoux/${jewel.slug}`
            }));

            res.json({
                success: true,
                jewels: jewelData
            });

        } catch (error) {
            console.error('❌ Erreur récupération bijoux:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des bijoux'
            });
        }
    },

    /**
     * Upload d'image pour l'éditeur
     */
    async uploadImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucune image fournie'
                });
            }

            // Créer le dossier emails s'il n'existe pas
            const fs = await import('fs');
            const path = await import('path');
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'emails');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Sauvegarder l'image
            const imagePath = `/uploads/emails/${req.file.filename}`;
            
            res.json({
                success: true,
                imageUrl: imagePath,
                message: 'Image uploadée avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur upload image:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload'
            });
        }
    },

    /**
     * Prévisualiser un email avec des données de test
     */
    async previewEmail(req, res) {
        try {
            const { content, subject, preheader } = req.body;
            
            // Remplacer les variables par des données de test
            const testContent = content
                .replace(/\{\{first_name\}\}/g, 'Marie')
                .replace(/\{\{last_name\}\}/g, 'Dupont')
                .replace(/\{\{email\}\}/g, 'marie.dupont@example.com')
                .replace(/\{\{company_name\}\}/g, 'Test Company')
                .replace(/\{\{current_date\}\}/g, new Date().toLocaleDateString('fr-FR'))
                .replace(/\{\{unsubscribe_url\}\}/g, '#');

            res.json({
                success: true,
                preview: {
                    subject: subject || 'Aperçu du sujet',
                    preheader: preheader || 'Aperçu du preheader',
                    content: testContent
                }
            });

        } catch (error) {
            console.error('❌ Erreur aperçu:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération de l\'aperçu'
            });
        }
    },

    /**
     * Gérer la désinscription newsletter
     */
    async unsubscribeNewsletter(req, res) {
        try {
            const { email, token } = req.query;
            
            if (email) {
                // Mettre à jour le statut newsletter
                await Customer
                .update(
                    { newsletter: false },
                    { where: { email: email } }
                );
                
                res.render('newsletter/unsubscribed', {
                    title: 'Désabonnement réussi',
                    email: email,
                    message: 'Vous avez été désabonné(e) avec succès de notre newsletter.'
                });
            } else {
                res.render('newsletter/unsubscribe-form', {
                    title: 'Se désabonner',
                    message: 'Entrez votre adresse email pour vous désabonner'
                });
            }
        } catch (error) {
            console.error('❌ Erreur désinscription:', error);
            res.render('error', {
                message: 'Erreur lors de la désinscription'
            });
        }
    },

    /**
     * Traitement du formulaire de désinscription
     */
    async processUnsubscribe(req, res) {
        try {
            const { email } = req.body;
            
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.render('newsletter/unsubscribe-form', {
                    title: 'Se désabonner',
                    error: 'Adresse email invalide'
                });
            }

            const user = await Customer
            .findOne({ where: { email } });
            
            if (user) {
                await Customer
                .update(
                    { newsletter: false },
                    { where: { email } }
                );
                
                res.render('newsletter/unsubscribed', {
                    title: 'Désabonnement réussi',
                    email: email,
                    message: 'Vous avez été désabonné(e) avec succès de notre newsletter.'
                });
            } else {
                res.render('newsletter/unsubscribe-form', {
                    title: 'Se désabonner',
                    error: 'Cette adresse email n\'est pas inscrite à notre newsletter'
                });
            }

        } catch (error) {
            console.error('❌ Erreur traitement désinscription:', error);
            res.render('error', {
                message: 'Erreur lors de la désinscription'
            });
        }
    },

    /**
     * Éditer une campagne existante
     */
    async editCampaign(req, res) {
        try {
            const { campaignId } = req.params;

            // TODO: Récupérer la campagne depuis la base
            console.log(`✏️ Édition campagne ${campaignId}`);

            // Pour l'instant, rediriger vers l'éditeur avec des paramètres
            res.redirect(`/admin/email-editor?edit=${campaignId}`);

        } catch (error) {
            console.error('❌ Erreur édition campagne:', error);
            res.status(500).render('error', {
                message: 'Erreur lors de l\'édition'
            });
        }
    },

    /**
     * Programmer l'envoi d'une campagne
     */
    async scheduleCampaign(req, res) {
        try {
            const {
                campaignId,
                scheduledDate,
                scheduledTime
            } = req.body;

            if (!scheduledDate || !scheduledTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Date et heure de programmation requises'
                });
            }

            const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
            
            if (scheduledAt <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'La date de programmation doit être dans le futur'
                });
            }

            // TODO: Implémenter la programmation en base
            console.log(`📅 Programmation campagne ${campaignId} pour ${scheduledAt}`);

            res.json({
                success: true,
                message: 'Campagne programmée avec succès',
                scheduledAt: scheduledAt
            });

        } catch (error) {
            console.error('❌ Erreur programmation:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la programmation'
            });
        }
    },

    /**
     * Obtenir les templates d'emails prédéfinis
     */
    async getEmailTemplates(req, res) {
        try {
            const templates = [
                {
                    id: 'welcome',
                    name: 'Email de bienvenue',
                    description: 'Template pour accueillir les nouveaux clients',
                    category: 'transactionnel',
                    preview: '/images/templates/welcome-preview.jpg'
                },
                {
                    id: 'newsletter',
                    name: 'Newsletter mensuelle',
                    description: 'Template pour les newsletters régulières',
                    category: 'marketing',
                    preview: '/images/templates/newsletter-preview.jpg'
                },
                {
                    id: 'promo',
                    name: 'Email promotionnel',
                    description: 'Template pour les offres spéciales',
                    category: 'marketing',
                    preview: '/images/templates/promo-preview.jpg'
                },
                {
                    id: 'abandoned-cart',
                    name: 'Panier abandonné',
                    description: 'Template pour récupérer les paniers abandonnés',
                    category: 'transactionnel',
                    preview: '/images/templates/cart-preview.jpg'
                }
            ];

            res.json({
                success: true,
                templates
            });

        } catch (error) {
            console.error('❌ Erreur récupération templates:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des templates'
            });
        }
    },

    /**
     * Exporter une campagne
     */
    async exportCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const { format } = req.query; // html, pdf, etc.

            // TODO: Récupérer la campagne et générer l'export
            console.log(`📤 Export campagne ${campaignId} en ${format}`);

            if (format === 'html') {
                res.setHeader('Content-Type', 'text/html');
                res.setHeader('Content-Disposition', `attachment; filename="campagne-${campaignId}.html"`);
                res.send('<h1>Contenu de la campagne</h1>');
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Format d\'export non supporté'
                });
            }

        } catch (error) {
            console.error('❌ Erreur export:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export'
            });
        }
    },

    /**
     * Obtenir les métriques détaillées d'une campagne
     */
    async getCampaignMetrics(req, res) {
        try {
            const { campaignId } = req.params;

            // TODO: Calculer les vraies métriques depuis la base
            const metrics = {
                campaignId: campaignId,
                sentCount: 245,
                deliveredCount: 240,
                openCount: 98,
                clickCount: 23,
                unsubscribeCount: 2,
                bounceCount: 5,
                openRate: 40.8,
                clickRate: 9.6,
                unsubscribeRate: 0.8,
                bounceRate: 2.0,
                timeline: {
                    sent: new Date('2025-01-15T09:00:00'),
                    firstOpen: new Date('2025-01-15T09:15:00'),
                    lastOpen: new Date('2025-01-16T18:30:00')
                },
                topLinks: [
                    { url: '/bijoux/colliers', clicks: 15 },
                    { url: '/bijoux/bagues', clicks: 8 }
                ],
                deviceStats: {
                    mobile: 60,
                    desktop: 35,
                    tablet: 5
                },
                locationStats: {
                    'France': 180,
                    'Belgique': 35,
                    'Suisse': 20,
                    'Canada': 10
                }
            };

            res.json({
                success: true,
                metrics
            });

        } catch (error) {
            console.error('❌ Erreur métriques campagne:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des métriques'
            });
        }
    }
};

export default emailController;