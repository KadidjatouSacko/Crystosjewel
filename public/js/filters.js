/**
 * SYSTÈME DE FILTRES INTERACTIFS POUR BIJOUX - VERSION COMPLÈTE
 * Compatible avec bagues.ejs, bracelets.ejs, colliers.ejs
 * Version: 2.0 - Complète
 */

class JewelryFiltersManager {
    constructor() {
        this.form = null;
        this.isLoading = false;
        this.currentUrl = new URL(window.location);
        this.debounceTimeout = null;
        this.config = {
            autoSubmit: true,
            debounceDelay: 500,
            animationDuration: 300,
            enableUrlSync: true,
            enableLocalStorage: false // Désactivé pour Claude.ai
        };
        
        this.init();
    }

    /**
     * Initialisation du gestionnaire
     */
    init() {
        console.log('🎯 Initialisation du gestionnaire de filtres...');
        this.bindElements();
        this.bindEvents();
        this.setupUrlSync();
        this.initializeState();
        this.setupKeyboardNavigation();
        this.addNotificationStyles();
        
        console.log('✅ Gestionnaire de filtres initialisé');
    }

    /**
     * Liaison des éléments DOM
     */
    bindElements() {
        this.form = document.getElementById('filtersForm');
        this.toggleBtn = document.getElementById('toggleFilters');
        this.filtersContainer = document.getElementById('filtersContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.resultsInfo = document.querySelector('.results-info');
        this.productsGrid = document.querySelector('.products-grid');
        this.activeFiltersContainer = document.querySelector('.active-filters');
        
        // Éléments de contrôle
        this.sortSelect = document.getElementById('sortSelect');
        this.minPriceInput = document.getElementById('minPrice');
        this.maxPriceInput = document.getElementById('maxPrice');
        this.checkboxes = document.querySelectorAll('input[type="checkbox"]');
        
        console.log('📋 Éléments DOM liés:', {
            form: !!this.form,
            toggleBtn: !!this.toggleBtn,
            filtersContainer: !!this.filtersContainer,
            checkboxes: this.checkboxes.length
        });
    }

    /**
     * Liaison des événements
     */
    bindEvents() {
        // Toggle des filtres
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleFilters());
        }

