import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export class PromoCode extends Model {}

PromoCode.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  // ✅ Utiliser les vrais noms de colonnes de votre BDD
  discount_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'percentage'
  },
  discount_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  discount_percent: {  // ✅ Colonne qui existe dans votre BDD
    type: DataTypes.INTEGER,
    allowNull: true
  },
  min_order_amount: {  // ✅ Au lieu de minimum_amount
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  max_uses: {  // ✅ Au lieu de maximum_uses
    type: DataTypes.INTEGER,
    allowNull: true
  },
  used_count: {  // ✅ Au lieu de current_uses
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  usage_limit: {  // ✅ Colonne qui existe
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1
  },
  start_date: {  // ✅ Au lieu de valid_from
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  end_date: {  // ✅ Au lieu de valid_until
    type: DataTypes.DATE,
    allowNull: true
  },
  expires_at: {  // ✅ Colonne qui existe
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  sequelize,
  tableName: 'promo_codes',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});
