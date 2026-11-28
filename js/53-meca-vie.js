'use strict';
/* ───────────── Mode « Mécanicien » — VIE DE LA VILLE (piétons et circulation) ─────────────
   Des passants marchent sur les trottoirs, traversent aux passages piétons quand le feu des voitures est rouge, s'arrêtent
   devant une vitrine ou pour discuter. Des voitures roulent à droite sur leur voie, s'arrêtent aux feux du décor (js/45b),
   tournent aux carrefours, freinent derrière une voiture plus lente, devant un piéton ou devant le joueur, et klaxonnent
   s'il les gêne ou les heurte.

   Principe de performance : tout est dessiné avec des `InstancedMesh` (6 appels pour les piétons, un maillage de carrosserie par
   modèle de la flotte — 12 au plus, tirés du catalogue MWCARS, voir js/53c — + roues + feux + halo des phares pour les voitures). Rien n'est simulé loin du
   joueur : les piétons au-delà de 85 m et les voitures au-delà de 150 m sont retirés et réapparaissent près de lui, de
   préférence hors du champ de vision. Le nombre de PNJ suit la qualité graphique (MWD.Q.level) et l'heure (rares la nuit).

   Points d'accroche : `MW.walls` (js/40, une ligne) donne les colliders. Les voitures de la rue y ajoutent chacune un
   rectangle mobile, ce qui les rend solides pour la voiture et pour les pas du joueur. Aucune donnée n'est sauvegardée.
   Poignée de test : `window.__mwvie`. */
const MWV=(()=>{
const T=THREE,PI=Math.PI;
const RX=[-150,0,150],RZ=[-150,0,150];   /* axes des rues (comme js/40) */
const END=282,SW=8.5,LANE=3.2,BOX=7,STOP=11.2;
const rnd=Math.random,rr=(a,b)=>a+rnd()*(b-a),pick=a=>a[(rnd()*a.length)|0],clamp=(x,a,b)=>x<a?a:x>b?b:x;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const linA=h=>{const c=new T.Color(h);c.convertSRGBToLinear();return [c.r,c.g,c.b];};
const QP={basse:{ped:14,car:8},moyenne:{ped:30,car:16},haute:{ped:48,car:24}};
const MAXP=48,MAXC=24;
const R_PED=85,R_CAR=150;   /* au-delà : retiré et replacé près du joueur */
const PD=[[0,.08],[5,.1],[6.5,.35],[8,1],[9.5,.8],[11.5,.9],[13,1],[15,.8],[17,1],[19,.9],[20.5,.4],[22,.2],[24,.08]];
const CD=[[0,.25],[5,.25],[6.5,.55],[8,1],[10,.75],[12,.9],[14,.75],[17,1],[19,.85],[21,.5],[24,.25]];
const interp=(tab,h)=>{for(let i=1;i<tab.length;i++) if(h<=tab[i][0]){const a=tab[i-1],b=tab[i];return a[1]+(b[1]-a[1])*(h-a[0])/(b[0]-a[0]);}return tab[tab.length-1][1];};
const nightF=h=>h>=20.2||h<5.6?1:h>=19.2?h-19.2:h<6.6?6.6-h:0;
/* zones interdites aux PNJ : terrain du travail au noir (js/43) */
const NOIR=[-46,28,-8,54];

/* ═══════════ Matrices à la main ═══════════ */
function setM(arr,i,px,py,pz,yaw,pitch,sx,sy,sz){
 const o=i*16,c=Math.cos(yaw),s=Math.sin(yaw),ca=Math.cos(pitch),sa=Math.sin(pitch);
 arr[o]=c*sx;arr[o+1]=0;arr[o+2]=-s*sx;arr[o+3]=0;
 arr[o+4]=s*sa*sy;arr[o+5]=ca*sy;arr[o+6]=c*sa*sy;arr[o+7]=0;
 arr[o+8]=s*ca*sz;arr[o+9]=-sa*sz;arr[o+10]=c*ca*sz;arr[o+11]=0;
 arr[o+12]=px;arr[o+13]=py;arr[o+14]=pz;arr[o+15]=1;}
const zeroM=(arr,i)=>{const o=i*16;for(let k=0;k<16;k++) arr[o+k]=0;arr[o+15]=1;};

/* ═══════════ Géométries ═══════════ */
function GB(){return {p:[],n:[],c:[],i:[]};}
function quad(b,P,col,ctr){
 let [p0,p1,p2,p3]=P;
 let ux=p1[0]-p0[0],uy=p1[1]-p0[1],uz=p1[2]-p0[2],vx=p2[0]-p0[0],vy=p2[1]-p0[1],vz=p2[2]-p0[2];
 let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
 const mx=(p0[0]+p2[0])/2-ctr[0],my=(p0[1]+p2[1])/2-ctr[1],mz=(p0[2]+p2[2])/2-ctr[2];
 if(nx*mx+ny*my+nz*mz<0){[p1,p3]=[p3,p1];nx=-nx;ny=-ny;nz=-nz;}
 const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
 const base=b.p.length/3;
 for(const p of [p0,p1,p2,p3]){b.p.push(p[0],p[1],p[2]);b.n.push(nx,ny,nz);b.c.push(col[0],col[1],col[2]);}
 b.i.push(base,base+1,base+2,base,base+2,base+3);}
/* solide à six faces : rectangle du bas (z0b..z1b, demi-largeur wb) et du haut (z0t..z1t, demi-largeur wt) */
function hexa(b,o){
 const x0=o.x||0,wb=o.wb,wt=o.wt==null?wb:o.wt,zb0=o.zb0,zb1=o.zb1,zt0=o.zt0==null?zb0:o.zt0,zt1=o.zt1==null?zb1:o.zt1,y0=o.y0,y1=o.y1;
 const V=[[x0-wb,y0,zb0],[x0+wb,y0,zb0],[x0+wb,y0,zb1],[x0-wb,y0,zb1],[x0-wt,y1,zt0],[x0+wt,y1,zt0],[x0+wt,y1,zt1],[x0-wt,y1,zt1]];
 const ctr=[0,0,0];for(const v of V){ctr[0]+=v[0]/8;ctr[1]+=v[1]/8;ctr[2]+=v[2]/8;}
 const cs=o.cs,ct=o.ct||cs,cb=o.cb||cs;
 quad(b,[V[0],V[1],V[2],V[3]],cb,ctr);quad(b,[V[4],V[5],V[6],V[7]],ct,ctr);
 quad(b,[V[0],V[1],V[5],V[4]],cs,ctr);quad(b,[V[3],V[2],V[6],V[7]],cs,ctr);
 quad(b,[V[0],V[3],V[7],V[4]],cs,ctr);quad(b,[V[1],V[2],V[6],V[5]],cs,ctr);}
function toGeo(b){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));
 g.setAttribute('color',new T.Float32BufferAttribute(b.c,3));g.setIndex(b.i);g.computeBoundingSphere();return g;}

const WHITE=[1,1,1],GLASS=linA(0x26343f),DARK=linA(0x1a1c1f),UNDER=linA(0x101214);
/* gabarits de carrosserie (avant vers +z) */
const ARCH={
 hatch:{L:4.05,W:1.75,H:1.48,y0:.22,belt:.95,zb0:-1.92,zb1:.62,zt0:-1.64,zt1:-.05},
 sedan:{L:4.7,W:1.82,H:1.44,y0:.22,belt:.98,zb0:-1.28,zb1:.78,zt0:-.95,zt1:.18},
 wagon:{L:4.65,W:1.82,H:1.5,y0:.22,belt:.98,zb0:-2.15,zb1:.78,zt0:-2.0,zt1:.12},
 suv:{L:4.5,W:1.84,H:1.68,y0:.3,belt:1.08,zb0:-1.98,zb1:.85,zt0:-1.88,zt1:.2},
 van:{L:4.4,W:1.85,H:1.85,y0:.28,belt:1.0,cargo:.1,zb0:.1,zb1:1.3,zt0:.15,zt1:.85},
 coupe:{L:4.4,W:1.85,H:1.3,y0:.18,belt:.85,zb0:-1.2,zb1:.8,zt0:-.85,zt1:.1}};
