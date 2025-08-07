// app/utils/maintenance.js - FICHIER ULTRA SIMPLE
let maintenanceEndTime = null;
let maintenanceActive = false;

export const maintenance = {
    // Activer maintenance avec durée en MINUTES
    start(durationMinutes, message = 'Maintenance en cours...') {
        maintenanceActive = true;
        maintenanceEndTime = new Date(Date.now() + durationMinutes * 60 * 1000);
        
        console.log(`🔧 Maintenance activée pour ${durationMinutes} minutes`);
        console.log(`🔧 Fin prévue: ${maintenanceEndTime.toLocaleString('fr-FR')}`);
        
        // Auto-désactivation
        setTimeout(() => {
            this.stop();
        }, durationMinutes * 60 * 1000);
        
        return { success: true, endTime: maintenanceEndTime };
    },
    
    // Arrêter maintenance
    stop() {
        maintenanceActive = false;
        maintenanceEndTime = null;
        console.log('🔧 Maintenance arrêtée');
        return { success: true };
    },
    
    // Vérifier si maintenance active
    isActive() {
        // Vérifier si expiré
        if (maintenanceActive && maintenanceEndTime && new Date() > maintenanceEndTime) {
            this.stop();
            return false;
        }
        return maintenanceActive;
    },
    
    // Temps restant
    getTimeLeft() {
        if (!this.isActive()) return null;
        const now = new Date();
        const timeLeft = maintenanceEndTime.getTime() - now.getTime();
        return Math.max(0, Math.floor(timeLeft / 60000)); // en minutes
    },
    
    // Infos complètes
    getStatus() {
        return {
            isActive: this.isActive(),
            endTime: maintenanceEndTime?.toISOString() || null,
            timeLeftMinutes: this.getTimeLeft()
        };
    }
};