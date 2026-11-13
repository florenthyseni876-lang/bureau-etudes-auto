'use strict';
/* ───────────── Carrière : écran d'accueil et interface ───────────── */
const BASE_TABS=TABS.slice();
const CTABS=[['qg','Quartier général'],['gamme','Ma gamme'],['recherche','Recherche'],['usine','Usine et banque'],['marche','Marché'],['vente','Mise en vente']];
const isCTab=t=>CTABS.some(x=>x[0]===t);
ui.resAll=false;ui.newPrice=0;ui.newName='';ui.msg='';ui.flash='';ui.wizOk=null;

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
  setTab(G?(G.wiz?STEPS[G.wiz.max][0]:'qg'):'moteur');
}

/* ── écran d'accueil ── */
function showHome(){
  if(G) saveGame();
  run=null;cruise=null;ui.sweep=null;if(AU) audioSet({rpm:900,ld:0,pr:1},false);
  const sv=loadGame(),h=$('#home');
  $('#hContinue').hidden=!sv;
  if(sv) $('#homeContSub').textContent=`${sv.co} · ${Q[sv.q]} ${sv.y} · trésorerie ${moneyF(sv.cash,sv.y)}${sv.over?' · faillite':''}`;
  $('#homeMenu').hidden=false;$('#homeNew').hidden=true;
  h.hidden=false;document.body.classList.add('home-on');
  const b=$('#homeMenu button');if(b) b.focus({preventScroll:true});
}
function hideHome(){$('#home').hidden=true;document.body.classList.remove('home-on');}
function homeCars(){
  const cs=[['roadster','hippo','none','acet','none','1900'],['berline','classique','chrome','elec','aile','1925'],['coupe','ailerons','massif','rond','porte','1957'],['compacte','tendu','caout','halo','porte','1975'],['berline','bio','bouclier','xenon','elec','1995'],['supercar','moderne','bouclier','led','elec','2020']];
  return cs.map(([k,st,bu,li,mi,y])=>`<figure><div>${miniCar(k,{style:st,bumper:bu,lights:li,mirrors:mi})}</div><figcaption>${y}</figcaption></figure>`).join('');
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
      G=null;syncEra();newGame({y,diff,co});sanitize();eraFix();tuneSafe();setMode('carriere',G);
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
   <div class="cb-debt"><span class="eyebrow">Dette</span><b>${moneyF(G.debt)}</b></div>
   <div><span class="eyebrow">Réputation</span><b>${nf(G.rep)}<small>/100</small></b></div>
   <div class="cb-fac"><span class="eyebrow">${FAC[G.fac][0]}</span><b>${nf(cap)}<small> voit./an</small></b></div>
   <div class="cb-act"><div class="clock" role="group" aria-label="Écoulement du temps">${[[0,'❚❚','Pause'],[1,'▶','Vitesse normale'],[2,'▶▶','Vitesse ×2'],[4,'▶▶▶','Vitesse ×4']].map(([v,ic,l])=>`<button type="button" class="clk${(G.spd||0)===v?' on':''}" data-spd="${v}" aria-pressed="${(G.spd||0)===v}" aria-label="${l}" title="${l}">${ic}</button>`).join('')}</div><button class="btn sm ghost" type="button" id="nextQ"${G.over?' disabled':''} title="Passer directement au trimestre suivant">Trimestre suivant</button></div>
   <div class="cb-prog" aria-hidden="true"><i id="qProg" style="width:${(clamp((G.qt||0)/QSEC,0,1)*100).toFixed(1)}%"></i></div>`;
}
function advance(n){
  const y0=G.y,nt0=G.techs.length;G.qt=0;
  for(let i=0;i<n&&!G.over;i++){const k=G.news.length,top=G.news[0];nextQuarter();if(i<n-1&&G.news[0]!==top&&G.news.slice(0,G.news.length-k+1).some(x=>x.k==='crit')) break;}
  renderCbar();
  if(isCTab(ui.tab)||(G.y===y0&&G.techs.length===nt0)){render();}else{buildControls();render();}
  if(G.pendingNews&&G.pendingNews.length){const id=G.pendingNews.shift();saveGame();const m=G.models.find(x=>x.id===id);if(m&&m.press) showLaunch(m);}
}

/* ── pages ── */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function tile(l,v,sub){return `<div class="tile"><span class="eyebrow">${l}</span><b>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;}
function stBadge(m){return m.st==='dev'?`<span class="pill">Développement · ${m.devLeft} trim.</span>`:m.st==='prod'?'<span class="pill ok">En production</span>':'<span class="pill off">Arrêté</span>';}
function careerHTML(t){
  return ({qg:qgHTML,gamme:gammeHTML,usine:usineHTML,vente:venteHTML,recherche:resHTML,marche:mktHTML}[t]||qgHTML)();
}
function lastQHTML(){
  const lq=G.lastQ||{rev:0,profit:0,units:0},cap=FAC[G.fac][1];
  return `<section class="cgrp"><h3>Le trimestre écoulé</h3><div class="tiles">${tile('Voitures vendues',nf(lq.units),`capacité ${nf(cap/4)} par trimestre`)}${tile('Chiffre d\'affaires',moneyF(lq.rev))}${tile('Résultat',moneyF(lq.profit),lq.upk?`dont usine ${moneyF(-lq.upk)}${lq.int?` · intérêts ${moneyF(-lq.int)}`:''}`:'')}${tile('Réputation',nf(G.rep)+' / 100',G.rep>=60?'Marque recherchée':G.rep>=40?'Marque connue':'Marque peu connue')}</div></section>`;
}
function todo(){
  const t=[];
  if(G.over) return t;
  const prod=G.models.filter(m=>m.st==='prod'),dev=G.models.filter(m=>m.st==='dev');
  if(G.wiz) t.push({t:`Terminer la conception de « ${esc(S.name||'Sans nom')} »`,d:`Étape ${Math.min(G.wiz.max+1,STEPS.length)} sur ${STEPS.length} : ${STEPS[Math.min(G.wiz.max,STEPS.length-1)][1].toLocaleLowerCase()}.`,b:`<button class="btn" type="button" data-go="${STEPS[G.wiz.max][0]}">Reprendre la conception</button>`});
  else if(!G.models.length) t.push({t:'Concevoir votre première voiture',d:`Vous allez passer par ${STEPS.length} étapes : ${STEPS.map(x=>x[1].toLocaleLowerCase()).join(', ')}. Chaque étape se valide avant la suivante.`,b:'<button class="btn" type="button" data-newcar="1">Concevoir ma première voiture</button>'});
  if(dev.length&&!prod.length) t.push({t:`${esc(dev[0].name)} est en développement`,d:`Encore ${dev[0].devLeft} trimestre${dev[0].devLeft>1?'s':''} avant la sortie. Appuyez sur « Trimestre suivant » en haut pour avancer le temps.`});
  if(prod.some(m=>m.last&&m.last.lim)) t.push({t:'Votre usine tourne à plein',d:'Des clients repartent sans voiture : agrandissez l\'usine ou augmentez vos prix.',b:'<button class="chip-btn" type="button" data-go="usine">Voir l\'usine</button>'});
  if(prod.length&&prod.every(m=>m.last&&m.last.u===0)) t.push({t:'Aucune vente ce trimestre',d:'Votre prix est peut-être trop élevé, ou la voiture n\'attire aucune clientèle. Comparez-la aux attentes dans la page Marché.',b:'<button class="chip-btn" type="button" data-go="marche">Voir le marché</button>'});
  if(G.resL.length<resSlots()&&G.models.length){const av=TECHS.filter(x=>x[3]<=G.y&&!G.techs.includes(x[0]));if(av.length) t.push({t:G.resL.length?'Un laboratoire est libre':'Aucune recherche en cours',d:`${av.length} technologie${av.length>1?'s':''} disponible${av.length>1?'s':''} à étudier.`,b:'<button class="chip-btn" type="button" data-go="recherche">Choisir une recherche</button>'});}
  if(typeof rivTodo==='function'){const x=rivTodo();if(x) t.push(x);}
  if(!t.length) t.push({t:'Tout roule',d:'Passez au trimestre suivant, ou préparez un nouveau modèle pour suivre les attentes des clients.'});
  return t;
}
function qgHTML(){
  let h='';
  if(G.over) h+=`<div class="brk"><b>Faillite de ${esc(G.co)}</b><p>La trésorerie est restée négative deux trimestres de suite. Vous pouvez fonder une nouvelle entreprise depuis l'accueil.</p><button class="btn sm" type="button" id="goHome">Retour à l'accueil</button></div>`;
  if(ui.flash){h+=`<div class="flash" role="status">${esc(ui.flash)}</div>`;ui.flash='';}
  const td=todo();
  h+=`<section class="cgrp todo"><h3>À faire maintenant</h3><ol class="todo-l">${td.map(x=>`<li><div><b>${x.t}</b><p>${x.d}</p></div>${x.b?`<div>${x.b}</div>`:''}</li>`).join('')}</ol></section>`;
  {const rec=G.models.filter(m=>m.press&&(G.y*4+G.q)-(m.press.y*4+m.press.q)<=2);for(const m of rec) h+=`<section class="cgrp"><h3>La presse a essayé votre ${esc(m.name)}</h3>${pressHTML(m)}<div class="btns"><button class="chip-btn" type="button" data-journal="${m.id}">Ouvrir le journal</button></div></section>`;}
  if(G.models.length) h+=lastQHTML();
  if(typeof rivRankLine==='function') h+=rivRankLine();
  const prod=G.models.filter(m=>m.st==='prod').length,dev=G.models.filter(m=>m.st==='dev').length,lq=G.lastQ,uti=lq&&lq.cap?lq.units*4/lq.cap:0;
  const card=(go,t,d,ico)=>`<button class="qg-card" type="button" ${go}><span class="qg-i" aria-hidden="true">${ico}</span><b>${t}</b><span>${d}</span></button>`;
  h+=`<section class="qg-grid" aria-label="Services de l'entreprise">
   ${card(G.wiz?`data-go="${STEPS[G.wiz.max][0]}"`:'data-newcar="1"',G.wiz?'Reprendre la conception':'Nouvelle voiture',G.wiz?`${esc(S.name||'Sans nom')} · étape ${G.wiz.max+1} sur ${STEPS.length}`:'Concevoir un modèle, étape par étape','✎')}
   ${card('data-go="gamme"','Ma gamme',G.models.length?`${prod} en vente · ${dev} en développement`:'Aucun modèle pour l\'instant','▤')}
   ${card('data-go="recherche"','Recherche',G.resL.length?`En cours : ${G.resL.map(r=>TECH[r.id].n).join(', ')}`:`Aucune recherche en cours · ${resSlots()} emplacement${resSlots()>1?'s':''}`,'⚗')}
   ${card('data-go="usine"','Usine et banque',`${FAC[G.fac][0]} · utilisée à ${nf(uti*100)} %`,'⚙')}
   ${card('data-go="marche"','Marché',`${nf(marketVol(yq()),-3)} voitures neuves par an en ${G.y}`,'◷')}
  </section>`;
  h+=`<section class="cgrp"><h3>Actualités</h3><ul class="news">${G.news.slice(0,6).map(n=>`<li class="nw-${n.k}"><span class="eyebrow">${Q[n.q]} ${n.y}</span><b>${esc(n.t)}</b><p>${esc(n.d)}</p></li>`).join('')}</ul></section>`;
  return `<div class="career">${h}</div>`;
}
function roundNice(v){const st=Math.pow(10,Math.max(0,Math.floor(Math.log10(Math.max(v,1)))-2));return Math.round(v/st)*st;}
function noteCls(n){return n>=14?'n-ok':n>=10?'n-mid':'n-bad';}
function pressHTML(m){const p=m.press;return `<p class="grp-note">Moyenne ${nf(p.avg,1)}/20 · jugée comme une voiture ${p.seg.toLocaleLowerCase()} · ${Q[p.q]} ${p.y}. ${p.avg>=12?'Cette bonne presse attire des clients pendant les premières années.':'Ces critiques freinent les ventes pendant les premières années.'}</p><ul class="press">${p.list.map(r=>`<li><div class="press-h"><b>${esc(r.mag)}</b><span class="note ${noteCls(r.note)}">${nf(r.note,1)}/20</span></div><p>« ${esc(r.txt)} »</p></li>`).join('')}</ul>`;}
function gammeHTML(){
  const ms=G.models.slice().reverse();
  let h=`<section class="cgrp"><h3>Modèles</h3>${ms.length?`<div class="tbl-w"><table class="ctbl"><thead><tr><th>Modèle</th><th>État</th><th class="n">Prix</th><th class="n">Demande / an</th><th class="n">Vendues (trim.)</th><th class="n">Coût unitaire</th><th class="n">Marge</th><th class="n">Presse</th><th></th></tr></thead><tbody>${ms.map(m=>{const l=m.last;const mar=l&&l.u?(m.price-l.uc-l.war)/m.price:null;return `<tr><td><span class="mini">${miniCar(m.met.body,m.snap)}</span><b>${esc(m.name)}</b><small>${m.y} · ${nf(m.met.P)} ch · ${nf(m.met.v)} km/h · vendues ${nf(m.sold)}</small></td><td>${stBadge(m)}</td><td class="n">${m.st==='stop'?moneyF(m.price):`<input class="num" type="number" inputmode="numeric" min="100" step="100" data-price="${m.id}" step="1" value="${Math.round(toCur(m.price))}" aria-label="Prix de ${esc(m.name)}">`}</td><td class="n">${l?nf(l.dem*4,-1):'—'}</td><td class="n">${l?nf(l.u)+(l.lim?' <span class="pill warn" title="Usine saturée">usine pleine</span>':''):'—'}</td><td class="n">${l&&l.u?moneyF(l.uc+l.war):'—'}</td><td class="n">${mar==null?'—':nf(mar*100)+' %'}</td><td class="n">${m.press?`<span class="note ${noteCls(m.press.avg)}">${nf(m.press.avg,1)}/20</span>`:'—'}</td><td class="act"><button class="chip-btn" type="button" data-evol="${m.id}">Créer une évolution</button>${m.st!=='stop'?`<button class="chip-btn" type="button" data-stop="${m.id}">Arrêter</button>`:''}</td></tr>`;}).join('')}</tbody></table></div><p class="hint">Le prix se modifie directement dans le tableau, en ${curName(G.y)} de ${G.y}. « Créer une évolution » ouvre la conception à partir de ce modèle.</p>${ms.filter(m=>m.press).map(m=>`<details class="press-d"><summary>Revue de presse : ${esc(m.name)} · ${nf(m.press.avg,1)}/20</summary>${pressHTML(m)}<button class="chip-btn" type="button" data-journal="${m.id}">Ouvrir le journal</button></details>`).join('')}`:'<p class="grp-note">Aucun modèle pour l\'instant.</p>'}<div class="btns"><button class="btn sm" type="button" data-newcar="1"${G.over?' disabled':''}>Concevoir une nouvelle voiture</button></div></section>`;
  if(G.models.length) h=lastQHTML()+h;
  return `<div class="career">${h}</div>`;
}
function usineHTML(){
  const y=yq(),lq=G.lastQ||{},cap=FAC[G.fac][1],nl=G.fac+1,uti=lq.cap?lq.units*4/lq.cap:0;
  let h=`<section class="cgrp"><h3>Usine</h3><div class="row2"><div><p><b>${FAC[G.fac][0]}</b> · ${nf(cap)} voitures par an · charges fixes ${moneyF(facUpkeep(G.fac,y))} par an.</p><div class="gmeter" role="img" aria-label="Utilisation de l'usine ${nf(uti*100)} %"><i style="width:${clamp(uti*100,0,100).toFixed(1)}%"></i></div><p class="grp-note">Utilisation ${nf(uti*100)} % au dernier trimestre.</p></div><div>${G.build?`<p>Construction en cours : <b>${FAC[G.build.l][0]}</b>, mise en service dans ${G.build.left} trimestre${G.build.left>1?'s':''}.</p>`:nl<FAC.length?`<p>Agrandir : <b>${FAC[nl][0]}</b> (${nf(FAC[nl][1])} voitures par an) · ${moneyF(facCost(nl,y))} · 3 trimestres · charges ${moneyF(facUpkeep(nl,y))} par an.</p><button class="btn sm" type="button" id="facUp"${G.over?' disabled':''}>Construire</button>`:'<p>Capacité maximale atteinte.</p>'}</div></div></section>`;
  const lim=loanLimit(),step=Math.max(1e4,Math.pow(10,Math.floor(Math.log10(Math.max(lim,1e4))))/2);
  h+=`<section class="cgrp"><h3>Banque</h3><p>Dette ${moneyF(G.debt)} sur un plafond de ${moneyF(lim)} · intérêts 6 % par an. Si la trésorerie passe sous zéro, la banque comble automatiquement dans la limite du plafond.</p><div class="btns"><button class="chip-btn" type="button" id="borrow"${G.debt+step>lim||G.over?' disabled':''}>Emprunter ${moneyF(step)}</button><button class="chip-btn" type="button" id="repay"${G.debt<=0||G.cash<Math.min(step,G.debt)?' disabled':''}>Rembourser ${moneyF(Math.min(step,G.debt))}</button></div></section>`;
  h+=histHTML();
  return `<div class="career">${h}</div>`;
}
function venteHTML(){
  if(!G.wiz) return `<div class="career"><section class="cgrp"><h3>Mise en vente</h3><p class="grp-note">Aucune voiture en cours de conception.</p><div class="btns"><button class="btn sm" type="button" data-newcar="1">Concevoir une nouvelle voiture</button></div></section></div>`;
  return `<div class="career">${newModelHTML()}</div>`;
}

