'use strict';
/* ───────────── Mode « Mécanicien » — SOCLE (monde ouvert 3D) ─────────────
   Ce fichier fabrique la ville, le joueur (à pied ou en voiture), l'horloge, l'argent, la sauvegarde,
   l'interface (HUD, messages, panneaux, cartes) et les contrôles tactiles. Les modules 41 (travaux) et
   42 (carrière) ne s'appuient QUE sur l'objet global `MW` décrit ici.

   ═══ CONTRAT `MW` ═══
   Conventions : repère three.js. x vers l'est, z vers le sud (« nord » = z négatif), y vers le haut, unités = mètres.
   Un cap `ry` est l'angle du vecteur avant : avant = (sin ry, cos ry). `ry = 0` regarde vers +z ; `ry = π/2` vers +x.
   Les voitures ont leur avant vers +z (dans le repère du modèle) ; un modèle posé avec rotation.y = ry roule donc vers (sin ry, cos ry).
   Gauche d'un cap = (cos ry, −sin ry).

   ── État ──
   MW.S                 état sauvegardé (JSON) : {v:1, day, min, money, xp:{}, rep, inv:[], player:{x,z,ry,inCar},
                        car:{x,z,ry}, flags:{}, ledger:[], marker}. Les modules rangent leurs données dans leur propre
                        sous-objet (MW.S.jobs, MW.S.career…), créé par eux si absent. ATTENTION : MW.S est un NOUVEL objet à
                        chaque partie chargée ou créée : relire `MW.S` à chaque usage, ne pas garder l'ancienne référence.
                        `day` change à 6 h (le « jour de jeu » commence à 6 h) ; `min` = minutes écoulées depuis minuit (0..1439).
   MW.reset()           nouvelle partie (efface la sauvegarde, émet 'start').
   MW.save()            sauvegarde localStorage 'bea.meca.v1' (aussi toutes les 30 s, à la fermeture et quand la page se cache).

   ── Cycle de vie ──
   MW.open()            ouvre le mode (charge la sauvegarde ou crée une partie ; émet 'start' à la 1re ouverture de la session)
   MW.close()           sauvegarde, ferme et revient à l'accueil
   MW.suspend()         comme close() mais SANS revenir à l'accueil (pour ouvrir un autre écran du jeu, p. ex. le bureau
                        d'études libre ; revenir ensuite avec MW.open()). MW.isOpen() dit si le mode est affiché.
   MW.on(evt,fn)        s'abonne ; renvoie une fonction de désabonnement. Événements :
                          'start'      partie chargée / créée (monde construit) : (re)initialiser ses données depuis MW.S.
                                       Émis à la 1re ouverture de la session puis à chaque MW.reset().
                          'open' / 'close'   le mode devient visible / est masqué (open, close, suspend)
                          'tick' (dt)  chaque image (dt en secondes), même en pause (tester MW.paused)
                          'minute'     chaque minute de jeu ; 'hour' (h) chaque heure ronde ; 'day' (n°) à 6 h, nouveau jour
                          'enterZone' / 'leaveZone' (id)   le joueur (ou sa voiture) entre dans / quitte une zone
                          'money' (dx,motif)   après chaque mouvement d'argent
                          'key' (touche, événement)   touche non réservée au socle, hors pause (touche en minuscules :
                                       'c', 'i', 'tab'…). Réservées : z q s d w a flèches, e f m, maj, espace, échap.
                          'tab'        touche Tab (inventaire / carnet), hors pause
   MW.emit(evt,...a)    émet un événement (les modules peuvent émettre les leurs : 'jobDone'…)
   MW.timeScale         minutes de jeu par seconde réelle (1,6 par défaut : 24 h de jeu = 15 min réelles ; les gestes de réparation avancent l'horloge sans temps réel)
   MW.paused            vrai quand un panneau, la carte ou le sommeil bloquent le jeu (l'horloge s'arrête aussi)

   ── Monde ──
   MW.scene, MW.cam, MW.THREE
   MW.zones             tableau de zones {id, nom, court, type, x, z, w, d, porte:{x,z}, interior, side, ry, door:{x,z}, …}
                        x,z = CENTRE du bâtiment, w (est-ouest) × d (nord-sud). `porte` = point d'interaction devant l'entrée,
                        à l'extérieur. `ry` = cap d'une voiture qui entre par la porte. Disponible dès le chargement du fichier.
                        Garages (garage1..4) : zone.interior=true, zone.ponts=[{x,z,ry}], zone.etabli={x,z},
                        zone.etagere={x,z}, zone.accueil={x,z} (comptoir d'accueil, près de l'entrée ; c'est l'endroit
                        d'interaction par défaut du garage). Les x,z de ponts/établi/étagère/accueil sont les CENTRES des
                        objets ; l'avant de l'établi / de l'étagère est tourné vers la porte (se placer à ~1,3 m vers la porte).
                        Ids : appart, garage1 (Garage du Coin), pieces, garage2 (Ventoux), garage3 (Maison Aurèle),
                        garage4 (Scuderia Brivio), ecole, bureau, banque, terrain, concess.
                        Types : logement, garage, magasin, ecole, bureau, banque, terrain, occasion.
   MW.zone(id)          zone par identifiant
   MW.zoneAt(x,z)       zone contenant le point, ou null (intérieur du bâtiment ; pour les bâtiments sans intérieur, 5 m de
                        parvis autour sont comptés)
   MW.player()          {x,z,ry,inCar,zone (identifiant ou null), zoneObj, pitch}
   MW.teleport(x,z,ry)  déplace le joueur (et sa voiture s'il est dedans)
   MW.playerCar()       {mesh (THREE.Group), x, z, ry, speed (m/s)}
   MW.setMarker(cible,etiquette)  repère jaune sur les cartes et faisceau 3D : cible = id de zone, {x,z} ou null
   MW.setDoor(zoneId,fn)  remplace l'action de la porte (accueil pour un garage) : fn(zone) est appelée avec E ; sans fn, rétablit
                        le panneau « Bientôt »
   MW.addInteract(o)    o={id,x,y,z,r (rayon, 1,6),label:()=>texte|texte,key:'E',when:()=>bool,use:()=>void} ; affiche « [E] label »
                        quand le joueur est proche ET regarde l'objet ; un même id REMPLACE l'ancien ; renvoie o.
   MW.removeInteract(id)
   MW.box(w,h,d,color,x,y,z) / MW.cyl(r,h,color,x,y,z)  maillage simple ajouté à la scène (x,y,z = CENTRE) ; renvoient le Mesh.
                        color = nombre 0xRRGGBB.
   MW.carMesh(opts)     opts={color,kind:'citadine'|'berline'|'sport'|'suv'|'utilitaire'} → THREE.Group (pas ajouté à la scène),
                        avant vers +z, longueur ≈ 3,7 à 4,8 m, pieds au sol (y = 0). Roues = enfants 'wFL','wFR','wRL','wRR'
                        (ordre de rotation 'YXZ' : tourner en y pour braquer, en x pour rouler), capot = enfant 'hood' (charnière
                        à l'arrière du capot : rotation.x = −1,0 l'ouvre). Aussi userData:{L,W,kind}.

   ── Interface ──
   MW.money(dx,motif)   ajoute/retire de l'argent (euros), petit message, historique MW.S.ledger (30 dernières) ; renvoie le solde
   MW.fmt(x)            montant formaté (monnaie du jeu, via moneyF)
   MW.toast(texte,genre)  message éphémère ; genre 'info'|'good'|'warn'|'crit'
   MW.panel(titre,html,{onClick,onClose,wide})  panneau modal ; les éléments [data-mw="action"] déclenchent onClick(action,bouton) ;
                        l'action réservée 'close' ferme le panneau ; ouvrir un panneau en remplace un autre.
   MW.closePanel()
   MW.hud(id,html)      zone de texte permanente (id : 'job', 'career', 'goal'…) ; html vide = masquer
   MW.addButton(id,libelle,fn)  bouton dans la barre en haut à droite (utile au tactile : Carnet, Carrière…) ; MW.removeButton(id)
   MW.timeStr()         « Jour 3 · 14:25 »   MW.hourF() heure décimale   MW.isNight()
   MW.addMin(n)         fait avancer l'horloge de n minutes (émet 'minute', 'hour', 'day' au passage)
   MW.sleep()           dort jusqu'à 7 h 30 (jour suivant ; le nouveau jour commence à 6 h au passage), sauvegarde
   MW.homeInfo()        (interne) met à jour le bouton de l'accueil
   Raccourci de test : window.__mw = MW. */
