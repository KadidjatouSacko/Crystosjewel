import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class EmailTemplate extends Model {}


EmailTemplate.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    template_key: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    html_content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    css_styles: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    variables: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Variables disponibles dans le template'
    },
    preview_image: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    category: {
        type: DataTypes.ENUM('newsletter', 'promotion', 'transactional', 'welcome'),
        defaultValue: 'newsletter'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    tableName: "email_templates",
    timestamps: false
});
