"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function lireJsonValide(reponse, messageParDefaut) {
  // Vérifier le statut HTTP AVANT de supposer que la réponse contient du JSON.
  if (!reponse.ok) {
    let message = messageParDefaut;
    if (reponse.headers.get("content-type")?.includes("application/json")) {
      try {
        const details = await reponse.json();
        if (typeof details?.erreur === "string") message = details.erreur;
      } catch {
        // Une page HTML ou un JSON malformé ne doit pas générer d'erreur technique à l'écran.
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

function messagePourUtilisateur(err, defaut) {
  if (err instanceof TypeError) {
    return "Impossible de contacter le serveur. Vérifie qu'il est démarré.";
  }
  return err?.message || defaut;
}

export default function InventairePnj({ token, onSessionExpiree }) {
  const [pnjs, setPnjs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [nom, setNom] = useState("");
  const [classe, setClasse] = useState("");
  const [niveau, setNiveau] = useState("1");
  const [envoi, setEnvoi] = useState(false);
  const [suppressionId, setSuppressionId] = useState(null);

  useEffect(() => {
    const controleur = new AbortController();

    async function chargerPnjs() {
      setErreur("");
      try {
        const reponse = await fetch(`${API_URL}/api/pnj`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controleur.signal,
          cache: "no-store"
        });
        if (reponse.status === 401 || reponse.status === 403) {
          onSessionExpiree();
          return;
        }
        const donnees = await lireJsonValide(reponse, "Impossible de charger les PNJ.");
        if (!Array.isArray(donnees)) {
          throw new Error("La liste des personnages est indisponible.");
        }
        setPnjs(donnees);
      } catch (err) {
        if (err.name !== "AbortError" && !controleur.signal.aborted) {
          setErreur(messagePourUtilisateur(err, "Impossible de charger les PNJ."));
        }
      } finally {
        if (!controleur.signal.aborted) setChargement(false);
      }
    }

    chargerPnjs();
    return () => controleur.abort();
  }, [token, onSessionExpiree]);

  function verifierSession() {
    const tokenActuel = localStorage.getItem("token_taverne");
    if (!tokenActuel || tokenActuel !== token) {
      onSessionExpiree();
      throw new Error("Session absente : reconnecte-toi.");
    }
    return tokenActuel;
  }

  async function ajouterPnj(e) {
    e.preventDefault();
    setErreur("");
    setMessage("");

    const niveauNombre = Number(niveau);
    if (!nom.trim() || nom.trim().length > 100 ||
        !classe.trim() || classe.trim().length > 100 ||
        !Number.isInteger(niveauNombre) ||
        niveauNombre < 1 || niveauNombre > 2147483647) {
      setErreur("Indique un nom, une classe et un niveau entier positif.");
      return;
    }

    setEnvoi(true);
    try {
      const tokenActuel = verifierSession();
      const reponse = await fetch(`${API_URL}/api/pnj`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenActuel}`
        },
        body: JSON.stringify({
          nom: nom.trim(),
          classe: classe.trim(),
          niveau: niveauNombre
        })
      });

      if (reponse.status === 401 || reponse.status === 403) {
        onSessionExpiree();
        throw new Error("Session expirée ou refusée. Reconnecte-toi.");
      }
      const donnees = await lireJsonValide(reponse, "Impossible d'ajouter le personnage.");
      if (!donnees?.personnage) {
        throw new Error("Création non confirmée par le serveur. Réessaie.");
      }

      setPnjs((anciens) => [...anciens, donnees.personnage]);
      setNom("");
      setClasse("");
      setNiveau("1");
      setMessage("Le PNJ a rejoint la Taverne !");
    } catch (err) {
      setErreur(messagePourUtilisateur(err, "Impossible d'ajouter le personnage."));
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimerPnj(pnj) {
    if (!window.confirm(`Supprimer définitivement ${pnj.nom} de l'inventaire ?`)) return;
    setErreur("");
    setMessage("");
    setSuppressionId(pnj.id);
    try {
      const tokenActuel = verifierSession();
      const reponse = await fetch(`${API_URL}/api/pnj/${pnj.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenActuel}` }
      });
      if (reponse.status === 401 || reponse.status === 403) {
        onSessionExpiree();
        throw new Error("Session expirée ou refusée. Reconnecte-toi.");
      }
      await lireJsonValide(reponse, "Impossible de supprimer le personnage.");
      setPnjs((anciens) => anciens.filter((personnage) => personnage.id !== pnj.id));
      setMessage(`${pnj.nom} a été supprimé de l'inventaire.`);
    } catch (err) {
      setErreur(messagePourUtilisateur(err, "Impossible de supprimer le personnage."));
    } finally {
      setSuppressionId(null);
    }
  }

  return (
    <div className="colonnes">
      <section className="panneau">
        <div className="ligneTitre">
          <h2>Inventaire des PNJ</h2>
          <span className="compteur">{pnjs.length} personnage(s)</span>
        </div>
        {chargement ? (
          <p role="status">Le tavernier consulte son registre…</p>
        ) : pnjs.length === 0 ? (
          <p>Aucun personnage pour le moment.</p>
        ) : (
          <div className="grille">
            {pnjs.map((pnj) => (
              <article className="carte" key={pnj.id}>
                <h3>{pnj.nom}</h3>
                <p>Classe : {pnj.classe}</p>
                <p>Niveau : {pnj.niveau}</p>
                <button type="button" className="secondaire bouton-supprimer"
                  disabled={suppressionId !== null || envoi}
                  onClick={() => supprimerPnj(pnj)}>
                  {suppressionId === pnj.id ? "Suppression…" : "Supprimer"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panneau">
        <h2>Enrôler un nouveau PNJ</h2>
        <p className="muted">L'ajout est envoyé au backend avec le token JWT.</p>
        <form className="formulaire" onSubmit={ajouterPnj}>
          <label htmlFor="nom">Nom</label>
          <input id="nom" maxLength={100} required value={nom}
            onChange={(e) => setNom(e.target.value)} placeholder="Ex. Aragorn" />
          <label htmlFor="classe">Classe</label>
          <input id="classe" maxLength={100} required value={classe}
            onChange={(e) => setClasse(e.target.value)} placeholder="Ex. Guerrier" />
          <label htmlFor="niveau">Niveau</label>
          <input id="niveau" type="number" min="1" max="2147483647" required value={niveau}
            onChange={(e) => setNiveau(e.target.value)} />
          <button type="submit" disabled={envoi || suppressionId !== null}>
            {envoi ? "Enregistrement…" : "Ajouter le PNJ"}
          </button>
        </form>
        {message && <p className="succes" role="status">{message}</p>}
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
      </section>
    </div>
  );
}