const MW=(()=>{
const T=THREE,PI=Math.PI,SAVE_KEY='bea.meca.v1';
const api={THREE:T,paused:false,timeScale:1.6,S:null};
let S=null;
const sceneObj=new T.Scene(),cam=new T.PerspectiveCamera(70,1.6,.1,520);
cam.rotation.order='YXZ';
api.scene=sceneObj;api.cam=cam;

/* ── événements ── */
const evs={};
api.on=(e,f)=>{(evs[e]=evs[e]||[]).push(f);return()=>{const a=evs[e];if(a){const i=a.indexOf(f);if(i>=0) a.splice(i,1);}};};
api.emit=(e,...a)=>{for(const f of (evs[e]||[]).slice()){try{f(...a);}catch(err){console.error('MW '+e+' : '+(err&&err.message?err.message:err));}}};
const emit=api.emit;

/* ── géométries et matériaux partagés ── */
const GB=new Map(),GC=new Map(),MT=new Map();
const gBox=(w,h,d)=>{const k=w+'|'+h+'|'+d;let g=GB.get(k);if(!g){g=new T.BoxGeometry(w,h,d);GB.set(k,g);}return g;};
const gCyl=(r,h,n)=>{const k=r+'|'+h+'|'+(n||14);let g=GC.get(k);if(!g){g=new T.CylinderGeometry(r,r,h,n||14);GC.set(k,g);}return g;};
const mat=(c,em)=>{const k=c+'|'+(em||0);let m=MT.get(k);if(!m){m=new T.MeshLambertMaterial({color:c});if(em) m.emissive=new T.Color(c).multiplyScalar(em);MT.set(k,m);}return m;};
const mk=(g,m,x,y,z)=>{const o=new T.Mesh(g,m);o.position.set(x||0,y||0,z||0);return o;};
api.box=(w,h,d,c,x,y,z)=>{const o=mk(gBox(w,h,d),mat(c),x,y,z);sceneObj.add(o);return o;};
api.cyl=(r,h,c,x,y,z)=>{const o=mk(gCyl(r,h),mat(c),x,y,z);sceneObj.add(o);return o;};

/* ── voitures en boîtes ── */
const KINDS={
 citadine:{L:3.7,W:1.65,bh:.62,ch:.55,cl:.5,co:-.08,wr:.29},
 berline:{L:4.6,W:1.8,bh:.6,ch:.5,cl:.5,co:-.12,wr:.32},
 sport:{L:4.4,W:1.9,bh:.5,ch:.42,cl:.4,co:-.16,wr:.33},
 suv:{L:4.5,W:1.9,bh:.85,ch:.6,cl:.62,co:-.1,wr:.38},
 utilitaire:{L:4.8,W:1.9,bh:.95,ch:.85,cl:.3,co:.28,wr:.34}};
api.carMesh=function(o){
 o=o||{};const K=KINDS[o.kind]||KINDS.berline,col=o.color!=null?o.color:0xb03030,g=new T.Group();
 const y0=K.wr*.7,top=y0+K.bh;
 g.add(mk(gBox(K.W,K.bh,K.L),mat(col),0,y0+K.bh/2,0));
 const cl=K.cl*K.L;
 g.add(mk(gBox(K.W-.18,K.ch,cl),mat(0x2b3a4a),0,top+K.ch/2,K.co*K.L));
 g.add(mk(gBox(K.W-.14,.06,cl+.08),mat(col),0,top+K.ch+.03,K.co*K.L));
 // capot : charnière à l'arrière, plaque posée sur le moteur
 const hl=K.L*.3,hood=new T.Group();hood.name='hood';hood.position.set(0,top+.02,K.L/2-hl);
 hood.add(mk(gBox(K.W-.1,.06,hl),mat(col),0,.03,hl/2));g.add(hood);
 g.add(mk(gBox(K.W*.6,.04,hl*.8),mat(0x4a4f55),0,top-.01,K.L/2-hl*.55));
 for(const s of [-1,1]){
  g.add(mk(gBox(.34,.14,.06),mat(0xfff2b0,.9),s*K.W*.34,y0+K.bh*.62,K.L/2+.02));
  g.add(mk(gBox(.3,.14,.06),mat(0xc01818,.6),s*K.W*.36,y0+K.bh*.62,-K.L/2-.02));}
 g.add(mk(gBox(K.W*.5,.18,.05),mat(0x22262b),0,y0+K.bh*.4,K.L/2+.02));
 const wz=K.L*.3,wx=K.W/2-.1,names={wFL:[1,1],wFR:[-1,1],wRL:[1,-1],wRR:[-1,-1]};
 for(const n in names){const w=new T.Group();w.name=n;w.rotation.order='YXZ';w.position.set(names[n][0]*wx,K.wr,names[n][1]*wz);
  const t=mk(gCyl(K.wr,.24,14),mat(0x1a1a1c),0,0,0),r=mk(gCyl(K.wr*.6,.26,10),mat(0xb8bcc4),0,0,0);
  t.rotation.z=r.rotation.z=PI/2;w.add(t,r);g.add(w);}
 g.userData={L:K.L,W:K.W,kind:o.kind||'berline'};return g;};

/* ═══════════ La carte ═══════════ */
const SIDES={N:{x:0,z:1},S:{x:0,z:-1},E:{x:-1,z:0},W:{x:1,z:0}};
const RX=[-150,0,150],RZ=[-150,0,150],HALF=290;
const ZD=[
 {id:'appart',nom:'Votre studio',court:'Studio',type:'logement',x:-30,z:19,w:20,d:14,side:'N',H:6.5,wall:0xc9b8a0,roof:0x7a4a3a,sign:0x4a5a78,fg:'#fff'},
 {id:'garage1',nom:'Garage du Coin',court:'Garage du Coin',type:'garage',x:-72,z:22,w:26,d:20,side:'N',H:5.4,wall:0x8a96a3,roof:0x4a5560,sign:0xe86a1c,fg:'#fff',interior:true,np:2,floor:0x6a6e72},
 {id:'pieces',nom:'Pièces Auto Express',court:'Pièces Auto',type:'magasin',x:22,z:20,w:22,d:16,side:'N',H:6,wall:0xe3d9b0,roof:0x8a3030,sign:0xf0c020,fg:'#1a1a1a'},
 {id:'concess',nom:'Occasions du Marché',court:'Occasions',type:'occasion',x:66,z:21,w:26,d:18,side:'N',H:6,wall:0xd7c0e0,roof:0x5a3a70,sign:0x7a3aa0,fg:'#fff'},
 {id:'garage2',nom:'Atelier Ventoux Automobiles',court:'Ventoux',type:'garage',x:-78,z:-28,w:36,d:32,side:'S',H:6,wall:0xe8ecf0,roof:0x3a5a8a,sign:0x2a5db0,fg:'#fff',interior:true,np:3,floor:0x8a8f95},
 {id:'garage3',nom:'Maison Aurèle',court:'Maison Aurèle',type:'garage',x:50,z:-28,w:34,d:32,side:'S',H:6.4,wall:0xf3ecdc,roof:0x2a2a30,sign:0x1c1c22,fg:'#e6c46a',interior:true,np:3,floor:0xe9e4d8},
 {id:'garage4',nom:'Scuderia Brivio',court:'Scuderia Brivio',type:'garage',x:110,z:-26,w:30,d:28,side:'S',H:5.8,wall:0x7a2a2a,roof:0x2a2a2a,sign:0xc01818,fg:'#fff',interior:true,np:2,floor:0x4a4a4e},
 {id:'ecole',nom:'Centre de formation automobile',court:'Formation',type:'ecole',x:-70,z:124,w:34,d:24,side:'S',H:8,wall:0xc7d8b8,roof:0x4a6a3a,sign:0x2f7a3a,fg:'#fff'},
 {id:'banque',nom:'Banque du Quartier',court:'Banque',type:'banque',x:-30,z:125,w:22,d:22,side:'S',H:9,wall:0xd4d8de,roof:0x1f3558,sign:0x1f3558,fg:'#fff'},
 {id:'bureau',nom:'Centre technique',court:'Centre technique',type:'bureau',x:80,z:122,w:40,d:30,side:'S',H:11,wall:0xb8c8d6,roof:0x45586a,sign:0x1f7f8f,fg:'#fff'},
 {id:'terrain',nom:'Terrain industriel à vendre',court:'Terrain à vendre',type:'terrain',x:-184,z:70,w:44,d:36,side:'E',H:1.5,wall:0xc88a2a,roof:null,sign:0xd8741a,fg:'#fff',interior:true,np:0,floor:0x9a8a6a}];
const zones=ZD.map(d=>{
 const n=SIDES[d.side],hx=d.w/2,hz=d.d/2,dx=d.x-n.x*hx,dz=d.z-n.z*hz,t={x:Math.abs(n.z),z:Math.abs(n.x)};
 const loc=(u,v)=>({x:dx+t.x*u+n.x*v,z:dz+t.z*u+n.z*v});
 const z={id:d.id,nom:d.nom,court:d.court,type:d.type,x:d.x,z:d.z,w:d.w,d:d.d,side:d.side,interior:!!d.interior,
  ry:Math.atan2(n.x,n.z),n:{x:n.x,z:n.z},door:{x:dx,z:dz},porte:{x:dx-n.x*1.3,z:dz-n.z*1.3},col:d.sign,_d:d,loc};
 if(d.type==='garage'){
  const ry=z.ry,pv=d.d*.42,us=d.np===3?[-d.w*.28,0,d.w*.28]:[-d.w*.2,d.w*.2];
  z.ponts=us.map(u=>{const p=loc(u,pv);return {x:p.x,z:p.z,ry};});
  z.etabli=loc(-d.w/2+3.6,d.d-1.2);z.etagere=loc(d.w/2-3.4,d.d-.9);z.accueil=loc(d.w/2-3.2,3);}
 return z;});
api.zones=zones;
const zById={};for(const z of zones) zById[z.id]=z;
api.zone=id=>zById[id]||null;
api.zoneAt=(x,y)=>{for(const z of zones){const m=z.interior?0:5;if(Math.abs(x-z.x)<=z.w/2+m&&Math.abs(y-z.z)<=z.d/2+m) return z;}return null;};

/* ── colliders (rectangles alignés sur les axes : [x0,z0,x1,z1]) ── */
const walls=[];
const addCol=(x,z,w,d)=>walls.push([x-w/2,z-d/2,x+w/2,z+d/2]);
function pushOut(px,pz,r){ // pousse un cercle hors des rectangles ; renvoie {x,z,hit}
 let hit=false;
 for(let pass=0;pass<2;pass++)for(let i=0;i<walls.length;i++){const w=walls[i];
  if(px<w[0]-r||px>w[2]+r||pz<w[1]-r||pz>w[3]+r) continue;
  const cx=Math.max(w[0],Math.min(px,w[2])),cz=Math.max(w[1],Math.min(pz,w[3])),dx=px-cx,dz=pz-cz,d2=dx*dx+dz*dz;
  if(d2>=r*r) continue;hit=true;
  if(d2>1e-8){const d=Math.sqrt(d2),k=(r-d)/d;px+=dx*k;pz+=dz*k;}
  else{const l=px-w[0],rr=w[2]-px,u=pz-w[1],dn=w[3]-pz,m=Math.min(l,rr,u,dn);if(m===l) px=w[0]-r;else if(m===rr) px=w[2]+r;else if(m===u) pz=w[1]-r;else pz=w[3]+r;}}
 return {x:px,z:pz,hit};}

/* ── enseignes ── */
function signTex(text,bg,fg){
 const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');
 x.fillStyle='#'+bg.toString(16).padStart(6,'0');x.fillRect(0,0,512,96);x.strokeStyle=fg;x.lineWidth=5;x.strokeRect(6,6,500,84);
 let f=54;x.font='bold '+f+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';while(x.measureText(text).width>470&&f>18){f-=2;x.font='bold '+f+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';}
 x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,52);
 const t=new T.CanvasTexture(c);t.anisotropy=2;return t;}