/* ── conception guidée ── */
const STEPS=[['moteur','Moteur'],['carrosserie','Carrosserie'],['transmission','Transmission'],['trains','Trains roulants'],['habitacle','Habitacle'],['essais','Essais'],['vente','Mise en vente']];
const STEP_CHK={
  moteur:['Cliquetis','Auto-allumage','Vitesse de piston',"Vitesse des segments d'arête",'Tenue au couple','Lubrification','Affolement des soupapes','Résistance du moteur','Calculateur','Injecteurs','Ralenti'],
  carrosserie:['Implantation du moteur'],
  transmission:['Boîte et embrayage','Étagement','Motricité'],
  trains:['Freinage','Disques et jantes','Passages de roue','Garde au sol'],
  habitacle:[],essais:null,
};
const STEP_BLOCK=['Implantation du moteur','Auto-allumage','Disques et jantes','Passages de roue'];
const STEP_HELP={
  moteur:'Choisissez l\'architecture, la cylindrée, l\'alimentation et le réglage du moteur. Les pièces grisées ne sont pas encore inventées ou pas encore recherchées.',
  carrosserie:'Choisissez la silhouette, le style d\'époque, les pare-chocs, les phares et les rétroviseurs, puis la structure et la peinture. La silhouette détermine les clientèles visées, le style suit la mode.',
  transmission:'Choisissez la boîte de vitesses et son étagement, puis concevez-la : acier et largeur des pignons, denture, synchroniseurs, embrayage. Elle doit encaisser le couple du moteur.',
  trains:'Réglez les suspensions, les roues, les pneus et les freins.',
  habitacle:'Choisissez le nombre de places, la finition, les équipements et la sécurité.',
  essais:'Faites rouler la voiture : accélération, vitesse maxi, consommation et liste des points à surveiller.',
  vente:'Donnez un nom à la voiture, fixez son prix et lancez son développement.',
};
const stepIdx=t=>STEPS.findIndex(x=>x[0]===t);
const inWiz=()=>!!(G&&G.wiz&&stepIdx(ui.tab)>=0);
function stepIssues(t){
  const C=M.C;if(!C) return {block:[],warn:[]};const L=STEP_CHK[t];
  const ks=C.checks.filter(k=>k.lv!=='ok'&&(L===null||(L&&L.includes(k.t)))&&!eraMoot(k));
  return {block:ks.filter(k=>k.lv==='crit'&&STEP_BLOCK.includes(k.t)),warn:ks.filter(k=>!(k.lv==='crit'&&STEP_BLOCK.includes(k.t)))};
}
// avertissements sans objet à l'époque (aucune solution n'existe encore)
function eraMoot(k){return !!G&&((k.t==='Homologation'&&G.y<1992)||(k.t==='Freinage'&&G.y<1955)||(k.t==='Lubrification'&&k.lv==='warn'&&!G.techs.includes('a_multigrade')));}
// projet de départ : baisse la compression jusqu'à supprimer le cliquetis
function tuneSafe(){for(let n=0;n<16;n++){const E=computeEngine(Object.assign({},S,{injSize:1e6,ecuIdle:0,fuelPress:3}));if(!(E.knock>0)||S.cr<=7.5||E.dz) break;S.cr=Math.round((S.cr-.5)*10)/10;}}
function startWiz(base){
  if(base){loadDesign(base.snap);S.name=base.name+' II';}
  else{
    for(const k of Object.keys(S)) delete S[k];
    Object.assign(S,DEF,ERA_BASE,FIRST_CAR,{preset:''});
    if(G.y>=1950) Object.assign(S,DEF,PRESETS.berline.s,{preset:''});
    S.injSize=0;S.ecuIdle=0;S.oilInt=0;S.name=`Modèle ${G.models.length+1}`;ui.broken=null;ui.dmg={};ui.faults={};
  }
  if(ERA){eraFix();sanitize();eraFix();}if(!base) tuneSafe();
  G.wiz={max:0};ui.wizOk=null;ui.newPrice=0;ui.newName='';ui.msg='';
  $('#projName').value=S.name;saveGame();setTab('moteur');
}
function renderNav(){
  const n=$('#cnav'),f=$('#wizFoot');
  if(!G){n.hidden=true;f.hidden=true;return;}
  n.hidden=false;
  const i=stepIdx(ui.tab);
  document.body.classList.toggle('in-wiz',!!(G.wiz&&i>=0));
  if(G.wiz&&i>=0){
    n.innerHTML=`<div class="cnav-top"><button class="chip-btn" type="button" data-go="qg">← Quartier général</button><span class="eyebrow">Conception de « ${esc(S.name||'Sans nom')} »</span></div>
     <ol class="steps">${STEPS.map(([k,l],j)=>`<li><button type="button" data-go="${k}" class="${j===i?'cur':j<G.wiz.max||j<i?'done':''}"${j>G.wiz.max?' disabled':''} aria-current="${j===i?'step':'false'}"><span>${j<G.wiz.max&&j!==i?'✓':j+1}</span>${l}</button></li>`).join('')}</ol>
     <p class="step-help"><b>Étape ${i+1} sur ${STEPS.length} · ${STEPS[i][1]}.</b> ${STEP_HELP[STEPS[i][0]]}</p>`;
    f.hidden=false;
    {const ol=$('.steps',n),cur=$('.cur',n);if(ol&&cur) ol.scrollLeft=cur.parentNode.offsetLeft-(ol.clientWidth-cur.offsetWidth)/2;}
    const t=STEPS[i][0],iss=stepIssues(t),nx=STEPS[i+1];
    let msg='';
    if(t==='vente') msg='<span class="ok">Dernière étape : lancez le développement avec le bouton ci-dessus.</span>';
    else if(iss.block.length) msg=`<span class="bad">À corriger avant de continuer : ${iss.block.map(k=>esc(k.t)).join(', ')}.</span>`;
    else if(iss.warn.length) msg=`<span class="warn">${ui.wizOk===t?'Validé malgré':'À surveiller'} : ${iss.warn.map(k=>esc(k.t)).join(', ')}.</span>`;
    else msg='<span class="ok">✓ Aucun problème détecté.</span>';
    const lab=nx?(iss.warn.length&&!iss.block.length&&ui.wizOk!==t?'Valider quand même':`Valider ${STEPS[i][1].toLocaleLowerCase()}`):'';
    f.innerHTML=`<div class="wf-in"><button class="btn ghost sm" type="button" id="wizPrev"${i===0?' disabled':''}>← Précédent</button><p class="wf-msg" role="status">${msg}</p>${nx?`<button class="btn sm" type="button" id="wizNext"${iss.block.length?' disabled':''}>${lab} →</button>`:''}</div>`;
    const all=iss.block.concat(iss.warn);
    if(all.length&&t!=='vente') f.querySelector('.wf-msg').insertAdjacentHTML('beforeend',`<details class="wf-det"><summary>${iss.block.length?'Comment corriger':'Voir le détail'}</summary><ul>${all.map(k=>`<li><b>${esc(k.t)}</b> : ${esc(k.d)}</li>`).join('')}</ul></details>${!iss.block.length&&ui.wizOk!==t?'<small>Vous pouvez corriger, ou valider quand même.</small>':''}`);
  }else{
    f.hidden=true;
    const T=CTABS.find(x=>x[0]===ui.tab);
    n.innerHTML=ui.tab==='qg'?`<div class="cnav-top"><h2 class="cnav-h">Quartier général</h2></div>`:`<div class="cnav-top"><button class="chip-btn" type="button" data-go="qg">← Quartier général</button><h2 class="cnav-h">${T?T[1]:''}</h2></div>`;
  }
}

