'use strict';
/* ───────────── Boîtes de vitesses (mode Mécanicien) ─────────────

   Ce module décrit et dessine les boîtes de vitesses des voitures réelles de js/44 (catalogue MWCARS).

   Comment ça marche
   -----------------
   1. `MWBOX.specOf(voiture)` choisit la famille de boîte d'après la fiche de la voiture (champ `gb` : man, auto, dct, ev)
      et lui associe des données d'entretien (capacité d'huile, intervalle, type d'huile, boîte sèche ou humide…).
   2. `MWBOX.build(spec, options)` construit la géométrie dans un repère propre à la boîte :
        - l'origine est le centre de la bride côté moteur,
        - +X s'éloigne du moteur (c'est l'axe de la boîte), +Y est le haut, Z est le côté,
        - les unités sont des mètres.
      Le résultat est {pieces, ancres, boites, longueur} :
        - `pieces`  : liste {cle, geo} ; `cle` est le nom d'une matière de la baie (js/44, BAYM) ; js/44 fusionne par matière,
        - `ancres`  : points utiles aux gestes (bouchons, support, câbles, sorties de cardans, refroidisseur…),
        - `boites`  : boîtes englobantes des sous-pièces {nom: {min:[x,y,z], max:[x,y,z]}} pour vérifier qu'elles ne se traversent pas.
   3. js/44 (engineMesh) place la boîte contre le moteur, puis js/46 pose les cibles de gestes sur les ancres.

   Familles
   --------
     man  : boîte manuelle 5 ou 6 rapports (cloche d'embrayage, carter, couvercle de sélection, câbles de commande)
     auto : automatique à convertisseur (grande cloche, carter-pan profond, tuyaux de refroidisseur, tube de remplissage)
     dct  : double embrayage (cloche large, bloc mécatronique au-dessus), sèche ou à bain d'huile
     ev   : réducteur de voiture électrique (un seul rapport)

   Les capacités d'huile et les intervalles sont des valeurs usuelles arrondies (`approx` vaut vrai) : elles servent au jeu,
   pas de référence constructeur. */
