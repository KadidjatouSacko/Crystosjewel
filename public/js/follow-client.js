// À ajouter dans public/js/follow-client.js
// ou directement dans follow-customer.ejs dans une balise <script>

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Interface suivi clients chargée');

    // ========================================
    // 🔍 RECHERCHE EN TEMPS RÉEL
    // ========================================
    
    const searchInput = document.getElementById('search-client');
    const clientRows = document.querySelectorAll('.client-list tbody tr');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            clientRows.forEach(row => {
                const firstName = row.querySelector('td:nth-child(1)')?.textContent.toLowerCase() || '';
                const lastName = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
                const email = row.querySelector('td:nth-child(3)')?.textContent.toLowerCase() || '';
                
                const matches = firstName.includes(searchTerm) || 
                               lastName.includes(searchTerm) || 
                               email.includes(searchTerm);
                
                row.style.display = matches ? '' : 'none';
            });
        });
    }

    // ========================================
    // ➕ AJOUTER UN CLIENT
    // ========================================
    
    const addClientBtn = document.getElementById('addClientBtn');
    if (addClientBtn) {
        addClientBtn.addEventListener('click', function() {
            showAddClientModal();
        });
    }

    // ========================================
    // 👁️ VOIR DÉTAILS CLIENT
    // ========================================
    
    document.querySelectorAll('.action-btn.view').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const clientId = this.closest('tr').dataset.clientId;
            if (clientId) {
                viewClientDetails(clientId);
            }
        });
    });

    // ========================================
    // ✏️ MODIFIER CLIENT
    // ========================================
    
    document.querySelectorAll('.action-btn.edit').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const clientId = this.closest('tr').dataset.clientId;
            if (clientId) {
                editClient(clientId);
            }
        });
    });

    // ========================================
    // 🗑️ SUPPRIMER CLIENT
    // ========================================
    
    document.querySelectorAll('.action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const clientId = this.closest('tr').dataset.clientId;
            const clientName = this.closest('tr').querySelector('td:nth-child(1)').textContent + ' ' + 
                              this.closest('tr').querySelector('td:nth-child(2)').textContent;
            if (clientId) {
                deleteClient(clientId, clientName);
            }
        });
    });

    // ========================================
    // 📈 EXPORT
    // ========================================
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            showExportModal();
        });
    }
});

// ========================================
// FONCTIONS MODALES ET ACTIONS
// ========================================

