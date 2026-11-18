'use strict';
/* ───────────── Mode « Mécanicien » — TRAVAUX ─────────────
   Clients et voitures à réparer, ordres de réparation (travaux précis ou symptôme à diagnostiquer), pièces et usure,
   gestes de réparation en 3D (capot, pont élévateur, roues, dessous), inventaire (12 places, barre en bas de l'écran),
   étagère de l'employeur, magasin « Pièces Auto Express », ferraille, diagnostic (inspection, essai sur route, valise),
   rendu de la voiture (facture, note sur 5, réputation, expérience) et carnet (touche Tab).
   S'appuie sur le socle `MW` (js/40-meca-monde.js) ; utilise `MWC` (js/42, carrière) seulement s'il existe.

   ═══ API `MWJ` ═══
   MWJ.PARTS        pièces, par identifiant : {id, nom, ab, zone:'capot'|'dessous'|'roue'|'cabine', ax:'av'|'ar'|'*'|'', comp, niv, prix, mo (minutes),
                    outil:'cles'|'cle_dyn'|'valise', hid (panne invisible à l'œil), vie (km), ...} ; MWJ.PARTS_LIST = même chose en tableau
   MWJ.SKILLS       identifiants des compétences ; MWJ.INV_MAX = 12
   MWJ.skillOf(id)  compétence liée à une pièce (ou à un modèle de travail) ; MWJ.level(comp) = 1 + floor(sqrt(xp/50)), max 10
   MWJ.done(job)    rend la voiture (job = voiture/ordre ou son identifiant) : facture, paie, xp, réputation, puis MW.emit('jobDone', job, note)
   MWJ.jobs()       ordres en cours (MW.S.jobs.cars) ; MWJ.spawn(opts) fait arriver un client (opts : {travaux:[ids]} ou {tpl:'vidange'} ou {symp:'frott'}, {km}, {force})
   MWJ.openCarnet() ouvre le carnet ; MWJ.shop() ouvre le magasin ; MWJ.inv() inventaire
   Événements émis : 'jobNew'(job), 'inspected'(job, partId), 'partFitted'(job, partId), 'jobDone'(job, note), 'essai'(job).
   Le job rendu contient : {id, client, voiture, plaque, travaux:[partIds], facture, pieces, mainOeuvre, pay (versé au joueur, pourboire compris),
   avance (pièces avancées remboursées), note, rep, competences:{comp:xp}, symptome, employeur, jour}.
   Données sauvegardées : MW.S.jobs = {cars, seq, next, outils, stats, hist, essai}. */
