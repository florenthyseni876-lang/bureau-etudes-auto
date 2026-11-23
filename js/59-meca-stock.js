'use strict';
/* ───────────── Mode « Mécanicien » — STOCK DE PIÈCES, COMMANDE EN LIGNE, LIVRAISON ─────────────
   Plus de stock infini : chaque lieu a un stock de pièces avec des quantités et une capacité.
   · Garages (Garage du Coin, Ventoux, Maison Aurèle, Scuderia Brivio, garages achetés) : réserve de l'atelier (étagère). Prendre une pièce à
     l'étagère la retire du stock ; une pièce absente se commande à l'ordinateur du bureau, ou se rachète au magasin Pièces Auto Express.
   · Chez soi (studio, logements) : la réserve est le COFFRE du logement (js/52, MWI.stock), compté en pièces neuves ; l'ordinateur est celui du
     bureau (js/52a). Capacité = places du coffre.
   · Commander par internet (site « Pièces Auto Express ») : catalogue (prix en ligne 8 % sous le comptoir), panier, frais de livraison et délai :
     livraison le lendemain à 9 h (6 €) ou express le jour même (environ 1 h 30, 18 €, seulement si la commande est passée avant 17 h).
     Une camionnette se gare devant le lieu et le colis entre dans le stock de ce lieu.
   · Aller les chercher : au magasin (zone « pièces »), on achète au comptoir, les pièces vont dans l'inventaire, puis on les range dans le stock.
   · Qui paie : SALARIÉ → l'employeur commande (gratuit pour le joueur, livraison du lendemain seulement), l'atelier est réapprovisionné chaque
     matin pour les pièces courantes, une pièce rare se commande et arrive avec un délai (le client attend). À SON COMPTE / PATRON / SOCIÉTÉ →
     compte du garage (js/57, MWS.biz). CHEZ SOI → argent personnel.
   · À deux (js/56) : le stock du garage est commun, l'hôte fait autorité (l'invité lit une copie et envoie ses demandes).
   · Anciennes sauvegardes : stock initial raisonnable créé à la première visite du lieu.

   ═══ API `MWST` (aussi `window.__mwst`) ═══
   MWST.get(lieu)                      {parts:{id:quantité}, total, cap, free, pend:{id:quantité en commande}} (lieu : 'garage1'…'garage7', 'appart', 'loge1'…'loge4')
   MWST.qty(lieu,id)                   quantité en stock                         MWST.cap(lieu) / MWST.total(lieu) / MWST.free(lieu)
   MWST.add(lieu,id,n=1)               range n pièces (dans la limite de la capacité) → nombre rangé
   MWST.take(lieu,id,n=1)              retire n pièces du stock → vrai si elles y étaient toutes
   MWST.order(lieu,{id:n},mode,opt)    commande en ligne : mode 'next' (demain 9 h) | 'express' → {ok,why,ord} ; paie selon MWST.payer(lieu)
   MWST.orderFor(lieu,ids,opt)         commande une pièce de chaque id manquant (livraison du lendemain) → {ok,why,ord,manque}
   MWST.pending(lieu)                  commandes en cours [{id,lieu,items,due,mode,cout}] ; MWST.pendQty(lieu,id)
   MWST.payer(lieu)                    'emp' (l'employeur paie) | 'biz' (compte du garage) | 'perso' | null (pas d'accès)
   MWST.lieuDeTravail()                lieu où travaille le joueur (garage de l'employeur) ou null
   MWST.common(id)                     pièce « courante » (réapprovisionnée chaque matin pour un salarié)
   MWST.site(lieu)                     ouvre le site de commande ; MWST.panel(lieu) ouvre l'état du stock
   MWST.restock(lieu)                  réapprovisionnement du matin (pièces courantes) ; MWST.tick() livre les commandes arrivées
   MWST.dueText(due)                   « demain à 9 h », « aujourd'hui à 14 h 30 »…
   Données sauvegardées : MW.S.reserve = {lieux:{garageN:{p:{id:n}}}, cmd:[commandes], seq}. */
