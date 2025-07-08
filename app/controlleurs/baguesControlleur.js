import { Jewel, Category } from '../models/associations.js';
import { Type } from '../models/TypeModel.js';
import { Material } from '../models/MaterialModel.js';
import Sequelize from 'sequelize';

const { Op } = Sequelize;

export const baguesControlleur = {
  // Méthode pour afficher les bagues
  async showRings(req, res) {
  try {
    // Récupération simple des bagues
    const rings = await Jewel.findAll({
      where: { category_id: 3}, // ID catégorie bagues
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 50 // Limiter pour éviter les problèmes
    });

    console.log(`✅ ${rings.length} bagues récupérées`);

    // Formatage simple
    const formattedRings = rings.map(ring => ({
      ...ring.toJSON(),
      formattedPrice: new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(ring.price_ttc),
      image: ring.image || 'no-image.jpg'
    }));

    // Rendu avec TOUTES les données nécessaires
    res.render('bagues', {
      title: 'Nos Bagues',
      pageTitle: 'Nos Bagues',
      jewels: formattedRings,
      
      // Pagination basique
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalJewels: formattedRings.length,
        hasNextPage: false,
        hasPrevPage: false,
        nextPage: 1,
        prevPage: 1
      },
      
      // Filtres vides
      filters: {
        matiere: [],
        type: [],
        prix: [],
        sort: 'newest'
      },
      
      // Données pour filtres (à remplir plus tard)
      materials: [],
      types: [],
      
      // Utilisateur
      user: req.session?.user || null,
      cartItemCount: 0,
      
      // Messages
      error: null,
      success: null
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
        sort: 'newest'
      },
      materials: [],
      types: [],
      user: req.session?.user || null,
      cartItemCount: 0,
      error: `Erreur : ${error.message}`,
      success: null
    });
  }
},
}