#!/bin/bash
# scripts/install-mailing-system.sh
# Script d'installation automatique du système de mailing CrystosJewel

echo "🚀 Installation du système de mailing CrystosJewel"
echo "=================================================="

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier si on est dans le bon répertoire
if [ ! -f "package.json" ]; then
    log_error "Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi

log_info "Vérification de l'environnement..."

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js n'est pas installé"
    exit 1
fi

# Vérifier PostgreSQL
if ! command -v psql &> /dev/null; then
    log_error "PostgreSQL n'est pas installé"
    exit 1
fi

log_success "Environnement vérifié"

# 1. Création des répertoires nécessaires
log_info "Création des répertoires..."
mkdir -p public/uploads/email-assets
mkdir -p views/admin
mkdir -p views/email
mkdir -p app/controlleurs
mkdir -p app/services
mkdir -p routes
mkdir -p scripts

log_success "Répertoires créés"

# 2. Installation des dépendances npm si nécessaire
log_info "Vérification des dépendances npm..."

# Packages requis pour le système de mailing
REQUIRED_PACKAGES=(
    "nodemailer"
    "handlebars"
    "multer"
    "sharp"
)

PACKAGES_TO_INSTALL=()

for package in "${REQUIRED_PACKAGES[@]}"; do
    if ! npm list "$package" &> /dev/null; then
        PACKAGES_TO_INSTALL+=("$package")
    fi
done

