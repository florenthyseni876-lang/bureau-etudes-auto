'use strict';
/* ───────────── Mode « Mécanicien » — ARNAQUES ET HONNÊTETÉ ─────────────
   Au moment de rendre la voiture (écran « Rendre la voiture » de js/41), on peut gonfler la facture :
   - pièces de réemploi (occasion ou remises en état, montées faute de neuve) facturées au prix du neuf ;
   - main-d'œuvre gonflée de 35 % ;
   - pièces « fantômes » : facturées mais jamais changées ;
   - échange discret (js/41) : remplacer une pièce en bon état du client par une pièce usée et garder la bonne ;
   - vol de stock (js/48) : revendre les pièces neuves prises à l'étagère de son employeur.
   Risques : le client relit la facture au comptoir (découverte immédiate : note 1, réputation), puis dans les jours qui suivent
   un autre garage, le contrôle technique ou le patron peuvent découvrir le pot aux roses : remboursement et dédommagement
   (à son compte), retenue sur salaire, avertissement puis licenciement (salarié), amende de la répression des fraudes en cas
   de récidive. Chaque arnaque découverte fait monter les « soupçons » du quartier, qui rendent les suivantes plus risquées.
   Salarié, seule votre part de main-d'œuvre profite d'une facture gonflée ; à votre compte, tout le surplus est pour vous.

   ═══ API `MWA` ═══
   MWA.state()            {pend:[arnaques non découvertes], susp (0 à 100), avert:{employeur:n}, fraudes, pris, gain, hist:[]}
   MWA.toggle(c, k)       option de facture ('neuf' | 'mo' | 'fant:<pièce>') ; MWA.invoiceHTML(c, ev) section de l'écran de rendu
   MWA.counter(c)         relecture au comptoir (appelé par js/41 avant le calcul de la facture) ; MWA.after(c, job, ev)
   MWA.stock(it, prix)    vol de stock (appelé par js/48) ; MWA.day(force) examen quotidien (force : 'pris' | 'libre', tests)
   MWA.risk(kinds)        {now, later} probabilités de découverte ; MWA.carnetHTML()
   Événement émis : 'fraudCaught'(arnaque, sanction). */
