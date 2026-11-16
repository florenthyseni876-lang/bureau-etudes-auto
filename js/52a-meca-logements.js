'use strict';
/* ───────────── Mode « Mécanicien » — INTÉRIEURS DES LOGEMENTS (studio, maison de ville, appartement, pavillon, villa) ─────────────
   Les façades sont dessinées par js/45b, l'achat et les charges par js/52 (MWI). Ce fichier ajoute, pour le studio de départ
   et chaque logement acheté ou loué, un intérieur visitable : on y entre par la porte (bouton « Entrer chez moi » de la fiche
   ou du studio). Chaque intérieur a ses pièces meublées (plus confortables quand le logement est cher), un lit, un coffre,
   un bureau, un garage privé (voitures possédées visibles, on prend celle qu'on veut) et une décoration qui suit la progression
   (diplômes, trophées, maquettes). Rien n'est construit tant que le joueur n'y est pas entré, et l'intérieur n'est dessiné que
   lorsque le joueur est dedans.

   ═══ Objet global `MWL` (aussi `window.__mwl`) ═══
   MWL.IDS               ['appart','loge1','loge2','loge3','loge4']
   MWL.enter(id)         entre dans le logement (s'il est à vous, ou le studio) ; MWL.leave() ressort devant la porte
   MWL.inside()          identifiant du logement où se trouve le joueur, ou null
   MWL.info(id)          {surface, pieces, places, tier} ; MWL.plan(id,largeur) : image (adresse de données) du plan des pièces
   MWL.state(id)         {built, visible, nbVoitures, decor:{diplomes, trophees, maquettes}} (outil de test)
   Repère local d'un intérieur : x vers la droite quand on regarde l'intérieur depuis la porte, z = profondeur (0 = mur de la porte). */