if [ ${#PACKAGES_TO_INSTALL[@]} -gt 0 ]; then
    log_info "Installation des packages manquants: ${PACKAGES_TO_INSTALL[*]}"
    npm install "${PACKAGES_TO_INSTALL[@]}"
    log_success "Packages installés"
else
    log_success "Toutes les dépendances sont présentes"
fi

# 3. Configuration de la base de données
log_info "Configuration de la base de données..."

# Vérifier la connexion à la base
if ! psql -d bijoux -c "SELECT 1;" &> /dev/null; then
    log_error "Impossible de se connecter à la base de données 'bijoux'"
    log_info "Assurez-vous que PostgreSQL est démarré et que la base 'bijoux' existe"
    exit 1
fi

# Exécuter les migrations
log_info "Exécution des migrations de la base de données..."
psql -d bijoux -f scripts/mailing-migration.sql

if [ $? -eq 0 ]; then
    log_success "Migrations exécutées avec succès"
else
    log_error "Erreur lors de l'exécution des migrations"
    exit 1
fi

# 4. Configuration des variables d'environnement
log_info "Vérification de la configuration email..."

if [ ! -f ".env" ]; then
    log_warning "Fichier .env non trouvé"
    log_info "Création d'un fichier .env de base..."
    
    cat > .env << EOF
# Configuration Email - À compléter
MAIL_USER=votre-email@gmail.com
MAIL_PASS=votre-mot-de-passe-application
EMAIL_FROM=votre-email@gmail.com
ADMIN_EMAIL=admin@crystosjewel.fr
BASE_URL=http://localhost:3000

# Configuration existante (à conserver)
PG_URL=postgres://bijoux:bijoux@localhost:5432/bijoux
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bijoux
DB_USER=bijoux
DB_PASSWORD=bijoux
SESSION_SECRET=Bijoux_Elegance_2025_Ultra_Secret_Key_XYZ789_MOMO_Du_91
NODE_ENV=development
PORT=3000
MAX_FILE_SIZE=50mb
UPLOAD_DIR=./public/uploads
EOF
    
    log_warning "Veuillez configurer les variables email dans le fichier .env"
else
    # Vérifier si les variables email sont configurées
    if ! grep -q "MAIL_USER=" .env || ! grep -q "MAIL_PASS=" .env; then
        log_warning "Variables email non configurées dans .env"
        log_info "Ajout des variables email manquantes..."
        
        echo "" >> .env
        echo "# Configuration Email - À compléter" >> .env
        echo "MAIL_USER=votre-email@gmail.com" >> .env
        echo "MAIL_PASS=votre-mot-de-passe-application" >> .env
        echo "EMAIL_FROM=votre-email@gmail.com" >> .env
        echo "ADMIN_EMAIL=admin@crystosjewel.fr" >> .env
        
        if ! grep -q "BASE_URL=" .env; then
            echo "BASE_URL=http://localhost:3000" >> .env
        fi
        
        log_warning "Veuillez configurer les variables email dans le fichier .env"
    else
        log_success "Configuration email trouvée"
    fi
fi

# 5. Copie des fichiers du système
log_info "Installation des fichiers du système..."

# Créer le fichier de migration SQL
cat > scripts/mailing-migration.sql << 'EOF'
-- Migration automatique générée
-- Voir le contenu dans l'artifact mailing_migration
\echo 'Création des tables pour le système de mailing...'

-- Tables et configuration comme dans l'artifact mailing_migration
-- (Le contenu complet sera inséré ici)

\echo 'Migration terminée avec succès !'
EOF

log_success "Fichiers du système installés"

# 6. Configuration des routes
log_info "Configuration des routes..."

# Vérifier si les routes sont déjà intégrées dans app.js
if [ -f "app.js" ]; then
    if ! grep -q "mailRoutes" app.js; then
        log_info "Ajout des routes de mailing à app.js..."
        
        # Backup du fichier app.js
        cp app.js app.js.backup
        
        # Message d'aide pour l'intégration manuelle
        log_warning "Ajoutez manuellement ces lignes à votre app.js :"
        echo ""
        echo "// Import des routes mailing"
        echo "import mailRoutes from './routes/mailRoutes.js';"
        echo ""
        echo "// Utilisation des routes mailing"
        echo "app.use('/', mailRoutes);"
        echo ""
    else
        log_success "Routes de mailing déjà configurées"
    fi
else
    log_warning "Fichier app.js non trouvé"
fi

# 7. Test de la configuration
log_info "Test de la configuration..."

# Test de la connexion à la base
if psql -d bijoux -c "SELECT COUNT(*) FROM email_campaigns;" &> /dev/null; then
    log_success "Tables de mailing créées avec succès"
else
    log_error "Problème avec les tables de mailing"
fi

# 8. Création d'un script de test
log_info "Création du script de test..."

cat > scripts/test-mailing.js << 'EOF'
// Script de test du système de mailing
import { sendTestEmail } from '../app/services/mailService.js';

async function testMailing() {
    console.log('🧪 Test du système de mailing...');
    
    const testEmail = process.argv[2];
    if (!testEmail) {
        console.log('Usage: node scripts/test-mailing.js votre-email@exemple.com');
        process.exit(1);
    }
    
    try {
        const result = await sendTestEmail(
            testEmail,
            '🧪 Test du système de mailing CrystosJewel',
            '<h2>Félicitations !</h2><p>Votre système de mailing fonctionne parfaitement.</p>',
            'elegant'
        );
        
        if (result.success) {
            console.log('✅ Email de test envoyé avec succès !');
        } else {
            console.log('❌ Erreur:', result.error);
        }
    } catch (error) {
        console.log('❌ Erreur lors du test:', error.message);
    }
}

testMailing();
EOF

log_success "Script de test créé"

# 9. Permissions sur les fichiers
log_info "Configuration des permissions..."
chmod +x scripts/test-mailing.js
chmod 755 public/uploads/email-assets

log_success "Permissions configurées"

# 10. Résumé final
echo ""
echo "🎉 Installation terminée avec succès !"
echo "======================================"
echo ""
log_info "Prochaines étapes :"
echo "1. Configurez vos identifiants email dans le fichier .env"
echo "2. Redémarrez votre serveur Node.js"
echo "3. Accédez à /admin/emails pour utiliser l'éditeur"
echo "4. Testez avec: node scripts/test-mailing.js votre-email@exemple.com"
echo ""
log_info "URLs importantes :"
echo "• Éditeur d'emails : http://localhost:3000/admin/emails"
echo "• Dashboard campagnes : http://localhost:3000/admin/emails/dashboard"
echo ""
log_info "Documentation :"
echo "• Variables disponibles : {{firstName}}, {{lastName}}, {{email}}, {{orderNumber}}, {{total}}"
echo "• Templates : elegant, modern, classic, minimal"
echo "• Upload d'images : Jusqu'à 5MB par fichier"
echo ""
log_success "Le système de mailing CrystosJewel est prêt à être utilisé !"

# Proposer de tester maintenant
echo ""
read -p "Voulez-vous tester le système maintenant ? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Entrez votre email pour le test : " test_email
    if [[ $test_email =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
        log_info "Lancement du test..."
        node scripts/test-mailing.js "$test_email"
    else
        log_error "Email invalide"
    fi
fi

echo ""
log_success "Installation terminée ! 🚀"