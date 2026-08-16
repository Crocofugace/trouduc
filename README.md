# Trouduc — le vrai jeu du Président

Jeu de cartes Président (trou du cul) fidèle aux règles françaises : révolution, échanges de cartes,
interdiction de finir sur un 2. 4 à 6 joueurs contre bots. PWA installable, hors-ligne, sans pub.

## Structure
- `src/engine/president.js` — moteur pur (règles, machine à états, bots). Zéro dépendance UI. Testé.
- `src/App.jsx` — interface street art (React), sons (Tone.js).
- `public/` — manifest PWA, service worker, icônes.
- `tests/` — tests unitaires des règles + simulation massive 4/5/6 joueurs.

## Commandes
- `npm install` puis `npm run dev` — développement local
- `npm test` — tests du moteur (obligatoire avant tout déploiement)
- `npm run build` — production dans `dist/`

## Déploiement
Le contenu de `dist/` se déploie tel quel sur n'importe quel hébergeur statique
(Netlify, Vercel, Cloudflare Pages). Voir la spec de game design pour les règles complètes.