/* ── construction du monde ── */
let built=false,carObj=null,lampMat=null,sunL=null,hemi=null,beacon=null,headL=null;
const doorFns={};
function wallBox(cx,cz,w,d,y0,y1,col,solid){const m=mk(gBox(w,y1-y0,d),mat(col,.22),cx,(y0+y1)/2,cz);sceneObj.add(m);if(solid) addCol(cx,cz,w,d);}
function buildBuilding(z){
 const d=z._d,hx=d.w/2,hz=d.d/2,H=d.H,th=.4,gw=d.type==='terrain'?5.2:4.6;
 const edges=[['N',z.x-hx,z.z-hz,z.x+hx,z.z-hz],['S',z.x-hx,z.z+hz,z.x+hx,z.z+hz],['W',z.x-hx,z.z-hz,z.x-hx,z.z+hz],['E',z.x+hx,z.z-hz,z.x+hx,z.z+hz]];
 for(const [s,x0,z0,x1,z1] of edges){
  const horiz=s==='N'||s==='S',L=horiz?x1-x0:z1-z0,mx=(x0+x1)/2,mz=(z0+z1)/2;
  const seg=(a,b,ya,yb,solid)=>{const l=b-a;if(l<=0) return;const c=a+l/2;if(horiz) wallBox(x0+c,mz,l,th,ya,yb,d.wall,solid);else wallBox(mx,z0+c,th,l,ya,yb,d.wall,solid);};
  if(d.interior&&s===d.side){const g0=L/2-gw/2,g1=L/2+gw/2;seg(0,g0,0,H,true);seg(g1,L,0,H,true);if(H>3.8) seg(g0,g1,3.8,H,false);}
  else seg(0,L,0,H,true);}
 // sol, toit
 const fl=d.floor||0x777a7c;
 if(d.interior) sceneObj.add(mk(gBox(d.w-.5,.06,d.d-.5),mat(fl,.2),z.x,.05,z.z));
 if(d.roof!=null) sceneObj.add(mk(gBox(d.w+.7,.35,d.d+.7),mat(d.roof),z.x,H+.17,z.z));
 // porte (bâtiments fermés) ou portail
 const n=z.n,out={x:-n.x,z:-n.z},ry=Math.atan2(out.x,out.z);
 if(!d.interior){const dm=mk(gBox(2.4,3.2,.3),mat(0x3a2a20),z.door.x+out.x*.15,1.6,z.door.z+out.z*.15);dm.rotation.y=ry;sceneObj.add(dm);
  const aw=mk(gBox(4,.2,1.4),mat(d.sign),z.door.x+out.x*.7,3.6,z.door.z+out.z*.7);aw.rotation.y=ry;sceneObj.add(aw);}
 // enseigne
 const sw=Math.min(d.w-2,d.interior?10:9),sh=sw*96/512,sy=d.roof==null?H+1.6:(d.interior?H-.95:H-1.2);
 const sg=new T.Mesh(new T.PlaneGeometry(sw,sh),new T.MeshBasicMaterial({map:signTex(d.nom,d.sign,d.fg)}));
 sg.position.set(z.door.x+out.x*.3,sy,z.door.z+out.z*.3);sg.rotation.y=ry;sceneObj.add(sg);
 if(d.roof==null){for(const s of [-1,1]){const lat={x:Math.abs(n.z),z:Math.abs(n.x)};sceneObj.add(mk(gBox(.2,sy,.2),mat(0x444444),z.door.x+out.x*.3+lat.x*s*sw/2,sy/2,z.door.z+out.z*.3+lat.z*s*sw/2));}}
 // intérieur des garages
 if(d.type==='garage'){
  const L=z.loc,col=d.floor;
  for(let i=0;i<z.ponts.length;i++){const p=z.ponts[i];
   sceneObj.add(mk(gBox(2.6,.16,4.9),mat(0x35393d),p.x,.14,p.z));
   for(const s of [-1,1]){sceneObj.add(mk(gBox(.12,.02,4.9),mat(0xf2c200),p.x+s*1.15,.23,p.z));sceneObj.add(mk(gBox(.28,2.3,.28),mat(0x55606a),p.x+s*1.5,1.15,p.z));}
   sceneObj.add(mk(gBox(3.3,.12,.3),mat(0x55606a),p.x,2.3,p.z));}
  const eb=z.etabli;sceneObj.add(mk(gBox(3.6,.9,.9),mat(0x8a6a44),eb.x,.45,eb.z));sceneObj.add(mk(gBox(3.8,.08,1.05),mat(0xb08a5a),eb.x,.94,eb.z));
  sceneObj.add(mk(gBox(.8,.55,.6),mat(0xc02020),eb.x-1.2,1.25,eb.z));sceneObj.add(mk(gBox(.3,.2,.3),mat(0x2b2b2b),eb.x+1.2,1.08,eb.z));addCol(eb.x,eb.z,3.8,1.05);
  const et=z.etagere;sceneObj.add(mk(gBox(3.2,2.3,.6),mat(0x3a5a8a),et.x,1.15,et.z));
  for(let r=0;r<3;r++)for(let c=0;c<4;c++) sceneObj.add(mk(gBox(.5,.32,.4),mat([0xe8c020,0xc83030,0xf0f0f0,0x3aa050][(r+c)%4]),et.x-1.15+c*.77,.5+r*.7,et.z-.05));addCol(et.x,et.z,3.2,.7);
  const ac=z.accueil;sceneObj.add(mk(gBox(2.6,1,.8),mat(0x4a4f55),ac.x,.5,ac.z));sceneObj.add(mk(gBox(.5,.04,.4),mat(0x9ad0f0,.6),ac.x,1.02,ac.z));addCol(ac.x,ac.z,2.6,.8);
  for(const u of [-d.w*.25,d.w*.25]) for(const v of [d.d*.25,d.d*.7]){const p=L(u,v);sceneObj.add(mk(gBox(2.4,.1,.5),new T.MeshBasicMaterial({color:0xfff6d8}),p.x,H-.1,p.z));}}
 if(d.type==='terrain'){
  const L=z.loc;for(const [u,v,r] of [[-12,10,.5],[-10,12,.5],[14,22,.5]]){const p=L(u,v);sceneObj.add(mk(gCyl(r,1,12),mat(0x3a5a8a),p.x,.5,p.z));}
  const p=L(8,10);sceneObj.add(mk(gBox(6,2.6,2.4),mat(0x8a3a2a),p.x,1.3,p.z));addCol(p.x,p.z,6,2.4);
  const q=L(-6,26);sceneObj.add(mk(gBox(14,.08,10),mat(0x8a7a5a),q.x,.04,q.z));}
}
function instanced(geo,mt,mats,cols){
 const im=new T.InstancedMesh(geo,mt,mats.length);
 for(let i=0;i<mats.length;i++){im.setMatrixAt(i,mats[i]);if(cols) im.setColorAt(i,cols[i]);}
 im.instanceMatrix.needsUpdate=true;if(im.instanceColor) im.instanceColor.needsUpdate=true;sceneObj.add(im);return im;}
