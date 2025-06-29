import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export class OrderTracking extends Model {}

OrderTracking.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(50), allowNull: false },
  description: { type: DataTypes.TEXT },
  location: { type: DataTypes.STRING(100) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'OrderTracking',
  tableName: 'order_tracking',
  timestamps: false,
});
