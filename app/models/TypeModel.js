import { Model, DataTypes } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export class Type extends Model {}

Type.init(
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    category_id: {
      type :DataTypes.INTEGER,
    }
  },
  {
    sequelize,
    modelName: 'Type',
    tableName: 'Types',
    timestamps: false,
  }
);
