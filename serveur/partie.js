// Cycle de vie d'une partie, avant même que jeu.js n'entre en scène :
// combien d'équipes, et quel port série appartient à quelle équipe.
// Association par appui : le premier port qui buzze pendant la phase
// d'association est affecté à l'équipe en attente.
function creerPartie() {
  let etat = 'accueil'; // 'accueil' | 'association' | 'prete'
  let nombreEquipes = 0;
  let equipes = [];
  let portsDejaAssocies = new Set();

  function demarrer(n) {
    nombreEquipes = n;
    equipes = [];
    portsDejaAssocies = new Set();
    etat = 'association';
  }

  function getEquipeEnAttente() {
    return equipes.length + 1;
  }

  // Renvoie l'équipe nouvellement associée si ce port n'était pas déjà pris,
  // sinon null (port déjà associé, ou pas en phase d'association).
  function tenterAssociation(port) {
    if (etat !== 'association') return null;
    if (portsDejaAssocies.has(port)) return null;

    const id = equipes.length + 1;
    const nom = `Équipe ${id}`;
    equipes.push({ id, nom, port });
    portsDejaAssocies.add(port);

    if (equipes.length >= nombreEquipes) {
      etat = 'prete';
    }

    return { id, nom, complet: etat === 'prete' };
  }

  return {
    demarrer,
    tenterAssociation,
    getEtat: () => etat,
    getEquipes: () => equipes,
    getEquipeEnAttente,
  };
}

module.exports = { creerPartie };
