'use strict';
/* ───────────── Mode « Mécanicien » — FINITION VISUELLE de l'atelier ─────────────
   1. Mains et outil à la 1re personne (gants de mécanicien, manches de bleu de travail, outils chromés), dessinés dans une
      2e passe de rendu (profondeur effacée) : ils ne traversent jamais un mur ni la voiture et ne masquent pas la cible.
      Appelé par js/46 (vmEnsure, vmSet, vmTick, vmKick, vmWork, handSet) ; le rendu passe par MW.afterRender (js/40).
   2. Baladeuse (lampe d'atelier) qui éclaire la zone de travail quand le capot est ouvert ou la voiture levée.
   3. Collisions à pied : colonnes de pont, voitures posées sur les ponts (le joueur passe sous une voiture levée).
   ═══ API `MWF` ═══
   MWF.vmEnsure() · vmTool(id) · vmWork(0|1) · vmKick() · vmTick(dt, visible) · vmItem(mesh|null) · pass(renderer)
   MWF.lamp()   {on, light, group} · MWF.stats() */
const MWF=(()=>{
const T=THREE,PI=Math.PI;
const V=(x,y,z)=>new T.Vector3(x,y,z);
const lin=hex=>{const c=new T.Color(hex);c.convertSRGBToLinear();return c;};
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const api={};

/* ═══════════ Constructeur de géométrie fusionnée (couleurs par sommet) ═══════════ */
function Mb(){
 const P=[],N=[],C=[],I=[];
 return {
  add(g,col,m){g=g.clone();if(m) g.applyMatrix4(m);const p=g.attributes.position,n=g.attributes.normal,o=P.length/3,c=lin(col);
   for(let i=0;i<p.count;i++){P.push(p.getX(i),p.getY(i),p.getZ(i));N.push(n.getX(i),n.getY(i),n.getZ(i));C.push(c.r,c.g,c.b);}
   if(g.index){const ix=g.index;for(let i=0;i<ix.count;i++) I.push(ix.getX(i)+o);}else for(let i=0;i<p.count;i++) I.push(o+i);g.dispose();},
  build(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));
   g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingSphere();return g;},
  n(){return P.length/3;}};}
const GB=(w,h,d)=>new T.BoxGeometry(w,h,d);
const GC=(r1,r2,h,n)=>new T.CylinderGeometry(r1,r2,h,n||14);
const QZ=new T.Quaternion(),UP=V(0,1,0),FZ=V(0,0,1);
/* matrice : origine p, l'axe `from` (Y par défaut) est amené sur dir */
const AL=(p,dir,from)=>new T.Matrix4().compose(p,QZ.clone().setFromUnitVectors(from||UP,dir.clone().normalize()),V(1,1,1));
const BS=(p,a,u)=>{const z=a.clone().normalize(),y=u.clone().sub(z.clone().multiplyScalar(u.dot(z))).normalize(),x=new T.Vector3().crossVectors(y,z);return new T.Matrix4().makeBasis(x,y,z).setPosition(p);};
const MX=(x,y,z,rx,ry,rz)=>new T.Matrix4().compose(V(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx||0,ry||0,rz||0)),V(1,1,1));
/* cylindre d'axe dir centré en p ; barre (boîte) dont l'axe long z suit dir */
const cyl=(b,r1,r2,len,col,p,dir,n)=>b.add(GC(r1,r2,len,n),col,AL(p,dir||FZ));
const bar=(b,w,h,len,col,p,dir)=>b.add(GB(w,h,len),col,AL(p,dir,FZ));

/* couleurs */
const COL={chrome:0xbcc3ca,steel:0x8a929a,dark:0x30343a,black:0x1b1c1f,red:0xc02a20,yel:0xe8b820,org:0xe0651e,glove:0x565c66,glove2:0x363a42,sleeve:0x2c4f94,cuff:0x213c75,white:0xe9e9e4,blue:0x2a62c8,teal:0x0d7a9c};

