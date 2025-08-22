import { Customer } from "../models/customerModel.js";
import { Order } from '../models/orderModel.js';
import { OrderItem } from '../models/orderItem.js';
import { Jewel } from "../models/jewelModel.js";
import { Favorite } from "../models/favoritesModel.js";
import rateLimit from 'express-rate-limit';
import argon2 from "argon2";
import  { sendWelcomeEmail} from "../services/mailService.js";
// import { sendWelcomeMail } from "../utils/mailUtils.js";
import Sequelize from 'sequelize';

import passwordValidator from "password-validator";

// Limiteur de tentatives de connexion
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20,
  message: "Trop de tentatives de connexion, veuillez réessayer plus tard"
});

export const authController = {


  // Affiche la page de connexion
LoginPage(req, res) {
  
  if (req.session.customerId) {
    
    return res.redirect('/profil');  // Si déjà connecté, redirige vers le profil
  }
  
  return res.render("login", {
    errorMessage: req.query.error || "",  // Affiche un message d'erreur s'il y en a
    formData: {}
  });
},

// Fonction pour la connexion de l'utilisateur
async login(req, res) {
    const { email, password } = req.body;
    
    try {
        const customer = await Customer.findOne({ where: { email } });
        
        if (!customer) {
            return res.render("login", {
                errorMessage: "Identifiants incorrects",
                formData: { email }
            });
        }
        
        const isValidPassword = await argon2.verify(customer.password, password);
        
        if (!isValidPassword) {
            return res.render("login", {
                errorMessage: "Identifiants incorrects",
                formData: { email }
            });
        }
        
        req.session.customerId = customer.id;
        req.session.user = {
            id: customer.id,
            name: customer.first_name,
            email: customer.email,
            role: customer.role,
            role_id: customer.role_id,
            isAdmin: customer.role_id === 2,
            cartItems: []
        };
        
        // ✅ AJOUT DU LOG POUR DEBUG
        console.log('✅ Session créée:', {
            userId: req.session.user.id,
            email: req.session.user.email,
            role_id: req.session.user.role_id,
            isAdmin: req.session.user.isAdmin
        });
        
        res.cookie("customername", customer.email, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 24,
            sameSite: "strict"
        });
        
        // ✅ MODIFICATION ICI - Redirection selon le rôle
        if (customer.role_id === 2) {
            console.log('🛡️ Redirection admin vers paramètres');
            return res.redirect('/admin/parametres');
        } else {
            console.log('👤 Redirection client vers accueil');
            return res.redirect('/');
        }
        
    } catch (error) {
        console.error("Erreur de connexion:", error);
        return res.status(500).render("login", {
            errorMessage: "Erreur serveur",
            formData: { email }
        });
    }
},

// Déconnexion de l'utilisateur
logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Erreur de déconnexion.");
    }
    
    // Supprimer le cookie après la déconnexion
    res.clearCookie("customername");
    res.redirect("/");  // Rediriger vers la page d'accueil après déconnexion
  });
},

  // Inscription de l'utilisateur
