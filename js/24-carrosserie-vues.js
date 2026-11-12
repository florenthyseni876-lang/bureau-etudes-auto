'use strict';
/* ───────────── Carrosserie : vues de face, arrière, dessus et 3D ───────────── */
ui.cview='profil';ui.caz=-.75;ui.cel=.2;ui.czoom=1;
const CVIEWS=[['profil','Profil'],['face','Face'],['arriere','Arrière'],['dessus','Dessus'],['3d','3D']];
const oldStyle=()=>S.style==='hippo'||S.style==='classique';

// dimensions communes aux vues orthogonales
function carDims(){
  const B=BODY[S.body],C=M.C,dz=S.gc-B.gc0,ol=outline(B,dz,S.gc,S.style);
  const R=Math.min(C.od,B.tireMax)/2,tw=S.tireW,W=B.W,track=W-tw-(oldStyle()?-60:70);
  return {B,ol,R,tw,W,track,H:ol.H,L:B.L,sill:ol.sill,s0:ol.sill0,nY:ol.noseY,tY:ol.tailY,
    belt:ol.glass?ol.glass[0][1]:ol.cowlY,bodyW:oldStyle()?W-2*tw-60:W};
}
function lampFront(cx,cy,mir){
  const lt=S.lights;
  if(lt==='acet'||lt==='elec'){const r=lt==='acet'?70:90;return `<circle cx="${cx}" cy="${-cy}" r="${r}" class="k-lampcase"/><circle cx="${cx}" cy="${-cy}" r="${r*.7}" class="k-lamp"/>`;}
  if(lt==='rond') return `<circle cx="${cx}" cy="${-cy}" r="80" class="k-lamp"/>`;
  if(lt==='escam') return `<rect x="${cx-130}" y="${-(cy+25)}" width="260" height="40" rx="6" class="k-dark"/>`;
  if(lt==='halo') return `<rect x="${cx-150}" y="${-(cy+45)}" width="300" height="90" rx="6" class="k-lamp"/>`;
  if(lt==='xenon') return `<path d="M${cx-170} ${-(cy+50)}L${cx+170} ${-(cy+30)}L${cx+150} ${-(cy-40)}L${cx-160} ${-(cy-30)}Z" class="k-xenon"/>`;
  return `<path d="M${cx-180} ${-(cy+30)}L${cx+180} ${-(cy+20)}L${cx+160} ${-(cy-25)}L${cx-170} ${-(cy-20)}Z" class="k-dark"/><path d="M${cx-160} ${-(cy+8)}L${cx+150} ${-(cy+2)}" class="${lt==='laser'?'k-laser':'k-drl'}"/>`;
}
function bumperFront(W,y,h){
  const b=S.bumper;
  if(b==='chrome') return `<rect x="${-W*.48}" y="${-(y+h/2)}" width="${W*.96}" height="${h}" rx="${h/2}" class="k-chrome"/>`;
  if(b==='massif') return `<rect x="${-W*.5}" y="${-(y+h)}" width="${W}" height="${h*2}" rx="${h*.7}" class="k-chrome"/><rect x="${-W*.25}" y="${-(y+h*1.7)}" width="60" height="${h*3}" rx="30" class="k-chrome"/><rect x="${W*.25-60}" y="${-(y+h*1.7)}" width="60" height="${h*3}" rx="30" class="k-chrome"/>`;
  if(b==='caout') return `<rect x="${-W*.5}" y="${-(y+h)}" width="${W}" height="${h*2}" rx="20" class="k-rubber"/>`;
  if(b==='carbone') return `<rect x="${-W*.47}" y="${-(y+h*.4)}" width="${W*.94}" height="${h*.8}" rx="10" class="k-carbon"/>`;
  if(b==='bouclier') return `<path d="M${-W*.45} ${-(y+h*.7)}H${W*.45}" class="k-seam"/>`;
  return '';
}
function mirrorsFront(W,y){
  const m=S.mirrors;if(m==='none') return '';
  if(m==='aile') return `<ellipse cx="${-W*.38}" cy="${-y}" rx="40" ry="30" class="k-chrome"/><ellipse cx="${W*.38}" cy="${-y}" rx="40" ry="30" class="k-chrome"/>`;
  const c=m==='elec'?`fill="${S.paint}" class="k-paint"`:m==='camera'?'class="k-dark"':'class="k-chrome"',w=m==='camera'?70:120,h=m==='camera'?40:80;
  return `<rect x="${-W/2-w+10}" y="${-(y+h)}" width="${w}" height="${h}" rx="18" ${c}/><rect x="${W/2-10}" y="${-(y+h)}" width="${w}" height="${h}" rx="18" ${c}/>`;
}
// vue de face (rear=true : vue arrière)
function frontSVG(rear,pxw){
  const d=carDims(),{B,R,tw,W,track,H,s0,bodyW}=d,nY=rear?d.tY:d.nY,belt=d.belt,top=H,gw=bodyW*.72,id=rear?'cr':'cf';
  const pad=420,fs0=clamp(11.5*(W+2*pad)/(pxw||600),60,240),vb=`${-W/2-pad} ${-(H+260)} ${W+2*pad} ${H+260+190+fs0*1.6}`;
  let s=`<svg class="car" viewBox="${vb}" role="img" aria-label="Vue ${rear?'arrière':'de face'} : ${B.n}"><defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient></defs>`;
  s+=`<ellipse cx="0" cy="8" rx="${W*.6}" ry="40" class="c-shadow"/><line x1="${-W/2-pad+40}" x2="${W/2+pad-40}" y1="0" y2="0" class="c-ground"/>`;
  // roues
  for(const sx of [-1,1]) s+=`<rect x="${sx*track/2-tw/2}" y="${-2*R}" width="${tw}" height="${2*R}" rx="${tw*.3}" class="c-tire"/>`;
  // caisse : partie basse puis pavillon avec rentrée de caisse
  const lo=s0+40,bw=bodyW/2,gw2=gw/2;
  const body=[[-bw,lo],[-bw-10,belt-60],[-bw+40,belt],[bw-40,belt],[bw+10,belt-60],[bw,lo]];
  s+=`<path d="${rpath(body.map(p=>[p[0],p[1],60]))}" fill="${S.paint}" class="c-body"/><path d="${rpath(body.map(p=>[p[0],p[1],60]))}" fill="url(#${id}s)"/>`;
  if(B.kind!=='roadster'){const gh=[[-bw+60,belt],[-gw2,top-30],[gw2,top-30],[bw-60,belt]];s+=`<path d="${rpath(gh.map(p=>[p[0],p[1],80]))}" fill="${S.paint}" class="c-body"/><path d="${rpath([[-bw+120,belt+20,40],[-gw2+50,top-90,60],[gw2-50,top-90,60],[bw-120,belt+20,40]])}" class="c-glass"/>`;}
  else s+=`<path d="${rpath([[-bw+140,belt,20],[-gw2,belt+300,30],[gw2,belt+300,30],[bw-140,belt,20]])}" class="c-glass"/>`;
  // ailes séparées
  if(oldStyle()) for(const sx of [-1,1]) s+=`<path d="M${sx*track/2-tw/2-50} ${-(s0+10)}V${-(2*R+40)}Q${sx*track/2} ${-(2*R+120)} ${sx*track/2+tw/2+50} ${-(2*R+40)}V${-(s0+10)}" ${S.style==='hippo'?'class="k-dark"':`fill="${S.paint}" class="k-paint"`}/>`;
  // face avant / arrière
  if(!rear){
    if(oldStyle()) s+=`<rect x="-170" y="${-(nY+60)}" width="340" height="${nY+60-lo}" rx="30" class="k-chrome"/><path d="M-130 ${-(nY+20)}V${-(lo+30)}M-65 ${-(nY+20)}V${-(lo+30)}M0 ${-(nY+20)}V${-(lo+30)}M65 ${-(nY+20)}V${-(lo+30)}M130 ${-(nY+20)}V${-(lo+30)}" class="k-seam"/>`;
    else s+=`<rect x="${-bw*.45}" y="${-(nY-40)}" width="${bw*.9}" height="${Math.max(60,nY-lo-140)}" rx="30" class="${S.style==='ailerons'||S.style==='ponton'?'k-chrome':'k-dark'}"/>`;
    const lx=oldStyle()?track/2-60:bw*.68,ly=oldStyle()?nY+90:nY-60;
    s+=lampFront(-lx,ly)+lampFront(lx,ly);
  }else{
    s+=`<rect x="-260" y="${-(lo+260)}" width="520" height="110" rx="8" fill="#f4f6f8" stroke="#111" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    const lx=bw*.7,ly=nY-60;for(const sx of [-1,1]) s+=`<rect x="${sx*lx-(oldStyle()?60:150)}" y="${-(ly+50)}" width="${oldStyle()?120:300}" height="${oldStyle()?100:100}" rx="${oldStyle()?50:10}" class="k-tail"/>`;
    s+=`<ellipse cx="${-bw*.55}" cy="${-(s0+20)}" rx="45" ry="30" class="k-dark"/>`;
  }
  s+=bumperFront(oldStyle()?track+tw:bodyW,s0+.32*(nY-s0),46);
  s+=mirrorsFront(bodyW,belt+60);
  // cotes
  const fs=clamp(11.5*(W+2*pad)/(pxw||600),60,240);
  s+=`<path d="M${-W/2} 150V190M${W/2} 150V190M${-W/2} 170H${W/2}" class="c-dim"/><text x="0" y="${170+fs*1.15}" text-anchor="middle" font-size="${fs}" class="c-dimt">Largeur ${nf(W)}</text>`;
  return s+'</svg>';
}
// vue de dessus
function topSVG(pxw){
  const d=carDims(),{B,ol,R,tw,W,L,track,bodyW}=d,fx=B.FO,rx=B.FO+B.WB,pad=300;
  const sh={hippo:.25,classique:.3,profile:.55,ponton:.45,ailerons:.4,tendu:.3,aero:.55,bio:.65,moderne:.45}[S.style]||.45;
  const rN=bodyW*sh*.7,rT=bodyW*sh*.5,bw=bodyW/2;
  const fs0=clamp(11.5*(L+2*pad)/(pxw||600),60,260);let s=`<svg class="car" viewBox="${-pad} ${-W/2-pad} ${L+2*pad} ${W+pad+170+fs0*1.6}" role="img" aria-label="Vue de dessus : ${B.n}">`;
  for(const x of [fx,rx]) for(const sy of [-1,1]) s+=`<rect x="${x-R}" y="${sy*track/2-tw/2}" width="${2*R}" height="${tw}" rx="40" class="c-tire"/>`;
  const plan=[[0,-bw*.86,rN],[0,bw*.86,rN],[L*.5,bw,600],[L,bw*.9,rT],[L,-bw*.9,rT],[L*.5,-bw,600]];
  const pp=pts=>'M'+pts.map(p=>p[0].toFixed(0)+' '+p[1].toFixed(0)).join('L')+'Z';
  const rr=pts=>{let dd='';const n=pts.length;for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],v1=[p0[0]-p1[0],p0[1]-p1[1]],v2=[p2[0]-p1[0],p2[1]-p1[1]],l1=Math.hypot(...v1)||1,l2=Math.hypot(...v2)||1,r=Math.min(p1[2]||0,l1/2,l2/2),a=[p1[0]+v1[0]/l1*r,p1[1]+v1[1]/l1*r],b=[p1[0]+v2[0]/l2*r,p1[1]+v2[1]/l2*r];dd+=(i?'L':'M')+a[0].toFixed(0)+' '+a[1].toFixed(0)+'Q'+p1[0].toFixed(0)+' '+p1[1].toFixed(0)+' '+b[0].toFixed(0)+' '+b[1].toFixed(0);}return dd+'Z';};
  s+=`<path d="${rr(plan)}" fill="${S.paint}" class="c-body"/>`;
  if(oldStyle()) for(const x of [fx,rx]) for(const sy of [-1,1]) s+=`<rect x="${x-R-60}" y="${sy*track/2-tw/2-40}" width="${2*R+120}" height="${tw+80}" rx="${tw*.5}" ${S.style==='hippo'?'class="k-dark"':`fill="${S.paint}" class="k-paint"`}/>`;
  // vitrage et toit
  const g=ol.glass;
  if(g){const x0=g[0][0],x1=g[1][0],x2=g[2][0],x3=g[3][0],gw=bw*.78,rw=bw*.66;
    s+=`<path d="${pp([[x0,-gw],[x1,-rw],[x1,rw],[x0,gw]])}" class="c-glass"/><path d="${pp([[x2,-rw],[x3,-gw*.92],[x3,gw*.92],[x2,rw]])}" class="c-glass"/>`;
    s+=`<rect x="${x1}" y="${-rw}" width="${x2-x1}" height="${2*rw}" rx="60" fill="${S.paint}" class="c-body"/><rect x="${x1}" y="${-rw}" width="${x2-x1}" height="${2*rw}" rx="60" fill="#fff" opacity=".12"/>`;}
  else{s+=`<path d="${pp([[ol.cowlX+40,-bw*.8],[ol.cowlX+200,-bw*.75],[ol.cowlX+200,bw*.75],[ol.cowlX+40,bw*.8]])}" class="c-glass"/><rect x="${ol.cowlX+260}" y="${-bw*.7}" width="${1100}" height="${bw*1.4}" rx="80" class="k-dark" opacity=".55"/>`;}
  if(S.style==='ailerons') for(const sy of [-1,1]) s+=`<path d="M${L-700} ${sy*bw*.86}L${L-10} ${sy*bw*.92}" stroke="#fff" stroke-opacity=".5" stroke-width="30"/>`;
  if(S.wing==='wing') s+=`<rect x="${L-330}" y="${-bw*.9}" width="160" height="${bw*1.8}" rx="20" class="c-trim"/>`;
  // rétroviseurs
  if(S.mirrors!=='none'){const mx=S.mirrors==='aile'?fx+60:(g?g[0][0]:ol.cowlX)+40;for(const sy of [-1,1]) s+=`<rect x="${mx}" y="${sy>0?bw-10:-bw-110}" width="${S.mirrors==='camera'?70:100}" height="120" rx="25" ${S.mirrors==='elec'?`fill="${S.paint}" class="k-paint"`:S.mirrors==='camera'?'class="k-dark"':'class="k-chrome"'}/>`;}
  // phares (vus du dessus)
  if(S.lights==='acet'||S.lights==='elec') for(const sy of [-1,1]) s+=`<circle cx="120" cy="${sy*bw*.6}" r="70" class="k-lampcase"/>`;
  const fs=clamp(11.5*(L+2*pad)/(pxw||600),60,260);
  s+=`<path d="M0 ${W/2+130}V${W/2+170}M${L} ${W/2+130}V${W/2+170}M0 ${W/2+150}H${L}" class="c-dim"/><text x="${L/2}" y="${W/2+150+fs*1.15}" text-anchor="middle" font-size="${fs}" class="c-dimt">Longueur ${nf(L)} · largeur ${nf(W)}</text>`;
  return s+'</svg>';
}
// ── 3D
let C3=null;
const car3dSig=()=>['body','style','paint','gc','rim','tireW','profile','bumper','lights','mirrors','wing','splitter','rimType'].map(k=>S[k]).join('|');
function disposeCar3D(){if(!C3) return;try{C3.scene.traverse(o=>{if(o.geometry) o.geometry.dispose();if(o.material&&o.material.dispose) o.material.dispose();});C3.renderer.dispose();C3.renderer.forceContextLoss();}catch(e){}C3=null;}
function initCar3D(cv){
  if(!window.THREE) return false;
  try{
    const T=THREE,renderer=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.outputEncoding=T.sRGBEncoding;
    const scene=new T.Scene(),cam=new T.PerspectiveCamera(28,2,10,60000);
    scene.add(new T.HemisphereLight(0xffffff,0x4a5568,.9));
    const d1=new T.DirectionalLight(0xffffff,1);d1.position.set(1.2,2.2,1.4);scene.add(d1);
    const d2=new T.DirectionalLight(0xc8dcff,.45);d2.position.set(-1.6,.8,-1.2);scene.add(d2);
    C3={cv,renderer,scene,cam,root:null,sig:''};
    let drag=null,pinch=null;
    cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};try{cv.setPointerCapture(e.pointerId);}catch(err){}});
    cv.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id) return;ui.caz-=(e.clientX-drag.x)*.009;ui.cel=clamp(ui.cel+(e.clientY-drag.y)*.006,-.15,1.3);drag.x=e.clientX;drag.y=e.clientY;drawCar3D();});
    const up=()=>{drag=null;};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    const pts=new Map();
    cv.addEventListener('pointerdown',e=>{pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);drag=null;}});
    cv.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId)) return;pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===2&&pinch){const [a,b]=[...pts.values()],dd=Math.hypot(a[0]-b[0],a[1]-b[1]);ui.czoom=clamp(ui.czoom*dd/pinch,.6,2.5);pinch=dd;drawCar3D();}});
    const rm=e=>{pts.delete(e.pointerId);if(pts.size<2) pinch=null;};cv.addEventListener('pointerup',rm);cv.addEventListener('pointercancel',rm);
    cv.addEventListener('wheel',e=>{e.preventDefault();ui.czoom=clamp(ui.czoom*(e.deltaY>0?.9:1.1),.6,2.5);drawCar3D();},{passive:false});
    return true;
  }catch(e){C3=null;return false;}
}
function shapeFrom(pts,dx,dy){
  // contour arrondi identique au dessin de profil (y vers le haut)
  const T=THREE,sh=new T.Shape(),n=pts.length;
  for(let i=0;i<n;i++){
    const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],v1=[p0[0]-p1[0],p0[1]-p1[1]],v2=[p2[0]-p1[0],p2[1]-p1[1]],l1=Math.hypot(v1[0],v1[1])||1,l2=Math.hypot(v2[0],v2[1])||1,r=Math.min(p1[2]||0,l1/2,l2/2);
    const a=[p1[0]+v1[0]/l1*r-dx,p1[1]+v1[1]/l1*r-dy],b=[p1[0]+v2[0]/l2*r-dx,p1[1]+v2[1]/l2*r-dy];
    if(i===0) sh.moveTo(a[0],a[1]);else sh.lineTo(a[0],a[1]);
    sh.quadraticCurveTo(p1[0]-dx,p1[1]-dy,b[0],b[1]);
  }
  return sh;
}
function buildCar3D(){
  const T=THREE,d=carDims(),{B,ol,R,tw,track,L,s0,bodyW}=d,H=d.H,fx=B.FO,rx=B.FO+B.WB,cx=L/2;
  if(C3.root){C3.scene.remove(C3.root);C3.root.traverse(o=>{if(o.geometry) o.geometry.dispose();});}
  const root=new T.Group();C3.root=root;C3.scene.add(root);
  const paint=new T.MeshStandardMaterial({color:new T.Color(S.paint).convertSRGBToLinear(),metalness:.45,roughness:.32});
  const glass=new T.MeshStandardMaterial({color:0x1d2b3c,metalness:.6,roughness:.08,transparent:true,opacity:.86});
  const dark=new T.MeshStandardMaterial({color:0x17191d,roughness:.85});
  const chrome=new T.MeshStandardMaterial({color:0xdfe5ec,metalness:1,roughness:.18});
  const rubber=new T.MeshStandardMaterial({color:0x232528,roughness:.95});
  const lampM=new T.MeshStandardMaterial({color:0xfff4c2,emissive:0xffe08a,emissiveIntensity:.6,roughness:.2});
  const tailM=new T.MeshStandardMaterial({color:0xb01f1f,emissive:0x7a0d0d,emissiveIntensity:.5,roughness:.3});
  const bw=bodyW/2,belt=d.belt;
  // galbe : rentrée de caisse au-dessus de la ceinture, extrémités arrondies vue de dessus
  const shapeV=(geo,k)=>{const p=geo.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i)+cx,y=p.getY(i)+0,z=p.getZ(i);const yy=y;
      let f=1;if(yy>belt) f*=1-.24*clamp((yy-belt)/(H-belt),0,1);
      const e=Math.min(x,L-x),pr={hippo:.12,classique:.15,profile:.35,ponton:.25,ailerons:.22,tendu:.18,aero:.32,bio:.4,moderne:.25}[S.style]||.25;
      f*=1-pr*Math.pow(clamp(1-e/700,0,1),2);if(yy<s0+120) f*=1-.05*clamp((s0+120-yy)/120,0,1);
      p.setZ(i,z*f*k);}p.needsUpdate=true;geo.computeVertexNormals();};
  const ext=(pts,depth,mat,k)=>{const geo=new T.ExtrudeGeometry(shapeFrom(pts,cx,0),{depth,bevelEnabled:true,bevelThickness:40,bevelSize:30,bevelSegments:3,curveSegments:10,steps:1});geo.translate(0,0,-depth/2);shapeV(geo,k||1);const m=new T.Mesh(geo,mat);root.add(m);return m;};
  ext(ol.body,bodyW-80,paint);
  if(ol.glass){const gm=ext(ol.glass,bodyW-60,glass,1.012);gm.renderOrder=1;}
  else ext(ol.ws,bodyW*.8,glass,1);
  // roues
  const wheel=(x,z)=>{const g=new T.Group();
    const tire=new T.Mesh(new T.CylinderGeometry(R,R,tw,40),rubber);tire.rotation.x=Math.PI/2;g.add(tire);
    const rimR=Math.min(S.rim*12.7,R-30),rim=new T.Mesh(new T.CylinderGeometry(rimR,rimR,tw+6,32),S.rimType==='steel'?dark:chrome);rim.rotation.x=Math.PI/2;g.add(rim);
    g.position.set(x-cx,R,z);root.add(g);};
  for(const x of [fx,rx]) for(const sz of [-1,1]) wheel(x,sz*track/2);
  // ailes séparées et marchepieds
  if(oldStyle()){const fm=S.style==='hippo'?dark:paint;
    for(const x of [fx,rx]) for(const sz of [-1,1]){const f=new T.Mesh(new T.CylinderGeometry(R+90,R+90,tw+110,28,1,true,-Math.PI/2,Math.PI),fm);f.material.side=T.DoubleSide;f.rotation.x=Math.PI/2;f.position.set(x-cx,R,sz*track/2);root.add(f);}
    for(const sz of [-1,1]){const rb=new T.Mesh(new T.BoxGeometry(rx-fx-2*R-160,30,tw+40),dark);rb.position.set((fx+rx)/2-cx,s0+10,sz*track/2);root.add(rb);}
    const rad=new T.Mesh(new T.BoxGeometry(60,d.nY-s0-40,bw*.8),chrome);rad.position.set(-cx-10,(d.nY+s0)/2,0);root.add(rad);}
  // pare-chocs
  const by=s0+.32*(d.nY-s0),bty=s0+.32*(d.tY-s0);
  const bmat={chrome,massif:chrome,caout:rubber,carbone:dark}[S.bumper];
  if(bmat){const h=S.bumper==='massif'||S.bumper==='caout'?95:50,w=oldStyle()?(track+tw)*.98:bodyW*.86;for(const [x,y] of [[-30,by],[L+30,bty]]){const b=new T.Mesh(new T.BoxGeometry(70,h,w),bmat);b.position.set(x-cx,y,0);root.add(b);}}
  // phares et feux
  const lt=S.lights;
  for(const sz of [-1,1]){
    if(lt==='acet'||lt==='elec'){const r=lt==='acet'?70:90,l=new T.Mesh(new T.CylinderGeometry(r,r,130,20),chrome);l.rotation.z=Math.PI/2;l.position.set(120-cx,(oldStyle()?d.nY+r+20:d.nY+r),sz*bw*.62);root.add(l);const g=new T.Mesh(new T.CircleGeometry(r*.8,20),lampM);g.rotation.y=-Math.PI/2;g.position.set(120-cx-66,l.position.y,l.position.z);root.add(g);}
    else{const wl=lt==='rond'?150:lt==='escam'?40:lt==='halo'?90:60,ln=lt==='rond'?160:300;const l=new T.Mesh(new T.BoxGeometry(60,wl,ln),lt==='escam'?dark:lampM);l.position.set(10-cx,d.nY-(lt==='rond'?80:50),sz*(bw-ln/2-60));root.add(l);}
    const t=new T.Mesh(new T.BoxGeometry(50,oldStyle()?90:100,oldStyle()?100:320),tailM);t.position.set(L-15-cx,d.tY-70,sz*(bw-(oldStyle()?150:200)));root.add(t);
  }
  // rétroviseurs
  if(S.mirrors!=='none'){const mm=S.mirrors==='elec'?paint:S.mirrors==='camera'?dark:chrome;for(const sz of [-1,1]){const m=new T.Mesh(new T.BoxGeometry(70,S.mirrors==='camera'?40:80,130),mm);const mx=S.mirrors==='aile'?fx+60:(ol.glass?ol.glass[0][0]:ol.cowlX)+30,my=S.mirrors==='aile'?d.nY+100:belt+60;m.position.set(mx-cx,my,sz*(S.mirrors==='aile'?bw*.8:bw+50));root.add(m);}}
  // ailerons arrière (style américain) et aileron
  if(S.style==='ailerons') for(const sz of [-1,1]){const sh=new T.Shape();sh.moveTo(0,0);sh.lineTo(700,0);sh.lineTo(720,190);sh.lineTo(600,170);sh.lineTo(0,10);const g=new T.ExtrudeGeometry(sh,{depth:40,bevelEnabled:false});const f=new T.Mesh(g,paint);f.position.set(L-740-cx,d.tY-5,sz*bw*.88-20);root.add(f);}
  if(S.wing==='wing'){const w=new T.Mesh(new T.BoxGeometry(260,25,bodyW*.9),dark);w.position.set(L-220-cx,d.tY+220,0);root.add(w);for(const sz of [-1,1]){const p=new T.Mesh(new T.BoxGeometry(40,220,30),dark);p.position.set(L-220-cx,d.tY+110,sz*bodyW*.3);root.add(p);}}
  // ombre au sol
  const sh=new T.Mesh(new T.CircleGeometry(1,40),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.22}));sh.scale.set(L*.58,bodyW*.75,1);sh.rotation.x=-Math.PI/2;sh.position.y=2;root.add(sh);
  C3.size=Math.max(L,bodyW,H);C3.sig=car3dSig();
}
function drawCar3D(){
  if(!C3) return;
  const cv=C3.cv,w=cv.clientWidth||600,h=cv.clientHeight||320;
  if(w!==C3.w||h!==C3.h){C3.renderer.setSize(w,h,false);C3.cam.aspect=w/h;C3.cam.updateProjectionMatrix();C3.w=w;C3.h=h;}
  const D=C3.size*1.9/ui.czoom/Math.min(1.2,Math.max(.6,w/h/1.6));
  C3.cam.position.set(Math.sin(ui.caz)*Math.cos(ui.cel)*D,Math.sin(ui.cel)*D+500,Math.cos(ui.caz)*Math.cos(ui.cel)*D);
  C3.cam.lookAt(0,520,0);C3.renderer.render(C3.scene,C3.cam);
}
// figure de la page Carrosserie
function bodyViewsHTML(){
  const v=ui.cview,pxw=($('#stageDraw').clientWidth||620)-28,B=BODY[S.body];
  const seg=`<div class="seg" role="radiogroup" aria-label="Angle de vue">${CVIEWS.map(([k,n])=>`<button type="button" role="radio" data-cv="${k}" aria-checked="${v===k}">${n}</button>`).join('')}</div>`,tools=`<div class="draw-tools cv-tools">${seg}</div>`;
  let body,cap=`${B.n} · style ${STYLE[S.style].n.toLocaleLowerCase()}`;
  if(v==='3d'){body='<div class="car3d-w"><canvas id="car3d" role="img" aria-label="Vue 3D de la voiture, à faire tourner"></canvas></div>';cap+=' · faites glisser pour tourner, molette ou pincement pour zoomer';}
  else if(v==='face') body=frontSVG(false,pxw);
  else if(v==='arriere') body=frontSVG(true,pxw);
  else if(v==='dessus') body=topSVG(pxw);
  else return carFigure().replace('<div class="draw-tools">',`<div class="draw-tools cv-tools">${seg}`);
  return `<figure class="draw">${tools}${body}<figcaption>${cap}${v==='3d'?'':' · cotes en mm'}</figcaption></figure>`;
}
function renderBodyStage(draw){
  if(ui.cview==='3d'&&$('#car3d')&&C3){if(C3.sig!==car3dSig()) buildCar3D();drawCar3D();$('figcaption',draw).textContent=`${BODY[S.body].n} · style ${STYLE[S.style].n.toLocaleLowerCase()} · faites glisser pour tourner, molette ou pincement pour zoomer`;return;}
  disposeCar3D();draw.innerHTML=bodyViewsHTML();
  if(ui.cview==='3d'){if(initCar3D($('#car3d'))){buildCar3D();drawCar3D();}else{ui.cview='profil';draw.innerHTML=bodyViewsHTML();}}
}
$('#stage').addEventListener('click',e=>{const b=e.target.closest('[data-cv]');if(!b) return;ui.cview=b.dataset.cv;renderBodyStage($('#stageDraw'));});
