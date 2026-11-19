'use strict';
/* ───────────── Mode « Mécanicien » — SOCIÉTÉ DU GARAGE (compte du garage, associés, salaires, dividendes) ─────────────
   Un garage acheté (js/52, MWI) appartient à une SOCIÉTÉ : un compte bancaire du garage, séparé de l'argent personnel.
   Seul ou à deux (achat « à deux » : chacun apporte une somme, les parts suivent les apports), c'est la même logique.
   Le compte reçoit les factures des clients du garage et paie les pièces, le matériel, les charges du bâtiment et le prêt.
   Pour toucher de l'argent personnel, les associés se versent un SALAIRE (mensuel) ou des DIVIDENDES, taxés (règles simplifiées) :
     · salaire : brut décidé pour chaque associé ; le compte paie le brut + environ 45 % de charges patronales ; l'associé reçoit le brut moins
       environ 22 % de charges salariales (argent personnel) ; versé tous les 30 jours de jeu ;
     · dividendes : seulement sur le bénéfice de l'exercice (chiffre d'affaires − charges), après l'impôt sur les sociétés
       (15 % jusqu'à 42 500 €, 25 % au-delà), puis prélèvement forfaitaire de 30 % ; répartis selon les parts ;
     · à deux : un versement de dividendes ou un changement de salaire est proposé par l'un et doit être accepté par l'autre ;
       jamais plus que le solde du compte ; l'exercice dure 360 jours de jeu, avec un bilan annuel (chiffre d'affaires, charges, bénéfice, impôts).
   Simplifications : le remboursement du prêt compte comme une charge ; pas de TVA ; les charges du bâtiment sont celles de js/52.
   Le Garage du Coin repris par le joueur (employeur « patron », js/42) garde son argent personnel : seuls les garages achetés ont une société.

   ═══ En partie à deux ═══
   L'hôte fait autorité : la société est dans SA sauvegarde (identifiant et prénom de chaque associé). L'invité reçoit une copie de l'état
   (MWS.setMirror), envoie ses demandes (js/56, message « so ») et garde dans sa propre sauvegarde une copie de ses parts. Un versement pour un
   associé absent est mis « en attente » et lui arrive à sa prochaine connexion.

   ═══ API `MWS` (aussi `window.__mws`) ═══
   MWS.get(zid) / MWS.has(zid)      société du garage `zid` (ou null)        MWS.active()  zone de la société où le joueur travaille (ou null)
   MWS.cash()                       solde dont dispose le joueur pour ses achats professionnels (compte du garage, sinon argent personnel)
   MWS.biz(dx, motif)               mouvement professionnel : compte du garage si le joueur travaille dans son garage, sinon argent personnel
   MWS.charge(zid, x, motif)        charges du bâtiment (js/52)               MWS.create(zid, parts, pret)  fonde la société (achat du garage)
   MWS.salaire(zid, pid, brut)      fixe un salaire mensuel (proposé à l'autre s'il y a deux associés)
   MWS.dividendes(zid, montant)     verse des dividendes (idem)               MWS.accepter(zid) / MWS.refuser(zid)   réponse à la proposition en attente
   MWS.distribuable(zid)            {benefice, is, deja, dist, payable}       MWS.tax  barèmes ; MWS.isOf(benefice)
   MWS.tick(jour)                   traitement quotidien (prêts, salaires, clôture d'exercice) : appelé à l'événement 'day' (hôte seulement)
   MWS.panel(zid)                   panneau « Compte du garage »              MWS.dissoudre(zid, produit)  vente du garage : prêt soldé, solde partagé */