const MWJ=(()=>{
const PI=Math.PI,INV_MAX=12,OPEN0=480,OPEN1=1140,SEUIL=75;
const XP_K=2.0; /* multiplicateur d'expérience gagnée par voiture rendue (équilibrage du rythme) */
const SKILLS=['entretien','freinage','liaison','moteur','transmission','electricite','diagnostic'];
const SK_NOM={entretien:'Entretien',freinage:'Freinage',liaison:'Liaison au sol',moteur:'Moteur',transmission:'Transmission',electricite:'Électricité',diagnostic:'Diagnostic'};
const OUTILS={cles:{nom:'Jeu de clés et douilles',prix:0},cle_dyn:{nom:'Clé dynamométrique',prix:85},valise:{nom:'Valise de diagnostic',prix:220}};

/* ── les pièces : [id, nom, abrégé, zone, essieu, compétence, niveau, prix, minutes, outil, invisible, durée de vie (km), essai, indice d'essai, état d'usure, code valise] ── */
const PD=[
['huile','Huile moteur (5 l)','Huile','dessous','','entretien',1,35,25,'cles',0,15000,'ralenti',"Le moteur est bruyant : l'huile est épuisée.",'Huile noire et épaisse.',''],
['filtre_huile','Filtre à huile','Fil.H','dessous','','entretien',1,12,10,'cles',0,15000,'','','Filtre encrassé.',''],
['filtre_air','Filtre à air','Fil.A','capot','','entretien',1,18,10,'cles',0,30000,'accel','Le moteur manque de reprise : le filtre à air est bouché.','Filtre noir de poussière.',''],
['filtre_hab',"Filtre d'habitacle",'Fil.Hb','cabine','','entretien',1,15,15,'cles',0,20000,'','','Filtre gris, odeur de moisi.',''],
['bougies','Bougies (allumage ou préchauffage)','Boug.','capot','','moteur',2,32,30,'cles',0,60000,'accel',"Le moteur a des à-coups en accélérant.",'Électrodes usées, dépôt noir.',''],
['plaq_av','Plaquettes avant','Plq.AV','roue','av','freinage',2,45,40,'cles',0,50000,'frein','Grincement métallique au freinage, côté avant.','Garnitures à ras : le support métallique frotte.',''],
['plaq_ar','Plaquettes arrière','Plq.AR','roue','ar','freinage',2,38,40,'cles',0,80000,'frein','Le train arrière frotte légèrement au freinage.','Garnitures fines et inégales.',''],
['disq_av','Disques avant','Dsq.AV','roue','av','freinage',3,110,60,'cles',0,90000,'frein','Le volant vibre au freinage.','Disques rayés, bord marqué.',''],
['disq_ar','Disques arrière','Dsq.AR','roue','ar','freinage',3,90,60,'cles',0,130000,'frein','Légère pulsation dans la pédale au freinage.','Disques rouillés et rayés.',''],
['pneus','Pneus (×4)','Pneus','roue','*','liaison',1,240,60,'cles',0,45000,'virage',"La voiture manque d'adhérence dans les virages.",'Sculptures lisses, témoins d\'usure atteints.',''],
['batterie','Batterie','Batt.','capot','','electricite',1,95,15,'cles',1,80000,'demarrage','Le démarreur tourne mollement.','Bornes sulfatées.','Tension à vide 11,4 V : batterie faible.'],
['courroie_acc',"Courroie d'accessoires",'Crr.Ac','capot','','moteur',2,40,30,'cles',0,100000,'demarrage','Un sifflement strident au démarrage.','Courroie craquelée et effilochée.',''],
['courroie_dist','Kit de distribution','Distri','capot','','moteur',4,260,180,'cle_dyn',0,150000,'ralenti',"Un claquement irrégulier vient du moteur.",'Dents usées, galet qui accroche : risque de rupture.',''],
['liquide_frein','Liquide de frein','L.Frein','capot','','freinage',2,14,20,'cles',0,50000,'frein','La pédale de frein est spongieuse.','Liquide brun, chargé d\'eau.',''],
['amort','Amortisseurs avant (paire)','Amort.','roue','av','liaison',3,190,90,'cle_dyn',0,100000,'bosses','La voiture rebondit et claque sur les bosses.','Tiges huileuses : les amortisseurs fuient.',''],
['embrayage',"Kit d'embrayage",'Embr.','dessous','','transmission',4,320,240,'cle_dyn',0,160000,'accel',"Le moteur monte dans les tours sans accélérer : l'embrayage patine.",'Friction usée, disque fendu.',''],
['ampoules','Ampoules de feux','Amp.','cabine','','electricite',1,8,10,'cles',0,20000,'','','Un feu ne s\'allume plus.',''],
['essuie',"Balais d'essuie-glace",'Ess.','cabine','','entretien',1,16,10,'cles',0,25000,'','','Gomme durcie qui laisse des traînées.',''],
['alternateur','Alternateur','Alt.','capot','','electricite',3,180,90,'cles',1,200000,'demarrage',"Le voyant de charge s'allume et le moteur s'essouffle.",'','P0562 : tension de charge insuffisante (11,9 V moteur tournant).'],
['demarreur','Démarreur','Dém.','capot','','electricite',3,160,90,'cles',1,220000,'demarrage','Un simple « clic » au démarrage.','',"Appel de courant anormal du démarreur."],
['injecteurs','Injecteurs','Inj.','capot','','moteur',4,280,120,'cles',1,180000,'ralenti','Le ralenti est irrégulier et la voiture fume.','','P0301 et P0303 : ratés de combustion, injecteurs encrassés.'],
['sonde_lambda','Sonde lambda','Lamb.','dessous','','moteur',3,85,30,'cles',1,160000,'ralenti','Le ralenti est instable, la consommation grimpe.','','P0130 : signal de la sonde lambda figé.']];
if(typeof MWP!=='undefined') for(const a of MWP.PD) PD.push(a); /* js/51 : pannes réalistes (nouvelles pièces) */
const PARTS={},PLIST=[];
for(const a of PD){const p={id:a[0],nom:a[1],ab:a[2],zone:a[3],ax:a[4],comp:a[5],niv:a[6],prix:a[7],mo:a[8],outil:a[9],hid:!!a[10],vie:a[11],ess:a[12],essTxt:a[13],usTxt:a[14],code:a[15]};PARTS[p.id]=p;PLIST.push(p);}
const ZONE_NOM={capot:'Sous le capot',dessous:'Dessous (pont levé)',roue:'Roues, freins et suspension',cabine:'Habitacle et éclairage'};
const ESS_NOM=typeof MWP!=='undefined'?MWP.ESS:{demarrage:'Au démarrage',ralenti:'Au ralenti',accel:'En accélération',frein:'Au freinage',virage:'En virage',bosses:'Sur les bosses'};

/* ── modèles de travaux : [id, nom, pièces, poids] ── */
const TPL=[
['vidange','Vidange',['huile','filtre_huile'],4],
['essuie','Remplacement des essuie-glaces',['essuie'],2],
['ampoule',"Remplacement d'une ampoule",['ampoules'],2],
['pneus','Changement des 4 pneus',['pneus'],2],
['batterie','Remplacement de la batterie',['batterie'],1.5],
['filtres',"Filtres à air et d'habitacle",['filtre_air','filtre_hab'],2],
['revision',"Révision d'entretien",['huile','filtre_huile','filtre_air','filtre_hab'],2.5],
['plaq_av','Plaquettes de frein avant',['plaq_av'],2],
['plaq_ar','Plaquettes de frein arrière',['plaq_ar'],1],
['frein_av','Freinage avant complet (plaquettes et disques)',['plaq_av','disq_av'],1.5],
['liquide','Purge du liquide de frein',['liquide_frein'],1],
['bougies','Remplacement des bougies',['bougies'],1.5],
['cr_acc',"Courroie d'accessoires",['courroie_acc'],1],
['rev_c','Révision complète',['huile','filtre_huile','filtre_air','filtre_hab','bougies','liquide_frein'],1.5],
['distri','Kit de distribution',['courroie_dist'],1],
['embr',"Remplacement de l'embrayage",['embrayage'],.8],
['amort','Amortisseurs avant',['amort'],1],
['alt',"Remplacement de l'alternateur",['alternateur'],.8],
['dem','Remplacement du démarreur',['demarreur'],.8],
['sonde','Sonde lambda',['sonde_lambda'],.8]];
if(typeof MWP!=='undefined') for(const t of MWP.TPL) TPL.push(t);
/* ── symptômes : c = pièce coupable, red = pièces « leurres » un peu usées, dn = niveau de diagnostic ── */
const SYMP=typeof MWP!=='undefined'?MWP.SYMP:[];
const symDef=c=>{const y=c&&c.symp;return y?SYMP.find(x=>x.id===y.id)||null:null;};

/* ── clientèle et voitures (marques imaginaires) ── */
const MODELS={
garage1:[['Lorion','Zéta','citadine'],['Pasco','Volta','citadine'],['Dacar','Meli','berline'],['Rovane','Tribu','berline'],['Kévora','Lisse','citadine'],['Sanvi','Cargo','utilitaire']],
garage2:[['Ventoux','Alba','citadine'],['Ventoux','Marais','berline'],['Ventoux','Cime','suv'],['Ventoux','Plaine','utilitaire']],
garage3:[['Aurèle','Solenne','berline'],['Aurèle','Régence','berline'],['Aurèle','Altesse','suv']],
garage4:[['Brivio','Fulmine','sport'],['Brivio','Corsa 8','sport'],['Brivio','Rapace','sport']]};
const KMR={garage1:[45000,210000],garage2:[10000,120000],garage3:[6000,70000],garage4:[4000,50000],garage5:[40000,200000],garage6:[20000,160000],garage7:[8000,100000]};
/* rythme des clients par garage (minutes de jeu entre deux arrivées) : le quartier est fréquenté, le prestige reçoit peu mais bien */
const RYTHME={garage1:[8,20],garage2:[10,24],garage3:[18,40],garage4:[22,46],garage5:[10,22],garage6:[10,24],garage7:[14,32]};
/* [réseau] partie à deux : 2 joueurs = clients deux fois plus fréquents, file d'attente plus longue, un pont par joueur au minimum */
const NP=()=>{const n=MW.net;return n&&n.live&&n.players?n.players():1;};
const FILE_MAX0=3,PATIENCE=420;
const FILE_MAX_N=()=>FILE_MAX0*NP(); /* minutes d'ouverture (8 h – 19 h) qu'un client accepte d'attendre à l'accueil ; la nuit ne compte pas */
function nextGap(zid){const r=RYTHME[zid]||[10,24];let g=rint(r[0],r[1])/NP();const m=MW.S.min;
 if(m<600) g*=.75;else if(m>=720&&m<840) g*=1.4;else if(m>=1020) g*=1.2; /* rush du matin, creux du déjeuner, fin de journée plus calme */
 return Math.round(g);}
const TAUX={garage1:62,garage2:88,garage3:118,garage4:155}; /* taux horaire de main-d'œuvre facturé (€/h) : quartier, généraliste, prestige, sport */
const KFAC={citadine:1,berline:1.2,utilitaire:1.2,suv:1.5,sport:2.2};
const COLS=[0xb03030,0x2f5da8,0xe8e8e8,0x2a2a2e,0x3f8a4a,0xd8b22a,0x7a7f88,0xc86a1c,0x6a3a8a];
const NOMS=['Dupuis','Lambert','Moreau','Fabre','Garnier','Roux','Lefèvre','Marchand','Perrin','Collet','Benoît','Masson','Vidal','Carpentier','Girard','Noël','Blanc','Rey','Barre','Colin'];
const CIV=['M.','Mme','M.','Mme','Mlle'];
/* voitures réelles (js/44) : pièces, noms et prix selon la voiture ; sans MWCARS tout reste comme avant */
const appl=(m,id)=>{try{return (typeof MWCARS==='undefined'||!m||MWCARS.applies(m,id))&&(typeof MWP==='undefined'||MWP.applies(m,id));}catch(e){return true;}};
const fuelOK=(m,y)=>{try{return typeof MWP==='undefined'||MWP.fuelOK(m,y);}catch(e){return true;}};
const pn=(c,p)=>{const id=typeof p==='string'?p:p.id;let n=null;try{if(c&&c.mdl&&typeof MWCARS!=='undefined') n=MWCARS.partName(c.mdl,id);}catch(e){}return n||PARTS[id].nom;};
const pprice=(c,p)=>{try{if(c&&c.mdl&&typeof MWCARS!=='undefined') return MWCARS.partPrice(c.mdl,p.id,p.prix);}catch(e){}return p.prix;};
const lbl=c=>`${c.marque} ${c.modele}`+(c.an?` · ${c.an}`:'');
const rnd=Math.random,rint=(a,b)=>a+Math.floor(rnd()*(b-a+1));
const pick=a=>a[Math.floor(rnd()*a.length)];
const R2=x=>Math.round(x*100)/100;
const fmt=x=>MW.fmt(x);
/* ── [MWG] points d'accroche des gestes réalistes (js/46-meca-gestes.js) ── */
const MG=()=>typeof MWG!=='undefined'&&MWG&&MWG.on?MWG:null;
const GM=(c,id,ph,m)=>{const g=MG();return g&&g.fin?g.rest(c,id,ph,m):m;}; /* minutes restantes à ajouter (les gestes ont déjà fait avancer l'horloge) */
const LH=c=>{const g=MG();return g?g.lift(c):1;}; /* hauteur du pont élévateur */

/* ═══════════ État ═══════════ */
function J(){const s=MW.S;if(!s.jobs) s.jobs={};const j=s.jobs;
 if(!j.cars) j.cars=[];if(!j.file) j.file=[];if(j.seq==null) j.seq=0;if(j.next==null) j.next=0;if(!j.outils) j.outils={cles:1};
 if(!j.stats) j.stats={rendues:0,note:0,gain:0};if(!j.hist) j.hist=[];if(j.essai===undefined) j.essai=null;
 if(!s.inv) s.inv=[];if(!s.xp) s.xp={};return j;}
const lv=c=>{const x=(MW.S&&MW.S.xp&&MW.S.xp[c])||0;return Math.min(10,1+Math.floor(Math.sqrt(x/50)));};
const maxLv=()=>Math.max(...SKILLS.map(lv));
function emp(){
 if(typeof MWC!=='undefined'&&MWC&&typeof MWC.employer==='function'){let e=null;try{e=MWC.employer();}catch(x){e=null;}return e&&e.zone?e:null;}
 return {id:'garage1',nom:'Garage du Coin',zone:'garage1',salaire:0,paie:'tache',niveauxAutorises:3};}
const empMax=e=>{const n=e&&e.niveauxAutorises;return Array.isArray(n)?Math.max(0,...n):(typeof n==='number'?n:3);};
const aSonCompte=e=>!!(e&&(e.compte||e.aSonCompte||e.id==='compte'));
const absT=()=>{const s=MW.S;return s.day*1440+(s.min<360?s.min+1440:s.min);};
const openT=()=>{const s=MW.S;return s.day*660+(s.min<360?660:clamp(s.min-480,0,660));};
const hm=m=>String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const carById=id=>J().cars.find(c=>c.id===id)||null;
const carAt=(zid,i)=>J().cars.find(c=>c.zone===zid&&c.pont===i)||null;
const canDo=(id,c)=>{const p=PARTS[id];
 if(c&&c.noir) return lv(p.comp)>=p.niv; /* noir : seul votre niveau compte, pas le poste */
 if(typeof MWC!=='undefined'&&MWC&&typeof MWC.canDo==='function'){try{return !!MWC.canDo(id);}catch(e){}}
 return lv(p.comp)>=p.niv;};
function addXp(comp,n){if(!(n>0)) return;const s=MW.S,a=lv(comp);s.xp[comp]=(s.xp[comp]||0)+n;const b=lv(comp);
 if(b>a) MW.toast(`Niveau ${b} en ${SK_NOM[comp].toLowerCase()} !`,'good');}
const skillOf=id=>{if(PARTS[id]) return PARTS[id].comp;const t=TPL.find(x=>x[0]===id);if(t) return PARTS[t[2][0]].comp;const y=SYMP.find(x=>x.id===id);return y?PARTS[y.c].comp:null;};

/* ── outils ── */
function outilOK(k,c){if(k==='cles') return true;if(J().outils[k]) return true;if(c&&c.noir) return false; /* noir : vos propres outils */const e=emp();return !!(e&&e.zone!=='garage1'&&!aSonCompte(e));}
/* ── inventaire ── */
const inv=()=>{J();return MW.S.inv;};
function invAdd(it){if(inv().length>=INV_MAX) return false;inv().push(it);invUI();return true;}
function invDel(i){inv().splice(i,1);invUI();}
const invFind=(k,id,job)=>inv().findIndex(it=>it.k===k&&it.id===id&&(job==null||it.job===job));

/* ═══════════ Voitures clientes ═══════════ */
function wearOf(p,km){return clamp(Math.round(km/p.vie*60*(.4+rnd()*.8)),0,70);}
function chooseJob(e,o,mdl){
 const cap=empMax(e),stretch=J().stats.rendues>0&&rnd()<.1?1:0, /* jamais de travail « au-dessus » pour la toute première voiture */
 ok=id=>{const p=PARTS[id];return p.niv<=Math.max(cap,1)&&lv(p.comp)+stretch>=p.niv&&appl(mdl,id);};
 if(o.travaux){const l=o.travaux.filter(id=>PARTS[id]);return {type:'travaux',ordre:l,nom:o.nom||l.map(id=>PARTS[id].nom).join(', ')};}
 if(o.tpl){const t=TPL.find(x=>x[0]===o.tpl);if(t) return {type:'travaux',ordre:t[2].slice(),nom:t[1]};}
 if(o.symp){const y=SYMP.find(x=>x.id===o.symp);if(y) return {type:'symptome',symp:y,ordre:[],nom:y.txt};}
 const J1=J();
 if(J1.stats.rendues>=3&&rnd()<.3){
  const ys=SYMP.filter(y=>ok(y.c)&&(y.ch||[]).every(ok)&&fuelOK(mdl,y)&&y.dn<=lv('diagnostic')+stretch&&(!PARTS[y.c].hid||y.dn<=1||lv('electricite')>=2||PARTS[y.c].comp!=='electricite'));
  if(ys.length){const y=pick(ys);return {type:'symptome',symp:y,ordre:[],nom:y.txt};}}
 const ts=TPL.filter(t=>t[2].every(ok));const l=ts.length?ts:[TPL[0]];
 let tot=0;for(const t of l) tot+=t[3];let r=rnd()*tot,t=l[0];for(const x of l){r-=x[3];if(r<=0){t=x;break;}}
 return {type:'travaux',ordre:t[2].slice(),nom:t[1]};}
const needOf=o=>o.travaux?o.travaux.filter(id=>PARTS[id]):o.tpl?((TPL.find(x=>x[0]===o.tpl)||[0,0,[]])[2]):o.symp?sympNeed(SYMP.find(x=>x.id===o.symp)):[];
const sympNeed=y=>y?[y.c].concat(y.ch||[]):['huile'];
/* modèle du garage (tuple [marque, modèle + moteur, kind, id]) où toutes les pièces demandées existent (pas de courroie de distribution sur une chaîne…) */
function modelFor(zid,need,y){const pl=MODELS[zid]||MODELS.garage1,f=pl.filter(m=>(!need||!need.length||need.every(id=>appl(m[3],id)))&&fuelOK(m[3],y));return pick(f.length?f:pl);}
function makeCar(o){
 o=o||{};const NZ=o.noir||null; /* noir : client hors garage {zone,mod,color,client,taux,prix…}, sans employeur */
 const e=NZ?{id:'noir',zone:NZ.zone||'cour',niveauxAutorises:10}:emp();if(!e) return null;const z=MW.zone(e.zone);if(!z||!z.ponts) return null;
 const j=J();let pont=-1;const nP=z.libres!=null?z.libres:z.ponts.length;for(let i=0;i<nP;i++) if(!carAt(z.id,i)){pont=i;break;}
 if(pont<0) return null;
 const mod=(NZ&&NZ.mod)||modelFor(z.id,needOf(o),o.symp?SYMP.find(x=>x.id===o.symp):null),jb=chooseJob(e,o,mod[3]),kr=KMR[z.id]||KMR.garage1,cat=mod[3]&&typeof MWCARS!=='undefined'?MWCARS.get(mod[3]):null;
 let km=o.km||Math.round(rint(kr[0],kr[1])/100)*100,an=null;
 if(cat){const yr=2026,age=Math.round(Math.max(1,km/rint(9000,16000)));an=clamp(yr-age,cat.y0,Math.min(cat.y1,yr));if(!o.km) km=Math.round(clamp((yr-an)*rint(8000,16500)+rint(500,6000),Math.min(kr[0],4000),kr[1]*1.15)/100)*100;}
 const parts={};for(const p of PLIST) parts[p.id]=appl(mod[3],p.id)?{u:p.id==='ampoules'?rint(0,25):wearOf(p,km)}:{u:0,na:1};
 // un petit « extra » usé, détectable à l'inspection
 const sy0=jb.symp?SYMP.find(x=>x.id===jb.symp.id):null,sySet=sy0?[sy0.c].concat(sy0.red,sy0.ch||[]):[];
 if(rnd()<.35){const exl=PLIST.filter(p=>!p.hid&&p.niv<=Math.max(lv(p.comp)+1,1)&&!jb.ordre.includes(p.id)&&!sySet.includes(p.id)&&p.id!=='ampoules'&&appl(mod[3],p.id));const ex=exl.length?pick(exl):null;if(ex) parts[ex.id].u=rint(78,94);}
 for(const id of jb.ordre) parts[id].u=Math.max(parts[id].u,rint(62,97));
 if(jb.symp){parts[jb.symp.c].u=rint(92,100);for(const id of jb.symp.red) if(parts[id]&&!parts[id].na) parts[id].u=Math.max(parts[id].u,rint(42,62));
  for(const id of (sy0&&sy0.ch)||[]) if(parts[id]&&!parts[id].na) parts[id].u=Math.max(parts[id].u,rint(78,94)); /* dégâts en chaîne : abîmés par la panne d'origine */}
 for(const id in parts) parts[id].u0=parts[id].u;
 let mo=0;for(const id of jb.ordre) mo+=PARTS[id].mo;if(jb.symp) mo=PARTS[jb.symp.c].mo+60+((sy0&&sy0.ch)||[]).reduce((a,id)=>a+(parts[id]&&!parts[id].na?PARTS[id].mo:0),0);
 const L=()=>String.fromCharCode(65+rint(0,25));
 const c={id:'j'+(++j.seq),zone:z.id,pont,client:(NZ&&NZ.client)||pick(CIV)+' '+pick(NOMS),marque:mod[0],modele:mod[1],kind:mod[2],mdl:mod[3]||null,an:an,color:(NZ&&NZ.color!=null)?NZ.color:pick(COLS),
  plaque:L()+L()+'-'+String(rint(100,999))+'-'+L()+L(),km,fp:KFAC[mod[2]]*(z.id==='garage3'?1.5:z.id==='garage4'?1.35:z.id==='garage7'?1.25:z.id==='garage6'?1.1:1),taux:(NZ&&NZ.taux)||TAUX[z.id]||55,noir:NZ?Object.assign({},NZ):undefined,
  rend:o.rend!=null?!!o.rend:(!NZ&&j.stats.rendues>=3&&Math.random()<.2),arrive:absT(),ot0:openT(),promis:openT()+Math.max(150,Math.round(mo*2+60)),type:jb.type,ordre:jb.ordre,symp:jb.symp?{id:jb.symp.id,txt:jb.symp.txt,c:jb.symp.c,dn:jb.symp.dn}:null,nom:jb.nom,
  parts,st:{capot:0,lifted:0,av:0,ar:0},insp:{},rem:{},done:{},reemp:{},clues:[],codes:null,essai:0,comp:{},avance:0,ni:0};
 j.cars.push(c);buildMesh(c);moveInteracts(c);hudJobs();
 if(!o.silencieux){MW.toast(`${c.client} dépose sa ${c.marque} ${c.modele} (pont n° ${pont+1}) : « ${jb.symp?jb.symp.txt:jb.nom} »${c.rend?' Il veut récupérer ses anciennes pièces.':''}`,'info');}
 MW.emit('jobNew',c);return c;}
function removeCar(c,silent){
 const j=J(),i=j.cars.indexOf(c);if(i>=0) j.cars.splice(i,1);
 const r=RT[c.id];if(r){MW.scene.remove(r.g);delete RT[c.id];}
 if(!silent) hudJobs();}

/* ── maillage 3D des voitures (sur les ponts) ── */
const RT={};let MKG=null,MKM=null;
const KD={citadine:[3.7,1.65],berline:[4.6,1.8],sport:[4.4,1.9],suv:[4.5,1.9],utilitaire:[4.8,1.9]};
const dimOf=c=>{try{if(c.mdl&&typeof MWCARS!=='undefined'){const m=MWCARS.get(c.mdl);if(m) return [m.L,m.W];}}catch(e){}return KD[c.kind]||KD.berline;};
const ptsOf=c=>{try{if(c.mdl&&typeof MWCARS!=='undefined'&&MWCARS.get(c.mdl)) return MWCARS.pts(c.mdl);}catch(e){}return null;};
function buildMesh(c){
 const z=MW.zone(c.zone);if(!z||!z.ponts||!z.ponts[c.pont]) return;const p=z.ponts[c.pont],T=MW.THREE;
 const old=RT[c.id];if(old) MW.scene.remove(old.g);
 const g=MW.carMesh({color:c.color,kind:c.kind,model:c.mdl,plate:c.plaque}),d=dimOf(c),r={g,hood:g.getObjectByName('hood'),y:.22+(c.st.lifted?LH(c):0),ha:c.st.capot?-1:0,disc:{},mk:{}};
 g.position.set(p.x,r.y,p.z);g.rotation.y=p.ry;MW.scene.add(g);
 if(r.hood) r.hood.rotation.x=r.ha;
 for(const n of ['wFL','wFR','wRL','wRR']){const w=g.getObjectByName(n);if(!w) continue;
  if(g.getObjectByName('brake'+n.slice(1))) continue; /* js/44 : disques et étriers réels, toujours visibles */
  const m=MW.cyl(.13,.22,0x8a8f98,w.position.x,w.position.y,w.position.z);m.rotation.z=PI/2;g.add(m);m.visible=false;r.disc[n]=m;}
 const mkr=(k,x,y,zz)=>{const m=new T.Mesh(MKG||(MKG=new T.OctahedronGeometry(.06)),MKM||(MKM=new T.MeshBasicMaterial({color:0xffb800,transparent:true,opacity:.55,depthWrite:false})));m.position.set(x,y,zz);g.add(m);r.mk[k]=m;}; /* repères discrets (menus classiques seulement) */
 const ud=g.userData&&g.userData.anchors;
 if(ud&&ud.hoodPivot){const hp=ud.hoodPivot.position,hL=g.userData.hoodLen||.9;mkr('capot',0,hp.y+.4,hp.z+hL*.5);mkr('cabine',d[1]/2+.05,1.0,ud.cabin.position.z);mkr('dessous',0,.3,ud.under.position.z);
  for(const n of ['FL','FR','RL','RR']){const a=ud['hub'+n].position;mkr(n,Math.sign(a.x)*(d[1]/2+.05),a.y*2+.1,a.z);}}
 else{mkr('capot',0,1.15,d[0]/2-.45);mkr('cabine',d[1]/2+.05,1.0,0);mkr('dessous',0,.3,0);
 for(const [n,sx,sz] of [['FL',1,1],['FR',-1,1],['RL',1,-1],['RR',-1,-1]]) mkr(n,sx*(d[1]/2+.05),.85,sz*d[0]*.3);}
 RT[c.id]=r;applyVisual(c,true);if(MG()) MG().mesh(c);}
function applyVisual(c,snap){
 const r=RT[c.id];if(!r) return;
 if(snap){r.y=.22+(c.st.lifted?LH(c):0);r.ha=c.st.capot?-1:0;r.g.position.y=r.y;if(r.hood) r.hood.rotation.x=r.ha;}
 for(const n of ['FL','FR','RL','RR']){const off=n[0]==='F'?c.st.av:c.st.ar,w=r.g.getObjectByName('w'+n);if(w&&!(MG()&&MG().ownW(c))) w.visible=!off;if(r.disc['w'+n]) r.disc['w'+n].visible=!!off;}
 syncMk(c,r);}
function syncMk(c,r){const real=!!(MG()&&MG().on());for(const k in r.mk) r.mk[k].visible=!real&&(k!=='dessous'||!!c.st.lifted);}
function moveInteracts(c){
  const z=MW.zone(c.zone),p=z&&z.ponts&&z.ponts[c.pont];if(!p) return;const d=dimOf(c),pt=ptsOf(c),f={x:Math.sin(p.ry),z:Math.cos(p.ry)},l={x:Math.cos(p.ry),z:-Math.sin(p.ry)};
 const at=(lx,lz)=>({x:p.x+l.x*lx+f.x*lz,z:p.z+l.z*lx+f.z*lz});
 const set=(k,lx,lz)=>{const o=PTS[c.zone+':'+c.pont+':'+k];if(o){const q=at(lx,lz);o.x=q.x;o.z=q.z;}};
 if(pt){for(const k in pt) set(k,pt[k].x,pt[k].z);return;}
 set('capot',0,d[0]/2+.9);set('cabine',d[1]/2+.8,0);set('dessous',0,0);
 set('FL',d[1]/2+.8,d[0]*.3);set('FR',-(d[1]/2+.8),d[0]*.3);set('RL',d[1]/2+.8,-d[0]*.3);set('RR',-(d[1]/2+.8),-d[0]*.3);}
function animate(dt){
 for(const id in RT){const r=RT[id],c=carById(id);if(!c){continue;}
  if(!(ess&&ess.c===c)){const ty=.22+(c.st.lifted?LH(c):0);if(Math.abs(r.y-ty)>.002){r.y+=clamp(ty-r.y,-dt*.9,dt*.9);r.g.position.y=r.y;}}
  if(r.mk&&(r._mg=(r._mg||0)+1)%20===0) syncMk(c,r);
  if(r.hood){const ta=c.st.capot?-1:0;if(Math.abs(r.ha-ta)>.002){r.ha+=clamp(ta-r.ha,-dt*2.5,dt*2.5);r.hood.rotation.x=r.ha;}}}}

/* ═══════════ Accès, gestes ═══════════ */
function acces(c,p){
 if(p.zone==='capot') return c.st.capot?{ok:1}:{ok:0,why:'Ouvrez le capot.'};
 if(p.zone==='cabine') return {ok:1};
 if(!c.st.lifted) return {ok:0,why:c.noir?'Pas de pont ici : mettez la voiture sur chandelles (cric et chandelles en vente chez Pièces Auto Express).':'Levez le pont.'}; /* noir */
 if(p.zone==='dessous') return {ok:1};
 if(p.ax==='*') return c.st.av&&c.st.ar?{ok:1}:{ok:0,why:'Déposez les quatre roues.'};
 return (p.ax==='av'?c.st.av:c.st.ar)?{ok:1}:{ok:0,why:`Déposez les roues ${p.ax==='av'?'avant':'arrière'}.`};}
const demande=c=>c.symp?`« ${c.symp.txt} »`:c.nom;
const voit=c=>`${c.marque} ${c.modele}`;
function warn(t){MW.toast(t,'warn');return false;}
/* noir : point d'accroche des gestes dans la cour (temps supplémentaire, bruit) ; m = minutes déjà écoulées */
function NG(c,k,p,m){if(c&&c.noir&&typeof MWN!=='undefined'&&MWN.geste){try{MWN.geste(c,k,p,m||0);}catch(e){console.error(e);}}}
function gesteOK(c,p){
 const a=acces(c,p);if(!a.ok) return warn(a.why);
 if(!canDo(p.id,c)) return warn(`Réservé aux mécaniciens plus expérimentés : ${SK_NOM[p.comp].toLowerCase()} niveau ${p.niv} requis (vous : niveau ${lv(p.comp)}).`);
 if(!outilOK(p.outil,c)) return warn(`Il vous faut : ${OUTILS[p.outil].nom.toLowerCase()} (en vente chez Pièces Auto Express).`);
 return true;}
function doInspect(c,id){
 const p=PARTS[id],a=acces(c,p);if(!a.ok) return warn(a.why);
 MW.addMin(4);NG(c,'insp',p,4);if(!c.insp[id]){c.insp[id]=1;c.ni++;if(c.ni<=8) c.comp.diagnostic=(c.comp.diagnostic||0)+2;}
 MW.emit('inspected',c,id);return true;}
function doDep(c,id){
 const p=PARTS[id];if(c.done[id]||c.rem[id]) return false;if(!gesteOK(c,p)) return false;
 if(inv().length>=INV_MAX) return warn('Inventaire plein : jetez ou revendez des pièces usagées.');
 {const m=Math.max(4,Math.round(p.mo*.4));MW.addMin(GM(c,id,'dep',m));NG(c,'dep',p,m);}c.rem[id]=1;if(!c.insp[id]){c.insp[id]=1;}
 invAdd({k:'usagee',id,u:c.parts[id].u,job:c.id,pv:pprice(c,p),car:voit(c),rend:c.rend?1:undefined});MW.toast(`${pn(c,p)} déposé(e) : rangé(e) dans l'inventaire${c.rend?' (le client veut la récupérer)':''}.`,'info');return true;}
/* pièce de réemploi : pièce durable (pneus, batterie, disques, amortisseurs, alternateur, démarreur, injecteurs) d'une AUTRE voiture,
   remise en état ou usée à 60 % au plus, que son client ne réclame pas. Jamais d'huile, de filtres ni de plaquettes d'occasion. */
const REEMP=['pneus','batterie','disq_av','disq_ar','amort','alternateur','demarreur','injecteurs'];
const reempFind=(c,id)=>REEMP.includes(id)?inv().findIndex(it=>it.k==='usagee'&&it.id===id&&it.job!==c.id&&!rendBloq(it)&&(it.ren||it.u<=60)):-1;
/* pièce en main (Maj + chiffre, X, clic sur la barre) : montée en priorité si elle convient */
/* outils d'atelier : on ne les a pas sur soi, on va les chercher à la servante (chariot près du pont) ou à l'établi.
   Ils prennent une place dans l'inventaire comme les pièces : {k:'outil', id}. [nom, abrégé] */
const TOOLS_INV={cliquet:['Cliquet et douilles','Cliq.'],cle_filtre:['Clé à filtre','Clé F.'],tournevis:['Tournevis','Tourn.'],boulonneuse:['Boulonneuse','Boul.'],
 cle_dyn:['Clé dynamométrique','Dyn.'],bac:['Bac de vidange','Bac'],bidon:["Bidon d'atelier",'Bidon'],entonnoir:['Entonnoir','Ent.'],pinces:['Pinces','Pinces'],
 presse:['Repousse-piston','Presse'],seringue:["Seringue d'aspiration",'Ser.']};
/* outils conseillés pour chaque pièce (bouton « Prendre les outils de l'ordre » de la servante) */
const TOOLS_FOR={huile:['bac','cliquet','cle_dyn','entonnoir','bidon'],filtre_huile:['cle_filtre','cliquet','bidon'],plaq_av:['boulonneuse','cliquet','presse','cle_dyn'],plaq_ar:['boulonneuse','cliquet','presse','cle_dyn'],
 disq_av:['boulonneuse','cliquet','presse','cle_dyn'],disq_ar:['boulonneuse','cliquet','presse','cle_dyn'],pneus:['boulonneuse','cle_dyn'],bougies:['cliquet','cle_dyn'],courroie_acc:['cliquet','pinces'],
 batterie:['cliquet'],filtre_air:['tournevis'],filtre_hab:[],ampoules:['tournevis'],essuie:[],liquide_frein:['seringue','bidon'],amort:['boulonneuse','cliquet','cle_dyn'],
 alternateur:['cliquet'],demarreur:['cliquet'],injecteurs:['cliquet'],sonde_lambda:['pinces','cliquet'],courroie_dist:['cliquet','cle_dyn'],embrayage:['cliquet']};
if(typeof MWP!=='undefined') Object.assign(TOOLS_FOR,MWP.TOOLS);
const isTool=it=>!!it&&it.k==='outil';
const itNom=it=>isTool(it)?(TOOLS_INV[it.id]||[it.id])[0]:PARTS[it.id].nom;
const itAb=it=>isTool(it)?(TOOLS_INV[it.id]||[it.id,it.id])[1]:PARTS[it.id].ab;
const toolIdx=id=>inv().findIndex(it=>isTool(it)&&it.id===id);
const SLOTK=['1','2','3','4','5','6','7','8','9','0',')','='];  /* touches des emplacements (clavier français : ) et = à droite du 0) */
let selIt=null;
const selIdx=()=>selIt?inv().indexOf(selIt):-1;
const selOK=(c,id)=>{const i=selIdx();if(i<0) return -1;const it=inv()[i];if(it.id!==id) return -1;return (it.k==='neuve'||(it.k==='usagee'&&REEMP.includes(id)&&it.job!==c.id&&!rendBloq(it)&&(it.ren||it.u<=60)))?i:-1;};
const newFind=(c,id)=>{const s=selOK(c,id);if(s>=0) return s;const i=invFind('neuve',id);return i>=0?i:reempFind(c,id);};
function setHeld(it){if(selIt===it) return;selIt=it||null;invUI();MW.emit('held',selIt);}
function take(i){const it=inv()[i];setHeld(!it||selIt===it?null:it);}
function hold(i){setHeld(inv()[i]||null);}            /* prend en main sans basculer */
function holdTool(id){const i=toolIdx(id);if(i<0) return false;hold(i);return true;}
function takeNext(d){const a=inv();if(!a.length){setHeld(null);return;}
 const i=selIdx(),n=i<0?(d>0?0:a.length-1):i+d;setHeld(n>=0&&n<a.length?a[n]:null);}
/* outils : prendre / ranger (servante, établi) */
function toolTake(id){if(!TOOLS_INV[id]||toolIdx(id)>=0) return false;if(inv().length>=INV_MAX){MW.toast('Inventaire plein : rangez un outil ou une pièce.','warn');return false;}inv().push({k:'outil',id});invUI();return true;}
function toolPut(id){const i=toolIdx(id);if(i<0) return false;if(inv()[i]===selIt) selIt=null;inv().splice(i,1);invUI();MW.emit('held',selIt);return true;}
function toolsNeeded(zid){const need=[];for(const c of J().cars) if(c.zone===zid&&!c.noir){
  const o=c.g&&c.g.o,posed=t=>(t==='bac'&&o&&o.bac)||(t==='entonnoir'&&o&&o.fun); /* déjà posés : le bac sous la voiture, l'entonnoir sur le moteur */
  for(const id of c.ordre) if(!c.done[id]) for(const t of TOOLS_FOR[id]||['cliquet']) if(!need.includes(t)&&!posed(t)) need.push(t);}
 return need;}
/* la servante : tous les outils de l'atelier, à prendre ou à ranger */
function servante(zid){
 const z=zid||(J().cars[0]&&J().cars[0].zone)||'garage1',need=toolsNeeded(z).filter(t=>toolIdx(t)<0);
 let h=`<p class="hint">Les outils ne sont pas dans vos poches : prenez ceux du travail en cours. Ils occupent une place dans votre inventaire (${inv().length}/${INV_MAX}). Touches 1 à 0 pour les prendre en main.</p>`;
 if(need.length) h+=`<div class="mw-btns">${btn('need',"Prendre les outils de l'ordre ("+need.map(t=>TOOLS_INV[t][0].toLowerCase()).join(', ')+')')}</div>`;
 h+=Object.keys(TOOLS_INV).map(id=>{const i=toolIdx(id),has=i>=0;return `<div class="mw-prt"><div class="mw-prt-h"><b>${esc(TOOLS_INV[id][0])}</b>${has?`<span class="mw-tag ok">Sur vous · touche ${SLOTK[i]||'—'}</span>`:''}</div><div class="mw-btns">${has?btn('put:'+id,'Ranger','ghost'):btn('take:'+id,'Prendre','',inv().length>=INV_MAX)}</div></div>`;}).join('');
 const nb=inv().filter(isTool).length;if(nb) h+=`<div class="mw-btns">${btn('putall','Ranger tous mes outils ('+nb+')','ghost')}</div>`;
 show('Servante à outils',h,a=>{const [k,id]=a.split(':');
  if(k==='take') toolTake(id);else if(k==='put') toolPut(id);
  else if(k==='need'){const got=need.filter(t=>toolTake(t));if(got.length) MW.toast(`Outils pris : ${got.map(t=>TOOLS_INV[t][0].toLowerCase()).join(', ')}.`,'good');}
  else if(k==='putall'){for(const t of Object.keys(TOOLS_INV)) toolPut(t);}
  servante(z);},{keep:true,wide:true});}
function doPose(c,id){
 const p=PARTS[id];if(!c.rem[id]) return false;if(!gesteOK(c,p)) return false;
 const i=newFind(c,id);if(i<0) return warn(`Il vous faut ${pn(c,p).toLowerCase()} neuf(ve) : prenez-le à l'étagère ou achetez-le chez Pièces Auto Express (ou une pièce d'occasion en bon état).`);
 const it=inv()[i];invDel(i);const re=it.k==='usagee'?it:null;{const m=Math.max(4,Math.round(p.mo*.6));MW.addMin(GM(c,id,'pose',m));NG(c,'pose',p,m);}
 if(it.src==='achat') c.avance=R2(c.avance+(it.paye||0));
 delete c.rem[id];c.done[id]=1;c.parts[id].u=re?re.u:0;if(!c.reemp) c.reemp={};if(re) c.reemp[id]={u:re.u,ren:!!re.ren};else delete c.reemp[id];
 if(re){MW.toast(`${pn(c,p)} : pièce de réemploi montée (${re.ren?'remise en état, ':''}usure ${re.u} %).`,'good');MW.emit('partFitted',c,id);return true;}
 MW.toast(id==='huile'&&c.mdl&&typeof MWCARS!=='undefined'?`${pn(c,p)} : ${nf(MWCARS.oilL(c.mdl),2)} l versés, niveau au repère maxi.`:`${pn(c,p)} : monté(e).`,'good');MW.emit('partFitted',c,id);return true;}
function doRem(c,id){
 const p=PARTS[id];if(!c.rem[id]) return false;const i=invFind('usagee',id,c.id);
 if(i<0) return warn("L'ancienne pièce n'est plus dans votre inventaire.");
 invDel(i);{const m=Math.max(3,Math.round(p.mo*.3));MW.addMin(m);NG(c,'rem',p,m);}delete c.rem[id];MW.toast(`${pn(c,p)} : ancienne pièce remise en place.`,'info');return true;}
const remIn=(c,f)=>Object.keys(c.rem).some(id=>f(PARTS[id]));
function togCapot(c){
 if(c.st.capot){if(remIn(c,p=>p.zone==='capot')) return warn('Une pièce est démontée sous le capot.');c.st.capot=0;MW.addMin(1);NG(c,'capot',null,1);}
 else{c.st.capot=1;MW.addMin(1);NG(c,'capot',null,1);}applyVisual(c);return true;}
function togPont(c){
 if(c.st.lifted){if(c.st.av||c.st.ar) return warn("Remontez d'abord les roues.");if(remIn(c,p=>p.zone==='dessous'||p.zone==='roue')) return warn('Une pièce est démontée sous la voiture.');c.st.lifted=0;MW.addMin(2);NG(c,'baisser',null,2);}
 else{if(c.noir&&typeof MWN!=='undefined'&&MWN.canLift&&!MWN.canLift(c)) return false; /* noir */
  c.st.lifted=1;MW.addMin(3);NG(c,'lever',null,3);}applyVisual(c);return true;}
function togRoues(c,ax){
 if(!c.st.lifted) return warn("Levez d'abord le pont.");
 if(c.st[ax]){if(remIn(c,p=>p.zone==='roue'&&(p.ax===ax||(p.ax==='*')))) return warn('Une pièce est démontée sur ces roues.');c.st[ax]=0;MW.addMin(8);NG(c,'roues',null,8);}
 else{c.st[ax]=1;MW.addMin(8);NG(c,'roues',null,8);}applyVisual(c);return true;}
/* codes lus à la valise : ceux du coupable du symptôme (vrais codes P…), des codes trompeurs sur les fausses pistes un peu usées,
   puis ceux des pièces invisibles ou à capteur déjà très usées (sans symptôme particulier) */
function codesOf(c){
 const y=symDef(c),l=[],add=t=>{if(t&&!l.includes(t)) l.push(t);};
 for(const q of PLIST){const pr=c.parts[q.id];if(!pr||pr.na||c.done[q.id]) continue;
  if(y&&y.c===q.id&&y.cod){if(pr.u>=60) for(const t of y.cod) add(t);continue;}
  if(q.code&&pr.u>=SEUIL) add(q.code);} /* seule une pièce vraiment usée laisse un code : les autres restent muettes */
 if(y&&y.fx) for(const id in y.fx){const pr=c.parts[id];if(pr&&!pr.na&&!c.done[id]&&pr.u>=40) add(y.fx[id]);}
 return l;}
function doValise(c){
 if(!outilOK('valise',c)) return warn('Il vous faut une valise de diagnostic (en vente chez Pièces Auto Express).');
 if(lv('electricite')<2) return warn("Lire la valise demande de l'électronique : niveau 2 en électricité.");
 MW.addMin(10);NG(c,'valise',null,10);const l=codesOf(c);
 c.codes=l.length?l:['Aucun défaut mémorisé.'];if(!c.vu){c.vu=1;c.comp.diagnostic=(c.comp.diagnostic||0)+4;}return true;}
/* texte d'inspection d'une pièce : ce que dit le symptôme de cette voiture, sinon le texte général de la pièce */
function inspLine(c,id){
 const p=PARTS[id],u=c.parts[id].u,y=symDef(c),it=y&&y.ins&&y.ins[id]||'';
 if(p.hid) return "rien d'anormal à l'œil nu"+(it?' : '+it:'')+' ; la valise de diagnostic le dira.';
 return `usure ${u} % — `+(u>=SEUIL?(u>=90?"hors d'usage. ":'à remplacer. ')+(it||p.usTxt):(u<35?'bon état.':u<60?'usure correcte.':'à surveiller.')+(it?' '+it:''));}
const codeTxt=(c,p)=>{const y=symDef(c);return y&&y.c===p.id&&y.cod&&y.cod.length?y.cod.join(' ; '):(p.code||'Défaut de signal.');};

/* ═══════════ Essai sur route ═══════════ */
let ess=null;
const pressF=()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'f',bubbles:true}));};
function essaiStart(c){
 if(ess) return;if(c.st.capot||c.st.lifted||c.st.av||c.st.ar||Object.keys(c.rem).length) return warn("La voiture doit être entièrement remontée (capot fermé, pont bas, roues posées).");
 const z=MW.zone(c.zone),r=RT[c.id],s=MW.S,pc=MW.playerCar();if(!z||!r) return;
 MW.closePanel();
 const out={x:-z.n.x,z:-z.n.z},ry=Math.atan2(out.x,out.z),orig={x:s.car.x,z:s.car.z,ry:s.car.ry};
 J().essai={car:c.id,orig};NG(c,'essai',null,0);
 s.car.x=z.door.x+out.x*9;s.car.z=z.door.z+out.z*9;s.car.ry=ry;
 pc.mesh.visible=false;
 ess={c,orig,t:0,in:false,tried:false,seen:{},peak:0,pt:0,run:0,m:0,lry:ry,lines:[]};
 MW.teleport(s.car.x+Math.cos(ry)*2.2,s.car.z-Math.sin(ry)*2.2,ry);
 MW.toast("Essai sur route : roulez quelques instants, puis arrêtez-vous et appuyez sur F pour redescendre.",'info');
 MW.hud('essai','<b>Essai sur route</b><br>Écoutez la voiture : accélérez, freinez, prenez un virage.');
 setTimeout(pressF,60);}
