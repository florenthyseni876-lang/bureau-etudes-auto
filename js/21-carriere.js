'use strict';
/* ───────────── Carrière : entreprise, marché, finances ─────────────
   Monnaie en euros constants (valeur 2020) pour comparer les époques.
   Le temps avance par trimestre. Les attentes des clients (puissance, vitesse, confort,
   sécurité, consommation, prix) suivent l'année : une voiture vieillit même sans changer. */

const MARKET=[[1900,9e3],[1905,3e4],[1910,1.2e5],[1920,4e5],[1930,9e5],[1938,1.1e6],[1950,1.5e6],[1960,4e6],[1970,8e6],[1980,1e7],[1990,1.3e7],[2000,1.5e7],[2010,1.5e7],[2020,1.4e7],[2040,1.4e7]];
const SHOCK={1914:.3,1915:.25,1916:.25,1917:.25,1918:.3,1919:.7,1930:.7,1931:.6,1932:.55,1933:.75,1940:.15,1941:.1,1942:.08,1943:.08,1944:.08,1945:.2,1946:.5,1947:.75,1974:.85,1975:.9,1980:.92,1981:.9,1993:.92,2009:.85,2010:.92,2020:.78,2021:.88};
const NCOMP=[[1900,60],[1925,80],[1950,50],[1970,35],[2000,25],[2040,25]];
const REF={
  P:[[1900,22],[1910,28],[1920,34],[1930,42],[1950,50],[1960,62],[1970,78],[1980,88],[1990,102],[2000,118],[2010,132],[2020,150]],
  V:[[1900,70],[1910,82],[1920,92],[1930,105],[1950,120],[1960,138],[1970,152],[1980,165],[1990,180],[2000,192],[2010,202],[2020,208]],
  comf:[[1900,32],[1950,45],[1970,55],[2000,62],[2020,66]],
  saf:[[1900,24],[1960,32],[1980,48],[2000,70],[2020,82]],
  hand:[[1900,45],[1960,50],[2000,62],[2020,66]],
  cons:[[1900,14],[1950,11],[1975,9.5],[2000,7.5],[2020,6]],
  prest:[[1900,22],[2020,50]],
};
const ECO_IMP=[[1900,.3],[1972,.5],[1974,1.2],[1990,1],[2008,1.3],[2020,1.5]];
const SAF_IMP=[[1900,.2],[1965,.3],[1975,.8],[1995,1.2]];
const PROD_EXP=[[1900,2.4],[1913,2.4],[1916,1.6],[1922,1.6],[1926,1.36],[1978,1.36],[1982,1.16],[1988,1.16],[1992,1.04],[2000,1.04],[2004,.94]];
const DEVF=[[1900,1],[1920,2],[1950,6],[1970,20],[1990,80],[2010,300],[2020,500]];
const BASECOST=[[1900,14000],[1960,15000],[1980,16500],[2000,19000],[2020,22000]];
// segments de clientèle : clé = nom du segment calculé par computeCar
const SEGS=[
  {k:'Citadine',n:'Populaire',pm:1,el:2,pmax:2.5,sp:.8,sv:.9,share:[[1900,.2],[1920,.32],[1950,.35],[1980,.3],[2020,.22]],w:{P:.12,V:.05,comf:.1,rel:.2,eco:.2,saf:.1,pract:.1}},
  {k:'Familiale',n:'Familiale',pm:1.5,el:1.6,pmax:2,sp:1,sv:1,share:[[1900,.1],[1930,.22],[1960,.3],[1990,.32],[2020,.25]],w:{P:.15,V:.05,comf:.2,rel:.2,eco:.15,saf:.2,pract:.25}},
  {k:'Sportive',n:'Sportive',pm:2.2,el:1,pmax:1.4,sp:1.8,sv:1.2,share:[[1900,.2],[1930,.1],[1960,.1],[2020,.06]],w:{P:.45,V:.25,hand:.25,rel:.05,prest:.1}},
  {k:'Grand tourisme',n:'Luxe',pm:3,el:.6,pmax:1.15,sp:1.6,sv:1.1,share:[[1900,.45],[1930,.26],[1960,.15],[2020,.12]],w:{P:.2,V:.1,comf:.3,prest:.8,rel:.1,saf:.1}},
  {k:'Tout-terrain',n:'Utilitaire et tout-terrain',pm:1.6,el:1.2,pmax:1.8,sp:1.1,sv:.85,share:[[1900,.05],[1930,.1],[1960,.1],[1990,.12],[2020,.35]],w:{off:.4,P:.15,rel:.25,pract:.2}},
];
// part des acheteurs d'un segment qui envisagent cette carrosserie
const FIT={
  Citadine:{citadine:1,compacte:.8,berline:.45,break:.3,coupe:.2,roadster:.25,suv:.2,pickup:.05,supercar:0},
  Familiale:{citadine:.3,compacte:.75,berline:1,break:1,coupe:.15,roadster:.05,suv:.85,pickup:.25,supercar:0},
  Sportive:{citadine:.3,compacte:.55,berline:.3,break:.1,coupe:1,roadster:1,suv:.15,pickup:.05,supercar:.9},
  'Grand tourisme':{citadine:.05,compacte:.15,berline:.8,break:.5,coupe:.85,roadster:.6,suv:.7,pickup:.05,supercar:.8},
  'Tout-terrain':{citadine:.03,compacte:.05,berline:.1,break:.35,coupe:.02,roadster:.02,suv:1,pickup:1,supercar:0},
};
const FAC=[['Atelier',60],['Fabrique',600],['Usine',6000],['Grande usine',50000],['Complexe industriel',250000],['Groupe mondial',1000000]];
// normes : y = nouveaux modèles, ya = toutes les voitures vendues
const REGS=[
  {y:1970,ya:1971,n:'Ceintures de sécurité avant obligatoires',ok:m=>m.passive!=='min',need:'sécurité passive « Standard » (ceintures, zones déformables)'},
  {y:1992,ya:1993,n:'Norme Euro 1 : pot catalytique et injection pour les moteurs à essence',ok:m=>m.diesel||m.emis,need:'injection et catalyseur 3 voies'},
  {y:1996,ya:1997,n:'Norme Euro 2 : catalyseur d\'oxydation pour les diesels',ok:m=>!m.diesel||(m.cat?m.cat!=='none':m.emis),need:'un catalyseur'},
  {y:2004,ya:2004,n:'ABS sur toutes les voitures neuves (engagement des constructeurs européens)',ok:m=>m.abs,need:'ABS'},
  {y:2009,ya:2011,n:'Norme Euro 5 : filtre à particules pour les diesels',ok:m=>!m.diesel||m.cat==='gpf',need:'filtre à particules'},
  {y:2011,ya:2014,n:'Contrôle de stabilité (ESP) obligatoire',ok:m=>m.esp,need:'ESP'},
  {y:2017,ya:2018,n:'Norme Euro 6c : filtre à particules pour l\'injection directe essence',ok:m=>m.diesel||!m.di||m.cat==='gpf',need:'filtre à particules'},
];
// monnaie de l'époque : unités par euro de 2020 (francs germinal, anciens francs, nouveaux francs, euros)
const FX=[[1900,.254],[1914,.28],[1919,.6],[1920,.85],[1926,1.4],[1930,1.5],[1936,1.6],[1938,2.3],[1941,3.3],[1945,9.5],[1946,14],[1948,27],[1950,33],[1955,40],[1959,51]];
const FX2=[[1960,.535],[1965,.62],[1970,.75],[1974,1],[1980,1.82],[1985,2.6],[1990,3.2],[1995,3.6],[2001,4]];
const FX3=[[2002,.77],[2010,.9],[2020,1],[2030,1.2]];
function fxOf(y){y=Math.floor(y);return y<1960?{k:itp(FX,y),u:'F',old:true}:y<2002?{k:itp(FX2,y),u:'F'}:{k:itp(FX3,y),u:'€'};}
const POP=[[1900,30000],[1910,26000],[1915,22000],[1920,16000],[1930,14000],[1945,13000],[1950,11000],[1960,11000],[1970,13000],[1980,17000],[1990,17000],[2000,15500],[2010,16000],[2020,17500]];
// presse automobile (titres imaginaires) : [nom, début, fin, sensibilité]
const MAGS=[['La Gazette du Chauffeur',1900,1945,'tech'],['Mécanique & Locomotion',1900,1965,'perf'],['L\'Écho des Routes',1900,1960,'famille'],['Le Volant Français',1920,2100,'famille'],['Route Libre',1950,2100,'perf'],['L\'Essai Auto',1960,2100,'tech'],['Moteur Mag',1975,2100,'perf'],['Auto Critique',1990,2100,'famille'],['Chrono & Conso',2005,2100,'tech']];
const MAG_W={perf:{P:.3,V:.2,hand:.2,rel:.1,prix:.2},famille:{comf:.2,pract:.15,eco:.15,saf:.15,rel:.15,prix:.2},tech:{rel:.2,P:.15,eco:.15,comf:.15,saf:.1,hand:.1,prix:.15}};
const LAB=[['Bureau des méthodes',1],['Laboratoire',2],['Centre de recherche',3],['Centre technique',4]];
const HIST=[
 [1903,'Les grandes courses','Paris-Madrid est arrêtée à Bordeaux après une série d\'accidents. Les clients aisés veulent toujours plus de vitesse.'],
 [1908,'Une voiture pour tous','Aux États-Unis, un constructeur lance une voiture simple et robuste, bientôt fabriquée à la chaîne. Les prix vont chuter.'],
 [1914,'Guerre mondiale','Les usines sont réquisitionnées : le marché civil s\'effondre jusqu\'en 1918.'],
 [1919,'La paix revient','La demande repart : beaucoup de familles veulent leur première voiture.'],
 [1929,'Krach boursier','La crise économique frappe : ventes en forte baisse pendant plusieurs années.'],
 [1934,'Révolution technique','Traction avant et caisse autoporteuse arrivent dans les voitures de série.'],
 [1939,'Seconde Guerre mondiale','La production civile s\'arrête presque totalement jusqu\'en 1945.'],
 [1946,'Reconstruction','Le marché renaît : il faut des voitures simples, sobres et bon marché.'],
 [1955,'Les Trente Glorieuses','La voiture se démocratise : le marché grandit très vite.'],
 [1973,'Premier choc pétrolier','Le prix de l\'essence s\'envole : la consommation devient un critère décisif.'],
 [1979,'Second choc pétrolier','Nouvelle flambée du pétrole. Ceintures et structures déformables deviennent obligatoires.'],
 [1990,'L\'électronique partout','Injection, ABS et calculateurs se généralisent. Une norme antipollution arrive en 1993.'],
 [1993,'Norme Euro 1','Toute voiture neuve doit avoir l\'injection et un pot catalytique.'],
 [2004,'ABS obligatoire','Tous les modèles neufs doivent avoir l\'ABS.'],
 [2008,'Crise financière','Les ventes reculent pendant deux ans ; la sobriété compte encore plus.'],
 [2014,'ESP obligatoire','Le contrôle de stabilité devient obligatoire sur les modèles neufs.'],
 [2015,'Scandale des moteurs diesel','Les tests truqués d\'un grand groupe ternissent l\'image du diesel.'],
 [2020,'Pandémie','Les usines s\'arrêtent quelques semaines : marché en recul.'],
];
const DEFECTS={'Résistance du moteur':1,'Boîte et embrayage':1,'Lubrification':.7,'Affolement des soupapes':.6,'Cliquetis':.8,'Vitesse de piston':.7,"Vitesse des segments d'arête":.7,'Tenue au couple':.8,'Calculateur':.8,'Injecteurs':.6,'Auto-allumage':1,'Passages de roue':.4,'Freinage':.5};

