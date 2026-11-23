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
function lamp(x,z,tx,tz){if(zones.some(q=>q._d.immo&&Math.hypot(q.door.x-x,q.door.z-z)<6.5)) return; /* pas de lampadaire devant l'entrée d'un bien à vendre */
 const lay=Math.hypot(x,z)>185?'far':'core',pl=D.B(lay,'plain'),ry=Math.atan2(tx,tz);
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
// panneaux de direction : un par approche de chaque carrefour, vers les lieux clés (atlas de 40 panneaux, un seul appel de dessin)
{const KEY=['garage1','pieces','concess','garage2','garage3','garage4','ecole','banque','bureau'],NS=MW.streets||{ns:[],ew:[]};
 const CW=256,CH=96,COLS=4,ROWS=10,cv=document.createElement('canvas');cv.width=CW*COLS;cv.height=CH*ROWS;const g=cv.getContext('2d');
 g.fillStyle='#4a4f55';g.fillRect(0,0,cv.width,cv.height);
 const cells=[];let nb=0;
 const arrow=(x,y,kind)=>{g.save();g.translate(x,y);g.rotate(kind==='l'?-Math.PI/2:kind==='r'?Math.PI/2:0);g.fillStyle='#fff';g.beginPath();g.moveTo(0,-9);g.lineTo(8,1);g.lineTo(3,1);g.lineTo(3,9);g.lineTo(-3,9);g.lineTo(-3,1);g.lineTo(-8,1);g.closePath();g.fill();g.restore();};
 const board=(rx,rz,dx,dz,ix,iz)=>{
  const right=[-dz,dx],items=[];
  for(const id of KEY){const q=MW.zone(id);if(!q) continue;const tx=q.porte.x-rx,tz=q.porte.z-rz,f=tx*dx+tz*dz,sd=tx*right[0]+tz*right[1],dist=Math.hypot(tx,tz);
   if(dist<28||(f<-15&&-f>Math.abs(sd))) continue;
   const kind=Math.abs(sd)>Math.abs(f)?(sd>0?'r':'l'):'s';items.push({q,kind,dist});}
  items.sort((a,b)=>a.dist-b.dist);const top=items.slice(0,3);if(!top.length||nb>=COLS*ROWS-1) return null;
  const col=nb%COLS,row=Math.floor(nb/COLS),ox=col*CW,oy=row*CH;nb++;
  g.save();g.translate(ox,oy);g.fillStyle='#17559c';g.fillRect(0,0,CW,CH);g.strokeStyle='#fff';g.lineWidth=3;g.strokeRect(3,3,CW-6,CH-6);
  const sname=dx!==0?NS.ew[iz]:NS.ns[ix];g.fillStyle='#bcd8f6';g.font='bold 13px Arial,sans-serif';g.textAlign='left';g.textBaseline='middle';g.fillText((sname||'').toUpperCase(),10,15);
  g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=1;g.beginPath();g.moveTo(8,25);g.lineTo(CW-8,25);g.stroke();
  top.forEach((it,k)=>{const y=40+k*21;arrow(20,y,it.kind);g.fillStyle='#fff';g.textAlign='left';g.font='bold 17px Arial,sans-serif';
   let nm=it.q.court;while(g.measureText(nm).width>160&&nm.length>6) nm=nm.slice(0,-1);g.fillText(nm,38,y+1);g.textAlign='right';g.font='14px Arial,sans-serif';g.fillStyle='#cfe3fa';g.fillText(Math.round(it.dist/10)*10+' m',CW-10,y+1);});
  g.restore();return [ox/cv.width,1-(oy+CH)/cv.height,(ox+CW)/cv.width,1-oy/cv.height];};
 const placed=[];
 RX.forEach((rx,ix)=>RZ.forEach((rz,iz)=>{
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const uv=board(rx,rz,dx,dz,ix,iz);if(!uv) continue;
   const rt=[-dz,dx],bx=rx-dx*21+rt[0]*9.9,bz=rz-dz*21+rt[1]*9.9;
   if(zones.some(q=>Math.abs(bx-q.x)<q.w/2+1&&Math.abs(bz-q.z)<q.d/2+1)||lampPts.some(p=>Math.hypot(p[0]-bx,p[1]-bz)<2.2)) continue;
   placed.push([bx,bz,Math.atan2(-dx,-dz),uv]);}}));
 if(placed.length){D.dirsCanvas=cv;const pl=core('plain'),dm=D.B('core','dirs');
  for(const [x,z,ry,uv] of placed){pl.cyl(.05,.05,3.1,6,x,1.55,z,0x6a7076);pl.box(2.0,.05,.05,x,3.0,z,0x6a7076,ry);
   dm.quad(2.1,.79,x+Math.sin(ry)*.02,2.55,z+Math.cos(ry)*.02,ry,null,uv,0,false);pl.box(2.18,.86,.03,x,2.55,z,0x4a5056,ry);addCol(x,z,.3,.3);}}}
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
 B(wm).box(w,Hh-.22,d,cx,(Hh-.22)/2,cz,tint); /* [textures] le mur s'arrête sous la corniche : plus de faces hautes confondues à la hauteur Hh */
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
  if(near(t,horiz?RX:RZ,18)) continue;const x=horiz?t:r+sd*7.7,z=horiz?r+sd*7.7:t; /* [ville] au bord du trottoir (bordure à 7,1) : l'arbre ne barre plus la marche, il reste 2,4 m côté façades */
  if(Math.hypot(x+25,z-8)<7||!free(x,z,.5,.5,.6)||zones.some(q=>q.porte&&Math.hypot(q.porte.x-x,q.porte.z-z)<8)) continue;if(rm()<.18) continue;
  tree(x,z,.8+rm()*.35,rm()<.8?'r':'p');addCol(x,z,.5,.5);n++;}}

