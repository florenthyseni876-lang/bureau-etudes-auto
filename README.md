# Bureau d'Études Auto

Simulateur d'ingénierie automobile : concevez un moteur et une voiture, passez-les au banc et sur piste, surveillez l'usure, l'entretien et la casse.

C'est une **application web installable** : une fois en ligne, elle s'ajoute à l'écran d'accueil du téléphone, s'ouvre en plein écran et fonctionne sans connexion.

## Installer sur un téléphone

- **iPhone** : ouvrir l'adresse dans Safari → bouton Partager → « Sur l'écran d'accueil » → Ajouter.
- **Android** : ouvrir l'adresse dans Chrome → bouton « Installer l'application » en haut de la page (ou menu ⋮ → Installer l'application).

## Organisation du projet

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'entrée : structure de l'écran et chargement des modules |
| `css/style.css` | Apparence (thèmes clair et sombre) |
| `js/00-outils.js` | Petites fonctions communes |
| `js/01-donnees.js` | Catalogues : architectures, carrosseries, boîtes, moteurs tout prêts… |
| `js/02-etat.js` | Réglages par défaut, bases de départ, état de l'interface |
| `js/03-moteur.js` | Modèle physique du moteur (couple, puissance, résistance, usure, entretien) |
| `js/04-vehicule.js` | Modèle du véhicule (masse, performances, consommation, contrôles) |
| `js/05` à `js/07` | Dessins : voiture, coupe du moteur, moteur 3D |
| `js/08-banc.js` | Banc d'essai moteur et températures |
| `js/09-son.js` | Synthèse du son moteur |
| `js/10` à `js/14` | Chambre de combustion, roulage, pannes, rotatifs, résistance et casse |
| `js/15` à `js/19` | Graphiques, panneaux, essais, réglages, rendu et démarrage |
| `js/pwa.js` | Installation, fonctionnement hors connexion, avis de mise à jour |
| `sw.js` | Service hors connexion (généré, ne pas modifier à la main) |
| `manifest.webmanifest`, `icons/` | Nom, icône et couleurs de l'application installée |
| `vendor/three.min.js` | Bibliothèque 3D (three.js r128), embarquée pour marcher hors connexion |
| `outils/build.py` | Regénère `sw.js` et la version Artifact (`dist/`) |
| `outils/icones.py` | Regénère les icônes |

Les modules sont de simples scripts chargés dans l'ordre et partagent leurs déclarations : un nouveau module se range entre deux numéros et s'ajoute à la liste des `<script>` dans `index.html`.

## Après chaque modification

```bash
python3 outils/build.py
```

Ce script met à jour la liste des fichiers gardés hors connexion et leur numéro de version : les téléphones qui ont installé l'application voient alors s'afficher « Une nouvelle version est prête » et se mettent à jour d'un geste. Il produit aussi `dist/bureau-etudes-auto.html`, la même application en un seul fichier pour la publier comme Artifact.

## Essayer sur l'ordinateur

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

puis ouvrir http://127.0.0.1:8000. (Le fonctionnement hors connexion exige `http://localhost`/`127.0.0.1` ou `https://`, pas un fichier ouvert directement.)

## Mettre en ligne

**GitHub Pages (recommandé)** : envoyer le projet sur un dépôt GitHub, puis dans *Settings → Pages*, choisir *Source : GitHub Actions*. Le fichier `.github/workflows/pages.yml` publie ensuite automatiquement chaque nouvelle version sur `https://<compte>.github.io/<dépôt>/`.

Tout hébergeur de pages statiques convient aussi (Netlify, Cloudflare Pages…) : il suffit de servir le dossier tel quel, en HTTPS.

## Mode carrière

Depuis l'écran d'accueil, « Nouvelle carrière » fonde un constructeur en 1900, 1920, 1950, 1980 ou 2000.

- Le temps avance par trimestre (bouton « Trimestre suivant » ou « +1 an »).
- Chaque technologie a son année d'invention (`js/20-epoques.js`) : elle se recherche à partir de cette date, puis se débloque dans le bureau d'études. Le rupteur, la compression, la pression de turbo, le nombre de rapports et la taille des pneus sont plafonnés selon l'année.
- Le marché (`js/21-carriere.js`) compare chaque modèle à la voiture moyenne de l'année pour cinq clientèles : populaire, familiale, sportive, luxe, utilitaire.
- Les montants sont en euros constants (valeur 2020). La partie est enregistrée sur l'appareil.
