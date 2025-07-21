/**
 * ================================
 * JAVASCRIPT GLOBAL POUR TOUTES LES CATÉGORIES
 * Système complet : filtres, panier, badges, animations
 * ================================
 */

class JewelryManager {
    constructor() {
        this.init();
    }

    init() {
        console.log('🚀 Initialisation du système de bijoux');
        
        // Initialiser tous les systèmes
        this.initFilters();
        this.initCart();
        this.initAnimations();
        this.initResponsive();
        this.initScrollEffects();
        
        console.log('✅ Système de bijoux initialisé');
    }

    // ================================
    // SYSTÈME DE FILTRES
    // ================================
    initFilters() {
        // Toggle filtres
        window.toggleFilters = () => {
            const filterOptions = document.getElementById('filterOptions');
            const sortOptions = document.getElementById('sortOptions');
            
            if (sortOptions && sortOptions.classList.contains('active')) {
                sortOptions.classList.remove('active');
            }
            
            if (filterOptions) {
                filterOptions.classList.toggle('active');
            }
        };

        // Toggle tri
        window.toggleSort = () => {
            const filterOptions = document.getElementById('filterOptions');
            const sortOptions = document.getElementById('sortOptions');
            
            if (filterOptions && filterOptions.classList.contains('active')) {
                filterOptions.classList.remove('active');
            }
            
            if (sortOptions) {
                sortOptions.classList.toggle('active');
            }
        };

        // Fermer dropdowns quand on clique ailleurs
        document.addEventListener('click', (event) => {
            const filterDropdown = event.target.closest('.filter-dropdown');
            const filterOptions = document.getElementById('filterOptions');
            const sortOptions = document.getElementById('sortOptions');
            
            if (!filterDropdown) {
                if (filterOptions) filterOptions.classList.remove('active');
                if (sortOptions) sortOptions.classList.remove('active');
            }
        });

        console.log('✅ Système de filtres initialisé');
    }