function wheelGeo(){
 const b=GB(),tire=linA(0x141416),hub=linA(0xb4b8be),spoke=linA(0x4a4e54);
 const N=12,R=.3,Wd=.22,Rh=.17;
 const ring=(r,w,col)=>{const ctr=[0,0,0];
  for(let k=0;k<N;k++){const a0=k/N*PI*2,a1=(k+1)/N*PI*2,y0=Math.cos(a0)*r,z0=Math.sin(a0)*r,y1=Math.cos(a1)*r,z1=Math.sin(a1)*r;
   quad(b,[[-w/2,y0,z0],[w/2,y0,z0],[w/2,y1,z1],[-w/2,y1,z1]],col,ctr);
   for(const sx of [-w/2,w/2]){const base=b.p.length/3,nx=sx>0?1:-1;
    for(const p of [[sx,0,0],[sx,y0,z0],[sx,y1,z1]]){b.p.push(p[0],p[1],p[2]);b.n.push(nx,0,0);b.c.push(col[0],col[1],col[2]);}
    b.i.push(...(nx>0?[base,base+1,base+2]:[base,base+2,base+1]));}}};
 ring(R,Wd,tire);ring(Rh,Wd+.03,hub);
 hexa(b,{x:0,y0:-Rh*.9,y1:Rh*.9,wb:(Wd+.06)/2,zb0:-.03,zb1:.03,cs:spoke});
 hexa(b,{x:0,y0:-.03,y1:.03,wb:(Wd+.06)/2,zb0:-Rh*.9,zb1:Rh*.9,cs:spoke});
 return toGeo(b);}
function glowTex(){
 const w=64,h=128,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);
 for(let j=0;j<h;j++){const v=j/(h-1);   /* v = 0 : près de la voiture (en haut de l'image) */
  for(let i=0;i<w;i++){const u=(i/(w-1))*2-1,wd=.3+.7*v,q=Math.max(0,1-(u*u)/(wd*wd)),a=Math.pow(1-v,1.25)*Math.pow(q,1.4);
   const o=(j*w+i)*4;im.data[o]=255;im.data[o+1]=238;im.data[o+2]=186;im.data[o+3]=Math.round(255*a);}}
 x.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.flipY=true;return t;}

/* ═══════════ Réseau piéton : coins de carrefour, trottoirs, passages ═══════════ */
const nodes=[],edges=[];
function addNode(x,z){nodes.push({x,z,adj:[]});return nodes.length-1;}
function addEdge(a,b,kind,ax,bx,bz){
 const A=nodes[a],B=nodes[b],dx=B.x-A.x,dz=B.z-A.z,len=Math.hypot(dx,dz);
 const e={id:edges.length,a,b,len,ux:dx/len,uz:dz/len,kind,ax,bx:bx||0,bz:bz||0};edges.push(e);A.adj.push(e);B.adj.push(e);return e;}
function buildGraph(){
 const id={},key=(i,j,sx,sz)=>i+','+j+','+sx+','+sz;
 for(let i=0;i<3;i++) for(let j=0;j<3;j++) for(const sx of [-1,1]) for(const sz of [-1,1]) id[key(i,j,sx,sz)]=addNode(RX[i]+sx*SW,RZ[j]+sz*SW);
 for(let i=0;i<3;i++) for(let j=0;j<3;j++){
  for(const sx of [-1,1]) addEdge(id[key(i,j,sx,-1)],id[key(i,j,sx,1)],'c','cz');   /* traverse la rue est-ouest (marche selon z) */
  for(const sz of [-1,1]) addEdge(id[key(i,j,-1,sz)],id[key(i,j,1,sz)],'c','cx');}   /* traverse la rue nord-sud (marche selon x) */
 for(let i=0;i<3;i++) for(const sx of [-1,1]){
  for(let j=0;j<2;j++) addEdge(id[key(i,j,sx,1)],id[key(i,j+1,sx,-1)],'w','z',sx,0);
  addEdge(id[key(i,0,sx,-1)],addNode(RX[i]+sx*SW,-END),'w','z',sx,0);addEdge(id[key(i,2,sx,1)],addNode(RX[i]+sx*SW,END),'w','z',sx,0);}
 for(let j=0;j<3;j++) for(const sz of [-1,1]){
  for(let i=0;i<2;i++) addEdge(id[key(i,j,1,sz)],id[key(i+1,j,-1,sz)],'w','x',0,sz);
  addEdge(id[key(0,j,-1,sz)],addNode(-END,RZ[j]+sz*SW),'w','x',0,sz);addEdge(id[key(2,j,1,sz)],addNode(END,RZ[j]+sz*SW),'w','x',0,sz);}
 let tot=0;for(const e of edges){tot+=e.len;e.cum=tot;}
 edges.total=tot;}
buildGraph();
const randEdge=()=>{const r=rnd()*edges.total;for(const e of edges) if(r<=e.cum) return e;return edges[0];};

/* ═══════════ Colliders statiques (grille) ═══════════ */
const CELL=24,grid=new Map();let wallsN=-1,extraR=null;
function rebuildGrid(){
 grid.clear();const W=MW.walls||[];
 if(!extraR){extraR=[];for(const z of MW.zones) if(z.interior) extraR.push([z.x-z.w/2-.8,z.z-z.d/2-.8,z.x+z.w/2+.8,z.z+z.d/2+.8]);extraR.push(NOIR);}
 const add=r=>{for(let gx=Math.floor((r[0]-1)/CELL);gx<=Math.floor((r[2]+1)/CELL);gx++) for(let gz=Math.floor((r[1]-1)/CELL);gz<=Math.floor((r[3]+1)/CELL);gz++){
  const k=gx*1000+gz;let a=grid.get(k);if(!a){a=[];grid.set(k,a);}a.push(r);}};
 for(const r of W) if(!r._v) add(r);
 for(const r of extraR) add(r);
 wallsN=W.length;}
function pushOut(px,pz,r){
 const a=grid.get(Math.floor(px/CELL)*1000+Math.floor(pz/CELL));if(!a) return null;let hit=false;
 for(let pass=0;pass<2;pass++) for(let i=0;i<a.length;i++){const w=a[i];
  if(px<w[0]-r||px>w[2]+r||pz<w[1]-r||pz>w[3]+r) continue;
  const cx=clamp(px,w[0],w[2]),cz=clamp(pz,w[1],w[3]),dx=px-cx,dz=pz-cz,d2=dx*dx+dz*dz;
  if(d2>=r*r) continue;hit=true;
  if(d2>1e-8){const d=Math.sqrt(d2),k=(r-d)/d;px+=dx*k;pz+=dz*k;}
  else{const l=px-w[0],rr2=w[2]-px,u=pz-w[1],dn=w[3]-pz,m=Math.min(l,rr2,u,dn);if(m===l) px=w[0]-r;else if(m===rr2) px=w[2]+r;else if(m===u) pz=w[1]-r;else pz=w[3]+r;}}
 return hit?[px,pz]:null;}
const inNoGo=(x,z)=>{for(const r of extraR||[]) if(x>r[0]&&x<r[2]&&z>r[1]&&z<r[3]) return true;return false;};

/* ═══════════ Feux ═══════════ */
let stepping=false,sigClock=0,tlA=null,tlB=null,sigS=[0,2],redAt=[0,0],tNow=0;
function readSig(){
 let a,b;
 if(tlA&&tlB&&!stepping){a=Math.round(tlA.map.offset.x/.25)%4;b=Math.round(tlB.map.offset.x/.25)%4;}
 else{const c=sigClock%48;a=c<20?0:c<23?1:2;b=c<26?2:c<44?0:1;}
 if(a===2&&sigS[0]!==2) redAt[0]=tNow;if(b===2&&sigS[1]!==2) redAt[1]=tNow;
 sigS[0]=a;sigS[1]=b;}
