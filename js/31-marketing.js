'use strict';
/* ───────────── Carrière : marketing, réseau, salons et événements ─────────────
   État dans G.mk (créé à la demande : une ancienne partie se charge sans erreur).
   Points d'accroche dans les autres fichiers : demand() → mkDemand, nextQuarter() → mkAfterQuarter,
   unitCost() → mkCostF, capacité de l'usine → mkCap, clockPaused() → mkBusy. */

// canaux de publicité : coût = k × budget de référence ; g = gain de notoriété par trimestre ;
// eff = efficacité selon l'époque ; reach = part de chaque clientèle touchée (ordre de SEGS)
const MK_CH=[
  {k:'affiche',n:'Affiches et presse',from:1900,c:.5,g:1.6,eff:[[1900,1],[1955,.75],[1997,.45],[2008,.3]],reach:[.5,.4,.3,.4,.3],d:'Affiches dans les rues, annonces dans les journaux et les revues.'},
  {k:'radio',n:'Radio',from:1925,c:1.1,g:2.4,eff:[[1925,1],[1970,.85],[1997,.55],[2020,.4]],reach:[.6,.6,.2,.3,.4],d:'Messages publicitaires sur les ondes, en plein trajet ou à la maison.'},
  {k:'tv',n:'Télévision',from:1955,c:2.2,g:4,eff:[[1955,1],[2008,.8],[2020,.55]],reach:[.8,.8,.5,.5,.5],d:'Spots à la télévision : le canal le plus puissant, et le plus cher.'},
  {k:'web',n:'Internet',from:1997,c:1,g:2.5,eff:[[1997,.7],[2008,1],[2040,1]],reach:[.5,.5,.7,.5,.6],d:'Site de la marque, bannières, essais en ligne et comparateurs.'},
  {k:'social',n:'Réseaux sociaux',from:2008,c:1,g:3,eff:[[2008,.8],[2015,1],[2040,1]],reach:[.7,.4,.8,.3,.4],d:'Vidéos, influenceurs et jeux concours auprès d\'un public jeune.'},
];
const MK_NET=[1,2,3,5,8,12,20,30,50,80,120,200,300,500,800,1200,2000,3000,5000,8000];
const MK_NETW={Citadine:1,Familiale:.8,'Tout-terrain':.4,Sportive:.15,'Grand tourisme':.1};
const MK_SALONS=[
  {id:'val',n:'Salon de l\'Automobile de Valmont',q:3,when:'octobre',from:1900,k:1,d:'Le grand rendez-vous annuel de la profession.'},
  {id:'azu',n:'Concours d\'élégance de Port-Azur',q:1,when:'juin',from:1920,k:.8,d:'Une vitrine pour les voitures de prestige.'},
  {id:'rhe',n:'Foire internationale de Rhéno',q:0,when:'mars',from:1950,k:1.2,d:'Une foire commerciale très fréquentée par les familles.'},
  {id:'cyb',n:'Salon en ligne de Cybermont',q:2,when:'septembre',from:2020,k:.5,d:'Un salon entièrement virtuel : stand peu coûteux, public plus dispersé.'},
];
let MK_HOOK=false;
const mkPerD=y=>itp([[1900,12],[1920,30],[1950,60],[1980,150],[2020,300]],y);
const mkQI=()=>G.y*4+G.q;
const mkBase=()=>mkQI()+(MK_HOOK?1:0);
const mkRq=()=>Math.max((G.lastQ&&G.lastQ.rev)||0,.03*G.startCash);
const mkB=()=>.03*mkRq();
const mkRound=x=>Math.max(100,roundNice(x));

