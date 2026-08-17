<script setup>
import { ref, onMounted } from 'vue';
import { useJeu } from '../composables/useJeu';
import Podium from '../components/Podium.vue';

const {
  phase,
  equipeEnAttente,
  equipesAssociees,
  etat,
  message,
  questionActuelle,
  reponseActuelle,
  titreQuiz,
  prochaineQuestion,
  gagnant,
  classement,
  lancerPartie,
  arreterPartie,
  terminerPartie,
  ouvrirQuestion,
  validerReponse,
  passerQuestion,
  confirmerResultatVu,
  chargerQuizDisponibles,
} = useJeu();

const nombreEquipes = ref(2);
const quizDisponibles = ref([]);
const quizSelectionne = ref('');
const texteQuestion = ref('');
const erreur = ref('');

onMounted(async () => {
  try {
    quizDisponibles.value = await chargerQuizDisponibles();
  } catch {
    // Pas grave : le mode "question libre" reste disponible sans le cloud.
  }
});

function ajusterNombreEquipes(delta) {
  nombreEquipes.value = Math.max(1, nombreEquipes.value + delta);
}

async function executer(action) {
  erreur.value = '';
  try {
    await action();
  } catch (e) {
    erreur.value = e.message;
  }
}

function onLancerPartie() {
  executer(() => lancerPartie(nombreEquipes.value, quizSelectionne.value || undefined));
}

function onArreterPartie() {
  if (!confirm('Arrêter la partie en cours ?')) return;
  executer(arreterPartie);
}

function onTerminerPartie() {
  if (!confirm('Terminer la partie et afficher le podium ?')) return;
  executer(terminerPartie);
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
</script>

<template>
  <main class="animateur">
    <span class="marque">b<span class="dome"></span>umb<span class="dome"></span> · animateur</span>

    <button
      v-if="phase !== 'accueil' && phase !== 'podium'"
      class="btn-stop"
      @click="onArreterPartie"
    >
      Arrêter la partie
    </button>

    <section v-if="phase === 'accueil'" class="bloc">
      <h1>Combien d'équipes ce soir ?</h1>
      <div class="champ-nombre">
        <button type="button" class="pas" @click="ajusterNombreEquipes(-1)" aria-label="Moins">−</button>
        <input v-model.number="nombreEquipes" type="number" min="1" />
        <button type="button" class="pas" @click="ajusterNombreEquipes(1)" aria-label="Plus">+</button>
      </div>

      <label class="champ-select">
        Quiz (facultatif)
        <select v-model="quizSelectionne">
          <option value="">Sans quiz (questions libres)</option>
          <option v-for="q in quizDisponibles" :key="q.id" :value="q.id">{{ q.titre }}</option>
        </select>
      </label>

      <button class="btn-primary" @click="onLancerPartie">Lancer la partie</button>
    </section>

    <section v-else-if="phase === 'association'" class="bloc">
      <p v-for="nom in equipesAssociees" :key="nom" class="equipe-ok">✓ {{ nom }}</p>
      <p class="info">En attente : équipe {{ equipeEnAttente }} appuie sur son buzzer</p>
    </section>

    <section v-else-if="phase === 'podium'" class="bloc">
      <h2>Podium 🏆</h2>
      <Podium :classement="classement" :titre="titreQuiz" :anime="false" />
      <button class="btn-primary" @click="executer(arreterPartie)">Nouvelle partie</button>
    </section>

    <section v-else class="bloc">
      <p v-if="titreQuiz" class="titre-quiz">Quiz : {{ titreQuiz }}</p>

      <template v-if="etat === 'fermee' && prochaineQuestion">
        <h2>Question suivante</h2>
        <p class="question-rappel">{{ prochaineQuestion.intitule }}</p>
        <p class="reponse-attendue">Réponse : {{ prochaineQuestion.reponse }}</p>
        <button class="btn-primary" @click="onOuvrirQuestionDuQuiz">Ouvrir la question</button>
      </template>

      <template v-else-if="etat === 'fermee'">
        <h2>Question suivante</h2>
        <textarea v-model="texteQuestion" placeholder="Tape la question ici..." rows="3"></textarea>
        <button class="btn-primary" @click="onOuvrirQuestionLibre">Ouvrir la question</button>
      </template>

      <button v-if="etat === 'fermee'" class="btn-terminer" @click="onTerminerPartie">
        🏆 Afficher le podium
      </button>

      <template v-else-if="etat === 'attente_buzz'">
        <p class="question-rappel">{{ questionActuelle }}</p>
        <p v-if="reponseActuelle" class="reponse-attendue">Réponse : {{ reponseActuelle }}</p>
        <p class="info info--ouverte">En attente de buzz...</p>
        <button class="btn-secondaire" @click="executer(passerQuestion)">Passer la question</button>
      </template>

      <template v-else-if="etat === 'en_reponse'">
        <p class="question-rappel">{{ questionActuelle }}</p>
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
            <span>{{ j.nom }}</span>
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
}
.erreur {
  color: var(--red-hi);
}
</style>
