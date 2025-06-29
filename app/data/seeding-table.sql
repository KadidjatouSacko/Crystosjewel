-- Début de la transaction
BEGIN;

<<<<<<< HEAD
-- Suppression des tables si elles existent déjà
DROP TABLE IF EXISTS "payment" CASCADE;
DROP TABLE IF EXISTS "order_address" CASCADE;
DROP TABLE IF EXISTS "order_items" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;
DROP TABLE IF EXISTS "jewel_images" CASCADE;
DROP TABLE IF EXISTS "jewel" CASCADE;
DROP TABLE IF EXISTS "material" CASCADE;
DROP TABLE IF EXISTS "category" CASCADE;
DROP TABLE IF EXISTS "types" CASCADE;
DROP TABLE IF EXISTS "favorites" CASCADE;
DROP TABLE IF EXISTS "cart" CASCADE;


-- Insertion des catégories
INSERT INTO "category" ("name")
VALUES 
    ('Bracelets'),
    ('Colliers'),
    ('Bagues'),
    ('Promotions');



-- Insertion des matériaux
INSERT INTO "material" ("name", "created_at", "updated_at")
VALUES
    ('Or', NOW(), NOW()),
    ('Argent', NOW(), NOW()),
    ('Platine', NOW(), NOW()),
    ('Diamant', NOW(), NOW()),
    ('Perle', NOW(), NOW()),
    ('Cuivre', NOW(), NOW()),
    ('Acier inoxydable', NOW(), NOW()),
    ('Titanium', NOW(), NOW());



-- Insertion des bijoux
INSERT INTO "jewel" ("name", "description", "price_ttc", "tva", "price_ht", "taille", "poids", "matiere", "carat", "stock", "category_id", "images")
VALUES
    ('Bracelet Or', 'Bracelet en or 18 carats', 500.00, 20.00, 416.67, 'M', 20.00, 'Or', 18, 10, 1, '["image1.jpg", "image2.jpg"]'),
    ('Collier Diamant', 'Collier avec diamant central', 1500.00, 20.00, 1250.00, 'L', 15.00, 'Diamant', 2, 5, 2, '["image3.jpg", "image4.jpg"]');


-- Insertion des types de bijoux
INSERT INTO "types" ("name")
VALUES
    ('Bagues'),
    ('Colliers'),
    ('Bracelets');


-- Insertion des images des bijoux
INSERT INTO "jewel_images" ("image_url", "jewel_id")
VALUES
    ('image1.jpg', 1),
    ('image2.jpg', 1),
    ('image3.jpg', 2),
    ('image4.jpg', 2);



-- Insertion des commandes
INSERT INTO "orders" ("numero_commande", "numero_suivi", "transporteur", "status_suivi", "date_livraison_prevue")
VALUES
    ('CMD123', 'TRK123', 'Colis Express', 'En cours', '2025-05-10'),
    ('CMD124', 'TRK124', 'FedEx', 'Livré', '2025-05-15');



-- Insertion des lignes de commande
INSERT INTO "order_items" ("order_id", "jewel_id", "quantity", "price")
VALUES
    (1, 1, 1, 500.00),
    (2, 2, 1, 1500.00);



-- Insertion des adresses de commande
INSERT INTO "order_address" ("order_id", "nom", "adresse", "ville", "code_postal", "pays", "telephone")
VALUES
    (1, 'John Doe', '123 Rue Principale', 'Paris', '75001', 'France', '0123456789'),
    (2, 'Jane Smith', '456 Avenue de la Liberté', 'Lyon', '69001', 'France', '0987654321');



-- Insertion des paiements
INSERT INTO "payment" ("amount", "method", "status", "order_id")
VALUES
    (500.00, 'Carte bancaire', 'Validé', 1),
    (1500.00, 'PayPal', 'Validé', 2);



-- Insertion des favoris
INSERT INTO "favorites" ("jewel_id")
VALUES
    (1),
    (2);



-- Insertion du panier
INSERT INTO "cart" ("jewel_id", "quantity")
VALUES
    (1, 2),
    (2, 1);

-- Commit de la transaction
COMMIT;

