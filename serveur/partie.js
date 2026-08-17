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
  let photoEnAttente = null; // vignette (data-URL) de l'équipe en attente, ou null

  function demarrer() {
    equipes = [];
    portsDejaAssocies = new Set();
    nomEnAttente = null;
    photoEnAttente = null;
    etat = 'association';
  }

  // Prépare la prochaine équipe (nom + photo facultative) : le prochain buzzer
  // appuyé lui sera affecté.
  function preparerEquipe(nom, photo) {
    if (etat !== 'association') return null;
    nomEnAttente = nom;
    photoEnAttente = photo || null;
    return { nom, photo: photoEnAttente };
  }

  // Nom de l'équipe qui attend son buzzer (null si aucune n'est préparée).
  function getEquipeEnAttente() {
    return nomEnAttente;
  }

  function getPhotoEnAttente() {
    return photoEnAttente;
  }

  // Associe le port à l'équipe en attente. Renvoie l'équipe créée, ou null
  // (hors association, aucune équipe préparée, ou port déjà pris).
  function tenterAssociation(port) {
    if (etat !== 'association') return null;
    if (!nomEnAttente) return null;
    if (portsDejaAssocies.has(port)) return null;

    const id = equipes.length + 1;
    const nom = nomEnAttente;
    const photo = photoEnAttente;
    equipes.push({ id, nom, port, photo });
    portsDejaAssocies.add(port);
    nomEnAttente = null;
    photoEnAttente = null;

    return { id, nom, photo };
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
    getPhotoEnAttente,
  };
}

module.exports = { creerPartie };
