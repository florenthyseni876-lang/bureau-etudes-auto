'use strict';
/* ───────────── Mode « Mécanicien » — CHÂSSIS : le dessous de la voiture levée ─────────────
   Dessine, pour chaque voiture réelle de js/44, tout ce qu'on voit en passant sous le pont : berceau, bras de suspension, rotules,
   amortisseurs et ressorts, barre antiroulis, crémaillère, cardans à soufflets, moyeux, échappement (collecteur, catalyseur, FAP, sonde
   lambda, silencieux), carter d'huile et filtre, boîte de vitesses, arbre de transmission et pont, réservoir et sa pompe, durites de frein.
   Tout est fusionné en UN seul maillage coloré par sommet (couleurs de matière : fonte, acier peint, alu, caoutchouc, inox, cuivre…).

   Les pièces que le joueur peut démonter (amortisseur, rotule, roulement, cardan, catalyseur, FAP, sonde lambda, pompe à carburant, filtre
   à huile) existent en double : dans le maillage complet de la voiture (aspect normal) et chacune séparément, centrée sur son pivot
   (js/46b les pose à la vraie place quand on travaille sur la voiture, usées ou neuves, et la voiture passe alors au maillage « base », sans elles).

   ═══ API `MWCH` ═══
   MWCH.build(car, X)            appelé par js/44 (buildGeo) : renvoie {full, base, units, anchors}
   MWCH.mat()                    matériau commun (couleurs par sommet)
   MWCH.unitGeo(ch, u, worn)     géométrie d'une pièce amovible (centrée sur son pivot), mise en cache
   MWCH.ids                      identifiants des pièces amovibles dessinées ici */
const MWCH=(()=>{
const T=THREE,PI=Math.PI,TAU=PI*2;
const lin=hex=>{const c=new T.Color(hex);c.convertSRGBToLinear();return c;};
const QQ=new T.Quaternion(),UP=new T.Vector3(0,1,0),FW=new T.Vector3(0,0,1);

/* ═══════════ Constructeur de maillage fusionné (couleur par sommet) ═══════════ */
function VB(){
 const P=[],N=[],C=[];const I=[];let ox=0,oy=0,oz=0;
 const M=new T.Matrix4(),Q=new T.Quaternion(),E=new T.Euler(),S1=new T.Vector3(1,1,1),Vp=new T.Vector3(),NM=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3();
 const mat=(x,y,z,rx,ry,rz,sx,sy,sz)=>{E.set(rx||0,ry||0,rz||0,'YXZ');Q.setFromEuler(E);return M.compose(Vp.set(x||0,y||0,z||0),Q,sx?new T.Vector3(sx,sy,sz):S1).clone();};
 function put(g,col,m){
  const p=g.attributes.position,nn=g.attributes.normal,base=P.length/3,c=lin(col);NM.getNormalMatrix(m);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);P.push(v.x-ox,v.y-oy,v.z-oz);
   if(nn){n.fromBufferAttribute(nn,i).applyMatrix3(NM).normalize();N.push(n.x,n.y,n.z);}else N.push(0,1,0);C.push(c.r,c.g,c.b);}
  if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++) I.push(a[i]+base);}else for(let i=0;i<p.count;i++) I.push(base+i);
  g.dispose();}
 const dirQ=(from,a,bb)=>{v.set(bb[0]-a[0],bb[1]-a[1],bb[2]-a[2]);const len=v.length()||1e-4;v.divideScalar(len);return {len,q:new T.Quaternion().setFromUnitVectors(from,v.clone())};};
 const mid=(a,bb)=>[(a[0]+bb[0])/2,(a[1]+bb[1])/2,(a[2]+bb[2])/2];
 const b={
  off(x,y,z){ox=x;oy=y;oz=z;},
  get count(){return P.length/3;},
  box(col,w,h,d,x,y,z,rx,ry,rz){put(new T.BoxGeometry(w,h,d),col,mat(x,y,z,rx,ry,rz));},
  /* cylindre (rayon haut, rayon bas, hauteur), axe y par défaut, 'x' ou 'z' */
  cyl(col,r1,r2,h,x,y,z,ax,seg){put(new T.CylinderGeometry(r1,r2,h,seg||12),col,mat(x,y,z,ax==='z'?PI/2:0,0,ax==='x'?PI/2:0));},
  sph(col,r,x,y,z,sx,sy,sz){put(new T.SphereGeometry(r,10,8),col,mat(x,y,z,0,0,0,sx||1,sy||1,sz||1));},
  tor(col,R,r,x,y,z,ax,seg){put(new T.TorusGeometry(R,r,6,seg||16),col,mat(x,y,z,ax==='x'?0:PI/2*(ax==='z'?0:1),ax==='x'?PI/2:0,0));},
  /* cylindre d'un point à un autre */
  tube(col,a,bb,r1,r2,seg){const d=dirQ(UP,a,bb),m=mid(a,bb);const g=new T.CylinderGeometry(r2==null?r1:r2,r1,d.len,seg||8);
   put(g,col,new T.Matrix4().compose(new T.Vector3(m[0],m[1],m[2]),d.q,S1));},
  /* barre (boîte) d'un point à un autre */
  bar(col,a,bb,w,h){const d=dirQ(FW,a,bb),m=mid(a,bb);put(new T.BoxGeometry(w,h,d.len),col,new T.Matrix4().compose(new T.Vector3(m[0],m[1],m[2]),d.q,S1));},
  /* solide de révolution : profil [[rayon, position le long de l'axe]…] de a vers dir */
  lathe(col,prof,a,dir,seg){const g=new T.LatheGeometry(prof.map(p=>new T.Vector2(p[0],p[1])),seg||12);const q=new T.Quaternion().setFromUnitVectors(UP,new T.Vector3(dir[0],dir[1],dir[2]).normalize());
   put(g,col,new T.Matrix4().compose(new T.Vector3(a[0],a[1],a[2]),q,S1));},
  /* ressort hélicoïdal d'axe dir, de rayon R, fil de rayon r */
  helix(col,a,dir,R,r,turns,len,seg){const pts=[],ns=Math.max(8,Math.round(turns*(seg||7)));
   for(let i=0;i<=ns;i++){const t=i/ns,an=t*turns*TAU;pts.push(new T.Vector3(Math.cos(an)*R,t*len,Math.sin(an)*R));}
   const g=new T.TubeGeometry(new T.CatmullRomCurve3(pts),ns,r,4,false);const q=new T.Quaternion().setFromUnitVectors(UP,new T.Vector3(dir[0],dir[1],dir[2]).normalize());
   put(g,col,new T.Matrix4().compose(new T.Vector3(a[0],a[1],a[2]),q,S1));},
  geo(g,col){put(g,col,new T.Matrix4());},
  /* ajoute un autre constructeur décalé */
  vb(o,x,y,z){const d=o._raw(),base=P.length/3;for(let i=0;i<d.P.length;i+=3) P.push(d.P[i]+x-ox,d.P[i+1]+y-oy,d.P[i+2]+z-oz);for(const k of d.N) N.push(k);for(const k of d.C) C.push(k);for(const k of d.I) I.push(k+base);},
  _raw(){return {P,N,C,I};},
  done(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));
   g.setIndex(new T.BufferAttribute(P.length/3>65000?new Uint32Array(I):new Uint16Array(I),1));g.computeBoundingSphere();return g;}};
 return b;}

