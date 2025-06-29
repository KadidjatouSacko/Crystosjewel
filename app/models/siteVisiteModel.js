import { Model, DataTypes } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export class SiteVisit extends Model {}

SiteVisit.init({
    visited_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
}, {
  sequelize,
  modelName: 'site_visit',
  tableName: 'site_visits',
  timestamps: false
});
