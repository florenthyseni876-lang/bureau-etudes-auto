'use strict';
/* ───────────── Carrière : écran d'accueil et interface ───────────── */
const BASE_TABS=TABS.slice();
const CTABS=[['direction','Direction'],['recherche','Recherche'],['marche','Marché']];
const isCTab=t=>CTABS.some(x=>x[0]===t);
ui.resAll=false;ui.newPrice=0;ui.newName='';ui.msg='';

function loadDesign(obj){for(const k of Object.keys(S)) delete S[k];Object.assign(S,DEF);if(obj) for(const k of Object.keys(DEF)) if(typeof obj[k]===typeof DEF[k]) S[k]=obj[k];ui.broken=null;ui.dmg={};ui.faults={};}
function renderTabs(){$('#tabs').innerHTML=TABS.map(([k,n])=>`<button class="tab${isCTab(k)?' tab-c':''}" role="tab" type="button" data-tab="${k}" id="tab_${k}" aria-selected="false">${n}</button>`).join('');}
function setMode(mode,g){
  if(mode==='carriere'){
    if(!G){try{localStorage.setItem('bea.design.v1',JSON.stringify(S));}catch(e){}}
    G=g;syncEra();loadDesign(G.design||S);
    TABS.splice(0,TABS.length,...CTABS,...BASE_TABS);
  }else{
    if(G) saveGame();
    G=null;syncEra();
    let d=null;try{d=JSON.parse(localStorage.getItem('bea.design.v1')||'null');}catch(e){}
    loadDesign(d||DEF);
    TABS.splice(0,TABS.length,...BASE_TABS);
  }
  document.body.classList.toggle('mode-c',!!G);
  $('#cbar').hidden=!G;$('#presetCell').hidden=!!G;
  $('#projName').value=S.name||'';
  renderTabs();renderCbar();hideHome();
  setTab(G?'direction':'moteur');
}

/* ── écran d'accueil ── */
function showHome(){
  if(G) saveGame();
  run=null;cruise=null;ui.sweep=null;if(AU) audioSet({rpm:900,ld:0,pr:1},false);
  const sv=loadGame(),h=$('#home');
  $('#hContinue').hidden=!sv;
  if(sv) $('#homeContSub').textContent=`${sv.co} · ${Q[sv.q]} ${sv.y} · trésorerie ${moneyF(sv.cash)}${sv.over?' · faillite':''}`;
  $('#homeMenu').hidden=false;$('#homeNew').hidden=true;
  h.hidden=false;document.body.classList.add('home-on');
  const b=$('#homeMenu button');if(b) b.focus({preventScroll:true});
}
function hideHome(){$('#home').hidden=true;document.body.classList.remove('home-on');}
function homeCars(){
  const ks=['roadster','berline','citadine','supercar'],ys=['1900','1950','1975','2000'];
  return ks.map((k,i)=>`<figure><div>${miniCar(k)}</div><figcaption>${ys[i]}</figcaption></figure>`).join('');
}
function initHome(){
  $('#homeCars').innerHTML=homeCars();
  $('#eraPick').innerHTML=Object.entries(START).map(([y,s],i)=>`<label class="era-card"><input type="radio" name="eraY" value="${y}"${i===0?' checked':''}><span><b>${y}</b><em>${s.n}</em><small>${s.d}</small></span></label>`).join('');
  $('#home').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b) return;
    if(b.id==='hContinue'){const sv=loadGame();if(sv) setMode('carriere',sv);}
    else if(b.id==='hNew'){$('#homeMenu').hidden=true;$('#homeNew').hidden=false;$('#coName').focus();$('#newWarn').hidden=!loadGame();}
    else if(b.id==='hFree') setMode('libre');
    else if(b.id==='hBack'){$('#homeMenu').hidden=false;$('#homeNew').hidden=true;}
    else if(b.id==='hFound'){
      const y=+($('input[name=eraY]:checked')||{value:1900}).value,diff=($('input[name=diff]:checked')||{value:'nor'}).value,co=$('#coName').value.trim()||'Automobiles Nouvelles';
      if(!G){try{localStorage.setItem('bea.design.v1',JSON.stringify(S));}catch(e){}}else saveGame();
      G=null;syncEra();newGame({y,diff,co});setMode('carriere',G);
    }
  });
}

