'use strict';
/* ───────────── Moteur 3D ───────────── */
let E3=null;
function dispose3D(){if(!E3) return;try{E3.scene.traverse(o=>{if(o.geometry) o.geometry.dispose();});E3.renderer.dispose();E3.renderer.forceContextLoss();}catch(e){}E3=null;}
const engSig=()=>['config','bore','stroke','blockMat','headMat','valvetrain','timing','turboType','sump','liner','intake','scType','fuelSys','fuel','aspiration','intercooler','manifold','cat'].map(k=>S[k]).join('|');
function init3D(cv){
  if(!window.THREE) return false;
  try{
    const T=THREE,renderer=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.outputEncoding=T.sRGBEncoding;
    const scene=new T.Scene(),cam=new T.PerspectiveCamera(30,2,10,40000);
    scene.add(new T.HemisphereLight(0xffffff,0x39485c,.95));
    const d1=new T.DirectionalLight(0xffffff,.95);d1.position.set(1,2,1.6);scene.add(d1);
    const d2=new T.DirectionalLight(0xbfd4ff,.4);d2.position.set(-1.5,.6,-1.2);scene.add(d2);
    E3={cv,renderer,scene,cam,root:null,parts:[],anim:null,sig:'',R:600,w:0,h:0,hl:new T.MeshStandardMaterial({color:0xffb800,emissive:0xff9500,emissiveIntensity:.55,roughness:.4,metalness:.3}),shown:[],pinEls:[]};
    let drag=null;
    cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};try{cv.setPointerCapture(e.pointerId);}catch(err){}});
    cv.addEventListener('pointermove',e=>{if(!drag) return;ui.az-=(e.clientX-drag.x)*.008;ui.el=clamp(ui.el+(e.clientY-drag.y)*.006,-1.2,1.35);drag={x:e.clientX,y:e.clientY};if(!engRaf) draw3D();});
    const up=()=>{drag=null;};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    return true;
  }catch(e){E3=null;return false;}
}
function build3D(){
  const T=THREE,V=(x,y,z)=>new T.Vector3(x,y,z),E=M.E,c=E.c;
  if(E3.root){E3.scene.remove(E3.root);E3.root.traverse(o=>{if(o.geometry) o.geometry.dispose();});}
  const root=new T.Group(),parts=[];let oilRef=null;
  const MT=(col,rough,metal)=>new T.MeshStandardMaterial({color:col,roughness:rough,metalness:metal});
  const mAlu=MT(0xb9c1c9,.45,.7),mIron=MT(0x41464d,.7,.5),mSteel=MT(0x8c949c,.4,.8),mBlk=MT(0x1c1f24,.6,.1),mSens=MT(0xffb800,.5,.2),mPipe=MT(0x8d8a84,.4,.8),mFil=MT(0xe9e5db,.6,.1),mPis=MT(0xd0d6dc,.35,.8),mRod=MT(0x9aa3ad,.4,.8),mCrk=MT(0x6f7882,.4,.8),mTurb=MT(0x4b4640,.75,.5),mCu=MT(0xb87333,.45,.8);
  const mExh=S.manifold==='cast'?MT(0x5a4a40,.85,.4):S.manifold==='tub'?MT(0xb5b0a6,.3,.9):MT(0xb89257,.3,.9);
  const mBlock=(S.blockMat==='alu'?mAlu:S.blockMat==='mg'?MT(0xa7a9a2,.55,.6):S.blockMat==='cgi'?MT(0x565b62,.65,.55):mIron).clone(),mHead=(S.headMat==='alu'?mAlu:mIron).clone(),mCover=MT(0x2a2f37,.5,.4),mPan=MT(0x2b2e33,.6,.5),mTim=MT(0x23272d,.6,.2);
  const shellMats=[mBlock,mHead,mCover,mPan,mTim];
  const P=(name,desc,o)=>{const p=Object.assign({name,desc,meshes:[],pin:null},o||{});parts.push(p);return p;};
  const mLine=new T.LineBasicMaterial({color:0x0b1524,transparent:true,opacity:.36}),edge=(me,ang)=>me.add(new T.LineSegments(new T.EdgesGeometry(me.geometry,ang||35),mLine));
  const add=(me,part,parent)=>{(parent||root).add(me);if(me.isMesh&&(me.geometry.type==='BoxGeometry'||me.geometry.type==='CylinderGeometry')) edge(me);if(part){part.meshes.push(me);if(!part.pin) part.pin=me.position.clone();}return me;};
  const rotB=(b,x,y,z)=>V(x,y*Math.cos(b)-z*Math.sin(b),y*Math.sin(b)+z*Math.cos(b));
  const box=(b,cx,cy,cz,sx,sy,sz,m,part)=>{const me=new T.Mesh(new T.BoxGeometry(sx,sy,sz),m);me.position.copy(rotB(b,cx,cy,cz));me.rotation.x=b;return add(me,part);};
  const UP=V(0,1,0);
  const cyl=(p,q,rad,m,part,parent)=>{const d=q.clone().sub(p),len=d.length(),me=new T.Mesh(new T.CylinderGeometry(rad,rad,len,28),m);me.position.copy(p).addScaledVector(d,.5);me.quaternion.setFromUnitVectors(UP,d.normalize());return add(me,part,parent);};
  const cylX=(x0,x1,y,z,rad,m,part,parent)=>cyl(V(x0,y,z),V(x1,y,z),rad,m,part,parent);
  const tube=(pts,rad,m,part,closed)=>{const me=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts,!!closed,'catmullrom',.35),Math.max(24,pts.length*14),rad,12,!!closed),m);if(part&&!part.pin) part.pin=pts[Math.floor(pts.length/2)].clone();return add(me,part);};
  const cone=(p,q,r1,r2,m,part)=>{const d=q.clone().sub(p),len=d.length(),me=new T.Mesh(new T.CylinderGeometry(r2,r1,len,28),m);me.position.copy(p).addScaledVector(d,.5);me.quaternion.setFromUnitVectors(UP,d.normalize());return add(me,part);};
  const torus=(p,R,r,m,part)=>{const me=new T.Mesh(new T.TorusGeometry(R,r,14,30),m);me.rotation.y=Math.PI/2;me.position.copy(p);return add(me,part);};
  const pulley=(y,z,rad,part,parent)=>{cylX(-50,-26,y,z,rad*.86,mSteel,part,parent);cylX(-50,-47,y,z,rad,mSteel,part,parent);cylX(-29,-26,y,z,rad,mSteel,part,parent);cylX(-54,-50,y,z,rad*.3,mBlk,part,parent);};
  const ball=(p,rad,m,part)=>{const me=new T.Mesh(new T.SphereGeometry(rad,18,14),m);me.position.copy(p);return add(me,part);};
  const fin=anim=>{
  // centrage
  const bb=new T.Box3().setFromObject(root),ctr=bb.getCenter(V(0,0,0));root.position.sub(ctr);
  for(const p of parts){const mp=new Map();p.mats=[];for(const me of p.meshes){if(!me.isMesh) continue;let m=mp.get(me.material);if(!m){m=me.material.clone();m.userData={c0:m.color.clone(),me:m.metalness};mp.set(me.material,m);p.mats.push(m);}me.material=m;}const h=HEATMAP.find(x=>p.name.indexOf(x[0])===0);if(h) p.heat=h[1];}
  E3.R=bb.getSize(V(0,0,0)).length()/2;E3.root=root;E3.parts=parts;E3.shellMats=parts.filter(p=>p.shell).reduce((a,p)=>a.concat(p.mats),[]);E3.anim=anim;E3.oil=oilRef;E3.sig=engSig();E3.scene.add(root);
  apply3DMode();
  };
  // ── moteur rotatif : carters empilés, rotors sur arbre excentrique
  if(E.rot){
    const R=S.bore,e=R/7,bw=S.stroke,nR=E.rot,Hh=R+e+34,Hw=R-e+40,sp=34,ecu=S.fuelSys!=='carb';
    const epi=t=>[e*Math.cos(3*t)+R*Math.cos(t),e*Math.sin(3*t)+R*Math.sin(t)];
    const PERM=new T.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1);
    const outer=()=>{const sh=new T.Shape();sh.moveTo(-Hh,-Hw);sh.lineTo(Hh,-Hw);sh.lineTo(Hh,Hw);sh.lineTo(-Hh,Hw);sh.closePath();return sh;};
    const ext=(shape,depth,x,m,part,parent)=>{const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10});g.applyMatrix4(PERM);const me=new T.Mesh(g,m);me.position.x=x;(parent||root).add(me);me.add(new T.LineSegments(new T.EdgesGeometry(g,35),mLine));if(part){part.meshes.push(me);}return me;};
    const mHous=MT(0xb9c1c9,.5,.7),mSide=MT(0x565b62,.65,.5),mPan=MT(0x2b2e33,.6,.5),mRot=MT(0x8f98a3,.4,.8);
    const pH=P('Carters de rotor',`Piste en forme de huit (épitrochoïde), rayon ${nf(R)} mm, largeur ${nf(bw)} mm`,{shell:1}),pS=P('Flasques latéraux','Ferment les chambres ; les lumières d\'admission y sont taillées',{shell:1});
    const pR=P('Rotors',`${nR} rotor${nR>1?'s':''} triangulaire${nR>1?'s':''} : trois chambres chacun, segments d'arête aux sommets`,{inner:1}),pSh=P('Arbre excentrique','Remplace le vilebrequin : il tourne trois fois plus vite que les rotors',{inner:1});
    const gC=new T.Group();root.add(gC);const rotors=[],xs=[];let x=0;
    box(0,-10,0,0,20,2*Hh,2*Hw,mSide,pS);
    for(let j=0;j<nR;j++){
      box(0,x+sp/2,0,0,sp,2*Hh,2*Hw,mSide,pS);x+=sp;
      const sh=outer(),hole=new T.Path();for(let i=0;i<=72;i++){const q=epi(i/72*2*Math.PI);i?hole.lineTo(q[0],q[1]):hole.moveTo(q[0],q[1]);}sh.holes.push(hole);ext(sh,bw,x,mHous,pH);
      const rs=new T.Shape();for(let k=0;k<3;k++){const t0=2*Math.PI*k/3,A=[R*Math.cos(t0),R*Math.sin(t0)],B=[R*Math.cos(t0+2*Math.PI/3),R*Math.sin(t0+2*Math.PI/3)],Q=[.9*R*Math.cos(t0+Math.PI/3),.9*R*Math.sin(t0+Math.PI/3)];if(!k) rs.moveTo(A[0],A[1]);rs.quadraticCurveTo(Q[0],Q[1],B[0],B[1]);}
      const hc=new T.Path();hc.absarc(0,0,R*.3,0,2*Math.PI,true);rs.holes.push(hc);
      const g=new T.Group();root.add(g);ext(rs,bw-6,3,mRot,pR,g);rotors.push({g,x:x,ph:2*Math.PI*j/nR,e});
      const ph=2*Math.PI*j/nR;cylX(x+2,x+bw-2,e*Math.cos(ph),e*Math.sin(ph),R*.3,mCrk,pSh,gC);
      xs.push(x+bw/2);x+=bw;
    }
    box(0,x+sp/2,0,0,sp,2*Hh,2*Hw,mSide,pS);x+=sp;const Lx=x;
    cylX(-30,Lx+8,0,0,R*.13,mCrk,pSh,gC);pH.pin=V(xs[0],Hh,0);pS.pin=V(Lx-sp/2,Hh*.6,Hw);pR.pin=V(xs[0],0,0);pSh.pin=V(Lx*.5,0,0);
    const pPan=P("Carter d'huile",'Réserve l\'huile, dont une partie est injectée dans les chambres pour graisser les segments',{shell:1});box(0,Lx/2,-Hh-32,0,Lx-20,64,2*Hw-30,mPan,pPan);
    {const pO=P('Huile moteur','Son niveau suit la quantité réglée dans « Lubrification »',{inner:1}),om=new T.Mesh(new T.BoxGeometry(Lx-30,1,2*Hw-40),new T.MeshStandardMaterial({color:0xc98a1b,transparent:true,opacity:.82,roughness:.2,metalness:.1}));om.position.set(Lx/2,0,0);add(om,pO);oilRef={me:om,y0:-Hh-62,hh:58};}
    // allumage : 2 bougies par rotor, côté +z
    const pPl=P('Bougies (2 par rotor)','Une bougie d\'attaque et une de fuite : la chambre est longue, il faut deux départs de flamme');
    xs.forEach(xr=>{for(const dy of [-22,22]){cyl(V(xr,dy,Hw),V(xr,dy,Hw+38),8,mSteel,pPl);cyl(V(xr,dy,Hw+38),V(xr,dy,Hw+70),11,mBlk,pPl);}});pPl.pin=V(xs[0],22,Hw+70);
    // admission (haut, côté -z) et échappement (bas, côté -z)
    const pIn=P("Collecteur d'admission",`${INTAKE[S.intake].n} : alimente les lumières de chaque rotor`),mIn=ecu?mBlk:mAlu,plY=Hh+70,plZ=-(Hw+120);
    cylX(10,Lx-10,plY,plZ,40,mIn,pIn);ball(V(10,plY,plZ),40,mIn,pIn);ball(V(Lx-10,plY,plZ),40,mIn,pIn);
    xs.forEach(xr=>tube([V(xr,R*.5,-Hw),V(xr,R*.75,-Hw-70),V(xr,plY-10,plZ+10)],20,mIn,pIn));pIn.pin=V(Lx/2,plY+40,plZ);
    const tb=V(-22,plY,plZ);
    if(!ecu){const pK=P('Carburateur',"Dose l'essence par dépression, sans électronique");box(0,Lx/2,plY+70,plZ,80,60,80,mAlu,pK);cyl(V(Lx/2,plY+100,plZ),V(Lx/2,plY+150,plZ),100,mBlk,pK);}
    else{const pTb=P('Boîtier papillon',"Règle le débit d'air selon l'accélérateur");cylX(tb.x-28,tb.x+28,tb.y,tb.z,34,mAlu,pTb);
      const pR2=P("Rampe d'injection et injecteurs",'Un ou deux injecteurs par rotor, dans le conduit d\'admission');cylX(xs[0]-30,xs[nR-1]+30,R*.75+34,-Hw-78,7,mSteel,pR2);xs.forEach(xr=>cyl(V(xr,R*.75+34,-Hw-78),V(xr,R*.75+8,-Hw-62),7,MT(0x2e6b4a,.5,.2),pR2));
      const pMap=P("Capteur de pression d'admission",'Mesure la charge du moteur');cyl(V(Lx*.7,plY+36,plZ),V(Lx*.7,plY+64,plZ),11,mSens,pMap);pMap.pin=V(Lx*.7,plY+64,plZ);}
    const pEx=P("Collecteur d'échappement",'Les gaz d\'un rotatif sortent très chauds et très bruyants'),col=V(Lx*.5,-R*.95,-(Hw+150));
    xs.forEach(xr=>tube([V(xr,-R*.5,-Hw),V(xr,-R*.55,-Hw-70),V(lerp(xr,col.x,.6),-R*.85,-Hw-135),col],19,mExh,pEx));ball(col,30,mExh,pEx);pEx.pin=V(xs[0],-R*.5,-Hw-40);
    let end=col,compOut=null;
    if(E.turbo){const pT=P('Turbocompresseur',`${TURBO[S.turboType].n}, ${nf(S.boost,2)} bar de suralimentation`),t=V(col.x+70,col.y-30,col.z-70);cyl(col,t,24,mExh,pT);
      cylX(t.x-25,t.x+25,t.y,t.z,58,mTurb,pT);torus(V(t.x,t.y,t.z),46,17,mTurb,pT);cylX(t.x-62,t.x-25,t.y,t.z,24,mSteel,pT);cylX(t.x-102,t.x-62,t.y,t.z,52,mAlu,pT);torus(V(t.x-82,t.y,t.z),42,15,mAlu,pT);compOut=V(t.x-82,t.y+50,t.z);end=V(t.x+10,t.y-56,t.z);pT.pin=t.clone();}
    const pLine=P("Ligne d'échappement",'Descente vers le silencieux'),p2=V(Math.max(end.x+60,Lx*.6),end.y-70,end.z-20),p3=V(Lx+170,-Hh-110,end.z-20),p4=V(Lx+420,-Hh-115,(end.z-20)*.85);tube([end,p2,p3,p4],26,mPipe,pLine);pLine.pin=p4.clone();
    if(S.cat!=='none'){const pCat=P('Catalyseur','Traite les gaz d\'échappement');cyl(p3.clone().lerp(p4,.22),p3.clone().lerp(p4,.78),50,mSteel,pCat);cone(p3.clone().lerp(p4,.1),p3.clone().lerp(p4,.22),27,50,mSteel,pCat);cone(p3.clone().lerp(p4,.78),p3.clone().lerp(p4,.9),50,27,mSteel,pCat);pCat.pin=p3.clone().lerp(p4,.5);}
    if(ecu){const pLam=P('Sonde lambda',"Mesure l'oxygène des gaz pour corriger la richesse"),m=p2.clone().lerp(p3,.4);cyl(m,V(m.x,m.y+50,m.z-24),8,mSens,pLam);pLam.pin=V(m.x,m.y+50,m.z-24);}
    if(compOut){const pCh=P("Tuyau d'air comprimé",'Du compresseur au papillon');tube([compOut,V(compOut.x-60,compOut.y+30,compOut.z-40),V(-160,(compOut.y+tb.y)/2,tb.z-70),V(tb.x-110,tb.y,tb.z),V(tb.x-28,tb.y,tb.z)],26,mAlu,pCh);}
    else if(ecu){const pAb=P('Boîte à air et filtre','Filtre et calme l\'air aspiré');box(0,tb.x-240,tb.y,tb.z,190,130,160,mBlk,pAb);tube([V(tb.x-28,tb.y,tb.z),V(tb.x-90,tb.y,tb.z),V(tb.x-150,tb.y,tb.z)],32,mBlk,pAb);pAb.pin=V(tb.x-240,tb.y+65,tb.z);}
    // façade, accessoires, volant
    const pTim=P('Carter avant','Abrite la pompe à huile et le pignon fixe qui guide les rotors',{shell:1});box(0,-30,0,0,20,2*Hh-20,2*Hw-20,mTim,pTim);
    const beltP=[],acc=(nm,ds,y,z,x1,rad,m,pr)=>{const p=P(nm,ds);cylX(-38,x1,y,z,rad,m,p);cylX(-76,-52,y,z,pr,mSteel,p);cylX(-52,-38,y,z,12,mSteel,p);beltP.push({y,z,r:pr});return p;};
    acc('Alternateur','Recharge la batterie',Hh*.55,Hw+72,70,50,mAlu,26);acc('Compresseur de climatisation','Entraîné par la courroie',-Hh*.6,Hw+70,80,46,mSteel,30);
    const pW=P('Pompe à eau','Fait circuler le liquide de refroidissement');cylX(-52,-40,Hh-30,-30,40,mAlu,pW);cylX(-76,-52,Hh-30,-30,34,mSteel,pW);beltP.push({y:Hh-30,z:-30,r:34});
    const spin=[],gP=new T.Group();root.add(gP);spin.push(gP);const pPu=P('Poulie d\'arbre excentrique','Entraîne la courroie d\'accessoires',{keep:1});cylX(-76,-52,0,0,52,mSteel,pPu,gP);cylX(-80,-76,26,0,8,mBlk,pPu,gP);pPu.pin=V(-76,0,0);beltP.push({y:0,z:0,r:52});
    const cy0=beltP.reduce((u,q)=>u+q.y,0)/4,cz0=beltP.reduce((u,q)=>u+q.z,0)/4,bp=beltP.filter(q=>q.r<52||Math.hypot(q.y-cy0,q.z-cz0)>20).map(q=>{const d=Math.hypot(q.y-cy0,q.z-cz0)||1;return {an:Math.atan2(q.z-cz0,q.y-cy0),v:V(-64,q.y+(q.y-cy0)/d*q.r,q.z+(q.z-cz0)/d*q.r)};}).sort((u,v)=>u.an-v.an).map(q=>q.v);
    const pBe=P("Courroie d'accessoires",'Entraîne alternateur, pompe à eau et climatisation');if(bp.length>2) tube(bp,5,mBlk,pBe,true);pBe.pin=bp[0].clone();
    const gF=new T.Group();root.add(gF);spin.push(gF);const pFw=P('Volant moteur','Régularise la rotation et porte l\'embrayage',{keep:1});cylX(Lx+6,Lx+30,0,0,R+38,mSteel,pFw,gF);for(let i=0;i<6;i++){const an=i*Math.PI/3;cylX(Lx+30,Lx+36,Math.cos(an)*R*.4,Math.sin(an)*R*.4,8,mBlk,pFw,gF);}pFw.pin=V(Lx+30,R*.5,0);
    const pSt=P('Démarreur','Lance le moteur');cylX(Lx-100,Lx+2,Hh*.5,Hw+46,32,mIron,pSt);
    const pOf=P('Filtre à huile','Monté sur le dessus, à l\'arrière');cyl(V(Lx-sp/2,Hh,20),V(Lx-sp/2,Hh+85,20),34,mFil,pOf);
    const pTh=P('Boîtier de thermostat et durit','Envoie le liquide chaud vers le radiateur');box(0,-10,Hh+16,40,30,32,36,mAlu,pTh);tube([V(-10,Hh+16,40),V(-90,Hh+30,60),V(-200,Hh,70)],16,mBlk,pTh);pTh.pin=V(-10,Hh+32,40);
    if(ecu){const pCk=P('Capteur de régime','Lit la position de l\'arbre excentrique');cyl(V(-44,-Hh*.5,-Hw*.5),V(-44,-Hh*.5-10,-Hw*.5-36),9,mSens,pCk);pCk.pin=V(-44,-Hh*.5-10,-Hw*.5-36);
      const pKn=P('Capteur de cliquetis','Surveille la combustion sur le carter');cyl(V(xs[0],Hh,-30),V(xs[0],Hh+22,-30),14,mSens,pKn);pKn.pin=V(xs[0],Hh+22,-30);}
    return fin({crank:gC,spin,cyls:[],valves:[],rotors});
  }
  // cotes
  const bore=S.bore,stroke=S.stroke,r=stroke/2,l=stroke*1.7,pc=bore*.34,ph=bore*.62,deck=r+l+pc+3,vt=S.valvetrain;
  const headH=bore*.5+(vt==='ohv'?22:vt==='sohc'?40:52),Rc=r+34,pitch=bore+9,two=c.lay!=='I',flat=c.lay==='F',k=two?c.n/2:c.n,fire=BANKFIRE[k]||BANKFIRE[4];
  const pitchB=c.w?pitch*.62:pitch,bw=c.w?bore*.55:0,hb=bore/2+bw/2;
  const Lx=40+k*pitchB+(two?pitch*.4:0),a=two?(flat?Math.PI/2:c.ang/2*Math.PI/180):0,dz=E.dz,ecu=S.fuelSys!=='carb'&&S.fuelSys!=='idi';
  const banks=(two?[{b:-a,out:-1},{b:a,out:1}]:[{b:0,out:1}]).map((bk,bi)=>{bk.xs=[];for(let i=0;i<k;i++) bk.xs.push(20+(bi?pitch*.4:0)+pitchB*(i+.5));return bk;});
  const b0=banks[0].b,o0=banks[0].out,nb=banks.length;
  // carcasse
  const pBlock=P('Bloc-cylindres',`${BLOCK[S.blockMat].n}, ${c.full.replace(/^./,x=>x.toLocaleLowerCase())}, cylindres : ${LINER[S.liner].n.replace(/^./,x=>x.toLocaleLowerCase())}`,{shell:1});
  banks.forEach(bk=>box(bk.b,Lx/2,(deck+Rc*.4)/2,0,Lx,deck-Rc*.4,bore+bw+38,mBlock,pBlock));
  cylX(0,Lx,0,0,Rc+14,mBlock,pBlock);
  if(!flat) box(0,Lx/2,-Rc*.5,0,Lx,Rc,2*(Rc+14),mBlock,pBlock);
  banks.forEach((bk,bi)=>{for(let i=0;i<=k;i++){const x=clamp(20+(bi?pitch*.4:0)+pitch*i,6,Lx-6);for(const sg of [-1,1]) box(bk.b,x,deck*.62,sg*(hb+21),8,deck*.5,6,mBlock,pBlock);}
    bk.xs.forEach(x=>cyl(rotB(bk.b,x,deck*.4,-bk.out*(hb+19)),rotB(bk.b,x,deck*.4,-bk.out*(hb+23)),13,mSteel,pBlock));});
  cylX(Lx-8,Lx+4,0,0,Rc+86,mBlock,pBlock);
  pBlock.pin=rotB(b0,Lx*.3,deck*.55,-o0*(hb+19));
  const pPan=P("Carter d'huile",'Réserve et refroidit l\'huile moteur',{shell:1});
  if(flat) box(0,Lx/2,-Rc-28,0,Lx-40,44,2*Rc,mPan,pPan); else{box(0,Lx/2,-Rc-42,0,Lx-30,74,2*Rc,mPan,pPan);for(let x=50;x<Lx-40;x+=55) box(0,x,-Rc-44,0,5,66,2*Rc+8,mPan,pPan);}
  cyl(V(Lx*.5,-Rc-(flat?50:79),0),V(Lx*.5,-Rc-(flat?60:90),0),11,mSteel,pPan);
  {const pO=P('Huile moteur','Son niveau dans le carter suit la quantité réglée dans « Lubrification »',{inner:1}),om=new T.Mesh(new T.BoxGeometry(Lx-(flat?48:38),1,2*Rc-8),new T.MeshStandardMaterial({color:0xc98a1b,transparent:true,opacity:.82,roughness:.2,metalness:.1}));om.position.set(Lx/2,0,0);add(om,pO);oilRef={me:om,y0:-Rc-(flat?50:79),hh:flat?44:74};}pPan.pin=V(Lx*.3,-Rc-(flat?28:42),Rc);
  const pHead=P(nb>1?'Culasses':'Culasse',`${S.headMat==='alu'?'Aluminium':'Fonte'}, ${VT[vt].n.replace(/^./,x=>x.toLocaleLowerCase())}`,{shell:1});
  const pCov=P(nb>1?'Couvre-culasses':'Couvre-culasse','Ferme le haut moteur, sous lequel tournent les arbres à cames',{shell:1});
  banks.forEach(bk=>{box(bk.b,Lx/2,deck+headH/2,0,Lx,headH,bore+bw+56,mHead,pHead);box(bk.b,Lx/2,deck+headH+17,0,Lx-16,34,bore+bw+38,mCover,pCov);
    bk.xs.forEach(x=>{for(const sg of [-1,1]){box(bk.b,x,deck+headH*.48,sg*(hb+29),bore*.66,headH*.5,5,mHead,pHead);cyl(rotB(bk.b,x-pitch*.42,deck+headH+2,sg*(hb+13)),rotB(bk.b,x-pitch*.42,deck+headH+10,sg*(hb+13)),5,mSteel,pCov);}});
    if(vt.indexOf('dohc')===0) for(const sg of [-1,1]) cyl(rotB(bk.b,12,deck+headH+30,sg*bore*.27),rotB(bk.b,Lx-12,deck+headH+30,sg*bore*.27),22,mCover,pCov);});
  pHead.pin=rotB(b0,Lx*.75,deck+headH*.5,-o0*(hb+28));pCov.pin=rotB(banks[nb-1].b,Lx*.8,deck+headH+36,0);
  const pTim=P('Carter de distribution',`Protège la ${TIMING[S.timing].n.replace(/^./,x=>x.toLocaleLowerCase())} qui entraîne ${vt==='ohv'?"l'arbre à cames central":'les arbres à cames'}`,{shell:1});
  banks.forEach(bk=>box(bk.b,-10,(deck+headH)/2+Rc*.2,0,20,deck+headH-Rc*.4,bore+bw+46,mTim,pTim));cylX(-20,0,0,0,Rc+12,mTim,pTim);
  pTim.pin=rotB(b0,-20,deck*.75,0);
  // entraînement de la distribution (visible en écorché)
  {const tmk=S.timing,pD=P(`Distribution par ${TIMING[tmk].n.replace(/^./,x=>x.toLocaleLowerCase())}`,`${TIMING[tmk].d} · ${nf(E.tmMass,1)} kg`,{inner:1}),xd=-10;
    const mG=tmk==='gear'?MT(0x9aa3ad,.4,.85):mSteel,mL=tmk==='belt'?MT(0x15171a,.8,.05):MT(0x565d66,.45,.8);
    const disc=(q,rad)=>{const me=new T.Mesh(new T.CylinderGeometry(rad,rad,tmk==='gear'?12:9,tmk==='gear'?Math.max(14,Math.round(rad/2.2)):24),mG);me.rotation.z=Math.PI/2;me.position.copy(q);const r=add(me,pD);edge(me,1);return r;};
    disc(V(xd,0,0),28);
    const sets=vt==='ohv'?[[V(xd,Rc+24,0)]]:banks.map(bk=>(vt==='sohc'?[0]:[-1,1]).map(sg=>rotB(bk.b,xd,deck+headH*.78,sg*bore*.27)));
    const rc=vt==='ohv'?48:Math.min(46,bore*.25);
    sets.forEach((cs,si)=>{cs.forEach(q=>disc(q,rc));
      if(tmk==='gear'){const mid=cs.reduce((u,q)=>u.add(q),V(0,0,0)).multiplyScalar(1/cs.length),D=mid.length(),free=D-28-(cs.length>1?rc*.7:rc),m=Math.max(1,Math.ceil(free/84)),ri=free/(2*m),dir=mid.clone().setX(0).normalize();
        for(let i=0;i<m;i++){const q=dir.clone().multiplyScalar(28+ri*(2*i+1));q.x=xd+(si?6:0);disc(q,ri);}}
      else{const pts=[{y:0,z:0,r:28}].concat(cs.map(q=>({y:q.y,z:q.z,r:rc}))),cy=pts.reduce((u,q)=>u+q.y,0)/pts.length,cz=pts.reduce((u,q)=>u+q.z,0)/pts.length;
        const loop=[];pts.forEach(q=>{const an=Math.atan2(q.z-cz,q.y-cy);for(const da of [-.9,0,.9]) loop.push({an:an+da*.5,v:V(xd+(si?5:0),q.y+Math.cos(an+da)*q.r,q.z+Math.sin(an+da)*q.r)});});
        tube(loop.sort((u,v)=>u.an-v.an).map(u=>u.v),tmk==='belt'?5:4,mL,pD,true);}});
    pD.pin=sets[0][0].clone();}
  // allumage
  if(dz){const pG=P('Bougies de préchauffage','Réchauffent la chambre pour le démarrage à froid : un diesel n\'a pas d\'allumage');banks.forEach(bk=>bk.xs.forEach(x=>cyl(rotB(bk.b,x,deck+headH+30,0),rotB(bk.b,x,deck+headH+58,0),6,mSteel,pG)));pG.pin=rotB(b0,banks[0].xs[k-1],deck+headH+58,0);}
  else if(ecu){const pC=P("Bobines d'allumage",'Une bobine crayon par cylindre, posée sur la bougie');banks.forEach(bk=>bk.xs.forEach(x=>{cyl(rotB(bk.b,x,deck+headH+30,0),rotB(bk.b,x,deck+headH+66,0),13,mBlk,pC);cyl(rotB(bk.b,x,deck+headH+66,0),rotB(bk.b,x,deck+headH+74,0),16,mSteel,pC);box(bk.b,x+17,deck+headH+70,0,16,10,14,mBlk,pC);}));pC.pin=rotB(b0,banks[0].xs[k-1],deck+headH+74,0);}
  else{const pD=P('Allumeur','Distribue la haute tension aux bougies');cyl(rotB(b0,Lx-30,deck+headH+30,0),rotB(b0,Lx-30,deck+headH+95,0),30,mBlk,pD);cyl(rotB(b0,Lx-30,deck+headH+95,0),rotB(b0,Lx-30,deck+headH+115,0),34,MT(0x7a2c22,.5,.1),pD);}
  if(ecu){const pHa=P('Faisceau électrique','Relie bobines, injecteurs et capteurs au calculateur'),mH=MT(0x101215,.85,0);banks.forEach(bk=>{const hy=deck+headH+44,hz=-bk.out*(hb+6);cyl(rotB(bk.b,bk.xs[0]-34,hy,hz),rotB(bk.b,bk.xs[k-1]+34,hy,hz),7,mH,pHa);if(!dz) bk.xs.forEach(x=>cyl(rotB(bk.b,x+17,hy,hz),rotB(bk.b,x+17,deck+headH+70,0),3.5,mH,pHa));tube([rotB(bk.b,bk.xs[k-1]+34,hy,hz),rotB(bk.b,Lx+20,hy-30,hz*1.4),V(Lx+60,rotB(bk.b,0,hy-90,hz*1.6).y,rotB(bk.b,0,hy-90,hz*1.6).z)],7,mH,pHa);pHa.pin=rotB(bk.b,Lx*.5,hy,hz);});}
  const pCap=P("Bouchon de remplissage d'huile",'Sur le couvre-culasse');{const cx=banks[0].xs[0]+pitchB*.5,cz=c.w?bore*.42:0;cyl(rotB(b0,cx,deck+headH+34,cz),rotB(b0,cx,deck+headH+52,cz),c.w?15:20,mBlk,pCap);}
  // échappement
  const pEx=P(nb>1?"Collecteurs d'échappement":"Collecteur d'échappement",{cast:'Fonte moulée : compact et durable, mais restrictif',tub:'Tubulaire : tubes de même longueur pour mieux vider les cylindres',race:'Course : tubes longs accordés pour les hauts régimes'}[S.manifold]);
  banks.forEach(bk=>{const {b,out,xs}=bk,port=x=>rotB(b,x,deck+headH*.45,out*(hb+28));
    xs.forEach(x=>box(b,x,deck+headH*.45,out*(hb+35),bore*.6,46,7,mExh,pEx));
    if(S.manifold==='cast'){const lg=x=>rotB(b,x,deck+headH*.2,out*(hb+85));cyl(lg(xs[0]-18),lg(xs[k-1]+18),26,mExh,pEx);xs.forEach(x=>cyl(port(x),lg(x),18,mExh,pEx));bk.col=lg((xs[0]+xs[k-1])/2);}
    else{const xc=S.manifold==='race'?xs[k-1]:(xs[0]+xs[k-1])/2;bk.col=rotB(b,xc,deck-90,out*(hb+140));xs.forEach(x=>tube([port(x),rotB(b,x,deck+headH*.45,out*(hb+85)),rotB(b,lerp(x,xc,.6),deck-20,out*(hb+140)),bk.col],S.manifold==='race'?17:15,mExh,pEx));ball(bk.col,30,mExh,pEx);}
    pEx.pin=port(xs[0]);});
  let ends=banks.map(bk=>bk.col),compOut=[];
  if(E.turbo){
    const nt=E.nt,bi=nt>1,pT=P(bi?'Turbocompresseurs':'Turbocompresseur',`${nt>1?nt+' turbos, '+STAGE[E.stg].n.replace(/^./,x=>x.toLocaleLowerCase())+' · ':''}${TURBO[S.turboType].n}, ${BEAR[S.turboBearing].n.replace(/^./,x=>x.toLocaleLowerCase())}, ${nf(S.boost,2)} bar de suralimentation`);
    const mk=t=>{cylX(t.x-25,t.x+25,t.y,t.z,58,mTurb,pT);cylX(t.x-62,t.x-25,t.y,t.z,S.turboType==='et'?36:24,S.turboType==='et'?mCu:mSteel,pT);if(S.turboType==='vgt'){cylX(t.x-20,t.x+20,t.y-66,t.z,15,mSteel,pT);}cylX(t.x-102,t.x-62,t.y,t.z,52,mAlu,pT);cylX(t.x-120,t.x-102,t.y,t.z,30,mAlu,pT);torus(V(t.x,t.y,t.z),46,17,mTurb,pT);torus(V(t.x-82,t.y,t.z),42,15,mAlu,pT);cylX(t.x-78,t.x-44,t.y+76,t.z,19,mSteel,pT);cyl(V(t.x-44,t.y+76,t.z),V(t.x+6,t.y+52,t.z),3,mSteel,pT);cylX(t.x-50,t.x-36,t.y+30,t.z,7,mCu,pT);compOut.push(V(t.x-82,t.y+50,t.z));return V(t.x+10,t.y-56,t.z);};
    const feed=(p,t)=>tube([p,V(Lx+95,p.y,p.z),V(Lx+175,(p.y+t.y)/2,p.z*.5),t],24,mExh,pT);
    if(!two){const cl=banks[0].col,ts=[];for(let i=0;i<nt;i++) ts.push(V(cl.x+(i-(nt-1)/2)*188,cl.y+12,cl.z+(nt>1?48:52)));ends=ts.map(t=>{cyl(cl,t,24,mExh,pT);return mk(t);});}
    else if(bi){ends=[];banks.forEach((bk,bi2)=>{const cnt=nt===4?2:nt===3?(bi2?1:2):1;for(let i=0;i<cnt;i++){const t=V(bk.col.x+150-i*190,bk.col.y-(flat?12:70),bk.col.z+(flat?0:bk.out*40));cyl(bk.col,t,24,mExh,pT);ends.push(mk(t));}});}
    else{const t=V(Lx+200,flat?-Rc-70:deck*Math.cos(a)*.55,0);banks.forEach(bk=>feed(bk.col,t));ends=[mk(t)];}
    pT.pin=pT.meshes[0].position.clone();
  }
  const pLine=P("Ligne d'échappement",'Descente vers le silencieux, sous le plancher'),pCat=S.cat!=='none'?P(ends.length>1?'Catalyseurs':'Catalyseur',S.cat==='tri'?'Trois voies : traite CO, HC et NOx':'Haut débit : dépollue avec moins de contre-pression'):null,pLam=ecu?P(ends.length>1?'Sondes lambda':'Sonde lambda',"Mesure l'oxygène des gaz pour corriger la richesse"):null;
  ends.forEach(e=>{const zs=e.z||(.001),zo=Math.sign(zs)*Math.max(Math.abs(zs)*1.12,Rc+150),p2=V(Math.max(e.x+50,185),e.y-90,zo),p3=V(Math.max(Lx+150,e.x+160),-Rc-135,zo),p4=V(Math.max(Lx+400,e.x+410),-Rc-140,zo*.85);
    tube([e,p2,p3,p4],26,mPipe,pLine);pLine.pin=p4.clone();
    for(let i=0;i<4;i++){const u=.5+i*.09;cyl(p2.clone().lerp(p3,u),p2.clone().lerp(p3,u+.045),31,mSteel,pLine);}
    if(pCat){cyl(p3.clone().lerp(p4,.22),p3.clone().lerp(p4,.78),50,mSteel,pCat);cone(p3.clone().lerp(p4,.1),p3.clone().lerp(p4,.22),27,50,mSteel,pCat);cone(p3.clone().lerp(p4,.78),p3.clone().lerp(p4,.9),50,27,mSteel,pCat);pCat.pin=p3.clone().lerp(p4,.5);}
    if(pLam){const m=p2.clone().lerp(p3,.45);cyl(m,V(m.x,m.y+52,m.z+Math.sign(zs)*26),8,mSens,pLam);cyl(V(m.x,m.y+52,m.z+Math.sign(zs)*26),V(m.x,m.y+66,m.z+Math.sign(zs)*33),5,mBlk,pLam);pLam.pin=V(m.x,m.y+52,m.z+Math.sign(zs)*26);}});
  // admission
  const mIn=ecu?mBlk:mAlu,pIn=P("Collecteur d'admission",`${INTAKE[S.intake].n} : répartit l'air entre les cylindres`);
  let tb,plTop;
  if(!two){const plY=deck+headH+15,plZ=-(hb+155);cylX(30,Lx-30,plY,plZ,44,mIn,pIn);ball(V(30,plY,plZ),44,mIn,pIn);ball(V(Lx-30,plY,plZ),44,mIn,pIn);banks[0].xs.forEach(x=>box(0,x,deck+headH*.55,-(hb+35),bore*.6,44,7,mIn,pIn));banks[0].xs.forEach(x=>tube([rotB(0,x,deck+headH*.55,-(hb+28)),V(x,deck+headH*.95,-(hb+95)),V(x,plY,plZ)],19,mIn,pIn));tb=V(0,plY,plZ);plTop=V(Lx/2,plY+44,plZ);}
  else{const yTop=flat?bore/2+222:(deck+headH)*Math.cos(a)+48,wPl=flat?180:clamp(deck*Math.sin(a)*.9,110,260),x0=flat?150:25;
    box(0,(x0+Lx-25)/2,yTop,0,Lx-25-x0,56,wPl,mIn,pIn);
    banks.forEach(bk=>bk.xs.forEach(x=>{const pt=rotB(bk.b,x,deck+headH*.55,-bk.out*(hb+28)),xe=clamp(x,x0+15,Lx-40);tube([pt,V(lerp(x,xe,.5),(pt.y+yTop)/2+12,pt.z*.72),V(xe,yTop-12,Math.sign(pt.z)*wPl*.32)],18,mIn,pIn);}));
    tb=V(x0-10,yTop,0);plTop=V((x0+Lx)/2,yTop+28,0);}
  pIn.pin=plTop.clone();
  if(E.sc){const pS=P('Compresseur volumétrique',`${SCT[S.scType].n}, entraîné par courroie, ${nf(S.boost,2)} bar`);box(0,plTop.x,plTop.y+46,plTop.z,Lx*.55,86,130,mAlu,pS);for(let i=0;i<5;i++) box(0,plTop.x-Lx*.2+i*Lx*.1,plTop.y+92,plTop.z,8,10,130,mSteel,pS);cylX(-50,plTop.x-Lx*.27,plTop.y+46,plTop.z,14,mSteel,pS);}
  const beltP=[];
  if(!ecu&&!dz){const pK=P('Carburateur',"Dose l'essence par dépression, sans électronique");box(0,plTop.x,plTop.y+32,plTop.z,80,64,80,mAlu,pK);cyl(V(plTop.x,plTop.y+64,plTop.z),V(plTop.x,plTop.y+116,plTop.z),110,mBlk,pK);pK.pin=V(plTop.x,plTop.y+116,plTop.z);}
  else{
    if(dz){const pIn=P("Entrée d'air sans papillon","Un diesel ne règle pas l'air : sa puissance dépend seulement de la quantité de gazole injectée. Seul un volet d'arrêt et la vanne EGR équipent l'admission.");cylX(tb.x-28,tb.x+28,tb.y,tb.z,36,mAlu,pIn);cylX(tb.x-32,tb.x-28,tb.y,tb.z,41,mSteel,pIn);
      if(ecu){const pE=P('Vanne EGR',"Réinjecte une partie des gaz d'échappement à l'admission pour limiter les oxydes d'azote");box(0,tb.x,tb.y+48,tb.z,46,40,46,mAlu,pE);cyl(V(tb.x,tb.y+68,tb.z),V(tb.x,tb.y+98,tb.z),14,mSens,pE);}}
    else{const pTb=P('Boîtier papillon',"Règle le débit d'air selon l'accélérateur");cylX(tb.x-28,tb.x+28,tb.y,tb.z,36,mAlu,pTb);cylX(tb.x-32,tb.x-28,tb.y,tb.z,41,mSteel,pTb);cylX(tb.x+28,tb.x+32,tb.y,tb.z,41,mSteel,pTb);box(0,tb.x,tb.y-44,tb.z,34,26,44,mBlk,pTb);}
    if(ecu&&!dz){const pTps=P('Capteur de position papillon',"Indique au calculateur l'ouverture du papillon");box(0,tb.x,tb.y+42,tb.z,26,16,30,mSens,pTps);}
    if(ecu){const pMap=P("Capteur de pression d'admission",'Mesure la charge du moteur dans le plénum');{const mx=plTop.x+Lx*(E.sc?.36:.2);cyl(V(mx,plTop.y-4,plTop.z),V(mx,plTop.y+26,plTop.z),11,mSens,pMap);pMap.pin=V(mx,plTop.y+26,plTop.z);}}
    if(S.fuelSys==='mono'){const pM=P('Injecteur monopoint','Un seul injecteur, monté sur le boîtier papillon');cyl(V(tb.x-10,tb.y+30,tb.z-14),V(tb.x-10,tb.y+62,tb.z-22),9,mSteel,pM);}
    if(E.turbo){
      const pCh=P("Tuyau d'air comprimé",dz?"Du compresseur au collecteur d'admission":'Du compresseur au papillon'),pIc=S.intercooler!=='none'?P(S.intercooler==='air'?'Échangeur air/air':'Échangeur air/eau',"Refroidit l'air comprimé : plus dense, moins de cliquetis"):null,icP=V(-300,deck*.3,0);
      if(pIc) box(0,icP.x,icP.y,icP.z,60,190,400,mAlu,pIc);
      compOut.forEach(co=>{const rear=co.x>Lx,zo=rear?0:flat?co.z*.5:(co.z||1)*1.22+Math.sign(co.z||1)*14,yo=flat?-32:10;
        const via=rear?[V(co.x,tb.y+140,0),V(Lx*.5,tb.y+150,0),V(-110,tb.y+125,0)]:[V(co.x-45,co.y+yo,zo),V(-150,co.y+yo,zo)];
        if(pIc) tube([co].concat(via,[V(icP.x+30,icP.y+70,rear?0:clamp(zo,-175,175))]),26,mAlu,pCh);
        else tube([co].concat(via,rear?[V(tb.x-80,tb.y+40,tb.z),V(tb.x-28,tb.y,tb.z)]:[V(-170,(co.y+tb.y)/2,(zo+tb.z)/2),V(tb.x-110,tb.y,tb.z),V(tb.x-28,tb.y,tb.z)]),26,mAlu,pCh);});
      if(pIc) tube([V(icP.x+30,icP.y-10,clamp(tb.z,-150,150)+(two?120:0)),V(-200,(icP.y+tb.y)/2,tb.z+(two?130:0)),V(tb.x-120,tb.y+(two?30:0),tb.z+(two?50:0)),V(tb.x-28,tb.y,tb.z)],26,mAlu,pCh);
    }else{
      const pAb=P('Boîte à air et filtre','Filtre et calme l\'air aspiré');box(0,tb.x-250,tb.y,tb.z,200,140,170,mBlk,pAb);tube([V(tb.x-28,tb.y,tb.z),V(tb.x-90,tb.y,tb.z),V(tb.x-160,tb.y,tb.z)],34,mBlk,pAb);pAb.pin=V(tb.x-250,tb.y+70,tb.z);
      if(!E.sc&&ecu){const pMaf=P("Débitmètre d'air","Mesure la masse d'air aspirée");cyl(V(tb.x-95,tb.y+28,tb.z),V(tb.x-95,tb.y+60,tb.z),13,mSens,pMaf);pMaf.pin=V(tb.x-95,tb.y+60,tb.z);}
    }
    if(S.fuelSys!=='mono'){const di=S.fuelSys==='di'||dz,pR=P(S.fuelSys==='cr'?'Rampe commune et injecteurs':S.fuelSys==='idi'?'Injecteurs et tuyauteries':"Rampe d'injection et injecteurs",S.fuelSys==='cr'?'Gazole stocké à plus de 1 500 bar, injecté en plusieurs fois':S.fuelSys==='idi'?'Injection dans une préchambre, commandée mécaniquement':di?'Injection directe : essence sous haute pression dans la chambre':'Un injecteur par cylindre, dans le conduit d\'admission');
      banks.forEach(bk=>{const ry=deck+headH*(di?.35:.8),rz=-bk.out*(hb+(di?34:52));cyl(rotB(bk.b,bk.xs[0]-20,ry,rz),rotB(bk.b,bk.xs[k-1]+20,ry,rz),7,mSteel,pR);bk.xs.forEach(x=>cyl(rotB(bk.b,x,ry,rz),rotB(bk.b,x,ry-24,rz+bk.out*22),7,MT(0x2e6b4a,.5,.2),pR));pR.pin=rotB(bk.b,bk.xs[k-1]+20,ry,rz);});
      if(di){const pH=P(S.fuelSys==='idi'?"Pompe d'injection mécanique":'Pompe haute pression',S.fuelSys==='idi'?'Dose et distribue le gazole à chaque cylindre':dz?'Alimente la rampe commune':"Entraînée par l'arbre à cames, jusqu'à 200 bar");box(b0,Lx-30,deck+headH*.6,-o0*(hb+50),44,50,40,mSteel,pH);}}
  }
  // refroidissement
  const pTh=P('Boîtier de thermostat et durit','Envoie le liquide chaud vers le radiateur'),thP=rotB(b0,18,deck+headH*.35,-o0*(hb+42));
  box(b0,18,deck+headH*.35,-o0*(hb+42),32,36,30,mAlu,pTh);tube([thP,V(-70,thP.y+10,thP.z*(two?1.25:1.05)),V(-190,thP.y-20,two?Math.sign(thP.z)*Math.max(Math.abs(thP.z)*1.6,160):thP.z*.9)],16,mBlk,pTh);pTh.pin=thP.clone();
  if(ecu){const pCt=P("Sonde de température d'eau",'Pilote l\'enrichissement à froid et le ventilateur');cyl(thP,rotB(b0,18,deck+headH*.35+34,-o0*(hb+48)),8,mSens,pCt);pCt.pin=rotB(b0,18,deck+headH*.35+34,-o0*(hb+48));}
  // accessoires
  const acc=(nm,ds,y,z,x1,rad,m,pr)=>{const p=P(nm,ds);cylX(-12,x1,y,z,rad,m,p);pulley(y,z,pr,p);cylX(-26,-12,y,z,12,mSteel,p);cylX(-12,-4,y,z,rad+2,mSteel,p);cylX(x1-8,x1,y,z,rad+2,mSteel,p);if(m===mAlu){cylX(x1*.3,x1*.6,y,z,rad+1,mCu,p);box(0,x1+8,y,z,16,30,36,mBlk,p);}else{cylX(-26,-18,y,z,pr+8,mBlk,p);cyl(V(x1-25,y+rad-6,z),V(x1-25,y+rad+22,z),9,mAlu,p);cyl(V(x1-55,y+rad-6,z),V(x1-55,y+rad+22,z),9,mAlu,p);}beltP.push({y,z,r:pr});return p;};
  const sy=flat?Rc+78:c.lay==='V'?-Rc*.62:-Rc*.3,sz=flat?88:c.lay==='V'?Rc+88:Rc+100;
  acc('Alternateur','Recharge la batterie et alimente le réseau de bord',sy,-sz,95,56,mAlu,28);
  acc('Compresseur de climatisation','Entraîné par la courroie d\'accessoires',sy,sz,110,50,mSteel,34);
  const wy=flat?-(Rc+50):Rc+78,pW=P('Pompe à eau','Fait circuler le liquide de refroidissement');cylX(-24,4,wy,0,46,mAlu,pW);pulley(wy,0,40,pW);beltP.push({y:wy,z:0,r:40});
  if(E.sc){cylX(-50,-26,plTop.y+46,plTop.z,30,mSteel,parts.find(p=>p.name==='Compresseur volumétrique'));beltP.push({y:plTop.y+46,z:plTop.z,r:30});}
  const spin=[],gP=new T.Group();root.add(gP);spin.push(gP);
  const pPu=P('Poulie de vilebrequin','Amortit les vibrations et entraîne la courroie',{keep:1});pulley(0,0,62,pPu,gP);cylX(-24,-20,0,0,66,mBlk,pPu,gP);for(let i=0;i<5;i++){const an=i*Math.PI*.4;cylX(-56,-50,Math.cos(an)*30,Math.sin(an)*30,6,mBlk,pPu,gP);}pPu.pin=V(-52,0,0);beltP.push({y:0,z:0,r:62});
  const cy0=beltP.reduce((s,p)=>s+p.y,0)/beltP.length,cz0=beltP.reduce((s,p)=>s+p.z,0)/beltP.length;
  const bp=beltP.filter(p=>p.r<62||Math.hypot(p.y-cy0,p.z-cz0)>20).map(p=>{const d=Math.hypot(p.y-cy0,p.z-cz0)||1;return {an:Math.atan2(p.z-cz0,p.y-cy0),v:V(-38,p.y+(p.y-cy0)/d*p.r,p.z+(p.z-cz0)/d*p.r)};}).sort((u,v)=>u.an-v.an).map(p=>p.v);
  const pBe=P("Courroie d'accessoires",'Entraîne alternateur, pompe à eau et climatisation');if(bp.length>2) tube(bp,5,mBlk,pBe,true);pBe.pin=bp[0].clone();
  const gF=new T.Group();root.add(gF);spin.push(gF);
  const pFw=P('Volant moteur','Régularise la rotation et porte l\'embrayage',{keep:1});cylX(Lx+6,Lx+30,0,0,Rc+72,mSteel,pFw,gF);{const rg=new T.Mesh(new T.CylinderGeometry(Rc+78,Rc+78,9,90),mSteel);rg.rotation.z=Math.PI/2;rg.position.x=Lx+11;gF.add(rg);pFw.meshes.push(rg);edge(rg,1);}cylX(Lx+30,Lx+40,0,0,Rc+34,mIron,pFw,gF);for(let i=0;i<6;i++){const an=i*Math.PI/3;cylX(Lx+30,Lx+36,Math.cos(an)*(Rc+30),Math.sin(an)*(Rc+30),9,mBlk,pFw,gF);}pFw.pin=V(Lx+30,Rc+50,0);
  const stZ=flat?-88:c.lay==='V'?-(Rc+64):-(Rc+60),stY=flat?Rc+52:c.lay==='V'?-Rc*.62:-Rc*.1,pSt=P('Démarreur','Lance le moteur en entraînant la couronne du volant');cylX(Lx-110,Lx+2,stY,stZ,36,mIron,pSt);cylX(Lx-90,Lx-20,stY+46,stZ,18,mSteel,pSt);cylX(Lx+2,Lx+16,stY,stZ,22,mSteel,pSt);cylX(Lx-118,Lx-110,stY,stZ,30,mBlk,pSt);
  // lubrification
  const pOf=P('Filtre à huile','Retient les particules métalliques');
  if(flat) cyl(V(Lx-75,-Rc-48,0),V(Lx-75,-Rc-128,0),34,mFil,pOf); else{const fx=clamp(Lx*.5,150,Math.max(150,Lx-165)),fy=c.lay==='V'?-Rc-20:-Rc*.55;if(c.lay==='V') cyl(V(fx,-Rc-70,0),V(fx,-Rc-160,0),34,mFil,pOf);else cyl(V(fx,fy,-(Rc+14)),V(fx,fy-28,-(Rc+104)),33,mFil,pOf);}
  if(ecu){const q=flat?V(Lx-130,-Rc-50,0):c.lay==='V'?V(clamp(Lx*.5,150,Math.max(150,Lx-165))+50,-Rc-70,0):V(clamp(Lx*.5,150,Math.max(150,Lx-165))+48,-Rc*.55,-(Rc+14)),pOp=P("Capteur de pression d'huile",'Allume le témoin si la pression chute');cyl(q,V(q.x,q.y-(flat?40:10),q.z-(flat?0:38)),10,mSens,pOp);pOp.pin=V(q.x,q.y-(flat?40:10),q.z-(flat?0:38));}
  if(S.sump==='dry'){const pDs=P("Réservoir d'huile (carter sec)",'Une pompe de vidange y renvoie l\'huile : le carter reste presque vide et le moteur peut être monté plus bas'),tz=two?118:-(Rc+175),tx=two?Lx+118:Lx+80,y0=two?Rc+178:-Rc*.5,y1=y0+250;cyl(V(tx,y0,tz),V(tx,y1,tz),50,mAlu,pDs);cyl(V(tx,y1,tz),V(tx,y1+16,tz),22,mBlk,pDs);if(!two) tube([V(tx,y0+20,tz+46),V(Lx-10,-Rc-20,tz*.75),V(Lx*.8,-Rc-45,-(Rc-10))],9,mBlk,pDs);pDs.pin=V(tx,(y0+y1)/2,tz);}
  const dX=clamp(Lx*.3,112,140),dA=flat?V(Lx-30,Rc,48):c.lay==='V'?V(Lx-25,Rc,0):V(dX,-Rc*.3,-(Rc+14)),dB=flat?V(Lx-30,Rc+150,48):c.lay==='V'?V(Lx-25,(deck+headH)*Math.cos(a)+110,0):V(dX+12,deck*.95,-(hb+66)),pDp=P("Jauge d'huile",'Contrôle manuel du niveau');
  cyl(dA,dB,4,mSteel,pDp);const tor=new T.Mesh(new T.TorusGeometry(13,3.5,8,20),mSens);tor.position.copy(dB).add(V(0,12,0));add(tor,pDp);pDp.pin=dB.clone();
  // capteurs moteur
  if(ecu){
    const pKn=P('Capteur de cliquetis','Écoute le bloc et fait reculer l\'avance si le moteur cogne');cyl(rotB(b0,Lx*.5,deck*.6,-o0*(hb+19)),rotB(b0,Lx*.5,deck*.6,-o0*(hb+40)),15,mSens,pKn);pKn.pin=rotB(b0,Lx*.5,deck*.6,-o0*(hb+40));
    const pCk=P('Capteur de régime vilebrequin','Lit la position du vilebrequin sur la cible du volant');cyl(V(Lx-8,(Rc+16)*.8,(Rc+16)*.6),V(Lx-8,(Rc+56)*.8,(Rc+56)*.6),9,mSens,pCk);pCk.pin=V(Lx-8,(Rc+56)*.8,(Rc+56)*.6);
    if(vt!=='ohv'){const pCm=P("Capteur d'arbre à cames",'Repère la phase du cycle pour l\'injection');cyl(rotB(b0,Lx,deck+headH*.7,0),rotB(b0,Lx+30,deck+headH*.7,0),10,mSens,pCm);pCm.pin=rotB(b0,Lx+30,deck+headH*.7,0);}
  }
  // équipage mobile
  const gC=new T.Group();root.add(gC);
  const pCr=P('Vilebrequin',`Course ${nf(stroke,1)} mm, ${S.internals==='cast'?'fonte moulée':'acier forgé'}`,{inner:1}),pPi=P('Pistons',`Alésage ${nf(bore,1)} mm`,{inner:1}),pRo=P('Bielles',S.internals==='ti'?'Titane':S.internals==='forged'?'Acier forgé':'Fonte moulée',{inner:1});
  cylX(-20,Lx+6,0,0,bore*.17,mCrk,pCr,gC);pCr.pin=V(Lx*.5,0,0);
  const throw_=(x,an)=>{cylX(x-pitch*.2,x+pitch*.2,r*Math.cos(an),r*Math.sin(an),bore*.14,mCrk,pCr,gC);for(const sg of [-1,1]){const w=new T.Mesh(new T.BoxGeometry(11,r+bore*.34,bore*.36),mCrk);w.position.set(x+sg*pitch*.26,r/2*Math.cos(an),r/2*Math.sin(an));w.rotation.x=an;add(w,pCr,gC);
      const cw=new T.Mesh(new T.CylinderGeometry(Rc*.72,Rc*.72,11,20,1,false,-1,2),mCrk);cw.rotation.z=Math.PI/2;cw.rotation.order='XYZ';const g=new T.Group();g.rotation.x=an+Math.PI;g.position.x=x+sg*pitch*.26;g.add(cw);add(g,null,gC);}};
  const cyls=[],valves=[],mDk=MT(0x23272d,.5,.6),pVa=P('Soupapes et ressorts',`${vt==='dohc5'?5:vt==='dohc4'?4:2} soupapes par cylindre, ouvertes par les cames et refermées par les ressorts`,{inner:1});
  const xMesh=(rad,len,m)=>{const me=new T.Mesh(new T.CylinderGeometry(rad,rad,len,20),m);me.rotation.z=Math.PI/2;return me;};
  const mkCyl=(bk,x,an,px,zc)=>{
    zc=zc||0;const g=new T.Group();g.rotation.x=bk.b;root.add(g);
    add(new T.Mesh(new T.CylinderGeometry(bore/2-1.5,bore/2-1.5,ph,32),mPis),pPi,g);
    for(let i=0;i<3;i++){const rg=new T.Mesh(new T.CylinderGeometry(bore/2-.9,bore/2-.9,2.6,32),mDk);rg.position.y=ph/2-7-i*6.5;g.add(rg);}
    const wp=xMesh(bore*.11,bore*.82,mSteel);wp.position.y=-(pc-ph/2);g.add(wp);
    const rod=new T.Group();root.add(rod);
    const beam=new T.Mesh(new T.BoxGeometry(bore*.1,l-bore*.3,bore*.17),mRod);beam.position.y=l/2;add(beam,pRo,rod);
    const web=new T.Mesh(new T.BoxGeometry(bore*.14,l-bore*.34,bore*.06),mRod);web.position.y=l/2;rod.add(web);
    const be=xMesh(bore*.22,bore*.2,mRod);add(be,pRo,rod);edge(be);const se=xMesh(bore*.15,bore*.2,mRod);se.position.y=l;add(se,pRo,rod);
    cyls.push({p:g,rod,b:bk.b,x,a:an,px,r,l,off:pc-ph/2,z:zc});
    const lay=vt==='dohc5'?[[-.24,-1],[0,-1.05],[.24,-1],[-.18,1],[.18,1]]:vt==='dohc4'?[[-.2,-1],[.2,-1],[-.2,1],[.2,1]]:[[-.2,-1],[.2,1]];
    for(const [dx,sd] of lay){const vg=new T.Group();vg.rotation.x=bk.b;root.add(vg);const ex=sd*bk.out>0,zz=sd*bore*.21,hr=bore*(lay.length>2?.15:.2);
      const st=new T.Mesh(new T.CylinderGeometry(3,3,headH*.7,10),mSteel);st.position.y=headH*.35;add(st,pVa,vg);
      const hd=new T.Mesh(new T.CylinderGeometry(hr*.55,hr,5,20),mSteel);add(hd,pVa,vg);
      const sp=new T.Mesh(new T.CylinderGeometry(9,9,headH*.26,12,4,true),mDk);sp.position.y=headH*.58;vg.add(sp);edge(sp,1);
      valves.push({g:vg,b:bk.b,x:x+dx*bore*(c.w?.7:1),y:deck+3,z:zz+zc,a:an,ex});}
    pVa.pin=rotB(bk.b,x,deck+headH*.5,0);
  };
  if(!two) banks[0].xs.forEach((x,i)=>{const an=fire[i]*Math.PI/180;throw_(x,an);mkCyl(banks[0],x,an,x);});
  else if(flat) banks.forEach((bk,bi)=>bk.xs.forEach((x,i)=>{const an=fire[i]*Math.PI/180+(bi?Math.PI:0)+Math.PI/2;throw_(x,an);mkCyl(bk,x,an,x);}));
  else for(let i=0;i<k;i++){const x=(banks[0].xs[i]+banks[1].xs[i])/2,an=fire[i]*Math.PI/180;throw_(x,an);banks.forEach(bk=>mkCyl(bk,bk.xs[i],an,x+(bk.xs[i]-x)*.5,c.w?(i%2?1:-1)*bore*.27:0));}
  if(vt==='ohv'){const pCa=P('Arbre à cames',"Dans le bloc : il commande les soupapes par tiges et culbuteurs",{inner:1});cylX(5,Lx-5,Rc+24,0,11,mRod,pCa);}
  else{const pCa=P('Arbres à cames',`${VT[vt].n}${S.vvt?', calage variable':''}`,{inner:1});banks.forEach(bk=>(vt==='sohc'?[0]:[-1,1]).forEach(sg=>{cyl(rotB(bk.b,5,deck+headH*.78,sg*bore*.27),rotB(bk.b,Lx-5,deck+headH*.78,sg*bore*.27),8,mRod,pCa);bk.xs.forEach(x=>cyl(rotB(bk.b,x-12,deck+headH*.78,sg*bore*.27),rotB(bk.b,x+12,deck+headH*.78,sg*bore*.27),14,mRod,pCa));}));pCa.pin=rotB(b0,Lx*.4,deck+headH*.78,0);}
  return fin({crank:gC,spin,cyls,valves});
}
function setHL(part,on){if(!part) return;for(const me of part.meshes){if(!me.isMesh) continue;if(on){if(!me.userData.m){me.userData.m=me.material;me.material=E3.hl;}}else if(me.userData.m){me.material=me.userData.m;me.userData.m=null;}}}
function apply3DMode(){
  if(!E3||!E3.root) return;
  const cut=ui.eview==='cut';
  for(const p of E3.parts) setHL(p,false);
  for(const m of E3.shellMats){m.transparent=cut;m.opacity=cut?.13:1;m.depthWrite=!cut;m.needsUpdate=true;}
  for(const p of E3.parts) if(!p.shell&&!p.inner&&!p.keep) for(const me of p.meshes) me.visible=!cut;
  E3.shown=E3.parts.filter(p=>cut?(p.inner||p.shell||p.keep):!p.inner);
  if(!E3.shown.some(p=>p.name===ui.sel)) ui.sel=null;
  const pins=$('#engPins'),leg=$('#engLegend');if(!pins||!leg) return;
  pins.innerHTML=E3.shown.map((p,i)=>`<span data-pi="${i}">${i+1}</span>`).join('');E3.pinEls=$$('span',pins);
  leg.innerHTML=`<p class="leg-desc" id="legDesc"></p><ol class="legend">${E3.shown.map((p,i)=>`<li><button type="button" data-pi="${i}" id="leg_${i}"><b>${i+1}</b>${p.name}</button></li>`).join('')}</ol>`;
  mark3D(null);
}
function mark3D(hover){
  if(!E3) return;
  const cur=hover||E3.shown.find(p=>p.name===ui.sel)||null;
  E3.shown.forEach((p,i)=>{const on=p===cur;setHL(p,on);if(E3.pinEls[i]) E3.pinEls[i].classList.toggle('on',on);const b=$('#leg_'+i);if(b) b.setAttribute('aria-pressed',p.name===ui.sel?'true':'false');});
  const d=$('#legDesc');if(d) d.innerHTML=cur?`<b>${cur.name}</b> · ${cur.desc}`:'Faites glisser pour tourner le moteur. Survolez ou touchez un repère pour identifier la pièce.';
  if(!engRaf) draw3D();
}
function draw3D(){
  if(!E3||!E3.root) return;
  const cv=E3.cv,w=cv.clientWidth,h=cv.clientHeight;if(!w||!h) return;
  if(E3.w!==w||E3.h!==h){E3.renderer.setSize(w,h,false);E3.cam.aspect=w/h;E3.cam.updateProjectionMatrix();E3.w=w;E3.h=h;}
  const th=engTheta,A=E3.anim,T=THREE;
  A.crank.rotation.x=th;for(const g of A.spin) g.rotation.x=th;
  const pin=new T.Vector3(),top=new T.Vector3(),d=new T.Vector3(),UPv=new T.Vector3(0,1,0);
  for(const c of A.cyls){const phi=th+c.a-c.b,s=c.r*Math.cos(phi)+Math.sqrt(c.l*c.l-Math.pow(c.r*Math.sin(phi),2));
    c.p.position.set(c.x,(s+c.off)*Math.cos(c.b)-c.z*Math.sin(c.b),(s+c.off)*Math.sin(c.b)+c.z*Math.cos(c.b));
    pin.set(c.px,c.r*Math.cos(th+c.a),c.r*Math.sin(th+c.a));top.set(c.x,s*Math.cos(c.b)-c.z*Math.sin(c.b),s*Math.sin(c.b)+c.z*Math.cos(c.b));d.copy(top).sub(pin);
    c.rod.position.copy(pin);c.rod.rotation.x=Math.atan2(d.z,d.y);}
  const P4=4*Math.PI;
  for(const r of (A.rotors||[])){const aj=th+r.ph;r.g.position.set(r.x,r.e*Math.cos(aj),r.e*Math.sin(aj));r.g.rotation.x=aj/3;}
  for(const v of A.valves){const cyc=((th+v.a-v.b)%P4+P4)%P4,lift=v.ex?(cyc>Math.PI&&cyc<2*Math.PI?Math.sin(cyc-Math.PI):0):(cyc>2*Math.PI&&cyc<3*Math.PI?Math.sin(cyc-2*Math.PI):0),y=v.y-9*lift;
    v.g.position.set(v.x,y*Math.cos(v.b)-v.z*Math.sin(v.b),y*Math.sin(v.b)+v.z*Math.cos(v.b));}
  const dist=E3.R/Math.sin(15*Math.PI/180)/Math.min(1,E3.cam.aspect*.8)/ui.zoom*.7;
  E3.cam.position.set(dist*Math.cos(ui.el)*Math.sin(ui.az),dist*Math.sin(ui.el),dist*Math.cos(ui.el)*Math.cos(ui.az));E3.cam.lookAt(0,0,0);
  if(E3.oil){const o=E3.oil,hg=Math.max(2,clamp(M.E.oilQ*.62,0,1.7)*o.hh);o.me.scale.y=hg;o.me.position.y=o.y0+hg/2;}
  applyHeat();E3.renderer.render(E3.scene,E3.cam);
  const show=ui.pins;
  E3.shown.forEach((p,i)=>{const e=E3.pinEls[i];if(!e) return;if(!show||!p.pin){e.style.display='none';return;}pin.copy(p.pin);E3.root.localToWorld(pin);pin.project(E3.cam);
    if(pin.z>1||Math.abs(pin.x)>1.02||Math.abs(pin.y)>1.02){e.style.display='none';return;}e.style.display='';e.style.transform=`translate(${((pin.x*.5+.5)*w).toFixed(1)}px,${((-pin.y*.5+.5)*h).toFixed(1)}px)`;});
}
function engFrame(){if(ui.eview==='cyc') drawCycle();else if(ui.eview==='2d'||!E3) drawEngine();else draw3D();}
