// app/models/orderItem.js - Version corrigée
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class OrderItem extends Model {}

OrderItem.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  jewel_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  // ✅ AJOUTER les colonnes manquantes
  size: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Taille du bijou commandé'
  },
  jewel_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nom du bijou au moment de la commande'
  },
  jewel_image: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Image du bijou au moment de la commande'
  }
}, {
  sequelize,
  modelName: 'OrderItem',
  tableName: 'order_items',
  timestamps: false,
  
  // ✅ Hooks pour remplir automatiquement les données
  hooks: {
    beforeCreate: async (orderItem, options) => {
      // Si jewel_name ou jewel_image manquent, les récupérer
      if (orderItem.jewel_id && (!orderItem.jewel_name || !orderItem.jewel_image)) {
        const { Jewel } = await import('./jewelModel.js');
        const jewel = await Jewel.findByPk(orderItem.jewel_id);
        if (jewel) {
          orderItem.jewel_name = orderItem.jewel_name || jewel.name;
          orderItem.jewel_image = orderItem.jewel_image || jewel.image;
        }
      }
    }
  }
});