let G=null; // partie en cours
const Q=['T1','T2','T3','T4'];
const yq=()=>G.y+G.q/4;
const devF=y=>itp(DEVF,y);
function prodF(){let f=2.4;const h=k=>G.techs.includes(k);if(h('p_chaine')) f*=2/3;if(h('p_presses')) f*=.85;if(h('p_robots')) f*=.85;if(h('p_lean')) f*=.9;if(h('p_plateforme')) f*=.9;return f;}
function oldRef(y){return itp(BASECOST,y)*itp(PROD_EXP,y)*1.25;}
function eraK(y){return itp(POP,y)/oldRef(y);}
function refPrice(y,seg){return itp(POP,y)*(seg?seg.pm:1);}
function marketVol(y){return itp(MARKET,y)*(SHOCK[Math.floor(y)]||1);}
function segShares(y){const s=SEGS.map(g=>itp(g.share,y)),t=s.reduce((a,b)=>a+b,0);return s.map(v=>v/t);}
function capOfFac(l){return FAC[l][1];}
function facCost(l,y){return (FAC[l][1]-FAC[l-1][1])*.2*refPrice(y);}
function facUpkeep(l,y){return FAC[l][1]*.06*refPrice(y);}
function moneyF(x,y){const c=fxOf(y!=null?y:(G?G.y:2020)),v=x*c.k,a=Math.abs(v),s=v<0?'−':'',u=c.u;if(a<.5) return '0 '+u;if(a>=1e9) return s+nf(a/1e9,2)+' Md'+u;if(a>=1e6) return s+nf(a/1e6,a>=1e8?0:1)+' M'+u;if(a>=1e4) return s+nf(a/1e3)+' k'+u;return s+nf(a,a<10?2:a>=1000?-1:0)+' '+u;}
function toCur(x,y){return x*fxOf(y!=null?y:G.y).k;}
function fromCur(v,y){return v/fxOf(y!=null?y:G.y).k;}
function curName(y){const c=fxOf(y);return c.u==='€'?'euros':c.old?'francs':'nouveaux francs';}
function devCost(met,y){let f=eraK(y);if(G.techs.includes('p_cao')) f*=.7;if(G.techs.includes('p_plateforme')) f*=.8;return (60000+met.cost*6)*devF(y)*f;}
function devQ(y){return Math.round(itp([[1900,2],[1950,3],[1970,4]],y));}
function resCost(t,y){return 150000*devF(t.y)*t.k*Math.max(.3,1-(y-t.y)/30)*eraK(y);}
function labCost(l,y){return 300000*devF(y)*l*eraK(y);}
function resSlots(){return LAB[G.lab||0][1];}
function resQ(t,y){return Math.max(1,Math.round((1+t.k*1.5)*Math.max(.5,1-(y-t.y)/30)));}
function loanLimit(){const fv=G.facInv||0;const lr=G.hist.length?G.hist[G.hist.length-1].rev:0;return Math.max(G.startCash*.5,fv*.5+lr*.3);}
function syncEra(){ERA=G?{y:G.y,has:new Set(G.techs)}:null;}

