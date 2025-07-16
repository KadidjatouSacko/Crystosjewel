// app/models/EmailCampaign.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js";

export class EmailCampaign extends Model {
    // Méthodes d'instance
    getOpenRate() {
        return this.sent_count > 0 ? ((this.open_count / this.sent_count) * 100).toFixed(2) : 0;
    }
    
    getClickRate() {
        return this.sent_count > 0 ? ((this.click_count / this.sent_count) * 100).toFixed(2) : 0;
    }
    
    canBeEdited() {
        return this.status === 'draft';
    }
    
    canBeSent() {
        return this.status === 'draft' || this.status === 'scheduled';
    }
}

EmailCampaign.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    subject: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    preheader: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    template: {
        type: DataTypes.STRING(50),
        defaultValue: 'elegant',
        validate: {
            isIn: [['elegant', 'modern', 'classic', 'minimal']]
        }
    },
    from_name: {
        type: DataTypes.STRING(100),
        defaultValue: 'CrystosJewel'
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'draft',
        validate: {
            isIn: [['draft', 'sent', 'scheduled', 'cancelled']]
        }
    },
    recipient_type: {
        type: DataTypes.STRING(50),
        defaultValue: 'all',
        validate: {
            isIn: [['all', 'newsletter', 'vip', 'with-orders']]
        }
    },
    selected_customer_ids: {
        type: DataTypes.TEXT,
        get() {
            const value = this.getDataValue('selected_customer_ids');
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue('selected_customer_ids', JSON.stringify(value || []));
        }
    },
    sent_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    delivered_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    open_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    click_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    unsubscribe_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    bounce_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'customer',
            key: 'id'
        }
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    tableName: 'email_campaigns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    
    hooks: {
        beforeCreate: (campaign, options) => {
            if (!campaign.name) {
                campaign.name = `Campagne ${new Date().toLocaleDateString('fr-FR')}`;
            }
        },
        
        beforeUpdate: (campaign, options) => {
            // Si on passe en "sent", enregistrer la date d'envoi
            if (campaign.changed('status') && campaign.status === 'sent' && !campaign.sent_at) {
                campaign.sent_at = new Date();
            }
        }
    }
});
