'use strict';
/* ───────────── Mode « Mécanicien » — LE DESSOUS DE LA VOITURE (repères et contrôle des formes) ─────────────

   Ce module répond à deux besoins quand on est accroupi sous une voiture levée :

   1. Où se trouvent les pièces du dessous ? `MWUD.boites(g)` rend, pour une voiture dont le compartiment moteur est construit
      (js/44, engineMesh), la boîte englobante de chaque grande pièce visible d'en dessous, dans le repère de la voiture :
        moteur, boîte de vitesses (cloche, carter, support, câbles, carter-pan…), berceau avant, traverse de boîte, tunnel, protection.
      Le scénario de test « dessous » s'en sert pour vérifier qu'aucune pièce n'en traverse une autre.

   2. La protection sous moteur (tôle boulonnée sous la partie avant du moteur, que le joueur peut déposer) : sa forme et la
      position de ses vis sont calculées ici (`MWUD.plaque`) ; ses gestes sont dans js/46u.

   ═══ API `MWUD` ═══
   MWUD.moteurPret(g)     vrai si le moteur de la baie est construit (la voiture est levée ou son capot ouvert)
   MWUD.plaque(g)         {boite:Box3, centre:Vector3, taille:[l,h,p], vis:[Vector3 ×4]} ou null (voiture électrique)
   MWUD.boites(g)         {nom: Box3} en repère voiture, avec les noms ci-dessus
   MWUD.contacts(g)       liste des paires de pièces dont les boîtes se traversent (marge 1,5 cm) : [[nomA, nomB, pénétration en mètres]] */
const MWUD=(()=>{
const T=THREE;
const MARGE=.015;

const baie=g=>(g&&g.userData&&g.userData.bay)||null;
const moteurPret=g=>!!baie(g);

/* Protection sous moteur : sur la moitié du moteur la plus éloignée de l'habitacle, entre le moteur et le berceau, sans recouvrir le carter
   d'huile (le bouchon de vidange doit rester accessible). */
function plaque(g){
 const b=baie(g);
 if(!b||!b.userData.bbox||g.userData.car.ev) return null;
 const bb=b.userData.bbox,avant=!g.userData.G.rearLid?1:-1;
 const profondeur=(bb.max.z-bb.min.z)*.38,demi=Math.min(.26,(bb.max.x-bb.min.x)/2-.04);
 const z0=avant>0?bb.max.z-profondeur:bb.min.z,z1=avant>0?bb.max.z:bb.min.z+profondeur;
 const cx=(bb.min.x+bb.max.x)/2,yBas=bb.min.y-.036,epaisseur=.012;
 const boite=new T.Box3(new T.Vector3(cx-demi,yBas,z0),new T.Vector3(cx+demi,yBas+epaisseur,z1));
 const vis=[];
 for(const x of [cx-demi+.03,cx+demi-.03]) for(const z of [z0+.03,z1-.03]) vis.push(new T.Vector3(x,yBas-.004,z));
 return {boite,centre:boite.getCenter(new T.Vector3()),taille:[2*demi,epaisseur,z1-z0],vis};}

/* Berceau avant (deux longerons et deux traverses, pas un bloc plein : le moteur passe entre les longerons), tunnel, traverse de boîte.
   Mêmes cotes que js/44c (ysub, positions, épaisseurs). Le tunnel lit ses extrémités calculées par js/44c (ancres tunnelZ0 et tunnelZ1). */
function structure(g){
 const G=g.userData.G,gc=G.gc,ysub=gc+.055,afz=G.afz,boites={},V=(x,y,z)=>new T.Vector3(x,y,z);
 const h=.0325+.03;   /* demi-hauteur : barre de .065 et têtes de vis de fixation */
 for(const sg of [-1,1]) boites['berceau.longeron'+(sg>0?'D':'G')]=new T.Box3(V(sg*.3-.0375,ysub-.0325,afz-.43),V(sg*.3+.0375,ysub+h,afz+.43));
 boites['berceau.traverseAv']=new T.Box3(V(-.34,ysub-.03,afz+.4-.0425),V(.34,ysub+.03,afz+.4+.0425));
 boites['berceau.traverseAr']=new T.Box3(V(-.34,ysub-.03,afz-.42-.0425),V(.34,ysub+.03,afz-.42+.0425));
 const A=g.userData.G.ch.anchors,z0=A.tunnelZ0?A.tunnelZ0[2]:null,z1=A.tunnelZ1?A.tunnelZ1[2]:null;
 if(z0!=null&&z1!=null) boites.tunnel=new T.Box3(V(-.15,gc+.055,z0),V(.15,gc+.145,z1));
 const car=g.userData.car;
 if(car.loc==='front'&&car.ori!=='T'&&!car.ev) boites.traverseBoite=new T.Box3(V(-.275,gc+.0225,afz-.93-.04),V(.275,gc+.1,afz-.93+.04));
 return boites;}

function boites(g){
 const b=baie(g);
 if(!b) return {};
 const u=b.userData,res={};
 if(u.bbox) res.moteur=u.bbox.clone();
 for(const k in (u.gbxBoites||{})) res['boite.'+k]=u.gbxBoites[k].clone();
 const s=structure(g);
 for(const k in s) res[k]=s[k];
 const p=plaque(g);
 if(p) res.protection=p.boite;
 return res;}

/* Paires de pièces qui se traversent. Une pièce qui touche sa voisine (bride contre bride) n'est pas une collision : on tolère 1,5 cm.
   Les sous-pièces d'une même boîte sont dessinées pour s'emboîter (cloche et carter, support sur le carter) : on ne les compare pas entre elles. */
function contacts(g){
 const bx=boites(g),noms=Object.keys(bx),res=[];
 const famille=n=>n.split('.')[0];
 const memeBoite=(a,c)=>famille(a)===famille(c)&&a.indexOf('.')>0;
 for(let i=0;i<noms.length;i++) for(let j=i+1;j<noms.length;j++){
  const a=noms[i],c=noms[j];
  if(memeBoite(a,c)) continue;
  const A=bx[a],B=bx[c];
  const dx=Math.min(A.max.x,B.max.x)-Math.max(A.min.x,B.min.x);
  const dy=Math.min(A.max.y,B.max.y)-Math.max(A.min.y,B.min.y);
  const dz=Math.min(A.max.z,B.max.z)-Math.max(A.min.z,B.min.z);
  const pen=Math.min(dx,dy,dz);
  if(dx>0&&dy>0&&dz>0&&pen>MARGE) res.push([a,c,+pen.toFixed(3)]);}
 return res;}

return {moteurPret,plaque,boites,contacts,structure,MARGE};
})();
window.__mwud=MWUD;
