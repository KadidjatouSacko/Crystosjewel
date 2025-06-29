import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class JewelView extends Model {}

JewelView.init({
   id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    jewel_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'jewel',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'customer',
            key: 'id'
        }
    },
    session_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    tableName: 'jewel_views',
    timestamps: true,
    updatedAt: false
});