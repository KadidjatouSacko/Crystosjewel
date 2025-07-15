// ===================================
// app/models/emailCampaignRecipientModel.js - VOTRE FORMAT
// ===================================

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class EmailCampaignRecipient extends Model {}

EmailCampaignRecipient.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        campaign_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isEmail: true
            }
        },
        customer_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        first_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        last_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'),
            defaultValue: 'pending'
        },
        sent_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        delivered_at: {
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
        bounced_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        bounce_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        open_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        click_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        tracking_token: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        metadata: {
            type: DataTypes.JSON,
            defaultValue: {}
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
        tableName: "email_campaign_recipients",
        timestamps: true,
        indexes: [
            {
                fields: ['campaign_id']
            },
            {
                fields: ['email']
            },
            {
                fields: ['customer_id']
            },
            {
                fields: ['status']
            },
            {
                fields: ['tracking_token']
            },
            {
                fields: ['sent_at']
            }
        ]
    }
);