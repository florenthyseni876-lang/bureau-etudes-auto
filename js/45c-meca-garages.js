'use strict';
/* ───────────── Mode « Mécanicien » — DÉCOR : garages, intérieurs, enseignes, entrées, terrain, cour ─────────────
   Appelé par MWD.build après la ville. Les positions des ponts, établis, étagères et comptoirs viennent de MW.zones (inchangées). */
MWD.garages=(ctx,D)=>{
const T=D.T,PI=D.PI,H=D.H,{zones,addCol}=ctx;
const core=m=>D.B('core',m),det=m=>D.B('detail',m);
const R=D.rng(808),pick=a=>a[Math.floor(R()*a.length)];
const lifts=[],GW=4.6;
const L2W=(p,lx,lz)=>({x:p.x+Math.cos(p.ry)*lx+Math.sin(p.ry)*lz,z:p.z-Math.sin(p.ry)*lx+Math.cos(p.ry)*lz});
/* chariots, bras et patins d'un pont (position au repos ou suivant la voiture cg) */
function stepLift(Lf,dt,cg){const p=Lf.p;
  const k=Math.min(1,dt*14);
  const ty=cg?cg.position.y+.1:.3;
  Lf.y+=(ty-Lf.y)*k;if(Math.abs(Lf.y-ty)<.002) Lf.y=ty;
  const cy=Lf.y+.16;
  for(const c of Lf.car){c.g.position.set(p.x,cy,p.z);c.g.rotation.y=p.ry;}
  const pd=Lf.pad;
  for(const a of Lf.arms){
   /* pivot sur le chariot, cible : patin sous le point de levage de la voiture (ou bras repliés le long de la colonne) */
   const px=a.s*1.9,pz=a.q*.2,tx=pd?a.s*pd.x:a.s*1.45,tz=pd?(a.q>0?pd.f:pd.r):a.q*.55;
   const dx=tx-px,dz=tz-pz,L=.9;let d=Math.hypot(dx,dz);d=Math.max(.2,Math.min(d,L*2-.03));
   const ph=Math.atan2(dx,dz),al=Math.acos(Math.max(-1,Math.min(1,d/(2*L))));
   let best=null;for(const sg of [-1,1]){const a1=ph+sg*al,ex=px+Math.sin(a1)*L,ez=pz+Math.cos(a1)*L,sc=Math.abs(ex)*1+(a.q*(ez-pz))*0;if(!best||sc>best.sc) best={a1,ex,ez,sc};}
   const ex=best.ex,ez=best.ez,a2=Math.atan2((pd?tx:px+Math.sin(ph)*d)-ex,(pd?tz:pz+Math.cos(ph)*d)-ez);
   const yy=Lf.y+.1+.06;
   const I=L2W(p,px,pz),E=L2W(p,ex,ez);
   a.inn.position.set(I.x,yy,I.z);a.inn.rotation.y=p.ry+best.a1;
   a.out.position.set(E.x,yy,E.z);a.out.rotation.y=p.ry+a2;}
}

const sansF='"Barlow Condensed","Arial Narrow",Arial,sans-serif';
const fitText=(x,t,w,f,wt,fam)=>{x.font=(wt||'bold')+' '+f+'px '+(fam||sansF);while(x.measureText(t).width>w&&f>10){f-=2;x.font=(wt||'bold')+' '+f+'px '+(fam||sansF);}return f;};

/* ═══════ Styles des garages ═══════ */
const ST={
 garage1:{wall:'plaster',tint:0xa9b2ba,parapet:0x6a727a,floor:'floorconc',ftint:0xa8a8a8,dado:['conc',0x56697c],upper:['plaster',0xdcd8ca],stripe:0xe86a1c,ceil:0xcfcfc8,lift:0x4f5c68,chest:0xffffff,glassFront:false,win:{ww:1.6,wh:.9,sp:3.6},clutter:1,
  sign:{bg:'#e86a1c',fg:'#ffffff',t1:'GARAGE DU COIN',t2:'Entretien · Réparation · Pneus',w:9,h:1.7}},
 garage2:{wall:'plaster',tint:0xf4f6f8,parapet:0x2a5db0,floor:'epoxy',ftint:0xe4e8ee,dado:['plaster',0xf2f4f6],upper:['plaster',0xf6f8fa],stripe:0x2a5db0,ceil:0xf2f4f6,lift:0x2a5db0,chest:0x9ab0d0,glassFront:true,win:{style:'office',sp:4.5},showroom:2,
  sign:{bg:'#2a5db0',fg:'#ffffff',t1:'VENTOUX',t2:'AUTOMOBILES',w:11,h:2.0}},
 garage3:{wall:'stone',tint:0xffffff,parapet:0x2a2a30,floor:'floortile',ftint:0xdcd6c8,dado:['wood',0x7a5a46],upper:['plaster',0xf2ead8],stripe:0xc8a050,ceil:0xf6f0e2,lift:0x1c1c22,chest:0x3a3a3e,glassFront:false,win:{style:'office',sp:4.5},showroom:2,
  sign:{bg:'#15151b',fg:'#e6c46a',t1:'MAISON AURÈLE',t2:'AUTOMOBILES DE PRESTIGE',w:10,h:2.0,serif:1}},
 garage4:{wall:'brick',tint:0xb87870,parapet:0x2a2a2a,floor:'epoxy',ftint:0x5e5e66,dado:['plaster',0x232326],upper:['plaster',0x4a4a50],stripe:0xc01818,ceil:0x6a6a70,lift:0xc01818,chest:0x7a6a6a,glassFront:false,win:{ww:2.2,wh:1.1,sp:4.2},showroom:1,
  sign:{bg:'#c01818',fg:'#ffffff',t1:'SCUDERIA BRIVIO',t2:'CORSE · COMPETITION',w:10,h:2.0,italic:1}}};

/* ═══════ Enseignes ═══════ */
function signDraw(s){return (x,w,h)=>{
 x.fillStyle=s.bg;x.fillRect(0,0,w,h);
 const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,255,255,.14)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.18)');x.fillStyle=g;x.fillRect(0,0,w,h);
 x.strokeStyle=s.fg;x.lineWidth=h*.035;x.strokeRect(h*.07,h*.07,w-h*.14,h-h*.14);
 x.fillStyle=s.fg;x.textAlign='center';x.textBaseline='middle';
 const fam=s.serif?'Georgia,"Times New Roman",serif':sansF,wt=s.italic?'italic 800':'bold';
 const f=fitText(x,s.t1,w*.86,h*(s.t2?.46:.56),wt,fam);x.fillText(s.t1,w/2,s.t2?h*.4:h*.52);
 if(s.t2){x.font=(s.serif?'':'600 ')+Math.round(h*.16)+'px '+(s.serif?fam:'Arial');if(s.serif){x.fillStyle=s.fg;}x.fillText(s.t2,w/2,h*.76);}
 if(s.stripes){x.fillStyle='#111';x.fillRect(0,h*.9,w,h*.1);x.fillStyle='#fff';for(let i=0;i<40;i++) if(i%2) x.fillRect(i*w/40,h*.9,w/40,h*.05);}
};}
const signPlane=(z,u,v,y,w,h,face,draw)=>{ // panneau lumineux plat contre un mur (intérieur ou extérieur)
 const tex=D.canvasTex(1024,Math.round(1024*h/w),(x,ww,hh)=>draw(x,ww,hh)),m=new T.Mesh(new T.PlaneGeometry(w,h),D.signMat(tex)),p=z.loc(u,v);
 const out={x:-z.n.x,z:-z.n.z},ry=face==='door'?Math.atan2(out.x,out.z):Math.atan2(z.n.x,z.n.z);m.position.set(p.x,y,p.z);m.rotation.y=ry;ctx.scene.add(m);return m;};

