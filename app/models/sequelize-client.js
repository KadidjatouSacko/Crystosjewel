// models/sequelize-client.js
import "dotenv/config";  // Charger les variables d'environnement en premier
import { Sequelize } from "sequelize";

// Crée une instance de Sequelize
export const sequelize = new Sequelize(
    process.env.PG_URL,
    {
        define: {
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    }
);

// Test de la connexion
sequelize.authenticate()
    .then(() => console.log('La connexion à la base de données a réussi.'))
    .catch((error) => console.error('Impossible de se connecter à la base de données:', error));
