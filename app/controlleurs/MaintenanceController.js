// app/controlleurs/maintenanceController.js
import { maintenance } from '../utils/maintenance.js';

/**
 * Contrôleur pour la gestion de la maintenance du site
 */
export const maintenanceController = {

    /**
     * Page de maintenance pour les visiteurs
     */
    showMaintenancePage: (req, res) => {
        console.log('🔧 Affichage page maintenance pour:', {
            isAdmin: req.session?.user?.role_id === 2,
            userId: req.session?.user?.id,
            maintenanceActive: maintenance.isActive()
        });

        const maintenanceData = maintenance.getStatus();
        
        res.render('maintenance', {
            title: 'Maintenance en cours - CrustosJewel',
            maintenance: {
                active: maintenanceData.isActive,
                activatedAt: maintenanceData.startTime,
                endTime: maintenanceData.endTime,
                reason: maintenanceData.message
            },
            user: req.session?.user || null,
            isAdmin: req.session?.user?.role_id === 2,
            isAuthenticated: !!req.session?.user
        });
    },
    
    /**
     * API: Activer la maintenance immédiatement
     */
    activateMaintenance: (req, res) => {
        try {
            const { duration, message } = req.body;
            
            // Validation
            if (!duration || isNaN(duration) || duration <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Durée invalide (en minutes)'
                });
            }
            
            const result = maintenance.start(parseInt(duration), message);
            
            console.log('🔧 Maintenance activée immédiatement par admin:', req.session.user.email);
            
            res.json({
                success: true,
                message: `Maintenance activée pour ${duration} minutes`,
                maintenance: result
            });
            
        } catch (error) {
            console.error('❌ Erreur activation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'activation de la maintenance'
            });
        }
    },
    
    /**
     * API: Programmer la maintenance
     */
    scheduleMaintenance: (req, res) => {
        try {
            const { startTime, endTime, message } = req.body;
            
            if (!startTime || !endTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Dates de début et fin requises'
                });
            }
            
            const result = maintenance.schedule(startTime, endTime, message);
            
            console.log('⏰ Maintenance programmée par admin:', req.session.user.email);
            
            res.json({
                success: true,
                message: `Maintenance programmée du ${new Date(startTime).toLocaleString('fr-FR')} au ${new Date(endTime).toLocaleString('fr-FR')}`,
                maintenance: result
            });
            
        } catch (error) {
            console.error('❌ Erreur programmation maintenance:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    },
    
    /**
     * API: Annuler la maintenance programmée
     */
    cancelScheduledMaintenance: (req, res) => {
        try {
            const result = maintenance.cancelScheduled();
            
            console.log('❌ Maintenance programmée annulée par admin:', req.session.user.email);
            
            res.json({
                success: true,
                message: 'Maintenance programmée annulée'
            });
            
        } catch (error) {
            console.error('❌ Erreur annulation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'annulation'
            });
        }
    },
    
    /**
     * API: Désactiver la maintenance
     */
    deactivateMaintenance: (req, res) => {
        try {
            const result = maintenance.stop();
            
            console.log('✅ Maintenance désactivée par admin:', req.session.user.email);
            
            res.json({
                success: true,
                message: 'Maintenance désactivée',
                maintenance: result
            });
            
        } catch (error) {
            console.error('❌ Erreur désactivation maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la désactivation'
            });
        }
    },
    
    /**
     * API: Obtenir le statut de maintenance
     */
    getMaintenanceStatus: (req, res) => {
        try {
            const status = maintenance.getStatus();
            
            console.log('📊 Statut maintenance demandé par:', {
                isAdmin: req.session?.user?.role_id === 2,
                userId: req.session?.user?.id
            });

            res.json({
                success: true,
                maintenance: {
                    active: status.isActive
                },
                status: status
            });
        } catch (error) {
            console.error('❌ Erreur statut maintenance:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du statut'
            });
        }
    }
};