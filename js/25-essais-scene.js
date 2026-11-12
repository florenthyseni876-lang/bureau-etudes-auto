'use strict';
/* ───────────── Piste d'essai : décors et points de vue ─────────────
   Un canvas dessine le décor en parallaxe (vue de côté) ou en perspective (poursuite, cockpit, hélicoptère).
   La voiture reste le dessin vectoriel du bureau d'études. */
ui.scene='campagne';ui.camv='cote';
const SCENES=[['campagne','Campagne'],['ville','Ville'],['circuit','Circuit'],['montagne','Montagne'],['nuit','Autoroute de nuit']];
const CAMS=[['cote','Côté'],['poursuite','Poursuite'],['cockpit','Cockpit'],['helico','Hélicoptère']];
const SC={
  campagne:{sky:['#9cc8ef','#e6f1fb'],far:'#8fa9c4',mid:'#6f9a55',ground:'#7cab5c',road:'#4a4e55',line:'#f5f5f0',side:'#c9b98f'},
  ville:{sky:['#a9bccf','#e8eef3'],far:'#9aa7b6',mid:'#6d7887',ground:'#9a9fa6',road:'#3e4248',line:'#f5f5f0',side:'#b9bcc1'},
  circuit:{sky:['#7fb2e6','#dfeefc'],far:'#a7b9cc',mid:'#5d8a4a',ground:'#6fa152',road:'#3a3d42',line:'#ffffff',side:'#d23a2e'},
  montagne:{sky:['#7aa6d6','#e9f2fb'],far:'#8798ad',mid:'#3f6b4b',ground:'#6b8f5a',road:'#4b4d52',line:'#f5f5f0',side:'#9a9488'},
  nuit:{sky:['#060b18','#1a2540'],far:'#111a2c',mid:'#0d1424',ground:'#0f1520',road:'#1f2329',line:'#e9e3c4',side:'#2a2f38'},
};
// bruit déterministe pour placer les éléments du décor
const hsh=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function sceneHTML(pxw){
  const opts=(arr,cur,key)=>arr.map(([k,n])=>`<button type="button" role="radio" data-${key}="${k}" aria-checked="${cur===k}">${n}</button>`).join('');
  return `<div class="scene-tools"><div class="seg" role="radiogroup" aria-label="Décor">${opts(SCENES,ui.scene,'scn')}</div><div class="seg" role="radiogroup" aria-label="Point de vue">${opts(CAMS,ui.camv,'camv')}</div></div>
   <div class="road scene cam-${ui.camv}" id="road"><canvas id="sceneCv" aria-hidden="true"></canvas><div class="scene-car" id="sceneCar">${sceneCarSVG(pxw)}</div></div>`;
}
const stripDims=s=>s.replace(/<path[^>]*class="c-dim"[^>]*\/>/g,'').replace(/<text[^>]*class="c-dimt"[^>]*>[^<]*<\/text>/g,'').replace(/<line[^>]*class="c-ground"[^>]*\/>/g,'');
function sceneCarSVG(pxw){
  if(ui.camv==='poursuite') return stripDims(frontSVG(true,pxw));
  if(ui.camv==='helico') return stripDims(topSVG(pxw));
  if(ui.camv==='cockpit') return '';
  return carSVG({cut:false,dims:false,pxw,id:'r'});
}
let SCN={x:0,v:0,rpm:0,t:0};
function sceneDraw(x,v,rpm){
  const cv=$('#sceneCv');if(!cv) return;
  SCN={x:x||0,v:v||0,rpm:rpm||(M.E?M.E.idle:800),t:performance.now()/1000};
  const r=cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),W=Math.round(r.width),H=Math.round(r.height);
  if(!W||!H) return;
  if(cv.width!==W*dpr||cv.height!==H*dpr){cv.width=W*dpr;cv.height=H*dpr;}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
  const P=SC[ui.scene]||SC.campagne;
  if(ui.camv==='helico') drawTop(g,W,H,P);
  else if(ui.camv==='cote') drawSide(g,W,H,P);
  else drawPersp(g,W,H,P,ui.camv==='cockpit');
}
function skyGrad(g,W,H,y,P){const gr=g.createLinearGradient(0,0,0,y);gr.addColorStop(0,P.sky[0]);gr.addColorStop(1,P.sky[1]);g.fillStyle=gr;g.fillRect(0,0,W,y);
  if(ui.scene==='nuit'){g.fillStyle='rgba(255,255,255,.8)';for(let i=0;i<60;i++){g.fillRect(hsh(i)*W,hsh(i+99)*y*.8,1.2,1.2);}g.fillStyle='#f3efd9';g.beginPath();g.arc(W*.82,y*.25,12,0,7);g.fill();}
  else{g.fillStyle='rgba(255,247,214,.9)';g.beginPath();g.arc(W*.85,y*.28,16,0,7);g.fill();}}
