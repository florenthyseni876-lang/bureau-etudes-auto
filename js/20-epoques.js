'use strict';
/* ───────────── Époques et technologies (mode carrière) ─────────────
   Chaque technologie a une année d'invention : impossible de la rechercher avant.
   Ce que débloque une technologie est verrouillé dans le bureau d'études tant qu'elle n'est pas acquise.
   Les curseurs (rupteur, compression, pression de turbo, rapports, pneus) sont plafonnés par l'année. */

// interpolation linéaire dans une table [[année, valeur], …]
function itp(t,y){if(y<=t[0][0]) return t[0][1];for(let i=1;i<t.length;i++) if(y<=t[i][0]){const [a,va]=t[i-1],[b,vb]=t[i];return va+(vb-va)*(y-a)/(b-a);}return t[t.length-1][1];}

const DOMS=[['prod','Production'],['mot','Moteur'],['ali','Alimentation et échappement'],['sur','Suralimentation'],['car','Carrosserie et châssis'],['tra','Transmission'],['sec','Sécurité et confort']];

// [id, domaine, nom, année, déblocages [[clé, valeur]…], coût relatif, description]
const TECHS=[
 ['p_chaine','prod','Chaîne de montage',1913,[],1.5,'Le travail à la chaîne divise le temps d\'assemblage : coût de fabrication −33 %.'],
 ['p_presses','prod','Caisses embouties en série',1922,[],1.2,'Grandes presses et tôles d\'acier embouties : coût de fabrication −15 %.'],
 ['p_soufflerie','prod','Essais en soufflerie',1935,[],.8,'Les formes sont mises au point en soufflerie : traînée −6 % sur les nouveaux modèles.'],
 ['p_cao','prod','Conception assistée par ordinateur',1982,[],1.2,'Calcul et dessin sur ordinateur : développement d\'un modèle −30 %.'],
 ['p_robots','prod','Robots de soudure et de peinture',1978,[],1.5,'Usines robotisées : coût de fabrication −15 %, qualité plus régulière.'],
 ['p_lean','prod','Production à flux tendu',1988,[],1,'Moins de stocks, moins de défauts : coût de fabrication −10 %.'],
 ['p_plateforme','prod','Plateformes modulaires',2000,[],1.5,'Plusieurs modèles partagent la même base : coût −10 % et développement −20 %.'],

 ['m_i6','mot','Six cylindres en ligne',1903,[['config','I6']],1,'Plus doux et plus puissant que le quatre cylindres.'],
 ['m_v8','mot','Moteur en V8',1910,[['config','V8']],1.2,'Huit cylindres compacts : couple et rondeur.'],
 ['m_v12','mot','Moteur en V12',1915,[['config','V12']],1.5,'Le moteur des voitures de prestige.'],
 ['m_sohc','mot','Arbre à cames en tête',1925,[['valvetrain','sohc']],1,'Supprime tiges et culbuteurs : le moteur tourne plus vite.'],
 ['m_culasse','mot','Culasse en aluminium',1930,[['headMat','alu']],.8,'Évacue mieux la chaleur : compression plus haute possible.'],
 ['m_forge','mot','Vilebrequin et bielles forgés',1935,[['internals','forged']],1,'Encaisse plus de couple et de régime.'],
 ['m_sodium','mot','Soupapes refroidies au sodium',1935,[['valveMat','sodium']],.8,'Venues de l\'aviation, elles résistent aux hautes températures.'],
 ['m_boxer','mot','Quatre cylindres à plat',1936,[['config','F4']],1,'Bas et compact, idéal en porte-à-faux arrière.'],
 ['m_v6','mot','Moteur en V6',1950,[['config','V6']],1,'Six cylindres courts, faciles à loger.'],
 ['m_cartersec','mot','Carter sec',1955,[['sump','dry']],1,'Réservoir d\'huile séparé : moteur plus bas, pas de déjaugeage en virage.'],
 ['m_itb','mot','Papillons individuels',1960,[['intake','itb']],1,'Un papillon par cylindre : réponse immédiate.'],
 ['m_f6','mot','Six cylindres à plat',1960,[['config','F6']],1.1,'Le six cylindres boxer des sportives à moteur arrière.'],
 ['m_blocalu','mot','Bloc-cylindres en aluminium',1961,[['blockMat','alu']],1.2,'Moteur nettement plus léger.'],
 ['m_courroie','mot','Courroie de distribution',1962,[['timing','belt']],.8,'Légère et silencieuse, mais à remplacer régulièrement.'],
 ['m_dohc','mot','Double arbre, 4 soupapes par cylindre',1965,[['valvetrain','dohc4']],1.4,'Le moteur respire beaucoup mieux à haut régime.'],
 ['m_wankel','mot','Moteur rotatif Wankel',1967,[['config','R2']],1.6,'Un rotor triangulaire à la place des pistons : compact et doux.'],
 ['m_nikasil','mot','Cylindres Nikasil',1970,[['liner','nikasil']],1,'Revêtement dur sans chemise : moins de frottements.'],
 ['m_alusil','mot','Cylindres Alusil',1971,[['liner','alusil']],1,'Alliage hypereutectique, cylindres usinés dans l\'aluminium.'],
 ['m_5cyl','mot','Cinq cylindres en ligne',1974,[['config','I5']],1,'Un compromis entre quatre et six cylindres.'],
 ['m_3cyl','mot','Trois cylindres',1977,[['config','I3']],.8,'Petit, léger et économique.'],
 ['m_hyd','mot','Poussoirs hydrauliques',1935,[['camF','hyd']],.7,'Rattrapent le jeu tout seuls : silencieux, sans réglage.'],
 ['m_roller','mot','Poussoirs à rouleaux',1987,[['camF','roller']],.8,'Moins de frottements sur les cames.'],
 ['m_finger','mot','Linguets à rouleaux',1996,[['camF','finger']],.9,'Légers et précis : le moteur prend plus de tours.'],
 ['m_vvt','mot','Calage variable des arbres à cames',1980,[['vvt',true]],1.2,'Du couple en bas sans sacrifier le haut.'],
 ['m_cda','mot','Désactivation de cylindres',1981,[['cda',true]],1,'Coupe des cylindres à faible charge.'],
 ['m_vario','mot','Admission à longueur variable',1985,[['intake','vario']],1,'Deux longueurs de conduits selon le régime.'],
 ['m_vvl','mot','Levée variable des soupapes',1989,[['vvl',true]],1.3,'Deux profils de cames : souple en bas, rageur en haut.'],
 ['m_5s','mot','Cinq soupapes par cylindre',1990,[['valvetrain','dohc5']],1,'Encore plus de section de passage.'],
 ['m_titane','mot','Titane pour soupapes et bielles',1990,[['valveMat','ti'],['internals','ti']],1.5,'Pièces mobiles plus légères : le moteur prend plus de tours.'],
 ['m_rotors','mot','Trirotor et quadrirotor',1990,[['config','R3'],['config','R4']],1.3,'Wankel à trois et quatre rotors.'],
 ['m_v10','mot','Moteur en V10',1991,[['config','V10']],1.3,'Le moteur des supercars et de la Formule 1.'],
 ['m_pneu','mot','Rappel pneumatique des soupapes',1992,[['springs','pneu']],2,'Technologie de Formule 1 : plus d\'affolement des soupapes.'],
 ['m_cgi','mot','Fonte vermiculaire',2000,[['blockMat','cgi']],1,'Plus résistante que la fonte grise : pour les diesels modernes.'],
 ['m_w','mot','Moteurs en W',2001,[['config','W8'],['config','W12']],1.4,'Deux V étroits accolés : beaucoup de cylindres dans peu de place.'],
 ['m_mg','mot','Bloc magnésium-aluminium',2004,[['blockMat','mg']],1.3,'Le bloc le plus léger.'],
 ['m_w16','mot','W16',2005,[['config','W16']],2,'Seize cylindres pour l\'hypercar.'],
 ['m_plasma','mot','Cylindres projetés au plasma',2007,[['liner','plasma']],1.2,'Revêtement très fin et très dur.'],

 ['a_comf','ali','Silencieux confort',1950,[['muffler','comf']],.6,'Échappement feutré pour les voitures de luxe.'],
 ['a_octane','ali','Essence à haut indice d\'octane',1950,[['fuel','sp98'],['ecuFuel','sp98']],.8,'Supporte une compression plus forte.'],
 ['a_multigrade','ali','Huiles multigrades',1952,[['oilGrade','10w40']],.6,'Fluide à froid, épaisse à chaud.'],
 ['a_tub','ali','Collecteur d\'échappement tubulaire',1955,[['manifold','tub']],.7,'Tubes accordés : le moteur se vide mieux.'],
 ['a_mufsport','ali','Échappement sport',1960,[['muffler','sport']],.5,'Moins de contre-pression, plus de son.'],
 ['a_course','ali','Collecteur course',1965,[['manifold','race']],.8,'Tubes longs et égaux, pour la compétition.'],
 ['a_diesel','ali','Moteur Diesel automobile',1936,[['fuel','diesel'],['fuelSys','idi']],1.5,'Allumage par compression : sobre et coupleux.'],
 ['a_mpi','ali','Injection d\'essence multipoint',1967,[['fuelSys','mpi']],1.4,'Un injecteur par cylindre : dosage précis, plus de puissance.'],
 ['a_cat','ali','Pot catalytique 3 voies',1975,[['cat','tri']],1,'Indispensable pour les futures normes antipollution.'],
 ['a_mono','ali','Injection monopoint',1980,[['fuelSys','mono']],.8,'Un seul injecteur : une injection bon marché.'],
 ['a_synth','ali','Huiles de synthèse',1985,[['oilGrade','5w30'],['oilGrade','5w40'],['oilGrade','10w60']],.8,'Film d\'huile plus résistant et vidanges espacées.'],
 ['a_elec','ali','Calculateur électronique',1987,[['ecuVmax',true],['pops',true]],1,'Gestion du moteur programmable.'],
 ['a_catsport','ali','Catalyseur haut débit',1990,[['cat','sport']],.6,'Moins de contre-pression.'],
 ['a_di','ali','Injection directe d\'essence',1996,[['fuelSys','di']],1.4,'L\'essence est injectée dans la chambre : rendement en hausse.'],
 ['a_cr','ali','Diesel à rampe commune',1997,[['fuelSys','cr']],1.4,'Injection à très haute pression pilotée électroniquement.'],
 ['a_pd','ali','Diesel injecteur-pompe',1998,[['fuelSys','pd']],1,'Une pompe par injecteur, pression énorme.'],
 ['a_launch','ali','Départ automatisé',2000,[['launchCtl',true]],.6,'Le calculateur gère le démarrage.'],
 ['a_flex','ali','Flex-fuel E85',2003,[['fuel','e85'],['ecuFuel','e85'],['flex',true]],.8,'Le moteur accepte l\'éthanol.'],
 ['a_dual','ali','Injection mixte directe + indirecte',2005,[['fuelSys','dual']],1,'Le meilleur des deux injections.'],
 ['a_clapets','ali','Échappement actif à clapets',2005,[['muffler','valve']],.6,'Discret en ville, sonore à fond.'],
 ['a_0w20','ali','Huile 0W-20 basse friction',2005,[['oilGrade','0w20']],.5,'Moins de frottements, moins de consommation.'],
 ['a_ss','ali','Stop & start',2006,[['startStop',true]],.6,'Coupe le moteur à l\'arrêt.'],
 ['a_gpf','ali','Filtre à particules',2000,[['cat','gpf']],.9,'Piège les suies : indispensable aux diesels à partir de la norme Euro 5, puis aux injections directes essence.'],

 ['s_roots','sur','Compresseur Roots',1921,[['aspiration','sc'],['scType','roots']],1.3,'Entraîné par le moteur, il souffle dès le ralenti.'],
 ['s_centri','sur','Compresseur centrifuge',1929,[['scType','centri']],1,'Sa pression monte avec le régime.'],
 ['s_turbo','sur','Turbocompresseur',1962,[['aspiration','turbo']],1.6,'Récupère l\'énergie des gaz d\'échappement.'],
 ['s_ic','sur','Refroidisseur d\'air air/air',1977,[['intercooler','air']],.8,'Refroidit l\'air comprimé : plus de puissance, moins de cliquetis.'],
 ['s_bi','sur','Biturbo',1981,[['aspiration','biturbo']],1.2,'Deux petits turbos qui répondent plus vite.'],
 ['s_vis','sur','Compresseur à double vis',1985,[['scType','screw']],1,'Plus efficace que le Roots.'],
 ['s_seq','sur','Turbos séquentiels',1986,[['turboStage','seq']],1.2,'Un petit turbo en bas, le gros le rejoint ensuite.'],
 ['s_vgt','sur','Turbo à géométrie variable',1989,[['turboType','vgt']],1.3,'Des ailettes mobiles adaptent la turbine au régime.'],
 ['s_icw','sur','Refroidisseur air/eau',1990,[['intercooler','water']],.8,'Circuit d\'eau dédié, plus compact.'],
 ['s_ts','sur','Turbo twin-scroll',1990,[['turboType','ts']],1,'Sépare les bouffées des cylindres.'],
 ['s_billes','sur','Turbo sur roulements à billes',1990,[['turboBearing','ball']],.8,'Moins de frottements, réponse plus vive.'],
 ['s_quad','sur','Quatre turbos',1991,[['aspiration','quad']],1.5,'Quatre petits turbos pour une supercar.'],
 ['s_serie','sur','Turbos étagés en série',2004,[['turboStage','comp']],1.2,'Un petit turbo haute pression souffle dans un gros.'],
 ['s_tri','sur','Trois turbos',2012,[['aspiration','tri']],1.3,'Pour les diesels les plus puissants.'],
 ['s_elec','sur','Turbo électrique',2016,[['turboType','et']],1.5,'Un moteur électrique lance la turbine.'],

 ['c_coupe','car','Carrosserie coupé',1910,[['body','coupe']],.7,'Deux portes, toit fermé.'],
 ['c_pickup','car','Pick-up',1925,[['body','pickup']],.7,'Un plateau pour les artisans et les fermiers.'],
 ['c_mono','car','Caisse autoporteuse',1934,[['chassis','steel']],1.4,'La carrosserie devient la structure : plus léger, plus rigide.'],
 ['c_traction','car','Traction avant',1934,[['drive','fwd']],1.2,'Plancher plat et tenue de route sûre.'],
 ['c_arriere','car','Moteur en porte-à-faux arrière',1934,[['enginePos','RR']],1,'Le moteur derrière les roues arrière.'],
 ['c_ifs','car','Roues avant indépendantes',1934,[['suspF','dw'],['suspR','dw']],1.2,'Double triangulation : confort et précision.'],
 ['c_break','car','Break',1935,[['body','break']],.6,'Un grand coffre pour les familles.'],
 ['c_lsd','car','Différentiel autobloquant',1935,[['diff','lsd']],.8,'Limite le patinage d\'une roue.'],
 ['c_4x4','car','Transmission intégrale',1941,[['drive','awd']],1.2,'Les quatre roues motrices.'],
 ['c_atpneu','car','Pneus tout-terrain',1945,[['compound','at']],.5,'Crampons pour les chemins.'],
 ['c_alu','car','Panneaux en aluminium',1950,[['panels','alu']],.8,'Carrosserie plus légère.'],
 ['c_semi','car','Bras semi-tirés',1951,[['suspR','semi']],.7,'Roues arrière indépendantes simples.'],
 ['c_hydro','car','Suspension hydropneumatique',1955,[['suspF','hydro'],['suspR','hydro']],1.4,'Sphères d\'azote et liquide : confort exceptionnel et hauteur constante.'],
 ['c_mac','car','Suspension MacPherson',1951,[['suspF','mac'],['suspR','mac']],.9,'Simple, compacte et bon marché.'],
 ['c_tube','car','Châssis treillis tubulaire',1952,[['chassis','tube']],1,'Léger et rigide, pour les sportives.'],
 ['c_composite','car','Carrosserie composite',1953,[['panels','grp']],.8,'Fibre de verre et résine.'],
 ['c_disque','car','Freins à disque',1955,[['brakeF','disc'],['brakeR','disc']],1.2,'Ils résistent bien mieux à l\'échauffement.'],
 ['c_citadine','car','Citadine',1957,[['body','citadine']],.8,'Une petite voiture pour la ville.'],
 ['c_transversal','car','Moteur avant transversal',1959,[['enginePos','FT']],1,'Le moteur en travers libère de la place.'],
 ['c_alliage','car','Jantes en alliage',1960,[['rimType','alloy']],.6,'Moins de masse non suspendue.'],
 ['c_pneusport','car','Pneus sport',1965,[['compound','sport']],.7,'Plus d\'adhérence.'],
 ['c_ventile','car','Disques ventilés',1966,[['brakeF','vent'],['brakeR','vent']],.8,'Mieux refroidis : moins d\'échauffement.'],
 ['c_supercar','car','Supercar à moteur central',1966,[['body','supercar'],['enginePos','MR']],1.5,'Le moteur entre les essieux.'],
 ['c_becquet','car','Becquet',1970,[['wing','lip']],.5,'Réduit la portance à haute vitesse.'],
 ['c_aileron','car','Aileron et lame avant',1972,[['wing','wing'],['splitter',true]],.8,'Appui aérodynamique.'],
 ['c_compacte','car','Compacte à hayon',1974,[['body','compacte']],.8,'Polyvalente : la voiture à tout faire.'],
 ['c_torsion','car','Essieu de torsion',1974,[['suspR','torsion']],.6,'Train arrière simple pour les tractions.'],
 ['c_multi','car','Suspension multibras',1982,[['suspF','multi'],['suspR','multi']],1.1,'Guide précisément la roue.'],
 ['c_suv','car','SUV',1984,[['body','suv']],1,'Garde au sol haute, allure de tout-terrain.'],
 ['c_jforge','car','Jantes forgées',1985,[['rimType','forged']],.6,'Les plus légères.'],
 ['c_semi','car','Pneus semi-slicks',1985,[['compound','semi']],.6,'Presque des pneus de course.'],
 ['c_diffpil','car','Différentiel piloté',1987,[['diff','active']],1,'Répartit le couple entre les roues.'],
 ['c_monoalu','car','Monocoque aluminium',1990,[['chassis','alu']],1.4,'Caisse bien plus légère.'],
 ['c_air','car','Suspension pneumatique pilotée',1990,[['suspF','air'],['suspR','air']],1.2,'Coussins d\'air réglables : confort et hauteur variable.'],
 ['c_poussoirs','car','Suspension à poussoirs',1990,[['suspF','push'],['suspR','push']],1,'Combinés inboard, comme en course.'],
 ['c_fondplat','car','Fond plat et diffuseur',1990,[['flatFloor',true]],.8,'L\'appui vient du dessous.'],
 ['c_pneueco','car','Pneus basse résistance',1992,[['compound','eco']],.6,'Consommation réduite.'],
 ['c_carbone','car','Fibre de carbone',1992,[['chassis','carbon'],['panels','carbon']],2,'Structure ultralégère.'],
 ['c_magneto','car','Amortisseurs magnétiques',2002,[['suspF','magneto'],['suspR','magneto']],1.2,'Un fluide chargé de particules de fer change de viscosité à la demande.'],
 ['c_ccm','car','Freins carbone-céramique',2001,[['brakeF','ccm'],['brakeR','ccm']],1.2,'Inusables et légers.'],

 ['t_synchro','tra','Boîte synchronisée',1929,[['gSync','brass']],1,'Plus besoin de double débrayage : les passages deviennent faciles.'],
 ['t_cemente','tra','Pignons cémentés',1930,[['gMat','case']],.8,'Surface des dents durcie : la boîte tient beaucoup plus de couple.'],
 ['t_helico','tra','Pignons hélicoïdaux',1932,[['gTeeth','helical']],.7,'Des dents inclinées : la boîte ne siffle plus.'],
 ['t_bidisque','tra','Embrayage bidisque',1950,[['clutch','twin']],.8,'Deux disques : l\'embrayage tient presque deux fois plus de couple.'],
 ['t_nitrure','tra','Pignons nitrurés',1960,[['gMat','nitr']],1,'Traitement de surface encore plus dur.'],
 ['t_gcool','tra','Radiateur d\'huile de boîte',1960,[['gCool',true]],.6,'Refroidit la boîte des voitures puissantes.'],
 ['t_ceram','tra','Embrayage céramétallique',1970,[['clutch','ceram']],.8,'Garnitures frittées qui encaissent la chaleur.'],
 ['t_multicone','tra','Synchroniseurs multicônes',1985,[['gSync','multi']],.8,'Passages plus rapides et plus doux.'],
 ['t_aero','tra','Acier aéronautique pour pignons',1985,[['gMat','aero']],1.3,'Le matériau des boîtes de compétition.'],
 ['t_embcarbone','tra','Embrayage multidisque carbone',1990,[['clutch','carbon']],1.2,'Venu de la Formule 1 : léger et indestructible.'],
 ['t_synccarbone','tra','Synchroniseurs carbone',2000,[['gSync','carbon']],.8,'Les passages manuels les plus rapides.'],
 ['t_auto','tra','Boîte automatique',1940,[['gearbox','auto']],1.3,'Plus besoin d\'embrayer.'],
 ['t_cvt','tra','Variateur continu',1958,[['gearbox','cvt']],1,'Une courroie et deux poulies.'],
 ['t_seq','tra','Boîte séquentielle',1990,[['gearbox','seq']],1,'Venue de la compétition.'],
 ['t_amt','tra','Boîte robotisée',1997,[['gearbox','amt']],1,'Une boîte manuelle pilotée par des vérins.'],
 ['t_dct','tra','Double embrayage',2003,[['gearbox','dct']],1.4,'Passages sans rupture de couple.'],

 ['x_std','sec','Habitacle confortable',1920,[['trim','std']],.6,'Sièges rembourrés, vitres et chauffage.'],
 ['x_radio','sec','Autoradio',1930,[['media','radio']],.6,'La musique à bord.'],
 ['x_dirassist','sec','Direction assistée',1951,[['steering','hyd']],.8,'Manœuvres sans effort.'],
 ['x_prem','sec','Finition haut de gamme',1955,[['trim','prem']],.7,'Matériaux nobles et équipements.'],
 ['x_passive','sec','Ceintures et zones déformables',1959,[['passive','std']],1,'Habitacle rigide, avant et arrière qui absorbent le choc.'],
 ['x_abs','sec','ABS',1978,[['abs',true]],1.2,'Les roues ne se bloquent plus au freinage.'],
 ['x_hifi','sec','Hi-fi embarquée',1985,[['media','hifi']],.5,'Un vrai système audio.'],
 ['x_asr','sec','Antipatinage',1987,[['tc',true]],.8,'Limite le patinage à l\'accélération.'],
 ['x_dirlec','sec','Direction assistée électrique',1993,[['steering','elec']],.8,'Consomme moins que l\'hydraulique.'],
 ['x_airbag','sec','Airbags et crash-tests',1995,[['passive','adv']],1.3,'Coussins gonflables et structure optimisée.'],
 ['x_esp','sec','Contrôle de stabilité (ESP)',1995,[['esp',true]],1.2,'Corrige les dérapages.'],
 ['x_ecran','sec','Écran tactile',2008,[['media','screen']],.6,'Navigation et multimédia.'],
];
const TECH={};for(const t of TECHS) TECH[t[0]]={id:t[0],dom:t[1],n:t[2],y:t[3],u:t[4],k:t[5],d:t[6]};
// verrou : LOCK['clé|valeur'] = technologie qui débloque cette valeur
const LOCK={};for(const t of TECHS) for(const [k,v] of t[4]) LOCK[k+'|'+v]=t[0];

