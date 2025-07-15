// REMPLACEZ le début de votre router.js par ceci (jusqu'à "ROUTES PRINCIPALES")

import { Router } from "express";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from "multer";
import { Jewel } from "./models/jewelModel.js";
import { Category } from "./models/categoryModel.js";
import { Material } from "./models/MaterialModel.js";
import express from "express";

import { sequelize } from "./models/sequelize-client.js";
import { Cart } from "./models/cartModel.js";
import { Type } from "./models/TypeModel.js";
import { JewelImage } from "./models/jewelImage.js";

// Imports des contrôleurs EXISTANTS
import { emailManagementController } from './controlleurs/emailManagementController.js';

import { mainControlleur } from "./controlleurs/mainControlleur.js";
import{ customerManagementController}from "./controlleurs/customerManagementController.js";
import { Op } from 'sequelize';
import { baguesControlleur } from "./controlleurs/baguesControlleur.js";
import { braceletsControlleur } from "./controlleurs/braceletsControlleur.js";
import { featuredController } from "./controlleurs/featuredController.js";
import { uploadController } from "./controlleurs/uploadController.js";
import { jewelControlleur } from "./controlleurs/jewelControlleur.js";
import { materialControlleur } from './controlleurs/materialControlleur.js';
import { loginLimiter, authController } from "./controlleurs/authControlleur.js";
import { cartController } from "./controlleurs/cartControlleur.js";
import { promoController } from "./controlleurs/promocontroller.js";
import { favoritesController } from "./controlleurs/favoritesControlleur.js";
import { adminStatsController } from "./controlleurs/adminStatsControlleur.js";
import { orderController } from "./controlleurs/orderController.js";
import { adminOrdersController } from "./controlleurs/adminOrdersController.js";
import { SettingsController } from './controlleurs/SettingsController.js';
import { jewelryController } from "./controlleurs/jewelryController.js";
import { categoryController } from './controlleurs/categoryController.js';
import  { sendTestMail } from "./services/mailService.js";
import { promoAdminController } from "./controlleurs/promoAdminController.js";

import { guestOrderController } from './controlleurs/guestOrderController.js';

import { 
  guestOrderMiddleware, 
  cartNotEmptyMiddleware, 
  validateGuestOrderMiddleware 
} from './middleware/guestOrderMiddleware.js';
// import { uploadCategoryImage } from '../../index.js'; // Import depuis votre app.js
import { PromoCode } from "./models/Promocode.js";

// Middlewares
import { isAdmin, isAuthenticated } from './middleware/authMiddleware.js';

const storageHome = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/home');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const uploadHome = multer({ storage: storageHome });


// Configuration du stockage des images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/jewels'); // adapte le chemin si nécessaire
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = file.originalname.split(ext)[0].replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${name}${ext}`);
  }
});

const upload = multer({ storage });



// Configuration multer pour les images de catégories
const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './public/images/categories';
    
    // Vérifier que le dossier existe
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log(`📁 Dossier créé: ${uploadPath}`);
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Nettoyer le nom du fichier
    const ext = path.extname(file.originalname).toLowerCase();
    const categoryId = req.body.categoryId || 'unknown';
    const timestamp = Date.now();
    const randomId = Math.round(Math.random() * 1E9);
    
    // Nom de fichier plus simple et prévisible
    const filename = `category-${categoryId}-${timestamp}${ext}`;
    
    // console.log(`📝 Génération nom fichier: ${filename}`);
    cb(null, filename);
  }
});

const uploadCategoryImage = multer({ 
  storage: categoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // console.log(`🔍 Vérification fichier: ${file.originalname}, type: ${file.mimetype}`);
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.error(`❌ Type de fichier non autorisé: ${file.mimetype}`);
      cb(new Error('Type de fichier non autorisé. Utilisez JPG, PNG, GIF ou WebP.'), false);
    }
  }
});

// 🔧 SOLUTION DÉFINITIVE - Ajoutez ceci dans votre router.js

// 1. CRÉER une nouvelle configuration multer spécifique pour updateJewel
const updateJewelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/uploads/jewels';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomId = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `jewel-${timestamp}-${randomId}${ext}`);
  }
});

// 2. Configuration multer AVEC gestion d'erreur robuste
const updateJewelUpload = multer({
  storage: updateJewelStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB
    fieldSize: 5 * 1024 * 1024,   // 5MB pour les champs texte
    fields: 200,                  // Beaucoup de champs autorisés
    files: 20                     // Maximum 20 fichiers
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type ${file.mimetype} non autorisé`), false);
    }
  }
});

// Middleware pour le traitement d'images avec rognage
const uploadImages = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
      
      // Créer le dossier s'il n'existe pas
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('📁 Dossier temp créé:', uploadDir);
      }
      
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = 'temp-' + uniqueSuffix + path.extname(file.originalname);
      console.log('📝 Nom de fichier généré:', filename);
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    console.log('🔍 Vérification fichier:', file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Configuration multer pour les images croppées (en mémoire)
const uploadCropped = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

function finalParseJewelForm(req, res, next) {
  console.log('🔧 === PARSING FINAL JEWEL FORM ===');
  console.log('📋 Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  
  // Utiliser .any() pour capturer TOUS les champs et fichiers
  const uploadHandler = updateJewelUpload.any();
  
  uploadHandler(req, res, (err) => {
    if (err) {
      console.error('❌ Erreur multer:', err.message);
      req.session.flash = {
        type: 'error',
        message: `Erreur upload: ${err.message}`
      };
      return res.redirect(`/admin/bijoux/${req.params.slug}/edit`);
    }
    
    console.log('✅ Multer traité avec succès');
    
    // IMPORTANT: Avec .any(), les fichiers sont dans req.files (array)
    // et les champs texte dans req.body
    console.log('📋 req.body status:', {
      exists: !!req.body,
      type: typeof req.body,
      keys: req.body ? Object.keys(req.body) : 'VIDE',
      keysCount: req.body ? Object.keys(req.body).length : 0
    });
    
    console.log('📁 req.files status:', {
      exists: !!req.files,
      isArray: Array.isArray(req.files),
      count: req.files ? req.files.length : 0
    });
    
    // DEBUG des champs critiques
    if (req.body) {
      console.log('📝 Champs critiques:');
      console.log('   name:', req.body.name || 'MANQUANT');
      console.log('   category_id:', req.body.category_id || 'MANQUANT');
      console.log('   price_ttc:', req.body.price_ttc || 'MANQUANT');
      console.log('   matiere:', req.body.matiere || 'MANQUANT');
    }
    
    // Vérification finale
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ ERREUR CRITIQUE: req.body toujours vide');
      console.error('🔍 Diagnostic complet:', {
        headers: req.headers,
        method: req.method,
        url: req.url,
        hasFiles: !!req.files,
        filesCount: req.files ? req.files.length : 0
      });
      
      req.session.flash = {
        type: 'error',
        message: 'ERREUR TECHNIQUE: Impossible de récupérer les données du formulaire. Contactez l\'administrateur.'
      };
      return res.redirect(`/admin/bijoux/${req.params.slug}/edit`);
    }
    
    // Réorganiser les fichiers par nom de champ pour plus de facilité
    if (req.files && Array.isArray(req.files)) {
      req.filesByField = {};
      req.files.forEach(file => {
        if (!req.filesByField[file.fieldname]) {
          req.filesByField[file.fieldname] = [];
        }
        req.filesByField[file.fieldname].push(file);
      });
      
      console.log('📁 Fichiers organisés:', Object.keys(req.filesByField));
    }
    
    console.log('🔧 === FIN PARSING FORMULAIRE ===');
    next();
  });
}

// 2. MIDDLEWARE personnalisé pour parser le formulaire
function parseJewelForm(req, res, next) {
  console.log('🔍 === DÉBUT PARSING FORMULAIRE SIMPLIFIÉ ===');
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📋 Method:', req.method);
  console.log('📋 URL:', req.url);
  
  // ✅ UTILISER la configuration upload EXISTANTE (pas updateJewelUpload)
  const simpleUpload = upload.fields([
    { name: 'newMainImage', maxCount: 1 },
    { name: 'newImages', maxCount: 10 }
  ]);
  
  simpleUpload(req, res, (err) => {
    if (err) {
      console.error('❌ Erreur multer:', err.message);
      req.session.flash = {
        type: 'error',
        message: `Erreur upload: ${err.message}`
      };
      return res.redirect(`/admin/bijoux/${req.params.slug}/edit`);
    }
    
    console.log('✅ Multer terminé');
    console.log('📋 req.body après multer:', {
      exists: !!req.body,
      type: typeof req.body,
      keys: req.body ? Object.keys(req.body) : 'N/A',
      keysCount: req.body ? Object.keys(req.body).length : 0
    });
    
    // 🔍 AFFICHER quelques champs pour debug
    if (req.body) {
      console.log('📝 Échantillon req.body:');
      console.log('   name:', req.body.name || 'VIDE');
      console.log('   category_id:', req.body.category_id || 'VIDE');
      console.log('   price_ttc:', req.body.price_ttc || 'VIDE');
      console.log('   matiere:', req.body.matiere || 'VIDE');
    }
    
    console.log('📁 req.files:', req.files ? Object.keys(req.files) : 'Aucun fichier');
    
    // ⚠️ Si le body est toujours vide, c'est un problème de configuration
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ ERREUR CRITIQUE: req.body vide après multer');
      console.error('🔍 Headers complets:', JSON.stringify(req.headers, null, 2));
      
      req.session.flash = {
        type: 'error',
        message: 'Erreur technique: impossible de recevoir les données du formulaire'
      };
      return res.redirect(`/admin/bijoux/${req.params.slug}/edit`);
    }
    
    console.log('🔍 === FIN PARSING FORMULAIRE ===');
    next();
  });
}





const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const router = Router();

// ==========================================
// ROUTES PUBLIQUES EN PREMIER (SANS MIDDLEWARE)
// ==========================================

// Route placeholder - DOIT ÊTRE EN PREMIER
router.get('/api/placeholder/:width/:height', (req, res) => {
    const { width, height } = req.params;
    console.log(`🖼️ Placeholder demandé: ${width}x${height}`);
    
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" dy=".3em">
            ${width}x${height}
        </text>
    </svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
});

// Route de test général (sans authentification)
router.get('/api/test', (req, res) => {
    // console.log('🧪 Route de test général atteinte');
    res.json({ 
        success: true, 
        message: 'API fonctionne !',
        timestamp: new Date().toISOString(),
        user: req.session?.user?.role?.name || 'non connecté'
    });
});



// ==========================================
// ROUTES PRINCIPALES (INCHANGÉES)
// ==========================================

router.get("/", mainControlleur.homePage);

// ==========================================
// ROUTES ADMIN COMMANDES (INCHANGÉES)
// ==========================================



// 🛒 Fonction helper pour calculer les totaux avec promo
function calculateOrderTotals(cartItems, appliedPromo = null) {
    if (!Array.isArray(cartItems)) {
        cartItems = [];
    }
    
    const subtotal = cartItems.reduce((total, item) => {
        if (!item.jewel) return total;
        const price = parseFloat(item.jewel.price_ttc) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return total + (price * quantity);
    }, 0);

    let discount = 0;
    let discountedSubtotal = subtotal;

    if (appliedPromo && appliedPromo.discountPercent) {
        const discountPercent = parseFloat(appliedPromo.discountPercent);
        discount = (subtotal * discountPercent) / 100;
        discountedSubtotal = subtotal - discount;
    }

    const deliveryFee = discountedSubtotal >= 50 ? 0 : 5.99;
    const finalTotal = discountedSubtotal + deliveryFee;

    return {
        subtotal,
        discount,
        discountedSubtotal,
        deliveryFee,
        finalTotal,
        appliedPromo
    };
}


