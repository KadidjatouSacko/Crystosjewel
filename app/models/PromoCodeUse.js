// models/PromoCodeUse.js - Modèle pour tracker l'usage des codes promo
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class PromoCodeUse extends Model {}

PromoCodeUse.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  promo_code_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'promo_codes',
      key: 'id'
    }
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id'
    }
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // NULL pour les invités
    references: {
      model: 'customer',
      key: 'id'
    }
  },
  guest_session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  discount_applied: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  tableName: "promo_code_uses",
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['promo_code_id', 'order_id']
    },
    {
      fields: ['customer_id']
    },
    {
      fields: ['guest_session_id']
    },
    {
      fields: ['used_at']
    }
  ]
});

export default PromoCodeUse;