const MWST=(()=>{
const api={};
const CAP={garage1:60,garage2:120,garage3:100,garage4:80,garage5:50,garage6:90,garage7:160};
const HOMES=['appart','loge1','loge2','loge3','loge4'];
const FRAIS={next:6,express:18},WEB=.92,H9=540,H_EXP_MAX=1020,EXP_MIN=90;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const r2=x=>Math.round(x*100)/100,fmt=x=>MW.fmt(x);
const isHome=z=>HOMES.includes(z),isGarage=z=>/^garage\d$/.test(z);
const NOM={garage1:'Garage du Coin',garage2:'Ventoux',garage3:'Maison Aurèle',garage4:'Scuderia Brivio',garage5:'Atelier de la Rue Basse',garage6:'Garage Delmas',garage7:"Grand Garage de l'Esplanade",appart:'le studio',loge1:'la maison de ville',loge2:"l'appartement du Centre",loge3:'le pavillon',loge4:'la villa'};
const nomLieu=z=>{try{const q=MW.zone(z);if(q&&q.nom) return q.nom;}catch(e){}return NOM[z]||z;};
const guest=()=>!!(MW.net&&MW.net.live&&MW.net.guest);
let mirror=null;
const P=()=>MWJ.PARTS,PL=()=>MWJ.PARTS_LIST;
/* ── état ── */
function R(){const s=MW.S;if(!s.reserve||typeof s.reserve!=='object') s.reserve={lieux:{},cmd:[],seq:0};const r=s.reserve;if(!r.lieux) r.lieux={};if(!r.cmd) r.cmd=[];if(r.seq==null) r.seq=0;return r;}
const D=()=>guest()?(mirror||(mirror={lieux:{},cmd:[],seq:0})):R();
const common=id=>{const p=P()[id];if(!p) return false;try{if(MWJ.STOCK1&&MWJ.STOCK1.includes(id)) return true;}catch(e){}return p.niv<=2&&p.prix<=80;};
api.common=common;
/* ── capacité, quantités ── */
function homeChest(z){try{const o=MWI.state();return o.stock[z]||(o.stock[z]=[]);}catch(e){return [];}}
api.cap=z=>{if(isHome(z)){try{return MWI.cap(z)||0;}catch(e){return 0;}}return CAP[z]||40;};
function lieu(z){const d=D();let l=d.lieux[z];if(!l){l=d.lieux[z]={p:{}};if(!guest()) init(z,l);}return l;}
function init(z,l){ /* stock de départ raisonnable : pièces courantes, et de quoi faire les travaux lourds dans les grands garages */
 const cap=api.cap(z),com=PL().filter(p=>common(p.id)),rare=PL().filter(p=>!common(p.id)),n=z==='garage1'?4:(z==='garage5'||z==='garage6'||z==='garage7')?3:5;let t=0;
 const put=(id,k)=>{const m=Math.min(k,cap-t);if(m>0){l.p[id]=(l.p[id]||0)+m;t+=m;}};
 for(const p of com) put(p.id,n);
 if(z==='garage2'||z==='garage3'||z==='garage4') for(const p of rare) put(p.id,1);}
api.qty=(z,id)=>{if(isHome(z)) return homeChest(z).filter(it=>it&&it.k==='neuve'&&it.id===id).length;return (lieu(z).p[id])||0;};
api.total=z=>{if(isHome(z)) return homeChest(z).filter(it=>it&&it.k==='neuve').length;const p=lieu(z).p;let t=0;for(const k in p) t+=p[k]||0;return t;};
const pendTot=z=>D().cmd.filter(c=>c.lieu===z).reduce((a,c)=>a+Object.values(c.items).reduce((s,x)=>s+x,0),0);
api.free=z=>{if(isHome(z)){const st=homeChest(z);return Math.max(0,api.cap(z)-st.length);}return Math.max(0,api.cap(z)-api.total(z));};
api.pendQty=(z,id)=>D().cmd.filter(c=>c.lieu===z).reduce((a,c)=>a+(c.items[id]||0),0);
api.pending=z=>D().cmd.filter(c=>!z||c.lieu===z);
api.get=z=>{const parts={};for(const p of PL()){const q=api.qty(z,p.id);if(q) parts[p.id]=q;}const pend={};for(const c of D().cmd) if(c.lieu===z) for(const id in c.items) pend[id]=(pend[id]||0)+c.items[id];
 return {parts,total:api.total(z),cap:api.cap(z),free:api.free(z),pend};};
function sync(){if(guest()||!(MW.net&&MW.net.live)) return;try{MWNET.sendTo({t:'stk',s:JSON.parse(JSON.stringify(R()))});}catch(e){}}
function req(m){try{MWNET.sendTo(Object.assign({t:'stkq'},m));}catch(e){}}
api.add=(z,id,n)=>{n=n||1;if(!P()[id]) return 0;const m=Math.min(n,api.free(z));if(m<=0) return 0;
 if(isHome(z)){const st=homeChest(z);for(let i=0;i<m;i++) st.push({k:'neuve',id,src:'stock'});return m;}
 const l=lieu(z);l.p[id]=(l.p[id]||0)+m;if(guest()) req({op:'add',z,id,n:m});else sync();return m;};
api.take=(z,id,n)=>{n=n||1;if(api.qty(z,id)<n) return false;
 if(isHome(z)){const st=homeChest(z);for(let k=0;k<n;k++){const i=st.findIndex(it=>it&&it.k==='neuve'&&it.id===id);if(i>=0) st.splice(i,1);}return true;}
 const l=lieu(z);l.p[id]-=n;if(l.p[id]<=0) delete l.p[id];if(guest()) req({op:'take',z,id,n});else sync();return true;};
/* ── lieu de travail et payeur ── */
const emp=()=>{try{return MWC.employer();}catch(e){return null;}};
api.lieuDeTravail=()=>{const e=emp();return e&&e.id!=='aucun'&&e.zone?e.zone:null;};
api.payer=z=>{if(isHome(z)) return 'perso';const e=emp();if(!e||e.zone!==z) return null;return (e.compte||e.net)?'biz':'emp';};
const cash=k=>k==='biz'?(typeof MWS!=='undefined'?MWS.cash():MW.S.money):MW.S.money;
const pay=(k,x,motif)=>{if(k==='biz'&&typeof MWS!=='undefined') MWS.biz(-x,motif);else MW.money(-x,motif);};
/* ── délais ── */
const dayEff=()=>MW.S.min<360?MW.S.day-1:MW.S.day;
const absT=()=>MW.S.day*1440+(MW.S.min<360?MW.S.min+1440:MW.S.min);
const nextMorning=()=>(dayEff()+1)*1440+H9;
api.dueText=due=>{const d=Math.floor(due/1440),m=due%1440,h=Math.floor(m/60),mm=m%60,hh=h+' h'+(mm?' '+String(mm).padStart(2,'0'):'');return (d===dayEff()?"aujourd'hui":d===dayEff()+1?'demain':'jour '+d)+' à '+hh;};
const dueOf=mode=>{if(mode==='express'){const t=absT(),lim=dayEff()*1440+H_EXP_MAX;return t<=lim?t+EXP_MIN:nextMorning();}return nextMorning();};
const expressOK=z=>api.payer(z)!=='emp'&&absT()<=dayEff()*1440+H_EXP_MAX;
const wprice=id=>Math.max(1,Math.round(P()[id].prix*WEB*100)/100);
/* ── commande ── */
api.order=(z,items,mode,opt)=>{opt=opt||{};mode=mode==='express'?'express':'next';
 const k=opt.payer||api.payer(z);if(!k) return {ok:false,why:'Cet ordinateur est réservé au personnel du garage.'};
 if(mode==='express'&&k==='emp') mode='next';
 const ids=Object.keys(items).filter(id=>P()[id]&&items[id]>0);if(!ids.length) return {ok:false,why:'Le panier est vide.'};
 const n=ids.reduce((a,id)=>a+items[id],0);
 if(n>api.free(z)-pendTot(z)) return {ok:false,why:`Pas assez de place dans le stock de ${nomLieu(z)} : ${Math.max(0,api.free(z)-pendTot(z))} place(s) libre(s) pour ${n} pièce(s).`};
 let cout=0;if(k!=='emp'){for(const id of ids) cout+=wprice(id)*items[id];cout=r2(cout+FRAIS[mode]);if(cash(k)<cout) return {ok:false,why:`Il manque ${fmt(r2(cout-cash(k)))} (${k==='biz'?'compte du garage':'votre argent'}).`};}
 if(cout) pay(k,cout,'Pièces Auto Express : commande en ligne');
 const ord={id:'c'+(++D().seq),lieu:z,items:Object.fromEntries(ids.map(id=>[id,items[id]])),due:dueOf(mode),mode,cout,payer:k,jour:MW.S.day};
 if(guest()){req({op:'order',z,items:ord.items,mode,payer:'emp'});return {ok:true,ord};}
 D().cmd.push(ord);sync();return {ok:true,ord};};
api.orderFor=(z,ids,opt)=>{const need={};for(const id of ids) if(!(api.qty(z,id)+api.pendQty(z,id)>=1+(need[id]||0))) need[id]=1;
 const manque=Object.keys(need);if(!manque.length) return {ok:true,manque:[],ord:null};
 const r=api.order(z,need,'next',opt);return Object.assign({manque},r);};
/* ── livraison ── */
function deliver(c){const l=nomLieu(c.lieu);let n=0;for(const id in c.items) n+=api.add(c.lieu,id,c.items[id]);
 const t=Object.keys(c.items).map(id=>`${c.items[id]} × ${P()[id].nom.toLowerCase()}`).join(', ');
 MW.toast(`Livraison reçue à ${l} : ${t}.`,'good');MW.emit('stockLivre',c);}
api.tick=()=>{if(guest()||!MW.S) return;const d=R(),t=absT();let ch=false;
 for(const c of d.cmd.slice()) if(c.due<=t){d.cmd.splice(d.cmd.indexOf(c),1);deliver(c);ch=true;}
 if(ch) sync();vanStep();};
/* ── réapprovisionnement du matin (salarié) ── */
api.restock=z=>{if(guest()) return 0;let n=0;const tgt=z==='garage1'?4:5;
 for(const p of PL()){if(!common(p.id)) continue;const q=api.qty(z,p.id),m=Math.min(tgt-q,api.free(z)-pendTot(z));if(m>0) n+=api.add(z,p.id,m);}return n;};
function matin(){if(guest()||!MW.S) return;const z=api.lieuDeTravail();if(!z||!isGarage(z)||api.payer(z)!=='emp') return;
 const n=api.restock(z);if(n) MW.toast(`${nomLieu(z)} : l'employeur a réapprovisionné les pièces courantes (${n}).`,'info');}
/* un client apporte un travail précis : l'employeur commande ce qui manque (livraison demain 9 h) ; les pannes se diagnostiquent d'abord */
function jobNew(c){if(guest()||!c||c.noir||c.zone!==api.lieuDeTravail()||api.payer(c.zone)!=='emp'||c.type!=='travaux') return;
 const r=api.orderFor(c.zone,c.ordre.filter(id=>c.parts[id]&&!c.parts[id].na));
 if(r.ord) MW.toast(`${nomLieu(c.zone)} commande ${r.manque.map(id=>P()[id].nom.toLowerCase()).join(', ')} : livraison ${api.dueText(r.ord.due)}. ${c.client} attend.`,'info');}
/* ── camionnette de livraison ── */
let van=null,vanNear=null;
function buildVan(){const T=MW.THREE,g=new T.Group(),m=(w,h,d,x,y,z,c)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:c}));o.position.set(x,y,z);g.add(o);return o;};
 m(2.1,2.0,4.0,0,1.5,-.6,0xf2f2ee);m(2.0,1.3,1.4,0,1.15,1.9,0xf2f2ee);m(1.9,.6,.1,0,1.5,2.62,0x7ab0d8);m(2.12,.3,4.02,0,.6,-.6,0xe8b81c);
 for(const x of [-1,1]) for(const z of [-1.6,1.6]){const w=new T.Mesh(new T.CylinderGeometry(.42,.42,.3,12),new T.MeshLambertMaterial({color:0x1a1a1c}));w.rotation.z=Math.PI/2;w.position.set(x*1.0,.42,z);g.add(w);}
 g.visible=false;MW.scene.add(g);return g;}
