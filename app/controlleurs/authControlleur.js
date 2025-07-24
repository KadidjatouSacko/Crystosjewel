import { Customer } from "../models/customerModel.js";
import rateLimit from 'express-rate-limit';
import argon2 from "argon2";
import  { sendWelcomeEmail} from "../services/mailService.js";
// import { sendWelcomeMail } from "../utils/mailUtils.js";
import Sequelize from 'sequelize';

import passwordValidator from "password-validator";

// Limiteur de tentatives de connexion
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5,
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


  // Affiche le profil de l'utilisateur
  async renderCustomerProfile(req, res) {
    try {
      const customerId = req.session.customerId;
      
      if (!customerId) {
        return res.redirect('/connexion');
      }
      
      const customer = await Customer.findOne({ where: { id: customerId } });

      if (!customer) {
        return res.status(404).render("error", { message: "Utilisateur non trouvé" });
      }
      const success = req.query.success || null;

      res.render('customer-profile', { 
        success,
        customer,
        title: "Mon Profil | Bijoux Élégance"
      });
    } catch (err) {
      console.error(err);
      res.status(500).render("error", { message: "Erreur serveur" });
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