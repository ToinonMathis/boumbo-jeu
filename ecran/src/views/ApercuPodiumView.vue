<script setup>
import { ref } from 'vue';
import Podium from '../components/Podium.vue';
import { initialiserAudio, jouerSonReveal, jouerSonVictoire } from '../sons';
import { genererCartePodium } from '../carte-podium';

// Page d'aperçu du podium, sans buzzer ni serveur de jeu : elle rend le
// composant Podium avec un classement bidon. Sert à voir/valider l'écran de
// fin de partie et son animation sans avoir à brancher de matériel.
const classementDemo = [
  { id: 1, nom: 'Les Tigres', points: 9 },
  { id: 2, nom: 'Quiz Khalifa', points: 7 },
  { id: 3, nom: 'Les Bacchantes', points: 6 },
  { id: 4, nom: 'Team Rocket', points: 4 },
  { id: 5, nom: 'Les Zéros Pointés', points: 2 },
];

// `demarre` déclenche le rendu (et donc l'animation) ; le premier clic sert
// aussi de geste utilisateur pour débloquer l'audio du navigateur. `cle` force
// le remontage du composant pour rejouer l'animation depuis le début.
const demarre = ref(false);
const cle = ref(0);

function lancer() {
  initialiserAudio();
  demarre.value = true;
  cle.value += 1;
}

function onReveal({ gagnant }) {
  if (gagnant) jouerSonVictoire();
  else jouerSonReveal();
}

// Génère la carte de podium partageable et la télécharge (aperçu sans photos).
async function apercuCarte() {
  const blob = await genererCartePodium(classementDemo, {
    titreQuiz: 'Cinéma — Grand public',
    nomEtablissement: 'Le Comptoir des Copains',
  });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = 'apercu-podium-boumbo.png';
  lien.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <main class="apercu">
    <div class="lueur" aria-hidden="true"></div>

    <div v-if="!demarre" class="intro">
      <p class="fin-titre">Aperçu du podium</p>
      <p class="note">Données de démonstration — aucun buzzer requis.</p>
      <button class="btn" @click="lancer">▶ Lancer l'aperçu</button>
    </div>

    <div v-else class="podium-ecran">
      <p class="fin-titre">Résultats de la partie</p>
      <Podium :key="cle" :classement="classementDemo" @reveal="onReveal" />
      <button class="btn" @click="apercuCarte">📤 Générer la carte partageable</button>
      <button class="btn btn--rejouer" @click="lancer">↻ Rejouer l'animation</button>
    </div>
  </main>
</template>

<style scoped>
.apercu {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}
.lueur {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(1100px 700px at 78% -5%, rgba(240, 57, 43, 0.22), transparent 60%),
    radial-gradient(900px 700px at 0% 30%, rgba(246, 178, 60, 0.14), transparent 55%);
}
.intro,
.podium-ecran {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
}
.fin-titre {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(1.6rem, 3.5vw, 2.6rem);
  color: var(--gold);
  text-align: center;
}
.note {
  color: var(--cream-dim);
}
.btn {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.9rem 1.8rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: var(--gold);
  color: #3a1408;
}
.btn--rejouer {
  background: transparent;
  color: var(--cream);
  border: 1.5px solid var(--cream-faint);
}
</style>
