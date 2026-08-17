<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  params: { type: Object, required: true }, // { delaiVert }
  equipesBuzzees: { type: Array, default: () => [] }, // [{ nom, fauxDepart }]
});

const auVert = ref(false);
let debut;
let timeout;

onMounted(() => {
  debut = Date.now();
  timeout = setTimeout(() => {
    auVert.value = true;
  }, props.params.delaiVert);
});

onUnmounted(() => clearTimeout(timeout));
</script>

<template>
  <div class="minijeu-feu">
    <p class="titre">Feu vert, feu rouge !</p>
    <div class="feu" :class="{ vert: auVert }"></div>
    <p class="sous-titre">
      {{ auVert ? 'Buzzez !' : 'Attendez le vert...' }}
    </p>
    <ul v-if="equipesBuzzees.length" class="liste-buzz">
      <li v-for="e in equipesBuzzees" :key="e.nom" :class="{ 'faux-depart': e.fauxDepart }">
        {{ e.nom }} {{ e.fauxDepart ? '— faux départ !' : '✓' }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.minijeu-feu {
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
.feu {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 30%, var(--red-hi), var(--red) 46%, var(--red-lo) 100%);
  box-shadow: 0 0 60px rgba(240, 57, 43, 0.5);
  transition: background 0.15s ease, box-shadow 0.15s ease;
}
.feu.vert {
  background: radial-gradient(circle at 38% 30%, #6ee7b0, var(--teal) 46%, #0a2a2c 100%);
  box-shadow: 0 0 80px rgba(53, 194, 201, 0.7);
}
.sous-titre {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1.4rem;
  color: var(--cream-dim);
}
.liste-buzz {
  list-style: none;
  padding: 0;
  color: var(--teal);
  font-size: 1.1rem;
  text-align: center;
}
.liste-buzz .faux-depart {
  color: var(--red-hi);
}
</style>
