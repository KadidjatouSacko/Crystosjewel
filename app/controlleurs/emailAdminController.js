// app/controlleurs/emailAdminController.js
import { EmailTemplate } from '../models/emailTemplateModel.js';
import { EmailLog } from '../models/emailLogModel.js';
import { Customer } from '../models/customerModel.js';
import { sequelize } from '../models/sequelize-client.js';
import { QueryTypes } from 'sequelize';
import { emailManagementControlleur } from './emailManagementController.js';

const emailAdminController = {

    /**
     * 📧 Page principale de gestion des emails
     */
    async renderEmailManagement(req, res) {
        try {
            console.log('📧 Rendu page gestion des emails');

            // Récupérer les templates
            const templates = await EmailTemplate.findAll({
                order: [['updated_at', 'DESC']]
            });

            // Récupérer les emails récents
            const recentEmails = await sequelize.query(`
                SELECT 
                    el.*,
                    et.template_name,
                    et.email_type
                FROM email_logs el
                LEFT JOIN email_templates et ON el.template_id = et.id
                ORDER BY el.created_at DESC
                LIMIT 50
            `, {
                type: QueryTypes.SELECT
            });

            // Calculer les stats
            const stats = await this.calculateEmailStats();

            // Stats par template
            const templateStats = await this.getTemplateStats();

            // Pagination pour les emails
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;

            const { count: totalEmails } = await EmailLog.findAndCountAll();
            const totalPages = Math.ceil(totalEmails / limit);

            const pagination = {
                currentPage: page,
                totalPages,
                total: totalEmails,
                limit,
                offset
            };

            const customers = await sequelize.query(`SELECT * FROM customers`, {
    type: QueryTypes.SELECT
});

            res.render('admin/email-management', {
                title: 'Gestion des Emails',
                templates,
                recentEmails,
                stats,
                customers: [],
                recentCampaigns: recentEmails,
                templateStats,
                pagination,
                success: req.session.flashMessage?.type === 'success' ? req.session.flashMessage.message : null,
                error: req.session.flashMessage?.type === 'error' ? req.session.flashMessage.message : null
            });

            // Nettoyer le message flash
            delete req.session.flashMessage;

        } catch (error) {
            console.error('❌ Erreur page gestion emails:', error);
            res.status(500).render('admin/email-management', {
                title: 'Gestion des Emails',
                templates: [],
                recentEmails: [],
                stats: {},
                templateStats: {},
                pagination: {},
                error: 'Erreur lors du chargement de la page'
            });
        }
    },

    /**
     * ✏️ Page éditeur d'email
     */
    async renderEmailEditor(req, res) {
        try {
            console.log('✏️ Rendu page éditeur d\'email');

            const templateId = req.query.template;
            let currentTemplate = null;

            // Charger le template si ID fourni
            if (templateId) {
                currentTemplate = await EmailTemplate.findByPk(templateId);
                if (!currentTemplate) {
                    req.session.flashMessage = {
                        type: 'error',
                        message: 'Template non trouvé'
                    };
                    return res.redirect('/admin/email-management');
                }
            }

            // Récupérer tous les templates pour le sélecteur
            const templates = await EmailTemplate.findAll({
                order: [['template_name', 'ASC']]
            });

            res.render('admin/email-editor', {
                title: currentTemplate ? `Édition - ${currentTemplate.template_name}` : 'Nouvel Email',
                currentTemplate,
                templates,
                success: req.session.flashMessage?.type === 'success' ? req.session.flashMessage.message : null,
                error: req.session.flashMessage?.type === 'error' ? req.session.flashMessage.message : null
            });

            // Nettoyer le message flash
            delete req.session.flashMessage;

        } catch (error) {
            console.error('❌ Erreur page éditeur email:', error);
            res.status(500).render('admin/email-editor', {
                title: 'Éditeur d\'Email',
                currentTemplate: null,
                templates: [],
                error: 'Erreur lors du chargement de l\'éditeur'
            });
        }
    },

    /**
     * 💾 Créer un nouveau template
     */
    async createTemplate(req, res) {
        try {
            console.log('💾 Création nouveau template email:', req.body);

            const {
                template_name,
                subject,
                html_content,
                email_type,
                is_active
            } = req.body;

            // Validation
            if (!template_name || !subject || !html_content) {
                return res.status(400).json({
                    success: false,
                    message: 'Nom, sujet et contenu sont requis'
                });
            }

            // Vérifier l'unicité du nom
            const existingTemplate = await EmailTemplate.findOne({
                where: { template_name }
            });

            if (existingTemplate) {
                return res.status(400).json({
                    success: false,
                    message: 'Un template avec ce nom existe déjà'
                });
            }

            // Créer le template
            const template = await EmailTemplate.create({
                template_name,
                subject,
                html_content,
                email_type: email_type || 'newsletter',
                is_active: is_active === true || is_active === 'true',
                created_at: new Date(),
                updated_at: new Date()
            });

            console.log(`✅ Template créé: ${template.template_name} (ID: ${template.id})`);

            res.json({
                success: true,
                message: 'Template créé avec succès',
                template: {
                    id: template.id,
                    template_name: template.template_name
                }
            });

        } catch (error) {
            console.error('❌ Erreur création template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création du template'
            });
        }
    },

    /**
     * 📝 Mettre à jour un template existant
     */
    async updateTemplate(req, res) {
        try {
            const { id } = req.params;
            console.log(`📝 Mise à jour template ${id}:`, req.body);

            const template = await EmailTemplate.findByPk(id);
            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Template non trouvé'
                });
            }

            const {
                template_name,
                subject,
                html_content,
                email_type,
                is_active
            } = req.body;

            // Vérifier l'unicité du nom (sauf pour ce template)
            if (template_name && template_name !== template.template_name) {
                const existingTemplate = await EmailTemplate.findOne({
                    where: { 
                        template_name,
                        id: { [sequelize.Sequelize.Op.ne]: id }
                    }
                });

                if (existingTemplate) {
                    return res.status(400).json({
                        success: false,
                        message: 'Un template avec ce nom existe déjà'
                    });
                }
            }

            // Mettre à jour
            await template.update({
                template_name: template_name || template.template_name,
                subject: subject || template.subject,
                html_content: html_content || template.html_content,
                email_type: email_type || template.email_type,
                is_active: is_active !== undefined ? (is_active === true || is_active === 'true') : template.is_active,
                updated_at: new Date()
            });

            console.log(`✅ Template mis à jour: ${template.template_name}`);

            res.json({
                success: true,
                message: 'Template mis à jour avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur mise à jour template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour'
            });
        }
    },

    /**
     * 🔄 Dupliquer un template
     */
    async duplicateTemplate(req, res) {
        try {
            const { id } = req.params;
            console.log(`🔄 Duplication template ${id}`);

            const originalTemplate = await EmailTemplate.findByPk(id);
            if (!originalTemplate) {
                return res.status(404).json({
                    success: false,
                    message: 'Template non trouvé'
                });
            }

            // Créer un nom unique
            let newName = `${originalTemplate.template_name} - Copie`;
            let counter = 1;
            while (await EmailTemplate.findOne({ where: { template_name: newName } })) {
                newName = `${originalTemplate.template_name} - Copie ${counter}`;
                counter++;
            }

            // Créer la copie
            const duplicate = await EmailTemplate.create({
                template_name: newName,
                subject: originalTemplate.subject,
                html_content: originalTemplate.html_content,
                email_type: originalTemplate.email_type,
                is_active: false, // Les copies sont inactives par défaut
                created_at: new Date(),
                updated_at: new Date()
            });

            console.log(`✅ Template dupliqué: ${duplicate.template_name}`);

            res.json({
                success: true,
                message: 'Template dupliqué avec succès',
                template: duplicate
            });

        } catch (error) {
            console.error('❌ Erreur duplication template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la duplication'
            });
        }
    },

    /**
     * 🔄 Activer/désactiver un template
     */
    async toggleTemplate(req, res) {
        try {
            const { id } = req.params;
            const { is_active } = req.body;

            console.log(`🔄 Toggle template ${id}: ${is_active}`);

            const template = await EmailTemplate.findByPk(id);
            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Template non trouvé'
                });
            }

            await template.update({
                is_active: is_active === true || is_active === 'true',
                updated_at: new Date()
            });

            console.log(`✅ Template ${is_active ? 'activé' : 'désactivé'}: ${template.template_name}`);

            res.json({
                success: true,
                message: `Template ${is_active ? 'activé' : 'désactivé'} avec succès`
            });

        } catch (error) {
            console.error('❌ Erreur toggle template:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la modification'
            });
        }
    },

    /**
     * 👁️ Aperçu d'un template
     */
    async previewTemplate(req, res) {
        try {
            const { id } = req.params;

            const template = await EmailTemplate.findByPk(id);
            if (!template) {
                return res.status(404).send('Template non trouvé');
            }

            // Variables de test pour l'aperçu
            const testVariables = {
                customerName: 'Jean Dupont',
                orderNumber: 'CMD-2025-001',
                total: '89.90 €',
                orderDate: new Date().toLocaleDateString('fr-FR'),
                trackingNumber: 'FR123456789',
                companyName: 'Bijoux Précieux'
            };

            // Remplacer les variables dans le contenu
            let previewContent = template.html_content;
            Object.keys(testVariables).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                previewContent = previewContent.replace(regex, testVariables[key]);
            });

            // Générer la page d'aperçu
            const previewHTML = `
                <!DOCTYPE html>
                <html lang="fr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Aperçu - ${template.subject}</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 0; 
                            padding: 20px; 
                            background: #f5f5f5; 
                        }
                        .preview-container {
                            max-width: 600px;
                            margin: 0 auto;
                            background: white;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            overflow: hidden;
                        }
                        .preview-header {
                            background: #E8B4B8;
                            color: white;
                            padding: 15px 20px;
                            font-weight: bold;
                        }
                        .preview-content {
                            padding: 20px;
                        }
                        .preview-footer {
                            background: #f8f9fa;
                            padding: 15px 20px;
                            font-size: 12px;
                            color: #666;
                            border-top: 1px solid #eee;
                        }
                        img { max-width: 100%; height: auto; }
                        table { border-collapse: collapse; width: 100%; }
                        td, th { border: 1px solid #ddd; padding: 8px; }
                    </style>
                </head>
                <body>
                    <div class="preview-container">
                        <div class="preview-header">
                            📧 Aperçu: ${template.subject}
                        </div>
                        <div class="preview-content">
                            ${previewContent}
                        </div>
                        <div class="preview-footer">
                            <strong>Template:</strong> ${template.template_name} | 
                            <strong>Type:</strong> ${template.email_type} | 
                            <strong>Statut:</strong> ${template.is_active ? 'Actif' : 'Inactif'}
                            <br><br>
                            <em>Ceci est un aperçu avec des données de test. Les variables réelles seront remplacées lors de l'envoi.</em>
                        </div>
                    </div>
                </body>
                </html>
            `;

            res.send(previewHTML);

        } catch (error) {
            console.error('❌ Erreur aperçu template:', error);
            res.status(500).send('Erreur lors de l\'aperçu');
        }
    },

    /**
     * ✉️ Envoyer un email de test
     */
    async sendTestEmail(req, res) {
        try {
            console.log('✉️ Envoi email de test:', req.body);

            const { to, subject, html_content } = req.body;

            if (!to || !subject || !html_content) {
                return res.status(400).json({
                    success: false,
                    message: 'Destinataire, sujet et contenu requis'
                });
            }

            // Importer le service d'email
            const { transporter } = await import('../services/mailService.js');

            // Variables de test
            const testVariables = {
                customerName: 'Utilisateur Test',
                orderNumber: 'TEST-001',
                total: '0.00 €',
                orderDate: new Date().toLocaleDateString('fr-FR'),
                trackingNumber: 'TEST123',
                companyName: 'Bijoux Précieux'
            };

            // Remplacer les variables dans le contenu
            let finalContent = html_content;
            Object.keys(testVariables).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                finalContent = finalContent.replace(regex, testVariables[key]);
            });

            // Ajouter un header de test
            const testHTML = `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
                    <strong>🧪 EMAIL DE TEST</strong><br>
                    <small>Cet email a été envoyé depuis l'éditeur d'email pour des tests. Les variables ont été remplacées par des valeurs de test.</small>
                </div>
                ${finalContent}
            `;

            // Envoyer l'email
            await transporter.sendMail({
                from: `"Bijoux Précieux - Test" <${process.env.MAIL_USER}>`,
                to: to,
                subject: `[TEST] ${subject}`,
                html: testHTML
            });

            console.log(`✅ Email de test envoyé à ${to}`);

            res.json({
                success: true,
                message: 'Email de test envoyé avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur envoi email test:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de l\'email de test'
            });
        }
    },

    /**
     * 📊 Calculer les statistiques des emails
     */
    async calculateEmailStats() {
        try {
            const stats = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_sent,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as monthly_total,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' THEN 1 END) as previous_monthly_total
                FROM email_logs
            `, {
                type: QueryTypes.SELECT
            });

            const result = stats[0];
            
            // Calculer la croissance mensuelle
            const monthlyGrowth = result.previous_monthly_total > 0 
                ? ((result.monthly_total - result.previous_monthly_total) / result.previous_monthly_total * 100).toFixed(1)
                : 0;

            return {
                totalSent: parseInt(result.total_sent) || 0,
                successful: parseInt(result.successful) || 0,
                totalFailed: parseInt(result.failed) || 0,
                pending: parseInt(result.pending) || 0,
                monthlyGrowth: parseFloat(monthlyGrowth) || 0
            };

        } catch (error) {
            console.error('❌ Erreur calcul stats:', error);
            return {
                totalSent: 0,
                successful: 0,
                totalFailed: 0,
                pending: 0,
                monthlyGrowth: 0
            };
        }
    },

    /**
     * 📈 Obtenir les stats par template
     */
    async getTemplateStats() {
        try {
            const stats = await sequelize.query(`
                SELECT 
                    template_id,
                    COUNT(*) as usage_count,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful_count
                FROM email_logs
                WHERE template_id IS NOT NULL
                GROUP BY template_id
            `, {
                type: QueryTypes.SELECT
            });

            const result = {};
            stats.forEach(stat => {
                result[stat.template_id] = {
                    usage: parseInt(stat.usage_count),
                    successful: parseInt(stat.successful_count)
                };
            });

            return result;

        } catch (error) {
            console.error('❌ Erreur stats templates:', error);
            return {};
        }
    },

    /**
     * 📊 API pour récupérer les stats en temps réel
     */
    async getEmailStatsAPI(req, res) {
        try {
            const stats = await this.calculateEmailStats();
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('❌ Erreur API stats:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des stats'
            });
        }
    },

    /**
     * 👀 Voir le contenu d'un email envoyé
     */
    async viewEmailLog(req, res) {
        try {
            const { id } = req.params;

            const emailLog = await EmailLog.findByPk(id);
            if (!emailLog) {
                return res.status(404).send('Email non trouvé');
            }

            // Récupérer le template si disponible
            let template = null;
            if (emailLog.template_id) {
                template = await EmailTemplate.findByPk(emailLog.template_id);
            }

            const viewHTML = `
                <!DOCTYPE html>
                <html lang="fr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Log - ${emailLog.subject}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                        .email-header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                        .email-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px; }
                        .meta-item { display: flex; }
                        .meta-label { font-weight: bold; margin-right: 10px; min-width: 80px; }
                        .status-sent { color: #10b981; }
                        .status-failed { color: #ef4444; }
                        .status-pending { color: #f59e0b; }
                        .email-content { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
                        .error-message { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; padding: 15px; border-radius: 5px; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="email-header">
                        <h1>📧 ${emailLog.subject}</h1>
                        <div class="email-meta">
                            <div class="meta-item">
                                <span class="meta-label">À:</span>
                                <span>${emailLog.recipient_email}</span>
                            </div>
                            <div class="meta-item">
                                <span class="meta-label">Statut:</span>
                                <span class="status-${emailLog.status}">${emailLog.status === 'sent' ? 'Envoyé' : emailLog.status === 'failed' ? 'Échec' : 'En attente'}</span>
                            </div>
                            <div class="meta-item">
                                <span class="meta-label">Date:</span>
                                <span>${new Date(emailLog.sent_at || emailLog.created_at).toLocaleString('fr-FR')}</span>
                            </div>
                            <div class="meta-item">
                                <span class="meta-label">Type:</span>
                                <span>${emailLog.email_type || 'Non spécifié'}</span>
                            </div>
                            ${template ? `
                            <div class="meta-item">
                                <span class="meta-label">Template:</span>
                                <span>${template.template_name}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="email-content">
                        ${emailLog.html_content || emailLog.text_content || '<em>Contenu non disponible</em>'}
                    </div>
                    
                    ${emailLog.error_message ? `
                    <div class="error-message">
                        <strong>Erreur:</strong> ${emailLog.error_message}
                    </div>
                    ` : ''}
                </body>
                </html>
            `;

            res.send(viewHTML);

        } catch (error) {
            console.error('❌ Erreur visualisation email:', error);
            res.status(500).send('Erreur lors de la visualisation');
        }
    },

    /**
     * 🔄 Renvoyer un email échoué
     */
    async resendEmail(req, res) {
        try {
            const { id } = req.params;
            console.log(`🔄 Renvoi email ${id}`);

            const emailLog = await EmailLog.findByPk(id);
            if (!emailLog) {
                return res.status(404).json({
                    success: false,
                    message: 'Email non trouvé'
                });
            }

            if (emailLog.status !== 'failed') {
                return res.status(400).json({
                    success: false,
                    message: 'Seuls les emails échoués peuvent être renvoyés'
                });
            }

            // Importer le service d'email
            const { transporter } = await import('../services/mailService.js');

            // Renvoyer l'email
            await transporter.sendMail({
                from: `"Bijoux Précieux" <${process.env.MAIL_USER}>`,
                to: emailLog.recipient_email,
                subject: emailLog.subject,
                html: emailLog.html_content || undefined,
                text: emailLog.text_content || undefined
            });

            // Mettre à jour le statut
            await emailLog.update({
                status: 'sent',
                sent_at: new Date(),
                error_message: null
            });

            console.log(`✅ Email renvoyé avec succès à ${emailLog.recipient_email}`);

            res.json({
                success: true,
                message: 'Email renvoyé avec succès'
            });

        } catch (error) {
            console.error('❌ Erreur renvoi email:', error);
            
            // Mettre à jour l'erreur dans le log
            const emailLog = await EmailLog.findByPk(req.params.id);
            if (emailLog) {
                await emailLog.update({
                    error_message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur lors du renvoi de l\'email'
            });
        }
    },

    
};

export default emailAdminController;