'use strict';
/* ───────────── Mode « Mécanicien » — GESTES RÉALISTES ─────────────
   Remplace les menus de gestes abstraits de js/41 par des gestes physiques à la 1re personne : on vise une vis, un bouchon,
   une pièce sur la vraie voiture (ancres de js/44 et moteur de engineMesh), son nom s'affiche, E fait le geste ; en
   maintenant E on dévisse / on serre / on verse avec une jauge de progression et du son. L'outil actuel (servante, touches
   1 à 0 ou molette, R = taille de douille) est visible en main ; un mauvais outil est refusé avec un message clair.
   La logique de jeu reste celle de js/41 (usure, diagnostic, facture, note, temps) : à la fin d'une dépose ou d'une pose,
   ce fichier appelle doDep / doPose de js/41 (via MWJ.L). Les pièces détaillées ne sont créées que pour la voiture en cours
   de travail (« rig ») et libérées dès qu'on s'en éloigne.

   ═══ API `MWG` ═══
   MWG.on()              vrai si les gestes réalistes sont actifs (sinon mode « menus » de js/41, réglable avec G)
   MWG.set({aide,classic}) aide : 'auto' (tant que moins de 4 voitures rendues) | 'on' | 'off' ; classic : true = anciens menus
   MWG.rig()             rig courant {c, g, tg (cibles), …} ou null
   MWG.aim()             élément visé {t, a} ou null ; MWG.hint() prochaine étape {t, a, ord} (mode aide)
   MWG.tools             outils ; MWG.tool(id) choisit un outil ; MWG.sock(n) choisit la douille
   MWG.acts(c)           actions disponibles maintenant sur la voiture (pour les tests : [{id, lab, tool, sock, hold, why}])
   MWG.run(id, {fast})   exécute l'action d'une cible par son identifiant (outil et douille réglés automatiquement) ; sert aux tests
   MWG.skip()            termine instantanément l'écoulement d'huile en cours (tests)
   Points d'accroche dans js/41 : GM (minutes restantes), LH (hauteur du pont), applyVisual (roues), mesh (restauration des roues),
   blocage et evalJob (écrous non serrés, vis oubliées : malus), regPoints (points d'interaction classiques masqués), openPoint (habitacle).
   Points d'accroche dans js/44 : engineParts / engineMesh (pièces amovibles du moteur et de la baie), js/40 : teleport (inclinaison) et eyeY. */
const MWG=(()=>{
const T=THREE,PI=Math.PI,TAU=PI*2;
const rnd=Math.random;
const L=()=>MWJ.L,PARTS=MWJ.PARTS;

/* ═══════════ Réglages ═══════════ */
const gs=()=>{const s=MW.S;if(!s) return {aide:'auto',classic:true};return s.gest||(s.gest={aide:'auto',classic:false});};
const on=()=>!!MW.S&&!gs().classic;
const aideOn=()=>{const g=gs();return g.aide==='on'||(g.aide==='auto'&&!!MW.S.jobs&&MW.S.jobs.stats.rendues<4);};

/* ═══════════ Outils ═══════════ */
const TOOLS=[
 {id:'main',nom:'Mains',key:'1'},
 {id:'cliquet',nom:'Cliquet + douille',key:'2',sock:1},
 {id:'cle_filtre',nom:'Clé à filtre',key:'3'},
 {id:'tournevis',nom:'Tournevis',key:'4'},
 {id:'boulonneuse',nom:'Boulonneuse',key:'5',sock:1},
 {id:'cle_dyn',nom:'Clé dynamométrique',key:'6',sock:1},
 {id:'bac',nom:'Bac de vidange',key:'7'},
 {id:'bidon',nom:'Bidon de liquide',key:'8'},
 {id:'entonnoir',nom:'Entonnoir',key:'9'},
 {id:'pinces',nom:'Pinces',key:'0'},
 {id:'presse',nom:'Repousse-piston / presse',key:''},
 {id:'seringue',nom:'Seringue d\'aspiration',key:''}];
const TOOL={};for(const t of TOOLS) TOOL[t.id]=t;
const SOCKS=[8,10,12,13,14,15,16,17,19,21,22,24,27,32];
let tool='main',sock=17;
const toolName=(id,sz)=>{const t=TOOL[id];return t?(t.sock&&sz?`${t.nom.toLowerCase()} (douille de ${sz})`:t.nom.toLowerCase()):id;};
function setTool(id){if(!TOOL[id]||tool===id) return;tool=id;vmSet();toolUI();snd('tool');}
function setSock(n){if(SOCKS.includes(n)){sock=n;toolUI();}}
function cycleSock(d){const i=SOCKS.indexOf(sock);setSock(SOCKS[(i+d+SOCKS.length)%SOCKS.length]);snd('tool');}
/* taille de douille imposée par la voiture : stable pour un modèle donné */
function hashN(s){let h=0;for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0;return Math.abs(h);}
const sockOf=(c,k)=>{const O={plug:[14,17,19,21,22],cart:[27,32],bolt:[10,12,13,14],brk:[17,18,19].map(x=>x===18?19:x),nut:[17,19,19,21],bat:[10,13],alt:[13,15],start:[13,15],plugs:[14,16],glow:[8,10,12],clip:[8,10],top:[13,15],inj:[8,10],gear:[13,15,17],arm:[13,15],clutch:[10,13],tens:[13,15,17],sonde:[22]}[k]||[13];return O[hashN((c.mdl||c.modele||'x')+k)%O.length];};

/* ═══════════ Maillages et matériaux ═══════════ */
const GCH=new Map(),MCH=new Map();
const gBox=(w,h,d)=>{const k='b'+w+'|'+h+'|'+d;let g=GCH.get(k);if(!g){g=new T.BoxGeometry(w,h,d);GCH.set(k,g);}return g;};
const gCyl=(r1,r2,h,n)=>{const k='c'+r1+'|'+r2+'|'+h+'|'+n;let g=GCH.get(k);if(!g){g=new T.CylinderGeometry(r1,r2,h,n||16);GCH.set(k,g);}return g;};
const gTor=(R,r,n,m)=>{const k='t'+R+'|'+r+'|'+n+'|'+m;let g=GCH.get(k);if(!g){g=new T.TorusGeometry(R,r,m||8,n||20);GCH.set(k,g);}return g;};
const gSph=(r)=>{const k='s'+r;let g=GCH.get(k);if(!g){g=new T.SphereGeometry(r,12,10);GCH.set(k,g);}return g;};
function mat(col,kind,op){
 const k=col+'|'+(kind||'l')+'|'+(op||1);let m=MCH.get(k);if(m) return m;
 if(kind==='p') m=new T.MeshPhongMaterial({color:col,shininess:55,specular:0x666666});
 else if(kind==='e') m=new T.MeshBasicMaterial({color:col});
 else if(kind==='t') m=new T.MeshLambertMaterial({color:col,transparent:true,opacity:op||.5,side:T.DoubleSide,depthWrite:false});
 else if(kind==='v') m=new T.MeshBasicMaterial({color:col,depthTest:false,depthWrite:false,transparent:true,opacity:op||1}); /* maillage d'aide, toujours visible */
 else m=new T.MeshLambertMaterial({color:col});
 MCH.set(k,m);return m;}
const C={steel:0x9aa3ab,dsteel:0x4d535a,chrome:0xdfe3e7,rubber:0x1b1b1e,plast:0x25282c,red:0xc02a20,blue:0x2a62c8,yel:0xe8b820,org:0xff7a00,alu:0xb4bcc4,brass:0xc9a24a,rust:0x7a4a2a,white:0xe9e9e4,grn:0x2f9a4a,cast:0x5a5e64};
function mk(geo,m,x,y,z,rx,ry,rz){const o=new T.Mesh(geo,m);o.position.set(x||0,y||0,z||0);if(rx||ry||rz) o.rotation.set(rx||0,ry||0,rz||0);return o;}
const bx=(w,h,d,col,x,y,z,k)=>mk(gBox(w,h,d),mat(col,k||'l'),x,y,z);
const cy=(r,h,col,x,y,z,ax,k,n)=>{const m=mk(gCyl(r,r,h,n||14),mat(col,k||'l'),x,y,z);if(ax==='x') m.rotation.z=PI/2;else if(ax==='z') m.rotation.x=PI/2;return m;};
const cone=(r1,r2,h,col,x,y,z,ax,k)=>{const m=mk(gCyl(r1,r2,h,16),mat(col,k||'l'),x,y,z);if(ax==='x') m.rotation.z=PI/2;else if(ax==='z') m.rotation.x=PI/2;return m;};
const hex=(r,h,col,x,y,z,ax)=>cy(r,h,col,x,y,z,ax,'p',6);
const tor=(R,r,col,x,y,z,ax,k)=>{const m=mk(gTor(R,r,24,8),mat(col,k||'l'),x,y,z);if(ax==='x') m.rotation.y=PI/2;else if(ax==='y') m.rotation.x=PI/2;return m;};
const sph=(r,col,x,y,z,k)=>mk(gSph(r),mat(col,k||'l'),x,y,z);
function grp(x,y,z,...kids){const g=new T.Group();g.position.set(x||0,y||0,z||0);for(const k of kids) if(k) g.add(k);return g;}
const V3=(x,y,z)=>new T.Vector3(x,y,z);
const clamp01=x=>Math.max(0,Math.min(1,x));
const lerpC=(a,b,t)=>new T.Color(a).lerp(new T.Color(b),clamp01(t)).getHex();
/* couleur de l'huile selon l'usure : or clair → brun → noire */
const oilCol=u=>u<25?lerpC(0xd9a82a,0x8a5a16,u/25):lerpC(0x8a5a16,0x0d0b09,(u-25)/55);
function disposeObj(o){o.traverse(m=>{if(m.isMesh&&m.userData.own){if(m.geometry) m.geometry.dispose();if(m.material&&m.material.dispose) m.material.dispose();}});}

/* ═══════════ Animation (rien n'est « téléporté » : tout glisse) ═══════════ */
const ANI=[];
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function tw(o,to,dur,cb){
 if(!o) return;
 for(let i=ANI.length-1;i>=0;i--) if(ANI[i].o===o) ANI.splice(i,1);
 const a={o,t:0,d:Math.max(0,dur||0),cb,p0:o.position.clone(),r0:[o.rotation.x,o.rotation.y,o.rotation.z],s0:o.scale.x,to};
 if(!(a.d>0)){applyTw(a,1);if(cb) cb();return;}
 ANI.push(a);}
function applyTw(a,k){const o=a.o,to=a.to,e=k>=1?1:ease(k);
 if(to.p) o.position.set(a.p0.x+(to.p[0]-a.p0.x)*e,a.p0.y+(to.p[1]-a.p0.y)*e,a.p0.z+(to.p[2]-a.p0.z)*e);
 if(to.r) o.rotation.set(a.r0[0]+(to.r[0]-a.r0[0])*e,a.r0[1]+(to.r[1]-a.r0[1])*e,a.r0[2]+(to.r[2]-a.r0[2])*e);
 if(to.s!=null) o.scale.setScalar(a.s0+(to.s-a.s0)*e);
 if(to.v!=null&&k>=1) o.visible=!!to.v;}
function animTick(dt){for(let i=ANI.length-1;i>=0;i--){const a=ANI[i];a.t+=dt;const k=a.t/a.d;applyTw(a,Math.min(1,k));if(k>=1){ANI.splice(i,1);if(a.cb) try{a.cb();}catch(e){console.error(e);}}}}
function attachTo(o,parent){if(o.parent===parent) return;o.updateMatrix();parent.attach(o);}

/* ═══════════ Sons (WebAudio simple, comme l'atelier) ═══════════ */
let bus=null;
function out(){const c=typeof fxCtx==='function'?fxCtx():null;if(!c) return null;if(!bus||bus.context!==c){bus=c.createGain();bus.gain.value=.85;bus.connect(c.destination);}return bus;}
function snd(k){
 try{const o=out();if(!o) return;const c=SFX.ctx,t=c.currentTime;
  if(k==='ratchet'){for(let i=0;i<3;i++) nz(o,t+i*.05,.025,{type:'bandpass',f:3300,q:3,g:.2,a:.001});tone(o,t+.16,.04,{f:1700,g:.07,a:.002});}
  else if(k==='impact'){for(let i=0;i<4;i++){nz(o,t+i*.035,.03,{type:'bandpass',f:2400,q:2,g:.24,a:.001});tone(o,t+i*.035,.03,{type:'square',f:210+(i%2)*40,g:.05,a:.002,lp:900});}}
  else if(k==='click'){tone(o,t,.05,{f:2100,g:.16,a:.001});nz(o,t,.04,{type:'highpass',f:3500,g:.2,a:.001});tone(o,t+.07,.14,{f:260,f2:140,g:.12,a:.003});}
  else if(k==='drip'){nz(o,t,.25,{type:'bandpass',f:780,f2:520,q:2.5,g:.16,a:.03});}
  else if(k==='pour'){nz(o,t,.3,{type:'lowpass',f:700,f2:460,g:.18,a:.05});tone(o,t,.2,{f:320,f2:520,g:.03,a:.04});}
  else if(k==='screw'){nz(o,t,.1,{type:'highpass',f:2600,g:.07,a:.01});}
  else if(k==='clunk'){tone(o,t,.2,{f:150,f2:62,g:.3,a:.003});nz(o,t,.1,{type:'lowpass',f:900,g:.25,a:.002});}
  else if(k==='tool'){nz(o,t,.05,{type:'highpass',f:2800,g:.12,a:.002});}
  else if(k==='err'){tone(o,t,.18,{type:'square',f:180,f2:120,g:.09,a:.005,lp:900});}
  else if(k==='ok'){tone(o,t,.2,{type:'triangle',f:660,f2:880,g:.08,a:.01});}
  else if(k==='lift'){nz(o,t,.5,{type:'lowpass',f:380,g:.22,a:.08});tone(o,t,.5,{type:'sawtooth',f:70,f2:90,g:.05,a:.1,lp:300});}
 }catch(e){}}
const SINT={ratchet:.2,impact:.14,screw:.18,pour:.28,drip:.5,pump:.4,lift:.5,wipe:.25};

/* ═══════════ État par voiture ═══════════ */
function GS(c){if(!c.g) c.g={};const g=c.g;if(!g.w) g.w={};if(!g.k) g.k={};if(!g.p) g.p={};if(!g.bin) g.bin={};if(!g.min) g.min={};if(!g.n) g.n=0;return g;}
const NUTS=c=>{try{const m=c.mdl&&MWCARS.get(c.mdl);if(m) return (m.cat==='pop'&&m.body!=='sedan'&&m.kind==='citadine')?4:5;}catch(e){}return c.kind==='citadine'?4:5;};
const CORN=['FL','FR','RL','RR'];
const axOf=S=>S[0]==='F'?'av':'ar';
const sgn=S=>S[1]==='L'?1:-1;
function wst(c,S){const g=GS(c);let w=g.w[S];if(!w){const n=NUTS(c);w=g.w[S]={n:new Array(n).fill(3),o:0,t:0};}return w;}
/* état d'un frein (par roue) */
function bst(c,S){const g=GS(c);let b=g.k[S];if(!b) b=g.k[S]={cb:[1,1],tl:0,pd:0,pi:0,ds:0,br:[1,1],sc:1,ct:[2,2],bt:[2,2]};return b;}

/* ═══════════ Rig : voiture en cours de travail ═══════════ */
let R=null;           /* rig courant */
let AIM=null,HINT=null,eDown=false,H=null;  /* visée, aide, E enfoncé, geste maintenu */
const tmpV=new T.Vector3(),tmpV2=new T.Vector3(),tmpV3=new T.Vector3();
const car0=()=>MWJ.jobs();
function visOf(o){for(let p=o;p;p=p.parent) if(p.visible===false) return false;return true;}
function worldOf(t,out_){const o=typeof t.o==='function'?t.o():t.o;if(!o) return null;if(t.off) out_.copy(t.off).applyMatrix4(o.matrixWorld);else o.getWorldPosition(out_);return out_;}

function newRig(c){
 const g=MWJ.mesh(c);if(!g) return null;const z=MW.zone(c.zone),p=z&&z.ponts&&z.ponts[c.pont];if(!p) return null;
 const r={c,g,u:g.userData,p,tg:[],root:new T.Group(),fl:new T.Group(),objs:{},procs:[],bayDone:false,hand:null,vis:[],done:false,minAcc:0};
 r.root.name='mg_root';g.add(r.root);r.fl.name='mg_floor';MW.scene.add(r.fl);
 r.cosr=Math.cos(p.ry);r.sinr=Math.sin(p.ry);
 /* coordonnées horizontales locales de la voiture (lx = gauche, lz = avant) → monde */
 r.W=(lx,ly,lz)=>new T.Vector3(p.x+r.cosr*lx+r.sinr*lz,ly+.22,p.z-r.sinr*lx+r.cosr*lz); /* ly = hauteur au-dessus du sol (le sol est à y = 0,22) */
 r.add=t=>{r.tg.push(t);return t;};
 /* point d'ancrage : ceux de la carrosserie, sinon ceux du moteur de la baie (alternateur, bobines, distribution…), construits à l'ouverture du capot */
 r.A=n=>{const a=MWCARS.anchor(g,n);if(a) return a;const b=g.userData.bay,v=b&&b.userData&&b.userData.anchors&&b.userData.anchors[n];return v?v.clone():new T.Vector3();};
 r.gy=()=>g.position.y;   /* hauteur de la voiture (pont) */
 r.F=GS(c);
 /* dessous : la voiture passe au maillage « base » (sans les pièces amovibles du châssis, que js/46b dessine une à une) */
 {const ud=g.userData,un=ud.under,ch=ud.G&&ud.G.ch;if(un&&ch){un.geometry=ch.base;r.swap=true;}}
 return r;}
function freeRig(){
 if(!R) return;
 for(const pr of R.procs) try{pr.free&&pr.free(R);}catch(e){}
 R.root.parent&&R.root.parent.remove(R.root);disposeObj(R.root);
 R.fl.parent&&R.fl.parent.remove(R.fl);disposeObj(R.fl);
 for(const o of R.vis){o.parent&&o.parent.remove(o);}
 {const un=R.u.under,ch=R.u.G&&R.u.G.ch;if(R.swap&&un&&ch) un.geometry=ch.full;}
 ANI.length=0;hlClear();if(ring) ring.visible=false;if(ring2) ring2.visible=false;R=null;AIM=null;HINT=null;H=null;handSet(null);setHold(0);if(MW.eyeY) MW.eyeY=0;}

/* ═══════════ Cibles, actions, visée ═══════════ */
/* action : {lab, tool, sock, hold, snd, ok:()=>why|null, fix, do, min, ph:[partId,'dep'|'pose'], ord, exp, key} */
function actsOf(t){let a=[];try{a=t.acts()||[];}catch(e){console.error('acts '+t.id,e);}return a.filter(Boolean);}
function pickAct(t){
 const a=actsOf(t);if(!a.length) return null;
 /* l'action dont l'outil correspond et qui est possible ; sinon la première possible ; sinon la première (pour le message) */
 let best=a.find(x=>!x.why&&x.tool===tool);
 if(!best) best=a.find(x=>!x.why&&!x.insp)||a.find(x=>!x.why);
 if(!best) best=a[0];
 return best;}
const REACH=3.1;
function aimUpdate(){
 AIM=null;if(!R||MW.paused||MW.player().inCar) return;
 const cam=MW.cam;cam.getWorldDirection(tmpV2);const cp=cam.position;let bs=9,bt=null;
 for(const t of R.tg){
  const hid=!!(t.vis&&!t.vis());
  /* l'objet lui-même peut être caché (vis retirée, couvercle déposé, plaquette sortie) : on vise son emplacement tant que son support est visible */
  const o=typeof t.o==='function'?t.o():t.o;if(!o||!visOf(o.parent||o)) continue;
  if(!worldOf(t,tmpV)) continue;
  tmpV3.copy(tmpV).sub(cp);const d=tmpV3.length();if(d>REACH||d<.05) continue;tmpV3.divideScalar(d);
  const ang=Math.acos(clamp01((tmpV3.dot(tmpV2)+1)/2)*2-1),thr=Math.atan2(t.r||.08,d)+.045;
  let sc=ang/thr;if(!(sc<1&&sc<bs)) continue;
  const ac=actsOf(t);if(!ac.length) continue; /* rien à faire ici : ne masque pas une cible voisine */
  if(hid&&!ac.some(x=>!x.why&&!x.insp)) continue; /* cible cachée (pièce déposée…) : visable seulement pour y faire quelque chose */
  if(ac.some(x=>!x.insp&&!x.why&&(x.tool===tool||x.tool2===tool))) sc*=.35; /* préférence : ce qui accepte l'outil en main */
  else if(ac.every(x=>x.insp||x.why)) sc=Math.min(.999,sc*1.6+.15); /* seulement inspecter ou bloqué : passe après */
  if(sc<bs){bs=sc;bt=t;}}
 if(bt){const a=pickAct(bt);if(a) AIM={t:bt,a};}}

function hintUpdate(){
 HINT=null;if(!R||!aideOn()) return;
 let best=null,fixes=[];
 for(const t of R.tg){for(const a of actsOf(t)){if(!a.exp) continue;
   if(!a.why){if(!best||a.ord<best.a.ord) best={t,a};}
   else if(a.fix) fixes.push({ord:a.ord,fix:a.fix});}}
 if(!best&&fixes.length){fixes.sort((x,y)=>x.ord-y.ord);const t=R.tg.find(q=>q.id===(fixes[0].fix==='lower'?'lift':fixes[0].fix));if(t){const a=actsOf(t).find(x=>!x.why);if(a) best={t,a};}}
 else if(best&&fixes.length){ /* une action bloquée plus tôt dans l'ordre passe devant : on l'aide à se débloquer */
  fixes.sort((x,y)=>x.ord-y.ord);if(fixes[0].ord<best.a.ord){const t=R.tg.find(q=>q.id===(fixes[0].fix==='lower'?'lift':fixes[0].fix));if(t){const a=actsOf(t).find(x=>!x.why);if(a) best={t,a};}}}
 HINT=best;}

function checkAct(a){
 if(a.why) return a.why;
 if(a.tool&&a.tool!==tool&&!(a.tool2&&a.tool2===tool)){
  if(a.tool==='main') return "Il faut avoir les mains libres (touche V) ou tenir la pièce.";
  const ids=[a.tool].concat(a.tool2?[a.tool2]:[]),i=ids.map(t=>MWJ.toolIdx(t)).find(x=>x>=0);
  if(i!=null&&i>=0) return `Prenez ${toolName(MWJ.inv()[i].id,a.sock)} en main : touche ${MWJ.SLOTK[i]}.`;
  return `Il vous faut ${toolName(a.tool,a.sock)} : allez le chercher à la servante (chariot rouge près du pont) ou à l'établi.`;}
 if(a.sock&&TOOL[tool].sock&&sock!==a.sock) return `Il faut une douille de ${a.sock} (vous avez la ${sock}) : touche R ou le bouton de douille.`;
 return null;}

/* ── exécution ── */
function warn(t){MW.toast(t,'warn');snd('err');}
function startAct(){
 if(!AIM||H) return;const {t,a}=AIM;
 let why=checkAct(a);
 /* aide active : le bon outil et la bonne douille sont pris automatiquement (le joueur apprend en voyant lesquels) */
 if(why&&!a.why&&aideOn()&&a.tool&&TOOL[a.tool]){const need=a.tool!==tool&&!(a.tool2&&a.tool2===tool);
  if(need){if(a.tool==='main') MWJ.hands();else if(!MWJ.holdTool(a.tool)&&a.tool2) MWJ.holdTool(a.tool2);}
  if(a.sock&&TOOL[tool].sock&&sock!==a.sock) setSock(a.sock);
  why=checkAct(a);if(!why&&need) MW.toast(`En main : ${toolName(tool,TOOL[tool].sock?sock:0)}.`,'info');}
 if(why){warn(why);return;}
 if(a.gate&&!a.gate()) {snd('err');return;}
 {const nb=netBusy(t);if(nb){warn(nb);return;}} /* [réseau] la même pièce est déjà en cours de travail chez l'ami */
 if(a.hold>0||a.cont){H={t,a,p:0,sn:0,k:0};if(a.start) a.start();return;}
 finish(t,a);}
/* [réseau] partie à deux : js/56 dit si l'ami est déjà en train de travailler sur cette cible de la voiture */
function netBusy(t){try{return typeof MWNET!=='undefined'&&MWNET.live()&&R&&R.c?MWNET.busyMsg(R.c.id,t.id):null;}catch(e){return null;}}
function finish(t,a){
 spend(a);
 try{a.do&&a.do();}catch(e){console.error('do '+(a.key||a.lab),e);}
 if(a.snd) snd(a.snd);
 vmKick(a);
 if(R) {R.F.n++;syncAll(false);}
 MW.emit('geste',R&&R.c,a.key||a.lab);
}
function spend(a){ /* temps de jeu : chaque geste avance l'horloge ; le budget barème de 41 est réparti sur les gestes d'une pièce */
 if(!R||!a.min) return;const F=R.F;R.minAcc+=a.min;const n=Math.floor(R.minAcc);
 if(n>=1){R.minAcc-=n;MW.addMin(n);}
 if(a.ph){const k=a.ph[0]+':'+a.ph[1];F.min[k]=(F.min[k]||0)+a.min;}}
function rest(c,id,ph,m){const F=GS(c),k=id+':'+ph,s=F.min[k]||0;delete F.min[k];return Math.max(0,m-s);}
const api={};
let lastHT=0;
function holdTick(dt0){
 /* temps réel (et non le pas d'image plafonné) : un geste maintenu dure le même temps même quand l'ordinateur affiche peu d'images */
 const now=performance.now(),dt=dt0>0?Math.min(.25,Math.max(dt0,(now-(lastHT||now))/1000)):0;lastHT=now;
 if(!H){setHold(0);return;}
 const {t,a}=H;
 if(!eDown||!AIM||AIM.t!==t||AIM.a.key!==a.key||MW.paused||checkAct(a)){ if(a.cancel) a.cancel(H); H=null;setHold(0);vmWork(0);return;}
 H.sn+=dt;const iv=SINT[a.snd]||.2;if(a.snd&&H.sn>=iv){H.sn=0;snd(a.snd);}
 vmWork(1);
 if(a.cont){a.tick&&a.tick(dt,H);setHold(a.prog?a.prog():0);if(a.auto&&a.auto()){const h=H;H=null;setHold(0);vmWork(0);finish(h.t,h.a);}return;}
 H.p+=dt/Math.max(.2,a.hold);setHold(H.p);
 if(H.p>=1){const h=H;H=null;setHold(0);vmWork(0);finish(h.t,h.a);}}
function onRelease(){const h=H;eDown=false;if(h&&h.a.cont){const a=h.a;H=null;setHold(0);vmWork(0);if(a.release) {a.release();} if(R){R.F.n++;syncAll(false);}}}

/* ═══════════ Interface : barre d'outils, visée, jauge, panneaux ═══════════ */
let UI=null;
function ensureUI(){
 const r=document.getElementById('mwRoot');if(!r) return null;if(UI&&UI.r===r) return UI;
 const q=(c,h)=>{const d=document.createElement('div');d.className=c;if(h) d.innerHTML=h;r.appendChild(d);return d;};
 UI={r,tb:q('mg-tools'),info:q('mg-info'),hold:q('mg-hold'),hint:q('mg-hint'),aux:q('mg-aux'),bin:q('mg-bin')};
 UI.tb.setAttribute('aria-label','Servante : outils');UI.tb.hidden=true;UI.info.hidden=true;UI.hold.hidden=true;UI.hint.hidden=true;UI.aux.hidden=true;UI.bin.hidden=true;
 UI.tb.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b){if(b.dataset.t==='sock') cycleSock(1);else setTool(b.dataset.t);}});
 UI.tb.addEventListener('contextmenu',e=>{e.preventDefault();if(e.target.closest('[data-t="sock"]')) cycleSock(-1);});
 return UI;}
