'use strict';
/* ───────────── Mode « Mécanicien » — TRAVAIL AUTOMATIQUE ─────────────
   Pour ceux que les gestes un par un ennuient : près d'une voiture, touche J (ou bouton « Travail auto (J) »).
   Le mécanicien fait tout seul les gestes du travail, un par un, sous les yeux du joueur (pont, roues, pièces…),
   et le temps du jeu passe normalement. Il va chercher pièces et outils : à l'étagère quand on est salarié, chez
   Pièces Auto Express (au prix normal, débité) quand on est à son compte. Une panne est diagnostiquée en même temps
   (20 minutes de plus). Contrepartie : on apprend moins en regardant faire, l'expérience gagnée est divisée par deux.
   J (ou Échap) pendant le travail : arrêter. Option : rendre la voiture tout de suite à la fin.
   ═══ API `MWAUTO` ═══  MWAUTO.start(rendre) · MWAUTO.stop() · MWAUTO.busy() · MWAUTO.open() */
const MWAUTO=(()=>{
const PAS=280; /* ms entre deux gestes : assez lent pour voir faire, assez rapide pour ne pas s'ennuyer */
let job=null;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rig=()=>typeof MWG!=='undefined'&&MWG.rig?MWG.rig():null;
const carHere=()=>{const r=rig();return r&&r.c&&MWJ.jobs().includes(r.c)?r.c:null;};
const aSonCompte=()=>{try{const e=MWC.employer();return !!(e&&(e.compte||e.net));}catch(x){return false;}};
/* pièces neuves de l'ordre (et de la panne) : étagère, ou achat au magasin à son compte */
function pieces(c){
 const ids=c.ordre.slice();if(c.symp&&!ids.includes(c.symp.c)) ids.push(c.symp.c);
 let cout=0;
 for(const id of ids){if(c.done[id]||c.rem[id]&&false) continue;if(MWJ.L.newFind(c,id)>=0) continue;
  if(MWJ.inv().length>=MWJ.INV_MAX) return {ok:false,why:"Inventaire plein : rangez des objets pour que le mécanicien prenne les pièces."};
  if(aSonCompte()){const p=MWJ.PARTS[id];if(MW.S.money<p.prix) return {ok:false,why:`Pas assez d'argent pour acheter : ${p.nom}.`};MW.money(-p.prix,'Pièces Auto Express : '+p.nom);cout+=p.prix;MWJ.L.invAdd({k:'neuve',id,src:'achat',paye:p.prix});}
  else MWJ.L.invAdd({k:'neuve',id,src:'etagere'});}
 return {ok:true,cout};}
function hud(t){MW.hud('auto',t?`<b>Travail automatique</b> · ${t} · <span class="hint">J : arrêter</span>`:'');}
function stop(msg,kind){if(!job) return;clearTimeout(job.t);const j=job;job=null;hud('');
 if(j.classic) MWG.set({classic:true});MWG.set({aide:j.aide||'auto'});if(msg) MW.toast(msg,kind||'info');}
function start(rendre){
 if(job) return stop('Travail automatique arrêté.');
 const c=carHere();if(!c) return MW.toast('Approchez-vous de la voiture à réparer (près du pont).','warn');
 const g=MW.S.gest||{},classic=!!g.classic;
 if(classic) MWG.set({classic:false});MWG.ensure(c);
 const pc=pieces(c);if(!pc.ok){if(classic) MWG.set({classic:true});return MW.toast(pc.why,'warn');}
 c.auto=1; /* expérience divisée par deux au rendu (js/41) */
 if(c.symp&&!c.autoDiag){c.autoDiag=1;MW.addMin(20);const p=MWJ.PARTS[c.symp.c];if(c.insp) c.insp[c.symp.c]=1;MW.toast(`Diagnostic : ${p?p.nom.toLowerCase():'pièce'} en cause.`,'info');}
 job={c,rendre:!!rendre,n:0,last:'',same:0,classic,aide:g.aide};MWG.set({aide:'on'});
 MW.toast(`Le mécanicien s'y met${pc.cout?` (pièces achetées : ${MW.fmt(pc.cout)})`:''}. Regardez-le faire, ou J pour arrêter.`,'good');
 step();}
function step(){
 if(!job) return;const c=job.c;
 if(!MWJ.jobs().includes(c)) return stop();
 if(MW.paused){job.t=setTimeout(step,PAS);return;}
 if(!rig()||rig().c!==c){if(!MWG.ensure(c)) return stop("Travail automatique interrompu : vous vous êtes éloigné de la voiture.",'warn');}
 MWG.skip();
 const h=MWG.nextHint();
 if(!h||h.key==='door'){
  const bl=MWG.blocage(c);
  if(bl.length) return stop('Travail automatique arrêté : '+bl.join(', ')+'.','warn');
  if(job.rendre){const r=job;stop();const res=MWJ.done(c);if(res) MW.toast(`Voiture rendue : ${res.voiture} · ${'★'.repeat(res.note)}${'☆'.repeat(5-res.note)} · ${MW.fmt(res.pay)}${res.avance?' + pièces '+MW.fmt(res.avance):''}.`,'good');return;}
  return stop(`Travail terminé en ${job.n} gestes : rendez la voiture (portière conducteur).`,'good');}
 if(h.key===job.last){if(++job.same>4) return stop(`Travail automatique bloqué sur « ${h.lab} » : finissez à la main.`,'warn');}else job.same=0;
 job.last=h.key;
 const r=MWG.run(h.id,h.key);
 if(r) return stop(`Travail automatique arrêté sur « ${h.lab} » : ${r}`,'warn');
 job.n++;hud(`geste ${job.n} : ${esc(h.lab)}`);
 job.t=setTimeout(step,PAS);}
function open(){
 const c=carHere();
 const txt=`<p>Le mécanicien fait tout seul les gestes du travail, un par un, sous vos yeux. Le temps du jeu passe normalement.</p>
 <ul class="mw-gd-ul"><li>Pièces et outils pris automatiquement : à l'étagère si vous êtes salarié, achetés chez Pièces Auto Express si vous êtes à votre compte.</li>
 <li>Une panne est diagnostiquée en même temps (20 minutes de plus).</li><li><b>Contrepartie</b> : vous apprenez moins en regardant faire, l'expérience gagnée est divisée par deux.</li>
 <li>J ou Échap pendant le travail : arrêter.</li></ul>`;
 MW.panel('Travail automatique',c?`<p><b>${esc(c.marque+' '+c.modele)}</b> · ${esc(c.symp?c.symp.txt:c.nom)}</p>${txt}<div class="mw-btns"><button type="button" class="btn" data-mw="auto:go">Faire le travail</button><button type="button" class="btn ghost" data-mw="auto:rendre">Faire le travail et rendre la voiture</button></div>`
  :`${txt}<p class="mw-soon">Approchez-vous d'abord d'une voiture à réparer, près de son pont.</p>`,
  {onClick:a=>{if(a==='auto:go'){MW.closePanel();start(false);}else if(a==='auto:rendre'){MW.closePanel();start(true);}}});}
MW.on('key',k=>{if(k==='j'){if(job) stop('Travail automatique arrêté.');else open();}});
window.addEventListener('keydown',e=>{if(job&&e.key==='Escape') stop('Travail automatique arrêté.');},true);
MW.addButton('auto','Travail auto (J)',()=>{if(MW.S){if(job) stop('Travail automatique arrêté.');else open();}});
MW.on('close',()=>stop());MW.on('start',()=>stop());
return {start,stop,open,busy:()=>!!job};
})();
window.__mwauto=MWAUTO;
