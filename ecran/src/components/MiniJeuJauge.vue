<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// Purement visuel : le curseur oscille selon sa propre horloge locale, à
// l'identique de ce que le serveur utilise pour juger chaque buzz. Un léger
// décalage de quelques dizaines de ms entre affichage et jugement serveur est
// imperceptible sur un jeu d'ambiance — inutile de synchroniser les horloges.
const props = defineProps({
  params: { type: Object, required: true }, // { duree }
  equipesBuzzees: { type: Array, default: () => [] }, // [{ nom, position }]
  titre: { type: String, default: 'Buzz au centre !' },
});

const position = ref(0);
let debut;
let animation;

function boucle() {
  const t = (Date.now() - debut) % props.params.duree;
  const phase = t / props.params.duree;
  position.value = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  animation = requestAnimationFrame(boucle);
}

onMounted(() => {
  debut = Date.now();
  boucle();
});

onUnmounted(() => cancelAnimationFrame(animation));
</script>

<template>
  <div class="minijeu-jauge">
    <p class="titre">{{ titre }}</p>
    <div class="jauge">
      <div class="zone-rouge"></div>
      <div class="curseur" :style="{ left: position * 100 + '%' }"></div>
      <div
        v-for="e in equipesBuzzees"
        :key="e.nom"
        class="marqueur"
        :style="{ left: (e.position ?? 0.5) * 100 + '%' }"
      >
        <span class="marqueur-trait"></span>
        <span class="marqueur-nom">{{ e.nom }}</span>
      </div>
    </div>
    <p class="sous-titre">{{ equipesBuzzees.length }} équipe(s) ont déjà tenté leur chance</p>
  </div>
</template>

<style scoped>
.minijeu-jauge {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1.5rem;
}
.titre {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  color: var(--gold);
}
.jauge {
  position: relative;
  width: min(720px, 88vw);
  height: 28px;
  background: var(--night-2);
  border: 2px solid var(--cream-faint);
  border-radius: 999px;
}
.zone-rouge {
  position: absolute;
  left: 42%;
  width: 16%;
  height: 100%;
  background: var(--red);
  opacity: 0.55;
  border-radius: 999px;
}
.curseur {
  position: absolute;
  top: -10px;
  width: 10px;
  height: 48px;
  background: var(--cream);
  border-radius: 5px;
  transform: translateX(-50%);
  box-shadow: 0 0 16px rgba(247, 238, 227, 0.7);
}
.marqueur {
  position: absolute;
  top: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateX(-50%);
}
.marqueur-trait {
  width: 3px;
  height: 14px;
  background: var(--teal);
  border-radius: 2px;
}
.marqueur-nom {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--teal);
  white-space: nowrap;
  margin-top: 0.2rem;
}
.sous-titre {
  color: var(--cream-dim);
  font-size: 1rem;
}
</style>
