import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export class OrderStatusHistory extends Model {}

OrderStatusHistory.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  old_status: { type: DataTypes.STRING(50) },
  new_status: { type: DataTypes.STRING(50), allowNull: false },
  notes: { type: DataTypes.TEXT },
  updated_by: { type: DataTypes.STRING(100) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'OrderStatusHistory',
  tableName: 'order_status_history',
  timestamps: false,
});
