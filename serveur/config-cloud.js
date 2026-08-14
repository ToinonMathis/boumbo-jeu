// Identifie cet établissement auprès du backend cloud (boumbo-cloud) pour
// récupérer ses quiz préparés à l'avance. À adapter par établissement :
// change CLE_API pour la vraie clé fournie lors de l'onboarding, ou passe-la
// en variable d'environnement (CLE_API=... npm start) sans toucher au code.
module.exports = {
  URL_CLOUD: process.env.URL_CLOUD || 'https://backend-production-ae984.up.railway.app',
  CLE_API: process.env.CLE_API || 'demo-cle-api-test',
};