function buildWorld(){
 built=true;
 const bg=new T.Color(0x8fc4ee);sceneObj.background=bg;sceneObj.fog=new T.Fog(0x8fc4ee,90,330);
 hemi=new T.HemisphereLight(0xcfe4ff,0x6a6a58,.9);sceneObj.add(hemi);
 sunL=new T.DirectionalLight(0xfff0d0,.9);sceneObj.add(sunL);sceneObj.add(sunL.target);
 // sol, routes, trottoirs
 sceneObj.add(mk(gBox(1400,.2,1400),mat(0x6f9a4a),0,-.1,0));
 for(const r of RZ){sceneObj.add(mk(gBox(600,.1,20),mat(0xb9b9b4),0,.05,r));sceneObj.add(mk(gBox(600,.12,14),mat(0x3a3d42),0,.06,r));}
 for(const r of RX){sceneObj.add(mk(gBox(20,.1,600),mat(0xb9b9b4),r,.05,0));sceneObj.add(mk(gBox(14,.12,600),mat(0x3a3d42),r,.06,0));}
 const dm=[];
 for(const r of RZ) for(let x=-295;x<=295;x+=10){if(RX.some(a=>Math.abs(x-a)<11)) continue;dm.push(new T.Matrix4().makeTranslation(x,.13,r));}
 for(const r of RX) for(let zz=-295;zz<=295;zz+=10){if(RZ.some(a=>Math.abs(zz-a)<11)) continue;dm.push(new T.Matrix4().makeTranslation(r,.13,zz));}
 const dm2=[],dm3=[];for(let i=0;i<dm.length;i++){const p=new T.Vector3().setFromMatrixPosition(dm[i]);(RZ.includes(p.z)?dm2:dm3).push(dm[i]);}
 instanced(gBox(4,.02,.25),new T.MeshBasicMaterial({color:0xe8e4c8}),dm2);
 instanced(gBox(.25,.02,4),new T.MeshBasicMaterial({color:0xe8e4c8}),dm3);
 // bâtiments
 for(const z of zones) buildBuilding(z);
 // maisons de fond
 let seed=12345;const rnd=()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 const free=(x,z,hw,hd,m)=>{for(const q of zones) if(Math.abs(x-q.x)<q.w/2+hw+m&&Math.abs(z-q.z)<q.d/2+hd+m) return false;
  for(const w of walls) if(x+hw>w[0]-m&&x-hw<w[2]+m&&z+hd>w[1]-m&&z-hd<w[3]+m) return false;return true;};
 const hm=[],hc=[],rm=[],drm=[],houses=[];
 const rows=[[168,'N'],[-168,'S'],[-132,'N'],[132,'S']];
 for(const [rz,side] of rows) for(let x=-262;x<=262;x+=30){
  const hw=7+rnd()*3,hd=5+rnd()*2,h=5+rnd()*3,cx=x+rnd()*6-3;
  if(RX.some(a=>Math.abs(cx-a)<hw+13)||!free(cx,rz,hw,hd,3)) continue;
  houses.push([cx,rz,hw,hd,h,side]);}
 for(const [cx,rz,hw,hd,h,side] of houses){
  const c=new T.Color().setHSL(rnd(),.25,.72);hm.push(new T.Matrix4().makeScale(hw*2,h,hd*2).setPosition(cx,h/2,rz));hc.push(c);
  rm.push(new T.Matrix4().makeScale(hw*2+.8,.5,hd*2+.8).setPosition(cx,h+.25,rz));
  const fz=side==='N'?rz-hd-.1:rz+hd+.1;drm.push(new T.Matrix4().makeScale(1.6,2.6,.2).setPosition(cx,1.3,fz));
  addCol(cx,rz,hw*2,hd*2);}
 if(hm.length){instanced(gBox(1,1,1),new T.MeshLambertMaterial({color:0xffffff}),hm,hc);
  instanced(gBox(1,1,1),mat(0x7a4a3a),rm);instanced(gBox(1,1,1),mat(0x3a2a20),drm);}
 // arbres
 const tm=[],cm=[];let tries=0;
 while(tm.length<90&&tries++<900){const x=rnd()*560-280,z=rnd()*560-280;
  if(RX.some(a=>Math.abs(x-a)<17)||RZ.some(a=>Math.abs(z-a)<17)||!free(x,z,1,1,4)) continue;
  const s=.8+rnd()*.7;tm.push(new T.Matrix4().makeScale(1,s,1).setPosition(x,1.1*s,z));cm.push(new T.Matrix4().makeScale(s,s,s).setPosition(x,3.6*s,z));addCol(x,z,.7,.7);}
 instanced(gCyl(.3,2.2,6),mat(0x6a4a2a),tm);instanced(new T.ConeGeometry(1.9,4.2,7),mat(0x2f7a3a),cm);
 // lampadaires
 const pm=[],lm=[];
 for(const r of RZ) for(let x=-285;x<=285;x+=30){if(RX.some(a=>Math.abs(x-a)<14)) continue;pm.push(new T.Matrix4().makeTranslation(x,3,r+8.8));lm.push(new T.Matrix4().makeTranslation(x,6.1,r+8.8));}
 for(const r of RX) for(let zz=-285;zz<=285;zz+=30){if(RZ.some(a=>Math.abs(zz-a)<14)) continue;pm.push(new T.Matrix4().makeTranslation(r-8.8,3,zz));lm.push(new T.Matrix4().makeTranslation(r-8.8,6.1,zz));}
 instanced(gCyl(.1,6,6),mat(0x40444a),pm);
 lampMat=new T.MeshBasicMaterial({color:0x888070});instanced(gBox(.7,.3,.7),lampMat,lm);
 // faisceau du repère
 beacon=new T.Mesh(new T.CylinderGeometry(1.3,1.3,40,16,1,true),new T.MeshBasicMaterial({color:0xffc820,transparent:true,opacity:.28,side:T.DoubleSide,depthWrite:false}));
 beacon.position.y=20;beacon.visible=false;sceneObj.add(beacon);
 // voiture du joueur
 carObj=api.carMesh({color:0x6f8fa8,kind:'citadine'});sceneObj.add(carObj);
 headL=new T.SpotLight(0xfff2d0,0,60,.7,.5,1);headL.position.set(0,.9,1.6);carObj.add(headL);const ht=new T.Object3D();ht.position.set(0,.5,12);carObj.add(ht);headL.target=ht;
}

/* ═══════════ État, sauvegarde ═══════════ */
function newState(){return {v:1,day:1,min:450,money:300,xp:{},rep:0,inv:[],player:{x:-26,z:9,ry:-PI/2,inCar:false},car:{x:-23.5,z:5.4,ry:PI/2},flags:{},ledger:[],marker:'garage1'};}
function load(){try{const r=localStorage.getItem(SAVE_KEY);if(!r) return null;const o=JSON.parse(r);if(!o||o.v!==1||typeof o!=='object') return null;
 const n=newState();for(const k in o) n[k]=o[k];if(!n.player||typeof n.player.x!=='number') n.player=newState().player;if(!n.car||typeof n.car.x!=='number') n.car=newState().car;return n;}catch(e){return null;}}
api.save=()=>{if(!S) return false;try{localStorage.setItem(SAVE_KEY,JSON.stringify(S));return true;}catch(e){return false;}};
const fmt=x=>{try{return moneyF(x,2020);}catch(e){return Math.round(x)+' €';}};
api.fmt=fmt;
api.homeInfo=()=>{const b=document.getElementById('hMecaSub');if(!b) return;const s=load();b.textContent=s?`Continuer · Jour ${s.day} · ${fmt(s.money)}`:'Apprenti dans un garage de quartier, puis ingénieur, puis patron de votre marque.';};