function vanStep(){if(!MW.S||!MW.scene) return;const t=absT();let best=null;
 for(const c of D().cmd) if(c.due-20<=t&&c.due>t-1){const z=MW.zone(c.lieu);if(z&&z.door&&(!best||c.due<best.due)) best={c,z};}
 if(best&&!van) van=buildVan();if(!van) return;
 if(!best){van.visible=false;return;}
 const z=best.z,out={x:-z.n.x,z:-z.n.z},lat={x:Math.abs(z.n.z),z:Math.abs(z.n.x)};
 van.position.set(z.door.x+out.x*8+lat.x*7,0,z.door.z+out.z*8+lat.z*7);van.rotation.y=Math.atan2(lat.x,lat.z);van.visible=true;}
/* ── interface : site de commande ── */
const btn=(a,t,cls,dis)=>`<button type="button" class="btn sm${cls?' '+cls:''}" data-mw="${a}"${dis?' disabled':''}>${t}</button>`;
let cart={},mode='next',tab='tout',cur=null;
function payerTxt(z){const k=api.payer(z);return k==='emp'?`<b>Payé par l'employeur</b> (livraison du lendemain seulement ; vous ne payez rien).`:k==='biz'?`Payé par le <b>compte du garage</b> : ${fmt(cash('biz'))} disponibles.`:`Payé avec <b>votre argent</b> : ${fmt(MW.S.money)}.`;}
function site(z){
 const k=api.payer(z);if(!k){MW.toast('Cet ordinateur est réservé au personnel du garage.','warn');return;}
 if(cur!==z){cur=z;cart={};mode='next';}
 if(mode==='express'&&!expressOK(z)) mode='next';
 const n=Object.values(cart).reduce((a,x)=>a+x,0),sub=Object.keys(cart).reduce((a,id)=>a+wprice(id)*cart[id],0),fee=k==='emp'?0:FRAIS[mode],tot=r2(sub+fee);
 const dd=api.dueText(dueOf(mode));
 let h=`<p class="hint">Site de livraison <b>Pièces Auto Express</b> pour <b>${esc(nomLieu(z))}</b>. ${payerTxt(z)} Stock : <b>${api.total(z)}/${api.cap(z)}</b>${pendTot(z)?` (+ ${pendTot(z)} en commande)`:''}.</p>`;
 const pend=api.pending(z);if(pend.length) h+=`<p class="mw-soon">En cours de livraison : ${pend.map(c=>Object.keys(c.items).map(id=>c.items[id]+' × '+esc(P()[id].nom.toLowerCase())).join(', ')+' — '+api.dueText(c.due)).join(' · ')}.</p>`;
 h+=`<div class="mw-btns">${btn('tab:tout','Tout',tab==='tout'?'':'ghost')}${btn('tab:courant','Pièces courantes',tab==='courant'?'':'ghost')}${btn('tab:rare','Pièces rares',tab==='rare'?'':'ghost')}${btn('tab:manque','À réapprovisionner',tab==='manque'?'':'ghost')}</div>`;
 const list=PL().filter(p=>tab==='tout'||(tab==='courant'&&common(p.id))||(tab==='rare'&&!common(p.id))||(tab==='manque'&&api.qty(z,p.id)+api.pendQty(z,p.id)<=0));
 h+=list.map(p=>{const q=api.qty(z,p.id),c=cart[p.id]||0,pe=api.pendQty(z,p.id);
  return `<div class="mw-prt"><div class="mw-prt-h"><b>${esc(p.nom)}</b><span class="mw-tag${q?' ok':' warn'}">${q} en stock</span><span class="mw-tag">${k==='emp'?'fourni':fmt(wprice(p.id))}</span></div><small>${esc(MWJ.SK_NOM[p.comp])} niv. ${p.niv}${pe?' · '+pe+' en commande':''}${c?' · panier : '+c:''}</small><div class="mw-btns">${btn('add:'+p.id,'+1')}${btn('add5:'+p.id,'+5','ghost')}${btn('sub:'+p.id,'−1','ghost',!c)}</div></div>`;}).join('')||'<p class="hint">Rien à afficher ici.</p>';
 h+=`<div class="mw-card"><b>Panier : ${n} pièce${n>1?'s':''}</b><br><small>Pièces ${k==='emp'?'(fournies par l\'employeur)':fmt(r2(sub))} · livraison ${k==='emp'?'(offerte)':fmt(fee)}</small><div class="mw-btns">${btn('mode:next',`Demain à 9 h${k==='emp'?'':' ('+fmt(FRAIS.next)+')'}`,mode==='next'?'':'ghost')}${k!=='emp'?btn('mode:express',`Express ${expressOK(z)?'· '+fmt(FRAIS.express):'(avant 17 h)'}`,mode==='express'?'':'ghost',!expressOK(z)):''}</div><small>Livraison prévue : ${dd}.</small><div class="mw-btns">${btn('cmd','Commander'+(k==='emp'?'':' · '+fmt(tot)),'',!n)}${btn('clr','Vider le panier','ghost',!n)}${btn('close','Fermer','ghost')}</div></div>`;
 MW.panel('Pièces Auto Express · '+nomLieu(z),h,{wide:true,onClick:a=>{const [c,id]=a.split(':');
  if(c==='add') cart[id]=(cart[id]||0)+1;else if(c==='add5') cart[id]=(cart[id]||0)+5;else if(c==='sub'){cart[id]=Math.max(0,(cart[id]||0)-1);if(!cart[id]) delete cart[id];}
  else if(c==='tab') tab=id;else if(c==='mode') mode=id;else if(c==='clr') cart={};
  else if(c==='cmd'){const r=api.order(z,cart,mode);if(!r.ok){MW.toast(r.why,'warn');}else{MW.toast(`Commande passée : livraison ${api.dueText(r.ord.due)}${r.ord.cout?' ('+fmt(r.ord.cout)+')':''}.`,'good');cart={};}}
  else if(c==='close'){MW.closePanel();return;}
  site(z);}});}
