'use strict';
/* ───────────── Dessin du moteur (canvas) ───────────── */
let TH={};
function readTheme(){const cs=getComputedStyle(document.documentElement);for(const k of ['ink','ink-2','muted','sheet','inset','accent','metal','metal-2','rule','s1','s2']) TH[k]=cs.getPropertyValue('--'+k).trim();}
let engTheta=.7,engLast=0,engRaf=0;
function drawEngine(){
  if(M.E&&M.E.rot) return drawRotary(false);
  const cv=$('#engCv');if(!cv||!M.E) return;cv.classList.remove('cyc');
  const c=M.E&&M.E.c?M.E.c:CFG[S.config],w=cv.clientWidth,stack=w<520;
  cv.classList.toggle('stack',stack);
  const h=cv.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);
  if(!w||!h) return;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  ctx.lineJoin='round';ctx.lineCap='round';
  const bore=S.bore,stroke=S.stroke,r=stroke/2,l=stroke*1.7,pc=bore*.34,ph=bore*.62;
  const deck=r+l+pc+3,headH=bore*.5+(S.valvetrain==='ohv'?22:S.valvetrain==='sohc'?40:52),Rc=r+34,top=deck+headH;
  const k=c.lay==='I'?c.n:c.w?c.n/4:c.n/2,pitch=bore+9,lenB=k*pitch+110,fire=BANKFIRE[k]||BANKFIRE[4];
  const banks=c.lay==='I'?[0]:c.lay==='V'?[-c.ang/2,c.ang/2]:[-90,90];
  let fw,fh,fcy;
  if(c.lay==='I'){fw=Math.max(bore+70,2*Rc+20);fcy=top;fh=top+Rc+62;}
  else if(c.lay==='V'){const a=c.ang/2*Math.PI/180,hw=bore/2+20;fw=2*(top*Math.sin(a)+hw*Math.cos(a));fcy=top*Math.cos(a)+hw*Math.sin(a);fh=fcy+Rc+62;}
  else{fw=2*top;fcy=Math.max(bore/2+24,Rc)+6;fh=fcy+Rc+44;}
  const flat=c.lay==='F',bw=lenB+60,bh=flat?2*top+10:top+Rc+62,bcy=flat?top+5:top;
  const pad=14,lab=20;
  const fB=stack?{x:pad,y:lab+6,w:w-2*pad,h:h*.42-lab-6}:{x:pad,y:lab+6,w:w*.33-pad*1.5,h:h-lab-pad-6};
  const bB=stack?{x:pad,y:h*.42+lab+6,w:w-2*pad,h:h*.58-lab-pad-6}:{x:w*.33+pad*.5,y:lab+6,w:w*.67-pad*1.5,h:h-lab-pad-6};
  const sc=Math.min(fB.w/fw,fB.h/fh,bB.w/bw,bB.h/bh),lw=1.3/sc,th=engTheta;
  const R=(x,y,ww,hh,f,st)=>{ctx.beginPath();ctx.rect(x,y,ww,hh);if(f){ctx.fillStyle=f;ctx.fill();}if(st){ctx.strokeStyle=st;ctx.lineWidth=lw;ctx.stroke();}};
  const Ci=(x,y,rr,f,st)=>{ctx.beginPath();ctx.arc(x,y,rr,0,7);if(f){ctx.fillStyle=f;ctx.fill();}if(st){ctx.strokeStyle=st;ctx.lineWidth=lw;ctx.stroke();}};
  const axis=(x1,y1,x2,y2)=>{ctx.save();ctx.setLineDash([14/sc,4/sc,2/sc,4/sc]);ctx.strokeStyle=TH.muted;ctx.lineWidth=.9/sc;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();};
  const pist=phi=>r*Math.cos(phi)+Math.sqrt(l*l-Math.pow(r*Math.sin(phi),2));
  const glow=(x,cyc,s)=>{if(cyc<110){ctx.save();ctx.globalAlpha=(1-cyc/110)*.8;R(x-bore/2,-deck,bore,Math.max(2,deck-s-pc),TH.accent);ctx.restore();}};
  const piston=(x,s)=>{R(x-bore/2+1.5,-s-pc,bore-3,ph,TH.metal,TH.ink);ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=.8/sc;ctx.beginPath();ctx.moveTo(x-bore/2+2,-s-pc+ph*.16);ctx.lineTo(x+bore/2-2,-s-pc+ph*.16);ctx.moveTo(x-bore/2+2,-s-pc+ph*.3);ctx.lineTo(x+bore/2-2,-s-pc+ph*.3);ctx.stroke();};
  const cams=()=>{if(S.valvetrain==='ohv') return;const y=-deck-headH+18;if(S.valvetrain==='sohc') Ci(0,y,12,TH.sheet,TH.ink);else{Ci(-bore*.27,y,12,TH.sheet,TH.ink);Ci(bore*.27,y,12,TH.sheet,TH.ink);}};
  // ── vue de face
  ctx.save();ctx.translate(fB.x+fB.w/2,fB.y+(fB.h-fh*sc)/2+fcy*sc);ctx.scale(sc,sc);
  if(!flat){ctx.beginPath();ctx.rect(-Rc*.82,Rc*.3,Rc*1.64,Rc*.7+44);ctx.fillStyle=TH.inset;ctx.fill();ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.stroke();}
  banks.forEach(bd=>{ctx.save();ctx.rotate(bd*Math.PI/180);R(-bore/2-16,-deck,bore+32,deck-Rc*.7,TH.inset,TH.ink);R(-bore/2,-deck,bore,stroke+ph+8,TH.sheet);R(-bore/2-20,-top,bore+40,headH,TH.inset,TH.ink);cams();ctx.restore();});
  Ci(0,0,Rc,TH.inset,TH.ink);
  banks.forEach((bd,bi)=>{
    const b=bd*Math.PI/180,phi=th-b+(flat&&bi===1?Math.PI:0),s=pist(phi);
    ctx.save();ctx.rotate(b);
    glow(0,(((th*180/Math.PI)-(bi?(flat?360:(720/c.n)):0))%720+720)%720,s);
    ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=bore*.13;ctx.beginPath();ctx.moveTo(r*Math.sin(phi),-r*Math.cos(phi));ctx.lineTo(0,-s);ctx.stroke();
    piston(0,s);axis(0,-top-10,0,0);ctx.restore();
  });
  ctx.fillStyle=TH['ink-2'];ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,Rc*.84,th+Math.PI/2-.95,th+Math.PI/2+.95);ctx.closePath();ctx.fill();
  Ci(r*Math.sin(th),-r*Math.cos(th),bore*.13,TH.ink);if(flat) Ci(-r*Math.sin(th),r*Math.cos(th),bore*.13,TH.ink);
  Ci(0,0,bore*.16,TH.sheet,TH.ink);
  ctx.restore();
  // ── vue de côté (ou de dessus pour un moteur à plat)
  ctx.save();ctx.translate(bB.x+(bB.w-bw*sc)/2+16*sc,bB.y+(bB.h-bh*sc)/2+bcy*sc);ctx.scale(sc,sc);
  (flat?[1,-1]:[1]).forEach((dir,bi)=>{
    ctx.save();ctx.scale(1,dir);const off=bi?pitch*.4:0;
    if(flat) R(off,-deck,lenB,deck,TH.inset,TH.ink);
    else{R(30,Rc-4,lenB-60,48,TH.inset,TH.ink);R(0,-deck,lenB,deck+Rc,TH.inset,TH.ink);}
    R(off-4,-top,lenB+8,headH,TH.inset,TH.ink);
    for(let i=0;i<k;i++){
      const x=off+55+pitch*(i+.5),f=fire[i]+(bi?360:0),phi=th-f*Math.PI/180,s=pist(phi),py=-r*Math.cos(phi);
      R(x-bore/2,-deck,bore,stroke+ph+8,TH.sheet);
      glow(x,((th*180/Math.PI-f)%720+720)%720,s);
      ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=bore*.13;ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x,-s);ctx.stroke();
      piston(x,s);
      ctx.strokeStyle=TH.ink;ctx.lineWidth=bore*.15;ctx.beginPath();ctx.moveTo(x-pitch*.5,0);ctx.lineTo(x-pitch*.28,0);ctx.lineTo(x-pitch*.28,py);ctx.lineTo(x+pitch*.28,py);ctx.lineTo(x+pitch*.28,0);ctx.lineTo(x+pitch*.5,0);ctx.stroke();
      if(S.valvetrain!=='ohv'){const lh=7+5*Math.cos((th-f*Math.PI/180)/2);ctx.fillStyle=TH['ink-2'];ctx.beginPath();ctx.ellipse(x,-top+18,bore*.16,lh,0,0,7);ctx.fill();}
    }
    if(S.valvetrain!=='ohv'){ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(off+20,-top+18);ctx.lineTo(off+lenB-20,-top+18);ctx.stroke();}
    ctx.restore();
  });
  ctx.strokeStyle=TH.ink;ctx.lineWidth=bore*.15;ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(55,0);ctx.moveTo(lenB-55,0);ctx.lineTo(lenB+24,0);ctx.stroke();
  R(lenB+4,-(Rc+24),22,2*(Rc+24),TH['ink-2'],TH.ink);R(-18,-32,14,64,TH['ink-2'],TH.ink);
  axis(-30,0,lenB+44,0);
  if(M.E.turbo){const nT=M.E.nt>1?2:1;for(let i=0;i<nT;i++){const tx=nT===2?(i?lenB-80:80):lenB-80,ty=-deck*.42;Ci(tx,ty,34,TH.sheet,TH.ink);Ci(tx,ty,13,TH.accent,TH.ink);ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.beginPath();for(let j=0;j<6;j++){const a=th*3+j*Math.PI/3;ctx.moveTo(tx+13*Math.cos(a),ty+13*Math.sin(a));ctx.lineTo(tx+30*Math.cos(a+.5),ty+30*Math.sin(a+.5));}ctx.stroke();}}
  else if(M.E.sc){const tx=lenB/2-95,ty=-deck*.62;ctx.beginPath();ctx.rect(tx,ty,190,60);ctx.fillStyle=TH.sheet;ctx.fill();ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.stroke();Ci(tx+50,ty+30,20,TH.accent,TH.ink);Ci(tx+140,ty+30,20,TH.accent,TH.ink);}
  ctx.restore();
  // légendes
  ctx.fillStyle=TH.muted;ctx.font='500 10px "IBM Plex Mono",monospace';ctx.textBaseline='top';
  ctx.fillText('VUE DE FACE',fB.x,fB.y-lab+2);
  ctx.fillText(flat?'VUE DE DESSUS':c.lay==='V'?`VUE DE CÔTÉ · UNE RANGÉE DE ${k}`:'VUE DE CÔTÉ',bB.x,bB.y-lab+2);
  ctx.fillStyle=TH['ink-2'];ctx.textBaseline='bottom';
  ctx.fillText(`Ø${nf(bore,1)} × ${nf(stroke,1)} mm`,fB.x,fB.y+fB.h+(stack?2:8));
}
function engLoop(now){
  engRaf=0;
  if(ui.tab!=='moteur'||!$('#engCv')) return;
  const rd=reduced(),dt=Math.min(.05,(now-(engLast||now))/1000);engLast=now;
  if(ui.eview==='cyc'&&ui.cycPlay&&!rd) ui.cyc=(ui.cyc+dt*Math.PI/2)%(4*Math.PI);
  if(ui.sweep){
    // banc à inertie : le couple disponible accélère une masse tournante ; le turbo charge avec retard ; coupure au rupteur
    const E=M.E,sw=ui.sweep,J=.9*E.L+.4,K=30/Math.PI,fricT=r=>(E.fmep(r)+.7)*1e5*E.dispM3/(4*Math.PI);
    for(let i=0,h=dt/4;i<4;i++){
      sw.t+=h;const rf=ui.rpm/E.limiter;
      if(sw.ph<2){
        const th=Math.min(1,sw.t/.35);
        if(sw.cut&&ui.rpm<E.limiter-70) sw.cut=false;
        if(ui.rpm>=E.limiter){sw.cut=true;if(sw.ph===0){sw.ph=1;sw.t1=0;}}
        if(E.turbo){const tau=(.25+1.3*S.turboSize/100)*E.tauK/(.3+rf);sw.bf+=((sw.cut?.7:th)-sw.bf)*(1-Math.exp(-h/tau));}else sw.bf=1;
        ui.rpm+=(sw.cut?-fricT(ui.rpm)/(J*.15):E.tq(ui.rpm,sw.bf)*th/J)*K*h;ui.load=sw.cut?0:Math.round(th*100);
        if(sw.ph===1){sw.t1+=h;if(sw.t1>1.1) sw.ph=2;}
      }else{ui.load=0;sw.bf*=Math.exp(-h/.35);ui.rpm-=fricT(ui.rpm)/(J*.1)*K*h;if(ui.rpm<=E.idle){ui.rpm=E.idle;ui.sweep=null;benchLast=0;break;}}
    }
  }
  const b=benchState();
  if(ui.run&&!ui.broken){const st=M.E.stressAt(b.rpm,b.ld,ui.sweep?ui.sweep.bf:1,ui.T?ui.T.oil:95);if(ui.T){st.cool=Math.max(st.cool,ui.T.water/112);st.oil=Math.max(st.oil,ui.T.oil/140);}const kb=dmgStep(ui.dmg,st,rd?.14:dt);if(kb) breakEngine(kb,{where:'banc',rpm:b.rpm});}
  if(ui.run&&!rd&&!document.hidden) engTheta=(engTheta+dt*2*Math.PI*(.3+b.rpm/2000))%(4*Math.PI);
  stepHeat(b,rd?999:dt);engFrame();audioSet(b,ui.run);
  if(rd||now-benchLast>140){benchLast=now;benchUpdate(b);}
  if(!rd||ui.sweep) engRaf=requestAnimationFrame(engLoop);
}
function setEngView(){
  const d3=(ui.eview==='3d'||ui.eview==='cut')&&!!E3,cy=ui.eview==='cyc';
  for(const b of $$('[data-ev]')){b.setAttribute('aria-checked',b.dataset.ev===ui.eview?'true':'false');if(b.dataset.ev==='3d'||b.dataset.ev==='cut') b.disabled=!E3;}
  const a=$('#eng3d'),b=$('#engCv');if(!a) return;
  a.hidden=!d3;$('#engPins').hidden=!d3||!ui.pins;b.hidden=d3;$('#engLegend').hidden=!d3;$('#cycBar').hidden=!cy;cycLast=-1;
  if(!cy) b.classList.remove('cyc');
  for(const id of ['pinLab','zoomIn','zoomOut']) $('#'+id).hidden=!d3;
  if(d3) apply3DMode();
  benchUpdate();
}
function kickEngine(){if(!engRaf){engLast=0;benchLast=0;engRaf=requestAnimationFrame(engLoop);}}
