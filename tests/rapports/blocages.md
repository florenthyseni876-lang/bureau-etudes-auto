# Rapport du testeur — Carrière de mécanicien

*(version de travail : sera complétée au fil des parties testées)*

Méthode : parties jouées avec de vraies entrées (touches Z/Maj, E maintenu, 1 à 0, V, R, Échap, clics sur les boutons visibles), regard placé comme une souris avec `__mw.teleport`, captures d'écran regardées. Scénarios : `tests/scenarios/9x-*.js` (aides dans `tests/joueur.js`).

## Résumé

(à compléter)

## Problèmes

### 1 · détail · interface — Carte (M) : étiquettes qui se chevauchent
- Étapes : nouvelle carrière → touche M.
- Attendu : chaque lieu lisible. Constaté : « Garage du Coin », « Rue Basse… À vendre », « Studio », « Cour » et « Pièces Auto » se superposent au centre de la carte, on ne distingue plus le garage où se rendre (celui de l'objectif).
- Fonction : dessin de la grande carte (`drawBig`, js/40-meca-monde.js).

### 2 · détail · carrière et économie — Part annoncée à l'embauche : 30 %, puis 35 %
- Étapes : comptoir du Garage du Coin → panneau « Devenir apprenti » (« Vous toucherez 30 % de la main-d'œuvre ») → après l'embauche, le bandeau et la touche C affichent « 35 % de la main-d'œuvre ».
- Fonction : texte du panneau dans js/42-meca-carriere.js (EMP.apprenti.part = .35).

### 3 · gênant · interface — L'objectif « Prenez votre premier client » reste affiché pendant tout le premier travail
- Étapes : embauche → le client arrive tout de suite → objectif du haut inchangé (« Une voiture cliente attend sur un pont : inspectez-la… ») jusqu'au rendu, même quand la vidange est terminée. Le bandeau « Ordres en cours » dit autre chose.
- Attendu : l'objectif avance (« Prenez les outils / les pièces », « Rendez la voiture »).

### 4 · gênant · gestes et visée — « Prendre les outils de l'ordre » redonne un bac de vidange alors qu'il est déjà posé sous la voiture
- Étapes : vidange → servante : « outils de l'ordre » → poser le bac sous le carter → continuer : l'aide renvoie à la servante, qui reprend un bac.
- Attendu : pas de second bac (le bac posé compte). Fonction : `toolsNeeded` (js/41-meca-travaux.js).

### 5 · détail · interface — Le panneau du centre de formation affiche une ligne vide sous chaque diplôme
- Étapes : porte du Centre de formation → E. Un espace vide entre le titre et le prix du CAP, BTS, ingénieur.
