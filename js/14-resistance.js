'use strict';
/* ───────────── Résistance, casse et usure ───────────── */
const FAILS={
 rods:{n:'Bielles et vilebrequin',part:['Bielles','Vilebrequin'],inner:1,cons:"Une bielle se tord sous la pression de combustion, puis casse et traverse le bloc. Moteur détruit.",fix:'Équipage forgé ou en titane, moins de pression de suralimentation, moins de couple.'},
 speed:{n:'Vitesse des pistons',part:['Bielles','Pistons'],inner:1,cons:"À trop haut régime, l'inertie des pistons arrache une tête de bielle.",fix:'Course plus courte, rupteur plus bas, équipage mobile plus léger.'},
 gasket:{n:'Joint de culasse',part:['Culasse','Culasses'],cons:"Le joint claque sous la pression : les gaz passent dans le circuit d'eau, le moteur surchauffe et perd sa compression.",fix:'Bloc en fonte ou en fonte vermiculaire, moins de pression de suralimentation.'},
 valves:{n:'Soupapes (affolement)',part:['Soupapes'],inner:1,cons:'Les soupapes ne suivent plus les cames et heurtent les pistons : soupapes tordues, pistons marqués.',fix:'Rupteur plus bas, soupapes en titane, rappel pneumatique, cascade de pignons.'},
 knock:{n:'Cliquetis',part:['Pistons'],inner:1,cons:'Les détonations répétées fissurent un piston ou cassent un segment.',fix:"Moins d'avance, compression plus basse, carburant à indice plus élevé, refroidisseur d'air."},
 lspi:{n:'Pré-allumage à bas régime',part:['Pistons'],inner:1,cons:"À bas régime et pleine charge, le mélange s'enflamme avant l'étincelle : segments et pistons cassés.",fix:'Moins de couple sous 2 500 tr/min, huile aux normes récentes.'},
 lean:{n:'Mélange trop pauvre',part:['Pistons'],inner:1,cons:'Le mélange pauvre brûle trop chaud : le haut des pistons fond.',fix:"Recalibrer le calculateur, injecteurs plus gros, pression d'essence plus haute, richesse plus basse."},
 egt:{n:"Température d'échappement",part:["Collecteur d'éch","Collecteurs d'éch",'Turbocompresseur'],cons:"Les soupapes d'échappement et la turbine se fissurent ou fondent.",fix:"Mélange plus riche à pleine charge, soupapes refroidies au sodium, moins de retard à l'allumage."},
 turbo:{n:'Survitesse du turbo',part:['Turbocompresseur'],cons:"La roue du compresseur dépasse sa vitesse maxi et éclate ; des débris partent dans l'admission.",fix:'Turbo plus gros, moins de pression, montage étagé.'},
 oil:{n:'Lubrification',part:['Vilebrequin','Bielles'],inner:1,cons:"Le film d'huile se rompt : les coussinets grippent et une bielle se soude au vilebrequin.",fix:"Bon niveau d'huile, viscosité adaptée, pompe saine, carter sec en usage piste."},
 cool:{n:'Refroidissement',part:['Culasse','Culasses','Bloc'],cons:'La chaleur à évacuer dépasse la capacité du circuit : culasse déformée, joint claqué.',fix:"Culasse en aluminium, refroidisseur air/eau, moins de puissance au litre."},
 apex:{n:"Segments d'arête",part:['Rotors'],inner:1,cons:"Un segment d'arête se brise : la chambre n'est plus étanche et la piste du carter est rayée.",fix:'Moins de régime et de pression, rotors et segments renforcés (équipage titane).'},
 gearbox:{n:'Boîte et embrayage',part:[],cons:"L'embrayage patine, puis un pignon ou un arbre de boîte casse.",fix:'Boîte capable de plus de couple (onglet Transmission).'},
};
const DMG={rods:[1.1,3],speed:[1.08,4],gasket:[1.1,2],valves:[1.05,5],knock:[1.06,1.2],lspi:[1.05,2],lean:[1.03,1.2],egt:[1.05,.6],turbo:[1.1,3],oil:[1.15,.2],cool:[1.12,.25],apex:[1.08,2.5],gearbox:[1.25,2]};
const lvOf=(k,r)=>r<.9?'ok':r<1?'warn':r<DMG[k][0]?'crit':'break';
const lc=s=>s.replace(/^./,x=>x.toLocaleLowerCase());
function dmgStep(d,st,dt){for(const k in st){const t=DMG[k];if(!t) continue;const r=st[k];if(r>t[0]){d[k]=(d[k]||0)+(r-t[0])*t[1]*dt*(k==='knock'&&M.E.ecuOn?.3:1);if(d[k]>=1) return k;}}return null;}
function fatigue(){let k=null,v=0;for(const x in ui.dmg) if(ui.dmg[x]>v){v=ui.dmg[x];k=x;}return {k,v};}
function stressCar(rpm,ld){const st=M.E.stressAt(rpm,ld,1,108);st.gearbox=M.C.gbxR*M.E.tq(rpm)*ld/M.E.peakT;return st;}
function crashSound(){
  if(!AU||!ui.snd) return;
  try{const ctx=AU.ctx,len=Math.floor(ctx.sampleRate*.9),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++){const u=i/len;d[i]=(Math.random()*2-1)*Math.exp(-u*6)*(u<.02?1:.7)+Math.sin(i/ctx.sampleRate*2*Math.PI*90)*Math.exp(-u*9)*.6;}
    const s=ctx.createBufferSource(),g=ctx.createGain();g.gain.value=.9;s.buffer=buf;s.connect(g);g.connect(AU.master);s.start();}catch(e){}
}
function brkHTML(){
  const b=ui.broken;if(!b) return '';const f=FAILS[b.k],gb=b.k==='gearbox';
  const where=b.where==='banc'?`au banc, à ${nf(b.rpm,-1)} tr/min`:`pendant l'essai, à ${nf(b.v)} km/h et ${nf(b.rpm,-1)} tr/min`;
  const price=gb?Math.round(M.C.costs['Transmission']*.7/50)*50:M.E.rebuild;
  return `<div class="brk" role="alert"><p><b>${gb?'Transmission cassée':'Moteur cassé'} ${where} · ${f.n}</b></p><p>${f.cons}</p><p><b>Pour que ça ne recommence pas :</b> ${f.fix}</p><button class="btn sm" type="button" data-repair>${gb?'Réparer la boîte':'Reconstruire le moteur'} · ${nf(price)} €</button></div>`;
}
function updBroken(){const h=brkHTML();for(const e of $$('.brk-box')) if(e.dataset.h!==h){e.dataset.h=h;e.innerHTML=h;}}
function flashBroken(){updBroken();const bx=$('.brk-box .brk');if(bx){bx.classList.remove('flash');void bx.offsetWidth;bx.classList.add('flash');bx.scrollIntoView({block:'nearest',behavior:'smooth'});}}
function breakEngine(k,info){
  if(ui.broken) return;
  ui.broken=Object.assign({k},info);ui.run=false;ui.sweep=null;ui.load=0;
  if(AU) audioSet({rpm:M.E.idle,ld:0,pr:1},false);crashSound();
  if(ui.tab==='moteur'&&E3&&FAILS[k].inner&&ui.eview==='3d') ui.eview='cut';
  renderKeys();updBroken();if(ui.tab==='moteur'){setEngView();benchUpdate();}
  const bx=$('.brk-box .brk');if(bx) bx.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function runBreak(end){const tr=M.C.trace,d=Object.assign({},ui.dmg);for(let i=1;i<=end;i++){const k=dmgStep(d,stressCar(tr[i].rpm,1),.05);if(k) return {i,k,d};}return {i:-1,k:null,d};}
function diagHTML(){
  const E=M.E,C=M.C,rows=Object.entries(E.fails).map(([k,v])=>[k,v.r,v.rpm]);
  rows.push(['gearbox',C.gbxR,E.peakTrpm]);rows.sort((a,b)=>b[1]-a[1]);
  const LV={ok:'Correct',warn:'À la limite',crit:'Usure rapide',break:'Casse à fond'};
  return `<div><div class="chart-h"><h3>Résistance du moteur</h3><p class="ch-read">100 % = limite de la pièce · pleine charge, moteur chaud</p></div>
  <ul class="diag">${rows.map(([k,r,rpm])=>{const lv=lvOf(k,r),f=FAILS[k];return `<li class="dg dg-${lv}"><div class="dg-h"><span class="dg-n">${f.n}</span><span class="m-bar"><i style="width:${Math.min(100,r/1.5*100).toFixed(0)}%"></i><b style="left:66.7%"></b></span><span class="m-v">${nf(r*100)} %</span><span class="dg-s">${LV[lv]}</span></div>${lv!=='ok'?`<p>${k==='gearbox'?`${nf(E.peakT)} Nm pour une boîte prévue pour ${nf(C.gbxCap)} Nm. `:(k==='lean'||k==='oil'&&false)?'À pleine charge. ':`Pire cas vers ${nf(rpm,-2)} tr/min. `}${lv==='break'?'<b>Cassera lors d\'un essai à fond.</b> ':''}${f.cons} <i>Remède : ${f.fix}</i></p>`:''}</li>`;}).join('')}</ul>
  <p class="hint">Au-delà de 100 %, la pièce s'use très vite ; plus loin encore, elle casse pendant un essai à fond. La fatigue s'accumule d'un essai à l'autre jusqu'à la reconstruction du moteur.</p>
  ${E.notes.length?`<h4 class="sub-h">Points d'attention</h4><ul class="notes">${E.notes.map(t=>`<li>${t}</li>`).join('')}</ul>`:''}</div>`;
}
function lifeHTML(){
  const E=M.E;
  return `<div><div class="chart-h"><h3>Durée de vie et entretien</h3><p class="ch-read">${nf(E.kmY)} km par an · vidange tous les ${nf(E.oilInt)} km (conseillé : ${nf(E.oilRec)})</p></div>
  ${facts([['Durée de vie estimée',nf(E.life),'km'],['Soit environ',nf(E.life/E.kmY),'ans'],['Entretien par an',nf(Math.round(E.mYear/10)*10),'€'],['Coût au kilomètre',nf(E.mYear/E.kmY*100,1),'centimes'],['Entretien sur sa vie',nf(Math.round(E.mLife/100)*100),'€'],['Reconstruction',nf(E.rebuild),'€ en fin de vie']])}
  ${E.lifeF.length?`<p class="life-f">Ce qui joue sur sa durée de vie : ${E.lifeF.slice(0,6).map(([n,v])=>`${n} <b>${v<1?'−':'+'}${nf(Math.abs(1-v)*100)} %</b>`).join(' · ')}</p>`:''}
  <div class="tbl-wrap"><table class="mnt"><thead><tr><th>Opération</th><th>Tous les</th><th>Coût</th><th>Par an</th></tr></thead><tbody>${E.maint.map(m=>`<tr${m.inLife?'':' class="dim"'}><td>${m.n}${m.note?`<small>${m.note}</small>`:''}</td><td>${nf(m.every)} km</td><td>${nf(m.price)} €</td><td>${m.inLife?nf(m.price*E.kmY/m.every)+' €':'après sa fin de vie'}</td></tr>`).join('')}</tbody></table></div>
  <p class="hint">Estimations pour un usage normal, prix atelier indépendant. L'intervalle de vidange et le kilométrage annuel se règlent dans « Entretien ».</p></div>`;
}
