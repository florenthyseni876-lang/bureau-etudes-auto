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
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
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
    if(r<1){if(i===0) sh.moveTo(p1[0]-dx,p1[1]-dy);else sh.lineTo(p1[0]-dx,p1[1]-dy);continue;}
    if(i===0) sh.moveTo(a[0],a[1]);else sh.lineTo(a[0],a[1]);
    sh.quadraticCurveTo(p1[0]-dx,p1[1]-dy,b[0],b[1]);
  }
  return sh;
}
// éléments repérables dans la vue 3D
const C3PARTS=[['caisse','Caisse'],['vitrage','Vitrage'],['phares','Phares'],['feux','Feux arrière'],['parechocs','Pare-chocs'],['retros','Rétroviseurs'],['calandre','Calandre'],['roues','Roues et freins'],['ailes','Ailes et marchepieds'],['echap','Échappement'],['aero','Aérodynamique']];
ui.c3sel=null;
function envCube(){
  // ciel de studio pour les reflets de la peinture
  const T=THREE,mk=(top,bot,hor)=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,64);gr.addColorStop(0,top);gr.addColorStop(.5,hor);gr.addColorStop(1,bot);g.fillStyle=gr;g.fillRect(0,0,64,64);g.fillStyle='rgba(255,255,255,.9)';g.fillRect(8,18,48,6);return c;};
  const side=mk('#dfe9f5','#3a4048','#f5f7fa'),top=document.createElement('canvas');top.width=top.height=64;{const g=top.getContext('2d');g.fillStyle='#aeb9c6';g.fillRect(0,0,64,64);g.fillStyle='#ffffff';g.fillRect(20,20,24,24);}
  const bot=document.createElement('canvas');bot.width=bot.height=64;{const g=bot.getContext('2d');g.fillStyle='#2b3036';g.fillRect(0,0,64,64);}
  const t=new T.CubeTexture([side,side,top,bot,side,side]);t.needsUpdate=true;return t;
}

