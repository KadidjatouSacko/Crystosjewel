import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export class CustomerCommunicationPreference extends Model {}

CustomerCommunicationPreference.init({
  customer_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  email_order_updates: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  email_marketing: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  sms_order_updates: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sms_marketing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'CustomerCommunicationPreference',
  tableName: 'customer_communication_preference',
  timestamps: false,
});
