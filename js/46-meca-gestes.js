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
const sockOf=(c,k)=>{const O={plug:[14,17,19,21,22],cart:[27,32],bolt:[10,12,13,14],brk:[17,18,19].map(x=>x===18?19:x),nut:[17,19,19,21],bat:[10,13],alt:[13,15],start:[13,15],plugs:[14,16],clip:[8,10],top:[13,15],inj:[8,10],gear:[13,15,17],arm:[13,15],clutch:[10,13],tens:[13,15,17],sonde:[22]}[k]||[13];return O[hashN((c.mdl||c.modele||'x')+k)%O.length];};

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
 r.A=n=>{const a=MWCARS.anchor(g,n);return a||new T.Vector3();};
 r.gy=()=>g.position.y;   /* hauteur de la voiture (pont) */
 r.F=GS(c);
 return r;}
function freeRig(){
 if(!R) return;
 for(const pr of R.procs) try{pr.free&&pr.free(R);}catch(e){}
 R.root.parent&&R.root.parent.remove(R.root);disposeObj(R.root);
 R.fl.parent&&R.fl.parent.remove(R.fl);disposeObj(R.fl);
 for(const o of R.vis){o.parent&&o.parent.remove(o);}
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
  if(t.vis&&!t.vis()) continue;
  const o=typeof t.o==='function'?t.o():t.o;if(!o||!visOf(o)) continue;
  if(!worldOf(t,tmpV)) continue;
  tmpV3.copy(tmpV).sub(cp);const d=tmpV3.length();if(d>REACH||d<.05) continue;tmpV3.divideScalar(d);
  const ang=Math.acos(clamp01((tmpV3.dot(tmpV2)+1)/2)*2-1),thr=Math.atan2(t.r||.08,d)+.045;
  const sc=ang/thr;if(sc<1&&sc<bs){bs=sc;bt=t;}}
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
 if(a.tool&&a.tool!==tool&&!(a.tool2&&a.tool2===tool)) return `Il faut ${toolName(a.tool,a.sock)} : choisissez-le dans la barre d'outils (touche ${TOOL[a.tool].key||'molette'}).`;
 if(a.sock&&TOOL[tool].sock&&sock!==a.sock) return `Il faut une douille de ${a.sock} (vous avez la ${sock}) : touche R ou le bouton de douille.`;
 return null;}

/* ── exécution ── */
function warn(t){MW.toast(t,'warn');snd('err');}
function startAct(){
 if(!AIM||H) return;const {t,a}=AIM;
 const why=checkAct(a);if(why){warn(why);return;}
 if(a.gate&&!a.gate()) {snd('err');return;}
 if(a.hold>0||a.cont){H={t,a,p:0,sn:0,k:0};if(a.start) a.start();return;}
 finish(t,a);}
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
function holdTick(dt){
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
 let s='';for(const t of TOOLS){s+=`<button type="button" class="mg-t${t.id===tool?' on':''}${h===t.id?' hint':''}" data-t="${t.id}" title="${esc(t.nom)}"><b>${t.key||'·'}</b><span>${esc(t.nom.replace('Cliquet + douille','Cliquet').replace('Clé dynamométrique','Clé dynamo.').replace('Bac de vidange','Bac').replace('Bidon de liquide','Bidon').replace('Repousse-piston / presse','Presse').replace('Seringue d\'aspiration','Seringue'))}</span></button>`;}
 s+=`<button type="button" class="mg-t sock${HINT&&HINT.a.sock&&HINT.a.sock!==sock&&aideOn()?' hint':''}" data-t="sock" title="Taille de douille (touche R)"><b>R</b><span>Douille ${sock}</span></button>`;
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
 let hh='';if(aideOn()&&HINT){const nm=typeof HINT.t.name==='function'?HINT.t.name():HINT.t.name;hh=`<i></i>Étape suivante : <b>${esc(HINT.a.lab)}</b> — ${esc(nm)}${HINT.a.tool?' · '+esc(toolName(HINT.a.tool,HINT.a.sock)):''}`;}
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
const wanted=(c,id)=>partOK(c,id)&&!c.done[id]&&(c.ordre.includes(id)||(c.symp&&c.symp.c===id)||!!(c.g&&c.g.p[id]));
const wantedAny=(c,ids)=>ids.some(id=>wanted(c,id));
const pname=(c,id)=>MWJ.pn(c,id);
const accOK=(c,id)=>{const a=L().acces(c,PARTS[id]);return a.ok?null:a.why;};
const haveNew=(c,id)=>L().invFind('neuve',id)>=0;
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
 /* portière conducteur : habitacle (valise, essai, rendre la voiture) */
 const dn=new T.Object3D();dn.position.set((u.W||1.8)/2+.01,.98,R.A('cabin').z+.18);g.add(dn);R.root.add(dn);R.objs.door=dn;
 R.add({id:'door',o:dn,r:.28,name:'Portière conducteur',acts:()=>[{key:'door',lab:'Habitacle : valise, essai sur route, rendre la voiture',ord:99,exp:jobDone(c)&&!c.st.capot&&!c.st.lifted&&!blocage(c).length,do:()=>{MWJ.openPoint(c.id,'cabine');}}]});
 /* pédale de frein (à pomper après un travail sur les freins) */
 const pd=new T.Object3D();pd.position.set(R.A('cabin').x+.0,.32,R.A('cabin').z+.5);R.root.add(pd);
 R.add({id:'pedal',o:pd,r:.22,name:'Pédale de frein (par la vitre)',vis:()=>true,acts:()=>[F.pump?{key:'pump',lab:'Pomper la pédale de frein',hold:1.6,snd:'pump',ord:80,exp:!liftedNow(c)&&!blocage(c).filter(x=>!/pédale/.test(x)).length,do:()=>{F.pump=0;MW.toast('La pédale est ferme : les plaquettes sont en contact avec les disques.','good');}}:{key:'pump0',lab:'Appuyer sur la pédale : elle est ferme',ord:200,do:()=>{MW.toast('La pédale de frein est ferme.','info');}}]});
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
 const c=R.c,ax=S[0]==='F'?'av':'ar',ids=['plaq_'+ax,'disq_'+ax,'pneus'];if(ax==='av') ids.push('amort');
 return wantedAny(c,ids);}
