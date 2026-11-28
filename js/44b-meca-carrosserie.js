'use strict';
/* ───────────── Mode « Mécanicien » — CARROSSERIES LISSES ET GALBÉES ─────────────
   Construit l'extérieur de chaque voiture du catalogue (js/44) : coque, habitacle, vitres, capot, feux, calandre, rétroviseurs,
   poignées, passages de roue… Chaque caisse est un « loft » : une suite de tranches (sections transversales arrondies) balayées de
   l'avant à l'arrière, avec des normales lissées. Une seule géométrie par modèle, partagée par toutes les voitures de ce modèle.
   Aucun logo ni nom de marque : seulement des formes.

   ═══ COMMENT AJOUTER OU RETOUCHER UN MODÈLE ═══
   1. La fiche de la voiture (js/44, tableau RAW) donne les cotes officielles : L, W, H, empattement, pneus, type de caisse `body`.
   2. Le type de caisse choisit un gabarit dans `FAMILLES` (positions du pare-brise, du toit, de la lunette, hauteurs du capot…).
      Toutes les positions sont des fractions : `uc`, `uf`, `ur`, `ub` = distance depuis l'avant ÷ longueur ; `hn`, `hb`, `hd`, `rb`
      = hauteur ÷ H (nez, ceinture de caisse, coffre, arrière du toit).
   3. Pour qu'un modèle ressemble à sa vraie silhouette, ajouter une ligne dans `MODELES` avec seulement ce qui change
      (`{uc:.28, uf:.47, face:'sharp', queue:'griffes'}`). Les clés inconnues sont ignorées.
         visage : 'std' | 'pointu' | 'rond' | 'sport' | 'suv' | 'utilitaire' | 'prestige' | 'ferme'  (phares et calandre de face)
         queue  : 'barre' | 'verticale' | 'griffes' | 'trois' | 'rond' | 'enveloppe'                    (feux arrière)
         nF, nR : arrondi du plan à l'avant et à l'arrière (2 = ellipse, 3,5 = presque carré)
         cintre : rétrécissement du flanc vers le toit ; pli : rainure le long du flanc ; ailes : élargissement des ailes
   4. Les tests (tests/scenarios/43-meca-formes.js et 46-meca-lissage.js) vérifient dimensions officielles, lissage et pièces qui se traversent.

   ═══ API `MWBODY` ═══
     MWBODY.build(car, base)   renvoie tout l'extérieur d'une voiture : listes de géométries par matière (paint, dark, trim, chrome,
                               glass, head, tail, amber), le capot (hoodTop, hoodUnder), les fonctions de profil (top, roofY, sideX…)
                               et les repères (doorZ, plaques, feux…). `base` vient de buildGeo (js/44).
     MWBODY.tools              outils de géométrie partagés avec js/44 : tf, bxg, cyg, cyx, cyz, merge, loft, curveFn, sstep, V3
     MWBODY.forme(car)         paramètres de silhouette d'un modèle (gabarit + retouches)
     MWBODY.stats()            {sections, triangles} du dernier modèle construit (pour les tests de lissage) */