/* ═══════ Voitures garées (fusionnées en un maillage) ═══════ */
function bakeCar(opts,x,z,ry,layer){
 let g;try{g=MW.carMesh(opts);}catch(e){return null;}if(!g) return null;g.position.set(x,0,z);g.rotation.y=ry;g.updateMatrixWorld(true);
 const c=new T.Color();
 /* chaque voiture garée est un petit groupe indépendant : écarté du dessin quand il est loin ou hors champ (voir MWD.frame) ;
    les freins (cachés derrière les jantes) ne sont pas cuits */
 const gr=D.group(B=>{const b=B('car');
  g.traverse(o=>{if(!o.isMesh||o.visible===false||!o.geometry||!o.geometry.attributes.position) return;if(o.parent&&/^brake/.test(o.parent.name)) return;const geo=o.geometry;if(!geo.attributes.normal) geo.computeVertexNormals();
   const m=Array.isArray(o.material)?o.material[0]:o.material;c.copy(m&&m.color?m.color:new T.Color(0x808080));if(!(m&&m.userData&&m.userData.lin)) c.convertSRGBToLinear();
   if(m&&m.emissive&&(m.emissive.r+m.emissive.g+m.emissive.b)>.05){const e=m.emissive.clone();if(!(m.userData&&m.userData.lin)) e.convertSRGBToLinear();c.r=Math.min(1,c.r+e.r);c.g=Math.min(1,c.g+e.g);c.b=Math.min(1,c.b+e.b);}
   b.add(geo,o.matrixWorld,[c.r,c.g,c.b],true);});});
 (D.parked||(D.parked=[])).push({g:gr,x,z,layer:layer||'detail'});
 return g;}
H.bakeCar=bakeCar;
{const rm=D.rng(909),COL=[0xb03030,0x2a4a8a,0xe0e0e0,0x202428,0x3a7a4a,0xd8a020,0x8a8f98,0x6a2a5a,0xc4c4c0],KIND=['citadine','berline','suv','citadine','berline','utilitaire'];let n=0;
 const doors=zones.filter(z=>z.porte).map(z=>z.porte);
 const spot=(x,z,ry,len)=>{if(Math.hypot(x+23.5,z-5.4)<8||(Math.abs(z-5.4)<3.6&&x>-32&&x<12)||!free(x,z,len?2.3:1,len?1:2.3,.2)) return;if(doors.some(p=>Math.hypot(p.x-x,p.z-z)<9)) return;
  const k=pick(KIND);if(bakeCar({kind:k,color:pick(COL)},x,z,ry,'detail')){addCol(x,z,len?4.8:2.1,len?2.1:4.8);n++;}};
 for(const r of RZ) for(const sd of [-1,1]) for(let t=-250;t<=250;t+=rm()*30+30){if(near(t,RX,20)||rm()<.45||n>=16) continue;spot(t,r+sd*5.55,sd>0?PI/2:-PI/2,1);}
 for(const r of RX) for(const sd of [-1,1]) for(let t=-250;t<=250;t+=rm()*40+40){if(near(t,RZ,20)||rm()<.5||n>=16) continue;spot(r+sd*5.55,t,sd<0?0:PI,0);}}

