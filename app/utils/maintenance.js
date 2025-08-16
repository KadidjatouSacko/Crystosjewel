// app/utils/maintenance.js - FICHIER ULTRA SIMPLE
let maintenanceEndTime = null;
let maintenanceActive = false;
let maintenanceStartTime = null;
let maintenanceMessage = 'Maintenance en cours...';
let scheduledMaintenance = null;

export const maintenance = {
    // Activer maintenance avec durée en MINUTES
    start(durationMinutes, message = 'Maintenance en cours...') {
        maintenanceActive = true;
        maintenanceStartTime = new Date();
        maintenanceEndTime = new Date(Date.now() + durationMinutes * 60 * 1000);
        maintenanceMessage = message;
        scheduledMaintenance = null; // Annuler toute maintenance programmée
        
        console.log(`🔧 Maintenance activée pour ${durationMinutes} minutes`);
        console.log(`🔧 Fin prévue: ${maintenanceEndTime.toLocaleString('fr-FR')}`);
        
        // Auto-désactivation
        setTimeout(() => {
            this.stop();
        }, durationMinutes * 60 * 1000);
        
        return { 
            success: true, 
            startTime: maintenanceStartTime,
            endTime: maintenanceEndTime,
            message 
        };
    },
    
    // Programmer la maintenance
    schedule(startDateTime, endDateTime, message = 'Maintenance programmée en cours...') {
        const now = new Date();
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);
        
        if (start <= now) {
            throw new Error('La date de début doit être dans le futur');
        }
        
        if (end <= start) {
            throw new Error('La date de fin doit être après la date de début');
        }
        
        scheduledMaintenance = {
            startTime: start,
            endTime: end,
            message
        };
        
        console.log(`⏰ Maintenance programmée du ${start.toLocaleString('fr-FR')} au ${end.toLocaleString('fr-FR')}`);
        
        // Programmer l'activation automatique
        const timeUntilStart = start.getTime() - now.getTime();
        setTimeout(() => {
            console.log('🔧 Démarrage automatique de la maintenance programmée');
            this.startScheduled();
        }, timeUntilStart);
        
        return { 
            success: true, 
            scheduledStart: start,
            scheduledEnd: end,
            message 
        };
    },
    
    // Démarrer la maintenance programmée
    startScheduled() {
        if (!scheduledMaintenance) return;
        
        const { startTime, endTime, message } = scheduledMaintenance;
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / (60 * 1000));
        
        maintenanceActive = true;
        maintenanceStartTime = startTime;
        maintenanceEndTime = endTime;
        maintenanceMessage = message;
        
        console.log(`🔧 Maintenance programmée démarrée (${durationMinutes} minutes)`);
        
        // Auto-désactivation
        setTimeout(() => {
            this.stop();
        }, durationMs);
        
        scheduledMaintenance = null;
    },
    
    // Annuler la maintenance programmée
    cancelScheduled() {
        scheduledMaintenance = null;
        console.log('❌ Maintenance programmée annulée');
        return { success: true };
    },
    
    // Arrêter maintenance
    stop() {
        maintenanceActive = false;
        maintenanceEndTime = null;
        maintenanceStartTime = null;
        maintenanceMessage = 'Maintenance en cours...';
        scheduledMaintenance = null;
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
    
    // Vérifier la maintenance programmée
    checkScheduled() {
        if (!scheduledMaintenance) return false;
        
        const now = new Date();
        if (now >= scheduledMaintenance.startTime) {
            this.startScheduled();
            return true;
        }
        return false;
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
        // Vérifier la maintenance programmée
        this.checkScheduled();
        
        return {
            isActive: this.isActive(),
            startTime: maintenanceStartTime?.toISOString() || null,
            endTime: maintenanceEndTime?.toISOString() || null,
            message: maintenanceMessage,
            timeLeftMinutes: this.getTimeLeft(),
            scheduled: scheduledMaintenance ? {
                startTime: scheduledMaintenance.startTime.toISOString(),
                endTime: scheduledMaintenance.endTime.toISOString(),
                message: scheduledMaintenance.message
            } : null
        };
    }
};