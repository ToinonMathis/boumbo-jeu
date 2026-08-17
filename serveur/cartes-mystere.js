// Cartes mystère du "Chemin des étoiles" : tirées quand une équipe franchit
// une case spéciale du chemin. Les malus ciblent l'équipe en tête (jamais
// l'équipe qui vient de tirer) pour rééquilibrer la partie quand certains
// répondent trop bien ; les bonus profitent à l'équipe qui a tiré la carte.
const CARTES = [
  { cle: 'baillon', categorie: 'malus', libelle: 'Bâillon', description: 'ne peut pas buzzer la prochaine question' },
  {
    cle: 'silence-radio',
    categorie: 'malus',
    libelle: 'Silence radio',
    description: "un membre au choix de l'équipe doit se taire ce tour (à l'animateur de l'appliquer)",
  },
  { cle: 'recul', categorie: 'malus', libelle: 'Recul', description: 'recule de 3 étoiles' },
  { cle: 'double-avance', categorie: 'bonus', libelle: 'Double avance', description: 'sa prochaine bonne réponse vaut double' },
  { cle: 'joker', categorie: 'bonus', libelle: 'Joker', description: "ne sera pas éliminée si elle se trompe la prochaine fois" },
  {
    cle: 'vol-etoiles',
    categorie: 'bonus',
    libelle: "Vol d'étoiles",
    description: "sa prochaine bonne réponse vole des étoiles à l'équipe en tête au lieu d'avancer normalement",
  },
  {
    cle: 'teleportation',
    categorie: 'bonus',
    libelle: 'Téléportation',
    description: "échange immédiatement sa position avec l'équipe juste devant elle",
  },
];

const CASES_ETOILES_VOLEES = 3;
const CASES_RECUL = 3;

function tirerCarte() {
  return CARTES[Math.floor(Math.random() * CARTES.length)];
}

module.exports = { CARTES, tirerCarte, CASES_ETOILES_VOLEES, CASES_RECUL };
