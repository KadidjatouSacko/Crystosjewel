// controllers/cartController.js - Version finale corrigée

import { Cart } from '../models/cartModel.js';
import { Jewel } from '../models/jewelModel.js';
import { JewelImage } from '../models/jewelImage.js';
import { Category } from '../models/categoryModel.js';
import { Sequelize, Op } from 'sequelize';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/sequelize-client.js';

// IMPORTANT: S'assurer que les associations sont chargées
import '../models/associations.js';

// 🔧 FONCTIONS HELPER GLOBALES (en dehors de l'objet)
async function getCartSource(req) {
  const userId = req.session?.user?.id || req.session?.customerId;
  
  if (userId) {
    // Utilisateur connecté - panier en BDD
    console.log('👤 Utilisateur connecté, panier BDD');
    return { type: 'database', userId };
  } else {
    // Invité - panier en session
    console.log('👥 Utilisateur invité, panier session');
    return { type: 'session', cart: req.session.cart || { items: [] } };
  }
}

async function getCartItemCount(req) {
  try {
    const cartSource = await getCartSource(req);
    
    if (cartSource.type === 'database') {
      const result = await sequelize.query(`
        SELECT COALESCE(SUM(quantity), 0) as total_quantity 
        FROM cart 
        WHERE customer_id = :userId
      `, {
        replacements: { userId: cartSource.userId },
        type: QueryTypes.SELECT
      });
      
      return parseInt(result[0]?.total_quantity || 0);
    } else {
      // Panier session
      const sessionCart = cartSource.cart;
      return sessionCart.items.reduce((total, item) => total + (item.quantity || 0), 0);
    }
    
  } catch (error) {
    console.error('❌ Erreur comptage panier:', error.message);
    return 0;
  }
}

export const cartController = {

  /**
   * 📊 Route API pour récupérer le nombre d'articles
   */
  async getCartCount(req, res) {
    try {
      const itemCount = await getCartItemCount(req);
      
      res.json({
        success: true,
        count: itemCount
      });
      
    } catch (error) {
      console.error('❌ Erreur compteur panier:', error);
      res.status(500).json({
        success: false,
        count: 0,
        message: 'Erreur serveur'
      });
    }
  },

  /**
   * ➕ Ajouter un article au panier (BDD ou session)
   */
// ✅ addToCart avec gestion des tailles
async addToCart(req, res) {
  try {
    console.log('📩 Ajout au panier avec données:', req.body);

    // ✅ RÉCUPÉRER LA TAILLE CORRECTEMENT
    const { jewelId, quantity = 1, selectedSize = null, size = null } = req.body;
    const finalSize = selectedSize || size || null; // Support des deux noms
    
    const cartSource = await getCartSource(req);

    if (!jewelId || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides'
      });
    }

    const jewel = await Jewel.findByPk(jewelId, {
      attributes: [
        'id', 'name', 'description', 'price_ttc', 'matiere', 
        'carat', 'image', 'stock', 'poids', 'tailles', 'slug'
      ]
    });
    
    if (!jewel) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    if (jewel.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Stock insuffisant'
      });
    }

    if (cartSource.type === 'database') {
      // ✅ BDD - Chercher un item avec même bijou ET même taille
      const whereClause = { 
        customer_id: cartSource.userId, 
        jewel_id: jewelId
      };
      
      // ✅ IMPORTANT: Ajouter la taille dans la recherche
      if (finalSize) {
        whereClause.size = finalSize;
      } else {
        whereClause.size = null; // Explicitement chercher les items sans taille
      }
      
      const existingItem = await Cart.findOne({ where: whereClause });

      if (existingItem) {
        // Article existant avec même taille -> additionner quantités
        const newQuantity = existingItem.quantity + parseInt(quantity, 10);
        if (newQuantity > jewel.stock) {
          return res.status(400).json({
            success: false,
            message: 'Stock insuffisant pour cette quantité'
          });
        }
        existingItem.quantity = newQuantity;
        await existingItem.save();
        
        console.log(`✅ Quantité mise à jour: bijou ${jewelId}, taille ${finalSize}, nouvelle qté: ${newQuantity}`);
      } else {
        // Nouvel article
        await Cart.create({
          customer_id: cartSource.userId,
          jewel_id: jewelId,
          quantity: parseInt(quantity, 10),
          size: finalSize, // ✅ Sauvegarder la taille sélectionnée
          added_at: new Date()
        });
        
        console.log(`✅ Nouvel article créé: bijou ${jewelId}, taille ${finalSize}, qté: ${quantity}`);
      }
    } else {
      // ✅ SESSION - Même logique avec taille
      if (!req.session.cart) {
        req.session.cart = { items: [] };
      }

      const existingItemIndex = req.session.cart.items.findIndex(
        item => item.jewel && 
                item.jewel.id === parseInt(jewelId) && 
                (item.size || null) === (finalSize || null) // ✅ Comparer correctement les tailles
      );

      if (existingItemIndex !== -1) {
        // Article existant -> additionner
        const newQuantity = req.session.cart.items[existingItemIndex].quantity + parseInt(quantity, 10);
        if (newQuantity > jewel.stock) {
          return res.status(400).json({
            success: false,
            message: 'Stock insuffisant pour cette quantité'
          });
        }
        req.session.cart.items[existingItemIndex].quantity = newQuantity;
      } else {
        // Nouvel article
        const jewelData = jewel.toJSON();
        
        // Parser tailles pour info
        if (typeof jewelData.tailles === 'string') {
          try {
            jewelData.tailles = JSON.parse(jewelData.tailles);
          } catch (error) {
            jewelData.tailles = [];
          }
        }

        req.session.cart.items.push({
          jewel: jewelData,
          quantity: parseInt(quantity, 10),
          size: finalSize // ✅ Stocker la taille sélectionnée
        });
      }
    }

    const newCartCount = await getCartItemCount(req);

    res.json({
      success: true,
      message: finalSize ? 
        `Produit ajouté au panier (taille: ${finalSize})` : 
        'Produit ajouté au panier',
      cartCount: newCartCount,
      jewelName: jewel.name // ✅ Ajouter le nom pour les notifications
    });

  } catch (error) {
    console.error('❌ Erreur addToCart:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout au panier'
    });
  }
},

  /**
   * 📋 Afficher le panier (BDD + session) - VERSION CORRIGÉE
   */