let lastTb='';
function toolUI(){
 const u=ensureUI();if(!u) return;
 const h=aideOn()&&HINT&&HINT.a.tool;
 const key=tool+'|'+sock+'|'+h;if(key===lastTb) return;lastTb=key;
 let s='';if(TOOL[tool]&&TOOL[tool].sock) s=`<button type="button" class="mg-t sock${HINT&&HINT.a.sock&&HINT.a.sock!==sock&&aideOn()?' hint':''}" data-t="sock" title="Taille de douille (touche R)"><b>R</b><span>Douille ${sock}</span></button>`;
 u.tb.innerHTML=s;}
let lastInfo='';
function infoUI(){
 const u=ensureUI();if(!u) return;let h='',vis=false;
 if(AIM){const {t,a}=AIM,why=checkAct(a);vis=true;
  const nm=typeof t.name==='function'?t.name():t.name;
  h=`<b>${esc(nm)}</b>`;
  if(a.sub) h+=`<span class="s">${esc(typeof a.sub==='function'?a.sub():a.sub)}</span>`;
  if(why) h+=`<span class="w">${esc(why)}</span>`;
  else h+=`<span class="s">${esc(a.hold>0||a.cont?'Maintenir E · ':'E · ')}${esc(a.tool?toolName(a.tool,a.sock):'')}</span>`;}
 if(h!==lastInfo){lastInfo=h;u.info.innerHTML=h;}
 u.info.hidden=!vis;
 /* aide : prochaine étape */
 let hh='';if(aideOn()&&HINT){const nm=typeof HINT.t.name==='function'?HINT.t.name():HINT.t.name;const ht=HINT.a.tool,miss=ht&&ht!=='main'&&MWJ.toolIdx(ht)<0&&!(HINT.a.tool2&&MWJ.toolIdx(HINT.a.tool2)>=0);
  hh=`<i></i>Étape suivante : <b>${esc(HINT.a.lab)}</b> — ${esc(nm)}${ht?' · '+esc(toolName(ht,HINT.a.sock)):''}${miss?' <b>(à prendre à la servante, le chariot rouge)</b>':''}`;}
 /* pièce déposée sans pièce neuve en poche : on le dit toujours, même sans l'aide (c'est l'étape qui bloque le plus souvent) */
 if(R&&R.c&&R.c.rem){const c=R.c,ids=[...new Set(c.ordre.filter(id=>!c.done[id]&&c.parts[id]&&!c.parts[id].na).concat(Object.keys(c.rem)))],miss=ids.filter(id=>!c.done[id]&&!haveNew(c,id));
  if(miss.length){const nx=hh;const e=typeof MWC!=='undefined'&&MWC.employer?MWC.employer():null,shop=!!(e&&(e.compte||e.aSonCompte));
   hh=`<i></i>Pièce neuve à aller chercher : <b>${esc(miss.map(id=>pname(R.c,id)).join(', '))}</b> — ${shop?'achetez-la chez Pièces Auto Express':'prenez-la à l\'étagère de l\'atelier (E devant l\'étagère)'}, puis revenez la monter.${nx?'<br>'+nx.replace('<i></i>',''):''}`;}}
 if(hh!==u._hh){u._hh=hh;u.hint.innerHTML=hh;}u.hint.hidden=!hh;}
function setHold(p){const u=UI;if(!u) return;if(p<=0){if(!u.hold.hidden) u.hold.hidden=true;return;}u.hold.hidden=false;u.hold.style.setProperty('--p',Math.round(clamp01(p)*360)+'deg');}
function auxSet(h){const u=ensureUI();if(!u) return;if(!h){u.aux.hidden=true;return;}u.aux.innerHTML=h;u.aux.hidden=false;}
function binUI(){
 const u=ensureUI();if(!u||!R) return;const b=R.F.bin,n=Object.keys(b).reduce((s,k)=>s+(b[k]||0),0);
 const t=n?`<b>Bac magnétique</b> : ${Object.keys(b).filter(k=>b[k]>0).map(k=>b[k]+' '+BIN_NOM[k]).join(', ')}`:'';
 if(t!==u._bt){u._bt=t;u.bin.innerHTML=t;}u.bin.hidden=!t;}
const BIN_NOM={ecrou:'écrou(s)',vis_et:'vis d\'étrier',vis_br:'vis de support',vis_dq:'vis de disque',bouchon:'bouchon',joint:'joint',vis:'vis',clip:'clip(s)',cosse:'borne(s)'};
function binAdd(k,n){const b=R.F.bin;b[k]=(b[k]||0)+(n||1);}
function binTake(k,n){const b=R.F.bin;b[k]=Math.max(0,(b[k]||0)-(n||1));if(!b[k]) delete b[k];}

/* ═══════════ Pièce en main et outil en main (vue 1re personne) ═══════════ */
/* l'outil, les gants et les avant-bras sont dessinés par js/47 (2e passe de rendu, au 1er plan) */
const MF=()=>typeof MWF!=='undefined'?MWF:null;
function vmEnsure(){const m=MF();if(m) m.vmEnsure();}
function vmSet(){const m=MF();if(m) m.vmTool(tool);}
function handSet(item){const m=MF();if(m) m.vmItem(item);} /* pièce neuve tenue dans l'autre main (ou null) */
function vmKick(a){const m=MF();if(m) m.vmKick();}
function vmWork(w){const m=MF();if(m) m.vmWork(w);}
function vmTick(dt){const m=MF();if(m) m.vmTick(dt,!!R&&on()&&!MW.paused&&!MW.player().inCar);}

/* ═══════════ Synchronisation visuelle ═══════════ */
function syncAll(instant){if(!R) return;for(const pr of R.procs) try{pr.vis&&pr.vis(R,!!instant);}catch(e){console.error('vis '+pr.id,e);}binUI();}

/* ═══════════ Outils de construction des procédures ═══════════ */
const BUILD=[];                       /* constructeurs de procédures : (R) => void */
const liftedNow=c=>!!c.st.lifted;
const partOK=(c,id)=>!!c.parts[id]&&!c.parts[id].na;
const chainWanted=(c,id)=>{const y=c.symp&&MWJ.symDef(c);return !!(y&&y.ch&&y.ch.includes(id)&&c.insp[id]);}; /* dégât en chaîne déjà inspecté (js/51) */
const wanted=(c,id)=>partOK(c,id)&&!c.done[id]&&(c.ordre.includes(id)||(c.symp&&c.symp.c===id)||chainWanted(c,id)||!!(c.g&&c.g.p[id]));
const wantedAny=(c,ids)=>ids.some(id=>wanted(c,id));
const pname=(c,id)=>MWJ.pn(c,id);
const accOK=(c,id)=>{const a=L().acces(c,PARTS[id]);return a.ok?null:a.why;};
const haveNew=(c,id)=>L().newFind?L().newFind(c,id)>=0:L().invFind('neuve',id)>=0; /* neuve ou pièce de réemploi */
const needNew=(c,id)=>haveNew(c,id)?null:`Il vous faut ${pname(c,id).toLowerCase()} neuf(ve) : prenez-le à l'étagère de l'atelier ou achetez-le chez Pièces Auto Express.`;
const levelOK=(c,id)=>L().canDo(id,c)?null:`Réservé aux mécaniciens plus expérimentés : ${MWJ.SK_NOM[PARTS[id].comp].toLowerCase()} niveau ${PARTS[id].niv} requis (vous : niveau ${MWJ.level(PARTS[id].comp)}).`;
function toolGate(c,id){const p=PARTS[id];return L().outilOK(p.outil,c)?null:`Il vous faut : ${MWJ.OUTILS[p.outil].nom.toLowerCase()} (en vente chez Pièces Auto Express).`;}
/* appelle la logique de js/41 sans faire avancer l'horloge deux fois */
function logic(fn,c,id){let r=false;api.fin=true;try{r=fn(c,id);}finally{api.fin=false;}return r;}
function doDepL(R,id){if(R.c.rem[id]||R.c.done[id]) return true;const r=logic(L().doDep,R.c,id);if(r) R.F.p[id]=1;return r;}
function doPoseL(R,id){if(R.c.done[id]) return true;const r=logic(L().doPose,R.c,id);if(r&&/^(plaq|disq)_/.test(id)) R.F.pump=1;return r;}
const fixOf=(w)=>w&&/pont/i.test(w)?(/Baissez|baiss/i.test(w)?'lower':'lift'):w&&/capot/i.test(w)?'hood':null;
/* ordre d'une action selon la pièce voulue (les pièces de l'ordre passent dans l'ordre de la commande) */
const pidx=(c,id)=>{const i=c.ordre.indexOf(id);return i<0?(c.symp&&c.symp.c===id?0:5):i;};
/* écart de coordonnées d'un maillage : place un objet « en main » ou sur le sol (monde) */
function floorSpot(R,o,i,h){const w=R.W(2.0+.5*(i%3),h||.02,-1.7-.45*Math.floor(i/3));attachTo(o,R.fl);tw(o,{p:[w.x,w.y,w.z],r:[0,R.p.ry,0]},.5);}

/* ═══════════ Procédure commune : servante, bac magnétique, commande du pont, capot, portière, pédale ═══════════ */
const jobDone=c=>c.ordre.length?c.ordre.every(id=>c.done[id]):!!(c.symp&&c.done[c.symp.c]);
function buildCommon(R){
 const {c,g,u}=R,F=R.F;R.blk={lower:[],hood:[]};R.spotN=0;
 /* servante à outils avec bac magnétique */
 const cart=grp();const cp=R.W(3.05,0,-1.0);cart.position.copy(cp);cart.rotation.y=R.p.ry;
 cart.add(bx(.78,.62,.44,C.red,0,.46,0),bx(.8,.03,.46,C.dsteel,0,.78,0),bx(.74,.02,.4,C.dsteel,0,.46,.22));
 for(const [x,z] of [[-.34,-.17],[.34,-.17],[-.34,.17],[.34,.17]]) cart.add(cy(.05,.04,C.rubber,x,.07,z,'x'));
 for(const y of [.32,.46,.6]) cart.add(bx(.7,.012,.01,C.dsteel,0,y,.225));
 const binM=cy(.14,.035,C.org,0,.815,0,null,'l',20);cart.add(binM);cart.add(cy(.12,.01,0x555a60,0,.834,0,null,'p',20));
 /* un manche d'outil sur le plateau, pour l'ambiance */
 cart.add(bx(.04,.03,.22,C.yel,.28,.81,.0),bx(.05,.03,.12,C.alu,-.28,.81,-.05));
 const items=grp();cart.add(items);R.fl.add(cart);R.cart=cart;R.binItems=items;
 /* la servante se vise : on y prend et on y range les outils (ils ne sont pas dans les poches du joueur) */
 R.add({id:'servante',o:cart,off:new T.Vector3(0,.8,0),r:.4,name:'Servante à outils',acts:()=>[{key:'srv',lab:'Prendre ou ranger des outils',ord:999,do:()=>MWJ.servante(c.zone)}]});
 R.binSig='';
 R.binSync=()=>{const b=F.bin,n=Math.min(16,Object.keys(b).reduce((s,k)=>s+b[k],0)),sig=n+'|'+JSON.stringify(b);if(sig===R.binSig) return;R.binSig=sig;
  while(items.children.length) items.remove(items.children[0]);
  let i=0;for(const k in b) for(let j=0;j<b[k]&&i<16;j++,i++){const a=i*2.4,r=.02+.075*Math.sqrt(i/16);const big=k==='ecrou'||k==='bouchon';items.add(hex(big?.013:.008,big?.02:.03,0xc9ced3,Math.cos(a)*r,.845,Math.sin(a)*r,big?'y':'x'));}};
 /* commande du pont */
 const col=grp();col.position.copy(R.W(2.1,0,2.7));col.rotation.y=R.p.ry;
 col.add(bx(.26,1.2,.2,C.yel,0,.6,0),bx(.2,.24,.04,C.dsteel,0,1.0,.11),cy(.025,.03,0x2fbf4a,-.05,1.02,.135,'z'),cy(.025,.03,0xd03030,.05,1.02,.135,'z'));
 R.fl.add(col);R.col=col;
 const lowerWhy=()=>{if(c.st.av||c.st.ar) return "Remontez d'abord les roues.";if(Object.keys(c.rem).some(id=>PARTS[id].zone==='dessous'||PARTS[id].zone==='roue')) return 'Une pièce est démontée sous la voiture.';
  for(const f of R.blk.lower){const w=f();if(w) return w;}return null;};
 R.add({id:'lift',o:col,off:new T.Vector3(0,1.02,.12),r:.16,name:()=>c.noir?'Chandelles et cric':'Commande du pont élévateur',
  acts:()=>[c.st.lifted?{key:'lower',lab:c.noir?'Redescendre la voiture':'Baisser le pont',hold:1.2,snd:'lift',why:lowerWhy(),ord:70,do:()=>{L().togPont(c);}}
   :{key:'raise',lab:c.noir?'Mettre la voiture sur chandelles':'Lever le pont',hold:1.2,snd:'lift',ord:10,do:()=>{L().togPont(c);}}]});
 /* capot : verrou à l'avant du capot (suit le capot quand il s'ouvre) */
 const hood=g.getObjectByName('hood');
 if(hood){const hl=u.hoodLen||.9;
  R.add({id:'hood',o:hood,off:new T.Vector3(0,.03,hl*.78),r:.2,name:'Capot',
   acts:()=>[c.st.capot?{key:'hclose',lab:'Fermer le capot',hold:.6,ord:90,exp:jobDone(c)&&!!c.g,snd:'clunk',
     why:Object.keys(c.rem).some(id=>PARTS[id].zone==='capot')?'Une pièce est démontée sous le capot.':(R.blk.hood.map(f=>f()).find(Boolean)||null),do:()=>{L().togCapot(c);}}
    :{key:'hopen',lab:'Ouvrir le capot (déverrouiller et lever)',hold:.6,ord:5,snd:'clunk',do:()=>{L().togCapot(c);}}]});}
 /* habitacle et portières (js/44h) : vraie portière qui pivote, découpe locale de la carrosserie, boîte à gants, pédale */
 const hab=typeof MWHAB!=='undefined'?MWHAB.build(R):null;R.hab=hab;
 const wantCab=()=>wanted(c,'filtre_hab')||(!!F.p.filtre_hab&&!c.done.filtre_hab);
 if(hab&&partOK(c,'essuie')&&relevant(c).has('essuie')) hab.swapBlade(true);
 /* portière conducteur : poignée dessinée ; habitacle (valise, essai sur route, rendre la voiture) */
 const dn=hab?hab.ddn:new T.Object3D();if(!hab){dn.position.set((u.W||1.8)/2+.01,.98,R.A('cabin').z+.18);R.root.add(dn);}
 R.objs.door=dn;
 R.add({id:'door',o:dn,r:.2,name:'Portière conducteur',acts:()=>[{key:'door',lab:'Habitacle : valise, essai sur route, rendre la voiture',ord:99,exp:jobDone(c)&&!c.st.capot&&!c.st.lifted&&!blocage(c).length,do:()=>{MWJ.openPoint(c.id,'cabine');}}]});
 /* portière passager : on l'ouvre pour travailler dans l'habitacle (filtre derrière la boîte à gants) */
 if(hab){
  R.add({id:'pdoor',o:hab.pdn,r:.2,name:'Portière passager',acts:()=>[F.pdoor
   ?{key:'pdc',lab:'Refermer la portière passager',hold:.4,snd:'clunk',ord:95,exp:!wantCab(),why:c.rem.filtre_hab?"Remettez d'abord le filtre d'habitacle.":null,do:()=>{F.pdoor=0;}}
   :{key:'pdo',lab:"Ouvrir la portière passager (travail dans l'habitacle)",hold:.4,snd:'clunk',ord:6,exp:wantCab(),do:()=>{F.pdoor=1;}}]});
  R.procs.push({id:'cabine',vis:()=>{hab.setDoor(!!F.pdoor);},tick:(R2,dt)=>hab.tick(dt),free:()=>{hab.free();R.hab=null;}});}
 /* pédale de frein (à pomper après un travail sur les freins) : le pied de pédale dessiné est la cible */
 const pd=hab?hab.pedalT:new T.Object3D();if(!hab){pd.position.set(R.A('cabin').x,.32,R.A('cabin').z+.5);R.root.add(pd);}
 R.add({id:'pedal',o:pd,r:.14,name:'Pédale de frein (par la vitre)',vis:()=>true,acts:()=>[F.pump?{key:'pump',lab:'Pomper la pédale de frein',hold:1.6,snd:'pump',ord:80,exp:!liftedNow(c)&&!blocage(c).filter(x=>!/pédale/.test(x)).length,do:()=>{F.pump=0;MW.toast('La pédale est ferme : les plaquettes sont en contact avec les disques.','good');}}:{key:'pump0',lab:'Appuyer sur la pédale : elle est ferme',insp:1,ord:200,do:()=>{MW.toast('La pédale de frein est ferme.','info');}}]});
 R.procs.push({id:'common',vis:(R2,inst)=>{R2.binSync();},free:()=>{}});
}
BUILD.push(buildCommon);

