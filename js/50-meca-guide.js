'use strict';
/* ───────────── Mode « Mécanicien » — GUIDE DU MÉCANICIEN (niveaux 0 à 5) ─────────────
   Manuel en jeu, touche H ou bouton « Guide (H) » : les bases (niveau 0), puis pour chaque niveau de compétence les travaux
   débloqués, les pièces à prendre, les outils (touches) et les étapes une à une, telles que les gestes réalistes de js/46
   les demandent. Le niveau du joueur est indiqué ; les chapitres pas encore atteints restent lisibles.
   ═══ API `MWGD` ═══  MWGD.open(niveau) ouvre le guide (0 à 5, défaut : le chapitre utile) ; MWGD.NIV nombre de chapitres. */
const MWGD=(()=>{
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const K=t=>`<kbd>${t}</kbd>`;
const ol=a=>`<ol class="mw-gd-ol">${a.map(x=>`<li>${x}</li>`).join('')}</ol>`;
const ul=a=>`<ul class="mw-gd-ul">${a.map(x=>`<li>${x}</li>`).join('')}</ul>`;
const job=(titre,comp,pieces,outils,etapes,note)=>`<details class="mw-gd-j"><summary><b>${titre}</b> <small>${comp}</small></summary>
 <p><b>Pièces à prendre à l'étagère :</b> ${pieces}</p><p><b>Outils :</b> ${outils}</p>${ol(etapes)}${note?`<p class="hint">${note}</p>`:''}</details>`;
const T={main:`Mains ${K(1)}`,cliquet:`Cliquet ${K(2)}`,filtre:`Clé à filtre ${K(3)}`,tournevis:`Tournevis ${K(4)}`,boul:`Boulonneuse ${K(5)}`,dyn:`Clé dynamométrique ${K(6)}`,
 bac:`Bac ${K(7)}`,bidon:`Bidon ${K(8)}`,ent:`Entonnoir ${K(9)}`,pinces:`Pinces ${K(0)}`,presse:'Presse (molette)',ser:'Seringue (molette)',douille:`taille de douille ${K('R')}`};
const LEVER=`Visez la <b>commande du pont élévateur</b> (boîtier sur la colonne) et maintenez ${K('E')} : <i>Lever le pont</i>.`;
const BAISSER=`Commande du pont, maintenir ${K('E')} : <i>Baisser le pont</i>.`;
const CAPOT=`Visez l'avant de la voiture, maintenez ${K('E')} : <i>Ouvrir le capot</i>.`;
const RENDRE=`Visez la <b>portière conducteur (habitacle)</b>, ${K('E')}, puis <i>Rendre la voiture</i> : facture, note et paie.`;
const ROUE_DEP=[`Roue au sol : ${T.boul} (ou ${T.cliquet}), visez chaque écrou, maintenez ${K('E')} : <i>Desserrer l'écrou au sol</i>.`,LEVER,
 `Retirez chaque écrou (même outil) : ils tombent dans le bac magnétique de la servante.`,`${T.main} : <i>Déposer la roue</i>.`];
const ROUE_REP=[`${T.main} : <i>Reposer la roue</i>, puis <i>Visser l'écrou</i> un par un.`,BAISSER,
 `${T.dyn} : <i>Serrer au couple (en étoile)</i>. Suivez l'ordre affiché (écrou 1, 2, 3…) : le jeu refuse le mauvais ordre.`];
const GEN=(p)=>[`Accédez à la pièce (capot ouvert, ou pont levé pour le dessous, ou roue déposée).`,`${T.cliquet} avec la bonne ${T.douille} : <i>Dévisser</i> les fixations (ou ${T.tournevis} / ${T.pinces} pour les clips et colliers).`,
 `${T.main} : <i>Déposer la pièce usée</i>, elle part dans votre inventaire.`,`${T.main} : <i>Monter la pièce neuve</i> (${p}).`,`Même outil qu'au début : <i>Revisser</i> toutes les fixations.`];

const CH=[
{t:'Niveau 0 · Les bases',h:()=>`
 <p>Vous êtes mécanicien : des clients déposent leur voiture sur un pont, vous la réparez, puis vous la rendez. Votre paie et votre expérience dépendent de la note du client (1 à 5 étoiles).</p>
 <h4>Les touches</h4>${ul([
  `${K('Z')}${K('Q')}${K('S')}${K('D')} (ou ${K('W')}${K('A')}${K('S')}${K('D')}, ou les flèches) : marcher · ${K('Maj')} : courir · souris : regarder (cliquez dans le jeu pour la capturer).`,
  `${K('E')} : agir sur ce que vous visez. <b>Maintenez ${K('E')}</b> pour dévisser, serrer ou verser : une jauge ronde se remplit.`,
  `${K(1)} à ${K(0)} : choisir l'outil (barre à droite) · ${K('R')} : changer la taille de douille.`,
  `${K('Maj')} + ${K(1)} à ${K(0)} : prendre en main la pièce de l'emplacement 1 à 10 de l'inventaire (barre du bas) · ${K('X')} : pièce suivante · ${K('V')} : la ranger.`,
  `${K('Tab')} : carnet (ordres, inventaire, expérience) · ${K('M')} : carte · ${K('C')} : carrière · ${K('G')} : réglages des gestes · ${K('H')} : ce guide · ${K('Échap')} : pause.`])}
 <h4>Une voiture, du début à la fin</h4>${ol([
  `<b>Lisez l'ordre</b> : le client annonce le travail (bandeau à gauche et carnet ${K('Tab')}). S'il décrit un symptôme, il faut d'abord trouver la panne (niveau 2).`,
  `<b>Prenez les pièces neuves</b> à l'<b>étagère</b> de l'atelier (${K('E')} devant l'étagère). Le bouton <i>Prendre les pièces des ordres en cours</i> prend tout d'un coup. Sans la pièce neuve sur vous, rien ne se remonte : le bandeau du haut vous le rappelle.`,
  `<b>Travaillez</b> : visez une pièce, son nom s'affiche avec le geste possible et l'outil demandé. Le bandeau « Étape suivante » vous guide (réglable avec ${K('G')}).`,
  `<b>Rendez la voiture</b> : ${RENDRE}`])}
 <h4>L'inventaire (barre du bas)</h4>${ul([
  `12 places. <span class="mw-gd-v">Vert</span> : pièce neuve · <span class="mw-gd-o">orange</span> : pièce usagée déposée.`,
  `Un clic (ou ${K('Maj')}+chiffre) prend la pièce en main : c'est elle qui sera montée en priorité. Un 2e clic ouvre sa fiche (jeter, valeur).`,
  `Les pièces usagées se vendent à la ferraille ou d'occasion (établi) : voir niveau 5.`])}
 <h4>Si vous êtes bloqué</h4>${ul([
  `Visez l'élément : le message orange dit exactement ce qui manque (« Levez le pont », « Il faut une douille de 17 », « Prenez la pièce neuve »…).`,
  `Mauvais outil ? Regardez la barre d'outils : l'outil attendu est mis en évidence. Sur un clavier AZERTY, les chiffres marchent sans ${K('Maj')}.`,
  `Vous préférez des menus ? ${K('G')} → <i>Menus classiques</i> : chaque point de la voiture ouvre une liste de boutons (Démonter, Monter…).`])}`},
{t:'Niveau 1 · Entretien',h:()=>`
 <p>Les premiers travaux : vidange, filtres, ampoules, essuie-glaces, batterie, pneus. Tous les travaux de niveau 1 sont confiés dès le premier jour.</p>
 ${job('Vidange (huile et filtre)','Entretien niveau 1','<b>Huile moteur (5 l)</b> + <b>Filtre à huile</b>, à prendre <u>avant</u> de commencer.',`${T.bac}, ${T.cliquet} + douille, ${T.main}, ${T.filtre}, ${T.bidon}, ${T.dyn}, ${T.ent}`,[
  LEVER,
  `${T.bac} : visez le <b>sol sous le carter</b> (sous le moteur), ${K('E')} : <i>Placer le bac sous le carter</i>.`,
  `${T.cliquet}, réglez la douille demandée avec ${K('R')}, visez le <b>bouchon de vidange</b> (sous le carter), maintenez ${K('E')} : <i>Desserrer le bouchon</i>.`,
  `${T.main}, maintenez ${K('E')} : <i>Retirer le bouchon à la main</i>. L'huile coule dans le bac (noire si elle est vieille). Laissez couler.`,
  `Pendant l'écoulement, le filtre : ${T.filtre} (ou ${T.cliquet} si c'est une cartouche dans un boîtier), maintenez ${K('E')} : <i>Desserrer le filtre</i>, puis ${T.main} : <i>Dévisser et déposer</i>.`,
  `${T.bidon} : <i>Huiler le joint du filtre neuf</i>, puis ${T.main} : <i>Visser le filtre neuf à la main</i>.`,
  `Quand l'huile ne coule plus : ${T.main} sur le trou du carter : <i>Reposer le bouchon avec un joint neuf</i>.`,
  `${T.dyn} (même douille) : <i>Serrer le bouchon au couple</i>.`,
  `${T.main} : <i>Retirer le bac de vidange</i>, puis ${BAISSER}`,
  CAPOT,
  `${T.main} sur le <b>bouchon de remplissage</b> (sur le moteur, souvent jaune ou marqué d'une burette) : <i>Ouvrir</i>.`,
  `${T.ent} : <i>Placer l'entonnoir</i>.`,
  `${T.bidon} sur l'entonnoir, <b>maintenez ${K('E')}</b> : <i>Verser l'huile</i>. Le bandeau affiche la quantité du moteur (par exemple 4,5 l) et ce que vous avez versé : relâchez quand vous l'atteignez, sans trop dépasser.`,
  `${T.main} : <i>Retirer l'entonnoir</i>, <i>Refermer le bouchon de remplissage</i>, puis <i>Retirer et lire la jauge</i> (entre MINI et MAXI).`,
  `Fermez le capot, puis ${RENDRE}`],
  'Erreurs pénalisées : bac oublié, bouchon pas serré au couple, bouchon de remplissage ouvert, trop ou pas assez d\'huile, bouchon oublié dans le bac magnétique.')}
 ${job('Filtre à air et filtre d\'habitacle','Entretien niveau 1','<b>Filtre à air</b> et/ou <b>Filtre d\'habitacle</b>.',`${T.tournevis} ou ${T.pinces}, ${T.main}`,[CAPOT,...GEN('filtre neuf').slice(1),`Le filtre d'habitacle se trouve côté passager, derrière la boîte à gants (habitacle).`,RENDRE])}
 ${job('Ampoules et essuie-glaces','Entretien / électricité niveau 1','<b>Ampoules de feux</b> ou <b>Balais d\'essuie-glace</b>.',`${T.main}, ${T.tournevis}`,[`Ampoules : capot ouvert, derrière le phare. Essuie-glaces : sur le pare-brise.`,...GEN('pièce neuve').slice(2,4),RENDRE])}
 ${job('Batterie','Électricité niveau 1','<b>Batterie</b>.',`${T.cliquet} (douille de 10 ou 13), ${T.main}`,[CAPOT,`${T.cliquet} (douille demandée) : <i>Desserrer la cosse / la bride</i> sur chaque fixation (comme en vrai, commencez par la borne moins −).`,`${T.main} : <i>Sortir</i> la vieille batterie, puis poser la neuve.`,`${T.cliquet} : <i>Resserrer la cosse / la bride</i> sur chaque fixation.`,RENDRE])}
 ${job('Pneus (×4)','Liaison au sol niveau 1','<b>Pneus (×4)</b>.',`${T.boul} ou ${T.cliquet}, ${T.main}, ${T.dyn}`,[...ROUE_DEP,`${T.main} sur la roue déposée : <i>Monter un pneu neuf (machine à pneus)</i>. Recommencez pour les 4 roues.`,...ROUE_REP,RENDRE])}`},
{t:'Niveau 2 · Freins et diagnostic',h:()=>`
 <p>Débloqué quand une compétence atteint le niveau 2 (environ 50 points d'expérience, quelques voitures). Le patron vous confie alors les freins et les pannes à diagnostiquer.</p>
 ${job('Plaquettes de frein (avant ou arrière)','Freinage niveau 2','<b>Plaquettes avant</b> (ou arrière).',`${T.boul}/${T.cliquet}, ${T.main}, ${T.presse}, ${T.dyn}`,[
  ...ROUE_DEP,
  `${T.cliquet} (douille demandée) : <i>Dévisser la vis de l'étrier</i>.`,
  `${T.main} : <i>Basculer l'étrier</i>, puis <i>Sortir les plaquettes</i> usées.`,
  `${T.presse} : <i>Repousser le piston</i> (les plaquettes neuves sont plus épaisses).`,
  `${T.main} : <i>Poser les plaquettes neuves</i>, <i>Remettre l'étrier en place</i>, puis ${T.cliquet} : <i>Revisser la vis de l'étrier</i>.`,
  `Faites les deux côtés du même essieu (gauche et droite).`,
  ...ROUE_REP,
  `Dans l'habitacle : <i>Pomper la pédale de frein</i> jusqu'à ce qu'elle soit ferme. Oublier, c'est une pédale molle et un client furieux.`,RENDRE])}
 ${job('Bougies, courroie d\'accessoires, liquide de frein','Moteur / freinage niveau 2','La pièce de l\'ordre.',`${T.cliquet} + douille, ${T.main}, ${T.ser} pour le liquide`,[CAPOT,...GEN('pièce neuve').slice(1),RENDRE])}
 <h4>Trouver une panne (client qui décrit un symptôme)</h4>${ol([
  `Lisez le symptôme : il oriente vers une zone (bruit au freinage → freins, démarreur qui tourne mollement → batterie…).`,
  `<b>Inspectez</b> les pièces suspectes (${T.main}, ${K('E')} sur la pièce : <i>Inspecter</i>) : l'usure s'affiche.`,
  `<b>Essai sur route</b> (habitacle) : un indice précis selon la situation (démarrage, freinage, virage…).`,
  `<b>Valise de diagnostic</b> (habitacle, électricité niveau 2, 220 € au magasin) : lit les codes défaut des pannes invisibles (alternateur, injecteurs, sonde lambda…).`,
  `Remplacez la pièce coupable seulement : une pièce changée pour rien n'est pas payée et fait baisser la note.`])}`},
{t:'Niveau 3 · Disques, suspension, électricité',h:()=>`
 <p>Niveau 3 vers 200 points d'expérience dans la compétence. La <b>clé dynamométrique</b> (85 € au magasin, fournie par les garages plus grands) devient indispensable.</p>
 ${job('Disques de frein','Freinage niveau 3','<b>Disques</b> (et souvent <b>plaquettes</b> en même temps).',`${T.boul}/${T.cliquet}, ${T.main}, ${T.presse}, ${T.dyn}`,[
  ...ROUE_DEP,`Déposez l'étrier comme pour les plaquettes, puis ${T.cliquet} : <i>Dévisser la vis du support</i> d'étrier.`,
  `${T.main} : déposez le disque usé, posez le disque neuf, revissez le support puis remontez plaquettes et étrier.`,...ROUE_REP,`Pompez la pédale de frein.`,RENDRE])}
 ${job('Amortisseurs avant','Liaison au sol niveau 3','<b>Amortisseurs avant (paire)</b>.',`${T.cliquet}, ${T.main}, ${T.dyn}`,[...ROUE_DEP,...GEN('amortisseur neuf').slice(1),...ROUE_REP,RENDRE])}
 ${job('Alternateur, démarreur, sonde lambda','Électricité / moteur niveau 3','La pièce trouvée au diagnostic.',`${T.cliquet} + douille, ${T.main}`,[`Débranchez la batterie (borne −) par sécurité.`,CAPOT+' Sonde lambda : pont levé, sur l\'échappement.',...GEN('pièce neuve').slice(1),`Rebranchez la batterie, essai sur route.`,RENDRE])}`},
{t:'Niveau 4 · Gros travaux moteur',h:()=>`
 <p>Niveau 4 vers 450 points d'expérience. Travaux longs et bien payés, réservés aux mécaniciens confirmés (garages prestigieux).</p>
 ${job('Kit de distribution','Moteur niveau 4','<b>Kit de distribution</b> (absent sur les moteurs à chaîne).',`${T.cliquet}, ${T.dyn}, ${T.main}`,[CAPOT,...GEN('kit neuf').slice(1),`Serrage final au couple. Une distribution mal montée casse le moteur : prenez votre temps.`,RENDRE])}
 ${job('Embrayage','Transmission niveau 4','<b>Kit d\'embrayage</b>.',`${T.cliquet}, ${T.dyn}, ${T.main}`,[LEVER,...GEN('kit neuf').slice(1),BAISSER,`Essai sur route : l'embrayage ne doit plus patiner.`,RENDRE])}
 ${job('Injecteurs','Moteur niveau 4','<b>Injecteurs</b>.',`${T.cliquet} + douille, ${T.main}`,[CAPOT,...GEN('injecteurs neufs').slice(1),`Contrôle à la valise : plus de code de ratés.`,RENDRE])}`},
{t:'Niveau 5 · Expert et patron',h:()=>`
 <p>Au niveau 5 et au-delà, vous savez tout faire. La différence se joue sur la carrière, l'argent et la réputation.</p>
 <h4>Carrière</h4>${ul([`Les garages prestigieux (${K('C')} : carrière) embauchent les mécaniciens expérimentés et diplômés, et paient mieux.`,`À votre compte : vous achetez vos pièces chez Pièces Auto Express, mais toute la facture est pour vous.`,`Plus tard : ingénieur, puis votre propre marque.`])}
 <h4>Anciennes pièces</h4>${ul([`<b>Ferraille</b> (magasin) : métal au poids, plomb des batteries, consigne des alternateurs, démarreurs et injecteurs.`,`<b>Occasion</b> (établi) : une pièce encore bonne se vend à des particuliers, de 8 h à 20 h.`,`<b>Remise en état</b> (établi) : disques rectifiés, batterie rechargée, alternateur, démarreur et injecteurs refaits, revendus plus cher.`,`<b>Réemploi</b> : une pièce durable d'occasion peut être montée sur la voiture d'un client, facturée 40 % moins cher (prenez-la en main avec ${K('Maj')}+chiffre).`,`Certains clients veulent récupérer leurs anciennes pièces : gardez-les jusqu'au rendu.`])}
 <h4>Honnêteté</h4>${ul([`À l'écran de rendu, <i>Arrondir la facture…</i> permet de tricher : réemploi au prix du neuf, main-d'œuvre gonflée, pièces facturées sans être changées.`,`Risques : le client peut s'en apercevoir au comptoir, ou des jours plus tard (remboursement du double, amende, avertissement puis licenciement). Les soupçons du quartier (carnet) rendent chaque arnaque plus risquée.`])}`}];

let cur=null;
function lvMax(){try{return Math.max(...MWJ.SKILLS.map(k=>MWJ.level(k)));}catch(e){return 1;}}
function open(n){
 if(!MW.S) return;if(n==null) n=cur!=null?cur:(MW.S.jobs&&MW.S.jobs.stats&&MW.S.jobs.stats.rendues>0?Math.min(5,lvMax()):0);cur=Math.max(0,Math.min(5,n|0));
 const lv=(()=>{try{return MWJ.SKILLS.map(k=>`<span class="mw-tag">${esc(MWJ.SK_NOM[k])} ${MWJ.level(k)}</span>`).join('');}catch(e){return '';}})();
 const tabs=CH.map((c,i)=>`<button type="button" class="btn sm${i===cur?'':' ghost'}" data-mw="gd:${i}" aria-pressed="${i===cur}">${i}</button>`).join('');
 const h=`<div class="mw-btns mw-gd-tabs" role="tablist" aria-label="Niveaux">${tabs}</div><h3 class="mw-h3">${esc(CH[cur].t)}</h3>${CH[cur].h()}
  <h4>Vos niveaux</h4><div class="mw-chips">${lv}</div>
  <div class="mw-btns">${cur>0?`<button type="button" class="btn ghost" data-mw="gd:${cur-1}">← Niveau ${cur-1}</button>`:''}${cur<5?`<button type="button" class="btn" data-mw="gd:${cur+1}">Niveau ${cur+1} →</button>`:''}<button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`;
 const pb=document.getElementById('mwPb');
 MW.panel('Guide du mécanicien',h,{wide:true,onClick:a=>{if(a.startsWith('gd:')){open(+a.slice(3));const q=document.getElementById('mwPb');if(q) q.scrollTop=0;}}});
 return cur;}
MW.on('key',k=>{if(k==='h') open();});
MW.addButton('guide','Guide (H)',()=>open());
MW.on('start',()=>{cur=null;});
return {open,NIV:CH.length,CH};
})();
window.__mwgd=MWGD;
