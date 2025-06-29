import { Jewel, Category } from '../models/associations.js';
import { Type } from '../models/TypeModel.js';
import { Material } from '../models/MaterialModel.js';
import Sequelize from 'sequelize';
const { Op } = Sequelize;

export const baguesControlleur = {
    // Méthode pour afficher les bagues avec filtres avancés
    async showRings(req, res) {
        try {
            console.log('🎯 Début showRings avec filtres avancés');
            
            const page = parseInt(req.query.page) || 1;
            const limit = 12;
            const offset = (page - 1) * limit;
            
            // Récupération des filtres depuis l'URL
            const filters = {
                matiere: req.query.matiere || [],
                type: req.query.type || [],
                prix: req.query.prix || [],
                taille: req.query.taille || [],
                sort: req.query.sort || 'popularity'
            };

            // Construction des conditions WHERE
            const whereConditions = {
                category_id: 3, // ID catégorie bagues
                is_active: true // Seulement les bijoux actifs
            };

            // Filtre par matériau
            if (filters.matiere.length > 0) {
                const materiaux = Array.isArray(filters.matiere) ? filters.matiere : [filters.matiere];
                whereConditions.matiere = {
                    [Op.in]: materiaux
                };
            }

            // Filtre par type
            if (filters.type.length > 0) {
                const types = Array.isArray(filters.type) ? filters.type : [filters.type];
                whereConditions.type_id = {
                    [Op.in]: types
                };
            }

            // Filtre par prix
            if (filters.prix.length > 0) {
                const prixRanges = Array.isArray(filters.prix) ? filters.prix : [filters.prix];
                const priceConditions = [];
                
                prixRanges.forEach(range => {
                    switch(range) {
                        case '0-500':
                            priceConditions.push({ price_ttc: { [Op.lt]: 500 } });
                            break;
                        case '500-1000':
                            priceConditions.push({ 
                                price_ttc: { [Op.gte]: 500, [Op.lt]: 1000 } 
                            });
                            break;
                        case '1000-2000':
                            priceConditions.push({ 
                                price_ttc: { [Op.gte]: 1000, [Op.lt]: 2000 } 
                            });
                            break;
                        case '2000+':
                            priceConditions.push({ price_ttc: { [Op.gte]: 2000 } });
                            break;
                    }
                });
                
                if (priceConditions.length > 0) {
                    whereConditions[Op.or] = priceConditions;
                }
            }

            // Filtre par taille (en supposant que les tailles sont stockées en JSON)
            if (filters.taille.length > 0) {
                const tailles = Array.isArray(filters.taille) ? filters.taille : [filters.taille];
                // Condition pour vérifier si une des tailles demandées existe dans le JSON
                const tailleConditions = tailles.map(taille => 
                    Sequelize.literal(`JSON_CONTAINS(tailles, '"${taille}"')`)
                );
                whereConditions[Op.or] = [...(whereConditions[Op.or] || []), ...tailleConditions];
            }

            // Gestion du tri
            let orderBy = [['created_at', 'DESC']]; // Par défaut
            
            switch(filters.sort) {
                case 'price_asc':
                    orderBy = [['price_ttc', 'ASC']];
                    break;
                case 'price_desc':
                    orderBy = [['price_ttc', 'DESC']];
                    break;
                case 'newest':
                    orderBy = [['created_at', 'DESC']];
                    break;
                case 'popularity':
                    orderBy = [['views_count', 'DESC'], ['sales_count', 'DESC']];
                    break;
                case 'name':
                    orderBy = [['name', 'ASC']];
                    break;
            }

            // Récupération des bagues avec pagination
            const { count, rows: rings } = await Jewel.findAndCountAll({
                where: whereConditions,
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name']
                    }
                ],
                order: orderBy,
                limit: limit,
                offset: offset,
                distinct: true
            });

            console.log(`✅ ${rings.length} bagues récupérées sur ${count} total`);

            // Récupération des données pour les filtres
            
            // 1. Matériaux avec quantités
            const materialsWithCount = await Jewel.findAll({
                where: { category_id: 3, is_active: true },
                attributes: [
                    'matiere',
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'quantity']
                ],
                group: ['matiere'],
                raw: true
            });

            const materials = materialsWithCount.map((mat, index) => ({
                id: index + 1,
                name: mat.matiere,
                quantity: parseInt(mat.quantity)
            }));

            // 2. Types avec quantités
            const typesWithCount = await Type.findAll({
                include: [{
                    model: Jewel,
                    as: 'jewels',
                    where: { category_id: 3, is_active: true },
                    attributes: [],
                    required: false
                }],
                attributes: [
                    'id', 
                    'name',
                    [Sequelize.fn('COUNT', Sequelize.col('jewels.id')), 'quantity']
                ],
                group: ['Type.id', 'Type.name'],
                raw: true
            });

            const types = typesWithCount.map(type => ({
                id: type.id,
                name: type.name,
                quantity: parseInt(type.quantity) || 0
            }));

            // 3. Tailles disponibles avec quantités
            const ringsWithSizes = await Jewel.findAll({
                where: { category_id: 3, is_active: true, tailles: { [Op.ne]: null } },
                attributes: ['tailles'],
                raw: true
            });

            const sizeCount = {};
            ringsWithSizes.forEach(ring => {
                if (ring.tailles) {
                    try {
                        const sizes = JSON.parse(ring.tailles);
                        if (Array.isArray(sizes)) {
                            sizes.forEach(size => {
                                sizeCount[size] = (sizeCount[size] || 0) + 1;
                            });
                        }
                    } catch (e) {
                        console.warn('Erreur parsing tailles:', e);
                    }
                }
            });

            const availableSizes = Object.keys(sizeCount)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(size => ({
                    value: size,
                    quantity: sizeCount[size]
                }));

            // 4. Ranges de prix avec quantités
            const priceRanges = [
                {
                    value: '0-500',
                    label: 'Moins de 500€',
                    quantity: await Jewel.count({
                        where: { 
                            category_id: 3, 
                            is_active: true,
                            price_ttc: { [Op.lt]: 500 }
                        }
                    })
                },
                {
                    value: '500-1000',
                    label: '500€ - 1000€',
                    quantity: await Jewel.count({
                        where: { 
                            category_id: 3, 
                            is_active: true,
                            price_ttc: { [Op.gte]: 500, [Op.lt]: 1000 }
                        }
                    })
                },
                {
                    value: '1000-2000',
                    label: '1000€ - 2000€',
                    quantity: await Jewel.count({
                        where: { 
                            category_id: 3, 
                            is_active: true,
                            price_ttc: { [Op.gte]: 1000, [Op.lt]: 2000 }
                        }
                    })
                },
                {
                    value: '2000+',
                    label: 'Plus de 2000€',
                    quantity: await Jewel.count({
                        where: { 
                            category_id: 3, 
                            is_active: true,
                            price_ttc: { [Op.gte]: 2000 }
                        }
                    })
                }
            ];

            // Vérification des codes promo actifs
            let activePromoCode = null;
            try {
                const PromoCode = (await import('../models/PromoCodeModel.js')).PromoCode;
                activePromoCode = await PromoCode.findOne({
                    where: {
                        is_active: true,
                        start_date: { [Op.lte]: new Date() },
                        end_date: { [Op.gte]: new Date() }
                    },
                    order: [['discount_value', 'DESC']]
                });
            } catch (error) {
                console.log('Pas de modèle PromoCode trouvé');
            }

            // Formatage des bagues avec gestion des réductions et badges
            const formattedRings = rings.map(ring => {
                const ringData = ring.toJSON();
                
                // Calcul du prix actuel et original
                let currentPrice = ringData.price_ttc;
                let originalPrice = ringData.price_ttc;
                let hasDiscount = false;
                let discountPercentage = 0;

                // Vérifier les réductions du bijou
                if (ringData.discount_percentage && 
                    ringData.discount_start_date && 
                    ringData.discount_end_date) {
                    const now = new Date();
                    const startDate = new Date(ringData.discount_start_date);
                    const endDate = new Date(ringData.discount_end_date);
                    
                    if (now >= startDate && now <= endDate) {
                        hasDiscount = true;
                        discountPercentage = ringData.discount_percentage;
                        currentPrice = originalPrice * (1 - discountPercentage / 100);
                    }
                }

                // Déterminer le badge
                let badge = null;
                let badgeClass = '';
                
                if (hasDiscount) {
                    badge = 'PROMO';
                    badgeClass = 'promo';
                } else if (ringData.views_count > 100 || ringData.sales_count > 10) {
                    badge = 'POPULAIRE';
                    badgeClass = 'populaire';
                } else if (ringData.created_at && 
                           new Date(ringData.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
                    badge = 'NOUVEAU';
                    badgeClass = 'nouveau';
                }

                // Images supplémentaires (simulation)
                const additionalImages = [];
                if (ringData.image) {
                    // On peut ajouter d'autres images si elles existent
                    // additionalImages.push('image2.jpg', 'image3.jpg');
                }

                return {
                    ...ringData,
                    formattedCurrentPrice: new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(currentPrice),
                    formattedOriginalPrice: new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(originalPrice),
                    hasDiscount,
                    discountPercentage,
                    badge,
                    badgeClass,
                    image: ringData.image || 'no-image.jpg',
                    additional_images: additionalImages
                };
            });

            // Calcul de la pagination
            const totalPages = Math.ceil(count / limit);
            const pagination = {
                currentPage: page,
                totalPages: totalPages,
                totalJewels: count,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            };

            console.log('📊 Données préparées:', {
                bagues: formattedRings.length,
                materiaux: materials.length,
                types: types.length,
                tailles: availableSizes.length,
                pagination: pagination
            });

            // Rendu de la page
            res.render('bagues', {
                title: 'Nos Bagues',
                pageTitle: 'Nos Bagues',
                jewels: formattedRings,
                pagination: pagination,
                filters: filters,
                
                // Données pour les filtres
                materials: materials,
                types: types,
                availableSizes: availableSizes,
                priceRanges: priceRanges,
                
                // Code promo actif
                activePromoCode: activePromoCode,
                
                // Utilisateur et panier
                user: req.session?.user || null,
                cartItemCount: req.session?.cartItemCount || 0,
                
                // Messages
                error: req.query.error || null,
                success: req.query.success || null
            });

        } catch (error) {
            console.error('❌ Erreur dans showRings:', error);
            
            // Rendu d'urgence avec données minimales
            res.status(500).render('bagues', {
                title: 'Nos Bagues - Erreur',
                pageTitle: 'Nos Bagues',
                jewels: [],
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalJewels: 0,
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextPage: 1,
                    prevPage: 1
                },
                filters: {
                    matiere: [],
                    type: [],
                    prix: [],
                    taille: [],
                    sort: 'newest'
                },
                materials: [],
                types: [],
                availableSizes: [],
                priceRanges: [],
                activePromoCode: null,
                user: req.session?.user || null,
                cartItemCount: 0,
                error: `Erreur : ${error.message}`,
                success: null
            });
        }
    },

    // Méthode pour l'API de suivi des vues
    async trackView(req, res) {
        try {
            const { jewelId, jewelName } = req.body;
            
            if (!jewelId) {
                return res.json({ success: false, message: 'ID bijou manquant' });
            }

            // Incrémenter le compteur de vues
            await Jewel.increment('views_count', {
                where: { id: jewelId }
            });

            // Optionnel : enregistrer dans une table de logs
            try {
                const JewelViewsLog = (await import('../models/JewelViewsLogModel.js')).JewelViewsLog;
                await JewelViewsLog.create({
                    jewel_id: jewelId,
                    user_ip: req.ip,
                    session_id: req.session.id,
                    user_agent: req.get('User-Agent'),
                    created_at: new Date()
                });
            } catch (logError) {
                console.log('Log des vues non disponible');
            }

            // Récupérer le nombre total de vues
            const jewel = await Jewel.findByPk(jewelId, {
                attributes: ['views_count']
            });

            res.json({
                success: true,
                views: jewel ? jewel.views_count : 1,
                message: `Vue trackée pour ${jewelName}`
            });

        } catch (error) {
            console.error('Erreur lors du tracking de vue:', error);
            res.json({
                success: false,
                message: 'Erreur lors du suivi de la vue'
            });
        }
    }
};