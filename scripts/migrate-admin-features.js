// scripts/migrate-admin-features.js - Adapté à votre architecture
import "dotenv/config";
import { sequelize } from '../app/models/sequelize-client.js';
import { Jewel } from '../app/models/jewelModel.js';
import { Category } from '../app/models/categoryModel.js';
import { HomeImage } from '../app/models/HomeImage.js';
import { SiteSetting } from '../app/models/SiteSetting.js';

/**
 * Script de migration pour ajouter les fonctionnalités d'administration
 * À exécuter avec: node scripts/migrate-admin-features.js
 */

async function runMigration() {
  try {
    // console.log('🔄 Début de la migration des fonctionnalités d\'administration...');
    
    // Vérifier la connexion à la base de données
    await sequelize.authenticate();
    // console.log('✅ Connexion à la base de données établie');
    
    // ========================================
    // 1. CRÉER LES NOUVELLES TABLES
    // ========================================
    
    // console.log('📋 Création de la table site_settings...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type ENUM('text', 'image', 'json') DEFAULT 'text',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // console.log('🖼️ Création de la table home_images...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS home_images (
        id INT PRIMARY KEY AUTO_INCREMENT,
        image_type ENUM('hero', 'category', 'featured') NOT NULL,
        image_key VARCHAR(100) NOT NULL,
        image_path VARCHAR(255) NOT NULL,
        alt_text VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_image (image_type, image_key)
      )
    `);
    
    // ========================================
    // 2. MODIFIER LES TABLES EXISTANTES
    // ========================================
    
    // console.log('💎 Ajout des colonnes pour les coups de cœur dans la table jewels...');
    
    // Vérifier si les colonnes existent déjà
    const [jewelColumns] = await sequelize.query("SHOW COLUMNS FROM jewels LIKE 'is_featured'");
    
    if (jewelColumns.length === 0) {
      await sequelize.query('ALTER TABLE jewels ADD COLUMN is_featured BOOLEAN DEFAULT FALSE');
      console.log('✅ Colonne is_featured ajoutée');
    } else {
      console.log('ℹ️ Colonne is_featured existe déjà');
    }
    
    const [orderColumns] = await sequelize.query("SHOW COLUMNS FROM jewels LIKE 'featured_order'");
    
    if (orderColumns.length === 0) {
      await sequelize.query('ALTER TABLE jewels ADD COLUMN featured_order INT NULL');
      console.log('✅ Colonne featured_order ajoutée');
    } else {
      console.log('ℹ️ Colonne featured_order existe déjà');
    }
    
    // Ajouter l'index pour les performances
    try {
      await sequelize.query('ALTER TABLE jewels ADD INDEX idx_featured (is_featured, featured_order)');
      console.log('✅ Index idx_featured ajouté');
    } catch (error) {
      if (error.original && error.original.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️ Index idx_featured existe déjà');
      } else {
        console.log('⚠️ Erreur lors de la création de l\'index:', error.message);
      }
    }
    
    console.log('📂 Ajout de la colonne image dans la table categories...');
    
    const [categoryImageColumns] = await sequelize.query("SHOW COLUMNS FROM categories LIKE 'image'");
    
    if (categoryImageColumns.length === 0) {
      await sequelize.query('ALTER TABLE categories ADD COLUMN image VARCHAR(255)');
      console.log('✅ Colonne image ajoutée à categories');
    } else {
      console.log('ℹ️ Colonne image existe déjà dans categories');
    }
    
    // ========================================
    // 3. INSÉRER LES DONNÉES PAR DÉFAUT
    // ========================================
    
    console.log('🎨 Insertion des paramètres par défaut...');
    
    const defaultSettings = [
      {
        setting_key: 'site_name',
        setting_value: 'CrystosJewel',
        setting_type: 'text',
        description: 'Nom du site'
      },
      {
        setting_key: 'site_description',
        setting_value: 'Bijoux précieux en rose gold',
        setting_type: 'text',
        description: 'Description du site'
      },
      {
        setting_key: 'max_featured_jewels',
        setting_value: '4',
        setting_type: 'text',
        description: 'Nombre maximum de coups de cœur'
      }
    ];
    
    for (const setting of defaultSettings) {
      try {
        await sequelize.query(`
          INSERT IGNORE INTO site_settings (setting_key, setting_value, setting_type, description)
          VALUES (?, ?, ?, ?)
        `, {
          replacements: [setting.setting_key, setting.setting_value, setting.setting_type, setting.description]
        });
        console.log(`✅ Paramètre ${setting.setting_key} ajouté`);
      } catch (error) {
        console.log(`ℹ️ Paramètre ${setting.setting_key} existe déjà`);
      }
    }
    
    console.log('🖼️ Insertion des images par défaut...');
    
    const defaultImages = [
      { image_type: 'category', image_key: 'bracelet', image_path: '/images/categories/bracelet-default.jpg', alt_text: 'Bracelets' },
      { image_type: 'category', image_key: 'collier', image_path: '/images/categories/collier-default.jpg', alt_text: 'Colliers' },
      { image_type: 'category', image_key: 'bague', image_path: '/images/categories/bague-default.jpg', alt_text: 'Bagues' },
      { image_type: 'category', image_key: 'promo', image_path: '/images/categories/promo-default.jpg', alt_text: 'Promotions' }
    ];
    
    for (const image of defaultImages) {
      try {
        await sequelize.query(`
          INSERT IGNORE INTO home_images (image_type, image_key, image_path, alt_text)
          VALUES (?, ?, ?, ?)
        `, {
          replacements: [image.image_type, image.image_key, image.image_path, image.alt_text]
        });
        console.log(`✅ Image par défaut ${image.image_key} ajoutée`);
      } catch (error) {
        console.log(`ℹ️ Image par défaut ${image.image_key} existe déjà`);
      }
    }
    
    // ========================================
    // 4. CRÉER LES DOSSIERS NÉCESSAIRES
    // ========================================
    
    console.log('📁 Création des dossiers d\'upload...');
    
    const fs = await import('fs');
    const path = await import('path');
    
    const directories = [
      'public/images/home',
      'public/images/categories',
      'public/uploads/jewels'
    ];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Dossier ${dir} créé`);
      } else {
        console.log(`ℹ️ Dossier ${dir} existe déjà`);
      }
    });
    
    // ========================================
    // 5. SYNCHRONISER LES MODÈLES
    // ========================================
    
    console.log('🔄 Synchronisation des modèles...');
    
    await HomeImage.sync({ alter: true });
    await SiteSetting.sync({ alter: true });
    
    console.log('✅ Modèles synchronisés');
    
    // ========================================
    // 6. VÉRIFICATIONS FINALES
    // ========================================
    
    console.log('🔍 Vérifications finales...');
    
    // Vérifier les tables
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'home_images'");
    console.log(`ℹ️ Table home_images: ${tables.length > 0 ? 'OK' : 'MANQUANTE'}`);
    
    const [settingsTables] = await sequelize.query("SHOW TABLES LIKE 'site_settings'");
    console.log(`ℹ️ Table site_settings: ${settingsTables.length > 0 ? 'OK' : 'MANQUANTE'}`);
    
    // Vérifier les colonnes
    const [featuredColumns] = await sequelize.query("SHOW COLUMNS FROM jewels LIKE 'is_featured'");
    console.log(`ℹ️ Colonne is_featured: ${featuredColumns.length > 0 ? 'OK' : 'MANQUANTE'}`);
    
    // Compter les données
    const homeImagesCount = await HomeImage.count();
    const settingsCount = await SiteSetting.count();
    
    console.log(`ℹ️ Images de la page d'accueil: ${homeImagesCount}`);
    console.log(`ℹ️ Paramètres du site: ${settingsCount}`);
    
    console.log('\n🎉 Migration terminée avec succès !');
    console.log('\n📋 Résumé des fonctionnalités ajoutées:');
    console.log('   ✅ Gestion des coups de cœur');
    console.log('   ✅ Upload d\'images pour la page d\'accueil');
    console.log('   ✅ Paramètres de site configurables');
    console.log('   ✅ Interface d\'administration intégrée');
    
    console.log('\n🔧 Prochaines étapes:');
    console.log('   1. Redémarrer votre serveur');
    console.log('   2. Vous connecter en tant qu\'administrateur');
    console.log('   3. Tester les fonctionnalités sur la page d\'accueil');
    console.log('   4. Ajouter les imports dans votre associations.js');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  }
}

