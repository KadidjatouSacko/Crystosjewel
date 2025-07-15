// ===================================
// app/models/emailUnsubscribeModel.js
// ===================================

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";


export class EmailUnsubscribe extends Model {}

EmailUnsubscribe.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    reason: {
        type: DataTypes.ENUM('too_many', 'not_relevant', 'never_subscribed', 'temporary', 'privacy', 'other'),
        allowNull: true
    },
    other_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    feedback_allowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    unsubscribed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
     sequelize,
    tableName: 'email_unsubscribes',
    timestamps: true,
    indexes: [
        {
            fields: ['email']
        },
        {
            fields: ['token']
        },
        {
            fields: ['unsubscribed_at']
        }
    ]
});

