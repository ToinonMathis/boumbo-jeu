<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// Podium de fin de partie, réutilisable par n'importe quel mode de jeu : il ne
// connaît que le classement final. Il dévoile les rangs un par un, du dernier
// jusqu'au grand gagnant (top 3 sur l'estrade). Passer `anime: false` révèle
// tout d'un coup (utile sur la télécommande, où la mise en scène n'a pas lieu).
const props = defineProps({
  classement: { type: Array, required: true }, // [{ id, nom, points }]
  titre: { type: String, default: null },
  anime: { type: Boolean, default: true },
});

// Émis à chaque rang dévoilé (le parent gère les sons) et une fois le podium
// entièrement révélé.
const emit = defineEmits(['reveal', 'fini']);

const DELAI_ENTRE_RANGS = 1500;
const DELAI_AVANT_DEBUT = 800;

// Tri défensif : on ne dépend pas de l'ordre fourni.
const classementTrie = computed(() =>
  [...props.classement].sort((a, b) => b.points - a.points),
);
const total = computed(() => classementTrie.value.length);

const top3 = computed(() => classementTrie.value.slice(0, 3));
const reste = computed(() => classementTrie.value.slice(3));

// Nombre de rangs dévoilés en partant du dernier. Un rang d'index absolu
// `indexAbsolu` (0 = premier) est révélé dès que le compteur a atteint le bas
// du classement et remonté jusqu'à lui.
const rangsReveles = ref(0);
function estRevele(indexAbsolu) {
  return indexAbsolu >= total.value - rangsReveles.value;
}

let minuteur;
function revelerSuivant() {
  rangsReveles.value += 1;
  const indexRevele = total.value - rangsReveles.value;
  emit('reveal', {
    equipe: classementTrie.value[indexRevele],
    rang: indexRevele + 1,
    gagnant: indexRevele === 0,
  });

  if (rangsReveles.value < total.value) {
    minuteur = setTimeout(revelerSuivant, DELAI_ENTRE_RANGS);
  } else {
    emit('fini');
  }
}

onMounted(() => {
  if (!props.anime || total.value === 0) {
    rangsReveles.value = total.value;
    return;
  }
  minuteur = setTimeout(revelerSuivant, DELAI_AVANT_DEBUT);
});

onUnmounted(() => clearTimeout(minuteur));
</script>

<template>
  <div class="podium-vue">
    <h2 v-if="titre" class="titre">{{ titre }}</h2>

    <!-- Rangs 4 et suivants : affichés du 4e (en haut) au dernier (en bas),
         dévoilés du bas vers le haut. -->
    <ul v-if="reste.length" class="reste">
      <li
        v-for="(equipe, i) in reste"
        :key="equipe.id"
        class="ligne"
        :class="{ revele: estRevele(i + 3) }"
      >
        <span class="rang">{{ i + 4 }}</span>
        <span class="nom">{{ equipe.nom }}</span>
        <span class="pts">{{ equipe.points }}</span>
      </li>
    </ul>

    <!-- Estrade : 2e à gauche, 1er au centre, 3e à droite. -->
    <div class="estrade">
      <div v-if="top3[1]" class="marche marche--argent" :class="{ revele: estRevele(1) }">
        <div class="occupant">
          <span class="medaille">🥈</span>
          <span class="nom">{{ top3[1].nom }}</span>
          <span class="pts">{{ top3[1].points }} pt</span>
        </div>
        <div class="socle"><span class="place">2</span></div>
      </div>

      <div
        v-if="top3[0]"
        class="marche marche--or"
        :class="{ revele: estRevele(0), champion: estRevele(0) }"
      >
        <div class="occupant">
          <span class="couronne">👑</span>
          <span class="medaille">🥇</span>
          <span class="nom">{{ top3[0].nom }}</span>
          <span class="pts">{{ top3[0].points }} pt</span>
        </div>
        <div class="socle"><span class="place">1</span></div>
      </div>

      <div v-if="top3[2]" class="marche marche--bronze" :class="{ revele: estRevele(2) }">
        <div class="occupant">
          <span class="medaille">🥉</span>
          <span class="nom">{{ top3[2].nom }}</span>
          <span class="pts">{{ top3[2].points }} pt</span>
        </div>
        <div class="socle"><span class="place">3</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.podium-vue {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1rem;
}
.titre {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(1.2rem, 2.4vw, 1.8rem);
  color: var(--cream-dim);
  text-align: center;
}

/* Rangs 4+ */
.reste {
  list-style: none;
  padding: 0;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.ligne {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.45rem 0.9rem;
  border-radius: 12px;
  background: var(--night-2);
  border: 1px solid var(--cream-faint);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.45s ease, transform 0.45s ease;
}
.ligne.revele {
  opacity: 1;
  transform: translateY(0);
}
.ligne .rang {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  color: var(--cream-dim);
  min-width: 1.5rem;
}
.ligne .nom {
  flex: 1;
  font-weight: 600;
}
.ligne .pts {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  color: var(--gold);
}

/* Estrade top 3 */
.estrade {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
}
.marche {
  flex: 1;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.occupant {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  margin-bottom: 0.6rem;
  opacity: 0;
  transform: translateY(24px) scale(0.9);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.marche.revele .occupant {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.occupant .medaille {
  font-size: 2rem;
}
.occupant .couronne {
  font-size: 1.6rem;
  animation: flotte 1.4s ease-in-out infinite alternate;
}
.occupant .nom {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(1rem, 2vw, 1.4rem);
  text-align: center;
}
.occupant .pts {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  color: var(--gold);
}
.socle {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.5rem;
  border-radius: 12px 12px 0 0;
  color: var(--night);
}
.socle .place {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 2rem;
}
.marche--or .socle {
  height: 160px;
  background: linear-gradient(180deg, var(--gold), #d9922a);
}
.marche--argent .socle {
  height: 115px;
  background: linear-gradient(180deg, #d8dde6, #9aa3b2);
}
.marche--bronze .socle {
  height: 85px;
  background: linear-gradient(180deg, #d79a63, #a9713f);
}
.marche--or.champion .socle {
  box-shadow: 0 0 40px rgba(246, 178, 60, 0.6);
}

@keyframes flotte {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-6px);
  }
}
</style>