/* ═══════ Places de stationnement (marquées devant les lieux clés et sous les voitures garées) + cours plantées ═══════ */
{const bays=new Set(),ts=D.B('core','tsign');
 const tick=(horiz,r,sd,t)=>{const k=horiz+'|'+r+'|'+sd+'|'+Math.round(t);if(bays.has(k)) return;bays.add(k);
  if(horiz) flat(.12,1.95,t,r+sd*5.55,WH);else flat(1.95,.12,r+sd*5.55,t,WH);};
 const row=(horiz,r,sd,t0,n)=>{for(let i=0;i<=n;i++){const t=t0+i*5.4;if(near(t,horiz?RX:RZ,14)) continue;tick(horiz,r,sd,t);}};
 for(const q of zones){if(!q.door||q._d.interior&&q.type==='terrain') continue;if(q._d.immo&&q.type!=='garage'&&q.type!=='usine') continue;
  let best=null,bd=1e9;for(const r of RZ){const d=Math.abs(q.door.z-r);if(d<bd&&d<17){bd=d;best=[true,r,Math.sign(q.door.z-r)||1,q.door.x];}}
  for(const r of RX){const d=Math.abs(q.door.x-r);if(d<bd&&d<17){bd=d;best=[false,r,Math.sign(q.door.x-r)||1,q.door.z];}}
  if(!best) continue;const [h,r,sd,c]=best;row(h,r,sd,c-10.8,4);
  const px=h?c-13.5:r+sd*8.9,pz=h?r+sd*8.9:c-13.5;if(free(px,pz,.3,.3,.2)){core('plain').cyl(.035,.035,2.4,6,px,1.2,pz,0x6a7076);ts.quad(.6,.6,px,2.2,pz,h?(sd>0?PI:0):(sd>0?-PI/2:PI/2),null,[0,0,.25,.5],0,true);}}
 // quelques rangées libres le long des rues principales, pour que la ville ne soit pas vide
 for(const [h,r,sd,t0] of [[true,0,1,-120],[true,0,-1,-60],[true,150,-1,-100],[true,-150,1,60],[false,0,-1,-90],[false,150,1,60],[false,-150,-1,-40]]) row(h,r,sd,t0,5);
 // cours plantées : arbres, haies et buissons dans les îlots (ni sur les bâtiments, ni sur les rues)
 const rm=D.rng(515),pl=det('plain');let nt=0,nb=0,tr=0;
 while(nt<44&&tr++<900){const x=rm()*500-250,z=rm()*500-250;
  if(near(x,RX,19)||near(z,RZ,19)||!free(x,z,2.6,2.6,5)) continue;
  tree(x,z,.75+rm()*.4,rm()<.7?'r':rm()<.5?'c':'p');addCol(x,z,.5,.5);nt++;}
 tr=0;while(nb<70&&tr++<1200){const x=rm()*500-250,z=rm()*500-250;
  if(near(x,RX,18)||near(z,RZ,18)||!free(x,z,1.4,1.4,3)) continue;
  const g=pick(GREENS);for(let i=0;i<3;i++) pl.sph(.55+rm()*.3,.45+rm()*.2,.55+rm()*.3,0,x+rm()*1.2-.6,.45,z+rm()*1.2-.6,g,rm()*3);nb++;}}

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
 const col=(x,z)=>{const p=det('plain');p.cyl(.62,.62,.19,14,x,.095,z,0x30363c); /* [textures] socle plus haut que le trottoir (0,15) : plus de face confondue */p.cyl(.55,.55,2.4,14,x,1.35,z,0x2f5a3a);p.cyl(.62,.5,.3,14,x,2.7,z,0x30363c);p.cyl(.3,.55,.5,14,x,3.0,z,0x2f5a3a);};
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
 bureau:()=>({style:'office',wall:'conc',tint:0xdfe6ec,roof:'flat',parapet:0xaab4be,floors:4,door:false,sp:3.1,clutter:true,corn:0x6a7886,litP:.5}),
 /* immobilier (js/52) : logements et usines à acheter */
 loge1:()=>({wall:'plaster',tint:0xeedcb8,roof:'gable',roofTint:0xd89070,rh:2.0,floors:2,sill:true,lintel:true,shut:0x3a5a7a,doorCol:0x3a5a7a,trim:0x3a5a7a,chimney:true}),
 loge2:()=>({wall:'brick',tint:0xf0e0d8,roof:'flat',parapet:0x5a5a60,floors:3,balcony:true,sill:true,lintel:true,doorCol:0x6a4a8a,trim:0x3a3f46}),
 loge3:()=>({wall:'plaster',tint:0xf4ead2,roof:'gable',roofTint:0xc88060,rh:2.4,floors:2,sill:true,lintel:true,shut:0x2f7a5a,doorCol:0x2f7a5a,trim:0x2f4a3a,chimney:true}),
 loge4:()=>({wall:'stone',tint:0xffffff,roof:'gable',roofTint:0xa8a8b0,rh:2.2,floors:2,sill:true,lintel:true,balcony:true,doorCol:0x1c1c22,trim:0x1c1c22,chimney:true,ww:1.3,wh:1.8,sp:3.4}),
 usine1:()=>({wall:'conc',tint:0xd8d6cc,roof:'flat',parapet:0x5a5f66,floors:2,door:false,ww:2.2,wh:1.1,sp:5,clutter:true,corn:0x5a5f66,litP:.3}),
 usine2:()=>({wall:'conc',tint:0xc8ccd2,roof:'flat',parapet:0x4a5058,floors:3,door:false,ww:2.6,wh:1.2,sp:6,clutter:true,corn:0x4a5058,litP:.35})};
