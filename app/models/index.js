// models/index.js
import { sequelize } from "./sequelize-client.js";  // Importer l'instance sequelize
import { Category } from "./categoryModel.js";  // Importer le modèle Category
// import { Product } from "./productModel.js";  // Si tu as d'autres modèles
import "./associations.js";  // Charger les associations après les modèles

// Synchroniser les modèles avec la base de données
sequelize.sync()
    .then(() => console.log("Les modèles sont synchronisés avec la base de données"))
    .catch(error => console.error("Erreur de synchronisation des modèles", error));
