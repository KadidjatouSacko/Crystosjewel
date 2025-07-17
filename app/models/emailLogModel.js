import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class EmailLog extends Model {}

EmailLog.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    campaign_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'campaign_id',
        references: {
            model: 'campaigns',
            key: 'id'
        }
    },
    customer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'customer_id',
        references: {
            model: 'customers',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'),
        allowNull: false
    },
    sent_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'sent_at'
    },
    opened_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'opened_at'
    },
    clicked_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'clicked_at'
    },
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message'
    },
    tracking_data: {
        type: DataTypes.JSON,
        defaultValue: {},
        field: 'tracking_data'
    }
}, {
    sequelize,
    modelName: 'EmailLog',
    tableName: 'email_logs',
    timestamps: false
});