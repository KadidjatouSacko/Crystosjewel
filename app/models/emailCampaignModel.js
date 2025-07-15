import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";
import { Customer } from "./customerModel.js";

export class EmailCampaign extends Model {}

EmailCampaign.init({
     id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    template_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'email_templates',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'sent', 'failed'),
        defaultValue: 'draft'
    },
    scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    total_recipients: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_sent: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_delivered: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_opened: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_clicked: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_bounced: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_unsubscribed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sender_email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    sender_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    reply_to: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    tracking_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {}
    }
}, {
    sequelize,
    tableName: 'email_campaigns',
    timestamps: true,
    indexes: [
        {
            fields: ['status']
        },
        {
            fields: ['scheduled_at']
        },
        {
            fields: ['sent_at']
        },
        {
            fields: ['template_id']
        }
    ]
});



// Relations
EmailCampaign.belongsTo(Customer, { foreignKey: 'created_by', as: 'creator' });