let MAT=null;
function mat(){if(MAT) return MAT;MAT=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,emissive:lin(0x35322c)});MAT.userData.lin=1;return MAT;}

/* ═══════════ Matières ═══════════ */
const K={floor:0x37332f,tunnel:0x2c2a27,sub:0x394048,arm:0x6b727a,armAlu:0xbcc2c9,cast:0x7d766c,rubber:0x151618,chrome:0xd2d6da,steel:0x8e949b,zinc:0xa9a894,
 rust:0x8a5634,alu:0xb0b6bd,plast:0x2b2d31,copper:0xc27a3a,grease:0x6b4a1c,oil:0x3c2d1d,
 inox:0xa5aaae,inoxO:0x948c80,shell:0xc0c3c5,heat:0xd2b667,fap:0x8c9195,muff:0x9b9a92,tail:0xdfe2e5,
 gold:0xd8a93a};
/* usé : plus sombre, sale, huileux */
const mix=(a,b,t)=>lin(a).lerp(lin(b),t);
function worn(col,w,tint){if(!w) return col;const c=new T.Color(col);c.multiplyScalar(.72);const t=new T.Color(tint||K.oil);c.lerp(t,.28);return c.getHex();}

/* ═══════════ Construction du dessous d'une voiture ═══════════ */
const IDS=['amort','rotule','roulement','cardan','catalyseur','fap','sonde_lambda','pompe_carburant'];

