'use strict';
/* ───────────── Atelier de montage ─────────────
   Le moteur conçu est monté pièce par pièce dans une usine en 3D.
   Mode cinématique : un ingénieur fait le travail. Mode première personne : le joueur prend sa place,
   va chercher chaque pièce sur les établis, la pose dans le bon ordre et serre les vis au couple. */
let AT=null;
// ordre de montage réel : [rang, motif sur le nom de la pièce, consigne, outil, vis à serrer (0 = aucune), couple]
const AT_ORDER=[
 [0,/^Bloc-cylindres|^Carters de rotor/,'Le bloc est bridé sur le support de montage, plan de joint vers le haut.','Support rotatif',0,''],
 [1,/^Vilebrequin|^Arbre excentrique/,'Huilez les coussinets, posez le vilebrequin dans ses paliers puis serrez les chapeaux en partant du centre.','Clé dynamométrique',6,'60 Nm + 90°'],
 [2,/^Bielles/,'Assemblez les bielles sur les manetons, coussinets huilés, chapeaux dans le bon sens.','Clé dynamométrique',0,'40 Nm + 90°'],
 [3,/^Pistons|^Rotors/,'Tiercez les segments, comprimez-les avec le collier et descendez chaque piston dans son cylindre, flèche vers la distribution.','Collier à segments',0,''],
 [4,/^Flasques latéraux/,'Refermez le moteur avec les flasques latéraux et leurs joints.','Clé dynamométrique',6,'35 Nm'],
 [5,/^Carter d'huile/,'Posez la pompe et la crépine, un cordon de pâte à joint, puis le carter d\'huile.','Clé à cliquet',8,'12 Nm'],
 [6,/^Culasse|^Soupapes et ressorts/,'Posez le joint de culasse neuf, puis la culasse avec ses soupapes. Serrez en spirale depuis le centre, en plusieurs passes.','Clé dynamométrique',10,'40 Nm + 90° + 90°'],
 [8,/^Arbres? à cames/,'Huilez les paliers, posez les arbres à cames, repères de calage vers le haut.','Clé dynamométrique',0,'10 Nm'],
 [9,/^Distribution/,'Calez le vilebrequin et les arbres à cames sur leurs repères, montez la distribution et tendez-la.','Piges de calage',0,''],
 [10,/^Carter de distribution|^Carter avant/,'Refermez la distribution avec son carter et un joint neuf.','Clé à cliquet',0,'10 Nm'],
 [11,/^Couvre-culasse/,'Posez le couvre-culasse avec son joint.','Clé à cliquet',0,'9 Nm'],
 [12,/^Bougies|^Bobines/,'Vissez les bougies à la main puis au couple, et clipsez l\'allumage.','Clé à bougie',0,'25 Nm'],
 [13,/^Rampe|^Pompe haute pression|^Carburateur|^Injecteur/,'Montez l\'alimentation en carburant avec des joints neufs.','Clé à cliquet',0,'25 Nm'],
 [14,/^Collecteur d'admission|^Boîtier papillon|^Entrée d'air|^Vanne EGR|^Compresseur volumétrique/,'Montez l\'admission sur la culasse avec ses joints.','Clé à cliquet',0,'20 Nm'],
 [15,/^Collecteurs? d'échappement/,'Posez le collecteur d\'échappement sur ses goujons, joint neuf, écrous cuivrés.','Clé dynamométrique',6,'25 Nm'],
 [16,/^Turbocompresseur|^Tuyau d'air comprimé|^Échangeur/,'Montez la suralimentation : turbo sur le collecteur, graissage, puis les tuyaux d\'air.','Clé à cliquet',0,'30 Nm'],
 [17,/^Ligne d'échappement|^Catalyseur|^Sondes? lambda/,'Raccordez la ligne d\'échappement et ses sondes.','Clé à cliquet',0,'45 Nm'],
 [18,/^Pompe à eau|^Boîtier de thermostat/,'Montez le circuit de refroidissement.','Clé à cliquet',0,'12 Nm'],
 [19,/^Poulie|^Alternateur|^Compresseur de climatisation|^Courroie d'accessoires/,'Montez la poulie, les accessoires, puis passez et tendez la courroie.','Clé à cliquet',0,'25 Nm'],
 [20,/^Volant moteur|^Démarreur/,'Montez le volant moteur avec des vis neuves serrées en étoile, puis le démarreur.','Clé dynamométrique',8,'70 Nm'],
 [21,/^Filtre à huile|^Jauge|^Bouchon/,'Vissez le filtre à huile (joint huilé), la jauge et le bouchon.','À la main',0,''],
 [22,/Capteur|Sonde|Débitmètre|Faisceau|Boîte à air/,'Branchez les capteurs, le faisceau électrique et l\'admission d\'air.','Tournevis',0,''],
 [23,/^Huile moteur/,'Faites le plein d\'huile jusqu\'au repère maxi de la jauge.','Bidon d\'huile',0,''],
];
const atRank=n=>{for(const r of AT_ORDER) if(r[1].test(n)) return r;return AT_ORDER[21];};
function atSnd(kind){
  const c=fxCtx();if(!c) return;if(!SFX.bus){const g=c.createGain();g.gain.value=.8;g.connect(c.destination);SFX.bus=g;}
  const o=SFX.bus,t=c.currentTime;
  if(kind==='pick'){nz(o,t,.05,{type:'highpass',f:2500,g:.25,a:.002});}
  else if(kind==='place'){tone(o,t,.16,{f:140,f2:70,g:.35,a:.003});nz(o,t,.08,{type:'lowpass',f:900,g:.3,a:.002});}
  else if(kind==='bolt'){for(let i=0;i<5;i++) nz(o,t+i*.045,.02,{type:'bandpass',f:3200,q:3,g:.22,a:.001});tone(o,t+.26,.05,{f:1800,g:.12,a:.002});}
  else if(kind==='step'){nz(o,t,.07,{type:'lowpass',f:260,g:.16,a:.004});}
  else if(kind==='err'){tone(o,t,.18,{type:'square',f:180,f2:120,g:.1,a:.005,lp:900});}
  else if(kind==='done'){for(const [f,d] of [[392,0],[523,.12],[659,.24],[784,.36]]) tone(o,t+d,.5,{type:'triangle',f,g:.14,a:.02});}
  else if(kind==='start'){for(let i=0;i<16;i++) nz(o,t+i*.07,.05,{type:'lowpass',f:500,g:.3,a:.004});tone(o,t+1.1,1.8,{type:'sawtooth',f:45,f2:110,glide:.9,g:.2,a:.15,hold:.8,lp:500,lq:2});nz(o,t+1.1,1.8,{type:'lowpass',f:320,g:.2,a:.2});}
}
function openAtelier(name){
  closeAtelier();
  const ov=el('div','atl');ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Atelier de montage du moteur');
  ov.innerHTML=`<canvas id="atlCv"></canvas>
   <div class="atl-top"><div><p class="eyebrow">Atelier de montage</p><b id="atlName"></b></div><div class="atl-btns"><button class="chip-btn" type="button" id="atlSpd">Vitesse ×1</button><button class="chip-btn" type="button" id="atlSnd" aria-pressed="${SFX.on}">${SFX.on?'Son activé':'Son coupé'}</button><button class="chip-btn" type="button" id="atlClose">Fermer</button></div></div>
   <div class="atl-cross" aria-hidden="true"></div><div class="atl-label" id="atlLabel" hidden></div>
   <div class="atl-pad" id="atlPad" hidden><button type="button" data-mv="f" aria-label="Avancer">▲</button><button type="button" data-mv="l" aria-label="Gauche">◀</button><button type="button" data-mv="b" aria-label="Reculer">▼</button><button type="button" data-mv="r" aria-label="Droite">▶</button></div>
   <div class="atl-hud"><div class="atl-prog" aria-hidden="true"><i id="atlProg"></i></div><div class="atl-step"><span class="eyebrow" id="atlCount"></span><b id="atlTitle"></b><p id="atlText"></p><p class="atl-tool" id="atlTool"></p></div>
    <div class="atl-act"><button class="btn" type="button" id="atlTake">Prendre la place de l'ingénieur</button><button class="chip-btn" type="button" id="atlHint" hidden>Indice</button><button class="chip-btn" type="button" id="atlGive" hidden>Rendre la main à l'ingénieur</button></div>
    <p class="atl-msg" id="atlMsg" role="status"></p></div>`;
  document.body.appendChild(ov);document.body.classList.add('lfx-on');
  $('#atlName',ov).textContent=`${name} · ${M.E.c.full} · ${nf(M.E.L,1)} l · ${nf(M.E.peakP)} ch`;
  const cv=$('#atlCv',ov),keep=E3,view0=ui.eview;let A=null;
  try{E3=null;ui.eview='3d';if(init3D(cv)){build3D();A=E3;}}catch(e){A=null;}
  E3=keep;ui.eview=view0;
  if(!A||!A.root){ov.remove();document.body.classList.remove('lfx-on');const m=$('#myEngMsg');if(m) m.textContent+=' (La vue 3D n\'est pas disponible sur cet appareil : montage non affiché.)';return;}
  const T=THREE;
  for(const m of A.shellMats){m.transparent=false;m.opacity=1;m.depthWrite=true;m.needsUpdate=true;}
  A.root.traverse(o=>{o.visible=true;});
  AT={ov,cv,A,T,name,mode:'cine',spd:1,t:0,last:performance.now(),step:0,phase:0,ph:0,keys:{},yaw:0,pitch:-.12,pos:new T.Vector3(0,1650,1900),held:null,bolts:[],errs:0,t0:performance.now(),done:false,hint:null};
  atBuildScene();atBuildSteps();atDetail();atHUD();atAmb();
  // interactions
  ov.addEventListener('click',e=>{const b=e.target.closest('button');if(!b) return;
    if(b.id==='atlClose') closeAtelier();
    else if(b.id==='atlSpd'){AT.spd=AT.spd>=4?1:AT.spd*2;b.textContent=`Vitesse ×${AT.spd}`;}
    else if(b.id==='atlSnd'){fxSetOn(!SFX.on);b.setAttribute('aria-pressed',SFX.on);b.textContent=SFX.on?'Son activé':'Son coupé';}
    else if(b.id==='atlTake') atSetMode('fp');
    else if(b.id==='atlGive') atSetMode('cine');
    else if(b.id==='atlHint') atHint();});
  let drag=null;
  cv.addEventListener('pointerdown',e=>{if(drag) return;drag={x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,id:e.pointerId,t:performance.now()};try{cv.setPointerCapture(e.pointerId);}catch(err){}});
  cv.addEventListener('pointermove',e=>{if(!AT) return;AT.mouse=e.pointerType==='mouse'?{x:e.clientX,y:e.clientY}:null;if(!drag||e.pointerId!==drag.id) return;if(AT.mode==='fp'){const k=e.pointerType==='mouse'?.0042:.0065;AT.yaw-=(e.clientX-drag.x)*k;AT.pitch=clamp(AT.pitch-(e.clientY-drag.y)*k*.85,-1.2,.9);}drag.x=e.clientX;drag.y=e.clientY;});
  const endDrag=e=>{if(!drag||!AT||e.pointerId!==drag.id) return;const moved=Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0),quick=performance.now()-drag.t<450;const d=drag;drag=null;if(e.type==='pointerup'&&AT.mode==='fp'&&moved<(e.pointerType==='mouse'?7:16)&&quick) atTap(e.clientX,e.clientY);};
  cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
  for(const b of $$('#atlPad [data-mv]',ov)){const k=b.dataset.mv,up=()=>{if(AT) AT.keys[k]=false;b.classList.remove('on');};
    b.addEventListener('pointerdown',e=>{e.preventDefault();if(!AT) return;AT.keys[k]=true;b.classList.add('on');try{b.setPointerCapture(e.pointerId);}catch(err){}});
    for(const ev of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(ev,up);b.addEventListener('contextmenu',e=>e.preventDefault());}
  AT.onBlur=()=>{if(AT) AT.keys={};};window.addEventListener('blur',AT.onBlur);
  AT.onKey=e=>{if(!AT) return;const ch=(e.key||'').toLowerCase(),k={z:'f',w:'f',s:'b',q:'l',a:'l',d:'r',arrowup:'f',arrowdown:'b',arrowleft:'tl',arrowright:'tr'}[ch]||{KeyW:'f',KeyS:'b',KeyA:'l',KeyD:'r'}[e.code];if(k&&AT.mode==='fp'&&!e.ctrlKey&&!e.metaKey){AT.keys[k]=e.type==='keydown';e.preventDefault();}if(e.type==='keydown'&&e.key==='Escape') closeAtelier();};
  document.addEventListener('keydown',AT.onKey);document.addEventListener('keyup',AT.onKey);
  requestAnimationFrame(atFrame);
}
function closeAtelier(){
  if(!AT) return;const a=AT;AT=null;
  document.removeEventListener('keydown',a.onKey);document.removeEventListener('keyup',a.onKey);window.removeEventListener('blur',a.onBlur);
  try{a.A.scene.traverse(o=>{if(o.geometry) o.geometry.dispose();});a.A.renderer.dispose();a.A.renderer.forceContextLoss();}catch(e){}
  try{for(const n of a.amb||[]) n.stop();}catch(e){}
  a.ov.remove();document.body.classList.remove('lfx-on');fxStop();
}
// ── décor : hall d'usine, établis, support moteur, ingénieur
function atBuildScene(){
  const {A,T}=AT,sc=A.scene,M3=(c,r,m)=>new T.MeshStandardMaterial({color:c,roughness:r==null?.8:r,metalness:m||0});
  const box=(w,h,d,mat,x,y,z,par)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);(par||sc).add(m);return m;};
  sc.background=new T.Color(0x1a2029);sc.fog=new T.Fog(0x1a2029,7000,16000);
  // sol en béton avec marquage
  const fc=document.createElement('canvas');fc.width=fc.height=256;{const g=fc.getContext('2d');g.fillStyle='#6f757c';g.fillRect(0,0,256,256);for(let i=0;i<900;i++){g.fillStyle=`rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()<.5?0:255},.03)`;g.fillRect(Math.random()*256,Math.random()*256,3,3);}g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=2;g.strokeRect(0,0,256,256);}
  const ft=new T.CanvasTexture(fc);ft.wrapS=ft.wrapT=T.RepeatWrapping;ft.repeat.set(8,8);
  const floor=new T.Mesh(new T.PlaneGeometry(16000,16000),new T.MeshStandardMaterial({map:ft,roughness:.9}));floor.rotation.x=-Math.PI/2;sc.add(floor);
  const yel=M3(0xf2b705,.7);for(const [w,d,x,z] of [[5200,80,0,2700],[5200,80,0,-2700],[80,5400,2600,0],[80,5400,-2600,0]]) box(w,4,d,yel,x,3,z);
  // murs, poteaux, verrière
  const wall=M3(0x8b949e,.9),steel=M3(0x3b4350,.6,.5);
  box(16000,5200,200,wall,0,2600,-6000);box(200,5200,16000,wall,-7000,2600,0);box(200,5200,16000,wall,7000,2600,0);box(16000,5200,200,wall,0,2600,6500);
  for(let x=-6000;x<=6000;x+=3000){if(x) box(220,5200,220,steel,x,2600,-5850);box(16000,160,160,steel,0,5000,x*.9);}
  for(let x=-4500;x<=4500;x+=3000) box(1800,1400,40,new T.MeshStandardMaterial({color:0xbfe3ff,emissive:0x9fd0ff,emissiveIntensity:.55,roughness:.2}),x,3600,-5880);
  // éclairage d'atelier
  for(const [x,z] of [[0,0],[-2600,-1500],[2600,-1500],[0,2400]]){box(1500,60,220,new T.MeshStandardMaterial({color:0xffffff,emissive:0xfff3d6,emissiveIntensity:1}),x,4300,z);const l=new T.PointLight(0xfff0d0,.22,9000,1.6);l.position.set(x,4100,z);sc.add(l);}
  // bannière au nom du constructeur
  const bc=document.createElement('canvas');bc.width=1024;bc.height=160;{const g=bc.getContext('2d');g.fillStyle='#10233d';g.fillRect(0,0,1024,160);g.fillStyle='#ffb800';g.fillRect(0,0,1024,10);g.fillRect(0,150,1024,10);g.fillStyle='#f6f8fa';g.font='700 78px "Barlow Condensed","Arial Narrow",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(((typeof G!=='undefined'&&G)?G.co:'Bureau d\'Études Auto').toUpperCase().slice(0,26),512,84);}
  const ban=new T.Mesh(new T.PlaneGeometry(5200,810),new T.MeshBasicMaterial({map:new T.CanvasTexture(bc)}));ban.position.set(0,2500,-5890);sc.add(ban);
  // établis (gauche et droite) et palettes du fond
  const wood=M3(0x8a6a45,.8),leg=M3(0x2b3038,.6,.4);
  AT.benches=[];
  for(const sx of [-1,1]){box(900,60,3600,wood,sx*2300,870,-300);for(const z of [-1900,1300]) for(const dx of [-380,380]) box(70,840,70,leg,sx*2300+dx,420,z);box(900,40,3600,leg,sx*2300,300,-300);box(60,1500,3600,M3(0x4a5361,.7),sx*2760,1650,-300);AT.benches.push({x:sx*2300,z0:-1900,z1:1300});}
  const pal=M3(0x9b7b52,.9);for(let i=0;i<5;i++) box(1050,140,850,pal,-2400+i*1200,70,-2500);
  // caisse à outils et bidon d'huile
  box(700,900,450,M3(0xc0392b,.5,.3),1500,450,1900);for(let i=0;i<4;i++) box(640,12,20,M3(0xdadfe5,.3,.8),1500,200+i*200,2130);
  // support moteur
  const st=new T.Group();sc.add(st);const red=M3(0xb3261e,.5,.3);
  box(1300,80,120,red,0,40,-520,st);box(120,80,1100,red,-560,40,0,st);box(120,80,1100,red,560,40,0,st);box(120,900,120,red,0,490,-520,st);box(160,160,420,steel,0,900,-330,st);
  for(const [x,z] of [[-560,520],[560,520],[-560,-520],[560,-520]]){const w=new T.Mesh(new T.CylinderGeometry(60,60,50,16),M3(0x1a1c20,.9));w.rotation.z=Math.PI/2;w.position.set(x,60,z);st.add(w);}
  // ingénieur : épaules, coudes, genoux, gants, lunettes, bandes réfléchissantes, clé en main
  const eng=new T.Group(),blue=M3(0x1f4e8c,.85),blue2=M3(0x183d6e,.85),skin=M3(0xe0b08a,.7),dark=M3(0x20242b,.8),hiv=M3(0xe9f24a,.5),glove=M3(0x3a3f47,.9),capM=M3(0xffb800,.6);
  box(410,560,230,blue,0,1190,0,eng);box(430,90,240,dark,0,925,0,eng);box(60,60,30,M3(0xc9ced6,.3,.8),0,925,125,eng);
  for(const y of [1050,1330]) box(416,36,236,hiv,0,y,0,eng);box(120,110,12,blue2,-110,1300,118,eng);box(90,50,14,M3(0xf6f8fa,.6),110,1320,118,eng);
  box(130,90,130,skin,0,1500,0,eng);
  const headG=new T.Group();headG.position.set(0,1640,0);eng.add(headG);
  {const h=new T.Mesh(new T.SphereGeometry(122,20,16),skin);headG.add(h);const cp=new T.Mesh(new T.SphereGeometry(128,20,10,0,Math.PI*2,0,Math.PI/2),capM);cp.position.y=18;headG.add(cp);box(190,16,130,capM,0,30,150,headG);
   box(210,46,20,M3(0x10151c,.2,.3),0,-8,112,headG);box(30,60,40,skin,0,-40,118,headG);for(const sx of [-1,1]) box(26,60,40,skin,sx*122,-10,0,headG);}
  const mkArm=sx=>{const sh=new T.Group();sh.position.set(sx*262,1440,0);eng.add(sh);box(112,300,120,blue,0,-150,0,sh);const el=new T.Group();el.position.y=-300;sh.add(el);box(100,270,108,blue,0,-135,0,el);box(104,30,112,hiv,0,-70,0,el);box(96,110,104,glove,0,-320,0,el);box(40,60,104,glove,sx*-50,-300,20,el);return {sh,el};};
  const mkLeg=sx=>{const hp=new T.Group();hp.position.set(sx*105,890,0);eng.add(hp);box(150,430,160,blue2,0,-215,0,hp);const kn=new T.Group();kn.position.y=-430;hp.add(kn);box(134,380,144,blue2,0,-190,0,kn);box(138,30,148,hiv,0,-300,0,kn);box(140,90,250,dark,0,-420,45,kn);return {hp,kn};};
  const aL=mkArm(-1),aR=mkArm(1),lL=mkLeg(-1),lR=mkLeg(1);
  // clé dynamométrique tenue pendant le serrage
  const wr=new T.Group();{const st=M3(0xc9ced6,.25,.9);const sh=new T.Mesh(new T.CylinderGeometry(12,12,420,10),st);sh.rotation.x=Math.PI/2;sh.position.z=210;wr.add(sh);const hd=new T.Mesh(new T.CylinderGeometry(30,30,46,12),st);hd.position.z=420;wr.add(hd);const gr=new T.Mesh(new T.CylinderGeometry(19,19,150,10),M3(0xb3261e,.6));gr.rotation.x=Math.PI/2;gr.position.z=60;wr.add(gr);}
  wr.position.set(0,-330,20);wr.visible=false;aR.el.add(wr);
  AT.eng={g:eng,la:aL.sh,ra:aR.sh,le:aL.el,re:aR.el,ll:lL.hp,rl:lR.hp,lk:lL.kn,rk:lR.kn,head:headG,wr,carry:null,pos:new T.Vector3(0,0,950),tgt:new T.Vector3(0,0,950)};
  eng.position.copy(AT.eng.pos);sc.add(eng);
  sc.add(A.cam);sc.traverse(o=>{if(o.isHemisphereLight) o.intensity=.55;else if(o.isDirectionalLight) o.intensity*=.6;});A.renderer.toneMapping=T.ACESFilmicToneMapping;A.renderer.toneMappingExposure=.95;
  A.cam.fov=58;A.cam.near=20;A.cam.far=30000;A.cam.updateProjectionMatrix();
}
// ── pièces : un groupe par pièce, rangé sur un établi, et la liste des étapes
function atBuildSteps(){
  const {A,T}=AT,root=A.root;
  root.position.set(0,1080,0);root.updateMatrixWorld(true);
  const parts=[];
  for(const p of A.parts){if(!p.meshes.length) continue;const g=new T.Group();root.add(g);for(const m of p.meshes) g.attach(m);
    const bb=new T.Box3().setFromObject(g),size=bb.getSize(new T.Vector3()),ctr=bb.getCenter(new T.Vector3());
    {const px=new T.Mesh(new T.BoxGeometry(Math.max(60,size.x),Math.max(60,size.y),Math.max(60,size.z)),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));px.position.copy(root.worldToLocal(ctr.clone()));px.userData.proxy=1;g.add(px);}
    const r=atRank(p.name);parts.push({name:p.name,desc:p.desc,g,size,ctr,rank:r[0],info:r,placed:false,off:new T.Vector3()});}
  if(!M.E.rot) atExtraParts(parts);
  parts.sort((a,b)=>a.rank-b.rank);
  // rangement : grosses pièces sur les palettes du fond, les autres sur les établis
  let iBig=0;const cur=[0,0,0,0],inv=new T.Matrix4().copy(root.matrixWorld).invert();
  for(const p of parts){
    if(p.rank===0){p.placed=true;continue;}
    const big=Math.max(p.size.x,p.size.z)>620||p.size.y>520;let slot;
    if(p.rank===23){slot=new T.Vector3(1500,930+p.size.y/2,1900);}
    else if(big){slot=new T.Vector3(-2400+(iBig%5)*1200,150+p.size.y/2+Math.floor(iBig/5)*600,-2500);iBig++;}
    else{let best=0;for(let c=1;c<4;c++) if(cur[c]<cur[best]) best=c;const need=p.size.z+90;
      if(cur[best]+need>3350){slot=new T.Vector3(-2400+(iBig%5)*1200,150+p.size.y/2+Math.floor(iBig/5)*600,-2500+((iBig%2)?200:-150));iBig++;}
      else{const bn=AT.benches[best>>1];slot=new T.Vector3(bn.x+((best%2)?-215:215),905+p.size.y/2,bn.z0+120+cur[best]+p.size.z/2);cur[best]+=need;}}
    // décalage exprimé dans le repère du moteur
    const d=slot.clone().sub(p.ctr);p.off.copy(d).applyMatrix4(new T.Matrix4().extractRotation(inv));p.g.position.copy(p.off);
  }
  // étapes : une par pièce, culasse et soupapes ensemble
  const steps=[];
  for(const p of parts){if(p.rank===0) continue;const last=steps[steps.length-1];if(last&&p.rank===6&&last.rank===6){last.parts.push(p);continue;}steps.push({rank:p.rank,parts:[p],info:p.info,bolts:p.info[4]});}
  // une seule série de vis par rang
  const seen={};for(const s of steps){if(s.bolts&&seen[s.rank]) s.bolts=0;seen[s.rank]=1;}
  AT.parts=parts;AT.steps=steps;for(const q of parts) q.px=q.g.children.find(c=>c.userData.proxy);
  const oil=parts.find(p=>p.rank===23);if(oil) oil.g.visible=false;
  // fantôme et balise
  AT.ghost=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:0xffb800,transparent:true,opacity:.28,depthWrite:false}));AT.ghost.visible=false;A.scene.add(AT.ghost);
  AT.beacon=new T.Mesh(new T.CylinderGeometry(60,60,2600,16,1,true),new T.MeshBasicMaterial({color:0xffb800,transparent:true,opacity:.35,side:T.DoubleSide,depthWrite:false}));AT.beacon.visible=false;A.scene.add(AT.beacon);
}
const atStep=()=>AT.steps[AT.step];
function atHUD(msg){
  const ov=AT.ov,s=atStep(),fp=AT.mode==='fp';
  $('#atlTake',ov).hidden=fp||AT.done;$('#atlGive',ov).hidden=!fp||AT.done;$('#atlHint',ov).hidden=!fp||AT.done;$('#atlPad',ov).hidden=!fp;$('#atlSpd',ov).hidden=fp;
  ov.classList.toggle('atl-fp',fp);
  $('#atlProg',ov).style.width=(AT.done?100:AT.step/AT.steps.length*100).toFixed(1)+'%';
  if(AT.done){$('#atlCount',ov).textContent='Montage terminé';return;}
  $('#atlCount',ov).textContent=`Étape ${AT.step+1} sur ${AT.steps.length}`;
  $('#atlTitle',ov).textContent=s.parts.map(p=>p.name).join(' et ');
  $('#atlText',ov).textContent=s.info[2];
  $('#atlTool',ov).textContent=`Outil : ${s.info[3]}${s.info[5]?` · couple de serrage : ${s.info[5]}`:''}`;
  if(msg!==undefined) $('#atlMsg',ov).textContent=msg;
}
function atSetMode(m){
  if(!AT||AT.done) return;
  // remettre en place une pièce en cours de transport
  const s=atStep();for(const p of s.parts) if(!p.placed){p.g.scale.setScalar(1);if(p.g.parent!==AT.A.root) AT.A.root.attach(p.g);p.g.position.copy(p.off);p.g.rotation.set(0,0,0);}
  AT.held=null;AT.phase=0;AT.ph=0;AT.bp=null;AT.eng.carry=null;atClearBolts();AT.ghost.visible=false;AT.beacon.visible=false;
  AT.mode=m;AT.eng.g.visible=m==='cine';
  if(m==='fp'){const tall=AT.cv.clientHeight>AT.cv.clientWidth;AT.pos.set(0,1650,tall?2300:2100);AT.yaw=0;AT.pitch=tall?-.42:-.16;AT.t0=performance.now();}
  atHUD(m==='fp'?'À vous : touchez la bonne pièce sur un établi pour la prendre, puis touchez le moteur pour la poser. Glissez pour regarder. Marchez avec Z Q S D (ou les flèches à l\'écran) ; ← → tournent la tête.':'');
}
function atWorldCtr(p){return p.ctr.clone().add(p.g.parent===AT.A.root?p.g.position.clone().applyMatrix4(new AT.T.Matrix4().extractRotation(AT.A.root.matrixWorld)):new AT.T.Vector3());}
function atPlace(step){
  for(const p of step.parts){if(p.g.parent!==AT.A.root) AT.A.root.attach(p.g);p.g.scale.setScalar(1);p.g.rotation.set(0,0,0);p.g.position.set(0,0,0);p.placed=true;p.g.visible=true;}
  atSnd('place');
}
function atNext(){
  AT.step++;AT.phase=0;AT.ph=0;AT.held=null;AT.ghost.visible=false;AT.beacon.visible=false;
  if(AT.step>=AT.steps.length){atFinish();return;}
  atHUD('');
}
function atFinish(){
  AT.done=true;atSnd('done');setTimeout(()=>{if(AT) atSnd('start');},700);
  const sec=Math.round((performance.now()-AT.t0)/1000),fp=AT.mode==='fp';
  const note=fp?clamp(Math.round(20-AT.errs*1.2-Math.max(0,sec-AT.steps.length*14)/30),4,20):null;
  AT.eng.g.visible=true;AT.eng.tgt.set(900,0,1300);
  $('#atlTitle',AT.ov).textContent='Premier démarrage réussi';
  $('#atlText',AT.ov).textContent=fp?`Vous avez monté le moteur en ${Math.floor(sec/60)} min ${sec%60} s avec ${AT.errs} erreur${AT.errs>1?'s':''}. Note de l'atelier : ${note}/20.`:`L'ingénieur a monté les ${AT.parts.length} pièces de votre moteur. Il est enregistré dans « Mes moteurs ».`;
  $('#atlTool',AT.ov).textContent='';$('#atlMsg',AT.ov).textContent='Le moteur tourne au banc de rodage. Fermez l\'atelier pour revenir au bureau d\'études.';
  atHUD();AT.mode='cine';AT.ov.classList.remove('atl-fp');$('#atlPad',AT.ov).hidden=true;
}
// ── vis à serrer
function atMakeBolts(step){
  const {T,A}=AT,p=step.parts[0],n=step.bolts,bb=new T.Box3();for(const q of step.parts) bb.expandByObject(q.g);
  const c=bb.getCenter(new T.Vector3()),sz=bb.getSize(new T.Vector3()),ring=step.rank===20||step.rank===4;
  AT.bolts=[];const pts=[];
  if(ring){const r=Math.min(sz.y,sz.z>sz.x?sz.z:sz.x)*.3;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;pts.push(new T.Vector3(c.x+(sz.x<sz.z?sz.x/2+20:Math.cos(a)*r),c.y+Math.sin(a)*r,c.z+(sz.x<sz.z?Math.cos(a)*r:sz.z/2+20)));}}
  else if(step.rank===5){for(let i=0;i<n;i++) pts.push(new T.Vector3(c.x+((i+.5)/n-.5)*sz.x*.92,bb.max.y-18,bb.max.z+16));}
  else{const long=sz.x>=sz.z,rows=2,per=n/rows;for(let j=0;j<rows;j++) for(let i=0;i<per;i++){const u=(i+.5)/per-.5,v=(j?.32:-.32);pts.push(new T.Vector3(c.x+(long?u*sz.x*.9:v*sz.x),step.rank===5?bb.min.y-10:bb.max.y+14,c.z+(long?v*sz.z:u*sz.z*.9)));}}
  // ordre de serrage : en étoile pour une couronne, en spirale depuis le centre sinon
  let order=pts.map((_,i)=>i);
  if(ring){const o=[];for(let i=0;i<n;i++) o.push((i*Math.floor(n/2+1))%n);order=[...new Set(o)];for(let i=0;i<n;i++) if(!order.includes(i)) order.push(i);}
  else order.sort((a,b)=>pts[a].distanceTo(c)-pts[b].distanceTo(c));
  order.forEach((pi,k)=>{const cvs=document.createElement('canvas');cvs.width=cvs.height=64;const g=cvs.getContext('2d');g.fillStyle='#ffb800';g.beginPath();g.arc(32,32,30,0,7);g.fill();g.fillStyle='#10233d';g.font='700 38px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(k+1,32,35);
    const sp=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(cvs),depthTest:false}));sp.scale.set(95,95,1);sp.position.copy(pts[pi]);sp.renderOrder=5;A.scene.add(sp);sp.updateMatrixWorld(true);AT.bolts.push({sp,k,done:false});});
  AT.boltI=0;
}
function atClearBolts(){for(const b of AT.bolts){AT.A.scene.remove(b.sp);b.sp.material.map.dispose();b.sp.material.dispose();}AT.bolts=[];}
function atBoltHead(pos){const T=AT.T,m=new T.Mesh(new T.CylinderGeometry(15,15,14,6),AT.boltMat||(AT.boltMat=new T.MeshStandardMaterial({color:0xd5dae0,metalness:.9,roughness:.3})));m.position.copy(pos);m.castShadow=true;AT.A.scene.add(m);const w=new T.Mesh(new T.CylinderGeometry(21,21,4,12),AT.boltMat);w.position.copy(pos);w.position.y-=8;AT.A.scene.add(w);}
function atBolt(b){b.done=true;atBoltHead(b.sp.position);b.sp.visible=false;AT.boltI++;AT.wrT=.3;atSnd('bolt');if(AT.boltI>=AT.bolts.length){atClearBolts();AT.fpWr.visible=false;atNext();}}
// ── première personne : toucher une pièce, le moteur ou une vis
function atTap(x,y){
  if(!AT||AT.done) return;
  const {T,A}=AT,r=AT.cv.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,-((y-r.top)/r.height*2-1)),A.cam);
  const s=atStep();
  if(AT.phase===2){const hits=ray.intersectObjects(AT.bolts.filter(b=>!b.done).map(b=>b.sp));if(!hits.length) return;const want=AT.bolts.find(q=>q.k===AT.boltI),hit=hits.find(h=>h.object===want.sp)||hits[0],b=AT.bolts.find(q=>q.sp===hit.object);
    if(b.k===AT.boltI) atBolt(b);else{AT.errs++;atSnd('err');$('#atlMsg',AT.ov).textContent=`Respectez l'ordre de serrage : vis n° ${AT.boltI+1} d'abord, sinon la pièce se déforme.`;}return;}
  if(!AT.held){
    const cand=AT.parts.filter(p=>!p.placed&&p.g.visible!==false||(!p.placed&&p.rank===23));let best=null,bd=1e9;
    for(const p of cand){p.g.visible=true;const h=ray.intersectObject(p.g,true)[0];if(p.rank===23&&AT.steps[AT.step].rank!==23) p.g.visible=false;if(h&&h.distance<bd){bd=h.distance;best=p;}}
    for(const p of s.parts){p.g.visible=true;if(ray.intersectObject(p.g,true).length){best=p;break;}}
    if(!best){$('#atlMsg',AT.ov).textContent='Touchez une pièce posée sur un établi ou une palette.';return;}
    if(!s.parts.includes(best)){AT.errs++;atSnd('err');$('#atlMsg',AT.ov).textContent=`Pas encore « ${best.name} » : il faut d'abord monter « ${s.parts[0].name} ».`;return;}
    // prise en main : toutes les pièces de l'étape suivent
    AT.held=s;atSnd('pick');AT.beacon.visible=false;
    AT.fpHands.visible=true;
    for(const p of s.parts){A.cam.attach(p.g);const k=Math.min(1,330/Math.max(p.size.x,p.size.y,p.size.z));p.g.scale.setScalar(k);p.g.position.set(290,-170,-820).sub(p.ctr.clone().sub(s.parts[0].ctr).multiplyScalar(k));p.g.position.sub(new T.Vector3());p.g.rotation.set(.2,.5,0);}
    // recentrer : la pièce tenue est ramenée devant la main
    for(const p of s.parts){const bb=new T.Box3().setFromObject(p.g),c=A.cam.worldToLocal(bb.getCenter(new T.Vector3()));p.g.position.add(new T.Vector3(290,-170,-820).sub(c));}
    const bb=new T.Box3();for(const p of s.parts){bb.expandByPoint(p.ctr.clone().add(p.size.clone().multiplyScalar(.5)));bb.expandByPoint(p.ctr.clone().sub(p.size.clone().multiplyScalar(.5)));}
    AT.ghost.scale.copy(bb.getSize(new T.Vector3()).addScalar(30));AT.ghost.position.copy(bb.getCenter(new T.Vector3()));AT.ghost.visible=true;AT.ghost.updateMatrixWorld(true);
    $('#atlMsg',AT.ov).textContent=`Vous tenez « ${s.parts[0].name} ». Touchez la zone jaune sur le moteur pour la poser.`;return;
  }
  // pose : il faut viser le moteur
  const tg=[AT.ghost,...AT.parts.filter(p=>p.placed).map(p=>p.g)];
  if(!ray.intersectObjects(tg,true).length){$('#atlMsg',AT.ov).textContent='Visez le moteur (zone jaune) pour poser la pièce.';return;}
  for(const p of s.parts){A.root.attach(p.g);p.from={p:p.g.position.clone(),q:p.g.quaternion.clone(),s:p.g.scale.x};}
  AT.held=null;AT.ghost.visible=false;AT.phase=5;AT.ph=0;AT.fpHands.visible=false;
}
function atAfterPlace(s){
  atPlace(s);for(const p of s.parts) p.from=null;
  if(s.bolts){AT.phase=2;atMakeBolts(s);AT.fpWr.visible=true;$('#atlMsg',AT.ov).textContent=`Serrez les ${s.bolts} vis dans l'ordre des numéros, à ${s.info[5]}.`;}
  else atNext();
}
function atHint(){const s=atStep();if(!s||AT.held||AT.phase===2) return;AT.errs+=.5;const c=new AT.T.Box3().setFromObject(s.parts[0].g).getCenter(new AT.T.Vector3());AT.beacon.position.set(c.x,1300,c.z);AT.beacon.visible=true;$('#atlMsg',AT.ov).textContent=`La pièce à prendre est sous le faisceau jaune : « ${s.parts[0].name} ».`;}
// ── boucle d'animation
function atFrame(now){
  if(!AT) return;
  const {A,T}=AT,dt=Math.min(.1,(now-AT.last)/1000);AT.last=now;AT.t+=dt;
  const w=AT.cv.clientWidth,h=AT.cv.clientHeight;if(w&&h&&(w!==AT.w||h!==AT.h)){A.renderer.setSize(w,h,false);A.cam.aspect=w/h;A.cam.updateProjectionMatrix();AT.w=w;AT.h=h;}
  const e=AT.eng;
  if(AT.mode==='cine'&&!AT.done){
    // l'ingénieur : aller à l'établi, prendre, revenir, poser, serrer
    const s=atStep(),sp=AT.spd,p0=s.parts[0];AT.ph+=dt*sp;
    const benchPos=()=>{const c=new T.Box3().setFromObject(p0.g).getCenter(new T.Vector3());const dir=new T.Vector3(-c.x,0,-c.z).normalize();return new T.Vector3(c.x+dir.x*620,0,c.z+dir.z*620);};
    if(AT.phase===0){if(!AT.bp){AT.bp=benchPos();if(p0.rank===23) p0.g.visible=true;}e.tgt.copy(AT.bp);if(e.pos.distanceTo(e.tgt)<60){AT.phase=1;AT.ph=0;atSnd('pick');}}
    else if(AT.phase===1){e.carry=s;if(AT.ph>.35){e.tgt.set(0,0,930);if(e.pos.distanceTo(e.tgt)<60){AT.phase=3;AT.ph=0;}}}
    else if(AT.phase===3){// la pièce glisse des mains vers sa place
      const k=clamp(AT.ph/.45,0,1);for(const p of s.parts){if(p.g.parent!==A.root){A.root.attach(p.g);p.from=p.g.position.clone();}p.g.position.lerpVectors(p.from,new T.Vector3(0,0,0),k*k*(3-2*k));}
      if(k>=1){e.carry=null;atPlace(s);for(const p of s.parts) p.from=null;AT.phase=4;AT.ph=0;AT.bp=null;if(s.bolts){atMakeBolts(s);for(const b of AT.bolts) b.sp.visible=false;}}}
    else if(AT.phase===4){if(s.bolts&&AT.bolts.length){const n=Math.min(AT.bolts.length,Math.floor(AT.ph/.16));while(AT.boltI<n){const b=AT.bolts.find(x=>x.k===AT.boltI);atBoltHead(b.sp.position);AT.boltI++;atSnd('bolt');}if(AT.boltI>=AT.bolts.length&&AT.ph>AT.bolts.length*.16+.25){atClearBolts();atNext();}}
      else if(AT.ph>.3) atNext();}
    // pièce portée : devant le torse
    if(e.carry) for(const p of e.carry.parts){if(p.g.parent!==A.scene) A.scene.attach(p.g);const f=new T.Vector3(Math.sin(e.g.rotation.y),0,Math.cos(e.g.rotation.y));const want=e.pos.clone().add(f.multiplyScalar(330)).setY(1150);const c=new T.Box3().setFromObject(p.g).getCenter(new T.Vector3());p.g.position.add(want.sub(c).multiplyScalar(.35));}
  }
  // déplacement de l'ingénieur
  {const d=e.tgt.clone().sub(e.pos);d.y=0;const dist=d.length(),v=2600*AT.spd;if(dist>5){d.normalize();e.pos.addScaledVector(d,Math.min(dist,v*dt));{const rr=Math.hypot(e.pos.x,e.pos.z);if(rr<880&&rr>1){e.pos.x*=880/rr;e.pos.z*=880/rr;}}const ty=Math.atan2(d.x,d.z);let dy=ty-e.g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));e.g.rotation.y+=dy*Math.min(1,dt*10);const sw=Math.sin(AT.t*11*Math.min(2,AT.spd))*.6;e.ll.rotation.x=sw;e.rl.rotation.x=-sw;e.lk.rotation.x=Math.max(0,-sw)*1.1+.08;e.rk.rotation.x=Math.max(0,sw)*1.1+.08;e.g.position.y=Math.abs(Math.cos(AT.t*11*Math.min(2,AT.spd)))*18;}
    else{e.ll.rotation.x*=.8;e.rl.rotation.x*=.8;e.lk.rotation.x*=.8;e.rk.rotation.x*=.8;const ty=Math.atan2(-e.pos.x,-e.pos.z);let dy=ty-e.g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));e.g.rotation.y+=dy*Math.min(1,dt*8);}
    const work=AT.mode==='cine'&&AT.phase===4&&!AT.done,bolt=work&&atStep()&&atStep().bolts;
    const up=e.carry?-.75:work?-.95:-.06,el=e.carry?-1.0:work?-.9:-.12;
    e.la.rotation.x+=(up-e.la.rotation.x)*.25;e.le.rotation.x+=(el-e.le.rotation.x)*.25;
    e.ra.rotation.x+=((work?-.9+Math.sin(AT.t*(bolt?9:16))*.22:up)-e.ra.rotation.x)*.25;e.re.rotation.x+=((work?-.8+Math.cos(AT.t*(bolt?9:16))*.3:el)-e.re.rotation.x)*.25;
    e.wr.visible=!!work;e.head.rotation.x+=(((e.carry||work)?.35:.05)-e.head.rotation.x)*.15;
    const py=e.g.position.y;e.g.position.copy(e.pos);e.g.position.y=py*.9;}
  // moteur terminé : il tourne
  if(AT.done&&A.anim&&A.anim.crank){/* les pièces ont été détachées de l'animation d'origine : légère vibration du moteur */A.root.position.y=1080+Math.sin(AT.t*60)*1.2;}
  // caméra
  if(AT.mode==='fp'){
    const k=AT.keys,f=(k.f?1:0)-(k.b?1:0),sd=(k.r?1:0)-(k.l?1:0);AT.yaw+=((k.tl?1:0)-(k.tr?1:0))*1.9*dt;
    if((f||sd)&&AT.t-(AT.stepT||0)>.42){AT.stepT=AT.t;atSnd('step');}
    if(f||sd){const fw=new T.Vector3(-Math.sin(AT.yaw),0,-Math.cos(AT.yaw)),rt=new T.Vector3(Math.cos(AT.yaw),0,-Math.sin(AT.yaw));const nx=AT.pos.clone().addScaledVector(fw,f*1700*dt).addScaledVector(rt,sd*1500*dt);
      nx.x=clamp(nx.x,-1780,1780);nx.z=clamp(nx.z,-1950,3400);const rr=Math.hypot(nx.x,nx.z);if(rr<760){nx.x*=760/Math.max(rr,1);nx.z*=760/Math.max(rr,1);}AT.pos.x=nx.x;AT.pos.z=nx.z;AT.pos.y=1650+Math.sin(AT.t*9)*10;}
    else AT.pos.y+=(1650-AT.pos.y)*.2;
    A.cam.position.copy(AT.pos);A.cam.rotation.order='YXZ';A.cam.rotation.set(AT.pitch,AT.yaw,0);
    if(AT.ghost.visible) AT.ghost.material.opacity=.2+.15*Math.sin(AT.t*5);
    if(AT.phase===5){AT.ph+=dt;const s=atStep(),k=clamp(AT.ph/.38,0,1),u=k*k*(3-2*k),Q0=new T.Quaternion();for(const p of s.parts){if(!p.from) continue;p.g.position.lerpVectors(p.from.p,new T.Vector3(0,0,0),u);p.g.quaternion.copy(p.from.q).slerp(Q0,u);p.g.scale.setScalar(lerp(p.from.s,1,u));}if(k>=1) atAfterPlace(s);}
    AT.fpHands.visible=!!AT.held;AT.fpHands.position.y=-330+Math.sin(AT.t*2)*6;
    if(AT.fpWr.visible){AT.wrT=Math.max(0,(AT.wrT||0)-dt);AT.fpWr.rotation.z=-.5-Math.sin(clamp(AT.wrT/.3,0,1)*Math.PI)*.7;if(AT.phase!==2) AT.fpWr.visible=false;}
    if(now-(AT.lt||0)>110){AT.lt=now;atLabel();}
  }else{
    const a=Math.sin(AT.t*.16)*.62,R=AT.done?2500:3100;A.cam.position.set(Math.sin(a)*R,(AT.done?1650:1950)+Math.sin(AT.t*.11)*150,Math.cos(a)*R+250);A.cam.rotation.order='XYZ';A.cam.lookAt(e.pos.x*.3,1120,e.pos.z*.3);
  }
  A.renderer.render(A.scene,A.cam);
  requestAnimationFrame(atFrame);
}

