// app/models/SiteSetting.js
import { DataTypes } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export const SiteSetting = sequelize.define('SiteSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  setting_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  setting_value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  setting_type: {
    type: DataTypes.ENUM('text', 'image', 'json'),
    defaultValue: 'text'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'site_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Ajouter ces paramètres par défaut lors de l'initialisation
export const initializeMaintenanceSettings = async () => {
    try {
        await SiteSetting.findOrCreate({
            where: { key: 'maintenance_mode' },
            defaults: { 
                key: 'maintenance_mode', 
                value: 'false',
                description: 'Mode maintenance du site'
            }
        });

        await SiteSetting.findOrCreate({
            where: { key: 'maintenance_estimated_time' },
            defaults: { 
                key: 'maintenance_estimated_time', 
                value: '',
                description: 'Temps estimé de retour'
            }
        });

        console.log('✅ Paramètres de maintenance initialisés');
    } catch (error) {
        console.error('❌ Erreur initialisation maintenance:', error);
    }
};