router.get('/commande', guestOrderMiddleware, async (req, res) => {
    try {
        console.log('📋 Accès page commande');
        
        // Obtenir le panier selon le type d'utilisateur
        const cartSource = await cartController.getCartSource(req);
        let cartItems = [];

        if (cartSource.type === 'database') {
            // Utilisateur connecté
            const dbCartItems = await Cart.findAll({
                where: { customer_id: cartSource.userId },
                include: [{ 
                    model: Jewel, 
                    as: 'jewel',
                    required: true,
                    attributes: ['id', 'name', 'price_ttc', 'image', 'slug', 'stock']
                }]
            });

            cartItems = dbCartItems.map(item => ({
                jewel: item.jewel,
                quantity: item.quantity
            }));
        } else {
            // Invité - session
            const sessionCart = req.session.cart || { items: [] };
            
            for (const item of sessionCart.items) {
                if (item.jewel && item.jewel.id) {
                    const currentJewel = await Jewel.findByPk(item.jewel.id);
                    if (currentJewel) {
                        cartItems.push({
                            jewel: currentJewel,
                            quantity: Math.min(item.quantity, currentJewel.stock)
                        });
                    }
                }
            }
        }

        if (cartItems.length === 0) {
            return res.render('commande', { 
                cartItems: [], 
                subtotal: 0,
                discount: 0,
                discountedSubtotal: 0,
                deliveryFee: 5.99,
                finalTotal: 5.99,
                appliedPromo: null,
                message: 'Votre panier est vide',
                user: req.session.user || null
            });
        }

        // Récupérer le code promo de la session
        const appliedPromo = req.session.appliedPromo || null;
        
        console.log('🔍 Code promo en session:', appliedPromo);
        console.log('🛒 Panier:', cartItems.length, 'articles');
        
        // Calculer les totaux avec le code promo
        const totals = calculateOrderTotals(cartItems, appliedPromo);
        
        // Renvoyer toutes les données nécessaires au template
        res.render('commande', {
            cartItems,
            subtotal: totals.subtotal,
            discount: totals.discount,
            discountedSubtotal: totals.discountedSubtotal,
            deliveryFee: totals.deliveryFee,
            finalTotal: totals.finalTotal,
            appliedPromo: totals.appliedPromo,
            user: req.session.user || null,
            isGuest: cartSource.type === 'session'
        });

    } catch (error) {
        console.error('❌ Erreur page commande:', error);
        res.status(500).render('commande', { 
            cartItems: [], 
            subtotal: 0,
            discount: 0,
            discountedSubtotal: 0,
            deliveryFee: 5.99,
            finalTotal: 5.99,
            appliedPromo: null,
            message: 'Erreur lors du chargement de la commande',
            user: req.session.user || null,
            error: true
        });
    }
});

// ✅ ROUTES PRINCIPALES (correspondant aux appels JavaScript)

router.get('/admin/commandes/:id/details', isAdmin, adminOrdersController.getOrderDetails);
router.put('/admin/commandes/:id', isAdmin, adminOrdersController.updateOrder);
router.get('/admin/commandes/export', isAdmin, adminOrdersController.exportOrders);

// ✅ ROUTES ADDITIONNELLES (fonctionnalités avancées)
router.put('/admin/commandes/:id/status', isAdmin, adminOrdersController.updateOrderStatus);
router.post('/admin/commandes/:id/tracking', isAdmin, adminOrdersController.addTrackingEvent);
router.put('/admin/commandes/:id/edit', isAdmin, adminOrdersController.saveOrderModifications);
router.get('/admin/suivi-commandes', isAdmin, adminOrdersController.showDashboard);

// ==========================================
// ROUTES COUPS DE CŒUR (INCHANGÉES)
// ==========================================

router.get('/admin/coups-de-coeur', isAdmin, featuredController.showFeaturedManagement);
router.post('/admin/coups-de-coeur/ajouter', isAdmin, featuredController.addToFeatured);
router.post('/admin/coups-de-coeur/retirer', isAdmin, featuredController.removeFromFeatured);

// ==========================================
// ROUTES UPLOAD IMAGES (INCHANGÉES)
// ==========================================

router.post('/admin/upload-home-image', 
  isAdmin, 
  uploadHome.single('image'), 
  uploadController.handleHomeImageUpload
);

router.post('/admin/telecharger-image-accueil', 
  isAdmin, 
  uploadHome.single('image'), 
  uploadController.handleHomeImageUpload
);

// ==========================================
// ROUTES BIJOUX (INCHANGÉES)
// ==========================================

router.get('/admin/bijoux/ajouter', isAdmin, jewelControlleur.showAddJewelForm);
router.get("/ajouter-bijou", isAdmin, jewelControlleur.showAddJewelForm);
router.post("/ajouter-bijou", isAdmin, upload.array('images', 5), jewelControlleur.addJewel);

router.post('/admin/categories/add', isAdmin, jewelControlleur.addCategory);
router.post('/admin/types/add', isAdmin, jewelControlleur.addType);  
router.post('/admin/materials/add', isAdmin, jewelControlleur.addMaterial);

router.get('/bijoux/colliers', jewelControlleur.showNecklaces);
router.get('/bijoux/bracelets', braceletsControlleur.showBracelets);
router.get('/bijoux/bagues', baguesControlleur.showRings);
router.get('/bijoux/:slug', async (req, res, next) => {
    try {
        // SEULEMENT afficher la page, AUCUN tracking automatique
        await jewelControlleur.showJewelDetails(req, res, next);
    } catch (error) {
        next(error);
    }
});



router.post('/bijoux/:slug/supprimer', isAdmin, jewelControlleur.deleteJewel);
router.get('/admin/bijoux/:slug/edit', isAdmin, jewelControlleur.editJewel);
// Route pour récupérer les détails d'un bijou
router.get('/admin/api/jewel/:id', adminStatsController.getJewelDetails);
// Ajoutez cette route API pour le tracking côté client
router.post('/api/bijoux/:id/track-vue-unique', async (req, res) => {
    try {
        const { id } = req.params;
        const userAgent = req.get('User-Agent') || '';
        const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
        const sessionId = req.sessionID || 'anonymous';
        const { timeOnPage = 0 } = req.body;
        
        console.log(`🔍 Tentative tracking: Bijou ${id}, IP: ${userIP}, Session: ${sessionId}, Temps: ${timeOnPage}s`);
        
        // Éviter les bots
        if (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider')) {
            // console.log('🤖 Bot détecté, vue ignorée');
            return res.json({ success: true, message: 'Bot ignoré', views: 0 });
        }
        
        // Vérifier temps minimum (3 secondes)
        if (timeOnPage < 3) {
            console.log(`⏱️ Temps insuffisant: ${timeOnPage}s`);
            return res.json({ success: true, message: 'Temps insuffisant', views: 0 });
        }
        
        // Vérifier que le bijou existe
        const jewel = await Jewel.findByPk(id);
        if (!jewel) {
            console.log(`❌ Bijou ${id} non trouvé`);
            return res.status(404).json({ success: false, message: 'Bijou non trouvé' });
        }
        
        // VÉRIFICATION ANTI-DOUBLON EN BASE DE DONNÉES
        const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
        
        // Vérifier si une vue existe déjà pour ce bijou/IP/session aujourd'hui
        const existingView = await sequelize.query(`
            SELECT id, created_at 
            FROM jewel_views_log 
            WHERE jewel_id = :jewelId 
            AND user_ip = :userIP 
            AND session_id = :sessionId 
            AND date_only = :today
            LIMIT 1
        `, {
            replacements: { 
                jewelId: id, 
                userIP, 
                sessionId, 
                today 
            },
            type: sequelize.QueryTypes.SELECT
        });
        
        if (existingView.length > 0) {
            console.log(`🚫 Vue déjà comptée aujourd'hui pour bijou ${id}`);
            return res.json({ 
                success: true, 
                message: 'Vue déjà comptée aujourd\'hui',
                views: jewel.views_count || 0,
                alreadyCounted: true
            });
        }
        
        // ENREGISTRER LA NOUVELLE VUE (avec gestion d'erreur de contrainte unique)
        try {
            await sequelize.query(`
                INSERT INTO jewel_views_log (jewel_id, user_ip, session_id, user_agent, time_on_page, date_only)
                VALUES (:jewelId, :userIP, :sessionId, :userAgent, :timeOnPage, :today)
            `, {
                replacements: {
                    jewelId: id,
                    userIP,
                    sessionId,
                    userAgent,
                    timeOnPage: Math.round(timeOnPage),
                    today
                }
            });
            
            console.log(`✅ Vue enregistrée en base pour bijou ${id}`);
            
        } catch (dbError) {
            // Si erreur de contrainte unique (doublon), c'est normal
            if (dbError.message.includes('unique') || dbError.message.includes('duplicate')) {
                console.log(`🚫 Doublon détecté via contrainte DB pour bijou ${id}`);
                return res.json({ 
                    success: true, 
                    message: 'Vue déjà comptée (doublon DB)',
                    views: jewel.views_count || 0,
                    alreadyCounted: true
                });
            }
            throw dbError; // Autre erreur, on la propage
        }
        
        // INCRÉMENTER LE COMPTEUR DU BIJOU
        await jewel.increment('views_count');
        const updatedJewel = await jewel.reload();
        
        console.log(`🎯 VUE UNIQUE COMPTÉE: ${jewel.name} - Total: ${updatedJewel.views_count} vues`);
        
        res.json({ 
            success: true, 
            views: updatedJewel.views_count,
            message: 'Vue comptée avec succès',
            timeOnPage: Math.round(timeOnPage)
        });
        
    } catch (error) {
        console.error('❌ Erreur tracking vue unique:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur',
            error: error.message 
        });
    }
});

router.post('/api/track-admin-view', (req, res) => {
  res.json({ success: true });
});


// ==========================================
// ROUTES AUTHENTIFICATION (INCHANGÉES)
// ==========================================

router.get('/connexion-inscription', authController.LoginPage);
router.post('/connexion', loginLimiter, authController.login);
router.get('/deconnexion', authController.logout);
router.post('/inscription', authController.signUp);

router.get('/mot-de-passe-oublie', authController.forgotPasswordPage);
router.post('/mot-de-passe-oublie', authController.processForgotPassword);

router.get('/profil', isAuthenticated, authController.renderCustomerProfile);
router.get('/profil/modifier', isAuthenticated, authController.renderEditProfilePage);
router.post('/profil/modifier', isAuthenticated, authController.updateUserProfile);

router.get('/profil/supprimer', isAuthenticated, authController.showDeleteConfirmation);
router.post('/profil/supprimer', isAuthenticated, authController.deleteAccount);

// ==========================================
// ROUTES PANIER (INCHANGÉES)
// ==========================================

router.get('/panier', cartController.renderCart);
router.post('/panier/ajouter', async (req, res, next) => {
    try {
        // Tracking automatique de l'ajout panier
        const { jewelId, quantity = 1 } = req.body;
        if (jewelId) {
            try {
                const jewel = await Jewel.findByPk(jewelId);
                if (jewel) {
                    const currentAdditions = jewel.cart_additions || 0;
                    await jewel.update({ cart_additions: currentAdditions + parseInt(quantity) });
                    console.log(`🛒 Ajout panier tracké: ${jewel.name} - Total: ${currentAdditions + parseInt(quantity)}`);
                }
            } catch (trackError) {
                console.log('Erreur tracking panier:', trackError.message);
            }
        }
        
        // Continuer avec votre contrôleur existant
return  cartController.addToCart(req, res, next);
    } catch (error) {
        next(error);
    }
});
router.post('/panier/modifier', cartController.updateCartItem);
router.post('/panier/vider', cartController.clearCart);

router.delete('/panier/supprimer/:jewelId', cartController.removeFromCart);
router.post('/panier/supprimer/:jewelId', cartController.removeFromCart);

router.get('/api/cart/count', cartController.getCartCount);


// Routes pour les commandes
router.get('/commandes', adminOrdersController.getAllOrders);
router.get('/commandes/:id/details', adminOrdersController.getOrderDetails);
router.put('/commandes/:id', adminOrdersController.updateOrder);
/**
 * 🎫 Appliquer un code promo
 */
