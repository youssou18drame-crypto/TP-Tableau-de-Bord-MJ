-- À exécuter sur une base PostgreSQL de test.
-- Si vous utilisez la base du TP précédent, vérifiez les tables avant exécution.
CREATE TABLE IF NOT EXISTS utilisateur (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personnage (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    classe VARCHAR(100) NOT NULL,
    niveau INTEGER NOT NULL CHECK (niveau >= 1)
);

-- Données de démonstration optionnelles (décommenter une seule fois sur une base neuve)
-- INSERT INTO personnage (nom, classe, niveau) VALUES
-- ('Gimli', 'Guerrier', 10),
-- ('Gandalf', 'Mage', 20),
-- ('Gobelin', 'Voleur', 3),
-- ('Legolas', 'Archer', 12);
