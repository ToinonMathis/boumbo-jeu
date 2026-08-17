<script setup>
import { ref, onMounted, watch } from 'vue';
import QRCode from 'qrcode';
import { useJeu } from '../composables/useJeu';
import Podium from '../components/Podium.vue';
import MiniJeuJauge from '../components/MiniJeuJauge.vue';
import MiniJeuFeu from '../components/MiniJeuFeu.vue';
import MiniJeuCompteARebours from '../components/MiniJeuCompteARebours.vue';
import CheminEtoiles from '../components/CheminEtoiles.vue';

const TITRES_MINIJEUX = {
  jauge: 'Buzz au centre !',
  funambule: 'Le Funambule — reste au centre !',
};
import { jouerSonReveal, jouerSonVictoire, jouerSonDemarrage } from '../sons';

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
  mode,
  longueurChemin,
  joueurQuiRepond,
  photoQuiRepond,
  buzzCompteur,
  miniJeuActif,
  carteMystere,
  confirmerCarteMystereVue,
} = useJeu({ jouerSons: true });

// L'écran TV est passif : pas de bouton pour fermer l'annonce, elle se
// referme donc toute seule après un court délai de lecture.
const DUREE_AFFICHAGE_CARTE_MS = 5000;
watch(carteMystere, (carte) => {
  if (!carte) return;
  setTimeout(confirmerCarteMystereVue, DUREE_AFFICHAGE_CARTE_MS);
});

function onRevealPodium({ gagnant: estGagnant }) {
  if (estGagnant) jouerSonVictoire();
  else jouerSonReveal();
}

// Petit jingle quand on sort de la veille pour lancer une partie.
watch(phase, (nouvelle, ancienne) => {
  if (ancienne === 'accueil' && nouvelle === 'association') jouerSonDemarrage();
});

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

    <div v-if="carteMystere" class="carte-mystere-overlay" :class="`carte-mystere-overlay--${carteMystere.categorie}`">
      <p class="carte-mystere-etiquette">Carte mystère</p>
      <p class="carte-mystere-libelle">{{ carteMystere.libelle }}</p>
      <p class="carte-mystere-description">{{ carteMystere.description }}</p>
      <p v-if="carteMystere.cible" class="carte-mystere-cible">
        {{ carteMystere.categorie === 'malus' ? '🎯' : '✨' }} {{ carteMystere.cible }}
      </p>
    </div>

    <div v-if="phase === 'accueil'" class="accueil">
      <div class="accueil-entete">
        <span class="marque marque--geante">b<span class="dome"></span>umb<span class="dome"></span></span>
        <p class="tagline">Le buzzer qui met l'ambiance</p>
      </div>

      <div class="buzzer-deco" aria-hidden="true">
        <div class="buzzer-glow"></div>
        <div class="buzzer"></div>
      </div>

      <div v-if="qrCodeAnimateur" class="carte-qr">
        <img :src="qrCodeAnimateur" alt="QR code vers la télécommande animateur" />
        <p>Scanne pour lancer une partie</p>
      </div>
      <p v-else class="message">Prêt à jouer…</p>
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
      <template v-if="miniJeuActif">
        <MiniJeuFeu
          v-if="miniJeuActif.type === 'feu'"
          :params="miniJeuActif.params"
          :equipes-buzzees="miniJeuActif.equipesBuzzees"
        />
        <MiniJeuCompteARebours
          v-else-if="miniJeuActif.type === 'compte-a-rebours'"
          :params="miniJeuActif.params"
          :equipes-buzzees="miniJeuActif.equipesBuzzees"
        />
        <MiniJeuJauge
          v-else
          :params="miniJeuActif.params"
          :equipes-buzzees="miniJeuActif.equipesBuzzees"
          :titre="TITRES_MINIJEUX[miniJeuActif.type] || TITRES_MINIJEUX.jauge"
        />
      </template>
      <div v-else-if="etat === 'deconnecte'" class="message">Connexion au serveur perdue...</div>
      <template v-else-if="etat === 'fermee' || etat === 'attente_buzz'">
        <div v-if="etat === 'fermee' && equipeEnAttente" class="message message--ouverte">
          {{ equipeEnAttente }} : appuie sur ton buzzer pour rejoindre
        </div>
        <div v-else-if="etat === 'fermee'" class="message">{{ message }}</div>
        <div v-else class="question-en-cours">
          <p v-if="questionActuelle" class="question-texte">{{ questionActuelle }}</p>
          <p class="message message--ouverte">{{ message }}</p>
        </div>
        <CheminEtoiles v-if="mode === 'chemin'" :classement="classement" :longueur="longueurChemin" />
      </template>

      <div v-else-if="etat === 'en_reponse'" :key="buzzCompteur" class="buzz-spectacle">
        <div class="buzz-flash" aria-hidden="true"></div>
        <p class="buzz-mot">BUZZ&nbsp;!</p>
        <img v-if="photoQuiRepond" :src="photoQuiRepond" class="buzz-photo" alt="" />
        <p class="buzz-nom">{{ joueurQuiRepond }}</p>
        <p class="buzz-repond">répond…</p>
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
  gap: 1.5rem;
}
.accueil-entete {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.marque--geante {
  font-size: clamp(3rem, 8vw, 6rem);
}
.tagline {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: clamp(1rem, 2.4vw, 1.6rem);
  color: var(--gold);
}

/* Buzzer décoratif animé (comme la vitrine), pour donner vie à la veille. */
.buzzer-deco {
  position: relative;
  display: grid;
  place-items: center;
  width: 240px;
  height: 240px;
  animation: bob 3.2s ease-in-out infinite;
}
.buzzer-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(240, 57, 43, 0.5), rgba(246, 178, 60, 0.12) 45%, transparent 68%);
  filter: blur(6px);
  animation: pulse-glow 3.4s ease-in-out infinite;
}
.buzzer {
  position: relative;
  width: 190px;
  height: 190px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 30%, var(--red-hi), var(--red) 46%, var(--red-lo) 100%);
  box-shadow: 0 26px 50px -12px rgba(0, 0, 0, 0.6), 0 8px 0 0 #7c1712, 0 14px 0 0 #5c1310,
    inset 0 -10px 26px rgba(0, 0, 0, 0.35), inset 0 14px 30px rgba(255, 255, 255, 0.35);
}
.buzzer::after {
  content: '';
  position: absolute;
  top: 22px;
  left: 40px;
  width: 74px;
  height: 50px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.75), transparent 70%);
  filter: blur(2px);
}
@keyframes pulse-glow {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.55;
  }
  50% {
    transform: scale(1.06);
    opacity: 0.95;
  }
}
@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .buzzer-deco,
  .buzzer-glow {
    animation: none;
  }
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