router.post('/appliquer-code-promo', async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code || typeof code !== 'string') {
            return res.json({ 
                success: false, 
                message: 'Code promo invalide' 
            });
        }

        // 🔍 DIAGNOSTIC: Vérifier le type de req.session.cart
        console.log('🔍 Type de req.session.cart:', typeof req.session.cart);
        console.log('🔍 Contenu de req.session.cart:', req.session.cart);

        // ✅ CORRECTION: S'assurer que cartItems est toujours un tableau
        let cartItems;
        
        if (!req.session.cart) {
            cartItems = [];
        } else if (Array.isArray(req.session.cart)) {
            cartItems = req.session.cart;
        } else if (typeof req.session.cart === 'object') {
            cartItems = Object.values(req.session.cart);
        } else {
            console.warn('⚠️ Format inattendu pour req.session.cart:', req.session.cart);
            cartItems = [];
        }
        
        if (cartItems.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Votre panier est vide' 
            });
        }

        // Calculer le sous-total actuel
        let subtotal = 0;
        cartItems.forEach((item, index) => {
            if (!item || !item.jewel) {
                console.warn(`⚠️ Item ${index} invalide:`, item);
                return;
            }
            
            const price = parseFloat(item.jewel.price_ttc) || 0;
            const quantity = parseInt(item.quantity) || 0;
            subtotal += price * quantity;
        });

        console.log(`📊 Sous-total pour code promo: ${subtotal}€`);

        // Vérifier si un code promo est déjà appliqué
        if (req.session.appliedPromo) {
            return res.json({ 
                success: false, 
                message: 'Un code promo est déjà appliqué. Retirez-le d\'abord.' 
            });
        }

        // 🔄 NOUVEAU: Récupérer le code depuis la base de données UNIQUEMENT
        const promoCode = await PromoCode.findOne({
            where: { 
                code: code.toUpperCase(),
                is_active: true
            }
        });

        if (!promoCode) {
            return res.json({ 
                success: false, 
                message: 'Code promo non valide ou expiré' 
            });
        }

        // Vérifier si le code a expiré
        const now = new Date();
        if (promoCode.expires_at && promoCode.expires_at < now) {
            return res.json({ 
                success: false, 
                message: 'Ce code promo a expiré' 
            });
        }

        // Vérifier si le code a atteint sa limite d'utilisation
        if (promoCode.used_count >= promoCode.usage_limit) {
            return res.json({ 
                success: false, 
                message: 'Ce code promo a atteint sa limite d\'utilisation' 
            });
        }

        // Vérifier le montant minimum SEULEMENT s'il est défini dans la DB
        const minAmount = parseFloat(promoCode.min_order_amount) || 0;
        console.log(`🔍 Montant minimum requis: ${minAmount}€, Sous-total: ${subtotal}€`);
        
        if (minAmount > 0 && subtotal < minAmount) {
            return res.json({ 
                success: false, 
                message: `Montant minimum de ${minAmount}€ requis pour ce code` 
            });
        }

        // ⚡ CALCULER LA RÉDUCTION selon le type de discount
        let discount = 0;
        
        if (promoCode.discount_type === 'percentage') {
            const discountPercent = parseFloat(promoCode.discount_value);
            discount = Math.round((subtotal * discountPercent / 100) * 100) / 100;
        } else if (promoCode.discount_type === 'fixed') {
            discount = Math.min(parseFloat(promoCode.discount_value), subtotal);
        }

        console.log(`💰 Code ${code.toUpperCase()}: ${promoCode.discount_value}% de ${subtotal}€ = -${discount}€`);

        // ⚡ SAUVEGARDER DANS LA SESSION
        req.session.appliedPromo = {
            id: promoCode.id,
            code: promoCode.code,
            discountPercent: promoCode.discount_value,
            discountAmount: discount,
            description: `Réduction de ${promoCode.discount_value}%`
        };

        console.log('✅ Code promo sauvegardé en session:', req.session.appliedPromo);

        res.json({ 
            success: true, 
            message: `Code ${code.toUpperCase()} appliqué ! Réduction de ${discount.toFixed(2)}€`,
            discount: discount,
            discountPercent: promoCode.discount_value
        });

    } catch (error) {
        console.error('❌ Erreur application code promo:', error);
        res.json({ 
            success: false, 
            message: 'Erreur lors de l\'application du code' 
        });
    }
});

/**
 * 🗑️ Retirer un code promo
 */
router.delete('/retirer-code-promo', async (req, res) => {
    try {
        if (req.session.appliedPromo) {
            delete req.session.appliedPromo;
            
            res.json({ 
                success: true, 
                message: 'Code promo retiré avec succès' 
            });
        } else {
            res.json({ 
                success: false, 
                message: 'Aucun code promo à retirer' 
            });
        }
    } catch (error) {
        console.error('❌ Erreur suppression code promo:', error);
        res.json({ 
            success: false, 
            message: 'Erreur lors de la suppression' 
        });
    }
});

/**
 * 📋 Routes admin pour gérer les codes promo
 */
router.get('/admin/promo-codes', promoController.listPromoCodes);
router.post('/admin/promo-codes', promoController.createPromoCode);

// ==========================================
// ROUTES ADMIN BIJOUX (INCHANGÉES)
// ==========================================

router.get('/admin/jewels/:slug/edit', isAdmin, jewelControlleur.showEditJewel);




router.get('/admin/bijoux/:slug/edit', isAdmin, jewelControlleur.showEditJewel);
router.post('/admin/bijoux/:slug/update', isAdmin, parseJewelForm, jewelControlleur.updateJewel);
router.post('/admin/bijoux/:slug/discount', isAdmin, jewelControlleur.updateDiscount);
// router.delete('/admin/bijoux/:slug/delete', isAdmin, jewelControlleur.deleteJewel);

router.post('/bijoux/:slug/supprimer', isAdmin, jewelControlleur.deleteJewel);
router.get('/admin/bijoux/:slug/edit', isAdmin, jewelControlleur.editJewel);


// Route pour uploader une nouvelle image
router.post('/admin/bijoux/:slug/upload-image', 
  isAdmin, 
  uploadImages.single('image'), 
  async (req, res) => {
    console.log('📸 === DÉBUT upload-image ===');
    
    try {
      const { slug } = req.params;
      const { imageType } = req.body;
      
      console.log('📋 Données reçues:', { slug, imageType, hasFile: !!req.file });
      
      if (!req.file) {
        console.log('❌ Aucun fichier reçu');
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier reçu'
        });
      }

      console.log('📁 Fichier reçu:', {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      });

      // Vérifier que le bijou existe
      const jewel = await Jewel.findOne({ where: { slug } });
      if (!jewel) {
        console.log('❌ Bijou non trouvé:', slug);
        // Nettoyer le fichier temporaire
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({
          success: false,
          message: 'Bijou non trouvé'
        });
      }

      console.log('✅ Bijou trouvé:', jewel.name);

      // Retourner les informations du fichier temporaire
      const result = {
        success: true,
        message: 'Fichier uploadé avec succès',
        tempFile: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: `/uploads/temp/${req.file.filename}`,
          size: req.file.size,
          mimetype: req.file.mimetype
        },
        imageType: imageType || 'additional',
        jewelInfo: {
          id: jewel.id,
          name: jewel.name,
          slug: jewel.slug
        }
      };

      console.log('✅ Réponse envoyée:', result);
      res.json(result);

    } catch (error) {
      console.error('❌ Erreur upload-image:', error);
      
      // Nettoyer le fichier en cas d'erreur
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'upload de l\'image',
        error: error.message
      });
    }
  }
);

// Route pour traiter l'image croppée et la sauvegarder
router.post('/admin/bijoux/:slug/crop-and-save', 
  isAdmin, 
  uploadCropped.single('croppedImage'),
  async (req, res) => {
    console.log('✂️ === DÉBUT crop-and-save ===');
    
    try {
      const { slug } = req.params;
      const { 
        tempFilename, 
        imageType = 'additional',
        setAsMain = false 
      } = req.body;

      console.log('📋 Données reçues:', {
        slug,
        tempFilename,
        imageType,
        setAsMain,
        hasFile: !!req.file
      });

      // Validation des données
      if (!tempFilename) {
        return res.status(400).json({
          success: false,
          message: 'Nom du fichier temporaire manquant'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Image croppée manquante'
        });
      }

      // Vérifier que le bijou existe
      const jewel = await Jewel.findOne({ 
        where: { slug },
        include: [{
          model: JewelImage,
          as: 'additionalImages',
          required: false
        }]
      });

      if (!jewel) {
        return res.status(404).json({
          success: false,
          message: 'Bijou non trouvé'
        });
      }

      console.log('✅ Bijou trouvé:', jewel.name);

      // Préparer le nom du fichier final
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1E9);
      const fileExtension = '.jpg'; // Force JPEG pour la cohérence
      const finalFilename = `${slug}-${imageType}-${timestamp}-${randomId}${fileExtension}`;
      
      // Dossiers
      const finalDir = path.join(process.cwd(), 'public', 'uploads', 'jewels');
      const tempDir = path.join(process.cwd(), 'uploads', 'temp');
      
      // Créer le dossier final s'il n'existe pas
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
        console.log('📁 Dossier final créé:', finalDir);
      }
      
      const finalPath = path.join(finalDir, finalFilename);
      const tempPath = path.join(tempDir, tempFilename);

      // Sauvegarder l'image croppée
      fs.writeFileSync(finalPath, req.file.buffer);
      console.log('💾 Image croppée sauvegardée:', finalFilename);

      // Nettoyer le fichier temporaire
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log('🗑️ Fichier temporaire supprimé');
      }

      let result = {};

      // Déterminer le type d'action
      const shouldSetAsMain = imageType === 'main' || setAsMain === 'true' || setAsMain === true;

      if (shouldSetAsMain) {
        console.log('⭐ Définition comme image principale...');
        
        // Sauvegarder l'ancienne image principale comme image additionnelle
        if (jewel.image && jewel.image !== finalFilename) {
          await JewelImage.create({
            jewel_id: jewel.id,
            image_url: jewel.image
          });
          console.log('📁 Ancienne image principale sauvegardée');
        }

        // Mettre à jour l'image principale
        await jewel.update({ image: finalFilename });
        
        result = {
          type: 'main',
          filename: finalFilename,
          url: `/uploads/jewels/${finalFilename}`,
          isMain: true
        };

      } else {
        console.log('📎 Ajout comme image additionnelle...');
        
        // Ajouter comme image additionnelle
        const newImage = await JewelImage.create({
          jewel_id: jewel.id,
          image_url: finalFilename
        });

        result = {
          type: 'additional',
          id: newImage.id,
          filename: finalFilename,
          url: `/uploads/jewels/${finalFilename}`,
          isMain: false
        };
      }

      console.log('✅ Image traitée avec succès:', result);

      res.json({
        success: true,
        message: 'Image traitée et sauvegardée avec succès',
        image: result
      });

    } catch (error) {
      console.error('❌ Erreur crop-and-save:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors du traitement de l\'image',
        error: error.message
      });
    }
  }
);

// Route pour définir une image comme principale
router.post('/admin/bijoux/:slug/set-main-image', 
  isAdmin, 
  async (req, res) => {
    console.log('⭐ === DÉBUT set-main-image ===');
    
    try {
      const { slug } = req.params;
      const { imageUrl, imageId } = req.body;

      console.log('📋 Données reçues:', { slug, imageUrl, imageId });

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'URL de l\'image manquante'
        });
      }

      // Vérifier que le bijou existe
      const jewel = await Jewel.findOne({ 
        where: { slug },
        include: [{
          model: JewelImage,
          as: 'additionalImages',
          required: false
        }]
      });

      if (!jewel) {
        return res.status(404).json({
          success: false,
          message: 'Bijou non trouvé'
        });
      }

      console.log('✅ Bijou trouvé:', jewel.name);

      // Sauvegarder l'ancienne image principale comme image additionnelle
      if (jewel.image && jewel.image !== imageUrl) {
        console.log('📁 Sauvegarde de l\'ancienne image principale...');
        
        await JewelImage.create({
          jewel_id: jewel.id,
          image_url: jewel.image
        });
      }

      // Supprimer la nouvelle image principale de la table des images additionnelles
      if (imageId) {
        console.log('🗑️ Suppression de la table des images additionnelles...');
        
        await JewelImage.destroy({
          where: { id: imageId }
        });
      }

      // Mettre à jour l'image principale du bijou
      await jewel.update({ image: imageUrl });

      console.log('✅ Image principale mise à jour avec succès');

      res.json({
        success: true,
        message: 'Image principale mise à jour avec succès',
        newMainImage: imageUrl,
        jewelName: jewel.name
      });

    } catch (error) {
      console.error('❌ Erreur set-main-image:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors du changement d\'image principale',
        error: error.message
      });
    }
  }
);

