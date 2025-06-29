// controlleurs/uploadController.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const uploadController = {
  handleHomeImageUpload: (req, res) => {
    try {
      console.log('=== UPLOAD REQUEST DEBUG ===');
      console.log('📁 Body:', req.body);
      console.log('📄 File:', req.file);
      
      // IMPORTANT: Déclarer les variables AVANT de les utiliser
      const { imageType, imageId } = req.body;
      
      // Vérifier si un fichier a été uploadé
      if (!req.file) {
        console.log('❌ Aucun fichier reçu');
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun fichier uploadé' 
        });
      }
      
      // Vérifier les paramètres requis
      if (!imageType || !imageId) {
        console.log('❌ Paramètres manquants:', { imageType, imageId });
        return res.status(400).json({ 
          success: false, 
          message: 'Paramètres manquants: imageType et imageId requis' 
        });
      }

      console.log(`📝 Type: ${imageType}, ID: ${imageId}`);
      console.log(`📁 Fichier temporaire: ${req.file.filename}`);
      console.log(`📍 Chemin temporaire: ${req.file.path}`);
      
      // Déterminer le dossier de destination final
      let finalDir;
      if (imageType === 'category') {
        finalDir = path.join(__dirname, '../../public/images/categories');
      } else if (imageType === 'featured') {
        finalDir = path.join(__dirname, '../../public/uploads/home');
      } else {
        finalDir = path.join(__dirname, '../../public/uploads/home');
      }
      
      // Créer le dossier final s'il n'existe pas
      if (!fs.existsSync(finalDir)) {
        console.log(`📁 Création du dossier final:`, finalDir);
        fs.mkdirSync(finalDir, { recursive: true });
      }
      
      // Générer le nom de fichier final
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(req.file.originalname);
      const finalFilename = `${imageType}-${imageId}-${uniqueSuffix}${extension}`;
      const finalPath = path.join(finalDir, finalFilename);
      
      console.log(`📁 Nom final: ${finalFilename}`);
      console.log(`📍 Chemin final: ${finalPath}`);
      
      // Déplacer le fichier du dossier temporaire vers le dossier final
      fs.renameSync(req.file.path, finalPath);
      console.log(`✅ Fichier déplacé avec succès`);
      
      // Construire le chemin WEB
      let imagePath;
      if (imageType === 'category') {
        imagePath = `/images/categories/${finalFilename}`;
      } else if (imageType === 'featured') {
        imagePath = `/uploads/home/${finalFilename}`;
      } else {
        imagePath = `/uploads/home/${finalFilename}`;
      }
      
      console.log(`🌐 Chemin web: ${imagePath}`);
      
      // Vérifier que le fichier final existe
      if (!fs.existsSync(finalPath)) {
        console.log('❌ Fichier final non trouvé:', finalPath);
        return res.status(500).json({ 
          success: false, 
          message: 'Erreur lors du déplacement du fichier' 
        });
      }
      
      console.log(`✅ Upload terminé avec succès !`);
      
      // Réponse JSON
      const response = {
        success: true, 
        imagePath: imagePath,
        imageType: imageType,
        imageId: imageId,
        filename: finalFilename,
        physicalPath: finalPath,
        timestamp: Date.now(),
        message: `Image ${imageType}-${imageId} uploadée avec succès`
      };
      
      console.log('📤 Réponse envoyée:', response);
      res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ Erreur dans uploadController:', error);
      
      // Nettoyer le fichier temporaire en cas d'erreur
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('🗑️ Fichier temporaire supprimé');
        } catch (cleanupError) {
          console.error('❌ Erreur lors du nettoyage:', cleanupError);
        }
      }
      
      // S'assurer de renvoyer du JSON même en cas d'erreur
      res.status(500).json({ 
        success: false, 
        message: `Erreur serveur: ${error.message}`
      });
    }
  }
};

export default uploadController;