/* ═══════════ Interface ═══════════ */
let ui=null,active=false,panelSt=null,mapOpen=false,sleeping=false,toastN=0,lockLost=0;
const hudH={},btns=[],inter=new Map();
const touchOn=()=>{try{return matchMedia('(pointer:coarse)').matches;}catch(e){return false;}};
function ensureUI(){
 if(ui) return ui;
 const r=el('div','mw');r.id='mwRoot';r.hidden=true;r.setAttribute('aria-label','Carrière de mécanicien');
 r.innerHTML=`<canvas class="mw-cv" id="mwCv"></canvas><div class="mw-look" id="mwLook"></div>
 <div class="mw-top"><b id="mwTime"></b><span id="mwMoney"></span></div><div class="mw-zones" id="mwZones"></div>
 <div class="mw-tr"><canvas class="mw-mini" id="mwMini" width="140" height="140" aria-label="Mini-carte"></canvas><div class="mw-bar" id="mwBar"><button type="button" class="mw-b" data-b="map">Carte (M)</button><button type="button" class="mw-b" data-b="menu">Menu</button></div></div>
 <div class="mw-cross" aria-hidden="true"></div><div class="mw-toasts" id="mwToasts" role="status"></div>
 <div class="mw-speed" id="mwSpeed" hidden></div><div class="mw-prompt" id="mwPrompt" hidden></div>
 <div class="mw-touch" id="mwTouch"><div class="mw-joy" id="mwJoy"><i id="mwKnob"></i></div><div class="mw-acts"><button type="button" class="mw-a" id="mwBtnE">E</button><button type="button" class="mw-a f" id="mwBtnF">F</button></div></div>
 <div class="mw-pw" id="mwPw" hidden><div class="mw-pn" role="dialog" aria-modal="true"><div class="mw-ph"><h2 id="mwPt"></h2><button type="button" class="mw-x" data-mw="close" aria-label="Fermer">✕</button></div><div class="mw-pb" id="mwPb"></div></div></div>
 <div class="mw-map" id="mwMap" hidden><div class="mw-ph"><h2>Carte de la ville</h2><button type="button" class="mw-x" id="mwMapX" aria-label="Fermer la carte">✕</button></div><canvas id="mwBig"></canvas><p class="mw-leg">Jaune : repère à rejoindre · flèche blanche : vous · point bleu : votre voiture</p></div>
 <div class="mw-fade" id="mwFade"></div>`;
 document.body.appendChild(r);
 ui={r,cv:r.querySelector('#mwCv'),look:r.querySelector('#mwLook'),time:r.querySelector('#mwTime'),money:r.querySelector('#mwMoney'),zones:r.querySelector('#mwZones'),
  mini:r.querySelector('#mwMini'),bar:r.querySelector('#mwBar'),toasts:r.querySelector('#mwToasts'),speed:r.querySelector('#mwSpeed'),prompt:r.querySelector('#mwPrompt'),
  joy:r.querySelector('#mwJoy'),knob:r.querySelector('#mwKnob'),bE:r.querySelector('#mwBtnE'),bF:r.querySelector('#mwBtnF'),pw:r.querySelector('#mwPw'),pt:r.querySelector('#mwPt'),pb:r.querySelector('#mwPb'),
  map:r.querySelector('#mwMap'),big:r.querySelector('#mwBig'),fade:r.querySelector('#mwFade'),touch:r.querySelector('#mwTouch')};
 ui.touch.hidden=!touchOn();
 for(const b of btns) addBtnDom(b);
 for(const id in hudH) hudDom(id);
 bindUI();return ui;}
function addBtnDom(b){if(!ui) return;let e=ui.bar.querySelector(`[data-b="u_${b.id}"]`);if(!e){e=el('button','mw-b');e.type='button';e.dataset.b='u_'+b.id;ui.bar.appendChild(e);}e.textContent=b.label;}
api.addButton=(id,label,fn)=>{const o=btns.find(b=>b.id===id);if(o){o.label=label;o.fn=fn;}else btns.push({id,label,fn});addBtnDom(btns.find(b=>b.id===id));};
api.removeButton=id=>{const i=btns.findIndex(b=>b.id===id);if(i>=0) btns.splice(i,1);if(ui){const e=ui.bar.querySelector(`[data-b="u_${id}"]`);if(e) e.remove();}};
function hudDom(id){if(!ui) return;let e=ui.zones.querySelector(`[data-h="${id}"]`);const h=hudH[id];
 if(!h){if(e) e.remove();return;}if(!e){e=el('div','mw-z');e.dataset.h=id;ui.zones.appendChild(e);}e.innerHTML=h;}
api.hud=(id,html)=>{if(html) hudH[id]=html;else delete hudH[id];hudDom(id);};
api.toast=(t,g)=>{ensureUI();const e=el('div','mw-t '+(g||'info'));e.textContent=t;ui.toasts.appendChild(e);
 while(ui.toasts.children.length>4) ui.toasts.firstChild.remove();setTimeout(()=>e.remove(),5200);};
function setPaused(){api.paused=!!(panelSt||mapOpen||sleeping);if(api.paused){keys={};js.x=js.y=0;if(ui) ui.knob.style.transform='';exitLock();}}
function exitLock(){try{if(document.pointerLockElement){lockLost=performance.now();document.exitPointerLock();}}catch(e){}}
api.panel=(titre,html,o)=>{ensureUI();o=o||{};ui.pt.textContent=titre;ui.pb.innerHTML=html;ui.pw.firstElementChild.className='mw-pn'+(o.wide?' wide':'');
 panelSt={onClick:o.onClick,onClose:o.onClose};ui.pw.hidden=false;ui.pb.scrollTop=0;setPaused();
 const b=ui.pb.querySelector('button');if(b) try{b.focus({preventScroll:true});}catch(e){}};
api.closePanel=()=>{if(!panelSt) return;const p=panelSt;panelSt=null;ui.pw.hidden=true;setPaused();if(p.onClose) try{p.onClose();}catch(e){console.error(e);}};
const ordT=h=>String(Math.floor(h)).padStart(2,'0');
api.hourF=()=>S?S.min/60:12;
api.timeStr=()=>S?`Jour ${S.day} · ${ordT(S.min/60)}:${ordT(S.min%60)}`:'';
api.isNight=()=>{const h=api.hourF();return h<6.3||h>=19.7;};
api.money=(dx,motif)=>{S.money=Math.round((S.money+dx)*100)/100;
 const l=S.ledger;l.push({t:api.timeStr(),dx,motif:motif||'',solde:S.money});while(l.length>30) l.shift();
 if(dx) api.toast((dx>0?'+ ':'− ')+fmt(Math.abs(dx))+(motif?' · '+motif:''),dx>0?'good':'warn');emit('money',dx,motif);return S.money;};

/* ── horloge ── */
let acc=0;
function stepMin(){S.min++;if(S.min>=1440) S.min=0;emit('minute');if(S.min%60===0) emit('hour',S.min/60);if(S.min===360){S.day++;emit('day',S.day);}}
api.addMin=n=>{n=Math.max(0,Math.min(3000,Math.round(n)));for(let i=0;i<n;i++) stepMin();};
const WAKE=450,SLEEP_FROM=1140; /* réveil à 7 h 30 ; on peut dormir dès 19 h */
api.sleep=()=>{if(sleeping) return;ensureUI();sleeping=true;setPaused();ui.fade.classList.add('on');
 setTimeout(()=>{const n=((WAKE-S.min)+1440)%1440||1440;api.addMin(n);api.save();ui.fade.classList.remove('on');sleeping=false;setPaused();api.toast(`Une bonne nuit de sommeil. ${api.timeStr()}.`,'good');},650);};

/* ── interactions ── */
let curI=null,nid=1;
api.addInteract=o=>{if(!o.id) o.id='i'+(nid++);inter.set(o.id,o);return o;};
api.removeInteract=id=>{inter.delete(id);};
api.setDoor=(id,fn)=>{if(fn) doorFns[id]=fn;else delete doorFns[id];};
function defaultDoor(z){
 const desc={garage:'Garage ouvert de 8 h à 19 h.',magasin:'Pièces détachées et outillage.',ecole:'Formations et examens de mécanique.',bureau:'Bureau d\'études d\'un constructeur.',banque:'Prêts et comptes professionnels.',terrain:'Un terrain pour bâtir votre propre usine.',occasion:'Voitures d\'occasion.'}[z.type]||'';
 api.panel(z.nom,`<p>${esc(desc)}</p><p class="mw-soon">Bientôt : cet endroit ouvrira ses portes dans une prochaine mise à jour.</p><div class="mw-btns"><button type="button" class="btn" data-mw="close">Fermer</button></div>`);}