// Route pour supprimer une image
router.delete('/admin/bijoux/:slug/delete-image', 
  isAdmin, 
  async (req, res) => {
    console.log('🗑️ === DÉBUT delete-image ===');
    
    try {
      const { slug } = req.params;
      const { imageUrl, imageId, isMain } = req.body;

      console.log('📋 Données reçues:', { slug, imageUrl, imageId, isMain });

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'URL de l\'image manquante'
        });
      }

      // Vérifier que le bijou existe
      const jewel = await Jewel.findOne({ 
        where: { slug },
        include: [{
          model: JewelImage,
          as: 'additionalImages',
          required: false
        }]
      });

      if (!jewel) {
        return res.status(404).json({
          success: false,
          message: 'Bijou non trouvé'
        });
      }

      console.log('✅ Bijou trouvé:', jewel.name);

      // Supprimer le fichier physique
      const imagePath = path.join(process.cwd(), 'public', 'uploads', 'jewels', imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log('📁 Fichier image supprimé du disque');
      } else {
        console.log('⚠️ Fichier image non trouvé sur le disque');
      }

      // Actions selon le type d'image
      if (isMain === true || isMain === 'true') {
        console.log('⭐ Suppression de l\'image principale...');
        
        // Vider l'image principale
        await jewel.update({ image: null });
        
        console.log('✅ Image principale supprimée');
        
      } else if (imageId) {
        console.log('📎 Suppression d\'une image additionnelle...');
        
        // Supprimer de la table des images additionnelles
        const deletedCount = await JewelImage.destroy({
          where: { id: imageId }
        });
        
        console.log(`✅ ${deletedCount} image additionnelle supprimée`);
      }

      res.json({
        success: true,
        message: 'Image supprimée avec succès',
        deletedImage: imageUrl,
        jewelName: jewel.name
      });

    } catch (error) {
      console.error('❌ Erreur delete-image:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de l\'image',
        error: error.message
      });
    }
  }
);

// Route pour obtenir les statistiques des images d'un bijou
router.get('/admin/bijoux/:slug/image-stats', 
  isAdmin, 
  async (req, res) => {
    console.log('📊 === DÉBUT image-stats ===');
    
    try {
      const { slug } = req.params;

      const jewel = await Jewel.findOne({
        where: { slug },
        include: [{
          model: JewelImage,
          as: 'additionalImages',
          required: false
        }]
      });

      if (!jewel) {
        return res.status(404).json({
          success: false,
          message: 'Bijou non trouvé'
        });
      }

      // Calculer les statistiques
      const stats = {
        totalImages: 0,
        mainImage: null,
        additionalImages: [],
        totalSizeBytes: 0,
        totalSizeMB: 0
      };

      // Image principale
      if (jewel.image) {
        stats.totalImages++;
        stats.mainImage = {
          url: `/uploads/jewels/${jewel.image}`,
          filename: jewel.image
        };

        // Taille du fichier principal
        try {
          const mainImagePath = path.join(process.cwd(), 'public', 'uploads', 'jewels', jewel.image);
          if (fs.existsSync(mainImagePath)) {
            const mainImageStats = fs.statSync(mainImagePath);
            stats.totalSizeBytes += mainImageStats.size;
          }
        } catch (e) {
          console.warn('Impossible de lire la taille de l\'image principale');
        }
      }

      // Images additionnelles
      if (jewel.additionalImages && jewel.additionalImages.length > 0) {
        jewel.additionalImages.forEach(img => {
          stats.totalImages++;
          stats.additionalImages.push({
            id: img.id,
            url: `/uploads/jewels/${img.image_url}`,
            filename: img.image_url
          });

          // Taille du fichier
          try {
            const imagePath = path.join(process.cwd(), 'public', 'uploads', 'jewels', img.image_url);
            if (fs.existsSync(imagePath)) {
              const imageStats = fs.statSync(imagePath);
              stats.totalSizeBytes += imageStats.size;
            }
          } catch (e) {
            console.warn(`Impossible de lire la taille de l'image ${img.image_url}`);
          }
        });
      }

      stats.totalSizeMB = (stats.totalSizeBytes / (1024 * 1024)).toFixed(2);

      console.log('✅ Statistiques calculées:', stats);

      res.json({
        success: true,
        jewelName: jewel.name,
        stats
      });

    } catch (error) {
      console.error('❌ Erreur image-stats:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      });
    }
  }
);

// Route pour optimiser toutes les images d'un bijou
router.post('/admin/bijoux/:slug/optimize-images', 
  isAdmin, 
  async (req, res) => {
    console.log('🔄 === DÉBUT optimize-images ===');
    
    try {
      const { slug } = req.params;
      const { quality = 0.85, maxWidth = 1200, maxHeight = 1200 } = req.body;

      // Vérifier si Sharp est disponible
      let sharp;
      try {
        sharp = await import('sharp');
        sharp = sharp.default || sharp;
      } catch (e) {
        console.log('❌ Sharp non disponible:', e.message);
        return res.status(500).json({
          success: false,
          message: 'Sharp n\'est pas installé. Installez-le avec: npm install sharp'
        });
      }

      const jewel = await Jewel.findOne({
        where: { slug },
        include: [{
          model: JewelImage,
          as: 'additionalImages',
          required: false
        }]
      });

      if (!jewel) {
        return res.status(404).json({
          success: false,
          message: 'Bijou non trouvé'
        });
      }

      const results = {
        optimized: 0,
        errors: 0,
        totalSavings: 0,
        details: []
      };

      const optimizeImage = async (filename, type) => {
        try {
          const imagePath = path.join(process.cwd(), 'public', 'uploads', 'jewels', filename);
          
          if (!fs.existsSync(imagePath)) {
            throw new Error(`Fichier non trouvé: ${filename}`);
          }

          // Taille originale
          const originalStats = fs.statSync(imagePath);
          const originalSize = originalStats.size;

          // Créer un fichier temporaire optimisé
          const tempPath = imagePath + '.temp';

          await sharp(imagePath)
            .resize(maxWidth, maxHeight, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({
              quality: Math.round(quality * 100),
              progressive: true
            })
            .toFile(tempPath);

          // Vérifier la taille optimisée
          const optimizedStats = fs.statSync(tempPath);
          const optimizedSize = optimizedStats.size;

          // Si l'optimisation réduit la taille, remplacer le fichier
          if (optimizedSize < originalSize) {
            fs.renameSync(tempPath, imagePath);
            
            const savings = originalSize - optimizedSize;
            results.totalSavings += savings;
            
            results.details.push({
              filename,
              type,
              originalSize,
              optimizedSize,
              savings,
              savingsPercent: Math.round((savings / originalSize) * 100)
            });
            
            console.log(`✅ ${filename} optimisé: ${Math.round(savings/1024)}KB économisés`);
          } else {
            // Supprimer le fichier temporaire si pas d'amélioration
            fs.unlinkSync(tempPath);
            
            results.details.push({
              filename,
              type,
              originalSize,
              optimizedSize: originalSize,
              savings: 0,
              savingsPercent: 0,
              note: 'Aucune amélioration'
            });
          }

          results.optimized++;

        } catch (error) {
          console.error(`❌ Erreur optimisation ${filename}:`, error.message);
          results.errors++;
          
          results.details.push({
            filename,
            type,
            error: error.message
          });
        }
      };

      // Optimiser l'image principale
      if (jewel.image) {
        await optimizeImage(jewel.image, 'principale');
      }

      // Optimiser les images additionnelles
      if (jewel.additionalImages && jewel.additionalImages.length > 0) {
        for (const img of jewel.additionalImages) {
          await optimizeImage(img.image_url, 'additionnelle');
        }
      }

      const totalSavingsMB = (results.totalSavings / (1024 * 1024)).toFixed(2);

      console.log(`✅ Optimisation terminée: ${results.optimized} images, ${totalSavingsMB}MB économisés`);

      res.json({
        success: true,
        message: `${results.optimized} images optimisées avec succès`,
        results: {
          ...results,
          totalSavingsMB: parseFloat(totalSavingsMB)
        }
      });

    } catch (error) {
      console.error('❌ Erreur optimize-images:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'optimisation des images',
        error: error.message
      });
    }
  }
);

// Route pour nettoyer les fichiers temporaires
router.post('/admin/clean-temp-images', 
  isAdmin, 
  async (req, res) => {
    console.log('🧹 === DÉBUT clean-temp-images ===');
    
    try {
      const tempDir = path.join(process.cwd(), 'uploads', 'temp');
      
      if (!fs.existsSync(tempDir)) {
        console.log('📁 Dossier temporaire inexistant');
        return res.json({
          success: true,
          message: 'Dossier temporaire inexistant',
          deletedCount: 0
        });
      }

      const files = fs.readdirSync(tempDir);
      let deletedCount = 0;
      let totalSize = 0;

      // Supprimer les fichiers de plus d'1 heure
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      files.forEach(file => {
        try {
          const filePath = path.join(tempDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < oneHourAgo) {
            totalSize += stats.size;
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`🗑️ Fichier temporaire supprimé: ${file}`);
          }
        } catch (fileError) {
          console.error(`❌ Erreur suppression fichier ${file}:`, fileError.message);
        }
      });

      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

      console.log(`✅ Nettoyage terminé: ${deletedCount} fichiers supprimés (${totalSizeMB}MB)`);

      res.json({
        success: true,
        message: `${deletedCount} fichier(s) temporaire(s) supprimé(s)`,
        deletedCount,
        totalSizeMB: parseFloat(totalSizeMB),
        remainingFiles: files.length - deletedCount
      });

    } catch (error) {
      console.error('❌ Erreur clean-temp-images:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors du nettoyage des fichiers temporaires',
        error: error.message
      });
    }
  }
);

// Servir les fichiers temporaires
router.use('/uploads/temp', express.static(path.join(process.cwd(), 'uploads', 'temp')));



// 🔧 ROUTES À AJOUTER pour l'ajout dynamique depuis le formulaire d'édition

// Routes pour ajouter dynamiquement des éléments (utilisées par les modales du template)
router.post('/admin/categories/add', isAdmin, jewelControlleur.addCategory);
router.post('/admin/materials/add', isAdmin, jewelControlleur.addMaterial);
router.post('/admin/types/add', isAdmin, jewelControlleur.addType);

// ==========================================
// ROUTES GESTIONNAIRE DYNAMIQUE (INCHANGÉES)
// ==========================================

router.get('/admin/gestionnaire-bijoux', isAdmin, jewelControlleur.showJewelryManager);

router.post('/api/bijoux/:id/duplicate', isAdmin, jewelControlleur.duplicateJewel);
router.delete('/api/bijoux/:slug', isAdmin, jewelControlleur.deleteJewelAPI);
router.post('/api/bijoux/bulk-discount', isAdmin, jewelControlleur.applyBulkDiscount);
router.get('/api/bijoux/stats', isAdmin, jewelControlleur.getStatsAPI);
router.get('/api/bijoux/search', isAdmin, jewelControlleur.searchJewelsAPI);
router.get('/api/categories/:categoryId/types', isAdmin, jewelControlleur.getTypesByCategory);

// ==========================================
// ROUTES COMMANDES UTILISATEUR (INCHANGÉES)
// ==========================================

router.get('/commande/recapitulatif', guestOrderMiddleware, orderController.renderOrderSummary);
router.get('/commande/informations',guestOrderMiddleware, orderController.renderCustomerForm);
router.post('/commande/informations', guestOrderMiddleware, orderController.saveCustomerInfo);
router.get('/commande/paiement', orderController.renderPaymentPage); 
router.get('/commande/confirmation', orderController.renderConfirmation);
router.post('/commande/valider', orderController.validateOrderAndSave);

router.put('/api/admin/commandes/:orderId/status', isAdmin, adminOrdersController.updateOrderStatus);

// 🆕 NOUVELLES ROUTES POUR GESTION SMS
router.post('/api/admin/sms/test', isAdmin, adminOrdersController.testSMSConfiguration);
router.get('/api/admin/notifications/status', isAdmin, adminOrdersController.getNotificationStatus);
router.post('/api/admin/commandes/:orderId/resend-notifications', isAdmin, adminOrdersController.resendNotifications);

// ==========================================
// ROUTES API POUR LE DASHBOARD ADMIN
// ==========================================

