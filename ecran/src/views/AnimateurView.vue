<script setup>
import { ref, onMounted } from 'vue';
import { useJeu } from '../composables/useJeu';
import Podium from '../components/Podium.vue';
import { reduireImage } from '../photo';
import { genererCartePodium } from '../carte-podium';

const MINIJEUX = [
  { type: 'jauge', label: 'Jauge de précision' },
  { type: 'funambule', label: 'Le Funambule' },
  { type: 'feu', label: 'Feu vert / feu rouge' },
  { type: 'compte-a-rebours', label: 'Compte à rebours invisible' },
];

const {
  phase,
  equipeEnAttente,
  photoEnAttente,
  equipesAssociees,
  etat,
  message,
  questionActuelle,
  reponseActuelle,
  titreQuiz,
  mode,
  prochaineQuestion,
  gagnant,
  classement,
  demarrerPartie,
  preparerEquipe,
  lancerJeu,
  arreterPartie,
  terminerPartie,
  ouvrirQuestion,
  validerReponse,
  passerQuestion,
  ajusterPoints,
  confirmerResultatVu,
  chargerQuizDisponibles,
  miniJeuActif,
  miniJeuResultat,
  lancerMiniJeu,
  terminerMiniJeu,
  confirmerMiniJeuVu,
  carteMystere,
  confirmerCarteMystereVue,
} = useJeu();

const nomNouvelleEquipe = ref('');
const photoNouvelleEquipe = ref(null);
const ajoutEquipeOuvert = ref(false); // formulaire d'ajout d'équipe en cours de partie
const choixMiniJeuOuvert = ref(false);
// Choix du mode de jeu, purement local à la télécommande : le serveur n'a pas
// besoin de le connaître tant qu'un seul mode est réellement jouable.
const modeChoisi = ref(null); // null | 'quiz' | 'chemin'

function onLancerMiniJeu(type) {
  choixMiniJeuOuvert.value = false;
  executer(() => lancerMiniJeu(type));
}
const partageEnCours = ref(false);
const quizDisponibles = ref([]);
const quizSelectionne = ref('');
const texteQuestion = ref('');
const erreur = ref('');
const nomEtablissement = ref(null);

const URL_SERVEUR = import.meta.env.VITE_SERVEUR_URL || `http://${window.location.hostname}:3001`;

onMounted(async () => {
  try {
    quizDisponibles.value = await chargerQuizDisponibles();
  } catch {
    // Pas grave : le mode "question libre" reste disponible sans le cloud.
  }
  try {
    const reponse = await fetch(`${URL_SERVEUR}/api/config`);
    nomEtablissement.value = (await reponse.json()).nomEtablissement || null;
  } catch {
    // Pas bloquant : la carte s'affichera sans le nom de l'établissement.
  }
});

async function executer(action) {
  erreur.value = '';
  try {
    await action();
  } catch (e) {
    erreur.value = e.message;
  }
}

function onDemarrer() {
  executer(() => demarrerPartie(quizSelectionne.value || undefined, modeChoisi.value));
}

async function onChoisirPhoto(evenement) {
  const fichier = evenement.target.files[0];
  if (!fichier) return;
  try {
    photoNouvelleEquipe.value = await reduireImage(fichier);
  } catch {
    erreur.value = 'Impossible de lire la photo.';
  }
}

function onAjouterEquipe() {
  const nom = nomNouvelleEquipe.value.trim();
  if (!nom) return;
  executer(() => preparerEquipe(nom, photoNouvelleEquipe.value)).then(() => {
    nomNouvelleEquipe.value = '';
    photoNouvelleEquipe.value = null;
    ajoutEquipeOuvert.value = false;
  });
}

function onLancerJeu() {
  executer(lancerJeu);
}

function onArreterPartie() {
  if (!confirm('Arrêter la partie en cours ?')) return;
  executer(arreterPartie);
}

function onTerminerPartie() {
  if (!confirm('Terminer la partie et afficher le podium ?')) return;
  executer(terminerPartie);
}