const MWL=(()=>{
const T=THREE,PI=Math.PI,api={},LB={};
const IDS=['appart','loge1','loge2','loge3','loge4'];
api.IDS=IDS;
let LIN=false;
const FL=.72; /* les façades (js/45b) reposent sur un socle plein de 0,7 m : le sol des intérieurs est posé dessus */

/* ═══ Fusion de boîtes en un seul maillage coloré ═══ */
const BOXG=new T.BoxGeometry(1,1,1),CYLG=new T.CylinderGeometry(1,1,1,10),CONG=new T.CylinderGeometry(0,1,1,8);
const _c=new T.Color();
function Acc(){this.p=[];this.n=[];this.c=[];this.i=[];}
Acc.prototype.geo=function(g,sx,sy,sz,x,y,z,col,ry){
 const pa=g.attributes.position,na=g.attributes.normal,ix=g.index,b=this.p.length/3,C=Math.cos(ry||0),S=Math.sin(ry||0);
 _c.setHex(col);if(LIN) _c.convertSRGBToLinear();
 for(let k=0;k<pa.count;k++){const vx=pa.getX(k)*sx,vy=pa.getY(k)*sy,vz=pa.getZ(k)*sz;
  this.p.push(x+vx*C+vz*S,y+vy,z-vx*S+vz*C);
  const nx=na.getX(k),nz=na.getZ(k);this.n.push(nx*C+nz*S,na.getY(k),-nx*S+nz*C);this.c.push(_c.r,_c.g,_c.b);}
 for(let k=0;k<ix.count;k++) this.i.push(b+ix.getX(k));};
Acc.prototype.box=function(w,h,d,x,y0,z,col,ry){this.geo(BOXG,w,h,d,x,y0+h/2,z,col,ry);};
Acc.prototype.cyl=function(r,h,x,y0,z,col){this.geo(CYLG,r,h,r,x,y0+h/2,z,col,0);};
Acc.prototype.cone=function(r,h,x,y0,z,col){this.geo(CONG,r,h,r,x,y0+h/2,z,col,0);};
Acc.prototype.mesh=function(mat){
 if(!this.i.length) return null;const g=new T.BufferGeometry();
 g.setAttribute('position',new T.BufferAttribute(new Float32Array(this.p),3));g.setAttribute('normal',new T.BufferAttribute(new Float32Array(this.n),3));
 g.setAttribute('color',new T.BufferAttribute(new Float32Array(this.c),3));g.setIndex(new T.BufferAttribute(new Uint32Array(this.i),1));
 g.computeBoundingSphere();const m=new T.Mesh(g,mat);m.frustumCulled=false;return m;};
let MS=null,MG=null;
const matS=()=>MS||(MS=new T.MeshLambertMaterial({vertexColors:true,emissive:0x484848}));
const matG=()=>MG||(MG=new T.MeshBasicMaterial({vertexColors:true}));
/* repère d'un meuble : (x,z) = centre, q = quart de tour (0 : face vers +z ; 1 : vers +x ; 2 : vers −z ; 3 : vers −x) */
function Fr(S,G,x,z,q){const ry=q*PI/2,C=Math.round(Math.cos(ry)),Sn=Math.round(Math.sin(ry)),X=(lx,lz)=>x+lx*C+lz*Sn,Z=(lx,lz)=>z-lx*Sn+lz*C;
 return {b:(w,h,d,lx,y,lz,col)=>S.box(w,h,d,X(lx,lz),y,Z(lx,lz),col,ry),g:(w,h,d,lx,y,lz,col)=>G.box(w,h,d,X(lx,lz),y,Z(lx,lz),col,ry),
  c:(r,h,lx,y,lz,col)=>S.cyl(r,h,X(lx,lz),y,Z(lx,lz),col),k:(r,h,lx,y,lz,col)=>S.cone(r,h,X(lx,lz),y,Z(lx,lz),col),gc:(r,h,lx,y,lz,col)=>G.cyl(r,h,X(lx,lz),y,Z(lx,lz),col)};}

/* ═══ Palettes par niveau de confort (0 studio … 4 villa) ═══ */
const P={
 wall:[0xe6dcc6,0xe8d9bc,0xeceae4,0xf0e6d0,0xf2eee6],base:[0x8a7a64,0x7a6a52,0x9a9a98,0x6a4a30,0x3a3a3e],ceil:[0xf2eee4,0xf4f0e6,0xf8f8f6,0xf6f0e2,0xfaf6ee],
 sofa:[0x8a7a68,0x5a7a96,0x4a5a6a,0x8a4a3a,0x2e3036],cab:[0xd8d0c0,0xe4dcc8,0xf2f2ee,0xb88a5a,0x26282c],top:[0xa89a8a,0xb8a890,0x2a2c30,0xd8d4cc,0xe8e4dc],
 wood:[0x9a7048,0x8a5a34,0xc89a62,0x6a3e22,0x3a2418],bed:[0x7a8ab0,0x9ab08a,0xe0e0e0,0xa8403a,0x1e2a4a],acc:[0xc86a3a,0x3a7aa8,0xd8b030,0x2e7a5a,0xb8902a]};
const GOLD=0xd8b030,SILVER=0xc4c8d0,BRONZE=0xa86a38,WHITE=0xf4f4f0,DARK=0x2a2c30,METAL=0xb4b8c0;
const hash=s=>{let h=7;for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0;return h;};
const rng=seed=>{let s=seed|0;return()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};

/* ═══ Meubles : chaque type donne sa taille (largeur, profondeur) et son dessin ; le dos du meuble est du côté −z ═══ */
const IT={};
const chair=(F,x,z,sg,col,t)=>{F.b(.42,.05,.42,x,.45,z,col);F.b(.42,.46,.05,x,.5,z+sg*.19,col);for(const a of [-1,1]) for(const b of [-1,1]) F.b(.04,.45,.04,x+a*.18,0,z+b*.18,P.wood[t]);};
IT.bed={s:o=>[(o.w||1.4)+(o.t>=2?1.1:.1),2.05],b:(F,o)=>{const w=o.w||1.4,t=o.t,wd=P.wood[t];
 F.b(w+.1,.28,2.0,0,0,.02,wd);F.b(w,.22,1.9,0,.28,.03,WHITE);F.b(w+.04,.12,1.2,0,.46,.45,P.bed[t]);F.b(w+.1,.95,.08,0,0,-1.0,wd);
 for(const s of (w>1.5?[-1,1]:[0])) F.b(w>1.5?w*.4:.55,.12,.34,s*w*.25,.5,-.7,0xfaf8f2);
 if(t>=2) for(const s of [-1,1]){F.b(.42,.5,.4,s*(w/2+.38),0,-.78,wd);F.gc(.07,.1,s*(w/2+.38),.62,-.78,0xfff0c8);}
 if(t>=3) F.b(w+.1,.04,.5,0,.46,.95,P.acc[t]);}};
IT.chest={s:o=>[.95,.6],b:(F,o)=>{const t=o.t,col=[0x7a5230,0x3a5a4a,0x8a8e94,0x1e1e22,0x3a3a40][t],ban=[0x3a3a3e,0x2a3a30,0x5a5e64,GOLD,GOLD][t],h=[.45,.5,.62,.6,.7][t];
 F.b(.9,h,.55,0,0,0,col);F.b(.94,.08,.59,0,h,0,col);F.b(.06,h+.05,.6,-.3,0,0,ban);F.b(.06,h+.05,.6,.3,0,0,ban);
 if(t<=1) F.b(.12,.12,.04,0,h*.55,.29,GOLD);else{F.c(.1,.04,0,h*.5,.3,t>=3?GOLD:0xd0d4da);F.b(.03,.14,.03,0,h*.5+.02,.33,DARK);}
 F.g(.06,.04,.03,.34,h*.8,.29,0x40ff80);}};
IT.desk={s:o=>[o.w||1.2,.7],b:(F,o)=>{const w=o.w||1.2,t=o.t,wd=P.wood[t],big=o.big;
 F.b(w,.05,.66,0,.72,0,t>=3?0x4a2a1c:wd);
 if(t>=2){for(const s of [-1,1]) F.b(.05,.72,.62,s*(w/2-.03),0,0,wd);F.b(w*.36,.6,.5,w/2-w*.22,.1,.02,wd);}
 else for(const s of [-1,1]) for(const d of [-1,1]) F.b(.05,.72,.05,s*(w/2-.05),0,d*.28,wd);
 F.b(.5,.34,.04,-w*.18,.98,-.1,0x1a1c20);F.g(.46,.3,.01,-w*.18,1,-.08,0x6ab4f0);F.b(.08,.26,.08,-w*.18,.77,-.12,DARK);
 F.b(.4,.02,.14,-w*.18,.77,.14,0x3a3c40);F.b(.3,.015,.22,w*.2,.77,.05,0xf6f4ea);F.b(.04,.38,.04,w/2-.15,.77,-.2,DARK);F.b(.22,.08,.22,w/2-.15,1.12,-.2,0x2e7a5a);
 if(big){F.b(.34,.22,.04,w*.18,.98,-.16,0x1a1c20);F.g(.3,.18,.01,w*.18,1.0,-.14,0x6ab4f0);}
 chair(F,0,.9,1,[0x3a3a40,0x3a5a7a,0x2a2a2e,0x6a3a2a,0x1a1a1e][t],t);F.c(.03,.4,0,.05,.9,DARK);F.b(.5,.04,.5,0,.03,.9,DARK);}};
IT.kitchen={s:o=>[o.len,.64],b:(F,o)=>{const L=o.len,t=o.t,cab=P.cab[t];
 F.b(L,.86,.62,0,0,0,cab);F.b(L+.02,.04,.66,0,.86,.01,P.top[t]);F.b(L,.5,.02,0,.9,-.31,t>=2?0xe8eef0:0xd8e0e4);
 F.b(.55,.02,.42,-L/2+.65,.9,.02,METAL);F.b(.03,.18,.03,-L/2+.65,.9,-.12,METAL);
 for(let i=0;i<4;i++) F.c(.08,.01,L/2-.7+(i%2)*.2-.1,.9,.0+(i>>1)*.2-.08,DARK);
 for(let k=1;k<Math.round(L/.6);k++) F.b(.015,.7,.01,-L/2+k*.6,.05,.32,0x8a8478);
 if(!o.noup){const w=Math.min(L*.5,1.8);F.b(w,.7,.34,L/2-w/2-.05,1.45,-.14,cab);for(let k=1;k<Math.round(w/.6);k++) F.b(.015,.66,.01,L/2-w+k*.6-.05,1.47,.03,0x8a8478);}
 if(t>=2){F.b(.8,.12,.5,L/2-.95,1.35,-.08,0x2a2c30);F.b(.1,.35,.1,L/2-.95,1.5,-.12,METAL);}
 if(t>=3) F.b(.6,.5,.02,-L/2+.65,1.0,-.3,0xc8c4b8);}};
IT.fridge={s:o=>[o.w||.65,.65],b:(F,o)=>{const w=o.w||.62,t=o.t,col=t>=3?0xb8bcc4:0xe8eaec,h=t>=2?1.85:1.7;
 F.b(w,h,.62,0,0,0,col);F.b(w-.02,.02,.01,0,h*.62,.32,0x7a7e84);F.b(.03,.5,.03,w/2-.08,h*.7,.33,METAL);F.b(.03,.35,.03,w/2-.08,h*.3,.33,METAL);}};
IT.island={s:o=>[o.len,1.0],b:(F,o)=>{const L=o.len,t=o.t;F.b(L,.88,.7,0,0,-.1,P.cab[t]);F.b(L+.1,.05,.9,0,.88,-.05,P.top[t]);
 for(let i=0;i<Math.max(2,Math.round(L/.7));i++) {F.c(.17,.03,-L/2+.4+i*.7,.62,.62,0x2a2c30);F.c(.03,.6,-L/2+.4+i*.7,0,.62,METAL);}}};
IT.table={s:o=>[o.w,o.d+.9],b:(F,o)=>{const w=o.w,d=o.d,t=o.t,wd=P.wood[t];F.b(w,.05,d,0,.74,0,wd);
 for(const a of [-1,1]) for(const b of [-1,1]) F.b(.06,.74,.06,a*(w/2-.08),0,b*(d/2-.08),wd);
 F.b(.3,.02,.3,0,.79,0,0xf0ece0);F.c(.06,.12,0,.79,0,P.acc[t]);
 const n=o.n||4,per=Math.ceil(n/2);for(let i=0;i<per;i++){const x=per===1?0:-w/2+.35+i*(w-.7)/Math.max(1,per-1);
  chair(F,x,-d/2-.26,-1,P.sofa[t],t);if(n>1) chair(F,x,d/2+.26,1,P.sofa[t],t);}}};
IT.sofa={s:o=>[o.w,.95],b:(F,o)=>{const w=o.w,t=o.t,col=P.sofa[t],lt=_lite(col);
 F.b(w,.4,.9,0,0,0,col);F.b(w,.5,.22,0,.4,-.34,col);for(const s of [-1,1]) F.b(.2,.62,.9,s*(w/2-.1),0,0,_dark(col));
 const n=Math.max(2,Math.round(w/.8));for(let i=0;i<n;i++) F.b((w-.4)/n-.02,.14,.62,-(w-.4)/2+(i+.5)*(w-.4)/n,.4,.1,lt);
 F.b(.4,.34,.1,-w/2+.45,.5,-.1,P.acc[t]);F.b(.4,.34,.1,w/2-.45,.5,-.1,P.acc[(t+2)%5]);}};
IT.armchair={s:o=>[.9,.9],b:(F,o)=>{const t=o.t,col=P.sofa[(t+1)%5];F.b(.85,.38,.85,0,0,0,col);F.b(.85,.5,.2,0,.38,-.32,col);for(const s of [-1,1]) F.b(.18,.58,.85,s*.34,0,0,_dark(col));F.b(.5,.12,.55,0,.38,.05,_lite(col));}};
IT.tvunit={s:o=>[o.w,.5],b:(F,o)=>{const w=o.w,t=o.t,wd=P.wood[t],tw=Math.min(w*.8,t>=2?1.6:1.0);F.b(w,.5,.45,0,0,0,wd);for(let k=1;k<Math.round(w/.6);k++) F.b(.015,.4,.01,-w/2+k*.6,.05,.23,0x2a1a10);
 F.b(tw,tw*.56,.05,0,.62,.0,0x101216);F.g(tw-.06,tw*.56-.06,.01,0,.65,.03,0x2c4a74);F.b(.3,.12,.18,0,.5,0,DARK);
 if(t>=3){F.b(.2,.9,.2,-w/2-.1,0,0,0x2a2a2e);F.b(.2,.9,.2,w/2+.1,0,0,0x2a2a2e);}}};
IT.ctable={s:o=>[o.w,o.d],b:(F,o)=>{const t=o.t;F.b(o.w,.04,o.d,0,.4,0,P.wood[t]);for(const a of [-1,1]) for(const b of [-1,1]) F.b(.04,.4,.04,a*(o.w/2-.05),0,b*(o.d/2-.05),DARK);if(t>=1) F.c(.1,.12,0,.44,0,P.acc[t]);}};
IT.wardrobe={s:o=>[o.w,.6],b:(F,o)=>{const w=o.w,t=o.t,col=[0xcaa878,0xc89a62,0xe8e4dc,0x7a4a2a,0x2a2a2e][t],n=Math.max(2,Math.round(w/.55));
 F.b(w,2.05,.58,0,0,0,col);for(let k=1;k<n;k++) F.b(.015,1.9,.01,-w/2+k*w/n,.08,.3,0x3a2a1a);for(let k=0;k<n;k+=2) {F.b(.03,.2,.03,-w/2+(k+1)*w/n-.05,1.0,.31,METAL);F.b(.03,.2,.03,-w/2+(k+1)*w/n+.05,1.0,.31,METAL);}}};
IT.shelf={s:o=>[o.w,.4],b:(F,o)=>{const w=o.w,t=o.t,wd=P.wood[t],r=rng(hash('sh'+w+t));F.b(w,2.1,.04,0,0,-.17,wd);for(const s of [-1,1]) F.b(.04,2.1,.34,s*(w/2-.02),0,0,wd);
 for(let l=0;l<6;l++){F.b(w,.03,.34,0,.05+l*.4,0,wd);if(l<5) for(let x=-w/2+.1;x<w/2-.12;x+=.07+r()*.05){const h=.18+r()*.16;F.b(.05,h,.22,x,.08+l*.4,.0,[0xa83a3a,0x3a6aa8,0xd8b858,0x3a8a5a,0xe8e4d8,0x7a4a8a][Math.floor(r()*6)]);}}}};
IT.bain={s:o=>[o.w||1.6,.75],b:(F,o)=>{const w=o.w||1.6,t=o.t;F.b(w,.55,.72,0,0,0,WHITE);F.b(w-.14,.04,.58,0,.55,0,0xbfe2f2);F.b(.06,.22,.06,-w/2+.12,.55,-.26,METAL);if(t>=3) F.b(w,.08,.8,0,.55,0,t>=4?0xe0d8c8:WHITE);}};
IT.shower={s:o=>[.95,.95],b:(F,o)=>{const t=o.t;F.b(.9,.08,.9,0,0,0,t>=2?0xd8dce0:0xc8d0d4);for(const [a,b] of [[-.44,-.44],[.44,-.44],[.44,.44],[-.44,.44]]) F.b(.03,2.0,.03,a,.08,b,METAL);
 F.b(.86,1.9,.02,0,.1,.44,0xc8e4f0);F.b(.02,1.9,.86,.44,.1,0,0xc8e4f0);F.c(.1,.02,-.3,1.9,-.3,METAL);F.b(.02,1.5,.02,-.4,.4,-.42,METAL);}};
IT.wc={s:o=>[.45,.7],b:(F,o)=>{F.b(.38,.4,.48,0,0,.08,WHITE);F.b(.4,.05,.44,0,.4,.08,0xe4e6e8);F.b(.4,.45,.18,0,.4,-.2,WHITE);F.b(.08,.04,.06,0,.85,-.2,METAL);}};
IT.sink={s:o=>[.7,.5],b:(F,o)=>{const t=o.t;F.b(.65,.8,.45,0,0,0,P.cab[t]);F.b(.7,.04,.5,0,.8,0,WHITE);F.b(.46,.03,.32,0,.84,.02,0xdce4e8);F.b(.04,.16,.04,0,.84,-.14,METAL);F.b(.55,.8,.02,0,1.15,-.22,0xcfe4ee);}};
IT.rug={s:o=>[o.w,o.d],nc:1,b:(F,o)=>{F.b(o.w,.02,o.d,0,0,0,_dark(o.c));F.b(o.w-.2,.025,o.d-.2,0,0,0,o.c);F.b(o.w-.5,.028,o.d-.5,0,0,0,_lite(o.c));}};
IT.plant={s:o=>[.5,.5],b:(F,o)=>{const t=o.t;F.c(.2,.35,0,0,0,[0x8a5a3a,0xa8683a,0xe0e0dc,0x3a3a40,0xd8d4cc][t]);F.c(.03,.5,0,.35,0,0x5a3a20);F.k(.4,.8,0,.7,0,0x3a8a3a);F.k(.3,.6,.1,1.1,0,0x4a9a44);F.k(.28,.55,-.1,.95,.1,0x2e7a34);}};
IT.lamp={s:o=>[.4,.4],b:(F,o)=>{F.c(.12,.03,0,0,0,DARK);F.c(.02,1.5,0,.03,0,DARK);F.gc(.16,.28,0,1.5,0,0xfff0c8);}};
IT.fire={s:o=>[o.w,.5],b:(F,o)=>{const w=o.w,t=o.t,st=t>=4?0xf0ece4:0xb8a898;F.b(w,1.3,.45,0,0,0,st);F.b(w+.3,.1,.55,0,1.3,0,_dark(st));F.b(w*.55,.8,.06,0,.12,.23,0x1a1210);F.g(w*.4,.26,.02,0,.2,.2,0xff7a20);F.b(w*.3,.12,.12,0,.12,.1,0x4a2a14);
 F.b(w*.75,1.6,.32,0,1.4,-.06,st);for(const s of [-1,1]) F.b(.12,.05,.12,s*(w/2-.2),1.4,.12,GOLD);}};
IT.piano={s:o=>[1.6,1.9],b:(F,o)=>{F.b(1.5,.22,1.8,0,.62,0,0x121216);F.b(1.45,.04,1.0,0,.84,-.4,0x1a1a20);F.b(1.3,.04,.22,0,.85,.55,WHITE);F.b(1.3,.02,.1,0,.88,.56,DARK);for(const [a,b] of [[-.65,-.7],[.65,-.7],[0,.7]]) F.b(.1,.62,.1,a,0,b,0x121216);F.b(.5,.06,.36,0,.46,1.2,0x2a2a2e);F.b(.4,.46,.04,0,0,1.2,0x2a2a2e);}};
IT.workbench={s:o=>[o.w,.8],b:(F,o)=>{const w=o.w;F.b(w,.08,.7,0,.86,0,0xa07a4a);for(const s of [-1,1]) F.b(.08,.86,.62,s*(w/2-.06),0,0,0x6a6e74);F.b(w-.2,.05,.6,0,.25,0,0x6a6e74);F.b(.2,.16,.2,w/2-.5,.94,-.1,0x3a3e44);F.b(w,1.1,.03,0,1.0,-.34,0x8a6a44);
 const cs=[0xe8c020,0xc83030,0x3a6aa8,0x4a8a4a];for(let i=0;i<6;i++) F.b(.04,.3+((i*7)%3)*.06,.03,-w/2+.4+i*(w-.8)/5,1.55,-.32,METAL);F.b(.5,.9,.5,-w/2+.5,0,.0,0xc02020);for(let i=0;i<4;i++) F.b(.46,.02,.02,-w/2+.5,.2+i*.2,.26,cs[i]);}};
IT.rack={s:o=>[o.w,.55],b:(F,o)=>{const w=o.w,r=rng(hash('rk'+w));for(const s of [-1,1]) F.b(.05,2.2,.5,s*(w/2-.03),0,0,0x3a5a8a);for(let l=0;l<4;l++){F.b(w,.04,.5,0,.2+l*.6,0,0x6a7a8a);
  for(let x=-w/2+.25;x<w/2-.25;x+=.5) F.b(.4,.28+r()*.1,.38,x,.24+l*.6,0,[0xa88a5a,0xc8a860,0x4a6a8a,0x8a4a3a][Math.floor(r()*4)]);}}};
IT.column={s:o=>[.7,.7],b:(F,o)=>{F.c(.28,3,0,0,0,0xf0ece4);F.b(.7,.2,.7,0,0,0,0xd8d2c0);F.b(.7,.2,.7,0,o.h-.2,0,0xd8d2c0);}};
IT.console={s:o=>[o.w,.4],b:(F,o)=>{F.b(o.w,.06,.36,0,.78,0,P.wood[o.t]);for(const s of [-1,1]) F.b(.05,.78,.3,s*(o.w/2-.04),0,0,P.wood[o.t]);F.c(.1,.28,0,.84,0,0xc8d8e0);F.b(.4,.5,.02,0,1.25,-.17,0xcfe4ee);}};
const _dark=c=>((c>>16&255)*.7<<16)|((c>>8&255)*.7<<8)|((c&255)*.7|0);
const _lite=c=>(Math.min(255,(c>>16&255)*1.25+10)<<16)|(Math.min(255,(c>>8&255)*1.25+10)<<8)|Math.min(255,(c&255)*1.25+10)|0;

/* ═══ Plans des cinq intérieurs (repère local : x à droite, z = profondeur ; la porte est en x = 0, z = 0) ═══
   rooms : zones de sol {n nom, x0 z0 x1 z1, f revêtement} (les suivantes recouvrent les précédentes) ; walls : cloisons [x0,z0,x1,z1,[[t0,t1]…]] (t = distance le long
   de la cloison où se trouvent les passages) ; items : [type, x, z, quart de tour, options] ; win : fenêtres [mur L|R|F|B, centre, largeur, bas, haut] ;
   frames : cadres [x,z,quart de tour,hauteur] pour les diplômes ; shelf : étagère de vitrine [x,z,quart de tour,longueur] ; bays : places de garage [x,z] ;
   gate : grille qui ferme le garage quand le logement est loué [x0,z0,x1,z1] ; lamps : plafonniers. */
const LAY={
 appart:{nom:'Votre studio',iw:7,id:5.6,H:2.5,t:0,pieces:2,places:0,wall:0,fl:'lam',
  rooms:[{n:'Pièce à vivre',x0:-3.5,z0:.25,x1:3.5,z1:5.6,f:'lam'},{n:"Salle d'eau",x0:2.0,z0:3.7,x1:3.5,z1:5.6,f:'tile'}],
  walls:[[2.0,3.7,3.5,3.7,[[.1,.9]]],[2.0,3.7,2.0,5.6,[]]],
  items:[['bed',-2.45,4.4,1,{w:1.4}],['chest',-1.15,4.4,1,{}],['kitchen',0,5.27,2,{len:2.2}],['fridge',1.5,5.3,2,{}],['table',.2,3.2,0,{w:1,d:.8,n:2}],
   ['desk',-3.1,1.5,1,{w:1.2,main:1}],['wardrobe',3.2,1.3,3,{w:1.1}],['rug',.2,2.2,0,{w:2.4,d:1.6,c:0x9a5a4a}],['shower',2.5,5.1,0,{}],['wc',3.15,5.2,2,{}],['sink',3.2,4.3,3,{}],['plant',-3.1,.7,0,{}]],
  win:[['R',2.0,1.2,.95,1.95],['L',1.5,1.2,1.0,1.95]],frames:[[-3.46,2.7,1,1.6],[-3.46,3.5,1,1.6],[-2.0,5.58,2,1.7]],shelf:[3.46,2.7,3,.9],lamps:[[0,2.8],[2.75,4.7]],bays:[]},
 loge1:{nom:'Maison de ville',iw:11,id:7.2,H:2.6,t:1,pieces:5,places:1,wall:1,fl:'parq',
  rooms:[{n:'Salon',x0:-2.6,z0:.25,x1:1.6,z1:4.4,f:'parq'},{n:'Cuisine',x0:-2.6,z0:4.4,x1:1.6,z1:7.2,f:'tile'},{n:'Garage',x0:-5.5,z0:.25,x1:-2.6,z1:7.2,f:'conc'},
   {n:'Bureau',x0:1.6,z0:.25,x1:5.5,z1:2.9,f:'parq'},{n:'Salle de bain',x0:1.6,z0:2.9,x1:5.5,z1:4.5,f:'tile'},{n:'Chambre',x0:1.6,z0:4.5,x1:5.5,z1:7.2,f:'carpet'}],
  walls:[[-2.6,.25,-2.6,7.2,[[2.35,4.15]]],[1.6,.25,1.6,7.2,[[1.75,2.55],[2.95,3.75],[5.05,6.05]]],[1.6,2.9,5.5,2.9,[]],[1.6,4.5,5.5,4.5,[]]],
  items:[['sofa',1.1,1.2,3,{w:1.6}],['tvunit',-2.3,1.2,1,{w:1.3}],['ctable',-.45,1.2,0,{w:.9,d:.5}],['rug',-.45,1.2,0,{w:2.2,d:1.8,c:0x6a7a9a}],['plant',-2.2,.7,0,{}],
   ['kitchen',-.7,6.87,2,{len:3.0,noup:0}],['fridge',1.2,6.9,2,{}],['table',-.6,5.2,0,{w:1.2,d:.8,n:4}],
   ['desk',3.5,2.55,2,{w:1.4,main:1}],['shelf',5.25,1.2,3,{w:1.6}],['bed',3.0,6.15,2,{w:1.6}],['chest',5.2,5.1,3,{}],['wardrobe',5.15,6.35,3,{w:1.4}],
   ['bain',5.1,3.7,3,{w:1.5}],['sink',3.4,3.2,0,{}],['wc',2.3,4.2,2,{}],['lamp',-2.2,3.8,0,{}],['shelf',-5.3,6.0,1,{w:1.6}]],
  win:[['F',-1.4,1.2,1.0,1.95],['R',6.2,1.0,1.0,1.95],['R',1.2,1.0,1.0,1.95],['B',-1.9,.9,1.2,1.95]],
  frames:[[2.8,2.82,2,1.75],[3.55,2.82,2,1.75],[4.3,2.82,2,1.75],[-1.7,.27,0,1.6]],shelf:[3.6,.4,0,1.8],lamps:[[-.5,2.3],[-.5,5.8],[3.5,1.5],[3.5,6],[-4.0,3.9]],
  bays:[[-4.05,3.9]],gate:[-2.6,2.6,-2.6,4.4]},
 loge2:{nom:'Appartement du Centre',iw:13,id:8,H:2.9,t:2,pieces:5,places:1,wall:2,fl:'parq',
  rooms:[{n:'Parking (sous-sol)',x0:-6.5,z0:.25,x1:-3.7,z1:8,f:'conc'},{n:'Salon',x0:-3.7,z0:.25,x1:1,z1:4.8,f:'parq'},{n:'Cuisine',x0:-3.7,z0:4.8,x1:1,z1:8,f:'tile'},
   {n:'Bureau',x0:1,z0:.25,x1:6.5,z1:3.2,f:'parq'},{n:'Salle de bain',x0:1,z0:3.2,x1:6.5,z1:5.2,f:'tile'},{n:'Chambre',x0:1,z0:5.2,x1:6.5,z1:8,f:'carpet'}],
  walls:[[-3.7,.25,-3.7,8,[[2.55,4.55]]],[1,.25,1,8,[[1.15,2.15],[3.45,4.25],[5.45,6.45]]],[1,3.2,6.5,3.2,[]],[1,5.2,6.5,5.2,[]]],
  items:[['tvunit',-3.4,1.5,1,{w:1.8}],['sofa',-1.0,1.5,3,{w:2.3}],['ctable',-2.1,1.5,0,{w:1.2,d:.7}],['rug',-2.0,1.5,0,{w:2.6,d:2.2,c:0x5a6a7a}],['table',-2.3,3.9,0,{w:1.4,d:.9,n:4}],
   ['kitchen',-1.6,7.67,2,{len:3.6,noup:1}],['island',-1.4,6.1,0,{len:2.2}],['fridge',.6,7.7,2,{w:.7}],['plant',.3,.6,0,{}],['lamp',-3.2,3.3,0,{}],
   ['desk',3.8,2.85,2,{w:1.7,main:1,big:1}],['shelf',6.3,1.7,3,{w:2.4}],['armchair',2.0,1.2,0,{}],['plant',6.0,.6,0,{}],
   ['bed',3.6,7.0,2,{w:1.8}],['chest',6.2,6.0,3,{}],['wardrobe',6.2,7.25,3,{w:1.5}],['bain',6.1,4.2,3,{w:1.6}],['sink',3.1,3.5,0,{}],['wc',2.0,5.0,2,{}],
   ['rack',-6.2,6.8,1,{w:2.2}]],
  win:[['F',-1.5,2.8,.9,2.3],['B',-1.8,1.4,1.2,2.2],['R',6.8,1.6,1.0,2.3],['F',3.0,2.0,.9,2.2]],
  frames:[[3.0,3.12,2,1.8],[3.8,3.12,2,1.8],[4.6,3.12,2,1.8],[-3.4,4.0,1,1.8]],shelf:[5.2,.4,0,2.0],lamps:[[-2,2.3],[-1.5,6.4],[3.7,1.7],[3.7,6.6],[-5.1,4]],
  bays:[[-4.9,4.0]],gate:[-3.7,2.55,-3.7,4.55]},
 loge3:{nom:'Pavillon avec garage',iw:13,id:10,H:3.0,t:3,pieces:7,places:2,wall:3,fl:'parq',
  rooms:[{n:'Garage double',x0:-6.5,z0:.25,x1:-1,z1:6,f:'conc'},{n:'Atelier',x0:-6.5,z0:6,x1:-1,z1:10,f:'conc'},{n:'Salon-cuisine',x0:-1,z0:.25,x1:6.5,z1:5.5,f:'parq'},
   {n:'Bureau',x0:-1,z0:5.5,x1:2,z1:10,f:'parq'},{n:'Salle de bain',x0:2,z0:5.5,x1:3.8,z1:10,f:'tile'},{n:'Chambre',x0:3.8,z0:5.5,x1:6.5,z1:10,f:'carpet'}],
  walls:[[-1,.25,-1,10,[[2.75,3.95]]],[-6.5,6,-1,6,[[2.3,3.5]]],[-1,5.5,6.5,5.5,[[1.0,2.0],[3.4,4.4],[5.4,6.4]]],[2,5.5,2,10,[]],[3.8,5.5,3.8,10,[]]],
  items:[['tvunit',-.62,1.6,1,{w:1.9}],['sofa',2.4,1.6,3,{w:2.4}],['ctable',.9,1.6,0,{w:1.1,d:.6}],['rug',1.0,1.6,0,{w:3.0,d:2.4,c:0x8a5a3a}],['fire',3.8,.5,0,{w:1.8}],['armchair',5.2,1.5,0,{}],
   ['table',3.4,3.8,0,{w:1.9,d:.95,n:6}],['kitchen',6.17,2.9,3,{len:3.6,noup:0}],['fridge',6.2,4.95,3,{w:.8}],['plant',.1,.6,0,{}],['lamp',5.9,.7,0,{}],
   ['desk',.6,9.65,2,{w:1.9,main:1,big:1}],['shelf',-.72,7.6,1,{w:2.2}],['armchair',1.4,6.4,0,{}],['plant',1.7,9.3,0,{}],
   ['bain',2.9,9.6,2,{w:1.7}],['shower',2.6,6.7,0,{}],['wc',3.3,6.4,0,{}],['sink',3.55,7.8,3,{}],
   ['bed',5.15,9.0,2,{w:1.6}],['chest',5.15,7.7,2,{}],['wardrobe',6.15,6.7,3,{w:2.0}],['plant',4.1,9.5,0,{}],
   ['workbench',-3.8,9.65,2,{w:3.6}],['rack',-6.2,8.0,1,{w:2.6}]],
  win:[['F',5.4,1.6,1.0,2.3],['F',-4.0,0,0,0],['R',2.2,1.6,1.0,2.3],['R',8.0,1.6,1.0,2.3],['B',-5,1.6,1.2,2.4]].filter(w=>w[2]>0),
  frames:[[-.2,9.98,2,1.9],[.6,9.98,2,1.9],[1.4,9.98,2,1.9],[-.97,3.6,0,0]].filter(f=>f[3]>0),shelf:[1.96,7.4,3,2.2],lamps:[[1.5,2.7],[4.5,2.7],[3.4,4.4],[.5,7.7],[-3.8,3],[-3.8,8],[5.1,8]],
  bays:[[-5.12,3.2],[-2.37,3.2]],gate:[-1,2.75,-1,3.95]},
 loge4:{nom:'Villa des Hauts',iw:20,id:14.8,H:3.4,t:4,pieces:9,places:4,wall:4,fl:'marble',
  rooms:[{n:'Hall',x0:-3.2,z0:.25,x1:3.2,z1:8.2,f:'marble'},{n:'Grand salon',x0:-10,z0:.25,x1:-3.2,z1:8.2,f:'parq'},{n:'Salle à manger et cuisine',x0:3.2,z0:.25,x1:10,z1:8.2,f:'marble'},
   {n:'Garage (4 places)',x0:-10,z0:8.2,x1:1,z1:14.8,f:'conc'},{n:'Bibliothèque-bureau',x0:1,z0:8.2,x1:5.8,z1:14.8,f:'parq'},{n:'Suite parentale',x0:5.8,z0:8.2,x1:10,z1:14.8,f:'carpet'},{n:'Salle de bain',x0:8,z0:8.2,x1:10,z1:10.8,f:'tile'}],
  walls:[[-3.2,.25,-3.2,8.2,[[2.25,5.25]]],[3.2,.25,3.2,8.2,[[1.25,3.75]]],[-10,8.2,10,8.2,[[3.5,5.0],[11.6,12.8]]],[1,8.2,1,14.8,[]],[5.8,8.2,5.8,14.8,[[1.2,2.2]]],[8,8.2,8,10.8,[]],[8,10.8,10,10.8,[[.4,1.4]]]],
  items:[['column',-1.6,3.5,0,{h:3.4}],['column',1.6,3.5,0,{h:3.4}],['console',0,.6,0,{w:1.6}],['plant',-2.7,.7,0,{}],['plant',2.7,.7,0,{}],['plant',-2.7,7.6,0,{}],['plant',2.7,7.6,0,{}],['rug',0,5.4,0,{w:3.4,d:3.8,c:0x7a2a2e}],
   ['fire',-9.55,4.0,1,{w:2.6}],['sofa',-6.0,4.0,3,{w:2.8}],['sofa',-8.0,1.3,0,{w:2.2}],['armchair',-7.9,6.9,2,{}],['ctable',-7.7,4.0,0,{w:1.3,d:.8}],['rug',-7.4,4.0,0,{w:4.4,d:3.6,c:0x3a3a52}],['piano',-4.4,1.45,0,{}],['lamp',-3.7,7.5,0,{}],['plant',-9.5,7.6,0,{}],
   ['table',6.6,2.9,0,{w:3.4,d:1.2,n:8}],['kitchen',6.1,7.87,2,{len:4.4,noup:1}],['island',6.0,6.0,0,{len:2.8}],['fridge',8.65,7.9,2,{w:.85}],['console',9.65,2.4,3,{w:1.8}],['plant',9.5,.8,0,{}],
   ['desk',3.4,14.45,2,{w:2.4,main:1,big:1}],['shelf',1.35,11.6,1,{w:4}],['shelf',5.45,11.6,3,{w:4}],['armchair',3.4,11.4,0,{}],['rug',3.4,11.6,0,{w:2.6,d:2.4,c:0x5a3a2a}],
   ['bed',7.9,13.8,2,{w:1.9}],['chest',7.9,12.5,2,{}],['wardrobe',9.7,12.8,3,{w:3.0}],['armchair',6.4,9.4,0,{}],['bain',8.95,8.65,0,{w:1.7}],['wc',8.4,10.35,2,{}],['sink',9.6,9.9,3,{}],
   ['rack',-9.7,13.5,1,{w:2.6}]],
  win:[['F',-6.5,3.2,.9,2.7],['F',6.6,3.0,.9,2.7],['F',0,2.6,.9,2.7],['R',12.8,1.8,1.1,2.5],['B',7,2.0,1.3,2.5],['L',4.5,1.6,1.0,2.5]],
  frames:[[2.2,14.78,2,2.0],[3.4,14.78,2,2.0],[4.6,14.78,2,2.0],[-3.18,7.0,1,2.0],[3.18,6.0,3,2.0]],shelf:[3.0,8.4,0,3.0],lamps:[[0,2],[0,6],[-6.5,2.5],[-6.5,6],[6.6,2.9],[6.1,5.6],[3.4,12],[7.5,12],[-5,11],[-1.5,11]],
  bays:[[-8.62,12.3],[-5.87,12.3],[-3.12,12.3],[-.37,12.3]],gate:[-10,11.6,-10,12.8]}};
LAY.loge4.gate=[-6.5,8.2,-5.0,8.2];

/* ═══ Revêtements de sol (textures dessinées) ═══ */
const TEXC={};
function ftex(kind,rw,rh){
 const k=kind;let base=TEXC[k];
 if(!base){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),r=rng(hash(kind));
  if(kind==='lam'||kind==='parq'){x.fillStyle=kind==='lam'?'#c8ac80':'#a8723c';x.fillRect(0,0,128,128);
   for(let j=0;j<8;j++)for(let i=0;i<2;i++){const o=(j%2)*32,v=r()*22-11;x.fillStyle=kind==='lam'?`rgb(${200+v},${172+v},${128+v})`:`rgb(${170+v},${114+v},${62+v})`;x.fillRect((i*64+o)%128+1,j*16+1,62,14);if(o) x.fillRect(1-64+((i*64+o)%128),j*16+1,62,14);}}
  else if(kind==='tile'){x.fillStyle='#8a9096';x.fillRect(0,0,128,128);for(let i=0;i<2;i++)for(let j=0;j<2;j++){const v=r()*10-5;x.fillStyle=`rgb(${226+v},${230+v},${232+v})`;x.fillRect(i*64+2,j*64+2,60,60);}}
  else if(kind==='conc'){x.fillStyle='#8e9092';x.fillRect(0,0,128,128);for(let i=0;i<260;i++){const v=Math.floor(r()*40-20);x.fillStyle=`rgba(${120+v},${122+v},${124+v},.5)`;x.fillRect(r()*128,r()*128,2+r()*5,2+r()*5);}x.strokeStyle='rgba(40,40,44,.5)';x.strokeRect(0,0,128,128);}
  else if(kind==='carpet'){x.fillStyle='#7a8498';x.fillRect(0,0,128,128);for(let i=0;i<1200;i++){const v=Math.floor(r()*30-15);x.fillStyle=`rgba(${122+v},${132+v},${152+v},.6)`;x.fillRect(r()*128,r()*128,1.5,1.5);}}
  else{x.fillStyle='#d8d2c4';x.fillRect(0,0,128,128);for(let i=0;i<2;i++)for(let j=0;j<2;j++){const v=r()*10-5;x.fillStyle=`rgb(${240+v},${236+v},${226+v})`;x.fillRect(i*64+1,j*64+1,62,62);
    x.strokeStyle='rgba(150,140,120,.3)';x.beginPath();x.moveTo(i*64+r()*60,j*64);x.bezierCurveTo(i*64+r()*60,j*64+20,i*64+r()*60,j*64+40,i*64+r()*60,j*64+64);x.stroke();}}
  base=TEXC[k]=c;}
 const t=new T.CanvasTexture(base);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rw/1.0*(kind==='conc'?.5:1)*(kind==='marble'||kind==='tile'?.5:1),rh/1.0*(kind==='conc'?.5:1)*(kind==='marble'||kind==='tile'?.5:1));t.anisotropy=4;if(LIN) t.encoding=T.sRGBEncoding;return t;}
