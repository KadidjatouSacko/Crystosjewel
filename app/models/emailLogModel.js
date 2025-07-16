// ==========================================
// 📧 MODÈLE EMAIL LOG
// ==========================================

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";
import Customer from "./customerModel.js";

export class EmailLog extends Model {}

EmailLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'customer',
        key: 'id'
      }
    },
    email_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'campaign',
      validate: {
        isIn: [['campaign', 'promotional', 'newsletter', 'transactional', 'welcome', 'order_confirmation', 'shipping']]
      }
    },
    recipient_email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    html_content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    text_content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'sent', 'failed', 'bounced', 'delivered', 'opened', 'clicked']]
      }
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    opened_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clicked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    bounced_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    unsubscribed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    campaign_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'email_templates',
        key: 'id'
      }
    },
    tracking_pixel_opened: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    links_clicked: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "email_logs",
    timestamps: false,
    indexes: [
      {
        fields: ['recipient_email']
      },
      {
        fields: ['status']
      },
      {
        fields: ['email_type']
      },
      {
        fields: ['campaign_id']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['sent_at']
      }
    ]
  }
);

// ==========================================
// 📊 MÉTHODES STATIQUES POUR LES STATISTIQUES
// ==========================================

EmailLog.getStatsByPeriod = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date']
    ],
    where: {
      created_at: {
        [sequelize.Op.gte]: startDate
      }
    },
    group: ['status', sequelize.fn('DATE', sequelize.col('created_at'))],
    order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'DESC']]
  });

  return stats;
};

EmailLog.getCampaignStats = async function(campaignId) {
  const stats = await this.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      campaign_id: campaignId
    },
    group: ['status']
  });

  const result = {
    total: 0,
    sent: 0,
    failed: 0,
    opened: 0,
    clicked: 0,
    bounced: 0
  };

  stats.forEach(stat => {
    const count = parseInt(stat.dataValues.count);
    result.total += count;
    result[stat.status] = count;
  });

  result.openRate = result.sent > 0 ? Math.round((result.opened / result.sent) * 100) : 0;
  result.clickRate = result.sent > 0 ? Math.round((result.clicked / result.sent) * 100) : 0;
  result.bounceRate = result.sent > 0 ? Math.round((result.bounced / result.sent) * 100) : 0;

  return result;
};

EmailLog.getTopCampaigns = async function(limit = 10) {
  const campaigns = await this.findAll({
    attributes: [
      'campaign_id',
      'subject',
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_sent'],
      [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'opened' THEN 1 ELSE 0 END")), 'total_opened'],
      [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'clicked' THEN 1 ELSE 0 END")), 'total_clicked'],
      [sequelize.fn('MIN', sequelize.col('created_at')), 'created_at']
    ],
    where: {
      campaign_id: {
        [sequelize.Op.ne]: null
      },
      status: ['sent', 'opened', 'clicked']
    },
    group: ['campaign_id', 'subject'],
    order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
    limit: limit
  });

  return campaigns.map(campaign => {
    const data = campaign.dataValues;
    const totalSent = parseInt(data.total_sent) || 0;
    const totalOpened = parseInt(data.total_opened) || 0;
    const totalClicked = parseInt(data.total_clicked) || 0;

    return {
      campaignId: data.campaign_id,
      subject: data.subject,
      totalSent,
      totalOpened,
      totalClicked,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
      createdAt: data.created_at
    };
  });
};

EmailLog.getRecentActivity = async function(limit = 20) {
  return await this.findAll({
    attributes: [
      'recipient_email',
      'subject',
      'status',
      'email_type',
      'created_at',
      'sent_at',
      'opened_at',
      'clicked_at'
    ],
    order: [['created_at', 'DESC']],
    limit: limit
  });
};

export default EmailLog;