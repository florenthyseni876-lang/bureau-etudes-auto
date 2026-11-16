/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
   Bureau d'Études Auto · mode Mécanicien · portières et habitacle (js/44h)
   Construit, pour la seule voiture sur laquelle on travaille (le « rig » de js/46), ce qui ne doit pas coûter d'appels de
   dessin aux voitures du décor :
   - une vraie portière (tôle, vitre, montants, poignée, rétroviseur, contre-porte) qui pivote sur ses charnières ;
   - la découpe de la carrosserie côté portière uniquement (plans de coupe en boîte), au lieu d'une carrosserie entière transparente ;
   - la boîte à gants (bac ouvert + trappe articulée) qui s'abaisse quand on libère ses butées, avec la place du filtre d'habitacle ;
   - la pédale de frein mobile ;
   - le balai d'essuie-glace amovible (échange de la variante de garniture sans balai).
   Tout est en coordonnées de la voiture (x = gauche, z = avant), lues dans g.userData.G (js/44). Aucune dépendance à js/46.
   API : MWHAB.build(R) → {door, pdn, ddn, pedal, filter, setDoor(a), tick(dt), free(), swapBlade(on)} ou null.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const MWHAB=(()=>{
const T=THREE,PI=Math.PI;
const MC=new Map();
const mat=(col,k,sh)=>{const key=col+'|'+(k||'l')+'|'+(sh||0);let m=MC.get(key);if(m) return m;
 m=k==='p'?new T.MeshPhongMaterial({color:col,shininess:sh||60,specular:0x555555,side:T.DoubleSide}):new T.MeshLambertMaterial({color:col,side:T.DoubleSide});MC.set(key,m);return m;};
const BOX=new T.BoxGeometry(1,1,1),CYL=new T.CylinderGeometry(1,1,1,14);
/* boîte de dimensions w×h×d centrée en (x,y,z) */
function box(w,h,d,m,x,y,z){const o=new T.Mesh(BOX,m);o.scale.set(w,h,d);o.position.set(x,y,z);return o;}
/* barre de section w×h entre deux points */
function bar(a,b,w,h,m){const o=new T.Mesh(BOX,m),len=a.distanceTo(b)||.01;o.position.copy(a).add(b).multiplyScalar(.5);o.scale.set(w,h,len);o.lookAt(b);return o;}
function cyl(r,h,m,x,y,z,ax){const o=new T.Mesh(CYL,m);o.scale.set(r,h,r);o.position.set(x,y,z);if(ax==='x') o.rotation.z=PI/2;else if(ax==='z') o.rotation.x=PI/2;return o;}
/* surface en grille (vitre) : z de za à zb, y de bot à top(z), x = sg·fx(z,y) */
function grid(za,zb,top,bot,fx,sg,ox,oz){
 const nz=Math.max(3,Math.round((za-zb)/.05)),ny=4,pos=[],idx=[];
 for(let i=0;i<=nz;i++){const z=za+(zb-za)*i/nz,yt=top(z);for(let j=0;j<=ny;j++){const y=bot+(yt-bot)*j/ny;pos.push(sg*fx(z,y)-ox,y,z-oz);}}
 for(let i=0;i<nz;i++) for(let j=0;j<ny;j++){const a=i*(ny+1)+j,b=(i+1)*(ny+1)+j;idx.push(a,b,a+1,b,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}

function build(R){
 const g=R.g,G=g.userData&&g.userData.G;if(!G||!G.doorZ||!G.interX) return null;
 const hw=G.hw,gc=G.gc,hb=G.hb,sx=G.sx,root=R.root;
 const mesh=geo=>g.children.find(m=>m.isMesh&&m.geometry===geo);
 const M={paint:mesh(G.paint),glass:mesh(G.glass),dark:mesh(G.dark),trim:mesh(G.trim),chrome:mesh(G.chrome),inter:mesh(G.inter)};
 if(!M.paint||!M.glass||!M.trim||!M.inter) return null;
 const O={paint:M.paint.material,glass:M.glass.material,trim:M.trim.material,inter:M.inter.material};   /* matières d'origine, partagées : jamais modifiées */
 const own=[];                         /* géométries créées ici, libérées à la fin */
 const H={own,door:null,ang:0,target:0};
 const kmat={p:mat(0x1a1c20,'p',30),card:O.inter,chrome:mat(0xc4c8ce,'p',90),gray:mat(0x2b2e33,'l'),lite:mat(0x565a62,'l'),flap:mat(0x3b3e45,'l'),hole:mat(0x0d0e10,'l'),rubber:mat(0x15161a,'l')};

 /* ── portière passager (côté x < 0) ── */
 const sg=-1,zF=G.doorZ[0]-.01,zR=G.doorZ[1]+.01,px=sg*(hw-.02),pz=zF;
 const door=new T.Group();door.position.set(px,0,pz);root.add(door);H.door=door;
 const dm=new T.Group();dm.visible=false;door.add(dm);          /* pièces dessinées (cachées porte fermée : la coque porte alors la tôle) */
 const L=(o,x,y,z)=>{o.position.set(x-px,y,z-pz);return o;};   /* place un maillage donné en coordonnées de la voiture */
 const dbox=(w,h,d,m,x,y,z)=>dm.add(L(box(w,h,d,m,0,0,0),x,y,z));
 const yS=G.sill,yTop=hb-.025,dl=zF-zR;
 dbox(.05,yTop-yS,dl,O.paint,sg*(hw-.015),(yS+yTop)/2,(zF+zR)/2);                                       /* tôle extérieure */
 dbox(.1*hw+.05,.04,dl-.02,O.paint,sg*hw*.95,yTop+.005,(zF+zR)/2);                                       /* épaulement sous la vitre */
 dbox(.03,.03,dl-.04,kmat.gray,sg*(hw+.012),yS+.02,(zF+zR)/2);                                           /* bas de porte */
 const za=Math.min(zF-.06,G.zS),zb=Math.max(zR+.07,G.zE),wt=G.winTop,ybw=G.ybw;
 if(za-zb>.15){
  const gm=new T.Mesh(grid(za,zb,wt,ybw,G.sideX,sg,px,pz),O.glass);gm.position.set(0,0,0);dm.add(gm);own.push(gm.geometry);
  const P=(z,y)=>new T.Vector3(sg*G.sideX(z,y)-px,y,z-pz);
  for(const z of [za,zb]) dm.add(bar(P(z,ybw),P(z,wt(z)+.02),.032,.032,kmat.p));                       /* montants de la vitre */
  const n=6;for(let i=0;i<n;i++){const z1=za+(zb-za)*i/n,z2=za+(zb-za)*(i+1)/n;dm.add(bar(P(z1,wt(z1)+.02),P(z2,wt(z2)+.02),.035,.035,kmat.p));}
  dm.add(bar(P(za,ybw+.012),P(zb,ybw+.012),.03,.03,kmat.chrome));}                                     /* jonc de vitre */
 const hz=Math.max(zR+.12,Math.min(zF-.12,G.handleZ));
 dbox(.022,.024,.14,O.trim,sg*(hw+.012),hb-.09,hz);dbox(.012,.05,.19,kmat.gray,sg*(hw+.004),hb-.09,hz);   /* poignée et alvéole */
 const mz=G.zc-.2;
 if(mz<zF&&mz>zR){dbox(.1,.13,.17,O.paint,sg*(hw+.1),hb+.1,mz);dbox(.085,.11,.006,kmat.gray,sg*(hw+.1),hb+.1,mz-.088);dbox(.06,.04,.09,kmat.gray,sg*(hw+.03),hb+.075,mz+.06);}   /* rétroviseur */
 /* contre-porte : panneau, accoudoir, tirette, haut-parleur, commande de lève-vitre */
 const zm=(zF+zR)/2;
 dbox(.035,.34,dl-.1,kmat.card,sg*(hw-.07),(yS+hb)/2-.06,zm);dbox(.07,.04,.36,kmat.card,sg*(hw-.09),hb-.12,zm-.05);
 dbox(.03,.03,.16,kmat.lite,sg*(hw-.1),hb-.07,zm+.1);dbox(.02,.03,.05,kmat.lite,sg*(hw-.1),hb-.145,zm-.1);
 dm.add(L(cyl(.06,.02,kmat.rubber,0,0,0,'x'),sg*(hw-.092),yS+.08,zm-.02));
 /* repère de manœuvre : la poignée suit la portière (cible visée) */
 const pdn=new T.Object3D();door.add(L(pdn,sg*(hw+.02),hb-.09,hz));H.pdn=pdn;
 /* portière conducteur : poignée côté x > 0 (la cible suit la poignée dessinée) */
 const ddn=new T.Object3D();ddn.position.set(hw+.02,hb-.09,hz);root.add(ddn);H.ddn=ddn;

 /* ── découpe de la carrosserie côté portière : boîte de coupe en plans (intersection) ── */
 const zr0=zR-.02,zf0=zF+.02;let yMax=1e9;for(let z=zr0;z<=zf0;z+=.05) yMax=Math.min(yMax,G.roofY(z)-.06);
 const lo=new T.Vector3(sg*(hw+.7),yS+.005,zr0),hi=new T.Vector3(sg*hw*.5,yMax,zf0);
 const mn=new T.Vector3(Math.min(lo.x,hi.x),lo.y,lo.z),mx=new T.Vector3(Math.max(lo.x,hi.x),hi.y,hi.z);
 const loc=[new T.Plane(new T.Vector3(1,0,0),-mx.x),new T.Plane(new T.Vector3(-1,0,0),mn.x),new T.Plane(new T.Vector3(0,1,0),-mx.y),new T.Plane(new T.Vector3(0,-1,0),mn.y),new T.Plane(new T.Vector3(0,0,1),-mx.z),new T.Plane(new T.Vector3(0,0,-1),mn.z)];
 const pl=loc.map(p=>p.clone()),clones=[];let cut=false;
 const setCut=on=>{
  if(on===cut) return;cut=on;
  const r=typeof MW!=='undefined'&&MW.renderer&&MW.renderer();if(on&&r) r.localClippingEnabled=true;
  for(const k of ['paint','glass','dark','trim','chrome']){const m=M[k];if(!m) continue;
   if(on){const c=O[k]||m.material;if(!O[k]) O[k]=c;const cl=c.clone();cl.clippingPlanes=pl;cl.clipIntersection=true;m.material=cl;clones.push(cl);}
   else if(O[k]) m.material=O[k];}
  if(!on){while(clones.length) clones.pop().dispose();}
  M.inter.geometry=on?G.interX:G.inter;};              /* la contre-porte passager part avec la portière */
 const syncPlanes=()=>{g.updateMatrixWorld(true);for(let i=0;i<6;i++) pl[i].copy(loc[i]).applyMatrix4(g.matrixWorld);};
 O.dark=M.dark&&M.dark.material;O.chrome=M.chrome&&M.chrome.material;

 /* ── boîte à gants (côté passager, face arrière de la planche de bord) ── */
 const zc=G.zc,zFace=zc-.35,gx=-sx,gW=.46,gH=.2,gD=.17,gy=G.dashY-.06,gzFront=zFace-gD;
 const cab=new T.Group();root.add(cab);H.cab=cab;
 const wallM=kmat.flap,t=.014;
 cab.add(box(gW,t,gD,wallM,gx,gy-gH/2+t/2,zFace-gD/2),box(gW,t,gD,wallM,gx,gy+gH/2-t/2,zFace-gD/2),box(t,gH,gD,wallM,gx-gW/2+t/2,gy,zFace-gD/2),box(t,gH,gD,wallM,gx+gW/2-t/2,gy,zFace-gD/2),box(gW,gH,t,kmat.hole,gx,gy,zFace-t/2));
 const flapP=new T.Group();flapP.position.set(gx,gy-gH/2,gzFront-.012);cab.add(flapP);                  /* charnière en bas de la trappe */
 flapP.add(box(gW+.012,gH+.012,.022,mat(0x3f424a,'l'),0,gH/2,0),box(.16,.022,.026,kmat.lite,0,gH-.014,-.012),box(.1,.008,.026,kmat.hole,0,gH*.55,-.012));
 H.flap=flapP;H.flapA=0;H.flapT=0;
 H.filter=new T.Vector3(gx,gy-gH/2+.04,zFace-gD*.5);                                                      /* place du filtre : dans le bac */
 H.stops=[new T.Vector3(gx+gW/2+.012,gy,gzFront+.045),new T.Vector3(gx-gW/2-.012,gy,gzFront+.045)];       /* butées de la trappe (clips) */

 /* ── pédale de frein : bras, patin et bague de caoutchouc ── */
 const pz0=G.zSeat+.42,pedal=new T.Group();pedal.position.set(sx,.42,pz0+.07);cab.add(pedal);H.pedal=pedal;
 pedal.add(bar(new T.Vector3(0,0,0),new T.Vector3(0,-.13,-.04),.018,.018,kmat.lite));
 pedal.add(box(.085,.012,.05,kmat.rubber,0,-.15,-.05),box(.085,.004,.05,kmat.lite,0,-.15,-.05));
 pedal.children[1].rotation.x=-.5;pedal.children[2].rotation.x=-.5;
 const pedalT=new T.Object3D();pedalT.position.set(0,-.14,-.05);pedal.add(pedalT);H.pedalT=pedalT;
 H.bounce=0;

 /* ── pilotage ── */
 H.setDoor=a=>{H.target=a?1.2:0;if(a){setCut(true);dm.visible=true;}};
 H.swapBlade=on=>{if(M.trim) M.trim.geometry=on?G.trimX:G.trim;};
 H.tick=dt=>{
  const F=R.F;
  if(Math.abs(H.ang-H.target)>.002){H.ang+=(H.target-H.ang)*Math.min(1,dt*7);if(Math.abs(H.ang-H.target)<.03) H.ang=H.target;}
  door.rotation.y=-sg*H.ang;
  if(!H.target&&H.ang<.01){dm.visible=false;setCut(false);}
  if(cut) syncPlanes();
  /* trappe : s'abaisse dès que les butées sont libérées */
  const S=F&&F.s&&F.s.filtre_hab,open=S?S.f.every(v=>!v):false;H.flapT=open?1.4:0;
  H.flapA+=(H.flapT-H.flapA)*Math.min(1,dt*6);flapP.rotation.x=-H.flapA;
  /* pédale : une impulsion à chaque fois que l'état « à pomper » retombe */
  const pump=F?!!F.pump:false;if(H._pump&&!pump) H.bounce=1;H._pump=pump;
  if(H.bounce>0){H.bounce=Math.max(0,H.bounce-dt*1.6);pedal.rotation.x=-.28*Math.sin(Math.min(1,H.bounce)*PI);}else pedal.rotation.x=0;};
 H.free=()=>{setCut(false);M.trim&&(M.trim.geometry=G.trim);M.inter.geometry=G.inter;
  root.remove(door,cab);for(const o of own) o.dispose();};
 return H;}
return {build};
})();