/* ═══════ Un garage ═══════ */
function garage(z){
 const st=ST[z.id],d=z._d,w=d.w,dp=d.d,Hh=d.H,hx=w/2,out={x:-z.n.x,z:-z.n.z},ryO=Math.atan2(out.x,out.z),loc=z.loc,front=H.zoneFront(z);
 const rb=(B,u0,u1,v0,v1,y0,y1,col)=>{const a=loc(u0,v0),b=loc(u1,v1);B.box(Math.abs(a.x-b.x),y1-y0,Math.abs(a.z-b.z),(a.x+b.x)/2,(y0+y1)/2,(a.z+b.z)/2,col);};
 const P=(B,u,v,face,y0)=>{const p=loc(u,v),ry=face==='door'?ryO:face==='back'?ryO+PI:face==='u+'?PI/2:-PI/2;return D.L(B,p.x,p.z,ry,y0||0);};
 const fr=H.FACES[front];
 /* ── murs extérieurs ── */
 const wm=st.wall,tn=st.tint,B=core(wm);
 if(st.glassFront){
  // façade vitrée : socle, meneaux, verre transparent
  for(const s of [-1,1]){const u0=s>0?GW/2:-hx,u1=s>0?hx:-GW/2;
   rb(core('plaster'),u0,u1,-.2,.2,0,.5,0xe8ecf0);rb(D.B('core','glass'),u0,u1,-.1,.1,.5,Hh-.6,0xcfe6f6);
   rb(core('plaster'),u0,u1,-.22,.22,Hh-.6,Hh,0xf4f6f8);
   const n=Math.round((u1-u0)/3);for(let i=0;i<=n;i++){const u=u0+(u1-u0)*i/n;rb(core('plain'),u-.06,u+.06,-.17,.17,.5,Hh-.6,0xdfe4ea);}
   rb(core('plain'),u0,u1,-.15,.15,3.5,3.62,0xdfe4ea);}
  rb(B,-GW/2,GW/2,-.2,.2,3.8,Hh,tn);
 }else{rb(B,-hx,-GW/2,-.2,.2,0,Hh,tn);rb(B,GW/2,hx,-.2,.2,0,Hh,tn);rb(B,-GW/2,GW/2,-.2,.2,3.8,Hh,tn);}
 rb(B,-hx,hx,dp-.2,dp+.2,0,Hh,tn);rb(B,-hx-.2,-hx+.2,-.2,dp+.2,0,Hh,tn);rb(B,hx-.2,hx+.2,-.2,dp+.2,0,Hh,tn);
 {const pc=st.wall==='stone'?0x9a968e:0x84868a,cn=core('conc'),ring=(y0,y1,t,col,gap)=>{
   if(gap){rb(cn,-hx-t,-GW/2,-.2-t,-.2,y0,y1,col);rb(cn,GW/2,hx+t,-.2-t,-.2,y0,y1,col);}else rb(cn,-hx-t,hx+t,-.2-t,-.2,y0,y1,col);
   rb(cn,-hx-t,hx+t,dp+.2,dp+.2+t,y0,y1,col);rb(cn,-hx-.2-t,-hx-.2,-.2-t,dp+.2+t,y0,y1,col);rb(cn,hx+.2,hx+.2+t,-.2-t,dp+.2+t,y0,y1,col);};
  ring(0,.55,.08,pc,true);ring(Hh-.22,Hh,.15,0xdad6cd,false);}
 // encadrement de l'ouverture
 for(const s of [-1,1]) rb(core('plain'),s*(GW/2)+(s>0?0:-.34),s*(GW/2)+(s>0?.34:0),-.3,.3,0,3.95,0x3a3f46);
 rb(core('plain'),-GW/2-.34,GW/2+.34,-.3,.3,3.8,4.0,0x3a3f46);
 /* toit plat à rebord */
 H.roofFlat(z.x,z.z,w+.5,dp+.5,Hh,{layer:'core',wall:'plaster',tint:st.parapet,parapet:st.parapet,clutter:1});
 /* fenêtres extérieures et intérieures */
 const wo=st.win,isOff=wo.style==='office';
 for(const k of ['N','S','W','E']){const f=H.FACES[k];if(k===front) continue;const back=f.nx===-fr.nx&&f.nz===-fr.nz,len=f.nz?w:dp,off=f.nz?dp/2:w/2;
  if(back&&!isOff&&z.id!=='garage1') continue;
  const o=isOff?{style:'office',sp:wo.sp,litP:.6}:{ww:wo.ww,wh:wo.wh,sp:wo.sp,litP:.5};
  const fh=isOff?Hh-1.6:Hh;const y0=isOff?1.0:1.05;
  const cx=z.x,cz=z.z;
  H.winRow(cx,cz,f.nx,f.nz,off+.2,len-1,1,fh,y0,Object.assign({},o,{layer:'core'}));
  H.winRow(cx,cz,-f.nx,-f.nz,-(off-.28)-.025,len-1,1,fh,y0,Object.assign({},o,{layer:'core',litP:0}));}
 // façade avant : fenêtres hautes (si pas vitrée)
 if(!st.glassFront){
  const o=isOff?{style:'office',sp:4.4,litP:.7}:{ww:wo.ww,wh:wo.wh,sp:wo.sp,litP:.4};
  for(const s of [-1,1]){const u0=s>0?GW/2+.5:-hx+.5,u1=s>0?hx-.5:-GW/2-.5,len=u1-u0,uc=(u0+u1)/2,p=loc(uc,0);
   if(isOff){H.winRow(p.x,p.z,fr.nx,fr.nz,.22,len,1,Hh-1.8,.9,Object.assign({},o,{layer:'core'}));}
   else H.winRow(p.x,p.z,fr.nx,fr.nz,.22,len,1,Hh,-.75,Object.assign({},o,{layer:'core'}));}}
 /* ── parvis, enseigne, portes sectionnelles ── */
 H.parvis(z.x,z.z,w,dp,front);
 D.zoneSign(z,{y:Hh-1.1,off:.34,w:st.sign.w,h:st.sign.h,draw:signDraw(Object.assign({stripes:z.id==='garage4'},st.sign))});
 {const b=det('plain'),dl=P(b,0,-.0,'door',0);
  dl.box(GW-.2,.62,.14,0,3.48,-.2,0xe4e6e8);for(let i=0;i<3;i++) dl.box(GW-.24,.03,.16,0,3.28+i*.2,-.2,0xb4b8bc);
  dl.box(.09,3.8,.14,-GW/2+.05,1.9,-.18,0x8a9096);dl.box(.09,3.8,.14,GW/2-.05,1.9,-.18,0x8a9096);
  dl.box(GW,.07,.28,0,3.76,-.2,0x6a7076);
  core('conc').box(GW+.2,.12,.7,...(()=>{const q=loc(0,-.15);return [q.x,.06,q.z];})(),0x8a8c90);}
 /* ── sol, plafond, parois intérieures ── */
 const ic={u0:-hx+.2,u1:hx-.2,v0:.2,v1:dp-.2};
 rb(core(st.floor),ic.u0,ic.u1,-.3,ic.v1,0,.1,st.ftint);
 rb(core('ceil'),ic.u0,ic.u1,ic.v0,ic.v1,Hh-.06,Hh-.005,st.ceil);
 const lin=(u0,u1,v0,v1)=>{ // un pan de mur : lambris + haut
  rb(core(st.dado[0]),u0,u1,v0,v1,0,1.3,st.dado[1]);rb(core(st.upper[0]),u0,u1,v0,v1,1.3,Hh-.06,st.upper[1]);
  rb(core('plain'),u0,u1,v0,v1,1.3,1.42,st.stripe);};
 lin(ic.u0,ic.u1,dp-.26,dp-.2);lin(ic.u0,ic.u0+.06,ic.v0,ic.v1);lin(ic.u1-.06,ic.u1,ic.v0,ic.v1);
 if(!st.glassFront){lin(ic.u0,-GW/2,.2,.26);lin(GW/2,ic.u1,.2,.26);}
 else{rb(core('plain'),ic.u0,ic.u1,.2,.26,Hh-.5,Hh-.06,0xdfe4ea);}
 rb(core(st.upper[0]),-GW/2,GW/2,.2,.26,3.8,Hh-.06,st.upper[1]);
 // poutres et néons
 for(let i=1;i<=Math.floor(dp/5);i++){const v=i*5;rb(core('plain'),ic.u0,ic.u1,v-.13,v+.13,Hh-.42,Hh-.06,z.id==='garage3'?0x3a3a40:0x666b72);}
 const nu=w>30?3:2,nv=Math.max(2,Math.round(dp/7));
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const u=(i-(nu-1)/2)*w/nu*(nu>2?.85:1)*(nu>2?1:.9),v=dp*(j+.7)/(nv+.1);
  if(z.id==='garage3'){for(const du of [-.8,.8]) core('neon').cyl(.17,.17,.05,10,...(()=>{const q=loc(u+du,v);return [q.x,Hh-.09,q.z];})(),0xfff0d0);}
  else{const p=loc(u,v);core('neon').box(2.6,.06,.16,p.x,Hh-.5,p.z,0xfff6dc);core('plain').box(2.8,.05,.26,p.x,Hh-.44,p.z,0x8a8e94);
   core('plain').box(.03,.4,.03,p.x-1.1,Hh-.25,p.z,0x30343a);core('plain').box(.03,.4,.03,p.x+1.1,Hh-.25,p.z,0x30343a);}}
 /* ── ponts élévateurs à deux colonnes : colonnes fixes ; chariots, bras et patins mobiles (js : D.animFn) ── */
 z.ponts.forEach((p,i)=>{const b=core('plain'),pb=D.L(b,p.x,p.z,p.ry,0);
  for(const s of [-1,1]){
   pb.box(.9,.06,.9,s*2.15,.13,0,0x30353a);pb.box(.3,3.5,.46,s*2.15,1.9,0,st.lift);pb.box(.38,.12,.52,s*2.15,3.68,0,0x30353a);pb.box(.16,.3,.1,s*2.15-s*.03,1.4,.28,0xf2c200);
   pb.box(.06,3.1,.06,s*2.4,1.7,-.12,0x1c1c1e);pb.box(.1,.5,.06,s*2.15,.45,.26,0x1c1c1e);
   addCol(L2W(p,s*2.15,0).x,L2W(p,s*2.15,0).z,.7,.7);} /* les colonnes arrêtent le joueur (et la caméra) */
  const hz=D.B('core','hazard'),hp=D.L(hz,p.x,p.z,p.ry,0);
  for(const s of [-1,1]){hp.box(.16,.012,5.7,s*2.75,.106,0,0xffffff);hp.box(5.6,.012,.16,0,.106,s*2.9,0xffffff);}
  const car=[],arms=[];
  for(const s of [-1,1]){
   car.push({s,g:D.group(Bm=>{const l=D.L(Bm('plain'),0,0,0,0);
    l.box(.5,.46,.7,s*2.15,0,0,0x2c3136);l.box(.16,.34,.78,s*1.88,0,0,st.lift===0x1c1c22?0x2c3136:0x3a4046);
    for(const q of [-1,1]) l.box(.12,.14,.14,s*1.86,0,q*.2,0x14161a);})});
   for(const q of [-1,1]){
    const inn=D.group(Bm=>{const l=D.L(Bm('plain'),0,0,0,0);l.box(.15,.09,.9,0,0,.45,0x3b4046);l.cyl(.07,.07,.12,10,0,.0,0,0x161618);l.cyl(.06,.06,.12,10,0,0,.9,0x161618);}),
     out=D.group(Bm=>{const l=D.L(Bm('plain'),0,0,0,0);l.box(.12,.075,.9,0,0,.45,0x464c52);l.cyl(.088,.078,.05,12,0,.06,.9,0x161618);l.cyl(.1,.1,.012,12,0,.09,.9,0x2a2a2d);});
    arms.push({s,q,inn,out});}}
  const lf={p,car,arms,y:.3,id:z.id+':'+i,pad:null,carRef:null};
  for(const c of car) ctx.scene.add(c.g);for(const a of arms){ctx.scene.add(a.inn);ctx.scene.add(a.out);}
  for(const o of [...car.map(c=>c.g),...arms.flatMap(a=>[a.inn,a.out])]) o.traverse(m=>{m.castShadow=false;});
  stepLift(lf,1,null);lifts.push(lf);
  // flaques d'huile
  for(let k=0;k<(z.id==='garage1'?4:1);k++) det('plain').cyl(.22+R()*.25,.22+R()*.25,.005,12,p.x+(R()-.5)*3,.103,p.z+(R()-.5)*4,0x383229);});
 /* ── établi, panneau d'outils ── */
 {const eu=-hx+3.6,ev=dp-1.2,bw=P(core('plain'),eu,ev,'door',0),wd=P(core('wood'),eu,ev,'door',0);
  wd.box(3.8,.08,1.0,0,.92,0,0xb08a5a);wd.box(3.6,.05,.5,0,.26,-.18,0x8a6a48);
  for(const sx of [-1.75,1.75]) for(const sz of [-.4,.4]) bw.box(.08,.88,.08,sx,.44,sz,0x3a444e);
  bw.box(3.6,.06,.04,0,.76,.43,0x3a444e);bw.box(3.6,.3,.04,0,.74,.4,0x55606a);
  bw.box(.5,.2,.4,-1.3,1.06,.1,0x2f3338);bw.cyl(.07,.07,.3,8,-1.3,1.25,.1,0x888e94);bw.box(.1,.12,.5,-1.3,1.5,.1,0x2f3338);      // étau
  bw.box(.8,.5,.55,1.2,1.2,.05,0xc02020);bw.box(.8,.04,.55,1.2,1.46,.05,0x8a1818);
  det('plain').box(.01,.01,.01,0,0,0,0);
  const dl=P(det('plain'),eu,ev,'door',0);dl.cyl(.12,.12,.1,10,0,.99,.15,0xd2d6da);dl.cyl(.05,.05,.3,6,-.4,1.15,.1,0x30343a);dl.cyl(.09,.09,.15,10,.4,1.04,.2,0x1f4a8a);
  dl.box(.5,.04,.35,.2,.98,-.2,0xe6e0d0);
  if(st.clutter){dl.box(.5,.4,.4,-.5,.46,-.15,0xb89058);dl.box(.4,.3,.4,.5,.4,-.2,0xb89058);}
  const tp=P(D.B('core','toolpanel'),eu,dp-.285,'door',0);tp.quad(3.6,1.5,0,2.0,0,null);
  const sh=P(core('plain'),eu,dp-.45,'door',0);sh.box(3.8,.06,.4,0,3.0,0,0x6a5034);sh.box(.06,.3,.34,-1.8,2.85,0,0x3a444e);sh.box(.06,.3,.34,1.8,2.85,0,0x3a444e);
  for(let i=0;i<5;i++) det('plain').cyl(.1,.1,.26,8,...(()=>{const q=loc(eu-1.5+i*.7,dp-.45);return [q.x,3.16,q.z];})(),pick([0x1f4a8a,0xc02020,0xe8c020,0x2a7a3a]));
  const ac=loc(eu,ev);const Dd=P(det('plain'),eu,ev,'door',0);Dd.box(3.8,.1,.5,0,3.45,0,0x000000);addCol(ac.x,ac.z,3.8,1.05);}
 /* ── étagère de pièces ── */
 {const su=hx-3.4,sv=dp-.9,l=P(core('plain'),su,sv,'door',0),c=P(D.B('detail','cardboard'),su,sv,'door',0),dt=P(det('plain'),su,sv,'door',0);
  for(const sx of [-1.58,-.53,.53,1.58]) for(const sz of [-.26,.26]) l.box(.06,2.3,.06,sx,1.15,sz,st.lift===0x1c1c22?0x3a3a40:0x2f5aa0);
  for(let r=0;r<4;r++) l.box(3.2,.04,.6,0,.1+r*.68,0,0xb8bcc0);l.box(3.2,2.3,.02,0,1.15,-.3,0x6a7076);
  for(let r=0;r<3;r++){const y=.14+r*.68;
   for(let k=0;k<5;k++){const bx=-1.35+k*.66;const t=(r+k)%3;
    if(t===0) c.box(.54,.34,.42,bx,y+.17+.02,.0,0xffffff);
    else if(t===1){dt.cyl(.14,.14,.4,10,bx-.1,y+.2+.02,0,pick([0x1f4a8a,0xc02020,0xe8c020,0xf0f0f0]));dt.cyl(.145,.145,.12,10,bx-.1,y+.22,0,0xf2f2f2);dt.cyl(.14,.14,.4,10,bx+.2,y+.2+.02,0,pick([0x1f4a8a,0x2a7a3a,0xf0f0f0]));dt.cyl(.145,.145,.12,10,bx+.2,y+.22,0,0xf2f2f2);}
    else{dt.box(.2,.2,.2,bx-.15,y+.12,0,0xe86a1c);dt.box(.2,.2,.2,bx+.1,y+.12,0,0xe8e0d0);dt.box(.2,.2,.2,bx+.35,y+.12,0,0x2a7a3a);}}}
  for(let k=0;k<3;k++) dt.cyl(.34,.34,.2,12,-1.1+k*.0,2.1+.1+k*0,0,0x1a1a1c);
  const ac=loc(su,sv);addCol(ac.x,ac.z,3.2,.7);}
 /* ── comptoir d'accueil ── */
 {const au=hx-3.2,av=3,l=P(core('plain'),au,av,'door',0);
  l.box(2.6,1.0,.8,0,.5,0,st.lift===0x4f5c68?0x50565e:st.lift);l.box(2.8,.06,.95,0,1.03,.03,st.dado[1]===0x7a5a46?0x4a3424:0xdcdcdc);
  l.box(.5,.34,.04,-.6,1.28,-.1,0x15171a);l.box(.12,.12,.2,-.6,1.12,-.1,0x15171a);l.box(.44,.02,.16,-.6,1.07,.2,0x2a2c30);
  l.cyl(.07,.07,.04,10,.7,1.07,.1,0xc8a040);l.box(.2,.06,.2,.2,1.08,0,0x30343a);l.box(.22,.08,.3,-1.0,1.08,.0,0xe8e0d0);
  l.box(.42,.5,.42,1.0,1.28,0,0x2f3338);
  const sg=signPlane(z,au,av+.41,.62,1.5,.34,'door',signDraw({bg:'#1a1c20',fg:'#ffffff',t1:'ACCUEIL',w:1,h:1}));
  // fauteuil derrière le comptoir
  const ch=P(det('plain'),au,av-.9,'door',0);ch.box(.5,.08,.5,0,.5,0,0x2a2c30);ch.box(.5,.6,.08,0,.85,-.2,0x2a2c30);ch.cyl(.04,.04,.4,6,0,.28,0,0x55595e);
  const ac=loc(au,av);addCol(ac.x,ac.z,2.6,.8);}
 /* ── équipement d'atelier ── */
 const bu=-w*.12,bv=dp-1.1;
 { // compresseur
  const l=P(core('plain'),bu,bv,'door',0);
  l.rcyl(.34,.34,1.3,14,0,.82,0,0x1f5aa8,0,PI/2);l.box(.1,.5,.1,-.5,.28,.2,0x30353a);l.box(.1,.5,.1,.5,.28,.2,0x30353a);l.box(.1,.5,.1,-.5,.28,-.2,0x30353a);l.box(.1,.5,.1,.5,.28,-.2,0x30353a);
  l.cyl(.12,.12,.06,8,.6,.1,.25,0x1a1a1c);l.cyl(.12,.12,.06,8,-.6,.1,.25,0x1a1a1c);
  l.box(.55,.34,.42,0,1.26,0,0xd8d8da);l.cyl(.13,.13,.4,10,.12,1.5,0,0x4a4e54);l.cyl(.08,.08,.04,10,-.7,1.0,.34,0xf0f0f0);l.box(.3,.3,.08,.1,.9,.36,0x15171a);
  const ac=loc(bu,bv);addCol(ac.x,ac.z,1.5,.8);
  // enrouleur d'air et tuyau
  const re=P(core('plain'),bu+1.3,dp-.3,'door',0);re.rcyl(.34,.34,.14,16,0,1.7,0,0xe8c020,PI/2,0);re.rcyl(.1,.1,.2,10,0,1.7,0,0x30353a,PI/2,0);re.rcyl(.3,.3,.04,16,0,1.7,.1,0x2a2a2c,PI/2,0);re.box(.12,.7,.05,0,1.2,-.05,0x30353a);
  re.cyl(.03,.03,.5,6,.1,1.45,.15,0xe86a1c);}
 { // démonte-pneu et équilibreuse
  const tu=w*.03,tv=dp-2.3,l=P(core('plain'),tu,tv,'door',0),dl=P(det('plain'),tu,tv,'door',0);
  l.box(1.1,.16,1.0,0,.1,0,0x55606a);l.cyl(.1,.1,1.0,10,.3,.7,-.3,0x3f464e);l.cyl(.46,.46,.12,16,0,.78,.1,0x30353a);l.cyl(.3,.3,.14,14,0,.79,.1,0xc8ccd0);
  l.box(.12,.12,.9,.3,1.26,-.05,0x2e3338);l.box(.05,.3,.05,.3,1.0,.38,0xd0d4d8);l.box(.3,.04,.2,-.5,.04,.55,0x1a1a1c);l.box(.3,.04,.2,.1,.04,.6,0x1a1a1c);
  dl.cyl(.3,.3,.2,14,0,.95,.1,0x1a1a1c);dl.cyl(.2,.2,.22,12,0,.95,.1,0xc4c8cc);
  const ac=loc(tu,tv);addCol(ac.x,ac.z,1.2,1.1);
  const eu=tu+2.7,l2=P(core('plain'),eu,dp-2.0,'door',0),d2=P(det('plain'),eu,dp-2.0,'door',0);
  l2.box(.8,1.0,.7,0,.5,-.1,0xcfd3d6);l2.box(.62,.28,.04,0,1.2,.05,0x14161a);l2.rcyl(.34,.34,.24,16,.3,.8,.3,0x1a1a1c,0,PI/2);l2.rcyl(.22,.22,.26,14,.3,.8,.3,0xc0c4c8,0,PI/2);
  l2.rcyl(.4,.4,.04,14,.3,1.18,.3,0x6a7076,0,PI/2);l2.box(.5,.1,.4,-.1,.7,.5,0x30343a);
  for(let i=0;i<5;i++) d2.box(.06,.04,.12,-.25+i*.1,.76,.52,0xb0b4b8);
  const a2=loc(eu,dp-2.0);addCol(a2.x,a2.z,1.0,.9);}
 // servantes à tiroirs, panneaux d'outils des murs
 {const nCh=w>30?3:2;
  for(let i=0;i<nCh;i++){const v=dp*.30+i*1.6,l=P(core('plain'),-hx+.65,v,'u+',0),cq=P(D.B('core','chest'),-hx+.65,v,'u+',0);
   l.box(.62,.9,1.2,0,.55,0,0x7a1a14);l.box(.66,.05,1.26,0,1.02,0,0x2a2a2e);l.cyl(.06,.06,.06,8,-.2,.06,.5,0x1a1a1c);l.cyl(.06,.06,.06,8,-.2,.06,-.5,0x1a1a1c);l.cyl(.06,.06,.06,8,.2,.06,.5,0x1a1a1c);l.cyl(.06,.06,.06,8,.2,.06,-.5,0x1a1a1c);
   cq.quad(1.2,.9,.32,.55,0,st.chest);const a=loc(-hx+.65,v);addCol(a.x,a.z,.7,1.3);}
  const tp=P(D.B('core','toolpanel'),-hx+.3,dp*.30+.8,'u+',0);tp.quad(3.2,1.3,0.0,2.0,0,null);
  const tp2=P(D.B('core','toolpanel'),hx-.3,dp*.52,'u-',0);tp2.quad(2.6,1.2,0,2.0,0,null);}
 // cric rouleur, bac de vidange, pneus, fûts, extincteurs, affiches
 {const pu=z.ponts[0],jk=P(det('plain'),-hx+3.2,dp*.42+3.4,'u+',0);
  jk.box(.5,.16,.95,0,.18,0,0xc02020);jk.box(.2,.12,.3,0,.3,.35,0xd0d4d8);jk.rbox(.05,.05,1.3,0,.6,-.8,0x30343a,0,-.55,0);jk.cyl(.07,.07,.06,8,-.2,.08,.4,0x1a1a1c);jk.cyl(.07,.07,.06,8,.2,.08,.4,0x1a1a1c);jk.cyl(.07,.07,.06,8,0,.08,-.4,0x1a1a1c);
  const bv=P(det('plain'),z.ponts[z.ponts.length-1].x>z.x?hx-8:hx-8,dp*.42+3.6,'u+',0);
  const pb=z.ponts[1]||z.ponts[0],oc=P(det('plain'),0,0,'u+',0);
  const dr=P(det('plain'),pu?(z.ponts[0].x<z.x?-hx+6.8:-hx+6.8):0,dp*.42-3.3,'door',0);
  dr.box(.9,.12,.6,0,.14,0,0x1f4a8a);dr.box(.9,.02,.6,0,.22,0,0x111);dr.cyl(.28,.1,.2,10,0,.34,0,0xc8ccd0);dr.cyl(.04,.04,.1,6,.35,.1,.25,0x1a1a1c);
  for(let i=0;i<3;i++){const tl=P(det('plain'),hx-1.0,2.5+i*.0,'u-',0);}
  const ts=P(det('plain'),-hx+1.0,2.6,'u+',0);
  for(let k=0;k<5;k++){ts.cyl(.32,.32,.2,12,0,.1+k*.2,0,0x1a1a1c);ts.cyl(.2,.2,.21,10,0,.1+k*.2,0,0x8a8e94);}
  const ts2=P(det('plain'),-hx+1.0,4.0,'u+',0);for(let k=0;k<3;k++){ts2.cyl(.32,.32,.2,12,.0,.1+k*.2,0,0x1a1a1c);ts2.cyl(.2,.2,.21,10,0,.1+k*.2,0,0x8a8e94);}
  const a=loc(-hx+1.0,3.3);addCol(a.x,a.z,1.0,2.4);
  for(let i=0;i<3;i++){const p=P(det('plain'),hx-1.0,dp*.56+i*.75,'u-',0);p.cyl(.29,.29,.9,12,0,.46,0,[0x1f4a8a,0x2a3a5a,0x6a2a1a][i]);p.cyl(.3,.3,.04,12,0,.3,0,0x888c92);p.cyl(.3,.3,.04,12,0,.62,0,0x888c92);p.cyl(.2,.2,.03,10,0,.93,0,0x6a6e74);}
  const a2=loc(hx-1.0,dp*.56+.75);addCol(a2.x,a2.z,1.0,2.4);
  const ext=(u,v,face)=>{const e=P(det('plain'),u,v,face,0);e.cyl(.09,.09,.46,10,0,1.0,0,0xc01818);e.cyl(.04,.04,.12,8,0,1.3,0,0x1a1a1c);e.box(.14,.04,.04,.04,1.38,0,0x1a1a1c);e.box(.3,.3,.02,0,1.7,-.01,0xc01818);e.box(.22,.04,.025,0,1.7,0,0xffffff);e.box(.04,.22,.025,0,1.7,0,0xffffff);e.box(.12,.04,.1,0,.8,-.03,0x30343a);};
  ext(-GW/2-.8,.45,'door');ext(hx-.35,dp*.5,'u-');
  const posters=D.B('detail','posters');
  const poster=(u,v,face,y,i)=>{const q=P(posters,u,v,face,0);q.quad(.62,1.2,0,y,0,null,[i/4,0,(i+1)/4,1]);};
  poster(-hx+.28,dp*.62,'u+',1.9,0);poster(-hx+.28,dp*.62+1.0,'u+',1.9,2);poster(hx-.28,dp*.28,'u-',1.9,3);poster(ic.u1-3,.3,'back',2.0,1);poster(ic.u0+2,.3,'back',2.0,0);poster(hx-.28,dp*.5+2,'u-',1.9,2);
  // horloge
  const cl=P(det('plain'),0,.3,'back',0);cl.rcyl(.34,.34,.06,16,0,4.7,0,0x1a1a1c,PI/2,0);cl.rcyl(.3,.3,.07,16,0,4.7,.02,0xf4f4f0,PI/2,0);cl.box(.03,.22,.02,0,4.78,.06,0x111);cl.box(.02,.16,.02,.05,4.68,.06,0x111);}
 /* ── éléments propres à chaque garage ── */
 const lounge=(u,v,col,tbl)=>{const l=P(core('plain'),u,v,'door',0),dl=P(det('plain'),u,v,'door',0);
  for(const s of [-1,1]){l.box(1.9,.42,.8,0,.28,s*1.5,col);l.box(1.9,.5,.2,0,.62,s*1.5+(s>0?.4:-.4)*-1,col);}
  l.box(1.0,.38,.7,0,.2,0,tbl);dl.box(.5,.03,.35,-.1,.4,.0,0xe8e0d0);dl.cyl(.04,.04,.1,6,.25,.46,.1,0xc02020);
  dl.cyl(.22,.18,.4,10,2.0,.2,-1.5,0x8a6a4a);dl.sph(.45,.5,.45,1,2.0,.8,-1.5,0x3f7a2a);};
 const showcar=(u,v,kind,color,tbl)=>{const p=loc(u,v);
  if(tbl==='turn'){const dl=det('plain');dl.cyl(2.4,2.5,.12,24,p.x,.16,p.z,0x1c1c20);dl.cyl(2.2,2.2,.02,24,p.x,.23,p.z,0x8a6a2a);}
  else if(tbl==='podium'){const dl=det('plain');dl.box(2.8,.2,5.6,p.x,.2,p.z,0x1a1a1c);dl.box(2.8,.03,.4,p.x,.32,p.z-2.6,0xc01818);}
  else{det('plain').cyl(2.4,2.4,.04,24,p.x,.12,p.z,0xcfd8e4);}
  const y0=tbl?.2:.0;const g=H.bakeCar({kind,color},p.x,p.z,ryO,'detail');
  addCol(p.x,p.z,2.6,5.4);
  // la voiture est posée sur le socle : relève la géométrie fusionnée si besoin (socle très bas)
 };
 if(z.id==='garage1'){
  const dl=P(det('plain'),-4,2.2,'door',0);dl.box(.9,.5,.5,0,.4,0,0x30343a);dl.box(.34,.3,.3,0,.8,0,0xd8d8d8); // machine à café sur un guéridon
  const cl=P(det('cardboard'),-hx+2.4,dp-2.6,'door',0);cl.box(.6,.5,.5,0,.25,0,0xffffff);cl.box(.5,.4,.5,0,.7,0,0xffffff);
  const pal=P(D.B('detail','wood'),hx-2.8,dp-3.5,'door',0);pal.box(1.2,.14,.9,0,.1,0,0x9a7a50);
  const mp=P(det('plain'),-hx+1,dp-1.2,'door',0);mp.cyl(.22,.18,.3,10,0,.15,0,0xc8a020);mp.cyl(.02,.02,1.1,6,.18,.8,0,0x8a6a4a);
  signPlane(z,hx-1.4,dp-.28,2.8,1.8,.8,'door',(x,ww,hh)=>{x.fillStyle='#f2e8c8';x.fillRect(0,0,ww,hh);x.fillStyle='#b01818';x.fillRect(0,0,ww,hh*.28);x.fillStyle='#fff';x.font='bold '+hh*.2+'px Arial';x.textAlign='center';x.fillText('TARIFS',ww/2,hh*.22);x.fillStyle='#222';x.font=hh*.12+'px Arial';x.textAlign='left';['Vidange .......... 90 €','Freins ........... 140 €','Pneus ............ 60 €','Diagnostic ....... 45 €'].forEach((t,i)=>x.fillText(t,ww*.08,hh*.46+i*hh*.16));});
 }
 if(z.id==='garage2'){
  showcar(-hx*.5,6.5,'berline',0xc02a2a,'floor');showcar(hx*.28,6.5,'suv',0x2a4a8a,'floor');
  lounge(-hx+3.2,4.2,0x2a5db0,0xdfe4ea);
  signPlane(z,0,dp-.285,3.7,10,1.8,'door',signDraw({bg:'#2a5db0',fg:'#ffffff',t1:'VENTOUX · LE PLAISIR DE ROULER',t2:'Neuf · Occasion · Entretien',w:1,h:1}));
 }
 if(z.id==='garage3'){
  showcar(-hx*.5,6.5,'sport',0x15151a,'turn');showcar(hx*.28,6.5,'berline',0xe6dcc0,'turn');
  lounge(-hx+3.0,4.4,0x2a1c14,0x15151a);
  const rg=P(det('plain'),0,0,'door',0);
  for(const [u,v] of [[-GW/2-1.2,1.6],[GW/2+1.2,1.6]]){const pt=P(det('plain'),u,v,'door',0);pt.cyl(.3,.24,.5,10,0,.25,0,0xcfc8b8);pt.cyl(.04,.04,.7,6,0,.85,0,0x6a4a2a);pt.sph(.4,.45,.4,1,0,1.45,0,0x2f6a2a);}
  signPlane(z,0,dp-.285,3.8,9,1.6,'door',signDraw({bg:'#15151b',fg:'#e6c46a',t1:'MAISON AURÈLE',t2:'DEPUIS 1962',w:1,h:1,serif:1}));
  // lustres : disques lumineux
  for(const [u,v] of [[-hx*.5,6.5],[hx*.28,6.5]]){const p=loc(u,v);core('neon').cyl(.9,.9,.05,16,p.x,Hh-.3,p.z,0xffeccc);det('plain').cyl(1.0,1.0,.04,16,p.x,Hh-.26,p.z,0xc8a050);}
 }
 if(z.id==='garage4'){
  showcar(-hx*.55,6.0,'sport',0xc01818,'podium');
  // murs de pneus rouge et blanc, drapeaux à damier, banderoles
  for(let i=0;i<8;i++){const p=loc(hx-1.0,dp*.15+i*.62);for(let k=0;k<3;k++){det('plain').cyl(.32,.32,.28,10,p.x,.14+k*.28,p.z,0x1a1a1c);det('plain').cyl(.2,.2,.29,10,p.x,.14+k*.28,p.z,(i+k)%2?0xc01818:0xf4f4f4);}}
  addCol(loc(hx-1.0,dp*.15+2.2).x,loc(hx-1.0,dp*.15+2.2).z,1.0,5.2);
  signPlane(z,-hx*.2,dp-.285,3.6,9,1.7,'door',signDraw({bg:'#c01818',fg:'#ffffff',t1:'SCUDERIA BRIVIO',t2:'ON NE LÂCHE RIEN',w:1,h:1,italic:1,stripes:1}));
  const ck=P(det('plain'),0,0,'door',0);for(let i=0;i<12;i++) for(let j=0;j<2;j++) ck.box(.4,.014,.4,-2.2+i*.4,.107,-.0+j*.4-.2+0,(i+j)%2?0x111111:0xf4f4f4);
  for(let i=0;i<4;i++){const f=P(det('plain'),-hx+1.5+i*2.3,dp-.45,'door',0);f.box(.02,.02,.02,0,0,0,0);}
 }
 /* ── extérieur : mobilier et ambiance de chaque garage ── */
 if(z.id==='garage1'){
  const o=P(det('plain'),hx-1.5,-1.4,'door',0);for(let k=0;k<4;k++){o.cyl(.32,.32,.2,12,0,.1+k*.2,0,0x1a1a1c);o.cyl(.2,.2,.21,10,0,.1+k*.2,0,0x8a8e94);}
  const dr=P(det('plain'),hx-3.2,-1.2,'door',0);dr.cyl(.29,.29,.9,12,0,.46,0,0x8a2a1a);dr.cyl(.3,.3,.04,12,0,.3,0,0x555);dr.cyl(.3,.3,.04,12,0,.62,0,0x555);
  const ba=P(det('plain'),-hx+2.0,-1.2,'door',0);ba.box(1.4,.07,.3,0,.46,0,0x7a5030);ba.box(.07,.46,.3,-.6,.23,0,0x30343a);ba.box(.07,.46,.3,.6,.23,0,0x30343a);
  signPlane(z,-hx+5.5,-.34,2.4,3.6,.9,'back',signDraw({bg:'#f2d200',fg:'#111',t1:'PNEUS -30 %',t2:null,w:1,h:1}));
  signPlane(z,GW/2+1.8,-.33,2.2,1.4,.55,'back',(x,w,h)=>{x.fillStyle='#101418';x.fillRect(0,0,w,h);x.fillStyle='#ff4a3a';x.font='bold '+h*.6+'px Arial';x.textAlign='center';x.textBaseline='middle';x.shadowColor='#ff4a3a';x.shadowBlur=18;x.fillText('OUVERT',w/2,h/2);});
  const a=loc(hx-1.5,-1.4);addCol(a.x,a.z,1.0,1.0);}
 if(z.id==='garage2'){
  const pyl=P(core('plain'),-hx-2.6,-1.0,'door',0);pyl.box(1.0,9,.5,0,4.5,0,0x2a5db0);pyl.box(1.1,.2,.6,0,9.1,0,0x1a3c78);
  const tex=signPlane(z,-hx-2.6,-1.0-.27,6.6,.9,3.2,'back',(x,w,h)=>{x.fillStyle='#2a5db0';x.fillRect(0,0,w,h);x.fillStyle='#fff';x.font='bold '+w*.2+'px Arial';x.textAlign='center';x.fillText('V',w/2,h*.28);x.font='bold '+w*.1+'px Arial';x.fillText('VENTOUX',w/2,h*.55);x.font=w*.07+'px Arial';x.fillText('AUTOMOBILES',w/2,h*.7);});
  for(let i=0;i<4;i++){const f=P(det('plain'),-hx+6+i*5,-1.3,'door',0);f.cyl(.05,.05,7,6,0,3.5,0,0xc8ccd0);f.quad(1.4,.9,.75,6.5,0,0x2a5db0,null,0,true);}
  addCol(loc(-hx-2.6,-1.0).x,loc(-hx-2.6,-1.0).z,1.2,.8);}
 if(z.id==='garage3'){
  for(const s of [-1,1]){const p=P(core('plain'),s*(GW/2+3.4),-1.0,'door',0);p.cyl(.1,.14,3.4,8,0,1.7,0,0x15151a);p.sph(.28,.34,.28,1,0,3.6,0,0xfff0cc);p.cyl(.22,.26,.2,8,0,.1,0,0xc8a050);
   core('lamph').sph(.2,.26,.2,1,...(()=>{const q=loc(s*(GW/2+3.4),-1.0);return [q.x,3.6,q.z];})(),0xffffff);}
  for(const s of [-1,1]){const p=P(det('plain'),s*(GW/2+1.6),-.9,'door',0);p.box(.9,.6,.9,0,.3,0,0xcfc8b8);p.sph(.5,.6,.5,1,0,1.0,0,0x2f6a2a);}
  const aw=P(core('plain'),0,-.2,'door',0);aw.box(GW+3.2,.14,1.3,0,4.35,-.6,0x15151a);aw.box(GW+3.2,.06,.06,0,4.22,-1.25,0xc8a050);
 }
 if(z.id==='garage4'){
  for(let i=0;i<5;i++){const f=P(det('plain'),-hx+3+i*5.5,-1.2,'door',0);f.cyl(.05,.05,6.5,6,0,3.25,0,0x222);f.quad(1.3,.85,.7,6.0,0,0xc01818,null,0,true);}
  const ca=P(core('plain'),0,-.2,'door',0);ca.box(GW+4,.18,1.2,0,4.25,-.5,0x1a1a1c);ca.box(GW+4,.14,.12,0,4.12,-1.1,0xc01818);
  const o=P(det('plain'),hx-1.6,-1.3,'door',0);for(let k=0;k<4;k++){o.cyl(.32,.32,.22,12,0,.11+k*.22,0,0x1a1a1c);o.cyl(.2,.2,.23,10,0,.11+k*.22,0,k%2?0xc01818:0xf4f4f4);}
 }
}
for(const z of zones) if(z.type==='garage') garage(z);

