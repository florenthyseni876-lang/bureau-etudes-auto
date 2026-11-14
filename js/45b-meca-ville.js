'use strict';
/* ───────────── Mode « Mécanicien » — DÉCOR : la ville (rues, bâtiments, arbres, mobilier urbain) ─────────────
   Appelé par MWD.build (45-meca-decor.js). Tout est fusionné par matériau (peu d'appels de dessin). */
MWD.city=(ctx,D)=>{
const T=D.T,PI=D.PI,R=D.rng(4242),{zones,RX,RZ,HALF,addCol,free}=ctx;
const core=m=>D.B('core',m),det=m=>D.B('detail',m);
const rr=(a,b)=>a+R()*(b-a),ri=(a,b)=>Math.floor(rr(a,b+.999)),pick=a=>a[Math.floor(R()*a.length)];
const E=300,SIGNY=.06;
const gaps=(cs,half,lo,hi)=>{const s=[];let a=lo;for(const c of cs){s.push([a,c-half]);a=c+half;}s.push([a,hi]);return s;};
const near=(v,cs,m)=>cs.some(c=>Math.abs(v-c)<m);
const FACES={N:{nx:0,nz:-1},S:{nx:0,nz:1},W:{nx:-1,nz:0},E:{nx:1,nz:0}};
const H={FACES};D.H=H;

/* ═══════ Sol, routes, trottoirs ═══════ */
core('grass').box(1400,.2,1400,0,-.1,0);
const segZ=gaps(RZ,7,-E,E),segX=gaps(RX,7,-E,E),segXs=gaps(RX,10,-E,E);
for(const r of RX) for(const [a,b] of segZ) core('asph').box(14,.05,b-a,r,.025,(a+b)/2);
for(const r of RZ) for(const [a,b] of segX) core('asph').box(b-a,.05,14,(a+b)/2,.025,r);
for(const rx of RX) for(const rz of RZ) core('asph').box(14,.05,14,rx,.025,rz);
for(const r of RX) for(const s of [-1,1]) for(const [a,b] of segZ){core('walk').box(3,.15,b-a,r+s*8.5,.075,(a+b)/2);core('conc').box(.25,.18,b-a,r+s*7.12,.09,(a+b)/2,0xcfccc4);}
for(const r of RZ) for(const s of [-1,1]){for(const [a,b] of segXs) core('walk').box(b-a,.15,3,(a+b)/2,.075,r+s*8.5);for(const [a,b] of segX) core('conc').box(b-a,.18,.25,(a+b)/2,.09,r+s*7.12,0xcfccc4);}

/* ═══════ Marquages ═══════ */
const WH=0xeeede4,YL=0xe6c020,mk=()=>core('mark');
const flat=(w,d,x,z,c,y)=>mk().quad(w,d,x,y||SIGNY,z,0,c,null,-PI/2);
for(const r of RZ){for(const [a,b] of gaps(RX,11.8,-E,E)){flat(b-a,.13,(a+b)/2,r-6.35,WH);flat(b-a,.13,(a+b)/2,r+6.35,WH);for(let t=a+2;t<b-3;t+=9) flat(3,.14,t+1.5,r,WH);}}
for(const r of RX){for(const [a,b] of gaps(RZ,11.8,-E,E)){flat(.13,b-a,r-6.35,(a+b)/2,WH);flat(.13,b-a,r+6.35,(a+b)/2,WH);for(let t=a+2;t<b-3;t+=9) flat(.14,3,r,t+1.5,WH);}}
function arrow(x,z,dx,dz){const px=-dz,pz=dx,P=(a,b)=>[x+dx*a+px*b,SIGNY+.002,z+dz*a+pz*b],up=[0,1,0];
 mk().quadP(P(-1.6,-.14),P(.3,-.14),P(.3,.14),P(-1.6,.14),WH,null,up);mk().tri(P(.3,-.55),P(1.6,0),P(.3,.55),WH,null,up);}
for(const rx of RX) for(const rz of RZ){
 for(const s of [-1,1]){
  // passages piétons : traversée de la route E-O (rayures le long de x) et N-S (rayures le long de z)
  for(let k=-6;k<=6;k++){flat(3,.5,rx+s*8.5,rz+k+.0,WH);flat(.5,3,rx+k,rz+s*8.5,WH);}
  // lignes d'arrêt, flèches
  flat(.45,5.9,rx+s*10.9,rz-s*3.3,WH);flat(5.9,.45,rx+s*3.3,rz+s*10.9,WH);
  arrow(rx+s*20,rz-s*3.3,-s,0);arrow(rx+s*3.3,rz+s*20,0,-s);}
}
// plaques d'égout, rapiéçages
{const rm=D.rng(77),pl=det('plain');
 for(let i=0;i<46;i++){const horiz=i%2===0,r=horiz?RZ[i%3]:RX[i%3],t=rm()*500-250;if(near(t,horiz?RX:RZ,16)) continue;const off=(rm()<.5?-1:1)*(1.8+rm()*3);
  const x=horiz?t:r+off,z=horiz?r+off:t;pl.cyl(.45,.45,.012,14,x,SIGNY+.002,z,0x303234);pl.cyl(.36,.36,.014,14,x,SIGNY+.004,z,0x424446);}
 for(let i=0;i<40;i++){const horiz=i%2===0,r=horiz?RZ[i%3]:RX[i%3],t=rm()*540-270;if(near(t,horiz?RX:RZ,16)) continue;const off=(rm()-.5)*10;
  const g=mk();g.quad(horiz?1.5+rm()*3:1.2+rm()*1.5,horiz?1.2+rm()*1.5:1.5+rm()*3,horiz?t:r+off,SIGNY-.004,horiz?r+off:t,0,0x2c2f33,null,-PI/2);}}

/* ═══════ Mobilier : lampadaires, feux, panneaux ═══════ */
const lampPts=[];
function lamp(x,z,tx,tz){const lay=Math.hypot(x,z)>185?'far':'core',pl=D.B(lay,'plain'),ry=Math.atan2(tx,tz);
 pl.cyl(.1,.13,6.2,6,x,3.2,z,0x3b4349);pl.box(.4,.5,.4,x,.4,z,0x30363b);
 pl.box(.09,.09,1.8,x+tx*.85,6.2,z+tz*.85,0x3b4349,ry);pl.box(.32,.12,.95,x+tx*1.75,6.22,z+tz*1.75,0x50575d,ry);
 D.B(lay,'lamph').box(.26,.04,.78,x+tx*1.75,6.14,z+tz*1.75,0xffffff,ry);
 if(lay==='core') core('glowm').quad(9,9,x+tx*1.8,.17,z+tz*1.8,0,0xffffff,null,-PI/2);lampPts.push([x,z]);}
for(const r of RX) for(const s of [-1,1]) for(let t=-270+(s>0?0:16);t<=275;t+=32){if(near(t,RZ,15)) continue;lamp(r+s*8.7,t,-s,0);}
for(const r of RZ) for(const s of [-1,1]) for(let t=-270+(s>0?0:16);t<=275;t+=32){if(near(t,RX,15)) continue;lamp(t,r+s*8.7,0,-s);}
// feux tricolores
{const A=D.mat('tlA'),B=D.mat('tlB');A.map.repeat.set(.25,1);B.map.repeat.set(.25,1);A.emissiveIntensity=B.emissiveIntensity=1.25;D.registerTL(A,B);
 const pl=core('plain'),ha=D.B('core','tlA'),hb=D.B('core','tlB');
 for(const rx of RX) for(const rz of RZ) for(const sx of [-1,1]) for(const sz of [-1,1]){
  const px=rx+sx*9.35,pz=rz+sz*9.35;pl.cyl(.07,.09,3.5,8,px,1.75,pz,0x2e3338);pl.cyl(.18,.2,.35,8,px,.3,pz,0x2e3338);
  pl.box(.3,.98,.3,px+.3,3.15,pz,0x181a1c);pl.box(.3,.98,.3,px-.3,3.15,pz,0x181a1c);
  ha.quad(.27,.9,px+.3+.16,3.15,pz,PI/2,null);ha.quad(.27,.9,px+.3-.16,3.15,pz,-PI/2,null);hb.quad(.27,.9,px-.3,3.15,pz+.16,0,null);hb.quad(.27,.9,px-.3,3.15,pz-.16,PI,null);}}
// panneaux
{const ts=D.B('core','tsign'),pl=core('plain'),cell=(c,row)=>[c/4,row?0:.5,(c+1)/4,row?.5:1];
 const sign=(x,z,ry,c,row)=>{pl.cyl(.035,.035,2.5,6,x,1.25,z,0x6a7076);ts.quad(.62,.62,x,2.35,z,ry,null,cell(c,row),0,true);};
 let k=0;for(const rx of RX) for(const rz of RZ) for(const sx of [-1,1]) for(const sz of [-1,1]){k++;
  const x=rx+sx*9.7,z=rz+sz*14.5,type=[[1,0],[0,0],[2,0],[3,0],[0,1],[1,1],[2,1],[3,1]][(k*3)%8];
  sign(x,z,0,type[0],type[1]);}
 for(const [x,z,ry] of [[-282,6,PI/2],[282,-6,-PI/2],[6,-282,PI],[-6,282,0]]) sign(x,z,ry,0,0);}
// bornes, bouches d'incendie
{const pl=det('plain');const rm=D.rng(5);for(let i=0;i<14;i++){const rx=RX[i%3],rz=RZ[(i*2+1)%3],sx=rm()<.5?-1:1,sz=rm()<.5?-1:1,x=rx+sx*9.6,z=rz+sz*(12+rm()*6);
  pl.cyl(.11,.13,.7,8,x,.45,z,0xc22a1c);pl.cyl(.14,.14,.1,8,x,.82,z,0xa02015);pl.box(.3,.08,.08,x,.6,z,0xa02015);}
 for(let t=-250;t<250;t+=47){const r=RZ[Math.floor(R()*3)];if(near(t,RX,15)) continue;for(const dx of [0,1.2]) pl.cyl(.09,.09,.85,8,t+dx*3,.55,r+7.7,0x55595e);}}

/* ═══════ Fenêtres, bâtiments ═══════ */
function winRow(cx,cz,nx,nz,off,len,fl,fh,y0,o){
 const ry=Math.atan2(nx,nz),tx=Math.cos(ry),tz=-Math.sin(ry),fx=cx+nx*(off+.025),fz=cz+nz*(off+.025);
 const ww=o.ww||1.15,wh=Math.min(o.wh||1.55,fh-.85),nc=Math.max(1,Math.floor((len-1.4)/(o.sp||3))),sp=len/nc,lay=o.layer||'core';
 const litP=o.litP==null?.5:o.litP;
 for(let i=0;i<nc;i++){const u=-len/2+sp*(i+.5);
  for(let f=0;f<fl;f++){if(o.skip&&o.skip(u,f,i)) continue;
   const yc=y0+f*fh+fh*.55,lit=R()<litP?ri(0,3):-1,x=fx+tx*u,z=fz+tz*u;
   const mat=o.style==='office'?(lit>=0&&lit<2?'officelit':'office'):(lit>=0?'win'+lit:'win');
   D.B(lay,mat).quad(o.style==='office'?sp-.15:ww,o.style==='office'?fh-.35:wh,x,yc,z,ry,null);
   if(o.sill&&o.style!=='office'&&f<3){det('conc').box(ww+.3,.09,.34,x+nx*.12,yc-wh/2-.05,z+nz*.12,0xdcd8d0,ry);
    if(o.lintel) det('conc').box(ww+.2,.12,.2,x+nx*.08,yc+wh/2+.07,z+nz*.08,0xd0ccc4,ry);
    if(o.shut){const c=o.shut;for(const sd of [-1,1]) det('plain').box(.46,wh,.05,x+tx*sd*(ww/2+.27)+nx*.06,yc,z+tz*sd*(ww/2+.27)+nz*.06,c,ry);}}}}}
H.winRow=winRow;
function roofFlat(cx,cz,w,d,Hh,o){const lay=o.layer||'core',B=m=>D.B(lay,m);
 B('roofflat').box(w-.1,.1,d-.1,cx,Hh+.05,cz);
 const pc=o.parapet==null?o.tint:o.parapet,pm=o.wall||'plaster';
 for(const s of [-1,1]){B(pm).box(w+.2,.5,.24,cx,Hh+.25,cz+s*(d/2-.02),pc);B(pm).box(.24,.5,d-.2,cx+s*(w/2-.02),Hh+.25,cz,pc);}
 B('conc').box(w+.34,.07,.4,cx,Hh+.53,cz-d/2+.02,0xd8d4cc);B('conc').box(w+.34,.07,.4,cx,Hh+.53,cz+d/2-.02,0xd8d4cc);
 B('conc').box(.4,.07,d,cx-w/2+.02,Hh+.53,cz,0xd8d4cc);B('conc').box(.4,.07,d,cx+w/2-.02,Hh+.53,cz,0xd8d4cc);
 if(lay!=='far'||o.clutter){const rm=D.rng((cx*13+cz*7)|0);const n=ri(1,3);for(let i=0;i<n;i++){const ux=(rm()-.5)*(w-4),uz=(rm()-.5)*(d-4);
  if(rm()<.5){det('plain').box(1.1,.7,.9,cx+ux,Hh+.45,cz+uz,0xb8bcc0);det('plain').cyl(.3,.3,.1,10,cx+ux,Hh+.83,cz+uz,0x55595e);}
  else{det('plain').box(.9,1.6,.9,cx+ux,Hh+.8,cz+uz,0xa8a49c);det('plain').box(1,.1,1,cx+ux,Hh+1.65,cz+uz,0x70747a);}}
  if(rm()<.4){det('plain').cyl(.03,.03,2.4,5,cx+(rm()-.5)*w*.5,Hh+1.7,cz,0x30343a);}}}
H.roofFlat=roofFlat;
function gable(cx,cz,w,d,Hh,o){const lay=o.layer||'core',B=m=>D.B(lay,m),ridgeX=o.ridgeX!=null?o.ridgeX:w>=d;
 const A=ridgeX?w:d,Bw=ridgeX?d:w,over=.55,rh=o.rh||Math.min(A,Bw)*.3,hb=Bw/2+over,WW=A/2+over,sl=Math.hypot(hb,rh),ts=2,tc=o.roofTint==null?0xffffff:o.roofTint;
 const P=(a,y,b)=>ridgeX?[cx+a,y,cz+b]:[cx+b,y,cz+a];
 const hint=b=>ridgeX?[0,1,b*.6]:[b*.6,1,0],tl=B('tiles');
 for(const s of [-1,1]){
  tl.quadP(P(-WW,Hh-.12,s*hb),P(WW,Hh-.12,s*hb),P(WW,Hh+rh,0),P(-WW,Hh+rh,0),tc,[[-WW/ts,0],[WW/ts,0],[WW/ts,sl/ts],[-WW/ts,sl/ts]],hint(s));}
 // ligne de faîtage et pignons
 const rg=ridgeX?[A+over*2+.1,.16,.3]:[.3,.16,A+over*2+.1];B('conc').box(rg[0],rg[1],rg[2],cx,Hh+rh+.04,cz,0xa0584a);
 const hh=rh*(Bw/2)/hb;
 const uvOf=p=>ridgeX?[p[2]/4,p[1]/4]:[p[0]/4,p[1]/4];
 for(const s of [-1,1]){const a=P(s*A/2,Hh,-Bw/2),b=P(s*A/2,Hh,Bw/2),c=P(s*A/2,Hh+hh,0);B(o.wall||'plaster').tri(a,b,c,o.tint,[uvOf(a),uvOf(b),uvOf(c)],ridgeX?[s,0,0]:[0,0,s]);}
 if(o.chimney!==false&&R()<.7){const q=P(A*.28*(R()<.5?-1:1),Hh+rh*.62,Bw*.1);B('brick').box(.7,rh*.9+.9,.7,q[0],q[1]+.3,q[2],0xb8806a);B('conc').box(.9,.1,.9,q[0],q[1]+.3+rh*.45+.5,q[2],0x888480);}}
H.gable=gable;

/* bâtiment générique : murs, socle, corniche, fenêtres, porte ou devanture, toit */
function building(o){
 const {x:cx,z:cz,w,d,H:Hh}=o,lay=o.layer||'core',B=m=>D.B(lay,m),wm=o.wall||'plaster',fr=FACES[o.front],tint=o.tint==null?0xffffff:o.tint;
 B(wm).box(w,Hh,d,cx,Hh/2,cz,tint);
 B('conc').box(w+.14,.7,d+.14,cx,.35,cz,o.socle==null?0x8d8b86:o.socle);
 B('conc').box(w+.3,.22,d+.3,cx,Hh-.11,cz,o.corn==null?0xdad6cd:o.corn);
 const sh=o.shop?(o.shopH||3.9):0,fl=o.floors||Math.max(1,Math.round(Hh/3.1)),up=o.shop?Math.max(0,Math.min(fl-1,Math.floor((Hh-sh)/2.9))):fl,fh=o.shop?(Hh-sh)/Math.max(1,up):Hh/fl;
 const st=o.style||'house';
 for(const k of ['N','S','W','E']){const f=FACES[k],isF=k===o.front,len=f.nz?w:d,off=f.nz?d/2:w/2;
  const back=f.nx===-fr.nx&&f.nz===-fr.nz;
  if(!isF&&!back&&o.sides===false) continue;
  if(back&&lay==='far'&&!o.backFar) continue;
  const wopt={ww:o.ww,wh:o.wh,sp:o.sp,style:st,layer:lay,litP:o.litP,sill:isF&&o.sill&&lay!=='far',lintel:o.lintel,shut:isF?o.shut:0};
  if(isF&&o.shop){if(up>0) winRow(cx,cz,f.nx,f.nz,off,len,up,fh,sh,wopt);}
  else{wopt.skip=isF&&!o.shop?(u,fi)=>fi===0&&Math.abs(u)<1.9:null;winRow(cx,cz,f.nx,f.nz,off,len,fl,fh,0,wopt);}}
 const ry=Math.atan2(fr.nx,fr.nz),tx=Math.cos(ry),tz=-Math.sin(ry),fx=cx+fr.nx*(fr.nz?d/2:w/2),fz=cz+fr.nz*(fr.nz?d/2:w/2),len=fr.nz?w:d;
 const at=(u,y,v)=>[fx+tx*u+fr.nx*v,y,fz+tz*u+fr.nz*v];
 const L=D.L(B('plain'),fx,fz,ry,0);
 if(o.shop){
  // devanture : vitrines éclairées, porte vitrée, auvent, enseigne
  const gw=len-1.2,dw=1.5,sideW=(gw-dw)/2,sd=D.B(lay,'shop'),cs=pick([0xb03028,0x2a5a9a,0x2a7a4a,0xd88a20,0x6a2a7a,0xc0c0c0]);
  for(const s of [-1,1]){const n=Math.max(1,Math.ceil(sideW/2.8)),pw=sideW/n;for(let i=0;i<n;i++){const u=s*(dw/2+pw*(i+.5));const p=at(u,.5+1.15,.03);sd.quad(pw-.1,2.3,p[0],p[1],p[2],ry,null);}}
  const p=at(0,.12+1.1,.03);D.B(lay,'shop').quad(dw-.15,2.1,p[0],p[1],p[2],ry,null,[0,0,.5,1]);
  B('conc').box(len-.1,.45,.22,...at(0,.22,.1),0x6a6a70,ry);
  L.box(len-.2,.28,.3,0,3.12,.14,0x2c2f34);L.box(.3,3.1,.3,-len/2+.3,1.55,.14,0xc8c4bb);L.box(.3,3.1,.3,len/2-.3,1.55,.14,0xc8c4bb);
  if(lay!=='far'){const nst=Math.max(2,Math.floor((len-.6)/.55)),sw=(len-.6)/nst;for(let i=0;i<nst;i++){const col=i%2?0xf2efe6:cs;const q=at(-(len-.6)/2+sw*(i+.5),3.0,.62);det('plain').box(sw,.07,1.3,q[0],q[1],q[2],col,ry,.32);}}
  if(!o.noSign){const cell=D.signCell(o.sign!=null?o.sign:ri(0,31)),sw2=Math.min(len-1.4,4.4),q=at(0,Hh>sh+1.5?sh+.35:3.55,.04);
   D.B(lay,'signs').quad(sw2,sw2/4,q[0],q[1]+(sw2/8),q[2],ry,null,cell);}
 }else if(o.door!==false){
  const dc=o.doorCol==null?0x6a4a34:o.doorCol,tr=o.trim==null?0x3a3f46:o.trim;
  L.box(1.7,2.55,.16,0,1.28,.08,tr);L.box(1.3,2.25,.1,0,1.15,.17,dc);
  D.B(lay,'win').quad(.9,.7,...at(0,1.65,.23),ry,null);
  det('conc').box(2.1,.18,.8,...at(0,.09,.4),0xb0aca4,ry);
  det('plain').box(2.0,.12,1.1,...at(0,2.78,.55),tr,ry);
  core('lamph').box(.26,.05,.26,...at(0,2.7,.5),0xffffff,ry);
  det('plain').box(.12,.12,.04,...at(1.0,1.45,.22),0xd8c070,ry);}
 // toit
 if(o.roof==='gable') gable(cx,cz,w,d,Hh,{layer:lay,wall:wm,tint,roofTint:o.roofTint,rh:o.rh,ridgeX:o.ridgeX,chimney:o.chimney});
 else roofFlat(cx,cz,w,d,Hh,{layer:lay,wall:wm,tint,parapet:o.parapet,clutter:o.clutter});
 // balcons
 if(o.balcony&&lay!=='far'&&fl>=2){const bw=Math.min(len*.5,6),y=fh;det('conc').box(bw,.13,1.1,...at(0,y,.55),0xcfcbc2,ry);
  det('plain').box(bw,.08,.05,...at(0,y+1.0,1.07),0x2c3036,ry);for(let i=0;i<=Math.round(bw/.5);i++){det('plain').box(.04,.95,.04,...at(-bw/2+i*(bw/Math.round(bw/.5)),y+.55,1.07),0x2c3036,ry);}}
}
H.building=building;

/* parvis : dallage entre le trottoir et la façade */
function parvis(cx,cz,w,d,front,sid){const f=FACES[front];
 if(f.nz){const fz=cz+f.nz*d/2,edge=f.nz<0?pickEdge(fz,RZ,-1):pickEdge(fz,RZ,1);const len=Math.abs(edge-fz);if(len>.1) core('paving').box(w,.13,len,cx,.065,(fz+edge)/2);}
 else{const fxx=cx+f.nx*w/2,edge=f.nx<0?pickEdge(fxx,RX,-1):pickEdge(fxx,RX,1);const len=Math.abs(edge-fxx);if(len>.1) core('paving').box(len,.13,d,(fxx+edge)/2,.065,cz);}}
function pickEdge(v,cs,dir){let best=null;for(const c of cs){const e=dir<0?c+10:c-10;if(dir<0?(e<=v+.01&&(best==null||e>best)):(e>=v-.01&&(best==null||e<best))) best=e;}return best==null?v:best;}
H.parvis=parvis;

/* ═══════ Arbres, haies ═══════ */
const GREENS=[0x3f7a2a,0x4a8a30,0x58963a,0x2f6a2c,0x68a040,0x7a9a32,0x3a7a40];
function tree(x,z,s,kind){const pl=core('plain'),rm=D.rng((x*31+z*17)|0);kind=kind||pick(['r','r','r','c','p']);const g=pick(GREENS),dk=pick(GREENS);
 const tr=.2*s;pl.cyl(.15*s,.24*s,2.6*s,5,x,1.3*s,z,0x5a3e28);
 if(kind==='r'){const n=3;for(let i=0;i<n;i++){const a=i/n*PI*2+rm()*2,rd=1.0*s*(rm()*.9+.3),r=(1.15+rm()*.5)*s;pl.sph(r,r*.88,r,0,x+Math.cos(a)*rd,(3.2+rm()*1.0)*s+(i===0?.4*s:0),z+Math.sin(a)*rd,i%2?g:dk,rm()*3);}
  pl.sph(1.7*s,1.4*s,1.7*s,1,x,3.7*s,z,g,rm()*3);}
 else if(kind==='c'){for(let i=0;i<3;i++){const r=(2.0-i*.55)*s;pl.cyl(.05*s,r,2.3*s,7,x,(2.6+i*1.45)*s,z,i%2?0x2b6a34:0x2f7438);}}
 else{pl.sph(.95*s,3.1*s,.95*s,1,x,4.2*s,z,g,0);}}
H.tree=tree;
function hedge(x,z,len,ry){const pl=det('plain'),tx=Math.cos(ry),tz=-Math.sin(ry);pl.box(len,.5,.55,x,.25,z,0x2e5a28,ry);const n=Math.max(1,Math.round(len/.9));
 for(let i=0;i<n;i++){const u=-len/2+len/n*(i+.5);pl.sph(len/n*.62,.5,.42,0,x+tx*u,.78,z+tz*u,pick(GREENS),R()*3);}}
H.hedge=hedge;
// arbres de la base (colliders déjà posés) et arbres d'alignement
for(const [x,z,s] of ctx.trees) tree(x,z,s);
{const rm=D.rng(31);let n=0;
 for(const horiz of [true,false]) for(const r of (horiz?RZ:RX)) for(const sd of [-1,1]) for(let t=-266;t<=270&&n<130;t+=rm()*10+21){
  if(near(t,horiz?RX:RZ,18)) continue;const x=horiz?t:r+sd*8.6,z=horiz?r+sd*8.6:t;
  if(Math.hypot(x+25,z-8)<7||!free(x,z,.5,.5,.6)||zones.some(q=>q.porte&&Math.hypot(q.porte.x-x,q.porte.z-z)<8)) continue;if(rm()<.18) continue;
  tree(x,z,.8+rm()*.35,rm()<.8?'r':'p');addCol(x,z,.5,.5);n++;}}

/* ═══════ Voitures garées (fusionnées en un maillage) ═══════ */
function bakeCar(opts,x,z,ry,layer){
 let g;try{g=MW.carMesh(opts);}catch(e){return null;}if(!g) return null;g.position.set(x,0,z);g.rotation.y=ry;g.updateMatrixWorld(true);
 const b=D.B(layer||'detail','car'),c=new T.Color();
 g.traverse(o=>{if(!o.isMesh||o.visible===false||!o.geometry||!o.geometry.attributes.position) return;const geo=o.geometry;if(!geo.attributes.normal) geo.computeVertexNormals();
  const m=Array.isArray(o.material)?o.material[0]:o.material;c.copy(m&&m.color?m.color:new T.Color(0x808080));if(!(m&&m.userData&&m.userData.lin)) c.convertSRGBToLinear();
  if(m&&m.emissive&&(m.emissive.r+m.emissive.g+m.emissive.b)>.05){const e=m.emissive.clone();if(!(m.userData&&m.userData.lin)) e.convertSRGBToLinear();c.r=Math.min(1,c.r+e.r);c.g=Math.min(1,c.g+e.g);c.b=Math.min(1,c.b+e.b);}
  b.add(geo,o.matrixWorld,[c.r,c.g,c.b],true);});
 return g;}
H.bakeCar=bakeCar;
{const rm=D.rng(909),COL=[0xb03030,0x2a4a8a,0xe0e0e0,0x202428,0x3a7a4a,0xd8a020,0x8a8f98,0x6a2a5a,0xc4c4c0],KIND=['citadine','berline','suv','citadine','berline','utilitaire'];let n=0;
 const doors=zones.filter(z=>z.porte).map(z=>z.porte);
 const spot=(x,z,ry,len)=>{if(Math.hypot(x+23.5,z-5.4)<8||!free(x,z,len?2.3:1,len?1:2.3,.2)) return;if(doors.some(p=>Math.hypot(p.x-x,p.z-z)<9)) return;
  const k=pick(KIND);if(bakeCar({kind:k,color:pick(COL)},x,z,ry,'detail')){addCol(x,z,len?4.8:2.1,len?2.1:4.8);n++;}};
 for(const r of RZ) for(const sd of [-1,1]) for(let t=-250;t<=250;t+=rm()*30+30){if(near(t,RX,20)||rm()<.45||n>=16) continue;spot(t,r+sd*5.55,sd>0?PI/2:-PI/2,1);}
 for(const r of RX) for(const sd of [-1,1]) for(let t=-250;t<=250;t+=rm()*40+40){if(near(t,RZ,20)||rm()<.5||n>=16) continue;spot(r+sd*5.55,t,sd<0?0:PI,0);}}

/* ═══════ Bancs, poubelles, abribus, colonne à affiches ═══════ */
{const rm=D.rng(63);
 const bench=(x,z,ry)=>{const L=D.L(det('plain'),x,z,ry,0),W=D.L(det('wood'),x,z,ry,0);W.box(1.7,.06,.2,0,.46,-.1,0x7a5030);W.box(1.7,.06,.2,0,.46,.12,0x7a5030);W.box(1.7,.07,.05,0,.82,-.22,0x7a5030);W.box(1.7,.07,.05,0,.7,-.22,0x7a5030);
  for(const s of [-1,1]){L.box(.07,.46,.5,s*.78,.23,0,0x2c3036);L.box(.07,.5,.05,s*.78,.65,-.22,0x2c3036);}};
 const bin=(x,z)=>{const p=det('plain');p.cyl(.26,.22,.85,10,x,.43,z,0x2f5a3a);p.cyl(.28,.28,.07,10,x,.88,z,0x1e3a26);};
 const sp=[[-52,-8.3,0],[-52,8.4,PI],[40,-8.3,0],[40,8.4,PI],[100,8.4,PI],[-8,-8.3,0],[-120,-8.3,0],[8,8.4,PI],[-100,141.7,0],[60,158.3,PI],[-60,-141.7,0],[100,-158.3,PI],[-141.7,-60,PI/2],[141.7,70,-PI/2],[8.3,-80,-PI/2],[-8.3,90,PI/2]];
 for(const [x,z,ry] of sp){if(!free(x,z,.9,.9,.1)) continue;bench(x,z,ry);bin(x+Math.cos(ry)*2.2,z-Math.sin(ry)*2.2);}
 const ads=D.signMat(D.canvasTex(256,128,(x,w,h)=>{x.fillStyle='#fffbe6';x.fillRect(0,0,w,h);x.fillStyle='#c02a1a';x.fillRect(0,0,w,26);x.fillStyle='#fff';x.font='bold 18px Arial';x.textAlign='center';x.fillText('VENTE PRIVÉE',w/2,20);x.fillStyle='#222';x.font='bold 30px Arial';x.fillText('-50 %',w/2,72);x.font='14px Arial';x.fillText('Pièces auto · Pneus · Outillage',w/2,100);}));
 for(const [x,z,ry] of [[-50,-9.1,0],[38,9.2,PI],[-9.2,70,PI/2],[9.2,-90,-PI/2],[100,-9.1,0]]){
  const L=D.L(det('plain'),x,z,ry,0),gl=D.L(D.B('detail','glass'),x,z,ry,0);
  L.box(.1,2.6,.1,-1.6,1.3,-.5,0x30363c);L.box(.1,2.6,.1,1.6,1.3,-.5,0x30363c);L.box(3.6,.12,1.6,0,2.66,0,0x30363c);L.box(3.3,.05,.05,0,.07,-.5,0x30363c);
  gl.box(3.2,2.3,.04,0,1.3,-.55,0xcfe6f0);gl.box(.04,2.3,1,-1.6,1.3,0,0xcfe6f0);gl.box(.04,2.3,1,1.6,1.3,0,0xcfe6f0);
  L.box(1.5,.06,.4,-.4,.46,-.3,0x6a6e74);L.box(.07,.46,.4,-1.0,.23,-.3,0x30363c);L.box(.07,.46,.4,.2,.23,-.3,0x30363c);
  const m=new T.Mesh(new T.PlaneGeometry(1.0,1.5),ads);const p=L.w(1.05,-.5+.03);m.position.set(p[0],1.3,p[1]);m.rotation.y=ry;ctx.scene.add(m);addCol(x,z,Math.abs(Math.cos(ry))>.5?3.6:1.8,Math.abs(Math.cos(ry))>.5?1.8:3.6);}
 // colonne à affiches
 const col=(x,z)=>{const p=det('plain');p.cyl(.62,.62,.15,14,x,.075,z,0x30363c);p.cyl(.55,.55,2.4,14,x,1.35,z,0x2f5a3a);p.cyl(.62,.5,.3,14,x,2.7,z,0x30363c);p.cyl(.3,.55,.5,14,x,3.0,z,0x2f5a3a);};
 col(-6.5,-8.6);col(8.2,98);}

/* ═══════ Immeubles ═══════ */
const TINTS={plaster:[0xf0e2c4,0xe8cfa8,0xf2d8d0,0xd8e4ec,0xdde8d0,0xf4ecd8,0xe6c8a0,0xefe0e8],brick:[0xffffff,0xf0e0d8,0xd8c8c0,0xe8d0c0],stone:[0xffffff,0xf4eee4,0xe6e0d4]};
const SHUT=[0x3a5a4a,0x7a2a2a,0x2a4a7a,0x5a4a3a,0x8a7a4a];
function randomBuilding(o){
 const r=R(),floors=o.floors||ri(2,5);
 const kind=r<.40?'plaster':r<.62?'brick':r<.77?'stone':'plaster',shop=o.allowShop&&floors>=2&&R()<.48;
 const Hh=shop?3.9+(floors-1)*3.05:floors*3.1+.6;
 return Object.assign({},o,{H:Hh,floors,wall:kind,tint:pick(TINTS[kind]),shop,shopH:3.9,roof:Hh>11||R()<.62?'flat':'gable',roofTint:pick([0xffffff,0xe8d0c0,0xc8c0b8]),
  sill:true,lintel:R()<.4,shut:kind==='plaster'&&R()<.3?pick(SHUT):0,balcony:!shop&&floors>=3&&R()<.35,doorCol:pick([0x6a4a34,0x2a4a6a,0x7a2a2a,0x3a5a4a,0x30343a]),sign:ri(0,31),style:'house'});}
// base : maisons existantes (colliders déjà posés)
for(const [cx,cz,hw,hd,h,side] of ctx.houses){const floors=Math.max(2,Math.round(h/3));
 const front=side==='N'?'N':'S';
 const o=randomBuilding({x:cx,z:cz,w:hw*2,d:hd*2,front,floors,allowShop:true,layer:Math.hypot(cx,cz)>190?'far':'core',backFar:false});
 building(o);parvis(cx,cz,hw*2,hd*2,front);
 if(!o.shop&&R()<.6){const f=FACES[front];hedge(cx-hw*.55,cz+f.nz*(hd+1.4),hw*.7,0);hedge(cx+hw*.55,cz+f.nz*(hd+1.4),hw*.7,0);}}
// remplissage : toutes les façades de rue
{let count=0;const infill=[];
 for(const horiz of [true,false]) for(const r of (horiz?RZ:RX)) for(const sd of [-1,1]){
  let t=-282+rr(0,6);
  while(t<282&&count<260){
   const len=rr(10,21),dep=rr(6,9),floors=ri(2,5),c=t+len/2;
   const crossC=horiz?RX:RZ;
   if(crossC.some(q=>Math.abs(c-q)<len/2+14)){t+=6;continue;}
   const dist=12.8+dep/2,cx=horiz?c:r+sd*dist,cz=horiz?r+sd*dist:c,w=horiz?len:dep,d=horiz?dep:len;
   if(!free(cx,cz,w/2,d/2,1.2)||(cx+w/2>-48&&cx-w/2<2&&cz+d/2>26&&cz-d/2<56)){t+=4;continue;}
   const front=horiz?(sd<0?'S':'N'):(sd<0?'E':'W'),far=Math.hypot(cx,cz)>175;
   const o=randomBuilding({x:cx,z:cz,w,d,front,floors,allowShop:Math.hypot(cx,cz)<230,layer:far?'far':'core',sides:!far,backFar:false});
   building(o);addCol(cx,cz,w,d);count++;
   // dallage du trottoir à la façade
   const f=FACES[front];if(f.nz) core('paving').box(w,.13,2.8,cx,.065,cz+f.nz*(d/2+1.4));else core('paving').box(2.8,.13,d,cx+f.nx*(w/2+1.4),.065,cz);
   if(!o.shop&&!far&&R()<.5){if(f.nz) hedge(cx,cz+f.nz*(d/2+1.9),w*.6,0);else hedge(cx+f.nx*(w/2+1.9),cz,d*.6,PI/2);}
   t+=len+rr(.5,3.5);}}
 H.count=count;}

/* ═══════ Bâtiments de la carte : façades, enseignes (non garages) ═══════ */
D.zoneSign=(z,o)=>{ /* enseigne lumineuse sur la façade ; o:{w,h,y,off,draw(ctx,w,h)} */
 const sw=o.w||Math.min(z.w-3,9),sh=o.h||sw*.2,out={x:-z.n.x,z:-z.n.z},ry=Math.atan2(out.x,out.z);
 const tex=D.canvasTex(1024,Math.round(1024*sh/sw),(x,w,h)=>o.draw(x,w,h)),mt=D.signMat(tex),dk=H.dark||(H.dark=new T.MeshLambertMaterial({color:0x2a2c30}));
 const g=new T.Mesh(new T.BoxGeometry(sw,sh,.22),[dk,dk,dk,dk,mt,dk]);
 const off=o.off==null?.4:o.off;g.position.set(z.door.x+out.x*off,o.y,z.door.z+out.z*off);g.rotation.y=ry;ctx.scene.add(g);return g;};
H.zoneFront=z=>{const o=z.out||(z.out={x:-z.n.x,z:-z.n.z});return o.z<0?'N':o.z>0?'S':o.x<0?'W':'E';};

const draw=(bg,fg,t1,t2)=>(x,w,h)=>{x.fillStyle=bg;x.fillRect(0,0,w,h);x.strokeStyle=fg;x.lineWidth=h*.05;x.strokeRect(h*.06,h*.06,w-h*.12,h*.88);
 let f=h*.46;x.font='bold '+f+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';while(x.measureText(t1).width>w*.9&&f>16){f-=3;x.font='bold '+f+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';}
 x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.fillText(t1,w/2,t2?h*.42:h*.52);if(t2){x.font='600 '+h*.17+'px Arial';x.fillText(t2,w/2,h*.76);}};
