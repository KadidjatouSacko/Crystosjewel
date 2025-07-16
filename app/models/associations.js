import { Category } from "./categoryModel.js";
import { Jewel } from "./jewelModel.js";
import { Customer } from "./customerModel.js";
import { Order } from "./orderModel.js";
import { OrderHasJewel } from "./OrderHasJewelModel.js";
import { Payment } from "./paymentModel.js";
import { Role } from "./roleModel.js";
import { Material } from "./MaterialModel.js";
import { JewelImage } from "./jewelImage.js";
import { Favorite } from "./favoritesModel.js";
import { Cart } from "./cartModel.js";
import { JewelView } from "./jewelViewModel.js";
import { OrderItem } from "./orderItem.js";
import { Type } from "./TypeModel.js";
import { Activity } from "./activityModel.js";
import { OrderTracking } from "./OrderTracking.js";
import { OrderStatusHistory } from "./OrderStatusHistory.js";
import { CustomerNotification } from "./customerNotification.js";
import { CustomerCommunicationPreference } from "./customerCommunicationPreference.js";
import { EmailCampaign } from "./emailCampaignModel.js";
import { EmailCampaignRecipient } from "./emailCampaignRecipientModel.js";
import { EmailTracking } from "./EmailTracking.js";
import { EmailTemplate } from "./EmailTemplate.js";



// ===== NOUVEAUX MODÈLES POUR L'ADMINISTRATION =====
import { HomeImage } from "./HomeImage.js";
import { SiteSetting } from "./SiteSetting.js"

// ===== NOUVEAUX MODÈLES POUR LES INVITÉS =====
import { PromoCode } from "./Promocode.js";
import { PromoCodeUse } from "./PromoCodeUse.js";
import { GuestSession } from "./GuestSession.js";

// ===== ASSOCIATIONS PRINCIPALES EXISTANTES =====



PromoCode.hasMany(Order, {
  foreignKey: 'promoCodeId',
  as: 'orders'
});

// Une commande peut avoir un seul code promo
Order.belongsTo(PromoCode, {
  foreignKey: 'promoCodeId',
  as: 'promoCode'
});



PromoCode.hasMany(PromoCodeUse, {
  foreignKey: 'promoCodeId',
  as: 'usages'
});

PromoCodeUse.belongsTo(PromoCode, {
  foreignKey: 'promoCodeId',
  as: 'promoCode'
});


GuestSession.hasMany(PromoCodeUse, {
  foreignKey: 'guestSessionId',
  as: 'promoCodeUsages'
});

PromoCodeUse.belongsTo(GuestSession, {
  foreignKey: 'guestSessionId',
  as: 'guestSession'
});


// 1. Category <-> Jewel
Category.hasMany(Jewel, {
  foreignKey: 'category_id',
  as: 'jewels'
});
Jewel.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'category'
});

// 2. Type <-> Jewel
Type.hasMany(Jewel, {
  foreignKey: 'type_id',
  as: 'jewels'
});
Jewel.belongsTo(Type, {
  foreignKey: 'type_id',
  as: 'type'
});

// 3. Type <-> Category
Category.hasMany(Type, {
  foreignKey: 'category_id',
  as: 'types'
});
Type.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'category'
});

// 4. Jewel <-> JewelImage
Jewel.hasMany(JewelImage, {
  foreignKey: 'jewel_id',
  as: 'additionalImages'
});
JewelImage.belongsTo(Jewel, {
  foreignKey: 'jewel_id',
  as: 'jewel'
});

// 5. Customer <-> Role
Customer.belongsTo(Role, {
  foreignKey: 'role_id',
  as: 'role'
});
Role.hasMany(Customer, {
  foreignKey: 'role_id',
  as: 'customers'
});

// 6. Customer <-> Order
Customer.hasMany(Order, {
  foreignKey: 'customer_id',
  as: 'orders'
});
Order.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer'
});

// 7. Order <-> Payment
Order.hasOne(Payment, {
  foreignKey: 'order_id',
  as: 'payment'
});
Payment.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

