// controllers/adminController.js - Version complète
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Op } from 'sequelize';
import{ Jewel}from '../models/jewelModel.js';
// mainControlleur.js
import { Category} from '../models/categoryModel.js';

import{ JewelImage}from '../models/jewelImage.js';
import{ HomeImage}from '../models/HomeImage.js';
import{ SiteSetting}from '../models/SiteSetting.js';

// Configuration de multer pour l'upload des images d'accueil
const homeImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'public/images/home';
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const { imageType, imageId } = req.body;
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const filename = `${imageType}-${imageId}-${timestamp}${ext}`;
    cb(null, filename);
  }
});

const homeImageUpload = multer({
  storage: homeImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Le fichier doit être une image'), false);
    }
  }
});

export const adminController = {
  
  // Middleware de vérification admin
  requireAdmin: (req, res, next) => {
    console.log('=== VERIFICATION ADMIN ===');
    console.log('User role:', req.session.user?.role?.name);
    
    if (!req.session.user || !req.session.user.role || 
        req.session.user.role.name !== 'administrateur') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }
    
    console.log('✅ Accès admin autorisé');
    next();
  },

  // Upload d'image pour la page d'accueil
  uploadHomeImage: [
    homeImageUpload.single('image'),
    async (req, res) => {
      try {
        console.log('📤 Upload d\'image reçu:', req.body, req.file);

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Aucun fichier reçu'
          });
        }

        const { imageType, imageId } = req.body;

        if (!imageType || !imageId) {
          return res.status(400).json({
            success: false,
            message: 'Type d\'image et ID requis'
          });
        }

        // Vérifier les types autorisés
        const allowedTypes = ['category', 'featured'];
        if (!allowedTypes.includes(imageType)) {
          return res.status(400).json({
            success: false,
            message: 'Type d\'image non autorisé'
          });
        }

        // Supprimer l'ancienne image
        await cleanOldHomeImage(imageType, imageId);

        // Nouveau chemin d'image
        const imagePath = `/images/home/${req.file.filename}`;

        // Sauvegarder en base de données
        await HomeImage.upsert({
          image_type: imageType,
          image_key: imageId,
          image_path: imagePath,
          alt_text: req.body.altText || '',
          is_active: true
        });

        console.log('✅ Image sauvegardée:', imagePath);

        res.json({
          success: true,
          message: 'Image mise à jour avec succès',
          imagePath: imagePath,
          imageType: imageType,
          imageId: imageId
        });

      } catch (error) {
        console.error('❌ Erreur lors de l\'upload d\'image:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
          success: false,
          message: 'Erreur serveur lors de l\'upload'
        });
      }
    }
  ],

  // Récupérer tous les bijoux pour la gestion des coups de cœur
  getAllJewels: async (req, res) => {
    try {
      console.log('📋 Récupération de tous les bijoux...');

      const jewels = await Jewel.findAll({
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          },
          {
            model: JewelImage,
            as: 'additionalImages',
            attributes: ['image_path'],
            limit: 1
          }
        ],
        where: {
          is_active: true,
          stock: { [Op.gt]: 0 }
        },
        order: [['name', 'ASC']]
      });

      const jewelsData = jewels.map(jewel => {
        const data = jewel.toJSON();
        data.image = data.additionalImages && data.additionalImages.length > 0 
          ? data.additionalImages[0].image_path 
          : data.image;
        return data;
      });

      console.log(`✅ ${jewelsData.length} bijoux récupérés`);

      res.json({
        success: true,
        jewels: jewelsData
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des bijoux:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des bijoux'
      });
    }
  },

  // Récupérer les coups de cœur actuels
  getFeaturedJewels: async (req, res) => {
    try {
      console.log('❤️ Récupération des coups de cœur...');

      const featured = await Jewel.findAll({
        where: {
          is_featured: true,
          is_active: true
        },
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          },
          {
            model: JewelImage,
            as: 'additionalImages',
            attributes: ['image_path'],
            limit: 1
          }
        ],
        order: [['featured_order', 'ASC']]
      });

      const featuredData = featured.map(jewel => {
        const data = jewel.toJSON();
        data.image = data.additionalImages && data.additionalImages.length > 0 
          ? data.additionalImages[0].image_path 
          : data.image;
        return data;
      });

      console.log(`✅ ${featuredData.length} coups de cœur récupérés`);

      res.json({
        success: true,
        featured: featuredData
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des coups de cœur:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des coups de cœur'
      });
    }
  },

  // Ajouter un bijou aux coups de cœur
  addToFeatured: async (req, res) => {
    try {
      const { jewelId } = req.body;

      if (!jewelId) {
        return res.status(400).json({
          success: false,
          message: 'ID du bijou requis'
        });
      }

      console.log(`❤️ Ajout du bijou ${jewelId} aux coups de cœur...`);

      // Vérifier le nombre actuel de coups de cœur
      const currentCount = await Jewel.count({
        where: { is_featured: true }
      });

      if (currentCount >= 4) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 4 coups de cœur autorisés'
        });
      }

      // Vérifier que le bijou existe et n'est pas déjà en coup de cœur
      const jewel = await Jewel.findByPk(jewelId);

      if (!jewel) {
        return res.status(404).json({
          success: false,
          message: 'Bijou non trouvé'
        });
      }

      if (jewel.is_featured) {
        return res.status(400).json({
          success: false,
          message: 'Ce bijou est déjà un coup de cœur'
        });
      }

      // Ajouter aux coups de cœur
      await jewel.update({
        is_featured: true,
        featured_order: currentCount + 1
      });

      console.log(`✅ Bijou ${jewelId} ajouté aux coups de cœur`);

      res.json({
        success: true,
        message: 'Bijou ajouté aux coups de cœur',
        featuredOrder: currentCount + 1
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout aux coups de cœur:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout aux coups de cœur'
      });
    }
  },

  // Retirer un bijou des coups de cœur
  removeFromFeatured: async (req, res) => {
    try {
      const { jewelId } = req.body;

      if (!jewelId) {
        return res.status(400).json({
          success: false,
          message: 'ID du bijou requis'
        });
      }

      console.log(`💔 Retrait du bijou ${jewelId} des coups de cœur...`);

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

      // Réorganiser les ordres des autres coups de cœur
      await Jewel.update(
        {
          featured_order: Jewel.sequelize.literal('featured_order - 1')
        },
        {
          where: {
            is_featured: true,
            featured_order: { [Op.gt]: removedOrder }
          }
        }
      );

      console.log(`✅ Bijou ${jewelId} retiré des coups de cœur`);

      res.json({
        success: true,
        message: 'Bijou retiré des coups de cœur'
      });

    } catch (error) {
      console.error('❌ Erreur lors du retrait des coups de cœur:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du retrait des coups de cœur'
      });
    }
  },

  // Récupérer les images de la page d'accueil
  getHomeImages: async (req, res) => {
    try {
      console.log('🖼️ Récupération des images de la page d\'accueil...');

      const images = await HomeImage.findAll({
        where: { is_active: true },
        order: [['image_type', 'ASC'], ['image_key', 'ASC']]
      });

      const imagesByType = {};
      images.forEach(img => {
        if (!imagesByType[img.image_type]) {
          imagesByType[img.image_type] = {};
        }
        imagesByType[img.image_type][img.image_key] = img.image_path;
      });

      console.log('✅ Images récupérées:', imagesByType);

      res.json({
        success: true,
        images: imagesByType
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des images:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des images'
      });
    }
  }
};

