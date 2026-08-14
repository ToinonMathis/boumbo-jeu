# serveur

L'« arbitre » Boumbo : détecte automatiquement les buzzers branchés en USB
(même branchés après le démarrage), porte la logique de jeu (association
équipe/buzzer, questions, classement), diffuse l'état de la partie via
Server-Sent Events, et sert l'écran (`../ecran/dist`) directement — un seul
process pour tout.

## Installation

```bash
npm install
```

## Lancement

Depuis la racine du dépôt, `npm run demo` build l'écran et lance ce serveur
en une commande (voir le README racine). Pour lancer uniquement le serveur
(l'écran étant déjà construit) :

```bash
npm start
```

Le terminal affiche l'URL de l'écran (à mettre sur la TV) et celle de la
télécommande animateur (pour un téléphone sur le même Wi-Fi). Si le
Moniteur série de l'IDE Arduino est ouvert, ferme-le d'abord — un seul
programme peut lire un port série à la fois.

## Déroulé d'une partie

Tout se pilote depuis la télécommande animateur (`/animateur`), pas depuis
ce terminal : lancer la partie (nombre d'équipes), chaque équipe appuie une
fois sur son buzzer pour s'associer (pas besoin de connaître le port
série), puis ouvrir/valider/passer les questions, et arrêter la partie à
tout moment.

## Fichiers

- `buzzers.js` — détection continue des ports série (scan toutes les 2s),
  ouverture automatique de tout nouveau buzzer branché.
- `partie.js` — association équipe ↔ port, avant que le jeu ne commence.
- `jeu.js` — logique pure d'une partie déjà démarrée (questions, classement).
- `diffusion.js` — serveur HTTP : flux SSE (`/evenements`), routes API, et
  repli vers `fichiers-statiques.js` pour tout le reste.
- `fichiers-statiques.js` — sert le build de l'écran (`ecran/dist`).
- `index.js` — orchestre le tout.

## Routes API

- `GET /api/etat` — snapshot complet (phase de la partie, état du jeu,
  classement), utilisé pour resynchroniser l'écran/la télécommande à
  l'ouverture ou après une reconnexion.
- `POST /api/partie/demarrer` `{ nombreEquipes }`
- `POST /api/partie/arreter`
- `POST /api/question/ouvrir` `{ texte }`
- `POST /api/reponse` `{ correcte }`
- `POST /api/question/passer`
