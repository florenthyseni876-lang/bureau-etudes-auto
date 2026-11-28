'use strict';
/* ───────────── Mode « Mécanicien » — VUE RAPPROCHÉE (« atelier rapproché ») ─────────────

   Pourquoi : viser avec le centre de l'écran une vis de 1 cm à 2 m de distance est pénible. Quand le joueur fait E sur un élément
   mécanique (bouchon, filtre, roue, étrier, bougie, batterie, courroie…), la caméra glisse en douceur vers un cadrage serré de la
   zone ; le joueur ne bouge plus ; la souris devient un VISEUR LIBRE : on clique directement sur la vis ou la pièce voulue.

   Comment ça marche, en quatre morceaux :
   1. Le GROUPE : toutes les cibles du rig (js/46) situées à moins de RAYON_GROUPE mètres de l'élément visé (le bouchon et le filtre,
      les cinq écrous d'une roue et son frein…). Les positions viennent des cibles elles-mêmes : rien n'est écrit en dur, donc
      cela marche sur toutes les voitures, pont levé ou non.
   2. Le CADRAGE : la boîte qui entoure le groupe donne un centre et un rayon ; la caméra se place sur la ligne « yeux du joueur →
      centre » à la distance qui fait entrer le groupe dans l'écran (donc par-dessous si le joueur est sous la voiture).
   3. La CAMÉRA : js/40 appelle `MW.camHook` juste avant le rendu ; on y mélange la caméra normale (celle du joueur) et la caméra
      du cadrage avec un coefficient qui va de 0 à 1 à l'entrée et de 1 à 0 à la sortie. Comme on mélange avec la caméra normale
      « vivante », la sortie rejoint toujours la vue du joueur, même s'il a bougé.
   4. Le VISEUR : le pointeur de la souris (ou le doigt) donne un rayon à js/46 (`MWG.setAimRay`) qui choisit la cible comme
      d'habitude (surbrillance, nom, outil pris automatiquement si l'aide est active). Appui = geste ; appui maintenu = geste long.

   Sortie : Échap, clic droit, E, bouton « Retour », ou automatiquement quand il n'y a plus rien à faire dans le groupe
   (la sous-tâche est finie : filtre posé, dernier écrou retiré…).

   ═══ API `MWZ` ═══
   MWZ.enter(cible, action)  entre en vue rapprochée sur une cible du rig ; renvoie faux si ce n'est pas possible (la cible n'est pas
                             un élément mécanique, l'action est bloquée…) : js/46 fait alors le geste normalement
   MWZ.leave(immediat)       revient à la vue normale (immediat = sans animation)
   MWZ.active()              vrai dès l'entrée et jusqu'à la fin du retour ; MWZ.ready() : vrai quand le cadrage est atteint
   MWZ.screenOf(id)          position écran {x, y} (pixels de la page) d'une cible du rig, ou null (sert aux tests)
   MWZ.state()               {on, k, groupe:[ids], faits} pour les tests
   Réglage : MW.S.gest.zoom (faux = mode classique) ; touche G.
   Points d'accroche : MW.camHook, MW.keyHook, MW.frozen, MW.releaseLock (js/40) ; MWG.setAimRay, pointerDown/Up, actsOf, worldOf… (js/46). */