/* ce qu'on ressent dans une situation de l'essai : le texte propre au symptôme pour le coupable, le texte général pour les pièces très usées */
function clueTxt(c,cat){
 const y=symDef(c),l=[];
 for(const p of PLIST){const pr=c.parts[p.id];if(!pr||pr.na||c.done[p.id]) continue;
  if(y&&y.c===p.id&&y.ess){if(y.ess[cat]) l.push(y.ess[cat]);continue;}
  if(p.ess===cat&&pr.u>=70&&p.essTxt) l.push(p.essTxt);}
 return l;}
function essaiClue(cat){
 if(!ess||ess.seen[cat]) return;ess.seen[cat]=1;const c=ess.c,l=clueTxt(c,cat);
 if(l.length){const t=ESS_NOM[cat]+' : '+l.join(' ');if(!c.clues.includes(t)) c.clues.push(t);ess.lines.push(t);MW.toast(t,'warn');}}
function essaiTick(dt){
 const pl=MW.player(),pc=MW.playerCar(),s=MW.S;ess.t+=dt;
 if(!ess.in){
  if(pl.inCar){ess.in=true;ess.t=0;essaiClue('demarrage');essaiClue('ralenti');}
  else if(ess.t>1.5&&!ess.tried){ess.tried=true;pressF();}
  else if(ess.t>4) essaiEnd(true);
  syncEss();return;}
 if(!pl.inCar){essaiEnd(false);return;}
 const v=Math.abs(pc.speed);ess.m+=v*dt;
 if(v>3&&ess.t<25) essaiClue('froid');
 if(v>10) essaiClue('accel');
 if(v>12){ess.fast=(ess.fast||0)+dt;if(ess.fast>3) essaiClue('vitesse');}else ess.fast=0;
 if(ess.t>22&&v>3) essaiClue('chaud');
 if(v>6){ess.run+=dt;if(ess.run>4) essaiClue('bosses');}
 const dry=Math.abs(pc.ry-ess.lry)/Math.max(dt,.001);ess.lry=pc.ry;if(v>5&&dry>.45) essaiClue('virage');
 if(v>ess.peak){ess.peak=v;ess.pt=ess.t;}if(ess.peak>8&&v<ess.peak-6&&ess.t-ess.pt<4){essaiClue('frein');ess.peak=0;}
 if(ess.t-ess.pt>4) ess.peak=v;
 syncEss();}