/* ═══════ Entrées et enseignes des autres bâtiments ═══════ */
const sans=sansF;
function other(z){
 const d=z._d,out={x:-z.n.x,z:-z.n.z},ry=Math.atan2(out.x,out.z),Lb=D.L(core('plain'),z.door.x,z.door.z,ry,0),Ld=D.L(det('plain'),z.door.x,z.door.z,ry,0),Ls=D.L(core('stone'),z.door.x,z.door.z,ry,0),Lc=D.L(core('conc'),z.door.x,z.door.z,ry,0);
 const dr=(fg,bg,t1,t2,o)=>H.draw(bg,fg,t1,t2);
 if(z.id==='appart'){D.zoneSign(z,{y:3.55,off:.3,w:2.2,h:.5,draw:H.draw('#2a3550','#fff','STUDIO',null)});}
 if(z.id==='pieces'){D.zoneSign(z,{y:d.H-1.0,off:.34,w:Math.min(z.w-2,12),h:1.6,draw:signDraw({bg:'#f2c600',fg:'#161616',t1:'PIÈCES AUTO EXPRESS',t2:'Pièces · Pneus · Outillage',w:1,h:1})});}
 if(z.id==='concess'){D.zoneSign(z,{y:d.H-1.0,off:.34,w:Math.min(z.w-2,12),h:1.6,draw:signDraw({bg:'#6a2a90',fg:'#ffffff',t1:'OCCASIONS DU MARCHÉ',t2:'Vente · Reprise · Garantie',w:1,h:1})});
  // le parc de voitures d'occasion, à côté du magasin
  const x0=z.x+z.w/2+3,z0=z.z-z.d/2+2.5;
  core('gravel').box(30,.06,17,x0+14,.03,z.z-.3,0xffffff);
  for(let i=0;i<3;i++){const x=x0+2.5+i*8.5;core('plain').box(.05,2.0,.05,x-.05,1,z0+.0-.4,0x555);}
  const cols=[0xc02a2a,0x2a4a8a,0xe0e0e0,0x202428,0x3a7a4a,0xd8a020,0x8a8f98,0x6a2a5a],kinds=['citadine','berline','suv','citadine','berline','utilitaire','sport','citadine'];
  for(let i=0;i<8;i++){const x=x0+2.2+(i%4)*7.0,zz=z0+3.0+Math.floor(i/4)*8.2;
   if(H.bakeCar({kind:kinds[i],color:cols[i]},x,zz,Math.PI,'detail')){addCol(x,zz,2.1,4.8);
    const pb=D.L(det('plain'),x,zz,0,0);pb.box(.7,.5,.04,1.4,.9,2.4,0xfff060);}}
  // guirlande de fanions
  const fl=det('plain');for(let i=0;i<20;i++){const x=x0+.5+i*1.4;fl.box(.34,.34,.02,x,3.65-Math.sin(i/19*PI)*.0,z0-.3,pick([0xc02a2a,0xf2c600,0x2a5db0,0xffffff,0x2a7a3a]),0,0,.78);}
  fl.box(28,.03,.03,x0+14,3.85,z0-.3,0x222);
  for(const x of [x0,x0+28]) fl.cyl(.05,.05,4,6,x,2,z0-.3,0x444);
  // clôture du parc
  const fn=D.B('detail','fence');for(const zz of [z.z-z.d/2+.3,z.z+z.d/2+3.0]) fn.quad(30,1.4,x0+14,.75,zz,0,null,[0,0,15,.7]);
 }
 if(z.id==='ecole'){
  D.zoneSign(z,{y:d.H-.75,off:.4,w:14,h:1.3,draw:signDraw({bg:'#2f7a3a',fg:'#ffffff',t1:'CENTRE DE FORMATION AUTOMOBILE',t2:null,w:1,h:1})});
  for(const s of [-1,1]){Ls.cyl(.4,.42,5.4,14,s*2.4,2.7,2.0,0xefe9d8);Ls.box(1.1,.3,1.1,s*2.4,.15,2.0,0xd8d2c0);Ls.box(1.0,.3,1.0,s*2.4,5.5,2.0,0xd8d2c0);}
  Lb.box(6.6,.5,2.8,0,5.75,1.5,0xd8d2c0);Lc.box(7.2,.2,3.2,0,6.1,1.5,0xcfcab8);
  for(let i=0;i<3;i++) Lc.box(5.6+i*.4,.2,.6+i*.2,0,.1+i*.2,1.9+ (2-i)*.3+.4,0xbab6aa);
  Lb.box(2.6,3.0,.2,0,1.5,.05,0x2f4a36);D.B('core','win').quad(1.0,2.4,.0,1.5,.2,ry,null,null);
  const dl=D.L(D.B('core','win'),z.door.x,z.door.z,ry,0);dl.quad(1.1,2.4,-.62,1.5,.2,null);dl.quad(1.1,2.4,.62,1.5,.2,null);
  for(const s of [-1,1]){const f=D.L(det('plain'),z.door.x,z.door.z,ry,0);f.cyl(.05,.05,7,6,s*6.5,3.5,1.6,0xc8ccd0);f.quad(1.5,1.0,s*6.5+.8,6.4,1.6,s>0?0x2a5db0:0xf2f2f2,null,0,true);}
  const bk=D.L(det('plain'),z.door.x,z.door.z,ry,0);for(const s of [-1,1]){bk.box(1.6,.4,.5,s*8.5,.25,1.2,0x7a5030);}
 }
 if(z.id==='banque'){
  D.zoneSign(z,{y:d.H-1.2,off:.3,w:9,h:1.5,draw:signDraw({bg:'#1f3558',fg:'#e6c46a',t1:'BANQUE DU QUARTIER',t2:'Comptes · Prêts · Épargne',w:1,h:1,serif:1})});
  for(const s of [-2,-.7,.7,2]){Ls.cyl(.38,.4,5.6,14,s*1.9,2.8,1.8,0xeee8d8);Ls.box(1.0,.3,1.0,s*1.9,.15,1.8,0xd4cebe);}
  Lb.box(8.8,.5,2.9,0,5.85,1.5,0xd8d2c0);Lc.box(9.6,.2,3.3,0,6.2,1.4,0x1f3558);
  for(let i=0;i<3;i++) Lc.box(8+i*.5,.2,.5,0,.1+i*.2,2.8+(2-i)*.3,0xbab6aa);
  Lb.box(2.4,3.1,.2,0,1.55,.05,0x1c1e22);const dl=D.L(D.B('core','win'),z.door.x,z.door.z,ry,0);dl.quad(1.0,2.5,-.58,1.5,.2,null);dl.quad(1.0,2.5,.58,1.5,.2,null);
  Ld.box(.9,1.9,.5,6.0,.95,.4,0x3a3e44);Ld.box(.6,.45,.04,6.0,1.5,.68,0x6ad0f0);Ld.box(.5,.04,.2,6.0,1.12,.62,0x15171a);
 }
 if(z.id==='bureau'){
  D.zoneSign(z,{y:d.H+.2,off:.5,w:12,h:1.6,draw:signDraw({bg:'#1f7f8f',fg:'#ffffff',t1:'CENTRE TECHNIQUE',t2:'Recherche & développement',w:1,h:1})});
  Lb.box(8.4,.3,3.4,0,4.4,1.8,0x4a5c6c);Lb.box(.2,4.4,.2,-4.0,2.2,3.3,0x4a5c6c);Lb.box(.2,4.4,.2,4.0,2.2,3.3,0x4a5c6c);
  const sd=D.B('core','office'),dl=D.L(sd,z.door.x,z.door.z,ry,0);for(const s of [-1,1]) dl.quad(1.3,2.7,s*.72,1.4,.12,null);
  Lb.box(3.2,.12,.12,0,2.75,.1,0x2a3038);Lb.box(.1,2.8,.1,0,1.4,.1,0x2a3038);
  const py=D.L(core('plain'),z.door.x,z.door.z,ry,0);py.box(1.2,7,.6,-10,3.5,2.4,0x1f7f8f);py.box(1.3,.3,.7,-10,7.1,2.4,0x15566a);
  Ld.box(2.2,.5,.1,8,.25,2.0,0x888);for(let i=0;i<5;i++) Ld.box(.05,.5,.35,7.0+i*.5,.3,2.0,0x555);
  const tr=D.B('detail','plain');}
}
for(const z of zones) if(z.type!=='garage'&&z.type!=='terrain') other(z);

