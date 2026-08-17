// "Le Funambule" : même mécanique que la jauge de précision, mais avec une
// oscillation plus rapide et nerveuse — habillage "équilibre qui vacille"
// côté écran (composant MiniJeuJauge.vue réutilisé avec un titre différent).
const { creerMiniJeuJauge } = require('./minijeu-jauge');

const DUREE_MS = 1400;

function creerMiniJeuFunambule(equipes) {
  return creerMiniJeuJauge(equipes, DUREE_MS);
}

module.exports = { creerMiniJeuFunambule };
