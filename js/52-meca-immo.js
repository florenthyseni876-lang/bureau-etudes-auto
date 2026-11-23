'use strict';
/* ───────────── Mode « Mécanicien » — IMMOBILIER (maisons, garages et usines à acheter) ─────────────
   Les bâtiments eux-mêmes (zones loge1..4, garage5..7, usine1..2) sont déclarés dans js/40 (ZD) et dessinés par
   js/45b (logements, usines) et js/45c (intérieurs des garages). Ce fichier gère l'achat, le crédit, la revente,
   les charges hebdomadaires, les avantages et le panneau « Mes biens » (touche B).

   ═══ Objet global `MWI` (aussi `window.__mwi`) ═══
   MWI.CAT                 catalogue : [{id, kind:'logement'|'garage'|'usine', nom, prix, charges, …}]
   MWI.state()             MW.S.immo = {owned:{id:{mode:'achat'|'loc', since, paidTo, credit}}, stock:{id:[objets]}, cars:[voitures garées], hist:[]}
   MWI.owned(id)           vrai si le bien est à vous (acheté ou loué)
   MWI.buy(id, how)        how = 'cash' | 'credit' | 'rent' ; renvoie vrai si l'achat a eu lieu (conditions et argent vérifiés)
   MWI.sell(id)            revente (décote), ou résiliation du bail ; renvoie vrai si faite
   MWI.value(id)           valeur de revente ; MWI.weekly(id) charges ou loyer par semaine
   MWI.totals()            {valeur, charges, biens}
   MWI.parkFree()          places libres dans vos garages privés ; MWI.parkAdd(voiture) range une voiture
   MWI.panel()             ouvre « Mes biens » ; MWI.fiche(zone) ouvre la fiche d'un bien
   Charges : chaque semaine de jeu après l'achat, à l'événement 'day', via MW.money(). */
