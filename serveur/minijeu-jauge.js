// Mini-jeu "Jauge de précision" : un curseur oscille sur une jauge (aller-retour
// triangulaire), zone rouge au centre. Pas de course : chaque équipe buzz
// quand elle veut pendant que la manche reste ouverte, et est jugée sur sa
// propre précision à l'instant exact de son appui — ça marche pareil à 2
// équipes ou à 15, personne n'attend son tour et personne n'est exclu.
//
// `dureeMs` paramétrable : "Le funambule" (minijeu-funambule.js) réutilise
// exactement cette mécanique avec une oscillation plus rapide, seul l'habillage
// visuel change côté écran.
const DUREE_PAR_DEFAUT_MS = 2600;

// Position du curseur à l'instant t (ms écoulées) : 0 et 1 aux extrémités,
// oscillation triangulaire continue.
function positionCurseur(tEcouleeMs, dureeMs) {
  const phase = (tEcouleeMs % dureeMs) / dureeMs;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

// 1 = position parfaite (centre, 0.5), 0 = aux extrémités.
function precisionDepuisPosition(position) {
  return 1 - Math.abs(position - 0.5) * 2;
}

function creerMiniJeuJauge(equipes, dureeMs = DUREE_PAR_DEFAUT_MS) {
  const debut = Date.now();
  const resultats = new Map(); // equipeId -> { position, precision }

  // Renvoie le résultat de ce buzz, ou null si cette équipe a déjà tenté sa chance.
  function enregistrerBuzz(equipeId) {
    if (resultats.has(equipeId)) return null;

    const position = positionCurseur(Date.now() - debut, dureeMs);
    const precision = precisionDepuisPosition(position);
    resultats.set(equipeId, { position, precision });

    return { position, precision, complet: resultats.size >= equipes.length };
  }

  function getClassement() {
    return [...resultats.entries()]
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => b.precision - a.precision);
  }

  return {
    enregistrerBuzz,
    getClassement,
    aBuzze: (equipeId) => resultats.has(equipeId),
    getParamsAffichage: () => ({ duree: dureeMs }),
  };
}

module.exports = { creerMiniJeuJauge };
