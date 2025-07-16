// app/models/EmailTracking.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class EmailTracking extends Model {}

EmailTracking.init({
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
    customer_email: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    action_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['open', 'click', 'unsubscribe', 'bounce']]
        }
    },
    action_data: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ip_address: {
        type: DataTypes.INET,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    tableName: 'email_tracking',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});