// 8. Order <-> OrderItem
Order.hasMany(OrderItem, {
  foreignKey: 'order_id',
  as: 'items'
});
OrderItem.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

// 9. Jewel <-> OrderItem
Jewel.hasMany(OrderItem, {
  foreignKey: 'jewel_id',
  as: 'orderItems'
});
OrderItem.belongsTo(Jewel, {
  foreignKey: 'jewel_id',
  as: 'jewel'
});

// 10. Order <-> Jewel (Many-to-Many via OrderHasJewel)
Order.belongsToMany(Jewel, {
  through: OrderHasJewel,
  foreignKey: 'order_id',
  otherKey: 'jewel_id',
  as: 'jewels'
});
Jewel.belongsToMany(Order, {
  through: OrderHasJewel,
  foreignKey: 'jewel_id',
  otherKey: 'order_id',
  as: 'orders'
});

// 11. Customer <-> Favorite <-> Jewel
Customer.hasMany(Favorite, {
  foreignKey: 'customer_id',
  as: 'favorites'
});
Favorite.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer'
});

Jewel.hasMany(Favorite, {
  foreignKey: 'jewel_id',
  as: 'favorites'
});
Favorite.belongsTo(Jewel, {
  foreignKey: 'jewel_id',
  as: 'jewel'
});

// 12. Customer <-> Cart <-> Jewel
Customer.hasMany(Cart, {
  foreignKey: 'customer_id',
  as: 'cartItems'
});
Cart.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer'
});

Jewel.hasMany(Cart, {
  foreignKey: 'jewel_id',
  as: 'cartItems'
});
Cart.belongsTo(Jewel, {
  foreignKey: 'jewel_id',
  as: 'jewel'
});

// 13. Jewel <-> JewelView
Jewel.hasMany(JewelView, {
  foreignKey: 'jewel_id',
  as: 'views'
});
JewelView.belongsTo(Jewel, {
  foreignKey: 'jewel_id',
  as: 'jewel'
});

// 14. Jewel <-> Material (Many-to-Many)
Jewel.belongsToMany(Material, {
  through: "jewel_has_material",
  foreignKey: "jewel_id",
  otherKey: "material_id",
  as: 'materials'
});
Material.belongsToMany(Jewel, {
  through: "jewel_has_material",
  foreignKey: "material_id",
  otherKey: "jewel_id",
  as: 'jewels'
});

// 15. Order Tracking et Status
Order.hasMany(OrderTracking, {
  foreignKey: 'order_id',
  as: 'trackings'
});
OrderTracking.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

Order.hasMany(OrderStatusHistory, {
  foreignKey: 'order_id',
  as: 'statusHistory'
});
OrderStatusHistory.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

// 16. Customer Notifications
Customer.hasMany(CustomerNotification, {
  foreignKey: 'customer_id',
  as: 'notifications'
});
CustomerNotification.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer'
});

Order.hasMany(CustomerNotification, {
  foreignKey: 'order_id',
  as: 'notifications'
});
CustomerNotification.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

// 17. Customer Communication Preferences
Customer.hasOne(CustomerCommunicationPreference, {
  foreignKey: 'customer_id',
  as: 'communicationPreferences'
});
CustomerCommunicationPreference.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer'
});

// 18. Customer Activity
Customer.hasMany(Activity, {
  foreignKey: 'customer_id',
  as: 'activities'
});
Activity.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer'
});

// ===== NOUVELLES MÉTHODES POUR LES COUPS DE CŒUR =====

// Ajouter des méthodes statiques au modèle Jewel
Jewel.getFeatured = async function(limit = 4) {
  const { Op } = await import('sequelize');
  
  return await this.findAll({
    where: {
      is_featured: true,
      is_active: true,
      stock: { [Op.gt]: 0 }
    },
    include: [
      {
        model: JewelImage,
        as: 'additionalImages',
        required: false,
        limit: 1
      },
      {
        model: Category,
        as: 'category',
        required: false
      }
    ],
    order: [['featured_order', 'ASC']],
    limit: limit
  });
};

