'use strict';
/* ───────────── Chambre de combustion : les quatre temps ───────────── */
const CYC_N=['Admission','Compression','Combustion et détente','Échappement'];
function cycPhys(th,b){
  const E=M.E,P=Math.PI,r=S.stroke/2,l=S.stroke*1.7,x=(r+l)-(r*Math.cos(th)+Math.sqrt(l*l-Math.pow(r*Math.sin(th),2))),vc=S.stroke/(S.cr-1),V=vc+x,Vb=vc+S.stroke;
  const pin=(E.dz?1:(.3+.7*b.ld))*b.pr,mot=pin*Math.pow(Vb/V,1.3),Tm=318*Math.pow(Vb/V,.32),k=(2.2+1.1*b.ld)*(E.dz?.75:1),ts=2*P-.25,egt=ui.T?ui.T.egt:500;
  if(th<P) return {ph:0,p:pin,T:45,W:0};
  if(th<ts) return {ph:1,p:mot,T:Tm-273,W:0};
  if(th<3*P){const W=1-Math.exp(-5*Math.pow((th-ts)/.9,3));return {ph:th<2*P?1:2,p:mot*(1+k*W),T:Tm*(1+(E.dz?2:2.8)*(.45+.55*b.ld)*W)-273,W};}
  const p3=pin*(1+k),T3=318*(1+(E.dz?2:2.8)*(.45+.55*b.ld))-273,u=th-3*P;
  return {ph:3,p:1.1+(p3-1.1)*Math.exp(-u/.25),T:egt+(T3-egt)*Math.exp(-u/.5),W:1};
}
function cycDesc(ph){
  const E=M.E,bst=E.boosted?` La suralimentation le pousse jusqu'à ${nf(S.boost,2)} bar.`:'';
  return [
    (E.dz?"Le piston descend et aspire de l'air seul par la soupape d'admission ouverte.":S.fuelSys==='di'?"Le piston descend et aspire de l'air par la soupape d'admission ouverte ; l'essence est injectée directement dans le cylindre.":"Le piston descend et aspire le mélange d'air et d'essence préparé dans le conduit d'admission.")+bst,
    `Soupapes fermées, le piston remonte et comprime ${E.dz?"l'air":'le mélange'} ${nf(S.cr,1)} fois. La température grimpe${E.dz?" assez pour enflammer le gazole":''}.`,
    E.dz?"Le gazole injecté en fin de compression s'enflamme tout seul dans l'air brûlant. La pression repousse le piston : c'est le seul temps moteur.":"L'étincelle de la bougie enflamme le mélange juste avant le point mort haut. Le front de flamme traverse la chambre et la pression repousse le piston : c'est le seul temps moteur.",
    `La soupape d'échappement s'ouvre, le piston remonte et chasse les gaz brûlés vers le collecteur${E.turbo?' et la turbine du turbo':''}.`][ph];
}
let cycLast=-1;
function drawCycle(){
  if(M.E&&M.E.rot) return drawRotary(true);
  const cv=$('#engCv');if(!cv||!M.E) return;
  const w=cv.clientWidth,stack=w<560;cv.classList.add('cyc');cv.classList.toggle('stack',stack);
  const h=cv.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);if(!w||!h) return;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.lineJoin='round';ctx.lineCap='round';
  const E=M.E,b=benchState(),th=ui.cyc,P=Math.PI,cp=cycPhys(th,b);
  const bore=S.bore,stroke=S.stroke,r=stroke/2,l=stroke*1.7,pc=bore*.34,ph=bore*.62,deck=r+l+pc+3,roof=bore*.2,hh=bore*.8,Rc=r+34,wl=18;
  const bx=stack?{x:10,y:6,w:w-20,h:h*.56}:{x:10,y:8,w:w*.48,h:h-16};
  const totH=hh+deck+Rc+16,totW=bore*2.5,sc=Math.min(bx.w/totW,bx.h/totH),lw=1.4/sc;
  const s=r*Math.cos(th)+Math.sqrt(l*l-Math.pow(r*Math.sin(th),2)),cy=-(s+pc);
  const poly=(pts,f,st)=>{ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();if(f){ctx.fillStyle=f;ctx.fill();}if(st){ctx.strokeStyle=st;ctx.lineWidth=lw;ctx.stroke();}};
  ctx.save();ctx.translate(bx.x+bx.w/2,bx.y+(bx.h-totH*sc)/2+(hh+deck)*sc);ctx.scale(sc,sc);
  // carter, bloc, culasse
  ctx.beginPath();ctx.arc(0,0,Rc,0,7);ctx.fillStyle=TH.inset;ctx.fill();ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.stroke();
  poly([[-bore/2-wl,-deck],[-bore/2,-deck],[-bore/2,-Rc*.75],[-bore/2-wl,-Rc*.75]],TH.inset,TH.ink);poly([[bore/2+wl,-deck],[bore/2,-deck],[bore/2,-Rc*.75],[bore/2+wl,-Rc*.75]],TH.inset,TH.ink);
  poly([[-bore/2-wl,-deck],[-bore/2-wl,-deck-hh],[bore/2+wl,-deck-hh],[bore/2+wl,-deck]],TH.inset,TH.ink);
  const io=cp.ph===0?Math.sin(th):0,eo=cp.ph===3?Math.sin(th-3*P):0;
  const port=sg=>[[sg*bore*.42,-deck-roof*.16],[sg*bore*.08,-deck-roof*.84],[sg*bore*.3,-deck-hh*.86],[sg*(bore/2+wl),-deck-hh*.86],[sg*(bore/2+wl),-deck-hh*.42],[sg*bore*.5,-deck-hh*.42]];
  const fresh=E.dz||S.fuelSys==='di'?'70,150,235':'60,165,190',gasPoly=[[-bore/2,cy],[-bore/2,-deck],[0,-deck-roof],[bore/2,-deck],[bore/2,cy]];
  poly(port(-1),TH.sheet,TH.ink);poly(port(1),TH.sheet,TH.ink);
  poly(port(-1),`rgba(${fresh},${.22+.3*io})`);poly(port(1),`rgba(120,110,105,${cp.ph===3?.25+.45*eo:.1})`);
  // gaz dans le cylindre
  poly(gasPoly,TH.sheet);
  let gas;
  if(cp.ph===0) gas=`rgba(${fresh},${.12+.33*(th/P)})`;
  else if(cp.ph===1) gas=`rgba(${fresh},${.45+.4*((th-P)/P)})`;
  else if(cp.ph===2){const u=(th-2*P)/P;gas=`rgba(${Math.round(lerp(255,150,u))},${Math.round(lerp(150,90,u))},${Math.round(lerp(40,70,u))},${lerp(.9,.55,u)})`;}
  else gas=`rgba(120,110,105,${.55-.4*((th-3*P)/P)})`;
  poly(gasPoly,gas);
  if(cp.W>0&&cp.W<1||(cp.ph===2&&th<2*P+.9)){ctx.save();ctx.beginPath();gasPoly.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.clip();
    const rad=Math.max(4,cp.W*bore*.85),g=ctx.createRadialGradient(0,-deck-roof+6,0,0,-deck-roof+6,rad);g.addColorStop(0,'rgba(255,250,200,.98)');g.addColorStop(.55,'rgba(255,180,40,.9)');g.addColorStop(1,'rgba(255,90,20,0)');ctx.fillStyle=g;ctx.fillRect(-bore,-deck-roof-10,2*bore,2*bore);ctx.restore();}
  // gouttelettes de carburant
  const fuelOn=E.dz?0:S.fuelSys==='di'?(th>P*.5&&th<2*P-.2?1:0):(cp.ph===0||(cp.ph===1&&cp.W===0)?1:0);
  if(fuelOn){ctx.fillStyle='rgba(255,184,0,.9)';for(let i=0;i<34;i++){const fx=((i*37%100)/100-.5)*(bore-10),fy=((i*61%100)/100);const yy=lerp(-deck-roof*.3,cy-4,fy)+Math.sin(th*3+i)*3;if(yy<cy-3&&(cp.ph>0||fy<th/P)){ctx.beginPath();ctx.arc(fx,yy,2.2,0,7);ctx.fill();}}}
  if(E.dz&&th>2*P-.2&&th<2*P+.35){ctx.strokeStyle='rgba(255,184,0,.95)';ctx.lineWidth=2.5/sc*1.2;for(const an of [-.9,-.45,0,.45,.9]){ctx.beginPath();ctx.moveTo(0,-deck-roof+4);ctx.lineTo(Math.sin(an)*bore*.36,-deck-roof+4+Math.cos(an)*bore*.3);ctx.stroke();}}
  // flèches d'écoulement
  const chev=(sg,dirIn,col,amt)=>{if(amt<=.05) return;ctx.strokeStyle=col;ctx.lineWidth=3/sc;const ax=sg*(bore/2+wl-4),ay=-deck-hh*.64,bx2=sg*bore*.27,by=-deck-roof*.75;
    for(let i=0;i<3;i++){let t=((i/3+(th*1.6%1))%1);if(!dirIn) t=1-t;const px=lerp(ax,bx2,t),py=lerp(ay,by,t),an=Math.atan2(by-ay,bx2-ax)+(dirIn?0:Math.PI),q=9;ctx.beginPath();ctx.moveTo(px-Math.cos(an-.6)*q,py-Math.sin(an-.6)*q);ctx.lineTo(px,py);ctx.lineTo(px-Math.cos(an+.6)*q,py-Math.sin(an+.6)*q);ctx.stroke();}};
  chev(-1,true,`rgb(${fresh})`,io);chev(1,false,TH.muted,eo);
  // soupapes
  const valve=(sg,open)=>{const A=[sg*bore*.42,-deck-roof*.16],B=[sg*bore*.08,-deck-roof*.84],dx=B[0]-A[0],dy=B[1]-A[1],L2=Math.hypot(dx,dy),nx=-sg*dy/L2*sg,ny=Math.abs(dx)/L2,lift=open*bore*.11,mx=(A[0]+B[0])/2+(-dy/L2*sg>0?0:0),my=(A[1]+B[1])/2;
    const ox2=-sg*Math.abs(dy)/L2*0+sg*0,vx=sg*(-Math.abs(dy)/L2),vy=ny; // normale vers l'intérieur de la chambre
    ctx.strokeStyle=TH.ink;ctx.lineWidth=5/sc*1.1;ctx.beginPath();ctx.moveTo(A[0]+vx*lift,A[1]+vy*lift);ctx.lineTo(B[0]+vx*lift,B[1]+vy*lift);ctx.stroke();
    ctx.lineWidth=2.6/sc;ctx.beginPath();ctx.moveTo(mx+vx*lift,my+vy*lift);ctx.lineTo(mx-vx*hh*.72,my-vy*hh*.72);ctx.stroke();};
  valve(-1,io);valve(1,eo);
  // bougie ou injecteur
  ctx.fillStyle=E.dz?TH['ink-2']:TH.metal;ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.beginPath();ctx.rect(-5,-deck-hh+6,10,hh-roof-4);ctx.fill();ctx.stroke();
  if(!E.dz&&S.fuelSys!=='di'&&S.fuelSys!=='carb'){ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=6/sc;ctx.beginPath();ctx.moveTo(-bore*.5,-deck-hh*.98);ctx.lineTo(-bore*.38,-deck-hh*.7);ctx.stroke();}
  if(!E.dz&&th>2*P-.3&&th<2*P-.05){ctx.strokeStyle='#ffd23a';ctx.lineWidth=2.4/sc;for(let i=0;i<8;i++){const an=i*P/4+th*9;ctx.beginPath();ctx.moveTo(0,-deck-roof+5);ctx.lineTo(Math.cos(an)*13,-deck-roof+5+Math.sin(an)*13);ctx.stroke();}}
  // équipage mobile
  ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=bore*.13;ctx.beginPath();ctx.moveTo(r*Math.sin(th),-r*Math.cos(th));ctx.lineTo(0,-s);ctx.stroke();
  ctx.fillStyle=TH.metal;ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.beginPath();ctx.rect(-bore/2+1.5,cy,bore-3,ph);ctx.fill();ctx.stroke();
  ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=.9/sc;for(const f of [.16,.3]){ctx.beginPath();ctx.moveTo(-bore/2+2,cy+ph*f);ctx.lineTo(bore/2-2,cy+ph*f);ctx.stroke();}
  ctx.fillStyle=TH['ink-2'];ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,Rc*.84,th+P/2-.95,th+P/2+.95);ctx.closePath();ctx.fill();
  ctx.fillStyle=TH.ink;ctx.beginPath();ctx.arc(r*Math.sin(th),-r*Math.cos(th),bore*.13,0,7);ctx.fill();
  ctx.fillStyle=TH.sheet;ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.beginPath();ctx.arc(0,0,bore*.16,0,7);ctx.fill();ctx.stroke();
  ctx.restore();
  // légendes des conduits
  ctx.font='500 10px "IBM Plex Mono",monospace';ctx.fillStyle=TH.muted;ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText('ADMISSION',bx.x,bx.y);ctx.textAlign='right';ctx.fillText('ÉCHAPPEMENT',bx.x+bx.w,bx.y);ctx.textAlign='left';
  // relevés et courbe de pression
  const px0=stack?14:w*.52,pw2=stack?w-28:w*.48-14,py0=stack?h*.58:10;
  ctx.fillStyle=TH.ink;ctx.font='600 22px "Barlow Condensed","Arial Narrow",sans-serif';ctx.fillText(`${cp.ph+1}. ${CYC_N[cp.ph].toUpperCase()}`,px0,py0);
  ctx.font='12px "IBM Plex Mono",monospace';
  const rows=[['Angle vilebrequin',`${Math.round(th*180/P)}° sur 720°`],['Pression',`${nf(cp.p,cp.p<10?1:0)} bar`],['Température des gaz',`${nf(cp.T,-1)} °C`],["Soupape d'admission",io>.02?'ouverte':'fermée'],["Soupape d'échappement",eo>.02?'ouverte':'fermée']];
  rows.forEach((rw,i)=>{const y=py0+34+i*19;ctx.fillStyle=TH.muted;ctx.fillText(rw[0],px0,y);ctx.fillStyle=TH.ink;ctx.textAlign='right';ctx.fillText(rw[1],px0+pw2,y);ctx.textAlign='left';});
  const gy0=py0+34+rows.length*19+26,gh=Math.max(60,h-gy0-30),gx0=px0+30,gw=pw2-34;
  let pmax=0;const pts=[];for(let a=0;a<=720;a+=4){const q=cycPhys(a*P/180*.99999,b).p;pts.push(q);if(q>pmax) pmax=q;}
  const ax=niceAxis(pmax,3),X=a=>gx0+a/720*gw,Y=v=>gy0+gh-v/ax.top*gh;
  ctx.fillStyle=TH.muted;ctx.font='500 10px "IBM Plex Mono",monospace';ctx.fillText('PRESSION DANS LE CYLINDRE (bar)',px0,gy0-20);
  ctx.strokeStyle=TH.rule;ctx.lineWidth=1;for(const t of ax.t){ctx.globalAlpha=t?.55:1;ctx.beginPath();ctx.moveTo(gx0,Y(t));ctx.lineTo(gx0+gw,Y(t));ctx.stroke();ctx.globalAlpha=1;ctx.textAlign='right';ctx.fillText(nf(t),gx0-5,Y(t)-5);}
  ctx.textAlign='center';['Adm.','Comp.','Détente','Éch.'].forEach((n,i)=>{ctx.fillStyle=i===cp.ph?TH.ink:TH.muted;ctx.fillText(n,X(i*180+90),gy0+gh+6);if(i){ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(X(i*180),gy0);ctx.lineTo(X(i*180),gy0+gh);ctx.stroke();ctx.globalAlpha=1;}});
  ctx.textAlign='left';ctx.strokeStyle=TH.s2;ctx.lineWidth=2;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(X(i*4),Y(q)):ctx.moveTo(X(i*4),Y(q)));ctx.stroke();
  const mxp=X(th*180/P),myp=Y(cp.p);ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mxp,gy0);ctx.lineTo(mxp,gy0+gh);ctx.stroke();
  ctx.fillStyle=TH.s2;ctx.strokeStyle=TH.sheet;ctx.lineWidth=2;ctx.beginPath();ctx.arc(mxp,myp,4.5,0,7);ctx.fill();ctx.stroke();
  if(cp.ph!==cycLast){cycLast=cp.ph;for(const bt of $$('#cycBar [data-ph]')) bt.setAttribute('aria-pressed',+bt.dataset.ph===cp.ph?'true':'false');const d=$('#cycDesc');if(d) d.textContent=cycDesc(cp.ph);}
}
