'use strict';
/* ───────────── Mode « Mécanicien » — REVENTE DES PIÈCES USAGÉES ─────────────
   Ce qu'on fait des anciennes pièces déposées sur les voitures :
   - Ferraille (magasin Pièces Auto Express) : valeur réaliste selon la matière — métal au poids, plomb des batteries,
     métaux précieux des sondes et bougies, consigne des pièces d'échange standard (alternateur, démarreur, injecteurs).
     Huile, liquides, filtres en papier, courroies et pneus partent au recyclage sans rien rapporter.
   - Occasion (depuis l'établi) : une pièce encore en bon état se met en vente ; des particuliers l'achètent au fil des
     heures (de 8 h à 20 h). Prix bas = vendu vite, prix haut = il faut attendre ; certains acheteurs négocient.
   - Remise en état (établi) : rectifier des disques, recharger une batterie, refaire un alternateur, un démarreur ou des
     injecteurs. Coûte un kit et du temps, demande le niveau de compétence de la pièce, et la pièce se revend bien plus cher.
   - Un client sur cinq environ veut récupérer ses anciennes pièces (c'est son droit) : elles ne peuvent être ni vendues
     ni jetées avant le rendu de sa voiture, sinon il est mécontent (géré dans js/41 : rend, rendBloq, evalJob, done).
   S'appuie sur MW (js/40) et MWJ (js/41).

   ═══ API `MWO` ═══
   MWO.R                    règles par pièce {f (part de ferraille), t (matière), o (usure maxi pour l'occasion), r (remise en état)}
   MWO.scrap(it)            valeur à la ferraille d'une pièce de l'inventaire ; MWO.scrapLbl(it) explication
   MWO.occV(it)             prix d'occasion « juste » (0 si invendable) ; MWO.valTxt(it) résumé pour la fiche de la pièce
   MWO.list(i, niveau)      met en vente la pièce n° i de l'inventaire ('bas' | 'juste' | 'haut') ; MWO.unlist(id)
   MWO.renov(i)             remet en état la pièce n° i ; MWO.tick(force) passe une heure de marché (force = vente sûre, tests)
   MWO.state()              {ann:[annonces], ventes, gain, renov} (sauvegardé dans MW.S.occ)
   MWO.etabliHTML(), MWO.carnetHTML(), MWO.act(action)   intégration à l'établi et au carnet de js/41
   Événement émis : 'occSold'(annonce, prix). */