let SKY=null;
function skyTex(){if(SKY) return SKY;const c=document.createElement('canvas');c.width=4;c.height=64;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,'#7fb4ec');g.addColorStop(.6,'#c8e2f8');g.addColorStop(1,'#e9f2e0');x.fillStyle=g;x.fillRect(0,0,4,64);
 SKY=new T.CanvasTexture(c);if(LIN) SKY.encoding=T.sRGBEncoding;return SKY;}

/* ═══ Repères ═══ */
function frameOf(z){const n=z.n,ry0=Math.atan2(n.x,n.z),t={x:Math.cos(ry0),z:-Math.sin(ry0)};return {n,t,ry0,d:z.door};}
const toW=(z,lx,lz)=>{const f=frameOf(z);return {x:f.d.x+f.t.x*lx+f.n.x*lz,z:f.d.z+f.t.z*lx+f.n.z*lz};};
const toL=(z,x,zz)=>{const f=frameOf(z),dx=x-f.d.x,dz=zz-f.d.z;return {x:dx*f.t.x+dz*f.t.z,z:dx*f.n.x+dz*f.n.z};};
function colW(z,b){const a=toW(z,b[0],b[1]),c=toW(z,b[2],b[3]);return [Math.min(a.x,c.x),Math.min(a.z,c.z),Math.max(a.x,c.x),Math.max(a.z,c.z)];}

