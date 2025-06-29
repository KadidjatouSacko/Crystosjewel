// models/Material.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class Material extends Model {}

Material.init(
    {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true, // Pour éviter les matières dupliquées
        },
    },
    {
        sequelize,
        tableName: "material", // Table 'material' dans la base de données
    }
);