// mesures d'un projet (le projet actuel par défaut)
function measure(E,C,s){
  s=s||S;const defects=[];let dw=0;
  for(const k of C.checks) if(k.lv==='crit'&&DEFECTS[k.t]!=null&&!(k.t==='Freinage'&&G&&G.y<1955)){defects.push(k.t);dw+=DEFECTS[k.t];}
  const aero=G&&G.techs.includes('p_soufflerie')?1:0;
  return {P:E.peakP,T:E.peakT,v:C.vmax*(1+.02*aero),t100:C.t100,mix:C.conso.mix*(1-.03*aero),comf:C.comfort,saf:C.safety,rel:E.rel,prest:C.prest,pract:C.pract,off:C.off,hand:C.handling,cost:C.cost,mass:C.mass,body:s.body,fit:C.fit.ok,emis:!!E.emis,cat:s.cat,di:s.fuelSys==='di'||s.fuelSys==='dual',abs:!!s.abs,esp:!!s.esp,passive:s.passive,defects,dw,L:E.L,cfg:E.c.lab,diesel:!!FUEL[s.fuel].diesel};
}
function unitCost(m,annual){const vf=clamp(1.25-.075*Math.log10(Math.max(annual,10)),.8,1.25);return m.cost*prodF()*vf*eraK(G?yq():2020);}
// attractivité d'un modèle pour un segment (1 = voiture moyenne de l'époque)
function appeal(m,seg,y,price){
  const w=seg.w,ln=Math.log,c=x=>clamp(x,.25,2.5);let L=0;
  const q=(v,r)=>(v+15)/(r+15);
  if(w.P) L+=w.P*ln(c(m.P/(itp(REF.P,y)*seg.sp)));
  if(w.V) L+=w.V*ln(c(m.v/(itp(REF.V,y)*seg.sv)));
  if(w.comf) L+=w.comf*ln(c(q(m.comf,itp(REF.comf,y))));
  if(w.rel) L+=w.rel*ln(c(q(m.rel,85)));
  if(w.saf) L+=w.saf*itp(SAF_IMP,y)*ln(c(q(m.saf,itp(REF.saf,y))));
  if(w.eco) L+=w.eco*itp(ECO_IMP,y)*ln(c(itp(REF.cons,y)/m.mix));
  if(w.hand) L+=w.hand*ln(c(q(m.hand,itp(REF.hand,y))));
  if(w.prest) L+=w.prest*ln(c(q(m.prest,itp(REF.prest,y)*(seg.k==='Grand tourisme'?1.7:1))));
  if(w.pract) L+=w.pract*ln(c(q(m.pract,55)));
  if(w.off) L+=w.off*ln(c(q(m.off,50)));
  L+=seg.el*ln(clamp(refPrice(y,seg)/price,.25,seg.pmax));
  L-=.12*m.dw;
  return Math.exp(L);
}
function fitOf(seg,body,y){let f=FIT[seg.k][body]||0;if(y<1945&&body==='roadster') f=seg.k==='Citadine'?.8:seg.k==='Familiale'?.5:f;return f;}
function repF(){return .7+.6*G.rep/100;}
function ageF(m){const a=yq()-(m.ly||m.y);return a<1?1.1:Math.max(.6,1.1-.06*a);}
function regBan(m,y,neuf){for(const r of REGS) if(y>=(neuf?r.y:r.ya)&&!r.ok(m)) return {n:r.n,need:r.need,ry:neuf?r.y:r.ya};return null;}
function pressF(m){if(!m.press) return 1;const a=yq()-(m.ly||m.y);return 1+clamp((m.press.avg-12)/8,-1,1)*.25*Math.max(0,1-a/3);}
// essais de la presse au lancement
function bestSeg(m,y){let b=SEGS[0],bv=-1;for(const s of SEGS){const v=appeal(m.met,s,y,m.price)*fitOf(s,m.met.body,y);if(v>bv){bv=v;b=s;}}return b;}
function reviewModel(m){
  const y=yq(),mt=m.met,seg=bestSeg(m,y),ln=Math.log,c=x=>clamp(x,-1,1),q=(v,r)=>ln((v+15)/(r+15));
  const sc={P:c(ln(mt.P/(itp(REF.P,y)*seg.sp))*1.4),V:c(ln(mt.v/(itp(REF.V,y)*seg.sv))*2),comf:c(q(mt.comf,itp(REF.comf,y))*2),rel:c(q(mt.rel,85)*3),
    saf:c(q(mt.saf,itp(REF.saf,y))*2)*Math.min(1,itp(SAF_IMP,y)),eco:c(ln(itp(REF.cons,y)/mt.mix)*2)*Math.min(1,itp(ECO_IMP,y)),hand:c(q(mt.hand,itp(REF.hand,y))*2),
    pract:c(q(mt.pract,55)*1.5),prest:c(q(mt.prest,itp(REF.prest,y))*1.5),prix:c(ln(refPrice(y,seg)/m.price)*1.6)};
  const pr=moneyF(m.price),Y=G.y;
  const PH={
    P:[`un moteur vigoureux : ${nf(mt.P)} ch, c'est beaucoup en ${Y}`,`un moteur poussif : ${nf(mt.P)} ch, c'est peu pour l'époque`],
    V:[`elle file à ${nf(mt.v)} km/h, une vitesse remarquable`,`plafonnant à ${nf(mt.v)} km/h, elle se fait dépasser`],
    comf:['un confort de premier ordre','un confort spartiate'],
    rel:['une mécanique qui inspire confiance','une fiabilité qui inquiète'],
    saf:['une sécurité au meilleur niveau','une protection des occupants en retard'],
    eco:[`une sobriété appréciable (${nf(mt.mix,1)} l/100 km)`,`un appétit d'ogre (${nf(mt.mix,1)} l/100 km)`],
    hand:['une tenue de route précise','un comportement routier approximatif'],
    pract:['un habitacle et un coffre bien pensés','une habitabilité comptée'],
    prest:['une présentation flatteuse','une finition qui manque d\'éclat'],
    prix:[`un prix de ${pr} très bien placé`,`${pr}, c'est cher pour ce qu'elle offre`],
  };
  const mags=MAGS.filter(g=>Y>=g[1]&&Y<=g[2]);
  for(let i=mags.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[mags[i],mags[j]]=[mags[j],mags[i]];}
  const list=mags.slice(0,3).map(([mag,,,bias])=>{
    const w=MAG_W[bias];let S0=0,wt=0;for(const k in w){S0+=w[k]*sc[k];wt+=w[k];}S0/=wt;
    const note=clamp(Math.round((12+16*S0-2.5*mt.dw+(Math.random()*2-1))*2)/2,3,19.5);
    const r=Object.keys(w).map(k=>[k,w[k]*sc[k]]).sort((a,b)=>b[1]-a[1]);
    const plus=r[0][1]>.01?PH[r[0][0]][0]:'',minus=r[r.length-1][1]<-.01?PH[r[r.length-1][0]][1]:'';
    let txt=plus&&minus?`${plus.replace(/^./,ch=>ch.toUpperCase())}, mais ${minus}.`:plus?`${plus.replace(/^./,ch=>ch.toUpperCase())}, et rien de vraiment fâcheux.`:minus?`Peu d'arguments, et ${minus}.`:'Dans la moyenne de sa catégorie sur tous les points.';
    if(mt.dw>0) txt+=` Notre voiture d'essai a connu des ennuis (${mt.defects.join(', ').toLocaleLowerCase()}).`;
    txt+=' '+(note>=16?'Une référence.':note>=13?'Un bon achat.':note>=10?'Correcte, sans plus.':'À éviter.');
    const pros=r.filter(x=>x[1]>.01).slice(0,3).map(x=>PH[x[0]][0]),cons=r.filter(x=>x[1]<-.01).reverse().slice(0,3).map(x=>PH[x[0]][1]);
    return {mag,note,txt,pros,cons,bias};
  });
  const avg=list.reduce((a,x)=>a+x.note,0)/Math.max(1,list.length);
  m.press={avg,list,y:G.y,q:G.q,seg:seg.n};
  G.rep=clamp(G.rep+(avg-12)*.6,0,100);
  const best=list.slice().sort((a,b)=>b.note-a.note)[0];
  news(`La presse essaie « ${m.name} » : ${nf(avg,1)}/20`,best?`${best.mag} (${nf(best.note,1)}/20) : « ${best.txt} »`:'',avg>=13?'good':avg>=10?'info':'warn');
}
// demande annuelle de chaque modèle (tableau de {tot, seg:{…}})
function demand(models,y){
  const vol=marketVol(y),sh=segShares(y),N=itp(NCOMP,y)*(G.diff==='dur'?1.3:G.diff==='fac'?.8:1),K=2;
  const out=models.map(()=>({tot:0,seg:{}}));
  SEGS.forEach((seg,i)=>{
    const A=models.map(m=>regBan(m.met,y,!m.st)?0:appeal(m.met,seg,y,m.price)*repF()*(m.age!=null?m.age:ageF(m))*pressF(m));
    const sum=A.reduce((a,x)=>a+Math.pow(x,K),0)+N;
    models.forEach((m,j)=>{const d=vol*sh[i]*fitOf(seg,m.met.body,y)*Math.pow(A[j],K)/sum;out[j].seg[seg.k]=d;out[j].tot+=d;});
  });
  return out;
}
function news(t,d,k){G.news.unshift({y:G.y,q:G.q,t,d,k:k||'info'});if(G.news.length>80) G.news.length=80;}
function techsNewIn(y){return TECHS.filter(t=>t[3]===y).map(t=>t[2]);}

