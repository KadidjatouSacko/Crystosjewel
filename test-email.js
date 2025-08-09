import dotenv from 'dotenv';
dotenv.config();

import { sendStatusChangeEmail } from './app/services/mailService.js';

const testEmail = async () => {
  console.log('🔥 TEST EMAIL START');
  
  const orderData = {
    id: 123,
    numero_commande: 'CMD-TEST-123',
    tracking_number: 'FR123456789',
    total: 49.99
  };

  const statusChangeData = {
    oldStatus: 'pending',
    newStatus: 'shipped',
    updatedBy: 'Admin Test'
  };

  const customerData = {
    userEmail: 'dalla.sacko@hotmail.com', // REMPLACEZ par votre email
    firstName: 'TestUser'
  };

  const result = await sendStatusChangeEmail(orderData, statusChangeData, customerData);
  console.log('🔥 TEST RESULT:', result);
};

testEmail();