// app/models/HomeImage.js
import { DataTypes } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export const HomeImage = sequelize.define('HomeImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  image_type: {
    type: DataTypes.ENUM('hero', 'category', 'featured'),
    allowNull: false
  },
  image_key: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  image_path: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  alt_text: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'home_images',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['image_type', 'image_key']
    }
  ]
});