const crossOK=ax=>{const k=ax==='cz'?0:1;return sigS[k]===2&&tNow-redAt[k]<9;};

/* ═══════════ Objets 3D ═══════════ */
let G=null,pedM=null,carM=null,inited=false,lastQ='';
const mk=(g,m,n)=>{const o=new T.InstancedMesh(g,m,n);o.frustumCulled=false;o.instanceMatrix.setUsage(T.DynamicDrawUsage);
 const col=new T.Color(1,1,1);for(let i=0;i<n;i++){o.setColorAt(i,col);zeroM(o.instanceMatrix.array,i);}o.instanceColor.needsUpdate=true;o.instanceMatrix.needsUpdate=true;return o;};
const lm=(extra)=>{const m=new T.MeshLambertMaterial(Object.assign({color:0xffffff},extra||{}));m.userData={lin:1};return m;};
const tmpC=new T.Color();
const setCol=(im,i,hex)=>{tmpC.setHex(hex).convertSRGBToLinear();im.setColorAt(i,tmpC);im.instanceColor.needsUpdate=true;};
const setColA=(im,i,rgb)=>{tmpC.setRGB(rgb[0],rgb[1],rgb[2]);im.setColorAt(i,tmpC);};

const SKIN=[0xf0c8a0,0xe0b088,0xc88c60,0xa86c44,0x7a4a30,0x5a3422,0xf4d4b8];
const HAIR=[0x1a1410,0x3a2616,0x5a3a1c,0x8a5a2a,0xc8a050,0x8a8a8a,0xd8d0c0,0x602018];
const SHIRT=[0xc8302a,0x2a5aa8,0xe8e0d0,0x2a8a5a,0xe0b020,0x6a3a8a,0x202428,0xe87a2a,0x8ab0d0,0xd870a0,0x5a6a2a,0x9a9a9a,0xf4f0e6,0x3a3a5a];
const PANTS=[0x2a3a5a,0x1c1c20,0x4a4036,0x6a5a46,0x8a8070,0x3a4a6a,0x5a2a2a,0x2a2a3a,0x6a7a8a];
const SHOES=[0x1a1a1a,0x3a2a1c,0xe8e8e8,0x2a3a6a,0x5a1a1a];
const CAPS=[0xc8302a,0x2a5aa8,0x202428,0xe0b020,0x2a8a5a];
const CAR_COL=[0xb03030,0x2a4a8a,0xe0e0e0,0x202428,0x3a7a4a,0xd8a020,0x8a8f98,0x6a2a5a,0xc4c4c0,0x7a4a2a,0xf0f0f0,0x1a1a1a,0x5a7a9a,0xa04020,0x9aa4b0,0x2f3a4a,0x8a1a24];
const VAN_COL=[0xf0f0f0,0xf0f0f0,0xe0e0e0,0xc4c4c0,0x2a4a8a,0xb03030,0x8a8f98];
const peds=[],cars=[];
let pedModels=null,carModels=null;

function pickCarModels(){
 const out=[];
 try{
  for(const c of MWCARS.list){
   const body=c.body,arch=body==='van'?'van':body==='suv'?'suv':body==='wagon'?'wagon':body==='sedan'?'sedan':(body==='coupe'||body==='mid'||body==='rear')?'coupe':'hatch';
   const w=c.cat==='pop'?4:c.cat==='gen'?3:c.cat==='prem'?1.5:.5;
   out.push({id:c.id,arch,L:c.L||ARCH[arch].L,W:c.W||ARCH[arch].W,H:c.H||ARCH[arch].H,WB:c.WB||(c.L||4)*.62,w,mass:c.mass||1250});}
 }catch(e){}
 if(!out.length) for(const [arch,w] of [['hatch',5],['sedan',3],['suv',2],['van',1],['wagon',1],['coupe',.5]]){const a=ARCH[arch];out.push({id:arch,arch,L:a.L,W:a.W,H:a.H,WB:a.L*.62,w,mass:1250});}
 return out;}
/* Flotte de la circulation : au plus FLOTTE modèles du catalogue (un maillage instancié par modèle, donc un appel de dessin chacun). */
const FLOTTE=12;
let fleet=[];
function choisirFlotte(tous){
 const restes=tous.slice(),choisis=[];
 while(choisis.length<FLOTTE&&restes.length){
  let total=0;
  for(const m of restes) total+=m.w;
  let tirage=rnd()*total;
  let k=0;
  for(;k<restes.length-1;k++){
   tirage-=restes[k].w;
   if(tirage<=0) break;}
  choisis.push(restes.splice(k,1)[0]);}
 return choisis;}
function pickModel(){
 let t=0;
 for(const m of fleet) t+=m.w;
 let r=rnd()*t;
 for(const m of fleet){
  r-=m.w;
  if(r<=0) return m;}
 return fleet[0];}

function init(){
 if(inited) return;inited=true;
 carModels=pickCarModels();
 fleet=choisirFlotte(carModels);
 try{tlA=MWD.mat('tlA');tlB=MWD.mat('tlB');if(!tlA.map||!tlB.map){tlA=tlB=null;}}catch(e){tlA=tlB=null;}
 G=new T.Group();G.name='vie';
 /* piétons : 6 maillages */
 const box=(w,h,d,dy,dz,dx)=>new T.BoxGeometry(w,h,d).translate(dx||0,dy||0,dz||0);
 const matP=lm(),matShoe=lm();
 pedM={
  torso:mk(box(1,1,1),matP,MAXP),legs:mk(box(1,1,1,-.5),matP,MAXP*2),shoes:mk(box(.16,.1,.3,-.84,.06),matShoe,MAXP*2),
  arms:mk(box(1,1,1,-.5),matP,MAXP*2),head:mk(box(1,1,1),matP,MAXP),hair:mk(box(1,1,1),matP,MAXP)};
 for(const k in pedM) G.add(pedM[k]);
 /* voitures : un maillage de carrosserie par gabarit, roues, feux, halo des phares */
 const matC=MWVC.material();
 carM={body:{},wheels:mk(wheelGeo(),lm({vertexColors:true}),MAXC*4),lights:null,glow:null};
 for(const m of fleet){
  const gabarit=MWVC.spec(m.id);
  m.spec=gabarit;
  carM.body[m.id]=mk(MWVC.merged(gabarit),matC,MAXC);}
 const matL=new T.MeshBasicMaterial({color:0xffffff});matL.userData={lin:1};
 carM.lights=mk(new T.BoxGeometry(1,1,1),matL,MAXC*4);
 const gt=glowTex(),matG=new T.MeshBasicMaterial({map:gt,transparent:true,blending:T.AdditiveBlending,depthWrite:false,fog:false,opacity:0});matG.userData={lin:1};
 carM.glow=mk(new T.PlaneGeometry(1,1).rotateX(-PI/2),matG,MAXC);carM.glow.renderOrder=3;carM.glow.visible=false;
 for(const id in carM.body) G.add(carM.body[id]);
 G.add(carM.wheels,carM.lights,carM.glow);
 MW.scene.add(G);
 for(let i=0;i<MAXP;i++) peds.push({i,on:false,x:0,z:0,ry:0,state:'walk',ph:0,v:1.3,t:0,lat:0,timer:0});
 for(let i=0;i<MAXC;i++){
  const wb=[1e6,1e6,1e6+1,1e6+1];wb._v=true;
  cars.push({i,on:false,x:0,z:0,ry:0,v:0,wall:wb,arch:'hatch',roll:0,brake:false,lc:-1,hc:-1});
  if(MW.walls) MW.walls.push(wb);}
 rebuildGrid();}