/* ═══════ Terrain industriel à vendre ═══════ */
{const z=ctx.zones.find(q=>q.id==='terrain');if(z){const d=z._d,L=z.loc,hx=d.w/2,dp=d.d,out={x:-z.n.x,z:-z.n.z},ry=Math.atan2(out.x,out.z);
 const rb=(B,u0,u1,v0,v1,y0,y1,col)=>{const a=L(u0,v0),b=L(u1,v1);B.box(Math.abs(a.x-b.x),y1-y0,Math.abs(a.z-b.z),(a.x+b.x)/2,(y0+y1)/2,(a.z+b.z)/2,col);};
 const gw=5.2;
 // sol de gravier, mur bas avec grillage, portail
 rb(core('gravel'),-hx+.2,hx-.2,0,dp,0,.07,0xffffff);
 for(const [u0,u1,v0,v1] of [[-hx-.2,-gw/2,-.2,.2],[gw/2,hx+.2,-.2,.2],[-hx-.2,hx+.2,dp-.2,dp+.2],[-hx-.2,-hx+.2,-.2,dp+.2],[hx-.2,hx+.2,-.2,dp+.2]]) rb(core('conc'),u0,u1,v0,v1,0,d.H,0xb8b4aa);
 const fn=D.B('core','fence');
 const fenceRun=(u0,v0,u1,v1)=>{const a=L(u0,v0),b=L(u1,v1),len=Math.hypot(b.x-a.x,b.z-a.z),ang=Math.atan2(b.x-a.x,b.z-a.z)+PI/2;fn.quad(len,1.5,(a.x+b.x)/2,d.H+.75,(a.z+b.z)/2,ang,null,[0,0,len/1.2,1.5/1.2],0,true);
  const n=Math.max(1,Math.round(len/3));for(let i=0;i<=n;i++){const p=L(u0+(u1-u0)*i/n,v0+(v1-v0)*i/n);core('plain').cyl(.04,.04,1.6,6,p.x,d.H+.8,p.z,0x6a7076);}};
 fenceRun(-hx,0,-gw/2,0);fenceRun(gw/2,0,hx,0);fenceRun(-hx,dp,hx,dp);fenceRun(-hx,0,-hx,dp);fenceRun(hx,0,hx,dp);
 const gp=D.L(core('plain'),L(-gw/2,0).x,L(-gw/2,0).z,0,0);
 for(const s of [-1,1]){const p=L(s*gw/2,0);core('plain').cyl(.1,.1,3.2,8,p.x,1.6,p.z,0x4a5056);}
 // panneau « à vendre »
 D.zoneSign(z,{y:d.H+2.6,off:.5,w:7.5,h:1.7,draw:signDraw({bg:'#d8741a',fg:'#ffffff',t1:'TERRAIN À VENDRE',t2:'Zone industrielle · Tél. 05 00 00 00',w:1,h:1})});
 for(const s of [-1,1]){const p=L(s*3.6,0);core('plain').cyl(.07,.07,4.4,8,p.x+out.x*.4,2.2+d.H*.5,p.z+out.z*.4,0x3a3e44);}
 // barils, bungalow de chantier, dalle, matériaux
 for(const [u,v,r] of [[-12,10,.5],[-10,12,.5],[14,22,.5]]){const p=L(u,v);det('plain').cyl(r*.6,r*.6,1,12,p.x,.5,p.z,0x3a5a8a);det('plain').cyl(r*.62,r*.62,.06,12,p.x,.4,p.z,0x2a4a7a);det('plain').cyl(r*.62,r*.62,.06,12,p.x,.78,p.z,0x2a4a7a);}
 {const p=L(8,10),b=core('plain');b.box(6,2.6,2.4,p.x,1.3,p.z,0xe6e4de);b.box(6.2,.14,2.6,p.x,2.67,p.z,0x8a3a2a);b.box(6.1,.2,2.5,p.x,.1,p.z,0x4a4c50);
  const pw=D.L(D.B('core','win'),p.x,p.z,ry,0),pd=D.L(b,p.x,p.z,ry,0);
  pw.quad(1.1,1.0,-1.8,1.5,1.21,null);pw.quad(1.1,1.0,1.4,1.5,1.21,null);pd.box(1.0,2.0,.08,.2,1.0,1.23,0x4a3a2a);pd.box(1.2,.06,1.1,.2,.03,1.8,0x9a9a92);
  const sd=D.L(det('plain'),p.x,p.z,ry,0);sd.box(.08,.4,.06,-.4,1.2,1.25,0x222);}
 {const p=L(-6,26);core('conc').box(14,.1,10,p.x,.06,p.z,0xa8a49c);}
 {const p=L(-14,28);const b=D.B('core','plain');b.box(6.1,2.6,2.4,p.x,1.3,p.z,0x2a5a8a);b.box(6.2,.1,2.5,p.x,2.65,p.z,0x244e78);addCol(p.x,p.z,6.1,2.4);
  const q=L(-14,24.6);b.box(6.1,2.6,2.4,q.x,1.3,q.z,0xa83a2a);b.box(6.2,.1,2.5,q.x,2.65,q.z,0x8a2e20);addCol(q.x,q.z,6.1,2.4);}
 for(let i=0;i<4;i++){const p=L(10+(i%2)*1.3,18+Math.floor(i/2)*1.3);det('wood').box(1.2,.14,1.2,p.x,.12,p.z,0x9a7a50);det('plain').box(1.0,.5,1.0,p.x,.45,p.z,[0xc88a5a,0xc88a5a,0xb8b4aa,0x888][i]);}
 {const p=L(-8,16);det('plain').cyl(.05,2.8,2.0,12,p.x,1.0,p.z,0x9a9488);det('plain').cyl(.05,2.0,1.4,12,p.x+3.5,.7,p.z+1.5,0xa89c88);}
 addCol(L(-8,16).x,L(-8,16).z,3.8,3.8);
 {const p=L(3,30);const ex=D.L(det('plain'),p.x,p.z,.6,0);ex.box(2.4,.7,1.6,0,.6,0,0xd8a020);ex.box(1.2,1.1,1.4,-.4,1.4,0,0xd8a020);ex.box(.14,2.2,.14,.9,1.7,0,0x444);ex.rbox(.12,.12,2.2,1.5,2.7,0,0x444,0,0,-.4);
  for(const s of [-1,1]) ex.box(2.6,.4,.5,0,.2,s*.8,0x222);}
}}