// nom de la pièce regardée de près (au centre de l'écran, ou sous la souris)
function atLabel(){
  const lab=$('#atlLabel',AT.ov);if(!lab) return;
  if(AT.mode!=='fp'||AT.done){lab.hidden=true;return;}
  const {T,A}=AT,r=AT.cv.getBoundingClientRect(),m=AT.mouse,sx=m?m.x:r.left+r.width/2,sy=m?m.y:r.top+r.height/2;
  const ray=new T.Raycaster();ray.far=2600;ray.setFromCamera(new T.Vector2((sx-r.left)/r.width*2-1,-((sy-r.top)/r.height*2-1)),A.cam);
  let best=null,bd=1e9;const cur=atStep();
  for(const p of AT.parts){if(!p.px||(AT.held&&AT.held.parts.includes(p))||(p.rank===23&&!p.g.visible)) continue;const h=ray.intersectObject(p.px,false)[0];if(!h) continue;
    // une pièce posée est enveloppée par les autres : on préfère la plus petite boîte touchée
    const vol=p.size.x*p.size.y*p.size.z,sc=h.distance+Math.cbrt(vol)*.6;if(sc<bd){bd=sc;best=p;}}
  if(!best){lab.hidden=true;return;}
  const next=cur&&cur.parts.includes(best);
  lab.innerHTML=`<b>${best.name}</b>${best.desc?`<i>${String(best.desc).slice(0,110)}</i>`:''}<span>${best.placed?'Déjà montée':next?'À monter maintenant':'À monter plus tard'}</span>`;
  lab.className='atl-label'+(next?' nx':best.placed?' ok':'');lab.hidden=false;
  lab.style.left=clamp(sx-r.left,90,r.width-90)+'px';lab.style.top=Math.max(70,sy-r.top-54)+'px';
}