const MWBOX=(()=>{
const T=THREE,PI=Math.PI;

/* ═══════════ 1. Données d'entretien ═══════════ */
/* Capacité totale de la boîte (litres), part vidangée en entretien, intervalle conseillé (km), huile. */
const FAMILLES={
 man5:{type:'man',nom:'Boîte manuelle 5 rapports',huileL:2.0,vidL:2.0,km:120000,huile:'75W-80',longueur:.40},
 man6:{type:'man',nom:'Boîte manuelle 6 rapports',huileL:2.2,vidL:2.2,km:120000,huile:'75W-80',longueur:.42},
 auto:{type:'auto',nom:'Boîte automatique à convertisseur',huileL:8.0,vidL:4.5,km:80000,huile:'ATF',longueur:.46,filtre:true,refroidisseur:true},
 dctSec:{type:'dct',nom:'Boîte à double embrayage à sec',huileL:1.7,vidL:1.7,km:60000,huile:'G 052 529',longueur:.40,sec:true},
 dctHum:{type:'dct',nom:"Boîte à double embrayage à bain d'huile",huileL:6.8,vidL:5.5,km:60000,huile:'DCTF',longueur:.44,filtre:true,refroidisseur:true},
 ev:{type:'ev',nom:'Réducteur à un rapport',huileL:1.1,vidL:1.1,km:150000,huile:'ATF EV',longueur:.30}};

/* Cas particuliers par voiture : famille, code de la boîte. Le reste suit la fiche (nombre de rapports, type de boîte). */
const CAS={
 golf7:['man5','MQ200'],tiguan2:['dctHum','DQ500'],octavia4:['dctSec','DQ200'],p3008:['auto','AWF8'],xc60:['auto','TG-81'],
 bmw320d:['auto','8HP'],c220d:['auto','9G-Tronic'],a4b9:['dctHum','DL382'],a6c8:['auto','8HL'],p911:['dctHum','PDK 8'],a110:['dctHum','7DCT'],
 rs3:['dctHum','DQ380'],huracan:['dctHum','LDF'],zoe:['ev','Réducteur'],mustang:['man6','Tremec TR-3160'],m3g80:['man6','Getrag 6MT'],
 cayman:['man6','Getrag 6MT'],meganers:['man6','TL8'],golfgti:['man6','MQ350'],gryaris:['man6','iMT'],clio4:['man5','JR5'],p208:['man5','BE4'],
 c3:['man5','BE4'],sandero:['man5','JH3'],kangoo2:['man5','JH3'],partner2:['man5','MA5'],fiat500:['man5','C510'],p206:['man5','BE4'],yaris3:['man5','C50']};

/* Fiche d'entretien et de forme d'une boîte : lit la voiture (objet de MWCARS ou identifiant). */
function specOf(voiture){
 const car=typeof voiture==='string'&&typeof MWCARS!=='undefined'?MWCARS.get(voiture):voiture;
 if(!car) return null;
 let fam=CAS[car.id]?CAS[car.id][0]:null;
 if(!fam){
  if(car.ev||car.gb==='ev') fam='ev';
  else if(car.gb==='auto') fam='auto';
  else if(car.gb==='dct') fam=car.eng&&car.eng.nm>300?'dctHum':'dctSec';
  else fam=car.gears>=6?'man6':'man5';}
 const base=FAMILLES[fam];
 const spec=Object.assign({fam,code:CAS[car.id]?CAS[car.id][1]:'',approx:true,gears:car.gears||(base.type==='man'?5:7)},base);
 /* grosse voiture : un peu plus d'huile */
 if(car.mass>1700&&spec.type!=='ev') spec.huileL=+(spec.huileL*1.15).toFixed(1);
 spec.transversale=car.ori==='T';
 spec.traction=car.drive==='fwd'||car.drive==='awd';
 return spec;}

/* ═══════════ 2. Petit constructeur de géométrie ═══════════ */
function Constructeur(){
 const pieces=[],boites={};
 let nomCourant='boite';
 const m4=new T.Matrix4();
 /* ajoute une géométrie ; la matrice place l'objet ; la boîte englobante est cumulée sous le nom de la sous-pièce courante */
 function ajouter(cle,geo,x,y,z,rx,ry,rz){
  m4.compose(new T.Vector3(x||0,y||0,z||0),new T.Quaternion().setFromEuler(new T.Euler(rx||0,ry||0,rz||0,'YXZ')),new T.Vector3(1,1,1));
  geo.applyMatrix4(m4);
  geo.computeBoundingBox();
  const bb=geo.boundingBox,b=boites[nomCourant]||(boites[nomCourant]={min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9]});
  for(let i=0;i<3;i++){
   b.min[i]=Math.min(b.min[i],[bb.min.x,bb.min.y,bb.min.z][i]);
   b.max[i]=Math.max(b.max[i],[bb.max.x,bb.max.y,bb.max.z][i]);}
  pieces.push({cle,geo});}
 return {
  pieces,boites,
  piece(nom){nomCourant=nom;},
  /* parallélépipède centré en (x,y,z) */
  boite(cle,l,h,p,x,y,z,rx,ry,rz){ajouter(cle,new T.BoxGeometry(l,h,p),x,y,z,rx,ry,rz);},
  /* cylindre d'axe X (l'axe de la boîte) entre x0 et x1, centré sur (y,z) */
  cylX(cle,r,x0,x1,y,z,r2){ajouter(cle,new T.CylinderGeometry(r2==null?r:r2,r,Math.abs(x1-x0),20),(x0+x1)/2,y,z,0,0,PI/2);},
  /* cylindre d'axe Y */
  cylY(cle,r,h,x,y,z,seg){ajouter(cle,new T.CylinderGeometry(r,r,h,seg||14),x,y,z);},
  /* cylindre d'axe Z */
  cylZ(cle,r,h,x,y,z,seg){ajouter(cle,new T.CylinderGeometry(r,r,h,seg||14),x,y,z,PI/2,0,0);},
  /* tuyau le long d'une liste de points [x,y,z] */
  tuyau(cle,points,r){
   const courbe=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p[0],p[1],p[2])),false,'catmullrom',.3);
   ajouter(cle,new T.TubeGeometry(courbe,Math.max(8,points.length*8),r,7,false),0,0,0);},
  /* bouchon hexagonal dont l'axe suit `axe` ('x','y' ou 'z') */
  bouchon(cle,r,h,x,y,z,axe){
   const g=new T.CylinderGeometry(r,r,h,6);
   ajouter(cle,g,x,y,z,axe==='z'?PI/2:0,0,axe==='x'?PI/2:0);}};}

