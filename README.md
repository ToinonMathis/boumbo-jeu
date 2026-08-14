# boumbo-jeu

Firmware, serveur et écran du jeu de buzzers Boumbo — tout ce qui tourne en
local, au bar/camping, branché aux buzzers. Le SaaS cloud (comptes, contenu,
stats) est dans le dépôt séparé `boumbo-cloud`.

## Lancer une soirée

Depuis la racine de ce dépôt :

```bash
npm run demo
```

Ça construit l'écran et démarre le serveur, qui sert tout depuis un seul
port (API + SSE + interface). Le terminal affiche ensuite deux liens :

- l'écran à mettre sur la TV,
- la télécommande animateur, à ouvrir depuis un téléphone sur le même Wi-Fi.

Voir `serveur/README.md` et `ecran/README.md` pour le détail de chaque
brique, et le développement de l'écran avec rechargement à chaud.
