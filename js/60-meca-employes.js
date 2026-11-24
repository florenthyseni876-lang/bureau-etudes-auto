'use strict';
/* ───────────── Mode « Mécanicien » — EMPLOYÉS : recrutement, entretiens, équipe au travail, garage qui tourne seul ─────────────
   Dans un garage À SOI (Garage du Coin repris en patron, garages achetés js/52, ateliers de tuning rachetés js/58), l'ordinateur du
   bureau (près de l'entrée, js/59) ouvre un menu : commander des pièces, recruter, gérer l'équipe, entretiens.
   1. RECRUTER : publier une annonce (poste, salaire proposé, 30 € de frais) → des CV arrivent chaque matin (nombre et qualité selon le salaire,
      la réputation et le prestige du garage). Postes : apprenti, mécanicien, chef d'atelier, préparateur, réceptionniste.
   2. TRIER LES CV : fiches lisibles (avatar, âge, formation, diplômes, expériences, compétences par domaine, prétentions, qualités ; parfois un CV
      « enjolivé » ou un trou dans le parcours) ; filtrer, trier, mettre de côté, rejeter, convoquer à un entretien à l'heure choisie.
   3. ENTRETIEN en scène 3D : le candidat vient au bureau à l'heure fixée, s'assoit face à vous (la caméra se place devant lui), huit échanges à choix
      (accueil, parcours, deux questions techniques, mise en situation, motivation, salaire, conclusion). Les réponses dépendent de sa personnalité
      cachée et de ses vraies compétences ; ses réactions donnent des indices (hésite, ment, s'énerve, rassure…). Négociation du salaire, il peut refuser.
   4. AU TRAVAIL : les employés sont des personnages 3D (tenue de travail) qui marchent jusqu'au pont, prennent les pièces au stock (MWST, js/59),
      lèvent le pont, se penchent sous le capot, s'accroupissent aux roues, regardent sous la voiture, puis la rendent. Réceptionniste à l'accueil.
      Qualité et vitesse selon leurs compétences cachées ; erreurs possibles (pièce oubliée, pièce inutile) ; ils progressent avec l'expérience.
   5. LE GARAGE TOURNE SEUL : les clients arrivent et sont pris en charge même quand le joueur est ailleurs (simulation sans animation hors de vue) ;
      les salaires (+45 % de charges) sont prélevés chaque semaine sur le compte du garage (js/57, MWS) ; humeur, fatigue, motivation, demande
      d'augmentation, démission, maladie, licenciement (indemnité d'un mois). Une voiture rendue par un employé crédite le compte du garage.
   6. À DEUX (js/56) : l'hôte fait tourner l'équipe ; l'invité voit les mêmes employés (positions et postures envoyées par l'hôte).
   ═══ API `MWEMP` (aussi `window.__mwemp`) ═══
   MWEMP.canManage(zid)             vrai si le garage est à vous             MWEMP.menu(zid)     menu de l'ordinateur du bureau
   MWEMP.G(zid)                     données du garage {staff, ann, cv, rdv, next, jour, hist}
   MWEMP.publish(zid,poste,salaire) publie une annonce (frais d'annonce payés par le compte)    MWEMP.withdraw(zid,id)
   MWEMP.arrive(zid,n)              fait arriver n CV maintenant (test)         MWEMP.cvList(zid) liste des CV
   MWEMP.convoquer(zid,cvId,due)    convoque (due : minute absolue ; défaut : dans 1 heure)   MWEMP.rdvList(zid)
   MWEMP.interview(zid,rdvId)       lance la scène d'entretien                   MWEMP.hire(zid,cvId,salaire)  embauche directe
   MWEMP.staff(zid)                 employés                                     MWEMP.fire(zid,empId)
   MWEMP.level(zid,comp)            meilleur niveau de l'équipe dans une compétence
   MWEMP.near(zid)                  vrai si le garage est assez près du joueur pour animer l'équipe
   MWEMP.POSTES, MWEMP.COMPS        tables ; MWEMP.tickMin() / MWEMP.dayStep() : une minute / un matin de simulation (test)
   Données sauvegardées : MW.S.emp = {seq, g:{garageN:{staff, ann, cv, rdv, next, jour, hist}}} ; rien de THREE n'y est stocké. */