/* ═══════════ Gants ═══════════ */
/* repère de la main : z vers l'avant-bras, y = dos de la main, x = côté ; s = +1 main droite, −1 main gauche.
   Renvoie la position du poignet (repère de la main). */
function glove(bm,M,pose,s){
 const g1=COL.glove,g2=COL.glove2,or=COL.org;
 const add=(geo,col,x,y,z,rx,ry,rz)=>bm.add(geo,col,M.clone().multiply(MX(x,y,z,rx,ry,rz)));
 if(pose==='fist'){
  add(GB(.056,.034,.09),g1,0,.03,0);                               /* dos de la main */
  add(GB(.05,.02,.06),g2,0,.052,-.004);                            /* surpiqûre / renfort */
  for(let i=0;i<4;i++) add(GC(.0115,.0115,.056,10),g1,0,.0,-.036+i*.024,0,0,PI/2); /* doigts refermés autour du manche */
  add(GB(.014,.02,.1),g1,s*.034,.03,.01,0,0,0);                    /* pouce */
  add(GC(.012,.012,.03,10),g1,s*.034,.024,-.05,PI/2,0,0);
  add(GB(.058,.012,.016),or,0,.054,.03);                           /* bande de jointure orange */
 }else{ /* main ouverte, paume vers le bas, doigts vers l'avant (−z) */
  add(GB(.08,.022,.088),g1,0,0,.0);
  add(GB(.07,.012,.014),or,0,.014,.036);
  for(let i=0;i<4;i++){const x=(i-1.5)*.0195,l=[.052,.058,.056,.046][i];
   add(GB(.0175,.015,l),g1,x,-.004,-.044-l/2+.006,-.12,0,0);
   add(GB(.0165,.013,l*.7),g2,x,-.024,-.044-l-.012,-.5,0,0);}
  add(GB(.019,.016,.06),g1,s*.05,-.004,-.012,0,s*-.5,0);           /* pouce */
 }
 /* poignet : manchette */
 add(GC(.032,.034,.05,12),g2,0,.012,.07,PI/2,0,0);
 add(GC(.036,.036,.012,12),or,0,.012,.098,PI/2,0,0);
 return V(0,.012,.115);}

/* ═══════════ Outils (origine = pointe de travail, avant = −z, le manche revient vers +z) ═══════════ */
const FIST=(bm,p,a,u,s)=>glove(bm,BS(p,a,u),'fist',s).applyMatrix4(BS(p,a,u));
const OPEN=(bm,p,a,u,s)=>glove(bm,BS(p,a,u),'open',s).applyMatrix4(BS(p,a,u));
function ratchetLike(bs,bm,o){ /* cliquet, clé dynamométrique, clé à filtre */
 const hd=V(.93,-.37,0).normalize(),L=o.len,head=V(0,0,.05);
 if(o.cup){cyl(bs,.044,.046,.075,COL.dark,V(0,0,.036),FZ,16);cyl(bs,.047,.047,.012,COL.steel,V(0,0,.07),FZ,16);cyl(bs,.047,.047,.006,COL.steel,V(0,0,.0),FZ,16);}
 else{cyl(bs,.0135,.0135,.042,COL.steel,V(0,0,.019),FZ,6);cyl(bs,.0105,.0105,.012,COL.chrome,V(0,0,-.004),FZ,6);}
 cyl(bs,.029,.029,.022,COL.chrome,head,FZ,20);cyl(bs,.02,.02,.026,COL.steel,V(0,0,.062),FZ,16);
 bar(bs,.02,.011,L*.58,COL.chrome,head.clone().add(hd.clone().multiplyScalar(L*.29+.02)),hd);
 const gc=head.clone().add(hd.clone().multiplyScalar(L*.58+.02+(L*.42)/2));
 bar(bm,.021,.021,L*.42,o.grip,gc,hd);
 for(let i=0;i<5;i++) bar(bm,.024,.024,.006,COL.black,gc.clone().add(hd.clone().multiplyScalar((i-2)*.02)),hd);
 if(o.dyn){bar(bs,.016,.008,.1,COL.steel,head.clone().add(V(0,.02,.02)),V(.5,.3,.3));bar(bm,.034,.006,.05,COL.yel,head.clone().add(hd.clone().multiplyScalar(L*.45)).add(V(0,.016,.0)),hd);}
 else bar(bs,.008,.008,.026,COL.steel,V(.02,.03,.075),V(1,.4,0));
 const wr=FIST(bm,gc,hd,V(0,.45,.89),1);
 /* main gauche : appuie sur la tête de l'outil */
 const wl=OPEN(bm,V(-.075,-.015,.1),V(-.45,-.25,.86),V(0,1,0),-1);
 return {gR:wr,gL:wl};}