/* ═══ Construction d'un intérieur ═══ */
function build(id){
 if(LB[id]) return LB[id];
 const L=LAY[id],z=MW.zone(id);if(!L||!z) return null;
 try{const R=MW.renderer&&MW.renderer();LIN=!!R&&R.outputEncoding===T.sRGBEncoding;}catch(e){LIN=false;}
 const S=new Acc(),G=new Acc(),grp=new T.Group(),f=frameOf(z),cols=[],H=L.H,t=L.t,iw=L.iw,idp=L.id,wl=P.wall[L.wall],bs=P.base[L.wall];
 grp.name='logement-'+id;grp.position.set(f.d.x,FL,f.d.z);grp.rotation.y=f.ry0;grp.visible=false;
 const item={};
 /* coque : murs, plafond, sol */
 const wallRun=(x0,z0,x1,z1,th,gaps,col,col2)=>{ // cloison axe aligné (centre x0..x1 / z0..z1), passages en t
  const hz=Math.abs(z1-z0)<1e-6,len=hz?Math.abs(x1-x0):Math.abs(z1-z0),dir=hz?(x1>=x0?1:-1):(z1>=z0?1:-1),at=tt=>hz?[x0+dir*tt,z0]:[x0,z0+dir*tt];
  const gs=(gaps||[]).slice().sort((a,b)=>a[0]-b[0]);let c=0;
  const solid=(a,b)=>{if(b-a<.01) return;const m=at((a+b)/2),w=b-a;
   if(hz){S.box(w,H,th,m[0],0,m[1],col);S.box(w,.1,th+.04,m[0],0,m[1],bs);cols.push([m[0]-w/2,m[1]-.17,m[0]+w/2,m[1]+.17]);}
   else{S.box(th,H,w,m[0],0,m[1],col);S.box(th+.04,.1,w,m[0],0,m[1],bs);cols.push([m[0]-.17,m[1]-w/2,m[0]+.17,m[1]+w/2]);}};
  for(const [a,b] of gs){solid(c,a);const m=at((a+b)/2),w=b-a;if(hz) S.box(w,H-2.15,th,m[0],2.15,m[1],col);else S.box(th,H-2.15,w,m[0],2.15,m[1],col);
   for(const e of [a,b]){const p=at(e);if(hz) S.box(.06,2.15,th+.04,p[0],0,p[1],bs);else S.box(th+.04,2.15,.06,p[0],0,p[1],bs);}c=b;}
  solid(c,len);};
 const th=.25;
 wallRun(-iw/2-th/2,-.25,-iw/2-th/2,idp+th,th,[],wl);wallRun(iw/2+th/2,-.25,iw/2+th/2,idp+th,th,[],wl);
 wallRun(-iw/2-th,idp+th/2,iw/2+th,idp+th/2,th,[],wl);
 {const half=iw/2+th,gx=[half-.55,half+.55];wallRun(-half,th/2-.0,half,th/2-.0,th,[[gx[0],gx[1]]],wl);}
 // coque : colliders épais (le joueur ne passe pas)
 cols.push([-iw/2-.8,-.3,-iw/2,idp+.8],[iw/2,-.3,iw/2+.8,idp+.8],[-iw/2-.8,idp,iw/2+.8,idp+.8],[-.55,-.3,.55,.12]);
 for(const [x0,z0,x1,z1,gp] of L.walls) wallRun(x0,z0,x1,z1,.14,gp,wl);
 G.box(iw+.5,.2,idp+.35,0,H,(idp+.1)/2,P.ceil[L.wall]);S.box(iw+.5,.1,idp+.4,0,-.1,(idp+.1)/2,0x3a3a3e);
 /* porte intérieure (battant fermé dans l'ouverture) */
 {const dc=[0x6a4a34,0x3a5a7a,0x6a4a8a,0x2f7a5a,0x1c1c22][t];S.box(1.0,2.1,.07,0,0,.1,dc);S.box(.7,.7,.02,0,1.2,.14,_lite(dc));S.box(.05,.05,.08,.38,1.05,.14,GOLD);S.box(1.2,.06,.12,0,2.1,.11,bs);}
 /* plafonniers */
 for(const [x,zz] of L.lamps){S.box(.78,.04,.78,x,H-.05,zz,0xd8d4c8);G.box(.66,.02,.66,x,H-.07,zz,0xfff4d8);}
 /* sol */
 L.rooms.forEach((r,i)=>{const w=r.x1-r.x0,d=r.z1-r.z0,m=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshLambertMaterial({map:ftex(r.f,w,d),emissive:0x484848}));
  m.rotation.x=-PI/2;m.position.set((r.x0+r.x1)/2,.012+i*.003,(r.z0+r.z1)/2);grp.add(m);});
 /* meubles */
 L.items.forEach((it,ix)=>{const [ty,x,zz,q,o0]=it,D=IT[ty];if(!D) return;const o=Object.assign({t},o0||{}),F=Fr(S,G,x,zz,q);D.b(F,o);
  const sz=D.s(o),sw=q%2?sz[1]:sz[0],sd=q%2?sz[0]:sz[1];if(!D.nc&&!(o.nc)) cols.push([x-sw/2,zz-sd/2,x+sw/2,zz+sd/2]);
  if(ty==='chest'&&!item.chest) item.chest={x,z:zz,q};
  if(ty==='bed'&&!item.bed) item.bed={x,z:zz,q};
  if(ty==='desk'&&o.main) item.desk={x,z:zz,q};});
 /* places de garage : marquage au sol */
 for(const [x,zz] of L.bays){for(const s of [-1,1]) S.box(.08,.012,5.4,x+s*1.2,.012,zz,0xf2f0e8);S.box(2.5,.012,.08,x,.012,zz+2.7,0xf2f0e8);}
 /* fenêtres */
 const wins=[],sky=new T.MeshBasicMaterial({map:skyTex()});
 for(const [wa,c,w,y0,y1] of L.win){const h=y1-y0,fo=.07;let x,zz,ry,fx,fz;
  if(wa==='L'){x=-iw/2+.02;zz=c;ry=PI/2;}else if(wa==='R'){x=iw/2-.02;zz=c;ry=-PI/2;}else if(wa==='F'){x=c;zz=.25+.02;ry=0;}else{x=c;zz=idp-.02;ry=PI;}
  const m=new T.Mesh(new T.PlaneGeometry(w,h),sky);m.position.set(x,y0+h/2,zz);m.rotation.y=ry;grp.add(m);wins.push(m);
  const Fw=Fr(S,G,x,zz,ry===0?0:ry===PI?2:ry>0?1:3),fc=_lite(wl);Fw.b(w+.12,fo,.07,0,y0-fo,0,fc);Fw.b(w+.12,fo,.07,0,y1,0,fc);Fw.b(fo,h,.07,-w/2-fo/2,y0,0,fc);Fw.b(fo,h,.07,w/2+fo/2,y0,0,fc);Fw.b(.04,h,.05,0,y0,0,fc);Fw.b(w,.04,.05,0,y0+h*.6,0,fc);
  Fw.b(w+.2,.04,.16,0,y0-fo-.03,.04,fc);}
 const ms=S.mesh(matS()),mg=G.mesh(matG());if(ms) grp.add(ms);if(mg) grp.add(mg);
 const dyn=new T.Group();dyn.name='dyn';grp.add(dyn);
 MW.scene.add(grp);
 // colliders dans le monde (une fois)
 const wc=cols.map(b=>colW(z,b));for(const b of wc) MW.walls.push(b);
 const B=LB[id]={id,grp,dyn,wins,cols:wc,item,inter:[],dynI:[],gate:null,L};
 interacts(B,z);dynBuild(B);
 return B;}