for(const z of zones){if(z.type==='garage'||z.type==='terrain') continue;const d=z._d,c=ZB[z.id]?ZB[z.id]():{},front=H.zoneFront(z);
 const o=Object.assign({x:z.x,z:z.z,H:d.H,front,floors:c.floors},c);o.w=z.w;o.d=z.d;
 building(o);parvis(z.x,z.z,z.w,z.d,front);}
/* ═══════ Immobilier (js/52) : enseignes, jardins, quais et cheminées ═══════ */
for(const z of zones){if(!z._d.immo||z.type==='garage') continue;
 const d=z._d,out={x:-z.n.x,z:-z.n.z},ry=Math.atan2(out.x,out.z),fw=(z.side==='E'||z.side==='W')?z.d:z.w,dp=(z.side==='E'||z.side==='W')?z.w:z.d;
 const Lp=D.L(core('plain'),z.door.x,z.door.z,ry,0),Ld=D.L(det('plain'),z.door.x,z.door.z,ry,0),Lc=D.L(core('conc'),z.door.x,z.door.z,ry,0),W=(lx,lz)=>Lp.w(lx,lz);
 const name=z.court.toUpperCase();
 if(z.type==='logement'){
  D.zoneSign(z,{y:z.id==='loge4'?3.9:3.45,off:.32,w:z.id==='loge2'?3.6:2.8,h:.62,draw:H.draw('#'+d.sign.toString(16).padStart(6,'0'),d.fg,name,null)});
  // haies, arbres et boîte aux lettres
  for(const sx of [-1,1]){const q=W(sx*(fw/2-1.8),2.1);hedge(q[0],q[1],Math.max(2.5,fw*.28),ry);}
  const mb=W(fw/2-.8,1.6);Ld.box(.4,.3,.6,fw/2-.8,1.0,1.6,0x2a5a9a);Ld.box(.08,1.0,.08,fw/2-.8,.5,1.6,0x3a3f46);
  const t1=W(-fw/2-3.2,-dp*.3),t2=W(fw/2+3.4,-dp*.2);tree(t1[0],t1[1],1.0,'r');tree(t2[0],t2[1],.9,'r');
  addCol(t1[0],t1[1],.7,.7);addCol(t2[0],t2[1],.7,.7);
  if(z.id==='loge3'){ // porte de garage, allée
   Lp.box(3.4,2.5,.16,-fw*.28,1.25,.1,0xe4e6e8);for(let i=0;i<4;i++) Lp.box(3.2,.04,.18,-fw*.28,.6+i*.5,.12,0xb4b8bc);
   Lc.box(3.6,.1,3.2,-fw*.28,.05,1.8,0x8a8c90);}
  if(z.id==='loge4'){ // colonnes d'entrée, grille, lampes
   for(const sx of [-1,1]){Lp.cyl(.28,.3,3.6,12,sx*1.5,1.8,1.5,0xf2eee4);Lp.box(.8,.2,.8,sx*1.5,.1,1.5,0xd8d2c0);}
   Lp.box(4.0,.4,2.6,0,3.7,1.1,0xe2dccc);Lc.box(4.4,.2,3.2,0,.1,1.7,0xcfcab8);
   for(const sx of [-1,1]) Ld.box(.06,2.4,.06,sx*(fw/2),1.2,3.2,0x2a2c30);}
  if(z.id==='loge2'){ // entrée vitrée, auvent
   Lp.box(3.2,.2,1.6,0,3.0,.9,0x5a5a60);const sd=D.B('core','office'),dl=D.L(sd,z.door.x,z.door.z,ry,0);dl.quad(1.1,2.3,-.6,1.35,.2,null);dl.quad(1.1,2.3,.6,1.35,.2,null);}
 }
 if(z.type==='usine'){
  D.zoneSign(z,{y:d.H-1.6,off:.36,w:Math.min(fw-3,13),h:2.0,draw:H.draw('#'+d.sign.toString(16).padStart(6,'0'),d.fg,z.id==='usine2'?'GRANDE USINE DU VALLON':'ATELIER MARCHAND',z.id==='usine2'?'Fabrication · Assemblage':'Fabrication de précision')});
  // quais, portes roulantes, entrée vitrée
  const nd=z.id==='usine2'?3:2,gap=fw/(nd+1);
  for(let i=0;i<nd;i++){const lx=-fw/2+gap*(i+1)+(i%2?1.5:-1.5)*0;if(Math.abs(lx)<3.5) continue;
   Lp.box(4.4,4.6,.2,lx,2.3,.12,0x59616a);for(let k=0;k<9;k++) Lp.box(4.2,.05,.22,lx,.45+k*.5,.14,0x474e56);
   Lp.box(4.8,.35,.3,lx,4.75,.14,0xe6c020);Lp.box(.35,4.8,.3,lx-2.35,2.4,.14,0xe6c020);Lp.box(.35,4.8,.3,lx+2.35,2.4,.14,0xe6c020);
   Lc.box(5,.5,1.4,lx,.25,.9,0x9a988f);}
  {const sd=D.B('core','office'),dl=D.L(sd,z.door.x,z.door.z,ry,0);for(const sx of [-1,1]) dl.quad(1.3,2.7,sx*.72,1.4,.12,null);
   Lp.box(3.4,.3,2.4,0,3.0,1.2,0x2a3038);Lp.box(.2,3.0,.2,-1.6,1.5,2.2,0x2a3038);Lp.box(.2,3.0,.2,1.6,1.5,2.2,0x2a3038);Lp.box(3.2,.12,.12,0,2.75,.1,0x2a3038);}
  // cheminées, conteneurs, cuves
  const st=W(-fw*.25,-dp*.3);Lp.cyl(.8,1.1,15,10,-fw*.25,d.H+6.5,-dp*.3,0x8a5a4a);Lp.cyl(.9,.9,.6,10,-fw*.25,d.H+14.2,-dp*.3,0x3a3a3e);
  if(z.id==='usine2'){Lp.cyl(.7,1.0,12,10,fw*.2,d.H+5.5,-dp*.25,0x8a5a4a);Lp.cyl(.8,.8,.5,10,fw*.2,d.H+11.7,-dp*.25,0x3a3a3e);}
  /* [ville] profondeur négative = côté arrière du bâtiment (la profondeur positive pointe vers la rue : silos et conteneurs posés au milieu de l'avenue) */
  for(const [lx,lz] of [[fw/2+3.4,-dp*.25],[fw/2+3.4,-dp*.5]]){const q=W(lx,lz);Lp.cyl(2.2,2.2,z.id==='usine2'?11:8,14,lx,z.id==='usine2'?5.5:4,lz,0xc8ccd0);Lp.cyl(2.3,2.0,.6,14,lx,z.id==='usine2'?11.2:8.2,lz,0x8a9098);addCol(q[0],q[1],4.6,4.6);}
  const cc=[0xc0392b,0x2a5a9a,0x3a7a4a,0xd8a020];
  for(let i=0;i<4;i++){const lx=-fw/2-3.6,lz=-(dp*.12+i*6.4),q=W(lx,lz); /* conteneurs bout à bout (ils se chevauchaient : faces hautes confondues) */Ld.box(2.4,2.6,6,lx,1.3,lz,cc[i]);addCol(q[0],q[1],2.5,6.2);for(let k=0;k<7;k++) Ld.box(2.5,2.4,.06,lx,1.3,lz-2.6+k*.85,0x303236);}
 }
}
D.zoneBuilt=true;
};