function mk(){
  if(!G.mk||typeof G.mk!=='object') G.mk={};
  const m=G.mk;
  if(typeof m.N!=='number'||!isFinite(m.N)) m.N=clamp(12+G.rep*.25,0,100);
  if(!m.ch) m.ch={};
  if(!Array.isArray(m.fx)) m.fx=[];
  if(!Array.isArray(m.log)) m.log=[];
  if(!m.salon) m.salon={};
  if(m.target===undefined) m.target=0;
  if(typeof m.net!=='number'){
    const need=.8*capOfFac(G.fac||0),y=G.y;let l=0;
    while(l<MK_NET.length-1&&MK_NET[l]*mkPerD(y)<need) l++;
    m.net=l;
  }
  return m;
}
const mkBusy=()=>!!(G&&G.mk&&G.mk.pend);
function mkCap(){if(!G||!G.mk) return 1;let f=1;for(const e of G.mk.fx) if(e.k==='cap'&&mkQI()<=e.until) f*=e.v;return f;}
function mkCostF(){if(!G||!G.mk) return 1;let f=1;for(const e of G.mk.fx) if(e.k==='cost'&&mkQI()<=e.until) f*=e.v;return f;}
function mkFx(k,v,n,lab){mk().fx.push({k,v,until:mkBase()+n-1,lab});}
function mkChOn(y){return MK_CH.filter(c=>y>=c.from&&mk().ch[c.k]);}
function mkAdPow(c,y){return c.g*itp(c.eff,y);}
// part de chaque clientèle touchée par les campagnes actives (0 à 1)
function mkCov(y){const on=mkChOn(y);return SEGS.map((s,i)=>clamp(on.reduce((a,c)=>a+c.reach[i]*itp(c.eff,y),0),0,1));}
const mkNotoF=()=>.75+.5*mk().N/100;
const mkNetCap=y=>MK_NET[clamp(mk().net,0,MK_NET.length-1)]*mkPerD(y);
const mkNetUp=y=>{const p=MK_NET[mk().net]*mkPerD(y);return p*refPrice(y)*.008;};
function mkNetStepCost(y){const l=mk().net;if(l>=MK_NET.length-1) return 0;return (MK_NET[l+1]-MK_NET[l])*mkPerD(y)*refPrice(y)*.06;}

/* ── effet sur la demande (appelé par demand()) ── */
function mkDemand(models,out,y){
  if(!G) return out;
  const m=mk(),real=models.length>0&&models[0].id!=null,cov=mkCov(y),nf0=mkNotoF(),qi=mkQI();
  let D=0;
  models.forEach((md,j)=>{
    let tot=0;
    SEGS.forEach((s,i)=>{
      let f=nf0*(1+.1*cov[i]);
      if(real){
        if(m.target===md.id) f*=1+.15*cov[i];
        if(md.salonQ!=null&&md.salonQ>=qi) f*=1.06;
        if(md.mkMal&&md.mkMal.until>=qi) f*=md.mkMal.v;
      }
      out[j].seg[s.k]*=f;tot+=out[j].seg[s.k];
    });
    out[j].tot=tot;D+=tot;
  });
  if(!real||D<=0) return out;
  const L=1.5*mkNetCap(y),fac=capOfFac(G.fac||0)*mkCap(),q=mkNetCap(y)/Math.min(D,fac);
  const bonus=q>1.25?Math.min(.12,.06*Math.log2(q/1.25)):0,loss=D<=L?1:clamp(L/D,.55,1);
  m.q=q;m.loss=1-Math.min(D*loss,fac)/Math.min(D,fac);
  models.forEach((md,j)=>{
    let tot=0;
    SEGS.forEach(s=>{const f=(1+bonus*(MK_NETW[s.k]||0))*loss;out[j].seg[s.k]*=f;tot+=out[j].seg[s.k];});
    out[j].tot=tot;
  });
  return out;
}