// ── pièces d'atelier supplémentaires : coussinets, pompe à huile, joint de culasse (moteurs à pistons en ligne ou en V)
function atExtraParts(parts){
  const {T,A}=AT,find=re=>parts.find(p=>re.test(p.name)),crk=find(/^Vilebrequin/),pan=find(/^Carter d'huile/),head=find(/^Culasse/),blk=find(/^Bloc-cylindres/);
  const mk=(name,desc,rank,build)=>{const g=new T.Group();A.root.add(g);build(g);g.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(g),size=bb.getSize(new T.Vector3()),ctr=bb.getCenter(new T.Vector3());
    const px=new T.Mesh(new T.BoxGeometry(Math.max(60,size.x),Math.max(60,size.y),Math.max(60,size.z)),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));px.position.copy(A.root.worldToLocal(ctr.clone()));px.userData.proxy=1;g.add(px);
    const info=AT_EXTRA[rank];parts.push({name,desc,g,size,ctr,rank,info,placed:false,off:new T.Vector3()});};
  const loc=v=>A.root.worldToLocal(v.clone());
  if(crk){const c=loc(crk.ctr),n=Math.max(3,Math.round(crk.size.x/95)),m=new T.MeshStandardMaterial({color:0xc9a227,metalness:.8,roughness:.3});
    mk('Coussinets de paliers','Demi-coquilles antifriction sur lesquelles tourne le vilebrequin, lubrifiées sous pression',.5,g=>{for(let i=0;i<n;i++){const t=new T.Mesh(new T.TorusGeometry(34,7,8,16,Math.PI),m);t.rotation.set(0,Math.PI/2,Math.PI);t.position.set(c.x-crk.size.x*.42+i*crk.size.x*.84/(n-1),c.y,c.z);g.add(t);}});}
  if(pan&&blk){const c=loc(pan.ctr),m=new T.MeshStandardMaterial({color:0x8c949c,metalness:.7,roughness:.4});
    mk('Pompe à huile et crépine','Aspire l\'huile au fond du carter et l\'envoie sous pression dans tout le moteur',4.5,g=>{const b=new T.Mesh(new T.BoxGeometry(90,60,80),m);b.position.set(c.x-pan.size.x*.3,c.y+pan.size.y*.3,c.z);g.add(b);const t=new T.Mesh(new T.CylinderGeometry(12,12,pan.size.y*.7,10),m);t.position.set(c.x-pan.size.x*.3+70,c.y,c.z);g.add(t);const cr=new T.Mesh(new T.CylinderGeometry(42,42,14,16),m);cr.position.set(c.x-pan.size.x*.3+70,c.y-pan.size.y*.32,c.z);g.add(cr);});}
  if(head&&blk&&M.E.c.lay==='I'){const hb=new T.Box3().setFromObject(head.g),c=loc(new T.Vector3(head.ctr.x,hb.min.y,head.ctr.z)),m=new T.MeshStandardMaterial({color:0x2f5d50,metalness:.3,roughness:.6});
    mk('Joint de culasse','Feuille multicouche qui assure l\'étanchéité entre le bloc et la culasse : gaz, eau et huile',5.5,g=>{const j=new T.Mesh(new T.BoxGeometry(head.size.x*.98,5,head.size.z*.9),m);j.position.set(c.x,c.y,c.z);g.add(j);const n=M.E.n,r=new T.MeshStandardMaterial({color:0xb8bec6,metalness:.9,roughness:.3});for(let i=0;i<n;i++){const o=new T.Mesh(new T.TorusGeometry(S.bore/2+3,3,6,20),r);o.rotation.x=Math.PI/2;o.position.set(c.x-head.size.x*.42+i*head.size.x*.84/Math.max(1,n-1),c.y+3,c.z);g.add(o);}});}
}
const AT_EXTRA={.5:[.5,null,'Essuyez les portées, posez les demi-coussinets dans le bloc et huilez-les généreusement.','Burette d\'huile',0,''],
  4.5:[4.5,null,'Vissez la pompe à huile et sa crépine, amorcée avec un peu d\'huile.','Clé à cliquet',0,'10 Nm'],
  5.5:[5.5,null,'Dégraissez les plans de joint et posez le joint de culasse neuf, repère « TOP » vers le haut.','Dégraissant',0,'']};
