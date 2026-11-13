'use strict';
/* ───────────── Concurrents : constructeurs rivaux imaginaires ─────────────
   Les rivaux remplacent une partie des concurrents anonymes (NCOMP) dans le calcul de la demande.
   État dans G.riv (sauvegardé avec la partie) ; créé à la volée pour une ancienne partie.
   Points d'accroche : demand() et nextQuarter() (21), mktHTML(), qgHTML() et todo() (22). */

const RIV_POS={
  pop:{n:'populaire',segs:['Citadine','Familiale'],pm:.97},
  lux:{n:'luxe',segs:['Grand tourisme','Familiale'],pm:1.1},
  sport:{n:'sport',segs:['Sportive','Grand tourisme'],pm:1.1},
  util:{n:'utilitaire',segs:['Tout-terrain','Familiale'],pm:1},
};
// constructeurs imaginaires : nom, pays, fondation, positionnement, agressivité (0..1), qualité (≈1), taille relative
const RIVALS=[
  {n:'Maison Valmont',cn:'France',pr:'FR',y0:1894,pos:'lux',agg:.25,q:1.1},
  {n:'Sarrazin Frères',cn:'France',pr:'FR',y0:1896,pos:'pop',agg:.5,q:1},
  {n:'Kessler Werke',cn:'Allemagne',pr:'DE',y0:1899,pos:'util',agg:.35,q:1.05},
  {n:'Hartwell Motor Company',cn:'États-Unis',pr:'US',y0:1900,pos:'pop',agg:.7,q:.98},
  {n:'Bellandi Automobili',cn:'Italie',pr:'IT',y0:1904,pos:'sport',agg:.55,q:1.04},
  {n:'Adlerhoff',cn:'Allemagne',pr:'DE',y0:1910,pos:'lux',agg:.3,q:1.08},
  {n:'Cardington',cn:'États-Unis',pr:'US',y0:1912,pos:'lux',agg:.45,q:1.02},
  {n:'Dunmore & Pryce',cn:'Royaume-Uni',pr:'UK',y0:1920,pos:'sport',agg:.3,q:1.06},
  {n:'Fornaro',cn:'Italie',pr:'IT',y0:1922,pos:'pop',agg:.6,q:.96},
  {n:'Brannigan Motors',cn:'États-Unis',pr:'US',y0:1925,pos:'util',agg:.6,q:.97},
  {n:'Nordvik',cn:'Suède',pr:'SE',y0:1931,pos:'util',agg:.2,q:1.1},
  {n:'Tessaro',cn:'Italie',pr:'IT',y0:1948,pos:'lux',agg:.4,q:1.05},
  {n:'Kazamiya Motors',cn:'Japon',pr:'JP',y0:1953,pos:'pop',agg:.8,q:.95},
  {n:'Hirondelle Sport',cn:'France',pr:'FR',y0:1958,pos:'sport',agg:.5,q:1.03},
  {n:'Sorano',cn:'Japon',pr:'JP',y0:1966,pos:'sport',agg:.65,q:1.02},
  {n:'Haneul Motors',cn:'Corée du Sud',pr:'KR',y0:1976,pos:'pop',agg:.85,q:.93},
];
// noms de modèles imaginaires par pays
const RIV_NOMS={
  FR:['Orlane','Verdane','Pavane','Sarcelle','Lisandre','Maravel','Tourelle','Ondine','Brévane','Clairval'],
  IT:['Volpina','Terzano','Lunara','Zanetta','Portello','Sirenetta','Ardesia','Brivalda','Montecelo'],
  DE:['Falkner','Rheinwald','Holtzmann','Wendeln','Sturmer','Aldern','Brockhaus','Edelwald'],
  US:['Larkspur','Redwater','Pinecrest','Cascadia','Prairiestar','Wildoak','Mesaline','Silverlake'],
  JP:['Sakurai','Hayate','Kawase','Midori','Asagiri','Tsubame','Natsume','Hoshino'],
  SE:['Fjalar','Skarven','Nordkap','Isvind','Solvik','Ramsund'],
  UK:['Hartley','Wexmoor','Bramhall','Ashdene','Thornbury'],
  KR:['Haneul','Miraeju','Dalbit','Saebyeok','Namsan'],
};
const RIV_GEN={FR:[['Cour','Bel','Lor','Rou','Mar','Sain'],['ville','mont','ière','ac','et','val'],'France'],IT:[['Vel','Mor','Cal','Ber','Fer','Sal'],['ini','etti','ano','ari','one','ardi'],'Italie'],DE:[['Brand','Held','Rhein','Wolf','Stahl','Kron'],['berg','mann','werk','stein','hof','feld'],'Allemagne'],US:[['Rock','Lone','Fair','Sun','Iron','Big'],['field','ford','ton','wood','port','land'],'États-Unis'],JP:[['Aki','Ume','Fuji','Take','Sora','Kura'],['moto','shima','kawa','mori','zawa','tani'],'Japon']};
const ROMAN=['','','II','III','IV','V','VI','VII'];