/* ═══ Interactions du logement ═══ */
const ownedL=id=>id==='appart'||(typeof MWI!=='undefined'&&MWI.owned(id));
function interacts(B,z){
 const {id,L,item}=B,at=(lx,lz)=>toW(z,lx,lz),mk=(k,lx,lz,r,label,use)=>{const p=at(lx,lz);MW.addInteract({id:'mwl:'+id+':'+k,x:p.x,z:p.z,r:r||2.0,label,when:()=>cur===id,use});B.inter.push('mwl:'+id+':'+k);};
 mk('out',0,.8,1.5,'Sortir',()=>api.leave());
 if(item.bed){const b=item.bed;mk('bed',b.x,b.z,2.1,()=>(MW.S&&(MW.S.min>=1140||MW.S.min<360))?'Lit : dormir ou sauvegarder':'Lit : sauvegarder (dormir dès 19 h)',()=>bedPanel(id,z));}
 if(item.chest){const c=item.chest;mk('chest',c.x,c.z,1.9,()=>{let n=0,cap=0;try{n=(MWI.state().stock[id]||[]).length;}catch(e){}try{cap=MWI.cap?MWI.cap(id):0;}catch(e){}return 'Coffre : pièces et outils ('+n+(cap?'/'+cap:'')+')';},()=>MWI.stock(id));}
 if(item.desk){const d=item.desk;mk('desk',d.x,d.z,2.2,'Bureau : carrière, biens, carnet',()=>deskPanel(id,z));}}
