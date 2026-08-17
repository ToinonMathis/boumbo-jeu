<script setup>
import { ref, onMounted } from 'vue';
import QRCode from 'qrcode';
import { useJeu } from '../composables/useJeu';
import Podium from '../components/Podium.vue';
import { jouerSonReveal, jouerSonVictoire } from '../sons';

const {
  phase,
  equipeEnAttente,
  photoEnAttente,
  equipesAssociees,
  etat,
  message,
  questionActuelle,
  gagnant,
  classement,
  titreQuiz,
} = useJeu({ jouerSons: true });

function onRevealPodium({ gagnant: estGagnant }) {
  if (estGagnant) jouerSonVictoire();
  else jouerSonReveal();
}

// TODO(temporaire) : visible par tout le monde y compris les joueurs, donc
// n'importe qui pourrait scanner et prendre la main sur la télécommande
// avant l'animateur. À remplacer plus tard par un canal privé à l'animateur
// (ex : affiché uniquement dans le terminal du serveur).
const URL_SERVEUR = import.meta.env.VITE_SERVEUR_URL || `http://${window.location.hostname}:3001`;
const qrCodeAnimateur = ref('');

onMounted(async () => {
  // L'écran ne peut pas déduire l'adresse réseau depuis lui-même s'il a été
  // ouvert via localhost — on demande au serveur, qui la connaît de façon fiable.
  const reponse = await fetch(`${URL_SERVEUR}/api/config`);
  const { urlAnimateur } = await reponse.json();
  if (!urlAnimateur) return;

  qrCodeAnimateur.value = await QRCode.toDataURL(urlAnimateur, {
    width: 200,
    margin: 1,
    color: { dark: '#23122b', light: '#f7eee3' },
  });
});
</script>

<template>
  <main class="ecran">
    <div class="lueur" aria-hidden="true"></div>

    <div v-if="phase === 'accueil'" class="accueil">
      <span class="marque">b<span class="dome"></span>umb<span class="dome"></span></span>
      <p class="message">En attente du lancement d'une partie...</p>
      <div v-if="qrCodeAnimateur" class="carte-qr">
        <img :src="qrCodeAnimateur" alt="QR code vers la télécommande animateur" />
        <p>Scanne pour piloter le jeu</p>
      </div>
    </div>

    <div v-else-if="phase === 'association'" class="association">
      <span class="marque marque--petite">b<span class="dome"></span>umb<span class="dome"></span></span>
      <div v-for="e in equipesAssociees" :key="e.nom" class="equipe-ok">
        <img v-if="e.photo" :src="e.photo" class="avatar" alt="" />
        <span>✓ {{ e.nom }}</span>
      </div>
      <div v-if="equipeEnAttente" class="attente-tv">
        <img v-if="photoEnAttente" :src="photoEnAttente" class="avatar avatar--gros" alt="" />
        <p class="message message--ouverte">{{ equipeEnAttente }} : appuie sur ton buzzer</p>
      </div>
      <p v-else class="message">En attente des équipes…</p>
    </div>

    <div v-else-if="phase === 'podium'" class="podium-ecran">
      <p class="fin-titre">Résultats de la partie</p>
      <Podium :classement="classement" :titre="titreQuiz" @reveal="onRevealPodium" />
    </div>

    <template v-else>
      <div v-if="etat === 'deconnecte'" class="message">Connexion au serveur perdue...</div>
      <div v-else-if="etat === 'fermee'" class="message">{{ message }}</div>
      <div v-else-if="etat === 'attente_buzz' || etat === 'en_reponse'" class="question-en-cours">
        <p class="question-texte">{{ questionActuelle }}</p>
        <p class="message" :class="etat === 'attente_buzz' ? 'message--ouverte' : 'message--reponse'">
          {{ message }}
        </p>
      </div>
      <div v-else-if="etat === 'resultat'" class="resultat">
        <p class="gagnant">{{ gagnant }} !</p>
        <ul class="classement">
          <li v-for="j in classement" :key="j.id">
            <span class="nom-avec-avatar">
              <img v-if="j.photo" :src="j.photo" class="avatar avatar--petit" alt="" />
              {{ j.nom }}
            </span>
            <span>{{ j.points }}</span>
          </li>
        </ul>
      </div>
    </template>
  </main>
</template>

<style scoped>
.ecran {
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

.marque {
  position: relative;
  z-index: 1;
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 3rem;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 2px;
}
.marque--petite {
  font-size: 2rem;
  margin-bottom: 1.5rem;
}
.marque .dome {
  display: inline-block;
  width: 0.62em;
  height: 0.62em;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--red-hi), var(--red) 55%, var(--red-lo));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35), inset 0 -2px 4px rgba(0, 0, 0, 0.3);
  transform: translateY(0.06em);
}

.accueil {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
}
.carte-qr {
  background: var(--cream);
  border-radius: 20px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}
.carte-qr img {
  display: block;
  width: 180px;
  height: 180px;
}
.carte-qr p {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1rem;
  color: var(--night);
}

.association {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.equipe-ok {
  font-size: 1.4rem;
  color: var(--teal);
  margin-bottom: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--cream-faint);
  vertical-align: middle;
}
.avatar--gros {
  width: 120px;
  height: 120px;
}
.avatar--petit {
  width: 34px;
  height: 34px;
}
.attente-tv {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.nom-avec-avatar {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.question-en-cours {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 0 2rem;
  text-align: center;
}
.question-texte {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: clamp(1.6rem, 3.2vw, 2.4rem);
  max-width: 46ch;
}
.message {
  position: relative;
  z-index: 1;
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 3rem;
  text-align: center;
  padding: 0 2rem;
}
.message--ouverte {
  color: var(--gold);
  animation: pulse 1s infinite alternate;
}
.message--reponse {
  color: var(--teal);
}
@keyframes pulse {
  from {
    opacity: 0.6;
  }
  to {
    opacity: 1;
  }
}
.podium-ecran {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}
.fin-titre {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(1.6rem, 3.5vw, 2.6rem);
  color: var(--gold);
  text-align: center;
}
.resultat {
  position: relative;
  z-index: 1;
  text-align: center;
}
.gagnant {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 4rem;
  color: var(--gold);
  margin-bottom: 2rem;
}
.classement {
  list-style: none;
  padding: 0;
  font-size: 1.5rem;
  min-width: 320px;
}
.classement li {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--cream-faint);
}
</style>