function wheelsLogic(R,ax){
 const c=R.c,a=ax==='av'?['FL','FR']:['RL','RR'],offs=a.every(S=>wst(c,S).o),ons=a.every(S=>!wst(c,S).o);
 if(offs&&!c.st[ax]) L().togRoues(c,ax);
 else if(ons&&c.st[ax]) L().togRoues(c,ax);}
function tiresCheck(R){const c=R.c;if(CORN.every(S=>wst(c,S).t)&&!c.done.pneus){if(doDepL(R,'pneus')) doPoseL(R,'pneus');}}
function inspMsg(R,id){const c=R.c,p=PARTS[id],u=c.parts[id].u;
 MW.toast(`${pname(c,id)} : `+(p.hid?"rien d'anormal à l'œil nu ; la valise de diagnostic le dira.":`usure ${u} % — ${u<35?'bon état.':u<60?'usure correcte.':u<75?'à surveiller.':(u>=90?"hors d'usage. ":'à remplacer. ')+p.usTxt}`),u>=75&&!p.hid?'warn':'info');}
const SIDE_NOM={FL:'avant gauche',FR:'avant droite',RL:'arrière gauche',RR:'arrière droite'};
function buildWheels(R){
 const {c,g,u}=R,F=R.F,N=NUTS(c);R.wh={};
 for(const S of CORN){
  const wh=g.getObjectByName('w'+S);if(!wh) continue;
  const s=sgn(S),hub=R.A('hub'+S),w=wst(c,S),rt=S[0]==='F'?u.wheelR:u.wheelRR;
  const rim=wh.children[1],tire=wh.children[0];rim.geometry.computeBoundingBox();tire.geometry.computeBoundingBox();
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
   else attachTo(o.wh,R2.g);if(w.o){o.wh.position.copy(o.home.p);o.wh.rotation.set(o.home.r[0],o.home.r[1],o.home.r[2]);}o.ng.parent&&o.ng.parent.remove(o.ng);if(o.band){o.wh.remove(o.band);}}}});
}
BUILD.push(buildWheels);

/* ═══════════ Freins à disque : étrier, plaquettes, disque (état par roue) ═══════════ */
function brakeReady(R,S){
 const b=bst(R.c,S);
 if(b.tl) return "L'étrier est démonté : remettez-le en place avant de reposer la roue.";
 if(b.pd===1) return 'Il manque les plaquettes.';
 if(b.ds===1) return 'Il manque le disque.';
 if(b.cb.some(x=>!x)||b.br.some(x=>!x)) return 'Des vis de frein sont encore dans le bac magnétique.';
 return null;}
