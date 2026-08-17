// Logique de jeu pure : ne touche ni au port série ni au terminal, donc
// testable sans matériel branché.
//
// Règle du jeu : le premier à buzzer a le droit de répondre à l'oral.
// L'animateur valide la réponse : bonne -> point, mauvaise -> son buzzer est
// désactivé pour cette question (les autres peuvent retenter). L'animateur
// peut passer la question à tout moment.
function creerJeu(joueurs) {
  const classement = new Map(joueurs.map((j) => [j.id, 0]));

  // 'fermee'       : pas de question en cours, en attente que l'animateur en ouvre une.
  // 'attente_buzz' : question ouverte, en attente qu'un joueur non éliminé buzze.
  // 'en_reponse'   : un joueur a buzzé et répond à l'oral, plus personne d'autre ne peut buzzer.
  let etat = 'fermee';
  let joueurQuiRepond = null;
  let joueursElimines = new Set();

  function demarrerQuestion() {
    etat = 'attente_buzz';
    joueurQuiRepond = null;
    joueursElimines = new Set();
  }

  // Renvoie le joueur qui prend la main pour répondre, ou null si le buzz est ignoré
  // (question fermée, quelqu'un répond déjà, ou ce joueur est déjà éliminé sur cette question).
  function enregistrerBuzz(joueurId, horodatage) {
    if (etat !== 'attente_buzz') return null;
    if (joueursElimines.has(joueurId)) return null;

    etat = 'en_reponse';
    joueurQuiRepond = joueurId;
    return { joueurId, horodatage };
  }

  // À appeler par l'animateur une fois la réponse orale entendue.
  // `gain` : nombre de points (ou de cases, selon le mode de jeu) gagnés sur
  // une bonne réponse — 1 par défaut pour le quiz classique.
  function validerReponse(estCorrecte, gain = 1) {
    if (etat !== 'en_reponse') return null;

    const joueurId = joueurQuiRepond;
    joueurQuiRepond = null;

    if (estCorrecte) {
      classement.set(joueurId, classement.get(joueurId) + gain);
      etat = 'fermee';
      return { resultat: 'correct', joueurId };
    }

    joueursElimines.add(joueurId);

    if (joueursElimines.size >= joueurs.length) {
      etat = 'fermee';
      return { resultat: 'incorrect', joueurId, plusPersonne: true };
    }

    etat = 'attente_buzz';
    return { resultat: 'incorrect', joueurId, plusPersonne: false };
  }

  // Annule l'élimination d'un joueur sur la question en cours (effet "Joker"
  // du chemin des étoiles). Rouvre la question si elle venait tout juste de se
  // fermer faute de joueur restant — à appeler immédiatement après un
  // `validerReponse(false)` qui a renvoyé `plusPersonne: true`, jamais plus tard.
  function annulerElimination(joueurId) {
    if (etat === 'fermee' && joueursElimines.has(joueurId) && joueursElimines.size >= joueurs.length) {
      etat = 'attente_buzz';
    }
    joueursElimines.delete(joueurId);
  }

  // L'animateur peut passer la question si personne ne trouve, ou à tout moment.
  function passerQuestion() {
    if (etat === 'fermee') return null;

    etat = 'fermee';
    joueurQuiRepond = null;
    return { resultat: 'skip' };
  }

  // Ajoute une équipe en cours de partie (rejoint avec 0 point).
  function ajouterJoueur(joueur) {
    if (classement.has(joueur.id)) return;
    joueurs.push(joueur);
    classement.set(joueur.id, 0);
  }

  // Ajuste manuellement les points d'une équipe (points d'ambiance de
  // l'animateur). On ne descend jamais sous zéro.
  function ajusterPoints(joueurId, delta) {
    if (!classement.has(joueurId)) return;
    classement.set(joueurId, Math.max(0, classement.get(joueurId) + delta));
  }

  function getClassement() {
    return joueurs
      .map((j) => ({ id: j.id, nom: j.nom, points: classement.get(j.id) }))
      .sort((a, b) => b.points - a.points);
  }

  function getEtat() {
    return etat;
  }

  function getJoueurQuiRepond() {
    return joueurQuiRepond;
  }

  return {
    demarrerQuestion,
    enregistrerBuzz,
    validerReponse,
    annulerElimination,
    passerQuestion,
    ajouterJoueur,
    ajusterPoints,
    getClassement,
    getEtat,
    getJoueurQuiRepond,
  };
}

module.exports = { creerJeu };