/* ═══════════ Réglages de population ═══════════ */
let forced=null,player=null,pcar=null,camDir=new T.Vector3(),camPos=new T.Vector3(),hour=12,night=0,wantP=0,wantC=0,tgtT=0,lightsN=-1;
const visible=(x,z,m)=>{const dx=x-camPos.x,dz=z-camPos.z,d=Math.hypot(dx,dz)||1;return (dx*camDir.x+dz*camDir.z)/d>(m==null?.5:m);};
function targets(){
 const q=QP[(typeof MWD!=='undefined'&&MWD.Q&&QP[MWD.Q.level])?MWD.Q.level:'moyenne'];
 wantP=Math.round(q.ped*interp(PD,hour));wantC=Math.round(q.car*interp(CD,hour));
 if(forced){wantP=forced[0];wantC=forced[1];}}

/* ═══════════ Piétons ═══════════ */
function dressPed(p){
 p.k=rr(.93,1.07);p.skin=pick(SKIN);p.hairC=pick(HAIR);p.hs=rnd()<.42?1:rnd()<.12?2:0;p.capC=pick(CAPS);
 p.shirt=pick(SHIRT);p.pants=pick(PANTS);p.shoe=pick(SHOES);p.sleeve=rnd()<.6;p.spd=rnd()<.05?rr(2.4,3.2):rr(1.05,1.6);p.stride=rr(.9,1.1);p.build=rr(.92,1.12);
 const I=p.i;
 setCol(pedM.torso,I,p.shirt);setCol(pedM.head,I,p.skin);setCol(pedM.hair,I,p.hs===2?p.capC:p.hairC);
 for(const s of [0,1]){setCol(pedM.legs,I*2+s,p.pants);setCol(pedM.shoes,I*2+s,p.shoe);setCol(pedM.arms,I*2+s,p.sleeve?p.shirt:p.skin);}}
function startEdge(p,node,e){
 const fwd=e.a===node,A=nodes[fwd?e.a:e.b],B=nodes[fwd?e.b:e.a];
 p.nextE=null;p.e=e;p.from=fwd?e.a:e.b;p.to=fwd?e.b:e.a;p.ax=A.x;p.az=A.z;p.ux=fwd?e.ux:-e.ux;p.uz=fwd?e.uz:-e.uz;p.len=e.len;p.t=0;p.lat=rr(-1.1,1.1);p.state='walk';
 p.shopT=rr(4,16);}
function chooseEdge(p,node){
 const N=nodes[node],opts=N.adj.filter(e=>e!==p.e);
 if(!opts.length) return p.e;   /* cul-de-sac : demi-tour */
 let tot=0;const w=opts.map(e=>{
  const fwd=e.a===node,ux=fwd?e.ux:-e.ux,uz=fwd?e.uz:-e.uz;
  const s=1+(e.kind==='c'?.7:0)+((p.ux!=null&&ux*p.ux+uz*p.uz>.8)?1.6:0);tot+=s;return s;});
 let r=rnd()*tot;for(let i=0;i<opts.length;i++){r-=w[i];if(r<=0) return opts[i];}return opts[0];}
function placePed(p,e,t){
 startEdge(p,rnd()<.5?e.a:e.b,e);
 p.t=clamp(t,0,p.len);p.x=p.ax+p.ux*p.t-p.uz*p.lat;p.z=p.az+p.uz*p.t+p.ux*p.lat;p.ry=Math.atan2(p.ux,p.uz);}
function spawnPed(p,free){
 for(let n=0;n<28;n++){
  const e=randEdge();let dmin=free?10:34,dmax=R_PED-8;
  const t=rr(0,e.len),fx=nodes[e.a].x+(nodes[e.b].x-nodes[e.a].x)*t/e.len,fz=nodes[e.a].z+(nodes[e.b].z-nodes[e.a].z)*t/e.len;
  const d=Math.hypot(fx-player.x,fz-player.z);
  if(d<dmin||d>dmax) continue;
  if(!free&&d<R_PED*.8&&visible(fx,fz,.42)) continue;
  /* près d'un carrefour, on évite de s'empiler : laisser 2 m entre piétons */
  let ok=true;for(const q of peds) if(q.on&&q!==p&&Math.abs(q.x-fx)<1.6&&Math.abs(q.z-fz)<1.6){ok=false;break;}
  if(!ok||inNoGo(fx,fz)) continue;
  dressPed(p);placePed(p,e,t);p.on=true;p.state='walk';p.pair=null;p.v=p.spd;return true;}
 return false;}
function offPed(p){p.on=false;for(let s=0;s<2;s++){for(const k of ['legs','shoes','arms']) zeroM(pedM[k].instanceMatrix.array,p.i*2+s);}
 for(const k of ['torso','head','hair']) zeroM(pedM[k].instanceMatrix.array,p.i);}