    // ================================
    // SYSTÈME DE PANIER
    // ================================
    initCart() {
        const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');
        
        addToCartButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const jewelId = button.getAttribute('data-jewel-id');
                const jewelName = button.getAttribute('data-jewel-name');
                
                this.addToCart(jewelId, jewelName, button);
            });
        });

        console.log(`✅ Système panier initialisé pour ${addToCartButtons.length} produits`);
    }

    async addToCart(jewelId, jewelName, button) {
        try {
            // Animation du bouton
            this.animateButton(button, 'loading');
            
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
                this.animateButton(button, 'success');
                this.showNotification(`${jewelName} ajouté au panier !`, 'success');
                this.updateCartCounter();
                
                // Remettre le bouton normal après 2 secondes
                setTimeout(() => {
                    this.resetButton(button);
                }, 2000);
                
            } else {
                this.animateButton(button, 'error');
                this.showNotification(data.message || 'Erreur lors de l\'ajout au panier', 'error');
                
                setTimeout(() => {
                    this.resetButton(button);
                }, 2000);
            }
            
        } catch (error) {
            console.error('Erreur ajout panier:', error);
            this.animateButton(button, 'error');
            this.showNotification('Erreur de connexion', 'error');
            
            setTimeout(() => {
                this.resetButton(button);
            }, 2000);
        }
    }

    animateButton(button, state) {
        const originalContent = button.getAttribute('data-original-content') || button.innerHTML;
        button.setAttribute('data-original-content', originalContent);
        
        switch(state) {
            case 'loading':
                button.style.transform = 'scale(0.95)';
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout...';
                button.disabled = true;
                break;
                
            case 'success':
                button.style.transform = 'scale(1)';
                button.innerHTML = '<i class="fas fa-check"></i> Ajouté !';
                button.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                break;
                
            case 'error':
                button.style.transform = 'scale(1)';
                button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erreur';
                button.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                break;
        }
    }

    resetButton(button) {
        const originalContent = button.getAttribute('data-original-content');
        if (originalContent) {
            button.innerHTML = originalContent;
        } else {
            button.innerHTML = '<i class="fas fa-shopping-cart"></i> Ajouter au panier';
        }
        button.style.background = 'linear-gradient(135deg, var(--rose-gold), var(--rose-gold-dark))';
        button.style.transform = 'scale(1)';
        button.disabled = false;
    }

    async updateCartCounter() {
        try {
            const response = await fetch('/panier/count');
            const data = await response.json();
            
            const cartCounters = document.querySelectorAll('.cart-count, .cart-counter, .cart-badge');
            cartCounters.forEach(counter => {
                counter.textContent = data.count || 0;
                if (data.count > 0) {
                    counter.style.display = 'block';
                    counter.classList.add('animate-bounce');
                    setTimeout(() => counter.classList.remove('animate-bounce'), 600);
                }
            });
        } catch (error) {
            console.error('Erreur mise à jour compteur:', error);
        }
    }

    // ================================
    // SYSTÈME DE NOTIFICATIONS
    // ================================
    showNotification(message, type = 'success') {
        // Supprimer les notifications existantes
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Styles de la notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            z-index: 9999;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            min-width: 300px;
            background: ${type === 'success' ? 'linear-gradient(135deg, #27ae60, #2ecc71)' : 'linear-gradient(135deg, #e74c3c, #c0392b)'};
            font-family: 'Montserrat', sans-serif;
            font-weight: 600;
        `;
        
        document.body.appendChild(notification);
        
        // Animation d'entrée
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Animation de sortie automatique
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, 4000);
    }

    // ================================
    // SYSTÈME D'ANIMATIONS
    // ================================
    initAnimations() {
        // Animation des cartes au survol
        const productCards = document.querySelectorAll('.product-card');
        productCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                const badge = card.querySelector('.product-badge');
                if (badge && badge.classList.contains('promo')) {
                    badge.style.animation = 'none';
                    setTimeout(() => {
                        badge.style.animation = 'pulse 2s infinite, badgeAppear 0.5s ease-out';
                    }, 100);
                }
            });
        });

        // Animation des badges promotionnels
        const promoBadges = document.querySelectorAll('.product-badge.promo');
        promoBadges.forEach(badge => {
            // Ajouter un effet de scintillement périodique
            setInterval(() => {
                badge.style.boxShadow = '0 4px 20px rgba(231, 76, 60, 0.5)';
                setTimeout(() => {
                    badge.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                }, 300);
            }, 3000);
        });

        console.log('✅ Animations initialisées');
    }

    // ================================
    // EFFETS DE DÉFILEMENT
    // ================================
    initScrollEffects() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        // Observer toutes les cartes produits avec un délai progressif
        const productCards = document.querySelectorAll('.product-card');
        productCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
            observer.observe(card);
        });

        // Bouton retour en haut
        this.initBackToTop();

        console.log('✅ Effets de défilement initialisés');
    }

    initBackToTop() {
        // Créer le bouton retour en haut s'il n'existe pas
        let backToTopBtn = document.getElementById('backToTop');
        if (!backToTopBtn) {
            backToTopBtn = document.createElement('button');
            backToTopBtn.id = 'backToTop';
            backToTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            backToTopBtn.style.cssText = `
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--rose-gold), var(--rose-gold-dark));
                color: white;
                border: none;
                cursor: pointer;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
                z-index: 1000;
                box-shadow: 0 4px 15px rgba(183, 110, 121, 0.3);
            `;
            document.body.appendChild(backToTopBtn);
        }

        // Afficher/masquer le bouton selon le défilement
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.style.opacity = '1';
                backToTopBtn.style.visibility = 'visible';
            } else {
                backToTopBtn.style.opacity = '0';
                backToTopBtn.style.visibility = 'hidden';
            }
        });

        // Action du bouton
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ================================
    // GESTION RESPONSIVE
    // ================================
    initResponsive() {
        window.addEventListener('resize', () => {
            const filterOptions = document.getElementById('filterOptions');
            const sortOptions = document.getElementById('sortOptions');
            
            // Fermer les dropdowns sur redimensionnement mobile
            if (window.innerWidth <= 768) {
                if (filterOptions) filterOptions.classList.remove('active');
                if (sortOptions) sortOptions.classList.remove('active');
            }
        });

        // Gestion du swipe sur mobile pour les cartes produits
        if ('ontouchstart' in window) {
            this.initTouchGestures();
        }

        console.log('✅ Gestion responsive initialisée');
    }

    initTouchGestures() {
        const productCards = document.querySelectorAll('.product-card');
        
        productCards.forEach(card => {
            let startX = 0;
            let currentX = 0;
            let cardTransform = 0;

            card.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            });

            card.addEventListener('touchmove', (e) => {
                currentX = e.touches[0].clientX;
                cardTransform = currentX - startX;
                
                // Limiter le mouvement
                if (Math.abs(cardTransform) < 50) {
                    card.style.transform = `translateX(${cardTransform}px)`;
                }
            });

            card.addEventListener('touchend', () => {
                card.style.transform = 'translateX(0)';
                
                // Action selon le swipe
                if (cardTransform > 30) {
                    // Swipe droite - Ajouter aux favoris (si activé)
                    console.log('Swipe droite détecté');
                } else if (cardTransform < -30) {
                    // Swipe gauche - Ajouter au panier
                    const addBtn = card.querySelector('.add-to-cart-btn');
                    if (addBtn) addBtn.click();
                }
            });
        });
    }

    // ================================
    // MÉTHODES UTILITAIRES
    // ================================
    
    // Formater les prix
    formatPrice(price) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(price);
    }

    // Gérer les états de chargement
    showLoading(element) {
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
        element.disabled = true;
    }

    hideLoading(element, originalContent) {
        element.innerHTML = originalContent;
        element.disabled = false;
    }

    // Debounce pour les recherches
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

    // Méthode pour reload dynamique des produits (AJAX)
    async reloadProducts(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`${window.location.pathname}?${params}`, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                const newProductsGrid = doc.querySelector('.products-grid');
                const currentProductsGrid = document.querySelector('.products-grid');
                
                if (newProductsGrid && currentProductsGrid) {
                    currentProductsGrid.innerHTML = newProductsGrid.innerHTML;
                    this.initScrollEffects(); // Réinitialiser les animations
                    this.initCart(); // Réinitialiser les événements panier
                }
            }
        } catch (error) {
            console.error('Erreur rechargement produits:', error);
        }
    }
}

// ================================
// INITIALISATION GLOBALE
// ================================
document.addEventListener('DOMContentLoaded', () => {
    window.jewelryManager = new JewelryManager();
});

// ================================
// STYLES CSS ADDITIONNELS POUR JS
// ================================
const additionalStyles = `
    .notification-close {
        background: none;
        border: none;
        color: white;
        margin-left: 10px;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
        transition: background 0.3s ease;
    }
    
    .notification-close:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    .animate-bounce {
        animation: bounce 0.6s ease-in-out;
    }
    
    @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
    }
    
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: var(--rose-gold);
        animation: spin 1s ease-in-out infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;

// Injecter les styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

console.log('🎉 Système complet de bijoux chargé !');