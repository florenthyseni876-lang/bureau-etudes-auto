'use strict';
/* ───────────── Mode « Mécanicien » — DÉCOR : socle graphique ─────────────
   Ce fichier (avec 45b-meca-ville.js et 45c-meca-garages.js) remplace les boîtes unies du monde ouvert par un décor soigné :
   textures générées dans des canvas (mises en cache, partagées), fusion des géométries statiques par matériau (peu d'appels de dessin),
   ciel en dégradé avec soleil, lune, étoiles et nuages, cycle jour / nuit (aube, crépuscule, nuit : lampadaires et fenêtres qui s'allument),
   rendu avec couleurs corrigées (sRGB) et ACES, ombres du soleil autour du joueur (qualité haute seulement) et réglage de qualité.

   Points d'accroche dans js/40-meca-monde.js : `MW.decor.build(ctx)` (appelé par buildWorld, qui retire alors les boîtes de base),
   `MW.decor.renderer(R)` (réglage du moteur de rendu), `MW.decor.frame(dt,t,h)` (chaque image, à la place de updateSky),
   `MW.decor.qualityLabel()` / `MW.decor.cycleQuality()` (menu pause). Si ce fichier est absent ou plante, le monde de base reste affiché. */
const MWD=(()=>{
const T=THREE,PI=Math.PI;
const D={T,PI,city:null,garages:null};
const clamp01=x=>x<0?0:x>1?1:x;
const sm=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
D.sm=sm;D.lerp=lerp;
/* hasard déterministe */
D.rng=seed=>{let s=seed|0;return()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
const hashS=s=>{let h=7;for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0;return h;};

/* ═══════════ Textures (canvas) ═══════════ */
const canv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function grain(x,w,h,amt,r){const im=x.getImageData(0,0,w,h),d=im.data;for(let i=0;i<d.length;i+=4){const n=(r()-.5)*amt;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}x.putImageData(im,0,0);}
function blobs(x,w,h,n,rmin,rmax,col,a,r){for(let i=0;i<n;i++){const px=r()*w,py=r()*h,rr=rmin+r()*(rmax-rmin);
 for(const ox of [-w,0,w])for(const oy of [-h,0,h]){const cx=px+ox,cy=py+oy;if(cx<-rr||cx>w+rr||cy<-rr||cy>h+rr) continue;
  const g=x.createRadialGradient(cx,cy,0,cx,cy,rr);g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(1,`rgba(${col},0)`);x.fillStyle=g;x.fillRect(cx-rr,cy-rr,rr*2,rr*2);}}}
const rgb=(h,s,l)=>`hsl(${h},${s}%,${l}%)`;
const GEN={
 asph(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(11);x.fillStyle='#46494e';x.fillRect(0,0,w,w);
  for(let i=0;i<4;i++){x.fillStyle=`rgba(${r()<.5?'20,20,22':'90,92,96'},.10)`;const a=r()*180,b=r()*180;x.fillRect(a,b,40+r()*70,30+r()*60);}
  blobs(x,w,w,14,10,40,'20,20,24',.18,r);grain(x,w,w,34,r);
  for(let i=0;i<500;i++){x.fillStyle=r()<.5?'rgba(150,150,150,.35)':'rgba(10,10,10,.35)';x.fillRect(r()*w,r()*w,1+r()*1.2,1+r()*1.2);}
  x.strokeStyle='rgba(15,15,15,.55)';x.lineWidth=1;for(let i=0;i<4;i++){x.beginPath();let px=r()*w,py=r()*w;x.moveTo(px,py);for(let k=0;k<6;k++){px+=r()*30-15;py+=r()*30-15;x.lineTo(px,py);}x.stroke();}
  return c;},
 walk(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(12);x.fillStyle='#bcbab3';x.fillRect(0,0,w,w);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){const v=Math.floor(r()*18-9);x.fillStyle=`rgb(${188+v},${186+v},${179+v})`;x.fillRect(i*64+1,j*64+1,62,62);}
  x.fillStyle='#8a8880';for(let i=0;i<=4;i++){x.fillRect(i*64-1,0,2,w);x.fillRect(0,i*64-1,w,2);}
  blobs(x,w,w,10,6,26,'60,58,54',.10,r);grain(x,w,w,18,r);
  for(let i=0;i<30;i++){x.fillStyle='rgba(70,66,60,.5)';x.fillRect(r()*w,r()*w,2,2);}return c;},
 paving(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(13);x.fillStyle='#8f8a82';x.fillRect(0,0,w,w);
  for(let j=0;j<8;j++)for(let i=0;i<8;i++){const o=(j%2)*16,v=Math.floor(r()*30-15);x.fillStyle=`rgb(${168+v},${158+v},${146+v})`;x.fillRect(((i*32+o)%w)+1,j*32+1,30,30);if((i*32+o)>=w-32+1) x.fillRect(1-32+((i*32+o)%w),j*32+1,30,30);}
  grain(x,w,w,16,r);return c;},
 plaster(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(14);x.fillStyle='#e9e6dd';x.fillRect(0,0,w,w);
  blobs(x,w,w,26,12,50,'120,110,95',.07,r);grain(x,w,w,15,r);
  for(let i=0;i<14;i++){const px=r()*w,g=x.createLinearGradient(0,0,0,w);g.addColorStop(0,'rgba(80,70,60,0)');g.addColorStop(.6,'rgba(80,70,60,.09)');g.addColorStop(1,'rgba(80,70,60,0)');x.fillStyle=g;x.fillRect(px,0,2+r()*3,w);}return c;},
 brick(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(15);x.fillStyle='#b9afa0';x.fillRect(0,0,w,w);
  const rows=24,bh=w/rows,cols=11,bw=w/cols;
  for(let j=0;j<rows;j++)for(let i=-1;i<cols;i++){const o=(j%2)*bw/2;x.fillStyle=rgb(8+r()*14,38+r()*16,34+r()*14);x.fillRect(i*bw+o+1,j*bh+1,bw-2,bh-2);}
  grain(x,w,w,22,r);return c;},
 stone(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(16);x.fillStyle='#b8ae98';x.fillRect(0,0,w,w);
  const rows=6,bh=w/rows;for(let j=0;j<rows;j++){let px=-r()*60;while(px<w){const bw=50+r()*50,v=Math.floor(r()*22-11);x.fillStyle=`rgb(${226+v},${218+v},${198+v})`;x.fillRect(px+1.5,j*bh+1.5,bw-3,bh-3);px+=bw;}}
  blobs(x,w,w,16,8,30,'110,100,80',.07,r);grain(x,w,w,16,r);return c;},
 tiles(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(17);x.fillStyle='#6a3322';x.fillRect(0,0,w,w);
  const rows=14,bh=w/rows,cols=12,bw=w/cols;
  for(let j=0;j<rows;j++)for(let i=-1;i<cols;i++){const o=(j%2)*bw/2;x.fillStyle=rgb(12+r()*10,52+r()*14,34+r()*12);x.beginPath();x.moveTo(i*bw+o+1,j*bh);x.lineTo(i*bw+o+bw-1,j*bh);x.lineTo(i*bw+o+bw-1,j*bh+bh*.7);x.quadraticCurveTo(i*bw+o+bw/2,j*bh+bh*1.25,i*bw+o+1,j*bh+bh*.7);x.fill();
   const g=x.createLinearGradient(0,j*bh,0,j*bh+bh);g.addColorStop(0,'rgba(0,0,0,.28)');g.addColorStop(.5,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.25)');x.fillStyle=g;x.fillRect(i*bw+o,j*bh,bw,bh);}
  grain(x,w,w,18,r);return c;},
 roofflat(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(18);x.fillStyle='#6a6a66';x.fillRect(0,0,w,w);blobs(x,w,w,12,10,40,'30,30,30',.2,r);blobs(x,w,w,8,10,30,'140,140,130',.12,r);grain(x,w,w,40,r);return c;},
 conc(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(19);x.fillStyle='#9c9d9c';x.fillRect(0,0,w,w);blobs(x,w,w,20,10,50,'60,60,60',.08,r);grain(x,w,w,22,r);return c;},
 floorconc(){const w=512,c=canv(w,w),x=c.getContext('2d'),r=D.rng(20);x.fillStyle='#8c8e8f';x.fillRect(0,0,w,w);blobs(x,w,w,40,14,70,'70,72,74',.10,r);grain(x,w,w,26,r);
  blobs(x,w,w,7,12,34,'18,14,10',.5,r);blobs(x,w,w,12,5,14,'14,10,8',.45,r);blobs(x,w,w,5,30,60,'30,26,22',.16,r);
  x.strokeStyle='rgba(30,30,30,.55)';x.lineWidth=2;x.strokeRect(0,0,w,w);x.beginPath();x.moveTo(w/2,0);x.lineTo(w/2,w);x.moveTo(0,w/2);x.lineTo(w,w/2);x.lineWidth=1.2;x.stroke();
  x.strokeStyle='rgba(20,20,20,.4)';x.lineWidth=1.5;for(let i=0;i<5;i++){x.beginPath();let px=r()*w,py=r()*w;x.moveTo(px,py);for(let k=0;k<5;k++){px+=r()*40-20;py+=r()*40-20;x.lineTo(px,py);}x.stroke();}return c;},
 floortile(){const w=512,c=canv(w,w),x=c.getContext('2d'),r=D.rng(21);x.fillStyle='#cfc8b6';x.fillRect(0,0,w,w);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){const v=Math.floor(r()*10-5);x.fillStyle=`rgb(${236+v},${231+v},${219+v})`;x.fillRect(i*128+2,j*128+2,124,124);
   const g=x.createLinearGradient(i*128,j*128,i*128+128,j*128+128);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(120,110,90,.12)');x.fillStyle=g;x.fillRect(i*128+2,j*128+2,124,124);
   x.strokeStyle='rgba(150,140,120,.22)';x.lineWidth=1;for(let k=0;k<3;k++){x.beginPath();let px=i*128+r()*124,py=j*128+r()*124;x.moveTo(px,py);x.bezierCurveTo(px+30,py+20,px+60,py+60,px+r()*80,py+r()*120);x.stroke();}}
  grain(x,w,w,8,r);return c;},
 epoxy(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(22);x.fillStyle='#b5b8bb';x.fillRect(0,0,w,w);blobs(x,w,w,24,12,50,'255,255,255',.12,r);blobs(x,w,w,18,8,40,'80,84,90',.12,r);grain(x,w,w,12,r);
  x.strokeStyle='rgba(60,60,60,.18)';x.lineWidth=1.5;for(let i=0;i<8;i++){x.beginPath();let px=r()*w,py=r()*w;x.moveTo(px,py);x.quadraticCurveTo(px+r()*80-40,py+r()*80-40,px+r()*120-60,py+r()*120-60);x.stroke();}
  x.fillStyle='rgba(40,40,40,.35)';x.fillRect(0,0,w,1.5);x.fillRect(0,0,1.5,w);return c;},
 ceil(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(23);x.fillStyle='#f2f2ee';x.fillRect(0,0,w,w);x.fillStyle='#c4c4c0';for(let i=0;i<=2;i++){x.fillRect(i*128-1,0,2,w);x.fillRect(0,i*128-1,w,2);}grain(x,w,w,8,r);blobs(x,w,w,6,10,30,'150,150,150',.05,r);return c;},
 wood(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(24);for(let j=0;j<8;j++){x.fillStyle=rgb(28+r()*8,40+r()*14,34+r()*10);x.fillRect(0,j*32,w,32);x.fillStyle='rgba(30,16,6,.5)';x.fillRect(0,j*32,w,1.5);
   for(let k=0;k<8;k++){x.strokeStyle=`rgba(40,22,8,${.1+r()*.15})`;x.beginPath();const py=j*32+r()*32;x.moveTo(0,py);x.bezierCurveTo(w*.3,py+r()*5-2.5,w*.6,py+r()*5-2.5,w,py);x.stroke();}}
  grain(x,w,w,12,r);return c;},
 grass(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(25);x.fillStyle='#5e8c3c';x.fillRect(0,0,w,w);blobs(x,w,w,40,12,50,'100,140,50',.2,r);blobs(x,w,w,30,10,40,'50,90,40',.2,r);blobs(x,w,w,10,14,40,'150,140,70',.12,r);
  for(let i=0;i<1400;i++){x.fillStyle=r()<.5?'rgba(40,80,30,.4)':'rgba(130,170,70,.4)';x.fillRect(r()*w,r()*w,1,2+r()*3);}grain(x,w,w,14,r);return c;},
 gravel(){const w=256,c=canv(w,w),x=c.getContext('2d'),r=D.rng(26);x.fillStyle='#8f8a80';x.fillRect(0,0,w,w);blobs(x,w,w,24,10,40,'60,56,50',.14,r);
  for(let i=0;i<2600;i++){const v=Math.floor(90+r()*120);x.fillStyle=`rgba(${v},${v-4},${v-14},.75)`;const s=1+r()*2.6;x.fillRect(r()*w,r()*w,s,s*(.7+r()*.5));}grain(x,w,w,18,r);return c;},
 hazard(){const w=64,c=canv(w,w),x=c.getContext('2d');x.fillStyle='#f2c200';x.fillRect(0,0,w,w);x.fillStyle='#1c1c1c';for(let i=-2;i<5;i++){x.beginPath();x.moveTo(i*24,0);x.lineTo(i*24+12,0);x.lineTo(i*24+12+w,w);x.lineTo(i*24+w,w);x.fill();}return c;},
 glow(){const w=128,c=canv(w,w),x=c.getContext('2d'),g=x.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'rgba(255,214,140,1)');g.addColorStop(.35,'rgba(255,190,110,.45)');g.addColorStop(1,'rgba(255,170,90,0)');x.fillStyle=g;x.fillRect(0,0,w,w);return c;},
 /* fenêtres : cadre blanc + vitrage reflétant le ciel */
 tl2(){return GEN.tl();},
 win(){return winTex(false);},winlit(){return winTex(true);},
 shop(){const w=256,h=128,c=canv(w,h),x=c.getContext('2d'),r=D.rng(27);
  let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#fff0c8');g.addColorStop(1,'#d8a860');x.fillStyle=g;x.fillRect(0,0,w,h);
  for(let k=0;k<3;k++){x.fillStyle=k%2?'#8a5a2a':'#6a4a2a';x.fillRect(10,24+k*34,w-20,4);
   for(let i=0;i<9;i++){x.fillStyle=rgb(r()*360,45,50+r()*20);x.fillRect(14+i*26+r()*4,4+k*34+8+r()*4,16+r()*6,20-r()*6);}}
  g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(190,220,255,.50)');g.addColorStop(.45,'rgba(190,220,255,.10)');g.addColorStop(.5,'rgba(255,255,255,.32)');g.addColorStop(.58,'rgba(255,255,255,.05)');g.addColorStop(1,'rgba(40,70,110,.38)');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.fillStyle='#3a3c40';x.fillRect(0,0,w,4);x.fillRect(0,h-6,w,6);x.fillRect(0,0,4,h);x.fillRect(w-4,0,4,h);x.fillRect(w/2-2,0,4,h);return c;},
 office(){const w=128,h=128,c=canv(w,h),x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#9cc8ea');g.addColorStop(.4,'#4f86b4');g.addColorStop(.55,'#c8e4f6');g.addColorStop(.62,'#4a7aa6');g.addColorStop(1,'#1f3f60');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.fillStyle='rgba(255,255,255,.18)';x.fillRect(0,h*.45,w,h*.07);x.fillStyle='#2a3038';x.fillRect(0,0,w,3);x.fillRect(0,h-3,w,3);x.fillRect(0,0,3,h);x.fillRect(w-3,0,3,h);return c;},
 officelit(){const w=128,h=128,c=canv(w,h),x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#fff4cc');g.addColorStop(1,'#e8c070');x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='rgba(120,90,50,.35)';x.fillRect(10,h*.55,40,h*.25);x.fillRect(70,h*.5,30,h*.3);
  x.fillStyle='#2a3038';x.fillRect(0,0,w,3);x.fillRect(0,h-3,w,3);x.fillRect(0,0,3,h);x.fillRect(w-3,0,3,h);return c;},
 tl(){const w=128,h=96,c=canv(w,h),x=c.getContext('2d');
  for(let s=0;s<4;s++){x.fillStyle='#1b1d20';x.fillRect(s*32,0,32,h);x.fillStyle='#2c2f33';x.fillRect(s*32+3,3,26,h-6);
   const cols=['#46ff7a','#ffb02a','#ff3a2a'],dim=['#16301c','#33260a','#3a1210'];
   for(let k=0;k<3;k++){const on=(s===2?k===2:s===1?k===1:s===0?k===0:false),cx=s*32+16,cy=18+k*30;
    x.fillStyle=on?cols[k]:dim[k];x.beginPath();x.arc(cx,cy,10,0,7);x.fill();
    if(on){const g=x.createRadialGradient(cx,cy,2,cx,cy,15);g.addColorStop(0,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(cx-15,cy-15,30,30);}}}
  return c;},
 tsign(){const w=256,h=128,c=canv(w,h),x=c.getContext('2d');
  const cell=(i,fn)=>{x.save();x.translate(i*64,0);fn();x.restore();};
  cell(0,()=>{x.fillStyle='#fff';x.beginPath();for(let k=0;k<8;k++){const a=PI/8+k*PI/4;x.lineTo(32+Math.cos(a)*30,32+Math.sin(a)*30);}x.fill();x.fillStyle='#c4161c';x.beginPath();for(let k=0;k<8;k++){const a=PI/8+k*PI/4;x.lineTo(32+Math.cos(a)*26,32+Math.sin(a)*26);}x.fill();x.fillStyle='#fff';x.font='bold 17px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('STOP',32,33);});
  cell(1,()=>{x.fillStyle='#c4161c';x.beginPath();x.arc(32,32,30,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(32,32,22,0,7);x.fill();x.fillStyle='#111';x.font='bold 26px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('30',32,34);});
  cell(2,()=>{x.fillStyle='#c4161c';x.beginPath();x.arc(32,32,30,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(32,32,22,0,7);x.fill();x.fillStyle='#111';x.font='bold 26px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('50',32,34);});
  cell(3,()=>{x.fillStyle='#fff';x.fillRect(4,4,56,56);x.fillStyle='#e8b800';x.save();x.translate(32,32);x.rotate(PI/4);x.fillRect(-20,-20,40,40);x.restore();});
  cell(0,()=>{});x.save();x.translate(0,64);
  x.fillStyle='#1f5fb4';x.fillRect(4,4,56,56);x.fillStyle='#fff';x.font='bold 40px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('P',32,34);
  x.translate(64,0);x.fillStyle='#1f5fb4';x.fillRect(4,4,56,56);x.fillStyle='#fff';x.beginPath();x.moveTo(32,10);x.lineTo(54,52);x.lineTo(10,52);x.closePath();x.fill();x.fillStyle='#111';x.fillRect(28,26,8,16);x.fillRect(28,44,8,4);
  x.translate(64,0);x.fillStyle='#fff';x.fillRect(4,4,56,56);x.strokeStyle='#c4161c';x.lineWidth=5;x.strokeRect(6,6,52,52);x.beginPath();x.moveTo(10,10);x.lineTo(54,54);x.stroke();
  x.translate(64,0);x.fillStyle='#2a6a3a';x.fillRect(2,16,60,32);x.fillStyle='#fff';x.font='bold 13px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('CENTRE',32,32);
  x.restore();return c;},
 fence(){const w=64,c=canv(w,w),x=c.getContext('2d');x.strokeStyle='rgba(205,210,214,1)';x.lineWidth=5;for(let i=-w;i<w*2;i+=32){x.beginPath();x.moveTo(i,0);x.lineTo(i+w,w);x.stroke();x.beginPath();x.moveTo(i+w,0);x.lineTo(i,w);x.stroke();}return c;},
 toolpanel(){return toolPanelTex();},
 posters(){return posterAtlas();},
 chest(){const w=128,h=128,c=canv(w,h),x=c.getContext('2d');x.fillStyle='#b3201a';x.fillRect(0,0,w,h);
  for(let i=0;i<5;i++){const y0=6+i*24;let g=x.createLinearGradient(0,y0,0,y0+20);g.addColorStop(0,'#d03a2e');g.addColorStop(1,'#962018');x.fillStyle=g;x.fillRect(6,y0,w-12,20);x.fillStyle='#d8dadc';x.fillRect(34,y0+6,w-68,4);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(6,y0+20,w-12,3);}
  x.strokeStyle='rgba(0,0,0,.4)';x.strokeRect(1,1,w-2,h-2);return c;},
 signs(){return shopSigns();},
 cardboard(){const w=64,c=canv(w,w),x=c.getContext('2d'),r=D.rng(28);x.fillStyle='#b8905a';x.fillRect(0,0,w,w);grain(x,w,w,26,r);x.fillStyle='#e8dcc0';x.fillRect(10,14,26,16);x.fillStyle='#222';x.fillRect(13,18,18,2);x.fillRect(13,23,12,2);x.fillStyle='rgba(120,90,50,.7)';x.fillRect(0,w/2-2,w,4);return c;}
};
function winTex(lit){const w=128,h=192,c=canv(w,h),x=c.getContext('2d');
 x.fillStyle='#f3f1ec';x.fillRect(0,0,w,h);
 const gx=11,gy=11,gw=w-22,gh=h-22;
 if(!lit){const g=x.createLinearGradient(gx,gy,gx+gw,gy+gh);g.addColorStop(0,'#a9cbe6');g.addColorStop(.35,'#5f88ac');g.addColorStop(.7,'#34506b');g.addColorStop(1,'#26384b');x.fillStyle=g;x.fillRect(gx,gy,gw,gh);
  x.fillStyle='rgba(255,255,255,.2)';x.beginPath();x.moveTo(gx,gy+gh*.55);x.lineTo(gx+gw*.6,gy);x.lineTo(gx+gw*.85,gy);x.lineTo(gx,gy+gh*.8);x.fill();}
 else{const g=x.createLinearGradient(0,gy,0,gy+gh);g.addColorStop(0,'#ffe8a8');g.addColorStop(1,'#f0b860');x.fillStyle=g;x.fillRect(gx,gy,gw,gh);
  x.fillStyle='rgba(150,100,60,.55)';x.fillRect(gx,gy,18,gh);x.fillRect(gx+gw-18,gy,18,gh);x.fillStyle='rgba(110,70,40,.4)';x.fillRect(gx+30,gy+gh*.55,gw-60,gh*.45);}
 x.fillStyle=lit?'#d8d2c4':'#f3f1ec';x.fillRect(w/2-3,gy,6,gh);x.fillRect(gx,gy+gh*.34,gw,5);
 x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;x.strokeRect(1,1,w-2,h-2);x.strokeRect(gx,gy,gw,gh);return c;}
const SHOPS=[['BOULANGERIE','#f0d9a0','#7a3a10'],['PHARMACIE','#e8f4ea','#1c8a3a'],['TABAC PRESSE','#8a1a1a','#fff'],['CAFÉ DU PORT','#1c3a2a','#f0d890'],['FLEURISTE','#f6d8e4','#a02a5a'],['COIFFURE','#2a2a3a','#f0c0d0'],['BOUCHERIE','#a82a2a','#fff'],['OPTIQUE','#d8e8f4','#1a3a6a'],
 ['SUPÉRETTE','#2a6aa8','#fff'],['LIBRAIRIE','#f2ead0','#4a2a1a'],['PIZZERIA','#c8281c','#fff'],['LAVERIE','#b8e0f0','#1a4a7a'],['IMMOBILIER','#1a2a4a','#e8c860'],['ASSURANCES','#2a8a8a','#fff'],['QUINCAILLERIE','#f0b020','#222'],['BAR LE NORD','#2a1a14','#f0a030'],
 ['PRESSING','#e0e0f0','#2a3a8a'],['FRIPERIE','#d86a30','#fff'],['CRÊPERIE','#f4e0b8','#8a3a1a'],['MARCHÉ BIO','#3a8a3a','#fff'],['VÉLOS','#f0f0f0','#c02a1a'],['PHOTO EXPRESS','#202030','#ffd040'],['JOUETS','#f06a8a','#fff'],['CAVE À VINS','#4a1a2a','#f0d890'],
 ['TÉLÉPHONIE','#14161c','#40c0ff'],['SALON DE THÉ','#e8dcf0','#5a2a7a'],['BANQUE POPULAIRE','#1a3a6a','#fff'],['PÂTISSERIE','#f6e0e8','#a03a5a'],['MAISON DE LA PRESSE','#f4f0e0','#222'],['TRAITEUR','#c8a060','#fff'],['CORDONNERIE','#4a2a1a','#f0d8a0'],['GALERIE D\'ART','#f0f0f0','#222']];
function shopSigns(){const c=canv(1024,512),x=c.getContext('2d');
 SHOPS.forEach((s,i)=>{const cx=(i%4)*256,cy=Math.floor(i/4)*64;x.fillStyle=s[1];x.fillRect(cx,cy,256,64);x.strokeStyle=s[2];x.lineWidth=2;x.strokeRect(cx+4,cy+4,248,56);
  let f=30;x.font='bold '+f+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';while(x.measureText(s[0]).width>226&&f>12){f-=2;x.font='bold '+f+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';}
  x.fillStyle=s[2];x.textAlign='center';x.textBaseline='middle';x.fillText(s[0],cx+128,cy+34);});return c;}
D.signCell=i=>{i=i%32;const c=i%4,r=Math.floor(i/4);return [c/4,1-(r+1)/8,(c+1)/4,1-r/8];};
function toolPanelTex(){const w=512,h=256,c=canv(w,h),x=c.getContext('2d'),r=D.rng(29);
 x.fillStyle='#8e949a';x.fillRect(0,0,w,h);x.fillStyle='rgba(30,30,30,.55)';for(let i=6;i<w;i+=14)for(let j=6;j<h;j+=14){x.beginPath();x.arc(i,j,1.6,0,7);x.fill();}
 const sh=(px,py,fn)=>{x.save();x.translate(px+3,py+3);x.fillStyle='rgba(0,0,0,.30)';fn(true);x.restore();x.save();x.translate(px,py);fn(false);x.restore();};
 const spanner=(px,py,len,col)=>sh(px,py,sh0=>{x.fillStyle=sh0?'rgba(0,0,0,.3)':col;x.fillRect(0,0,10,len);x.beginPath();x.arc(5,0,12,0,7);x.arc(5,len,12,0,7);x.fill();x.fillStyle='#8e949a';if(!sh0){x.fillRect(1,-14,8,10);x.fillRect(1,len+4,8,10);}});
 let px=24;for(let i=0;i<8;i++){spanner(px,40,90+i*9,'#cfd3d6');px+=30;}
 for(let i=0;i<6;i++) sh(300+i*26,40,s=>{x.fillStyle=s?'rgba(0,0,0,.3)':'#d6d8da';x.fillRect(0,0,6,70+i*6);x.fillStyle=s?'rgba(0,0,0,.3)':(i%2?'#d8a020':'#c02a20');x.fillRect(-4,70+i*6,14,36);});
 for(let i=0;i<3;i++) sh(40+i*60,170,s=>{x.fillStyle=s?'rgba(0,0,0,.3)':'#7a4a2a';x.fillRect(0,0,12,60);x.fillStyle=s?'rgba(0,0,0,.3)':'#2a2a2e';x.fillRect(-12,-8,36,24);});
 for(let i=0;i<3;i++) sh(240+i*52,175,s=>{x.fillStyle=s?'rgba(0,0,0,.3)':(i===1?'#d8a020':'#c02a20');x.fillRect(0,0,12,34);x.fillRect(-12,0,12,18);x.fillRect(12,0,12,18);x.fillStyle=s?'rgba(0,0,0,.3)':'#222';x.fillRect(0,34,12,42);});
 sh(410,170,s=>{x.fillStyle=s?'rgba(0,0,0,.3)':'#c8ccd0';x.fillRect(0,0,70,12);x.fillStyle=s?'rgba(0,0,0,.3)':'#6a3a1a';x.fillRect(-26,-4,26,20);});
 x.strokeStyle='#1c1c1e';x.lineWidth=6;x.strokeRect(3,3,w-6,h-6);return c;}
function posterAtlas(){const w=512,h=256,c=canv(w,h),x=c.getContext('2d');
 const P=(i,bg,fn)=>{x.save();x.translate(i*128,0);x.fillStyle=bg;x.fillRect(0,0,128,256);fn();x.strokeStyle='rgba(0,0,0,.5)';x.lineWidth=3;x.strokeRect(1.5,1.5,125,253);x.restore();};
 const T1=(t,px,py,f,col)=>{x.fillStyle=col||'#fff';x.font='bold '+f+'px Arial';x.textAlign='center';x.fillText(t,px,py);};
 P(0,'#14243e',()=>{T1('SUPER',64,40,26,'#ffd02a');T1('SPORT',64,66,26,'#ffd02a');x.fillStyle='#c01818';x.fillRect(16,110,96,26);x.fillRect(30,92,60,22);x.fillStyle='#222';x.beginPath();x.arc(36,140,10,0,7);x.arc(92,140,10,0,7);x.fill();T1('0-100 en 3,2 s',64,190,13);});
 P(1,'#f2d200',()=>{x.fillStyle='#111';x.beginPath();x.arc(64,80,40,0,7);x.fill();x.fillStyle='#f2d200';x.beginPath();x.arc(64,80,18,0,7);x.fill();T1('PIRELLO',64,170,24,'#111');T1('adhérence',64,196,14,'#111');});
 P(2,'#1f6b3a',()=>{x.fillStyle='#fff';x.fillRect(34,40,60,90);x.fillStyle='#1f6b3a';x.fillRect(46,60,36,50);T1('VISCOL',64,170,24);T1('5W-30',64,198,16,'#ffd02a');});
 P(3,'#e8e4d4',()=>{T1('SÉCURITÉ',64,36,19,'#b01010');x.fillStyle='#b01010';x.fillRect(14,50,100,4);for(let i=0;i<6;i++){x.fillStyle='#222';x.fillRect(18,70+i*28,12,12);x.fillRect(38,72+i*28,70,8);}});
 return c;}
const TXC={};
D.tex=name=>{if(TXC[name]) return TXC[name];const c=GEN[name]();const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;t.userData={lin:1};
 if(!['tl2','signs','win','winlit','shop','office','officelit','tl','tsign','toolpanel','posters','chest','cardboard','glow','fence'].includes(name)){t.wrapS=t.wrapT=T.RepeatWrapping;}
 else{t.wrapS=t.wrapT=T.ClampToEdgeWrapping;}
 TXC[name]=t;return t;};
/* canvas libres (enseignes) */
D.canvasTex=(w,h,fn)=>{const c=canv(w,h);fn(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;t.userData={lin:1};return t;};

/* ═══════════ Matériaux ═══════════ */
const MDEF={
 asph:{map:'asph',ts:8,recv:1},walk:{map:'walk',ts:3,recv:1},paving:{map:'paving',ts:2.4,recv:1},
 plaster:{map:'plaster',ts:4,cast:1,recv:1},brick:{map:'brick',ts:2.4,cast:1,recv:1},stone:{map:'stone',ts:3,cast:1,recv:1},conc:{map:'conc',ts:4,cast:1,recv:1},
 tiles:{map:'tiles',ts:2,cast:1,recv:1,side:2},roofflat:{map:'roofflat',ts:4,cast:1,recv:1},
 floorconc:{map:'floorconc',ts:6,recv:1},floortile:{map:'floortile',ts:4.8,recv:1},epoxy:{map:'epoxy',ts:5,recv:1},ceil:{map:'ceil',ts:2.4,recv:1},
 wood:{map:'wood',ts:1.4,cast:1,recv:1},grass:{map:'grass',ts:6,recv:1},gravel:{map:'gravel',ts:3,recv:1},hazard:{map:'hazard',ts:.8,recv:1},
 plain:{cast:1,recv:1},mark:{recv:1,poly:-2},
 win:{map:'win',ts:1},win0:{map:'win',emap:'winlit',emis:1,ts:1},win1:{map:'win',emap:'winlit',emis:1,ts:1},win2:{map:'win',emap:'winlit',emis:1,ts:1},win3:{map:'win',emap:'winlit',emis:1,ts:1},
 shop:{map:'shop',emis:1,ts:1},office:{map:'office',ts:1},officelit:{map:'office',emap:'officelit',emis:1,ts:1},
 tlA:{map:'tl',emis:1,ts:1},tlB:{map:'tl2',emis:1,ts:1},
 glass:{opts:{transparent:true,opacity:.30,depthWrite:false},ts:1},
 neon:{basic:1},lamph:{emisCol:0xffe6a0,ts:1},glowm:{map:'glow',basic:1,opts:{transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:0}},
 tsign:{map:'tsign',opts:{alphaTest:.5,side:T.DoubleSide},ts:1},fence:{map:'fence',opts:{alphaTest:.4,side:T.DoubleSide},ts:1},
 toolpanel:{map:'toolpanel',ts:1,recv:1},posters:{map:'posters',ts:1},chest:{map:'chest',ts:1,cast:1},cardboard:{map:'cardboard',ts:.5,cast:1},
 car:{cast:1,recv:1},signs:{map:'signs',emis:1,ts:1}};
const MT={};
D.mat=name=>{if(MT[name]) return MT[name];const d=MDEF[name];if(!d) throw new Error('matériau inconnu '+name);
 const o={vertexColors:true,color:0xffffff};if(d.map){o.map=D.tex(d.map);}
 if(d.emis){o.emissive=0xffffff;o.emissiveMap=d.emap?D.tex(d.emap):o.map;o.emissiveIntensity=0;}
 if(d.emisCol){o.emissive=d.emisCol;o.emissiveIntensity=0;}
 if(d.side===2) o.side=T.DoubleSide;
 if(d.opts) Object.assign(o,d.opts);
 if(d.poly){o.polygonOffset=true;o.polygonOffsetFactor=d.poly;o.polygonOffsetUnits=d.poly;}
 const m=d.basic?new T.MeshBasicMaterial(o):new T.MeshLambertMaterial(o);
 m.userData={lin:1,ts:d.ts||4,cast:!!d.cast,recv:!!d.recv};MT[name]=m;return m;};

/* ═══════════ Fusion des géométries ═══════════ */
const CC=new Map(),_col=new T.Color();
const lincol=hex=>{let c=CC.get(hex);if(!c){_col.setHex(hex).convertSRGBToLinear();c=[_col.r,_col.g,_col.b];CC.set(hex,c);}return c;};
const GCACHE=new Map();
const gBox=new T.BoxGeometry(1,1,1);
const gCyl=(rt,rb,seg)=>{const k='c'+rt+'|'+rb+'|'+seg;let g=GCACHE.get(k);if(!g){g=new T.CylinderGeometry(rt,rb,1,seg);GCACHE.set(k,g);}return g;};
const gIco=det=>{const k='i'+det;let g=GCACHE.get(k);if(!g){g=new T.IcosahedronGeometry(1,det);GCACHE.set(k,g);}return g;};
const M4=new T.Matrix4(),Q4=new T.Quaternion(),E4=new T.Euler(),V3=new T.Vector3(),S3=new T.Vector3(),N3=new T.Matrix3(),PV=new T.Vector3(),NV=new T.Vector3();
const compose=(x,y,z,sx,sy,sz,ry,rx,rz)=>{E4.set(rx||0,ry||0,rz||0,'YXZ');Q4.setFromEuler(E4);return M4.compose(V3.set(x,y,z),Q4,S3.set(sx,sy,sz));};
class Batch{
 constructor(key,mat,layer){this.key=key;this.mat=mat;this.layer=layer;this.p=[];this.n=[];this.u=[];this.c=[];this.i=[];this.ts=mat.userData.ts||4;}
 /* ajoute une géométrie transformée par m ; own=true : garde les UV de la géométrie ; sinon projection monde (continu entre boîtes voisines) */
 add(g,m,col,own,uvr){
  const pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv,n=pa.count,base=this.p.length/3,cc=col==null?[1,1,1]:(typeof col==='number'?lincol(col):col),ts=this.ts,flip=m.determinant()<0;
  N3.getNormalMatrix(m);
  for(let i=0;i<n;i++){
   PV.fromBufferAttribute(pa,i).applyMatrix4(m);NV.fromBufferAttribute(na,i).applyMatrix3(N3).normalize();
   this.p.push(PV.x,PV.y,PV.z);this.n.push(NV.x,NV.y,NV.z);this.c.push(cc[0],cc[1],cc[2]);
   if(own){let u=ua?ua.getX(i):0,v=ua?ua.getY(i):0;if(uvr){u=uvr[0]+(uvr[2]-uvr[0])*u;v=uvr[1]+(uvr[3]-uvr[1])*v;}this.u.push(u,v);}
   else{const ax=Math.abs(NV.x),ay=Math.abs(NV.y),az=Math.abs(NV.z);
    if(ay>=ax&&ay>=az) this.u.push(PV.x/ts,PV.z/ts);else if(ax>=az) this.u.push(PV.z/ts,PV.y/ts);else this.u.push(PV.x/ts,PV.y/ts);}}
  if(g.index){const ix=g.index.array;if(flip) for(let i=0;i<ix.length;i+=3) this.i.push(base+ix[i],base+ix[i+2],base+ix[i+1]);else for(let i=0;i<ix.length;i++) this.i.push(base+ix[i]);}
  else if(flip) for(let i=0;i<n;i+=3) this.i.push(base+i,base+i+2,base+i+1);else for(let i=0;i<n;i++) this.i.push(base+i);
  return this;}
 box(w,h,d,x,y,z,col,ry,rx,rz){return this.add(gBox,compose(x,y,z,w,h,d,ry,rx,rz),col);}
 cyl(rt,rb,h,seg,x,y,z,col,rx,rz,ry){return this.add(gCyl(rt,rb,seg||10),compose(x,y,z,1,h,1,ry,rx,rz),col);}
 sph(ax,ay,az,det,x,y,z,col,ry){return this.add(gIco(det),compose(x,y,z,ax,ay,az,ry||0),col);}
 /* plan vertical/oblique : largeur w, hauteur h, face vers +z tourné de ry (puis penché de rx) ; uvr = [u0,v0,u1,v1] dans l'atlas */
 quad(w,h,x,y,z,ry,col,uvr,rx,dbl){const g=QUAD;this.add(g,compose(x,y,z,w,h,1,ry,rx||0,0),col,true,uvr);
  if(dbl) this.add(g,compose(x,y,z,w,h,1,(ry||0)+PI,rx?-rx:0,0),col,true,uvr);return this;}
 /* triangle avec normale orientée selon hint */
 tri(a,b,c,col,uv,hint){const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  let nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0];const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
  let flip=false;if(hint&&nx*hint[0]+ny*hint[1]+nz*hint[2]<0){flip=true;nx=-nx;ny=-ny;nz=-nz;}
  const cc=col==null?[1,1,1]:(typeof col==='number'?lincol(col):col),base=this.p.length/3,vs=flip?[a,c,b]:[a,b,c],us=uv?(flip?[uv[0],uv[2],uv[1]]:uv):[[0,0],[1,0],[0,1]];
  for(let k=0;k<3;k++){this.p.push(vs[k][0],vs[k][1],vs[k][2]);this.n.push(nx,ny,nz);this.c.push(cc[0],cc[1],cc[2]);this.u.push(us[k][0],us[k][1]);}
  this.i.push(base,base+1,base+2);return this;}
 /* quadrilatère a,b,c,d (dans l'ordre du contour) */
 quadP(a,b,c,d,col,uv,hint){this.tri(a,b,c,col,uv&&[uv[0],uv[1],uv[2]],hint);this.tri(a,c,d,col,uv&&[uv[0],uv[2],uv[3]],hint);return this;}
}
/* constructeur en repère local : tourné de ry autour de (x,z), base à y0 ; le +z local pointe vers (sin ry, cos ry) */
D.L=(b,x,z,ry,y0)=>{const C=Math.cos(ry||0),S=Math.sin(ry||0),Y=y0||0,w=(lx,lz)=>[x+lx*C+lz*S,z-lx*S+lz*C];
 return {b,w,
  box:(sx,sy,sz,lx,ly,lz,c)=>{const p=w(lx,lz);b.box(sx,sy,sz,p[0],Y+ly,p[1],c,ry);},
  cyl:(rt,rb,h,seg,lx,ly,lz,c)=>{const p=w(lx,lz);b.cyl(rt,rb,h,seg,p[0],Y+ly,p[1],c,0,0,ry);},
  sph:(ax,ay,az,det,lx,ly,lz,c)=>{const p=w(lx,lz);b.sph(ax,ay,az,det,p[0],Y+ly,p[1],c,ry);},
  quad:(sw,sh,lx,ly,lz,c,uvr,rx,dbl)=>{const p=w(lx,lz);b.quad(sw,sh,p[0],Y+ly,p[1],ry,c,uvr,rx,dbl);},
  rcyl:(rt,rb,h,seg,lx,ly,lz,c,rrx,rrz)=>{const p=w(lx,lz);b.cyl(rt,rb,h,seg,p[0],Y+ly,p[1],c,rrx,rrz,ry);},
  rbox:(sx,sy,sz,lx,ly,lz,c,rry,rrx,rrz)=>{const p=w(lx,lz);b.box(sx,sy,sz,p[0],Y+ly,p[1],c,(ry||0)+(rry||0),rrx,rrz);}};};
const QUAD=(()=>{const g=new T.PlaneGeometry(1,1);return g;})();
const BATCH=new Map();
D.B=(layer,mat)=>{const k=layer+':'+mat;let b=BATCH.get(k);if(!b){b=new Batch(k,D.mat(mat),layer);BATCH.set(k,b);}return b;};
function meshOf(b){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setAttribute('color',new T.Float32BufferAttribute(b.c,3));g.setIndex(b.i);g.computeBoundingSphere();
 const m=new T.Mesh(g,b.mat);m.name=b.key;m.castShadow=!!b.mat.userData.cast&&b.layer!=='far';m.receiveShadow=!!b.mat.userData.recv;
 if(b.mat.transparent) m.renderOrder=3;D.tris+=b.i.length/3;b.p=b.n=b.u=b.c=b.i=[];return m;}
D.tris=0;
D.finish=()=>{const out={core:new T.Group(),detail:new T.Group(),far:new T.Group()};
 for(const b of BATCH.values()){if(!b.p.length) continue;out[b.layer].add(meshOf(b));}
 BATCH.clear();return out;};
/* groupe indépendant (éléments ajoutés après la construction, ou mobiles) : fn(B) avec B(nomMatériau) → lot de géométries */
D.group=fn=>{const bs=new Map(),B=m=>{let b=bs.get(m);if(!b){b=new Batch('dyn:'+m,D.mat(m),'core');bs.set(m,b);}return b;};fn(B);
 const g=new T.Group();for(const b of bs.values()) if(b.p.length) g.add(meshOf(b));return g;};

/* ═══════════ Ciel, lumières, cycle jour / nuit ═══════════ */
const L3=hex=>new T.Color(hex).convertSRGBToLinear();
const K={nTop:L3(0x050a1e),nHor:L3(0x16213f),dTop:L3(0x3c7fd0),dHor:L3(0xbcd9f0),uTop:L3(0x4a5c9c),uHor:L3(0xf08a52),
 hsN:L3(0x6479b0),hsD:L3(0xbcd8ff),hgN:L3(0x1b1e2a),hgD:L3(0xa0a094),sunD:L3(0xfff0d6),sunU:L3(0xff9558),moon:L3(0x7f9cff),
 clD:L3(0xffffff),clU:L3(0xffb08c),clN:L3(0x2a3556)};
let skyMesh=null,skyU=null,Lx={};
const skyFrag=`varying vec3 vD;uniform vec3 uTop,uHor,uGlow,uSun,uMoon,uSunCol,uCl;uniform vec4 uK;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return n(p)*.5+n(p*2.03+3.1)*.27+n(p*4.1+7.7)*.15+n(p*8.3+1.3)*.08;}
void main(){vec3 d=normalize(vD);float y=d.y;
 vec3 col=mix(uHor,uTop,pow(clamp(y,0.,1.),.5));
 vec2 hd=normalize(d.xz+1e-5),hs=normalize(uSun.xz+1e-5);float az=max(dot(hd,hs),0.);
 col+=uGlow*pow(az,3.)*exp(-max(y,0.)*5.5)*uK.y;
 if(y<0.) col=mix(uHor,uHor*.8,clamp(-y*4.,0.,1.));
 float sd=max(dot(d,uSun),0.);
 col+=uSunCol*(smoothstep(.99935,.99965,sd)*5.+pow(sd,90.)*.45+pow(sd,7.)*.10*(1.-uK.x));
 float md=max(dot(d,uMoon),0.);col+=vec3(.82,.88,1.)*smoothstep(.9988,.9993,md)*1.6*uK.x+vec3(.25,.3,.5)*pow(md,60.)*.5*uK.x;
 if(uK.x>.02&&y>0.){vec2 sp=d.xz/(y+.3)*150.;vec2 id=floor(sp);float s=h(id);float dd=length(fract(sp)-vec2(.3+.4*h(id+9.),.3+.4*h(id+5.)));col+=vec3(.9,.95,1.)*step(.985,s)*(.35+.65*h(id+4.))*smoothstep(.22,.0,dd)*uK.x*smoothstep(0.,.25,y)*1.5;}
 if(y>0.&&uK.w>.01){vec2 cp=d.xz/(y*.85+.22)*1.5+vec2(uK.z*.010,uK.z*.003);float c=fbm(cp);c=smoothstep(.55-uK.w*.12,.80,c)*smoothstep(0.,.16,y);
  vec3 cc=uCl*(.74+.36*n(cp*2.3+vec2(2.,5.)));col=mix(col,cc,c*.92);}
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
}`;
function makeSky(){
 skyU={uTop:{value:new T.Color()},uHor:{value:new T.Color()},uGlow:{value:new T.Color()},uSun:{value:new T.Vector3(0,1,0)},uMoon:{value:new T.Vector3(0,-1,0)},uSunCol:{value:new T.Color()},uCl:{value:new T.Color()},uK:{value:new T.Vector4(0,0,0,.5)}};
 const m=new T.ShaderMaterial({uniforms:skyU,vertexShader:'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:skyFrag,side:T.BackSide,depthWrite:false,depthTest:false,fog:false});
 m.userData.lin=1;skyMesh=new T.Mesh(new T.SphereGeometry(440,28,16),m);skyMesh.frustumCulled=false;skyMesh.renderOrder=-1000;skyMesh.name='ciel';return skyMesh;}

/* ═══════════ Qualité ═══════════ */
const QS=['basse','moyenne','haute'],QKEY='bea.meca.q';
const QN={basse:'Basse',moyenne:'Moyenne',haute:'Haute'};
const Q={level:'moyenne',auto:true,soft:false,bad:0,n:0,sum:0,wait:90,msg:false};
function readQ(){try{const v=localStorage.getItem(QKEY);return QS.includes(v)?v:null;}catch(e){return null;}}
function autoLevel(){if(Q.soft) return 'basse';let ph=false;try{ph=isPhone();}catch(e){}if(ph) return 'basse';
 let low=false;try{low=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||8)<=4;}catch(e){}return low?'moyenne':'haute';}
let RN=null,CX=null,groups=null,fill=null;
D.setQuality=(lv,persist)=>{Q.level=lv;
 if(persist){Q.auto=false;try{localStorage.setItem(QKEY,lv);}catch(e){}}
 if(!RN||!CX) return;
 const dpr=window.devicePixelRatio||1;RN.setPixelRatio(Q.soft?.7:lv==='haute'?Math.min(dpr,1.5):lv==='moyenne'?Math.min(dpr,1.25):1);
 CX.sun.castShadow=lv==='haute';
 if(groups){groups.detail.visible=lv!=='basse';groups.far.visible=lv!=='basse';}
 if(skyU) skyU.uK.value.w=lv==='basse'?0:.5;
 for(const k in TXC) if(TXC[k].anisotropy!==(lv==='haute'?4:lv==='moyenne'?2:1)){TXC[k].anisotropy=lv==='haute'?4:lv==='moyenne'?2:1;TXC[k].needsUpdate=true;}
 if(CX.scene.fog){CX.scene.fog.near=lv==='basse'?45:60;CX.scene.fog.far=lv==='basse'?220:lv==='moyenne'?300:340;}
 try{if(MW.fit) MW.fit();}catch(e){}};
D.qualityLabel=()=>'Qualité graphique : '+QN[Q.level]+(Q.auto?' (auto)':'');
D.cycleQuality=()=>{const i=QS.indexOf(Q.level);D.setQuality(QS[(i+1)%3],true);};

/* ═══════════ Rendu, lumière, boucle ═══════════ */
D.renderer=R=>{RN=R;try{const gl=R.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');Q.soft=/swiftshader|llvmpipe|software|softpipe/i.test(e?String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)):'');}catch(err){}
 R.outputEncoding=T.sRGBEncoding;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=1.1;
 R.shadowMap.enabled=true;R.shadowMap.type=T.PCFShadowMap;};
const sunDir=new T.Vector3(),moonDir=new T.Vector3(),tmpC=new T.Color(),tmpC2=new T.Color(),lastTgt=new T.Vector3(1e9,0,1e9);
let TL={A:null,B:null},clock=0,lampMat=null,glowMat=null,zonesG=[];
D.registerTL=(a,b)=>{TL.A=a;TL.B=b;};
D.frame=(dt,t,h,P,quick)=>{
 if(!CX) return;
 let a;if(h>=6&&h<19) a=(h-6)/13*PI;else a=PI+(h>=19?h-19:h+5)/11*PI;
 const alt=Math.sin(a),dayF=sm(-.10,.30,alt),dusk=Math.exp(-Math.pow((alt-.03)/.17,2)),night=1-dayF;
 sunDir.set(Math.cos(a)*.9,Math.sin(a),.35).normalize();moonDir.copy(sunDir).multiplyScalar(-1);
 clock+=dt;
 const U=skyU;
 tmpC.copy(K.nTop).lerp(K.dTop,dayF).lerp(K.uTop,dusk*.55);U.uTop.value.copy(tmpC);
 tmpC.copy(K.nHor).lerp(K.dHor,dayF).lerp(K.uHor,dusk*.45);U.uHor.value.copy(tmpC);
 U.uGlow.value.copy(K.uHor).multiplyScalar(1.1);
 U.uSun.value.copy(sunDir);U.uMoon.value.copy(moonDir);
 U.uSunCol.value.copy(K.sunD).lerp(K.sunU,dusk).multiplyScalar(sm(-.08,.08,alt));
 U.uCl.value.copy(K.clN).lerp(K.clD,dayF).lerp(K.clU,dusk*.7);
 U.uK.value.set(night,dusk,clock,U.uK.value.w);
 skyMesh.position.copy(CX.cam.position);
 // brouillard = horizon
 CX.scene.fog.color.copy(U.uHor.value);CX.scene.background.copy(U.uHor.value);
 // lumières
 CX.hemi.color.copy(K.hsN).lerp(K.hsD,dayF);CX.hemi.groundColor.copy(K.hgN).lerp(K.hgD,dayF);CX.hemi.intensity=lerp(.64,.72,dayF)+dusk*.04;
 const sunUp=alt>.02;
 const dl=CX.sun;tmpC.copy(K.sunD).lerp(K.sunU,clamp01(dusk*1.3));
 if(sunUp){dl.color.copy(tmpC);dl.intensity=1.35*sm(.0,.22,alt);sunDir.y=Math.max(sunDir.y,.12);}
 else{dl.color.copy(K.moon);dl.intensity=.48*night;sunDir.copy(moonDir);sunDir.y=Math.max(sunDir.y,.25);}
 // ombres : zone autour du joueur
 const px=Math.round(P.x/2)*2,pz=Math.round(P.z/2)*2;
 dl.target.position.set(px,0,pz);dl.position.set(px+sunDir.x*110,sunDir.y*110,pz+sunDir.z*110);dl.target.updateMatrixWorld();
 // lampadaires, fenêtres, enseignes
 const lamp=sm(.20,.02,alt);
 if(lampMat) lampMat.emissiveIntensity=lamp*1.6;
 if(glowMat) glowMat.opacity=lamp*.55;
 for(let g=0;g<4;g++){const m=MT['win'+g];if(m) m.emissiveIntensity=sm(.16-.045*g+.06,.16-.045*g-.06,alt)*1.05;}
 const sh=MT.shop;if(sh) sh.emissiveIntensity=.10+.9*sm(.24,.0,alt);
 const ol=MT.officelit;if(ol) ol.emissiveIntensity=sm(.22,.0,alt)*1.0;
 const sgk=.12+.9*sm(.28,.0,alt);if(MT.signs) MT.signs.emissiveIntensity=sgk;for(const m of SIGNM) m.emissiveIntensity=sgk;
 const lh=MT.lamph;if(lh) lh.emissiveIntensity=lamp*1.8;
 // feux tricolores : cycle de 48 s
 if(TL.A){const c=(clock%48),A=c<20?0:c<23?1:2,B=c<26?2:c<44?0:1;TL.A.map.offset.x=A*.25;TL.B.map.offset.x=B*.25;}
 // éclairage intérieur des garages (lumière d'ambiance quand on s'en approche)
 let ins=0;for(const z of zonesG){const dx=Math.max(Math.abs(P.x-z.x)-z.w/2,0),dz=Math.max(Math.abs(P.z-z.z)-z.d/2,0),d=Math.hypot(dx,dz);ins=Math.max(ins,1-clamp01(d/7));}
 fill.intensity=ins*(.5+.22*night);
 if(groups&&groups.anim) groups.anim(dt,P,h,night);
 // qualité automatique
 if(Q.auto&&!quick){if(Q.wait>0) Q.wait--;else{Q.sum+=dt;Q.n++;if(Q.n>=70){const avg=Q.sum/Q.n;Q.sum=0;Q.n=0;
   if(avg>.042){if(++Q.bad>=2&&Q.level!=='basse'){const i=QS.indexOf(Q.level);D.setQuality(QS[i-1],false);Q.bad=0;Q.wait=120;if(!Q.msg){Q.msg=true;try{MW.toast('Qualité graphique réduite pour garder un jeu fluide (réglable dans le menu pause).','info');}catch(e){}}}}
   else Q.bad=0;}}}
};
/* correction des couleurs des matériaux créés ailleurs (hex sRGB → linéaire) */
const SIGNM=[];
D.signMat=tex=>{const m=new T.MeshLambertMaterial({map:tex,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:0});m.userData={lin:1};SIGNM.push(m);return m;};
D.fix=scene=>{scene.traverse(o=>{const m=o.material;if(!m) return;const arr=Array.isArray(m)?m:[m];
 for(const x of arr){if(x.userData.lin) continue;x.userData.lin=1;if(x.isShaderMaterial) continue;
  if(x.color) x.color.convertSRGBToLinear();if(x.emissive&&(x.emissive.r||x.emissive.g||x.emissive.b)) x.emissive.convertSRGBToLinear();
  for(const k of ['map','emissiveMap']){const t=x[k];if(t&&t.encoding!==T.sRGBEncoding){t.encoding=T.sRGBEncoding;t.needsUpdate=true;x.needsUpdate=true;}}}});};
let fixN=0;

/* ═══════════ Assemblage ═══════════ */
D.build=ctx=>{
 CX=ctx;ctx.cam=MW.cam;
 const rn=MW.renderer&&MW.renderer();if(rn){RN=rn;}
 // lumières et ciel
 const S=ctx.scene;S.background=new T.Color(0x9fc4e6);S.fog=new T.Fog(0xbcd9f0,60,340);
 ctx.hemi.intensity=.7;ctx.sun.shadow.mapSize.set(1024,1024);const sc=ctx.sun.shadow.camera;sc.left=-46;sc.right=46;sc.top=46;sc.bottom=-46;sc.near=10;sc.far=260;sc.updateProjectionMatrix();
 ctx.sun.shadow.bias=-.0007;ctx.sun.shadow.normalBias=.04;
 fill=new T.PointLight(0xfff0dc,0,0);fill.visible=false;// remplacé ci-dessous par une lumière ambiante (les matériaux Lambert éclairent par sommet)
 fill=new T.AmbientLight(0xfff0dc,0);S.add(fill);
 S.add(makeSky());
 // décor
 D.ctx=ctx;
 if(D.city) D.city(ctx,D);
 if(D.garages) D.garages(ctx,D);
 groups=D.finish();groups.anim=D.animFn||null;
 groups.core.name='decor-core';groups.detail.name='decor-detail';groups.far.name='decor-far';
 S.add(groups.core,groups.detail,groups.far);
 lampMat=MT.lamph||null;glowMat=MT.glowm||null;
 zonesG=ctx.zones.filter(z=>z.type==='garage');
 D.fix(S);
 // qualité
 const saved=readQ();Q.auto=!saved;Q.level=saved||autoLevel();Q.wait=150;
 D.setQuality(Q.level,false);
 D.frame(0,0,MW.S?MW.S.min/60:12,{x:0,z:0},true);
 try{console.log('Décor : '+Math.round(D.tris/1000)+' k triangles ; qualité '+Q.level);}catch(e){}
};
D.groups=()=>groups;D.Q=Q;
D.tick=()=>{if((++fixN)%12===0&&CX) D.fix(CX.scene);};
/* le décor est un point d'accroche du socle */
MW.decor={build:D.build,renderer:D.renderer,frame:(dt,t,h)=>{const P=MW.player();D.frame(dt,t,h,P);D.tick();},qualityLabel:D.qualityLabel,cycleQuality:D.cycleQuality};
return D;})();
