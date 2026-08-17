const os = require('os');
const path = require('path');
const { creerJeu } = require('./jeu');
const { creerPartie } = require('./partie');
const { creerDiffuseur } = require('./diffusion');
const { detecterEtOuvrirBuzzers } = require('./buzzers');
const { recupererQuizDisponibles, recupererQuiz, enregistrerSoiree, recupererEtablissement } = require('./cloud');

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
  // Vrai une fois que l'animateur a clôturé la partie : l'écran bascule alors
  // sur le podium. Indépendant du mode de jeu — n'importe quel mode se termine
  // en passant par /api/partie/terminer.
  let partieTerminee = false;
  // Nom de l'établissement (récupéré du cloud, mis en cache) — affiché sur la
  // carte de podium partageable. Best-effort : null si jamais récupéré.
  let nomEtablissement = null;
  recupererEtablissement()
    .then((etab) => {
      nomEtablissement = etab.nom;
      console.log(`Établissement : ${etab.nom}`);
    })
    .catch(() => {});

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

  // Classement enrichi de la vignette de chaque équipe (jointure par id), pour
  // afficher la photo à côté du nom sur l'écran et le podium.
  function classementAvecPhotos() {
    const photoParId = new Map(partie.getEquipes().map((e) => [e.id, e.photo || null]));
    return jeu.getClassement().map((j) => ({ ...j, photo: photoParId.get(j.id) || null }));
  }

  // Bascule la partie sur le podium (classement final) et le diffuse à l'écran
  // comme à la télécommande. Utilisée aussi bien par l'action manuelle de
  // l'animateur que par la fin automatique d'un quiz.
  function terminerPartie() {
    partieTerminee = true;
    const classementFinal = jeu.getClassement();
    console.log('\nPartie terminée — affichage du podium.');
    afficherClassement();
    diffuser('partie-terminee', {
      classement: classementAvecPhotos(),
      titreQuiz: quizCharge ? quizCharge.titre : null,
    });

    // Enregistre la soirée au cloud pour les stats/classements — best-effort :
    // un cloud injoignable ne doit jamais perturber la fin de partie.
    enregistrerSoiree(quizCharge ? quizCharge.id : null, classementFinal)
      .then(() => console.log('Soirée enregistrée au cloud.'))
      .catch((erreur) => console.log(`Soirée non enregistrée (${erreur.message}).`));
  }

  // Fin automatique : dès qu'un quiz chargé n'a plus de question à jouer, on
  // affiche le podium sans attendre d'action de l'animateur. Ne concerne que
  // les parties sur quiz — en questions libres, il n'y a pas de fin prédéfinie.
  // Court délai pour laisser voir le résultat de la dernière question avant que
  // le podium ne prenne le relais.
  const DELAI_FIN_AUTO_MS = 2500;
  function terminerSiQuizEpuise() {
    if (!quizCharge || prochaineQuestionDuQuiz()) return;

    const jeuAuMomentDeLaFin = jeu;
    setTimeout(() => {
      // Ne rien faire si la partie a été arrêtée ou relancée entre-temps, ou
      // déjà terminée manuellement par l'animateur.
      if (jeu === jeuAuMomentDeLaFin && !partieTerminee) {
        terminerPartie();
      }
    }, DELAI_FIN_AUTO_MS);
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
        equipesAssociees: partie.getEquipes().map((e) => ({ nom: e.nom, photo: e.photo || null })),
        equipeEnAttente: partie.getEquipeEnAttente(),
        photoEnAttente: partie.getPhotoEnAttente(),
      };
    }

    if (partieTerminee) {
      return {
        phasePartie: 'termine',
        titreQuiz: quizCharge ? quizCharge.titre : null,
        classement: classementAvecPhotos(),
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
        photoJoueurQuiRepond: equipeQuiRepond ? equipeQuiRepond.photo || null : null,
        classement: classementAvecPhotos(),
      },
    };
  }

  emetteur.on('buzz', ({ path, horodatage }) => {
    if (partie.getEtat() === 'association') {
      const resultat = partie.tenterAssociation(path);
      if (!resultat) return;

      console.log(`${resultat.nom} associée au buzzer ${path}.`);
      diffuser('equipe-associee', {
        equipes: partie.getEquipes().map((e) => ({ nom: e.nom, photo: e.photo || null })),
      });
      return;
    }

    // Ajout d'une équipe retardataire en cours de partie : entre deux questions,
    // si une équipe a été préparée et qu'un nouveau buzzer (port inconnu) est
    // appuyé, on l'associe et on l'ajoute au jeu avec 0 point.
    if (
      partie.getEtat() === 'prete' &&
      jeu &&
      jeu.getEtat() === 'fermee' &&
      partie.getEquipeEnAttente() &&
      !partie.getEquipes().some((e) => e.port === path)
    ) {
      const nouvelle = partie.tenterAssociation(path);
      if (nouvelle) {
        jeu.ajouterJoueur({ id: nouvelle.id, nom: nouvelle.nom });
        console.log(`${nouvelle.nom} rejoint la partie en cours.`);
        diffuser('equipe-associee', {
          equipes: partie.getEquipes().map((e) => ({ nom: e.nom, photo: e.photo || null })),
        });
        diffuser('classement-maj', { classement: classementAvecPhotos() });
        return;
      }
    }

    if (!jeu) return;

    const equipe = partie.getEquipes().find((e) => e.port === path);
    if (!equipe) return;

    const resultat = jeu.enregistrerBuzz(equipe.id, horodatage);
    if (resultat) {
      console.log(`\n${equipe.nom} a buzzé le premier ! (@ ${horodatage} ms)`);
      diffuser('joueur-repond', { joueur: equipe.nom, photo: equipe.photo || null });
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
      nomEtablissement,
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

  // Démarre une partie et passe en phase d'association : l'animateur ajoutera
  // ensuite les équipes une par une (POST /api/equipe/preparer) puis lancera
  // le jeu (POST /api/partie/lancer).
  route('POST', '/api/partie/demarrer', async (corps, reponse) => {
    quizCharge = null;
    indexQuestionCourante = 0;
    partieTerminee = false;

    if (corps.quizId) {
      try {
        quizCharge = await recupererQuiz(corps.quizId);
        // Le cloud renvoie un champ `ordre` : on s'y fie plutôt qu'à l'ordre
        // du tableau, au cas où il arriverait mélangé.
        if (Array.isArray(quizCharge.questions)) {
          quizCharge.questions.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        }
      } catch (erreur) {
        reponse.writeHead(502, { 'Content-Type': 'application/json' });
        reponse.end(JSON.stringify({ erreur: `Impossible de charger le quiz : ${erreur.message}` }));
        return;
      }
    }

    partie.demarrer();
    jeu = null;
    questionActuelle = '';
    reponseActuelle = '';
    console.log('\nNouvelle partie : ajoute les équipes au fur et à mesure.');
    if (quizCharge) console.log(`Quiz chargé : "${quizCharge.titre}" (${quizCharge.questions.length} question(s)).`);
    diffuser('partie-demarree', {});

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  // Prépare la prochaine équipe (avec son nom) : le prochain buzzer appuyé lui
  // sera affecté.
  route('POST', '/api/equipe/preparer', (corps, reponse) => {
    // Pendant l'association, ou en cours de partie entre deux questions.
    const enAssociation = partie.getEtat() === 'association';
    const enJeuEntreQuestions = partie.getEtat() === 'prete' && jeu && jeu.getEtat() === 'fermee';
    if (!enAssociation && !enJeuEntreQuestions) {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Impossible d\'ajouter une équipe maintenant' }));
      return;
    }

    const nom = String(corps.nom || '').trim() || `Équipe ${partie.getEquipes().length + 1}`;
    // Vignette facultative (data-URL), gardée en mémoire seulement. On plafonne
    // sa taille pour ne pas alourdir le flux SSE.
    let photo = typeof corps.photo === 'string' ? corps.photo : null;
    if (photo && photo.length > 200000) photo = null;
    partie.preparerEquipe(nom, photo);
    console.log(`En attente du buzzer pour « ${nom} »…`);
    diffuser('equipe-attendue', { nom, photo });

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true, nom }));
  });

  // Lance le jeu une fois les équipes ajoutées (au moins une).
  route('POST', '/api/partie/lancer', (corps, reponse) => {
    if (partie.getEtat() !== 'association') {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: "Pas en phase d'association" }));
      return;
    }
    if (partie.getEquipes().length < 1) {
      reponse.writeHead(400, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Ajoute au moins une équipe' }));
      return;
    }

    partie.lancer();
    jeu = creerJeu(partie.getEquipes());
    console.log('\nPartie lancée. Prêt à jouer !');
    diffuser('partie-prete', { equipes: partie.getEquipes().map((e) => e.nom) });

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
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
    partieTerminee = false;
    partie = creerPartie();
    diffuser('partie-arretee', {});

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  // Clôture générique d'une partie : bascule l'écran sur le podium avec le
  // classement final. Volontairement indépendante du mode de jeu — un futur
  // mode se termine en appelant cette même route.
  route('POST', '/api/partie/terminer', (corps, reponse) => {
    if (!jeu || partie.getEtat() !== 'prete') {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Aucune partie en cours à terminer' }));
      return;
    }

    terminerPartie();

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
      diffuser('reponse-correcte', { joueur: equipe.nom, classement: classementAvecPhotos() });
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

    // La question vient de se clore (bonne réponse ou plus personne) : si
    // c'était la dernière du quiz, on enchaîne directement sur le podium.
    if (jeu.getEtat() === 'fermee') {
      terminerSiQuizEpuise();
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

    // Si c'était la dernière question du quiz, on affiche le podium.
    terminerSiQuizEpuise();

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  // Points d'ambiance : l'animateur ajuste manuellement les points d'une équipe
  // (bonne vanne, meilleur nom d'équipe, etc.).
  route('POST', '/api/points', (corps, reponse) => {
    if (!jeu) {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Aucune partie en cours' }));
      return;
    }

    const equipeId = Number(corps.equipeId);
    const delta = Number(corps.delta);
    if (!Number.isInteger(equipeId) || !Number.isInteger(delta)) {
      reponse.writeHead(400, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'equipeId ou delta invalide' }));
      return;
    }

    const equipe = trouverEquipe(equipeId);
    if (!equipe) {
      reponse.writeHead(404, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Équipe introuvable' }));
      return;
    }

    jeu.ajusterPoints(equipeId, delta);
    console.log(`Points d'ambiance : ${equipe.nom} ${delta >= 0 ? '+' : ''}${delta}`);
    diffuser('classement-maj', { classement: classementAvecPhotos() });

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