/* ── fin de trimestre (appelé par nextQuarter() après le calcul des ventes) ── */
function mkAfterQuarter(){
  if(!G||!G.lastQ) return;
  const m=mk(),lq=G.lastQ,y=yq();
  MK_HOOK=true;
  try{
    if(m.pend) mkResolve(mkDefault(),true);
    m.fx=m.fx.filter(e=>e.until>=mkQI());
    // coûts du trimestre
    const B=mkB(),on=mkChOn(y);
    const pub=on.reduce((a,c)=>a+c.c*B,0),net=mkNetUp(y);
    let ev=0;
    // contrat de flotte
    if(m.fleet&&mkQI()<=m.fleet.until){
      const prod=G.models.filter(x=>x.st==='prod');
      if(prod.length){
        const room=Math.max(0,lq.cap/4-lq.units),n=Math.min(m.fleet.n,Math.floor(room));
        if(n>0){
          const price=prod.reduce((a,x)=>a+x.price,0)/prod.length*m.fleet.disc,best=prod.slice().sort((a,b)=>a.met.cost-b.met.cost)[0];
          const uc=unitCost(best.met,Math.max(lq.units*4,n*4));
          lq.rev+=n*price;lq.units+=n;lq.profit+=n*(price-uc);G.cash+=n*(price-uc);G.acc.rev+=n*price;G.acc.units+=n;G.acc.profit+=n*(price-uc);
          m.fleet.done=(m.fleet.done||0)+n;
        }
      }
    }else if(m.fleet){news(`Contrat de flotte terminé`,`${m.fleet.who} : ${nf(m.fleet.done||0)} voitures livrées en tout.`,'info');m.fleet=null;}
    const tot=pub+net;
    G.cash-=tot;lq.profit-=tot;G.acc.cost+=tot;G.acc.profit-=tot;
    lq.mk={pub,net,ev,total:tot};
    // notoriété : ventes, publicité, oubli progressif
    const org=2*clamp(Math.log10(1+lq.units)/3,0,1)*(.6+.8*G.rep/100);
    let adg=Math.min(9,on.reduce((a,c)=>a+mkAdPow(c,y),0));if(m.target) adg*=.8;
    m.N=clamp(m.N+(org+adg)*(1-m.N/100)-.04*m.N,0,100);
    // salons à venir
    const nq=(G.q+1)%4,ny=G.y+(G.q===3?1:0);
    for(const s of MK_SALONS) if(s.q===nq&&ny>=s.from) news(`${s.n} : ouverture ce trimestre`,`${s.d} Vous pouvez y présenter un modèle depuis la page Marketing (stand : ${moneyF(mkSalonCost(s,ny+nq/4),ny)}).`,'info');
    mkRoll();
  }finally{MK_HOOK=false;}
}

/* ── salons ── */
function mkSalonCost(s,y){return 2.2*s.k*mkB();}
function mkSalonsOpen(){return MK_SALONS.filter(s=>s.q===G.q&&G.y>=s.from);}
function mkSalonDone(s){return mk().salon[s.id]===G.y;}
function mkSalonGo(id,mid){
  const s=MK_SALONS.find(x=>x.id===id),md=G.models.find(x=>x.id==mid&&x.st==='prod');
  if(!s||!md||s.q!==G.q||G.y<s.from||mkSalonDone(s)) return 'Ce salon n\'est pas disponible.';
  const c=mkSalonCost(s,yq());
  if(G.cash+loanLimit()-G.debt<c) return 'Trésorerie insuffisante pour le stand.';
  const m=mk();G.cash-=c;m.salon[s.id]=G.y;
  const gain=8*s.k*(1-m.N/130);m.N=clamp(m.N+gain,0,100);md.salonQ=mkQI()+3;
  news(`${md.name} au ${s.n}`,`Le stand de ${G.co} a attiré la foule (coût ${moneyF(c)}). Notoriété en hausse, et la ${md.name} profite de cet élan pendant un an.`,'good');
  coverCash();return null;
}

