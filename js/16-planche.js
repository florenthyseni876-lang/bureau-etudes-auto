'use strict';
/* ───────────── Planche : contenu par onglet ───────────── */
function engineData(){
  const E=M.E,w=chartW(),xt=[];
  for(let v=1000;v<=E.limiter;v+=(w<430?2000:1000)) xt.push(v);
  const aT=niceAxis(E.peakT,4),aP=niceAxis(E.peakP,4);
  const mk=(pts,key,col,ax,aria,mark)=>lineChart({w,h:168,x0:1000,x1:E.limiter,y1:ax.top,yt:ax.t,xt,col,aria,pts:pts.map(p=>[p.rpm,p[key]]),marks:[mark]});
  let rows='';for(const p of E.curve) if(p.rpm%500===0) rows+=`<tr><td>${nf(p.rpm)}</td><td>${nf(p.tq)}</td><td>${nf(p.pw)}</td></tr>`;
  return `<div class="data">
  ${facts([['Cylindrée',nf(E.disp),'cm³'],['Puissance maxi',nf(E.peakP),`ch à ${nf(E.peakPrpm)}`],['Couple maxi',nf(E.peakT),`Nm à ${nf(E.peakTrpm)}`],['Puissance au litre',nf(E.peakP/E.L),'ch/l'],['PME maxi',nf(E.bmepMax,1),'bar'],['Rendement maxi',nf(E.etaB*100,1),'%'],['Masse moteur',nf(E.mass),'kg'],['Distribution',nf(E.tmMass,1),`kg · ${TIMING[S.timing].n.replace(/^./,x=>x.toLocaleLowerCase())}`],['Prix de revient',nf(Math.round(E.cost/10)*10),'€']])}
  ${meters([['Fiabilité',E.rel],['Agrément',E.agr],['Douceur',E.smooth],['Sonorité',E.sound]])}
  ${diagHTML()}
  ${lifeHTML()}
  <div>
    <div class="chart-h"><h3>Passage au banc</h3><p class="ch-read" id="dynoRead">Survolez les courbes pour lire un régime</p></div>
    <div class="charts" id="dyno" aria-label="Courbes de couple et de puissance. Flèches gauche et droite pour parcourir les régimes.">
      <div><div class="chart-h"><h4><i style="background:var(--s1)"></i>Couple (Nm) selon le régime (tr/min)</h4></div>${mk(E.curve,'tq','s1',aT,'Courbe de couple',{x:E.peakTrpm,y:E.peakT,label:`${nf(E.peakT)} Nm`})}</div>
      <div><div class="chart-h"><h4><i style="background:var(--s2)"></i>Puissance (ch) selon le régime (tr/min)</h4></div>${mk(E.curve,'pw','s2',aP,'Courbe de puissance',{x:E.peakPrpm,y:E.peakP,label:`${nf(E.peakP)} ch`})}</div>
    </div>
    <details class="tbl"><summary>Tableau des valeurs</summary><div class="tbl-wrap"><table><thead><tr><th>Régime (tr/min)</th><th>Couple (Nm)</th><th>Puissance (ch)</th></tr></thead><tbody>${rows}</tbody></table></div></details>
  </div></div>`;
}
function gearData(){
  const C=M.C,E=M.E,w=chartW(),n=C.gears.length,lim=E.limiter;
  const vTop=C.vAt(lim,n-1),ax=niceAxis(vTop,w<430?4:6),ay=niceAxis(lim,4);
  const path=[[0,C.launch]],xs=[],ys=[],gs=[];
  let v0=C.vAt(C.launch,0);path.push([v0,C.launch]);
  for(let g=0;g<n;g++){const vS=C.vAt(C.shiftRpm[g],g);path.push([vS,C.shiftRpm[g]]);if(g<n-1) path.push([vS,C.shiftRpm[g]*C.gears[g+1]/C.gears[g]]);}
  for(let v=0;v<=vTop;v+=vTop/80){let g=0;while(g<n-1&&v>C.vAt(C.shiftRpm[g],g)) g++;xs.push(v);ys.push(Math.max(C.launch*(g===0?1:0),v/C.vAt(1000,g)*1000));gs.push(g);}
  const svg=lineChart({w,h:210,x0:0,x1:ax.top,y1:ay.top,yt:ay.t,xt:ax.t,col:'s1',area:false,aria:'Diagramme en dents de scie : régime selon la vitesse dans chaque rapport',pts:path,
    extra:(X,Y)=>C.gears.map((_,g)=>{const vl=C.vAt(lim,g);return `<path class="ch-ref" d="M${X(0)} ${Y(0)}L${X(vl)} ${Y(lim)}"/>${C.cvt?'':`<text class="ch-lab" x="${X(vl)}" y="${Y(lim)-6}" text-anchor="middle">${g+1}</text>`}`;}).join('')});
  let rows='';C.gears.forEach((gr,g)=>{if(C.cvt&&g>0&&g<n-1) return;rows+=`<tr><td>${C.cvt?(g?'Le plus long':'Le plus court'):(g+1)+(g===0?'re':'e')}</td><td>${nf(gr,2)}</td><td>${nf(gr*S.final,2)}</td><td>${nf(C.vAt(1000,g),1)}</td><td>${nf(C.vAt(lim,g))}</td></tr>`;});
  return `<div class="data">
  ${facts([['Vitesse maxi',nf(C.vmax),C.cvt?'km/h':`km/h en ${C.vg+1}${C.vg?'e':'re'}`],['Rendement',nf(C.etaD*100,1),'%'],['Croisière à 130',nf(130/C.vAt(1000,n-1)*1000,-2),C.cvt?'tr/min au plus long':`tr/min en ${n}e`],['0–100 km/h',C.t100?nf(C.t100,1):'—','s'],['Régime de départ',nf(C.launch,-2),'tr/min'],['Roues motrices',DRV[S.drive],'']])}
  <div>
    <div class="chart-h"><h3>Étagement</h3><p class="ch-read" id="gearRead">Régime (tr/min) selon la vitesse (km/h) · trait épais : accélération à fond</p></div>
    <div class="charts" id="gearCh" aria-label="Diagramme d'étagement. Flèches gauche et droite pour parcourir les vitesses.">${svg}</div>
  </div>
  <div class="tbl-wrap"><table><thead><tr><th>Rapport</th><th>Démult.</th><th>Avec pont</th><th>km/h à 1 000 tr/min</th><th>km/h au rupteur</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function stageData(){
  const C=M.C,E=M.E,B=BODY[S.body],t=ui.tab;
  if(t==='carrosserie') return `<div class="data">${facts([['Longueur × largeur',`${nf(B.L)} × ${nf(B.W)}`,'mm'],['Hauteur',nf(B.H+S.gc-B.gc0),'mm'],['Empattement',nf(B.WB),'mm'],['Cx',nf(C.cd,2),''],['SCx',nf(C.CdA,2),'m²'],['Masse à vide',nf(C.mass),'kg'],['Répartition AV/AR',`${nf(C.fw*100)}/${nf(100-C.fw*100)}`,'%'],[C.down200>=0?'Appui à 200 km/h':'Portance à 200 km/h',nf(Math.abs(C.down200)),'kg'],['Centre de gravité',nf(C.h*1000),'mm'],['Coffre',nf(C.cargo,-1),'l'],['Compartiment moteur',`${nf(C.fit.max)} × ${nf(C.fit.maxW)}`,'mm']])}
    ${meters([['Rigidité',CHAS[S.chassis].rig],['Sécurité',C.safety],['Praticité',C.pract]])}</div>`;
  if(t==='transmission') return gearData();
  if(t==='trains') return `<div class="data">${facts([['Adhérence latérale',nf(C.gLat,2),'g'],['Avec appui à 150',nf(C.gAero,2),'g'],['Freinage 100–0',nf(C.brake100,1),'m'],['Pneus',C.tireStr,''],['Diamètre de roue',nf(C.od),`mm (maxi ${nf(B.tireMax)})`],['Disque maxi',nf(C.discMax),`mm en ${S.rim}"`],['Garde au sol',nf(S.gc),'mm'],['Masse à vide',nf(C.mass),'kg']])}
    <div><h3>Équilibre en virage</h3><div class="gauge" role="img" aria-label="Équilibre : ${C.bal<-4?'survireur':C.bal>9?'sous-vireur':'neutre à légèrement sous-vireur'}"><i style="left:${(50+C.bal/30*50).toFixed(1)}%"></i></div><div class="gauge-l"><span>Survireur</span><span>Neutre</span><span>Sous-vireur</span></div></div>
    ${meters([['Tenue de route',C.handling],['Confort',C.comfort],['Endurance freins',C.fade],['Tout-terrain',C.off]])}</div>`;
  if(t==='habitacle') return `<div class="data">${facts([['Places',S.seats,''],['Coffre',nf(C.cargo,-1),'l'],['Masse habitacle',nf(C.parts.habitacle+C.parts.securite),'kg'],['Coût habitacle',nf(Math.round((C.costs['Habitacle']+C.costs['Sécurité et aides'])/10)*10),'€'],['Masse à vide',nf(C.mass),'kg'],['Prix estimé',nf(Math.round(C.price/100)*100),'€']])}
    ${meters([['Confort',C.comfort],['Sécurité',C.safety],['Praticité',C.pract],['Prestige',C.prest],['Silence',100-E.noise]])}</div>`;
  return '';
}
function carFigure(){
  const B=BODY[S.body],cut=ui.tab==='transmission'||ui.cut,pxw=($('#stageDraw').clientWidth||620)-28;
  return `<figure class="draw"><div class="draw-tools"><label class="chip-btn"><input type="checkbox" id="cutTog"${cut?' checked':''}${ui.tab==='transmission'?' disabled':''}>Écorché</label></div>${carSVG({cut,dims:true,pxw,id:'c'})}<figcaption>${B.n} ${B.d} · moteur ${POS[S.enginePos].n.replace(/^./,c=>c.toLocaleLowerCase())} · ${DRV[S.drive].replace(/^./,c=>c.toLocaleLowerCase())} · cotes en mm${cut?' · en pointillé : moteur, boîte, arbre, réservoir ; roues motrices cerclées':''}</figcaption></figure>`;
}
