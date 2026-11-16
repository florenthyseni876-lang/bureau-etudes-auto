'use strict';
/* ───────────── Mode « Mécanicien » — INTÉRIEURS DES USINES (MWU) ─────────────
   Les deux usines à acheter (usine1 : atelier de fabrication Marchand ; usine2 : grande usine du Vallon) se visitent.
   Leur façade (js/45b) est pleine : l'intérieur est une salle à part, construite dans le coin nord-est de la carte
   (hors des rues) et SEULEMENT quand le joueur approche de la porte ou entre. Elle est masquée quand on est dehors
   et détruite quand on s'éloigne : aucun coût en rue.
   ═══ Objet global `MWU` (aussi `window.__mwu`) ═══
   MWU.enter(id)    entre dans l'usine (à pied) ; MWU.leave() en sort ; MWU.inside() renvoie l'id de l'usine où l'on se trouve, ou null
   MWU.built(id)    vrai si l'intérieur est construit ; MWU.info(id) {fac, nomFac, cap, charges, …} ; MWU.stats() {calls, objets}
   MWU.bureau(id)   ouvre le panneau du bureau d'études (nom de la marque, capacité, fondation)
   MWU.board(id)    ouvre le tableau de production (capacité, avancement de la chaîne)
   Animations : chaîne d'assemblage qui avance, robots de soudure, bras de peinture, pont roulant, banc d'essai, chariot. */
const MWU=(()=>{
const api={},T=THREE,PI=Math.PI;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=x=>MW.fmt(x);
/* emplacement des salles : coin nord-est, au-delà des rues (x>200, z<-200), disjointes */
const SPOTS={
 usine1:{cx:245,cz:-268,w:44,d:30,H:7.2,big:false},
 usine2:{cx:245,cz:-222,w:60,d:40,H:9.5,big:true}};
const IDS=Object.keys(SPOTS);
let cur=null,clock=0;
const B={}; /* intérieurs construits : id → {group, walls, upd, geos, tex, run} */

/* ═══ matériaux et lots de géométries fusionnées (une couleur = un maillage) ═══ */
const MT=new Map();
function mat(c,o){o=o||{};const k=c+'|'+(o.lit?1:0)+(o.glass?1:0);let m=MT.get(k);if(m) return m;
 if(o.lit) m=new T.MeshBasicMaterial({color:c});
 else if(o.glass) m=new T.MeshLambertMaterial({color:c,transparent:true,opacity:.26,depthWrite:false});
 else{m=new T.MeshLambertMaterial({color:c});m.emissive=new T.Color(c).multiplyScalar(.3);}
 MT.set(k,m);return m;}
function Batch(){const g=new Map();
 const add=(geo,col,o,x,y,z,e)=>{o=o||{};const k=col+'|'+(o.lit?1:0)+(o.glass?1:0);let b=g.get(k);if(!b){b={col,o,p:[],n:[],i:[],c:0};g.set(k,b);}
  const m=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(e?e[0]:0,e?e[1]:0,e?e[2]:0,'YXZ')),new T.Vector3(1,1,1));
  geo.applyMatrix4(m);const p=geo.attributes.position.array,n=geo.attributes.normal.array,ix=geo.index.array;
  for(let i=0;i<p.length;i++){b.p.push(p[i]);b.n.push(n[i]);}
  for(let i=0;i<ix.length;i++) b.i.push(ix[i]+b.c);b.c+=p.length/3;geo.dispose();};
 return{
  box(w,h,d,x,y,z,col,o,e){add(new T.BoxGeometry(w,h,d),col,o,x,y,z,e);},
  cyl(r,h,x,y,z,col,o,e,r2){add(new T.CylinderGeometry(r2==null?r:r2,r,h,12),col,o,x,y,z,e);},
  build(parent,geos){const out=[];for(const b of g.values()){const ge=new T.BufferGeometry();ge.setAttribute('position',new T.Float32BufferAttribute(b.p,3));ge.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));ge.setIndex(b.i);
   const me=new T.Mesh(ge,mat(b.col,b.o));if(b.o.glass) me.renderOrder=2;parent.add(me);geos.push(ge);out.push(me);}return out;}};}

