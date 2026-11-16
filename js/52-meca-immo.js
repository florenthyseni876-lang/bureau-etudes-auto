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
const stockCap=id=>{const p=BY[id],w=own(id);return p&&w?(w.mode==='loc'?Math.floor(p.stock/2):p.stock):0;};
const parkCap=()=>{let n=0;for(const p of CAT){const w=own(p.id);if(p.kind==='logement'&&w&&w.mode==='achat') n+=p.parking||0;}return n;};
api.value=value;api.weekly=weekly;
api.parkFree=()=>{const o=I();return o?Math.max(0,parkCap()-o.cars.length):0;};
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
api.buy=(id,how)=>{
 const p=BY[id],o=I();if(!p||!o||o.owned[id]) return false;
 if(!reqOk(p)){MW.toast('Vous ne remplissez pas encore les conditions pour ce bien.','warn');return false;}
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
 else{MW.money(value(id),'Revente : '+p.nom);}
 delete o.owned[id];delete o.stock[id];
 refreshWorld();MW.emit('immoChanged',id);MW.save();return true;};

/* ═══ Charges hebdomadaires, prestige ═══ */
MW.on('day',d=>{
 const o=I();if(!o) return;let tot=0;const det=[];
 for(const id in o.owned){const p=BY[id],w=o.owned[id];if(!p){continue;}
  if(!(w.paidTo>0)) w.paidTo=d;
  while(d-w.paidTo>=7){w.paidTo+=7;const c=w.mode==='loc'?p.loyer:p.charges;tot+=c;det.push([p.nom,c]);
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
 let h=`<p>${esc(p.desc)}</p><div class="mw-card">`;
 if(w){
  h+=row('Statut',w.mode==='loc'?'Loué':'Propriétaire')+(w.mode==='achat'?row('Valeur de revente',esc(fmt(value(p.id)))):row('Caution versée',esc(fmt(caution(p)))))+row(w.mode==='loc'?'Loyer par semaine':'Charges par semaine',esc(fmt(weekly(p.id))))+(w.credit?row('Achat','à crédit (voir la banque)'):'');}
 else{
  h+=row('Prix',esc(fmt(p.prix)))+row('Charges par semaine',esc(fmt(p.charges)))+(p.loyer?row('Ou louer : loyer par semaine',esc(fmt(p.loyer))):'')+row('Revente','−'+Math.round(p.decote*100)+' %');}
 h+='</div><ul class="mw-cond">'+perks(p,mode).map(t=>`<li class="ok">✓ ${esc(t)}</li>`).join('')+'</ul>';
 return h;}
function fiche(z){
 const p=BY[z.id];if(!p) return;
 const w=own(p.id);
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
 h+=`<div class="mw-btns">${btn('cash','Acheter comptant ('+esc(fmt(p.prix))+')','',!ok||s.money<p.prix)}${btn('credit','Acheter à crédit (apport '+esc(fmt(apport(p)))+')','',!ok||s.money<apport(p))}${p.loyer?btn('rent','Louer ('+esc(fmt(p.loyer))+' par semaine)','',!ok||s.money<caution(p)):''}${p.kind==='usine'?btn('visit','Visiter l’usine'):''}${btn('close','Fermer','ghost')}</div>`;
 MW.panel(z.nom+' · À vendre',h,{wide:true,onClick:a=>{
  if(a==='cash'||a==='credit'||a==='rent'){if(api.buy(p.id,a)){fiche(z);}}
  else if(a==='visit'){MW.closePanel();try{MWU.enter(p.id);}catch(e){}}}});}
function mine(p,z,w){
 const o=I(),s=MW.S;let h=sheet(p,z,w),btns='';
 if(p.kind==='logement'){
  const nuit=s.min>=1140||s.min<360;
  h+=nuit?'':'<p class="hint">Vous pourrez dormir ici à partir de 19 h.</p>';
  const pk=w.mode==='achat'?(o.cars.length+'/'+parkCap()):'aucun';
  h+=`<div class="mw-card">${row('Coffre',(o.stock[p.id]||[]).length+'/'+stockCap(p.id))}${p.parking&&w.mode==='achat'?row('Voitures garées (tous vos garages)',esc(pk)):''}</div>`;
  btns+=btn('sleep','Dormir (réveil à '+hm(p.reveil)+')','',!nuit)+btn('stock','Coffre : pièces et outils')+(w.mode==='achat'&&p.parking?btn('cars','Mes voitures'):'')+btn('save','Sauvegarder','ghost');}
 if(p.kind==='garage'){
  let e=null;try{e=MWC.employer();}catch(x){}
  const here=!!e&&e.id==='proprio'&&e.zone===p.id;
  if(here) h+='<p class="mw-soon">Vous travaillez ici à votre compte : les clients arrivent de 8 h à 19 h, approchez-vous d’un pont.</p>';
  else{h+='<p class="hint">Les clients ne viennent que si vous travaillez ici.'+(e&&e.id!=='aucun'?' Vous quitterez votre poste actuel : '+esc(e.nom)+'.':'')+'</p>';}
  btns+=here?btn('stopwork','Cesser de travailler ici','ghost'):btn('work','Travailler ici à mon compte');}
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
  else if(a==='save'){MW.save();MW.toast('Partie sauvegardée.','good');}
  else if(a==='stock') stockPanel(p.id,z);
  else if(a==='cars') carsPanel(p.id,z);
  else if(a==='work'){MWC.workAt(p.id);MW.toast(`Vous travaillez à votre compte au ${p.nom}.`,'good');fiche(z);}
  else if(a==='stopwork'){MWC.stopWork();fiche(z);}
  else if(a==='sell'){if(api.sell(p.id)){MW.closePanel();}else fiche(z);}
  else if(a==='biens') carnet();
  else if(a==='found'){const inp=document.getElementById('mwBrand');api.found(p.id,inp&&inp.value.trim());if(own(p.id)) fiche(z);}
  else if(a==='visit'){MW.closePanel();try{MWU.enter(p.id);}catch(e){}}}});}
