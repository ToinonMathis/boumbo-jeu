<script setup>
const props = defineProps({
  classement: { type: Array, required: true }, // [{id, nom, points, photo}], déjà trié par points desc
  longueur: { type: Number, required: true },
});

function pourcentage(points) {
  return Math.min(100, (points / props.longueur) * 100);
}
</script>

<template>
  <div class="chemin">
    <p class="titre">🌌 Chemin des étoiles</p>
    <div v-for="e in classement" :key="e.id" class="ligne-equipe">
      <span class="nom-equipe">
        <img v-if="e.photo" :src="e.photo" class="avatar-mini" alt="" />
        {{ e.nom }}
      </span>
      <div class="piste">
        <div class="piste-remplissage" :style="{ width: pourcentage(e.points) + '%' }"></div>
        <span class="pion" :style="{ left: pourcentage(e.points) + '%' }">⭐</span>
      </div>
    </div>
    <p class="objectif">Objectif : {{ longueur }} étoiles</p>
  </div>
</template>

<style scoped>
.chemin {
  position: relative;
  z-index: 1;
  width: min(720px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.titre {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(1.6rem, 3.5vw, 2.4rem);
  color: var(--gold);
  text-align: center;
  margin-bottom: 0.5rem;
}
.ligne-equipe {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.nom-equipe {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 140px;
  flex-shrink: 0;
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.avatar-mini {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.piste {
  position: relative;
  flex: 1;
  height: 16px;
  background: var(--night-2);
  border: 1.5px solid var(--cream-faint);
  border-radius: 999px;
}
.piste-remplissage {
  height: 100%;
  background: linear-gradient(90deg, var(--teal), var(--gold));
  border-radius: 999px;
  transition: width 0.6s ease;
}
.pion {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.4rem;
  transition: left 0.6s ease;
}
.objectif {
  text-align: center;
  color: var(--cream-dim);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
</style>