function bedPanel(id,z){
 const night=MW.S&&(MW.S.min>=1140||MW.S.min<360),nm=LAY[id].nom;let reveil='7 h 30';
 try{const p=MWI.CAT.find(x=>x.id===id);if(p){const m=p.reveil;reveil=Math.floor(m/60)+' h'+(m%60?String(m%60).padStart(2,'0'):'');}}catch(e){}
 MW.panel(nm+' · Chambre',`<p>${night?'Il est tard : une bonne nuit vous fera du bien (réveil à '+reveil+').':'Il est trop tôt pour dormir : revenez à partir de 19 h.'} ${esc(MW.timeStr())}.</p><div class="mw-btns">${night?`<button type="button" class="btn" data-mw="sleep">Dormir (réveil à ${reveil})</button>`:''}<button type="button" class="btn ghost" data-mw="save">Sauvegarder</button><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`,
  {onClick:a=>{if(a==='sleep'){if(!night) return;MW.closePanel();if(id==='appart') MW.sleep();else MWI.sleepIn(id);}else if(a==='save'){MW.save();MW.toast('Partie sauvegardée.','good');}}});}
function deskPanel(id,z){
 MW.panel(LAY[id].nom+' · Bureau',`<p>Votre bureau : tout ce qui concerne votre métier se règle ici.</p><div class="mw-btns v"><button type="button" class="btn" data-mw="car">Carrière (C) : poste, diplômes, banque</button><button type="button" class="btn" data-mw="biens">Mes biens (B) : logements, garages, usines</button><button type="button" class="btn" data-mw="carnet">Carnet (Tab) : voitures rendues, notes</button><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`,
  {onClick:a=>{if(a==='car'){try{MWC.panel();}catch(e){console.error(e);}}else if(a==='biens'){MWI.panel();}else if(a==='carnet'){try{MWJ.openCarnet();}catch(e){console.error(e);}}}});}

/* ═══ Décor qui suit la progression : cadres, trophées, maquettes, voitures du garage ═══ */
function tex2(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);if(LIN) t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;}
const DIPLN={cap:['CAP','Maintenance des véhicules'],bts:['BTS','Maintenance des véhicules'],ing:['INGÉNIEUR','Diplôme d’ingénieur automobile']};
function diplTex(k){const [t1,t2]=DIPLN[k];return tex2(256,180,(x,w,h)=>{x.fillStyle='#f4ecd0';x.fillRect(0,0,w,h);x.strokeStyle='#b8902a';x.lineWidth=5;x.strokeRect(8,8,w-16,h-16);x.lineWidth=1.5;x.strokeRect(15,15,w-30,h-30);
 x.fillStyle='#3a2a16';x.textAlign='center';x.font='bold 15px Georgia,serif';x.fillText('DIPLÔME',w/2,42);x.font='bold 34px Georgia,serif';x.fillText(t1,w/2,86);x.font='15px Georgia,serif';x.fillText(t2,w/2,112);
 x.fillStyle='#a8302a';x.beginPath();x.arc(w/2,146,15,0,7);x.fill();x.fillStyle='#e8c050';x.beginPath();x.arc(w/2,146,8,0,7);x.fill();});}