/* ═══════════ Roues : écrous, déposer / reposer (macro commune à tous les travaux de roue) ═══════════ */
const STAR=n=>n===4?[0,2,1,3]:[0,2,4,1,3];
let TREADS=null;
function treadTex(k){
 if(!TREADS) TREADS={};if(TREADS[k]) return TREADS[k];
 const cv=document.createElement('canvas');cv.width=128;cv.height=64;const x=cv.getContext('2d');
 x.fillStyle=k==='new'?'#141416':k==='mid'?'#2a2a2d':'#3b3b3f';x.fillRect(0,0,128,64);
 if(k==='new'){x.fillStyle='#2f2f33';for(let i=0;i<16;i++){x.fillRect(i*8+1,2,5,18);x.fillRect(i*8+4,24,5,16);x.fillRect(i*8+1,44,5,18);}x.fillStyle='#0a0a0b';x.fillRect(0,20,128,3);x.fillRect(0,41,128,3);}
 else if(k==='mid'){x.fillStyle='#3a3a3e';for(let i=0;i<16;i++){x.fillRect(i*8+1,2,5,18);x.fillRect(i*8+4,24,5,16);x.fillRect(i*8+1,44,5,18);}}
 else{x.fillStyle='#4a4a4f';x.fillRect(0,28,128,4);x.fillStyle='#d8d8d0';for(let i=0;i<4;i++) x.fillRect(i*32+10,30,6,3);}
 const tx=new T.CanvasTexture(cv);tx.wrapS=T.RepeatWrapping;tx.wrapT=T.RepeatWrapping;tx.repeat.set(10,1);
 return TREADS[k]=new T.MeshLambertMaterial({map:tx});}
const wearK=u=>u>=70?'worn':u>=40?'mid':'new';
function needWheel(R,S){
 const c=R.c,ax=S[0]==='F'?'av':'ar',ids=['plaq_'+ax,'disq_'+ax,'pneus'];if(ax==='av') ids.push('amort','rotule','roulement','cardan');
 return wantedAny(c,ids);}
function wheelsLogic(R,ax){
 const c=R.c,a=ax==='av'?['FL','FR']:['RL','RR'],offs=a.every(S=>wst(c,S).o),ons=a.every(S=>!wst(c,S).o);
 if(offs&&!c.st[ax]) L().togRoues(c,ax);
 else if(ons&&c.st[ax]) L().togRoues(c,ax);}
function tiresCheck(R){const c=R.c;if(CORN.every(S=>wst(c,S).t)&&!c.done.pneus){if(doDepL(R,'pneus')) doPoseL(R,'pneus');}}
function inspMsg(R,id){const c=R.c,p=PARTS[id],u=c.parts[id].u;
 MW.toast(`${pname(c,id)} : `+MWJ.inspLine(c,id),u>=75&&!p.hid?'warn':'info');} /* texte propre au symptôme (js/41 : inspLine) */
const SIDE_NOM={FL:'avant gauche',FR:'avant droite',RL:'arrière gauche',RR:'arrière droite'};
function buildWheels(R){
 const {c,g,u}=R,F=R.F,N=NUTS(c);R.wh={};
 for(const S of CORN){
  const wh=g.getObjectByName('w'+S);if(!wh) continue;
  const s=sgn(S),hub=R.A('hub'+S),w=wst(c,S),rt=S[0]==='F'?u.wheelR:u.wheelRR;
  const rim=wh.children[1],tire=wh.children[0];if(wh.userData.geo&&wh.userData.geo.rimBare) rim.geometry=wh.userData.geo.rimBare;   /* sans écrous : ceux du geste les remplacent */
  rim.geometry.computeBoundingBox();tire.geometry.computeBoundingBox();
  const fx=s*(rim.geometry.boundingBox.max.x+.01),tw_=tire.geometry.boundingBox.max.x-tire.geometry.boundingBox.min.x;
  const o={S,wh,s,rt,hub,N,fx,nuts:[],home:{p:wh.position.clone(),r:[wh.rotation.x,wh.rotation.y,wh.rotation.z]},band:null};
  const ng=new T.Group();wh.add(ng);o.ng=ng;
  for(let i=0;i<N;i++){const a=i/N*TAU+.31,m=hex(.0145,.026,0xcfd4d9,fx,Math.cos(a)*.056,Math.sin(a)*.056,'x');ng.add(m);o.nuts.push(m);}
  const uw=(c.parts.pneus&&c.parts.pneus.u0!=null?c.parts.pneus.u0:0);
  o.setTire=nw=>{if(o.band){wh.remove(o.band);o.band.geometry.dispose();}const b=new T.Mesh(new T.CylinderGeometry(rt+.0015,rt+.0015,tw_*.62,36,1,true),treadTex(nw?'new':wearK(uw)));b.rotation.z=PI/2;wh.add(b);o.band=b;};
  o.setTire(w.t||c.done.pneus);
  const hg=grp(hub.x,hub.y,hub.z);hg.add(cy(.078,.02,C.dsteel,-s*.012,0,0,'x',null,24));hg.add(cy(.03,.03,C.alu,s*.012,0,0,'x'));
  for(let i=0;i<N;i++){const a=i/N*TAU+.31;hg.add(cy(.0065,.05,C.steel,s*.026,Math.cos(a)*.056,Math.sin(a)*.056,'x',null,8));}
  R.root.add(hg);o.hubG=hg;R.wh[S]=o;
  const order=STAR(N);
  o.nuts.forEach((nm,i)=>{
   R.add({id:'nut:'+S+':'+i,o:nm,r:.032,vis:()=>w.o===0,name:()=>`Écrou de roue ${i+1}/${N} · ${SIDE_NOM[S]}`,
    acts:()=>{
     const st=w.n[i],lifted=liftedNow(c),sk=sockOf(c,'nut'),a=[],T2={tool:'boulonneuse',tool2:'cliquet',sock:sk};
     if(st===3&&!lifted) a.push(Object.assign({key:'nl'+S+i,lab:"Desserrer l'écrou au sol",hold:.55,snd:'impact',ord:5,exp:needWheel(R,S),do:()=>{w.n[i]=1;}},T2));
     else if(st===3) a.push(Object.assign({key:'nx'+S+i,lab:"Retirer l'écrou",hold:.5,snd:'impact',ord:20,why:'Desserrez les écrous au sol avant de lever la voiture : la roue tourne dans le vide.',do:()=>{}},T2));
     else if(st===1&&lifted) a.push(Object.assign({key:'nr'+S+i,lab:"Retirer l'écrou",hold:.5,snd:'impact',ord:20,exp:needWheel(R,S),do:()=>{w.n[i]=0;binAdd('ecrou');}},T2));
     else if(st===1){a.push(Object.assign({key:'nr'+S+i,lab:"Retirer l'écrou",hold:.5,snd:'impact',ord:20,exp:needWheel(R,S),why:'Levez le pont.',fix:'lift',do:()=>{}},T2));a.push(Object.assign({key:'nt'+S+i,lab:"Resserrer l'écrou",hold:.5,snd:'impact',ord:200,do:()=>{w.n[i]=3;}},T2));}
     else if(st===0) a.push(Object.assign({key:'nv'+S+i,lab:"Visser l'écrou",hold:.5,snd:'impact',ord:62,exp:1,why:w.o?"Reposez d'abord la roue.":null,do:()=>{w.n[i]=2;binTake('ecrou');}},T2));
     else{const nxt=order.find(k=>w.n[k]===2);
      a.push({key:'nq'+S+i,lab:'Serrer au couple (en étoile)',tool:'cle_dyn',sock:sk,hold:.9,snd:'click',ord:75+order.indexOf(i)*.1,exp:1,sub:`Serrage en étoile : écrou ${order.indexOf(i)+1} sur ${N}`,
       fix:lifted?'lower':null,why:lifted?'Serrez les roues au sol : baissez le pont.':(nxt!==i?"Serrez en étoile (en diagonale) : un autre écrou d'abord.":null),do:()=>{w.n[i]=3;}});}
     return a;}});});
  R.add({id:'wheel:'+S,o:wh,r:.34,vis:()=>true,name:()=>w.o?`Roue ${SIDE_NOM[S]} déposée`:`Roue ${SIDE_NOM[S]}`,
   acts:()=>{
    const a=[],lifted=liftedNow(c);
    if(!w.o){const left=w.n.filter(x=>x>0).length;
     a.push({key:'wo'+S,lab:'Déposer la roue',hold:.8,snd:'clunk',ord:25,exp:needWheel(R,S)&&left===0,why:left?`Il reste ${left} écrou(s) à retirer.`:(!lifted?'Levez le pont.':null),fix:!lifted&&!left?'lift':null,
      do:()=>{w.o=1;wheelsLogic(R,S[0]==='F'?'av':'ar');}});
     if(partOK(c,'pneus')) a.push({key:'wi'+S,lab:'Inspecter le pneu',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,'pneus');inspMsg(R,'pneus');}});}
    else{
     if(partOK(c,'pneus')&&!w.t&&!c.done.pneus) a.push({key:'tc'+S,lab:'Monter un pneu neuf (machine à pneus)',hold:2.2,snd:'screw',ord:40,exp:wanted(c,'pneus'),
      why:levelOK(c,'pneus')||needNew(c,'pneus'),do:()=>{w.t=1;o.setTire(true);F.p.pneus=1;tiresCheck(R);}});
     a.push({key:'wp'+S,lab:'Reposer la roue',hold:.8,snd:'clunk',ord:60,exp:!needWheel(R,S),why:brakeReady(R,S)||(lifted?null:'La voiture doit être sur le pont pour reposer la roue.'),
      do:()=>{w.o=0;wheelsLogic(R,S[0]==='F'?'av':'ar');}});}
    return a;}});
 }
 R.procs.push({id:'wheels',vis:(R2,inst)=>{
  for(const S of CORN){const o=R2.wh[S];if(!o) continue;const w=wst(c,S);
   o.nuts.forEach((m,i)=>{const st=w.n[i];m.visible=st>0;m.position.x=o.fx+o.s*(st===1?.012:0);m.rotation.x=st===1?.5:0;});
   if(w.o){attachTo(o.wh,R2.fl);const p=R2.W(o.hub.x+o.s*.95,o.rt+.01,o.hub.z);tw(o.wh,{p:[p.x,p.y,p.z],r:[0,R2.p.ry,o.s*.07]},inst?0:.9);}
   else{attachTo(o.wh,g);tw(o.wh,{p:[o.home.p.x,o.home.p.y,o.home.p.z],r:o.home.r},inst?0:.9);}}
 },free:R2=>{for(const S of CORN){const o=R2.wh&&R2.wh[S];if(!o) continue;const w=wst(R2.c,S);ANI.length=0;
   if(w.o){/* la roue reste au sol, rattachée à la voiture en coordonnées monde figées */}
   else attachTo(o.wh,R2.g);{const gg=o.wh.userData.geo;if(gg&&o.wh.children[1]) o.wh.children[1].geometry=gg.rim;}if(w.o){o.wh.position.copy(o.home.p);o.wh.rotation.set(o.home.r[0],o.home.r[1],o.home.r[2]);}o.ng.parent&&o.ng.parent.remove(o.ng);if(o.band){o.wh.remove(o.band);}}}});
}
BUILD.push(buildWheels);

/* ═══════════ Freins à disque : étrier, plaquettes, disque (état par roue) ═══════════ */
function brakeReady(R,S){
 const b=bst(R.c,S);
 if(b.tl) return "L'étrier est démonté : remettez-le en place avant de reposer la roue.";
 const dr=drumOf(R,S);
 if(b.pd===1) return dr?'Il manque les mâchoires (garnitures) : posez-les avant de remettre le tambour.':'Il manque les plaquettes.';
 if(b.ds===1) return dr?'Le tambour est démonté : remettez-le en place.':'Il manque le disque.';
 if(b.cb.some(x=>!x)||b.br.some(x=>!x)) return 'Des vis de frein sont encore dans le bac magnétique.';
 return null;}
const pidOf=(S,k)=>k+(S[0]==='F'?'_av':'_ar');
const drumOf=(R,S)=>S[0]==='R'&&!!(R.u.car&&R.u.car.brk&&R.u.car.brk.r==='drum');   /* frein arrière à tambour (js/44 : BR(…,'drum',…)) */
function padMesh(u,old){
 const g=new T.Group(),t=Math.max(.0015,.012*(1-u/100)),lin=old&&u>85?0x6a5a4a:old?0x4a3d33:0x2a2623;
 g.add(bx(.005,.1,.066,C.steel,0,0,0,'p'));g.add(bx(t,.094,.06,lin,.0025+t/2,0,0));
 if(old&&u>70){g.add(bx(.0012,.094,.012,0xb6afa0,.0026+t,0,.0));}
 return g;}
function discMesh(dR,old){
 const g=new T.Group(),col=old?0x8a7a6a:0xcfd4d9;
 g.add(cy(dR,.024,col,0,0,0,'x','p',32));g.add(cy(.06,.04,old?0x6a5a4a:0xaab0b6,.0,0,0,'x',null,20));
 if(old){g.add(tor(dR*.97,.004,0x3a2f28,.013,0,0,'x'));for(const k of [.55,.7,.82]) g.add(tor(dR*k,.0016,0x4a403a,.0125,0,0,'x'));
  g.add(cy(dR+.0005,.009,0x5a4034,.0105,0,0,'x',null,32));} /* lèvre rouillée au bord */
 else {for(const k of [.55,.75]) g.add(tor(dR*k,.0012,0xe8ecef,.0125,0,0,'x'));}
 return g;}
/* ── frein à tambour : tambour, mâchoires (garniture + voile), cylindre de roue, ressorts, rattrapage, plateau (les mâchoires ne se voient que tambour déposé) ── */
const DSH={};
function arcGeo(rOut,rIn,depth,a0,a1){
 const k=[rOut,rIn,depth,a0,a1].join('|');if(DSH[k]) return DSH[k];
 const sh=new T.Shape();sh.absarc(0,0,rOut,a0,a1,false);sh.absarc(0,0,rIn,a1,a0,true);sh.closePath();
 const g=new T.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:10});g.translate(0,0,-depth/2);g.rotateY(PI/2);   /* axe de la roue = x */
 return (DSH[k]=g);}
function drumMesh(dR,old,s){
 const g=new T.Group(),col=old?0x6e5d4e:0xa3a8ad;
 g.add(cy(dR,.07,col,0,0,0,'x','p',32));g.add(cy(dR*.96,.004,old?0x4e3f33:0x8d9297,s*.036,0,0,'x',null,32));
 g.add(cy(dR*.56,.016,old?0x5c4c3f:0x92979c,s*.04,0,0,'x','p',24));g.add(cy(.05,.022,old?0x4a4038:0x7e8388,s*.046,0,0,'x','p',16));   /* face, cuvette centrale */
 for(let i=0;i<5;i++){const a=i/5*TAU+.31;g.add(cy(.0125,.02,0x222426,s*.044,Math.cos(a)*.056,Math.sin(a)*.056,'x',null,8));}   /* trous des goujons */
 for(const k of [-.9,.9]) g.add(hex(.0085,.012,old?0x7a6a5a:0xcfd4d9,s*.052,Math.cos(k)*dR*.38,Math.sin(k)*dR*.38,'x'));       /* vis de maintien */
 for(const k of [-.032,.028]) g.add(tor(dR*.995,.003,old?0x3d3128:0x6a6f74,k,0,0,'x'));                                              /* nervures de refroidissement */
 if(old){g.add(cy(dR+.001,.01,0x5a3a26,-s*.027,0,0,'x',null,32));}                                                                     /* rouille au bord */
 return g;}
function shoesMesh(dR,u,old,s){
 /* deux mâchoires (avant et arrière) : voile en acier et garniture ; la garniture est épaisse si neuve, quasi à ras si usée */
 const g=new T.Group(),thick=old?Math.max(.0035,.014*(1-u/100)*1.1):.014,rl=dR*.93,lin=old?(u>85?0xa08e78:0x86745f):0x5c4f42,web=old?0x8a9096:0xb4bcc4;
 for(const c of [PI,0]){
  const a0=c-1.02,a1=c+1.02;
  const w=new T.Mesh(arcGeo(rl-thick,rl-thick-.007,.03,a0,a1),dsMat(web));w.position.x=-s*.062;g.add(w);
  const li=new T.Mesh(arcGeo(rl,rl-thick,.034,a0,a1),dsMat(lin));li.position.x=-s*.062;g.add(li);
  const rib=new T.Mesh(arcGeo(rl-thick-.007,rl-thick-.024,.006,a0+.1,a1-.1),dsMat(web));rib.position.x=-s*.062;g.add(rib);}
 /* cylindre de roue en haut, rattrapage en bas, ressorts de rappel, ressort de maintien */
 g.add(cy(.0135,.075,C.alu,-s*.062,dR*.83,0,'z','p',12),cy(.0165,.012,0x222426,-s*.062,dR*.83,.043,'z'),cy(.0165,.012,0x222426,-s*.062,dR*.83,-.043,'z'));
 g.add(cy(.0075,dR*1.18,C.steel,-s*.062,-dR*.8,0,'z','p',8));g.add(cy(.014,.012,C.brass,-s*.062,-dR*.8,.0,'z','p',12));
 for(const k of [.45,.85]) g.add(cy(.0035,dR*1.55,0xb7bcc2,-s*.062+s*(k>.5?.012:-.012),dR*.55,0,'z',null,5));
 g.add(cy(.003,dR*.9,0xb7bcc2,-s*.075,-dR*.55,0,'z',null,5));
 for(const z of [-dR*.55,dR*.55]) g.add(cy(.005,.04,C.steel,-s*.062,dR*.05,z,'x',null,6),cy(.011,.004,C.steel,-s*.05,dR*.05,z,'x',null,10));
 return g;}
