'use strict';
/* ───────────── Données ───────────── */
const CFG={
 I3:{n:3,lay:'I',lab:'L3',full:'3 cylindres en ligne',sm:48,snd:50},
 I4:{n:4,lay:'I',lab:'L4',full:'4 cylindres en ligne',sm:62,snd:55},
 I5:{n:5,lay:'I',lab:'L5',full:'5 cylindres en ligne',sm:72,snd:80},
 I6:{n:6,lay:'I',lab:'L6',full:'6 cylindres en ligne',sm:96,snd:86},
 V6:{n:6,lay:'V',ang:60,lab:'V6',full:'V6 à 60°',sm:80,snd:70},
 V8:{n:8,lay:'V',ang:90,lab:'V8',full:'V8 à 90°',sm:90,snd:92},
 V10:{n:10,lay:'V',ang:72,lab:'V10',full:'V10 à 72°',sm:84,snd:96},
 V12:{n:12,lay:'V',ang:60,lab:'V12',full:'V12 à 60°',sm:100,snd:100},
 F4:{n:4,lay:'F',lab:'B4',full:'4 cylindres à plat (boxer)',sm:76,snd:68},
 F6:{n:6,lay:'F',lab:'B6',full:'6 cylindres à plat (boxer)',sm:95,snd:88},
 W8:{n:8,lay:'V',ang:72,w:1,lab:'W8',full:'W8 (deux bancs en quinconce à 72°)',sm:86,snd:88},
 W12:{n:12,lay:'V',ang:72,w:1,lab:'W12',full:'W12 (deux bancs en quinconce à 72°)',sm:98,snd:97},
 W16:{n:16,lay:'V',ang:90,w:1,lab:'W16',full:'W16 (deux bancs en quinconce à 90°)',sm:99,snd:99},
 R2:{n:4,lay:'R',rot:2,lab:'R2',full:'Birotor Wankel',sm:92,snd:90},
 R3:{n:6,lay:'R',rot:3,lab:'R3',full:'Trirotor Wankel',sm:97,snd:97},
 R4:{n:8,lay:'R',rot:4,lab:'R4',full:'Quadrirotor Wankel',sm:99,snd:100},
};
const VTR={n:'Lumières (sans soupapes)',ve:.9,rf:1.05,ah:.7,flt:14000,hm:.6,hc:.6,fr:.8};
const BANKFIRE={8:[0,630,270,540,90,450,180,360],2:[0,540],3:[0,240,480],4:[0,540,180,360],5:[0,144,576,288,432],6:[0,480,240,600,120,360]};
const VT={
 ohv:{n:'Culbuté, 2 soupapes',ve:.82,rf:.92,ah:1.3,flt:6800,hm:.8,hc:.7,fr:.95},
 sohc:{n:'Simple ACT, 2 soupapes',ve:.86,rf:.96,ah:1.1,flt:7400,hm:1,hc:1,fr:1},
 dohc4:{n:'Double ACT, 4 soupapes',ve:.93,rf:1,ah:.8,flt:8800,hm:1.25,hc:1.55,fr:1.03},
 dohc5:{n:'Double ACT, 5 soupapes',ve:.95,rf:1.04,ah:.72,flt:9600,hm:1.3,hc:1.85,fr:1.04},
};
const FS={
 carb:{n:'Carburateur',ve:-.03,eff:.90,knock:-.6,cost:160},
 mono:{n:'Injection monopoint',ve:-.02,eff:.94,knock:-.2,cost:280},
 mpi:{n:'Injection multipoint',ve:0,eff:1,knock:0,cost:520},
 di:{n:'Injection directe',ve:.02,eff:1.05,knock:1.2,cost:1050},
 dual:{n:'Injection mixte directe + indirecte',ve:.025,eff:1.055,knock:1.1,cost:1400},
 idi:{n:'Diesel indirecte',ve:-.01,eff:.9,knock:0,cost:450,d:1},
 pd:{n:'Diesel injecteur-pompe',ve:0,eff:1.03,knock:0,cost:1100,d:1},
 cr:{n:'Diesel rampe commune',ve:.01,eff:1.06,knock:0,cost:1500,d:1},
};
const TIMING={belt:{n:'Courroie crantée',m:2.5,cost:120,rel:-2,noise:-2,flt:1,fr:.995,d:'Légère et silencieuse, à remplacer périodiquement'},chain:{n:'Chaîne',m:5,cost:260,rel:0,noise:0,flt:1,fr:1,d:'Lubrifiée par l\'huile moteur, prévue pour la vie du moteur'},gear:{n:'Cascade de pignons',m:9,cost:900,rel:3,noise:7,flt:1.04,fr:1.01,d:'Calage rigoureux à très haut régime, mais lourde, chère et bruyante'}};
const BLOCK={iron:{n:'Fonte grise',mf:1,cf:1,st:1.15,rel:3},cgi:{n:'Fonte vermiculaire (CGI)',mf:.85,cf:1.25,st:1.3,rel:3},alu:{n:'Aluminium',mf:.55,cf:1.5,st:1,rel:0},mg:{n:'Magnésium-aluminium',mf:.46,cf:2.3,st:.92,rel:-2}};
const LINER={cast:{n:'Chemises fonte',fr:1,m:.55,kn:0,cost:0,rel:0},alusil:{n:'Alusil',fr:.985,m:0,kn:.1,cost:60,rel:0},nikasil:{n:'Nikasil',fr:.975,m:0,kn:.15,cost:110,rel:1},plasma:{n:'Projection plasma',fr:.965,m:0,kn:.2,cost:160,rel:1}};
const SUMP={wet:{n:'Carter humide'},dry:{n:'Carter sec'}};
const VALVE={steel:{n:'Acier',flt:1,kn:0,cost:0,rel:0},sodium:{n:'Refroidies au sodium',flt:1,kn:.25,cost:25,rel:2},ti:{n:'Titane',flt:1.08,kn:0,cost:120,rel:0}};
const SPRING={coil:{n:'Ressorts hélicoïdaux',flt:1,cost:0,rel:0},pneu:{n:'Rappel pneumatique',flt:1.28,cost:6000,rel:-3}};
const INTAKE={std:{n:'Papillon unique',ve:0,al:1,ah:1,cost:0,resp:0},vario:{n:'Longueur variable',ve:.01,al:.85,ah:.92,cost:300,resp:0},itb:{n:'Papillons individuels',ve:.025,al:1.05,ah:.9,cost:1400,resp:4}};
const FNEED={sp95:1,sp98:1,e85:1.38,diesel:.8};
const NT={na:0,turbo:1,biturbo:2,tri:3,quad:4,sc:0};
const STAGE={par:{n:'En parallèle'},seq:{n:'Séquentiel'},comp:{n:'Étagé en série'}};
const TURBO={wg:{n:'Géométrie fixe à wastegate',sp:1,ch:1,tau:1,cost:0,m:0,rel:0,resp:0},ts:{n:'Twin-scroll',sp:.85,ch:1,tau:.8,cost:350,m:1,rel:0,resp:6},vgt:{n:'Géométrie variable',sp:.68,ch:1.1,tau:.6,cost:700,m:1.5,rel:-2,resp:12},et:{n:'Turbo électrique',sp:.4,ch:1.05,tau:.25,cost:2600,m:6,rel:-2,resp:24}};
const BEAR={journal:{n:'Paliers lisses',sp:1,tau:1,cost:0},ball:{n:'Roulements à billes',sp:.9,tau:.8,cost:500}};
const SCT={roots:{n:'Roots',loss:1.1,cost:0},screw:{n:'Double vis',loss:.85,cost:600},centri:{n:'Centrifuge',loss:.6,cost:300}};
const GEARSETS={
 zf8hp:{n:'ZF 8HP · 8 rapports (BMW, Audi, Jaguar…)',type:'auto',cap:700,r:[4.714,3.143,2.106,1.667,1.285,1,.839,.667]},
 zf6hp:{n:'ZF 6HP · 6 rapports',type:'auto',cap:600,r:[4.171,2.340,1.521,1.143,.867,.691]},
 aisin6:{n:'Aisin TF-80SC · 6 rapports (PSA, Volvo, Ford)',type:'auto',cap:450,r:[4.148,2.370,1.556,1.155,.859,.686]},
 mb7g:{n:'Mercedes 7G-Tronic · 7 rapports',type:'auto',cap:735,r:[4.377,2.859,1.921,1.368,1,.820,.728]},
 mb9g:{n:'Mercedes 9G-Tronic · 9 rapports',type:'auto',cap:1000,r:[5.354,3.243,2.252,1.636,1.211,1,.865,.717,.601]},
 gm4l60:{n:'GM 4L60-E · 4 rapports',type:'auto',cap:480,r:[3.059,1.625,1,.696]},
 ford10r:{n:'Ford-GM 10R80 · 10 rapports',type:'auto',cap:950,r:[4.696,2.985,2.146,1.769,1.520,1.275,1,.854,.689,.636]},
 dq250:{n:'Volkswagen DSG DQ250 · 6 rapports (équivalents)',type:'dct',cap:350,r:[3.462,2.050,1.300,.902,.675,.559]},
 pdk7:{n:'Porsche PDK · 7 rapports',type:'dct',cap:700,r:[3.91,2.29,1.65,1.30,1.08,.88,.62]},
 getrag7:{n:'Getrag 7DCL750 · 7 rapports (Ferrari 458)',type:'dct',cap:750,r:[3.08,2.19,1.63,1.29,1.03,.84,.69]},
 etg6:{n:'PSA ETG6 · robotisée 6 rapports',type:'amt',cap:300,r:[3.54,1.92,1.32,.98,.76,.60]},
 smart5:{n:'Getrag robotisée 5 rapports (Smart)',type:'amt',cap:200,r:[3.31,1.91,1.26,.93,.72]},
 jatco:{n:'Jatco CVT8 · variation continue',type:'cvt',cap:250,r:null,first:2.63,top:.38},
};
const OIL={'0w20':{n:'0W-20',h:8.5,c:90},'5w30':{n:'5W-30',h:11,c:120},'5w40':{n:'5W-40',h:14,c:130},'10w40':{n:'10W-40',h:14.5,c:180},'20w50':{n:'20W-50',h:18.5,c:330},'10w60':{n:'10W-60',h:24,c:220}};
const FUEL={sp95:{n:'SP95',oct:10.6,pw:1,lhv:32.0,co2:23.1},sp98:{n:'SP98',oct:11.4,pw:1.005,lhv:32.0,co2:23.1},e85:{n:'E85',oct:13.2,pw:1.04,lhv:22.6,co2:16.4},diesel:{n:'Gazole',oct:99,pw:1,lhv:35.9,co2:26.5,diesel:1}};
const EXH={
 man:{cast:{n:'Fonte',f:.985,c:120},tub:{n:'Tubulaire',f:1,c:350},race:{n:'Course',f:1.02,c:850}},
 cat:{none:{n:'Sans',f:1.015,c:0},tri:{n:'3 voies',f:1,c:350},gpf:{n:'3 voies + filtre à particules',f:.99,c:650},sport:{n:'Haut débit',f:1.008,c:750}},
 muf:{free:{n:'Libre',f:1.03,c:60,noise:95,snd:10},sport:{n:'Sport',f:1.015,c:260,noise:70,snd:5},std:{n:'Standard',f:1,c:180,noise:52,snd:0},comf:{n:'Confort',f:.985,c:330,noise:38,snd:-8},valve:{n:'Actif à clapets',f:1.02,c:900,noise:55,snd:8}},
};
const BODY={
 citadine:{n:'Citadine',d:'3 portes',kind:'hatch',L:3650,WB:2400,FO:720,W:1650,H:1470,gc0:150,cd:.33,A:2.00,m:480,cargo:240,tank:40,tireMax:630,seats:[2,4],bay:{FT:620,RR:480},bw:800,pill:[.56],
  p:{noseH:720,cowlX:1080,cowlH:950,roofX1:1650,roofX2:3150,drop:30,deckX:3575,deckH:980,tailH:900}},
 compacte:{n:'Compacte',d:'5 portes',kind:'hatch',L:4250,WB:2620,FO:850,W:1780,H:1450,gc0:145,cd:.31,A:2.15,m:620,cargo:380,tank:50,tireMax:680,seats:[4,5],bay:{FT:740,FL:640},bw:900,pill:[.43,.76],
  p:{noseH:740,cowlX:1250,cowlH:980,roofX1:1900,roofX2:3600,drop:40,deckX:4150,deckH:1010,tailH:920}},
 berline:{n:'Berline',d:'4 portes',kind:'sedan',L:4750,WB:2820,FO:880,W:1840,H:1440,gc0:140,cd:.28,A:2.20,m:700,cargo:480,tank:60,tireMax:700,seats:[4,5],bay:{FT:800,FL:760},bw:960,pill:[.42,.76],
  p:{noseH:730,cowlX:1380,cowlH:970,roofX1:2080,roofX2:3500,drop:30,deckX:4150,deckH:1010,tailH:985}},
 break:{n:'Break',d:'5 portes',kind:'wagon',L:4800,WB:2820,FO:880,W:1840,H:1470,gc0:140,cd:.30,A:2.25,m:740,cargo:600,tank:60,tireMax:700,seats:[5,7],bay:{FT:800,FL:760},bw:960,pill:[.36,.63,.86],
  p:{noseH:730,cowlX:1380,cowlH:970,roofX1:2080,roofX2:4380,drop:50,deckX:4720,deckH:1010,tailH:930}},
 coupe:{n:'Coupé',d:'2+2',kind:'coupe',L:4450,WB:2650,FO:850,W:1830,H:1330,gc0:125,cd:.29,A:2.00,m:640,cargo:300,tank:60,tireMax:700,seats:[2,4],bay:{FL:900,FT:780,RR:700},bw:980,pill:[.52],gl:.8,
  p:{noseH:680,cowlX:1500,cowlH:920,roofX1:2150,roofX2:3050,drop:30,deckX:4150,deckH:960,tailH:935}},
 roadster:{n:'Roadster',d:'2 places',kind:'roadster',L:4000,WB:2400,FO:780,W:1740,H:1240,gc0:120,cd:.36,A:1.80,m:540,cargo:150,tank:45,tireMax:660,seats:[2],bay:{FL:940,MR:640},bw:900,pill:[],
  p:{noseH:640,cowlX:1500,cowlH:860,roofX1:1900,roofX2:2700,drop:0,deckX:3930,deckH:850,tailH:825}},
 suv:{n:'SUV',d:'5 portes',kind:'suv',L:4650,WB:2750,FO:880,W:1900,H:1700,gc0:200,cd:.36,A:2.70,m:820,cargo:550,tank:65,tireMax:800,seats:[5,7],bay:{FL:800,FT:860},bw:1040,pill:[.38,.68,.88],
  p:{noseH:980,cowlX:1380,cowlH:1200,roofX1:1960,roofX2:4150,drop:50,deckX:4570,deckH:1230,tailH:1110}},
 pickup:{n:'Pick-up',d:'double cabine',kind:'pickup',L:5300,WB:3200,FO:900,W:1900,H:1800,gc0:220,cd:.42,A:2.90,m:900,cargo:1100,tank:80,tireMax:840,seats:[2,5],bay:{FL:880},bw:1060,pill:[.5],
  p:{noseH:1060,cowlX:1450,cowlH:1280,roofX1:2000,roofX2:3300,drop:20,deckX:3360,deckH:1270,tailH:1270}},
 supercar:{n:'Supercar',d:'moteur central',kind:'super',L:4550,WB:2680,FO:1000,W:1960,H:1180,gc0:110,cd:.34,A:2.00,m:600,cargo:110,tank:75,tireMax:720,seats:[2],bay:{MR:1000},bw:1120,pill:[],gl:.5,
  p:{noseH:540,cowlX:1250,cowlH:790,roofX1:2050,roofX2:2750,drop:20,deckX:4050,deckH:900,tailH:885}},
};
const POS={FT:{n:'Avant transversal',fw:61,drv:['fwd','awd']},FL:{n:'Avant longitudinal',fw:53,drv:['rwd','awd']},MR:{n:'Central arrière',fw:42,drv:['rwd','awd']},RR:{n:'Porte-à-faux arrière',fw:38,drv:['rwd','awd']}};
const DRV={fwd:'Traction',rwd:'Propulsion',awd:'Intégrale'};
const CHAS={ladder:{n:'Châssis échelle',mf:1.16,rig:55,cost:1900,saf:34,comf:-4},steel:{n:'Monocoque acier',mf:1,rig:76,cost:2600,saf:44,comf:0},alu:{n:'Monocoque alu',mf:.80,rig:82,cost:7000,saf:46,comf:0},tube:{n:'Treillis tubulaire',mf:.74,rig:72,cost:9500,saf:30,comf:-8},carbon:{n:'Monocoque carbone',mf:.58,rig:98,cost:42000,saf:54,comf:-2}};
const PANEL={steel:{n:'Acier',mf:1,cost:1200},alu:{n:'Aluminium',mf:.62,cost:3200},grp:{n:'Composite',mf:.55,cost:2200},carbon:{n:'Carbone',mf:.36,cost:14000}};
// conception de la boîte (étagement libre) : pignons, denture, synchroniseurs, embrayage
const GMAT={std:{n:'Acier standard',k:1,c:0,m:0},case:{n:'Acier cémenté',k:1.35,c:250,m:0},nitr:{n:'Acier nitruré',k:1.6,c:650,m:0},aero:{n:'Acier aéronautique',k:2,c:1900,m:-3}};
const GTEETH={straight:{n:'Denture droite',k:1.15,eta:1.008,comf:-14,c:0},helical:{n:'Denture hélicoïdale',k:1,eta:1,comf:0,c:160}};
const GSYNC={none:{n:'Sans synchros',shift:1.9,comf:-22,c:-150},brass:{n:'Synchros laiton',shift:1,comf:0,c:0},multi:{n:'Synchros multicônes',shift:.8,comf:4,c:320},carbon:{n:'Synchros carbone',shift:.62,comf:5,c:950}};
const CLUTCH={single:{n:'Monodisque organique',k:1,comf:0,c:0,m:0},twin:{n:'Bidisque',k:1.75,comf:-4,c:550,m:4},ceram:{n:'Céramétallique',k:1.45,comf:-12,c:350,m:0},carbon:{n:'Multidisque carbone',k:2.6,comf:-14,c:4200,m:-4}};
const GTYPE_K={man:1,auto:1.1,amt:1,cvt:.75,dct:1,seq:1.1};
const usesClutch=g=>g==='man'||g==='amt'||g==='seq'||g==='dct';
const usesSync=g=>g==='man'||g==='amt';
function gbxSpec(S){
  const t=S.gearbox,wf=.5+S.gWidth/100*1.9,mt=GMAT[S.gMat]||GMAT.case,th=GTEETH[S.gTeeth]||GTEETH.helical,sy=GSYNC[S.gSync]||GSYNC.brass,cl=CLUTCH[S.clutch]||CLUTCH.single;
  const gearCap=220*mt.k*th.k*wf*(GTYPE_K[t]||1)*(S.gCool?1.1:1);
  const clutchCap=usesClutch(t)?(t==='dct'?1.6:1)*400*cl.k:Infinity;
  const cap=Math.min(gearCap,clutchCap);
  return {gearCap,clutchCap,cap,lim:clutchCap<gearCap?'clutch':'gears',
    m:(wf-1.45)*20+mt.m+(usesClutch(t)?cl.m:0)+(S.gCool?3.5:0),
    cost:wf*320+mt.c+th.c+(usesSync(t)?sy.c:0)+(usesClutch(t)?cl.c:0)+(S.gCool?380:0),
    shift:usesSync(t)?sy.shift:1,eta:th.eta,
    comf:th.comf*(t==='seq'?.5:1)+(usesSync(t)?sy.comf:0)+(usesClutch(t)?cl.comf:0)};
}
const GBX={man:{n:'Manuelle',eta:.935,shift:.28,cut:0,m:0,cost:900,sport:85,comf:55},auto:{n:'Automatique à convertisseur',eta:.885,shift:.35,cut:.55,m:32,cost:2300,sport:45,comf:95},amt:{n:'Robotisée simple embrayage',eta:.93,shift:.5,cut:0,m:8,cost:1400,sport:55,comf:50},cvt:{n:'Variation continue (CVT)',eta:.87,shift:0,cut:1,m:20,cost:2100,sport:25,comf:92},dct:{n:'Double embrayage',eta:.925,shift:.07,cut:.6,m:22,cost:3300,sport:92,comf:85},seq:{n:'Séquentielle',eta:.945,shift:.08,cut:0,m:-6,cost:6800,sport:100,comf:20}};
const SUSP={torsion:{n:'Essieu de torsion',grip:.93,comf:62,m:34,cost:300,off:35},mac:{n:'MacPherson',grip:.96,comf:72,m:38,cost:450,off:45},dw:{n:'Double triangulation',grip:1,comf:74,m:46,cost:950,off:55},multi:{n:'Multibras',grip:.99,comf:86,m:52,cost:1100,off:50},push:{n:'Poussoirs',grip:1.03,comf:45,m:40,cost:4200,off:10},rigid:{n:'Essieu rigide',grip:.90,comf:48,m:72,cost:380,off:95}};
const TYRE={eco:{n:'Éco',mu:.90,crr:.0075,cost:60,comf:4,off:20},road:{n:'Route',mu:.97,crr:.0095,cost:80,comf:2,off:25},sport:{n:'Sport',mu:1.05,crr:.011,cost:140,comf:0,off:10},semi:{n:'Semi-slick',mu:1.20,crr:.014,cost:260,comf:-6,off:0},at:{n:'Tout-terrain',mu:.82,crr:.015,cost:130,comf:-3,off:100}};
const BRK={drum:{n:'Tambours',k:.55,th:.6,m:1.2,cost:120},disc:{n:'Disques pleins',k:.85,th:1,m:1,cost:220},vent:{n:'Disques ventilés',k:1,th:1.5,m:1.25,cost:380},ccm:{n:'Carbone-céramique',k:1.12,th:2.8,m:.5,cost:4200}};
const TRIM={race:{n:'Course',m:22,cost:600,comf:-30,pres:10},basic:{n:'Basique',m:70,cost:900,comf:-12,pres:15},std:{n:'Standard',m:110,cost:2000,comf:0,pres:35},prem:{n:'Premium',m:160,cost:4500,comf:9,pres:65},lux:{n:'Luxe',m:235,cost:11000,comf:17,pres:100}};
const MEDIA={none:{n:'Aucun',m:0,cost:0,p:0},radio:{n:'Radio',m:3,cost:150,p:5},screen:{n:'Écran tactile',m:8,cost:700,p:12},hifi:{n:'Hi-fi',m:24,cost:2800,p:22}};
const PASS={min:{n:'Minimale',m:15,cost:200,s:0},std:{n:'Standard',m:55,cost:900,s:20},adv:{n:'Avancée',m:115,cost:2600,s:32}};
const STEER={mech:{n:'Mécanique',m:0,cost:0},hyd:{n:'Hydraulique',m:13,cost:350},elec:{n:'Électrique',m:8,cost:450}};
const PAINTS=[['#1f5fa8','Bleu de France'],['#b3261e','Rouge'],['#f2b705','Jaune'],['#1d4d3a','Vert anglais'],['#1b1d22','Noir'],['#b9bec5','Gris argent'],['#f1f1ee','Blanc'],['#e0621a','Orange'],['#6a1b2a','Bordeaux'],['#14213d','Bleu nuit']];

