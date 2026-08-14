const { URL_CLOUD, CLE_API } = require('./config-cloud');

async function appelCloud(chemin) {
  const reponse = await fetch(`${URL_CLOUD}${chemin}`, {
    headers: { 'x-cle-api': CLE_API },
  });

  if (!reponse.ok) {
    throw new Error(`Le cloud a répondu ${reponse.status}`);
  }

  return reponse.json();
}

function recupererQuizDisponibles() {
  return appelCloud('/api/quiz');
}

function recupererQuiz(id) {
  return appelCloud(`/api/quiz/${id}`);
}

module.exports = { recupererQuizDisponibles, recupererQuiz };