const TOOLS={
 cliquet:(bs,bm)=>ratchetLike(bs,bm,{len:.27,grip:COL.red}),
 cle_dyn:(bs,bm)=>ratchetLike(bs,bm,{len:.42,grip:COL.black,dyn:1}),
 cle_filtre:(bs,bm)=>ratchetLike(bs,bm,{len:.3,grip:COL.yel,cup:1}),
 tournevis:(bs,bm)=>{const a=V(.2,-.22,.95).normalize();
  cyl(bs,.0048,.0048,.19,COL.steel,V(0,0,.095),FZ,8);cyl(bs,.0065,.0035,.016,COL.dark,V(0,0,.006),FZ,8);
  const hp=a.clone().multiplyScalar(.255).add(V(0,0,.0));
  cyl(bm,.0165,.0165,.11,COL.yel,V(0,0,.24),a,12);cyl(bm,.0185,.0185,.02,COL.red,V(0,0,.2),a,12);cyl(bm,.012,.012,.012,COL.red,V(0,0,.29),a,12);
  return {gR:FIST(bm,V(0,0,.245).add(V(0,-.012,0)),a,V(0,.5,.87),1),gL:OPEN(bm,V(-.17,-.13,.22),V(-.4,-.35,.85),V(0,1,0),-1)};},
 boulonneuse:(bs,bm)=>{cyl(bs,.015,.015,.036,COL.steel,V(0,0,.02),FZ,6);cyl(bs,.0105,.0105,.03,COL.chrome,V(0,0,.0),FZ,6);cyl(bs,.026,.026,.04,COL.dark,V(0,0,.056),FZ,16);
  bm.add(GB(.068,.078,.2),COL.teal,MX(0,0,.17));bm.add(GB(.07,.012,.12),COL.black,MX(0,.04,.19));
  bm.add(GB(.036,.12,.045),COL.black,MX(0,-.09,.22,.25));bm.add(GB(.062,.045,.1),COL.black,MX(0,-.175,.22));bm.add(GB(.064,.012,.09),COL.yel,MX(0,-.152,.22));
  bm.add(GB(.016,.02,.02),COL.red,MX(0,-.035,.1));
  return {gR:FIST(bm,V(0,-.09,.215),V(0,-.93,.37),V(0,.37,.93),1),gL:OPEN(bm,V(-.075,-.19,.19),V(-.45,-.35,.82),V(0,1,0),-1)};},
 bac:(bs,bm)=>{bm.add(GB(.34,.012,.25),COL.blue,MX(0,-.045,.06));
  for(const sx of [-1,1]) bm.add(GB(.012,.07,.25),COL.blue,MX(sx*.17,-.012,.06));
  bm.add(GB(.34,.07,.012),COL.blue,MX(0,-.012,-.065));bm.add(GB(.34,.07,.012),COL.blue,MX(0,-.012,.185));
  bm.add(GB(.31,.004,.22),COL.black,MX(0,-.038,.06));
  return {gR:OPEN(bm,V(.2,-.045,.1),V(.3,-.2,.93),V(0,1,0),1),gL:OPEN(bm,V(-.2,-.045,.1),V(-.3,-.2,.93),V(0,1,0),-1)};},
 bidon:(bs,bm)=>{cyl(bm,.016,.016,.05,COL.white,V(0,-.025,0),UP,12);cyl(bm,.0185,.0185,.016,COL.yel,V(0,-.002,0),UP,12);
  bm.add(GB(.115,.19,.075),COL.white,MX(0,-.145,0));bm.add(GB(.05,.07,.002),COL.org,MX(0,-.145,-.0385));bm.add(GB(.08,.02,.04),COL.white,MX(0,-.058,0,0,0,0));
  bm.add(GB(.018,.11,.022),COL.white,MX(0,-.12,.06));bm.add(GB(.018,.02,.05),COL.white,MX(0,-.06,.04));bm.add(GB(.018,.02,.05),COL.white,MX(0,-.18,.04));
  return {gR:FIST(bm,V(0,-.12,.068),V(.2,-.55,.8),V(0,.8,.55),1),gL:OPEN(bm,V(-.02,-.2,-.01),V(-.4,-.25,.88),V(0,1,0),-1)};},
 entonnoir:(bs,bm)=>{cyl(bm,.064,.013,.1,COL.yel,V(0,.05,0),UP,18);cyl(bm,.066,.066,.008,COL.yel,V(0,.1,0),UP,18);cyl(bm,.011,.011,.04,COL.yel,V(0,-.015,0),UP,10);
  return {gR:FIST(bm,V(.09,.07,.06),V(.35,-.3,.9),V(0,.8,.2),1),gL:OPEN(bm,V(-.1,.06,.12),V(-.5,-.2,.84),V(0,1,0),-1)};},
 pinces:(bs,bm)=>{for(const s of [-1,1]){bar(bs,.016,.008,.07,COL.steel,V(s*.007,0,.02),V(s*.07,0,1));bar(bm,.017,.017,.15,COL.red,V(s*.03,-.01,.15),V(s*.2,-.1,1));}
  cyl(bs,.007,.007,.02,COL.dark,V(0,0,.05),UP,8);
  return {gR:FIST(bm,V(.03,-.025,.15),V(.1,-.22,.95),V(0,.7,.35),1),gL:OPEN(bm,V(-.15,-.1,.15),V(-.4,-.3,.85),V(0,1,0),-1)};},
 presse:(bs,bm)=>{cyl(bs,.02,.02,.2,COL.steel,V(0,0,.1),FZ,12);bs.add(GB(.09,.09,.014),COL.dark,MX(0,0,-.006));bm.add(GB(.03,.1,.03),COL.black,MX(0,0,.22));bm.add(GB(.05,.03,.04),COL.red,MX(0,0,.2));
  return {gR:FIST(bm,V(0,-.01,.25),V(.1,-.2,.95),V(0,.7,.35),1),gL:OPEN(bm,V(-.16,-.1,.2),V(-.4,-.3,.85),V(0,1,0),-1)};},
 seringue:(bs,bm)=>{cyl(bs,.0035,.0035,.07,COL.chrome,V(0,0,.035),FZ,6);cyl(bm,.016,.016,.17,COL.white,V(0,0,.155),FZ,12);cyl(bs,.0045,.0045,.1,COL.steel,V(0,0,.29),FZ,6);bm.add(GB(.06,.01,.018),COL.white,MX(0,0,.245));bm.add(GB(.036,.036,.01),COL.black,MX(0,0,.34));
  return {gR:FIST(bm,V(0,-.02,.17),V(.1,-.2,.95),V(0,.7,.35),1),gL:OPEN(bm,V(-.1,-.04,.34),V(-.35,-.25,.9),V(0,1,0),-1)};},
 main:(bs,bm)=>({gR:OPEN(bm,V(.1,-.03,-.02),V(.4,-.3,.87),V(0,1,0),1),gL:OPEN(bm,V(-.1,-.03,-.02),V(-.4,-.3,.87),V(0,1,0),-1)})};