/* ── barre de l'entreprise ── */
function renderCbar(){
  const c=$('#cbar');if(!G){c.innerHTML='';return;}
  const cap=FAC[G.fac][1];
  c.innerHTML=`<div class="cb-id"><span class="eyebrow">Entreprise</span><b>${G.co}</b></div>
   <div class="cb-date"><span class="eyebrow">Date</span><b>${Q[G.q]} ${G.y}</b></div>
   <div><span class="eyebrow">Trésorerie</span><b class="${G.cash<0?'neg':''}">${moneyF(G.cash)}</b></div>
   <div><span class="eyebrow">Dette</span><b>${moneyF(G.debt)}</b></div>
   <div><span class="eyebrow">Réputation</span><b>${nf(G.rep)}<small>/100</small></b></div>
   <div><span class="eyebrow">${FAC[G.fac][0]}</span><b>${nf(cap)}<small> voit./an</small></b></div>
   <div class="cb-act"><button class="btn sm" type="button" id="nextQ"${G.over?' disabled':''}>Trimestre suivant</button><button class="btn sm ghost" type="button" id="nextY"${G.over?' disabled':''}>+1 an</button></div>`;
}
function advance(n){
  for(let i=0;i<n&&!G.over;i++){const k=G.news.length,top=G.news[0];nextQuarter();if(i<n-1&&G.news[0]!==top&&G.news.slice(0,G.news.length-k+1).some(x=>x.k==='crit')) break;}
  renderCbar();
  if(isCTab(ui.tab)){render();}else{buildControls();render();}
  const nb=$('#tab_direction');if(nb&&ui.tab!=='direction'&&G.news[0]&&G.news[0].y===G.y) nb.classList.add('ping');
}

