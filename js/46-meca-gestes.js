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
 r.W=(lx,ly,lz)=>new T.Vector3(p.x+r.cosr*lx+r.sinr*lz,ly,p.z-r.sinr*lx+r.cosr*lz);
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
 ANI.length=0;R=null;AIM=null;HINT=null;H=null;handSet(null);setHold(0);if(MW.eyeY) MW.eyeY=0;}

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
 if(!best&&fixes.length){fixes.sort((x,y)=>x.ord-y.ord);const t=R.tg.find(q=>q.id===fixes[0].fix);if(t){const a=actsOf(t).find(x=>!x.why);if(a) best={t,a};}}
 else if(best&&fixes.length){ /* une action bloquée plus tôt dans l'ordre passe devant : on l'aide à se débloquer */
  fixes.sort((x,y)=>x.ord-y.ord);if(fixes[0].ord<best.a.ord){const t=R.tg.find(q=>q.id===fixes[0].fix);if(t){const a=actsOf(t).find(x=>!x.why);if(a) best={t,a};}}}
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
let VM=null,vmTool=null,vmHand=null,vmW=0,vmT=0,vmK=0;
function vmEnsure(){
 if(VM) return VM;VM=new T.Group();VM.name='mg_vm';VM.renderOrder=999;MW.scene.add(MW.cam);MW.cam.add(VM);return VM;}
const VMM=(col,k)=>{const m=new T.MeshLambertMaterial({color:col});m.depthTest=false;m.depthWrite=false;m.userData.vm=1;return m;};
const vmCache={};
function vmModel(id){
 if(vmCache[id]) return vmCache[id];
 const g=new T.Group(),m=(col)=>VMM(col),box=(w,h,d,col,x,y,z)=>{const o=new T.Mesh(gBox(w,h,d),m(col));o.position.set(x,y,z);o.renderOrder=999;g.add(o);return o;},cyl=(r,h,col,x,y,z,rx,rz,n)=>{const o=new T.Mesh(gCyl(r,r,h,n||12),m(col));o.position.set(x,y,z);o.rotation.set(rx||0,0,rz||0);o.renderOrder=999;g.add(o);return o;};
 /* chaque outil est dirigé vers l'avant (−z de la caméra) */
 if(id==='cliquet'){box(.022,.022,.30,0x2a2e33,0,0,-.12);cyl(.04,.05,0xb4bcc4,0,0,-.30,PI/2,0,6);cyl(.03,.07,0xd8dde2,0,0,-.34,PI/2,0,6);box(.03,.03,.1,0xc02a20,0,0,.06);}
 else if(id==='cle_filtre'){cyl(.045,.08,0x9aa3ab,0,0,-.3,PI/2);box(.02,.02,.30,0x2a2e33,0,0,-.12);box(.03,.03,.1,0xe8b820,0,0,.05);}
 else if(id==='tournevis'){cyl(.018,.1,0xe8b820,0,0,-.04,PI/2);cyl(.006,.16,0xd8dde2,0,0,-.2,PI/2);}
 else if(id==='boulonneuse'){box(.07,.1,.2,0x0d6e8c,0,0,-.05);box(.04,.12,.05,0x1b1b1e,0,-.09,0);cyl(.032,.07,0xd8dde2,0,0,-.2,PI/2,0,6);box(.04,.05,.07,0x25282c,0,.07,.04);}
 else if(id==='cle_dyn'){box(.02,.02,.42,0x9aa3ab,0,0,-.17);cyl(.034,.06,0xd8dde2,0,0,-.4,PI/2,0,6);box(.034,.034,.12,0x1b1b1e,0,0,.1);box(.02,.03,.03,0xc02a20,0,.028,-.05);}
 else if(id==='bac'){box(.30,.05,.22,0x2a62c8,0,-.02,-.2);box(.28,.01,.20,0x0b1020,0,.012,-.2);}
 else if(id==='bidon'){box(.12,.2,.08,0xe8e8e4,0,0,-.15);cyl(.022,.06,0xe8b820,.03,.12,-.15);box(.03,.1,.02,0xe8e8e4,-.05,.08,-.15);}
 else if(id==='entonnoir'){const o=new T.Mesh(gCyl(.06,.012,.1,14),m(0xe8b820));o.position.set(0,0,-.2);o.renderOrder=999;g.add(o);}
 else if(id==='pinces'){box(.02,.02,.2,0x2a2e33,-.012,0,-.12);box(.02,.02,.2,0x2a2e33,.012,0,-.12);box(.03,.03,.06,0xc02a20,0,0,.04);}
 else if(id==='presse'){cyl(.025,.2,0x9aa3ab,0,0,-.18,PI/2);box(.07,.07,.02,0x4d535a,0,0,-.3);box(.03,.1,.03,0x25282c,0,0,.0);}
 else if(id==='seringue'){cyl(.03,.2,0xe9e9e4,0,0,-.18,PI/2);cyl(.006,.12,0xd8dde2,0,0,-.34,PI/2);box(.07,.01,.02,0xe9e9e4,0,0,-.08);}
 else {box(.05,.02,.1,0xd9b48f,.0,-.03,-.2); box(.03,.015,.07,0xd9b48f,.05,-.025,-.18);} /* mains */
 vmCache[id]=g;return g;}