const MWBODY=(()=>{
const T=THREE,PI=Math.PI,TAU=PI*2;

/* ═══════════ 1. Outils de géométrie ═══════════ */
const V3=(x,y,z)=>new T.Vector3(x,y,z);
const sstep=(a,b,x)=>{
 const t=clamp((x-a)/(b-a),0,1);
 return t*t*(3-2*t);
};

/* applique une translation puis une rotation (ordre YXZ) à une géométrie */
function tf(g,x,y,z,rx,ry,rz){
 const m=new T.Matrix4();
 m.compose(V3(x||0,y||0,z||0),new T.Quaternion().setFromEuler(new T.Euler(rx||0,ry||0,rz||0,'YXZ')),V3(1,1,1));
 g.applyMatrix4(m);
 return g;
}
const bxg=(w,h,d,x,y,z,rx,ry,rz)=>tf(new T.BoxGeometry(w,h,d),x,y,z,rx,ry,rz);
const cyg=(r1,r2,h,seg,x,y,z,rx,ry,rz)=>tf(new T.CylinderGeometry(r1,r2,h,seg||12),x,y,z,rx,ry,rz);
const cyx=(r,h,seg,x,y,z)=>cyg(r,r,h,seg,x,y,z,0,0,PI/2);   /* cylindre d'axe x */
const cyz=(r,h,seg,x,y,z)=>cyg(r,r,h,seg,x,y,z,PI/2,0,0);   /* cylindre d'axe z */

/* ellipsoïde (rétroviseur, bosse, projecteur) : rayons rx, ry, rz, centré en (x,y,z), tourné de `yaw` autour de y */
function ellipsoide(rx,ry,rz,x,y,z,yaw,seg){
 const g=new T.SphereGeometry(1,seg||12,Math.max(6,Math.round((seg||12)*.7)));
 g.scale(rx,ry,rz);
 return tf(g,x,y,z,0,yaw||0,0);
}

/* fusionne des géométries (avec ou sans index) en une seule */
function merge(list){
 const pos=[],nor=[],idx=[];
 let off=0;
 for(const g of list){
  if(!g) continue;
  const p=g.attributes.position.array;
  const n=g.attributes.normal?g.attributes.normal.array:null;
  const cnt=g.attributes.position.count;
  for(let i=0;i<p.length;i++) pos.push(p[i]);
  if(n) for(let i=0;i<n.length;i++) nor.push(n[i]);
  else for(let i=0;i<p.length;i++) nor.push(0);
  if(g.index){
   const a=g.index.array;
   for(let i=0;i<a.length;i++) idx.push(a[i]+off);
  }else{
   for(let i=0;i<cnt;i++) idx.push(off+i);
  }
  off+=cnt;
  g.dispose();
 }
 const o=new T.BufferGeometry();
 o.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 o.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
 o.setIndex(new T.BufferAttribute(off>65000?new Uint32Array(idx):new Uint16Array(idx),1));
 return o;
}

/* surface lissée : anneaux de points (x,y) successifs le long de z. `closed` : l'anneau se referme (sinon « U » ouvert) */
function loft(rings){
 const K=rings[0].pts.length,pos=[],idx=[];
 for(const r of rings) for(const p of r.pts) pos.push(p[0],p[1],r.z);
 for(let i=0;i<rings.length-1;i++){
  const a=i*K,b=(i+1)*K,ferme=rings[i].closed&&rings[i+1].closed;
  for(let j=0;j<K-(ferme?0:1);j++){
   const j2=(j+1)%K;
   idx.push(a+j,b+j,a+j2,b+j,b+j2,a+j2);
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setIndex(idx);
 g.computeVertexNormals();
 return g;
}

/* courbe y(z) lissée (Catmull-Rom centripète) échantillonnée finement ; pts = [[z,y],…] */
function curveFn(pts){
 const c=new T.CatmullRomCurve3(pts.map(p=>V3(p[0],p[1],0)),false,'centripetal');
 const sm=c.getPoints(240);
 sm.sort((a,b)=>a.x-b.x);
 return z=>{
  if(z<=sm[0].x) return sm[0].y;
  const n=sm.length;
  if(z>=sm[n-1].x) return sm[n-1].y;
  let lo=0,hi=n-1;
  while(hi-lo>1){
   const m=(lo+hi)>>1;
   if(sm[m].x<=z) lo=m;
   else hi=m;
  }
  const a=sm[lo],b=sm[hi];
  return a.y+(b.y-a.y)*(z-a.x)/Math.max(1e-9,b.x-a.x);
 };
}

/* courbe lisse passant par des points clés [[x,y],…] : renvoie `n` points par tronçon (Catmull-Rom centripète) */
function lisser(cles,n){
 const c=new T.CatmullRomCurve3(cles.map(p=>V3(p[0],p[1],0)),false,'centripetal');
 const out=[];
 const segs=cles.length-1;
 for(let i=0;i<=segs*n;i++){
  const p=c.getPoint(i/(segs*n));
  out.push([p.x,p.y]);
 }
 return out;
}

/* surface paramétrée (nu × nv carreaux) : fn(s,t) → [x,y,z] ; `vers` = direction vers laquelle les normales doivent regarder */
function nappe(nu,nv,fn,vers){
 const pos=[],idx=[];
 for(let i=0;i<=nu;i++){
  for(let j=0;j<=nv;j++){
   const p=fn(i/nu,j/nv);
   pos.push(p[0],p[1],p[2]);
  }
 }
 for(let i=0;i<nu;i++){
  for(let j=0;j<nv;j++){
   const a=i*(nv+1)+j,b=(i+1)*(nv+1)+j;
   idx.push(a,b,a+1,b,b+1,a+1);
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setIndex(idx);
 g.computeVertexNormals();
 if(vers) orienter(g,vers);
 return g;
}

/* retourne une surface dont la somme des normales regarde à l'opposé de `vers` */
function orienter(g,vers){
 const n=g.attributes.normal.array;
 let s=0;
 for(let i=0;i<n.length;i+=3) s+=n[i]*vers[0]+n[i+1]*vers[1]+n[i+2]*vers[2];
 if(s>=0) return;
 const a=g.index.array;
 for(let i=0;i<a.length;i+=3){
  const t=a[i+1];
  a[i+1]=a[i+2];
  a[i+2]=t;
 }
 g.computeVertexNormals();
}

/* tube de section polygonale suivant une ligne brisée de points V3 (joints de portes, baguettes, arceaux) */
function tube(pts,rayon,cotes,vers){
 const pos=[],idx=[],K=cotes||4,N=pts.length;
 const haut=V3(0,1,0),cote=V3(1,0,0);
 for(let i=0;i<N;i++){
  const a=pts[Math.max(0,i-1)],b=pts[Math.min(N-1,i+1)];
  const t=b.clone().sub(a).normalize();
  let u=new T.Vector3().crossVectors(t,Math.abs(t.y)>.9?cote:haut).normalize();
  const v=new T.Vector3().crossVectors(t,u).normalize();
  if(vers&&u.dot(V3(vers[0],vers[1],vers[2]))<0) u=u.negate();
  for(let k=0;k<K;k++){
   const an=k/K*TAU,c=Math.cos(an)*rayon,s=Math.sin(an)*rayon;
   pos.push(pts[i].x+u.x*c+v.x*s,pts[i].y+u.y*c+v.y*s,pts[i].z+u.z*c+v.z*s);
  }
 }
 for(let i=0;i<N-1;i++){
  for(let k=0;k<K;k++){
   const k2=(k+1)%K,a=i*K+k,b=(i+1)*K+k,c=(i+1)*K+k2,d=i*K+k2;
   idx.push(a,b,d,b,c,d);
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setIndex(idx);
 g.computeVertexNormals();
 return g;
}

const outils={tf,bxg,cyg,cyx,cyz,merge,loft,curveFn,sstep,V3,ellipsoide,nappe,tube,lisser};

/* ═══════════ 2. Silhouettes : gabarits par type de caisse, retouches par modèle ═══════════ */
/* positions : fractions de la longueur depuis l'avant (uc bas du pare-brise, uf avant du toit, ur arrière du toit, ub bas de la lunette)
   hauteurs : fractions de H (hn nez, hb ceinture, hd coffre, rb arrière du toit, fb bombé du pare-brise)
   autres : pill montants de porte, cp prolongement de la vitre latérale, roofW largeur du toit ÷ ceinture, lidR longueur du capot arrière */
const DEFAUT={
 uc:.275,uf:.465,ur:.745,ub:.955,hn:.53,hb:.645,hd:.665,rb:.35,fb:.46,pill:[.50],cp:.04,roofW:.80,
 nF:2.8,nR:2.8,eF:.30,eR:.30,cintre:.05,pli:.011,ailes:.012,taille:.012,bombe:.010,
 visage:'std',queue:'barre',
};
const FAMILLES={
 hatch:{},
 mini:{uc:.27,uf:.44,ur:.80,ub:.975,hn:.52,hb:.63,hd:.645,rb:.45,fb:.42,pill:[],cp:.05,roofW:.82,nF:2.2,nR:2.3,visage:'rond'},
 sedan:{uc:.39,uf:.55,ur:.715,ub:.82,hn:.53,hb:.645,hd:.68,rb:.35,fb:.46,pill:[.52],cp:.20,roofW:.78,eR:.30},
 wagon:{uc:.33,uf:.50,ur:.875,ub:.975,hn:.54,hb:.65,hd:.66,rb:.7,fb:.46,pill:[.52,.75],cp:.04,roofW:.80},
 suv:{uc:.30,uf:.47,ur:.855,ub:.975,hn:.62,hb:.69,hd:.70,rb:.6,fb:.46,pill:[.50,.73],cp:.04,roofW:.80,visage:'suv',cintre:.04},
 van:{uc:.20,uf:.37,ur:.93,ub:.995,hn:.50,hb:.575,hd:.60,rb:.9,fb:.42,pill:[.50],cp:.03,roofW:.84,visage:'utilitaire',queue:'verticale',
  nF:3,nR:3.4,cintre:.03},
 coupe:{uc:.30,uf:.50,ur:.76,ub:.95,hn:.47,hb:.615,hd:.615,rb:.3,fb:.46,pill:[],cp:.12,roofW:.76,visage:'sport'},
 mid:{uc:.32,uf:.50,ur:.63,ub:.72,hn:.47,hb:.60,hd:.575,rb:.4,fb:.46,pill:[],cp:.12,roofW:.76,lidR:.945,visage:'sport',queue:'enveloppe',
  cintre:.08,ailes:.02},
 rear:{uc:.33,uf:.52,ur:.62,ub:.80,hn:.53,hb:.60,hd:.585,rb:.3,fb:.46,pill:[],cp:.12,roofW:.78,lidR:.935,visage:'rond',queue:'rond',
  cintre:.07,ailes:.02},
};
/* retouches par voiture, d'après les profils réels */
const MODELES={
 clio4:{visage:'std',queue:'enveloppe'},
 clio5:{visage:'pointu',queue:'enveloppe'},
 p208:{visage:'pointu',queue:'griffes',uc:.28,uf:.46},
 p308:{visage:'pointu',queue:'griffes'},
 c3:{visage:'rond',queue:'barre',hb:.66,roofW:.84},
 sandero:{visage:'std',queue:'barre'},
 megane3:{visage:'std',queue:'enveloppe'},
 golf7:{visage:'std',queue:'barre',uf:.47},
 yaris3:{uc:.265,uf:.45,ur:.76,visage:'rond'},
 fiesta7:{visage:'std',queue:'barre'},
 corsa6:{visage:'pointu',queue:'barre'},
 kangoo2:{uc:.20,uf:.37},
 partner2:{uc:.21,uf:.375},
 fiat500:{uc:.265,uf:.43,ur:.80,ub:.975,visage:'rond',queue:'rond'},
 p206:{uc:.26,uf:.45,ur:.75,ub:.95,visage:'std',queue:'enveloppe'},
 captur2:{uc:.285,uf:.46,ur:.84,visage:'suv',queue:'enveloppe'},
 p3008:{uc:.31,uf:.50,ur:.85,visage:'suv',queue:'griffes'},
 duster2:{uc:.30,uf:.47,ur:.855,queue:'barre'},
 tiguan2:{uc:.31,uf:.485,ur:.855,queue:'barre'},
 xc60:{uc:.34,uf:.51,ur:.845,visage:'prestige',queue:'verticale'},
 focus4:{visage:'pointu',queue:'barre'},
 octavia4:{uc:.335,uf:.505,ur:.88,ub:.975,visage:'std'},
 zoe:{visage:'ferme',queue:'barre'},
 berlingo3:{uc:.22,uf:.38},
 bmw320d:{visage:'prestige',queue:'barre'},
 c220d:{uc:.395,uf:.55,ur:.71,ub:.815,visage:'prestige',queue:'barre'},
 a4b9:{visage:'prestige',queue:'barre'},
 mustang:{uc:.43,uf:.60,ur:.72,ub:.87,hn:.50,hb:.66,hd:.67,visage:'sport',queue:'trois',nF:3.2},
 a6c8:{uc:.40,uf:.56,ur:.73,ub:.83,visage:'prestige'},
 m3g80:{uc:.39,uf:.545,ur:.715,ub:.82,visage:'sport'},
 gryaris:{uc:.29,uf:.48,ur:.72,ub:.94,visage:'sport'},
 meganers:{uc:.30,uf:.50,ur:.76,ub:.945,visage:'sport'},
 golfgti:{uc:.28,uf:.47,ur:.74,visage:'sport'},
 rs3:{uc:.285,uf:.48,ur:.745,visage:'sport'},
 huracan:{uc:.32,uf:.52,ur:.60,ub:.68,visage:'sport'},
 a110:{uc:.31,uf:.49,ur:.64,ub:.72,visage:'rond',queue:'enveloppe'},
 cayman:{uc:.32,uf:.50,ur:.64,ub:.74,visage:'rond'},
 p911:{uc:.325,uf:.52,ur:.63,ub:.81,visage:'rond',queue:'enveloppe'},
};
function forme(car){
 return Object.assign({},DEFAUT,FAMILLES[car.body]||FAMILLES.hatch,MODELES[car.id]||{},car.sh||{});
}

/* ═══════════ 3. Mise en place : profil, plan, bas de caisse ═══════════ */
/* Renvoie l'objet S (état de la construction) : cotes, positions clés et fonctions de profil partagées par tous les éléments. */
function mise_en_place(car,base){
 const sh=forme(car);
 const S=Object.assign({car,sh},base);
 const {L,H,zf,zr,gc}=S;
 S.hn=sh.hn*H;
 S.hb=sh.hb*H;
 S.hd=sh.hd*H;
 S.uz=u=>zf-u*L;
 S.zc=S.uz(sh.uc);
 S.zRf=S.uz(sh.uf);
 S.zRr=S.uz(sh.ur);
 S.zrb=S.uz(sh.ub);
 S.wheels=[[S.afz,S.tF],[S.arz,S.tR]];
 S.rearLid=car.loc!=='front';
 S.archR=t=>t.rt+.045;
 S.guard=t=>2*t.rt+.115;
 profil_central(S);
 plan_et_dessous(S);
 return S;
}

/* ligne médiane : capot, ceinture, coffre */
function profil_central(S){
 const {sh,hn,hb,hd,L,zf}=S;
 S.top=z=>{
  const u=(zf-z)/L;
  if(u<sh.uc){
   const t=clamp((sh.uc-u)/(sh.uc-.03),0,1);
   return hb-(hb-hn)*Math.pow(t,1.25);
  }
  if(u<sh.ub) return hb;
  const t=clamp((u-sh.ub)/(1-sh.ub),0,1);
  return lerp(hb,hd,sstep(0,.3,t))-.05*sstep(.7,1,t);
 };
 /* hauteur minimale de l'aile au droit d'une roue : elle doit recouvrir le pneu */
 S.gdz=z=>{
  let g=0;
  for(const [z0,t] of S.wheels){
   const dz=Math.abs(z-z0),R=S.archR(t);
   g=Math.max(g,S.guard(t)*(1-sstep(R*.85,R+.26,dz)));
  }
  return g;
 };
}

/* plan (largeur selon la position), dessous (garde au sol, passages de roue), arrondi des extrémités */
function plan_et_dessous(S){
 const {sh,hw,zf,zr,gc}=S;
 const bosse=z=>{
  let b=0;
  for(const [z0,t] of S.wheels) b=Math.max(b,1-sstep(0,S.archR(t)+.55,Math.abs(z-z0)));
  return b;
 };
 S.bosseRoue=bosse;
 S.yfl=z=>{
  const d=Math.min(zf-z,z-zr);
  return gc+(d<.85?.2*Math.pow(1-d/.85,2):0);
 };
 S.yb=z=>{
  let y=S.yfl(z);
  for(const [z0,t] of S.wheels){
   const dz=Math.abs(z-z0),R=S.archR(t);
   if(dz<R) y=Math.max(y,t.rt+Math.sqrt(R*R-dz*dz)*.97);
  }
  return y;
 };
 /* arrondi des extrémités : wf = largeur relative, vf = hauteur relative (superellipses de plan et de profil) */
 S.endF=z=>{
  const dF=zf-z,dR=z-zr,front=dF<dR,d=front?dF:dR;
  const E=front?sh.eF:sh.eR,n=front?sh.nF:sh.nR,EV=.10;
  let wf=1,vf=1;
  if(d<E) wf=Math.pow(1-Math.pow(1-d/E,n),1/n);
  if(d<EV) vf=Math.pow(1-Math.pow(1-d/EV,2.4),1/2.4);
  return {wf,vf,d};
 };
 /* demi-largeur de la caisse : élargie aux ailes, plus étroite entre les roues */
 S.halfW=z=>S.hw*S.endF(z).wf*(1-sh.taille*(1-bosse(z)));
}

/* ═══════════ 4. Section transversale ═══════════ */
/* demi-section (x ≥ 0) de la caisse à l'abscisse z, du centre du fond au centre du dessus, points lissés */
function demi_section(S,z){
 const {sh}=S;
 const {wf,vf}=S.endF(z);
 const wfc=Math.max(wf,.07),vfc=Math.max(vf,.07);
 const w=(S.hw-.012)*wfc*(1-sh.taille*(1-S.bosseRoue(z)));
 const yB=S.yb(z),ytc=S.top(z);
 const ytf=Math.max(ytc,Math.min(ytc+.3,S.gdz(z)));
 const yS=ytf-.006;
 const h=Math.max(.1,yS-yB);
 const ym=(yB+ytc)/2;
 const tuck=.12,cin=sh.cintre,pli=sh.pli;
 const cles=[
  [.5*w,yB],
  [w*(1-tuck)-.01,yB+.002],
  [w*(1-tuck*.55),yB+.03*Math.min(1,h/.4)],
  [w*(1-tuck*.12),yB+.12*h],
  [w,yB+.38*h],
  [w-pli*1.6,yB+.58*h],
  [w-pli*.3,yB+.78*h],
  [w*(1-cin*.7),yB+.94*h],
  [w*(1-cin),yS],
  [w*(.9-cin),yS+.4*(ytc-yS)+.004],
  [.62*w,ytc],
 ];
 /* un seul tronçon de plus pour le dessus entre le bord de l'aile et le capot */
 const pts=lisser(cles,2);
 const sx=wf/wfc,sy=vf/vfc;
 return pts.map(p=>[p[0]*sx,ym+(p[1]-ym)*sy]);
}

/* anneau complet (gauche → droite) pour le loft ; `ouvert` : le dessus (capot) est laissé libre */
function anneau(S,z,ouvert){
 const r=demi_section(S,z);
 const pts=[];
 for(let i=r.length-1;i>=0;i--) pts.push([-r[i][0],r[i][1]]);
 for(let i=0;i<r.length;i++) pts.push(r[i]);
 return {z,pts,closed:!ouvert};
}

/* ═══════════ 5. Coque ═══════════ */
function zone_capot(S){
 const {zf,zr,L,sh}=S;
 S.lidLo=S.rearLid?zr+L*(1-(sh.lidR||.93)):S.zc;
 S.lidHi=S.rearLid?S.zrb-.02:zf-.13;
}

/* abscisses des tranches de la coque : régulières (plus serrées aux extrémités) + autour des passages de roue et du capot */
function tranches(S){
 const {L,zr,zf}=S;
 const zset=new Set(),N=Math.round(L*18);
 for(let i=0;i<=N;i++) zset.add(+(zr+L*(.5-.5*Math.cos(PI*i/N))).toFixed(4));
 for(const [z0,t] of S.wheels){
  const R=S.archR(t);
  for(const s of [-1,1]) for(const e of [-.004,0,.004,.03,.06]) zset.add(+(z0+s*(R+e)).toFixed(4));
 }
 for(const e of [-.003,0,.003]){
  zset.add(+(S.lidLo+e).toFixed(4));
  zset.add(+(S.lidHi+e).toFixed(4));
 }
 return [...zset].filter(z=>z>=zr&&z<=zf).sort((a,b)=>a-b);
}

function coque(S){
 zone_capot(S);
 S.zs=tranches(S);
 S.nTranches=S.zs.length;
 const rings=S.zs.map(z=>anneau(S,z,z>=S.lidLo-.0005&&z<=S.lidHi+.0005));
 return loft(rings);
}

/* abscisse x de la surface latérale à la hauteur y (côté +x), pour poser joints et poignées sur la tôle */
function x_flanc(S,z,y){
 const r=demi_section(S,z);
 let best=0;
 for(let i=0;i<r.length-1;i++){
  const a=r[i],b=r[i+1];
  if((y>=a[1]&&y<=b[1])||(y<=a[1]&&y>=b[1])){
   const t=(y-a[1])/(b[1]-a[1]||1);
   return a[0]+(b[0]-a[0])*t;
  }
  best=Math.max(best,a[0]);
 }
 return best;
}

/* ═══════════ 6. Capot (ou capot arrière) ═══════════ */
/* panneau bombé dont le bord rejoint la coque : coordonnées locales à la charnière (z − lidLo, y − pivY) */
function capot(S){
 const {sh,hw}=S;
 const hLen=S.lidHi-S.lidLo,pivY=S.top(S.lidLo);
 const ks=[-1,-.78,-.5,-.25,0,.25,.5,.78,1];
 const forme_k=(z,dy,largeur)=>{
  const {wf}=S.endF(z),w=.62*S.hw*wf*largeur,y0=S.top(z)+dy-pivY;
  return {z:z-S.lidLo,closed:false,pts:ks.map(k=>[k*w,y0+.005+sh.bombe*(1-k*k)-.012*Math.pow(Math.abs(k),4)])};
 };
 const lz=[];
 for(let i=0;i<=16;i++) lz.push(S.lidLo+hLen*(i/16));
 const dessus=lz.map(z=>forme_k(z,0,1));
 const dernier=forme_k(S.lidHi,0,1);
 dessus.push({z:dernier.z+.002,closed:false,pts:dernier.pts.map(p=>[p[0]*.985,p[1]-.05])});
 const dessous=lz.map(z=>forme_k(z,-.035,.9));
 S.hLen=hLen;
 S.pivY=pivY;
 return {hoodTop:loft(dessus),hoodUnder:loft(dessous)};
}

/* ═══════════ 7. Habitacle (toit, montants) ═══════════ */
/* ligne de toit y(z) et fonction de largeur de l'habitacle ; le toit s'élargit puis se resserre (cintre) selon sa hauteur */
function ligne_de_toit(S){
 const {sh,H,hw}=S;
 const pts=[
  [S.zrb,S.top(S.zrb)],
  [lerp(S.zrb,S.zRr,.25),lerp(S.top(S.zrb),H,sh.rb)],
  [S.zRr,H-.03],
  [lerp(S.zRr,S.zRf,.5),H],
  [S.zRf,H-.012],
  [lerp(S.zRf,S.zc,.55),lerp(H-.012,S.top(S.zc),.4+sh.fb*.2)],
  [S.zc,S.top(S.zc)],
 ];
 S.roofY=curveFn(pts);
 S.rayon_toit=.06;
 S.gz=z=>{
  const {wf}=S.endF(z);
  const y0=S.top(z)-.015;
  const yR=Math.max(S.roofY(z),S.top(z));
  const wg=.9*hw*wf;
  const h=yR-y0;
  const wt=wg*lerp(1,sh.roofW,sstep(0,.3,h));
  const cc=Math.min(S.rayon_toit,Math.max(.002,h)*.35);
  return {y0,yR,wg,wt,h,cc,sag:Math.min(.032,h*.4)};
 };
 /* hauteur du dessus du toit à la distance x de l'axe : légèrement bombé en travers */
 S.toitY=(g,x)=>g.yR-g.sag*Math.pow(x/Math.max(.1,g.wt),2);
}

/* x de la paroi latérale de l'habitacle à la hauteur y (flanc convexe) */
function x_habitacle(S,g,y){
 const t=clamp((y-g.y0)/Math.max(1e-4,g.yR-g.cc-g.y0),0,1);
 return g.wg+(g.wt-g.wg)*t+.012*Math.sin(PI*t);
}

/* anneau fermé de l'habitacle (flanc, arrondi d'arête, dessus bombé) */
function anneau_habitacle(S,z){
 const g=S.gz(z),demi=[];
 const hflanc=Math.max(.002,g.yR-g.cc-g.y0);
 for(let k=0;k<=4;k++){
  const y=g.y0+hflanc*k/4;
  demi.push([x_habitacle(S,g,y),y]);
 }
 const xc=g.wt-g.cc;
 for(let k=1;k<=4;k++){
  const a=k/4*PI/2;
  const x=xc+g.cc*Math.cos(a);
  demi.push([x,S.toitY(g,Math.min(x,g.wt))-g.cc*(1-Math.sin(a))]);
 }
 for(let k=1;k<=3;k++){
  const x=xc*(1-k/3);
  demi.push([x,S.toitY(g,x)]);
 }
 const pts=[];
 for(let i=demi.length-1;i>=0;i--) pts.push([-demi[i][0],demi[i][1]]);
 for(let i=0;i<demi.length;i++) pts.push(demi[i]);
 return {z,pts,closed:true};
}

function habitacle(S){
 ligne_de_toit(S);
 const rings=[],N=60;
 for(let i=0;i<=N;i++) rings.push(anneau_habitacle(S,S.zrb+(S.zc-S.zrb)*(.5-.5*Math.cos(PI*i/N))));
 return loft(rings);
}

/* ═══════════ 8. Vitres : pare-brise, lunette, vitres latérales, joints noirs ═══════════ */
/* bande de verre bombée suivant le toit : de za (bas) à zb (haut), largeur 2·a(z), décalée de `ecart` au-dessus de la tôle */
function verre_axial(S,za,zb,ecart,marge){
 const n=14,m=8;
 return nappe(n,m,(s,t)=>{
  const z=za+(zb-za)*s,g=S.gz(z);
  const reduc=sstep(0,.25,g.h);
  const a=Math.max(.08,lerp(g.wg-.07,g.wt-.055,reduc)+marge);
  const x=a*(2*t-1);
  const pente=(S.roofY(z+.01)-S.roofY(z-.01))/.02,k=Math.sqrt(1+pente*pente);   /* décalage mesuré selon la normale du toit */
  return [x,S.toitY(g,Math.min(Math.abs(x),g.wt))+(ecart+.0045)*k,z];
 },[0,1,0]);
}

/* vitre latérale (grille régulière suivant la courbure de l'habitacle) ; `marge` agrandit pour faire le joint noir */
function verre_lateral(S,za,zb,sg,ecart,marge){
 const nz=Math.max(4,Math.round((za-zb)/.05)),ny=5;
 return nappe(nz,ny,(s,t)=>{
  const z=za+(zb-za)*s,g=S.gz(z);
  const yb=S.ybw-marge,yt=Math.min(S.winTop(z)+marge,S.roofY(z)-.02+marge*.3);
  const y=yb+(yt-yb)*t;
  const zz=z+(s<.5?marge:-marge)*0;
  return [sg*(x_habitacle(S,g,y)+ecart),y,zz];
 },[sg,0,0]);
}

function vitres(S,sortie){
 const {sh,car,hb}=S;
 S.ybw=hb+.028;
 S.winTop=z=>Math.max(S.roofY(z)-.062,S.ybw+.03);
 S.sideX=(z,y)=>x_habitacle(S,S.gz(z),y)+.0135;
 let zS=S.zc;
 while(zS>S.zRf&&S.roofY(zS)<S.ybw+.15) zS-=.01;
 zS-=.04;
 let zE=S.zrb;
 while(zE<S.zRr&&S.roofY(zE)<S.ybw+.15) zE+=.01;
 zE+=sh.cp;
 S.zS=zS;
 S.zE=zE;
 sortie.glass.push(verre_axial(S,S.zc-.03,S.zRf+.025,.0105,0));
 sortie.glass.push(verre_axial(S,S.zRr-.025,S.zrb+.03,.0105,0));
 sortie.dark.push(verre_axial(S,S.zc-.012,S.zRf+.04,.0035,.02));
 sortie.dark.push(verre_axial(S,S.zRr-.04,S.zrb+.012,.0035,.02));
 const pill=car.doors<=3?[]:sh.pill,bz=pill.map(u=>S.uz(u)),pw=.11,segs=[];
 let cur=zS;
 for(const b of bz){
  segs.push([cur,b+pw/2]);
  cur=b-pw/2;
 }
 segs.push([cur,zE]);
 S.pilierZ=bz;
 for(const sg of [-1,1]){
  sortie.dark.push(verre_lateral(S,zS+.02,zE-.015,sg,.0085,.014));
  for(const s of segs){
   if(s[0]-s[1]>.12) sortie.glass.push(verre_lateral(S,s[0],s[1],sg,.0135,0));
  }
 }
}

/* ═══════════ 8b. Mesures pour les tests : lissage des normales, enfoncement des pièces ═══════════ */
/* angle moyen (degrés) entre les normales de deux sommets reliés par une arête, sur la coque et l'habitacle ; + nombre de tranches */
function lissage(S){
 let somme=0,n=0,pire=0;
 for(const g of [coque(S),habitacle(S)]){
  const nor=g.attributes.normal.array,ix=g.index.array,vu=new Set();
  for(let i=0;i<ix.length;i+=3){
   for(let k=0;k<3;k++){
    const a=ix[i+k],b=ix[i+(k+1)%3],cle=a<b?a*1e6+b:b*1e6+a;
    if(vu.has(cle)) continue;
    vu.add(cle);
    const d=nor[3*a]*nor[3*b]+nor[3*a+1]*nor[3*b+1]+nor[3*a+2]*nor[3*b+2];
    const ang=Math.acos(clamp(d,-1,1))*180/PI;
    if(!isFinite(ang)) continue;
    somme+=ang;
    n++;
    pire=Math.max(pire,ang);
   }
  }
  g.dispose();
 }
 return {moyenne:somme/Math.max(1,n),pire,tranches:S.nTranches};
}

/* profondeur (m) dont le point (x,y,z) s'enfonce dans la coque ou dans l'habitacle ; 0 s'il est dehors.
   Le capot (zone ouverte au-dessus de ±62 % de la demi-largeur) n'est pas compté : on y voit le moteur. */
function profondeur(S,x,y,z){
 const xa=Math.abs(x);
 let pr=0;
 if(z<S.zf&&z>S.zr){
  const demi=demi_section(S,z),row={demi,bas:demi[0][1],haut:demi[demi.length-1][1]};
  const m=marge_section(row,xa,y);
  const sousCapot=z>=S.lidLo&&z<=S.lidHi&&xa<.62*S.halfW(z)&&y>S.top(z)-.1;
  if(m>0&&!sousCapot) pr=m;
 }
 if(y>S.hb&&z<S.zc&&z>S.zrb){
  const g=S.gz(z),dehors=x_habitacle(S,g,y);
  if(y<S.toitY(g,Math.min(xa,g.wt))-.001&&xa<g.wt-g.cc&&y>g.y0+.01) pr=Math.max(pr,S.toitY(g,Math.min(xa,g.wt))-y);
  else if(y>g.y0+.02&&y<g.yR-g.cc&&xa<dehors) pr=Math.max(pr,dehors-xa);
 }
 return pr;
}

/* ═══════════ 9. Surface de la coque aux extrémités : où poser feux, calandre, plaque ═══════════ */
/* table de sections espacées de 4 mm depuis le bout de la voiture (avant ou arrière) : sert à projeter un point (x,y) sur la face */
function table_bout(S,front){
 const cle=front?'_tabAv':'_tabAr';
 if(S[cle]) return S[cle];
 const E=(front?S.sh.eF:S.sh.eR)+.06,pas=.004,tab=[];
 for(let d=0;d<=E;d+=pas){
  const z=front?S.zf-d:S.zr+d;
  const demi=demi_section(S,z);
  tab.push({d,demi,bas:demi[0][1],haut:demi[demi.length-1][1]});
 }
 S[cle]=tab;
 return tab;
}

/* marge (m) d'un point (xa,y) à l'intérieur de la section : positive = le point est dans la tôle */
function marge_section(row,xa,y){
 if(y<row.bas||y>row.haut) return Math.min(y-row.bas,row.haut-y);
 const r=row.demi;
 let x=0;
 for(let i=0;i<r.length-1;i++){
  const a=r[i],b=r[i+1];
  if((y>=a[1]&&y<=b[1])||(y<=a[1]&&y>=b[1])){
   x=a[0]+(b[0]-a[0])*(y-a[1])/((b[1]-a[1])||1);
   break;
  }
 }
 return Math.min(x-xa,y-row.bas,row.haut-y);
}

/* z de la surface (face avant ou arrière) au point (xa = |x|, y) : première section qui contient ce point */
function z_bout(S,front,xa,y){
 const tab=table_bout(S,front);
 let lo=0,hi=tab.length-1;
 if(marge_section(tab[hi],xa,y)<0) return front?S.zf-tab[hi].d:S.zr+tab[hi].d;
 while(hi-lo>1){
  const m=(lo+hi)>>1;
  if(marge_section(tab[m],xa,y)>=0) hi=m;
  else lo=m;
 }
 const a=marge_section(tab[lo],xa,y),b=marge_section(tab[hi],xa,y);
 const t=b-a>1e-9?clamp(-a/(b-a),0,1):1;
 const d=lerp(tab[lo].d,tab[hi].d,t);
 return front?S.zf-d:S.zr+d;
}

/* hauteur de la tôle à la distance xa de l'axe (partie haute de la section) */
function haut_a(row,xa){
 const r=row.demi;
 for(let i=r.length-1;i>0;i--){
  if(r[i-1][0]>=xa&&r[i][0]<=xa){
   const t=(xa-r[i][0])/((r[i-1][0]-r[i][0])||1);
   return r[i][1]+(r[i-1][1]-r[i][1])*t;
  }
 }
 return row.haut;
}

/* ramène (xa,y) à l'intérieur de la section pleine (loin du bout), pour qu'un feu ne déborde jamais de la caisse */
function dans_la_tole(S,front,xa,y){
 const tab=table_bout(S,front),row=tab[tab.length-1];
 let xmax=0;
 const r=row.demi;
 for(let i=0;i<r.length;i++) xmax=Math.max(xmax,r[i][0]);
 const yc=clamp(y,row.bas+.01,haut_a(row,Math.min(xa,xmax))-.012);
 let x=0;
 for(let i=0;i<r.length-1;i++){
  const a=r[i],b=r[i+1];
  if((yc>=a[1]&&yc<=b[1])||(yc<=a[1]&&yc>=b[1])){
   x=a[0]+(b[0]-a[0])*(yc-a[1])/((b[1]-a[1])||1);
   break;
  }
 }
 return [Math.min(xa,Math.max(0.02,x-.012)),yc];
}

/* plaque en relief posée sur la face : fn(s,t) → [x,y] ; `relief` = hauteur (m) au-dessus de la tôle, mesurée selon la normale de la tôle
   (sinon, sur les coins arrondis, la plaque serait presque dans le plan de la tôle) ; renvoie une géométrie */
function applique(S,front,fn,nu,nv,relief){
 const dir=front?1:-1;
 return nappe(nu,nv,(s,t)=>{
  const p=fn(s,t),sg=p[0]<0?-1:1;
  const q=dans_la_tole(S,front,Math.abs(p[0]),p[1]);
  const xa=q[0],y=q[1],z=z_bout(S,front,xa,y);
  const e=.02,xl=Math.max(0,xa-e);
  const zx=sg*(z_bout(S,front,xa+e,y)-z_bout(S,front,xl,y))/(xa+e-xl);
  const zy=(z_bout(S,front,xa,y+e)-z_bout(S,front,xa,y-e))/(2*e);
  const nx=front?-zx:zx,ny=front?-zy:zy,nz=dir,n=Math.hypot(nx,ny,nz);
  return [sg*xa+nx/n*relief,y+ny/n*relief,z+nz/n*relief];
 },[0,0,dir]);
}

/* quadrilatère de coins c = [[x,y] × 4] (haut-intérieur, haut-extérieur, bas-extérieur, bas-intérieur), interpolation bilinéaire */
function quad(c){
 return (s,t)=>{
  const hx=lerp(c[0][0],c[1][0],s),hy=lerp(c[0][1],c[1][1],s);
  const bx=lerp(c[3][0],c[2][0],s),by=lerp(c[3][1],c[2][1],s);
  return [lerp(hx,bx,t),lerp(hy,by,t)];
 };
}
const disque=(cx,cy,r)=>(s,t)=>[cx+r*s*Math.cos(t*TAU),cy+r*s*Math.sin(t*TAU)];
/* même quadrilatère, agrandi de m (mètres) tout autour : pour les cerclages sombres */
function elargi(c,m){
 const cx=(c[0][0]+c[1][0]+c[2][0]+c[3][0])/4,cy=(c[0][1]+c[1][1]+c[2][1]+c[3][1])/4;
 return c.map(p=>[p[0]+Math.sign(p[0]-cx)*m,p[1]+Math.sign(p[1]-cy)*m]);
}

/* ═══════════ 10. Visage : phares, calandre, prises d'air ═══════════ */
/* visages : lampe = {xi,xo (fractions de la demi-largeur), h (m), pente (m : le coin extérieur est plus bas), rond (rayon)},
   calandre = {w (fraction de hw), h (m), bas (m sous le phare), cadre (chrome), barres}, prise = {w, h}, drl = 'ligne' | 'c' | 'trois' */
const VISAGES={
 std:{lampe:{xi:.34,xo:.90,h:.115,pente:.03},calandre:{w:.46,h:.07,bas:.07,cadre:false,barres:3},prise:{w:.80,h:.11},drl:'ligne'},
 pointu:{lampe:{xi:.38,xo:.95,h:.085,pente:.055},calandre:{w:.40,h:.06,bas:.06,cadre:false,barres:2},prise:{w:.74,h:.10},drl:'c'},
 rond:{lampe:{xi:.44,xo:.82,h:.11,pente:0,rond:.075},calandre:{w:.36,h:.065,bas:.08,cadre:false,barres:0},prise:{w:.62,h:.09},drl:'ligne'},
 sport:{lampe:{xi:.40,xo:.94,h:.08,pente:.045},calandre:{w:.60,h:.065,bas:.06,cadre:false,barres:3},prise:{w:.96,h:.15},drl:'trois'},
 suv:{lampe:{xi:.44,xo:.92,h:.095,pente:.02},calandre:{w:.62,h:.11,bas:.04,cadre:true,barres:3},prise:{w:.70,h:.10},drl:'c'},
 utilitaire:{lampe:{xi:.40,xo:.94,h:.15,pente:.0},calandre:{w:.50,h:.09,bas:.09,cadre:false,barres:2},prise:{w:.78,h:.10},drl:'ligne'},
 prestige:{lampe:{xi:.46,xo:.93,h:.075,pente:.04},calandre:{w:.52,h:.11,bas:.02,cadre:true,barres:5},prise:{w:.90,h:.12},drl:'ligne'},
 ferme:{lampe:{xi:.40,xo:.94,h:.09,pente:.04},calandre:{w:.30,h:.05,bas:.07,cadre:false,barres:0},prise:{w:.60,h:.08},drl:'ligne'},
};

/* niveaux de relief au-dessus de la tôle (m) : deux pièces de matières différentes sont toujours séparées d'au moins 8 mm,
   sinon leurs faces seraient quasi confondues (scintillement et « faces superposées ») */
const NIV={fond:.008,bord:.016,verre:.024,saillie:.032};

function lampe_avant(S,o,v,yh,sg){
 const hw=S.hw,L=v.lampe;
 const xi=sg*hw*L.xi,xo=sg*hw*L.xo;
 const c=[[xi,yh],[xo,yh-L.pente*.4],[xo,yh-L.h-L.pente],[xi,yh-L.h]];
 if(L.rond){
  const cx=sg*hw*(L.xi+L.xo)/2,cy=yh-L.h*.5;
  o.dark.push(applique(S,true,disque(cx,cy,L.rond*1.22),2,20,NIV.fond));
  o.chrome.push(applique(S,true,disque(cx,cy,L.rond*1.08),2,20,NIV.bord));
  o.glass.push(applique(S,true,disque(cx,cy,L.rond),3,20,NIV.verre));
  o.head.push(applique(S,true,disque(cx,cy,L.rond*.42),2,14,NIV.saillie));
  return c;
 }
 o.dark.push(applique(S,true,quad(elargi(c,.012)),5,5,NIV.fond));
 o.chrome.push(applique(S,true,quad(c),6,3,NIV.bord));
 o.glass.push(applique(S,true,quad(c),8,4,NIV.verre));
 const pr=[[xi+sg*.03,yh-.035],[xi+sg*.1,yh-.035],[xi+sg*.1,yh-L.h*.6],[xi+sg*.03,yh-L.h*.6]];
 o.head.push(applique(S,true,quad(pr),2,2,NIV.saillie));
 return c;
}

function feux_de_jour(S,o,v,c,sg){
 const a=c[0],b=c[1],d=c[3],e=c[2];
 if(v.drl==='ligne'){
  const bas=[[d[0],d[1]-.012],[e[0],e[1]-.012],[e[0],e[1]-.026],[d[0],d[1]-.026]];
  o.head.push(applique(S,true,quad(bas),8,2,NIV.verre));
 }else if(v.drl==='c'){
  const q=[[a[0],a[1]+.004],[b[0],b[1]+.004],[b[0],b[1]-.012],[a[0],a[1]-.012]];
  o.head.push(applique(S,true,quad(q),8,2,NIV.saillie));
 }else{
  for(let k=0;k<3;k++){
   const x0=lerp(a[0],b[0],.15+k*.28),x1=lerp(a[0],b[0],.15+k*.28+.2);
   const y=a[1]-.02-k*.002;
   o.head.push(applique(S,true,quad([[x0,y],[x1,y],[x1,y-.03],[x0,y-.03]]),3,2,NIV.saillie));
  }
 }
 const ia=[[sg*S.hw*.88,c[2][1]+.05],[sg*S.hw*.97,c[2][1]+.055],[sg*S.hw*.97,c[2][1]+.012],[sg*S.hw*.88,c[2][1]+.012]];
 o.amber.push(applique(S,true,quad(ia),4,2,NIV.bord));
}

function calandre(S,o,v,yh){
 const g=v.calandre,hw=S.hw;
 if(g.w<=0) return;
 const yt=yh-v.lampe.h-g.bas+.02,yb=yt-g.h;
 const w=hw*g.w;
 o.dark.push(applique(S,true,quad([[-w,yt],[w,yt],[w*.94,yb],[-w*.94,yb]]),12,3,NIV.fond));
 for(let k=0;k<g.barres;k++){
  const y=yt-(k+.5)*g.h/g.barres;
  o.trim.push(applique(S,true,quad([[-w*.96,y+.004],[w*.96,y+.004],[w*.96,y-.004],[-w*.96,y-.004]]),12,1,NIV.bord));
 }
 if(g.cadre){
  o.chrome.push(applique(S,true,quad([[-w-.01,yt+.012],[w+.01,yt+.012],[w+.01,yt+.002],[-w-.01,yt+.002]]),12,1,NIV.verre));
  o.chrome.push(applique(S,true,quad([[-w*.95-.01,yb-.002],[w*.95+.01,yb-.002],[w*.95+.01,yb-.012],[-w*.95-.01,yb-.012]]),12,1,NIV.verre));
 }
 S.calandreBas=yb;
}

function prise_d_air(S,o,v){
 const p=v.prise,hw=S.hw,y0=S.gc+.15,y1=y0+p.h;
 const w=hw*p.w;
 o.dark.push(applique(S,true,quad([[-w,y1],[w,y1],[w*.9,y0],[-w*.9,y0]]),14,3,NIV.fond));
 for(const sg of [-1,1]){
  const cx=sg*hw*.8;
  o.dark.push(applique(S,true,disque(cx,y0+p.h*.5,.045),2,14,NIV.fond));
  o.head.push(applique(S,true,disque(cx,y0+p.h*.5,.028),2,12,NIV.bord));
 }
 o.trim.push(applique(S,true,quad([[-hw*.9,y0-.02],[hw*.9,y0-.02],[hw*.9,y0-.055],[-hw*.9,y0-.055]]),16,1,NIV.bord));
}

function visage(S,o){
 const v=VISAGES[S.sh.visage]||VISAGES.std;
 const yh=Math.max(S.gc+.46,S.hn-.07);
 S.yPhare=yh;
 const cotes=[1,-1].map(sg=>lampe_avant(S,o,v,yh,sg));
 [1,-1].forEach((sg,i)=>feux_de_jour(S,o,v,cotes[i],sg));
 calandre(S,o,v,yh);
 prise_d_air(S,o,v);
 const c=cotes[0];
 S.headPos=[(c[0][0]+c[1][0])/2*.8,yh-v.lampe.h*.5,z_bout(S,true,Math.abs(c[0][0]),yh-v.lampe.h*.5)+NIV.verre];
}

/* ═══════════ 11. Arrière : feux, plaque, bouclier, échappement ═══════════ */
function colonnes_de_feu(S,o,sg,n,xi,xo,yt,h,pente,ecart){
 for(let k=0;k<n;k++){
  const a=lerp(xi,xo,k/n+(k?ecart:0)),b=lerp(xi,xo,(k+1)/n-(k<n-1?ecart:0));
  const c=[[sg*a,yt],[sg*b,yt-pente*(k+1)/n],[sg*b,yt-h-pente*(k+1)/n],[sg*a,yt-h]];
  o.tail.push(applique(S,false,quad(c),3,3,NIV.bord));
 }
}

function feux_arriere(S,o){
 const hw=S.hw,q=S.sh.queue;
 const ty=Math.min(S.top(S.zr+.01)-.07,S.hd-.07);
 S.yFeu=ty;
 for(const sg of [-1,1]){
  if(q==='verticale'){
   const c=[[sg*hw*.84,ty+.06],[sg*hw*.97,ty+.06],[sg*hw*.97,ty-.38],[sg*hw*.84,ty-.38]];
   o.dark.push(applique(S,false,quad(elargi(c,.012)),3,4,NIV.fond));
   o.tail.push(applique(S,false,quad(c),4,6,NIV.bord));
  }else if(q==='rond'){
   const cx=sg*hw*.72,cy=ty-.02;
   o.dark.push(applique(S,false,disque(cx,cy,.082),2,18,NIV.fond));
   o.tail.push(applique(S,false,disque(cx,cy,.07),3,18,NIV.bord));
   o.amber.push(applique(S,false,disque(cx,cy-.09,.03),2,12,NIV.bord));
  }else if(q==='trois'){
   const c=[[sg*hw*.5,ty+.05],[sg*hw*.92,ty+.05],[sg*hw*.92,ty-.1],[sg*hw*.5,ty-.1]];
   o.dark.push(applique(S,false,quad(elargi(c,.012)),4,3,NIV.fond));
   colonnes_de_feu(S,o,sg,3,hw*.5,hw*.92,ty+.05,.15,0,.06);
  }else if(q==='griffes'){
   const c=[[sg*hw*.48,ty+.04],[sg*hw*.95,ty+.05],[sg*hw*.95,ty-.1],[sg*hw*.48,ty-.08]];
   o.dark.push(applique(S,false,quad(elargi(c,.012)),4,3,NIV.fond));
   colonnes_de_feu(S,o,sg,3,hw*.5,hw*.94,ty+.04,.11,-.015,.07);
  }else{
   const haut=q==='enveloppe'?.06:.04,c=[[sg*hw*.5,ty+.04],[sg*hw*.95,ty+haut],[sg*hw*.95,ty-.07],[sg*hw*.5,ty-.07]];
   o.dark.push(applique(S,false,quad(elargi(c,.012)),5,3,NIV.fond));
   o.tail.push(applique(S,false,quad(c),8,3,NIV.bord));
  }
  const yr=S.gc+.3;
  o.head.push(applique(S,false,quad([[sg*hw*.55,yr+.03],[sg*hw*.7,yr+.03],[sg*hw*.7,yr],[sg*hw*.55,yr]]),3,2,NIV.bord));
  o.amber.push(applique(S,false,quad([[sg*hw*.85,yr+.04],[sg*hw*.95,yr+.04],[sg*hw*.95,yr+.005],[sg*hw*.85,yr+.005]]),3,2,NIV.bord));
 }
 S.tailPos=[hw*.68,ty,z_bout(S,false,hw*.68,ty)-.02];
 const base=S.gc+.22;
 o.dark.push(applique(S,false,quad([[-hw*.9,base+.03],[hw*.9,base+.03],[hw*.84,base-.06],[-hw*.84,base-.06]]),14,2,NIV.fond));
 o.trim.push(applique(S,false,quad([[-hw*.88,base-.07],[hw*.88,base-.07],[hw*.88,base-.1],[-hw*.88,base-.1]]),14,1,NIV.bord));
}

/* sortie d'échappement : embout chromé visible sous le pare-chocs (sportives et premium) */
function echappement(S,o){
 const {car,hw}=S;
 S.exX=hw*.42;
 const double=car.cat==='sport'||car.cat==='prem';
 const xs=double?[-S.exX,S.exX]:[S.exX];
 for(const x of xs){
  const y=S.yfl(S.zr+.04)-.05;
  o.chrome.push(cyz(.04,.07,14,x,y,S.zr+.005));
  o.dark.push(cyz(.03,.08,12,x,y,S.zr+.006));
 }
}

/* plaques d'immatriculation : emplacement sur la face, avec leur cadre sombre */
function plaques(S,o){
 const {gc,hw}=S;
 const pyF=Math.max(gc+.3,(S.yb(S.zf-.15)+S.top(S.zf-.15))/2-.04);
 const pyR=(S.top(S.zr+.12)+S.yb(S.zr+.12))/2+.03;
 S.plateF={x:0,y:pyF,z:z_bout(S,true,.26,pyF)+NIV.fond};
 S.plateR={x:0,y:pyR,z:z_bout(S,false,.26,pyR)-NIV.fond};
 o.dark.push(applique(S,true,quad([[-.29,pyF+.07],[.29,pyF+.07],[.29,pyF-.07],[-.29,pyF-.07]]),4,2,NIV.fond/2));
 o.dark.push(applique(S,false,quad([[-.29,pyR+.07],[.29,pyR+.07],[.29,pyR-.07],[-.29,pyR-.07]]),4,2,NIV.fond/2));
}

/* ═══════════ 12. Flancs : portes, poignées, rétroviseurs, bas de caisse, ailes ═══════════ */
function reperes_de_portes(S){
 const {car,gc,hb}=S;
 S.sill=gc+.26;
 S.doorTop=hb-.02;
 S.dz0=S.afz-S.archR(S.tF)-.1;
 const bz=S.pilierZ;
 S.dRear=car.doors>3?(bz.length?bz[0]:S.zc-S.L*.34):Math.max(S.zrb+.3,S.dz0-1.15);
 S.coupes=[S.dz0,S.dRear];
 for(const b of bz) S.coupes.push(b);
 if(car.doors>3) S.coupes.push(S.arz+S.archR(S.tR)+.12);
 S.poignees=[];
 if(car.doors<=3||!bz.length) S.poignees.push(S.zc-.78);
 else S.poignees.push(bz[0]+.2,bz[0]-.1);
}

/* point 3D de la tôle du côté sg à (z,y), décalé de `dx` vers l'extérieur */
const surface_flanc=(S,sg,z,y,dx)=>V3(sg*(x_flanc(S,z,y)+(dx||0)),y,z);

function joints_de_portes(S,o){
 for(const z of S.coupes){
  for(const sg of [-1,1]){
   const pts=[];
   for(let k=0;k<=6;k++) pts.push(surface_flanc(S,sg,z,S.sill+(S.doorTop-S.sill)*k/6,.0065));
   o.dark.push(tube(pts,.0028,3,[sg,0,0]));
  }
 }
 for(const sg of [-1,1]){
  const pts=[];
  for(let k=0;k<=10;k++) pts.push(surface_flanc(S,sg,lerp(S.dz0,S.dRear,k/10),S.sill,.0065));
  o.dark.push(tube(pts,.0028,3,[sg,0,0]));
 }
}

function poignees(S,o){
 const y=S.hb-.09,chic=S.car.cat==='prem'||S.car.cat==='sport';
 for(const z of S.poignees){
  for(const sg of [-1,1]){
   const x=x_flanc(S,z,y);
   o.dark.push(ellipsoide(.006,.03,.1,sg*(x+.0005),y,z,0,10));
   (chic?o.chrome:o.trim).push(cyz(.0085,.13,8,sg*(x+.0065),y,z));
  }
 }
 S.handleZ=S.poignees[0];
}

function retroviseurs(S,o){
 const {hw,hb}=S,mz=S.zc-.03,my=hb+.1;
 for(const sg of [-1,1]){
  const gx=S.gz(mz).wg*.97,mx=sg*(hw+.1);
  o.paint.push(ellipsoide(.048,.043,.092,mx,my,mz-.02,0,14));
  o.dark.push(ellipsoide(.006,.036,.072,mx-sg*.004,my,mz-.03,0,10));
  o.trim.push(tube([V3(sg*gx,hb-.005,mz+.01),V3(sg*(hw+.03),hb+.045,mz+.02),V3(mx,my-.03,mz+.02)],.011,5));
  o.amber.push(ellipsoide(.004,.016,.012,sg*(hw+.008),hb-.14,S.afz+S.archR(S.tF)+.12,0,8));
 }
}

function bas_de_caisse(S,o){
 const za=S.dz0+.05,zb=S.dRear-.05,y0=S.gc+.05,y1=S.gc+.115;
 for(const sg of [-1,1]){
  const g=nappe(14,3,(s,t)=>{
   const z=lerp(za,zb,s),y=lerp(y0,y1,t);
   return [sg*(x_flanc(S,z,y)+.004),y,z];
  },[sg,0,0]);
  o.trim.push(g);
 }
 const hautPlastique=S.car.body==='suv'||S.car.body==='van';
 S.jupeHaute=hautPlastique;
}

/* ourlet d'aile autour de chaque passage de roue : peint, ou noir sur les SUV et utilitaires */
function ourlets_de_roue(S,o){
 const noir=S.car.body==='suv'||S.car.body==='van',cible=noir?o.trim:o.paint;
 for(const [z0,t] of S.wheels){
  const R=S.archR(t);
  for(const sg of [-1,1]){
   const pts=[];
   for(let k=0;k<=24;k++){
    const dz=-R+2*R*k/24,y=t.rt+Math.sqrt(Math.max(0,R*R-dz*dz))*.97;
    pts.push(surface_flanc(S,sg,z0+dz,y-.004,.0015));
   }
   cible.push(tube(pts,noir?.014:.008,6,[sg,0,0]));
  }
 }
}

/* baguette de protection le long des portes (citadines et généralistes) */
function baguette_de_porte(S,o){
 const {car}=S;
 if(car.cat==='sport'||car.cat==='prem') return;
 const y=S.sill+.2;
 for(const sg of [-1,1]){
  const pts=[];
  for(let k=0;k<=12;k++) pts.push(surface_flanc(S,sg,lerp(S.dz0-.05,S.dRear+.05,k/12),y,.0035));
  o.trim.push(tube(pts,.011,5,[sg,0,0]));
 }
}

function trappe_carburant(S,o){
 const {hb,hw}=S;
 const z=Math.max(S.zr+.4,S.arz-S.archR(S.tR)-.2),y=hb-.2;
 const x=-x_flanc(S,z,y);
 S.fuelX=x;
 S.fuelZ=z;
 o.dark.push(cyx(.074,.014,20,x+.001,y,z));
 o.paint.push(cyx(.066,.01,20,x-.017,y,z));
 o.trim.push(bxg(.012,.012,.03,x-.034,y,z-.04));
}

function baguettes(S,o){
 const {car}=S;
 if(car.cat!=='prem'&&car.cat!=='sport') return;
 for(const sg of [-1,1]){
  const pts=[];
  for(let k=0;k<=16;k++){
   const z=lerp(S.zS+.02,S.zE-.02,k/16);
   pts.push(V3(sg*(x_habitacle(S,S.gz(z),S.ybw-.01)+.011),S.ybw-.01,z));
  }
  o.chrome.push(tube(pts,.004,4,[sg,0,0]));
 }
}

/* barres de toit des familiales, SUV et utilitaires */
function barres_de_toit(S,o){
 const {car}=S;
 if(car.body!=='wagon'&&car.body!=='suv') return;
 for(const sg of [-1,1]){
  const pts=[];
  for(let k=0;k<=14;k++){
   const z=lerp(S.zRf-.05,S.zRr+.15,k/14),g=S.gz(z);
   pts.push(V3(sg*g.wt*.82,S.toitY(g,g.wt*.82)+.022,z));
  }
  o.trim.push(tube(pts,.012,5));
 }
}

/* essuie-glaces : bras et balais posés sur le pare-brise ; le balai côté conducteur est amovible */
function essuie_glaces(S,o){
 const wiper=[],bladeD=[];
 const wz=S.zc-.03+(S.zRf+.025-(S.zc-.03))*.1,g=S.gz(wz);
 const th=-Math.atan((S.roofY(wz+.02)-S.roofY(wz-.02))/.04);
 const aw=g.wt*.9,len=aw*.78;
 o.dark.push(bxg(aw*2,.014,.1,0,S.top(S.zc)+.014,S.zc));
 for(const sg of [-1,1]){
  const cx=sg*aw*.5,arr=sg>0?bladeD:wiper,wy=S.toitY(g,Math.abs(cx))+.024;
  arr.push(bxg(len,.012,.022,cx,wy,wz,th,0,0));
  arr.push(bxg(len*.96,.006,.01,cx,wy+.008,wz,th,0,0));
  wiper.push(tube([V3(cx-sg*len*.32,S.top(S.zc)+.016,S.zc+.04),V3(cx,wy+.012,wz)],.008,4));
  S.wiperPos=[aw*.5,wy+.004,wz,th];
 }
 S.wiperTh=th;
 if(S.car.body!=='sedan'&&S.car.body!=='coupe'&&S.car.body!=='mid'&&S.car.body!=='rear'){
  const rz=S.zRr-.025+(S.zrb+.03-(S.zRr-.025))*.35,gr=S.gz(rz);
  const ry=S.toitY(gr,0)+.024,rt=-Math.atan((S.roofY(rz+.02)-S.roofY(rz-.02))/.04);
  wiper.push(bxg(.36,.012,.02,0,ry,rz,rt,0,0));
  wiper.push(tube([V3(0,ry,rz-.03),V3(.1,ry,rz)],.007,4));
 }
 o.wiper=wiper;
 o.bladeD=bladeD;
}

/* ═══════════ 9. Assemblage ═══════════ */
function build(car,base){
 const S=mise_en_place(car,base);
 const o={paint:[],dark:[],trim:[],chrome:[],glass:[],head:[],tail:[],amber:[],wiper:[],bladeD:[]};
 o.paint.push(coque(S));
 o.paint.push(habitacle(S));
 vitres(S,o);
 const c=capot(S);
 reperes_de_portes(S);
 visage(S,o);
 feux_arriere(S,o);
 echappement(S,o);
 plaques(S,o);
 joints_de_portes(S,o);
 poignees(S,o);
 retroviseurs(S,o);
 bas_de_caisse(S,o);
 baguette_de_porte(S,o);
 ourlets_de_roue(S,o);
 trappe_carburant(S,o);
 baguettes(S,o);
 barres_de_toit(S,o);
 essuie_glaces(S,o);
 return Object.assign(o,{S,hoodTop:c.hoodTop,hoodUnder:c.hoodUnder});
}

return {tools:outils,forme,build,lissage,profondeur,DEFAUT,FAMILLES,MODELES,_i:{mise_en_place,coque,capot,x_flanc,demi_section}};
})();