const DSM=new Map();
function dsMat(col){let m=DSM.get(col);if(!m){m=new T.MeshLambertMaterial({color:col,side:T.DoubleSide,emissive:0x2a2a2a});DSM.set(col,m);}return m;}
function buildBrakes(R){
 const {c,g,u}=R,F=R.F,car=u.car||{brk:{f:'disc',fd:280,r:'disc',rd:260}};R.bk={};
 for(const S of CORN){
  const o=R.wh&&R.wh[S];if(!o) continue;
  const front=S[0]==='F',dR=(front?car.brk.fd:car.brk.rd)/2000,s=o.s,hub=o.hub,b=bst(c,S),ax=front?'av':'ar';
  const old=g.userData.brakes&&g.userData.brakes[S];if(old) old.visible=false;
  const bg=grp(hub.x,hub.y,hub.z);R.root.add(bg);
  const uPad=c.parts[pidOf(S,'plaq')]?c.parts[pidOf(S,'plaq')].u0:50,uDsk=c.parts[pidOf(S,'disq')]?c.parts[pidOf(S,'disq')].u0:50;
  if(drumOf(R,S)){R.bk[S]=buildDrum(R,S,o,bg,dR,uPad,uDsk,b);continue;}
  const dOld=discMesh(dR,true),dNew=discMesh(dR,false);dOld.position.x=-s*.05;dNew.position.x=-s*.05;bg.add(dOld,dNew);
  const cy0=dR*.78;
  /* support, étrier (pivote vers le haut), vérin */
  const asm=grp(0,0,0);bg.add(asm);
  const brk=grp(-s*.075,cy0-.01,0);brk.add(bx(.05,.15,.2,C.cast,0,0,0));
  for(const z of [-.1,.1]) {brk.add(bx(.08,.04,.03,C.cast,s*.035,-.02,z));}
  asm.add(brk);
  const bbolts=[];for(const z of [-.1,.1]){const m=hex(.013,.016,0xcfd4d9,-s*.075+s*.078,cy0-.03,z,'x');asm.add(m);bbolts.push(m);}
  const cal=grp(-s*.05,cy0+.055,0);asm.add(cal);
  const cc=front?(car.cat==='sport'?0xc02a20:0x3a3f46):0x3a3f46;
  cal.add(bx(.03,.115,.15,cc,s*.036,-.06,0,'p'),bx(.04,.115,.15,cc,-s*.04,-.06,0,'p'),bx(.11,.03,.15,cc,0,-.005,0,'p'));
  const piston=cy(.03,.03,C.alu,-s*.02,-.06,0,'x','p');cal.add(piston);
  const gbolts=[];for(const z of [-.056,.056]){const m=hex(.011,.018,0xcfd4d9,s*.059,-.02,z,'x');cal.add(m);gbolts.push(m);}
  /* plaquettes en place (sandwich autour du disque) */
  const padsIn=grp(0,cy0-.02,0);
  const mkPads=(uu,oldp)=>{const p=grp(0,0,0),a=padMesh(uu,oldp),bb2=padMesh(uu,oldp);a.position.x=-s*.05+s*.024;bb2.position.x=-s*.05-s*.024;bb2.rotation.y=PI;if(s<0){a.rotation.y=PI;bb2.rotation.y=0;}p.add(a,bb2);return p;};
  const pOld=mkPads(uPad,true),pNew=mkPads(0,false);padsIn.add(pOld,pNew);bg.add(padsIn);
  /* pièces usées déposées : sur la servante */
  const slot=(R.spotN++);
  const cartPos=()=>R.cart.localToWorld(new T.Vector3(-.28+.17*(slot%4),.835,.12-.1*Math.floor(slot/4)));
  const dOldOut=null;
  const nm=(t)=>`${t} · ${SIDE_NOM[S]}`;
  const hot=(id,obj,off,r,name,acts,vis)=>R.add({id,o:obj,off,r,name,acts:()=>acts().map(a=>{if(!a.insp&&!wst(c,S).o&&!a.why){a.why='Déposez d\'abord la roue.';}return a;}),vis:vis||(()=>R.wh[S]&&wst(c,S).o===1)});
  const gate=(id)=>levelOK(c,id);
  const wantP=()=>wantedAny(c,[pidOf(S,'plaq')]),wantD=()=>wantedAny(c,[pidOf(S,'disq')]),wantB=()=>wantP()||wantD();
  const skB=sockOf(c,'bolt'),skR=sockOf(c,'brk');
  /* vis de glissière de l'étrier */
  gbolts.forEach((m,i)=>hot('gb:'+S+i,m,null,.026,()=>nm('Vis de l\'étrier'),()=>b.cb[i]?
    [{key:'gb'+S+i,lab:"Dévisser la vis de l'étrier",tool:'cliquet',sock:skB,hold:1.0,snd:'ratchet',ord:31,exp:wantB(),min:.6,ph:[pidOf(S,'plaq'),'dep'],why:b.tl?'Étrier déjà basculé.':gate(wantD()&&!wantP()?pidOf(S,'disq'):pidOf(S,'plaq')),do:()=>{b.cb[i]=0;binAdd('vis_et');F.p[pidOf(S,'plaq')]=F.p[pidOf(S,'plaq')]||wantP()?1:F.p[pidOf(S,'plaq')];}},
     {key:'gi'+S+i,lab:'Inspecter les plaquettes',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,pidOf(S,'plaq'));inspMsg(R,pidOf(S,'plaq'));}}]
   :[{key:'gr'+S+i,lab:"Revisser la vis de l'étrier",tool:'cliquet',sock:skB,hold:1.0,snd:'ratchet',ord:43,exp:1,min:.6,ph:[pidOf(S,'plaq'),'pose'],why:b.tl?"Remettez d'abord l'étrier en place.":null,do:()=>{b.cb[i]=1;binTake('vis_et');}}]));
  /* étrier : basculer / remettre */
  hot('cal:'+S,cal,new T.Vector3(0,-.06,0),.07,()=>nm('Étrier de frein'),()=>b.tl?
   [{key:'cb'+S,lab:"Remettre l'étrier en place",hold:.6,snd:'clunk',ord:42,exp:1,min:.6,ph:[pidOf(S,'plaq'),'pose'],why:b.pd===1?'Il faut remettre des plaquettes avant de refermer.':b.br.some(x=>!x)?"Remontez d'abord les vis du support d'étrier.":(b.ds===1?'Il manque le disque.':null),do:()=>{b.tl=0;}}]
   :[{key:'ct'+S,lab:"Basculer l'étrier",hold:.6,snd:'clunk',ord:32,exp:wantB(),min:.6,ph:[pidOf(S,'plaq'),'dep'],why:b.cb.some(x=>x)?"Retirez d'abord les deux vis de l'étrier.":null,do:()=>{b.tl=1;}},
    {key:'ci'+S,lab:"Inspecter l'étrier",insp:1,tool:'main',ord:300,do:()=>MW.toast("L'étrier coulisse bien ; le soufflet est en bon état.",'info')}]);
  /* plaquettes */
  hot('pad:'+S,padsIn,new T.Vector3(s*.0,0,0),.07,()=>b.pd===0?nm('Plaquettes de frein'):b.pd===2?nm('Plaquettes neuves'):nm('Plaquettes usées'),()=>{
   if(b.pd===0) return [{key:'po'+S,lab:'Sortir les plaquettes',hold:.5,snd:'clunk',ord:33,exp:wantB(),min:.6,ph:[pidOf(S,'plaq'),'dep'],why:!b.tl?"Basculez d'abord l'étrier.":null,
     do:()=>{b.pd=1;b.dd=1;F.p[pidOf(S,'plaq')]=1;if(CORN.filter(q=>q[0]===S[0]).every(q=>bst(c,q).dd)) doDepL(R,pidOf(S,'plaq'));}},
    {key:'pi'+S,lab:'Inspecter les plaquettes',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,pidOf(S,'plaq'));inspMsg(R,pidOf(S,'plaq'));}}];
   if(b.pd===1) return [{key:'pn'+S,lab:wantP()?'Poser les plaquettes neuves':'Remettre les plaquettes',hold:.5,snd:'clunk',ord:41,exp:1,min:.6,ph:[pidOf(S,'plaq'),'pose'],
     why:wantP()?(!b.pi?"Repoussez d'abord le piston (presse) : les plaquettes neuves sont plus épaisses.":needNew(c,pidOf(S,'plaq'))):null,
     do:()=>{if(wantP()||c.rem[pidOf(S,'plaq')]){b.pd=2;if(CORN.filter(q=>q[0]===S[0]).every(q=>bst(c,q).pd===2)) doPoseL(R,pidOf(S,'plaq'));}else{b.pd=0;}}}];
   return [];},()=>R.wh[S]&&wst(c,S).o===1&&b.pd!==1);
  /* piston */
  hot('piston:'+S,piston,null,.04,()=>nm('Piston d\'étrier'),()=>[b.pi?{key:'pir'+S,lab:'Piston repoussé',ord:300,do:()=>{}}:{key:'pr'+S,lab:'Repousser le piston',tool:'presse',hold:1.2,snd:'screw',ord:40,exp:wantP(),min:.6,ph:[pidOf(S,'plaq'),'pose'],
    why:!b.tl?"Basculez d'abord l'étrier.":(b.pd!==1?"Sortez d'abord les plaquettes.":null),do:()=>{b.pi=1;}}],()=>R.wh[S]&&wst(c,S).o===1&&b.tl===1);
  /* support d'étrier et disque */
  bbolts.forEach((m,i)=>hot('bb:'+S+i,m,null,.026,()=>nm('Vis du support d\'étrier'),()=>b.br[i]?
   [{key:'bx'+S+i,lab:"Dévisser la vis du support",tool:'cliquet',sock:skR,hold:1.1,snd:'ratchet',ord:34,exp:wantD(),min:.7,ph:[pidOf(S,'disq'),'dep'],why:!b.tl?"Basculez d'abord l'étrier.":(b.pd!==1?'Sortez les plaquettes avant.':gate(pidOf(S,'disq'))),do:()=>{b.br[i]=0;binAdd('vis_br');}}]
   :[{key:'br'+S+i,lab:'Revisser la vis du support',tool:'cliquet',sock:skR,hold:1.1,snd:'ratchet',ord:39,exp:1,min:.7,ph:[pidOf(S,'disq'),'pose'],why:b.ds===1?'Posez d\'abord le disque.':null,do:()=>{b.br[i]=1;binTake('vis_br');}}]));
  hot('disc:'+S,dOld,new T.Vector3(0,0,0),.12,()=>b.ds===2?nm('Disque neuf'):nm('Disque de frein'),()=>{
   if(b.ds===0) return [{key:'do'+S,lab:'Déposer le disque',hold:.6,snd:'clunk',ord:36,exp:wantD(),min:.6,ph:[pidOf(S,'disq'),'dep'],why:b.br.some(x=>x)?"Retirez d'abord les vis du support d'étrier.":null,
     do:()=>{b.ds=1;b.dsd=1;F.p[pidOf(S,'disq')]=1;if(CORN.filter(q=>q[0]===S[0]).every(q=>bst(c,q).dsd)) doDepL(R,pidOf(S,'disq'));}},
    {key:'di'+S,lab:'Inspecter le disque',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,pidOf(S,'disq'));inspMsg(R,pidOf(S,'disq'));}}];
   if(b.ds===1) return [{key:'dn'+S,lab:'Poser le disque neuf',hold:.6,snd:'clunk',ord:37,exp:1,min:.6,ph:[pidOf(S,'disq'),'pose'],why:needNew(c,pidOf(S,'disq')),
     do:()=>{b.ds=2;if(CORN.filter(q=>q[0]===S[0]).every(q=>bst(c,q).ds===2)) doPoseL(R,pidOf(S,'disq'));}}];
   return [];},()=>R.wh[S]&&wst(c,S).o===1&&b.ds!==1);
  /* vis et pièces rangées : visibilité et poses d'après l'état */
  R.bk[S]={bg,dOld,dNew,asm,cal,brk,piston,gbolts,bbolts,pOld,pNew,padsIn,slot,cartPos,s,cy0,dR};
 }
 const rebuild=(R2,inst)=>{
  for(const S of CORN){const k=R2.bk[S];if(!k) continue;const b=bst(c,S),s=k.s,d=inst?0:.6;
   k.gbolts.forEach((m,i)=>m.visible=!!b.cb[i]);k.bbolts.forEach((m,i)=>m.visible=!!b.br[i]);
   tw(k.cal,{r:[0,0,b.tl?s*.95:0],p:[-s*.05+(b.tl?s*.05:0),k.cy0+.055+(b.tl?.04:0),0]},d);
   tw(k.asm,{p:[b.br.every(x=>!x)?s*.16:0,0,0]},d);
   k.piston.position.x=-s*.02+(b.pi?-s*.012:s*.01);
   k.pOld.visible=b.pd===0||b.pd===1;k.pNew.visible=b.pd===2;
   if(b.pd===1){attachTo(k.pOld,R2.cart);const sl=k.slot;tw(k.pOld,{p:[-.28+.17*(sl%4),.86,.12-.1*Math.floor(sl/4)],r:[0,PI/2,PI/2]},d);}
   else if(k.pOld.parent!==k.padsIn){attachTo(k.pOld,k.padsIn);k.pOld.position.set(0,0,0);k.pOld.rotation.set(0,0,0);}
   if(b.ds===1){attachTo(k.dOld,R2.fl);const w=R2.W(k.bg.position.x+s*1.6,k.dR+.02,k.bg.position.z-.4);tw(k.dOld,{p:[w.x,w.y,w.z],r:[0,R2.p.ry,PI/2*0+0]},d);}
   else if(k.dOld.parent!==k.bg){attachTo(k.dOld,k.bg);k.dOld.position.set(-s*.05,0,0);k.dOld.rotation.set(0,0,0);}
   k.dOld.visible=b.ds!==2;k.dNew.visible=b.ds===2;}};
 R.procs.push({id:'brakes',vis:rebuild,free:R2=>{for(const S of CORN){const k=R2.bk&&R2.bk[S];if(!k) continue;if(k.pOld.parent!==k.padsIn){attachTo(k.pOld,k.padsIn);}if(k.dOld.parent!==k.bg) attachTo(k.dOld,k.bg);const old=R2.g.userData.brakes&&R2.g.userData.brakes[S];if(old) old.visible=true;k.bg.visible=false;}}});
}
function buildDrum(R,S,o,bg,dR,uPad,uDsk,b){
 const {c}=R,F=R.F,s=o.s,ax='ar',nm=t=>`${t} · ${SIDE_NOM[S]}`,pid=k=>pidOf(S,k);
 const all=(key,v)=>CORN.filter(q=>q[0]===S[0]).every(q=>v==null?!!bst(c,q)[key]:bst(c,q)[key]===v);
 const wantP=()=>wantedAny(c,[pid('plaq')]),wantD=()=>wantedAny(c,[pid('disq')]),wantB=()=>wantP()||wantD();
 const gate=id=>levelOK(c,id);
 const hot=(id,obj,off,r,name,acts,vis)=>R.add({id,o:obj,off,r,name,acts:()=>acts().map(a=>{if(!a.insp&&!wst(c,S).o&&!a.why){a.why='Déposez d\'abord la roue.';}return a;}),vis:vis||(()=>R.wh[S]&&wst(c,S).o===1)});
 /* plateau (fixé sur la fusée), moyeu, tambour usé / neuf, mâchoires usées / neuves */
 const plate=cy(dR*.99,.007,0x30333a,-s*.1,0,0,'x','p',28);bg.add(plate);bg.add(cy(.05,.03,C.cast,-s*.085,0,0,'x','p',16));
 const dOld=drumMesh(dR,true,s),dNew=drumMesh(dR,false,s);dOld.position.x=-s*.062;dNew.position.x=-s*.062;bg.add(dOld,dNew);
 const padsIn=grp(0,0,0),pOld=shoesMesh(dR,uPad,true,s),pNew=shoesMesh(dR,0,false,s);padsIn.add(pOld,pNew);bg.add(padsIn);
 const slot=(R.spotN++);
 /* tambour : le déposer (il faut parfois taper dessus ; ici, les deux vis de maintien puis un coup de maillet) */
 hot('disc:'+S,dOld,new T.Vector3(0,0,0),.13,()=>b.ds===2?nm('Tambour neuf'):nm('Tambour de frein'),()=>{
  if(b.ds===0) return [{key:'do'+S,lab:'Déposer le tambour',hold:.7,snd:'clunk',ord:31,exp:wantB(),min:.6,ph:[pid('disq'),'dep'],why:gate(wantD()&&!wantP()?pid('disq'):pid('plaq')),
    do:()=>{b.ds=1;b.dsd=1;if(wantD()){F.p[pid('disq')]=1;if(all('dsd')) doDepL(R,pid('disq'));}}},
   {key:'di'+S,lab:'Inspecter le tambour',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,pid('disq'));inspMsg(R,pid('disq'));}}];
  if(b.ds===1) return [wantD()||c.rem[pid('disq')]
    ?{key:'dn'+S,lab:'Poser le tambour neuf',hold:.6,snd:'clunk',ord:58,exp:1,min:.6,ph:[pid('disq'),'pose'],why:b.pd===1?'Posez d\'abord les mâchoires.':needNew(c,pid('disq')),do:()=>{b.ds=2;if(all('ds',2)) doPoseL(R,pid('disq'));}}
    :{key:'dr'+S,lab:'Remettre le tambour',hold:.6,snd:'clunk',ord:58,exp:1,min:.4,why:b.pd===1?'Posez d\'abord les mâchoires.':null,do:()=>{b.ds=0;b.dsd=0;}}];
  return [];},()=>R.wh[S]&&wst(c,S).o===1&&b.ds!==1);
 /* mâchoires : visibles tambour déposé */
 hot('pad:'+S,padsIn,new T.Vector3(0,0,0),.11,()=>b.pd===0?nm('Mâchoires et garnitures'):b.pd===2?nm('Mâchoires neuves'):nm('Mâchoires usées'),()=>{
  if(b.ds!==1&&b.pd!==2) return [];
  if(b.pd===0) return [{key:'po'+S,lab:'Décrocher les ressorts et sortir les mâchoires',tool:'pinces',hold:1.2,snd:'clunk',ord:33,exp:wantP(),min:.6,ph:[pid('plaq'),'dep'],
    why:gate(pid('plaq')),do:()=>{b.pd=1;b.dd=1;F.p[pid('plaq')]=1;if(all('dd')) doDepL(R,pid('plaq'));}},
   {key:'pi'+S,lab:'Inspecter les garnitures',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,pid('plaq'));inspMsg(R,pid('plaq'));}}];
  if(b.pd===1) return [{key:'pn'+S,lab:wantP()?'Monter les mâchoires neuves et accrocher les ressorts':'Remettre les mâchoires',tool:'pinces',hold:1.2,snd:'clunk',ord:41,exp:1,min:.6,ph:[pid('plaq'),'pose'],
    why:wantP()?needNew(c,pid('plaq')):null,do:()=>{if(wantP()||c.rem[pid('plaq')]){b.pd=2;if(all('pd',2)) doPoseL(R,pid('plaq'));}else b.pd=0;}}];
  return [];},()=>R.wh[S]&&wst(c,S).o===1&&b.ds===1&&b.pd!==1);
 b.pi=1;   /* pas de piston à repousser : le cylindre de roue se rattrape à la molette (non simulé) */
 const none=grp(0,0,0);bg.add(none);
 return {bg,dOld,dNew,asm:none,cal:grp(0,0,0),brk:none,piston:new T.Object3D(),gbolts:[],bbolts:[],pOld,pNew,padsIn,slot,cartPos:()=>new T.Vector3(),s,cy0:0,dR,drum:true};}
function pump(R){const c=R.c;if(['plaq_av','plaq_ar','disq_av','disq_ar'].some(id=>c.done[id]||c.rem[id])) R.F.pump=1;}
BUILD.push(buildBrakes);