function studioDoor(){
 api.panel('Votre studio',`<p>Un petit studio, le temps de faire vos preuves. ${esc(api.timeStr())}.</p><div class="mw-btns">${S&&S.min>=SLEEP_FROM||S&&S.min<360?'<button type="button" class="btn" data-mw="sleep">Dormir jusqu\'à 7 h 30</button>':'<span class="mw-soon">Il est trop tôt pour dormir : revenez à partir de 19 h.</span>'}<button type="button" class="btn ghost" data-mw="save">Sauvegarder</button><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`,
  {onClick:a=>{if(a==='sleep'){if(!(S.min>=SLEEP_FROM||S.min<360)) return;api.closePanel();api.sleep();}else if(a==='save'){api.save();api.toast('Partie sauvegardée.','good');}}});}
function zoneUse(z){const f=doorFns[z.id];if(f) return f(z);if(z.id==='appart') return studioDoor();return defaultDoor(z);}
function regZoneInteracts(){
 for(const z of zones){
  const p=z.type==='garage'?z.accueil:z.porte;
  api.addInteract({id:'mw:'+z.id,x:p.x,z:p.z,r:z.type==='garage'?2.6:2.4,label:()=>z.id==='appart'?'Chez vous : dormir, sauvegarder':(z.type==='garage'?'Accueil · ':'Entrer · ')+z.nom,use:()=>zoneUse(z)});}}

/* ═══════════ Contrôles ═══════════ */
let keys={},P={x:0,z:0,ry:0,pitch:0},car={v:0,steer:0},zoneCur=null;
const js={id:null,x:0,y:0},look={id:null,x:0,y:0};
const KM={z:'f',w:'f',ArrowUp:'f',s:'b',ArrowDown:'b',q:'l',a:'l',ArrowLeft:'l',d:'r',ArrowRight:'r',' ':'brake',Shift:'run'};
function onKey(e){
 if(!active) return;const tg=e.target;if(tg&&/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
 const k=e.key&&e.key.length===1?e.key.toLowerCase():e.key,down=e.type==='keydown';
 e.stopPropagation();
 if(e.ctrlKey||e.metaKey||e.altKey) return;
 if(k==='Escape'){if(!down) return;e.preventDefault();if(performance.now()-lockLost<200) return;
  if(panelSt) api.closePanel();else if(mapOpen) toggleMap(false);else pauseMenu();return;}
 if(api.paused){if(down&&k==='m'&&mapOpen) toggleMap(false);return;}
 const m=KM[k];if(m){keys[m]=down;if(down||k===' '||k.startsWith('Arrow')) e.preventDefault();return;}
 if(!down||e.repeat) return;
 if(k==='e'){useCur('e');}
 else if(k==='f'){useCur('f');}
 else if(k==='m'){toggleMap(true);}
 else if(k==='Tab'){e.preventDefault();emit('tab');}
 else{emit('key',k.toLowerCase?k.toLowerCase():k,e);}}
function onMouse(e){if(!active||api.paused||P.inCar) return;if(document.pointerLockElement===ui.look){P.ry-=e.movementX*.0024;P.pitch=clamp(P.pitch-e.movementY*.0022,-1.25,1.25);}}
function onLockChange(){if(!active) return;if(!document.pointerLockElement&&!api.paused&&performance.now()-lockLost>200){lockLost=performance.now();pauseMenu();}}
function useCur(k){
 if(k==='f'){if(curI&&curI.key.toLowerCase()==='f'&&curI.o){try{curI.o.use();}catch(e){console.error(e);}return;}toggleCar();return;}
 if(curI&&curI.o&&curI.key.toLowerCase()===k){try{curI.o.use();}catch(e){console.error(e);}}}
function pauseMenu(){
 api.panel('Pause',`<p>${esc(api.timeStr())} · ${esc(fmt(S.money))}</p><div class="mw-btns v"><button type="button" class="btn" data-mw="resume">Reprendre</button><button type="button" class="btn ghost" data-mw="save">Sauvegarder</button><button type="button" class="btn ghost" data-mw="quit">Quitter vers l'accueil</button><button type="button" class="btn ghost" data-mw="new">Recommencer une partie…</button></div><p class="hint">Z Q S D : marcher · Maj : courir · souris : regarder · E : agir · F : voiture · M : carte · Échap : pause.</p>`,
  {onClick:a=>{if(a==='resume') api.closePanel();else if(a==='save'){api.save();api.toast('Partie sauvegardée.','good');}
   else if(a==='quit'){api.closePanel();api.close();}
   else if(a==='new') api.panel('Recommencer ?',`<p>Votre progression sera effacée.</p><div class="mw-btns"><button type="button" class="btn" data-mw="yes">Oui, recommencer</button><button type="button" class="btn ghost" data-mw="close">Non</button></div>`,{onClick:b=>{if(b==='yes'){api.closePanel();api.reset();}}});}});}
function toggleMap(on){ensureUI();if(panelSt) return;mapOpen=on===undefined?!mapOpen:on;ui.map.hidden=!mapOpen;setPaused();if(mapOpen){sizeBig();drawBig();}}
function sizeBig(){const s=Math.max(200,Math.min(ui.map.clientWidth-24,ui.map.clientHeight-110));ui.big.width=ui.big.height=Math.round(s);ui.big.style.width=ui.big.style.height=Math.round(s)+'px';}

function bindUI(){
 ui.bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b) return;const d=b.dataset.b;
  if(d==='map') toggleMap();else if(d==='menu') pauseMenu();else if(d&&d.startsWith('u_')){const o=btns.find(x=>'u_'+x.id===d);if(o&&o.fn&&!api.paused) try{o.fn();}catch(err){console.error(err);}}});
 ui.pw.addEventListener('click',e=>{const b=e.target.closest('[data-mw]');if(!b){if(e.target===ui.pw) api.closePanel();return;}
  const a=b.dataset.mw;if(a==='close'){api.closePanel();return;}const p=panelSt;if(p&&p.onClick) try{p.onClick(a,b);}catch(err){console.error(err);}});
 ui.map.querySelector('#mwMapX').addEventListener('click',()=>toggleMap(false));
 // regarder : souris (verrouillage du pointeur ou glisser) et doigt
 ui.look.addEventListener('click',e=>{if(e.pointerType==='touch'||api.paused||P.inCar) return;try{if(!document.pointerLockElement) ui.look.requestPointerLock();}catch(err){}});
 ui.look.addEventListener('pointerdown',e=>{if(look.id!=null||api.paused) return;look.id=e.pointerId;const p=pXY(e);look.x=p.x;look.y=p.y;try{ui.look.setPointerCapture(e.pointerId);}catch(err){}});
 ui.look.addEventListener('pointermove',e=>{if(e.pointerId!==look.id||document.pointerLockElement===ui.look) return;const p=pXY(e);
  if(!P.inCar){P.ry-=(p.x-look.x)*.006;P.pitch=clamp(P.pitch-(p.y-look.y)*.005,-1.25,1.25);}look.x=p.x;look.y=p.y;});
 const lend=e=>{if(e.pointerId===look.id) look.id=null;};ui.look.addEventListener('pointerup',lend);ui.look.addEventListener('pointercancel',lend);
 // joystick
 const jm=e=>{const p=elXY(e,ui.joy),r=p.w/2;let dx=(p.x-r)/r,dy=(p.y-p.h/2)/r;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}
  js.x=Math.abs(dx)<.12?0:dx;js.y=Math.abs(dy)<.12?0:-dy;ui.knob.style.transform=`translate(${dx*r*.6}px,${dy*r*.6}px)`;};
 ui.joy.addEventListener('pointerdown',e=>{e.preventDefault();if(js.id!=null) return;js.id=e.pointerId;try{ui.joy.setPointerCapture(e.pointerId);}catch(err){}jm(e);});
 ui.joy.addEventListener('pointermove',e=>{if(e.pointerId===js.id) jm(e);});
 const jend=e=>{if(e.pointerId!==js.id) return;js.id=null;js.x=js.y=0;ui.knob.style.transform='';};ui.joy.addEventListener('pointerup',jend);ui.joy.addEventListener('pointercancel',jend);
 ui.bE.addEventListener('pointerdown',e=>{e.preventDefault();if(!api.paused) useCur('e');});
 ui.bF.addEventListener('pointerdown',e=>{e.preventDefault();if(!api.paused) useCur('f');});
}

/* ── voiture du joueur ── */
const carNear=()=>Math.hypot(S.car.x-P.x,S.car.z-P.z)<4.6;
function toggleCar(){
 if(P.inCar){if(Math.abs(car.v)>3){api.toast('Arrêtez-vous avant de descendre.','warn');return;}
  const lx=Math.cos(S.car.ry),lz=-Math.sin(S.car.ry);let px=S.car.x+lx*2.2,pz=S.car.z+lz*2.2;
  let r=pushOut(px,pz,.45);if(r.hit){px=S.car.x-lx*2.2;pz=S.car.z-lz*2.2;r=pushOut(px,pz,.45);}
  P.x=r.x;P.z=r.z;P.ry=S.car.ry;P.pitch=0;P.inCar=false;car.v=0;ui.cv.parentNode.classList.remove('mw-incar');}
 else if(carNear()){P.inCar=true;P.x=S.car.x;P.z=S.car.z;P.ry=S.car.ry;car.v=0;ui.cv.parentNode.classList.add('mw-incar');api.toast('Au volant : Z/S accélérer/freiner, Q/D braquer, espace frein à main. F pour descendre.','info');}
 else api.toast('Votre voiture est trop loin.','info');}
