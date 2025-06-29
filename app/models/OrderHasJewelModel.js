import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class OrderHasJewel extends Model {}

OrderHasJewel.init(
    {
        order_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        jewel_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        quantity: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        unit_price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'order_has_jewel',
        timestamps: true, // important !
        underscored: true, // si tes colonnes s'appellent created_at, updated_at
    }
);