const MWO=(()=>{
const R2=x=>Math.round(x*100)/100,fmt=x=>MW.fmt(x);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ANN_MAX=6;
/* f : part du prix neuf payée à la ferraille ; t : matière ; o : usure maximale pour la revente d'occasion (absent = jamais) ;
   d : attrait sur le marché de l'occasion ; r : remise en état {min, kit (part du prix neuf), g (usure retirée), txt} */
const R={
 huile:{f:0,t:'dechet'},filtre_huile:{f:.08,t:'fer'},filtre_air:{f:0,t:'dechet'},filtre_hab:{f:0,t:'dechet'},
 bougies:{f:.06,t:'precieux'},plaq_av:{f:.08,t:'fer'},plaq_ar:{f:.08,t:'fer'},
 disq_av:{f:.14,t:'fer',o:65,d:.9,r:{min:40,kit:.04,g:35,txt:'Rectification au tour : surfaces planes, épaisseur contrôlée au-dessus de la cote mini.'}},
 disq_ar:{f:.14,t:'fer',o:65,d:.8,r:{min:40,kit:.04,g:35,txt:'Rectification au tour : surfaces planes, épaisseur contrôlée au-dessus de la cote mini.'}},
 pneus:{f:0,t:'pneu',o:55,d:1.4},
 batterie:{f:.12,t:'plomb',o:45,d:1.2,r:{min:30,kit:.03,g:30,txt:'Recharge lente et désulfatation, puis test de capacité.'}},
 courroie_acc:{f:0,t:'dechet'},courroie_dist:{f:.03,t:'fer'},liquide_frein:{f:0,t:'dechet'},
 amort:{f:.1,t:'fer',o:50,d:.8},embrayage:{f:.1,t:'fer'},ampoules:{f:0,t:'dechet'},essuie:{f:0,t:'dechet'},
 alternateur:{f:.2,t:'consigne',o:70,d:1.1,r:{min:90,kit:.12,g:70,txt:'Charbons, roulements et régulateur neufs, débit contrôlé au banc.'}},
 demarreur:{f:.2,t:'consigne',o:70,d:1,r:{min:80,kit:.1,g:70,txt:'Lanceur, charbons et bagues neufs, essai à vide.'}},
 injecteurs:{f:.18,t:'consigne',o:65,d:1,r:{min:60,kit:.1,g:65,txt:'Nettoyage aux ultrasons, joints neufs, débit et pulvérisation contrôlés au banc.'}},
 sonde_lambda:{f:.2,t:'precieux'}};
const MAT={dechet:'Déchet : recyclage gratuit, ne rapporte rien.',pneu:'Pneus usés : recyclage gratuit, ne rapportent rien.',fer:'Ferraille, payée au poids.',
 plomb:'Plomb de la batterie, bien payé au recyclage.',precieux:'Contient des métaux précieux (platine) : payé au recyclage.',consigne:'Pièce d\'échange standard : le magasin rembourse la consigne.'};
const NIV={bas:{k:.8,p:2.2,nom:'Prix bas'},juste:{k:1,p:1,nom:'Prix du marché'},haut:{k:1.25,p:.45,nom:'Prix haut'}};
const ACH=['Un particulier','Un étudiant bricoleur','Un garagiste du quartier','Un collectionneur','Une mère de famille','Un retraité passionné','Un jeune conducteur'];

const st=()=>{const s=MW.S;if(!s) return {ann:[],ventes:0,gain:0,renov:0,seq:0};if(!s.occ) s.occ={ann:[],ventes:0,gain:0,renov:0,seq:0};return s.occ;};
const P=id=>MWJ.PARTS[id];
const rule=it=>R[it.id]||{f:.08,t:'fer'};
const pv=it=>+it.pv>0?+it.pv:it.k==='neuve'&&+it.paye>0?+it.paye:P(it.id).prix;
const vole=it=>it.k==='neuve'&&it.src==='etagere'; /* pièce neuve du stock de l'employeur */
const inv=()=>MWJ.inv();
const bloq=it=>!!(MWJ.rendBloq&&MWJ.rendBloq(it));
const nomIt=it=>`${P(it.id).nom}${it.car?' ('+it.car+')':''}`;

function scrap(it){const r=rule(it);return r.f>0?Math.max(1,Math.round(pv(it)*r.f)):0;}
function scrapLbl(it){const r=rule(it);return MAT[r.t]||MAT.fer;}
/* prix d'occasion : moitié du neuf pour une pièce comme neuve, décroît avec l'usure ; une pièce remise en état vaut 35 % de plus */
function occOK(it){if(it.k==='neuve') return true;const r=rule(it);return !!r.o&&it.u<=r.o;}
function occV(it){if(it.k==='neuve') return Math.round(pv(it)*.7);if(!occOK(it)) return 0;const k=Math.pow(1-it.u/100,.8)*.5*(it.ren?1.35:1);return Math.max(scrap(it)+2,Math.round(pv(it)*k));}
function renOK(it){const r=rule(it).r;return !!r&&!it.ren&&it.u>=20;}
const renCost=it=>Math.max(3,Math.round(pv(it)*rule(it).r.kit));
function valTxt(it){if(it.k==='neuve') return `Pièce neuve dans sa boîte : environ ${fmt(occV(it))} en vente entre particuliers.${vole(it)?' Elle appartient à votre employeur : la revendre, c\'est du vol.':''}`;
 const o=occV(it),f=scrap(it),r=rule(it);let t=`Ferraille : ${f?fmt(f):'0 €'}.`;
 if(o) t+=` Occasion : environ ${fmt(o)}.`;else if(r.o) t+=` Trop usée pour l'occasion (maxi ${r.o} % d'usure)${renOK(it)?' : remettez-la en état à l\'établi':''}.`;
 return t;}

function list(i,niv){
 const it=inv()[i],n=NIV[niv]||NIV.juste,s=st();
 if(!it||(it.k!=='usagee'&&it.k!=='neuve')) return false;
 if(bloq(it)){MW.toast('Ce client veut récupérer cette pièce : vous ne pouvez pas la vendre.','warn');return false;}
 if(!occOK(it)){MW.toast('Pièce trop usée pour l\'occasion : vendez-la à la ferraille.','warn');return false;}
 if(s.ann.length>=ANN_MAX){MW.toast(`Vous avez déjà ${ANN_MAX} annonces en cours.`,'warn');return false;}
 const prix=Math.round(occV(it)*n.k);
 inv().splice(i,1);MWJ.invUI();
 s.ann.push({id:'a'+(++s.seq),it,prix,niv:niv in NIV?niv:'juste',jour:MW.S.day});
 if(vole(it)&&typeof MWA!=='undefined') MWA.stock(it,prix); /* le patron finira peut-être par s'en apercevoir */
 MW.toast(`Annonce publiée : ${P(it.id).nom} à ${fmt(prix)}. La pièce reste rangée à l'atelier en attendant l'acheteur.`,'good');return true;}
function unlist(id){
 const s=st(),k=s.ann.findIndex(a=>a.id===id);if(k<0) return false;
 if(inv().length>=MWJ.INV_MAX){MW.toast('Inventaire plein : impossible de reprendre la pièce.','warn');return false;}
 const a=s.ann.splice(k,1)[0];inv().push(a.it);MWJ.invUI();MW.toast('Annonce retirée : la pièce revient dans votre inventaire.','info');return true;}
function renov(i){
 const it=inv()[i];if(!it||it.k!=='usagee') return false;const p=P(it.id),r=rule(it).r;
 if(bloq(it)){MW.toast('Ce client veut récupérer cette pièce telle quelle.','warn');return false;}
 if(!renOK(it)){MW.toast('Cette pièce ne se remet pas en état.','warn');return false;}
 if(MWJ.level(p.comp)<p.niv){MW.toast(`Il faut ${MWJ.SK_NOM?MWJ.SK_NOM[p.comp].toLowerCase():p.comp} niveau ${p.niv} pour remettre cette pièce en état.`,'warn');return false;}
 const c=renCost(it);if(MW.S.money<c){MW.toast("Pas assez d'argent pour le kit de remise en état.",'warn');return false;}
 MW.money(-c,'Kit de remise en état : '+p.nom);MW.addMin(r.min);
 it.u=Math.max(5,it.u-r.g);it.ren=1;st().renov++;
 const s=MW.S;s.xp[p.comp]=(s.xp[p.comp]||0)+Math.round(r.min*.25);
 MWJ.invUI();MW.toast(`${p.nom} remis(e) en état (${r.min} min) : usure ${it.u} %, revendable environ ${fmt(occV(it))}.`,'good');return true;}

/* une heure de marché : chaque annonce a une chance de trouver preneur (plus forte à prix bas et avec une bonne réputation) */
function tick(force){
 const s=st(),m=MW.S?MW.S.min:600;if(!s.ann.length) return 0;
 if(!force&&(m<8*60||m>=20*60)) return 0;
 const rep=1+((MW.S&&MW.S.rep)||0)/200;let n=0;
 for(const a of s.ann.slice()){
  const age=Math.max(0,MW.S.day-a.jour),p=.05*NIV[a.niv].p*(rule(a.it).d||1)*rep*(1+Math.min(.5,age*.08));
  if(!force&&Math.random()>=p) continue;
  const neg=!force&&Math.random()<.3,prix=neg?Math.round(a.prix*.9):a.prix;
  s.ann.splice(s.ann.indexOf(a),1);s.ventes++;s.gain=R2(s.gain+prix);n++;
  MW.money(prix,'Vente d\'occasion : '+P(a.it.id).nom);
  MW.toast(`${ACH[Math.floor(Math.random()*ACH.length)]} a acheté ${P(a.it.id).nom.toLowerCase()} d'occasion : ${fmt(prix)}${neg?' (après négociation)':''}.`,'good');
  MW.emit('occSold',a,prix);}
 return n;}

/* ── intégration à l'établi ── */
const btn=(a,t,cls,dis)=>`<button type="button" class="btn sm${cls?' '+cls:''}" data-mw="occ:${a}"${dis?' disabled':''}>${t}</button>`;
let choix=null; /* pièce dont on choisit le prix */
function etabliHTML(){
 const s=st(),us=inv().map((it,i)=>({it,i})).filter(x=>x.it.k==='usagee'||x.it.k==='neuve');
 let h=`<h3 class="mw-h3">Revendre les anciennes pièces</h3><p class="hint">Une pièce encore bonne se vend d'occasion à des particuliers. Les autres partent à la ferraille (chez Pièces Auto Express). Certaines se remettent en état ici pour se revendre plus cher.</p>`;
 if(!us.length) h+='<p>Aucune pièce usagée dans votre inventaire. Les pièces que vous déposez sur les voitures y arrivent.</p>';
 for(const {it,i} of us){const p=P(it.id),bl=bloq(it),o=occV(it),r=rule(it).r;
  h+=`<div class="mw-prt"><div class="mw-prt-h"><b>${esc(nomIt(it))}</b><span class="mw-tag${bl||vole(it)?' warn':it.ren||it.k==='neuve'?' ok':''}">${bl?'À rendre au client':it.k==='neuve'?(vole(it)?'Neuve · stock du patron':'Neuve'):it.ren?'Remise en état':'Usure '+it.u+' %'}</span></div><small>${esc(valTxt(it))}</small>`;
  if(!bl){let b='';
   if(choix===i&&o) b+=Object.keys(NIV).map(k=>btn(`list:${i}:${k}`,`${NIV[k].nom} : ${fmt(Math.round(o*NIV[k].k))}`)).join('')+btn('cancel','Annuler','ghost');
   else{if(o) b+=btn('pick:'+i,vole(it)?'Revendre en douce':'Mettre en vente',vole(it)?'warn':'',s.ann.length>=ANN_MAX);
    if(renOK(it)) b+=btn('ren:'+i,`Remettre en état (${r.min} min, kit ${fmt(renCost(it))})`,'ghost',MWJ.level(p.comp)<p.niv||MW.S.money<renCost(it));}
   if(b) h+=`<div class="mw-btns">${b}</div>`;
   if(it.k==='usagee'&&renOK(it)&&MWJ.level(p.comp)<p.niv&&choix!==i) h+=`<small>Remise en état : ${esc(MWJ.SK_NOM?MWJ.SK_NOM[p.comp]:p.comp)} niveau ${p.niv} requis.</small>`;}
  h+='</div>';}
 h+=annHTML(true);return h;}
function annHTML(btns){
 const s=st();let h=`<h3 class="mw-h3">Annonces d'occasion (${s.ann.length}/${ANN_MAX})</h3>`;
 if(!s.ann.length) h+='<p>Aucune annonce en cours.</p>';
 else h+=s.ann.map(a=>`<div class="mw-prt"><div class="mw-prt-h"><b>${esc(nomIt(a.it))}</b><span class="mw-tag">${fmt(a.prix)}</span></div><small>${esc(NIV[a.niv].nom)} · en ligne depuis ${MW.S.day-a.jour?(MW.S.day-a.jour)+' jour(s)':'aujourd\'hui'}. Les acheteurs passent entre 8 h et 20 h.</small>${btns?`<div class="mw-btns">${btn('un:'+a.id,'Retirer l\'annonce','ghost')}</div>`:''}</div>`).join('');
 if(s.ventes) h+=`<small>${s.ventes} pièce(s) vendue(s) d'occasion pour ${fmt(s.gain)}${s.renov?' · '+s.renov+' remise(s) en état':''}.</small>`;
 return h;}
function carnetHTML(){const s=st();return s.ann.length||s.ventes?annHTML(false):'';}
function act(a){
 const [k,x,y]=a.split(':');
 if(k==='pick'){choix=+x;return;}
 if(k==='cancel'){choix=null;return;}
 choix=null;
 if(k==='list') list(+x,y);else if(k==='un') unlist(x);else if(k==='ren') renov(+x);}

MW.on('hour',()=>{try{tick(false);}catch(e){console.error(e);}});
MW.on('open',()=>{choix=null;});
return {R,scrap,scrapLbl,occV,occOK,valTxt,list,unlist,renov,renOK,tick,state:st,etabliHTML,carnetHTML,act,ANN_MAX};
})();
window.__mwo=MWO;
