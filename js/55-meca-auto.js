'use strict';
/* ───────────── Mode « Mécanicien » — TRAVAIL AUTOMATIQUE ─────────────
   Pour ceux que les gestes un par un ennuient : touche J (ou bouton « Travail auto (J) »).
   Déblocage : une compétence au niveau 2 débloque le travail automatique de tous les travaux de cette compétence
   (Entretien 2 : toutes les vidanges, filtres, bougies… ; une panne demande aussi Diagnostic 2). Le mode
   administrateur met tout au niveau maximal, donc tout est débloqué.
   Deux façons :
   · « Faire ce travail » : la voiture devant soi, gestes faits un par un sous les yeux du joueur ;
   · « Mode automatique continu » : le jeu fait tout tout seul. Il va à chaque voiture qui arrive au garage,
     prend les pièces (étagère quand on est salarié, achat chez Pièces Auto Express à son compte), diagnostique
     la panne (+20 min), fait les gestes, rend la voiture, revend à la ferraille les pièces usagées déposées
     (les pièces que le client veut récupérer lui sont rendues), puis attend le client suivant.
     Les voitures dont un travail n'est pas encore débloqué sont laissées au joueur.
   Contrepartie : on apprend moins en regardant faire, l'expérience gagnée est divisée par deux.
   J ou Échap pendant le travail : arrêter.
   ═══ API `MWAUTO` ═══  MWAUTO.start(rendre) · MWAUTO.service() · MWAUTO.stop() · MWAUTO.busy() · MWAUTO.open()
                        MWAUTO.ok(c) → {ok, manque:[{k,nom,lv}]} · MWAUTO.unlocked(comp) · MWAUTO.NIV (2) */