const rivR=()=>Math.random();
const rivJ=s=>1+(rivR()+rivR()+rivR()-1.5)*s;
const rivSeg=k=>SEGS.find(s=>s.k===k);
const rivOrd=n=>n===1?'1ᵉʳ':n+'ᵉ';

function rivBody(k,y){
  const r=rivR();
  if(k==='Citadine') return y<1945?'roadster':y<1965||r<.7?'citadine':'compacte';
  if(k==='Familiale') return y<1930?'roadster':r<.3&&y>1950?'break':y>1995&&r<.55?'suv':'berline';
  if(k==='Sportive') return y<1945?'roadster':y>1965&&r<.2?'supercar':r<.3?'roadster':'coupe';
  if(k==='Grand tourisme') return y<1945?'berline':y>1995&&r<.35?'suv':r<.4?'coupe':'berline';
  return y<1975?(y<1920?'break':'pickup'):r<.3?'pickup':'suv';
}
function rivStyle(y){
  const av=STY_ORDER.filter(k=>STYLE[k].y<=y);if(!av.length) return null;
  return av[Math.max(0,av.length-1-(rivR()<.3?1:0))];
}
function rivNameModel(R,prev){
  const used=new Set();for(const x of G.riv.list) if(x.alive) for(const m of x.models) used.add(m.name);
  if(prev&&rivR()<.5){const base=prev.line||prev.name,g=(prev.gen||1)+1;if(g<ROMAN.length&&!used.has(base+' '+ROMAN[g])) return {name:base+' '+ROMAN[g],line:base,gen:g};}
  const pool=(RIV_NOMS[R.pr]||RIV_NOMS.FR).filter(n=>!used.has(n)&&!used.has(n+' II')),n=pool.length?pool[Math.floor(rivR()*pool.length)]:'Modèle '+(G.riv.mid);
  return {name:n,line:n,gen:1};
}
// un modèle d'époque, tiré des attentes de l'année et de la qualité du constructeur
function rivMake(R,segK,yl,prev){
  const seg=rivSeg(segK),k=R.q,j=()=>rivJ(.14),y=yl,P0=itp(REF.P,y)*seg.sp,gt=segK==='Grand tourisme',main=RIV_POS[R.pos].segs[0]===segK;
  const P=P0*Math.pow(k,1.6)*rivJ(.2)*(R.pos==='sport'&&segK==='Sportive'?1.1:1),r=P/P0;
  const met={P:Math.round(P),v:Math.round(itp(REF.V,y)*seg.sv*Math.pow(r,.5)*rivJ(.06)),comf:Math.round(itp(REF.comf,y)*k*(gt?1.12:1)*j()),rel:Math.round(clamp(85*(1+(k-1)*.9)*rivJ(.06),45,98)),
    saf:Math.round(itp(REF.saf,y)*k*j()),hand:Math.round(itp(REF.hand,y)*k*(segK==='Sportive'?1.12:1)*j()),mix:Math.round(itp(REF.cons,y)/k*Math.pow(r,.4)*rivJ(.1)*10)/10,
    prest:Math.round(itp(REF.prest,y)*(gt?1.7:1)*k*(R.pos==='lux'?1.1:1)*j()),pract:Math.round(55*k*(segK==='Familiale'||segK==='Tout-terrain'?1.1:1)*j()),off:Math.round(50*(segK==='Tout-terrain'?1.3:.7)*k*j()),
    dw:0,body:rivBody(segK,y),style:rivStyle(y),passive:'std',emis:true,abs:true,esp:true,cat:'gpf',diesel:false,di:false};
  const price=Math.round(refPrice(y,seg)*(main?RIV_POS[R.pos].pm:1)*(1+.7*(k-1))*rivJ(.12)*(1-.06*R.agg)/10)*10;
  const life=itp([[1900,9],[1940,8],[1970,7],[2020,6]],y)*(.8+rivR()*.5)*(1.15-.3*R.agg),nm=rivNameModel(R,prev);
  return {id:G.riv.mid++,name:nm.name,line:nm.line,gen:nm.gen,seg:segK,y:yl,ly:yl,price,met,due:yl+life,u:0,lu:0,yu:0,dem:0,mult:1};
}
function rivFound(t,y,init){
  const R=G.riv,q=t.q,r={id:R.rid++,name:t.n,cn:t.cn,pr:t.pr,y0:init?t.y0:Math.floor(y),pos:t.pos,agg:t.agg,q,rep:clamp(45+(q-1)*120+rivR()*12,15,85),cash:null,cap:0,alive:true,negQ:0,models:[],acc:0,ly:0,yn:0,fn:-9};
  const nb=1+(y>=1930&&rivR()<.6?1:0)+(y>=1970&&rivR()<.5?1:0),opts=RIV_POS[t.pos].segs.slice();
  for(let i=0;i<nb;i++){
    const sk=i===0?opts[0]:opts[Math.floor(rivR()*opts.length)];
    if(r.models.some(m=>m.seg===sk)&&i>0) continue;
    const yl=init?y-rivR()*7:y,m=rivMake(r,sk,yl);if(!init){m.ly=yq();m.y=m.ly;}r.models.push(m);
  }
  R.list.push(r);return r;
}
// rivaux inventés pour remplacer ceux qui disparaissent
function rivGenerate(y){
  const keys=Object.keys(RIV_GEN).filter(k=>k!=='JP'||y>=1950),pr=keys[Math.floor(rivR()*keys.length)],g=RIV_GEN[pr];
  let n='';for(let t=0;t<12;t++){n=g[0][Math.floor(rivR()*g[0].length)]+g[1][Math.floor(rivR()*g[1].length)];n=n.charAt(0).toUpperCase()+n.slice(1);if(!G.riv.list.some(x=>x.name.indexOf(n)>=0)) break;}
  const pos=['pop','pop','lux','sport','util'][Math.floor(rivR()*5)];
  return {n:'Automobiles '+n,cn:g[2],pr,y0:Math.floor(y),pos,agg:.3+rivR()*.6,q:.9+rivR()*.18};
}
function rivInit(){
  if(G.riv&&G.riv.v===1) return G.riv;
  const y=yq(),R=G.riv={v:1,mid:1,rid:1,list:[],dead:[],fd:[],lyY:0,pl:0};
  RIVALS.forEach((t,i)=>{if(t.y0<=y){R.fd.push(i);rivFound(t,y,true);}});
  return R;
}
const rivAlive=()=>rivInit().list.filter(r=>r.alive);
// modèles rivaux en vente, avec leur coefficient de réputation et d'âge (utilisés par demand)
function rivList(y){
  if(!G) return [];
  const out=[];
  for(const r of rivAlive()){const rf=.7+.6*r.rep/100;for(const m of r.models){m.mult=rf*ageF(m);m.rv=r;out.push(m);}}
  return out;
}
function rivFix(r,y){
  const seg=rivSeg(RIV_POS[r.pos].segs[0]);
  return r.cap*refPrice(y,seg)*.09*Math.max(.35,SHOCK[Math.floor(y)]||1);
}
function rivNewModel(r,y,prev,segK){
  const old=prev&&r.models.indexOf(prev);
  const m=rivMake(r,segK||prev.seg,yq(),prev);m.y=m.ly=yq();
  if(prev) r.models[old]=m;else r.models.push(m);
  if(r.cash!=null) r.cash-=rivFix(r,y)*.8;
  // modèle marquant : annoncé dans les actualités
  const seg=rivSeg(m.seg),ap=appeal(m.met,seg,y,m.price),big=ap>=1.3||(m.seg==='Sportive'&&m.met.P>=1.35*itp(REF.P,y)*seg.sp);
  if(big&&G.y-r.fn>=2){r.fn=G.y;news(`${r.name} dévoile la ${m.name}`,`Clientèle ${seg.n.toLocaleLowerCase()} · ${nf(m.met.P)} ch · ${nf(m.met.v)} km/h · ${moneyF(m.price)}. Un modèle qui compte face à vos voitures.`,'info');}
  return m;
}

