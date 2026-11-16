'use strict';
/* ───────────── Mode « Mécanicien » — PANNES RÉALISTES (données) ─────────────
   Données pures, chargées avant js/41 : nouvelles pièces, nouveaux modèles de travaux, et le catalogue des symptômes à diagnostiquer.
   Chaque symptôme décrit ce que dirait un vrai client, la pièce coupable, les « fausses pistes » (pièces un peu usées mais saines),
   ce qu'on voit à l'inspection de chaque suspect, ce qu'on ressent à l'essai sur route selon la situation, les vrais codes défaut
   (OBD-II, P0xxx) lus à la valise, et parfois une panne en chaîne (dégât causé par la panne d'origine).

   ═══ API `MWP` ═══
   MWP.PD         nouvelles pièces, au même format que PD de js/41 ; MWP.TPL nouveaux modèles de travaux ; MWP.TOOLS outils conseillés par pièce
   MWP.SYMP       symptômes : {id, txt (le client), c (coupable), red (fausses pistes), dn (difficulté), f ('diesel'|'essence'), ch (dégâts en chaîne),
                  ins {pièce: texte d'inspection}, ess {situation: texte d'essai}, cod (codes valise du coupable), fx {pièce: code trompeur}, cause}
   MWP.ESS        situations de l'essai sur route : {id: libellé}
   MWP.applies(voiture, pièce)  la voiture possède-t-elle cette pièce (diesel seulement, turbo, boîte manuelle…) ? ; MWP.fuelOK(voiture, symptôme) */