/* ═══════════ 3. Les trois grandes familles ═══════════ */
/* Éléments communs : support de boîte (patte + bloc de caoutchouc) et bouchons de remplissage et de vidange. */
function support(c,A,x,yHaut,z){
 c.piece('support');
 c.boite('grey',.16,.035,.05,x,yHaut+.02,z);                 /* patte en acier fixée sur le carter */
 c.boite('blk',.07,.06,.07,x,yHaut+.07,z);                   /* bloc de caoutchouc */
 c.boite('grey',.1,.02,.08,x,yHaut+.11,z);                   /* platine vers le berceau ou la caisse */
 A.support=[x,yHaut+.07,z];}
function bouchons(c,A,xRemp,yRemp,zRemp,xVid,yVid,zVid){
 c.piece('bouchons');
 c.bouchon('clip',.014,.016,xRemp,yRemp,zRemp,'z');          /* remplissage : sur le côté du carter */
 c.bouchon('clip',.014,.016,xVid,yVid,zVid,'y');             /* vidange : en bas */
 A.remplissage=[xRemp,yRemp,zRemp+.012];
 A.vidange=[xVid,yVid-.012,zVid];}

/* Boîte manuelle : cloche d'embrayage, carter, couvercle de sélection, capteurs, câbles de commande. */
function manuelle(c,s,A,o){
 const L=s.longueur,rc=.17;
 c.piece('cloche');
 c.cylX('gbx',rc,0,.15,0,0);                                  /* cloche d'embrayage en alliage */
 c.cylX('alu',rc+.012,0,.02,0,0);                             /* bride côté moteur */
 for(let k=0;k<8;k++){const a=k/8*PI*2;c.bouchon('clip',.008,.012,.02,Math.cos(a)*(rc+.002),Math.sin(a)*(rc+.002),'x');}
 c.cylZ('alu',.022,.09,.07,.05,-rc-.03);                      /* récepteur d'embrayage (hydraulique) */
 c.tuyau('hose',[[.07,.05,-rc-.07],[.09,.12,-rc-.05],[.1,.17,-rc+.0]],.005);
 c.piece('carter');
 c.boite('gbx',L-.15,.28,.30,.15+(L-.15)/2,-.01,0);           /* carter principal */
 c.boite('grey',L-.17,.24,.012,.15+(L-.15)/2,-.01,.156);      /* couvercle latéral boulonné */
 c.boite('abl',.12,.05,.26,.15+.1,.15,0);                     /* nervure supérieure */
 c.piece('selection');
 c.boite('grey',.16,.05,.14,.27,.18,0);                       /* couvercle de sélection des rapports */
 c.cylY('clip',.012,.07,.27,.22,.0);                          /* axe du levier de sélection */
 c.boite('alu',.05,.03,.05,.27,.26,.0);                       /* rotule de commande */
 c.piece('capteurs');
 c.cylZ('blk',.012,.04,.32,.05,-.17);                         /* contacteur de feu de recul */
 c.cylZ('blk',.012,.04,.2,-.06,-.17);                         /* capteur de vitesse */
 c.piece('cables');
 const v=o.versPareFeu;                                       /* direction du pare-feu, dans le repère de la boîte */
 c.tuyau('hose',[[.27,.26,.02],[.27+v[0]*.1,.3,.02+v[2]*.1],[.27+v[0]*.25,.34,.04+v[2]*.25]],.007);
 c.tuyau('hose',[[.27,.26,-.02],[.27+v[0]*.1,.31,-.02+v[2]*.1],[.27+v[0]*.25,.35,-.04+v[2]*.25]],.007);
 A.cables=[.27,.28,0];
 A.selection=[.27,.21,0];
 support(c,A,.2,.15,.0);
 bouchons(c,A,.34,.02,.156,.3,-.15,0);
 /* sortie de transmission : différentiel et flasque de cardan côté extérieur de la boîte */
 c.piece('sortie');
 c.cylX('gbx',.09,.25,L,-.1,0);
 c.cylX('clip',.04,L,L+.05,-.1,0);
 A.sortieCardan=[L+.05,-.1,0];
 A.joint=[L,-.1,0];
 A.fixationEmbrayage=[.02,0,rc];}