/* ═══════════ Vidange : carter, bouchon, bac, filtre (vissé ou cartouche), remplissage, jauge ═══════════ */
const DRAIN_T=9;
const oilCap=c=>{try{return MWCARS.oilL(c.mdl);}catch(e){return 4.5;}};
const isCart=c=>{try{return MWCARS.get(c.mdl).eng.fuel==='diesel';}catch(e){return false;}};
function oilSt(c){const g=GS(c);if(!g.o) g.o={bac:0,plug:2,drain:0,on:0,filt:'on',fg:0,cap:1,fun:0,pour:0,done:0,dip:0,over:0};return g.o;}
function buildVidange(R){
 const {c,g,u}=R,F=R.F,O=oilSt(c);if(!partOK(c,'huile')) return;
 const cart=isCart(c),cap=oilCap(c),pl=R.A('oilPlug'),fa=R.A('oilFilter');
 const uo=c.parts.huile.u0!=null?c.parts.huile.u0:50,uf=c.parts.filtre_huile?c.parts.filtre_huile.u0:50;
 const wantO=()=>wanted(c,'huile'),wantF=()=>partOK(c,'filtre_huile')&&wanted(c,'filtre_huile'),wantAny=()=>wantO()||wantF()||F.p.huile||F.p.filtre_huile;
 const needFill=()=>(!!c.done.huile||!!F.p.huile)&&!O.done;
 /* carter et bouchon */
 const pan=grp(pl.x,pl.y,pl.z);R.root.add(pan);   /* le carter lui-même est dessiné par js/44c */
 const plug=hex(.017,.016,0xb9bec4,-.1,-.0,0);pan.add(plug);const plugAt=new T.Object3D();plugAt.position.set(-.1,-.01,0);pan.add(plugAt);
 const hole=cy(.012,.006,0x050505,-.1,.0,0);hole.visible=false;pan.add(hole);
 /* filtre */
 const filtG=grp(fa.x,fa.y,fa.z);R.root.add(filtG);
 const mkFilt=(uu,nw)=>{const f=new T.Group(),dirty=uu>60;
  if(cart){f.add(cy(.042,.12,dirty?0x3a2f26:0x7a838c,0,-.06,0,null,'p'),hex(.034,.03,dirty?0x2e261f:C.alu,0,-.135,0));}
  else{f.add(cy(.042,.1,nw?C.blue:(dirty?0x2a241e:0x3a5a8a),0,-.05,0),cy(.046,.014,C.dsteel,0,-.003,0));if(!nw&&dirty) f.add(cy(.043,.03,0x14100c,0,-.09,0));}
  return f;};
 const fOld=mkFilt(uf,false),fNew=mkFilt(0,true);filtG.add(fOld,fNew);const fAt=new T.Object3D();fAt.position.set(0,-.06,0);filtG.add(fAt);
 const fgask=cy(.036,.006,0x050505,0,-.003,0);fgask.visible=false;fNew.add(fgask);
 /* bac de vidange (au sol, sous le carter) */
 const bacW=R.W(pl.x,.07,pl.z);
 /* bac ouvert (fond, quatre bords, bec verseur) : on voit l'huile monter dedans */
 const bac=grp(0,0,0);bac.add(bx(.55,.012,.4,C.blue,0,.006,0),bx(.55,.12,.012,C.blue,0,.06,.194),bx(.55,.12,.012,C.blue,0,.06,-.194),bx(.012,.12,.4,C.blue,.269,.06,0),bx(.012,.12,.4,C.blue,-.269,.06,0),bx(.08,.012,.06,C.blue,.3,.118,0),bx(.53,.004,.38,0x10161f,0,.013,0));
 const lvl=cy(.22,.02,oilCol(uo),0,.04,0);lvl.scale.set(1.1,1,.75);bac.add(lvl);bac.visible=false;R.fl.add(bac);{R.g.updateWorldMatrix(true,false);const bp=R.g.localToWorld(pl.clone().add(V3(-.26,0,0)));bac.position.set(bp.x,.22,bp.z);}bac.rotation.y=R.p.ry;
 /* point de visée toujours visible : le bac lui-même est caché tant qu'il n'est pas posé (sinon on ne peut jamais le placer) */
 const bacAt=new T.Object3D();bacAt.position.copy(bac.position);R.fl.add(bacAt);
 /* écoulement : jet en arc (segments), gouttes, ronds à la surface du bac ; tout en coordonnées du monde (R.fl) */
 const oCol=oilCol(uo),mO=new T.MeshPhongMaterial({color:oCol,shininess:90,specular:0x2b2620});lvl.material=new T.MeshLambertMaterial({color:oCol}); /* surface mate : la baladeuse toute proche la ferait virer au blanc */
 const NSEG=12,jet=[];for(let i=0;i<NSEG;i++){const m=mk(gCyl(1,1,1,8),mO,0,0,0);m.visible=false;R.fl.add(m);jet.push(m);}
 const drops=[];for(let i=0;i<22;i++){const m=mk(gSph(1),mO,0,0,0);m.visible=false;R.fl.add(m);drops.push({m,v:new T.Vector3(),on:false,r:.004});}
 const rings=[];for(let i=0;i<5;i++){const mt=new T.MeshBasicMaterial({color:lerpC(oCol,0xd8c9a0,.35),transparent:true,opacity:0,depthWrite:false});const m=new T.Mesh(gTor(1,.07,22,6),mt);m.rotation.x=PI/2;m.visible=false;R.fl.add(m);rings.push({m,t:9});}
 const FX={t:0,dropT:0,ringT:0,sndT:0,fT:0,fSt:O.filt,pA:new T.Vector3(),pB:new T.Vector3(),d:new T.Vector3(),q:new T.Quaternion(),up:new T.Vector3(0,1,0)};
 const surfY=()=>bac.position.y+lvl.position.y+.01*lvl.scale.y;
 const inBac=p=>{const l=bac.worldToLocal(FX.d.copy(p));return Math.abs(l.x)<.26&&Math.abs(l.z)<.17;};
 function ring(p,big){const r=rings.find(x=>x.t>.7)||rings[0];r.t=0;r.big=big?1.6:1;r.m.position.set(p.x,surfY()+.003,p.z);r.m.visible=true;}
 function drop(p,v,r){const d=drops.find(x=>!x.on);if(!d) return;d.on=true;d.r=r||.004;d.m.position.copy(p);d.v.copy(v);d.m.scale.setScalar(d.r);d.m.visible=true;}
 /* place un segment de jet entre deux points */
 function seg(m,a,b,r){const L=FX.d.subVectors(b,a).length();if(L<1e-4){m.visible=false;return;}m.position.addVectors(a,b).multiplyScalar(.5);FX.d.divideScalar(L);m.quaternion.setFromUnitVectors(FX.up,FX.d);m.scale.set(r,L,r);m.visible=true;}
 function fxTick(R2,dt){
  FX.t+=dt;const flow=O.on&&O.bac?Math.pow(1-O.drain,.6):0;
  const p0=R2.g.localToWorld(pl.clone().add(V3(-.1,-.022,0)));
  const out=R2.g.localToWorld(pl.clone().add(V3(-1.1,-.022,0))).sub(p0).setY(0).normalize(); /* le jet part vers l'extérieur du carter */
  const sY=surfY(),h=Math.max(.05,p0.y-sY);
  /* jet continu tant que le débit est fort, de plus en plus court et vertical */
  const cont=flow>.16,v0=.62*flow,Tf=Math.sqrt(h/4.9),len=cont?1:(flow>.05?clamp01((flow-.05)/.11)*.45:0);
  const r0=.005+.011*flow;
  for(let i=0;i<NSEG;i++){const m=jet[i];const a=i/NSEG,b=(i+1)/NSEG;if(!flow||b>len+1e-6&&!cont){m.visible=false;continue;}
   const ta=Tf*a*a,tb=Tf*b*b; /* plus de segments en haut, là où le jet se courbe */
   FX.pA.copy(p0).addScaledVector(out,v0*ta);FX.pA.y-=4.9*ta*ta;FX.pB.copy(p0).addScaledVector(out,v0*tb);FX.pB.y-=4.9*tb*tb;
   const wob=1+.14*Math.sin(FX.t*24+i*1.7)+.06*Math.sin(FX.t*7.3+i);
   seg(m,FX.pA,FX.pB,r0*(1-.45*a)*wob);}
  if(flow){FX.sndT-=dt;if(FX.sndT<=0){FX.sndT=cont?.32:.5;snd(cont?'pour':'drip');}}
  /* point d'impact : ronds et éclaboussures */
  if(cont){const T2=Tf,pI=FX.pB.copy(p0).addScaledVector(out,v0*T2);pI.y=sY;
   FX.ringT-=dt;if(FX.ringT<=0){FX.ringT=.11+rnd()*.06;if(inBac(pI)) ring(pI,flow>.5);}
   if(rnd()<dt*14*flow){const a=rnd()*PI*2,s=.25+rnd()*.35;drop(pI.clone().setY(sY+.005),V3(Math.cos(a)*s*.4,.5+rnd()*.6*flow,Math.sin(a)*s*.4),.0022+rnd()*.0018);}}
  /* fin de vidange : le filet se casse en gouttes ; bouchon retiré : quelques gouttes de temps en temps */
  FX.dropT-=dt;
  const dripI=flow>.05&&!cont?.07+(1-flow)*.25:(O.plug===0&&O.bac&&!flow?1.1+rnd()*.8:0);
  if(dripI&&FX.dropT<=0){FX.dropT=dripI;drop(FX.pA.copy(p0).addScaledVector(out,v0*.02).add(V3(0,-.01,0)),V3(out.x*v0*.5,-.05,out.z*v0*.5),.005+rnd()*.002);}
  /* filtre desserré ou déposé : il goutte quelques secondes */
  if(O.filt!==FX.fSt){FX.fSt=O.filt;FX.fT=0;}FX.fT+=dt;
  if((O.filt==='loose'||O.filt==='off')&&O.bac&&FX.fT<9&&rnd()<dt*(O.filt==='loose'?1.6:2.4)*(1-FX.fT/9)){const fp=R2.g.localToWorld(fa.clone().add(V3((rnd()-.5)*.05,-.13,(rnd()-.5)*.05)));drop(fp,V3(0,-.1,0),.005);}
  /* gouttes : chute libre, rond à la surface du bac */
  for(const d of drops){if(!d.on) continue;d.v.y-=9.81*dt;d.m.position.addScaledVector(d.v,dt);
   if(d.v.y<0&&d.m.position.y<=sY+.002){d.on=false;d.m.visible=false;if(inBac(d.m.position)){ring(d.m.position,d.r>.0045);if(rnd()<.25) snd('drip');}}
   else if(d.m.position.y<.2){d.on=false;d.m.visible=false;}}
  for(const r of rings){if(r.t>.7){if(r.m.visible) r.m.visible=false;continue;}r.t+=dt;const k=r.t/.7;r.m.scale.setScalar((.008+.05*k)*r.big);r.m.material.opacity=.55*(1-k);}}
 /* huile de la voiture : couleur selon l'usure (noire si vieille) */
 /* bouchon de remplissage et jauge (baie) */
 const capO=new T.Object3D();R.root.add(capO);const dipO=new T.Object3D();R.root.add(dipO);
 const fun=grp(0,0,0);fun.add(cone(.05,.012,.1,C.yel,0,.05,0),cy(.012,.08,C.yel,0,-.03,0));fun.visible=false;R.root.add(fun);
 const bay=()=>R.u.bay||g.userData.bay;
 const place=()=>{const b=bay();if(!b) return false;const a=g.userData.anchors;if(a.oilCap){capO.position.copy(a.oilCap.position);capO.position.y+=.02;}if(a.dipstick){dipO.position.copy(a.dipstick.position);dipO.position.y+=.02;}fun.position.copy(capO.position);fun.position.y+=.03;return true;};
 const baySt=()=>{const b=bay();return !!b&&place();};
 const lifted=()=>liftedNow(c);
 const skP=sockOf(c,'plug'),skC=sockOf(c,'cart');
 R.blk.lower.push(()=>O.bac?'Retirez le bac de vidange avant de baisser le pont.':(O.plug!==2&&O.plug!==3&&(wantAny())?"Le bouchon de vidange n'est pas remonté.":(O.filt==='off'?"Le filtre à huile n'est pas remonté.":null)));
 R.blk.hood.push(()=>O.cap?null:'Refermez le bouchon de remplissage.');
 R.blk.hood.push(()=>O.fun?"Retirez l'entonnoir.":null);
 const lw=()=>lifted()?null:'Levez le pont.',lf=()=>lifted()?null:'lift';
 /* ── bac ── */
 R.add({id:'bac',o:bacAt,off:new T.Vector3(0,.1,0),r:.35,vis:()=>lifted(),name:()=>O.bac?'Bac de vidange':'Sol sous le carter',acts:()=>[O.bac?
  {key:'bacoff',lab:'Retirer le bac de vidange',tool:'main',ord:56,exp:wantAny(),why:O.plug===0||O.plug===1?"Le bouchon est ouvert : l'huile coule.":(O.on?"L'huile coule encore.":(MWJ.inv().length>=MWJ.INV_MAX&&MWJ.toolIdx('bac')<0?'Inventaire plein : libérez une place pour reprendre le bac.':null)),do:()=>{O.bac=0;MWJ.toolTake('bac');}}
  :{key:'bacon',lab:'Placer le bac sous le carter',tool:'bac',ord:29,exp:(wantO()&&O.drain<1)||(wantF()&&(O.filt==='on'||O.filt==='loose')),why:lw(),fix:lf(),do:()=>{O.bac=1;MWJ.toolPut('bac');}}]});
 /* ── bouchon de vidange ── */
 R.add({id:'plug',o:plugAt,r:.05,vis:()=>lifted(),name:()=>'Bouchon de vidange du carter',acts:()=>{
  const bacw=O.bac?null:'Placez d\'abord le bac sous le carter.',a=[];
  if(O.plug===2) a.push({key:'pl1',lab:'Desserrer le bouchon de vidange',tool:'cliquet',sock:skP,hold:1.4,snd:'ratchet',ord:30,exp:wantO()&&O.drain<1,min:3,ph:['huile','dep'],why:lw()||bacw||levelOK(c,'huile')||null,fix:lf(),do:()=>{O.plug=1;F.p.huile=1;}});
  else if(O.plug===1) a.push({key:'pl0',lab:'Retirer le bouchon à la main : l\'huile s\'écoule',tool:'main',hold:.7,snd:'screw',ord:31,exp:wantO()&&O.drain<1,min:3,ph:['huile','dep'],why:bacw,do:()=>{O.plug=0;O.on=1;binAdd('bouchon');}});
  else if(O.plug===0) a.push({key:'pl3',lab:'Reposer le bouchon avec un joint neuf',tool:'main',hold:1.0,snd:'screw',ord:50,exp:1,min:2,ph:['huile','pose'],why:O.on?"Attendez : l'huile s'écoule encore.":needNew(c,'huile'),do:()=>{O.plug=3;binTake('bouchon');}});
  else if(O.plug===3) a.push({key:'pl2',lab:'Serrer le bouchon au couple',tool:'cle_dyn',sock:skP,hold:1.0,snd:'click',ord:51,exp:1,min:2,ph:['huile','pose'],do:()=>{O.plug=2;if(doDepL(R,'huile')) doPoseL(R,'huile');}});
  else a.push({key:'plin',lab:'Inspecter le carter',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,'huile');inspMsg(R,'huile');}});
  if(O.plug===2) a.push({key:'plinsp',lab:"Inspecter l'huile",insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,'huile');inspMsg(R,'huile');}});
  return a;}});
 /* ── filtre ── */
 const fn=()=>cart?'Filtre à huile (cartouche dans son boîtier)':'Filtre à huile';
 R.add({id:'filt',o:fAt,r:.07,vis:()=>lifted(),name:fn,acts:()=>{
  const a=[],bacw=O.bac?null:'Placez d\'abord le bac sous le carter.',sk=cart?skC:0;
  if(O.filt==='on') a.push({key:'f1',lab:cart?'Dévisser le couvercle du boîtier de filtre':'Desserrer le filtre à huile',tool:cart?'cliquet':'cle_filtre',sock:sk||undefined,hold:1.2,snd:'ratchet',ord:35,exp:wantF(),min:2,ph:['filtre_huile','dep'],why:lw()||bacw,fix:lf(),do:()=>{O.filt='loose';F.p.filtre_huile=1;}},
   {key:'fi',lab:'Inspecter le filtre',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,'filtre_huile');inspMsg(R,'filtre_huile');}});
  else if(O.filt==='loose') a.push({key:'f0',lab:cart?'Sortir la cartouche usagée':'Dévisser le filtre à la main et le déposer',tool:'main',hold:.8,snd:'screw',ord:36,exp:wantF(),min:2,ph:['filtre_huile','dep'],do:()=>{O.filt='off';doDepL(R,'filtre_huile');}});
  else if(O.filt==='off'&&!O.fg) a.push({key:'fg',lab:cart?'Huiler les joints de la cartouche neuve':'Huiler le joint du filtre neuf',tool:'bidon',hold:.7,snd:'pour',ord:44,exp:1,min:2,ph:['filtre_huile','pose'],why:needNew(c,'filtre_huile'),do:()=>{O.fg=1;}});
  else if(O.filt==='off') a.push({key:'fs',lab:cart?'Poser la cartouche et visser le couvercle':'Visser le filtre neuf à la main',tool:'main',hold:1.3,snd:'screw',ord:45,exp:1,min:2,ph:['filtre_huile','pose'],do:()=>{O.filt='new';doPoseL(R,'filtre_huile');}});
  else if(O.filt==='new'&&cart) a.push({key:'ft',lab:'Serrer le couvercle au couple',tool:'cle_dyn',sock:skC,hold:1.0,snd:'click',ord:46,exp:0,do:()=>{O.filt='tight';}});
  return a;}});
 /* ── remplissage ── */
 const topWhy=()=>lifted()?'Baissez le pont avant de remplir.':(c.st.capot?null:'Ouvrez le capot.');
 const topFix=()=>lifted()?'lower':(c.st.capot?null:'hood');
 R.add({id:'oilcap',o:capO,r:.07,vis:baySt,name:'Bouchon de remplissage d\'huile',acts:()=>[O.cap?
  {key:'co',lab:'Ouvrir le bouchon de remplissage',tool:'main',hold:.5,snd:'screw',ord:72,exp:needFill()&&O.plug===2,sub:`Moteur ${(c.mdl&&MWCARS.get(c.mdl).eng.visc)||''} · ${nf(cap,2)} l`,why:topWhy()||(O.plug!==2?"Remontez et serrez d'abord le bouchon de vidange.":(O.filt==='off'?"Remontez d'abord le filtre à huile.":null)),fix:topFix(),do:()=>{O.cap=0;}}
  :(O.fun?{key:'cf',lab:"Retirer l'entonnoir",tool:'main',ord:75,exp:!!O.done,do:()=>{O.fun=0;MWJ.toolTake('entonnoir');}}:{key:'cc',lab:'Refermer le bouchon de remplissage',tool:'main',hold:.5,snd:'screw',ord:76,exp:!!O.done,why:null,do:()=>{O.cap=1;}})]
  .concat(!O.cap&&!O.fun?[{key:'fu',lab:"Placer l'entonnoir",tool:'entonnoir',ord:73,exp:needFill(),do:()=>{O.fun=1;MWJ.toolPut('entonnoir');}}]:[]).concat(O.cap&&!O.fun?[]:[])});
 R.add({id:'fun',o:fun,r:.1,vis:()=>baySt()&&!!O.fun,name:'Entonnoir',acts:()=>[{key:'pour',lab:'Verser l\'huile (maintenir E)',tool:'bidon',cont:1,snd:'pour',ord:74,exp:needFill(),sub:()=>`Moteur : ${nf(cap,2)} l · versé : ${nf(O.pour,2)} l`,
  why:!O.fun?"Placez d'abord l'entonnoir dans l'orifice de remplissage.":(O.plug!==2?'Le bouchon de vidange doit être serré avant de remplir.':null),
  start:()=>{},tick:(dt)=>{O.pour+=dt*.55;auxPour(O,cap);},prog:()=>clamp01(O.pour/cap),
  release:()=>{auxSet('');if(O.pour>=cap*.93&&!O.done){O.done=1;if(O.pour>cap*1.12){O.over=1;MW.toast("Trop d'huile : le niveau dépasse le repère maxi.",'warn');}}else if(O.pour<cap*.93) MW.toast(`Il en faut encore : ${nf(cap,2)} l au total.`,'info');
   else if(O.pour>cap*1.12){O.over=1;MW.toast("Trop d'huile : le niveau dépasse le repère maxi.",'warn');}},cancel:()=>{auxSet('');}},
  O.fun&&{key:'fun0',lab:"Retirer l'entonnoir",tool:'main',ord:75,exp:!!O.done,do:()=>{O.fun=0;MWJ.toolTake('entonnoir');}}].filter(Boolean)});
 R.add({id:'dip',o:dipO,r:.06,vis:baySt,name:'Jauge à huile',acts:()=>[{key:'dp',lab:'Retirer et lire la jauge',tool:'main',ord:77,exp:!!O.done&&!O.dip,why:c.st.capot?null:'Ouvrez le capot.',do:()=>{O.dip=1;const lv=O.pour/cap,pos=clamp01((lv-.5)/.6);
  auxSet(`<b>Jauge à huile</b><div class="mg-dip"><i style="bottom:${Math.round(pos*100)}%"></i><span class="mx">MAXI</span><span class="mn">MINI</span></div><small>${lv<.9?'Niveau bas : complétez.':lv>1.1?'Niveau trop haut.':'Niveau correct.'}</small>`);setTimeout(()=>auxSet(''),4500);}}]});
 /* ── visuel et écoulement ── */
 const tick=(R2,dt)=>{
  if(O.on&&O.bac){O.drain=Math.min(1,O.drain+dt/DRAIN_T);if(O.drain>=1){O.on=0;MW.toast(`Huile vidangée : ${nf(cap,1)} l récupérés dans le bac.`,'info');syncAll(false);}}
  if(O.on&&!O.bac) O.on=0;
  lvl.scale.y=.2+O.drain*5;lvl.position.y=.03+O.drain*.04;
  if(dt>0) fxTick(R2,dt);
 };
 R.procs.push({id:'vidange',tick,vis:(R2,inst)=>{
  plug.visible=O.plug!==0;hole.visible=O.plug===0;plug.position.y=O.plug===1?-.012:0;
  bac.visible=!!O.bac;fOld.visible=O.filt==='on'||O.filt==='loose';fNew.visible=O.filt==='new'||O.filt==='tight';
  fOld.position.y=O.filt==='loose'?-.012:0;fgask.visible=!!O.fg;
  if(O.filt==='off'||O.filt==='loose'&&false){}
  if(O.filt==='off'){if(fOld.parent!==R2.cart){attachTo(fOld,R2.cart);}fOld.visible=true;tw(fOld,{p:[.1,.9,.1],r:[0,0,0]},inst?0:.5);}
  else if(fOld.parent!==filtG){attachTo(fOld,filtG);fOld.position.set(0,0,0);}
  const b=bay();if(b){const p=b.parent&&b.userData.parts;const co=g.userData.bay&&g.userData.bay.userData.parts&&g.userData.bay.userData.parts.oilCap;if(co) co.visible=!!O.cap;}
  fun.visible=!!O.fun;
 },free:()=>{const b=g.userData.bay;const co=b&&b.userData.parts&&b.userData.parts.oilCap;if(co) co.visible=true;}});
}
function auxPour(O,cap){const lv=O.pour/cap,pos=clamp01((lv-.0)/1.3);auxSet(`<b>Remplissage</b><div class="mg-dip"><i style="bottom:${Math.round(pos*100)}%"></i><span class="mx" style="bottom:${Math.round(clamp01(1.1/1.3)*100)}%">MAXI</span><span class="mn" style="bottom:${Math.round(clamp01(.9/1.3)*100)}%">MINI</span></div><small>${nf(O.pour,2)} l / ${nf(cap,2)} l</small>`);}
BUILD.push(buildVidange);

/* ═══════════ Autres pièces : modèle générique « fixations → (capot) → pièce → pièce neuve → fixations » ═══════════ */
const bayG=R=>R.g.userData.bay||null;
const bayPart=(R,n)=>{const b=bayG(R);return b&&b.userData.parts&&b.userData.parts[n]||null;};
const engSep=(R,n)=>{const b=bayG(R);return b?b.getObjectByName('sp_'+n):null;};
const dirty=(u,a,b)=>u>60?a:b;
function mkProxy(kind,u){
 const g=new T.Group();const d=u>60;
 if(kind==='plug'){g.add(cy(.009,.07,0xd8dde2,0,0,0),hex(.013,.02,0xb9bec4,0,.04,0),cy(.005,.02,d?0x2a2420:0xc9c9c0,0,-.045,0));}
 else if(kind==='coil'){g.add(cy(.013,.1,0x15171a,0,.05,0),cy(.009,.03,d?0x4a3a2a:0x7a2c22,0,.11,0));}
 else if(kind==='glow'){g.add(cy(.006,.08,d?0x3a3a3a:0xb9bec4,0,0,0),hex(.01,.012,0xb9bec4,0,.045,0));}
 else if(kind==='air'){g.add(bx(.26,.04,.18,d?0x2c2a28:0xe9e5d8,0,0,0));for(let i=-5;i<=5;i++) g.add(bx(.006,.045,.18,d?0x161412:0xc8c4b6,i*.022,0,0));}
 else if(kind==='cab'){g.add(bx(.2,.03,.16,d?0x4a4a46:0xe9e5d8,0,0,0));for(let i=-4;i<=4;i++) g.add(bx(.005,.034,.16,d?0x2e2e2a:0xc8c4b6,i*.02,0,0));}
 else if(kind==='bulb'){g.add(sph(.022,d?0x3a3020:0xfff2b0,0,0,0),cy(.018,.03,C.alu,0,-.03,0,null,'p'));}
 else if(kind==='wiper'){g.add(bx(.5,.012,.02,d?0x3a3a3a:0x0c0c0c,0,0,0),bx(.5,.008,.008,C.steel,0,.012,0));if(d) g.add(bx(.12,.014,.022,0x8a7a6a,.1,0,0));}
 else if(kind==='lambda'){g.add(cy(.008,.09,C.steel,0,0,0),hex(.014,.016,0xb9bec4,0,-.02,0),cy(.004,.1,d?0x2a2a2a:0x1a1a1a,0,.08,0));}
 else if(kind==='clutch'){g.add(cy(.12,.02,d?0x5a4a3a:0x8a6a3a,0,0,0,'z'),cy(.14,.03,C.dsteel,0,.03,0,'z','p'));}
 else if(kind==='belt'){g.add(tor(.09,.008,d?0x4a4642:0x0c0c0c,0,0,0,'x'),tor(.09,.008,d?0x4a4642:0x0c0c0c,0,.0,.0,'z'));g.add(cy(.035,.02,C.steel,0,0,0,'x','p'),cy(.035,.02,C.steel,0,.14,0,'x','p'));}
 else if(kind==='damper'){g.add(cy(.025,.3,d?0x2a2622:0x2a2e33,0,0,0),cy(.012,.2,0xd8dde2,0,.2,0,null,'p'));for(let i=0;i<6;i++) g.add(tor(.05,.005,d?0x6a5a4a:0xc02a20,0,-.12+i*.045,0,'y'));}
 else if(kind==='rail'){g.add(cy(.012,.3,C.steel,0,0,0,'x','p'));for(let i=-1;i<=1;i+=2) g.add(cy(.009,.07,d?0x3a3028:C.alu,i*.1,-.045,0));}
 else if(kind==='egr') g.add(cy(.03,.07,d?0x2a2420:C.alu,0,0,0,'x'),cy(.012,.1,C.steel,0,.05,0));
 else if(kind==='fap'||kind==='cata') g.add(cy(.07,.4,d?0x4a4038:C.steel,0,0,0,'z','p'),tor(.07,.006,C.dsteel,0,0,.2,'x'));
 else if(kind==='turbo') g.add(cy(.06,.1,d?0x4a3a2a:C.dsteel,0,0,0,'x','p'),cy(.05,.06,C.alu,.07,0,0,'x'));
 else if(kind==='sensor') g.add(cy(.008,.07,0x222222,0,0,0),hex(.012,.015,0xb9bec4,0,-.03,0));
 else if(kind==='fan') g.add(cy(.17,.03,d?0x2a2a2a:0x1c1c1c,0,0,0,'z','p'),bx(.3,.012,.02,C.steel,0,0,.02),bx(.012,.3,.02,C.steel,0,0,.02));
 else if(kind==='pump') g.add(cy(.045,.1,d?0x3a3a3a:C.dsteel,0,0,0,'x','p'),cy(.03,.05,C.alu,.07,0,0,'x'));
 else if(kind==='thermo') g.add(cy(.04,.03,C.alu,0,0,0),cy(.012,.05,d?0x6a5a4a:C.steel,0,.03,0));
 else if(kind==='fuelf') g.add(cy(.04,.12,d?0x3a2f26:0x7a838c,0,0,0,null,'p'));
 else if(kind==='gasket') g.add(bx(.3,.01,.12,d?0x3a3028:0x1c1c1c,0,0,0));
 else g.add(bx(.1,.06,.1,C.steel,0,0,0));
 return g;}
