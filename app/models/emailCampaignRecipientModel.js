// app/models/emailCampaignRecipientModel.js

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";
import { EmailCampaign } from "./emailCampaignModel.js";
export class EmailCampaignRecipient extends Model {}

EmailCampaignRecipient.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    campaign_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'email_campaigns',
            key: 'id'
        }
    },
    customer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customer',
            key: 'id'
        }
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed', 'bounced'),
        defaultValue: 'pending'
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    opened_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    clicked_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    tracking_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true
    }
}, {
    sequelize,
    tableName: "email_campaign_recipients",
    timestamps: false
});

