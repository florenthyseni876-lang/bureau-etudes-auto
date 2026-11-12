'use strict';
/* ───────────── Essais ───────────── */
let run=null;
function fiche(){
  const C=M.C,E=M.E,B=BODY[S.body],asp={na:'atmosphérique',turbo:`turbo ${nf(S.boost,2)} bar`,biturbo:`biturbo ${nf(S.boost,2)} bar`,tri:`triturbo ${STAGE[S.turboStage].n.replace(/^./,x=>x.toLocaleLowerCase())} ${nf(S.boost,2)} bar`,quad:`quadriturbo ${STAGE[S.turboStage].n.replace(/^./,x=>x.toLocaleLowerCase())} ${nf(S.boost,2)} bar`,sc:`compresseur ${nf(S.boost,2)} bar`}[S.aspiration];
  return [
   `${(S.name||'Prototype').toUpperCase()} · FICHE TECHNIQUE`,
   `Moteur        ${E.c.full}, ${nf(E.disp)} cm³ (${nf(S.bore,1)} × ${nf(S.stroke,1)} mm), ${VT[S.valvetrain].n.replace(/^./,c=>c.toLocaleLowerCase())}, distribution par ${TIMING[S.timing].n.replace(/^./,c=>c.toLocaleLowerCase())}, ${asp}, ${FS[S.fuelSys].n.replace(/^./,c=>c.toLocaleLowerCase())}, ${FUEL[S.fuel].n}`,
   `Puissance     ${nf(E.peakP)} ch à ${nf(E.peakPrpm)} tr/min · couple ${nf(E.peakT)} Nm à ${nf(E.peakTrpm)} tr/min`,
   `Transmission  ${DRV[S.drive].replace(/^./,c=>c.toLocaleLowerCase())}, boîte ${GBX[S.gearbox].n.replace(/^./,c=>c.toLocaleLowerCase())}${C.cvt?'':` ${C.gears.length} rapports`}${GEARSETS[S.gearSet]?` (${GEARSETS[S.gearSet].n.split(' · ')[0]})`:''}, moteur ${POS[S.enginePos].n.replace(/^./,c=>c.toLocaleLowerCase())}`,
   `Caisse        ${B.n} ${B.d}, ${CHAS[S.chassis].n.replace(/^./,c=>c.toLocaleLowerCase())}, panneaux ${PANEL[S.panels].n.replace(/^./,c=>c.toLocaleLowerCase())} · ${nf(B.L)} × ${nf(B.W)} × ${nf(B.H+S.gc-B.gc0)} mm`,
   `Trains        ${SUSP[S.suspF].n} / ${SUSP[S.suspR].n} · pneus ${C.tireStr} · freins ${BRK[S.brakeF].n.replace(/^./,c=>c.toLocaleLowerCase())} ${S.brakeFd} mm / ${BRK[S.brakeR].n.replace(/^./,c=>c.toLocaleLowerCase())} ${S.brakeRd} mm`,
   `Masse         ${nf(C.mass)} kg à vide (${nf(C.fw*100)}/${nf(100-C.fw*100)}) · ${nf(C.pwr)} ch/t · Cx ${nf(C.cd,2)} · SCx ${nf(C.CdA,2)} m²`,
   `Performances  0–100 km/h ${C.t100?nf(C.t100,1)+' s':'non atteint'} · 400 m D.A. ${C.t400?nf(C.t400,1)+' s':'—'} · V max ${nf(C.vmax)} km/h · 100–0 km/h ${nf(C.brake100,1)} m · ${nf(C.gLat,2)} g`,
   `Consommation  ${nf(C.conso.mix,1)} l/100 km en mixte · CO₂ ${nf(C.co2)} g/km · autonomie ${nf(C.range,-1)} km`,
   `Entretien     moteur prévu pour ${nf(E.life)} km · ${nf(Math.round(E.mYear/10)*10)} € par an (${nf(E.kmY)} km) · vidange tous les ${nf(E.oilInt)} km`,
   `Prix estimé   ${nf(Math.round(C.price/100)*100)} €`,
  ].join('\n');
}
function essaisHTML(){
  const C=M.C,E=M.E,pxw=Math.min(470,($('#stage').clientWidth||700)*.64);
  const perf=[['0–100 km/h',C.t100?nf(C.t100,1)+' s':'non atteint'],['0–200 km/h',C.t200?nf(C.t200,1)+' s':'non atteint'],['80–120 km/h',C.t80&&C.t120?nf(C.t120-C.t80,1)+' s':'—'],['400 m départ arrêté',C.t400?`${nf(C.t400,1)} s à ${nf(C.v400)} km/h`:'—'],['1 000 m départ arrêté',C.t1000?`${nf(C.t1000,1)} s à ${nf(C.v1000)} km/h`:'—'],['Vitesse maxi',`${nf(C.vmax)} km/h`],['Freinage 100–0 km/h',`${nf(C.brake100,1)} m`],['Adhérence latérale',`${nf(C.gLat,2)} g`],['Rapport poids/puissance',`${nf(C.mass/E.peakP,1)} kg/ch`],['Consommation ville',`${nf(C.conso.urb,1)} l/100 km`],['Consommation route',`${nf(C.conso.road,1)} l/100 km`],['Consommation autoroute',`${nf(C.conso.hwy,1)} l/100 km`],['Consommation mixte',`${nf(C.conso.mix,1)} l/100 km`],['CO₂',`${nf(C.co2)} g/km`],['Autonomie',`${nf(C.range,-1)} km`]];
  const maxC=Math.max(...Object.values(C.costs));
  const lv={ok:['chk-ok','✓','Conforme'],warn:['chk-warn','!','À surveiller'],crit:['chk-crit','✕','Bloquant']};
  const order={crit:0,warn:1,ok:2},checks=[...C.checks].sort((a,b)=>order[a.lv]-order[b.lv]);
  const crit=C.checks.filter(k=>k.lv==='crit').length;
  return `<div class="essais">
  <div class="card wide"><h3>Piste d'essai</h3>
    <div><div class="road" id="road">${carSVG({cut:false,dims:false,pxw,id:'r'})}</div>
    <div class="brk-box"></div><dl class="hud"><div><dt class="cell-l">Temps</dt><dd id="hT">0,00<small>s</small></dd></div><div><dt class="cell-l">Vitesse</dt><dd id="hV">0<small>km/h</small></dd></div><div><dt class="cell-l">Rapport</dt><dd id="hG">1</dd></div><div><dt class="cell-l">Régime</dt><dd id="hR">${nf(E.idle)}<small>tr/min</small></dd><div class="rev"><i id="hRb"></i></div></div><div><dt class="cell-l">Distance</dt><dd id="hX">0<small>m</small></dd></div></dl></div>
    <div class="run-ctl"><button class="btn" id="run400" type="button">Lancer le 400 m</button><button class="btn ghost" id="run1000" type="button">Lancer le 1 000 m</button><label class="chip-btn"><input type="checkbox" id="sndTog"${ui.snd?' checked':''}>Son</label><label class="chip-btn"><input type="checkbox" id="animTog"${ui.noAnim?'':' checked'}>Animations</label><p class="run-msg" id="runMsg">Départ arrêté, pied au plancher, en temps réel.</p></div>
    <div class="run-ctl"><button class="btn ghost" id="cruiseGo" type="button">Rouler à vitesse stabilisée</button><div class="f cruise-f"><div class="f-top"><label for="cruiseV">Vitesse visée</label><output id="cruiseVO" for="cruiseV"></output></div><input type="range" id="cruiseV" min="30" max="300" step="5"></div></div>
    <div><div class="chart-h"><h4><i style="background:var(--s1)"></i>Vitesse (km/h) selon le temps (s)</h4><p class="ch-read" id="runRead"></p></div><div class="charts" id="runCh"></div></div>
  </div>
  <div class="card"><h3>Mesures</h3><div class="tbl-wrap"><table><tbody>${perf.map(p=>`<tr><td>${p[0]}</td><td>${p[1]}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>À quel usage convient-elle ?</h3>
    <p class="verdict">${crit?`${crit} point${crit>1?'s':''} bloquant${crit>1?'s':''} empêche${crit>1?'nt':''} la mise en production : voyez les contrôles ci-dessous.`:`Ce véhicule se place le mieux en <b>${C.best[0].replace(/^./,c=>c.toLocaleLowerCase())}</b>, avec ${nf(C.best[1])} points sur 100.`}</p>
    ${meters(Object.entries(C.seg).map(([k,v])=>[k,v,k===C.best[0]]))}
    <h3 style="margin-top:8px">Prix de revient</h3>
    <div class="costs">${Object.entries(C.costs).map(([k,v])=>`<div class="cost"><span>${k}</span><span class="m-bar"><i style="width:${(v/maxC*100).toFixed(0)}%"></i></span><span class="m-v">${nf(Math.round(v/10)*10)} €</span></div>`).join('')}
    <div class="cost-total"><span>Total fabrication</span><span>${nf(Math.round(C.cost/10)*10)} €</span></div><div class="cost-total" style="border-top:0;padding-top:0"><span>Prix de vente estimé (marge 25 %)</span><span>${nf(Math.round(C.price/100)*100)} €</span></div></div>
  </div>
  <div class="card"><h3>Contrôles du bureau d'études</h3><ul class="checks">${checks.map(k=>`<li class="chk ${lv[k.lv][0]}"><span class="chk-i" aria-hidden="true">${lv[k.lv][1]}</span><div><b>${k.t}</b><p>${k.d}</p></div><span class="chk-s">${lv[k.lv][2]}</span></li>`).join('')}</ul></div>
  <div class="card wide"><h3>Fiche technique</h3><pre class="fiche" id="fiche">${fiche().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre><div class="run-ctl"><button class="btn ghost" id="copyFiche" type="button">Copier la fiche</button><p class="run-msg" id="copyMsg"></p></div></div>
  </div>`;
}
function runChart(dist,upto){
  const tr=M.C.trace;let end=tr.findIndex(p=>p.x>=dist);if(end<0) end=tr.length-1;
  const w=clamp(($('#runCh').clientWidth||600),260,1200),ax=niceAxis(tr[end].t,w<430?4:8),ay=niceAxis(tr[end].v,4);
  const pts=tr.slice(0,(upto==null?end:upto)+1).map(p=>[p.t,p.v]),marks=[];
  if(upto==null&&M.C.t100&&M.C.t100<=tr[end].t) marks.push({x:M.C.t100,y:100,end:true,label:`100 km/h en ${nf(M.C.t100,1)} s`});
  $('#runCh').innerHTML=lineChart({w,h:190,x0:0,x1:ax.top,y1:ay.top,yt:ay.t,xt:ax.t,col:'s1',aria:'Vitesse selon le temps pendant le départ arrêté',pts:pts.length>1?pts:[[0,0],[0.001,0]],marks});
  return end;
}
function hud(p){
  $('#hT').firstChild.nodeValue=nf(p.t,2);$('#hV').firstChild.nodeValue=nf(p.v);$('#hG').textContent=M.C.cvt?'CVT':p.g+1;$('#hR').firstChild.nodeValue=nf(p.rpm,-2);$('#hX').firstChild.nodeValue=nf(p.x);
  const hx=$('#hX');if(p.x>=10000){hx.firstChild.nodeValue=nf(p.x/1000,1);hx.lastChild.textContent='km';}else hx.lastChild.textContent='m';
  $('#hRb').style.width=(p.rpm/M.E.limiter*100).toFixed(1)+'%';
}
function finishRun(dist,end,rb){
  const tr=M.C.trace,p=tr[end],C=M.C;
  hud(p);runChart(dist,rb&&rb.k?end:null);if(rb) ui.dmg=rb.d;audioSet({rpm:M.E.idle,ld:0,pr:1},true);
  const xs=tr.slice(0,end+1).map(q=>q.t),ys=tr.slice(0,end+1).map(q=>q.v);
  $('#runRead').innerHTML='';
  wireCross($('#runCh'),xs,[ys],i=>`<b>${nf(tr[i].t,2)} s</b> · ${nf(tr[i].v)} km/h · ${tr[i].g+1}${tr[i].g?'e':'re'} · ${nf(tr[i].x)} m`,$('#runRead'));
  const tt=dist===400?C.t400:C.t1000,vv=dist===400?C.v400:C.v1000;
  if(rb&&rb.k){$('#runMsg').textContent=`Casse à ${nf(p.v)} km/h et ${nf(p.rpm,-1)} tr/min, après ${nf(p.t,1)} s et ${nf(p.x)} m.`;breakEngine(rb.k,{where:'essai',rpm:p.rpm,v:p.v});return;}
  const fat=fatigue();
  $('#runMsg').textContent=(tt?`${nf(dist)} m en ${nf(tt,2)} s, à ${nf(vv)} km/h au passage de la ligne.`:`Le véhicule n'a pas bouclé les ${nf(dist)} m en une minute.`)+(fat.v>.02?` Fatigue accumulée : ${nf(fat.v*100)} % (${lc(FAILS[fat.k].n)}).`:'');
}
function startRun(dist){
  const road=$('#road');if(!road) return;
  if(ui.broken){flashBroken();return;}
  if(cruise){cruise=null;cruiseUI();}
  let end=runChart(dist,0);const tr=M.C.trace,rb=runBreak(end);if(rb.k) end=rb.i;
  if(reduced()){run=null;finishRun(dist,end,rb);return;}
  const svg=road.querySelector('svg.car'),vb=svg.viewBox.baseVal,ppm=svg.getBoundingClientRect().width/(vb.width/1000);
  run={t0:performance.now(),dist,end,ppm,wheels:$$('.wheel',svg),line:null,last:-1,brk:rb};
  $('#runMsg').textContent='Essai en cours…';$('#runRead').innerHTML='';
  requestAnimationFrame(stepRun);
}
function stepRun(now){
  if(!run||ui.tab!=='essais'||!$('#road')){run=null;return;}
  const tr=M.C.trace,i=Math.min(run.end,Math.floor((now-run.t0)/1000/.05)),p=tr[i];
  if(i!==run.last){
    run.last=i;hud(p);audioSet({rpm:p.rpm,ld:1,pr:M.E.prAt(p.rpm)},true);
    const road=$('#road'),off=p.x*run.ppm;
    road.style.setProperty('--rx',(off%140).toFixed(1)+'px');road.style.setProperty('--rx2',(off*.6%700).toFixed(1)+'px');
    const ang=-(p.x/M.C.r)*180/Math.PI%360;for(const wl of run.wheels) wl.style.transform=`rotate(${ang.toFixed(1)}deg)`;
    const sv=$('#runCh svg');
    if(sv){const d=sv.dataset;let path='';for(let k=0;k<=i;k+=1){const q=tr[k];path+=(k?'L':'M')+(+d.l+(q.t-d.x0)/(d.x1-d.x0)*d.pw).toFixed(1)+' '+(+d.b-q.v/d.y1*d.ph).toFixed(1);}sv.querySelector('.ch-line').setAttribute('d',path);}
  }
  if(i>=run.end){const d=run.dist,e=run.end,rb=run.brk;run=null;finishRun(d,e,rb);}
  else requestAnimationFrame(stepRun);
}
