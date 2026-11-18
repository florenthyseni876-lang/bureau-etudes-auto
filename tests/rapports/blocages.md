# Rapport du testeur — Carrière de mécanicien

Méthode : parties jouées avec de vraies entrées (Z + Maj, E maintenu, touches 1 à 0, V, R, Échap, M, Tab, H, G, B, C, F, clics sur les boutons visibles). Le regard est placé avec `__mw.teleport` comme une souris ; on vérifie `MWG.aim()` et `#mwPrompt`. Captures regardées à chaque étape. Raccourcis utilisés (signalés) : téléportation devant une porte (parcours des lieux), argent ou client choisis, `__mwadm.finish()` pour finir un travail (arnaques), mode administrateur par le menu.
Scénarios conservés : `tests/scenarios/31-joueur-debut.js`, `31-joueur-lieux.js` (aides : `tests/joueur.js`).

## Résumé

| Partie du jeu | Problèmes |
|---|---|
| interface | 6 |
| gestes et visée | 4 |
| carrière et économie | 5 |
| ville | 2 |
| performance | 1 |
| moteur, carrosserie et habitacle, châssis, freins et roues, immobilier | 0 (voir « Couvert sans problème ») |

Total : 18 (1 bloquant, 8 gênants, 9 détails).

**Couvert sans problème** : accueil, embauche au comptoir, carte/carnet/guide/gestes/biens (s'ouvrent et se ferment), vidange complète, essuie-glaces, ampoule, batterie, filtres (portière passager), bougies, courroie d'accessoires, pneus (écrous), rendu avec facture, note et paie, formation CAP (inscription, examen QCM), prêt, tous les lieux, achat d'atelier (comptant) et travail à son compte, achat de maison et d'usine, établi/ferraille, matériel du noir, auto-entrepreneur, conduite, nuit. **Non terminés faute de temps** (jouables mais pas menés au bout, les gestes dépassent les 4 minutes par scénario) : plaquettes/disques de bout en bout, distribution, embrayage, amortisseurs (gestes de début vérifiés), révision complète, entretien d'embauche chez Ventoux, BTS/ingénieur, fonder la marque, carrière longue.

## Problèmes (par gravité)

### 1 · bloquant · gestes et visée — L'aide envoie chercher à l'étagère des pièces que l'étagère du Garage du Coin n'a pas
- Étapes : embauché au Garage du Coin, niveau suffisant (mécanicien) → client « Remplacement de l'embrayage » (aussi : disques, distribution, amortisseurs, alternateur, démarreur, sonde lambda) → étagère (E) : aucun bouton « Prendre les pièces des ordres en cours », rien dans la liste → bandeau permanent : « Pièce neuve à aller chercher : Kit d'embrayage — prenez-la à l'étagère de l'atelier ».
- Attendu : « achetez-la chez Pièces Auto Express (avancée, remboursée à la facture) » ou stock suffisant. Constaté : on tourne en rond ; le guide ne dit nulle part que l'atelier ne stocke qu'une partie des pièces.
- Cause : `STOCK1` limité (js/41-meca-travaux.js, `stockOf`) alors que le message (js/46-meca-gestes.js, `hintUpdate`, test `shop`) ne regarde que `e.compte`.

### 2 · gênant · carrière et économie — Bouton « S'inscrire » grisé sans raison (formation)
- Étapes : 300 € → centre de formation → CAP : bouton grisé, aucun texte « il faut 600 € » (le BTS/ingénieur liste leurs conditions, pas l'argent). Idem pendant une formation en cours pour les autres diplômes.
- Fonction : `school` (js/42-meca-carriere.js ligne 283, `disabled` = `!ok||busy||money<cout`).

### 3 · gênant · carrière et économie — Valise de diagnostic : à acheter, mais rien ne l'annonce
- Étapes : à partir de la 4e voiture, un client décrit un symptôme → habitacle (E) → « Valise de diagnostic » / « Essai sur route » → « Il vous faut une valise de diagnostic (en vente chez Pièces Auto Express) ». L'essai sur route est refusé pour la même raison.
- Attendu : le boutons indique « (à acheter) » et le guide/l'objectif prévient. À l'établi du Garage du Coin le texte « l'atelier fournit la valise » n'apparaît que pour les autres employeurs.

### 4 · gênant · carrière et économie — Le tutoriel exige « Faites votre première vidange » sans garantir qu'un client en apporte une
- Étapes : rendre la première voiture (ex. essuie-glaces) → objectif « Faites votre première vidange… » ; le tirage des clients est aléatoire (poids 4 sur ~20, `chooseJob`), l'atelier affiche « aucun client pour l'instant ». Le joueur attend sans savoir quoi faire.
- Attendu : forcer une vidange pour la 2e voiture, ou ne pas bloquer l'objectif.

### 5 · gênant · interface — L'objectif « Prenez votre premier client » reste pendant tout le premier travail
- Étapes : embauche → client arrivé → l'objectif reste « Une voiture cliente attend… inspectez-la » jusqu'au rendu, même la voiture finie ; il ne guide ni vers les outils, ni vers l'étagère (js/42, `tutorial`).

### 6 · gênant · gestes et visée — « Prendre les outils de l'ordre » redonne un bac de vidange déjà posé sous la voiture
- Étapes : vidange → servante → outils de l'ordre → poser le bac sous le carter → l'aide renvoie à la servante, qui reprend un bac (toast « Outils pris : bac de vidange »). `toolsNeeded` (js/41) ne compte pas le bac posé.

### 7 · gênant · carrière et économie — « Remettre en état » une batterie à l'établi ne rapporte rien
- Étapes : batterie usée à 80 % dans l'inventaire → établi → « Remettre en état (30 min, kit 3 €) » → « usure 50 %, revendable environ 0 € ». On paie 3 € et 30 minutes pour rien (la ferraille donnait 11 €). Fonction : js/48-meca-occasion.js (prix d'occasion).

### 8 · gênant · gestes et visée — Écrou n° 1 du premier côté impossible à viser une fois le pont levé
- Étapes : pneus ou plaquettes : desserrer les écrous au sol, lever le pont, viser l'écrou en surbrillance de l'aide : à 6 positions et distances, `MWG.aim()` donne un écrou voisin (rayon de cible 3,2 cm, `nut:` dans js/46-meca-gestes.js ligne 441). Un joueur retire un autre écrou (ordre libre) mais la surbrillance de l'aide ne correspond plus.

### 9 · gênant · ville — Une fenêtre flotte au milieu de la route
- Étapes : conduire depuis le studio vers l'est puis tourner à gauche au premier carrefour : un grand panneau-fenêtre blanc se dresse à plat sur la chaussée près du feu (capture `71-route`). Décor de façade (js/45-meca-decor.js / 45b-meca-ville.js), à localiser.

### 10 · gênant · interface — Les messages (toasts) recouvrent la barre de boutons Carte/Menu/Carnet
- Étapes : travailler à son compte, deux clients arrivent : le 3e message se superpose aux boutons en haut à droite (capture `93`). Fonction : conteneur de toasts (js/40-meca-monde.js).

### 11 · détail · interface — Carte (M) : étiquettes superposées
- « Garage du Coin », « Rue Basse… À vendre », « Studio », « Cour », « Pièces Auto » se chevauchent : le garage de l'objectif est illisible (`drawBig`, js/40-meca-monde.js).

### 12 · détail · carrière et économie — 30 % annoncés à l'embauche, 35 % ensuite
- Panneau « Devenir apprenti » : 30 % ; carte Carrière et bandeau : 35 % (`EMP.apprenti.part = .35`, js/42-meca-carriere.js).

### 13 · détail · interface — Ligne vide sous chaque diplôme (centre de formation).

### 14 · détail · interface — Pendant l'écoulement de l'huile, aucun message ne dit d'attendre
- Après avoir ôté le bouchon et monté le filtre, l'aide (`mg-hint`, `mg-info`) est vide quelques secondes (« attente 0 s : | | »).

### 15 · détail · gestes et visée — Verser l'huile ne s'arrête pas au repère maxi
- Maintenir E trop longtemps : « Trop d'huile » et, au rendu, malus (« trop d'huile dans le moteur ») sans moyen de retirer l'excédent. Le malus « pièces oubliées dans le bac magnétique » n'est annoncé qu'à l'écran de facture, jamais pendant le travail (js/41, `evalJob`).

### 16 · détail · interface — Atelier : une colonne du pont masque la voiture quand on arrive de ce côté
- Capture `20-pont` : on se place à côté du pont, la colonne remplit tout l'écran. Aucun repère ne dit de contourner.

### 17 · détail · performance — Qualité « Haute » : débit nettement plus faible
- Chromium sans GPU (rendu logiciel, donc valeurs indicatives) : 14 images/s au départ, 10 en « Moyenne », 6–7 en « Haute ». La qualité automatique reste en « Basse ».

### 18 · détail · ville — Un arbre du trottoir arrête la marche en ligne droite depuis le studio (il faut contourner) ; rien ne le signale. Marche et conduite sinon fluides, nuit correcte.

## Les 10 plus graves
1 (étagère / aide trompeuse) · 2 (S'inscrire grisé) · 3 (valise) · 4 (tutoriel vidange) · 5 (objectif figé) · 6 (second bac) · 7 (remise en état à 0 €) · 8 (écrou inaccessible) · 9 (fenêtre flottante) · 10 (toasts sur les boutons).