/* ── événements ── */
const mkPay=(c)=>{G.cash-=c;coverCash();};
const mkPick=a=>a[Math.floor(Math.random()*a.length)];
const mkProd=()=>G.models.filter(x=>x.st==='prod');
const EVT=[
  {id:'greve',w:y=>y<1906?0:(y>=1936&&y<=1938)||y===1968?3:1,
   init:()=>({c:mkRound(.28*mkRq())}),
   make:p=>({t:'Grève à l\'usine',d:'Les ouvriers cessent le travail et réclament une hausse des salaires.',def:1,opts:[
     {l:'Céder aux revendications',s:`Coût immédiat : ${moneyF(p.c)}. L'usine reprend tout de suite et le climat social s'apaise.`,f:()=>{mkPay(p.c);G.rep=clamp(G.rep+1,0,100);news('Grève terminée',`Vous avez accordé les augmentations demandées (${moneyF(p.c)}). L'usine redémarre.`,'info');}},
     {l:'Tenir bon',s:'Aucun coût immédiat, mais la production tombe à 50 % de la capacité pendant 2 trimestres (ventes perdues si vous en vendiez davantage), les coûts montent de 8 % et la réputation baisse de 3 points.',f:()=>{mkFx('cap',.5,2);mkFx('cost',1.08,2);G.rep=clamp(G.rep-3,0,100);news('La grève se durcit','Vous refusez toute concession : l\'usine tourne au ralenti pendant deux trimestres.','warn');}}]})},
  {id:'acier',w:y=>y>=2020?.3:(y>=1916&&y<=1922)||(y>=1945&&y<=1951)?3:y>=1973&&y<=1975?2:.4,
   init:()=>({}),
   make:()=>({t:'Pénurie d\'acier',d:'Les aciéries manquent de matière : les livraisons sont rares et les prix s\'envolent.',def:0,opts:[
     {l:'Acheter au prix fort',s:'Les coûts de fabrication montent de 15 % pendant 2 trimestres, mais la production continue normalement.',f:()=>{mkFx('cost',1.15,2);news('Acier : vous payez le prix fort','Les voitures reviennent plus cher à fabriquer pendant deux trimestres.','info');}},
     {l:'Attendre les livraisons',s:'Aucun surcoût, mais la production tombe à 70 % de la capacité pendant 2 trimestres.',f:()=>{mkFx('cap',.7,2);news('Acier : la production ralentit','Faute de matière, l\'usine tourne à 70 % pendant deux trimestres.','warn');}}]})},
  {id:'puces',w:y=>y<2020?0:y<=2024?3:.4,
   init:()=>({}),
   make:()=>({t:'Pénurie de puces électroniques',d:'Les fabricants de composants ne livrent plus assez : les calculateurs manquent dans toute l\'industrie.',def:0,opts:[
     {l:'Payer pour être servi en priorité',s:'Les coûts de fabrication montent de 12 % pendant 3 trimestres, mais vos voitures sont terminées à temps.',f:()=>{mkFx('cost',1.12,3);news('Puces : fournisseurs payés en priorité','Surcoût de 12 % pendant trois trimestres.','info');}},
     {l:'Produire moins',s:'Aucun surcoût, mais la production tombe à 60 % de la capacité pendant 3 trimestres.',f:()=>{mkFx('cap',.6,3);news('Puces : production réduite','L\'usine tourne à 60 % pendant trois trimestres.','warn');}}]})},
  {id:'rappel',w:()=>.9,
   init:()=>{const ps=mkProd().filter(x=>x.sold>0);if(!ps.length) return null;const pool=[];for(const x of ps) for(let i=0;i<1+Math.round(3*x.met.dw);i++) pool.push(x);const md=mkPick(pool);return {mid:md.id,c:mkRound(Math.min(.04*md.sold*md.price,1.2*mkRq()))};},
   make:p=>{const md=G.models.find(x=>x.id===p.mid)||{name:'?'};return {t:`Défaut grave sur la ${md.name}`,d:`Un défaut de fabrication dangereux a été découvert sur la ${md.name}. Aucun accident n'est encore signalé.`,def:0,opts:[
     {l:'Rappel volontaire',s:`Coût : ${moneyF(p.c)}. Toutes les voitures sont réparées gratuitement, votre réputation est préservée et la marque passe pour sérieuse.`,f:()=>{mkPay(p.c);mk().N=clamp(mk().N+1.5,0,100);news(`Rappel de la ${md.name}`,`Vous prenez les devants (${moneyF(p.c)}). Les clients saluent votre honnêteté.`,'good');}},
     {l:'Ne rien dire',s:'Aucun coût, mais environ une chance sur deux que le défaut éclate au grand jour : scandale, réputation −12, notoriété −8 et ventes de ce modèle −25 % pendant 4 trimestres.',f:()=>{if(Math.random()<.5){G.rep=clamp(G.rep-12,0,100);mk().N=clamp(mk().N-8,0,100);md.mkMal={v:.75,until:mkBase()+3};news(`Scandale : la ${md.name}`,'Un accident révèle le défaut que vous aviez tu. La presse est sévère.','crit');}else news(`La ${md.name} : le défaut passe inaperçu`,'Cette fois, rien n\'est révélé. Le risque reste réel.','info');}}]};}},
  {id:'journaliste',w:()=>.9,
   init:()=>({c:mkRound(.02*mkRq()),pr:clamp(.2+G.rep/100,.2,.9)}),
   make:p=>({t:G.y<1930?'Visite d\'un journaliste':G.y<1990?'Un reporter demande à visiter l\'usine':'Un journaliste prépare un reportage sur votre marque',d:'Il veut voir les ateliers et poser ses questions en toute liberté.',def:1,opts:[
     {l:'Lui ouvrir les portes',s:`Coût : ${moneyF(p.c)}. Environ ${nf(p.pr*100)} chances sur 100 d'obtenir un article flatteur (notoriété +7, réputation +2) ; sinon critiques (notoriété +2, réputation −3). Plus votre réputation est bonne, plus c'est probable.`,f:()=>{mkPay(p.c);if(Math.random()<p.pr){mk().N=clamp(mk().N+7,0,100);G.rep=clamp(G.rep+2,0,100);news('Article flatteur sur votre marque','Le journaliste a été séduit par ce qu\'il a vu.','good');}else{mk().N=clamp(mk().N+2,0,100);G.rep=clamp(G.rep-3,0,100);news('Article critique sur votre marque','Le journaliste a surtout retenu les points faibles de l\'entreprise.','warn');}}},
     {l:'Décliner poliment',s:'Rien ne change.',f:()=>{}}]})},
  {id:'flotte',w:y=>y<1905?0:1,
   init:()=>{const prod=mkProd();if(!prod.length) return null;const y=G.y,l=[];
     if(y>=1905) l.push('une compagnie de taxis');
     if((y>=1914&&y<=1918)||(y>=1939&&y<=1945)) l.push('l\'armée','l\'armée');
     if(y>=1920&&!(y>=1939&&y<=1945)) l.push('l\'administration');
     if(y>=2005) l.push('un loueur de voitures d\'entreprise');
     return {who:mkPick(l),n:Math.max(3,Math.round(.15*capOfFac(G.fac)/4)),disc:.85};},
   make:p=>({t:`Contrat de flotte : ${p.who}`,d:`${p.who.replace(/^./,c=>c.toLocaleUpperCase())} souhaite équiper ses services avec vos voitures.`,def:1,opts:[
     {l:'Accepter le contrat',s:`${p.n} voitures par trimestre pendant 4 trimestres, à 85 % du prix catalogue, livrées seulement si l'usine a de la place. Marge réduite, mais ventes assurées et notoriété +4.`,f:()=>{mk().fleet={until:mkBase()+3,n:p.n,disc:p.disc,who:p.who,done:0};mk().N=clamp(mk().N+4,0,100);news('Contrat de flotte signé',`${p.who} commande ${p.n} voitures par trimestre pendant un an.`,'good');}},
     {l:'Décliner',s:'Rien ne change.',f:()=>{}}]})},
  {id:'incendie',w:y=>y<1950?.8:.4,
   init:()=>({c:mkRound(.35*mkRq()),ins:G.y>=1925}),
   make:p=>({t:'Incendie dans l\'atelier',d:'Un feu s\'est déclaré dans un bâtiment de l\'usine. Personne n\'est blessé, mais des machines sont détruites.',def:0,opts:[
     {l:'Reconstruire sans attendre',s:`Coût : ${moneyF(p.ins?p.c*.5:p.c)}${p.ins?' (l\'assurance prend la moitié à sa charge)':''}. La production n'est pas interrompue.`,f:()=>{mkPay(p.ins?p.c*.5:p.c);news('Atelier reconstruit','Les machines sont remplacées et la production continue.','info');}},
     {l:'Réparer au plus juste',s:`Coût : ${moneyF(p.c*.4)}. La production tombe à 60 % de la capacité pendant 2 trimestres.`,f:()=>{mkPay(p.c*.4);mkFx('cap',.6,2);news('Atelier réparé à la hâte','L\'usine tourne à 60 % pendant deux trimestres.','warn');}}]})},
  {id:'inflation',auto:1,w:y=>(y>=1946&&y<=1950)||(y>=1968&&y<=1976)||(y>=2021&&y<=2023)?2.5:y>=1920?.4:0,
   init:()=>({}),
   run:()=>{mkFx('cost',1.06,4);news('Inflation des salaires','Les salaires montent : les voitures coûtent 6 % de plus à fabriquer pendant un an.','warn');}},
  {id:'aide',auto:1,w:y=>(y>=1919&&y<=1920)||(y>=1930&&y<=1934)||(y>=1946&&y<=1948)||y===1975||y===2009||y===2010||y===2020||y===2021?2.5:y>=1945?.3:0,
   init:()=>({c:mkRound(.35*mkRq())}),
   run:p=>{G.cash+=p.c;news('Aide de l\'État',`Le gouvernement soutient l'industrie automobile : ${moneyF(p.c)} versés à ${G.co}.`,'good');}},
];
function mkRoll(){
  const m=mk(),y=G.y;
  if(m.evY!==y){m.evY=y;m.evN=0;}
  if(m.pend||m.evN>=3||!mkProd().length||mkQI()<G.start*4+3) return;
  if(Math.random()>(m.evN===0&&G.q===3?.9:.42)) return;
  const c=EVT.map(e=>[e,e.w(y)]).filter(x=>x[1]>0);
  let t=c.reduce((a,x)=>a+x[1],0)*Math.random(),e=null;
  for(const x of c){t-=x[1];if(t<=0){e=x[0];break;}}
  if(!e) return;
  const p=e.init();if(!p) return;
  m.evN++;
  if(e.auto){e.run(p);return;}
  m.pend={id:e.id,p};
  news(`Décision à prendre : ${e.make(p).t}`,'Une fenêtre vous propose de choisir.','warn');
}
function mkSpec(){const m=G.mk,e=m&&m.pend&&EVT.find(x=>x.id===m.pend.id);return e?e.make(m.pend.p):null;}
function mkDefault(){const s=mkSpec();return s?s.def:0;}
function mkResolve(i,quiet){
  const m=G.mk,s=mkSpec();
  if(!s){if(m) m.pend=null;return;}
  const o=s.opts[i]||s.opts[s.def];
  const h=MK_HOOK;
  m.pend=null;
  try{o.f();}catch(e){}
  m.log.unshift({y:G.y,q:G.q,t:s.t,c:o.l});if(m.log.length>6) m.log.length=6;
  MK_HOOK=h;
  if(!quiet){saveGame();renderCbar();render();}
}
/* fenêtre de décision */
const MKM=el('div','modal');MKM.id='mkEv';MKM.hidden=true;document.body.appendChild(MKM);
function mkShowModal(){
  const s=mkSpec();if(!s){MKM.hidden=true;return;}
  const sig=G.mk.pend.id+JSON.stringify(G.mk.pend.p);
  if(!MKM.hidden&&MKM.dataset.sig===sig) return;
  MKM.dataset.sig=sig;MKM.hidden=false;
  MKM.innerHTML=`<div class="modal-card mk-dlg" role="dialog" aria-modal="true" aria-labelledby="mkEvT"><span class="eyebrow">${Q[G.q]} ${G.y} · le temps est en pause</span><h2 id="mkEvT">${esc(s.t)}</h2><p>${esc(s.d)}</p><div class="mk-opts">${s.opts.map((o,i)=>`<button class="mk-opt" type="button" data-mkopt="${i}"><b>${esc(o.l)}</b><span>${esc(o.s)}</span></button>`).join('')}</div></div>`;
  const b=$('.mk-opt',MKM);if(b) b.focus({preventScroll:true});
}
MKM.addEventListener('click',e=>{const b=e.target.closest('[data-mkopt]');if(!b||!G||!G.mk||!G.mk.pend) return;mkResolve(+b.dataset.mkopt);MKM.hidden=true;MKM.innerHTML='';});
setInterval(()=>{
  if(!G||!G.mk||!G.mk.pend||G.over){if(!MKM.hidden){MKM.hidden=true;MKM.innerHTML='';}return;}
  if(!$('#home').hidden||!LFX.hidden) return;
  mkShowModal();
},250);

