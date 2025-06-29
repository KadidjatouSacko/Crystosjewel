// app/middleware/cartMiddleware.js - Middleware pour le compteur de panier

import { sequelize } from '../models/sequelize-client.js';
import { QueryTypes } from 'sequelize';

/**
 * Middleware pour ajouter le compteur de panier à toutes les vues
 */
export const cartCountMiddleware = async (req, res, next) => {
    try {
        // Initialiser le compteur de panier
        let cartItemCount = 0;
        
        // Si l'utilisateur est connecté, récupérer le vrai nombre d'articles
        if (req.user && req.user.id) {
            try {
                const result = await sequelize.query(`
                    SELECT COUNT(*) as count 
                    FROM cart_items 
                    WHERE user_id = :userId
                `, {
                    replacements: { userId: req.user.id },
                    type: QueryTypes.SELECT
                });
                
                cartItemCount = result[0]?.count || 0;
            } catch (error) {
                console.error('Erreur lors de la récupération du compteur de panier:', error);
                // En cas d'erreur, on garde 0
            }
        } else {
            // Pour les utilisateurs non connectés, vérifier le panier en session
            if (req.session && req.session.cart) {
                cartItemCount = req.session.cart.length || 0;
            }
        }
        
        // Ajouter le compteur aux variables locales pour toutes les vues
        res.locals.cartItemCount = cartItemCount;
        
        next();
    } catch (error) {
        console.error('Erreur dans cartCountMiddleware:', error);
        // En cas d'erreur, continuer avec un compteur à 0
        res.locals.cartItemCount = 0;
        next();
    }
};

/**
 * Fonction utilitaire pour mettre à jour le compteur de panier
 */
export const updateCartCount = async (userId, sessionCart = null) => {
    if (userId) {
        try {
            const result = await sequelize.query(`
                SELECT COUNT(*) as count 
                FROM cart_items 
                WHERE user_id = :userId
            `, {
                replacements: { userId },
                type: QueryTypes.SELECT
            });
            
            return result[0]?.count || 0;
        } catch (error) {
            console.error('Erreur lors de la mise à jour du compteur de panier:', error);
            return 0;
        }
    } else if (sessionCart) {
        return Array.isArray(sessionCart) ? sessionCart.length : 0;
    }
    
    return 0;
};