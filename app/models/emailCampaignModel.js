import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";
import { Customer } from "./customerModel.js";

export class EmailCampaign extends Model {}

EmailCampaign.init({
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
    preheader: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    from_name: {
        type: DataTypes.STRING(100),
        defaultValue: 'CrystosJewel'
    },
    from_email: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    template_name: {
        type: DataTypes.ENUM('elegant', 'modern', 'promo', 'newsletter'),
        defaultValue: 'elegant'
    },
    content_html: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    content_text: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'sent', 'failed'),
        defaultValue: 'draft'
    },
    recipient_filter: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Critères de filtrage des destinataires'
    },
    selected_customers: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'IDs des clients sélectionnés manuellement'
    },
    total_recipients: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sent_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    failed_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    opened_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    clicked_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
    tableName: "email_campaigns",
    timestamps: false
});

// Relations
EmailCampaign.belongsTo(Customer, { foreignKey: 'created_by', as: 'creator' });