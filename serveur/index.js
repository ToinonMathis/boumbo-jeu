const os = require('os');
const path = require('path');
const { creerJeu } = require('./jeu');
const { creerPartie } = require('./partie');
const { creerDiffuseur } = require('./diffusion');
const { detecterEtOuvrirBuzzers } = require('./buzzers');
const { recupererQuizDisponibles, recupererQuiz, enregistrerSoiree, recupererEtablissement } = require('./cloud');
const { creerMiniJeuJauge } = require('./minijeu-jauge');
const { creerMiniJeuFunambule } = require('./minijeu-funambule');
const { creerMiniJeuFeu } = require('./minijeu-feu');
const { creerMiniJeuCompteARebours } = require('./minijeu-compte-a-rebours');
const { tirerCarte, CASES_ETOILES_VOLEES, CASES_RECUL } = require('./cartes-mystere');

// Registre des mini-jeux de précision/timing disponibles : chaque fabrique
// prend la liste des équipes et renvoie { enregistrerBuzz, getClassement,
// aBuzze, getParamsAffichage } — même interface, habillage/mécanique propres
// à chacun. Ajouter un nouveau mini-jeu = une entrée ici + un composant écran.
const FABRIQUES_MINIJEUX = {
  jauge: creerMiniJeuJauge,
  funambule: creerMiniJeuFunambule,
  feu: creerMiniJeuFeu,
  'compte-a-rebours': creerMiniJeuCompteARebours,
};

const PORT_ECRAN = process.env.PORT_ECRAN || 3001;
const DOSSIER_ECRAN = path.join(__dirname, '../ecran/dist');