function showAddClientModal() {
    const modalHTML = `
        <div class="modal-overlay" id="addClientModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>Ajouter un nouveau client</h3>
                    <button class="modal-close" onclick="closeModal('addClientModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="addClientForm">
                        <div class="form-group">
                            <label for="firstName">Prénom *</label>
                            <input type="text" id="firstName" name="firstName" required>
                        </div>
                        <div class="form-group">
                            <label for="lastName">Nom *</label>
                            <input type="text" id="lastName" name="lastName" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Email *</label>
                            <input type="email" id="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="phone">Téléphone</label>
                            <input type="tel" id="phone" name="phone">
                        </div>
                        <div class="form-group">
                            <label for="address">Adresse</label>
                            <textarea id="address" name="address" rows="3"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="cancel" onclick="closeModal('addClientModal')">Annuler</button>
                    <button type="button" class="save" onclick="submitAddClient()">Ajouter</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function submitAddClient() {
    const form = document.getElementById('addClientForm');
    const formData = new FormData(form);
    
    // Validation côté client
    if (!formData.get('firstName') || !formData.get('lastName') || !formData.get('email')) {
        showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    // Envoyer la requête
    fetch('/admin/clients/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address')
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Client ajouté avec succès', 'success');
            closeModal('addClientModal');
            // Recharger la page pour voir le nouveau client
            setTimeout(() => location.reload(), 1000);
        } else {
            showNotification(data.message || 'Erreur lors de l\'ajout', 'error');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        showNotification('Erreur lors de l\'ajout du client', 'error');
    });
}

function viewClientDetails(clientId) {
    fetch(`/admin/clients/${clientId}`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showClientDetailsModal(data.client);
        } else {
            showNotification('Erreur lors de la récupération des détails', 'error');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la récupération des détails', 'error');
    });
}

function showClientDetailsModal(client) {
    const ordersHTML = client.recentOrders && client.recentOrders.length > 0 
        ? client.recentOrders.map(order => `
            <tr>
                <td>${order.numero}</td>
                <td>${order.total}€</td>
                <td><span class="status ${order.status}">${order.status}</span></td>
                <td>${new Date(order.date).toLocaleDateString('fr-FR')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4">Aucune commande</td></tr>';

    const modalHTML = `
        <div class="modal-overlay" id="clientDetailsModal">
            <div class="modal large">
                <div class="modal-header">
                    <h3>Détails de ${client.first_name} ${client.last_name}</h3>
                    <button class="modal-close" onclick="closeModal('clientDetailsModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="client-details-grid">
                        <div class="client-info">
                            <h4>Informations personnelles</h4>
                            <p><strong>Email:</strong> ${client.email}</p>
                            <p><strong>Téléphone:</strong> ${client.phone || 'Non renseigné'}</p>
                            <p><strong>Adresse:</strong> ${client.address || 'Non renseignée'}</p>
                            <p><strong>Inscription:</strong> ${new Date(client.created_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <div class="client-stats">
                            <h4>Statistiques</h4>
                            <p><strong>Commandes totales:</strong> ${client.total_orders}</p>
                            <p><strong>Montant total:</strong> ${parseFloat(client.total_spent || 0).toFixed(2)}€</p>
                            <p><strong>Panier moyen:</strong> ${parseFloat(client.average_basket || 0).toFixed(2)}€</p>
                            <p><strong>Dernière commande:</strong> ${client.last_order_date ? new Date(client.last_order_date).toLocaleDateString('fr-FR') : 'Jamais'}</p>
                        </div>
                    </div>
                    
                    <div class="recent-orders">
                        <h4>Commandes récentes</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Numéro</th>
                                    <th>Montant</th>
                                    <th>Statut</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ordersHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="cancel" onclick="closeModal('clientDetailsModal')">Fermer</button>
                    <button type="button" class="save" onclick="editClient(${client.id})">Modifier</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function editClient(clientId) {
    // D'abord récupérer les données actuelles du client
    fetch(`/admin/clients/${clientId}`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showEditClientModal(data.client);
        } else {
            showNotification('Erreur lors de la récupération des données', 'error');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la récupération des données', 'error');
    });
}

function showEditClientModal(client) {
    // Fermer toute modal ouverte
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
    
    const modalHTML = `
        <div class="modal-overlay" id="editClientModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>Modifier ${client.first_name} ${client.last_name}</h3>
                    <button class="modal-close" onclick="closeModal('editClientModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editClientForm">
                        <input type="hidden" id="editClientId" value="${client.id}">
                        <div class="form-group">
                            <label for="editFirstName">Prénom *</label>
                            <input type="text" id="editFirstName" name="editFirstName" value="${client.first_name}" required>
                        </div>
                        <div class="form-group">
                            <label for="editLastName">Nom *</label>
                            <input type="text" id="editLastName" name="editLastName" value="${client.last_name}" required>
                        </div>
                        <div class="form-group">
                            <label for="editEmail">Email *</label>
                            <input type="email" id="editEmail" name="editEmail" value="${client.email}" required>
                        </div>
                        <div class="form-group">
                            <label for="editPhone">Téléphone</label>
                            <input type="tel" id="editPhone" name="editPhone" value="${client.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editAddress">Adresse</label>
                            <textarea id="editAddress" name="editAddress" rows="3">${client.address || ''}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="cancel" onclick="closeModal('editClientModal')">Annuler</button>
                    <button type="button" class="save" onclick="submitEditClient()">Sauvegarder</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function submitEditClient() {
    const form = document.getElementById('editClientForm');
    const formData = new FormData(form);
    const clientId = document.getElementById('editClientId').value;
    
    // Validation côté client
    if (!formData.get('editFirstName') || !formData.get('editLastName') || !formData.get('editEmail')) {
        showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    // Envoyer la requête
    fetch(`/admin/clients/${clientId}/update`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            editFirstName: formData.get('editFirstName'),
            editLastName: formData.get('editLastName'),
            editEmail: formData.get('editEmail'),
            editPhone: formData.get('editPhone'),
            editAddress: formData.get('editAddress')
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Client mis à jour avec succès', 'success');
            closeModal('editClientModal');
            // Recharger la page pour voir les modifications
            setTimeout(() => location.reload(), 1000);
        } else {
            showNotification(data.message || 'Erreur lors de la mise à jour', 'error');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la mise à jour du client', 'error');
    });
}

function deleteClient(clientId, clientName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le client "${clientName}" ?\n\nCette action est irréversible.`)) {
        return;
    }

    fetch(`/admin/clients/${clientId}/delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Client supprimé avec succès', 'success');
            // Supprimer la ligne du tableau
            const row = document.querySelector(`tr[data-client-id="${clientId}"]`);
            if (row) {
                row.remove();
            }
        } else {
            showNotification(data.message || 'Erreur lors de la suppression', 'error');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la suppression du client', 'error');
    });
}

