import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class Payment extends Model {}

Payment.init(
    {
        payment_date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        method: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: "en attente",
        },
        order_id: {
            type: DataTypes.INTEGER,
        },
    },
    {
        sequelize,
        tableName: "payment",
    }
);
