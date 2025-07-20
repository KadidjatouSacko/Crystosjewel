// ===================================================================
// CONTRÔLEUR EMAIL MANAGEMENT COMPLET (app/controllers/emailController.js)
// ===================================================================

import { 
  sendOrderConfirmationEmails, 
  sendPromotionalEmail, 
  sendWelcomeEmail,
  verifyEmailConnection 
} from '../services/mailService.js';
import { Customer } from '../models/customerModel.js';
import { EmailTemplate } from '../models/emailTemplateModel.js';
import { EmailLog } from '../models/emailLogModel.js';
import { sequelize } from '../models/sequelize-client.js'; // ✅ AJOUT MANQUANT
import { Op } from 'sequelize';

export const emailController = {
  
  // ✅ PAGE PRINCIPALE - Dashboard emails (sans dépendances des modèles)
  async index(req, res) {
    try {
      console.log('📧 Accès au dashboard email management');
      
      // Vérifier la connexion email
      const emailConnected = await verifyEmailConnection();
      
      // Statistiques récentes (requête SQL directe)
      let stats = [];
      try {
        const [statsResult] = await sequelize.query(`
          SELECT status, COUNT(*) as count 
          FROM email_logs 
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY status
        `);
        stats = statsResult;
      } catch (error) {
        console.error('⚠️ Table email_logs non trouvée, stats non disponibles');
        stats = [];
      }
      
      // Templates disponibles (requête SQL directe)
      let templates = [];
      try {
        const [templatesResult] = await sequelize.query(`
          SELECT * FROM email_templates 
          WHERE is_active = true 
          ORDER BY template_name ASC
        `);
        templates = templatesResult;
      } catch (error) {
        console.error('⚠️ Table email_templates non trouvée, templates non disponibles');
        templates = [];
      }
      
      // Emails récents (requête SQL directe)
      let recentEmails = [];
      try {
        const [emailsResult] = await sequelize.query(`
          SELECT 
            el.*,
            c.firstName,
            c.lastName
          FROM email_logs el
          LEFT JOIN customer c ON el.customer_id = c.id
          ORDER BY el.created_at DESC
          LIMIT 10
        `);
        recentEmails = emailsResult;
      } catch (error) {
        console.error('⚠️ Erreur récupération emails récents');
        recentEmails = [];
      }
      
      res.render('email-management/index', {
        title: 'Gestion des Emails',
        emailConnected,
        stats,
        templates,
        recentEmails,
        user: req.session.user
      });
      
    } catch (error) {
      console.error('❌ Erreur dashboard emails:', error);
      res.status(500).render('error', {
        message: 'Erreur lors du chargement du dashboard emails. Assurez-vous que les tables email sont créées.',
        error: error
      });
    }
  },

  // ✅ TEST DE CONNEXION EMAIL
  async testConnection(req, res) {
    try {
      console.log('🔍 Test de la connexion email...');
      
      const isConnected = await verifyEmailConnection();
      
      if (isConnected) {
        res.json({
          success: true,
          message: 'Connexion email validée avec succès'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Échec de la connexion email'
        });
      }
      
    } catch (error) {
      console.error('❌ Erreur test connexion:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du test de connexion'
      });
    }
  },

  // ✅ ENVOI EMAIL DE TEST
  async sendTestEmail(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Adresse email requise'
        });
      }

      console.log(`📧 Envoi email de test vers: ${email}`);
      
      const result = await sendWelcomeEmail(email, 'Test');
      
      // Logger le test (requête SQL directe)
      try {
        await sequelize.query(`
          INSERT INTO email_logs (email_type, recipient_email, subject, status, sent_at, error_message)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, {
          bind: [
            'test',
            email,
            'Email de test - CrystosJewel',
            result.success ? 'sent' : 'failed',
            result.success ? new Date() : null,
            result.success ? null : result.error
          ]
        });
      } catch (logError) {
        console.error('⚠️ Erreur log email (table manquante?):', logError.message);
      }

      if (result.success) {
        res.json({
          success: true,
          message: 'Email de test envoyé avec succès'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Échec de l\'envoi de l\'email de test',
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('❌ Erreur envoi email test:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi de l\'email de test'
      });
    }
  },

  // ✅ ENVOI EMAIL PROMOTIONNEL
  async sendPromotional(req, res) {
    try {
      const { 
        subject, 
        title, 
        description, 
        discount, 
        promoCode, 
        expiryDate, 
        targetUsers 
      } = req.body;

      // Validation
      if (!subject || !title || !description) {
        return res.status(400).json({
          success: false,
          message: 'Informations manquantes pour l\'email promotionnel'
        });
      }

      // Récupérer les clients (requête SQL directe)
      let whereClause = '';
      if (targetUsers === 'verified') {
        whereClause = 'WHERE isEmailVerified = true';
      }

      const [customers] = await sequelize.query(`
        SELECT id, firstName, email 
        FROM customer 
        ${whereClause}
        ORDER BY id
      `);

      console.log(`📧 Envoi email promotionnel à ${customers.length} clients`);

      const promoData = {
        subject,
        title,
        description,
        discount: discount || 0,
        promoCode: promoCode || '',
        expiryDate: expiryDate || 'Durée limitée'
      };

      // Envoyer les emails
      const batchSize = 10;
      let sentCount = 0;
      let errorCount = 0;

      for (let i = 0; i < customers.length; i += batchSize) {
        const batch = customers.slice(i, i + batchSize);
        
        const emailPromises = batch.map(async (customer) => {
          try {
            const result = await sendPromotionalEmail(
              customer.email,
              customer.firstName,
              promoData
            );
            
            // Logger le résultat
            try {
              await sequelize.query(`
                INSERT INTO email_logs (customer_id, email_type, recipient_email, subject, status, sent_at, error_message)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, {
                bind: [
                  customer.id,
                  'promotional',
                  customer.email,
                  subject,
                  result.success ? 'sent' : 'failed',
                  result.success ? new Date() : null,
                  result.success ? null : result.error
                ]
              });
            } catch (logError) {
              console.error('⚠️ Erreur log email:', logError.message);
            }
            
            if (result.success) {
              sentCount++;
            } else {
              errorCount++;
            }
            
            return result;
          } catch (error) {
            console.error(`Erreur email pour ${customer.email}:`, error);
            errorCount++;
            return { success: false };
          }
        });

        await Promise.all(emailPromises);
        
        // Pause entre les lots
        if (i + batchSize < customers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Emails envoyés: ${sentCount}, Erreurs: ${errorCount}`);

      res.json({
        success: true,
        message: `Email promotionnel envoyé avec succès à ${sentCount} clients`,
        stats: {
          sent: sentCount,
          failed: errorCount,
          total: customers.length
        }
      });

    } catch (error) {
      console.error('❌ Erreur envoi email promotionnel:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi de l\'email promotionnel'
      });
    }
  },

  // ✅ HISTORIQUE DES EMAILS
  async getEmailHistory(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      
      const { email_type, status, customer_id } = req.query;
      
      let whereClause = {};
      
      if (email_type) whereClause.email_type = email_type;
      if (status) whereClause.status = status;
      if (customer_id) whereClause.customer_id = customer_id;
      
      const { count, rows } = await EmailLog.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: Customer,
            attributes: ['firstName', 'lastName'],
            required: false
          }
        ]
      });
      
      res.json({
        success: true,
        data: {
          emails: rows,
          pagination: {
            page,
            limit,
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération historique emails:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'historique'
      });
    }
  },

  // ✅ GESTION DES TEMPLATES
  async getTemplates(req, res) {
    try {
      const templates = await EmailTemplate.findAll({
        order: [['template_name', 'ASC']]
      });
      
      res.json({
        success: true,
        templates
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération templates:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des templates'
      });
    }
  },

  // ✅ CRÉER/MODIFIER TEMPLATE
  async saveTemplate(req, res) {
    try {
      const { id, template_name, subject, html_content, text_content, variables, is_active } = req.body;
      
      if (!template_name || !subject || !html_content) {
        return res.status(400).json({
          success: false,
          message: 'Nom du template, sujet et contenu HTML requis'
        });
      }
      
      const templateData = {
        template_name,
        subject,
        html_content,
        text_content: text_content || '',
        variables: variables || {},
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date()
      };
      
      let template;
      
      if (id) {
        // Modification
        template = await EmailTemplate.findByPk(id);
        if (!template) {
          return res.status(404).json({
            success: false,
            message: 'Template non trouvé'
          });
        }
        
        await template.update(templateData);
        console.log(`✅ Template modifié: ${template_name}`);
        
      } else {
        // Création
        template = await EmailTemplate.create({
          ...templateData,
          created_at: new Date()
        });
        console.log(`✅ Template créé: ${template_name}`);
      }
      
      res.json({
        success: true,
        message: id ? 'Template modifié avec succès' : 'Template créé avec succès',
        template
      });
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde template:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sauvegarde du template'
      });
    }
  },

  // ✅ SUPPRIMER TEMPLATE
  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      
      const template = await EmailTemplate.findByPk(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template non trouvé'
        });
      }
      
      await template.destroy();
      console.log(`🗑️ Template supprimé: ${template.template_name}`);
      
      res.json({
        success: true,
        message: 'Template supprimé avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur suppression template:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du template'
      });
    }
  },

  // ✅ STATISTIQUES EMAILS
  async getEmailStats(req, res) {
    try {
      const { period = '30' } = req.query; // jours
      const daysAgo = parseInt(period);
      
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      
      // Stats par statut
      const statusStats = await EmailLog.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          created_at: { [Op.gte]: startDate }
        },
        group: ['status'],
        raw: true
      });
      
      // Stats par type
      const typeStats = await EmailLog.findAll({
        attributes: [
          'email_type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          created_at: { [Op.gte]: startDate }
        },
        group: ['email_type'],
        raw: true
      });
      
      // Stats par jour
      const dailyStats = await EmailLog.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          created_at: { [Op.gte]: startDate }
        },
        group: [sequelize.fn('DATE', sequelize.col('created_at')), 'status'],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true
      });
      
      res.json({
        success: true,
        stats: {
          status: statusStats,
          type: typeStats,
          daily: dailyStats
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération stats emails:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
};

