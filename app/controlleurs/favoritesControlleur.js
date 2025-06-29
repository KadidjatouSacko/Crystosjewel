// Controllers/favoritesController.js
import { Favorite } from '../models/favoritesModel.js'; 
import { Jewel } from '../models/jewelModel.js';
import { Customer } from '../models/customerModel.js';
import { JewelImage } from '../models/jewelImage.js';

export const favoritesController = {
  // Afficher les favoris d'un utilisateur
  renderFavorites: async (req, res) => {
    try {
        if (!req.session.customer) {
            return res.redirect('/connexion'); // ou afficher un message
        }
        
        const customerId = req.session.customer.id;
      
      // Récupérer les bijoux favoris avec leurs informations
      const favorites = await Favorite.findAll({
        where: { customer_id: customerId },
        include: [
          {
            model: Jewel,
            include: [
              { model: JewelImage, attributes: ['image_url'] }, // Inclure les images des bijoux
              { model: Category, attributes: ['name'] } // Inclure la catégorie des bijoux
            ]
          }
        ],
        order: [['added_at', 'DESC']]
      });

      // Formatter les favoris pour ajouter les images
      const formattedFavorites = favorites.map(favorite => {
        const jewel = favorite.Jewel;
        jewel.images = jewel.JewelImages.map(img => img.image_url);
        jewel.category_name = jewel.Category.name;
        return jewel;
      });
      
      res.render('favorites', { 
        title: 'Mes Favoris | Éclat Doré',
        favorites: formattedFavorites,
        user: req.session.user
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des favoris:', error);
      res.status(500).render('error', { 
        message: 'Une erreur est survenue lors de la récupération de vos favoris',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // Ajouter un bijou aux favoris
  addToFavorites: async (req, res) => {
    try {
      const { jewelId } = req.body;
      const customerId = req.session.user.id;
      
      // Vérifier si le bijou existe
      const jewel = await Jewel.findByPk(jewelId);
      if (!jewel) {
        return res.status(404).json({ success: false, message: 'Bijou non trouvé' });
      }

      // Vérifier si le bijou est déjà dans les favoris
      const existingFavorite = await Favorite.findOne({
        where: { customer_id: customerId, jewel_id: jewelId }
      });

      if (existingFavorite) {
        return res.status(200).json({ success: true, message: 'Ce bijou est déjà dans vos favoris' });
      }

      // Ajouter le bijou aux favoris
      await Favorite.create({ customer_id: customerId, jewel_id: jewelId });

      // Réponse AJAX ou redirection
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(201).json({ success: true, message: 'Bijou ajouté aux favoris' });
      }

      req.flash('success', 'Bijou ajouté à vos favoris avec succès');
      res.redirect('/favoris');
    } catch (error) {
      console.error('Erreur lors de l\'ajout aux favoris:', error);
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(500).json({ success: false, message: 'Une erreur est survenue' });
      }
      req.flash('error', 'Une erreur est survenue lors de l\'ajout aux favoris');
      res.redirect('back');
    }
  },

  // Supprimer un bijou des favoris
  removeFromFavorites: async (req, res) => {
    try {
      const { jewelId } = req.params;
      const customerId = req.session.user.id;
      
      // Supprimer le bijou des favoris
      await Favorite.destroy({
        where: { customer_id: customerId, jewel_id: jewelId }
      });

      // Réponse AJAX ou redirection
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({ success: true, message: 'Bijou retiré des favoris' });
      }

      req.flash('success', 'Bijou retiré de vos favoris');
      res.redirect('/favoris');
    } catch (error) {
      console.error('Erreur lors de la suppression du favori:', error);
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(500).json({ success: false, message: 'Une erreur est survenue' });
      }
      req.flash('error', 'Une erreur est survenue lors de la suppression du favori');
      res.redirect('/favoris');
    }
  }
};