const MWI=(()=>{
const api={};
const fmt=x=>MW.fmt(x);
const COMP_NOM=()=>{const o={};try{for(const [k,n] of MWC.COMPS) o[k]=n;}catch(e){}return o;};

/* ═══ Catalogue ═══ */
const CAT=[
 {id:'loge1',kind:'logement',nom:'Maison de ville',prix:62000,charges:80,loyer:140,decote:.15,credit:300,req:{rep:10},
  reveil:420,stock:8,parking:1,prestige:0,repos:0,signU:-3.6,signY:1.9,signW:2.4,
  desc:'Une petite maison mitoyenne avec deux chambres et un coin pour ranger vos outils : bien plus calme que le studio.'},
 {id:'loge2',kind:'logement',nom:'Appartement du Centre',prix:98000,charges:140,loyer:230,decote:.15,credit:300,req:{rep:20,dipl:'cap'},
  reveil:405,stock:12,parking:1,prestige:1,repos:10,signU:-5.6,signY:2.0,signW:2.6,
  desc:'Un trois-pièces lumineux au troisième étage, avec balcon et une place de parking en sous-sol. Une adresse qui compte en ville.'},
 {id:'loge3',kind:'logement',nom:'Pavillon avec garage',prix:158000,charges:210,decote:.15,credit:300,req:{rep:30,dipl:'cap'},
  reveil:405,stock:20,parking:2,prestige:1,repos:20,signU:-4.6,signY:1.9,signW:2.6,
  desc:'Un pavillon avec jardin, un grand atelier et un garage double. Vous pouvez y garder vos anciennes voitures.'},
 {id:'loge4',kind:'logement',nom:'Villa des Hauts',prix:420000,charges:520,decote:.15,credit:300,req:{rep:45,dipl:'bts'},
  reveil:390,stock:36,parking:4,prestige:2,repos:40,signU:-7.4,signY:2.0,signW:3.0,
  desc:'Une villa de prestige avec colonnes, balcons et garage pour quatre voitures. Elle vous ouvre des portes dans le métier.'},
 {id:'garage5',kind:'garage',nom:'Atelier de la Rue Basse',prix:38000,charges:380,taux:70,ponts:2,decote:.2,credit:240,req:{rep:20,niv:{entretien:3}},
  clients:'Clientèle de quartier : citadines et petites berlines.',signU:-4.3,signY:2.2,signW:2.8,
  desc:'Un petit atelier de quartier avec deux ponts, un établi et une étagère. Peu de charges, une clientèle fidèle.'},
 {id:'garage6',kind:'garage',nom:'Garage Delmas et Fils',prix:125000,charges:850,taux:96,ponts:3,decote:.2,credit:240,req:{rep:35,dipl:'cap',niv:{moteur:4}},
  clients:'Clientèle familiale : berlines, SUV et utilitaires.',signU:-4.3,signY:2.2,signW:2.8,
  desc:'Un garage de mécanique générale avec trois ponts, bien placé sur la grande avenue. Le taux horaire est plus élevé.'},
 {id:'garage7',kind:'garage',nom:"Grand Garage de l'Esplanade",prix:360000,charges:1900,taux:125,ponts:4,decote:.2,credit:240,req:{rep:50,dipl:'bts',niv:{moteur:6,diagnostic:5}},
  clients:'Clientèle haut de gamme : berlines premium et SUV.',signU:-4.3,signY:2.4,signW:3.0,
  desc:'Un grand garage vitré avec quatre ponts, salon d’attente et clientèle exigeante. Les charges sont lourdes, les factures aussi.'},
 /* ateliers de préparation (js/58) : on peut d'abord s'y faire embaucher ; les racheter ouvre le tuning à son compte (banc de puissance, cabine de peinture) */
 {id:'tune1',kind:'garage',nom:'Prépa Vallon',prix:210000,charges:1300,taux:110,ponts:2,decote:.2,credit:240,req:{rep:45,dipl:'cap',niv:{moteur:5,preparation:4}},nosign:1,
  clients:'Clientèle de passionnés : sportives, compactes préparées et rallye.',signU:-4.3,signY:2.3,signW:2.8,
  desc:'Le préparateur sport et rallye de la Rue du Commerce : banc de puissance, deux ponts, atelier de reprogrammation. Vous gardez les commandes de tuning des clients.'},
 {id:'tune2',kind:'garage',nom:'Atelier Éclat',prix:150000,charges:1000,taux:98,ponts:2,decote:.2,credit:240,req:{rep:35,dipl:'cap',niv:{liaison:3,preparation:3}},nosign:1,
  clients:'Clientèle soucieuse de style : peinture, jantes, kits carrosserie.',signU:-4.3,signY:2.3,signW:2.8,
  desc:'L’atelier de style et de carrosserie : cabine de peinture, pont, stock de jantes. Peinture, covering et kits pour toutes les voitures.'},
 {id:'usine1',kind:'usine',nom:'Atelier de fabrication Marchand',prix:420000,charges:1600,fac:3,capital:10000,decote:.3,credit:360,req:{rep:45,dipl:'bts'},
  signU:9,signY:3.2,signW:3.4,
  desc:'Un atelier de fabrication équipé de machines-outils et d’une chaîne de montage. Vous y fondez votre propre marque avec une usine déjà bien équipée.'},
 {id:'usine2',kind:'usine',nom:'Grande usine du Vallon',prix:1800000,charges:6000,fac:4,capital:10000,decote:.3,credit:360,req:{rep:60,dipl:'ing'},
  signU:15,signY:3.4,signW:3.8,
  desc:'Une grande usine avec halls de production, cuves et cheminées. Votre marque y démarre au niveau d’un complexe industriel.'}];
const BY={};for(const p of CAT) BY[p.id]=p;
const KIND={logement:'Logement',garage:'Garage',usine:'Usine'};
api.CAT=CAT;

/* ═══ Clientèle des garages achetés (js/41 : modèles et taux horaires par zone) ═══ */
function clientele(){
 try{const D=window.__mwj&&window.__mwj.noirData;if(!D) return;const m=k=>D.MODELS[k]||[];
  D.MODELS.garage5=m('garage1');D.MODELS.garage6=m('garage2').concat(m('garage1'));D.MODELS.garage7=m('garage3').concat(m('garage2'));
  for(const p of CAT) if(p.kind==='garage') D.TAUX[p.id]=p.taux;}catch(e){console.error('MWI.clientele',e);}}
clientele();

/* ═══ État ═══ */
function I(){const s=MW.S;if(!s) return null;
 if(!s.immo||typeof s.immo!=='object') s.immo={};const o=s.immo;
 if(!o.owned||typeof o.owned!=='object') o.owned={};if(!o.stock||typeof o.stock!=='object') o.stock={};
 if(!Array.isArray(o.cars)) o.cars=[];if(!Array.isArray(o.hist)) o.hist=[];return o;}
api.state=I;
const own=id=>{const o=I();return o?o.owned[id]||null:null;};
api.owned=id=>!!own(id);
const value=id=>{const p=BY[id],w=own(id);return p&&w&&w.mode==='achat'?Math.round(p.prix*(1-p.decote)):0;};
const weekly=id=>{const p=BY[id],w=own(id);if(!p||!w) return 0;return w.mode==='loc'?p.loyer:p.charges;};
const STUDIO_STOCK=4; /* petit coffre du studio de départ (js/52a) */
const stockCap=id=>{if(id==='appart') return STUDIO_STOCK;const p=BY[id],w=own(id);return p&&w?(w.mode==='loc'?Math.floor(p.stock/2):p.stock):0;};
const parkCap=()=>{let n=0;for(const p of CAT){const w=own(p.id);if(p.kind==='logement'&&w&&w.mode==='achat') n+=p.parking||0;}return n;};
api.value=value;api.weekly=weekly;api.cap=id=>stockCap(id);
api.parkFree=()=>{const o=I();return o?Math.max(0,parkCap()-o.cars.length):0;};
/* indices (dans MWI.state().cars) des voitures garées dans le garage privé d'un logement acheté : les places se remplissent dans l'ordre du catalogue */
api.garageOf=id=>{const o=I();if(!o) return [];let k=0;
 for(const p of CAT){const w=own(p.id);if(p.kind!=='logement'||!w||w.mode!=='achat'||!p.parking) continue;
  if(p.id===id){const r=[];for(let i=0;i<p.parking;i++) r.push(k+i);return r;}k+=p.parking;}return [];};
/* prend la voiture garée n° i : la voiture actuelle prend sa place dans le garage */
api.takeCar=i=>{const o=I(),c=o&&o.cars[i];if(!c) return false;const now=MWC.getCar();
 o.cars[i]={id:now.id,nom:now.nom,kind:now.kind,color:now.color,model:now.model};MWC.setCar(c);MW.emit('immoChanged','cars');MW.save();return true;};
/* gare la voiture actuelle dans une place libre et reprend la voiture de départ (la « vieille ») */
api.parkCurrent=()=>{const cur=MWC.getCar();if(cur.id==='vieille'||api.parkFree()<=0) return false;
 const base=(MWC.CARS||[]).find(x=>x.id==='vieille');if(!base||!api.parkAdd(cur)) return false;MWC.setCar(base);MW.emit('immoChanged','cars');MW.save();return true;};
api.parkAdd=car=>{const o=I();if(!o||!car||api.parkFree()<=0) return false;o.cars.push({id:car.id,nom:car.nom,kind:car.kind,color:car.color,model:car.model});return true;};
api.totals=()=>{let v=0,c=0,n=0;for(const p of CAT) if(own(p.id)){v+=value(p.id);c+=weekly(p.id);n++;}return {valeur:v,charges:c,biens:n};};

/* ═══ Accès, achat, revente ═══ */
const reqOk=p=>{try{return MWC.req.ok(p.req);}catch(e){return true;}};
const reqHtml=p=>{try{return MWC.req.html(p.req);}catch(e){return '';}};
const apport=p=>Math.round(p.prix*.2);
const pret=p=>p.prix-apport(p);
const caution=p=>2*p.loyer;
function refreshWorld(){
 for(const p of CAT){const z=MW.zone(p.id);if(z) z.mapTag=own(p.id)?'À vous':'À vendre';}
 placeSigns();}
/* [société, js/57] un garage acheté appartient à une société (compte du garage, associés) : seul (100 %) ou à deux (parts selon les apports) */
const myNom=()=>{try{return MWNET.myName();}catch(e){return 'Vous';}};
const hasSoc=()=>typeof MWS!=='undefined';
function buyGarage(p,how){
 const s=MW.S,o=I(),ap=how==='cash'?p.prix:apport(p);
 if(s.money<ap){MW.toast(how==='cash'?"Pas assez d'argent.":"Pas assez d'argent pour l'apport.",'warn');return false;}
 MW.money(-ap,(how==='cash'?'Achat : ':'Apport (achat à crédit) : ')+p.nom);
 MWS.create(p.id,[{pid:MWS.pid(),nom:myNom(),apport:ap}],how==='credit'?{x:pret(p),n:p.credit}:null);
 o.owned[p.id]={mode:'achat',since:s.day,paidTo:s.day,credit:how==='credit',soc:1};
 MW.toast(`${p.nom} : bien acquis (société du garage créée, compte du garage à 0).`,'good');
 refreshWorld();MW.emit('immoChanged',p.id);MW.save();return true;}
/* achat à deux (hôte) : apports de l'hôte et de l'invité, le reste emprunté par la société */
api.buyCo=(id,aH,aG,gMoney)=>{
 const p=BY[id],o=I(),s=MW.S,pn=typeof MWNET!=='undefined'&&MWNET.live()?MWNET.partner():null;
 const no=t=>{MW.toast(t,'warn');try{MWNET.sendTo({t:'say',txt:t,g:'warn'});}catch(e){}return false;};
 if(!p||p.kind!=='garage'||!o||o.owned[id]||!pn||!hasSoc()) return false;
 aH=Math.round(+aH||0);aG=Math.round(+aG||0);
 if(!reqOk(p)) return no("L'hôte ne remplit pas encore les conditions pour ce garage.");
 if(aH<=0||aG<=0) return no('Chacun doit apporter une somme.');
 if(aH+aG>p.prix) return no('Les apports dépassent le prix du garage.');
 if(aH+aG<apport(p)) return no(`Les apports réunis doivent atteindre 20 % du prix (${fmt(apport(p))}).`);
 if(s.money<aH) return no("L'hôte n'a pas assez d'argent pour son apport.");
 if(!(gMoney>=aG)) return no("L'invité n'a pas assez d'argent pour son apport.");
 const loan=p.prix-aH-aG;
 MW.money(-aH,'Apport : '+p.nom);MWNET.sendTo({t:'pay',dx:-aG,motif:'Apport : '+p.nom});
 MWS.create(id,[{pid:MWS.pid(),nom:myNom(),apport:aH},{pid:pn.pid,nom:pn.name,apport:aG}],loan>0?{x:loan,n:p.credit}:null);
 o.owned[id]={mode:'achat',since:s.day,paidTo:s.day,credit:loan>0,soc:1};
 MW.toast(`${p.nom} acheté à deux avec ${pn.name} : vos parts suivent vos apports.`,'good');try{MWNET.sendTo({t:'say',txt:`${p.nom} est acheté à deux : voir le compte du garage.`,g:'good'});}catch(e){}
 refreshWorld();MW.emit('immoChanged',id);MW.save();return true;};
api.buy=(id,how)=>{
 const p=BY[id],o=I();if(!p||!o||o.owned[id]) return false;
 if(!reqOk(p)){MW.toast('Vous ne remplissez pas encore les conditions pour ce bien.','warn');return false;}
 if(p.kind==='garage'&&hasSoc()&&(how==='cash'||how==='credit')) return buyGarage(p,how);
 const s=MW.S;
 if(how==='rent'){
  if(!p.loyer||s.money<caution(p)){MW.toast("Pas assez d'argent pour la caution.",'warn');return false;}
  MW.money(-caution(p),'Caution : '+p.nom);o.owned[id]={mode:'loc',since:s.day,paidTo:s.day,credit:false};}
 else if(how==='credit'){
  if(s.money<apport(p)){MW.toast("Pas assez d'argent pour l'apport.",'warn');return false;}
  let ok=false;try{ok=MWC.takeLoan(pret(p),p.credit,true);}catch(e){ok=false;}
  if(!ok){MW.toast('La banque refuse le crédit.','warn');return false;}
  MW.money(-p.prix,'Achat à crédit : '+p.nom);o.owned[id]={mode:'achat',since:s.day,paidTo:s.day,credit:true};}
 else{
  if(s.money<p.prix){MW.toast("Pas assez d'argent.",'warn');return false;}
  MW.money(-p.prix,'Achat : '+p.nom);o.owned[id]={mode:'achat',since:s.day,paidTo:s.day,credit:false};}
 MW.toast(p.kind==='logement'?`${p.nom} est à vous.`:`${p.nom} : bien acquis.`,'good');
 refreshWorld();MW.emit('immoChanged',id);MW.save();return true;};
api.sell=id=>{
 const p=BY[id],o=I(),w=o&&o.owned[id];if(!p||!w) return false;
 if((o.stock[id]||[]).length){MW.toast('Videz d’abord le coffre de ce logement.','warn');return false;}
 if(p.kind==='logement'&&w.mode==='achat'){const left=parkCap()-p.parking;if(o.cars.length>Math.max(0,left)){MW.toast('Reprenez d’abord vos voitures garées ici.','warn');return false;}}
 if(p.kind==='garage'){try{if(MWC.employer().id==='proprio'&&MWC.employer().zone===id) MWC.stopWork();}catch(e){}}
 if(w.mode==='loc'){MW.money(caution(p),'Caution rendue : '+p.nom);}
 else if(p.kind==='garage'&&hasSoc()&&MWS.has(id)){MWS.dissoudre(id,value(id));MW.toast('Garage revendu : prêt soldé, le reste du compte est partagé selon les parts.','good');}
 else{MW.money(value(id),'Revente : '+p.nom);}
 delete o.owned[id];delete o.stock[id];
 refreshWorld();MW.emit('immoChanged',id);MW.save();return true;};

/* ═══ Charges hebdomadaires, prestige ═══ */
MW.on('day',d=>{
 const o=I();if(!o) return;let tot=0;const det=[];
 for(const id in o.owned){const p=BY[id],w=o.owned[id];if(!p){continue;}
  if(!(w.paidTo>0)) w.paidTo=d;
  while(d-w.paidTo>=7){w.paidTo+=7;const c=w.mode==='loc'?p.loyer:p.charges;
   if(p.kind==='garage'&&w.mode==='achat'&&hasSoc()&&MWS.ensure(id)) MWS.charge(id,c,'Charges du garage : '+p.nom); /* le garage paie ses charges sur son compte */
   else tot+=c;
   det.push([p.nom,c]);
   if(w.mode==='achat'&&p.prestige&&MW.S.rep<80) MW.S.rep=Math.min(80,Math.round((MW.S.rep+p.prestige)*100)/100);}}
 if(tot>0){MW.money(-tot,'Charges de vos biens');o.hist.push({day:d,total:tot,det});while(o.hist.length>8) o.hist.shift();
  if(MW.S.money<0) MW.toast('Votre compte est à découvert : les charges de vos biens pèsent lourd.','crit');}});

/* nom de la marque choisi au bureau d'études de l'usine (gardé avec la partie) */
api.brand=v=>{const o=I();if(!o) return '';if(typeof v==='string') o.brand=v.slice(0,30);return o.brand||'';};
/* fonde la marque dans l'usine `id` : l'usine devient le siège (niveau d'usine de départ `fac`) ; renvoie vrai si fondée */
api.found=(id,nom)=>{
 const p=BY[id],o=I();if(!p||p.kind!=='usine'||!o||!o.owned[id]) return false;
 nom=(nom&&nom.trim())||o.brand||'Automobiles Nouvelles';const keep=o.owned[id];
 try{if(MWC.foundOk(p.capital)&&MWU.inside()) MWU.leave();}catch(e){} /* on quitte la salle avant de partir : la partie est sauvegardée devant la porte */
 delete o.owned[id];let ok=false;
 try{ok=MWC.foundBrand(nom,{fac:p.fac,capital:p.capital,usine:{id,nom:p.nom}});}catch(e){console.error(e);}
 if(!ok) o.owned[id]=keep;else o.brand='';
 return ok;};

/* ═══ Panneaux ═══ */
const row=(a,b)=>`<div class="mw-row"><span>${a}</span><b>${b}</b></div>`;
const btn=(a,l,cls,dis)=>`<button type="button" class="btn${cls?' '+cls:''}" data-mw="${a}"${dis?' disabled':''}>${l}</button>`;
const hm=m=>{const h=Math.floor(m/60),mm=m%60;return h+' h'+(mm?String(mm).padStart(2,'0'):'');};
function perks(p,mode){
 const l=[];
 if(p.kind==='logement'){
  let inf=null;try{inf=MWL.info(p.id);}catch(e){}
  if(inf) l.push(`Intérieur à visiter : ${inf.surface} m², ${inf.pieces} pièces (lit, coffre, bureau${p.parking&&mode!=='loc'?', garage privé':''})`);
  l.push(`Meilleur repos : réveil à ${hm(p.reveil)} au lieu de 7 h 30`);
  if(p.repos) l.push(`Révisions de nuit : +${mode==='loc'?Math.floor(p.repos/2):p.repos} d’expérience par nuit (compétence la moins avancée)`);
  l.push(`Coffre personnel : ${mode==='loc'?Math.floor(p.stock/2):p.stock} places pour vos pièces et vos outils`);
  if(p.parking&&mode!=='loc') l.push(`Garage privé : ${p.parking} voiture${p.parking>1?'s':''} (gardez vos anciennes voitures)`);
  if(p.prestige&&mode!=='loc') l.push(`Prestige : +${p.prestige} de réputation par semaine (jusqu’à 80)`);}
 if(p.kind==='garage'){
  l.push(`${p.ponts} ponts élévateurs, un établi et une étagère de pièces`);
  l.push(`Taux horaire facturé : ${p.taux} € de l’heure`);
  l.push(p.clients);
  l.push('Vous travaillez à votre compte : vous encaissez les factures et payez vos pièces');}
 if(p.kind==='usine'){
  let nf='',cap=0;try{nf=FAC[p.fac][0];cap=FAC[p.fac][1];}catch(e){nf='niveau '+p.fac;}
  l.push(`Niveau d’usine de départ : ${p.fac} (${nf}), capacité ${cap.toLocaleString('fr-FR')} voitures par an`);
  l.push('Visitable : chaîne d’assemblage, bureau d’études, stock de pièces, expédition');
  l.push('Charges : '+fmt(p.charges)+' par semaine tant que vous restez mécanicien');
  l.push('Apport personnel exigé réduit à '+fmt(p.capital)+' : le bâtiment fait partie de votre capital');
  l.push('Conditions de fondation : réputation et poste (voir ci-dessous)');}
 return l;}
function sheet(p,z,w){
 const o=I(),mode=w?w.mode:null;
 let h=`<p>${esc(p.desc)}</p>`;
 if(p.kind==='logement'){let src='',inf=null;try{src=MWL.plan(p.id,440);inf=MWL.info(p.id);}catch(e){}
  if(src) h+=`<figure class="mw-plan" style="margin:.2rem 0 .7rem;text-align:center"><img src="${src}" alt="Plan du logement ${esc(p.nom)}" style="width:100%;max-width:440px;border-radius:8px;border:1px solid rgba(128,128,128,.35)"><figcaption><small>Plan des pièces${inf?' · '+inf.surface+' m² · '+inf.pieces+' pièces':''} · la porte d’entrée est en haut (trait bleu)</small></figcaption></figure>`;}
 h+='<div class="mw-card">';
 if(w){
  h+=row('Statut',w.mode==='loc'?'Loué':'Propriétaire')+(w.mode==='achat'?row('Valeur de revente',esc(fmt(value(p.id)))):row('Caution versée',esc(fmt(caution(p)))))+row(w.mode==='loc'?'Loyer par semaine':'Charges par semaine',esc(fmt(weekly(p.id))))+(w.credit?row('Achat','à crédit (voir la banque)'):'');}
 else{
  h+=row('Prix',esc(fmt(p.prix)))+(p.kind==='logement'&&p.id?(()=>{try{const i=MWL.info(p.id);return row('Surface',i.surface+' m² · '+i.pieces+' pièces');}catch(e){return '';}})():'')+row('Charges par semaine',esc(fmt(p.charges)))+(p.loyer?row('Ou louer : loyer par semaine',esc(fmt(p.loyer))):'')+row('Revente','−'+Math.round(p.decote*100)+' %');}
 h+='</div><ul class="mw-cond">'+perks(p,mode).map(t=>`<li class="ok">✓ ${esc(t)}</li>`).join('')+'</ul>';
 return h;}
function fiche(z){
 const p=BY[z.id];if(!p) return;
 const w=own(p.id);
 if(!w&&hasSoc()&&MWS.mine(p.id)) return MWS.panel(p.id); /* associé d'un garage acheté par l'hôte */
 if(!w) return offer(p,z);
 return mine(p,z,w);}
api.fiche=fiche;
function offer(p,z){
 const s=MW.S,ok=reqOk(p);
 let h=sheet(p,z,null);
 h+='<h3 class="mw-h3">Conditions</h3>'+reqHtml(p);
 if(!ok) h+='<p class="mw-soon">Vous ne remplissez pas encore toutes les conditions. Avancez dans votre carrière puis revenez.</p>';
 else if(s.money<apport(p)) h+=`<p class="hint">Il vous faut au moins ${esc(fmt(apport(p)))} pour l’apport d’un achat à crédit.</p>`;
 h+=`<p class="hint">Crédit : apport de 20 % (${esc(fmt(apport(p)))}), le reste (${esc(fmt(pret(p)))}) prêté par la banque sur ${p.credit} jours, remboursé chaque jour comme vos autres prêts.</p>`;
 h+=`<div class="mw-btns">${btn('cash','Acheter comptant ('+esc(fmt(p.prix))+')','',!ok||s.money<p.prix)}${btn('credit','Acheter à crédit (apport '+esc(fmt(apport(p)))+')','',!ok||s.money<apport(p))}${p.loyer?btn('rent','Louer ('+esc(fmt(p.loyer))+' par semaine)','',!ok||s.money<caution(p)):''}${p.kind==='usine'?btn('visit','Visiter l’usine'):''}${p.kind==='garage'&&hasSoc()&&typeof MWNET!=='undefined'&&MWNET.live()?btn('duo','Acheter à deux…','',!ok):''}${btn('close','Fermer','ghost')}</div>`;
 MW.panel(z.nom+' · À vendre',h,{wide:true,onClick:a=>{
  if(a==='cash'||a==='credit'||a==='rent'){if(api.buy(p.id,a)){fiche(z);}}
  else if(a==='duo'){offer2(p,z);}
  else if(a==='visit'){MW.closePanel();try{MWU.enter(p.id);}catch(e){}}}});}
/* ── achat à deux : chacun propose son apport, l'autre accepte ── */
let off=null; /* proposition en cours : {id, a (apport de celui qui propose), money, mine (je suis celui qui propose)} */
function offer2(p,z){
 const s=MW.S,pn=MWNET.partner();
 MW.panel('Acheter à deux · '+p.nom,`<p>${esc(p.nom)} : ${esc(fmt(p.prix))}. Vous proposez votre apport à <b>${esc(pn.name)}</b>, qui répond par le sien. Le garage est acheté par une société commune : les parts suivent les apports, le reste du prix est emprunté (les apports réunis doivent faire au moins ${esc(fmt(apport(p)))}, soit 20 %).</p>
  <label class="mw-lab">Votre apport (vous avez ${esc(fmt(s.money))})<input id="mwA2" class="mw-in" type="number" min="1" step="100" value="${Math.min(Math.round(s.money),Math.round(p.prix/2))}"></label>
  <div class="mw-btns">${btn('send','Proposer à '+esc(pn.name))}${btn('close','Annuler','ghost')}</div>`,
  {onClick:a=>{if(a==='send'){const v=Math.round(+document.getElementById('mwA2').value||0);
   if(v<=0||v>s.money){MW.toast("Apport impossible : vous n'avez pas cette somme.",'warn');return;}
   off={id:p.id,a:v,money:s.money,mine:true};MWNET.sendSo({k:'offer',id:p.id,a:v,money:s.money,nom:myNom()});MW.closePanel();MW.toast(`Proposition envoyée à ${pn.name} : apport de ${fmt(v)}.`,'good');}}});}
function offerIn(m){ /* on reçoit une proposition : on répond par son apport */
 const p=BY[m.id],s=MW.S;if(!p) return;off={id:m.id,a:m.a,money:m.money,mine:false};
 MW.panel('Proposition d’achat à deux',`<p><b>${esc(m.nom||'Votre ami')}</b> propose d'acheter <b>${esc(p.nom)}</b> (${esc(fmt(p.prix))}) à deux, avec un apport de <b>${esc(fmt(m.a))}</b>. Quel est votre apport ? Le reste est emprunté ; les parts suivent les apports (au moins ${esc(fmt(apport(p)))} d'apports réunis).</p>
  <label class="mw-lab">Votre apport (vous avez ${esc(fmt(s.money))})<input id="mwA2" class="mw-in" type="number" min="1" step="100" value="${Math.max(1,Math.min(Math.round(s.money),Math.round(p.prix/2)))}"></label>
  <div class="mw-btns">${btn('ok','Accepter')}${btn('no','Refuser','ghost')}</div>`,
  {onClick:a=>{
   if(a==='no'){MWNET.sendSo({k:'offerno',id:m.id});off=null;MW.closePanel();return;}
   if(a==='ok'){const v=Math.round(+document.getElementById('mwA2').value||0);if(v<=0||v>s.money){MW.toast("Apport impossible : vous n'avez pas cette somme.",'warn');return;}
    MW.closePanel();
    if(MWNET.role()==='host'){api.buyCo(m.id,v,m.a,m.money);off=null;}
    else{MWNET.sendSo({k:'offerok',id:m.id,a:v,money:s.money});}}}});}
/* messages d'achat à deux venus de l'autre joueur (js/56) */
api.onSo=m=>{
 if(m.k==='offer') offerIn(m);
 else if(m.k==='offerno'){off=null;MW.toast("Votre ami refuse l'achat à deux.",'warn');}
 else if(m.k==='offerok'&&off&&off.mine&&off.id===m.id&&MWNET.role()==='host'){const a=off.a;off=null;api.buyCo(m.id,a,m.a,m.money);}};
function mine(p,z,w){
 const o=I(),s=MW.S;let h=sheet(p,z,w),btns='';
 if(p.kind==='logement'){
  const nuit=s.min>=1140||s.min<360;
  h+=nuit?'':'<p class="hint">Vous pourrez dormir ici à partir de 19 h.</p>';
  const pk=w.mode==='achat'?(o.cars.length+'/'+parkCap()):'aucun';
  h+=`<div class="mw-card">${row('Coffre',(o.stock[p.id]||[]).length+'/'+stockCap(p.id))}${p.parking&&w.mode==='achat'?row('Voitures garées (tous vos garages)',esc(pk)):''}</div>`;
  btns+=(typeof MWL!=='undefined'?btn('enter','Entrer chez moi'):'')+btn('sleep','Dormir (réveil à '+hm(p.reveil)+')','',!nuit)+btn('stock','Coffre : pièces et outils')+(w.mode==='achat'&&p.parking?btn('cars','Mes voitures'):'')+btn('save','Sauvegarder','ghost');}
 if(p.kind==='garage'){
  let e=null;try{e=MWC.employer();}catch(x){}
  const here=!!e&&e.id==='proprio'&&e.zone===p.id;
  if(here) h+='<p class="mw-soon">Vous travaillez ici à votre compte : les clients arrivent de 8 h à 19 h, approchez-vous d’un pont.</p>';
  else{h+='<p class="hint">Les clients ne viennent que si vous travaillez ici.'+(e&&e.id!=='aucun'?' Vous quitterez votre poste actuel : '+esc(e.nom)+'.':'')+'</p>';}
  btns+=here?btn('stopwork','Cesser de travailler ici','ghost'):btn('work','Travailler ici à mon compte');
  if(hasSoc()&&MWS.ensure(p.id)) btns+=btn('compte','Compte du garage');}
 if(p.kind==='usine'){
  let lines=[],okF=false;try{lines=MWC.foundLines(p.capital);okF=MWC.foundOk(p.capital);}catch(e){}
  h+='<h3 class="mw-h3">Fonder votre marque ici</h3><ul class="mw-cond">'+lines.map(x=>`<li class="${x.ok?'ok':'no'}">${x.ok?'✓':'✗'} ${esc(x.t)} <small>(${x.now})</small></li>`).join('')+'</ul>';
  if(okF) h+='<label class="mw-lab">Nom de votre marque<input id="mwBrand" class="mw-in" type="text" maxlength="30" value="'+esc(api.brand())+'" placeholder="Automobiles ..."></label>';
  else h+='<p class="hint">Quand vous remplirez ces conditions, l’usine sera le siège de votre marque. Les investisseurs complètent votre apport comme pour le terrain industriel.</p>';
  btns+=btn('visit','Visiter l’usine')+btn('found','Fonder ma marque dans cette usine','',!okF);}
 btns+=(w.mode==='loc'?btn('sell','Résilier le bail (caution rendue : '+esc(fmt(caution(p)))+')','ghost'):btn('sell','Revendre ('+esc(fmt(value(p.id)))+')','ghost'))+btn('biens','Mes biens','ghost')+btn('close','Fermer','ghost');
 h+=`<div class="mw-btns">${btns}</div>`;
 MW.panel(z.nom,h,{wide:true,onClick:a=>{
  if(a==='sleep'){if(!(s.min>=1140||s.min<360)) return;pend=p.id;MW.closePanel();MW.sleep(p.reveil);}
  else if(a==='enter'){MW.closePanel();MWL.enter(p.id);}
  else if(a==='save'){MW.save();MW.toast('Partie sauvegardée.','good');}
  else if(a==='stock') stockPanel(p.id,z);
  else if(a==='cars') carsPanel(p.id,z);
  else if(a==='work'){MWC.workAt(p.id);MW.toast(`Vous travaillez à votre compte au ${p.nom}.`,'good');fiche(z);}
  else if(a==='stopwork'){MWC.stopWork();fiche(z);}
  else if(a==='compte') MWS.panel(p.id);
  else if(a==='sell'){if(api.sell(p.id)){MW.closePanel();}else fiche(z);}
  else if(a==='biens') carnet();
  else if(a==='found'){const inp=document.getElementById('mwBrand');api.found(p.id,inp&&inp.value.trim());if(own(p.id)) fiche(z);}
  else if(a==='visit'){MW.closePanel();try{MWU.enter(p.id);}catch(e){}}}});}
let pend=null;
/* dormir dans le logement id (lit des intérieurs, js/52a) : réveil plus tôt et révisions de nuit comme depuis la fiche */
api.sleepIn=id=>{const p=BY[id],s=MW.S;if(!p||!own(id)||!s||!(s.min>=1140||s.min<360)) return false;pend=id;MW.sleep(p.reveil);return true;};
MW.on('slept',()=>{
 if(!pend) return;const p=BY[pend],w=own(pend);pend=null;if(!p||!w||!p.repos) return;
 const n=w.mode==='loc'?Math.floor(p.repos/2):p.repos;if(n<=0) return;
 try{const nm=COMP_NOM(),ks=Object.keys(nm);if(!ks.length) return;const xp=MW.S.xp||(MW.S.xp={});
  ks.sort((a,b)=>(xp[a]||0)-(xp[b]||0));const k=ks[0];xp[k]=(xp[k]||0)+n;MW.toast(`Bien reposé : +${n} d’expérience en ${nm[k].toLocaleLowerCase()}.`,'good');}catch(e){}});

/* coffre personnel : objets de l'inventaire (outils et pièces) */
function itLabel(it){let n='Objet';try{n=MWJ.itNom(it);}catch(e){}
 const k=it.k==='outil'?'outil':it.k==='neuve'?'neuve':it.k==='usagee'?'usagée':'';return esc(n)+(k?` <small>(${k})</small>`:'');}
function stockPanel(id,z){
 const o=I(),st=o.stock[id]||(o.stock[id]=[]),cap=stockCap(id),inv=MWJ.inv?MWJ.inv():MW.S.inv,max=MWJ.INV_MAX||12;
 let h=`<p class="hint">Coffre : ${st.length}/${cap} places. Sur vous : ${inv.length}/${max}.</p><h3 class="mw-h3">Dans votre coffre</h3><div class="mw-card">`;
 h+=st.length?st.map((it,i)=>`<div class="mw-row"><span>${itLabel(it)}</span>${btn('out:'+i,'Reprendre','sm',inv.length>=max)}</div>`).join(''):'<small>Vide.</small>';
 h+='</div><h3 class="mw-h3">Sur vous</h3><div class="mw-card">';
 h+=inv.length?inv.map((it,i)=>`<div class="mw-row"><span>${itLabel(it)}</span>${btn('in:'+i,'Ranger','sm',st.length>=cap)}</div>`).join(''):'<small>Rien dans vos poches.</small>';
 h+=`</div><div class="mw-btns">${btn('back','Retour','ghost')}${btn('close','Fermer','ghost')}</div>`;
 MW.panel(z.nom+' · Coffre',h,{wide:true,onClick:a=>{
  const [k,n]=a.split(':'),i=+n;
  if(k==='in'&&inv[i]&&st.length<cap){try{MWJ.hands();}catch(e){}st.push(inv.splice(i,1)[0]);try{MWJ.invUI();}catch(e){}stockPanel(id,z);}
  else if(k==='out'&&st[i]&&inv.length<max){inv.push(st.splice(i,1)[0]);try{MWJ.invUI();}catch(e){}stockPanel(id,z);}
  else if(a==='back'){if(BY[id]) fiche(z);else MW.closePanel();}}});}
api.stock=id=>{const z=MW.zone(id);if(z) stockPanel(id,z);};
api.stockMove=(id,dir,i)=>{ /* outil de test : 'in' range l'objet i de l'inventaire, 'out' reprend l'objet i du coffre */
 const o=I(),st=o.stock[id]||(o.stock[id]=[]),inv=MW.S.inv;
 if(dir==='in'&&inv[i]&&st.length<stockCap(id)){st.push(inv.splice(i,1)[0]);return true;}
 if(dir==='out'&&st[i]&&inv.length<(MWJ.INV_MAX||12)){inv.push(st.splice(i,1)[0]);return true;}return false;};

/* voitures garées */
function carsPanel(id,z){
 const o=I(),cur=MWC.getCar();
 let h=`<p class="hint">Places dans vos garages privés : ${o.cars.length}/${parkCap()}. Quand vous achetez une voiture chez le vendeur d’occasions, vous pouvez garder l’ancienne ici.</p><div class="mw-card">${row('Votre voiture actuelle','<small>'+esc(cur.nom)+'</small>')}</div><h3 class="mw-h3">Voitures garées</h3><div class="mw-card">`;
 h+=o.cars.length?o.cars.map((c,i)=>`<div class="mw-row"><span>${esc(c.nom||'Voiture')}</span>${btn('take:'+i,'Prendre au volant','sm')}</div>`).join(''):'<small>Aucune voiture garée.</small>';
 h+=`</div><div class="mw-btns">${btn('back','Retour','ghost')}${btn('close','Fermer','ghost')}</div>`;
 MW.panel(z.nom+' · Garage privé',h,{wide:true,onClick:a=>{
  if(a.startsWith('take:')){const i=+a.slice(5),c=o.cars[i];if(!c) return;api.takeCar(i);MW.toast('Vous prenez '+(c.nom||'cette voiture')+'.','good');carsPanel(id,z);}
  else if(a==='back') fiche(z);}});}

/* ═══ Mes biens (touche B) ═══ */
function carnet(){
 const o=I();if(!o) return;const t=api.totals();let owed=0;try{owed=MWC.owed();}catch(e){}
 let h=`<div class="mw-card">${row('Patrimoine immobilier (valeur de revente)',esc(fmt(t.valeur)))}${row('Charges et loyers par semaine',esc(fmt(t.charges)))}${row('Prêts en cours à la banque',esc(fmt(owed)))}</div>`;
 h+='<h3 class="mw-h3">Vos biens</h3>';
 const mine=CAT.filter(p=>own(p.id));
 h+=mine.length?'<div class="mw-card">'+mine.map(p=>{const w=own(p.id);
  return `<div class="mw-row"><span><b>${esc(p.nom)}</b> <span class="mw-tag ok">${KIND[p.kind]}${w.mode==='loc'?' · loué':''}</span><br><small>${w.mode==='loc'?'Loyer':'Charges'} ${esc(fmt(weekly(p.id)))} par semaine${w.mode==='achat'?' · valeur '+esc(fmt(value(p.id))):''}</small></span>${p.kind==='garage'&&hasSoc()&&MWS.ensure(p.id)?btn('acct:'+p.id,'Compte du garage','sm'):''}${btn('go:'+p.id,'Repérer','sm ghost')}</div>`;}).join('')+'</div>'
  :'<p class="hint">Vous ne possédez aucun bien. Les bâtiments « À vendre » sont indiqués en vert sur la carte (touche M) et par un panneau sur leur façade.</p>';
 if(hasSoc()){const cp=MWS.copies().filter(x=>!own(x.zid));
  if(cp.length) h+='<h3 class="mw-h3">Parts dans une société</h3><div class="mw-card">'+cp.map(x=>`<div class="mw-row"><span><b>${esc(x.nom)}</b><br><small>${esc(x.pct+' %')} · garage de ${esc(x.hote||'votre ami')} (le compte s'ouvre quand vous jouez avec lui)</small></span>${MWS.has(x.zid)?btn('acct:'+x.zid,'Compte du garage','sm'):''}</div>`).join('')+'</div>';}
 const sale=CAT.filter(p=>!own(p.id));
 if(sale.length){h+='<h3 class="mw-h3">À vendre</h3><div class="mw-card">'+sale.map(p=>{const ok=reqOk(p);
  return `<div class="mw-row"><span><b>${esc(p.nom)}</b> <span class="mw-tag${ok?' ok':' warn'}">${KIND[p.kind]}${ok?'':' · conditions à remplir'}</span><br><small>${esc(fmt(p.prix))} · charges ${esc(fmt(p.charges))} par semaine${(()=>{try{return p.kind==='logement'?' · '+MWL.info(p.id).surface+' m²':'';}catch(e){return '';}})()}</small></span>${btn('go:'+p.id,'Repérer','sm ghost')}</div>`;}).join('')+'</div>';}
 h+=`<div class="mw-btns">${btn('close','Fermer','ghost')}</div>`;
 MW.panel('Mes biens',h,{wide:true,onClick:a=>{if(a.startsWith('acct:')){MWS.panel(a.slice(5));return;}if(a.startsWith('go:')){const id=a.slice(3);MW.closePanel();MW.setMarker(id,BY[id]?BY[id].nom:'');MW.toast('Repère placé : '+(BY[id]?BY[id].nom:id)+' (carte : M).','info');}}});}
api.panel=carnet;
MW.addButton('biens','Mes biens (B)',()=>{if(MW.S) carnet();});
MW.on('key',k=>{if(k==='b'&&MW.S) carnet();});

/* ═══ Panneaux « À vendre » sur les façades (un seul maillage instancié) ═══ */
let signs=null;
function ensureSigns(){
 if(signs||!MW.scene||typeof THREE==='undefined') return;
 const T=THREE,draw=(x,w,h)=>{x.fillStyle='#c4281c';x.fillRect(0,0,w,h);x.strokeStyle='#fff';x.lineWidth=h*.04;x.strokeRect(h*.06,h*.06,w-h*.12,h-h*.12);
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='bold '+Math.round(h*.4)+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';x.fillText('À VENDRE',w/2,h*.42);
  x.font='bold '+Math.round(h*.16)+'px Arial';x.fillText('Agence du Quartier',w/2,h*.76);};
 let mt;
 if(typeof MWD!=='undefined'&&MWD.canvasTex&&MWD.signMat) mt=MWD.signMat(MWD.canvasTex(512,256,draw));
 else{const c=document.createElement('canvas');c.width=512;c.height=256;draw(c.getContext('2d'),512,256);mt=new T.MeshBasicMaterial({map:new T.CanvasTexture(c)});}
 signs=new T.InstancedMesh(new T.PlaneGeometry(1,1),mt,CAT.length);signs.frustumCulled=false;signs.name='immo-panneaux';
 MW.scene.add(signs);}
const _m=()=>new THREE.Matrix4();
function placeSigns(){
 ensureSigns();if(!signs) return;const T=THREE,m=_m(),q=new T.Quaternion(),pos=new T.Vector3(),sc=new T.Vector3(),ax=new T.Vector3(0,1,0);
 CAT.forEach((p,i)=>{const z=MW.zone(p.id);
  if(!z||own(p.id)||p.nosign){m.makeScale(0,0,0);signs.setMatrixAt(i,m);return;}
  const ry=Math.atan2(-z.n.x,-z.n.z),tx=Math.cos(ry),tz=-Math.sin(ry),ox=-z.n.x,oz=-z.n.z;
  pos.set(z.door.x+ox*.42+tx*p.signU,p.signY,z.door.z+oz*.42+tz*p.signU);q.setFromAxisAngle(ax,ry);sc.set(p.signW,p.signW/2,1);
  m.compose(pos,q,sc);signs.setMatrixAt(i,m);});
 signs.instanceMatrix.needsUpdate=true;}

/* ═══ Cycle de vie ═══ */
for(const p of CAT) MW.setDoor(p.id,fiche);
MW.on('start',()=>{clientele();I();
 // cohérence avec la carrière : un garage qui n'est plus à vous ne peut pas être votre lieu de travail
 try{const e=MWC.employer();if(e.id==='proprio'&&!own(e.zone)) MWC.stopWork();}catch(err){}
 refreshWorld();});
MW.on('open',()=>refreshWorld());
window.__mwi=api;
return api;})();
