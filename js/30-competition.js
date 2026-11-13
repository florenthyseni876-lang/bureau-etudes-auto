'use strict';
/* ───────────── Carrière : compétition automobile ─────────────
   Calendrier d'épreuves selon l'époque (noms imaginaires), engagement d'un modèle ou d'un prototype,
   pilotes, simulation, animation de course et conséquences (primes, réputation, demande).
   État : G.comp = {ent:{clé:engagement}, done:{clé:1}, pal:[palmarès], show:[courses à montrer], last:dernière course}. */

const COMP_TYPES={
  ville:{n:'Course de ville à ville',w:{v:.4,acc:.1,hand:.1,rel:.35,mix:.05},dur:1.5,L:6,unit:'étape',vl:4,pres:.7,prep:'Routes ouvertes, longues étapes : la mécanique doit tenir.'},
  gp:{n:'Grand Prix',w:{v:.35,acc:.25,hand:.3,rel:.1},dur:1,L:10,unit:'tour',vl:8,pres:1,prep:'Circuit fermé : vitesse, reprises et tenue de route décident.'},
  endu:{n:'Épreuve de 24 heures',w:{v:.2,acc:.05,hand:.2,rel:.3,mix:.25},dur:1.8,L:24,unit:'heure',vl:6,pres:1.1,prep:'Jour et nuit : fiabilité et consommation comptent autant que la vitesse.'},
  rallye:{n:'Rallye',w:{v:.05,acc:.15,hand:.3,rel:.2,off:.3},dur:1.3,L:6,unit:'spéciale',vl:4,pres:.8,prep:'Routes variées et chemins : tenue de route et franchissement.'},
  cote:{n:'Course de côte',w:{v:.05,acc:.45,hand:.4,rel:.05,off:.05},dur:.4,L:3,unit:'montée',vl:3,pres:.45,prep:'Courte et sinueuse : accélération et tenue de route.'},
  tour:{n:'Championnat de tourisme',w:{v:.15,acc:.25,hand:.35,rel:.15,mix:.1},dur:1,L:10,unit:'tour',vl:7,pres:.6,prep:'Voitures proches de la série : tout se joue en piste.'},
};
// modèles d'épreuve : noms imaginaires ; m = mois, j = jour ; fee/pool en multiples du prix d'une voiture populaire de l'époque
const COMP_TPL=[
  {t:'ville',from:1900,to:1912,m:5,j:14,fee:.25,pool:2.5,names:['Course de la Plaine à la Mer','Course des Deux Capitales','Grande Course du Nord']},
  {t:'ville',from:1900,to:1912,m:9,j:3,fee:.25,pool:2.2,names:['Course des Trois Vallées','Course du Grand Fleuve','Course de l\'Ouest']},
  {t:'cote',from:1900,to:2100,m:6,j:22,fee:.12,pool:1,names:['Course de côte du Mont-Verdon','Course de côte de la Roche-Haute','Course de côte du Col-Sauvage']},
  {t:'gp',from:1906,to:2100,m:7,j:9,fee:.5,pool:6,names:['Grand Prix de Montclair','Grand Prix de Sainte-Aurore','Grand Prix du Littoral','Grand Prix de Valcourt']},
  {t:'gp',from:1950,to:2100,m:10,j:8,fee:.55,pool:6.5,names:['Grand Prix des Nations Libres','Grand Prix d\'Automne','Grand Prix de la Baie-Claire']},
  {t:'endu',from:1923,to:2100,m:6,j:16,fee:.7,pool:5,names:['Vingt-quatre Heures de Val-Sorel','Vingt-quatre Heures du Grand-Marais','Vingt-quatre Heures d\'Hautecombe']},
  {t:'rallye',from:1950,to:2100,m:1,j:20,fee:.4,pool:3,names:['Rallye des Neiges du Nord','Rallye de la Montagne Blanche']},
  {t:'rallye',from:1970,to:2100,m:11,j:5,fee:.45,pool:3.4,names:['Rallye des Roches Rouges','Rallye des Mille Collines','Rallye du Désert Doré']},
  {t:'tour',from:1960,to:2100,m:4,j:12,fee:.3,pool:3,names:['Championnat de tourisme : manche de Brisac','Championnat de tourisme : manche de Lorcan']},
  {t:'tour',from:1960,to:2100,m:9,j:27,fee:.3,pool:3,names:['Championnat de tourisme : manche d\'Aubenas-le-Haut','Championnat de tourisme : manche de Sorel-Marine']},
];
const COMP_PREPS=[['Sobre','Voiture de série, simplement contrôlée',0,0],['Soignée','Réglages et pièces choisies',.6,.05],['Usine','Mécanique reprise à l\'atelier',1.6,.1],['Équipe officielle','Atelier de course complet',3.2,.15]];
const COMP_MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const COMP_PAIX=[[1900,40],[1930,28],[1960,16],[1990,11],[2020,9]]; // 0 à 100 km/h d'une voiture moyenne
const COMP_BRANDS=['Aubrac','Valmont','Carrel','Sorel','Delmas','Montclair','Gerval','Thorne','Brisac','Lorcan','Marchetti','Dorval','Kessler','Vauclair','Ravenne','Sandoval','Estrel','Hollis','Varenne','Corvane','Belmont-Roy','Fauvel','Orlane','Quintal'];
const COMP_NOMS=['Marchand','Delcourt','Vasseur','Hartmann','Lefèvre','Santoro','Berthier','Novak','Girard','Almeida','Roussel','Keller','Duval','Moretti','Lambert','Ferrand','Haas','Perrin','Castel','Ivanov','Bellamy','Okafor','Tanaka','Lindqvist','Garnier','Rossi'];
const COMP_PRENOMS=['A.','B.','C.','D.','É.','F.','G.','H.','J.','L.','M.','N.','P.','R.','S.','T.','V.'];
const COMP_COLS=['#c0392b','#2e7d32','#1f5fa8','#e0a800','#6a3d9a','#00897b','#e67e22','#8d6e63','#d81b60','#455a64','#7cb342','#0097a7','#f06292','#5d4037'];
const COMP_SHARE=[.45,.25,.14,.08,.05,.03];