// Fonction helper pour nettoyer les anciennes images
async function cleanOldHomeImage(imageType, imageKey) {
  try {
    const oldImage = await HomeImage.findOne({
      where: { image_type: imageType, image_key: imageKey }
    });

    if (oldImage && oldImage.image_path) {
      const oldFilePath = path.join('public', oldImage.image_path);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
        console.log('🗑️ Ancienne image supprimée:', oldFilePath);
      }
    }
  } catch (error) {
    console.error('⚠️ Erreur lors de la suppression de l\'ancienne image:', error);
  }
}

// Contrôleur principal pour la page d'accueil mis à jour
export const mainControlleur= {
 homePage: async (req, res) => {
        try {
            console.log('🏠 Chargement page d\'accueil...');
            
            // Récupérer les coups de cœur
            let featuredJewels = [];
            try {
                featuredJewels = await Jewel.findAll({
                    where: {
                        is_featured: true,
                        is_active: true,
                        stock: { [Op.gt]: 0 }
                    },
                    include: [
                        {
                            model: Category,
                            as: 'category',
                            required: false
                        }
                    ],
                    order: [['featured_order', 'ASC']],
                    limit: 4
                });
                
                console.log(`✅ ${featuredJewels.length} coups de cœur chargés`);
            } catch (error) {
                console.log('⚠️ Erreur chargement coups de cœur:', error.message);
                featuredJewels = [];
            }
            
            // Récupérer les catégories avec gestion des images
            let categories = [];
            try {
                categories = await Category.findAll({
                    where: { is_active: true },
                    order: [['sort_order', 'ASC'], ['name', 'ASC']]
                });
                
                // Enrichir les catégories avec les informations d'images
                categories = categories.map(category => {
                    const categoryData = category.toJSON();
                    categoryData.imageUrl = category.image 
                        ? `/images/categories/${category.image}` 
                        : `/images/categories/default-${category.name.toLowerCase()}.jpg`;
                    categoryData.hasImage = !!category.image;
                    return categoryData;
                });
                
                console.log(`✅ ${categories.length} catégories chargées`);
            } catch (error) {
                console.log('⚠️ Erreur chargement catégories:', error.message);
                categories = [];
            }
            
            res.render('home', {
                title: 'CrystosJewel - Bijoux Précieux',
                user: req.session?.user || null,
                featuredJewels: featuredJewels,
                categories: categories,
                homeImages: {}
            });
            
        } catch (error) {
            console.error('❌ Erreur page d\'accueil:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement de la page',
                user: req.session?.user || null,
                featuredJewels: [],
                categories: [],
                homeImages: {}
            });
        }
    },

    // Page de gestion des images de catégories
    showCategoryImages: async (req, res) => {
        try {
            console.log('🖼️ Chargement page gestion images catégories...');
            
            const categories = await Category.findAll({
                where: { is_active: true },
                order: [['sort_order', 'ASC'], ['name', 'ASC']]
            });
            
            // Statistiques
            const stats = {
                total: categories.length,
                with_images: categories.filter(cat => cat.image).length,
                without_images: categories.filter(cat => !cat.image).length
            };
            
            console.log(`✅ ${categories.length} catégories trouvées`);
            
            res.render('category-images', {
                title: 'Gestion des Images de Catégories',
                categories: categories,
                stats: stats,
                user: req.session?.user || null
            });
            
        } catch (error) {
            console.error('❌ Erreur chargement page images catégories:', error);
            res.status(500).render('error', {
                title: 'Erreur',
                message: 'Erreur lors du chargement de la page: ' + error.message,
                user: req.session?.user || null
            });
        }
    },


     // Upload d'image pour une catégorie
    uploadCategoryImage: async (req, res) => {
        try {
            const { categoryId } = req.body;
            console.log('📤 Upload image catégorie:', categoryId);
            
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }
            
            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de catégorie requis'
                });
            }
            
            // Vérifier que la catégorie existe
            const category = await Category.findByPk(categoryId);
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Catégorie non trouvée'
                });
            }
            
            // Supprimer l'ancienne image si elle existe
            if (category.image) {
                const oldImagePath = path.join(process.cwd(), 'public/images/categories', category.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                    console.log('🗑️ Ancienne image supprimée');
                }
            }
            
            // Mettre à jour la catégorie avec la nouvelle image
            const newImageName = req.file.filename;
            await category.update({ image: newImageName });
            
            console.log(`✅ Image mise à jour pour catégorie ${category.name}: ${newImageName}`);
            
            res.json({
                success: true,
                message: 'Image mise à jour avec succès',
                imagePath: `/images/categories/${newImageName}`,
                categoryName: category.name
            });
            
        } catch (error) {
            console.error('❌ Erreur upload image catégorie:', error);
            
            // Nettoyer le fichier en cas d'erreur
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.status(500).json({
                success: false,
                message: 'Erreur serveur: ' + error.message
            });
        }
    },

    // Supprimer l'image d'une catégorie
    deleteCategoryImage: async (req, res) => {
        try {
            const { categoryId } = req.params;
            console.log('🗑️ Suppression image catégorie:', categoryId);
            
            const category = await Category.findByPk(categoryId);
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Catégorie non trouvée'
                });
            }
            
            if (!category.image) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucune image à supprimer'
                });
            }
            
            // Supprimer le fichier image
            const imagePath = path.join(process.cwd(), 'public/images/categories', category.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
            
            // Mettre à jour la catégorie
            await category.update({ image: null });
            
            console.log(`✅ Image supprimée pour catégorie ${category.name}`);
            
            res.json({
                success: true,
                message: 'Image supprimée avec succès'
            });
            
        } catch (error) {
            console.error('❌ Erreur suppression image catégorie:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur: ' + error.message
            });
        }
    },

    // API pour récupérer les catégories
    getCategories: async (req, res) => {
        try {
            const categories = await Category.findAll({
                where: { is_active: true },
                order: [['sort_order', 'ASC'], ['name', 'ASC']]
            });
            
            const categoriesWithImages = categories.map(category => {
                const categoryData = category.toJSON();
                categoryData.imageUrl = category.image 
                    ? `/images/categories/${category.image}` 
                    : `/images/categories/default-${category.name.toLowerCase()}.jpg`;
                categoryData.hasImage = !!category.image;
                return categoryData;
            });
            
            res.json({
                success: true,
                categories: categoriesWithImages
            });
            
        } catch (error) {
            console.error('❌ Erreur API catégories:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Réorganiser l'ordre des catégories
    reorderCategories: async (req, res) => {
        try {
            const { categoryOrders } = req.body;
            
            if (!Array.isArray(categoryOrders)) {
                return res.status(400).json({
                    success: false,
                    message: 'Format de données invalide'
                });
            }
            
            // Mettre à jour l'ordre de chaque catégorie
            const updatePromises = categoryOrders.map(({ id, sort_order }) => 
                Category.update({ sort_order }, { where: { id } })
            );
            
            await Promise.all(updatePromises);
            console.log('✅ Ordre des catégories mis à jour');
            
            res.json({
                success: true,
                message: 'Ordre des catégories mis à jour'
            });
            
        } catch (error) {
            console.error('❌ Erreur réorganisation catégories:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Nettoyer les images orphelines
    cleanupOrphanedImages: async (req, res) => {
        try {
            const categoriesPath = path.join(process.cwd(), 'public/images/categories');
            
            if (!fs.existsSync(categoriesPath)) {
                return res.json({
                    success: true,
                    message: 'Dossier des images n\'existe pas',
                    cleaned: 0
                });
            }

            // Récupérer toutes les images utilisées
            const categories = await Category.findAll({
                attributes: ['image'],
                where: { image: { [Op.not]: null } }
            });
            
            const usedImages = new Set(categories.map(cat => cat.image));
            
            // Lister tous les fichiers dans le dossier
            const allFiles = fs.readdirSync(categoriesPath);
            const imageFiles = allFiles.filter(file => 
                /\.(jpg|jpeg|png|gif|webp)$/i.test(file) && 
                !file.startsWith('default-')
            );
            
            // Supprimer les images orphelines
            let cleanedCount = 0;
            for (const file of imageFiles) {
                if (!usedImages.has(file)) {
                    const filePath = path.join(categoriesPath, file);
                    try {
                        fs.unlinkSync(filePath);
                        cleanedCount++;
                        console.log(`🗑️ Image orpheline supprimée: ${file}`);
                    } catch (err) {
                        console.error(`❌ Erreur suppression ${file}:`, err);
                    }
                }
            }
            
            console.log(`🧹 ${cleanedCount} images orphelines supprimées`);
            
            res.json({
                success: true,
                message: `${cleanedCount} images orphelines supprimées`,
                cleaned: cleanedCount
            });
            
        } catch (error) {
            console.error('❌ Erreur nettoyage images orphelines:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Statistiques des catégories
    getCategoryStats: async (req, res) => {
        try {
            const allCategories = await Category.findAll();
            const activeCategories = allCategories.filter(cat => cat.is_active);
            const withImages = allCategories.filter(cat => cat.image);
            
            const stats = {
                total: allCategories.length,
                active: activeCategories.length,
                inactive: allCategories.length - activeCategories.length,
                with_images: withImages.length,
                without_images: allCategories.length - withImages.length
            };
            
            res.json({
                success: true,
                stats: stats
            });
            
        } catch (error) {
            console.error('❌ Erreur récupération statistiques:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Fonction utilitaire pour créer le dossier d'images si nécessaire
    ensureCategoryImagesDir: () => {
        const categoryImagesPath = path.join(process.cwd(), 'public/images/categories');
        if (!fs.existsSync(categoryImagesPath)) {
            fs.mkdirSync(categoryImagesPath, { recursive: true });
            console.log('📁 Dossier images catégories créé:', categoryImagesPath);
        }
    },
};