/* Boîte automatique : convertisseur, grande cloche, carter-pan profond, refroidisseur et tube de remplissage. */
function automatique(c,s,A,o){
 const L=s.longueur;
 c.piece('cloche');
 c.cylX('abl',.2,0,.19,0,0);                                  /* cloche du convertisseur de couple, plus large qu'un embrayage */
 c.cylX('alu',.212,0,.02,0,0);
 for(let k=0;k<10;k++){const a=k/10*PI*2;c.bouchon('clip',.008,.012,.02,Math.cos(a)*.205,Math.sin(a)*.205,'x');}
 c.piece('carter');
 c.boite('abl',L-.19,.3,.3,.19+(L-.19)/2,.0,0);               /* carter de mécanisme (trains épicycloïdaux) */
 c.piece('pan');
 c.boite('gbx',L-.26,.07,.27,.2+(L-.26)/2,-.185,0);            /* carter inférieur (pan) : filtre et soupapes à l'intérieur */
 for(let k=0;k<6;k++){c.bouchon('clip',.007,.01,.22+k*.04,-.222,.13,'y');c.bouchon('clip',.007,.01,.22+k*.04,-.222,-.13,'y');}
 c.piece('electronique');
 c.boite('blk',.07,.05,.09,.35,.17,.1);                       /* connecteur du calculateur de boîte */
 c.piece('refroidisseur');
 const v=o.versRadiateur;                                     /* direction du radiateur, dans le repère de la boîte */
 c.tuyau('alu',[[.3,.0,.152],[.3+v[0]*.1,.0,.2+v[2]*.1],[.3+v[0]*.3,.05,.22+v[2]*.3]],.009);
 c.tuyau('alu',[[.38,.0,.152],[.38+v[0]*.1,.02,.18+v[2]*.1],[.38+v[0]*.3,.08,.2+v[2]*.3]],.009);
 A.refroidisseur=[.3,0,.152];
 c.piece('remplissage');
 c.tuyau('clip',[[.3,.15,-.08],[.3,.22,-.14],[.3,.3,-.14]],.007);   /* tube de jauge et de remplissage */
 c.boite('blk',.02,.02,.02,.3,.31,-.14);
 A.remplissage=[.3,.31,-.14];
 c.piece('cables');
 c.tuyau('hose',[[.15,.12,.14],[.13,.25,.2],[.12,.3,.26]],.007);   /* câble de sélection de gamme */
 A.cables=[.15,.12,.14];
 A.selection=[.15,.12,.14];
 support(c,A,.22,.15,.0);
 c.piece('bouchons');
 c.bouchon('clip',.016,.02,.25,-.227,.0,'y');                 /* bouchon de vidange dans le pan */
 A.vidange=[.25,-.239,0];
 A.filtre=[.35,-.2,0];
 c.piece('sortie');
 c.cylX('abl',.09,.25,L,-.12,0);
 c.cylX('clip',.04,L,L+.05,-.12,0);
 A.sortieCardan=[L+.05,-.12,0];
 A.joint=[L,-.12,0];
 A.fixationEmbrayage=[.02,0,.2];}

