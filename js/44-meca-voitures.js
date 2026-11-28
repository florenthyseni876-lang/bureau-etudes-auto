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
/* idem, avec couleur par sommet : list = [{g, color (hex), rough, metal}] ; regroupe par classe de rugosité et de métal, d'où très peu de maillages */
/* groupes de pièces regroupés par rugosité / métal ; seul=true : un seul lot (petites pièces amovibles : un appel de dessin au lieu de plusieurs) */
function mergeVC(list,mul,seul){
 const cls=new Map(),c=new T.Color();
 for(const it of list){
  const r=it.rough==null?.6:it.rough,m=it.metal||0,rk=seul?.6:r<.5?.5:r<.7?.6:.8,mk=seul?.08:m>=.6?.2:m>=.3?.1:.02,key=rk+'|'+mk;
  let b=cls.get(key);if(!b){b={rough:rk,metal:mk,list:[]};cls.set(key,b);}
  const g=it.g,n=g.attributes.position.count,col=new Float32Array(n*3);c.setHex(it.color).multiplyScalar(mul||1);
  for(let i=0;i<n;i++){col[3*i]=c.r;col[3*i+1]=c.g;col[3*i+2]=c.b;}
  g.setAttribute('color',new T.BufferAttribute(col,3));b.list.push(g);}
 const out=[];
 for(const b of cls.values()){
  const pos=[],nor=[],cl=[],idx=[];let off=0;
  for(const g of b.list){const p=g.attributes.position.array,n=g.attributes.normal?g.attributes.normal.array:null,cc=g.attributes.color.array,cnt=g.attributes.position.count;
   for(let i=0;i<p.length;i++){pos.push(p[i]);nor.push(n?n[i]:0);cl.push(cc[i]);}
   if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++) idx.push(a[i]+off);}else for(let i=0;i<cnt;i++) idx.push(off+i);
   off+=cnt;g.dispose();}
  const o=new T.BufferGeometry();o.setAttribute('position',new T.Float32BufferAttribute(pos,3));o.setAttribute('normal',new T.Float32BufferAttribute(nor,3));o.setAttribute('color',new T.Float32BufferAttribute(cl,3));
  o.setIndex(new T.BufferAttribute(off>65000?new Uint32Array(idx):new Uint16Array(idx),1));out.push({g:o,color:0xffffff,rough:b.rough,metal:b.metal,vc:true});}
 return out;}
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
 hatch:{uc:.275,uf:.465,ur:.745,ub:.955,hn:.50,hb:.645,hd:.665,rb:.35,fb:.46,pill:[.50],cp:.04,roofW:.80,glassUp:1},
 mini:{uc:.27,uf:.44,ur:.80,ub:.975,hn:.49,hb:.63,hd:.645,rb:.45,fb:.42,pill:[],cp:.05,roofW:.82,glassUp:1},
 sedan:{uc:.39,uf:.55,ur:.715,ub:.82,hn:.50,hb:.645,hd:.68,rb:.35,fb:.46,pill:[.52],cp:.20,roofW:.78,glassUp:1},
 wagon:{uc:.33,uf:.50,ur:.875,ub:.975,hn:.51,hb:.65,hd:.66,rb:.7,fb:.46,pill:[.52,.75],cp:.04,roofW:.80,glassUp:1},
 suv:{uc:.30,uf:.47,ur:.855,ub:.975,hn:.60,hb:.69,hd:.70,rb:.6,fb:.46,pill:[.50,.73],cp:.04,roofW:.80,glassUp:1},
 van:{uc:.20,uf:.37,ur:.93,ub:.995,hn:.47,hb:.575,hd:.60,rb:.9,fb:.42,pill:[.50],cp:.03,roofW:.84,glassUp:1},
 coupe:{uc:.30,uf:.50,ur:.76,ub:.95,hn:.455,hb:.615,hd:.615,rb:.3,fb:.46,pill:[],cp:.12,roofW:.76,glassUp:1},
 mid:{uc:.32,uf:.50,ur:.63,ub:.72,hn:.46,hb:.60,hd:.575,rb:.4,fb:.46,pill:[],cp:.12,roofW:.76,glassUp:1,lidR:.945},
 rear:{uc:.33,uf:.52,ur:.62,ub:.80,hn:.52,hb:.60,hd:.585,rb:.3,fb:.46,pill:[],cp:.12,roofW:.78,glassUp:1,lidR:.935}};
/* retouches par voiture, d'après les profils réels (distances depuis l'avant ÷ longueur) : position du bas du pare-brise (uc), du bord avant du toit (uf),
   de la fin du toit (ur) et du bas de la lunette ou du hayon (ub) */
const SHCAR={
 p206:{uc:.26,uf:.45,ur:.75,ub:.95},fiat500:{uc:.265,uf:.43,ur:.80,ub:.975},yaris3:{uc:.265,uf:.45,ur:.76},
 gryaris:{uc:.29,uf:.48,ur:.72,ub:.94},meganers:{uc:.30,uf:.50,ur:.76,ub:.945},golfgti:{uc:.28,uf:.47,ur:.74},rs3:{uc:.285,uf:.48,ur:.745},
 berlingo3:{uc:.22,uf:.38},kangoo2:{uc:.20,uf:.37},partner2:{uc:.21,uf:.375},
 captur2:{uc:.285,uf:.46,ur:.84},duster2:{uc:.30,uf:.47,ur:.855},p3008:{uc:.31,uf:.50,ur:.85},xc60:{uc:.34,uf:.51,ur:.845},tiguan2:{uc:.31,uf:.485,ur:.855},
 mustang:{uc:.43,uf:.60,ur:.72,ub:.87,hn:.47,hb:.66,hd:.67},
 a6c8:{uc:.40,uf:.56,ur:.73,ub:.83},c220d:{uc:.395,uf:.55,ur:.71,ub:.815},m3g80:{uc:.39,uf:.545,ur:.715,ub:.82},
 octavia4:{uc:.335,uf:.505,ur:.88,ub:.975},
 huracan:{uc:.32,uf:.52,ur:.60,ub:.68},a110:{uc:.31,uf:.49,ur:.64,ub:.72},cayman:{uc:.32,uf:.50,ur:.64,ub:.74},
 p911:{uc:.325,uf:.52,ur:.63,ub:.81}};
/* matériaux partagés */
const MT=new Map();
function mat(key,mk){let m=MT.get(key);if(!m){m=mk();MT.set(key,m);}return m;}
/* une peinture blanche réelle réfléchit environ 85 % : on plafonne la clarté pour ne pas saturer sous la baladeuse */
const softPaint=c=>{const r=c>>16&255,g=c>>8&255,b=c&255,mx=Math.max(r,g,b);if(mx<=222) return c;const k=222/mx;return (Math.round(r*k)<<16)|(Math.round(g*k)<<8)|Math.round(b*k);};
const paintMat=c=>mat('p'+c,()=>new T.MeshPhongMaterial({color:softPaint(c),shininess:55,specular:0x3a3a3a,side:T.DoubleSide}));
const MATS={
 glass:()=>mat('glass',()=>new T.MeshPhongMaterial({color:0x16222c,shininess:100,specular:0x8899aa,transparent:true,opacity:.6,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4})),
 dark:()=>mat('dark',()=>new T.MeshLambertMaterial({color:0x17181b,side:T.DoubleSide})),
 trim:()=>mat('trim',()=>new T.MeshPhongMaterial({color:0x26282c,shininess:25,specular:0x222222,side:T.DoubleSide})),
 chrome:()=>mat('chrome',()=>new T.MeshPhongMaterial({color:0xc4c8ce,shininess:90,specular:0xdddddd})),
 rubber:()=>mat('rubber',()=>new T.MeshLambertMaterial({color:0x17181a})),
 alu:()=>mat('alu',()=>new T.MeshPhongMaterial({color:0xbfc4cb,shininess:80,specular:0x999999,side:T.DoubleSide})),
 graph:()=>mat('graph',()=>new T.MeshPhongMaterial({color:0x4b4e54,shininess:70,specular:0x666666,side:T.DoubleSide})),
 steelw:()=>mat('steelw',()=>new T.MeshPhongMaterial({color:0x8d939b,shininess:50,specular:0x555555,side:T.DoubleSide})),
 disc:()=>mat('disc',()=>new T.MeshPhongMaterial({color:0xa4aab2,shininess:95,specular:0xbbbbbb})),
 drum:()=>mat('drum',()=>new T.MeshLambertMaterial({color:0x6a5f55})),
 caliperD:()=>mat('calD',()=>new T.MeshPhongMaterial({color:0x6d747d,shininess:60,specular:0x555555})),
 caliperB:()=>mat('calB',()=>new T.MeshPhongMaterial({color:0x2458b0,shininess:60,specular:0x444444})),
 caliperR:()=>mat('calR',()=>new T.MeshLambertMaterial({color:0xc0201c})),
 under:()=>mat('under',()=>new T.MeshLambertMaterial({color:0x5b564f,side:T.DoubleSide})),
 sub:()=>mat('sub',()=>new T.MeshPhongMaterial({color:0x26282d,shininess:35,specular:0x2a2a2a,side:T.DoubleSide})),
 steel:()=>mat('steel',()=>new T.MeshPhongMaterial({color:0x80868e,shininess:55,specular:0x555555})),
 head:()=>mat('head',()=>{const m=new T.MeshPhongMaterial({color:0xdfe7ee,shininess:100,specular:0xffffff,emissive:0xfff3c8});m.emissiveIntensity=.12;return m;}),
 tail:()=>mat('tail',()=>{const m=new T.MeshPhongMaterial({color:0x9a1018,shininess:80,specular:0x886666,emissive:0xff2020});m.emissiveIntensity=.2;return m;}),
 amber:()=>mat('amber',()=>{const m=new T.MeshPhongMaterial({color:0xd98a10,shininess:60,emissive:0xffa000});m.emissiveIntensity=.15;return m;}),
 inter:()=>mat('inter',()=>new T.MeshLambertMaterial({color:0x34373d,side:T.DoubleSide})),
 hoodUnder:()=>mat('hoodU',()=>new T.MeshLambertMaterial({color:0x4b4f56,emissive:0x0c0d0f,side:T.DoubleSide})),
 cast:()=>mat('cast',()=>new T.MeshPhongMaterial({color:0xaeb4bb,shininess:60,specular:0x777777})),
 exh:()=>mat('exh',()=>new T.MeshPhongMaterial({color:0x8a5a3c,shininess:25,specular:0x2a2a2a}))};