api.player=()=>({x:P.x,z:P.z,ry:P.ry,inCar:P.inCar,zone:zoneCur?zoneCur.id:null,zoneObj:zoneCur,pitch:P.pitch});
api.playerCar=()=>({mesh:carObj,x:S.car.x,z:S.car.z,ry:S.car.ry,speed:car.v});
api.teleport=(x,z,ry)=>{P.x=x;P.z=z;if(ry!=null) P.ry=ry;if(P.inCar){S.car.x=x;S.car.z=z;if(ry!=null) S.car.ry=ry;car.v=0;}};
api.setMarker=(t,label)=>{if(!S) return;S.marker=t;S.markerLabel=label||null;placeBeacon();};
function markerPos(){const m=S&&S.marker;if(!m) return null;if(typeof m==='string'){const z=zById[m];return z?{x:z.porte.x,z:z.porte.z}:null;}return typeof m.x==='number'?m:null;}
function placeBeacon(){if(!beacon) return;const p=markerPos();beacon.visible=!!p;if(p){beacon.position.x=p.x;beacon.position.z=p.z;}}

function inputVec(){
 let mx=(keys.r?1:0)-(keys.l?1:0)+js.x,my=(keys.f?1:0)-(keys.b?1:0)+js.y;
 return [clamp(mx,-1,1),clamp(my,-1,1)];}
function walk(dt){
 const [mx,my]=inputVec(),l=Math.hypot(mx,my);if(l<.01) return;
 const sp=(keys.run?6.2:3.3)*Math.min(1,l),fx=Math.sin(P.ry),fz=Math.cos(P.ry),rx=-Math.cos(P.ry),rz=Math.sin(P.ry);
 let dx=(fx*my+rx*mx)/Math.max(1,l)*sp*dt,dz=(fz*my+rz*mx)/Math.max(1,l)*sp*dt;
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
 for(let i=0;i<n;i++){let x=P.x+dx/n,z=P.z+dz/n;
  // la voiture est un obstacle à pied
  const cf=Math.sin(S.car.ry),cz2=Math.cos(S.car.ry);
  for(const o of [-1,1]){const px=S.car.x+cf*o*1.0,pz=S.car.z+cz2*o*1.0,ex=x-px,ez=z-pz,d=Math.hypot(ex,ez),rr=1.45;if(d<rr&&d>1e-4){x=px+ex/d*rr;z=pz+ez/d*rr;}}
  const r=pushOut(x,z,.42);P.x=clamp(r.x,-HALF,HALF);P.z=clamp(r.z,-HALF,HALF);}}
function drive(dt){
 const [mx,my]=inputVec(),VM=22;let v=car.v;
 if(my>.05){v+=(v<-.3?16:Math.max(1.5,7*(1-v/VM)))*my*dt;}
 else if(my<-.05){if(v>.4) v-=15*-my*dt;else v+=(-my)*-4.5*dt;}
 else v-=Math.sign(v)*Math.min(Math.abs(v),2.4*dt);
 if(keys.brake) v-=Math.sign(v)*Math.min(Math.abs(v),20*dt);
 v=clamp(v,-6,VM);
 const turn=-mx*clamp(Math.abs(v)/4,0,1)*(1.9-1.15*Math.min(Math.abs(v)/VM,1))*Math.sign(v||1);
 S.car.ry+=turn*dt;
 const fx=Math.sin(S.car.ry),fz=Math.cos(S.car.ry),n=Math.max(1,Math.ceil(Math.abs(v)*dt/.4));
 let hit=false;
 for(let i=0;i<n;i++){let x=S.car.x+fx*v*dt/n,z=S.car.z+fz*v*dt/n;
  for(const o of [-1.05,1.05]){const r=pushOut(x+fx*o,z+fz*o,1.05);if(r.hit){hit=true;x+=r.x-(x+fx*o);z+=r.z-(z+fz*o);}}
  S.car.x=clamp(x,-HALF,HALF);S.car.z=clamp(z,-HALF,HALF);}
 car.v=hit?v*.45:v;   // choc : on perd presque toute la vitesse
 car.steer=mx;P.x=S.car.x;P.z=S.car.z;P.ry=S.car.ry;}
function syncCarMesh(dt){
 carObj.position.set(S.car.x,0,S.car.z);carObj.rotation.y=S.car.ry;
 for(const n of ['wFL','wFR','wRL','wRR']){const w=carObj.getObjectByName(n);if(!w) continue;w.rotation.x+=car.v*dt/.3;if(n[1]==='F') w.rotation.y=P.inCar?car.steer*-.45:0;}
 headL.intensity=P.inCar&&api.isNight()?1.6:0;}

/* ── zones, interactions ── */
function updateZones(){
 const z=api.zoneAt(P.x,P.z);
 if(z!==zoneCur){const o=zoneCur;zoneCur=z;if(o) emit('leaveZone',o.id);if(z){emit('enterZone',z.id);
  if(z.id==='garage1'&&!S.flags.coinVu){S.flags.coinVu=true;if(S.marker==='garage1') api.setMarker(null);api.hud('goal','');api.toast('Vous voilà au Garage du Coin. Approchez-vous du comptoir d\'accueil et appuyez sur E.','good');}}}}
function updateInteract(){
 let best=null,bd=1e9;const fx=Math.sin(P.ry),fz=Math.cos(P.ry);
 if(!P.inCar){
  for(const o of inter.values()){
   try{if(o.when&&!o.when()) continue;}catch(e){continue;}
   const dx=o.x-P.x,dz=o.z-P.z,d=Math.hypot(dx,dz),r=o.r||1.6;if(d>r) continue;
   if(d>1.1&&(dx*fx+dz*fz)/d<.2) continue;
   if(o.y!=null&&Math.abs(o.y-1.5)>3.2) continue;
   if(d<bd){bd=d;best={o,key:(o.key||'E').toLowerCase(),text:typeof o.label==='function'?o.label():o.label};}}
  if(!best&&carNear()) best={o:null,key:'f',text:'Monter dans la voiture'};}
 else if(Math.abs(car.v)<3) best={o:null,key:'f',text:'Descendre de la voiture'};
 curI=best;
 const txt=best?`[${best.key.toUpperCase()}] ${best.text||''}`:'';
 if(ui.prompt.textContent!==txt){ui.prompt.textContent=txt;ui.prompt.hidden=!txt;}
 ui.bE.classList.toggle('on',!!best&&best.key==='e');ui.bF.classList.toggle('on',!!best&&best.key==='f');}

/* ── cartes 2D ── */
const mapCol=z=>'#'+z.col.toString(16).padStart(6,'0');
function drawMap(c,cx,cz,sc,names,fs){
 const W=c.width,H=c.height,x=c.getContext('2d'),X=wx=>W/2+(wx-cx)*sc,Y=wz=>H/2+(wz-cz)*sc;
 x.fillStyle='#6f9a4a';x.fillRect(0,0,W,H);
 x.fillStyle='#d7d7d2';for(const r of RZ) x.fillRect(0,Y(r-10),W,20*sc);for(const r of RX) x.fillRect(X(r-10),0,20*sc,H);
 x.fillStyle='#4a4d52';for(const r of RZ) x.fillRect(0,Y(r-7),W,14*sc);for(const r of RX) x.fillRect(X(r-7),0,14*sc,H);
 for(const z of zones){x.fillStyle=mapCol(z);x.fillRect(X(z.x-z.w/2),Y(z.z-z.d/2),z.w*sc,z.d*sc);x.strokeStyle='#10233d';x.lineWidth=1;x.strokeRect(X(z.x-z.w/2),Y(z.z-z.d/2),z.w*sc,z.d*sc);}
 if(names){x.font='bold '+fs+'px sans-serif';x.textAlign='center';x.textBaseline='middle';
  zones.forEach((z,i)=>{const px=X(z.x),py=(z.side==='N'?Y(z.z+z.d/2)+fs*.8+(i%2)*fs*1.05:Y(z.z-z.d/2)-fs*.7-(i%2)*fs*1.05);if(px<0||px>W||py<0||py>H) return;
   x.lineWidth=3;x.strokeStyle='rgba(10,20,35,.85)';x.strokeText(z.court,px,py);x.fillStyle='#fff';x.fillText(z.court,px,py);});}
 // voiture
 x.fillStyle='#3a8aff';x.beginPath();x.arc(X(S.car.x),Y(S.car.z),Math.max(3,2.2*sc),0,7);x.fill();
 // repère
 const m=markerPos();if(m){let mx=X(m.x),my=Y(m.z);const pul=.5+.5*Math.sin(performance.now()/260);let clamped=false;
  const mg=10,cxm=W/2,cym=H/2;if(mx<mg||mx>W-mg||my<mg||my>H-mg){const a=Math.atan2(my-cym,mx-cxm),k=Math.min((W/2-mg)/Math.abs(Math.cos(a)||1e-6),(H/2-mg)/Math.abs(Math.sin(a)||1e-6));mx=cxm+Math.cos(a)*k;my=cym+Math.sin(a)*k;clamped=true;}
  x.strokeStyle='#ffc820';x.fillStyle='rgba(255,200,32,.35)';x.lineWidth=2.5;x.beginPath();x.arc(mx,my,(clamped?6:8)+pul*5,0,7);x.fill();x.stroke();}
 // joueur
 const px=X(P.x),py=Y(P.z),fx=Math.sin(P.ry),fz=Math.cos(P.ry),s=Math.max(7,fs*.9);
 x.fillStyle='#fff';x.strokeStyle='#10233d';x.lineWidth=1.5;x.beginPath();x.moveTo(px+fx*s,py+fz*s);x.lineTo(px-fx*s*.7-fz*s*.6,py-fz*s*.7+fx*s*.6);x.lineTo(px-fx*s*.7+fz*s*.6,py-fz*s*.7-fx*s*.6);x.closePath();x.fill();x.stroke();}