// Route pour obtenir les statistiques des notifications
router.get('/api/admin/notifications/stats', isAdmin, async (req, res) => {
  try {
    const { checkSMSConfiguration } = await import('./services/smsService.js');
    const smsConfig = checkSMSConfiguration();
    
    // Vous pouvez ajouter ici des statistiques depuis votre DB
    // Par exemple, compter les emails/SMS envoyés aujourd'hui
    
    res.json({
      success: true,
      data: {
        smsConfigured: smsConfig.isConfigured,
        emailConfigured: !!(process.env.MAIL_USER && process.env.MAIL_PASS),
        // notifications24h: await getNotificationStats24h(), // À implémenter si besoin
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/mescommandes", isAuthenticated, adminStatsController.showOrderPage);

router.get('/api/cart', orderController.getCartAPI);

// ==========================================
// ROUTES FAVORIS (INCHANGÉES)
// ==========================================

router.get('/favoris', isAuthenticated, favoritesController.renderFavorites);
router.post('/favoris/ajouter', isAuthenticated, async (req, res, next) => {
    try {
        // Tracking automatique des favoris
        const { jewelId } = req.body;
        if (jewelId) {
            try {
                const jewel = await Jewel.findByPk(jewelId);
                if (jewel) {
                    const currentFavorites = jewel.favorites_count || 0;
                    await jewel.update({ favorites_count: currentFavorites + 1 });
                    console.log(`❤️ Favori ajouté tracké: ${jewel.name} - Total: ${currentFavorites + 1}`);
                }
            } catch (trackError) {
                console.log('Erreur tracking favori ajout:', trackError.message);
            }
        }
        
        // Continuer avec votre contrôleur existant
        favoritesController.addToFavorites(req, res, next);
    } catch (error) {
        next(error);
    }
});

router.post('/favoris/supprimer/:jewelId', isAuthenticated, async (req, res, next) => {
    try {
        // Tracking automatique suppression favoris
        const { jewelId } = req.params;
        if (jewelId) {
            try {
                const jewel = await Jewel.findByPk(jewelId);
                if (jewel) {
                    const currentFavorites = jewel.favorites_count || 0;
                    await jewel.update({ favorites_count: Math.max(0, currentFavorites - 1) });
                    console.log(`💔 Favori retiré tracké: ${jewel.name} - Total: ${Math.max(0, currentFavorites - 1)}`);
                }
            } catch (trackError) {
                console.log('Erreur tracking favori suppression:', trackError.message);
            }
        }
        
        // Continuer avec votre contrôleur existant
        favoritesController.removeFromFavorites(req, res, next);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// ROUTES ADMIN DASHBOARD (INCHANGÉES)
// ==========================================

router.get('/admin/stats', isAdmin, adminStatsController.dashboard);
router.get('/admin/suivi-client', isAdmin, adminStatsController.getAllClientsStats);
router.get("/admin/produits", isAdmin, adminStatsController.ShowPageProducts);
router.get('/admin/bijoux', isAdmin, adminStatsController.findAll);
router.get('/admin/ajouter-bijou', isAdmin, adminStatsController.create);
router.get("/admin/mon-suivi", isAdmin, adminStatsController.ShowPageStats);
// router.get("/admin/parametres", isAdmin, adminStatsController.ShowpageSetting);

// ==========================================
// ROUTES AJAX POUR LA GESTION DYNAMIQUE (INCHANGÉES)
// ==========================================

router.get('/admin/tous-les-bijoux', isAdmin, featuredController.getAllJewelsForAdmin);
router.get('/admin/coups-de-coeur-actuels', isAdmin, featuredController.getCurrentFeatured);
router.get('/coups-de-coeur-html', featuredController.getFeaturedHtml);

router.get('/bagues', (req, res) => res.redirect(301, '/bijoux/bagues'));
router.get('/colliers', (req, res) => res.redirect(301, '/bijoux/colliers'));
router.get('/bracelets', (req, res) => res.redirect(301, '/bijoux/bracelets'));

router.put('/clients/:id', isAdmin, adminStatsController.updateClient);
router.delete("/clients/:id", isAdmin, adminStatsController.deleteClient);
router.post("/clients", isAdmin, adminStatsController.AddClient);

router.get('/mon-compte/mes-statistiques', isAuthenticated, adminStatsController.getAllClientsStats);

// ==========================================
// ROUTES API POUR DASHBOARD DYNAMIQUE (INCHANGÉES)
// ==========================================

router.get('/api/admin/stats/main', isAdmin, adminStatsController.getMainStats);
router.get('/api/admin/stats/trend', isAdmin, adminStatsController.getSalesTrend);
router.get('/api/admin/stats/categories', isAdmin, adminStatsController.getCategorySales);
router.get('/api/admin/stats/top-jewels', isAdmin, adminStatsController.getTopJewels);
router.get('/api/admin/stats/visits', isAdmin, adminStatsController.getVisitsData);
router.get('/api/admin/stats/stock', isAdmin, adminStatsController.getStockData);
router.get('/api/admin/categories', isAdmin, adminStatsController.getCategories);
router.put('/api/admin/bijoux/:id/stock', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;
        
        if (stock === undefined || stock < 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Stock invalide' 
            });
        }
        
        const jewel = await Jewel.findByPk(id);
        
        if (!jewel) {
            return res.status(404).json({ 
                success: false, 
                message: 'Bijou non trouvé' 
            });
        }
        
        await jewel.update({ stock: parseInt(stock) });
        
        res.json({ 
            success: true, 
            message: `Stock mis à jour: ${stock}`,
            newStock: stock
        });
        
    } catch (error) {
        console.error('Erreur mise à jour stock:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// ==========================================
// ROUTES AVEC VÉRIFICATION ADMIN (NETTOYÉES)
// ==========================================

// Route principale pour le nouveau dashboard
router.get('/admin/bijoux-dashboard', isAdmin, (req, res) => {
    jewelryController.dashboard(req, res);
});

// GET /api/bijoux/:id/discount - Version Sequelize
router.get('/api/bijoux/:id/discount', async (req, res) => {
    try {
        const { id } = req.params;
        
        const jewel = await Jewel.findByPk(id, {
            attributes: ['discount_percentage', 'discount_start_date', 'discount_end_date']
        });
        
        if (!jewel) {
            return res.status(404).json({ success: false, message: 'Bijou non trouvé' });
        }
        
        res.json({
            success: true,
            hasDiscount: jewel.discount_percentage > 0,
            type: 'percentage',
            value: jewel.discount_percentage,
            startDate: jewel.discount_start_date,
            endDate: jewel.discount_end_date
        });
        
    } catch (error) {
        console.error('Erreur lors de la récupération de la réduction:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST /api/bijoux/:id/discount - Version Sequelize
router.post('/api/bijoux/:id/discount', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, value, startDate, endDate } = req.body;
        
        // Validation
        if (!value || value <= 0) {
            return res.status(400).json({ success: false, message: 'Valeur de réduction invalide' });
        }
        
        if (type === 'percentage' && value > 100) {
            return res.status(400).json({ success: false, message: 'Le pourcentage ne peut pas dépasser 100%' });
        }
        
        const jewel = await Jewel.findByPk(id);
        
        if (!jewel) {
            return res.status(404).json({ success: false, message: 'Bijou non trouvé' });
        }
        
        let discountPercentage = 0;
        if (type === 'percentage') {
            discountPercentage = value;
        } else if (type === 'fixed') {
            const currentPrice = parseFloat(jewel.price_ttc);
            if (currentPrice <= 0) {
                return res.status(400).json({ success: false, message: 'Prix du bijou invalide' });
            }
            discountPercentage = Math.min((value / currentPrice) * 100, 100);
        }
        
        await jewel.update({
            discount_percentage: discountPercentage,
            discount_start_date: startDate || null,
            discount_end_date: endDate || null
        });
        
        res.json({ success: true, message: 'Réduction appliquée avec succès' });
        
    } catch (error) {
        console.error('Erreur lors de l\'application de la réduction:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// DELETE /api/bijoux/:id/discount - Version Sequelize
router.delete('/api/bijoux/:id/discount', async (req, res) => {
    try {
        const { id } = req.params;
        
        const jewel = await Jewel.findByPk(id);
        
        if (!jewel) {
            return res.status(404).json({ success: false, message: 'Bijou non trouvé' });
        }
        
        await jewel.update({
            discount_percentage: 0,
            discount_start_date: null,
            discount_end_date: null
        });
        
        res.json({ success: true, message: 'Réduction supprimée avec succès' });
        
    } catch (error) {
        console.error('Erreur lors de la suppression de la réduction:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST /api/bijoux/bulk-discount - Version Sequelize
router.post('/api/bijoux/bulk-discount', async (req, res) => {
    try {
        const { type, value, startDate, endDate, categoryFilter, materialFilter } = req.body;
        
        // Validation
        if (!value || value <= 0) {
            return res.status(400).json({ success: false, message: 'Valeur de réduction invalide' });
        }
        
        if (type === 'percentage' && value > 100) {
            return res.status(400).json({ success: false, message: 'Le pourcentage ne peut pas dépasser 100%' });
        }
        
        // Construire les conditions de filtrage
        const whereConditions = {};
        const includeConditions = [];
        
        if (categoryFilter) {
            includeConditions.push({
                model: Category,
                where: { name: categoryFilter }
            });
        }
        
        if (materialFilter) {
            whereConditions.matiere = materialFilter;
        }
        
        let updateData = {
            discount_start_date: startDate || null,
            discount_end_date: endDate || null
        };
        
        if (type === 'percentage') {
            updateData.discount_percentage = value;
            
            const result = await Jewel.update(updateData, {
                where: whereConditions,
                include: includeConditions.length > 0 ? includeConditions : undefined
            });
            
            res.json({
                success: true,
                message: 'Réduction appliquée en masse avec succès',
                affectedCount: result[0]
            });
            
        } else if (type === 'fixed') {
            // Pour les montants fixes, traiter chaque bijou individuellement
            const jewels = await Jewel.findAll({
                where: { ...whereConditions, price_ttc: { [Op.gt]: 0 } },
                include: includeConditions.length > 0 ? includeConditions : undefined
            });
            
            if (jewels.length === 0) {
                return res.status(400).json({ success: false, message: 'Aucun bijou trouvé avec ces critères' });
            }
            
            const updatePromises = jewels.map(jewel => {
                const discountPercentage = Math.min((value / parseFloat(jewel.price_ttc)) * 100, 100);
                return jewel.update({
                    discount_percentage: discountPercentage,
                    discount_start_date: startDate || null,
                    discount_end_date: endDate || null
                });
            });
            
            await Promise.all(updatePromises);
            
            res.json({
                success: true,
                message: 'Réduction appliquée en masse avec succès',
                affectedCount: jewels.length
            });
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'application de la réduction en masse:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});


// Routes pour les métriques temps réel
router.get('/api/jewelry/realtime-stats', isAdmin, jewelryController.getRealtimeStats);
router.post('/api/jewelry/:id/track-view', jewelryController.trackView);
router.post('/api/jewelry/:id/track-favorite', jewelryController.trackFavorite);
router.post('/api/jewelry/:id/track-cart', jewelryController.trackCartAddition);

// Routes pour la gestion des stocks par taille
router.put('/api/jewelry/:id/size-stock', isAdmin, jewelryController.updateSizeStock);
// router.get('/api/jewelry/:id/size-stocks', isAdmin, jewelryController.getSizeStocks);

// Routes pour les stocks avec seuil configurable
router.put('/api/jewelry/:id/stock', isAdmin, jewelryController.updateStock);
router.get('/api/jewelry/stats', isAdmin, jewelryController.getJewelryStats);


// ==========================================
// DASHBOARD BIJOUX DYNAMIQUE
// ==========================================

// Dashboard principal bijoux
router.get('/tableau-de-bord-bijoux', isAdmin, jewelryController.dashboard);
router.get('/admin/tableau-de-bord-bijoux', isAdmin, jewelryController.dashboard);

// ==========================================
// API POUR LE DASHBOARD TEMPS RÉEL
// ==========================================

// Statistiques en temps réel
router.get('/api/bijoux/statistiques-temps-reel', isAdmin, jewelryController.getRealtimeStats);
router.get('/api/bijoux/statistiques', isAdmin, jewelryController.getJewelryStats);
router.get('/api/bijoux/liste', isAdmin, jewelryController.getJewelsAjax);

// ==========================================
// SUIVI DES MÉTRIQUES TEMPS RÉEL
// ==========================================

// Suivi des vues (sans authentification pour les visiteurs)
router.post('/api/bijoux/:id/suivre-vue', jewelryController.trackView);

// Suivi des favoris (authentification requise)
router.post('/api/bijoux/:id/suivre-favori', jewelryController.trackFavorite);

// Suivi des ajouts au panier
router.post('/api/bijoux/:id/suivre-panier', jewelryController.trackCartAddition);

// ==========================================
// GESTION DES STOCKS
// ==========================================

// Mise à jour du stock d'un bijou
router.put('/api/bijoux/:id/stock', isAdmin, jewelryController.updateStock);

// Mise à jour du stock par taille
router.put('/api/bijoux/:id/stock-taille', isAdmin, jewelryController.updateSizeStock);

router.delete('/cart/remove/:jewelId', cartController.removeFromCart);


// ==========================================
// SUGGESTIONS DE RECHERCHE
// ==========================================

// Recherche avec suggestions
router.get('/api/bijoux/recherche/suggestions', jewelryController.searchSuggestions);

// Toggle favoris pour utilisateurs connectés
router.post('/api/bijoux/:jewelId/basculer-favori', isAuthenticated, jewelryController.toggleFavorite);

// ==========================================
// VUES FILTRÉES DU DASHBOARD
// ==========================================

// Bijoux en stock faible
router.get('/admin/bijoux/stock-faible', isAdmin, (req, res) => {
    req.query.stock = 'low';
    jewelryController.dashboard(req, res);
});

// Bijoux les plus vus
router.get('/admin/bijoux/plus-vus', isAdmin, (req, res) => {
    req.query.sort = 'most_viewed';
    jewelryController.dashboard(req, res);
});

// Bijoux les plus vendus
router.get('/admin/bijoux/plus-vendus', isAdmin, (req, res) => {
    req.query.sort = 'most_sold';
    jewelryController.dashboard(req, res);
});

// Bijoux en promotion
router.get('/admin/bijoux/en-promotion', isAdmin, (req, res) => {
    req.query.sale = 'true';
    jewelryController.dashboard(req, res);
});

// Route pour la page des promotions
router.get('/on-sale', promoAdminController.showPromotions);
router.get('/promotions', promoAdminController.showPromotions); // Alias
router.get('/bijoux/promotions', promoAdminController.showPromotions); // Ancien lien

// Modification des routes de catégories pour gérer le paramètre ?promo=true
router.get('/bijoux/bagues', (req, res) => {
    if (req.query.promo === 'true') {
        req.query.category = 'bagues';
        return promoAdminController.showPromotions(req, res);
    }
    return baguesControlleur.showRings(req, res);
});

router.get('/bijoux/colliers', (req, res) => {
    if (req.query.promo === 'true') {
        req.query.category = 'colliers';
        return promoAdminController.showPromotions(req, res);
    }
    return jewelControlleur.showNecklaces(req, res);
});

router.get('/bijoux/bracelets', (req, res) => {
    if (req.query.promo === 'true') {
        req.query.category = 'bracelets';
        return promoAdminController.showPromotions(req, res);
    }
    return braceletsControlleur.showBracelets(req, res);
});

// ==========================================
// FILTRES PAR CATÉGORIE/MATÉRIAU
// ==========================================

// Filtrage par catégorie
router.get('/admin/bijoux/categorie/:categorySlug', isAdmin, (req, res) => {
    req.query.category = req.params.categorySlug;
    jewelryController.dashboard(req, res);
});

// Filtrage par matériau
router.get('/admin/bijoux/materiau/:materialName', isAdmin, (req, res) => {
    req.query.material = req.params.materialName;
    jewelryController.dashboard(req, res);
});

// ==========================================
// DIAGNOSTIC ET MAINTENANCE
// ==========================================

router.get('/admin/commandes/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Récupérer la commande avec tous les détails
        const order = await Order.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['firstname', 'lastname', 'email', 'phone']
                },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: Jewel,
                            as: 'jewel',
                            attributes: ['name', 'price_ttc', 'image']
                        }
                    ]
                }
            ]
        });

        if (!order) {
            return res.status(404).render('error', {
                message: 'Commande non trouvée',
                user: req.session?.user || null
            });
        }

        // Traduire le status
        const translatedOrder = {
            ...order.toJSON(),
            status: translateOrderStatus(order.status),
            statusClass: getStatusClass(order.status)
        };

        res.render('admin/order-details', {
            title: `Commande #${order.id}`,
            order: translatedOrder,
            user: req.session?.user || null
        });

    } catch (error) {
        console.error('❌ Erreur affichage commande:', error);
        res.status(500).render('error', {
            message: 'Erreur lors du chargement de la commande',
            user: req.session?.user || null
        });
    }
});

// Diagnostic du module bijoux
router.get('/api/bijoux/diagnostic', isAdmin, async (req, res) => {
    try {
        const diagnostics = await jewelryController.getDiagnostics();
        res.json({
            success: true,
            diagnostics
        });
    } catch (error) {
        console.error('Erreur diagnostics:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du diagnostic'
        });
    }
});

// Maintenance manuelle
router.post('/api/bijoux/maintenance', isAdmin, async (req, res) => {
    try {
        const success = await jewelryController.performMaintenance();
        res.json({
            success,
            message: success ? 'Maintenance effectuée avec succès' : 'Erreur lors de la maintenance'
        });
    } catch (error) {
        console.error('Erreur maintenance:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la maintenance'
        });
    }
});

// Santé du service
router.get('/api/bijoux/sante', (req, res) => {
    res.json({
        success: true,
        message: 'Service bijoux opérationnel',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ==========================================
// REDIRECTION DE L'ANCIEN DASHBOARD
// ==========================================

// Redirection de l'ancien dashboard vers le nouveau
router.get('/admin/bijoux', isAdmin, (req, res) => {
    res.redirect('/admin/tableau-de-bord-bijoux');
});

// ==========================================
// AMÉLIORATION DES ROUTES EXISTANTES
// ==========================================

// Amélioration de la route de détail de bijou pour le tracking automatique
const originalBijouRoute = router.stack.find(layer => 
    layer.route && layer.route.path === '/bijoux/:slug'
);

if (originalBijouRoute) {
    // Wrapper pour ajouter le tracking automatique
    router.get('/bijoux/:slug', async (req, res, next) => {
        try {
            // Tracker automatiquement la vue
            const userAgent = req.get('User-Agent') || '';
            if (!userAgent.includes('bot') && !userAgent.includes('crawler')) {
                const jewel = await Jewel.findOne({ where: { slug: req.params.slug } });
                if (jewel) {
                    const mockTrackReq = {
                        params: { id: jewel.id },
                        get: () => userAgent,
                        sessionID: req.sessionID,
                        session: req.session
                    };
                    const mockTrackRes = { json: () => {} };
                    
                    try {
                        await jewelryController.trackView(mockTrackReq, mockTrackRes);
                    } catch (trackError) {
                        console.log('Erreur tracking vue:', trackError.message);
                    }
                }
            }
            
            // Continuer avec l'ancien contrôleur
            jewelControlleur.showJewelDetails(req, res, next);
        } catch (error) {
            console.error('Erreur route bijou:', error);
            next(error);
        }
    });
}



// Amélioration de l'ajout aux favoris pour le tracking
router.post('/favoris/ajouter', isAuthenticated, async (req, res, next) => {
    try {
        const { jewelId } = req.body;
        if (jewelId) {
            const mockTrackReq = {
                params: { id: jewelId },
                body: { action: 'add' },
                session: req.session
            };
            const mockTrackRes = { json: () => {} };
            
            try {
                await jewelryController.trackFavorite(mockTrackReq, mockTrackRes);
            } catch (trackError) {
                console.log('Erreur tracking favori:', trackError.message);
            }
        }
        
        // Continuer avec l'ancien contrôleur
        favoritesController.addToFavorites(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Amélioration de la suppression des favoris pour le tracking
router.post('/favoris/supprimer/:jewelId', isAuthenticated, async (req, res, next) => {
    try {
        const { jewelId } = req.params;
        if (jewelId) {
            const mockTrackReq = {
                params: { id: jewelId },
                body: { action: 'remove' },
                session: req.session
            };
            const mockTrackRes = { json: () => {} };
            
            try {
                await jewelryController.trackFavorite(mockTrackReq, mockTrackRes);
            } catch (trackError) {
                console.log('Erreur tracking favori suppression:', trackError.message);
            }
        }
        
        // Continuer avec l'ancien contrôleur
        favoritesController.removeFromFavorites(req, res, next);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// FONCTION D'INITIALISATION (à appeler dans app.js)
// ==========================================

export async function initialiserModuleBijoux() {
    try {
        console.log('🚀 Initialisation du module bijoux...');
        const success = await initializeJewelryModule();
        
        if (success) {
            console.log('✅ Module bijoux initialisé avec succès');
            console.log('📊 Dashboard disponible sur: /admin/tableau-de-bord-bijoux');
        } else {
            console.log('⚠️ Initialisation partielle du module bijoux');
        }
        
        return success;
    } catch (error) {
        console.error('❌ Erreur initialisation module bijoux:', error);
        return false;
    }
}

router.get('/admin/tableau-de-bord-bijoux', isAdmin, (req, res) => {
    adminStatsController.dashboardBijoux(req, res);
});

router.get('/api/bijoux/statistiques-temps-reel', isAdmin, (req, res) => {
    adminStatsController.getRealtimeStats(req, res);
});

router.post('/api/bijoux/:id/track-view', async (req, res) => {
    try {
        const { id } = req.params;
        const userAgent = req.get('User-Agent') || '';
        
        // Éviter de compter les bots
        if (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider')) {
            return res.json({ success: true, message: 'Bot ignoré' });
        }

        const jewel = await Jewel.findByPk(id);
        if (!jewel) {
            return res.status(404).json({ success: false, message: 'Bijou non trouvé' });
        }

        // Incrémenter le compteur de vues
        const currentViews = jewel.views_count || 0;
        await jewel.update({ 
            views_count: currentViews + 1 
        });

        console.log(`👁️ Vue trackée pour bijou ${jewel.name}: ${currentViews + 1} vues`);

        res.json({ 
            success: true, 
            views: currentViews + 1 
        });

    } catch (error) {
        console.error('Erreur tracking vue:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Route pour tracker les vues
router.post('/track-view', async (req, res) => {
    try {
        const { jewelId, jewelName } = req.body;
        const userId = req.session?.user?.id;
        const sessionId = req.sessionID;

        if (!jewelId) {
            return res.status(400).json({
                success: false,
                message: 'ID du bijou requis'
            });
        }

        console.log('📊 Tracking vue:', { jewelId, jewelName, userId, sessionId });

        // Vérifier si le bijou existe
        const jewel = await Jewel.findByPk(jewelId);
        if (!jewel) {
            return res.status(404).json({
                success: false,
                message: 'Bijou non trouvé'
            });
        }

        // Éviter les vues en double (même utilisateur/session dans les 30 dernières minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        let existingView = null;
        if (userId) {
            // Utilisateur connecté
            existingView = await JewelView.findOne({
                where: {
                    jewel_id: jewelId,
                    user_id: userId,
                    created_at: {
                        [Op.gte]: thirtyMinutesAgo
                    }
                }
            });
        } else {
            // Utilisateur anonyme (par session)
            existingView = await JewelView.findOne({
                where: {
                    jewel_id: jewelId,
                    session_id: sessionId,
                    user_id: null,
                    created_at: {
                        [Op.gte]: thirtyMinutesAgo
                    }
                }
            });
        }

        if (existingView) {
            console.log('👁️ Vue déjà comptée récemment');
            return res.json({
                success: true,
                views: jewel.views_count || 0,
                message: 'Vue déjà comptée'
            });
        }

        // Enregistrer la nouvelle vue
        await JewelView.create({
            jewel_id: jewelId,
            user_id: userId || null,
            session_id: userId ? null : sessionId,
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        // Mettre à jour le compteur dans le bijou
        await jewel.increment('views_count');

        const updatedJewel = await jewel.reload();

        console.log('✅ Vue enregistrée pour', jewelName, '- Total:', updatedJewel.views_count);

        res.json({
            success: true,
            views: updatedJewel.views_count,
            message: 'Vue enregistrée'
        });

    } catch (error) {
        console.error('❌ Erreur tracking vue:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

router.get('/admin/parametres', isAdmin, SettingsController.showPageSettings);
router.post('/parametres/save', isAdmin, SettingsController.saveSettings);
// TEST - Ajoutez ça temporairement
router.post('/admin/parametres/save', (req, res) => {
    console.log('🎯 Route de test atteinte !');
    res.json({ success: true, message: 'Test OK !' });
});




// Route pour récupérer les coups de cœur (publique)
router.get('/featured-jewels', async (req, res) => {
  try {
    const featuredJewels = await Jewel.findAll({
      where: { 
        is_featured: true,
        is_active: true,
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

    const jewelData = featuredJewels.map(jewel => {
      const data = jewel.toJSON();
      data.image = data.additionalImages && data.additionalImages.length > 0 
        ? data.additionalImages[0].image_path 
        : data.image;
      return data;
    });

    res.json({
      success: true,
      featured: jewelData
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des coups de cœur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Route pour récupérer le HTML des coups de cœur mis à jour
router.get('/featured-jewels-html', async (req, res) => {
  try {
    // Cette route retourne le HTML partiel pour mettre à jour la section
    const featuredJewels = await Jewel.findAll({
      where: { 
        is_featured: true,
        is_active: true,
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

    const jewelData = featuredJewels.map(jewel => {
      const data = jewel.toJSON();
      data.image = data.additionalImages && data.additionalImages.length > 0 
        ? data.additionalImages[0].image_path 
        : data.image;
      return data;
    });

    // Render partial template
    res.render('partials/featured-section', {
      featuredJewels: jewelData,
      user: req.session?.user || null
    });

  } catch (error) {
    console.error('Erreur lors de la génération du HTML:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Route pour placeholder d'images
router.get('/placeholder/:width/:height', (req, res) => {
  const { width, height } = req.params;
  
  // Générer une image placeholder simple (vous pouvez utiliser une bibliothèque comme Canvas)
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" dy=".3em">
        ${width}x${height}
      </text>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Routes pour la gestion des coups de cœur (à ajouter dans router.js)
router.post('/admin/featured/add', isAdmin, async (req, res) => {
    try {
        const { jewelId } = req.body;
        console.log('🎯 Ajout coup de cœur:', jewelId);

        if (!jewelId) {
            return res.status(400).json({
                success: false,
                message: 'ID du bijou requis'
            });
        }

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

        // Vérifier que le bijou existe
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
            message: 'Bijou ajouté aux coups de cœur'
        });

    } catch (error) {
        console.error('❌ Erreur ajout coup de cœur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

router.post('/admin/featured/remove', isAdmin, async (req, res) => {
    try {
        const { jewelId } = req.body;
        console.log('🎯 Retrait coup de cœur:', jewelId);

        if (!jewelId) {
            return res.status(400).json({
                success: false,
                message: 'ID du bijou requis'
            });
        }

        // Vérifier que le bijou existe
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
        if (removedOrder) {
            await Jewel.update(
                {
                    featured_order: Jewel.sequelize.literal('featured_order - 1')
                },
                {
                    where: {
                        is_featured: true,
                        featured_order: { [Jewel.sequelize.Op.gt]: removedOrder }
                    }
                }
            );
        }

        console.log(`✅ Bijou ${jewelId} retiré des coups de cœur`);

        res.json({
            success: true,
            message: 'Bijou retiré des coups de cœur'
        });

    } catch (error) {
        console.error('❌ Erreur retrait coup de cœur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});


router.get('/test-jewel', isAdmin, async (req, res) => {
    try {
        console.log('🧪 Test de récupération des bijoux...');
        
        // Test 1: Récupérer tous les bijoux
        const allJewels = await Jewel.findAll({
            limit: 5
        });
        console.log('✅ Bijoux trouvés:', allJewels.length);
        
        // Test 2: Tester la colonne is_featured
        const featuredCount = await Jewel.count({
            where: { is_featured: true }
        });
        console.log('✅ Coups de cœur actuels:', featuredCount);
        
        // Test 3: Tester avec Op
        const { Op } = await import('sequelize');
        const activeJewels = await Jewel.findAll({
            where: {
                is_active: true,
                stock: { [Op.gt]: 0 }
            },
            limit: 3
        });
        console.log('✅ Bijoux actifs avec stock:', activeJewels.length);
        
        // Test 4: Tester avec Category
        let jewelWithCategory = null;
        try {
            jewelWithCategory = await Jewel.findAll({
                include: [
                    {
                        model: Category,
                        as: 'category',
                        required: false
                    }
                ],
                limit: 1
            });
            console.log('✅ Test avec Category réussi');
        } catch (categoryError) {
            console.log('❌ Erreur avec Category:', categoryError.message);
        }
        
        res.json({
            success: true,
            tests: {
                allJewels: allJewels.length,
                featuredCount,
                activeJewels: activeJewels.length,
                categoryTest: !!jewelWithCategory
            },
            sampleJewel: allJewels[0] || null
        });
        
    } catch (error) {
        console.error('❌ Erreur test jewel:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

router.get('/', mainControlleur.homePage);

// Page de gestion des images de catégories
router.get('/admin/category-images', isAdmin, categoryController.showCategoryImages);

// Upload d'image pour une catégorie
router.post('/admin/category-images/upload', isAdmin, uploadCategoryImage.single('image'), categoryController.uploadCategoryImage);

// Supprimer l'image d'une catégorie
router.delete('/admin/category-images/:categoryId', isAdmin, categoryController.deleteCategoryImage);

// API pour récupérer les catégories
router.get('/api/categories', categoryController.getCategories);

// Réorganiser l'ordre des catégories
router.put('/admin/category-images/reorder', isAdmin, mainControlleur.reorderCategories);

// Nettoyer les images orphelines
router.post('/admin/category-images/cleanup', isAdmin, mainControlleur.cleanupOrphanedImages);

// Statistiques des catégories
router.get('/admin/category-images/stats', isAdmin, mainControlleur.getCategoryStats);


// Créer le dossier d'images au démarrage
mainControlleur.ensureCategoryImagesDir();


// Route principale du dashboard
router.get('/admin/dashboard', adminStatsController.dashboard);

// API statistiques temps réel
router.get('/api/admin/bijoux/stats-temps-reel', adminStatsController.getRealtimeStats);

// API mise à jour stock
router.put('/api/admin/bijoux/:id/stock', adminStatsController.updateJewelStock);

router.get('/api/admin/bijoux/stats-temps-reel', isAdmin, async (req, res) => {
    try {
        const lowStockThreshold = parseInt(req.query.threshold) || 3;
        
        const stats = await sequelize.query(`
            SELECT 
                COUNT(*) as totalJewels,
                COALESCE(SUM(stock), 0) as totalStock,
                COUNT(CASE WHEN stock <= $1 AND stock > 0 THEN 1 END) as criticalStock,
                COUNT(CASE WHEN stock = 0 THEN 1 END) as outOfStock,
                COALESCE(SUM(views_count), 0) as totalViews,
                COALESCE(SUM(favorites_count), 0) as totalFavorites,
                COALESCE(SUM(cart_additions), 0) as totalCartAdditions,
                COALESCE(SUM(sales_count), 0) as totalSales
            FROM jewel
        `, { 
            bind: [lowStockThreshold]
        });
        
        res.json({
            success: true,
            stats: stats[0][0]
        });
        
    } catch (error) {
        console.error('Erreur getRealtimeStats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des statistiques'
        });
    }
});


// Route principale pour afficher le dashboard
router.get('/dashboard', (req, res) => adminStatsController.ShowPageStats(req, res));
router.get('/rapport', (req, res) => adminStatsController.ShowPageStats(req, res));

// API endpoints pour les données dynamiques
router.get('/api/stats', (req, res) => adminStatsController.GetStatsAPI(req, res));
router.get('/api/current-visitors', (req, res) => adminStatsController.GetCurrentVisitors(req, res));
 
router.get('/test-panier-db', async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.session?.customerId;
        console.log('🔍 Test panier DB - User ID:', userId);
        
        if (!userId) {
            return res.json({ error: 'Non connecté' });
        }
        
        const cartItems = await Cart.findAll({
            where: { customer_id: userId },
            include: [{ 
                model: Jewel, 
                as: 'jewel', 
                required: true 
            }]
        });
        
        console.log(`📦 Articles trouvés: ${cartItems.length}`);
        
        res.json({
            success: true,
            userId: userId,
            cartCount: cartItems.length,
            items: cartItems.map(item => ({
                id: item.id,
                jewelId: item.jewel.id,
                name: item.jewel.name,
                quantity: item.quantity,
                price: item.jewel.price_ttc
            }))
        });
        
    } catch (error) {
        console.error('Erreur test:', error);
        res.status(500).json({ error: error.message });
    }
});


// Middleware de vérification admin (à adapter selon votre système)
const requireAdmin = (req, res, next) => {
  if (!req.session?.user?.isAdmin) {
    req.session.flashMessage = {
      type: 'error',
      message: 'Accès administrateur requis'
    };
    return res.redirect('/connexion-inscription');
  }
  next();
};

// 📊 Page principale d'administration des codes promo
router.get('/admin/promos', requireAdmin, promoAdminController.renderAdminPage);

// 📝 Page de création d'un nouveau code promo
router.get('/admin/promos/create', requireAdmin, promoAdminController.renderCreatePage);

// ➕ Traitement de la création d'un code promo
router.post('/admin/promos/create', requireAdmin, promoAdminController.createPromo);

// 📝 Page d'édition d'un code promo
router.get('/admin/promos/:id/edit', requireAdmin, promoAdminController.renderEditPage);

// ✏️ Traitement de la modification d'un code promo
router.post('/admin/promos/:id/edit', requireAdmin, promoAdminController.updatePromo);

// 📊 Page de détails d'un code promo
router.get('/admin/promos/:id', requireAdmin, promoAdminController.renderDetailsPage);

// 🗑️ Suppression d'un code promo
router.post('/admin/promos/:id/delete', requireAdmin, promoAdminController.deletePromo);

// 📊 Export CSV des données
router.get('/admin/promos/export', requireAdmin, promoAdminController.exportData);

router.delete('/admin/promos/:id', requireAdmin, promoAdminController.deletePromo);

// 📊 API JSON pour AJAX (optionnel - garde compatibilité)
router.get('/api/admin/promos/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await promoAdminController.getPromoStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur statistiques' });
  }
});

// Afficher le panier (connecté ou invité)
router.get('/panier', guestOrderMiddleware, cartController.renderCart);

// Ajouter au panier (connecté ou invité)
router.post('/panier/ajouter', guestOrderMiddleware, cartController.addToCart);

// Modifier quantité (connecté ou invité)
router.post('/panier/modifier', guestOrderMiddleware, cartController.updateCartItem);

// Supprimer article (connecté ou invité)
router.delete('/panier/supprimer/:jewelId', guestOrderMiddleware, cartController.removeFromCart);

// Vider le panier (connecté ou invité)
router.post('/panier/vider', guestOrderMiddleware, cartController.clearCart);

// Compter les articles du panier (API)
router.get('/api/panier/count', guestOrderMiddleware, cartController.getCartCount);

// ========================================
// 📋 ROUTES DE COMMANDE (avec support invités)
// ========================================

// Récapitulatif de commande (connecté ou invité)
router.get('/commande/recapitulatif', 
  guestOrderMiddleware, 
  cartNotEmptyMiddleware, 
  guestOrderController.renderOrderSummary
);

// Sauvegarder les informations client
router.post('/commande/informations', 
  guestOrderMiddleware, 
  guestOrderController.saveCustomerInfo
);

// Valider et créer la commande
router.post('/commande/valider', 
  guestOrderMiddleware, 
  cartNotEmptyMiddleware,
  validateGuestOrderMiddleware,
  guestOrderController.validateOrder
);

// ========================================
// 🔄 ROUTES DE CONVERSION INVITÉ
// ========================================

// Convertir un invité en client enregistré
router.post('/invite/creer-compte', guestOrderController.convertGuestToCustomer);

// ========================================
// 🎫 ROUTES CODES PROMO (avec support invités)
// ========================================

// Appliquer un code promo
router.post('/appliquer-code-promo', guestOrderMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Code promo invalide'
      });
    }

    const trimmedCode = code.trim().toUpperCase();
    
    // Liste des codes promo valides (à remplacer par une vraie BDD)
    const validPromoCodes = {
      'WELCOME10': { discountPercent: 10, description: 'Bienvenue -10%' },
      'BIJOUX15': { discountPercent: 15, description: 'Bijoux -15%' },
      'CRYSTAL20': { discountPercent: 20, description: 'Crystal -20%' },
      'NOEL25': { discountPercent: 25, description: 'Noël -25%' }
    };

    const promoCode = validPromoCodes[trimmedCode];
    
    if (!promoCode) {
      return res.json({
        success: false,
        message: 'Code promo invalide ou expiré'
      });
    }

    // Vérifier s'il y a des articles dans le panier
    const cartItemCount = await cartController.getCartItemCount(req);
    
    if (cartItemCount === 0) {
      return res.json({
        success: false,
        message: 'Votre panier est vide'
      });
    }

    // Appliquer le code promo en session
    req.session.appliedPromo = {
      code: trimmedCode,
      discountPercent: promoCode.discountPercent,
      description: promoCode.description,
      appliedAt: new Date()
    };

    console.log(`🎫 Code promo appliqué: ${trimmedCode} (-${promoCode.discountPercent}%)`);

    res.json({
      success: true,
      message: `Code "${trimmedCode}" appliqué ! Réduction de ${promoCode.discountPercent}%`,
      discount: {
        code: trimmedCode,
        percent: promoCode.discountPercent,
        description: promoCode.description
      }
    });

  } catch (error) {
    console.error('❌ Erreur application code promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'application du code promo'
    });
  }
});

// Retirer un code promo
router.delete('/retirer-code-promo', guestOrderMiddleware, (req, res) => {
  try {
    if (req.session.appliedPromo) {
      const removedCode = req.session.appliedPromo.code;
      delete req.session.appliedPromo;
      
      console.log(`🗑️ Code promo retiré: ${removedCode}`);
      
      res.json({
        success: true,
        message: 'Code promo retiré avec succès'
      });
    } else {
      res.json({
        success: false,
        message: 'Aucun code promo à retirer'
      });
    }
  } catch (error) {
    console.error('❌ Erreur suppression code promo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du code promo'
    });
  }
});

// ========================================
// 🔗 ROUTES DE REDIRECTION AMÉLIORÉES
// ========================================

// Redirection intelligente vers le panier
router.get('/cart', (req, res) => {
  res.redirect('/panier');
});

// Redirection vers la commande
router.get('/checkout', guestOrderMiddleware, (req, res) => {
  res.redirect('/commande/recapitulatif');
});

// ========================================
// 🛡️ MIDDLEWARE DE SÉCURITÉ POUR INVITÉS
// ========================================

// Middleware pour limiter les tentatives de spam
const rateLimiter = new Map();

function antiSpamMiddleware(req, res, next) {
  const identifier = req.ip + (req.session.guestId || '');
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 10;

  if (!rateLimiter.has(identifier)) {
    rateLimiter.set(identifier, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const userData = rateLimiter.get(identifier);
  
  if (now > userData.resetTime) {
    userData.count = 1;
    userData.resetTime = now + windowMs;
    return next();
  }

  if (userData.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'Trop de tentatives, veuillez patienter une minute'
    });
  }

  userData.count++;
  next();
}

// Appliquer le rate limiting aux routes sensibles
router.use('/panier/ajouter', antiSpamMiddleware);
router.use('/commande/valider', antiSpamMiddleware);
router.use('/appliquer-code-promo', antiSpamMiddleware);

// ========================================
// 🗑️ NETTOYAGE AUTOMATIQUE DES SESSIONS
// ========================================

// Nettoyer les anciennes sessions invités (à exécuter périodiquement)
function cleanupOldGuestSessions() {
  const oneHour = 60 * 60 * 1000;
  const cutoff = Date.now() - oneHour;
  
  for (const [key, value] of rateLimiter.entries()) {
    if (value.resetTime < cutoff) {
      rateLimiter.delete(key);
    }
  }
}

// Nettoyer toutes les heures
setInterval(cleanupOldGuestSessions, 60 * 60 * 1000);

// ========================================
// 📊 ANALYTICS POUR COMMANDES INVITÉS
// ========================================

// Middleware pour tracker les conversions invités
function trackGuestConversion(req, res, next) {
  const originalSend = res.json;
  
  res.json = function(data) {
    if (data && data.success && data.order) {
      const isGuest = !req.session.user && !req.session.customerId;
      
      if (isGuest) {
        console.log('📊 CONVERSION INVITÉ:', {
          orderNumber: data.order.numero,
          total: data.order.total,
          guestId: req.session.guestId,
          timestamp: new Date().toISOString()
        });
        
        // TODO: Intégrer avec votre système d'analytics
        // analytics.track('guest_order_completed', { ... });
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

router.use('/commande/valider', trackGuestConversion);

// ========================================
// 🔒 ROUTES DE SÉCURITÉ
// ========================================

// Valider la session invité
router.get('/api/guest/validate', guestOrderMiddleware, (req, res) => {
  const isGuest = !req.session.user && !req.session.customerId;
  
  res.json({
    success: true,
    isGuest,
    guestId: req.session.guestId || null,
    cartItemCount: req.session.cart ? req.session.cart.items.length : 0
  });
});

// ========================================
// 📧 ROUTES D'EMAIL POUR INVITÉS
// ========================================

// Newsletter pour invités (optionnel)
router.post('/guest/newsletter', antiSpamMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email invalide'
      });
    }

    // TODO: Ajouter à la newsletter
    console.log('📧 Inscription newsletter invité:', email);
    
    res.json({
      success: true,
      message: 'Inscription réussie à la newsletter'
    });
    
  } catch (error) {
    console.error('❌ Erreur inscription newsletter:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription'
    });
  }
});

// ========================================
// 🔄 MIGRATION DE DONNÉES
// ========================================

// Récupérer les commandes d'un invité par email
router.get('/guest/orders/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email invalide'
      });
    }

    // TODO: Récupérer les commandes invité
    const orders = []; // await Order.findAll({ where: { customer_email: email, is_guest_order: true } });
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        numero: order.numero,
        date: order.created_at,
        total: order.total_amount,
        status: order.status
      }))
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération commandes invité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes'
    });
  }
});

router.post('/admin/repair-emails', async (req, res) => {
    try {
        await repairMissingEmails();
        res.json({ success: true, message: 'Emails réparés' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/admin/materials/add', isAdmin, jewelControlleur.addMaterial);
router.post('/admin/types/add', isAdmin, jewelControlleur.addType);
router.get('/admin/types/category/:categoryId', isAdmin, jewelControlleur.getTypesByCategory);

// 4. AJOUTER un middleware de debug global (temporaire)
router.use((req, res, next) => {
  if (req.url.includes('/admin/bijoux/') && req.url.includes('/update') && req.method === 'POST') {
    console.log('🌐 === DEBUG GLOBAL ROUTE UPDATE ===');
    console.log('📋 Headers importants:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      'user-agent': req.headers['user-agent']?.substring(0, 50)
    });
    console.log('📋 Body status:', {
      exists: !!req.body,
      type: typeof req.body,
      keys: req.body ? Object.keys(req.body) : 'N/A',
      isEmpty: !req.body || Object.keys(req.body || {}).length === 0
    });
  }
  next();
});



// ========================================
// 📊 PAGE PRINCIPALE - GESTION DES CLIENTS
// ========================================
router.get('/admin/gestion-clients',isAdmin,customerManagementController.renderCustomerManagement);

// ========================================
// 👤 GESTION INDIVIDUELLE DES CLIENTS
// ========================================

// Voir les détails d'un client
router.get('/customer/:customerId/details', isAdmin,customerManagementController.getCustomerDetails);

// Mettre à jour un client
// router.post('/customer/update',isAdmin,customerManagementController.updateCustomer);

// Ajouter un nouveau client
router.post('/customer/add',isAdmin,customerManagementController.addCustomer);

// Supprimer un client
router.delete('/customer/:customerId',isAdmin,customerManagementController.deleteCustomer);

// ========================================
// 📧 GESTION DES EMAILS
// ========================================

// Envoyer des emails en masse
router.post('/send-bulk-email', isAdmin,customerManagementController.sendBulkEmail);

// ========================================
// 📤 EXPORT ET STATISTIQUES
// ========================================

// Exporter la liste des clients
router.get('/export-customers',isAdmin,
customerManagementController.exportCustomers);

// Statistiques avancées des clients
router.get('/customer-stats',isAdmin,
   customerManagementController.getCustomerStats);

// Page de gestion des emails
router.get('/admin/emails', isAdmin, emailManagementController.renderEmailManagement);

// API pour récupérer les clients avec filtres
router.get('/admin/api/customers', isAdmin, emailManagementController.getCustomers);

// Créer et envoyer une campagne
router.post('/admin/emails/send', isAdmin, emailManagementController.createAndSendCampaign);

// Récupérer l'historique des campagnes
router.get('/admin/api/campaigns', isAdmin, emailManagementController.getCampaignHistory);

// Récupérer les détails d'une campagne
router.get('/admin/api/campaigns/:id', isAdmin, emailManagementController.getCampaignDetails);

// Envoyer un email de test
router.post('/admin/emails/test', isAdmin, emailManagementController.sendTestEmail);

// ===== ROUTES POUR LE TRACKING =====

// Tracking d'ouverture d'email (pixel invisible)
router.get('/email/track/open/:trackingId', async (req, res) => {
    try {
        const { trackingId } = req.params;

        await EmailCampaignRecipient.update(
            { opened_at: new Date() },
            {
                where: {
                    tracking_id: trackingId,
                    opened_at: null
                }
            }
        );

        const recipient = await EmailCampaignRecipient.findOne({
            where: { tracking_id: trackingId },
            include: [{ model: EmailCampaign }]
        });

        if (recipient?.EmailCampaign) {
            await EmailCampaign.increment('opened_count', {
                where: { id: recipient.campaign_id }
            });
        }

        const pixelBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            'base64'
        );

        res.set({
            'Content-Type': 'image/png',
            'Content-Length': pixelBuffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.send(pixelBuffer);

    } catch (error) {
        console.error('❌ Erreur tracking ouverture:', error);
        res.status(200).send('');
    }
});

// Tracking de clic sur lien
router.get('/email/track/click/:trackingId', async (req, res) => {
    try {
        const { trackingId } = req.params;
        const { url } = req.query;

        if (!url) {
            return res.status(400).send('URL manquante');
        }

        await EmailCampaignRecipient.update(
            { clicked_at: new Date() },
            {
                where: {
                    tracking_id: trackingId,
                    clicked_at: null
                }
            }
        );

        const recipient = await EmailCampaignRecipient.findOne({
            where: { tracking_id: trackingId },
            include: [{ model: EmailCampaign }]
        });

        if (recipient?.EmailCampaign) {
            await EmailCampaign.increment('clicked_count', {
                where: { id: recipient.campaign_id }
            });
        }

        res.redirect(decodeURIComponent(url));

    } catch (error) {
        console.error('❌ Erreur tracking clic:', error);
        res.redirect('/');
    }
});

// ===== ROUTES DE DÉSINSCRIPTION =====

// Page de désinscription
router.get('/unsubscribe', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).render('error', {
                message: 'Email manquant pour la désinscription'
            });
        }

        res.render('unsubscribe', {
            title: 'Se désabonner - CrystosJewel',
            email: email
        });

    } catch (error) {
        console.error('❌ Erreur page désinscription:', error);
        res.status(500).render('error', {
            message: 'Erreur lors du chargement de la page'
        });
    }
});

// Traitement de la désinscription
router.post('/unsubscribe', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis'
            });
        }

        await Customer.update(
            { marketing_opt_in: false },
            { where: { email: email } }
        );

        res.json({
            success: true,
            message: 'Vous avez été désabonné avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur désinscription:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la désinscription'
        });
    }
});

// ===== ROUTES DE COMPATIBILITÉ =====

// Route pour l'ancien système (compatibilité)
router.post('/admin/send-bulk-email', isAdmin, async (req, res) => {
    try {
        return emailManagementController.createAndSendCampaign(req, res);
    } catch (error) {
        console.error('❌ Erreur compatibilité ancienne route:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi'
        });
    }
});


// Export par défaut
export default router;