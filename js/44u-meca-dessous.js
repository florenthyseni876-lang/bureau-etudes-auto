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

/* Berceau avant et tunnel : mêmes cotes que js/44c (ysub, positions de la traverse, du tunnel). */
function structure(g){
 const G=g.userData.G,gc=G.gc,ysub=gc+.055,afz=G.afz,arz=G.arz,boites={};
 boites.berceau=new T.Box3(new T.Vector3(-.34,ysub-.033,afz-.46),new T.Vector3(.34,ysub+.12,afz+.45));
 const milieu=(afz+arz)/2,demi=Math.abs(afz-arz)*.39;
 boites.tunnel=new T.Box3(new T.Vector3(-.15,gc+.055,milieu-demi),new T.Vector3(.15,gc+.145,milieu+demi));
 if(g.userData.car.loc==='front'&&g.userData.car.ori!=='T'&&!g.userData.car.ev){
  const z=afz-.93;
  boites.traverseBoite=new T.Box3(new T.Vector3(-.275,gc+.0225,z-.04),new T.Vector3(.275,gc+.1,z+.04));}
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
 const memeBoite=(a,c)=>a.indexOf('boite.')===0&&c.indexOf('boite.')===0;
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