H.draw=draw;
const ZB={
 appart:()=>({w:20,d:14,H:6.5,floors:2,wall:'plaster',tint:0xe6d2ac,roof:'gable',roofTint:0xd89070,rh:2.2,trim:0x4a5a78,doorCol:0x4a5a78,sill:true,lintel:true,shut:0x4a5a78,balcony:false,chimney:true}),
 pieces:()=>({shop:true,noSign:true,shopH:3.9,wall:'plaster',tint:0xeedf9a,roof:'flat',parapet:0xd8b830,floors:2,sill:true}),
 concess:()=>({shop:true,noSign:true,shopH:4.3,wall:'plaster',tint:0xe0cce8,roof:'flat',parapet:0x7a3aa0,floors:2,sill:true}),
 ecole:()=>({wall:'plaster',tint:0xd6e4c8,roof:'flat',parapet:0x4a6a3a,floors:2,ww:1.6,wh:1.9,sp:3.6,sill:true,lintel:true,door:false}),
 banque:()=>({wall:'stone',tint:0xffffff,roof:'flat',parapet:0x1f3558,floors:3,ww:1.2,wh:1.9,sp:3.4,sill:true,lintel:true,door:false,corn:0x1f3558}),
 bureau:()=>({style:'office',wall:'conc',tint:0xdfe6ec,roof:'flat',parapet:0xaab4be,floors:4,door:false,sp:3.1,clutter:true,corn:0x6a7886,litP:.5})};
for(const z of zones){if(z.type==='garage'||z.type==='terrain') continue;const d=z._d,c=ZB[z.id]?ZB[z.id]():{},front=H.zoneFront(z);
 const o=Object.assign({x:z.x,z:z.z,H:d.H,front,floors:c.floors},c);o.w=z.w;o.d=z.d;
 building(o);parvis(z.x,z.z,z.w,z.d,front);}
D.zoneBuilt=true;
};