/* ═══ textures dessinées (enseignes, écrans, plans) ═══ */
function canvasTex(w,h,draw,store){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.anisotropy=2;if(store) store.push(t);return {t,c};}
const sans='"Barlow Condensed","Arial Narrow",Arial,sans-serif';
function signDraw(txt,bg,fg){return (x,w,h)=>{x.fillStyle=bg;x.fillRect(0,0,w,h);x.strokeStyle=fg;x.lineWidth=h*.06;x.strokeRect(h*.08,h*.08,w-h*.16,h-h*.16);
 x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';let f=h*.5;x.font='bold '+f+'px '+sans;while(x.measureText(txt).width>w*.86&&f>12){f-=2;x.font='bold '+f+'px '+sans;}x.fillText(txt,w/2,h*.54);};}
function blueprint(x,w,h){x.fillStyle='#16406e';x.fillRect(0,0,w,h);x.strokeStyle='rgba(180,220,255,.25)';x.lineWidth=1;for(let i=0;i<w;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke();}for(let j=0;j<h;j+=16){x.beginPath();x.moveTo(0,j);x.lineTo(w,j);x.stroke();}
 x.strokeStyle='#e8f4ff';x.lineWidth=2.5;x.beginPath();x.moveTo(w*.1,h*.62);x.lineTo(w*.18,h*.62);x.bezierCurveTo(w*.22,h*.4,w*.34,h*.34,w*.46,h*.34);x.lineTo(w*.6,h*.34);x.bezierCurveTo(w*.7,h*.36,w*.76,h*.5,w*.84,h*.55);x.lineTo(w*.92,h*.62);x.lineTo(w*.1,h*.62);x.stroke();
 for(const cx of [.26,.76]){x.beginPath();x.arc(w*cx,h*.64,h*.09,0,7);x.stroke();}x.font='bold 18px '+sans;x.fillStyle='#e8f4ff';x.textAlign='left';x.fillText('PLAN GÉNÉRAL — ÉCHELLE 1:20',w*.08,h*.12);x.font='14px '+sans;x.fillText('Empattement · voies · masse · centre de gravité',w*.08,h*.2);}

/* ═══ une voiture en construction (cinq états de la chaîne) ═══ */
function carGeos(){
 const fr=Batch();fr.box(1.7,.22,4.1,0,.55,0,0x3a3f46);fr.box(.9,.5,1.1,0,.9,1.3,0x555b63);fr.box(.12,.14,3.9,.7,.4,0,0x2a2d32);fr.box(.12,.14,3.9,-.7,.4,0,0x2a2d32);
 const wh=Batch();for(const sx of [-1,1]) for(const sz of [-1.3,1.3]) wh.cyl(.34,.26,sx*.92,.34,sz,0x141414,null,[0,0,PI/2]);
 const g=new T.Group(),tmp=[];fr.build(g,tmp);wh.build(g,tmp);
 const G={frame:g.children[0].geometry,wheels:g.children[1].geometry,body:new T.BoxGeometry(1.8,.7,4.3),cabin:new T.BoxGeometry(1.6,.55,2.2),
  all:[g.children[0].geometry,g.children[1].geometry]};
 G.body.translate(0,.35,0);G.cabin.translate(0,.275,0);G.all.push(G.body,G.cabin);return G;}
function unit(G,col){
 const g=new T.Group(),bm=new T.MeshLambertMaterial({color:0x9aa0a8});
 const frame=new T.Mesh(G.frame,mat(0x3a3f46)),body=new T.Mesh(G.body,bm),cab=new T.Mesh(G.cabin,mat(0x2b3a4a)),wh=new T.Mesh(G.wheels,mat(0x141414));
 body.position.y=.78;cab.position.set(0,1.46,-.2);g.add(frame,body,cab,wh);
 const U={g,bm,body,cab,wh,col,stage:-1};return U;}
const PRIMER=0xcfd3d8,RAW=0x8f959c;
function setStage(U,s){if(U.stage===s) return;U.stage=s;
 U.body.visible=s>=1;U.cab.visible=s>=2;U.wh.visible=s>=4;
 const c=s>=3?U.col:s===2?PRIMER:RAW;U.bm.color.setHex(c);U.bm.emissive.setHex(c).multiplyScalar(.28);}
const CARCOL=[0xc4281c,0x2a5a9a,0xe8e8e8,0x2f6a3a,0xd8a020,0x1c1c22,0x7a3a8a,0xe86a1c];

/* ═══ construction d'une salle ═══ */
function build(id){
 const S=SPOTS[id],big=S.big,cx=S.cx,cz=S.cz,w=S.w,d=S.d,H=S.H,hw=w/2,hd=d/2;
 const grp=new T.Group();grp.name='usine-int-'+id;grp.visible=false;
 const o={group:grp,walls:[],upd:[],geos:[],tex:[],run:0,run2:0};
 const st=Batch();
 const bx=(W,Hh,D,u,y0,v,c,op,e)=>st.box(W,Hh,D,cx+u,y0+Hh/2,cz+v,c,op,e);
 const cl=(W,D,u,v)=>{const r=[cx+u-W/2,cz+v-D/2,cx+u+W/2,cz+v+D/2];MW.walls.push(r);o.walls.push(r);};
 const LIT={lit:1},GL={glass:1};
 const label=(txt,u,y,v,W,bg,fg,ry)=>{const {t}=canvasTex(512,128,signDraw(txt,bg||'#1f3a5a',fg||'#fff'),o.tex);
  const m=new T.Mesh(new T.PlaneGeometry(W,W/4),new T.MeshBasicMaterial({map:t}));m.position.set(cx+u,y,cz+v);m.rotation.y=ry||0;grp.add(m);o.geos.push(m.geometry);return m;};
 /* — coque : sol, murs, toit, fermes, éclairage — */
 bx(w,.1,d,0,-.05,0,0x7d8084);
 bx(w+1,H,.5,0,0,-hd-.25,0xc9ccc4);bx(w+1,H,.5,0,0,hd+.25,0xc9ccc4);bx(.5,H,d,-hw-.25,0,0,0xc9ccc4);bx(.5,H,d,hw+.25,0,0,0xc9ccc4);
 bx(w+1,.4,d+1,0,H,0,0x9a9ea4);
 bx(w,.9,.1,0,0,-hd+.06,0x4a6a8a);bx(w,.9,.1,0,0,hd-.06,0x4a6a8a); /* bandeau bleu bas de mur */
 for(let u=-hw+4;u<hw;u+=big?6:7){bx(.35,.5,d,u,H-.9,0,0x3a3f46);}
 for(let v=-hd+5;v<hd;v+=big?8:7.5) bx(w,.3,.3,0,H-1.2,v,0x3a3f46);
 for(let u=-hw+6;u<hw-3;u+=big?9:8) for(let v=-hd+6;v<hd-2;v+=big?9:8) bx(4.2,.12,.5,u,H-1.35,v,0xfff4d0,LIT);
 for(let u=-hw+6;u<hw-3;u+=big?9:8) bx(2.4,1.3,.08,u,H-3.4,-hd+.1,0xbfd8f0,LIT);
 for(let u=-hw+6;u<hw-3;u+=big?9:8) bx(2.4,1.3,.08,u,H-3.4,hd-.1,0xbfd8f0,LIT);
 /* grande porte roulante (sortie), côté sud */
 bx(5.4,4.6,.16,0,0,hd-.2,0x59616a);for(let k=0;k<9;k++) bx(5.2,.05,.2,0,.4+k*.5,hd-.22,0x474e56);
 bx(5.8,.3,.22,0,4.7,hd-.24,0xe6c020);bx(.3,4.8,.22,-2.8,0,hd-.24,0xe6c020);bx(.3,4.8,.22,2.8,0,hd-.24,0xe6c020);
 bx(2.0,2.4,.2,-4.4,0,hd-.2,0x6a4a34);bx(1.7,2.1,.22,-4.4,0,hd-.22,0xd8d4c8);
 label(big?'GRANDE USINE DU VALLON':'ATELIER MARCHAND',0,H-1.8,hd-.4,big?9:7,'#1a4a8a','#fff',PI);
 /* marquage au sol : couloirs piétons jaunes */
 for(const s of [-1,1]) bx(.15,.02,d-6,s*3.5,.05,-1,0xe8c020);
 bx(7.15,.02,.15,0,.05,hd-3.4,0xe8c020);
 cl(w+2,1,0,-hd-.5);cl(w+2,1,0,hd+.5);cl(1,d+2,-hw-.5,0);cl(1,d+2,hw+.5,0);

 /* — chaîne d'assemblage — */
 const L={u0:big?-27:-14,u1:big?27:14,v:big?-4:-3};
 bx(L.u1-L.u0+2,.45,2.6,(L.u0+L.u1)/2,0,L.v,0x2c3036);
 bx(L.u1-L.u0+2,.03,.2,(L.u0+L.u1)/2,.45,L.v-1.2,0xe6c020,LIT);bx(L.u1-L.u0+2,.03,.2,(L.u0+L.u1)/2,.45,L.v+1.2,0xe6c020,LIT);
 for(let u=L.u0;u<=L.u1;u+=3) bx(.25,.7,2.9,u,0,L.v,0x454b53);
 if(big){cl(44.5,3.6,-5.25,L.v);cl(14,3.6,20.5,L.v);} else{cl(10.5,3.4,-8.75,L.v);cl(10.5,3.4,8.75,L.v);}
 const G=carGeos();o.geos.push(...G.all);
 const units=[],N=big?7:4,span=L.u1-L.u0;
 for(let i=0;i<N;i++){const U=unit(G,CARCOL[i%CARCOL.length]);U.g.rotation.y=PI/2;U.ph=i/N;grp.add(U.g);units.push(U);}
 const speed=big?1.5:.9;
 o.upd.push((t,dt)=>{for(const U of units){const f=(((U.ph+t*speed/span)%1)+1)%1,u=L.u0+f*span;
  U.g.position.set(cx+u,.45,cz+L.v);
  setStage(U,f<.12?0:f<(big?.39:.33)?1:f<(big?.5:.45)?2:f<(big?.61:.58)?3:f<.8?4:5);}});
 /* cabine de peinture (grande usine) */
 let sprays=[];
 if(big){
  const pu=1,pw=14;
  for(const s of [-1,1]){bx(pw,3.6,.1,pu,.45,L.v+s*2.5,0xb8d8f0,GL);bx(pw,.2,.2,pu,3.9,L.v+s*2.5,0x2a5db0);}
  bx(pw,.1,5.2,pu,4.0,L.v,0xb8d8f0,GL);for(const s of [-1,1]) for(const e of [-pw/2,pw/2]) bx(.25,3.8,.25,pu+e,.45,L.v+s*2.5,0x2a5db0);
  bx(pw+1,.3,6,pu,4.1,L.v,0x6a727a);
  label('CABINE DE PEINTURE',pu,5.6,L.v+2.8,6,'#2a5db0','#fff',PI);
  for(let k=0;k<2;k++){const g=new T.Group();g.position.set(cx+pu,3.5,cz+L.v);
   const m=new T.Mesh(new T.BoxGeometry(.3,.3,4.4),mat(0x5a626a));g.add(m);
   const nz=new T.Mesh(new T.BoxGeometry(.22,.7,.22),mat(0xe86a1c));nz.position.set(0,-.45,k?1.5:-1.5);g.add(nz);o.geos.push(m.geometry,nz.geometry);
   const mist=new T.Mesh(new T.BoxGeometry(.9,1.4,.9),new T.MeshBasicMaterial({color:0xe8e8ff,transparent:true,opacity:.18,depthWrite:false}));mist.position.set(0,-1.3,k?1.5:-1.5);g.add(mist);o.geos.push(mist.geometry);
   grp.add(g);sprays.push([g,k]);}
  o.upd.push((t)=>{for(const [g,k] of sprays){g.position.x=cx+pu+Math.sin(t*1.2+k*2)*4.5;g.position.z=cz+L.v+Math.sin(t*.7+k)*.5;}});
 }
 /* robots de soudure (de part et d'autre de la chaîne) */
 const robots=[],rpos=big?[[-14,-1],[-14,1],[-9.5,-1],[-9.5,1]]:[];
 const AG=[new T.BoxGeometry(.3,.3,1.9),new T.BoxGeometry(.22,.22,1.6),new T.BoxGeometry(.2,.2,.2)];o.geos.push(...AG);
 for(const [u,s] of rpos){
  bx(1.1,.25,1.1,u,0,L.v+s*3.6,0x3a3f46);bx(.7,1.7,.7,u,.25,L.v+s*3.6,0xe86a1c);
  const g=new T.Group();g.position.set(cx+u,2.1,cz+L.v+s*3.6);
  const up=new T.Group();const um=new T.Mesh(AG[0],mat(0xe8e8e8));um.position.z=.95;up.add(um);
  const fo=new T.Group();fo.position.z=1.9;const fm=new T.Mesh(AG[1],mat(0xe86a1c));fm.position.z=.8;fo.add(fm);
  const tip=new T.Mesh(AG[2],new T.MeshBasicMaterial({color:0xffe080}));tip.position.z=1.7;fo.add(tip);
  up.add(fo);g.add(up);grp.add(g);robots.push({g,up,fo,tip,s,ph:u*.7});cl(1.2,1.2,u,L.v+s*3.6);}
 o.upd.push((t)=>{for(const r of robots){r.g.rotation.y=(r.s>0?PI:0)+Math.sin(t*1.1+r.ph)*.45;r.up.rotation.x=.55+Math.sin(t*1.9+r.ph)*.22;r.fo.rotation.x=-.95+Math.sin(t*2.7+r.ph)*.35;
  const k=.5+Math.random()*1.4;r.tip.scale.set(k,k,k);}});
 /* tableau de production et signalisation de la chaîne */
 label(big?'CHAÎNE D’ASSEMBLAGE':'PETITE CHAÎNE DE MONTAGE',big?-12:0,big?5.4:4.2,L.v+(big?3.3:2.4),big?7:5.5,'#c86a1a','#fff',PI);
 const bu=big?-22:-12,bv=L.v+4;
 bx(1.8,1.3,.5,bu,0,bv,0x4a4f55);const scr=canvasTex(256,128,(x,w2,h2)=>{x.fillStyle='#0b2a18';x.fillRect(0,0,w2,h2);x.fillStyle='#46ff7a';x.font='bold 26px '+sans;x.textAlign='center';x.fillText('PRODUCTION',w2/2,40);x.font='bold 34px '+sans;x.fillText(big?'EN MARCHE':'EN SERVICE',w2/2,90);},o.tex);
 const sm=new T.Mesh(new T.PlaneGeometry(1.5,.75),new T.MeshBasicMaterial({map:scr.t}));sm.position.set(cx+bu,1.55,cz+bv+.27);grp.add(sm);o.geos.push(sm.geometry);cl(1.8,.6,bu,bv);
 o.board={x:cx+bu,z:cz+bv+1.4};

 /* — stock de pièces : rayonnages le long du mur ouest — */
 const racks=big?[-14,-6,2,10,18]:[-7,0,7];
 for(const v of racks){const ru=-hw+1.6,len=big?6:5.6;
  for(const e of [-len/2,len/2]) for(const s of [-.6,.6]) bx(.12,3.4,.12,ru+s,0,v+e,0x2a5db0);
  for(let lv=0;lv<4;lv++){bx(1.4,.08,len,ru,.5+lv*.9,v,0x8a929a);
   for(let k=0;k<(big?5:4);k++){const cc=[0xe8c020,0xc83030,0xf0f0f0,0x3aa050,0xd8841a][(k+lv)%5];bx(.9,.5,.9,ru,.58+lv*.9,v-len/2+.6+k*(len-1.2)/(big?4:3),cc);}}
  cl(1.8,len+.3,ru,v);}
 label('STOCK DE PIÈCES',-hw+.6,3.9,racks[0]-3.3,3.6,'#3a3f46','#e8c020',PI/2);

 /* — établis et machines (petit atelier) / quai d'expédition — */
 if(!big){
  for(const u of [-10,-3.5,3,9.5]){bx(3,.9,1,u,0,-hd+1.4,0x8a6a44);bx(3.2,.07,1.15,u,.9,-hd+1.4,0xb08a5a);bx(.35,.35,.5,u-1,.97,-hd+1.4,0x2a2c30);bx(.7,.5,.4,u+.7,.97,-hd+1.3,0xc02020);cl(3.2,1.1,u,-hd+1.4);}
  label('ÉTABLIS',0,H-1.2,-hd+.7,3,'#8a6a44','#fff');
  /* machines-outils : tours avec mandrin qui tourne */
  const chucks=[];
  for(const u of [-12,-6]){bx(2.6,1.0,1.1,u,0,-hd+4.6,0x3a6a8a);bx(.6,.6,.8,u-.9,1.0,-hd+4.6,0x2a2c30);bx(.4,.4,.4,u+.9,1.0,-hd+4.6,0xc02020);
   const ch=new T.Mesh(new T.CylinderGeometry(.28,.28,.2,10),mat(0x9aa0a8));ch.rotation.z=PI/2;ch.position.set(cx+u-.35,1.35,cz-hd+4.6);grp.add(ch);o.geos.push(ch.geometry);chucks.push(ch);cl(2.8,1.2,u,-hd+4.6);}
  o.upd.push((t)=>{for(const c of chucks) c.rotation.x=t*14;});
  /* quai : portes d'expédition, palettes, une voiture finie */
  for(let k=0;k<2;k++){const v=-2+k*7;bx(.2,3.4,3.6,hw-.1,0,v,0x59616a);for(let j=0;j<6;j++) bx(.22,.05,3.4,hw-.12,.4+j*.5,v,0x474e56);bx(.25,.3,4.0,hw-.12,3.4,v,0xe6c020);}
  for(const v of [-2,5]) for(let k=0;k<2;k++){bx(1.2,.15,1.2,hw-2.6,0,v-.8+k*1.6,0xb08a5a);bx(1,.9,1,hw-2.6,.15,v-.8+k*1.6,[0xd0a060,0xe0e0e0][k]);cl(1.3,1.3,hw-2.6,v-.8+k*1.6);}
  label('EXPÉDITION',hw-.5,H-1.6,1.5,4,'#3a7a4a','#fff',-PI/2);
  const U=unit(G,0xc4281c);U.g.rotation.y=PI/2+.2;U.g.position.set(cx+6,0,cz+9);grp.add(U.g);setStage(U,5);cl(2,4.5,6,9);
  /* bureau : table à plans, coin nord-est */
  const bu2=hw-4,bv2=-hd+5;
  bx(3,.08,1.4,bu2,.9,bv2,0xd8d4c8);for(const sx of [-1.3,1.3]) for(const sz of [-.55,.55]) bx(.1,.9,.1,bu2+sx,0,bv2+sz,0x4a4f55);
  const bp=canvasTex(256,128,blueprint,o.tex);const pm=new T.Mesh(new T.PlaneGeometry(2.8,1.3),new T.MeshBasicMaterial({map:bp.t}));pm.rotation.x=-PI/2;pm.position.set(cx+bu2,.96,cz+bv2);grp.add(pm);o.geos.push(pm.geometry);
  bx(1.1,.5,.9,bu2+3,0,bv2+.5,0x2a5db0);bx(.6,.4,.05,bu2+3,.9,bv2+.2,0x1c1c22);cl(3.2,1.6,bu2,bv2);
  label('BUREAU D’ÉTUDES',bu2,H-2.2,bv2-1.1,4.2,'#2a5db0','#fff');
  o.desk={x:cx+bu2,z:cz+bv2+1.3};
 }else{
  /* — banc d'essai moteur (coin nord-ouest) — */
  const du=-hw+10,dv=-hd+6.5;
  bx(8,.12,6,du,0,dv,0x3a4a5a);for(const s of [-1,1]){bx(8,.5,.08,du,.12,dv+s*3,0xe8c020);bx(.08,.5,6,du+s*4,.12,dv,0xe8c020);}
  bx(2.6,.6,1.6,du,.12,dv,0x4a4f55);bx(1.2,.9,.8,du-.2,.72,dv,0x6a727a);bx(.7,.35,.7,du-.2,1.5,dv,0x9aa0a8);bx(.25,.7,.25,du+.7,1.5,dv+.2,0xd8841a);
  bx(.3,.3,2.6,du-.2,.9,dv-2,0x7a7f86);bx(1.0,2.2,.5,du+3.2,0,dv-2.2,0x4a4f55);
  const fw=new T.Mesh(new T.CylinderGeometry(.62,.62,.22,16),mat(0x9aa0a8));fw.rotation.z=PI/2;fw.position.set(cx+du+1.2,1.15,cz+dv);grp.add(fw);o.geos.push(fw.geometry);
  const rim=new T.Mesh(new T.BoxGeometry(.24,.12,1.3),mat(0xc02020));rim.position.copy(fw.position);rim.position.x+=.01;grp.add(rim);o.geos.push(rim.geometry);
  cl(2.8,1.8,du,dv);cl(1.2,.8,du+3.2,dv-2.2);
  const rp=canvasTex(256,128,()=>{},o.tex),rc=rp.c.getContext('2d');
  const drawRpm=(rpm,ch)=>{rc.fillStyle='#08141f';rc.fillRect(0,0,256,128);rc.fillStyle=ch?'#ffb02a':'#46d2ff';rc.font='bold 22px '+sans;rc.textAlign='left';rc.fillText('BANC D’ESSAI',12,28);
   rc.font='bold 46px '+sans;rc.fillText(Math.round(rpm)+' tr/min',12,80);rc.font='20px '+sans;rc.fillText(ch?'ESSAI EN COURS':'PRÊT',12,114);rp.t.needsUpdate=true;};drawRpm(0,false);
  bx(2.2,1.0,.8,du,0,dv+3.9,0x4a4f55);const rm=new T.Mesh(new T.PlaneGeometry(1.8,.9),new T.MeshBasicMaterial({map:rp.t}));rm.position.set(cx+du,1.5,cz+dv+3.45);rm.rotation.x=-.35;grp.add(rm);o.geos.push(rm.geometry);cl(2.4,1,du,dv+3.9);
  label('BANC D’ESSAI MOTEUR',du,5.0,dv+3.6,5,'#c01818','#fff',PI);
  o.banc={x:cx+du,z:cz+dv+3};let rpm=0,lastDraw=0;
  o.upd.push((t,dt)=>{const run=o.run>0;if(run) o.run-=dt;const tg=run?1000+Math.min(1,(8-o.run)/3)*5500+Math.sin(t*9)*180:0;rpm+=(tg-rpm)*Math.min(1,dt*1.6);fw.rotation.x+=rpm/60*dt*PI*2*.12;
   if(t-lastDraw>.15){lastDraw=t;drawRpm(rpm,run);}});

  /* — bureau d'études (verrière au nord-est) — */
  const bu2=hw-8,bv2=-hd+6;
  bx(14,.1,9,bu2,0,bv2,0xbfc4cc);
  for(const [wx,wz,ww,wd] of [[bu2,bv2+4.5,14,.1],[bu2-7,bv2,.1,9],[bu2,bv2-4.5,14,.1]]) {bx(ww,2.8,wd,wx,.1,wz,0xb8d8f0,GL);bx(ww+(ww<1?0:.2),.15,wd+(wd<1?0:.2),wx,2.9,wz,0x2a5db0);}
  bx(14,.15,9,bu2,3.0,bv2,0xdfe4ea);
  for(const dx of [-3,2.6]){bx(2.4,.08,1.1,bu2+dx,.75,bv2-3,0xd8d4c8);bx(.08,.75,.9,bu2+dx-1,0,bv2-3,0x4a4f55);bx(.08,.75,.9,bu2+dx+1,0,bv2-3,0x4a4f55);bx(.7,.45,.05,bu2+dx,.9,bv2-3.3,0x4a8ad8,LIT);bx(.5,.45,.5,bu2+dx,0,bv2-2.3,0x2a2c30);}
  const tu=bu2-1.5,tv=bv2+.8;
  bx(3.4,.1,1.8,tu,.95,tv,0xd8d4c8,null,[-.28,0,0]);for(const sx of [-1.5,1.5]){bx(.1,1,.1,tu+sx,0,tv-.7,0x4a4f55);bx(.1,.8,.1,tu+sx,0,tv+.7,0x4a4f55);}
  const bp=canvasTex(256,128,blueprint,o.tex);const pm=new T.Mesh(new T.PlaneGeometry(3.2,1.6),new T.MeshBasicMaterial({map:bp.t}));pm.rotation.x=-PI/2-.28;pm.position.set(cx+tu,1.07,cz+tv);grp.add(pm);o.geos.push(pm.geometry);
  const wb=canvasTex(512,256,blueprint,o.tex);const wm=new T.Mesh(new T.PlaneGeometry(4,2),new T.MeshBasicMaterial({map:wb.t}));wm.position.set(cx+bu2+6.9,1.8,cz+bv2);wm.rotation.y=-PI/2;grp.add(wm);o.geos.push(wm.geometry);
  cl(3.6,2.2,tu,tv);cl(2.6,1.2,bu2-3,bv2-3);cl(2.6,1.2,bu2+2.6,bv2-3);
  label('BUREAU D’ÉTUDES',bu2,H-2.2,bv2+4.8,6,'#2a5db0','#fff',PI);
  o.desk={x:cx+tu,z:cz+tv+1.7};

  /* — quai d'expédition (mur est, au sud) : portes, remorque, palettes, voitures finies, chariot — */
  for(let k=0;k<3;k++){const v=3+k*6.5;bx(.2,4.2,4.2,hw-.1,0,v,0x59616a);for(let j=0;j<8;j++) bx(.22,.05,4.0,hw-.12,.4+j*.5,v,0x474e56);bx(.25,.3,4.6,hw-.12,4.2,v,0xe6c020);bx(.25,4.4,.3,hw-.12,0,v-2.3,0xe6c020);bx(.25,4.4,.3,hw-.12,0,v+2.3,0xe6c020);}
  bx(9,3.4,3.0,hw-5.2,.6,9.5,0xf0f0f0);bx(.2,3.2,2.8,hw-.9,.7,9.5,0x2a2c30);bx(9,.4,3,hw-5.2,.2,9.5,0x2a2c30);cl(9,3.2,hw-5.2,9.5);
  label('QUAI D’EXPÉDITION',hw-.5,H-1.8,16,6,'#3a7a4a','#fff',-PI/2);
  for(const [pu,pv] of [[hw-3,2.5],[hw-3,16],[hw-6,22]]){bx(1.3,.15,1.3,pu,0,pv,0xb08a5a);bx(1.1,1.1,1.1,pu,.15,pv,0xd0a060);cl(1.4,1.4,pu,pv);}
  const outs=[[hw-14,14,.4],[hw-14,20,-.3],[hw-21,14,.2],[hw-21,20,0]];
  outs.forEach(([pu,pv,ry],i)=>{const U=unit(G,CARCOL[(i+2)%CARCOL.length]);U.g.rotation.y=PI/2+ry;U.g.position.set(cx+pu,0,cz+pv);grp.add(U.g);setStage(U,5);cl(4.6,2.2,pu,pv);});
  const fk=new T.Group(),fkm=new T.Mesh(new T.BoxGeometry(1.1,1.0,1.7),mat(0xe8a020)),fkf=new T.Mesh(new T.BoxGeometry(.9,.08,1.1),mat(0x2a2c30)),fkp=new T.Mesh(new T.BoxGeometry(.9,.7,.9),mat(0xd0a060)),fkc=new T.Mesh(new T.BoxGeometry(.08,2,.08),mat(0x2a2c30));
  fkm.position.set(0,.6,-.4);fkf.position.set(0,.25,.9);fkp.position.set(0,.65,1.0);fkc.position.set(.5,1.4,-.1);fk.add(fkm,fkf,fkp,fkc);grp.add(fk);o.geos.push(fkm.geometry,fkf.geometry,fkp.geometry,fkc.geometry);
  o.upd.push((t)=>{const k=(Math.sin(t*.35)+1)/2;fk.position.set(cx+hw-3,0,cz+2.5+k*13.5);fk.rotation.y=Math.cos(t*.35)>0?0:PI;});

  /* — pont roulant — */
  for(const s of [-1,1]) bx(w-2,.5,.5,0,H-1.9,s*(hd-2),0x2a5db0);
  const cr=new T.Group(),br=new T.Mesh(new T.BoxGeometry(.7,.6,d-4),mat(0xe8a020)),tr=new T.Mesh(new T.BoxGeometry(1.2,.5,1.2),mat(0x3a3f46)),hk=new T.Mesh(new T.BoxGeometry(.12,3,.12),mat(0x2a2c30)),hb=new T.Mesh(new T.BoxGeometry(.5,.4,.5),mat(0xc02020));
  tr.position.y=-.5;hk.position.y=-2.2;hb.position.y=-3.8;cr.add(br,tr);const trol=new T.Group();trol.add(tr,hk,hb);cr.add(trol);grp.add(cr);o.geos.push(br.geometry,tr.geometry,hk.geometry,hb.geometry);
  o.upd.push((t)=>{cr.position.set(cx+Math.sin(t*.12)*(hw-8),H-1.4,cz);trol.position.z=Math.sin(t*.2)*(hd-9);});
  label('ATELIER DE SOUDURE',-12,H-2.6,-hd+.7,5,'#e86a1c','#fff');
 }
 st.build(grp,o.geos);
 /* sortie */
 o.exit={x:cx,z:cz+hd-1.5};
 o.spawn={x:cx,z:cz+hd-3.2,ry:PI};
 MW.scene.add(grp);return o;}

/* ═══ cycle de vie des salles ═══ */
function dispose(id){const o=B[id];if(!o) return;
 if(o.group.parent) o.group.parent.remove(o.group);
 for(const r of o.walls){const i=MW.walls.indexOf(r);if(i>=0) MW.walls.splice(i,1);}
 o.group.traverse(m=>{if(m.geometry) m.geometry.dispose();});for(const g of o.geos) g.dispose();for(const t of o.tex) t.dispose();
 delete B[id];}
const ensure=id=>{if(!B[id]){B[id]=build(id);place(id);}return B[id];};
let veil=null;
function flash(){try{if(!veil){veil=document.createElement('div');veil.style.cssText='position:fixed;inset:0;background:#000;z-index:9999;pointer-events:none;opacity:0';document.body.appendChild(veil);}
 veil.style.transition='none';veil.style.opacity='1';void veil.offsetWidth;veil.style.transition='opacity .6s';veil.style.opacity='0';}catch(e){}}
function enter(id,silent){
 const S=SPOTS[id],z=MW.zone(id);if(!S||!z) return false;
 if(MW.player().inCar){MW.toast('Descendez de voiture pour entrer dans l’usine (touche F).','warn');return false;}
 const o=ensure(id);if(cur&&cur!==id&&B[cur]) B[cur].group.visible=false;
 o.group.visible=true;cur=id;MW.closePanel();
 MW.teleport(o.spawn.x,o.spawn.z,o.spawn.ry,0);if(!silent){flash();MW.toast(id==='usine2'?'Grande usine du Vallon : suivez la chaîne d’assemblage.':'Atelier de fabrication Marchand : établis, petite chaîne et stock de pièces.','info');}
 return true;}
function leave(){
 if(!cur) return false;const z=MW.zone(cur),o=B[cur];if(o) o.group.visible=false;
 const out={x:-z.n.x,z:-z.n.z};cur=null;
 MW.teleport(z.porte.x+out.x*1.2,z.porte.z+out.z*1.2,Math.atan2(out.x,out.z),0);flash();return true;}
api.enter=enter;api.leave=leave;api.inside=()=>cur;api.built=id=>!!B[id];
api.stats=()=>{let n=0;for(const id in B) B[id].group.traverse(()=>n++);return {objets:n,calls:MW.renderer?MW.renderer().info.render.calls:0};};

/* proximité : construit à l'approche de la porte, détruit quand on s'éloigne */
MW.on('enterZone',id=>{if(SPOTS[id]&&!cur) ensure(id);});
MW.on('leaveZone',id=>{if(SPOTS[id]&&cur!==id) dispose(id);});
function dedans(){const p=MW.player();for(const id of IDS){const S=SPOTS[id];if(Math.abs(p.x-S.cx)<S.w/2+2&&Math.abs(p.z-S.cz)<S.d/2+2) return id;}return null;}
function resume(){const id=dedans();
 if(id){const o=ensure(id);o.group.visible=true;cur=id;}
 else{cur=null;for(const k of IDS) if(B[k]&&MW.player().zone!==k) dispose(k);}}
MW.on('start',resume);MW.on('open',resume);
MW.on('tick',dt=>{if(!cur||!B[cur]||MW.paused) return;clock+=dt;const o=B[cur];for(const f of o.upd){try{f(clock,dt);}catch(e){}}});

/* ═══ informations sur l'usine, panneaux ═══ */
function info(id){
 const p=MWI.CAT.find(x=>x.id===id);if(!p) return null;
 let nomFac='niveau '+p.fac,cap=0;try{nomFac=FAC[p.fac][0];cap=FAC[p.fac][1];}catch(e){}
 return {id,nom:p.nom,fac:p.fac,nomFac,cap,jour:Math.round(cap/365),charges:p.charges,prix:p.prix,capital:p.capital,p};}
api.info=info;
const row=(a,b)=>`<div class="mw-row"><span>${a}</span><b>${b}</b></div>`;
const btn=(a,l,cls,dis)=>`<button type="button" class="btn${cls?' '+cls:''}" data-mw="${a}"${dis?' disabled':''}>${l}</button>`;
const nf=x=>Math.round(x).toLocaleString('fr-FR');
function capaHtml(i){
 return `<div class="mw-card">${row('Niveau d’usine de départ',esc(i.nomFac)+' (niveau '+i.fac+')')}${row('Capacité de production',nf(i.cap)+' voitures par an')}${row('Soit environ',nf(i.jour)+' voitures par jour')}${row('Charges de l’usine (tant que vous êtes mécanicien)',esc(fmt(i.charges))+' par semaine')}${row('Apport personnel exigé à la fondation',esc(fmt(i.capital)))}</div>`;}
function lignes(i){let l=[];try{l=MWC.foundLines(i.capital);}catch(e){}return '<ul class="mw-cond">'+l.map(x=>`<li class="${x.ok?'ok':'no'}">${x.ok?'✓':'✗'} ${esc(x.t)} <small>(${x.now})</small></li>`).join('')+'</ul>';}
function board(id){
 const i=info(id);if(!i) return;
 let h=`<p>Le tableau de la chaîne : ${id==='usine2'?'soudure robotisée, cabine de peinture, montage, banc d’essai et quai d’expédition':'petite chaîne de montage, établis et stock de pièces'}. Voici ce que cette usine donnera à votre marque.</p>`+capaHtml(i);
 h+=`<p class="hint">Dans la carrière de constructeur, cette capacité plafonne le nombre de voitures vendues par an. Une usine plus grande se construit plus tard avec le budget de votre marque.</p><div class="mw-btns">${btn('close','Fermer','ghost')}</div>`;
 MW.panel(i.nom+' · Production',h,{wide:true});}
api.board=board;
function bureau(id){
 const i=info(id);if(!i) return;const own=MWI.owned(id),z=MW.zone(id);
 const nom=MWI.brand();
 let h=`<p>Le bureau d’études. C’est ici que votre future marque prend forme : son nom, ses plans, sa capacité de production.</p>`+capaHtml(i);
 if(own){
  h+='<h3 class="mw-h3">Nom de votre marque</h3><label class="mw-lab">Nom (30 lettres au plus)<input id="mwBrand" class="mw-in" type="text" maxlength="30" value="'+esc(nom)+'" placeholder="Automobiles ..."></label>';
  h+='<h3 class="mw-h3">Fonder la marque</h3>'+lignes(i)+'<p class="hint">À la fondation, votre épargne devient le capital de la marque, des investisseurs la complètent, et le jeu passe à la carrière de constructeur avec cette usine (niveau '+i.fac+'). Votre carrière de mécanicien est sauvegardée : on y revient depuis l’accueil du jeu.</p>';
  let okF=false;try{okF=MWC.foundOk(i.capital);}catch(e){}
  h+=`<div class="mw-btns">${btn('name','Enregistrer le nom')}${btn('found','Fonder ma marque',okF?'':'',!okF)}${btn('close','Fermer','ghost')}</div>`;}
 else{
  h+='<h3 class="mw-h3">Cette usine est à vendre</h3>'+`<p>Prix : <b>${esc(fmt(i.prix))}</b>. Vous visitez avec l’agent de l’agence. Une fois propriétaire, vous pourrez choisir le nom de la marque ici et la fonder.</p><div class="mw-btns">${btn('fiche','Voir la fiche d’achat')}${btn('close','Fermer','ghost')}</div>`;}
 MW.panel(i.nom+' · Bureau d’études',h,{wide:true,onClick:a=>{
  const inp=document.getElementById('mwBrand'),v=inp?inp.value.trim():'';
  if(a==='name'){MWI.brand(v);MW.toast(v?'Nom de la marque enregistré : '+v+'.':'Aucun nom saisi : « Automobiles Nouvelles » sera utilisé.','good');bureau(id);}
  else if(a==='found'){if(v) MWI.brand(v);MWI.found(id,v);}
  else if(a==='fiche'){MW.closePanel();MWI.fiche(z);}}});}
api.bureau=bureau;
function quai(id){
 const i=info(id);
 MW.panel(i.nom+' · Expédition',`<p>Les voitures terminées sont chargées ici. Dans la carrière de constructeur, chaque voiture vendue part par ce quai : plus l’usine est grande, plus il y a de camions.</p><div class="mw-card">${row('Expéditions possibles',nf(i.cap)+' voitures par an')}</div><div class="mw-btns">${btn('close','Fermer','ghost')}</div>`,{wide:true});}

/* ═══ interactions dans les salles ═══ */
const IT={};
function reg(){
 for(const id of IDS){const S=SPOTS[id],t=IT[id]={};
  t.sortie=MW.addInteract({id:'usine:sortie:'+id,x:S.cx,z:S.cz+S.d/2-1.5,r:2.8,label:'Sortir de l’usine',when:()=>cur===id,use:()=>leave()});
  t.bureau=MW.addInteract({id:'usine:bureau:'+id,x:0,z:0,r:2.2,label:'Bureau d’études : nom de la marque, capacité',when:()=>cur===id&&!!(B[id]&&B[id].desk),use:()=>bureau(id)});
  t.tableau=MW.addInteract({id:'usine:tableau:'+id,x:0,z:0,r:2.2,label:'Tableau de production : capacité de l’usine',when:()=>cur===id&&!!B[id],use:()=>board(id)});
  t.banc=MW.addInteract({id:'usine:banc:'+id,x:0,z:0,r:2.4,label:'Banc d’essai moteur : lancer un essai',when:()=>cur===id&&!!(B[id]&&B[id].banc),use:()=>{const o=B[id];if(o.run>0) return;o.run=8;MW.toast('Essai sur banc lancé : le moteur monte en régime.','info');}});
  t.quai=MW.addInteract({id:'usine:quai:'+id,x:S.cx+S.w/2-5,z:S.cz+(id==='usine2'?16:0),r:2.6,label:'Quai d’expédition : livraisons',when:()=>cur===id&&!!B[id],use:()=>quai(id)});}}
function place(id){const o=B[id],t=IT[id];if(!o||!t) return;
 for(const [k,p] of [['bureau',o.desk],['tableau',o.board],['banc',o.banc]]) if(p){t[k].x=p.x;t[k].z=p.z;}}
reg();

/* portes : l'entrée de la façade mène à l'intérieur (visite possible avant l'achat) */
function door(z){
 if(MWI.owned(z.id)) return void enter(z.id);
 MWI.fiche(z); /* fiche d'achat (niveau, capacité, charges, conditions), avec le bouton « Visiter l'usine » */
}
for(const id of IDS) MW.setDoor(id,door);
api.door=door;
window.__mwu=api;
return api;})();
