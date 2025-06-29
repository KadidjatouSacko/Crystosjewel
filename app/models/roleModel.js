// models/roleModel.js - Adapté à votre structure PostgreSQL
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class Role extends Model {}

Role.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    }
}, {
    sequelize,
    tableName: "role",
    timestamps: false, // Pas de timestamps dans votre table
    underscored: false
});

export default Role;