/* ── page Marketing ── */
function mkStars(v){return v>=3?'très forte':v>=2?'forte':v>=1.2?'moyenne':'faible';}
function mkHTML(){
  const m=mk(),y=yq(),B=mkB(),prod=mkProd(),on=mkChOn(y);
  const cov=mkCov(y);
  let h=`<section class="cgrp"><h3>Notoriété de la marque</h3><div class="gmeter" role="img" aria-label="Notoriété ${nf(m.N)} sur 100"><i style="width:${m.N.toFixed(1)}%"></i></div>
   <div class="tiles">${tile('Notoriété',nf(m.N)+' / 100',m.N>=60?'Marque très connue':m.N>=35?'Marque connue':'Marque peu connue')}${tile('Effet sur la demande','× '+nf(mkNotoF(),2),'de × 0,75 (inconnue) à × 1,25 (célèbre)')}${tile('Réputation',nf(G.rep)+' / 100','qualité perçue de vos voitures')}</div>
   <p class="grp-note">La notoriété mesure à quel point on connaît votre marque ; la réputation, la qualité qu'on lui prête. Vos ventes, les salons et la publicité la font monter ; elle baisse lentement sans publicité. La publicité est utile mais jamais obligatoire.</p></section>`;
  const lq=G.lastQ&&G.lastQ.mk;
  h+=`<section class="cgrp"><h3>Publicité</h3><ul class="mk-l">${MK_CH.filter(c=>y>=c.from).map(c=>{const a=!!m.ch[c.k];const p=mkAdPow(c,y);const seg=SEGS.filter((s,i)=>c.reach[i]*itp(c.eff,y)>=.4).map(s=>s.n.toLocaleLowerCase());
    return `<li class="${a?'is-on':''}"><div><b>${c.n}</b><p>${c.d}</p><small>Efficacité ${mkStars(p)} · touche surtout : ${seg.length?seg.join(', '):'peu de monde'} · ${moneyF(c.c*B)} par trimestre</small></div><div><button class="chip-btn" type="button" data-mkch="${c.k}" aria-pressed="${a}"${G.over?' disabled':''}>${a?'Arrêter':'Lancer'}</button></div></li>`;}).join('')}</ul>
   <p class="grp-note">Budget actuel : <b>${moneyF(on.reduce((a,c)=>a+c.c*B,0))}</b> par trimestre${lq?` · dernier trimestre, publicité ${moneyF(lq.pub)}, réseau ${moneyF(lq.net)}`:''}. Les coûts dépendent de l'époque et de la taille de votre chiffre d'affaires.</p>
   <div class="f"><div class="f-top"><label for="mkTarget">Cibler un modèle</label></div><select class="sel" id="mkTarget"><option value="0">Aucun : promouvoir la marque</option>${prod.map(x=>`<option value="${x.id}"${m.target===x.id?' selected':''}>${esc(x.name)}</option>`).join('')}</select><p class="hint">Un modèle ciblé gagne jusqu'à 15 % de demande auprès des clientèles touchées, mais la notoriété de la marque progresse 20 % moins vite.</p></div></section>`;
  const cap=mkNetCap(y),pts=MK_NET[m.net],nl=m.net+1<MK_NET.length,sc=mkNetStepCost(y);
  const lost=m.loss!=null&&prod.length?m.loss:0;
  h+=`<section class="cgrp"><h3>Réseau de concessionnaires</h3><div class="tiles">${tile('Points de vente',nf(pts),`vendent chacun environ ${nf(mkPerD(y),-1)} voitures par an`)}${tile('Capacité de vente',nf(cap,-1)+' / an','ventes au-delà : en partie perdues')}${tile('Entretien',moneyF(mkNetUp(y))+' / trim.','charges du réseau')}${tile('Ventes perdues',lost>.005?nf(lost*100)+' %':'aucune',lost>.005?'réseau trop petit':'réseau suffisant')}</div>
   <p class="grp-note">Un réseau trop petit laisse partir des clients : une partie de la demande est perdue. Un grand réseau aide surtout les clientèles populaire et familiale.</p>
   <div class="btns">${nl?`<button class="btn sm" type="button" data-mknet="1"${G.over?' disabled':''}>Passer à ${nf(MK_NET[m.net+1])} points de vente · ${moneyF(sc)}</button>`:'<span class="grp-note">Réseau mondial : taille maximale.</span>'}</div></section>`;
  const op=mkSalonsOpen();
  h+=`<section class="cgrp"><h3>Salons automobiles</h3><ul class="mk-l">${MK_SALONS.filter(s=>G.y>=s.from).map(s=>{const open=s.q===G.q,done=mkSalonDone(s);
    const st=done?'<span class="pill ok">Présenté cette année</span>':open?`<span class="pill">Ouvert ce trimestre</span>`:`<span class="pill off">${s.when} (${Q[s.q]})</span>`;
    return `<li class="${open&&!done?'is-on':''}"><div><b>${s.n}</b><p>${s.d} Chaque année en ${s.when}. Stand : ${moneyF(mkSalonCost(s,y))}.</p></div><div>${st}</div></li>`;}).join('')}</ul>
   ${op.some(s=>!mkSalonDone(s))?(prod.length?`<div class="f"><div class="f-top"><label for="mkSalonM">Modèle à présenter</label></div><select class="sel" id="mkSalonM">${prod.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div class="btns">${op.filter(s=>!mkSalonDone(s)).map(s=>`<button class="btn sm" type="button" data-mksalon="${s.id}"${G.over?' disabled':''}>Présenter au ${esc(s.n)} · ${moneyF(mkSalonCost(s,y))}</button>`).join('')}</div><p class="hint">Un salon donne un pic de notoriété et un an d'élan (+6 % de demande) au modèle présenté.</p>`:'<p class="grp-note">Il faut un modèle en vente pour exposer.</p>'):'<p class="grp-note">Aucun salon à présenter ce trimestre.</p>'}
   ${ui.mkMsg?`<p class="grp-note" role="status">${esc(ui.mkMsg)}</p>`:''}</section>`;
  if(m.log.length) h+=`<section class="cgrp"><h3>Décisions récentes</h3><ul class="news">${m.log.map(x=>`<li class="nw-info"><span class="eyebrow">${Q[x.q]} ${x.y}</span><b>${esc(x.t)}</b><p>Votre choix : ${esc(x.c)}.</p></li>`).join('')}</ul></section>`;
  return `<div class="career">${h}</div>`;
}
function mkClick(e){
  if(!G) return false;
  const b=e.target.closest('button');if(!b) return false;
  const m=mk();ui.mkMsg='';
  if(b.dataset.mkch){const c=MK_CH.find(x=>x.k===b.dataset.mkch);if(c&&yq()>=c.from) m.ch[c.k]=!m.ch[c.k];}
  else if(b.dataset.mknet){const c=mkNetStepCost(yq());if(m.net+1<MK_NET.length){if(G.cash+loanLimit()-G.debt<c) ui.mkMsg='Trésorerie insuffisante.';else{G.cash-=c;m.net++;news('Réseau agrandi',`${nf(MK_NET[m.net])} points de vente (investissement ${moneyF(c)}).`,'good');coverCash();}}}
  else if(b.dataset.mksalon){const s=$('#mkSalonM');ui.mkMsg=mkSalonGo(b.dataset.mksalon,s?s.value:0)||'';}
  else return false;
  saveGame();renderCbar();render();
  return true;
}
$('#stage').addEventListener('click',e=>{if(mkClick(e)) e.stopImmediatePropagation();},true);
$('#stage').addEventListener('change',e=>{if(!G||e.target.id!=='mkTarget') return;mk().target=+e.target.value||0;saveGame();render();});
function mkCardText(){const m=mk(),n=mkChOn(yq()).length;return `Notoriété ${nf(m.N)} / 100 · ${n} campagne${n>1?'s':''}`;}
function mkTodo(t,prod){
  const m=mk();if(!prod.length) return;
  if(m.N<25) t.push({t:'Votre marque est peu connue',d:`Notoriété ${nf(m.N)} sur 100 : une publicité ou un salon ferait venir plus de clients (facultatif).`,b:'<button class="chip-btn" type="button" data-go="marketing">Voir le marketing</button>'});
  if(m.loss>.1) t.push({t:'Votre réseau de vente est trop petit',d:`Environ ${nf(m.loss*100)} % de la demande est perdue faute de points de vente.`,b:'<button class="chip-btn" type="button" data-go="marketing">Agrandir le réseau</button>'});
  const op=mkSalonsOpen().filter(s=>!mkSalonDone(s));
  if(op.length) t.push({t:`${op[0].n} ouvre ce trimestre`,d:'Vous pouvez y présenter l\'un de vos modèles (facultatif).',b:'<button class="chip-btn" type="button" data-go="marketing">Voir les salons</button>'});
}
