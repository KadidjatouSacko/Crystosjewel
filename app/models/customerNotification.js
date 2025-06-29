import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export class CustomerNotification extends Model {}

CustomerNotification.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  customer_id: { type: DataTypes.INTEGER, allowNull: false },
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(100), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'CustomerNotification',
  tableName: 'customer_notification',
  timestamps: false,
});
