'use strict';
/* ───────────── Rendu ───────────── */
function renderKeys(){
  const E=M.E,C=M.C;
  $('#keys').innerHTML=[['Puissance',nf(E.peakP),'ch'],['Couple',nf(E.peakT),'Nm'],['Masse à vide',nf(C.mass),'kg'],['0–100 km/h',C.t100?nf(C.t100,1):'—','s'],['Vitesse maxi',nf(C.vmax),'km/h'],['Conso mixte',nf(C.conso.mix,1),'l/100'],['Prix estimé',nf(Math.round(C.price/100)*100),'€'],['Durée de vie moteur',nf(E.life),'km']]
    .map(c=>`<div class="key"><dt>${c[0]}</dt><dd>${c[1]}<small>${c[2]}</small></dd></div>`).join('');
  const b=$('#tabs [data-tab="essais"]');if(b) b.innerHTML='Essais'+(C.issues?`<span class="badge" title="${C.issues} point(s) à voir dans les contrôles">${C.issues}</span>`:'');
}
function renderStage(){
  const draw=$('#stageDraw'),data=$('#stageData');
  if(isCTab(ui.tab)){
    if(!G){setTab('moteur');return;}
    const f=document.activeElement,fid=f&&f.tagName==='INPUT'?f.id:'';draw.innerHTML='';data.innerHTML=careerHTML(ui.tab);
    if(fid&&$('#'+fid)) $('#'+fid).focus({preventScroll:true});
    return;
  }
  if(ui.tab==='moteur'){
    if(!$('#engCv')){
      draw.innerHTML=`<figure class="draw eng"><div class="draw-tools"><div class="seg" role="radiogroup" aria-label="Vue du moteur"><button type="button" role="radio" data-ev="3d" id="ev_3d">3D habillé</button><button type="button" role="radio" data-ev="cut" id="ev_cut">3D écorché</button><button type="button" role="radio" data-ev="2d" id="ev_2d">Coupe 2D</button><button type="button" role="radio" data-ev="cyc" id="ev_cyc">Chambre de combustion</button></div><label class="chip-btn" id="pinLab"><input type="checkbox" id="pinTog"${ui.pins?' checked':''}>Repères</label><button class="chip-btn" id="zoomOut" type="button" aria-label="Dézoomer">−</button><button class="chip-btn" id="zoomIn" type="button" aria-label="Zoomer">+</button></div><div class="eng-view"><canvas id="eng3d" role="img" aria-label="Vue 3D du moteur et de ses périphériques"></canvas><div id="engPins" aria-hidden="true"></div><canvas id="engCv" role="img" aria-label="Coupe animée du moteur"></canvas></div><div id="cycBar" hidden><div class="seg" role="group" aria-label="Temps du cycle">${CYC_N.map((n,i)=>`<button type="button" data-ph="${i}">${i+1}. ${n}</button>`).join('')}<button type="button" id="cycPlay">Pause</button></div><p class="leg-desc" id="cycDesc"></p></div><figcaption id="engCap"></figcaption>${benchHTML()}<div id="engLegend"></div></figure>`;
      dispose3D();if(!init3D($('#eng3d'))) ui.eview='2d';
      setEngView();
    }
    if(E3&&E3.sig!==engSig()) build3D();
    $('#engCap').textContent=`${M.E.c.full} · ${nf(M.E.L,1)} l · ${VT[S.valvetrain].n.replace(/^./,c=>c.toLocaleLowerCase())}`;
    data.innerHTML=engineData();
    const E=M.E;
    wireCross($('#dyno'),E.curve.map(p=>p.rpm),[E.curve.map(p=>p.tq),E.curve.map(p=>p.pw)],i=>`<b>${nf(E.curve[i].rpm)} tr/min</b> · ${nf(E.curve[i].tq)} Nm · ${nf(E.curve[i].pw)} ch`,$('#dynoRead'));
    ui.rpm=clamp(ui.rpm||M.E.idle,M.E.idle,M.E.limiter);benchUpdate();engFrame();kickEngine();
  }else if(ui.tab==='essais'){
    run=null;cruise=null;draw.innerHTML='';data.innerHTML=essaisHTML();runChart(400);cruiseUI();updBroken();
    const tr=M.C.trace;let end=tr.findIndex(p=>p.x>=400);if(end<0) end=tr.length-1;
    wireCross($('#runCh'),tr.slice(0,end+1).map(q=>q.t),[tr.slice(0,end+1).map(q=>q.v)],i=>`<b>${nf(tr[i].t,2)} s</b> · ${nf(tr[i].v)} km/h · ${tr[i].g+1}${tr[i].g?'e':'re'} · ${nf(tr[i].x)} m`,$('#runRead'));
  }else{
    draw.innerHTML=carFigure();data.innerHTML=stageData();
    if(ui.tab==='transmission'){
      const C=M.C,n=C.gears.length,vTop=C.vAt(M.E.limiter,n-1),xs=[],ys=[],gs=[];
      for(let i=0;i<=80;i++){const v=vTop*i/80;let g=0;while(g<n-1&&v>C.vAt(C.shiftRpm[g],g)) g++;xs.push(v);ys.push(Math.max(g===0?C.launch:0,v/C.vAt(1000,g)*1000));gs.push(g);}
      wireCross($('#gearCh'),xs,[ys],i=>`<b>${nf(xs[i])} km/h</b> · ${C.cvt?'':`${gs[i]+1}${gs[i]?'e':'re'} · `}${nf(ys[i],-2)} tr/min`,$('#gearRead'));
    }
  }
}
let saveT=0;
function render(){
  sanitize();if(ERA){eraFix();sanitize();}
  if(!S.injSize||!S.ecuIdle){const fresh=!S.injSize;if(fresh&&!FUEL[S.fuel].diesel) S.ecuFuel=S.fuel;const E0=computeEngine(Object.assign({},S,{injSize:1e6,ecuIdle:0,fuelPress:3}));if(fresh) S.injSize=clamp(Math.round(E0.injNeed*1.25/10)*10,60,3000);if(!S.ecuIdle) S.ecuIdle=E0.idle0;}
  M.E=computeEngine(S);if(!S.oilInt){S.oilInt=M.E.oilRec;M.E=computeEngine(S);}M.C=computeCar(S,M.E);
  renderKeys();renderStage();for(const f of ctlUpd) f();
  clearTimeout(saveT);saveT=setTimeout(saveDesign,400);
}
function saveDesign(){if(G){saveGame();return;}try{localStorage.setItem('bea.design.v1',JSON.stringify(S));}catch(e){}}
function setTab(t,fromHash){
  if(!TABS.some(x=>x[0]===t)) t='moteur';
  ui.tab=t;run=null;cruise=null;ui.sweep=null;dispose3D();if(AU) audioSet({rpm:M.E?M.E.idle:900,ld:0,pr:1},false);
  for(const b of $$('#tabs .tab')){b.setAttribute('aria-selected',b.dataset.tab===t?'true':'false');if(b.dataset.tab===t) b.classList.remove('ping');}
  const full=t==='essais'||isCTab(t);
  $('#board').classList.toggle('full',full);$('#controls').hidden=full;$('#keys').hidden=isCTab(t);
  $('#stageDraw').innerHTML='';$('#stageData').innerHTML='';
  buildControls();render();
  if(!fromHash){try{history.replaceState(null,'','#'+t);}catch(e){try{location.hash=t;}catch(e2){}}}
}
function applyPreset(k){
  const p=PRESETS[k];if(!p) return;
  for(const key of Object.keys(S)) delete S[key];
  Object.assign(S,DEF,p.s,{preset:k});S.injSize=0;S.ecuIdle=0;ui.broken=null;ui.dmg={};
  $('#projName').value=S.name;engTheta=.7;
  buildControls();render();
}
function init(){
  readTheme();
  renderTabs();
  $('#preset').innerHTML=Object.entries(PRESETS).map(([k,p])=>`<option value="${k}">${p.label}</option>`).join('');
  $('#preset').value=PRESETS[S.preset]?S.preset:'coupe';
  $('#projName').value=S.name||'';
  $('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b) setTab(b.dataset.tab);});
  $('#preset').addEventListener('change',e=>applyPreset(e.target.value));
  $('#projName').addEventListener('input',e=>{S.name=e.target.value;if(ui.tab==='essais'&&$('#fiche')) $('#fiche').textContent=fiche();clearTimeout(saveT);saveT=setTimeout(saveDesign,400);});
  $('#stage').addEventListener('change',e=>{if(e.target.id==='cutTog'){ui.cut=e.target.checked;renderStage();}else if(e.target.id==='pinTog'){ui.pins=e.target.checked;setEngView();engFrame();}else if(e.target.id==='animTog'){ui.noAnim=!e.target.checked;if(ui.tab==='moteur') kickEngine();}else if(e.target.id==='sndTog'){if(!setSound(e.target.checked)) e.target.checked=false;if(ui.tab==='moteur') kickEngine();else audioSet({rpm:M.E.idle,ld:0,pr:1},ui.snd);}else if(e.target.id==='thermTog'){ui.therm=e.target.checked;benchUpdate();engFrame();}});
  $('#stage').addEventListener('input',e=>{if(e.target.id==='cruiseV'){ui.cruiseV=+e.target.value;cruiseUI();return;}if(e.target.id==='benchRpm'){ui.sweep=null;ui.rpm=+e.target.value;benchUpdate();kickEngine();}else if(e.target.id==='benchLoad'){ui.sweep=null;ui.load=+e.target.value;benchUpdate();kickEngine();}});
  const hov=e=>{const b=e.target.closest&&e.target.closest('#engLegend [data-pi]');if(E3&&b) mark3D(e.type==='mouseout'||e.type==='focusout'?null:E3.shown[+b.dataset.pi]);};
  for(const ev of ['mouseover','mouseout','focusin','focusout']) $('#stage').addEventListener(ev,hov);
  $('#stage').addEventListener('click',e=>{
    const id=e.target.id;
    const evb=e.target.closest('[data-ev]'),lg=e.target.closest('#engLegend [data-pi]');
    if(evb){ui.eview=evb.dataset.ev;setEngView();engFrame();kickEngine();return;}
    if(lg&&E3){const p=E3.shown[+lg.dataset.pi];ui.sel=ui.sel===p.name?null:p.name;mark3D(null);return;}
    if(id==='zoomIn'||id==='zoomOut'){ui.zoom=clamp(ui.zoom*(id==='zoomIn'?1.25:.8),.5,4);engFrame();return;}
    const bq=e.target.closest('[data-bq]');
    const fb=e.target.closest('[data-fault]');
    if(fb){ui.faults[fb.dataset.fault]=!ui.faults[fb.dataset.fault];render();return;}
    if(e.target.closest('[data-repair]')){ui.broken=null;ui.dmg={};ui.T=null;renderKeys();updBroken();if(ui.tab==='moteur') benchUpdate();else $('#runMsg').textContent='Réparé : prêt pour un nouvel essai.';return;}
    if(ui.broken&&((ui.broken.k!=='gearbox'&&(e.target.closest('[data-bq]')||['benchRun','benchSweep'].includes(id)))||['run400','run1000'].includes(id)||(id==='cruiseGo'&&!cruise))){flashBroken();return;}
    if(id==='faultFix'){ui.faults={};render();return;}
    if(id==='cruiseGo'){if(cruise) stopCruise();else startCruise();return;}
    const cph=e.target.closest('#cycBar [data-ph]');
    if(cph){ui.cyc=+cph.dataset.ph*Math.PI+.02;engFrame();kickEngine();return;}
    if(id==='cycPlay'){ui.cycPlay=!ui.cycPlay;e.target.textContent=ui.cycPlay?'Pause':'Lecture';kickEngine();return;}
    if(id==='benchSweep'){if(ui.sweep) ui.sweep=null;else{ui.run=true;ui.rpm=M.E.idle;ui.load=100;ui.sweep={ph:0,t:0,t1:0,bf:0,cut:false};}benchUpdate();kickEngine();return;}
    if(bq){const E=M.E,q=bq.dataset.bq;ui.sweep=null;ui.run=true;ui.rpm=q==='idle'?E.idle:q==='tq'?E.peakTrpm:q==='pw'?E.peakPrpm:E.limiter;ui.load=q==='idle'?0:100;benchUpdate();kickEngine();return;}
    if(id==='benchRun'){ui.sweep=null;ui.run=!ui.run;if(ui.run&&!ui.rpm) ui.rpm=M.E.idle;benchUpdate();kickEngine();}
    else if(id==='run400') startRun(400);
    else if(id==='run1000') startRun(1000);
    else if(id==='copyFiche'){
      const txt=fiche(),msg=$('#copyMsg'),sel=()=>{const r=document.createRange();r.selectNodeContents($('#fiche'));const s=getSelection();s.removeAllRanges();s.addRange(r);msg.textContent='Copie refusée par le navigateur : le texte est sélectionné, copiez-le avec Ctrl+C.';};
      try{navigator.clipboard.writeText(txt).then(()=>{msg.textContent='Fiche copiée.';},sel);}catch(err){sel();}
    }
  });
  window.addEventListener('hashchange',()=>{const t=location.hash.slice(1);if(t&&t!==ui.tab&&TABS.some(x=>x[0]===t)) setTab(t,true);});
  const mq=matchMedia('(prefers-color-scheme: dark)'),th=()=>{readTheme();engFrame();};
  if(mq.addEventListener) mq.addEventListener('change',th);
  new MutationObserver(th).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  const unlock=()=>{if(ui.snd&&AU&&AU.ctx.state!=='running'){try{AU.ctx.resume();}catch(e){}}};
  for(const ev of ['pointerdown','touchend','keydown']) document.addEventListener(ev,unlock,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(AU){try{document.hidden?AU.ctx.suspend():(ui.snd&&AU.ctx.resume());}catch(e){}}if(!document.hidden) kickEngine();});
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{setKeysH();engFrame();});
  let lastW=0;
  const setKeysH=()=>document.documentElement.style.setProperty('--keys-h',$('#keys').offsetHeight+'px');
  if(window.ResizeObserver) new ResizeObserver(()=>{const w=$('#stage').clientWidth;setKeysH();if(Math.abs(w-lastW)>6){lastW=w;if(M.E&&!run) renderStage();}}).observe($('#stage'));
  setTab('moteur',true);
  lastW=$('#stage').clientWidth;setKeysH();
  showHome();
}
function start(d){
  try{const raw=localStorage.getItem('bea.design.v1');if(raw){const sv=JSON.parse(raw);for(const k of Object.keys(DEF)) if(typeof sv[k]===typeof DEF[k]) S[k]=sv[k];}}catch(e){}
  if(d&&d.S) for(const k of Object.keys(DEF)) if(typeof d.S[k]===typeof DEF[k]) S[k]=d.S[k];
  if(d&&d.tab) ui.tab=d.tab;
  init();
}
window.__bea={S,M,applyPreset,setTab,render:()=>render(),get G(){return G;},advance,get au(){return AU;},get e3(){return E3;}};
window.claude?.hot?.snapshot?.(()=>({S:Object.assign({},S),tab:ui.tab}));
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});