function updPed(p,dt){
 const sp=Math.hypot(p.x-player.x,p.z-player.z);
 if(sp>R_PED){offPed(p);return;}
 let moving=false,vx=0,vz=0;
 if(p.state==='walk'){
  p.shopT-=dt;
  let spd=p.spd;
  /* avance vers un point un peu devant, avec son décalage latéral */
  const tt=Math.min(p.len,p.t+1.3),tx=p.ax+p.ux*tt-p.uz*p.lat,tz=p.az+p.uz*tt+p.ux*p.lat;
  let dx=tx-p.x,dz=tz-p.z;const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;
  vx=dx*spd;vz=dz*spd;
  moving=true;
  /* évite le joueur, sa voiture, les voitures de la rue et les autres piétons */
  let ax=0,az=0;
  const away=(ox,oz,R,k)=>{const ex=p.x-ox,ez=p.z-oz,d=Math.hypot(ex,ez);if(d<R&&d>1e-4){const f=(R-d)/R*k;ax+=ex/d*f;az+=ez/d*f;return d;}return 99;};
  const dpl=away(player.x,player.z,player.inCar?0:1.7,2.6);
  if(!player.inCar&&dpl<1.0) spd*=.25;
  if(pcar){const ca=Math.sin(pcar.ry),cb=Math.cos(pcar.ry),mv=Math.abs(pcar.speed),R=1.5+Math.min(4,mv*.45);
   for(const o of [-1,0,1]) away(pcar.x+ca*o*1.2,pcar.z+cb*o*1.2,R,mv>1.5?5:2.4);}
  for(const c of cars) if(c.on&&Math.abs(c.x-p.x)<5&&Math.abs(c.z-p.z)<5){const R=1.5+c.v*.2;for(const o of [-1,0,1]) away(c.x+Math.sin(c.ry)*o*1.3,c.z+Math.cos(c.ry)*o*1.3,R,3.2);}
  for(const q of peds) if(q.on&&q!==p&&Math.abs(q.x-p.x)<.9&&Math.abs(q.z-p.z)<.9) away(q.x,q.z,.7,1.3);
  vx=vx*(spd/p.spd)+ax;vz=vz*(spd/p.spd)+az;
  let nx=p.x+vx*dt,nz=p.z+vz*dt;
  const po=pushOut(nx,nz,.3);if(po){nx=po[0];nz=po[1];}
  p.x=nx;p.z=nz;
  p.t=Math.max(p.t,(p.x-p.ax)*p.ux+(p.z-p.az)*p.uz);
  const spdA=Math.hypot(vx,vz);p.v=spdA;
  if(spdA>.2){const want=Math.atan2(vx,vz);let da=want-p.ry;da=Math.atan2(Math.sin(da),Math.cos(da));p.ry+=clamp(da,-9*dt,9*dt);}
  p.ph+=spdA*dt*4.2*p.stride;
  /* arrêt devant une vitrine (trottoir seulement, loin des coins) */
  if(p.e.kind==='w'&&p.shopT<0&&p.t>5&&p.t<p.len-5&&Math.abs(p.lat)<1.3){
   if(rnd()<.5){p.state='shop';p.timer=rr(4,9);p.fx=p.e.bx;p.fz=p.e.bz;}else p.shopT=rr(6,18);}
  else if(p.shopT<0) p.shopT=rr(6,18);
  /* rencontre : discussion */
  if(p.e.kind==='w'&&p.t>4&&p.t<p.len-4&&p.chatT==null) p.chatT=rr(2,8);
  if(p.chatT!=null){p.chatT-=dt;if(p.chatT<0){p.chatT=null;
   for(const q of peds) if(q.on&&q!==p&&q.state==='walk'&&q.e&&q.e.kind==='w'&&Math.abs(q.x-p.x)<2.4&&Math.abs(q.z-p.z)<2.4&&rnd()<.35){
    p.state=q.state='chat';p.pair=q;q.pair=p;p.timer=q.timer=rr(6,14);p.chatT=q.chatT=null;
    p.cx=q.cx=(p.x+q.x)/2;p.cz=q.cz=(p.z+q.z)/2;break;}}}
  /* bout de tronçon */
  if(p.t>=p.len-2&&!p.nextE){
   /* on choisit la suite 2 m avant le coin : si le feu n'est pas bon, on attend en retrait du passage piéton */
   const e=chooseEdge(p,p.to),node=p.to;p.nextE=e;
   if(e.kind==='c'&&!crossOK(e.ax)){p.state='wait';p.wait=e;p.waitNode=node;p.timer=0;p.tw=0;p.nextE=null;
    const fwd=e.a===node;p.fx=fwd?e.ux:-e.ux;p.fz=fwd?e.uz:-e.uz;}}
  else if(p.t>=p.len-.35&&p.nextE){const e=p.nextE;p.nextE=null;startEdge(p,p.to,e);}
 }else if(p.state==='wait'){
  p.v=0;p.tw+=dt;p.timer+=dt;
  if(p.timer>.25){p.timer=0;if(crossOK(p.wait.ax)){p.state='walk';p.nextE=p.wait;}else if(p.tw>40){const e=chooseEdge(p,p.waitNode);if(!(e.kind==='c'&&!crossOK(e.ax))){p.state='walk';p.nextE=e;}p.tw=0;}}
  const want=Math.atan2(p.fx,p.fz);let da=want-p.ry;da=Math.atan2(Math.sin(da),Math.cos(da));p.ry+=clamp(da,-5*dt,5*dt);
 }else if(p.state==='shop'){
  p.v=0;p.timer-=dt;
  const want=Math.atan2(p.fx,p.fz);let da=want-p.ry;da=Math.atan2(Math.sin(da),Math.cos(da));p.ry+=clamp(da,-4*dt,4*dt);
  if(Math.hypot(p.x-player.x,p.z-player.z)<1.2&&!player.inCar) p.timer=Math.min(p.timer,.3);
  if(p.timer<=0){p.state='walk';p.shopT=rr(10,25);}
 }else if(p.state==='chat'){
  p.v=0;p.timer-=dt;const q=p.pair;
  if(!q||!q.on||q.state!=='chat'){p.state='walk';p.pair=null;return;}
  const want=Math.atan2(q.x-p.x,q.z-p.z);let da=want-p.ry;da=Math.atan2(Math.sin(da),Math.cos(da));p.ry+=clamp(da,-5*dt,5*dt);
  p.ph+=dt*2.2;
  if(p.timer<=0||(Math.hypot(p.x-player.x,p.z-player.z)<1.1&&!player.inCar)){p.state='walk';p.pair=null;p.shopT=rr(10,25);p.chatT=null;}}
 if(p.state!=='walk'&&p.state!=='shop'&&p.state!=='wait'&&p.state!=='chat') p.state='walk';
 /* garde : jamais dans une zone interdite */
 if(inNoGo(p.x,p.z)){offPed(p);}}

function writePed(p){
 if(!p.on) return;
 const I=p.i,k=p.k,c=Math.cos(p.ry),s=Math.sin(p.ry),walk=p.state==='walk'&&p.v>.15,amp=walk?Math.min(.75,.18+p.v*.34):0;
 const sw=Math.sin(p.ph),bob=walk?Math.abs(Math.cos(p.ph))*.035*k:0;
 const lx=(ox,oy,oz)=>[p.x+c*ox+s*oz,oy+bob,p.z-s*ox+c*oz];
 const bw=p.build;
 let t=lx(0,1.18*k,0);setM(pedM.torso.instanceMatrix.array,I,t[0],t[1],t[2],p.ry,0,.42*k*bw,.6*k,.24*k*bw);
 t=lx(0,1.62*k,.01);setM(pedM.head.instanceMatrix.array,I,t[0],t[1],t[2],p.ry,0,.2*k,.24*k,.22*k);
 /* cheveux */
 if(p.hs===0){t=lx(0,1.705*k,-.008);setM(pedM.hair.instanceMatrix.array,I,t[0],t[1],t[2],p.ry,0,.215*k,.115*k,.235*k);}
 else if(p.hs===1){t=lx(0,1.585*k,-.05);setM(pedM.hair.instanceMatrix.array,I,t[0],t[1],t[2],p.ry,0,.235*k,.34*k,.2*k);}
 else{t=lx(0,1.74*k,.03);setM(pedM.hair.instanceMatrix.array,I,t[0],t[1],t[2],p.ry,0,.22*k,.07*k,.3*k);}
 /* jambes, pieds, bras : pivots au haut du membre */
 let la=sw*amp,ra=-sw*amp,al=-la*.8,ar=-ra*.8;
 if(p.state==='chat'){al=-.2;ar=-.9+Math.sin(p.ph*1.7)*.35;}
 else if(p.state==='shop'){al=ar=0;}
 for(let sd=0;sd<2;sd++){const sg=sd?1:-1,a=sd?ra:la,ar2=sd?ar:al,j=I*2+sd;
  t=lx(sg*.1*k*bw,.88*k,0);setM(pedM.legs.instanceMatrix.array,j,t[0],t[1],t[2],p.ry,a,.17*k,.88*k,.2*k);
  setM(pedM.shoes.instanceMatrix.array,j,t[0],t[1],t[2],p.ry,a,k,k,k);
  t=lx(sg*.265*k*bw,1.46*k,0);setM(pedM.arms.instanceMatrix.array,j,t[0],t[1],t[2],p.ry,ar2,.095*k,.6*k,.1*k);}}

/* ═══════════ Voitures ═══════════ */
const cd=c=>c.o===0?(c.dir>0?[1,0]:[-1,0]):(c.dir>0?[0,1]:[0,-1]);
function roadPos(c){
 if(c.o===0){c.x=c.s;c.z=RZ[c.ax]+c.dir*c.lo;c.ry=c.dir>0?PI/2:-PI/2;}
 else{c.z=c.s;c.x=RX[c.ax]-c.dir*c.lo;c.ry=c.dir>0?0:PI;}}
function nextCross(c){
 const co=c.o===0?RX:RZ;let best=null;
 for(let k=0;k<3;k++){const dd=c.dir*(co[k]-c.s);if(dd>0&&(!best||dd<best.dd)) best={k,c:co[k],dd};}
 return best;}
function offCar(c){c.on=false;c.keep=false;c.wall[0]=c.wall[1]=1e6;c.wall[2]=c.wall[3]=1e6+1;
 for(const id in carM.body) zeroM(carM.body[id].instanceMatrix.array,c.i);
 for(let j=0;j<4;j++){zeroM(carM.wheels.instanceMatrix.array,c.i*4+j);zeroM(carM.lights.instanceMatrix.array,c.i*4+j);}
 zeroM(carM.glow.instanceMatrix.array,c.i);}
function setupCar(c){
 const m=pickModel();
 c.model=m;
 c.L=m.L;
 c.W=m.W;
 c.wr=m.spec.wheelR;
 c.lightY=.2+(m.H-.2)*.34;
 c.vmax=m.arch==='van'?rr(9,11.5):rr(10,13.5);
 const couleur=m.arch==='van'?pick(VAN_COL):pick(CAR_COL);
 for(const id in carM.body) zeroM(carM.body[id].instanceMatrix.array,c.i);
 setCol(carM.body[m.id],c.i,couleur);
 c.v=0;c.state='road';c.lo=LANE;c.lot=LANE;c.plan=null;c.planK=-1;c.blockT=0;c.ghost=0;c.hold=0;c.hornT=0;c.byp=false;c.yieldT=0;
 c.brake=false;c.lc=-1;c.roll=0;c.why='';}