function buildGeneric(R,sp){
 const {c,g}=R,F=R.F,id=sp.id;if(!partOK(c,id)) return;
 const units=sp.units||1;if(!F.s) F.s={};(R.gen||(R.gen={}))[id]=1;
 const S=F.s[id]||(F.s[id]={f:new Array(sp.nfix||0).fill(1),cv:1,x:new Array(units).fill(0)});
 const u0=c.parts[id].u0!=null?c.parts[id].u0:50,P=PARTS[id];
 const w=()=>wanted(c,id)||(sp.also&&sp.also.some(k=>wanted(c,k)));
 const sk=sp.sock?sockOf(c,sp.sock):undefined;
 const home=sp.at(R);const grpAt=(p,r)=>{const o=grp(p.x,p.y,p.z);R.root.add(o);return o;};
 const objs=[];
 /* maillages de pièce : usée / neuve par unité */
 const unit=[];
 for(let i=0;i<units;i++){
  const p=sp.unitAt?sp.unitAt(R,i):home;const base=grpAt(p);if(sp.rot){const q=sp.rot(R);base.rotation.set(q[0],q[1],q[2]);}
  const old=sp.host?null:sp.mk?sp.mk(R,u0>60,false,i):mkProxy(sp.kind,u0),nw=sp.host?null:sp.mk?sp.mk(R,false,true,i):mkProxy(sp.kind,0);
  if(old){base.add(old);base.add(nw);}
  unit.push({base,old,nw,i});}
 const hostOf=()=>sp.host?sp.host(R):null;
 const cover=sp.cover?{o:grpAt(sp.cover.at?sp.cover.at(R):home)}:null;
 if(cover&&sp.cover.mk&&!sp.cover.real) cover.o.add(sp.cover.mk());
 const fixObjs=[];
 const DD=sp.dirK?DIR(R,sp.dirK):null,fixA=typeof sp.fixAt==='function'?sp.fixAt(R):(sp.fixAt||[]); /* moteurs : orientation ; carrosserie : positions calculées */
 for(let i=0;i<(sp.nfix||0);i++){const o=fixA[i]||[0,.1,0];const q=DD?offTan(DD,[o[0]*.5,o[1],o[2]*.5]):V3(o[0],o[1],o[2]);const m=hex(.012,.016,0xcfd4d9,home.x+q.x,home.y+q.y,home.z+q.z);if(DD){m.quaternion.setFromUnitVectors(V3(0,1,0),DD);const hp=snapBay(R,home.clone().add(q),DD);m.position.copy(hp||home.clone().addScaledVector(DD,.006));}R.root.add(m);fixObjs.push(m);}
 const need=()=>{const a=L().acces(c,P);return a.ok?null:a.why;};
 const fixFix=()=>{const w2=need();return w2?(/capot/.test(w2)?'hood':/pont/.test(w2)?'lift':null):null;};
 const visOK=()=>sp.vis?sp.vis(R):true;
 const ph0=(ph)=>[id,ph];
 const reqFix=(sp.nfix||0)-(sp.optFix||0);
 const done=()=>!!c.done[id];
 /* fixations */
 fixObjs.forEach((m,i)=>R.add({id:'fx:'+id+':'+i,o:m,r:.028,vis:visOK,name:()=>`${sp.fixName||'Vis'} · ${pname(c,id).replace(/ \(.*/,'')}`,acts:()=>{
  const a=[];
  if(S.f[i]) a.push({key:'fo'+id+i,lab:sp.fixLab||'Dévisser',tool:sp.fixTool||'cliquet',sock:sp.fixTool==='cliquet'||!sp.fixTool?sk:undefined,hold:sp.fixHold||.9,snd:sp.fixTool==='main'?'screw':'ratchet',ord:30+i*.1+(sp.ord||0),exp:w(),min:1,ph:ph0('dep'),
   why:need()||levelOK(c,id)||toolGate(c,id)||(sp.cover&&!S.cv?null:null),fix:fixFix(),do:()=>{S.f[i]=0;F.p[id]=1;binAdd(sp.bin||'vis');}});
  else a.push({key:'fr'+id+i,lab:sp.fixRe||'Revisser',tool:sp.fixTool||'cliquet',sock:sp.fixTool==='cliquet'||!sp.fixTool?sk:undefined,hold:sp.fixHold||.9,snd:sp.fixTool==='main'?'screw':'ratchet',ord:58+i*.1+(sp.ord||0),exp:i<reqFix||true,min:1,ph:ph0('pose'),
   why:(sp.cover?(S.cv?null:'Remettez d\'abord le couvercle.'):(S.x[0]!==2&&!sp.units&&S.x[0]===1?'Posez d\'abord la pièce neuve.':null)),do:()=>{S.f[i]=1;binTake(sp.bin||'vis');}});
  if(S.f[i]) a.push({key:'fi'+id+i,lab:'Inspecter',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,id);inspMsg(R,id);}});
  return a;}}));
 /* couvercle (boîte à air, carter, boîte de vitesses…) */
 if(cover) R.add({id:'cv:'+id,o:cover.o,r:.1,vis:visOK,name:sp.cover.name,acts:()=>[S.cv?{key:'cvo'+id,lab:'Déposer '+sp.cover.name.toLowerCase(),tool:'main',hold:.6,snd:'clunk',ord:33+(sp.ord||0),exp:w(),min:1,ph:ph0('dep'),why:S.f.some(x=>x)?'Retirez d\'abord les fixations.':need(),do:()=>{S.cv=0;}}
  :{key:'cvi'+id,lab:'Reposer '+sp.cover.name.toLowerCase(),tool:'main',hold:.6,snd:'clunk',ord:56+(sp.ord||0),exp:1,min:1,ph:ph0('pose'),why:S.x.some(x=>x===1)?'Posez d\'abord la pièce neuve.':(w()&&S.x.every(x=>x===0)?'Changez d\'abord la pièce avant de remonter.':null),do:()=>{S.cv=1;}}]});
 /* pièce(s) */
 unit.forEach(un=>R.add({id:'pt:'+id+':'+un.i,o:un.base,hl:()=>sp.hl?sp.hl(R):hostOf(),r:sp.r||.1,vis:()=>visOK()&&(!sp.cover||!S.cv||S.x[un.i]),name:()=>{const n=pname(c,id).replace(/ \(.*/,'');return units>1?`${n} ${un.i+1}/${units}`:(S.x[un.i]===2?n+' (neuve)':S.x[un.i]===1?'Emplacement vide':n);},acts:()=>{
  const a=[],x=S.x[un.i],fixOff=S.f.every(v=>!v)&&(!sp.cover||!S.cv);
  const wu=need()||levelOK(c,id)||toolGate(c,id);
  if(x===0){
   a.push({key:'po'+id+un.i,lab:units>1?sp.depLab||'Déposer':(sp.depLab||'Déposer la pièce usée'),tool:sp.depTool||'main',sock:sp.depSock?sockOf(c,sp.depSock):undefined,hold:sp.depHold||.7,snd:sp.depTool==='cliquet'?'ratchet':'screw',ord:36+un.i*.1+(sp.ord||0),exp:w(),min:2,ph:ph0('dep'),
    why:wu||((sp.nfix||sp.cover)&&!fixOff?'Retirez d\'abord les fixations.':null),fix:fixFix(),do:()=>{S.x[un.i]=1;F.p[id]=1;if(S.x.every(v=>v>=1)) doDepL(R,id);}});
   a.push({key:'pi'+id+un.i,lab:'Inspecter',insp:1,tool:'main',ord:300,why:need(),do:()=>{L().doInspect(c,id);inspMsg(R,id);}});}
  else if(x===1) a.push({key:'pn'+id+un.i,lab:units>1?sp.poseLab||'Poser la pièce neuve':(sp.poseLab||'Monter la pièce neuve'),tool:sp.poseTool||'main',sock:sp.poseSock?sockOf(c,sp.poseSock):undefined,hold:sp.poseHold||.8,snd:sp.poseTool==='cliquet'?'ratchet':'screw',ord:44+un.i*.1+(sp.ord||0),exp:1,min:2,ph:ph0('pose'),why:needNew(c,id),
   do:()=>{S.x[un.i]=2;if(S.x.every(v=>v===2)) doPoseL(R,id);}});
  return a;}}));
 R.procs.push({id:'g:'+id,vis:(R2,inst)=>{
  const d=inst?0:.5,h=hostOf();
  fixObjs.forEach((m,i)=>{m.visible=!!S.f[i];});
  if(cover){const ho=sp.cover.host&&sp.cover.host(R2);if(ho) ho.visible=!!S.cv;cover.o.visible=!!S.cv&&!(ho&&sp.cover.real);if(sp.cover.real){const b=bayG(R2),pl=b&&b.userData.coverPlate;if(pl) pl.visible=!!S.cv;}}
  unit.forEach(un=>{const x=S.x[un.i];
   if(un.old){un.old.visible=sp.realIn?x===1:(x===0||x===1)&&!(cover&&S.cv);un.nw.visible=sp.realIn?false:x===2&&!(cover&&S.cv);
    if(x===1){attachTo(un.old,R2.cart);tw(un.old,{p:[-.28+.14*((R2.spotN+un.i)%4),.86+(sp.cartY||0),-.1+.1*(un.i%3)],r:[0,0,0],s:sp.cartS||1},d);}
    else if(un.old.parent!==un.base){attachTo(un.old,un.base);un.old.position.set(0,0,0);un.old.rotation.set(0,0,0);un.old.scale.setScalar(1);}}
   else if(h){h.visible=x!==1;}});},
  free:R2=>{unit.forEach(un=>{if(un.old&&un.old.parent!==un.base) attachTo(un.old,un.base);});const h=hostOf();if(h) h.visible=true;if(cover&&sp.cover.host){const ho=sp.cover.host(R2);if(ho) ho.visible=true;}const b2=bayG(R2),pl=b2&&b2.userData.coverPlate;if(pl) pl.visible=true;}});
}
function fixOff4(n,x,y,z,dx,dz){const a=[];for(let i=0;i<n;i++){const k=n===1?0:(i/(n-1)-.5)*2;a.push([x+k*dx,y,z+(i%2?dz:-dz)]);}return a;}
const LOCAL=(R,n,dx,dy,dz)=>{const a=R.A(n);return V3(a.x+(dx||0),a.y+(dy||0),a.z+(dz||0));};
/* repère d'une pièce du moteur de la baie (posé sur la pièce dessinée, js/44 : partSpots) ; fb = repère de secours ; null si la pièce n'existe pas */
const HAS=(R,k)=>{const b=R.g.userData.bay,v=b&&b.userData.anchors&&b.userData.anchors[k];return v?v.clone():null;};
const SPOT=(R,k,fb,dx,dy,dz)=>{const v=HAS(R,k)||(fb?HAS(R,fb):null)||HAS(R,'intake')||R.A('coils');return V3(v.x+(dx||0),v.y+(dy||0),v.z+(dz||0));};
/* direction d'où la pièce se voit (vers le haut par défaut) ; sert à poser les fixations dans le plan de la face visible */
/* pose un point sur la surface dessinée de la baie : rayon vers l'intérieur le long de -D (repère voiture) ; null si rien à moins de 5 cm */
const RCS=new T.Raycaster();
function snapBay(R,p,D){const b=bayG(R);if(!b) return null;R.g.updateMatrixWorld(true);
 const wd=D.clone().transformDirection(R.g.matrixWorld),wo=R.g.localToWorld(p.clone()).addScaledVector(wd,.03);RCS.set(wo,wd.clone().negate());RCS.far=.08;
 const h=RCS.intersectObject(b,true).find(x=>x.object.isMesh&&x.object.name!=='bay_ao'&&x.object.name!=='cover');if(!h) return null;
 return R.g.worldToLocal(h.point.clone().addScaledVector(wd,.006));}
const DIR=(R,k)=>{const b=R.g.userData.bay,d=b&&b.userData.dirs&&b.userData.dirs[k];return d?d.clone():V3(0,1,0);};
const tanFrame=D=>{const U=Math.abs(D.y)>.9?V3(1,0,0):V3(0,1,0).cross(D).normalize();return {U,V:D.clone().cross(U).normalize()};};
/* décalage [x, y (le long de la normale), z] exprimé dans le plan de la face visible */
const offTan=(D,o)=>{const f=tanFrame(D);return V3(0,0,0).addScaledVector(f.U,o[0]).addScaledVector(D,o[1]).addScaledVector(f.V,o[2]);};
const SPECS=[
 {id:'filtre_air',kind:'air',name:'Boîte à air',hl:R=>bayPart(R,'airbox'),at:R=>LOCAL(R,'airbox',0,.095,0),nfix:4,optFix:2,fixAt:[[-.13,.012,-.09],[.13,.012,-.09],[-.13,.012,.09],[.13,.012,.09]],fixTool:'tournevis',sock:null,fixName:'Clip du couvercle',fixLab:'Déclipser le couvercle',fixRe:'Reclipser le couvercle',bin:'clip',vis:R=>c4(R),depLab:'Sortir le filtre à air',poseLab:'Poser le filtre à air neuf',ord:2},
 {id:'bougies',kind:null,name:'Bougies',units:null,ord:0},
 {id:'batterie',kind:'bat',host:R=>bayPart(R,'battery'),at:R=>LOCAL(R,'battery',0,.1,0),nfix:3,fixAt:[[.08,.02,-.04],[-.08,.02,-.04],[.125,-.0,.0]],sock:'bat',fixName:'Cosse ou bride de batterie',fixLab:'Desserrer la cosse / la bride',fixRe:'Resserrer la cosse / la bride',vis:R=>c4(R),depLab:'Sortir la batterie',poseLab:'Poser la batterie neuve',r:.12},
 {id:'courroie_acc',kind:'belt',host:R=>engSep(R,'belt'),at:R=>LOCAL(R,'alternator',0,.05,0),nfix:1,fixAt:[[0,.12,.0]],sock:'tens',fixName:'Galet tendeur',fixLab:"Relâcher le galet tendeur",fixRe:'Retendre le galet',vis:R=>c4(R),depLab:"Sortir la courroie d'accessoires",poseLab:"Passer la courroie neuve",r:.14,ord:1},
 {id:'alternateur',kind:null,host:R=>engSep(R,'alternator'),spot:'alternator',dirK:'alternator',at:R=>SPOT(R,'alternator'),nfix:3,fixAt:[[.045,.008,0],[-.045,.008,0],[0,.008,.05]],sock:'alt',fixName:"Fixation de l'alternateur",fixLab:'Dévisser',vis:R=>c4(R),depLab:"Déposer l'alternateur",poseLab:"Monter l'alternateur neuf",r:.12,ord:3},
 {id:'demarreur',host:R=>engSep(R,'starter'),spot:'starter',dirK:'starter',at:R=>SPOT(R,'starter'),nfix:3,fixAt:[[.045,.008,0],[-.045,.008,0],[0,.008,.05]],sock:'start',fixName:'Fixation du démarreur',fixLab:'Dévisser',vis:R=>c4(R),depLab:'Déposer le démarreur',poseLab:'Monter le démarreur neuf',r:.12,ord:4},
 {id:'injecteurs',kind:'rail',host:R=>engSep(R,'inj'),spot:'inj',dirK:'inj',at:R=>SPOT(R,'inj'),nfix:2,fixAt:[[.07,.008,0],[-.07,.008,0]],sock:'inj',fixName:"Fixation de la rampe",fixLab:'Dévisser',vis:R=>c4(R),depLab:'Sortir la rampe et les injecteurs',poseLab:'Monter les injecteurs neufs',r:.14,ord:5},
 {id:'courroie_dist',kind:'belt',spot:'timing',dirK:'timing',at:R=>SPOT(R,'timing'),nfix:4,fixAt:[[.05,.008,.04],[-.05,.008,.04],[.05,.008,-.04],[-.05,.008,-.04]],sock:'clip',fixName:'Vis du carter de distribution',fixLab:'Dévisser',vis:R=>c4(R),cover:{name:'Carter de distribution',host:R=>engSep(R,'timingCover'),at:R=>SPOT(R,'timing'),real:1},realIn:1,depLab:'Déposer la courroie, le galet et la pompe',poseLab:'Poser le kit de distribution neuf',poseTool:'cle_dyn',poseSock:'tens',r:.14,ord:6},
 {id:'embrayage',kind:'clutch',at:R=>{const b=bayG(R);const e=b&&b.userData.gear;return e?e.e.clone():LOCAL(R,'bay',0,.2,0);},nfix:4,fixAt:[[.1,.08,.1],[-.1,.08,.1],[.1,-.08,.1],[-.1,-.08,.1]],sock:'gear',fixName:'Vis de la boîte de vitesses',fixLab:'Dévisser',vis:R=>liftedNow(R.c)&&!!bayG(R),cover:{name:'Boîte de vitesses',host:R=>bayPart(R,'gearbox'),at:R=>{const b=bayG(R);const e=b&&b.userData.gear;return e?e.c.clone():LOCAL(R,'bay',0,.2,0);}},depLab:"Déposer l'embrayage",poseLab:"Poser l'embrayage neuf (centrage)",r:.16,ord:7},
 {id:'sonde_lambda',kind:'lambda',mk:(R,w,nw,i)=>chMk('sonde_lambda')(R,w,nw,i),at:R=>chP('sonde_lambda',0)(R),vis:R=>liftedNow(R.c),nfix:1,fixAt:R=>chFixAt(R,'sonde_lambda'),fixTool:'pinces',fixName:'Connecteur de la sonde',fixLab:'Débrancher le connecteur',fixRe:'Rebrancher le connecteur',depTool:'cliquet',depSock:'sonde',depLab:'Dévisser la sonde lambda',poseLab:'Visser la sonde neuve',poseTool:'cliquet',poseSock:'sonde',r:.06,ord:8,cartS:1.4},
 {id:'ampoules',kind:'bulb',at:R=>{const a=R.A('headL');return a.lengthSq()?V3(a.x,a.y,a.z+.03):V3(R.u.W*.3,.68,(R.u.L||4)/2-.12);},nfix:2,fixAt:R=>{const lw=.095*R.u.W+.1;return [[lw*.2+lw/2-.02,.065,-.042],[lw*.2-lw/2+.02,.065,-.042]];},fixTool:'tournevis',fixName:'Clip du cache de phare',fixLab:'Déclipser le cache',fixRe:'Reclipser le cache',bin:'clip',depLab:"Sortir l'ampoule grillée",poseLab:"Monter l'ampoule neuve",r:.1,ord:9},
 {id:'essuie',kind:'wiper',at:R=>{const a=R.A('wiperD');return a.lengthSq()?a:V3(-.1,.98,R.A('cabin').z+.8);},rot:R=>[(R.g.userData.G&&R.g.userData.G.wiperTh)||0,0,0],nfix:1,fixAt:[[.0,.03,.0]],fixTool:'main',fixName:"Bras d'essuie-glace",fixLab:'Relever le bras',fixRe:'Rabaisser le bras',depLab:'Déclipser et sortir le balai',poseLab:'Clipser le balai neuf',r:.2,ord:10},
 {id:'filtre_hab',kind:'cab',at:R=>R.hab?R.hab.filter.clone():(()=>{const a=R.A('cabin');return V3(-(R.u.W||1.8)*.22,.74,a.z+.55);})(),vis:R=>!!R.F.pdoor,nfix:2,fixAt:R=>{const h=R.hab;if(!h) return [[.15,.0,-.09],[-.15,.0,-.09]];return h.stops.map(v=>[v.x-h.filter.x,v.y-h.filter.y,v.z-h.filter.z]);},fixTool:'main',fixName:'Butée de la trappe de la boîte à gants',fixLab:'Libérer la butée : la trappe s\'abaisse',fixRe:'Remettre la butée : la trappe se referme',depLab:"Sortir le filtre d'habitacle",poseLab:"Poser le filtre d'habitacle neuf",r:.12,ord:11}];
const c4=R=>!!R.c.st.capot&&!!bayG(R);
/* pièces utiles sur cette voiture : celles de l'ordre, du symptôme (coupable, suspects, indices, dégâts en chaîne) et celles déjà
   touchées. Construire les 30+ pièces génériques pour chaque voiture coûtait ~150 appels de dessin dans le garage. */
function relevant(c){
 const s=new Set(c.ordre);let y=null;try{y=MWJ.symDef(c);}catch(e){}
 if(c.symp) s.add(c.symp.c);
 if(y){for(const k of ['c']) if(y[k]) s.add(y[k]);for(const k of ['red','ch']) for(const id of (y[k]||[])) s.add(id);for(const id in (y.ins||{})) s.add(id);}
 for(const id in c.done) s.add(id);for(const id in c.rem) s.add(id);const g=c.g;if(g&&g.s) for(const id in g.s) s.add(id);if(g&&g.p) for(const id in g.p) s.add(id);
 return s;}
function buildOthers(R){
 const c=R.c,rel=relevant(c);
 for(const sp of SPECS){
  if(sp.id==='bougies'||sp.id==='courroie_acc') continue; /* gestes détaillés : buildPlugsBelt */
  if(!partOK(c,sp.id)||!rel.has(sp.id)) continue;
  if(sp.id==='batterie'){const s2=Object.assign({},sp,{kind:'bat'});buildGeneric(R,Object.assign(s2,{kind:'bat'}));continue;}
  buildGeneric(R,sp);}
}
BUILD.push(buildOthers);
/* pièces amovibles du châssis sans geste ici (non concernées par le travail en cours) : dessinées à leur place, en passif */
function buildChDecor(R){
 const {c}=R,ch=R.u.G&&R.u.G.ch;if(!ch) return;
 for(const u of ch.units){
  if(u.id==='__filtre'||(R.gen&&R.gen[u.id])) continue;
  const p=c.parts[u.id],m=new T.Mesh(MWCH.unitGeo(u,!!(p&&p.u0>60)),MWCH.mat());m.position.set(u.piv[0],u.piv[1],u.piv[2]);R.root.add(m);}}
BUILD.push(buildChDecor);

/* ═══════════ Bougies (allumage ou préchauffage) et courroie d'accessoires : gestes détaillés ═══════════ */
/* essence : connecteur, vis et bobine crayon, bougie dévissée à la douille à bougie, écartement contrôlé, bougie neuve engagée à la main,
   serrage au couple, bobine, vis, connecteur. Diesel : écrou et cosse d'alimentation, bougie de préchauffage dévissée doucement. */