const START={
  1900:{cash:6e5,fac:0,n:'Les pionniers',d:'Quelques artisans construisent des voitures pour une clientèle fortunée. Tout reste à inventer.'},
  1920:{cash:2.5e6,fac:1,n:'Les années folles',d:'La chaîne de montage existe, le marché s\'ouvre aux classes moyennes.'},
  1950:{cash:3e7,fac:2,n:'L\'après-guerre',d:'Reconstruction, puis les Trente Glorieuses : la voiture pour tous.'},
  1980:{cash:3e8,fac:3,n:'L\'électronique',d:'Chocs pétroliers, injection, turbo et premières aides à la conduite.'},
  2000:{cash:1.2e9,fac:3,n:'Le XXIe siècle',d:'Normes antipollution, sécurité, mondialisation.'},
};
const FIRST_CAR={name:'Type A',config:'I4',bore:80,stroke:110,limiter:1900,cr:7,cam:10,body:'roadster',seats:2,gears:4,first:3.6,top:1,final:3.6,rim:16,tireW:145,profile:80,stagger:0,stiff:30,gc:200,brakeFd:260,brakeRd:260,trim:'basic',media:'none',wing:'none',gbxCap:300,arbF:20,arbR:20,paint:'#2f3b2c'};

function newGame(o){
  const st=START[o.y]||START[1900],m=o.diff==='fac'?1.8:o.diff==='dur'?.6:1;
  G={v:1,co:o.co||'Automobiles Nouvelles',y:o.y,q:0,start:o.y,diff:o.diff||'nor',cash:st.cash*m*eraK(o.y),startCash:st.cash*m*eraK(o.y),lab:0,resL:[],debt:0,rep:o.diff==='fac'?40:30,fac:st.fac,facInv:0,build:null,
     techs:TECHS.filter(t=>t[3]<=o.y-4).map(t=>t[0]),models:[],hist:[],news:[],acc:{rev:0,cost:0,units:0,profit:0},negQ:0,over:false,mid:1};
  for(let l=1;l<=G.fac;l++) G.facInv+=facCost(l,o.y);
  syncEra();
  // premier projet : base d'époque
  for(const k of Object.keys(S)) delete S[k];
  Object.assign(S,DEF,ERA_BASE,FIRST_CAR,{preset:'',name:'Type A'});
  if(o.y>=1950){Object.assign(S,DEF,PRESETS.berline.s,{name:'Type A',preset:''});}
  if(false){Object.assign(S,{body:'berline',seats:4,bore:76,stroke:80,limiter:5000,cr:8,rim:15,tireW:165,profile:80,gears:4,first:3.6,top:1,final:4.1,stiff:40,gc:150,gbxCap:300,cam:25});}
  S.injSize=0;S.ecuIdle=0;S.oilInt=0;
  eraFix();
  news(`Fondation de ${G.co}`,`${st.n} · ${st.d} Première étape : concevez votre première voiture depuis le quartier général.`,'good');
  saveGame();
}
function saveGame(){if(!G) return;try{G.design=Object.assign({},S);localStorage.setItem('bea.career.v1',JSON.stringify(G));}catch(e){}}
function loadGame(){try{const raw=localStorage.getItem('bea.career.v1');if(!raw) return null;const g=JSON.parse(raw);if(!g||g.v!==1) return null;if(!g.resL){g.resL=g.res?[g.res]:[];}delete g.res;g.lab=g.lab||0;return g;}catch(e){return null;}}