/* position de la pointe dans l'écran (x,y,z) et inclinaison de base */
const PLACE={cliquet:[.05,-.1,-.47,0,0,0],cle_dyn:[.04,-.1,-.5,0,0,0],cle_filtre:[.05,-.1,-.5,0,0,0],tournevis:[-.01,-.1,-.5,.12,.28,0],boulonneuse:[.0,-.09,-.52,0,0,0],
 bac:[0,-.1,-.42,.12,0,0],bidon:[.05,-.06,-.44,.15,0,0],entonnoir:[0,-.12,-.46,0,0,0],pinces:[.0,-.1,-.5,.1,.2,0],presse:[0,-.1,-.5,.1,.2,0],seringue:[0,-.1,-.5,.1,.15,0],main:[0,-.13,-.4,0,0,0]};

/* ═══════════ Passe de rendu des mains ═══════════ */
let VS=null,VC=null,ROOT=null,tipG=null,innerG=null,toolS=null,toolM=null,foreR=null,foreL=null,itemG=null;
let tool='main',tw=0,tK=0,tSw=0,vmT=0,phase=0,speed=0,tilt=0,vis=false,lastX=0,lastZ=0,sw=1,pour=0;
const MS=new T.MeshPhongMaterial({vertexColors:true,shininess:90,specular:0xaaaaaa}),MM=new T.MeshPhongMaterial({vertexColors:true,shininess:22,specular:0x2a2a2a});
const MF=new T.MeshLambertMaterial({color:lin(COL.sleeve)});
const FG=(()=>{const g=new T.CylinderGeometry(.026,.04,1,12,1,false);g.rotateX(PI/2);return g;})();
const CACHE={};
function model(id){
 if(CACHE[id]) return CACHE[id];
 const bs=Mb(),bm=Mb(),fn=TOOLS[id]||TOOLS.main,r=fn(bs,bm);
 return CACHE[id]={gs:bs.n()?bs.build():null,gm:bm.build(),gR:r.gR||null,gL:r.gL||null};}
