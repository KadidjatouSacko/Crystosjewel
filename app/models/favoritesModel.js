// models/Favorite.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

import { Customer } from "./customerModel.js";
import { Jewel } from "./jewelModel.js";

export class Favorite extends Model {}

Favorite.init({
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true, // Définit cette colonne comme partie de la clé primaire composite
    references: {
      model: Customer,
      key: 'id'
    }
  },
  jewel_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true, // Définit cette colonne comme partie de la clé primaire composite
    references: {
      model: Jewel,
      key: 'id'
    }
  },
  added_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Favorite',
  tableName: 'favorites',
  timestamps: false,
});