const MWA=(()=>{
const R2=x=>Math.round(x*100)/100,fmt=x=>MW.fmt(x),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
/* probabilité de découverte : au comptoir (le client relit la facture) et plus tard (autre garage, contrôle technique, patron) */
const P_NOW={neuf:.06,mo:.1,fant:.12},P_LATER={neuf:.3,mo:.2,fant:.45,vol:.25,stock:.35};
const NOM={neuf:'pièces d\'occasion facturées neuves',mo:'main-d\'œuvre gonflée',fant:'pièces facturées sans être changées',vol:'pièce en bon état gardée, pièce usée montée',stock:'pièces neuves volées à l\'étagère'};
const COMMENT={
 neuf:'Son beau-frère, mécanicien, a reconnu des pièces d\'occasion facturées au prix du neuf.',
 mo:'Il a comparé le temps facturé au barème du constructeur : presque deux fois trop.',
 fant:'Au contrôle technique, on lui a montré que les pièces facturées n\'avaient jamais été changées.',
 vol:'Un autre garage a trouvé une pièce usée là où la sienne était presque neuve.',
 stock:'Le patron a fait l\'inventaire de l\'étagère : il manque des pièces neuves, et une annonce à votre nom les vend.'};
const AMENDE=1500;

const st=()=>{const s=MW.S;if(!s) return {pend:[],susp:0,avert:{},fraudes:0,pris:0,gain:0,hist:[]};
 if(!s.arn) s.arn={pend:[],susp:0,avert:{},fraudes:0,pris:0,gain:0,hist:[]};return s.arn;};
const emp=()=>{try{return typeof MWC!=='undefined'&&MWC.employer?MWC.employer():null;}catch(e){return null;}};
const compte=e=>!!(e&&(e.compte||e.net||e.id==='aucun'));
const mult=()=>1+st().susp/50;
function risk(kinds){
 let a=1,b=1;for(const k of kinds){if(P_NOW[k]) a*=1-P_NOW[k];b*=1-(P_LATER[k]||.2);}
 return {now:clamp((1-a)*mult(),0,.6),later:clamp((1-b)*(1+st().susp/100),0,.9)};}
function addRep(d){const s=MW.S;s.rep=clamp(R2((s.rep||0)+d),0,100);}
function hist(t){const a=st();a.hist.unshift({jour:MW.S.day,t});while(a.hist.length>8) a.hist.pop();}

/* ── écran de rendu ── */
function fr(c){if(!c.fraud) c.fraud={neuf:0,mo:0,fant:[]};if(!c.fraud.fant) c.fraud.fant=[];return c.fraud;}
function toggle(c,k){const f=fr(c);
 if(k==='neuf'||k==='mo') f[k]=f[k]?0:1;
 else if(k.startsWith('fant:')){const id=k.slice(5),i=f.fant.indexOf(id);if(i>=0) f.fant.splice(i,1);else if(f.fant.length<3) f.fant.push(id);}}
/* surplus d'une option : on recalcule la facture avec et sans */
function delta(c,mod){const f=fr(c),keep=JSON.stringify(f);const a=MWJ.evalJob(c).facture;mod(f);const b=MWJ.evalJob(c).facture;c.fraud=JSON.parse(keep);return R2(b-a);}
const fantCands=c=>MWJ.PARTS_LIST.filter(p=>!c.done[p.id]&&c.parts[p.id]&&!c.parts[p.id].na&&c.parts[p.id].u>=35).sort((a,b)=>c.parts[b.id].u-c.parts[a.id].u).slice(0,4);
function invoiceHTML(c,ev){
 const f=fr(c),e=emp(),own=compte(e),RE=c.reemp||{};
 const tg=(k,on,t,plus)=>`<button type="button" class="btn sm${on?' warn':' ghost'}" data-mw="fr:${k}" aria-pressed="${on?'true':'false'}">${on?'✓ ':''}${t}${plus?` <small>(${plus>0?'+':''}${fmt(plus)})</small>`:''}</button>`;
 let h=`<h3 class="mw-h3">Facturation</h3>`;
 const re=Object.keys(RE).filter(id=>c.done[id]&&ev.lines.some(l=>l.id===id));
 if(re.length) h+=`<p class="hint">Pièce(s) de réemploi montée(s) : la loi impose de les facturer moins cher que le neuf (ici −40 %).</p>`;
 const b=[];
 if(re.length) b.push(tg('neuf',f.neuf,'Facturer le réemploi au prix du neuf',f.neuf?0:delta(c,x=>{x.neuf=1;})));
 b.push(tg('mo',f.mo,'Gonfler la main-d\'œuvre',f.mo?0:delta(c,x=>{x.mo=1;})));
 for(const p of fantCands(c)){const on=f.fant.includes(p.id);b.push(tg('fant:'+p.id,on,`Facturer « ${esc(MWJ.pn(c,p))} » sans la changer`,on?0:delta(c,x=>{x.fant.push(p.id);})));}
 h+=`<details class="mw-fr-d"${ev.fraude.kinds.length?' open':''}><summary>Arrondir la facture… (malhonnête)</summary><div class="mw-btns">${b.join('')}</div>`;
 if(ev.fraude.kinds.length){const r=risk(ev.fraude.kinds.filter(k=>k!=='vol')),r2=risk(ev.fraude.kinds);
  h+=`<p class="mw-soon">Surplus facturé : <b>${fmt(ev.fraude.gain)}</b>${own?' (pour vous)':' (pour le garage ; vous touchez votre part de main-d\'œuvre)'}. Risque que le client s'en aperçoive au comptoir : <b>${Math.round(r.now*100)} %</b>, dans les jours qui suivent : <b>${Math.round(r2.later*100)} %</b>. S'il découvre l'arnaque : ${own?'remboursement du double, réputation en chute, amende en cas de récidive':'retenue sur votre paie, avertissement, puis licenciement'}.</p>`;}
 else h+=`<p class="hint">Facture honnête.${st().susp>=20?` Le quartier se méfie déjà de vous (soupçons ${Math.round(st().susp)} / 100).`:''}</p>`;
 h+='</details>';
 if(ev.fraude.vol.length) h+=`<p class="mw-soon">Échange discret : vous gardez ${esc(ev.fraude.vol.map(id=>MWJ.pn(c,id).toLowerCase()).join(', '))} du client, en bon état, et lui laissez une pièce plus usée (non facturée). Risque d'être découvert plus tard : ${Math.round(risk(['vol']).later*100)} %.</p>`;
 return h;}

/* ── au comptoir ── */
function counter(c){
 c.caught=0;if(!c.fraud||c.forceFree) return false;const ev=MWJ.evalJob(c),k=ev.fraude.kinds.filter(x=>P_NOW[x]);if(!k.length) return false;
 if(Math.random()>=risk(k).now&&c.forceCaught!==true) return false;
 c.fraud=null;c.caught=1;const a=st();a.pris++;a.susp=clamp(a.susp+15,0,100);addRep(-6);
 const e=emp();if(e&&!compte(e)) a.avert[e.id]=(a.avert[e.id]||0)+1;
 hist(`${c.client} a relevé l'arnaque au comptoir (${k.map(x=>NOM[x]).join(', ')}).`);
 MW.toast(`${c.client} relit la facture et proteste : « Vous me prenez pour un pigeon ? » Il ne paie que le travail réel et le racontera à tout le quartier (réputation −6).`,'warn');
 MW.emit('fraudCaught',{client:c.client,kinds:k,comptoir:true},'comptoir');
 if(e&&!compte(e)) sanctionEmp(e,0);
 return true;}
function after(c,job,ev){
 if(c.caught){job.arnaque='découverte';return;}
 const k=ev.fraude.kinds;if(!k.length) return;
 const a=st(),e=emp();a.fraudes++;a.gain=R2(a.gain+Math.max(0,ev.fraude.gain));job.arnaque=k.slice();
 a.pend.push({due:MW.S.day+rint(1,5),client:c.client,voiture:job.voiture,kinds:k.slice(),gain:Math.max(0,ev.fraude.gain),emp:e?e.id:'aucun',own:compte(e)});}
function stock(it,prix){
 const a=st(),e=emp();a.fraudes++;a.gain=R2(a.gain+prix);
 a.pend.push({due:MW.S.day+rint(1,4),client:e?e.nom:'le patron',voiture:'',kinds:['stock'],gain:prix,emp:e?e.id:'aucun',own:false});}

/* ── sanctions ── */
function sanctionEmp(e,retenue){
 const a=st(),n=a.avert[e.id]||0;
 if(retenue>0) MW.money(-retenue,'Retenue sur paie (arnaque découverte)');
 if(n>=2&&typeof MWC!=='undefined'&&MWC.hire){MWC.hire('aucun');a.avert[e.id]=0;addRep(-5);
  MW.panel('Licencié',`<p>Votre employeur vous convoque : « Deux fois, c'est une fois de trop. Vous rendez votre clé et vous ne remettez plus les pieds ici. »</p><p>Vous êtes licencié pour faute grave. Il faudra retrouver une place ailleurs… ou travailler à votre compte.</p><div class="mw-btns"><button type="button" class="btn" data-mw="close">Fermer</button></div>`);
  hist('Licencié pour faute grave.');return 'licencié';}
 MW.toast(`Avertissement de votre employeur${retenue>0?` et retenue de ${fmt(retenue)} sur votre paie`:''} : à la prochaine, c'est la porte.`,'warn');
 return 'avertissement';}
function discover(x){
 const a=st(),n=x.kinds.length;a.pris++;a.susp=clamp(a.susp+20,0,100);addRep(-(5+3*n));let s;
 const txt=x.kinds.map(k=>COMMENT[k]).join(' ');
 if(x.own||x.kinds.includes('vol')&&x.emp==='aucun'){const r=R2(x.gain*2);MW.money(-r,'Remboursement et dédommagement : '+x.client);s=`remboursement et dédommagement de ${fmt(r)}`;
  if(a.pris>=3||x.gain>=300){MW.money(-AMENDE,'Amende de la répression des fraudes');s+=` et amende de ${fmt(AMENDE)} de la répression des fraudes`;}}
 else{a.avert[x.emp]=(a.avert[x.emp]||0)+1;const e=emp();
  s=e&&e.id===x.emp?sanctionEmp(e,Math.round(x.gain)):'votre ancien patron porte plainte';
  if(!(e&&e.id===x.emp)){MW.money(-Math.round(x.gain),'Dédommagement à votre ancien employeur');}}
 hist(`${x.client}${x.voiture?' ('+x.voiture+')':''} : arnaque découverte, ${s}.`);
 MW.toast(`Arnaque découverte ! ${x.kinds.includes('stock')?'':x.client+' revient furieux. '}${txt} Conséquence : ${s}, réputation −${5+3*n}.`,'warn');
 MW.emit('fraudCaught',x,s);return s;}
function day(force){
 const a=st();a.susp=clamp(a.susp-1,0,100);let n=0;
 for(const x of a.pend.slice()){if(!force&&x.due>MW.S.day) continue;
  a.pend.splice(a.pend.indexOf(x),1);
  const pr=force==='pris'?1:force==='libre'?0:risk(x.kinds).later;
  if(Math.random()<pr){discover(x);n++;}else a.susp=clamp(a.susp-2,0,100);}
 return n;}

function carnetHTML(){
 const a=st();if(!a.fraudes&&!a.pris) return '';
 return `<h3 class="mw-h3">Honnêteté</h3><p>Soupçons dans le quartier : <b>${Math.round(a.susp)} / 100</b> · ${a.fraudes} arnaque(s), ${a.pris} découverte(s) · surplus empoché ${fmt(a.gain)}${a.pend.length?` · ${a.pend.length} client(s) qui pourraient encore s'en apercevoir`:''}.</p>${a.hist.length?`<small>${a.hist.slice(0,4).map(h=>`Jour ${h.jour} : ${esc(h.t)}`).join('<br>')}</small>`:''}`;}

MW.on('day',()=>{try{if(MW.S) day(false);}catch(e){console.error(e);}});
return {state:st,toggle,invoiceHTML,counter,after,stock,day,risk,carnetHTML,P_NOW,P_LATER,AMENDE};
})();
window.__mwa=MWA;