async signUp(req, res) {
  const { first_name, last_name, email, password, confirm_password, address, phone } = req.body;
  const formData = { first_name, last_name, email, address, phone };

  // Vérification champs obligatoires
  if (!first_name || !last_name || !email || !password || !confirm_password) {
    return res.render("login", {
      error: "Tous les champs obligatoires doivent être remplis",
      formData
    });
  }

  // Validation mot de passe
  const schema = new passwordValidator();
  schema
    .is().min(8)
    .is().max(100)
    .has().uppercase()
    .has().lowercase()
    .has().digits(2)
    .has().symbols(1);

  if (!schema.validate(password)) {
    return res.render("login", {
      error: "Mot de passe trop faible (8 caractères minimum, 1 majuscule, 1 minuscule, 2 chiffres, 1 symbole).",
      formData
    });
  }

  if (password !== confirm_password) {
    return res.render("login", {
      error: "Les mots de passe ne correspondent pas",
      formData
    });
  }

  try {
    console.log("Email reçu :", email);

    // Recherche insensible à la casse sur email
    const existingCustomer = await Customer.findOne({
      where: Sequelize.where(
        Sequelize.fn('LOWER', Sequelize.col('email')),
        email.toLowerCase()
      )
    });

    console.log("Client existant trouvé :", existingCustomer);

    if (existingCustomer) {
      return res.render("login", {
        error: "Cet email est déjà utilisé",
        formData
      });
    }

    // Hash du mot de passe
    const hashOptions = {
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
      type: argon2.argon2id
    };
    const hashedPassword = await argon2.hash(password, hashOptions);

    // Création du client
    const newCustomer = await Customer.create({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      address,
      phone,
      role: "client"
    });

    // Envoi du mail de bienvenue
await sendWelcomeMail(newCustomer.email, newCustomer.first_name);

    // Création session + cookie
    req.session.customerId = newCustomer.id;
    res.cookie("customername", newCustomer.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: "strict"
    });


    return res.redirect("/");
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error);
    return res.render("login", {
      error: "Une erreur est survenue lors de l'inscription",
      formData
    });
  }
},


