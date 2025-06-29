// models/cartModel.js - Version corrigée avec colonne size

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class Cart extends Model {}

Cart.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'customer_id',
      references: {
        model: 'customer',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    jewel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'jewel_id',
      references: {
        model: 'jewel',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
      },
    },
    // ✅ NOUVELLE COLONNE SIZE
    size: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'size',
      comment: 'Taille sélectionnée pour ce bijou'
    },
    added_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'added_at',
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    modelName: 'Cart',
    tableName: 'cart',
    timestamps: false,
    
    // ✅ Index modifié pour inclure la taille
    indexes: [
      {
        // ❌ SUPPRIMER l'ancien index unique qui pose problème
        // unique: true,
        // fields: ['customer_id', 'jewel_id'],
        // name: 'unique_customer_jewel'
        
        // ✅ NOUVEAU: permettre même bijou avec tailles différentes
        fields: ['customer_id', 'jewel_id', 'size'],
        name: 'idx_cart_customer_jewel_size'
      },
      {
        fields: ['customer_id'],
        name: 'idx_cart_customer_id'
      },
      {
        fields: ['jewel_id'],
        name: 'idx_cart_jewel_id'
      }
    ],
    
    hooks: {
      beforeUpdate: (cart) => {
        cart.updated_at = new Date();
      },
      beforeBulkUpdate: (options) => {
        options.attributes.updated_at = new Date();
      },
    },
    
    instanceMethods: {
      getTotalPrice() {
        if (this.Jewel && this.Jewel.price_ttc) {
          return this.quantity * this.Jewel.price_ttc;
        }
        return 0;
      },
    },
  }
);

// Méthodes statiques corrigées
Cart.getFullCart = async function(customerId) {
  return await this.findAll({
    where: { customer_id: customerId },
    include: [{
      model: sequelize.models.Jewel,
      include: [{
        model: sequelize.models.JewelImage,
        as: 'additionalImages',
        limit: 1
      }]
    }],
    order: [['added_at', 'DESC']]
  });
};

Cart.getCartTotal = async function(customerId) {
  const cartItems = await this.getFullCart(customerId);
  return cartItems.reduce((total, item) => {
    return total + (item.quantity * (item.Jewel?.price_ttc || 0));
  }, 0);
};

Cart.getCartItemCount = async function(customerId) {
  const cartItems = await this.findAll({
    where: { customer_id: customerId }
  });
  return cartItems.reduce((total, item) => total + item.quantity, 0);
};