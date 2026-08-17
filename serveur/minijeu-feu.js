// "Feu vert / feu rouge" : un délai aléatoire s'écoule avant le passage au
// vert. Buzzer avant = faux départ (précision nulle, pas de pénalité en
// dessous). Buzzer après = noté sur la rapidité de réaction.
const DELAI_MIN_MS = 2000;
const DELAI_MAX_MS = 6000;
const FENETRE_REACTION_MS = 1200; // au-delà, la précision retombe à 0

function creerMiniJeuFeu(equipes) {
  const debut = Date.now();
  const delaiVert = DELAI_MIN_MS + Math.random() * (DELAI_MAX_MS - DELAI_MIN_MS);
  const resultats = new Map(); // equipeId -> { precision, fauxDepart }

  function enregistrerBuzz(equipeId) {
    if (resultats.has(equipeId)) return null;

    const tEcoulee = Date.now() - debut;
    let precision;
    let fauxDepart = false;

    if (tEcoulee < delaiVert) {
      precision = 0;
      fauxDepart = true;
    } else {
      const reaction = tEcoulee - delaiVert;
      precision = Math.max(0, 1 - reaction / FENETRE_REACTION_MS);
    }

    resultats.set(equipeId, { precision, fauxDepart });
    return { precision, fauxDepart, complet: resultats.size >= equipes.length };
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
    getParamsAffichage: () => ({ delaiVert }),
  };
}

module.exports = { creerMiniJeuFeu };
