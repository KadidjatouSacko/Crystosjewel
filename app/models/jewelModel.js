import { Model, DataTypes } from 'sequelize';
import slugify from 'slugify';
import { sequelize } from './sequelize-client.js';

export class Jewel extends Model {}

Jewel.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  price_ttc: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  tva: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 20
  },
  price_ht: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  poids: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true
  },
  matiere: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  carat: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  popularity_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  type_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  tailles: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  discount_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  discount_start_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  discount_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  featured_order: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  views_count: {
  type: DataTypes.INTEGER,
  defaultValue: 0
},
favorites_count: {
  type: DataTypes.INTEGER,
  defaultValue: 0
},
cart_additions: {
  type: DataTypes.INTEGER,
  defaultValue: 0
},
sales_count: {
  type: DataTypes.INTEGER,
  defaultValue: 0
}

},{
  sequelize,
  freezeTableName: true,
  modelName: 'Jewel',
  tableName: 'jewel',
  timestamps: true,
   indexes: [
    {
      fields: ['is_featured', 'featured_order']
    },
    {
      fields: ['category_id']
    }
  ],
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (jewel) => {
      // Générer un slug unique
      jewel.slug = await generateUniqueSlug(jewel.name);
      
      // Calculer le stock total depuis les tailles
      if (jewel.tailles && Array.isArray(jewel.tailles)) {
        jewel.stock = jewel.tailles.reduce((total, t) => total + (parseInt(t.stock) || 0), 0);
      }
      
      // Valider les dates de réduction
      if (jewel.discount_start_date && jewel.discount_end_date) {
        if (new Date(jewel.discount_end_date) <= new Date(jewel.discount_start_date)) {
          throw new Error('La date de fin de réduction doit être postérieure à la date de début');
        }
      }
    },
    beforeUpdate: async (jewel) => {
      // Regenerer le slug seulement si le nom a changé
      if (jewel.changed('name')) {
        jewel.slug = await generateUniqueSlug(jewel.name, jewel.id);
      }
      
      // Calculer le stock total depuis les tailles
      if (jewel.changed('tailles') && jewel.tailles && Array.isArray(jewel.tailles)) {
        jewel.stock = jewel.tailles.reduce((total, t) => total + (parseInt(t.stock) || 0), 0);
      }
      
      // Valider les dates de réduction
      if (jewel.discount_start_date && jewel.discount_end_date) {
        if (new Date(jewel.discount_end_date) <= new Date(jewel.discount_start_date)) {
          throw new Error('La date de fin de réduction doit être postérieure à la date de début');
        }
      }
    }
  }
});

// Fonction pour générer un slug unique
async function generateUniqueSlug(name, excludeId = null) {
  const baseSlug = slugify(name, { 
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
  
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const whereClause = { slug };
    if (excludeId) {
      whereClause.id = { [sequelize.Sequelize.Op.ne]: excludeId };
    }
    
    const existing = await Jewel.findOne({ where: whereClause });
    if (!existing) {
      break;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

// MÉTHODES D'INSTANCE POUR GÉRER LES TAILLES
Jewel.prototype.getTailles = function() {
  return this.tailles || [];
};

Jewel.prototype.addTaille = function(taille, stock = 0) {
  const tailles = this.getTailles();
  const existingIndex = tailles.findIndex(t => t.taille === taille);
  
  if (existingIndex >= 0) {
    tailles[existingIndex].stock = parseInt(stock) || 0;
  } else {
    tailles.push({ taille, stock: parseInt(stock) || 0 });
  }
  
  this.tailles = tailles;
  this.stock = tailles.reduce((total, t) => total + (parseInt(t.stock) || 0), 0);
};

Jewel.prototype.removeTaille = function(taille) {
  const tailles = this.getTailles().filter(t => t.taille !== taille);
  this.tailles = tailles;
  this.stock = tailles.reduce((total, t) => total + (parseInt(t.stock) || 0), 0);
};

Jewel.prototype.getStockForTaille = function(taille) {
  const tailleObj = this.getTailles().find(t => t.taille === taille);
  return tailleObj ? tailleObj.stock : 0;
};

// MÉTHODES POUR LES RÉDUCTIONS
Jewel.prototype.hasActiveDiscount = function() {
  if (!this.discount_percentage || this.discount_percentage <= 0) {
    return false;
  }
  
  const now = new Date();
  
  // Si pas de dates spécifiées, la réduction est active
  if (!this.discount_start_date && !this.discount_end_date) {
    return true;
  }
  
  // Vérifier si on est dans la période de réduction
  if (this.discount_start_date && now < new Date(this.discount_start_date)) {
    return false;
  }
  
  if (this.discount_end_date && now > new Date(this.discount_end_date)) {
    return false;
  }
  
  return true;
};

Jewel.prototype.getDiscountedPrice = function() {
  if (!this.hasActiveDiscount()) {
    return this.price_ttc;
  }
  
  return this.price_ttc * (1 - this.discount_percentage / 100);
};

Jewel.prototype.getSavings = function() {
  if (!this.hasActiveDiscount()) {
    return 0;
  }
  
  return this.price_ttc - this.getDiscountedPrice();
};

// MÉTHODES POUR LA POPULARITÉ
Jewel.prototype.incrementPopularity = function(points = 1) {
  this.popularity_score = (this.popularity_score || 0) + points;
  return this.save();
};

Jewel.prototype.isPopular = function(threshold = 50) {
  return (this.popularity_score || 0) >= threshold;
};

// MÉTHODES POUR LES BADGES
Jewel.prototype.getBadge = function() {
  const isNew = this.created_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hasDiscount = this.hasActiveDiscount();
  const isPopular = this.isPopular();
  
  if (hasDiscount) {
    return {
      text: `-${this.discount_percentage}%`,
      class: 'promo'
    };
  } else if (isNew) {
    return {
      text: 'Nouveau',
      class: 'nouveau'
    };
  } else if (isPopular) {
    return {
      text: 'Populaire',
      class: 'populaire'
    };
  }
  
  return null;
};

Jewel.prototype.getBadgeInfo = function() {
  const now = new Date();
  const isNew = this.created_at > new Date(now - 7 * 24 * 60 * 60 * 1000); // 7 jours
  const hasDiscount = this.discount_percentage && this.discount_percentage > 0;
  const isPopular = (this.popularity_score || 0) >= 50;
  const isBestSeller = (this.sales_count || 0) >= 10;
  const isLastChance = this.stock <= 3 && this.stock > 0;
  
  // Priorité des badges
  if (hasDiscount) {
    return {
      text: `-${this.discount_percentage}%`,
      class: 'promo',
      priority: 1
    };
  } else if (isLastChance) {
    return {
      text: 'Dernière chance',
      class: 'derniere-chance',
      priority: 2
    };
  } else if (isBestSeller) {
    return {
      text: 'Best-seller',
      class: 'best-seller',
      priority: 3
    };
  } else if (isNew) {
    return {
      text: 'Nouveau',
      class: 'nouveau',
      priority: 4
    };
  } else if (isPopular) {
    return {
      text: 'Populaire',
      class: 'populaire',
      priority: 5
    };
  }
  
  return null;
};