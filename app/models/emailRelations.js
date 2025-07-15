// ===================================
// app/models/emailRelations.js - VOTRE FORMAT
// ===================================

import { EmailCampaign } from './emailCampaignModel.js';
import { EmailCampaignRecipient } from './emailCampaignRecipientModel.js';
import { EmailTemplate } from './emailTemplateModel.js';
import { EmailUnsubscribe } from './emailUnsubscribeModel.js';

// Import conditionnel pour Customer
let Customer = null;
try {
    const customerModule = await import('./customerModel.js');
    Customer = customerModule.Customer;
} catch (error) {
    console.log('ℹ️  Customer model non trouvé, relations email fonctionneront sans Customer');
}

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

export {
    EmailCampaign,
    EmailCampaignRecipient,
    EmailTemplate,
    EmailUnsubscribe,
    Customer
};