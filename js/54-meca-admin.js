'use strict';
/* ───────────── Mode « Mécanicien » — MODE ADMINISTRATEUR (tests) ─────────────
   Activé depuis le menu (Échap → « Mode administrateur… »). Tant qu'il est actif :
   argent illimité (remis à 9 999 999 € dès qu'il passe sous la moitié), toutes les compétences au niveau maximal,
   réputation 100, outils achetés, diplômes obtenus. Le panneau permet aussi de faire venir n'importe quel travail ou
   n'importe quelle panne, de prendre les pièces et les outils de l'ordre, de finir automatiquement les gestes en cours,
   de changer d'emploi, de régler l'heure et de se téléporter. Données : MW.S.admin (vrai / faux).
   ═══ API `MWADM` ═══  MWADM.on() · MWADM.set(bool) · MWADM.open() · MWADM.finish() (finit les gestes de la voiture en cours) */
const MWADM=(()=>{
const MONEY=9999999,XP=5000;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const on=()=>!!(MW.S&&MW.S.admin);
const EMPLOIS=[['apprenti','Apprenti (Garage du Coin)'],['meca','Mécanicien (Garage du Coin)'],['patron','Patron du Garage du Coin'],['ventoux','Ventoux Automobiles'],['aurele','Maison Aurèle'],['brivio','Scuderia Brivio'],['ing','Ingénieur'],['aucun','Sans emploi']];
function apply(){
 if(!on()) return;const s=MW.S;
 if(!(s.money>=MONEY/2)) MW.money(MONEY-(s.money||0),'Mode administrateur : argent illimité');
 s.xp=s.xp||{};for(const k of MWJ.SKILLS) if(!((s.xp[k]||0)>=XP)) s.xp[k]=XP;
 s.rep=100;
 const j=s.jobs;if(j&&j.outils) for(const k in MWJ.OUTILS) j.outils[k]=1;
 try{const c=MWC.state();if(c&&c.dipl&&MWC.DIPL) for(const k in MWC.DIPL) c.dipl[k]=true;}catch(e){}
 MW.hud('admin','<b style="color:#ff7a45">MODE ADMINISTRATEUR</b> · argent illimité, niveaux au maximum');}
function set(v){if(!MW.S) return;MW.S.admin=!!v;if(v){apply();MW.toast('Mode administrateur activé : argent illimité et tous les niveaux au maximum.','good');}else{MW.hud('admin','');MW.toast('Mode administrateur désactivé (l\'argent et les niveaux acquis restent).','info');}try{MWJ.invUI();}catch(e){}}
const car=()=>{const l=MWJ.jobs();return l.find(c=>!c.noir)||l[0]||null;};
function needJob(){const e=MWC.employer();if(!e||e.id==='aucun') MWC.hire('patron');}
function spawn(o){needJob();const c=MWJ.spawn(Object.assign({force:true,rend:false},o));if(!c){MW.toast("Impossible de faire venir la voiture (tous les ponts sont pris ?).",'warn');return null;}
 MW.toast(`${c.marque} ${c.modele} arrivée sur le pont ${c.pont+1}.`,'good');return c;}
function parts(){const c=car();if(!c) return MW.toast('Aucune voiture en cours.','warn');const ids=c.ordre.slice();if(c.symp&&!ids.includes(c.symp.c)) ids.push(c.symp.c);
 let n=0;for(const id of ids) if(!c.done[id]&&MWJ.L.invFind('neuve',id)<0&&MWJ.inv().length<MWJ.INV_MAX){MWJ.L.invAdd({k:'neuve',id,src:'achat',paye:0});n++;}
 MW.toast(n?`${n} pièce(s) neuve(s) ajoutée(s)${c.symp?' (la panne comprise)':''}.`:'Rien à ajouter (inventaire plein ou pièces déjà là).','info');}
/* finit automatiquement les gestes de la voiture en cours, en suivant l'aide (utile pour tester la suite d'un travail) */
function finish(){const c=car();if(!c||typeof MWG==='undefined'||!MWG.on()) return MW.toast('Gestes réalistes inactifs ou aucune voiture.','warn');
 MWG.ensure(c);const keep=MWG.cur?MWG.cur():null;const g=MW.S.gest||{};const aide=g.aide;MWG.set({aide:'on'});let n=0,last='',same=0,why='';
 try{for(;n<300;n++){MWG.skip();const h=MWG.nextHint();if(!h||h.key==='door') break;if(h.key===last){if(++same>3){why=h.lab;break;}}else same=0;last=h.key;
  const r=MWG.run(h.id,h.key);if(r){why=h.lab+' : '+r;break;}}}
 finally{MWG.set({aide:aide||'auto'});if(keep) MWG.setTool(keep.tool,keep.sock);}
 MW.toast(why?`Arrêt après ${n} geste(s) : ${why}`:`${n} geste(s) faits automatiquement. Il reste à rendre la voiture (portière conducteur).`,why?'warn':'good');}
function tp(id){const z=MW.zone(id);if(!z) return;const d=z.porte||{x:z.x,z:z.z},n=z.n||{x:0,z:1};MW.closePanel();MW.teleport(d.x+n.x*2,d.z+n.z*2,Math.atan2(-n.x,-n.z),0);}
function open(){
 if(!MW.S) return;const a=on(),btn=(k,t,cls)=>`<button type="button" class="btn sm${cls?' '+cls:''}" data-mw="adm:${k}">${t}</button>`;
 const TPL=MWJ.TPL||[],SY=MWJ.SYMP||[];
 let h=`<p>${a?'<b>Actif</b> : argent illimité, compétences au niveau 10, réputation 100, outils et diplômes.':'Inactif. Activez-le pour tester librement : argent illimité et tous les niveaux au maximum.'}</p>
 <div class="mw-btns">${a?btn('off','Désactiver','ghost'):btn('on','Activer le mode administrateur')}</div>`;
 if(a){
  h+=`<h3 class="mw-h3">Faire venir une voiture</h3>
  <div class="mw-btns"><label class="hint" for="admTpl">Travaux</label><select id="admTpl" class="mw-sel">${TPL.map(t=>`<option value="${esc(t[0])}">${esc(t[1])}</option>`).join('')}</select>${btn('tpl','Faire venir')}</div>
  <div class="mw-btns"><label class="hint" for="admSym">Panne</label><select id="admSym" class="mw-sel">${SY.map(y=>`<option value="${esc(y.id)}">${esc(y.txt)}</option>`).join('')}</select>${btn('sym','Faire venir')}</div>
  <div class="mw-btns">${btn('parts',"Pièces neuves de l'ordre",'ghost')}${btn('tools',"Outils (servante)",'ghost')}${btn('finish','Finir les gestes automatiquement','ghost')}${btn('clear','Renvoyer les voitures','ghost')}</div>
  <h3 class="mw-h3">Emploi</h3><div class="mw-btns">${EMPLOIS.map(([id,n])=>btn('emp:'+id,esc(n),'ghost')).join('')}</div>
  <h3 class="mw-h3">Heure</h3><div class="mw-btns">${btn('h:8','8 h','ghost')}${btn('h:12','12 h','ghost')}${btn('h:18','18 h','ghost')}${btn('h:22','22 h','ghost')}${btn('day','Jour suivant','ghost')}</div>
  <h3 class="mw-h3">Aller à</h3><div class="mw-btns">${(MW.zones||[]).map(z=>btn('tp:'+z.id,esc(z.court||z.nom),'ghost')).join('')}</div>`;}
 MW.panel('Mode administrateur',h,{wide:true,onClick:x=>{if(!x.startsWith('adm:')) return;const [,k,v]=x.split(':');
  if(k==='on') set(true);else if(k==='off') set(false);
  else if(k==='tpl'){const s=document.getElementById('admTpl');if(s) spawn({tpl:s.value});}
  else if(k==='sym'){const s=document.getElementById('admSym');if(s) spawn({symp:s.value});}
  else if(k==='parts') parts();
  else if(k==='tools'){MWJ.servante((car()||{}).zone);return;}
  else if(k==='finish'){MW.closePanel();finish();return;}
  else if(k==='clear'){MWJ.clear();MW.toast('Voitures renvoyées.','info');}
  else if(k==='emp'){MWC.hire(v);MW.toast('Emploi : '+(EMPLOIS.find(e=>e[0]===v)||[0,v])[1]+'.','good');}
  else if(k==='h'){MW.S.min=(+v)*60;MW.toast(`Il est ${v} h.`,'info');}
  else if(k==='day'){MW.addMin(24*60);}
  else if(k==='tp'){tp(v);return;}
  apply();open();}});}
MW.on('money',()=>{if(on()&&!(MW.S.money>=MONEY/2)) setTimeout(apply,0);});
MW.on('day',apply);MW.on('start',()=>{if(on()) apply();else MW.hud('admin','');});MW.on('open',()=>{if(on()) apply();});
return {on,set,open,finish,apply};
})();
window.__mwadm=MWADM;