function showExportModal() {
    const modalHTML = `
        <div class="modal-overlay" id="exportModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>Exporter les données clients</h3>
                    <button class="modal-close" onclick="closeModal('exportModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Choisissez le format d'export :</p>
                    <div class="export-options">
                        <button class="export-btn" onclick="exportClients('csv')">
                            <i class="fas fa-file-csv"></i>
                            Exporter en CSV
                        </button>
                        <button class="export-btn" onclick="exportClients('json')">
                            <i class="fas fa-file-code"></i>
                            Exporter en JSON
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="cancel" onclick="closeModal('exportModal')">Annuler</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function exportClients(format) {
    showNotification('Préparation de l\'export...', 'info');
    
    // Créer un lien de téléchargement
    const link = document.createElement('a');
    link.href = `/admin/clients/export?format=${format}`;
    link.download = `clients_export.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    closeModal('exportModal');
    
    setTimeout(() => {
        showNotification(`Export ${format.toUpperCase()} téléchargé`, 'success');
    }, 1000);
}

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

function showNotification(message, type = 'info') {
    // Supprimer les notifications existantes
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-suppression après 5 secondes
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ========================================
// FILTRES ET TRI
// ========================================

function filterByStatus(status) {
    const rows = document.querySelectorAll('.client-list tbody tr');
    
    rows.forEach(row => {
        const statusCell = row.querySelector('.status');
        if (status === 'all' || !statusCell) {
            row.style.display = '';
        } else {
            const rowStatus = statusCell.textContent.toLowerCase();
            row.style.display = rowStatus === status.toLowerCase() ? '' : 'none';
        }
    });
}

function sortTable(column, direction = 'asc') {
    const tbody = document.querySelector('.client-list tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    const columnIndex = {
        'name': 1,
        'email': 3,
        'orders': 5,
        'total': 6,
        'lastOrder': 7
    }[column];
    
    if (!columnIndex) return;
    
    rows.sort((a, b) => {
        let aVal = a.cells[columnIndex].textContent.trim();
        let bVal = b.cells[columnIndex].textContent.trim();
        
        // Conversion pour les nombres
        if (column === 'orders' || column === 'total') {
            aVal = parseFloat(aVal.replace(/[^\d.-]/g, '')) || 0;
            bVal = parseFloat(bVal.replace(/[^\d.-]/g, '')) || 0;
        }
        
        // Conversion pour les dates
        if (column === 'lastOrder') {
            aVal = new Date(aVal).getTime() || 0;
            bVal = new Date(bVal).getTime() || 0;
        }
        
        if (direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
    
    // Réorganiser les lignes
    rows.forEach(row => tbody.appendChild(row));
}