function syncEss(){
 const r=RT[ess.c.id],s=MW.S,pm=MW.playerCar().mesh;if(!r) return;
 r.g.position.set(s.car.x,.22,s.car.z);r.g.rotation.y=s.car.ry;
 for(const n of ['wFL','wFR','wRL','wRR']){const a=pm.getObjectByName(n),b=r.g.getObjectByName(n);if(a&&b){b.rotation.x=a.rotation.x;b.rotation.y=a.rotation.y;}}}
function essaiEnd(abort){
 const e=ess;if(!e) return;ess=null;const c=e.c,s=MW.S,pc=MW.playerCar(),z=MW.zone(c.zone),p=z&&z.ponts[c.pont];
 Object.assign(s.car,e.orig);pc.mesh.visible=true;J().essai=null;MW.hud('essai','');
 const r=RT[c.id];if(r&&p){r.g.position.set(p.x,r.y,p.z);r.g.rotation.y=p.ry;for(const n of ['wFL','wFR','wRL','wRR']){const w=r.g.getObjectByName(n);if(w){w.rotation.x=0;w.rotation.y=0;}}}
 if(p&&!MW.player().inCar){const o=PTS[c.zone+':'+c.pont+':cabine'];MW.teleport(o?o.x:p.x,o?o.z:p.z,p.ry+PI/2);}
 if(abort){MW.toast("L'essai n'a pas pu démarrer : montez dans la voiture avec F.",'warn');return;}
 c.km=Math.round(c.km+e.m/1000);c.essai=1;c.comp.diagnostic=(c.comp.diagnostic||0)+(c.essaiXp?0:5);c.essaiXp=1;
 MW.emit('essai',c);
 setTimeout(()=>{if(!MW.paused) MW.panel('Essai terminé',`<p>${esc(voit(c))} · ${nf(Math.round(e.m))} m parcourus.</p>`+(e.lines.length?'<p><b>Ce que vous avez remarqué :</b></p><ul class="mw-ul">'+e.lines.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':'<p>Rien d\'anormal à signaler sur ce parcours. Essayez aussi de freiner franchement, de prendre un virage, de rouler quelques secondes à vitesse stable et de rouler assez longtemps pour que le moteur soit chaud.</p>')+(()=>{const rest=Object.keys(ESS_NOM).filter(k=>!e.seen[k]);return rest.length?'<p class="hint">Situations pas encore essayées : '+rest.map(k=>ESS_NOM[k].toLowerCase()).join(', ')+'.</p>':'';})()+'<div class="mw-btns"><button type="button" class="btn" data-mw="close">Retour à la voiture</button></div>');},200);}

