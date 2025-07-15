// ===================================
// app/models/emailRelations.js
// ===================================

import{ EmailCampaign}from './emailCampaignModel.js';
import{ EmailCampaignRecipient}from './emailCampaignRecipientModel.js';
import{ EmailTemplate}from './emailTemplateModel.js';
import{ EmailUnsubscribe} from './emailUnsubscribeModel.js';
import{ Customer}from './customerModel.js';

// Relations EmailCampaign
EmailCampaign.hasMany(EmailCampaignRecipient, {
    foreignKey: 'campaign_id',
    as: 'recipients'
});

EmailCampaignRecipient.belongsTo(EmailCampaign, {
    foreignKey: 'campaign_id',
    as: 'campaign'
});

// Relations EmailTemplate
EmailCampaign.belongsTo(EmailTemplate, {
    foreignKey: 'template_id',
    as: 'template'
});

EmailTemplate.hasMany(EmailCampaign, {
    foreignKey: 'template_id',
    as: 'campaigns'
});

// Relations Customer (si disponible)
if (Customer) {
    EmailCampaignRecipient.belongsTo(Customer, {
        foreignKey: 'customer_id',
        as: 'customer'
    });

    Customer.hasMany(EmailCampaignRecipient, {
        foreignKey: 'customer_id',
        as: 'emailRecipients'
    });
}

// Pas de relation directe pour EmailUnsubscribe car il peut contenir des emails
// qui ne sont pas forcément des customers enregistrés

export {
    EmailCampaign,
    EmailCampaignRecipient,
    EmailTemplate,
    EmailUnsubscribe,
    Customer
};