// styles et équipements : se débloquent tout seuls avec l'année
const YEAR_LOCK={};
for(const [k,T] of [['style',STYLE],['bumper',BUMPER],['lights',LIGHTS],['mirrors',MIRROR]]) for(const [v,o] of Object.entries(T)) if(o.y>1900) YEAR_LOCK[k+'|'+v]={n:o.n,y:o.y,yl:1};
// valeur de repli d'époque (toujours disponible) pour chaque clé verrouillable
const ERA_BASE={camF:'mech',style:'hippo',bumper:'none',lights:'acet',mirrors:'none',gMat:'std',gTeeth:'straight',gSync:'none',clutch:'single',gCool:false,config:'I4',valvetrain:'ohv',timing:'chain',fuelSys:'carb',fuel:'sp95',ecuFuel:'sp95',blockMat:'iron',liner:'cast',sump:'wet',valveMat:'steel',springs:'coil',intake:'std',headMat:'iron',internals:'cast',aspiration:'na',turboStage:'par',turboType:'wg',turboBearing:'journal',scType:'roots',intercooler:'none',oilGrade:'20w50',manifold:'cast',cat:'none',muffler:'std',body:'roadster',enginePos:'FL',drive:'rwd',diff:'open',chassis:'ladder',panels:'steel',gearbox:'man',suspF:'leaf',suspR:'leaf',compound:'road',brakeF:'drum',brakeR:'drum',rimType:'steel',trim:'basic',media:'none',passive:'min',steering:'mech',wing:'none',
  vvt:false,vvl:false,cda:false,flex:false,launchCtl:false,pops:false,startStop:false,ecuVmax:false,splitter:false,flatFloor:false,abs:false,tc:false,esp:false};