function ensure(){
 if(VS) return VS;
 VS=new T.Scene();VC=new T.PerspectiveCamera(62,1.6,.02,6);VS.add(VC);
 const h=new T.HemisphereLight(0xdfe8f4,0x6a5e52,.8);VS.add(h);
 const d=new T.DirectionalLight(0xfff0dc,.85);d.position.set(-.5,1,.8);VS.add(d);
 ROOT=new T.Group();ROOT.name='mf_vm';VS.add(ROOT);
 tipG=new T.Group();innerG=new T.Group();tipG.add(innerG);ROOT.add(tipG);
 toolS=new T.Mesh(new T.BufferGeometry(),MS);toolM=new T.Mesh(new T.BufferGeometry(),MM);toolS.frustumCulled=false;toolM.frustumCulled=false;innerG.add(toolS,toolM);
 foreR=new T.Mesh(FG,MF);foreL=new T.Mesh(FG,MF);foreR.frustumCulled=false;foreL.frustumCulled=false;ROOT.add(foreR,foreL);
 itemG=new T.Group();ROOT.add(itemG);
 setTool(tool,true);
 return VS;}
function setTool(id,force){
 if(!TOOLS[id]) id='main';if(id===tool&&!force) return;tool=id;if(!VS) return;
 const m=model(id);toolS.geometry=m.gs||new T.BufferGeometry();toolM.geometry=m.gm;toolS.visible=!!m.gs;
 const p=PLACE[id]||PLACE.main;tipG.userData.base=p;innerG.rotation.set(p[3],p[4],p[5]);tSw=1;sw=1;}
