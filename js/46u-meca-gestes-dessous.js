'use strict';
/* ───────────── Mode « Mécanicien » — GESTES DU DESSOUS : protection sous moteur ─────────────

   Sous le moteur d'une voiture levée se trouve une tôle de protection boulonnée (quatre vis). Le joueur peut la déposer, puis la
   reposer : c'est un petit travail d'accès, utile avant de toucher aux pièces qu'elle recouvre.

   Ce module s'accroche à js/46 par `MWG.builders` (liste des constructeurs de procédures) et `MWG.kit` (outils partagés : maillages,
   cibles, état par voiture). Il ne modifie aucune autre fonction de js/46, à part le contrôle de fin de travail (`blocage`) qui
   lit l'état `g.sk` pour refuser de rendre une voiture dont la protection n'est pas remontée.

   État par voiture (c.g.sk) :  { on : la tôle est posée (1) ou déposée (0),  f : [4 vis, 1 = serrée] }

   Gestes, dans l'ordre :
     1. dévisser les quatre vis (cliquet, douille « clip »),
     2. déposer la protection (à la main),
     3. la reposer (à la main),
     4. revisser les quatre vis. */
(function installerProtection(){
if(typeof MWG==='undefined'||!MWG.builders||!MWG.kit||typeof MWUD==='undefined') return;
const K=MWG.kit,T=K.T;

function construire(R){
 const {c,g}=R;
 if(!c.mdl||(MWCARS.get(c.mdl)||{}).ev) return;
 const F=K.GS(c);
 const etat=F.sk||(F.sk={on:1,f:[1,1,1,1]});
 const geometrie=()=>MWUD.plaque(g);
 const levee=()=>K.liftedNow(c)&&MWUD.moteurPret(g);
 const sock=K.sockOf(c,'clip');

 /* la tôle et ses quatre vis, créées quand le moteur de la baie existe (le rig est reconstruit à ce moment, voir js/46) */
 const plaque=new T.Object3D();
 R.root.add(plaque);
 const vis=[0,1,2,3].map(()=>{const o=new T.Object3D();R.root.add(o);return o;});
 let meshPlaque=null;
 const poser=()=>{
  const p=geometrie();
  if(!p) return false;
  if(!meshPlaque){
   meshPlaque=K.bx(p.taille[0],p.taille[1],p.taille[2],0x3a3e44,0,0,0,'p');
   plaque.add(meshPlaque);
   for(let i=0;i<4;i++){const h=K.hex(.011,.012,0xcfd4d9,0,0,0);vis[i].add(h);vis[i].userData.h=h;}}
  plaque.position.copy(p.centre);
  vis.forEach((o,i)=>o.position.copy(p.vis[i]));
  return true;};

 R.add({id:'sk:plaque',o:plaque,r:.07,vis:()=>levee()&&poser(),name:'Protection sous moteur',acts:()=>{
  const dessus=etat.f.every(v=>!v);
  if(etat.on) return [{key:'skoff',lab:'Déposer la protection sous moteur',tool:'main',hold:.7,snd:'clunk',ord:62,
   why:dessus?null:'Dévissez d\'abord les quatre vis de la protection.',do:()=>{etat.on=0;}}];
  return [{key:'skon',lab:'Reposer la protection sous moteur',tool:'main',hold:.7,snd:'clunk',ord:64,do:()=>{etat.on=1;}}];}});

 vis.forEach((o,i)=>R.add({id:'sk:vis:'+i,o,r:.025,vis:()=>levee()&&poser(),name:'Vis de la protection sous moteur',acts:()=>{
  if(etat.f[i]) return [{key:'skvo'+i,lab:'Dévisser la vis de la protection',tool:'cliquet',sock,hold:.8,snd:'ratchet',ord:61,
   do:()=>{etat.f[i]=0;K.binAdd('vis');}}];
  return [{key:'skvr'+i,lab:'Revisser la vis de la protection',tool:'cliquet',sock,hold:.8,snd:'ratchet',ord:65,
   why:etat.on?null:'Reposez d\'abord la protection.',do:()=>{etat.f[i]=1;K.binTake('vis');}}];}}));

 R.blk.lower.push(()=>etat.on&&etat.f.every(Boolean)?null:'Remontez la protection sous le moteur et ses quatre vis avant de baisser le pont.');

 R.procs.push({id:'protection',vis:()=>{
  plaque.visible=!!etat.on;
  vis.forEach((o,i)=>{const h=o.userData.h;if(h) h.visible=!!etat.f[i];});}});}

MWG.builders.push(construire);
})();