Jewel.getAllActive = async function() {
  const { Op } = await import('sequelize');
  
  return await this.findAll({
    where: {
      is_active: true,
      stock: { [Op.gt]: 0 }
    },
    include: [
      {
        model: Category,
        as: 'category',
        required: false
      },
      {
        model: JewelImage,
        as: 'additionalImages',
        required: false,
        limit: 1
      }
    ],
    order: [['name', 'ASC']]
  });
};

Jewel.addToFeatured = async function(jewelId) {
  const { Op } = await import('sequelize');
  
  // Vérifier le nombre actuel de coups de cœur
  const currentCount = await this.count({
    where: { is_featured: true }
  });

  if (currentCount >= 4) {
    throw new Error('Maximum 4 coups de cœur autorisés');
  }

  // Vérifier que le bijou existe
  const jewel = await this.findByPk(jewelId);
  if (!jewel) {
    throw new Error('Bijou non trouvé');
  }

  if (jewel.is_featured) {
    throw new Error('Ce bijou est déjà un coup de cœur');
  }

  // Ajouter aux coups de cœur
  await jewel.update({
    is_featured: true,
    featured_order: currentCount + 1
  });

  return { jewel, featuredOrder: currentCount + 1 };
};

Jewel.removeFromFeatured = async function(jewelId) {
  const { Op } = await import('sequelize');
  
  const jewel = await this.findByPk(jewelId);
  if (!jewel) {
    throw new Error('Bijou non trouvé');
  }

  if (!jewel.is_featured) {
    throw new Error('Ce bijou n\'est pas un coup de cœur');
  }

  const removedOrder = jewel.featured_order;

  // Retirer des coups de cœur
  await jewel.update({
    is_featured: false,
    featured_order: null
  });

  // Réorganiser les ordres des autres coups de cœur
  await this.update(
    {
      featured_order: Jewel.sequelize.literal('featured_order - 1')
    },
    {
      where: {
        is_featured: true,
        featured_order: { [Op.gt]: removedOrder }
      }
    }
  );

  return jewel;
};

// ===== MÉTHODES POUR HomeImage =====

HomeImage.getByType = async function(imageType) {
  return await this.findAll({
    where: {
      image_type: imageType,
      is_active: true
    },
    order: [['image_key', 'ASC']]
  });
};

HomeImage.updateImage = async function(imageType, imageKey, imagePath, altText = '') {
  return await this.upsert({
    image_type: imageType,
    image_key: imageKey,
    image_path: imagePath,
    alt_text: altText,
    is_active: true
  });
};

HomeImage.getAllImages = async function() {
  const images = await this.findAll({
    where: { is_active: true },
    order: [['image_type', 'ASC'], ['image_key', 'ASC']]
  });

  const imagesByType = {};
  images.forEach(img => {
    if (!imagesByType[img.image_type]) {
      imagesByType[img.image_type] = {};
    }
    imagesByType[img.image_type][img.image_key] = img.image_path;
  });

  return imagesByType;
};

// ===== MÉTHODES POUR SiteSetting =====

SiteSetting.getValue = async function(key, defaultValue = null) {
  const setting = await this.findOne({
    where: { setting_key: key }
  });
  
  return setting ? setting.setting_value : defaultValue;
};

SiteSetting.setValue = async function(key, value, type = 'text', description = '') {
  return await this.upsert({
    setting_key: key,
    setting_value: value,
    setting_type: type,
    description: description
  });
};

SiteSetting.getAll = async function() {
  const settings = await this.findAll();
  const result = {};
  
  settings.forEach(setting => {
    result[setting.setting_key] = setting.setting_value;
  });
  
  return result;
};

// ===== HOOKS POUR LA GESTION AUTOMATIQUE =====

