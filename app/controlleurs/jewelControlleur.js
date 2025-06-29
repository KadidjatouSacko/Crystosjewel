// app/controlleurs/jewelControlleur.js - Version corrigée avec associations fixes
import slugify from 'slugify';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import Sequelize from 'sequelize';
const { Op } = Sequelize;

// Imports des modèles
import { Jewel } from "../models/jewelModel.js";
import { Category } from "../models/categoryModel.js";
import { Material } from "../models/MaterialModel.js";
import { Type } from '../models/TypeModel.js';
import { JewelImage } from '../models/jewelImage.js';
import { JewelView } from '../models/jewelViewModel.js';
import { sequelize } from '../models/sequelize-client.js';
import { QueryTypes } from 'sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


/**
 * Configuration des catégories avec leurs informations d'affichage
 */
const CATEGORY_CONFIG = {
  'bagues': {
    id: 1,
    name: 'Bague',
    title: 'Nos Bagues',
    subtitle: 'Des créations délicates pour sublimer vos mains',
    description: 'Découvrez notre collection de bagues en rose gold et or, ornées de pierres précieuses soigneusement sélectionnées. Chaque pièce est conçue pour magnifier votre style et apporter une touche d\'éclat à vos tenues quotidiennes ou vos occasions spéciales.',
    introTitle: 'L\'élégance au bout des doigts',
    collections: [
      { name: 'Éternité', class: 'bague-signature-1' },
      { name: 'Épanoui', class: 'bague-signature-2' },
      { name: 'Lumière', class: 'bague-signature-3' }
    ],
    testimonials: [
      {
        text: "Ma bague Étincelle ne me quitte plus ! La qualité est exceptionnelle et le design vraiment élégant. Je reçois des compliments à chaque fois que je la porte.",
        author: "Sophie L.",
        stars: 5
      },
      {
        text: "J'ai offert la bague Céleste à ma femme pour notre anniversaire et elle en est tombée amoureuse. Le packaging était magnifique et la bague encore plus belle que sur les photos.",
        author: "Thomas B.",
        stars: 5
      },
      {
        text: "Je cherchais une bague délicate pour tous les jours et j'ai trouvé mon bonheur avec l'Alliance Délicate. Elle est fine, élégante et très confortable à porter.",
        author: "Camille D.",
        stars: 4.5
      }
    ],
    guide: {
      title: 'Guide des tailles',
      description: 'Trouvez la taille de bague parfaite pour vous ou pour offrir. Notre guide vous aide à déterminer facilement la taille idéale.',
      tips: [
        'Comment mesurer votre doigt',
        'Tableau des correspondances internationales',
        'Conseils pour offrir la bonne taille'
      ]
    }
  },
  'colliers': {
    id: 2,
    name: 'Collier',
    title: 'Nos Colliers',
    subtitle: 'Sublimez votre décolleté avec élégance',
    description: 'Explorez notre gamme de colliers raffinés, alliant tradition et modernité. Des pièces délicates aux créations plus audacieuses, trouvez le collier qui révélera votre personnalité et illuminera vos tenues.',
    introTitle: 'La beauté au creux du cou',
    collections: [
      { name: 'Cascade', class: 'collier-signature-1' },
      { name: 'Constellation', class: 'collier-signature-2' },
      { name: 'Harmonie', class: 'collier-signature-3' }
    ],
    testimonials: [
      {
        text: "Mon collier Cascade est absolument magnifique ! Il se marie parfaitement avec tous mes looks, que ce soit pour le travail ou les sorties.",
        author: "Marine R.",
        stars: 5
      },
      {
        text: "La qualité est irréprochable et la livraison a été très rapide. Je recommande vivement cette boutique !",
        author: "Élise M.",
        stars: 5
      },
      {
        text: "Un collier délicat et raffiné, exactement ce que je cherchais. Le rapport qualité-prix est excellent.",
        author: "Julie K.",
        stars: 4.5
      }
    ],
    guide: {
      title: 'Guide des longueurs',
      description: 'Choisissez la longueur parfaite selon votre morphologie et vos préférences. Notre guide vous accompagne dans votre choix.',
      tips: [
        'Les différentes longueurs et leurs effets',
        'Comment choisir selon votre décolleté',
        'Conseils de superposition'
      ]
    }
  },
  'bracelets': {
    id: 3,
    name: 'Bracelet',
    title: 'Nos Bracelets',
    subtitle: 'L\'accessoire parfait pour vos poignets',
    description: 'Découvrez notre collection de bracelets élégants, conçus pour accompagner vos gestes du quotidien. Des modèles fins et discrets aux créations plus imposantes, trouvez le bracelet qui correspond à votre style.',
    introTitle: 'L\'art du détail au poignet',
    collections: [
      { name: 'Infinite', class: 'bracelet-signature-1' },
      { name: 'Charme', class: 'bracelet-signature-2' },
      { name: 'Élégance', class: 'bracelet-signature-3' }
    ],
    testimonials: [
      {
        text: "Mon bracelet Infinite est devenu mon accessoire quotidien. Il est confortable et s'accorde avec tout !",
        author: "Sarah V.",
        stars: 5
      },
      {
        text: "Un cadeau parfait ! Ma sœur adore son nouveau bracelet, il est vraiment magnifique.",
        author: "Antoine L.",
        stars: 5
      },
      {
        text: "La finition est impeccable et le bracelet est très bien ajusté. Très satisfaite de mon achat.",
        author: "Claire F.",
        stars: 4.5
      }
    ],
    guide: {
      title: 'Guide des tailles',
      description: 'Trouvez la taille idéale pour un confort optimal. Nos conseils vous aideront à choisir la bonne circonférence.',
      tips: [
        'Comment mesurer votre poignet',
        'Choisir entre ajusté et décontracté',
        'Conseils pour les bracelets empilables'
      ]
    }
  }
};


/**
 * Génère un slug unique à partir d'un nom
 */
async function generateUniqueSlug(name, excludeId = null) {
  try {
    const { default: slugify } = await import('slugify');

    const baseSlug = slugify(name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });

    let slug = baseSlug;
    let counter = 1;
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      console.log(`🔁 Tentative ${attempts + 1} : vérifie si le slug "${slug}" existe...`);

      const whereClause = { slug };
      if (excludeId) {
        whereClause.id = { [Op.ne]: excludeId };
      }

      const existing = await Jewel.findOne({
        where: whereClause,
        attributes: ['id']
      });

      if (!existing) {
        console.log(`✅ Slug libre trouvé : ${slug}`);
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
      attempts++;
    }

    throw new Error(`❌ Trop de tentatives pour générer un slug unique pour "${name}"`);
  } catch (error) {
    console.error('❌ Erreur lors de la génération du slug :', error);
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
};



/**
 * Sauvegarde une image base64 sur le disque
 */
async function saveBase64Image(base64Data, slug, type) {
  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Format d\'image base64 invalide');
    }

    const imageType = matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    const timestamp = Date.now();
    const filename = `${slug}-${type}-${timestamp}.${imageType}`;
    
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'jewels');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, imageBuffer);
    
    return filename;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'image:', error);
    throw error;
  }
}


async function diagnosticAssociations(req, res) {
  try {
    console.log('🔍 === DIAGNOSTIC DES ASSOCIATIONS ===');
    
    // Tester chaque modèle individuellement
    const results = {
      jewel: { count: 0, sample: null, error: null },
      category: { count: 0, sample: null, error: null },
      type: { count: 0, sample: null, error: null },
      material: { count: 0, sample: null, error: null },
      jewelImage: { count: 0, sample: null, error: null }
    };
    
    try {
      results.jewel.count = await Jewel.count();
      results.jewel.sample = await Jewel.findOne({ attributes: ['id', 'name', 'slug'] });
    } catch (error) {
      results.jewel.error = error.message;
    }
    
    try {
      results.category.count = await Category.count();
      results.category.sample = await Category.findOne({ attributes: ['id', 'name'] });
    } catch (error) {
      results.category.error = error.message;
    }
    
    try {
      results.type.count = await Type.count();
      results.type.sample = await Type.findOne({ attributes: ['id', 'name'] });
    } catch (error) {
      results.type.error = error.message;
    }
    
    try {
      results.material.count = await Material.count();
      results.material.sample = await Material.findOne({ attributes: ['id', 'name'] });
    } catch (error) {
      results.material.error = error.message;
    }
    
    try {
      results.jewelImage.count = await JewelImage.count();
      results.jewelImage.sample = await JewelImage.findOne({ attributes: ['id', 'image_url'] });
    } catch (error) {
      results.jewelImage.error = error.message;
    }
    
    console.log('📊 Résultats diagnostic:', results);
    
    res.json({
      success: true,
      message: 'Diagnostic des associations terminé',
      results
    });
    
  } catch (error) {
    console.error('❌ Erreur diagnostic:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du diagnostic',
      error: error.message
    });
  }
}

/**
 * Obtient le nombre d'articles dans le panier de l'utilisateur
 */
async function getCartItemCount(userId) {
  if (!userId) return 0;
  
  try {
    // Vous devrez adapter cette fonction selon votre modèle Cart
    return 0; // Placeholder
  } catch (error) {
    console.error('Erreur lors du comptage des articles du panier:', error.message);
    return 0;
  }
}

function getFlashMessage(req) {
  const flash = req.session.flash;
  if (flash) {
    delete req.session.flash;
    return flash;
  }
  return null;
}



/**
 * Calcule les statistiques des bijoux
 */
async function calculateJewelryStats() {
  try {
    const stats = await sequelize.query(`
      SELECT 
        COUNT(*) as total_jewels,
        SUM(price_ttc * COALESCE(stock, 1)) as total_value,
        SUM(COALESCE(stock, 1)) as total_stock,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_jewels,
        COUNT(CASE WHEN discount > 0 THEN 1 END) as on_sale
      FROM jewel
    `, { 
      type: QueryTypes.SELECT 
    });

    const result = stats[0];
    
    return {
      totalJewels: parseInt(result.total_jewels) || 0,
      totalValue: parseFloat(result.total_value || 0).toFixed(2),
      totalStock: parseInt(result.total_stock) || 0,
      newJewels: parseInt(result.new_jewels) || 0,
      onSale: parseInt(result.on_sale) || 0
    };
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques:', error);
    return {
      totalJewels: 0,
      totalValue: '0.00',
      totalStock: 0,
      newJewels: 0,
      onSale: 0
    };
  }
}

async function saveUploadedImage(file, slug, type) {
  try {
    if (!file || !file.path) {
      throw new Error('Fichier invalide ou chemin manquant');
    }

    if (!fs.existsSync(file.path)) {
      console.error('❌ Fichier source non trouvé:', file.path);
      throw new Error(`Fichier source non trouvé: ${file.path}`);
    }

    const timestamp = Date.now();
    const randomId = Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-]/g, '');
    const filename = `${cleanSlug}-${type}-${timestamp}-${randomId}${fileExtension}`;
    
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'jewels');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('📁 Dossier créé:', uploadDir);
    }
    
    const destinationPath = path.join(uploadDir, filename);
    
    fs.copyFileSync(file.path, destinationPath);
    
    try {
      fs.unlinkSync(file.path);
    } catch (cleanupError) {
      console.warn('⚠️ Impossible de supprimer le fichier temporaire:', cleanupError.message);
    }
    
    console.log('✅ Image sauvegardée:', filename);
    return filename;
    
  } catch (error) {
    console.error('❌ Erreur saveUploadedImage:', error);
    throw new Error(`Erreur lors de la sauvegarde: ${error.message}`);
  }
}


