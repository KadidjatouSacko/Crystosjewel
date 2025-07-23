class EmailCampaignManager {
    constructor() {
        this.initializeEventListeners();
        this.loadCharts();
    }

    initializeEventListeners() {
        // Boutons d'action
        document.querySelectorAll('.send-campaign').forEach(btn => {
            btn.addEventListener('click', (e) => this.sendCampaign(e.target.dataset.campaignId));
        });

        document.querySelectorAll('.duplicate-campaign').forEach(btn => {
            btn.addEventListener('click', (e) => this.duplicateCampaign(e.target.dataset.campaignId));
        });

        document.querySelectorAll('.delete-campaign').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteCampaign(e.target.dataset.campaignId));
        });

        // Filtres
        document.getElementById('statusFilter')?.addEventListener('change', this.filterCampaigns);
        document.getElementById('searchInput')?.addEventListener('input', this.debounce(this.searchCampaigns, 300));
    }

    async sendCampaign(campaignId) {
        if (!confirm('Êtes-vous sûr de vouloir envoyer cette campagne ?')) {
            return;
        }

        try {
            const response = await fetch(`/admin/email-marketing/campaigns/${campaignId}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Campagne envoyée avec succès !', 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                this.showNotification('Erreur: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Erreur envoi campagne:', error);
            this.showNotification('Erreur lors de l\'envoi', 'error');
        }
    }

    async duplicateCampaign(campaignId) {
        try {
            const response = await fetch(`/admin/email-marketing/campaigns/${campaignId}/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Campagne dupliquée avec succès !', 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                this.showNotification('Erreur: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Erreur duplication campagne:', error);
            this.showNotification('Erreur lors de la duplication', 'error');
        }
    }

    async deleteCampaign(campaignId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) {
            return;
        }

        try {
            const response = await fetch(`/admin/email-marketing/campaigns/${campaignId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Campagne supprimée avec succès !', 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                this.showNotification('Erreur: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Erreur suppression campagne:', error);
            this.showNotification('Erreur lors de la suppression', 'error');
        }
    }

    filterCampaigns() {
        const status = document.getElementById('statusFilter').value;
        const url = new URL(window.location);
        
        if (status) {
            url.searchParams.set('status', status);
        } else {
            url.searchParams.delete('status');
        }
        
        window.location.href = url.toString();
    }

    searchCampaigns() {
        const search = document.getElementById('searchInput').value;
        const url = new URL(window.location);
        
        if (search) {
            url.searchParams.set('search', search);
        } else {
            url.searchParams.delete('search');
        }
        
        window.location.href = url.toString();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        } text-white`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    loadCharts() {
        // Charger les graphiques si Chart.js est disponible
        if (typeof Chart !== 'undefined') {
            this.loadActivityChart();
            this.loadPerformanceChart();
        }
    }

    loadActivityChart() {
        const canvas = document.getElementById('activityChart');
        if (!canvas) return;

        // Les données seront fournies par la vue EJS
        const ctx = canvas.getContext('2d');
        // Configuration du graphique...
    }

    loadPerformanceChart() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        // Configuration du graphique...
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialiser le gestionnaire au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    new EmailCampaignManager();
});
