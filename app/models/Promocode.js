// REMPLACER votre modèle PromoCode par cette version corrigée

import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export const PromoCode = sequelize.define('PromoCode', {
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
  discount_type: {
    type: DataTypes.ENUM('percentage', 'fixed'),
    allowNull: false,
    defaultValue: 'percentage'
  },
  discount_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  min_order_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  max_uses: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  used_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  usage_limit: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  discount_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'promo_codes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ✅ AJOUTER LA MÉTHODE STATIQUE MANQUANTE
PromoCode.findValidByCode = async function(code) {
  const { Op } = await import('sequelize');
  
  try {
    const promoCode = await this.findOne({
      where: {
        code: code.trim().toUpperCase(),
        is_active: true,
        [Op.or]: [
          { expires_at: null },
          { expires_at: { [Op.gt]: new Date() } }
        ]
      }
    });

    if (!promoCode) {
      return null;
    }

    // ✅ Vérifier les utilisations (utiliser used_count, PAS current_uses)
    const effectiveLimit = promoCode.max_uses || promoCode.usage_limit;
    if (effectiveLimit && promoCode.used_count >= effectiveLimit) {
      return null; // Code épuisé
    }

    // ✅ Ajouter des propriétés calculées compatibles avec l'ancien code
    promoCode.dataValues.effectiveDiscountValue = promoCode.discount_value;
    promoCode.dataValues.effectiveUsageLimit = effectiveLimit;

    return promoCode;

  } catch (error) {
    console.error('❌ Erreur recherche code promo:', error);
    return null;
  }
};

// ✅ MÉTHODES UTILES
PromoCode.prototype.isValid = function() {
  if (!this.is_active) return false;
  
  const now = new Date();
  if (this.expires_at && now > this.expires_at) return false;
  
  const effectiveLimit = this.max_uses || this.usage_limit;
  if (effectiveLimit && this.used_count >= effectiveLimit) return false;
  
  return true;
};

PromoCode.prototype.calculateDiscount = function(amount) {
  if (this.discount_type === 'percentage') {
    return Math.round((amount * this.discount_value / 100) * 100) / 100;
  } else {
    return Math.min(this.discount_value, amount);
  }
};

// ✅ MÉTHODE POUR UTILISER LE CODE
PromoCode.prototype.useCode = async function() {
  await this.increment('used_count');
  return this;
};

export default PromoCode;




// // models/Promocode.js - VERSION FINALE CORRIGÉE
// import { DataTypes, Model } from 'sequelize';
// import { sequelize } from './sequelize-client.js';

// export const PromoCode = sequelize.define('PromoCode', {
//   id: {
//     type: DataTypes.INTEGER,
//     primaryKey: true,
//     autoIncrement: true
//   },
//   code: {
//     type: DataTypes.STRING(50),
//     allowNull: false,
//     unique: true
//   },
//   discount_type: {
//     type: DataTypes.ENUM('percentage', 'fixed'),
//     allowNull: false,
//     defaultValue: 'percentage'
//   },
//   discount_value: {
//     type: DataTypes.DECIMAL(10, 2),
//     allowNull: false
//   },
//   min_order_amount: {
//     type: DataTypes.DECIMAL(10, 2),
//     allowNull: true,
//     defaultValue: 0.00
//   },
//   max_uses: {
//     type: DataTypes.INTEGER,
//     allowNull: true
//   },
//   used_count: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//     defaultValue: 0
//   },
//   start_date: {
//     type: DataTypes.DATE,
//     allowNull: true
//   },
//   end_date: {
//     type: DataTypes.DATE,
//     allowNull: true
//   },
//   expires_at: {
//     type: DataTypes.DATE,
//     allowNull: true
//   },
//   usage_limit: {
//     type: DataTypes.INTEGER,
//     allowNull: true
//   },
//   discount_percent: {
//     type: DataTypes.DECIMAL(5, 2),
//     allowNull: true
//   },
//   is_active: {
//     type: DataTypes.BOOLEAN,
//     allowNull: false,
//     defaultValue: true
//   }
// }, {
//   tableName: 'promo_codes', // ✅ TABLE CORRECTE
//   timestamps: true,
//   createdAt: 'created_at',
//   updatedAt: 'updated_at'
// });

// // ✅ MÉTHODES UTILES
// PromoCode.prototype.isValid = function() {
//   if (!this.is_active) return false;
  
//   const now = new Date();
//   if (this.expires_at && now > this.expires_at) return false;
//   if (this.max_uses && this.used_count >= this.max_uses) return false;
  
//   return true;
// };

// PromoCode.prototype.calculateDiscount = function(amount) {
//   if (this.discount_type === 'percentage') {
//     return Math.round((amount * this.discount_value / 100) * 100) / 100;
//   } else {
//     return Math.min(this.discount_value, amount);
//   }
// };

// export default PromoCode;