// Affiche le profil de l'utilisateur avec commandes et statistiques
async renderCustomerProfile(req, res) {
  try {
    const customerId = req.session.customerId;
    
    if (!customerId) {
      return res.redirect('/connexion');
    }
    
    // Récupération du client avec ses commandes
    const customer = await Customer.findOne({ 
      where: { id: customerId },
      include: [
        {
          model: Order,
          as: 'orders',
          include: [
            {
              model: OrderItem,
              as: 'items',
              include: [
                {
                  model: Jewel,
                  as: 'jewel',
                  attributes: ['id', 'name', 'price_ttc', 'image']
                }
              ]
            }
          ],
          order: [['created_at', 'DESC']],
          limit: 5 // Limiter aux 5 dernières commandes pour l'affichage
        },
        {
          model: Favorite,
          as: 'favorites',
          include: [
            {
              model: Jewel,
              as: 'jewel',
              attributes: ['id', 'name', 'price_ttc', 'image']
            }
          ]
        }
      ]
    });

    if (!customer) {
      return res.status(404).render("error", { message: "Utilisateur non trouvé" });
    }

    // Calcul des statistiques du client
    const orders = customer.orders || [];
    const favorites = customer.favorites || [];
    
    // Calcul du total dépensé
    const totalSpent = orders.reduce((sum, order) => {
      if (order.total) {
        return sum + parseFloat(order.total);
      } else if (order.items && order.items.length > 0) {
        const orderTotal = order.items.reduce((itemSum, item) => {
          return itemSum + (item.quantity * (item.price || item.jewel?.price_ttc || 0));
        }, 0);
        return sum + orderTotal;
      }
      return sum;
    }, 0);

    // Calcul du panier moyen
    const averageBasket = orders.length > 0 ? (totalSpent / orders.length) : 0;

    // Statut client basé sur le total dépensé
    let customerStatus = 'Bronze';
    if (totalSpent > 2000) {
      customerStatus = 'VIP';
    } else if (totalSpent > 1000) {
      customerStatus = 'Gold';
    } else if (totalSpent > 500) {
      customerStatus = 'Silver';
    }

    // Formatage des commandes pour l'affichage
    const formattedOrders = orders.map(order => {
      let orderTotal = order.total;
      if (!orderTotal && order.items && order.items.length > 0) {
        orderTotal = order.items.reduce((sum, item) => {
          return sum + (item.quantity * (item.price || item.jewel?.price_ttc || 0));
        }, 0);
      }

      // S'assurer que orderTotal est un nombre
      orderTotal = parseFloat(orderTotal) || 0;

      return {
        ...order.toJSON(),
        total: orderTotal,
        formatted_date: new Date(order.created_at).toLocaleDateString('fr-FR', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        status_display: order.status === 'waiting' ? 'En attente' : 
                       order.status === 'preparing' ? 'En préparation' : 
                       order.status === 'shipped' ? 'Expédiée' : 
                       order.status === 'delivered' ? 'Livrée' : 
                       'En cours'
      };
    });

    const success = req.query.success || null;

    res.render('customer-profile', { 
      success,
      customer: {
        ...customer.toJSON(),
        // Ajout des statistiques calculées
        stats: {
          totalOrders: orders.length,
          totalSpent: totalSpent,
          averageBasket: averageBasket,
          totalFavorites: favorites.length,
          customerStatus: customerStatus
        }
      },
      orders: formattedOrders,
      favorites: favorites,
      title: "Mon Profil | Bijoux Élégance"
    });
  } catch (err) {
    console.error('Erreur dans renderCustomerProfile:', err);
    res.status(500).render("error", { message: "Erreur serveur" });
  }
},

// Affiche la page des commandes du client
// Affiche la page des commandes du client
async renderCustomerOrders(req, res) {
  try {
    const customerId = req.session.customerId;
    
    if (!customerId) {
      return res.redirect('/connexion');
    }

    // Paramètres de filtrage et pagination
    const currentStatut = req.query.statut || 'all';
    const currentSearch = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Nombre de commandes par page
    const offset = (page - 1) * limit;

    // Construction des conditions de filtrage
    let whereConditions = { customer_id: customerId };
    let includeConditions = [
      {
        model: OrderItem,
        as: 'items',
        include: [
          {
            model: Jewel,
            as: 'jewel',
            attributes: ['id', 'name', 'price_ttc', 'image', 'slug'],
            where: null, // Will be set below if searching
            required: false
          }
        ],
        required: false
      }
    ];

    // Filtre par statut
    if (currentStatut !== 'all') {
      whereConditions.status = currentStatut;
    }

    // Filtre par recherche étendue - CORRIGÉ ET SIMPLIFIÉ
    if (currentSearch) {
      const searchTerm = currentSearch.trim();
      const searchNumber = parseInt(searchTerm);
      
      try {
        const { Op } = await import('sequelize');
        
        if (!isNaN(searchNumber) && searchNumber > 0) {
          // Recherche numérique : ID ou numéro de commande
          whereConditions[Op.or] = [
            { id: searchNumber },
            { numero_commande: { [Op.iLike]: `%${searchTerm}%` } }
          ];
        } else {
          // Recherche textuelle : dans les bijoux
          // On utilise une approche différente pour éviter les erreurs
          includeConditions = [
            {
              model: OrderItem,
              as: 'items',
              include: [
                {
                  model: Jewel,
                  as: 'jewel',
                  attributes: ['id', 'name', 'price_ttc', 'image', 'slug'],
                  where: {
                    name: { [Op.iLike]: `%${searchTerm}%` }
                  },
                  required: true
                }
              ],
              required: true
            }
          ];
        }
      } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        // En cas d'erreur, on ignore la recherche
      }
    }

    // D'abord, récupérer TOUTES les commandes pour les statistiques globales (sans pagination ni recherche)
    const allOrders = await Order.findAll({
      where: { customer_id: customerId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Jewel,
              as: 'jewel',
              attributes: ['id', 'name', 'price_ttc', 'image', 'slug']
            }
          ],
          required: false
        }
      ]
    });

    // Calcul des statistiques globales (sur TOUTES les commandes)
    let totalSpentGlobal = 0;
    const statsGlobal = {
      totalOrders: allOrders.length,
      waitingOrders: 0,
      preparingOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      totalSpent: 0
    };

    allOrders.forEach(order => {
      // Calcul du total pour cette commande
      let orderTotal = order.total;
      if (!orderTotal && order.items && order.items.length > 0) {
        orderTotal = order.items.reduce((sum, item) => {
          return sum + (item.quantity * (item.price || item.jewel?.price_ttc || 0));
        }, 0);
      }
      orderTotal = parseFloat(orderTotal) || 0;
      totalSpentGlobal += orderTotal;

      // Comptage par statut
      switch(order.status) {
        case 'waiting': statsGlobal.waitingOrders++; break;
        case 'preparing': statsGlobal.preparingOrders++; break;
        case 'shipped': statsGlobal.shippedOrders++; break;
        case 'delivered': statsGlobal.deliveredOrders++; break;
      }
    });

    statsGlobal.totalSpent = totalSpentGlobal;

    // Ensuite, récupérer les commandes avec pagination et filtres
    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset,
      distinct: true // Important pour éviter les doublons avec les JOINs
    });

    // Fonctions utilitaires pour le statut
    const getStatusDisplay = (status) => {
      const statusMap = {
        'waiting': 'En attente',
        'preparing': 'En préparation',
        'shipped': 'Expédiée',
        'delivered': 'Livrée',
        'cancelled': 'Annulée'
      };
      return statusMap[status] || 'En cours';
    };

    const getStatusClass = (status) => {
      const classMap = {
        'waiting': 'status-waiting',
        'preparing': 'status-preparing',
        'shipped': 'status-shipped',
        'delivered': 'status-delivered',
        'cancelled': 'status-cancelled'
      };
      return classMap[status] || 'status-default';
    };

    // Formatage des commandes pour l'affichage
    const formattedOrders = orders.map(order => {
      let orderTotal = order.total;
      if (!orderTotal && order.items && order.items.length > 0) {
        orderTotal = order.items.reduce((sum, item) => {
          return sum + (item.quantity * (item.price || item.jewel?.price_ttc || 0));
        }, 0);
      }

      // S'assurer que orderTotal est un nombre
      orderTotal = parseFloat(orderTotal) || 0;

      return {
        ...order.toJSON(),
        total: orderTotal,
        // Utiliser numero_commande s'il existe, sinon l'ID
        display_number: order.numero_commande || `CMD-${order.id}`,
        formatted_date: new Date(order.created_at).toLocaleDateString('fr-FR', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        formatted_time: new Date(order.created_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        status_display: getStatusDisplay(order.status),
        status_class: getStatusClass(order.status),
        items_count: order.items ? order.items.length : 0,
        first_item: order.items && order.items.length > 0 ? order.items[0] : null
      };
    });

    // Calcul de la pagination
    const totalPages = Math.ceil(count / limit);

    res.render('customer-orders', {
      orders: formattedOrders,
      stats: statsGlobal, // Utiliser les statistiques globales
      currentStatut: currentStatut,
      currentSearch: currentSearch,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      title: "Mes Commandes | Bijoux Élégance"
    });

  } catch (err) {
    console.error('Erreur dans renderCustomerOrders:', err);
    res.status(500).render("error", { message: "Erreur serveur" });
  }
},

