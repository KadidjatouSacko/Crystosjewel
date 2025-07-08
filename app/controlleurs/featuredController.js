// controlleurs/featuredController.js - Version corrigée
import { Jewel } from '../models/jewelModel.js';
import { JewelImage } from '../models/jewelImage.js';
import { Category } from '../models/categoryModel.js';
import { Op } from 'sequelize'; // ← AJOUT MANQUANT


export const featuredController = {

  // Afficher la page de gestion des coups de cœur
  showFeaturedManagement: async (req, res) => {
    try {
      console.log('📋 Chargement page gestion coups de cœur...');
      
      // Récupérer tous les bijoux
      const allJewels = await Jewel.findAll({
        include: [
          {
            model: Category,
            as: 'category',
            required: false
          }
        ],
        where: {
          is_active: true,
          stock: { [Op.gt]: 0 }
        },
        order: [['name', 'ASC']]
      });
      
      // Récupérer les coups de cœur actuels
      const featuredJewels = await Jewel.findAll({
        where: {
          is_featured: true,
          is_active: true
        },
        include: [
          {
            model: Category,
            as: 'category',
            required: false
          }
        ],
        order: [['featured_order', 'ASC']]
      });
      
      console.log(`✅ ${allJewels.length} bijoux trouvés, ${featuredJewels.length} coups de cœur`);
      
      res.render('featured', {
        title: 'Gestion des Coups de Cœur',
        allJewels: allJewels,
        featuredJewels: featuredJewels,
        user: req.session?.user || null
      });
      
    } catch (error) {
      console.error('❌ Erreur chargement page coups de cœur:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).render('error', {
        title: 'Erreur',
        message: 'Erreur lors du chargement de la page: ' + error.message,
        user: req.session?.user || null
      });
    }
  },
  
  addToFeatured: async (req, res) => {
    try {
      const { jewelId } = req.body;
      
      // Vérifier le nombre actuel
      const currentCount = await Jewel.count({
        where: { is_featured: true }
      });
      
      if (currentCount >= 4) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 4 coups de cœur autorisés'
        });
      }
      
      const jewel = await Jewel.findByPk(jewelId);
      if (!jewel || jewel.is_featured) {
        return res.status(400).json({
          success: false,
          message: 'Bijou non trouvé ou déjà en coup de cœur'
        });
      }
      
      await jewel.update({
        is_featured: true,
        featured_order: currentCount + 1
      });
      
      res.json({
        success: true,
        message: 'Bijou ajouté aux coups de cœur'
      });
      
    } catch (error) {
      console.error('❌ Erreur ajout:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  },
  

// Remplacez la méthode removeFromFeatured par ceci :
removeFromFeatured: async (req, res) => {
    try {
        const { jewelId } = req.body;
        console.log('🎯 Retrait coup de cœur:', jewelId);

        if (!jewelId) {
            return res.status(400).json({
                success: false,
                message: 'ID du bijou requis'
            });
        }

        const jewel = await Jewel.findByPk(jewelId);
        if (!jewel) {
            return res.status(404).json({
                success: false,
                message: 'Bijou non trouvé'
            });
        }

        if (!jewel.is_featured) {
            return res.status(400).json({
                success: false,
                message: 'Ce bijou n\'est pas un coup de cœur'
            });
        }

        const removedOrder = jewel.featured_order;

        // Retirer des coups de cœur
        await jewel.update({
            is_featured: false,
            featured_order: null
        });

        // Réorganiser les ordres avec SQL direct (plus sûr)
        if (removedOrder) {
            await sequelize.query(`
                UPDATE jewels 
                SET featured_order = featured_order - 1 
                WHERE is_featured = true 
                AND featured_order > :removedOrder
            `, {
                replacements: { removedOrder: removedOrder },
                type: sequelize.QueryTypes.UPDATE
            });
        }

        console.log(`✅ Bijou ${jewelId} retiré des coups de cœur avec succès`);

        res.json({
            success: true,
            message: 'Bijou retiré des coups de cœur'
        });

    } catch (error) {
        console.error('❌ Erreur retrait coup de cœur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur: ' + error.message
        });
    }
},

  // Récupérer tous les bijoux pour l'interface admin (AJAX)
  getAllJewelsForAdmin: async (req, res) => {
    try {
      const bijoux = await Jewel.findAll({
        include: [
          {
            model: JewelImage,
            as: 'additionalImages',
            required: false,
            limit: 1
          },
          {
            model: Category,
            as: 'category',
            required: false
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const bijouxFormates = bijoux.map(bijou => {
        const bijouData = bijou.toJSON();
        bijouData.image = bijouData.additionalImages && bijouData.additionalImages.length > 0 
          ? bijouData.additionalImages[0].image_path 
          : null;
        return bijouData;
      });

      console.log(`📊 ${bijouxFormates.length} bijoux récupérés pour l'interface admin`);

      res.json({
        success: true,
        bijoux: bijouxFormates,
        total: bijouxFormates.length
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des bijoux:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des bijoux'
      });
    }
  },

  // Récupérer les coups de cœur actuels (AJAX)
  getCurrentFeatured: async (req, res) => {
    try {
      const coupsDeCoeur = await Jewel.findAll({
        where: { is_featured: true },
        include: [
          {
            model: JewelImage,
            as: 'additionalImages',
            required: false,
            limit: 1
          },
          {
            model: Category,
            as: 'category',
            required: false
          }
        ],
        order: [['featured_order', 'ASC']]
      });

      const coupsDeCoeurFormates = coupsDeCoeur.map(bijou => {
        const bijouData = bijou.toJSON();
        bijouData.image = bijouData.additionalImages && bijouData.additionalImages.length > 0 
          ? bijouData.additionalImages[0].image_path 
          : null;
        return bijouData;
      });

      console.log(`❤️ ${coupsDeCoeurFormates.length} coups de cœur actuels`);

      res.json({
        success: true,
        coupsDeCoeur: coupsDeCoeurFormates,
        total: coupsDeCoeurFormates.length
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des coups de cœur:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des coups de cœur'
      });
    }
  },

  // Générer le HTML des coups de cœur pour rafraîchissement (AJAX)
  getFeaturedHtml: async (req, res) => {
    try {
      const coupsDeCoeur = await Jewel.findAll({
        where: { 
          is_featured: true,
          stock: { [Op.gt]: 0 }
        },
        include: [
          {
            model: JewelImage,
            as: 'additionalImages',
            required: false,
            limit: 1
          },
          {
            model: Category,
            as: 'category',
            required: false
          }
        ],
        order: [['featured_order', 'ASC']],
        limit: 4
      });

      const coupsDeCoeurFormates = coupsDeCoeur.map(bijou => {
        const bijouData = bijou.toJSON();
        bijouData.image = bijouData.additionalImages && bijouData.additionalImages.length > 0 
          ? bijouData.additionalImages[0].image_path 
          : null;
        return bijouData;
      });

      console.log(`🔄 Génération HTML pour ${coupsDeCoeurFormates.length} coups de cœur`);

      res.render('partials/featured-section', {
        featuredJewels: coupsDeCoeurFormates,
        user: req.session?.user || null
      }, (err, html) => {
        if (err) {
          console.error('❌ Erreur de rendu:', err);
          res.status(500).json({ success: false, message: 'Erreur de rendu' });
        } else {
          res.send(html);
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors du rendu HTML:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors du rendu'
      });
    }
  },

  // Récupérer les coups de cœur pour la page d'accueil
  getFeaturedForHome: async () => {
    try {
      const featuredJewels = await Jewel.findAll({
        where: { 
          is_featured: true,
          stock: { [Op.gt]: 0 }
        },
        include: [
          {
            model: JewelImage,
            as: 'additionalImages',
            required: false,
            limit: 1
          },
          {
            model: Category,
            as: 'category',
            required: false
          }
        ],
        order: [['featured_order', 'ASC']],
        limit: 4
      });

      return featuredJewels.map(jewel => {
        const jewelData = jewel.toJSON();
        jewelData.image = jewelData.additionalImages && jewelData.additionalImages.length > 0 
          ? jewelData.additionalImages[0].image_path 
          : null;
        return jewelData;
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des coups de cœur:', error);
      return [];
    }
  }
};