function newModelHTML(){
  const y=yq(),met=measure(M.E,M.C),uc=unitCost(met,Math.min(FAC[G.fac][1],2000)),sug=fromCur(roundNice(toCur(uc*1.35)));
  if(!ui.newPrice) ui.newPrice=sug;
  const price=ui.newPrice,d=demand([{met,price,age:1.1,y:G.y}],y)[0],dc=devCost(met,y),ban=regBan(met,G.y);
  const segs=SEGS.map(s=>[s,d.seg[s.k]||0]),mx=Math.max(1,...segs.map(x=>x[1]));
  const issues=[];if(!met.fit) issues.push('Le moteur ne rentre pas dans la caisse : impossible à produire.');if(ban) issues.push(`Non homologable : ${ban.n} (il faut : ${ban.need}).`);
  for(const r of REGS) if(r.y>G.y&&r.y<=G.y+6&&!r.ok(met)) issues.push(`${r.n} : les nouveaux modèles devront l'avoir dès ${r.y}, et ce modèle sera retiré de la vente en ${r.ya}. Il faudra : ${r.need}.`);
  for(const r of REGS) if(r.y<=G.y&&r.ya>G.y&&!r.ok(met)&&!ban) issues.push(`${r.n}.`);
  if(met.defects.length) issues.push(`Défauts techniques (${met.defects.join(', ')}) : frais de garantie et réputation en baisse. Voir l'étape Essais.`);
  return `<section class="cgrp" id="newModel"><h3>Lancer un nouveau modèle</h3><p class="grp-note">Projet actuel du bureau d'études : <b>${esc(S.name||'Sans nom')}</b> · ${BODY[met.body].n} · ${met.cfg} ${nf(met.L,1)} l · ${nf(met.P)} ch · ${nf(met.v)} km/h · ${nf(met.mix,1)} l/100 km. Pour le modifier, revenez aux étapes précédentes.</p>
  <div class="row2"><div><div class="f"><div class="f-top"><label for="nmName">Nom commercial</label></div><input class="txt" type="text" id="nmName" maxlength="30" value="${esc(ui.newName||S.name||'')}"></div>
  <div class="f"><div class="f-top"><label for="nmPrice">Prix de vente</label><output id="nmMarg">marge ${nf((price-uc)/price*100)} %</output></div><input class="num wide" type="number" inputmode="numeric" id="nmPrice" min="1" step="1" value="${Math.round(toCur(price))}" aria-describedby="nmCur"><p class="hint" id="nmCur">Prix en ${curName(G.y)} de ${G.y}${fxOf(G.y).u==='€'&&G.y===2020?'':` (1 ${fxOf(G.y).u==='€'?'€':'franc'} de ${G.y} vaut environ ${moneyF(1/fxOf(G.y).k,2020)} d'aujourd'hui)`}. Coût de fabrication estimé ${moneyF(uc)} par voiture · prix conseillé ${moneyF(sug)}. Prix moyen d'une voiture populaire en ${G.y} : ${moneyF(refPrice(y))}.</p></div>
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
  return `<section class="cgrp"><h3>Historique</h3><p class="eyebrow">Voitures vendues par an</p><div class="ch-w">${s}</div><div class="tbl-w"><table class="ctbl"><thead><tr><th>Année</th><th class="n">Ventes</th><th class="n">Chiffre d'affaires</th><th class="n">Résultat</th><th class="n">Trésorerie</th><th class="n">Réputation</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.y}</td><td class="n">${nf(x.units)}</td><td class="n">${moneyF(x.rev,x.y)}</td><td class="n${x.profit<0?' neg':''}">${moneyF(x.profit,x.y)}</td><td class="n">${moneyF(x.cash,x.y)}</td><td class="n">${nf(x.rep)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function resHTML(){
  const y=yq();let h='';
  const sl=resSlots(),nl=(G.lab||0)+1;
  h+=`<section class="cgrp"><h3>Laboratoires · ${G.resL.length} recherche${G.resL.length>1?'s':''} en cours sur ${sl} possible${sl>1?'s':''}</h3>
   ${G.resL.length?`<ul class="rlist">${G.resL.map(r=>{const t=TECH[r.id],p=1-r.left/r.tot;return `<li><div class="f-top"><b>${t.n}</b><span class="grp-note">encore ${r.left} trimestre${r.left>1?'s':''}</span></div><div class="gmeter" role="img" aria-label="Avancement ${nf(p*100)} %"><i style="width:${(p*100).toFixed(1)}%"></i></div></li>`;}).join('')}</ul>`:''}
   ${G.resL.length<sl?`<p class="grp-note">${sl-G.resL.length} emplacement${sl-G.resL.length>1?'s':''} libre${sl-G.resL.length>1?'s':''} : choisissez une technologie ci-dessous. Une technologie ne peut être étudiée qu'à partir de son année d'invention ; plus on attend, moins elle coûte.</p>`:''}
   <div class="lab-up">${G.labBuild?`<p>Construction en cours : <b>${LAB[G.labBuild.l][0]}</b> (${LAB[G.labBuild.l][1]} recherches en même temps), ouverture dans ${G.labBuild.left} trimestre${G.labBuild.left>1?'s':''}.</p>`:nl<LAB.length?`<p><b>${LAB[G.lab||0][0]}</b> actuel. Agrandir en <b>${LAB[nl][0]}</b> pour mener <b>${LAB[nl][1]} recherches en même temps</b> · ${moneyF(labCost(nl,yq()))} · 2 trimestres.</p><button class="btn sm" type="button" id="labUp"${G.over?' disabled':''}>Agrandir</button>`:`<p><b>${LAB[G.lab][0]}</b> : capacité maximale.</p>`}</div></section>`;
  const own=new Set(G.techs);
  h+=`<div class="res-tools"><div class="seg" role="radiogroup" aria-label="Filtre"><button type="button" role="radio" data-rf="0" aria-checked="${!ui.resAll}">Disponibles et à venir</button><button type="button" role="radio" data-rf="1" aria-checked="${ui.resAll}">Toutes</button></div><span class="grp-note">${own.size} technologies acquises sur ${TECHS.length}</span></div>`;
  for(const [dk,dn] of DOMS){
    const ts=TECHS.map(t=>TECH[t[0]]).filter(t=>t.dom===dk).filter(t=>ui.resAll||(!own.has(t.id)&&t.y<=G.y+12)).sort((a,b)=>a.y-b.y);
    if(!ts.length) continue;
    h+=`<section class="cgrp"><h3>${dn}</h3><ul class="techs">${ts.map(t=>{
      const has=own.has(t.id),cur=G.resL.some(r=>r.id===t.id),fut=t.y>G.y;
      const unl=t.u.map(([k,v])=>uLabel(k,v)).filter(Boolean).join(', ');
      let st;if(has) st='<span class="pill ok">Acquise</span>';else if(cur) st='<span class="pill">En cours</span>';else if(fut) st=`<span class="pill off">Inventée en ${t.y}</span>`;
      else st=`<button class="chip-btn" type="button" data-res="${t.id}"${G.resL.length>=resSlots()||G.over?' disabled':''}>Rechercher · ${moneyF(resCost(t,y))} · ${resQ(t,y)} trim.</button>`;
      return `<li class="${has?'is-has':fut?'is-fut':''}"><div><b>${t.n}</b><span class="eyebrow">${t.y}</span><p>${esc(t.d)}${unl?` <em>Débloque : ${esc(unl)}.</em>`:''}</p></div><div>${st}</div></li>`;}).join('')}</ul></section>`;
  }
  return `<div class="career">${h}</div>`;
}
const U_TAB={camF:CAMF,gMat:GMAT,gTeeth:GTEETH,gSync:GSYNC,clutch:CLUTCH,config:CFG,valvetrain:VT,fuelSys:FS,timing:TIMING,blockMat:BLOCK,liner:LINER,sump:SUMP,valveMat:VALVE,springs:SPRING,intake:INTAKE,turboStage:STAGE,turboType:TURBO,turboBearing:BEAR,scType:SCT,oilGrade:OIL,fuel:FUEL,body:BODY,enginePos:POS,chassis:CHAS,panels:PANEL,gearbox:GBX,suspF:SUSP,suspR:SUSP,compound:TYRE,brakeF:BRK,brakeR:BRK,trim:TRIM,media:MEDIA,passive:PASS,steering:STEER,manifold:EXH.man,cat:EXH.cat,muffler:EXH.muf};
function uLabel(k,v){
  if(k==='ecuFuel'||k==='brakeR'||k==='suspR'||k==='splitter') return '';
  if(typeof v==='boolean') return {vvt:'calage variable',vvl:'levée variable',cda:'désactivation de cylindres',flex:'capteur d\'éthanol',launchCtl:'launch control',pops:'cartographies',startStop:'stop & start',ecuVmax:'bridage électronique',gCool:'radiateur de boîte',flatFloor:'fond plat',abs:'ABS',tc:'antipatinage',esp:'ESP'}[k]||'';
  if(k==='config') return CFG[v].full||CFG[v].lab;
  if(k==='aspiration') return {sc:'compresseur',turbo:'turbo',biturbo:'biturbo',tri:'triturbo',quad:'quadriturbo'}[v];
  if(k==='drive') return DRV[v];if(k==='headMat') return 'culasse alu';if(k==='internals') return v==='ti'?'bielles titane':'équipage forgé';if(k==='diff') return v==='lsd'?'autobloquant':'différentiel piloté';
  if(k==='intercooler') return v==='air'?'échangeur air/air':'échangeur air/eau';if(k==='rimType') return v==='alloy'?'jantes alliage':'jantes forgées';if(k==='wing') return v==='lip'?'becquet':'aileron';
  const T=U_TAB[k];return T&&T[v]?String(T[v].n||'').toLocaleLowerCase():'';
}
function mktHTML(){
  const y=yq(),vol=marketVol(y),sh=segShares(y);
  let h=`<section class="cgrp"><h3>Le marché en ${G.y}</h3><div class="tiles">${tile('Voitures neuves par an',nf(vol,-2),SHOCK[G.y]?'marché perturbé cette année':'')}${tile('Concurrents',nf(itp(NCOMP,y)),typeof rivAlive==='function'?`marques en activité, dont ${rivAlive().length} constructeurs connus`:'marques en activité')}${tile('Voiture populaire',moneyF(refPrice(y)),`prix moyen, en ${curName(G.y)}`)}${tile('Votre part',G.lastQ&&vol?nf(G.lastQ.units*4/vol*100,2)+' %':'—','au dernier trimestre')}</div></section>`;
  h+=`<section class="cgrp"><h3>Ce que les clients attendent</h3><p class="grp-note">Voiture moyenne de chaque clientèle en ${G.y}. Faire mieux attire les acheteurs ; les attentes montent chaque année.</p><div class="tbl-w"><table class="ctbl"><thead><tr><th>Clientèle</th><th class="n">Part du marché</th><th class="n">Puissance</th><th class="n">Vitesse maxi</th><th class="n">Prix moyen</th><th>Ce qui compte</th></tr></thead><tbody>${SEGS.map((s,i)=>`<tr><td><b>${s.n}</b></td><td class="n">${nf(sh[i]*100)} %</td><td class="n">${nf(itp(REF.P,y)*s.sp)} ch</td><td class="n">${nf(itp(REF.V,y)*s.sv,-1)} km/h</td><td class="n">${moneyF(refPrice(y,s))}</td><td>${segWhat(s,y)}</td></tr>`).join('')}</tbody></table></div></section>`;
  if(typeof rivHTML==='function') h+=rivHTML();
  const up=REGS.filter(r=>r.ya>=G.y);
  h+=`<section class="cgrp"><h3>Réglementation</h3>${up.length?`<ul class="news">${up.map(r=>`<li class="nw-warn"><span class="eyebrow">${r.y===r.ya?r.y:`${r.y} · ${r.ya}`}</span><b>${r.n}</b><p>Exigé : ${r.need}. ${r.y===r.ya?`Pour toutes les voitures vendues à partir de ${r.y}.`:`Nouveaux modèles à partir de ${r.y}, toutes les voitures vendues à partir de ${r.ya}.`}</p></li>`).join('')}</ul>`:'<p class="grp-note">Toutes les normes connues sont en vigueur.</p>'}</section>`;
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
  if(id==='launch'){const nm=($('#nmName').value||'').trim()||S.name;msg=launchModel(nm,ui.newPrice);ui.msg=msg||'';if(!msg){ui.newPrice=0;ui.newName='';G.wiz=null;const m=G.models[G.models.length-1];ui.flash=`Développement lancé : ${m.name}. Sortie dans ${m.devLeft} trimestres. Passez le temps avec « Trimestre suivant ».`;saveGame();renderCbar();setTab('qg');return true;}}
  else if(id==='facUp') msg=buildFactory();
  else if(id==='labUp') msg=buildLab();
  else if(id==='borrow'){const lim=loanLimit(),st=Math.max(1e4,Math.pow(10,Math.floor(Math.log10(Math.max(lim,1e4))))/2);if(G.debt+st<=lim){G.debt+=st;G.cash+=st;}}
  else if(id==='repay'){const lim=loanLimit(),st=Math.min(G.debt,Math.max(1e4,Math.pow(10,Math.floor(Math.log10(Math.max(lim,1e4))))/2));if(G.cash>=st){G.debt-=st;G.cash-=st;}}
  else if(id==='goHome'){showHome();return true;}
  else if(b.dataset.res){msg=startResearch(b.dataset.res);}
  else if(b.dataset.rf){ui.resAll=b.dataset.rf==='1';}
  else if(b.dataset.stop){const m=G.models.find(x=>x.id==b.dataset.stop);if(m&&confirm(`Arrêter définitivement la production de ${m.name} ?`)){m.st='stop';news(`Fin de production : ${m.name}`,`${nf(m.sold)} exemplaires vendus.`);}}
  else if(b.dataset.evol){const m=G.models.find(x=>x.id==b.dataset.evol);if(m){if(G.wiz&&!confirm('Une conception est déjà en cours. La remplacer ?')) return true;startWiz(m);}return true;}
  else if(b.dataset.newcar){if(G.wiz&&!confirm('Une conception est déjà en cours. La remplacer par une nouvelle voiture ?')) return true;startWiz(null);return true;}
  else if(b.dataset.go){setTab(b.dataset.go);appScrollTop();return true;}
  else if(b.dataset.journal){const m=G.models.find(x=>x.id==b.dataset.journal);if(m) showJournal(m);return true;}
  else return false;
  if(msg) ui.msg=msg;
  saveGame();renderCbar();render();
  return true;
}
function careerInput(e){
  if(!G) return;
  const t=e.target;
  if(t.id==='nmPrice'){const v=+t.value;if(v>0){ui.newPrice=fromCur(v);const card=$('#newModel');if(card&&e.type==='change'){const f=document.activeElement===t;card.outerHTML=newModelHTML();if(f){const n=$('#nmPrice');n.focus();}}}}
  else if(t.id==='nmName') ui.newName=t.value;
  else if(t.dataset.price&&e.type==='change'){const m=G.models.find(x=>x.id==t.dataset.price),v=+t.value;if(m&&v>0){m.price=fromCur(v);saveGame();}}
}
$('#stage').addEventListener('click',e=>{if(careerClick(e)) e.stopImmediatePropagation();},true);
$('#stage').addEventListener('input',careerInput);
$('#stage').addEventListener('change',careerInput);
$('#cbar').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!G) return;if(b.id==='nextQ') advance(1);else if(b.id==='nextY') advance(4);else if(b.dataset.spd!=null){G.spd=+b.dataset.spd;saveGame();renderCbar();}});
/* ── le temps passe en direct : un trimestre dure QSEC secondes à vitesse normale ── */
const QSEC=30;
let clkLast=performance.now();
function clockPaused(){return !G||G.over||!(G.spd>0)||!$('#home').hidden||!LFX.hidden||document.hidden;}
setInterval(()=>{
  const now=performance.now(),dt=Math.min(1,(now-clkLast)/1000);clkLast=now;
  if(clockPaused()) return;
  G.qt=(G.qt||0)+dt*G.spd;
  const pb=$('#qProg');if(pb) pb.style.width=(clamp(G.qt/QSEC,0,1)*100).toFixed(1)+'%';
  if(G.qt>=QSEC){G.qt=0;const ae=document.activeElement;if(ae&&ae.type==='range'&&ae.matches(':active')){G.qt=QSEC-1;return;}advance(1);}
},200);
$('#homeBtn').addEventListener('click',showHome);

