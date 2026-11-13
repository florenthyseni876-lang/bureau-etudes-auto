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
  else if(kind==='err'){tone(o,t,.18,{type:'square',f:180,f2:120,g:.1,a:.005,lp:900});}
  else if(kind==='done'){for(const [f,d] of [[392,0],[523,.12],[659,.24],[784,.36]]) tone(o,t+d,.5,{type:'triangle',f,g:.14,a:.02});}
  else if(kind==='start'){for(let i=0;i<16;i++) nz(o,t+i*.07,.05,{type:'lowpass',f:500,g:.3,a:.004});tone(o,t+1.1,1.8,{type:'sawtooth',f:45,f2:110,glide:.9,g:.2,a:.15,hold:.8,lp:500,lq:2});nz(o,t+1.1,1.8,{type:'lowpass',f:320,g:.2,a:.2});}
}
function openAtelier(name){
  closeAtelier();
  const ov=el('div','atl');ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Atelier de montage du moteur');
  ov.innerHTML=`<canvas id="atlCv"></canvas>
   <div class="atl-top"><div><p class="eyebrow">Atelier de montage</p><b id="atlName"></b></div><div class="atl-btns"><button class="chip-btn" type="button" id="atlSpd">Vitesse ×1</button><button class="chip-btn" type="button" id="atlSnd" aria-pressed="${SFX.on}">${SFX.on?'Son activé':'Son coupé'}</button><button class="chip-btn" type="button" id="atlClose">Fermer</button></div></div>
   <div class="atl-cross" aria-hidden="true"></div>
   <div class="atl-pad" id="atlPad" hidden><button type="button" data-mv="f" aria-label="Avancer">▲</button><button type="button" data-mv="l" aria-label="Gauche">◀</button><button type="button" data-mv="b" aria-label="Reculer">▼</button><button type="button" data-mv="r" aria-label="Droite">▶</button></div>
   <div class="atl-hud"><div class="atl-step"><span class="eyebrow" id="atlCount"></span><b id="atlTitle"></b><p id="atlText"></p><p class="atl-tool" id="atlTool"></p></div>
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
  atBuildScene();atBuildSteps();atHUD();
  // interactions
  ov.addEventListener('click',e=>{const b=e.target.closest('button');if(!b) return;
    if(b.id==='atlClose') closeAtelier();
    else if(b.id==='atlSpd'){AT.spd=AT.spd>=4?1:AT.spd*2;b.textContent=`Vitesse ×${AT.spd}`;}
    else if(b.id==='atlSnd'){fxSetOn(!SFX.on);b.setAttribute('aria-pressed',SFX.on);b.textContent=SFX.on?'Son activé':'Son coupé';}
    else if(b.id==='atlTake') atSetMode('fp');
    else if(b.id==='atlGive') atSetMode('cine');
    else if(b.id==='atlHint') atHint();});
  let drag=null;
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY};try{cv.setPointerCapture(e.pointerId);}catch(err){}});
  cv.addEventListener('pointermove',e=>{if(!drag||!AT) return;if(AT.mode==='fp'){AT.yaw-=(e.clientX-drag.x)*.005;AT.pitch=clamp(AT.pitch-(e.clientY-drag.y)*.004,-1.1,.9);}drag.x=e.clientX;drag.y=e.clientY;});
  cv.addEventListener('pointerup',e=>{if(!drag||!AT) return;const moved=Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0);drag=null;if(moved<8&&AT.mode==='fp') atTap(e.clientX,e.clientY);});
  const pad=$('#atlPad',ov);for(const ev of ['pointerdown','pointerup','pointerleave','pointercancel']) pad.addEventListener(ev,e=>{const b=e.target.closest('[data-mv]');if(b&&AT) AT.keys[b.dataset.mv]=ev==='pointerdown';});
  AT.onKey=e=>{if(!AT) return;const k={ArrowUp:'f',KeyW:'f',KeyZ:'f',ArrowDown:'b',KeyS:'b',ArrowLeft:'l',KeyA:'l',KeyQ:'l',ArrowRight:'r',KeyD:'r'}[e.code];if(k){AT.keys[k]=e.type==='keydown';e.preventDefault();}if(e.type==='keydown'&&e.key==='Escape') closeAtelier();};
  document.addEventListener('keydown',AT.onKey);document.addEventListener('keyup',AT.onKey);
  requestAnimationFrame(atFrame);
}
function closeAtelier(){
  if(!AT) return;const a=AT;AT=null;
  document.removeEventListener('keydown',a.onKey);document.removeEventListener('keyup',a.onKey);
  try{a.A.scene.traverse(o=>{if(o.geometry) o.geometry.dispose();});a.A.renderer.dispose();a.A.renderer.forceContextLoss();}catch(e){}
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
  // ingénieur : silhouette articulée simple
  const eng=new T.Group(),blue=M3(0x1f4e8c,.8),skin=M3(0xe0b08a,.7),dark=M3(0x20242b,.8);
  const torso=box(420,620,240,blue,0,1180,0,eng),head=new T.Mesh(new T.SphereGeometry(125,18,14),skin);head.position.set(0,1640,0);eng.add(head);
  const cap=new T.Mesh(new T.CylinderGeometry(132,132,70,18),M3(0xffb800,.6));cap.position.set(0,1730,0);eng.add(cap);box(200,20,120,M3(0xffb800,.6),0,1700,130,eng);
  const mkLimb=(x,y,len,mat)=>{const g=new T.Group();g.position.set(x,y,0);const m=new T.Mesh(new T.BoxGeometry(120,len,130),mat);m.position.y=-len/2;g.add(m);eng.add(g);return g;};
  AT.eng={g:eng,la:mkLimb(-275,1470,600,blue),ra:mkLimb(275,1470,600,blue),ll:mkLimb(-110,880,860,dark),rl:mkLimb(110,880,860,dark),carry:null,pos:new T.Vector3(0,0,950),tgt:new T.Vector3(0,0,950)};
  for(const a of [AT.eng.la,AT.eng.ra]){const h=new T.Mesh(new T.SphereGeometry(70,10,8),skin);h.position.y=-620;a.add(h);}
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
  AT.parts=parts;AT.steps=steps;
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
  atHUD(m==='fp'?'À vous : touchez la bonne pièce sur un établi pour la prendre, puis touchez le moteur pour la poser. Glissez pour regarder, flèches pour marcher.':'');
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
function atBolt(b){b.done=true;b.sp.material.color.set(0x35c26b);b.sp.scale.set(70,70,1);AT.boltI++;atSnd('bolt');if(AT.boltI>=AT.bolts.length){atClearBolts();atNext();}}
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
    for(const p of s.parts){A.cam.attach(p.g);const k=Math.min(1,330/Math.max(p.size.x,p.size.y,p.size.z));p.g.scale.setScalar(k);p.g.position.set(330,-300,-850).sub(p.ctr.clone().sub(s.parts[0].ctr).multiplyScalar(k));p.g.position.sub(new T.Vector3());p.g.rotation.set(.2,.5,0);}
    // recentrer : la pièce tenue est ramenée devant la main
    for(const p of s.parts){const bb=new T.Box3().setFromObject(p.g),c=A.cam.worldToLocal(bb.getCenter(new T.Vector3()));p.g.position.add(new T.Vector3(330,-300,-850).sub(c));}
    const bb=new T.Box3();for(const p of s.parts){bb.expandByPoint(p.ctr.clone().add(p.size.clone().multiplyScalar(.5)));bb.expandByPoint(p.ctr.clone().sub(p.size.clone().multiplyScalar(.5)));}
    AT.ghost.scale.copy(bb.getSize(new T.Vector3()).addScalar(30));AT.ghost.position.copy(bb.getCenter(new T.Vector3()));AT.ghost.visible=true;AT.ghost.updateMatrixWorld(true);
    $('#atlMsg',AT.ov).textContent=`Vous tenez « ${s.parts[0].name} ». Touchez la zone jaune sur le moteur pour la poser.`;return;
  }
  // pose : il faut viser le moteur
  const tg=[AT.ghost,...AT.parts.filter(p=>p.placed).map(p=>p.g)];
  if(!ray.intersectObjects(tg,true).length){$('#atlMsg',AT.ov).textContent='Visez le moteur (zone jaune) pour poser la pièce.';return;}
  if(AT.pos.distanceTo(new T.Vector3(0,1650,0))>2600){$('#atlMsg',AT.ov).textContent='Approchez-vous du moteur pour poser la pièce.';return;}
  atPlace(s);AT.held=null;AT.ghost.visible=false;
  if(s.bolts){AT.phase=2;atMakeBolts(s);$('#atlMsg',AT.ov).textContent=`Serrez les ${s.bolts} vis dans l'ordre des numéros, à ${s.info[5]}.`;}
  else atNext();
}
function atHint(){const s=atStep();if(!s||AT.held||AT.phase===2) return;AT.errs+=.5;const c=new AT.T.Box3().setFromObject(s.parts[0].g).getCenter(new AT.T.Vector3());AT.beacon.position.set(c.x,1300,c.z);AT.beacon.visible=true;$('#atlMsg',AT.ov).textContent=`La pièce à prendre est sous le faisceau jaune : « ${s.parts[0].name} ».`;}
// ── boucle d'animation
function atFrame(now){
  if(!AT) return;
  const {A,T}=AT,dt=Math.min(.05,(now-AT.last)/1000);AT.last=now;AT.t+=dt;
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
      if(k>=1){e.carry=null;atPlace(s);for(const p of s.parts) p.from=null;AT.phase=4;AT.ph=0;AT.bp=null;if(s.bolts) atSnd('bolt');}}
    else if(AT.phase===4){if(AT.ph>(s.bolts?.7:.25)) atNext();}
    // pièce portée : devant le torse
    if(e.carry) for(const p of e.carry.parts){if(p.g.parent!==A.scene) A.scene.attach(p.g);const f=new T.Vector3(Math.sin(e.g.rotation.y),0,Math.cos(e.g.rotation.y));const want=e.pos.clone().add(f.multiplyScalar(330)).setY(1150);const c=new T.Box3().setFromObject(p.g).getCenter(new T.Vector3());p.g.position.add(want.sub(c).multiplyScalar(.35));}
  }
  // déplacement de l'ingénieur
  {const d=e.tgt.clone().sub(e.pos);d.y=0;const dist=d.length(),v=2600*AT.spd;if(dist>5){d.normalize();e.pos.addScaledVector(d,Math.min(dist,v*dt));const ty=Math.atan2(d.x,d.z);let dy=ty-e.g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));e.g.rotation.y+=dy*Math.min(1,dt*10);const sw=Math.sin(AT.t*11*Math.min(2,AT.spd))*.55;e.ll.rotation.x=sw;e.rl.rotation.x=-sw;}
    else{e.ll.rotation.x*=.8;e.rl.rotation.x*=.8;const ty=Math.atan2(-e.pos.x,-e.pos.z);let dy=ty-e.g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));e.g.rotation.y+=dy*Math.min(1,dt*8);}
    const work=AT.mode==='cine'&&AT.phase===4&&!AT.done,arm=e.carry?-1.25:work?-1.5+Math.sin(AT.t*18)*.25:-.08;e.la.rotation.x+=(arm-e.la.rotation.x)*.25;e.ra.rotation.x+=((work?-1.3+Math.cos(AT.t*18)*.3:arm)-e.ra.rotation.x)*.25;e.g.position.copy(e.pos);}
  // moteur terminé : il tourne
  if(AT.done&&A.anim&&A.anim.crank){/* les pièces ont été détachées de l'animation d'origine : légère vibration du moteur */A.root.position.y=1080+Math.sin(AT.t*60)*1.2;}
  // caméra
  if(AT.mode==='fp'){
    const k=AT.keys,f=(k.f?1:0)-(k.b?1:0),sd=(k.r?1:0)-(k.l?1:0);
    if(f||sd){const fw=new T.Vector3(-Math.sin(AT.yaw),0,-Math.cos(AT.yaw)),rt=new T.Vector3(Math.cos(AT.yaw),0,-Math.sin(AT.yaw));const nx=AT.pos.clone().addScaledVector(fw,f*1700*dt).addScaledVector(rt,sd*1500*dt);
      nx.x=clamp(nx.x,-1750,1750);nx.z=clamp(nx.z,-1900,2500);if(Math.hypot(nx.x,nx.z)>720) AT.pos.copy(nx);AT.pos.y=1650+Math.sin(AT.t*9)*12;}
    A.cam.position.copy(AT.pos);A.cam.rotation.order='YXZ';A.cam.rotation.set(AT.pitch,AT.yaw,0);
    if(AT.ghost.visible) AT.ghost.material.opacity=.2+.15*Math.sin(AT.t*5);
  }else{
    const a=AT.t*.12+.6,R=AT.done?2600:3300;A.cam.position.set(Math.sin(a)*R,AT.done?1700:2000,Math.cos(a)*R+300);A.cam.rotation.order='XYZ';A.cam.lookAt(e.pos.x*.35,1150,e.pos.z*.35);
  }
  A.renderer.render(A.scene,A.cam);
  requestAnimationFrame(atFrame);
}
