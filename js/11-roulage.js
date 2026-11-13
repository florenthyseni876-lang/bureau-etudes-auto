'use strict';
/* ───────────── Roulage à vitesse stabilisée ───────────── */
let cruise=null;
function cruiseUI(){const b=$('#cruiseGo');if(b) b.textContent=cruise?'Arrêter le roulage':'Rouler à vitesse stabilisée';const r=$('#cruiseV'),o=$('#cruiseVO');if(r){if(+r.value!==ui.cruiseV) r.value=ui.cruiseV;r.style.setProperty('--p',((ui.cruiseV-30)/270*100)+'%');o.textContent=ui.cruiseV+' km/h';}}
function startCruise(){
  const road=$('#road');if(!road) return;if(ui.broken){flashBroken();return;}run=null;
  const svg=road.querySelector('svg.car');
  cruise={t:0,v:0,x:0,g:0,sh:0,last:performance.now(),ppm:svg?boxW(svg)/(svg.viewBox.baseVal.width/1000):30,wheels:$$('.wheel',svg),hist:[[0,0]],hs:0,ct:-1,mt:-1};
  $('#runRead').innerHTML='';cruiseUI();requestAnimationFrame(stepCruise);
}
function stopCruise(){if(!cruise) return;cruise=null;cruiseUI();audioSet({rpm:M.E.idle,ld:0,pr:1},false);const m=$('#runMsg');if(m) m.textContent='Roulage arrêté.';}
function stepCruise(now){
  if(!cruise||ui.tab!=='essais'||!$('#road')){cruise=null;return;}
  const c=cruise,D=M.C.dyn,E=M.E,C=M.C,n=D.gears.length,dt=Math.min(.05,(now-c.last)/1000),vt=Math.min(ui.cruiseV,C.vmax)/3.6;c.last=now;
  let load=0,mode=0;
  for(let i=0,h=dt/5;i<5;i++){
    const rpm=D.wRpm(c.v,c.g);let a;
    if(c.v<vt-.15){
      let rpmE=rpm,mult=1;if(c.g===0&&rpm<D.launch){rpmE=D.launch;if(D.isAuto) mult=1+.7*(1-rpm/D.launch);}
      let F=rpm<D.lim?E.tq(clamp(rpmE,E.idle,D.lim))*mult*D.gears[c.g]*S.final*D.etaD/D.r:0;
      if(c.sh>0){F*=D.cut;c.sh-=h;}
      F=Math.min(F,D.Ftr*.97);a=(F-D.res(c.v))/(D.mP*1.08);load=1;mode=0;
      if(c.sh<=0&&c.g<n-1&&D.wRpm(c.v,c.g)>=D.shiftRpm[c.g]){c.g++;c.sh=D.shift;}
    }else if(c.v>vt+.4){a=-D.res(c.v)/D.mP-1.8;load=0;mode=2;if(c.g>0&&rpm<1300) c.g--;}
    else{
      a=(vt-c.v)*2;mode=1;const Pe=D.res(c.v)*c.v/D.etaD+600;let g=0;
      for(let gi=n-1;gi>=0;gi--){const rr=D.wRpm(c.v,gi);if(gi===0||(rr>=Math.max(1250,E.idle+250)&&D.pAv(rr)*.85>=Pe)){g=gi;break;}}
      c.g=g;load=clamp(Pe/Math.max(1,D.pAv(clamp(D.wRpm(c.v,g),E.idle,D.lim))),0,1);
    }
    c.v=Math.max(0,c.v+a*h);c.x+=c.v*h;c.t+=h;
    if(!ui.broken){const rr=clamp(D.wRpm(c.v,c.g),E.idle,D.lim),kb=dmgStep(ui.dmg,stressCar(rr,load),h);if(kb){cruise=null;cruiseUI();hud({t:c.t,v:c.v*3.6,x:c.x,g:c.g,rpm:rr});$('#runMsg').textContent=`Casse à ${nf(c.v*3.6)} km/h après ${nf(c.x/1000,1)} km de roulage.`;breakEngine(kb,{where:'essai',rpm:rr,v:c.v*3.6});return;}}
  }
  const rpm=Math.round(clamp(Math.max(D.wRpm(c.v,c.g),c.g===0&&mode===0?D.launch:0),E.idle,D.lim));
  hud({t:c.t,v:c.v*3.6,x:c.x,g:c.g,rpm});
  const road=$('#road'),off=c.x*c.ppm;road.style.setProperty('--rx',(off%140).toFixed(1)+'px');road.style.setProperty('--rx2',(off*.6%700).toFixed(1)+'px');sceneDraw(c.x,c.v*3.6,rpm);
  if(!reduced()){const ang=-(c.x/C.r)*180/Math.PI%360;for(const wl of c.wheels) wl.style.transform=`rotate(${ang.toFixed(1)}deg)`;}
  audioSet({rpm,ld:load,pr:1+(E.prAt(rpm)-1)*load},true);
  if(c.t-c.hs>=.25){c.hs=c.t;c.hist.push([c.t,c.v*3.6]);if(c.hist.length>260) c.hist.shift();}
  if(c.t-c.mt>=.3){c.mt=c.t;const lim=ui.cruiseV>C.vmax;
    $('#runMsg').textContent=mode===0?`Accélération vers ${nf(vt*3.6)} km/h${lim?' (vitesse maxi du véhicule)':''}…`:mode===2?`Ralentissement vers ${nf(vt*3.6)} km/h…`:`Stabilisé à ${nf(c.v*3.6)} km/h${C.cvt?'':` en ${c.g+1}${c.g?'e':'re'}`} · charge moteur ${nf(load*100)} % · ${nf(C.fuelW(c.v)/c.v/(C.lhv*1e6)*1e5,1)} l/100 km. Le roulage continue jusqu'à l'arrêt manuel.`;}
  if(c.t-c.ct>=.5&&$('#runCh')){c.ct=c.t;const w=clamp($('#runCh').clientWidth||600,260,1200),x1=Math.max(60,c.t),x0=x1-60,ay=niceAxis(Math.max(60,ui.cruiseV*1.1,c.v*3.6),4),xt=[];
    for(let v=Math.ceil(x0/10)*10;v<=x1;v+=10) xt.push(v);
    $('#runCh').innerHTML=lineChart({w,h:190,x0,x1,y1:ay.top,yt:ay.t,xt,col:'s1',aria:'Vitesse pendant le roulage, dernière minute',pts:c.hist.filter(q=>q[0]>=x0)});}
  requestAnimationFrame(stepCruise);
}
