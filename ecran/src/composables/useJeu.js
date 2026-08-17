import { ref, onMounted, onUnmounted } from 'vue';
import { jouerSonQuestion, jouerSonBuzz, jouerSonCorrect, jouerSonIncorrect } from '../sons';

// Déduit l'adresse du serveur depuis celle utilisée pour charger la page :
// depuis le Mac ça donne localhost, depuis le téléphone ça donne l'IP du
// Mac sur le Wi-Fi — jamais besoin de configurer une IP à la main, qui
// changerait de toute façon d'un réseau à l'autre. VITE_SERVEUR_URL reste
// disponible pour forcer une autre adresse si besoin.
const URL_SERVEUR = import.meta.env.VITE_SERVEUR_URL || `http://${window.location.hostname}:3001`;

// État + actions partagés entre l'écran public (lecture seule) et la
// télécommande animateur (lecture + actions). Chaque vue ouvre sa propre
// connexion SSE : ce sont des appareils différents (TV et téléphone), pas
// besoin d'un store partagé entre les deux.
export function useJeu({ jouerSons = false } = {}) {
  // 'accueil' | 'association' | 'jeu' | 'podium'
  const phase = ref('accueil');
  const equipeEnAttente = ref('');
  const photoEnAttente = ref(null);
  const equipesAssociees = ref([]);

  // 'fermee' | 'attente_buzz' | 'en_reponse' | 'resultat' | 'deconnecte'
  const etat = ref('fermee');
  const message = ref('');
  const questionActuelle = ref('');
  const reponseActuelle = ref('');
  const titreQuiz = ref(null);
  const prochaineQuestion = ref(null);
  const gagnant = ref(null);
  const classement = ref([]);

  let source;

  function appliquerSnapshot(donnees) {
    if (donnees.phasePartie === 'accueil') {
      phase.value = 'accueil';
      return;
    }

    if (donnees.phasePartie === 'association') {
      phase.value = 'association';
      equipesAssociees.value = donnees.equipesAssociees;
      equipeEnAttente.value = donnees.equipeEnAttente || '';
      photoEnAttente.value = donnees.photoEnAttente || null;
      return;
    }

    if (donnees.phasePartie === 'termine') {
      phase.value = 'podium';
      classement.value = donnees.classement;
      titreQuiz.value = donnees.titreQuiz || null;
      return;
    }

    phase.value = 'jeu';
    etat.value = donnees.jeu.etat;
    questionActuelle.value = donnees.jeu.questionActuelle || '';
    reponseActuelle.value = donnees.jeu.reponseActuelle || '';
    titreQuiz.value = donnees.jeu.titreQuiz || null;
    prochaineQuestion.value = donnees.jeu.prochaineQuestion || null;
    classement.value = donnees.jeu.classement;

    if (donnees.jeu.etat === 'fermee') message.value = 'En attente de la prochaine question...';
    else if (donnees.jeu.etat === 'attente_buzz') message.value = 'À vos buzzers !';
    else if (donnees.jeu.etat === 'en_reponse') message.value = `${donnees.jeu.joueurQuiRepond} répond...`;
  }

  async function synchroniser() {
    try {
      const reponse = await fetch(`${URL_SERVEUR}/api/etat`);
      appliquerSnapshot(await reponse.json());
    } catch {
      // Pas grave : le flux SSE prendra le relais dès qu'il se connectera.
    }
  }

  async function appelApi(chemin, corps) {
    const reponse = await fetch(`${URL_SERVEUR}${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps || {}),
    });

    if (!reponse.ok) {
      const donnees = await reponse.json().catch(() => ({}));
      throw new Error(donnees.erreur || `Erreur ${reponse.status}`);
    }

    return reponse.json();
  }

  function demarrerPartie(quizId) {
    return appelApi('/api/partie/demarrer', { quizId: quizId || undefined });
  }

  function preparerEquipe(nom, photo) {
    return appelApi('/api/equipe/preparer', { nom, photo: photo || undefined });
  }

  function lancerJeu() {
    return appelApi('/api/partie/lancer');
  }

  async function chargerQuizDisponibles() {
    const reponse = await fetch(`${URL_SERVEUR}/api/quiz-disponibles`);
    if (!reponse.ok) throw new Error('Impossible de récupérer les quiz');
    return reponse.json();
  }

  function arreterPartie() {
    return appelApi('/api/partie/arreter');
  }

  function terminerPartie() {
    return appelApi('/api/partie/terminer');
  }

  function ouvrirQuestion(texte) {
    return appelApi('/api/question/ouvrir', { texte });
  }

  function validerReponse(correcte) {
    return appelApi('/api/reponse', { correcte });
  }

  function passerQuestion() {
    return appelApi('/api/question/passer');
  }

  function ajusterPoints(equipeId, delta) {
    return appelApi('/api/points', { equipeId, delta });
  }

  // Le serveur est déjà repassé en 'fermee' juste après une bonne réponse,
  // mais on garde le résultat affiché le temps que l'animateur le voie —
  // ce bouton révèle la question suivante (resynchronise pour la récupérer,
  // que ce soit la suite d'un quiz ou un champ de saisie libre).
  function confirmerResultatVu() {
    etat.value = 'fermee';
    message.value = 'En attente de la prochaine question...';
    synchroniser();
  }

  onMounted(() => {
    synchroniser();

    source = new EventSource(`${URL_SERVEUR}/evenements`);

    source.addEventListener('partie-demarree', () => {
      phase.value = 'association';
      equipesAssociees.value = [];
      equipeEnAttente.value = '';
      photoEnAttente.value = null;
    });

    // Une équipe a été préparée : elle attend son buzzer.
    source.addEventListener('equipe-attendue', (evenement) => {
      const { nom, photo } = JSON.parse(evenement.data);
      equipeEnAttente.value = nom;
      photoEnAttente.value = photo || null;
    });

    source.addEventListener('equipe-associee', (evenement) => {
      const { equipes } = JSON.parse(evenement.data);
      equipesAssociees.value = equipes;
      equipeEnAttente.value = ''; // plus d'équipe en attente jusqu'au prochain ajout
      photoEnAttente.value = null;
    });

    source.addEventListener('partie-prete', () => {
      phase.value = 'jeu';
      etat.value = 'fermee';
      message.value = 'Prêt ! En attente de la première question...';
      synchroniser(); // récupère titreQuiz / prochaineQuestion si un quiz a été chargé
    });

    source.addEventListener('question-ouverte', (evenement) => {
      const { texte, reponse } = JSON.parse(evenement.data);
      etat.value = 'attente_buzz';
      questionActuelle.value = texte;
      reponseActuelle.value = reponse || '';
      message.value = 'À vos buzzers !';
      gagnant.value = null;
      if (jouerSons) jouerSonQuestion();
    });

    source.addEventListener('joueur-repond', (evenement) => {
      const { joueur } = JSON.parse(evenement.data);
      etat.value = 'en_reponse';
      message.value = `${joueur} répond...`;
      if (jouerSons) jouerSonBuzz();
    });

    source.addEventListener('reponse-correcte', (evenement) => {
      const donnees = JSON.parse(evenement.data);
      etat.value = 'resultat';
      gagnant.value = donnees.joueur;
      classement.value = donnees.classement;
      if (jouerSons) jouerSonCorrect();
    });

    // Classement mis à jour hors bonne réponse (points d'ambiance, ajout d'une
    // équipe en cours de partie).
    source.addEventListener('classement-maj', (evenement) => {
      classement.value = JSON.parse(evenement.data).classement;
    });

    source.addEventListener('reponse-incorrecte', (evenement) => {
      const { joueur } = JSON.parse(evenement.data);
      etat.value = 'attente_buzz';
      message.value = `Mauvaise réponse de ${joueur}, à vos buzzers !`;
      if (jouerSons) jouerSonIncorrect();
    });

    source.addEventListener('question-terminee', (evenement) => {
      const { resultat } = JSON.parse(evenement.data);
      etat.value = 'fermee';
      questionActuelle.value = '';
      message.value = resultat === 'personne' ? "Personne n'a trouvé..." : 'Question passée.';
      synchroniser();
    });

    source.addEventListener('partie-terminee', (evenement) => {
      const donnees = JSON.parse(evenement.data);
      phase.value = 'podium';
      classement.value = donnees.classement;
      titreQuiz.value = donnees.titreQuiz || null;
    });

    source.addEventListener('partie-arretee', () => {
      phase.value = 'accueil';
      equipesAssociees.value = [];
      etat.value = 'fermee';
      questionActuelle.value = '';
      gagnant.value = null;
    });

    source.onerror = () => {
      if (phase.value === 'jeu') etat.value = 'deconnecte';
    };
  });

  onUnmounted(() => {
    source?.close();
  });

  return {
    phase,
    equipeEnAttente,
    photoEnAttente,
    equipesAssociees,
    etat,
    message,
    questionActuelle,
    reponseActuelle,
    titreQuiz,
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
  };
}