const ENG_BASE={liner:'alusil',sump:'wet',valveMat:'steel',springs:'coil',intake:'std',cda:false,turboStage:'par',turboSize2:70,seqRpm:3500,boostLow:.6,turboType:'wg',turboBearing:'journal',scType:'roots',timing:'chain',blockMat:'alu',headMat:'alu',internals:'forged',valvetrain:'dohc4',cam:40,vvt:true,vvl:false,limiter:6500,fuelSys:'mpi',fuel:'sp98',cr:10.5,lambda:.9,aspiration:'na',boost:.8,turboSize:40,intercooler:'air',manifold:'tub',cat:'tri',muffler:'std'};
const ENGINES=[
 ['Petites cylindrées',[
  ['Renault Cléon-Fonte 1.1 · culbuté à carburateur',{config:'I4',bore:70,stroke:72,blockMat:'iron',internals:'cast',valvetrain:'ohv',cam:25,vvt:false,limiter:6000,fuelSys:'carb',fuel:'sp95',cr:9.2,lambda:.9,manifold:'cast',cat:'none'}],
  ['Peugeot TU3 1.4 · 8 soupapes',{timing:'belt',config:'I4',bore:75,stroke:77,internals:'cast',valvetrain:'sohc',cam:30,vvt:false,limiter:6500,fuel:'sp95',cr:10.2,lambda:.95,manifold:'cast'}],
  ['Renault F4R 2.0 16v · Clio RS',{timing:'belt',config:'I4',bore:82.7,stroke:93,cam:60,limiter:7100,cr:11.5}],
  ['Honda K20A 2.0 VTEC · Civic Type R',{config:'I4',bore:86,stroke:86,internals:'ti',cam:72,vvl:true,limiter:8400,cr:11.5,muffler:'sport'}],
  ['Fiat FIRE 1.2 · 8 soupapes',{timing:'belt',config:'I4',bore:70.8,stroke:78.9,blockMat:'iron',internals:'cast',valvetrain:'sohc',cam:18,vvt:false,limiter:6000,cr:9.8,lambda:.95,manifold:'cast',fuel:'sp95'}],
  ['Toyota 4A-GE 1.6 · 16 soupapes AE86',{timing:'belt',config:'I4',bore:81,stroke:77,blockMat:'iron',internals:'forged',cam:48,vvt:false,limiter:7600,fuelSys:'mpi',cr:10.3,intake:'std',muffler:'sport'}],
  ['Ford EcoBoost 1.0 · 3 cylindres turbo',{timing:'belt',config:'I3',bore:71.9,stroke:82,blockMat:'iron',internals:'forged',cam:30,limiter:6200,fuelSys:'di',cr:9.6,aspiration:'turbo',boost:.8,turboSize:15,turboBearing:'ball',manifold:'cast'}],
  ['Honda F20C 2.0 · S2000',{config:'I4',bore:87,stroke:84,internals:'ti',cam:88,vvl:true,limiter:9000,cr:11.7,muffler:'sport'}],
  ['Mazda Skyactiv-G 2.0 · MX-5 ND',{config:'I4',bore:83.5,stroke:91.2,internals:'forged',cam:55,limiter:7000,fuelSys:'di',cr:13,muffler:'sport'}],
  ['Volkswagen Type 1 1.6 · 4 à plat refroidi par air',{config:'F4',bore:85.5,stroke:69,blockMat:'mg',liner:'cast',headMat:'alu',internals:'cast',valvetrain:'ohv',timing:'gear',cam:0,vvt:false,limiter:4500,fuelSys:'carb',fuel:'sp95',cr:7,lambda:.92,manifold:'cast',cat:'none',muffler:'std'}],
  ['Mercedes M266 1.5 · 4 cylindres A150',{config:'I4',bore:83,stroke:69.2,internals:'cast',valvetrain:'sohc',cam:30,vvt:false,limiter:6200,fuel:'sp95',cr:10.6,lambda:.95,manifold:'cast'}],
 ]],
 ['Turbo essence',[
  ['Volkswagen EA888 2.0 TSI · Golf GTI',{config:'I4',bore:82.5,stroke:92.8,cam:35,limiter:6800,fuelSys:'di',cr:9.6,aspiration:'turbo',boost:.9,turboSize:35,manifold:'cast'}],
  ['Audi 2.5 TFSI · 5 cylindres RS3',{config:'I5',bore:82.5,stroke:92.8,internals:'ti',cam:42,limiter:7000,fuelSys:'di',cr:9.3,lambda:.86,aspiration:'turbo',boost:1.3,turboSize:55,intercooler:'water',muffler:'sport'}],
  ['Subaru EJ25 2.5 · boxer turbo',{timing:'belt',config:'F4',bore:99.5,stroke:79,cam:38,limiter:6800,cr:8.2,aspiration:'turbo',boost:1.0,turboSize:50}],
  ['Nissan RB26DETT 2.6 · 6 en ligne biturbo',{timing:'belt',config:'I6',bore:86,stroke:73.7,blockMat:'iron',cam:50,vvt:false,limiter:8000,cr:8.5,aspiration:'biturbo',boost:.75,turboSize:45,muffler:'sport'}],
  ['Toyota 2JZ-GTE 3.0 · 6 en ligne biturbo',{timing:'belt',config:'I6',bore:86,stroke:86,blockMat:'iron',cam:40,limiter:6800,cr:8.5,aspiration:'biturbo',boost:.8,turboSize:45}],
  ['Volkswagen 1.8T 20v · AUQ Golf GTI',{timing:'belt',config:'I4',bore:81,stroke:86.4,blockMat:'iron',internals:'forged',valvetrain:'dohc5',cam:38,vvt:false,limiter:6500,cr:9.3,aspiration:'turbo',boost:.6,turboSize:25,manifold:'cast'}],
  ['Mercedes M139 2.0 · A45 AMG',{config:'I4',bore:83,stroke:92,internals:'ti',cam:52,limiter:7200,fuelSys:'di',cr:8.6,aspiration:'turbo',boost:1.4,turboSize:65,turboType:'ts',turboBearing:'ball',intercooler:'water',sump:'dry',muffler:'sport'}],
  ['BMW N54 3.0 · 6 en ligne biturbo',{config:'I6',bore:84,stroke:89.6,internals:'forged',cam:30,vvl:true,limiter:7000,fuelSys:'di',cr:10.2,aspiration:'biturbo',boost:.5,turboSize:30,intercooler:'air'}],
  ['BMW B58 3.0 · 6 en ligne twin-scroll',{config:'I6',bore:82,stroke:94.6,internals:'forged',cam:40,vvl:true,limiter:7000,fuelSys:'di',cr:10.5,aspiration:'turbo',boost:.62,turboSize:45,turboType:'ts',turboBearing:'ball',intercooler:'water'}],
  ['Porsche Mezger 3.6 · 6 à plat 911 Turbo',{config:'F6',bore:100,stroke:76.4,internals:'forged',cam:42,limiter:7300,sump:'dry',cr:9.4,aspiration:'biturbo',boost:.55,turboSize:35,intercooler:'air',muffler:'sport'}],
  ['Toyota 3S-GTE 2.0 · Celica GT-Four',{timing:'belt',config:'I4',bore:86,stroke:86,blockMat:'iron',internals:'forged',cam:42,vvt:false,limiter:7000,cr:8.5,aspiration:'turbo',boost:.8,turboSize:40,intercooler:'air'}],
  ['Mitsubishi 4G63 2.0 · Lancer Evo',{timing:'belt',config:'I4',bore:85,stroke:88,blockMat:'iron',internals:'forged',cam:45,vvt:true,limiter:7000,cr:8.8,aspiration:'turbo',boost:1.0,turboSize:45,turboBearing:'ball',muffler:'sport'}],
  ['Peugeot EP6 THP 1.6 · 208 GTi',{timing:'chain',config:'I4',bore:77,stroke:85.8,blockMat:'alu',internals:'forged',cam:38,limiter:6500,fuelSys:'di',cr:9.8,aspiration:'turbo',boost:.9,turboSize:25,turboType:'ts',turboBearing:'ball'}],
  ['Nissan VR38DETT 3.8 · V6 biturbo GT-R',{config:'V6',bore:95.5,stroke:88.4,internals:'ti',cam:50,limiter:7100,fuelSys:'di',cr:9,aspiration:'biturbo',boost:1.0,turboSize:50,turboBearing:'ball',intercooler:'water',muffler:'sport'}],
 ]],
 ['Diesel',[
  ['Renault 1.5 dCi · K9K',{timing:'belt',config:'I4',bore:76,stroke:80.5,blockMat:'iron',valvetrain:'sohc',cam:8,vvt:false,limiter:5000,fuelSys:'cr',fuel:'diesel',cr:15.5,aspiration:'turbo',boost:1.2,turboSize:20,manifold:'cast'}],
  ['Volkswagen 1.9 TDI',{timing:'belt',config:'I4',bore:79.5,stroke:95.5,blockMat:'iron',valvetrain:'sohc',cam:5,vvt:false,limiter:4800,fuelSys:'cr',fuel:'diesel',cr:19,aspiration:'turbo',boost:1.1,turboSize:25,manifold:'cast'}],
  ['BMW N57S 3.0d · 6 en ligne triturbo M550d',{config:'I6',bore:84,stroke:90,cam:12,vvt:false,limiter:5400,fuelSys:'cr',fuel:'diesel',cr:16,aspiration:'tri',turboStage:'comp',boostLow:1.2,seqRpm:2600,turboSize:15,turboSize2:55,boost:2.6,turboType:'vgt',intercooler:'water',manifold:'cast',cat:'gpf'}],
  ['BMW M57 3.0d · 6 en ligne',{config:'I6',bore:84,stroke:90,blockMat:'iron',cam:12,vvt:false,limiter:5000,fuelSys:'cr',fuel:'diesel',cr:17,aspiration:'turbo',boost:1.5,turboSize:45,turboType:'vgt',manifold:'cast'}],
  ['PSA DW10 2.0 HDi · 4 cylindres 16v',{timing:'belt',config:'I4',bore:85,stroke:88,blockMat:'iron',cam:8,vvt:false,limiter:5000,fuelSys:'cr',fuel:'diesel',cr:17.6,aspiration:'turbo',boost:1.0,turboSize:25,turboType:'vgt',manifold:'cast'}],
  ['Mercedes OM642 3.0 CDI · V6',{config:'V6',bore:83,stroke:92,blockMat:'cgi',liner:'cast',cam:10,vvt:false,limiter:5200,fuelSys:'cr',fuel:'diesel',cr:17.7,aspiration:'turbo',boost:1.2,turboSize:35,turboType:'vgt',manifold:'cast'}],
  ['Toyota 1KD-FTV 3.0 · 4 cylindres D-4D',{config:'I4',bore:96,stroke:103,blockMat:'iron',cam:8,vvt:false,limiter:4600,fuelSys:'cr',fuel:'diesel',cr:15.6,aspiration:'turbo',boost:.9,turboSize:30,turboType:'vgt',manifold:'cast'}],
  ['Toyota 1HD-FT 4.2 · 6 en ligne Land Cruiser',{timing:'gear',config:'I6',bore:94,stroke:100,blockMat:'iron',internals:'cast',valvetrain:'sohc',cam:5,vvt:false,limiter:4300,fuelSys:'pd',fuel:'diesel',cr:18.8,aspiration:'turbo',boost:.9,turboSize:35,manifold:'cast'}],
  ['Mercedes OM654 2.0d · 4 cylindres E220d 194 ch',{config:'I4',bore:82,stroke:92.3,liner:'plasma',cam:12,vvt:false,limiter:5300,fuelSys:'cr',fuel:'diesel',cr:15.5,aspiration:'turbo',boost:1.9,turboSize:35,turboType:'vgt',turboBearing:'ball',manifold:'cast',cat:'gpf'}],
  ['Mercedes OM602 2.5 · 5 cylindres turbo IDI',{timing:'chain',config:'I5',bore:87,stroke:84,blockMat:'iron',internals:'cast',valvetrain:'sohc',cam:5,vvt:false,limiter:5000,fuelSys:'idi',fuel:'diesel',cr:22,aspiration:'turbo',boost:.6,turboSize:25,manifold:'cast',cat:'none'}],
 ]],
 ['Grosses cylindrées',[
  ['BMW S54 3.2 · 6 en ligne M3',{config:'I6',bore:87,stroke:91,blockMat:'iron',internals:'ti',cam:78,limiter:8000,cr:11.5,muffler:'sport'}],
  ['Porsche 3.6 · 6 à plat 911',{config:'F6',bore:100,stroke:76.4,cam:60,limiter:7300,cr:11.3,muffler:'sport'}],
  ['Chevrolet LS3 6.2 · V8 culbuté',{config:'V8',bore:103.25,stroke:92,valvetrain:'ohv',cam:62,vvt:false,limiter:6600,cr:10.7}],
  ['Ford Coyote 5.0 · V8 4 ACT',{config:'V8',bore:92.2,stroke:92.7,cam:62,limiter:7000,cr:11}],
  ['Ferrari F136 4.5 · V8 de 458 Italia',{config:'V8',bore:94,stroke:81,internals:'ti',cam:88,limiter:9000,fuelSys:'di',cr:12.5,lambda:.88,manifold:'race',cat:'sport',muffler:'sport'}],
  ['Lexus 1LR-GUE 4.8 · V10 de LFA',{config:'V10',bore:88,stroke:79,internals:'ti',cam:88,vvl:true,limiter:9000,cr:11.7,lambda:.88,manifold:'race',cat:'sport',muffler:'sport'}],
  ['Lamborghini 6.5 · V12 Aventador',{config:'V12',bore:95,stroke:76.4,internals:'ti',cam:80,limiter:8500,cr:11.5,lambda:.88,manifold:'race',cat:'sport',muffler:'sport'}],
  ['Alfa Romeo Busso 3.2 · V6 24v GTA',{timing:'belt',config:'V6',bore:93,stroke:78,internals:'forged',cam:45,vvt:false,limiter:6500,cr:10.5,muffler:'sport'}],
  ['Audi 4.2 FSI · V8 RS4 B7',{config:'V8',bore:84.5,stroke:92.8,internals:'ti',cam:70,limiter:8200,fuelSys:'di',cr:12.5,muffler:'sport'}],
  ['BMW S85 5.0 · V10 M5',{config:'V10',bore:94.6,stroke:75.2,internals:'ti',cam:60,limiter:8200,cr:12,intake:'vario',manifold:'race',muffler:'sport'}],
  ['Mercedes M156 6.2 · V8 AMG',{config:'V8',bore:102.2,stroke:92,blockMat:'alu',internals:'forged',cam:62,limiter:7200,cr:11.3,muffler:'sport'}],
  ['Chevrolet LT1 5.7 · V8 Corvette C4',{config:'V8',bore:101.6,stroke:88.4,blockMat:'iron',headMat:'alu',internals:'forged',valvetrain:'ohv',cam:38,vvt:false,limiter:6000,cr:10.5,muffler:'std'}],
 ]],
 ['Compresseur',[
  ['Mini Cooper S R53 1.6 · compresseur',{timing:'chain',config:'I4',bore:77,stroke:85.8,blockMat:'iron',internals:'forged',valvetrain:'sohc',cam:42,vvt:false,limiter:6800,cr:8.3,aspiration:'sc',scType:'roots',boost:.8,intercooler:'air',manifold:'cast'}],
  ['Mercedes M113K 5.4 · V8 compresseur AMG',{config:'V8',bore:97,stroke:92,blockMat:'alu',liner:'alusil',valvetrain:'sohc',cam:30,vvt:false,limiter:6200,cr:9,aspiration:'sc',scType:'screw',boost:.8,intercooler:'air',manifold:'cast'}],
  ['Jaguar AJ133 5.0 · V8 compresseur',{config:'V8',bore:92.5,stroke:93,cam:32,limiter:6800,fuelSys:'di',cr:9.5,aspiration:'sc',scType:'roots',boost:.6,intercooler:'water'}],
  ['Dodge Hellcat 6.2 · V8 culbuté compresseur',{config:'V8',bore:103.25,stroke:92.5,internals:'forged',valvetrain:'ohv',cam:35,vvt:false,limiter:6200,cr:8.3,lambda:.84,aspiration:'sc',scType:'roots',boost:1.5,intercooler:'water'}],
 ]],
 ['Rotatifs et moteurs en W',[
  ['Mazda 13B-MSP Renesis 1.3 · birotor RX-8',{config:'R2',bore:105,stroke:80,cam:70,limiter:9000,cr:10,muffler:'sport'}],
  ['Mazda 13B-REW 1.3 · birotor biturbo RX-7',{config:'R2',bore:105,stroke:80,cam:45,limiter:8000,cr:9,aspiration:'biturbo',turboStage:'seq',boostLow:.5,seqRpm:4500,turboSize2:45,boost:.52,turboSize:40,muffler:'sport'}],
  ['Mazda 20B-REW 2.0 · trirotor biturbo Cosmo',{config:'R3',bore:105,stroke:80,cam:35,limiter:7500,cr:9,aspiration:'biturbo',boost:.3,turboSize:40}],
  ['Mazda R26B 2.6 · quadrirotor 787B du Mans',{config:'R4',bore:105,stroke:80,internals:'ti',cam:100,limiter:9500,cr:10.5,fuel:'e85',lambda:.88,intake:'itb',sump:'dry',manifold:'race',cat:'none',muffler:'free'}],
  ['Bugatti EB110 3.5 · V12 quadriturbo',{config:'V12',bore:81,stroke:56.6,valvetrain:'dohc5',internals:'ti',cam:62,vvt:false,limiter:8200,cr:8,aspiration:'quad',turboStage:'par',boost:.72,turboSize:30,sump:'dry',muffler:'sport'}],
  ['Volkswagen W8 4.0 · Passat W8',{config:'W8',bore:84,stroke:90.2,cam:40,limiter:6500,cr:10.8}],
  ['Bentley W12 6.0 · biturbo Continental GT',{config:'W12',bore:84,stroke:90.2,cam:35,limiter:6400,cr:9,aspiration:'biturbo',boost:.48,turboSize:40,intercooler:'water'}],
  ['Bugatti W16 8.0 · Veyron',{config:'W16',bore:86,stroke:86,internals:'ti',cam:40,limiter:6700,fuelSys:'mpi',cr:9,aspiration:'quad',turboStage:'seq',boostLow:.7,seqRpm:3700,turboSize2:50,boost:.88,turboSize:55,intercooler:'water',sump:'dry'}],
 ]],
 ['Classiques',[
  ['Ferrari Colombo 3.0 · V12 250 GT',{timing:'chain',config:'V12',bore:73,stroke:58.8,blockMat:'alu',liner:'cast',internals:'forged',valvetrain:'sohc',cam:60,vvt:false,limiter:7500,fuelSys:'carb',fuel:'sp98',cr:9.2,lambda:.88,manifold:'cast',cat:'none',muffler:'free'}],
  ['Jaguar XK 4.2 · 6 en ligne E-Type',{timing:'chain',config:'I6',bore:92.1,stroke:106,blockMat:'iron',headMat:'alu',liner:'cast',internals:'forged',cam:50,vvt:false,limiter:5400,fuelSys:'carb',fuel:'sp98',cr:9,lambda:.9,manifold:'cast',cat:'none',muffler:'std'}],
 ]],
];
const DEF={
 name:'Prototype 01',preset:'coupe',
 config:'I6',bore:84,stroke:89.6,blockMat:'alu',headMat:'alu',internals:'forged',
 valvetrain:'dohc4',timing:'chain',cam:45,vvt:true,vvl:false,limiter:7000,
 fuelSys:'mpi',fuel:'sp98',cr:10.5,lambda:.90,
 aspiration:'na',boost:.8,turboSize:40,intercooler:'air',
 manifold:'tub',cat:'tri',muffler:'sport',oilGrade:'5w40',oilFill:100,
 liner:'alusil',sump:'wet',valveMat:'steel',springs:'coil',intake:'std',cda:false,oilInt:0,kmYear:15000,gbxCap:450,gMat:'case',gWidth:55,gTeeth:'helical',gSync:'multi',clutch:'single',gCool:false,ecuFuel:'sp98',flex:false,ecuAdv:0,ecuIdle:0,injSize:0,fuelPress:3,launchCtl:false,pops:false,startStop:false,ecuVmax:false,turboStage:'par',turboSize2:70,seqRpm:3500,boostLow:.6,turboType:'wg',turboBearing:'journal',scType:'roots',gearSet:'',
 body:'coupe',enginePos:'FL',chassis:'steel',panels:'steel',paint:'#1f5fa8',wing:'lip',splitter:false,flatFloor:false,
 gearbox:'man',gears:6,first:3.6,top:.82,final:3.45,drive:'rwd',diff:'lsd',
 suspF:'mac',suspR:'multi',stiff:60,gc:125,arbF:55,arbR:50,
 rim:18,tireW:235,profile:40,stagger:20,compound:'sport',rimType:'alloy',
 brakeF:'vent',brakeFd:340,brakeR:'vent',brakeRd:320,
 seats:4,trim:'prem',media:'screen',passive:'std',abs:true,tc:true,esp:true,steering:'elec',
};
const PRESETS={
 coupe:{label:'Coupé 6 cylindres en ligne',s:{}},
 citadine:{label:'Citadine 3 cylindres',s:{name:'Prototype 02',config:'I3',bore:72,stroke:81.8,internals:'cast',cam:30,limiter:6400,fuel:'sp95',cr:10.5,lambda:.98,manifold:'cast',muffler:'std',body:'citadine',enginePos:'FT',paint:'#f2b705',wing:'none',gears:5,first:3.7,top:.78,final:4.2,drive:'fwd',diff:'open',suspR:'torsion',stiff:40,gc:150,arbF:45,arbR:35,rim:15,tireW:175,profile:65,stagger:0,compound:'eco',rimType:'steel',brakeF:'disc',brakeFd:250,brakeR:'drum',brakeRd:200,trim:'basic',media:'radio',tc:false}},
 berline:{label:'Berline 4 cylindres turbo',s:{name:'Prototype 03',config:'I4',bore:82.5,stroke:92.8,cam:32,limiter:6500,fuelSys:'di',cr:9.6,aspiration:'turbo',boost:.9,turboSize:30,manifold:'cast',muffler:'std',body:'berline',enginePos:'FT',paint:'#b9bec5',wing:'none',gearbox:'auto',gears:8,first:4.5,top:.66,final:3.1,drive:'fwd',diff:'open',stiff:35,gc:140,arbF:45,arbR:40,rim:17,tireW:225,profile:50,stagger:0,compound:'road',brakeFd:320,brakeR:'disc',brakeRd:300,seats:5,passive:'adv'}},
 supercar:{label:'Supercar V12 atmosphérique',s:{name:'Prototype 04',config:'V12',bore:92,stroke:76,internals:'ti',cam:78,vvl:true,limiter:8800,fuelSys:'di',cr:12.5,lambda:.88,manifold:'race',cat:'sport',body:'supercar',enginePos:'MR',gbxCap:750,gMat:'nitr',gWidth:80,clutch:'twin',gCool:true,chassis:'carbon',panels:'carbon',paint:'#b3261e',splitter:true,flatFloor:true,gearbox:'dct',gears:7,first:3.4,top:.72,final:3.6,diff:'active',suspF:'dw',suspR:'dw',stiff:78,gc:110,arbF:65,arbR:60,rim:20,tireW:255,profile:30,stagger:60,rimType:'forged',brakeF:'ccm',brakeFd:400,brakeR:'ccm',brakeRd:380,seats:2,passive:'adv'}},
 pickup:{label:'Pick-up V8 tout-terrain',s:{name:'Prototype 05',config:'V8',bore:94,stroke:90,blockMat:'iron',internals:'cast',valvetrain:'ohv',cam:35,vvt:false,limiter:5800,fuel:'sp95',cr:9.8,lambda:.92,manifold:'cast',muffler:'std',body:'pickup',chassis:'ladder',gbxCap:650,gMat:'nitr',gWidth:72,paint:'#1d4d3a',wing:'none',gearbox:'auto',first:4.2,top:.70,final:3.9,drive:'awd',suspF:'dw',suspR:'rigid',stiff:45,gc:240,arbF:40,arbR:30,rim:17,tireW:265,profile:70,stagger:0,compound:'at',brakeFd:330,brakeR:'disc',brakeRd:320,seats:5,trim:'std',media:'radio',esp:false,steering:'hyd'}},
 roadster:{label:'Roadster léger 4 cylindres',s:{name:'Prototype 06',config:'I4',bore:83,stroke:85,cam:55,limiter:7600,cr:11.2,body:'roadster',chassis:'alu',panels:'grp',paint:'#1d4d3a',wing:'none',first:3.4,top:.84,final:4.1,suspF:'dw',suspR:'dw',stiff:62,gc:120,arbF:50,arbR:45,rim:16,tireW:205,profile:45,stagger:0,brakeFd:280,brakeR:'disc',brakeRd:270,seats:2,trim:'std',media:'radio',tc:false,esp:false,steering:'hyd'}},
};
