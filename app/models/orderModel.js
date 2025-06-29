// models/orderModel.js - Version mise à jour avec codes promo
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class Order extends Model {}

Order.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  numero_commande: {
    type: DataTypes.STRING,
  },
  numero_suivi: {
    type: DataTypes.STRING,
  },
  transporteur: {
    type: DataTypes.STRING,
  },
  status_suivi: {
    type: DataTypes.STRING,
  },
  date_livraison_prevue: {
    type: DataTypes.DATEONLY,
  },
  url_suivi_transporteur: {
    type: DataTypes.STRING,
  },
  total: {
    type: DataTypes.FLOAT,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  shipping_method: DataTypes.STRING(50),
  tracking_number: DataTypes.STRING(100),
  tracking_url: DataTypes.TEXT,
  estimated_delivery_date: DataTypes.DATE,
  shipping_date: DataTypes.DATE,
  shipping_address: DataTypes.TEXT,
  shipping_city: DataTypes.STRING(100),
  shipping_postal_code: DataTypes.STRING(20),
  shipping_country: DataTypes.STRING(50),
  shipping_phone: DataTypes.STRING(20),
  shipping_price: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0.00,
  },
  tax_amount: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0.00,
  },
  subtotal: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0.00,
  },
  carrier: DataTypes.STRING(50),
  
  // 🎫 NOUVEAUX CHAMPS POUR LES CODES PROMO
  promo_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Code promo appliqué à cette commande'
  },
  promo_discount_percent: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Pourcentage de réduction appliqué'
  },
  promo_discount_amount: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Montant de la réduction en euros'
  },
  
  // Champs additionnels pour le suivi des commandes
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  customer_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('en_attente', 'confirmee', 'en_preparation', 'expediee', 'livree', 'annulee'),
    defaultValue: 'en_attente'
  },
  shipping_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Order',
  tableName: 'orders',
  timestamps: true,
  updatedAt: 'updated_at'
});

// Méthodes d'instance pour les calculs
Order.prototype.calculateTotalsWithPromo = function() {
  const subtotal = parseFloat(this.subtotal) || 0;
  const discountAmount = parseFloat(this.promo_discount_amount) || 0;
  const shippingPrice = parseFloat(this.shipping_price) || 0;
  
  return {
    subtotal,
    discountAmount,
    discountedSubtotal: subtotal - discountAmount,
    shippingPrice,
    total: subtotal - discountAmount + shippingPrice
  };
};

Order.prototype.getFormattedStatus = function() {
  const statusMap = {
    'en_attente': 'En attente',
    'confirmee': 'Confirmée',
    'en_preparation': 'En préparation',
    'expediee': 'Expédiée',
    'livree': 'Livrée',
    'annulee': 'Annulée'
  };
  
  return statusMap[this.status] || this.status;
};

Order.prototype.hasPromoCode = function() {
  return !!(this.promo_code && this.promo_discount_amount > 0);
};