// Récupère les détails d'une commande spécifique
async getCustomerOrderDetails(req, res) {
  try {
    console.log('🔍 Récupération détails commande pour customer:', req.session.customerId, 'order:', req.params.id);
    
    const customerId = req.session.customerId;
    const orderId = req.params.id;
    
    if (!customerId) {
      console.log('❌ Pas de customerId en session');
      return res.status(401).json({ success: false, message: 'Non autorisé' });
    }

    // Vérifier que l'ID de commande est un nombre
    const orderIdNumber = parseInt(orderId);
    if (isNaN(orderIdNumber)) {
      console.log('❌ ID de commande invalide:', orderId);
      return res.status(400).json({ 
        success: false, 
        message: 'ID de commande invalide' 
      });
    }

    console.log('🔍 Recherche commande ID:', orderIdNumber, 'pour customer:', customerId);

    const order = await Order.findOne({
      where: { 
        id: orderIdNumber, 
        customer_id: customerId 
      },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Jewel,
              as: 'jewel',
              attributes: ['id', 'name', 'price_ttc', 'image', 'slug', 'description']
            }
          ]
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['first_name', 'last_name', 'email', 'phone', 'address']
        }
      ]
    });

    if (!order) {
      console.log('❌ Commande non trouvée');
      return res.status(404).json({ 
        success: false, 
        message: 'Commande non trouvée' 
      });
    }

    console.log('✅ Commande trouvée:', order.id, 'avec', order.items?.length || 0, 'articles');

    // Fonctions utilitaires pour le statut
    const getStatusDisplay = (status) => {
      const statusMap = {
        'waiting': 'En attente',
        'preparing': 'En préparation',
        'shipped': 'Expédiée',
        'delivered': 'Livrée',
        'cancelled': 'Annulée'
      };
      return statusMap[status] || 'En cours';
    };

    const getStatusClass = (status) => {
      const classMap = {
        'waiting': 'status-waiting',
        'preparing': 'status-preparing',
        'shipped': 'status-shipped',
        'delivered': 'status-delivered',
        'cancelled': 'status-cancelled'
      };
      return classMap[status] || 'status-default';
    };

    // Calcul du total si nécessaire
    let orderTotal = order.total;
    if (!orderTotal && order.items && order.items.length > 0) {
      orderTotal = order.items.reduce((sum, item) => {
        return sum + (item.quantity * (item.price || item.jewel?.price_ttc || 0));
      }, 0);
    }

    const formattedOrder = {
      ...order.toJSON(),
      total: parseFloat(orderTotal) || 0,
      formatted_date: new Date(order.created_at).toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      status_display: getStatusDisplay(order.status),
      status_class: getStatusClass(order.status)
    };

    console.log('✅ Données formatées envoyées');

    res.json({
      success: true,
      order: formattedOrder
    });

  } catch (err) {
    console.error('❌ Erreur dans getCustomerOrderDetails:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
},

  // Affiche la page d'édition du profil de l'utilisateur
  async renderEditProfilePage(req, res) {
    try {
      const customerId = req.session.customerId;
      
      if (!customerId) {
        return res.redirect('/connexion');
      }
      
      const customer = await Customer.findOne({ where: { id: customerId } });

      if (!customer) {
        return res.status(404).render("error", { message: "Utilisateur non trouvé" });
      }

      res.render("edit-profile", {
        title: "Modifier mon profil | Bijoux Élégance",
        customer: customer
      });
    } catch (err) {
      console.error(err);
      res.status(500).render("error", { message: "Erreur serveur" });
    }
  },

  // Met à jour le profil de l'utilisateur
  async updateUserProfile(req, res) {
    const customerId = req.session.customerId;

    if (!customerId) {
      return res.redirect('/connexion');
    }

    const { first_name, last_name, email, password, confirm_password, address, phone } = req.body;

    try {
      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        return res.status(404).render("error", { message: "Utilisateur non trouvé" });
      }

      // Mise à jour des champs
      if (first_name) customer.first_name = first_name;
      if (last_name) customer.last_name = last_name;
      if (email) customer.email = email;
      if (address !== undefined) customer.address = address;
      if (phone !== undefined) customer.phone = phone;

      // Mise à jour du mot de passe si fourni
      if (password) {
        if (password !== confirm_password) {
          return res.render("edit-profile", {
            title: "Modifier mon profil | Bijoux Élégance",
            customer: customer,
            error: "Les mots de passe ne correspondent pas."
          });
        }

        // Vérification de la complexité du mot de passe
        const schema = new passwordValidator();
        schema
          .is().min(8)
          .is().max(100)
          .has().uppercase()
          .has().lowercase()
          .has().digits(2)
          .has().symbols(1);

        if (!schema.validate(password)) {
          return res.render("edit-profile", {
            title: "Modifier mon profil | Bijoux Élégance",
            customer: customer,
            error: "Mot de passe trop faible (8 caractères minimum, 1 majuscule, 1 minuscule, 2 chiffres, 1 symbole)."
          });
        }

        const hashedPassword = await argon2.hash(password);
        customer.password = hashedPassword;
      }

      await customer.save();
      res.redirect("/profil?success=true");
    } catch (error) {
      console.error(error);
      res.render("edit-profile", {
        title: "Modifier mon profil | Bijoux Élégance",
        customer: customer,
        error: "Une erreur est survenue lors de la mise à jour du profil."
      });
    }
  },

  // Affiche la page de mot de passe oublié
  forgotPasswordPage(req, res) {
    res.render('forgot-password', {
      title: "Mot de passe oublié | Bijoux Élégance",
      error: req.query.error,
      success: req.query.success
    });
  },

  // Traite la demande de réinitialisation de mot de passe
  async processForgotPassword(req, res) {
    const { email } = req.body;
    
    if (!email) {
      return res.redirect('/mot-de-passe-oublie?error=Veuillez saisir votre email');
    }
    
    try {
      const customer = await Customer.findOne({ where: { email } });
      
      // On affiche toujours un message de succès même si l'email n'existe pas
      // pour des raisons de sécurité
      if (customer) {
        // Ici, vous implémenteriez l'envoi d'un email avec un lien de réinitialisation
        // Pour cet exemple, nous redirigeons simplement vers la page avec un message de succès
      }
      
      res.redirect('/mot-de-passe-oublie?success=Un email de réinitialisation a été envoyé si ce compte existe');
    } catch (error) {
      console.error("Erreur lors de la demande de réinitialisation:", error);
      res.redirect('/mot-de-passe-oublie?error=Une erreur est survenue');
    }
  },

  // Affiche la page de confirmation de suppression du compte
  showDeleteConfirmation(req, res) {
    if (!req.session.customerId) {
      return res.redirect('/connexion');
    }

    res.render('delete-account', {
      title: "Suppression de compte | Bijoux Élégance"
    });
  },

  // Supprime le compte de l'utilisateur
  async deleteAccount(req, res) {
    const customerId = req.session.customerId;

    if (!customerId) {
      return res.redirect('/connexion');
    }

    try {
      const customer = await Customer.findOne({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).render("error", { message: "Utilisateur non trouvé" });
      }

      await Customer.destroy({ where: { id: customerId } });

      req.session.destroy((err) => {
        if (err) {
          return res.status(500).render("error", { message: "Erreur lors de la déconnexion" });
        }
        res.clearCookie("customername");
        res.redirect('/?account_deleted=true');
      });
    } catch (err) {
      console.error(err);
      res.status(500).render("error", { message: "Erreur serveur" });
    }
  },

  async setUserForViews  (req, res, next)  {
    try {
        // RÉCUPÉRER L'UTILISATEUR COMPLET DEPUIS LA BASE
        let fullUser = null;
        if (req.session?.user?.id) {
            fullUser = await Customer.findByPk(req.session.user.id, {
                include: [
                    {
                        model: Role,
                        as: 'role',
                        attributes: ['id', 'name']
                    }
                ]
            });
        }

        // Données de base
        res.locals.user = fullUser || req.session?.user || null;
        res.locals.isAuthenticated = !!req.session?.user;
        
        // LOGIQUE STRICTE CORRIGÉE
        let isAdmin = false;
        if (fullUser || req.session?.user) {
            const userToCheck = fullUser || req.session.user;
            isAdmin = userToCheck.role_id === 2;
        }
        res.locals.isAdmin = isAdmin;
        
        // Données supplémentaires
        res.locals.cartItemCount = 0;
        
        console.log('🎭 Données vues définies CORRIGÉES:', {
            isAuthenticated: res.locals.isAuthenticated,
            isAdmin: res.locals.isAdmin,
            userId: fullUser?.id || req.session?.user?.id,
            role_id: fullUser?.role_id || req.session?.user?.role_id,
            userEmail: fullUser?.email || req.session?.user?.email
        });
        
        next();
        
    } catch (error) {
        console.error('❌ Erreur dans setUserForViews:', error);
        res.locals.user = null;
        res.locals.isAuthenticated = false;
        res.locals.isAdmin = false;
        res.locals.cartItemCount = 0;
        next();
    }
},
};