// repli vers l'option d'époque la plus proche quand une valeur est verrouillée
const ERA_FB={camF:{finger:'roller',roller:'hyd',hyd:'mech'},style:{moderne:'bio',bio:'aero',aero:'tendu',tendu:'ponton',ailerons:'ponton',ponton:'profile',profile:'classique',classique:'hippo'},bumper:{carbone:'bouclier',bouclier:'caout',caout:'chrome',massif:'chrome',chrome:'none'},lights:{laser:'led',led:'xenon',xenon:'halo',halo:'rond',escam:'rond',rond:'elec',elec:'acet'},mirrors:{camera:'elec',elec:'porte',porte:'aile',aile:'none'},gMat:{aero:'nitr',nitr:'case',case:'std'},gSync:{carbon:'multi',multi:'brass',brass:'none'},clutch:{carbon:'twin',ceram:'single',twin:'single'},gTeeth:{helical:'straight'},valvetrain:{dohc5:'dohc4',dohc4:'sohc',sohc:'ohv'},fuelSys:{dual:'di',di:'mpi',mpi:'mono',mono:'carb',cr:'idi',pd:'idi'},blockMat:{mg:'alu',alu:'iron',cgi:'iron'},liner:{plasma:'alusil',alusil:'cast',nikasil:'cast'},
  valveMat:{ti:'sodium',sodium:'steel'},internals:{ti:'forged',forged:'cast'},aspiration:{tri:'biturbo',quad:'biturbo',biturbo:'turbo',turbo:'na',sc:'na'},turboStage:{comp:'seq',seq:'par'},turboType:{et:'vgt',vgt:'wg',ts:'wg'},
  intercooler:{water:'air',air:'none'},oilGrade:{'0w20':'5w30','5w30':'10w40','5w40':'10w40','10w60':'20w50','10w40':'20w50'},manifold:{race:'tub',tub:'cast'},cat:{gpf:'tri',sport:'tri',tri:'none'},muffler:{valve:'sport',sport:'std',comf:'std'},
  body:{suv:'break',break:'berline',compacte:'berline',citadine:'compacte',supercar:'coupe',coupe:'roadster',pickup:'berline'},enginePos:{MR:'FL',RR:'FL',FT:'FL'},drive:{awd:'rwd',fwd:'rwd'},chassis:{carbon:'alu',alu:'steel',steel:'ladder',tube:'ladder'},panels:{carbon:'alu',alu:'steel',grp:'steel'},
  gearbox:{dct:'auto',amt:'man',cvt:'auto',auto:'man',seq:'man'},suspF:{hydro:'dw',air:'dw',magneto:'multi',push:'dw',multi:'dw',mac:'dw',dw:'rigid'},suspR:{semi:'mac',hydro:'dw',air:'multi',magneto:'multi',push:'dw',multi:'mac',mac:'dw',torsion:'mac',dw:'rigid'},compound:{semi:'sport',sport:'road',eco:'road',at:'road'},
  brakeF:{ccm:'vent',vent:'disc',disc:'drum'},brakeR:{ccm:'vent',vent:'disc',disc:'drum'},rimType:{forged:'alloy',alloy:'steel'},trim:{prem:'std',std:'basic'},media:{screen:'hifi',hifi:'radio',radio:'none'},passive:{adv:'std',std:'min'},steering:{elec:'hyd',hyd:'mech'},wing:{wing:'lip',lip:'none'},
  fuel:{e85:'sp98',sp98:'sp95',diesel:'sp95'},ecuFuel:{e85:'sp98',sp98:'sp95'},config:{W16:'W12',W12:'V12',W8:'V8',V10:'V8',R4:'R2',R3:'R2',R2:'I4',F6:'I6',I5:'I4',I3:'I4',V6:'I6',F4:'I4',V12:'V8',V8:'I6',I6:'I4'},scType:{screw:'roots',centri:'roots'},turboBearing:{ball:'journal'},sump:{dry:'wet'},springs:{pneu:'coil'},intake:{vario:'std',itb:'std'},timing:{belt:'chain'},headMat:{alu:'iron'},diff:{active:'lsd',lsd:'open'}};
