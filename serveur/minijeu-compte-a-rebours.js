// "Compte à rebours invisible" : l'écran ne montre aucun chrono, il faut
// buzzer le plus près possible d'une durée cible annoncée à l'oral par
// l'animateur (ex: "buzzez à 10 secondes").
const CIBLE_MS = 10000;
const TOLERANCE_MS = 4000; // écart au-delà duquel la précision tombe à 0

function creerMiniJeuCompteARebours(equipes) {
  const debut = Date.now();
  const resultats = new Map(); // equipeId -> { precision, ecartMs }

  function enregistrerBuzz(equipeId) {
    if (resultats.has(equipeId)) return null;

    const tEcoulee = Date.now() - debut;
    const ecartMs = Math.abs(tEcoulee - CIBLE_MS);
    const precision = Math.max(0, 1 - ecartMs / TOLERANCE_MS);

    resultats.set(equipeId, { precision, ecartMs });
    return { precision, ecartMs, complet: resultats.size >= equipes.length };
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
    getParamsAffichage: () => ({ cible: CIBLE_MS }),
  };
}

module.exports = { creerMiniJeuCompteARebours };