function spawnCar(c,free){
 for(let n=0;n<40;n++){
  const o=rnd()<.5?0:1,ax=(rnd()*3)|0,dir=rnd()<.5?1:-1,s=rr(-272,272),co=o===0?RX:RZ;
  if(co.some(k=>Math.abs(s-k)<BOX+8)) continue;
  const x=o===0?s:RX[ax]-dir*LANE,z=o===0?RZ[ax]+dir*LANE:s;
  const d=Math.hypot(x-player.x,z-player.z);
  if(d<(free?14:45)||d>R_CAR-12) continue;
  if(!free&&d<R_CAR*.75&&visible(x,z,.35)) continue;
  if(pcar&&Math.hypot(x-pcar.x,z-pcar.z)<14) continue;
  let ok=true;for(const q of cars) if(q.on&&q!==c&&Math.abs(q.x-x)<14&&Math.abs(q.z-z)<14){ok=false;break;}
  if(!ok||inNoGo(x,z)) continue;
  setupCar(c);c.o=o;c.ax=ax;c.dir=dir;c.s=s;roadPos(c);c.v=c.vmax*rr(.5,.9);c.on=true;
  return true;}
 return false;}

/* cercles d'obstacles de l'image courante : [x,z,rayon,vx,vz,genre,propriétaire] ; genre 0 voiture, 1 piéton, 2 joueur, 3 voiture du joueur */
let CIR=[];
function buildCircles(){
 CIR.length=0;
 if(!player.inCar) CIR.push([player.x,player.z,.5,0,0,2,null]);
 if(pcar){
  /* la voiture du joueur : trois cercles qui recouvrent son rectangle réel (longueur × largeur du modèle) */
  const ca=Math.sin(pcar.ry),cb=Math.cos(pcar.ry),vx=ca*pcar.speed,vz=cb*pcar.speed;
  const rayon=(pcar.W||1.8)/2,e=Math.max(0,(pcar.L||4)/2-rayon);
  for(const o of [-e,0,e]) CIR.push([pcar.x+ca*o,pcar.z+cb*o,rayon,vx,vz,3,null]);}
 for(const p of peds) if(p.on&&Math.abs(p.x-player.x)<R_CAR&&Math.abs(p.z-player.z)<R_CAR) CIR.push([p.x,p.z,.38,Math.sin(p.ry)*p.v,Math.cos(p.ry)*p.v,1,p]);
 for(const c of cars) if(c.on){const ca=Math.sin(c.ry),cb=Math.cos(c.ry),e=c.L/2-c.W/2-.1;
  for(const o of [-e,0,e]) CIR.push([c.x+ca*o,c.z+cb*o,c.W/2+.05,ca*c.v,cb*c.v,0,c]);}}
/* plus petite vitesse permise par les obstacles devant la voiture (cap h) */
function obstacle(c,hx,hz,ignoreCars){
 const look=9+c.v*2.6+c.L/2,B=4.6;let vs=1e9,who=null,fwho=0;
 for(let i=0;i<CIR.length;i++){const q=CIR[i];
  if(q[6]===c) continue;
  const rx=q[0]-c.x,rz=q[1]-c.z,f=rx*hx+rz*hz;
  if(f<-.5||f>look+q[2]) continue;
  const lat=-rx*hz+rz*hx;   /* + = à droite du cap */
  const kind=q[5];
  if(kind===0&&(ignoreCars||(c.byp&&q[3]*hx+q[4]*hz<-1))) continue;
  const half=c.W/2+q[2]+(kind===1||kind===2?.35:.18);
  if(Math.abs(lat)>half) continue;
  const gap=f-c.L/2-q[2],minGap=kind===0?2.2:kind===3?2.6:3.2;
  const vo=Math.max(0,q[3]*hx+q[4]*hz),vsafe=Math.sqrt(vo*vo+2*B*Math.max(0,gap-minGap));
  if(vsafe<vs){vs=vsafe;who=q;fwho=f;}}
 return {vs,who,f:fwho};}
function honk(x,z,force){
 try{
  if(typeof SFX!=='undefined'&&SFX&&SFX.on===false) return;
  const d=Math.hypot(x-player.x,z-player.z);if(d>80) return;
  if(tNow-honk.last<(force?.4:1.3)) return;
  const A=window.AudioContext||window.webkitAudioContext;if(!A) return;
  if(!honk.ctx) honk.ctx=new A();const ctx=honk.ctx;
  if(ctx.state==='suspended'){ctx.resume().catch(()=>{});return;}
  honk.last=tNow;const t0=ctx.currentTime+.01,v=.045*(1-d/80)+.004;
  const g=ctx.createGain();g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(v,t0+.02);g.gain.setValueAtTime(v,t0+.2);g.gain.linearRampToValueAtTime(0,t0+.26);
  const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=1700;f.connect(g);g.connect(ctx.destination);
  for(const hz of [405,510+(rnd()*20|0)]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz;o.connect(f);o.start(t0);o.stop(t0+.3);}
 }catch(e){}}
honk.last=-9;

function leftConflict(c,nx){
 for(const o of cars) if(o.on&&o!==c&&o.state==='road'&&o.o===c.o&&o.ax===c.ax&&o.dir===-c.dir){
  const dd=o.dir*(nx.c-o.s);if(dd>-BOX&&dd<30&&(o.v>1.5||dd<14)) return true;}
 return false;}
function bez(c,t){const u=1-t,b=c.bz;return [u*u*b[0]+2*u*t*b[2]+t*t*b[4],u*u*b[1]+2*u*t*b[3]+t*t*b[5]];}
function startTurn(c,nx){
 const d=cd(c),dx=d[0],dz=d[1],rx=-dz,rz=dx,C=c.o===0?[RX[nx.k],RZ[c.ax]]:[RX[c.ax],RZ[nx.k]];
 let d2,P0,P1,P2;
 if(c.plan==='r'){d2=[rx,rz];P0=[C[0]-BOX*dx+LANE*d2[0],C[1]-BOX*dz+LANE*d2[1]];P1=[C[0]-LANE*dx+LANE*d2[0],C[1]-LANE*dz+LANE*d2[1]];P2=[C[0]+BOX*d2[0]-LANE*dx,C[1]+BOX*d2[1]-LANE*dz];}
 else{d2=[-rx,-rz];P0=[C[0]-BOX*dx-LANE*d2[0],C[1]-BOX*dz-LANE*d2[1]];P1=[C[0]+LANE*dx-LANE*d2[0],C[1]+LANE*dz-LANE*d2[1]];P2=[C[0]+BOX*d2[0]+LANE*dx,C[1]+BOX*d2[1]+LANE*dz];}
 c.bz=[P0[0],P0[1],P1[0],P1[1],P2[0],P2[1]];
 let len=0,pr=P0;for(let i=1;i<=10;i++){const q=bez(c,i/10);len+=Math.hypot(q[0]-pr[0],q[1]-pr[1]);pr=q;}
 c.tl=len;c.tt=0;c.state='turn';c.nd=d2;c.nk=nx.k;c.lo=LANE;
 /* nouvelle route */
 c.no=1-c.o;c.nax=nx.k;c.ndir=c.no===0?(d2[0]>0?1:-1):(d2[1]>0?1:-1);
 /* sortie : bord du carrefour, le long de la nouvelle rue */
 c.ns=c.no===0?C[0]+BOX*c.ndir:C[1]+BOX*c.ndir;}