/* noir : ce qu'un garage facturerait pour ces pièces (mêmes formules que evalJob) ; cout = pièces achetées au magasin */
function quote(ids,kind,taux,extraMin){
 let pieces=0,mo=extraMin||0,cout=0;
 for(const id of ids){const p=PARTS[id];if(!p) continue;pieces+=R2(p.prix*1.3*(KFAC[kind]||1));mo+=p.mo;cout+=p.prix;}
 const mainOeuvre=R2(mo/60*(taux||TAUX.garage1));return {pieces:R2(pieces),mo,mainOeuvre,facture:R2(pieces+mainOeuvre),cout:R2(cout)};}
/* ═══════════ Évaluation et rendu ═══════════ */
function blocage(c){
 const l=[];if(c.st.capot) l.push('le capot est ouvert');if(c.st.av||c.st.ar) l.push('des roues sont déposées');if(c.st.lifted) l.push('le pont est levé');
 const r=Object.keys(c.rem);if(r.length) l.push('une pièce est démontée ('+r.map(id=>pn(c,id).toLowerCase()).join(', ')+')');
 if(MG()) l.push(...MG().blocage(c));return l;}
function evalJob(c){
 const e=emp()||{},lines=[],comp={};let pieces=0,mo=0,hon=0;const need=[],extra=[],inut=[],vol=[];
 const F=(!c.noir&&c.fraud)||{},RE=c.reemp||{};
 for(const id in c.done){const p=PARTS[id],ord=c.ordre.includes(id),cul=c.symp&&c.symp.c===id,usee=c.parts[id].u0>=SEUIL;
  if(ord||cul) need.push(id);else if(usee) extra.push(id);else{if(RE[id]) vol.push(id);else inut.push(id);continue;}
  const base=R2(pprice(c,p)*1.3*c.fp),re=!!RE[id],ph=re?R2(base*.6):base,prix=re&&F.neuf?base:ph;
  lines.push({id,nom:pn(c,p)+(re&&!F.neuf?' (pièce de réemploi)':''),prix,mo:p.mo,extra:!(ord||cul),re});pieces+=prix;hon+=ph;mo+=p.mo;
  comp[p.comp]=(comp[p.comp]||0)+Math.round(p.mo*.35*(1+.25*(p.niv-1)));}
 const manque=c.ordre.filter(id=>!c.done[id]),nonResolu=!!(c.symp&&!c.done[c.symp.c]);
 let diag=0;if(c.symp&&!nonResolu){diag=15;mo+=15;comp.diagnostic=(comp.diagnostic||0)+c.symp.dn*15;}
 for(const k in c.comp) comp[k]=(comp[k]||0)+c.comp[k];
 const late=Math.max(0,openT()-c.promis),retard=Math.min(2,Math.floor(late/30)*.5);
 const rendMiss=c.rend&&!c.noir?Object.keys(c.done).filter(id=>invFind('usagee',id,c.id)<0):[];
 const sd=symDef(c),chain=sd&&sd.ch&&!nonResolu?sd.ch.filter(id=>!c.done[id]&&c.parts[id]&&!c.parts[id].na&&c.parts[id].u0>=SEUIL):[];
 let n=5-manque.length*1.5-Math.min(3,inut.length)-retard-Math.min(2,rendMiss.length)-Math.min(2,chain.length)-(MG()?MG().malus(c):0);if(nonResolu) n=1;
 if(c.caught) n=1; /* arnaque découverte au comptoir */
 const note=Math.round(clamp(n,1,5)),mult=note>=4?1:note===3?.8:.5;
 for(const k in comp) comp[k]=Math.round(comp[k]*mult*XP_K*(c.auto?.5:1)); /* travail automatique (js/55) : on apprend moins en regardant faire */

 let moF=0;if(!nonResolu) for(const id of (F.fant||[])) if(!c.done[id]&&PARTS[id]&&c.parts[id]&&!c.parts[id].na){const p=PARTS[id],prix=R2(pprice(c,p)*1.3*c.fp);lines.push({id,nom:pn(c,p),prix,mo:p.mo,fant:1});pieces+=prix;moF+=p.mo;}
 if(nonResolu){pieces=0;mo=0;hon=0;moF=0;lines.length=0;}
 const honMO=R2(mo/60*c.taux),mainOeuvre=R2((mo+moF)/60*c.taux*(F.mo&&!nonResolu?1.35:1)),facture=R2(pieces+mainOeuvre);
 const kinds=[];if(F.neuf&&lines.some(l=>l.re)) kinds.push('neuf');if(F.mo&&!nonResolu) kinds.push('mo');if(moF) kinds.push('fant');if(vol.length) kinds.push('vol');
 const fraude={kinds,gain:R2(facture-hon-honMO),vol};
 return {lines,pieces:R2(pieces),mainOeuvre,facture,note,comp,manque,nonResolu,inut,extra,need,retard,diag,rendMiss,chain,fraude,perte:R2(inut.reduce((a,id)=>a+pprice(c,PARTS[id]),0))};}
function payOf(job){
 if(typeof MWC!=='undefined'&&MWC&&typeof MWC.payFor==='function'){try{const v=MWC.payFor(job);if(typeof v==='number'&&isFinite(v)) return R2(Math.max(0,v));}catch(e){}}
 const e=emp()||{};return e.paie==='mois'?0:R2(job.mainOeuvre*.4);}
function done(c){
 if(typeof c==='string') c=carById(c);if(!c||!MW.S) return null;
 if(!c.noir&&typeof MWA!=='undefined') MWA.counter(c); /* le client relit la facture au comptoir */
 const e=c.noir?{id:'noir'}:(emp()||{}),ev=evalJob(c),s=MW.S,j=J();
 const job={id:c.id,client:c.client,voiture:voit(c),plaque:c.plaque,km:c.km,travaux:Object.keys(c.done),symptome:c.symp?c.symp.txt:null,facture:ev.facture,pieces:ev.pieces,mainOeuvre:ev.mainOeuvre,
  note:ev.note,competences:ev.comp,employeur:e.id||null,jour:s.day,zone:c.zone,heure:hm(s.min),resolu:!ev.nonResolu,cause:(symDef(c)&&!ev.nonResolu&&symDef(c).cause)||null};
 /* noir : paie convenue en liquide, sans facture d'employeur ni remboursement de pièces */
 if(c.noir){job.noir=true;job.facture=c.noir.prix||0;job.mainOeuvre=0;job.pieces=0;job.service=!!c.noir.service;}
 let pay=c.noir?(typeof MWN!=='undefined'&&MWN.payOf?MWN.payOf(c,ev):0):payOf(job);const tip=ev.note===5&&pay>0?Math.max(2,Math.round(pay*.1)):0;
 const refund=(c.noir||aSonCompte(e))?0:c.avance;job.avance=refund;job.pay=R2(pay+tip);job.pourboire=tip;
 const dr=R2((ev.note-3)*1.2);s.rep=clamp(R2((s.rep||0)+dr),0,100);job.rep=dr;
 for(const k in ev.comp) addXp(k,ev.comp[k]);
 const tot=R2(job.pay+refund);if(tot) MW.money(tot,c.noir?'Travail au noir (liquide) : '+voit(c):'Voiture rendue : '+voit(c));
 j.stats.rendues++;j.stats.note+=ev.note;j.stats.gain=R2(j.stats.gain+tot);
 j.hist.unshift({jour:s.day,client:c.client,voiture:voit(c),facture:ev.facture,pay:job.pay,note:ev.note});while(j.hist.length>15) j.hist.pop();
 if(c.rend&&!c.noir){let n=0;for(let i=inv().length-1;i>=0;i--) if(inv()[i].k==='usagee'&&inv()[i].job===c.id){inv().splice(i,1);n++;}if(n){job.rendues=n;invUI();}}
 if(!c.noir&&typeof MWA!=='undefined') MWA.after(c,job,ev);
 removeCar(c,true);j.next=Math.max(j.next,absT()+rint(4,10));hudJobs();
 MW.emit('jobDone',job,ev.note);return job;}

/* ═══════════ Panneaux ═══════════ */
function show(title,html,fn,o){
 const pb=document.getElementById('mwPb'),st=o&&o.keep&&pb?pb.scrollTop:0;
 MW.panel(title,html,{onClick:fn,wide:!!(o&&o.wide)});if(st){const q=document.getElementById('mwPb');if(q) q.scrollTop=st;}}
