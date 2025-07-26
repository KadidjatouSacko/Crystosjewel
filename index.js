import "dotenv/config";
import express from "express";
import { Sequelize } from "sequelize";
import { QueryTypes } from 'sequelize';
import session from 'express-session';
import SequelizeStore from 'connect-session-sequelize';
import multer from 'multer';
import bodyParser from 'body-parser';
import flash from 'connect-flash';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import slugify from 'slugify';
import { router } from "./app/router.js";
import { SiteVisit } from "./app/models/siteVisiteModel.js";
import { Customer } from "./app/models/customerModel.js";
import { Role } from "./app/models/roleModel.js";
import { sequelize } from './app/models/sequelize-client.js';
import methodOverride from 'method-override';
import { setUserForViews } from './app/middleware/authMiddleware.js';
import { injectSiteSettings } from './app/middleware/SettingsMiddleware.js';
import { ensurePromoCodesExist } from './migrations/migratePromoCodes.js';
// import { maintenanceMiddleware } from './app/middleware/MaintenanceMiddleware.js';
import { maintenanceMiddleware, forceAdminAccessMiddleware } from './app/middleware/MaintenanceMiddleware.js';
import { isAdmin } from "./app/middleware/authMiddleware.js";


// IMPORTANT: Charger les associations EN PREMIER
import './app/models/associations.js';

const app = express();


// ===== CONFIGURATION DES SESSIONS =====
const SessionStore = SequelizeStore(session.Store);

const sessionStore = new SessionStore({
  db: sequelize,
  tableName: 'Sessions',
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 24 * 60 * 60 * 1000,
  disableTouch: true,
  extendDefaultFields: (defaults, session) => {
    return {
      data: defaults.data,
      expires: defaults.expires,
      created_at: defaults.created_at || new Date(),
      updated_at: defaults.updated_at || new Date()
    };
  }
});


sessionStore.sync().then(() => {
  console.log("✅ Table Sessions synchronisée");
}).catch(err => {
  console.error("❌ Erreur synchronisation Sessions:", err);
});


app.use(session({
  secret: process.env.SESSION_SECRET || 'Bijoux_Elegance_2025_Ultra_Secret_Key',
  resave: false,
  saveUninitialized: false,
  rolling: false,
  store: sessionStore,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  name: 'bijouxSessionId'
}));



// MIDDLEWARES ESSENTIELS - À AJOUTER EN PREMIER
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// ===== FILTRAGE DES LOGS SÉCURISÉ - UNE SEULE FOIS AU DÉMARRAGE =====


// ===== CRÉATION DES DOSSIERS NÉCESSAIRES =====
function ensureDirectoriesExist() {
    const directories = [
        './public',
        './public/uploads',
        './public/uploads/jewels',
        './public/images',
        './public/images/categories',
        './uploads',
        './uploads/categories'
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Dossier créé: ${dir}`);
        }
    });
}

ensureDirectoriesExist();


// Créer le fichier placeholder manquant
function createPlaceholderImage() {
    const placeholderPath = './public/images/placeholder.jpg';
    
    if (!fs.existsSync(placeholderPath)) {
        console.log('📷 Création du fichier placeholder.jpg...');
        
        const placeholderSVG = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="300" height="300" fill="#f8f9fa"/>
  <rect x="50" y="50" width="200" height="200" fill="#dee2e6" rx="15"/>
  <circle cx="120" cy="120" r="20" fill="#6c757d"/>
  <path d="M80 180 L120 140 L140 160 L180 120 L220 160 L220 220 L80 220 Z" fill="#6c757d"/>
  <text x="150" y="260" font-family="Arial" font-size="16" fill="#6c757d" text-anchor="middle">Image non disponible</text>
</svg>`;
        
        try {
            fs.writeFileSync(placeholderPath.replace('.jpg', '.svg'), placeholderSVG);
            // Créer aussi un jpg basique
            const simpleJPG = Buffer.from('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==', 'base64');
            fs.writeFileSync(placeholderPath, simpleJPG);
            console.log('✅ Placeholder créé');
        } catch (error) {
            console.error('❌ Erreur création:', error);
        }
    }
}

// Appeler la fonction
createPlaceholderImage();

// Configuration des vues et statiques
app.set("view engine", "ejs");
app.set("views", "./app/views");