/* Boîte à double embrayage : cloche large (deux embrayages), bloc mécatronique, carter. */
function doubleEmbrayage(c,s,A,o){
 const L=s.longueur;
 c.piece('cloche');
 c.cylX('gbx',.19,0,.16,0,0);
 c.cylX('alu',.202,0,.02,0,0);
 for(let k=0;k<10;k++){const a=k/10*PI*2;c.bouchon('clip',.008,.012,.02,Math.cos(a)*.195,Math.sin(a)*.195,'x');}
 c.piece('carter');
 c.boite('gbx',L-.16,.27,.30,.16+(L-.16)/2,-.01,0);
 c.boite('grey',L-.18,.22,.012,.16+(L-.18)/2,-.01,.156);
 c.piece('mecatronique');
 c.boite('blk',.17,.06,.2,.3,.175,0);                         /* bloc mécatronique : électro-vannes et calculateur */
 c.boite('abl',.17,.012,.21,.3,.21,0);
 c.boite('blk',.04,.04,.06,.3,.2,.13);                        /* connecteur */
 c.piece('refroidisseur');
 if(s.refroidisseur){
  const v=o.versRadiateur;
  c.tuyau('alu',[[.34,.0,.152],[.34+v[0]*.1,.0,.2+v[2]*.1],[.34+v[0]*.3,.05,.22+v[2]*.3]],.009);
  c.tuyau('alu',[[.4,.0,.152],[.4+v[0]*.1,.02,.18+v[2]*.1],[.4+v[0]*.3,.08,.2+v[2]*.3]],.009);
  A.refroidisseur=[.34,0,.152];}
 c.piece('selection');
 c.cylY('clip',.01,.05,.18,.16,.0);                           /* câble ou commande électrique de sélection */
 A.selection=[.18,.17,0];
 A.cables=null;
 support(c,A,.2,.14,.0);
 bouchons(c,A,.38,.02,.156,.3,-.145,0);
 c.piece('sortie');
 c.cylX('gbx',.09,.25,L,-.1,0);
 c.cylX('clip',.04,L,L+.05,-.1,0);
 A.sortieCardan=[L+.05,-.1,0];
 A.joint=[L,-.1,0];
 A.fixationEmbrayage=[.02,0,.19];}

/* Réducteur de voiture électrique : carter cylindrique, un seul rapport. */
function reducteur(c,s,A,o){
 const L=s.longueur;
 c.piece('carter');
 c.cylX('gbx',.15,0,L,0,0);
 c.cylX('alu',.162,0,.02,0,0);
 c.cylX('grey',.152,L*.55,L*.6,0,0);
 support(c,A,.15,.15,.0);
 bouchons(c,A,.22,.0,.15,.15,-.15,0);
 c.piece('sortie');
 c.cylX('clip',.04,L,L+.05,-.05,0);
 A.sortieCardan=[L+.05,-.05,0];
 A.joint=[L,-.05,0];
 A.cables=null;}

/* ═══════════ 4. Construction ═══════════ */
/* o : {versPareFeu:[x,y,z] unitaire, versRadiateur:[x,y,z] unitaire} exprimés dans le repère de la boîte. */
function build(spec,o){
 o=Object.assign({versPareFeu:[1,0,0],versRadiateur:[1,0,0]},o||{});
 const c=Constructeur(),A={};
 if(spec.type==='man') manuelle(c,spec,A,o);
 else if(spec.type==='auto') automatique(c,spec,A,o);
 else if(spec.type==='dct') doubleEmbrayage(c,spec,A,o);
 else reducteur(c,spec,A,o);
 return {pieces:c.pieces,ancres:A,boites:c.boites,longueur:spec.longueur,spec};}

/* Place des points et des boîtes du repère de la boîte vers un autre repère : rotation autour de Y (angle) puis translation. */
function placer(point,angle,origine){
 const v=new T.Vector3(point[0],point[1],point[2]).applyAxisAngle(new T.Vector3(0,1,0),angle);
 return v.add(origine);}
function placerBoite(b,angle,origine){
 const pts=[];
 for(const x of [b.min[0],b.max[0]]) for(const y of [b.min[1],b.max[1]]) for(const z of [b.min[2],b.max[2]]) pts.push(placer([x,y,z],angle,origine));
 return new T.Box3().setFromPoints(pts);}

return {FAMILLES,CAS,specOf,build,placer,placerBoite};
})();
window.__mwbox=MWBOX;