const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
const btn=(a,t,cls,dis)=>`<button type="button" class="btn sm${cls?' '+cls:''}" data-mw="${a}"${dis?' disabled':''}>${t}</button>`;
function rowHTML(c,p){
 const a=acces(c,p),u=c.parts[p.id].u,ord=c.ordre.includes(p.id);
 let tag='',info='',b='';
 if(ord) tag='<span class="mw-tag">Demandé</span>';
 if(c.done[p.id]){tag='<span class="mw-tag ok">Remplacé</span>';}
 else if(c.rem[p.id]){tag+='<span class="mw-tag warn">Démonté</span>';
  const neuf=invFind('neuve',p.id)>=0,have=neuf||reempFind(c,p.id)>=0;
  b=btn('pose:'+p.id,neuf||!have?'Monter la pièce neuve':'Monter la pièce d\'occasion','',!have)+btn('rem:'+p.id,"Remettre l'ancienne",'ghost');
  if(!have) info=`<small class="mw-need">Pièce neuve nécessaire (étagère ou magasin)${REEMP.includes(p.id)?', ou une pièce d\'occasion en bon état':''}.</small>`;}
 else if(!a.ok){info=`<small class="mw-lock">${esc(a.why)}</small>`;}
 else{if(!c.insp[p.id]) b+=btn('insp:'+p.id,'Inspecter','ghost');b+=btn('dep:'+p.id,'Démonter','');}
 if(c.insp[p.id]&&!c.done[p.id]){
  const it=(symDef(c)||{}).ins&&symDef(c).ins[p.id];
  if(p.hid) info+=`<small>${esc(c.vu?(u>=SEUIL?codeTxt(c,p):'Mesures normales à la valise.'):"Rien d'anormal à l'œil nu : seule la valise de diagnostic peut le dire.")}</small>`+(it?`<small>${esc(it)}</small>`:'');
  else info+=`<div class="mw-usure"><i style="width:${u}%" class="${u>=SEUIL?'r':u>=55?'o':'v'}"></i></div><small>${esc(inspLine(c,p.id).replace(/^usure/,'Usure'))}</small>`;}
 const need=[];if(p.niv>lv(p.comp)||!canDo(p.id,c)) need.push(`niveau ${p.niv} en ${SK_NOM[p.comp].toLowerCase()}`);if(!outilOK(p.outil,c)) need.push(OUTILS[p.outil].nom.toLowerCase());

 if(p.id==='huile'&&c.mdl&&typeof MWCARS!=='undefined'&&!c.done[p.id]) info+=`<small>Capacité du moteur : ${nf(MWCARS.oilL(c.mdl),2)} l (${esc(MWCARS.get(c.mdl).eng.visc)}).</small>`;
 return `<div class="mw-prt"><div class="mw-prt-h"><b>${esc(pn(c,p))}</b>${tag}</div>${info}${need.length?`<small class="mw-lock">Requis : ${esc(need.join(', '))}.</small>`:''}<div class="mw-btns">${b}</div></div>`;}
function stateChips(c){
 const t=(on,a,b)=>`<span class="mw-tag${on?' warn':''}">${on?a:b}</span>`;
 return `<div class="mw-chips">${t(c.st.capot,'Capot ouvert','Capot fermé')}${t(c.st.lifted,'Pont levé','Pont bas')}${t(c.st.av,'Roues AV déposées','Roues AV posées')}${t(c.st.ar,'Roues AR déposées','Roues AR posées')}</div>`;}
const PT_NOM={capot:'Capot',cabine:'Habitacle',dessous:'Dessous',FL:'Roue avant gauche',FR:'Roue avant droite',RL:'Roue arrière gauche',RR:'Roue arrière droite'};
function openPoint(cid,kind,keep){
 const c=carById(cid);if(!c){MW.closePanel();return;}
 const ax=kind[0]==='F'?'av':kind[0]==='R'?'ar':'';let h=`<p class="hint">${esc(c.client)} · ${esc(lbl(c))} · ${esc(c.plaque)} · ${nf(c.km)} km<br>Demande : ${esc(demande(c))}</p>${stateChips(c)}`;
 let ctl='';
 if(kind==='capot') ctl=btn('capot',c.st.capot?'Fermer le capot':'Ouvrir le capot');
 else if(ax) ctl=btn('pont',c.st.lifted?'Baisser le pont':'Lever le pont')+btn('roues',(c.st[ax]?'Reposer':'Déposer')+' les roues '+(ax==='av'?'avant':'arrière'));
 else if(kind==='dessous') ctl=btn('pont',c.st.lifted?'Baisser le pont':'Lever le pont');
 if(ctl) h+=`<div class="mw-btns">${ctl}</div>`;
 if(kind==='cabine'){
  h+=`<div class="mw-btns">${btn('valise','Valise de diagnostic','ghost')}${btn('essai','Essai sur route','ghost')}${btn('rendre','Rendre la voiture','')}</div>`;
  if(c.codes) h+=`<p><b>Valise :</b><br>${c.codes.map(esc).join('<br>')}</p>`;
  if(c.clues.length) h+=`<p><b>Indices relevés :</b><br>${c.clues.map(esc).join('<br>')}</p>`;}

 const l=(kind==='cabine'&&MG()&&MG().on(true))?[]:PLIST.filter(p=>!(c.parts[p.id]&&c.parts[p.id].na)).filter(p=>kind==='capot'?p.zone==='capot':kind==='dessous'?p.zone==='dessous':kind==='cabine'?p.zone==='cabine':(p.zone==='roue'&&(p.ax==='*'||p.ax===ax)));
 h+=l.map(p=>rowHTML(c,p)).join('');
 show(`${PT_NOM[kind]} · ${voit(c)}`,h,a=>pointAct(cid,kind,a),{keep});}
function pointAct(cid,kind,a){
 const c=carById(cid);if(!c) return;const ax=kind[0]==='F'?'av':kind[0]==='R'?'ar':'';const [k,id]=a.split(':');let r=true;
 if(k==='capot') r=togCapot(c);else if(k==='pont') r=togPont(c);else if(k==='roues') r=togRoues(c,ax);
 else if(k==='insp') r=doInspect(c,id);else if(k==='dep') r=doDep(c,id);else if(k==='pose') r=doPose(c,id);else if(k==='rem') r=doRem(c,id);
 else if(k==='valise') r=doValise(c);
 else if(k==='essai'){essaiStart(c);return;}
 else if(k==='rendre'){rendreUI(c);return;}
 hudJobs();openPoint(cid,kind,true);}
function rendreUI(c){
 const b=blocage(c);
 if(b.length){show('Rendre la voiture',`<p>Impossible de rendre la voiture : ${esc(b.join(' ; '))}.</p><div class="mw-btns"><button type="button" class="btn" data-mw="back">Retour</button></div>`,a=>{if(a==='back') openPoint(c.id,'cabine');});return;}
 const ev=evalJob(c);let h=`<p>${esc(c.client)} vient récupérer sa ${esc(voit(c))} (${esc(c.plaque)}).</p>`;
 if(c.noir) h+=`<p>${c.noir.service?'Service rendu à la voisine : pas de paiement.':'Prix convenu en liquide : <b>'+fmt(c.noir.prix||0)+'</b> (sans facture).'}</p>`; /* noir */
 else if(ev.lines.length) h+=`<table class="mw-fac"><tbody>${ev.lines.map(l=>`<tr><td>${esc(l.nom)}${l.extra?' <small>(en plus)</small>':''}${l.fant?' <small class="mw-fr">(non changé)</small>':''}</td><td>${fmt(l.prix)}</td></tr>`).join('')}<tr><td>Main-d'œuvre (${nf(ev.mainOeuvre/c.taux*60)} min)${c.fraud&&c.fraud.mo?' <small class="mw-fr">(gonflée)</small>':''}</td><td>${fmt(ev.mainOeuvre)}</td></tr><tr class="t"><td>Total</td><td>${fmt(ev.facture)}</td></tr></tbody></table>`;
 if(!c.noir&&!ev.nonResolu&&typeof MWA!=='undefined') h+=MWA.invoiceHTML(c,ev);
 const w=[];if(ev.nonResolu) w.push('La panne signalée n\'est pas réparée : le client ne paiera rien et sera très mécontent.');
 if(ev.manque.length) w.push('Travaux demandés non faits : '+ev.manque.map(id=>pn(c,id).toLowerCase()).join(', ')+'.');
 if(ev.inut.length) w.push('Pièces remplacées pour rien (non facturées) : '+ev.inut.map(id=>pn(c,id).toLowerCase()).join(', ')+'.');
 if(ev.chain&&ev.chain.length) w.push('Dégâts causés par la panne laissés en l\'état : '+ev.chain.map(id=>pn(c,id).toLowerCase()).join(', ')+'. Le client risque de revenir très vite.');
 if(ev.retard) w.push('Voiture rendue en retard.');
 if(ev.rendMiss&&ev.rendMiss.length) w.push('Le client voulait récupérer ses anciennes pièces, il en manque : '+ev.rendMiss.map(id=>pn(c,id).toLowerCase()).join(', ')+'.');
 else if(c.rend&&!c.noir) h+='<p class="hint">Vous lui rendez aussi ses anciennes pièces, comme il l\'a demandé.</p>';
 if(MG()&&MG().malus(c)) w.push(MG().malusTxt(c));
 if(w.length) h+=`<p class="mw-soon">${w.map(esc).join('<br>')}</p>`;
 h+=`<div class="mw-btns"><button type="button" class="btn" data-mw="ok">Rendre les clés</button><button type="button" class="btn ghost" data-mw="back">Retour</button></div>`;
 show('Rendre la voiture',h,a=>{
  if(a==='back'){openPoint(c.id,'cabine');return;}
  if(a.startsWith('fr:')&&typeof MWA!=='undefined'){MWA.toggle(c,a.slice(3));rendreUI(c);return;}
  if(a==='ok'){const job=done(c);if(!job) return;
   const cp=Object.keys(job.competences).filter(k=>job.competences[k]>0).map(k=>`${SK_NOM[k]} +${job.competences[k]}`).join(', ');
   show('Voiture rendue',`<p class="mw-note">${stars(job.note)}</p><p>${esc(job.client)} ${job.note>=4?'est ravi(e) !':job.note===3?'repart satisfait(e).':'n\'est pas content(e).'}</p><p>${job.noir?'Prix convenu':'Facture'} : <b>${fmt(job.facture)}</b> · ${job.noir?'en liquide pour vous':'votre paie'} : <b>${fmt(job.pay)}</b>${job.pourboire?' (pourboire compris)':''}${job.avance?' · pièces avancées remboursées : '+fmt(job.avance):''}</p>${job.cause?`<p><b>Cause de la panne :</b> ${esc(job.cause)}</p>`:''}<p>Réputation ${job.rep>=0?'+':'−'}${nf(Math.abs(job.rep),1)}${cp?' · expérience : '+esc(cp):''}</p><div class="mw-btns"><button type="button" class="btn" data-mw="close">Continuer</button></div>`,()=>{});}});}

/* ── étagère, établi, magasin, ferraille ── */
const STOCK1=['huile','filtre_huile','filtre_air','filtre_hab','essuie','ampoules','pneus','batterie','plaq_av','plaq_ar','liquide_frein','bougies','courroie_acc'];
const stockOf=e=>aSonCompte(e)?[]:(e.zone==='garage1'?STOCK1:PLIST.map(p=>p.id));
function etagere(zid){
 const e=emp();if(!e||e.zone!==zid) return MW.toast("Ce n'est pas l'étagère de votre atelier.",'info');
 const st=stockOf(e);
 let h=`<p class="hint">Réserve de ${esc(e.nom||'votre atelier')} : les pièces sont fournies par l'atelier. Emportez seulement ce qu'il faut (${inv().length}/${INV_MAX} places).</p>`;
 if(!st.length) h+='<p class="mw-soon">À votre compte, vous achetez vos pièces chez Pièces Auto Express.</p>';
 h+=st.map(id=>{const p=PARTS[id],n=inv().filter(it=>it.k==='neuve'&&it.id===id).length;
  return `<div class="mw-prt"><div class="mw-prt-h"><b>${esc(p.nom)}</b>${n?`<span class="mw-tag ok">${n} en main</span>`:''}</div><small>${esc(SK_NOM[p.comp])} niv. ${p.niv} · ${p.mo} min</small><div class="mw-btns">${btn('take:'+id,'Prendre')}</div></div>`;}).join('');
 const besoin=[];for(const c of J().cars) if(c.zone===zid&&!c.noir) for(const id of c.ordre) if(!c.done[id]&&c.parts[id]&&!c.parts[id].na&&st.includes(id)&&!besoin.includes(id)&&invFind('neuve',id)<0) besoin.push(id);
 if(besoin.length) h=`<div class="mw-btns">${btn('need','Prendre les pièces des ordres en cours ('+besoin.map(id=>PARTS[id].nom).join(', ')+')')}</div>`+h;
 const nm=inv().filter(it=>it.k==='neuve'&&it.src==='etagere').length;
 if(nm) h+=`<div class="mw-btns">${btn('putall','Rapporter mes pièces neuves non achetées','ghost')}</div>`;
 const fn=(a,keep)=>{const [k,id]=a.split(':');
  if(k==='take'){if(inv().length>=INV_MAX) MW.toast('Inventaire plein.','warn');else{invAdd({k:'neuve',id,src:'etagere'});MW.toast(PARTS[id].nom+' : pris(e) à l\'étagère.','info');}}
  else if(k==='need'){let n=0;for(const id of besoin){if(inv().length>=INV_MAX){MW.toast('Inventaire plein.','warn');break;}invAdd({k:'neuve',id,src:'etagere'});n++;}if(n) MW.toast(`${n} pièce(s) prise(s) à l'étagère.`,'good');}
  else if(k==='putall'){for(let i=inv().length-1;i>=0;i--) if(inv()[i].k==='neuve'&&inv()[i].src==='etagere') inv().splice(i,1);invUI();}
  etagere(zid);};
 show('Étagère de pièces',h,fn,{keep:true,wide:true});}
