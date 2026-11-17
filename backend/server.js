require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const verifierToken = require("./middlewares/auth");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET manque dans le fichier .env");
}

const app = express();
const PORT = process.env.PORT || 3000;
const origineFrontend = process.env.FRONTEND_ORIGIN || "http://localhost:3001";

app.use(cors({ origin: origineFrontend }));
app.use(express.json({ limit: "20kb" }));

// Limitation simple par IP : 10 tentatives de connexion par période de 15 minutes.
// Pour un déploiement multi-serveurs, utiliser un stockage partagé (Redis).
const tentativesConnexion = new Map();
const FENETRE_CONNEXION = 15 * 60 * 1000;
const MAX_TENTATIVES = 10;

function limiterConnexion(req, res, next) {
  const maintenant = Date.now();
  const cle = req.ip || req.socket.remoteAddress || "inconnu";
  const entree = tentativesConnexion.get(cle);

  if (!entree || maintenant >= entree.expireA) {
    tentativesConnexion.set(cle, { nombre: 1, expireA: maintenant + FENETRE_CONNEXION });
    return next();
  }
  if (entree.nombre >= MAX_TENTATIVES) {
    res.set("Retry-After", String(Math.ceil((entree.expireA - maintenant) / 1000)));
    return res.status(429).json({ erreur: "Trop de tentatives de connexion. Réessaie dans quelques minutes." });
  }
  entree.nombre += 1;
  return next();
}

const purgeTentatives = setInterval(() => {
  const maintenant = Date.now();
  for (const [cle, entree] of tentativesConnexion) {
    if (maintenant >= entree.expireA) tentativesConnexion.delete(cle);
  }
}, FENETRE_CONNEXION);
purgeTentatives.unref();

// Route publique : authentifier un utilisateur
app.post("/api/login", limiterConnexion, async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || !email.trim() ||
      typeof password !== "string" || !password) {
    return res.status(400).json({ erreur: "Email et mot de passe requis" });
  }

  try {
    const resultat = await pool.query(
      "SELECT id, email, mot_de_passe FROM utilisateur WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    const utilisateur = resultat.rows[0];
    if (!utilisateur) {
      return res.status(401).json({ erreur: "Identifiants incorrects" });
    }

    const motDePasseValide = await bcrypt.compare(password, utilisateur.mot_de_passe);
    if (!motDePasseValide) {
      return res.status(401).json({ erreur: "Identifiants incorrects" });
    }

    const token = jwt.sign({ id: utilisateur.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h"
    });

    return res.status(200).json({ message: "Connexion réussie", token });
  } catch (erreur) {
    console.error("Erreur de connexion :", erreur.message);
    return res.status(500).json({ erreur: "Impossible de se connecter" });
  }
});

// Route protégée : lire l'inventaire
app.get("/api/pnj", verifierToken, async (req, res) => {
  try {
    const resultat = await pool.query("SELECT * FROM personnage ORDER BY id");
    return res.status(200).json(resultat.rows);
  } catch (erreur) {
    console.error("Erreur SQL :", erreur.message);
    return res.status(500).json({ erreur: "Impossible de récupérer les PNJ" });
  }
});

// Route protégée : ajouter un PNJ
app.post("/api/pnj", verifierToken, async (req, res) => {
  const { nom, classe, niveau } = req.body || {};
  const nomNettoye = typeof nom === "string" ? nom.trim() : "";
  const classeNettoyee = typeof classe === "string" ? classe.trim() : "";

  if (!nomNettoye || nomNettoye.length > 100 ||
      !classeNettoyee || classeNettoyee.length > 100 ||
      !Number.isInteger(niveau) || niveau < 1 || niveau > 2147483647) {
    return res.status(400).json({
      erreur: "Nom et classe requis (100 caractères maximum), niveau entier positif requis"
    });
  }

  try {
    const resultat = await pool.query(
      "INSERT INTO personnage (nom, classe, niveau) VALUES ($1, $2, $3) RETURNING *",
      [nomNettoye, classeNettoyee, niveau]
    );

    return res.status(201).json({
      message: "Le PNJ a rejoint la taverne !",
      personnage: resultat.rows[0]
    });
  } catch (erreur) {
    console.error("Erreur SQL :", erreur.message);
    return res.status(500).json({ erreur: "Impossible de créer le PNJ" });
  }
});

// Route protégée : retrouver un PNJ précis
app.get("/api/pnj/:id", verifierToken, async (req, res) => {
  const idSaisi = Number(req.params.id);

  if (!Number.isInteger(idSaisi) || idSaisi < 1 || idSaisi > 2147483647) {
    return res.status(400).json({ erreur: "L'identifiant doit être un entier positif valide" });
  }

  try {
    const resultat = await pool.query(
      "SELECT * FROM personnage WHERE id = $1",
      [idSaisi]
    );
    if (!resultat.rows.length) {
      return res.status(404).json({ erreur: "PNJ introuvable" });
    }
    return res.status(200).json(resultat.rows[0]);
  } catch (erreur) {
    console.error("Erreur SQL :", erreur.message);
    return res.status(500).json({ erreur: "Impossible de récupérer le PNJ" });
  }
});

// Route protégée : suppression réelle d'un PNJ, après confirmation côté frontend
app.delete("/api/pnj/:id", verifierToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    return res.status(400).json({ erreur: "Identifiant de personnage invalide" });
  }
  try {
    const resultat = await pool.query(
      "DELETE FROM personnage WHERE id = $1 RETURNING id",
      [id]
    );
    if (resultat.rowCount === 0) {
      return res.status(404).json({ erreur: "PNJ introuvable" });
    }
    return res.status(200).json({ message: "PNJ supprimé", id });
  } catch (erreur) {
    console.error("Erreur de suppression :", erreur.message);
    return res.status(500).json({ erreur: "Impossible de supprimer le PNJ" });
  }
});

// Toujours renvoyer une erreur JSON (y compris si express.json échoue).
app.use((erreur, req, res, next) => {
  if (res.headersSent) return next(erreur);
  if (erreur.type === "entity.too.large" || erreur.status === 413) {
    return res.status(413).json({ erreur: "Requête trop volumineuse (20 Ko maximum)." });
  }
  if (erreur.type === "entity.parse.failed" ||
      (erreur instanceof SyntaxError && "body" in erreur)) {
    return res.status(400).json({ erreur: "Le corps de la requête contient un JSON invalide." });
  }
  console.error("Erreur serveur :", erreur.message);
  return res.status(500).json({ erreur: "Une erreur interne est survenue." });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
