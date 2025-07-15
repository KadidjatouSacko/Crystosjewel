// ===================================
// app/models/emailTemplateModel.js - VOTRE FORMAT
// ===================================

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class EmailTemplate extends Model {}

EmailTemplate.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        subject: {
            type: DataTypes.STRING,
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT('long'),
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('newsletter', 'promotion', 'order_confirmation', 'welcome', 'custom'),
            defaultValue: 'custom'
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        is_default: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        thumbnail: {
            type: DataTypes.STRING,
            allowNull: true
        },
        variables: {
            type: DataTypes.JSON,
            defaultValue: {}
        },
        metadata: {
            type: DataTypes.JSON,
            defaultValue: {}
        },
        usage_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        last_used_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    },
    {
        sequelize,
        tableName: "email_templates",
        timestamps: true,
        indexes: [
            {
                fields: ['type']
            },
            {
                fields: ['category']
            },
            {
                fields: ['is_active']
            },
            {
                fields: ['is_default']
            }
        ]
    }
);