// Génère la carte-image du podium et la partage (partage natif si dispo sur le
// téléphone, sinon téléchargement).
async function onPartagerPodium() {
  erreur.value = '';
  partageEnCours.value = true;
  try {
    const blob = await genererCartePodium(classement.value, {
      titreQuiz: titreQuiz.value,
      nomEtablissement: nomEtablissement.value,
    });
    if (!blob) throw new Error('generation');
    const fichier = new File([blob], 'podium-boumbo.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: 'Podium Boumbo' });
    } else {
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = 'podium-boumbo.png';
      lien.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    // Annulation du partage par l'utilisateur : pas une vraie erreur.
    if (e.name !== 'AbortError') erreur.value = 'Impossible de générer la carte du podium.';
  } finally {
    partageEnCours.value = false;
  }
}

function onOuvrirQuestionDuQuiz() {
  executer(() => ouvrirQuestion());
}

function onOuvrirQuestionLibre() {
  if (!texteQuestion.value.trim()) return;
  executer(() => ouvrirQuestion(texteQuestion.value.trim())).then(() => {
    texteQuestion.value = '';
  });
}

// Mode libre : aucune question n'est jamais envoyée à l'écran, ce bouton se
// contente d'ouvrir les buzzers pour le tour que l'animateur mène lui-même.
function onOuvrirTourLibre() {
  executer(() => ouvrirQuestion());
}
</script>

<template>
  <main class="animateur">
    <span class="marque">b<span class="dome"></span>umb<span class="dome"></span> · animateur</span>

    <div v-if="carteMystere" class="carte-mystere" :class="`carte-mystere--${carteMystere.categorie}`">
      <p class="carte-mystere-etiquette">Carte mystère</p>
      <p class="carte-mystere-libelle">{{ carteMystere.libelle }}</p>
      <p class="carte-mystere-description">{{ carteMystere.description }}</p>
      <p v-if="carteMystere.cible" class="carte-mystere-cible">
        {{ carteMystere.categorie === 'malus' ? '🎯' : '✨' }} {{ carteMystere.cible }}
      </p>
      <p v-if="carteMystere.cle === 'silence-radio'" class="carte-mystere-rappel">
        À toi de désigner qui se tait et de faire respecter la règle.
      </p>
      <button class="btn-primary" @click="confirmerCarteMystereVue">J'ai annoncé la carte</button>
    </div>

    <button
      v-if="phase !== 'accueil' && phase !== 'podium'"
      class="btn-stop"
      @click="onArreterPartie"
    >
      Arrêter la partie
    </button>

    <section v-if="phase === 'accueil' && !modeChoisi" class="bloc">
      <h1>Choisis un mode de jeu</h1>
      <button class="btn-primary" @click="modeChoisi = 'quiz'">🧠 Quiz classique</button>
      <button class="btn-primary" @click="modeChoisi = 'chemin'">🌌 Chemin des étoiles</button>
      <button class="btn-primary" @click="modeChoisi = 'libre'">🎤 Mode libre</button>
    </section>

    <section v-else-if="phase === 'accueil'" class="bloc">
      <button class="btn-lien" @click="modeChoisi = null">← Changer de mode</button>
      <h1>
        {{
          modeChoisi === 'chemin'
            ? 'Nouvelle partie — Chemin des étoiles'
            : modeChoisi === 'libre'
              ? 'Nouvelle partie — Mode libre'
              : 'Nouvelle partie'
        }}
      </h1>
      <p v-if="modeChoisi === 'libre'" class="info">
        Aucune question ne s'affiche à l'écran : buzzer, points et podium, le
        reste est entre tes mains.
      </p>
      <label v-else class="champ-select">
        Quiz (facultatif)
        <select v-model="quizSelectionne">
          <option value="">Sans quiz (questions libres)</option>
          <option v-for="q in quizDisponibles" :key="q.id" :value="q.id">{{ q.titre }}</option>
        </select>
      </label>
      <button class="btn-primary" @click="onDemarrer">Démarrer la partie</button>
    </section>

    <section v-else-if="phase === 'association'" class="bloc">
      <h2>Équipes</h2>
      <p v-if="!equipesAssociees.length && !equipeEnAttente" class="info">
        Ajoute une première équipe pour commencer.
      </p>
      <div v-for="e in equipesAssociees" :key="e.nom" class="equipe-ok">
        <img v-if="e.photo" :src="e.photo" class="avatar" alt="" />
        <span>✓ {{ e.nom }}</span>
      </div>

      <div v-if="equipeEnAttente" class="attente">
        <img v-if="photoEnAttente" :src="photoEnAttente" class="avatar avatar--gros" alt="" />
        <p class="info info--ouverte">« {{ equipeEnAttente }} » : appuyez sur votre buzzer</p>
      </div>

      <template v-else>
        <div class="equipe-champ">
          <input
            v-model="nomNouvelleEquipe"
            placeholder="Nom de l'équipe"
            @keyup.enter="onAjouterEquipe"
          />
          <button type="button" class="pas" @click="onAjouterEquipe" aria-label="Ajouter l'équipe">+</button>
        </div>
        <label class="photo-champ">
          <input type="file" accept="image/*" capture="user" @change="onChoisirPhoto" hidden />
          <img v-if="photoNouvelleEquipe" :src="photoNouvelleEquipe" class="avatar avatar--gros" alt="" />
          <span v-else class="photo-placeholder">📷 Ajouter une photo (facultatif)</span>
        </label>
        <button v-if="equipesAssociees.length" class="btn-primary" @click="onLancerJeu">
          Démarrer la partie ({{ equipesAssociees.length }})
        </button>
      </template>
    </section>

    <section v-else-if="phase === 'podium'" class="bloc">
      <h2>Podium 🏆</h2>
      <Podium :classement="classement" :titre="titreQuiz" :anime="false" />
      <button class="btn-primary" :disabled="partageEnCours" @click="onPartagerPodium">
        {{ partageEnCours ? 'Génération…' : '📤 Partager le podium' }}
      </button>
      <button class="btn-secondaire" @click="executer(arreterPartie)">Nouvelle partie</button>
    </section>

    <section v-else class="bloc">
      <p v-if="titreQuiz" class="titre-quiz">Quiz : {{ titreQuiz }}</p>

      <template v-if="etat === 'fermee'">
        <!-- Ajout d'une équipe en cours de partie : on attend son buzzer -->
        <p v-if="equipeEnAttente" class="info info--ouverte">
          « {{ equipeEnAttente }} » : appuyez sur votre buzzer
        </p>

        <template v-else-if="miniJeuActif">
          <h2>🎯 Mini-jeu en cours</h2>
          <p class="info">Jauge de précision — les équipes buzzent quand elles veulent.</p>
          <p v-if="miniJeuActif.equipesBuzzees.length" class="info info--reponse">
            Ont buzzé : {{ miniJeuActif.equipesBuzzees.map((e) => e.nom).join(', ') }}
          </p>
          <button class="btn-secondaire" @click="executer(terminerMiniJeu)">Terminer le mini-jeu</button>
        </template>

        <template v-else-if="miniJeuResultat">
          <h2>Résultat du mini-jeu</h2>
          <ul class="classement">
            <li v-for="r in miniJeuResultat" :key="r.nom">
              <span>{{ r.nom }}</span>
              <span>+{{ r.points }} ({{ Math.round(r.precision * 100) }}%)</span>
            </li>
          </ul>
          <button class="btn-primary" @click="confirmerMiniJeuVu">Continuer</button>
        </template>

        <template v-else>
          <template v-if="mode === 'libre'">
            <h2>Tour suivant</h2>
            <p class="info">Anime comme tu veux, ouvre juste les buzzers quand tu es prêt.</p>
            <button class="btn-primary" @click="onOuvrirTourLibre">🎙️ Ouvrir les buzzers</button>
          </template>
          <template v-else>
            <h2>Question suivante</h2>
            <template v-if="prochaineQuestion">
              <p class="question-rappel">{{ prochaineQuestion.intitule }}</p>
              <p class="reponse-attendue">Réponse : {{ prochaineQuestion.reponse }}</p>
              <button class="btn-primary" @click="onOuvrirQuestionDuQuiz">Ouvrir la question</button>
            </template>
            <template v-else>
              <textarea v-model="texteQuestion" placeholder="Tape la question ici..." rows="3"></textarea>
              <button class="btn-primary" @click="onOuvrirQuestionLibre">Ouvrir la question</button>
            </template>
          </template>

          <template v-if="choixMiniJeuOuvert">
            <div class="choix-minijeu">
              <button v-for="m in MINIJEUX" :key="m.type" class="btn-secondaire" @click="onLancerMiniJeu(m.type)">
                {{ m.label }}
              </button>
            </div>
          </template>
          <button v-else class="btn-secondaire" @click="choixMiniJeuOuvert = true">🎯 Lancer un mini-jeu</button>

          <!-- Points d'ambiance -->
          <div v-if="classement.length" class="ambiance">
            <p class="ambiance-titre">Points d'ambiance</p>
            <div v-for="e in classement" :key="e.id" class="ambiance-ligne">
              <span class="ambiance-nom">
                <img v-if="e.photo" :src="e.photo" class="avatar avatar--petit" alt="" />
                {{ e.nom }} · {{ e.points }}
              </span>
              <span class="ambiance-actions">
                <button class="pas pas--petit" @click="executer(() => ajusterPoints(e.id, -1))" aria-label="Retirer un point">−</button>
                <button class="pas pas--petit" @click="executer(() => ajusterPoints(e.id, 1))" aria-label="Ajouter un point">+</button>
              </span>
            </div>
          </div>

          <!-- Ajouter une équipe retardataire -->
          <template v-if="ajoutEquipeOuvert">
            <div class="equipe-champ">
              <input v-model="nomNouvelleEquipe" placeholder="Nom de l'équipe" @keyup.enter="onAjouterEquipe" />
              <button type="button" class="pas" @click="onAjouterEquipe" aria-label="Valider">✓</button>
            </div>
            <label class="photo-champ">
              <input type="file" accept="image/*" capture="user" @change="onChoisirPhoto" hidden />
              <img v-if="photoNouvelleEquipe" :src="photoNouvelleEquipe" class="avatar avatar--gros" alt="" />
              <span v-else class="photo-placeholder">📷 Photo (facultatif)</span>
            </label>
          </template>
          <button v-else class="btn-secondaire" @click="ajoutEquipeOuvert = true">＋ Ajouter une équipe</button>

          <button class="btn-terminer" @click="onTerminerPartie">🏆 Afficher le podium</button>
        </template>
      </template>

      <template v-else-if="etat === 'attente_buzz'">
        <p v-if="questionActuelle" class="question-rappel">{{ questionActuelle }}</p>
        <p v-if="reponseActuelle" class="reponse-attendue">Réponse : {{ reponseActuelle }}</p>
        <p class="info info--ouverte">En attente de buzz...</p>
        <button class="btn-secondaire" @click="executer(passerQuestion)">
          {{ mode === 'libre' ? 'Annuler le tour' : 'Passer la question' }}
        </button>
      </template>

      <template v-else-if="etat === 'en_reponse'">
        <p v-if="questionActuelle" class="question-rappel">{{ questionActuelle }}</p>
        <p v-if="reponseActuelle" class="reponse-attendue">Réponse : {{ reponseActuelle }}</p>
        <p class="info info--reponse">{{ message }}</p>
        <div class="actions-reponse">
          <button class="btn-correct" @click="executer(() => validerReponse(true))">Bonne réponse</button>
          <button class="btn-incorrect" @click="executer(() => validerReponse(false))">Mauvaise réponse</button>
        </div>
        <button class="btn-secondaire" @click="executer(passerQuestion)">Passer la question</button>
      </template>

      <template v-else-if="etat === 'resultat'">
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
        <button class="btn-primary" @click="confirmerResultatVu">Question suivante</button>
      </template>

      <template v-else-if="etat === 'deconnecte'">
        <p class="info">Connexion au serveur perdue...</p>
      </template>
    </section>

    <p v-if="erreur" class="erreur">{{ erreur }}</p>
  </main>
</template>

<style scoped>
.animateur {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 1.25rem 4rem;
}
.marque {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 1.4rem;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 2px;
}
.marque .dome {
  display: inline-block;
  width: 0.62em;
  height: 0.62em;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--red-hi), var(--red) 55%, var(--red-lo));
  transform: translateY(0.06em);
}
.bloc {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  text-align: center;
}
.bloc h1,
.bloc h2 {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 1.6rem;
}
.champ-nombre {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.champ-nombre input {
  width: 80px;
  padding: 0.6rem;
  font-size: 1.6rem;
  text-align: center;
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  border-radius: 14px;
  border: 1.5px solid var(--cream-faint);
  background: var(--night-2);
  color: var(--cream);
}
.pas {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1.5px solid var(--cream-faint);
  background: var(--night-2);
  color: var(--cream);
  font-size: 1.5rem;
  cursor: pointer;
  flex-shrink: 0;
}
.equipes-setup {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
}
.equipe-champ {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.equipe-champ input {
  flex: 1;
  padding: 0.7rem 0.85rem;
  font-size: 1.05rem;
  font-family: 'Figtree', sans-serif;
  border-radius: 14px;
  border: 1.5px solid var(--cream-faint);
  background: var(--night-2);
  color: var(--cream);
}
.btn-ajouter {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--gold);
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.3rem 0;
}
textarea {
  width: 100%;
  padding: 0.75rem;
  font-size: 1.1rem;
  font-family: 'Figtree', sans-serif;
  border-radius: 14px;
  border: 1.5px solid var(--cream-faint);
  background: var(--night-2);
  color: var(--cream);
  resize: vertical;
}
.champ-select {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.95rem;
  color: var(--cream-dim);
}
.champ-select select {
  padding: 0.6rem;
  font-size: 1rem;
  font-family: 'Figtree', sans-serif;
  border-radius: 14px;
  border: 1.5px solid var(--cream-faint);
  background: var(--night-2);
  color: var(--cream);
}
.titre-quiz {
  font-size: 0.95rem;
  color: var(--cream-dim);
}
.question-rappel {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1.3rem;
}
.reponse-attendue {
  font-size: 1rem;
  color: var(--gold);
}
.info {
  font-size: 1.1rem;
  color: var(--cream-dim);
}
.info--ouverte {
  color: var(--gold);
}
.info--reponse {
  color: var(--teal);
}
.btn-primary,
.btn-secondaire,
.btn-correct,
.btn-incorrect,
.btn-terminer,
.btn-stop {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.9rem 1.8rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  width: 100%;
}
.btn-primary {
  background: var(--gold);
  color: #3a1408;
}
.btn-secondaire {
  background: transparent;
  color: var(--cream);
  border: 1.5px solid var(--cream-faint);
}
.btn-mode-bientot {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.9rem 1.8rem;
  border-radius: 999px;
  border: 1.5px dashed var(--cream-faint);
  background: transparent;
  color: var(--cream-dim);
  width: 100%;
  cursor: not-allowed;
}
.btn-lien {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--cream-dim);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: -0.5rem;
}
.btn-lien:hover {
  color: var(--cream);
}
.btn-terminer {
  background: transparent;
  color: var(--gold);
  border: 1.5px solid rgba(246, 178, 60, 0.5);
}
.actions-reponse {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}
.btn-correct {
  background: var(--teal);
  color: #0a2a2c;
}
.btn-incorrect {
  background: var(--red);
  color: var(--cream);
}
.btn-stop {
  background: transparent;
  color: var(--red-hi);
  border: 1.5px solid rgba(240, 57, 43, 0.4);
  max-width: 260px;
}
.gagnant {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 2.2rem;
  color: var(--gold);
}
.classement {
  list-style: none;
  padding: 0;
  font-size: 1.2rem;
  width: 100%;
}
.classement li {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--cream-faint);
}
.equipe-ok {
  color: var(--teal);
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid var(--cream-faint);
}
.avatar--gros {
  width: 72px;
  height: 72px;
}
.avatar--petit {
  width: 24px;
  height: 24px;
}
.attente {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.photo-champ {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0.25rem 0;
}
.photo-placeholder {
  color: var(--gold);
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1rem;
}
.nom-avec-avatar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.choix-minijeu {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ambiance {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--cream-faint);
  padding-top: 1rem;
  margin-top: 0.5rem;
}
.ambiance-titre {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  color: var(--cream-dim);
  font-size: 0.95rem;
}
.ambiance-ligne {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.ambiance-nom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}
.ambiance-actions {
  display: flex;
  gap: 0.5rem;
}
.pas--petit {
  width: 36px;
  height: 36px;
  font-size: 1.2rem;
}
.erreur {
  color: var(--red-hi);
}
.carte-mystere {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
  padding: 1.5rem;
  border-radius: 20px;
  background: var(--night-2);
  border: 1.5px solid rgba(246, 178, 60, 0.4);
}
.carte-mystere--malus {
  border-color: rgba(240, 57, 43, 0.5);
}
.carte-mystere-etiquette {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-size: 0.8rem;
  color: var(--teal);
}
.carte-mystere-libelle {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 1.6rem;
  color: var(--gold);
}
.carte-mystere--malus .carte-mystere-libelle {
  color: var(--red-hi);
}
.carte-mystere-description {
  font-size: 1rem;
  color: var(--cream);
}
.carte-mystere-cible {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1.05rem;
}
.carte-mystere-rappel {
  font-size: 0.9rem;
  color: var(--cream-dim);
  font-style: italic;
}
</style>
