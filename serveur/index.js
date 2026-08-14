const os = require('os');
const path = require('path');
const { creerJeu } = require('./jeu');
const { creerPartie } = require('./partie');
const { creerDiffuseur } = require('./diffusion');
const { detecterEtOuvrirBuzzers } = require('./buzzers');
const { recupererQuizDisponibles, recupererQuiz } = require('./cloud');

const PORT_ECRAN = process.env.PORT_ECRAN || 3001;
const DOSSIER_ECRAN = path.join(__dirname, '../ecran/dist');

function trouverAdresseReseauLocale() {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const adresse = interfaces.find((i) => i.family === 'IPv4' && !i.internal);
  return adresse ? adresse.address : null;
}

function demarrer() {
  const { emetteur } = detecterEtOuvrirBuzzers();
  const { serveur, diffuser, route } = creerDiffuseur(DOSSIER_ECRAN);
  let partie = creerPartie();
  let jeu = null;
  let questionActuelle = '';
  let reponseActuelle = '';
  let quizCharge = null;
  let indexQuestionCourante = 0;

  function prochaineQuestionDuQuiz() {
    if (!quizCharge) return null;
    const question = quizCharge.questions[indexQuestionCourante];
    return question ? { intitule: question.intitule, reponse: question.reponse } : null;
  }

  emetteur.on('port-ouvert', ({ path }) => console.log(`Buzzer détecté : ${path}`));
  emetteur.on('port-erreur', ({ path, message }) => console.error(`Erreur sur ${path} :`, message));
  emetteur.on('info-firmware', ({ path, texte }) => console.log(`[${path}] info firmware : ${texte}`));

  function trouverEquipe(id) {
    return partie.getEquipes().find((e) => e.id === id);
  }

  function afficherClassement() {
    console.log('--- Classement ---');
    jeu.getClassement().forEach(({ nom, points }) => console.log(`${nom} : ${points}`));
    console.log('------------------\n');
  }

  // Snapshot complet, utilisé par l'écran et la télécommande animateur pour se
  // resynchroniser à l'ouverture ou après une reconnexion (le flux SSE seul ne
  // rattrape pas l'historique).
  function etatComplet() {
    if (partie.getEtat() === 'accueil') {
      return { phasePartie: 'accueil' };
    }

    if (partie.getEtat() === 'association') {
      return {
        phasePartie: 'association',
        equipesAssociees: partie.getEquipes().map((e) => e.nom),
        equipeEnAttente: partie.getEquipeEnAttente(),
      };
    }

    const joueurQuiRepondId = jeu.getJoueurQuiRepond();
    const equipeQuiRepond = joueurQuiRepondId ? trouverEquipe(joueurQuiRepondId) : null;

    return {
      phasePartie: 'prete',
      jeu: {
        etat: jeu.getEtat(),
        questionActuelle,
        reponseActuelle,
        titreQuiz: quizCharge ? quizCharge.titre : null,
        prochaineQuestion: jeu.getEtat() === 'fermee' ? prochaineQuestionDuQuiz() : null,
        joueurQuiRepond: equipeQuiRepond ? equipeQuiRepond.nom : null,
        classement: jeu.getClassement(),
      },
    };
  }

  emetteur.on('buzz', ({ path, horodatage }) => {
    if (partie.getEtat() === 'association') {
      const resultat = partie.tenterAssociation(path);
      if (!resultat) return;

      console.log(`${resultat.nom} associée au buzzer ${path}.`);

      if (resultat.complet) {
        jeu = creerJeu(partie.getEquipes());
        console.log('\nToutes les équipes sont associées. Prêt à jouer !');
        diffuser('partie-prete', { equipes: partie.getEquipes().map((e) => e.nom) });
      } else {
        diffuser('equipe-associee', { nom: resultat.nom, equipeEnAttente: partie.getEquipeEnAttente() });
      }
      return;
    }

    if (!jeu) return;

    const equipe = partie.getEquipes().find((e) => e.port === path);
    if (!equipe) return;

    const resultat = jeu.enregistrerBuzz(equipe.id, horodatage);
    if (resultat) {
      console.log(`\n${equipe.nom} a buzzé le premier ! (@ ${horodatage} ms)`);
      diffuser('joueur-repond', { joueur: equipe.nom });
    }
  });

  route('GET', '/api/etat', (corps, reponse) => {
    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify(etatComplet()));
  });

  // L'écran ne peut pas déduire l'adresse réseau depuis lui-même s'il a été
  // ouvert via localhost — seul le serveur la connaît de façon fiable.
  route('GET', '/api/config', (corps, reponse) => {
    const ipLocale = trouverAdresseReseauLocale();
    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({
      urlAnimateur: ipLocale ? `http://${ipLocale}:${PORT_ECRAN}/animateur` : null,
    }));
  });

  route('GET', '/api/quiz-disponibles', async (corps, reponse) => {
    try {
      const quiz = await recupererQuizDisponibles();
      reponse.writeHead(200, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify(quiz));
    } catch (erreur) {
      reponse.writeHead(502, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: `Impossible de joindre le cloud : ${erreur.message}` }));
    }
  });

  route('POST', '/api/partie/demarrer', async (corps, reponse) => {
    const nombreEquipes = Number(corps.nombreEquipes);

    if (!Number.isInteger(nombreEquipes) || nombreEquipes < 1) {
      reponse.writeHead(400, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'nombreEquipes invalide' }));
      return;
    }

    quizCharge = null;
    indexQuestionCourante = 0;

    if (corps.quizId) {
      try {
        quizCharge = await recupererQuiz(corps.quizId);
      } catch (erreur) {
        reponse.writeHead(502, { 'Content-Type': 'application/json' });
        reponse.end(JSON.stringify({ erreur: `Impossible de charger le quiz : ${erreur.message}` }));
        return;
      }
    }

    partie.demarrer(nombreEquipes);
    jeu = null;
    questionActuelle = '';
    reponseActuelle = '';
    console.log(`\nNouvelle partie : ${nombreEquipes} équipe(s) à associer.`);
    if (quizCharge) console.log(`Quiz chargé : "${quizCharge.titre}" (${quizCharge.questions.length} question(s)).`);
    console.log(`Équipe ${partie.getEquipeEnAttente()} : appuie sur ton buzzer.`);
    diffuser('partie-demarree', { equipeEnAttente: partie.getEquipeEnAttente() });

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ equipeEnAttente: partie.getEquipeEnAttente() }));
  });

  route('POST', '/api/partie/arreter', (corps, reponse) => {
    if (partie.getEtat() === 'accueil') {
      reponse.writeHead(200, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ ok: true }));
      return;
    }

    console.log("\nPartie arrêtée par l'animateur.");
    jeu = null;
    questionActuelle = '';
    reponseActuelle = '';
    quizCharge = null;
    indexQuestionCourante = 0;
    partie = creerPartie();
    diffuser('partie-arretee', {});

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  route('POST', '/api/question/ouvrir', (corps, reponse) => {
    if (!jeu || jeu.getEtat() !== 'fermee') {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Aucune question ne peut être ouverte dans cet état' }));
      return;
    }

    const prochaine = prochaineQuestionDuQuiz();

    if (prochaine) {
      questionActuelle = prochaine.intitule;
      reponseActuelle = prochaine.reponse;
      indexQuestionCourante += 1;
    } else {
      questionActuelle = String(corps.texte || '').trim();
      reponseActuelle = '';
    }

    jeu.demarrerQuestion();
    console.log(`Question ouverte : "${questionActuelle}"${reponseActuelle ? ` (réponse : ${reponseActuelle})` : ''}`);
    diffuser('question-ouverte', { texte: questionActuelle, reponse: reponseActuelle });

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  route('POST', '/api/reponse', (corps, reponse) => {
    if (!jeu || jeu.getEtat() !== 'en_reponse') {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Personne ne répond actuellement' }));
      return;
    }

    const resultat = jeu.validerReponse(Boolean(corps.correcte));
    const equipe = trouverEquipe(resultat.joueurId);

    if (resultat.resultat === 'correct') {
      console.log(`Bonne réponse de ${equipe.nom} !`);
      afficherClassement();
      diffuser('reponse-correcte', { joueur: equipe.nom, classement: jeu.getClassement() });
      questionActuelle = '';
      reponseActuelle = '';
    } else if (resultat.plusPersonne) {
      console.log(`Mauvaise réponse de ${equipe.nom}. Plus personne ne peut buzzer, passe à la question suivante.`);
      diffuser('question-terminee', { resultat: 'personne' });
      questionActuelle = '';
      reponseActuelle = '';
    } else {
      console.log(`Mauvaise réponse de ${equipe.nom}, son buzzer est désactivé pour cette question. À vos buzzers !`);
      diffuser('reponse-incorrecte', { joueur: equipe.nom });
    }

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  route('POST', '/api/question/passer', (corps, reponse) => {
    if (!jeu || !['attente_buzz', 'en_reponse'].includes(jeu.getEtat())) {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Aucune question à passer dans cet état' }));
      return;
    }

    jeu.passerQuestion();
    questionActuelle = '';
    reponseActuelle = '';
    console.log('Question passée.');
    diffuser('question-terminee', { resultat: 'skip' });

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  serveur.listen(PORT_ECRAN, () => {
    const ipLocale = trouverAdresseReseauLocale();
    console.log('\nBoumbo est prêt.');
    console.log(`Écran (à mettre sur la TV) : http://localhost:${PORT_ECRAN}`);
    if (ipLocale) {
      console.log(`Télécommande animateur (depuis ton téléphone, même Wi-Fi) : http://${ipLocale}:${PORT_ECRAN}/animateur`);
    } else {
      console.log(`Télécommande animateur (depuis ton téléphone, même Wi-Fi) : http://<ip-de-ce-pc>:${PORT_ECRAN}/animateur`);
    }
  });
}

demarrer();