const MWAUTO=(()=>{
const PAS=280; /* ms entre deux gestes : assez lent pour voir faire, assez rapide pour ne pas s'ennuyer */
const NIV=2;  /* niveau d'une compétence qui débloque le travail automatique */
let job=null; /* travail en cours : {c,rendre,n,last,same,classic,aide,svc} */
let svc=null; /* mode continu : {n,gain,xp,ferraille,skip:{}} */
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rig=()=>typeof MWG!=='undefined'&&MWG.rig?MWG.rig():null;
const carHere=()=>{const r=rig();return r&&r.c&&MWJ.jobs().includes(r.c)&&!r.c.noir?r.c:null;};
const aSonCompte=()=>{try{const e=MWC.employer();return !!(e&&(e.compte||e.net));}catch(x){return false;}};
const empZone=()=>{try{const e=MWC.employer();return e&&e.id!=='aucun'&&e.zone?e.zone:null;}catch(x){return null;}};
const fmtXp=o=>Object.values(o||{}).reduce((a,b)=>a+(b||0),0);

/* ── déblocage par compétence ── */
const unlocked=k=>MWJ.level(k)>=NIV;
function skillsOf(c){const ks=[];const add=k=>{if(k&&!ks.includes(k)) ks.push(k);};
 for(const id of c.ordre) add(MWJ.PARTS[id]&&MWJ.PARTS[id].comp);
 if(c.symp){add('diagnostic');add(MWJ.PARTS[c.symp.c]&&MWJ.PARTS[c.symp.c].comp);}
 return ks;}
function ok(c){const manque=skillsOf(c).filter(k=>!unlocked(k)).map(k=>({k,nom:MWJ.SK_NOM[k],lv:MWJ.level(k)}));return {ok:!manque.length,manque};}
const manqueTxt=m=>m.map(x=>`${x.nom.toLowerCase()} (niveau ${x.lv})`).join(', ');

/* pièces neuves de l'ordre (et de la panne) : étagère, ou achat au magasin à son compte */
function pieces(c){
 const ids=c.ordre.slice();if(c.symp&&!ids.includes(c.symp.c)) ids.push(c.symp.c);
 let cout=0;
 for(const id of ids){if(c.done[id]) continue;if(MWJ.L.newFind(c,id)>=0) continue;
  if(MWJ.inv().length>=MWJ.INV_MAX) ferraille(null);
  if(MWJ.inv().length>=MWJ.INV_MAX) return {ok:false,why:"Inventaire plein : rangez des objets pour que le mécanicien prenne les pièces."};
  if(aSonCompte()){const p=MWJ.PARTS[id];if(MW.S.money<p.prix) return {ok:false,why:`Pas assez d'argent pour acheter : ${p.nom}.`};MW.money(-p.prix,'Pièces Auto Express : '+p.nom);cout+=p.prix;MWJ.L.invAdd({k:'neuve',id,src:'achat',paye:p.prix});}
  else MWJ.L.invAdd({k:'neuve',id,src:'etagere'});}
 return {ok:true,cout};}
/* revend à la ferraille les pièces usagées déposées par le travail automatique (jobId), ou toutes celles qui ne sont pas
   à rendre au client (jobId null : pour faire de la place). Les pièces gardées par le joueur pour l'occasion restent si jobId. */
function ferraille(jobIds){
 const inv=MWJ.inv();let t=0,n=0;
 for(let i=inv.length-1;i>=0;i--){const it=inv[i];if(it.k!=='usagee'||MWJ.rendBloq(it)) continue;if(jobIds&&!jobIds.includes(it.job)) continue;
  t+=typeof MWO!=='undefined'&&MWO.scrap?MWO.scrap(it):0;inv.splice(i,1);n++;}
 if(n){MWJ.invUI();if(t) MW.money(t,'Ferraille (travail automatique)');}
 return {n,t};}

function hud(t){MW.hud('auto',t?`<b>${svc?'Mode automatique continu':'Travail automatique'}</b> · ${t} · <span class="hint">J : arrêter</span>`:'');}
function restore(j){if(j.classic) MWG.set({classic:true});MWG.set({aide:j.aide||'auto'});}
function stop(msg,kind){
 const had=!!(job||svc);if(job){clearTimeout(job.t);restore(job);job=null;}
 if(svc){clearTimeout(svc.t);const s=svc;svc=null;if(!msg&&s.n) msg=`Mode automatique arrêté : ${s.n} voiture(s) rendue(s), ${MW.fmt(s.gain)} gagnés, ${s.xp} points d'expérience.`;}
 hud('');if(had&&msg) MW.toast(msg,kind||'info');}
function goTo(c){const z=MW.zone(c.zone),p=z&&z.ponts&&z.ponts[c.pont];if(!p) return;
 MW.teleport(p.x+Math.cos(p.ry)*1.7,p.z-Math.sin(p.ry)*1.7,p.ry-Math.PI/2,0);}
/* lance le travail d'une voiture ; fin(res) est appelé quand il se termine (res : 'ok' | message d'arrêt) */
function begin(c,rendre,fin){
 const o=ok(c);if(!o.ok){const m=`Travail automatique pas encore débloqué : il faut le niveau ${NIV} en ${manqueTxt(o.manque)}.`;if(fin) return fin(m);return MW.toast(m,'warn');}
 const g=MW.S.gest||{},classic=!!g.classic;
 if(classic) MWG.set({classic:false});MWG.ensure(c);
 const pc=pieces(c);if(!pc.ok){if(classic) MWG.set({classic:true});if(fin) return fin(pc.why);return MW.toast(pc.why,'warn');}
 c.auto=1; /* expérience divisée par deux au rendu (js/41) */
 if(c.symp&&!c.autoDiag){c.autoDiag=1;MW.addMin(20);const p=MWJ.PARTS[c.symp.c];if(c.insp) c.insp[c.symp.c]=1;MW.toast(`Diagnostic : ${p?p.nom.toLowerCase():'pièce'} en cause.`,'info');}
 job={c,rendre:!!rendre,n:0,last:'',same:0,classic,aide:g.aide,fin};MWG.set({aide:'on'});
 if(!fin) MW.toast(`Le mécanicien s'y met${pc.cout?` (pièces achetées : ${MW.fmt(pc.cout)})`:''}. Regardez-le faire, ou J pour arrêter.`,'good');
 step();}
function end(res,kind){const j=job;if(!j) return;clearTimeout(j.t);restore(j);job=null;
 if(j.fin) return j.fin(res);hud('');if(res&&res!=='ok') MW.toast(res,kind||'warn');}
/* rend la voiture et annonce le gain et l'expérience (moitié de celle d'un travail fait à la main) */
function rendre(c){const id=c.id,res=MWJ.done(c);if(!res) return null;const xp=fmtXp(res.competences);const fr=ferraille([id]);
 MW.toast(`Voiture rendue : ${res.voiture} · ${'★'.repeat(res.note)}${'☆'.repeat(5-res.note)} · ${MW.fmt(res.pay)}${res.avance?' + pièces '+MW.fmt(res.avance):''} · +${xp} points d'expérience (moitié : travail automatique)${fr.n?` · ${fr.n} pièce(s) usagée(s) à la ferraille${fr.t?' ('+MW.fmt(fr.t)+')':''}`:''}.`,'good');
 return {res,xp,fr};}
function step(){
 if(!job) return;const c=job.c;
 if(!MWJ.jobs().includes(c)) return end('La voiture est partie.');
 if(MW.paused){job.t=setTimeout(step,PAS);return;}
 if(!rig()||rig().c!==c){if(svc) goTo(c);if(!MWG.ensure(c)) return end("Travail automatique interrompu : vous vous êtes éloigné de la voiture.");}
 MWG.skip();
 const h=MWG.nextHint();
 if(!h||h.key==='door'){
  const bl=MWG.blocage(c);
  if(bl.length) return end('Travail automatique arrêté : '+bl.join(', ')+'.');
  if(job.rendre){const r=rendre(c);if(svc&&r){svc.n++;svc.gain+=(r.res.pay||0)+(r.res.avance||0)+(r.fr.t||0);svc.xp+=r.xp;}return end('ok');}
  return end(`Travail terminé en ${job.n} gestes : rendez la voiture (portière conducteur).`,'good');}
 if(h.key===job.last){if(++job.same>4) return end(`Travail automatique bloqué sur « ${h.lab} » : finissez à la main.`);}else job.same=0;
 job.last=h.key;
 const r=MWG.run(h.id,h.key);
 if(r) return end(`Travail automatique arrêté sur « ${h.lab} » : ${r}`);
 job.n++;hud(`${svc?esc(c.marque+' '+c.modele)+' · ':''}geste ${job.n} : ${esc(h.lab)}`);
 job.t=setTimeout(step,PAS);}
function start(rendre){
 if(job||svc) return stop('Travail automatique arrêté.');
 const c=carHere();if(!c) return MW.toast('Approchez-vous de la voiture à réparer (près du pont).','warn');
 begin(c,rendre,null);}

/* ── mode continu : toutes les voitures du garage, l'une après l'autre ── */
function nextCar(){const z=empZone();if(!z) return null;
 return MWJ.jobs().filter(c=>c.zone===z&&!c.noir&&!svc.skip[c.id]).sort((a,b)=>a.arrive-b.arrive)[0]||null;}
function loop(){
 if(!svc||job) return;
 if(MW.paused){svc.t=setTimeout(loop,500);return;}
 if(!empZone()) return stop("Mode automatique arrêté : il faut un emploi dans un garage (ou être à son compte).",'warn');
 const c=nextCar();
 if(!c){const att=MWJ.jobs().filter(x=>x.zone===empZone()&&!x.noir).length;hud(att?`${att} voiture(s) laissée(s) pour vous · en attente du prochain client`:'en attente du prochain client');svc.t=setTimeout(loop,1000);return;}
 const o=ok(c);
 if(!o.ok){svc.skip[c.id]=1;MW.toast(`${c.marque} ${c.modele} (pont ${c.pont+1}) laissée pour vous : travail automatique débloqué au niveau ${NIV} en ${manqueTxt(o.manque)}.`,'warn');svc.t=setTimeout(loop,300);return;}
 goTo(c);hud(`${esc(c.marque+' '+c.modele)} · préparation`);
 begin(c,true,res=>{
  if(res!=='ok'&&MWJ.jobs().includes(c)){svc.skip[c.id]=1;MW.toast(`${c.marque} ${c.modele} laissée pour vous. ${res}`,'warn');}
  if(svc) svc.t=setTimeout(loop,600);});}
function service(){
 if(job||svc) return stop('Travail automatique arrêté.');
 if(!empZone()) return MW.toast("Il faut d'abord un emploi dans un garage (ou être à son compte).",'warn');
 if(!MWJ.SKILLS.some(unlocked)) return MW.toast(`Mode automatique pas encore débloqué : atteignez le niveau ${NIV} dans une compétence.`,'warn');
 svc={n:0,gain:0,xp:0,skip:{}};MW.closePanel();
 MW.toast('Mode automatique continu : le mécanicien s\'occupe de toutes les voitures qui arrivent. J pour arrêter.','good');
 loop();}

function open(){
 const c=carHere();
 const chips=MWJ.SKILLS.map(k=>{const l=MWJ.level(k),u=l>=NIV;return `<span class="mw-tag${u?' ok':''}" title="${u?'Débloqué':'Débloqué au niveau '+NIV}">${u?'✓':'🔒'} ${esc(MWJ.SK_NOM[k])} ${l}</span>`;}).join(' ');
 const txt=`<p>Le mécanicien fait tout seul les gestes du travail, sous vos yeux. Le temps du jeu passe normalement.</p>
 <ul class="mw-gd-ul"><li><b>Déblocage</b> : une compétence au <b>niveau ${NIV}</b> débloque le travail automatique de tous ses travaux (Entretien ${NIV} : toutes les vidanges, filtres, bougies… ; une panne demande aussi Diagnostic ${NIV}).</li>
 <li>Pièces prises automatiquement : à l'étagère si vous êtes salarié, achetées chez Pièces Auto Express si vous êtes à votre compte. Une panne est diagnostiquée en même temps (20 minutes de plus).</li>
 <li><b>Mode continu</b> : le jeu fait tout tout seul, voiture après voiture (pièces, gestes, rendu, pièces usagées revendues à la ferraille). Les voitures pas encore débloquées vous sont laissées.</li>
 <li><b>Expérience</b> : vous en gagnez, mais deux fois moins qu'en faisant le travail vous-même.</li>
 <li>J ou Échap pendant le travail : arrêter.</li></ul><div class="mw-chips">${chips}</div>`;
 let car='';
 if(c){const o=ok(c);car=`<p><b>${esc(c.marque+' '+c.modele)}</b> · ${esc(c.symp?c.symp.txt:c.nom)}</p>`+(o.ok?`<div class="mw-btns"><button type="button" class="btn" data-mw="auto:go">Faire ce travail</button><button type="button" class="btn ghost" data-mw="auto:rendre">Faire ce travail et rendre la voiture</button></div>`
  :`<p class="mw-need">Pas encore débloqué pour cette voiture : il faut le niveau ${NIV} en ${esc(manqueTxt(o.manque))}. Faites ce travail à la main pour progresser.</p>`);}
 else car=`<p class="mw-soon">Pour une seule voiture : approchez-vous d'abord d'une voiture à réparer, près de son pont.</p>`;
 const can=!!empZone()&&MWJ.SKILLS.some(unlocked);
 const cont=`<div class="mw-btns"><button type="button" class="btn${c?' ghost':''}" data-mw="auto:svc"${can?'':' disabled'}>Mode automatique continu (toutes les voitures)</button></div>${can?'':`<p class="hint">${empZone()?`Atteignez le niveau ${NIV} dans une compétence pour le débloquer.`:'Il faut un emploi dans un garage (ou être à son compte).'}</p>`}`;
 MW.panel('Travail automatique',`${txt}${car}${cont}`,
  {onClick:a=>{if(a==='auto:go'){MW.closePanel();start(false);}else if(a==='auto:rendre'){MW.closePanel();start(true);}else if(a==='auto:svc') service();}});}
MW.on('key',k=>{if(k==='j'){if(job||svc) stop('Travail automatique arrêté.');else open();}});
window.addEventListener('keydown',e=>{if((job||svc)&&e.key==='Escape') stop('Travail automatique arrêté.');},true);
MW.addButton('auto','Travail auto (J)',()=>{if(MW.S){if(job||svc) stop('Travail automatique arrêté.');else open();}});
MW.on('close',()=>stop());MW.on('start',()=>stop());
return {start,service,stop,open,ok,unlocked,NIV,busy:()=>!!(job||svc),cont:()=>!!svc};
})();
window.__mwauto=MWAUTO;
