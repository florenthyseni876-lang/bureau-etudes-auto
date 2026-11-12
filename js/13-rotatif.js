'use strict';
/* ───────────── Moteur rotatif : dessin 2D et cycle ───────────── */
function drawRotary(slow){
  const cv=$('#engCv');if(!cv||!M.E) return;
  const w=cv.clientWidth,stack=w<560;cv.classList.toggle('cyc',slow);cv.classList.toggle('stack',stack);
  const h=cv.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);if(!w||!h) return;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.lineJoin='round';ctx.lineCap='round';
  const E=M.E,P=Math.PI,R=S.bore,e=R/7,a=(slow?ui.cyc:engTheta)*1.5,nR=E.rot;
  const bx=stack?{x:10,y:22,w:w-20,h:h*.55-22}:{x:10,y:22,w:w*.5,h:h-34};
  const sc=Math.min(bx.w/(2*(R+e)+90),bx.h/(2*(R-e)+110)),lw=1.4/sc;
  const epi=t=>[e*Math.cos(3*t)+R*Math.cos(t),e*Math.sin(3*t)+R*Math.sin(t)];
  const C=[e*Math.cos(a),e*Math.sin(a)],apx=k=>{const t=a/3+2*P*k/3;return epi(t);};
  const fresh=S.fuelSys==='di'?'70,150,235':'60,165,190',COL=[`rgba(${fresh},.5)`,`rgba(${fresh},.85)`,'rgba(255,150,40,.9)','rgba(120,110,105,.55)'];
  ctx.save();ctx.translate(bx.x+bx.w/2,bx.y+bx.h/2);ctx.scale(sc,sc);
  // carter
  const hw=R+e+34,hh=R-e+40;ctx.beginPath();ctx.rect(-hw,-hh,2*hw,2*hh);ctx.fillStyle=TH.inset;ctx.fill();ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.stroke();
  // conduits (haut) : échappement à gauche du sommet, admission à droite ; bougies en bas
  const duct=(deg,col)=>{const t=deg*P/180,q=epi(t);ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(-P/2);ctx.fillStyle=col;ctx.fillRect(-4,-13,60,26);ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.strokeRect(-4,-13,60,26);ctx.restore();};
  ctx.beginPath();for(let i=0;i<=120;i++){const q=epi(i/120*2*P);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);}ctx.closePath();ctx.fillStyle=TH.sheet;ctx.fill();
  duct(248,'rgba(120,110,105,.45)');duct(292,`rgba(${fresh},.4)`);
  // chambres
  for(let k=0;k<3;k++){
    const t0=a/3+2*P*k/3,th=((t0+P/3)%(2*P)+2*P)%(2*P),deg=th*180/P,ph=deg>=270?0:deg<90?1:deg<180?2:3;
    const A=epi(t0),B=epi(t0+2*P/3),Q=[C[0]+.9*R*Math.cos(t0+P/3),C[1]+.9*R*Math.sin(t0+P/3)];
    ctx.beginPath();for(let i=0;i<=24;i++){const q=epi(t0+i/24*2*P/3);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);}ctx.quadraticCurveTo(Q[0],Q[1],A[0],A[1]);ctx.closePath();
    let col=COL[ph];if(ph===2){const u=(deg-90)/90;col=`rgba(${Math.round(lerp(255,150,u))},${Math.round(lerp(160,90,u))},${Math.round(lerp(40,70,u))},${lerp(.95,.55,u)})`;}
    ctx.fillStyle=col;ctx.fill();
    if(ph===2&&deg<120){ctx.save();ctx.clip();const g=ctx.createRadialGradient(0,R-e,0,0,R-e,R*.9*(deg-88)/32);g.addColorStop(0,'rgba(255,250,200,.95)');g.addColorStop(1,'rgba(255,120,20,0)');ctx.fillStyle=g;ctx.fillRect(-R*1.3,-R*1.3,R*2.6,R*2.6);ctx.restore();}
  }
  ctx.beginPath();for(let i=0;i<=120;i++){const q=epi(i/120*2*P);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);}ctx.closePath();ctx.strokeStyle=TH.ink;ctx.lineWidth=lw*1.3;ctx.stroke();
  // rotor
  ctx.beginPath();for(let k=0;k<3;k++){const A=apx(k),t0=a/3+2*P*k/3,Q=[C[0]+.9*R*Math.cos(t0+P/3),C[1]+.9*R*Math.sin(t0+P/3)],B=apx(k+1);if(!k) ctx.moveTo(A[0],A[1]);ctx.quadraticCurveTo(Q[0],Q[1],B[0],B[1]);}
  ctx.closePath();ctx.fillStyle=TH.metal;ctx.fill();ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.stroke();
  for(let k=0;k<3;k++){const A=apx(k);ctx.fillStyle=TH.ink;ctx.beginPath();ctx.arc(A[0],A[1],3.2,0,7);ctx.fill();}
  ctx.beginPath();ctx.arc(C[0],C[1],3*e,0,7);ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=lw;ctx.setLineDash([4/sc*2,3/sc*2]);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(C[0],C[1],R*.3,0,7);ctx.fillStyle=TH['ink-2'];ctx.fill();
  ctx.beginPath();ctx.arc(0,0,2*e,0,7);ctx.fillStyle=TH.inset;ctx.fill();ctx.strokeStyle=TH.ink;ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,R*.13,0,7);ctx.fillStyle=TH.sheet;ctx.fill();ctx.stroke();
  // bougies
  for(const d of [80,100]){const q=epi(d*P/180);ctx.fillStyle=TH.metal;ctx.strokeStyle=TH.ink;ctx.lineWidth=lw;ctx.beginPath();ctx.rect(q[0]-5,q[1],10,34);ctx.fill();ctx.stroke();}
  const sparkOn=[0,1,2].some(k=>{const d=(((a/3+2*P*k/3+P/3)%(2*P)+2*P)%(2*P))*180/P;return d>84&&d<96;});
  if(sparkOn){ctx.strokeStyle='#ffd23a';ctx.lineWidth=2.4/sc;for(const d of [80,100]){const q=epi(d*P/180);for(let i=0;i<6;i++){const an=i*P/3+a*5;ctx.beginPath();ctx.moveTo(q[0],q[1]-3);ctx.lineTo(q[0]+Math.cos(an)*11,q[1]-3+Math.sin(an)*11);ctx.stroke();}}}
  ctx.restore();
  ctx.font='500 10px "IBM Plex Mono",monospace';ctx.fillStyle=TH.muted;ctx.textBaseline='top';ctx.textAlign='left';
  ctx.fillText('ÉCHAPPEMENT',bx.x,bx.y-16);ctx.textAlign='right';ctx.fillText('ADMISSION',bx.x+bx.w,bx.y-16);ctx.textAlign='center';ctx.fillText('BOUGIES',bx.x+bx.w/2,bx.y+bx.h+(stack?0:2));ctx.textAlign='left';
  // panneau de droite
  const px0=stack?14:w*.55,pw2=stack?w-28:w*.45-14,py0=stack?h*.58:14;
  ctx.fillStyle=TH.ink;ctx.font='600 22px "Barlow Condensed","Arial Narrow",sans-serif';ctx.fillText(slow?'CYCLE WANKEL':E.c.full.toUpperCase(),px0,py0);
  ctx.font='12px "IBM Plex Mono",monospace';
  const names=['Admission','Compression','Combustion et détente','Échappement'],cols=[`rgba(${fresh},.5)`,`rgba(${fresh},.85)`,'rgba(255,150,40,.9)','rgba(120,110,105,.55)'];
  names.forEach((n,i)=>{const y=py0+36+i*20;ctx.fillStyle=cols[i];ctx.fillRect(px0,y,14,12);ctx.strokeStyle=TH['ink-2'];ctx.lineWidth=1;ctx.strokeRect(px0,y,14,12);ctx.fillStyle=TH.ink;ctx.fillText(n,px0+22,y);});
  const rows=[['Arbre excentrique',`${Math.round(((a%(2*P))+2*P)%(2*P)*180/P)}°`],['Rotor',`${Math.round((((a/3)%(2*P))+2*P)%(2*P)*180/P)}°`],['Rotors',String(nR)],['Chambre',`${nf(E.disp/nR)} cm³`],['Cylindrée',`${nf(E.disp)} cm³`]];
  rows.forEach((rw,i)=>{const y=py0+128+i*19;ctx.fillStyle=TH.muted;ctx.fillText(rw[0],px0,y);ctx.fillStyle=TH.ink;ctx.textAlign='right';ctx.fillText(rw[1],px0+pw2,y);ctx.textAlign='left';});
  if(slow&&cycLast!==9){cycLast=9;for(const bt of $$('#cycBar [data-ph]')) bt.setAttribute('aria-pressed','false');const d=$('#cycDesc');if(d) d.textContent="Pas de piston ni de soupape : le rotor triangulaire tourne dans son carter et découpe trois chambres. Chacune fait à tour de rôle admission, compression, combustion et échappement ; le rotor fait un tour quand l'arbre en fait trois, ce qui donne une combustion par tour d'arbre et par rotor.";}
}