const SH_R=V(.36,-.5,.42),SH_L=V(-.36,-.5,.42),w1=V(),w2=V(),dd=V(),UPZ=V(0,0,1);
function fore(mesh,wl){
 if(!wl){mesh.visible=false;return;}mesh.visible=true;
 w1.copy(wl).applyMatrix4(innerG.matrixWorld);                    /* poignet (repère de l'écran) */
 dd.copy(mesh===foreR?SH_R:SH_L).sub(w1);const len=dd.length();dd.divideScalar(len);
 mesh.position.copy(w1).addScaledVector(dd,len*.5-.005);mesh.quaternion.setFromUnitVectors(UPZ,dd);mesh.scale.set(1,1,len+.01);}
function tick(dt,show){
 vis=!!show;if(!VS){if(!show) return;ensure();}
 if(!show) return;
 const p=MW.player();const dx=p.x-lastX,dz=p.z-lastZ;lastX=p.x;lastZ=p.z;
 const sp=dt>0?Math.min(7,Math.hypot(dx,dz)/dt):0;speed+=(sp-speed)*Math.min(1,dt*8);
 vmT+=dt;phase+=dt*(2.2+speed*1.35)*(speed>.2?1:.4);
 tK=Math.max(0,tK-dt*5);tSw=Math.max(0,tSw-dt*3.5);
 const w=tw,t=vmT;
 const m=model(tool),base=tipG.userData.base||PLACE.main;
 /* balancement : marche, respiration */
 const mv=clamp(speed/3.3,0,1.6),bobX=Math.sin(phase)*.006*mv+Math.sin(t*1.1)*.0015,bobY=-Math.abs(Math.sin(phase))*.008*mv+Math.sin(t*1.7)*.0015;
 let rx=0,ry=0,rz=0,px=0,py=0,pz=0;
 if(w){
  const saw=(f)=>{const k=(t*f)%1;return k<.72?k/.72:1-(k-.72)/.28;};
  if(tool==='cliquet'||tool==='cle_dyn'||tool==='cle_filtre'){rz=-.1-.26*saw(tool==='cle_dyn'?1.5:2.4);pz=-.012;}
  else if(tool==='boulonneuse'){px=Math.sin(t*95)*.0014;py=Math.cos(t*83)*.0014;pz=-.03;rz=Math.sin(t*70)*.01;}
  else if(tool==='tournevis'){rz=Math.sin(t*9)*.35;pz=-.02;}
  else if(tool==='pinces'||tool==='presse'){pz=-.02+Math.sin(t*10)*.01;}
  else if(tool==='seringue'){pz=-.02+Math.sin(t*3.5)*.025;}
  else if(tool==='bac'){py=.01;}
  else if(tool==='main'){pz=-.04;py=.01;rz=Math.sin(t*12)*.05;}
  else if(tool==='entonnoir'){py=.01;}
  else pz=-.03+Math.sin(t*14)*.01;}
 pour+=((tool==='bidon'&&w?1:0)-pour)*Math.min(1,dt*3.2);
 if(tool==='bidon'){rx=-.2-1.45*pour;py+=.03*pour;pz-=.02*pour;}
 pz-=tK*.055;py-=tSw*.22;rx+=tSw*.4;
 tipG.scale.setScalar(.82);tipG.position.set(base[0]+.025+bobX+px,base[1]-.035+bobY+py,base[2]+pz);tipG.rotation.set(rx,ry,rz);
 tipG.updateMatrixWorld(true);innerG.updateMatrixWorld(true);
 fore(foreR,m.gR);fore(foreL,m.gL);
 itemG.position.set(-.38,-.02+bobY,-.1);}
function pass(r){
 if(!vis||!VS||!MW.cam) return;
 VC.aspect=MW.cam.aspect||1.6;VC.fov=62;VC.updateProjectionMatrix();
 const ac=r.autoClear,ar=r.info.autoReset;r.autoClear=false;r.info.autoReset=false;r.clearDepth();r.render(VS,VC);r.autoClear=ac;r.info.autoReset=ar;} /* les compteurs de dessin restent cumulés */