// maillage fin de la caisse : bande (toit, capot, nez, poupe) + flancs découpés en petites cellules
function clipCell(poly,x0,x1,y0,y1){
  const clip=(pts,inside,inter)=>{const out=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],ia=inside(a),ib=inside(b);if(ia) out.push(a);if(ia!==ib) out.push(inter(a,b));}return out;};
  let r=poly;
  r=clip(r,p=>p.x>=x0,(a,b)=>{const t=(x0-a.x)/(b.x-a.x);return {x:x0,y:a.y+t*(b.y-a.y)};});if(r.length<3) return r;
  r=clip(r,p=>p.x<=x1,(a,b)=>{const t=(x1-a.x)/(b.x-a.x);return {x:x1,y:a.y+t*(b.y-a.y)};});if(r.length<3) return r;
  r=clip(r,p=>p.y>=y0,(a,b)=>{const t=(y0-a.y)/(b.y-a.y);return {x:a.x+t*(b.x-a.x),y:y0};});if(r.length<3) return r;
  r=clip(r,p=>p.y<=y1,(a,b)=>{const t=(y1-a.y)/(b.y-a.y);return {x:a.x+t*(b.x-a.x),y:y1};});
  return r;
}
function loftMesh(pts,cx,halfW,fac,mat,K){
  const T=THREE,poly=shapeFrom(pts,cx,0).getPoints(10).map(v=>({x:v.x,y:v.y}));
  if(poly.length>2&&Math.hypot(poly[0].x-poly[poly.length-1].x,poly[0].y-poly[poly.length-1].y)<1) poly.pop();
  let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a.x*b.y-b.x*a.y;}
  if(area<0) poly.reverse();
  const zf=(x,y)=>halfW*fac(x+cx,y);
  // bande : chaque point du contour balayé sur la largeur, avec épaules arrondies
  K=K||14;const pos=[],idx=[],n=poly.length;
  for(let i=0;i<n;i++){const p=poly[i],w=zf(p.x,p.y);for(let k=0;k<=K;k++){const u=-1+2*k/K,e=Math.sign(u)*Math.pow(Math.abs(u),.6);pos.push(p.x,p.y-(1-Math.cos(u*Math.PI/2))*0,u*w*(.94+.06*Math.cos(u*Math.PI/2)));}}
  for(let i=0;i<n;i++){const j=(i+1)%n;for(let k=0;k<K;k++){const a=i*(K+1)+k,b=j*(K+1)+k;idx.push(a,b,a+1,b,b+1,a+1);}}
  const band=new T.BufferGeometry();band.setAttribute('position',new T.Float32BufferAttribute(pos,3));band.setIndex(idx);band.computeVertexNormals();
  // flancs
  const sp=[],xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),dx=110,dy=55;
  for(let x=x0;x<x1;x+=dx) for(let y=y0;y<y1;y+=dy){const c=clipCell(poly,x,x+dx,y,y+dy);if(c.length<3) continue;
    const tri=T.ShapeUtils.triangulateShape(c.map(q=>new T.Vector2(q.x,q.y)),[]);
    for(const t of tri) for(const sd of [1,-1]){const o=sd>0?t:[t[0],t[2],t[1]];for(const ii of o){const q=c[ii];sp.push(q.x,q.y,sd*zf(q.x,q.y)*.94);}}}
  const side=new T.BufferGeometry();side.setAttribute('position',new T.Float32BufferAttribute(sp,3));side.computeVertexNormals();
  const g=new T.Group();g.add(new T.Mesh(band,mat));g.add(new T.Mesh(side,mat));return g;
}
function buildCar3D(){
  const T=THREE,d=carDims(),{B,ol,R,tw,track,L,s0,bodyW}=d,H=d.H,fx=B.FO,rx=B.FO+B.WB,cx=L/2;
  if(C3.root){C3.scene.remove(C3.root);C3.root.traverse(o=>{if(o.geometry) o.geometry.dispose();});}
  if(!C3.env){C3.env=envCube();C3.scene.environment=C3.env;}
  const root=new T.Group();C3.root=root;C3.scene.add(root);C3.parts={};
  const tag=(m,p)=>{m.userData.part=p;(C3.parts[p]=C3.parts[p]||[]).push(m);root.add(m);return m;};
  const col=new T.Color(S.paint).convertSRGBToLinear();
  const paint=new T.MeshPhysicalMaterial({color:col,metalness:.35,roughness:.38,clearcoat:.8,clearcoatRoughness:.12,envMapIntensity:.7});
  const glass=new T.MeshPhysicalMaterial({color:0x0e1824,metalness:.2,roughness:.04,clearcoat:1,transparent:true,opacity:.9,envMapIntensity:1.2});
  const dark=new T.MeshStandardMaterial({color:0x15171a,roughness:.75,metalness:.1});
  const plastic=new T.MeshStandardMaterial({color:0x22252a,roughness:.55});
  const chrome=new T.MeshStandardMaterial({color:0xf1f4f8,metalness:1,roughness:.08,envMapIntensity:1.4});
  const rubber=new T.MeshStandardMaterial({color:0x1d1f22,roughness:.92});
  const alloy=new T.MeshStandardMaterial({color:0xc9ced6,metalness:.85,roughness:.28});
  const steelW=new T.MeshStandardMaterial({color:0x2c2f34,metalness:.5,roughness:.5});
  const disc=new T.MeshStandardMaterial({color:S.brakeF==='ccm'?0x3a3a3a:0x8d9196,metalness:.8,roughness:.45});
  const caliper=new T.MeshStandardMaterial({color:S.brakeF==='ccm'?0xf0c419:0xb3221d,roughness:.4});
  const lampM=new T.MeshPhysicalMaterial({color:0xffffff,emissive:0xfff1c8,emissiveIntensity:.7,roughness:.05,clearcoat:1});
  const lensM=new T.MeshPhysicalMaterial({color:0xcfe3ff,metalness:.1,roughness:.05,transparent:true,opacity:.55,clearcoat:1});
  const tailM=new T.MeshStandardMaterial({color:0xa5161a,emissive:0x5a0606,emissiveIntensity:.8,roughness:.25});
  const plateM=new T.MeshStandardMaterial({color:0xf4f6f8,roughness:.6});
  const bw=bodyW/2,belt=d.belt,old=oldStyle(),aR=R+({hippo:110,classique:80}[S.style]||45);
  // profil avec passages de roue découpés
  const body=ol.body.map(p=>p.slice()),arch=[];
  for(const wx of [rx,fx]){arch.push([wx+aR,s0,0]);for(let i=0;i<=12;i++){const a=i/12*Math.PI;arch.push([wx+Math.cos(a)*aR,R+Math.sin(a)*(aR)*.92,0]);}arch.push([wx-aR,s0,0]);}
  const iTail=body.length-1;body.splice(iTail+1,0,...arch.filter(p=>p[1]>=s0-1||true));
  const fac=(x,y)=>{let f=1;if(y>belt) f*=1-.24*clamp((y-belt)/(H-belt),0,1);const e=Math.min(x,L-x),pr={hippo:.12,classique:.15,profile:.35,ponton:.25,ailerons:.22,tendu:.18,aero:.32,bio:.4,moderne:.25}[S.style]||.25;f*=1-pr*Math.pow(clamp(1-e/700,0,1),2);if(y<s0+120) f*=1-.05*clamp((s0+120-y)/120,0,1);return f;};
  const shapeV=(geo,k)=>{const p=geo.attributes.position;for(let i=0;i<p.count;i++){p.setZ(i,p.getZ(i)*fac(p.getX(i)+cx,p.getY(i))*k);}p.needsUpdate=true;geo.computeVertexNormals();};
  const ext=(pts,depth,mat,k,part)=>tag(loftMesh(pts,cx,depth/2*(k||1),fac,mat),part);
  const halfW=bodyW/2*.94,zAt=(x,y)=>halfW*fac(x,y);
  ext(body,bodyW,paint,1,'caisse');
  if(ol.glass){const gm=ext(ol.glass,bodyW,glass,1.015,'vitrage');gm.traverse(o=>{o.renderOrder=1;});}
  else ext(ol.ws,bodyW*.8,glass,1,'vitrage');
  // intérieur des passages de roue
  for(const wx of [fx,rx]) for(const sz of [-1,1]){const g=new T.CylinderGeometry(aR-4,aR-4,tw+60,24,1,true,Math.PI/2,Math.PI);const m=new T.Mesh(g,dark);m.material=dark;m.rotation.x=Math.PI/2;m.position.set(wx-cx,R,sz*(track/2));m.material.side=T.DoubleSide;tag(m,'caisse');}
  // lignes de portes, poignées, joncs
  if(ol.glass&&!old){const g0=ol.glass[0][0],g3=ol.glass[3][0];const px=B.pill.map(t=>lerp(g0,g3,t)),cuts=[Math.max(fx+aR+30,g0-60),...px.slice(0,B.kind==='coupe'||B.kind==='super'?1:2)];
    for(const x of cuts) for(const sz of [-1,1]){const yb=s0+40,yt=belt-10,z=zAt(x,(yb+yt)/2)+2;const m=new T.Mesh(new T.BoxGeometry(6,yt-yb,3),dark);m.position.set(x-cx,(yb+yt)/2,sz*z);tag(m,'caisse');
      const h=new T.Mesh(new T.BoxGeometry(120,22,14),S.style==='ailerons'||S.style==='ponton'?chrome:plastic);h.position.set(x-cx-190,yt-70,sz*(zAt(x-190,yt-70)+6));tag(h,'caisse');}}
  if(S.style==='ponton'||S.style==='ailerons') for(const sz of [-1,1]){const y=s0+.55*(d.nY-s0),m=new T.Mesh(new T.BoxGeometry(L-700,18,8),chrome);m.position.set(0,y,sz*(zAt(L/2,y)+4));tag(m,'caisse');}
  // roues : pneu, jante à branches, disque et étrier
  const wheel=(x,z,front)=>{const g=new T.Group(),side=Math.sign(z);
    const tire=new T.Mesh(new T.CylinderGeometry(R,R,tw*.86,48),rubber);tire.rotation.x=Math.PI/2;g.add(tire);
    for(const s of [-1,1]){const tor=new T.Mesh(new T.TorusGeometry(R-tw*.12,tw*.14,10,48),rubber);tor.position.z=s*tw*.42;g.add(tor);}
    const rimR=Math.min(S.rim*12.7,R-40),mat=S.rimType==='steel'?steelW:alloy;
    const barrel=new T.Mesh(new T.CylinderGeometry(rimR,rimR,tw*.7,36,1,true),mat);barrel.rotation.x=Math.PI/2;barrel.material.side=T.DoubleSide;g.add(barrel);
    const face=new T.Group();face.position.z=side*tw*.33;g.add(face);
    const lip=new T.Mesh(new T.TorusGeometry(rimR,14,8,40),mat);face.add(lip);
    if(S.rimType==='steel'){const dsk=new T.Mesh(new T.CircleGeometry(rimR*.95,32),steelW);dsk.rotation.y=side>0?0:Math.PI;face.add(dsk);const cap=new T.Mesh(new T.CircleGeometry(rimR*.35,24),chrome);cap.position.z=side*4;cap.rotation.y=side>0?0:Math.PI;face.add(cap);}
    else{const n=S.rimType==='forged'?10:5;for(let i=0;i<n;i++){const sp=new T.Mesh(new T.BoxGeometry(rimR*.95,S.rimType==='forged'?22:48,18),alloy);const a=i/n*Math.PI*2;sp.position.set(Math.cos(a)*rimR*.48,Math.sin(a)*rimR*.48,0);sp.rotation.z=a;face.add(sp);}
      const hub=new T.Mesh(new T.CylinderGeometry(rimR*.2,rimR*.2,30,20),alloy);hub.rotation.x=Math.PI/2;face.add(hub);
      const dr=Math.min(rimR-30,(front?S.brakeFd:S.brakeRd)/2),bt=front?S.brakeF:S.brakeR;
      if(bt!=='drum'){const dk=new T.Mesh(new T.CylinderGeometry(dr,dr,24,32),disc);dk.rotation.x=Math.PI/2;dk.position.z=-side*30;g.add(dk);const cl=new T.Mesh(new T.BoxGeometry(70,dr*.7,60),caliper);cl.position.set(-dr*.62,dr*.4,-side*20);cl.rotation.z=.6;g.add(cl);}}
    g.position.set(x-cx,R,z);tag(g,'roues');};
  for(const x of [fx,rx]) for(const sz of [-1,1]) wheel(x,sz*track/2,x===fx);
  // ailes séparées et marchepieds
  if(old){const fm=S.style==='hippo'?dark:paint;
    for(const x of [fx,rx]) for(const sz of [-1,1]){const f=new T.Mesh(new T.CylinderGeometry(R+90,R+90,tw+110,32,1,true,-Math.PI/2,Math.PI),fm);f.material.side=T.DoubleSide;f.rotation.x=Math.PI/2;f.position.set(x-cx,R,sz*track/2);tag(f,'ailes');}
    for(const sz of [-1,1]){const rb=new T.Mesh(new T.BoxGeometry(rx-fx-2*R-160,30,tw+40),dark);rb.position.set((fx+rx)/2-cx,s0+10,sz*track/2);tag(rb,'ailes');}}
  // calandre
  if(old){const rad=new T.Mesh(new T.BoxGeometry(60,d.nY-s0-40,bw*.8),chrome);rad.position.set(-cx-10,(d.nY+s0)/2,0);tag(rad,'calandre');for(let i=-3;i<=3;i++){const b=new T.Mesh(new T.BoxGeometry(70,d.nY-s0-80,10),dark);b.position.set(-cx-14,(d.nY+s0)/2,i*bw*.1);tag(b,'calandre');}}
  else{const gh=Math.max(90,(d.nY-s0)*.38),gr=new T.Mesh(new T.BoxGeometry(30,gh,bw*(S.style==='moderne'?1.1:.9)),S.style==='ailerons'||S.style==='ponton'?chrome:plastic);gr.position.set(-cx+8,s0+(d.nY-s0)*.42,0);tag(gr,'calandre');
    for(let i=0;i<4;i++){const sl=new T.Mesh(new T.BoxGeometry(34,8,bw*.86),dark);sl.position.set(-cx+6,s0+(d.nY-s0)*.42-gh*.35+i*gh*.24,0);tag(sl,'calandre');}}
  // pare-chocs
  const by=s0+.32*(d.nY-s0),bty=s0+.32*(d.tY-s0);
  const bmat={chrome,massif:chrome,caout:rubber,carbone:dark,bouclier:paint}[S.bumper];
  if(bmat){const h=S.bumper==='massif'||S.bumper==='caout'?100:S.bumper==='bouclier'?150:55,w=old?(track+tw)*.98:2*zAt(120,by)*1.01;
    for(const [x,y,sgn] of [[-26,by,-1],[L+26,bty,1]]){const sh=new T.Shape();const hw=w/2,r=Math.min(h/2,60);sh.moveTo(-hw+r,-h/2);sh.lineTo(hw-r,-h/2);sh.quadraticCurveTo(hw,-h/2,hw,-h/2+r);sh.lineTo(hw,h/2-r);sh.quadraticCurveTo(hw,h/2,hw-r,h/2);sh.lineTo(-hw+r,h/2);sh.quadraticCurveTo(-hw,h/2,-hw,h/2-r);sh.lineTo(-hw,-h/2+r);sh.quadraticCurveTo(-hw,-h/2,-hw+r,-h/2);
      const g=new T.ExtrudeGeometry(sh,{depth:60,bevelEnabled:true,bevelThickness:18,bevelSize:14,bevelSegments:3});g.translate(0,0,-30);const m=new T.Mesh(g,bmat);m.rotation.y=Math.PI/2;m.position.set(x-cx-sgn*10,y,0);tag(m,'parechocs');
      if(S.bumper==='massif') for(const s of [-1,1]){const o=new T.Mesh(new T.CylinderGeometry(28,28,h*2.2,14),chrome);o.position.set(x-cx+sgn*20,y+h*.2,s*w*.22);tag(o,'parechocs');}}}
  // plaques et échappement
  {const p1=new T.Mesh(new T.BoxGeometry(8,110,520),plateM);p1.position.set(-cx-40,by+(S.bumper==='bouclier'?0:90),0);tag(p1,'caisse');const p2=p1.clone();p2.position.set(L-cx+40,bty+150,0);tag(p2,'caisse');}
  for(const sz of (E3dual()?[-1,1]:[-1])){const ex=new T.Mesh(new T.CylinderGeometry(38,38,140,16),chrome);ex.rotation.z=Math.PI/2;ex.position.set(L-cx-10,s0+40,sz*bw*.5);tag(ex,'echap');const inn=new T.Mesh(new T.CircleGeometry(30,16),dark);inn.rotation.y=Math.PI/2;inn.position.set(L-cx+61,s0+40,sz*bw*.5);tag(inn,'echap');}
  // phares
  const lt=S.lights;
  for(const sz of [-1,1]){
    if(lt==='acet'||lt==='elec'){const r=lt==='acet'?70:90,l=new T.Mesh(new T.CylinderGeometry(r,r*.8,140,24),lt==='acet'?new T.MeshStandardMaterial({color:0xb38a3c,metalness:.9,roughness:.25}):chrome);l.rotation.z=Math.PI/2;l.position.set(120-cx,(old?d.nY+r+20:d.nY+r),sz*bw*.62);tag(l,'phares');const g=new T.Mesh(new T.CircleGeometry(r*.85,24),lampM);g.rotation.y=-Math.PI/2;g.position.set(120-cx-71,l.position.y,l.position.z);tag(g,'phares');}
    else if(lt==='rond'){const l=new T.Mesh(new T.SphereGeometry(85,20,14,0,Math.PI*2,0,Math.PI/2),lampM);l.rotation.z=Math.PI/2;l.position.set(40-cx,d.nY-80,sz*(bw-150));tag(l,'phares');const ring=new T.Mesh(new T.TorusGeometry(85,12,8,24),chrome);ring.rotation.y=Math.PI/2;ring.position.copy(l.position);tag(ring,'phares');}
    else if(lt==='escam'){const l=new T.Mesh(new T.BoxGeometry(220,24,260),paint);l.position.set(220-cx,d.nY+6,sz*(bw-200));tag(l,'phares');const s=new T.Mesh(new T.BoxGeometry(222,4,262),dark);s.position.set(220-cx,d.nY+19,sz*(bw-200));tag(s,'phares');}
    else{const wl=lt==='halo'?95:lt==='xenon'?80:55,ln=lt==='halo'?260:330;
      const hs=new T.Mesh(new T.BoxGeometry(70,wl,ln),dark);hs.position.set(26-cx,d.nY-45,sz*(bw-ln/2-70));tag(hs,'phares');
      const lens=new T.Mesh(new T.BoxGeometry(74,wl-8,ln-10),lensM);lens.position.copy(hs.position);lens.position.x-=3;tag(lens,'phares');
      const nb=lt==='halo'?1:2;for(let i=0;i<nb;i++){const pr=new T.Mesh(new T.CylinderGeometry(wl*.32,wl*.32,10,16),lampM);pr.rotation.z=Math.PI/2;pr.position.set(hs.position.x-34,hs.position.y,hs.position.z+(i-(nb-1)/2)*ln*.4);tag(pr,'phares');}
      if(lt==='led'||lt==='laser'){const drl=new T.Mesh(new T.BoxGeometry(76,10,ln*.9),new T.MeshStandardMaterial({color:lt==='laser'?0x8fd0ff:0xffffff,emissive:lt==='laser'?0x4aa8ff:0xffffff,emissiveIntensity:1.2}));drl.position.set(hs.position.x-4,hs.position.y-wl/2+6,hs.position.z);tag(drl,'phares');}}
    const t=new T.Mesh(new T.BoxGeometry(50,old?90:110,old?100:S.style==='moderne'?420:320),tailM);t.position.set(L-12-cx,d.tY-70,sz*(bw-(old?150:S.style==='moderne'?230:200)));tag(t,'feux');
  }
  // rétroviseurs
  if(S.mirrors!=='none'){const mm=S.mirrors==='elec'?paint:S.mirrors==='camera'?dark:chrome;for(const sz of [-1,1]){const mx=S.mirrors==='aile'?fx+60:(ol.glass?ol.glass[0][0]:ol.cowlX)+30,my=S.mirrors==='aile'?d.nY+100:belt+60;
    const stem=new T.Mesh(new T.BoxGeometry(40,20,90),dark);stem.position.set(mx-cx,my-30,sz*(zAt(mx,my)+30));tag(stem,'retros');
    const m=new T.Mesh(S.mirrors==='aile'?new T.SphereGeometry(40,14,10):new T.BoxGeometry(80,S.mirrors==='camera'?40:90,150),mm);m.position.set(mx-cx,my,sz*(zAt(mx,my)+(S.mirrors==='aile'?20:95)));tag(m,'retros');}}
  // ailerons, aileron et aéro
  if(S.style==='ailerons') for(const sz of [-1,1]){const sh=new T.Shape();sh.moveTo(0,0);sh.lineTo(700,0);sh.lineTo(720,190);sh.lineTo(600,170);sh.lineTo(0,10);const g=new T.ExtrudeGeometry(sh,{depth:40,bevelEnabled:true,bevelThickness:6,bevelSize:6});const f=new T.Mesh(g,paint);f.position.set(L-740-cx,d.tY-5,sz*bw*.86-20);tag(f,'aero');}
  if(S.wing==='wing'){const w=new T.Mesh(new T.BoxGeometry(260,25,bodyW*.9),dark);w.position.set(L-220-cx,d.tY+220,0);tag(w,'aero');for(const sz of [-1,1]){const p=new T.Mesh(new T.BoxGeometry(40,220,30),dark);p.position.set(L-220-cx,d.tY+110,sz*bodyW*.3);tag(p,'aero');}}
  if(S.wing==='lip'){const w=new T.Mesh(new T.BoxGeometry(200,20,bodyW*.8),paint);w.position.set(L-120-cx,d.tY+12,0);tag(w,'aero');}
  if(S.splitter){const sp=new T.Mesh(new T.BoxGeometry(160,14,bodyW*.9),dark);sp.position.set(-cx+30,s0-10,0);tag(sp,'aero');}
  // sol
  const sh=new T.Mesh(new T.CircleGeometry(1,48),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28}));sh.scale.set(L*.6,bodyW*.78,1);sh.rotation.x=-Math.PI/2;sh.position.y=2;root.add(sh);
  C3.size=Math.max(L,bodyW,H);C3.sig=car3dSig();
  applyC3Sel();
}
function E3dual(){return M.E&&(M.E.n>=6||M.E.peakP>250);}
function applyC3Sel(){
  if(!C3||!C3.parts) return;
  const hl=C3.hl||(C3.hl=new THREE.MeshStandardMaterial({color:0xffb800,emissive:0xff9500,emissiveIntensity:.55,roughness:.4}));
  for(const [k,arr] of Object.entries(C3.parts)) for(const m of arr) m.traverse(o=>{if(!o.isMesh) return;if(o.userData.m0===undefined) o.userData.m0=o.material;o.material=ui.c3sel===k?hl:o.userData.m0;});
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
  if(v==='3d'){body=`<div class="car3d-w"><canvas id="car3d" role="img" aria-label="Vue 3D de la voiture, à faire tourner"></canvas></div><div class="c3-parts" role="group" aria-label="Repérer un élément">${C3PARTS.map(([k,n])=>`<button type="button" class="chip-btn" data-c3p="${k}" aria-pressed="${ui.c3sel===k}">${n}</button>`).join('')}</div>`;cap+=' · faites glisser pour tourner, molette ou pincement pour zoomer';}
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
$('#stage').addEventListener('click',e=>{const p=e.target.closest('[data-c3p]');if(p){ui.c3sel=ui.c3sel===p.dataset.c3p?null:p.dataset.c3p;for(const x of $$('[data-c3p]')) x.setAttribute('aria-pressed',x.dataset.c3p===ui.c3sel);applyC3Sel();drawCar3D();return;}const b=e.target.closest('[data-cv]');if(!b) return;ui.cview=b.dataset.cv;renderBodyStage($('#stageDraw'));});