function launchModel(name,price){
  const met=measure(M.E,M.C),y=yq(),dc=devCost(met,y);
  if(!met.fit) return 'Le moteur ne rentre pas dans la caisse.';
  const ban=regBan(met,G.y,true);if(ban) return `Homologation refusée : ${ban.n}.`;
  if(G.cash+loanLimit()-G.debt<dc) return 'Trésorerie insuffisante pour développer ce modèle.';
  G.cash-=dc;
  const m={id:G.mid++,name:name||S.name||'Modèle',y:G.y,q:G.q,price:Math.round(price/10)*10,snap:Object.assign({},S),met,st:'dev',devLeft:devQ(y),dev:dc,sold:0,rev:0,profit:0,last:null};
  G.models.push(m);
  news(`Développement lancé : ${m.name}`,`Coût d'étude et d'outillage ${moneyF(dc)}. Sortie prévue dans ${m.devLeft} trimestre${m.devLeft>1?'s':''}.`);
  coverCash();saveGame();return null;
}
function coverCash(){if(G.cash<0){const room=loanLimit()-G.debt,b=Math.min(room,-G.cash);if(b>0){G.debt+=b;G.cash+=b;news('Découvert couvert par la banque',`Emprunt automatique de ${moneyF(b)}.`,'warn');}}}