/* ── pages ── */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function tile(l,v,sub){return `<div class="tile"><span class="eyebrow">${l}</span><b>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;}
function stBadge(m){return m.st==='dev'?`<span class="pill">Développement · ${m.devLeft} trim.</span>`:m.st==='prod'?'<span class="pill ok">En production</span>':'<span class="pill off">Arrêté</span>';}
function careerHTML(t){
  if(t==='direction') return dirHTML();
  if(t==='recherche') return resHTML();
  return mktHTML();
}
function dirHTML(){
  const y=yq(),lq=G.lastQ||{rev:0,profit:0,units:0},cap=FAC[G.fac][1];
  let h='';
  if(G.over) h+=`<div class="brk"><b>Faillite de ${esc(G.co)}</b><p>La trésorerie est restée négative deux trimestres de suite. Vous pouvez fonder une nouvelle entreprise depuis l'accueil.</p><button class="btn sm" type="button" id="goHome">Retour à l'accueil</button></div>`;
  h+=`<section class="cgrp"><h3>Le trimestre écoulé</h3><div class="tiles">${tile('Voitures vendues',nf(lq.units),`capacité ${nf(cap/4)} par trimestre`)}${tile('Chiffre d\'affaires',moneyF(lq.rev))}${tile('Résultat',moneyF(lq.profit),lq.upk?`dont usine ${moneyF(-lq.upk)}${lq.int?` · intérêts ${moneyF(-lq.int)}`:''}`:'')}${tile('Réputation',nf(G.rep)+' / 100',G.rep>=60?'Marque recherchée':G.rep>=40?'Marque connue':'Marque peu connue')}</div></section>`;
  // gamme
  const ms=G.models.slice().reverse();
  h+=`<section class="cgrp"><h3>Gamme</h3>${ms.length?`<div class="tbl-w"><table class="ctbl"><thead><tr><th>Modèle</th><th>État</th><th class="n">Prix</th><th class="n">Demande / an</th><th class="n">Vendues (trim.)</th><th class="n">Coût unitaire</th><th class="n">Marge</th><th></th></tr></thead><tbody>${ms.map(m=>{const l=m.last;const mar=l&&l.u?(m.price-l.uc-l.war)/m.price:null;return `<tr><td><span class="mini">${miniCar(m.met.body)}</span><b>${esc(m.name)}</b><small>${m.y} · ${nf(m.met.P)} ch · ${nf(m.met.v)} km/h · vendues ${nf(m.sold)}</small></td><td>${stBadge(m)}</td><td class="n">${m.st==='stop'?moneyF(m.price):`<input class="num" type="number" inputmode="numeric" min="100" step="100" data-price="${m.id}" value="${Math.round(m.price)}" aria-label="Prix de ${esc(m.name)}">`}</td><td class="n">${l?nf(l.dem*4,-1):'—'}</td><td class="n">${l?nf(l.u)+(l.lim?' <span class="pill warn" title="Usine saturée">usine pleine</span>':''):'—'}</td><td class="n">${l&&l.u?moneyF(l.uc+l.war):'—'}</td><td class="n">${mar==null?'—':nf(mar*100)+' %'}</td><td class="act"><button class="chip-btn" type="button" data-open="${m.id}">Reprendre au bureau</button>${m.st!=='stop'?`<button class="chip-btn" type="button" data-stop="${m.id}">Arrêter</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="grp-note">Aucun modèle pour l\'instant. Concevez une voiture dans les onglets Moteur, Carrosserie, Transmission… puis lancez son développement ci-dessous.</p>'}</section>`;
  h+=newModelHTML();
  // usine
  const nl=G.fac+1,uti=lq.cap?lq.units*4/lq.cap:0;
  h+=`<section class="cgrp"><h3>Usine</h3><div class="row2"><div><p><b>${FAC[G.fac][0]}</b> · ${nf(cap)} voitures par an · charges fixes ${moneyF(facUpkeep(G.fac,y))} par an.</p><div class="gmeter" role="img" aria-label="Utilisation de l'usine ${nf(uti*100)} %"><i style="width:${clamp(uti*100,0,100).toFixed(1)}%"></i></div><p class="grp-note">Utilisation ${nf(uti*100)} % au dernier trimestre.</p></div><div>${G.build?`<p>Construction en cours : <b>${FAC[G.build.l][0]}</b>, mise en service dans ${G.build.left} trimestre${G.build.left>1?'s':''}.</p>`:nl<FAC.length?`<p>Agrandir : <b>${FAC[nl][0]}</b> (${nf(FAC[nl][1])} voitures par an) · ${moneyF(facCost(nl,y))} · 3 trimestres · charges ${moneyF(facUpkeep(nl,y))} par an.</p><button class="btn sm" type="button" id="facUp"${G.over?' disabled':''}>Construire</button>`:'<p>Capacité maximale atteinte.</p>'}</div></div></section>`;
  // finances
  const lim=loanLimit(),step=Math.max(1e4,Math.pow(10,Math.floor(Math.log10(Math.max(lim,1e4))))/2);
  h+=`<section class="cgrp"><h3>Banque</h3><p>Dette ${moneyF(G.debt)} sur un plafond de ${moneyF(lim)} · intérêts 6 % par an. Si la trésorerie passe sous zéro, la banque comble automatiquement dans la limite du plafond.</p><div class="btns"><button class="chip-btn" type="button" id="borrow"${G.debt+step>lim||G.over?' disabled':''}>Emprunter ${moneyF(step)}</button><button class="chip-btn" type="button" id="repay"${G.debt<=0||G.cash<Math.min(step,G.debt)?' disabled':''}>Rembourser ${moneyF(Math.min(step,G.debt))}</button></div></section>`;
  h+=histHTML();
  h+=`<section class="cgrp"><h3>Actualités</h3><ul class="news">${G.news.slice(0,14).map(n=>`<li class="nw-${n.k}"><span class="eyebrow">${Q[n.q]} ${n.y}</span><b>${esc(n.t)}</b><p>${esc(n.d)}</p></li>`).join('')}</ul></section>`;
  return `<div class="career">${h}</div>`;
}
function newModelHTML(){
  const y=yq(),met=measure(M.E,M.C),uc=unitCost(met,Math.min(FAC[G.fac][1],2000)),sug=Math.round(uc*1.35/100)*100;
  if(!ui.newPrice) ui.newPrice=sug;
  const price=ui.newPrice,d=demand([{met,price,age:1.1,y:G.y}],y)[0],dc=devCost(met,y),ban=regBan(met,G.y);
  const segs=SEGS.map(s=>[s,d.seg[s.k]||0]),mx=Math.max(1,...segs.map(x=>x[1]));
  const issues=[];if(!met.fit) issues.push('Le moteur ne rentre pas dans la caisse : impossible à produire.');if(ban) issues.push(`Non homologable : ${ban.n} (il faut : ${ban.need}).`);
  for(const r of REGS) if(r[0]>G.y&&r[0]<=G.y+6&&!r[2](met)) issues.push(`Sera interdit en ${r[0]} : ${r[1]}.`);
  if(met.defects.length) issues.push(`Défauts techniques (${met.defects.join(', ')}) : frais de garantie et réputation en baisse. Voir l'onglet Essais.`);
  return `<section class="cgrp" id="newModel"><h3>Lancer un nouveau modèle</h3><p class="grp-note">Projet actuel du bureau d'études : <b>${esc(S.name||'Sans nom')}</b> · ${BODY[met.body].n} · ${met.cfg} ${nf(met.L,1)} l · ${nf(met.P)} ch · ${nf(met.v)} km/h · ${nf(met.mix,1)} l/100 km. Modifiez-le dans les onglets de conception.</p>
  <div class="row2"><div><div class="f"><div class="f-top"><label for="nmName">Nom commercial</label></div><input class="txt" type="text" id="nmName" maxlength="30" value="${esc(ui.newName||S.name||'')}"></div>
  <div class="f"><div class="f-top"><label for="nmPrice">Prix de vente</label><output id="nmMarg">marge ${nf((price-uc)/price*100)} %</output></div><input class="num wide" type="number" inputmode="numeric" id="nmPrice" min="100" step="100" value="${price}"><p class="hint">Coût de fabrication estimé ${moneyF(uc)} par voiture · prix conseillé ${moneyF(sug)}. Prix moyen d'une voiture populaire en ${G.y} : ${moneyF(refPrice(y))}.</p></div>
  <p>Étude et outillage : <b>${moneyF(dc)}</b> · sortie dans ${devQ(y)} trimestres.</p>
  ${issues.length?`<ul class="iss">${issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:''}
  <button class="btn" type="button" id="launch"${!met.fit||ban||G.over?' disabled':''}>Lancer le développement</button><p class="grp-note" id="launchMsg" role="status">${esc(ui.msg)}</p></div>
  <div><p class="eyebrow">Demande estimée à ce prix : ${nf(d.tot,-1)} voitures par an</p><ul class="sbars">${segs.map(([s,v])=>`<li><span>${s.n}</span><i><b style="width:${(v/mx*100).toFixed(1)}%"></b></i><em>${nf(v,v>=100?-1:0)}</em></li>`).join('')}</ul><p class="hint">Estimation pour un modèle neuf face à la concurrence de ${G.y}, avec votre réputation actuelle. La capacité de l'usine limite ensuite les ventes.</p></div></div></section>`;
}
function histHTML(){
  const H=G.hist.slice(-24);if(!H.length) return '';
  const w=Math.max(320,Math.min(760,($('#stage').clientWidth||700)-40)),h=190,m={l:56,r:12,t:14,b:26},pw=w-m.l-m.r,ph=h-m.t-m.b;
  const mx=Math.max(1,...H.map(x=>x.units)),ax=niceAxis(mx,4),bw=Math.min(24,pw/H.length-2);
  const X=i=>m.l+(i+.5)*pw/H.length,Yv=v=>m.t+ph-v/ax.top*ph;
  let s=`<svg class="ch" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Voitures vendues par an">`;
  for(const t of ax.t) s+=`<line class="ch-g" x1="${m.l}" x2="${w-m.r}" y1="${Yv(t)}" y2="${Yv(t)}"/><text class="ch-t" x="${m.l-7}" y="${Yv(t)+3.5}" text-anchor="end">${t>=1e4?nf(t/1e3)+' k':nf(t)}</text>`;
  H.forEach((x,i)=>{const y0=Yv(0),y1=Yv(x.units),hh=y0-y1;s+=`<path d="M${(X(i)-bw/2).toFixed(1)} ${y0}V${(y1+Math.min(4,hh)).toFixed(1)}q0 -${Math.min(4,hh).toFixed(1)} ${Math.min(4,bw/2).toFixed(1)} -${Math.min(4,hh).toFixed(1)}H${(X(i)+bw/2-Math.min(4,bw/2)).toFixed(1)}q${Math.min(4,bw/2).toFixed(1)} 0 ${Math.min(4,bw/2).toFixed(1)} ${Math.min(4,hh).toFixed(1)}V${y0}Z" fill="var(--s1)"><title>${x.y} : ${nf(x.units)} voitures</title></path>`;if(H.length<=12||i%Math.ceil(H.length/8)===0) s+=`<text class="ch-t" x="${X(i)}" y="${h-8}" text-anchor="middle">${x.y}</text>`;});
  s+=`<line class="ch-a" x1="${m.l}" x2="${w-m.r}" y1="${Yv(0)}" y2="${Yv(0)}"/></svg>`;
  const rows=G.hist.slice(-8).reverse();
  return `<section class="cgrp"><h3>Historique</h3><p class="eyebrow">Voitures vendues par an</p><div class="ch-w">${s}</div><div class="tbl-w"><table class="ctbl"><thead><tr><th>Année</th><th class="n">Ventes</th><th class="n">Chiffre d'affaires</th><th class="n">Résultat</th><th class="n">Trésorerie</th><th class="n">Réputation</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.y}</td><td class="n">${nf(x.units)}</td><td class="n">${moneyF(x.rev)}</td><td class="n${x.profit<0?' neg':''}">${moneyF(x.profit)}</td><td class="n">${moneyF(x.cash)}</td><td class="n">${nf(x.rep)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function resHTML(){
  const y=yq();let h='';
  if(G.res){const t=TECH[G.res.id],p=1-G.res.left/G.res.tot;h+=`<section class="cgrp"><h3>Recherche en cours</h3><p><b>${t.n}</b> · encore ${G.res.left} trimestre${G.res.left>1?'s':''}.</p><div class="gmeter" role="img" aria-label="Avancement ${nf(p*100)} %"><i style="width:${(p*100).toFixed(1)}%"></i></div><p class="grp-note">${esc(t.d)}</p></section>`;}
  else h+=`<section class="cgrp"><h3>Recherche</h3><p class="grp-note">Aucune recherche en cours. Une technologie ne peut être étudiée qu'à partir de son année d'invention ; plus on attend, moins elle coûte. Les pièces qu'elle débloque deviennent disponibles dans le bureau d'études.</p></section>`;
  const own=new Set(G.techs);
  h+=`<div class="res-tools"><div class="seg" role="radiogroup" aria-label="Filtre"><button type="button" role="radio" data-rf="0" aria-checked="${!ui.resAll}">Disponibles et à venir</button><button type="button" role="radio" data-rf="1" aria-checked="${ui.resAll}">Toutes</button></div><span class="grp-note">${own.size} technologies acquises sur ${TECHS.length}</span></div>`;
  for(const [dk,dn] of DOMS){
    const ts=TECHS.map(t=>TECH[t[0]]).filter(t=>t.dom===dk).filter(t=>ui.resAll||(!own.has(t.id)&&t.y<=G.y+12)).sort((a,b)=>a.y-b.y);
    if(!ts.length) continue;
    h+=`<section class="cgrp"><h3>${dn}</h3><ul class="techs">${ts.map(t=>{
      const has=own.has(t.id),cur=G.res&&G.res.id===t.id,fut=t.y>G.y;
      const unl=t.u.map(([k,v])=>uLabel(k,v)).filter(Boolean).join(', ');
      let st;if(has) st='<span class="pill ok">Acquise</span>';else if(cur) st='<span class="pill">En cours</span>';else if(fut) st=`<span class="pill off">Inventée en ${t.y}</span>`;
      else st=`<button class="chip-btn" type="button" data-res="${t.id}"${G.res||G.over?' disabled':''}>Rechercher · ${moneyF(resCost(t,y))} · ${resQ(t,y)} trim.</button>`;
      return `<li class="${has?'is-has':fut?'is-fut':''}"><div><b>${t.n}</b><span class="eyebrow">${t.y}</span><p>${esc(t.d)}${unl?` <em>Débloque : ${esc(unl)}.</em>`:''}</p></div><div>${st}</div></li>`;}).join('')}</ul></section>`;
  }
  return `<div class="career">${h}</div>`;
}
const U_TAB={config:CFG,valvetrain:VT,fuelSys:FS,timing:TIMING,blockMat:BLOCK,liner:LINER,sump:SUMP,valveMat:VALVE,springs:SPRING,intake:INTAKE,turboStage:STAGE,turboType:TURBO,turboBearing:BEAR,scType:SCT,oilGrade:OIL,fuel:FUEL,body:BODY,enginePos:POS,chassis:CHAS,panels:PANEL,gearbox:GBX,suspF:SUSP,suspR:SUSP,compound:TYRE,brakeF:BRK,brakeR:BRK,trim:TRIM,media:MEDIA,passive:PASS,steering:STEER,manifold:EXH.man,cat:EXH.cat,muffler:EXH.muf};
function uLabel(k,v){
  if(k==='ecuFuel'||k==='brakeR'||k==='suspR'||k==='splitter') return '';
  if(typeof v==='boolean') return {vvt:'calage variable',vvl:'levée variable',cda:'désactivation de cylindres',flex:'capteur d\'éthanol',launchCtl:'launch control',pops:'cartographies',startStop:'stop & start',ecuVmax:'bridage électronique',flatFloor:'fond plat',abs:'ABS',tc:'antipatinage',esp:'ESP'}[k]||'';
  if(k==='config') return CFG[v].full||CFG[v].lab;
  if(k==='aspiration') return {sc:'compresseur',turbo:'turbo',biturbo:'biturbo',tri:'triturbo',quad:'quadriturbo'}[v];
  if(k==='drive') return DRV[v];if(k==='headMat') return 'culasse alu';if(k==='internals') return v==='ti'?'bielles titane':'équipage forgé';if(k==='diff') return v==='lsd'?'autobloquant':'différentiel piloté';
  if(k==='intercooler') return v==='air'?'échangeur air/air':'échangeur air/eau';if(k==='rimType') return v==='alloy'?'jantes alliage':'jantes forgées';if(k==='wing') return v==='lip'?'becquet':'aileron';
  const T=U_TAB[k];return T&&T[v]?String(T[v].n||'').toLocaleLowerCase():'';
}
function mktHTML(){
  const y=yq(),vol=marketVol(y),sh=segShares(y);
  let h=`<section class="cgrp"><h3>Le marché en ${G.y}</h3><div class="tiles">${tile('Voitures neuves par an',nf(vol,-2),SHOCK[G.y]?'marché perturbé cette année':'')}${tile('Concurrents',nf(itp(NCOMP,y)),'marques en activité')}${tile('Voiture populaire',moneyF(refPrice(y)),'prix moyen')}${tile('Votre part',G.lastQ&&vol?nf(G.lastQ.units*4/vol*100,2)+' %':'—','au dernier trimestre')}</div></section>`;
  h+=`<section class="cgrp"><h3>Ce que les clients attendent</h3><p class="grp-note">Voiture moyenne de chaque clientèle en ${G.y}. Faire mieux attire les acheteurs ; les attentes montent chaque année.</p><div class="tbl-w"><table class="ctbl"><thead><tr><th>Clientèle</th><th class="n">Part du marché</th><th class="n">Puissance</th><th class="n">Vitesse maxi</th><th class="n">Prix moyen</th><th>Ce qui compte</th></tr></thead><tbody>${SEGS.map((s,i)=>`<tr><td><b>${s.n}</b></td><td class="n">${nf(sh[i]*100)} %</td><td class="n">${nf(itp(REF.P,y)*s.sp)} ch</td><td class="n">${nf(itp(REF.V,y)*s.sv,-1)} km/h</td><td class="n">${moneyF(refPrice(y,s))}</td><td>${segWhat(s,y)}</td></tr>`).join('')}</tbody></table></div></section>`;
  const up=REGS.filter(r=>r[0]>=G.y);
  h+=`<section class="cgrp"><h3>Réglementation</h3>${up.length?`<ul class="news">${up.map(r=>`<li class="nw-warn"><span class="eyebrow">${r[0]}</span><b>${r[1]}</b><p>Exigé : ${r[3]}.</p></li>`).join('')}</ul>`:'<p class="grp-note">Toutes les normes connues sont en vigueur.</p>'}</section>`;
  const nx=TECHS.filter(t=>t[3]>G.y&&t[3]<=G.y+10).slice(0,12);
  h+=`<section class="cgrp"><h3>Inventions à venir</h3>${nx.length?`<ul class="techs">${nx.map(t=>`<li class="is-fut"><div><b>${t[2]}</b><span class="eyebrow">${t[3]}</span></div></li>`).join('')}</ul>`:'<p class="grp-note">Rien de prévu dans les dix ans.</p>'}</section>`;
  return `<div class="career">${h}</div>`;
}
function segWhat(s,y){
  const w=Object.assign({},s.w);if(w.eco) w.eco*=itp(ECO_IMP,y);if(w.saf) w.saf*=itp(SAF_IMP,y);w.prix=s.el*.35;
  const L={P:'puissance',V:'vitesse',comf:'confort',rel:'fiabilité',eco:'sobriété',saf:'sécurité',pract:'habitabilité',hand:'tenue de route',prest:'prestige',off:'franchissement',prix:'prix'};
  return Object.entries(w).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>L[x[0]]).join(', ');
}

/* ── interactions ── */
function careerClick(e){
  if(!G) return false;
  const b=e.target.closest('button');if(!b) return false;
  const id=b.id;let msg=null;
  if(id==='launch'){const nm=($('#nmName').value||'').trim()||S.name;msg=launchModel(nm,ui.newPrice);ui.msg=msg||'';if(!msg){ui.newPrice=0;ui.newName='';}}
  else if(id==='facUp') msg=buildFactory();
  else if(id==='borrow'){const lim=loanLimit(),st=Math.max(1e4,Math.pow(10,Math.floor(Math.log10(Math.max(lim,1e4))))/2);if(G.debt+st<=lim){G.debt+=st;G.cash+=st;}}
  else if(id==='repay'){const lim=loanLimit(),st=Math.min(G.debt,Math.max(1e4,Math.pow(10,Math.floor(Math.log10(Math.max(lim,1e4))))/2));if(G.cash>=st){G.debt-=st;G.cash-=st;}}
  else if(id==='goHome'){showHome();return true;}
  else if(b.dataset.res){msg=startResearch(b.dataset.res);}
  else if(b.dataset.rf){ui.resAll=b.dataset.rf==='1';}
  else if(b.dataset.stop){const m=G.models.find(x=>x.id==b.dataset.stop);if(m&&confirm(`Arrêter définitivement la production de ${m.name} ?`)){m.st='stop';news(`Fin de production : ${m.name}`,`${nf(m.sold)} exemplaires vendus.`);}}
  else if(b.dataset.open){const m=G.models.find(x=>x.id==b.dataset.open);if(m){loadDesign(m.snap);S.name=m.name+' II';$('#projName').value=S.name;saveGame();setTab('moteur');return true;}}
  else return false;
  if(msg) ui.msg=msg;
  saveGame();renderCbar();render();
  return true;
}
function careerInput(e){
  if(!G) return;
  const t=e.target;
  if(t.id==='nmPrice'){const v=+t.value;if(v>0){ui.newPrice=v;const card=$('#newModel');if(card&&e.type==='change'){const f=document.activeElement===t;card.outerHTML=newModelHTML();if(f){const n=$('#nmPrice');n.focus();}}}}
  else if(t.id==='nmName') ui.newName=t.value;
  else if(t.dataset.price&&e.type==='change'){const m=G.models.find(x=>x.id==t.dataset.price),v=+t.value;if(m&&v>0){m.price=Math.round(v/10)*10;saveGame();}}
}
$('#stage').addEventListener('click',e=>{if(careerClick(e)) e.stopImmediatePropagation();},true);
$('#stage').addEventListener('input',careerInput);
$('#stage').addEventListener('change',careerInput);
$('#cbar').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!G) return;if(b.id==='nextQ') advance(1);else if(b.id==='nextY') advance(4);});
$('#homeBtn').addEventListener('click',showHome);
initHome();