/* Spectacle du buzz : quand une équipe claque son buzzer. */
.buzz-spectacle {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}
.buzz-flash {
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, rgba(246, 178, 60, 0.55), rgba(240, 57, 43, 0.25) 40%, transparent 70%);
  animation: buzz-flash 0.5s ease-out forwards;
}
@keyframes buzz-flash {
  0% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
  }
}
.buzz-mot {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(3rem, 10vw, 7rem);
  color: var(--gold);
  text-shadow: 0 4px 0 var(--red-lo), 0 0 40px rgba(246, 178, 60, 0.6);
  animation: buzz-pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
@keyframes buzz-pop {
  0% {
    transform: scale(0.3) rotate(-6deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.15) rotate(3deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0);
  }
}
.buzz-photo {
  width: clamp(120px, 22vw, 220px);
  height: clamp(120px, 22vw, 220px);
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--gold);
  box-shadow: 0 0 50px rgba(246, 178, 60, 0.5);
  animation: buzz-photo-in 0.5s ease-out both;
}
@keyframes buzz-photo-in {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.buzz-nom {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(2rem, 5vw, 3.5rem);
  color: var(--cream);
}
.buzz-repond {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: clamp(1.2rem, 2.5vw, 1.8rem);
  color: var(--teal);
  animation: pulse 1s infinite alternate;
}
@media (prefers-reduced-motion: reduce) {
  .buzz-flash,
  .buzz-mot,
  .buzz-photo {
    animation: none;
  }
  .buzz-flash {
    opacity: 0;
  }
}
/* Annonce de carte mystère (chemin des étoiles) : plein écran, par-dessus
   n'importe quelle phase de jeu — se referme toute seule (TV passive). */
.carte-mystere-overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 2rem;
  text-align: center;
  background: radial-gradient(1200px 800px at 50% 40%, rgba(35, 18, 43, 0.97), rgba(10, 6, 18, 0.99));
  animation: carte-mystere-in 0.4s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.carte-mystere-overlay--malus {
  box-shadow: inset 0 0 200px rgba(240, 57, 43, 0.35);
}
.carte-mystere-overlay--bonus {
  box-shadow: inset 0 0 200px rgba(246, 178, 60, 0.3);
}
.carte-mystere-etiquette {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  font-size: clamp(0.9rem, 1.6vw, 1.1rem);
  color: var(--teal);
}
.carte-mystere-libelle {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: clamp(2.4rem, 6vw, 4.5rem);
  color: var(--gold);
  text-shadow: 0 0 40px rgba(246, 178, 60, 0.5);
}
.carte-mystere-overlay--malus .carte-mystere-libelle {
  color: var(--red-hi);
  text-shadow: 0 0 40px rgba(240, 57, 43, 0.5);
}
.carte-mystere-description {
  font-size: clamp(1.1rem, 2.2vw, 1.6rem);
  max-width: 50ch;
  color: var(--cream);
}
.carte-mystere-cible {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: clamp(1.3rem, 2.6vw, 1.9rem);
  color: var(--cream);
}
@keyframes carte-mystere-in {
  0% {
    transform: scale(0.85) rotate(-2deg);
    opacity: 0;
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .carte-mystere-overlay {
    animation: none;
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
