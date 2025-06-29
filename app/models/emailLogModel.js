import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";
import { Customer } from "./customerModel.js";

export class EmailLog extends Model {}

EmailLog.init(
  {
    email_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    recipient_email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    error_message: {
      type: DataTypes.TEXT,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    sent_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "email_logs",
    timestamps: false,
  }
);

// Relation : un EmailLog appartient à un Customer
EmailLog.belongsTo(Customer, { foreignKey: "customer_id" });
