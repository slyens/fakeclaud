# Claude Inspire — application de chat IA

Une application web inspirée d'une interface de chat IA moderne : conversations, choix du modèle, envoi d'images, rendu des réponses et historique local.

## Important pour la clé API
Si tu as partagé une vraie clé API dans un chat, révoque-la dans la console du fournisseur et crée-en une nouvelle. Ne colle jamais une clé secrète dans `public/app.js` ou `public/index.html`.

## Prérequis
- Node.js 18 ou plus récent
- Une clé API Anthropic valide et l'accès aux modèles choisis

## Lancer l'application
1. Décompresse le ZIP.
2. Ouvre un terminal dans le dossier `claude_inspire_app`.
3. Installe les dépendances :
   ```bash
   npm install
   ```
4. Copie `.env.example` vers `.env`.
   - Windows (PowerShell) : `Copy-Item .env.example .env`
   - macOS/Linux : `cp .env.example .env`
5. Ouvre `.env` et remplace `colle_ta_cle_api_ici` par ta nouvelle clé.
6. Démarre l'application :
   ```bash
   npm start
   ```
7. Ouvre http://localhost:3000 dans ton navigateur.

## Fonctionnalités
- Interface responsive sombre
- Trois choix de modèles proposés (l'accès réel dépend de ton compte Anthropic)
- Envoi de messages et de plusieurs images
- Historique conservé dans le navigateur
- Paramètres et effacement de l'historique local
- Appels API effectués côté serveur pour ne pas exposer la clé au navigateur

## À savoir
- Ce projet est une application indépendante inspirée d'une interface de chat. Ce n'est pas le site officiel Claude et ne copie pas ses modèles internes.
- L'API Anthropic est un service distinct : les modèles, noms, accès, limites et tarifs peuvent changer. Si un modèle n'est pas disponible sur ton compte, choisis un modèle auquel tu as accès et modifie la liste `ALLOWED_MODELS` dans `server.js` ainsi que les menus dans `public/index.html`.
- L'historique est local au navigateur et n'est pas synchronisé entre appareils.
- Avant tout déploiement public, ajoute une authentification, des limites de requêtes, une protection contre les abus et une politique de confidentialité.


## Design
L'interface utilise désormais une palette ivoire/blanc cassé et une typographie épurée inspirées de l'expérience visuelle moderne des assistants IA, avec une barre latérale discrète, des cartes simples et sans emojis décoratifs. Projet indépendant, non officiel.


## Si tu vois « Cannot GET / »
Cela signifie que le serveur ne trouve pas la page d'accueil ou que le serveur a été lancé depuis un mauvais dossier. Cette version définit explicitement la route `/`.
- Décompresse le ZIP corrigé dans un nouveau dossier.
- Ouvre le terminal dans le dossier où se trouvent `server.js`, `package.json` et `public/`.
- Lance `npm install`, puis `npm start`.
- Ouvre `http://localhost:3000`.
Ne lance pas le fichier `server.js` depuis un autre dossier et ne double-clique pas sur `index.html`.