// 2. Fonction deleteImageFile manquante
async function deleteImageFile(imagePath) {
  try {
    if (!imagePath) {
      console.log('⚠️ Chemin d\'image vide, rien à supprimer');
      return;
    }

    const cleanPath = imagePath.replace(/^\/uploads\/jewels\//, '').replace(/^uploads\/jewels\//, '');
    const fullPath = path.join(process.cwd(), 'public', 'uploads', 'jewels', cleanPath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log('✅ Fichier image supprimé:', cleanPath);
    } else {
      console.log('⚠️ Fichier non trouvé (déjà supprimé?):', fullPath);
    }
  } catch (error) {
    console.error('❌ Erreur deleteImageFile:', error);
  }
}



export const jewelControlleur = {
  
  // ==========================================
  // AFFICHAGE PAR CATÉGORIES
  // ==========================================
  

/**
 * Affiche les bijoux par catégorie avec gestion complète des réductions et badges
 */
async showJewelsByCategory(req, res) {
  try {
    const categorySlug = req.params.category; // 'bagues', 'colliers', 'bracelets'
    const config = CATEGORY_CONFIG[categorySlug];
    
    if (!config) {
      return res.status(404).render('error', {
  title: 'Bijou non trouvé',
  message: 'Le bijou demandé n\'existe pas.',
  statusCode: 404,
  user: req.session?.user || null
});
    }

    // Récupération des filtres et tri depuis les paramètres de requête
    const {
      matiere = [],
      type = [],
      prix = [],
      sort = 'newest',
      page = 1
    } = req.query;

    // Construction de la clause WHERE
    let whereClause = { category_id: config.id };
    
    // Filtre par matériau
    if (Array.isArray(matiere) && matiere.length > 0) {
      const materiaux = await Material.findAll({
        where: { id: { [Op.in]: matiere } }
      });
      if (materiaux.length > 0) {
        whereClause.matiere = { 
          [Op.in]: materiaux.map(m => m.name) 
        };
      }
    } else if (matiere && matiere.length > 0) {
      const materiau = await Material.findByPk(matiere);
      if (materiau) {
        whereClause.matiere = materiau.name;
      }
    }

    // Filtre par type
    if (Array.isArray(type) && type.length > 0) {
      whereClause.type_id = { [Op.in]: type };
    } else if (type && type.length > 0) {
      whereClause.type_id = type;
    }

    // Filtre par prix
    if (Array.isArray(prix) && prix.length > 0) {
      const priceConditions = [];
      prix.forEach(range => {
        switch (range) {
          case '0-100':
            priceConditions.push({ [Op.between]: [0, 100] });
            break;
          case '100-200':
            priceConditions.push({ [Op.between]: [100, 200] });
            break;
          case '200-500':
            priceConditions.push({ [Op.between]: [200, 500] });
            break;
          case '500+':
            priceConditions.push({ [Op.gte]: 500 });
            break;
        }
      });
      if (priceConditions.length > 0) {
        whereClause.price_ttc = { [Op.or]: priceConditions };
      }
    } else if (prix && prix.length > 0) {
      switch (prix) {
        case '0-100':
          whereClause.price_ttc = { [Op.between]: [0, 100] };
          break;
        case '100-200':
          whereClause.price_ttc = { [Op.between]: [100, 200] };
          break;
        case '200-500':
          whereClause.price_ttc = { [Op.between]: [200, 500] };
          break;
        case '500+':
          whereClause.price_ttc = { [Op.gte]: 500 };
          break;
      }
    }

    // Définition du tri avec popularité
    let orderClause = [['created_at', 'DESC']];
    switch (sort) {
      case 'price_asc':
        orderClause = [['price_ttc', 'ASC']];
        break;
      case 'price_desc':
        orderClause = [['price_ttc', 'DESC']];
        break;
      case 'popularity':
        orderClause = [['popularity_score', 'DESC']];
        break;
      case 'newest':
        orderClause = [['created_at', 'DESC']];
        break;
      default:
        orderClause = [['created_at', 'DESC']];
    }

    // Pagination
    const limit = 12;
    const offset = (parseInt(page) - 1) * limit;

    // Requête principale pour récupérer les bijoux
    const { rows: jewels, count: totalJewels } = await Jewel.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        },
        {
          model: Type,
          as: 'type',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true
    });

    // Formatage des bijoux avec gestion des réductions et badges
    const formattedJewels = jewels.map(jewel => {
      const isNew = jewel.created_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const hasDiscount = jewel.discount_percentage && jewel.discount_percentage > 0;
      const isPopular = jewel.popularity_score && jewel.popularity_score > 50; // Seuil de popularité
      
      // Calcul du prix avec réduction
      let currentPrice = jewel.price_ttc;
      let originalPrice = jewel.price_ttc;
      
      if (hasDiscount) {
        currentPrice = jewel.price_ttc * (1 - jewel.discount_percentage / 100);
      }

      // Déterminer le badge principal
      let badge = null;
      let badgeClass = '';
      
      if (hasDiscount) {
        badge = `-${jewel.discount_percentage}%`;
        badgeClass = 'promo';
      } else if (isNew) {
        badge = 'Nouveau';
        badgeClass = 'nouveau';
      } else if (isPopular) {
        badge = 'Populaire';
        badgeClass = 'populaire';
      }

      return {
        ...jewel.toJSON(),
        currentPrice,
        originalPrice,
        hasDiscount,
        isNew,
        isPopular,
        badge,
        badgeClass,
        formattedCurrentPrice: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(currentPrice),
        formattedOriginalPrice: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(originalPrice),
        formattedPrice: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(currentPrice), // Pour compatibilité
        image: jewel.image || 'no-image.jpg'
      };
    });

    // Récupération des données pour les filtres
    const [allMaterials, allTypes] = await Promise.all([
      Material.findAll({ order: [['name', 'ASC']] }),
      Type.findAll({ 
        where: { category_id: config.id },
        order: [['name', 'ASC']] 
      })
    ]);

    // Calcul de la pagination
    const totalPages = Math.ceil(totalJewels / limit);
    const currentPage = parseInt(page);

    // Obtenir le nombre d'articles dans le panier
    const cartItemCount = await getCartItemCount(req.user?.id);

    // Préparation des données pour la vue
    const viewData = {
      // Données de configuration de la catégorie
      category: config,
      categorySlug,
      
      // Bijoux et pagination
      jewels: formattedJewels,
      pagination: {
        currentPage,
        totalPages,
        totalJewels,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage + 1,
        prevPage: currentPage - 1
      },
      
      // Filtres et tri
      filters: {
        matiere: Array.isArray(matiere) ? matiere : (matiere ? [matiere] : []),
        type: Array.isArray(type) ? type : (type ? [type] : []),
        prix: Array.isArray(prix) ? prix : (prix ? [prix] : []),
        sort
      },
      materials: allMaterials,
      types: allTypes,
      
      // Métadonnées
      title: config.title,
      pageTitle: config.title,
      metaDescription: config.description,
      
      // Utilisateur et panier
      user: req.user || null,
      cartItemCount
    };

    // Utiliser la vue correspondante selon la catégorie
    const templateName = categorySlug === 'bagues' ? 'bagues' : 
                         categorySlug === 'colliers' ? 'colliers' : 
                         categorySlug === 'bracelets' ? 'bracelets' : 'jewels-category';
    
    res.render(templateName, viewData);

  } catch (error) {
    console.error(`Erreur lors de l'affichage de la catégorie ${req.params.category}:`, error);
   return res.status(500).render('error', {
  title: 'Erreur serveur',
  message: 'Une erreur est survenue lors de la modification.',
  statusCode: 500,
  user: req.session?.user || null
});
  }
},

  // ==========================================
  // API POUR LE PANIER DYNAMIQUE
  // ==========================================

  /**
   * API pour obtenir le nombre d'articles dans le panier
   */
/**
   * API pour obtenir le nombre d'articles dans le panier
   */
  async getCartCount(req, res) {
    try {
      const cartItemCount = await getCartItemCount(req.user?.id);
      
      res.json({
        success: true,
        count: cartItemCount
      });
    } catch (error) {
      console.error('Erreur lors de la récupération du compteur de panier:', error);
      return res.status(500).render('error', {
  title: 'Erreur serveur',
  message: 'Une erreur est survenue lors de la modification.',
  statusCode: 500,
  user: req.session?.user || null
});
    }
  },

  /**
   * Affiche les bagues
   */
 /**
 * Contrôleur pour la page des bagues - VERSION CORRIGÉE
 */
// Dans baguesControlleur.js - Remplacer la méthode showRings

