// app/models/EmailTemplate.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class EmailTemplate extends Model {}

EmailTemplate.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING(50),
        defaultValue: 'custom',
        validate: {
            isIn: [['welcome', 'newsletter', 'promo', 'transactionnal', 'custom']]
        }
    },
    template_data: {
        type: DataTypes.JSONB,
        allowNull: false
    },
    preview_image: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'customer',
            key: 'id'
        }
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    tableName: 'email_templates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});