function artTex(seed){const r=rng(seed);return tex2(256,180,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);const hu=Math.floor(r()*360);g.addColorStop(0,`hsl(${hu},50%,70%)`);g.addColorStop(1,`hsl(${(hu+40)%360},45%,40%)`);x.fillStyle=g;x.fillRect(0,0,w,h);
 for(let i=0;i<4;i++){x.fillStyle=`hsla(${(hu+i*30)%360},40%,${25+i*8}%,.85)`;x.beginPath();x.moveTo(0,h);for(let k=0;k<=8;k++) x.lineTo(k*w/8,h*(.4+i*.12)+Math.sin(k*1.7+i+r()*2)*14);x.lineTo(w,h);x.fill();}
 x.fillStyle='rgba(255,240,200,.9)';x.beginPath();x.arc(w*(.2+r()*.6),h*.3,14,0,7);x.fill();});}
function trophies(){ // liste des trophées gagnés, selon la progression de la carrière
 const out=[];let jobs=0,founded=null;try{const c=MWC.state();jobs=c.stats.jobs||0;founded=c.founded;}catch(e){}
 const rep=MW.S?+MW.S.rep||0:0,money=MW.S?MW.S.money:0;
 if(jobs>=1) out.push({c:BRONZE,n:'1re voiture rendue'});if(jobs>=10) out.push({c:SILVER,n:'10 voitures rendues'});if(jobs>=30) out.push({c:GOLD,n:'30 voitures rendues'});
 if(rep>=25) out.push({c:BRONZE,n:'Atelier de confiance'});if(rep>=50) out.push({c:SILVER,n:'Réputation solide'});if(rep>=75) out.push({c:GOLD,n:'Réputation d’excellence'});
 if(money>=50000) out.push({c:SILVER,n:'50 000 € de réserve'});if(money>=500000) out.push({c:GOLD,n:'Demi-million'});
 if(founded) out.push({c:GOLD,n:'Fondateur de '+founded,big:1});
 return out;}
function diplomas(){try{const d=MWC.state().dipl||{};return ['cap','bts','ing'].filter(k=>d[k]);}catch(e){return [];}}
function carsOwned(){const l=[];try{l.push(MWC.getCar());}catch(e){}try{for(const c of MWI.state().cars) l.push(c);}catch(e){}return l;}
function dynBuild(B){
 const {id,L,dyn}=B,z=MW.zone(id);
 for(const k of B.dynI) MW.removeInteract(k);B.dynI=[];
 for(const c of dyn.children.slice()){dyn.remove(c);c.traverse(o=>{if(o.isMesh&&o.userData.own){o.geometry.dispose();if(o.material.map) o.material.map.dispose();o.material.dispose();}});}
 const S=new Acc(),G=new Acc(),dg=[],mkP=(tx,w,h,x,y,zz,ry)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tx}));m.position.set(x,y,zz);m.rotation.y=ry;m.userData.own=1;dyn.add(m);return m;};
 const qry=q=>q===0?0:q===1?PI/2:q===2?PI:-PI/2,nrm=q=>[[0,1],[1,0],[0,-1],[-1,0]][q];
 // cadres : diplômes d'abord, puis tableaux ; le nombre de diplômes dépend de la carrière
 const dl=diplomas(),big=L.t>=3?1.25:1,fw=.5*big,fh=.36*big;
 L.frames.forEach((fr,i)=>{const [x,zz,q,y]=fr,n=nrm(q),isD=i<dl.length,tx=isD?diplTex(dl[i]):artTex(hash(id)+i*7);
  const Fq=Fr(S,G,x,zz,q);Fq.b(fw+.08,fh+.08,.03,0,y-fh/2-.04,.02,[0x8a6a3a,0x6a4a2a,0x2a2a2e,0x3a2a1a,GOLD][L.t]);
  mkP(tx,fw,fh,x+n[0]*.045,y,zz+n[1]*.045,qry(q));});
 // étagère de vitrine : trophées au-dessus, maquettes en dessous
 const sh=L.shelf,tr=trophies(),Fs=Fr(S,G,sh[0],sh[1],sh[2]),len=sh[3],wd=P.wood[L.t];
 Fs.b(len,.05,.3,0,1.45,.12,wd);Fs.b(len,.05,.3,0,1.05,.12,wd);for(const s of [-1,1]) Fs.b(.04,.9,.3,s*(len/2-.02),.75,.12,wd);Fs.b(len,.9,.02,0,.75,-.02,_dark(wd));
 let x0=-len/2+.25,placed=0;
 for(const tp of tr){if(x0>len/2-.15) break;Fs.c(.08,.03,x0,1.5,.12,tp.c);Fs.c(.015,.1,x0,1.53,.12,tp.c);Fs.c(tp.big?.1:.07,tp.big?.14:.1,x0,1.63,.12,tp.c);Fs.b(.2,.04,.1,x0+(tp.big?.2:.0),1.5,.12,tp.c);x0+=tp.big?.36:.26;placed++;}
 B.decor={diplomes:dl.length,trophees:placed,maquettes:0};
 const cars=carsOwned();let mx=-len/2+.3;
 for(const c of cars.slice(0,Math.floor((len-.2)/.34))){try{const m=MW.carMesh({kind:c.kind,color:c.color,model:c.model});m.scale.set(.075,.075,.075);
   const p=toShelf(sh,mx);m.position.set(p.x,1.07,p.z);m.rotation.y=qry(sh[2])+PI/2;m.traverse(o=>{o.frustumCulled=false;});dyn.add(m);B.decor.maquettes++;mx+=.36;}catch(e){}}
 // grille du garage (logement loué : pas de garage privé) et voitures garées
 const mode=(()=>{try{return MWI.state().owned[id]?MWI.state().owned[id].mode:null;}catch(e){return null;}})();
 if(L.gate){const [a,b,c,d]=L.gate,w=Math.hypot(c-a,d-b),hz=Math.abs(d-b)<1e-6,mx2=(a+c)/2,mz=(b+d)/2,open=mode==='achat'||id==='appart';
  B.gateOn=!open;if(!open){const Gt=S;for(let k=0;k<=Math.round(w/.2);k++){const u=-w/2+k*w/Math.round(w/.2);Gt.box(hz?.03:.03,2.3,hz?.03:.03,hz?mx2+u:mx2,0,hz?mz:mz+u,0x6a6e74);}
   if(hz) {Gt.box(w,.05,.06,mx2,2.3,mz,0x4a4e54);Gt.box(w,.05,.06,mx2,.8,mz,0x4a4e54);} else {Gt.box(.06,.05,w,mx2,2.3,mz,0x4a4e54);Gt.box(.06,.05,w,mx2,.8,mz,0x4a4e54);}
   gateCol(B,z,a,b,c,d,true);
   const p=toW(z,mx2,mz);MW.addInteract({id:'mwl:'+id+':gate',x:p.x,z:p.z,r:2.4,label:'Grille : le garage privé est réservé aux propriétaires',when:()=>cur===id,use:()=>MW.toast('Le garage privé n’est pas compris dans un bail : il faut acheter le logement.','info')});B.dynI.push('mwl:'+id+':gate');}
  else gateCol(B,z,a,b,c,d,false);}
 if(mode==='achat'&&L.bays.length){let idx=[];try{idx=MWI.garageOf(id);}catch(e){}let list=[];try{list=MWI.state().cars;}catch(e){}
  L.bays.forEach((bay,k)=>{const ci=idx[k],car=ci!=null?list[ci]:null,p=toW(z,bay[0],bay[1]);
   if(car){const m=MW.carMesh({kind:car.kind,color:car.color,model:car.model});m.userData.park=1;m.position.set(bay[0],0,bay[1]);m.rotation.y=0;m.traverse(o=>{o.frustumCulled=false;});dyn.add(m);
    MW.addInteract({id:'mwl:'+id+':car'+k,x:p.x,z:p.z,r:3.0,label:()=>'Prendre : '+(car.nom||'voiture')+' (votre voiture actuelle prend sa place)',when:()=>cur===id,use:()=>{if(MWI.takeCar(ci)){MW.toast('Vous prenez '+(car.nom||'cette voiture')+'.','good');dynBuild(B);}}});}
   else MW.addInteract({id:'mwl:'+id+':car'+k,x:p.x,z:p.z,r:3.0,label:()=>{let cur2=null;try{cur2=MWC.getCar();}catch(e){}return cur2&&cur2.id!=='vieille'?'Place libre : garer ma '+cur2.nom+' (je reprends la vieille voiture)':'Place libre : garez-y une voiture achetée chez le vendeur d’occasions';},when:()=>cur===id,
     use:()=>{if(MWI.parkCurrent()){MW.toast('Voiture garée dans votre garage privé.','good');dynBuild(B);}else MW.toast('Rien à garer : achetez une voiture chez le vendeur d’occasions (« Acheter et garder l’ancienne »).','info');}});
   B.dynI.push('mwl:'+id+':car'+k);});}
 const ms=S.mesh(matS()),mg=G.mesh(matG());if(ms){ms.userData.own=1;dyn.add(ms);}if(mg){mg.userData.own=1;dyn.add(mg);}
 for(const m of dyn.children) m.traverse(o=>{if(o.isMesh) o.frustumCulled=false;});}
function toShelf(sh,u){const q=sh[2],C=[1,0,-1,0][q],Sn=[0,1,0,-1][q];return {x:sh[0]+u*C+.12*Sn,z:sh[1]-u*Sn+.12*C};}
function gateCol(B,z,a,b,c,d,on){if(B.gateBox){const i=MW.walls.indexOf(B.gateBox);if(i>=0) MW.walls.splice(i,1);B.gateBox=null;}
 if(on){const bx=colW(z,[Math.min(a,c)-.25,Math.min(b,d)-.25,Math.max(a,c)+.25,Math.max(b,d)+.25]);MW.walls.push(bx);B.gateBox=bx;}}