const pidOf=(S,k)=>k+(S[0]==='F'?'_av':'_ar');
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
function buildBrakes(R){
 const {c,g,u}=R,F=R.F,car=u.car||{brk:{f:'disc',fd:280,r:'disc',rd:260}};R.bk={};
 for(const S of CORN){
  const o=R.wh&&R.wh[S];if(!o) continue;
  const front=S[0]==='F',dR=(front?car.brk.fd:car.brk.rd)/2000,s=o.s,hub=o.hub,b=bst(c,S),ax=front?'av':'ar';
  const old=g.userData.brakes&&g.userData.brakes[S];if(old) old.visible=false;
  const bg=grp(hub.x,hub.y,hub.z);R.root.add(bg);
  const uPad=c.parts[pidOf(S,'plaq')]?c.parts[pidOf(S,'plaq')].u0:50,uDsk=c.parts[pidOf(S,'disq')]?c.parts[pidOf(S,'disq')].u0:50;
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
 const pan=grp(pl.x,pl.y,pl.z);pan.add(bx(.46,.07,.3,0x2b2e33,0,.05,0,'p'),bx(.5,.012,.34,C.dsteel,0,.09,0));R.root.add(pan);
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
 const bac=grp(0,0,0);bac.add(bx(.55,.12,.4,C.blue,0,.06,0));bac.add(bx(.5,.01,.35,0x0b1020,0,.116,0));
 const lvl=cy(.22,.02,oilCol(uo),0,.04,0);lvl.scale.set(1.1,1,.75);bac.add(lvl);bac.visible=false;R.fl.add(bac);bac.position.copy(R.W(pl.x,.0,pl.z));bac.rotation.y=R.p.ry;
 const stream=cy(.005,1,oilCol(uo),0,0,0);stream.visible=false;R.root.add(stream);
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
 R.add({id:'bac',o:bac,off:new T.Vector3(0,.1,0),r:.3,vis:()=>lifted(),name:()=>O.bac?'Bac de vidange':'Sol sous le carter',acts:()=>[O.bac?
  {key:'bacoff',lab:'Retirer le bac de vidange',tool:'main',ord:56,exp:wantAny(),why:O.plug===0||O.plug===1?"Le bouchon est ouvert : l'huile coule.":(O.on?"L'huile coule encore.":null),do:()=>{O.bac=0;}}
  :{key:'bacon',lab:'Placer le bac sous le carter',tool:'bac',ord:29,exp:(wantO()&&O.drain<1)||(wantF()&&(O.filt==='on'||O.filt==='loose')),why:lw(),fix:lf(),do:()=>{O.bac=1;}}]});
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
  :(O.fun?{key:'cf',lab:"Retirer l'entonnoir",tool:'main',ord:75,exp:!!O.done,do:()=>{O.fun=0;}}:{key:'cc',lab:'Refermer le bouchon de remplissage',tool:'main',hold:.5,snd:'screw',ord:76,exp:!!O.done,why:null,do:()=>{O.cap=1;}})]
  .concat(!O.cap&&!O.fun?[{key:'fu',lab:"Placer l'entonnoir",tool:'entonnoir',ord:73,exp:needFill(),do:()=>{O.fun=1;}}]:[]).concat(O.cap&&!O.fun?[]:[])});
 R.add({id:'fun',o:fun,r:.1,vis:()=>baySt()&&!!O.fun,name:'Entonnoir',acts:()=>[{key:'pour',lab:'Verser l\'huile (maintenir E)',tool:'bidon',cont:1,snd:'pour',ord:74,exp:needFill(),sub:()=>`Moteur : ${nf(cap,2)} l · versé : ${nf(O.pour,2)} l`,
  why:!O.fun?"Placez d'abord l'entonnoir dans l'orifice de remplissage.":(O.plug!==2?'Le bouchon de vidange doit être serré avant de remplir.':null),
  start:()=>{},tick:(dt)=>{O.pour+=dt*.55;auxPour(O,cap);},prog:()=>clamp01(O.pour/cap),
  release:()=>{auxSet('');if(O.pour>=cap*.93&&!O.done){O.done=1;if(O.pour>cap*1.12){O.over=1;MW.toast("Trop d'huile : le niveau dépasse le repère maxi.",'warn');}}else if(O.pour<cap*.93) MW.toast(`Il en faut encore : ${nf(cap,2)} l au total.`,'info');
   else if(O.pour>cap*1.12){O.over=1;MW.toast("Trop d'huile : le niveau dépasse le repère maxi.",'warn');}},cancel:()=>{auxSet('');}},
  O.fun&&{key:'fun0',lab:"Retirer l'entonnoir",tool:'main',ord:75,exp:!!O.done,do:()=>{O.fun=0;}}].filter(Boolean)});
 R.add({id:'dip',o:dipO,r:.06,vis:baySt,name:'Jauge à huile',acts:()=>[{key:'dp',lab:'Retirer et lire la jauge',tool:'main',ord:77,exp:!!O.done&&!O.dip,why:c.st.capot?null:'Ouvrez le capot.',do:()=>{O.dip=1;const lv=O.pour/cap,pos=clamp01((lv-.5)/.6);
  auxSet(`<b>Jauge à huile</b><div class="mg-dip"><i style="bottom:${Math.round(pos*100)}%"></i><span class="mx">MAXI</span><span class="mn">MINI</span></div><small>${lv<.9?'Niveau bas : complétez.':lv>1.1?'Niveau trop haut.':'Niveau correct.'}</small>`);setTimeout(()=>auxSet(''),4500);}}]});
 /* ── visuel et écoulement ── */
 const tick=(R2,dt)=>{
  if(O.on&&O.bac){O.drain=Math.min(1,O.drain+dt/DRAIN_T);if(O.drain>=1){O.on=0;MW.toast(`Huile vidangée : ${nf(cap,1)} l récupérés dans le bac.`,'info');syncAll(false);}}
  if(O.on&&!O.bac) O.on=0;
  const flow=O.on?Math.pow(1-O.drain,.6):0;stream.visible=!!(O.on&&flow>.03);
  if(stream.visible){const top=R2.g.localToWorld(pl.clone().add(V3(-.1,0,0))),h=Math.max(.2,top.y-.36);stream.parent!==R2.fl&&R2.fl.add(stream);stream.position.set(top.x,top.y-h/2,top.z);stream.scale.set(.5+flow*1.3,h,.5+flow*1.3);if(rnd()<dt*3) snd('drip');}
  lvl.scale.y=.2+O.drain*5;lvl.position.y=.03+O.drain*.04;
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
 else g.add(bx(.1,.06,.1,C.steel,0,0,0));
 return g;}
