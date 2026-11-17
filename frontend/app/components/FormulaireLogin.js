"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function lireJsonValide(reponse) {
  if (!reponse.ok) {
    let message = "Connexion impossible. Vérifie tes identifiants ou réessaie.";
    if (reponse.headers.get("content-type")?.includes("application/json")) {
      try {
        const details = await reponse.json();
        if (typeof details?.erreur === "string") message = details.erreur;
      } catch {
        // Ne pas afficher les erreurs techniques de lecture du JSON.
      }
    }
    throw new Error(message);
  }
  try {
    return await reponse.json();
  } catch {
    throw new Error("Réponse inattendue du serveur. Réessaie.");
  }
}

export default function FormulaireLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  async function gererConnexion(e) {
    e.preventDefault();
    setErreur("");
    setChargement(true);

    try {
      const reponse = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const donnees = await lireJsonValide(reponse);

      if (typeof donnees?.token !== "string" || !donnees.token) {
        throw new Error("La connexion n'a pas pu être validée. Réessaie.");
      }

      localStorage.setItem("token_taverne", donnees.token);
      onLoginSuccess(donnees.token);
    } catch (err) {
      setErreur(err instanceof TypeError
        ? "Impossible de contacter le serveur. Vérifie qu'il est démarré."
        : err.message || "Connexion impossible. Réessaie.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <section className="connexion">
      <h2>Connexion du Maître du Jeu</h2>
      <p className="muted">Identifie-toi pour gérer les personnages.</p>
      <form onSubmit={gererConnexion} className="formulaire">
        <label htmlFor="email">Adresse email</label>
        <input id="email" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Mot de passe</label>
        <input id="password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button disabled={chargement} type="submit">
          {chargement ? "Connexion en cours…" : "Se connecter"}
        </button>
      </form>
    </section>
  );
}