function compSt(){if(!G) return null;const c=G.comp||(G.comp={});if(!c.ent) c.ent={};if(!c.done) c.done={};if(!c.pal) c.pal=[];if(!c.show) c.show=[];return c;}
function compRng(seed){let a=(seed|0)+0x6d2b79f5;return()=>{a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function compGauss(r){return (r()+r()+r()-1.5)/.75;}
const compWar=y=>(y>=1915&&y<=1918)||(y>=1940&&y<=1945);
// calendrier d'une année
function calOf(y){
  if(compWar(y)) return [];
  const out=[];
  COMP_TPL.forEach((tp,i)=>{
    if(y<tp.from||y>tp.to) return;
    const nm=tp.names[(y+i*3)%tp.names.length],ty=COMP_TYPES[tp.t],r=compRng(y*31+i),mo=clamp(tp.m+Math.round((r()-.5)*1.4),1,12),jr=clamp(tp.j+Math.round((r()-.5)*12),1,28);
    out.push({id:'e'+i,key:y+':e'+i,y,q:Math.floor((mo-1)/3),mo,j:jr,n:nm,t:tp.t,ty,fee:tp.fee,pool:tp.pool,date:`${jr}${jr===1?'er':''} ${COMP_MOIS[mo-1]}`,track:(i+y)%5});
  });
  return out.sort((a,b)=>a.mo*40+a.j-b.mo*40-b.j);
}
function compEv(key){const y=+String(key).split(':')[0];return calOf(y).find(e=>e.key===key)||null;}
const compFeeU=ev=>refPrice(ev.y);
function compPilots(y){
  const r=compRng(Math.floor(y/4)*977+13),out=[],used={};
  for(let i=0;i<5;i++){let n;do{n=COMP_PRENOMS[Math.floor(r()*COMP_PRENOMS.length)]+' '+COMP_NOMS[Math.floor(r()*COMP_NOMS.length)];}while(used[n]);used[n]=1;out.push({n,t:Math.round((.2+.75*Math.pow(r(),.8))*100)/100});}
  return out.sort((a,b)=>a.t-b.t);
}
const compPilotName=t=>t>=.8?'Champion':t>=.6?'Confirmé':t>=.4?'Honnête':'Jeune espoir';
function compSalary(p,ev){return compFeeU(ev)*ev.fee*(.3+2*p.t*p.t);}
function compPrepCost(l,ev){return compFeeU(ev)*ev.fee*COMP_PREPS[l][2];}
function compProtoCost(met){return devCost(met,yq())*.08;}
// voitures engageables : modèles en production et prototype (projet actuel du bureau d'études)
function compCars(){
  const l=G.models.filter(m=>m.st==='prod').map(m=>({id:'m'+m.id,name:m.name,met:m.met,mid:m.id,proto:false}));
  if(typeof M!=='undefined'&&M.E&&M.C){try{const met=measure(M.E,M.C);if(met.fit) l.push({id:'p',name:'Prototype « '+(S.name||'Projet')+' »',met,mid:null,proto:true,cost:compProtoCost(met)});}catch(e){}}
  return l;
}
// valeur de course d'une voiture pour une épreuve (0 = voiture de série moyenne de l'époque)
function compPerf(met,ty,y){
  const ln=Math.log,c=x=>clamp(x,-.7,.7),w=ty.w;let t100=met.t100;if(!t100||!isFinite(t100)||t100>60) t100=60;
  let s=0;
  if(w.v) s+=w.v*c(ln(met.v/itp(REF.V,y)));
  if(w.acc) s+=w.acc*c(ln(itp(COMP_PAIX,y)/t100));
  if(w.hand) s+=w.hand*c(ln((met.hand+15)/(itp(REF.hand,y)+15))*2);
  if(w.rel) s+=w.rel*c(ln((met.rel+15)/100)*1.5);
  if(w.mix) s+=w.mix*c(ln(itp(REF.cons,y)/Math.max(1,met.mix)));
  if(w.off) s+=w.off*c(ln((met.off+15)/65)*1.5);
  return s;
}
function compDnfP(met,ty,prep){
  const rel=met.rel||50;
  return clamp((.04+.5*Math.max(0,(85-rel)/85)+.07*(met.dw||0))*ty.dur*(1-.12*prep),.02,.8);
}
const COMP_WHY=['Casse mécanique','Surchauffe du moteur','Boîte de vitesses cassée','Sortie de route','Crevaisons à répétition','Embrayage grillé','Rupture de transmission','Panne d\'allumage'];
// engagement
function compEnter(evKey,carId,pilName,prep){
  const c=compSt(),ev=compEv(evKey);if(!ev) return 'Cette épreuve n\'existe plus.';
  if(c.ent[evKey]) return 'Vous êtes déjà inscrit à cette épreuve.';
  if(ev.y*4+ev.q<G.y*4+G.q||c.done[evKey]) return 'Cette épreuve est déjà passée.';
  const car=compCars().find(x=>x.id===carId);if(!car) return 'Choisissez une voiture.';
  const pil=compPilots(ev.y).find(p=>p.n===pilName);if(!pil) return 'Choisissez un pilote.';
  prep=clamp(prep|0,0,3);
  const fee=compFeeU(ev)*ev.fee,sal=compSalary(pil,ev),pc=compPrepCost(prep,ev),pr=car.proto?car.cost:0,tot=fee+sal+pc+pr;
  if(G.cash+loanLimit()-G.debt<tot) return 'Trésorerie insuffisante pour cet engagement.';
  G.cash-=tot;
  c.ent[evKey]={car:carId,mid:car.mid,proto:car.proto,name:car.name,met:car.proto?JSON.parse(JSON.stringify(car.met)):null,pil:{n:pil.n,t:pil.t},prep,paid:tot};
  coverCash();return null;
}
function compWithdraw(evKey){const c=compSt(),e=c.ent[evKey];if(!e) return;G.cash+=e.paid*.5;delete c.ent[evKey];}
// simulation d'une épreuve (le joueur est facultatif)
function compSimulate(ev,en){
  const y=ev.y,ty=ev.ty,r=Math.random,gs=()=>compGauss(r);
  const n=clamp(Math.round(itp([[1900,8],[1930,11],[1960,13]],y))+Math.floor(r()*3)-1,7,14);
  const brands=COMP_BRANDS.slice().sort(()=>r()-.5),names=COMP_NOMS.slice().sort(()=>r()-.5),cols=COMP_COLS.slice().sort(()=>r()-.5);
  const cars=[],nAdv=en?n-1:n;
  for(let i=0;i<nAdv;i++){
    const works=i<2,perf=(works?.14:.05)+gs()*.08,drv=(r()*.7-.25)*.3,pd=(.05+r()*.05)*ty.dur*(works?.7:1.1);
    cars.push({n:brands[i%brands.length],p:COMP_PRENOMS[Math.floor(r()*COMP_PRENOMS.length)]+' '+names[i%names.length],c:cols[i%cols.length],me:false,score:perf+drv+gs()*.07,pd});
  }
  if(en){
    const mod=en.proto?null:G.models.find(m=>m.id===en.mid),met=en.proto?en.met:(mod?mod.met:en.met);
    const pr=COMP_PREPS[en.prep],base=compPerf(met,ty,y)+(en.proto?.05:0),drv=(en.pil.t-.5)*.3;
    cars.push({n:G.co,p:en.pil.n,c:cols[cars.length%cols.length],me:true,score:base+drv+pr[3]+gs()*.07,pd:compDnfP(met,ty,en.prep),defects:met.defects||[]});
  }
  cars.forEach(c=>{
    c.dnf=null;
    if(r()<c.pd){
      c.dnf=.1+.78*r();
      c.why=c.me&&c.defects.length&&r()<.6?'Panne : '+c.defects[Math.floor(r()*c.defects.length)].toLocaleLowerCase():COMP_WHY[Math.floor(r()*COMP_WHY.length)];
      if(c.me&&ty.w.off&&r()<.3) c.why='Enlisement';
    }
  });
  const fin=cars.filter(c=>c.dnf==null).sort((a,b)=>b.score-a.score),out=cars.filter(c=>c.dnf!=null).sort((a,b)=>b.dnf-a.dnf);
  const order=fin.concat(out),sw=fin.length?fin[0].score:0;
  order.forEach((c,i)=>{c.rank=i+1;c.F=c.dnf==null?1-clamp((sw-c.score)*.2,0,.08):c.dnf;c.w=r()*2*Math.PI;c.wa=.02+r()*.03;});
  const pool=compFeeU(ev)*ev.pool;
  order.forEach((c,i)=>{c.prize=c.dnf==null&&i<COMP_SHARE.length?pool*COMP_SHARE[i]:0;});
  const me=order.find(c=>c.me)||null;
  return {key:ev.key,y:ev.y,q:ev.q,ev:{n:ev.n,t:ev.t,date:ev.date,track:ev.track,L:ty.L,unit:ty.unit,vl:ty.vl,tn:ty.n},
    cars:order.map(c=>({n:c.n,p:c.p,c:c.c,me:c.me,rank:c.rank,F:c.F,dnf:c.dnf,why:c.why||'',w:c.w,wa:c.wa,prize:c.prize})),me:me?me.rank:0,nTot:order.length,fx:null};
}
// conséquences pour le joueur
function compApply(res,en){
  const c=compSt(),mine=res.cars.find(x=>x.me),ev=compEv(res.key),pres=ev?ev.ty.pres:1;let repD=0;
  const win=mine.rank===1&&mine.dnf==null,pod=mine.dnf==null&&mine.rank<=3;
  if(mine.prize>0) G.cash+=mine.prize;
  if(win) repD=2.5*pres;else if(pod) repD=1.2*pres;else if(mine.dnf==null&&mine.rank<=res.nTot/2) repD=.3*pres;else if(mine.dnf!=null) repD=-.4;
  G.rep=clamp(G.rep+repD,0,100);
  let bonus=0;const m=en.proto?null:G.models.find(x=>x.id===en.mid);
  if(m&&(win||pod)){bonus=(win?.1:.04)*pres;const cur=m.cb?m.cb.b*Math.max(0,1-(yq()-m.cb.t)/m.cb.d):0;if(bonus>cur) m.cb={b:bonus,t:yq(),d:3};else bonus=cur;}
  res.fx={prize:mine.prize,rep:repD,bonus:m?bonus:0,model:m?m.name:'',paid:en.paid};
  c.pal.unshift({y:res.y,q:res.q,ev:res.ev.n,tn:res.ev.tn,rank:mine.rank,n:res.nTot,dnf:mine.dnf!=null,why:mine.why,car:en.name,pil:en.pil.n,prize:mine.prize,paid:en.paid,mid:en.mid,proto:!!en.proto});
  if(c.pal.length>80) c.pal.length=80;
  const t=mine.dnf!=null?`Abandon de ${en.name} (${mine.why.toLocaleLowerCase()}).`:win?`Victoire de ${en.name} avec ${en.pil.n} !`:`${en.name} termine ${mine.rank===1?'1er':mine.rank+'e'} sur ${res.nTot}.`;
  news(res.ev.n,t+(mine.prize>0?` Primes : ${moneyF(mine.prize)}.`:'')+(m&&bonus>0&&(win||pod)?` La demande pour ${m.name} progresse.`:''),win?'good':mine.dnf!=null?'warn':'info');
  c.last=res;
  c.show.push(res);
}
// appelé au début de nextQuarter : les épreuves du trimestre qui s'achève
function compQuarter(){
  const c=compSt();if(!c) return;
  for(const ev of calOf(G.y)){
    if(ev.q!==G.q||c.done[ev.key]) continue;
    c.done[ev.key]=1;
    const en=c.ent[ev.key];
    if(en){delete c.ent[ev.key];compApply(compSimulate(ev,en),en);}
    else if(ev.t==='gp'||ev.t==='endu'){const res=compSimulate(ev,null),w=res.cars[0],s=res.cars[1];news(res.ev.n,`${w.p} (${w.n}) s'impose devant ${s.p} (${s.n}).`,'hist');}
  }
  for(const k of Object.keys(c.done)) if(+k.split(':')[0]<G.y-2) delete c.done[k];
  for(const k of Object.keys(c.ent)) if(+k.split(':')[0]<G.y-1) delete c.ent[k];
}
// bonus de demande : lu par pressF() donc par demand()
function compF(m){if(!m||!m.cb||!G) return 1;return 1+m.cb.b*Math.max(0,1-(yq()-m.cb.t)/m.cb.d);}
// à faire : une épreuve approche (une seule ligne, seulement si l'entreprise vend déjà une voiture)
function compTodo(t){
  if(!G.models.some(m=>m.st==='prod')) return;
  const c=compSt(),ev=calOf(G.y).find(e=>e.q===G.q&&!c.done[e.key]&&!c.ent[e.key]);
  if(ev) t.push({t:`${esc(ev.n)} : le ${ev.date}`,d:'Une victoire fait vendre. Vous pouvez encore engager une voiture avant la fin du trimestre.',b:'<button class="chip-btn" type="button" data-go="competition">Voir la compétition</button>'});
}
function compCard(card){
  const c=compSt(),ne=Object.keys(c.ent).length,w=c.pal.filter(p=>p.rank===1&&!p.dnf).length;
  return card('data-go="competition"','Compétition',ne?`${ne} engagement${ne>1?'s':''} en cours`:(w?`${w} victoire${w>1?'s':''} au palmarès`:'Courses, pilotes et palmarès'),'⚑');
}

/* ── écran Compétition ── */
ui.comp={ev:'',car:'',pil:'',prep:1,msg:''};
const compRankTxt=(r,dnf)=>dnf?'Abandon':r===1?'1er':r+'e';
function compHTML(){
  const c=compSt(),cu=ui.comp,y0=G.y*4+G.q;
  let evs=calOf(G.y);if(G.q>=2||!evs.some(e=>e.y*4+e.q>=y0)) evs=evs.concat(calOf(G.y+1));
  let h='';
  if(cu.msg){h+=`<div class="flash" role="status">${esc(cu.msg)}</div>`;cu.msg='';}
  const nw=c.pal.filter(p=>p.rank===1&&!p.dnf).length;
  h+=`<section class="cgrp"><h3>Compétition</h3><p class="grp-note">Engagez une voiture dans une épreuve : la course se court à la date prévue, et le temps s'arrête pour la regarder. Une victoire fait parler de la marque et fait vendre le modèle engagé pendant quelques années ; un abandon coûte de l'argent et un peu de crédit. Les épreuves changent avec l'époque.</p><div class="tiles">${tile('Engagements',nf(Object.keys(c.ent).length),'épreuves à venir')}${tile('Victoires',nf(nw),`${nf(c.pal.filter(p=>!p.dnf&&p.rank<=3).length)} podiums`)}${tile('Courses disputées',nf(c.pal.length))}</div></section>`;
  h+=`<section class="cgrp"><h3>Calendrier</h3>${evs.length?`<div class="tbl-w"><table class="ctbl"><thead><tr><th>Date</th><th>Épreuve</th><th class="n">Engagement</th><th class="n">Prime au vainqueur</th><th></th></tr></thead><tbody>${evs.map(e=>{
    const past=e.y*4+e.q<y0||c.done[e.key],en=c.ent[e.key],pl=c.pal.find(p=>p.ev===e.n&&p.y===e.y);
    const st=en?'<span class="pill ok">Inscrit</span>':past?(pl?`<span class="pill">${compRankTxt(pl.rank,pl.dnf)}</span>`:'<span class="pill off">Courue</span>'):'';
    const act=!past&&!en?`<button class="chip-btn" type="button" data-cp="open:${e.key}">${cu.ev===e.key?'Choix en cours':'S\'inscrire'}</button>`:en?`<button class="chip-btn" type="button" data-cp="wd:${e.key}">Se retirer</button>`:'';
    return `<tr><td>${e.date}${e.y!==G.y?' '+e.y:''}</td><td><b>${esc(e.n)}</b><small>${e.ty.n} · ${e.ty.prep}</small></td><td class="n">${moneyF(compFeeU(e)*e.fee,e.y)}</td><td class="n">${moneyF(compFeeU(e)*e.pool*COMP_SHARE[0],e.y)}</td><td class="n">${st} ${act}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="grp-note">Pas de course cette année : l\'époque ne s\'y prête pas.</p>'}</section>`;
  const ev=cu.ev&&compEv(cu.ev);
  if(ev&&!c.ent[ev.key]&&ev.y*4+ev.q>=y0){
    const cars=compCars(),pil=compPilots(ev.y);
    if(!cars.some(x=>x.id===cu.car)) cu.car=cars.length?cars[0].id:'';
    if(!pil.some(p=>p.n===cu.pil)) cu.pil=pil[Math.min(2,pil.length-1)].n;
    cu.prep=clamp(cu.prep|0,0,3);
    const car=cars.find(x=>x.id===cu.car),pp=pil.find(p=>p.n===cu.pil);
    const fee=compFeeU(ev)*ev.fee,sal=pp?compSalary(pp,ev):0,pc=compPrepCost(cu.prep,ev),pr=car&&car.proto?car.cost:0,tot=fee+sal+pc+pr;
    const est=car?compPerf(car.met,ev.ty,ev.y)+(car.proto?.05:0)+COMP_PREPS[cu.prep][3]+(pp?(pp.t-.5)*.3:0):0,dn=car?compDnfP(car.met,ev.ty,cu.prep):0;
    const LB={v:'vitesse maximale',acc:'accélération',hand:'tenue de route',rel:'fiabilité',mix:'sobriété',off:'franchissement'};
    const top=Object.entries(ev.ty.w).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>LB[x[0]]).join(', ');
    h+=`<section class="cgrp"><h3>Inscription : ${esc(ev.n)}</h3><p class="grp-note">${ev.date} · ${ev.ty.n}. Ce parcours favorise : ${top}.</p>
     <div class="cp-lbl">Voiture</div><div class="cp-opts">${cars.length?cars.map(x=>`<button type="button" class="chip-btn" data-cp="car:${x.id}" aria-pressed="${x.id===cu.car}">${esc(x.name)}${x.proto?` · préparation ${moneyF(x.cost,ev.y)}`:''}</button>`).join(''):'<span class="grp-note">Aucune voiture engageable : mettez un modèle en vente ou finissez la conception d\'un prototype.</span>'}</div>
     <div class="cp-lbl">Pilote</div><div class="cp-opts">${pil.map(p=>`<button type="button" class="chip-btn" data-cp="pil:${esc(p.n)}" aria-pressed="${p.n===cu.pil}">${esc(p.n)} · ${compPilotName(p.t)} · ${moneyF(compSalary(p,ev),ev.y)}</button>`).join('')}</div>
     <div class="cp-lbl">Préparation</div><div class="cp-opts">${COMP_PREPS.map((p,i)=>`<button type="button" class="chip-btn" data-cp="prep:${i}" aria-pressed="${i===cu.prep}" title="${p[1]}">${p[0]} · ${moneyF(compPrepCost(i,ev),ev.y)}</button>`).join('')}</div>
     <p class="grp-note">${COMP_PREPS[cu.prep][1]}. Risque d'abandon estimé : ${nf(dn*100)} %. Niveau de la voiture : ${est>=.12?'parmi les meilleures':est>=.04?'dans le peloton de tête':est>=-.03?'dans la moyenne':'en retrait'}.</p>
     <p><b>Total ${moneyF(tot,ev.y)}</b> <span class="grp-note">(engagement ${moneyF(fee,ev.y)}, pilote ${moneyF(sal,ev.y)}, préparation ${moneyF(pc+pr,ev.y)})</span></p>
     <div class="btns"><button class="btn" type="button" data-cp="go"${car?'':' disabled'}>Confirmer l'inscription</button><button class="chip-btn" type="button" data-cp="cancel">Annuler</button></div></section>`;
  }
  const ens=Object.entries(c.ent);
  if(ens.length) h+=`<section class="cgrp"><h3>Mes engagements</h3><ul class="news">${ens.map(([k,e])=>{const v=compEv(k);return `<li><span class="eyebrow">${v?v.date+' '+v.y:''}</span><b>${esc(v?v.n:k)}</b><p>${esc(e.name)} · pilote ${esc(e.pil.n)} · préparation ${COMP_PREPS[e.prep][0].toLocaleLowerCase()} · payé ${moneyF(e.paid)}</p></li>`;}).join('')}</ul></section>`;
  h+=`<section class="cgrp"><h3>Palmarès</h3>${c.pal.length?`<div class="tbl-w"><table class="ctbl"><thead><tr><th>Date</th><th>Épreuve</th><th>Voiture et pilote</th><th class="n">Résultat</th><th class="n">Primes</th></tr></thead><tbody>${c.pal.slice(0,20).map(p=>`<tr><td>${Q[p.q]} ${p.y}</td><td><b>${esc(p.ev)}</b></td><td>${esc(p.car)}<small>${esc(p.pil)}</small></td><td class="n">${p.dnf?`Abandon<small>${esc(p.why)}</small>`:`${compRankTxt(p.rank)} sur ${p.n}`}</td><td class="n">${p.prize>0?moneyF(p.prize):'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="grp-note">Aucune course disputée pour l\'instant.</p>'}${c.last?'<div class="btns"><button class="chip-btn" type="button" data-cp="replay">Revoir la dernière course</button></div>':''}</section>`;
  h+=`<section class="cgrp"><h3>Pilotes disponibles</h3><div class="tiles">${compPilots(G.y).map(p=>tile(esc(p.n),compPilotName(p.t),`talent ${nf(p.t*100)} / 100 · environ ${moneyF(compSalary(p,{y:G.y,fee:.5}))} par course`)).join('')}</div><p class="grp-note">Un bon pilote coûte cher mais compte : le talent pèse sur le résultat, autant qu'un bon réglage.</p></section>`;
  return `<div class="career">${h}</div>`;
}
$('#stage').addEventListener('click',e=>{
  if(!G) return;const b=e.target.closest('button[data-cp]');if(!b) return;
  const [a,...r]=b.dataset.cp.split(':'),v=r.join(':'),cu=ui.comp;
  if(a==='open') cu.ev=v;
  else if(a==='car') cu.car=v;
  else if(a==='pil') cu.pil=v;
  else if(a==='prep') cu.prep=+v;
  else if(a==='cancel') cu.ev='';
  else if(a==='wd'){compWithdraw(v);cu.msg='Engagement retiré : la moitié des frais est remboursée.';}
  else if(a==='go'){const m=compEnter(cu.ev,cu.car,cu.pil,cu.prep);if(m) cu.msg=m;else{cu.msg='Inscription enregistrée. La course aura lieu à la date prévue : le temps s\'arrêtera pour la regarder.';cu.ev='';}}
  else if(a==='replay'){const c=compSt();if(c.last) compShowRace(c.last,true);return;}
  saveGame();renderCbar();render();
});

/* ── animation de course ── */
let rcRaf=0;
function compTrack(seed){
  const r=compRng(seed*7+3),a=.12+r()*.14,b=.06+r()*.1,p1=r()*6.28,p2=r()*6.28,N=900,raw=[];
  for(let i=0;i<N;i++){const th=i/N*Math.PI*2,rr=1+a*Math.cos(2*th+p1)+b*Math.cos(3*th+p2);raw.push([rr*Math.cos(th),rr*Math.sin(th)*.68]);}
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const [x,y] of raw){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const pts=raw.map(([x,y])=>[(x-x0)/(x1-x0),(y-y0)/(y1-y0)]),cum=[0];
  for(let i=1;i<=N;i++){const p=pts[i%N],q=pts[i-1];cum.push(cum[i-1]+Math.hypot((p[0]-q[0])*(x1-x0),(p[1]-q[1])*(y1-y0)));}
  const T=cum[N],S=360,ar=[];let j=0;
  for(let i=0;i<S;i++){const d=i/S*T;while(cum[j+1]<d) j++;const f=(d-cum[j])/Math.max(1e-9,cum[j+1]-cum[j]),p=pts[j%N],q=pts[(j+1)%N];ar.push([lerp(p[0],q[0],f),lerp(p[1],q[1],f)]);}
  return u=>{u=((u%1)+1)%1;const f=u*S,i=Math.floor(f)%S,k=f-Math.floor(f),p=ar[i],q=ar[(i+1)%S],pp=ar[(i+2)%S];return {x:lerp(p[0],q[0],k),y:lerp(p[1],q[1],k),a:Math.atan2((pp[1]-p[1])*.68,pp[0]-p[0])};};
}
// distance parcourue (en tours visuels) de chaque voiture à l'avancement p
function compDist(res,p){
  const L=res.ev.vl;
  return res.cars.map((c,i)=>{const wob=c.wa*Math.sin(Math.PI*p)*Math.sin(c.w+p*9);const d=c.dnf==null?c.F*p+wob:Math.min(c.F,.97*p+wob);return {i,c,d:d*L,stop:c.dnf!=null&&d>=c.F-1e-6};});
}
function compShowRace(res,replay){
  if(rcRaf) cancelAnimationFrame(rcRaf);rcRaf=0;
  const ev=res.ev,me=res.cars.find(x=>x.me),fx=res.fx;
  LFX.className='lfx lfx-race';LFX.hidden=false;document.body.classList.add('lfx-on');LFX.setAttribute('aria-label','Course : '+ev.n);
  const sum=()=>{
    if(!me) return '';
    const t=me.dnf!=null?`Abandon : ${esc(me.why.toLocaleLowerCase())}.`:me.rank===1?'Victoire !':`Vous terminez ${me.rank}e sur ${res.nTot}.`;
    return `<p class="rc-sum"><b>${t}</b>${fx&&!replay?` ${fx.prize>0?`Primes : ${moneyF(fx.prize)}. `:'Aucune prime. '}${fx.rep>=.1?`Réputation +${nf(fx.rep,1)}. `:fx.rep<=-.1?`Réputation −${nf(-fx.rep,1)}. `:''}${fx.bonus>0&&me.dnf==null&&me.rank<=3?`Les ventes de la ${esc(fx.model)} vont en profiter. `:''}`:''}</p>`;
  };
  let rcP=0,done=false;
  const rows=fin=>{
    const sorted=fin?res.cars.map((c,i)=>({i,c,stop:c.dnf!=null,d:0})).sort((a,b)=>a.c.rank-b.c.rank):compDist(res,rcP).sort((a,b)=>b.d-a.d);
    return sorted.map((o,k)=>`<li class="${o.c.me?'me':''}${o.stop?' out':''}"><span class="rc-pos">${k+1}</span><i style="background:${o.c.c}"></i><span class="rc-nm">${esc(o.c.n)}<small>${esc(o.c.p)}</small></span><span class="rc-st">${o.stop?'Abandon':fin&&k===0?'Vainqueur':''}</span></li>`).join('');
  };
  const direct=noMotion();
  LFX.innerHTML=`<div class="rc"><header class="rc-h"><div><span class="eyebrow">${esc(ev.tn)} · ${esc(ev.date)}</span><h2>${esc(ev.n)}</h2></div><b class="rc-lap" aria-live="off"></b></header><div class="rc-main">${direct?'':'<canvas class="rc-cv" aria-label="Vue du dessus du circuit"></canvas>'}<ol class="rc-board"></ol></div><div class="rc-end" aria-live="polite"></div><div class="rc-btns"><button class="btn rc-skip" type="button">Passer</button><button class="btn rc-close" type="button" hidden>Fermer</button></div></div>`;
  const board=$('.rc-board',LFX),lap=$('.rc-lap',LFX),end=$('.rc-end',LFX),skip=$('.rc-skip',LFX),close=$('.rc-close',LFX),cv=$('.rc-cv',LFX);
  let draw=()=>{};
  const finish=()=>{
    if(done) return;done=true;rcP=1;if(rcRaf) cancelAnimationFrame(rcRaf);rcRaf=0;
    board.innerHTML=rows(true);lap.textContent='Arrivée';end.innerHTML=sum();skip.hidden=true;close.hidden=false;close.focus({preventScroll:true});
    draw(1);
  };
  close.addEventListener('click',()=>{if(rcRaf) cancelAnimationFrame(rcRaf);rcRaf=0;closeLfx();render();});
  skip.addEventListener('click',finish);
  if(direct){finish();return;}
  const trk=compTrack(ev.track+res.y),ctx=cv.getContext('2d');let W=0,H=0,dpr=1;
  const size=()=>{const w=cv.parentNode.clientWidth-(board.clientWidth||240)-12;W=Math.max(180,Math.min(w,900));H=Math.round(clamp(LFX.clientHeight-210,140,W*.62));dpr=Math.min(2,window.devicePixelRatio||1);cv.style.width=W+'px';cv.style.height=H+'px';cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);};
  size();
  const css=getComputedStyle(document.body),ink=css.getPropertyValue('--ink').trim()||'#fff';
  draw=p=>{
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    const m=22,X=u=>m+u.x*(W-2*m),Y=u=>m+u.y*(H-2*m);
    ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
    for(let i=0;i<=120;i++){const u=trk(i/120);if(i) ctx.lineTo(X(u),Y(u));else ctx.moveTo(X(u),Y(u));}
    ctx.closePath();ctx.strokeStyle='#8a929c';ctx.lineWidth=17;ctx.stroke();ctx.strokeStyle='#3d444d';ctx.lineWidth=13;ctx.stroke();
    ctx.setLineDash([6,8]);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
    const s=trk(0);ctx.save();ctx.translate(X(s),Y(s));ctx.rotate(s.a+Math.PI/2);ctx.fillStyle='#fff';ctx.fillRect(-8,-1.5,16,3);ctx.restore();
    const ds=(p>=1?res.cars.map((c,i)=>({i,c,d:c.F*ev.vl,stop:c.dnf!=null})):compDist(res,p)).sort((a,b)=>a.d-b.d);
    for(const o of ds){
      const c=o.c,u=trk(o.d),off=((o.i%3)-1)*3.2,nx=-Math.sin(u.a)*off,ny=Math.cos(u.a)*off;
      ctx.save();ctx.translate(X(u)+nx,Y(u)+ny);ctx.rotate(u.a);ctx.globalAlpha=o.stop?.45:1;
      ctx.fillStyle=c.c;ctx.fillRect(-6,-3,12,6);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(1,-2.2,3,4.4);
      if(c.me){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(-8,-5,16,10);}
      ctx.restore();
      if(o.stop){ctx.fillStyle='#ff5a4a';ctx.font='bold 12px sans-serif';ctx.fillText('×',X(u)+nx-3,Y(u)+ny-7);}
    }
  };
  void ink;
  const DUR=14000;let el0=0,last=performance.now(),lb=0;
  board.innerHTML=rows(false);
  const tick=now=>{
    if(done||LFX.hidden||!LFX.contains(cv)){rcRaf=0;return;}
    el0+=Math.min(100,now-last);last=now;rcP=Math.min(1,el0/DUR);
    if(rcP>=1){finish();return;}
    draw(rcP);
    const k=Math.min(ev.L,Math.floor(rcP*ev.L)+1);
    lap.textContent=`${ev.unit.replace(/^./,x=>x.toUpperCase())} ${k} sur ${ev.L} · ${ev.L-k} à courir`;
    if(now-lb>200){lb=now;board.innerHTML=rows(false);}
    rcRaf=requestAnimationFrame(tick);
  };
  draw(0);rcRaf=requestAnimationFrame(tick);
  skip.focus({preventScroll:true});
  window.addEventListener('resize',function rs(){if(LFX.hidden||!LFX.contains(cv)){window.removeEventListener('resize',rs);return;}size();draw(rcP);});
}
// ouvre la prochaine course à regarder (si rien d'autre n'occupe l'écran)
function compShowPending(){
  if(!G||!LFX.hidden) return;const c=compSt();
  if(c.show.length){const r=c.show.shift();saveGame();compShowRace(r,false);renderCbar();}
}
function compAfterClose(){if(G&&LFX.hidden) compShowPending();}