const MWEMP=(()=>{
const api={},PI=Math.PI;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),r2=x=>Math.round(x*100)/100,rnd=Math.random,rint=(a,b)=>a+Math.floor(rnd()*(b-a+1)),pick=a=>a[Math.floor(rnd()*a.length)];
const fmt=x=>MW.fmt(x);
const OPEN0=480,OPEN1=1140,TAXP=.45,FRAIS_ANN=30,PILE_MAX=12,MAX_STAFF=8;
const COMPS=['entretien','freinage','liaison','moteur','transmission','electricite','diagnostic','preparation','accueil'];
const CNOM={entretien:'Entretien',freinage:'Freinage',liaison:'Liaison au sol',moteur:'Moteur',transmission:'Transmission',electricite:'Électricité',diagnostic:'Diagnostic',preparation:'Préparation',accueil:'Accueil et relation client'};
const POSTES={
 apprenti:{nom:'Apprenti',sal:1150,niv:[0,2],age:[17,24],work:1,vit:.8},
 mecanicien:{nom:'Mécanicien',sal:2100,niv:[2,5],age:[21,46],work:1,vit:1},
 chef:{nom:"Chef d'atelier",sal:3100,niv:[4,8],age:[30,56],work:1,vit:1.1,chef:1},
 preparateur:{nom:'Préparateur (tuning)',sal:2500,niv:[3,6],age:[22,45],work:1,vit:1,prep:1},
 receptionniste:{nom:'Réceptionniste',sal:1800,niv:[0,1],age:[20,52],accueil:1}};
const WORKC=COMPS.slice(0,7);
const PH=['Louis','Hugo','Léo','Jules','Nathan','Tom','Karim','Mehdi','Enzo','Paul','Samir','Lucas','Antoine','Yanis','Mathieu','Bruno','Franck','Olivier','Thierry','Dylan'];
const PF=['Léa','Camille','Inès','Sarah','Manon','Emma','Julie','Chloé','Nadia','Clara','Laura','Anaïs','Sophie','Marion','Fatou','Élise'];
const NM=['Martin','Bernard','Durand','Petit','Robert','Richard','Simon','Michel','Leroy','Girard','Bonnet','Dupont','Fontaine','Roussel','Mercier','Blanchard','Guérin','Perrot','Lemaire','Chevalier','Boucher','Poirier'];
const ENTR=['Garage Martel','Auto Services du Port','Pneus & Freins Express','Garage de la Gare','Carrosserie Lemoine','Concession Rivière','Atelier du Centre','Garage des Lilas','Dépannage Fabre'];
const FORM={entretien:'CAP maintenance des véhicules',freinage:'Bac pro maintenance des véhicules',liaison:'CAP maintenance des véhicules',moteur:'BTS maintenance des véhicules',transmission:'Bac pro maintenance des véhicules',electricite:'Bac pro électrotechnique',diagnostic:'BTS maintenance des véhicules',preparation:'Formation préparation sportive',accueil:'BTS gestion de la PME'};
const sym=s=>s; /* repère de lecture */
/* ═══ état ═══ */
function S(){const s=MW.S;if(!s.emp||typeof s.emp!=='object') s.emp={seq:0,g:{}};if(!s.emp.g) s.emp.g={};if(s.emp.seq==null) s.emp.seq=0;return s.emp;}
const G=zid=>{const e=S();let g=e.g[zid];if(!g) g=e.g[zid]={staff:[],ann:[],cv:[],rdv:[],next:0,jour:{d:0,n:0,ca:0,notes:[]},hist:[],arr:0};for(const k of ['staff','ann','cv','rdv','hist']) if(!g[k]) g[k]=[];return g;};
api.G=G;
const sid=()=>'e'+(++S().seq);
const zn=zid=>MW.zone(zid);
const guest=()=>!!(MW.net&&MW.net.live&&MW.net.guest);
const dayEff=()=>MW.S.min<360?MW.S.day-1:MW.S.day;
const absT=()=>MW.S.day*1440+(MW.S.min<360?MW.S.min+1440:MW.S.min);
const isOpen=()=>MW.S.min>=OPEN0&&MW.S.min<OPEN1;
const nomLieu=zid=>{try{return zn(zid).nom;}catch(e){return zid;}};
/* ═══ garages à soi ═══ */
api.canManage=zid=>{try{if(!zid||!zn(zid)||!/^(garage|tune)\d$/.test(zid)) return false;if(zid==='garage1') return MWC.employer().id==='patron';
 if(typeof MWI!=='undefined'&&MWI.owned(zid)) return true;const e=MWC.employer();return !!(e&&e.id==='proprio'&&e.zone===zid);}catch(e){return false;}};
const owned=()=>{const l=[];try{for(const z of MW.zones) if(api.canManage(z.id)) l.push(z.id);}catch(e){}return l;};
const prestige=zid=>({garage1:0,garage2:.4,garage3:1,garage4:.8,garage5:0,garage6:.3,garage7:.7,tune1:.6,tune2:.5})[zid]||.2;
const staffOf=zid=>G(zid).staff.filter(e=>e.etat!=='parti');
api.staff=staffOf;
api.level=(zid,comp)=>{let m=0;for(const e of staffOf(zid)) if(e.etat!=='absent'&&POSTES[e.poste].work) m=Math.max(m,Math.floor(e.sk[comp]||0));return m;};
/* ═══ géométrie de l'atelier (repère local u = x − centre, v = profondeur depuis la porte) ═══ */
const toLoc=(z,x,zz)=>({u:x-z.x,v:(zz-z.z)*z.n.z+z._d.d/2});
const bays=z=>z.ponts.map(p=>{const l=toLoc(z,p.x,p.z);return {u:l.u,v:l.v,p};});
function routeTo(z,A,B){ /* chemin de A à B sans traverser les ponts : voies avant et arrière, couloirs entre les ponts */
 const a=toLoc(z,A.x,A.z),b=toLoc(z,B.x,B.z),bb=bays(z),pv=bb.length?bb[0].v:8,hx=z._d.w/2;
 const vF=Math.max(1.2,pv-3.9),vB=pv+4.1;
 const inBay=q=>bb.some(x=>Math.abs(q.u-x.u)<3.2&&Math.abs(q.v-x.v)<3.8);
 const lane=q=>q.v<pv+.2&&!(inBay(q)&&q.v>pv-.4)?vF:vB;
 const cors=[];const us=bb.map(x=>x.u).sort((p,q)=>p-q);
 const cand=[0,...us.slice(1).map((u,i)=>(u+us[i])/2),us[0]-4,us[us.length-1]+4];
 for(const u of cand) if(Math.abs(u)<hx-1.5&&us.every(x=>Math.abs(u-x)>3.2)) cors.push(u);
 const near=(arr,t)=>arr.reduce((m,u)=>Math.abs(u-t)<Math.abs(m-t)?u:m,arr[0]);
 const la=lane(a),lb=lane(b),pts=[a];
 if(la===lb){if(inBay(a)||Math.abs(a.v-la)>.4) pts.push({u:a.u,v:la});pts.push({u:b.u,v:la});}
 else{const c=cors.length?near(cors,(a.u+b.u)/2):0;pts.push({u:a.u,v:la},{u:c,v:la},{u:c,v:lb},{u:b.u,v:lb});}
 pts.push(b);
 const out=[];for(const q of pts){const w=z.loc(q.u,q.v);const l=out[out.length-1];if(!l||Math.hypot(l.x-w.x,l.z-w.z)>.05) out.push({x:w.x,z:w.z});}
 return out;}
const pathLen=p=>{let t=0;for(let i=1;i<p.length;i++) t+=Math.hypot(p[i].x-p[i-1].x,p[i].z-p[i-1].z);return t;};
const fw=p=>({x:Math.sin(p.ry),z:Math.cos(p.ry)}),lw=p=>({x:Math.cos(p.ry),z:-Math.sin(p.ry)});
function stationOf(z,name,i,extra){const hx=z._d.w/2,dp=z._d.d;
 if(name==='rest') return z.loc(-hx+5.2+(i%5)*1.3,1.6+Math.floor(i/5)*1.3);
 if(name==='shelf') return z.loc(hx-3.4,dp-2.0);
 if(name==='seat') return z.loc(hx-6.4,1.3);
 if(name==='reception') return z.loc(hx-3.2,2.1);
 if(name==='door') return z.loc(0,.8);
 if(name==='outside') return z.loc(0,-5);
 const p=z.ponts[i];if(!p) return z.loc(0,3);const f=fw(p),l=lw(p);
 if(name==='side') return {x:p.x+l.x*1.75,z:p.z+l.z*1.75};
 if(name==='capot') return {x:p.x+f.x*3.2,z:p.z+f.z*3.2};
 if(name==='under') return {x:p.x,z:p.z};
 if(name==='wheel') return {x:p.x+l.x*(extra&&extra.s||1)*1.65+f.x*(extra&&extra.fb||1)*1.3,z:p.z+l.z*(extra&&extra.s||1)*1.65+f.z*(extra&&extra.fb||1)*1.3};
 return z.loc(0,3);}
/* ═══ CV ═══ */
const SKP=()=>MWPUP;
function genSkills(po,q,tune){ /* compétences réelles : niveau 0 à 10 selon le poste et la qualité du candidat */
 const P=POSTES[po],lo=P.niv[0],hi=P.niv[1],sk={},base=lo+(hi-lo)*q;
 if(P.accueil){sk.accueil=clamp(Math.round(2+q*7+rnd()*1.5),1,10);for(const c of WORKC) sk[c]=0;return sk;}
 const top=pick(WORKC);
 for(const c of WORKC) sk[c]=clamp(Math.round(base+(c===top?1.5:0)+(rnd()-.5)*2.6),0,10);
 if(P.prep||tune) sk.preparation=clamp(Math.round(base+rnd()*1.5),0,10);
 if(po==='apprenti'){for(const c of WORKC) sk[c]=Math.min(sk[c],3);}
 return sk;}
function genPerso(q){const t=()=>clamp(Math.round((rnd()*.75+q*.25+(rnd()-.5)*.2)*100)/100,.02,.98);
 return {honnete:clamp(rnd()*.85+.1+(q-.5)*.1,.05,.98),ponct:t(),motiv:t(),courtoisie:t(),stress:clamp(1-t()+(rnd()-.5)*.3,.02,.98)};}
function genCV(zid,po,sal,q){
 const P=POSTES[po],fem=rnd()<(P.accueil?.65:.3),age=rint(P.age[0],P.age[1]);
 const ap=MWPUP.genAp(rnd,{fem}),nom=(fem?pick(PF):pick(PH))+' '+pick(NM);
 const vrai=genSkills(po,q,/^tune/.test(zid)),perso=genPerso(q);
 const enj=perso.honnete<.45&&rnd()<.8,faux=perso.honnete<.3&&rnd()<.6,trou=rnd()<.22;
 const decl=Object.assign({},vrai);if(enj) for(const c of Object.keys(decl)) if(decl[c]>=1||P.accueil) decl[c]=clamp(decl[c]+rint(1,2)*(decl[c]>=1?1:0),0,10);
 const best=P.accueil?'accueil':Object.keys(vrai).filter(c=>WORKC.includes(c)).sort((a,b)=>vrai[b]-vrai[a])[0];
 const dipl=[];if(!P.accueil&&po!=='apprenti'&&(vrai[best]>=2||faux)) dipl.push({nom:faux?'BTS maintenance des véhicules':FORM[best],vrai:!faux});
 else if(P.accueil) dipl.push({nom:FORM.accueil,vrai:true});else dipl.push({nom:'Brevet des collèges',vrai:true},{nom:rnd()<.5?'CAP maintenance des véhicules (en cours)':'Bac pro maintenance (en cours)',vrai:true});
 const nExp=po==='apprenti'?rint(0,1):Math.min(3,Math.max(1,Math.floor((age-20)/6)+(rnd()<.4?1:0))),exp=[];
 for(let i=0;i<nExp;i++){const ans=rint(1,5);exp.push({lieu:pick(ENTR),poste:P.accueil?'Accueil':(i===0&&vrai[best]>=5?'Mécanicien confirmé':'Mécanicien'),ans,gonfle:enj&&i===0&&rnd()<.6});}
 const qual=[];if(perso.honnete>.65||enj) qual.push(perso.honnete>.65?'Honnête':'Fiable');if(perso.ponct>.6||(perso.ponct<.35&&rnd()<.5)) qual.push('Ponctuel');if(perso.motiv>.6||rnd()<.3) qual.push('Motivé');if(perso.courtoisie>.6||rnd()<.25) qual.push('Aimable avec les clients');if(perso.stress<.35) qual.push('Calme sous pression');
 const def=[];if(perso.honnete>.75&&perso.stress>.6) def.push('Un peu stressé(e)');if(perso.honnete>.75&&perso.ponct<.4) def.push('Pas toujours matinal(e)');
 const moy=P.accueil?vrai.accueil:WORKC.reduce((a,c)=>a+vrai[c],0)/WORKC.length;
 const pret=Math.round(P.sal*(.82+.065*moy+.006*(age-25))*(.95+rnd()*.12)/10)*10;
 return {id:'cv'+(++S().seq),zid,poste:po,nom,age,ap,vrai,decl,perso,enj,faux,trou,dipl,exp,qual:qual.slice(0,4),def,pret,jour:MW.S.day,statut:'nouveau',notes:[]};}
api.genCV=genCV;
/* ═══ annonces et arrivée des CV ═══ */
api.publish=(zid,po,sal)=>{const g=G(zid);if(!POSTES[po]) return {ok:false,why:'Poste inconnu.'};sal=Math.round(+sal||POSTES[po].sal);
 if(g.ann.length>=3) return {ok:false,why:"Trois annonces au plus en même temps."};if(g.ann.some(a=>a.poste===po)) return {ok:false,why:'Une annonce existe déjà pour ce poste.'};
 if(g.staff.filter(e=>e.etat!=='parti').length>=MAX_STAFF) return {ok:false,why:`L'équipe est au complet (${MAX_STAFF} personnes).`};
 if(typeof MWS!=='undefined'&&MWS.ensure(zid)) MWS.charge(zid,FRAIS_ANN,"Annonce d'embauche");
 g.ann.push({id:'a'+(++S().seq),poste:po,salaire:sal,jour:MW.S.day,fin:MW.S.day+21});return {ok:true};};
api.withdraw=(zid,id)=>{const g=G(zid);g.ann=g.ann.filter(a=>a.id!==id);};
function arrivals(zid,force){const g=G(zid);let n=0;
 for(const a of g.ann.slice()){if(MW.S.day>a.fin){g.ann.splice(g.ann.indexOf(a),1);MW.toast(`L'annonce « ${POSTES[a.poste].nom} » de ${nomLieu(zid)} est arrivée à échéance.`,'info');continue;}
  const P=POSTES[a.poste],ratio=a.salaire/P.sal,rep=(MW.S.rep||0)/100;
  const lam=clamp(.7+(ratio-1)*4+rep*1.6+prestige(zid)*.8,.25,3.2),k=force!=null?force:Math.floor(lam)+(rnd()<lam%1?1:0);
  for(let i=0;i<k&&g.cv.filter(c=>c.statut!=='rejete').length<PILE_MAX;i++){const q=clamp(.38+(ratio-1)*1.3+rep*.25+prestige(zid)*.12+(rnd()-.5)*.55,.02,.98);g.cv.push(genCV(zid,a.poste,a.salaire,q));n++;}}
 g.cv=g.cv.filter(c=>c.statut!=='rejete'||MW.S.day-c.jour<3);
 if(n&&force==null) MW.toast(`${n} nouveau${n>1?'x':''} CV pour ${nomLieu(zid)} : ouvrez l'ordinateur du bureau.`,'info');return n;}
api.arrive=(zid,n)=>arrivals(zid,n==null?1:n);
api.cvList=zid=>G(zid).cv;
/* ═══ affichage des CV ═══ */
const btn=(a,t,cls,dis)=>`<button type="button" class="btn sm${cls?' '+cls:''}" data-mw="${a}"${dis?' disabled':''}>${t}</button>`;
const bar=(v,m)=>`<span class="emp-bar"><i style="width:${Math.round(clamp(v/(m||10),0,1)*100)}%"></i></span>`;
const topSk=(sk,n)=>Object.keys(sk).filter(c=>sk[c]>0).sort((a,b)=>sk[b]-sk[a]).slice(0,n);
const av=ap=>`<img class="emp-av" alt="" src="${MWPUP.avatar(ap)}">`;
function cvCard(c,detail){
 const P=POSTES[c.poste],t=topSk(c.decl,detail?9:3);
 let h=`<div class="emp-cv${c.statut==='garde'?' garde':''}">${av(c.ap)}<div class="emp-cv-b"><b>${esc(c.nom)}</b> · ${c.age} ans · <span class="emp-tag">${esc(P.nom)}</span>${c.statut==='garde'?' <span class="emp-tag ok">★ mis de côté</span>':c.statut==='convoque'?' <span class="emp-tag ok">convoqué</span>':c.statut==='nouveau'?' <span class="emp-tag new">nouveau</span>':''}`;
 h+=`<div class="emp-sk">${t.map(k=>`<span>${esc(CNOM[k])} ${bar(c.decl[k])}<b>${c.decl[k]}</b></span>`).join('')}</div>`;
 h+=`<small>Prétentions : <b>${fmt(c.pret)}</b>/mois brut${c.qual.length?' · '+esc(c.qual.slice(0,detail?4:2).join(', ')):''}</small>`;
 if(detail){h+=`<div class="emp-det"><p><b>Formation</b> : ${c.dipl.map(d=>esc(d.nom)).join(' ; ')||'—'}</p><p><b>Expériences</b> :<br>${c.exp.length?c.exp.map(x=>`${esc(x.lieu)} — ${esc(x.poste)}, ${x.ans} an${x.ans>1?'s':''}`).join('<br>'):'Aucune (premier emploi)'}${c.trou?'<br><i>Interruption de 14 mois dans le parcours, non expliquée.</i>':''}</p>${c.def.length?`<p><b>À savoir</b> : ${esc(c.def.join(', '))}</p>`:''}${c.notes.length?`<p><b>Vos notes d'entretien</b> :<br>${c.notes.map(esc).join('<br>')}</p>`:''}</div>`;}
 return h+'</div></div>';}
let cvF={poste:'tous',tri:'recent',dom:'tous',garde:false};
function cvPanel(zid,id){
 const g=G(zid);
 if(id){const c=g.cv.find(x=>x.id===id);if(c){c.statut=c.statut==='nouveau'?'lu':c.statut;
  let h=cvCard(c,true);const slots=slotList();
  h+=`<div class="mw-btns">${btn('keep:'+c.id,c.statut==='garde'?'Retirer des gardés':'★ Mettre de côté','ghost')}${btn('rej:'+c.id,'Rejeter','ghost')}${btn('back','Retour à la liste','ghost')}</div>`;
  if(c.statut!=='convoque'&&c.statut!=='embauche') h+=`<p class="hint">Convoquer à un entretien :</p><div class="mw-btns">${slots.map((s,i)=>btn('conv:'+c.id+':'+i,s.lab)).join('')}</div>`;
  MW.panel('CV · '+c.nom,h,{wide:true,onClick:a=>{const [k,i,j]=a.split(':');if(k==='keep'){c.statut=c.statut==='garde'?'lu':'garde';cvPanel(zid,c.id);}else if(k==='rej'){c.statut='rejete';cvPanel(zid);}else if(k==='back') cvPanel(zid);
   else if(k==='conv'){const r=api.convoquer(zid,i,slots[+j].due);if(!r.ok) MW.toast(r.why,'warn');else MW.toast(`${c.nom} est convoqué(e) ${slots[+j].lab.toLowerCase()}.`,'good');cvPanel(zid);}}});return;}}
 let l=g.cv.filter(c=>c.statut!=='rejete'&&c.statut!=='embauche');
 if(cvF.poste!=='tous') l=l.filter(c=>c.poste===cvF.poste);if(cvF.garde) l=l.filter(c=>c.statut==='garde');if(cvF.dom!=='tous') l=l.filter(c=>(c.decl[cvF.dom]||0)>=3);
 const sc=c=>Math.max(...Object.values(c.decl));
 l.sort(cvF.tri==='comp'?(a,b)=>sc(b)-sc(a):cvF.tri==='sal'?(a,b)=>a.pret-b.pret:cvF.tri==='age'?(a,b)=>a.age-b.age:(a,b)=>b.jour-a.jour);
 let h=`<p class="hint">${g.cv.filter(c=>c.statut!=='rejete'&&c.statut!=='embauche').length} CV · les compétences affichées sont celles que les candidats déclarent : à vérifier en entretien.</p>`;
 h+=`<div class="mw-btns">${btn('f:poste:tous','Tous les postes',cvF.poste==='tous'?'':'ghost')}${Object.keys(POSTES).map(k=>btn('f:poste:'+k,esc(POSTES[k].nom),cvF.poste===k?'':'ghost')).join('')}</div>`;
 h+=`<div class="mw-btns">${btn('f:tri:recent','Récents',cvF.tri==='recent'?'':'ghost')}${btn('f:tri:comp','Meilleur niveau',cvF.tri==='comp'?'':'ghost')}${btn('f:tri:sal','Salaire',cvF.tri==='sal'?'':'ghost')}${btn('f:tri:age','Âge',cvF.tri==='age'?'':'ghost')}${btn('f:garde:1',cvF.garde?'★ Gardés seulement':'★ Gardés','' ,false)}</div>`;
 h+=`<div class="mw-btns">${['tous','entretien','freinage','moteur','electricite','diagnostic'].map(k=>btn('f:dom:'+k,k==='tous'?'Tout domaine':esc(CNOM[k])+' ≥ 3',cvF.dom===k?'':'ghost')).join('')}</div>`;
 h+=l.map(c=>cvCard(c,false)+`<div class="mw-btns">${btn('open:'+c.id,'Ouvrir le CV')}${btn('keep:'+c.id,c.statut==='garde'?'Retirer ★':'★ De côté','ghost')}${btn('rej:'+c.id,'Rejeter','ghost')}</div>`).join('')||'<p class="hint">Aucun CV ne correspond.</p>';
 h+=`<div class="mw-btns">${btn('menu','Retour au menu','ghost')}</div>`;
 MW.panel('CV reçus · '+nomLieu(zid),h,{wide:true,onClick:a=>{const [k,i,j]=a.split(':');
  if(k==='f'){if(i==='garde') cvF.garde=!cvF.garde;else cvF[i]=j;cvPanel(zid);}else if(k==='open') cvPanel(zid,i);
  else if(k==='keep'){const c=g.cv.find(x=>x.id===i);if(c) c.statut=c.statut==='garde'?'lu':'garde';cvPanel(zid);}
  else if(k==='rej'){const c=g.cv.find(x=>x.id===i);if(c) c.statut='rejete';cvPanel(zid);}else if(k==='menu') api.menu(zid);}});}
function slotList(){const t=absT(),d=dayEff(),l=[];
 if(MW.S.min>=OPEN0&&MW.S.min<15*60) l.push({lab:'Dans 2 heures',due:t+120});
 for(const h of [9,11,14,16]) l.push({lab:`Demain à ${h} h`,due:(d+1)*1440+h*60});return l;}
api.convoquer=(zid,cvId,due)=>{const g=G(zid),c=g.cv.find(x=>x.id===cvId);if(!c) return {ok:false,why:'CV introuvable.'};
 if(c.statut==='convoque') return {ok:false,why:'Déjà convoqué(e).'};
 const r={id:'r'+(++S().seq),cv:cvId,due:due!=null?due:absT()+60,etat:'att'};g.rdv.push(r);c.statut='convoque';return {ok:true,rdv:r};};
api.rdvList=zid=>G(zid).rdv;
/* ═══ entretien : dialogues ═══ */
const IVT={};let IV=null;
const pc=(c,k)=>c.perso[k];
const dom=(cv,i)=>{const cl=Object.keys(cv.decl).filter(k=>cv.decl[k]>0&&k!=='preparation'||cv.poste==='receptionniste'&&k==='accueil').sort((a,b)=>cv.decl[b]-cv.decl[a]);return cl.length?(i===0?cl[0]:cl[1]||cl[0]):'diagnostic';};
const verdict=(cv,d,diff)=>{const t=cv.vrai[d]||0,cl=cv.decl[d]||0,need=diff*1.3,m=t-need+(rnd()-.5)*1.2+(IV?(IV.mood-50)/60:0);
 if(m>1) return {k:'bon',clue:'compétent',txt:"répond avec précision et assurance, cite un cas concret."};
 if(m>-.5) return {k:'moyen',clue:'correct',txt:"répond correctement, mais de façon un peu scolaire."};
 if(cl>t+1) return {k:'bluff',clue:'bluffe',txt:"enchaîne du jargon sans vraiment répondre : il/elle bluffe."};
 if(m>-2) return {k:'hesite',clue:'hésite',txt:"hésite, se reprend, se contredit à mi-phrase."};
 return {k:'faible',clue:'faible',txt:"bafouille : visiblement, ce n'est pas son domaine."};};
const MOODT=m=>m>=65?'détendu(e)':m>=40?'attentif(ve)':m>=25?'tendu(e)':'crispé(e)';
function stages(){const cv=IV.cv,p=cv.perso;return {
 accueil:{q:"Le candidat s'avance. Comment l'accueillez-vous ?",ch:[
  {lab:"« Bonjour, installez-vous, merci d'être venu(e). » (aimable)",f:()=>p.stress>.6?{txt:"« Merci… (sourit nerveusement) Excusez-moi, je suis un peu stressé(e). »",m:6,clue:'nerveux'}:{txt:"« Merci, c'est un plaisir. Votre garage est très bien tenu. »",m:8}},
  {lab:"« Bonjour. Asseyez-vous, on va droit au but. » (neutre)",f:()=>({txt:"« Très bien, allons-y. »",m:2})},
  {lab:"« Vous avez de la chance que je vous reçoive. Convainquez-moi vite. » (exigeant)",f:()=>p.stress>.55?{txt:"(se raidit) « Euh… oui, bien sûr. »",m:-8,clue:'stressé'}:p.courtoisie<.4?{txt:"(hausse un sourcil) « On peut être courtois des deux côtés, non ? »",m:-10,clue:'susceptible'}:{txt:"« Je suis là pour ça. Allez-y, posez vos questions. »",m:1}},
  {lab:"« Vous étiez où hier soir ? » (piège)",f:()=>p.honnete<.4?{txt:"« Euh… chez des amis. (détourne le regard) »",m:-5,clue:'esquive'}:p.stress>.55?{txt:"(s'énerve) « En quoi ça vous regarde ? »",m:-14,clue:"s'énerve"}:{txt:"(sourit) « Une question piège ? Chez moi, à relire votre annonce. »",m:3,clue:'rassure'}}]},
 parcours:{q:"Parlons du parcours.",ch:[
  {lab:"« Parlez-moi de votre parcours. »",f:()=>cv.enj&&p.honnete<.5?{txt:"« J'ai géré des ateliers entiers, enfin… surtout en renfort. Disons que j'ai touché à tout. »",m:-2,clue:'exagère'}:{txt:cv.exp.length?`« J'ai travaillé ${cv.exp.map(x=>'chez '+x.lieu+' ('+x.ans+' an'+(x.ans>1?'s':'')+')').join(', puis ')}. J'ai appris sur le tas et en formation. »`:"« C'est mon premier emploi, mais j'ai fait mes stages en atelier et j'ai envie d'apprendre. »",m:3}},
  cv.trou?{lab:"« Il y a un trou dans votre CV : que s'est-il passé ? »",f:()=>p.honnete>.6?{txt:"« Une période difficile : un souci familial, puis une formation. Je préfère être franc(he). »",m:2,clue:'sincère'}:{txt:"« Euh… des missions, un peu de tout. C'est compliqué à expliquer. »",m:-6,clue:'hésite'}}:{lab:"« Pourquoi avoir quitté votre dernier poste ? »",f:()=>p.honnete>.55?{txt:"« Pour évoluer : j'avais fait le tour du poste. »",m:2}:{txt:"« Mon patron était nul, tout le monde le disait. (hausse les épaules) »",m:-5,clue:'critique'}},
  {lab:"« Montrez-moi vos diplômes. »",f:()=>cv.faux?{txt:"« Je les ai oubliés chez moi… je vous les enverrai. (tripote son stylo) »",m:-8,clue:'ment'}:{txt:"« Les voici. » Les justificatifs sont en règle.",m:4,clue:'diplômes vérifiés'}},
  {lab:"« Passons au technique. »",f:()=>({txt:"« Volontiers. »",m:0})}]},
 tech:i=>{const d=dom(cv,i),dn=CNOM[d].toLowerCase();return {q:`Question technique : ${dn}.`,ch:[
  {lab:`« Décrivez les étapes d'une opération courante en ${dn}. » (facile)`,f:()=>{const v=verdict(cv,d,1);return {txt:`Le/la candidat(e) ${v.txt}`,m:v.k==='bon'?4:v.k==='moyen'?1:-3,clue:v.clue,d,v:v.k};}},
  {lab:`« Quelle erreur fréquente faut-il éviter en ${dn} ? » (précise)`,f:()=>{const v=verdict(cv,d,3);return {txt:`Le/la candidat(e) ${v.txt}`,m:v.k==='bon'?6:v.k==='moyen'?0:-4,clue:v.clue,d,v:v.k};}},
  {lab:`« Un collègue vous conseille de sauter une étape de contrôle pour gagner du temps. Vous faites quoi ? » (piège)`,f:()=>p.honnete>.55?{txt:"« Je ne saute rien : si ça casse, c'est moi qui le paierai. »",m:5,clue:'rigoureux'}:{txt:"« Ça arrive… tant que le client ne voit rien, non ? »",m:-6,clue:'bâcle'}}]};},
 situation:{q:"Mise en situation : un client mécontent revient, sa voiture refait le même bruit.",ch:[
  {lab:"« Que lui dites-vous ? »",f:()=>p.courtoisie>.55&&p.stress<.6?{txt:"« Je reprends la voiture devant lui, je m'excuse sans me justifier et je cherche. »",m:5,clue:'rassure'}:p.courtoisie<.4?{txt:"« Je lui explique que ce n'est pas forcément notre travail. »",m:-5,clue:'défensif'}:{txt:"« Je… préviens quelqu'un d'autre. Je n'aime pas les conflits. »",m:-3,clue:'fuit'}},
  {lab:"« Et s'il se met à crier ? » (pression)",f:()=>p.stress>.6?{txt:"(s'énerve) « Je ne vais pas me laisser parler comme ça ! »",m:-9,clue:"s'énerve"}:{txt:"« Je respire, je baisse le ton, je le laisse se vider. »",m:4,clue:'calme'}},
  {lab:"« Et si c'était vraiment votre erreur ? »",f:()=>p.honnete>.55?{txt:"« Je l'avoue et je répare gratuitement. Ça arrive à tout le monde. »",m:5,clue:'honnête'}:{txt:"« Je chercherais d'abord une autre explication… »",m:-6,clue:'esquive'}}]},
 motivation:{q:"Motivation et disponibilité.",ch:[
  {lab:"« Pourquoi chez nous ? »",f:()=>p.motiv>.6?{txt:"« J'aime la mécanique et votre garage est en train de grandir : je veux y évoluer. »",m:5,clue:'motivé'}:{txt:"« C'est près de chez moi, et le salaire est correct. »",m:-2,clue:'peu motivé'}},
  {lab:"« Où vous voyez-vous dans trois ans ? »",f:()=>p.motiv>.55?{txt:"« Chef d'équipe, peut-être, ou à mon compte un jour. »",m:3}:{txt:"« Honnêtement ? Je n'y ai pas pensé. »",m:-3,clue:'peu motivé'}},
  {lab:"« Horaires, samedis, astreintes : vous êtes disponible ? »",f:()=>p.ponct>.55?{txt:"« Sans problème, je m'adapte. »",m:3,clue:'flexible'}:{txt:"« Pas avant 9 h, et pas le samedi si possible. »",m:-4,clue:'peu disponible'}}]}};}
const plancher=cv=>{const p=cv.perso,m=IV?IV.mood:50;return Math.round(cv.pret*(.86+.06*(1-p.motiv)+(m<35?.1:0)-(m>65?.06:0))/10)*10;};
function salaireStage(){const cv=IV.cv,X=cv.pret;
 const react=o=>{const pl=plancher(cv);IV.offre=o;if(o>=X) return {txt:`« Parfait, ça me convient très bien. »`,m:5,clue:'satisfait'};
  if(o>=pl){IV.contre=null;return {txt:`« Ce n'est pas tout à fait ce que j'espérais, mais je peux accepter. »`,m:-1,clue:'accepte à contrecœur'};}
  IV.contre=pl;return {txt:`« Ça me paraît trop bas. Je ne descendrai pas sous ${fmt(pl)}. »`,m:-5,clue:'contre-propose'};};
 return {q:`Salaire : « Je pensais à ${fmt(X)} brut par mois. » (le poste est annoncé à ${fmt(IV.ann||X)})`,ch:[
  {lab:`« D'accord pour ${fmt(X)}. »`,f:()=>react(X)},{lab:`« Je peux aller à ${fmt(Math.round(X*.9/10)*10)}. » (−10 %)`,f:()=>react(Math.round(X*.9/10)*10)},
  {lab:`« Plutôt ${fmt(Math.round(X*.8/10)*10)}. » (−20 %)`,f:()=>react(Math.round(X*.8/10)*10)},{lab:`« Je vous propose ${fmt(Math.round(X*1.05/10)*10)} : j'attends de l'engagement. » (+5 %)`,f:()=>({txt:`« Merci, je m'engage à fond. »`,m:8,clue:'reconnaissant'}) ,o:Math.round(X*1.05/10)*10}]};}
function ivRender(txt){
 const cv=IV.cv,st=IV.stages||(IV.stages=stages()),order=['accueil','parcours','tech0','tech1','situation','motivation','salaire','conclusion'],name=order[IV.step];
 let h=`<div class="emp-dlg-h">${av(cv.ap)}<div><b>${esc(cv.nom)}</b> · ${esc(POSTES[cv.poste].nom)}<br><small>${MOODT(IV.mood)} · échange ${Math.min(IV.step+1,8)} / 8</small></div></div>`;
 if(txt) h+=`<p class="emp-say">${txt}</p>`;
 let node;if(name==='accueil') node=st.accueil;else if(name==='parcours') node=st.parcours;else if(name==='tech0') node=st.tech(0);else if(name==='tech1') node=st.tech(1);
 else if(name==='situation') node=st.situation;else if(name==='motivation') node=st.motivation;else if(name==='salaire') node=salaireStage();
 if(name==='conclusion'){
  const imp=IV.notes.length?IV.notes.map(n=>'• '+esc(n)).join('<br>'):'Rien de marquant.';
  h+=`<p class="hint"><b>Impressions</b> :<br>${imp}</p><p>Votre décision ?</p><div class="mw-btns v">${btn('c:hire',`« Je vous embauche${IV.offre?' à '+fmt(IV.offre)+' brut/mois':''}. »`)}${btn('c:keep','« Je vous rappelle. » (mettre le CV de côté)','ghost')}${btn('c:no','« Merci, mais non. »','ghost')}</div>`;
  IV.node=null;}
 else{IV.node=node;h+=`<p class="emp-q"><b>Vous</b> — ${esc(node.q)}</p><div class="mw-btns v">${node.ch.map((c,i)=>btn('ch:'+i,esc(c.lab),'ghost')).join('')}</div>`;}
 MW.panel('Entretien · '+cv.nom,h,{wide:true,onClick:ivClick,onClose:ivAbort});
 const pw=document.querySelector('.mw-pw');if(pw) pw.classList.add('emp-dlg');
 const pose=IV.puppet;if(pose) pose.set('parle');}
function ivClick(a){const [k,i]=a.split(':');if(!IV) return;
 if(k==='ch'){const n=IV.node;if(!n) return;const ch=n.ch[+i],r=ch.f();if(ch.o) IV.offre=ch.o;
  IV.mood=clamp(IV.mood+(r.m||0),0,100);if(r.clue&&!IV.notes.includes(r.clue)) IV.notes.push(r.clue);IV.log.push({q:n.q,a:ch.lab,r:r.txt});if(r.d){IV.est=IV.est||{};IV.est[r.d]=r.v;}
  MW.addMin(5);
  let nx=1;const order=['accueil','parcours','tech0','tech1','situation','motivation','salaire','conclusion'];
  if(order[IV.step]==='salaire'&&IV.contre&&!IV.round2){IV.round2=1;IV.step--;nx=1;
   // deuxième tour de négociation : accepter la contre-proposition ou maintenir
   const cv=IV.cv,c=IV.contre;IV.node={q:`Il/elle maintient ${fmt(c)} brut par mois.`,ch:[{lab:`« D'accord pour ${fmt(c)}. »`,f:()=>({txt:'« Merci. »',m:3,clue:'négocie'}),o:c},{lab:`« Je maintiens ${fmt(IV.offre)}. »`,f:()=>({txt:IV.offre>=plancher(cv)?'« Soit. »':'« Dans ces conditions, je vais devoir réfléchir. »',m:-3})}]};
   let h2=`<div class="emp-dlg-h">${av(cv.ap)}<div><b>${esc(cv.nom)}</b><br><small>${MOODT(IV.mood)}</small></div></div><p class="emp-say">${r.txt}</p><p class="emp-q"><b>Vous</b> — ${esc(IV.node.q)}</p><div class="mw-btns v">${IV.node.ch.map((c2,i2)=>btn('ch:'+i2,esc(c2.lab),'ghost')).join('')}</div>`;
   MW.panel('Entretien · '+cv.nom,h2,{wide:true,onClick:ivClick,onClose:ivAbort});const pw=document.querySelector('.mw-pw');if(pw) pw.classList.add('emp-dlg');IV.step++;return;}
  IV.step+=nx;ivRender(r.txt);return;}
 if(k==='c'){ivEnd(i);}}
function ivAbort(){if(!IV||IV.fin) return;IV.fin=1;const cv=IV.cv,g=G(IV.zid);cv.statut='garde';cv.notes=IV.notes.map(n=>'• '+n);g.rdv=g.rdv.filter(r=>r!==IV.rdv);ivLeave(false);MW.toast("Entretien interrompu : le candidat est mis de côté.",'info');}
function ivEnd(dec){const cv=IV.cv,zid=IV.zid,g=G(zid),rdv=IV.rdv;IV.fin=1;cv.notes=IV.notes.map(n=>'• '+n);g.rdv=g.rdv.filter(r=>r!==rdv);
 const done=(txt,hired)=>{MW.closePanel();ivLeave(hired);MW.toast(txt,hired?'good':'info');};
 if(dec==='hire'){const pl=plancher(cv),off=IV.offre||cv.pret;
  const ailleurs=rnd()<.08,ok=off>=pl*.98&&IV.mood>=25&&!ailleurs;
  if(ok){api.hire(zid,cv.id,off);done(`${cv.nom} est embauché(e) comme ${POSTES[cv.poste].nom.toLowerCase()} à ${fmt(off)} brut par mois. Il/elle commence tout de suite.`,true);return;}
  cv.statut='refuse';const why=ailleurs?"a trouvé un autre poste entre-temps":off<pl*.98?'juge le salaire insuffisant':"n'a pas aimé l'entretien";
  done(`${cv.nom} décline l'offre : ${why}.`,false);}
 else if(dec==='keep'){cv.statut='garde';done(`${cv.nom} est mis(e) de côté.`,false);}
 else{cv.statut='rejete';done(`Candidature de ${cv.nom} refusée.`,false);}}
/* scène : le joueur se place face au candidat assis derrière le bureau */
let SAVE=null;
api.interview=(zid,rdvId)=>{const g=G(zid),rdv=g.rdv.find(r=>r.id===rdvId);if(!rdv) return false;const cv=g.cv.find(c=>c.id===rdv.cv);if(!cv) return false;
 const z=zn(zid);if(!z) return false;
 if(rdv.etat!=='arrive') return false;
 const pl=MW.player();SAVE={x:pl.x,z:pl.z,ry:pl.ry};
 const hx=z._d.w/2,spot=z.loc(hx-6.4,3.7),face=z.ry+PI;
 MW.teleport(spot.x,spot.z,face,-.42); /* regard légèrement plongeant : le candidat reste visible au-dessus du panneau de dialogue */
 IV={zid,cv,rdv,step:0,mood:50+Math.round((pc(cv,'courtoisie')-.5)*10),notes:[],log:[],ann:(g.ann.find(a=>a.poste===cv.poste)||{}).salaire,offre:null,contre:null,puppet:null};
 const pup=PUP.candidat(zid,rdv);if(pup){pup.sit();IV.puppet=pup.p;}
 ivRender("Le/la candidat(e) s'assoit en face de vous, un dossier à la main.");return true;};
function ivLeave(hired){const pw=document.querySelector('.mw-pw');if(pw) pw.classList.remove('emp-dlg');if(SAVE){MW.teleport(SAVE.x,SAVE.z,SAVE.ry,0);SAVE=null;}
 if(IV&&IV.rdv) PUP.candidatPart(IV.rdv,hired);IV=null;}
/* ═══ embauche, licenciement, gestion ═══ */
api.hire=(zid,cvId,sal)=>{const g=G(zid),cv=g.cv.find(c=>c.id===cvId);if(!cv) return null;
 const e={id:sid(),nom:cv.nom,age:cv.age,poste:cv.poste,sk:Object.assign({},cv.vrai),xp:{},perso:cv.perso,ap:cv.ap,salaire:Math.round(sal||cv.pret),jour:MW.S.day,humeur:70,fatigue:0,motiv:Math.round(50+cv.perso.motiv*35),
  etat:'libre',ph:'libre',car:null,plan:null,absent:0,due:0,stats:{voitures:0,note:0,ca:0,erreurs:0},demande:null,bas:0,dest:null,idx:g.staff.length};
 g.staff.push(e);cv.statut='embauche';g.rdv=g.rdv.filter(r=>r.cv!==cvId);
 if(typeof MWS!=='undefined') MWS.ensure(zid);return e;};
api.fire=(zid,id)=>{const g=G(zid),e=g.staff.find(x=>x.id===id);if(!e) return false;
 const ind=e.salaire;if(typeof MWS!=='undefined'&&MWS.get(zid)) MWS.charge(zid,ind,`Indemnité de licenciement : ${e.nom}`);
 releaseCar(zid,e);e.etat='parti';PUP.drop(e.id);g.staff=g.staff.filter(x=>x!==e);MW.toast(`${e.nom} est licencié(e) (indemnité : ${fmt(ind)}).`,'info');return true;};
function marche(e){return Math.round(POSTES[e.poste].sal*(1+.03*Math.max(0,Math.max(...Object.values(e.sk))-2)));}
function equipePanel(zid){const g=G(zid),l=staffOf(zid),sol=typeof MWS!=='undefined'?MWS.solde(zid):0;
 const tot=l.reduce((a,e)=>a+e.salaire,0);
 let h=`<p class="hint">Compte du garage : <b>${fmt(sol)}</b> · masse salariale : ${fmt(tot)}/mois brut (+ ${Math.round(TAXP*100)} % de charges, prélevée chaque semaine).</p>`;
 const j=g.jour,moy=j.notes.length?r2(j.notes.reduce((a,b)=>a+b,0)/j.notes.length):0;
 h+=`<div class="mw-card"><b>Aujourd'hui</b> : ${j.d===dayEff()?j.n:0} voiture${j.n>1?'s':''} rendue${j.n>1?'s':''} · chiffre d'affaires ${fmt(j.d===dayEff()?j.ca:0)}${moy?' · note moyenne '+moy+'/5':''}</div>`;
 h+=l.map(e=>{const P=POSTES[e.poste],dem=e.demande;
  return `<div class="emp-cv">${av(e.ap)}<div class="emp-cv-b"><b>${esc(e.nom)}</b> · ${esc(P.nom)} · ${fmt(e.salaire)}/mois <span class="emp-tag${e.etat==='absent'?' warn':''}">${esc(etatTxt(e))}</span><div class="emp-sk">${topSk(e.sk,3).map(k=>`<span>${esc(CNOM[k])} ${bar(e.sk[k])}<b>${Math.floor(e.sk[k])}</b></span>`).join('')}</div>
  <small>Humeur ${bar(e.humeur,100)} ${Math.round(e.humeur)} · Fatigue ${bar(e.fatigue,100)} ${Math.round(e.fatigue)} · Motivation ${bar(e.motiv,100)} ${Math.round(e.motiv)}<br>${e.stats.voitures} voiture${e.stats.voitures>1?'s':''} · ${e.stats.voitures?'note '+r2(e.stats.note/e.stats.voitures)+'/5':'pas encore de note'} · ${e.stats.erreurs} erreur${e.stats.erreurs>1?'s':''}</small>
  ${dem?`<p class="mw-soon">Demande une augmentation : ${fmt(dem.salaire)} brut/mois.</p>`:''}<div class="mw-btns">${dem?btn('ok:'+e.id,'Accepter l\'augmentation')+btn('no:'+e.id,'Refuser','ghost'):''}${btn('raise:'+e.id,'+5 %','ghost')}${btn('fire:'+e.id,'Licencier','ghost')}</div></div></div>`;}).join('')||'<p class="hint">Personne dans l\'équipe pour l\'instant : publiez une annonce.</p>';
 h+=`<div class="mw-btns">${btn('menu','Retour au menu','ghost')}</div>`;
 MW.panel('Équipe · '+nomLieu(zid),h,{wide:true,onClick:a=>{const [k,i]=a.split(':'),e=g.staff.find(x=>x.id===i);
  if(k==='menu') return api.menu(zid);
  if(k==='ok'&&e&&e.demande){e.salaire=e.demande.salaire;e.demande=null;e.humeur=Math.min(100,e.humeur+12);e.motiv=Math.min(100,e.motiv+8);MW.toast(`${e.nom} est content(e) de l'augmentation.`,'good');}
  else if(k==='no'&&e){e.demande=null;e.humeur=Math.max(0,e.humeur-6);}else if(k==='raise'&&e){e.salaire=Math.round(e.salaire*1.05/10)*10;e.humeur=Math.min(100,e.humeur+5);}
  else if(k==='fire'&&e){MW.panel('Licencier ?',`<p>Licencier ${esc(e.nom)} ? Indemnité : ${fmt(e.salaire)} prélevés sur le compte du garage.</p><div class="mw-btns">${btn('yes','Licencier')}${btn('back','Annuler','ghost')}</div>`,{onClick:b=>{if(b==='yes') api.fire(zid,e.id);equipePanel(zid);}});return;}
  equipePanel(zid);}});}
const etatTxt=e=>e.etat==='absent'?`absent(e) (maladie, ${Math.max(1,e.absent-MW.S.day)} j)`:e.ph==='libre'?(POSTES[e.poste].accueil?'à l\'accueil':'disponible'):e.ph==='pause'?'en pause':e.ph==='attente'?'attend une pièce':'au travail';
function annoncePanel(zid,po,sal){const g=G(zid);po=po||'mecanicien';const P=POSTES[po];sal=sal||(P.sal);
 let h=`<p class="hint">Une annonce coûte ${fmt(FRAIS_ANN)} (compte du garage) et reste en ligne 21 jours. Plus le salaire est élevé, plus les CV sont nombreux et bons. Salaire de référence : ${fmt(P.sal)}.</p><div class="mw-btns">${Object.keys(POSTES).map(k=>btn('p:'+k,esc(POSTES[k].nom),k===po?'':'ghost')).join('')}</div>`;
 h+=`<div class="mw-card"><b>${esc(P.nom)}</b> · salaire proposé : <b>${fmt(sal)}</b> brut/mois<div class="mw-btns">${btn('s:-100','−100','ghost')}${btn('s:-300','−300','ghost')}${btn('s:100','+100','ghost')}${btn('s:300','+300','ghost')}${btn('pub','Publier l\'annonce')}</div></div>`;
 h+=g.ann.length?'<p><b>Annonces en ligne</b></p>'+g.ann.map(a=>`<div class="mw-row"><span>${esc(POSTES[a.poste].nom)} · ${fmt(a.salaire)} · jusqu'au jour ${a.fin}</span>${btn('w:'+a.id,'Retirer','ghost')}</div>`).join(''):'<p class="hint">Aucune annonce en ligne.</p>';
 h+=`<div class="mw-btns">${btn('menu','Retour au menu','ghost')}</div>`;
 MW.panel('Recruter · '+nomLieu(zid),h,{wide:true,onClick:a=>{const [k,i]=a.split(':');
  if(k==='p') return annoncePanel(zid,i,POSTES[i].sal);if(k==='s') return annoncePanel(zid,po,Math.max(600,sal+(+i)));
  if(k==='pub'){const r=api.publish(zid,po,sal);MW.toast(r.ok?`Annonce publiée : ${P.nom} à ${fmt(sal)}. Les premiers CV arrivent demain matin.`:r.why,r.ok?'good':'warn');return annoncePanel(zid,po,sal);}
  if(k==='w'){api.withdraw(zid,i);return annoncePanel(zid,po,sal);}if(k==='menu') api.menu(zid);}});}
function rdvPanel(zid){const g=G(zid);
 let h=g.rdv.length?g.rdv.map(r=>{const c=g.cv.find(x=>x.id===r.cv);if(!c) return '';const arrive=r.etat==='arrive';
  return `<div class="emp-cv">${av(c.ap)}<div class="emp-cv-b"><b>${esc(c.nom)}</b> · ${esc(POSTES[c.poste].nom)}<br><small>${arrive?'<b>Est arrivé(e) : il/elle vous attend au bureau.</b>':'Attendu(e) '+esc(dueTxt(r.due))}</small><div class="mw-btns">${btn('go:'+r.id,'Commencer l\'entretien','',!arrive)}${btn('cx:'+r.id,'Annuler le rendez-vous','ghost')}</div></div></div>`;}).join(''):'<p class="hint">Aucun entretien prévu : convoquez un candidat depuis la liste des CV.</p>';
 h+=`<div class="mw-btns">${btn('menu','Retour au menu','ghost')}</div>`;
 MW.panel('Entretiens · '+nomLieu(zid),h,{wide:true,onClick:a=>{const [k,i]=a.split(':');
  if(k==='go'){MW.closePanel();api.interview(zid,i);return;}
  if(k==='cx'){const r=g.rdv.find(x=>x.id===i);if(r){const c=g.cv.find(x=>x.id===r.cv);if(c) c.statut='lu';g.rdv=g.rdv.filter(x=>x!==r);PUP.candidatPart(r,false);}return rdvPanel(zid);}if(k==='menu') api.menu(zid);}});}
const dueTxt=due=>{const d=Math.floor(due/1440),m=due%1440,h=Math.floor(m/60);return (d===dayEff()?"aujourd'hui":d===dayEff()+1?'demain':'jour '+d)+' à '+h+' h'+(m%60?' '+String(m%60).padStart(2,'0'):'');};
api.menu=zid=>{if(!api.canManage(zid)) return typeof MWST!=='undefined'&&MWST.site(zid);
 const g=G(zid),nc=g.cv.filter(c=>c.statut==='nouveau').length,arr=g.rdv.filter(r=>r.etat==='arrive').length;
 const h=`<p>Bureau de <b>${esc(nomLieu(zid))}</b> · équipe : ${staffOf(zid).length} · annonces : ${g.ann.length} · CV : ${g.cv.filter(c=>c.statut!=='rejete'&&c.statut!=='embauche').length}${nc?` (${nc} nouveau${nc>1?'x':''})`:''}.</p>${arr?`<p class="mw-soon">Un candidat vous attend pour son entretien !</p>`:''}<div class="mw-btns v">${btn('pieces','Commander des pièces (Pièces Auto Express)')}${btn('ann','Recruter : publier une annonce')}${btn('cv','Trier les CV'+(nc?' ('+nc+' nouveaux)':''),'')}${btn('rdv','Entretiens ('+g.rdv.length+')','')}${btn('eq','Mon équipe',staffOf(zid).length?'':'ghost')}${btn('close','Fermer','ghost')}</div>`;
 MW.panel('Ordinateur du bureau · '+nomLieu(zid),h,{wide:true,onClick:a=>{if(a==='pieces') MWST.site(zid);else if(a==='ann') annoncePanel(zid);else if(a==='cv') cvPanel(zid);else if(a==='rdv') rdvPanel(zid);else if(a==='eq') equipePanel(zid);else MW.closePanel();}});};
/* ═══ salaires, humeur, absences (chaque matin) ═══ */
api.dayStep=()=>{if(guest()) return;for(const zid of owned()){const g=G(zid);arrivals(zid);
  const d=MW.S.day,l=staffOf(zid);
  if(l.length&&typeof MWS!=='undefined'&&MWS.ensure(zid)){
   for(const e of l) e.due=r2((e.due||0)+e.salaire/30);
   if(d%7===0){let tot=0;for(const e of l){tot+=Math.round(e.due*(1+TAXP));e.due=0;}
    if(tot>0){MWS.charge(zid,tot,`Salaires de la semaine (${l.length} employé${l.length>1?'s':''}, charges comprises)`);MW.toast(`${nomLieu(zid)} : salaires payés par le compte du garage (${fmt(tot)}).`,'info');
     if(MWS.solde(zid)<0){MW.toast(`Le compte de ${nomLieu(zid)} est à découvert : l'équipe s'inquiète.`,'warn');for(const e of l) e.humeur=Math.max(0,e.humeur-10);}}}}
  for(const e of l.slice()){
   if(e.etat==='absent'){if(d>=e.absent){e.etat='libre';e.ph='libre';MW.toast(`${e.nom} est de retour.`,'info');}continue;}
   const ratio=e.salaire/marche(e),note=g.jour.notes.length?g.jour.notes.reduce((a,b)=>a+b,0)/g.jour.notes.length:3.5;
   e.humeur=clamp(e.humeur+clamp((ratio-1)*22,-7,5)+(e.motiv-50)/30+(note>=4?2:note<=2?-3:0)-(e.fatigue>70?3:0)+(rnd()-.5)*3,0,100);
   e.fatigue=Math.max(0,e.fatigue-50);e.motiv=clamp(e.motiv+(e.humeur-50)/25,0,100);
   if(e.demande&&d-e.demande.jour>10){e.humeur=Math.max(0,e.humeur-7);}
   if(!e.demande&&e.humeur<50&&d-e.jour>10&&rnd()<.25&&e.salaire<marche(e)*1.35){e.demande={salaire:Math.round(e.salaire*1.1/10)*10,jour:d};MW.toast(`${e.nom} demande une augmentation (${fmt(e.demande.salaire)} brut/mois) : voir l'équipe.`,'warn');}
   if(e.humeur<18) e.bas=(e.bas||0)+1;else e.bas=0;
   if(e.bas>=2||(e.demande&&d-e.demande.jour>16&&e.humeur<30)){MW.toast(`${e.nom} démissionne de ${nomLieu(zid)}.`,'crit');releaseCar(zid,e);e.etat='parti';PUP.drop(e.id);g.staff=g.staff.filter(x=>x!==e);continue;}
   if(rnd()<.03){e.etat='absent';e.absent=d+rint(1,3);releaseCar(zid,e);MW.toast(`${e.nom} est malade et ne viendra pas ${e.absent-d>1?'pendant '+(e.absent-d)+' jours':'aujourd\'hui'}.`,'info');}}
  g.hist.unshift({d:d-1,n:g.jour.n,ca:r2(g.jour.ca),note:g.jour.notes.length?r2(g.jour.notes.reduce((a,b)=>a+b,0)/g.jour.notes.length):0});while(g.hist.length>14) g.hist.pop();
  g.jour={d:dayEff(),n:0,ca:0,notes:[]};
  /* le chef d'atelier réapprovisionne les pièces courantes (compte du garage) */
  if(l.some(e=>POSTES[e.poste].chef&&e.etat!=='absent')&&typeof MWST!=='undefined'){const need={};
   for(const p of MWJ.PARTS_LIST) if(MWST.common(p.id)&&MWST.qty(zid,p.id)+MWST.pendQty(zid,p.id)<2) need[p.id]=2;
   if(Object.keys(need).length) MWST.order(zid,need,'next',{payer:'biz'});}}};
/* ═══ le travail : une minute de simulation ═══ */
function capable(e,c){for(const id of workIds(c)){const p=MWJ.PARTS[id];if(!p) continue;if(Math.floor(e.sk[p.comp]||0)<p.niv) return false;}
 if(c.symp&&Math.floor(e.sk.diagnostic||0)<(c.symp.dn||1)) return false;return true;}
const workIds=c=>{const l=c.ordre.slice();if(c.symp){const y=MWJ.symDef(c);const ids=[c.symp.c].concat(y&&y.ch||[]);for(const id of ids) if(!l.includes(id)&&c.parts[id]&&!c.parts[id].na) l.push(id);}return l.filter(id=>!c.done[id]);};
function mk(zid,e,c){ /* plan d'un travail : suite d'étapes {k, to, min, pose, id…} */
 const z=zn(zid),ids=workIds(c),st=[],i=c.pont,Z=id=>MWJ.PARTS[id].zone;
 const P=POSTES[e.poste],chef=staffOf(zid).some(x=>POSTES[x.poste].chef&&x.etat!=='absent'&&x!==e),sp=clamp((P.vit||1)*(chef?1.1:1)*(1+(e.motiv-50)/400),.6,1.5);
 st.push({k:'walk',to:'shelf'},{k:'take',ids},{k:'walk',to:'side',i});
 if(c.symp) st.push({k:'diag',to:'capot',i,min:Math.max(8,Math.round(20/(1+(e.sk.diagnostic||0)/10))),pose:'capot'});
 const cap=ids.filter(id=>Z(id)==='capot'),sous=ids.filter(id=>Z(id)==='dessous'),roue=ids.filter(id=>Z(id)==='roue'),cab=ids.filter(id=>Z(id)==='cabine');
 const dur=id=>{const p=MWJ.PARTS[id],m=(e.sk[p.comp]||0)-p.niv;return Math.max(4,Math.round(p.mo*clamp(1.2-m*.06,.6,1.4)/sp));};
 if(cap.length){st.push({k:'capot',to:'capot',i,min:1,pose:'capot',on:1});for(const id of cap) st.push({k:'part',id,to:'capot',i,min:dur(id),pose:'capot'});st.push({k:'capot',to:'capot',i,min:1,pose:'capot',on:0});}
 if(roue.length||sous.length) st.push({k:'lift',to:'side',i,min:3,pose:'idle',on:1});
 if(roue.length){const ax=new Set(roue.map(id=>MWJ.PARTS[id].ax));const av=ax.has('av')||ax.has('*'),ar=ax.has('ar')||ax.has('*');
  st.push({k:'roues',to:'wheel',i,min:5,pose:'roue',av:av?1:0,ar:ar?1:0,on:1});for(const id of roue) st.push({k:'part',id,to:'wheel',i,min:dur(id),pose:'roue'});st.push({k:'roues',to:'wheel',i,min:5,pose:'roue',on:0});}
 for(const id of sous) st.push({k:'part',id,to:'under',i,min:dur(id),pose:'dessous'});
 if(roue.length||sous.length) st.push({k:'lift',to:'side',i,min:3,pose:'idle',on:0});
 for(const id of cab) st.push({k:'part',id,to:'side',i,min:dur(id),pose:'capot'});
 st.push({k:'fin',to:'side',i,min:2,pose:'idle'});return st;}
function releaseCar(zid,e){const c=e.car&&MWJ.jobs().find(x=>x.id===e.car);if(c){c.empl=null;if(c.st){c.st.capot=0;}}e.car=null;e.plan=null;e.ph='libre';e.dest=null;}
const sync=c=>{try{if(MWJ.L.hasMesh(c)) MWJ.L.applyVisual(c);}catch(e){}};
function stepEffect(zid,e,c,s){const z=zn(zid);
 if(s.k==='capot'){c.st.capot=s.on?1:0;sync(c);}
 else if(s.k==='lift'){c.st.lifted=s.on?1:0;sync(c);}
 else if(s.k==='roues'){if(s.on){if(s.av) c.st.av=1;if(s.ar) c.st.ar=1;}else{c.st.av=0;c.st.ar=0;}sync(c);}
 else if(s.k==='part'){c.rem[s.id]=1;c.done[s.id]=1;c.parts[s.id].u=0;const x=(e.carry||[]).indexOf(s.id);if(x>=0) e.carry.splice(x,1);}}
function finishCar(zid,e,c){const g=G(zid);
 const ids=c.ordre.concat(c.symp?[c.symp.c]:[]);let err=null;
 const pe=clamp(.22-.026*((e.sk.entretien+e.sk.moteur)/2)+.1*(e.perso.stress)+e.fatigue/450-(staffOf(zid).some(x=>POSTES[x.poste].chef&&x!==e&&x.etat!=='absent')?.06:0),.02,.4);
 if(rnd()<pe){if(rnd()<.5&&ids.length){const id=ids[ids.length-1];if(c.done[id]){delete c.done[id];err='oublie';e.errTxt=`${e.nom} a oublié de remonter : ${MWJ.PARTS[id].nom.toLowerCase()}.`;}}
  else{const ex=MWJ.PARTS_LIST.find(p=>!c.done[p.id]&&!ids.includes(p.id)&&c.parts[p.id]&&!c.parts[p.id].na&&p.zone==='capot'&&p.niv<=1&&p.id!=='ampoules');if(ex){c.done[ex.id]=1;err='inutile';e.errTxt=`${e.nom} a changé une pièce inutile (${ex.nom.toLowerCase()}).`;}}}
 c.st.capot=0;c.st.lifted=0;c.st.av=0;c.st.ar=0;sync(c);
 const job=MWJ.done(c);e.car=null;e.plan=null;e.ph='libre';e.dest=null;e.carry=[];
 if(job){e.stats.voitures++;e.stats.note+=job.note;e.stats.ca=r2(e.stats.ca+job.facture);g.jour.n++;g.jour.ca=r2(g.jour.ca+job.facture);g.jour.notes.push(job.note);
  e.humeur=clamp(e.humeur+(job.note>=4?1.5:job.note<=2?-3:0),0,100);
  for(const k of Object.keys(job.competences||{})) e.sk[k]=Math.min(10,(e.sk[k]||0)+Math.min(.12,(job.competences[k]||0)/900)*(e.sk[k]<4?1.5:1));
  if(err){e.stats.erreurs++;MW.toast(`${e.errTxt} Le client est ${job.note<=2?'mécontent':'moins satisfait'}.`,'warn');}
  else if(job.note>=5&&api.near(zid)) MW.toast(`${e.nom} rend la ${job.voiture} : client ravi (${fmt(job.facture)}).`,'good');}}
function takeParts(zid,e,c,s){const miss=[];e.carry=e.carry||[];
 for(const id of s.ids){if(!c.parts[id]||c.parts[id].na) continue;if(e.carry.includes(id)) continue;if(typeof MWST==='undefined'||MWST.take(zid,id)) e.carry.push(id);else miss.push(id);}
 if(!miss.length) return true;
 for(const id of e.carry){if(typeof MWST!=='undefined') MWST.add(zid,id,1);}e.carry=[];
 let due=0;if(typeof MWST!=='undefined'){const r=MWST.orderFor(zid,miss,{payer:'biz'});if(r.ord) due=r.ord.due;else{const pe=MWST.pending(zid).filter(o=>miss.some(id=>o.items[id])).sort((a,b)=>a.due-b.due)[0];if(pe) due=pe.due;}}
 if(due){c.attendLivraison=due;MW.toast(`${e.nom} attend une pièce (${miss.map(id=>MWJ.PARTS[id].nom.toLowerCase()).join(', ')}) : livraison ${dueTxt(due)}.`,'info');}
 else{c.attendLivraison=absT()+240;if(!e.alerte||MW.S.day-e.alerte>1){e.alerte=MW.S.day;MW.toast(`${nomLieu(zid)} : pièce manquante (${miss.map(id=>MWJ.PARTS[id].nom.toLowerCase()).join(', ')}) et le compte ne permet pas de la commander.`,'warn');}}
 c.empl=null;e.car=null;e.plan=null;e.ph='libre';return false;}
function tickWorker(zid,e,z){
 const open=isOpen();
 if(e.etat==='absent'){e.ph='libre';return;}
 if(!open){if(e.car) {/* fin de journée : la voiture attend demain */const c=MWJ.jobs().find(x=>x.id===e.car);if(c){c.empl=null;}e.car=null;e.plan=null;}e.ph='libre';e.fatigue=Math.max(0,e.fatigue-.2);return;}
 if(!e.car||!e.plan){ /* pause déjeuner */
  const m=MW.S.min;if(m>=750&&m<810&&!e.car){e.ph='pause';return;}
  const cars=MWJ.jobs().filter(c=>c.zone===zid&&c.staff&&!c.empl&&!(c.attendLivraison>absT())&&capable(e,c)).sort((a,b)=>a.arrive-b.arrive);
  if(!cars.length){e.ph='libre';return;}
  const c=cars[0];c.empl=e.id;e.car=c.id;e.plan=mk(zid,e,c);e.si=0;e.ph='travaille';e.dest=null;return;}
 const c=MWJ.jobs().find(x=>x.id===e.car);if(!c){e.car=null;e.plan=null;e.ph='libre';return;}
 const s=e.plan[e.si];if(!s){finishCar(zid,e,c);return;}
 e.fatigue=Math.min(100,e.fatigue+.12);
 if(s.k==='walk'){ /* marche : la durée suit la distance */
  if(!s.init){s.init=1;const from=e.pos||stationOf(z,'rest',e.idx),to=stationOf(z,s.to,s.i);const path=routeTo(z,from,to);s.len=pathLen(path);s.min=Math.max(1,Math.ceil(s.len/2.2));s.to2=to;PUP.go(e,path);s.t=0;}
  s.t++;if(s.t>=s.min){e.pos=s.to2;PUP.arrive(e);e.si++;}return;}
 if(s.k==='take'){if(!takeParts(zid,e,c,s)) return;e.si++;return;}
 /* étapes sur place : se rendre à la station, puis travailler */
 if(!s.init){s.init=1;s.t=0;const to=stationOf(z,s.to,s.i,{s:1,fb:1}),from=e.pos||stationOf(z,'rest',e.idx);s.to2=to;
  if(Math.hypot(from.x-to.x,from.z-to.z)>.6){const path=routeTo(z,from,to);PUP.go(e,path);s.wait=Math.max(1,Math.ceil(pathLen(path)/2.2));}else s.wait=0;
  PUP.pose(e,s.pose,s.to,s.i);}
 if(s.wait>0){s.wait--;if(s.wait===0){e.pos=s.to2;PUP.arrive(e);PUP.pose(e,s.pose,s.to,s.i);}return;}
 if(!s.arr){s.arr=1;e.pos=s.to2;PUP.arrive(e);PUP.pose(e,s.pose,s.to,s.i);}
 s.t++;if(s.t>=s.min){stepEffect(zid,e,c,s);e.si++;if(s.k==='diag'&&c.symp) c.insp[c.symp.c]=1;}}
function tickReception(zid,e,z){if(e.etat==='absent'||!isOpen()){e.ph='libre';e.pos=null;PUP.pose(e,'idle','rest',e.idx);return;}
 e.ph='libre';const to=stationOf(z,'reception');if(!e.pos||Math.hypot(e.pos.x-to.x,e.pos.z-to.z)>.6){const path=routeTo(z,e.pos||stationOf(z,'rest',e.idx),to);e.dest={path,to};PUP.go(e,path);e.pos=to;}
 PUP.pose(e,'clavier','reception');e.fatigue=Math.min(100,e.fatigue+.04);}
/* clients des garages tenus par des employés */
function clients(zid,z){const g=G(zid),l=staffOf(zid),w=l.filter(e=>POSTES[e.poste].work&&e.etat!=='absent');if(!w.length||!isOpen()||absT()<g.next) return;
 const cars=MWJ.jobs().filter(c=>c.zone===zid&&c.staff);const lim=Math.min(z.ponts.length,w.length+1);
 const rec=l.some(e=>POSTES[e.poste].accueil&&e.etat!=='absent'),r=(MWJ.RYTHME&&MWJ.RYTHME[zid])||[10,24];
 g.next=absT()+Math.max(6,Math.round(rint(r[0],r[1])*(rec?.8:1.1)*(1-clamp((MW.S.rep||0)/260,0,.3))/Math.sqrt(w.length)));
 if(cars.length>=lim) return;
 const lvf=c=>api.level(zid,c),cap=Math.max(1,...w.map(e=>Math.floor(Math.max(...WORKC.map(k=>e.sk[k]||0)))));
 const near=api.near(zid);
 const c=MWJ.spawn({emp:{id:'staff',zone:zid,niveauxAutorises:Math.min(cap,5),lvf},staff:true,silencieux:true,rend:false,nomesh:!near});
 if(c&&rec&&near) MW.toast(`${nomLieu(zid)} : la réceptionniste accueille ${c.client} (${c.marque} ${c.modele}).`,'info');}
function patience(zid){for(const c of MWJ.jobs().slice()) if(c.staff&&c.zone===zid&&MWJ.openT()-c.ot0>2200){MWJ.remove(c,true);MW.S.rep=clamp(r2((MW.S.rep||0)-2),0,100);MW.toast(`${c.client} a repris sa ${c.marque} ${c.modele} : trop d'attente chez ${nomLieu(zid)}.`,'warn');}}
api.tickMin=()=>{if(!MW.S||guest()) return;
 for(const zid of owned()){const g=G(zid),z=zn(zid);if(!z||!z.ponts) continue;if(!g.staff.length&&!g.rdv.length) continue;
  for(const e of staffOf(zid)){if(POSTES[e.poste].accueil) tickReception(zid,e,z);else tickWorker(zid,e,z);}
  clients(zid,z);patience(zid);
  /* rendez-vous */
  for(const r of g.rdv.slice()){const c=g.cv.find(x=>x.id===r.cv);if(!c){g.rdv=g.rdv.filter(x=>x!==r);continue;}
   if(r.etat==='att'&&absT()>=r.due){if(c.perso.ponct<.3&&rnd()<.3){c.statut='rejete';g.rdv=g.rdv.filter(x=>x!==r);MW.toast(`${c.nom} ne s'est pas présenté(e) à l'entretien.`,'warn');continue;}
    r.etat='arrive';r.arr=absT();PUP.candidat(zid,r);MW.toast(`${c.nom} est arrivé(e) pour l'entretien à ${nomLieu(zid)} : rendez-vous à l'ordinateur du bureau.`,'good');}
   else if(r.etat==='arrive'&&absT()-r.arr>150&&!(IV&&IV.rdv===r)){c.statut='lu';g.rdv=g.rdv.filter(x=>x!==r);PUP.candidatPart(r,false);MW.toast(`${c.nom} est reparti(e) : vous l'avez fait attendre.`,'warn');}}}
 PUP.vis();};
/* ═══ personnages visibles : création, marche, postures ═══ */
const PUPS={},CANDS={};
const nearTo=zid=>{const z=zn(zid),p=MW.player();if(!z||!p) return false;return Math.abs(p.x-z.x)<z._d.w/2+60&&Math.abs(p.z-z.z)<z._d.d/2+60;};
api.near=nearTo;
const PUP={
 get(e,z){let o=PUPS[e.id];if(!o){const p=MWPUP.make(e.ap,{tenue:'travail'});MW.scene.add(p.g);o=PUPS[e.id]={p,path:null,idx:0,pose:'idle',face:0,zid:z.id};}return o;},
 go(e,path){const o=PUPS[e.id];if(o){o.path=path.slice();o.idx=0;o.pose='walk';}},
 arrive(e){const o=PUPS[e.id];if(o&&o.path&&o.path.length){const l=o.path[o.path.length-1];o.p.place(l.x,l.z);o.path=null;o.pose='idle';}},
 pose(e,pose,to,i){const o=PUPS[e.id];if(!o) return;o.want=pose;if(!o.path){const z=zn(o.zid);o.pose=pose==='idle'?'idle':pose;if(z&&(to==='capot'||to==='under'||to==='wheel'||to==='side')){const p=z.ponts[i];if(p) o.face=Math.atan2(p.x-o.p.g.position.x,p.z-o.p.g.position.z);}else if(to==='reception'&&z) o.face=z.ry;}},
 drop(id){const o=PUPS[id];if(o){o.p.dispose();delete PUPS[id];}},
 candidat(zid,r){let o=CANDS[r.id];if(o) return o;const g=G(zid),cv=g.cv.find(c=>c.id===r.cv),z=zn(zid);if(!cv||!z||!MW.scene) return null;
  const p=MWPUP.make(cv.ap,{tenue:'ville'});MW.scene.add(p.g);const from=stationOf(z,'outside'),seat=stationOf(z,'seat');
  const hx=z._d.w/2,path=[from,z.loc(0,1.0),z.loc(hx-6.4-1.5,1.0),seat];
  o=CANDS[r.id]={p,r,zid,path:null,pose:'idle',face:z.ry,sitting:false,out:false};
  if(nearTo(zid)&&!IV){p.place(from.x,from.z,z.ry);o.path=path;o.pose='walk';o.thenSit=1;}else{p.place(seat.x,seat.z,z.ry);o.pose='assis';o.sitting=true;}
  o.sit=()=>{o.path=null;p.place(seat.x,seat.z,z.ry);o.sitting=true;o.pose='assis';};return {p,sit:o.sit};},
 candidatPart(r,hired){const o=CANDS[r.id];if(!o) return;const z=zn(o.zid);if(!z||hired||!nearTo(o.zid)){o.p.dispose();delete CANDS[r.id];return;}
  o.sitting=false;o.pose='walk';o.out=true;o.path=[stationOf(z,'seat'),z.loc(((z._d.w/2)-6.4)-1.5,1.0),z.loc(0,1.0),stationOf(z,'outside')];},
 vis(){if(!MW.S||!MW.scene) return;const owned2=owned();
  for(const zid of owned2){const z=zn(zid),g=G(zid),near=nearTo(zid);
   for(const e of staffOf(zid)){if(near){const o=PUP.get(e,z);if(!o.init){o.init=1;const q=e.pos||stationOf(z,POSTES[e.poste].accueil?'reception':'rest',e.idx);o.p.place(q.x,q.z,z.ry);}o.p.g.visible=true;}else if(PUPS[e.id]){PUP.drop(e.id);}}
   for(const c of MWJ.jobs()){if(!c.staff||c.zone!==zid) continue;try{if(near&&!MWJ.L.hasMesh(c)) MWJ.L.buildMesh(c);else if(!near&&MWJ.L.hasMesh(c)) MWJ.L.unmesh(c);}catch(e){}}
   for(const id of Object.keys(CANDS)){const o=CANDS[id];if(o.zid===zid&&!near&&!o.out){}}}
  for(const id of Object.keys(PUPS)){const o=PUPS[id];if(!owned2.includes(o.zid)||!MWJ&&0){PUP.drop(id);}}},
 frame(dt){
  const stepP=(o,spd)=>{if(!o.path||!o.path.length){return;}const g=o.p.g.position;let tgt=o.path[o.idx||0];if(!tgt){o.path=null;return;}
   const dx=tgt.x-g.x,dz=tgt.z-g.z,d=Math.hypot(dx,dz);if(d<.08){o.idx=(o.idx||0)+1;if(o.idx>=o.path.length){o.path=null;o.idx=0;o.pose=o.sitting?'assis':'idle';if(o.thenSit){o.thenSit=0;o.sitting=true;o.pose='assis';if(o.zid){const z=zn(o.zid),s=stationOf(z,'seat');o.p.place(s.x,s.z,z.ry);}}if(o.out){o.p.dispose();}}return;}
   const k=Math.min(d,spd*dt);g.x+=dx/d*k;g.z+=dz/d*k;o.face=Math.atan2(dx,dz);o.pose=o.pose==='porter'?'porter':'walk';};
  const turn=(o)=>{const r=o.p.g.rotation;let d=o.face-r.y;while(d>PI) d-=2*PI;while(d<-PI) d+=2*PI;r.y+=d*Math.min(1,dt*9);};
  for(const id in PUPS){const o=PUPS[id];stepP(o,1.5);turn(o);o.p.set(o.path?(o.carry?'porter':'walk'):(o.want&&o.want!=='walk'?o.want:'idle'));o.p.update(dt);}
  for(const id in CANDS){const o=CANDS[id];if(o.out&&!o.path){delete CANDS[id];continue;}stepP(o,1.4);turn(o);o.p.set(o.path?'walk':(o.sitting?(IV&&IV.rdv===o.r?'parle':'assis'):'idle'));o.p.update(dt);}}};
/* ═══ à deux : l'hôte envoie les positions, l'invité dessine les mêmes personnages ═══ */
const GH={};
function netSend(){if(!(MW.net&&MW.net.live)||guest()) return;try{const p=[];for(const id in PUPS){const o=PUPS[id],g=o.p.g;p.push({id,x:+g.position.x.toFixed(2),z:+g.position.z.toFixed(2),ry:+g.rotation.y.toFixed(2),po:o.p.pose,ap:o.p.ap});}MWNET.sendTo({t:'stf',p});}catch(e){}}
api.onNet=m=>{if(m.t!=='stf'||!guest()||!MW.scene) return;const seen={};
 for(const q of m.p||[]){seen[q.id]=1;let o=GH[q.id];if(!o){const p=MWPUP.make(q.ap,{tenue:'travail'});MW.scene.add(p.g);o=GH[q.id]={p,x:q.x,z:q.z};}o.x=q.x;o.z=q.z;o.ry=q.ry;o.po=q.po;}
 for(const id in GH) if(!seen[id]){GH[id].p.dispose();delete GH[id];}};
function ghostFrame(dt){for(const id in GH){const o=GH[id],g=o.p.g;g.position.x+=(o.x-g.position.x)*Math.min(1,dt*8);g.position.z+=(o.z-g.position.z)*Math.min(1,dt*8);g.rotation.y=o.ry||0;o.p.set(o.po||'idle');o.p.update(dt);}}
/* ═══ accroches ═══ */
let nt=0;
MW.on('tick',dt=>{if(!MW.S||!MW.scene) return;try{PUP.frame(Math.min(dt,.1));ghostFrame(Math.min(dt,.1));}catch(e){console.error(e);}nt+=dt;if(nt>.25){nt=0;netSend();}});
MW.on('minute',()=>{try{api.tickMin();}catch(e){console.error(e);}});
MW.on('day',()=>{try{api.dayStep();}catch(e){console.error(e);}});
MW.on('start',()=>{try{S();for(const zid of Object.keys(S().g)) for(const e of G(zid).staff){e.pos=null;e.dest=null;if(e.car&&!MWJ.jobs().some(c=>c.id===e.car)){e.car=null;e.plan=null;e.ph='libre';}}}catch(e){console.error(e);}});
api.POSTES=POSTES;api.COMPS=COMPS;api.IVT=IVT;api.cvF=cvF;api.IV=()=>IV;api.PUPS=PUPS;api.CANDS=CANDS;api.stationOf=stationOf;api.routeTo=routeTo;api.fireOK=true;
return api;
})();
window.__mwemp=MWEMP;
