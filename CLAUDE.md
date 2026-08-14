# Boumbo

## Le produit
Boumbo est un système de **buzzers sans fil clé en main** pour animer les
soirées quiz et blind test. Cible : bars, brasseries, campings et villages
vacances. Promesse : remplir les soirées creuses, faire revenir les habitués,
sans avoir à payer un animateur ni comprendre du matériel compliqué.
On allume, on lance une partie en deux minutes, ça buzz.

Ambition à moyen terme : un vrai **SaaS multi-établissements** (comptes,
contenu de quiz, statistiques par établissement), pas seulement un outil
local pour une soirée. Le serveur qui pilote les buzzers doit toutefois
rester local (lecture de port série impossible depuis le cloud) : voir
`## Dépôts Git` pour le découpage local/cloud.

Argument technique clé : **chaque appui est horodaté à la source (sur le
buzzer), au millième de seconde**. C'est le réflexe du joueur qui décide,
jamais la latence réseau. Ce principe doit être préservé dans toute évolution
de la logique de jeu.

## Architecture (3 briques)
Le produit se décompose en trois parties qui évoluent ensemble :

- `firmware/` — code Arduino / ESP32 du buzzer. C'est lui qui détecte l'appui
  et émet l'horodatage. Émet des lignes série commençant par `BUZZ` (ex :
  `BUZZ @ 12345 ms`) et des messages d'info au démarrage
  (`Boumbo pret. Appuie sur le bouton...`).
- `serveur/` — l'« arbitre » en Node.js. Détecte automatiquement les
  buzzers branchés en USB (même après coup), porte la logique de jeu
  (association équipe/buzzer, questions, classement), et sert aussi le
  build de l'écran directement (un seul process, un seul port).
- `ecran/` — l'interface, en local au bar/camping. Vue.js + Vue Router,
  deux pages : `/` (écran public passif, pour la TV) et `/animateur`
  (télécommande mobile, c'est elle qui pilote tout). Connecté au `serveur/`
  local via SSE + API HTTP, jamais au cloud.

À part ces 3 briques locales, un backend cloud existe dans un dépôt séparé
(`boumbo-cloud`) pour la partie SaaS : comptes, contenu de quiz, stats. Voir
`## Dépôts Git`.

## Stack technique
- Firmware : Arduino / ESP32 (fichier `.ino`), communication série.
- Serveur : Node.js, lecture du port série via `serialport`
  (parser sur l'événement `data`, filtrage des lignes `BUZZ`).
- Écran : Vue.js + Vue Router (app locale, sans lien direct avec le cloud).
- Vitrine : site statique **HTML / CSS / JS pur**, sans build ni dépendance
  (`boumbo.html`). S'ouvre directement dans un navigateur.
- Cloud (`boumbo-cloud`) : backend Node.js/Express + PostgreSQL, hébergé sur
  Railway. Authentification via Supabase Auth (profil applicatif stocké côté
  Railway). Dashboard en Vue.js (gérants d'établissement + super-admin).

## Dépôts Git
Le projet est réparti en **trois dépôts** (compte GitHub : `ToinonMathis`) :
- `boumbo` — le site vitrine (landing page statique).
- `boumbo-jeu` — le jeu local (firmware + serveur + écran), tourne au bar,
  branché aux buzzers en USB.
- `boumbo-cloud` — le SaaS (backend API + dashboard), déployé sur Railway.
  Ne gère jamais directement les buzzers.

## Vraie règle du jeu
Le premier à buzzer répond **à l'oral**, pas à l'écrit. L'animateur (depuis
sa télécommande) valide : bonne réponse → point et question suivante ;
mauvaise réponse → le buzzer de cette équipe est désactivé pour cette
question, les autres peuvent retenter ; l'animateur peut passer la question
à tout moment. Ce n'est donc jamais un simple "premier arrivé, premier
servi" — voir `serveur/jeu.js` pour la machine à états.

## Contraintes métier / pièges connus
- Communication série : **un seul programme peut lire le port à la fois.**
  Fermer le Moniteur série de l'IDE Arduino avant de lancer `node`, sinon
  erreur « port occupé / access denied ».
- Ne jamais déplacer l'horodatage vers le serveur : il doit rester dans le
  firmware pour garantir l'équité.
- Ne jamais coder en dur un nom de port série (`/dev/cu.usbmodemXXXX`) : il
  change à chaque rebranchement. Le serveur détecte les buzzers tout seul
  (`serveur/buzzers.js`).
- Toute action qui doit se refléter sur un **autre appareil** que celui qui
  l'a déclenchée (ex : la télécommande d'un côté, l'écran TV de l'autre)
  doit passer par un événement SSE diffusé (`diffuser(...)`), jamais
  seulement par la réponse HTTP directe — sinon seul l'appareil qui a agi
  voit le changement.
- Ne jamais coder en dur `localhost` comme adresse du serveur côté écran :
  depuis un téléphone, "localhost" désigne le téléphone. Utiliser
  `window.location.hostname` (déjà fait dans `ecran/src/composables/useJeu.js`).

## Conventions
- Langue de travail : **français** (réponses, commentaires, commits).
- Vitrine : rester en HTML/CSS/JS statique, pas de framework ni de build.
- Environnement de dev : macOS (Apple Silicon), Node via Homebrew.

## État d'avancement
- ✅ Pont Arduino ↔ Node.js fonctionnel, détection dynamique des buzzers
  (branchement à chaud compris, plus de port codé en dur).
- ✅ Vraie logique de jeu (question/réponse orale, buzzer désactivé sur
  mauvaise réponse, skip) testée avec du vrai matériel.
- ✅ Écran Vue.js : écran public passif (TV) + télécommande animateur
  mobile (`/animateur`), validés avec un vrai téléphone sur le Wi-Fi local.
  Sons synthétisés (Web Audio) et identité visuelle alignée sur la vitrine.
- ✅ Démarrage unifié : `npm run demo` à la racine build l'écran et lance
  le serveur, qui sert tout (API + SSE + interface) depuis un seul port.
- ✅ Vitrine en ligne sur GitHub Pages (dépôt `boumbo` rendu public).
- ✅ `boumbo-cloud` : backend Express/PostgreSQL déployé sur Railway,
  Supabase Auth intégré, dashboard Vue.js avec gestion de quiz (CRUD) pour
  les gérants.
- ⏳ Pont entre le contenu cloud (quiz préparés dans le dashboard) et le
  jeu local (aujourd'hui les questions sont tapées à la volée par
  l'animateur, pas encore chargées depuis un quiz existant).
- ⏳ Onboarding réel des gérants (actuellement manuel via script/migration).
- ⏳ Facturation (Stripe) : volontairement hors MVP.