
import { Category } from '../models/categoryModel.js';
import path from 'path';
import fs from 'fs';

export const categoryController = {
    
    // Page de gestion des images de catégories
    showCategoryImages: async (req, res) => {
        try {
            console.log('🖼️ Chargement page gestion images catégories...');
            
            const categories = await Category.findAll({
                where: { is_active: true },
                order: [['name', 'ASC']]
            });
            
            // Enrichir avec les informations d'images
            const categoriesWithImages = categories.map(category => {
                const categoryData = category.toJSON();
                categoryData.imageUrl = category.image 
                    ? `/images/categories/${category.image}` 
                    : null;
                categoryData.hasImage = !!category.image;
                return categoryData;
            });
            
            const stats = {
                total: categories.length,
                with_images: categories.filter(cat => cat.image).length,
                without_images: categories.filter(cat => !cat.image).length
            };
            
            console.log(`✅ ${categories.length} catégories trouvées`);
            
            res.render('category-images', {
                title: 'Gestion des Images de Catégories',
                categories: categoriesWithImages,
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
            console.log('📁 Fichier reçu:', req.file);
            
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }
            
            if (!categoryId) {
                // Supprimer le fichier si pas de categoryId
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(400).json({
                    success: false,
                    message: 'ID de catégorie requis'
                });
            }
            
            // Vérifier que la catégorie existe
            const category = await Category.findByPk(categoryId);
            if (!category) {
                // Supprimer le fichier si catégorie inexistante
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
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
                    console.log('🗑️ Ancienne image supprimée:', oldImagePath);
                }
            }
            
            // Mettre à jour la catégorie avec la nouvelle image
            const newImageName = req.file.filename;
            await category.update({ image: newImageName });
            
            const imageUrl = `/images/categories/${newImageName}`;
            
            console.log(`✅ Image mise à jour pour catégorie ${category.name}: ${newImageName}`);
            console.log(`🔗 URL image: ${imageUrl}`);
            
            res.json({
                success: true,
                message: 'Image mise à jour avec succès',
                imagePath: imageUrl,
                imageFilename: newImageName,
                categoryName: category.name,
                categoryId: category.id
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
                console.log('🗑️ Fichier image supprimé:', imagePath);
            }
            
            // Mettre à jour la catégorie
            await category.update({ image: null });
            
            console.log(`✅ Image supprimée pour catégorie ${category.name}`);
            
            res.json({
                success: true,
                message: 'Image supprimée avec succès',
                categoryName: category.name
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
                order: [['name', 'ASC']]
            });
            
            const categoriesWithImages = categories.map(category => {
                const categoryData = category.toJSON();
                categoryData.imageUrl = category.image 
                    ? `/images/categories/${category.image}` 
                    : null;
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
    }
};