function updCar(c,dt){
 const sp=Math.hypot(c.x-player.x,c.z-player.z);
 if(sp>R_CAR||(c.state==='road'&&Math.abs(c.s)>END+3)){offCar(c);return;}
 if(c.hold>0){c.hold-=dt;c.v=Math.max(0,c.v-9*dt);}
 let lim=c.vmax,why='';c.inBox=c.state==='turn';
 const h=c.state==='road'?cd(c):[Math.sin(c.ry),Math.cos(c.ry)];
 /* obstacles devant */
 const ob=obstacle(c,h[0],h[1],c.ghost>0);
 if(ob.vs<lim){lim=ob.vs;why=ob.who?(ob.who[5]===3?'joueur-voiture':ob.who[5]===2?'joueur':ob.who[5]===1?'pieton':'voiture'):'';}
 if(c.state==='road'){
  const nx=nextCross(c);
  if(nx){
   if(c.planK!==nx.k||c.planC!==nx.c){c.planK=nx.k;c.planC=nx.c;const r=rnd();c.plan=r<.58?'s':r<.8?'r':'l';c.yieldT=0;}
   const dLine=nx.dd-STOP-c.L/2,st=sigS[c.o===0?0:1];c.inBox=st===0&&nx.dd<BOX+c.L/2+5;
   if(st!==0&&dLine>-1.2){
    if(st===2||c.v*c.v/(2*5)<dLine+.4){const vs=Math.sqrt(2*4*Math.max(0,dLine-.3));if(vs<lim){lim=vs;why='feu';}}}
   if(c.plan!=='s'){
    /* ralentit avant de tourner */
    const vt=c.plan==='r'?5.2:6,dEnt=nx.dd-BOX;
    if(dEnt<45){const vs=Math.sqrt(vt*vt+2*2.4*Math.max(0,dEnt-c.L/2));if(vs<lim) lim=vs;}
    if(c.plan==='l'&&dEnt>-1&&c.yieldT<7&&leftConflict(c,nx)){c.yieldT+=dt;const vs=Math.sqrt(2*4*Math.max(0,dEnt-c.L/2-.6));if(vs<lim){lim=vs;why='priorite';}}}
   /* dépassement du joueur arrêté sur la voie */
   if(why==='joueur-voiture'&&c.v<.5&&c.blockT>6&&!c.byp&&nx.dd>40&&leftClear(c)){c.byp=true;}
  }
  if(c.byp){c.lot=-LANE+.2;if(pcar){const f=(pcar.x-c.x)*h[0]+(pcar.z-c.z)*h[1];if(f<-6||(nx&&nx.dd<26)||Math.abs(pcar.speed)>3){c.byp=false;c.lot=LANE;}}else{c.byp=false;c.lot=LANE;}}
  c.lo+=clamp(c.lot-c.lo,-2.4*dt,2.4*dt);
 }else{lim=Math.min(lim,c.plan==='r'?5.2:6);}
 if(c.hold>0) lim=0;
 /* vitesse */
 const vprev=c.v;
 if(c.v<lim) c.v=Math.min(lim,c.v+2.6*dt);else c.v=Math.max(lim,c.v-8.5*dt);
 if(c.v<.05) c.v=0;
 c.brake=(vprev-c.v)/Math.max(dt,.001)>.7||(c.v<.3&&lim<.5);
 /* blocage prolongé : klaxon, puis on laisse passer les voitures bloquées entre elles */
 if(c.v<.3&&lim<.5&&why!=='feu'&&why!==''&&why!=='priorite'){c.blockT+=dt;
  if(c.blockT>3&&(why==='joueur-voiture'||why==='joueur'||why==='pieton')){c.hornT-=dt;if(c.hornT<=0){c.hornT=5;honk(c.x,c.z);}}
  if(c.blockT>9&&why==='voiture'&&c.ghost<=0&&c.inBox) c.ghost=4;}
 else if(c.v>1.5||why==='feu'){c.blockT=Math.max(0,c.blockT-dt*2);}
 if(c.ghost>0) c.ghost-=dt;
 c.why=why;
 if(c.blockT>25&&why==='pieton'&&ob.who&&ob.who[6]) offPed(ob.who[6]);
 if(c.blockT>70&&why!=='joueur-voiture'&&why!=='joueur'){offCar(c);return;}
 /* avance */
 if(c.state==='road'){
  c.s+=c.dir*c.v*dt;roadPos(c);
  const nx2=nextCross(c);
  if(c.plan!=='s'&&nx2&&nx2.k===c.planK&&nx2.dd<=BOX&&Math.abs(c.lo-LANE)<.35){startTurn(c,nx2);}
 }else{
  c.tt+=c.v*dt/c.tl;
  const t=Math.min(1,c.tt),q=bez(c,t),b=c.bz,u=1-t;
  c.x=q[0];c.z=q[1];
  const tx=2*u*(b[2]-b[0])+2*t*(b[4]-b[2]),tz=2*u*(b[3]-b[1])+2*t*(b[5]-b[3]);c.ry=Math.atan2(tx,tz);
  if(c.tt>=1){c.state='road';c.o=c.no;c.ax=c.nax;c.dir=c.ndir;c.s=c.ns;c.lo=LANE;c.lot=LANE;c.plan=null;c.planK=-1;roadPos(c);}}
 c.roll+=c.v*dt/c.wr;}
const leftClear=c=>{for(const o of cars) if(o.on&&o!==c&&o.o===c.o&&o.ax===c.ax&&o.dir===-c.dir){const d=c.dir*(o.s-c.s);if(d>-8&&d<45) return false;}return true;};

function writeCar(c){
 if(!c.on) return;
 const im=carM.body[c.model.id],yaw=c.ry,ca=Math.cos(yaw),sa=Math.sin(yaw);
 setM(im.instanceMatrix.array,c.i,c.x,0,c.z,yaw,0,1,1,1);
 const hw=c.W/2-.13,hl=c.model.WB/2,wy=c.wr,wsc=c.wr/.3,roll=c.roll%(PI*2);
 let j=0;for(const sx of [-1,1]) for(const sz of [-1,1]){const ox=sx*hw,oz=sz*hl;
  setM(carM.wheels.instanceMatrix.array,c.i*4+j,c.x+ca*ox+sa*oz,wy,c.z-sa*ox+ca*oz,yaw,roll,wsc,wsc,wsc);j++;}
 const lh=c.lightY,L2=c.L/2;
 const place=(k,ox,oy,oz,sxx,syy)=>setM(carM.lights.instanceMatrix.array,c.i*4+k,c.x+ca*ox+sa*oz,oy,c.z-sa*ox+ca*oz,yaw,0,sxx,syy,.07);
 place(0,-c.W*.34,lh,L2+.015,.3,.13);place(1,c.W*.34,lh,L2+.015,.3,.13);place(2,-c.W*.36,lh+.06,-L2-.015,.28,.12);place(3,c.W*.36,lh+.06,-L2-.015,.28,.12);
 if(night>.04) setM(carM.glow.instanceMatrix.array,c.i,c.x+sa*(L2+3.9),.085,c.z+ca*(L2+3.9),yaw,0,3.8,1,8.2);
 else zeroM(carM.glow.instanceMatrix.array,c.i);
 /* feux arrière : plus vifs au freinage */
 const st=(c.brake?2:0)|(night>.3?1:0);
 if(st!==c.lc){c.lc=st;
  const tail=c.brake?[1,.1,.06]:night>.3?[.55,.04,.03]:[.42,.05,.04];
  tmpC.setRGB(tail[0],tail[1],tail[2]);carM.lights.setColorAt(c.i*4+2,tmpC);carM.lights.setColorAt(c.i*4+3,tmpC);
  carM.lights.instanceColor.needsUpdate=true;}
 /* collider mobile */
 const ex=(Math.abs(sa)*c.L+Math.abs(ca)*c.W)/2,ez=(Math.abs(ca)*c.L+Math.abs(sa)*c.W)/2,w=c.wall;
 w[0]=c.x-ex;w[1]=c.z-ez;w[2]=c.x+ex;w[3]=c.z+ez;}