// ===== CONFIGURATION DES FICHIERS STATIQUES =====
app.use(express.static("./public"));
app.use('/uploads', express.static('public/uploads'));
app.use('/images', express.static(path.join(process.cwd(), 'public/images')));
app.use('/images/categories', express.static('public/uploads/categories'));
// Servir les fichiers statiques
app.use('/uploads/jewels', express.static(path.join(process.cwd(), 'public/uploads/jewels')));
app.use('/uploads/temp', express.static(path.join(process.cwd(), 'uploads/temp')));

function createRequiredDirectories() {
  const directories = [
    path.join(process.cwd(), 'public/uploads/jewels'),
    path.join(process.cwd(), 'uploads/temp')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('📁 Dossier créé:', dir);
    }
  });
}

// Appeler au démarrage de l'application
createRequiredDirectories();

// Parsers - DANS L'ORDRE CORRECT
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

await ensurePromoCodesExist();

app.use(methodOverride('_method'));
app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    var method = req.body._method;
    delete req.body._method;
    return method;
  }
}));

// ===== CONFIGURATION MULTER =====
const storage = multer.diskStorage({
  destination: './public/uploads/jewels',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const slug = slugify(req.body.name || 'jewel', { lower: true });
    cb(null, `${slug}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './public/images/categories';
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const categoryId = req.body.categoryId || 'unknown';
    const timestamp = Date.now();
    const filename = `category-${categoryId}-${timestamp}${ext}`;
    cb(null, filename);
  }
});

const uploadCategoryImage = multer({ 
  storage: categoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Utilisez JPG, PNG, GIF ou WebP.'), false);
    }
  }
});

export { uploadCategoryImage };

// Connexion base de données
sequelize.authenticate()
    .then(() => {
        console.log("✅ Connexion à la base de données réussie.");
        return sequelize.sync({ alter: true });
    })
    .then(() => {
        console.log("✅ Base de données synchronisée avec succès !");
    })
    .catch((error) => {
        console.error("❌ Erreur lors de la connexion :", error);
    });


// ===== MIDDLEWARE DE SESSION SÉCURISÉ =====
app.use((req, res, next) => {
  try {
    // Initialiser session de façon sécurisée
    if (!req.session) {
      req.session = {};
    }
    
    if (typeof req.session.user === 'undefined') {
      req.session.user = null;
    }
    
    // Variables de base pour les vues
    res.locals.user = req.session.user || null;
    res.locals.isLoggedIn = !!req.session.user;
    res.locals.title = res.locals.title || 'CrystosJewel';
    
  } catch (error) {
    console.error('❌ Erreur middleware session:', error);
    res.locals.user = null;
    res.locals.isLoggedIn = false;
    res.locals.title = 'CrystosJewel';
  }
  
  next();
});

// ===== MIDDLEWARE DE SYNCHRONISATION PANIER =====
app.use((req, res, next) => {
  try {
    console.log('🛒 Synchronisation panier');
    
    // 1. Initialiser le panier de session si nécessaire
    if (!req.session.cart) {
      req.session.cart = { 
        items: [], 
        totalPrice: 0, 
        itemCount: 0 
      };
      console.log('🆕 Nouveau panier créé');
    }

    // 2. Calculer les totaux si le panier a des items
    if (req.session.cart.items && req.session.cart.items.length > 0) {
      let totalPrice = 0;
      let itemCount = 0;
      
      req.session.cart.items.forEach(item => {
        const price = parseFloat(item.jewel?.price || 0);
        const quantity = parseInt(item.quantity || 1);
        const itemTotal = price * quantity;
        
        totalPrice += itemTotal;
        itemCount += quantity;
        
        // Ajouter itemTotal si pas déjà présent
        if (!item.itemTotal) {
          item.itemTotal = itemTotal;
        }
      });
      
      req.session.cart.totalPrice = totalPrice;
      req.session.cart.itemCount = itemCount;
    }

    // 3. Variables locales pour les vues EJS
    res.locals.cartItems = req.session.cart.items || [];
    res.locals.cartItemCount = req.session.cart.items ? req.session.cart.items.length : 0;
    res.locals.cartTotal = req.session.cart.totalPrice || 0;
    
    // 4. Variables pour la page de commande
    const subtotal = req.session.cart.totalPrice || 0;
    const deliveryFee = (subtotal >= 50) ? 0 : 5.99;
    
    res.locals.subtotal = subtotal;
    res.locals.deliveryFee = deliveryFee;
    res.locals.total = subtotal + deliveryFee;
    
    console.log(`🛒 Panier: ${res.locals.cartItemCount} articles, Total: ${res.locals.cartTotal}€`);
    
  } catch (error) {
    console.error('❌ Erreur middleware panier:', error);
    
    // En cas d'erreur, initialiser des valeurs par défaut
    req.session.cart = { items: [], totalPrice: 0, itemCount: 0 };
    res.locals.cartItems = [];
    res.locals.cartItemCount = 0;
    res.locals.cartTotal = 0;
    res.locals.subtotal = 0;
    res.locals.deliveryFee = 5.99;
    res.locals.total = 5.99;
  }
  
  next();
});

// Route pour nettoyer les sessions
app.get('/clear-session', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur destruction session:', err);
      return res.status(500).json({ error: 'Erreur lors de la suppression de session' });
    }
    res.clearCookie('bijouxSessionId');
    res.clearCookie('remember_token');
    res.clearCookie('customername');
    res.json({ 
      success: true, 
      message: 'Session nettoyée avec succès' 
    });
  });
});

// Middleware de restauration remember_me
app.use(async (req, res, next) => {
  try {
    if (!req.session.customerId && req.cookies?.remember_token) {
      const tokenParts = req.cookies.remember_token.split('_');
      const userId = parseInt(tokenParts[0]);
      
      if (userId && !isNaN(userId)) {
        const customer = await Customer.findOne({
          where: { id: userId },
          include: [{ model: Role, as: 'role', required: false }]
        });
        
        if (customer) {
          req.session.customerId = customer.id;
          req.session.user = {
            id: customer.id,
            name: customer.first_name,
            email: customer.email,
            role: customer.role ? {
              id: customer.role.id,
              name: customer.role.name
            } : { id: null, name: 'client' },
            role_id: customer.role_id || customer.role?.id,
            lastActivity: new Date(),
            rememberMe: true,
            restoredFromToken: true
          };
          
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
          
          res.cookie("customername", customer.email, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 30 * 24 * 60 * 60 * 1000,
            sameSite: "lax"
          });
          
          console.log('🔄 Session restaurée pour:', customer.email);
        } else {
          res.clearCookie("remember_token");
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur restauration session:', error);
    res.clearCookie("remember_token");
  }
  next();
});

// Middleware pour la lastActivity
app.use((req, res, next) => {
  try {
    if (req.session?.customerId && req.session.user) {
      const now = new Date();
      const lastActivity = new Date(req.session.user.lastActivity || 0);
      
      if (now - lastActivity > 5 * 60 * 1000) {
        req.session.user.lastActivity = now;
      }
    }
  } catch (error) {
    console.error('❌ Erreur lastActivity:', error);
  }
  next();
});

// ===== MIDDLEWARE POUR INJECTION PARAMÈTRES COMPLET =====
app.use((req, res, next) => {
  try {
    console.log('💉 Injection paramètres globaux');
    
    // Variables utilisateur (éviter req.session.user undefined)
    const user = req.session?.user || null;
    const customerId = req.session?.customerId || null;
    
    res.locals.user = user;
    res.locals.isLoggedIn = !!customerId;
    
    // Variables panier (s'assurer qu'elles existent)
    if (!res.locals.cartItems) {
      res.locals.cartItems = req.session?.cart?.items || [];
    }
    if (typeof res.locals.cartItemCount === 'undefined') {
      res.locals.cartItemCount = req.session?.cart?.items?.length || 0;
    }
    if (typeof res.locals.cartTotal === 'undefined') {
      res.locals.cartTotal = req.session?.cart?.totalPrice || 0;
    }
    
    // Variables générales
    res.locals.success = res.locals.success || [];
    res.locals.error = res.locals.error || [];
    res.locals.errorMessage = res.locals.errorMessage || '';
    res.locals.formData = res.locals.formData || {};
    
    if (!res.locals.title) {
      res.locals.title = 'CrystosJewel';
    }
    
    console.log(`💉 Variables OK - User: ${user?.name || 'Anonyme'}, Panier: ${res.locals.cartItemCount} articles`);
    
  } catch (error) {
    console.error('❌ Erreur injection paramètres:', error);
    
    // Valeurs par défaut en cas d'erreur
    res.locals.user = null;
    res.locals.isLoggedIn = false;
    res.locals.cartItems = [];
    res.locals.cartItemCount = 0;
    res.locals.cartTotal = 0;
    res.locals.success = [];
    res.locals.error = [];
    res.locals.errorMessage = '';
    res.locals.formData = {};
    res.locals.title = 'CrystosJewel';
  }
  
  next();
});

// Flash messages
app.use(flash());
app.use((req, res, next) => {
  try {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
  } catch (error) {
    console.error('❌ Erreur flash messages:', error);
    res.locals.success = [];
    res.locals.error = [];
  }
  next();
});

// Tracking des visites
app.use(async (req, res, next) => {
  try {
    const isStaticResource = req.path.startsWith('/css') || 
                           req.path.startsWith('/js') || 
                           req.path.startsWith('/images') ||
                           req.path.startsWith('/uploads') ||
                           req.path.startsWith('/favicon');
    
    if (!isStaticResource) {
      await SiteVisit.create({
        ip_address: req.ip || req.connection.remoteAddress,
        path: req.path,
        visited_at: new Date()
      });
    }
  } catch (error) {
    console.error('❌ Erreur tracking visite:', error);
  }
  next();
});

// Headers de sécurité
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Middleware externes


// ===== ROUTES DE DEBUG =====
app.get('/debug/cart', (req, res) => {
  res.json({
    success: true,
    session_cart: req.session.cart,
    locals: {
      cartItems: res.locals.cartItems,
      cartItemCount: res.locals.cartItemCount,
      cartTotal: res.locals.cartTotal,
      user: res.locals.user,
      isLoggedIn: res.locals.isLoggedIn,
      subtotal: res.locals.subtotal,
      deliveryFee: res.locals.deliveryFee,
      total: res.locals.total
    },
    session_id: req.sessionID
  });
});

app.get('/debug/clear-cart', (req, res) => {
  req.session.cart = { items: [], totalPrice: 0, itemCount: 0 };
  res.json({ success: true, message: 'Panier vidé' });
});

app.get('/debug/add-test-item', (req, res) => {
  if (!req.session.cart) {
    req.session.cart = { items: [], totalPrice: 0, itemCount: 0 };
  }
  
  const testItem = {
    jewelId: 1,
    quantity: 1,
    jewel: {
      id: 1,
      name: 'Test Bijou',
      price: 29.99,
      image: '/images/test.jpg'
    },
    itemTotal: 29.99
  };
  
  req.session.cart.items.push(testItem);
  req.session.cart.totalPrice = (req.session.cart.totalPrice || 0) + testItem.itemTotal;
  req.session.cart.itemCount = (req.session.cart.itemCount || 0) + testItem.quantity;
  
  res.json({ 
    success: true, 
    message: 'Item de test ajouté',
    cart: req.session.cart 
  });
});


app.get('/debug/category-images', (req, res) => {
    const paths = [
        './public/images/categories',
        './public/uploads/categories',
        './uploads/categories'
    ];
    
    const result = {
        success: true,
        paths: {}
    };
    
    paths.forEach(dirPath => {
        try {
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                const imageList = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
                                       .map(file => {
                    const filePath = path.join(dirPath, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        size: Math.round(stats.size / 1024) + 'KB',
                        created: stats.birthtime
                    };
                });
                
                result.paths[dirPath] = {
                    exists: true,
                    count: imageList.length,
                    images: imageList
                };
            } else {
                result.paths[dirPath] = {
                    exists: false,
                    message: 'Dossier non trouvé'
                };
            }
        } catch (error) {
            result.paths[dirPath] = {
                exists: false,
                error: error.message
            };
        }
    });
    
    res.json(result);
});

app.get('/debug/upload-test', (req, res) => {
    res.send(`
        <form action="/admin/category-images/upload" method="post" enctype="multipart/form-data">
            <input type="hidden" name="categoryId" value="1">
            <input type="file" name="image" accept="image/*" required>
            <button type="submit">Test Upload</button>
        </form>
    `);
});

app.get('/debug/check-permissions', (req, res) => {
    const categoriesPath = './public/images/categories';
    
    try {
        const stats = fs.statSync(categoriesPath);
        const files = fs.readdirSync(categoriesPath);
        
        res.json({
            path: categoriesPath,
            exists: true,
            writable: fs.constants.W_OK,
            files: files.length,
            permissions: stats.mode,
            files_list: files
        });
    } catch (error) {
        res.json({
            path: categoriesPath,
            exists: false,
            error: error.message
        });
    }
});

// Route de test API
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API fonctionne !' });
});

app.use(setUserForViews);


app.use(injectSiteSettings);


// Middleware de debug pour les requêtes d'images
app.use('/images', (req, res, next) => {
    console.log(`🖼️ Requête image: ${req.url}`);
    next();
});

app.use(maintenanceMiddleware);
// ===== ROUTES PRINCIPALES =====
app.use(router);


// Route pour vérifier le statut de maintenance (utilisée par la page de maintenance)
router.get('/api/maintenance-status', (req, res) => {
    // Cette route doit toujours répondre, même en maintenance
    res.json({ 
        maintenance: false, // Remplacé dynamiquement par le middleware
        timestamp: new Date().toISOString() 
    });
});

// Route admin pour activer/désactiver la maintenance
router.post('/admin/maintenance/toggle', isAdmin, async (req, res) => {
    try {
        const { enabled, estimatedTime } = req.body;
        
        // Mettre à jour le paramètre de maintenance
        await SiteSetting.upsert({
            key: 'maintenance_mode',
            value: enabled ? 'true' : 'false'
        });

        if (estimatedTime) {
            await SiteSetting.upsert({
                key: 'maintenance_estimated_time',
                value: estimatedTime
            });
        }

        console.log(`🔧 Mode maintenance ${enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'} par admin:`, req.session.user.email);

        res.json({
            success: true,
            message: `Mode maintenance ${enabled ? 'activé' : 'désactivé'}`,
            maintenanceMode: enabled
        });

    } catch (error) {
        console.error('❌ Erreur toggle maintenance:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du changement de statut'
        });
    }
});