// plafonds des curseurs selon l'année
const ERA_CAP={
  limiter:{max:[[1900,2000],[1910,2800],[1920,3500],[1930,4200],[1945,4800],[1955,5500],[1965,6500],[1975,7000],[1990,8000],[2000,9000],[2010,9500]],u:'tr/min'},
  cr:{max:[[1900,7.5],[1930,7.5],[1950,8.5],[1965,9.5],[1980,10],[1995,11],[2005,12],[2012,13],[2018,14]],skip:S=>FUEL[S.fuel]&&FUEL[S.fuel].diesel},
  boost:{max:[[1921,.6],[1960,.7],[1975,1],[1985,1.5],[1995,1.8],[2005,2.2],[2015,2.8],[2020,3.5]],u:'bar'},
  boostLow:{max:[[1921,.5],[1985,1],[2005,1.5],[2015,2]],u:'bar'},
  gears:{max:[[1900,4],[1964,4],[1965,5],[1987,5],[1988,6],[2002,6],[2003,7],[2008,8],[2013,9],[2017,10]],step:1},
  tireW:{max:[[1900,155],[1930,165],[1950,175],[1965,195],[1975,225],[1985,255],[1995,295],[2005,345]],u:'mm',step:10},
  profile:{min:[[1900,80],[1960,70],[1970,60],[1980,50],[1990,45],[2000,35],[2010,25]],step:5},
};
// boîtes réelles : année de sortie
const GEAR_Y={gm4l60:1992,zf6hp:2000,aisin6:2003,mb7g:2003,dq250:2003,smart5:1998,zf8hp:2009,pdk7:2008,getrag7:2009,etg6:2009,jatco:2009,mb9g:2013,ford10r:2017};