/* éclairage de nuit : les feux sont émissifs quand il fait nuit */
let nightOn=null;
function setNight(n){if(n===nightOn) return;nightOn=n;
 const h=MATS.head(),t=MATS.tail(),a=MATS.amber();h.emissiveIntensity=n?.95:.12;t.emissiveIntensity=n?.7:.2;a.emissiveIntensity=n?.3:.15;}

/* ═══════════ 6. Carrosserie, roues, détails d'un modèle (géométries partagées, mises en cache) ═══════════ */
const GEO={};
/* roue : pneu (profil avec flanc bombé) + jante (tonneau + rayons), axe x, face vers +x */
function wheelGeo(t,style,rimC,nn){
 nn=nn||5;const key=[t.w,t.a,t.rim,style,rimC,nn,qSeg(30,15)].join('|');if(GEO[key]) return GEO[key];
 const {w,rimR,rt}=t,sw=rt-rimR,R=rimR-.004;
 const P=(r,y)=>new T.Vector2(r,y);
 const prof=[P(rimR+.002,-w*.36),P(rimR+sw*.2,-w*.485),P(rimR+sw*.55,-w*.515),P(rt-.022,-w*.47),P(rt-.005,-w*.40),P(rt,-w*.30),P(rt,w*.30),P(rt-.005,w*.40),P(rt-.022,w*.47),P(rimR+sw*.55,w*.515),P(rimR+sw*.2,w*.485),P(rimR+.002,w*.36),P(rimR-.004,w*.30),P(rimR-.004,-w*.30),P(rimR+.002,-w*.36)];
 const tire=new T.LatheGeometry(prof,qSeg(30,15));tire.rotateZ(-PI/2);
 const rw=Math.min(w*.82,.28),yo=rw/2-.03,hubR=.052,parts=[];
 const barrel=new T.LatheGeometry([P(R*.78,-rw/2),P(R*.96,-rw/2+.012),P(R,-rw/2+.03),P(R,rw/2-.02),P(R*.995,rw/2-.006),P(R*.97,rw/2)],qSeg(28,14));parts.push(barrel);
 const sp=(n,wid,len0,r0,off)=>{for(let i=0;i<n;i++){const a=i/n*TAU+(off||0),rc=(r0+len0)/2;parts.push(tf(new T.BoxGeometry((len0-r0),.024,wid),Math.cos(a)*rc,yo,Math.sin(a)*rc,0,-a,0));}};
 if(style==='steel'){
  parts.push(cyg(R*.93,R*.93,.012,28,0,rw/2-.09,0));parts.push(cyg(R*.55,R*.55,.01,24,0,rw/2-.083,0));
  for(let i=0;i<6;i++){const a=i/6*TAU;parts.push(cyg(.012,.012,.014,8,Math.cos(a)*R*.74,rw/2-.083,Math.sin(a)*R*.74));}
  parts.push(cyg(.062,.07,.03,20,0,rw/2-.07,0));}
 else if(style==='a10'){sp(10,.03,R*.96,hubR,0);sp(10,.012,R*.9,hubR+.01,TAU/20);}
 else if(style==='a7'){sp(7,.052,R*.96,hubR,0);}
 else sp(5,.07,R*.96,hubR,0);
 if(style!=='steel'){parts.push(cyg(hubR+.012,hubR+.016,.034,20,0,yo,0));parts.push(cyg(.012,.012,.036,8,0,yo+.01,0));}
 /* écrous : au même endroit que ceux du geste de dépose (js/46) ; le maillage « rimBare » en est dépourvu (js/46 le pose pendant qu'on travaille sur la voiture) */
 const bare=merge(parts.map(g=>g.clone()));bare.rotateZ(-PI/2);
 for(let i=0;i<nn;i++){const a=i/nn*TAU+.31;parts.push(cyg(.0145,.0145,.026,6,Math.cos(a)*.056,yo+.038,Math.sin(a)*.056));}
 if(style!=='steel') parts.push(cyg(.007,.007,.03,6,Math.cos(TAU*.62)*(R*.9),yo-.02,Math.sin(TAU*.62)*(R*.9)));   /* valve */
 const rim=merge(parts);rim.rotateZ(-PI/2);
 return (GEO[key]={tire,rim,rimBare:bare,rw,style});}
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
 const sh=Object.assign({},SHAPES[car.body]||SHAPES.hatch,SHCAR[car.id]||{},car.sh||{});
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
  const yF=yfl(z)+.11,R=[[.6*hw,yF],[.62*hw,ybz],[.86*hw,ybz],[.972*hw,ybz+Math.min(.04,hh*.3)],[hw,ybz+.14*hh],[hw,ybz+.78*hh],[.978*hw,ytf-.034*vs],[.9*hw,ytf-.006],[.64*hw,ytf],[.6*hw,ytc]];
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
 const paint=[],dark=[],trim=[],chrome=[],glass=[],head=[],tail=[],amber=[],inter=[],steel=[],ubel=[],sub=[],uexA=[],ualuA=[];
 paint.push(loft(rings));
 /* dessous sombre (plancher, voûtes de roues) */
 {const ur=zs.map(z=>{const {wf}=endF(z),y=yb(z)-.002,yF=yfl(z)+.108;return {z,pts:[[-.86*hw*wf,y],[-.62*hw*wf,y],[-.62*hw*wf,yF],[.62*hw*wf,yF],[.62*hw*wf,y],[.86*hw*wf,y]],closed:false};});ubel.push(loft(ur));}   /* passage de roue en boîte : paroi verticale côté intérieur (on y voit l'amortisseur et le ressort) */
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
 const dRear=car.doors>3?(bz.length?bz[0]:zc-L*.34):Math.max(zrb+.3,dz0-1.15);
 const cuts=[dz0,dRear];for(const b of bz) cuts.push(b);if(rearDoor!=null&&car.doors>3) cuts.push(rearDoor);
 for(const z of cuts) for(const sg of [-1,1]) trim.push(bxg(.006,doorTop-sill,.006,sg*(hw+.0015),(doorTop+sill)/2,z));
 const handles=[];if(car.doors<=3||!bz.length) handles.push(zc-.78);else{handles.push(bz[0]+.2);handles.push(bz[0]-.1);}
 for(const z of handles) for(const sg of [-1,1]){(car.cat==='prem'?chrome:trim).push(bxg(.02,.022,.13,sg*(hw+.006),hb-.09,z));dark.push(bxg(.01,.05,.19,sg*(hw+.003),hb-.09,z));}
 const mz=zc-.2;
 for(const sg of [-1,1]){paint.push(bxg(.1,.13,.17,sg*(hw+.1),hb+.1,mz));paint.push(bxg(.12,.03,.04,sg*(hw+.045),hb+.06,mz+.04));trim.push(bxg(.085,.11,.005,sg*(hw+.1),hb+.1,mz-.087));trim.push(bxg(.06,.04,.09,sg*(hw+.03),hb+.075,mz+.06));amber.push(bxg(.012,.02,.05,sg*(hw+.006),hb-.14,afz+archR(tF)+.12));}
 for(const sg of [-1,1]) trim.push(bxg(.04,.06,Math.abs(dz0-dRear)+.15,sg*(hw+.012),sill-.03,(dz0+dRear)/2));   /* bas de caisse */
 const fuelX=-(hw+.002),fuelZ=Math.max(zr+.4,arz-archR(tR)-.2);dark.push(cyx(.074,.014,20,fuelX+.001,hb-.2,fuelZ));paint.push(cyx(.066,.01,20,fuelX-.017,hb-.2,fuelZ));trim.push(bxg(.012,.012,.03,fuelX-.034,hb-.2,fuelZ-.04));
 /* pare-chocs, calandre, feux : posés sur la surface avant/arrière réelle (la section se resserre aux extrémités) */
 const surf=(front,xa,ylo,yhi)=>{let dd=0;for(;dd<E_END;dd+=.003){const z=front?zf-dd:zr+dd,{wf,vf}=endF(z),ytc=top(z),ybz=yb(z),ym=(ybz+ytc)/2,yt=ym+(ytc-ym)*vf,yB=ym-(ym-ybz)*vf;
   if(xa<=hw*wf*.96&&yhi<=yt-.012&&ylo>=yB+.012) break;}
  return front?zf-dd:zr+dd;};
 const onFace=(arr,front,x,yn,w,h,d,oo)=>{ oo=oo==null?.02:oo; /* boîte posée sur la face, suivant la courbure du coin */
  const xa=Math.abs(x),sg=x>=0?1:-1,dir=front?1:-1,z0=surf(front,xa,yn,yn),zo=surf(front,xa+w*.45,yn,yn),zi=surf(front,Math.max(0,xa-w*.45),yn,yn);
  const s=(zo-zi)/Math.max(.02,Math.min(w*.9,xa+w*.45)),yaw=-sg*Math.atan(s);
  arr.push(bxg(w,h,d,x,yn,z0+dir*(oo-d/2),0,yaw,0));return z0;};
 let headPos=null,tailPos=null,wiperPos=null;
 const ytn=hn-.075,lw=.095*W+.1,lh=car.body==='van'?.15:.095,headY=Math.max(gc+.46,ytn-.02);
 for(const sg of [-1,1]){
  onFace(dark,true,sg*hw*.64,headY,lw+.035,lh+.032,.03,.012);                       /* lunette sombre de l'optique */
  const zh=onFace(head,true,sg*hw*.64,headY,lw,lh,.05);if(sg>0) headPos=[sg*(hw*.64-lw*.2),headY,zh+.026];
  onFace(chrome,true,sg*(hw*.64-lw*.2),headY,.06,.06,.036,.026);                      /* réflecteur */
  onFace(head,true,sg*hw*.64,headY-lh/2-.032,lw*.85,.014,.034,.022);                  /* feu de jour */
  onFace(amber,true,sg*hw*.8,headY-lh*.55-.012,lw*.3,lh*.32,.05);}
 {const gy=Math.max(gc+.42,headY-.015);
  onFace(dark,true,0,gy,hw*.7,.075,.05);
  if(car.cat!=='pop'){onFace(chrome,true,0,gy+.048,hw*.7,.012,.052);onFace(chrome,true,0,gy-.048,hw*.7,.012,.052);}
  const iy=gc+.25;onFace(dark,true,0,iy,hw*1.0,.12,.05);
  for(const sg of [-1,1]){onFace(dark,true,sg*hw*.76,iy,.2,.07,.05);onFace(head,true,sg*hw*.76,iy,.085,.04,.034,.024);}   /* antibrouillards */
  for(const k of [-1,0,1]) onFace(trim,true,0,gy+k*.022,hw*.66,.006,.034,.027);        /* lames de calandre */
  onFace(trim,true,0,gc+.125,hw*1.55,.04,.05,.016);}                                  /* lèvre du pare-chocs */
 {const ty=Math.min(top(zr+.01)-.1,hd-.1),tw=car.body==='van'?.1:.1*W+.12,th=car.body==='van'?.34:.1;
  for(const sg of [-1,1]){onFace(dark,false,sg*hw*.68,ty,tw+.03,th+.03,.03,.012);onFace(tail,false,sg*hw*.68,ty,tw,th,.05);if(sg>0) tailPos=[sg*hw*.68,ty,surf(false,hw*.68,ty,ty)-.02];
   onFace(head,false,sg*(hw*.68-tw*.28),ty,tw*.26,th*.4,.034,.026);onFace(amber,false,sg*hw*.8,ty-th*.6,tw*.3,.03,.05);}
  onFace(trim,false,0,gc+.15,hw*1.45,.045,.05,.016);}
 /* plaques françaises (plans, texture ajoutée à l'instance) */
 const pyF=Math.max(gc+.3,(yb(zf-.15)+top(zf-.15))/2-.04),pyR=(top(zr+.12)+yb(zr+.12))/2+.03;
 const plateF={x:0,y:pyF,z:surf(true,0,pyF,pyF)+.004},plateR={x:0,y:pyR,z:surf(false,0,pyR,pyR)-.004};
 /* dessous (échappement, réservoir, trains, boîte…) : js/44c, un seul maillage coloré par sommet */
 const exX=hw*.42;
 /* intérieur sommaire */
 const zSeat=zc-(car.loc==='front'?.86:.55)-(car.body==='mid'?.35:0),sx=.36,sy=.4;
 const seat=(x,z)=>{inter.push(bxg(.5,.13,.5,x,sy,z));inter.push(bxg(.5,.55,.12,x,sy+.33,z-.27,-.18,0,0));inter.push(bxg(.22,.14,.09,x,sy+.68,z-.31,-.18,0,0));};
 seat(sx,zSeat);seat(-sx,zSeat);
 if(car.doors>2&&car.body!=='mid'&&car.body!=='rear'){inter.push(bxg(1.2,.13,.5,0,sy,zSeat-.86));inter.push(bxg(1.2,.5,.12,0,sy+.3,zSeat-1.12,-.18,0,0));}
 const dashY=hb-.12;inter.push(bxg(W-.34,.2,.3,0,dashY,zc-.2));inter.push(bxg(.26,.22,.5,0,sy+.1,zSeat+.2));
 const wheelCt=V3(sx,dashY+.1,zc-.62);
 const sw=new T.TorusGeometry(.17,.016,8,18);tf(sw,sx,dashY+.12,zc-.66,-.35,0,0);inter.push(sw);inter.push(bxg(.02,.02,.16,sx,dashY+.04,zc-.62));
 inter.push(bxg(W-.32,.02,Math.max(1,zc-zrb-.6),0,.27,(zc+zrb)/2-.1));
 /* [habitacle] combiné, aérateurs, autoradio, console, levier, pédalier, contre-portes, ceintures, ciel de toit */
 const cardP=[],bar=(arr,x1,y1,z1,x2,y2,z2,w,h)=>{const dx=x2-x1,dy=y2-y1,dz=z2-z1,len=Math.hypot(dx,dy,dz)||.01;arr.push(bxg(w,h,len,(x1+x2)/2,(y1+y2)/2,(z1+z2)/2,-Math.asin(dy/len),Math.atan2(dx,dz),0));};
 const zDash=zc-.36;
 inter.push(bxg(.4,.12,.14,sx,dashY+.13,zc-.4));inter.push(bxg(.3,.07,.012,sx,dashY+.12,zc-.475));       /* visière et cadran du combiné */
 for(const k of [-.5,-.2,.2,.5]) inter.push(bxg(.1,.04,.02,k*hw,dashY+.07,zDash));                          /* aérateurs */
 inter.push(bxg(.24,.13,.03,0,dashY-.03,zDash-.005));inter.push(bxg(.18,.06,.03,0,dashY-.13,zDash-.005));  /* autoradio et commandes de ventilation */
 inter.push(bxg(.09,.075,.035,sx,dashY+.12,zc-.665,-.35,0,0));bar(inter,sx,dashY+.08,zc-.62,sx,dashY-.02,zc-.45,.05,.05);   /* moyeu du volant et colonne */
 inter.push(bxg(.06,.03,.1,sx+.14,dashY+.12,zc-.58));                                                          /* commodo */
 bar(inter,0,sy+.2,zSeat+.3,0,sy+.4,zSeat+.28,.025,.025);inter.push(bxg(.05,.05,.05,0,sy+.43,zSeat+.28));   /* levier de vitesses */
 bar(inter,0,sy+.2,zSeat+.02,0,sy+.28,zSeat-.2,.02,.03);                                                       /* frein à main */
 inter.push(bxg(W-.34,.012,.4,0,H-.1,zc-.55));                                                                 /* ciel de toit */
 {const pz=zSeat+.42;inter.push(bxg(.06,.14,.02,sx-.14,.3,pz,-.5,0,0));inter.push(bxg(.08,.14,.02,sx+.14,.3,pz+.02,-.5,0,0));}   /* accélérateur et embrayage (le frein est mobile) */
 for(const sg of [-1,1]){const zm=(dz0+dRear)/2;
  const A=sg<0?cardP:inter;                                                                                    /* contre-porte passager : variante, elle suit la portière quand on l'ouvre */
  A.push(bxg(.04,.34,Math.abs(dz0-dRear)-.1,sg*(hw-.07),(sill+hb)/2-.06,zm));                                /* contre-porte */
  A.push(bxg(.07,.04,.36,sg*(hw-.09),hb-.12,zm-.05));                                                        /* accoudoir */
  const bx0=sg*sx;bar(inter,bx0+sg*.3,sy+.7,zSeat-.34,bx0-sg*.16,sy+.1,zSeat+.1,.05,.006);                    /* ceinture */
  inter.push(bxg(.05,.06,.05,bx0-sg*.2,sy+.08,zSeat+.06));}
 /* essuie-glaces : bras et balais posés sur le pare-brise ; le balai côté conducteur est amovible (variante de garniture sans lui) */
 const wiper=[],bladeD=[];
 {const wz=zc-.03+(zRf+.025-(zc-.03))*.1,wy=roofY(wz)+.02,th=-Math.atan((roofY(wz+.02)-roofY(wz-.02))/.04),aw=gz(wz).wt*.9,len=aw*.78;
  dark.push(bxg(aw*2,.014,.1,0,top(zc)+.014,zc+.0));                                                        /* auvent sous le pare-brise */
  for(const sg of [-1,1]){const cx=sg*aw*.5,arr=sg>0?bladeD:wiper;
   arr.push(bxg(len,.012,.022,cx,wy,wz,th,0,0));arr.push(bxg(len*.96,.006,.01,cx,wy+.008,wz,th,0,0));
   bar(wiper,cx-sg*len*.32,top(zc)+.016,zc+.04,cx,wy+.012,wz,.016,.012);}
  wiperPos=[aw*.5,wy+.004,wz,th];
  if(car.body!=='sedan'&&car.body!=='coupe'&&car.body!=='mid'&&car.body!=='rear'){
   const rz=zRr-.025+(zrb+.03-(zRr-.025))*.35,ry=roofY(rz)+.02,rt=-Math.atan((roofY(rz+.02)-roofY(rz-.02))/.04);
   wiper.push(bxg(.36,.012,.02,0,ry,rz,rt,0,0));bar(wiper,0,ry-.0,rz-.03,.1,ry-.0,rz,.014,.01);}}
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
  hoodPivot:[0,pivY,lidLo],cabin:[sx,.95,zSeat],headL:headPos,tailL:tailPos,wiperD:wiperPos.slice(0,3)};
 const eZc=car.loc==='front'?(car.ori==='T'?zc+.3:zc+.5):bayZ;
 const CH=MWCH.build(car,{gc,hw,W,L,tF,tR,afz,arz,zf,zr,wxF:hw-tF.w/2-.015,wxR:hw-tR.w/2-.015,eZ:eZc,exX,zc,fuelZ,ubel});
 for(const k in CH.anchors) anchors[k]=CH.anchors[k];
 const interX=merge(inter),interF=merge(inter.concat(cardP)),trimX=merge(trim.concat(wiper)),trimF=merge(trim.concat(wiper,bladeD)),doorZ=[dz0,dRear];
 return (GEO[car.id]={ch:CH,paint:merge(paint),dark:merge(dark),trim:trimF,trimX,interX,chrome:merge(chrome),glass:merge(glass),head:merge(head),tail:merge(tail),amber:merge(amber),inter:interF,
  hoodTop,hoodUnder,hLen,lidLo,lidHi,pivY,anchors,plateF,plateR,wx:{F:hw-tF.w/2-.015,R:hw-tR.w/2-.015},afz,arz,tF,tR,hw,zf,zr,top,roofY,zc,zrb,rearLid,bayZ,sx,gc,hb,hn,
  doorZ,sill,doorTop,ybw,winTop,sideX,zS,zE,zSeat,dashY,sy,handleZ:handles[0],wiperTh:wiperPos[3],lw,fuelZ});}

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
 g.add(mesh(G.head,MATS.head()));g.add(mesh(G.tail,MATS.tail()));g.add(mesh(G.amber,MATS.amber()));g.add(mesh(G.inter,MATS.inter()));const under=mesh(G.ch.full,MWCH.mat());under.name='dessous';g.add(under);
 if(G.chrome.attributes.position.count) g.add(mesh(G.chrome,MATS.chrome()));
 /* capot (charnière à l'arrière du capot) */
 const hood=new T.Group();hood.name='hood';hood.position.set(0,G.pivY,G.lidLo);hood.add(mesh(G.hoodTop,pm));hood.add(mesh(G.hoodUnder,MATS.hoodUnder()));g.add(hood);
 /* plaques */
 const text=o.plate||plateFromPool(),pmat=plateMat(text),pf=mesh(GEOM_PLATE,pmat),pr=mesh(GEOM_PLATE,pmat);
 pf.position.set(G.plateF.x,G.plateF.y,G.plateF.z);pr.position.set(G.plateR.x,G.plateR.y,G.plateR.z);pr.rotation.y=PI;g.add(pf,pr);
 /* roues et freins */
 const nn=(car.cat==='pop'&&car.body!=='sedan'&&car.kind==='citadine')?4:5;   /* nombre d'écrous par roue (comme js/46) */
 const wg=(front,s)=>{const t=front?G.tF:G.tR,wgo=wheelGeo(t,car.rim,car.rimC,nn);return {t,wgo};};
 const rimMat=car.rim==='steel'?MATS.steelw():car.rimC==='graph'?MATS.graph():MATS.alu(),brakes={};
 for(const [n,fr,sg] of [['FL',1,1],['FR',1,-1],['RL',0,1],['RR',0,-1]]){
  const {t,wgo}=wg(fr),w=new T.Group();w.name='w'+n;w.rotation.order='YXZ';
  const wx=sg*(fr?G.wx.F:G.wx.R),wz=fr?G.afz:G.arz;w.position.set(wx,t.rt,wz);
  const tire=mesh(wgo.tire,MATS.rubber()),rim=mesh(wgo.rim,rimMat);if(sg<0){tire.rotation.y=PI;rim.rotation.y=PI;}
  w.userData.geo=wgo;w.add(tire,rim);g.add(w);
  const bg=brakeGeo(car,!!fr),b=new T.Group();b.name='brake'+n;b.position.set(wx,t.rt,wz);if(sg<0) b.rotation.y=PI;
  const d=mesh(bg.disc,bg.d?(car.brk[fr?'f':'r']==='drum'?MATS.drum():MATS.disc()):MATS.disc());d.position.x=-.05;b.add(d);
  if(bg.cal){const c=mesh(bg.cal,car.cat==='sport'?MATS.caliperR():car.cat==='prem'?MATS.caliperB():MATS.caliperD());c.position.x=-.05;b.add(c);}
  g.add(b);brakes[n]=b;}
 /* ancres */
 const anchors={};
 for(const k in G.anchors){const a=new T.Object3D();a.name='@'+k;a.position.set(G.anchors[k][0],G.anchors[k][1],G.anchors[k][2]);g.add(a);anchors[k]=a;}
 /* béquille de capot */
 const rod=mesh(GEOM_ROD,MATS.steel());rod.visible=false;g.add(rod);
 g.userData={mdl:car.id,L:car.L,W:car.W,H:car.H,WB:car.WB,kind:car.kind,loc:car.loc,wheelR:G.tF.rt,wheelRR:G.tR.rt,trackF:2*G.wx.F,trackR:2*G.wx.R,hoodLen:G.hLen,bayZ:G.bayZ,anchors,
  plates:[pf,pr],plate:text,hood,rod,brakes,under,color,car,bay:null,_age:0,_seen:false,_ang:99,G};
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
/* voiture à moins de 40 m du joueur : son moteur est préparé à l'avance (les voitures de la circulation ne le sont jamais) */
function near(g){const p=MW.player&&MW.player();return !!p&&Math.hypot(g.position.x-p.x,g.position.z-p.z)<40;}
function track(){
 for(const g of LIVE){const u=g.userData;
  if(!u._seen){if(g.parent) u._seen=true;else if(++u._age>600) LIVE.delete(g);continue;}
  if(!g.parent){release(g);LIVE.delete(g);continue;}
  const h=u.hood;if(!h) continue;
  if(!u.bay&&!u.noBay&&!u.prep&&u.car&&u.car.eng&&near(g)){u.prep=true;warmOn=true;prepare(u.car);}
  if(h.rotation.x<-.15&&!u.bay&&!u.noBay){try{const e=engineMesh(u.car,{group:g});g.add(e);u.bay=e;built++;for(const k in e.userData.anchors) if(u.anchors[k]) u.anchors[k].position.copy(e.userData.anchors[k]);}catch(err){u.noBay=true;console.error('moteur de baie',err);}}
  updateRod(g);
  for(const n of ['FL','FR']){const w=g.getObjectByName('w'+n);if(w&&u.brakes[n]) u.brakes[n].rotation.y=w.rotation.y+(n==='FR'?PI:0);}}}