async showRings(req, res) {
    console.log('🔍 === DEBUT showRings ===');
    
    try {
      const config = CATEGORY_CONFIG['bagues'];
      if (!config) {
        console.error('❌ Configuration bagues non trouvée');
        return res.status(500).render('error', {
          title: 'Erreur serveur',
          message: 'Configuration manquante.',
          statusCode: 500,
          user: req.session?.user || null
        });
      }

      const {
        matiere = [],
        type = [],
        prix = [],
        sort = 'newest',
        page = 1
      } = req.query;

      let whereClause = { category_id: 1 };
      
      // Filtres...
      if (Array.isArray(matiere) && matiere.length > 0) {
        const materiaux = await Material.findAll({
          where: { id: { [Op.in]: matiere } }
        });
        if (materiaux.length > 0) {
          whereClause.matiere = { 
            [Op.in]: materiaux.map(m => m.name) 
          };
        }
      }

      if (Array.isArray(type) && type.length > 0) {
        whereClause.type_id = { [Op.in]: type };
      }

      // Tri
      let orderClause = [['created_at', 'DESC']];
      switch (sort) {
        case 'price_asc':
          orderClause = [['price_ttc', 'ASC']];
          break;
        case 'price_desc':
          orderClause = [['price_ttc', 'DESC']];
          break;
        case 'popularity':
          orderClause = [['popularity_score', 'DESC']];
          break;
      }

      // Pagination
      const limit = 12;
      const offset = (parseInt(page) - 1) * limit;

      const { rows: rings, count: totalRings } = await Jewel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          },
          {
            model: Type,
            as: 'type',
            attributes: ['id', 'name'],
            required: false
          }
        ],
        order: orderClause,
        limit,
        offset,
        distinct: true
      });

      console.log(`✅ ${rings.length} bagues trouvées sur ${totalRings} total`);

      const formattedRings = rings.map(ring => {
        const isNew = ring.created_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const hasDiscount = ring.discount_percentage && ring.discount_percentage > 0;
        
        let currentPrice = ring.price_ttc;
        if (hasDiscount) {
          currentPrice = ring.price_ttc * (1 - ring.discount_percentage / 100);
        }

        return {
          ...ring.toJSON(),
          currentPrice,
          hasDiscount,
          isNew,
          formattedCurrentPrice: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(currentPrice),
          image: ring.image || 'no-image.jpg'
        };
      });

      const [allMaterials, allTypes] = await Promise.all([
        Material.findAll({ order: [['name', 'ASC']] }),
        Type.findAll({ 
          where: { category_id: 1 },
          order: [['name', 'ASC']] 
        })
      ]);

      const totalPages = Math.ceil(totalRings / limit);
      const currentPage = parseInt(page);

      const cartItemCount = await getCartItemCount(req.user?.id);

      const viewData = {
        title: 'Nos Bagues',
        pageTitle: 'Nos Bagues',
        jewels: formattedRings,
        pagination: {
          currentPage,
          totalPages,
          totalJewels: totalRings,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
          nextPage: currentPage < totalPages ? currentPage + 1 : currentPage,
          prevPage: currentPage > 1 ? currentPage - 1 : currentPage
        },
        filters: {
          matiere: Array.isArray(matiere) ? matiere : (matiere ? [matiere] : []),
          type: Array.isArray(type) ? type : (type ? [type] : []),
          prix: Array.isArray(prix) ? prix : (prix ? [prix] : []),
          sort
        },
        materials: allMaterials || [],
        types: allTypes || [],
        user: req.user || null,
        cartItemCount: cartItemCount || 0,
        error: null,
        success: null
      };

      res.render('bagues', viewData);

    } catch (error) {
      console.error('❌ Erreur dans showRings:', error);
      
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
        filters: { matiere: [], type: [], prix: [], sort: 'newest' },
        materials: [],
        types: [],
        user: req.user || null,
        cartItemCount: 0,
        error: `Erreur lors du chargement des bagues: ${error.message}`,
        success: null
      });
    }
  },

  /**
   * Affiche les colliers
   */
 async showNecklaces(req, res) {
    try {
        console.log('🔍 Affichage des colliers');
        
        // Récupération des colliers avec gestion des réductions
        const necklaces = await Jewel.findAll({
            where: { category_id: 2 }, // ID catégorie colliers
            attributes: [
                'id', 'name', 'description', 'price_ttc', 'image', 'slug', 'stock',
                'discount_percentage', 'discount_start_date', 'discount_end_date',
                'views_count', 'favorites_count', 'sales_count',
                'matiere', 'taille', 'poids', 'created_at'
            ],
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name']
                },
                {
                    model: Type,
                    as: 'type',
                    attributes: ['id', 'name'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']],
            limit: 50
        });

        console.log(`✅ ${necklaces.length} colliers récupérés`);

        // Formatage avec calcul des réductions
        const formattedNecklaces = necklaces.map(necklace => {
            const necklaceData = necklace.toJSON();
            
            // Vérifier si la réduction est active
            const now = new Date();
            const discountStart = necklaceData.discount_start_date ? new Date(necklaceData.discount_start_date) : null;
            const discountEnd = necklaceData.discount_end_date ? new Date(necklaceData.discount_end_date) : null;
            
            let isDiscountActive = false;
            if (necklaceData.discount_percentage > 0) {
                if (!discountStart && !discountEnd) {
                    isDiscountActive = true; // Réduction permanente
                } else if (discountStart && discountEnd) {
                    isDiscountActive = now >= discountStart && now <= discountEnd;
                } else if (discountStart && !discountEnd) {
                    isDiscountActive = now >= discountStart;
                }
            }

            // Calculer le prix final
            if (isDiscountActive && necklaceData.discount_percentage > 0) {
                necklaceData.final_price = necklaceData.price_ttc * (1 - necklaceData.discount_percentage / 100);
                necklaceData.has_discount = true;
                necklaceData.savings = necklaceData.price_ttc - necklaceData.final_price;
            } else {
                necklaceData.final_price = necklaceData.price_ttc;
                necklaceData.has_discount = false;
                necklaceData.savings = 0;
            }

            // Formatage des prix
            necklaceData.formattedPrice = new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
            }).format(necklaceData.final_price);

            if (necklaceData.has_discount) {
                necklaceData.formattedOriginalPrice = new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                }).format(necklaceData.price_ttc);
            }

            // Déterminer les badges
            const daysDiff = (new Date() - new Date(necklaceData.created_at)) / (1000 * 60 * 60 * 24);
            if (necklaceData.has_discount) {
                necklaceData.badge = 'Promo';
                necklaceData.badgeClass = 'promo';
            } else if (daysDiff <= 7) {
                necklaceData.badge = 'Nouveau';
                necklaceData.badgeClass = 'nouveau';
            } else if (necklaceData.views_count > 50) {
                necklaceData.badge = 'Populaire';
                necklaceData.badgeClass = 'populaire';
            }

            necklaceData.image = necklaceData.image || 'no-image.jpg';

            return necklaceData;
        });

        // Récupération des données pour les filtres
        const [materials, types] = await Promise.all([
            // Matériaux utilisés pour les colliers
            sequelize.query(`
                SELECT 
                    COALESCE(matiere, 'Non spécifié') as name,
                    COUNT(*) as count
                FROM jewel
                WHERE category_id = 2 AND matiere IS NOT NULL AND TRIM(matiere) != ''
                GROUP BY matiere
                ORDER BY count DESC, matiere ASC
            `, {
                type: QueryTypes.SELECT
            }),
            
            // Types pour les colliers
            Type.findAll({
                where: { category_id: 2 },
                attributes: ['id', 'name'],
                order: [['name', 'ASC']]
            })
        ]);

        // Rendu avec données utilisateur complètes
        res.render('colliers', {
            title: 'Nos Colliers',
            pageTitle: 'Nos Colliers',
            jewels: formattedNecklaces,
            necklaces: formattedNecklaces, // Alias pour compatibilité
            
            // Pagination basique
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalJewels: formattedNecklaces.length,
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
            
            // Données pour filtres
            materials: materials || [],
            types: types || [],
            
            // DONNÉES UTILISATEUR COMPLÈTES
            user: req.session?.user || null,
            isAuthenticated: !!req.session?.user,
            isAdmin: req.session?.user?.role?.name === 'administrateur' || 
                    req.session?.user?.role_id === 2 || false,
            cartItemCount: 0,
            
            // Messages
            error: null,
            success: null
        });

    } catch (error) {
        console.error('❌ Erreur showNecklaces:', error);
        
        res.status(500).render('colliers', {
            title: 'Nos Colliers - Erreur',
            pageTitle: 'Nos Colliers',
            jewels: [],
            necklaces: [],
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
            isAuthenticated: !!req.session?.user,
            isAdmin: req.session?.user?.role?.name === 'administrateur' || 
                    req.session?.user?.role_id === 2 || false,
            cartItemCount: 0,
            error: 'Une erreur est survenue lors du chargement des colliers',
            success: null
        });
    }
},

  /**
   * Affiche les bracelets
   */
  async showBracelets(req, res) {
    try {
      const category = await Category.findOne({ where: { name: 'Bracelet' } });

      if (!category) {
        return res.render('bracelets', {
          title: 'Nos Bracelets',
          jewels: [],
          error: 'Aucune catégorie "Bracelet" trouvée'
        });
      }

      const bracelets = await Jewel.findAll({
        where: { category_id: category.id },
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          }
        ],
        order: [['name', 'ASC']]
      });

      res.render('bracelets', {
        title: 'Nos Bracelets',
        jewels: bracelets
      });
    } catch (error) {
      console.error('Erreur lors de l\'affichage des bracelets:', error);
      res.render('bracelets', {
        title: 'Nos Bracelets',
        jewels: [],
        error: 'Une erreur est survenue lors de l\'affichage des bracelets'
      });
    }
  },

  // ==========================================
  // FORMULAIRE D'AJOUT DE BIJOU
  // ==========================================

  /**
   * Affiche le formulaire d'ajout de bijou
   */
  async showAddJewelForm(req, res) {
    console.log("showAddJewelForm appelé");
    try {
      const [categories, materials, types] = await Promise.all([
        Category.findAll({ order: [['name', 'ASC']] }),
        Material.findAll({ order: [['name', 'ASC']] }),
        Type.findAll({
          include: [{ 
            model: Category, 
            as: 'category',
            attributes: ['id', 'name']
          }],
          order: [['name', 'ASC']]
        })
      ]);

      const cartItemCount = await getCartItemCount(req.user?.id);

      res.render('addjewel', {
        title: 'Ajouter un bijou',
        categories: categories || [],
        materials: materials || [],
        types: types || [],
        error: null,
        success: null,
        user: req.user || null,
        cartItemCount
      });

    } catch (error) {
      console.error("Erreur dans showAddJewelForm:", error);
      res.status(500).render('addjewel', {
        title: 'Ajouter un bijou',
        categories: [],
        materials: [],
        types: [],
        error: "Impossible de charger les données",
        user: req.user || null,
        cartItemCount: 0
      });
    }
  },


  // ==========================================
  // AJOUT DYNAMIQUE VIA AJAX
  // ==========================================

async addCategory(req, res) {
  try {
    console.log('🏷️ Ajout de catégorie via AJAX');
    console.log('📥 Données reçues:', req.body);

    const { name } = req.body;

    if (!name || !name.trim()) {
      console.log('❌ Nom de catégorie manquant');
      return res.status(400).json({
        success: false,
        message: 'Le nom de la catégorie est requis'
      });
    }

    // Vérifier si la catégorie existe déjà (insensible à la casse)
    const existingCategory = await Category.findOne({
      where: {
        name: { [Op.iLike]: name.trim() }
      }
    });

    if (existingCategory) {
      console.log('❌ Catégorie existe déjà:', name.trim());
      return res.status(400).json({
        success: false,
        message: 'Cette catégorie existe déjà'
      });
    }

    // Créer la nouvelle catégorie
    const newCategory = await Category.create({
      name: name.trim()
    });

    console.log('✅ Catégorie créée:', newCategory.name);

    return res.json({
      success: true,
      category: {
        id: newCategory.id,
        name: newCategory.name
      }
    });

  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de catégorie:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'ajout de la catégorie'
    });
  }
},

/**
 * Ajoute un nouveau matériau via AJAX - VERSION CORRIGÉE
 */
async addMaterial(req, res) {
  try {
    console.log('🔗 Ajout de matériau via AJAX');
    console.log('📥 Données reçues:', req.body);

    const { name } = req.body;

    if (!name || !name.trim()) {
      console.log('❌ Nom de matériau manquant');
      return res.status(400).json({
        success: false,
        message: 'Le nom du matériau est requis'
      });
    }

    // Vérifier si le matériau existe déjà (insensible à la casse)
    const existingMaterial = await Material.findOne({
      where: {
        name: { [Op.iLike]: name.trim() }
      }
    });

    if (existingMaterial) {
      console.log('❌ Matériau existe déjà:', name.trim());
      return res.status(400).json({
        success: false,
        message: 'Ce matériau existe déjà'
      });
    }

    // Créer le nouveau matériau
    const newMaterial = await Material.create({
      name: name.trim()
    });

    console.log('✅ Matériau créé:', newMaterial.name);

    return res.json({
      success: true,
      material: {
        id: newMaterial.id,
        name: newMaterial.name
      }
    });

  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de matériau:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'ajout du matériau'
    });
  }
},

async addType(req, res) {
  try {
    console.log('🏷️ Ajout de type via AJAX');
    console.log('📥 Données reçues:', req.body);

    const { name, category_id } = req.body;

    if (!name || !name.trim() || !category_id) {
      console.log('❌ Données manquantes pour le type');
      return res.status(400).json({
        success: false,
        message: 'Le nom du type et la catégorie sont requis'
      });
    }

    // Vérifier que la catégorie existe
    const category = await Category.findByPk(parseInt(category_id));
    if (!category) {
      console.log('❌ Catégorie non trouvée:', category_id);
      return res.status(400).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    // Vérifier si le type existe déjà pour cette catégorie
    const existingType = await Type.findOne({
      where: { 
        name: { [Op.iLike]: name.trim() },
        category_id: parseInt(category_id)
      }
    });

    if (existingType) {
      console.log('❌ Type existe déjà pour cette catégorie:', name.trim());
      return res.status(400).json({
        success: false,
        message: 'Ce type existe déjà pour cette catégorie'
      });
    }

    // Créer le nouveau type
    const newType = await Type.create({
      name: name.trim(),
      category_id: parseInt(category_id)
    });

    console.log('✅ Type créé:', newType.name, 'pour catégorie:', category.name);

    return res.json({
      success: true,
      type: {
        id: newType.id,
        name: newType.name,
        category_id: newType.category_id
      }
    });

  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de type:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'ajout du type'
    });
  }
},

/**
 * Ajoute un nouveau type via AJAX - VERSION CORRIGÉE
 */
async addType(req, res) {
  try {
    console.log('🏷️ Ajout de type via AJAX');
    console.log('📥 Données reçues:', req.body);

    const { name, category_id } = req.body;

    if (!name || !name.trim() || !category_id) {
      console.log('❌ Données manquantes pour le type');
      return res.status(400).json({
        success: false,
        message: 'Le nom du type et la catégorie sont requis'
      });
    }

    // Vérifier que la catégorie existe
    const category = await Category.findByPk(parseInt(category_id));
    if (!category) {
      console.log('❌ Catégorie non trouvée:', category_id);
      return res.status(400).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    // Vérifier si le type existe déjà pour cette catégorie
    const existingType = await Type.findOne({
      where: { 
        name: { [Op.iLike]: name.trim() },
        category_id: parseInt(category_id)
      }
    });

    if (existingType) {
      console.log('❌ Type existe déjà pour cette catégorie:', name.trim());
      return res.status(400).json({
        success: false,
        message: 'Ce type existe déjà pour cette catégorie'
      });
    }

    // Créer le nouveau type
    const newType = await Type.create({
      name: name.trim(),
      category_id: parseInt(category_id)
    });

    console.log('✅ Type créé:', newType.name, 'pour catégorie:', category.name);

    return res.json({
      success: true,
      type: {
        id: newType.id,
        name: newType.name,
        category_id: newType.category_id
      }
    });

  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de type:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'ajout du type'
    });
  }
},

/**
 * Récupère les types pour une catégorie donnée - FONCTION UTILITAIRE
 */