// Hook pour maintenir l'ordre des coups de cœur
Jewel.addHook('afterUpdate', async (jewel, options) => {
  if (jewel.changed('is_featured') && jewel.is_featured === false) {
    const { Op } = await import('sequelize');
    
    // Réorganiser les ordres quand un bijou est retiré des coups de cœur
    await Jewel.update(
      {
        featured_order: Jewel.sequelize.literal('featured_order - 1')
      },
      {
        where: {
          is_featured: true,
          featured_order: {
            [Op.gt]: jewel.previous('featured_order') || 0
          }
        },
        transaction: options.transaction
      }
    );
  }
});

// Hook pour nettoyer les images supprimées
HomeImage.addHook('afterUpdate', async (homeImage, options) => {
  if (homeImage.changed('image_path') && homeImage.previous('image_path')) {
    console.log('🗑️ Ancienne image à supprimer:', homeImage.previous('image_path'));
    // Ici, vous pourriez ajouter la logique pour supprimer l'ancienne image du disque
  }
});


// Relations
EmailCampaignRecipient.belongsTo(EmailCampaign, { foreignKey: 'campaign_id' });
EmailCampaignRecipient.belongsTo(Customer, { foreignKey: 'customer_id' });


EmailCampaign.belongsTo(Customer, {
    foreignKey: 'created_by',
    as: 'creator'
});
Customer.hasMany(EmailCampaign, {
    foreignKey: 'created_by',
    as: 'emailCampaigns'
});

// 2. EmailCampaign <-> EmailTracking
EmailCampaign.hasMany(EmailTracking, {
    foreignKey: 'campaign_id',
    as: 'trackings'
});
EmailTracking.belongsTo(EmailCampaign, {
    foreignKey: 'campaign_id',
    as: 'campaign'
});

// 3. EmailTemplate <-> Customer (créateur)
EmailTemplate.belongsTo(Customer, {
    foreignKey: 'created_by',
    as: 'creator'
});
Customer.hasMany(EmailTemplate, {
    foreignKey: 'created_by',
    as: 'emailTemplates'
});

// ===== MÉTHODES STATIQUES POUR EMAIL CAMPAIGNS =====

// Méthodes pour récupérer les campagnes par statut
EmailCampaign.getDrafts = async function() {
    return await this.findAll({
        where: { status: 'draft' },
        include: [
            {
                model: Customer,
                as: 'creator',
                attributes: ['id', 'first_name', 'last_name']
            }
        ],
        order: [['updated_at', 'DESC']]
    });
};

EmailCampaign.getSent = async function() {
    return await this.findAll({
        where: { status: 'sent' },
        include: [
            {
                model: Customer,
                as: 'creator',
                attributes: ['id', 'first_name', 'last_name']
            }
        ],
        order: [['sent_at', 'DESC']]
    });
};

EmailCampaign.getScheduled = async function() {
    return await this.findAll({
        where: { status: 'scheduled' },
        include: [
            {
                model: Customer,
                as: 'creator',
                attributes: ['id', 'first_name', 'last_name']
            }
        ],
        order: [['scheduled_at', 'ASC']]
    });
};

// Méthode pour obtenir les statistiques globales
EmailCampaign.getGlobalStats = async function() {
    const { Op } = await import('sequelize');
    
    const stats = await this.findAll({
        where: {
            status: 'sent'
        },
        attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'total_campaigns'],
            [sequelize.fn('SUM', sequelize.col('sent_count')), 'total_sent'],
            [sequelize.fn('SUM', sequelize.col('open_count')), 'total_opens'],
            [sequelize.fn('SUM', sequelize.col('click_count')), 'total_clicks'],
            [sequelize.fn('AVG', 
                sequelize.literal('CASE WHEN sent_count > 0 THEN (open_count::float / sent_count * 100) ELSE 0 END')
            ), 'avg_open_rate'],
            [sequelize.fn('AVG', 
                sequelize.literal('CASE WHEN sent_count > 0 THEN (click_count::float / sent_count * 100) ELSE 0 END')
            ), 'avg_click_rate']
        ],
        raw: true
    });
    
    return stats[0] || {
        total_campaigns: 0,
        total_sent: 0,
        total_opens: 0,
        total_clicks: 0,
        avg_open_rate: 0,
        avg_click_rate: 0
    };
};

