const fs = require('fs');
const path = require('path');

const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Sert le build de l'écran (ecran/dist) directement depuis le serveur Node :
// un seul process à lancer pour tout avoir (API + SSE + interface), plus
// besoin d'un serveur de dev Vite séparé pour une démo ou une vraie soirée.
function creerServeurStatique(dossierRacine) {
  function servir(requete, reponse) {
    const cheminDemande = decodeURIComponent(requete.url.split('?')[0]);
    const cheminSecurise = path.normalize(cheminDemande).replace(/^(\.\.[/\\])+/, '');
    let cheminFichier = path.join(dossierRacine, cheminSecurise);

    if (!fs.existsSync(cheminFichier) || fs.statSync(cheminFichier).isDirectory()) {
      // Repli SPA : une route inconnue du serveur de fichiers (ex: /animateur)
      // sert index.html, le routage se fait ensuite côté client (Vue Router).
      cheminFichier = path.join(dossierRacine, 'index.html');
    }

    if (!fs.existsSync(cheminFichier)) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      reponse.end("Écran non construit : lance `npm run build` dans ecran/.");
      return;
    }

    const extension = path.extname(cheminFichier);
    reponse.writeHead(200, { 'Content-Type': TYPES_MIME[extension] || 'application/octet-stream' });
    fs.createReadStream(cheminFichier).pipe(reponse);
  }

  return { servir };
}

module.exports = { creerServeurStatique };