async getTypesByCategory(req, res) {
  try {
    const { categoryId } = req.params;
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'ID de catégorie requis'
      });
    }

    const types = await Type.findAll({
      where: { category_id: parseInt(categoryId) },
      order: [['name', 'ASC']]
    });

    return res.json(types);

  } catch (error) {
    console.error("❌ Erreur lors de la récupération des types:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
},




  // ==========================================
  // GESTION DES BIJOUX
  // ==========================================

  /**
   * Ajoute un nouveau bijou avec tailles JSON - VERSION CORRIGÉE
   */
async addJewel(req, res) {
  console.log('🚀 === DEBUT addJewel ===');
  // Pour req.body
console.log('📥 req.body reçu:', JSON.stringify(req.body, null, 2));

// Pour req.files  
console.log('📄 req.files:', req.files ? Object.keys(req.files).length + ' fichier(s)' : 'Aucun fichier');

  
  try {
    const {
      name,
      category_id,
      description,
      poids,
      matiere,
      type_id,
      carat,
      price_ttc,
      tva,
      image,
      additionalImages,
      taillesToSave
    } = req.body;

    console.log('📋 Données extraites:', {
      name,
      category_id,
      description: description ? 'OUI' : 'NON',
      poids,
      matiere,
      type_id,
      carat,
      price_ttc,
      tva,
      image: image ? `${image.substring(0, 50)}...` : 'VIDE',
      additionalImages: additionalImages ? 'OUI' : 'NON',
      taillesToSave: taillesToSave ? 'OUI' : 'NON'
    });

    // Vérification des champs obligatoires
    console.log('🔍 Vérification des champs obligatoires...');
    if (!name || !price_ttc || !matiere) {
      console.log('❌ Champs manquants détectés');

      const [categories, materials, types] = await Promise.all([
        Category.findAll({ order: [['name', 'ASC']] }),
        Material.findAll({ order: [['name', 'ASC']] }),
        Type.findAll({ 
          include: [{ 
            model: Category, 
            as: 'category',
            attributes: ['id', 'name']
          }],
          order: [['name', 'ASC']]
        })
      ]);

      const cartItemCount = await getCartItemCount(req.user?.id);

      return res.render('addjewel', {
        title: 'Ajouter un bijou',
        error: 'Veuillez remplir tous les champs obligatoires (nom, prix TTC, matière).',
        categories: categories || [],
        materials: materials || [],
        types: types || [],
        success: null,
        user: req.user || null,
        cartItemCount
      });
    }

    console.log('✅ Champs obligatoires OK');

    // **NOUVEAUTÉ** : Détection automatique de la catégorie basée sur le nom
    console.log('🔍 Détection automatique de la catégorie...');
    let detectedCategoryId = null;
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('bague') || nameLower.includes('ring')) {
      detectedCategoryId = 3; // Bagues
      console.log('✅ Catégorie détectée: Bague (ID: 3)');
    } else if (nameLower.includes('collier') || nameLower.includes('necklace') || nameLower.includes('pendentif')) {
      detectedCategoryId = 2; // Colliers
      console.log('✅ Catégorie détectée: Collier (ID: 2)');
    } else if (nameLower.includes('bracelet')) {
      detectedCategoryId = 1; // Bracelets
      console.log('✅ Catégorie détectée: Bracelet (ID: 1)');
    } else if (nameLower.includes('boucle') || nameLower.includes('earring')) {
      detectedCategoryId = 7; // Boucles d'oreilles
      console.log('✅ Catégorie détectée: Boucles d\'oreilles (ID: 7)');
    } else {
      // Si aucune détection automatique, utiliser la catégorie sélectionnée
      detectedCategoryId = category_id;
      console.log('⚠️ Aucune détection automatique, utilisation de la catégorie sélectionnée:', category_id);
    }

    // Vérifier que la catégorie détectée existe
    console.log('🔍 Vérification de la catégorie détectée...');
    const category = await Category.findByPk(detectedCategoryId);
    if (!category) {
      console.log('❌ Catégorie détectée non trouvée:', detectedCategoryId);
      throw new Error(`Catégorie avec l'ID ${detectedCategoryId} non trouvée`);
    }
    console.log('✅ Catégorie confirmée:', category.name);

    // Vérifier que la matière existe
    console.log('🔍 Vérification de la matière...');
    const material = await Material.findOne({ 
      where: { name: matiere } 
    });
    if (!material) {
      console.log('❌ Matière non trouvée:', matiere);
      throw new Error(`Matière "${matiere}" non trouvée`);
    }
    console.log('✅ Matière trouvée:', material.name);

    // Vérifier le type si fourni
    let typeToUse = null;
    if (type_id) {
      console.log('🔍 Vérification du type...');
      typeToUse = await Type.findByPk(type_id);
      if (!typeToUse) {
        console.log('❌ Type non trouvé:', type_id);
        throw new Error(`Type avec l'ID ${type_id} non trouvé`);
      }
      console.log('✅ Type trouvé:', typeToUse.name);
    }

    // Génération du slug
    console.log('🔗 Génération du slug...');
    const slug = await generateUniqueSlug(name);
    console.log('✅ Slug généré:', slug);

    // Gestion de l'image principale
    console.log('🖼️ Traitement de l\'image principale...');
    let imageFileName = null;
    if (image && image.startsWith('data:image')) {
      console.log('📷 Image base64 détectée, conversion...');
      imageFileName = await saveBase64Image(image, slug, 'main');
      console.log('✅ Image sauvegardée:', imageFileName);
    }

    // Calcul du prix HT
    console.log('💰 Calcul du prix HT...');
    const tvaRate = parseFloat(tva) || 20;
    const price_ht = parseFloat(price_ttc) / (1 + tvaRate / 100);
    console.log('✅ Prix HT calculé:', Math.round(price_ht * 100) / 100);

    // Gestion des tailles JSON
    console.log('📏 Traitement des tailles...');
    let tailles = [];
    let totalStock = 0;
    
    if (taillesToSave) {
      try {
        tailles = typeof taillesToSave === 'string' ? JSON.parse(taillesToSave) : taillesToSave;
        if (Array.isArray(tailles)) {
          totalStock = tailles.reduce((total, t) => total + (parseInt(t.stock) || 0), 0);
          console.log('✅ Tailles traitées:', { tailles, totalStock });
        }
      } catch (e) {
        console.error('❌ Erreur parsing taillesToSave:', e);
        tailles = [];
      }
    }

    // Préparer les données pour création - **UTILISER LA CATÉGORIE DÉTECTÉE**
    const jewelData = {
      name,
      slug,
      description: description || null,
      poids: poids ? parseFloat(poids) : null,
      matiere: material.name,
      type_id: typeToUse ? typeToUse.id : null,
      carat: carat ? parseInt(carat) : null,
      price_ttc: parseFloat(price_ttc),
      tva: tvaRate,
      price_ht: Math.round(price_ht * 100) / 100,
      tailles: tailles,
      stock: totalStock,
      category_id: category.id, // **UTILISER LA CATÉGORIE DÉTECTÉE AUTOMATIQUEMENT**
      image: imageFileName
    };

    console.log('📋 Données finales pour création:', jewelData);
    console.log('🎯 Catégorie finale assignée:', category.name, '(ID:', category.id, ')');

    // Créer le bijou
    console.log('💎 Création du bijou en base...');
    const newJewel = await Jewel.create(jewelData);
    console.log('✅ Bijou créé avec succès:', {
      id: newJewel.id,
      name: newJewel.name,
      slug: newJewel.slug,
      category_id: newJewel.category_id
    });

    // Traitement des images additionnelles
    if (additionalImages) {
      console.log('🖼️ Traitement des images additionnelles...');
      let additionalImagesArray = [];
      try {
        additionalImagesArray = typeof additionalImages === 'string' 
          ? JSON.parse(additionalImages) 
          : additionalImages;
      } catch (e) {
        console.error('❌ Erreur parsing additionalImages:', e);
      }

      if (Array.isArray(additionalImagesArray)) {
        console.log(`📷 ${additionalImagesArray.length} images additionnelles à traiter`);
        for (let i = 0; i < additionalImagesArray.length; i++) {
          const imgData = additionalImagesArray[i];
          if (imgData && imgData.startsWith('data:image')) {
            const additionalImageFileName = await saveBase64Image(imgData, newJewel.slug, `additional-${i + 1}`);

            await JewelImage.create({
              image_url: additionalImageFileName,
              jewel_id: newJewel.id
            });
            console.log(`✅ Image additionnelle ${i + 1} sauvegardée`);
          }
        }
      }
    }

    console.log('🎉 Bijou créé avec succès, redirection...');
    res.redirect(`/bijoux/${newJewel.slug}`);

  } catch (error) {
    console.error('❌ ERREUR DANS addJewel:', error);
    console.error('📍 Stack trace:', error.stack);

    try {
      const [categories, materials, types] = await Promise.all([
        Category.findAll({ order: [['name', 'ASC']] }).catch(() => []),
        Material.findAll({ order: [['name', 'ASC']] }).catch(() => []),
        Type.findAll({ 
          include: [{ 
            model: Category, 
            as: 'category',
            attributes: ['id', 'name']
          }],
          order: [['name', 'ASC']]
        }).catch(() => [])
      ]);

      const cartItemCount = await getCartItemCount(req.user?.id).catch(() => 0);

      res.status(500).render('addjewel', {
        title: 'Ajouter un bijou',
        error: `Une erreur est survenue lors de l'ajout : ${error.message}`,
        categories: categories || [],
        materials: materials || [],
        types: types || [],
        success: null,
        user: req.user || null,
        cartItemCount
      });
    } catch (renderError) {
      console.error('❌ Erreur lors du rendu de la page d\'erreur:', renderError);
      res.status(500).json({
        success: false,
        message: 'Une erreur critique est survenue'
      });
    }
  }
},

  /**
   * Affiche les détails d'un bijou - VERSION CORRIGÉE
   */
 
async showJewelDetails(req, res) {
    try {
      const { slug } = req.params;
      
      console.log('🔍 Recherche du bijou avec slug:', slug);
      
      const jewel = await Jewel.findOne({
        where: { slug },
        include: [
          { 
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          },
          { 
            model: Type,
            as: 'type',
            attributes: ['id', 'name'],
            required: false
          },
          {
            model: JewelImage,
            as: 'additionalImages',
            attributes: ['id', 'image_url'],
            required: false
          }
        ]
      });

      if (!jewel) {
        console.log('❌ Bijou non trouvé avec slug:', slug);
        return res.status(404).render('error', {
          title: 'Bijou non trouvé',
          message: 'Le bijou demandé n\'existe pas.',
          statusCode: 404,
          user: req.session?.user || null
        });
      }

      console.log('✅ Bijou trouvé:', jewel.name);

      // Préparer les détails du bijou
      const details = [];
      if (jewel.poids) details.push({ label: 'Poids', value: `${jewel.poids} g` });
      if (jewel.matiere) details.push({ label: 'Matière', value: jewel.matiere });
      if (jewel.carat) details.push({ label: 'Carat', value: `${jewel.carat} carats` });
      
      jewel.dataValues.details = details;

      // Traiter les tailles depuis le JSON
      let sizesAvailable = [];
      if (jewel.tailles && Array.isArray(jewel.tailles)) {
        sizesAvailable = jewel.tailles.map(taille => ({
          taille: taille.taille,
          stock: parseInt(taille.stock) || 0,
          available: (parseInt(taille.stock) || 0) > 0
        }));
      }
      
      jewel.dataValues.sizesAvailable = sizesAvailable;
      
      const totalStock = sizesAvailable.reduce((total, size) => total + size.stock, 0);
      jewel.dataValues.totalStock = totalStock;
      jewel.dataValues.inStock = totalStock > 0;

      // Formater le prix
      jewel.dataValues.formattedPrice = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(jewel.price_ttc);

      // Incrémenter le score de popularité
      await jewel.increment('popularity_score');

      // Bijoux similaires
      const similarJewels = await Jewel.findAll({
        where: {
          category_id: jewel.category_id,
          id: { [Op.ne]: jewel.id }
        },
        include: [{ 
          model: Category, 
          as: 'category',
          attributes: ['id', 'name']
        }],
        limit: 4,
        order: [['popularity_score', 'DESC']]
      });

      const processedSimilarJewels = similarJewels.map(similarJewel => ({
        ...similarJewel.toJSON(),
        image: similarJewel.image || 'no-image.jpg',
        formattedPrice: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(similarJewel.price_ttc)
      }));

      const cartItemCount = await getCartItemCount(req.user?.id);

      res.render('detailjewel', {
        jewel,
        similarJewels: processedSimilarJewels,
        user: req.session?.user,
        pageTitle: jewel.name,
        metaDescription: jewel.description || `${jewel.name} - ${jewel.category?.name || 'Bijou'} en ${jewel.matiere}`,
        cartItemCount
      });

    } catch (error) {
      console.error("❌ Erreur lors de l'affichage du bijou:", error);
      console.error("📍 Stack trace:", error.stack);
      
      return res.status(500).render('error', {
        title: 'Erreur serveur',
        message: 'Une erreur est survenue lors du chargement du bijou.',
        statusCode: 500,
        user: req.session?.user || null
      });
    }
  },


  // ==========================================
  // ÉDITION ET SUPPRESSION
  // ==========================================


  // Cette fonction AFFICHE le formulaire d'édition (GET)
