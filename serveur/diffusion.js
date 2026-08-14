const http = require('http');
const { creerServeurStatique } = require('./fichiers-statiques');

// Diffuse les événements de jeu à l'écran via Server-Sent Events, sert les
// routes API dont l'écran a besoin, et sert aussi le build de l'écran
// lui-même (fichiers-statiques.js) : un seul process pour tout, aucune
// dépendance externe.
function creerDiffuseur(dossierEcran) {
  const clients = new Set();
  const routes = new Map(); // 'METHODE chemin' -> (corps, reponse) => void
  const fichiersStatiques = dossierEcran ? creerServeurStatique(dossierEcran) : null;

  function lireCorpsJSON(requete) {
    return new Promise((resolve, reject) => {
      let corps = '';
      requete.on('data', (chunk) => {
        corps += chunk;
      });
      requete.on('end', () => {
        try {
          resolve(corps ? JSON.parse(corps) : {});
        } catch (erreur) {
          reject(erreur);
        }
      });
    });
  }

  const serveur = http.createServer(async (requete, reponse) => {
    reponse.setHeader('Access-Control-Allow-Origin', '*');
    reponse.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    reponse.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    if (requete.method === 'OPTIONS') {
      reponse.writeHead(204);
      reponse.end();
      return;
    }

    if (requete.method === 'GET' && requete.url === '/evenements') {
      reponse.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      reponse.write('\n');
      clients.add(reponse);
      requete.on('close', () => clients.delete(reponse));
      return;
    }

    const gestionnaire = routes.get(`${requete.method} ${requete.url}`);
    if (!gestionnaire) {
      if (requete.method === 'GET' && fichiersStatiques) {
        fichiersStatiques.servir(requete, reponse);
        return;
      }
      reponse.writeHead(404);
      reponse.end();
      return;
    }

    try {
      const corps = await lireCorpsJSON(requete);
      await gestionnaire(corps, reponse);
    } catch (erreur) {
      reponse.writeHead(400, { 'Content-Type': 'application/json' });
      reponse.end(JSON.stringify({ erreur: erreur.message }));
    }
  });

  function diffuser(evenement, donnees) {
    const message = `event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`;
    for (const client of clients) {
      client.write(message);
    }
  }

  function route(methode, chemin, gestionnaire) {
    routes.set(`${methode} ${chemin}`, gestionnaire);
  }

  return { serveur, diffuser, route };
}

module.exports = { creerDiffuseur };
