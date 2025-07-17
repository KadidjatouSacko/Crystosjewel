
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class Campaign extends Model {}

Campaign.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    content_type: {
        type: DataTypes.ENUM('html', 'text'),
        defaultValue: 'html',
        field: 'content_type'
    },
    sender_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'sender_name'
    },
    sender_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'sender_email'
    },
    status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'sent', 'failed'),
        defaultValue: 'draft'
    },
    scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'scheduled_at'
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'sent_at'
    },
    recipient_filters: {
        type: DataTypes.JSON,
        defaultValue: {},
        field: 'recipient_filters'
    },
    template_data: {
        type: DataTypes.JSON,
        defaultValue: {},
        field: 'template_data'
    },
    bcc_email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'bcc_email'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    sequelize,
    modelName: 'Campaign',
    tableName: 'campaigns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});