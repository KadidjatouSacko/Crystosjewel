// models/categoryModel.js
import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-client.js';

class Category extends Model {}

Category.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 50]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Nom du fichier image stocké dans /public/images/categories/'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: "Ordre d'affichage des catégories"
    }
  },
  {
    sequelize,
    tableName: 'category',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['name'] },
      { fields: ['is_active'] },
      { fields: ['sort_order'] }
    ]
  }
);

// Méthodes d'instance
Category.prototype.getImageUrl = function () {
  return this.image
    ? `/images/categories/${this.image}`
    : `/images/categories/default-${this.name.toLowerCase()}.jpg`;
};

Category.prototype.hasImage = function () {
  return !!this.image;
};

// Méthodes de classe
Category.getActiveCategories = async function () {
  return await this.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC'], ['name', 'ASC']]
  });
};

Category.getCategoryWithProducts = async function (categoryId) {
  const { default: Product } = await import('./Product.js');
  return await this.findByPk(categoryId, {
    include: [{
      model: Product,
      where: { is_active: true },
      required: false
    }]
  });
};

// ✅ EXPORT EN NOMMÉ
export { Category };