function buildGeneric(R,sp){
 const {c,g}=R,F=R.F,id=sp.id;if(!partOK(c,id)) return;
 const units=sp.units||1;if(!F.s) F.s={};
 const S=F.s[id]||(F.s[id]={f:new Array(sp.nfix||0).fill(1),cv:1,x:new Array(units).fill(0)});
 const u0=c.parts[id].u0!=null?c.parts[id].u0:50,P=PARTS[id];
 const w=()=>wanted(c,id)||(sp.also&&sp.also.some(k=>wanted(c,k)));
 const sk=sp.sock?sockOf(c,sp.sock):undefined;
 const home=sp.at(R);const grpAt=(p,r)=>{const o=grp(p.x,p.y,p.z);R.root.add(o);return o;};
 const objs=[];
 /* maillages de pièce : usée / neuve par unité */
 const unit=[];
 for(let i=0;i<units;i++){
  const p=sp.unitAt?sp.unitAt(R,i):home;const base=grpAt(p);
  const old=sp.host?null:mkProxy(sp.kind,u0),nw=sp.host?null:mkProxy(sp.kind,0);
  if(old){base.add(old);base.add(nw);}
  unit.push({base,old,nw,i});}
 const hostOf=()=>sp.host?sp.host(R):null;
 const cover=sp.cover?{o:grpAt(sp.cover.at?sp.cover.at(R):home)}:null;
 if(cover&&sp.cover.mk) cover.o.add(sp.cover.mk());
 const fixObjs=[];
 for(let i=0;i<(sp.nfix||0);i++){const o=sp.fixAt[i]||[0,.1,0];const m=hex(.012,.016,0xcfd4d9,home.x+o[0],home.y+o[1],home.z+o[2]);R.root.add(m);fixObjs.push(m);}
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
  :{key:'cvi'+id,lab:'Reposer '+sp.cover.name.toLowerCase(),tool:'main',hold:.6,snd:'clunk',ord:56+(sp.ord||0),exp:1,min:1,ph:ph0('pose'),why:S.x.some(x=>x===1)?'Posez d\'abord la pièce neuve.':null,do:()=>{S.cv=1;}}]});
 /* pièce(s) */
 unit.forEach(un=>R.add({id:'pt:'+id+':'+un.i,o:un.base,r:sp.r||.1,vis:()=>visOK()&&(!sp.cover||!S.cv||S.x[un.i]),name:()=>{const n=pname(c,id).replace(/ \(.*/,'');return units>1?`${n} ${un.i+1}/${units}`:(S.x[un.i]===2?n+' (neuve)':S.x[un.i]===1?'Emplacement vide':n);},acts:()=>{
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
  if(cover){const ho=sp.cover.host&&sp.cover.host(R2);if(ho) ho.visible=!!S.cv;cover.o.visible=!!S.cv;}
  unit.forEach(un=>{const x=S.x[un.i];
   if(un.old){un.old.visible=x===0||x===1;un.nw.visible=x===2;
    if(x===1){attachTo(un.old,R2.cart);tw(un.old,{p:[-.28+.14*((R2.spotN+un.i)%4),.86,-.1+.1*(un.i%3)],r:[0,0,0]},d);}
    else if(un.old.parent!==un.base){attachTo(un.old,un.base);un.old.position.set(0,0,0);un.old.rotation.set(0,0,0);}}
   else if(h){h.visible=x!==1;}});},
  free:R2=>{unit.forEach(un=>{if(un.old&&un.old.parent!==un.base) attachTo(un.old,un.base);});const h=hostOf();if(h) h.visible=true;if(cover&&sp.cover.host){const ho=sp.cover.host(R2);if(ho) ho.visible=true;}}});
}
function fixOff4(n,x,y,z,dx,dz){const a=[];for(let i=0;i<n;i++){const k=n===1?0:(i/(n-1)-.5)*2;a.push([x+k*dx,y,z+(i%2?dz:-dz)]);}return a;}
const LOCAL=(R,n,dx,dy,dz)=>{const a=R.A(n);return V3(a.x+(dx||0),a.y+(dy||0),a.z+(dz||0));};
const SPECS=[
 {id:'filtre_air',kind:'air',name:'Boîte à air',at:R=>LOCAL(R,'airbox',0,.12,0),nfix:4,optFix:2,fixAt:[[-.12,.03,-.09],[.12,.03,-.09],[-.12,.03,.09],[.12,.03,.09]],fixTool:'tournevis',sock:null,fixName:'Clip du couvercle',fixLab:'Déclipser le couvercle',fixRe:'Reclipser le couvercle',bin:'clip',vis:R=>c4(R),depLab:'Sortir le filtre à air',poseLab:'Poser le filtre à air neuf',ord:2},
 {id:'bougies',kind:null,name:'Bougies',units:null,ord:0},
 {id:'batterie',kind:'bat',host:R=>bayPart(R,'battery'),at:R=>LOCAL(R,'battery',0,0,0),nfix:3,fixAt:[[.08,.1,-.04],[-.08,.1,-.04],[0,.0,.1]],sock:'bat',fixName:'Cosse ou bride de batterie',fixLab:'Desserrer la cosse / la bride',fixRe:'Resserrer la cosse / la bride',vis:R=>c4(R),depLab:'Sortir la batterie',poseLab:'Poser la batterie neuve',r:.12},
 {id:'courroie_acc',kind:'belt',host:R=>engSep(R,'belt'),at:R=>LOCAL(R,'alternator',0,.05,0),nfix:1,fixAt:[[0,.12,.0]],sock:'tens',fixName:'Galet tendeur',fixLab:"Relâcher le galet tendeur",fixRe:'Retendre le galet',vis:R=>c4(R),depLab:"Sortir la courroie d'accessoires",poseLab:"Passer la courroie neuve",r:.14,ord:1},
 {id:'alternateur',kind:null,host:R=>engSep(R,'alternator'),at:R=>LOCAL(R,'alternator',0,.0,0),nfix:3,fixAt:[[.05,.1,.0],[-.05,.1,.0],[0,.05,.08]],sock:'alt',fixName:"Fixation de l'alternateur",fixLab:'Dévisser',vis:R=>c4(R),depLab:"Déposer l'alternateur",poseLab:"Monter l'alternateur neuf",r:.12,ord:3},
 {id:'demarreur',host:R=>engSep(R,'starter'),at:R=>{const b=bayG(R);const e=b&&b.userData.gear;return e?e.e.clone().add(V3(0,-.05,.1)):LOCAL(R,'bay',0,.2,0);},nfix:3,fixAt:[[.05,.1,.0],[-.05,.1,.0],[0,.05,.08]],sock:'start',fixName:'Fixation du démarreur',fixLab:'Dévisser',vis:R=>c4(R),depLab:'Déposer le démarreur',poseLab:'Monter le démarreur neuf',r:.12,ord:4},
 {id:'injecteurs',kind:'rail',host:R=>engSep(R,'inj'),at:R=>LOCAL(R,'coils',0,.05,0),nfix:2,fixAt:[[.15,.0,0],[-.15,.0,0]],sock:'inj',fixName:"Fixation de la rampe",fixLab:'Dévisser',vis:R=>c4(R),depLab:'Sortir la rampe et les injecteurs',poseLab:'Monter les injecteurs neufs',r:.14,ord:5},
 {id:'courroie_dist',kind:'belt',at:R=>{const b=bayG(R);return LOCAL(R,'timing',0,0,0);},nfix:4,fixAt:[[.08,.08,.0],[-.08,.08,.0],[.08,-.06,.0],[-.08,-.06,.0]],sock:'clip',fixName:'Vis du carter de distribution',fixLab:'Dévisser',vis:R=>c4(R),cover:{name:'Carter de distribution',host:R=>engSep(R,'timingCover'),at:R=>LOCAL(R,'timing',0,0,0)},depLab:'Déposer la courroie, le galet et la pompe',poseLab:'Poser le kit de distribution neuf',poseTool:'cle_dyn',poseSock:'tens',r:.14,ord:6},
 {id:'embrayage',kind:'clutch',at:R=>{const b=bayG(R);const e=b&&b.userData.gear;return e?e.e.clone():LOCAL(R,'bay',0,.2,0);},nfix:4,fixAt:[[.1,.08,.1],[-.1,.08,.1],[.1,-.08,.1],[-.1,-.08,.1]],sock:'gear',fixName:'Vis de la boîte de vitesses',fixLab:'Dévisser',vis:R=>c4(R),cover:{name:'Boîte de vitesses',host:R=>bayPart(R,'gearbox'),at:R=>{const b=bayG(R);const e=b&&b.userData.gear;return e?e.c.clone():LOCAL(R,'bay',0,.2,0);}},depLab:"Déposer l'embrayage",poseLab:"Poser l'embrayage neuf (centrage)",r:.16,ord:7},
 {id:'sonde_lambda',kind:'lambda',at:R=>{const e=R.A('exhaust');return V3(e.x,e.y+.04,R.u.L?-R.u.L*.05:0);},vis:R=>liftedNow(R.c),nfix:1,fixAt:[[0,.0,.06]],fixTool:'pinces',fixName:'Connecteur de la sonde',fixLab:'Débrancher le connecteur',fixRe:'Rebrancher le connecteur',depTool:'cliquet',depSock:'sonde',depLab:'Dévisser la sonde lambda',poseLab:'Visser la sonde neuve',poseTool:'cliquet',poseSock:'sonde',r:.1,ord:8},
 {id:'ampoules',kind:'bulb',at:R=>V3(R.u.W*.3,.68,(R.u.L||4)/2-.12),nfix:2,fixAt:[[.05,.0,-.03],[-.05,.0,-.03]],fixTool:'tournevis',fixName:'Clip du cache de phare',fixLab:'Déclipser le cache',fixRe:'Reclipser le cache',bin:'clip',depLab:"Sortir l'ampoule grillée",poseLab:"Monter l'ampoule neuve",r:.1,ord:9},
 {id:'essuie',kind:'wiper',at:R=>{const a=R.A('cabin');return V3(-.1,.98,a.z+.8);},nfix:1,fixAt:[[.0,.03,.0]],fixTool:'main',fixName:"Bras d'essuie-glace",fixLab:'Relever le bras',fixRe:'Rabaisser le bras',depLab:'Déclipser et sortir le balai',poseLab:'Clipser le balai neuf',r:.2,ord:10},
 {id:'filtre_hab',kind:'cab',at:R=>{const a=R.A('cabin');return V3(a.x-.5,.5,a.z+.45);},nfix:2,fixAt:[[.08,.0,.0],[-.08,.0,.0]],fixTool:'main',fixName:'Trappe de la boîte à gants',fixLab:'Ouvrir la trappe',fixRe:'Refermer la trappe',depLab:"Sortir le filtre d'habitacle",poseLab:"Poser le filtre d'habitacle neuf",r:.14,ord:11}];
const c4=R=>!!R.c.st.capot&&!!bayG(R);
function buildOthers(R){
 const c=R.c;
 for(const sp of SPECS){
  if(sp.id==='bougies'||sp.id==='batterie'&&false) continue;
  if(!partOK(c,sp.id)) continue;
  if(sp.id==='batterie'){const s2=Object.assign({},sp,{kind:'bat'});buildGeneric(R,Object.assign(s2,{kind:'bat'}));continue;}
  buildGeneric(R,sp);}
 /* bougies : une unité par cylindre */
 if(partOK(c,'bougies')){const e=c.mdl&&MWCARS.get(c.mdl).eng,n=Math.min(e?e.n:4,8),diesel=e&&e.fuel==='diesel';
  buildGeneric(R,{id:'bougies',kind:diesel?'glow':'plug',units:n,nfix:0,at:R=>LOCAL(R,'coils',0,0,0),unitAt:(R2,i)=>{const b=bayG(R2),cs=b&&b.userData.coils;if(cs&&cs[i]) return cs[i].p.clone().add(V3(0,.04,0));const a=R2.A('coils');return V3(a.x+(i-(n-1)/2)*.08,a.y+.05,a.z);},
   vis:R=>c4(R),depTool:'cliquet',depSock:'plugs',depLab:diesel?'Dévisser la bougie de préchauffage':"Déposer la bobine et dévisser la bougie",poseLab:diesel?'Visser la bougie neuve':'Visser la bougie neuve et remettre la bobine',poseTool:'cliquet',poseSock:'plugs',depHold:.9,poseHold:.9,r:.045,ord:0});}
}
BUILD.push(buildOthers);

SPECS.push({id:'liquide_frein',kind:'fluid',at:R=>LOCAL(R,'brakeFluid',0,.08,0),nfix:1,fixAt:[[0,.0,0]],fixTool:'main',fixName:'Bouchon du bocal',fixLab:'Dévisser le bouchon du bocal',fixRe:'Revisser le bouchon',vis:R=>c4(R),depTool:'seringue',depLab:"Aspirer l'ancien liquide",poseTool:'bidon',poseLab:'Remplir de liquide neuf et purger',poseHold:1.8,r:.09,ord:12});
SPECS.push({id:'amort',kind:'damper',units:2,nfix:0,at:R=>LOCAL(R,'hubFL',0,.3,0),unitAt:(R,i)=>{const a=R.A(i?'hubFR':'hubFL');return V3(a.x,a.y+.32,a.z);},vis:R=>R.c.st.av,depTool:'cliquet',depSock:'top',depLab:"Déposer l'amortisseur et son ressort",poseTool:'cliquet',poseSock:'top',poseLab:"Monter l'amortisseur neuf",depHold:1.4,poseHold:1.4,r:.15,ord:13});

/* ═══════════ Blocages, malus ═══════════ */
function blocage(c){
 const l=[],g=c.g;if(!g||!on()) return l;
 let n=0;for(const S in g.w) n+=g.w[S].n.filter(x=>x===2).length;
 if(n) l.push('des écrous de roue ne sont pas serrés au couple');
 const off=Object.keys(g.w).filter(S=>g.w[S].o);if(off.length) l.push('une roue est déposée');
 if(g.pump) l.push("la pédale de frein n'a pas été pompée");
 const o=g.o;if(o){if(o.bac) l.push('le bac de vidange est resté sous la voiture');if(!o.cap) l.push("le bouchon de remplissage d'huile est ouvert");if(c.done.huile&&!o.done) l.push("le moteur n'a pas été rempli d'huile");if(o.fun) l.push("l'entonnoir est resté sur le moteur");}
 if(g.s) for(const id in g.s){const sp=SPECS.find(x=>x.id===id);if(!sp) continue;const req=(sp.nfix||0)-(sp.optFix||0);if(g.s[id].f.slice(0,req).some(v=>!v)) l.push('des fixations ne sont pas remontées ('+id.replace('_',' ')+')');if(g.s[id].cv===0) l.push('un couvercle est déposé');}
 return l;}
function malus(c){const g=c.g;if(!g||!on()) return 0;let m=0;const b=g.bin||{};for(const k in b) if(k!=='ecrou'||true) m+=b[k]||0;if(g.o&&g.o.over) m+=1;return Math.min(3,m);}
function malusTxt(c){const g=c.g||{},b=g.bin||{},l=Object.keys(b).filter(k=>b[k]>0).map(k=>b[k]+' '+BIN_NOM[k]);return 'Pièces oubliées dans le bac magnétique'+(l.length?' ('+l.join(', ')+')':'')+(g.o&&g.o.over?' ; trop d\'huile dans le moteur':'')+'.';}

/* ═══════════ Rig : cycle de vie et boucle ═══════════ */
const pontD=c=>{const z=MW.zone(c.zone),p=z&&z.ponts&&z.ponts[c.pont];if(!p) return 1e9;const q=MW.player();return Math.hypot(q.x-p.x,q.z-p.z);};
function buildRig(c){
 const r=newRig(c);if(!r) return null;R=r;
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
 if(!R&&!pl.inCar&&!essai){let b=null,bd=5.2;for(const c of cars){const d=pontD(c);if(d<bd&&MWJ.mesh(c)){bd=d;b=c;}}if(b) buildRig(b);}
 ensureUI();if(!UI) return;
 UI.tb.hidden=!R||MW.paused;
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
 const o=typeof t.o==='function'?t.o():t.o;if(!o||!visOf(o)) return;
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
 aimI=MW.addInteract({id:'mg:aim',x:0,z:0,r:1.2,label:()=>AIM?AIM.a.lab:'',when:()=>!!AIM&&on()&&!MW.paused,use:()=>{if(!on()) return;eDown=true;startAct();}});
 window.addEventListener('keydown',e=>{if(e.key&&e.key.toLowerCase()==='e'&&!e.repeat) eDown=true;},true);
 window.addEventListener('keyup',e=>{if(e.key&&e.key.toLowerCase()==='e') onRelease();},true);
 window.addEventListener('blur',()=>onRelease());
 const be=document.getElementById('mwBtnE');
 if(be){be.addEventListener('pointerdown',()=>{eDown=true;});for(const t of ['pointerup','pointercancel','pointerleave']) be.addEventListener(t,()=>onRelease());}
 const lk=document.getElementById('mwLook');
 if(lk) lk.addEventListener('wheel',e=>{if(!on()||!R) return;e.preventDefault();const i=TOOLS.findIndex(t=>t.id===tool);setTool(TOOLS[(i+(e.deltaY>0?1:-1)+TOOLS.length)%TOOLS.length].id);},{passive:false});
 MW.on('key',k=>{if(!on()) return;if(k==='g') settings();else if(k==='r') cycleSock(1);else{const t=TOOLS.find(x=>x.key===k);if(t&&R) setTool(t.id);}});
 MW.addButton('gestes','Gestes (G)',()=>{if(MW.S) settings();});}
MW.on('start',()=>{wire();init();});
MW.on('open',()=>{wire();ensureUI();});
MW.on('close',()=>{if(R) freeRig();});
MW.on('tick',tick);

Object.assign(api,{
 on:()=>on(),set:o=>{Object.assign(gs(),o);lastTb='';if(!on()&&R) freeRig();},rig:()=>R,aim:()=>AIM,hint:()=>HINT,tools:TOOLS,tool:id=>setTool(id),sock:n=>setSock(n),
 ownW:c=>on(),lift:c=>on()&&!(c&&c.noir)?1.45:1,mesh:c=>{if(!on()||!c.g) return;},blocage,malus,malusTxt,rest,fin:false,settings,
 /* le rig suit la voiture la plus proche : pour les tests, on le force */
 ensure:c=>{if(!R||R.c!==c){if(R) freeRig();buildRig(c);}return R;},
 acts:c=>{if(!R||R.c!==c) api.ensure(c);const out=[];for(const t of R.tg){for(const a of actsOf(t)) out.push({id:t.id,key:a.key,lab:a.lab,tool:a.tool,sock:a.sock,hold:a.hold,why:a.why||null,exp:!!a.exp,ord:a.ord});}return out;},
 /* exécute (sans attendre) l'action « key » de la cible « id » ; renvoie le message de refus éventuel */
 run:(id,key,o)=>{const t=R&&R.tg.find(q=>q.id===id);if(!t) return 'cible introuvable : '+id;const a=actsOf(t).find(x=>!key||x.key===key);if(!a) return 'aucune action';
  if(!(o&&o.strict)){if(a.tool&&TOOL[a.tool]) tool=a.tool;if(a.sock) sock=a.sock;}
  if(!(o&&o.force)){const w=checkAct(a);if(w) return w;}
  if(a.cont){a.start&&a.start();a.tick&&a.tick(.0,{});for(let i=0;i<400&&!(a.auto&&a.auto());i++){a.tick&&a.tick(.05,{});if(a.prog&&a.prog()>=1.0) break;}a.release&&a.release();syncAll(true);return null;}
  finish(t,a);return null;},
 skip:()=>{if(R){const O=oilSt(R.c);if(O.on){O.drain=.999;}}},
 setTool:(t,s)=>{tool=t;if(s) sock=s;vmSet();lastTb='';toolUI();},cur:()=>({tool,sock}),
 nextHint:()=>{hintUpdate();return HINT?{id:HINT.t.id,key:HINT.a.key,lab:HINT.a.lab,tool:HINT.a.tool,sock:HINT.a.sock}:null;},
 release:()=>{if(R) freeRig();},
 startHold:(id,key)=>{const t=R&&R.tg.find(q=>q.id===id);if(!t) return false;AIM={t,a:actsOf(t).find(x=>!key||x.key===key)};eDown=true;startAct();return !!H;},
 spendAll:()=>{}});
return api;
})();