function build(car,X){
 const {gc,hw,W,L,tF,tR,afz,arz,zf,zr,wxF,wxR,eZ,exX,zc}=X;
 const ev=!!car.ev,front=car.loc==='front',mid=car.loc==='mid',cat=car.cat,drive=car.drive,trans=car.ori==='T',dirF=front?1:-1;
 const diesel=!ev&&car.eng&&car.eng.fuel==='diesel';
 const rtF=tF.rt,rtR=tR.rt,ysub=gc+.055,bjY=Math.max(.085,rtF-.2),shaftY=rtF-.055;
 const pz=trans&&!ev?Math.min(eZ,afz-.2):eZ;   /* le moteur transversal est reculé derrière l'axe des cardans */
 const springC=cat==='sport'?0xd02a20:cat==='prem'?0xb4bcc6:0x838b95,armC=(cat==='prem'||cat==='sport')?K.armAlu:K.arm;
 const torsion=drive==='fwd'&&(cat==='pop'||cat==='gen')&&car.kind!=='suv';
 const cx=[-1,1];
 const base=new VB();            /* tout ce qui ne se démonte pas */
 const units=[];                 /* pièces amovibles : {id,i,piv,draw(b,worn)} */
 const unit=(id,i,piv,draw)=>units.push({id,i,piv,draw});

 /* ── plancher, tunnel, bas de caisse ── */
 for(const g of X.ubel) base.geo(g,K.floor);
 base.box(K.tunnel,.3,.09,Math.abs(afz-arz)*.78,0,gc+.1,(afz+arz)/2);
 for(const sg of cx){
  base.box(K.sub,.075,.085,Math.abs(afz-arz)*.72,sg*(hw-.3),gc+.05,(afz+arz)/2);               /* bas de caisse */
  base.box(K.floor,.02,.05,Math.abs(afz-arz)*.7,sg*(hw-.36),gc+.095,(afz+arz)/2);
 }
 for(const k of [-.28,0,.3]) base.box(K.sub,W*.62,.03,.05,0,gc+.115,(afz+arz)/2+k*Math.abs(afz-arz));   /* traverses de plancher */

 /* ── durites de frein et canalisations : cuivre / noir, le long du tunnel ── */
 for(const sg of cx){
  base.tube(K.copper,[sg*.2,gc+.125,afz-.35],[sg*.2,gc+.125,arz+.35],.0045,.0045,6);
  base.tube(K.copper,[sg*.2,gc+.125,arz+.35],[sg*(wxR-.2),gc+.15,arz+.1],.0045,.0045,6);
 }
 base.tube(K.rubber,[-.08,gc+.125,arz+.9],[-.08,gc+.125,afz-.4],.007,.007,6);                    /* canalisation de carburant */

 /* ═══════ TRAIN AVANT ═══════ */
 /* berceau : longerons, traverses, vis de fixation */
 for(const sg of cx) base.box(K.sub,.075,.065,.86,sg*.3,ysub,afz);
 base.box(K.sub,.68,.06,.085,0,ysub,afz+.4);base.box(K.sub,.68,.06,.085,0,ysub,afz-.42);
 for(const sg of cx) for(const dz of [-.42,.4]) {base.cyl(K.zinc,.015,.015,.022,sg*.3,ysub+.04,afz+dz,'y',6);base.box(K.sub,.1,.02,.1,sg*.3,ysub+.02,afz+dz);}
 /* crémaillère de direction et biellettes */
 base.tube(K.steel,[-.3,rtF-.05,afz-.17],[.3,rtF-.05,afz-.17],.021,.021,10);
 for(const sg of cx){
  base.lathe(K.rubber,[[.019,0],[.032,.012],[.021,.026],[.033,.04],[.021,.054],[.032,.068],[.02,.08]],[sg*.28,rtF-.05,afz-.17],[sg,0,0],10);   /* soufflet */
  base.tube(K.steel,[sg*.355,rtF-.05,afz-.17],[sg*(wxF-.12),rtF-.035,afz-.14],.008,.008,6);
  base.sph(K.chrome,.013,sg*.355,rtF-.05,afz-.17);base.sph(K.chrome,.013,sg*(wxF-.12),rtF-.035,afz-.14);
 }
 /* barre antiroulis, biellettes de liaison */
 base.tube(K.sub,[-.46,ysub+.03,afz+.15],[.46,ysub+.03,afz+.15],.0125,.0125,8);
 for(const sg of cx){
  base.tube(K.sub,[sg*.46,ysub+.03,afz+.15],[sg*.56,ysub+.035,afz+.02],.0125,.0125,8);
  base.box(K.rubber,.05,.04,.05,sg*.28,ysub+.03,afz+.15);base.box(K.sub,.06,.012,.06,sg*.28,ysub+.055,afz+.15);   /* paliers de la barre */
  base.tube(K.chrome,[sg*.56,ysub+.035,afz+.02],[sg*(wxF-.14),rtF+.1,afz+.05],.0065,.0065,6);
  base.sph(K.chrome,.012,sg*.56,ysub+.035,afz+.02);base.sph(K.chrome,.012,sg*(wxF-.14),rtF+.1,afz+.05);
 }
 for(const sg of cx){
  const hx=sg*(wxF-.11);
  /* fusée : alésage du moyeu, corps, bras de direction, chape d'amortisseur, tôle pare-poussière */
  base.cyl(K.cast,.056,.056,.062,sg*(wxF-.108),rtF,afz,'x',16);
  base.box(K.cast,.048,rtF+.17-bjY,.08,hx,(bjY+rtF+.17)/2,afz+.012);
  base.bar(K.cast,[hx,rtF-.03,afz-.01],[sg*(wxF-.12),rtF-.035,afz-.14],.022,.028);
  base.box(K.cast,.055,.1,.06,sg*(wxF-.125),rtF+.1,afz+.005);
  base.cyl(0x5a5a5a,.118,.118,.004,sg*(wxF-.086),rtF,afz,'x',22);
  /* capteur ABS et son câble */
  base.cyl(K.steel,.008,.008,.045,sg*(wxF-.115),rtF+.075,afz-.055,'z',6);base.tube(K.rubber,[sg*(wxF-.12),rtF+.075,afz-.078],[sg*(wxF-.2),rtF+.2,afz-.09],.0035,.0035,5);
  /* triangle inférieur : deux bras vers le berceau, silentblocs */
  base.bar(armC,[hx,bjY,afz],[sg*.3,ysub,afz+.2],.04,.03);base.bar(armC,[hx,bjY,afz],[sg*.3,ysub,afz-.2],.04,.03);
  base.bar(armC,[sg*.3,ysub,afz+.2],[sg*.3,ysub,afz-.2],.025,.025);
  base.cyl(K.rubber,.022,.022,.05,sg*.3,ysub,afz+.2,'z',10);base.cyl(K.rubber,.022,.022,.05,sg*.3,ysub,afz-.2,'z',10);
 }
 /* cardans (avant moteur) */
 if(drive!=='rwd'){
  /* boîte ou différentiel avant : à côté du carter, sur le côté, ou devant la boîte */
  if(trans||ev){base.box(K.alu,.34,.27,.31,.35,gc+.15,pz);base.cyl(K.alu,.15,.15,.12,.15,gc+.15,pz,'x',18);
   for(const k of [-.1,0,.1]) base.box(K.alu,.3,.012,.03,.35,gc+.255,pz+k);}
  else{base.box(K.alu,.22,.2,.24,0,gc+.1,afz-.02);base.cyl(K.alu,.1,.1,.03,0,gc+.1,afz+.11,'z',14);}
 }
 for(const sg of cx) if(drive!=='rwd'){
  const ix=sg*(trans?(sg>0?.5:.22):.2),ox=sg*(wxF-.13),iy=trans?shaftY-.0:shaftY;
  unit('cardan',sg>0?0:1,[(ix+ox)/2,(iy+rtF)/2,afz],(b,w)=>{
   const A=[ix,iy,afz],B=[ox,rtF,afz],dv=[B[0]-A[0],B[1]-A[1],0],ln=Math.hypot(dv[0],dv[1]),u=[dv[0]/ln,dv[1]/ln,0],at=t=>[A[0]+u[0]*ln*t,A[1]+u[1]*ln*t,afz];
   const rub=w?0x24201a:K.rubber,gr=K.grease;
   b.tube(K.steel,A,B,.0155,.0155,8);
   b.tube(K.cast,at(0),at(.1),.034,.034,10);b.tube(K.cast,at(.9),at(1),.038,.038,10);                      /* tulipes des joints */
   const bel=(t0,t1,r0,r1,folds)=>{const pr=[];for(let k=0;k<=folds*2;k++){const f=k/(folds*2),r=r0+(r1-r0)*f;pr.push([k%2?r*.72:r,f*ln*(t1-t0)]);}b.lathe(rub,pr,at(t0),[u[0],u[1],0],10);};
   bel(.1,.3,.042,.02,4);bel(.66,.9,.02,.052,5);                                                              /* soufflets côté boîte et côté roue */
   b.tube(K.zinc,at(.29),at(.31),.024,.024,8);b.tube(K.zinc,at(.66),at(.68),.024,.024,8);                      /* colliers */
   if(w){b.tube(gr,at(.73),at(.8),.056,.056,8);b.tube(gr,at(.43),at(.47),.019,.019,6);                        /* graisse projetée : soufflet déchiré */
    b.sph(gr,.02,at(.7)[0],at(.7)[1]-.05,afz+.04,1.6,.7,1);b.sph(gr,.013,at(.55)[0],at(.55)[1]-.03,afz-.03);}
  });
 }
 /* rotules, roulements, amortisseurs : pièces amovibles du train avant */
 for(const sg of cx){
  const i=sg>0?0:1,hx=sg*(wxF-.11);
  unit('rotule',i,[hx,bjY,afz],(b,w)=>{
   b.cyl(K.steel,.03,.026,.038,hx,bjY,afz,'y',10);                                                               /* corps embouti */
   b.cyl(K.chrome,.011,.011,.075,hx,bjY+.05,afz,'y',8);                                                           /* tige conique */
   b.lathe(w?0x26211c:K.rubber,[[.03,0],[.034,.01],[.024,.022],[.034,.034],[.016,.048]],[hx,bjY+.015,afz],[0,1,0],10);   /* soufflet */
   b.cyl(K.zinc,.036,.036,.006,hx,bjY+.012,afz,'y',10);
   if(w){b.sph(K.grease,.018,hx+sg*.02,bjY+.02,afz+.025,1.4,.5,1);b.box(K.rubber,.002,.02,.014,hx+sg*.012,bjY+.04,afz+.03);}   /* soufflet déchiré, graisse */
  });
  unit('roulement',i,[sg*(wxF-.1),rtF,afz],(b,w)=>{
   const x=sg*(wxF-.1);
   b.cyl(w?worn(K.steel,1):K.steel,.044,.044,.058,x,rtF,afz,'x',16);                                              /* unité de roulement */
   b.cyl(K.zinc,.06,.06,.012,sg*(wxF-.072),rtF,afz,'x',18);                                                         /* bride */
   b.cyl(0x2a2a2d,.048,.048,.008,sg*(wxF-.128),rtF,afz,'x',16);                                                     /* anneau de codage ABS */
   for(let k=0;k<5;k++){const a=k/5*TAU+.3;b.cyl(K.zinc,.008,.008,.016,sg*(wxF-.072),rtF+Math.cos(a)*.05,afz+Math.sin(a)*.05,'x',6);}
   if(w) {b.tube(K.rust,[x,rtF-.044,afz],[x,rtF-.05,afz+.02],.014,.014,6);}
  });
  /* amortisseur + ressort */
  const x0=sg*(wxF-.12),y0=rtF+.07,x1=sg*(wxF-.19),y1=rtF+.5,ym=y0+(y1-y0)*.5;
  const dp=t=>[x0+(x1-x0)*t,y0+(y1-y0)*t,afz];
  unit('amort',i,dp(.5),(b,w)=>{
   b.tube(w?K.oil:0x4a5664,dp(0),dp(.5),.03,.03,12);b.tube(K.chrome,dp(.5),dp(1),.0105,.0105,8);
   b.tube(w?0x4a3220:K.zinc,dp(.46),dp(.52),.034,.034,12);
   b.tube(K.rubber,dp(.9),dp(1),.045,.045,12);b.tube(K.steel,dp(.96),dp(1),.062,.062,12);                    /* coupelle haute */
   b.tube(K.steel,dp(.07),dp(.1),.072,.072,12);                                                               /* siège inférieur */
   const a=dp(.12),dr=[x1-x0,y1-y0,0];b.helix(w?worn(springC,1,0x4a3a2a):springC,a,dr,.058,.0066,6.5,(y1-y0)*.78,7);
   if(w) {b.tube(K.oil,dp(.02),dp(.38),.0325,.0325,10);}
  });
 }

 /* ═══════ MOTEUR, BOÎTE, ÉCHAPPEMENT ═══════ */
 const A={},FX={};
 if(!ev){
  /* carter d'huile, bouchon, filtre */
  const pw=trans?.46:.3,pl=trans?.3:.5,pc=cat==='pop'?K.sub:K.alu,pyT=gc+.19;
  const sCx=trans?-pw*.1:0,sCz=pz+(trans?0:-.07*dirF),sBot=pyT-.095-.0225;
  base.box(pc,pw,.045,pl,0,pyT,pz);base.box(pc,pw*.93,.065,pl*.92,0,pyT-.045,pz);base.box(pc,pw*.62,.045,pl*.52,sCx,pyT-.095,sCz);
  if(pc===K.alu) for(const k of [-.35,0,.35]) base.box(0x8e949b,pw*.9,.01,.02,0,pyT-.03,pz+k*pl*.9);
  base.box(K.alu,.1,.05,.1,0,pyT-.05,pz);
  A.oilPlug=[sCx+.1,sBot,sCz];                                                                                    /* le bouchon est dessiné par js/46, à 0,10 m à gauche de ce point */
  A.oilFilter=trans?[.18,gc+.2,pz+.22]:[pw/2+.09,gc+.2,pz+.05];
  base.cyl(K.cast,.032,.032,.03,A.oilFilter[0],A.oilFilter[1]+.012,A.oilFilter[2],'y',10);
  unit('__filtre',0,A.oilFilter,(b,w)=>{const f=A.oilFilter;if(diesel){b.cyl(0x34383d,.042,.042,.11,f[0],f[1]-.05,f[2]);b.cyl(K.alu,.034,.034,.03,f[0],f[1]-.12,f[2],'y',8);}else{b.cyl(0x2a62c8,.042,.042,.1,f[0],f[1]-.05,f[2]);b.cyl(K.steel,.046,.046,.014,f[0],f[1]-.003,f[2]);}});
  /* boîte de vitesses longitudinale : cloche, carter, traverse ; transversale : déjà dessinée (côté cardans) */
  if(!trans){
   const gz=pz-dirF*.48;
   base.cyl(K.alu,.16,.16,.3,0,gc+.16,gz,'z',18);base.tube(K.alu,[0,gc+.15,gz-dirF*.15],[0,gc+.12,gz-dirF*.62],.13,.085,14);
   base.box(K.sub,.55,.045,.08,0,gc+.045,gz-dirF*.45);base.box(K.rubber,.07,.05,.07,0,gc+.075,gz-dirF*.45);   /* traverse de boîte */
  }
  /* échappement : collecteur → descente → catalyseur → (FAP) → ligne → silencieux → sortie */
  const zcat=front?pz-.42:Math.max(zr+.95,eZ-.1);
  const yP=gc+.04,yC=gc+.075,xs=exX;
  A.cata=[xs,yC,zcat];
  const zfap=zcat-.42,fapOn=!!diesel;
  const zOut=fapOn?zfap-.26:zcat-.24;
  const rear0=zr+.42,sil0=arz-.12;
  /* descente depuis le moteur */
  base.tube(K.inox,[xs*.6,gc+.3,zcat+.38],[xs*.9,yC+.02,zcat+.28],.033,.033,10);base.tube(K.inox,[xs*.9,yC+.02,zcat+.28],[xs,yC,zcat+.19],.03,.03,10);
  base.sph(K.inox,.033,xs*.9,yC+.02,zcat+.28);
  /* flexible (tresse) */
  base.cyl(0x7e8185,.037,.037,.075,xs,yC,zcat+.235,'z',12);for(let k=0;k<4;k++) base.tor(0x5f6266,.037,.0035,xs,yC,zcat+.2+k*.018,'z',12);
  /* brides d'entrée et de sortie (leurs boulons sont les fixations de la pièce) */
  const flange=(z)=>{base.cyl(K.steel,.054,.054,.012,xs,yC,z,'z',16);};
  flange(zcat+.166);flange(zcat-.166);
  if(fapOn){flange(zfap+.206);flange(zfap-.206);flange(zcat-.166-.02);}
  /* pièces amovibles : catalyseur, FAP */
  unit('catalyseur',0,[xs,yC,zcat],(b,w)=>{
   const L2=diesel?.19:.3,r=diesel?.055:.066,sh=w?0x8a7c6c:K.shell;
   b.tube(sh,[xs,yC,zcat+L2/2],[xs,yC,zcat-L2/2],r,r,16);
   b.tube(sh,[xs,yC,zcat+L2/2+.02],[xs,yC,zcat+L2/2],.04,r,14);b.tube(sh,[xs,yC,zcat-L2/2],[xs,yC,zcat-L2/2-.02],r,.04,14);
   b.tor(w?0x6a5a4a:K.zinc,r,.005,xs,yC,zcat+L2/2-.01,'z',16);b.tor(w?0x6a5a4a:K.zinc,r,.005,xs,yC,zcat-L2/2+.01,'z',16);
   /* écran thermique doré (feuille d'alu), nervures */
   b.box(w?0x8a7a50:K.heat,r*1.5,.006,L2*.9,xs,yC+r+.012,zcat);for(const k of [-.35,0,.35]) b.box(w?0x7a6a44:0xb99a4a,r*1.5,.012,.012,xs,yC+r+.017,zcat+k*L2);
   b.box(w?0x7a6a44:K.heat,.006,r*1.1,L2*.9,xs-r-.01,yC+.01,zcat);b.box(w?0x7a6a44:K.heat,.006,r*1.1,L2*.9,xs+r+.01,yC+.01,zcat);
   if(w) b.sph(K.rust,.02,xs+.03,yC-r+.01,zcat-.05,1.6,.5,1.2);
  });
  if(fapOn) unit('fap',0,[xs,yC,zfap],(b,w)=>{
   const r=.082,L2=.36,sh=w?0x6a6258:K.fap;
   b.tube(sh,[xs,yC,zfap+L2/2],[xs,yC,zfap-L2/2],r,r,18);b.tube(sh,[xs,yC,zfap+L2/2+.04],[xs,yC,zfap+L2/2],.044,r,14);b.tube(sh,[xs,yC,zfap-L2/2],[xs,yC,zfap-L2/2-.04],r,.044,14);
   for(const k of [-.28,.28]) b.tor(K.zinc,r+.002,.006,xs,yC,zfap+k*L2,'z',18);
   b.box(0x2d2f33,.04,.03,.03,xs+r*.7,yC+r*.7,zfap+.06);b.cyl(K.chrome,.008,.008,.035,xs+r*.7,yC+r*.7+.02,zfap+.06,'y',6);   /* prise de pression différentielle */
   if(w) {b.tube(0x1a1816,[xs,yC,zfap+L2*.1],[xs,yC,zfap+L2*.35],r+.003,r+.003,14);}                                  /* suie */
  });
  /* ligne : tuyau, résonateur, silencieux, sortie */
  base.tube(K.inox,[xs,yP+.015,zOut+.0],[xs,yP+.015,sil0+.32],.03,.03,10);
  base.tube(K.inox,[xs,yC,zcat-.166-.01],[xs,yP+.015,zOut],.03,.03,10);
  const zres=(zOut+sil0)/2;
  base.tube(K.inoxO,[xs,yP+.015,zres+.17],[xs,yP+.015,zres-.17],.052,.052,14);base.tor(K.zinc,.052,.004,xs,yP+.015,zres+.17,'z',14);base.tor(K.zinc,.052,.004,xs,yP+.015,zres-.17,'z',14);
  base.tube(K.muff,[xs,gc+.09,sil0+.3],[xs,gc+.09,zr+.5],.085,.085,16);
  base.tube(K.muff,[xs,gc+.09,zr+.5],[xs,gc+.09,zr+.48],.075,.075,14);
  for(const zz of [sil0+.3,zr+.5]) base.tor(K.rust,.085,.004,xs,gc+.09,zz,'z',16);
  base.tube(K.inox,[xs,yP+.015,sil0+.32],[xs,gc+.09,sil0+.3],.026,.026,8);
  base.tube(K.tail,[xs,gc+.09,zr+.5],[xs,gc+.095,zr+.01],.035,.035,12);base.cyl(K.chrome,.04,.04,.012,xs,gc+.095,zr+.015,'z',14);
  /* silentblocs de suspente */
  for(const z of [zOut-.1,zres+.3,sil0+.05,zr+.55]) {base.box(K.rubber,.025,.07,.04,xs,gc+.09,z);base.box(K.steel,.05,.012,.05,xs,gc+.13,z);}
  /* sonde lambda (en amont du catalyseur, sur la descente) */
  const lp=[xs*.9,yC+.04,zcat+.28];A.lambda=[lp[0],lp[1],lp[2]];
  unit('sonde_lambda',0,lp,(b,w)=>{
   const ox=lp[0],oy=lp[1],oz=lp[2],d=[.8,.45,.1],dn=Math.hypot(d[0],d[1],d[2]),u=[d[0]/dn,d[1]/dn,d[2]/dn],p=t=>[ox+u[0]*t,oy+u[1]*t,oz+u[2]*t];
   b.tube(K.steel,p(-.01),p(.012),.017,.017,6);                                                              /* écrou hexagonal */
   b.tube(w?0x5a5a58:K.chrome,p(.012),p(.062),.0095,.0095,8);b.tube(0x2a2b2e,p(.058),p(.07),.011,.011,8);
   b.tube(K.rubber,p(.07),[p(.07)[0]+.03,p(.07)[1]+.06,oz+.03],.0028,.0028,5);b.tube(K.rubber,[p(.07)[0]+.03,p(.07)[1]+.06,oz+.03],[ox*.55,oy+.14,oz+.12],.0028,.0028,5);
   b.box(0x1f2124,.026,.018,.04,ox*.55,oy+.14,oz+.12);                                                         /* connecteur */
   if(w) b.sph(0x2a2420,.02,ox+.02,oy-.01,oz,1.2,.6,1);
  });
  A.lambdaConn=[lp[0]*.55,lp[1]+.14,lp[2]+.12];
 }
 /* ═══════ TRAIN ARRIÈRE ═══════ */
 for(const sg of cx){
  const hx=sg*(wxR-.1);
  base.cyl(K.cast,.04,.04,.06,sg*(wxR-.105),rtR,arz,'x',14);                                                       /* fusée arrière */
  base.box(K.cast,.045,.24,.08,hx,rtR+.015,arz,0,0,0);
  if(car.brk.r!=='drum') base.cyl(0x5a5a5a,.1,.1,.004,sg*(wxR-.086),rtR,arz,'x',20);
 }
 if(torsion){
  for(const sg of cx){
   const piv=[sg*(wxR-.2),gc+.2,arz+.58],hub=[sg*(wxR-.1),rtR-.015,arz+.01];
   base.bar(K.arm,piv,hub,.06,.085);base.cyl(K.rubber,.026,.026,.075,piv[0],piv[1],piv[2],'x',12);base.box(K.sub,.09,.12,.06,piv[0],piv[1]+.05,piv[2]);
   /* ressort et amortisseur */
   base.tube(K.steel,[sg*(wxR-.22),rtR-.035,arz+.15],[sg*(wxR-.22),rtR-.02,arz+.15],.07,.07,12);
   base.helix(springC,[sg*(wxR-.22),rtR-.03,arz+.15],[0,1,0],.06,.0066,6.5,.25,7);base.tube(K.rubber,[sg*(wxR-.22),rtR+.23,arz+.15],[sg*(wxR-.22),rtR+.25,arz+.15],.06,.06,12);
   base.tube(0x4a5664,[sg*(wxR-.12),rtR+.0,arz-.08],[sg*(wxR-.15),rtR+.16,arz-.08],.026,.026,10);base.tube(K.chrome,[sg*(wxR-.15),rtR+.16,arz-.08],[sg*(wxR-.17),rtR+.34,arz-.08],.0095,.0095,8);
   base.tube(K.rubber,[sg*(wxR-.17),rtR+.32,arz-.08],[sg*(wxR-.175),rtR+.36,arz-.08],.04,.04,10);
  }
  base.box(K.arm,2*(wxR-.2),.07,.1,0,rtR-.02,arz+.2);base.box(K.sub,2*(wxR-.2)-.1,.03,.07,0,rtR-.065,arz+.2);   /* traverse déformable, profil en U */
  base.tube(K.sub,[-(wxR-.26),rtR+.015,arz+.17],[wxR-.26,rtR+.015,arz+.17],.012,.012,8);                             /* barre stabilisatrice */
 }else{
  for(const sg of cx) base.box(K.sub,.075,.06,.62,sg*.38,gc+.06,arz+.02);
  base.box(K.sub,.82,.06,.09,0,gc+.06,arz+.32);base.box(K.sub,.82,.06,.09,0,gc+.06,arz-.3);
  for(const sg of cx) for(const dz of [-.3,.32]) {base.cyl(K.zinc,.015,.015,.022,sg*.38,gc+.1,arz+dz,'y',6);}
  for(const sg of cx){
   const hub=[sg*(wxR-.1),rtR,arz],hu=[sg*(wxR-.1),rtR+.1,arz];
   base.bar(armC,[sg*.38,gc+.07,arz-.2],[hub[0],rtR-.1,arz-.12],.045,.03);                                         /* bras inférieur arrière */
   base.bar(armC,[sg*.38,gc+.06,arz+.28],[hub[0],rtR-.1,arz+.1],.04,.03);                                          /* bras inférieur avant */
   base.bar(armC,[sg*.34,rtR+.14,arz-.15],[hu[0],rtR+.1,arz-.07],.03,.025);                                        /* bras supérieur */
   base.bar(armC,[sg*.36,gc+.1,arz+.2],[hub[0],rtR+.02,arz+.22],.028,.022);                                        /* bras de direction (pincement) */
   for(const [px,py,pz] of [[sg*.38,gc+.07,arz-.2],[sg*.38,gc+.06,arz+.28],[sg*.34,rtR+.14,arz-.15]]) base.cyl(K.rubber,.02,.02,.045,px,py,pz,'z',10);
   base.tube(K.steel,[sg*(wxR-.24),rtR-.07,arz-.12],[sg*(wxR-.24),rtR-.06,arz-.12],.07,.07,12);
   base.helix(springC,[sg*(wxR-.24),rtR-.06,arz-.12],[0,1,0],.06,.0066,6.5,.27,7);
   base.tube(0x4a5664,[sg*(wxR-.125),rtR-.05,arz+.12],[sg*(wxR-.16),rtR+.15,arz+.12],.026,.026,10);base.tube(K.chrome,[sg*(wxR-.16),rtR+.15,arz+.12],[sg*(wxR-.19),rtR+.32,arz+.12],.0095,.0095,8);
  }
  if(!ev) base.tube(K.sub,[-.3,gc+.14,arz+.04],[.3,gc+.14,arz+.04],.011,.011,8);
 }
 /* transmission arrière : pont, demi-arbres, arbre de transmission */
 if(drive!=='fwd'&&!ev){
  base.box(K.alu,.3,.2,.28,0,gc+.15,arz);base.cyl(K.alu,.1,.1,.05,0,gc+.15,arz+.16,'z',16);
  for(const k of [-.1,-.03,.04,.11]) base.box(0x969ca3,.31,.012,.26,0,gc+.255,arz+k*0);
  for(const sg of cx){const ix=sg*.17,ox=sg*(wxR-.13);
   base.tube(K.steel,[ix,rtR-.05,arz],[ox,rtR,arz],.0155,.0155,8);
   base.lathe(K.rubber,[[.02,0],[.038,.014],[.026,.03],[.04,.046],[.022,.062]],[ix+sg*.02,rtR-.05,arz],[sg,.2,0],10);base.lathe(K.rubber,[[.02,0],[.042,.014],[.026,.03],[.046,.046],[.025,.062]],[ox-sg*.1,rtR-.005,arz],[sg,.05,0],10);}
  base.tube(0x44484e,[0,gc+.15,arz+.21],[0,gc+.14,front?pz-dirF*.95:eZ],.046,.046,12);
  base.tube(K.steel,[0,gc+.15,arz+.2],[0,gc+.15,arz+.15],.065,.065,12);base.tor(K.rubber,.06,.012,0,gc+.15,arz+.35,'z',14);
  base.box(K.sub,.14,.05,.1,0,gc+.1,arz+.6);base.cyl(K.rubber,.07,.07,.05,0,gc+.14,arz+.6,'z',12);          /* palier central */
 }
 /* ═══════ RÉSERVOIR, POMPE ═══════ */
 const ztk=front?arz+.6:mid?(afz+arz)/2-.1:afz-.55,tkw=W*.22;
 const tkb=gc+.025,tkt=gc+.16;
 for(const sg of cx){base.box(0x34373b,tkw*1.0,tkt-tkb,.78,sg*(tkw/2+.07),(tkb+tkt)/2,ztk);base.box(0x34373b,tkw*.9,.04,.7,sg*(tkw/2+.07),tkt+.02,ztk);}
 base.box(0x34373b,.2,.06,.5,0,tkb+.045,ztk);
 for(const dz of [-.26,.26]){base.box(K.steel,W*.5+.04,.016,.04,0,tkb-.004,ztk+dz);for(const sg of cx) {base.box(K.steel,.025,.15,.035,sg*(tkw+.1),(tkb+tkt)/2,ztk+dz);}}
 base.tube(K.rubber,[-(tkw+.0),tkt-.01,ztk-.25],[-(hw-.12),gc+.4,X.fuelZ],.02,.02,8);
 base.tube(K.rubber,[-(tkw-.02),tkt-.01,ztk-.3],[-(hw-.16),gc+.44,X.fuelZ-.07],.008,.008,6);
 const pp=[tkw*.55+.07,tkb-.012,ztk];A.pump=pp;
 base.cyl(K.steel,.085,.085,.014,pp[0],tkb+.0,ztk,'y',20);
 for(let k=0;k<4;k++){const a=k/4*TAU+.78;base.cyl(K.zinc,.007,.007,.012,pp[0]+Math.cos(a)*.065,tkb-.01,ztk+Math.sin(a)*.065,'y',6);}
 FX.pump=[[.046,.004,.046],[-.046,.004,.046],[.046,.004,-.046],[-.046,.004,-.046]];
 unit('pompe_carburant',0,pp,(b,w)=>{
  b.cyl(w?0x2a2622:0x35383c,.052,.052,.075,pp[0],tkb-.045,ztk,'y',16);b.cyl(K.steel,.062,.062,.01,pp[0],tkb-.007,ztk,'y',18);
  b.box(0x1f2124,.04,.03,.05,pp[0]+.06,tkb-.02,ztk);b.cyl(K.steel,.008,.008,.04,pp[0]-.062,tkb-.03,ztk,'y',6);
  if(w) b.sph(0x2a2420,.03,pp[0],tkb-.085,ztk,1.2,.4,1.2);
 });
 return finish(base,units,A,X,FX);
}

/* assemble les maillages : base (sans pièces amovibles) et complet */
function finish(base,units,A,X,FX){
 const full=new VB();full.vb(base,0,0,0);
 for(const u of units){const p=new VB();p.off(u.piv[0],u.piv[1],u.piv[2]);u.draw(p,false);full.vb(p,u.piv[0],u.piv[1],u.piv[2]);}
 return {full:full.done(),base:base.done(),units:units.map(u=>({id:u.id,i:u.i,piv:u.piv,draw:u.draw,cache:{}})),anchors:A,fix:FX};}

/* géométrie d'une pièce amovible, centrée sur son pivot (usée ou neuve), mise en cache */
function unitGeo(u,w){
 const k=w?'w':'n';if(u.cache[k]) return u.cache[k];
 const b=new VB();b.off(u.piv[0],u.piv[1],u.piv[2]);u.draw(b,!!w);return (u.cache[k]=b.done());}

return {build,mat,unitGeo,ids:IDS,VB};
})();
