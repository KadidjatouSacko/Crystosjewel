// models/GuestSession.js - Modèle pour tracker les sessions invités
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class GuestSession extends Model {}

GuestSession.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  guest_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  cart_data: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON stringifié du contenu du panier'
  },
  customer_info: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON stringifié des informations client'
  },
  last_activity: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  converted_to_customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'customer',
      key: 'id'
    }
  },
  ip_address: {
    type: DataTypes.INET, // Type PostgreSQL pour les adresses IP
    allowNull: true
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  tableName: "guest_sessions",
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['session_id']
    },
    {
      fields: ['guest_id']
    },
    {
      fields: ['last_activity']
    },
    {
      fields: ['converted_to_customer_id']
    },
    {
      fields: ['email']
    }
  ]
});

export default GuestSession;