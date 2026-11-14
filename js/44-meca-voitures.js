'use strict';
/* ───────────── Mode « Mécanicien » — VOITURES RÉELLES ─────────────
   Catalogue de voitures courantes en France (et quelques sportives / prestigieuses) avec leur VRAI moteur, leur maillage 3D
   (carrosserie lissée propre à chaque modèle, roues détaillées, freins visibles, intérieur sommaire, capot à charnière) et le
   moteur 3D réel dans la baie (construit avec `build3D`, comme l'atelier). Remplace `MW.carMesh` (compatible avec l'ancien appel
   `{color,kind}`) ; s'appuie sur le socle `MW` (js/40) et les modèles de js/07 (moteur 3D), js/03 (computeEngine), js/01-02 (état `S`).
   Aucun logo ni reproduction graphique de marque : silhouettes génériques, désignations en texte simple.

   ═══ API `MWCARS` ═══
   Catalogue
     MWCARS.list                      tableau des voitures (objets « fiche », voir ci-dessous) ; MWCARS.get(id) ; MWCARS.ids()
     MWCARS.byCat(cat)                'pop' (populaires), 'gen' (généralistes récentes), 'prem' (premium), 'sport'
     MWCARS.pool(zoneId)              voitures adaptées au garage : garage1→pop, garage2→gen, garage3→prem, garage4→sport
     MWCARS.pick(cat|zoneId|kind, {rnd, need:[partIds]}) fiche tirée au hasard (kind : citadine|berline|suv|utilitaire|sport)
     MWCARS.tuple(car)                [marque, « modèle + moteur », kind, id] (forme des anciens MODELS de js/41)
     MWCARS.label(car, {year, km})    « Renault Clio IV 1.5 dCi 90 · 2016 · 128 400 km »
     MWCARS.fullName(car)             « Clio IV » (modèle + génération)
   Fiche : {id, cat, mk (marque), mo (modèle), gen (génération), y0,y1 (années de production), body ('hatch','mini','sedan','wagon','suv',
     'van','coupe','mid','rear'), kind, doors, L,W,H,WB (m), mass (kg), drive ('fwd'|'rwd'|'awd'), gb ('man'|'auto'|'dct'|'ev'), gears,
     tyre:'195/55 R16' (+ tyreR si pneus différents à l'arrière), brk:{f:'disc'|'vent',fd,r:'drum'|'disc'|'vent',rd} (Ø en mm),
     loc ('front'|'mid'|'rear'), ori ('T' transversal | 'L' longitudinal), ev (électrique), approx (valeurs secondaires approchées),
     eng:{nom ('1.5 dCi 90'), code, fuel ('essence'|'diesel'|'electrique'), n, lay ('I'|'V'|'F'), ang, ccm, bore, stroke (mm), asp ('atmo'|'turbo'|'biturbo'),
          ch, nm, timing ('courroie'|'chaîne'), wet (courroie à bain d'huile), oilL (litres), visc ('5W-30'), valves (soupapes au total), …}}
   Conversion vers le moteur du jeu
     MWCARS.toS(car)                  état de conception compatible `S` (config, alésage/course, angle du V, carburant, suralimentation,
                                      distribution, soupapes…) ; null pour une voiture électrique. Accepte une fiche ou un id.
     MWCARS.checkS(car)               {ok, E:{P,L,n,full}} : calcule le moteur du jeu avec cet état (sans modifier l'état courant)
   Pièces et prix selon la voiture (utilisé par js/41)
     MWCARS.applies(car, partId)      la voiture possède-t-elle cette pièce ? (chaîne → pas de courroie de distribution ; électrique →
                                      pas de vidange ni de bougies ; boîte automatique → pas d'embrayage à changer)
     MWCARS.partName(car, partId)     libellé adapté (« Huile moteur 5W-30 (4,5 l) », « Bougies de préchauffage (×4) », « Pneus 195/55 R16 (×4) »…) ou null
     MWCARS.partPrice(car, partId, prixDeBase)  prix adapté (capacité d'huile, taille de pneus, disques, nombre de cylindres…)
     MWCARS.oilL(car)                 capacité d'huile (l)
   Maillage 3D
     MW.carMesh({model:id, color, plate:'AB-123-CD'})  voiture réelle ; MW.carMesh({color,kind}) : un modèle réel au hasard de ce type.
       Groupe THREE (non ajouté à la scène), x vers la gauche de la voiture, y vers le haut, avant vers +z, pieds à y = 0.
       Enfants nommés : 'wFL','wFR','wRL','wRR' (roues, ordre 'YXZ'), 'hood' (capot ou capot arrière des voitures à moteur arrière/central :
       rotation.x = −1 l'ouvre ; la béquille suit toute seule), 'brakeFL'… (freins, toujours visibles même roue déposée).
       userData : {mdl (id), L, W, H, WB, kind, loc ('front'|'rear'), wheelR, wheelRR, trackF, trackR, hoodLen, bayZ, anchors}.
       Points d'ancrage (Object3D vides, enfants du groupe, coordonnées de la voiture ; `MWCARS.anchor(g,nom)` → Vector3, `anchorWorld(g,nom)`) :
         'bay'      origine du compartiment moteur : milieu du plancher de la baie (x=0), à l'avant (ou à l'arrière si loc≠'front')
         'hubFL','hubFR','hubRL','hubRR'   centres des moyeux          'under'   dessous, au milieu entre les essieux
         'oilPlug'  bouchon de vidange (sous le carter)                'oilFilter'  filtre à huile (à côté du carter, sous la voiture)
         'battery','airbox','exhaust' (sortie du pot),'fuelCap' (trappe à carburant), 'coolant' (vase d'expansion), 'washer' (lave-glace),
         'brakeFluid' (bocal de liquide de frein), 'radiator', 'oilCap' (bouchon de remplissage d'huile), 'dipstick' (jauge),
         'alternator', 'hoodPivot' (charnière), 'cabin' (siège conducteur).
       Les ancres du moteur (oilCap, dipstick, alternator…) sont affinées à la construction du moteur (1re ouverture du capot).
   Moteur réel dans la baie
     MWCARS.engineMesh(car, {group})  construit le moteur 3D de la voiture (build3D), à l'échelle réelle, orienté (transversal / longitudinal),
                                      avec son cache-moteur, boîte à air, batterie, vase d'expansion, lave-glace, liquide de frein, radiateur +
                                      ventilateur, boîte de vitesses…  Renvoie un THREE.Group en coordonnées de la voiture (à ajouter à `group`).
                                      Libération : g.userData.dispose(). userData : {fit:{ok,size,box}, anchors}.
     Automatique : quand le capot d'une voiture posée dans la scène s'ouvre pour la 1re fois (hood.rotation.x < −0,15), le moteur est construit ;
     il est libéré quand la voiture quitte la scène. MWCARS.bayBuilt(g) dit si la baie est construite.
   Points d'accroche dans les autres fichiers (petits, délimités) :
     js/41 : MODELS (clientèles par garage) est remplacé sur place par ce catalogue ; makeCar choisit la voiture d'abord (modelFor) puis le travail (les
             pièces absentes sont marquées `na` : chaîne → pas de kit de distribution…) ; noms et prix des pièces via MWCARS.partName/partPrice (pn, pprice) ;
             nom affiché lbl(c) ; maillage {model, plate} ; dimensions et points d'interaction (MWCARS.pts) ; freins réels (pas de disque générique).
     js/42 : voiture personnelle et vendeur d'occasions (champ `model`) ; applyCar conserve les phares du socle.   js/43 : makeRequest choisit une voiture
             compatible avec le travail (MWJ.modelFor).   js/40 : aucun (MW.carMesh est enveloppé ici, les voitures de la rue passent par {kind}).
   Divers
     MWCARS.setPlate(g, 'AB-123-CD')  change la plaque d'une voiture déjà construite ; MWCARS.stats() : cache, nombre de moteurs construits.
   Données approximatives : `approx:true` (et `ap` = liste des champs) sur les fiches / moteurs dont certaines valeurs secondaires
   (capacité d'huile, diamètre des freins, masse) sont plausibles mais non garanties. */