/* ═══════ Animation : les bras des ponts suivent la voiture ═══════ */
D.animFn=(dt,P)=>{if(!lifts.length) return;let cars=null;
 for(const Lf of lifts){const p=Lf.p;if(Math.abs(P.x-p.x)>45||Math.abs(P.z-p.z)>45) continue;if(!cars) cars=ctx.scene.children.filter(o=>o.userData&&o.userData.L&&o.isObject3D&&o.position);
  let cg=null;for(const c of cars) if(Math.abs(c.position.x-p.x)<.9&&Math.abs(c.position.z-p.z)<.9){cg=c;break;}
  if(cg!==Lf.carRef){Lf.carRef=cg;Lf.pad=null;
   if(cg){const an=cg.userData.anchors,fl=an&&an.hubFL,rl=an&&an.hubRL;
    if(fl&&rl){const hx=Math.max(.5,Math.abs(fl.position.x)-.14),zf=fl.position.z-.62,zr=rl.position.z+.62;Lf.pad={f:zf,r:Math.min(zr,zf-.5),x:hx};}
    else Lf.pad={f:.8,r:-.8,x:.7};}}
  stepLift(Lf,dt,cg);}};
};

/* ═══════ Cour du travail au noir et voisinage (créés après la construction du module 43) ═══════ */
(()=>{let done=false;
 MW.on('start',()=>{if(done||!MWD.ctx) return;done=true;const D=MWD,T=D.T,sc=MW.scene,PI=Math.PI;
  // gravier sur la dalle de la cour
  sc.traverse(o=>{const g=o.geometry;if(o.isMesh&&g&&g.parameters&&g.parameters.width===28&&g.parameters.height===.08&&g.parameters.depth===17){
   const t=D.tex('gravel').clone();t.needsUpdate=true;t.repeat.set(9,6);const m=new T.MeshLambertMaterial({map:t,color:0xffffff});m.userData.lin=1;o.material=m;o.receiveShadow=true;}});
  const g=D.group(B=>{const pl=B('plain'),cn=B('conc'),wd=B('wood'),hs=B('win'),pa=B('plaster');
   // murets de la cour (ouvertures côté studio et à l'entrée)
   for(const [x,z,w,d] of [[-42.4,40.5,.3,17.3],[-36,31.8,12,.3],[-19,31.8,10,.3],[-37.5,49.3,9,.3],[-18.5,49.3,9,.3]]){cn.box(w,1.15,d,x,.575,z,0xcfcac0);cn.box(w+(w>d?0:.1),.1,d+(d>w?0:.1),x,1.2,z,0xaaa69c);}
   for(const [x,z] of [[-42.4,32],[-42.4,49.2],[-31,31.8],[-24,31.8],[-33,49.3],[-23,49.3],[-14,49.3],[-14,31.8]]) cn.box(.5,1.5,.5,x,.75,z,0xb8b4aa);
   // clôture et jardin de Mme Ricard
   for(let i=0;i<22;i++){const z=33.3+i*.7;wd.box(.06,.9,.12,-13.4,.45,z,0xf4f0e6);}wd.box(.05,.06,15.4,-13.4,.7,40.8,0xe8e4da);wd.box(.05,.06,15.4,-13.4,.3,40.8,0xe8e4da);
   for(const [x,z,c] of [[-11,34.6,0xd8408a],[-9.4,34.6,0xf0c020],[-7.6,34.6,0xe05a2a],[-5.8,34.6,0xf4f0f0],[-4.4,34.8,0xa040c0],[-11,46.6,0xf0c020],[-8.6,46.8,0xd8408a],[-6.2,46.6,0xe05a2a],[-4.2,46.7,0xf4f0f0]]){pl.box(1.3,.25,.7,x,.13,z,0x5a3a22);for(let k=0;k<4;k++) pl.sph(.16,.16,.16,0,x-.45+k*.3,.42+((k*7)%3)*.05,z+((k%2)-.5)*.2,c);}
   // abri de jardin
   pa.box(2.2,2.0,1.6,-5.0,1.0,48.2,0xc8d4bc);pl.box(2.4,.12,1.8,-5.0,2.06,48.2,0x6a4a38);pl.box(.8,1.6,.06,-5.0,.85,47.38,0x6a4a38);
   // fenêtres de la maison de Mme Ricard (faces sud, est et nord ; la face ouest est gérée par le module 43)
   const win=(x,z,ry,lit)=>hs.quad(1.3,1.5,x,3.2,z,ry,null);
   for(const x of [-10.5,-5.5]) {hs.quad(1.2,1.5,x,1.9,44.53,0,null);hs.quad(1.2,1.5,x,4.1,44.53,0,null);hs.quad(1.2,1.5,x,4.1,36.47,PI,null);}
   for(const z of [38.5,42.5]){hs.quad(1.2,1.5,-3.47,1.9,z,PI/2,null);hs.quad(1.2,1.5,-3.47,4.1,z,PI/2,null);}
   pl.box(1.3,2.3,.14,-8,1.15,44.55,0x5a3a2a);pl.box(2.0,.12,1.0,-8,2.7,45.0,0x8a4a3a);cn.box(2.0,.15,.8,-8,.08,45.2,0xcfc8b8);
   pl.box(.08,2.4,.08,-3.6,6.5,38,0x30343a);
   // tuyaux, pot de fleurs, poubelles roulantes de la cour
   for(const [x,z,c] of [[-41.4,34.2,0x2f5a3a],[-40.7,34.2,0xe6c020],[-41.4,46.4,0x2f5a3a]]){pl.cyl(.3,.27,.95,10,x,.48,z,c);pl.cyl(.32,.32,.07,10,x,.97,z,c);}
   pl.box(.9,1.1,.7,-41.1,.55,38.6,0x7a7a7e);pl.box(.8,.06,.5,-41.1,1.13,38.6,0x2a2a2e);
   // palettes et pneus usagés le long du muret ouest
   for(let k=0;k<4;k++){pl.cyl(.32,.32,.2,12,-41.2,.1+k*.2,41.8,0x1a1a1c);pl.cyl(.2,.2,.21,10,-41.2,.1+k*.2,41.8,0x8a8e94);}
   wd.box(1.2,.14,1.0,-41.0,.08,44.0,0x9a7a50);wd.box(1.2,.14,1.0,-41.0,.22,44.0,0x8a6a44);
   // lampadaire de la cour
   pl.cyl(.08,.1,5.5,8,-14.5,2.75,47,0x3b4349);pl.box(.9,.12,.4,-14.1,5.5,47,0x50575d);
   });
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});sc.add(g);
  // arbre et haie côté voisine
  const g2=D.group(B=>{const pl=B('plain');for(const [x,z] of [[-8.5,31.2],[-12.0,48.2]]){pl.cyl(.14,.22,2.4,6,x,1.2,z,0x5a3e28);pl.sph(1.5,1.3,1.5,1,x,3.4,z,0x3f7a2a,.4);pl.sph(1.1,1.0,1.1,1,x+.6,4.2,z+.2,0x58963a,1);}
   });
  sc.add(g2);MWD.fix&&MWD.fix(sc);
 });
})();
