'use strict';
/* ───────────── Mode « Mécanicien » — CLIENTS AU NOIR ─────────────
   Une cour derrière le studio (zone « cour »), sans pont élévateur : on y répare, en liquide, les voitures de clients
   trouvés par petites annonces. Le voisinage (Mme Ricard) supporte mal le bruit : la jauge d'agacement monte avec chaque
   geste bruyant, la nuit, le dimanche, l'encombrement, les clients mécontents ; au-delà de 85, elle peut dénoncer le
   travail dissimulé (amende, saisie, interdiction, avertissement ou licenciement chez l'employeur). On l'apaise en lui
   parlant, en lui offrant des cadeaux, en lui rendant service, en travaillant de jour, avec une bâche, un produit absorbant,
   des horaires affichés. Le statut d'auto-entrepreneur supprime le risque de dénonciation (mais pas le bruit).
   S'appuie sur MW (40), MWJ (41 : voitures, gestes, rendu) et MWC (42 : employeur) ; ne règle AUCUNE constante économique :
   tous les montants sont calculés à partir des tarifs lus en direct (MWJ.quote, MWJ.noirData.TAUX, MWC.payFor).
   Données sauvegardées : MW.S.noir (créé / complété à 'start' et à chaque accès ; une ancienne sauvegarde se charge sans erreur).

   ═══ API `MWN` (raccourci de test : window.__mwn) ═══
   MWN.state()             MW.S.noir (complété)          MWN.unit()   unité de prix = facture d'une vidange au garage du coin
   MWN.unlocked()          annonces débloquées (1re paie ou caisse à outils)
   MWN.gauge()             agacement 0..100              MWN.mult()   multiplicateur de bruit actuel (heure, dimanche…)
   MWN.bruit(x)            ajoute x points de bruit de base (multiplicateurs appliqués) ; renvoie le gain réel
   MWN.gen(opts)           fait arriver une demande {tpl, symp, rdvIn (minutes), prix}            MWN.accept(id) / MWN.refuse(id)
   MWN.denonce(src,opts)   déclenche une dénonciation (opts.now : sans scène) ; MWN.controle(src) applique les sanctions
   MWN.geste(c,k,p,m)      point d'accroche de 41 (temps en plus, bruit) ; MWN.canLift(c) ; MWN.payOf(c,ev)
   MWN.panel(onglet)       panneau « Travail au noir » ; MWN.carnetHTML() / MWN.act(id) : section du carnet
   MWN.shopHTML() / MWN.shopAct(id) : onglet « Matériel du noir » du magasin ; MWN.dow() jour de semaine (0 = lundi) */