// état « époque » : null hors carrière
let ERA=null; // {y, has:Set}
function capOf(k,y){const c=ERA_CAP[k];if(!c) return null;const r={};if(c.max){let m=itp(c.max,y);if(c.step) m=Math.floor(m/c.step+1e-6)*c.step;r.max=m;}if(c.min){let m=itp(c.min,y);if(c.step) m=Math.ceil(m/c.step-1e-6)*c.step;r.min=m;}return r;}
function eraRange(k){if(!ERA) return null;const c=ERA_CAP[k];if(!c||(c.skip&&c.skip(S))) return null;return capOf(k,ERA.y);}
function lockOf(k,v){const yl=YEAR_LOCK[k+'|'+v];if(yl) return yl.y>ERA.y?yl:null;const id=LOCK[k+'|'+v];return id&&!ERA.has.has(id)?TECH[id]:null;}
// raison du verrou (chaîne) ou false
function eraDis(k,v){
  if(!ERA) return false;
  if(v===undefined) v=true;
  const t=lockOf(k,v);
  if(t) return t.yl?`Apparaît en ${t.y}`:t.y>ERA.y?`Pas encore inventé : ${t.n} (${t.y})`:`À rechercher : ${t.n}`;
  return false;
}
// un ensemble de valeurs (moteur tout prêt, boîte réelle) est-il accessible ?
function eraOK(obj){
  if(!ERA) return true;
  for(const [k,v] of Object.entries(obj)){
    if(typeof v==='boolean'){if(v&&lockOf(k,true)) return false;continue;}
    if(LOCK[k+'|'+v]&&lockOf(k,v)) return false;
    const c=ERA_CAP[k];if(c&&typeof v==='number'){const r=capOf(k,ERA.y);if((r.max!=null&&v>r.max+1e-9)||(r.min!=null&&v<r.min-1e-9)) return false;}
  }
  return true;
}
// remet le projet en conformité avec l'époque
function eraFix(){
  if(!ERA) return;
  for(const k of Object.keys(ERA_BASE)){
    const v=S[k];
    if(typeof ERA_BASE[k]==='boolean'){if(v&&lockOf(k,true)) S[k]=false;continue;}
    let w=v,n=0;while(lockOf(k,w)&&n++<8) w=(ERA_FB[k]&&ERA_FB[k][w])||ERA_BASE[k];
    if(lockOf(k,w)) w=ERA_BASE[k];
    S[k]=w;
  }
  if(S.fuel==='sp95'&&FS[S.fuelSys]&&FS[S.fuelSys].d) S.fuelSys=lockOf('fuelSys','mpi')?'carb':'mpi';
  if(S.aspiration!=='na'&&S.aspiration!=='sc'&&lockOf('aspiration',S.aspiration)) S.aspiration='na';
  if(S.ecuFuel&&lockOf('ecuFuel',S.ecuFuel)) S.ecuFuel='sp95';
  if(S.gearSet&&GEAR_Y[S.gearSet]>ERA.y) S.gearSet='';
  for(const k of Object.keys(ERA_CAP)){const r=eraRange(k);if(!r) continue;if(r.max!=null&&S[k]>r.max) S[k]=r.max;if(r.min!=null&&S[k]<r.min) S[k]=r.min;}
}