        // Soumission du formulaire
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Tri
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', () => {
                this.handleSortChange();
            });
        }

        // Prix personnalisés avec debounce
        [this.minPriceInput, this.maxPriceInput].forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    this.handlePriceInputChange();
                });
                
                input.addEventListener('blur', () => {
                    this.validatePriceInput(input);
                });
                
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handlePriceInputChange();
                    }
                });
            }
        });

        // Checkboxes
        this.checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.handleCheckboxChange(checkbox);
                this.updateFilterCounts();
            });
        });

        // Gestion du navigateur (retour/avancer)
        window.addEventListener('popstate', (e) => {
            this.handlePopState(e);
        });

        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Événements pour les boutons d'action des produits
        this.bindProductEvents();
        
        console.log('🔗 Événements liés');
    }

    /**
     * Configuration de la synchronisation URL
     */
    setupUrlSync() {
        if (!this.config.enableUrlSync) return;

        // Analyser l'URL actuelle pour restaurer les filtres
        const urlParams = new URLSearchParams(window.location.search);
        this.restoreFiltersFromUrl(urlParams);
    }

    /**
     * Initialisation de l'état
     */
    initializeState() {
        this.updateFilterCounts();
        this.updateActiveFiltersDisplay();
        this.updateResultsInfo();
        
        // Animation d'entrée
        setTimeout(() => {
            this.animateGridEntrance();
        }, 100);
    }

    /**
     * Configuration de la navigation au clavier
     */
    setupKeyboardNavigation() {
        const focusableElements = this.form?.querySelectorAll(
            'input, select, button, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements) {
            focusableElements.forEach((element, index) => {
                element.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && element.type === 'checkbox') {
                        element.click();
                    }
                    
                    // Navigation avec flèches
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        const direction = e.key === 'ArrowDown' ? 1 : -1;
                        const nextIndex = index + direction;
                        
                        if (nextIndex >= 0 && nextIndex < focusableElements.length) {
                            focusableElements[nextIndex].focus();
                        }
                    }
                });
            });
        }
    }

    /**
     * Ajouter les styles pour les notifications
     */
    addNotificationStyles() {
        if (!document.getElementById('filters-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'filters-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                .filter-notification {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .filter-notification__content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .filter-notification__close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 4px;
                    margin-left: auto;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .filter-notification__close:hover {
                    opacity: 1;
                    background: rgba(255,255,255,0.2);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Toggle de l'affichage des filtres
     */
    toggleFilters() {
        if (!this.filtersContainer || !this.toggleBtn) return;

        const isCollapsed = this.filtersContainer.classList.contains('collapsed');
        
        if (isCollapsed) {
            this.showFilters();
        } else {
            this.hideFilters();
        }
    }

    /**
     * Afficher les filtres
     */
    showFilters() {
        this.filtersContainer.classList.remove('collapsed');
        this.toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Masquer';
        this.toggleBtn.classList.add('active');
        
        // Animation d'entrée
        this.filtersContainer.style.animation = 'slideDown 0.3s ease-out';
    }

    /**
     * Masquer les filtres
     */
    hideFilters() {
        this.filtersContainer.classList.add('collapsed');
        this.toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Afficher';
        this.toggleBtn.classList.remove('active');
    }

    /**
     * Gestion de la soumission du formulaire
     */
    handleFormSubmit(e) {
        if (!this.config.autoSubmit) {
            e.preventDefault();
            this.applyFilters();
        }
        // Si autoSubmit est true, laisser le formulaire se soumettre normalement
    }

    /**
     * Gestion du changement de tri
     */
    handleSortChange() {
        this.showLoading();
        
        if (this.config.autoSubmit) {
            // Soumettre le formulaire avec un délai pour l'animation
            setTimeout(() => {
                this.form.submit();
            }, 200);
        } else {
            this.applyFilters();
        }
    }

    /**
     * Gestion des changements de prix avec debounce
     */
    handlePriceInputChange() {
        clearTimeout(this.debounceTimeout);
        
        this.debounceTimeout = setTimeout(() => {
            if (this.config.autoSubmit) {
                this.showLoading();
                setTimeout(() => {
                    this.form.submit();
                }, 300);
            } else {
                this.applyFilters();
            }
        }, this.config.debounceDelay);
    }

    /**
     * Validation des champs de prix
     */
    validatePriceInput(input) {
        const value = parseFloat(input.value);
        const min = parseFloat(this.minPriceInput?.value) || 0;
        const max = parseFloat(this.maxPriceInput?.value) || Infinity;

        if (input === this.minPriceInput && value < 0) {
            input.value = '0';
            this.showNotification('Le prix minimum ne peut pas être négatif', 'warning');
        }

        if (input === this.maxPriceInput && value < min) {
            input.value = min;
            this.showNotification('Le prix maximum doit être supérieur au minimum', 'warning');
        }

        // Limiter à 2 décimales
        if (value && value % 1 !== 0) {
            input.value = value.toFixed(2);
        }
    }

    /**
     * Gestion des changements de checkbox
     */
    handleCheckboxChange(checkbox) {
        // Animation de la checkbox
        const filterOption = checkbox.closest('.filter-option');
        if (filterOption) {
            filterOption.style.animation = 'bounceIn 0.3s ease-out';
            setTimeout(() => {
                filterOption.style.animation = '';
            }, 300);
        }
        
        // Mettre à jour les compteurs
        setTimeout(() => {
            this.updateFilterCounts();
        }, 100);

        if (this.config.autoSubmit) {
            this.showLoading();
            setTimeout(() => {
                this.form.submit();
            }, 200);
        }
    }

    /**
     * Application des filtres (mode manuel)
     */
    applyFilters() {
        this.showLoading();
        
        // Simulation d'un appel AJAX ou soumission directe
        setTimeout(() => {
            // Ici vous pourriez faire un appel AJAX au serveur
            // this.fetchFilteredResults();
            
            // Pour l'instant, on soumet le formulaire
            this.form.submit();
        }, this.config.animationDuration);
    }

    /**
     * Récupération des résultats filtrés via AJAX (optionnel)
     */
    async fetchFilteredResults() {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            this.showLoading();

            const formData = new FormData(this.form);
            const searchParams = new URLSearchParams(formData);
            
            // Déterminer la catégorie actuelle
            const category = this.getCurrentCategory();
            const url = `/api/bijoux/${category}/filter?${searchParams.toString()}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.updateProductsGrid(data.products);
                this.updatePagination(data.pagination);
                this.updateResultsInfo(data.totalResults);
                this.updateUrl(searchParams);
                this.showNotification('Filtres appliqués avec succès', 'success');
            } else {
                throw new Error(data.error || 'Erreur lors du filtrage');
            }

        } catch (error) {
            console.error('Erreur lors du filtrage:', error);
            this.showNotification('Erreur lors du filtrage des produits', 'error');
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    /**
     * Obtenir la catégorie actuelle depuis l'URL
     */
    getCurrentCategory() {
        const path = window.location.pathname;
        if (path.includes('bagues')) return 'bagues';
        if (path.includes('bracelets')) return 'bracelets';
        if (path.includes('colliers')) return 'colliers';
        return 'bijoux';
    }

    /**
     * Mise à jour de la grille de produits (pour AJAX)
     */
    updateProductsGrid(products) {
        if (!this.productsGrid) return;

        if (products.length === 0) {
            this.productsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search fa-3x"></i>
                    <h3>Aucun produit trouvé</h3>
                    <p>Essayez de modifier vos critères de recherche.</p>
                    <button class="btn-reset-filters" onclick="window.filtersManager.resetAllFilters()">
                        <i class="fas fa-undo"></i> Réinitialiser les filtres
                    </button>
                </div>
            `;
            return;
        }

        this.productsGrid.innerHTML = products.map(product => this.generateProductHTML(product)).join('');
        this.bindProductEvents();
        this.animateGridEntrance();
    }

    /**
     * Génération du HTML pour un produit (pour AJAX)
     */
    generateProductHTML(product) {
        return `
            <div class="product-card fade-in">
                ${product.discount_percentage > 0 ? `<div class="product-badge sale">-${product.discount_percentage}%</div>` : ''}
                ${product.isNew ? `<div class="product-badge new-badge">Nouveau</div>` : ''}
                
                <div class="product-img">
                    <img src="/uploads/jewels/${product.image}" 
                         alt="${product.name}"
                         onerror="this.src='/images/no-image.jpg'"
                         loading="lazy">
                </div>
                
                <div class="product-info">
                    <h4 class="product-name">${product.name}</h4>
                    <p class="product-desc">${product.description}</p>
                    
                    <div class="product-details">
                        <div class="detail-item">
                            <i class="fas fa-gem"></i>
                            <span>${product.material || product.matiere}</span>
                        </div>
                        ${product.type ? `
                            <div class="detail-item">
                                <i class="fas fa-tag"></i>
                                <span>${product.type.name || product.type}</span>
                            </div>
                        ` : ''}
                        ${product.carat ? `
                            <div class="detail-item">
                                <i class="fas fa-diamond"></i>
                                <span>${product.carat} carats</span>
                            </div>
                        ` : ''}
                        ${product.availableSizes && product.availableSizes.length > 0 ? `
                            <div class="detail-item">
                                <i class="fas fa-ruler"></i>
                                <span>Tailles: ${product.availableSizes.map(s => s.taille || s).join(', ')}</span>
                            </div>
                        ` : ''}
                        <div class="detail-item">
                            <i class="fas fa-box"></i>
                            <span>Stock: ${product.stock}</span>
                        </div>
                    </div>
                    
                    <div class="product-price-container">
                        ${product.hasDiscount || product.discount_percentage > 0 ? `
                            <div class="price-current">${product.formattedCurrentPrice || this.formatPrice(product.finalPrice)}</div>
                            <div class="price-original">${product.formattedOriginalPrice || this.formatPrice(product.price_ttc)}</div>
                        ` : `
                            <div class="price-single">${product.formattedCurrentPrice || this.formatPrice(product.price_ttc)}</div>
                        `}
                    </div>
                    
                    <div class="product-actions">
                        <button class="product-btn add-to-cart-btn" 
                                data-jewel-id="${product.id}" 
                                data-jewel-name="${product.name}">
                            <i class="fas fa-shopping-cart"></i> Ajouter
                        </button>
                        <a href="/bijoux/${product.slug}" class="product-btn view-jewel-btn">
                            <i class="fas fa-eye"></i> Voir
                        </a>
                        <button class="wishlist-btn" data-jewel-id="${product.id}">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Formatage du prix
     */
    formatPrice(price) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(price);
    }

    /**
     * Liaison des événements des produits
     */
    bindProductEvents() {
        // Boutons d'ajout au panier
        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jewelId = e.target.closest('.add-to-cart-btn').dataset.jewelId;
                const jewelName = e.target.closest('.add-to-cart-btn').dataset.jewelName;
                this.addToCart(jewelId, jewelName);
            });
        });

        // Boutons favoris
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jewelId = e.target.closest('.wishlist-btn').dataset.jewelId;
                this.toggleWishlist(jewelId, e.target.closest('.wishlist-btn'));
            });
        });
    }

    /**
     * Ajout au panier
     */
    async addToCart(jewelId, jewelName) {
        try {
            const response = await fetch('/panier/ajouter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    jewelId: jewelId,
                    quantity: 1
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`${jewelName} ajouté au panier`, 'success');
                this.updateCartCount(data.cartCount);
            } else {
                this.showNotification(data.message || 'Erreur lors de l\'ajout au panier', 'error');
            }

        } catch (error) {
            console.error('Erreur ajout panier:', error);
            this.showNotification('Erreur lors de l\'ajout au panier', 'error');
        }
    }

    /**
     * Toggle favoris
     */
    async toggleWishlist(jewelId, button) {
        try {
            const icon = button.querySelector('i');
            const isCurrentlyFavorite = icon.classList.contains('fas');
            
            const url = isCurrentlyFavorite ? `/favoris/supprimer/${jewelId}` : '/favoris/ajouter';
            const method = 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ jewelId: jewelId })
            });

            const data = await response.json();

            if (data.success) {
                // Mettre à jour l'icône
                if (isCurrentlyFavorite) {
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                    button.style.color = '';
                    this.showNotification('Retiré des favoris', 'info');
                } else {
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                    button.style.color = '#dc3545';
                    this.showNotification('Ajouté aux favoris', 'success');
                }

                // Animation
                button.style.animation = 'bounceIn 0.4s ease-out';
                setTimeout(() => {
                    button.style.animation = '';
                }, 400);

            } else {
                this.showNotification(data.message || 'Erreur avec les favoris', 'error');
            }

        } catch (error) {
            console.error('Erreur favoris:', error);
            this.showNotification('Erreur avec les favoris', 'error');
        }
    }

    /**
     * Mise à jour du compteur de panier
     */
    updateCartCount(count) {
        const cartCountElements = document.querySelectorAll('.cart-count, #cartItemCount');
        cartCountElements.forEach(element => {
            element.textContent = count;
            element.style.animation = 'bounceIn 0.4s ease-out';
            setTimeout(() => {
                element.style.animation = '';
            }, 400);
        });
    }

    /**
     * Mise à jour des compteurs de filtres
     */
    updateFilterCounts() {
        // Cette fonction pourrait recalculer les compteurs en temps réel
        const activeFilters = this.getActiveFilters();
        
        // Mettre à jour l'affichage des filtres actifs
        this.updateActiveFiltersDisplay();
        
        // Mettre à jour l'indicateur d'activité
        const hasActiveFilters = Object.values(activeFilters).some(f => 
            Array.isArray(f) ? f.length > 0 : f !== null && f !== '' && f !== 'newest'
        );
        
        const indicator = document.querySelector('.active-indicator');
        if (indicator) {
            indicator.style.display = hasActiveFilters ? 'inline' : 'none';
        }
    }

    /**
     * Obtenir les filtres actifs
     */
    getActiveFilters() {
        const filters = {
            sort: this.sortSelect?.value || 'newest',
            price: [],
            material: [],
            type: [],
            size: [],
            carat: [],
            stock: [],
            minPrice: this.minPriceInput?.value || null,
            maxPrice: this.maxPriceInput?.value || null
        };

        // Récupérer les checkboxes cochées
        this.checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const filterType = checkbox.name;
                if (filters[filterType]) {
                    filters[filterType].push(checkbox.value);
                }
            }
        });

        return filters;
    }

    /**
     * Mise à jour de l'affichage des filtres actifs
     */
    updateActiveFiltersDisplay() {
        if (!this.activeFiltersContainer) return;

        const filters = this.getActiveFilters();
        const hasActiveFilters = Object.values(filters).some(f => 
            Array.isArray(f) ? f.length > 0 : f !== null && f !== '' && f !== 'newest'
        );

        if (!hasActiveFilters) {
            this.activeFiltersContainer.innerHTML = '';
            this.activeFiltersContainer.style.display = 'none';
            return;
        }

        this.activeFiltersContainer.style.display = 'flex';
        const filterTags = [];

        // Générer les tags pour chaque type de filtre actif
        Object.entries(filters).forEach(([type, values]) => {
            if (Array.isArray(values) && values.length > 0) {
                values.forEach(value => {
                    filterTags.push(this.createFilterTag(type, value));
                });
            }
        });

        // Prix personnalisé
        if (filters.minPrice || filters.maxPrice) {
            const min = filters.minPrice || '0';
            const max = filters.maxPrice || '∞';
            filterTags.push(`
                <div class="filter-tag">
                    Prix: ${min}€ - ${max}
                    <span class="remove" onclick="window.filtersManager.removeCustomPrice()">&times;</span>
                </div>
            `);
        }

        // Ajouter le bouton de suppression globale
        if (filterTags.length > 0) {
            filterTags.push(`
                <button class="clear-filters-btn" onclick="window.filtersManager.resetAllFilters()">
                    <i class="fas fa-trash"></i> Tout effacer
                </button>
            `);
        }

        this.activeFiltersContainer.innerHTML = filterTags.join('');
    }

    /**
     * Créer un tag de filtre
     */
    createFilterTag(type, value) {
        const labels = {
            price: {
                '0-100': 'Moins de 100€',
                '100-300': '100€ - 300€',
                '300-600': '300€ - 600€',
                '600-1000': '600€ - 1000€',
                '1000+': 'Plus de 1000€'
            },
            stock: {
                'available': 'En stock',
                'sale': 'En promotion',
                'new': 'Nouveautés'
            }
        };

        let label = value;
        if (labels[type] && labels[type][value]) {
            label = labels[type][value];
        } else if (type === 'carat') {
            label = `${value} carats`;
        } else if (type === 'size') {
            label = `Taille ${value}`;
        } else if (type === 'type') {
            label = `Type: ${value}`;
        }

        return `
            <div class="filter-tag">
                ${label}
                <span class="remove" onclick="window.filtersManager.removeFilter('${type}', '${value}')">&times;</span>
            </div>
        `;
    }

    /**
     * Supprimer un filtre spécifique
     */
    removeFilter(type, value) {
        if (type === 'custom_price') {
            this.removeCustomPrice();
            return;
        }

        const checkbox = document.querySelector(`input[name="${type}"][value="${value}"]`);
        if (checkbox) {
            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));
        }
    }

    /**
     * Supprimer les prix personnalisés
     */
    removeCustomPrice() {
        if (this.minPriceInput) this.minPriceInput.value = '';
        if (this.maxPriceInput) this.maxPriceInput.value = '';
        
        if (this.config.autoSubmit) {
            this.showLoading();
            setTimeout(() => {
                this.form.submit();
            }, 200);
        } else {
            this.applyFilters();
        }
    }

    /**
     * Réinitialiser tous les filtres
     */
    resetAllFilters() {
        // Décocher toutes les checkboxes
        this.checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Vider les champs de prix
        if (this.minPriceInput) this.minPriceInput.value = '';
        if (this.maxPriceInput) this.maxPriceInput.value = '';

        // Réinitialiser le tri
        if (this.sortSelect) this.sortSelect.value = 'newest';

        // Soumettre ou appliquer
        if (this.config.autoSubmit) {
            this.showLoading();
            setTimeout(() => {
                // Rediriger vers la page sans paramètres
                window.location.href = window.location.pathname;
            }, 200);
        } else {
            this.applyFilters();
        }

        this.showNotification('Filtres réinitialisés', 'info');
    }

    /**
     * Gestion des raccourcis clavier
     */
    handleKeyboardShortcuts(e) {
        // Échap pour fermer les filtres
        if (e.key === 'Escape') {
            if (!this.filtersContainer.classList.contains('collapsed')) {
                this.hideFilters();
            }
        }

        // Ctrl+R pour réinitialiser les filtres (désactiver le refresh par défaut)
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            this.resetAllFilters();
        }

        // Ctrl+F pour focus sur les filtres
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            if (this.filtersContainer.classList.contains('collapsed')) {
                this.showFilters();
            }
            this.sortSelect?.focus();
        }
    }

    /**
     * Gestion de l'historique du navigateur
     */
    handlePopState(e) {
        if (e.state && e.state.filters) {
            this.restoreFiltersFromState(e.state.filters);
        } else {
            // Restaurer depuis l'URL
            const urlParams = new URLSearchParams(window.location.search);
            this.restoreFiltersFromUrl(urlParams);
        }
    }

    /**
     * Restaurer les filtres depuis l'URL
     */
    restoreFiltersFromUrl(urlParams) {
        // Tri
        const sort = urlParams.get('sort');
        if (sort && this.sortSelect) {
            this.sortSelect.value = sort;
        }

        // Prix
        const minPrice = urlParams.get('minPrice');
        const maxPrice = urlParams.get('maxPrice');
        if (minPrice && this.minPriceInput) this.minPriceInput.value = minPrice;
        if (maxPrice && this.maxPriceInput) this.maxPriceInput.value = maxPrice;

        // Checkboxes
        ['price', 'material', 'type', 'size', 'carat', 'stock'].forEach(filterType => {
            const values = urlParams.getAll(filterType);
            values.forEach(value => {
                const checkbox = document.querySelector(`input[name="${filterType}"][value="${value}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        });

        this.updateActiveFiltersDisplay();
    }

    /**
     * Restaurer les filtres depuis un état
     */
    restoreFiltersFromState(filters) {
        // Tri
        if (filters.sort && this.sortSelect) {
            this.sortSelect.value = filters.sort;
        }

        // Prix
        if (filters.minPrice && this.minPriceInput) this.minPriceInput.value = filters.minPrice;
        if (filters.maxPrice && this.maxPriceInput) this.maxPriceInput.value = filters.maxPrice;

        // Checkboxes
        Object.entries(filters).forEach(([type, values]) => {
            if (Array.isArray(values)) {
                values.forEach(value => {
                    const checkbox = document.querySelector(`input[name="${type}"][value="${value}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        });

        this.updateActiveFiltersDisplay();
    }

    /**
     * Mettre à jour l'URL
     */
    updateUrl(searchParams) {
        if (!this.config.enableUrlSync) return;

        const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
        
        // Utiliser pushState pour mettre à jour l'URL sans recharger
        if (window.location.href !== newUrl) {
            window.history.pushState(
                { filters: this.getActiveFilters() },
                '',
                newUrl
            );
        }
    }

    /**
     * Mettre à jour la pagination (pour AJAX)
     */
    updatePagination(paginationData) {
        const paginationContainer = document.querySelector('.pagination');
        if (!paginationContainer || !paginationData) return;

        if (paginationData.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Bouton précédent
        if (paginationData.hasPrevPage) {
            paginationHTML += `
                <a href="?page=${paginationData.prevPage}" class="page-link prev">
                    <i class="fas fa-chevron-left"></i>
                </a>
            `;
        }

        // Pages
        const startPage = Math.max(1, paginationData.currentPage - 2);
        const endPage = Math.min(paginationData.totalPages, paginationData.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<a href="?page=1" class="page-link">1</a>`;
            if (startPage > 2) {
                paginationHTML += `<span class="page-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i === paginationData.currentPage) {
                paginationHTML += `<span class="page-link active">${i}</span>`;
            } else {
                paginationHTML += `<a href="?page=${i}" class="page-link">${i}</a>`;
            }
        }

        if (endPage < paginationData.totalPages) {
            if (endPage < paginationData.totalPages - 1) {
                paginationHTML += `<span class="page-ellipsis">...</span>`;
            }
            paginationHTML += `<a href="?page=${paginationData.totalPages}" class="page-link">${paginationData.totalPages}</a>`;
        }

        // Bouton suivant
        if (paginationData.hasNextPage) {
            paginationHTML += `
                <a href="?page=${paginationData.nextPage}" class="page-link next">
                    <i class="fas fa-chevron-right"></i>
                </a>
            `;
        }

        paginationContainer.innerHTML = paginationHTML;
    }

    /**
     * Afficher le loading
     */
    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('show');
        }
        
        // Désactiver les contrôles
        const controls = this.form?.querySelectorAll('input, select, button');
        controls?.forEach(control => {
            control.disabled = true;
            control.style.opacity = '0.6';
        });

        // Ajouter une classe de chargement au body
        document.body.classList.add('filters-loading');
    }

    /**
     * Masquer le loading
     */
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('show');
        }
        
        // Réactiver les contrôles
        const controls = this.form?.querySelectorAll('input, select, button');
        controls?.forEach(control => {
            control.disabled = false;
            control.style.opacity = '';
        });

        // Retirer la classe de chargement du body
        document.body.classList.remove('filters-loading');
    }

    /**
     * Animation d'entrée de la grille
     */
    animateGridEntrance() {
        const cards = document.querySelectorAll('.product-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            }, index * 100);
        });
    }

    /**
     * Mise à jour des informations de résultats
     */
    updateResultsInfo(totalResults = null) {
        if (!this.resultsInfo) return;

        const count = totalResults || document.querySelectorAll('.product-card').length;
        const countElement = this.resultsInfo.querySelector('.results-count') || 
                           this.resultsInfo.querySelector('#resultsCount');
        
        if (countElement) {
            countElement.textContent = `${count} produit${count !== 1 ? 's' : ''} trouvé${count !== 1 ? 's' : ''}`;
            
            // Animation du compteur
            countElement.style.animation = 'pulse 0.5s ease-out';
            setTimeout(() => {
                countElement.style.animation = '';
            }, 500);
        }
    }

    /**
     * Affichage des notifications
     */
    showNotification(message, type = 'info') {
        // Supprimer les notifications existantes
        const existingNotifications = document.querySelectorAll('.filter-notification');
        existingNotifications.forEach(notif => notif.remove());

        // Créer la nouvelle notification
        const notification = document.createElement('div');
        notification.className = `filter-notification filter-notification--${type}`;
        notification.innerHTML = `
            <div class="filter-notification__content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="filter-notification__close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Styles inline pour la notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '9999',
            backgroundColor: this.getNotificationColor(type),
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            animation: 'slideInRight 0.4s ease-out',
            maxWidth: '400px',
            fontSize: '0.9rem',
            fontWeight: '500',
            border: `3px solid ${this.getNotificationBorderColor(type)}`
        });

        // Ajouter au DOM
        document.body.appendChild(notification);

        // Auto-suppression après 4 secondes
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.4s ease-in';
                setTimeout(() => notification.remove(), 400);
            }
        }, 4000);
    }

    /**
     * Obtenir l'icône pour le type de notification
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Obtenir la couleur pour le type de notification
     */
    getNotificationColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || '#17a2b8';
    }

    /**
     * Obtenir la couleur de bordure pour le type de notification
     */
    getNotificationBorderColor(type) {
        const colors = {
            success: '#1e7e34',
            error: '#bd2130',
            warning: '#e0a800',
            info: '#138496'
        };
        return colors[type] || '#138496';
    }

    /**
     * Débugger les filtres (utile pour le développement)
     */
    debugFilters() {
        const filters = this.getActiveFilters();
        console.log('🔍 Filtres actifs:', filters);
        console.log('📊 Éléments DOM:', {
            form: this.form,
            checkboxes: this.checkboxes.length,
            sortSelect: this.sortSelect?.value,
            priceInputs: {
                min: this.minPriceInput?.value,
                max: this.maxPriceInput?.value
            }
        });
        return filters;
    }

    /**
     * Réinitialiser complètement le gestionnaire
     */
    reset() {
        console.log('🔄 Réinitialisation du gestionnaire...');
        
        // Nettoyer les timeouts
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        // Remettre à zéro les états
        this.isLoading = false;
        
        // Réinitialiser l'interface
        this.hideLoading();
        this.updateActiveFiltersDisplay();
        
        console.log('✅ Gestionnaire réinitialisé');
    }

    /**
     * Détruire le gestionnaire (nettoyage)
     */
    destroy() {
        console.log('🗑️ Destruction du gestionnaire...');
        
        // Nettoyer les timeouts
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        // Supprimer les event listeners
        window.removeEventListener('popstate', this.handlePopState);
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        
        // Nettoyer les notifications
        const notifications = document.querySelectorAll('.filter-notification');
        notifications.forEach(notif => notif.remove());
        
        console.log('✅ Gestionnaire détruit');
    }
}

// ==========================================
// FONCTIONS GLOBALES ET UTILITAIRES
// ==========================================

/**
 * Fonctions globales pour les callbacks depuis le HTML
 */
window.removeFilter = function(type, value) {
    if (window.filtersManager) {
        window.filtersManager.removeFilter(type, value);
    }
};

window.removeCustomPrice = function() {
    if (window.filtersManager) {
        window.filtersManager.removeCustomPrice();
    }
};

window.clearAllFilters = function() {
    if (window.filtersManager) {
        window.filtersManager.resetAllFilters();
    }
};

window.resetAllFilters = function() {
    if (window.filtersManager) {
        window.filtersManager.resetAllFilters();
    }
};

window.debugFilters = function() {
    if (window.filtersManager) {
        return window.filtersManager.debugFilters();
    }
};

/**
 * Utilitaires pour les prix
 */
window.FiltersUtils = {
    formatPrice: function(price) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(price);
    },
    
    parsePrice: function(priceString) {
        return parseFloat(priceString.replace(/[^\d.-]/g, '')) || 0;
    },
    
    validatePriceRange: function(min, max) {
        const minValue = parseFloat(min) || 0;
        const maxValue = parseFloat(max) || Infinity;
        
        return {
            min: Math.max(0, minValue),
            max: maxValue >= minValue ? maxValue : minValue,
            isValid: maxValue >= minValue
        };
    }
};

// ==========================================
// INITIALISATION ET CONFIGURATION
// ==========================================

// Variable globale pour l'instance
let filtersManager;

// Configuration par défaut
const defaultConfig = {
    autoSubmit: true,
    debounceDelay: 500,
    animationDuration: 300,
    enableUrlSync: true,
    enableLocalStorage: false,
    enableNotifications: true,
    enableKeyboardShortcuts: true
};

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation du système de filtres...');
    
    try {
        // Créer l'instance du gestionnaire
        filtersManager = new JewelryFiltersManager();
        
        // Exposer globalement
        window.filtersManager = filtersManager;
        
        // Configuration personnalisée selon la page
        const currentPage = window.location.pathname;
        if (currentPage.includes('bagues')) {
            console.log('💍 Page bagues détectée');
        } else if (currentPage.includes('bracelets')) {
            console.log('🔗 Page bracelets détectée');
        } else if (currentPage.includes('colliers')) {
            console.log('📿 Page colliers détectée');
        }
        
        // Événements personnalisés
        document.dispatchEvent(new CustomEvent('filtersReady', { 
            detail: { manager: filtersManager } 
        }));
        
        console.log('✅ Système de filtres initialisé avec succès');
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation des filtres:', error);
        
        // Fallback en cas d'erreur
        document.querySelectorAll('form').forEach(form => {
            if (form.id === 'filtersForm') {
                form.addEventListener('submit', function() {
                    console.log('📝 Soumission de formulaire en mode fallback');
                });
            }
        });
    }
});

// Nettoyage avant le déchargement de la page
window.addEventListener('beforeunload', function() {
    if (window.filtersManager) {
        window.filtersManager.destroy();
    }
});

// Gestion des erreurs globales
window.addEventListener('error', function(e) {
    if (e.filename && e.filename.includes('filters')) {
        console.error('❌ Erreur dans le système de filtres:', e.error);
    }
});

// Export pour les modules (si nécessaire)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        JewelryFiltersManager,
        defaultConfig
    };
}