api.site=site;
api.panel=z=>{const g=api.get(z);MW.panel('Stock · '+nomLieu(z),`<p>${g.total}/${g.cap} pièces.</p>`+Object.keys(g.parts).map(id=>`<div class="mw-row"><span>${esc(P()[id].nom)}</span><b>${g.parts[id]}</b></div>`).join('')+`<div class="mw-btns"><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`,{onClick:()=>MW.closePanel()});};
/* ── ordinateurs : un par garage ── */
function start(){if(start.done) return;start.done=true;
 for(const z of MW.zones) if(isGarage(z.id)&&z.pc) MW.addInteract({id:'mst:pc:'+z.id,x:z.pc.x,z:z.pc.z,r:1.5,label:'Ordinateur · commander des pièces (Pièces Auto Express)',use:()=>site(z.id)});}
MW.on('start',()=>{start();api.tick();});
MW.on('minute',api.tick);
MW.on('day',()=>{matin();api.tick();});
MW.on('jobNew',jobNew);
/* ── réseau (à deux) : l'hôte fait autorité ── */
api.onNet=m=>{if(m.t==='stk'&&guest()) mirror=m.s;
 else if(m.t==='stkq'&&MW.net&&MW.net.live&&!guest()){const z=m.z;if(m.op==='add'){const l=lieu(z);if(api.free(z)>0) l.p[m.id]=(l.p[m.id]||0)+Math.min(m.n,api.free(z));}
  else if(m.op==='take'){const l=lieu(z);l.p[m.id]=Math.max(0,(l.p[m.id]||0)-m.n);if(!l.p[m.id]) delete l.p[m.id];}
  else if(m.op==='order') api.order(z,m.items,m.mode,{payer:'emp'});
  sync();}};
setInterval(()=>{try{if(MW.S&&MW.net&&MW.net.live&&!guest()) sync();}catch(e){}},3000);
api.R=R;
return api;
})();
window.__mwst=MWST;
