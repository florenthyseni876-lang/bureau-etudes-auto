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
const RAYON_MAX=.55;
const DISTANCE_MIN=.34;      /* mètres entre la caméra et le centre du cadrage */
const DISTANCE_MAX=1.7;
const MARGE=1.3;             /* > 1 : de l'air autour du groupe */
const HAUTEUR_MIN_CAMERA=.55; /* la caméra ne descend jamais dans le sol */
const ANGLE_PAR_DESSOUS=52;  /* degrés : pour une pièce sous la voiture, la caméra regarde vers le haut avec cet angle */
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
 pastilles:new Map()};
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
/* boîte englobante des cibles visibles du groupe → {centre, rayon} */
function boiteDuGroupe(groupe){
 const boite=new T.Box3();
 for(const t of groupe){
  if(!utilisable(t)) continue;
  const p=MWG.worldOf(t,v1);if(!p) continue;
  const r=t.r||.05;
  boite.expandByPoint(v2.copy(p).addScalar(r));
  boite.expandByPoint(v2.copy(p).addScalar(-r));}
 if(boite.isEmpty()) return null;
 const centre=boite.getCenter(new T.Vector3());
 const rayon=Math.min(RAYON_MAX,Math.max(RAYON_MIN,boite.getSize(v3).length()/2));
 return {centre,rayon};}
/* distance à laquelle un cercle de rayon `rayon` remplit l'écran (dans la plus petite des deux directions) */
function distanceDeCadrage(rayon){
 const cam=MW.cam,fovV=cam.fov*Math.PI/180;
 const fovH=2*Math.atan(Math.tan(fovV/2)*cam.aspect);
 const d=rayon/Math.sin(Math.min(fovV,fovH)/2)*MARGE;
 return Math.min(DISTANCE_MAX,Math.max(DISTANCE_MIN,d));}
/* zone de la pièce qu'une cible représente (js/41 : PARTS[id].zone = 'capot' | 'dessous' | 'roue' | 'cabine'), ou null */
function zoneDeCible(t){
 if(t.id==='plug'||t.id==='filt') return 'dessous';   /* bouchon de vidange et filtre à huile : ils n'ont pas de fiche de pièce propre */
 const m=/^(?:pt|fx|cv):([^:]+)/.exec(t.id),p=m&&MWJ.PARTS[m[1]];
 return p?p.zone:null;}
/* pièce sous une voiture levée : on la regarde par-dessous, comme le mécanicien debout sous le pont (et non de côté, à travers les bas de caisse) */
const vueParDessous=t=>zoneDeCible(t)==='dessous'&&!!rig().c.st.lifted;
/* direction du regard : des yeux vers le centre, ou, par-dessous, vers le haut en gardant le côté d'où vient le joueur */
function directionDuRegard(oeil,centre,parDessous){
 const dir=v1.copy(centre).sub(oeil);
 if(!parDessous){
  if(dir.lengthSq()<1e-4) dir.set(0,0,1);
  return dir.normalize();}
 dir.y=0;
 if(dir.lengthSq()<1e-4) dir.set(Math.sin(rig().p.ry),0,Math.cos(rig().p.ry));
 const a=ANGLE_PAR_DESSOUS*Math.PI/180;
 dir.normalize().multiplyScalar(Math.cos(a));
 dir.y=Math.sin(a);
 return dir;}
/* la caméra du cadrage : sur la ligne de regard, `distance` avant le centre, regard vers le centre */
function calculerPose(oeil,centre,distance,parDessous){
 const dir=directionDuRegard(oeil,centre,parDessous);
 const pos=centre.clone().addScaledVector(dir,-distance);
 pos.y=Math.max(pos.y,HAUTEUR_MIN_CAMERA);
 /* regard presque vertical (sous la voiture) : « le haut » de l'image est alors l'avant de la voiture */
 const haut=Math.abs(dir.y)>.97?v2.set(Math.sin(rig().p.ry),0,Math.cos(rig().p.ry)):v2.set(0,1,0);
 m1.lookAt(pos,centre,haut);
 return {pos,quat:new T.Quaternion().setFromRotationMatrix(m1)};}

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
/* taille en pixels d'une pastille : le rayon réel de la cible vu à la distance de la caméra */
function taillePastille(t,distance){
 const hauteur=MW.cam.fov*Math.PI/180,px=(t.r||.05)*2/Math.max(.05,distance)*(Z.ui.clientHeight/(2*Math.tan(hauteur/2)));
 return Math.max(16,Math.min(120,px));}
/* texte d'état d'une pastille : prête (action possible), bloquée (il manque une condition), conseillée par l'aide */
function etatPastille(t,vise,conseil){
 const actions=MWG.actsOf(t),possible=actions.some(estGeste);
 return 'mgz-dot'+(possible?' ok':' bloque')+(t===conseil?' conseil':'')+(vise&&vise.t===t?' vise':'');}
function majPastilles(){
 const racine=document.getElementById('mwRoot').getBoundingClientRect(),conseil=MWG.hintTarget(),vise=MWG.aim();
 const vus=new Set();
 for(const t of Z.groupe){
  if(!utilisable(t)) continue;
  const p=MWG.worldOf(t,v1);if(!p) continue;
  const distance=p.distanceTo(MW.cam.position);
  p.project(MW.cam);
  if(p.z>1) continue;                                   /* derrière la caméra */
  const el=pastilleDe(t),taille=taillePastille(t,distance);
  el.className=etatPastille(t,vise,conseil);
  el.style.width=el.style.height=taille+'px';
  el.style.left=((p.x+1)/2*racine.width)+'px';
  el.style.top=((1-p.y)/2*racine.height)+'px';
  el.hidden=false;vus.add(t.id);}
 for(const [id,el] of Z.pastilles) if(!vus.has(id)) el.hidden=true;}

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
 Z.pose=calculerPose(MW.cam.position,boite.centre,Z.distance,vueParDessous(cible));
 Z.k=0;Z.sortie=false;Z.faits=0;Z.finT=0;
 Z.verrou=!!document.pointerLockElement;
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
api.state=()=>({on:Z.on,k:Z.k,sortie:Z.sortie,faits:Z.faits,groupe:Z.groupe.map(t=>t.id),distance:Z.distance});
return api;
})();
