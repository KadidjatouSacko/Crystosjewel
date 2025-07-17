
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";


export class CampaignStats extends Model {}

CampaignStats.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    campaign_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: 'campaign_id',
        references: {
            model: 'campaigns',
            key: 'id'
        }
    },
    total_recipients: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'total_recipients'
    },
    emails_sent: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'emails_sent'
    },
    emails_delivered: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'emails_delivered'
    },
    emails_opened: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'emails_opened'
    },
    emails_clicked: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'emails_clicked'
    },
    emails_bounced: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'emails_bounced'
    },
    emails_failed: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'emails_failed'
    },
    open_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        field: 'open_rate'
    },
    click_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        field: 'click_rate'
    },
    bounce_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        field: 'bounce_rate'
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
    modelName: 'CampaignStats',
    tableName: 'campaign_stats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});