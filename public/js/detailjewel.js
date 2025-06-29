document.addEventListener('DOMContentLoaded', function() {
  console.log("Script de galerie chargé");
  
  // Variables pour la galerie d'images
  const mainImage = document.getElementById('mainImage');
  const thumbnails = document.querySelectorAll('.thumbnail');
  const nextBtn = document.querySelector('.next-btn');
  const prevBtn = document.querySelector('.prev-btn');
  
  // Variables pour le menu mobile
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  const overlay = document.getElementById('overlay');
  
  // Variables pour les onglets
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Variables pour la gestion de quantité
  const quantityInput = document.querySelector('.quantity-input');
  const quantityBtns = document.querySelectorAll('.quantity-btn');
  
  // Débogage - afficher le nombre de miniatures trouvées
  console.log("Nombre de miniatures trouvées:", thumbnails.length);
  thumbnails.forEach((thumb, idx) => {
    console.log(`Miniature ${idx}:`, thumb.src);
  });
  
  // Initialisation des variables globales
  let currentIndex = 0;
  let maxIndex = thumbnails.length - 1;
  
  // Fonction pour mettre à jour l'image principale
  function updateMainImage(index) {
    console.log("Mise à jour de l'image, index:", index);
    
    // S'assurer que l'index est valide
    if (index < 0) index = maxIndex;
    if (index > maxIndex) index = 0;
    
    // Désactiver tous les thumbnails
    thumbnails.forEach(thumb => thumb.classList.remove('active'));
    
    // Activer le thumbnail actuel
    thumbnails[index].classList.add('active');
    
    // Mettre à jour l'image principale
    mainImage.src = thumbnails[index].src;
    console.log("Nouvelle source d'image:", mainImage.src);
    
    // Mettre à jour l'index courant
    currentIndex = index;
  }
  
  // Gestionnaires d'événements pour les boutons de navigation
  if (nextBtn) {
    console.log("Bouton suivant trouvé");
    nextBtn.addEventListener('click', function() {
      console.log("Clic sur bouton suivant");
      updateMainImage(currentIndex + 1);
    });
  } else {
    console.log("Bouton suivant NON trouvé");
  }
  
  if (prevBtn) {
    console.log("Bouton précédent trouvé");
    prevBtn.addEventListener('click', function() {
      console.log("Clic sur bouton précédent");
      updateMainImage(currentIndex - 1);
    });
  } else {
    console.log("Bouton précédent NON trouvé");
  }
  
  // Ajouter des écouteurs d'événements aux miniatures
  thumbnails.forEach((thumbnail, index) => {
    thumbnail.addEventListener('click', function() {
      console.log("Clic sur miniature:", index);
      updateMainImage(index);
    });
  });
  
  // Gestion du menu mobile
  if (menuToggle && mobileNav && overlay) {
    menuToggle.addEventListener('click', function() {
      mobileNav.classList.toggle('active');
      overlay.classList.toggle('active');
    });
    
    overlay.addEventListener('click', function() {
      mobileNav.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
  
  // Gestion des onglets
  tabButtons.forEach((button, index) => {
    button.addEventListener('click', function() {
      // Désactiver tous les boutons et contenus
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Activer le bouton et le contenu correspondant
      button.classList.add('active');
      tabContents[index].classList.add('active');
    });
  });
  
  // Gestion de la quantité
  if (quantityBtns.length === 2) {
    const minusBtn = quantityBtns[0];
    const plusBtn = quantityBtns[1];
    
    minusBtn.addEventListener('click', function() {
      let currentQuantity = parseInt(quantityInput.value);
      if (currentQuantity > 1) {
        quantityInput.value = currentQuantity - 1;
      }
    });
    
    plusBtn.addEventListener('click', function() {
      let currentQuantity = parseInt(quantityInput.value);
      quantityInput.value = currentQuantity + 1;
    });
  }
  
  // Initialiser l'image principale avec la première miniature
  if (thumbnails.length > 0) {
    console.log("Initialisation avec la première miniature");
    updateMainImage(0);
  } else {
    console.log("Aucune miniature trouvée pour l'initialisation");
  }
});