// config/upload.js - Configuration Multer simple
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuration pour les images de catégories
const categoryImageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(process.cwd(), 'public/images/categories');
        
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Générer un nom unique pour éviter les conflits
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, extension)
            .replace(/[^a-zA-Z0-9]/g, '-')
            .toLowerCase();
        
        cb(null, `category-${baseName}-${uniqueSuffix}${extension}`);
    }
});

// Filtre pour les types de fichiers autorisés
const imageFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non autorisé. Seuls les formats JPEG, PNG, GIF et WebP sont acceptés.'), false);
    }
};

// Configuration pour les images de catégories
export const uploadCategoryImage = multer({
    storage: categoryImageStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1 // Un seul fichier à la fois
    }
});

// Fonction utilitaire pour supprimer un fichier
export const deleteFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Fichier supprimé: ${filePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Erreur suppression fichier:', error);
        return false;
    }
};