// À ajouter dans votre contrôleur, AVANT updateJewel
// Ajoutez cette méthode dans votre contrôleur d'édition de bijoux
async editJewel(req, res) {
    console.log('🚀 === DEBUT editJewel ===');
    
    try {
      const { slug } = req.params;
      console.log('📋 Slug reçu:', slug);

      // Récupérer les messages flash
      const flashMessage = getFlashMessage(req);

      // Rechercher le bijou existant avec toutes ses relations
      const jewel = await Jewel.findOne({
        where: { slug },
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          },
          {
            model: Type,
            as: 'type',
            attributes: ['id', 'name'],
            required: false
          },
          {
            model: JewelImage,
            as: 'additionalImages',
            attributes: ['id', 'image_url', 'jewel_id'],
            required: false
          }
        ]
      });

      if (!jewel) {
        console.log('❌ Bijou non trouvé:', slug);
        return res.status(404).render('error', {
          title: 'Bijou non trouvé',
          message: 'Le bijou demandé n\'existe pas.',
          statusCode: 404,
          user: req.session?.user || null
        });
      }

      console.log('✅ Bijou trouvé:', jewel.name);

      // Convertir jewel en objet plain d'abord
      const jewelPlainObject = jewel.get({ plain: true });
      
      console.log('🖼️ Images trouvées:', {
        principale: jewelPlainObject.image || 'Aucune',
        additionnelles: jewelPlainObject.additionalImages ? jewelPlainObject.additionalImages.length : 0
      });

      // Si pas d'images additionnelles via l'association, les récupérer directement
      let allImages = jewelPlainObject.additionalImages || [];
      if (allImages.length === 0) {
        console.log('🔍 Récupération directe des images...');
        const directImages = await JewelImage.findAll({
          where: { jewel_id: jewel.id },
          attributes: ['id', 'image_url', 'jewel_id'],
          order: [['created_at', 'ASC']]
        });
        
        // Convertir les instances Sequelize en objets plain
        allImages = directImages.map(img => img.get({ plain: true }));
        console.log('✅ Images récupérées directement:', allImages.length);
      }

      // Ajouter l'image principale à la liste si elle n'y est pas déjà
      if (jewelPlainObject.image) {
        const mainImageExists = allImages.some(img => img.image_url === jewelPlainObject.image);
        if (!mainImageExists) {
          allImages.unshift({
            id: null,
            image_url: jewelPlainObject.image,
            jewel_id: jewelPlainObject.id,
            is_main: true
          });
          console.log('✅ Image principale ajoutée à la liste');
        }
      }

      // Récupérer toutes les catégories, matériaux et types
      const [categories, materials, types] = await Promise.all([
        Category.findAll({ 
          order: [['name', 'ASC']],
          raw: true
        }),
        Material.findAll({ 
          order: [['name', 'ASC']],
          raw: true
        }),
        Type.findAll({ 
          include: [{ 
            model: Category, 
            as: 'category',
            attributes: ['id', 'name']
          }],
          order: [['name', 'ASC']]
        })
      ]);

      // Convertir les types en objets plain
      const typesPlain = types.map(type => type.get({ plain: true }));

      // Créer l'objet final
      const jewelData = {
        ...jewelPlainObject,
        additionalImages: allImages
      };

      console.log('📊 Données préparées pour la vue:', {
        name: jewelData.name,
        category_id: jewelData.category_id,
        images_count: jewelData.additionalImages.length,
        categories_count: categories.length,
        materials_count: materials.length,
        types_count: typesPlain.length
      });

      // Rendre le formulaire d'édition avec les messages flash
      res.render('edit-jewel', {
        title: `Modifier ${jewelData.name}`,
        jewel: jewelData,
        categories: categories || [],
        materials: materials || [],
        types: typesPlain || [],
        error: flashMessage?.type === 'error' ? flashMessage.message : null,
        success: flashMessage?.type === 'success' ? flashMessage.message : null,
        user: req.session?.user || null
      });

    } catch (error) {
      console.error('❌ ERREUR dans editJewel:', error);
      console.error('📍 Stack trace:', error.stack);
      
      res.status(500).render('error', {
        title: 'Erreur serveur',
        message: 'Une erreur est survenue lors du chargement du formulaire d\'édition.',
        statusCode: 500,
        user: req.session?.user || null
      });
    }
  },

  /**
   * Met à jour un bijou existant
   */
async updateJewel(req, res) {
  console.log('🚀 === DEBUT updateJewel ===');
  
  try {
    const { slug } = req.params;
    
    // Debug détaillé
    console.log('📋 Slug:', slug);
    console.log('📋 Body reçu:', Object.keys(req.body || {}));
    console.log('📋 Files reçus:', req.files ? req.files.length : 0);
    
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        console.log(`📎 Fichier ${index + 1}:`, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          filename: file.filename, // Nom généré par votre multer
          path: file.path
        });
      });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      console.log('❌ req.body est vide');
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée reçue.'
      });
    }

    const {
      name,
      category_id,
      description,
      poids,
      matiere,
      type_id,
      carat,
      price_ttc,
      tva,
      taillesToSave,
      is_featured,
      is_active,
      imagesToDelete,
      mainImage
    } = req.body;

    // Rechercher le bijou existant
    const existingJewel = await Jewel.findOne({ 
      where: { slug },
      include: [
        { 
          model: JewelImage, 
          as: 'additionalImages',
          required: false 
        }
      ]
    });
    
    if (!existingJewel) {
      throw new Error(`Bijou avec le slug "${slug}" non trouvé`);
    }

    // Vérifications des champs obligatoires
    if (!name || !price_ttc || !matiere) {
      throw new Error('Veuillez remplir tous les champs obligatoires.');
    }

    // Vérifier la catégorie et la matière
    const [category, material] = await Promise.all([
      Category.findByPk(category_id),
      Material.findOne({ where: { name: matiere } })
    ]);

    if (!category) {
      throw new Error(`Catégorie avec l'ID ${category_id} non trouvée`);
    }

    if (!material) {
      throw new Error(`Matière "${matiere}" non trouvée`);
    }

    // Générer un nouveau slug si nécessaire
    let newSlug = existingJewel.slug;
    if (name !== existingJewel.name) {
      newSlug = await generateUniqueSlug(name, existingJewel.id);
    }

    // === GESTION DES IMAGES AVEC VOTRE CONFIGURATION ===
    console.log('🖼️ === DÉBUT GESTION IMAGES ===');
    
    let finalMainImage = existingJewel.image;

    try {
      // 1. Suppression des images marquées
      if (imagesToDelete && imagesToDelete !== '[]') {
        console.log('🗑️ Suppression des images marquées...');
        const imagesToDeleteArray = JSON.parse(imagesToDelete);
        
        if (Array.isArray(imagesToDeleteArray) && imagesToDeleteArray.length > 0) {
          for (const imageId of imagesToDeleteArray) {
            console.log('🗑️ Suppression image ID:', imageId);
            
            const imageToDelete = await JewelImage.findByPk(imageId);
            if (imageToDelete) {
              // Supprimer le fichier physique avec votre structure
              try {
                const imagePath = path.join(__dirname, '../../public/uploads/jewels', imageToDelete.image_url);
                if (fs.existsSync(imagePath)) {
                  fs.unlinkSync(imagePath);
                  console.log('🗑️ Fichier physique supprimé:', imageToDelete.image_url);
                }
              } catch (fileError) {
                console.error('⚠️ Erreur suppression fichier:', fileError.message);
              }
              
              // Supprimer de la base de données
              await JewelImage.destroy({ where: { id: imageId } });
              
              // Si c'était l'image principale, la réinitialiser
              if (existingJewel.image === imageToDelete.image_url) {
                console.log('⚠️ Image principale supprimée');
                finalMainImage = null;
              }
              
              console.log('✅ Image supprimée de la BDD:', imageId);
            }
          }
        }
      }

      // 2. Gestion du changement d'image principale
      if (mainImage && mainImage !== existingJewel.image && mainImage !== '') {
        console.log('📷 Image principale changée vers:', mainImage);
        finalMainImage = mainImage;
      }

      // 3. Traitement des nouvelles images avec votre configuration
      if (req.files && req.files.length > 0) {
        console.log('🖼️ Traitement des nouvelles images...');
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          
          try {
            if (file.fieldname === 'newImages') {
              console.log(`📷 Traitement nouvelle image ${i + 1}:`, file.originalname);
              
              // Utiliser directement le nom de fichier généré par votre multer
              const imageFileName = file.filename;
              
              // Créer l'entrée en base de données
              await JewelImage.create({
                image_url: imageFileName,
                jewel_id: existingJewel.id
              });
              
              console.log(`✅ Nouvelle image sauvegardée:`, imageFileName);
              
            } else if (file.fieldname === 'newMainImage') {
              console.log('📷 Nouvelle image principale uploadée:', file.originalname);
              
              // Supprimer l'ancienne image principale si elle existe
              if (existingJewel.image) {
                try {
                  const oldImagePath = path.join(__dirname, '../../public/uploads/jewels', existingJewel.image);
                  if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                    console.log('🗑️ Ancienne image principale supprimée');
                  }
                } catch (fileError) {
                  console.error('⚠️ Erreur suppression ancienne image principale:', fileError.message);
                }
              }
              
              // Utiliser le nom généré par votre multer
              finalMainImage = file.filename;
              console.log('✅ Nouvelle image principale sauvegardée:', finalMainImage);
            }
          } catch (imageError) {
            console.error(`❌ Erreur traitement image ${file.originalname}:`, imageError);
            // Continuer avec les autres images même si une échoue
          }
        }
      }

      // 4. Si aucune image principale, prendre la première disponible
      if (!finalMainImage) {
        const firstAdditionalImage = await JewelImage.findOne({
          where: { jewel_id: existingJewel.id },
          order: [['created_at', 'ASC']]
        });
        
        if (firstAdditionalImage) {
          finalMainImage = firstAdditionalImage.image_url;
          console.log('🔄 Image principale définie automatiquement:', finalMainImage);
        }
      }

    } catch (imageError) {
      console.error('❌ Erreur gestion images:', imageError);
      // Ne pas faire planter la mise à jour pour une erreur d'image
      finalMainImage = existingJewel.image;
    }

    console.log('🖼️ === FIN GESTION IMAGES ===');

    // === MISE À JOUR DU BIJOU ===
    
    // Calcul du prix HT
    const tvaRate = parseFloat(tva) || 20;
    const price_ht = parseFloat(price_ttc) / (1 + tvaRate / 100);

    // Gestion des tailles
    let tailles = [];
    let totalStock = 0;
    
    if (taillesToSave) {
      try {
        tailles = typeof taillesToSave === 'string' ? JSON.parse(taillesToSave) : taillesToSave;
        if (Array.isArray(tailles)) {
          totalStock = tailles.reduce((total, t) => total + (parseInt(t.stock) || 0), 0);
        }
      } catch (e) {
        console.error('❌ Erreur parsing tailles:', e);
        tailles = existingJewel.tailles || [];
        totalStock = existingJewel.stock || 0;
      }
    } else {
      tailles = existingJewel.tailles || [];
      totalStock = existingJewel.stock || 0;
    }

    // Préparer les données pour la mise à jour
    const updateData = {
      name,
      slug: newSlug,
      description: description || null,
      poids: poids ? parseFloat(poids) : null,
      matiere: material.name,
      type_id: type_id || null,
      carat: carat ? parseInt(carat) : null,
      price_ttc: parseFloat(price_ttc),
      tva: tvaRate,
      price_ht: Math.round(price_ht * 100) / 100,
      tailles: tailles,
      stock: totalStock,
      category_id: category.id,
      image: finalMainImage,
      is_featured: is_featured === '1' || is_featured === 1 || is_featured === true,
      is_active: is_active === '1' || is_active === 1 || is_active === true,
      updated_at: new Date()
    };

    console.log('📋 Données finales pour mise à jour:', {
      ...updateData,
      image: updateData.image ? 'Image définie' : 'Pas d\'image'
    });

    // Mettre à jour le bijou
    await existingJewel.update(updateData);
    console.log('✅ Bijou mis à jour avec succès');

    // Redirection avec message de succès
    req.session.flash = {
      type: 'success',
      message: 'Bijou mis à jour avec succès'
    };
    
    res.redirect(`/admin/bijoux/${updateData.slug}/edit`);

  } catch (error) {
    console.error('❌ ERREUR DANS updateJewel:', error);
    console.error('📍 Stack trace:', error.stack);

    // Redirection avec message d'erreur
    req.session.flash = {
      type: 'error',
      message: `Erreur : ${error.message}`
    };
    
    res.redirect(`/admin/bijoux/${slug}/edit`);
  }
},