const MWN=(()=>{
const PI=Math.PI;
const JOURS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'],JA=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const rnd=Math.random,pick=a=>a[Math.floor(rnd()*a.length)],R2=x=>Math.round(x*100)/100;
const fmt=x=>MW.fmt(x);
const btn=(a,t,cls,dis)=>`<button type="button" class="btn sm${cls?' '+cls:''}" data-mw="noir:${a}"${dis?' disabled':''}>${t}</button>`;
const nm=x=>nf(x,Math.abs(x-Math.round(x))<.01?0:1);
const say=(t,g)=>{try{MW.toast(t,g);}catch(e){}};

/* ── réglages propres au noir (rapports, pas des montants : les prix sont des multiples de l'unité lue en direct) ── */
const K={
 remise:.85,          // le client paie 85 % de ce que facturerait le garage du coin
 aeHausse:1.12,       // auto-entrepreneur : prix un peu plus élevés
 aeDemande:1.5,       // et demande plus forte
 cotis:.22,           // cotisations de l'auto-entrepreneur
 decay:6,             // baisse quotidienne de la jauge
 decayCalme:4,        // baisse en plus quand on n'a pas fait de bruit de la journée
 seuilPlainte:30,seuilMenace:60,seuilDenonce:85,
 tauxAnnonce:[0,.09,.15],           // demandes par heure selon l'annonce (aucune, petite, grande)
 matPrix:{chandelles:1.1,boulonneuse:2,bache:1.5,horaires:.3,absorbant:.18},
 annoncePrix:[0,.12,.35],annonceJours:[0,7,14],
 cadeaux:[['fleurs','Un bouquet de fleurs',.12,10],['chocolats','Une boîte de chocolats',.25,18],['bouteille','Une bonne bouteille',.45,28]],
 vitesseCtl:3.4,       // vitesse de marche du contrôleur (m/s)
 fuite:.7,            // probabilité d'une flaque à la vidange sans produit absorbant
 emplacement2:3,       // aménager le 2e emplacement
 inscriptionAE:3.5,
 amendeBase:1,amendeGains:.7,amendePatron:.6,amendeMairie:.6,
 repAmende:8,interdictionBase:5,interdictionPlus:3,interdictionMax:14};

/* ═══════════ État ═══════════ */
function N(){const s=MW.S;if(!s) return {gauge:0,mat:{},dem:[],rdv:[],gains:[],amendes:[],flaques:[],cadeaux:[],log:[],avert:{},pal:{},stats:{}};
 if(!s.noir||typeof s.noir!=='object') s.noir={};
 const n=s.noir,d={gauge:0,slots:1,annonce:null,dem:[],rdv:[],seq:0,mat:{},mode:'main',bouche:0,ban:0,offenses:0,avert:{},ae:false,aeJour:0,gains:[],amendes:[],
  flaques:[],excuses:0,cadeaux:[],alliee:0,pal:{},lastCtl:0,ctlPending:null,log:[],histo:[],bacheOn:false,horairesOn:false,mairie:0,mairieT:-9,actJour:false,
  unlocked:false,hinted:false,warnNuit:0,mots:0,serviceT:-99,stats:{faits:0,gains:0,amendes:0,controles:0}};
 for(const k in d) if(n[k]==null) n[k]=d[k];
 for(const k of ['faits','gains','amendes','controles']) if(n.stats[k]==null) n.stats[k]=0;
 for(const k of ['chandelles','boulonneuse','bache','horaires','absorbant']) if(n.mat[k]==null) n.mat[k]=0;
 if(!n.pal||typeof n.pal!=='object') n.pal={};
 return n;}
const day=()=>MW.S?MW.S.day:1;
const dow=d=>((d==null?day():d)-1+7*1000)%7;           // 0 = lundi … 6 = dimanche (le jour 1 est un lundi)
const isSun=()=>dow()===6;
const absT=()=>MWJ.absT();
const absOf=(d,mm)=>d*1440+(mm<360?mm+1440:mm);
const hm=mm=>String(Math.floor(mm/60)%24).padStart(2,'0')+':'+String(Math.round(mm%60)).padStart(2,'0');
/* unité de prix : ce que facture le garage du coin pour une vidange, aux tarifs du moment */
function unit(){try{const D=MWJ.noirData;return Math.max(1,MWJ.quote(['huile','filtre_huile'],'citadine',D.TAUX.garage1).facture);}catch(e){return 90;}}
const price=k=>Math.max(1,Math.round(unit()*k));
const emp=()=>{try{return MWC.employer();}catch(e){return {id:'aucun'};}};
const cStat=()=>{try{return MWC.state();}catch(e){return {stats:{paid:0}};}};
function note(t){const n=N();n.log.unshift(MW.timeStr()+' : '+t);while(n.log.length>12) n.log.pop();}

/* ═══════════ Le lieu : cour et maison de Mme Ricard ═══════════ */
const ZC={x:-22,z:40.5,w:40,d:17},YARD={x0:-42,x1:-14,z0:32,z1:49};
const zone={id:'cour',nom:'Cour du studio',court:'Cour',type:'cour',x:ZC.x,z:ZC.z,w:ZC.w,d:ZC.d,side:'N',interior:true,ry:0,n:{x:0,z:-1},
 door:{x:-28,z:49},porte:{x:-28,z:47.7},col:0x55585c,ponts:[{x:-35,z:40,ry:0},{x:-25,z:40,ry:0}],libres:1};
const HOUSE={x0:-12.5,x1:-3.5,z0:36.5,z1:44.5};
const PZ=MW.zone('pieces'),board={x:PZ.porte.x+4.4,z:PZ.porte.z};
const origZone=MW.zone;MW.zone=id=>id===zone.id?zone:origZone(id);
MWJ.regPoints(zone);
let built=false,zonePushed=false;
const M={flaques:[],barrier:[],tarp:null,paneL:null,paneD:null,fig:null,arm:null,coffre:null};
function buildYard(){
 if(built) return;built=true;
 MW.box(28,.08,17,0x4b4e53,-28,.04,40.5);
 for(const q of zone.ponts){
  for(const s of [-1,1]) MW.box(.1,.02,5.4,0xf2c200,q.x+s*1.35,.1,q.z);
  MW.box(2.8,.02,.1,0xf2c200,q.x,.1,q.z-2.7);}
 MW.box(28.4,.18,.3,0x9a9a94,-28,.09,49.1);MW.box(.3,.18,17,0x9a9a94,-42.1,.09,40.5);
 // coffre à outils
 MW.box(1.6,.8,.7,0xb22a1c,-40.5,.4,36);MW.box(1.7,.1,.8,0x7a1a10,-40.5,.85,36);M.coffre=true;
 // barrière du 2e emplacement
 for(const sx of [-1,1]){M.barrier.push(MW.cyl(.22,.6,0xff7a1a,-25+sx*1.5,.3,37.6));M.barrier.push(MW.cyl(.22,.6,0xff7a1a,-25+sx*1.5,.3,42.4));}
 M.barrier.push(MW.box(3.2,.08,.08,0xe8e8e8,-25,.55,37.6));
 // bâche de chantier (écran côté voisin)
 M.tarp=MW.box(.1,2,9.4,0x3b7d4a,-14,1.1,36.8);
 // maison de Mme Ricard
 const hx=(HOUSE.x0+HOUSE.x1)/2,hz=(HOUSE.z0+HOUSE.z1)/2,hw=HOUSE.x1-HOUSE.x0,hd=HOUSE.z1-HOUSE.z0;
 MW.box(hw,6,hd,0xd8c7a8,hx,3,hz);MW.box(hw+.8,.5,hd+.8,0x8a4a3a,hx,6.25,hz);
 MW.box(.14,2.3,1.1,0x5a3a2a,HOUSE.x0-.06,1.15,43);MW.box(.9,.12,1.9,0x8a4a3a,HOUSE.x0-.5,2.5,43);MW.box(.6,.1,.6,0xd0d0c0,HOUSE.x0-.35,.06,43);
 MW.box(.12,1.5,1.7,0x6a4a30,HOUSE.x0-.05,2.65,39);   // cadre de la fenêtre
 M.paneD=MW.box(.12,1.3,1.5,0x39465a,HOUSE.x0-.1,2.65,39);
 M.paneL=MW.box(.12,1.3,1.5,0xffe8a0,HOUSE.x0-.11,2.65,39);M.paneL.visible=false;
 const T=MW.THREE,g=new T.Group();
 const body=MW.box(.5,.9,.3,0x23232b,0,0,0),head=MW.box(.3,.3,.3,0x2a2a32,0,.68,0);
 M.arm=MW.box(.14,.6,.14,0x23232b,.38,.1,0);M.arm.rotation.z=-.3;
 g.add(body,head,M.arm);g.position.set(HOUSE.x0-.45,2.5,39);g.visible=false;MW.scene.add(g);M.fig=g;
 // panneau d'annonces, près du magasin de pièces
 const px=board.x;
 MW.box(.12,2.2,.12,0x6a4a2a,px-.8,1.1,11.5);MW.box(.12,2.2,.12,0x6a4a2a,px+.8,1.1,11.5);MW.box(1.8,1.2,.08,0xb48a4a,px,1.7,11.5);
 for(const [dx,dy,c] of [[-.5,.3,0xffffff],[.1,.35,0xffe9a0],[.5,.1,0xffffff],[-.2,-.2,0xc8e0ff]]) MW.box(.4,.3,.02,c,px+dx,1.7+dy,11.44);
}
function refreshYard(){
 const n=N();syncFlaques();zone.libres=n.slots>=2?2:1;
 for(const b of M.barrier) b.visible=n.slots<2;
 if(M.tarp) M.tarp.visible=!!(n.mat.bache&&n.bacheOn);
 for(const m of M.flaques) MW.scene.remove(m);M.flaques=[];
 for(const f of n.flaques){const m=MW.cyl(f.r||.55,.02,0x120f0a,f.x,.1,f.z);M.flaques.push(m);}
 winUpdate(true);}
let winK='';
function winUpdate(force){
 if(!M.fig||!MW.S) return;const n=N(),ang=n.gauge>=K.seuilPlainte,lit=ang||MW.isNight();
 const k=(ang?1:0)+'|'+(lit?1:0)+'|'+(n.gauge>=K.seuilMenace?1:0);if(k===winK&&!force) return;winK=k;
 M.fig.visible=ang;M.paneL.visible=lit;M.paneD.visible=!lit;M.arm.visible=n.gauge>=K.seuilMenace;}
function solid(){ // la maison est un obstacle (le socle ne connaît pas ce bâtiment)
 if(!MW.S) return;const pl=MW.player(),r=pl.inCar?1.5:.5;
 const x0=HOUSE.x0-r,x1=HOUSE.x1+r,z0=HOUSE.z0-r,z1=HOUSE.z1+r;
 if(pl.x<x0||pl.x>x1||pl.z<z0||pl.z>z1) return;
 const l=pl.x-x0,rr=x1-pl.x,u=pl.z-z0,d=z1-pl.z,m=Math.min(l,rr,u,d);let x=pl.x,z=pl.z;
 if(m===l) x=x0;else if(m===rr) x=x1;else if(m===u) z=z0;else z=z1;
 MW.teleport(x,z);}

/* ═══════════ Jauge d'agacement ═══════════ */
function mult(){
 const n=N(),h=MW.hourF();let m=1;const why=[];
 if(h>=22||h<7){m*=3;why.push('nuit');}else if(h<8||h>=20){m*=1.5;why.push(h<8?'tôt le matin':'tard le soir');}
 if(isSun()){m*=2;why.push('dimanche');}
 if(n.mat.horaires&&n.horairesOn){if(h>=9&&h<19&&!isSun()){m*=.75;why.push('horaires respectés');}else{m*=1.25;why.push('hors horaires affichés');}}
 if(n.alliee>0){m*=.6;why.push('voisine conciliante');}
 mult.why=why;return m;}
mult.why=[];
const gauge=()=>N().gauge;
function setGauge(v){const n=N(),o=n.gauge;n.gauge=clamp(R2(v),0,100);if(Math.round(o)!==Math.round(n.gauge)) hudUpdate();paliers();return n.gauge;}
function bruit(b,o){
 if(!MW.S||!(b>0)) return 0;const n=N(),m=mult()*((o&&o.k)||1),d=b*m;
 if(b>=.3) n.actJour=true;
 if(m>=3&&n.warnNuit!==day()&&b>=.5){n.warnNuit=day();say('Il est tard : le bruit porte dans la nuit, la voisine va s\'en apercevoir.','warn');}
 const o2=n.gauge;setGauge(o2+d);return n.gauge-o2;}
function paliers(){
 const n=N(),g=n.gauge;
 if(g<24) n.pal.p30=false;if(g<50) n.pal.p60=false;
 if(g>=K.seuilPlainte&&!n.pal.p30){n.pal.p30=true;
  say('Mme Ricard apparaît à sa fenêtre : « C\'est quoi, tout ce vacarme chez vous ? »','warn');note('la voisine se plaint du bruit');}
 if(g>=K.seuilMenace&&!n.pal.p60){n.pal.p60=true;n.mots++;
  say('Un mot est glissé sous votre essuie-glace : « Si cela continue, j\'appelle les autorités. — Mme Ricard »','crit');note('mot de menace laissé sur le pare-brise');}
 winUpdate();}
function hudHTML(){
 const n=N(),g=Math.round(n.gauge),m=mult(),w=mult.why.length?' ('+mult.why.join(', ')+')':'';
 return `<b>Voisine · agacement ${g}/100</b><span class="mw-noir-bar ${g>=K.seuilDenonce?'r':g>=K.seuilMenace?'o':g>=K.seuilPlainte?'y':''}"><i style="width:${g}%"></i></span><small>${JOURS[dow()]} · bruit ×${nm(m)}${esc(w)}${n.ae?' · auto-entrepreneur':''}</small>`;}
function hudUpdate(){if(!MW.S) return;let inC=false;try{inC=MW.player().zone==='cour';}catch(e){}MW.hud('noir',inC?hudHTML():'');}

/* ═══════════ Gestes dans la cour (appelés par 41) ═══════════ */
const nPneu=n=>n.mode==='pneu'&&n.mat.boulonneuse>0;
function geste(c,k,p,m){
 if(!c||!c.noir||!MW.S) return;const n=N();
 const sous=!!(p&&(p.zone==='dessous'||p.zone==='roue'))||k==='roues'||k==='lever'||k==='baisser';
 const outil=k==='dep'||k==='pose'||k==='rem'||k==='roues',pneu=outil&&nPneu(n);
 let extra=0;if(outil&&!pneu) extra+=m*.6;if(sous) extra+=m*.4;extra=Math.round(extra);
 let b={insp:.15,capot:.3,lever:1.6,baisser:.8,roues:pneu?3.5:.9,dep:pneu?1.8:.5,pose:pneu?1.8:.5,rem:pneu?.9:.3,valise:.1,essai:4}[k]||0;
 if(sous&&(k==='dep'||k==='pose'||k==='rem')) b*=1.3;
 bruit(b,{k:c.noir.service?.5:1});
 if(extra>0) MW.addMin(extra);
 if(k==='dep'&&p&&(p.id==='huile')&&sous) fuite(c);}
function canLift(c){
 const n=N();if(n.mat.chandelles>0) return true;
 say('Pas de pont ici : il faut des chandelles et un cric rouleur (en vente chez Pièces Auto Express, onglet « Matériel du noir »).','warn');return false;}
function fuite(c){
 const n=N();
 if(n.mat.absorbant>0){n.mat.absorbant--;say('Vous étalez du produit absorbant sous le carter : pas de flaque.','good');return;}
 if(rnd()<K.fuite){const q=zone.ponts[c.pont]||zone.ponts[0],f={x:R2(q.x+(rnd()-.5)*1.4),z:R2(q.z+(rnd()-.5)*2.4),r:R2(.45+rnd()*.3)};
  n.flaques.push(f);M.flaques.push(MW.cyl(f.r,.02,0x120f0a,f.x,.1,f.z));syncFlaques();
  say('De l\'huile coule sur le sol de la cour : une flaque. Un kit absorbant aurait évité cela.','warn');}}
function flaqueUse(i){
 const n=N(),f=n.flaques[i];if(!f) return;
 if(n.mat.absorbant<1){say('Il faut un kit absorbant pour nettoyer l\'huile (Pièces Auto Express, onglet « Matériel du noir »).','warn');return;}
 n.mat.absorbant--;n.flaques.splice(i,1);MW.addMin(6);refreshYard();say('Flaque d\'huile nettoyée.','good');hudUpdate();}
const FLN=8; // nombre maximal de flaques interactives
function syncFlaques(){const n=N();for(let i=0;i<FLN;i++){const o=MW.addInteract({id:'noir:flaque'+i,x:0,z:0,r:1.6,when:()=>!!(MW.S&&N().flaques[i]),label:()=>N().mat.absorbant>0?'Nettoyer la flaque d\'huile (kit absorbant)':'Flaque d\'huile : il faut un kit absorbant',use:()=>flaqueUse(i)});
  const f=n.flaques[i];if(f){o.x=f.x;o.z=f.z;}}}

/* ═══════════ Demandes de clients ═══════════ */
function unlocked(){
 const n=N();if(n.unlocked) return true;
 let ok=false;try{ok=cStat().stats.paid>=1;}catch(e){}
 try{const o=MWJ.state().outils;if(o&&(o.cle_dyn||o.valise)) ok=true;}catch(e){}
 if(ok){n.unlocked=true;if(!n.hinted){n.hinted=true;say('Des clients « au noir » ? Un panneau de petites annonces est affiché devant Pièces Auto Express.','info');}}
 return n.unlocked;}
function pickJob(o){
 o=o||{};const P=MWJ.PARTS,lv=MWJ.level,n=N(),lift=n.mat.chandelles>0,outils=MWJ.state().outils||{};
 const okIds=ids=>ids.every(id=>lv(P[id].comp)>=P[id].niv&&(P[id].outil==='cles'||outils[P[id].outil]));
 const needLift=ids=>ids.some(id=>P[id].zone==='dessous'||P[id].zone==='roue');
 if(o.tpl){const t=MWJ.TPL.find(x=>x[0]===o.tpl);if(t) return {ids:t[2].slice(),nom:t[1],tpl:t[0],lift:needLift(t[2])};}
 if(o.symp){const y=MWJ.SYMP.find(x=>x.id===o.symp);if(y) return {ids:[y.c],nom:y.txt,symp:y.id,lift:needLift([y.c])};}
 if(rnd()<.2){
  const ys=MWJ.SYMP.filter(y=>okIds([y.c])&&y.dn<=lv('diagnostic')&&(!P[y.c].hid||outils.valise)&&(!needLift([y.c])||lift));
  if(ys.length){const y=pick(ys);return {ids:[y.c],nom:y.txt,symp:y.id,lift:needLift([y.c])};}}
 const pool=[];
 for(const t of MWJ.TPL){if(!okIds(t[2])) continue;const nl=needLift(t[2]);if(nl&&!lift&&rnd()>.25) continue;pool.push([t,t[3]*(nl&&!lift?.5:1),nl]);}
 if(!pool.length) return null;
 let tot=0;for(const x of pool) tot+=x[1];let r=rnd()*tot,s=pool[0];for(const x of pool){r-=x[1];if(r<=0){s=x;break;}}
 return {ids:s[0][2].slice(),nom:s[0][1],tpl:s[0][0],lift:s[2]};}
function rdvTime(o){
 const now=absT(),n=N();
 if(o&&o.rdvIn!=null) return now+Math.max(0,o.rdvIn);
 const h0=MW.hourF();let off=rnd()<.35&&h0<17?0:(rnd()<.7?1:2),mm;
 if(off===0) mm=Math.round((Math.max(h0+2,9)+rnd()*(19.5-Math.max(h0+2,9)))*60/10)*10;
 else{const r=rnd();mm=Math.round((r<.8?9+rnd()*9.5:r<.95?19+rnd()*2.5:7+rnd()*1.5)*60/10)*10;}
 return absOf(day()+off,mm%1440);}
function dayMin(t){let d=Math.floor(t/1440);const m=t%1440;if(m<360) d-=1;return {d,m};}   // inverse de absOf
const rdvStr=t=>{const x=dayMin(t);return `${JA[dow(x.d)]} · jour ${x.d} à ${hm(x.m)}`;};
function makeRequest(o){
 o=o||{};const n=N(),D=MWJ.noirData,job=pickJob(o);if(!job) return null;
 const mod=o.mod||(MWJ.modelFor?MWJ.modelFor('garage1',job.ids,job.symp):pick(D.MODELS.garage1)),taux=D.TAUX.garage1,q=MWJ.quote(job.ids,mod[2],taux,job.symp?15:0);
 let prix=o.prix!=null?o.prix:q.facture*K.remise*(n.ae?K.aeHausse:1)*(.92+rnd()*.16);
 prix=Math.max(Math.round(prix),Math.ceil(q.cout*1.15));
 const rdv=rdvTime(o);
 const r={id:'r'+(++n.seq),client:pick(D.CIV)+' '+pick(D.NOMS),mod,color:pick(D.COLS),tpl:job.tpl||null,symp:job.symp||null,ids:job.ids,nom:job.nom,lift:job.lift,
  prix,cout:q.cout,taux,rdv,exp:Math.max(rdv-30,absT()+30),st:'new',t:absT()};
 n.dem.push(r);while(n.dem.length>6) n.dem.shift();
 say(`Nouvelle demande au noir : ${r.client}, ${r.mod[0]} ${r.mod[1]}. « ${r.nom} » — ${fmt(r.prix)} en liquide, rendez-vous ${rdvStr(r.rdv)}. Voir le carnet.`,'info');
 note('demande de '+r.client);
 return r;}
function accept(id){
 const n=N(),i=n.dem.findIndex(r=>r.id===id);if(i<0) return false;const r=n.dem[i];
 if(r.lift&&!(n.mat.chandelles>0)){say('Ce travail demande de passer sous la voiture : il vous faut des chandelles et un cric rouleur.','warn');return false;}
 n.dem.splice(i,1);r.st='ok';n.rdv.push(r);
 say(`Rendez-vous accepté : ${r.client}, ${rdvStr(r.rdv)}. Pensez à acheter les pièces.`,'good');
 if(n.ban>day()&&!n.ae) say(`Rappel : vous êtes interdit de travail au noir jusqu'au jour ${n.ban}. Une nouvelle dénonciation doublerait l'amende.`,'warn');
 return true;}
function refuse(id){const n=N(),i=n.dem.findIndex(r=>r.id===id);if(i<0) return false;n.dem.splice(i,1);say('Demande refusée.','info');return true;}
function carsNoir(){return MWJ.jobs().filter(c=>c.noir);}
function arrive(r){
 const n=N(),c=MWJ.spawn({noir:{zone:'cour',mod:r.mod,color:r.color,client:r.client,taux:r.taux,prix:r.prix,req:r.id},tpl:r.tpl||undefined,symp:r.symp||undefined,travaux:(!r.tpl&&!r.symp)?r.ids:undefined,silencieux:true});
 if(!c) return false;
 r.car=c.id;r.arrive=absT();
 say(`${r.client} arrive avec sa ${r.mod[0]} ${r.mod[1]} (cour, emplacement ${c.pont+1}) : « ${r.nom} ». Prix convenu : ${fmt(r.prix)} en liquide.`,'info');
 return true;}
function onMinute(){
 if(!MW.S) return;const n=N(),now=absT();
 for(const r of n.rdv.slice()){
  if(r.car){ // voiture sur place : le client finit par la reprendre
   const c=MWJ.jobs().find(x=>x.id===r.car);
   if(!c){n.rdv.splice(n.rdv.indexOf(r),1);continue;}
   if(now-r.arrive>3*1440){MWJ.remove(c);n.rdv.splice(n.rdv.indexOf(r),1);MW.S.rep=clamp(R2(MW.S.rep-3),0,100);n.bouche=Math.max(0,n.bouche-1);setGauge(n.gauge+8);
    say(`${r.client} est venu récupérer sa voiture, trop longtemps immobilisée : il n'est pas content et le voisinage a vu la voiture traîner.`,'crit');}
   continue;}
  if(now>=r.rdv){if(!arrive(r)&&now>r.rdv+90){n.rdv.splice(n.rdv.indexOf(r),1);MW.S.rep=clamp(R2(MW.S.rep-1.5),0,100);n.bouche=Math.max(0,n.bouche-.5);
    say(`${r.client} est reparti : aucun emplacement libre dans la cour à l'heure du rendez-vous.`,'warn');}}}
 for(const r of n.dem.slice()) if(now>r.exp){n.dem.splice(n.dem.indexOf(r),1);say(`La demande de ${r.client} a expiré : il a trouvé un autre mécanicien.`,'info');}}

/* ═══════════ Rendu d'une voiture au noir ═══════════ */
function payOf(c,ev){
 const x=c.noir;if(!x||x.service) return 0;
 const f=ev.nonResolu?0:[0,.3,.6,.85,1,1][ev.note]||0;return Math.round((x.prix||0)*f);}
function onJobDone(job,note2){
 if(!job||!job.noir||!MW.S) return;const n=N();
 n.stats.faits++;n.actJour=true;
 if(job.service){
  setGauge(n.gauge-35);n.alliee=7;n.serviceT=day();MW.S.rep=clamp(R2(MW.S.rep+1),0,100);
  say('Mme Ricard est ravie : « Vous êtes un voisin charmant ! » Son agacement tombe, et elle sera plus tolérante pendant une semaine.','good');note('service rendu à Mme Ricard');return;}
 const r=n.rdv.find(x=>x.car===job.id);if(r) n.rdv.splice(n.rdv.indexOf(r),1);
 const pay=job.pay||0;
 if(pay>0){n.gains.push({j:day(),x:pay,client:job.client,voiture:job.voiture});while(n.gains.length>40) n.gains.shift();n.stats.gains=R2(n.stats.gains+pay);}
 if(n.ae&&pay>0){const cot=Math.round(pay*K.cotis);if(cot>0) MW.money(-cot,'Cotisations auto-entrepreneur ('+Math.round(K.cotis*100)+' %)');}
 n.bouche=clamp(n.bouche+(note2>=4?1:note2===3?.3:-1),0,10);
 if(note2<=2){setGauge(n.gauge+10);
  say(`${job.client} n'est pas content et en parle dans le quartier : la voisine l'apprend.`,'warn');
  if(!n.ae&&rnd()<(note2<=1?.3:.15)){say(`${job.client}, furieux, menace de vous signaler.`,'crit');denonce('client');}}}

/* ═══════════ Dénonciation et contrôle ═══════════ */
let ctl=null;
function recentGains(){const n=N(),d=day();return n.gains.filter(g=>g.j>=d-14&&g.j>=n.lastCtl).reduce((a,g)=>a+g.x,0);}
function denonce(src,o){
 const n=N();if(!MW.S) return;
 if(n.ae){mairie();return;}
 if(n.ctlPending||ctl) return;
 n.ctlPending={src:src||'voisine',t:absT()};
 say(src==='client'?'Un client mécontent a prévenu les services de contrôle…':'Mme Ricard a appelé les autorités : un contrôleur est en route !','crit');
 if(o&&o.now) controle(src,o);}
function mairie(){
 const n=N();if(n.mairieT>=day()-1&&n.mairie>0) return;
 n.mairieT=day();n.mairie++;
 if(n.mairie===1){say('Courrier de la mairie : avertissement pour nuisances sonores. Un second signalement entraînera une amende.','crit');note('avertissement de la mairie (nuisances)');setGauge(70);}
 else{const f=Math.min(price(K.amendeMairie),Math.max(price(.3),MW.S.money*.75));MW.money(-f,'Amende pour nuisances sonores');n.amendes.push({j:day(),x:f,motif:'nuisances sonores'});n.stats.amendes=R2(n.stats.amendes+f);
  say(`La mairie vous inflige une amende pour nuisances : ${fmt(f)}.`,'crit');note('amende de la mairie');setGauge(65);}}
function controle(src,o){
 const n=N(),s=MW.S,u=unit(),today=day(),rep={src,lignes:[]};
 const interdit=n.ban>today;
 let fine=Math.round(u*K.amendeBase+K.amendeGains*recentGains());
 if(interdit) fine*=2;
 const e=emp();let extra=0;
 if(e.id==='patron'){extra=Math.round(u*K.amendePatron);}
 fine+=extra;
 const cap=Math.max(u,s.money*(interdit?.9:.75));fine=Math.round(Math.min(fine,cap));
 if(fine>0) MW.money(-fine,'Amende : travail dissimulé');
 n.amendes.push({j:today,x:fine,motif:'travail dissimulé'+(interdit?' (récidive pendant l\'interdiction)':'')});n.stats.amendes=R2(n.stats.amendes+fine);n.stats.controles++;
 rep.amende=fine;rep.double=interdit;rep.extra=extra;
 // saisies
 const inv=MWJ.inv(),nb=inv.length;inv.length=0;
 const outils=[];for(const k of ['chandelles','boulonneuse']) if(n.mat[k]>0){n.mat[k]=0;outils.push(k==='chandelles'?'chandelles et cric rouleur':'boulonneuse pneumatique');}
 if(n.mat.absorbant>0){n.mat.absorbant=0;outils.push('kits absorbants');}
 if(n.mode==='pneu') n.mode='main';
 try{MWJ.invUI();}catch(x){}
 rep.pieces=nb;rep.outils=outils;
 // clients partis sans payer
 const partis=[];for(const c of carsNoir()){if(c.noir.service) continue;partis.push(c.client);MWJ.remove(c);}
 n.rdv=[];rep.partis=partis;
 // réputation, interdiction, annonce
 s.rep=clamp(R2(s.rep-K.repAmende),0,100);n.offenses++;
 const jours=Math.min(K.interdictionMax,K.interdictionBase+K.interdictionPlus*(n.offenses-1));n.ban=today+jours;rep.jours=jours;
 n.annonce=null;n.bouche=Math.max(0,n.bouche-3);n.lastCtl=today;n.ctlPending=null;
 setGauge(40);
 // employeur
 rep.emp=null;
 try{
  const id=e.id;
  if(['ventoux','aurele','brivio','ing'].includes(id)){
   n.avert[id]=(n.avert[id]||0)+1;
   if(n.avert[id]>=2){n.avert[id]=0;MWC.state().refus[id]=today+14;MWC.hire('aucun');s.rep=clamp(R2(s.rep-5),0,100);rep.emp='licencie';}
   else rep.emp='avertissement';}
  else if(id==='patron') rep.emp='patron';
 }catch(x){console.error(x);}
 note('contrôle : amende '+fmt(fine));
 MW.save();
 return rep;}
function reportHTML(r){
 let h=`<p>Un contrôleur s'est présenté dans la cour : on vous reproche d'exercer un travail <b>dissimulé</b> (sans déclaration).</p><ul class="mw-cond">`;
 h+=`<li class="no">Amende : <b>${esc(fmt(r.amende))}</b>${r.double?' (doublée : vous étiez déjà interdit de travail au noir)':''}${r.extra?` dont ${esc(fmt(r.extra))} pour le contrôle de votre garage`:''}.</li>`;
 h+=`<li class="no">Saisie : ${r.pieces} pièce${r.pieces>1?'s':''} en votre possession${r.outils.length?', '+esc(r.outils.join(', ')):''}.</li>`;
 if(r.partis.length) h+=`<li class="no">${esc(r.partis.join(', '))} ${r.partis.length>1?'sont partis':'est parti'} sans payer.</li>`;
 h+=`<li class="no">Réputation : −${K.repAmende}. Annonce retirée.</li>`;
 h+=`<li class="no">Interdiction de travailler au noir pendant ${r.jours} jours.</li></ul>`;
 if(r.emp==='avertissement') h+='<p class="mw-soon">Votre employeur a été informé : c\'est un avertissement. Une seconde affaire vous coûterait votre poste.</p>';
 if(r.emp==='licencie') h+='<p class="mw-soon">Votre employeur a été informé pour la seconde fois : vous êtes licencié.</p>';
 if(r.emp==='patron') h+='<p class="mw-soon">Le contrôleur a aussi inspecté votre garage : une amende supplémentaire est incluse.</p>';
 h+='<p class="hint">Conseil : régularisez votre situation en devenant auto-entrepreneur (guichet à la banque ou au centre de formation).</p>';
 return h+`<div class="mw-btns"><button type="button" class="btn" data-mw="close">Compris</button></div>`;}
/* scène : un contrôleur traverse la cour */
function makeFig(){
 const T=MW.THREE,g=new T.Group();
 g.add(MW.box(.5,.9,.3,0x1f3a5a,0,1,0),MW.box(.3,.3,.3,0xe0b890,0,1.7,0),MW.box(.34,.12,.34,0x14243a,0,1.92,0),MW.box(.18,.8,.2,0x14243a,-.13,.4,0),MW.box(.18,.8,.2,0x14243a,.13,.4,0),MW.box(.36,.4,.1,0x8a8a8a,0,1.05,-.2));
 MW.scene.add(g);return g;}
function startScene(){
 const n=N(),p=n.ctlPending;if(!p||ctl) return;
 ctl={g:makeFig(),ph:'in',t:0,from:{x:-28,z:58},to:{x:-30,z:42},src:p.src};
 ctl.g.position.set(ctl.from.x,0,ctl.from.z);}
function sceneTick(dt){
 if(!ctl) return;
 const c=ctl,mv=(a,b)=>{const dx=b.x-c.g.position.x,dz=b.z-c.g.position.z,d=Math.hypot(dx,dz),st=K.vitesseCtl*dt;if(d<=st){c.g.position.x=b.x;c.g.position.z=b.z;return true;}
  c.g.position.x+=dx/d*st;c.g.position.z+=dz/d*st;c.g.rotation.y=Math.atan2(dx,dz);c.g.position.y=Math.abs(Math.sin(performance.now()/130))*.06;return false;};
 if(c.ph==='in'){if(mv(c.from,c.to)){c.ph='wait';}}
 else if(c.ph==='wait'){
  if(MW.paused) return;
  const rep=controle(c.src);c.ph='panel';
  MW.panel('Contrôle de la cour',reportHTML(rep),{onClose:()=>{if(ctl) ctl.ph='out';}});}
 else if(c.ph==='out'){if(mv(c.to,c.from)){MW.scene.remove(c.g);ctl=null;}}}
function dropScene(){if(ctl){MW.scene.remove(ctl.g);ctl=null;}}

/* ═══════════ Heures et jours ═══════════ */
function onHour(h){
 if(!MW.S) return;const n=N();unlocked();
 // encombrement
 const cars=carsNoir(),now=absT();let over=0;for(const c of cars) if(now-(c.arrive||now)>1440) over++;
 let enc=cars.length*.12+over*.5+n.flaques.length*.25;if(n.mat.bache&&n.bacheOn) enc*=.5;
 if(enc>0) setGauge(n.gauge+enc);
 // annonces et demandes
 if(n.annonce&&day()>n.annonce.fin){n.annonce=null;say('Votre annonce n\'est plus affichée.','info');}
 if(n.annonce&&h>=9&&h<20&&n.dem.length+n.rdv.length<5){
  const p=K.tauxAnnonce[n.annonce.tier]*(1+.12*n.bouche)*(n.ae?K.aeDemande:1);if(rnd()<p) makeRequest();}
 // dénonciation
 if(n.gauge>=K.seuilDenonce){
  let p=.03+.17*(n.gauge-K.seuilDenonce)/(100-K.seuilDenonce);if(n.ban>day()) p*=1.5;
  if(rnd()<p) denonce('voisine');}
 hudUpdate();}
function onDay(){
 if(!MW.S) return;const n=N();
 setGauge(n.gauge-K.decay-(n.actJour?0:K.decayCalme));n.actJour=false;
 n.excuses=Math.max(0,n.excuses-1);if(n.alliee>0) n.alliee--;
 const d=day();n.cadeaux=n.cadeaux.filter(x=>x>d-3);
 if(dow()===6&&n.stats.faits>0&&unlocked()) say('Dimanche : le voisinage est au repos, le bruit sera doublement remarqué.','info');
 hudUpdate();}

/* ═══════════ Interface ═══════════ */
let tab='dem';
const gaugeBar=g=>`<span class="mw-noir-bar ${g>=K.seuilDenonce?'r':g>=K.seuilMenace?'o':g>=K.seuilPlainte?'y':''}"><i style="width:${Math.round(g)}%"></i></span>`;
function stateLine(n){
 const l=[];
 if(n.ae) l.push('Auto-entrepreneur : cotisations de '+Math.round(K.cotis*100)+' %, pas de dénonciation pour travail dissimulé.');
 else l.push('Travail non déclaré : amende et saisie possibles en cas de dénonciation.');
 if(n.ban>day()&&!n.ae) l.push(`Interdit de travail au noir jusqu'au jour ${n.ban} : une nouvelle dénonciation doublerait l'amende.`);
 return l;}
function carnetHTML(){
 if(!MW.S||!unlocked()) return '';const n=N();
 return `<h3 class="mw-h3">Travail au noir</h3><div class="mw-card"><div class="mw-sk"><span class="mw-sk-n">Agacement de la voisine</span>${gaugeBar(n.gauge)}<b>${Math.round(n.gauge)}</b></div><small>${n.dem.length} demande${n.dem.length>1?'s':''} · ${n.rdv.length} rendez-vous · annonce : ${n.annonce?'affichée jusqu\'au jour '+n.annonce.fin:'aucune'}${n.ae?' · auto-entrepreneur':''}</small>${stateLine(n).map(x=>`<small>${esc(x)}</small>`).join('')}<div class="mw-btns">${btn('open','Ouvrir la section Travail au noir')}</div></div>`;}
function tabs(){const n=N();return `<div class="mw-btns">${[['dem','Demandes ('+n.dem.length+')'],['rdv','Rendez-vous ('+n.rdv.length+')'],['voisine','Voisine'],['ann','Annonces'],['hist','Historique']].map(x=>btn('t_'+x[0],x[1],tab===x[0]?'':'ghost')).join('')}</div>`;}
function reqHTML(r,acc){
 const n=N(),miss=r.lift&&!(n.mat.chandelles>0);
 const pn=r.ids.map(id=>esc(MWJ.PARTS[id].nom.toLowerCase())).join(', ');
 return `<div class="mw-prt"><div class="mw-prt-h"><b>${esc(r.client)} · ${esc(r.mod[0]+' '+r.mod[1])}</b><span class="mw-tag ok">${fmt(r.prix)}</span></div><div>${esc(r.symp?'« '+r.nom+' » (à diagnostiquer)':r.nom)}</div><small>Rendez-vous : ${esc(rdvStr(r.rdv))}${dayMin(r.rdv).m>=1200||dayMin(r.rdv).m<480?' · horaire tardif ou matinal, attention au bruit':''}${dow(dayMin(r.rdv).d)===6?' · un dimanche !':''}</small><small>Pièces à acheter vous-même : ${pn} (environ ${esc(fmt(r.cout))}). Gain net estimé : ${esc(fmt(r.prix-r.cout))}.</small>${miss?'<small class="mw-need">Travail sous la voiture : il faut des chandelles et un cric rouleur.</small>':''}${acc?'':`<small>${r.car?'Voiture arrivée dans la cour.':'Le client arrivera à l\'heure dite.'}</small>`}<div class="mw-btns">${acc?btn('acc_'+r.id,'Accepter','',miss)+btn('ref_'+r.id,'Refuser','ghost'):''}</div></div>`;}
function panel(t){
 if(!MW.S) return;if(t) tab=t;const n=N();let h='';
 if(!unlocked()){MW.panel('Travail au noir',`<p>Pour l'instant, personne ne connaît votre nom dans le quartier. Touchez votre première paie ou équipez-vous d'une vraie caisse à outils, puis revenez : un panneau de petites annonces est affiché devant Pièces Auto Express.</p><div class="mw-btns"><button type="button" class="btn" data-mw="close">Fermer</button></div>`);return;}
 h+=`<div class="mw-card"><div class="mw-sk"><span class="mw-sk-n">Agacement de la voisine</span>${gaugeBar(n.gauge)}<b>${Math.round(n.gauge)}</b></div>${stateLine(n).map(x=>`<small>${esc(x)}</small>`).join('')}</div>`+tabs();
 if(tab==='dem'){
  h+=n.dem.length?n.dem.map(r=>reqHTML(r,true)).join(''):`<p>Aucune demande pour le moment.${n.annonce?' Votre annonce est affichée : les clients appellent surtout de 9 h à 20 h.':' Déposez une annonce au panneau devant Pièces Auto Express (ou dans l\'onglet « Annonces »).'}</p>`;}
 else if(tab==='rdv'){
  h+=n.rdv.length?n.rdv.map(r=>reqHTML(r,false)).join(''):'<p>Aucun rendez-vous.</p>';}
 else if(tab==='voisine'){
  const g=n.gauge;
  h+=`<div class="mw-card"><b>Mme Ricard</b><small>${g<K.seuilPlainte?'Elle vous salue de loin, mais elle surveille.':g<K.seuilMenace?'Elle se plaint régulièrement du bruit.':g<K.seuilDenonce?'Elle vous a menacé d\'appeler les autorités.':'Elle est à bout : la dénonciation peut tomber à chaque heure.'}</small></div>`;
  h+='<h3 class="mw-h3">Ce qui la dérange</h3><ul class="mw-cond"><li>La boulonneuse et les outils pneumatiques (la clé à la main est silencieuse, mais plus lente).</li><li>La nuit (22 h–7 h : ×3), tôt le matin et tard le soir (×1,5), le dimanche (×2).</li><li>Les voitures qui restent plus d\'une journée, les flaques d\'huile, les clients mécontents, les essais sur route qui partent de la cour.</li></ul>';
  h+='<h3 class="mw-h3">Pour l\'apaiser</h3><ul class="mw-cond"><li>Lui parler (sa porte, à côté de la cour), lui offrir un cadeau, lui rendre service.</li><li>Travailler de jour, poser la bâche, utiliser un kit absorbant, afficher des horaires de travaux.</li></ul>';
  h+=`<p class="hint">Mot${n.mots>1?'s':''} de menace reçu${n.mots>1?'s':''} : ${n.mots} · bruit actuel ×${nm(mult())}${mult.why.length?' ('+esc(mult.why.join(', '))+')':''}.</p>`;
  if(n.log.length) h+='<small>'+n.log.slice(0,6).map(esc).join('<br>')+'</small>';}
 else if(tab==='ann'){
  const a=n.annonce;
  h+=`<p>${a?`Votre annonce est affichée jusqu'au jour ${a.fin} (${a.tier===2?'grande annonce':'petite annonce'}).`:'Aucune annonce affichée.'} Les demandes arrivent par message ; le bouche-à-oreille les multiplie quand vos clients sont satisfaits (bouche-à-oreille : ${nf(n.bouche,1)}).</p>`;
  for(const t of [1,2]){const c=price(K.annoncePrix[t]);
   h+=`<div class="mw-prt"><div class="mw-prt-h"><b>${t===2?'Grande annonce':'Petite annonce'}</b><span class="mw-tag">${fmt(c)}</span></div><small>Affichée ${K.annonceJours[t]} jours${t===2?', beaucoup plus de demandes':''}.</small><div class="mw-btns">${btn('ann'+t,'Déposer','',MW.S.money<c)}</div></div>`;}}
 else{
  const g=n.gains.slice(-8).reverse(),a=n.amendes.slice(-6).reverse();
  h+=`<p>Gains au noir : <b>${fmt(n.stats.gains)}</b> (${n.stats.faits} voiture${n.stats.faits>1?'s':''}) · amendes : <b>${fmt(n.stats.amendes)}</b> · contrôles : ${n.stats.controles}.</p>`;
  h+='<h3 class="mw-h3">Derniers gains</h3>'+(g.length?'<small>'+g.map(x=>`Jour ${x.j} : ${esc(x.voiture)} (${esc(x.client)}) · ${fmt(x.x)}`).join('<br>')+'</small>':'<p>Rien pour l\'instant.</p>');
  h+='<h3 class="mw-h3">Amendes</h3>'+(a.length?'<small>'+a.map(x=>`Jour ${x.j} : ${esc(x.motif)} · ${fmt(x.x)}`).join('<br>')+'</small>':'<p>Aucune.</p>');}
 h+=`<div class="mw-btns">${btn('carnet','Retour au carnet','ghost')}<button type="button" class="btn sm ghost" data-mw="close">Fermer</button></div>`;
 MW.panel('Travail au noir',h,{wide:true,onClick:a=>{if(a.startsWith('noir:')) act(a.slice(5));}});}
function act(a){
 const n=N();
 if(a==='open'){panel('dem');return;}
 if(a==='carnet'){MWJ.openCarnet();return;}
 if(a.startsWith('t_')){panel(a.slice(2));return;}
 if(a.startsWith('acc_')){accept(a.slice(4));panel();return;}
 if(a.startsWith('ref_')){refuse(a.slice(4));panel();return;}
 if(a==='ann1'||a==='ann2'){const t=+a.slice(3),c=price(K.annoncePrix[t]);
  if(MW.S.money<c){say('Pas assez d\'argent.','warn');return;}
  MW.money(-c,'Petite annonce');const fin=day()+K.annonceJours[t];
  n.annonce={tier:Math.max(t,n.annonce?n.annonce.tier:0),fin:Math.max(fin,n.annonce?n.annonce.fin:0)};
  say('Annonce déposée : les premiers messages ne devraient pas tarder.','good');panel('ann');return;}
 if(a==='ae') statutPanel();}
/* — matériel (magasin de pièces) — */
const MAT={
 chandelles:['Chandelles et cric rouleur','Permet les travaux « dessous » et les roues dans la cour, mais le travail est plus lent (+40 %) et plus bruyant.'],
 boulonneuse:['Boulonneuse pneumatique et compresseur','Plus rapide que la clé à la main, mais très bruyante : à réserver aux heures de journée.'],
 bache:['Grande bâche de chantier','Cache les voitures aux yeux du voisinage : réduit l\'encombrement de moitié (à poser depuis le coffre à outils de la cour).'],
 horaires:['Affiche « horaires de travaux »','Bruit réduit pendant les heures affichées (9 h–19 h, hors dimanche), mais gare au bruit en dehors.'],
 absorbant:['Kit absorbant (huile)','Évite la flaque d\'une vidange, ou nettoie une flaque. À usage unique.']};
function shopHTML(){
 const n=N();let h=`<p class="hint">Matériel pour travailler dans la cour du studio (voir le coffre à outils).</p>`;
 for(const k in MAT){const c=price(K.matPrix[k]),has=n.mat[k]>0,cons=k==='absorbant';
  h+=`<div class="mw-prt"><div class="mw-prt-h"><b>${esc(MAT[k][0])}</b><span class="mw-tag${has&&!cons?' ok':''}">${has&&!cons?'Acheté':fmt(c)}</span></div><small>${esc(MAT[k][1])}${cons?' En stock : '+n.mat[k]+'.':''}</small><div class="mw-btns">${btn('b_'+k,'Acheter','',(has&&!cons)||MW.S.money<c)}</div></div>`;}
 const ok=unlocked();
 h+=`<h3 class="mw-h3">Petites annonces</h3>`+(ok?[1,2].map(t=>{const c=price(K.annoncePrix[t]);return `<div class="mw-prt"><div class="mw-prt-h"><b>${t===2?'Grande annonce':'Petite annonce'}</b><span class="mw-tag">${fmt(c)}</span></div><small>Affichée ${K.annonceJours[t]} jours.${n.annonce?' Annonce actuelle jusqu\'au jour '+n.annonce.fin+'.':''}</small><div class="mw-btns">${btn('ann'+t,'Déposer','',MW.S.money<c)}</div></div>`;}).join(''):'<p>Revenez après votre première paie.</p>');
 return h;}
function shopAct(a){
 const n=N();
 if(a==='ann1'||a==='ann2'){act(a);return;}
 if(a.startsWith('b_')){const k=a.slice(2),c=price(K.matPrix[k]);if(!MAT[k]) return;
  if(MW.S.money<c){say('Pas assez d\'argent.','warn');return;}
  if(k!=='absorbant'&&n.mat[k]>0) return;
  MW.money(-c,MAT[k][0]);n.mat[k]=k==='absorbant'?n.mat[k]+1:1;
  if(k==='boulonneuse') n.mode='pneu';
  if(k==='bache') n.bacheOn=false;if(k==='horaires') n.horairesOn=false;refreshYard();}}
/* — coffre à outils de la cour — */
function coffre(){
 const n=N();
 const row=(t,d,b)=>`<div class="mw-prt"><div class="mw-prt-h"><b>${t}</b></div><small>${d}</small><div class="mw-btns">${b}</div></div>`;
 let h=`<p>Votre coin d'atelier : pas de pont élévateur ici. Matériel : ${Object.keys(MAT).filter(k=>n.mat[k]>0).map(k=>esc(MAT[k][0])+(k==='absorbant'?' ×'+n.mat[k]:'')).join(', ')||'rien de spécial'}.</p>`;
 h+=row('Outil de serrage',n.mat.boulonneuse>0?(nPneu(n)?'Boulonneuse pneumatique : travail rapide, très bruyant.':'Clé à la main : silencieuse, mais travail plus lent (+60 %).'):'Clé à la main (silencieuse, lente). Une boulonneuse pneumatique s\'achète chez Pièces Auto Express.',n.mat.boulonneuse>0?btn('mode',nPneu(n)?'Passer à la clé à la main':'Passer à la boulonneuse'):'');
 h+=row('Bâche',n.mat.bache>0?(n.bacheOn?'Posée : les voitures sont cachées de la fenêtre de la voisine.':'Rangée.'):'Pas de bâche.',n.mat.bache>0?btn('bache',n.bacheOn?'Retirer la bâche':'Poser la bâche'):'');
 h+=row('Horaires de travaux',n.mat.horaires>0?(n.horairesOn?'Affichés : 9 h–19 h, hors dimanche.':'Non affichés.'):'Pas d\'affiche.',n.mat.horaires>0?btn('horaires',n.horairesOn?'Retirer l\'affiche':'Afficher les horaires'):'');
 h+=`<div class="mw-btns">${btn('bac','Jeter les pièces usagées','ghost')}${btn('open','Travail au noir','ghost')}<button type="button" class="btn sm ghost" data-mw="close">Fermer</button></div>`;
 MW.panel('Coffre à outils · cour',h,{wide:true,onClick:a=>{
  if(!a.startsWith('noir:')) return;const k=a.slice(5);
  if(k==='mode') n.mode=nPneu(n)?'main':'pneu';
  else if(k==='bache'){n.bacheOn=!n.bacheOn;refreshYard();}
  else if(k==='horaires') n.horairesOn=!n.horairesOn;
  else if(k==='bac'){const inv=MWJ.inv();for(let i=inv.length-1;i>=0;i--) if(inv[i].k==='usagee') inv.splice(i,1);try{MWJ.invUI();}catch(e){}say('Pièces usagées jetées.','info');}
  else if(k==='open'){panel();return;}
  hudUpdate();coffre();}});}
function emplacementUse(){
 const n=N(),c=price(K.emplacement2);
 MW.panel('Deuxième emplacement',`<p>Un second emplacement permettrait de recevoir deux voitures à la fois (plus d'encombrement, donc plus de risque avec la voisine). Marquage et dégagement : <b>${esc(fmt(c))}</b>.</p><div class="mw-btns">${btn('emp2','Aménager l\'emplacement','',MW.S.money<c)}<button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`,
  {onClick:a=>{if(a==='noir:emp2'){if(MW.S.money<c) return;MW.money(-c,'Aménagement du 2e emplacement');n.slots=2;refreshYard();MW.closePanel();say('Le second emplacement est prêt.','good');}}});}
/* — la voisine — */
function voisine(){
 const n=N(),g=n.gauge,u=unit();
 const rec=n.cadeaux.length;
 const talk=g<K.seuilPlainte?'« Ah, c\'est vous. Je veux bien que vous gagniez votre vie, mais pensez à mes oreilles. »':g<K.seuilMenace?'« Je vous entends depuis ma cuisine ! Il y a des horaires, tout de même… »':g<K.seuilDenonce?'« Ça suffit ! J\'ai déjà le numéro de la mairie sous la main. »':'« Je n\'ai plus rien à vous dire. Vous aurez de mes nouvelles. »';
 let h=`<p><b>Mme Ricard</b> ouvre sa porte.</p><p>${esc(talk)}</p><div class="mw-sk"><span class="mw-sk-n">Agacement</span>${gaugeBar(g)}<b>${Math.round(g)}</b></div>`;
 h+=`<div class="mw-prt"><div class="mw-prt-h"><b>Présenter des excuses</b></div><small>Gratuit. Efficace la première fois, de moins en moins ensuite${n.excuses>=2?' : elle commence à en avoir assez':''}.</small><div class="mw-btns">${btn('v_exc','S\'excuser')}</div></div>`;
 for(const [id,nom,k,eff] of K.cadeaux){const c=Math.round(u*k);
  h+=`<div class="mw-prt"><div class="mw-prt-h"><b>${esc(nom)}</b><span class="mw-tag">${fmt(c)}</span></div><small>Baisse d'environ ${Math.round(eff*Math.pow(.6,rec))} points${rec?' (elle se lasse des cadeaux répétés)':''}.</small><div class="mw-btns">${btn('v_'+id,'Offrir','',MW.S.money<c)}</div></div>`;}
 const free=carsNoir().length<(zone.libres||1),tooSoon=day()-n.serviceT<4;
 h+=`<div class="mw-prt"><div class="mw-prt-h"><b>Réparer sa voiture, gratuitement</b></div><small>Un petit travail à vos frais : fort effet sur son humeur, et elle sera plus tolérante pendant une semaine.${!free?' (Il faut un emplacement libre dans la cour.)':''}${tooSoon?' (Vous l\'avez déjà aidée récemment.)':''}</small><div class="mw-btns">${btn('v_serv','Proposer mon aide','',!free||tooSoon)}</div></div>`;
 h+=`<div class="mw-btns"><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`;
 MW.panel('Chez Mme Ricard',h,{wide:true,onClick:a=>{if(a.startsWith('noir:')) voisineAct(a.slice(5));}});}
function voisineAct(a){
 const n=N(),u=unit();
 if(a==='v_exc'){
  const eff=Math.max(0,8-4*n.excuses);
  if(n.excuses>=2){setGauge(n.gauge+2);say('« Vos excuses, j\'en ai assez ! » Elle claque la porte : elle est encore plus agacée.','warn');}
  else{setGauge(n.gauge-eff);say(eff>0?'Mme Ricard accepte vos excuses, du bout des lèvres.':'« Vous vous excusez tout le temps, mais rien ne change. »',eff>0?'good':'warn');}
  n.excuses++;}
 else if(a==='v_serv'){
  if(carsNoir().length>=(zone.libres||1)||day()-n.serviceT<4) return;
  const job=pickJob(),ids=job&&!job.lift?job:null,tpl=ids?ids.tpl:'essuie',symp=ids?ids.symp:null;
  const c=MWJ.spawn({noir:{zone:'cour',mod:['Pasco','Volta','citadine'],color:0xe0a8c8,client:'Mme Ricard',taux:MWJ.noirData.TAUX.garage1,prix:0,service:true},tpl:symp?undefined:tpl,symp:symp||undefined,silencieux:true});
  if(c){c.arrive=absT();say('Mme Ricard vous confie sa voiture (cour, emplacement '+(c.pont+1)+') : « '+(c.symp?c.symp.txt:c.nom)+' ». Réparez-la gratuitement.','good');MW.closePanel();return;}
  say('Pas de place dans la cour pour sa voiture.','warn');return;}
 else{const g=K.cadeaux.find(x=>x[0]===a.slice(2));if(!g) return;
  const c=Math.round(u*g[2]);if(MW.S.money<c){say('Pas assez d\'argent.','warn');return;}
  const eff=g[3]*Math.pow(.6,n.cadeaux.length);MW.money(-c,g[1]);n.cadeaux.push(day());setGauge(n.gauge-eff);
  say(`${g[1]} : Mme Ricard est touchée${eff<g[3]*.5?' (mais elle se lasse)':''}. Son agacement baisse.`,'good');}
 voisine();}
/* — auto-entrepreneur — */
function statutPanel(){
 const n=N(),c=price(K.inscriptionAE);
 let h=`<p>Le statut d'auto-entrepreneur déclare votre activité de mécanicien à votre compte.</p><ul class="mw-cond"><li class="ok">Plus aucune amende pour travail dissimulé, plus de contrôle ni de risque pour votre emploi.</li><li class="ok">Clients plus nombreux (+${Math.round((K.aeDemande-1)*100)} %), prix un peu plus élevés (+${Math.round((K.aeHausse-1)*100)} %).</li><li class="no">Cotisations : ${Math.round(K.cotis*100)} % de chaque paie.</li><li class="no">Le bruit gêne toujours la voisine : au pire, avertissement puis amende de la mairie pour nuisances.</li></ul>`;
 if(n.ae) h+='<p class="mw-soon">Vous êtes déjà inscrit comme auto-entrepreneur.</p>';
 else h+=`<p>Inscription : <b>${esc(fmt(c))}</b>.</p>`;
 h+=`<div class="mw-btns">${n.ae?'':btn('ae_ok','S\'inscrire','',MW.S.money<c)}<button type="button" class="btn sm ghost" data-mw="close">Fermer</button></div>`;
 MW.panel('Auto-entrepreneur',h,{onClick:a=>{if(a==='noir:ae_ok'){if(MW.S.money<c||n.ae) return;MW.money(-c,'Inscription auto-entrepreneur');n.ae=true;n.aeJour=day();n.ctlPending=null;n.ban=0;
  say('Vous êtes désormais auto-entrepreneur : vos travaux sont déclarés.','good');statutPanel();hudUpdate();}}});}

/* ═══════════ Mise en route ═══════════ */
function onStart(){
 const s=MW.S;N();buildYard();
 if(!zonePushed){zonePushed=true;if(!MW.zones.includes(zone)) MW.zones.push(zone);}
 dropScene();refreshYard();
 const n=N();
 // sauvegarde en cours de contrôle : on le règle tout de suite, sans scène
 if(n.ctlPending){const src=n.ctlPending.src;const rep=controle(src);MW.panel('Contrôle de la cour',reportHTML(rep));}
 hudUpdate();unlocked();}
MW.on('start',onStart);
MW.on('close',()=>{dropScene();});
MW.on('minute',()=>{onMinute();if(MW.S&&MW.S.min%15===0) hudUpdate();});
MW.on('hour',onHour);MW.on('day',onDay);
MW.on('jobDone',onJobDone);
MW.on('enterZone',()=>hudUpdate());MW.on('leaveZone',()=>hudUpdate());
let tk=0;
MW.on('tick',dt=>{
 if(!MW.S||!built) return;
 solid();
 // essais sur route partis de la cour : le moteur hurle
 const es=MWJ.state().essai;
 if(es&&!MW.paused){const c=MWJ.jobs().find(x=>x.id===es.car);
  if(c&&c.noir){const pc=MW.playerCar(),sp=Math.abs(pc.speed||0);
   if(Math.hypot(pc.x-zone.x,pc.z-zone.z)<70&&sp>3) bruit(dt*(sp>8?.35:.1),{k:c.noir.service?.5:1});}}
 const n=N();
 if(n.ctlPending&&!ctl&&!MW.paused&&!es) startScene();
 sceneTick(dt);
 tk+=dt;if(tk>.5){tk=0;winUpdate();
  if(M.arm&&M.arm.visible) M.arm.rotation.z=-.3-Math.abs(Math.sin(performance.now()/260))*1.2;}});
/* interactions */
MW.addInteract({id:'noir:porte',x:HOUSE.x0-1.4,z:43,r:1.9,label:'Frapper chez Mme Ricard',use:voisine});
MW.addInteract({id:'noir:coffre',x:-38.9,z:36,r:2.1,label:'Coffre à outils · cour',use:coffre});
MW.addInteract({id:'noir:emp2',x:-25,z:40,r:2.3,label:()=>'Aménager le 2e emplacement ('+fmt(price(K.emplacement2))+')',when:()=>!!MW.S&&N().slots<2&&!MWJ.jobs().some(c=>c.zone==='cour'&&c.pont===1),use:emplacementUse});
MW.addInteract({id:'noir:annonces',x:board.x,z:board.z,r:2.4,label:'Panneau de petites annonces',use:()=>panel(MW.S&&unlocked()?'ann':'dem')});
for(const id of ['ecole','banque']) (()=>{const z=MW.zone(id);if(z) MW.addInteract({id:'noir:ae:'+id,x:z.porte.x+4.6,z:z.porte.z,r:2.2,label:'Guichet auto-entrepreneur',use:statutPanel});})();
/* jour de la semaine dans l'horloge du HUD (si le socle ne l'affiche pas déjà) */
{const ts0=MW.timeStr;MW.timeStr=()=>{const t=ts0();if(!t||/^(lun|mar|mer|jeu|ven|sam|dim)/i.test(t)) return t;return JA[dow()]+'. · '+t;};}
/* touche N : section Travail au noir (touche non réservée) */
MW.on('key',k=>{if(k==='n') panel();});

const api={state:N,unit,unlocked,gauge,mult,bruit,gen:makeRequest,accept,refuse,denonce,controle,geste,canLift,payOf,panel,carnetHTML,act,shopHTML,shopAct,dow:()=>dow(),zone,
 fig:()=>M.fig,coffre,voisine,statut:statutPanel,mairie,K,price,rdvStr,carsNoir,startScene,setGauge,onHour,onDay,JOURS};
window.__mwn=api;
return api;})();