function vmSet(){
 if(!VM) return;if(vmTool) VM.remove(vmTool);vmTool=null;
 const m=vmModel(tool);vmTool=m;VM.add(m);}
function handSet(item){ /* item : maillage de la pièce neuve tenue dans l'autre main (ou null) */
 if(!VM) return;if(vmHand){VM.remove(vmHand);vmHand=null;}
 if(item){vmHand=item;VM.add(item);}}
function vmKick(a){vmK=1;}
function vmWork(w){vmW=w;}
function vmTick(dt){
 if(!VM) return;const show=!!R&&on()&&!MW.paused&&!MW.player().inCar;VM.visible=show;if(!show) return;
 vmT+=dt;vmK=Math.max(0,vmK-dt*5);
 const w=vmW,bob=Math.sin(vmT*1.8)*.004;
 VM.position.set(.22,-.2+bob,-.42);VM.rotation.set(.12,-.12,0);
 if(vmTool){
  vmTool.position.set(0,0,0);vmTool.rotation.set(0,0,0);
  if(w){const j=Math.sin(vmT*(tool==='boulonneuse'?60:14));
   if(tool==='cliquet'||tool==='cle_dyn'||tool==='cle_filtre'){vmTool.rotation.z=j*.12;vmTool.position.z=-.02;}
   else if(tool==='boulonneuse'){vmTool.position.x=j*.004;vmTool.position.z=-.04;}
   else if(tool==='bidon'){vmTool.rotation.x=-.9;vmTool.position.y=.05;}
   else if(tool==='tournevis'){vmTool.rotation.z=j*.2;}
   else {vmTool.position.z=-.03+j*.01;}}
  vmTool.position.z+=-vmK*.05;}
 if(vmHand){vmHand.position.set(-.38,-.02+bob,-.1);vmHand.rotation.set(.2,.5,0);}}

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
function doPoseL(R,id){if(R.c.done[id]) return true;return logic(L().doPose,R.c,id);}
const fixOf=(w)=>w&&/pont/i.test(w)?(/Baissez|baiss/i.test(w)?'lower':'lift'):w&&/capot/i.test(w)?'hood':null;
/* ordre d'une action selon la pièce voulue (les pièces de l'ordre passent dans l'ordre de la commande) */
const pidx=(c,id)=>{const i=c.ordre.indexOf(id);return i<0?(c.symp&&c.symp.c===id?0:5):i;};
/* écart de coordonnées d'un maillage : place un objet « en main » ou sur le sol (monde) */
function floorSpot(R,o,i,h){const w=R.W(2.0+.5*(i%3),h||.02,-1.7-.45*Math.floor(i/3));attachTo(o,R.fl);tw(o,{p:[w.x,w.y,w.z],r:[0,R.p.ry,0]},.5);}

/* ═══════════ Procédure commune : servante, bac magnétique, commande du pont, capot, portière, pédale ═══════════ */
function buildCommon(R){
 const {c,g,u}=R,F=R.F;R.blk={lower:[],hood:[]};R.spotN=0;
 /* servante à outils avec bac magnétique */
 const cart=grp();const cp=R.W(2.25,0,-.85);cart.position.copy(cp);cart.rotation.y=R.p.ry;
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
 const col=grp();col.position.copy(R.W(2.05,0,2.0));col.rotation.y=R.p.ry;
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
   acts:()=>[c.st.capot?{key:'hclose',lab:'Fermer le capot',hold:.6,ord:90,snd:'clunk',
     why:Object.keys(c.rem).some(id=>PARTS[id].zone==='capot')?'Une pièce est démontée sous le capot.':(R.blk.hood.map(f=>f()).find(Boolean)||null),do:()=>{L().togCapot(c);}}
    :{key:'hopen',lab:'Ouvrir le capot (déverrouiller et lever)',hold:.6,ord:5,snd:'clunk',do:()=>{L().togCapot(c);}}]});}
 /* portière conducteur : habitacle (valise, essai, rendre la voiture) */
 const dn=new T.Object3D();dn.position.set((u.W||1.8)/2+.01,.98,R.A('cabin').z+.18);g.add(dn);R.root.add(dn);R.objs.door=dn;
 R.add({id:'door',o:dn,r:.28,name:'Portière conducteur',acts:()=>[{key:'door',lab:'Habitacle : valise, essai sur route, rendre la voiture',ord:99,do:()=>{MWJ.openPoint(c.id,'cabine');}}]});
 /* pédale de frein (à pomper après un travail sur les freins) */
 const pd=new T.Object3D();pd.position.set(R.A('cabin').x+.0,.32,R.A('cabin').z+.5);R.root.add(pd);
 R.add({id:'pedal',o:pd,r:.22,name:'Pédale de frein (par la vitre)',vis:()=>true,acts:()=>[F.pump?{key:'pump',lab:'Pomper la pédale de frein',hold:1.6,snd:'pump',ord:80,exp:1,do:()=>{F.pump=0;MW.toast('La pédale est ferme : les plaquettes sont en contact avec les disques.','good');}}:{key:'pump0',lab:'Appuyer sur la pédale : elle est ferme',ord:200,do:()=>{MW.toast('La pédale de frein est ferme.','info');}}]});
 R.procs.push({id:'common',vis:(R2,inst)=>{R2.binSync();},free:()=>{}});
}
BUILD.push(buildCommon);