MW.afterRender=pass;

/* ═══════════ Baladeuse : projecteur d'atelier sur pied, qui éclaire la zone de travail ═══════════ */
let LG=null,LL=null,LP=null,LH=null,lampK=0,lampCar=null,lampCol=null;
const LCOL={leg:0x2b2e33,pole:0xe8b820,head:0x23262b,panel:0xfff3d4};
function lampBuild(){
 const bm=Mb(),bp=Mb(),bh=Mb();
 for(let i=0;i<3;i++){const a=i*PI*2/3+.4;bm.add(GB(.03,.03,.5),LCOL.leg,AL(V(Math.sin(a)*.2,.1,Math.cos(a)*.2),V(Math.sin(a)*.5,-.9,Math.cos(a)*.5),FZ));}
 bm.add(GC(.05,.06,.1,10),LCOL.leg,MX(0,.2,0));
 bp.add(GC(.018,.018,1,10),LCOL.pole,MX(0,.5,0));
 bh.add(GB(.4,.3,.07),LCOL.head,MX(0,0,0));bh.add(GB(.44,.04,.1),LCOL.leg,MX(0,.17,0));bh.add(GB(.44,.04,.1),LCOL.leg,MX(0,-.17,0));
 bh.add(GB(.04,.2,.14),LCOL.leg,MX(.21,0,-.03));bh.add(GB(.04,.2,.14),LCOL.leg,MX(-.21,0,-.03));
 const mat=()=>{const m=new T.MeshLambertMaterial({vertexColors:true});m.userData.lin=1;return m;};
 LG=new T.Group();LG.name='mf_lampe';
 const base=new T.Mesh(bm.build(),mat());LP=new T.Mesh(bp.build(),mat());
 LH=new T.Group();const hm=new T.Mesh(bh.build(),mat());
 const pn=new T.Mesh(new T.PlaneGeometry(.34,.24),new T.MeshBasicMaterial({color:LCOL.panel}));pn.position.z=.037;
 LH.add(hm,pn);LG.add(base,LP,LH);
 for(const o of [base,LP,hm,pn]){o.castShadow=false;o.frustumCulled=false;}
 LL=new T.PointLight(0xfff0d2,0,9,1.2);LL.castShadow=false;
 MW.scene.add(LG);MW.scene.add(LL);LG.visible=false;}
/* configuration de la lampe pour la voiture en cours de travail : position du pied (repère voiture), hauteur de tête, point visé, position de la lumière */
function lampCfg(c,g){
 const an=g.userData.anchors||{},bay=an.bay?an.bay.position:V(0,0,1.5),sg=bay.z>=0?1:-1,y0=g.position.y;
 const zb=bay.z;
 if(c.st.lifted&&c.st.capot) return {x:-1.25,z:zb-sg*.75,h:y0+.55,tx:0,ty:y0+.35,tz:zb*.55,lx:-.95,lz:zb*.25,ly:y0+.5};
 if(c.st.lifted) return {x:-1.3,z:0,h:1.15,tx:0,ty:y0+.3,tz:0,lx:-.5,lz:0,ly:1.35};
 if(c.st.capot) return {x:-1.2,z:zb+sg*.45,h:1.55,tx:0,ty:y0+.75,tz:zb,lx:-.45,lz:zb+sg*.15,ly:1.75};
 return null;}
