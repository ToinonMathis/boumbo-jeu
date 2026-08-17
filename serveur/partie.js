// Cycle de vie d'une partie, avant même que jeu.js n'entre en scène :
// l'animateur ajoute les équipes une par une, sans fixer leur nombre à
// l'avance. Pour chaque équipe : il donne un nom (préparerEquipe), puis
// l'équipe appuie sur son buzzer pour être associée. Il ajoute autant
// d'équipes qu'il veut, puis lance le jeu quand il est prêt (lancer).
function creerPartie() {
  let etat = 'accueil'; // 'accueil' | 'association' | 'prete'
  let equipes = [];
  let portsDejaAssocies = new Set();
  let nomEnAttente = null; // nom de l'équipe en cours d'association (buzzer attendu)

  function demarrer() {
    equipes = [];
    portsDejaAssocies = new Set();
    nomEnAttente = null;
    etat = 'association';
  }

  // Prépare la prochaine équipe : le prochain buzzer appuyé lui sera affecté.
  function preparerEquipe(nom) {
    if (etat !== 'association') return null;
    nomEnAttente = nom;
    return { nom };
  }

  // Nom de l'équipe qui attend son buzzer (null si aucune n'est préparée).
  function getEquipeEnAttente() {
    return nomEnAttente;
  }

  // Associe le port à l'équipe en attente. Renvoie l'équipe créée, ou null
  // (hors association, aucune équipe préparée, ou port déjà pris).
  function tenterAssociation(port) {
    if (etat !== 'association') return null;
    if (!nomEnAttente) return null;
    if (portsDejaAssocies.has(port)) return null;

    const id = equipes.length + 1;
    const nom = nomEnAttente;
    equipes.push({ id, nom, port });
    portsDejaAssocies.add(port);
    nomEnAttente = null;

    return { id, nom };
  }

  // Passe en jeu (au moins une équipe requise).
  function lancer() {
    if (etat !== 'association' || equipes.length < 1) return false;
    etat = 'prete';
    return true;
  }

  return {
    demarrer,
    preparerEquipe,
    tenterAssociation,
    lancer,
    getEtat: () => etat,
    getEquipes: () => equipes,
    getEquipeEnAttente,
  };
}

module.exports = { creerPartie };