/* ── un trimestre de vie des rivaux (appelé par nextQuarter) ── */
function rivQuarter(y){
  const R=rivInit();
  // fondations
  if(G.q===0){
    RIVALS.forEach((t,i)=>{if(t.y0<=G.y&&!R.fd.includes(i)){R.fd.push(i);const r=rivFound(t,yq(),false);news(`Nouveau constructeur : ${r.name}`,`${r.cn} · ${RIV_POS[r.pos].n}. Un nouvel acteur arrive sur le marché.`,'info');}});
    const tg=Math.round(itp([[1900,5],[1920,9],[1950,10],[1990,10],[2020,9]],G.y));
    if(R.list.filter(r=>r.alive).length<tg&&rivR()<.4){const r=rivFound(rivGenerate(yq()),yq(),false);news(`Nouveau constructeur : ${r.name}`,`${r.cn} · ${RIV_POS[r.pos].n}. Un nouvel acteur arrive sur le marché.`,'info');}
  }
  demand(G.models.filter(m=>m.st==='prod'),y);
  const vol=marketVol(y),shock=SHOCK[Math.floor(y)]||1;
  for(const r of R.list.filter(x=>x.alive)){
    const tot=r.models.reduce((a,m)=>a+m.dem/4,0);
    if(!r.cap) r.cap=Math.max(20,tot*4*1.2);
    if(r.cash==null) r.cash=rivFix(r,y)*2;
    const cq=r.cap/4,k=tot>cq?cq/Math.max(tot,1e-9):1,fix=rivFix(r,y);
    let rev=0,u4=0;
    for(const m of r.models){const u=Math.max(0,Math.round(m.dem/4*k*(.93+rivR()*.14)));m.lu=u;m.u+=u;rev+=u*m.price;u4+=u;}
    r.acc+=u4;r.lu=u4;
    const share=vol?u4*4/vol:0;
    const mg=clamp(.2+.35*(r.q-1)-.05*r.agg-.09*clamp(1-share/.02,0,1)+r.yn,-.1,.32);
    const profit=rev*mg-fix/4;
    r.cash=clamp(r.cash+profit,-fix*5,fix*5);
    // capacité : suit la demande
    if(tot>cq*.92&&r.cash>0) r.cap*=1.04;else if(tot<cq*.6) r.cap*=.97;
    // réputation
    let ap=0,w=0;for(const m of r.models){const a=appeal(m.met,rivSeg(m.seg),y,m.price)*m.mult;ap+=a*m.dem;w+=m.dem;}
    const avg=w>0?ap/w:.6;
    const tg=clamp(45+32*Math.log(clamp(avg,.3,3))+(profit>0?4:-6),5,95);
    r.rep=clamp(r.rep+(tg-r.rep)*.06,0,100);
    // faillite
    if(r.cash<-fix*.4&&r.cap>0){
      if(shock<.6){r.cash=Math.max(r.cash,-fix*.4);r.negQ=Math.min(r.negQ,2);}
      r.negQ++;
      if(r.negQ>=3){
        r.alive=false;r.end=G.y;R.dead.push({n:r.name,y0:r.y0,end:G.y});if(R.dead.length>14) R.dead.shift();
        news(`Faillite de ${r.name}`,`Le constructeur ${r.cn==='États-Unis'?'américain':r.cn==='Royaume-Uni'?'britannique':'de '+r.cn.toLocaleLowerCase()} met la clé sous la porte. Sa clientèle se tourne vers d'autres marques.`,'warn');
        continue;
      }
    }else r.negQ=0;
    // renouvellement des modèles
    if(r.cash>-fix) for(const m of r.models.slice()) if(yq()>=m.due) rivNewModel(r,y,m);
    // fin d'année
    if(G.q===3){
      r.ly=r.acc;r.acc=0;r.yn=(rivR()-.5)*.07*(.5+r.agg);
      r.q=clamp(r.q+(r.cash>fix?.004:-.004)+(rivR()-.5)*.006,.82,1.2);
      for(const m of r.models){m.yu=m.u;m.u=0;}
      const mx=y<1930?1:y<1970?2:3;
      if(r.models.length<mx&&r.cash>fix*1.5&&rivR()<.25){const free=RIV_POS[r.pos].segs.filter(s=>!r.models.some(m=>m.seg===s));if(free.length) rivNewModel(r,y,null,free[Math.floor(rivR()*free.length)]);}
    }
  }
  if(G.q===3){R.lyY=G.y;R.pl=G.acc.units;}
}