// Route pour forcer l'accès admin (avec paramètre spécial)
router.get('/connexion-inscription', forceAdminAccessMiddleware, (req, res) => {
    // Si paramètre admin=1 dans l'URL, afficher un message spécial
    const isAdminAccess = req.query.admin === '1';
    
    res.render('connexion-inscription', {
        title: 'Connexion',
        isAdminAccess: isAdminAccess,
        maintenanceBypass: res.locals.isMaintenanceMode || false,
        user: null,
        isAuthenticated: false,
        isAdmin: false
    });
});
// ===== GESTION DES ERREURS =====

// Erreurs 404
app.use((req, res) => {
  try {
    const user = req.session?.user || null;
    const isLoggedIn = !!req.session?.customerId;
    const cartItemCount = req.session?.cart?.items?.length || 0;
    
    res.status(404).render('error', {
      title: 'Page non trouvée | Bijoux Élégance',
      message: 'La page que vous cherchez n\'existe pas.',
      statusCode: 404,
      user: user,
      isLoggedIn: isLoggedIn,
      cartItemCount: cartItemCount
    });
  } catch (error) {
    console.error('❌ Erreur 404:', error);
    res.status(404).send('Page non trouvée');
  }
});

// Erreurs générales
app.use((err, req, res, next) => {
  try {
    console.error('❌ Erreur serveur:', err.message);
    
    const user = req.session?.user || null;
    const isLoggedIn = !!req.session?.customerId;
    const cartItemCount = req.session?.cart?.items?.length || 0;
    
    res.status(err.status || 500).render('error', {
      title: 'Erreur serveur | Bijoux Élégance',
      message: err.message || 'Une erreur interne est survenue.',
      statusCode: err.status || 500,
      user: user,
      isLoggedIn: isLoggedIn,
      cartItemCount: cartItemCount,
      error: process.env.NODE_ENV === 'development' ? err : null
    });
  } catch (error) {
    console.error('❌ Erreur handler:', error);
    res.status(500).send('Erreur serveur');
  }
});

// ===== DÉMARRAGE DU SERVEUR =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Serveur CrystosJewel démarré sur le port ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log('✅ Toutes les fonctionnalités activées');
});