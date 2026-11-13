# Tests automatiques

Une seule commande lance tous les tests :

```bash
node tests/lancer.js            # suite rapide (par défaut)
node tests/lancer.js rapide     # idem
node tests/lancer.js complet    # suite complète
```

Le lanceur démarre lui-même un serveur local sur `127.0.0.1` (port libre entre 8900 et 8999),
ouvre Chromium, exécute les scénarios un par un et affiche un rapport en français :
une ligne par scénario (« OK » ou « ÉCHEC : raison »), puis le total. Le rapport est aussi écrit
dans `tests/dernier-rapport.txt` (fichier ignoré par git). Le code de sortie vaut 1 s'il y a au moins un échec.

Prérequis : Node.js, le paquet `playwright` et un Chromium installé pour Playwright
(`npx playwright install chromium`). Aucune autre installation n'est nécessaire.

## Les deux suites

| Suite | Contenu | Durée indicative |
|---|---|---|
| `rapide` | tous les scénarios, sauf la carrière longue | moins de 4 minutes |
| `complet` | tous les scénarios ; l'atelier monte la voiture entière | plusieurs minutes |

## Les scénarios

Chaque scénario est un fichier de `tests/scenarios/`, lancé dans un navigateur neuf
(pas de sauvegarde partagée entre deux scénarios).

| Fichier | Ce qu'il vérifie |
|---|---|
| `01-accueil.js` | La page d'accueil s'affiche sans erreur. |
| `02-mode-libre.js` | Les 6 onglets du mode libre s'affichent ; aucun texte « NaN », « undefined » ou « Infinity » ; les vues du moteur et le banc à inertie fonctionnent. |
| `03-voitures-moteurs.js` | Les 6 voitures de base et tous les moteurs tout prêts donnent des valeurs finies. |
| `04-essais.js` | L'essai 400 m et l'essai d'endurance de 150 000 km vont au bout et rendent un bilan. |
| `05-carriere.js` | Fonder l'entreprise, concevoir une voiture en 7 étapes, la lancer ; le journal de presse s'ouvre puis se ferme. |
| `06-carriere-longue.js` | 40 ans simulés (160 trimestres) sans aucune valeur non finie. **Ignoré en mode rapide.** |
| `07-atelier.js` | Enregistrer un moteur, prendre la place de l'ingénieur, saisir une pièce avec la touche E, la poser. En mode complet, le montage entier est terminé. |
| `08-telephone.js` | iPhone 13 : interface pivotée en paysage, défilement au doigt, aucun débordement horizontal. |

Un scénario échoue dès qu'une erreur JavaScript (`pageerror`) ou une erreur de console apparaît,
même si ses étapes ont réussi.

## Ajouter un scénario

Créer `tests/scenarios/NN-nom.js` qui exporte une fonction `async (page, env)`. Elle lève une erreur
(message en français) en cas d'échec, et peut renvoyer une chaîne, affichée après « OK ».
Propriétés facultatives :

- `titre` : le libellé du rapport ;
- `appareil` : `'bureau'` (défaut) ou un nom de `devices` de Playwright, par exemple `'iPhone 13'` ;
- `lourd: true` : scénario ignoré en mode rapide.

Les aides communes (attendre un élément, vérifier les textes, le débordement, démarrer une carrière…)
sont dans `tests/outils.js`.
