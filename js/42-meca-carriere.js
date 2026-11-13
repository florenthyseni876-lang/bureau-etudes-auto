'use strict';
/* ───────────── Mode « Mécanicien » — CARRIÈRE (compétences, employeurs, diplômes, ingénieur, banque, marque) ─────────────
   S'appuie sur l'objet `MW` du socle (js/40-meca-monde.js) et, s'il est présent, sur `MWJ` (js/41-meca-travaux.js).
   Données sauvegardées : MW.S.career (créé à 'start'), plus MW.S.xp[comp] et MW.S.rep (gérés par 41 / le socle).

   ═══ Objet global `MWC` ═══
   MWC.employer()        → {id, nom, lieu, zone ('garage1'…'garage4' ou null), salaire, paie:'tache'|'mois', part, mois, niveauxAutorises, loyer}
                           salaire = montant mensuel pour la paie au mois, sinon la part de main-d'œuvre (0..1) ; id parmi
                           aucun, apprenti, meca, patron, ventoux, aurele, brivio, ing, fondateur.
   MWC.canDo(partId)     → vrai si le poste ET le niveau de compétence permettent de poser cette pièce (vrai si inconnu)
   MWC.payFor(job)       → montant pour le joueur à la remise d'une voiture (0 si paie au mois)
   MWC.post()            → texte du poste (« Apprenti · Garage du Coin »)
   MWC.level(comp)       → niveau 1..10 ; MWC.COMPS = liste [id, libellé]
   MWC.hire(id)          → embauche directe (outil de test) ; MWC.panel() ouvre le panneau Carrière (touche C)
   MWC.qcm()             → {index de la bonne réponse affichée, n° de question} (outil de test pendant un QCM)
   Événements émis : 'employerChanged'(id), 'missionDone'(mission, note), 'founded'(nom).
   Point d'entrée « fondation » : MWC.startConstructor({co, y, cash, debt}) démarre une carrière constructeur. */