async renderCart(req, res) {
  try {
    const cartSource = await getCartSource(req);
    console.log('🛒 Affichage panier:', cartSource.type);

    let cartItems = [];

    if (cartSource.type === 'database') {
      // ✅ Récupérer avec la colonne size
      const dbCartItems = await Cart.findAll({
        where: { customer_id: cartSource.userId },
        include: [{ 
          model: Jewel, 
          as: 'jewel',
          attributes: [
            'id', 'name', 'description', 'price_ttc', 'matiere', 
            'carat', 'image', 'stock', 'poids', 'tailles', 'slug'
          ]
        }],
        attributes: ['id', 'customer_id', 'jewel_id', 'quantity', 'size', 'added_at']
      });

      cartItems = dbCartItems.map(item => {
        const jewelData = item.jewel.toJSON();
        
        // Parser tailles disponibles
        if (typeof jewelData.tailles === 'string') {
          try {
            jewelData.tailles = JSON.parse(jewelData.tailles);
          } catch (error) {
            jewelData.tailles = [];
          }
        }
        if (!Array.isArray(jewelData.tailles)) {
          jewelData.tailles = [];
        }

        console.log(`🔍 Bijou ${jewelData.id} - Taille sélectionnée: ${item.size}, Tailles dispo:`, jewelData.tailles);

        return {
          jewel: jewelData,
          quantity: item.quantity,
          size: item.size  // ✅ Taille depuis la BDD
        };
      });
    } else {
      // SESSION 
      const sessionCart = cartSource.cart;
      
      for (const item of sessionCart.items) {
        if (item.jewel && item.jewel.id) {
          const currentJewel = await Jewel.findByPk(item.jewel.id, {
            attributes: [
              'id', 'name', 'description', 'price_ttc', 'matiere', 
              'carat', 'image', 'stock', 'poids', 'tailles', 'slug'
            ]
          });
          
          if (currentJewel) {
            const jewelData = currentJewel.toJSON();
            
            if (typeof jewelData.tailles === 'string') {
              try {
                jewelData.tailles = JSON.parse(jewelData.tailles);
              } catch (error) {
                jewelData.tailles = [];
              }
            }
            if (!Array.isArray(jewelData.tailles)) {
              jewelData.tailles = [];
            }

            cartItems.push({
              jewel: jewelData,
              quantity: Math.min(item.quantity, currentJewel.stock),
              size: item.size  // ✅ Taille depuis la session
            });
          }
        }
      }

      req.session.cart = { items: cartItems };
    }

    // Calculs
    const subtotal = cartItems.reduce((total, item) =>
      total + (parseFloat(item.jewel.price_ttc) * item.quantity), 0);

    // ✅ Codes promo avec gestion des erreurs
    const appliedPromo = req.session.appliedPromo || null;
    let discount = 0;
    let discountedSubtotal = subtotal;

    if (appliedPromo && appliedPromo.discountPercent) {
      const discountPercent = parseFloat(appliedPromo.discountPercent);
      discount = (subtotal * discountPercent) / 100;
      discountedSubtotal = subtotal - discount;
    }

    const shippingThreshold = 50;
    const baseShippingFee = 5.90;
    const shippingFee = discountedSubtotal >= shippingThreshold ? 0 : baseShippingFee;
    const finalTotal = discountedSubtotal + shippingFee;

    // Recommandations
    let recommendations = [];
    try {
      recommendations = await Jewel.findAll({
        where: { stock: { [Op.gt]: 0 } },
        limit: 5,
        order: [['created_at', 'DESC']],
        attributes: [
          'id', 'name', 'description', 'price_ttc', 'matiere', 
          'carat', 'image', 'stock', 'poids', 'tailles', 'slug'
        ]
      });
    } catch (error) {
      console.warn('⚠️ Erreur recommandations:', error.message);
    }

    // ✅ Rendu avec TOUTES les variables nécessaires
    res.render('cart', {
      title: 'Mon Panier',
      
      // Structure principale
      cart: {
        items: cartItems,
        totalPrice: subtotal
      },
      
      // Variables individuelles
      cartItems,
      totalPrice: subtotal.toFixed(2),
      
      // ✅ VARIABLES ESSENTIELLES pour éviter l'erreur
      subtotal: subtotal,
      discount: discount,
      discountedSubtotal: discountedSubtotal,
      shippingFee: shippingFee,
      finalTotal: finalTotal,
      
      // ✅ Code promo (même si null)
      appliedPromo: appliedPromo ? {
        code: appliedPromo.code,
        discountPercent: parseFloat(appliedPromo.discountPercent)
      } : null,
      
      // Autres données
      recommendations,
      user: req.session.user || null,
      isGuest: cartSource.type === 'session',
      debugMode: process.env.NODE_ENV === 'development'
    });

  } catch (error) {
    console.error('❌ Erreur renderCart:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      message: 'Erreur lors de l\'affichage du panier'
    });
  }
},

  /**
   * 🔄 Modifier la quantité d'un article
   */
  async updateCartItem(req, res) {
    try {
      const { jewelId, quantity } = req.body;
      const cartSource = await getCartSource(req); // ✅ Utilise la fonction globale

      console.log('🔄 Mise à jour panier:', { jewelId, quantity, type: cartSource.type });

      const newQuantity = parseInt(quantity);

      if (cartSource.type === 'database') {
        // Utilisateur connecté
        const cartItem = await Cart.findOne({
          where: {
            customer_id: cartSource.userId,
            jewel_id: jewelId
          },
          include: [{ model: Jewel, as: 'jewel' }]
        });

        if (!cartItem) {
          return res.status(404).json({
            success: false,
            message: 'Article non trouvé dans le panier'
          });
        }

        if (newQuantity > cartItem.jewel.stock) {
          return res.status(400).json({
            success: false,
            message: `Stock maximum: ${cartItem.jewel.stock}`
          });
        }

        if (newQuantity <= 0) {
          await cartItem.destroy();
        } else {
          await cartItem.update({ quantity: newQuantity });
        }
      } else {
        // Invité - session
        if (!req.session.cart) {
          req.session.cart = { items: [] };
        }

        const itemIndex = req.session.cart.items.findIndex(
          item => item.jewel && item.jewel.id === parseInt(jewelId)
        );

        if (itemIndex === -1) {
          return res.status(404).json({
            success: false,
            message: 'Article non trouvé dans le panier'
          });
        }

        const jewel = await Jewel.findByPk(jewelId);
        if (newQuantity > jewel.stock) {
          return res.status(400).json({
            success: false,
            message: `Stock maximum: ${jewel.stock}`
          });
        }

        if (newQuantity <= 0) {
          req.session.cart.items.splice(itemIndex, 1);
        } else {
          req.session.cart.items[itemIndex].quantity = newQuantity;
        }
      }

      const newCartCount = await getCartItemCount(req); // ✅ Utilise la fonction globale

      res.json({
        success: true,
        message: 'Panier mis à jour avec succès',
        cartCount: newCartCount
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour'
      });
    }
  },

  /**
   * 🗑️ Supprimer un article du panier - FONCTION UNIQUE CORRIGÉE
   */
  async removeFromCart(req, res) {
    try {
      // Support des deux formats: req.params.jewelId et req.body.jewelId
      const jewelId = req.params.jewelId || req.body.jewelId;
      const cartSource = await getCartSource(req); // ✅ Utilise la fonction globale

      console.log('🗑️ Suppression panier:', { jewelId, type: cartSource.type, method: req.method });

      if (!jewelId) {
        return res.status(400).json({
          success: false,
          message: 'ID du bijou manquant'
        });
      }

      let jewelName = 'Article';

      if (cartSource.type === 'database') {
        // Utilisateur connecté
        const cartItem = await Cart.findOne({
          where: {
            customer_id: cartSource.userId,
            jewel_id: parseInt(jewelId)
          },
          include: [{ model: Jewel, as: 'jewel' }]
        });

        if (!cartItem) {
          return res.status(404).json({
            success: false,
            message: 'Article non trouvé dans le panier'
          });
        }

        jewelName = cartItem.jewel ? cartItem.jewel.name : 'Article';
        await cartItem.destroy();
      } else {
        // Invité - session
        if (!req.session.cart) {
          req.session.cart = { items: [] };
        }

        const itemIndex = req.session.cart.items.findIndex(
          item => item.jewel && item.jewel.id === parseInt(jewelId)
        );

        if (itemIndex === -1) {
          return res.status(404).json({
            success: false,
            message: 'Article non trouvé dans le panier'
          });
        }

        jewelName = req.session.cart.items[itemIndex].jewel.name || 'Article';
        req.session.cart.items.splice(itemIndex, 1);
      }

      const newCartCount = await getCartItemCount(req); // ✅ Utilise la fonction globale
      
      console.log(`✅ Article "${jewelName}" supprimé du panier`);
      
      res.json({
        success: true,
        message: `${jewelName} supprimé du panier`,
        cartCount: newCartCount
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
   * 🗑️ Alias pour removeItemFromCart (compatibilité)
   */
  async removeItemFromCart(req, res) {
    return this.removeFromCart(req, res);
  },

  /**
   * 🧹 Vider le panier
   */
  async clearCart(req, res) {
    try {
      const cartSource = await getCartSource(req); // ✅ Utilise la fonction globale

      if (cartSource.type === 'database') {
        const deletedCount = await Cart.destroy({
          where: { customer_id: cartSource.userId }
        });
        console.log(`🗑️ ${deletedCount} articles supprimés de la BDD`);
      } else {
        req.session.cart = { items: [] };
        console.log('🗑️ Panier session vidé');
      }

      res.json({
        success: true,
        message: 'Panier vidé avec succès',
        cartCount: 0
      });

    } catch (error) {
      console.error('❌ Erreur clearCart:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors du vidage du panier'
      });
    }
  },

  /**
   * 📋 Afficher la page du panier (alias de renderCart)
   */
  async showCart(req, res) {
    return this.renderCart(req, res);
  },

  /**
   * 📦 Obtenir le contenu complet du panier
   */
  async getCartDetails(req) {
    try {
      const cartSource = await getCartSource(req); // ✅ Utilise la fonction globale
      
      if (cartSource.type === 'database') {
        const cartItems = await Cart.findAll({
          where: { customer_id: cartSource.userId },
          include: [{
            model: Jewel,
            as: 'jewel',
            required: true
          }],
          order: [['added_at', 'DESC']]
        });

        const items = cartItems.map(item => ({
          id: item.id,
          jewel: item.jewel.toJSON(),
          quantity: item.quantity,
          added_at: item.added_at,
          subtotal: item.jewel.price_ttc * item.quantity
        }));

        const totalPrice = items.reduce((total, item) => total + item.subtotal, 0);
        const itemCount = items.reduce((total, item) => total + item.quantity, 0);

        return { items, totalPrice, itemCount };
      } else {
        // Session cart
        const sessionCart = cartSource.cart;
        const items = [];

        for (const item of sessionCart.items) {
          if (item.jewel && item.jewel.id) {
            const currentJewel = await Jewel.findByPk(item.jewel.id);
            if (currentJewel) {
              const processedItem = {
                jewel: currentJewel.toJSON(),
                quantity: item.quantity,
                subtotal: currentJewel.price_ttc * item.quantity
              };
              items.push(processedItem);
            }
          }
        }

        const totalPrice = items.reduce((total, item) => total + item.subtotal, 0);
        const itemCount = items.reduce((total, item) => total + item.quantity, 0);

        return { items, totalPrice, itemCount };
      }

    } catch (error) {
      console.error('❌ Erreur récupération détails panier:', error);
      return { items: [], totalPrice: 0, itemCount: 0 };
    }
  },

  /**
   * 🔄 Synchroniser le panier de session vers la BDD lors de la connexion
   */
  async syncCartOnLogin(customerId, sessionCart) {
    try {
      console.log(`🔄 Synchronisation panier pour utilisateur ${customerId}`);
      
      if (!sessionCart || !Array.isArray(sessionCart.items) || sessionCart.items.length === 0) {
        console.log('ℹ️ Aucun article dans le panier de session à synchroniser');
        return { success: true, message: 'Aucun article à synchroniser' };
      }

      let syncedItems = 0;
      let skippedItems = 0;

      for (const sessionItem of sessionCart.items) {
        try {
          if (!sessionItem.jewel?.id || !sessionItem.quantity) {
            skippedItems++;
            continue;
          }

          const jewelId = parseInt(sessionItem.jewel.id);
          const quantity = parseInt(sessionItem.quantity);

          if (isNaN(jewelId) || isNaN(quantity) || quantity <= 0) {
            skippedItems++;
            continue;
          }

          // Vérifier que le bijou existe
          const jewel = await Jewel.findByPk(jewelId);
          if (!jewel) {
            console.log(`⚠️ Bijou ${jewelId} non trouvé, ignoré`);
            skippedItems++;
            continue;
          }

          // Chercher un article existant
          const existingCartItem = await Cart.findOne({
            where: { 
              customer_id: customerId, 
              jewel_id: jewelId 
            }
          });

          if (existingCartItem) {
            // Additionner les quantités
            const newQuantity = Math.min(
              existingCartItem.quantity + quantity, 
              jewel.stock
            );
            
            await existingCartItem.update({ 
              quantity: newQuantity,
              updated_at: new Date()
            });
            
            syncedItems++;
          } else {
            // Créer nouvel article
            await Cart.create({
              customer_id: customerId,
              jewel_id: jewelId,
              quantity: Math.min(quantity, jewel.stock),
              added_at: new Date(),
              updated_at: new Date()
            });
            
            syncedItems++;
          }

        } catch (itemError) {
          console.error(`❌ Erreur traitement article:`, itemError);
          skippedItems++;
        }
      }

      console.log(`📊 Synchronisation terminée: ${syncedItems} ajoutés, ${skippedItems} ignorés`);
      
      return {
        success: true,
        syncedItems,
        skippedItems,
        totalItems: sessionCart.items.length
      };

    } catch (globalError) {
      console.error('💥 Erreur critique synchronisation panier:', globalError);
      return {
        success: false,
        error: globalError.message,
        syncedItems: 0,
        skippedItems: 0
      };
    }
  },

  /**
   * 🧮 Calculer les totaux du panier avec promo (simplifiée)
   */
  async calculateCartTotals(req) {
    try {
      const cart = await this.getCartDetails(req);
      const appliedPromo = req.session.appliedPromo || null;
      
      let discount = 0;
      let discountedSubtotal = cart.totalPrice;

      // Calcul simple des codes promo
      if (appliedPromo && appliedPromo.discountPercent) {
        const discountPercent = parseFloat(appliedPromo.discountPercent);
        discount = (cart.totalPrice * discountPercent) / 100;
        discountedSubtotal = cart.totalPrice - discount;
      }

      const shippingFee = discountedSubtotal >= 50 ? 0 : 5.90;
      const total = discountedSubtotal + shippingFee;

      return {
        subtotal: cart.totalPrice,
        discount: discount,
        discountedSubtotal: discountedSubtotal,
        shippingFee: shippingFee,
        total: total,
        itemCount: cart.itemCount,
        freeShipping: discountedSubtotal >= 50
      };

    } catch (error) {
      console.error('❌ Erreur calcul totaux panier:', error);
      return {
        subtotal: 0,
        discount: 0,
        discountedSubtotal: 0,
        shippingFee: 5.90,
        total: 5.90,
        itemCount: 0,
        freeShipping: false
      };
    }
  },

  /**
   * 🔢 Compter les articles dans le panier (méthode helper)
   */
  async countCartItems(req) {
    return getCartItemCount(req); // ✅ Utilise la fonction globale
  },

  /**
   * 🛒 Méthodes dépréciées (pour compatibilité) - SUPPRIMÉES pour éviter confusion
   */
  // getCartSource et getCartItemCount sont maintenant UNIQUEMENT des fonctions globales
};

// 🚀 Export des fonctions helper pour utilisation dans router.js
export { getCartSource, getCartItemCount };