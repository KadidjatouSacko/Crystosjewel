// Dans votre fichier de modèle JewelImage.js
import{ Model, DataTypes } from'sequelize';
import { sequelize } from "./sequelize-client.js";


export class JewelImage extends Model {}

JewelImage.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  jewel_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'jewel',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  sequelize,
  modelName: 'JewelImage', // Nom du modèle en PascalCase
  tableName: 'jewel_images',
  timestamps: false
});