function drawBig(){const c=ui.big;drawMap(c,0,0,c.width/(HALF*2+20),true,Math.max(9,Math.round(c.width/52)));}
function drawMini(){const c=ui.mini;drawMap(c,P.x,P.z,c.width/200,true,8);}

/* ── lumière du jour ── */
const cDay=new T.Color(0x8fc4ee),cNight=new T.Color(0x070d1c),cDusk=new T.Color(0xf09060),cTmp=new T.Color();
function updateSky(){
 const h=(S.min+acc)/60,alt=Math.sin((h-6)/24*PI*2),sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 const dayF=sm(-.12,.3,alt),dusk=Math.exp(-Math.pow(alt/.17,2))*.65;
 cTmp.copy(cNight).lerp(cDay,dayF).lerp(cDusk,dusk);sceneObj.background.copy(cTmp);sceneObj.fog.color.copy(cTmp);
 hemi.intensity=.34+.62*dayF;hemi.color.setHex(0x9fb4e0).lerp(cDay.clone().multiplyScalar(1.1),dayF);
 sunL.intensity=.95*dayF;const a=(h-6)/12*PI;sunL.position.set(Math.cos(a)*120,Math.max(20,Math.sin(a)*120),60);
 sunL.color.setHex(0xfff0d0).lerp(cDusk,dusk*.8);
 if(lampMat) lampMat.color.setHex(dayF<.45?0xffe49a:0x7e786a);}

/* ═══════════ Boucle ═══════════ */
let R=null,raf=0,last=0,saveT=0,mapT=0,hudTime='',hudMoney='',camPos=new T.Vector3(),camInit=false;
function fit(){if(!ui||!R) return;const w=Math.max(2,ui.r.clientWidth),h=Math.max(2,ui.r.clientHeight);R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();if(mapOpen){sizeBig();drawBig();}}
function frame(t){
 if(!active) return;raf=requestAnimationFrame(frame);
 const dt=Math.min(.05,Math.max(0,(t-last)/1000));last=t;
 if(!api.paused){
  acc+=dt*api.timeScale;while(acc>=1){acc-=1;stepMin();}
  if(P.inCar) drive(dt);else walk(dt);
  saveT+=dt;if(saveT>30){saveT=0;api.save();}}
 S.player.x=P.x;S.player.z=P.z;S.player.ry=P.ry;S.player.inCar=P.inCar;
 syncCarMesh(api.paused?0:dt);updateZones();updateInteract();
 // caméra
 if(P.inCar){const fx=Math.sin(S.car.ry),fz=Math.cos(S.car.ry),tx=S.car.x-fx*7.5,tz=S.car.z-fz*7.5,k=camInit?1-Math.exp(-7*dt):1;
  camPos.x+=(tx-camPos.x)*k;camPos.y=3.4;camPos.z+=(tz-camPos.z)*k;camInit=true;cam.position.copy(camPos);cam.lookAt(S.car.x+fx*5,1.3,S.car.z+fz*5);}
 else{camInit=false;cam.position.set(P.x,1.7,P.z);cam.rotation.set(P.pitch,P.ry+PI,0);}
 updateSky();
 if(beacon&&beacon.visible) beacon.material.opacity=.2+.12*Math.sin(t/300);
 // HUD
 const ts=api.timeStr();if(ts!==hudTime){hudTime=ts;ui.time.textContent=ts;}
 const ms=fmt(S.money);if(ms!==hudMoney){hudMoney=ms;ui.money.textContent=ms;}
 if(P.inCar){ui.speed.hidden=false;ui.speed.textContent=Math.round(Math.abs(car.v)*3.6)+' km/h';}else if(!ui.speed.hidden) ui.speed.hidden=true;
 if(t-mapT>120){mapT=t;drawMini();if(mapOpen) drawBig();}
 R.render(sceneObj,cam);
 emit('tick',dt);}

function applyState(){
 P.x=S.player.x;P.z=S.player.z;P.ry=S.player.ry;P.pitch=0;P.inCar=!!S.player.inCar;car.v=0;acc=0;camInit=false;
 carObj.position.set(S.car.x,0,S.car.z);zoneCur=null;
 ui.r.classList.toggle('mw-incar',P.inCar);
 placeBeacon();}
function begin(fresh){
 S=fresh?newState():(load()||newState());api.S=S;
 applyState();
 if(S.marker==='garage1'&&!S.flags.coinVu) api.hud('goal','Objectif : rejoignez le <b>Garage du Coin</b> (repère jaune sur la carte).');
 emit('start');
 if(fresh||!S.flags.welcomed){S.flags.welcomed=true;api.toast('Bienvenue ! Votre carrière de mécanicien commence. Rendez-vous au Garage du Coin (repère jaune).','good');}}
api.reset=()=>{try{localStorage.removeItem(SAVE_KEY);}catch(e){}ensureUI();begin(true);api.save();};
api.isOpen=()=>active;
function activate(){
 if(active) return;active=true;
 window.addEventListener('keydown',onKey,true);window.addEventListener('keyup',onKey,true);document.addEventListener('mousemove',onMouse);
 document.addEventListener('pointerlockchange',onLockChange);
 window.addEventListener('blur',onBlur);window.addEventListener('resize',onResize);window.addEventListener('orientationchange',onResize);
 window.addEventListener('pagehide',onHide);document.addEventListener('visibilitychange',onHide);}
function deactivate(){
 active=false;cancelAnimationFrame(raf);
 window.removeEventListener('keydown',onKey,true);window.removeEventListener('keyup',onKey,true);document.removeEventListener('mousemove',onMouse);
 document.removeEventListener('pointerlockchange',onLockChange);
 window.removeEventListener('blur',onBlur);window.removeEventListener('resize',onResize);window.removeEventListener('orientationchange',onResize);
 window.removeEventListener('pagehide',onHide);document.removeEventListener('visibilitychange',onHide);}
const onBlur=()=>{keys={};js.x=js.y=0;};
const onHide=()=>{if(active&&S) api.save();};
let rsT=0;const onResize=()=>{clearTimeout(rsT);rsT=setTimeout(fit,60);fit();};
api.open=()=>{
 ensureUI();
 if(!built){buildWorld();regZoneInteracts();}
 if(!R){try{R=new T.WebGLRenderer({canvas:ui.cv,antialias:!isPhone(),powerPreference:'high-performance'});}catch(e){R=null;alert('La vue 3D n\'est pas disponible sur cet appareil.');return;}
  R.setPixelRatio(Math.min(window.devicePixelRatio||1,isPhone()?1.5:1.5));}
 if(typeof hideHome==='function') hideHome();
 ui.r.hidden=false;document.body.classList.add('mw-on');
 if(!S){begin(!load());}
 activate();fit();ui.touch.hidden=!touchOn();
 last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
 emit('open');};
api.suspend=()=>{if(!active) return;api.save();exitLock();deactivate();if(panelSt){const p=panelSt;panelSt=null;ui.pw.hidden=true;if(p.onClose) try{p.onClose();}catch(e){}}
 mapOpen=false;ui.map.hidden=true;sleeping=false;ui.fade.classList.remove('on');setPaused();keys={};
 ui.r.hidden=true;document.body.classList.remove('mw-on');emit('close');};
api.close=()=>{const was=active;api.suspend();if(was&&typeof showHome==='function') showHome();};
api.useDoor=id=>{const z=api.zone(id);if(z) zoneUse(z);};/* outil de test : déclenche l'action de la porte (ou du comptoir) d'une zone */
window.__mw=api;
return api;})();
