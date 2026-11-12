'use strict';
/* ───────────── Essai d'endurance (très long kilométrage) ─────────────
   Simule en accéléré des dizaines ou centaines de milliers de kilomètres :
   entretien, usure de chaque organe, casses, remises à neuf et coûts.
   Sert à vérifier la durée de vie annoncée du moteur. */
ui.endKm=300000;ui.endStyle='normale';ui.endCare='suivi';
let endu=null;
const END_KM=[[50000,'50 000 km'],[150000,'150 000 km'],[300000,'300 000 km'],[600000,'600 000 km'],[1000000,'1 000 000 km']];
const END_STYLE={douce:{n:'Conduite douce',k:1.25,d:'Autoroute et bas régimes'},normale:{n:'Conduite normale',k:1,d:'Usage mixte'},sportive:{n:'Conduite sportive',k:.6,d:'Hauts régimes fréquents'},circuit:{n:'Circuit',k:.22,d:'Toujours à fond'}};
const END_CARE={suivi:{n:'Entretien suivi',d:'Tout est fait à temps'},neglige:{n:'Entretien négligé',d:'Vidanges très en retard, rien de préventif'}};
const eMoney=x=>(typeof G!=='undefined'&&G)?moneyF(x*(typeof eraK==='function'?eraK(yq()):1)):nf(Math.round(x/10)*10)+' €';
function enduHTML(){
  const seg=(arr,cur,key)=>arr.map(([k,n])=>`<button type="button" role="radio" data-${key}="${k}" aria-checked="${String(cur)===String(k)}">${n}</button>`).join('');
  const E=M.E;
  return `<div class="card wide" id="enduCard"><h3>Essai d'endurance</h3>
   <p class="grp-note">Faites rouler la voiture très longtemps, en accéléré, pour vérifier la durée de vie du moteur (annoncée à ${nf(E.life)} km) et le coût réel de l'entretien.</p>
   <div class="endu-opts">
    <div class="f"><div class="f-top"><span class="lab">Distance</span></div><div class="seg" role="radiogroup" aria-label="Distance">${seg(END_KM,ui.endKm,'ekm')}</div></div>
    <div class="f"><div class="f-top"><span class="lab">Conduite</span></div><div class="seg" role="radiogroup" aria-label="Conduite">${seg(Object.entries(END_STYLE).map(([k,v])=>[k,v.n]),ui.endStyle,'esty')}</div></div>
    <div class="f"><div class="f-top"><span class="lab">Entretien</span></div><div class="seg" role="radiogroup" aria-label="Entretien">${seg(Object.entries(END_CARE).map(([k,v])=>[k,v.n]),ui.endCare,'ecare')}</div></div>
   </div>
   <div class="run-ctl"><button class="btn" id="enduGo" type="button">Lancer l'endurance</button><p class="run-msg" id="enduMsg">${END_STYLE[ui.endStyle].d} · ${END_CARE[ui.endCare].d.toLocaleLowerCase()}.</p></div>
   <div id="enduOut" aria-live="polite"></div></div>`;
}
// prépare tout le déroulé : entretien, usure par organe, casses
function enduPlan(){
  const E=M.E,C=M.C,sty=END_STYLE[ui.endStyle],neg=ui.endCare==='neglige',target=ui.endKm;
  let life=E.life*sty.k;
  if(neg){const E2=computeEngine(Object.assign({},S,{oilInt:Math.min(60000,(S.oilInt||E.oilRec)*2.5)}));life*=Math.min(1,E2.life/E.life)*.85;}
  // organes : le plus sollicité cède à la durée de vie prévue, les autres plus tard
  const rs=Object.entries(E.fails).map(([k,v])=>[k,v.r]).filter(x=>FAILS[x[0]]),rmax=Math.max(.3,...rs.map(x=>x[1]));
  const rnd=()=>.86+Math.random()*.28;
  const organs=rs.map(([k,r])=>({k,n:FAILS[k].n,life:Math.round(life*Math.min(4,Math.pow(rmax/Math.max(.2,r),2.2))*rnd()),fatal:k!=='turbo'}));
  organs.push({k:'gearbox',n:FAILS.gearbox.n,life:Math.round(380000*sty.k/Math.pow(Math.max(.5,C.gbxR),4)*rnd()),fatal:false,cost:C.costs.Transmission*.6});
  organs.sort((a,b)=>a.life-b.life);
  const ev=[];let km0=0,engines=1,maintC=0,repC=0,firstDeath=null;
  const maint=E.maint.filter(m=>m.every>=2000);
  const belt=maint.find(m=>/courroie/i.test(m.n));
  let guard=0;
  while(km0<target&&guard++<40){
    // prochaine casse fatale de ce moteur
    let death=Infinity,cause=null;
    for(const o of organs) if(o.fatal&&km0+o.life<death){death=km0+o.life;cause=o;}
    if(neg&&belt&&km0+belt.every*1.45<death){death=km0+Math.round(belt.every*1.45);cause={n:'Courroie de distribution rompue',belt:true};}
    const end=Math.min(death,target);
    // entretien jusque-là
    for(const m of maint){const every=neg?(/Vidange/.test(m.n)?m.every*2.5:Infinity):m.every;if(!isFinite(every)) continue;for(let k=km0+every;k<end;k+=every){ev.push({km:Math.round(k),t:'maint',n:m.n,c:m.price});maintC+=m.price;}}
    // casses réparables (turbo, boîte)
    for(const o of organs) if(!o.fatal){for(let k=km0+o.life;k<end;k+=o.life){const c=o.cost||E.maint.filter(m=>/turbo/i.test(m.n)).reduce((a,m)=>a+m.price*1.6,0)||1500;ev.push({km:Math.round(k),t:'rep',n:o.k==='turbo'?'Turbo hors service : remplacé':'Boîte ou embrayage hors service : remplacés',c});repC+=c;}}
    if(death<=target){ev.push({km:Math.round(death),t:'death',n:cause.belt?cause.n+' : soupapes et pistons détruits':`${cause.n} : moteur hors service`,c:E.rebuild});if(firstDeath==null) firstDeath=Math.round(death);repC+=E.rebuild;engines++;km0=death;}
    else km0=target;
  }
  ev.sort((a,b)=>a.km-b.km);
  return {ev,organs,target,maintC,repC,engines:engines-1,firstDeath,life:Math.round(life)};
}
function enduStart(){
  if(ui.broken){flashBroken();return;}
  run=null;if(cruise) stopCruise();
  const plan=enduPlan();
  endu={plan,t0:performance.now(),dur:reduced()?0:9000,i:0,log:[],last:0};
  $('#enduGo').disabled=true;$('#enduMsg').textContent='Endurance en cours, en accéléré…';
  $('#enduOut').innerHTML=`<div class="endu-odo"><span class="eyebrow">Compteur</span><b id="enduKm">0</b><small>km</small></div><div class="gmeter" role="img" aria-label="Avancement"><i id="enduBar" style="width:0%"></i></div>
   <div class="row2"><div><p class="eyebrow">Usure des organes</p><ul class="endu-org" id="enduOrg"></ul></div><div><p class="eyebrow">Journal de bord</p><ol class="endu-log" id="enduLog"></ol></div></div><div id="enduRes"></div>`;
  requestAnimationFrame(enduStep);
}
function enduStep(now){
  if(!endu||ui.tab!=='essais'||!$('#enduKm')){endu=null;return;}
  const e=endu,P=e.plan,f=e.dur?clamp((now-e.t0)/e.dur,0,1):1,km=P.target*(f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2);
  $('#enduKm').textContent=nf(km,-2);$('#enduBar').style.width=(f*100).toFixed(1)+'%';
  // événements franchis
  let add='';
  while(e.i<P.ev.length&&P.ev[e.i].km<=km){const v=P.ev[e.i++];if(v.t==='death') e.last=v.km;if(v.t!=='maint'||/distribution|turbo|Chaîne/i.test(v.n)) add=`<li class="el-${v.t}"><span>${nf(v.km,-2)} km</span>${v.n} <em>${eMoney(v.c)}</em></li>`+add;}
  if(add){const lg=$('#enduLog');lg.insertAdjacentHTML('afterbegin',add);while(lg.children.length>40) lg.lastChild.remove();}
  // usure des organes du moteur en service
  if(now-(e.lt||0)>120||f>=1){e.lt=now;const since=km-e.last;
    $('#enduOrg').innerHTML=P.organs.slice(0,7).map(o=>{const w=clamp((since%Math.max(1,o.fatal?1e12:o.life))/o.life,0,1),lv=w>.85?'crit':w>.6?'warn':'ok';return `<li><span>${o.n}</span><i class="m-bar"><b class="w-${lv}" style="width:${(w*100).toFixed(0)}%"></b></i><em>${nf(w*100)} %</em></li>`;}).join('');
    if(typeof sceneDraw==='function') sceneDraw(km*1000*.02,130,M.E.peakPrpm*.6);}
  if(f<1){requestAnimationFrame(enduStep);return;}
  // bilan
  const tot=P.maintC+P.repC,E=M.E,ok=!P.firstDeath;
  const verdict=ok?`Le moteur d'origine a tenu les ${nf(P.target)} km.`:`Le premier moteur a cédé à ${nf(P.firstDeath,-2)} km${P.engines>1?`, et il a fallu ${P.engines} remises à neuf en tout`:''}.`;
  const cmp=ok?(P.target>=E.life?'Il dépasse sa durée de vie annoncée : la marge est réelle.':`Sa durée de vie annoncée est de ${nf(E.life)} km : relancez sur une distance plus longue pour trouver sa limite.`):`Durée de vie annoncée : ${nf(E.life)} km ; avec cette conduite et cet entretien, le calcul donnait environ ${nf(P.life,-3)} km.`;
  $('#enduRes').innerHTML=`<div class="endu-res ${ok?'ok':'ko'}"><b>${verdict}</b><p>${cmp}</p></div>
   <div class="tiles">${tile2('Entretien courant',eMoney(P.maintC),`${P.ev.filter(v=>v.t==='maint').length} opérations`)}${tile2('Réparations',eMoney(P.repC),`${P.ev.filter(v=>v.t!=='maint').length} pannes`)}${tile2('Coût total',eMoney(tot))}${tile2('Aux 1 000 km',eMoney(tot/P.target*1000),'hors carburant')}</div>`;
  $('#enduMsg').textContent='Endurance terminée. Changez la conduite ou l\'entretien pour comparer.';$('#enduGo').disabled=false;endu=null;
}
function tile2(l,v,sub){return `<div class="tile"><span class="eyebrow">${l}</span><b>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;}
$('#stage').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b) return;
  if(b.id==='enduGo'){enduStart();return;}
  const d=b.dataset;if(d.ekm==null&&d.esty==null&&d.ecare==null) return;
  if(endu) return;
  if(d.ekm!=null) ui.endKm=+d.ekm;if(d.esty!=null) ui.endStyle=d.esty;if(d.ecare!=null) ui.endCare=d.ecare;
  for(const x of $$('#enduCard [role=radio]')){const dd=x.dataset;x.setAttribute('aria-checked',String(dd.ekm!=null?+dd.ekm===ui.endKm:dd.esty!=null?dd.esty===ui.endStyle:dd.ecare===ui.endCare));}
  $('#enduMsg').textContent=`${END_STYLE[ui.endStyle].d} · ${END_CARE[ui.endCare].d.toLocaleLowerCase()}.`;
});
