// models/customerModel.js - Version corrigée pour les invités
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
        allowNull: true, // ✅ CHANGÉ: Permettre null pour les invités
        validate: {
            // ✅ VALIDATION CONDITIONNELLE: obligatoire seulement si pas invité
            isValidPassword(value) {
                if (!this.is_guest && !value) {
                    throw new Error('Le mot de passe est obligatoire pour les comptes normaux');
                }
            }
        }
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
    },
    
    // ✅ CHAMPS INVITÉS CORRIGÉS
    is_guest: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_guest'
    },
    
    // ✅ CHAMPS EMAIL VERIFICATION - uniformisés
    is_email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_email_verified'
    },
    // Support de l'ancien champ si nécessaire
    email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'email_verified'
    },
    
    // ✅ AUTRES CHAMPS INVITÉS
    guest_converted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'guest_converted_at'
    },
    last_order_date: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_order_date'
    },
    total_orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'total_orders'
    },
    total_spent: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        field: 'total_spent'
    },
    preferred_delivery_mode: {
        type: DataTypes.ENUM('standard', 'express', 'pickup'),
        defaultValue: 'standard',
        field: 'preferred_delivery_mode'
    },
    marketing_opt_in: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'marketing_opt_in'
    },
    email_notifications: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'email_notifications'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    
    // ✅ CHAMPS DE VERIFICATION
    verification_token: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    verification_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reset_password_token: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    reset_password_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    
    // ✅ CHAMPS TIMESTAMPS - gestion des doublons
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    },
    // Support de l'ancien champ createdat si nécessaire
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'createdat'
    }
    
}, {
    sequelize,
    tableName: "customer",
    timestamps: true, // ✅ Activer pour updated_at automatique
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: false,
    
    // ✅ HOOKS POUR GÉRER LES INVITÉS
    hooks: {
        beforeCreate: (customer) => {
            // Si c'est un invité, s'assurer que password est null
            if (customer.is_guest) {
                customer.password = null;
                customer.is_email_verified = false;
            }
        },
        beforeUpdate: (customer) => {
            // Empêcher la suppression du mot de passe pour les comptes normaux
            if (!customer.is_guest && customer.changed('password') && !customer.password) {
                throw new Error('Impossible de supprimer le mot de passe d\'un compte normal');
            }
        }
    }
});

// ✅ MÉTHODES D'INSTANCE UTILES
Customer.prototype.isGuest = function() {
    return this.is_guest === true;
};

Customer.prototype.canLogin = function() {
    return !this.is_guest && this.password !== null;
};

Customer.prototype.getFullName = function() {
    return `${this.first_name} ${this.last_name}`;
};

export default Customer;