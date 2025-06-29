// scripts/migrate-add-tailles-robust.js
import { sequelize } from '../app/models/sequelize-client.js';
import { DataTypes } from 'sequelize';

async function addTaillesColumn() {
  try {
    console.log('🚀 Début de la migration - Ajout de la colonne tailles...');
    
    // Test de connexion
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données réussie');
    console.log('📊 Type de BDD:', sequelize.getDialect());
    console.log('📋 Nom de la BDD:', sequelize.config.database);
    
    // Méthode plus robuste pour vérifier si la colonne existe
    try {
      const tableDescription = await sequelize.getQueryInterface().describeTable('jewel');
      
      if (tableDescription.tailles) {
        console.log('✅ La colonne "tailles" existe déjà');
        console.log('Type actuel:', tableDescription.tailles.type);
        return;
      }
      
      console.log('📝 La colonne "tailles" n\'existe pas, ajout en cours...');
      
    } catch (describeError) {
      console.log('⚠️  Impossible de décrire la table, tentative d\'ajout direct...');
    }
    
    // Ajouter la colonne tailles
    await sequelize.getQueryInterface().addColumn('jewel', 'tailles', {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Stockage des tailles et stocks en JSON format: [{"taille": "S", "stock": 10}, ...]'
    });
    
    console.log('✅ Colonne "tailles" ajoutée avec succès !');
    
    // Vérifier la nouvelle structure
    const tableInfo = await sequelize.getQueryInterface().describeTable('jewel');
    
    if (tableInfo.tailles) {
      console.log('✅ Migration réussie ! Détails de la nouvelle colonne :');
      console.log('Type:', tableInfo.tailles.type);
      console.log('Nullable:', tableInfo.tailles.allowNull);
      console.log('Commentaire:', tableInfo.tailles.comment || 'Aucun');
    }
    
    console.log('🎉 Migration terminée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    
    // Si c'est une erreur de colonne déjà existante, c'est OK
    if (error.message.includes('Duplicate column name') || 
        error.message.includes('column "tailles" of relation') ||
        error.message.includes('already exists')) {
      console.log('✅ La colonne "tailles" existe déjà (erreur normale)');
      return;
    }
    
    // Afficher des détails supplémentaires pour le debug
    if (error.original) {
      console.error('Erreur SQL:', error.original.message);
      console.error('Code erreur:', error.original.code);
    }
    
    // Suggérer une solution manuelle
    console.log('\n💡 Solution alternative - Exécutez cette requête SQL manuellement :');
    console.log('ALTER TABLE jewel ADD COLUMN tailles JSON NULL;');
    
  } finally {
    try {
      await sequelize.close();
      console.log('🔐 Connexion fermée');
    } catch (closeError) {
      console.error('Erreur lors de la fermeture:', closeError.message);
    }
  }
}

// Exécuter la migration
console.log('='.repeat(50));
console.log('MIGRATION : Ajout de la colonne tailles');
console.log('='.repeat(50));

addTaillesColumn();