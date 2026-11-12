'use strict';
/* ───────────── Réglages ───────────── */
const o=(obj)=>Object.entries(obj).map(([k,v])=>[k,v.n]);
const UI={
 moteur:[
  {t:'Moteurs tout prêts',note:()=>'Architectures et cotes inspirées de moteurs de série, valeurs approchées. Les puissances simulées restent des ordres de grandeur ; chaque réglage reste modifiable ensuite.',items:[{k:'engSel',type:'engsel'}]},
  {t:'Architecture',note:()=>{const E=M.E,q=S.stroke/S.bore;if(E.rot) return `${E.c.full} · ${E.rot} × ${nf(E.disp/E.rot)} cm³ = ${nf(E.disp)} cm³ · respire comme un ${nf(E.disp*2,-1)} cm³ à pistons, car chaque rotor a une combustion par tour d'arbre.`;return `${E.c.full} · ${nf(E.disp)} cm³ · ${nf(E.disp/E.n)} cm³ par cylindre · ${q<.95?'moteur supercarré':q>1.05?'moteur longue course':'moteur carré'} (course/alésage ${nf(q,2)})`;},items:[
   {k:'config',type:'seg',l:'Disposition des cylindres',wide:1,opts:Object.entries(CFG).map(([k,v])=>[k,v.lab,v.full])},
   {k:'bore',type:'range',l:'Alésage',lf:()=>CFG[S.config].rot?'Rayon du rotor':'Alésage',min:60,max:110,step:.5,d:1,u:'mm',hint:'Un grand alésage loge de grosses soupapes : le moteur respire mieux à haut régime.'},
   {k:'vAngle',type:'seg',l:'Angle du V',opts:[[0,"D'origine"],[60,'60°'],[90,'90°']],dis:S=>CFG[S.config].lay!=='V'&&'Réservé aux moteurs en V',hint:'60° : moteur étroit et haut ; idéal pour V6 et V12. 90° : large et bas, parfait pour un V8 à vilebrequin croisé, mais un V6 à 90° vibre davantage.'},
   {k:'stroke',type:'range',l:'Course',lf:()=>CFG[S.config].rot?'Largeur du rotor':'Course',min:50,max:110,step:.2,d:1,u:'mm',hint:'Une longue course donne du couple en bas mais limite le régime maxi.'},
  ]},
  {t:'Bloc et équipage mobile',items:[
   {k:'blockMat',type:'seg',l:'Bloc-cylindres',wide:1,opts:o(BLOCK),hint:'La fonte vermiculaire encaisse les pressions des diesels modernes ; le magnésium est le plus léger mais le moins rigide.'},
   {k:'liner',type:'seg',l:'Surface des cylindres',wide:1,opts:o(LINER),dis:(S,v)=>(S.blockMat==='iron'||S.blockMat==='cgi')&&v!=='cast'&&'Bloc en fonte : les cylindres sont usinés directement dans la matière',hint:'Les revêtements durs suppriment les chemises fonte : moins de poids, moins de frottements et une chaleur mieux évacuée.'},
   {k:'sump',type:'seg',l:'Graissage',opts:o(SUMP),hint:'Carter sec : réservoir séparé, moteur plus bas, pas de déjaugeage en virage.'},
   {k:'headMat',type:'seg',l:'Culasse',opts:[['iron','Fonte'],['alu','Aluminium']]},
   {k:'internals',type:'seg',l:'Vilebrequin, bielles, pistons',wide:1,opts:[['cast','Fonte moulée'],['forged','Acier forgé'],['ti','Bielles titane']],hint:"Fixe le couple et la vitesse de piston que l'équipage mobile encaisse."},
  ]},
  {t:'Distribution',note:()=>`${TIMING[S.timing].n} : ${nf(M.E.tmMass,1)} kg sur ce moteur, compris dans les ${nf(M.E.mass)} kg du moteur.`,items:[
   {k:'valvetrain',type:'seg',l:'Commande des soupapes',wide:1,opts:o(VT),dis:S=>CFG[S.config].rot&&'Sans objet sur un moteur rotatif'},
   {k:'timing',type:'seg',l:'Entraînement de la distribution',wide:1,opts:o(TIMING),dis:S=>CFG[S.config].rot&&'Sans objet sur un moteur rotatif',hint:'Courroie : légère et silencieuse. Chaîne : durable. Cascade de pignons : précise à haut régime, mais lourde et bruyante.'},
   {k:'cam',type:'range',l:"Profil d'arbre à cames",lf:()=>CFG[S.config].rot?'Calage des lumières':"Profil d'arbre à cames",min:0,max:100,step:1,f:v=>(v<25?'Souple':v<50?'Routier':v<75?'Sport':'Course')+' · '+v,hint:'Un profil pointu déplace le couple vers les hauts régimes et dégrade le ralenti.'},
   {k:'camLift',type:'range',l:'Levée des cames',min:0,max:100,step:1,f:v=>(v<30?'Faible':v<65?'Moyenne':'Forte')+` · ${nf(7+v*.07,1)} mm`,dis:S=>!!CFG[S.config].rot,hint:"Plus de levée laisse entrer plus d'air en haut, mais fatigue les ressorts : les soupapes s'affolent plus tôt."},
   {k:'camOverlap',type:'range',l:'Croisement des soupapes',min:0,max:100,step:1,f:v=>`${Math.round(5+v*.75)}°`+(v<30?' · doux':v<60?' · route':' · agressif'),dis:S=>!!CFG[S.config].rot,hint:"Beaucoup de croisement : le moteur respire mieux en haut avec un bon échappement, mais le ralenti devient irrégulier (le fameux « galop ») et il consomme plus."},
   {k:'camF',type:'seg',l:'Poussoirs',wide:1,opts:o(CAMF),dis:S=>CFG[S.config].rot&&'Sans objet sur un moteur rotatif',hint:'Hydrauliques : silencieux et sans réglage, mais ils limitent le régime. Linguets à rouleaux : peu de frottements et des régimes élevés.'},
   {k:'limiter',type:'range',l:'Rupteur',min:1500,max:11000,step:100,u:'tr/min',hint:'Au-delà de ce que tiennent pistons et soupapes, la fiabilité chute.'},
   {k:'valveMat',type:'seg',l:'Soupapes',wide:1,opts:o(VALVE),dis:S=>CFG[S.config].rot&&'Sans objet sur un moteur rotatif',hint:'Sodium : évacue la chaleur des soupapes d\'échappement. Titane : plus légères, elles suivent les cames plus haut.'},
   {k:'springs',type:'seg',l:'Rappel des soupapes',wide:1,opts:o(SPRING),dis:S=>CFG[S.config].rot&&'Sans objet sur un moteur rotatif',hint:'Le rappel pneumatique vient de la compétition : il repousse très loin l\'affolement.'},
   {k:'vvt',type:'toggle',l:'Calage variable',dis:S=>!!CFG[S.config].rot,hint:'Remplit mieux à bas régime.'},
   {k:'vvl',type:'toggle',l:'Levée variable',dis:S=>!!CFG[S.config].rot,hint:'Élargit la plage utile en haut.'},
   {k:'cda',type:'toggle',l:'Désactivation de cylindres',dis:S=>!!CFG[S.config].rot,hint:'Coupe la moitié des cylindres à faible charge pour consommer moins.'},
  ]},
  {t:'Alimentation',items:[
   {k:'fuel',type:'seg',l:'Carburant',wide:1,opts:o(FUEL),dis:(S,v)=>CFG[S.config].rot&&FUEL[v].diesel&&'Pas de diesel rotatif',hint:'Le gazole s\'enflamme par compression : pas de bougies, taux élevé, régime limité, mais beaucoup de couple et un meilleur rendement.'},
   {k:'fuelSys',type:'seg',l:'Système',wide:1,opts:o(FS),dis:(S,v)=>!!FS[v].d!==!!FUEL[S.fuel].diesel&&(FS[v].d?'Réservé au gazole':'Réservé à l\'essence')},
   {k:'intake',type:'seg',l:'Admission',wide:1,opts:o(INTAKE),hint:'Longueur variable : du couple en bas et de l\'allonge en haut. Papillons individuels : réponse immédiate, réservés aux moteurs sportifs.'},
   {k:'cr',type:'range',l:'Taux de compression',min:7,max:22,step:.1,d:1,f:v=>nf(v,1)+' : 1',hint:"Essence : plus de rendement jusqu'au cliquetis (9 à 13). Gazole : 15 à 20."},
   {k:'lambda',type:'range',l:'Richesse à pleine charge (λ)',min:.8,max:1.05,step:.01,d:2,dis:S=>!!FUEL[S.fuel].diesel,hint:'0,88 pour la puissance, 1,00 pour la consommation.'},
  ]},
  {t:'Calculateur (ECU)',note:()=>{const E=M.E;if(!E.ecuOn) return S.fuelSys==='carb'?'Carburateur : pas de calculateur, tout est mécanique.':'Injection mécanique : pas de calculateur. Seuls le débit et la pression des injecteurs se règlent.';const st=E.mism==='lean'?' ATTENTION : mélange trop pauvre avec le carburant actuel.':E.mism==='rich'?' Mélange trop riche avec le carburant actuel.':S.flex?' Capteur d\'éthanol : la cartographie suit le carburant.':'';return `Cartographie pour ${FUEL[S.ecuFuel].n} · richesse réelle λ ${nf(E.lamAct,2)} · injecteurs ouverts à ${nf(E.duty*100)} % à pleine puissance (besoin ${nf(E.injNeed,-1)} cm³/min, débit ${nf(E.injFlow,-1)}).${st}`;},items:[
   {k:'ecuFuel',type:'seg',l:'Carburant de la cartographie',opts:[['sp95','SP95'],['sp98','SP98'],['e85','E85']],dis:S=>((S.fuelSys==='carb'||S.fuelSys==='idi')||FUEL[S.fuel].diesel)&&'Sans objet',hint:'Le calculateur dose l\'essence pour un carburant précis. L\'E85 en demande 38 % de plus : sans recalibrage, les corrections automatiques (±25 %) ne suffisent pas.'},
   {k:'flex',type:'toggle',l:'Capteur d\'éthanol (flex-fuel)',dis:S=>(S.fuelSys==='carb'||S.fuelSys==='idi')||!!FUEL[S.fuel].diesel,hint:'Mesure le taux d\'éthanol et adapte la cartographie tout seul.'},
   {k:'injSize',type:'range',l:'Débit des injecteurs',min:60,max:3000,step:10,u:'cm³/min',dis:S=>S.fuelSys==='carb',hint:'Trop petits : le moteur manque de carburant en haut. Trop gros : dosage imprécis au ralenti.'},
   {k:'fuelPress',type:'range',l:'Pression d\'essence',min:2.5,max:6,step:.1,d:1,u:'bar',dis:S=>S.fuelSys==='carb',hint:'Plus de pression fait débiter davantage les mêmes injecteurs, mais fatigue la pompe. (Valeur de rampe basse pression ; une injection directe la multiplie ensuite.)'},
   {k:'ecuAdv',type:'range',l:'Avance à l\'allumage',min:-10,max:10,step:1,f:v=>(v>0?'+':'')+v+'° par rapport à l\'origine',dis:S=>(S.fuelSys==='carb'||S.fuelSys==='idi'),hint:'Quelques degrés de plus donnent du couple, jusqu\'au cliquetis. En retirer protège le moteur mais échauffe l\'échappement.'},
   {k:'ecuIdle',type:'range',l:'Régime de ralenti',min:500,max:1800,step:50,u:'tr/min',dis:S=>(S.fuelSys==='carb'||S.fuelSys==='idi'),hint:'Un arbre à cames pointu réclame un ralenti plus haut.'},
   {k:'launchCtl',type:'toggle',l:'Départ automatisé (launch control)',dis:S=>(S.fuelSys==='carb'||S.fuelSys==='idi'),hint:'Tient le régime idéal au démarrage.'},
   {k:'pops',type:'toggle',l:'Pétarades à la décélération',dis:S=>(S.fuelSys==='carb'||S.fuelSys==='idi'),hint:'Injecte au lever de pied : du spectacle, mais le catalyseur chauffe et la consommation monte.'},
   {k:'startStop',type:'toggle',l:'Arrêt automatique à l\'arrêt (stop & start)',dis:S=>(S.fuelSys==='carb'||S.fuelSys==='idi'),hint:'Coupe le moteur aux feux : moins de consommation en ville.'},
   {k:'ecuVmax',type:'toggle',l:'Bridage à 250 km/h',dis:S=>(S.fuelSys==='carb'||S.fuelSys==='idi')},
  ]},
  {t:'Suralimentation',note:()=>{const E=M.E;if(!E.turbo) return E.sc?'Compresseur entraîné par le moteur.':'Moteur atmosphérique.';const nm=['','Un turbo','Deux turbos','Trois turbos','Quatre turbos'][E.nt];if(E.nt<2||E.stg==='par') return `${nm}${E.nt>1?' identiques en parallèle':''} · ${nf(S.boost,2)} bar.`;const big=E.nt-E.nSm;return E.stg==='seq'?`${nm} en séquentiel : ${E.nSm} petit${E.nSm>1?'s':''} seul${E.nSm>1?'s':''} à ${nf(Math.min(S.boostLow,S.boost),2)} bar jusqu'à ${nf(S.seqRpm)} tr/min, puis les ${E.nt} ensemble à ${nf(S.boost,2)} bar.`:`${nm} étagés : ${E.nSm} petit${E.nSm>1?'s':''} haute pression (${nf(Math.min(S.boostLow,S.boost),2)} bar) alimenté${E.nSm>1?'s':''} par ${big} gros basse pression, pour ${nf(S.boost,2)} bar au total.`;},items:[
   {k:'aspiration',type:'seg',l:'Type',wide:1,opts:[['na','Atmosphérique'],['turbo','Turbo'],['biturbo','Biturbo'],['tri','Triturbo'],['quad','Quadriturbo'],['sc','Compresseur']]},
   {k:'turboStage',type:'seg',l:'Montage des turbos',wide:1,opts:o(STAGE),dis:S=>NT[S.aspiration]<2&&'Il faut au moins deux turbos',hint:'En parallèle : turbos identiques qui se partagent les cylindres. Séquentiel : un petit seul en bas, les autres le rejoignent au régime de bascule. Étagé en série : un petit turbo haute pression souffle dans l\'air déjà comprimé par un gros, les pressions se multiplient.'},
   {k:'turboType',type:'seg',l:'Technologie du turbo',wide:1,opts:o(TURBO),dis:S=>!NT[S.aspiration]&&'Sans turbo',hint:'Twin-scroll : sépare les bouffées d\'échappement. Géométrie variable : des ailettes mobiles adaptent la turbine au régime. Électrique : un moteur lance la turbine avant les gaz.'},
   {k:'turboBearing',type:'seg',l:'Paliers du turbo',opts:o(BEAR),dis:S=>!NT[S.aspiration]&&'Sans turbo'},
   {k:'scType',type:'seg',l:'Type de compresseur',opts:o(SCT),dis:S=>S.aspiration!=='sc'&&'Sans compresseur',hint:'Roots et double vis soufflent dès le ralenti ; le centrifuge monte avec le régime.'},
   {k:'boost',type:'range',l:'Pression de suralimentation',lf:()=>NT[S.aspiration]>1&&S.turboStage!=='par'?'Pression finale':'Pression de suralimentation',min:.2,max:3.5,step:.05,d:2,u:'bar',dis:S=>S.aspiration==='na'},
   {k:'boostLow',type:'range',l:'Pression du premier étage',min:.2,max:2,step:.05,d:2,u:'bar',dis:S=>!(NT[S.aspiration]>1&&S.turboStage!=='par'),hint:'Ce que fournissent les petits turbos seuls, à bas régime.'},
   {k:'seqRpm',type:'range',l:'Régime de bascule',min:1500,max:6500,step:100,u:'tr/min',dis:S=>!(NT[S.aspiration]>1&&S.turboStage!=='par'),hint:'Régime où les gros turbos entrent en action. Trop tôt : ils ne sont pas encore lancés et le couple creuse. Trop tard : les petits s\'essoufflent.'},
   {k:'turboSize2',type:'range',l:'Taille des gros turbos',min:0,max:100,step:1,f:v=>(v<34?'Petit':v<67?'Moyen':'Gros')+' · '+v,dis:S=>!(NT[S.aspiration]>1&&S.turboStage!=='par')},
   {k:'turboSize',type:'range',l:'Taille du turbo',lf:()=>NT[S.aspiration]>1&&S.turboStage!=='par'?'Taille des petits turbos':NT[S.aspiration]>1?'Taille des turbos':'Taille du turbo',min:0,max:100,step:1,f:v=>(v<34?'Petit':v<67?'Moyen':'Gros')+' · '+v,dis:S=>!NT[S.aspiration],hint:'Petit : réponse immédiate, essoufflé en haut. Gros : puissance, mais temps de réponse.'},
   {k:'intercooler',type:'seg',l:"Refroidisseur d'air",wide:1,opts:[['none','Aucun'],['air','Air/air'],['water','Air/eau']],dis:S=>S.aspiration==='na'&&'Sans objet en atmosphérique'},
  ]},
  {t:'Lubrification',note:()=>{const E=M.E;return `Contenance prévue : ${nf(E.oilCap,1)} l · dans le carter : ${nf(E.oilCap*E.oilQ,1)} l (${nf(E.oilCap*E.oilQ*.86,1)} kg) · viscosité mini conseillée à chaud : ${nf(E.oilReq,1)} cSt, cette huile en fait ${nf(E.oil.h,1)}.`;},items:[
   {k:'oilGrade',type:'seg',l:'Viscosité de l\'huile',wide:1,opts:o(OIL),hint:'Premier chiffre : fluidité à froid (plus bas = protège plus vite au démarrage). Second : épaisseur à chaud (plus haut = film plus résistant, mais plus de frottements).'},
   {k:'oilFill',type:'range',l:'Quantité d\'huile',min:30,max:160,step:1,wide:1,f:v=>`${nf(M.E?M.E.oilCap*v/100:0,1)} l · ${v} % du niveau prévu`,hint:'Trop peu : la pompe déjauge et l\'huile surchauffe. Trop : le vilebrequin barbote et fait mousser l\'huile.'},
  ]},
  {t:'Entretien',note:()=>{const E=M.E;return `Vidange conseillée tous les ${nf(E.oilRec)} km pour ce moteur et cette huile · durée de vie estimée ${nf(E.life)} km · entretien ${nf(Math.round(E.mYear/10)*10)} € par an.`;},items:[
   {k:'oilInt',type:'range',l:'Intervalle entre deux vidanges',min:2500,max:40000,step:500,u:'km',wide:1,hint:"Espacer les vidanges économise un peu, mais l'huile usée encrasse le moteur : la durée de vie chute vite au-delà de l'intervalle conseillé. Les rapprocher la prolonge légèrement."},
   {k:'kmYear',type:'range',l:'Kilométrage annuel',min:3000,max:60000,step:1000,u:'km',wide:1,hint:"Sert à calculer le coût d'entretien par an et la durée de vie en années."},
  ]},
  {t:'Échappement',items:[
   {k:'manifold',type:'seg',l:'Collecteur',opts:o(EXH.man)},
   {k:'cat',type:'seg',l:'Catalyseur',opts:o(EXH.cat)},
   {k:'muffler',type:'seg',l:'Silencieux',wide:1,opts:o(EXH.muf)},
  ]},
 ],
 carrosserie:[
  {t:'Silhouette',items:[{k:'body',type:'bodies'}]},
  {t:'Style',note:()=>{const st=STYLE[S.style];let t=`${st.n} (apparu en ${st.y}) : ${st.d}`;if(typeof G!=='undefined'&&G){const f=styleF(S.style,G.y);t+=f>=1.08?` En ${G.y}, c'est la dernière mode : les clients adorent.`:f>=1?` En ${G.y}, ce style reste dans l'air du temps.`:` En ${G.y}, ce style fait vieillot : les ventes en souffrent.`;}return t;},items:[
   {k:'style',type:'seg',l:'Style de carrosserie',wide:1,opts:o(STYLE),hint:'Chaque époque a sa mode. Un style démodé fait fuir les clients, surtout dans le luxe et le sport. Il change aussi la traînée.'},
  ]},
  {t:'Équipements de carrosserie',items:[
   {k:'bumper',type:'seg',l:'Pare-chocs',wide:1,opts:o(BUMPER),hint:'Les pare-chocs à absorption puis les boucliers protègent mieux les occupants et les piétons. Le chrome massif pèse lourd mais impressionne.'},
   {k:'lights',type:'seg',l:'Phares',wide:1,opts:o(LIGHTS),hint:'Mieux on voit la nuit, plus la voiture est sûre. Les phares escamotables affinent le nez des sportives.'},
   {k:'mirrors',type:'seg',l:'Rétroviseurs',wide:1,opts:o(MIRROR),hint:'Sans rétroviseur extérieur, le conducteur ne voit pas ce qui arrive : la sécurité en pâtit.'},
  ]},
  {t:'Implantation du moteur',note:()=>{const f=M.C.fit;return f.ok?`Moteur ${nf(f.len)} × ${nf(f.wid)} mm · compartiment ${nf(f.max)} × ${nf(f.maxW)} mm : il rentre.`:`Moteur ${nf(f.len)} × ${nf(f.wid)} mm · compartiment ${nf(f.max)} × ${nf(f.maxW)} mm : il ne rentre pas.`;},items:[
   {k:'enginePos',type:'seg',l:'Position',wide:1,opts:o(POS),dis:(S,v)=>!BODY[S.body].bay[v]&&'Impossible sur cette carrosserie'},
  ]},
  {t:'Structure',items:[
   {k:'chassis',type:'seg',l:'Châssis',wide:1,opts:o(CHAS)},
   {k:'panels',type:'seg',l:'Panneaux de carrosserie',wide:1,opts:o(PANEL)},
  ]},
  {t:'Peinture',items:[{k:'paint',type:'paint'}]},
  {t:'Aérodynamique',items:[
   {k:'wing',type:'seg',l:'Aileron arrière',wide:1,opts:[['none','Aucun'],['lip','Becquet'],['wing','Aileron']],hint:"L'appui colle la voiture en courbe rapide, au prix de la traînée."},
   {k:'splitter',type:'toggle',l:'Lame avant'},
   {k:'flatFloor',type:'toggle',l:'Fond plat et diffuseur'},
  ]},
 ],
 transmission:[
  {t:'Boîte de vitesses',note:()=>{const g=GEARSETS[S.gearSet];return g?(g.r?`${g.n.split(' · ')[0]} : ${nf(g.cap)} Nm admissibles, rapports ${g.r.map(x=>nf(x,2)).join(' · ')}. Bouger un curseur de rapport repasse en étagement libre.`:`${g.n.split(' · ')[0]} : rapport variable de ${nf(g.first,2)} à ${nf(g.top,2)}.`):'Étagement libre : réglez le nombre de rapports, la première et le dernier rapport.';},items:[
   {k:'gearSet',type:'gearsel'},
   {k:'gearbox',type:'seg',l:'Type',wide:1,opts:o(GBX),on:()=>{const g=GEARSETS[S.gearSet];if(g&&g.type!==S.gearbox) S.gearSet='';},hint:'Convertisseur : douceur. Robotisée : une manuelle pilotée, lente au passage. Double embrayage : passages sans rupture. CVT : pas de rapports, le moteur reste au régime idéal.'},
   {k:'gears',type:'range',l:'Nombre de rapports',min:4,max:10,step:1,on:()=>{S.gearSet='';},dis:S=>S.gearbox==='cvt'},
   {k:'final',type:'range',l:'Rapport de pont',min:2.4,max:5.6,step:.05,d:2,hint:'Court : accélérations vives. Long : vitesse de pointe et régime de croisière bas.'},
   {k:'first',type:'range',l:'Première',min:2.4,max:5.5,step:.01,d:2,on:()=>{S.gearSet='';}},
   {k:'top',type:'range',l:'Dernier rapport',min:.35,max:1.15,step:.01,d:2,on:()=>{S.gearSet='';}},
  ]},
  {t:'Conception de la boîte',note:()=>{if(GEARSETS[S.gearSet]) return `Boîte de série : ${nf(GEARSETS[S.gearSet].cap)} Nm admissibles. Passez en étagement libre pour la concevoir vous-même.`;const g=M.C.gsp;return `Pignons : ${nf(g.gearCap)} Nm${isFinite(g.clutchCap)?` · embrayage : ${nf(g.clutchCap)} Nm`:''} · le moteur donne ${nf(M.E.peakT)} Nm (${nf(M.E.peakT/g.cap*100)} % de la limite) · ${g.m>=0?'+':'−'}${nf(Math.abs(g.m),1)} kg · ${nf(g.cost,-1)} € de pièces.`;},items:[
   {k:'gMat',type:'seg',l:'Acier des pignons',wide:1,opts:o(GMAT),dis:S=>!!GEARSETS[S.gearSet]&&'Fixé par la boîte choisie',hint:'Cémenté : surface durcie, cœur souple. Nitruré : encore plus dur en surface. Acier aéronautique : le plus résistant, et très cher.'},
   {k:'gWidth',type:'range',l:'Largeur de denture',min:0,max:100,step:1,wide:1,f:v=>(v<30?'Étroite':v<65?'Moyenne':'Large')+' · '+v,dis:S=>!!GEARSETS[S.gearSet],hint:'Des dents plus larges encaissent plus de couple, mais la boîte devient plus lourde et plus chère.'},
   {k:'gTeeth',type:'seg',l:'Taille des dents',opts:o(GTEETH),dis:S=>!!GEARSETS[S.gearSet]&&'Fixé par la boîte choisie',hint:'Droite : plus solide et meilleur rendement, mais elle siffle. Hélicoïdale : silencieuse.'},
   {k:'gSync',type:'seg',l:'Synchroniseurs',wide:1,opts:o(GSYNC),dis:(S,v)=>(!!GEARSETS[S.gearSet]&&'Fixé par la boîte choisie')||(!usesSync(S.gearbox)&&'Sans objet sur ce type de boîte'),hint:'Sans synchros, il faut faire un double débrayage : passages lents et pénibles. Les synchros multicônes ou en carbone accélèrent les passages.'},
   {k:'clutch',type:'seg',l:'Embrayage',wide:1,opts:o(CLUTCH),dis:(S,v)=>(!!GEARSETS[S.gearSet]&&'Fixé par la boîte choisie')||(!usesClutch(S.gearbox)&&'Pas d\'embrayage : convertisseur ou courroie'),hint:'Bidisque : deux fois plus de surface. Céramétallique : tient le couple mais attaque brutalement. Carbone : léger et très solide, réservé à la course.'},
   {k:'gCool',type:'toggle',l:'Radiateur d\'huile de boîte',dis:S=>!!GEARSETS[S.gearSet],hint:'Garde l\'huile de boîte au frais : +10 % de couple admissible.'},
  ]},
  {t:'Transmission aux roues',items:[
   {k:'drive',type:'seg',l:'Roues motrices',wide:1,opts:Object.entries(DRV),dis:(S,v)=>!POS[S.enginePos].drv.includes(v)&&`Incompatible avec un moteur ${POS[S.enginePos].n.replace(/^./,c=>c.toLocaleLowerCase())}`},
   {k:'diff',type:'seg',l:'Différentiel',wide:1,opts:[['open','Ouvert'],['lsd','Autobloquant'],['active','Piloté']]},
  ]},
 ],
 trains:[
  {t:'Suspension',items:[
   {k:'suspF',type:'seg',l:'Train avant',wide:1,opts:['leaf','rigid','mac','dw','multi','push','hydro','air','magneto'].map(k=>[k,SUSP[k].n]),hint:'Lames : simples et robustes, peu confortables. Hydropneumatique : un tapis volant. Magnétique : l\'amortissement change en quelques millisecondes.'},
   {k:'suspR',type:'seg',l:'Train arrière',wide:1,opts:['leaf','rigid','dedion','torsion','semi','mac','dw','multi','push','hydro','air','magneto'].map(k=>[k,SUSP[k].n]),dis:(S,v)=>(v==='torsion'&&S.drive!=='fwd'&&'Réservé aux tractions')||(v==='dedion'&&S.drive==='fwd'&&'Réservé aux propulsions')},
   {k:'stiff',type:'range',l:'Tarage ressorts et amortisseurs',min:0,max:100,step:1,f:v=>(v<30?'Souple':v<55?'Moyen':v<80?'Ferme':'Piste')+' · '+v},
   {k:'gc',type:'range',l:'Garde au sol',min:80,max:300,step:5,u:'mm'},
   {k:'arbF',type:'range',l:'Barre antiroulis avant',min:0,max:100,step:1,hint:"Plus raide à l'avant : plus sous-vireur."},
   {k:'arbR',type:'range',l:'Barre antiroulis arrière',min:0,max:100,step:1,hint:"Plus raide à l'arrière : plus survireur."},
  ]},
  {t:'Roues et pneus',note:()=>`Monte ${M.C.tireStr} · diamètre ${nf(M.C.od)} mm`,items:[
   {k:'rim',type:'range',l:'Diamètre de jante',min:13,max:22,step:1,f:v=>v+' pouces'},
   {k:'tireW',type:'range',l:'Largeur des pneus',min:145,max:345,step:10,u:'mm'},
   {k:'profile',type:'range',l:'Hauteur de flanc',min:25,max:80,step:5,f:v=>'série '+v,hint:'Flanc bas : précision. Flanc haut : confort.'},
   {k:'stagger',type:'range',l:"Surlargeur à l'arrière",min:0,max:60,step:10,f:v=>'+'+v+' mm'},
   {k:'compound',type:'seg',l:'Gomme',wide:1,opts:o(TYRE)},
   {k:'rimType',type:'seg',l:'Jantes',wide:1,opts:[['steel','Tôle'],['alloy','Alliage'],['forged','Forgées']]},
  ]},
  {t:'Freins',note:()=>`Disque maxi ${nf(M.C.discMax)} mm avec des jantes de ${S.rim}"`,items:[
   {k:'brakeF',type:'seg',l:'Freins avant',wide:1,opts:o(BRK)},
   {k:'brakeFd',type:'range',l:'Diamètre avant',min:200,max:420,step:5,u:'mm'},
   {k:'brakeRd',type:'range',l:'Diamètre arrière',min:180,max:400,step:5,u:'mm'},
   {k:'brakeR',type:'seg',l:'Freins arrière',wide:1,opts:o(BRK)},
  ]},
 ],
 habitacle:[
  {t:'Aménagement',items:[
   {k:'seats',type:'seg',l:'Places',opts:[[2,'2'],[4,'4'],[5,'5'],[7,'7']],dis:(S,v)=>!BODY[S.body].seats.includes(v)&&'Impossible sur cette carrosserie'},
   {k:'media',type:'seg',l:'Multimédia',opts:o(MEDIA)},
   {k:'trim',type:'seg',l:'Finition',wide:1,opts:o(TRIM),hint:"Le luxe pèse lourd : jusqu'à 200 kg d'écart entre une finition course et une finition luxe."},
  ]},
  {t:'Sécurité',items:[
   {k:'passive',type:'seg',l:'Sécurité passive',wide:1,opts:o(PASS)},
   {k:'abs',type:'toggle',l:'Antiblocage (ABS)'},
   {k:'tc',type:'toggle',l:'Antipatinage'},
   {k:'esp',type:'toggle',l:'Contrôle de stabilité (ESP)',dis:S=>!S.abs},
  ]},
  {t:'Direction',items:[{k:'steering',type:'seg',l:'Assistance',wide:1,opts:o(STEER)}]},
 ],
};
const ctlUpd=[];
function makeCtl(it){
  const id='c_'+it.k;let wrap;
  if(it.type==='seg'||it.type==='toggle'){const d0=it.dis,tg=it.type==='toggle';it=Object.assign({},it,{dis:(S,v)=>eraDis(it.k,tg?true:v)||(d0?d0(S,v):false)});}
  if(it.type==='range'){
    wrap=el('div','f'+(it.wide?' wide':''),`<div class="f-top"><label for="${id}">${it.l}</label><output for="${id}"></output></div><input type="range" id="${id}" min="${it.min}" max="${it.max}" step="${it.step}">${it.hint?`<p class="hint">${it.hint}</p>`:''}`);
    const inp=$('input',wrap),out=$('output',wrap),lab=$('label',wrap);if(it.lf) ctlUpd.push(()=>{lab.textContent=it.lf();});
    inp.addEventListener('input',()=>{S[it.k]=+inp.value;if(it.on) it.on();render();});
    const capP=el('p','era-cap');capP.hidden=true;wrap.appendChild(capP);
    const fmt=v=>it.f?it.f(v):nf(v,it.d||0)+(it.u?' '+it.u:'');
    ctlUpd.push(()=>{const r=eraRange(it.k),mn=r&&r.min!=null?Math.max(it.min,r.min):it.min,mx=r&&r.max!=null?Math.min(it.max,r.max):it.max;inp.min=mn;inp.max=mx;
      const parts=[];if(r&&mx<it.max) parts.push('au plus '+fmt(mx));if(r&&mn>it.min) parts.push('au moins '+fmt(mn));capP.hidden=!parts.length;capP.textContent=parts.length?`Limite technique en ${ERA.y} : ${parts.join(' · ')}`:'';
      inp.value=S[it.k];out.textContent=it.f?it.f(S[it.k]):nf(S[it.k],it.d||0)+(it.u?' '+it.u:'');const d=!!(it.dis&&it.dis(S));inp.disabled=d;wrap.classList.toggle('is-off',d);inp.style.setProperty('--p',clamp((S[it.k]-mn)/Math.max(1e-9,mx-mn)*100,0,100).toFixed(1)+'%');});
  }else if(it.type==='seg'){
    wrap=el('fieldset','f'+(it.wide?' wide':''),`<legend>${it.l}</legend><div class="seg" role="radiogroup" aria-label="${it.l}"></div>${it.hint?`<p class="hint">${it.hint}</p>`:''}`);
    const seg=$('.seg',wrap),btns=it.opts.map(([v,lab,title])=>{const b=el('button','',lab);b.type='button';b.setAttribute('role','radio');b.id=id+'_'+v;if(title) b.title=title;b.addEventListener('click',()=>{S[it.k]=v;if(it.on) it.on();render();});seg.appendChild(b);return [v,b,title||''];});
    ctlUpd.push(()=>{for(const [v,b,title] of btns){b.setAttribute('aria-checked',S[it.k]===v?'true':'false');const d=it.dis&&it.dis(S,v);b.disabled=!!d;b.title=typeof d==='string'?d:title;}});
  }else if(it.type==='toggle'){
    wrap=el('div','f',`<label class="f-tog"><input type="checkbox" id="${id}"><span class="sw"></span><span>${it.l}</span></label>${it.hint?`<p class="hint">${it.hint}</p>`:''}`);
    const inp=$('input',wrap);
    inp.addEventListener('change',()=>{S[it.k]=inp.checked;render();});
    ctlUpd.push(()=>{inp.checked=!!S[it.k];const r=it.dis&&it.dis(S),d=!!r;inp.disabled=d;wrap.classList.toggle('is-off',d);wrap.title=typeof r==='string'?r:'';});
  }else if(it.type==='gearsel'){
    const grp=[['auto','Automatiques à convertisseur'],['dct','Double embrayage'],['amt','Robotisées simple embrayage'],['cvt','Variation continue']];
    wrap=el('div','f wide',`<label for="${id}">Boîtes automatiques réelles</label><select id="${id}" class="sel"><option value="">Étagement libre</option>${grp.map(([t,n])=>`<optgroup label="${n}">${Object.entries(GEARSETS).filter(([,g])=>g.type===t).map(([k,g])=>`<option value="${k}">${g.n}</option>`).join('')}</optgroup>`).join('')}</select><p class="hint">Rapports relevés sur les boîtes de série, valeurs approchées. Le rapport de pont reste à régler selon le moteur.</p>`);
    const sel=$('select',wrap);
    sel.addEventListener('change',()=>{S.gearSet=sel.value;const g=GEARSETS[sel.value];if(g){S.gearbox=g.type;S.gbxCap=g.cap;if(g.r){S.gears=g.r.length;S.first=g.r[0];S.top=g.r[g.r.length-1];}else{S.first=g.first;S.top=g.top;}}render();});
    ctlUpd.push(()=>{sel.value=S.gearSet||'';for(const op of sel.options){if(!op.value) continue;const g=GEARSETS[op.value];op.disabled=!!ERA&&(GEAR_Y[op.value]>ERA.y||!!eraDis('gearbox',g.type));}});
  }else if(it.type==='engsel'){
    wrap=el('div','f wide',`<label for="${id}">Charger un moteur connu</label><select id="${id}" class="sel"><option value="">Choisir un moteur…</option>${ENGINES.map((g,gi)=>`<optgroup label="${g[0]}">${g[1].map((e,ei)=>`<option value="${gi}.${ei}">${e[0]}</option>`).join('')}</optgroup>`).join('')}</select>`);
    const sel=$('select',wrap);sel.value=ui.engSel;
    if(ERA){let n=0;for(const op of sel.options){if(!op.value) continue;const [gi,ei]=op.value.split('.').map(Number);const ok=eraOK(Object.assign({},ENG_BASE,ENGINES[gi][1][ei][1]));op.disabled=!ok;if(ok) n++;}$('label',wrap).textContent=`Charger un moteur connu (${n} accessible${n>1?'s':''} en ${ERA.y})`;}
    sel.addEventListener('change',()=>{ui.engSel=sel.value;if(!sel.value) return;const [gi,ei]=sel.value.split('.').map(Number);Object.assign(S,ENG_BASE,ENGINES[gi][1][ei][1],{injSize:0,ecuIdle:0,ecuAdv:0,flex:false,fuelPress:3,oilInt:0});ui.broken=null;ui.dmg={};ui.sweep=null;ui.rpm=0;ui.load=0;render();});
  }else if(it.type==='bodies'){
    wrap=el('div','f wide','<div class="bodies" role="radiogroup" aria-label="Type de carrosserie"></div>');
    const host=$('.bodies',wrap),btns=Object.entries(BODY).map(([k,B])=>{const b=el('button','body-card',`${miniCar(k)}<b>${B.n}</b><span>${B.d}</span>`);b.type='button';b.id=id+'_'+k;b.setAttribute('role','radio');
      b.addEventListener('click',()=>{S.body=k;S.gc=B.gc0;while(S.rim*25.4+2*S.tireW*S.profile/100>B.tireMax&&S.profile>25) S.profile-=5;while(S.rim*25.4+2*S.tireW*S.profile/100<B.tireMax-150&&S.profile<80) S.profile+=5;render();});host.appendChild(b);return [k,b];});
    ctlUpd.push(()=>{for(const [k,b] of btns){b.setAttribute('aria-checked',S.body===k?'true':'false');const d=eraDis('body',k);b.disabled=!!d;b.title=d||'';}});
  }else{
    wrap=el('div','f wide','<div class="swatches" role="radiogroup" aria-label="Teinte de carrosserie"></div>');
    const host=$('.swatches',wrap),btns=PAINTS.map(([c,n],i)=>{const b=el('button');b.type='button';b.id=id+'_'+i;b.style.background=c;b.title=n;b.setAttribute('aria-label',n);b.setAttribute('role','radio');b.addEventListener('click',()=>{S.paint=c;render();});host.appendChild(b);return [c,b];});
    const ci=el('input');ci.type='color';ci.id=id+'_custom';ci.setAttribute('aria-label','Teinte personnalisée');ci.addEventListener('input',()=>{S.paint=ci.value;render();});host.appendChild(ci);
    ctlUpd.push(()=>{for(const [c,b] of btns) b.setAttribute('aria-checked',S.paint===c?'true':'false');ci.value=S.paint;});
  }
  return wrap;
}
function buildControls(){
  const host=$('#controls');host.innerHTML='';ctlUpd.length=0;
  for(const g of (UI[ui.tab]||[])){
    const sec=el('section','grp',`<h3>${g.t}</h3>${g.note?'<p class="grp-note"></p>':''}<div class="grp-grid"></div>`),grid=$('.grp-grid',sec);
    for(const it of g.items) grid.appendChild(makeCtl(it));
    if(g.note){const nn=$('.grp-note',sec);ctlUpd.push(()=>{nn.textContent=g.note();});}
    host.appendChild(sec);
  }
}
