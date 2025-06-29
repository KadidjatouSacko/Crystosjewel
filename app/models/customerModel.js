// models/customerModel.js - Adapté à votre structure PostgreSQL
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";
import { Role } from "./roleModel.js";

export class Customer extends Model {}

Customer.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    first_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    address: {
        type: DataTypes.TEXT,
    },
    phone: {
        type: DataTypes.STRING(255),
    },
   role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
}, isGuest: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_guest'
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_email_verified'
  },
  guestConvertedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'guest_converted_at'
  },
  lastOrderDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_order_date'
  },
  totalOrders: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_orders'
  },
  totalSpent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'total_spent'
  },
  preferredDeliveryMode: {
    type: DataTypes.ENUM('standard', 'express', 'pickup'),
    defaultValue: 'standard',
    field: 'preferred_delivery_mode'
  },
  marketingOptIn: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'marketing_opt_in'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  },

    // Attention: votre table a les DEUX colonnes
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'createdat' // Mapping explicite
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at' // Mapping explicite
    },
    email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    verification_token: {
        type: DataTypes.STRING(255),
    },
    verification_expires: {
        type: DataTypes.DATE,
    },
    reset_password_token: {
        type: DataTypes.STRING(255),
    },
    reset_password_expires: {
        type: DataTypes.DATE,
    },
    email_notifications: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    sequelize,
    tableName: "customer",
    timestamps: false, // Géré manuellement
    underscored: false // Pas de conversion automatique
});



export default Customer;