/* ── classement ── */
function rivStats(){
  const R=rivInit(),last=R.lyY===G.y-1;
  const pu=last?R.pl:G.acc.units,vol=last?marketVol(G.y-1):marketVol(yq());
  const rows=[{me:1,name:G.co,u:pu,models:G.models.filter(m=>m.st==='prod')}];
  for(const r of R.list) if(r.alive) rows.push({r,name:r.name,u:last?r.ly:r.acc,models:r.models});
  rows.sort((a,b)=>b.u-a.u);
  rows.forEach((x,i)=>{x.rank=i+1;x.share=vol?x.u/vol:0;});
  const tot=rows.reduce((a,x)=>a+x.u,0);
  return {rows,last,vol,tot,others:Math.max(0,1-tot/Math.max(vol,1))};
}
function rivRankLine(){
  if(!G||G.over) return '';
  const st=rivStats(),me=st.rows.find(x=>x.me);
  if(!G.models.some(m=>m.st==='prod')||st.tot<=0) return `<p class="riv-rank">${st.rows.length-1} constructeurs rivaux se partagent le marché. Votre rang apparaîtra dès vos premières ventes.</p>`;
  return `<p class="riv-rank"><b>Votre rang : ${rivOrd(me.rank)} constructeur sur ${st.rows.length}</b> <button class="chip-btn" type="button" data-go="marche">Voir les concurrents</button></p>`;
}
// clientèle principale du joueur : celle où ses modèles se vendent le plus
function rivTodo(){
  const prod=G.models.filter(m=>m.st==='prod'&&m.last&&m.last.u>0);if(!prod.length) return null;
  const y=yq(),by={};
  for(const m of prod){const s=bestSeg(m,y).k;by[s]=(by[s]||0)+m.last.u;}
  const main=Object.entries(by).sort((a,b)=>b[1]-a[1])[0],seg=rivSeg(main[0]);
  let best=null;
  for(const r of rivAlive()) for(const m of r.models) if(m.seg===main[0]&&m.lu>main[1]*1.2&&(!best||m.lu>best.lu)){best=m;}
  if(!best) return null;
  return {t:`${esc(best.rv.name)} vous dépasse chez la clientèle ${esc(seg.n.toLocaleLowerCase())}`,d:`Sa ${esc(best.name)} (${nf(best.met.P)} ch, ${moneyF(best.price)}) s'est vendue à ${nf(best.lu)} exemplaires ce trimestre, contre ${nf(main[1])} pour vos modèles de cette clientèle. Améliorez ou renouvelez votre offre.`,b:'<button class="chip-btn" type="button" data-go="marche">Voir les concurrents</button>'};
}
function rivHTML(){
  const R=rivInit(),st=rivStats(),y=yq();
  const mod=(m,me)=>{const sg=me?bestSeg(m,y):rivSeg(m.seg);return `<li><b>${esc(m.name)}</b><span>${esc(sg.n)} · ${nf(m.met.P)} ch · ${moneyF(m.price)}</span></li>`;};
  const rows=st.rows.map(x=>{
    const r=x.r,sub=x.me?'Votre entreprise':`${esc(r.cn)} · fondé en ${r.y0} · ${RIV_POS[r.pos].n} · réputation ${nf(r.rep)}`;
    return `<li class="${x.me?'riv-me':''}"><div class="riv-h"><span class="riv-n">${x.rank}</span><div class="riv-id"><b>${esc(x.name)}${x.me?' <span class="pill ok">Vous</span>':''}</b><small>${sub}</small></div><div class="riv-s"><b>${nf(x.share*100,x.share>=.1?0:1)} %</b><small>${nf(x.u)} voit.</small></div></div>${x.models.length?`<ul class="riv-m">${x.models.map(m=>mod(m,x.me)).join('')}</ul>`:`<p class="grp-note">${x.me?'Aucun modèle en vente.':'Aucun modèle en vente.'}</p>`}</li>`;
  }).join('');
  const dead=R.dead.length?`<p class="hint">Constructeurs disparus : ${R.dead.slice(-8).map(d=>`${esc(d.n)} (${d.end})`).join(', ')}.</p>`:'';
  return `<section class="cgrp" id="rivals"><h3>Concurrents</h3><p class="grp-note">Classement des constructeurs par voitures vendues ${st.last?`en ${G.y-1}`:`depuis janvier ${G.y}`} (part des ${nf(st.vol,-2)} voitures neuves du marché). Les petits constructeurs anonymes se partagent le reste : ${nf(st.others*100)} %.</p><ol class="riv-l">${rows}</ol>${dead}</section>`;
}