const MWC=(()=>{
const COMPS=[['entretien','Entretien'],['freinage','Freinage'],['liaison','Liaison au sol'],['moteur','Moteur'],['transmission','Transmission'],['electricite','Électricité et électronique'],['diagnostic','Diagnostic']];
const CN={};for(const [k,n] of COMPS) CN[k]=n;
const api={COMPS};
const lvlOf=xp=>Math.min(10,1+Math.floor(Math.sqrt(Math.max(0,xp||0)/50)));
const xpFor=l=>50*(l-1)*(l-1);
function level(c){
 if(typeof MWJ!=='undefined'&&MWJ&&typeof MWJ.level==='function'){try{const v=MWJ.level(c);if(typeof v==='number'&&isFinite(v)) return v;}catch(e){}}
 return lvlOf((MW.S&&MW.S.xp||{})[c]);}
api.level=level;
const fmt=x=>MW.fmt(x);
const rep=()=>MW.S?+MW.S.rep||0:0;
const day=()=>MW.S?MW.S.day:1;

/* ── employeurs ── */
const DIPL={
 cap:{nom:'CAP maintenance des véhicules',cout:600,jours:2,req:{},n:6,min:4},
 bts:{nom:'BTS maintenance des véhicules',cout:2400,jours:5,req:{dipl:'cap',niv:{diagnostic:3,moteur:3}},n:8,min:6},
 ing:{nom:"Diplôme d'ingénieur automobile",cout:9000,jours:10,req:{dipl:'bts',niv:{moteur:5,diagnostic:4}},n:10,min:7}};
const GRADES=[{n:'Ingénieur',mois:3600,need:2},{n:'Ingénieur confirmé',mois:5200,need:3},{n:'Chef de projet',mois:7400,need:3},{n:'Directeur technique',mois:11000,need:0}];
const EMP={
 aucun:{nom:'Sans emploi',lieu:'',zone:null,paie:'tache',part:0,mois:0,niv:0,rang:0},
 apprenti:{nom:'Apprenti',lieu:'Garage du Coin',zone:'garage1',paie:'tache',part:.3,mois:0,niv:2,rang:0},
 meca:{nom:'Mécanicien',lieu:'Garage du Coin',zone:'garage1',paie:'tache',part:.45,mois:0,niv:4,rang:1},
 patron:{nom:'Patron du Garage du Coin',lieu:'Garage du Coin',zone:'garage1',paie:'tache',part:1,net:true,mois:0,niv:10,rang:2,loyer:45},
 ventoux:{nom:'Mécanicien',lieu:'Ventoux Automobiles',zone:'garage2',paie:'mois',part:0,mois:2300,niv:6,rang:2,req:{niv:{entretien:4,freinage:3},rep:25,dipl:'cap'}},
 aurele:{nom:'Mécanicien',lieu:'Maison Aurèle',zone:'garage3',paie:'mois',part:0,mois:3400,niv:8,rang:3,req:{niv:{moteur:5,diagnostic:4,electricite:3},rep:40,dipl:'bts'}},
 brivio:{nom:'Mécanicien',lieu:'Scuderia Brivio',zone:'garage4',paie:'mois',part:0,mois:4600,niv:10,rang:3,req:{niv:{moteur:7,transmission:5,diagnostic:6},rep:60,dipl:'bts'}},
 ing:{nom:'Ingénieur',lieu:'Centre technique',zone:null,paie:'mois',part:0,mois:3600,niv:10,rang:3},
 fondateur:{nom:'Fondateur',lieu:'',zone:null,paie:'tache',part:0,mois:0,niv:10,rang:4}};
const ING_REQ={dipl:'ing',rep:30,niv:{moteur:4}};
const OWN={prix:18000,req:{rep:25,niv:{entretien:4,moteur:3}}};
const ZONE_EMP={garage2:'ventoux',garage3:'aurele',garage4:'brivio'};
const FOUND={capital:2e6,rep:60,niv:{moteur:7}};

function newC(){return {emp:'aucun',grade:0,hired:0,payFrom:0,dipl:{},loans:[],refus:{},form:null,mission:null,qual:0,missions:0,notes:[],
 stats:{jobs:0,paid:0,vid:0,earn:0},lv:{},car:null,founded:null,everMeca:false,t:{}};}
function C(){const s=MW.S;if(!s) return newC();if(!s.career||typeof s.career!=='object') s.career=newC();
 const c=s.career,d=newC();for(const k in d) if(c[k]==null) c[k]=d[k];for(const k in d.stats) if(c.stats[k]==null) c.stats[k]=0;return c;}
api.state=C;

function employer(){
 const c=C(),id=EMP[c.emp]?c.emp:'aucun',e=EMP[id];let nom=e.nom+(e.lieu?' · '+e.lieu:''),mois=e.mois,niv=e.niv;
 if(id==='ing'){const g=GRADES[clamp(c.grade,0,3)];nom=g.n+' · Centre technique';mois=g.mois;}
 if(id==='fondateur') nom='Fondateur de '+(c.founded||'votre marque');
 return {id,nom,lieu:e.lieu,zone:e.zone,salaire:e.paie==='mois'?mois:e.part,paie:e.paie,part:e.part,mois,niveauxAutorises:niv,loyer:e.loyer||0,net:!!e.net,compte:!!e.net,rang:id==='ing'?3+c.grade:e.rang};}
api.employer=employer;
api.post=()=>{const e=employer();return e.nom;};

function partInfo(partId){
 let P=null;try{P=typeof MWJ!=='undefined'&&MWJ&&MWJ.PARTS?MWJ.PARTS[partId]:null;}catch(e){}
 if(!P) return null;
 let comp=null;try{if(typeof MWJ.skillOf==='function') comp=MWJ.skillOf(partId);}catch(e){}
 if(typeof comp!=='string'){for(const f of ['comp','skill','competence','competence_id','c','domaine','dom']) if(typeof P[f]==='string'&&CN[P[f]]){comp=P[f];break;}}
 if(typeof comp!=='string'||!CN[comp]) comp=null;
 let lv=null;for(const f of ['niv','lvl','level','niveau','minLevel','minLvl','lv','req','need']){const v=P[f];
  if(typeof v==='number'){lv=v;break;}if(v&&typeof v==='object'&&typeof v.lvl==='number'){lv=v.lvl;break;}if(v&&typeof v==='object'&&typeof v.niv==='number'){lv=v.niv;break;}}
 return {comp,lv};}
api.canDo=partId=>{
 try{const i=partInfo(partId);if(!i||i.lv==null) return true;
  const e=employer();if(i.lv>e.niveauxAutorises) return false;
  return i.comp?level(i.comp)>=i.lv:true;}catch(err){return true;}};
function netOf(job){
 const f=+job.facture||0,mo=job.mainOeuvre!=null?+job.mainOeuvre:f*.4;
 for(const k of ['coutPieces','coutP','coutAchat','coutAchats']) if(typeof job[k]==='number') return Math.max(0,f-job[k]);
 return Math.max(0,f-.7*Math.max(0,f-mo));}
api.payFor=job=>{
 const e=employer();if(!job||e.paie==='mois') return 0;
 if(e.id==='aucun'||e.id==='fondateur') return 0;
 if(e.net) return Math.round(+job.facture||0); /* pièces déjà payées au magasin */
 const mo=job.mainOeuvre!=null?+job.mainOeuvre:(+job.facture||0)*.4;
 return Math.round(Math.max(0,mo)*e.part);};

/* ── utilitaires d'interface ── */
const btn=(a,l,cls,dis)=>`<button type="button" class="btn${cls?' '+cls:''}" data-mw="${a}"${dis?' disabled':''}>${l}</button>`;
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function checks(req){const o=[],c=C();if(!req) return o;
 if(req.niv) for(const k in req.niv) o.push({ok:level(k)>=req.niv[k],t:`${CN[k]} : niveau ${req.niv[k]}`,now:'vous : '+level(k)});
 if(req.rep!=null) o.push({ok:rep()>=req.rep,t:`Réputation : ${req.rep}`,now:'vous : '+Math.round(rep())});
 if(req.dipl) o.push({ok:!!c.dipl[req.dipl],t:`Diplôme : ${DIPL[req.dipl].nom}`,now:c.dipl[req.dipl]?'obtenu':'à passer'});
 return o;}
const okAll=req=>checks(req).every(x=>x.ok);
const missing=req=>checks(req).filter(x=>!x.ok).map(x=>x.t);
const condHTML=req=>'<ul class="mw-cond">'+checks(req).map(x=>`<li class="${x.ok?'ok':'no'}">${x.ok?'✓':'✗'} ${esc(x.t)} <small>(${esc(x.now)})</small></li>`).join('')+'</ul>';
function lvCheck(){const c=C();let any=false;
 for(const [k,n] of COMPS){const l=level(k),o=c.lv[k];if(o==null){c.lv[k]=l;continue;}if(l>o){c.lv[k]=l;any=true;MW.toast(`Niveau ${l} en ${n.toLocaleLowerCase()} !`,'good');}else if(l<o) c.lv[k]=l;}
 return any;}
function say(t,g){try{MW.toast(t,g);}catch(e){}}

/* ── embauche, promotion, démission ── */
function hire(id){
 const c=C();if(!EMP[id]) return false;
 c.emp=id;c.hired=day();c.payFrom=day();if(id==='meca'||id==='patron'||id==='ventoux'||id==='aurele'||id==='brivio') c.everMeca=true;
 if(id!=='ing') c.mission=null;
 MW.emit('employerChanged',id);refresh();return true;}
api.hire=hire;
function resign(){const c=C();c.emp='aucun';c.mission=null;MW.emit('employerChanged','aucun');refresh();}
function promoCheck(){const c=C();
 if(c.emp==='apprenti'&&c.stats.jobs>=4&&level('entretien')>=3){hire('meca');say('Le patron vous nomme mécanicien : vous êtes payé davantage et on vous confie des travaux plus délicats.','good');}}

/* ── objectifs ── */
function longGoals(){const c=C(),e=employer(),g=[];if(c.emp==='fondateur') return g;
 const sat=id=>c.emp===id;
 if(e.id==='aucun'&&!c.everMeca) g.push({id:'g_emb',titre:'Se faire embaucher au Garage du Coin',manque:['Présentez-vous au comptoir d\'accueil'],zone:'garage1'});
 if(c.emp==='apprenti') g.push({id:'g_meca',titre:'Devenir mécanicien au Garage du Coin',manque:[c.stats.jobs<4?`Rendre ${4-c.stats.jobs} voiture${4-c.stats.jobs>1?'s':''} de plus`:null,level('entretien')<3?'Entretien : niveau 3':null].filter(Boolean),zone:'garage1'});
 if(!c.dipl.cap) g.push({id:'g_cap',titre:'Passer le CAP de maintenance',manque:c.form&&c.form.id==='cap'?[day()>=c.form.fin?'Passer l\'examen au centre de formation':`Formation en cours, fin au jour ${c.form.fin}`]:['S\'inscrire au centre de formation'],zone:'ecole'});
 if(!sat('ventoux')&&!sat('aurele')&&!sat('brivio')&&!sat('ing')) g.push({id:'g_vent',titre:'Être embauché chez Ventoux Automobiles',manque:missing(EMP.ventoux.req),zone:'garage2',ok:!!(c.emp==='ventoux'||c.emp==='aurele'||c.emp==='brivio')});
 if(!c.dipl.bts) g.push({id:'g_bts',titre:'Obtenir le BTS de maintenance',manque:missing(DIPL.bts.req),zone:'ecole'});
 if(!['aurele','brivio'].includes(c.emp)) g.push({id:'g_aur',titre:'Être embauché chez Maison Aurèle',manque:missing(EMP.aurele.req),zone:'garage3'});
 if(c.emp!=='brivio') g.push({id:'g_bri',titre:'Être embauché chez Scuderia Brivio',manque:missing(EMP.brivio.req),zone:'garage4'});
 if(!c.dipl.ing) g.push({id:'g_ding',titre:"Obtenir le diplôme d'ingénieur",manque:missing(DIPL.ing.req),zone:'ecole'});
 else if(c.emp!=='ing'&&c.emp!=='fondateur') g.push({id:'g_ing',titre:'Rejoindre le centre technique comme ingénieur',manque:missing(ING_REQ),zone:'bureau'});
 if(c.emp==='ing'&&c.grade<3) g.push({id:'g_prom',titre:'Devenir '+GRADES[c.grade+1].n.toLocaleLowerCase(),manque:[`Valider ${Math.max(0,GRADES[c.grade].need-c.qual)} mission${GRADES[c.grade].need-c.qual>1?'s':''} avec une note d'au moins ${12+c.grade}/20`],zone:'bureau'});
 if(c.emp!=='fondateur'){const m=[];if(MW.S.money<FOUND.capital) m.push(`Capital de ${fmt(FOUND.capital)} (vous : ${fmt(MW.S.money)})`);if(rep()<FOUND.rep) m.push(`Réputation : ${FOUND.rep}`);
  if(!(c.emp==='ing'&&c.grade>=1)&&!(c.emp==='patron'&&level('moteur')>=FOUND.niv.moteur)) m.push('Ingénieur confirmé, ou patron de garage avec moteur niveau '+FOUND.niv.moteur);
  g.push({id:'g_marque',titre:'Fonder votre marque',manque:m,zone:'terrain'});}
 return g.filter(x=>!x.ok);}
function tutorial(){const c=C();
 if(c.emp==='aucun'&&!c.everMeca&&!c.stats.jobs) return {id:'t_emb',titre:'Présentez-vous au comptoir du Garage du Coin',aide:'Allez au comptoir d\'accueil et appuyez sur E : on vous prendra comme apprenti.',zone:'garage1'};
 if(c.stats.jobs<1) return {id:'t_client',titre:'Prenez votre premier client',aide:'Une voiture cliente attend sur un pont : inspectez-la, réparez-la puis rendez-la au client.',zone:'garage1'};
 if(c.stats.vid<1) return {id:'t_vid',titre:'Faites votre première vidange',aide:'Vidange : huile et filtre à huile, au pont du garage.',zone:'garage1'};
 if(c.stats.paid<1) return {id:'t_paie',titre:'Touchez votre première paie',aide:'Rendez une voiture réparée : votre part de la main-d\'œuvre vous est versée.',zone:null};
 return null;}
function currentGoal(){const t=tutorial();if(t) return t;const g=longGoals()[0];return g?{id:g.id,titre:g.titre,aide:g.manque[0]||'',zone:g.zone}:null;}
let lastGoal='',lastCareer='';
function refresh(){
 if(!MW.S) return;const e=employer();
 const ch=`<b>${esc(e.nom)}</b><br><small>${e.paie==='mois'?esc(fmt(e.mois))+' par mois':e.id==='aucun'?'Sans salaire':e.id==='fondateur'?'':e.net?'Factures moins pièces et loyer':Math.round(e.part*100)+' % de la main-d\'œuvre'}</small>`;
 if(ch!==lastCareer){lastCareer=ch;MW.hud('career',ch);}
 const g=currentGoal();
 const html=g?`Objectif : <b>${esc(g.titre)}</b>${g.aide?`<br><small>${esc(g.aide)}</small>`:''}`:'';
 const key=html+'|'+(g&&g.zone||'');
 if(key!==lastGoal||MW.S.marker!==(g&&g.zone||null)){lastGoal=key;MW.hud('goal',html);if(MW.S.marker!==(g&&g.zone||null)) MW.setMarker(g&&g.zone||null);}
}

/* ── QCM ── */
const BANK=[
['Que mesure un couple exprimé en newton-mètres (Nm) ?','La force de rotation disponible sur l\'arbre moteur','La vitesse maximale du moteur','La consommation de carburant','La température de l\'huile'],
['Dans un moteur à quatre temps, quel est l\'ordre des temps ?','Admission, compression, combustion-détente, échappement','Admission, échappement, compression, détente','Compression, admission, détente, échappement','Échappement, admission, détente, compression'],
['Quel est le rôle du filtre à huile ?','Retenir les impuretés et les particules métalliques en circulation','Refroidir l\'huile','Augmenter la pression d\'huile','Mesurer le niveau d\'huile'],
['Que remplace-t-on systématiquement avec l\'huile lors d\'une vidange ?','Le filtre à huile et le joint du bouchon de vidange','Les bougies','Le liquide de refroidissement','Les plaquettes de frein'],
['Pourquoi remplace-t-on le liquide de frein tous les deux ans environ ?','Il absorbe l\'humidité et son point d\'ébullition baisse','Il devient de l\'huile','Il perd sa couleur','Il bouche les durites'],
['Un bruit de frottement métallique au freinage indique le plus souvent :','Des plaquettes usées jusqu\'au support métallique','Un manque d\'huile moteur','Une batterie faible','Un filtre à air colmaté'],
['Le voyant rouge de pression d\'huile s\'allume en roulant. Que faire ?','S\'arrêter immédiatement et couper le moteur','Continuer jusqu\'au prochain garage','Ajouter du liquide de refroidissement','Accélérer pour refroidir'],
['À quoi sert la courroie de distribution ?','À synchroniser le vilebrequin et l\'arbre à cames','À entraîner l\'alternateur','À transmettre la puissance aux roues','À alimenter l\'injection'],
['Que risque un moteur à interférence si la courroie de distribution casse ?','Les pistons percutent les soupapes : casse moteur','Il tourne simplement plus doucement','Seul le démarreur est touché','Rien, on peut repartir'],
['Quel est le rôle d\'une bougie d\'allumage sur un moteur à essence ?','Enflammer le mélange air-carburant par une étincelle','Préchauffer le gazole','Filtrer l\'air','Refroidir le piston'],
['Dans un moteur diesel, le gazole s\'enflamme grâce :','À la forte température de l\'air comprimé','À une étincelle de bougie','Au démarreur','Au turbo'],
['Quelle tension affiche une batterie 12 V en bon état, moteur à l\'arrêt ?','Environ 12,6 V','Environ 9 V','Environ 15 V','Environ 6 V'],
['Moteur tournant, quelle tension doit fournir l\'alternateur ?','Environ 13,8 à 14,5 V','Environ 8 V','Moins de 11 V','Environ 20 V'],
['À quoi sert la sonde lambda ?','À mesurer l\'oxygène des gaz d\'échappement pour corriger le dosage','À mesurer la température d\'eau','À mesurer la pression d\'huile','À détecter l\'usure des plaquettes'],
['Un mélange « pauvre » contient :','Trop d\'air par rapport au carburant','Trop de carburant','Trop d\'huile','Pas d\'air du tout'],
['Quel est le rapport stœchiométrique d\'un moteur à essence ?','Environ 14,7 kg d\'air pour 1 kg d\'essence','Environ 5 kg d\'air pour 1 kg d\'essence','Environ 30 kg d\'air pour 1 kg d\'essence','1 kg d\'air pour 1 kg d\'essence'],
['Que fait un pot catalytique ?','Il transforme le CO, les HC et les NOx en CO2, eau et azote','Il réduit uniquement le bruit','Il refroidit les gaz','Il augmente la puissance'],
['À quoi sert un turbocompresseur ?','À comprimer l\'air d\'admission grâce aux gaz d\'échappement','À refroidir l\'huile','À filtrer le carburant','À entraîner la pompe à eau'],
['Pourquoi un échangeur (intercooler) est-il placé après le turbo ?','Pour refroidir l\'air comprimé et en augmenter la densité','Pour chauffer l\'habitacle','Pour filtrer l\'air','Pour produire de l\'électricité'],
['Où trouve-t-on la pression de gonflage recommandée ?','Sur l\'étiquette du montant de porte ou dans le carnet d\'entretien','Sur la plaque d\'immatriculation','Sur la batterie','Sur le filtre à air'],
['Quelle est la profondeur minimale légale des sculptures d\'un pneu en France ?','1,6 mm','0,5 mm','3 mm','5 mm'],
['Un parallélisme déréglé provoque surtout :','Une usure irrégulière des pneus et une direction imprécise','Une surchauffe moteur','Une perte de puissance','De la fumée blanche'],
['Quel est le rôle d\'un amortisseur ?','Freiner les oscillations du ressort pour garder le contact pneu-sol','Porter le poids du véhicule','Freiner la voiture','Assurer la direction'],
['Un ronflement qui augmente avec la vitesse et change dans les virages évoque :','Un roulement de roue usé','Une courroie détendue','Un filtre à air bouché','Une bougie encrassée'],
['À quoi sert l\'embrayage ?','À désolidariser temporairement le moteur de la boîte de vitesses','À refroidir la boîte','À multiplier le couple','À lubrifier la boîte'],
['Le régime moteur monte mais la voiture n\'accélère pas : quelle panne ?','Un disque d\'embrayage usé qui patine','Une batterie faible','Des injecteurs encrassés','Un radiateur bouché'],
['Que permet le différentiel ?','Aux roues motrices de tourner à des vitesses différentes dans un virage','De changer de rapport','De freiner','De refroidir la boîte'],
['Un claquement en braquant à fond sous accélération évoque :','Un joint de cardan de transmission usé','Des plaquettes usées','Une sonde lambda défaillante','Un alternateur fatigué'],
['À quoi sert le liquide de refroidissement ?','À évacuer la chaleur du moteur et à éviter le gel','À lubrifier les pistons','À nettoyer l\'injection','À alimenter la direction assistée'],
['Un thermostat bloqué en position fermée provoque :','Une surchauffe du moteur','Un moteur qui ne chauffe jamais','Une batterie vide','Un claquement de soupapes'],
['Quand peut-on ouvrir le bouchon du vase d\'expansion ?','Moteur froid, pour éviter les projections de liquide brûlant','Moteur chaud à plein régime','Jamais','Pendant la conduite'],
['Un voyant moteur orange allumé fixe signale :','Un défaut du système d\'injection ou de dépollution à diagnostiquer','Un plein de carburant à faire','Une ceinture non bouclée','Un pneu à gonfler'],
['À quoi sert la prise de diagnostic (OBD) ?','À lire les codes défaut du calculateur avec une valise','À recharger la batterie','À gonfler les pneus','À régler les phares'],
['Un code défaut P0300 correspond à :','Des ratés d\'allumage multiples','Une panne de climatisation','Un défaut d\'ABS','Une pression de pneu basse'],
['Quel est le rôle de l\'ABS ?','Éviter le blocage des roues au freinage pour garder la direction','Augmenter la puissance','Réduire la consommation','Chauffer les freins'],
['Des vibrations dans la pédale et le volant au freinage évoquent :','Des disques de frein voilés','Un filtre d\'habitacle sale','Une courroie détendue','Un alternateur défaillant'],
['La purge du circuit de freinage est nécessaire après :','Un remplacement du liquide ou une ouverture du circuit','Un changement d\'ampoule','Un remplacement de filtre à air','Un changement de balais d\'essuie-glace'],
['Une pédale de frein spongieuse indique généralement :','De l\'air dans le circuit hydraulique','Des plaquettes neuves','Des pneus trop gonflés','Un alternateur défaillant'],
['Que protège le filtre à air ?','Le moteur contre les poussières aspirées','La boîte de vitesses','Le circuit de frein','La batterie'],
['À quoi sert le filtre à particules (FAP) d\'un diesel ?','À piéger les suies, qui sont brûlées lors des régénérations','À chauffer l\'habitacle','À augmenter la pression du turbo','À filtrer l\'eau du gazole'],
['Des injecteurs encrassés provoquent typiquement :','Un ralenti instable et une consommation en hausse','Des pneus usés','Un freinage allongé','Un bruit de portière'],
['Comment serre-t-on les écrous de roue ?','En étoile, à la clé dynamométrique, au couple prescrit','À la visseuse à fond, dans l\'ordre circulaire','À la main, sans outil','Un seul écrou suffit sur les quatre'],
['Avant de travailler sous une voiture sur un pont élévateur, il faut :','Vérifier que les bras sont bien positionnés et le pont verrouillé','Laisser le moteur tourner','Retirer les cales','Faire le plein'],
['Peut-on travailler sous une voiture soutenue seulement par un cric ?','Non : il faut des chandelles de sécurité','Oui, pour les petits travaux','Oui, si le frein à main est serré','Oui, si le cric est neuf'],
['Dans une huile 5W-30, que représente le « 5W » ?','La viscosité à froid (fluidité au démarrage)','La viscosité à chaud','La quantité d\'huile','La température d\'ébullition'],
['Que représente la cylindrée d\'un moteur ?','Le volume balayé par les pistons dans les cylindres','La puissance maximale','Le poids du moteur','La contenance du réservoir'],
['Que décrit le rapport volumétrique de compression ?','Le rapport entre le volume maximal et minimal du cylindre','La pression de l\'huile','Le rapport entre puissance et poids','Le nombre de soupapes par cylindre'],
['Un voyant de batterie allumé en roulant signale souvent :','Un défaut de charge : alternateur ou courroie d\'accessoires','Un plein de lave-glace','Une porte mal fermée','Un pneu crevé'],
['À quoi sert une barre stabilisatrice ?','À limiter le roulis dans les virages','À freiner la voiture','À refroidir le moteur','À amplifier la direction'],
['Le moteur cale à froid mais tourne bien à chaud. Quelle piste vérifier en premier ?','La sonde de température ou le ralenti (papillon encrassé)','Les plaquettes','Les amortisseurs','La pression des pneus'],
['Que se passe-t-il si l\'on mélange du gazole dans un réservoir d\'essence ?','Le moteur s\'étouffe, il faut vidanger le réservoir','La puissance augmente','Rien de particulier','Le catalyseur se nettoie']
];
let Q=null;
function quiz(o){
 const idx=shuffle(BANK.map((_,i)=>i)).slice(0,Math.min(o.n,BANK.length));
 Q={o,i:0,score:0,miss:[],done:false,items:idx.map(i=>{const b=BANK[i],ord=shuffle([0,1,2,3]);return {q:b[0],opts:ord.map(j=>b[1+j]),a:ord.indexOf(0),good:b[1]};})};
 quizShow();}
function quizShow(){
 const it=Q.items[Q.i],o=Q.o;
 MW.panel(o.titre,`${o.intro&&Q.i===0?`<p>${o.intro}</p>`:''}<p class="hint">Question ${Q.i+1} sur ${Q.items.length}</p><p><b>${esc(it.q)}</b></p><div class="mw-btns v">${it.opts.map((t,j)=>btn('rep:'+j,esc(t),'ghost')).join('')}</div>`,
  {onClick:a=>{if(a.startsWith('rep:')) quizAnswer(+a.slice(4));},onClose:()=>{if(Q&&!Q.done){const q=Q;Q=null;if(q.o.onAbort) q.o.onAbort();}}});}
function quizAnswer(j){
 if(!Q) return;const it=Q.items[Q.i];if(j===it.a) Q.score++;else Q.miss.push(it);
 Q.i++;if(Q.i<Q.items.length){quizShow();return;}
 const q=Q;q.done=true;Q=null;q.o.onEnd(q.score>=q.o.min,q.score,q.items.length,q.miss);}
api.qcm=()=>Q?{index:Q.items[Q.i].a,n:Q.i}:null;
const missHTML=miss=>miss.length?`<p class="hint">À retenir :</p><ul class="mw-cond">${miss.map(m=>`<li class="no">${esc(m.q)}<br><small>${esc(m.good)}</small></li>`).join('')}</ul>`:'';

/* ── Garage du Coin et garages de marque : comptoir d'accueil ── */
function counter(z){
 const id=z.id,c=C(),e=employer();
 if(id==='garage1') return counterCoin(z);
 const eid=ZONE_EMP[id],E=EMP[eid];
 if(c.emp===eid){
  MW.panel(z.nom,`<p>Vous travaillez ici : <b>${esc(e.nom)}</b>. ${esc(fmt(e.mois))} par mois, versés le 1er de chaque mois de jeu (tous les 30 jours).</p><p class="hint">Les voitures confiées vont jusqu'au niveau ${e.niveauxAutorises} de difficulté.</p><div class="mw-btns">${btn('resign','Démissionner','ghost')}${btn('close','Fermer','ghost')}</div>`,
   {onClick:a=>{if(a==='resign'){resign();MW.closePanel();say('Vous avez quitté votre poste.','warn');}}});return;}
 const wait=(c.refus[eid]||0)-day(),can=okAll(E.req);
 MW.panel(z.nom,`<p>${esc(z.nom)} recrute des mécaniciens. Salaire : <b>${esc(fmt(E.mois))} par mois</b>. Voici ce qu'on attend d'un candidat :</p>${condHTML(E.req)}${wait>0?`<p class="mw-soon">Votre dernière candidature a été refusée : revenez dans ${wait} jour${wait>1?'s':''}.</p>`:''}<p class="hint">L'entretien d'embauche est un questionnaire de 5 questions de mécanique : il faut au moins 4 bonnes réponses.</p><div class="mw-btns">${btn('interview','Passer l\'entretien d\'embauche','',!can||wait>0)}${btn('close','Fermer','ghost')}</div>`,
  {onClick:a=>{if(a==='interview') interview(eid,z);}});}
function interview(eid,z){
 const E=EMP[eid],c=C();
 quiz({titre:'Entretien d\'embauche · '+E.lieu,n:5,min:4,intro:`Le responsable de l'atelier vous pose quelques questions techniques.`,
  onEnd:(ok,s,n,miss)=>{
   if(ok){hire(eid);MW.panel('Embauché !',`<p>Bravo, ${s} bonnes réponses sur ${n}. Vous êtes engagé chez <b>${esc(E.lieu)}</b> : ${esc(fmt(E.mois))} par mois.</p><p class="hint">Les clients de cet atelier vous attendent désormais sur les ponts.</p><div class="mw-btns">${btn('close','Au travail')}</div>`);}
   else{c.refus[eid]=day()+3;MW.panel('Candidature refusée',`<p>${s} bonne${s>1?'s':''} réponse${s>1?'s':''} sur ${n} : ce n'est pas suffisant. Revenez dans 3 jours.</p>${missHTML(miss)}<div class="mw-btns">${btn('close','Fermer','ghost')}</div>`);}}});}
function counterCoin(z){
 const c=C(),e=employer();
 if(c.emp==='aucun'||(!['apprenti','meca','patron'].includes(c.emp))){
  const back=c.everMeca;
  MW.panel(z.nom,`<p>${back?'Le patron se souvient de vous.':'Le patron du Garage du Coin cherche un apprenti.'} Pas d'entretien : on vous prend à l'essai.</p><p class="hint">${back?'Vous reprenez votre place de mécanicien (45 % de la main-d\'œuvre).':'Vous toucherez 30 % de la main-d\'œuvre sur chaque voiture rendue, et vous apprendrez l\'entretien de base.'}</p><div class="mw-btns">${btn('join',back?'Reprendre mon poste de mécanicien':'Devenir apprenti')}${btn('close','Fermer','ghost')}</div>`,
   {onClick:a=>{if(a==='join'){hire(back?'meca':'apprenti');MW.closePanel();say(back?'Bon retour au Garage du Coin.':'Vous voilà apprenti au Garage du Coin. Un client ne devrait pas tarder.','good');}}});return;}
 let extra='';
 if(c.emp==='apprenti') extra=`<p>Pour devenir mécanicien : rendre au moins 4 voitures (vous : ${c.stats.jobs}) et atteindre le niveau 3 en entretien (vous : ${level('entretien')}).</p>`;
 if(c.emp==='meca') extra=`<p>Le patron songe à prendre sa retraite. Reprendre le fonds de commerce : <b>${esc(fmt(OWN.prix))}</b> et un loyer de ${esc(fmt(EMP.patron.loyer))} par jour. Vous encaisseriez toutes les factures, mais paieriez vous-même les pièces.</p>${condHTML(OWN.req)}`;
 if(c.emp==='patron') extra=`<p>Vous êtes propriétaire du garage. Loyer : ${esc(fmt(EMP.patron.loyer))} par jour de jeu.</p>`;
 MW.panel(z.nom,`<p>Vous travaillez ici : <b>${esc(e.nom)}</b>.</p>${extra}<div class="mw-btns">${c.emp==='meca'?btn('buy','Reprendre le garage ('+esc(fmt(OWN.prix))+')','',!okAll(OWN.req)||MW.S.money<OWN.prix):''}${c.emp==='patron'?btn('sell','Revendre le fonds ('+esc(fmt(OWN.prix*.6))+')','ghost'):''}${btn('resign','Démissionner','ghost')}${btn('close','Fermer','ghost')}</div>`,
  {onClick:a=>{
   if(a==='buy'){MW.money(-OWN.prix,'Reprise du Garage du Coin');hire('patron');MW.closePanel();say('Le Garage du Coin est à vous ! Vous gardez la main-d\'œuvre, mais payez les pièces et le loyer.','good');}
   else if(a==='sell'){MW.money(OWN.prix*.6,'Revente du fonds de commerce');hire('meca');MW.closePanel();}
   else if(a==='resign'){resign();MW.closePanel();say('Vous avez quitté votre poste.','warn');}}});}

/* ── Centre de formation ── */
const STAGES=COMPS.map(([k,n])=>({id:'stage_'+k,comp:k,nom:'Stage : '+n.toLocaleLowerCase(),cout:350,jours:2,xp:90}));
function school(z){
 const c=C(),d=day();
 let h=`<p>Le centre de formation prépare aux diplômes et propose des stages courts. Une formation dure des jours de jeu : vous continuez à travailler en attendant.</p>`;
 if(c.form){const f=c.form;
  if(f.type==='dipl'){const D=DIPL[f.id];h+=`<p class="mw-soon">En cours : <b>${esc(D.nom)}</b> · ${d>=f.fin?'l\'examen est ouvert !':`encore ${f.fin-d} jour${f.fin-d>1?'s':''} (fin au jour ${f.fin})`}</p>${d>=f.fin?`<div class="mw-btns">${btn('exam','Passer l\'examen')}</div>`:''}`;}
  else{const S2=STAGES.find(x=>x.id===f.id);h+=`<p class="mw-soon">Stage en cours : <b>${esc(S2?S2.nom:'')}</b> · fin au jour ${f.fin}.</p>`;}}
 h+='<h3 class="mw-h3">Diplômes</h3>';
 for(const id in DIPL){const D=DIPL[id];
  if(c.dipl[id]){h+=`<p>✓ <b>${esc(D.nom)}</b> obtenu.</p>`;continue;}
  const ok=okAll(D.req),busy=!!c.form;
  h+=`<div class="mw-card"><b>${esc(D.nom)}</b><br><small>${esc(fmt(D.cout))} · ${D.jours} jours · examen de ${D.n} questions (${D.min} bonnes réponses)</small>${D.req.dipl||D.req.niv?condHTML(D.req):''}<div class="mw-btns">${btn('enroll:'+id,'S\'inscrire','sm',!ok||busy||MW.S.money<D.cout)}</div></div>`;}
 h+='<h3 class="mw-h3">Stages (gagner de l\'expérience)</h3><div class="mw-card">';
 for(const s of STAGES) h+=`<div class="mw-row"><span>${esc(s.nom)}<br><small>${esc(fmt(s.cout))} · ${s.jours} jours · +${s.xp} points</small></span>${btn('stage:'+s.id,'S\'inscrire','sm',!!c.form||MW.S.money<s.cout)}</div>`;
 h+='</div>';
 MW.panel(z.nom,h,{wide:true,onClick:a=>{
  const cc=C();
  if(a.startsWith('enroll:')){const id=a.slice(7),D=DIPL[id];if(cc.form||MW.S.money<D.cout||!okAll(D.req)) return;MW.money(-D.cout,'Inscription : '+D.nom);cc.form={type:'dipl',id,fin:day()+D.jours};say(`Inscription validée. Examen disponible au jour ${cc.form.fin}.`,'good');refresh();school(z);}
  else if(a.startsWith('stage:')){const s=STAGES.find(x=>x.id===a.slice(6));if(!s||cc.form||MW.S.money<s.cout) return;MW.money(-s.cout,s.nom);cc.form={type:'stage',id:s.id,comp:s.comp,xp:s.xp,fin:day()+s.jours};say(`Stage commencé : fin au jour ${cc.form.fin}.`,'good');school(z);}
  else if(a==='exam') exam(z);}});}
function exam(z){
 const c=C(),f=c.form;if(!f||f.type!=='dipl') return;const D=DIPL[f.id];
 quiz({titre:'Examen · '+D.nom,n:D.n,min:D.min,intro:`Examen : ${D.n} questions, ${D.min} bonnes réponses pour réussir.`,
  onAbort:()=>{},
  onEnd:(ok,s,n,miss)=>{
   if(ok){c.dipl[f.id]=day();c.form=null;MW.S.rep=Math.min(100,rep()+2);refresh();
    MW.panel('Diplôme obtenu',`<p>${s} bonnes réponses sur ${n} : vous obtenez le <b>${esc(D.nom)}</b>. Votre réputation progresse.</p><div class="mw-btns">${btn('close','Fermer')}</div>`);}
   else{f.fin=day()+1;MW.panel('Examen raté',`<p>${s} bonne${s>1?'s':''} réponse${s>1?'s':''} sur ${n} : il en fallait ${D.min}. Révisez et repassez l'examen demain (jour ${f.fin}).</p>${missHTML(miss)}<div class="mw-btns">${btn('close','Fermer','ghost')}</div>`);}}});}

/* ── Centre technique : carrière d'ingénieur ── */
const MIS=[
 [0,'Moteur compact 4 cylindres',[{k:'cyl',n:4},{k:'P',lo:150,hi:180},{k:'mix',max:7.5},{k:'cost',max:38000}]],
 [0,'Moteur de berline 6 cylindres',[{k:'cyl',n:6},{k:'P',lo:210,hi:260},{k:'mix',max:10.5},{k:'cost',max:40000}]],
 [0,'Moteur urbain 3 cylindres',[{k:'cyl',n:3},{k:'P',lo:70,hi:100},{k:'mix',max:6},{k:'cost',max:24000}]],
 [1,'Compacte sportive',[{k:'cyl',n:4},{k:'P',lo:180,hi:230},{k:'t100',max:7.5},{k:'mass',max:1350},{k:'cost',max:45000}]],
 [1,'Berline familiale',[{k:'P',lo:130,hi:170},{k:'mix',max:7},{k:'mass',max:1500},{k:'comf',min:60},{k:'cost',max:30000}]],
 [2,'Grand tourisme',[{k:'cyl',n:6},{k:'P',lo:280,hi:340},{k:'v',min:250},{k:'t100',max:5.8},{k:'rel',min:80},{k:'cost',max:60000}]],
 [2,'Routière économique',[{k:'P',lo:110,hi:140},{k:'mix',max:6},{k:'rel',min:85},{k:'comf',min:65},{k:'saf',min:85},{k:'cost',max:24000}]],
 [3,'Sportive haut de gamme',[{k:'P',lo:450,hi:600},{k:'v',min:300},{k:'t100',max:4.2},{k:'hand',min:70},{k:'saf',min:85},{k:'rel',min:80},{k:'cost',max:150000}]],
 [3,'Berline de prestige',[{k:'P',lo:250,hi:320},{k:'comf',min:80},{k:'mix',max:10},{k:'saf',min:90},{k:'rel',min:88},{k:'cost',max:60000}]]];
const CRIT={
 cyl:{g:(m,E)=>E.c&&E.c.n,l:x=>`${x.n} cylindres`,u:''},
 P:{g:m=>m.P,l:x=>`puissance de ${x.lo} à ${x.hi} ch`,u:' ch'},
 mix:{g:m=>m.mix,l:x=>`consommation mixte sous ${nf(x.max,1)} l/100 km`,u:' l/100'},
 cost:{g:m=>m.cost,l:x=>`coût de revient sous ${fmt(x.max)}`,u:' €'},
 mass:{g:m=>m.mass,l:x=>`masse sous ${nf(x.max)} kg`,u:' kg'},
 t100:{g:m=>m.t100,l:x=>`0 à 100 km/h en moins de ${nf(x.max,1)} s`,u:' s'},
 v:{g:m=>m.v,l:x=>`vitesse maxi d'au moins ${nf(x.min)} km/h`,u:' km/h'},
 rel:{g:m=>m.rel,l:x=>`fiabilité d'au moins ${x.min}`,u:''},
 comf:{g:m=>m.comf,l:x=>`confort d'au moins ${x.min}`,u:''},
 saf:{g:m=>m.saf,l:x=>`sécurité d'au moins ${x.min}`,u:''},
 hand:{g:m=>m.hand,l:x=>`tenue de route d'au moins ${x.min}`,u:''}};
function critEval(x,met,E){
 const d=CRIT[x.k],v=d.g(met,E);let s,ok;
 if(v==null||!isFinite(v)) return {x,v:null,s:0,ok:false,txt:d.l(x)};
 if(x.k==='cyl'){ok=v===x.n;s=ok?1:0;}
 else if(x.lo!=null){const dev=v<x.lo?x.lo-v:v>x.hi?v-x.hi:0;ok=dev===0;s=clamp(1-dev/(.2*(x.lo+x.hi)/2),0,1);}
 else if(x.max!=null){ok=v<=x.max;s=ok?1:clamp(1-(v/x.max-1)/.2,0,1);}
 else{ok=v>=x.min;s=ok?1:clamp(1-(1-v/x.min)/.2,0,1);}
 return {x,v,s,ok,txt:d.l(x)};}
function missionEval(m){
 if(!m||typeof M==='undefined'||!M.E||!M.C||typeof measure!=='function') return null;
 let met;try{met=measure(M.E,M.C);}catch(e){return null;}
 const rows=m.cahier.map(x=>critEval(x,met,M.E));
 let note=20*rows.reduce((a,r)=>a+r.s,0)/rows.length;
 if(met.fit===false) note=Math.min(note,4);
 return {rows,note:Math.round(note*2)/2,fit:met.fit!==false};}
api.evalMission=missionEval;
function newMission(){
 const c=C(),g=c.grade,pool=MIS.filter(x=>x[0]===g),t=pool[Math.floor(Math.random()*pool.length)];
 c.mission={id:'m'+day()+'_'+Math.floor(Math.random()*1e4),titre:t[1],grade:g,cahier:t[2].map(x=>Object.assign({},x)),essais:0};
 return c.mission;}
const cahierHTML=m=>`<ul class="mw-cond">${m.cahier.map(x=>`<li>${esc(CRIT[x.k].l(x))}</li>`).join('')}</ul>`;
function bureau(z){
 const c=C(),e=employer();
 if(c.emp==='fondateur'){MW.panel(z.nom,`<p>Vous avez fondé votre propre marque : ce centre technique n'a plus besoin de vous.</p><div class="mw-btns">${btn('close','Fermer','ghost')}</div>`);return;}
 if(c.emp!=='ing'){
  const can=okAll(ING_REQ);
  MW.panel(z.nom,`<p>Le centre technique conçoit les moteurs et les voitures de la marque. On y recrute des ingénieurs diplômés, qui reçoivent des missions chiffrées et un salaire mensuel (${esc(fmt(GRADES[0].mois))} pour débuter).</p>${condHTML(ING_REQ)}<div class="mw-btns">${btn('apply','Postuler comme ingénieur','',!can)}${btn('close','Fermer','ghost')}</div>`,
   {onClick:a=>{if(a==='apply'){c.grade=0;c.qual=0;hire('ing');say('Bienvenue au centre technique, ingénieur !','good');bureau(z);}}});return;}
 const g=GRADES[c.grade],m=c.mission;
 let h=`<p><b>${esc(g.n)}</b> · ${esc(fmt(g.mois))} par mois (versés le 1er de chaque mois de jeu). Missions réussies : ${c.missions}.</p>`;
 if(c.grade<3) h+=`<p class="hint">Prochaine promotion (${esc(GRADES[c.grade+1].n.toLocaleLowerCase())}) : valider ${Math.max(0,g.need-c.qual)} mission${g.need-c.qual>1?'s':''} avec au moins ${12+c.grade}/20.</p>`;
 if(m) h+=`<h3 class="mw-h3">Mission en cours : ${esc(m.titre)}</h3><p>Le chef de projet attend un projet qui respecte ce cahier des charges :</p>${cahierHTML(m)}<p class="hint">Concevez le moteur et la voiture dans le bureau d'études, puis soumettez-les au chef de projet. Note minimale : 10/20${m.essais?` · ${m.essais} soumission${m.essais>1?'s':''} déjà faite${m.essais>1?'s':''}`:''}.</p>`;
 else h+='<p>Aucune mission en cours.</p>';
 h+=`<div class="mw-btns">${m?btn('studio','Ouvrir le bureau d\'études')+btn('drop','Abandonner la mission','ghost'):btn('new','Demander une mission')}${btn('resign','Démissionner','ghost')}${btn('close','Fermer','ghost')}</div>`;
 MW.panel(z.nom,h,{wide:true,onClick:a=>{
  if(a==='new'){newMission();bureau(z);}
  else if(a==='studio') openStudio();
  else if(a==='drop'){c.mission=null;MW.S.rep=Math.max(0,rep()-1);bureau(z);}
  else if(a==='resign'){resign();MW.closePanel();say('Vous avez quitté le centre technique.','warn');}}});}

/* ── bureau d'études (mode libre existant) et bandeau de mission ── */
let banner=null,bannerT=0;
function ensureBanner(){
 if(banner) return banner;
 banner=document.createElement('div');banner.className='mw-mis';banner.id='mwMis';banner.hidden=true;
 banner.innerHTML='<div class="mw-mis-t"></div><div class="mw-mis-l"></div><div class="mw-mis-b"><button type="button" class="btn sm" data-a="sub">Soumettre au chef de projet</button><button type="button" class="btn sm ghost" data-a="back">Revenir à la ville</button></div>';
 banner.addEventListener('click',e=>{const b=e.target.closest('button');if(!b) return;if(b.dataset.a==='sub') submitMission();else if(b.dataset.a==='back') backToTown();});
 document.body.appendChild(banner);return banner;}
function bannerUpdate(){
 const c=MW.S&&MW.S.career,m=c&&c.mission;
 const home=document.getElementById('home');
 if(!banner||banner.hidden) return;
 if(!m||(home&&!home.hidden)){hideBanner();return;}
 const ev=missionEval(m),t=banner.querySelector('.mw-mis-t'),l=banner.querySelector('.mw-mis-l');
 t.innerHTML=`<b>Mission : ${esc(m.titre)}</b>`;
 l.innerHTML=ev?ev.rows.map(r=>`<span class="${r.ok?'ok':'no'}">${r.ok?'✓':'✗'} ${esc(r.txt)}${r.v!=null?` <small>(${esc(nf(r.v,r.x.k==='mix'||r.x.k==='t100'?1:0))}${esc(CRIT[r.x.k].u)})</small>`:''}</span>`).join('')+`<span class="mw-mis-n">Note estimée : <b>${nf(ev.note,1)}/20</b></span>`:'';}
function showBanner(){ensureBanner();banner.hidden=false;bannerUpdate();clearInterval(bannerT);bannerT=setInterval(bannerUpdate,900);}
function hideBanner(){clearInterval(bannerT);bannerT=0;if(banner) banner.hidden=true;}
function openStudio(){
 const c=C();if(!c.mission) return;
 MW.closePanel();MW.save();MW.suspend();
 if(typeof setMode==='function') setMode('libre');
 showBanner();}
api.openStudio=openStudio;
function backToTown(){hideBanner();MW.open();}
function submitMission(){
 const c=C(),m=c.mission;if(!m) return;
 const ev=missionEval(m);if(!ev){say('Aucun projet à évaluer.','warn');return;}
 hideBanner();MW.open();
 m.essais=(m.essais||0)+1;
 const note=ev.note,g=GRADES[clamp(c.grade,0,3)];
 const rowsH=`<ul class="mw-cond">${ev.rows.map(r=>`<li class="${r.ok?'ok':'no'}">${r.ok?'✓':'✗'} ${esc(r.txt)}${r.v!=null?` <small>(votre projet : ${esc(nf(r.v,r.x.k==='mix'||r.x.k==='t100'?1:0))}${esc(CRIT[r.x.k].u)})</small>`:''}</li>`).join('')}</ul>`;
 if(note>=10){
  const prime=Math.round(g.mois*.5*(note-10)/10/10)*10;
  c.missions++;c.notes.push(note);if(c.notes.length>20) c.notes.shift();
  const promo=note>=12+c.grade;if(promo&&c.grade<3) c.qual++;
  let msg='';
  if(prime>0) MW.money(prime,'Prime de mission');
  MW.S.rep=Math.min(100,rep()+(note>=15?3:note>=12?2:1));
  const done=c.mission;c.mission=null;
  if(c.grade<3&&c.qual>=g.need){c.grade++;c.qual=0;msg=`<p class="mw-soon">Promotion : vous êtes maintenant <b>${esc(GRADES[c.grade].n)}</b> (${esc(fmt(GRADES[c.grade].mois))} par mois).</p>`;MW.emit('employerChanged','ing');}
  refresh();MW.emit('missionDone',done,note);
  MW.panel('Mission validée',`<p>Le chef de projet valide votre projet : <b>${nf(note,1)} / 20</b>.${prime>0?` Prime : ${esc(fmt(prime))}.`:''}</p>${rowsH}${msg}<div class="mw-btns">${btn('close','Fermer')}</div>`);
 }else{
  MW.S.rep=Math.max(0,rep()-1);
  MW.panel('Projet refusé',`<p>Le chef de projet renvoie votre dossier : <b>${nf(note,1)} / 20</b>, il en faut au moins 10. La mission reste ouverte.</p>${rowsH}<div class="mw-btns">${btn('studio','Retourner au bureau d\'études')}${btn('close','Fermer','ghost')}</div>`,{onClick:a=>{if(a==='studio') openStudio();}});}
}
api.submitMission=submitMission;
api.setMission=m=>{C().mission=m;};
api.newMission=newMission;

/* ── Banque ── */
const LOAN_RATE=.07;
const owed=()=>C().loans.reduce((a,l)=>a+l.rest,0);
function loanMax(){const e=employer();return Math.max(0,Math.round((2000+rep()*200+e.rang*e.rang*15000)/100)*100);}
const LOAN_STEPS=[1000,3000,10000,30000,100000,300000,1000000,3000000];
function bank(z){
 const c=C(),max=loanMax(),room=Math.max(0,max-owed());
 let h=`<p>La banque prête selon votre réputation et votre poste. Remboursement chaque jour de jeu, avec ${Math.round(LOAN_RATE*100)} % d'intérêts par an.</p><p>Vous pouvez emprunter jusqu'à <b>${esc(fmt(max))}</b> au total · déjà dû : ${esc(fmt(owed()))} · disponible : <b>${esc(fmt(room))}</b>.</p>`;
 if(c.loans.length){h+='<h3 class="mw-h3">Vos prêts</h3><div class="mw-card">'+c.loans.map((l,i)=>`<div class="mw-row"><span>Reste ${esc(fmt(l.rest))}<br><small>${esc(fmt(l.per))} par jour</small></span>${btn('pay:'+i,'Solder','sm',MW.S.money<l.rest)}</div>`).join('')+'</div>';}
 const opts=LOAN_STEPS.filter(x=>x<=room);
 h+='<h3 class="mw-h3">Emprunter</h3>'+(opts.length?`<div class="mw-btns">${opts.map(x=>btn('loan:'+x,esc(fmt(x))+' sur '+loanDays(x)+' j','sm')).join('')}${room>=500&&!opts.includes(Math.round(room))?btn('loan:'+Math.floor(room),'Maximum : '+esc(fmt(Math.floor(room))),'sm'):''}</div>`:'<p class="hint">Aucun prêt possible pour le moment : remboursez ou progressez dans votre carrière.</p>');
 h+=`<div class="mw-btns">${btn('close','Fermer','ghost')}</div>`;
 MW.panel(z.nom,h,{wide:true,onClick:a=>{
  if(a.startsWith('loan:')){const x=+a.slice(5);takeLoan(x);bank(z);}
  else if(a.startsWith('pay:')){const l=C().loans[+a.slice(4)];if(l&&MW.S.money>=l.rest){MW.money(-l.rest,'Prêt soldé');C().loans.splice(+a.slice(4),1);bank(z);}}}});}
const loanDays=x=>x<=3000?30:x<=30000?90:x<=300000?180:360;
function takeLoan(x){
 const c=C(),room=Math.max(0,loanMax()-owed());if(!(x>0)||x>room+1) return false;
 const n=loanDays(x),total=Math.round(x*(1+LOAN_RATE*n/365));
 c.loans.push({rest:total,per:Math.ceil(total/n),n,x});MW.money(x,'Prêt bancaire');return true;}
api.takeLoan=takeLoan;api.owed=owed;

/* ── Vendeur d'occasions ── */
const CARS=[
 {id:'vieille',nom:'Votre vieille voiture',kind:'berline',color:0x7c8a6a,prix:0},
 {id:'citadine',nom:'Citadine d\'occasion (7 ans)',kind:'citadine',color:0x3d7fc4,prix:4500},
 {id:'berline',nom:'Berline d\'occasion (5 ans)',kind:'berline',color:0x6a6f78,prix:9500},
 {id:'utilitaire',nom:'Fourgonnette d\'atelier',kind:'utilitaire',color:0xe8e8e8,prix:12000},
 {id:'suv',nom:'SUV familial (3 ans)',kind:'suv',color:0x2f5d3a,prix:17000},
 {id:'sport',nom:'Coupé sport (2 ans)',kind:'sport',color:0xc4281c,prix:36000}];
function applyCar(){
 const c=C();if(!c.car||!MW.playerCar) return;
 try{const pc=MW.playerCar(),m=pc&&pc.mesh;if(!m) return;
  const n=MW.carMesh({kind:c.car.kind,color:c.car.color});
  while(m.children.length) m.remove(m.children[0]);
  while(n.children.length) m.add(n.children[0]);
  m.userData=n.userData;}catch(e){console.error(e);}}
function dealer(z){
 const c=C(),cur=c.car?c.car.id:'vieille',curP=(CARS.find(x=>x.id===cur)||CARS[0]).prix;
 MW.panel(z.nom,`<p>Votre voiture actuelle : <b>${esc((CARS.find(x=>x.id===cur)||CARS[0]).nom)}</b>. Le vendeur reprend l'ancienne à 40 % de sa valeur d'achat.</p><div class="mw-card">${CARS.filter(x=>x.id!=='vieille').map(x=>{const net=x.prix-Math.round(curP*.4);return `<div class="mw-row"><span>${esc(x.nom)}<br><small>${esc(fmt(x.prix))}${curP?' · à payer : '+esc(fmt(Math.max(0,net))):''}</small></span>${btn('buy:'+x.id,cur===x.id?'Possédée':'Acheter','sm',cur===x.id||MW.S.money<Math.max(0,net))}</div>`;}).join('')}</div><p class="hint">Seul l'aspect de la voiture change : les performances de conduite restent celles d'une voiture ordinaire.</p><div class="mw-btns">${btn('close','Fermer','ghost')}</div>`,
  {wide:true,onClick:a=>{if(!a.startsWith('buy:')) return;const x=CARS.find(k=>k.id===a.slice(4));if(!x) return;
   const net=Math.max(0,x.prix-Math.round(curP*.4));if(MW.S.money<net) return;
   MW.money(-net,'Achat : '+x.nom);c.car={id:x.id,nom:x.nom,kind:x.kind,color:x.color};applyCar();say('Belle voiture ! Elle vous attend devant le studio.','good');dealer(z);}});}

/* ── Terrain : fonder sa marque ── */
function foundOk(){const c=C(),s=MW.S;
 return s.money>=FOUND.capital&&rep()>=FOUND.rep&&((c.emp==='ing'&&c.grade>=1)||(c.emp==='patron'&&level('moteur')>=FOUND.niv.moteur));}
function land(z){
 const c=C(),s=MW.S;
 if(c.emp==='fondateur'){MW.panel(z.nom,`<p>Votre marque <b>${esc(c.founded||'')}</b> est fondée. Retrouvez-la depuis l'écran d'accueil du jeu (« Continuer »).</p><div class="mw-btns">${btn('close','Fermer','ghost')}</div>`);return;}
 const lines=[
  {ok:s.money>=FOUND.capital,t:`Capital d'au moins ${fmt(FOUND.capital)} (prêts compris)`,now:'vous : '+fmt(s.money)},
  {ok:rep()>=FOUND.rep,t:`Réputation : ${FOUND.rep}`,now:'vous : '+Math.round(rep())},
  {ok:(c.emp==='ing'&&c.grade>=1)||(c.emp==='patron'&&level('moteur')>=FOUND.niv.moteur),t:`Ingénieur confirmé, ou propriétaire de garage avec moteur niveau ${FOUND.niv.moteur}`,now:'vous : '+esc(employer().nom)}];
 const ok=foundOk();
 MW.panel(z.nom,`<p>Un grand terrain industriel est à vendre. Vous y installeriez l'atelier de votre propre marque d'automobiles : tout votre capital (et vos dettes) deviennent ceux de l'entreprise, et le jeu passe en mode constructeur.</p><ul class="mw-cond">${lines.map(x=>`<li class="${x.ok?'ok':'no'}">${x.ok?'✓':'✗'} ${esc(x.t)} <small>(${x.now})</small></li>`).join('')}</ul>${ok?`<label class="mw-lab">Nom de votre marque<input id="mwBrand" class="mw-in" type="text" maxlength="30" value="" placeholder="Automobiles ..."></label>`:''}<div class="mw-btns">${btn('found','Acheter le terrain et fonder ma marque','',!ok)}${btn('close','Fermer','ghost')}</div>`,
  {onClick:a=>{if(a==='found'){const inp=document.getElementById('mwBrand'),nom=(inp&&inp.value.trim())||'Automobiles Nouvelles';foundBrand(nom);}}});}
function foundBrand(nom){
 if(!foundOk()) return false;
 const s=MW.S,c=C(),cash=s.money,debt=owed();
 const y=Math.min(new Date().getFullYear(),2030);
 MW.closePanel();
 MW.money(-cash,'Apport au capital de '+nom);
 c.loans=[];c.emp='fondateur';c.founded=nom;c.mission=null;
 MW.emit('founded',nom);MW.save();MW.suspend();
 api.startConstructor({co:nom,y,cash,debt});
 return true;}
api.foundBrand=foundBrand;
api.startConstructor=function(o){
 o=o||{};
 if(typeof newGame!=='function'||typeof setMode!=='function') return false;
 const y=Math.max(1900,Math.min(o.y||new Date().getFullYear(),2030));
 if(!G){try{localStorage.setItem('bea.design.v1',JSON.stringify(S));}catch(e){}}else saveGame();
 G=null;syncEra();
 newGame({y,diff:'nor',co:o.co||'Automobiles Nouvelles'});
 if(o.cash!=null){G.cash=o.cash;G.startCash=Math.max(o.cash,G.startCash||0);}
 G.debt=o.debt||0;
 sanitize();eraFix();tuneSafe();saveGame();setMode('carriere',G);
 return true;};

/* ── panneau Carrière ── */
function careerPanel(){
 const c=C(),e=employer(),s=MW.S;
 let h=`<div class="mw-card"><b>${esc(e.nom)}</b><br><small>${e.paie==='mois'?esc(fmt(e.mois))+' par mois, versés le 1er de chaque mois de jeu (prochaine paie : jour '+(Math.floor((s.day-1)/30)*30+31)+')':e.id==='aucun'?'Pas de salaire':e.id==='fondateur'?'Votre marque est fondée':e.net?'Vous encaissez les factures moins pièces ; loyer '+esc(fmt(e.loyer))+' par jour':Math.round(e.part*100)+' % de la main-d\'œuvre de chaque voiture rendue'}</small></div>`;
 h+='<h3 class="mw-h3">Compétences</h3><div class="mw-card">';
 for(const [k,n] of COMPS){const xp=(s.xp||{})[k]||0,l=level(k),a=xpFor(l),b=xpFor(l+1),p=l>=10?100:clamp((xp-a)/(b-a)*100,0,100);
  h+=`<div class="mw-sk"><span class="mw-sk-n">${esc(n)}</span><span class="mw-sk-b"><i style="width:${p.toFixed(0)}%"></i></span><b>${l}</b></div>`;}
 h+='</div>';
 h+=`<h3 class="mw-h3">Réputation</h3><div class="mw-sk"><span class="mw-sk-n">Réputation</span><span class="mw-sk-b"><i style="width:${clamp(rep(),0,100).toFixed(0)}%"></i></span><b>${Math.round(rep())}</b></div>`;
 h+='<h3 class="mw-h3">Diplômes</h3><p>'+(Object.keys(c.dipl).length?Object.keys(c.dipl).map(k=>'✓ '+esc(DIPL[k].nom)).join('<br>'):'Aucun diplôme pour le moment.')+'</p>';
 if(c.form) h+=`<p class="hint">Formation en cours, fin au jour ${c.form.fin}.</p>`;
 h+=`<h3 class="mw-h3">Argent</h3><p>Solde : <b>${esc(fmt(s.money))}</b>${c.loans.length?` · prêts : ${esc(fmt(owed()))} à rembourser (${esc(fmt(c.loans.reduce((a,l)=>a+l.per,0)))} par jour)`:''}</p>`;
 const gs=longGoals().slice(0,4),t=tutorial();
 h+='<h3 class="mw-h3">Prochains objectifs</h3>';
 if(t) h+=`<div class="mw-card"><b>${esc(t.titre)}</b><br><small>${esc(t.aide)}</small></div>`;
 for(const g of gs) h+=`<div class="mw-card"><b>${esc(g.titre)}</b>${g.manque.length?'<ul class="mw-cond">'+g.manque.map(x=>`<li class="no">✗ ${esc(x)}</li>`).join('')+'</ul>':''}</div>`;
 h+=`<div class="mw-btns">${btn('close','Fermer','ghost')}</div>`;
 MW.panel('Ma carrière',h,{wide:true});}
api.panel=careerPanel;

/* ── événements ── */
MW.on('start',()=>{
 const c=C();lastGoal='';hideBanner();
 for(const [k] of COMPS) c.lv[k]=level(k);
 applyCar();refresh();});
MW.on('open',()=>{hideBanner();applyCar();lastGoal='';refresh();});
MW.on('enterZone',id=>{if(id==='garage1') lastGoal='';});
MW.on('key',k=>{if(k==='c') careerPanel();});
MW.addButton('career','Carrière (C)',careerPanel);
MW.on('jobDone',(job,note)=>{
 const c=C();c.stats.jobs++;
 try{if(/vidange|"huile"/i.test(JSON.stringify(job&&job.travaux||''))) c.stats.vid++;}catch(e){}
 const p=api.payFor(job||{});if(p>0){c.stats.paid++;c.stats.earn+=p;}
 lvCheck();promoCheck();refresh();});
MW.on('money',(dx,motif)=>{if(dx>0&&/salaire|paie/i.test(motif||'')){const c=C();c.stats.paid++;refresh();}});
MW.on('day',d=>{
 const c=C(),e=employer();
 // loyer du garage
 if(e.loyer) MW.money(-e.loyer,'Loyer du garage');
 // prêts
 for(const l of c.loans.slice()){const p=Math.min(l.per,l.rest);MW.money(-p,'Remboursement du prêt');l.rest=Math.round((l.rest-p)*100)/100;if(l.rest<=.5) c.loans.splice(c.loans.indexOf(l),1);}
 // paie au mois : le 1er du mois de jeu (jours 31, 61, …)
 if(d%30===1&&e.paie==='mois'&&e.mois>0){const n=Math.min(30,d-(c.payFrom||d));
  if(n>0){const amt=Math.round(e.mois*n/30);MW.money(amt,'Salaire du mois');say(`Paie du mois : ${fmt(amt)}.`,'good');}}
 if(d%30===1) c.payFrom=d;
 // formations
 const f=c.form;
 if(f&&d>=f.fin){
  if(f.type==='stage'){MW.S.xp=MW.S.xp||{};MW.S.xp[f.comp]=(MW.S.xp[f.comp]||0)+f.xp;c.form=null;say('Stage terminé : vous avez gagné de l\'expérience.','good');}
  else if(!c.t['exam'+f.id+f.fin]){c.t['exam'+f.id+f.fin]=1;say('Votre examen est ouvert : passez au centre de formation.','good');}}
 lvCheck();promoCheck();refresh();});
let gT=0;
MW.on('tick',dt=>{gT+=dt;if(gT>.6){gT=0;if(MW.S&&MW.isOpen()) refresh();}});

/* ── portes ── */
for(const id of ['garage1','garage2','garage3','garage4']) MW.setDoor(id,counter);
MW.setDoor('ecole',school);MW.setDoor('bureau',bureau);MW.setDoor('banque',bank);MW.setDoor('concess',dealer);MW.setDoor('terrain',land);
return api;})();