const MWZ=(()=>{
const T=THREE;

/* ═══════════ Réglages (modifiables sans risque) ═══════════ */
const DUREE_ENTREE=.42;      /* secondes : glissement vers le cadrage */
const DUREE_SORTIE=.36;      /* secondes : retour à la vue normale */
const RAYON_GROUPE=.38;      /* mètres : les cibles plus proches que cela de l'élément visé font partie de la même zone de travail */
const RAYON_MIN=.10;         /* mètres : on ne cadre jamais plus serré que cela (une seule vis) */
const RAYON_MIN_ROUE=.30;    /* idem pour une roue : elle doit occuper environ 60 % de la hauteur de l'écran */
const RAYON_CIBLE_MAX=.14;   /* une cible plus grosse que cela (la roue) compte comme si elle faisait cette taille */
const TOLERANCE_OBSTACLE=.09; /* mètres : un obstacle si près de la cible est la pièce elle-même, pas un écran devant elle */
const RAYON_MAX=.55;
const DISTANCE_MIN=.34;      /* mètres entre la caméra et le centre du cadrage */
const DISTANCE_MAX=1.7;
const MARGE=1.3;             /* > 1 : de l'air autour du groupe */
const HAUTEUR_MIN_CAMERA=.55; /* la caméra ne descend jamais dans le sol */
const PASTILLE_MIN=14,PASTILLE_MAX=110,PASTILLE_DISCRETE=9; /* pixels */
const DELAI_FIN=.55;         /* secondes entre le dernier geste utile et le retour automatique */
/* cibles du rig qui ne sont PAS des éléments mécaniques : elles gardent le geste direct (servante, commandes, bac, noms de pièces…) */
const EXCLUS=/^(servante|lift|hood|door|pdoor|pedal|bac|nm:)/;
/* touches de déplacement : sans effet pendant la vue rapprochée */
const TOUCHES_MARCHE=['z','q','s','d','w','a','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Shift'];

/* ═══════════ État ═══════════ */
const Z={
 on:false,           /* vue rapprochée ouverte (entrée, cadrage ou sortie en cours) */
 sortie:false,       /* retour en cours */
 k:0,                /* progression 0 (vue normale) → 1 (cadrage atteint) */
 groupe:[],          /* cibles de la zone de travail */
 pose:null,          /* {pos, quat} : la caméra du cadrage */
 distance:1,         /* distance caméra → centre, sert à la taille des pastilles */
 ptr:{x:0,y:0},      /* pointeur, en pixels de la page */
 faits:0,            /* nombre de gestes faits depuis l'entrée */
 finT:0,             /* compte à rebours du retour automatique */
 verrou:false,       /* le pointeur était verrouillé (souris) : on le reverrouille en sortant */
 ui:null,            /* éléments de l'interface */
 pastilles:new Map(),
 dessin:[]};         /* pastilles dessinées à l'image précédente : {id, x, y, r, complete} (pour les tests) */
const api={};
const v1=new T.Vector3(),v2=new T.Vector3(),v3=new T.Vector3(),q1=new T.Quaternion(),m1=new T.Matrix4();
const rig=()=>MWG.rig();
const lissage=k=>k*k*(3-2*k);

/* ═══════════ 1. Le groupe de cibles ═══════════ */
/* une cible est « utilisable » si elle est visible maintenant et a au moins une action */
function utilisable(t){
 if(t.vis&&!t.vis()) return false;
 const o=typeof t.o==='function'?t.o():t.o;
 if(!o||!MWG.visOf(o.parent||o)) return false;
 return MWG.actsOf(t).length>0;}
const estMecanique=t=>!EXCLUS.test(t.id);
/* une action vaut un zoom si c'est un vrai geste : ni refusé, ni simple inspection */
const estGeste=a=>!!a&&!a.why&&!a.insp;
function constituerGroupe(cible){
 const centre=MWG.worldOf(cible,new T.Vector3());
 const groupe=[];
 for(const t of rig().tg){
  if(!estMecanique(t)) continue;
  const p=MWG.worldOf(t,v1);
  if(p&&p.distanceTo(centre)<=RAYON_GROUPE) groupe.push(t);}
 return groupe;}
/* y a-t-il encore un geste attendu dans la zone ? (sinon la sous-tâche est finie) */
function resteAFaire(){
 return Z.groupe.some(t=>utilisable(t)&&MWG.actsOf(t).some(a=>estGeste(a)&&a.exp));}

/* ═══════════ 2. Le cadrage ═══════════ */
/* rayon utile d'une cible pour le cadrage : une grosse cible (la roue entière) ne doit pas agrandir le cadre à elle seule */
const rayonDeCible=t=>Math.min(t.r||.05,RAYON_CIBLE_MAX);
/* une roue ou ses écrous : on cadre plus large que pour une vis, pour voir la roue entière */
const rayonMinimum=groupe=>groupe.some(t=>/^(wheel|nut):/.test(t.id))?RAYON_MIN_ROUE:RAYON_MIN;
/* boîte englobante des cibles visibles du groupe → {centre, rayon} */
function boiteDuGroupe(groupe){
 const boite=new T.Box3();
 for(const t of groupe){
  if(!utilisable(t)) continue;
  const p=MWG.worldOf(t,v1);if(!p) continue;
  const r=rayonDeCible(t);
  boite.expandByPoint(v2.copy(p).addScalar(r));
  boite.expandByPoint(v2.copy(p).addScalar(-r));}
 if(boite.isEmpty()) return null;
 const centre=boite.getCenter(new T.Vector3());
 const rayon=Math.min(RAYON_MAX,Math.max(rayonMinimum(groupe),boite.getSize(v3).length()/2));
 return {centre,rayon};}
/* distance à laquelle un cercle de rayon `rayon` remplit l'écran (dans la plus petite des deux directions) */
function distanceDeCadrage(rayon){
 const cam=MW.cam,fovV=cam.fov*Math.PI/180;
 const fovH=2*Math.atan(Math.tan(fovV/2)*cam.aspect);
 const d=rayon/Math.sin(Math.min(fovV,fovH)/2)*MARGE;
 return Math.min(DISTANCE_MAX,Math.max(DISTANCE_MIN,d));}
/* zone de la pièce qu'une cible représente : 'capot' | 'dessous' | 'roue' | 'cabine' (js/41 : PARTS[id].zone), ou null */
function zoneDeCible(t){
 if(t.id==='plug'||t.id==='filt') return 'dessous';   /* bouchon de vidange et filtre à huile : pas de fiche de pièce propre */
 if(/^(bp|cr|oilcap|fun|dip):?/.test(t.id)) return 'capot';  /* bougies, courroie d'accessoires, bouchon et jauge d'huile : dans la baie */
 if(/^(nut|wheel):/.test(t.id)) return 'roue';
 const m=/^(?:pt|fx|cv):([^:]+)/.exec(t.id),p=m&&MWJ.PARTS[m[1]];
 return p?p.zone:null;}
/* ── choix de l'angle de vue ──
   Pièce sous une voiture levée : on regarde par-dessous, comme le mécanicien debout sous le pont. Pièce de la baie moteur : on se penche
   au-dessus du moteur, regard vers le bas. Sinon : de là où se trouve le joueur. Chaque angle est essayé, du meilleur au moins bon :
   le premier dont aucune pièce de carrosserie ne cache les cibles est retenu (sinon celui qui en cache le moins). */
function elevationsPossibles(zone,naturelle){
 if(zone==='dessous') return [52,70,35,20];
 if(zone==='capot') return [-55,-72,-38,-20];
 return [naturelle,-25,10,-50];}
const DECALAGES_AZIMUT=[0,35,-35,70,-70,110,-110];
const PI=Math.PI,rad=d=>d*PI/180;
/* direction (de la caméra vers le centre) pour une élévation et un décalage d'azimut donnés, à partir du côté d'où vient le joueur */
function directionPour(horizontale,elevation,azimut){
 const h=horizontale.clone().applyAxisAngle(v3.set(0,1,0),rad(azimut)).multiplyScalar(Math.cos(rad(elevation)));
 h.y=Math.sin(rad(elevation));
 return h;}
/* ── obstacles : les maillages de la carrosserie (ni les pièces dessinées par le rig, ni le moteur de la baie) ── */
function maillagesObstacles(){
 const r=rig(),liste=[];
 const baie=r.g.userData.bay; /* le moteur dessiné de la baie entoure les cibles : il n'est pas un écran devant elles */
 r.g.traverse(o=>{
  if(!o.isMesh||o.userData.hl||!MWG.visOf(o)) return;
  for(let p=o;p;p=p.parent) if(p===r.root||p===r.fl||p===baie) return;
  liste.push(o);});
 return liste;}
const RAYON_TEST=new T.Raycaster();
/* distance du premier obstacle entre `de` et `vers` (Infinity s'il n'y en a pas) */
function distanceObstacle(de,vers,obstacles){
 const d=v1.copy(vers).sub(de),L=d.length();
 if(L<1e-4) return Infinity;
 RAYON_TEST.set(de,d.divideScalar(L));RAYON_TEST.near=0;RAYON_TEST.far=L;
 const h=RAYON_TEST.intersectObjects(obstacles,false);
 return h.length?h[0].distance:Infinity;}
/* nombre de cibles du groupe (et centre) qu'une pièce de carrosserie cache depuis cette caméra */
function nbCachees(pos,centre,points,obstacles){
 let n=0;
 for(const p of [centre].concat(points)){
  const L=pos.distanceTo(p);
  if(distanceObstacle(pos,p,obstacles)<L-TOLERANCE_OBSTACLE) n++;}
 return n;}
/* positions (monde) des cibles du groupe sur lesquelles on peut agir ; sinon de toutes les cibles visibles */
function pointsAVoir(groupe){
 const utiles=groupe.filter(t=>utilisable(t));
 const agir=utiles.filter(t=>MWG.actsOf(t).some(estGeste));
 return (agir.length?agir:utiles).map(t=>MWG.worldOf(t,new T.Vector3())).filter(Boolean);}
function poseDepuis(centre,dir,distance){
 const pos=centre.clone().addScaledVector(dir,-distance);
 pos.y=Math.max(pos.y,HAUTEUR_MIN_CAMERA);
 /* regard presque vertical : « le haut » de l'image est alors l'avant de la voiture */
 const haut=Math.abs(dir.y)>.97?v2.set(Math.sin(rig().p.ry),0,Math.cos(rig().p.ry)):v2.set(0,1,0);
 m1.lookAt(pos,centre,haut);
 return {pos,quat:new T.Quaternion().setFromRotationMatrix(m1),dir:dir.clone(),distance};}
/* la caméra du cadrage : on essaie les angles dans l'ordre et on garde le premier dont la vue est dégagée */
function calculerPose(oeil,centre,distance,groupe,zone){
 const h=v1.copy(centre).sub(oeil),naturelle=Math.atan2(h.y,Math.hypot(h.x,h.z))*180/PI;
 h.y=0;
 if(h.lengthSq()<1e-4) h.set(Math.sin(rig().p.ry),0,Math.cos(rig().p.ry));
 const horizontale=h.normalize().clone();
 const obstacles=maillagesObstacles(),points=pointsAVoir(groupe);
 let meilleure=null;
 for(const el of elevationsPossibles(zone,naturelle)){
  for(const az of DECALAGES_AZIMUT){
   const essai=poseDepuis(centre,directionPour(horizontale,el,az),distance);
   essai.cachees=nbCachees(essai.pos,centre,points,obstacles);
   if(!meilleure||essai.cachees<meilleure.cachees) meilleure=essai;
   if(!essai.cachees) return meilleure;}}
 return meilleure;}

/* ═══════════ 3. La caméra ═══════════ */
/* appelé par js/40 à chaque image, juste avant le rendu : `cam` porte déjà la vue normale du joueur */
function crochetCamera(cam,dt){
 if(!Z.on) return;
 const pas=dt/(Z.sortie?DUREE_SORTIE:DUREE_ENTREE);
 Z.k=Z.sortie?Math.max(0,Z.k-pas):Math.min(1,Z.k+pas);
 if(Z.sortie&&Z.k<=0){terminer();return;}
 const e=lissage(Z.k);
 cam.position.lerp(Z.pose.pos,e);
 cam.quaternion.slerp(Z.pose.quat,e);}

/* ═══════════ 4. Le viseur libre ═══════════ */
function lookEl(){return document.getElementById('mwLook');}
/* rayon de visée donné à js/46 : part de la caméra, passe par le pointeur */
function rayonDuPointeur(){
 const r=lookEl().getBoundingClientRect(),cam=MW.cam;
 const nx=(Z.ptr.x-r.left)/Math.max(1,r.width)*2-1,ny=-((Z.ptr.y-r.top)/Math.max(1,r.height))*2+1;
 const d=v1.set(nx,ny,.5).unproject(cam).sub(cam.position).normalize();
 return {o:cam.position,d,only:Z.groupe};}
function placerPointeur(e){
 Z.ptr.x=e.clientX;Z.ptr.y=e.clientY;
 const racine=document.getElementById('mwRoot').getBoundingClientRect();
 const style=document.getElementById('mwRoot').style;
 style.setProperty('--px',(e.clientX-racine.left)+'px');
 style.setProperty('--py',(e.clientY-racine.top)+'px');}
const bloquer=e=>{e.stopImmediatePropagation();};
const quandPointeurBouge=e=>{placerPointeur(e);bloquer(e);};
function quandAppui(e){
 bloquer(e);
 if(Z.sortie) return;
 if(e.button===2){e.preventDefault();api.leave();return;}   /* clic droit : retour */
 if(e.button!==0) return;
 placerPointeur(e);
 MWG.aimNow();                                              /* la visée doit être celle de CE pixel, pas celle de l'image précédente */
 MWG.pointerDown();}
function quandRelache(e){bloquer(e);MWG.pointerUp();}
/* molette : change de douille si l'outil en main en a une ; sinon on laisse js/46 changer d'outil */
function quandMolette(e){
 const outil=MWG.tools.find(t=>t.id===MWG.curTool());
 if(!outil||!outil.sock) return;
 e.preventDefault();bloquer(e);
 MWG.cycleSock(e.deltaY>0?1:-1);}
const sansMenu=e=>{e.preventDefault();bloquer(e);};
const ECOUTEURS=[['pointermove',quandPointeurBouge],['pointerdown',quandAppui],['pointerup',quandRelache],['pointercancel',quandRelache],
 ['click',bloquer],['contextmenu',sansMenu],['wheel',quandMolette]];
function brancherPointeur(){for(const [n,f] of ECOUTEURS) lookEl().addEventListener(n,f,{capture:true,passive:false});}
function debrancherPointeur(){for(const [n,f] of ECOUTEURS) lookEl().removeEventListener(n,f,{capture:true});}
/* touches : Échap et E ramènent la vue normale ; la marche est bloquée ; les autres (outils, R) passent */
function crochetTouches(k,down){
 if(!Z.on||Z.sortie||MW.paused) return false;
 if(k==='Escape'||k==='e'){if(down) api.leave();return true;}
 return TOUCHES_MARCHE.includes(k);}

/* ═══════════ Interface : pastilles sur les points cliquables, bouton de retour, aide ═══════════ */
function creerInterface(){
 if(Z.ui&&Z.ui.isConnected) return Z.ui;
 const c=document.createElement('div');
 c.className='mgz';c.hidden=true;
 c.innerHTML='<div class="mgz-pts"></div><button type="button" class="mgz-quit">✕ Retour</button>'
  +'<div class="mgz-aide">Cliquez sur la vis ou la pièce · maintenez pour un geste long · molette ou R : douille · clic droit, Échap ou E : retour</div>';
 document.getElementById('mwRoot').appendChild(c);
 c.querySelector('.mgz-quit').addEventListener('click',()=>api.leave());
 Z.ui=c;Z.pastilles.clear();
 return c;}
function pastilleDe(t){
 let p=Z.pastilles.get(t.id);
 if(!p){p=document.createElement('i');p.className='mgz-dot';Z.ui.firstChild.appendChild(p);Z.pastilles.set(t.id,p);}
 return p;}
/* une cible est « attendue » quand un geste utile y est possible maintenant (les autres ne sont qu'un petit point discret) */
const attendue=t=>MWG.actsOf(t).some(a=>estGeste(a)&&a.exp);
/* taille naturelle en pixels d'une pastille : le rayon réel de la cible vu à la distance de la caméra */
function tailleNaturelle(t,distance){
 const hauteur=MW.cam.fov*Math.PI/180,px=rayonDeCible(t)*2/Math.max(.05,distance)*(Z.ui.clientHeight/(2*Math.tan(hauteur/2)));
 return Math.max(PASTILLE_MIN,Math.min(PASTILLE_MAX,px));}
/* états d'une pastille : attendue (cercle plein), possible, bloquée (pointillés), discrète (petit point), conseillée par l'aide, survolée */
function classePastille(t,complete,vise,conseil){
 const possible=MWG.actsOf(t).some(estGeste);
 return 'mgz-dot'+(complete?(possible?' ok':' bloque'):' discret')+(t===conseil?' conseil':'')+(vise&&vise.t===t?' vise':'');}
/* positions écran (pixels de la racine) des cibles utilisables du groupe */
function projeterGroupe(racine){
 const liste=[];
 for(const t of Z.groupe){
  if(!utilisable(t)) continue;
  const p=MWG.worldOf(t,v1);if(!p) continue;
  const distance=p.distanceTo(MW.cam.position);
  p.project(MW.cam);
  if(p.z>1) continue;                                   /* derrière la caméra */
  liste.push({t,distance,x:(p.x+1)/2*racine.width,y:(1-p.y)/2*racine.height});}
 return liste;}
/* les pastilles pleines ne doivent pas se chevaucher : chacune est limitée à 90 % de la distance à sa voisine pleine la plus proche */
function limiterAuxVoisines(pleines){
 for(const a of pleines){
  let voisine=Infinity;
  for(const b of pleines) if(b!==a) voisine=Math.min(voisine,Math.hypot(a.x-b.x,a.y-b.y));
  a.taille=Math.max(PASTILLE_MIN,Math.min(a.taille,voisine*.9));}}
function majPastilles(){
 const racine=document.getElementById('mwRoot').getBoundingClientRect(),conseil=MWG.hintTarget(),vise=MWG.aim();
 const liste=projeterGroupe(racine);
 for(const it of liste){
  it.complete=attendue(it.t)||it.t===conseil||(!!vise&&vise.t===it.t);
  it.taille=it.complete?tailleNaturelle(it.t,it.distance):PASTILLE_DISCRETE;}
 limiterAuxVoisines(liste.filter(it=>it.complete));
 const vus=new Set();
 for(const it of liste){
  const el=pastilleDe(it.t);
  el.className=classePastille(it.t,it.complete,vise,conseil);
  el.style.width=el.style.height=it.taille+'px';
  el.style.left=it.x+'px';el.style.top=it.y+'px';
  el.hidden=false;vus.add(it.t.id);}
 for(const [id,el] of Z.pastilles) if(!vus.has(id)) el.hidden=true;
 Z.dessin=liste.map(it=>({id:it.t.id,x:it.x,y:it.y,r:it.taille/2,complete:it.complete}));}

/* ═══════════ Entrée, sortie, fin automatique ═══════════ */
function peutEntrer(cible,action){
 if(Z.on||!MWG.rig()||MW.paused) return false;
 return estMecanique(cible)&&estGeste(action);}
api.enter=(cible,action)=>{
 if(!peutEntrer(cible,action)) return false;
 const groupe=constituerGroupe(cible),boite=boiteDuGroupe(groupe);
 if(!boite) return false;
 Z.groupe=groupe;
 Z.distance=distanceDeCadrage(boite.rayon);
 Z.zone=zoneDeCible(cible);
 Z.pose=calculerPose(MW.cam.position,boite.centre,Z.distance,groupe,Z.zone);
 Z.k=0;Z.sortie=false;Z.faits=0;Z.finT=0;
 Z.verrou=!!document.pointerLockElement;
 MWG.clearAux();                                  /* pas de panneau de jauge resté d'un travail précédent */
 if(Z.verrou) MW.releaseLock();                 /* le pointeur redevient visible */
 const r=lookEl().getBoundingClientRect();
 Z.ptr.x=r.left+r.width/2;Z.ptr.y=r.top+r.height/2;
 creerInterface().hidden=false;
 document.getElementById('mwRoot').classList.add('mgz-on');
 MW.frozen=true;MW.camHook=crochetCamera;MW.keyHook=crochetTouches;
 MWG.setAimRay(rayonDuPointeur);
 brancherPointeur();
 Z.on=true;
 return true;};
api.leave=immediat=>{
 if(!Z.on) return;
 MWG.cancelHold();
 MWG.setAimRay(null);
 MW.frozen=false;                               /* le joueur peut remarcher tout de suite, la caméra le rejoint en glissant */
 debrancherPointeur();
 if(Z.ui) Z.ui.hidden=true;
 document.getElementById('mwRoot').classList.remove('mgz-on');
 Z.sortie=true;
 if(immediat){Z.k=0;terminer();}};
function terminer(){
 Z.on=false;Z.sortie=false;Z.k=0;Z.groupe=[];
 if(MW.camHook===crochetCamera) MW.camHook=null;
 if(MW.keyHook===crochetTouches) MW.keyHook=null;
 if(Z.verrou){try{lookEl().requestPointerLock();}catch(e){}Z.verrou=false;}}
api.active=()=>Z.on;
api.ready=()=>Z.on&&!Z.sortie&&Z.k>=1;
/* chaque geste réussi : on note qu'il y en a eu (le retour automatique n'a de sens qu'après un geste) */
MW.on('geste',()=>{if(Z.on&&!Z.sortie) Z.faits++;});
/* à chaque image : pastilles, et retour automatique quand la sous-tâche est finie */
MW.on('tick',dt=>{
 if(!Z.on||Z.sortie) return;
 majPastilles();
 const enGeste=MWG.holding2();
 if(Z.faits>0&&!enGeste&&!resteAFaire()){Z.finT+=dt;if(Z.finT>=DELAI_FIN) api.leave();}
 else Z.finT=0;});
/* pour les tests */
api.screenOf=id=>{
 const t=rig()&&rig().tg.find(q=>q.id===id);if(!t) return null;
 const p=MWG.worldOf(t,new T.Vector3());if(!p) return null;
 p.project(MW.cam);
 const r=lookEl().getBoundingClientRect();
 return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height,derriere:p.z>1};};
/* pour les tests : une carrosserie cache-t-elle une cible actionnable depuis la caméra du cadrage ? et les pastilles pleines se chevauchent-elles ? */
api.cachees=()=>{
 if(!Z.on) return null;
 const points=pointsAVoir(Z.groupe),obstacles=maillagesObstacles();
 return nbCachees(MW.cam.position,boiteDuGroupe(Z.groupe).centre,points,obstacles);};
api.chevauchements=()=>{
 const p=Z.dessin.filter(d=>d.complete);let n=0;
 for(let i=0;i<p.length;i++) for(let j=i+1;j<p.length;j++) if(Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y)<(p[i].r+p[j].r)*.98) n++;
 return n;};
api.state=()=>({on:Z.on,k:Z.k,sortie:Z.sortie,faits:Z.faits,groupe:Z.groupe.map(t=>t.id),distance:Z.distance,zone:Z.zone,cachees:Z.pose?Z.pose.cachees:null,pastilles:Z.dessin.length});
return api;
})();
