const fs = require('fs/promises');
const path = require('path');
const { URL_CLOUD, CLE_API } = require('./config-cloud');

// Cache local des quiz sur la machine qui fait tourner le jeu (la Pi au bar).
// Le cloud reste la source de vérité tant qu'il répond ; le cache n'est qu'un
// filet de secours pour que la soirée puisse se jouer même si le wifi du lieu
// tombe. Une fois un quiz chargé en mémoire, la partie se joue de toute façon
// en local — le cache ne sert qu'aux deux moments où l'on parle au cloud :
// lister les quiz, puis en charger un au lancement.
const DOSSIER_CACHE = path.join(__dirname, '.cache-quiz');

async function ecrireCache(nom, donnees) {
  try {
    await fs.mkdir(DOSSIER_CACHE, { recursive: true });
    await fs.writeFile(path.join(DOSSIER_CACHE, nom), JSON.stringify(donnees));
  } catch {
    // Un cache non écrit n'est pas bloquant : la donnée est déjà en mémoire.
  }
}

async function lireCache(nom) {
  try {
    return JSON.parse(await fs.readFile(path.join(DOSSIER_CACHE, nom), 'utf8'));
  } catch {
    return null;
  }
}

async function appelCloud(chemin) {
  const reponse = await fetch(`${URL_CLOUD}${chemin}`, {
    headers: { 'x-cle-api': CLE_API },
  });

  if (!reponse.ok) {
    throw new Error(`Le cloud a répondu ${reponse.status}`);
  }

  return reponse.json();
}

// Télécharge le contenu complet d'un quiz et le met en cache, sans jamais
// faire échouer l'appelant (pré-chargement « au mieux »).
async function precacherQuiz(id) {
  try {
    await ecrireCache(`quiz-${id}.json`, await appelCloud(`/api/quiz/${id}`));
  } catch {
    // Tant pis pour celui-là : il sera rechargé au lancement si le cloud revient.
  }
}

async function recupererQuizDisponibles() {
  try {
    const liste = await appelCloud('/api/quiz');
    await ecrireCache('liste.json', liste);
    // Pré-charge chaque quiz listé pendant qu'on est en ligne, pour qu'il
    // reste jouable même si le réseau tombe avant le lancement.
    await Promise.all(liste.map((quiz) => precacherQuiz(quiz.id)));
    return liste;
  } catch (erreur) {
    const cache = await lireCache('liste.json');
    if (cache) {
      console.log(`Cloud injoignable (${erreur.message}) — liste des quiz servie depuis le cache local.`);
      return cache;
    }
    throw erreur;
  }
}

async function recupererQuiz(id) {
  try {
    const quiz = await appelCloud(`/api/quiz/${id}`);
    await ecrireCache(`quiz-${id}.json`, quiz);
    return quiz;
  } catch (erreur) {
    const cache = await lireCache(`quiz-${id}.json`);
    if (cache) {
      console.log(`Cloud injoignable (${erreur.message}) — quiz "${cache.titre}" servi depuis le cache local.`);
      return cache;
    }
    throw erreur;
  }
}

// Récupère le nom de l'établissement (mis en cache pour rester dispo hors-ligne).
async function recupererEtablissement() {
  try {
    const etab = await appelCloud('/api/etablissement');
    await ecrireCache('etablissement.json', etab);
    return etab;
  } catch (erreur) {
    const cache = await lireCache('etablissement.json');
    if (cache) return cache;
    throw erreur;
  }
}

async function appelCloudPost(chemin, corps) {
  const reponse = await fetch(`${URL_CLOUD}${chemin}`, {
    method: 'POST',
    headers: { 'x-cle-api': CLE_API, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });

  if (!reponse.ok) {
    throw new Error(`Le cloud a répondu ${reponse.status}`);
  }

  return reponse.json();
}

// Enregistre une soirée jouée (quiz + classement final des équipes) auprès du
// cloud, pour alimenter les stats et classements du dashboard. L'appelant
// l'utilise en « best-effort » : un échec (hors-ligne) ne doit pas gêner le jeu.
async function enregistrerSoiree(quizId, classement, mode) {
  const soiree = await appelCloudPost('/api/soirees', { quizId: quizId || null, mode });
  await appelCloudPost(`/api/soirees/${soiree.id}/resultats`, {
    classement: classement.map((equipe) => ({ nomJoueur: equipe.nom, points: equipe.points })),
  });
  return soiree;
}

module.exports = { recupererQuizDisponibles, recupererQuiz, enregistrerSoiree, recupererEtablissement };