// ── détails du décor, ombres portées, mains du joueur
function atDetail(){
  const {A,T}=AT,sc=A.scene,M3=(c,r,m)=>new T.MeshStandardMaterial({color:c,roughness:r==null?.8:r,metalness:m||0});
  const box=(w,h,d,mat,x,y,z,par)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);(par||sc).add(m);return m;};
  const cyl=(r,h,mat,x,y,z,par)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,h,18),mat);m.position.set(x,y,z);(par||sc).add(m);return m;};
  const steel=M3(0xb9c1c9,.35,.8),dark=M3(0x23272e,.7,.3),yel=M3(0xf2b705,.6,.2),red=M3(0xb3261e,.5,.3);
  // panneaux d'outils dessinés au-dessus des établis
  const tc=document.createElement('canvas');tc.width=1024;tc.height=384;{const g=tc.getContext('2d');g.fillStyle='#55606e';g.fillRect(0,0,1024,384);g.fillStyle='rgba(0,0,0,.18)';for(let x=12;x<1024;x+=24) for(let y=12;y<384;y+=24){g.beginPath();g.arc(x,y,2.2,0,7);g.fill();}
    const tool=(x,col,f)=>{g.save();g.translate(x,0);g.fillStyle=col;g.strokeStyle=col;f();g.restore();};
    for(let i=0;i<9;i++) tool(40+i*52,'#d5dae0',()=>{const h=120+i*18;g.fillRect(-5,60,10,h);g.beginPath();g.arc(0,60,15,0,7);g.fill();g.fillStyle='#55606e';g.fillRect(-6,44,12,14);g.beginPath();g.fillStyle='#d5dae0';g.arc(0,60+h,12,0,7);g.fill();});
    for(let i=0;i<4;i++) tool(540+i*60,'#c0392b',()=>{g.fillRect(-7,150,14,150);g.fillStyle='#d5dae0';g.fillRect(-4,50,8,110);});
    tool(820,'#d5dae0',()=>{g.fillRect(-45,60,90,40);g.fillStyle='#8a6a45';g.fillRect(-8,100,16,200);});
    tool(910,'#d5dae0',()=>{g.lineWidth=10;g.beginPath();g.moveTo(-20,60);g.lineTo(6,200);g.moveTo(20,60);g.lineTo(-6,200);g.stroke();g.fillStyle='#1f4e8c';g.fillRect(-16,200,12,120);g.fillRect(4,200,12,120);});
    tool(980,'#f2b705',()=>{g.fillRect(-14,60,28,260);g.fillStyle='#10233d';for(let y=70;y<310;y+=14) g.fillRect(-14,y,14,2);});}
  const tt=new T.CanvasTexture(tc);for(const sx of [-1,1]){const pl=new T.Mesh(new T.PlaneGeometry(3400,1280),new T.MeshStandardMaterial({map:tt,roughness:.8}));pl.position.set(sx*2725,1700,-300);pl.rotation.y=-sx*Math.PI/2;sc.add(pl);}
  // étau sur l'établi de gauche, bacs à vis, chiffons
  {const g=new T.Group();g.position.set(-2560,900,1150);sc.add(g);box(150,40,220,dark,0,20,0,g);box(110,130,70,M3(0x2c5d8a,.5,.4),0,105,-60,g);box(110,130,50,M3(0x2c5d8a,.5,.4),0,105,50,g);const v=cyl(11,300,steel,0,95,120,g);v.rotation.x=Math.PI/2;const hd=cyl(8,170,steel,0,95,270,g);hd.rotation.z=Math.PI/2;}
  for(let i=0;i<4;i++){const c=[0xc0392b,0x2c7a4b,0x2c5d8a,0xf2b705][i];box(170,90,230,M3(c,.6),2600,945,-1750+i*260);box(150,6,210,M3(0xaab2bb,.3,.8),2600,985,-1750+i*260);}
  box(260,14,200,M3(0xd9d2c0,.95),-2600,907,-1650);
  // desserte à outils près du moteur, avec la clé dynamométrique
  {const g=new T.Group();g.position.set(1100,0,900);g.rotation.y=-.5;sc.add(g);box(620,30,420,red,0,820,0,g);box(620,30,420,red,0,430,0,g);for(const [x,z] of [[-290,-190],[290,-190],[-290,190],[290,190]]){box(30,800,30,dark,x,420,z,g);cyl(40,34,dark,x,40,z,g).rotation.z=Math.PI/2;}
    const w=cyl(11,420,steel,-60,848,40,g);w.rotation.z=Math.PI/2;cyl(26,40,steel,160,848,40,g);const gr=cyl(18,150,red,-200,848,40,g);gr.rotation.z=Math.PI/2;
    for(let i=0;i<7;i++) cyl(13+i*1.6,40,steel,-230+i*52,856,-110,g);box(420,10,70,dark,-70,838,-110,g);
    cyl(60,170,M3(0x1f4e8c,.5),200,520,60,g);cyl(22,60,dark,200,635,60,g);}
  // palan d'atelier jaune
  {const g=new T.Group();g.position.set(2000,0,-2400);g.rotation.y=-.7;sc.add(g);box(160,120,1900,yel,-520,60,400,g);box(160,120,1900,yel,520,60,400,g);box(1200,120,160,yel,0,60,-480,g);box(140,2300,140,yel,0,1200,-480,g);const arm=box(120,120,1700,yel,0,2350,300,g);arm.rotation.x=-.18;
    cyl(8,900,dark,0,2010,1100,g);const hk=new T.Mesh(new T.TorusGeometry(50,12,8,16,Math.PI*1.4),steel);hk.position.set(0,1520,1100);g.add(hk);const ram=cyl(45,900,steel,0,1500,-120,g);ram.rotation.x=.55;}
  // fûts d'huile, étagères de cartons, extincteur, panneau de sécurité
  for(let i=0;i<3;i++){const x=-5200+i*560;cyl(290,880,M3([0x1f4e8c,0x1f4e8c,0xb3261e][i],.5,.3),x,440,-5200);for(const y of [150,440,730]) cyl(296,26,dark,x,y,-5200);cyl(60,30,dark,x+120,890,-5200);}
  {const g=new T.Group();g.position.set(4600,0,-5300);sc.add(g);for(const x of [-900,0,900]) for(const z of [-250,250]) box(60,2600,60,dark,x,1300,z,g);for(const y of [500,1250,2000]){box(1900,40,560,M3(0x6b7482,.6,.4),0,y,0,g);for(let i=0;i<4;i++) box(380,300+((i*37+y)%160),420,M3(0xb08a5a,.95),-680+i*450,y+170+((i*37+y)%160)/2,0,g);}}
  cyl(75,480,red,-2900,1250,-5700);cyl(30,90,dark,-2900,1530,-5700);
  {const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');g.fillStyle='#1f4e8c';g.fillRect(0,0,512,256);g.fillStyle='#fff';g.font='700 44px "Barlow Condensed","Arial Narrow",sans-serif';g.textAlign='center';g.fillText('LUNETTES ET GANTS',256,110);g.fillText('OBLIGATOIRES',256,170);g.strokeStyle='#fff';g.lineWidth=8;g.strokeRect(14,14,484,228);
    const pl=new T.Mesh(new T.PlaneGeometry(1500,750),new T.MeshBasicMaterial({map:new T.CanvasTexture(c)}));pl.position.set(-4000,2300,-5890);sc.add(pl);}
  // zone de travail hachurée sous le support
  {const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#f2b705';g.fillRect(0,0,256,256);g.fillStyle='#1c1f24';for(let i=-256;i<512;i+=44){g.beginPath();g.moveTo(i,0);g.lineTo(i+22,0);g.lineTo(i+22-256,256);g.lineTo(i-256,256);g.fill();}g.fillStyle='#7a8088';g.fillRect(20,20,216,216);
    const pl=new T.Mesh(new T.PlaneGeometry(2100,2100),new T.MeshStandardMaterial({map:new T.CanvasTexture(c),roughness:.9}));pl.rotation.x=-Math.PI/2;pl.position.y=5;sc.add(pl);}
  // suspensions lumineuses
  for(const [x,z] of [[0,600],[-2300,-300],[2300,-300]]){cyl(6,1500,dark,x,4500,z);const sh=new T.Mesh(new T.ConeGeometry(330,260,20,1,true),M3(0x2c3440,.5,.6));sh.material.side=T.DoubleSide;sh.position.set(x,3640,z);sc.add(sh);const b=new T.Mesh(new T.SphereGeometry(70,12,10),new T.MeshBasicMaterial({color:0xfff3d6}));b.position.set(x,3580,z);sc.add(b);}
  // ombres portées
  const tall=AT.cv.clientWidth<700;A.renderer.shadowMap.enabled=true;A.renderer.shadowMap.type=T.PCFSoftShadowMap;
  let sun=null;sc.traverse(o=>{if(o.isDirectionalLight&&!sun) sun=o;});
  if(sun){sun.position.set(2200,6200,2600);sun.castShadow=true;sun.shadow.mapSize.set(tall?1024:2048,tall?1024:2048);const c=sun.shadow.camera;c.left=-4600;c.right=4600;c.top=4600;c.bottom=-4600;c.near=500;c.far=14000;c.updateProjectionMatrix();sun.shadow.bias=-.0006;sun.intensity=.75;}
  sc.traverse(o=>{if(!o.isMesh||o.userData.proxy||o===AT.ghost||o===AT.beacon) return;const m=o.material;if(m&&(m.isMeshBasicMaterial||m.transparent)) return;o.castShadow=true;o.receiveShadow=true;});
  // mains gantées et clé dynamométrique du joueur, fixées à la caméra
  const gl=M3(0x3a3f47,.9),sl=M3(0x1f4e8c,.85);
  const hands=new T.Group();for(const sx of [-1,1]){box(110,120,260,sl,sx*250+330*.0,0,-560,hands).rotation.set(.5,sx*-.25,0);box(100,70,130,gl,sx*215,70,-700,hands).rotation.set(.3,sx*-.3,0);}
  hands.position.set(180,-430,0);hands.visible=false;A.cam.add(hands);AT.fpHands=hands;
  const wr=new T.Group();{const sh=cyl(11,560,steel,0,0,0,wr);sh.rotation.z=Math.PI/2;cyl(28,44,steel,-280,0,0,wr);const gr=cyl(19,170,red,220,0,0,wr);gr.rotation.z=Math.PI/2;box(100,70,120,gl,250,-10,20,wr);}
  wr.position.set(260,-250,-640);wr.rotation.set(.2,.5,-.5);wr.visible=false;A.cam.add(wr);AT.fpWr=wr;
}
// ── ambiance sonore de l'usine : ventilation et ronflement électrique
function atAmb(){
  const c=fxCtx();if(!c) return;if(!SFX.bus){const g=c.createGain();g.gain.value=.8;g.connect(c.destination);SFX.bus=g;}
  try{const src=c.createBufferSource();src.buffer=SFX.nb;src.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=210;const g=c.createGain();g.gain.value=.07;src.connect(f);f.connect(g);g.connect(SFX.bus);src.start();
    const o=c.createOscillator();o.frequency.value=100;const g2=c.createGain();g2.gain.value=.012;o.connect(g2);g2.connect(SFX.bus);o.start();AT.amb=[src,o];}catch(e){}
}