function headColors(){
 const lit=night>.3;tmpC.setHex(lit?0xfff2c0:0xc4c8c6).convertSRGBToLinear();
 for(const c of cars){carM.lights.setColorAt(c.i*4,tmpC);carM.lights.setColorAt(c.i*4+1,tmpC);c.lc=-1;}
 carM.lights.instanceColor.needsUpdate=true;}

/* ═══════════ Boucle ═══════════ */
let hitT=-9,acc=0,reconT=0;
function reconcile(){
 let np=0,nc=0;for(const p of peds) if(p.on) np++;for(const c of cars) if(c.on) nc++;
 let budget=6;
 if(np<wantP) for(const p of peds){if(budget<=0||np>=wantP) break;if(!p.on&&spawnPed(p,false)){np++;budget--;}}
 else if(np>wantP) for(const p of peds){if(np<=wantP) break;if(p.on&&(!visible(p.x,p.z,.45)||Math.hypot(p.x-player.x,p.z-player.z)>40)){offPed(p);np--;}}
 budget=3;
 if(nc<wantC) for(const c of cars){if(budget<=0||nc>=wantC) break;if(!c.on&&spawnCar(c,false)){nc++;budget--;}}
 else if(nc>wantC) for(const c of cars){if(nc<=wantC) break;if(c.on&&!c.keep&&(!visible(c.x,c.z,.45)||Math.hypot(c.x-player.x,c.z-player.z)>60)){offCar(c);nc--;}}}
/* Choc avec la voiture du joueur : l'impulsion est répartie selon les deux masses (js/40p, MWPHYS.chocVoiture) ;
   la voiture de la rue, si elle est plus légère, est davantage repoussée (déplacement ≈ variation de vitesse × 0,12 s, au plus 1 m). */
let vitesseAvant=0;
function repousserVoiture(c){
 const etat=MWPHYS.state(pcar.x,pcar.z,pcar.ry);
 etat.u=Math.sign(pcar.speed||vitesseAvant)*Math.max(Math.abs(pcar.speed),Math.abs(vitesseAvant));
 const ca=Math.sin(c.ry),cb=Math.cos(c.ry);
 const res=MWPHYS.chocVoiture(etat,MW.carSpec(),{x:c.x,z:c.z,vx:ca*c.v,vz:cb*c.v,m:c.model.mass});
 if(!res) return;
 const dx=clamp(res.dvx*.12,-1,1),dz=clamp(res.dvz*.12,-1,1);
 c.x+=dx;c.z+=dz;}
function hitCheck(){
 if(!pcar) return;
 const ca=Math.sin(pcar.ry),cb=Math.cos(pcar.ry);
 for(const c of cars) if(c.on){
  if(Math.abs(c.x-pcar.x)>5||Math.abs(c.z-pcar.z)>5) continue;
  let hit=false;
  const rayon=(pcar.W||1.8)/2,e=Math.max(0,(pcar.L||4)/2-rayon);
  for(const o of [-e,0,e]){
   const px=pcar.x+ca*o,pz=pcar.z+cb*o,w=c.wall,cx=clamp(px,w[0],w[2]),cz=clamp(pz,w[1],w[3]);
   if(Math.hypot(px-cx,pz-cz)<rayon+.05) hit=true;}
  if(hit){
   repousserVoiture(c);
   c.hold=Math.max(c.hold,2.5);c.v=0;
   if(Math.abs(pcar.speed)>1.2&&tNow-hitT>8){hitT=tNow;honk(c.x,c.z,true);try{MW.toast('Vous avez heurté une voiture : le conducteur klaxonne.','warn');}catch(e){}}
   else if(tNow-hitT>2.5) honk(c.x,c.z);}}}
function onTick(dt){
 if(!MW.isOpen()||MW.paused||!MW.S) return;
 dt=Math.min(dt,.05);
 try{
  init();
  tNow+=dt;sigClock+=dt;
  vitesseAvant=pcar?pcar.speed:0;
  player=MW.player();pcar=MW.playerCar();
  MW.cam.getWorldDirection(camDir);camDir.y=0;if(camDir.lengthSq()>1e-6) camDir.normalize();camPos.copy(MW.cam.position);
  hour=MW.hourF();night=nightF(hour);
  if(MW.walls&&MW.walls.length!==wallsN) rebuildGrid();
  readSig();
  reconT-=dt;
  if(reconT<=0){reconT=.35;targets();reconcile();
   const nn=night>.3?1:0;if(nn!==lightsN){lightsN=nn;headColors();}
   carM.glow.visible=night>.04;carM.glow.material.opacity=Math.min(.75,night*.8);}
  buildCircles();
  for(const p of peds) if(p.on){updPed(p,dt);writePed(p);}
  for(const c of cars) if(c.on){updCar(c,dt);if(c.on) writeCar(c);}
  hitCheck();
  for(const k in pedM) pedM[k].instanceMatrix.needsUpdate=true;
  for(const id in carM.body) carM.body[id].instanceMatrix.needsUpdate=true;
  carM.wheels.instanceMatrix.needsUpdate=true;carM.lights.instanceMatrix.needsUpdate=true;carM.glow.instanceMatrix.needsUpdate=true;
 }catch(e){console.error('Vie de la ville : '+(e&&e.stack?e.stack:e));}}
MW.on('tick',onTick);
MW.on('start',()=>{if(!inited) return;for(const p of peds) if(p.on) offPed(p);for(const c of cars) if(c.on) offCar(c);reconT=0;});

/* ═══════════ Poignée de test ═══════════ */
const api={
 init,peds,cars,nodes,edges,
 stats(){let np=0,nc=0,mp=0,mc=0;for(const p of peds) if(p.on){np++;if(p.v>.2) mp++;}for(const c of cars) if(c.on){nc++;if(c.v>.3) mc++;}
  return {peds:np,cars:nc,pedsMoving:mp,carsMoving:mc,wantP,wantC,calls:MW.renderer()?MW.renderer().info.render.calls:0};},
 /* pose une voiture précise (tests) : o 0 = rue est-ouest, ax = indice de la rue, dir = ±1, s = position le long de la rue */
 forceCar(o,ax,dir,s,v){init();const c=cars.find(q=>!q.on);if(!c) return null;setupCar(c);c.o=o;c.ax=ax;c.dir=dir;c.s=s;c.plan='s';const nx=nextCross(c);if(nx){c.planK=nx.k;c.planC=nx.c;}roadPos(c);c.v=v||0;c.on=true;c.keep=true;c.vmax=12;c.byp=false;return c;}, /* keep : la régulation du nombre de voitures ne la retire pas */
 /* pose un piéton sur le tronçon le plus proche du point (tests) */
 forcePed(x,z){init();const p=peds.find(q=>!q.on);if(!p) return null;let best=null,bd=1e9;
  for(const e of edges){const A=nodes[e.a],t=clamp((x-A.x)*e.ux+(z-A.z)*e.uz,0,e.len),d=Math.hypot(A.x+e.ux*t-x,A.z+e.uz*t-z);if(d<bd){bd=d;best={e,t};}}
  dressPed(p);placePed(p,best.e,best.t);p.on=true;p.state='walk';p.pair=null;p.v=p.spd;return p;},
 clear(){init();for(const p of peds) if(p.on) offPed(p);for(const c of cars) if(c.on) offCar(c);},
 setWant(p,c){forced=p==null?null:[p,c];reconT=0;},
 /* avance la simulation de n secondes sans dessiner (tests : l'ordinateur de test est très lent) */
 step(n){const k=Math.ceil(n/.05);stepping=true;try{for(let i=0;i<k;i++) onTick(.05);}finally{stepping=false;}},
 sig:()=>sigS.slice(),
 density:h=>[interp(PD,h),interp(CD,h)],
 dump:()=>({g:!!G,tl:!!tlA})};
api.fleet=()=>fleet.map(m=>({id:m.id,L:m.L,W:m.W,H:m.H,arch:m.arch}));   /* modèles de la circulation (test) */
window.__mwvie=api;
return api;
})();
