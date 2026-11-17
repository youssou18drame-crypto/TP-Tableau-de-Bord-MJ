# TP — Le Tableau de Bord du Maître du Jeu

Projet BTS SIO SLAM : **API REST Node.js/Express, cybersécurité JWT et frontend Next.js App Router**.

Ce dépôt contient deux applications distinctes dans un **seul dépôt GitHub**.

```text
TP-Tableau-de-Bord-MJ/
├── frontend/      Next.js — http://localhost:3001
├── backend/       Express — http://localhost:3000
│   └── middlewares/auth.js
├── database/
│   └── init.sql
├── .gitignore
└── README.md
```

## 1. Prérequis

Node.js 20.9+ (de préférence une version LTS compatible avec Next.js), npm, une base PostgreSQL accessible (Neon ou locale). Tous les fichiers `.env` restent **hors GitHub**.

## 2. Préparer la base PostgreSQL

Exécuter `database/init.sql` une seule fois sur une base de test vide, à l'aide de psql ou de l'éditeur SQL Neon.

**Si les tables du TP précédent existent déjà, conserver leurs données et vérifier leur structure avant d'exécuter le SQL.** Le script crée seulement les tables absentes.

## 3. Configurer et lancer le backend

Dans un premier terminal :

```bash
cd backend
npm install
npm start
```

Avant `npm start`, créer **`backend/.env`** en s'inspirant de `backend/.env.example` :

```env
PORT=3000
DATABASE_URL=postgresql://UTILISATEUR:MOT_DE_PASSE@HOTE:5432/NOM_BASE?sslmode=require
JWT_SECRET=REMPLACER_PAR_UN_SECRET_LONG_ET_ALEATOIRE
FRONTEND_ORIGIN=http://localhost:3001
```

Ce sont des exemples, pas des identifiants fonctionnels. **Ne jamais publier le fichier .env.** Transmettre au professeur les paramètres réels de façon privée et avec des accès de test dédiés.

Créer ensuite un compte de test pour le Maître du Jeu :

```bash
node creer-utilisateur.js
```

Le script demande une adresse email et un mot de passe (saisi en clair dans le terminal local, puis haché avec bcrypt en base).

## 4. Configurer et lancer le frontend

Dans un second terminal :

```bash
cd frontend
npm install
npm run dev
```

Avant le démarrage, créer `frontend/.env.local` :

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Ouvrir **http://localhost:3001** ; se connecter avec le compte de test créé précédemment.

## 5. Fonctionnalités et routes API

- `POST /api/login` (publique) : vérifier email/password, retourner un token JWT (durée 1 h)
- `GET /api/pnj` (JWT) : récupérer tous les personnages
- `GET /api/pnj/:id` (JWT) : récupérer un personnage
- `POST /api/pnj` (JWT) : enregistrer un personnage dans PostgreSQL
- `DELETE /api/pnj/:id` (JWT) : **simulation uniquement**, aucune suppression réelle

Les requêtes authentifiées utilisent `Authorization: Bearer <token>`.

Le frontend conserve le JWT dans localStorage, affiche le tableau de bord après connexion, gère chargement/erreur, permet d'ajouter un PNJ et de se déconnecter.

## 6. Recette de validation pour le professeur

1. Démarrer Express (3000) et Next.js (3001).
2. Vérifier qu'une mauvaise connexion donne un message d'erreur.
3. Se connecter avec le compte de test.
4. Afficher la liste des PNJ.
5. Ajouter un personnage et vérifier qu'il reste après F5.
6. Supprimer le token avec les outils du navigateur puis essayer un POST : le refus 401 doit être géré sans crash.
7. Tester une requête non authentifiée avec `curl -i http://localhost:3000/api/pnj` : HTTP 401 attendu.

## Remarques de sécurité

CORS limite les origines navigateur mais **ne remplace pas l'authentification**. Le serveur doit valider le JWT pour les routes protégées. localStorage présente un risque en cas de XSS : ce choix correspond au support pédagogique, et n'est pas recommandé pour une application sensible. Pour la correction, utiliser un compte et une base PostgreSQL de test, puis retirer les accès après l'évaluation.

## Reproductibilité

Le projet dépend d'une base PostgreSQL externe : le clone seul ne suffit pas sans la configuration privée, l'initialisation des tables et un compte test. La création de compte et le SQL d'initialisation sont fournis pour éviter une configuration manuelle.