// Fonction showEditJewel corrigée
async showEditJewel(req, res) {
  console.log('🚀 === DEBUT showEditJewel ===');
  console.log('🆔 Slug:', req.params.slug);
  
  try {
    // Récupérer le bijou avec ses images
    const jewel = await Jewel.findOne({
      where: { slug: req.params.slug },
      include: [
        {
          model: JewelImage,
          as: 'additionalImages',
          required: false
        },
        {
          model: Category,
          as: 'category',
          required: false
        },
        {
          model: Type,
          as: 'type',
          required: false
        }
      ]
    });

    if (!jewel) {
      console.log('❌ Bijou non trouvé');
      return res.status(404).render('error', {
        title: 'Bijou non trouvé',
        message: 'Le bijou demandé n\'existe pas.',
        statusCode: 404,
        user: req.session?.user || null
      });
    }

    console.log('✅ Bijou trouvé:', {
      name: jewel.name,
      image_principale: jewel.image || 'Aucune',
      images_additionnelles: jewel.additionalImages ? jewel.additionalImages.length : 0
    });

    // Récupérer les données pour les selects
    const [categories, materials, types] = await Promise.all([
      Category.findAll({ order: [['name', 'ASC']] }),
      Material.findAll({ order: [['name', 'ASC']] }),
      Type.findAll({ 
        include: [{ model: Category, as: 'category' }],
        order: [['name', 'ASC']]
      })
    ]);

    // Préparer les tailles
    let tailles = [];
    if (jewel.tailles) {
      if (Array.isArray(jewel.tailles)) {
        tailles = jewel.tailles;
      } else if (typeof jewel.tailles === 'string') {
        try {
          tailles = JSON.parse(jewel.tailles);
        } catch (e) {
          console.error('❌ Erreur parsing tailles:', e);
          tailles = [];
        }
      }
    }
    
    if (tailles.length === 0) {
      tailles = [{ taille: '', stock: jewel.stock || 0 }];
    }

    // Préparer les données finales
    const jewelData = {
      ...jewel.toJSON(),
      tailles,
      additionalImages: jewel.additionalImages || []
    };

    console.log('✅ Rendu de la page d\'édition');

    res.render('edit-jewel', {
      title: 'Modifier un bijou',
      jewel: jewelData,
      categories: categories || [],
      materials: materials || [],
      types: types || [],
      error: null,
      success: null,
      user: req.session?.user || null
    });

  } catch (error) {
    console.error('❌ ERREUR dans showEditJewel:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      message: "Erreur lors du chargement de la page de modification",
      statusCode: 500,
      user: req.session?.user || null
    });
  }
},

// Fonction pour afficher la page de modification
async showEditJewel(req, res) {
  console.log('🚀 === DEBUT showEditJewel DEBUG ===');
  console.log('🆔 Slug du bijou:', req.params.slug);
  
  try {
    // Récupérer le bijou avec ses images - VERSION DEBUG
    console.log('🔍 Requête Sequelize en cours...');
    
    const jewel = await Jewel.findOne({
      where: { slug: req.params.slug },
      include: [
        {
          model: JewelImage,
          as: 'additionalImages',
          required: false,
          attributes: ['id', 'image_url', 'jewel_id'] // Spécifier les attributs
        },
        {
          model: Category,
          as: 'category',
          required: false
        },
        {
          model: Type,
          as: 'type',
          required: false
        }
      ]
    });

    if (!jewel) {
      console.log('❌ Bijou non trouvé');
      return res.status(404).render('error', {
        title: 'Bijou non trouvé',
        message: 'Le bijou demandé n\'existe pas.',
        statusCode: 404,
        user: req.session?.user || null
      });
    }

    console.log('✅ Bijou trouvé - ANALYSE DÉTAILLÉE:');
    console.log('📋 Bijou brut:', {
      id: jewel.id,
      name: jewel.name,
      slug: jewel.slug,
      image: jewel.image
    });

    // Convertir en JSON pour analyse
    const jewelJSON = jewel.toJSON();
    console.log('📋 Bijou JSON keys:', Object.keys(jewelJSON));
    
    // Analyse spécifique des images
    console.log('🖼️ ANALYSE DES IMAGES:');
    console.log('  - Image principale (jewel.image):', jewel.image || 'VIDE');
    console.log('  - Images additionnelles (jewel.additionalImages):');
    
    if (jewel.additionalImages) {
      console.log('    Type:', Array.isArray(jewel.additionalImages) ? 'Array' : typeof jewel.additionalImages);
      console.log('    Longueur:', jewel.additionalImages.length);
      
      if (Array.isArray(jewel.additionalImages) && jewel.additionalImages.length > 0) {
        jewel.additionalImages.forEach((img, index) => {
          console.log(`    Image ${index + 1}:`, {
            id: img.id,
            image_url: img.image_url,
            jewel_id: img.jewel_id
          });
        });
      } else {
        console.log('    Aucune image additionnelle trouvée');
      }
    } else {
      console.log('    additionalImages est null/undefined');
    }

    // Test direct en base de données
    console.log('🔍 Test direct BDD pour jewel_id:', jewel.id);
    const directImages = await JewelImage.findAll({
      where: { jewel_id: jewel.id },
      attributes: ['id', 'image_url', 'jewel_id']
    });
    
    console.log('📊 Images trouvées directement en BDD:', directImages.length);
    directImages.forEach((img, index) => {
      console.log(`  Direct ${index + 1}:`, {
        id: img.id,
        image_url: img.image_url,
        jewel_id: img.jewel_id
      });
    });

    // Récupérer les autres données
    const [categories, materials, types] = await Promise.all([
      Category.findAll({ order: [['name', 'ASC']] }),
      Material.findAll({ order: [['name', 'ASC']] }),
      Type.findAll({ 
        include: [{ 
          model: Category, 
          as: 'category',
          attributes: ['id', 'name']
        }],
        order: [['name', 'ASC']]
      })
    ]);

    // Préparer les tailles
    let tailles = [];
    if (jewel.tailles) {
      if (Array.isArray(jewel.tailles)) {
        tailles = jewel.tailles;
      } else if (typeof jewel.tailles === 'string') {
        try {
          tailles = JSON.parse(jewel.tailles);
        } catch (e) {
          console.error('❌ Erreur parsing tailles:', e);
          tailles = [];
        }
      }
    }
    
    if (tailles.length === 0) {
      tailles = [{ taille: '', stock: jewel.stock || 0 }];
    }

    // Préparer les données finales pour la vue
    const finalJewelData = {
      ...jewelJSON,
      tailles,
      // Utiliser les images directes de la BDD si l'association ne fonctionne pas
      additionalImages: jewel.additionalImages && jewel.additionalImages.length > 0 
        ? jewel.additionalImages 
        : directImages
    };

    console.log('✅ Données finales préparées:');
    console.log('  - Image principale:', finalJewelData.image || 'AUCUNE');
    console.log('  - Images additionnelles:', finalJewelData.additionalImages ? finalJewelData.additionalImages.length : 0);

    res.render('edit-jewel', {
      title: 'Modifier un bijou',
      jewel: finalJewelData,
      categories: categories || [],
      materials: materials || [],
      types: types || [],
      error: null,
      success: null,
      user: req.session?.user || null
    });

  } catch (error) {
    console.error('❌ ERREUR DANS showEditJewel:', error);
    console.error('📍 Stack trace:', error.stack);

    res.status(500).render('error', {
      title: 'Erreur',
      message: "Une erreur est survenue lors du chargement de la page de modification.",
      statusCode: 500,
      user: req.session?.user || null
    });
  }
},

  /**
   * Affiche le formulaire d'édition d'un bijou
   */
  async editJewelForm(req, res) {
    try {
      const { slug } = req.params;
      
      const jewel = await Jewel.findOne({
        where: { slug },
        include: [
          {
            model: JewelImage, 
            as: 'additionalImages',
            required: false
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          },
          {
            model: Type,
            as: 'type',
            attributes: ['id', 'name'],
            required: false
          }
        ]
      });
      
      if (!jewel) {
        return res.status(404).render('error', {
  title: 'Bijou non trouvé',
  message: 'Le bijou demandé n\'existe pas.',
  statusCode: 404,
  user: req.session?.user || null
});
      }
      
      const [categories, materials, types] = await Promise.all([
        Category.findAll({ order: [['name', 'ASC']] }),
        Material.findAll({ order: [['name', 'ASC']] }),
        Type.findAll({ 
          include: [{ 
            model: Category, 
            as: 'category',
            attributes: ['id', 'name']
          }],
          order: [['name', 'ASC']]
        })
      ]);
      
      res.render('edit-jewel', {
        title: `Modifier ${jewel.name}`,
        jewel,
        categories,
        materials,
        types
      });
    } catch (error) {
      console.error("Erreur lors du chargement du formulaire d'édition:", error);
      return res.status(500).render('error', {
  title: 'Erreur serveur',
  message: 'Une erreur est survenue lors de la modification.',
  statusCode: 500,
  user: req.session?.user || null
});
    }
  },

// À ajouter dans votre jewelControlleur.js

/**
 * 📝 AFFICHE LE FORMULAIRE D'ÉDITION D'UN BIJOU
 */
