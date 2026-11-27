'use strict';
/* ───────────── Mode « Mécanicien » — BOÎTES DE VITESSES : pièces, travaux et pannes (données) ─────────────

   Ce fichier complète les données de js/51 (chargé juste avant) sans le modifier : il ajoute à MWP
     - les pièces propres aux boîtes (huile, filtre, support, câbles de commande, joint spi, soufflets de cardan),
     - les modèles de travaux correspondants (vidange de boîte manuelle, vidange de boîte automatique avec filtre, etc.),
     - les symptômes à diagnostiquer (craquement aux passages, à-coups, patinage, bruit de roulement, fuite),
     - les règles « cette voiture a-t-elle cette pièce ? » selon son type de boîte (manuelle, automatique, double embrayage, électrique).

   Le type de boîte vient de MWBOX.specOf (js/07c). Les intervalles de vidange sont des valeurs usuelles : beaucoup de constructeurs
   annoncent une huile « à vie », mais les ateliers recommandent une vidange tous les 60 000 à 120 000 km selon la boîte.

   Les gestes (déposer, remplir, resserrer…) sont décrits dans js/46 (entrées SPECS), les repères sur la boîte dans js/07c. */
(function chargerDonneesBoites(){
if(typeof MWP==='undefined') return;

/* ── nouvelles pièces : même format que PD de js/51 ── */
const PIECES=[
['huile_boite','Huile de boîte de vitesses','H.Boîte','dessous','','transmission',2,45,45,'cles',0,120000,'accel',
 `Les rapports passent mal et la boîte est bruyante.`,`Huile sombre et chargée de limaille fine sur le bouchon magnétique.`,''],
['filtre_boite','Filtre et joint de carter de boîte automatique','F.Boîte','dessous','','transmission',3,85,70,'cles',0,80000,'accel',
 `La boîte automatique a des à-coups au passage des rapports.`,`Filtre colmaté de dépôts, joint de carter suintant.`,''],
['cables_boite','Câbles de commande de boîte','C.Boîte','dessous','','transmission',3,75,60,'cles',0,160000,'vitesse',
 `Le levier est mou et les rapports se trouvent mal.`,`Gaine fendue, embout jouant dans sa rotule.`,''],
['support_boite','Support de boîte de vitesses','S.Boîte','dessous','','transmission',3,70,90,'cle_dyn',0,150000,'accel',
 `Un « clong » sourd résonne quand on lâche ou qu'on reprend l'accélérateur.`,`Bloc de caoutchouc déchiré, la boîte se balade dans son logement.`,''],
['joint_spi_boite','Joint spi de sortie de boîte','Spi Boîte','dessous','','transmission',3,18,75,'cles',0,180000,'ralenti',
 `Des gouttes d'huile tombent sous la boîte, et le niveau baisse.`,`Suintement d'huile autour de la sortie de cardan.`,''],
['soufflet_cardan','Soufflets de cardan côté boîte (paire)','Souff.','dessous','','transmission',2,35,60,'cles',0,120000,'virage',
 `De la graisse est projetée autour des cardans.`,`Soufflet fendu : de la graisse a été projetée sur le dessous.`,'']];

/* ── modèles de travaux : [id, nom, pièces, poids de tirage] ── */
const TRAVAUX=[
['vid_boite','Vidange de la boîte de vitesses',['huile_boite'],.9],
['vid_boite_auto','Vidange de boîte automatique avec filtre',['huile_boite','filtre_boite'],.7],
['supp_boite','Support de boîte de vitesses',['support_boite'],.5],
['cables_boite','Câbles de commande de boîte',['cables_boite'],.5],
['soufflets','Soufflets de cardan',['soufflet_cardan'],.5],
['spi_boite','Fuite de boîte : joint spi de sortie',['joint_spi_boite'],.5]];

/* ── outils conseillés (servante) ── */
const OUTILS={
 huile_boite:['cliquet','bidon','bac'],filtre_boite:['cliquet','cle_dyn','bac','bidon'],cables_boite:['cliquet','pinces'],
 support_boite:['cliquet','cle_dyn'],joint_spi_boite:['cliquet','pinces','bac'],soufflet_cardan:['pinces','cliquet']};

/* ── symptômes ──
   g : type de boîte exigé ('man', 'auto', 'dct') ; sans g, toutes les boîtes sauf la voiture électrique. */
const SYMPTOMES=[
{id:'craque',g:'man',txt:'Ça craque quand je passe la deuxième ou la troisième, surtout à froid.',c:'huile_boite',red:['embrayage','cables_boite'],dn:2,
 ins:{huile_boite:`Huile sombre, odeur de brûlé, limaille fine sur l'aimant du bouchon : les synchros travaillent à sec.`,
  embrayage:`Garde de pédale correcte, l'embrayage débraye franchement : il n'est pas en cause.`,cables_boite:`Câbles souples, sans jeu dans leurs rotules.`},
 ess:{froid:`À froid : craquement net en passant la deuxième, qui disparaît quand la boîte chauffe.`},cod:[],
 cause:`Huile de boîte épuisée : les synchroniseurs patinent et craquent.`},
{id:'dur',g:'man',txt:'Le levier est mou et je cherche les vitesses, surtout la marche arrière.',c:'cables_boite',red:['huile_boite','embrayage'],dn:3,
 ins:{cables_boite:`Gaine fendue et embout ovalisé : le levier a du jeu avant que la boîte réagisse.`,
  huile_boite:`Huile un peu vieille mais propre : la boîte est saine.`,embrayage:`L'embrayage débraye correctement.`},
 ess:{vitesse:`À l'arrêt, moteur tournant : le levier se balade dans toutes les positions et la marche arrière résiste.`},cod:[],
 cause:'Câbles de commande usés : la sélection est imprécise.'},
{id:'acoups_auto',g:'auto',txt:`La boîte automatique a des à-coups quand elle change de rapport, surtout à chaud.`,c:'huile_boite',red:['support_boite'],ch:['filtre_boite'],dn:3,
 ins:{huile_boite:`Huile brune, brûlée, avec des particules de garniture : à vidanger.`,
  filtre_boite:`Filtre saturé de dépôts de garnitures : à changer avec l'huile.`,support_boite:`Support en bon état, boîte bien tenue.`},
 ess:{accel:`En accélérant : les rapports passent avec un à-coup, parfois avec un glissement.`,chaud:`À chaud : à-coups plus marqués, rétrogradages brutaux.`},
 cod:[`P0741 : embrayage de pontage du convertisseur de couple, performance.`],cause:`Huile de boîte automatique fatiguée et filtre colmaté.`},
{id:'acoups_dct',g:'dct',txt:`La boîte à double embrayage saccade à basse vitesse et fait des à-coups en manœuvre.`,c:'huile_boite',red:['support_boite'],dn:4,
 ins:{huile_boite:`Huile oxydée et chargée de poussière d'embrayage : elle ne protège plus les lamelles.`,support_boite:`Support intact.`},
 ess:{ralenti:`En manœuvre : à-coups au moment où l'embrayage se ferme, voiture qui broute.`},cod:[`P0841 : capteur de pression hydraulique de boîte, plage de mesure.`],
 cause:`Huile de boîte à double embrayage épuisée.`},
{id:'clong',txt:`J'entends un « clong » dans le plancher quand je lâche puis reprends l'accélérateur.`,c:'support_boite',red:['huile_boite','amort'],dn:3,
 ins:{support_boite:`Bloc de caoutchouc déchiré : la boîte monte et tape contre le berceau à chaque variation de couple.`,
  huile_boite:`Huile correcte, niveau bon.`,amort:`Amortisseurs sans fuite.`},
 ess:{accel:`En lâchant puis en reprenant l'accélérateur : un « clong » sourd venu du plancher.`,ralenti:`Au ralenti, vitesse enclenchée : vibrations dans le levier.`},cod:[],
 cause:'Support de boîte de vitesses déchiré.'},
{id:'fuite_boite',txt:`Il y a une tache d'huile sous la voiture, côté roue, et la boîte devient bruyante.`,c:'joint_spi_boite',red:['huile_boite','soufflet_cardan'],dn:2,
 ins:{joint_spi_boite:`Huile suintante autour de la sortie de cardan : la lèvre du joint est durcie.`,
  huile_boite:`Niveau un peu bas, huile encore propre : elle fuit, elle n'est pas morte.`,soufflet_cardan:`Soufflets entiers, sans graisse projetée.`},
 ess:{ralenti:`À l'arrêt : une goutte d'huile se forme sous la sortie de boîte.`},cod:[],cause:'Joint spi de sortie de boîte fatigué : la boîte fuit.'},
{id:'graisse',txt:`Il y a de la graisse noire projetée autour des cardans, et un petit claquement en virage.`,c:'soufflet_cardan',red:['cardan'],dn:2,
 ins:{soufflet_cardan:`Soufflet fendu, graisse projetée sur le dessous : le joint prend la poussière.`,cardan:`Pas de jeu pour l'instant : le cardan lui-même est sauvé s'il est traité vite.`},
 ess:{virage:`En braquant : petit claquement sec, qui n'existe pas en ligne droite.`},cod:[],cause:`Soufflet de cardan déchiré : le joint va s'user.`},
{id:'bruit_boite',g:'man',txt:`La boîte fait un sifflement, qui change quand j'appuie sur la pédale d'embrayage.`,c:'huile_boite',red:['embrayage'],ch:['joint_spi_boite'],dn:4,
 ins:{huile_boite:`Huile très diluée et grise : un roulement de boîte s'use, de la limaille brille dans le bouchon.`,embrayage:`Butée silencieuse : le bruit continue pédale enfoncée.`,
  joint_spi_boite:`Joint spi usé par les vibrations : il faut le changer en même temps.`},
 ess:{vitesse:`À vitesse stabilisée : sifflement qui monte avec le régime, plus net au point mort pédale enfoncée.`},cod:[],
 cause:`Huile de boîte épuisée qui a abîmé un roulement : vidange et joint spi à faire.`}];

/* ═══ branchement sur MWP ═══ */
for(const p of PIECES) MWP.PD.push(p);
for(const t of TRAVAUX) MWP.TPL.push(t);
Object.assign(MWP.TOOLS,OUTILS);
for(const s of SYMPTOMES) MWP.SYMP.push(s);

/* quelles voitures ont quelles pièces de boîte */
const IDS=PIECES.map(p=>p[0]);
function voiture(m){try{return typeof MWCARS!=='undefined'&&m?MWCARS.get(m):null;}catch(e){return null;}}
function typeBoite(c){const sp=typeof MWBOX!=='undefined'?MWBOX.specOf(c):null;return sp?sp.type:c.gb;}
const appliquerAvant=MWP.applies;
MWP.applies=function(m,id){
 if(!IDS.includes(id)) return appliquerAvant(m,id);
 const c=voiture(m);
 if(!c) return ['huile_boite','support_boite','joint_spi_boite'].includes(id);
 if(c.ev) return false;
 const t=typeBoite(c);
 if(id==='filtre_boite') return t==='auto'||(typeof MWBOX!=='undefined'&&!!MWBOX.specOf(c).filtre);
 if(id==='cables_boite') return t==='man'||t==='auto';
 if(id==='soufflet_cardan') return c.drive!=='rwd';
 return true;};
const carburantAvant=MWP.fuelOK;
MWP.fuelOK=function(m,y){
 if(!carburantAvant(m,y)) return false;
 if(!y||!y.g) return true;
 const c=voiture(m);
 return !c||typeBoite(c)===y.g;};
})();