const MWCARS=(()=>{
const T=THREE,PI=Math.PI,TAU=PI*2;
const rndf=Math.random;

/* ═══════════ 1. Moteurs réels ═══════════ */
/* id: {nom, code, fuel, n, lay, ang, ccm, bore, stroke, asp, ch, nm, timing, wet, oilL, visc, valves, vt, fs, cr, blk, rpm, bar, ap} */
const ENG={
 k9k90:{nom:'1.5 dCi 90',code:'K9K',fuel:'diesel',n:4,lay:'I',ccm:1461,bore:76,stroke:80.5,asp:'turbo',ch:90,nm:220,timing:'courroie',oilL:4.5,visc:'5W-30',valves:8,vt:'sohc',fs:'cr',cr:15.7,blk:'iron',rpm:5000,bar:.9,ap:'oilL'},
 k9k110:{nom:'1.5 dCi 110',code:'K9K',fuel:'diesel',n:4,lay:'I',ccm:1461,bore:76,stroke:80.5,asp:'turbo',ch:110,nm:260,timing:'courroie',oilL:4.5,visc:'5W-30',valves:8,vt:'sohc',fs:'cr',cr:15.7,blk:'iron',rpm:5000,bar:1.1,ap:'oilL'},
 k9k115:{nom:'1.5 Blue dCi 115',code:'K9K',fuel:'diesel',n:4,lay:'I',ccm:1461,bore:76,stroke:80.5,asp:'turbo',ch:115,nm:260,timing:'courroie',oilL:4.5,visc:'5W-30',valves:8,vt:'sohc',fs:'cr',cr:15.7,blk:'iron',rpm:5000,bar:1.15,ap:'oilL'},
 eb2_82:{nom:'1.2 VTi 82',code:'EB2',fuel:'essence',n:3,lay:'I',ccm:1199,bore:75,stroke:90.5,asp:'atmo',ch:82,nm:118,timing:'courroie',wet:true,oilL:3.75,visc:'5W-30',valves:12,vt:'dohc4',fs:'mpi',cr:11,blk:'alu',rpm:6500,ap:'oilL'},
 eb2_82pt:{nom:'1.2 PureTech 82',code:'EB2',fuel:'essence',n:3,lay:'I',ccm:1199,bore:75,stroke:90.5,asp:'atmo',ch:82,nm:118,timing:'courroie',wet:true,oilL:3.75,visc:'5W-30',valves:12,vt:'dohc4',fs:'mpi',cr:11,blk:'alu',rpm:6500,ap:'oilL'},
 eb2dt110:{nom:'1.2 PureTech 110',code:'EB2DT',fuel:'essence',n:3,lay:'I',ccm:1199,bore:75,stroke:90.5,asp:'turbo',ch:110,nm:205,timing:'courroie',wet:true,oilL:3.75,visc:'5W-30',valves:12,vt:'dohc4',fs:'di',cr:10.5,blk:'alu',rpm:6200,bar:.8,ap:'oilL'},
 eb2dt100:{nom:'1.2 Turbo 100',code:'EB2DT',fuel:'essence',n:3,lay:'I',ccm:1199,bore:75,stroke:90.5,asp:'turbo',ch:100,nm:205,timing:'courroie',wet:true,oilL:3.75,visc:'5W-30',valves:12,vt:'dohc4',fs:'di',cr:10.5,blk:'alu',rpm:6200,bar:.75,ap:'oilL'},
 h4bt90:{nom:'0.9 TCe 90',code:'H4Bt',fuel:'essence',n:3,lay:'I',ccm:898,bore:72.2,stroke:73.1,asp:'turbo',ch:90,nm:140,timing:'chaîne',oilL:4.0,visc:'5W-30',valves:12,vt:'dohc4',fs:'mpi',cr:9.5,blk:'alu',rpm:6000,bar:.8,ap:'oilL'},
 h4dt100:{nom:'1.0 TCe 100',code:'H4Dt',fuel:'essence',n:3,lay:'I',ccm:999,bore:72.2,stroke:81.3,asp:'turbo',ch:100,nm:160,timing:'chaîne',oilL:4.2,visc:'5W-30',valves:12,vt:'dohc4',fs:'di',cr:10,blk:'alu',rpm:6000,bar:.85,ap:'oilL,timing'},
 h5ht140:{nom:'1.3 TCe 140',code:'H5Ht',fuel:'essence',n:4,lay:'I',ccm:1305,bore:72.2,stroke:79.7,asp:'turbo',ch:140,nm:240,timing:'chaîne',oilL:4.4,visc:'0W-30',valves:16,vt:'dohc4',fs:'di',cr:10.5,blk:'alu',rpm:6200,bar:1.0,ap:'oilL,timing'},
 tdi16:{nom:'1.6 TDI 105',code:'EA288',fuel:'diesel',n:4,lay:'I',ccm:1598,bore:79.5,stroke:80.5,asp:'turbo',ch:105,nm:250,timing:'courroie',oilL:3.8,visc:'5W-30',valves:16,vt:'dohc4',fs:'cr',cr:16.2,blk:'iron',rpm:4800,bar:1.1,ap:'oilL'},
 tdi20:{nom:'2.0 TDI 150',code:'EA288',fuel:'diesel',n:4,lay:'I',ccm:1968,bore:81,stroke:95.5,asp:'turbo',ch:150,nm:340,timing:'courroie',oilL:4.6,visc:'5W-30',valves:16,vt:'dohc4',fs:'cr',cr:16.2,blk:'iron',rpm:4800,bar:1.4,ap:'oilL'},
 tsi15:{nom:'1.5 TSI 150',code:'EA211 evo',fuel:'essence',n:4,lay:'I',ccm:1498,bore:74.5,stroke:85.9,asp:'turbo',ch:150,nm:250,timing:'courroie',oilL:4.0,visc:'0W-20',valves:16,vt:'dohc4',fs:'di',cr:12.5,blk:'alu',rpm:6500,bar:.9,ap:'oilL'},
 ea888_245:{nom:'2.0 TSI 245',code:'EA888',fuel:'essence',n:4,lay:'I',ccm:1984,bore:82.5,stroke:92.8,asp:'turbo',ch:245,nm:370,timing:'chaîne',oilL:5.7,visc:'5W-30',valves:16,vt:'dohc4',fs:'dual',cr:9.6,blk:'alu',rpm:6700,bar:1.1,ap:'oilL'},
 ea888_190:{nom:'2.0 TFSI 190',code:'EA888',fuel:'essence',n:4,lay:'I',ccm:1984,bore:82.5,stroke:92.8,asp:'turbo',ch:190,nm:320,timing:'chaîne',oilL:5.7,visc:'0W-30',valves:16,vt:'dohc4',fs:'dual',cr:11.7,blk:'alu',rpm:6500,bar:.9,ap:'oilL'},
 rs3:{nom:'2.5 TFSI 400',code:'DNWA',fuel:'essence',n:5,lay:'I',ccm:2480,bore:82.5,stroke:92.8,asp:'turbo',ch:400,nm:500,timing:'chaîne',oilL:6.2,visc:'0W-30',valves:20,vt:'dohc4',fs:'dual',cr:10,blk:'alu',rpm:7000,bar:1.3,ap:'oilL'},
 fire12:{nom:'1.2 8V 69',code:'FIRE',fuel:'essence',n:4,lay:'I',ccm:1242,bore:70.8,stroke:78.9,asp:'atmo',ch:69,nm:102,timing:'courroie',oilL:3.1,visc:'5W-30',valves:8,vt:'sohc',fs:'mpi',cr:11.1,blk:'iron',rpm:6000,ap:'oilL'},
 nr133:{nom:'1.33 VVT-i 100',code:'1NR-FE',fuel:'essence',n:4,lay:'I',ccm:1329,bore:72.5,stroke:80.5,asp:'atmo',ch:99,nm:125,timing:'chaîne',oilL:3.7,visc:'0W-20',valves:16,vt:'dohc4',fs:'mpi',cr:11.5,blk:'alu',rpm:6500,ap:'oilL'},
 eco100:{nom:'1.0 EcoBoost 100',code:'EcoBoost',fuel:'essence',n:3,lay:'I',ccm:999,bore:71.9,stroke:82,asp:'turbo',ch:100,nm:170,timing:'courroie',wet:true,oilL:4.1,visc:'5W-20',valves:12,vt:'dohc4',fs:'di',cr:10,blk:'iron',rpm:6200,bar:.9,ap:'oilL'},
 eco125:{nom:'1.0 EcoBoost 125',code:'EcoBoost',fuel:'essence',n:3,lay:'I',ccm:999,bore:71.9,stroke:82,asp:'turbo',ch:125,nm:170,timing:'courroie',wet:true,oilL:4.1,visc:'5W-20',valves:12,vt:'dohc4',fs:'di',cr:10,blk:'iron',rpm:6200,bar:1.0,ap:'oilL'},
 dv6:{nom:'1.6 HDi 92',code:'DV6',fuel:'diesel',n:4,lay:'I',ccm:1560,bore:75,stroke:88.3,asp:'turbo',ch:92,nm:230,timing:'courroie',oilL:3.75,visc:'5W-30',valves:8,vt:'sohc',fs:'cr',cr:16.5,blk:'iron',rpm:4800,bar:1.0,ap:'oilL'},
 dv4:{nom:'1.4 HDi 70',code:'DV4',fuel:'diesel',n:4,lay:'I',ccm:1398,bore:73.7,stroke:82,asp:'turbo',ch:68,nm:160,timing:'courroie',oilL:3.25,visc:'5W-30',valves:8,vt:'sohc',fs:'cr',cr:17.9,blk:'iron',rpm:4600,bar:.9,ap:'oilL'},
 dv5:{nom:'1.5 BlueHDi 130',code:'DV5',fuel:'diesel',n:4,lay:'I',ccm:1499,bore:75,stroke:84.8,asp:'turbo',ch:130,nm:300,timing:'courroie',oilL:4.25,visc:'0W-30',valves:16,vt:'dohc4',fs:'cr',cr:16.5,blk:'iron',rpm:4800,bar:1.3,ap:'oilL'},
 b47:{nom:'2.0 d 190 (B47)',code:'B47',fuel:'diesel',n:4,lay:'I',ccm:1995,bore:84,stroke:90,asp:'turbo',ch:190,nm:400,timing:'chaîne',oilL:5.0,visc:'5W-30',valves:16,vt:'dohc4',fs:'cr',cr:16.5,blk:'alu',rpm:5000,bar:1.5,ap:'oilL'},
 om651:{nom:'2.1 220 d (OM651)',code:'OM651',fuel:'diesel',n:4,lay:'I',ccm:2143,bore:83,stroke:99,asp:'biturbo',ch:170,nm:400,timing:'chaîne',oilL:6.3,visc:'5W-30',valves:16,vt:'dohc4',fs:'cr',cr:16.2,blk:'alu',rpm:4800,bar:1.4,ap:'oilL'},
 d4:{nom:'2.0 D4 190',code:'Drive-E',fuel:'diesel',n:4,lay:'I',ccm:1969,bore:82,stroke:93.2,asp:'biturbo',ch:190,nm:400,timing:'chaîne',oilL:5.4,visc:'0W-30',valves:16,vt:'dohc4',fs:'cr',cr:15.8,blk:'alu',rpm:5000,bar:1.5,ap:'oilL,timing'},
 v6tdi:{nom:'3.0 V6 TDI 231',code:'EA897',fuel:'diesel',n:6,lay:'V',ang:90,ccm:2967,bore:83,stroke:91.4,asp:'turbo',ch:231,nm:500,timing:'chaîne',oilL:7.2,visc:'5W-30',valves:24,vt:'dohc4',fs:'cr',cr:16,blk:'alu',rpm:5000,bar:1.6,ap:'oilL'},
 p911:{nom:'3.0 flat-6 biturbo 385',code:'MA1',fuel:'essence',n:6,lay:'F',ccm:2981,bore:91,stroke:76.4,asp:'biturbo',ch:385,nm:450,timing:'chaîne',oilL:9.0,visc:'0W-40',valves:24,vt:'dohc4',fs:'di',cr:10.2,blk:'alu',rpm:7500,bar:1.0,ap:'oilL'},
 cay718:{nom:'2.0 flat-4 turbo 300',code:'MA1',fuel:'essence',n:4,lay:'F',ccm:1988,bore:91,stroke:76.4,asp:'turbo',ch:300,nm:380,timing:'chaîne',oilL:7.5,visc:'0W-40',valves:16,vt:'dohc4',fs:'di',cr:9.5,blk:'alu',rpm:7500,bar:1.1,ap:'oilL'},
 a110:{nom:'1.8 turbo 252',code:'M5P',fuel:'essence',n:4,lay:'I',ccm:1798,bore:79.7,stroke:90.1,asp:'turbo',ch:252,nm:320,timing:'chaîne',oilL:5.4,visc:'5W-30',valves:16,vt:'dohc4',fs:'di',cr:9.5,blk:'alu',rpm:6800,bar:1.1,ap:'oilL'},
 s58:{nom:'3.0 biturbo 480 (S58)',code:'S58',fuel:'essence',n:6,lay:'I',ccm:2993,bore:84,stroke:90,asp:'biturbo',ch:480,nm:550,timing:'chaîne',oilL:6.5,visc:'0W-30',valves:24,vt:'dohc4',fs:'dual',cr:9.3,blk:'alu',rpm:7200,bar:1.3,ap:'oilL'},
 f4rt:{nom:'2.0 turbo 265',code:'F4Rt',fuel:'essence',n:4,lay:'I',ccm:1998,bore:82.7,stroke:93,asp:'turbo',ch:265,nm:360,timing:'chaîne',oilL:5.4,visc:'5W-40',valves:16,vt:'dohc4',fs:'di',cr:8.6,blk:'alu',rpm:6500,bar:1.1,ap:'oilL'},
 coyote:{nom:'5.0 V8 450',code:'Coyote',fuel:'essence',n:8,lay:'V',ang:90,ccm:4951,bore:92.2,stroke:92.7,asp:'atmo',ch:450,nm:529,timing:'chaîne',oilL:8.5,visc:'5W-20',valves:32,vt:'dohc4',fs:'dual',cr:12,blk:'alu',rpm:7400,ap:'oilL'},
 gr16:{nom:'1.6 turbo 261',code:'G16E-GTS',fuel:'essence',n:3,lay:'I',ccm:1618,bore:87.5,stroke:89.7,asp:'turbo',ch:261,nm:360,timing:'chaîne',oilL:5.2,visc:'0W-20',valves:12,vt:'dohc4',fs:'dual',cr:10.5,blk:'alu',rpm:7000,bar:1.6,ap:'oilL'},
 v10:{nom:'5.2 V10 610',code:'EA824',fuel:'essence',n:10,lay:'V',ang:90,ccm:5204,bore:84.5,stroke:92.8,asp:'atmo',ch:610,nm:560,timing:'chaîne',oilL:10.0,visc:'5W-40',valves:40,vt:'dohc4',fs:'dual',cr:12.7,blk:'alu',rpm:8500,ap:'oilL'},
 zoe:{nom:'R135 électrique 100 kW',code:'R135',fuel:'electrique',n:0,lay:'',ccm:0,bore:0,stroke:0,asp:'',ch:136,nm:245,timing:'',oilL:0,visc:'',valves:0,ap:''}};
for(const k in ENG){ENG[k].id=k;ENG[k].diesel=ENG[k].fuel==='diesel';ENG[k].ev=ENG[k].fuel==='electrique';}

/* ═══════════ 2. Catalogue ═══════════ */
/* [id, cat, marque, modèle, génération, an début, an fin, carrosserie, kind, L, W, H, WB, masse, transmission, boîte, moteur, pneus, freins, options] */
const BR=(f,fd,r,rd)=>({f,fd,r,rd});
const RAW=[
['clio4','pop','Renault','Clio','IV',2012,2019,'hatch','citadine',4.062,1.732,1.448,2.589,1100,'fwd','man','k9k90','195/55 R16',BR('disc',280,'drum',203),{rim:'a5',ap:'mass,brk'}],
['p208','pop','Peugeot','208','I',2012,2019,'hatch','citadine',3.962,1.739,1.460,2.538,975,'fwd','man','eb2_82','185/65 R15',BR('disc',266,'drum',203),{rim:'steel',ap:'brk'}],
['p308','pop','Peugeot','308','II',2013,2021,'hatch','berline',4.253,1.804,1.457,2.620,1160,'fwd','man','eb2dt110','205/55 R16',BR('disc',283,'disc',268),{rim:'a10',ap:'mass,brk'}],
['c3','pop','Citroën','C3','II',2016,2023,'hatch','citadine',3.996,1.749,1.474,2.540,1000,'fwd','man','eb2_82pt','195/65 R15',BR('disc',266,'drum',203),{rim:'steel',ap:'mass,brk'}],
['sandero','pop','Dacia','Sandero','II',2012,2020,'hatch','citadine',4.068,1.733,1.518,2.589,1010,'fwd','man','h4bt90','185/65 R15',BR('disc',258,'drum',203),{rim:'steel',ap:'mass,brk'}],
['megane3','pop','Renault','Mégane','III',2008,2016,'hatch','berline',4.302,1.808,1.471,2.641,1300,'fwd','man','k9k110','205/55 R16',BR('disc',280,'disc',260),{rim:'a5',ap:'mass,brk'}],
['golf7','pop','Volkswagen','Golf','VII',2012,2019,'hatch','berline',4.255,1.799,1.452,2.637,1270,'fwd','man','tdi16','205/55 R16',BR('disc',288,'disc',253),{rim:'a5',ap:'mass,brk'}],
['yaris3','pop','Toyota','Yaris','III',2011,2020,'hatch','citadine',3.885,1.695,1.510,2.510,1010,'fwd','man','nr133','175/65 R15',BR('disc',255,'drum',200),{rim:'steel',ap:'mass,brk'}],
['fiesta7','pop','Ford','Fiesta','VII',2017,2023,'hatch','citadine',4.040,1.735,1.476,2.493,1100,'fwd','man','eco100','195/55 R16',BR('disc',278,'drum',203),{rim:'a5',ap:'mass,brk'}],
['corsa6','pop','Opel','Corsa','F',2019,2024,'hatch','citadine',4.060,1.765,1.433,2.538,1090,'fwd','man','eb2dt100','195/55 R16',BR('disc',266,'drum',203),{rim:'a5',ap:'mass,brk'}],
['kangoo2','pop','Renault','Kangoo','II',2008,2021,'van','utilitaire',4.213,1.829,1.834,2.697,1235,'fwd','man','k9k90','195/65 R15',BR('disc',280,'drum',228),{rim:'steel',ap:'mass,brk',gc:.16}],
['partner2','pop','Peugeot','Partner','II',2008,2018,'van','utilitaire',4.380,1.810,1.801,2.728,1330,'fwd','man','dv6','195/65 R15',BR('disc',283,'drum',228),{rim:'steel',ap:'mass,brk',gc:.16}],
['fiat500','pop','Fiat','500','II',2007,2024,'mini','citadine',3.546,1.627,1.488,2.300,865,'fwd','man','fire12','185/55 R15',BR('disc',240,'drum',185),{rim:'a5',ap:'mass,brk',doors:3}],
['p206','pop','Peugeot','206','',1998,2009,'hatch','citadine',3.835,1.652,1.432,2.443,1000,'fwd','man','dv4','185/60 R14',BR('disc',266,'drum',180),{rim:'steel',ap:'mass,brk',doors:3}],
['clio5','gen','Renault','Clio','V',2019,2025,'hatch','citadine',4.053,1.798,1.440,2.583,1100,'fwd','man','h4dt100','195/55 R16',BR('disc',280,'drum',203),{rim:'a10',ap:'mass,brk'}],
['captur2','gen','Renault','Captur','II',2019,2025,'suv','suv',4.227,1.797,1.576,2.639,1290,'fwd','man','h5ht140','215/60 R17',BR('disc',280,'disc',258),{rim:'a10',ap:'mass,brk',gc:.17}],
['p3008','gen','Peugeot','3008','II',2016,2024,'suv','suv',4.447,1.841,1.624,2.675,1400,'fwd','auto','dv5','225/55 R18',BR('disc',283,'disc',268),{rim:'a10',ap:'mass,brk',gc:.18}],
['focus4','gen','Ford','Focus','IV',2018,2025,'hatch','berline',4.378,1.825,1.454,2.700,1300,'fwd','man','eco125','215/50 R17',BR('disc',278,'disc',253),{rim:'a5',ap:'mass,brk'}],
['tiguan2','gen','Volkswagen','Tiguan','II',2016,2024,'suv','suv',4.486,1.839,1.675,2.681,1600,'fwd','dct','tdi20','215/65 R17',BR('disc',312,'disc',272),{rim:'a10',ap:'mass,brk',gc:.19}],
['octavia4','gen','Škoda','Octavia Combi','IV',2020,2025,'wagon','berline',4.689,1.829,1.468,2.686,1350,'fwd','dct','tsi15','205/55 R16',BR('disc',288,'disc',253),{rim:'a5',ap:'mass,brk'}],
['duster2','gen','Dacia','Duster','II',2018,2024,'suv','suv',4.341,1.804,1.693,2.676,1300,'fwd','man','k9k115','215/65 R16',BR('disc',280,'drum',228),{rim:'a5',ap:'mass,brk',gc:.21}],
['zoe','gen','Renault','Zoe','II',2019,2024,'hatch','citadine',4.087,1.787,1.562,2.588,1502,'fwd','ev','zoe','195/55 R16',BR('disc',280,'drum',228),{rim:'a5',ap:'mass,brk',gears:1}],
['berlingo3','gen','Citroën','Berlingo','III',2018,2025,'van','utilitaire',4.403,1.848,1.796,2.785,1400,'fwd','man','dv5','205/60 R16',BR('disc',283,'disc',268),{rim:'a5',ap:'mass,brk',gc:.17}],
['bmw320d','prem','BMW','Série 3','G20',2019,2025,'sedan','berline',4.709,1.827,1.435,2.851,1540,'rwd','auto','b47','225/50 R17',BR('vent',330,'vent',320),{rim:'a10',ap:'mass,brk',of:.88}],
['c220d','prem','Mercedes-Benz','Classe C','W205',2014,2021,'sedan','berline',4.686,1.810,1.442,2.840,1500,'rwd','auto','om651','225/50 R17',BR('vent',322,'vent',300),{rim:'a5',ap:'mass,brk',of:.86}],
['a4b9','prem','Audi','A4','B9',2015,2024,'sedan','berline',4.726,1.842,1.427,2.820,1420,'fwd','dct','ea888_190','225/50 R17',BR('vent',314,'vent',300),{rim:'a5',ap:'mass,brk',of:.9,ori:'L'}],
['xc60','prem','Volvo','XC60','II',2017,2025,'suv','suv',4.688,1.902,1.658,2.865,1800,'awd','auto','d4','235/60 R18',BR('vent',345,'vent',320),{rim:'a10',ap:'mass,brk',gc:.2,of:.9,ori:'T'}],
['a6c8','prem','Audi','A6','C8',2018,2025,'sedan','berline',4.939,1.886,1.457,2.924,1830,'awd','auto','v6tdi','245/45 R18',BR('vent',345,'vent',330),{rim:'a10',ap:'mass,brk',of:.95}],
['p911','sport','Porsche','911 Carrera','992',2019,2025,'rear','sport',4.519,1.852,1.298,2.450,1505,'rwd','dct','p911','235/40 R19',BR('vent',330,'vent',330),{rim:'a5',rimC:'graph',loc:'rear',ori:'L',tyreR:'295/35 R20',ap:'mass,brk',of:.78,gears:8}],
['a110','sport','Alpine','A110','',2017,2025,'mid','sport',4.178,1.798,1.252,2.419,1103,'rwd','dct','a110','205/40 R18',BR('vent',320,'vent',320),{rim:'a10',rimC:'graph',loc:'mid',ori:'T',tyreR:'235/40 R18',ap:'mass,brk',of:.78,doors:2,gears:7}],
['rs3','sport','Audi','RS3 Sportback','8Y',2021,2025,'hatch','sport',4.389,1.851,1.436,2.631,1575,'awd','dct','rs3','235/35 R19',BR('vent',375,'vent',310),{rim:'a5',rimC:'graph',ap:'mass,brk',gears:7}],
['m3g80','sport','BMW','M3','G80',2021,2025,'sedan','sport',4.794,1.903,1.433,2.857,1730,'rwd','man','s58','275/40 R18',BR('vent',380,'vent',370),{rim:'a5',rimC:'graph',ap:'mass,brk',of:.9,gears:6}],
['meganers','sport','Renault','Mégane RS','III',2009,2017,'coupe','sport',4.299,1.848,1.435,2.636,1387,'fwd','man','f4rt','235/40 R18',BR('vent',340,'vent',290),{rim:'a10',rimC:'graph',ap:'mass,brk',doors:3,gears:6}],
['golfgti','sport','Volkswagen','Golf GTI Performance','VII',2017,2020,'hatch','sport',4.268,1.799,1.442,2.631,1370,'fwd','man','ea888_245','225/40 R18',BR('vent',340,'vent',310),{rim:'a5',rimC:'graph',ap:'mass,brk',gears:6}],
['mustang','sport','Ford','Mustang GT','S550',2015,2023,'coupe','sport',4.784,1.916,1.381,2.720,1720,'rwd','man','coyote','255/40 R19',BR('vent',355,'vent',330),{rim:'a10',rimC:'graph',ap:'mass,brk',of:.95,doors:2,tyreR:'275/40 R19',gears:6}],
['cayman','sport','Porsche','718 Cayman','982',2016,2025,'mid','sport',4.379,1.801,1.295,2.475,1335,'rwd','man','cay718','235/45 R18',BR('vent',330,'vent',299),{rim:'a5',rimC:'graph',loc:'mid',ori:'L',tyreR:'265/45 R18',ap:'mass,brk',of:.8,doors:2,gears:6}],
['gryaris','sport','Toyota','GR Yaris','',2020,2025,'hatch','sport',3.995,1.805,1.455,2.558,1280,'awd','man','gr16','225/40 R18',BR('vent',356,'vent',297),{rim:'a5',rimC:'graph',ap:'mass,brk',doors:3,gears:6}],
['huracan','sport','Lamborghini','Huracán','LP610-4',2014,2019,'mid','sport',4.459,1.924,1.165,2.620,1422,'awd','dct','v10','245/30 R20',BR('vent',380,'vent',356),{rim:'a10',rimC:'graph',loc:'mid',ori:'L',tyreR:'305/30 R20',ap:'mass,brk',of:.82,doors:2,gears:7}]];
const COLS_CAT={pop:[0xb03030,0x2f5da8,0xd4d4d0,0x2a2a2e,0x3f8a4a,0x7a7f88,0xc86a1c,0xc4c4c0,0x6a3a8a],gen:[0xd8d8d4,0x2a2a2e,0x3d6fb4,0x8a1f2c,0x7a7f88,0xd8d8d0,0x2f5d3a,0xc86a1c],
 prem:[0x15161a,0xd0d0cc,0x5a6068,0x1b2e4f,0x7c7f86,0x4a1f28,0xc9c4b4],sport:[0xc4281c,0xe0b81c,0x1b4fa8,0x15161a,0xd0d0cc,0x3d7f3a,0xe86a1c,0x7a1c8a]};
const CARS=[],BY={};
for(const r of RAW){
 const o=r[19]||{},e=ENG[r[16]];
 const ap=[o.ap||'',e.ap||''].filter(Boolean).join(',');
 const c={id:r[0],cat:r[1],mk:r[2],mo:r[3],gen:r[4],y0:r[5],y1:r[6],body:r[7],kind:r[8],L:r[9],W:r[10],H:r[11],WB:r[12],mass:r[13],drive:r[14],gb:r[15],eng:e,tyre:r[17],brk:r[18],
  doors:o.doors||(r[7]==='coupe'||r[7]==='mid'?2:r[7]==='van'?4:5),rim:o.rim||'a5',rimC:o.rimC||'silver',loc:o.loc||'front',ori:o.ori||(r[14]==='fwd'?'T':'L'),tyreR:o.tyreR||r[17],gc:o.gc||(r[8]==='sport'?.11:r[8]==='suv'?.18:.14),
  of:o.of||0,ev:!!e.ev,gears:o.gears||(r[15]==='auto'?8:r[15]==='dct'?7:r[15]==='ev'?1:(r[16]==='k9k90'||r[16]==='eb2_82'||r[16]==='eb2_82pt'||r[16]==='dv4')?5:6),ap:ap,approx:!!ap};
 if(!c.of) c.of=(c.L-c.WB)*.52;
 if(c.ev) c.ori='T';
 CARS.push(c);BY[c.id]=c;}
const POOL={garage1:'pop',garage2:'gen',garage3:'prem',garage4:'sport',cour:'pop'};
const GET=id=>typeof id==='string'?BY[id]||null:id||null;
const byCat=cat=>CARS.filter(c=>c.cat===cat);
const pool=z=>byCat(POOL[z]||z);
function pick(a,o){
 o=o||{};const r=o.rnd||rndf;let l=CARS;
 if(typeof a==='string'){l=POOL[a]||['pop','gen','prem','sport'].includes(a)?pool(a):CARS.filter(c=>c.kind===a);if(!l.length) l=CARS;}
 else if(Array.isArray(a)) l=a;
 if(o.need&&o.need.length){const f=l.filter(c=>o.need.every(p=>applies(c,p)));l=f.length?f:CARS.filter(c=>o.need.every(p=>applies(c,p)));}
 if(o.not){const f=l.filter(c=>!o.not.includes(c.id));if(f.length) l=f;}
 return l[Math.floor(r()*l.length)];}
const fullName=c=>`${c.mo}${c.gen?' '+c.gen:''}`;
const label=(c,o)=>{c=GET(c);o=o||{};let s=`${c.mk} ${fullName(c)} ${c.eng.nom}`;if(o.year) s+=' · '+o.year;if(o.km!=null) s+=' · '+(typeof nf==='function'?nf(o.km):o.km)+' km';return s;};
const tuple=c=>{c=GET(c);return [c.mk,`${fullName(c)} ${c.eng.nom}`,c.kind,c.id];};

/* ═══════════ 3. Conversion vers l'état de conception `S` ═══════════ */
const cfgOf=e=>e.lay==='I'?'I'+e.n:e.lay==='F'?'F'+e.n:'V'+e.n;
function toS(car){
 car=GET(car);if(!car||car.ev) return null;
 const e=car.eng,diesel=e.diesel,cfg=cfgOf(e),turbo=e.asp!=='atmo',sport=car.cat==='sport';
 const base=(typeof DEF!=='undefined')?DEF:{};
 const rim=parseInt((car.tyre.match(/R(\d+)/)||[0,16])[1],10);
 return Object.assign({},base,{
  name:`${car.mk} ${car.mo}`,config:cfg,bore:e.bore,stroke:e.stroke,vAngle:(e.lay==='V'&&e.ang&&typeof CFG!=='undefined'&&CFG[cfg]&&CFG[cfg].ang!==e.ang)?e.ang:0,
  blockMat:e.blk||'alu',headMat:'alu',internals:sport?'forged':'cast',valvetrain:e.vt||'dohc4',timing:e.timing==='courroie'?'belt':'chain',cam:diesel?20:sport?55:32,
  vvt:!diesel,vvl:false,limiter:e.rpm||6500,fuelSys:e.fs||(diesel?'cr':'mpi'),fuel:diesel?'diesel':(sport?'sp98':'sp95'),cr:e.cr||(diesel?16:10.5),lambda:diesel?1:.95,
  aspiration:e.asp==='biturbo'?'biturbo':turbo?'turbo':'na',boost:e.bar||(turbo?.9:0),turboSize:diesel?34:sport?40:30,intercooler:turbo?'air':'none',turboType:diesel?'vgt':'wg',
  manifold:sport?'tub':'cast',cat:(!diesel&&(e.fs==='di'||e.fs==='dual'))?'gpf':'tri',muffler:sport?'sport':'std',oilGrade:/^0W-?20$/i.test(e.visc)?'0w20':/40$/.test(e.visc)?'5w40':'5w30',
  sump:'wet',liner:diesel?'cast':'alusil',intake:sport?'vario':'std',
  gearbox:car.gb==='auto'?'auto':car.gb==='dct'?'dct':'man',gears:car.gears||6,drive:car.drive,enginePos:car.loc==='front'?(car.ori==='T'?'FT':'FL'):car.loc==='mid'?'MR':'RR',
  body:car.kind==='sport'?(car.loc==='front'?'coupe':'supercar'):car.kind==='suv'?'suv':car.kind==='citadine'?'citadine':car.body==='wagon'?'break':'berline',
  seats:car.doors===2?2:5,rim:rim,tireW:parseInt(car.tyre,10),profile:parseInt(car.tyre.split('/')[1],10)});}
/* calcule le moteur du jeu avec cet état, sans rien modifier de l'état courant */
function checkS(car){
 car=GET(car);const s=toS(car);if(!s) return {ok:true,ev:true};
 const keep=Object.assign({},S),ek=M.E,ck=M.C;
 try{
  Object.assign(S,s);sanitize();
  if(!S.injSize||!S.ecuIdle){const E0=computeEngine(Object.assign({},S,{injSize:1e6,ecuIdle:0,fuelPress:3}));S.injSize=clamp(Math.round(E0.injNeed*1.25/10)*10,60,3000);S.ecuIdle=E0.idle0;}
  const E=computeEngine(S);
  const ok=!!(E&&isFinite(E.peakP)&&isFinite(E.L)&&E.c&&E.c.n===car.eng.n&&Math.abs(E.L*1000-car.eng.ccm)<car.eng.ccm*.02);
  return {ok,E:{P:E.peakP,L:E.L,n:E.c.n,full:E.c.full},S:Object.assign({},S)};
 }catch(err){return {ok:false,err:String(err&&err.message||err)};}
 finally{for(const k in S) if(!(k in keep)) delete S[k];Object.assign(S,keep);M.E=ek;M.C=ck;}}

/* ═══════════ 4. Pièces selon la voiture ═══════════ */
function applies(car,id){
 car=GET(car);if(!car) return true;const e=car.eng;
 if(car.ev) return !['huile','filtre_huile','filtre_air','bougies','courroie_acc','courroie_dist','embrayage','alternateur','demarreur','injecteurs','sonde_lambda'].includes(id);
 if(id==='courroie_dist') return e.timing==='courroie';
 if(id==='embrayage') return car.gb==='man';
 return true;}
const fm=x=>String(Math.round(x*100)/100).replace('.',',');
function partName(car,id){
 car=GET(car);if(!car) return null;const e=car.eng,b=car.brk;
 switch(id){
  case 'huile': return car.ev?null:`Huile moteur ${e.visc} (${fm(e.oilL)} l)`;
  case 'bougies': return e.diesel?`Bougies de préchauffage (×${e.n})`:`Bougies d'allumage (×${e.n})`;
  case 'courroie_dist': return e.wet?"Kit de distribution (courroie à bain d'huile)":'Kit de distribution (courroie)';
  case 'pneus': return car.tyreR&&car.tyreR!==car.tyre?`Pneus ${car.tyre} AV / ${car.tyreR} AR (×4)`:`Pneus ${car.tyre} (×4)`;
  case 'plaq_ar': return b.r==='drum'?'Garnitures de frein arrière (mâchoires)':'Plaquettes arrière';
  case 'disq_ar': return b.r==='drum'?'Tambours de frein arrière':`Disques arrière (Ø ${b.rd} mm)`;
  case 'disq_av': return `Disques avant (Ø ${b.fd} mm)`;
  case 'injecteurs': return `Injecteurs (×${e.n})`;
 }
 return null;}
function partPrice(car,id,base){
 car=GET(car);if(!car) return base;const e=car.eng,b=car.brk;let f=1;
 switch(id){
  case 'huile': f=e.oilL/5;break;
  case 'pneus':{const m=t=>{const w=parseInt(t,10),rm=+(t.match(/R(\d+)/)||[0,16])[1];return (w/195)*Math.pow(rm/16,1.4);};f=clamp((m(car.tyre)+m(car.tyreR||car.tyre))/2,.6,3.4);break;}
  case 'plaq_av': case 'disq_av': f=Math.pow(b.fd/280,1.6);break;
  case 'plaq_ar': case 'disq_ar': f=Math.pow(b.rd/260,1.6)*(b.r==='drum'?.8:1);break;
  case 'bougies': f=e.n/4*(e.diesel?1.3:1);break;
  case 'injecteurs': f=e.n/4*(e.diesel?1.6:1);break;
  case 'courroie_dist': f=(1+.12*(e.n-4))*(e.wet?1.3:1);break;
  case 'embrayage': f=clamp(e.nm/250,.8,2.6);break;
  case 'amort': f=Math.pow(car.mass/1300,.8);break;
  case 'batterie': f=car.ev?.8:(e.ccm>3000?1.5:1);break;
  case 'filtre_huile': f=e.n>=6?1.3:1;break;
 }
 return base*f;}

/* ═══════════ 5. Géométrie : outils ═══════════ */
const V3=(x,y,z)=>new T.Vector3(x,y,z);
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function tf(g,x,y,z,rx,ry,rz){
 const m=new T.Matrix4();m.compose(V3(x||0,y||0,z||0),new T.Quaternion().setFromEuler(new T.Euler(rx||0,ry||0,rz||0,'YXZ')),V3(1,1,1));g.applyMatrix4(m);return g;}
const bxg=(w,h,d,x,y,z,rx,ry,rz)=>tf(new T.BoxGeometry(w,h,d),x,y,z,rx,ry,rz);
const cyg=(r1,r2,h,seg,x,y,z,rx,ry,rz)=>tf(new T.CylinderGeometry(r1,r2,h,seg||12),x,y,z,rx,ry,rz);
const cyx=(r,h,seg,x,y,z)=>cyg(r,r,h,seg,x,y,z,0,0,PI/2);          /* cylindre d'axe x */
const cyz=(r,h,seg,x,y,z)=>cyg(r,r,h,seg,x,y,z,PI/2,0,0);          /* cylindre d'axe z */
function merge(list){
 const pos=[],nor=[],idx=[];let off=0;
 for(const g of list){if(!g) continue;
  const p=g.attributes.position.array,n=g.attributes.normal?g.attributes.normal.array:null,cnt=g.attributes.position.count;
  for(let i=0;i<p.length;i++) pos.push(p[i]);
  if(n) for(let i=0;i<n.length;i++) nor.push(n[i]);else for(let i=0;i<p.length;i++) nor.push(0);
  if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++) idx.push(a[i]+off);}else for(let i=0;i<cnt;i++) idx.push(off+i);
  off+=cnt;g.dispose();}
 const o=new T.BufferGeometry();o.setAttribute('position',new T.Float32BufferAttribute(pos,3));o.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
 o.setIndex(new T.BufferAttribute(off>65000?new Uint32Array(idx):new Uint16Array(idx),1));return o;}