async editJewelForm(req, res) {
  try {
    const { slug } = req.params;
    
    console.log('📝 Chargement formulaire édition pour:', slug);
    
    // Récupérer le bijou avec toutes ses données
    const jewel = await Jewel.findOne({
      where: { slug },
      include: [
        {
          model: JewelImage, 
          as: 'additionalImages',
          required: false
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        },
        {
          model: Type,
          as: 'type',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });
    
    if (!jewel) {
      return res.status(404).render('error', {
  title: 'Bijou non trouvé',
  message: 'Le bijou demandé n\'existe pas.',
  statusCode: 404,
  user: req.session?.user || null
});
    }
    
    // Récupérer toutes les données pour les selects
    const [categories, materials, types] = await Promise.all([
      Category.findAll({ order: [['name', 'ASC']] }),
      Material.findAll({ order: [['name', 'ASC']] }),
      Type.findAll({ 
        include: [{ 
          model: Category, 
          as: 'category',
          attributes: ['id', 'name']
        }],
        order: [['name', 'ASC']]
      })
    ]);
    
    console.log('✅ Données récupérées:', {
      bijou: jewel.name,
      categories: categories.length,
      materials: materials.length,
      types: types.length,
      images: jewel.additionalImages?.length || 0
    });
    
    res.render('edit-jewel', {
      title: `Modifier ${jewel.name}`,
      jewel,
      categories: categories || [],
      materials: materials || [],
      types: types || [],
      user: req.session?.user || null,
      error: null,
      success: null
    });
    
  } catch (error) {
    console.error("❌ Erreur chargement formulaire édition:", error);
    return res.status(500).render('error', {
  title: 'Erreur serveur',
  message: 'Une erreur est survenue lors de la modification.',
  statusCode: 500,
  user: req.session?.user || null
});
  }
},



/**
 * 💰 MET À JOUR LA RÉDUCTION D'UN BIJOU
 */
async updateDiscount(req, res) {
  try {
    const { slug } = req.params;
    const { discount_percentage, discount_start_date, discount_end_date } = req.body;
    
    console.log('💰 Mise à jour réduction pour:', slug);
    console.log('📊 Données reçues:', { discount_percentage, discount_start_date, discount_end_date });

    // Validation
    const discountPercent = parseFloat(discount_percentage) || 0;
    if (discountPercent < 0 || discountPercent > 90) {
      return res.status(400).json({
        success: false,
        message: 'Le pourcentage de réduction doit être entre 0 et 90'
      });
    }

    // Validation des dates
    if (discount_start_date && discount_end_date) {
      if (new Date(discount_end_date) <= new Date(discount_start_date)) {
        return res.status(400).json({
          success: false,
          message: 'La date de fin doit être postérieure à la date de début'
        });
      }
    }

    // Trouver le bijou
    const jewel = await Jewel.findOne({ where: { slug } });
    
    if (!jewel) {
      return res.status(404).render('error', {
  title: 'Bijou non trouvé',
  message: 'Le bijou demandé n\'existe pas.',
  statusCode: 404,
  user: req.session?.user || null
});
    }

    // Mettre à jour la réduction
    await jewel.update({
      discount_percentage: discountPercent,
      discount_start_date: discount_start_date || null,
      discount_end_date: discount_end_date || null
    });

    console.log('✅ Réduction mise à jour avec succès');

    res.json({
      success: true,
      message: 'Réduction mise à jour avec succès',
      jewel: {
        id: jewel.id,
        name: jewel.name,
        slug: jewel.slug,
        discount_percentage: jewel.discount_percentage,
        discount_start_date: jewel.discount_start_date,
        discount_end_date: jewel.discount_end_date
      }
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour réduction:', error);
    return res.status(500).render('error', {
  title: 'Erreur serveur',
  message: 'Une erreur est survenue lors de la modification.',
  statusCode: 500,
  user: req.session?.user || null
});
  }
},

/**
 * 🗑️ SUPPRIME UN BIJOU
 */
async deleteJewel(req, res) {
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
      return res.status(404).render('error', {
  title: 'Bijou non trouvé',
  message: 'Le bijou demandé n\'existe pas.',
  statusCode: 404,
  user: req.session?.user || null
});
    }

    // Supprimer les fichiers images du disque
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'jewels');
    
    // Supprimer l'image principale
    if (jewel.image) {
      const imagePath = path.join(uploadDir, jewel.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Supprimer les images additionnelles
    if (jewel.additionalImages && jewel.additionalImages.length > 0) {
      jewel.additionalImages.forEach(img => {
        const imagePath = path.join(uploadDir, img.image_url);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
    }
    
    // Supprimer le bijou de la base de données
    await jewel.destroy();
    
    console.log('✅ Bijou supprimé avec succès');
    
    res.json({
      success: true,
      message: 'Bijou supprimé avec succès'
    });

  } catch (error) {
    console.error("❌ Erreur suppression bijou:", error);
    return res.status(500).render('error', {
  title: 'Erreur serveur',
  message: 'Une erreur est survenue lors de la modification.',
  statusCode: 500,
  user: req.session?.user || null
});
  }
},


  // ==========================================
  // FONCTIONS UTILITAIRES ET DEBUG
  // ==========================================

  /**
   * Teste les associations pour vérifier qu'elles fonctionnent
   */
  async testAssociations(req, res) {
    try {
      console.log('🧪 Test des associations...');
      
      // Lister les associations disponibles
      console.log('📋 Associations Jewel:', Object.keys(Jewel.associations || {}));
      console.log('📋 Associations Category:', Object.keys(Category.associations || {}));
      console.log('📋 Associations Type:', Object.keys(Type.associations || {}));
      console.log('📋 Associations JewelImage:', Object.keys(JewelImage.associations || {}));

      // Test de requête simple
      const testJewel = await Jewel.findOne({
        include: [
          { model: Category, as: 'category' },
          { model: Type, as: 'type', required: false },
          { model: JewelImage, as: 'additionalImages', required: false }
        ],
        limit: 1
      });

      if (testJewel) {
        console.log('✅ Test de requête avec associations réussi');
        console.log(`Bijou: ${testJewel.name}`);
        console.log(`Catégorie: ${testJewel.category?.name || 'N/A'}`);
        console.log(`Type: ${testJewel.type?.name || 'N/A'}`);
        console.log(`Images: ${testJewel.additionalImages?.length || 0}`);
        
        res.json({
          success: true,
          message: 'Toutes les associations fonctionnent',
          data: {
            jewelName: testJewel.name,
            categoryName: testJewel.category?.name,
            typeName: testJewel.type?.name,
            imagesCount: testJewel.additionalImages?.length || 0
          }
        });
      } else {
        console.log('⚠️ Aucun bijou trouvé pour le test');
        res.json({
          success: false,
          message: 'Aucun bijou trouvé pour tester les associations'
        });
      }

    } catch (error) {
      console.error('❌ Erreur dans le test des associations:', error);
      return res.status(500).render('error', {
  title: 'Erreur serveur',
  message: 'Une erreur est survenue lors de la modification.',
  statusCode: 500,
  user: req.session?.user || null
});
    }
  },


  /**
   * Recherche de bijoux
   */
  async searchJewels(req, res) {
    try {
      const { q, category, minPrice, maxPrice, sort } = req.query;
      
      let whereClause = {};
      let orderClause = [['created_at', 'DESC']];

      // Recherche par nom
      if (q && q.trim()) {
        whereClause.name = {
          [Op.iLike]: `%${q.trim()}%`
        };
      }

      // Filtrer par catégorie
      if (category && !isNaN(parseInt(category))) {
        whereClause.category_id = parseInt(category);
      }

      // Filtrer par prix
      if (minPrice && !isNaN(parseFloat(minPrice))) {
        whereClause.price_ttc = {
          ...whereClause.price_ttc,
          [Op.gte]: parseFloat(minPrice)
        };
      }

      if (maxPrice && !isNaN(parseFloat(maxPrice))) {
        whereClause.price_ttc = {
          ...whereClause.price_ttc,
          [Op.lte]: parseFloat(maxPrice)
        };
      }

      // Tri
      switch (sort) {
        case 'price_asc':
          orderClause = [['price_ttc', 'ASC']];
          break;
        case 'price_desc':
          orderClause = [['price_ttc', 'DESC']];
          break;
        case 'name_asc':
          orderClause = [['name', 'ASC']];
          break;
        case 'name_desc':
          orderClause = [['name', 'DESC']];
          break;
        case 'popular':
          orderClause = [['popularity_score', 'DESC']];
          break;
        default:
          orderClause = [['created_at', 'DESC']];
      }

      const jewels = await Jewel.findAll({
        where: whereClause,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          },
          {
            model: Type,
            as: 'type',
            attributes: ['id', 'name'],
            required: false
          }
        ],
        order: orderClause,
        limit: 50 // Limiter les résultats
      });

      // Préparer les données pour la vue
      const processedJewels = jewels.map(jewel => ({
        ...jewel.toJSON(),
        formattedPrice: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(jewel.price_ttc),
        image: jewel.image || 'no-image.jpg'
      }));

      // Si c'est une requête AJAX, retourner du JSON
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.json({
          success: true,
          jewels: processedJewels,
          count: processedJewels.length
        });
      } else {
        // Sinon, render la page de résultats
        const categories = await Category.findAll({ order: [['name', 'ASC']] });
        
        res.render('search-results', {
          title: 'Résultats de recherche',
          jewels: processedJewels,
          categories,
          searchParams: { q, category, minPrice, maxPrice, sort },
          resultsCount: processedJewels.length
        });
      }

    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la recherche'
        });
      } else {
        return res.status(500).render('error', {
  title: 'Erreur serveur',
  message: 'Une erreur est survenue lors de la modification.',
  statusCode: 500,
  user: req.session?.user || null
});
      }
    }
  },

  /**
   * API pour obtenir les statistiques des bijoux
   */
  async getJewelStats(req, res) {
    try {
      const stats = await sequelize.query(`
        SELECT 
          c.name as category_name,
          COUNT(j.id) as jewel_count,
          AVG(j.price_ttc) as avg_price,
          SUM(j.stock) as total_stock
        FROM jewel j
        JOIN category c ON j.category_id = c.id
        GROUP BY c.id, c.name
        ORDER BY jewel_count DESC
      `, { 
        type: QueryTypes.SELECT 
      });

      const totalJewels = await Jewel.count();
      const totalCategories = await Category.count();
      const totalTypes = await Type.count();

      res.json({
        success: true,
        stats: {
          totalJewels,
          totalCategories,
          totalTypes,
          byCategory: stats
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  },



// Dans l'objet jewelControlleur, ajoutez ces méthodes :

/**
 * PAGE PRINCIPALE DE GESTION - Version EJS Dynamique CORRIGÉE
 */
async showJewelryManager(req, res) {
  try {
    console.log('🚀 Chargement du gestionnaire de bijoux...');

    // Récupération des paramètres de requête pour les filtres
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    const filters = {
      search: req.query.search || '',
      category: req.query.category || '',
      material: req.query.material || '',
      minPrice: parseFloat(req.query.minPrice) || null,
      maxPrice: parseFloat(req.query.maxPrice) || null,
      sort: req.query.sort || 'newest'
    };

    // Variables par défaut
    let jewels = [];
    let categories = [];
    let materials = [];
    let totalJewels = 0;
    let stats = {
      totalJewels: 0,
      totalValue: '0.00',
      totalStock: 0,
      newJewels: 0,
      onSale: 0
    };

    try {
      // Construction de la requête WHERE pour les filtres
      const whereConditions = {};
      const includeConditions = [];

      // Filtre par recherche
      if (filters.search) {
        whereConditions[Op.or] = [
          { name: { [Op.iLike]: `%${filters.search}%` } },
          { description: { [Op.iLike]: `%${filters.search}%` } },
          { matiere: { [Op.iLike]: `%${filters.search}%` } }
        ];
      }

      // Filtre par prix
      if (filters.minPrice !== null) {
        whereConditions.price_ttc = { ...whereConditions.price_ttc, [Op.gte]: filters.minPrice };
      }
      if (filters.maxPrice !== null) {
        whereConditions.price_ttc = { ...whereConditions.price_ttc, [Op.lte]: filters.maxPrice };
      }

      // Filtre par matériau
      if (filters.material) {
        whereConditions.matiere = filters.material;
      }

      // Configuration du tri
      let orderConfig = [['created_at', 'DESC']]; // Par défaut
      switch (filters.sort) {
        case 'price_asc':
          orderConfig = [['price_ttc', 'ASC']];
          break;
        case 'price_desc':
          orderConfig = [['price_ttc', 'DESC']];
          break;
        case 'name_asc':
          orderConfig = [['name', 'ASC']];
          break;
        case 'popularity':
          orderConfig = [['views', 'DESC'], ['created_at', 'DESC']];
          break;
        case 'newest':
        default:
          orderConfig = [['created_at', 'DESC']];
      }

      // Requête principale pour les bijoux
      const jewelQuery = {
        where: whereConditions,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name'],
            required: false,
            where: filters.category ? { name: filters.category } : undefined
          }
        ],
        limit: limit,
        offset: offset,
        order: orderConfig,
        distinct: true
      };

      // Récupération des bijoux avec pagination
      const { rows: jewelResults, count: totalJewels } = await Jewel.findAndCountAll(jewelQuery);

      // Formatage des bijoux avec calculs corrects
      jewels = jewelResults.map(jewel => {
        const jewelData = jewel.toJSON();
        
        // Calcul correct des réductions
        const originalPrice = parseFloat(jewelData.price_ttc) || 0;
        const discountPercentage = parseFloat(jewelData.discount_percentage) || 0;
        const hasDiscount = discountPercentage > 0;
        
        // Détermination si c'est nouveau (7 derniers jours)
        const isNew = jewelData.created_at && 
                      new Date(jewelData.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        // Calcul du stock et de son statut
        const stock = parseInt(jewelData.stock) || 0;
        let stockStatus = 'out';
        if (stock > 0) {
          stockStatus = stock <= 5 ? 'low' : 'in';
        }

        return {
          ...jewelData,
          isNew,
          hasDiscount,
          stockStatus,
          formattedPrice: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }).format(originalPrice),
          originalPrice: hasDiscount ? (originalPrice / (1 - discountPercentage / 100)) : originalPrice,
          currentPrice: originalPrice
        };
      });

      console.log(`✅ ${jewels.length} bijoux récupérés (total: ${totalJewels})`);

    } catch (jewelError) {
      console.error('❌ Erreur récupération bijoux:', jewelError.message);
      jewels = [];
    }

    try {
      // Récupération des catégories
      categories = await Category.findAll({ 
        order: [['name', 'ASC']],
        attributes: ['id', 'name']
      });
      console.log(`✅ ${categories.length} catégories récupérées`);
    } catch (catError) {
      console.error('❌ Erreur récupération catégories:', catError.message);
      categories = [];
    }

    try {
      // Récupération des matériaux uniques
      const materialResults = await Jewel.findAll({
        attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('matiere')), 'name']],
        where: {
          matiere: { [Op.ne]: null }
        },
        order: [['matiere', 'ASC']],
        raw: true
      });
      
      materials = materialResults.filter(m => m.name).map(m => ({ name: m.name }));
      console.log(`✅ ${materials.length} matériaux récupérés`);
    } catch (matError) {
      console.error('❌ Erreur récupération matériaux:', matError.message);
      materials = [];
    }

    try {
      // Calcul des statistiques globales (non filtrées)
      const allJewels = await Jewel.findAll({
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name'],
            required: false
          }
        ],
        attributes: ['id', 'price_ttc', 'stock', 'discount_percentage', 'created_at']
      });

      let totalValue = 0;
      let totalStock = 0;
      let onSaleCount = 0;
      let newJewelsCount = 0;

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      allJewels.forEach(jewel => {
        const price = parseFloat(jewel.price_ttc) || 0;
        const stock = parseInt(jewel.stock) || 0;
        const discountPercentage = parseFloat(jewel.discount_percentage) || 0;
        const createdAt = new Date(jewel.created_at);

        // Calcul de la valeur totale (prix × stock)
        totalValue += price * stock;
        totalStock += stock;

        // Comptage des promotions
        if (discountPercentage > 0) {
          onSaleCount++;
        }

        // Comptage des nouveaux bijoux
        if (createdAt > weekAgo) {
          newJewelsCount++;
        }
      });

      stats = {
        totalJewels: allJewels.length,
        totalValue: totalValue.toFixed(2),
        totalStock: totalStock,
        newJewels: newJewelsCount,
        onSale: onSaleCount
      };

      console.log('✅ Statistiques calculées:', stats);
    } catch (statsError) {
      console.error('❌ Erreur calcul statistiques:', statsError.message);
    }

    // Configuration de la pagination
    const totalPages = Math.ceil(totalJewels / limit);
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalJewels: totalJewels,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      limit: limit
    };

    console.log('✅ Données préparées pour le rendu');

    // Rendu de la vue EJS
    res.render('gestionnaire-bijoux', {
      title: 'Gestionnaire de Bijoux',
      pageTitle: 'Gestionnaire de Bijoux',
      jewels,
      categories,
      materials,
      stats,
      pagination,
      filters,
      user: req.session?.user || null,
      success: req.flash ? req.flash('success') : [],
      error: req.flash ? req.flash('error') : []
    });

  } catch (error) {
    console.error('❌ Erreur FATALE dans showJewelryManager:', error);
    console.error('Stack trace:', error.stack);
    
    // En cas d'erreur fatale, rendu avec données vides mais fonctionnelles
    const fallbackStats = {
      totalJewels: 0,
      totalValue: '0.00',
      totalStock: 0,
      newJewels: 0,
      onSale: 0
    };

    const fallbackPagination = {
      currentPage: 1,
      totalPages: 1,
      totalJewels: 0,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: 2,
      prevPage: 0,
      limit: 50
    };

    const fallbackFilters = {
      search: '',
      category: '',
      material: '',
      minPrice: null,
      maxPrice: null,
      sort: 'newest'
    };

    res.render('gestionnaire-bijoux', {
      title: 'Gestionnaire de Bijoux - Erreur',
      pageTitle: 'Gestionnaire de Bijoux',
      jewels: [],
      categories: [],
      materials: [],
      stats: fallbackStats,
      pagination: fallbackPagination,
      filters: fallbackFilters,
      user: req.session?.user || null,
      success: [],
      error: [`Erreur de chargement: ${error.message}. Veuillez actualiser la page.`]
    });
  }
},

