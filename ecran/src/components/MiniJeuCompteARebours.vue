<script setup>
defineProps({
  params: { type: Object, required: true }, // { cible }
  equipesBuzzees: { type: Array, default: () => [] }, // [{ nom, ecartMs }]
});
</script>

<template>
  <div class="minijeu-compte">
    <p class="titre">Compte à rebours invisible</p>
    <p class="consigne">Buzzez le plus près possible de {{ params.cible / 1000 }} secondes</p>
    <div class="ecran-noir" aria-hidden="true"></div>
    <ul v-if="equipesBuzzees.length" class="liste-buzz">
      <li v-for="e in equipesBuzzees" :key="e.nom">{{ e.nom }} ✓</li>
    </ul>
  </div>
</template>

<style scoped>
.minijeu-compte {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1.5rem;
  text-align: center;
}
.titre {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  color: var(--gold);
}
.consigne {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1.3rem;
  color: var(--cream-dim);
}
.ecran-noir {
  width: min(320px, 60vw);
  height: 120px;
  background: #000;
  border-radius: 20px;
  border: 2px solid var(--cream-faint);
}
.liste-buzz {
  list-style: none;
  padding: 0;
  color: var(--teal);
  font-size: 1.1rem;
}
</style>