// Méthode pour marquer une ouverture
EmailCampaign.trackOpen = async function(campaignId, customerEmail, userAgent = null, ipAddress = null) {
    const campaign = await this.findByPk(campaignId);
    if (!campaign) return false;
    
    // Vérifier si l'ouverture n'a pas déjà été enregistrée
    const existingOpen = await EmailTracking.findOne({
        where: {
            campaign_id: campaignId,
            customer_email: customerEmail,
            action_type: 'open'
        }
    });
    
    if (!existingOpen) {
        // Créer le tracking
        await EmailTracking.create({
            campaign_id: campaignId,
            customer_email: customerEmail,
            action_type: 'open',
            user_agent: userAgent,
            ip_address: ipAddress
        });
        
        // Incrémenter le compteur d'ouvertures
        await campaign.increment('open_count');
        return true;
    }
    
    return false;
};

// Méthode pour marquer un clic
EmailCampaign.trackClick = async function(campaignId, customerEmail, clickedUrl, userAgent = null, ipAddress = null) {
    const campaign = await this.findByPk(campaignId);
    if (!campaign) return false;
    
    // Créer le tracking (on peut avoir plusieurs clics par email)
    await EmailTracking.create({
        campaign_id: campaignId,
        customer_email: customerEmail,
        action_type: 'click',
        action_data: clickedUrl,
        user_agent: userAgent,
        ip_address: ipAddress
    });
    
    // Incrémenter le compteur de clics
    await campaign.increment('click_count');
    return true;
};

// ===== MÉTHODES POUR EMAIL TRACKING =====

// Obtenir les statistiques par campagne
EmailTracking.getCampaignStats = async function(campaignId) {
    const { Op } = await import('sequelize');
    
    const stats = await this.findAll({
        where: { campaign_id: campaignId },
        attributes: [
            'action_type',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('customer_email'))), 'unique_count']
        ],
        group: ['action_type'],
        raw: true
    });
    
    const result = {
        opens: 0,
        unique_opens: 0,
        clicks: 0,
        unique_clicks: 0,
        unsubscribes: 0,
        bounces: 0
    };
    
    stats.forEach(stat => {
        switch(stat.action_type) {
            case 'open':
                result.opens = parseInt(stat.count);
                result.unique_opens = parseInt(stat.unique_count);
                break;
            case 'click':
                result.clicks = parseInt(stat.count);
                result.unique_clicks = parseInt(stat.unique_count);
                break;
            case 'unsubscribe':
                result.unsubscribes = parseInt(stat.count);
                break;
            case 'bounce':
                result.bounces = parseInt(stat.count);
                break;
        }
    });
    
    return result;
};

// Obtenir les liens les plus cliqués
EmailTracking.getTopLinks = async function(campaignId, limit = 10) {
    return await this.findAll({
        where: {
            campaign_id: campaignId,
            action_type: 'click'
        },
        attributes: [
            'action_data',
            [sequelize.fn('COUNT', sequelize.col('id')), 'click_count']
        ],
        group: ['action_data'],
        order: [[sequelize.literal('click_count'), 'DESC']],
        limit: limit,
        raw: true
    });
};

// ===== HOOKS POUR MISE À JOUR AUTOMATIQUE =====

// Hook pour mettre à jour updated_at
EmailCampaign.addHook('beforeUpdate', async (campaign, options) => {
    campaign.updated_at = new Date();
});

EmailTemplate.addHook('beforeUpdate', async (template, options) => {
    template.updated_at = new Date();
});


console.log('✅ Associations et méthodes des modèles initialisées (avec fonctionnalités admin)');


export { 
  Category, Jewel, Customer, Order, OrderHasJewel, Payment, JewelImage,
  OrderItem, Cart, JewelView, Favorite, Material, Type, Role, 
  OrderStatusHistory, OrderTracking, CustomerNotification,
  CustomerCommunicationPreference, Activity, HomeImage, SiteSetting,
  EmailCampaign, EmailCampaignRecipient,
  EmailTracking, EmailTemplate
};


