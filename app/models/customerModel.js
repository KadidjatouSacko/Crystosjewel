// customerModel.js - MODÈLE COMPLET basé sur votre structure BDD réelle

import { DataTypes } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Informations personnelles
  first_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  
  // Contact
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Rôle et permissions
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 2 // Client standard
  },
  
  // Vérification email (triple stockage dans votre BDD)
  email_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  is_email_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  is_email_verified_new: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  
  // Tokens de vérification
  verification_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  verification_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Reset mot de passe
  reset_password_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reset_password_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Préférences
  email_notifications: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true
  },
  marketing_opt_in: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  preferred_delivery_mode: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'standard'
  },
  
  // Statut invité
  is_guest: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  guest_converted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Statistiques commandes
  last_order_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  total_orders: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  total_spent: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: '0.00'
  },
  
  // Notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Timestamps (double stockage dans votre BDD)
  createdat: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
  
}, {
  tableName: 'customer',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});



export default Customer;