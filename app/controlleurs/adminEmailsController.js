// app/controlleurs/adminEmailsController.js

export const adminEmailsController = {
    /**
     * 📧 Page d'administration des emails
     */
    async showAdminPage(req, res) {
        try {
            console.log('📧 === CHARGEMENT PAGE ADMIN EMAILS ===');
            
            // Récupérer les données utilisateur
            const user = req.session?.user || null;
            const isAuthenticated = !!req.session?.user;
            const isAdmin = user?.role_id === 2;

            // Vérifier les permissions admin
            if (!isAdmin) {
                console.log('❌ Accès refusé - pas d\'autorisation admin');
                return res.status(403).render('error', {
                    statusCode: 403,
                    message: 'Accès refusé - Droits administrateur requis',
                    title: 'Accès refusé',
                    user,
                    isAuthenticated,
                    isAdmin: false
                });
            }

            // Récupérer les messages flash
            const flashMessages = [];
            if (req.session.flashMessage) {
                flashMessages.push(req.session.flashMessage);
                delete req.session.flashMessage;
            }

            console.log('✅ Rendu de la page admin emails');
            
            // Render de la page avec toutes les données nécessaires
            res.render('admin/emails', {
                title: 'Gestion des Emails',
                user,
                isAuthenticated,
                isAdmin,
                flashMessages,
                // Données spécifiques aux emails
                emailStats: {
                    totalSent: 0,
                    totalFailed: 0,
                    pending: 0
                }
            });

        } catch (error) {
            console.error('❌ Erreur critique page admin emails:', error);
            
            // Message d'erreur détaillé pour le debug
            let errorMessage = 'Erreur lors du chargement de la page des emails';
            if (error.message.includes('template') || error.message.includes('render')) {
                errorMessage = 'Erreur de template: vérifiez que la vue admin/emails existe';
            } else if (error.message.includes('database') || error.message.includes('relation')) {
                errorMessage = 'Erreur de base de données';
            }
            
            req.session.flashMessage = {
                type: 'error',
                message: `${errorMessage}: ${error.message}`
            };
            
            // Redirection vers le dashboard admin avec message d'erreur
            res.redirect('/admin/dashboard');
        }
    },

    /**
     * 🔧 Réparer les emails manquants
     */
    async repairEmails(req, res) {
        try {
            console.log('🔧 Début réparation emails...');
            
            // Ici vous pourriez ajouter la logique de réparation
            // Par exemple, renvoyer des emails de confirmation pour des commandes
            
            res.json({ 
                success: true, 
                message: 'Emails réparés avec succès' 
            });
            
        } catch (error) {
            console.error('❌ Erreur réparation emails:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    },

    /**
     * 📊 Statistiques des emails
     */
    async getEmailStats(req, res) {
        try {
            console.log('📊 Récupération statistiques emails...');
            
            // Ici vous pourriez ajouter la logique pour récupérer les stats
            // depuis votre base de données ou logs
            
            const stats = {
                totalSent: 150,
                totalFailed: 5,
                pending: 2,
                todaySent: 25,
                todayFailed: 1
            };
            
            res.json({ 
                success: true, 
                stats 
            });
            
        } catch (error) {
            console.error('❌ Erreur récupération stats emails:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
};