const MWS=(()=>{
const api={};
const TAX={chPat:.45,chSal:.22,is1:.15,is2:.25,seuil:42500,pfu:.30,mois:30,exo:360};
api.tax=TAX;
const r2=x=>Math.round(x*100)/100;
const fmt=x=>MW.fmt(x);
const E=s=>esc(s);
const isGuest=()=>{const n=MW.net;return !!(n&&n.live&&n.guest);};
const live=()=>!!(MW.net&&MW.net.live);
const NET=()=>typeof MWNET!=='undefined'?MWNET:null;
let mirror=null,hostPid='',hostNom='';
const pid=()=>{const s=MW.S;if(!s.pid) s.pid='p'+Math.random().toString(36).slice(2,12);return s.pid;};
const myNom=()=>{let n='';try{n=NET()&&NET().myName?NET().myName():'';}catch(e){}if(!n){try{n=localStorage.getItem('bea.meca.prenom')||'';}catch(e){}}return n||'Vous';};
api.pid=pid;
const book=()=>isGuest()?(mirror||{}):(MW.S.soc||(MW.S.soc={}));
const get=zid=>book()[zid]||null;
api.get=get;api.has=zid=>!!get(zid);
api.all=()=>book();

/* ═══ Barèmes ═══ */
const isOf=b=>b>0?r2(Math.min(b,TAX.seuil)*TAX.is1+Math.max(0,b-TAX.seuil)*TAX.is2):0;
api.isOf=isOf;
function distribuable(c){
 const b=r2(c.ex.ca-c.ex.ch),is=isOf(b),dist=Math.max(0,r2(b-is-c.ex.div));
 return {benefice:b,is,deja:c.ex.div,dist,payable:Math.max(0,Math.min(dist,Math.floor(c.compte*100)/100))};}
api.distribuable=zid=>{const c=get(zid);return c?distribuable(c):null;};

/* ═══ Création, opérations ═══ */
api.create=(zid,parts,pret)=>{
 const s=MW.S;s.soc=s.soc||{};const z=MW.zone(zid);
 const tot=parts.reduce((a,p)=>a+(+p.apport||0),0)||1;let acc=0;
 const ps=parts.map((p,i)=>{const pct=i===parts.length-1?r2(100-acc):r2((+p.apport||0)/tot*100);acc=r2(acc+pct);return {pid:p.pid,nom:p.nom,pct,apport:+p.apport||0};});
 const c={zid,nom:'Société '+(z?z.court:zid),compte:0,parts:ps,prets:[],ops:[],ex:{debut:s.day,ca:0,ch:0,div:0,pfu:0,sal:0,is:0},bilans:[],sal:{},due:{},next:s.day+TAX.mois,prop:null,depuis:s.day};
 if(pret&&pret.x>0){const n=pret.n||240,tot2=Math.round(pret.x*(1+.07*n/365));c.prets.push({rest:tot2,per:Math.ceil(tot2/n),n,x:pret.x});}
 s.soc[zid]=c;return c;};
/* ancienne sauvegarde : un garage déjà acheté reçoit sa société (compte à 0) */
function ensure(zid){
 if(isGuest()||get(zid)) return get(zid);
 let ok=false;try{ok=MWI.owned(zid)&&MWI.CAT.some(p=>p.id===zid&&p.kind==='garage');}catch(e){}
 return ok?api.create(zid,[{pid:pid(),nom:myNom(),apport:0}]):null;}
api.ensure=ensure;
function op(c,dx,motif,cat){
 c.compte=r2(c.compte+dx);
 if(cat==='ca') c.ex.ca=r2(c.ex.ca+dx);else if(cat==='ch') c.ex.ch=r2(c.ex.ch-dx);
 c.ops.push({t:MW.timeStr(),dx:r2(dx),motif,solde:c.compte});while(c.ops.length>30) c.ops.shift();
 return c.compte;}
api.active=()=>{
 try{const e=MWC.employer();if(e&&e.id==='proprio'&&e.zone){if(get(e.zone)) return e.zone;if(!isGuest()&&ensure(e.zone)) return e.zone;}}catch(x){}
 return null;};
api.cash=()=>{const z=api.active();return z?get(z).compte:MW.S.money;};
const note=(dx,motif)=>{try{MW.toast((dx>0?'+ ':'− ')+fmt(Math.abs(dx))+' · '+motif+' (compte du garage)',dx>0?'good':'warn');}catch(e){}};
api.biz=(dx,motif)=>{
 const z=api.active();if(!z) return MW.money(dx,motif);
 if(isGuest()){NET().sendSoc({k:'biz',zid:z,dx,motif});note(dx,motif);return get(z).compte;}
 const c=get(z);op(c,dx,motif,dx>0?'ca':'ch');note(dx,motif);return c.compte;};
api.charge=(zid,x,motif)=>{const c=get(zid);if(!c) return false;op(c,-x,motif,'ch');return true;};
api.deposit=(zid,x,motif)=>{const c=get(zid);if(!c) return false;op(c,x,motif||'Apport en compte courant','cap');return true;}; /* hors bilan : apport d'associé */

/* ═══ Versements aux associés ═══ */
const partOf=(c,p)=>c.parts.find(x=>x.pid===p)||null;
const partnerPid=()=>{try{return NET()&&NET().partner?NET().partner().pid:null;}catch(e){return null;}};
function payTo(c,p,x,motif){
 if(!(x>0)) return;
 if(p===pid()){MW.money(x,motif);return;}
 if(live()&&partnerPid()===p){NET().sendTo({t:'pay',dx:x,motif});return;}
 c.due[p]=r2((c.due[p]||0)+x);} /* associé absent : lui arrive à sa prochaine connexion */
api.flushDue=p=>{ /* hôte : somme due à l'associé qui vient de se connecter */
 let tot=0;for(const z in (MW.S.soc||{})){const c=MW.S.soc[z];if(c.due&&c.due[p]>0){tot+=c.due[p];delete c.due[p];}}return r2(tot);};
function applySal(c,p,brut){
 brut=Math.max(0,Math.round(+brut||0));
 if(brut>0) c.sal[p]=brut;else delete c.sal[p];
 say(brut>0?`Salaire fixé : ${fmt(brut)} brut par mois pour ${(partOf(c,p)||{}).nom||'l\'associé'} (coût pour le garage : ${fmt(r2(brut*(1+TAX.chPat)))}).`:`Salaire supprimé pour ${(partOf(c,p)||{}).nom||'l\'associé'}.`,'good');}
function applyDiv(c,D){
 const d=distribuable(c);D=r2(+D||0);
 if(!(D>0)) return 'Montant invalide.';
 if(D>d.dist+.005) return `Pas plus que le bénéfice distribuable (${fmt(d.dist)}).`;
 if(D>c.compte+.005) return `Le compte du garage ne contient que ${fmt(c.compte)}.`;
 op(c,-D,'Dividendes versés (brut)','div');c.ex.div=r2(c.ex.div+D);
 let acc=0,pfuT=0;
 c.parts.forEach((q,i)=>{const brut=i===c.parts.length-1?r2(D-acc):r2(D*q.pct/100);acc=r2(acc+brut);const pfu=r2(brut*TAX.pfu),net=r2(brut-pfu);pfuT=r2(pfuT+pfu);
  payTo(c,q.pid,net,`Dividendes de ${c.nom} (brut ${fmt(brut)}, prélèvement de 30 % : ${fmt(pfu)})`);});
 c.ex.pfu=r2(c.ex.pfu+pfuT);
 say(`Dividendes versés : ${fmt(D)} brut, ${fmt(r2(D-pfuT))} net après le prélèvement forfaitaire de 30 %.`,'good');return null;}
function say(t,g){try{MW.toast(t,g||'info');}catch(e){}if(live()&&!isGuest()&&NET()&&NET().sendTo) try{NET().sendTo({t:'say',txt:t,g:g||'info'});}catch(e){}}

/* ═══ Demandes (l'hôte exécute ; l'invité envoie) ═══ */
function other(c,by){return c.parts.find(x=>x.pid!==by.pid)||null;}
function exec(m,by){ /* hôte : by = {pid,nom} de celui qui demande */
 const c=get(m.zid);if(!c) return 'Société introuvable.';
 const me=partOf(c,by.pid);if(!me) return "Vous n'êtes pas associé de ce garage.";
 if(m.k==='sal'||m.k==='div'){
  if(!partOf(c,m.pid||by.pid)&&m.k==='sal') return 'Associé inconnu.';
  if(c.parts.length<2){return m.k==='sal'?(applySal(c,m.pid,m.brut),null):applyDiv(c,m.montant);}
  if(c.prop) return 'Une proposition est déjà en attente : acceptez-la ou refusez-la d\'abord.';
  if(m.k==='div'){const d=distribuable(c),D=r2(+m.montant||0);if(!(D>0)||D>d.dist+.005||D>c.compte+.005) return `Montant impossible (distribuable : ${fmt(d.dist)}, solde : ${fmt(c.compte)}).`;}
  c.prop={k:m.k,pid:m.pid,brut:m.brut,montant:m.montant,by:{pid:by.pid,nom:by.nom}};
  const o=other(c,by);toastTo(o.pid,`${by.nom} propose ${m.k==='div'?`de verser ${fmt(r2(+m.montant))} de dividendes`:`un salaire de ${fmt(Math.round(+m.brut))} brut par mois pour ${(partOf(c,m.pid)||{}).nom}`} : voir le compte du garage.`);
  return null;}
 if(m.k==='acc'||m.k==='ref'){
  const pr=c.prop;if(!pr) return 'Aucune proposition en attente.';
  if(pr.by.pid===by.pid){if(m.k==='ref'){c.prop=null;return null;}return 'Votre ami doit accepter votre proposition.';}
  c.prop=null;
  if(m.k==='ref'){toastTo(pr.by.pid,`${by.nom} refuse votre proposition.`);return null;}
  return pr.k==='sal'?(applySal(c,pr.pid,pr.brut),null):applyDiv(c,pr.montant);}
 return 'Demande inconnue.';}
function toastTo(p,t){if(p===pid()){say(t,'info');return;}if(live()&&partnerPid()===p&&NET().sendTo) NET().sendTo({t:'say',txt:t,g:'info'});}
/* appelé par js/56 pour un message d'invité */
api.onGuestMsg=(m,who)=>{
 const by={pid:who.pid,nom:who.name};
 if(m.k==='biz'){const c=get(m.zid);if(c&&partOf(c,who.pid)){const dx=+m.dx||0;op(c,dx,String(m.motif||'').slice(0,80),dx>0?'ca':'ch');}return null;}
 const err=exec(m,by);if(err&&NET().sendTo) NET().sendTo({t:'say',txt:err,g:'warn'});return err;};
function request(m){
 if(isGuest()){NET().sendSoc(m);return null;}
 const err=exec(m,{pid:pid(),nom:myNom()});if(err) say(err,'warn');return err;}
api.salaire=(zid,p,brut)=>request({k:'sal',zid,pid:p,brut});
api.dividendes=(zid,montant)=>request({k:'div',zid,montant});
api.accepter=zid=>request({k:'acc',zid});
api.refuser=zid=>request({k:'ref',zid});

/* ═══ Traitement quotidien (hôte seulement) ═══ */
function closeYear(c,d){
 const b=r2(c.ex.ca-c.ex.ch),is=isOf(b);
 if(is>0) op(c,-is,"Impôt sur les sociétés de l'exercice",'is');
 c.bilans.push({annee:c.bilans.length+1,debut:c.ex.debut,fin:d,ca:c.ex.ca,ch:c.ex.ch,benefice:b,is,div:c.ex.div,pfu:c.ex.pfu,sal:c.ex.sal});while(c.bilans.length>10) c.bilans.shift();
 c.ex={debut:d,ca:0,ch:0,div:0,pfu:0,sal:0,is:0};
 say(`Exercice clos : bénéfice ${fmt(b)}, impôt sur les sociétés ${fmt(is)}. Voir le compte du garage.`,'info');}
api.tick=d=>{
 if(isGuest()||!MW.S.soc) return;
 for(const zid in MW.S.soc){const c=MW.S.soc[zid];
  for(const l of c.prets.slice()){const p=Math.min(l.per,l.rest);op(c,-p,'Remboursement du prêt du garage','ch');l.rest=r2(l.rest-p);if(l.rest<=.5) c.prets.splice(c.prets.indexOf(l),1);}
  while(d>=c.next){
   const ids=Object.keys(c.sal).filter(p=>partOf(c,p));
   const cost=r2(ids.reduce((a,p)=>a+c.sal[p]*(1+TAX.chPat),0));
   if(ids.length&&c.compte<cost){if(!c.warnSal){c.warnSal=1;say(`${c.nom} : solde insuffisant pour les salaires (${fmt(cost)}). Ils seront versés dès que le compte le permet.`,'crit');}break;}
   c.warnSal=0;
   for(const p of ids){const brut=c.sal[p],pat=r2(brut*TAX.chPat),netS=r2(brut*(1-TAX.chSal));
    op(c,-r2(brut+pat),`Salaire de ${partOf(c,p).nom} : brut ${fmt(brut)} + charges patronales ${fmt(pat)}`,'ch');c.ex.sal=r2(c.ex.sal+brut);
    payTo(c,p,netS,`Salaire de ${c.nom} (brut ${fmt(brut)}, charges salariales ${fmt(r2(brut-netS))})`);}
   c.next+=TAX.mois;}
  if(d-c.ex.debut>=TAX.exo) closeYear(c,d);}};
MW.on('day',d=>api.tick(d));

/* vente du garage : le prêt est soldé, ce qui reste du compte est partagé selon les parts (capital rendu, non taxé) */
api.dissoudre=(zid,produit)=>{
 const c=get(zid);if(!c) return false;
 if(produit>0) op(c,produit,'Revente du garage','cap');
 for(const l of c.prets) op(c,-Math.min(l.rest,Math.max(0,c.compte)),'Prêt soldé à la revente','cap');
 const reste=Math.max(0,c.compte);let acc=0;
 c.parts.forEach((q,i)=>{const x=i===c.parts.length-1?r2(reste-acc):r2(reste*q.pct/100);acc=r2(acc+x);payTo(c,q.pid,x,`Part de la revente du garage (${q.pct} %)`);});
 delete MW.S.soc[zid];return true;};

/* ═══ Panneau « Compte du garage » ═══ */
const row=(a,b)=>`<div class="mw-row"><span>${a}</span><b>${b}</b></div>`;
const btn=(a,l,cls,dis)=>`<button type="button" class="btn${cls?' '+cls:''}" data-mw="${a}"${dis?' disabled':''}>${l}</button>`;
let panelZ=null;
function html(c){
 const me=pid(),d=distribuable(c),multi=c.parts.length>1,pr=c.prop;
 let h=`<div class="mw-card">${row('Solde du compte',E(fmt(c.compte)))}${row('Associés',c.parts.map(p=>`${E(p.nom)} ${p.pct} %`).join(' · '))}${c.prets.length?row('Prêt du garage (reste à rembourser)',E(fmt(c.prets.reduce((a,l)=>a+l.rest,0)))):''}</div>`;
 if(pr){const mine=pr.by.pid===me;
  h+=`<div class="mw-card"><b>Proposition en attente</b><br>${E(pr.by.nom)} propose ${pr.k==='div'?`de verser <b>${E(fmt(+pr.montant))}</b> de dividendes (brut)`:`un salaire de <b>${E(fmt(+pr.brut))}</b> brut par mois pour ${E((partOf(c,pr.pid)||{}).nom||'')}`}.<div class="mw-btns">${mine?`<small>En attente de l'accord de votre associé.</small>${btn('ref','Retirer','ghost')}`:`${btn('acc','Accepter')}${btn('ref','Refuser','ghost')}`}</div></div>`;}
 h+='<h3 class="mw-h3">Salaires mensuels (versés tous les 30 jours)</h3><div class="mw-card">';
 for(const p of c.parts){const b=c.sal[p.pid]||0;
  h+=`<div class="mw-row"><span>${E(p.nom)}<br><small>${b?`Brut ${E(fmt(b))} · coût pour le garage ${E(fmt(r2(b*(1+TAX.chPat))))} · net ${E(fmt(r2(b*(1-TAX.chSal))))}`:'Pas de salaire'}</small></span><span><input id="mwSal_${E(p.pid)}" class="mw-in" type="number" min="0" step="50" value="${b||''}" placeholder="brut" style="width:6.5em"> ${btn('sal:'+p.pid,multi?'Proposer':'Fixer','sm',!!pr)}</span></div>`;}
 h+='</div>';
 h+=`<h3 class="mw-h3">Dividendes</h3><div class="mw-card">${row('Bénéfice de l\'exercice (chiffre d\'affaires − charges)',E(fmt(d.benefice)))}${row('Impôt sur les sociétés dû',E(fmt(d.is)))}${row('Déjà versé cet exercice (brut)',E(fmt(d.deja)))}${row('Distribuable',E(fmt(d.dist)))}<div class="mw-row"><span><input id="mwDiv" class="mw-in" type="number" min="0" step="10" placeholder="montant brut" style="width:8em"></span>${btn('div',multi?'Proposer un versement':'Verser','sm',!!pr||d.dist<=0)}</div></div>`;
 h+='<h3 class="mw-h3">Dernières opérations</h3><div class="mw-card">'+(c.ops.length?c.ops.slice(-8).reverse().map(o=>`<div class="mw-row"><span><small>${E(o.t)}</small><br>${E(o.motif)}</span><b>${o.dx>0?'+':'−'} ${E(fmt(Math.abs(o.dx)))}</b></div>`).join(''):'<small>Aucune opération.</small>')+'</div>';
 const ex=c.ex,last=c.bilans[c.bilans.length-1];
 h+=`<h3 class="mw-h3">Bilan</h3><div class="mw-card">${row('Exercice en cours (depuis le jour '+ex.debut+')','')}${row('Chiffre d\'affaires',E(fmt(ex.ca)))}${row('Charges (pièces, matériel, bâtiment, prêt, salaires)',E(fmt(ex.ch)))}${row('Bénéfice',E(fmt(r2(ex.ca-ex.ch))))}${row('Dividendes bruts / prélèvement 30 %',E(fmt(ex.div))+' / '+E(fmt(ex.pfu)))}`;
 if(last) h+=row('Dernier exercice clos (n° '+last.annee+')','')+row('Chiffre d\'affaires / charges',E(fmt(last.ca))+' / '+E(fmt(last.ch)))+row('Bénéfice · impôt sur les sociétés',E(fmt(last.benefice))+' · '+E(fmt(last.is)));
 h+='</div>';
 h+=`<details class="mw-aide"><summary>Règles (simplifiées)</summary><ul class="mw-cond"><li>Salaire : le garage paie le brut + 45 % de charges patronales ; vous recevez le brut − 22 % de charges salariales.</li><li>Dividendes : seulement sur le bénéfice de l'exercice, après l'impôt sur les sociétés (15 % jusqu'à 42 500 €, 25 % au-delà), puis 30 % de prélèvement forfaitaire. Répartis selon les parts.</li><li>À deux, un versement ou un changement de salaire doit être accepté par l'autre associé. On ne peut pas verser plus que le solde.</li><li>Le remboursement du prêt compte comme une charge. L'exercice dure 360 jours de jeu.</li></ul></details>`;
 return h;}
api.panel=zid=>{
 const c=get(zid);if(!c){MW.toast("Ce garage n'a pas de société.",'warn');return;}
 panelZ=zid;
 MW.panel('Compte du garage · '+c.nom,html(c)+`<div class="mw-btns">${btn('close','Fermer','ghost')}</div>`,{wide:true,
  onClose:()=>{if(panelZ===zid) panelZ=null;},
  onClick:a=>{
   const rd=id=>{const i=document.getElementById(id);return i?+i.value:0;};
   if(a.startsWith('sal:')){const p=a.slice(4);api.salaire(zid,p,rd('mwSal_'+p));}
   else if(a==='div') api.dividendes(zid,rd('mwDiv'));
   else if(a==='acc') api.accepter(zid);
   else if(a==='ref') api.refuser(zid);
   setTimeout(()=>{if(panelZ===zid) api.panel(zid);},isGuest()?400:0);}});};
api.refresh=()=>{if(panelZ&&get(panelZ)) api.panel(panelZ);};

/* ═══ Copie côté invité ═══ */
api.snapshot=()=>JSON.stringify(MW.S.soc||{});
api.setMirror=(s,hp,hn)=>{mirror=s||{};hostPid=hp||hostPid;hostNom=hn||hostNom;
 const me=pid(),cp=MW.S.socCopy||(MW.S.socCopy={});
 for(const z in mirror){const q=partOf(mirror[z],me);if(q) cp[hostPid+':'+z]={zid:z,nom:mirror[z].nom,pct:q.pct,hote:hostNom,hpid:hostPid};}
 api.refresh();};
api.clearMirror=()=>{mirror=null;panelZ=null;};
api.copies=()=>Object.values(MW.S.socCopy||{});
api.mine=zid=>{const c=get(zid);return !!c&&!!partOf(c,pid());};

window.__mws=api;
return api;})();
