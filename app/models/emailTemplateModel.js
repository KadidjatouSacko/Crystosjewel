import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class EmailTemplate extends Model {}

EmailTemplate.init(
  {
    template_name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    html_content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    text_content: {
      type: DataTypes.TEXT,
    },
    variables: {
      type: DataTypes.JSON,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "email_templates",
    timestamps: false,
  }
);