function etabli(zid){
 const e=emp(),has=Object.keys(J().outils).filter(k=>J().outils[k]),prov=e&&e.zone!=='garage1'&&!aSonCompte(e);
 const nu=inv().filter(it=>it.k==='usagee'&&!rendBloq(it)).length;
 let h=`<p>Établi de ${esc(MW.zone(zid).nom)}.</p><p><b>Votre caisse à outils :</b><br>${has.map(k=>esc(OUTILS[k].nom)).join('<br>')}${prov?'<br><span class="hint">L\'atelier fournit aussi la clé dynamométrique et la valise de diagnostic.</span>':''}</p>`;
 h+=`<div class="mw-btns">${btn('outils','Outils : prendre ou ranger')}${btn('bac','Jeter les pièces usagées au bac ('+nu+')','ghost',!nu)}${btn('carnet','Ouvrir le carnet','ghost')}</div>`;
 if(typeof MWO!=='undefined') h+=MWO.etabliHTML();
 show('Établi',h,a=>{if(a==='bac'){for(let i=inv().length-1;i>=0;i--) if(inv()[i].k==='usagee'&&!rendBloq(inv()[i])) inv().splice(i,1);invUI();MW.toast('Pièces usagées jetées.','info');etabli(zid);}else if(a==='carnet') carnet();else if(a==='outils') servante(zid);else if(a.startsWith('occ:')&&typeof MWO!=='undefined'){MWO.act(a.slice(4));if(MW.S) etabli(zid);}},{keep:true,wide:true});}
let shopTab='pieces';
const scrapV=it=>typeof MWO!=='undefined'?MWO.scrap(it):Math.max(1,Math.round(PARTS[it.id].prix*.12));
const rendBloq=it=>!!(it.rend&&J().cars.some(c=>c.id===it.job));
function shop(keep){
 const money=MW.S.money;let h=`<div class="mw-btns">${btn('tab:pieces','Pièces',shopTab==='pieces'?'':'ghost')}${btn('tab:outils','Outils',shopTab==='outils'?'':'ghost')}${btn('tab:ferraille','Ferraille',shopTab==='ferraille'?'':'ghost')}${typeof MWN!=='undefined'&&MWN.shopHTML?btn('tab:noir','Matériel du noir',shopTab==='noir'?'':'ghost'):''}</div><p class="hint">Vous avez ${fmt(money)} · inventaire ${inv().length}/${INV_MAX}. Pièces avancées pour un client : remboursées à la facture.</p>`;
 if(shopTab==='pieces') h+=PLIST.map(p=>`<div class="mw-prt"><div class="mw-prt-h"><b>${esc(p.nom)}</b><span class="mw-tag">${fmt(p.prix)}</span></div><small>${esc(SK_NOM[p.comp])} niv. ${p.niv}</small><div class="mw-btns">${btn('buy:'+p.id,'Acheter','',money<p.prix)}</div></div>`).join('');
 else if(shopTab==='outils') h+=Object.keys(OUTILS).filter(k=>OUTILS[k].prix).map(k=>{const o=OUTILS[k],has=J().outils[k];return `<div class="mw-prt"><div class="mw-prt-h"><b>${esc(o.nom)}</b><span class="mw-tag${has?' ok':''}">${has?'Acheté':fmt(o.prix)}</span></div><small>${k==='cle_dyn'?'Pour la distribution, les amortisseurs et l\'embrayage.':'Pour lire les codes défaut (électricité niveau 2).'}</small><div class="mw-btns">${btn('tool:'+k,'Acheter','',!!has||money<o.prix)}</div></div>`;}).join('');
 else if(shopTab==='noir'&&typeof MWN!=='undefined') h+=MWN.shopHTML(); /* noir */
 else{const us=inv().map((it,i)=>({it,i})).filter(x=>x.it.k==='usagee');
  const ok=us.filter(x=>!rendBloq(x.it));h+=`<p class="hint">Ferraille au poids, consigne des pièces d'échange standard, plomb des batteries. Huile, filtres en papier et pneus partent au recyclage sans rien rapporter. Pour mieux vendre une pièce encore bonne : mettez-la en vente d'occasion depuis l'établi.</p>`;
  h+=us.length?us.map(x=>{const bl=rendBloq(x.it);return `<div class="mw-prt"><div class="mw-prt-h"><b>${esc(PARTS[x.it.id].nom)}</b><span class="mw-tag${bl?' warn':''}">${bl?'À rendre au client':fmt(scrapV(x.it))}</span></div>${typeof MWO!=='undefined'?`<small>${esc(MWO.scrapLbl(x.it))}</small>`:''}<div class="mw-btns">${btn('sell:'+x.i,scrapV(x.it)?'Vendre à la ferraille':'Déposer au recyclage','',bl)}</div></div>`;}).join('')+`<div class="mw-btns">${btn('sellall','Tout vendre ('+fmt(ok.reduce((a,x)=>a+scrapV(x.it),0))+')','',!ok.length)}</div>`:'<p>Aucune pièce usagée à revendre. Les pièces déposées sur les voitures finissent ici.</p>';}
 show('Pièces Auto Express',h,a=>{const [k,id]=a.split(':');
  if(k==='tab'){shopTab=id;}
  else if(k==='noir'&&typeof MWN!=='undefined'){MWN.shopAct(id);}
  else if(k==='buy'){const p=PARTS[id];if(inv().length>=INV_MAX) MW.toast('Inventaire plein.','warn');else if(MW.S.money<p.prix) MW.toast("Pas assez d'argent.",'warn');else{invAdd({k:'neuve',id,src:'achat',paye:p.prix});MW.money(-p.prix,p.nom);}}
  else if(k==='tool'){const o=OUTILS[id];if(MW.S.money>=o.prix&&!J().outils[id]){J().outils[id]=1;MW.money(-o.prix,o.nom);}else MW.toast("Pas assez d'argent.",'warn');}
  else if(k==='sell'){const i=+id,it=inv()[i];if(it&&it.k==='usagee'&&!rendBloq(it)){const v=scrapV(it);invDel(i);if(v) MW.money(v,'Ferraille : '+PARTS[it.id].nom);else MW.toast(PARTS[it.id].nom+' : déposé(e) au recyclage.','info');}}
  else if(k==='sellall'){let t=0;for(let i=inv().length-1;i>=0;i--) if(inv()[i].k==='usagee'&&!rendBloq(inv()[i])){t+=scrapV(inv()[i]);inv().splice(i,1);}invUI();if(t) MW.money(t,'Ferraille');}
  shop(true);},{keep:true,wide:true});}
function itemPanel(i){
 const it=inv()[i];if(!it) return;
 if(isTool(it)){show(itNom(it),`<p>Outil de l'atelier, sur vous (touche ${SLOTK[i]||'—'} pour le prendre en main).</p><p class="hint">Rangez-le à la servante ou à l'établi quand vous n'en avez plus besoin : il libère une place.</p><div class="mw-btns"><button type="button" class="btn" data-mw="close">Fermer</button></div>`,()=>{});return;}
 const p=PARTS[it.id];
 const d=it.k==='neuve'?`Pièce neuve${it.src==='achat'?' achetée ('+fmt(it.paye||0)+')':' prise à l\'étagère de l\'atelier'}.`:`Pièce usagée${it.ren?' remise en état':''} déposée${it.car?' sur une '+it.car:''} (usure ${it.u} %).${rendBloq(it)?' Le client veut la récupérer : gardez-la jusqu\'au rendu de sa voiture.':''}${typeof MWO!=='undefined'?' '+MWO.valTxt(it):''}`;
 show(p.nom,`<p>${esc(d)}</p><p class="hint">${esc(SK_NOM[p.comp])} niveau ${p.niv} · ${p.mo} min de main-d'œuvre. Elle se monte depuis la voiture concernée.</p><div class="mw-btns">${btn('jeter','Jeter','ghost')}<button type="button" class="btn" data-mw="close">Fermer</button></div>`,a=>{if(a==='jeter'){invDel(i);MW.closePanel();}});}

/* ── carnet ── */
function carnet(){
 const j=J(),s=MW.S,e=emp();
 let h=`<h3 class="mw-h3">Ordres en cours</h3>`;
 if(!j.cars.length) h+=`<p>${e?'Aucun client pour le moment. Les voitures arrivent de 8 h à 19 h.':'Vous n\'êtes employé nulle part : pas de clients.'}</p>`;
 for(const c of j.cars){const pr=c.ordre.length?c.ordre.filter(id=>c.done[id]).length+'/'+c.ordre.length:(c.symp&&c.done[c.symp.c]?'réparé':'à diagnostiquer'),late=openT()>c.promis;
  h+=`<div class="mw-prt"><div class="mw-prt-h"><b>${c.noir?'Cour (noir)':'Pont '+(c.pont+1)} · ${esc(voit(c))}</b><span class="mw-tag${late?' warn':''}">${esc(pr)}</span></div><small>${esc(c.client)} · ${esc(c.plaque)} · ${esc(c.an?c.an+' · ':'')}${nf(c.km)} km</small><div>${esc(demande(c))}</div>${c.rend&&!c.noir?'<small>Le client veut récupérer ses anciennes pièces.</small>':''}${c.codes?`<small>Valise : ${c.codes.map(esc).join(' ; ')}</small>`:''}${c.clues.length?`<small>Indices : ${c.clues.map(esc).join(' ')}</small>`:''}<small>${late?'En retard sur la promesse faite au client.':'Promis dans environ '+nf(Math.max(0,c.promis-openT()))+' min de travail.'}</small></div>`;}
 h+=`<h3 class="mw-h3">Inventaire (${inv().length}/${INV_MAX})</h3>`;
 h+=inv().length?`<div class="mw-chips">${inv().map((it,i)=>`<button type="button" class="mw-tag ${it.k==='neuve'?'ok':isTool(it)?'':'warn'}" data-mw="item:${i}">${esc(itNom(it))} (${it.k==='neuve'?'neuf':isTool(it)?'outil':'usagé'})</button>`).join('')}</div>`:'<p>Vide.</p>';
 h+=`<h3 class="mw-h3">Outils</h3><p>${Object.keys(j.outils).filter(k=>j.outils[k]).map(k=>esc(OUTILS[k].nom)).join(' · ')}</p>`;
 h+=`<h3 class="mw-h3">Expérience</h3><div class="mw-chips">${SKILLS.map(k=>`<span class="mw-tag">${SK_NOM[k]} ${lv(k)}</span>`).join('')}</div>`;
 h+=`<h3 class="mw-h3">Bilan</h3><p>${j.stats.rendues} voiture(s) rendue(s)${j.stats.rendues?' · note moyenne '+nf(j.stats.note/j.stats.rendues,1)+' / 5':''} · réputation ${nf(s.rep||0,1)} / 100 · gains ${fmt(j.stats.gain)}</p>`;
 if(typeof MWO!=='undefined') h+=MWO.carnetHTML();
 if(typeof MWA!=='undefined') h+=MWA.carnetHTML();
 if(typeof MWN!=='undefined'&&MWN.carnetHTML) h+=MWN.carnetHTML(); /* noir : section « Travail au noir » */
 if(j.hist.length) h+=`<small>${j.hist.slice(0,5).map(x=>`Jour ${x.jour} : ${esc(x.voiture)} · ${stars(x.note)} · ${fmt(x.pay)}`).join('<br>')}</small>`;
 show('Carnet',h,a=>{const [k,id]=a.split(':');if(k==='item') itemPanel(+id);else if(k==='noir'&&typeof MWN!=='undefined') MWN.act(id);},{wide:true});}

/* ═══════════ Barre d'inventaire et HUD ═══════════ */
function ensureBar(){
 const r=document.getElementById('mwRoot');if(!r) return null;let b=document.getElementById('mwInv');
 if(!b){b=document.createElement('div');b.id='mwInv';b.className='mw-inv';b.setAttribute('aria-label','Inventaire');r.appendChild(b);
  b.addEventListener('click',e=>{const s=e.target.closest('[data-i]');if(!s||MW.paused) return;const i=+s.dataset.i;if(inv()[i]&&inv()[i]===selIt) itemPanel(i);else take(i);});}
 return b;}