const MWP=(()=>{
const car=m=>{try{return typeof MWCARS!=='undefined'&&m?MWCARS.get(m):null;}catch(e){return null;}};

/* ── nouvelles pièces : [id, nom, abrégé, zone, essieu, compétence, niveau, prix, minutes, outil, invisible, durée de vie (km), essai, indice d'essai, état d'usure, code valise] ── */
const PD=[
['bobines',`Bobines d'allumage`,'Bob.','capot','','electricite',2,120,35,'cles',0,120000,'accel',`Le moteur a des ratés en accélérant et le voyant moteur clignote.`,`Isolant fissuré, traces d'étincelles.`,`P0300 : ratés d'allumage détectés.`],
['vanne_egr','Vanne EGR','EGR','capot','','moteur',3,210,75,'cles',0,150000,'ralenti',`Le ralenti est instable et le moteur manque de reprise.`,`Vanne encrassée de calamine, clapet collé.`,`P0401 : débit de recirculation des gaz (EGR) insuffisant.`],
['fap','Filtre à particules','FAP','dessous','','moteur',4,900,120,'cles',0,200000,'accel',`La voiture manque de puissance et le voyant du filtre à particules s'allume.`,`Filtre saturé de suie.`,`P2002 : efficacité du filtre à particules sous le seuil.`],
['turbo','Turbocompresseur','Turbo','capot','','moteur',4,950,210,'cle_dyn',0,220000,'accel',`Un sifflement monte à l'accélération et la puissance manque.`,`Jeu excessif de l'arbre, huile dans les conduits.`,`P0299 : pression de suralimentation insuffisante.`],
['filtre_gazole','Filtre à gazole','Fil.G','capot','','entretien',2,28,25,'cles',0,60000,'accel',`À-coups à pleine charge : le filtre à gazole est colmaté.`,`Cartouche noire, eau au fond du bocal.`,''],
['thermostat','Thermostat','Therm.','capot','','moteur',2,55,60,'cles',0,150000,'chaud',`La température du moteur ne se stabilise pas.`,`Boîtier suintant, clapet qui ne ferme plus.`,`P0128 : température du liquide sous le seuil de régulation.`],
['pompe_eau',`Pompe à eau`,'P.Eau','capot','','moteur',3,95,100,'cles',0,150000,'chaud',`Un sifflement et une odeur sucrée viennent du moteur chaud.`,`Trace rose séchée sous l'orifice témoin, jeu dans la poulie.`,''],
['radiateur','Radiateur de refroidissement','Radia.','capot','','moteur',3,190,120,'cles',0,200000,'chaud',`La température monte dans les bouchons et en côte.`,`Ailettes écrasées, suintement aux boîtes à eau.`,''],
['durite','Durites de refroidissement','Durit.','capot','','entretien',2,32,45,'cles',0,100000,'chaud',`Une odeur sucrée et de la vapeur apparaissent moteur chaud.`,`Durite gonflée, craquelée, collier rouillé.`,''],
['ventilateur','Motoventilateur','Ventil.','capot','','electricite',2,150,60,'cles',0,150000,'ralenti',`À l'arrêt, la température grimpe : le ventilateur reste immobile.`,`Hélice calée, connecteur brûlé.`,`P0480 : circuit de commande du ventilateur de refroidissement.`],
['joint_culasse','Joint de culasse (pochette et vis)','Culasse','capot','','moteur',5,420,600,'cle_dyn',0,250000,'chaud',`Fumée blanche épaisse et surchauffe moteur chaud.`,`Huile laiteuse sous le bouchon, bulles dans le vase.`,`P0217 : surchauffe du moteur détectée.`],
['capteur_pmh','Capteur de vilebrequin (PMH)','PMH','dessous','','electricite',2,45,30,'cles',1,180000,'demarrage',`Le moteur cale net et ne repart pas à chaud.`,'',`P0335 : circuit du capteur de vilebrequin (PMH).`],
['capteur_arbre',`Capteur d'arbre à cames`,'Cames','capot','','electricite',2,40,30,'cles',1,180000,'demarrage',`Le démarrage est long et le moteur passe en mode dégradé.`,'',`P0340 : circuit du capteur d'arbre à cames.`],
['debitmetre',`Débitmètre d'air`,'Débit.','capot','','moteur',3,130,20,'cles',1,180000,'accel',`Le moteur manque de puissance et passe en mode dégradé.`,'',`P0101 : performance du débitmètre d'air.`],
['sonde_temp','Sonde de température du liquide','S.Temp','capot','','electricite',2,22,25,'cles',1,160000,'froid',`Le démarrage à froid est difficile et le ventilateur tourne tout le temps.`,'',`P0117 : signal de la sonde de température d'eau trop bas.`],
['pompe_carburant','Pompe à carburant','P.Carb','dessous','','moteur',4,190,100,'cles',0,200000,'chaud',`Le moteur cale à chaud puis refuse de repartir.`,`Pompe bruyante, crépine du réservoir colmatée.`,`P0087 : pression de rampe de carburant trop basse.`],
['catalyseur','Catalyseur','Cata.','dessous','','moteur',3,480,60,'cles',0,220000,'accel',`La voiture s'essouffle en côte et sent l'œuf pourri.`,`Céramique brisée : ça cliquette dans le boîtier.`,`P0420 : efficacité du catalyseur sous le seuil.`],
['joint_cc',`Joint de cache-culbuteurs`,'J.Cul.','capot','','moteur',2,35,60,'cles',0,120000,'ralenti',`Une odeur d'huile brûlée se sent à l'arrêt.`,`Suintement d'huile sur le haut du moteur.`,''],
['joint_spi',`Joint spi de vilebrequin`,'Spi','capot','','moteur',3,22,120,'cles',0,180000,'ralenti',`Des gouttes d'huile tombent sous la voiture à l'arrêt.`,`Suintement d'huile derrière la poulie de vilebrequin.`,''],
['rotule',`Rotules de suspension (paire)`,'Rotul.','roue','av','liaison',3,60,60,'cle_dyn',0,120000,'bosses',`Un claquement sec vient de l'avant sur les bosses.`,`Soufflet déchiré, jeu au levier.`,''],
['roulement',`Roulements de roue avant`,'Roulem.','roue','av','liaison',3,85,80,'cle_dyn',0,150000,'vitesse',`Un ronronnement augmente avec la vitesse.`,`Roue qui bouge quand on la secoue, bruit de roulement à la main.`,''],
['cardan',`Cardans avant (paire)`,'Cardan','roue','av','transmission',3,130,90,'cle_dyn',0,180000,'virage',`Un claquement se produit en braquant sous accélération.`,`Soufflet déchiré, graisse projetée.`,''],
['volant_bimasse','Volant moteur bimasse','Bimasse','dessous','','transmission',5,720,330,'cle_dyn',0,200000,'ralenti',`Des claquements et des vibrations secouent le moteur au ralenti.`,`Jeu angulaire excessif entre les deux masses.`,'']];

/* ── modèles de travaux demandés directement par le client : [id, nom, pièces, poids] ── */
const TPL=[
['thermo','Remplacement du thermostat',['thermostat'],.8],['pompe_eau',`Remplacement de la pompe à eau`,['pompe_eau'],.6],['bobines',`Bobines d'allumage`,['bobines'],.8],
['egr','Remplacement de la vanne EGR',['vanne_egr'],.6],['rotules','Rotules de suspension',['rotule'],.8],['roulement','Roulement de roue',['roulement'],.8],
['gazole','Filtre à gazole',['filtre_gazole'],.9],['radiateur','Remplacement du radiateur',['radiateur'],.5],['cata','Remplacement du catalyseur',['catalyseur'],.4],
['joint_cc',`Joint de cache-culbuteurs`,['joint_cc'],.5],['durites','Durites de refroidissement',['durite'],.6]];

/* outils conseillés (servante) */
const TOOLS={bobines:['cliquet','tournevis'],vanne_egr:['cliquet','pinces'],fap:['cliquet','cle_dyn'],turbo:['cliquet','cle_dyn','pinces'],filtre_gazole:['cle_filtre','bidon'],
 thermostat:['cliquet','bidon','pinces'],pompe_eau:['cliquet','cle_dyn','bidon'],radiateur:['cliquet','bidon','pinces'],durite:['pinces','bidon'],ventilateur:['cliquet'],
 joint_culasse:['cliquet','cle_dyn','pinces'],capteur_pmh:['cliquet'],capteur_arbre:['cliquet'],debitmetre:['tournevis'],sonde_temp:['cliquet','pinces'],
 pompe_carburant:['cliquet','pinces'],catalyseur:['cliquet','cle_dyn'],joint_cc:['cliquet','cle_dyn'],joint_spi:['cliquet','cle_dyn','pinces'],
 rotule:['boulonneuse','cliquet','cle_dyn'],roulement:['boulonneuse','cliquet','cle_dyn','presse'],cardan:['boulonneuse','cliquet','cle_dyn'],volant_bimasse:['cliquet','cle_dyn']};

/* situations de l'essai sur route */
const ESS={demarrage:'Au démarrage',froid:'À froid',ralenti:'Au ralenti',accel:'En accélération',vitesse:'À vitesse stabilisée',chaud:'Moteur chaud',frein:'Au freinage',virage:'En virage',bosses:'Sur les bosses'};

/* ── les symptômes ── */
const SYMP=[
/* — freinage, liaison au sol, entretien — */
{id:'frott',txt:'Un bruit de frottement quand je freine.',c:'plaq_av',red:['plaq_ar','disq_av'],dn:1,
 ins:{plaq_av:`Garnitures à ras : le support métallique touche le disque. C'est le bruit entendu.`,plaq_ar:`Garnitures encore épaisses, usure régulière : rien à signaler de ce côté.`,disq_av:`Disques un peu marqués mais sans lèvre : c'est une conséquence possible, pas la cause.`},
 ess:{frein:`Au freinage : grincement métallique aigu à l'avant, la pédale reste ferme.`},cod:[],cause:`Plaquettes avant usées jusqu'au métal.`},
{id:'plaq_metal',txt:'Ça gratte fort quand je freine et la voiture vibre un peu.',c:'plaq_av',red:['plaq_ar'],ch:['disq_av'],dn:2,
 ins:{plaq_av:`Plus aucune garniture : le métal frotte sur le disque.`,disq_av:`Disques profondément rainurés par le support métallique : à changer avec les plaquettes.`,plaq_ar:`Garnitures correctes, bien réparties.`},
 ess:{frein:`Au freinage : grincement grave de métal contre métal, légère vibration dans le volant.`},cod:[],cause:`Plaquettes à ras qui ont abîmé les disques : il faut changer les deux.`},
{id:'feu',txt:`Mon feu arrière ne s'allume plus.`,c:'ampoules',red:[],dn:1,ins:{ampoules:`Le filament est coupé et le verre noirci.`},cod:[],cause:'Ampoule grillée.'},
{id:'traces',txt:'Les essuie-glaces laissent des traînées sur le pare-brise.',c:'essuie',red:[],dn:1,ins:{essuie:`Gomme durcie et fendue : elle ne plaque plus sur la vitre.`},cod:[],cause:'Balais usés.'},
{id:'vibfrein',txt:'Le volant vibre quand je freine fort.',c:'disq_av',red:['plaq_av'],dn:2,
 ins:{disq_av:`Disques voilés et bleuis par la chauffe : épaisseur irrégulière.`,plaq_av:`Plaquettes à moitié usées, garnitures régulières : elles ne sont pas en cause.`},
 ess:{frein:`Au freinage depuis une vitesse élevée : le volant tremble et la pédale pulse.`},cod:[],cause:'Disques avant voilés.'},
{id:'molle',txt:'La pédale de frein est molle.',c:'liquide_frein',red:['plaq_av'],dn:2,
 ins:{liquide_frein:`Liquide brun, chargé d'eau : il a bouilli. Le testeur d'humidité est dans le rouge.`,plaq_av:`Plaquettes à moitié usées mais saines, aucune fuite aux étriers.`},
 ess:{frein:`Au freinage : la pédale s'enfonce loin et devient spongieuse après quelques freinages.`},cod:[],cause:`Liquide de frein vieux : l'eau bout et forme des bulles.`},
{id:'bosses',txt:`Ça claque à l'avant sur les bosses.`,c:'amort',red:['pneus','rotule'],dn:2,
 ins:{amort:`Tiges huileuses, fuite le long du corps : l'amortisseur est vide.`,pneus:`Pneus un peu usés mais bien gonflés, sans hernie.`,rotule:`Pas de jeu au levier : les rotules tiennent.`},
 ess:{bosses:`Sur les bosses : la voiture rebondit plusieurs fois et claque à l'avant.`},cod:[],cause:'Amortisseurs avant fatigués.'},
{id:'amort_pneus',txt:'La voiture rebondit et mes pneus avant sont usés en cuvettes.',c:'amort',red:['rotule'],ch:['pneus'],dn:3,
 ins:{amort:`Tiges huileuses, effet « pogo » au test : les amortisseurs sont fatigués.`,rotule:`Aucun jeu : les rotules sont saines.`,pneus:`Usure en cuvettes, causée par les amortisseurs : à changer aussi.`},
 ess:{bosses:`Sur les bosses : rebonds multiples, roues qui sautillent.`,vitesse:`À vitesse stabilisée : léger bruit de roulement sourd sur les pneus cuvetés.`},cod:[],cause:'Amortisseurs fatigués qui ont mangé les pneus.'},
{id:'pneus_us',txt:`La voiture manque d'adhérence et tire un peu sur le mouillé.`,c:'pneus',red:['amort','rotule'],dn:1,
 ins:{pneus:`Témoins d'usure atteints, flancs craquelés.`,amort:`Amortisseurs corrects, sans fuite.`,rotule:`Pas de jeu dans la direction.`},
 ess:{virage:`En virage : le train avant décroche vite, les pneus glissent.`},cod:[],cause:'Pneus usés.'},
{id:'rotule',txt:'Un claquement sec à l\'avant en braquant et sur les dos d\'âne, la direction est floue.',c:'rotule',red:['amort','pneus'],dn:2,
 ins:{rotule:`Soufflet déchiré, jeu au levier : la rotule bouge dans son logement.`,amort:`Amortisseurs secs, sans fuite.`,pneus:`Pneus usés des deux côtés de façon régulière.`},
 ess:{virage:`En virage : claquement sec et direction imprécise.`,bosses:`Sur les bosses : claquement métallique à l'avant.`},cod:[],cause:'Rotules de suspension avec du jeu.'},
{id:'roulement',txt:'Un ronronnement qui grandit avec la vitesse et change dans les virages.',c:'roulement',red:['pneus','disq_av','plaq_av'],dn:3,
 ins:{roulement:`La roue bouge quand on la secoue, bruit de roulement à la main.`,pneus:`Pneus un peu usés mais réguliers, sans bruit.`,disq_av:`Disques sains, aucun frottement.`,plaq_av:`Plaquettes en état, pas de grincement.`},
 ess:{vitesse:`À vitesse stabilisée : ronronnement qui monte avec la vitesse.`,virage:`En virage : le bruit augmente d'un côté et diminue de l'autre.`},cod:[],cause:'Roulement de roue avant usé.'},
{id:'cardan',txt:'Un claquement quand je braque à fond en accélérant.',c:'cardan',red:['rotule','amort'],dn:3,
 ins:{cardan:`Soufflet déchiré, graisse projetée autour, jeu dans le joint.`,rotule:`Aucun jeu dans les rotules.`,amort:`Pas de fuite aux amortisseurs.`},
 ess:{virage:`En braquant à fond sous accélération : claquement répété, au rythme des roues.`},cod:[],cause:'Cardan avant usé (soufflet déchiré).'},
{id:'huile_bruit',txt:'Le moteur est plus bruyant et la jauge d\'huile est toute noire.',c:'huile',red:['filtre_huile'],dn:1,
 ins:{huile:`Huile noire et pâteuse, jauge collante.`,filtre_huile:`Filtre encrassé : à changer en même temps, mais il n'explique pas le bruit.`},
 ess:{ralenti:`Au ralenti : cliquetis léger dans la partie haute du moteur.`},cod:[],cause:'Huile épuisée.'},
{id:'reprise',txt:'Il manque de reprise et consomme un peu plus.',c:'filtre_air',red:['bougies','debitmetre'],dn:1,
 ins:{filtre_air:`Filtre noir de poussière, plié, presque bouché.`,bougies:`Bougies correctes, légèrement grises.`,debitmetre:`Connecteur propre, rien d'anormal à l'œil.`},
 ess:{accel:`En accélérant : le moteur répond mollement, surtout à pleine charge.`},cod:[],cause:'Filtre à air bouché.'},
{id:'moisi',txt:'Une odeur de moisi sort de la ventilation et les vitres s\'embuent.',c:'filtre_hab',red:[],dn:1,ins:{filtre_hab:`Filtre gris et humide, feuilles et odeur de moisi.`},cod:[],cause:`Filtre d'habitacle saturé.`},
/* — électricité, démarrage, charge — */
{id:'demarre',txt:'Elle démarre mal le matin, le démarreur tourne mollement.',c:'batterie',red:['alternateur'],dn:1,
 ins:{batterie:`Bornes sulfatées (poudre blanche), la batterie s'effondre au test de charge.`,alternateur:`Courroie tendue, aucun bruit de roulement : l'alternateur semble sain.`},
 ess:{demarrage:`Au démarrage : le démarreur tourne mollement et les phares faiblissent.`},cause:'Batterie en fin de vie, trop faible pour lancer le moteur par temps froid.'},
{id:'sifflet',txt:'Un sifflement strident au démarrage.',c:'courroie_acc',red:['batterie'],dn:2,
 ins:{courroie_acc:`Courroie vitrifiée et craquelée, elle patine sur les poulies.`,batterie:`Bornes propres, batterie correcte.`},
 ess:{demarrage:`Au démarrage, surtout à froid : un sifflement strident qui diminue ensuite.`},cod:[],cause:`Courroie d'accessoires usée.`},
{id:'voyant',txt:`Le voyant de batterie s'allume en roulant.`,c:'alternateur',red:['batterie'],dn:3,
 ins:{alternateur:`Roulement bruyant, courroie propre : la charge ne remonte pas.`,batterie:`Un peu fatiguée, mais elle se recharge au chargeur.`},
 ess:{ralenti:`Moteur tournant : le voyant de charge s'allume et les phares faiblissent au ralenti.`},cause:`Alternateur qui ne charge plus.`},
{id:'clic',txt:'Je tourne la clé et il ne se passe rien, juste un clic.',c:'demarreur',red:['batterie'],dn:3,
 ins:{demarreur:`Le solénoïde claque sans lancer le moteur : les charbons sont usés.`,batterie:`12,5 V à vide et en charge : la batterie est correcte.`},
 ess:{demarrage:`À la clé : un simple clic, mais les phares restent bien allumés.`},cause:'Démarreur hors service.'},
{id:'alt_batt',txt:'La batterie est à plat tous les matins, même après un rechargement.',c:'alternateur',red:['courroie_acc'],ch:['batterie'],dn:3,
 ins:{alternateur:`Tension 12,1 V moteur tournant : les diodes sont grillées, l'alternateur ne charge pas.`,batterie:`Déchargée en profondeur plusieurs fois : sulfatée, à changer aussi.`,courroie_acc:`Courroie bien tendue, elle entraîne l'alternateur.`},
 ess:{demarrage:`Au démarrage : démarreur mou ; le voyant de charge reste allumé en roulant.`},cause:`Alternateur en panne qui a vidé et abîmé la batterie.`},
{id:'prechauf',txt:'Démarrage très long à froid, de la fumée blanche, mais ça va mieux à chaud.',c:'bougies',red:['batterie','demarreur','filtre_gazole'],f:'diesel',dn:2,
 ins:{bougies:`Bougies de préchauffage coupées : la résistance ne chauffe plus (au contrôleur).`,batterie:`Batterie à 12,6 V : correcte.`,demarreur:`Démarreur vif, il lance bien le moteur.`,filtre_gazole:`Filtre en bon état.`},
 ess:{froid:`À froid : démarrage long, fumée blanche, voyant de préchauffage qui clignote.`},cod:[`P0380 : circuit des bougies de préchauffage défectueux.`,`P0671 : bougie de préchauffage du cylindre 1.`],cause:'Bougies de préchauffage usées.'},
{id:'cale_froid',txt:'Ça démarre mal à froid avec de la fumée noire, puis ça va, et le ventilateur tourne tout le temps.',c:'sonde_temp',red:['thermostat','bougies'],dn:3,
 ins:{sonde_temp:`Connecteur oxydé : elle annonce −40 °C en permanence, le calculateur croit le moteur glacé.`,thermostat:`Thermostat correct : le chauffage est bien chaud.`,bougies:`Bougies correctes.`},
 ess:{froid:`À froid : le moteur tousse et fume noir (mélange trop riche).`,chaud:`Moteur chaud : le ventilateur tourne en permanence.`},cod:[`P0117 : signal de la sonde de température d'eau trop bas.`],cause:`Sonde de température défaillante : le mélange est toujours enrichi.`},
/* — allumage, injection, carburant — */
{id:'acoups',txt:`Elle a des à-coups quand j'accélère.`,c:'bougies',red:['filtre_air','bobines'],f:'essence',dn:2,
 ins:{bougies:`Électrodes usées et écartées, dépôt noir.`,filtre_air:`Filtre sale mais l'air passe encore.`,bobines:`Bobines propres, isolants intacts.`},
 ess:{accel:`En accélérant : à-coups et trous, surtout à mi-régime.`},cod:[`P0300 : ratés d'allumage détectés (plusieurs cylindres).`],cause:`Bougies d'allumage usées.`},
{id:'rates_bobine',txt:'Ça tousse et ça a des ratés, surtout à froid ou quand il pleut, et le voyant moteur clignote.',c:'bobines',red:['bougies','filtre_air'],f:'essence',dn:2,
 ins:{bobines:`Isolant fissuré et traces d'étincelles : le courant fuit vers la masse.`,bougies:`Bougies usées mais encore correctes.`,filtre_air:`Filtre propre.`},
 ess:{froid:`À froid : ratés et vibrations dans le volant.`,accel:`En accélérant : trous, le voyant clignote.`},cod:[`P0302 : raté d'allumage, cylindre 2.`,`P0352 : circuit de la bobine d'allumage B.`],cause:`Bobine d'allumage défectueuse.`},
{id:'rates_longs',txt:`Il a des ratés depuis des mois et ça sent l'essence mal brûlée sous la voiture.`,c:'bobines',red:['bougies'],ch:['catalyseur'],f:'essence',dn:3,
 ins:{bobines:`Plusieurs bobines claquées : l'essence non brûlée part à l'échappement.`,bougies:`Bougies noircies par les ratés, mais elles ne sont pas la cause.`,catalyseur:`Catalyseur surchauffé et fondu par l'essence non brûlée : à changer.`},
 ess:{accel:`En accélérant : trous et manque de puissance, odeur d'essence brûlée.`},cod:[`P0300 : ratés d'allumage détectés (plusieurs cylindres).`,`P0420 : efficacité du catalyseur sous le seuil.`],cause:`Bobines HS : rouler ainsi a détruit le catalyseur.`},
{id:'froid',txt:'Le ralenti est instable et la consommation a grimpé.',c:'sonde_lambda',red:['bougies','filtre_air','debitmetre'],dn:3,
 ins:{sonde_lambda:`Rien à voir à l'œil : une sonde s'encrasse sans se casser.`,bougies:`Bougies correctes, légèrement grises.`,filtre_air:`Filtre un peu sale, sans conséquence.`,debitmetre:`Connecteur propre.`},
 ess:{ralenti:`Au ralenti : régime instable, odeur d'essence à l'échappement.`},cod:[`P0130 : circuit de la sonde lambda défectueux (banc 1).`,`P0133 : réponse lente de la sonde lambda.`],cause:`Sonde lambda encrassée : le mélange n'est plus corrigé.`},
{id:'debitmetre',txt:'Il manque de puissance, le ralenti est irrégulier et le voyant moteur est allumé.',c:'debitmetre',red:['filtre_air','vanne_egr','sonde_lambda'],dn:3,
 ins:{debitmetre:`Élément chaud encrassé : il mesure moins d'air qu'il n'en passe.`,filtre_air:`Filtre un peu sale, mais l'air passe.`,vanne_egr:`Vanne mobile, pas collée.`,sonde_lambda:`Sonde correcte au contrôle.`},
 ess:{ralenti:`Au ralenti : régime irrégulier.`,accel:`En accélérant : creux et manque de reprise (mode dégradé).`},cod:[`P0101 : performance du débitmètre d'air (plage de mesure).`],cause:`Débitmètre d'air encrassé.`},
{id:'fumee',txt:'Fumée noire et consommation en hausse.',c:'injecteurs',red:['filtre_air','bougies','vanne_egr'],f:'diesel',dn:4,
 ins:{injecteurs:`Rampe sèche, aucune fuite extérieure : les injecteurs fuient à l'intérieur.`,filtre_air:`Filtre sale mais pas bouché.`,bougies:`Bougies de préchauffage en état.`,vanne_egr:`Vanne un peu encrassée mais mobile.`},
 ess:{ralenti:`Au ralenti : irrégulier, fumée noire à l'échappement.`,accel:`En accélérant : fumée noire épaisse.`},cod:[`P0301 : raté de combustion, cylindre 1.`,`P0303 : raté de combustion, cylindre 3.`],cause:'Injecteurs encrassés.'},
{id:'inj_dilue',txt:`Fumée noire, ça sent le gazole et le niveau d'huile monte.`,c:'injecteurs',red:['filtre_air','vanne_egr'],ch:['huile','filtre_huile'],f:'diesel',dn:4,
 ins:{injecteurs:`Un injecteur reste ouvert : le gazole coule dans le cylindre et passe dans l'huile.`,huile:`Huile fluide qui sent le gazole : à vidanger.`,filtre_huile:`Filtre saturé.`,filtre_air:`Filtre un peu sale.`,vanne_egr:`Vanne mobile.`},
 ess:{ralenti:`Au ralenti : cliquetis net du cylindre noyé, fumée noire.`},cod:[`P0301 : raté de combustion, cylindre 1.`,`P0263 : déséquilibre de puissance du cylindre 1.`],cause:`Injecteur défectueux qui a dilué l'huile : vidange à faire.`},
{id:'gazole',txt:`À fond, ça s'étouffe et ça a des à-coups ; le démarrage est parfois long.`,c:'filtre_gazole',red:['filtre_air','injecteurs'],f:'diesel',dn:2,
 ins:{filtre_gazole:`Cartouche noire et eau au fond du bocal.`,filtre_air:`Filtre un peu sale.`,injecteurs:`Aucune fuite visible.`},
 ess:{accel:`À pleine charge : à-coups, puis perte de puissance.`},cod:[`P0087 : pression de rampe de carburant trop basse.`],cause:'Filtre à gazole colmaté.'},
{id:'pompe_carb',txt:'Il cale à chaud puis refuse de repartir quelques minutes ; on entend un sifflement vers le réservoir.',c:'pompe_carburant',red:['filtre_gazole','batterie'],dn:4,
 ins:{pompe_carburant:`Pompe bruyante, crépine colmatée, débit faible au test.`,filtre_gazole:`Filtre en bon état.`,batterie:`Batterie correcte.`},
 ess:{chaud:`Moteur chaud : à-coups puis calage, sifflement vers l'arrière.`,accel:`À pleine charge : le moteur s'étouffe.`},cod:[`P0087 : pression de rampe de carburant trop basse.`,`P0171 : mélange trop pauvre (banc 1).`],cause:'Pompe à carburant fatiguée.'},
{id:'pmh',txt:'Il cale net en roulant, repart quand il a refroidi, et le compte-tours tombe à zéro.',c:'capteur_pmh',red:['batterie','demarreur','pompe_carburant'],dn:4,
 ins:{capteur_pmh:`Propre à l'œil, mais le signal disparaît à chaud (test à l'oscilloscope).`,batterie:`Batterie correcte : le moteur tourne bien à la clé.`,demarreur:`Démarreur vif et sain.`,pompe_carburant:`La pompe s'entend bien au contact.`},
 ess:{chaud:`Moteur chaud : calage soudain, le compte-tours tombe à zéro.`,demarrage:`Au redémarrage à chaud : le démarreur tourne mais le moteur ne prend pas.`},cod:[`P0335 : circuit du capteur de vilebrequin (PMH) défectueux.`],cause:'Capteur de vilebrequin qui lâche à chaud.'},
{id:'arbre',txt:'Le démarrage est plus long, il a des à-coups et le voyant moteur est allumé.',c:'capteur_arbre',red:['capteur_pmh','bougies'],dn:4,
 ins:{capteur_arbre:`Connecteur et capteur propres : le défaut est électrique.`,capteur_pmh:`Connecteur sain.`,bougies:`Bougies en état correct.`},
 ess:{demarrage:`Au démarrage : la rotation est longue avant que le moteur prenne.`,accel:`En accélérant : à-coups et puissance limitée (mode dégradé).`},cod:[`P0340 : circuit du capteur d'arbre à cames défectueux.`,`P0341 : performance du capteur d'arbre à cames.`],cause:`Capteur d'arbre à cames défectueux.`},
{id:'egr',txt:'Le moteur cale au ralenti, manque de reprise à bas régime et le voyant moteur est allumé.',c:'vanne_egr',red:['debitmetre','filtre_air'],f:'diesel',dn:3,
 ins:{vanne_egr:`Calamine noire et huileuse, clapet collé ouvert.`,filtre_air:`Filtre sale mais le passage d'air reste correct.`,debitmetre:`Connecteur propre ; seule la valise dira si ses mesures sont bonnes.`},
 ess:{ralenti:`Au ralenti : le moteur tremble et menace de caler.`,accel:`Aux bas régimes : trou à l'accélération, fumée noire.`},cod:[`P0401 : débit de recirculation des gaz (EGR) insuffisant.`,`P0403 : circuit de commande de la vanne EGR.`],fx:{debitmetre:`P0101 : performance du débitmètre d'air (l'air mesuré est faussé par l'EGR).`},cause:'Vanne EGR encrassée par la calamine.'},
{id:'fap',txt:'Le voyant du filtre à particules est allumé, la voiture manque de puissance, et je ne fais que des petits trajets.',c:'fap',red:['vanne_egr','debitmetre'],f:'diesel',dn:4,
 ins:{fap:`Filtre saturé de suie : contre-pression élevée, capteur de pression différentielle correct.`,vanne_egr:`Vanne un peu sale, mais elle bouge librement.`,debitmetre:`Connecteur propre.`},
 ess:{accel:`En accélérant : la voiture se bride (mode dégradé), odeur âcre.`,chaud:`Moteur chaud : ventilateur qui tourne après l'arrêt, régénération qui n'aboutit jamais.`},cod:[`P2002 : efficacité du filtre à particules sous le seuil (banc 1).`,`P2463 : accumulation de suie dans le filtre à particules.`],cause:'Filtre à particules colmaté.'},
{id:'turbo',txt:`La voiture n'a plus de puissance, siffle fort et fume bleu-gris ; le niveau d'huile baisse.`,c:'turbo',red:['filtre_air','vanne_egr'],ch:['huile','filtre_huile'],dn:4,
 ins:{turbo:`Jeu excessif de l'arbre de turbine, huile dans les conduits d'admission.`,filtre_air:`Filtre sale mais l'air passe.`,vanne_egr:`Vanne encrassée mais mobile.`,huile:`Huile noire pleine de particules : à changer avec le turbo.`,filtre_huile:`Filtre chargé de limaille : à changer aussi.`},
 ess:{accel:`En accélérant : sifflement de sirène, pas de poussée, fumée bleutée.`,vitesse:`À vitesse stabilisée : la puissance s'effondre dès qu'on appuie.`},cod:[`P0299 : pression de suralimentation insuffisante.`],cause:'Turbo usé qui laisse passer huile et air.'},
{id:'cata',txt:`Elle s'essouffle en côte, ça sent l'œuf pourri et ça cliquette sous le plancher.`,c:'catalyseur',red:['sonde_lambda'],dn:3,
 ins:{catalyseur:`Céramique brisée : ça cliquette quand on tape sur le boîtier.`,sonde_lambda:`Sonde correcte, signaux nets.`},
 ess:{accel:`En côte : puissance limitée, odeur d'œuf pourri.`,ralenti:`Au ralenti : cliquetis sous le plancher.`},cod:[`P0420 : efficacité du catalyseur sous le seuil (banc 1).`],cause:'Catalyseur détruit (échappement colmaté).'},
/* — refroidissement — */
{id:'surchauffe',txt:'Le moteur chauffe vite : la durite du haut est brûlante et celle du bas reste froide.',c:'thermostat',red:['pompe_eau','ventilateur','radiateur'],dn:3,
 ins:{thermostat:`Boîtier suintant, clapet resté fermé : la durite du bas reste froide.`,pompe_eau:`Pompe sans jeu, aucune trace de fuite.`,ventilateur:`Le ventilateur se déclenche bien.`,radiateur:`Propre, chaud en haut seulement : il ne reçoit pas de liquide.`},
 ess:{chaud:`Moteur chaud : l'aiguille de température monte jusqu'au rouge.`},cod:[`P0217 : surchauffe du moteur détectée.`],cause:'Thermostat bloqué fermé.'},
{id:'surchauffe_grave',txt:`Le moteur a surchauffé, j'ai continué à rouler, et maintenant il fume blanc.`,c:'thermostat',red:['pompe_eau','radiateur'],ch:['joint_culasse'],dn:5,
 ins:{thermostat:`Clapet resté fermé : c'est lui qui a causé la surchauffe.`,pompe_eau:`Pompe sans fuite.`,radiateur:`Radiateur sain.`,joint_culasse:`Joint percé par la surchauffe : huile laiteuse, bulles dans le vase.`},
 ess:{chaud:`Moteur chaud : fumée blanche sucrée, la température grimpe.`},cod:[`P0217 : surchauffe du moteur détectée.`],cause:`Thermostat bloqué : la surchauffe a percé le joint de culasse.`},
{id:'thermo_ouvert',txt:'Le chauffage souffle tiède, le moteur met très longtemps à chauffer et la consommation a augmenté.',c:'thermostat',red:['sonde_temp','ventilateur'],dn:3,
 ins:{thermostat:`Clapet bloqué ouvert : le liquide passe toujours par le radiateur.`,ventilateur:`Ventilateur normal.`,sonde_temp:`Connecteur propre ; la valise donne la température mesurée.`},
 ess:{froid:`À froid : la température reste basse très longtemps.`,chaud:`Même après vingt minutes : l'aiguille n'atteint pas 90 °C.`},cod:[`P0128 : température du liquide de refroidissement sous le seuil de régulation.`],cause:'Thermostat bloqué ouvert.'},
{id:'culasse',txt:'Fumée blanche épaisse, le niveau de liquide baisse sans fuite visible et le moteur chauffe.',c:'joint_culasse',red:['thermostat','radiateur','pompe_eau'],dn:5,
 ins:{joint_culasse:`Huile laiteuse (mayonnaise) sous le bouchon, bulles dans le vase : le joint est percé.`,thermostat:`Thermostat qui s'ouvre normalement.`,radiateur:`Radiateur sec, sans fuite.`,pompe_eau:`Pompe sans jeu ni suintement.`},
 ess:{chaud:`Moteur chaud : fumée blanche sucrée à l'échappement, température qui grimpe.`,ralenti:`Au ralenti : léger tremblement et vapeur.`},cod:[`P0217 : surchauffe du moteur détectée.`],cause:'Joint de culasse percé.'},
{id:'pompe_eau',txt:'Une flaque rose sous le moteur, le niveau de liquide baisse et ça siffle à l\'avant.',c:'pompe_eau',red:['durite','radiateur'],ch:['courroie_acc'],dn:3,
 ins:{pompe_eau:`Trace rose séchée sous l'orifice témoin de la pompe, jeu dans la poulie.`,durite:`Durites souples, colliers secs.`,radiateur:`Radiateur sec, pas de trace de fuite.`,courroie_acc:`Courroie imbibée de liquide de refroidissement : elle patine, à changer.`},
 ess:{chaud:`Moteur chaud : sifflement et odeur sucrée sous le capot.`,ralenti:`Au ralenti : léger grondement de roulement côté courroie.`},cod:[],cause:`Pompe à eau qui fuit : elle a aussi abîmé la courroie.`},
{id:'radiateur',txt:'Odeur sucrée devant la voiture, le niveau de liquide baisse et le moteur chauffe en côte.',c:'radiateur',red:['durite','pompe_eau'],dn:3,
 ins:{radiateur:`Suintement rose aux boîtes à eau, ailettes noyées de liquide.`,durite:`Durites sèches.`,pompe_eau:`Aucune trace de fuite à la pompe.`},
 ess:{chaud:`Moteur chaud, en côte : la température monte, odeur sucrée.`},cod:[],cause:'Radiateur qui fuit.'},
{id:'durite',txt:'De la vapeur sort du capot à l\'arrêt et il y a des gouttes de liquide au sol.',c:'durite',red:['radiateur','pompe_eau'],dn:2,
 ins:{durite:`Durite gonflée et craquelée, goutte au collier : c'est le point de fuite.`,radiateur:`Radiateur sec.`,pompe_eau:`Pompe sèche.`},
 ess:{chaud:`Moteur chaud : vapeur et odeur sucrée au premier arrêt.`},cod:[],cause:'Durite de refroidissement fendue.'},
{id:'ventilo',txt:'Ça chauffe seulement dans les bouchons, et ça redescend dès que je roule vite.',c:'ventilateur',red:['thermostat','sonde_temp'],dn:3,
 ins:{ventilateur:`Hélice calée à la main, connecteur noirci : il ne tourne jamais.`,thermostat:`Thermostat sain, il s'ouvre au bon moment.`,sonde_temp:`Connecteur propre.`},
 ess:{ralenti:`À l'arrêt, moteur chaud : la température monte, le ventilateur reste immobile.`,vitesse:`À vitesse stabilisée : la température redescend.`},cod:[`P0480 : circuit de commande du ventilateur de refroidissement.`],cause:'Motoventilateur en panne.'},
/* — fuites d'huile, distribution, transmission, chaînes de pannes — */
{id:'claque',txt:'Un claquement irrégulier dans le moteur.',c:'courroie_dist',red:['courroie_acc'],dn:4,
 ins:{courroie_dist:`Dents usées, galet qui accroche : risque de rupture.`,courroie_acc:`Courroie d'accessoires propre et bien tendue.`},
 ess:{ralenti:`Au ralenti : claquement irrégulier côté distribution.`},cod:[],cause:'Distribution en fin de vie.'},
{id:'distri_cassee',txt:`Le moteur s'est coupé net en roulant et il ne redémarre plus : le démarreur tourne trop vite.`,c:'courroie_dist',red:['courroie_acc','batterie'],ch:['joint_culasse'],dn:5,
 ins:{courroie_dist:`Courroie rompue : le vilebrequin et l'arbre à cames ne sont plus synchronisés.`,joint_culasse:`Soupapes faussées par les pistons : culasse à refaire avec son joint.`,courroie_acc:`Courroie d'accessoires intacte.`,batterie:`Batterie correcte.`},
 ess:{demarrage:`Au démarrage : le démarreur tourne à vide, trop vite, sans aucune compression.`},cod:[`P0016 : corrélation vilebrequin et arbre à cames (banc 1).`],cause:'Distribution rompue : elle a faussé les soupapes.'},
{id:'joint_cc',txt:'Ça sent l\'huile chaude, une fumée légère sort du côté du moteur, et il a des ratés.',c:'joint_cc',red:['joint_spi','huile'],ch:['bougies'],f:'essence',dn:2,
 ins:{joint_cc:`Huile suintante sur le haut du moteur : le joint de cache-culbuteurs est dur et fendu.`,joint_spi:`Zone sèche derrière la poulie.`,huile:`Niveau un peu bas, huile en état.`,bougies:`Puits de bougies pleins d'huile : bougies encrassées, à changer.`},
 ess:{ralenti:`À l'arrêt, moteur chaud : odeur d'huile brûlée.`,accel:`En accélérant : ratés légers.`},cod:[`P0301 : raté d'allumage, cylindre 1.`],cause:`Joint de cache-culbuteurs fendu : l'huile a noyé les bougies.`},
{id:'joint_spi',txt:`Une tache d'huile sous l'avant de la voiture et le niveau d'huile baisse.`,c:'joint_spi',red:['joint_cc','filtre_huile'],ch:['courroie_acc'],dn:3,
 ins:{joint_spi:`L'huile coule derrière la poulie de vilebrequin : le joint spi est durci.`,joint_cc:`Haut du moteur sec.`,filtre_huile:`Filtre bien serré, sans suintement.`,courroie_acc:`Courroie imbibée d'huile et gonflée : à changer.`},
 ess:{ralenti:`À l'arrêt : odeur d'huile chaude du côté de la courroie.`},cod:[],cause:`Joint spi de vilebrequin qui fuit : l'huile a abîmé la courroie.`},
{id:'patine',txt:'Ça patine en côte et ça sent le brûlé.',c:'embrayage',red:[],dn:3,
 ins:{embrayage:`Friction brûlée, disque fendu ; la pédale accroche très haut.`},
 ess:{accel:`En accélérant : le régime monte sans que la voiture avance, odeur de brûlé.`},cod:[],cause:'Embrayage usé qui patine.'},
{id:'bimasse',txt:'Des claquements et des vibrations au ralenti, et une secousse à chaque arrêt du moteur.',c:'volant_bimasse',red:['embrayage','courroie_acc','courroie_dist'],ch:['embrayage'],dn:5,
 ins:{volant_bimasse:`Jeu angulaire excessif entre les deux masses, graisse rejetée.`,embrayage:`Disque usé : il se change avec le volant (même dépose de boîte).`,courroie_acc:`Courroie correcte.`,courroie_dist:`Distribution silencieuse.`},
 ess:{ralenti:`Au ralenti : claquement sourd régulier, vibrations dans le plancher.`,demarrage:`À l'arrêt du moteur : grosse secousse.`},cod:[],cause:'Volant bimasse usé : on change aussi le kit embrayage.'}
];

/* ── pièces absentes selon la voiture ── */
const DIESEL=['vanne_egr','fap','filtre_gazole'],ESSENCE=['bobines'],MECA_ONLY=['volant_bimasse'];
const CHASSIS=['rotule','roulement','cardan'];
function applies(m,id){
 if(!PD.some(a=>a[0]===id)) return true;
 const c=car(m);if(!c) return DIESEL.indexOf(id)<0&&ESSENCE.indexOf(id)<0&&id!=='turbo'&&id!=='volant_bimasse'&&id!=='fap';
 if(c.ev) return CHASSIS.includes(id);
 const e=c.eng||{};
 if(DIESEL.includes(id)) return e.fuel==='diesel';
 if(ESSENCE.includes(id)) return e.fuel==='essence';
 if(id==='turbo') return e.asp&&e.asp!=='atmo';
 if(id==='volant_bimasse') return c.gb==='man'&&(e.fuel==='diesel'||(e.asp&&e.asp!=='atmo'));
 if(id==='cardan') return c.drive!=='rwd';
 return true;}
function fuelOK(m,y){const c=car(m);if(!y||!y.f||!c) return true;return !!c.eng&&c.eng.fuel===y.f;}
return {PD,TPL,TOOLS,ESS,SYMP,applies,fuelOK};
})();
window.__mwp=MWP;