const lv=V(0,0,0),la=V(0,0,0);
function lampTick(dt){
 const R=typeof MWG!=='undefined'&&MWG.rig?MWG.rig():null;let cfg=null,g=null;
 if(R&&MWG.on()&&!MW.paused){g=MWJ.mesh(R.c);if(g) cfg=lampCfg(R.c,g);}
 const want=cfg?1:0;lampK+=(want-lampK)*Math.min(1,dt*(want?4:7));
 if(!LG){if(!cfg) return;lampBuild();}
 if(cfg){
  g.updateMatrixWorld(true);const p=R.p;
  lv.set(cfg.x,0,cfg.z).applyMatrix4(g.matrixWorld);
  LG.position.set(lv.x,.22,lv.z);LG.rotation.y=p.ry+(cfg.x<0?PI:0);
  const hh=Math.max(.7,cfg.h-.22);LP.scale.y=hh;LH.position.set(0,hh,0);
  la.set(cfg.tx,0,cfg.tz).applyMatrix4(g.matrixWorld);la.y=cfg.ty;
  LG.updateMatrixWorld(true);LH.lookAt(la);
  lv.set(cfg.lx,0,cfg.lz).applyMatrix4(g.matrixWorld);lv.y=cfg.ly;LL.position.copy(lv);
  lampCar=R.c;
  if(!lampCol){const D=(typeof MWD!=='undefined'&&MWD.ctx);if(D&&D.walls){lampCol=[0,0,0,0];D.walls.push(lampCol);}}
  if(lampCol){lampCol[0]=LG.position.x-.3;lampCol[1]=LG.position.z-.3;lampCol[2]=LG.position.x+.3;lampCol[3]=LG.position.z+.3;}}
 LG.visible=lampK>.03&&!!cfg;LL.intensity=lampK*3;
 if(!cfg&&lampCol&&lampK<.03){const D=(typeof MWD!=='undefined'&&MWD.ctx),i=D&&D.walls?D.walls.indexOf(lampCol):-1;if(i>=0) D.walls.splice(i,1);lampCol=null;}
}

/* ═══════════ Collisions : voitures posées sur les ponts (le joueur passe sous une voiture levée) ═══════════ */
const carCol=new Map();
function colTick(){
 const D=(typeof MWD!=='undefined'&&MWD.ctx);if(!D||!D.walls||typeof MWJ==='undefined'||!MW.S||!MW.S.jobs) return;
 const walls=D.walls,live=new Set();
 for(const c of MWJ.jobs()){
  const g=MWJ.mesh(c),z=MW.zone(c.zone),p=z&&z.ponts&&z.ponts[c.pont];if(!g||!p) continue;
  live.add(c.id);
  const low=g.position.y<1.5;let e=carCol.get(c.id);
  if(low){
   const L=(g.userData.L||4.2)/2,W=(g.userData.W||1.8)/2,sw=Math.abs(Math.sin(p.ry))>.7;
   const hx=sw?L:W,hz=sw?W:L;
   if(!e){e={r:[0,0,0,0]};carCol.set(c.id,e);walls.push(e.r);}
   else if(walls.indexOf(e.r)<0) walls.push(e.r);
   e.r[0]=p.x-hx;e.r[1]=p.z-hz;e.r[2]=p.x+hx;e.r[3]=p.z+hz;
  }else if(e){const i=walls.indexOf(e.r);if(i>=0) walls.splice(i,1);}
 }
 for(const [id,e] of carCol) if(!live.has(id)){const i=walls.indexOf(e.r);if(i>=0) walls.splice(i,1);carCol.delete(id);}}
let ft=0;
MW.on('tick',dt=>{try{lampTick(dt);if(++ft%4===0) colTick();}catch(e){if(!api._err){api._err=1;console.error('MWF',e);}}});
MW.on('start',()=>{carCol.clear();lampCol=null;});
api.lamp=()=>({on:lampK>.5,k:lampK,light:LL,group:LG,car:lampCar});
api.cols=()=>carCol.size;

Object.assign(api,{vmEnsure:()=>{ensure();return ROOT;},vmTool:setTool,vmWork:w=>{tw=w;},vmKick:()=>{tK=1;},vmTick:tick,
 vmItem:o=>{ensure();while(itemG.children.length) itemG.remove(itemG.children[0]);if(o){itemG.add(o);o.position.set(0,0,0);o.rotation.set(.2,.5,0);}},
 pass,stats:()=>({tools:Object.keys(CACHE),vis})});
return api;
})();