function invUI(){
 const b=ensureBar();if(!b||!MW.S) return;let h='';const a=inv();
 for(let i=0;i<INV_MAX;i++){const it=a[i];
  const kk=`<u>${SLOTK[i]}</u>`;
  if(it){const tl=isTool(it);h+=`<button type="button" class="mw-slot ${it.k}${it===selIt?' sel':''}" data-i="${i}" title="${esc(itNom(it)+(tl?'':it.k==='neuve'?' (neuf)':' (usagé)'))} · touche ${SLOTK[i]}">${kk}<b>${esc(itAb(it))}</b><i>${tl?'outil':it.k==='neuve'?'neuf':rendBloq(it)?'client':it.ren?'rénové':'usé'}</i></button>`;}
  else h+=`<span class="mw-slot vide">${kk}</span>`;}
 if(selIt&&inv().indexOf(selIt)<0){selIt=null;MW.emit('held',null);}
 b.innerHTML=h;
 const sk=typeof MWG!=='undefined'&&MWG.cur&&isTool(selIt)&&['cliquet','cle_dyn','boulonneuse'].includes(selIt.id)?' · douille de '+MWG.cur().sock+' (R pour changer)':'';
 MW.hud('main',selIt?`<b>En main</b> : ${esc(itNom(selIt))}${isTool(selIt)?'':selIt.k==='neuve'?' (neuve)':' (usagée)'}${sk} · V : mains libres`:'<b>Mains libres</b> · touches 1 à 0 : prendre un objet de l\'inventaire');}
function hudJobs(){
 if(!MW.S) return;const j=J(),e=emp();
 if(!e&&!j.cars.length){MW.hud('job','');return;}
 const fq=(j.file&&j.file.length)?(()=>{const w=j.file[0],att=w.ot!=null?openT()-w.ot:0,rest=Math.max(0,PATIENCE-att);
  return `<br>${j.file.length} client${j.file.length>1?'s':''} en attente à l'accueil · patience du premier : encore ${rest>=60?Math.floor(rest/60)+' h '+String(rest%60).padStart(2,'0'):rest+' min'}${MW.S.min>=OPEN1||MW.S.min<OPEN0?' (revient à l\'ouverture)':''}`;})():'';
 if(!j.cars.length){MW.hud('job','<b>Atelier</b> : aucun client pour l\'instant.'+fq);return;}
 const l=j.cars.slice(0,3).map(c=>{const pr=c.ordre.length?c.ordre.filter(id=>c.done[id]).length+'/'+c.ordre.length:(c.symp&&c.done[c.symp.c]?'réparé':'à diagnostiquer');
  return `${c.noir?'Cour':'Pont '+(c.pont+1)} · ${esc(voit(c))} : ${esc(c.symp?'diagnostic':c.nom)} (${pr})`;});
 MW.hud('job','<b>Ordres en cours</b><br>'+l.join('<br>')+fq);}

/* ═══════════ Interactions fixes (ponts, étagères, établis) ═══════════ */
const PTS={};
function regPoints(only){ /* noir : `only` = une zone sans pont élévateur (cour) dont les emplacements sont dans zone.ponts */
 for(const z of (only?[only]:MW.zones)){if(!only&&z.type!=='garage') continue;
  z.ponts.forEach((p,i)=>{
   for(const k of ['capot','cabine','dessous','FL','FR','RL','RR']){
    const id='mj:'+z.id+':'+i+':'+k,o=MW.addInteract({id,x:p.x,z:p.z,r:1.25,
     label:()=>{const c=carAt(z.id,i);return c?`${PT_NOM[k]} · ${voit(c)}`:'';},
     when:()=>{if(ess||MG()&&MG().on(true)) return false;const c=carAt(z.id,i);return !!c&&(k!=='dessous'||!!c.st.lifted);},
     use:()=>{const c=carAt(z.id,i);if(c) openPoint(c.id,k);}});
    PTS[z.id+':'+i+':'+k]=o;}});
  if(!z.etagere||only) continue;
  const e=z.etagere,n=z.n,et=z.etabli;
  MW.addInteract({id:'mj:etagere:'+z.id,x:e.x-n.x*1.1,z:e.z-n.z*1.1,r:2.2,label:'Étagère de pièces',when:()=>{const m=emp();return !!m&&m.zone===z.id;},use:()=>etagere(z.id)});
  MW.addInteract({id:'mj:etabli:'+z.id,x:et.x-n.x*1.1,z:et.z-n.z*1.1,r:2.2,label:'Établi · outils',when:()=>{const m=emp();return !!m&&m.zone===z.id;},use:()=>etabli(z.id)});}}

/* ═══════════ Cycle de vie ═══════════ */
const maxCars=()=>{const e=emp(),z=e&&MW.zone(e.zone),m=maxLv();return Math.min(z&&z.ponts?z.ponts.length:1,Math.max(NP(),m>=6?3:m>=3?2:1));};
const isGuest=()=>{const n=MW.net;return !!(n&&n.live&&n.guest);};
function onMinute(){
 if(!MW.S||!MW.S.jobs||isGuest()) return; /* [réseau] l'invité ne fait pas arriver ni partir les clients : c'est l'hôte */const j=J(),e=emp();
 for(const c of j.cars.slice()){
  if(c.noir) continue; /* noir : géré par MWN */
  if(!e||c.zone!==e.zone){removeCar(c,true);continue;}
  if(openT()-c.ot0>2200&&!(ess&&ess.c===c)){removeCar(c,true);MW.S.rep=clamp(R2((MW.S.rep||0)-2),0,100);MW.toast(`${c.client} a repris sa ${voit(c)} : trop d'attente. Votre réputation en souffre.`,'crit');}}
 hudJobs();
 const nb=()=>j.cars.filter(c=>!c.noir).length;
 /* file d'attente à l'accueil : les clients patientent, repartent si l'attente dure trop */
 if(j.file.length){
  for(const w of j.file.slice()){if(w.ot==null) w.ot=openT(); /* anciennes sauvegardes */
   const att=openT()-w.ot;
   if(att>PATIENCE){j.file.splice(j.file.indexOf(w),1);MW.S.rep=clamp(R2((MW.S.rep||0)-1),0,100);MW.toast(`${w.client} est reparti : trop d'attente à l'accueil.`,'warn');}
   else if(att>PATIENCE*.66&&!w.warn){w.warn=1;MW.toast(`${w.client} s'impatiente à l'accueil : libérez un pont rapidement.`,'warn');}}
  if(!e) j.file.length=0;
  else if(MW.S.min>=OPEN1&&j.file.length&&!j.fileNuit){j.fileNuit=1;MW.toast(`Fermeture : ${j.file.length>1?'les clients en attente laissent leurs clés, ils reviendront':'le client en attente laisse ses clés, il reviendra'} demain à l'ouverture.`,'info');}
  if(e&&MW.S.min>=OPEN0&&MW.S.min<OPEN1){j.fileNuit=0;if(nb()<maxCars()&&j.file.length){if(makeCar()) j.file.shift();}}}
 if(!e||MW.S.min<OPEN0||MW.S.min>=OPEN1||absT()<j.next) return;
 if(nb()>=maxCars()){ /* plus de place : le client s'installe en salle d'attente */
  if(j.file.length<FILE_MAX_N()){const w={t:absT(),ot:openT(),client:pick(CIV)+' '+pick(NOMS)};j.file.push(w);MW.toast(`${w.client} attend à l'accueil (${j.file.length} en attente).`,'info');}
  j.next=absT()+nextGap(e.zone);hudJobs();return;}
 if(makeCar()) j.next=absT()+nextGap(e.zone);}
function init(){
 const j=J();ensureBar();
 for(const id in RT){MW.scene.remove(RT[id].g);delete RT[id];}
 if(j.essai){Object.assign(MW.S.car,j.essai.orig);if(MW.player().inCar) MW.teleport(j.essai.orig.x,j.essai.orig.z,j.essai.orig.ry);j.essai=null;}
 ess=null;MW.playerCar().mesh.visible=true;
 for(const c of j.cars){for(const p of PLIST) if(!c.parts[p.id]) c.parts[p.id]={u:0,na:1}; /* anciennes sauvegardes : pièces nouvelles absentes */
  buildMesh(c);moveInteracts(c);}
 invUI();hudJobs();
 if(typeof MWC==='undefined') MW.setDoor('garage1',()=>MW.panel('Garage du Coin',`<p>Bienvenue au Garage du Coin. Les clients arrivent de 8 h à 19 h : approchez-vous d'une voiture sur un pont, inspectez-la, démontez la pièce usée, prenez la neuve à l'étagère, montez-la, puis rendez la voiture depuis l'habitacle.</p><div class="mw-btns"><button type="button" class="btn" data-mw="carnet">Ouvrir le carnet</button><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`,{onClick:a=>{if(a==='carnet') carnet();}}));
 if(!j.next||j.next<absT()-1500) j.next=0;}
MW.on('start',init);
/* Le bureau d'études (js/06 à 08) reste caché derrière le mode Mécanicien : tant que celui-ci est ouvert, on suspend son dessin 3D
   et son tableau de banc (DOM). Le calcul de chaleur, l'usure et le son de la boucle continuent comme avant. */
let engSave=null;
function engPause(){
 if(engSave||typeof engFrame!=='function'||typeof benchUpdate!=='function') return;
 engSave={f:engFrame,b:benchUpdate};engFrame=function(){};benchUpdate=function(){};}
function engResume(){
 if(!engSave) return;engFrame=engSave.f;benchUpdate=engSave.b;engSave=null;
 try{benchUpdate();if(typeof kickEngine==='function') kickEngine();}catch(e){}}
MW.on('open',()=>{ensureBar();if(MW.S&&MW.S.jobs) invUI();engPause();});
MW.on('close',()=>{engResume();if(ess) essaiEnd(true);});
MW.on('minute',onMinute);
MW.on('day',()=>{if(MW.S&&MW.S.jobs&&!isGuest()){const j=J();j.next=absT()+120+rint(0,10);}}); /* la file d'attente est gardée : ces clients reviennent à l'ouverture */
let fr=0;
MW.on('tick',dt=>{
 if(!MW.S||!MW.S.jobs) return;animate(dt);
 if(ess) essaiTick(dt);
 if(++fr%8===0){const b=document.getElementById('mwInv');if(b){const ic=MW.player().inCar||MW.paused;if(b.hidden!==ic) b.hidden=ic;}}});
MW.on('tab',carnet);
MW.addButton('carnet','Carnet (Tab)',()=>{if(MW.S) carnet();});
/* inventaire au clavier : 1…0, ) et = prennent en main l'objet (outil ou pièce) de l'emplacement 1 à 12 (touche par position : AZERTY ou QWERTY), X passe au suivant, V : mains libres */
MW.on('key',(k,e)=>{if(!MW.S) return;
 const m=e&&e.code&&/^(?:Digit|Numpad)(\d)$/.exec(e.code);
 if(m){const d=+m[1];take(d===0?9:d-1);return;}
 if(e&&e.code==='Minus'){take(10);return;}if(e&&e.code==='Equal'){take(11);return;}
 if(k==='x') takeNext(e&&e.shiftKey?-1:1);else if(k==='v'&&selIt){setHeld(null);}});
MW.setDoor('pieces',()=>{if(MW.S) shop();});
regPoints();

const api={rebuild:c=>{if(c){buildMesh(c);moveInteracts(c);}hudJobs();},mesh:c=>RT[c.id]?RT[c.id].g:null,rt:c=>RT[c.id]||null,openPoint,applyVisual,carById,
 L:{REEMP,reempFind,newFind,doInspect,doDep,doPose,doRem,togCapot,togPont,togRoues,gesteOK,canDo,outilOK,invFind,invDel,invAdd,acces,PT_NOM,sockOf:null},
 modelFor:(zid,need,symp)=>{const y=symp?SYMP.find(x=>x.id===symp.id)||symp:null;return modelFor(zid,(need||[]).concat(y?sympNeed(y):[]),y);},symDef,codesOf,clueTxt,inspLine,ESS_NOM,pn,lbl,PARTS,PARTS_LIST:PLIST,SKILLS,SK_NOM,OUTILS,INV_MAX,TPL,SYMP,skillOf,level:lv,done,jobs:()=>J().cars,spawn:makeCar,openCarnet:carnet,shop,inv,evalJob,
 state:()=>J(),take,takeNext,hold,holdTool,toolTake,toolPut,toolIdx,servante,TOOLS_INV,TOOLS_FOR,SLOTK,itNom,held:()=>selIt,hands:()=>setHeld(null),rendBloq,etabli,rendre:rendreUI,act:pointAct,acces,absT,openT,regPoints,remove:removeCar,invUI,noirData:{MODELS,COLS,NOMS,CIV,TAUX,KFAC,SYMP_LIST:SYMP},RYTHME,KMR,filePending:()=>J().file.length,quote,clear:()=>{for(const c of J().cars.slice()) removeCar(c,true);J().file=[];hudJobs();},meshY:c=>RT[c.id]?RT[c.id].g.position.y:null,point:(c,k)=>PTS[c.zone+':'+c.pont+':'+k]||null,shelf:zid=>{const z=MW.zone(zid);return {x:z.etagere.x-z.n.x*1.1,z:z.etagere.z-z.n.z*1.1};}};
window.__mwj=api;
return api;
})();