function nextQuarter(){
  if(!G||G.over) return;
  const y=yq();
  // recherche
  for(const r of G.resL){r.left--;if(r.left<=0){const t=TECH[r.id];G.techs.push(t.id);news(`Recherche terminée : ${t.n}`,t.d,'good');}}
  G.resL=G.resL.filter(r=>r.left>0);
  if(G.labBuild){G.labBuild.left--;if(G.labBuild.left<=0){G.lab=G.labBuild.l;news(`${LAB[G.lab][0]} ouvert`,`${LAB[G.lab][1]} recherches peuvent maintenant avancer en même temps.`,'good');G.labBuild=null;}}
  // usine
  if(G.build){G.build.left--;if(G.build.left<=0){G.fac=G.build.l;news(`${FAC[G.fac][0]} en service`,`Capacité : ${nf(FAC[G.fac][1])} voitures par an.`,'good');G.build=null;}}
  // modèles en développement
  for(const m of G.models) if(m.st==='dev'){m.devLeft--;if(m.devLeft<=0){m.st='prod';m.ly=yq();news(`Lancement commercial : ${m.name}`,`Prix de vente ${moneyF(m.price)}.`,'good');reviewModel(m);(G.pendingNews=G.pendingNews||[]).push(m.id);}}
  // réglementation
  for(const m of G.models) if(m.st==='prod'){const b=regBan(m.met,G.y,false);if(b){m.st='stop';news(`${m.name} retiré du marché`,`${b.n}. Il faudrait : ${b.need}.`,'crit');}}
  // ventes
  const prod=G.models.filter(m=>m.st==='prod');
  const cap=capOfFac(G.fac)/4;let rev=0,cost=0,units=0;
  if(prod.length){
    const d=demand(prod,y).map(x=>x.tot/4),tot=d.reduce((a,b)=>a+b,0),k=tot>cap?cap/tot:1;
    prod.forEach((m,i)=>{
      const u=Math.floor(d[i]*k+Math.random()*.999),uc=unitCost(m.met,Math.max(u*4,1)),war=uc*.04*m.met.dw;
      const r=u*m.price,c=u*(uc+war);
      m.last={u,dem:d[i],uc,war,r,c,lim:k<1};m.sold+=u;m.rev+=r;m.profit+=r-c;rev+=r;cost+=c;units+=u;
      // réputation : qualité perçue et défauts
      const ql=Math.log(clamp((m.met.rel+15)/100,.3,2))*40+Math.log(clamp((m.met.comf+15)/(itp(REF.comf,y)+15),.3,2))*30-14*m.met.dw;
      const tgt=clamp(50+ql+(m.last.u>0?Math.min(15,Math.log10(1+m.sold)*3):0),0,100),wgt=clamp(u/Math.max(cap,1),0,1)*.12+.02;
      G.rep=clamp(G.rep+(tgt-G.rep)*wgt,0,100);
    });
  }
  for(const m of G.models) if(m.st!=='prod') m.last=null;
  const upk=facUpkeep(G.fac,y)/4,int=G.debt*.06/4;
  const profit=rev-cost-upk-int;
  G.cash+=profit;
  G.acc.rev+=rev;G.acc.cost+=cost+upk+int;G.acc.units+=units;G.acc.profit+=profit;
  G.lastQ={rev,cost,upk,int,profit,units,cap:cap*4};
  coverCash();
  if(G.cash<0){G.negQ++;if(G.negQ>=2){G.over=true;news('Faillite',`${G.co} ne peut plus payer ses fournisseurs. La société est liquidée.`,'crit');saveGame();return;}news('Trésorerie négative','La banque refuse d\'avancer plus. Sans redressement le trimestre prochain, c\'est la faillite.','crit');}
  else G.negQ=0;
  // fin d'année
  G.q++;
  if(G.q>3){
    G.hist.push({y:G.y,rev:G.acc.rev,profit:G.acc.profit,units:G.acc.units,cash:G.cash,rep:G.rep});
    G.acc={rev:0,cost:0,units:0,profit:0};G.q=0;G.y++;
    for(const h of HIST) if(h[0]===G.y) news(h[1],h[2],'hist');
    const nt=techsNewIn(G.y);if(nt.length) news(`Nouveauté${nt.length>1?'s':''} technique${nt.length>1?'s':''} ${G.y}`,`Désormais possible à rechercher : ${nt.join(', ')}.`,'tech');
    for(const r of REGS){if(r.y===G.y+1) news('Nouvelle norme l\'an prochain',`${r.n} : obligatoire pour les nouveaux modèles à partir de ${r.y}, pour toutes les voitures vendues à partir de ${r.ya}. Il faudra : ${r.need}.`,'warn');if(r.ya===G.y+1&&r.ya!==r.y) news('Norme : dernière année de tolérance',`${r.n}. À partir de ${r.ya}, les modèles non conformes seront retirés de la vente.`,'warn');}
  }
  syncEra();saveGame();
}
function buildLab(){const l=(G.lab||0)+1;if(l>=LAB.length||G.labBuild) return;const c=labCost(l,yq());if(G.cash+loanLimit()-G.debt<c) return 'Trésorerie insuffisante.';G.cash-=c;G.labBuild={l,left:2};news(`Construction : ${LAB[l][0]}`,`Investissement ${moneyF(c)}, ouverture dans 2 trimestres.`);coverCash();saveGame();return null;}
function startResearch(id){const t=TECH[id];if(!t||G.resL.length>=resSlots()||G.resL.some(r=>r.id===id)||G.techs.includes(id)||t.y>G.y) return;const c=resCost(t,yq());if(G.cash+loanLimit()-G.debt<c) return 'Trésorerie insuffisante.';G.cash-=c;G.resL.push({id,left:resQ(t,yq()),tot:resQ(t,yq()),cost:c});coverCash();saveGame();return null;}
function buildFactory(){const l=G.fac+1;if(l>=FAC.length||G.build) return;const c=facCost(l,yq());if(G.cash+loanLimit()-G.debt<c) return 'Trésorerie insuffisante.';G.cash-=c;G.facInv+=c;G.build={l,left:3};news(`Construction : ${FAC[l][0]}`,`Investissement ${moneyF(c)}, mise en service dans 3 trimestres.`);coverCash();saveGame();return null;}