const PLUG_E=[
 {lab:'Débrancher le connecteur de la bobine',tool:'main',hold:.5,snd:'clunk',ph:'dep'},
 {lab:'Dévisser la vis de la bobine',tool:'cliquet',sock:'clip',hold:.8,snd:'ratchet',ph:'dep',bin:1},
 {lab:'Extraire la bobine crayon',tool:'main',hold:.6,snd:'clunk',ph:'dep'},
 {lab:'Dévisser la bougie usée (douille à bougie et rallonge)',tool:'cliquet',sock:'plugs',hold:1.3,snd:'ratchet',ph:'dep',out:1},
 {lab:'Engager la bougie neuve à la main, sans forcer',tool:'main',hold:.9,snd:'screw',ph:'pose',need:1,gap:1},
 {lab:'Serrer la bougie au couple (25 N·m)',tool:'cle_dyn',sock:'plugs',hold:.9,snd:'click',ph:'pose'},
 {lab:'Remettre la bobine',tool:'main',hold:.5,snd:'clunk',ph:'pose'},
 {lab:'Revisser la vis de la bobine',tool:'cliquet',sock:'clip',hold:.8,snd:'ratchet',ph:'pose',bin:-1},
 {lab:'Rebrancher le connecteur (clic)',tool:'main',hold:.4,snd:'click',ph:'pose'}];
const PLUG_D=[
 {lab:"Dévisser l'écrou de la cosse",tool:'cliquet',sock:'clip',hold:.8,snd:'ratchet',ph:'dep',bin:1,bk:'cosse'},
 {lab:"Retirer la cosse d'alimentation",tool:'main',hold:.5,snd:'clunk',ph:'dep'},
 {lab:'Dévisser la bougie de préchauffage (doucement : elle casse facilement)',tool:'cliquet',sock:'glow',hold:1.7,snd:'ratchet',ph:'dep',out:1},
 {lab:'Visser la bougie de préchauffage neuve à la main',tool:'main',hold:.9,snd:'screw',ph:'pose',need:1},
 {lab:'Serrer au couple (15 N·m)',tool:'cle_dyn',sock:'glow',hold:.9,snd:'click',ph:'pose'},
 {lab:'Remettre la cosse',tool:'main',hold:.5,snd:'clunk',ph:'pose'},
 {lab:"Revisser l'écrou de la cosse",tool:'cliquet',sock:'clip',hold:.8,snd:'ratchet',ph:'pose',bin:-1,bk:'cosse'}];
const plugSteps=c=>{try{return MWCARS.get(c.mdl).eng.fuel==='diesel'?PLUG_D:PLUG_E;}catch(e){return PLUG_E;}};
/* courroie : repérer le passage, détendre et bloquer le tendeur, sortir la courroie, contrôler les galets, passer la neuve,
   libérer le tendeur, vérifier l'alignement dans toutes les gorges */
function buildPlugsBelt(R){
 const {c}=R,F=R.F;
 if(partOK(c,'bougies')){
  const steps=plugSteps(c),diesel=steps===PLUG_D,e=c.mdl&&MWCARS.get(c.mdl)?MWCARS.get(c.mdl).eng:null,n=Math.min(e?e.n:4,8);
  if(!F.bp||F.bp.st.length!==n) F.bp={st:new Array(n).fill(0),gap:0};
  const B=F.bp,OUT=steps.findIndex(x=>x.out)+1,END=steps.length;
  const want=()=>wanted(c,'bougies')||!!F.p.bougies;
  const at=i=>{const b=bayG(R),cs=b&&b.userData.coils;if(cs&&cs[i]) return cs[i].p.clone().add(V3(0,-.03,0));const a=R.A('coils');return V3(a.x+(i-(n-1)/2)*.08,a.y+.05,a.z);};
  const U=[];
  for(let i=0;i<n;i++){
   const p=at(i),base=grp(p.x,p.y,p.z);R.root.add(base);
   const coil=diesel?grp(0,0,0,hex(.009,.012,0xcfd4d9,0,.012,0),cy(.003,.05,C.red,.025,.014,0,'x')):grp(0,0,0,cy(.014,.09,0x1f2226,0,.03,0),bx(.03,.022,.026,0x30343a,0,.085,0),bx(.012,.012,.03,C.org,0,.09,.02));
   const plugOld=grp(0,0,0,cy(.007,.03,0xe9e5d8,0,-.005,0),hex(.011,.012,0x6a5a4a,0,-.025,0));
   const plugNew=grp(0,0,0,cy(.007,.03,C.white,0,-.005,0),hex(.011,.012,C.chrome,0,-.025,0));
   base.add(coil,plugOld,plugNew);U.push({base,coil,plugOld,plugNew});
   R.add({id:'bp:'+i,o:base,r:.045,vis:()=>c4(R),name:()=>`${diesel?'Bougie de préchauffage':'Bougie et bobine'} ${i+1}/${n}`,acts:()=>{
    const k=B.st[i],a=[];
    if(k<END){const S=steps[k],gapNeed=S.gap&&!B.gap;
     if(gapNeed) a.push({key:'bpg'+i,lab:"Contrôler l'écartement des électrodes de la bougie neuve (cale : 0,8 mm)",tool:'main',hold:.6,snd:'click',ord:20+i+.35,exp:want(),min:1,ph:['bougies','pose'],why:needNew(c,'bougies'),do:()=>{B.gap=1;MW.toast("Écartement contrôlé : 0,8 mm, conforme.",'info');}});
     a.push({key:'bp'+i+'_'+k,lab:S.lab,tool:S.tool,sock:S.sock?sockOf(c,S.sock):undefined,hold:S.hold,snd:S.snd,ord:20+i+k*.05,exp:want(),min:.7,ph:['bougies',S.ph],
      why:accOK(c,'bougies')||levelOK(c,'bougies')||(S.need?needNew(c,'bougies'):null)||(gapNeed?"Contrôlez d'abord l'écartement des électrodes de la bougie neuve.":null),fix:fixOf(accOK(c,'bougies')),
      do:()=>{B.st[i]=k+1;F.p.bougies=1;if(S.bin>0) binAdd(S.bk||'vis');else if(S.bin<0) binTake(S.bk||'vis');
       if(k+1===OUT&&B.st.every(x=>x>=OUT)&&!doDepL(R,'bougies')) B.st[i]=k; /* inventaire plein : la bougie reste en place */
       if(k+1===END&&B.st.every(x=>x>=END)) doPoseL(R,'bougies');}});}
    if(k===0) a.push({key:'bpi'+i,lab:'Inspecter',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,'bougies');inspMsg(R,'bougies');}});
    return a;}});}
  R.blk.hood.push(()=>B.st.some(x=>x>0&&x<END)?(diesel?'Remontez toutes les bougies de préchauffage et leurs cosses.':'Remontez toutes les bougies, bobines et connecteurs.'):null);
  R.procs.push({id:'plugs',vis:()=>{U.forEach((u,i)=>{const k=B.st[i],coilOut=diesel?(k>=2&&k<6):(k>=3&&k<7);
   u.coil.position.set(coilOut?.07:0,coilOut?.1:0,0);u.coil.rotation.z=coilOut?.6:0;
   u.plugOld.visible=k<OUT;u.plugOld.position.y=k===OUT-1?.006:0;u.plugNew.visible=k>=OUT+1;});}});}
 if(partOK(c,'courroie_acc')){
  if(!F.cr) F.cr={k:0,sch:0,gal:0};const K=F.cr,id='courroie_acc';
  const want=()=>wanted(c,id)||!!F.p[id];
  const pb=SPOT(R,'belt','alternator'),belt=grp(pb.x,pb.y,pb.z);R.root.add(belt);
  const host=()=>engSep(R,'belt'),oldP=host()?null:mkProxy('belt',c.parts[id].u0!=null?c.parts[id].u0:60),newP=mkProxy('belt',0);if(oldP) belt.add(oldP);belt.add(newP);
  const tp=SPOT(R,'tens','belt'),tens=grp(tp.x,tp.y,tp.z);R.root.add(tens);const td=DIR(R,'tens');const arm=grp(0,0,0,hex(.013,.016,0xcfd4d9,0,0,0,'y'));arm.quaternion.setFromUnitVectors(V3(0,1,0),td);tens.add(arm);
  const pin=cy(.003,.05,C.yel,.0,.0,0,'y');pin.quaternion.setFromUnitVectors(V3(0,1,0),td);pin.position.copy(td).multiplyScalar(.02);tens.add(pin);
  const why0=()=>accOK(c,id)||levelOK(c,id)||toolGate(c,id);
  const act=(key,lab,tool,sock,hold,snd,ord,ph,from,to,extra)=>({key,lab,tool,sock:sock?sockOf(c,sock):undefined,hold,snd,ord,exp:want(),min:3,ph:[id,ph],why:why0()||(extra&&extra()),fix:fixOf(accOK(c,id)),do:()=>{K.k=to;F.p[id]=1;
   if(to===3&&!doDepL(R,id)) K.k=from;if(to===7&&!doPoseL(R,id)) K.k=from;}});
  R.add({id:'cr:belt',o:belt,hl:()=>host(),r:.14,vis:()=>c4(R),name:()=>K.k>=3&&K.k<5?'Poulies (courroie déposée)':"Courroie d'accessoires",acts:()=>{const a=[];
   if(K.k===0&&!K.sch) a.push({key:'crs',lab:'Repérer le passage de la courroie (schéma sous le capot)',tool:'main',hold:.6,snd:'click',ord:20,exp:want(),min:2,ph:[id,'dep'],why:why0(),fix:fixOf(accOK(c,id)),do:()=>{K.sch=1;F.p[id]=1;MW.toast('Passage repéré : vilebrequin, alternateur, pompe à eau, compresseur de climatisation, puis le galet tendeur.','info');}});
   if(K.k===2) a.push(act('cr3','Sortir la courroie usée des poulies','main',null,.9,'clunk',23,'dep',2,3));
   if(K.k===3) a.push(act('cr4','Contrôler les galets et les poulies (rotation, jeu, bruit)','main',null,.8,'screw',24,'pose',3,4));
   if(K.k===4) a.push(act('cr5','Passer la courroie neuve, poulie de vilebrequin en premier','main',null,1.2,'clunk',25,'pose',4,5,()=>needNew(c,id)||(K.sch?null:"Vous n'avez pas repéré le passage de la courroie.")));
   if(K.k===6) a.push(act('cr7','Vérifier que la courroie est bien dans toutes les gorges','main',null,.6,'click',27,'pose',6,7));
   if(K.k===0) a.push({key:'cri',lab:'Inspecter',insp:1,tool:'main',ord:300,do:()=>{L().doInspect(c,id);inspMsg(R,id);}});
   return a;}});
  R.add({id:'cr:tens',o:tens,r:.05,vis:()=>c4(R),name:'Galet tendeur',acts:()=>{const a=[];
   if(K.k===0) a.push(act('cr1','Faire pivoter le tendeur pour détendre la courroie','cliquet','tens',1.2,'ratchet',21,'dep',0,1,()=>K.sch?null:"Repérez d'abord le passage de la courroie : sans schéma, impossible de la remonter."));
   if(K.k===1) a.push(act('cr2','Bloquer le tendeur avec une goupille','pinces',null,.6,'click',22,'dep',1,2));
   if(K.k===5) a.push(act('cr6','Reprendre le tendeur, retirer la goupille et le relâcher','cliquet','tens',1.0,'ratchet',26,'pose',5,6));
   return a;}});
  R.blk.hood.push(()=>K.k>0&&K.k<7?"Remontez et tendez la courroie d'accessoires.":null);
  R.procs.push({id:'belt',vis:()=>{const h=host();if(h) h.visible=K.k<3||K.k>=5;if(oldP) oldP.visible=K.k<3;newP.visible=!h&&K.k>=5;
   arm.rotation.y=K.k>=1&&K.k<6?.5:0;pin.visible=K.k>=2&&K.k<6;},free:()=>{const h=host();if(h) h.visible=true;}});}
}
BUILD.push(buildPlugsBelt);

/* ═══════════ Noms des pièces du moteur : chaque pièce de la baie se vise, son nom s'affiche, E donne sa fonction ═══════════ */
const NOMS_BAIE=[['alternator','alternator'],['starter','starter'],['inj','inj'],['egr','egr'],['turbo','turbo'],['thermo','thermo'],['wpump',null],['maf','maf'],['ckp',null],['cmp',null],['ect','ect'],['valveCover','valveCover'],
 ['intake',null],['throttle',null],['ic',null],['pulley',null],['ac',null],['hp',null],['knock',null],['mapS',null],['breather',null],['tens',null]];
const BAIE_B=[['battery','battery','Batterie',"Stocke l'énergie : elle alimente le démarreur. Borne rouge = plus, noire = moins."],['airbox','airbox','Boîte à air',"Contient le filtre à air : l'air aspiré y est nettoyé avant le moteur."],
 ['coolant','coolant',"Vase d'expansion (liquide de refroidissement)",'Niveau entre MINI et MAXI, moteur froid. Ne jamais ouvrir le bouchon à chaud.'],['washer','washer','Bocal de lave-glace','Eau additionnée de produit lave-glace : à compléter au besoin.'],
 ['brakeFluid','brakeFluid','Bocal de liquide de frein','Le niveau baisse avec l\'usure des plaquettes ; le liquide se change tous les deux ans.']];
function buildBayNames(R){
 const note=(t,d)=>({key:'nm',lab:'Observer',insp:1,tool:'main',ord:400,do:()=>MW.toast(d?`${t} : ${d}`:t,'info')});
 for(const [k,sepK] of NOMS_BAIE){
  const o=new T.Object3D();R.root.add(o);const pos=()=>HAS(R,k);
  R.add({id:'nm:'+k,o,off:null,r:.045,vis:()=>{const p=pos();if(p) o.position.copy(p);return c4(R)&&!!p;},hl:sepK?()=>engSep(R,sepK):undefined,name:()=>{const b=bayG(R),n=b&&b.userData.names&&b.userData.names[k];return n?n[0]:k;},
   acts:()=>{const p=pos();if(!p) return [];o.position.copy(p);const b=bayG(R),n=b&&b.userData.names&&b.userData.names[k];return n?[note(n[0],n[1])]:[];}});}
 for(const [id,k,nom,d] of BAIE_B){
  const o=new T.Object3D();R.root.add(o);
  R.add({id:'nm:'+id,o,r:.07,vis:()=>{const p=HAS(R,k);if(p) o.position.copy(p).add(V3(0,.05,0));return c4(R)&&!!p;},hl:()=>bayPart(R,id),name:nom,acts:()=>{const p=HAS(R,k);if(!p) return [];o.position.copy(p).add(V3(0,.05,0));return [note(nom,d)];}});}
}
BUILD.push(buildBayNames);


SPECS.push({id:'liquide_frein',kind:'fluid',hl:R=>bayPart(R,'brakeFluid'),at:R=>LOCAL(R,'brakeFluid',0,.08,0),nfix:1,fixAt:[[0,.0,0]],fixTool:'main',fixName:'Bouchon du bocal',fixLab:'Dévisser le bouchon du bocal',fixRe:'Revisser le bouchon',vis:R=>c4(R),depTool:'seringue',depLab:"Aspirer l'ancien liquide",poseTool:'bidon',poseLab:'Remplir de liquide neuf et purger',poseHold:1.8,r:.09,ord:12});
/* ═══ [js/44c] pièces du châssis : maillage, pivot et fixations viennent du dessin de js/44c (la pièce est dessinée à sa vraie place) ═══ */
const chU=(R,id,i)=>{const ch=R.u.G&&R.u.G.ch;return ch?ch.units.find(u=>u.id===id&&u.i===(i||0))||null:null;};
const chP=(id,i)=>R=>{const u=chU(R,id,i);return u?V3(u.piv[0],u.piv[1],u.piv[2]):R.A('under');};
const chMk=id=>(R,w,nw,i)=>new T.Mesh((u=>u?MWCH.unitGeo(u,w):new T.BoxGeometry(.04,.04,.04))(chU(R,id,i)),MWCH.mat());
const chFixAt=(R,id)=>{const u=chU(R,id,0),a=R.u.G.ch.anchors;if(id==='sonde_lambda'&&u&&a.lambdaConn) return [[a.lambdaConn[0]-u.piv[0],a.lambdaConn[1]-u.piv[1],a.lambdaConn[2]-u.piv[2]]];return [];};
const flange=(z,r)=>[[0,r,z],[-r*.87,-r*.5,z],[r*.87,-r*.5,z]];
const CHS=(id,o)=>SPECS.push(Object.assign({id,mk:chMk(id),at:chP(id,0),vis:R=>liftedNow(R.c),nfix:0,fixAt:[],r:.08,sock:'bolt',fixName:"Bride d'échappement"},o));
CHS('amort',{units:2,unitAt:(R,i)=>chP('amort',i)(R),vis:R=>R.c.st.av,depTool:'cliquet',depSock:'top',depLab:"Déposer l'amortisseur et son ressort",poseTool:'cliquet',poseSock:'top',poseLab:"Monter l'amortisseur neuf",depHold:1.4,poseHold:1.4,r:.1,cartS:.85,ord:13});