/* surface lissée : anneaux de points (x,y) successifs le long de z ; `closed` : l'anneau se referme (sinon « U » ouvert) */
function loft(rings){
 const K=rings[0].pts.length,pos=[],idx=[];
 for(const r of rings) for(const p of r.pts) pos.push(p[0],p[1],r.z);
 for(let i=0;i<rings.length-1;i++){const a=i*K,b=(i+1)*K,cl=rings[i].closed&&rings[i+1].closed;
  for(let j=0;j<K-(cl?0:1);j++){const j2=(j+1)%K;idx.push(a+j,b+j,a+j2,b+j,b+j2,a+j2);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
/* polygone plat triangulé, dont chaque sommet (z,y) est placé en x par fx(z,y) */
function sidePoly(poly,fx,sgn){
 const pts=poly.map(p=>new T.Vector2(p[0],p[1])),tri=T.ShapeUtils.triangulateShape(pts,[]),pos=[];
 for(const t of tri){const o=sgn>0?t:[t[0],t[2],t[1]];for(const i of o){const p=poly[i];pos.push(sgn*fx(p[0],p[1]),p[1],p[0]);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;}
/* vitre latérale en grille régulière (suit exactement la courbure de la coque) : z de za à zb, y de bot à top(z) */
function sideGrid(za,zb,top,bot,fx,sg){
 const nz=Math.max(3,Math.round((za-zb)/.05)),ny=4,pos=[],idx=[];
 for(let i=0;i<=nz;i++){const z=za+(zb-za)*i/nz,yt=top(z);for(let j=0;j<=ny;j++){const y=bot+(yt-bot)*j/ny;pos.push(sg*fx(z,y),y,z);}}
 for(let i=0;i<nz;i++) for(let j=0;j<ny;j++){const a=i*(ny+1)+j,b=(i+1)*(ny+1)+j;idx.push(a,b,a+1,b,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
/* courbe y(z) lissée (Catmull-Rom centripète) échantillonnée finement */
function curveFn(pts){
 const c=new T.CatmullRomCurve3(pts.map(p=>V3(p[0],p[1],0)),false,'centripetal'),sm=c.getPoints(240);
 sm.sort((a,b)=>a.x-b.x);
 return z=>{if(z<=sm[0].x) return sm[0].y;const n=sm.length;if(z>=sm[n-1].x) return sm[n-1].y;let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(sm[m].x<=z) lo=m;else hi=m;}const a=sm[lo],b=sm[hi];return a.y+(b.y-a.y)*(z-a.x)/Math.max(1e-9,b.x-a.x);};}
function parseTyre(s){
 const m=s.match(/(\d+)\/(\d+)\s*R(\d+)/),w=+m[1]/1000,a=+m[2],rim=+m[3],rimR=rim*.0254/2,rt=rimR+w*a/100;
 return {w,a,rim,rimR,rt};}

/* gabarits de carrosserie : positions (u = fraction de la longueur depuis l'avant) et hauteurs (fractions de H) */
const SHAPES={
 hatch:{uc:.245,uf:.325,ur:.625,ub:.945,hn:.50,hb:.645,hd:.665,rb:.35,fb:.46,pill:[.46],cp:.04,roofW:.80,glassUp:1},
 mini:{uc:.215,uf:.30,ur:.80,ub:.965,hn:.49,hb:.63,hd:.645,rb:.45,fb:.42,pill:[],cp:.05,roofW:.82,glassUp:1},
 sedan:{uc:.265,uf:.365,ur:.60,ub:.715,hn:.50,hb:.645,hd:.68,rb:.35,fb:.46,pill:[.475],cp:.20,roofW:.78,glassUp:1},
 wagon:{uc:.25,uf:.335,ur:.89,ub:.975,hn:.51,hb:.65,hd:.66,rb:.7,fb:.46,pill:[.44,.66],cp:.04,roofW:.80,glassUp:1},
 suv:{uc:.26,uf:.345,ur:.875,ub:.975,hn:.60,hb:.69,hd:.70,rb:.6,fb:.46,pill:[.44,.665],cp:.04,roofW:.80,glassUp:1},
 van:{uc:.19,uf:.285,ur:.94,ub:.992,hn:.47,hb:.575,hd:.60,rb:.9,fb:.42,pill:[.50],cp:.03,roofW:.84,glassUp:1},
 coupe:{uc:.325,uf:.44,ur:.66,ub:.84,hn:.455,hb:.615,hd:.615,rb:.3,fb:.46,pill:[],cp:.12,roofW:.76,glassUp:1},
 mid:{uc:.30,uf:.425,ur:.60,ub:.735,hn:.46,hb:.60,hd:.575,rb:.4,fb:.46,pill:[],cp:.12,roofW:.76,glassUp:1,lidR:.945},
 rear:{uc:.285,uf:.405,ur:.69,ub:.815,hn:.52,hb:.60,hd:.585,rb:.3,fb:.46,pill:[],cp:.12,roofW:.78,glassUp:1,lidR:.935}};
/* matériaux partagés */
const MT=new Map();
function mat(key,mk){let m=MT.get(key);if(!m){m=mk();MT.set(key,m);}return m;}
const paintMat=c=>mat('p'+c,()=>new T.MeshPhongMaterial({color:c,shininess:55,specular:0x3a3a3a,side:T.DoubleSide}));
const MATS={
 glass:()=>mat('glass',()=>new T.MeshPhongMaterial({color:0x1d2a36,shininess:100,specular:0x8899aa,transparent:true,opacity:.84,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4})),
 dark:()=>mat('dark',()=>new T.MeshLambertMaterial({color:0x17181b,side:T.DoubleSide})),
 trim:()=>mat('trim',()=>new T.MeshPhongMaterial({color:0x26282c,shininess:25,specular:0x222222,side:T.DoubleSide})),
 chrome:()=>mat('chrome',()=>new T.MeshPhongMaterial({color:0xc4c8ce,shininess:90,specular:0xdddddd})),
 rubber:()=>mat('rubber',()=>new T.MeshLambertMaterial({color:0x17181a})),
 alu:()=>mat('alu',()=>new T.MeshPhongMaterial({color:0xbfc4cb,shininess:80,specular:0x999999,side:T.DoubleSide})),
 graph:()=>mat('graph',()=>new T.MeshPhongMaterial({color:0x4b4e54,shininess:70,specular:0x666666,side:T.DoubleSide})),
 steelw:()=>mat('steelw',()=>new T.MeshPhongMaterial({color:0x8d939b,shininess:50,specular:0x555555,side:T.DoubleSide})),
 disc:()=>mat('disc',()=>new T.MeshPhongMaterial({color:0x70757d,shininess:60,specular:0x555555})),
 drum:()=>mat('drum',()=>new T.MeshLambertMaterial({color:0x4a4c50})),
 caliperD:()=>mat('calD',()=>new T.MeshLambertMaterial({color:0x2c2e32})),
 caliperR:()=>mat('calR',()=>new T.MeshLambertMaterial({color:0xc0201c})),
 under:()=>mat('under',()=>new T.MeshLambertMaterial({color:0x1b1c1f,side:T.DoubleSide})),
 steel:()=>mat('steel',()=>new T.MeshPhongMaterial({color:0x34373c,shininess:40,specular:0x333333})),
 head:()=>mat('head',()=>{const m=new T.MeshPhongMaterial({color:0xdfe7ee,shininess:100,specular:0xffffff,emissive:0xfff3c8});m.emissiveIntensity=.12;return m;}),
 tail:()=>mat('tail',()=>{const m=new T.MeshPhongMaterial({color:0x9a1018,shininess:80,specular:0x886666,emissive:0xff2020});m.emissiveIntensity=.2;return m;}),
 amber:()=>mat('amber',()=>{const m=new T.MeshPhongMaterial({color:0xd98a10,shininess:60,emissive:0xffa000});m.emissiveIntensity=.15;return m;}),
 inter:()=>mat('inter',()=>new T.MeshLambertMaterial({color:0x34373d,side:T.DoubleSide})),
 hoodUnder:()=>mat('hoodU',()=>new T.MeshLambertMaterial({color:0x26282c,side:T.DoubleSide}))};
/* éclairage de nuit : les feux sont émissifs quand il fait nuit */
let nightOn=null;
function setNight(n){if(n===nightOn) return;nightOn=n;
 const h=MATS.head(),t=MATS.tail(),a=MATS.amber();h.emissiveIntensity=n?.95:.12;t.emissiveIntensity=n?.7:.2;a.emissiveIntensity=n?.3:.15;}

/* ═══════════ 6. Carrosserie, roues, détails d'un modèle (géométries partagées, mises en cache) ═══════════ */
const GEO={};
/* roue : pneu (profil avec flanc bombé) + jante (tonneau + rayons), axe x, face vers +x */
function wheelGeo(t,style,rimC){
 const key=[t.w,t.a,t.rim,style,rimC].join('|');if(GEO[key]) return GEO[key];
 const {w,rimR,rt}=t,sw=rt-rimR,R=rimR-.004;
 const P=(r,y)=>new T.Vector2(r,y);
 const prof=[P(rimR+.002,-w*.36),P(rimR+sw*.2,-w*.485),P(rimR+sw*.55,-w*.515),P(rt-.022,-w*.47),P(rt-.005,-w*.40),P(rt,-w*.30),P(rt,w*.30),P(rt-.005,w*.40),P(rt-.022,w*.47),P(rimR+sw*.55,w*.515),P(rimR+sw*.2,w*.485),P(rimR+.002,w*.36),P(rimR-.004,w*.30),P(rimR-.004,-w*.30),P(rimR+.002,-w*.36)];
 const tire=new T.LatheGeometry(prof,30);tire.rotateZ(-PI/2);
 const rw=Math.min(w*.82,.28),yo=rw/2-.03,hubR=.052,parts=[];
 const barrel=new T.LatheGeometry([P(R*.78,-rw/2),P(R*.96,-rw/2+.012),P(R,-rw/2+.03),P(R,rw/2-.02),P(R*.995,rw/2-.006),P(R*.97,rw/2)],28);parts.push(barrel);
 const sp=(n,wid,len0,r0,off)=>{for(let i=0;i<n;i++){const a=i/n*TAU+(off||0),rc=(r0+len0)/2;parts.push(tf(new T.BoxGeometry((len0-r0),.024,wid),Math.cos(a)*rc,yo,Math.sin(a)*rc,0,-a,0));}};
 if(style==='steel'){
  parts.push(cyg(R*.93,R*.93,.012,28,0,rw/2-.09,0));parts.push(cyg(R*.55,R*.55,.01,24,0,rw/2-.083,0));
  for(let i=0;i<6;i++){const a=i/6*TAU;parts.push(cyg(.012,.012,.014,8,Math.cos(a)*R*.74,rw/2-.083,Math.sin(a)*R*.74));}
  parts.push(cyg(.062,.07,.03,20,0,rw/2-.07,0));}
 else if(style==='a10'){sp(10,.03,R*.96,hubR,0);sp(10,.012,R*.9,hubR+.01,TAU/20);}
 else if(style==='a7'){sp(7,.052,R*.96,hubR,0);}
 else sp(5,.07,R*.96,hubR,0);
 if(style!=='steel'){parts.push(cyg(hubR+.012,hubR+.016,.034,20,0,yo,0));parts.push(cyg(.012,.012,.036,8,0,yo+.01,0));}
 for(let i=0;i<5;i++){const a=i/5*TAU;parts.push(cyg(.009,.009,.016,6,Math.cos(a)*.04,yo+.012,Math.sin(a)*.04));}
 const rim=merge(parts);rim.rotateZ(-PI/2);
 return (GEO[key]={tire,rim,rw,style});}
function brakeGeo(car,front){
 const b=car.brk,d=(front?b.fd:b.rd)/2000,kind=front?b.f:b.r,key='brk|'+kind+'|'+d+'|'+(car.cat==='sport'?1:0);if(GEO[key]) return GEO[key];
 const disc=[],cal=[];
 if(kind==='drum'){disc.push(cyx(d*.98,.075,22,0,0,0));disc.push(cyx(d*.8,.01,20,-.044,0,0));disc.push(cyx(.06,.03,12,.04,0,0));}
 else{disc.push(cyx(d,.026,28,0,0,0));disc.push(cyx(d*.36,.05,20,.03,0,0));disc.push(cyx(d*.97,.02,28,-.004,0,0));
  if(kind==='vent') for(let i=0;i<16;i++){const a=i/16*TAU;disc.push(cyx(.007,.03,6,.0,Math.cos(a)*d*.78,Math.sin(a)*d*.78));}
  const ca=.9,rc=d*.86;cal.push(bxg(.07,.085,.12,0,Math.sin(ca)*rc,Math.cos(ca)*rc*-1,0,0,0));cal.push(bxg(.075,.02,.14,0,Math.sin(ca)*rc+.05,-Math.cos(ca)*rc,0,0,0));}
 return (GEO[key]={disc:merge(disc),cal:cal.length?merge(cal):null,d});}

function buildGeo(car){
 if(GEO[car.id]) return GEO[car.id];
 const L=car.L,W=car.W,H=car.H,WB=car.WB,hw=W/2,zf=L/2,zr=-L/2,gc=car.gc;
 const sh=Object.assign({},SHAPES[car.body]||SHAPES.hatch,car.sh||{});
 const tF=parseTyre(car.tyre),tR=parseTyre(car.tyreR||car.tyre);
 const afz=zf-car.of,arz=afz-WB,wheels=[[afz,tF],[arz,tR]];
 const hn=sh.hn*H,hb=sh.hb*H,hd=sh.hd*H,uz=u=>zf-u*L;
 const zc=uz(sh.uc),zRf=uz(sh.uf),zRr=uz(sh.ur),zrb=uz(sh.ub);
 const rearLid=car.loc!=='front',archR=t=>t.rt+.045,guard=t=>2*t.rt+.115;
 const E_END=.36;
 /* profil central (capot, ceinture, coffre) */
 const top=z=>{const u=(zf-z)/L;
  if(u<sh.uc){const t=clamp((sh.uc-u)/(sh.uc-.03),0,1);return hb-(hb-hn)*Math.pow(t,1.25);}
  if(u<sh.ub) return hb;
  const t=clamp((u-sh.ub)/(1-sh.ub),0,1);return lerp(hb,hd,sstep(0,.3,t))-(rearLid?0:.0)-.05*sstep(.7,1,t);};
 const gdz=z=>{let g=0;for(const [z0,t] of wheels){const dz=Math.abs(z-z0),R=archR(t);g=Math.max(g,guard(t)*(1-sstep(R*.85,R+.26,dz)));}return g;};
 const yb=z=>{let y=gc;const d=Math.min(zf-z,z-zr);if(d<.85) y+=.2*Math.pow(1-d/.85,2);
  for(const [z0,t] of wheels){const dz=Math.abs(z-z0),R=archR(t);if(dz<R) y=Math.max(y,t.rt+Math.sqrt(R*R-dz*dz)*.97);}return y;};
 const yfl=z=>{let y=gc;const d=Math.min(zf-z,z-zr);if(d<.85) y+=.2*Math.pow(1-d/.85,2);return y;};
 const E_V=.13,endF=z=>{const d=Math.min(zf-z,z-zr);let wf=1,vf=1;if(d<E_END){const t=1-d/E_END;wf=Math.pow(1-Math.pow(t,2.6),1/2.6);}if(d<E_V){const t=1-d/E_V;vf=Math.pow(1-Math.pow(t,2.4),1/2.4);}return {wf,vf,d};};
 /* capot : zone ouverte */
 const lidLo=rearLid?zr+L*(1-(sh.lidR||.93)):zc,lidHi=rearLid?zrb-.02:zf-.13;
 const ring=(z,open)=>{
  const {wf,vf}=endF(z),ytc=top(z),ytf=Math.max(ytc,Math.min(ytc+.3,gdz(z))),ybz=yb(z),ym=(ybz+ytc)/2,hh=ytf-ybz,vs=Math.min(1,hh/.4);
  const yF=yfl(z),R=[[.6*hw,yF],[.86*hw,ybz],[.972*hw,ybz+Math.min(.04,hh*.3)],[hw,ybz+.14*hh],[hw,ybz+.78*hh],[.978*hw,ytf-.034*vs],[.9*hw,ytf-.006],[.64*hw,ytf],[.6*hw,ytc]];
  const f=p=>[p[0]*wf,ym+(p[1]-ym)*vf],r=R.map(f),pts=[];
  for(let i=R.length-1;i>=0;i--) pts.push([-r[i][0],r[i][1]]);
  for(let i=0;i<R.length;i++) pts.push(r[i]);
  return {z,pts,closed:!open};};
 /* échantillonnage en z */
 const zset=new Set(),N=Math.round(L*30);
 for(let i=0;i<=N;i++) zset.add(+(zr+L*(.5-.5*Math.cos(PI*i/N))).toFixed(4));
 for(const [z0,t] of wheels){const R=archR(t);for(const s of [-1,1]) for(const e of [-.004,0,.004,.03,.06]) zset.add(+(z0+s*(R+e)).toFixed(4));}
 for(const e of [-.003,0,.003]){zset.add(+(lidLo+e).toFixed(4));zset.add(+(lidHi+e).toFixed(4));}
 const zs=[...zset].filter(z=>z>=zr&&z<=zf).sort((a,b)=>a-b);
 const rings=zs.map(z=>ring(z,z>=lidLo-.0005&&z<=lidHi+.0005));
 const paint=[],dark=[],trim=[],chrome=[],glass=[],head=[],tail=[],amber=[],inter=[],steel=[];
 paint.push(loft(rings));
 /* dessous sombre (plancher, voûtes de roues) */
 {const ur=zs.map(z=>{const {wf}=endF(z),y=yb(z)-.002,yF=yfl(z)-.002;return {z,pts:[[-.86*hw*wf,y],[-.6*hw*wf,yF],[.6*hw*wf,yF],[.86*hw*wf,y]],closed:false};});dark.push(loft(ur));}
 /* habitacle : coque peinte */
 const ptsR=[[zrb,top(zrb)],[lerp(zrb,zRr,.25),lerp(top(zrb),H,sh.rb)],[zRr,H-.03],[lerp(zRr,zRf,.5),H],[zRf,H-.012],[lerp(zRf,zc,.55),lerp(H-.012,top(zc),.4+sh.fb*.2)],[zc,top(zc)]];
 const roofY=curveFn(ptsR),c=.05;
 const gz=z=>{const {wf}=endF(z);return {y0:top(z)-.015,yR:Math.max(roofY(z),top(z)-.0),wg:.9*hw*wf,wt:.9*hw*wf*sh.roofW};};
 const grz=[],NG=46;for(let i=0;i<=NG;i++) grz.push(zrb+(zc-zrb)*(.5-.5*Math.cos(PI*i/NG)));
 const gr=grz.map(z=>{const g=gz(z),h=Math.max(.002,g.yR-g.y0),cc=Math.min(c,h*.35),y1=g.yR;
  return {z,closed:true,pts:[[-g.wg,g.y0],[-g.wt,y1-cc],[-(g.wt-.45*cc),y1-.12*cc],[-(g.wt-1.1*cc),y1],[0,y1+.004],[g.wt-1.1*cc,y1],[g.wt-.45*cc,y1-.12*cc],[g.wt,y1-cc],[g.wg,g.y0]]};});
 paint.push(loft(gr));
 /* vitres : pare-brise, lunette, vitres latérales */
 const ybw=hb+.028,winTop=z=>Math.max(roofY(z)-.062,ybw+.03);
 const sideX=(z,y)=>{const g=gz(z),cc=Math.min(c,Math.max(.002,g.yR-g.y0)*.35),t=clamp((y-g.y0)/Math.max(1e-4,g.yR-cc-g.y0),0,1);return g.wg+(g.wt-g.wg)*t+.007;};
 const strip=(za,zb,n)=>{const rs=[];for(let i=0;i<=n;i++){const z=za+(zb-za)*i/n,g=gz(z),a=Math.max(.06,g.wt-1.1*Math.min(c,Math.max(.002,g.yR-g.y0)*.35)-.055),y=roofY(z)+.0045+.008;rs.push({z,pts:[[-a,y],[a,y]],closed:false});}return loft(rs);};
 glass.push(strip(zc-.03,zRf+.025,10));glass.push(strip(zRr-.025,zrb+.03,12));
 let zS=zc;while(zS>zRf&&roofY(zS)<ybw+.15) zS-=.01;zS-=.04;
 let zE=zrb;while(zE<zRr&&roofY(zE)<ybw+.15) zE+=.01;zE+=sh.cp;
 const pill=car.doors<=3?[]:sh.pill,bz=pill.map(u=>uz(u)),pw=.11,segs=[];let cur=zS;
 for(const b of bz){segs.push([cur,b+pw/2]);cur=b-pw/2;}segs.push([cur,zE]);
 const winPoly=(za,zb)=>{const pts=[[za,ybw],[zb,ybw]],n=Math.max(4,Math.round((za-zb)/.08));for(let i=0;i<=n;i++){const z=zb+(za-zb)*i/n;pts.push([z,winTop(z)]);}return pts;};
 for(const s of segs) if(s[0]-s[1]>.12) for(const sg of [-1,1]) glass.push(sideGrid(s[0],s[1],winTop,ybw,sideX,sg));
 /* lignes de portes, poignées, rétroviseurs, trappe */
 const sill=gc+.26,doorTop=hb-.02,lines=[];
 const dz0=afz-archR(tF)-.1,rearDoor=car.doors>3?arz+archR(tR)+.12:null;
 const cuts=[dz0];for(const b of bz) cuts.push(b);if(rearDoor!=null&&!bz.length) cuts.push(zc-L*.34);
 for(const z of cuts) for(const sg of [-1,1]) trim.push(bxg(.004,doorTop-sill,.004,sg*(hw+.0015),(doorTop+sill)/2,z));
 const handles=[];if(car.doors<=3||!bz.length) handles.push(zc-.78);else{handles.push(bz[0]+.2);handles.push(bz[0]-.1);}
 for(const z of handles) for(const sg of [-1,1]) (car.cat==='prem'?chrome:trim).push(bxg(.02,.022,.13,sg*(hw+.006),hb-.09,z));
 const mz=zc-.2;
 for(const sg of [-1,1]){paint.push(bxg(.1,.13,.17,sg*(hw+.1),hb+.1,mz));paint.push(bxg(.12,.03,.04,sg*(hw+.045),hb+.06,mz+.04));trim.push(bxg(.085,.11,.005,sg*(hw+.1),hb+.1,mz-.087));}
 const fuelX=-(hw+.002),fuelZ=arz+.15;trim.push(cyx(.06,.006,16,fuelX,hb-.2,fuelZ));
 /* pare-chocs, calandre, feux : posés sur la surface avant/arrière réelle (la section se resserre aux extrémités) */
 const surf=(front,xa,ylo,yhi)=>{let dd=0;for(;dd<E_END;dd+=.003){const z=front?zf-dd:zr+dd,{wf,vf}=endF(z),ytc=top(z),ybz=yb(z),ym=(ybz+ytc)/2,yt=ym+(ytc-ym)*vf,yB=ym-(ym-ybz)*vf;
   if(xa<=hw*wf*.96&&yhi<=yt-.012&&ylo>=yB+.012) break;}
  return front?zf-dd:zr+dd;};
 const onFace=(arr,front,x,yn,w,h,d)=>{ /* boîte posée sur la face, suivant la courbure du coin */
  const xa=Math.abs(x),sg=x>=0?1:-1,dir=front?1:-1,z0=surf(front,xa,yn,yn),zo=surf(front,xa+w*.45,yn,yn),zi=surf(front,Math.max(0,xa-w*.45),yn,yn);
  const s=(zo-zi)/Math.max(.02,Math.min(w*.9,xa+w*.45)),yaw=-sg*Math.atan(s);
  arr.push(bxg(w,h,d,x,yn,z0+dir*(.02-d/2),0,yaw,0));return z0;};
 const ytn=hn-.075,lw=.095*W+.1,lh=car.body==='van'?.15:.095,headY=Math.max(gc+.46,ytn-.02);
 for(const sg of [-1,1]){
  onFace(head,true,sg*hw*.64,headY,lw,lh,.05);
  onFace(amber,true,sg*hw*.8,headY-lh*.55-.012,lw*.3,lh*.32,.05);}
 {const gy=Math.max(gc+.42,headY-.015);
  onFace(dark,true,0,gy,hw*.7,.075,.05);
  if(car.cat!=='pop'){onFace(chrome,true,0,gy+.048,hw*.7,.012,.052);onFace(chrome,true,0,gy-.048,hw*.7,.012,.052);}
  const iy=gc+.25;onFace(dark,true,0,iy,hw*1.0,.12,.05);
  for(const sg of [-1,1]) onFace(dark,true,sg*hw*.76,iy,.2,.07,.05);}
 {const ty=Math.min(top(zr+.01)-.1,hd-.1),tw=car.body==='van'?.1:.1*W+.12,th=car.body==='van'?.34:.1;
  for(const sg of [-1,1]){onFace(tail,false,sg*hw*.68,ty,tw,th,.05);onFace(amber,false,sg*hw*.8,ty-th*.6,tw*.3,.03,.05);}}
 /* plaques françaises (plans, texture ajoutée à l'instance) */
 const pyF=Math.max(gc+.3,(yb(zf-.15)+top(zf-.15))/2-.04),pyR=(top(zr+.12)+yb(zr+.12))/2+.03;
 const plateF={x:0,y:pyF,z:surf(true,0,pyF,pyF)+.004},plateR={x:0,y:pyR,z:surf(false,0,pyR,pyR)-.004};
 /* dessous : échappement, réservoir, train arrière, boîte, arbre de transmission */
 const exX=hw*.42,exZ0=car.loc==='front'?zc-.35:zrb+.4;
 steel.push(cyz(.03,L*.0+Math.abs(exZ0-(zr+.25)),12,exX,.1,(exZ0+zr+.25)/2));
 steel.push(cyz(.085,.55,14,exX,.12,zr+.5));steel.push(cyz(.034,.12,10,exX,.14,zr+.06));
 trim.push(cyz(.045,.12,12,exX,.14,zr+.04));
 steel.push(bxg(W*.52,.12,.62,0,.1,arz+.2+(car.loc==='front'?.0:.2)));
 steel.push(cyx(.03,W*.8,10,0,.18,arz));if(car.drive!=='fwd'){steel.push(cyz(.045,Math.abs(afz-arz)*.7,10,0,.12,(afz+arz)/2));steel.push(bxg(.3,.18,.26,0,.16,arz+.02));}
 steel.push(bxg(W*.62,.04,.12,0,.12,afz-.3));steel.push(bxg(W*.62,.04,.12,0,.12,afz+.15));
 /* intérieur sommaire */
 const zSeat=zc-(car.loc==='front'?.86:.55)-(car.body==='mid'?.35:0),sx=.36,sy=.4;
 const seat=(x,z)=>{inter.push(bxg(.5,.13,.5,x,sy,z));inter.push(bxg(.5,.55,.12,x,sy+.33,z-.27,-.18,0,0));inter.push(bxg(.22,.14,.09,x,sy+.68,z-.31,-.18,0,0));};
 seat(sx,zSeat);seat(-sx,zSeat);
 if(car.doors>2&&car.body!=='mid'&&car.body!=='rear'){inter.push(bxg(1.2,.13,.5,0,sy,zSeat-.86));inter.push(bxg(1.2,.5,.12,0,sy+.3,zSeat-1.12,-.18,0,0));}
 const dashY=hb-.12;inter.push(bxg(W-.34,.2,.3,0,dashY,zc-.2));inter.push(bxg(.26,.22,.5,0,sy+.1,zSeat+.2));
 const wheelCt=V3(sx,dashY+.1,zc-.62);
 const sw=new T.TorusGeometry(.17,.016,8,18);tf(sw,sx,dashY+.12,zc-.66,-.35,0,0);inter.push(sw);inter.push(bxg(.02,.02,.16,sx,dashY+.04,zc-.62));
 inter.push(bxg(W-.32,.02,Math.max(1,zc-zrb-.6),0,.27,(zc+zrb)/2-.1));
 /* capot (ou capot arrière) */
 const hLen=lidHi-lidLo,pivY=top(lidLo),hrs=[],hu=[];
 const hxs=[-.62,-.45,-.2,0,.2,.45,.62];
 const lidRing=(z,dy,wk)=>{const {wf}=endF(z),y=top(z)+dy-pivY;return {z:z-lidLo,closed:false,pts:hxs.map(k=>[k*hw*wf*wk,y+.006-.01*Math.pow(Math.abs(k)/.62,4)])};};
 const lz=[];for(let i=0;i<=14;i++) lz.push(lidLo+hLen*(i/14));
 for(const z of lz) hrs.push(lidRing(z,0,1));
 {const last=lidRing(lidHi,0,1);hrs.push({z:last.z+.002,closed:false,pts:last.pts.map(p=>[p[0]*.985,p[1]-.05])});}
 const hoodTop=loft(hrs);
 const hoodUnder=loft(lz.map(z=>lidRing(z,-.035,.9)));
 /* ancres (coordonnées de la voiture) */
 const bayZ=(lidLo+lidHi)/2,eZ=car.loc==='front'?(afz+zc)/2-.02:bayZ,anchors={
  bay:[0,gc+.1,bayZ],hubFL:[hw-tF.w/2-.015,tF.rt,afz],hubFR:[-(hw-tF.w/2-.015),tF.rt,afz],hubRL:[hw-tR.w/2-.015,tR.rt,arz],hubRR:[-(hw-tR.w/2-.015),tR.rt,arz],
  under:[0,gc,(afz+arz)/2],oilPlug:[0,gc-.02,eZ],oilFilter:[.2,gc+.0,eZ],battery:[.55,.55,bayZ+(car.loc==='front'?.35:0)],airbox:[-.5,.62,bayZ+.3],exhaust:[exX,.14,zr+.02],fuelCap:[fuelX,hb-.2,fuelZ],
  coolant:[.3,.8,bayZ-.2],washer:[-.6,.55,bayZ+.35],brakeFluid:[.36,.78,lidLo+.06],radiator:[0,.5,lidHi-.1],oilCap:[0,.95,bayZ],dipstick:[.2,.8,bayZ],alternator:[.3,.4,bayZ+.1],
  hoodPivot:[0,pivY,lidLo],cabin:[sx,.95,zSeat]};
 return (GEO[car.id]={paint:merge(paint),dark:merge(dark),trim:merge(trim),chrome:merge(chrome),glass:merge(glass),head:merge(head),tail:merge(tail),amber:merge(amber),inter:merge(inter),steel:merge(steel),
  hoodTop,hoodUnder,hLen,lidLo,lidHi,pivY,anchors,plateF,plateR,wx:{F:hw-tF.w/2-.015,R:hw-tR.w/2-.015},afz,arz,tF,tR,hw,zf,zr,top,roofY,zc,zrb,rearLid,bayZ,sx,gc,hb,hn});}

/* ═══════════ 7. Instances de voitures ═══════════ */
const PLATES=new Map();
function plateText(){const L=()=>String.fromCharCode(65+Math.floor(rndf()*23)).replace(/[IOU]/,'A'),N=()=>Math.floor(rndf()*10);return L()+L()+'-'+N()+N()+N()+'-'+L()+L();}
/* voitures sans plaque imposée (rue, décor) : 16 plaques tirées au hasard, pour ne pas multiplier les textures */
const PPOOL=[];
const plateFromPool=()=>{if(PPOOL.length<16){const t=plateText();PPOOL.push(t);return t;}return PPOOL[Math.floor(rndf()*PPOOL.length)];};
function plateMat(text){
 let m=PLATES.get(text);if(m){PLATES.delete(text);PLATES.set(text,m);return m;}
 const cv=document.createElement('canvas');cv.width=512;cv.height=110;const x=cv.getContext('2d');
 x.fillStyle='#f4f4f0';x.fillRect(0,0,512,110);x.strokeStyle='#14213d';x.lineWidth=5;x.strokeRect(3,3,506,104);
 x.fillStyle='#1c3f94';x.fillRect(6,6,50,98);x.fillRect(456,6,50,98);
 x.fillStyle='#f4d03f';for(let i=0;i<12;i++){const a=i/12*TAU;x.beginPath();x.arc(31+Math.cos(a)*14,40+Math.sin(a)*14,2,0,TAU);x.fill();}
 x.fillStyle='#fff';x.font='bold 22px Arial,sans-serif';x.textAlign='center';x.fillText('F',31,86);
 x.fillStyle='#fff';x.font='bold 14px Arial,sans-serif';x.fillText('FR',481,92);
 x.fillStyle='#15171c';x.font='bold 80px "Barlow Condensed","Arial Narrow",Arial,sans-serif';x.textBaseline='middle';x.fillText(text,256,58);
 const t=new T.CanvasTexture(cv);t.anisotropy=2;m=new T.MeshLambertMaterial({map:t});PLATES.set(text,m);
 if(PLATES.size>40){const k=PLATES.keys().next().value,o=PLATES.get(k);PLATES.delete(k);if(o.map) o.map.dispose();o.dispose();}
 return m;}
const GEOM_PLATE=new T.PlaneGeometry(.52,.11),GEOM_ROD=new T.BoxGeometry(.014,.014,1);
const mesh=(g,m)=>new T.Mesh(g,m);
function setPlate(g,text){const u=g.userData;if(!u||!u.plates) return;const m=plateMat(text);for(const p of u.plates) p.material=m;u.plate=text;}
function anchorOf(g,n){return g.userData&&g.userData.anchors?g.userData.anchors[n]||null:null;}
const anchor=(g,n)=>{const a=anchorOf(g,n);return a?a.position.clone():null;};
const anchorWorld=(g,n)=>{const a=anchorOf(g,n);if(!a) return null;g.updateMatrixWorld(true);return a.getWorldPosition(new T.Vector3());};
function makeCar(car,o){
 const G=buildGeo(car),g=new T.Group();g.name='car_'+car.id;
 const pal=COLS_CAT[car.cat]||COLS_CAT.pop,color=o.color!=null?o.color:pal[Math.floor(rndf()*pal.length)],pm=paintMat(color);
 g.add(mesh(G.paint,pm));g.add(mesh(G.dark,MATS.dark()));g.add(mesh(G.trim,MATS.trim()));g.add(mesh(G.glass,MATS.glass()));
 g.add(mesh(G.head,MATS.head()));g.add(mesh(G.tail,MATS.tail()));g.add(mesh(G.amber,MATS.amber()));g.add(mesh(G.inter,MATS.inter()));g.add(mesh(G.steel,MATS.steel()));
 if(G.chrome.attributes.position.count) g.add(mesh(G.chrome,MATS.chrome()));
 /* capot (charnière à l'arrière du capot) */
 const hood=new T.Group();hood.name='hood';hood.position.set(0,G.pivY,G.lidLo);hood.add(mesh(G.hoodTop,pm));hood.add(mesh(G.hoodUnder,MATS.hoodUnder()));g.add(hood);
 /* plaques */
 const text=o.plate||plateFromPool(),pmat=plateMat(text),pf=mesh(GEOM_PLATE,pmat),pr=mesh(GEOM_PLATE,pmat);
 pf.position.set(G.plateF.x,G.plateF.y,G.plateF.z);pr.position.set(G.plateR.x,G.plateR.y,G.plateR.z);pr.rotation.y=PI;g.add(pf,pr);
 /* roues et freins */
 const wg=(front,s)=>{const t=front?G.tF:G.tR,wgo=wheelGeo(t,car.rim,car.rimC);return {t,wgo};};
 const rimMat=car.rim==='steel'?MATS.steelw():car.rimC==='graph'?MATS.graph():MATS.alu(),brakes={};
 for(const [n,fr,sg] of [['FL',1,1],['FR',1,-1],['RL',0,1],['RR',0,-1]]){
  const {t,wgo}=wg(fr),w=new T.Group();w.name='w'+n;w.rotation.order='YXZ';
  const wx=sg*(fr?G.wx.F:G.wx.R),wz=fr?G.afz:G.arz;w.position.set(wx,t.rt,wz);
  const tire=mesh(wgo.tire,MATS.rubber()),rim=mesh(wgo.rim,rimMat);if(sg<0){tire.rotation.y=PI;rim.rotation.y=PI;}
  w.add(tire,rim);g.add(w);
  const bg=brakeGeo(car,!!fr),b=new T.Group();b.name='brake'+n;b.position.set(wx,t.rt,wz);if(sg<0) b.rotation.y=PI;
  const d=mesh(bg.disc,bg.d?(car.brk[fr?'f':'r']==='drum'?MATS.drum():MATS.disc()):MATS.disc());d.position.x=-.05;b.add(d);
  if(bg.cal){const c=mesh(bg.cal,car.cat==='sport'?MATS.caliperR():MATS.caliperD());c.position.x=-.05;b.add(c);}
  g.add(b);brakes[n]=b;}
 /* ancres */
 const anchors={};
 for(const k in G.anchors){const a=new T.Object3D();a.name='@'+k;a.position.set(G.anchors[k][0],G.anchors[k][1],G.anchors[k][2]);g.add(a);anchors[k]=a;}
 /* béquille de capot */
 const rod=mesh(GEOM_ROD,MATS.steel());rod.visible=false;g.add(rod);
 g.userData={mdl:car.id,L:car.L,W:car.W,H:car.H,WB:car.WB,kind:car.kind,loc:car.loc,wheelR:G.tF.rt,wheelRR:G.tR.rt,trackF:2*G.wx.F,trackR:2*G.wx.R,hoodLen:G.hLen,bayZ:G.bayZ,anchors,
  plates:[pf,pr],plate:text,hood,rod,brakes,color,car,bay:null,_age:0,_seen:false,_ang:99,G};
 if(o.bay!==false) LIVE.add(g);
 return g;}

/* ═══════════ 8. Suivi des voitures : capot ouvert → moteur construit ; voiture partie → moteur libéré ═══════════ */
const LIVE=new Set();let built=0,freed=0;
function release(g){const u=g.userData;if(u.bay){try{u.bay.userData.dispose();}catch(e){}g.remove(u.bay);u.bay=null;freed++;}}
function updateRod(g){
 const u=g.userData,G=u.G,h=u.hood,a=h.rotation.x;if(Math.abs(a-u._ang)<.002) return;u._ang=a;
 if(a>-.55){u.rod.visible=false;return;}
 const lx=G.hw*.5,ly=-.045,lz=G.hLen*.55,c=Math.cos(a),s=Math.sin(a);
 const top=V3(lx,G.pivY+ly*c-lz*s,G.lidLo+ly*s+lz*c),foot=V3(lx,G.pivY-.13,top.z);
 const d=top.clone().sub(foot),len=d.length();u.rod.visible=true;u.rod.position.copy(foot).addScaledVector(d,.5);u.rod.scale.set(1,1,len);u.rod.quaternion.setFromUnitVectors(V3(0,0,1),d.normalize());}
function track(){
 for(const g of LIVE){const u=g.userData;
  if(!u._seen){if(g.parent) u._seen=true;else if(++u._age>600) LIVE.delete(g);continue;}
  if(!g.parent){release(g);LIVE.delete(g);continue;}
  const h=u.hood;if(!h) continue;
  if(h.rotation.x<-.15&&!u.bay&&!u.noBay){try{const e=engineMesh(u.car,{group:g});g.add(e);u.bay=e;built++;for(const k in e.userData.anchors) if(u.anchors[k]) u.anchors[k].position.copy(e.userData.anchors[k]);}catch(err){u.noBay=true;console.error('moteur de baie',err);}}
  updateRod(g);
  for(const n of ['FL','FR']){const w=g.getObjectByName('w'+n);if(w&&u.brakes[n]) u.brakes[n].rotation.y=w.rotation.y+(n==='FR'?PI:0);}}}

/* ═══════════ 9. Moteur réel dans la baie ═══════════ */
const ECACHE={};let engBuilt=0;
const SKIP_PART=/Ligne d'échappement|Catalyseur|Huile moteur|Filtre à huile|Sonde lambda/;
/* construit (ou réutilise) la géométrie du moteur du jeu pour ce moteur : fusionnée par matériau, en mm, centrée */
function engineParts(car){
 const e=car.eng;let c=ECACHE[e.id];if(c){c.refs++;return c;}
 const s=toS(car),snap=Object.assign({},S),keepE=M.E,keepC=M.C,keepE3=E3,keepSel=ui.sel,keepView=ui.eview;let root,parts;
 try{
  Object.assign(S,s);sanitize();
  if(!S.injSize||!S.ecuIdle){const E0=computeEngine(Object.assign({},S,{injSize:1e6,ecuIdle:0,fuelPress:3}));S.injSize=clamp(Math.round(E0.injNeed*1.25/10)*10,60,3000);S.ecuIdle=E0.idle0;}
  M.E=computeEngine(S);if(!S.oilInt){S.oilInt=M.E.oilRec;M.E=computeEngine(S);}
  ui.eview='3d';
  E3={scene:new T.Scene(),root:null,parts:[],anim:null,sig:'',R:600,hl:new T.MeshStandardMaterial({color:0xffb800}),shown:[],pinEls:[],cv:null,renderer:null,w:0,h:0};
  build3D();root=E3.root;parts=E3.parts;root.updateMatrixWorld(true);
 }finally{for(const k in S) if(!(k in snap)) delete S[k];Object.assign(S,snap);M.E=keepE;M.C=keepC;E3=keepE3;ui.sel=keepSel;ui.eview=keepView;}
 const anchors={},names=[[/^Alternateur/,'alternator'],[/Bouchon de remplissage/,'oilCap'],[/Bobines|préchauffage|Allumeur/,'coils'],[/Carter de distribution/,'timing'],[/Collecteur d'admission/,'intake'],[/Turbocompresseur/,'turbo'],
  [/^Démarreur/,'starter'],[/Carter d'huile/,'oilPan'],[/^Courroie d'accessoires/,'belt'],[/Couvre-culasse/,'valveCover']];
 let cover=null,plenum=null;
 for(const p of parts){
  if(SKIP_PART.test(p.name)){for(const me of p.meshes) me.userData.skip=true;continue;}
  for(const [re,k] of names) if(re.test(p.name)&&p.pin&&!anchors[k]) anchors[k]=root.localToWorld(p.pin.clone());
  if(/Couvre-culasse/.test(p.name)){const b=new T.Box3();for(const me of p.meshes) b.expandByObject(me);cover=cover?cover.union(b):b;}
  if(/Collecteur d'admission/.test(p.name)){const b=new T.Box3();for(const me of p.meshes) b.expandByObject(me);plenum=plenum?plenum.union(b):b;}}
 const bk=new Map();
 root.traverse(o=>{if(!o.isMesh||o.userData.skip||!o.material||o.material.transparent) return;
  const m=o.material,key=m.color.getHex()+'|'+Math.round((m.roughness||0)*20)+'|'+Math.round((m.metalness||0)*10);
  let b=bk.get(key);if(!b){b={key,color:m.color.getHex(),rough:m.roughness,metal:m.metalness,list:[]};bk.set(key,b);}
  const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(!g.attributes.normal) g.computeVertexNormals();b.list.push(g);});
 const buckets=[],bb=new T.Box3();
 for(const b of bk.values()){const g=merge(b.list);g.computeBoundingBox();bb.union(g.boundingBox);buckets.push({g,color:b.color,rough:Math.max(.42,b.rough||.6),metal:Math.min(.32,b.metal||0)});}
 root.traverse(o=>{if(o.geometry) o.geometry.dispose();});
 c=ECACHE[e.id]={buckets,bb,anchors,cover,plenum,refs:1,n:car.eng.n,lay:car.eng.lay};engBuilt++;return c;}
function engineRelease(id){const c=ECACHE[id];if(!c) return;if(--c.refs>0) return;for(const b of c.buckets) b.g.dispose();delete ECACHE[id];}
const EMAT=new Map();
const emat=b=>{const k=b.color+'|'+b.rough+'|'+b.metal;let m=EMAT.get(k);if(!m){m=new T.MeshStandardMaterial({color:new T.Color(b.color).multiplyScalar(1.7),roughness:Math.max(.5,b.rough),metalness:Math.min(.2,b.metal)});EMAT.set(k,m);}return m;};
const BAYM={
 plas:()=>mat('bplas',()=>new T.MeshLambertMaterial({color:0x2a2d32})),blk:()=>mat('bblk',()=>new T.MeshLambertMaterial({color:0x111214,side:T.DoubleSide})),
 grey:()=>mat('bgrey',()=>new T.MeshPhongMaterial({color:0x737982,shininess:35,specular:0x333333})),alu:()=>mat('balu',()=>new T.MeshPhongMaterial({color:0xaab1b9,shininess:60,specular:0x666666})),
 tank:()=>mat('btank',()=>new T.MeshLambertMaterial({color:0xe6ecdf,transparent:true,opacity:.78,side:T.DoubleSide})),capY:()=>mat('bcapy',()=>new T.MeshLambertMaterial({color:0xe8b820})),
 capB:()=>mat('bcapb',()=>new T.MeshLambertMaterial({color:0x2a62c8})),red:()=>mat('bred',()=>new T.MeshLambertMaterial({color:0xc02a20})),
 rad:()=>mat('brad',()=>new T.MeshLambertMaterial({color:0x3b3f45,side:T.DoubleSide})),floor:()=>mat('bfloor',()=>new T.MeshLambertMaterial({color:0x35383d,side:T.DoubleSide})),
 hose:()=>mat('bhose',()=>new T.MeshLambertMaterial({color:0x0c0d0f})),orange:()=>mat('borg',()=>new T.MeshLambertMaterial({color:0xe07a10}))};
function coverTex(car){
 const k='cov'+car.eng.id;let t=MT.get(k);if(t) return t;
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;const x=cv.getContext('2d');
 const gr=x.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#33373d');gr.addColorStop(1,'#1d2024');x.fillStyle=gr;x.fillRect(0,0,512,256);
 x.strokeStyle='rgba(255,255,255,.07)';x.lineWidth=3;for(let i=1;i<9;i++){x.beginPath();x.moveTo(i*56,8);x.lineTo(i*56,248);x.stroke();}
 x.fillStyle='#e4e7ea';x.font='bold 62px "Barlow Condensed","Arial Narrow",Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';
 let f=62;const nm=car.eng.nom.replace(/\s*\(.*\)/,'');x.font='bold '+f+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';while(x.measureText(nm).width>440&&f>22){f-=2;x.font='bold '+f+'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';}
 x.fillText(nm,256,118);x.fillStyle='#9aa1a9';x.font='500 30px "Barlow Condensed","Arial Narrow",Arial,sans-serif';x.fillText(car.eng.code+(car.eng.fuel==='diesel'?' · diesel':''),256,184);
 const tx=new T.CanvasTexture(cv);tx.anisotropy=4;t=new T.MeshStandardMaterial({map:tx,roughness:.6,metalness:.1});MT.set(k,t);return t;}

/* baie électrique : moteur, onduleur, chargeur */
function evParts(add,cz,gc){
 add('grey',cyx(.15,.42,20,-.1,gc+.3,cz));add('alu',cyx(.155,.06,20,.14,gc+.3,cz));add('alu',bxg(.3,.2,.3,-.38,gc+.28,cz));
 add('orange',bxg(.46,.16,.32,.08,gc+.62,cz-.02));add('alu',bxg(.3,.1,.26,-.4,gc+.5,cz-.05));
 for(const sg of [-1,1]) add('orange',tf(new T.TubeGeometry(new T.CatmullRomCurve3([V3(.08,gc+.62,cz+.1*sg),V3(.22,gc+.5,cz+.18*sg),V3(.3,gc+.32,cz+.12*sg)]),8,.014,6,false),0,0,0));}

function engineMesh(car,o){
 car=GET(car);o=o||{};const grp=o.group,G=(grp&&grp.userData.G)||buildGeo(car),g=new T.Group();g.name='bay';
 const hw=G.hw,front=!G.rearLid,lidLo=G.lidLo,lidHi=G.lidHi,gc=G.gc;
 const ud={anchors:{},fit:null,eng:null,dispose:null};g.userData=ud;
 const acc={};const add=(k,geo)=>{(acc[k]||(acc[k]=[])).push(geo);};
 const th=car.ev?PI:car.loc==='front'?(car.ori==='T'?PI:PI/2):car.loc==='rear'?-PI/2:(car.ori==='T'?PI:PI/2);
 const fw=V3(Math.cos(th),0,-Math.sin(th)),trans=Math.abs(fw.x)>.5;
 let eg=null,bb=new T.Box3(),parts=null;
 const topAt=z=>G.top(z);
 const zMin=lidLo+.05,zMax=front?lidHi-.2:lidHi-.04;
 const minTop=Math.min(topAt(zMin),topAt(zMax),topAt((zMin+zMax)/2));
 const availY=minTop-.05-(gc+.09),availZ=zMax-zMin,gbL=trans?.34:0,availX=2*(hw-(front?.3:.26))-gbL;
 let fit={ok:true,f:1};
 if(!car.ev){
  parts=engineParts(car);ud.eng=parts;eg=new T.Group();eg.rotation.y=th;
  for(const b of parts.buckets) eg.add(mesh(b.g,emat(b)));
  eg.scale.setScalar(.001);eg.updateMatrixWorld(true);bb.setFromObject(eg);
  const sz=bb.getSize(V3(0,0,0)),sx=sz.x,sy=sz.y,sz2=sz.z;
  const f=Math.max(.55,Math.min(1,availX/sx,availY/sy,availZ/sz2));
  eg.scale.setScalar(.001*f);eg.updateMatrixWorld(true);bb.setFromObject(eg);
  const c0=bb.getCenter(V3(0,0,0)),s2=bb.getSize(V3(0,0,0));
  let tx=0,tz;
  if(trans){tx=-fw.x*gbL/2;tz=zMin+s2.z/2;}else{tz=zMin+Math.max(0,(availZ-s2.z))*(front?.45:.5)+s2.z/2;}
  const ty=gc+.09+s2.y/2;
  eg.position.set(tx-c0.x,ty-c0.y,tz-c0.z);eg.updateMatrixWorld(true);bb.setFromObject(eg);
  fit={ok:false,f};
 }else{evParts(add,zMin+.3,gc);bb.set(V3(-.55,gc+.12,zMin+.05),V3(.4,gc+.72,zMin+.55));fit={ok:true,f:1};}
 /* position (car coords) d'un point du moteur en mm */
 const ep=v=>v.clone().multiplyScalar(.001*(fit.f||1)).applyAxisAngle(V3(0,1,0),th).add(eg?eg.position:V3(0,0,0));
 const bc=bb.getCenter(V3(0,0,0)),bs=bb.getSize(V3(0,0,0));
 const lx=hw-.4,zF=lidHi-.12;
 /* boîte de vitesses */
 if(!car.ev){
  if(trans){const gx=(fw.x>0?bb.max.x:bb.min.x)+fw.x*gbL/2;add('alu',bxg(gbL,.36,Math.min(bs.z*1.02,.44),gx,bc.y-.02,bc.z));add('alu',cyx(.17,.12,20,(fw.x>0?bb.max.x:bb.min.x)+fw.x*.04,bc.y-.02,bc.z));}
  else{const gz=(fw.z>0?bb.max.z:bb.min.z)+fw.z*.17;add('alu',bxg(.34,.34,.34,bc.x,bc.y-.04,gz));add('alu',cyz(.17,.1,20,bc.x,bc.y-.04,(fw.z>0?bb.max.z:bb.min.z)+fw.z*.04));}}
 /* plancher, tablier, traverse, charnières */
 add('floor',bxg(2*(hw-.12),.02,lidHi-lidLo,0,gc+.06,(lidLo+lidHi)/2));
 add('floor',bxg(2*(hw-.1),Math.max(.2,minTop-gc),.03,0,gc+(minTop-gc)/2,lidLo+.012));
 for(const sg of [-1,1]) add('grey',bxg(.07,.05,.07,sg*hw*.5,G.pivY-.02,lidLo+.02));
 if(front){add('floor',bxg(2*(hw-.1),.3,.05,0,gc+.28,lidHi-.02));add('floor',bxg(2*(hw-.12),.06,.06,0,topAt(lidHi)-.05,lidHi-.03));}
 /* radiateur + ventilateur (à l'avant uniquement) */
 if(front){
  const rz=lidHi-.065;add('rad',bxg(2*(hw-.3),.4,.045,0,gc+.4,rz));for(let i=-4;i<=4;i++) add('blk',bxg(.012,.38,.048,i*(hw-.3)/4.5,gc+.4,rz));
  add('hose',cyz(.17,.07,22,trans?-fw.x*.2:0,gc+.4,rz-.075));add('blk',bxg(.36,.36,.07,trans?-fw.x*.2:0,gc+.4,rz-.075));
  for(let i=0;i<7;i++){const a=i/7*TAU;add('plas',bxg(.14,.012,.05,Math.cos(a)*.08+(trans?-fw.x*.2:0),gc+.4+Math.sin(a)*.08,rz-.115,0,0,a));}
  /* tourelles de suspension et passages de roues */
  for(const sg of [-1,1]){add('grey',cyg(.07,.09,.2,14,sg*(hw-.34),.78,G.afz));add('floor',tf(new T.CylinderGeometry(G.tF.rt+.07,G.tF.rt+.07,.3,26,1,true,0,PI),sg*(hw-.15),G.tF.rt,G.afz,0,0,PI/2));}}
 /* boîte à air, batterie, vase d'expansion, lave-glace, liquide de frein */
 const sx2=bb.max.x+.1,sx1=bb.min.x-.1;
 const bx=Math.min(hw-.3,Math.max(sx2+.1,lx*.8)),ax=-Math.min(hw-.3,Math.max(-sx1+.1,lx*.8));
 const batZ=front?zF-.2:(lidLo+lidHi)/2+.2,batY=Math.max(gc+.16,front?.58:gc+.2);
 add('plas',bxg(.24,.18,.17,bx,batY,batZ));add('red',cyg(.014,.014,.025,8,bx-.08,batY+.1,batZ-.04));add('blk',cyg(.014,.014,.025,8,bx+.08,batY+.1,batZ-.04));
 add('grey',bxg(.26,.012,.03,bx,batY+.09,batZ));
 const abZ=front?zF-.22:(lidLo+lidHi)/2-.2,abY=front?.62:gc+.25;
 if(!car.ev){add('plas',bxg(.32,.17,.22,ax,abY,abZ));add('hose',tf(new T.CylinderGeometry(.045,.045,.34,12),ax+.04,abY,abZ+.22,PI/2,0,0));}
 if(!car.ev){const ip=parts&&parts.anchors.intake?ep(parts.anchors.intake):V3(bc.x,bb.max.y-.05,bc.z);
  const cv=new T.CatmullRomCurve3([V3(ax,abY+.02,abZ-.1),V3((ax+ip.x)/2,abY+.08,abZ-.1),V3(ip.x,Math.min(ip.y,minTop-.08),ip.z)]);add('hose',new T.TubeGeometry(cv,12,.032,8,false));}
 const vz=front?lidLo+.14:(lidLo+lidHi)/2,vx=front?Math.min(hw-.45,Math.max(.25,bb.max.x*.0+.3)):-.4;
 add('tank',bxg(.17,.17,.12,vx,minTop-.17,vz));add('capY',cyg(.03,.03,.025,12,vx,minTop-.065,vz));
 add('hose',new T.TubeGeometry(new T.CatmullRomCurve3([V3(vx,minTop-.24,vz),V3(vx*.6,gc+.5,vz+.15),V3(bc.x*.5,bc.y+.1,bc.z)]),10,.012,6,false));
 const wz=front?zF-.02:(lidLo+lidHi)/2-.05;add('tank',bxg(.14,.2,.16,-(hw-.34),front?.5:gc+.2,wz));add('capB',cyg(.028,.028,.03,12,-(hw-.34),(front?.5:gc+.2)+.115,wz));
 const bfx=.36,bfy=Math.min(minTop-.1,.78);add('hose',cyz(.1,.12,18,.32,bfy-.12,lidLo+.1));add('tank',bxg(.09,.09,.07,bfx,bfy,lidLo+.1));add('capY',cyg(.02,.02,.02,10,bfx,bfy+.055,lidLo+.1));
 /* cache-moteur et bouchons */
 let covBox=null;
 if(!car.ev&&parts){
  const src=parts.lay==='F'?null:(parts.lay==='V'&&parts.plenum?parts.plenum:parts.cover);
  if(src){const pts=[];for(const x of [src.min.x,src.max.x]) for(const y of [src.min.y,src.max.y]) for(const z of [src.min.z,src.max.z]) pts.push(ep(V3(x,y,z)));covBox=new T.Box3().setFromPoints(pts);}
  ud.cover=covBox;
  if(covBox){const cs=covBox.getSize(V3(0,0,0)),cc=covBox.getCenter(V3(0,0,0)),topY=covBox.max.y+.008;
   const w=Math.max(.2,cs.x*.92),d=Math.max(.16,Math.min(cs.z*.9,.34));add('plas',bxg(w,.014,d,cc.x,topY,cc.z));
   const pl=new T.Mesh(new T.PlaneGeometry(w*.9,d*.88),coverTex(car));pl.rotation.x=-PI/2;pl.position.set(cc.x,topY+.0085,cc.z);pl.name='cover';g.add(pl);}}
 const A=ud.anchors,setA=(k,v)=>{A[k]=v.clone();};
 const ocp=parts&&parts.anchors.oilCap?ep(parts.anchors.oilCap):V3(bc.x,bb.max.y,bc.z);
 setA('oilCap',ocp);if(!car.ev) add('capY',cyg(.034,.034,.022,14,ocp.x,ocp.y+.012,ocp.z));
 const dp=ocp.clone().add(V3(.0,-.02,front?.1:-.1));setA('dipstick',dp);if(!car.ev){add('capY',new T.TorusGeometry(.016,.006,6,12).rotateX(PI/2).translate(dp.x,dp.y+.02,dp.z));add('hose',cyg(.004,.004,.2,6,dp.x,dp.y-.08,dp.z));}
 setA('alternator',parts&&parts.anchors.alternator?ep(parts.anchors.alternator):V3(bb.min.x,bc.y,bc.z));
 setA('coils',parts&&parts.anchors.coils?ep(parts.anchors.coils):bc);setA('timing',parts&&parts.anchors.timing?ep(parts.anchors.timing):bc);
 setA('battery',V3(bx,batY,batZ));setA('airbox',V3(ax,abY,abZ));setA('coolant',V3(vx,minTop-.17,vz));setA('washer',V3(-(hw-.34),front?.5:gc+.2,wz));setA('brakeFluid',V3(bfx,bfy,lidLo+.1));
 setA('bay',V3(0,gc+.06,G.bayZ));setA('hoodPivot',V3(0,G.pivY,lidLo));
 if(front) setA('radiator',V3(0,gc+.4,lidHi-.065));
 /* regroupe par matériau */
 for(const k in acc){const m=mesh(merge(acc[k]),BAYM[k]());m.name='bay_'+k;g.add(m);}
 if(eg){eg.name='engine';g.add(eg);}
 /* tient-il dans la baie ? */
 const zb0=lidLo,zb1=lidHi,xb=hw-.1;
 fit.box={min:{x:bb.min.x,y:bb.min.y,z:bb.min.z},max:{x:bb.max.x,y:bb.max.y,z:bb.max.z}};fit.bay={x0:-xb,x1:xb,y0:gc,y1:minTop,z0:zb0,z1:zb1};
 fit.size={x:bs.x,y:bs.y,z:bs.z};
 if(!car.ev) fit.ok=bb.min.x>=-xb-.001&&bb.max.x<=xb+.001&&bb.min.y>=gc-.001&&bb.max.y<=minTop+.001&&bb.min.z>=zb0-.001&&bb.max.z<=zb1+.001;
 ud.fit=fit;
 ud.dispose=()=>{g.traverse(m=>{if(m.isMesh&&m.parent===g&&m.geometry&&m.name.indexOf('bay_')===0) m.geometry.dispose();if(m.name==='cover'&&m.geometry) m.geometry.dispose();});if(!car.ev) engineRelease(car.eng.id);if(g.parent) g.parent.remove(g);};
 return g;}
const bayBuilt=g=>!!(g&&g.userData&&g.userData.bay);

/* ═══════════ 10. Branchement sur le socle ═══════════ */
const oldCarMesh=MW.carMesh;
MW.carMesh=function(o){
 o=o||{};
 try{
  let car=o.model?GET(o.model):null;
  if(!car) car=pick(o.kind&&['citadine','berline','suv','utilitaire','sport'].includes(o.kind)?o.kind:'berline');
  const g=makeCar(car,o);if(nightOn===null) setNight(!!(MW.isNight&&MW.isNight()));return g;
 }catch(err){console.error('MWCARS.carMesh',err);return oldCarMesh(o);}};
/* js/41 : les clientèles des garages (MODELS, tuples [marque, modèle + moteur, kind, id]) deviennent des voitures réelles, mises à jour sur place */
try{const D=window.__mwj&&window.__mwj.noirData&&window.__mwj.noirData.MODELS;
 if(D) for(const z of ['garage1','garage2','garage3','garage4']){if(!D[z]) D[z]=[];D[z].length=0;for(const c of pool(z)) D[z].push(tuple(c));}}catch(err){console.error('MWCARS.MODELS',err);}
let nf0=0;
MW.on('tick',()=>{if(++nf0%3===0) track();});
MW.on('minute',()=>{try{setNight(!!MW.isNight());}catch(e){}});
MW.on('start',()=>{try{setNight(!!MW.isNight());}catch(e){}});

const api={list:CARS,ENG,get:GET,ids:()=>CARS.map(c=>c.id),byCat,pool,pick,tuple,label,toS,checkS,applies,partName,partPrice,oilL:c=>GET(c).eng.oilL,
 fullName,engineMesh,bayBuilt,anchor,anchorWorld,setPlate,build:makeCar,geo:buildGeo,POOL,
 dims:c=>{c=GET(c);return c?{L:c.L,W:c.W,H:c.H,WB:c.WB}:null;},
 stats:()=>({geo:Object.keys(GEO).length,engines:Object.keys(ECACHE),built,freed,live:LIVE.size,engBuilt}),
 track,
 /* points d'interaction du capot, de la cabine et des roues autour de la voiture posée (décalages locaux {x,z} : x = côté gauche, z = avant) */
 pts(c){c=GET(c);const G=buildGeo(c),hw=G.hw;
  return {capot:{x:0,z:G.rearLid?G.lidLo-.9:G.lidHi+.9},cabine:{x:hw+.8,z:G.sx*0+(G.afz+G.arz)/2},dessous:{x:0,z:(G.afz+G.arz)/2},FL:{x:hw+.8,z:G.afz},FR:{x:-(hw+.8),z:G.afz},RL:{x:hw+.8,z:G.arz},RR:{x:-(hw+.8),z:G.arz}};}};
window.__mwcars=api;
return api;
})();