// silhouettes lointaines selon le décor
function farLayer(g,W,base,off,P,scale){
  g.fillStyle=P.far;g.beginPath();g.moveTo(0,base);
  const per=ui.scene==='ville'?60:180;
  for(let px=-per;px<=W+per;px+=ui.scene==='ville'?30:20){
    const k=Math.floor((px+off)/per*(ui.scene==='ville'?2:1));
    let h;
    if(ui.scene==='montagne') h=(60+70*hsh(k)+30*Math.sin((px+off)*.02))*scale;
    else if(ui.scene==='ville') h=(30+70*hsh(k))*scale;
    else h=(18+22*Math.sin((px+off)*.012)+10*hsh(k))*scale;
    if(ui.scene==='ville'){g.lineTo(px,base-h);g.lineTo(px+30,base-h);}else g.lineTo(px,base-h);
  }
  g.lineTo(W,base);g.closePath();g.fill();
  if(ui.scene==='montagne'){g.fillStyle='rgba(255,255,255,.75)';for(let px=-200;px<W+200;px+=180){const k=Math.floor((px+off)/180),xx=px-((off)%180),h=(60+70*hsh(k))*scale;g.beginPath();g.moveTo(xx-14,base-h+18);g.lineTo(xx,base-h);g.lineTo(xx+14,base-h+18);g.fill();}}
  if(ui.scene==='nuit'||ui.scene==='ville'){g.fillStyle=ui.scene==='nuit'?'rgba(255,214,120,.85)':'rgba(255,255,255,.35)';for(let px=0;px<W;px+=9){const k=Math.floor((px+off)/9);if(hsh(k)>.72) g.fillRect(px-(off%9),base-6-hsh(k+7)*40*scale,2.5,3);}}
}
function tree(g,x,y,s,P){g.fillStyle='#5b4632';g.fillRect(x-1.5*s,y-10*s,3*s,10*s);g.fillStyle=ui.scene==='montagne'?'#2f5a3f':'#4f7f3c';
  if(ui.scene==='montagne'){g.beginPath();g.moveTo(x-9*s,y-8*s);g.lineTo(x,y-34*s);g.lineTo(x+9*s,y-8*s);g.fill();}else{g.beginPath();g.arc(x,y-18*s,10*s,0,7);g.fill();}}
