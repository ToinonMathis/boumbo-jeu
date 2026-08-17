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
- ✅ Podium de fin de partie : composant réutilisable
  `ecran/src/components/Podium.vue` (révélation des rangs du dernier au 1ᵉʳ),
  déclenché par `POST /api/partie/terminer` — clôture générique, pensée pour
  accueillir de futurs modes de jeu.
- ✅ Écran Vue.js : écran public passif (TV) + télécommande animateur
  mobile (`/animateur`), validés avec un vrai téléphone sur le Wi-Fi local.
  Sons synthétisés (Web Audio) et identité visuelle alignée sur la vitrine.
- ✅ Démarrage unifié : `npm run demo` à la racine build l'écran et lance
  le serveur, qui sert tout (API + SSE + interface) depuis un seul port.
- ✅ Vitrine en ligne sur GitHub Pages (dépôt `boumbo` rendu public).
- ✅ `boumbo-cloud` : backend Express/PostgreSQL déployé sur Railway,
  Supabase Auth intégré, dashboard Vue.js avec gestion de quiz (CRUD) pour
  les gérants.
- ✅ Pont contenu cloud → jeu local : l'animateur peut lancer une partie sur
  un quiz préparé dans le dashboard (liste + chargement via `serveur/cloud.js`).
  Cache local des quiz (`serveur/.cache-quiz/`, non versionné) : la soirée
  reste jouable même si le Wi-Fi du lieu tombe. Vérifié contre le cloud de prod.
- ⏳ Onboarding réel des gérants (actuellement manuel via script/migration).
- ⏳ Facturation (Stripe) : volontairement hors MVP.

## Pistes de valeur SaaS (futur)
Idées pour justifier l'abonnement récurrent (la valeur qui « revient chaque
mois »), à creuser plus tard :
- **Bibliothèque de contenu qui ne s'épuise jamais** : packs de quiz / blind
  tests prêts à l'emploi, renouvelés régulièrement (thèmes, saisons, décennies)
  pour que le gérant ait toujours une soirée prête sans rien écrire. Débloqué
  par le pont contenu cloud → jeu local (voir ⏳ ci-dessus).
- **Classements persistants** : garder les scores d'une soirée à l'autre
  (championnat du mois, ligue, équipes qui se recréent) pour faire revenir les
  habitués — ce que le hardware seul ne sait pas faire.
- **Aide à remplir la salle, via les stats** : stats actionnables pour le
  gérant (soirées qui remplissent, thèmes qui marchent, participation) et
  supports de promo (affiches / posts auto) pour attirer du monde les soirs
  creux.
- **Générateur de quiz par IA** (reporté — décision de ne pas augmenter les
  coûts au début) : le gérant décrit un thème, un LLM produit un quiz prêt à
  jouer. Coût ~centimes/quiz, amortissable en générant la bibliothèque en
  central et via le partage (générer une fois → réutilisé par tous, voir le
  système public/privé déjà en place). À reprendre pour accélérer le
  remplissage de la bibliothèque quand le budget le permettra.

## Cible hardware V1 (buzzers sans-fil)
Aujourd'hui les buzzers sont des cartes **Arduino / Elegoo Uno R3 câblées en
USB** (firmware de test dans `firmware/`). Cible pour un vrai déploiement en bar :
- **Microcontrôleur** : passer à un **ESP32-C3** (radio + batterie + basse
  conso, compatible Arduino). L'Uno R3 n'a ni radio ni gestion batterie.
- **Sans-fil** : buzzers en **ESP-NOW** vers un **ESP32 récepteur branché en
  USB** sur la Pi, qui ré-émet les lignes `BUZZ @ ... ms` sur le port série.
  Le serveur (`serveur/buzzers.js`) reste alors quasi inchangé.
- **Boîtier** : bouton arcade robuste, coque solide, LiPo + charge USB-C, deep
  sleep réveillé par le bouton.
- ⚠️ **Changement de logique à prévoir avec le sans-fil** : aujourd'hui le
  gagnant est décidé par l'**ordre d'arrivée au serveur** (OK en USB, latence
  ~nulle). En radio la latence est variable → il faut raisonner en **temps de
  réaction** : le récepteur diffuse « question ouverte » à tous les buzzers,
  chaque buzzer mesure le délai `appui − ouverture` **à bord**, et le serveur
  attend une courte fenêtre (~150 ms) puis retient le plus petit délai. C'est
  ce qui rend enfin *vrai* le principe « horodaté à la source » (voir en-tête).