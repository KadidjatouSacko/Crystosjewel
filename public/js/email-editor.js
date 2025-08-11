// public/js/email-editor.js - Script complet pour l'éditeur d'emails
class EmailEditor {
    constructor() {
        this.currentTemplate = 'elegant';
        this.selectedRecipients = [];
        this.currentFilter = 'newsletter';
        this.allClients = [];
        this.config = window.EMAIL_EDITOR_CONFIG || {};
        
        this.init();
    }

    init() {
        console.log('✏️ Initialisation de l\'éditeur d\'emails CrystosJewel');
        
        this.setupEventListeners();
        this.loadClients();
        this.updatePreview();
        this.loadUploadedImages();
        this.setupImageUpload();
        this.setupDragAndDrop();
        
        console.log('✅ Éditeur initialisé avec succès');
    }

    setupEventListeners() {
        // Événements de mise à jour du preview
        document.getElementById('emailSubject').addEventListener('input', () => this.updatePreview());
        document.getElementById('emailPreheader').addEventListener('input', () => this.updatePreview());
        document.getElementById('emailContent').addEventListener('input', () => this.updatePreview());
        
        // Événements des templates
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectTemplate(card.dataset.template);
            });
        });

        // Sauvegarde automatique
        this.setupAutoSave();

        // Raccourcis clavier
        this.setupKeyboardShortcuts();
    }

    updatePreview() {
        const subject = document.getElementById('emailSubject').value || '🎉 Découvrez nos nouveautés !';
        const preheader = document.getElementById('emailPreheader').value || 'Texte de prévisualisation';
        
        document.getElementById('previewSubject').textContent = subject;
        document.getElementById('previewPreheader').textContent = preheader;
    }

    selectTemplate(templateName) {
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('active');
        });
        
        document.querySelector(`[data-template="${templateName}"]`).classList.add('active');
        this.currentTemplate = templateName;
        
        this.applyTemplate(templateName);
    }

    applyTemplate(templateName) {
        const content = document.getElementById('emailContent');
        const templates = {
            elegant: `
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="${this.config.baseUrl}/images/logo.png" alt="CrystosJewel" style="max-width: 200px;" onerror="this.style.display='none'">
                </div>
                <h2 style="color: #d89ab3; margin-bottom: 20px; font-family: Georgia, serif; text-align: center;">Bonjour {{firstName}} !</h2>
                <p style="margin-bottom: 15px; font-size: 16px; line-height: 1.6; color: #1e293b;">Nous sommes ravis de vous présenter notre nouvelle collection de bijoux exclusifs, conçue avec passion par nos artisans les plus talentueux.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${this.config.baseUrl}/bijoux" style="display: inline-block; background: linear-gradient(135deg, #d89ab3, #b794a8); color: white; padding: 18px 36px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 6px 20px rgba(216, 154, 179, 0.3);">
                        ✨ Découvrir la collection
                    </a>
                </div>
                <p style="margin-bottom: 20px; font-size: 16px; line-height: 1.6; color: #1e293b;">Chaque pièce raconte une histoire unique, alliant tradition et modernité pour créer des bijoux intemporels.</p>
            `,
            modern: `
                <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 40px 30px; margin-bottom: 30px; border-radius: 16px; text-align: center;">
                    <h1 style="margin: 0; font-size: 32px; font-weight: 800;">Hey {{firstName}} ! 🚀</h1>
                    <p style="margin: 15px 0 0; opacity: 0.9; font-size: 18px;">L'avenir du style, c'est maintenant</p>
                </div>
                <p style="margin-bottom: 20px; font-size: 16px; text-align: center;">Découvrez des créations qui redéfinissent l'élégance moderne.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${this.config.baseUrl}/bijoux" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        🔥 Voir les nouveautés
                    </a>
                </div>
            `,
            classic: `
                <div style="border-left: 4px solid #d89ab3; padding-left: 25px; margin-bottom: 30px; background: linear-gradient(90deg, rgba(216, 154, 179, 0.1), transparent);">
                    <h2 style="color: #1e293b; margin-bottom: 10px; font-family: Georgia, serif;">Cher(e) {{firstName}},</h2>
                    <p style="color: #64748b; margin: 0; font-style: italic;">Nous avons le plaisir de vous informer de nos dernières créations...</p>
                </div>
                <p style="margin: 20px 0; line-height: 1.6;">Découvrez notre sélection de bijoux d'exception, créés avec le plus grand soin par nos artisans.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${this.config.baseUrl}/bijoux" style="display: inline-block; background: #d89ab3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                        Découvrir notre collection
                    </a>
                </div>
            `,
            minimal: `
                <div style="text-align: center; margin-bottom: 50px;">
                    <h1 style="font-size: 48px; font-weight: 100; color: #1e293b; margin-bottom: 10px; letter-spacing: 2px;">{{firstName}}</h1>
                    <div style="width: 60px; height: 2px; background: #d89ab3; margin: 0 auto;"></div>
                </div>
                <p style="font-size: 20px; line-height: 1.8; color: #64748b; text-align: center; margin: 40px 0;">Simple. Élégant. Authentique.</p>
                <div style="text-align: center; margin: 50px 0;">
                    <a href="${this.config.baseUrl}/bijoux" style="display: inline-block; border: 2px solid #d89ab3; color: #d89ab3; padding: 12px 24px; text-decoration: none; border-radius: 0; font-weight: 600; transition: all 0.3s ease;">
                        Découvrir
                    </a>
                </div>
            `
        };
        
        content.innerHTML = templates[templateName] || templates.elegant;
    }

    // ==========================================
    // GESTION DES CLIENTS
    // ==========================================

    async loadClients() {
        try {
            this.displayClients([]);
            this.updateRecipientsCounter();
            
            const response = await fetch(`/admin/api/customers?filter=${this.currentFilter}`);
            const data = await response.json();
            
            if (data.success) {
                this.allClients = data.customers;
                this.displayClients(this.allClients);
                this.updateRecipientsCounter();
            } else {
                this.showNotification('❌ Erreur lors du chargement des clients', 'error');
            }
        } catch (error) {
            console.error('Erreur chargement clients:', error);
            this.showNotification('❌ Erreur de connexion', 'error');
        }
    }

    async filterRecipients(filter) {
        this.currentFilter = filter;
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // Mettre à jour le compteur immédiatement
        const count = this.config.recipientCounts[filter] || 0;
        document.getElementById('recipientCount').textContent = count;
        
        // Charger les clients
        await this.loadClients();
    }

    displayClients(clients) {
        const container = document.getElementById('clientsList');
        
        if (clients.length === 0) {
            container.innerHTML = '<p style="color: #64748b; text-align: center; padding: 20px;">Aucun client trouvé</p>';
            return;
        }
        
        container.innerHTML = clients.map(client => `
            <div style="padding: 8px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 5px; font-size: 13px; cursor: pointer; ${this.selectedRecipients.includes(client.id) ? 'background: rgba(216, 154, 179, 0.1); border-color: #d89ab3;' : ''}" onclick="emailEditor.toggleClient(${client.id})">
                <div style="font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                    <span>${client.name}</span>
                    ${this.selectedRecipients.includes(client.id) ? '<i class="fas fa-check" style="color: #d89ab3;"></i>' : ''}
                </div>
                <div style="color: var(--text-secondary); font-size: 11px;">${client.email}</div>
                <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                    ${client.type === 'vip' ? '<span style="background: #fbbf24; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">💎 VIP</span>' : ''}
                    ${client.newsletter ? '<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">📧 Newsletter</span>' : ''}
                    ${client.hasOrders ? '<span style="background: #3b82f6; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">🛍️ Client</span>' : ''}
                </div>
                ${client.totalOrders > 0 ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${client.totalOrders} commande(s) - ${parseFloat(client.totalSpent || 0).toFixed(2)}€</div>` : ''}
            </div>
        `).join('');
    }

    async searchClients() {
        const query = document.getElementById('clientSearch').value.toLowerCase().trim();
        
        if (query.length === 0) {
            this.displayClients(this.allClients);
            return;
        }
        
        if (query.length < 2) {
            return; // Attendre au moins 2 caractères
        }
        
        try {
            const response = await fetch(`/admin/api/customers?filter=${this.currentFilter}&search=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayClients(data.customers);
            }
        } catch (error) {
            console.error('Erreur recherche clients:', error);
        }
    }

    toggleClient(clientId) {
        const index = this.selectedRecipients.indexOf(clientId);
        if (index > -1) {
            this.selectedRecipients.splice(index, 1);
        } else {
            this.selectedRecipients.push(clientId);
        }
        this.updateRecipientsCounter();
        this.displayClients(this.allClients); // Rafraîchir l'affichage
    }

    updateRecipientsCounter() {
        const count = this.selectedRecipients.length > 0 ? 
            this.selectedRecipients.length : 
            (this.config.recipientCounts[this.currentFilter] || 0);
        
        document.getElementById('recipientCount').textContent = count;
    }

    // ==========================================
    // GESTION DES VARIABLES
    // ==========================================

    insertVariable(variable) {
        const content = document.getElementById('emailContent');
        content.focus();
        
        // Insérer la variable à la position du curseur
        if (document.execCommand) {
            document.execCommand('insertText', false, variable);
        } else {
            // Fallback pour les navigateurs modernes
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(variable));
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    // ==========================================
    // GESTION DES BLOCS DE CONTENU
    // ==========================================

    setupDragAndDrop() {
        // Rendre les blocs draggables
        document.querySelectorAll('.block-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.block);
                item.style.opacity = '0.5';
            });
            
            item.addEventListener('dragend', (e) => {
                item.style.opacity = '1';
            });
        });

        const emailContent = document.getElementById('emailContent');

        emailContent.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.showDropIndicator(e);
        });

        emailContent.addEventListener('dragleave', (e) => {
            if (!emailContent.contains(e.relatedTarget)) {
                this.hideDropIndicator();
            }
        });

        emailContent.addEventListener('drop', (e) => {
            e.preventDefault();
            const blockType = e.dataTransfer.getData('text/plain');
            this.hideDropIndicator();
            this.insertBlock(blockType);
        });
    }

    showDropIndicator(e) {
        const rect = document.getElementById('emailContent').getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        // Supprimer les anciens indicateurs
        document.querySelectorAll('.drop-indicator').forEach(indicator => {
            indicator.remove();
        });
        
        // Créer un nouvel indicateur
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        indicator.style.cssText = `
            height: 3px;
            background: #d89ab3;
            margin: 5px 0;
            border-radius: 2px;
            opacity: 0.8;
            animation: pulse 1s infinite;
        `;
        
        const emailContent = document.getElementById('emailContent');
        emailContent.appendChild(indicator);
    }

    hideDropIndicator() {
        document.querySelectorAll('.drop-indicator').forEach(indicator => {
            indicator.remove();
        });
    }

    insertBlock(blockType) {
        const content = document.getElementById('emailContent');
        const blocks = {
            title: '<h2 style="color: #d89ab3; margin: 20px 0; font-family: Georgia, serif; text-align: center;" contenteditable="true">Votre titre ici</h2>',
            text: '<p style="margin: 15px 0; line-height: 1.6; color: #1e293b;" contenteditable="true">Votre texte ici. Cliquez pour modifier ce paragraphe et personnaliser votre contenu.</p>',
            image: `<div style="text-align: center; margin: 20px 0;">
                <img src="${this.config.baseUrl}/images/placeholder-400x200.jpg" alt="Votre image" style="max-width: 100%; border-radius: 8px; width: 400px; height: 200px;" 
                     onerror="this.src='https://via.placeholder.com/400x200/d89ab3/ffffff?text=Votre+Image'"
                     onclick="emailEditor.selectImage(this)">
            </div>`,
            button: `<div style="text-align: center; margin: 20px 0;">
                <a href="${this.config.baseUrl}/bijoux" style="display: inline-block; background: linear-gradient(135deg, #d89ab3, #b794a8); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;" contenteditable="true">
                    🛍️ Votre bouton
                </a>
            </div>`,
            divider: '<hr style="margin: 30px 0; border: none; border-top: 2px solid #e2e8f0; width: 80%; margin-left: auto; margin-right: auto;">',
            products: `
                <div style="border: 2px dashed #d89ab3; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; background: rgba(216, 154, 179, 0.05);">
                    <h3 style="color: #d89ab3; margin-bottom: 15px;" contenteditable="true">💎 Nos Produits Vedettes</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 20px;">
                        <div style="text-align: center; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <img src="${this.config.baseUrl}/images/bijou-1.jpg" alt="Produit 1" style="width: 100%; max-width: 120px; border-radius: 6px;" 
                                 onerror="this.src='https://via.placeholder.com/120x120/d89ab3/ffffff?text=Produit+1'"
                                 onclick="emailEditor.selectImage(this)">
                            <h4 style="margin: 10px 0 5px; color: #1e293b; font-size: 14px;" contenteditable="true">Bague Élégante</h4>
                            <p style="color: #d89ab3; font-weight: 600; margin: 0;" contenteditable="true">149,99€</p>
                        </div>
                        <div style="text-align: center; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <img src="${this.config.baseUrl}/images/bijou-2.jpg" alt="Produit 2" style="width: 100%; max-width: 120px; border-radius: 6px;" 
                                 onerror="this.src='https://via.placeholder.com/120x120/d89ab3/ffffff?text=Produit+2'"
                                 onclick="emailEditor.selectImage(this)">
                            <h4 style="margin: 10px 0 5px; color: #1e293b; font-size: 14px;" contenteditable="true">Collier Raffiné</h4>
                            <p style="color: #d89ab3; font-weight: 600; margin: 0;" contenteditable="true">89,99€</p>
                        </div>
                    </div>
                </div>
            `
        };
        
        content.focus();
        if (document.execCommand) {
            document.execCommand('insertHTML', false, blocks[blockType] || blocks.text);
        } else {
            // Fallback pour les navigateurs modernes
            const div = document.createElement('div');
            div.innerHTML = blocks[blockType] || blocks.text;
            content.appendChild(div);
        }
    }

    // ==========================================
    // GESTION DES IMAGES
    // ==========================================

    setupImageUpload() {
        const imageUpload = document.getElementById('imageUpload');
        imageUpload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.uploadImage(e.target.files[0]);
            }
        });
    }

    async uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            this.showNotification('📤 Upload en cours...', 'info');
            
            const response = await fetch('/admin/emails/upload-image', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('✅ Image uploadée avec succès', 'success');
                this.loadUploadedImages();
                
                // Insérer l'image dans l'éditeur
                const imageHtml = `<div style="text-align: center; margin: 20px 0;">
                    <img src="${data.asset.url}" alt="${file.name}" style="max-width: 100%; border-radius: 8px;" onclick="emailEditor.selectImage(this)">
                </div>`;
                
                const content = document.getElementById('emailContent');
                content.focus();
                document.execCommand('insertHTML', false, imageHtml);
            } else {
                this.showNotification(`❌ ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Erreur upload image:', error);
            this.showNotification('❌ Erreur lors de l\'upload', 'error');
        }
    }

    async loadUploadedImages() {
        try {
            const response = await fetch('/admin/emails/images');
            const data = await response.json();

            if (data.success && data.images.length > 0) {
                const container = document.getElementById('uploadedImages');
                container.innerHTML = data.images.slice(0, 10).map(image => `
                    <div style="display: flex; align-items: center; padding: 5px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 5px; cursor: pointer;" onclick="emailEditor.insertUploadedImage('${image.url}', '${image.originalName}')">
                        <img src="${image.url}" alt="${image.originalName}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 8px;">
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${image.originalName}</div>
                            <div style="font-size: 10px; color: #64748b;">${this.formatFileSize(image.size)}</div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Erreur chargement images:', error);
        }
    }

    insertUploadedImage(url, altText) {
        const imageHtml = `<div style="text-align: center; margin: 20px 0;">
            <img src="${url}" alt="${altText}" style="max-width: 100%; border-radius: 8px;" onclick="emailEditor.selectImage(this)">
        </div>`;
        
        const content = document.getElementById('emailContent');
        content.focus();
        document.execCommand('insertHTML', false, imageHtml);
    }

    selectImage(imgElement) {
        const newUrl = prompt('URL de la nouvelle image:', imgElement.src);
        if (newUrl && newUrl !== imgElement.src) {
            imgElement.src = newUrl;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ==========================================
    // ACTIONS PRINCIPALES
    // ==========================================

    async saveAsDraft() {
        const campaignData = {
            name: document.getElementById('campaignName').value || 'Brouillon sans nom',
            subject: document.getElementById('emailSubject').value,
            content: document.getElementById('emailContent').innerHTML,
            preheader: document.getElementById('emailPreheader').value,
            fromName: document.getElementById('senderName').value,
            template: this.currentTemplate,
            recipientType: this.currentFilter,
            selectedCustomerIds: this.selectedRecipients,
            metadata: {
                createdWith: 'email-editor',
                version: '1.0'
            }
        };

        try {
            this.showNotification('💾 Sauvegarde en cours...', 'info');
            
            const response = await fetch('/admin/emails/save-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(campaignData)
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('✅ Brouillon sauvegardé avec succès', 'success');
            } else {
                this.showNotification(`❌ ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            this.showNotification('❌ Erreur lors de la sauvegarde', 'error');
        }
    }

    async sendTest() {
        const email = prompt('Adresse email pour le test :');
        if (!email || !this.isValidEmail(email)) {
            this.showNotification('❌ Email invalide', 'error');
            return;
        }

        const campaignData = {
            email: email,
            subject: document.getElementById('emailSubject').value || 'Test - Email CrystosJewel',
            content: document.getElementById('emailContent').innerHTML,
            template: this.currentTemplate
        };

        try {
            this.showNotification('📤 Envoi du test en cours...', 'info');
            
            const response = await fetch('/admin/emails/send-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(campaignData)
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`✅ Test envoyé à ${email}`, 'success');
            } else {
                this.showNotification(`❌ ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Erreur test:', error);
            this.showNotification('❌ Erreur lors de l\'envoi du test', 'error');
        }
    }

    previewEmail() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 10000; padding: 20px;
            display: flex; align-items: center; justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 800px; margin: 0 auto; max-height: 90vh; overflow-y: auto; width: 100%;">
                <div style="padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <h3>🔍 Aperçu de l'email</h3>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;">×</button>
                </div>
                <div style="padding: 20px;">
                    ${document.getElementById('emailPreview').outerHTML}
                </div>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
        // Fermer avec Escape
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async sendCampaign() {
        const campaignName = document.getElementById('campaignName').value;
        const subject = document.getElementById('emailSubject').value;
        const content = document.getElementById('emailContent').innerHTML;

        if (!campaignName || !subject || !content) {
            this.showNotification('❌ Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        const recipientCount = this.selectedRecipients.length > 0 ? 
            this.selectedRecipients.length : 
            (this.config.recipientCounts[this.currentFilter] || 0);

        if (recipientCount === 0) {
            this.showNotification('❌ Aucun destinataire sélectionné', 'error');
            return;
        }

        const confirmMessage = `🚀 Confirmer l'envoi de la campagne "${campaignName}" à ${recipientCount} destinataire(s) ?`;
        if (!confirm(confirmMessage)) {
            return;
        }

        const campaignData = {
            name: campaignName,
            subject: subject,
            content: content,
            preheader: document.getElementById('emailPreheader').value,
            fromName: document.getElementById('senderName').value,
            template: this.currentTemplate,
            recipientType: this.currentFilter,
            selectedCustomerIds: this.selectedRecipients
        };

        try {
            this.showNotification('🚀 Envoi de la campagne en cours...', 'info');
            
            const response = await fetch('/admin/emails/send-campaign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(campaignData)
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`✅ ${data.message}`, 'success');
                
                // Redirection vers le dashboard après 3 secondes
                setTimeout(() => {
                    window.location.href = '/admin/emails/dashboard';
                }, 3000);
            } else {
                this.showNotification(`❌ ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Erreur envoi:', error);
            this.showNotification('❌ Erreur lors de l\'envoi', 'error');
        }
    }

    // ==========================================
    // UTILITAIRES
    // ==========================================

    showNotification(message, type = 'info') {
        // Supprimer les notifications existantes
        document.querySelectorAll('.notification').forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = 'notification';
        
        const bgColors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        notification.style.background = bgColors[type] || bgColors.info;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; padding: 0;">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove après 5 secondes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    setupAutoSave() {
        let autoSaveTimeout;
        
        const autoSave = () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                const campaignName = document.getElementById('campaignName').value;
                if (campaignName && campaignName.trim().length > 3) {
                    this.saveAsDraft();
                }
            }, 30000); // 30 secondes
        };

        // Déclencher l'auto-save sur modification
        document.getElementById('emailContent').addEventListener('input', autoSave);
        document.getElementById('emailSubject').addEventListener('input', autoSave);
        document.getElementById('campaignName').addEventListener('input', autoSave);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveAsDraft();
                        break;
                    case 'Enter':
                        e.preventDefault();
                        this.sendCampaign();
                        break;
                    case 't':
                        e.preventDefault();
                        this.sendTest();
                        break;
                    case 'p':
                        e.preventDefault();
                        this.previewEmail();
                        break;
                }
            }
            
            if (e.key === 'Escape') {
                const modal = document.querySelector('.modal');
                if (modal) {
                    modal.remove();
                }
            }
        });
    }
}

// ==========================================
// INITIALISATION
// ==========================================

let emailEditor;

document.addEventListener('DOMContentLoaded', () => {
    emailEditor = new EmailEditor();
    
    // Exposer les méthodes pour les événements inline
    window.emailEditor = emailEditor;
    
    console.log('✅ Email Editor CrystosJewel chargé avec succès');
    console.log('🎯 Raccourcis disponibles:');
    console.log('   Ctrl+S : Sauvegarder brouillon');
    console.log('   Ctrl+Enter : Envoyer campagne');
    console.log('   Ctrl+T : Envoyer test');
    console.log('   Ctrl+P : Prévisualiser');
    console.log('   Échap : Fermer modal');
});

// Fonctions globales pour compatibilité
window.filterRecipients = (filter) => emailEditor.filterRecipients(filter);
window.searchClients = () => emailEditor.searchClients();
window.insertVariable = (variable) => emailEditor.insertVariable(variable);
window.saveAsDraft = () => emailEditor.saveAsDraft();
window.sendTest = () => emailEditor.sendTest();
window.previewEmail = () => emailEditor.previewEmail();
window.sendCampaign = () => emailEditor.sendCampaign();