// "Chemin des étoiles" : le classement devient une position sur un chemin
// plutôt qu'un score — une bonne réponse fait avancer de GAIN_QUESTION cases,
// la partie se termine dès qu'une équipe atteint LONGUEUR_CHEMIN.
const LONGUEUR_CHEMIN = 15;
const GAIN_QUESTION_CHEMIN = 2;
// Cases du chemin qui déclenchent le tirage d'une carte mystère en les
// franchissant (pas besoin de tomber exactement dessus — les gains varient
// selon les mini-jeux et les cartes elles-mêmes).
const CASES_MYSTERE = [4, 8, 12];

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
  let mode = 'quiz'; // 'quiz' | 'chemin'
  let questionActuelle = '';
  let reponseActuelle = '';
  let quizCharge = null;
  let indexQuestionCourante = 0;
  // Mini-jeu de précision/timing en cours (ex: jauge), indépendant du cycle de
  // questions classique. Un seul à la fois, lancé entre deux questions.
  let miniJeu = null;
  let miniJeuType = null;
  // Cartes mystère du chemin des étoiles : équipes bâillonnées (buzz ignoré la
  // prochaine fois qu'elles tentent), et effet en attente d'être consommé par
  // équipe ('double' | 'joker' | 'vol') dès qu'elle buzze avec succès.
  let equipesBaillonnees = new Set();
  let effetsEnAttente = new Map(); // equipeId -> 'double' | 'joker' | 'vol'
  let effetEnCoursDeReponse = null; // { equipeId, effet } pour la réponse en cours
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

  // Clôture le mini-jeu en cours : attribue des points d'ambiance selon la
  // précision de chaque équipe qui a tenté sa chance (0 à 3 points, celles qui
  // n'ont pas buzzé n'en reçoivent simplement pas — jamais de pénalité).
  function terminerMiniJeu() {
    const pointsAvantParId = new Map(jeu.getClassement().map((e) => [e.id, e.points]));
    const resultat = miniJeu.getClassement().map(({ id, precision }) => {
      const equipe = trouverEquipe(id);
      const points = Math.round(precision * 3);
      jeu.ajusterPoints(id, points);
      return { nom: equipe.nom, precision, points };
    });

    miniJeu = null;
    miniJeuType = null;
    console.log('Mini-jeu terminé :', resultat.map((r) => `${r.nom} (+${r.points})`).join(', ') || 'personne n\'a buzzé');
    diffuser('minijeu-termine', { resultat });
    diffuser('classement-maj', { classement: classementAvecPhotos() });
    verifierVictoireChemin();

    if (mode === 'chemin' && !partieTerminee) {
      jeu.getClassement().forEach((e) => verifierCaseMystere(e.id, pointsAvantParId.get(e.id) ?? 0, e.points));
    }
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

  // "Chemin des étoiles" : dès qu'une équipe atteint le bout du chemin (à
  // vérifier après toute variation de points, question ou mini-jeu), la
  // partie se termine immédiatement et bascule sur le podium.
  function verifierVictoireChemin() {
    if (mode !== 'chemin' || partieTerminee) return;
    if (jeu.getClassement().some((e) => e.points >= LONGUEUR_CHEMIN)) {
      terminerPartie();
    }
  }

  // Cible d'une carte malus : l'équipe en tête, sauf si l'équipe qui vient de
  // tirer est seule en jeu (dans ce cas elle est sa propre cible, faute de
  // mieux — cas rare, seulement en test à une équipe).
  function trouverCibleMalus(equipeIdTireur) {
    const classement = jeu.getClassement();
    return classement.find((e) => e.id !== equipeIdTireur) || classement[0];
  }

  // Équipe juste devant `equipeId` sur le chemin (la case du dessus dans le
  // classement trié) — utilisée par l'effet "Téléportation". `null` si
  // l'équipe est déjà en tête ou introuvable.
  function trouverEquipeDevant(equipeId) {
    const classement = jeu.getClassement();
    const index = classement.findIndex((e) => e.id === equipeId);
    if (index <= 0) return null;
    return classement[index - 1];
  }

  // Applique l'effet d'une carte mystère tirée par `equipeIdTireur` :
  // - les malus (bâillon, recul, silence radio) ciblent immédiatement l'équipe
  //   en tête ;
  // - les bonus à effet différé (double avance, joker, vol d'étoiles)
  //   attendent le prochain buzz réussi de l'équipe qui a tiré, consommé dans
  //   le gestionnaire de buzz puis dans /api/reponse ;
  // - la téléportation est immédiate.
  // Renvoie { tireur, cible } (noms d'équipe) pour l'annonce diffusée.
  function appliquerCarte(carte, equipeIdTireur) {
    const tireur = trouverEquipe(equipeIdTireur);
    let cible = null;

    switch (carte.cle) {
      case 'baillon': {
        cible = trouverCibleMalus(equipeIdTireur);
        equipesBaillonnees.add(cible.id);
        break;
      }
      case 'silence-radio': {
        // Purement social : rien à appliquer côté serveur, l'animateur lit la
        // consigne à voix haute depuis l'annonce affichée sur sa télécommande.
        cible = trouverCibleMalus(equipeIdTireur);
        break;
      }
      case 'recul': {
        cible = trouverCibleMalus(equipeIdTireur);
        jeu.ajusterPoints(cible.id, -CASES_RECUL);
        break;
      }
      case 'double-avance':
        effetsEnAttente.set(equipeIdTireur, 'double');
        cible = tireur;
        break;
      case 'joker':
        effetsEnAttente.set(equipeIdTireur, 'joker');
        cible = tireur;
        break;
      case 'vol-etoiles':
        effetsEnAttente.set(equipeIdTireur, 'vol');
        cible = tireur;
        break;
      case 'teleportation': {
        const devant = trouverEquipeDevant(equipeIdTireur);
        if (devant) {
          const pointsTireur = jeu.getClassement().find((e) => e.id === equipeIdTireur).points;
          const pointsDevant = devant.points;
          jeu.ajusterPoints(devant.id, pointsTireur - pointsDevant);
          jeu.ajusterPoints(equipeIdTireur, pointsDevant - pointsTireur);
          cible = devant;
        } else {
          cible = tireur;
        }
        break;
      }
      default:
        break;
    }

    return { tireur: tireur.nom, cible: cible ? cible.nom : null };
  }

  // Cartes mystère du chemin des étoiles : à appeler après toute progression
  // de points d'une équipe en mode chemin. Si elle vient de franchir une case
  // spéciale (`CASES_MYSTERE`), tire une carte et l'applique aussitôt. Le
  // test "franchit" (et non "tombe pile dessus") tolère les gains variables
  // (question à 2 points, mini-jeu, vol d'étoiles...).
  function verifierCaseMystere(equipeId, pointsAvant, pointsApres) {
    if (mode !== 'chemin' || partieTerminee) return;
    const caseFranchie = CASES_MYSTERE.find((c) => pointsAvant < c && c <= pointsApres);
    if (caseFranchie === undefined) return;

    const carte = tirerCarte();
    const { tireur, cible } = appliquerCarte(carte, equipeId);
    console.log(`Carte mystère (case ${caseFranchie}) : ${tireur} tire "${carte.libelle}"${cible ? ` → ${cible}` : ''}.`);
    diffuser('carte-mystere', { ...carte, tireur, cible });
    diffuser('classement-maj', { classement: classementAvecPhotos() });
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
        mode,
        longueurChemin: mode === 'chemin' ? LONGUEUR_CHEMIN : null,
        questionActuelle,
        reponseActuelle,
        titreQuiz: quizCharge ? quizCharge.titre : null,
        prochaineQuestion: jeu.getEtat() === 'fermee' ? prochaineQuestionDuQuiz() : null,
        joueurQuiRepond: equipeQuiRepond ? equipeQuiRepond.nom : null,
        photoJoueurQuiRepond: equipeQuiRepond ? equipeQuiRepond.photo || null : null,
        classement: classementAvecPhotos(),
      },
      miniJeuActif: miniJeu
        ? {
            type: miniJeuType,
            params: miniJeu.getParamsAffichage(),
            equipesAyantBuzze: partie.getEquipes().filter((e) => miniJeu.aBuzze(e.id)).map((e) => e.nom),
          }
        : null,
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

    // Mini-jeu de précision en cours : le buzz sert à tenter sa chance, pas à
    // répondre à une question — routé ici plutôt que vers la logique de jeu
    // classique tant que le mini-jeu est actif.
    if (miniJeu) {
      const equipe = partie.getEquipes().find((e) => e.port === path);
      if (!equipe) return;

      const resultat = miniJeu.enregistrerBuzz(equipe.id);
      if (!resultat) return; // cette équipe a déjà tenté sa chance

      console.log(`${equipe.nom} a buzzé pour le mini-jeu (précision ${(resultat.precision * 100).toFixed(0)}%).`);
      // On diffuse tout le résultat (position, fauxDepart, ecartMs...), les
      // champs varient selon le mini-jeu — le composant écran ne lit que ceux
      // qui le concernent.
      diffuser('minijeu-equipe-a-buzze', { nom: equipe.nom, ...resultat });

      if (resultat.complet) terminerMiniJeu();
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

    // Bâillon (carte mystère) : le buzz est ignoré comme si l'équipe n'avait
    // pas appuyé, une seule fois — consommé dès la première tentative.
    if (equipesBaillonnees.has(equipe.id)) {
      equipesBaillonnees.delete(equipe.id);
      console.log(`${equipe.nom} tente de buzzer mais son bâillon l'en empêche.`);
      return;
    }

    const resultat = jeu.enregistrerBuzz(equipe.id, horodatage);
    if (resultat) {
      console.log(`\n${equipe.nom} a buzzé le premier ! (@ ${horodatage} ms)`);
      // Effet en attente (Double avance / Joker / Vol d'étoiles) : consommé
      // dès que le buzz est pris en compte, avant même de connaître la
      // réponse — /api/reponse l'appliquera au bon moment.
      if (effetsEnAttente.has(equipe.id)) {
        effetEnCoursDeReponse = { equipeId: equipe.id, effet: effetsEnAttente.get(equipe.id) };
        effetsEnAttente.delete(equipe.id);
      }
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
    mode = corps.mode === 'chemin' ? 'chemin' : 'quiz';
    equipesBaillonnees = new Set();
    effetsEnAttente = new Map();
    effetEnCoursDeReponse = null;

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
    mode = 'quiz';
    questionActuelle = '';
    reponseActuelle = '';
    quizCharge = null;
    indexQuestionCourante = 0;
    partieTerminee = false;
    equipesBaillonnees = new Set();
    effetsEnAttente = new Map();
    effetEnCoursDeReponse = null;
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

    // Effet en attente (Double avance / Joker / Vol d'étoiles) consommé au
    // buzz : ne s'applique que si c'est bien la même équipe qui répond
    // maintenant (elle ne peut pas avoir changé entre les deux).
    const joueurQuiRepondAvant = jeu.getJoueurQuiRepond();
    const effet = effetEnCoursDeReponse && effetEnCoursDeReponse.equipeId === joueurQuiRepondAvant
      ? effetEnCoursDeReponse.effet
      : null;
    effetEnCoursDeReponse = null;

    const estCorrecte = Boolean(corps.correcte);
    const pointsAvant = mode === 'chemin'
      ? jeu.getClassement().find((e) => e.id === joueurQuiRepondAvant).points
      : 0;

    let gain = mode === 'chemin' ? GAIN_QUESTION_CHEMIN : 1;
    if (estCorrecte && effet === 'double') gain *= 2;
    // "Vol d'étoiles" remplace le gain normal par un vol à l'équipe en tête,
    // appliqué manuellement une fois la réponse validée comme correcte.
    if (estCorrecte && effet === 'vol') gain = 0;

    const resultat = jeu.validerReponse(estCorrecte, gain);
    const equipe = trouverEquipe(resultat.joueurId);

    if (resultat.resultat === 'correct') {
      if (effet === 'vol') {
        const cible = trouverCibleMalus(equipe.id);
        jeu.ajusterPoints(cible.id, -CASES_ETOILES_VOLEES);
        jeu.ajusterPoints(equipe.id, CASES_ETOILES_VOLEES);
        console.log(`${equipe.nom} vole ${CASES_ETOILES_VOLEES} étoiles à ${cible.nom} !`);
      }
      console.log(`Bonne réponse de ${equipe.nom} !`);
      afficherClassement();
      diffuser('reponse-correcte', { joueur: equipe.nom, classement: classementAvecPhotos() });
      questionActuelle = '';
      reponseActuelle = '';
      verifierVictoireChemin();
      if (mode === 'chemin' && !partieTerminee) {
        const pointsApres = jeu.getClassement().find((e) => e.id === equipe.id).points;
        verifierCaseMystere(equipe.id, pointsAvant, pointsApres);
      }
    } else {
      // Joker : annule l'élimination avant de savoir si la question doit se
      // refermer — peut donc la rouvrir même si c'était le dernier joueur en
      // course (`jeu.getEtat()` ci-dessous reflète cet éventuel repêchage).
      if (effet === 'joker') jeu.annulerElimination(equipe.id);

      if (jeu.getEtat() === 'fermee') {
        console.log(`Mauvaise réponse de ${equipe.nom}. Plus personne ne peut buzzer, passe à la question suivante.`);
        diffuser('question-terminee', { resultat: 'personne' });
        questionActuelle = '';
        reponseActuelle = '';
      } else {
        console.log(`Mauvaise réponse de ${equipe.nom}, son buzzer est désactivé pour cette question. À vos buzzers !`);
        diffuser('reponse-incorrecte', { joueur: equipe.nom });
      }
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
    verifierVictoireChemin();

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  // Lance un mini-jeu de précision/timing entre deux questions. `type` doit
  // correspondre à une clé de FABRIQUES_MINIJEUX, sinon repli sur 'jauge'.
  route('POST', '/api/minijeu/lancer', (corps, reponse) => {
    if (!jeu || jeu.getEtat() !== 'fermee') {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Impossible de lancer un mini-jeu maintenant' }));
      return;
    }

    miniJeuType = FABRIQUES_MINIJEUX[corps.type] ? corps.type : 'jauge';
    miniJeu = FABRIQUES_MINIJEUX[miniJeuType](partie.getEquipes());
    console.log(`\nMini-jeu lancé : ${miniJeuType}.`);
    diffuser('minijeu-demarre', { type: miniJeuType, params: miniJeu.getParamsAffichage() });

    reponse.writeHead(200, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ ok: true }));
  });

  // Clôture anticipée par l'animateur (ex: une équipe ne buzze jamais) — les
  // équipes qui n'ont pas tenté leur chance ne reçoivent simplement rien.
  route('POST', '/api/minijeu/terminer', (corps, reponse) => {
    if (!miniJeu) {
      reponse.writeHead(409, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: 'Aucun mini-jeu en cours' }));
      return;
    }

    terminerMiniJeu();

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