let pend=null;
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
  else if(a==='back') fiche(z);}});}
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
  if(a.startsWith('take:')){const i=+a.slice(5),c=o.cars[i];if(!c) return;const now=MWC.getCar();o.cars[i]={id:now.id,nom:now.nom,kind:now.kind,color:now.color,model:now.model};MWC.setCar(c);MW.toast('Vous prenez '+(c.nom||'cette voiture')+'.','good');carsPanel(id,z);}
  else if(a==='back') fiche(z);}});}

/* ═══ Mes biens (touche B) ═══ */
function carnet(){
 const o=I();if(!o) return;const t=api.totals();let owed=0;try{owed=MWC.owed();}catch(e){}
 let h=`<div class="mw-card">${row('Patrimoine immobilier (valeur de revente)',esc(fmt(t.valeur)))}${row('Charges et loyers par semaine',esc(fmt(t.charges)))}${row('Prêts en cours à la banque',esc(fmt(owed)))}</div>`;
 h+='<h3 class="mw-h3">Vos biens</h3>';
 const mine=CAT.filter(p=>own(p.id));
 h+=mine.length?'<div class="mw-card">'+mine.map(p=>{const w=own(p.id);
  return `<div class="mw-row"><span><b>${esc(p.nom)}</b> <span class="mw-tag ok">${KIND[p.kind]}${w.mode==='loc'?' · loué':''}</span><br><small>${w.mode==='loc'?'Loyer':'Charges'} ${esc(fmt(weekly(p.id)))} par semaine${w.mode==='achat'?' · valeur '+esc(fmt(value(p.id))):''}</small></span>${btn('go:'+p.id,'Repérer','sm ghost')}</div>`;}).join('')+'</div>'
  :'<p class="hint">Vous ne possédez aucun bien. Les bâtiments « À vendre » sont indiqués en vert sur la carte (touche M) et par un panneau sur leur façade.</p>';
 const sale=CAT.filter(p=>!own(p.id));
 if(sale.length){h+='<h3 class="mw-h3">À vendre</h3><div class="mw-card">'+sale.map(p=>{const ok=reqOk(p);
  return `<div class="mw-row"><span><b>${esc(p.nom)}</b> <span class="mw-tag${ok?' ok':' warn'}">${KIND[p.kind]}${ok?'':' · conditions à remplir'}</span><br><small>${esc(fmt(p.prix))} · charges ${esc(fmt(p.charges))} par semaine</small></span>${btn('go:'+p.id,'Repérer','sm ghost')}</div>`;}).join('')+'</div>';}
 h+=`<div class="mw-btns">${btn('close','Fermer','ghost')}</div>`;
 MW.panel('Mes biens',h,{wide:true,onClick:a=>{if(a.startsWith('go:')){const id=a.slice(3);MW.closePanel();MW.setMarker(id,BY[id]?BY[id].nom:'');MW.toast('Repère placé : '+(BY[id]?BY[id].nom:id)+' (carte : M).','info');}}});}
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
  if(!z||own(p.id)){m.makeScale(0,0,0);signs.setMatrixAt(i,m);return;}
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