// ========================================
// FONCTION DE ROLLBACK (optionnelle)
// ========================================

async function rollbackMigration() {
  try {
    console.log('🔄 Début du rollback...');
    
    // Supprimer les colonnes ajoutées
    console.log('🗑️ Suppression des colonnes...');
    
    try {
      await sequelize.query('ALTER TABLE jewels DROP COLUMN is_featured');
      await sequelize.query('ALTER TABLE jewels DROP COLUMN featured_order');
      await sequelize.query('ALTER TABLE categories DROP COLUMN image');
      console.log('✅ Colonnes supprimées');
    } catch (error) {
      console.log('⚠️ Erreur lors de la suppression des colonnes:', error.message);
    }
    
    // Supprimer les tables
    console.log('🗑️ Suppression des tables...');
    
    await sequelize.query('DROP TABLE IF EXISTS home_images');
    await sequelize.query('DROP TABLE IF EXISTS site_settings');
    
    console.log('✅ Rollback terminé');
    
  } catch (error) {
    console.error('❌ Erreur lors du rollback:', error);
    throw error;
  }
}

// ========================================
// EXÉCUTION DU SCRIPT
// ========================================

async function main() {
  try {
    // Exécuter la migration
    const args = process.argv.slice(2);
    
    if (args.includes('--rollback')) {
      await rollbackMigration();
    } else {
      await runMigration();
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔒 Connexion à la base de données fermée');
  }
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runMigration, rollbackMigration };