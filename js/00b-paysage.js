'use strict';
/* ───────────── Téléphone : tout le jeu en paysage ─────────────
   Un téléphone tenu en portrait (ou dont la rotation est verrouillée) affiche le jeu pivoté d'un quart de tour :
   il suffit de le tourner à l'horizontale. Si l'écran est réellement en paysage, rien n'est pivoté.
   Sur Android, au premier appui, le jeu passe en plein écran et demande le paysage. */
const LAND={on:false,wrap:null,scroll:null,obs:null};
const isPhone=()=>Math.min(innerWidth,innerHeight)<560&&matchMedia('(pointer:coarse)').matches;
// coordonnées d'un événement dans le repère de l'interface (et non de l'écran)
function pXY(e){return LAND.on?{x:e.clientY,y:innerWidth-e.clientX}:{x:e.clientX,y:e.clientY};}
// position d'un événement dans un élément, et taille de l'élément, dans le repère de l'interface
function elXY(e,el){const r=el.getBoundingClientRect();return LAND.on?{x:e.clientY-r.top,y:r.right-e.clientX,w:r.height,h:r.width}:{x:e.clientX-r.left,y:e.clientY-r.top,w:r.width,h:r.height};}
// largeur et hauteur affichées d'un élément (y compris SVG), dans le repère de l'interface
function boxW(el){const r=el.getBoundingClientRect();return LAND.on?r.height:r.width;}
function boxH(el){const r=el.getBoundingClientRect();return LAND.on?r.width:r.height;}
function appScrollTop(){if(LAND.on) LAND.scroll.scrollTo({top:0});else window.scrollTo({top:0});}
function landFit(){
  const want=isPhone()&&innerHeight>innerWidth,de=document.documentElement;
  if(want&&!LAND.on){
    const w=el('div','land'),sc=el('div','land-scroll');w.id='land';sc.id='landScroll';w.appendChild(sc);
    for(const n of [...document.body.childNodes]){if(n.nodeType===1&&n.tagName==='SCRIPT') continue;if(n.nodeType===1&&n.classList.contains('app')) sc.appendChild(n);else w.appendChild(n);}
    document.body.appendChild(w);LAND.wrap=w;LAND.scroll=sc;LAND.on=true;de.classList.add('land-rot');
    // tout ce qui est ajouté plus tard au corps de page (journal, atelier…) va dans le cadre pivoté
    LAND.obs=new MutationObserver(ms=>{for(const m of ms) for(const n of m.addedNodes) if(n!==LAND.wrap&&n.nodeType===1&&n.tagName!=='SCRIPT'&&n.parentNode===document.body) LAND.wrap.appendChild(n);});
    LAND.obs.observe(document.body,{childList:true});
  }else if(!want&&LAND.on){
    LAND.obs.disconnect();const app=LAND.scroll.querySelector('.app');
    for(const n of [...LAND.wrap.childNodes]) if(n!==LAND.scroll) document.body.appendChild(n);
    if(app) document.body.insertBefore(app,document.body.firstChild);
    LAND.wrap.remove();LAND.on=false;de.classList.remove('land-rot');
  }
  if(LAND.on){const W=innerWidth,H=innerHeight;LAND.wrap.style.width=H+'px';LAND.wrap.style.height=W+'px';LAND.wrap.style.transform=`translateX(${W}px) rotate(90deg)`;}
  de.classList.toggle('phone-land',isPhone()&&(LAND.on||innerWidth>innerHeight));
}
landFit();
let landT=0;const landRe=()=>{clearTimeout(landT);landT=setTimeout(()=>{const was=LAND.on;landFit();if(was!==LAND.on){window.dispatchEvent(new Event('resize'));if(typeof render==='function'&&typeof M!=='undefined'&&M.E) try{render();}catch(e){}}},120);};
window.addEventListener('resize',landRe);window.addEventListener('orientationchange',landRe);
// Android : plein écran et paysage au premier appui
document.addEventListener('pointerdown',function landLock(){
  document.removeEventListener('pointerdown',landLock,true);
  if(!isPhone()||innerWidth>innerHeight) return;
  try{const de=document.documentElement,r=de.requestFullscreen&&de.requestFullscreen({navigationUI:'hide'});if(r&&r.then) r.then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape')).catch(()=>{});}catch(e){}
},true);
// ── défilement au doigt dans l'interface pivotée : le navigateur ne sait pas défiler un cadre tourné,
//    on traduit donc le glissé du doigt dans le repère de l'interface (avec inertie).
(function(){
  let t=null,anim=0;
  const scrollable=(el,ax)=>{for(;el&&el!==document.documentElement;el=el.parentElement){const cs=getComputedStyle(el),ov=ax==='y'?cs.overflowY:cs.overflowX;if((ov==='auto'||ov==='scroll')&&(ax==='y'?el.scrollHeight>el.clientHeight+1:el.scrollWidth>el.clientWidth+1)) return el;if(el===LAND.wrap) break;}return ax==='y'?LAND.scroll:null;};
  const skip=e=>e.target.closest&&e.target.closest('input[type=range],.atl,select,textarea,input[type=text]');
  document.addEventListener('touchstart',e=>{
    cancelAnimationFrame(anim);
    if(!LAND.on||e.touches.length!==1||skip(e)){t=null;return;}
    const p=e.touches[0];t={cv:e.target.tagName==='CANVAS',x0:p.clientX,y0:p.clientY,tg:e.target,ax:null,el:null,s0:0,moved:false,hist:[[performance.now(),p.clientX,p.clientY]]};
  },{passive:true,capture:true});
  document.addEventListener('touchmove',e=>{
    if(!t||!LAND.on) return;const p=e.touches[0],dxL=p.clientY-t.y0,dyL=-(p.clientX-t.x0);
    if(!t.ax){if(Math.hypot(dxL,dyL)<7) return;t.ax=Math.abs(dyL)>=Math.abs(dxL)?'y':'x';if(t.cv&&t.ax==='x'){t=null;return;}if(t.cv) LAND.pan=true;t.el=scrollable(t.tg,t.ax)||(t.ax==='x'?scrollable(t.tg,'y'):null);if(t.el&&t.ax==='x'&&!(t.el.scrollWidth>t.el.clientWidth+1)) t.ax='y';if(!t.el){t=null;return;}t.s0=t.ax==='y'?t.el.scrollTop:t.el.scrollLeft;t.moved=true;}
    e.preventDefault();
    if(t.ax==='y') t.el.scrollTop=t.s0-dyL;else t.el.scrollLeft=t.s0-dxL;
    t.hist.push([performance.now(),p.clientX,p.clientY]);if(t.hist.length>6) t.hist.shift();
  },{passive:false,capture:true});
  document.addEventListener('touchend',()=>{
    LAND.pan=false;if(!t) return;const tt=t;t=null;if(!tt.moved) return;
    // empêche le « clic » de fin de glissé
    const kill=ev=>{ev.stopPropagation();ev.preventDefault();};document.addEventListener('click',kill,true);setTimeout(()=>document.removeEventListener('click',kill,true),60);
    const h=tt.hist,a=h[0],b=h[h.length-1],dt=Math.max(16,b[0]-a[0]);
    let v=tt.ax==='y'?(b[1]-a[1])/dt:-(b[2]-a[2])/dt;        // px/ms dans le sens du défilement
    if(Math.abs(v)<.05) return;let last=performance.now();
    const step=now=>{const d=now-last;last=now;if(tt.ax==='y') tt.el.scrollTop+=v*d;else tt.el.scrollLeft+=v*d;v*=Math.pow(.95,d/16);if(Math.abs(v)>.02) anim=requestAnimationFrame(step);};
    anim=requestAnimationFrame(step);
  },{capture:true});
})();
// ── curseurs au doigt dans l'interface pivotée : valeur calculée dans le repère de l'interface
(function(){
  let rg=null;
  const setV=(e,fire)=>{const p=e.touches[0]||e.changedTouches[0],q=elXY({clientX:p.clientX,clientY:p.clientY},rg),mn=+rg.min||0,mx=+rg.max||100,st=+rg.step||1,th=14;
    const f=clamp((q.x-th/2)/Math.max(1,q.w-th),0,1);let v=mn+f*(mx-mn);v=Math.round((v-mn)/st)*st+mn;v=+v.toFixed(6);
    if(+rg.value!==v){rg.value=v;rg.dispatchEvent(new Event('input',{bubbles:true}));}if(fire) rg.dispatchEvent(new Event('change',{bubbles:true}));};
  document.addEventListener('touchstart',e=>{if(!LAND.on) return;const r=e.target.closest&&e.target.closest('input[type=range]');if(!r||r.disabled) return;rg=r;e.preventDefault();setV(e);},{passive:false,capture:true});
  document.addEventListener('touchmove',e=>{if(!rg) return;e.preventDefault();setV(e);},{passive:false,capture:true});
  document.addEventListener('touchend',e=>{if(!rg) return;setV(e,true);rg=null;},{capture:true});
})();