/* ═══ [js/51] pièces des pannes réalistes : mêmes gestes génériques (fixations, dépose, pièce neuve, remontage), points d'ancrage existants ═══ */
const SPF=[[.07,.07,0],[-.07,.07,0],[.07,-.07,0],[-.07,-.07,0],[0,.08,.07],[0,.08,-.07]];
const SP=(id,o)=>SPECS.push(Object.assign({id,vis:R=>c4(R),nfix:2,fixAt:SPF,sock:'clip',fixName:'Fixation',fixLab:'Dévisser',r:.11,ord:14},o));
const fixN=n=>SPF.slice(0,n);
const radAt=R=>{const a=R.A('radiator');return a.lengthSq()>0?a:LOCAL(R,'coolant',-.1,-.15,.2);};
const radTop=R=>{const a=R.A('radiator');return a.lengthSq()>0?V3(a.x,a.y+.17,a.z+.03):LOCAL(R,'coolant',-.1,-.15,.2);};
/* sommet de la bobine (ou de la bougie de préchauffage) du cylindre i, tel que la baie le dessine */
const coilTop=(R,i)=>{const b=bayG(R),cs=b&&b.userData.coils;if(cs&&cs[i]) return cs[i].p.clone().addScaledVector(cs[i].a,cs[i].h*.5+.012);const a=R.A('coils');return V3(a.x,a.y+.05,a.z);};
const exAt=(R,k)=>{const e=R.A('exhaust');return V3(e.x,e.y+.05,R.u.L?R.u.L*k:0);};
const hubAt=(R,i,dy)=>{const a=R.A(i?'hubFR':'hubFL');return V3(a.x,a.y+dy,a.z);};
const gearAt=(R,dz)=>{const b=bayG(R),e=b&&b.userData.gear;return e?e.e.clone().add(V3(0,0,dz||0)):LOCAL(R,'bay',0,.2,dz||0);};
SP('bobines',{kind:'coil',at:R=>coilTop(R,0),nfix:2,fixAt:[[.03,.0,0],[-.03,.0,0]],depLab:'Déposer les bobines usées',poseLab:'Monter les bobines neuves',ord:14});
SP('vanne_egr',{kind:'egr',host:R=>engSep(R,'egr'),spot:'egr',dirK:'egr',at:R=>SPOT(R,'egr','intake'),nfix:2,fixAt:[[.03,.008,0],[-.03,.008,0]],sock:'inj',fixName:'Vis de la vanne EGR',depLab:'Déposer la vanne EGR encrassée',poseLab:'Monter la vanne EGR neuve',ord:15});
CHS('fap',{nfix:3,fixAt:flange(.206,.07),depLab:'Déposer le filtre à particules',poseLab:'Monter le filtre à particules neuf',r:.1,ord:16});
SP('turbo',{kind:'turbo',host:R=>engSep(R,'turbo'),spot:'turbo',dirK:'turbo',at:R=>SPOT(R,'turbo','exman'),nfix:3,fixAt:[[.04,.008,0],[-.04,.008,.03],[-.04,.008,-.03]],sock:'bolt',fixName:'Écrou du turbo',depLab:'Déposer le turbocompresseur',poseLab:'Monter le turbo neuf',poseTool:'cle_dyn',poseSock:'bolt',r:.13,ord:17});
SP('filtre_gazole',{kind:'fuelf',at:R=>LOCAL(R,'airbox',0,-.02,-.18),nfix:0,fixAt:[],depTool:'cle_filtre',depLab:'Dévisser le filtre à gazole usé',poseTool:'main',poseLab:'Visser le filtre à gazole neuf',r:.1,ord:18});
SP('thermostat',{kind:'thermo',host:R=>engSep(R,'thermo'),spot:'thermo',dirK:'thermo',at:R=>SPOT(R,'thermo','coolant'),nfix:3,fixAt:[[.03,.008,0],[-.03,.008,.02],[-.03,.008,-.02]],fixName:'Vis du boîtier de thermostat',depLab:'Déposer le boîtier et le thermostat',poseLab:'Monter le thermostat neuf et son joint',r:.1,ord:19});
SP('pompe_eau',{kind:'pump',host:R=>engSep(R,'wpump'),spot:'wpump',dirK:'wpump',at:R=>SPOT(R,'wpump','timing'),nfix:4,fixAt:[[.04,.008,.03],[-.04,.008,.03],[.04,.008,-.03],[-.04,.008,-.03]],sock:'bolt',fixName:'Vis de la pompe à eau',depLab:'Déposer la pompe à eau',poseLab:'Monter la pompe à eau neuve',r:.12,ord:20});
SP('radiateur',{kind:'thermo',at:R=>radTop(R),nfix:2,fixAt:fixN(2),fixTool:'pinces',fixName:'Collier de durite du radiateur',fixLab:'Desserrer le collier',fixRe:'Resserrer le collier',depLab:'Déposer le radiateur',poseLab:'Monter le radiateur neuf',r:.2,ord:21});
SP('durite',{kind:'thermo',at:R=>SPOT(R,'coolHose','coolant'),nfix:2,fixAt:fixN(2),fixTool:'pinces',fixName:'Collier de durite',fixLab:'Desserrer le collier',fixRe:'Resserrer le collier',depLab:'Retirer la durite fendue',poseLab:'Monter la durite neuve',r:.1,ord:22});
SP('ventilateur',{kind:'fan',at:R=>SPOT(R,'fan','radiator'),nfix:2,fixAt:fixN(2),fixName:'Vis du motoventilateur',depLab:'Déposer le motoventilateur',poseLab:'Monter le motoventilateur neuf',r:.18,ord:23});
SP('joint_culasse',{kind:'gasket',spot:'valveCover',dirK:'valveCover',at:R=>SPOT(R,'valveCover','intake'),nfix:6,fixAt:[[.09,.008,.04],[0,.008,.045],[-.09,.008,.04],[.09,.008,-.04],[0,.008,-.045],[-.09,.008,-.04]],sock:'bolt',fixName:'Vis de culasse',fixLab:'Desserrer la vis de culasse',fixRe:'Resserrer la vis de culasse (au couple)',cover:{name:'Couvre-culasse',host:R=>engSep(R,'valveCover'),at:R=>SPOT(R,'valveCover','intake'),real:1},realIn:1,depLab:'Déposer la culasse et son joint percé',poseLab:'Poser la culasse avec un joint neuf',poseTool:'cle_dyn',poseSock:'bolt',depHold:1.6,poseHold:1.6,r:.15,ord:24});
SP('capteur_pmh',{kind:'sensor',host:R=>engSep(R,'ckp'),spot:'ckp',dirK:'ckp',at:R=>SPOT(R,'ckp','block'),nfix:1,fixAt:[[0,.008,0]],fixTool:'pinces',fixName:'Connecteur du capteur de vilebrequin',fixLab:'Débrancher le connecteur',fixRe:'Rebrancher le connecteur',depTool:'cliquet',depSock:'clip',depLab:'Dévisser le capteur de vilebrequin',poseTool:'cliquet',poseSock:'clip',poseLab:'Visser le capteur neuf',r:.08,ord:25});
SP('capteur_arbre',{kind:'sensor',host:R=>engSep(R,'cmp'),spot:'cmp',dirK:'cmp',at:R=>SPOT(R,'cmp','timing'),nfix:1,fixAt:[[0,.008,0]],fixTool:'pinces',fixName:"Connecteur du capteur d'arbre à cames",fixLab:'Débrancher le connecteur',fixRe:'Rebrancher le connecteur',depTool:'cliquet',depSock:'clip',depLab:"Dévisser le capteur d'arbre à cames",poseTool:'cliquet',poseSock:'clip',poseLab:'Visser le capteur neuf',r:.08,ord:26});
SP('debitmetre',{kind:'sensor',host:R=>engSep(R,'maf')||bayPart(R,'maf'),spot:'maf',dirK:'maf',at:R=>SPOT(R,'maf','airbox'),nfix:2,fixAt:[[.008,.008,0],[-.008,.008,0]],fixTool:'tournevis',fixName:'Vis du débitmètre',fixLab:'Dévisser les vis',fixRe:'Revisser les vis',depLab:"Sortir le débitmètre d'air",poseLab:'Monter le débitmètre neuf',r:.09,ord:27});
SP('sonde_temp',{kind:'sensor',host:R=>engSep(R,'ect'),spot:'ect',dirK:'ect',at:R=>SPOT(R,'ect','thermo'),nfix:1,fixAt:[[0,.008,0]],fixTool:'pinces',fixName:'Connecteur de la sonde de température',fixLab:'Débrancher le connecteur',fixRe:'Rebrancher le connecteur',depTool:'cliquet',depSock:'clip',depLab:'Dévisser la sonde de température',poseTool:'cliquet',poseSock:'clip',poseLab:'Visser la sonde neuve',r:.08,ord:28});
CHS('pompe_carburant',{nfix:4,fixAt:R=>R.u.G.ch.fix.pump,sock:null,fixName:'Vis de la bride de pompe',depLab:'Déposer la pompe à carburant',poseLab:'Monter la pompe neuve',r:.08,ord:29});
CHS('catalyseur',{nfix:3,fixAt:flange(.166,.045),depLab:'Déposer le catalyseur',poseLab:'Monter le catalyseur neuf',r:.09,ord:30});
SP('joint_cc',{kind:'gasket',spot:'valveCover',dirK:'valveCover',at:R=>SPOT(R,'valveCover','intake'),cover:{name:'Couvre-culasse',host:R=>engSep(R,'valveCover'),at:R=>SPOT(R,'valveCover','intake'),real:1},realIn:1,nfix:4,fixAt:[[.09,.008,.03],[-.09,.008,.03],[.09,.008,-.03],[-.09,.008,-.03]],fixName:'Vis du cache-culbuteurs',depLab:'Déposer le cache-culbuteurs et son joint',poseLab:'Poser le joint neuf et refermer',r:.12,ord:31});
SP('joint_spi',{kind:'gasket',spot:'pulley',dirK:'pulley',at:R=>SPOT(R,'pulley','timing'),nfix:3,fixAt:[[.03,.008,0],[-.03,.008,.02],[-.03,.008,-.02]],fixName:'Boulon de poulie',depTool:'pinces',depLab:"Extraire l'ancien joint spi",poseTool:'main',poseLab:'Monter le joint spi neuf',r:.1,ord:32});
CHS('rotule',{units:2,unitAt:(R,i)=>chP('rotule',i)(R),vis:R=>R.c.st.av,depTool:'cliquet',depSock:'arm',depLab:'Déposer la rotule',poseTool:'cliquet',poseSock:'arm',poseLab:'Monter la rotule neuve',depHold:1.2,poseHold:1.2,r:.045,cartS:1.6,ord:33});
CHS('roulement',{units:2,unitAt:(R,i)=>chP('roulement',i)(R),vis:R=>R.c.st.av,depTool:'cliquet',depSock:'bolt',depLab:'Déposer le moyeu et extraire le roulement',poseTool:'cliquet',poseSock:'bolt',poseLab:'Presser le roulement neuf et remonter',depHold:1.4,poseHold:1.4,r:.05,cartS:1.5,ord:34});
CHS('cardan',{units:2,unitAt:(R,i)=>chP('cardan',i)(R),vis:R=>R.c.st.av,depTool:'cliquet',depSock:'nut',depLab:'Déposer le cardan',poseTool:'cliquet',poseSock:'nut',poseLab:'Monter le cardan neuf',depHold:1.3,poseHold:1.3,r:.05,cartS:.5,ord:35});
SP('volant_bimasse',{kind:'clutch',at:R=>gearAt(R,.06),vis:R=>liftedNow(R.c)&&!!bayG(R),nfix:4,fixAt:[[.1,.08,.12],[-.1,.08,.12],[.1,-.08,.12],[-.1,-.08,.12]],sock:'gear',fixName:'Vis du volant moteur',depLab:'Déposer le volant moteur bimasse',poseLab:'Monter le volant neuf',poseTool:'cle_dyn',poseSock:'gear',depHold:1.5,poseHold:1.5,r:.14,ord:36});

/* ═══════════ Blocages, malus ═══════════ */
function blocage(c){
 const l=[],g=c.g;if(!g||!on()) return l;
 let n=0;for(const S in g.w) n+=g.w[S].n.filter(x=>x===2).length;
 if(n) l.push('des écrous de roue ne sont pas serrés au couple');
 const off=Object.keys(g.w).filter(S=>g.w[S].o);if(off.length) l.push('une roue est déposée');
 if(g.pump) l.push("la pédale de frein n'a pas été pompée");
 if(g.pdoor) l.push('la portière passager est ouverte');
 const o=g.o;if(o){if(o.bac) l.push('le bac de vidange est resté sous la voiture');if(!o.cap) l.push("le bouchon de remplissage d'huile est ouvert");if(c.done.huile&&!o.done) l.push("le moteur n'a pas été rempli d'huile");if(o.fun) l.push("l'entonnoir est resté sur le moteur");}
 if(g.bp){const E=plugSteps(c).length;if(g.bp.st.some(x=>x>0&&x<E)) l.push('des bougies ne sont pas remontées');}
 if(g.cr&&g.cr.k>0&&g.cr.k<7) l.push("la courroie d'accessoires n'est pas remontée");
 if(g.s) for(const id in g.s){const sp=SPECS.find(x=>x.id===id);if(!sp) continue;const req=(sp.nfix||0)-(sp.optFix||0);if(g.s[id].f.slice(0,req).some(v=>!v)) l.push('des fixations ne sont pas remontées ('+id.replace('_',' ')+')');if(g.s[id].cv===0) l.push('un couvercle est déposé');}
 return l;}
function malus(c){const g=c.g;if(!g||!on()) return 0;let m=0;const b=g.bin||{};for(const k in b) if(k!=='ecrou'||true) m+=b[k]||0;if(g.o&&g.o.over) m+=1;return Math.min(3,m);}
function malusTxt(c){const g=c.g||{},b=g.bin||{},l=Object.keys(b).filter(k=>b[k]>0).map(k=>b[k]+' '+BIN_NOM[k]);return 'Pièces oubliées dans le bac magnétique'+(l.length?' ('+l.join(', ')+')':'')+(g.o&&g.o.over?' ; trop d\'huile dans le moteur':'')+'.';}

/* ═══════════ Rig : cycle de vie et boucle ═══════════ */
const pontD=c=>{const z=MW.zone(c.zone),p=z&&z.ponts&&z.ponts[c.pont];if(!p) return 1e9;const q=MW.player();return Math.hypot(q.x-p.x,q.z-p.z);};
function buildRig(c){
 const r=newRig(c);if(!r) return null;R=r;
 r.bayAt=!!r.g.userData.bay; /* sans moteur dans la baie, les cibles du capot seraient mal placées : on reconstruit à son arrivée */
 for(const b of BUILD) try{b(r);}catch(e){console.error('rig '+(b.name||''),e);}
 vmEnsure();vmSet();syncAll(true);return r;}
let fr=0,aimI=null;
function tick(dt){
 if(!MW.S||!MW.S.jobs) return;
 animTick(dt);vmTick(dt);
 const act=on();
 if(!act){if(R) freeRig();if(UI){for(const k of ['tb','info','hold','hint','aux','bin']) UI[k].hidden=true;}return;}
 const pl=MW.player(),cars=MWJ.jobs(),essai=MWJ.state().essai;
 if(R&&(!cars.includes(R.c)||!MWJ.mesh(R.c)||pontD(R.c)>8.5||essai)) freeRig();
 if(R&&!R.bayAt&&R.g.userData.bay&&!H){const c=R.c;freeRig();buildRig(c);} /* le capot vient de s'ouvrir : cibles du moteur à leur vraie place */
 if(!R&&!pl.inCar&&!essai){let b=null,bd=5.2;for(const c of cars){const d=pontD(c);if(d<bd&&MWJ.mesh(c)){bd=d;b=c;}}if(b) buildRig(b);}
 ensureUI();if(!UI) return;
 UI.tb.hidden=!R||MW.paused||!(TOOL[tool]&&TOOL[tool].sock);
 if(!R){UI.info.hidden=true;UI.hold.hidden=true;UI.hint.hidden=true;return;}
 /* soulève les processus (écoulement d'huile) */
 for(const pr of R.procs) if(pr.tick) try{pr.tick(R,MW.paused?0:dt);}catch(e){console.error(e);}
 /* collision douce : on ne traverse pas une voiture posée au sol */
 if(!liftedNow(R.c)&&!pl.inCar){const q=pl,dx=q.x-R.p.x,dz=q.z-R.p.z,lx=dx*R.cosr-dz*R.sinr,lz=dx*R.sinr+dz*R.cosr,hw=(R.u.W||1.8)/2+.14,hl=(R.u.L||4)/2+.2;
  if(Math.abs(lx)<hw&&Math.abs(lz)<hl){const kx=hw-Math.abs(lx),kz=hl-Math.abs(lz);let nx=lx,nz=lz;if(kx<kz) nx=Math.sign(lx||1)*hw;else nz=Math.sign(lz||1)*hl;
   MW.teleport(R.p.x+R.cosr*nx+R.sinr*nz,R.p.z-R.sinr*nx+R.cosr*nz);}}
 if(++fr%6===0) hintUpdate();
 aimUpdate();hlUpdate();holdTick(MW.paused?0:dt);infoUI();toolUI();
 if(aimI){const q=MW.player();aimI.x=q.x+Math.sin(q.ry)*.2;aimI.z=q.z+Math.cos(q.ry)*.2;}
 /* anneau d'aide autour de l'élément suivant */
 ringUpdate();
}
let ring=null,ring2=null;
const RINGM=(()=>{const m=new T.MeshBasicMaterial({color:0xffe27a,depthTest:false,depthWrite:false,transparent:true,opacity:.85});m.userData.lin=0;return m;})();
const mkRing=()=>{const r=new T.Mesh(new T.TorusGeometry(.03,.0022,6,28),RINGM);r.renderOrder=998;r.visible=false;MW.scene.add(r);return r;};
function putRing(r,t,k){
 if(!t||!worldOf(t,tmpV)){r.visible=false;return;}
 r.visible=true;r.position.copy(tmpV);r.quaternion.copy(MW.cam.quaternion);
 const s=Math.max(.7,Math.min(4.5,(t.r||.08)/.03*k*(1+.1*Math.sin(performance.now()/200))));r.scale.setScalar(s);}
function ringUpdate(){
 if(!ring) ring=mkRing();if(!ring2) ring2=mkRing();
 /* anneau fin autour de l'élément suivant de l'aide */
 if(!aideOn()||!HINT||!R||MW.paused||!(HINT.t.vis?HINT.t.vis():true)) ring.visible=false;else putRing(ring,HINT.t,.9);
 /* cible visée sans pièce propre (point sur la carrosserie…) : petit anneau, jamais un volume opaque */
 if(AIM&&!hlN&&!MW.paused&&AIM.t!==(HINT&&HINT.t)) putRing(ring2,AIM.t,.55);else ring2.visible=false;}

/* ═══════════ Surbrillance de la pièce visée : léger halo additif pulsant sur ses propres maillages ═══════════ */
const HLM=(()=>{const m=new T.MeshBasicMaterial({color:0xffb02e,transparent:true,opacity:.2,depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});m.color.convertSRGBToLinear();m.userData.lin=1;return m;})();
let hlT=null,hlL=[],hlN=0;
function hlClear(){for(const m of hlL) if(m.parent) m.parent.remove(m);hlL.length=0;hlT=null;hlN=0;}
function hlSet(t){
 if(t===hlT) return;hlClear();hlT=t;if(!t||t.off) return;
 const o=t.hl?t.hl():(typeof t.o==='function'?t.o():t.o);if(!o||!visOf(o)) return;
 const list=[];o.traverse(m=>{if(m.isMesh&&!m.userData.hl&&m.geometry&&m.visible!==false&&!m.userData.skipHl) list.push(m);});
 if(!list.length||list.length>12) return;
 for(const m of list){const h=new T.Mesh(m.geometry,HLM);h.userData.hl=1;h.renderOrder=(m.renderOrder||0)+1;h.raycast=()=>{};m.add(h);hlL.push(h);}
 hlN=list.length;}
function hlUpdate(){
 const t=AIM&&!MW.paused&&on()?AIM.t:null;hlSet(t);
 if(hlN) HLM.opacity=.17+.1*Math.sin(performance.now()/230);}

/* ═══════════ Réglages (touche G) et branchements ═══════════ */
function settings(){
 if(!MW.S) return;const g=gs();
 const b=(a,t,on_)=>`<button type="button" class="btn sm${on_?'':' ghost'}" data-mw="${a}">${t}</button>`;
 MW.panel('Gestes de mécanicien',`<p class="hint">Visez une vis ou une pièce : son nom s'affiche. <b>E</b> fait le geste, <b>maintenir E</b> dévisse ou serre. Outils : touches <b>1 à 0</b> ou molette ; <b>R</b> change la douille.</p>
  <p><b>Aide</b> (surligne l'étape suivante)</p><div class="mw-btns">${b('a:auto','Automatique (premiers travaux)',g.aide==='auto')}${b('a:on','Toujours',g.aide==='on')}${b('a:off','Jamais',g.aide==='off')}</div>
  <p><b>Présentation</b></p><div class="mw-btns">${b('m:real','Gestes réalistes',!g.classic)}${b('m:classic','Menus simples',g.classic)}</div>`,
  {onClick:a=>{const [k,v]=a.split(':');if(k==='a') g.aide=v;else if(k==='m') g.classic=v==='classic';lastTb='';settings();if(g.classic&&R) freeRig();}});}
function init(){
 if(!MW.S) return;gs();ensureUI();
 if(R) freeRig();}
let wired=false;
function wire(){
 if(wired) return;wired=true;
 aimI=MW.addInteract({id:'mg:aim',x:0,z:0,r:1.2,label:()=>{if(!AIM) return '';const a=AIM.a;if(a.why) return a.lab+' (impossible pour l\'instant)';const w=checkAct(a);if(!w||aideOn()) return a.lab;
  const t=a.tool!==tool&&!(a.tool2&&a.tool2===tool)?TOOL[a.tool]:null;return `${a.lab} — prenez d'abord ${t?t.nom.toLowerCase()+(t.key?' ('+t.key+')':''):''}${t&&a.sock?', ':''}${a.sock&&(t||sock!==a.sock)?'douille de '+a.sock+' (R)':''}`;},when:()=>!!AIM&&on()&&!MW.paused,use:()=>{if(!on()) return;eDown=true;startAct();}});
 window.addEventListener('keydown',e=>{if(e.key&&e.key.toLowerCase()==='e'&&!e.repeat) eDown=true;},true);
 window.addEventListener('keyup',e=>{if(e.key&&e.key.toLowerCase()==='e') onRelease();},true);
 window.addEventListener('blur',()=>onRelease());
 const be=document.getElementById('mwBtnE');
 if(be){be.addEventListener('pointerdown',()=>{eDown=true;});for(const t of ['pointerup','pointercancel','pointerleave']) be.addEventListener(t,()=>onRelease());}
 const lk=document.getElementById('mwLook');
 if(lk) lk.addEventListener('wheel',e=>{if(!on()) return;e.preventDefault();MWJ.takeNext(e.deltaY>0?1:-1);},{passive:false}); /* molette : objet suivant de l'inventaire */
 MW.on('key',(k,e)=>{if(!on()) return;if(k==='g') settings();else if(k==='r'){const a=AIM&&AIM.a;if(a&&a.sock&&sock!==a.sock){setSock(a.sock);snd('tool');MW.toast(`Douille de ${a.sock} prise.`,'info');}else cycleSock(1);MWJ.invUI();}});
 /* l'outil en main suit l'objet choisi dans l'inventaire (un seul inventaire pour les pièces et les outils) */
 MW.on('held',it=>{const t=it&&it.k==='outil'&&TOOL[it.id]?it.id:'main';if(t!==tool){tool=t;vmSet();snd('tool');}lastTb='';});
 MW.addButton('gestes','Gestes (G)',()=>{if(MW.S) settings();});}
MW.on('start',()=>{wire();init();});
MW.on('open',()=>{wire();ensureUI();});
MW.on('close',()=>{if(R) freeRig();});
MW.on('tick',tick);

Object.assign(api,{
 on:()=>on(),set:o=>{Object.assign(gs(),o);lastTb='';if(!on()&&R) freeRig();},rig:()=>R,aim:()=>AIM,hint:()=>HINT,tools:TOOLS,tool:id=>setTool(id),curTool:()=>tool,sock:n=>setSock(n),
 ownW:c=>on(),lift:c=>on()&&!(c&&c.noir)?1.45:1,mesh:c=>{if(!on()||!c.g) return;},blocage,malus,malusTxt,rest,fin:false,settings,
 /* le rig suit la voiture la plus proche : pour les tests, on le force */
 ensure:c=>{if(!R||R.c!==c){if(R) freeRig();buildRig(c);}return R;},
 acts:c=>{if(!R||R.c!==c) api.ensure(c);const out=[];for(const t of R.tg){for(const a of actsOf(t)) out.push({id:t.id,key:a.key,lab:a.lab,tool:a.tool,sock:a.sock,hold:a.hold,why:a.why||null,exp:!!a.exp,ord:a.ord});}return out;},
 /* exécute (sans attendre) l'action « key » de la cible « id » ; renvoie le message de refus éventuel */
 aimDbg:()=>{if(!R) return [];const cam=MW.cam,d0=new T.Vector3(),cp=cam.position,v=new T.Vector3(),w=new T.Vector3();cam.getWorldDirection(d0);const out=[];
  for(const t of R.tg){const o=typeof t.o==='function'?t.o():t.o;if(!o) continue;if(!worldOf(t,v)) continue;w.copy(v).sub(cp);const d=w.length();w.divideScalar(d);const ang=Math.acos(clamp01((w.dot(d0)+1)/2)*2-1),thr=Math.atan2(t.r||.08,d)+.045;
   if(ang/thr<3) out.push({id:t.id,sc:+(ang/thr).toFixed(2),d:+d.toFixed(2),vis:t.vis?!!t.vis():true,pvis:visOf(o.parent||o),acts:actsOf(t).map(x=>x.key+(x.why?'!':''))});}return out.sort((a,b)=>a.sc-b.sc).slice(0,6);},
 run:(id,key,o)=>{const t=R&&R.tg.find(q=>q.id===id);if(!t) return 'cible introuvable : '+id;const a=actsOf(t).find(x=>!key||x.key===key);if(!a) return 'aucune action';
  if(!(o&&o.strict)){if(a.tool&&TOOL[a.tool]) tool=a.tool;if(a.sock) sock=a.sock;}
  if(!(o&&o.force)){const w=checkAct(a)||netBusy(t);if(w) return w;}
  if(a.cont){a.start&&a.start();a.tick&&a.tick(.0,{});for(let i=0;i<400&&!(a.auto&&a.auto());i++){a.tick&&a.tick(.05,{});if(a.prog&&a.prog()>=1.0) break;}a.release&&a.release();syncAll(true);return null;}
  finish(t,a);return null;},
 skip:()=>{if(R){const O=oilSt(R.c);if(O.on){O.drain=.999;}}},
 setTool:(t,s)=>{tool=t;if(s) sock=s;vmSet();lastTb='';toolUI();},cur:()=>({tool,sock}),
 nextHint:()=>{hintUpdate();return HINT?{id:HINT.t.id,key:HINT.a.key,lab:HINT.a.lab,tool:HINT.a.tool,sock:HINT.a.sock}:null;},
 release:()=>{if(R) freeRig();},
 /* [réseau] geste maintenu en cours (pour l'indiquer à l'ami) ; remise à jour des visuels après un changement venu de l'ami */
 holding:()=>H&&R&&R.c?{car:R.c.id,target:H.t.id}:null,
 refresh:()=>{if(R) syncAll(true);},
 startHold:(id,key)=>{const t=R&&R.tg.find(q=>q.id===id);if(!t) return false;AIM={t,a:actsOf(t).find(x=>!key||x.key===key)};eDown=true;startAct();return !!H;},
 spendAll:()=>{}});
return api;
})();