/**
 * API - Dupliquer un bijou
 */
async duplicateJewel(req, res) {
  try {
    const { id } = req.params;
    
    const originalJewel = await Jewel.findByPk(id);

    if (!originalJewel) {
      return res.status(404).render('error', {
  title: 'Bijou non trouvé',
  message: 'Le bijou demandé n\'existe pas.',
  statusCode: 404,
  user: req.session?.user || null
});
    }

    const newName = `${originalJewel.name} (Copie)`;
    const newSlug = await generateUniqueSlug(newName);

    const duplicatedJewel = await Jewel.create({
      ...originalJewel.toJSON(),
      id: undefined,
      name: newName,
      slug: newSlug,
      image: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: 'Bijou dupliqué avec succès',
      newJewel: {
        id: duplicatedJewel.id,
        name: duplicatedJewel.name,
        slug: duplicatedJewel.slug
      }
    });

  } catch (error) {
    console.error('❌ Erreur lors de la duplication:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la duplication du bijou'
    });
  }
},



/**
 * API - Supprimer un bijou
 */
async deleteJewelAPI(req, res) {
  try {
    const { slug } = req.params;
    
    const jewel = await Jewel.findOne({ where: { slug } });

    if (!jewel) {
      return res.status(404).render('error', {
  title: 'Bijou non trouvé',
  message: 'Le bijou demandé n\'existe pas.',
  statusCode: 404,
  user: req.session?.user || null
});
    }

    await jewel.destroy();

    res.json({
      success: true,
      message: 'Bijou supprimé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du bijou'
    });
  }
},

/**
 * API - Appliquer une réduction en masse
 */
async applyBulkDiscount(req, res) {
  try {
    const { discount } = req.body;

    if (!discount || isNaN(discount) || discount < 0 || discount > 100) {
      return res.status(400).json({
        success: false,
        message: 'Pourcentage de réduction invalide (0-100)'
      });
    }

    const discountPercent = parseFloat(discount);

    const [updatedCount] = await Jewel.update({
      discount: discountPercent
    }, {
      where: {}
    });

    res.json({
      success: true,
      message: `Réduction de ${discountPercent}% appliquée à ${updatedCount} bijoux`,
      updatedCount
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la réduction:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'application de la réduction'
    });
  }
},

/**
 * API - Obtenir les statistiques en temps réel
 */
async getStatsAPI(req, res) {
  try {
    const stats = await calculateJewelryStats();
    
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
},

/**
 * API - Recherche AJAX de bijoux
 */
async searchJewelsAPI(req, res) {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        jewels: []
      });
    }

    const jewels = await Jewel.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${q.trim()}%` } },
          { description: { [Op.iLike]: `%${q.trim()}%` } },
          { matiere: { [Op.iLike]: `%${q.trim()}%` } }
        ]
      },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      limit: parseInt(limit),
      order: [['created_at', 'DESC']]
    });

    const formattedJewels = jewels.map(jewel => ({
      id: jewel.id,
      name: jewel.name,
      slug: jewel.slug,
      price: jewel.price_ttc,
      formattedPrice: new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(jewel.price_ttc),
      category: jewel.category?.name,
      image: jewel.image,
      stock: jewel.stock
    }));

    res.json({
      success: true,
      jewels: formattedJewels
    });

  } catch (error) {
    console.error('❌ Erreur lors de la recherche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche'
    });
  }
},

/**
   * Mettre à jour la réduction d'un bijou (admin)
   */
   async updateDiscount(req, res) {
    try {
      const { slug } = req.params;
      const discountData = req.body;

      const result = await JewelService.updateDiscount(slug, discountData);

      if (!result.success) {
        req.flash('error', result.message);
        return res.redirect(`/bijoux/${slug}`);
      }

      req.flash('success', 'Réduction mise à jour avec succès');
      res.redirect(`/bijoux/${slug}`);

    } catch (error) {
      console.error('Erreur lors de la mise à jour de la réduction:', error);
      req.flash('error', 'Erreur lors de la mise à jour de la réduction');
      res.redirect(`/bijoux/${req.params.slug}`);
    }
},

/**
   * Valider les données d'un bijou
   */
   validateJewelData(data) {
    if (!data.name || !data.name.trim()) {
      return { isValid: false, message: 'Le nom est obligatoire' };
    }

    if (!data.price_ttc || isNaN(parseFloat(data.price_ttc)) || parseFloat(data.price_ttc) <= 0) {
      return { isValid: false, message: 'Le prix doit être un nombre positif' };
    }

    if (!data.category_id || isNaN(parseInt(data.category_id))) {
      return { isValid: false, message: 'La catégorie est obligatoire' };
    }

    if (data.stock && (isNaN(parseInt(data.stock)) || parseInt(data.stock) < 0)) {
      return { isValid: false, message: 'Le stock doit être un nombre positif ou nul' };
    }

    if (data.carat && (isNaN(parseFloat(data.carat)) || parseFloat(data.carat) < 0)) {
      return { isValid: false, message: 'Le carat doit être un nombre positif' };
    }

    if (data.poids && (isNaN(parseFloat(data.poids)) || parseFloat(data.poids) < 0)) {
      return { isValid: false, message: 'Le poids doit être un nombre positif' };
    }

    return { isValid: true };
  },

  /**
   * Nettoyer les données d'un bijou
   */
   sanitizeJewelData(data) {
    return {
      name: data.name.trim(),
      description: data.description ? data.description.trim() : null,
      price_ttc: parseFloat(data.price_ttc),
      stock: data.stock ? parseInt(data.stock) : 0,
      category_id: parseInt(data.category_id),
      type_id: data.type_id ? parseInt(data.type_id) : null,
      matiere: data.matiere ? data.matiere.trim() : null,
      carat: data.carat ? parseFloat(data.carat) : null,
      poids: data.poids ? parseFloat(data.poids) : null,
      taille: data.taille ? data.taille.trim() : null
    };
  },

  /**
   * Valider les données de réduction
   */
 validateDiscountData(data) {
    const percentage = parseFloat(data.discount_percentage);
    
    if (isNaN(percentage) || percentage < 0 || percentage > 90) {
      return { 
        isValid: false, 
        message: 'Le pourcentage de réduction doit être entre 0 et 90' 
      };
    }

    // Validation des dates si fournies
    if (data.discount_start_date && data.discount_end_date) {
      const startDate = new Date(data.discount_start_date);
      const endDate = new Date(data.discount_end_date);
      
      if (endDate <= startDate) {
        return { 
          isValid: false, 
          message: 'La date de fin doit être postérieure à la date de début' 
        };
      }
    }

    return { isValid: true };
  },

  /**
   * Nettoyer les données de réduction
   */
  sanitizeDiscountData(data) {
    const cleanData = {
      discount_percentage: parseFloat(data.discount_percentage) || 0,
      updated_at: new Date()
    };

    if (data.discount_start_date) {
      cleanData.discount_start_date = new Date(data.discount_start_date);
    } else {
      cleanData.discount_start_date = null;
    }

    if (data.discount_end_date) {
      cleanData.discount_end_date = new Date(data.discount_end_date);
    } else {
      cleanData.discount_end_date = null;
    }

    return cleanData;
  },

  /**
 * Met à jour la réduction d'un bijou
 */
async updateDiscount(req, res) {
  try {
    const { slug } = req.params;
    const { discount_percentage, discount_start_date, discount_end_date } = req.body;
    
    console.log('🎯 Mise à jour réduction pour:', slug);
    console.log('📊 Données reçues:', { discount_percentage, discount_start_date, discount_end_date });

    // Validation des données
    const validation = this.validateDiscountData({
      discount_percentage,
      discount_start_date,
      discount_end_date
    });

    if (!validation.isValid) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }
      
      req.flash('error', validation.message);
      return res.redirect(`/bijoux/${slug}`);
    }

    // Trouver le bijou
    const jewel = await Jewel.findOne({ where: { slug } });
    
    if (!jewel) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(404).render('error', {
  title: 'Bijou non trouvé',
  message: 'Le bijou demandé n\'existe pas.',
  statusCode: 404,
  user: req.session?.user || null
});
      }
      
      req.flash('error', 'Bijou non trouvé');
      return res.redirect('/');
    }

    // Nettoyer et préparer les données
    const cleanData = this.sanitizeDiscountData({
      discount_percentage,
      discount_start_date,
      discount_end_date
    });

    // Mettre à jour le bijou
    await jewel.update(cleanData);

    console.log('✅ Réduction mise à jour avec succès');

    // Réponse selon le type de requête
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        success: true,
        message: 'Réduction mise à jour avec succès',
        jewel: {
          id: jewel.id,
          name: jewel.name,
          slug: jewel.slug,
          discount_percentage: jewel.discount_percentage,
          discount_start_date: jewel.discount_start_date,
          discount_end_date: jewel.discount_end_date
        }
      });
    }

    req.flash('success', 'Réduction mise à jour avec succès');
    res.redirect(`/bijoux/${slug}`);

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la réduction:', error);
    
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la réduction'
      });
    }
    
    req.flash('error', 'Erreur lors de la mise à jour de la réduction');
    res.redirect(`/bijoux/${req.params.slug}`);
  }
},

}