/* ═══ Entrer, sortir, visibilité ═══ */
let cur=null;
api.inside=()=>cur;
function insideTest(id){const z=MW.zone(id),p=MW.player(),B=LB[id];if(!z||!B||p.inCar) return false;const l=toL(z,p.x,p.z),L=LAY[id];return l.x>-L.iw/2-.1&&l.x<L.iw/2+.1&&l.z>.05&&l.z<L.id+.1;}
api.enter=id=>{
 const z=MW.zone(id),L=LAY[id];if(!z||!L) return false;
 if(!ownedL(id)){MW.toast('Ce logement n’est pas à vous.','warn');return false;}
 const P0=MW.player();if(P0.inCar){MW.toast('Descendez de la voiture (F) pour entrer.','warn');return false;}
 const B=build(id);if(!B) return false;dynBuild(B);
 const w=toW(z,0,1.5),ry=Math.atan2(z.n.x,z.n.z);MW.teleport(w.x,w.z,ry,0);B.grp.visible=true;cur=id;
 try{MW.emit('enterHome',id);}catch(e){}
 MW.toast(`${L.nom} · ${api.info(id).surface} m² · ${api.info(id).pieces} pièces`,'info');return true;};
api.leave=()=>{const id=cur;if(!id) return false;const z=MW.zone(id),B=LB[id];const w=z.porte,ry=Math.atan2(-z.n.x,-z.n.z);MW.teleport(w.x,w.z,ry,0);if(B) B.grp.visible=false;cur=null;MW.eyeY=0;return true;};
MW.on('tick',()=>{
 if(!MW.S) return;const p=MW.player();let now=null;
 for(const id of IDS){const B=LB[id];if(!B) continue;if(insideTest(id)){now=id;break;}}
 if(now!==cur){if(cur&&LB[cur]){LB[cur].grp.visible=false;if(!now) MW.eyeY=0;}cur=now;if(cur) LB[cur].grp.visible=true;}
 if(cur) MW.eyeY=FL+1.7;else if(MW.eyeY===FL+1.7) MW.eyeY=0;
 if(cur){const B=LB[cur],h=MW.hourF(),k=h>=7.5&&h<17.5?1:h>=17.5&&h<20?1-(h-17.5)/2.5*.85:h>=5.5&&h<7.5?.15+(h-5.5)/2*.85:.15;
  if(B.sk!==k){B.sk=k;for(const w of B.wins) w.material.color.setRGB(k,k,k*1.05>1?1:k*1.05);}}
 else if(!now){ /* partie chargée dedans : reconstruire l'intérieur (le joueur est dans l'emprise d'un logement) */
  if(p.zoneObj&&IDS.includes(p.zone)&&!p.inCar&&!LB[p.zone]){const z=p.zoneObj,l=toL(z,p.x,p.z),L=LAY[p.zone];if(l.x>-L.iw/2&&l.x<L.iw/2&&l.z>.3&&l.z<L.id&&ownedL(p.zone)) build(p.zone);}}});
MW.on('start',()=>{cur=null;MW.eyeY=0;for(const id of IDS) if(LB[id]) LB[id].grp.visible=false;});
MW.on('immoChanged',()=>{for(const id of IDS) if(LB[id]) dynBuild(LB[id]);});
MW.on('founded',()=>{for(const id of IDS) if(LB[id]) dynBuild(LB[id]);});

/* ═══ Fiche d'achat : surface, pièces, plan ═══ */
api.info=id=>{const L=LAY[id];if(!L) return null;
 const a=L.iw*(L.id-.25);return {surface:Math.round(a),pieces:L.pieces,places:L.places,tier:L.t,nom:L.nom};};
const PLC={lam:'#c9ad82',parq:'#b08450',tile:'#d4dade',conc:'#9a9c9e',carpet:'#8a94a8',marble:'#e6e0d2'};
const ITC={bed:'#6a7ab0',chest:'#c89a1a',desk:'#7a5a34',kitchen:'#d8d0c0',fridge:'#e8eaec',island:'#c8c0b0',table:'#9a7048',sofa:'#6a7a96',armchair:'#7a6a8a',tvunit:'#3a3a40',ctable:'#9a7048',wardrobe:'#a88a5a',shelf:'#7a5a34',bain:'#f4f4f0',shower:'#c8e4f0',wc:'#f4f4f0',sink:'#f4f4f0',rug:'rgba(120,80,80,.25)',plant:'#3a8a3a',lamp:'#d8b030',fire:'#8a5a44',piano:'#1a1a20',workbench:'#8a6a44',rack:'#4a6a8a',column:'#e0dcd0',console:'#9a7048'};
const PLANC={};
api.plan=(id,W)=>{
 const L=LAY[id];if(!L) return '';W=W||360;if(PLANC[id+W]) return PLANC[id+W];const m=10,sc=(W-2*m)/L.iw,Hh=Math.round(L.id*sc+2*m+14);
 const c=document.createElement('canvas');c.width=W;c.height=Hh;const x=c.getContext('2d'),X=u=>m+(u+L.iw/2)*sc,Y=v=>m+v*sc;
 x.fillStyle='#f4f1ea';x.fillRect(0,0,W,Hh);
 for(const r of L.rooms){x.fillStyle=PLC[r.f]||'#ccc';x.fillRect(X(r.x0),Y(r.z0),(r.x1-r.x0)*sc,(r.z1-r.z0)*sc);}
 x.lineCap='round';x.strokeStyle='#2a2c30';x.lineWidth=3.5;x.strokeRect(X(-L.iw/2),Y(.15),L.iw*sc,(L.id-.15)*sc);
 x.lineWidth=2;for(const [x0,z0,x1,z1,gp] of L.walls){const hz=Math.abs(z1-z0)<1e-6,len=hz?Math.abs(x1-x0):Math.abs(z1-z0),dir=hz?(x1>=x0?1:-1):(z1>=z0?1:-1);let cc=0;
  const seg=(a,b)=>{x.beginPath();if(hz){x.moveTo(X(x0+dir*a),Y(z0));x.lineTo(X(x0+dir*b),Y(z0));}else{x.moveTo(X(x0),Y(z0+dir*a));x.lineTo(X(x0),Y(z0+dir*b));}x.stroke();};
  for(const [a,b] of gp.slice().sort((p,q)=>p[0]-q[0])){seg(cc,a);cc=b;}seg(cc,len);}
 for(const it of L.items){const D=IT[it[0]];if(!D) continue;const o=Object.assign({t:L.t},it[4]||{}),sz=D.s(o),q=it[3],sw=q%2?sz[1]:sz[0],sd=q%2?sz[0]:sz[1];
  x.fillStyle=ITC[it[0]]||'#888';x.fillRect(X(it[1]-sw/2),Y(it[2]-sd/2),sw*sc,sd*sc);if(it[0]!=='rug'){x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=.8;x.strokeRect(X(it[1]-sw/2),Y(it[2]-sd/2),sw*sc,sd*sc);}}
 for(const b of L.bays){x.fillStyle='rgba(60,60,70,.55)';x.fillRect(X(b[0]-.9),Y(b[1]-2.2),1.8*sc,4.4*sc);}
 x.fillStyle='#3a8aff';x.fillRect(X(-.5),Y(0)-3,1.0*sc,6);
 x.fillStyle='rgba(20,24,30,.85)';x.font='bold '+Math.max(9,Math.round(sc*.62))+'px Arial';x.textAlign='center';x.textBaseline='middle';
 for(const r of L.rooms){const w=(r.x1-r.x0)*sc;let t=r.n,s=Math.max(9,Math.round(sc*.62));x.font='bold '+s+'px Arial';while(x.measureText(t).width>w-4&&s>7){s--;x.font='bold '+s+'px Arial';}
  if(x.measureText(t).width<=w-2){x.fillStyle='rgba(255,255,255,.7)';const tw=x.measureText(t).width+6,cx=X((r.x0+r.x1)/2),cy=Y(r.z0)+11;x.fillRect(cx-tw/2,cy-8,tw,16);x.fillStyle='#1c2026';x.fillText(t,cx,cy);}}
 x.fillStyle='#4a4e56';x.font='11px Arial';x.textAlign='left';x.fillText('Plan vu du dessus · la porte d’entrée est en haut (trait bleu)',m,Hh-4);
 return PLANC[id+W]=c.toDataURL('image/png');};
api.state=id=>{const B=LB[id];return {built:!!B,visible:!!(B&&B.grp.visible),nbVoitures:B?B.dyn.children.filter(o=>o.userData&&o.userData.park).length:0,decor:B?B.decor:null,inter:B?B.inter.concat(B.dynI):[],colliders:B?B.cols.length:0};};
api.group=id=>LB[id]?LB[id].grp:null;
api.lay=LAY;

/* ═══ Le studio : mêmes boutons qu'avant, plus « Entrer » ═══ */
MW.setDoor('appart',()=>{
 const S=MW.S,night=S&&(S.min>=1140||S.min<360);
 MW.panel('Votre studio',`<p>Un petit studio, le temps de faire vos preuves. ${esc(MW.timeStr())}.</p><div class="mw-btns"><button type="button" class="btn" data-mw="enter">Entrer chez moi</button>${night?'<button type="button" class="btn" data-mw="sleep">Dormir jusqu’à 7 h 30</button>':'<span class="mw-soon">Il est trop tôt pour dormir : revenez à partir de 19 h.</span>'}<button type="button" class="btn ghost" data-mw="save">Sauvegarder</button><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`,
  {onClick:a=>{if(a==='enter'){MW.closePanel();api.enter('appart');}else if(a==='sleep'){if(!(S.min>=1140||S.min<360)) return;MW.closePanel();MW.sleep();}else if(a==='save'){MW.save();MW.toast('Partie sauvegardée.','good');}}});});
window.__mwl=api;
return api;})();
