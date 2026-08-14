# ecran

Interface de jeu, en local au bar/camping. Vue.js (Vite, sans TypeScript) +
Vue Router, connectée au `serveur/` local — jamais au cloud, pour ne jamais
dépendre de la latence internet pendant une soirée.

Deux pages, deux publics :

- `/` — **écran public** (à mettre sur la TV). Purement passif : affiche le
  jeu, joue les sons, aucun contrôle.
- `/animateur` — **télécommande** (pensée mobile). C'est ici que tout se
  pilote : lancer la partie, ouvrir/valider/passer les questions, arrêter la
  partie.

L'adresse du serveur est déduite automatiquement de celle utilisée pour
charger la page (`window.location.hostname`) — pas besoin de configurer une
IP à la main, y compris depuis un téléphone. `VITE_SERVEUR_URL` permet de
forcer une autre adresse si besoin.

## En développement (rechargement à chaud)

```bash
npm install
npm run dev
```

Affiche une URL `Local` (pour cette machine) et une URL `Network` (pour un
téléphone sur le même Wi-Fi, à faire suivre de `/animateur`).

## Pour une vraie soirée

Pas besoin de lancer `ecran/` séparément : `npm run demo` à la racine du
dépôt construit ce projet (`npm run build`) et le sert directement depuis
`serveur/`, sur un seul port.
