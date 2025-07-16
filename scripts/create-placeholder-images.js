// scripts/create-placeholder-images.js
// Script pour créer de vraies images placeholder

import fs from "fs";
import path from "path";
// const fs = require('fs');
// const path = require('path');

function createPlaceholderImages() {
    console.log('🎨 Création des images placeholder...');
    
    // Créer les dossiers
    const dirs = [
        './public/images',
        './public/images/placeholders',
        './public/uploads/jewels'
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Dossier créé: ${dir}`);
        }
    });

    // SVG pour placeholder général
    const createSVGPlaceholder = (width, height, text, color = '#e2e8f0') => `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${color}"/>
  <rect x="10%" y="10%" width="80%" height="80%" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" rx="8"/>
  <circle cx="40%" cy="35%" r="8%" fill="#94a3b8"/>
  <polygon points="20%,70% 35%,55% 50%,65% 65%,50% 80%,65% 80%,85% 20%,85%" fill="#94a3b8"/>
  <text x="50%" y="95%" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">${text}</text>
</svg>`;

    // SVG pour produit bijou
    const createJewelPlaceholder = (width, height) => `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad1)"/>
  <circle cx="50%" cy="45%" r="15%" fill="none" stroke="#d89ab3" stroke-width="3"/>
  <circle cx="50%" cy="45%" r="8%" fill="#d89ab3" opacity="0.3"/>
  <path d="M40% 30% Q50% 20% 60% 30% Q50% 40% 40% 30%" fill="#d89ab3"/>
  <text x="50%" y="80%" font-family="Georgia, serif" font-size="14" fill="#64748b" text-anchor="middle">Bijou CrystosJewel</text>
</svg>`;

    // Créer les fichiers SVG
    const placeholders = [
        {
            name: 'placeholder-image.svg',
            content: createSVGPlaceholder(400, 300, 'Image', '#f1f5f9')
        },
        {
            name: 'product-placeholder.svg', 
            content: createJewelPlaceholder(300, 300)
        },
        {
            name: 'email-header-bg.svg',
            content: `<svg width="600" height="150" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#d89ab3;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#b794a8;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="600" height="150" fill="url(#headerGrad)"/>
                <text x="300" y="80" font-family="Georgia, serif" font-size="24" fill="white" text-anchor="middle">CrystosJewel</text>
                <text x="300" y="110" font-family="Arial, sans-serif" font-size="14" fill="white" opacity="0.9" text-anchor="middle">Bijoux d'exception</text>
            </svg>`
        }
    ];

    placeholders.forEach(placeholder => {
        const filePath = path.join('./public/images', placeholder.name);
        fs.writeFileSync(filePath, placeholder.content);
        console.log(`✅ Créé: ${placeholder.name}`);
    });

    // Créer aussi des versions JPG simplifiées
    const simpleBase64JPG = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAEOAQ4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6/ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//2Q==';
    
    const jpgFiles = [
        'placeholder-image.jpg',
        'product-placeholder.jpg'
    ];

    jpgFiles.forEach(filename => {
        const jpgPath = path.join('./public/images', filename);
        const buffer = Buffer.from(simpleBase64JPG, 'base64');
        fs.writeFileSync(jpgPath, buffer);
        console.log(`✅ Créé: ${filename}`);
    });

    console.log('🎨 Images placeholder créées avec succès !');
}

// Exporter pour utilisation dans d'autres scripts
if (require.main === module) {
    createPlaceholderImages();
}

module.exports = { createPlaceholderImages };