function drawSide(g,W,H,P){
  const road=$('#road'),car=$('#sceneCar svg'),ppm=car?car.getBoundingClientRect().width/(car.viewBox.baseVal.width/1000):30;
  const gy=H-26,x=SCN.x*ppm;
  skyGrad(g,W,H,gy-30,P);
  farLayer(g,W,gy-30,x*.05,P,1);
  // couche intermédiaire
  g.fillStyle=P.mid;g.fillRect(0,gy-34,W,10);
  const per=ui.scene==='ville'?110:ui.scene==='circuit'?160:90,o2=x*.35;
  for(let px=-per;px<W+per;px+=per){const k=Math.floor((px+o2)/per),xx=px-(o2%per)+hsh(k)*40;
    if(ui.scene==='ville'){const h=40+50*hsh(k+3),w=50+30*hsh(k+5);g.fillStyle=['#8a94a3','#7a8494','#9aa2ad'][k%3];g.fillRect(xx,gy-34-h,w,h);g.fillStyle='rgba(255,255,255,.35)';for(let wy=gy-30-h;wy<gy-40;wy+=10) for(let wx=xx+6;wx<xx+w-6;wx+=10) g.fillRect(wx,wy,4,5);}
    else if(ui.scene==='circuit'){g.fillStyle='#d6dbe1';g.fillRect(xx,gy-62,120,26);g.fillStyle='#b23a30';g.fillRect(xx,gy-66,120,6);for(let i=0;i<12;i++){g.fillStyle=['#e9c46a','#2a9d8f','#e76f51'][(i+k)%3];g.fillRect(xx+4+i*9.6,gy-56+((i*7+k)%3)*6,5,5);}}
    else if(ui.scene==='nuit'){}
    else tree(g,xx,gy-28,1.2+.4*hsh(k+1),P);}
  // bas-côté et route
  g.fillStyle=P.ground;g.fillRect(0,gy-24,W,10);
  g.fillStyle=P.road;g.fillRect(0,gy-14,W,40);
  // éléments proches qui défilent à la vitesse réelle
  const sp=ui.scene==='circuit'?8:ui.scene==='ville'?25:ui.scene==='nuit'?30:20,step=sp*ppm,o=x%step;
  for(let px=-o;px<W+step;px+=step){
    if(ui.scene==='circuit'){g.fillStyle='#d23a2e';g.fillRect(px,gy-16,step/2,5);g.fillStyle='#fff';g.fillRect(px+step/2,gy-16,step/2,5);}
    else if(ui.scene==='ville'||ui.scene==='nuit'){g.strokeStyle='#5c636d';g.lineWidth=3;g.beginPath();g.moveTo(px,gy-14);g.lineTo(px,gy-110);g.lineTo(px+18,gy-112);g.stroke();if(ui.scene==='nuit'){const gr=g.createRadialGradient(px+18,gy-108,0,px+18,gy-108,60);gr.addColorStop(0,'rgba(255,200,110,.5)');gr.addColorStop(1,'rgba(255,200,110,0)');g.fillStyle=gr;g.fillRect(px-50,gy-170,140,160);}}
    else{g.fillStyle='#f0f0ea';g.fillRect(px,gy-30,4,16);g.fillStyle='#c33';g.fillRect(px,gy-30,4,3);}
  }
  // glissière ou trottoir
  if(ui.scene!=='circuit'){g.fillStyle=P.side;g.fillRect(0,gy-16,W,3);}
  // marquage au sol
  const dl=12*ppm,dg=8*ppm,od=x%(dl+dg);g.fillStyle=P.line;
  for(let px=-od;px<W;px+=dl+dg) g.fillRect(px,gy+12,dl,3);
  // traînées de vitesse
  if(SCN.v>90&&!reduced()){g.strokeStyle='rgba(255,255,255,'+clamp((SCN.v-90)/250,0,.35)+')';g.lineWidth=1;for(let i=0;i<14;i++){const yy=gy-80+hsh(i)*70,len=20+SCN.v*.3,xx=((hsh(i+5)*W-(x*1.4))%W+W)%W;g.beginPath();g.moveTo(xx,yy);g.lineTo(xx+len,yy);g.stroke();}}
  if(road) road.style.setProperty('--gy',(H-gy)+'px');
}
// perspective (poursuite et cockpit)
function drawPersp(g,W,H,P,cock){
  const hy=H*(cock?.42:.38),cxp=W/2,x=SCN.x;
  skyGrad(g,W,H,hy,P);farLayer(g,W,hy,x*.4,P,.8);
  g.fillStyle=P.ground;g.fillRect(0,hy,W,H-hy);
  const camH=cock?1.2:2.2,f=H*.9,roadW=cock?3.6:3.8;
  const Y=z=>hy+camH*f/z/ (cock?1:1.15),X=(lat,z)=>cxp+lat*f/z*.9;
  // route : bandes de couleur alternées pour la vitesse
  for(let z=60;z>1.2;z-=.6){const z2=z-.6,y1=Y(z),y2=Y(z2),band=Math.floor((z+x)/4)%2;
    g.fillStyle=band?P.road:shade(P.road,8);g.beginPath();g.moveTo(X(-roadW,z),y1);g.lineTo(X(roadW,z),y1);g.lineTo(X(roadW,z2),y2);g.lineTo(X(-roadW,z2),y2);g.fill();
    g.fillStyle=ui.scene==='circuit'?(band?'#d23a2e':'#fff'):P.side;
    for(const s of [-1,1]){g.beginPath();g.moveTo(X(s*roadW,z),y1);g.lineTo(X(s*(roadW+.35),z),y1);g.lineTo(X(s*(roadW+.35),z2),y2);g.lineTo(X(s*roadW,z2),y2);g.fill();}
    if(Math.floor((z+x)/3)%3===0){g.fillStyle=P.line;g.beginPath();g.moveTo(X(-.07,z),y1);g.lineTo(X(.07,z),y1);g.lineTo(X(.07,z2),y2);g.lineTo(X(-.07,z2),y2);g.fill();}
  }
  // objets du bord de route
  const sp=ui.scene==='circuit'?10:ui.scene==='ville'?14:16;
  for(let k=Math.ceil(x/sp+60/sp);k*sp-x>2;k--){const z=k*sp-x;if(z>60) continue;const s=f/z*.02;
    for(const side of [-1,1]){const xx=X(side*(roadW+1.6+hsh(k*3+side)*1.2),z),yy=Y(z);
      if(ui.scene==='ville'||ui.scene==='nuit'){g.fillStyle='#5c636d';g.fillRect(xx-1.5*s,yy-90*s,3*s,90*s);g.fillStyle=ui.scene==='nuit'?'#ffd27a':'#c9cfd6';g.fillRect(xx-6*s,yy-92*s,12*s,4*s);
        if(ui.scene==='ville'&&hsh(k+side)>.4){g.fillStyle='#8a94a3';g.fillRect(xx+side*20*s,yy-160*s,side*90*s,160*s);}}
      else if(ui.scene==='circuit'){g.fillStyle='#d6dbe1';g.fillRect(xx+side*8*s,yy-40*s,side*60*s,40*s);}
      else tree(g,xx+side*10*s,yy,s*2.4,P);}}
  // phares la nuit
  if(ui.scene==='nuit'){const gr=g.createRadialGradient(cxp,H*.8,10,cxp,hy+20,H*.7);gr.addColorStop(0,'rgba(255,240,190,.28)');gr.addColorStop(1,'rgba(255,240,190,0)');g.fillStyle=gr;g.beginPath();g.moveTo(cxp-W*.2,H);g.lineTo(cxp-W*.05,hy+10);g.lineTo(cxp+W*.05,hy+10);g.lineTo(cxp+W*.2,H);g.fill();}
  if(cock) drawDash(g,W,H);
}
function shade(hex,k){const n=parseInt(hex.slice(1),16),c=v=>clamp(v+k,0,255);return `rgb(${c(n>>16)},${c(n>>8&255)},${c(n&255)})`;}
function drawDash(g,W,H){
  const E=M.E,C=M.C,y0=H*.74;
  // capot à la couleur de la voiture
  g.fillStyle=S.paint;g.beginPath();g.moveTo(-W*.05,H);g.quadraticCurveTo(W*.5,y0-H*.34,W*1.05,H);g.fill();
  g.fillStyle='rgba(255,255,255,.16)';g.beginPath();g.moveTo(W*.25,H);g.quadraticCurveTo(W*.5,y0-H*.3,W*.75,H);g.fill();
  // tableau de bord
  g.fillStyle='#15181d';g.beginPath();g.moveTo(0,y0+H*.06);g.quadraticCurveTo(W*.5,y0+H*.02,W,y0+H*.06);g.lineTo(W,H);g.lineTo(0,H);g.fill();
  const gauge=(cx,cy,r,val,max,lab,red)=>{g.fillStyle='#0b0d10';g.beginPath();g.arc(cx,cy,r,0,7);g.fill();g.strokeStyle='#3a4049';g.lineWidth=2;g.stroke();
    const a0=Math.PI*.75,a1=Math.PI*2.25;for(let i=0;i<=10;i++){const a=a0+(a1-a0)*i/10;g.strokeStyle=red&&i/10>red?'#e24b3b':'#cfd6de';g.lineWidth=i%2?1:2;g.beginPath();g.moveTo(cx+Math.cos(a)*r*.78,cy+Math.sin(a)*r*.78);g.lineTo(cx+Math.cos(a)*r*.9,cy+Math.sin(a)*r*.9);g.stroke();}
    const a=a0+(a1-a0)*clamp(val/max,0,1);g.strokeStyle='#ff7a1a';g.lineWidth=2.5;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*r*.82,cy+Math.sin(a)*r*.82);g.stroke();
    g.fillStyle='#cfd6de';g.font=`${Math.round(r*.22)}px "IBM Plex Mono",monospace`;g.textAlign='center';g.fillText(lab,cx,cy+r*.5);};
  const r=Math.min(H*.1,W*.08),gy=y0+H*.06+r+6;
  gauge(W*.5-r*1.15,gy,r,SCN.rpm,Math.ceil(E.limiter/1000)*1000,`${nf(SCN.rpm,-2)} tr/min`,E.limiter/(Math.ceil(E.limiter/1000)*1000));
  gauge(W*.5+r*1.15,gy,r,SCN.v,Math.max(160,Math.ceil(C.vmax/40)*40),`${nf(SCN.v)} km/h`);
  // volant
  g.strokeStyle='#22262c';g.lineWidth=Math.max(8,r*.22);g.beginPath();g.arc(W*.5,H+r*2.2,r*2.6,Math.PI*1.22,Math.PI*1.78);g.stroke();
}
// vue d'hélicoptère
function drawTop(g,W,H,P){
  const car=$('#sceneCar svg'),ppm=car?car.getBoundingClientRect().height/(car.viewBox.baseVal.width/1000):20,x=SCN.x*ppm;
  g.fillStyle=P.ground;g.fillRect(0,0,W,H);
  const rw=Math.min(W*.5,240),x0=W/2-rw/2;
  g.fillStyle=P.road;g.fillRect(x0,0,rw,H);
  g.fillStyle=ui.scene==='circuit'?'#d23a2e':P.side;g.fillRect(x0-6,0,6,H);g.fillRect(x0+rw,0,6,H);
  const dl=12*ppm,dg=8*ppm,o=x%(dl+dg);g.fillStyle=P.line;
  for(let y=-dl+o;y<H;y+=dl+dg) g.fillRect(W/2-2,y,4,dl);
  const sp=(ui.scene==='ville'?18:12)*ppm,o2=x%sp;
  for(let y=-sp+o2;y<H+sp;y+=sp) for(const s of [-1,1]){const k=Math.floor((y-x)/sp)+s*7,xx=s<0?x0-30-hsh(k)*50:x0+rw+30+hsh(k)*50;
    if(ui.scene==='ville'||ui.scene==='nuit'){g.fillStyle=ui.scene==='nuit'?'#1c2333':'#8a94a3';g.fillRect(s<0?0:x0+rw+18,y,s<0?x0-18:W-x0-rw-18,sp*.8);}
    else if(ui.scene==='circuit'){g.fillStyle='#d6dbe1';g.fillRect(s<0?x0-60:x0+rw+20,y,40,sp*.6);}
    else{g.fillStyle=ui.scene==='montagne'?'#1f3d2b':'#355c28';g.beginPath();g.arc(xx,y,10+hsh(k+2)*10,0,7);g.fill();g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.arc(xx-3,y-3,5+hsh(k+2)*4,0,7);g.fill();}}
}
// interactions
$('#stage').addEventListener('click',e=>{
  const a=e.target.closest('[data-scn]'),b=e.target.closest('[data-camv]');if(!a&&!b) return;
  if(a) ui.scene=a.dataset.scn;if(b) ui.camv=b.dataset.camv;
  for(const x of $$('[data-scn]')) x.setAttribute('aria-checked',x.dataset.scn===ui.scene);
  for(const x of $$('[data-camv]')) x.setAttribute('aria-checked',x.dataset.camv===ui.camv);
  const road=$('#road');if(!road) return;road.className=`road scene cam-${ui.camv}`;
  if(b){const pxw=Math.min(470,($('#stage').clientWidth||700)*.64);$('#sceneCar').innerHTML=sceneCarSVG(pxw);
    if(run) run.wheels=$$('.wheel',road);if(cruise) cruise.wheels=$$('.wheel',road);}
  sceneDraw(SCN.x,SCN.v,SCN.rpm);
});
