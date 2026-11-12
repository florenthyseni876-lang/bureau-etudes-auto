'use strict';
/* ───────────── Banc d'essai moteur ───────────── */
const HEATMAP=[['Bloc','block'],["Carter d'huile",'oil'],['Culasse','head'],['Couvre','cover'],['Carter de distribution','cover'],['Carters de rotor','head'],['Flasques','block'],['Rotors','pist'],['Carter avant','cover'],['Collecteur d\'éch','man'],['Collecteurs d\'éch','man'],['Turbo','turbo'],['Ligne','pipe'],['Catalyseur','cat'],['Sonde','pipe'],["Collecteur d'adm",'intake'],['Compresseur vol','charge'],["Tuyau d'air",'charge'],['Échangeur','ic'],['Filtre à huile','oil'],['Huile moteur','oil'],['Boîtier de thermostat','water'],['Pompe à eau','water'],['Pistons','pist'],['Bougies','head'],['Bobines','cover']];
const TAU={egt:.6,man:3,turbo:4,cat:7,pipe:4,head:9,cover:11,block:13,oil:13,water:9,intake:5,charge:3,ic:6,amb:9,pist:4};
const RAMP=[[0,[11,7,36]],[.25,[86,16,110]],[.5,[187,55,84]],[.75,[249,140,10]],[1,[252,255,164]]];
const rampU=T=>Math.sqrt(clamp((T-20)/980,0,1));
function rampRGB(T){const u=rampU(T);for(let i=1;i<RAMP.length;i++) if(u<=RAMP[i][0]){const a=RAMP[i-1],b=RAMP[i],t=(u-a[0])/(b[0]-a[0]);return [0,1,2].map(k=>lerp(a[1][k],b[1][k],t)/255);}return RAMP[4][1].map(v=>v/255);}
function benchState(){
  const E=M.E,rpm=clamp(ui.rpm||E.idle,E.idle,E.limiter),ld=ui.load/100,fu=FUEL[S.fuel];
  const bf=ui.sweep?ui.sweep.bf:1,tq=E.tq(rpm,bf)*ld,pw=tq*rpm*Math.PI/30/1000,pr=1+(E.prAt(rpm)-1)*Math.pow(ld,.8)*bf;
  const Pf=(E.fmep(rpm)+E.pumpK*(1-ld))*1e5*E.dispM3*rpm/120/1000,lh=(pw+Pf)/E.etaC/(fu.lhv*1000)*3600;
  const dens=fu.diesel?.835:S.fuel==='e85'?.78:.745,bsfc=pw>2?lh*dens*1000/pw:null;
  const rf=rpm/E.limiter,flow=clamp(rf*(.25+.75*ld)*1.6,0,1),pf=clamp(pw*1.3596/E.peakP,0,1);
  const oil=E.oil,q=E.oilQ,To=ui.T?ui.T.oil:95,nu=Math.exp(Math.log(oil.c)+(Math.log(oil.h)-Math.log(oil.c))*(To-20)/80);
  const pOil=ui.run?E.oilP(rpm,To):0,pReq=E.pReqAt(rpm);
  const egt=E.egtAt(rpm,ld),cH=Math.max(0,(E.fails.cool?E.fails.cool.r:0)-.95)*150*pf;
  const dutyNow=S.fuelSys==='carb'?0:lh*1000/60/E.nInj/E.injFlow*(fu.diesel?1:1);
  const fW=(faultOn('coolant')?55:0)+(faultOn('headgasket')?28:0),fC=(faultOn('misfire')?180*(.3+.7*ld):0)+(faultOn('lambda')?70:0),fE=faultOn('cat')?130*(.3+.7*ld):0;
  const fP=S.pops&&E.ecuOn?45:0;
  const T=ui.run?{egt:egt+fE,man:fE+60+(egt-60)*.8*(.5+.5*flow),turbo:50+(egt-50)*.85*(.5+.5*flow),cat:fP+fC+fE+(S.cat==='none'?egt*.6:250+(egt-250)*.75+(E.dz?30:90)*ld),pipe:40+(egt-40)*.55*(.5+.5*flow),
    head:88+35*pf+fW+cH,cover:80+15*pf+fW*.5,block:86+20*pf+fW*.7+cH*.6,oil:88+45*pf*rf+10*rf+(q<1?(1-q)*45:0)+(q>1.1?(q-1.1)*30:0)+(oil.h-11)*.8,water:86+12*pf+fW+cH,intake:E.boosted?35+(pr-1)*(S.intercooler==='none'?70:22):32,charge:25+(pr-1)*95,ic:28+(pr-1)*40,amb:42,pist:180+130*pf}
    :Object.fromEntries(Object.keys(TAU).map(k=>[k,20]));
  return {rpm,ld,tq,pw,pr,lh,bsfc,T,pOil,pReq,dutyNow};
}
function stepHeat(b,dt){
  if(!ui.T){ui.T=Object.assign({},b.T);return;}
  for(const k of Object.keys(TAU)){const tau=TAU[k]*(ui.run?1:3);ui.T[k]+=(b.T[k]-ui.T[k])*(1-Math.exp(-dt/tau));}
}
function applyHeat(){
  if(!E3||!E3.parts||!ui.T) return;
  for(const p of E3.parts){if(!p.mats) continue;const T=ui.T[p.heat||'amb'];
    for(const m of p.mats){
      if(ui.therm){const c=rampRGB(T);m.color.setRGB(c[0]*.2,c[1]*.2,c[2]*.2);m.emissive.setRGB(c[0],c[1],c[2]);m.emissiveIntensity=.9;m.metalness=0;}
      else{m.color.copy(m.userData.c0);m.metalness=m.userData.me;const t=clamp((T-470)/480,0,1);if(t<=0){m.emissive.setRGB(0,0,0);m.emissiveIntensity=1;}else{m.color.multiplyScalar(1-.9*Math.min(1,t*1.5));m.emissive.setRGB(lerp(.45,1,Math.min(1,t*1.6)),lerp(.01,.22,t*t),0);m.emissiveIntensity=.5+t*.5;}}
    }}
  if(ui.broken){const pre=FAILS[ui.broken.k].part,fl=.55+.45*Math.sin(performance.now()/170);for(const p of E3.parts) if(p.mats&&pre.some(x=>p.name.startsWith(x))) for(const m of p.mats){m.color.setRGB(.45,.04,.04);m.emissive.setRGB(1,.08,.05);m.emissiveIntensity=fl;}}
}
let benchLast=0;
function benchHTML(){
  return `<div class="bench" id="bench"><div class="brk-box"></div><div class="bench-h"><h3>Banc d'essai</h3><button class="chip-btn strong" id="benchRun" type="button"></button><label class="chip-btn"><input type="checkbox" id="animTog"${ui.noAnim?'':' checked'}>Animations</label><label class="chip-btn"><input type="checkbox" id="sndTog"${ui.snd?' checked':''}>Son</label><label class="chip-btn" id="thermLab"><input type="checkbox" id="thermTog"${ui.therm?' checked':''}>Caméra thermique</label></div>
  <div class="bench-ctl"><div class="f"><div class="f-top"><label for="benchRpm">Régime</label><output id="benchRpmO" for="benchRpm"></output></div><input type="range" id="benchRpm" step="50"></div>
  <div class="f"><div class="f-top"><label for="benchLoad">Charge (accélérateur)</label><output id="benchLoadO" for="benchLoad"></output></div><input type="range" id="benchLoad" min="0" max="100" step="1"></div></div>
  <div class="seg bench-q" role="group" aria-label="Points de fonctionnement"><button type="button" data-bq="idle">Ralenti</button><button type="button" data-bq="tq">Couple maxi</button><button type="button" data-bq="pw">Puissance maxi</button><button type="button" data-bq="lim">Rupteur</button></div>
  <div class="run-ctl"><button class="btn sm" id="benchSweep" type="button"></button><p class="run-msg">Simulation sur banc à inertie : le régime monte au rythme du couple, le turbo met du temps à charger, puis rupteur et lever de pied.</p></div>
  <dl class="facts" id="benchOut"></dl>
  <p class="oil-msg" id="oilMsg" role="status" hidden></p>
  <div class="therm-scale" id="thermScale"><span class="cell-l">Échelle thermique</span><i></i><div><span>20 °C</span><span>80</span><span>265</span><span>570</span><span>1 000 °C</span></div></div>
  <div class="temps" id="benchTemps"></div>
  <div class="faults"><div class="bench-h"><h3>Provoquer une panne</h3><button class="chip-btn strong" id="faultFix" type="button" hidden>Tout réparer</button></div><div class="seg" id="faultChips" role="group" aria-label="Pannes">${Object.keys(FAULTS).map(k=>`<button type="button" data-fault="${k}" id="fault_${k}"></button>`).join('')}</div><ul class="fault-msg" id="faultMsg"></ul></div>
  <p class="hint">Les températures montent et redescendent progressivement, comme sur un vrai banc. La rotation affichée est ralentie pour rester lisible. Cochez « Son » pour entendre le moteur : le timbre suit l'architecture, le régime, la charge et l'échappement. Sur téléphone, montez le volume et désactivez le mode silencieux.</p></div>`;
}
function benchUpdate(b){
  const E=M.E;if(!$('#bench')) return;b=b||benchState();
  const r=$('#benchRpm'),l=$('#benchLoad');
  r.min=E.idle;r.max=E.limiter;if(+r.value!==b.rpm) r.value=b.rpm;if(+l.value!==ui.load) l.value=ui.load;
  r.style.setProperty('--p',((b.rpm-E.idle)/(E.limiter-E.idle)*100).toFixed(1)+'%');l.style.setProperty('--p',ui.load+'%');
  r.disabled=l.disabled=!ui.run;if(!ui.sweep) ui.load=Math.round(ui.load);
  $('#benchRpmO').textContent=ui.run?nf(b.rpm,-1)+' tr/min':'à l\'arrêt';$('#benchLoadO').textContent=ui.load+' %';
  $('#benchRun').textContent=ui.run?'Couper le moteur':'Démarrer le moteur';$('#benchSweep').textContent=ui.sweep?'Arrêter la montée':'Accélération à fond';
  if(ui.sweep){r.value=Math.round(b.rpm);l.value=ui.load;}
  const on=ui.run,T=ui.T||b.T;
  $('#benchOut').innerHTML=[['Couple',on?nf(b.tq):'0','Nm'],['Puissance',on?nf(b.pw*1.3596):'0','ch'],E.boosted?['Suralimentation',on?nf(b.pr-1,2):'0,00','bar']:null,['Gaz d\'échappement',nf(T.egt,-1),'°C'],['Pression d\'huile',nf(b.pOil,1),'bar'],(()=>{const f=fatigue();return ['Fatigue',nf(f.v*100),f.k&&f.v>.005?'% · '+lc(FAILS[f.k].n):'%'];})(),['Débit carburant',on?nf(b.lh,1):'0,0','l/h'],S.fuelSys!=='carb'?['Ouverture injecteurs',on?nf(Math.min(100,b.dutyNow*100)):'0','%']:null,['Conso spécifique',on&&b.bsfc?nf(b.bsfc,-1):'—','g/kWh']].filter(Boolean).map(f=>`<div><dt>${f[0]}</dt><dd>${f[1]} <small>${f[2]}</small></dd></div>`).join('');
  const rows=[['Collecteur d\'échappement','man'],E.turbo?['Turbo (carter de turbine)','turbo']:null,S.cat!=='none'?['Catalyseur','cat']:null,['Ligne d\'échappement','pipe'],['Culasse','head'],['Huile','oil'],['Liquide de refroidissement','water'],E.boosted?['Air de suralimentation','charge']:null].filter(Boolean);
  $('#benchTemps').innerHTML=rows.map(([n,k])=>{const c=rampRGB(T[k]).map(v=>Math.round(v*255));return `<div class="meter"><span class="m-l">${n}</span><span class="m-bar"><i style="width:${(rampU(T[k])*100).toFixed(0)}%;background:rgb(${c})"></i></span><span class="m-v">${nf(T[k],-1)} °C</span></div>`;}).join('');
  faultsUI();updBroken();
  let om='';if(on){if(E.mism==='lean') om=`Mélange trop pauvre : le calculateur est cartographié pour ${FUEL[S.ecuFuel].n}, pas pour ${FUEL[S.fuel].n}. Ratés et à-coups, voyant moteur allumé.`;else if(E.duty>1&&b.dutyNow>.97) om='Injecteurs ouverts à 100 % : ils ne peuvent pas fournir plus, le moteur plafonne.';else if(T.water>118) om=`Liquide de refroidissement à ${nf(T.water,-1)} °C : surchauffe, risque de déformation de la culasse. Coupez le moteur.`;else if(b.pOil<b.pReq) om=`Pression d'huile insuffisante (${nf(b.pReq,1)} bar nécessaires à ce régime) : le film se rompt, les coussinets s'usent vite.`;else if(T.oil>135) om=`Huile à ${nf(T.oil,-1)} °C : elle s'oxyde et perd sa viscosité.`;else if(T.oil<60) om='Huile encore froide et épaisse : la pression bute sur le clapet de décharge, évitez les hauts régimes.';else if(E.oilQ>1.1) om='Trop d\'huile : le vilebrequin barbote et la fait mousser.';}
  const omE=$('#oilMsg');omE.hidden=!om;omE.textContent=om?'▲ '+om:'';
  $('#thermScale').hidden=!ui.therm;$('#thermLab').hidden=(ui.eview!=='3d'&&ui.eview!=='cut')||!E3;
}