/* ═══════════ 9. Moteur réel dans la baie ═══════════ */
const ECACHE={};let engBuilt=0;
const SKIP_PART=/Ligne d'échappement|Catalyseur|Huile moteur|Filtre à huile|Sonde lambda/;
const SEPK=[[/^Alternateur/,'alternator'],[/^Démarreur/,'starter'],[/^Courroie d'accessoires/,'belt'],[/Carter de distribution/,'timingCover'],[/^Bobines|préchauffage/,'coils'],[/injecteurs|^Injecteur|Rampe/,'inj'],
 [/^Vanne EGR/,'egr'],[/^Turbocompresseur/,'turbo'],[/^Boîtier de thermostat/,'thermo'],[/^Pompe à eau/,'wpump'],[/^Débitmètre/,'maf'],[/^Capteur de régime/,'ckp'],[/^Capteur d'arbre à cames/,'cmp'],[/^Sonde de température/,'ect'],[/^Couvre-culasse/,'valveCover']];
/* repères de chaque pièce du moteur (clé → nom de pièce de js/07) : servent de cibles aux gestes de js/46, posées sur la pièce réellement dessinée */
const SPOTK=[['alternator',/^Alternateur/],['starter',/^Démarreur/],['coils',/^Bobines|préchauffage|^Allumeur/],['timing',/Carter de distribution/],['intake',/^Collecteur d'admission/],['turbo',/^Turbocompresseur/],
 ['inj',/injecteurs|^Injecteur|Rampe/],['egr',/^Vanne EGR/],['thermo',/^Boîtier de thermostat/],['wpump',/^Pompe à eau/],['tens',/^Galet tendeur/],['belt',/^Courroie d'accessoires/],['maf',/^Débitmètre/],['ckp',/^Capteur de régime/],
 ['cmp',/^Capteur d'arbre à cames/],['ect',/^Sonde de température/],['knock',/^Capteur de cliquetis/],['mapS',/^Capteur de pression d'admission/],['hp',/^Pompe haute pression|^Pompe d'injection/],['ac',/^Compresseur de climatisation/],
 ['pulley',/^Poulie de vilebrequin/],['valveCover',/^Couvre-culasse/],['dip',/^Jauge/],['oilCap',/^Bouchon de remplissage/],['breather',/^Durite de reniflard/],['oilP',/^Capteur de pression d'huile/],['ic',/^Échangeur/],['throttle',/^Boîtier papillon|^Entrée d'air/],['pipe',/^Tuyau d'air/],['harness',/^Faisceau/],['exman',/^Collecteurs? d'échappement/],['block',/^Bloc-cylindres/]];
const SPOTD=[[0,1,0,1.6],[1,1,0,1],[-1,1,0,1],[0,1,1,1],[0,1,-1,1],[0,0,1,.7],[0,0,-1,.7],[-1,0,0,.7],[1,0,0,.7]];
/* pour chaque pièce : rayons lancés sur elle depuis le haut puis les côtés ; on garde un point réellement visible (rien devant), au milieu de la partie visible */
function* partSpotsG(root,parts){
 const T=THREE,rc=new T.Raycaster(),occ=[];rc.far=6000;
 root.traverse(o=>{if(o.isMesh&&!o.userData.hid&&o.material&&!o.material.transparent) occ.push(o);});
 /* boîte englobante de chaque maillage : le lancer de rayon écarte tout de suite les pièces que le rayon ne traverse pas */
 for(const m of occ) if(!m.geometry.boundingBox) m.geometry.computeBoundingBox();
 const all=new T.Box3().setFromObject(root),ec=all.getCenter(new T.Vector3());
 /* yeux virtuels (repère du moteur, mm) : au-dessus et en biais, comme un joueur penché sur le capot */
 const eyes=[[0,1100,0],[900,900,0],[-900,900,0],[0,900,900],[0,900,-900],[600,700,600],[-600,700,-600]].map(a=>ec.clone().add(new T.Vector3(a[0],a[1],a[2])));
 const spots={},bb=new T.Box3(),sz=new T.Vector3(),o=new T.Vector3(),d=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3(),dd2=new T.Vector3();
 for(const [k,re] of SPOTK){
  const ps=parts.filter(p=>re.test(p.name)&&!SKIP_PART.test(p.name)&&p.meshes.length);if(!ps.length) continue;
  const mine=new Set();bb.makeEmpty();for(const p of ps) for(const me of p.meshes){if(!me.isMesh) continue;mine.add(me);bb.expandByObject(me);}
  if(bb.isEmpty()) continue;bb.getSize(sz);
  const cand=[],c0=bb.getCenter(new T.Vector3());
  for(const dd of SPOTD){
   d.set(dd[0],dd[1],dd[2]).normalize();u.crossVectors(d,Math.abs(d.z)>.9?new T.Vector3(1,0,0):new T.Vector3(0,0,1)).normalize();v.crossVectors(d,u).normalize();
   const ext=Math.abs(d.x)*sz.x+Math.abs(d.y)*sz.y+Math.abs(d.z)*sz.z,su=Math.abs(u.x)*sz.x+Math.abs(u.y)*sz.y+Math.abs(u.z)*sz.z,sv=Math.abs(v.x)*sz.x+Math.abs(v.y)*sz.y+Math.abs(v.z)*sz.z,N=3;
   for(let i=0;i<N;i++) for(let j=0;j<N;j++){
    o.copy(c0).addScaledVector(d,ext/2+60).addScaledVector(u,(i+.5)/N*su-su/2).addScaledVector(v,(j+.5)/N*sv-sv/2);
    rc.set(o,d.clone().negate());const h=rc.intersectObjects(occ,false);
    if(h.length&&mine.has(h[0].object)) cand.push({p:h[0].point.clone(),d:d.clone(),w:dd[3]});}
   yield;}
  if(!cand.length) continue;
  /* on teste d'abord les candidats vus du dessus ; chacun est noté par le nombre d'yeux qui le voient */
  cand.sort((a,b)=>b.w-a.w);const step=Math.max(1,Math.ceil(cand.length/16));let best=null;
  for(let ci=0;ci<cand.length;ci+=step){const q=cand[ci];let vis=0;
   for(const e of eyes){dd2.subVectors(q.p,e);const L=dd2.length();dd2.normalize();rc.set(e,dd2);rc.far=L+1;const h=rc.intersectObjects(occ,false);if(h.length&&h[0].distance>L-6) vis++;}
   const score=vis+q.w*.2-q.p.distanceTo(c0)/Math.max(50,sz.length())*.1;
   if(!best||score>best.score) best={score,p:q.p,d:q.d,vis};
   if((ci/step|0)%3===0) yield;}
  spots[k]={p:best.p.clone().addScaledVector(best.d,7),d:best.d,n:best.vis,box:bb.clone(),name:ps[0].name,desc:ps[0].desc||''};}
 return spots;}
function partSpots(root,parts){const g=partSpotsG(root,parts);let r;do{r=g.next();}while(!r.done);return r.value;}
/* construit (ou réutilise) la géométrie du moteur du jeu pour ce moteur : fusionnée par matériau, en mm, centrée */
function* engineJob(car){
 const e=car.eng;let c=ECACHE[e.id];if(c){c.refs++;return c;}
 const s=toS(car),snap=Object.assign({},S),keepE=M.E,keepC=M.C,keepE3=E3,keepSel=ui.sel,keepView=ui.eview;let root,parts;
 try{
  Object.assign(S,s);sanitize();
  if(!S.injSize||!S.ecuIdle){const E0=computeEngine(Object.assign({},S,{injSize:1e6,ecuIdle:0,fuelPress:3}));S.injSize=clamp(Math.round(E0.injNeed*1.25/10)*10,60,3000);S.ecuIdle=E0.idle0;}
  M.E=computeEngine(S);if(!S.oilInt){S.oilInt=M.E.oilRec;M.E=computeEngine(S);}
  ui.eview='3d';
  E3={scene:new T.Scene(),root:null,parts:[],anim:null,sig:'',R:600,hl:new T.MeshStandardMaterial({color:0xffb800}),shown:[],pinEls:[],cv:null,renderer:null,w:0,h:0};
  window.__sansAretes=true;try{build3D();}finally{window.__sansAretes=false;}root=E3.root;parts=E3.parts;root.updateMatrixWorld(true);
 }finally{for(const k in S) if(!(k in snap)) delete S[k];Object.assign(S,snap);M.E=keepE;M.C=keepC;E3=keepE3;ui.sel=keepSel;ui.eview=keepView;}
 yield;/* la construction du moteur est faite : le reste (repères, fusion) est découpé en tranches */
 const anchors={},names=[[/^Alternateur/,'alternator'],[/Bouchon de remplissage/,'oilCap'],[/Bobines|préchauffage|Allumeur/,'coils'],[/Carter de distribution/,'timing'],[/Collecteur d'admission/,'intake'],[/Turbocompresseur/,'turbo'],
  [/^Démarreur/,'starter'],[/Carter d'huile/,'oilPan'],[/^Courroie d'accessoires/,'belt'],[/Couvre-culasse/,'valveCover']];
 let cover=null,plenum=null;const sep={},coilPts=[];
 for(const p of parts){
  if(SKIP_PART.test(p.name)){for(const me of p.meshes){me.userData.skip=true;me.userData.hid=true;}continue;}
  if(/Couvre-culasse/.test(p.name)){const b=new T.Box3();for(const me of p.meshes) b.expandByObject(me);cover=cover?cover.union(b):b;}
  if(/Collecteur d'admission/.test(p.name)){const b=new T.Box3();for(const me of p.meshes) b.expandByObject(me);plenum=plenum?plenum.union(b):b;}
  for(const [re,k] of names) if(re.test(p.name)&&p.pin&&!anchors[k]) anchors[k]=root.localToWorld(p.pin.clone());
  /* [MWG] pièces mobiles : maillages mis à part (js/46 les dépose réellement) ; les bobines / bougies de préchauffage ne donnent que leurs positions */
  {const sk=SEPK.find(a=>a[0].test(p.name));
   if(sk){const L=sep[sk[1]]||(sep[sk[1]]=[]);
    for(const me of p.meshes){if(!me.isMesh) continue;me.userData.skip=true;
     if(sk[1]==='coils'){const gp=me.geometry.parameters;if(gp&&gp.radiusTop!=null&&(gp.radiusTop===13||gp.radiusTop===6)) coilPts.push({p:me.getWorldPosition(new T.Vector3()),a:new T.Vector3(0,1,0).applyQuaternion(me.getWorldQuaternion(new T.Quaternion())),r:gp.radiusTop,h:gp.height});continue;}
     const gg=me.geometry.clone();gg.applyMatrix4(me.matrixWorld);if(!gg.attributes.normal) gg.computeVertexNormals();const m=me.material;L.push({g:gg,color:m.color.getHex(),rough:m.roughness,metal:m.metalness});}
    continue;}}
  }
 let spots={};try{spots=yield* partSpotsG(root,parts);}catch(err){console.error('repères du moteur',err);}
 const items=[];
 root.traverse(o=>{if(!o.isMesh||o.userData.skip||!o.material||o.material.transparent) return;
  const m=o.material,g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(!g.attributes.normal) g.computeVertexNormals();items.push({g,color:m.color.getHex(),rough:m.roughness,metal:m.metalness});});
 const buckets=mergeVC(items,.55),bb=new T.Box3();
 for(const b of buckets){b.g.computeBoundingBox();bb.union(b.g.boundingBox);}
 for(const k in sep) sep[k]=mergeVC(sep[k],.55,true);
 root.traverse(o=>{if(o.geometry) o.geometry.dispose();});
 c=ECACHE[e.id]={buckets,bb,anchors,cover,plenum,refs:1,n:car.eng.n,lay:car.eng.lay,sep,coilPts,spots};engBuilt++;return c;}
/* version synchrone : termine le travail en cours pour ce moteur (préparé à l'avance si possible, voir PREP) */
function engineParts(car){
 const id=car.eng.id,job=PREP.get(id)||engineJob(car);PREP.delete(id);
 let r;do{r=job.next();}while(!r.done);
 return r.value;}
/* préparation à l'avance des moteurs des voitures présentes : un travail par moteur, avancé de quelques millisecondes par image */
const PREP=new Map();
function prepare(car){
 const id=car&&car.eng&&car.eng.id;if(!id||ECACHE[id]||PREP.has(id)) return;
 PREP.set(id,engineJob(car));}
let warmOn=false;
/* précompilation des programmes de la baie (matières standard à couleurs de sommets, plastiques, bocaux…) : un matériau par image,
   dans la vraie scène (même éclairage, donc mêmes programmes), pour qu'aucune compilation ne tombe à l'ouverture du capot */
const WARM={list:null,i:0,grp:null};
function warmStep(){
 const R=MW.renderer&&MW.renderer();if(!R||!MW.scene||!MW.cam) return;
 if(!WARM.list){
  const tex=new T.CanvasTexture(document.createElement('canvas')),ms=[];
  for(const k in BAYM) ms.push(BAYM[k]());
  ms.push(emat({color:0x808080,rough:.6,metal:0}),emat({color:0x808080,rough:.6,metal:0,vc:true}),aoMat(),new T.MeshStandardMaterial({map:tex,roughness:.6,metalness:.1}));
  WARM.list=ms;WARM.grp=new T.Group();WARM.grp.visible=false;WARM.grp.name='prechauffe';MW.scene.add(WARM.grp);WARM.g=new T.BufferGeometry();
  WARM.g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,0,.001,0,.001,0],3));WARM.g.setAttribute('normal',new T.Float32BufferAttribute([1,0,0,1,0,0,1,0,0],3));
  WARM.g.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,0,0,0],2));WARM.g.setAttribute('color',new T.Float32BufferAttribute([1,1,1,1,1,1,1,1,1],3));}
 if(WARM.i>=WARM.list.length){if(WARM.grp){MW.scene.remove(WARM.grp);WARM.grp=null;}return;}
 WARM.grp.add(new T.Mesh(WARM.g,WARM.list[WARM.i++]));
 try{R.compile(MW.scene,MW.cam);}catch(err){WARM.i=1e9;}}
function pumpPrep(dt){
 const PREP_MS=Math.min(40,Math.max(5,(dt||0)*300));/* 30 % d'une image lente, 5 ms au minimum */
 if(!PREP.size){if(WARM.i<1e9&&(WARM.list===null||WARM.i<WARM.list.length||WARM.grp)&&warmOn) warmStep();return;}
 const t0=performance.now();
 for(const [id,job] of PREP){
  let r;
  do{try{r=job.next();}catch(err){console.error('préparation du moteur',err);PREP.delete(id);break;}
   if(r.done){PREP.delete(id);break;}
  }while(performance.now()-t0<PREP_MS);
  if(performance.now()-t0>=PREP_MS) break;}}
function engineRelease(id){const c=ECACHE[id];if(!c) return;if(--c.refs>0) return;for(const b of c.buckets) b.g.dispose();for(const k in c.sep) for(const b of c.sep[k]) b.g.dispose();delete ECACHE[id];}
const EMAT=new Map();
const emat=b=>{const k=b.color+'|'+b.rough+'|'+b.metal+(b.vc?'v':'');let m=EMAT.get(k);if(!m){m=new T.MeshStandardMaterial(b.vc?{vertexColors:true,roughness:Math.max(.5,b.rough),metalness:Math.min(.2,b.metal)}:{color:new T.Color(b.color).multiplyScalar(1.7),roughness:Math.max(.5,b.rough),metalness:Math.min(.2,b.metal)});EMAT.set(k,m);}return m;};
/* palette de la baie : tablier noir, baie gris foncé, plastiques noirs mats, durites noires, bocaux translucides à liquide coloré */
const tankMat=(key,col,emi)=>mat(key,()=>new T.MeshLambertMaterial({color:col,emissive:emi,transparent:true,opacity:.86,side:T.DoubleSide}));
const BAYM={
 plas:()=>mat('bplas',()=>new T.MeshLambertMaterial({color:0x2a2d32,emissive:0x0b0c0e})),blk:()=>mat('bblk',()=>new T.MeshLambertMaterial({color:0x16171a,emissive:0x070708,side:T.DoubleSide})),
 grey:()=>mat('bgrey',()=>new T.MeshPhongMaterial({color:0x474c53,shininess:35,specular:0x333333})),alu:()=>mat('balu',()=>new T.MeshPhongMaterial({color:0xaab1b9,shininess:60,specular:0x666666})),
 gbx:()=>mat('bgbx',()=>new T.MeshPhongMaterial({color:0x7c838b,shininess:30,specular:0x3a3a3a})),
 tank:()=>tankMat('btank',0xe6ecdf,0x000000),tankC:()=>tankMat('btankC',0xe0587f,0x40101e),tankW:()=>tankMat('btankW',0x3f86dc,0x0c2244),tankB:()=>tankMat('btankB',0xdc9a2c,0x3a2608),
 capY:()=>mat('bcapy',()=>new T.MeshLambertMaterial({color:0xe8b820})),
 capB:()=>mat('bcapb',()=>new T.MeshLambertMaterial({color:0x2a62c8})),red:()=>mat('bred',()=>new T.MeshLambertMaterial({color:0xc02a20})),
 rad:()=>mat('brad',()=>new T.MeshLambertMaterial({color:0x23282e,side:T.DoubleSide})),
 floor:()=>mat('bfloor',()=>new T.MeshLambertMaterial({color:0x2b2e34,side:T.DoubleSide})),
 tabl:()=>mat('btabl',()=>new T.MeshLambertMaterial({color:0x101114,side:T.DoubleSide})),
 batt:()=>mat('bbatt',()=>new T.MeshLambertMaterial({color:0x1e252e})),lead:()=>mat('blead',()=>new T.MeshPhongMaterial({color:0xa4a8ae,shininess:70,specular:0x777777})),
 labl:()=>mat('blabl',()=>new T.MeshLambertMaterial({color:0xcfd2cc})),abox:()=>mat('babox',()=>new T.MeshLambertMaterial({color:0x3b3f45})),abl:()=>mat('babl',()=>new T.MeshLambertMaterial({color:0x4b5058})),
 clip:()=>mat('bclip',()=>new T.MeshPhongMaterial({color:0xc2c6cc,shininess:80,specular:0x888888})),cabR:()=>mat('bcabR',()=>new T.MeshLambertMaterial({color:0xb01f18})),filt:()=>mat('bfilt',()=>new T.MeshLambertMaterial({color:0xe6dfc8})),
 hose:()=>mat('bhose',()=>new T.MeshLambertMaterial({color:0x1a1b1e})),orange:()=>mat('borg',()=>new T.MeshLambertMaterial({color:0xe07a10}))};
/* petite ombre de contact : tache sombre et floue, un seul maillage fusionné par baie */
function aoTex(){let t=MT.get('aoTex');if(t) return t;
 const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d'),gr=x.createRadialGradient(32,32,2,32,32,31);
 gr.addColorStop(0,'rgba(0,0,0,.62)');gr.addColorStop(.55,'rgba(0,0,0,.3)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);
 t=new T.CanvasTexture(cv);MT.set('aoTex',t);return t;}
const aoMat=()=>mat('bao',()=>new T.MeshBasicMaterial({map:aoTex(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:T.DoubleSide}));
/* tache posée à plat à la hauteur y, centrée en (x,z), de dimensions w × d */
function aoQuad(x,y,z,w,d){const g=new T.PlaneGeometry(w,d);g.rotateX(-PI/2);g.translate(x,y,z);return g;}
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
 const PT={},pt=(n,k,geo)=>{(PT[n]||(PT[n]=[])).push([k,geo]);}; /* [MWG] pièces amovibles : maillages à part (js/46) */
 const th=car.ev?PI:car.loc==='front'?(car.ori==='T'?PI:PI/2):car.loc==='rear'?-PI/2:(car.ori==='T'?PI:PI/2);
 const fw=V3(Math.cos(th),0,-Math.sin(th)),trans=Math.abs(fw.x)>.5;
 let eg=null,bb=new T.Box3(),parts=null;
 const topAt=z=>G.top(z);
 const zMin=lidLo+.05,zMax=front?lidHi-.2:lidHi-.04;
 const minTop=Math.min(topAt(zMin),topAt(zMax),topAt((zMin+zMax)/2));
 const availY=minTop-.05-(gc+.13),availZ=zMax-zMin,gbL=trans?.34:0,availX=2*(hw-(front?.3:.26))-gbL;
 let fit={ok:true,f:1};
 if(!car.ev){
  parts=engineParts(car);ud.eng=parts;eg=new T.Group();eg.rotation.y=th;
  for(const b of parts.buckets) eg.add(mesh(b.g,emat(b)));
  for(const k in parts.sep){if(k==='coils') continue;const sg=new T.Group();sg.name='sp_'+k;for(const b of parts.sep[k]) sg.add(mesh(b.g,emat(b)));eg.add(sg);}
  eg.scale.setScalar(.001);eg.updateMatrixWorld(true);bb.setFromObject(eg);
  const sz=bb.getSize(V3(0,0,0)),sx=sz.x,sy=sz.y,sz2=sz.z;
  const f=Math.max(.55,Math.min(1,availX/sx,availY/sy,availZ/sz2));
  eg.scale.setScalar(.001*f);eg.updateMatrixWorld(true);bb.setFromObject(eg);
  const c0=bb.getCenter(V3(0,0,0)),s2=bb.getSize(V3(0,0,0));
  let tx=0,tz;
  if(trans){tx=-fw.x*gbL/2;tz=zMin+s2.z/2;}else{tz=zMin+Math.max(0,(availZ-s2.z))*(front?.45:.5)+s2.z/2;}
  const ty=gc+.13+s2.y/2;
  eg.position.set(tx-c0.x,ty-c0.y,tz-c0.z);eg.updateMatrixWorld(true);bb.setFromObject(eg);
  fit={ok:false,f};
 }else{evParts(add,zMin+.3,gc);bb.set(V3(-.55,gc+.12,zMin+.05),V3(.4,gc+.72,zMin+.55));fit={ok:true,f:1};}
 /* position (car coords) d'un point du moteur en mm */
 const ep=v=>v.clone().multiplyScalar(.001*(fit.f||1)).applyAxisAngle(V3(0,1,0),th).add(eg?eg.position:V3(0,0,0));
 const bc=bb.getCenter(V3(0,0,0)),bs=bb.getSize(V3(0,0,0));
 const lx=hw-.4,zF=lidHi-.12;
 /* boîte de vitesses */
 if(!car.ev){
  if(trans){const gx=(fw.x>0?bb.max.x:bb.min.x)+fw.x*gbL/2;pt('gearbox','gbx',bxg(gbL,.36,Math.min(bs.z*1.02,.44),gx,bc.y-.02,bc.z));pt('gearbox','gbx',cyx(.17,.12,20,(fw.x>0?bb.max.x:bb.min.x)+fw.x*.04,bc.y-.02,bc.z));ud.gear={c:V3(gx,bc.y-.02,bc.z),ax:V3(fw.x>0?1:-1,0,0),L:gbL,e:V3((fw.x>0?bb.max.x:bb.min.x),bc.y-.02,bc.z)};}
  else{const gz=(fw.z>0?bb.max.z:bb.min.z)+fw.z*.17;pt('gearbox','gbx',bxg(.34,.34,.34,bc.x,bc.y-.04,gz));pt('gearbox','gbx',cyz(.17,.1,20,bc.x,bc.y-.04,(fw.z>0?bb.max.z:bb.min.z)+fw.z*.04));ud.gear={c:V3(bc.x,bc.y-.04,gz),ax:V3(0,0,fw.z>0?1:-1),L:.34,e:V3(bc.x,bc.y-.04,(fw.z>0?bb.max.z:bb.min.z))};}}
 /* plancher, tablier, traverse, charnières */
 add('floor',bxg(2*(hw-.12),.02,lidHi-lidLo,0,gc+.1,(lidLo+lidHi)/2));
 add('tabl',bxg(2*(hw-.1),Math.max(.2,minTop-gc),.03,0,gc+(minTop-gc)/2,lidLo+.012));
 for(const sg of [-1,1]) add('grey',bxg(.07,.05,.07,sg*hw*.5,G.pivY-.02,lidLo+.02));
 if(front){add('floor',bxg(2*(hw-.1),.3,.05,0,gc+.28,lidHi-.02));add('floor',bxg(2*(hw-.12),.06,.06,0,topAt(lidHi)-.05,lidHi-.03));}
 /* radiateur + ventilateur (à l'avant uniquement) */
 if(front){
  const rz=lidHi-.065;add('rad',bxg(2*(hw-.3),.4,.045,0,gc+.4,rz));for(let i=-4;i<=4;i++) add('grey',bxg(.012,.38,.048,i*(hw-.3)/4.5,gc+.4,rz));
  add('hose',cyz(.17,.07,22,trans?-fw.x*.2:0,gc+.4,rz-.075));add('blk',bxg(.36,.36,.07,trans?-fw.x*.2:0,gc+.4,rz-.075));
  for(let i=0;i<7;i++){const a=i/7*TAU;add('plas',bxg(.14,.012,.05,Math.cos(a)*.08+(trans?-fw.x*.2:0),gc+.4+Math.sin(a)*.08,rz-.115,0,0,a));}
  /* tourelles de suspension et passages de roues */
  for(const sg of [-1,1]){add('grey',cyg(.07,.09,.2,14,sg*(hw-.34),.78,G.afz));add('rad',tf(new T.CylinderGeometry(G.tF.rt+.07,G.tF.rt+.07,.3,26,1,true,0,PI),sg*(hw-.15),G.tF.rt,G.afz,0,0,PI/2));}}
 /* boîte à air, batterie, vase d'expansion, lave-glace, liquide de frein */
 const sx2=bb.max.x+.1,sx1=bb.min.x-.1;
 const bx=Math.min(hw-.3,Math.max(sx2+.1,lx*.8)),ax=-Math.min(hw-.3,Math.max(-sx1+.1,lx*.8));
 const batZ=front?zF-.2:(lidLo+lidHi)/2+.2,batY=Math.max(gc+.16,front?.58:gc+.2);
 add('floor',bxg(.3,.025,.24,bx,batY-.1,batZ));   /* plateau de batterie */
 pt('battery','batt',bxg(.24,.18,.17,bx,batY,batZ));pt('battery','plas',bxg(.245,.012,.175,bx,batY+.09,batZ));
 pt('battery','labl',bxg(.12,.1,.004,bx,batY-.01,batZ+.087));pt('battery','red',bxg(.045,.03,.004,bx-.035,batY+.02,batZ+.0875));
 for(const sg of [-1,1]){pt('battery','lead',cyg(.011,.011,.03,10,bx+sg*.08,batY+.105,batZ-.04));pt('battery',sg<0?'cabR':'blk',bxg(.034,.026,.04,bx+sg*.08,batY+.118,batZ-.04));pt('battery','lead',cyg(.004,.004,.04,6,bx+sg*.08+.012,batY+.118,batZ-.04));}
 pt('battery','lead',bxg(.28,.012,.025,bx,batY+.1,batZ+.02));pt('battery','lead',cyg(.005,.005,.2,6,bx+.125,batY,batZ+.02));pt('battery','lead',cyg(.005,.005,.2,6,bx-.125,batY,batZ+.02));
 pt('battery','cabR',tf(new T.TubeGeometry(new T.CatmullRomCurve3([V3(bx-.08,batY+.125,batZ-.04),V3(bx-.08,batY+.15,batZ-.12),V3(bx*.5,batY+.1,batZ-.2)]),10,.008,6,false),0,0,0));
 pt('battery','blk',tf(new T.TubeGeometry(new T.CatmullRomCurve3([V3(bx+.08,batY+.125,batZ-.04),V3(bx+.1,batY+.08,batZ-.12),V3(bx+.06,batY,batZ-.2)]),10,.008,6,false),0,0,0));
 const abZ=front?zF-.22:(lidLo+lidHi)/2-.2,abY=front?.62:Math.min(minTop-.22,gc+.42);
 if(!car.ev){add('floor',bxg(.38,.025,.28,ax,abY-.1,abZ));pt('airbox','abox',bxg(.32,.17,.22,ax,abY,abZ));pt('airbox','abl',bxg(.325,.02,.225,ax,abY+.085,abZ));
  for(const sx of [-.13,.13]) for(const sz of [-.09,.09]) pt('airbox','clip',bxg(.03,.022,.022,ax+sx,abY+.098,abZ+sz));
  for(const sz of [-.06,0,.06]) pt('airbox','abl',bxg(.26,.008,.012,ax,abY+.097,abZ+sz));
  pt('airbox','hose',tf(new T.CylinderGeometry(.045,.045,.34,12),ax+.04,abY,abZ+.22,PI/2,0,0));pt('airbox','abox',cyz(.055,.04,14,ax+.04,abY,abZ+.4));pt('airbox','clip',bxg(.05,.012,.012,ax+.04,abY+.056,abZ+.4));}
 if(!car.ev){const ip=parts&&parts.anchors.intake?ep(parts.anchors.intake):V3(bc.x,bb.max.y-.05,bc.z);
  const cv=new T.CatmullRomCurve3([V3(ax,abY+.02,abZ-.1),V3((ax+ip.x)/2,abY+.08,abZ-.1),V3(ip.x,Math.min(ip.y,minTop-.08),ip.z)]);add('hose',new T.TubeGeometry(cv,12,.032,8,false));}
 const vz=front?lidLo+.14:(lidLo+lidHi)/2,vx=front?Math.min(hw-.45,Math.max(.25,bb.max.x*.0+.3)):-.4;
 pt('coolant','tankC',bxg(.17,.17,.12,vx,minTop-.17,vz));pt('coolant','capY',cyg(.03,.03,.025,12,vx,minTop-.065,vz));
 const hoseC=new T.CatmullRomCurve3([V3(vx,minTop-.24,vz),V3(vx*.6,gc+.5,vz+.15),V3(bc.x*.5,bc.y+.1,bc.z)]);add('hose',new T.TubeGeometry(hoseC,10,.012,6,false));
 const wz=front?zF-.02:(lidLo+lidHi)/2-.05;add('floor',bxg(.2,.025,.22,-(hw-.34),(front?.5:gc+.2)-.1,wz));pt('washer','tankW',bxg(.14,.2,.16,-(hw-.34),front?.5:gc+.2,wz));pt('washer','capB',cyg(.028,.028,.03,12,-(hw-.34),(front?.5:gc+.2)+.115,wz));
 const bfx=.36,bfy=Math.min(minTop-.1,.78);add('hose',cyz(.1,.12,18,.32,bfy-.12,lidLo+.1));pt('brakeFluid','tankB',bxg(.09,.09,.07,bfx,bfy,lidLo+.1));pt('brakeFluid','capY',cyg(.02,.02,.02,10,bfx,bfy+.055,lidLo+.1));
 /* cache-moteur et bouchons */
 let covBox=null;
 if(!car.ev&&parts){
  const src=parts.lay==='F'?null:(parts.lay==='V'&&parts.plenum?parts.plenum:parts.cover);
  if(src){const pts=[];for(const x of [src.min.x,src.max.x]) for(const y of [src.min.y,src.max.y]) for(const z of [src.min.z,src.max.z]) pts.push(ep(V3(x,y,z)));covBox=new T.Box3().setFromPoints(pts);}
  ud.cover=covBox;
  if(covBox){const cs=covBox.getSize(V3(0,0,0)),cc=covBox.getCenter(V3(0,0,0)),topY=covBox.max.y+.008;
   const w=Math.max(.2,cs.x*.92),d=Math.max(.16,Math.min(cs.z*.9,.34));add('plas',bxg(w,.014,d,cc.x,topY,cc.z));
   const pl=new T.Mesh(new T.PlaneGeometry(w*.9,d*.88),coverTex(car));pl.rotation.x=-PI/2;pl.position.set(cc.x,topY+.0085,cc.z);pl.name='cover';g.add(pl);ud.coverPlate=pl;}}
 const A=ud.anchors,setA=(k,v)=>{A[k]=v.clone();};
 const ocp=parts&&parts.anchors.oilCap?ep(parts.anchors.oilCap):V3(bc.x,bb.max.y,bc.z);
 setA('oilCap',ocp);if(!car.ev) pt('oilCap','capY',cyg(.034,.034,.022,14,ocp.x,ocp.y+.012,ocp.z));
 /* jauge : c'est celle du moteur (js/07), tige et anneau jaune ; son anneau sert de cible */
 setA('dipstick',ocp.clone().add(V3(.0,-.02,front?.1:-.1)));
 setA('alternator',parts&&parts.anchors.alternator?ep(parts.anchors.alternator):V3(bb.min.x,bc.y,bc.z));
 setA('coils',parts&&parts.anchors.coils?ep(parts.anchors.coils):bc);setA('timing',parts&&parts.anchors.timing?ep(parts.anchors.timing):bc);
 /* repères visibles de chaque pièce du moteur : cibles des gestes (js/46) ; ud.dirs = direction d'où la pièce se voit (repère de la voiture) */
 ud.dirs={};ud.names={};
 if(parts&&parts.spots) for(const k in parts.spots){const q=parts.spots[k];if(k==='coils'||k==='oilCap') continue;A[k]=ep(q.p);ud.names[k]=[q.name,q.desc];ud.dirs[k]=q.d.clone().applyAxisAngle(V3(0,1,0),th);}
 if(A.dip) A.dipstick=A.dip.clone();
 if(!car.ev&&!A.maf){const mp=V3(ax+.04,abY+.052,abZ+(front?.2:.3));A.maf=mp;pt('maf','grey',bxg(.07,.04,.075,mp.x,mp.y-.012,mp.z));pt('maf','blk',bxg(.03,.028,.03,mp.x,mp.y+.03,mp.z));pt('maf','clip',bxg(.07,.008,.012,mp.x,mp.y+.01,mp.z+.045));}
 if(!A.egr&&A.throttle) A.egr=A.throttle.clone();
 setA('battery',V3(bx,batY,batZ));setA('airbox',V3(ax,abY,abZ));setA('coolant',V3(vx,minTop-.17,vz));setA('washer',V3(-(hw-.34),front?.5:gc+.2,wz));setA('brakeFluid',V3(bfx,bfy,lidLo+.1));
 setA('bay',V3(0,gc+.06,G.bayZ));setA('hoodPivot',V3(0,G.pivY,lidLo));
 if(front){setA('radiator',V3(0,gc+.4,lidHi-.065));setA('fan',V3(trans?-fw.x*.2:0,gc+.4+.15,lidHi-.065-.115));}
 A.coolHose=hoseC.getPoint(.3);
 /* petites ombres de contact : sous le moteur, la boîte, les plateaux,  */
 {const ao=[],fy=gc+.113;
  const q=(x,y,z,w,d,vert)=>{const g=new T.PlaneGeometry(w,d);if(!vert) g.rotateX(-PI/2);g.translate(x,y,z);ao.push(g);};
  if(!car.ev){q(bc.x,fy,bc.z,bs.x*1.15+.1,bs.z*1.15+.1);}
  q(bx,batY-.085,batZ,.46,.38);if(!car.ev) q(ax,abY-.085,abZ,.52,.42);q(-(hw-.34),(front?.5:gc+.2)-.085,wz,.34,.36);
  const pos=[],uv=[],idx=[];let off=0;
  for(const g of ao){const pa=g.attributes.position.array,ua=g.attributes.uv.array,ia=g.index.array;for(let i=0;i<pa.length;i++) pos.push(pa[i]);for(let i=0;i<ua.length;i++) uv.push(ua[i]);for(let i=0;i<ia.length;i++) idx.push(ia[i]+off);off+=pa.length/3;g.dispose();}
  const og=new T.BufferGeometry();og.setAttribute('position',new T.Float32BufferAttribute(pos,3));og.setAttribute('uv',new T.Float32BufferAttribute(uv,2));og.setIndex(idx);
  const am=mesh(og,aoMat());am.name='bay_ao';am.renderOrder=2;am.raycast=()=>{};g.add(am);}
 /* regroupe par matériau */
 for(const k in acc){const m=mesh(merge(acc[k]),BAYM[k]());m.name='bay_'+k;g.add(m);}
 ud.parts={};for(const n in PT){const gr=new T.Group();gr.name='p_'+n;{const by={};for(const [k,geo] of PT[n]) (by[k]||(by[k]=[])).push(geo);for(const k in by) gr.add(mesh(by[k].length>1?merge(by[k]):by[k][0],BAYM[k]()));}g.add(gr);ud.parts[n]=gr;}
 ud.ep=ep;ud.th=th;ud.fw=fw;ud.bbox=bb;ud.coils=parts?(parts.coilPts||[]).map(q=>({p:ep(q.p),a:q.a.clone().applyAxisAngle(V3(0,1,0),th).normalize(),r:q.r*.001*(fit.f||1),h:q.h*.001*(fit.f||1)})):[];ud.sepKeys=parts?Object.keys(parts.sep||{}):[];ud.minTop=minTop;
 if(eg){eg.name='engine';g.add(eg);}
 /* tient-il dans la baie ? */
 const zb0=lidLo,zb1=lidHi,xb=hw-.1;
 fit.box={min:{x:bb.min.x,y:bb.min.y,z:bb.min.z},max:{x:bb.max.x,y:bb.max.y,z:bb.max.z}};fit.bay={x0:-xb,x1:xb,y0:gc,y1:minTop,z0:zb0,z1:zb1};
 fit.size={x:bs.x,y:bs.y,z:bs.z};
 if(!car.ev) fit.ok=bb.min.x>=-xb-.001&&bb.max.x<=xb+.001&&bb.min.y>=gc-.001&&bb.max.y<=minTop+.001&&bb.min.z>=zb0-.001&&bb.max.z<=zb1+.001;
 ud.fit=fit;
 ud.dispose=()=>{for(const n in ud.parts) ud.parts[n].traverse(m=>{if(m.isMesh&&m.geometry) m.geometry.dispose();});g.traverse(m=>{if(m.isMesh&&m.parent===g&&m.geometry&&m.name.indexOf('bay_')===0) m.geometry.dispose();if(m.name==='cover'&&m.geometry) m.geometry.dispose();});if(!car.ev) engineRelease(car.eng.id);if(g.parent) g.parent.remove(g);};
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
/* niveau de détail des voitures : au-delà de 28 m de la caméra, les freins (cachés derrière les jantes) ne sont plus dessinés ;
   une voiture dont le capot est ouvert (moteur de baie) garde tout. */
const LOD_D2=28*28;
function lodCars(){
 const cam=MW.cam,sc=MW.scene;if(!cam||!sc) return;
 for(const g of sc.children){
  const u=g.userData;if(!u||!u.brakes||!u.mdl) continue;
  const dx=g.position.x-cam.position.x,dz=g.position.z-cam.position.z,far=!u.bay&&dx*dx+dz*dz>LOD_D2;
  if(u.lodFar===far) continue;u.lodFar=far;
  /* on ne rend visibles que les freins que ce niveau de détail a lui-même cachés (js/46 en masque d'autres lors des gestes) */
  if(far){u.lodHid=[];for(const k in u.brakes){const b=u.brakes[k];if(b&&b.visible){b.visible=false;u.lodHid.push(b);}}}
  else if(u.lodHid){for(const b of u.lodHid) b.visible=true;u.lodHid=null;}}}
MW.on('tick',dt=>{if(++nf0%3===0) track();if(nf0%6===0) lodCars();pumpPrep(dt);});
MW.on('minute',()=>{try{setNight(!!MW.isNight());}catch(e){}});
MW.on('start',()=>{try{setNight(!!MW.isNight());}catch(e){}});

const api={list:CARS,ENG,get:GET,ids:()=>CARS.map(c=>c.id),byCat,pool,pick,tuple,label,toS,checkS,applies,partName,partPrice,oilL:c=>GET(c).eng.oilL,
 fullName,engineMesh,bayBuilt,anchor,anchorWorld,setPlate,build:makeCar,geo:buildGeo,POOL,
 dims:c=>{c=GET(c);return c?{L:c.L,W:c.W,H:c.H,WB:c.WB}:null;},
 /* termine tout de suite la préparation à l'avance (moteurs des voitures proches, programmes de la baie) : outil de test, le jeu la fait image par image */
 prechauffer:()=>{for(const [id,job] of [...PREP]){let r;do{r=job.next();}while(!r.done);PREP.delete(id);}
  if(warmOn){let n=0;while(n++<200&&(WARM.list===null||WARM.i<WARM.list.length||WARM.grp)&&WARM.i<1e9) warmStep();}return true;},
 stats:()=>({prep:PREP.size,warm:WARM.i,warmOn,geo:Object.keys(GEO).length,engines:Object.keys(ECACHE),built,freed,live:LIVE.size,engBuilt}),
 track,
 /* points d'interaction du capot, de la cabine et des roues autour de la voiture posée (décalages locaux {x,z} : x = côté gauche, z = avant) */
 pts(c){c=GET(c);const G=buildGeo(c),hw=G.hw;
  return {capot:{x:0,z:G.rearLid?G.lidLo-.9:G.lidHi+.9},cabine:{x:hw+.8,z:G.sx*0+(G.afz+G.arz)/2},dessous:{x:0,z:(G.afz+G.arz)/2},FL:{x:hw+.8,z:G.afz},FR:{x:-(hw+.8),z:G.afz},RL:{x:hw+.8,z:G.arz},RR:{x:-(hw+.8),z:G.arz}};}};
window.__mwcars=api;
return api;
})();
