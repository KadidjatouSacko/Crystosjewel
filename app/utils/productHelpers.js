import { sequelize } from '../models/sequelize-client.js';
import { Op } from 'sequelize';

/**
 * Détermine les badges d'un bijou selon ses caractéristiques
 */
export function determineBadges(jewel) {
    const badges = [];
    const now = new Date();
    const daysDiff = (now - new Date(jewel.created_at)) / (1000 * 60 * 60 * 24);
    
    // 🏷️ PROMOTION (priorité 1)
    if (jewel.discount_percentage && jewel.discount_percentage > 0) {
        const isDiscountActive = isPromotionActive(jewel);
        if (isDiscountActive) {
            badges.push({
                type: 'promotion',
                text: `-${jewel.discount_percentage}%`,
                class: 'badge-promotion',
                priority: 1,
                color: '#e74c3c'
            });
        }
    }
    
    // 🆕 NOUVEAU (priorité 2)
    if (daysDiff <= 14) { // Nouveau pendant 14 jours
        badges.push({
            type: 'nouveau',
            text: 'Nouveau',
            class: 'badge-nouveau',
            priority: 2,
            color: '#27ae60'
        });
    }
    
    // ⭐ BEST-SELLER (priorité 3)
    if (jewel.sales_count && jewel.sales_count >= 10) {
        badges.push({
            type: 'bestseller',
            text: 'Best-seller',
            class: 'badge-bestseller',
            priority: 3,
            color: '#f39c12'
        });
    }
    
    // 🔥 STOCK LIMITÉ (priorité 4)
    if (jewel.stock && jewel.stock <= 3 && jewel.stock > 0) {
        badges.push({
            type: 'stock-limite',
            text: jewel.stock === 1 ? 'Dernier' : `Plus que ${jewel.stock}`,
            class: 'badge-stock-limite',
            priority: 4,
            color: '#e67e22'
        });
    }
    
    // 👁️ POPULAIRE (priorité 5)
    if (jewel.views_count && jewel.views_count >= 50) {
        badges.push({
            type: 'populaire',
            text: 'Populaire',
            class: 'badge-populaire',
            priority: 5,
            color: '#9b59b6'
        });
    }
    
    // Trier par priorité et retourner le plus important
    badges.sort((a, b) => a.priority - b.priority);
    return badges[0] || null;
}

/**
 * Vérifie si une promotion est active
 */
export function isPromotionActive(jewel) {
    if (!jewel.discount_percentage || jewel.discount_percentage <= 0) return false;
    
    const now = new Date();
    const startDate = jewel.discount_start_date ? new Date(jewel.discount_start_date) : null;
    const endDate = jewel.discount_end_date ? new Date(jewel.discount_end_date) : null;
    
    // Si pas de dates, promotion permanente
    if (!startDate && !endDate) return true;
    
    // Vérifier les dates
    if (startDate && now < startDate) return false;
    if (endDate && now > endDate) return false;
    
    return true;
}

/**
 * Calcule le prix final avec réduction
 */
export function calculateFinalPrice(jewel) {
    const originalPrice = parseFloat(jewel.price_ttc) || 0;
    
    if (isPromotionActive(jewel)) {
        const discount = originalPrice * (jewel.discount_percentage / 100);
        return {
            originalPrice,
            finalPrice: originalPrice - discount,
            discount,
            hasDiscount: true,
            savings: discount
        };
    }
    
    return {
        originalPrice,
        finalPrice: originalPrice,
        discount: 0,
        hasDiscount: false,
        savings: 0
    };
}

/**
 * Génère les filtres disponibles pour une catégorie
 */
export async function getAvailableFilters(categoryId = null) {
    try {
        let whereClause = { is_active: true };
        if (categoryId) {
            whereClause.category_id = categoryId;
        }
        
        // Récupérer tous les matériaux utilisés
        const materials = await sequelize.query(`
            SELECT DISTINCT matiere as name, COUNT(*) as count
            FROM jewel 
            WHERE matiere IS NOT NULL 
            AND TRIM(matiere) != ''
            ${categoryId ? 'AND category_id = :categoryId' : ''}
            GROUP BY matiere
            HAVING COUNT(*) > 0
            ORDER BY count DESC, matiere ASC
        `, {
            replacements: categoryId ? { categoryId } : {},
            type: sequelize.QueryTypes.SELECT
        });
        
        // Récupérer toutes les tailles utilisées
        const sizes = await sequelize.query(`
            SELECT DISTINCT taille as name, COUNT(*) as count
            FROM jewel 
            WHERE taille IS NOT NULL 
            AND TRIM(taille) != ''
            ${categoryId ? 'AND category_id = :categoryId' : ''}
            GROUP BY taille
            HAVING COUNT(*) > 0
            ORDER BY 
                CASE 
                    WHEN taille ~ '^[0-9]+$' THEN CAST(taille AS INTEGER)
                    ELSE 999
                END ASC,
                taille ASC
        `, {
            replacements: categoryId ? { categoryId } : {},
            type: sequelize.QueryTypes.SELECT
        });
        
        // Récupérer les types utilisés
        const types = await sequelize.query(`
            SELECT t.name, COUNT(j.id) as count
            FROM "Types" t
            INNER JOIN jewel j ON j.type_id = t.id
            WHERE j.is_active = true
            ${categoryId ? 'AND j.category_id = :categoryId' : ''}
            GROUP BY t.id, t.name
            HAVING COUNT(j.id) > 0
            ORDER BY count DESC, t.name ASC
        `, {
            replacements: categoryId ? { categoryId } : {},
            type: sequelize.QueryTypes.SELECT
        });
        
        // Calculer les fourchettes de prix
        const priceRange = await sequelize.query(`
            SELECT 
                MIN(price_ttc) as min_price,
                MAX(price_ttc) as max_price,
                COUNT(*) as total_count
            FROM jewel 
            WHERE is_active = true
            AND price_ttc > 0
            ${categoryId ? 'AND category_id = :categoryId' : ''}
        `, {
            replacements: categoryId ? { categoryId } : {},
            type: sequelize.QueryTypes.SELECT
        });
        
        // Calculer les disponibilités
        const availability = await sequelize.query(`
            SELECT 
                SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as in_stock,
                SUM(CASE WHEN discount_percentage > 0 THEN 1 ELSE 0 END) as on_sale,
                SUM(CASE WHEN created_at > NOW() - INTERVAL '14 days' THEN 1 ELSE 0 END) as new_items,
                COUNT(*) as total
            FROM jewel 
            WHERE is_active = true
            ${categoryId ? 'AND category_id = :categoryId' : ''}
        `, {
            replacements: categoryId ? { categoryId } : {},
            type: sequelize.QueryTypes.SELECT
        });
        
        return {
            materials: materials || [],
            sizes: sizes || [],
            types: types || [],
            priceRange: {
                min: Math.floor(priceRange[0]?.min_price || 0),
                max: Math.ceil(priceRange[0]?.max_price || 1000)
            },
            availability: availability[0] || {
                in_stock: 0,
                on_sale: 0,
                new_items: 0,
                total: 0
            }
        };
    } catch (error) {
        console.error('❌ Erreur récupération filtres:', error);
        return {
            materials: [],
            sizes: [],
            types: [],
            priceRange: { min: 0, max: 1000 },
            availability: { in_stock: 0, on_sale: 0, new_items: 0, total: 0 }
        };
    }
}