/* ── lancement : animation puis journal en double page ── */
const LFX=el('div','lfx');
LFX.addEventListener('click',e=>{const b=e.target.closest('.lfx-snd');if(!b) return;fxSetOn(!SFX.on);b.setAttribute('aria-pressed',SFX.on);b.textContent=SFX.on?'Son activé':'Son coupé';if(SFX.on&&$('.jr',LFX)) fxPaper();});LFX.hidden=true;LFX.setAttribute('role','dialog');LFX.setAttribute('aria-modal','true');LFX.setAttribute('aria-label','Lancement du modèle');document.body.appendChild(LFX);
let lfxT=[];
const noMotion=()=>ui.noAnim||matchMedia('(prefers-reduced-motion: reduce)').matches;
const ART={citadine:'une citadine',compacte:'une compacte',berline:'une berline',break:'un break',coupe:'un coupé',roadster:'un roadster',suv:'un SUV',pickup:'un pick-up',supercar:'une supercar'};
function carArt(m,cls){return `<div class="${cls}" style="--paint:${esc(m.snap&&m.snap.paint||'#1f5fa8')}">${miniCar(m.met.body,m.snap)}</div>`;}
function showLaunch(m){
  for(const t of lfxT) clearTimeout(t);lfxT=[];
  if(noMotion()){showJournal(m);return;}
  LFX.className='lfx lfx-show';LFX.hidden=false;document.body.classList.add('lfx-on');
  LFX.innerHTML=`<div class="lfx-stage"><div class="lfx-spot"></div><p class="lfx-k">${esc(G.co)} présente</p>${carArt(m,'lfx-car')}<h2 class="lfx-n">${esc(m.name)}</h2><p class="lfx-s">${BODY[m.met.body].n} · ${nf(m.met.P)} ch · ${nf(m.met.v)} km/h · ${moneyF(m.price)}</p><div class="lfx-flash"></div><p class="lfx-next">Le lendemain, la presse publie ses essais…</p></div><button class="chip-btn lfx-snd" type="button" aria-pressed="${SFX.on}">${SFX.on?'Son activé':'Son coupé'}</button><button class="chip-btn lfx-skip" type="button">Passer</button>`;
  fxLaunch();
  $('.lfx-skip',LFX).addEventListener('click',()=>showJournal(m));$('.lfx-skip',LFX).focus({preventScroll:true});
  lfxT.push(setTimeout(()=>showJournal(m),5200));
}
function closeLfx(){fxStop();for(const t of lfxT) clearTimeout(t);lfxT=[];LFX.hidden=true;LFX.innerHTML='';document.body.classList.remove('lfx-on');}
function longReview(r,m,first){
  const p=r.pros||[],c=r.cons||[],B=BODY[m.met.body].n.toLocaleLowerCase(),up=s=>s.replace(/^./,ch=>ch.toUpperCase());
  const a=[];
  a.push(first?`${esc(G.co)} lance la ${esc(m.name)} : ${ART[m.met.body]||B} de ${nf(m.met.P)} ch, au prix de ${moneyF(m.price)}. Nous l'avons essayée sur nos routes habituelles.`:`Nous avons pris le volant de la nouvelle ${esc(m.name)}.`);
  if(p.length) a.push(`Côté qualités, on retient ${p.map((x,i)=>i===p.length-1&&i>0?'et '+x:x).join(', ')}.`);
  if(c.length) a.push(`${up(c.length>1?'en revanche, ':'seul regret : ')}${c.map((x,i)=>i===c.length-1&&i>0?'et '+x:x).join(', ')}.`);
  if(m.met.dw>0) a.push(`Plus ennuyeux, notre voiture d'essai a connu des pannes (${m.met.defects.join(', ').toLocaleLowerCase()}).`);
  a.push(r.note>=16?'Notre verdict : une référence, à acheter les yeux fermés.':r.note>=13?'Notre verdict : un bon achat.':r.note>=10?'Notre verdict : correcte, sans plus.':'Notre verdict : à éviter.');
  return a.map(x=>`<p>${x}</p>`).join('');
}
function showJournal(m){
  for(const t of lfxT) clearTimeout(t);lfxT=[];
  const P=m.press;if(!P) return;
  const L=P.list,main=L[0],others=L.slice(1),eff=Math.round(clamp((P.avg-12)/8,-1,1)*25),mt=m.met;
  const num=1000+((m.id*137+P.y)%8000),price=moneyF(itp([[1900,2.5],[1950,3],[2000,4],[2020,5.5]],P.y),P.y);
  const fiche=[['Moteur',`${mt.cfg} ${nf(mt.L,1)} l`],['Puissance',`${nf(mt.P)} ch`],['Vitesse maxi',`${nf(mt.v)} km/h`],['0 à 100 km/h',mt.t100?nf(mt.t100,1)+' s':'—'],['Consommation',`${nf(mt.mix,1)} l/100 km`],['Masse',`${nf(mt.mass)} kg`],['Prix',moneyF(m.price)]];
  LFX.className='lfx lfx-paper';LFX.hidden=false;document.body.classList.add('lfx-on');
  LFX.innerHTML=`<div class="jr-wrap"><div class="jr">
   <article class="jr-page">
    <header class="jr-mast"><h2>${esc(main.mag)}</h2><p><span>N° ${num}</span><span>${Q[P.q]} ${P.y}</span><span>${price}</span></p></header>
    <p class="jr-kick">Essai exclusif</p>
    <h3 class="jr-h">${esc(m.name)} : ${main.note>=16?'la nouvelle référence':main.note>=13?'une belle réussite':main.note>=10?'peut mieux faire':'la déception'}</h3>
    <p class="jr-dek">La nouveauté de ${esc(G.co)} : ${ART[mt.body]||''}. Est-elle à la hauteur des attentes de ${P.y} ?</p>
    <figure class="jr-fig">${carArt(m,'jr-car')}<figcaption>La ${esc(m.name)} lors de notre essai.</figcaption><div class="jr-note"><b>${nf(main.note,1)}</b><span>/20</span></div></figure>
    <div class="jr-cols">${longReview(main,m,true)}</div>
   </article>
   <article class="jr-page">
    <header class="jr-strip"><h3>Ce qu'en pense la presse</h3><p>${Q[P.q]} ${P.y}</p></header>
    <aside class="jr-fiche"><h4>Fiche technique</h4><dl>${fiche.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></aside>
    ${others.map(r=>`<section class="jr-rev"><h4>${esc(r.mag)}</h4><div class="jr-note sm"><b>${nf(r.note,1)}</b><span>/20</span></div>${longReview(r,m,false)}</section>`).join('')}
    <section class="jr-verdict"><h4>Le verdict</h4><table><tbody>${L.map(r=>`<tr><td>${esc(r.mag)}</td><td>${nf(r.note,1)}/20</td></tr>`).join('')}<tr class="avg"><td>Moyenne</td><td>${nf(P.avg,1)}/20</td></tr></tbody></table>
     <p>${eff>=0?`Cette presse va attirer des clients : environ +${eff} % d'intérêt pour la ${esc(m.name)} pendant les premières années.`:`Ces critiques vont freiner les ventes : environ ${eff} % d'intérêt pour la ${esc(m.name)} pendant les premières années.`}</p></section>
   </article>
  </div></div><button class="btn lfx-close" type="button">Refermer le journal</button>`;
  LFX.insertAdjacentHTML('beforeend',`<button class="chip-btn lfx-snd" type="button" aria-pressed="${SFX.on}">${SFX.on?'Son activé':'Son coupé'}</button>`);
  fxPaper();
  LFX.scrollTop=0;
  const cb=$('.lfx-close',LFX);cb.addEventListener('click',()=>{closeLfx();render();});cb.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!LFX.hidden){closeLfx();render();}});
{const cb=$('#cbar'),setH=()=>document.documentElement.style.setProperty('--cbar-h',(cb.hidden?0:cb.offsetHeight)+'px');if(window.ResizeObserver) new ResizeObserver(setH).observe(cb);window.addEventListener('resize',setH);}
function navClick(e){
  const b=e.target.closest('button');if(!b||!G) return;
  if(b.dataset.go){setTab(b.dataset.go);appScrollTop();return;}
  const i=stepIdx(ui.tab);
  if(b.id==='wizPrev'&&i>0){setTab(STEPS[i-1][0]);appScrollTop();}
  else if(b.id==='wizNext'&&G.wiz){
    const t=STEPS[i][0],iss=stepIssues(t);
    if(iss.block.length) return;
    if(iss.warn.length&&ui.wizOk!==t){ui.wizOk=t;renderNav();return;}
    G.wiz.max=Math.max(G.wiz.max,i+1);ui.wizOk=null;saveGame();setTab(STEPS[i+1][0]);appScrollTop();
  }
}
$('#cnav').addEventListener('click',navClick);
$('#wizFoot').addEventListener('click',navClick);
initHome();
