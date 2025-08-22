import { sequelize } from '../app/models/sequelize-client.js';

async function addClientFields() {
  try {
    console.log('🔧 Ajout des champs newsletter et notes...');
    
    // Ajouter le champ newsletter
    try {
      await sequelize.query(`
        ALTER TABLE customers 
        ADD COLUMN newsletter BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Champ newsletter ajouté');
    } catch (error) {
      if (!error.message.includes('Duplicate column')) {
        console.log('⚠️ Champ newsletter existe déjà');
      }
    }
    
    // Ajouter le champ notes
    try {
      await sequelize.query(`
        ALTER TABLE customers 
        ADD COLUMN notes TEXT DEFAULT ''
      `);
      console.log('✅ Champ notes ajouté');
    } catch (error) {
      if (!error.message.includes('Duplicate column')) {
        console.log('⚠️ Champ notes existe déjà');
      }
    }
    
    console.log('🎉 Migration terminée');
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addClientFields();