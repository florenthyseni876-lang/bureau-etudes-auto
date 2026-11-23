'use strict';
/* ───────────── Mode « Mécanicien » — TUNING (ateliers de préparation, modifier sa voiture et celles des clients) ─────────────
   Deux ateliers dans la ville (Rue des Ateliers) : « Prépa Vallon » (tune1, préparateur sport et rallye : banc de puissance, reprogrammation, freins, pneus, suspension)
   et « Atelier Éclat » (tune2, style et carrosserie : cabine de peinture, jantes, kits, covering). On peut s'y faire embaucher (employeurs `prepa` et `style`, js/42), les racheter
   (js/52 : MWI.CAT), et équiper son propre garage (banc de puissance et cabine de peinture) pour y proposer le tuning. Les ancres et dimensions de js/44 (MWCARS) servent
   seules à dessiner les modifications : aucune position de carrosserie en dur, tout est retrouvé par lancer de rayons sur le maillage de la voiture.

   ═══ API `MWTUNE` (aussi `window.__mwt`) ═══
   Catalogue
     MWTUNE.PARTS / MWTUNE.LIST     pièces par identifiant / tableau : {id, slot, cat:'perf'|'style', nom, prix, niv (niveau « préparation » pour la poser soi-même), mo (minutes de pose),
                                    lieu:'sport'|'style'|'both', fx:{pw,tq,dm,grip,brk,turn,acc,vm,df,drag,cl,snd,db,rel,gc,wide,tint…}, req, ice, txt}
     MWTUNE.SLOTS                   emplacements exclusifs (une seule pièce par emplacement)
     MWTUNE.PAINTS, MWTUNE.WRAPS, MWTUNE.WHEELS, MWTUNE.COLORS   finitions de peinture, covering, modèles de jantes, couleurs
   Voitures (carKey = identifiant de la voiture du joueur, MWC.getCar().id)
     MWTUNE.cfg(key)                configuration de tuning de la voiture {p:{emplacement:pièce}, paint, wrap, wheels, h, stiff, neon}
     MWTUNE.spec(modelId)           fiche de base {ch, nm, mass, rpm, asp, drive, ev, gb, inch…} d'un modèle MWCARS
     MWTUNE.stats(modelId,cfg)      {ch, nm, mass, t100, vmax, grip, brake, rel, db, drv:{vm,acc,brk,turn,eng}, legal:[infractions], gc, …} calculées
     MWTUNE.fit(modelId,cfg,partId) {ok, why[]} la pièce est-elle montable (moteur, prérequis, emplacement) ?
     MWTUNE.price(modelId,partId)   prix de la pièce pour cette voiture ; MWTUNE.quoteOf(items,…) devis
     MWTUNE.install(partId,opt)     achète et pose une pièce sur SA voiture (argent, temps, niveau) → {ok,msg} ; MWTUNE.remove(slot) la dépose ; MWTUNE.setStyle(kind,val) peinture, jantes…
     MWTUNE.menu(zoneId)            ouvre le menu de tuning de SA voiture (aperçu 3D en direct) ; MWTUNE.dyno() ouvre le banc de puissance (ch et Nm avant/après)
     MWTUNE.carPanel()              fiche de la voiture du joueur (touche U) : stats, pièces, fiabilité, conformité
   Rendu : MWTUNE.apply(mesh,cfg)   dessine les modifications sur un maillage MW.carMesh(...) (peinture, jantes, kits, aileron, vitres, feux, échappement, caisse abaissée…) ; MWTUNE.clear(mesh)
           MWTUNE.pack(key) / MWTUNE.unpack(s) : forme compacte envoyée à l'autre joueur (js/56)
   Conduite : MW.drv (js/40) est réglé d'après la voiture du joueur (accélération, vitesse maxi, freinage, braquage, moteur) ; son : MWTUNE.sound()
   Fiabilité, pannes (symptômes js/51) et contrôles de police : MWTUNE.wear(key), MWTUNE.breakdown(), MWTUNE.police(force), MWTUNE.ct()
   Clients : MWTUNE.orders() commandes en cours ; MWTUNE.spawn(opts) fait arriver un client de tuning ; MWTUNE.station(id) ouvre son poste de travail ; MWTUNE.step(id,i) fait une étape ;
             MWTUNE.deliver(id) rend la voiture (facture, note, expérience en « préparation »)
   Pièces : adaptateur `stk` — si MWST (js/59, stock et commande de pièces) existe, les pièces de tuning se prennent dans le stock ou se commandent ; sinon achat direct à l'atelier.
   Données sauvegardées : MW.S.tune = {v, cars:{clé:cfg}, wear, panne, ct, ban, equip:{zone:{banc,cabine}}, orders, seq, next, stats}. */
const MWTUNE=(()=>{
const T=THREE,PI=Math.PI,TAU=PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const R2=x=>Math.round(x*100)/100;
const rnd=Math.random,rint=(a,b)=>a+Math.floor(rnd()*(b-a+1)),pick=a=>a[Math.floor(rnd()*a.length)];
const fmt=x=>MW.fmt(x);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const say=(t,g)=>{try{MW.toast(t,g||'info');}catch(e){}};
const btn=(a,l,cls,dis)=>`<button type="button" class="btn${cls?' '+cls:''}" data-mw="${a}"${dis?' disabled':''}>${l}</button>`;
const api={};
const carsOK=()=>typeof MWCARS!=='undefined'&&MWCARS&&MWCARS.get;
const level=k=>{try{return MWJ.level(k);}catch(e){return 1;}};
const addXp=(k,n)=>{try{const s=MW.S,a=level(k);s.xp[k]=(s.xp[k]||0)+n;const b=level(k);if(b>a) say(`Niveau ${b} en préparation (tuning) !`,'good');}catch(e){}};
const biz=(dx,m)=>typeof MWS!=='undefined'&&MWS.biz?MWS.biz(dx,m):MW.money(dx,m);
const cashNow=()=>typeof MWS!=='undefined'&&MWS.cash?MWS.cash():MW.S.money;

/* ═══════════ 1. Catalogue ═══════════ */
const SLOTS={ecu:'Reprogrammation',adm:'Admission',exh:'Échappement sport',boost:'Suralimentation',inter:'Intercooler',clutch:'Embrayage',fly:'Volant moteur',gear:'Boîte de vitesses',lsd:'Différentiel',brakes:'Freinage',
 tyres:'Pneus',susp:'Suspension',arb:'Barres antiroulis',light:'Allègement',spoiler:'Aileron / becquet',front:'Pare-chocs avant',skirt:'Bas de caisse',rear:'Diffuseur arrière',arch:'Ailes élargies',hood:'Capot',
 tint:'Vitres teintées',hlights:'Feux avant',tlights:'Feux arrière',tips:'Échappement visible',neon:'Éclairage de plancher'};
/* [id, emplacement, catégorie, nom, prix, niveau, minutes, lieu, effets, prérequis (liste d'emplacements ou {slot:[ids]}), moteur thermique seulement, texte] */
const PD=[
 ['ecu1','ecu','perf','Reprogrammation · stage 1',480,2,90,'sport',{pw:.11,tq:.10,rel:1.2,snd:.05},null,1,'Nouvelle cartographie : le moteur respire mieux, un peu plus de couple dès les bas régimes.'],
 ['ecu2','ecu','perf','Reprogrammation · stage 2',1050,4,150,'sport',{pw:.21,tq:.19,rel:3,snd:.1,db:1},{adm:1,exh:1},1,'Cartographie poussée : demande une admission et un échappement sport.'],
 ['ecu3','ecu','perf','Reprogrammation · stage 3',2100,6,240,'sport',{pw:.33,tq:.30,rel:7,snd:.15,db:2},{boost:1,inter:1,clutch:1},1,'Cartographie de compétition : turbo ou compresseur, intercooler et embrayage renforcé obligatoires.'],
 ['adm1','adm','perf','Filtre à air sport',160,1,40,'sport',{pw:.035,snd:.08,db:2},null,1,'Filtre à cône : un peu plus de souffle, un bruit d’aspiration plus sec.'],
 ['adm2','adm','perf','Admission directe + boîte à air',420,2,75,'sport',{pw:.06,snd:.15,db:4},null,1,'Admission en tube, boîte à air dédiée : gain net à haut régime.'],
 ['exh1','exh','perf','Silencieux sport (cat-back)',340,2,70,'sport',{pw:.04,snd:.45,db:7,dm:-4},null,1,'Le son devient plus grave dès le ralenti.'],
 ['exh2','exh','perf','Ligne inox complète + catalyseur sport',780,3,120,'sport',{pw:.07,snd:.7,db:11,dm:-8},null,1,'Moins de contre-pression, son rauque en accélération.'],
 ['exh3','exh','perf','Ligne racing (sans silencieux)',1350,5,150,'sport',{pw:.10,snd:1,db:19,dm:-14},null,1,'Le bruit d’une voiture de course. La gendarmerie et la mairie ne l’aiment pas.'],
 ['cmp','boost','perf','Compresseur volumétrique',1650,4,300,'sport',{pw:.22,tq:.26,rel:4,snd:.1},{ecu:1},1,'Moteur atmosphérique seulement : de la poussée linéaire dès les bas régimes.',{asp:'atmo'}],
 ['trbk','boost','perf','Kit turbo',2900,6,480,'sport',{pw:.42,tq:.45,rel:7,snd:.2},{ecu:2},1,'Moteur atmosphérique seulement : transforme le moteur. Stage 2 minimum.',{asp:'atmo'}],
 ['trbh','boost','perf','Turbo hybride',1500,4,240,'sport',{pw:.13,tq:.14,rel:3},null,1,'Moteur turbo seulement : turbine plus grosse, plus de pression.',{asp:'turbo'}],
 ['trbg','boost','perf','Gros turbo',2600,6,420,'sport',{pw:.26,tq:.22,rel:7,snd:.1},{ecu:2},1,'Moteur turbo seulement : le grand format, à partir du stage 2.',{asp:'turbo'}],
 ['inter','inter','perf','Intercooler grand volume',420,3,90,'sport',{pw:.04,rel:-1.5},null,1,'Air plus frais, moins de contraintes sur un moteur suralimenté.',{boosted:1}],
 ['clt1','clutch','perf','Embrayage renforcé',560,3,180,'sport',{cl:1.7},null,1,'Encaisse le couple supplémentaire sans patiner.',{noev:1}],
 ['clt2','clutch','perf','Embrayage racing (métal fritté)',980,5,200,'sport',{cl:2.6,snd:.03},null,1,'Pour les gros couples : sec, mordant, bruyant au ralenti.',{noev:1}],
 ['fly','fly','perf','Volant moteur allégé',380,4,150,'sport',{acc:.04,snd:.05,rel:.5},null,1,'Le moteur monte plus vite dans les tours.',{noev:1}],
 ['gear','gear','perf','Boîte courte (rapports rapprochés)',720,4,240,'sport',{acc:.10,vm:-.06},null,0,'Reprises plus vives, vitesse maxi un peu plus basse.',{noev:1}],
 ['lsd','lsd','perf','Différentiel autobloquant',560,4,150,'sport',{trac:.10,turn:.03},null,0,'La puissance passe au sol, la voiture sort mieux des virages.'],
 ['brk1','brakes','perf','Disques rainurés + plaquettes sport',340,2,90,'sport',{brk:.12},null,0,'Freinage plus mordant et plus résistant à la chauffe.'],
 ['brk2','brakes','perf','Freins gros diamètre (étriers colorés)',1100,4,150,'sport',{brk:.32,dm:3},null,0,'Disques de très grand diamètre, étriers à plusieurs pistons.'],
 ['tyr1','tyres','perf','Pneus sport',480,1,60,'both',{grip:.10},null,0,'Gomme plus tendre, meilleure adhérence sur route sèche.'],
 ['tyr2','tyres','perf','Pneus semi-slicks',760,3,60,'both',{grip:.22,rel:1,db:2},null,0,'Presque des pneus de course : adhérence énorme, non homologués route.',{legalTyre:1}],
 ['sus0','susp','perf','Rabaissement (ressorts courts)',280,1,100,'both',{gc:-3,turn:.03},null,0,'Caisse plus basse de 3 cm, centre de gravité abaissé.'],
 ['sus1','susp','perf','Suspension sport (ressorts + amortisseurs)',780,3,180,'both',{gc:-2.5,turn:.07},null,0,'Amortissement ferme et caisse plus basse.'],
 ['sus2','susp','perf','Combinés filetés réglables',1650,4,240,'both',{gc:0,turn:.10,adj:1},null,0,'Hauteur de caisse et dureté réglables : vous choisissez de −6 cm à +1 cm.'],
 ['sus3','susp','perf','Kit rehausse',220,1,80,'both',{gc:3,turn:-.02},null,0,'Caisse plus haute de 3 cm, idéale en rallye ou sur mauvaises routes.'],
 ['arb1','arb','perf','Barre antiroulis avant',240,2,60,'both',{turn:.03},null,0,'Moins de roulis, entrée de virage plus précise.'],
 ['arb2','arb','perf','Barres antiroulis avant et arrière',460,3,100,'both',{turn:.06},null,0,'Équilibre fin de la voiture en appui.'],
 ['lt1','light','perf','Allègement léger (sièges arrière, insonorisant)',300,1,120,'sport',{dm:-38},null,0,'On enlève ce qui ne sert pas à rouler.'],
 ['lt2','light','perf','Allègement poussé (batterie lithium, vitres fines)',950,4,240,'sport',{dm:-75},null,0,'La voiture perd 75 kg.'],
 ['lt3','light','perf','Allègement extrême (carbone, capot et hayon)',2600,6,420,'sport',{dm:-120,cap:1},null,0,'120 kg de moins : capot carbone compris.'],
 ['sp1','spoiler','style','Becquet de hayon',190,1,45,'style',{df:.01},null,0,'Un petit becquet discret sur le hayon ou le coffre.'],
 ['sp4','spoiler','style','Ducktail (becquet relevé)',340,2,60,'style',{df:.02},null,0,'Un bec de canard relevé à l’arrière.'],
 ['sp2','spoiler','style','Aileron GT',540,2,90,'style',{df:.035,drag:.01},null,0,'Un aileron sur pieds, façon GT.'],
 ['sp3','spoiler','style','Aileron racing (grand plan)',1050,4,120,'style',{df:.06,drag:.025},null,0,'Grand plan, dérives latérales : appui énorme à haute vitesse.'],
 ['fr1','front','style','Lame de pare-chocs avant (splitter)',320,2,90,'style',{df:.015},null,0,'Une lèvre sous le pare-chocs.'],
 ['fr2','front','style','Pare-chocs avant racing + canards',780,3,150,'style',{df:.03},null,0,'Grandes prises d’air, lame large et ailettes.'],
 ['sk1','skirt','style','Jupes latérales',340,2,100,'style',{},null,0,'Bas de caisse plus agressifs.'],
 ['sk2','skirt','style','Jupes racing',620,3,120,'style',{df:.01},null,0,'Jupes profilées avec ailette.'],
 ['rr1','rear','style','Diffuseur arrière',360,2,100,'style',{df:.015},null,0,'Des ailettes sous le pare-chocs arrière.'],
 ['rr2','rear','style','Diffuseur racing',640,4,140,'style',{df:.03},null,0,'Grand diffuseur à ailettes hautes.'],
 ['ar1','arch','style','Élargisseurs d’ailes',700,3,240,'style',{wide:.035},null,0,'Les roues sortent un peu : look musclé.'],
 ['ar2','arch','style','Kit large (widebody)',2400,5,480,'style',{wide:.07,legalBody:1},null,0,'Ailes très larges. Impressionnant, mais pas homologué partout.'],
 ['hd1','hood','style','Capot à ouïes en carbone',880,3,120,'style',{dm:-9,cap:1},null,0,'Un capot léger avec ouïes d’aération.'],
 ['tn1','tint','style','Vitres teintées légères',90,1,60,'style',{tint:.35},null,0,'Teinte légère, tout à fait légale.'],
 ['tn2','tint','style','Vitres très teintées',140,1,60,'style',{tint:.20},null,0,'Teinte foncée : à la limite de la loi.'],
 ['tn3','tint','style','Vitres noires intégrales',180,1,60,'style',{tint:.07,legalTint:1},null,0,'Impossible de voir à l’intérieur… ni de bien voir dehors.'],
 ['hl1','hlights','style','Feux avant au xénon',260,1,60,'style',{},null,0,'Faisceau blanc-bleu.'],
 ['hl2','hlights','style','Feux avant à LED + signature lumineuse',540,2,90,'style',{},null,0,'Phares à LED avec liseré lumineux.'],
 ['tl1','tlights','style','Feux arrière fumés',210,1,50,'style',{},null,0,'Verres sombres sur les feux arrière.'],
 ['tl2','tlights','style','Feux arrière à LED',420,2,70,'style',{},null,0,'Feux à LED avec barre lumineuse.'],
 ['tp1','tips','style','Embout d’échappement chromé',90,1,30,'style',{},null,1,'Un embout poli.'],
 ['tp2','tips','style','Double sortie inox',190,2,60,'style',{},null,1,'Deux sorties inox.'],
 ['tp3','tips','style','Embouts titane brûlé',340,3,60,'style',{},null,1,'Reflets bleutés de titane.'],
 ['tp4','tips','style','Quadruple sortie noire',260,2,90,'style',{},null,1,'Quatre sorties de style compétition.'],
 ['nn1','neon','style','Éclairage de plancher (néons)',220,1,60,'style',{legalNeon:1},null,0,'Un halo coloré sous la voiture. Amende garantie en ville.']];
const PARTS={},LIST=[];
for(const a of PD){const p={id:a[0],slot:a[1],cat:a[2],nom:a[3],prix:a[4],niv:a[5],mo:a[6],lieu:a[7],fx:a[8],req:a[9],ice:!!a[10],txt:a[11],cond:a[12]||null};PARTS[p.id]=p;LIST.push(p);}
const ORDER_PERF=['ecu','adm','exh','boost','inter','clutch','fly','gear','lsd','brakes','tyres','susp','arb','light'];
const ORDER_STYLE=['spoiler','front','skirt','rear','arch','hood','tint','hlights','tlights','tips','neon'];
/* peinture, covering, jantes */
const PAINTS={brillant:{nom:'Brillante',prix:640,niv:2,sh:70,sp:0x444444},metal:{nom:'Métallisée',prix:820,niv:3,sh:120,sp:0x888888},nacre:{nom:'Nacrée',prix:1150,niv:4,sh:140,sp:0xaaaaaa},mat:{nom:'Mate',prix:960,niv:3,sh:3,sp:0x000000},satin:{nom:'Satinée',prix:880,niv:3,sh:22,sp:0x222222}};
const BICOLOR_PRIX=480;
const WRAPS={satin:{nom:'Film satiné (toute la voiture)',prix:520,niv:2,mo:300},chrome:{nom:'Film chromé',prix:1250,niv:4,mo:360},carbone:{nom:'Carbone (capot et toit)',prix:420,niv:3,mo:180},bandes:{nom:'Bandes racing',prix:260,niv:1,mo:90}};
const WHEELS={etoile5:{nom:'Étoile à 5 branches',base:180},multi10:{nom:'Multi-branches (10 rayons)',base:260},turbine:{nom:'Turbine',base:320},grille:{nom:'Grille (type maillage)',base:420},rally:{nom:'Rallye 4 branches',base:240},concave:{nom:'Concave profonde',base:560}};
const COLORS=[['Rouge rallye',0xc4281c],['Bleu nuit',0x1f3a8a],['Bleu électrique',0x1e7bff],['Vert anglais',0x1f5a3a],['Vert acide',0x7ad020],['Jaune course',0xf0c010],['Orange',0xe8701c],['Violet',0x6a2a9a],['Rose',0xe0508a],['Blanc',0xeeeeee],['Gris ciment',0x8a8e94],['Gris anthracite',0x32353a],['Noir',0x101114],['Or',0xc8a030],['Bronze',0x7a5a3a],['Argent',0xc4c8ce]];
const WCOLORS=[['Argent',0xc4c8ce],['Graphite',0x3a3d44],['Noir',0x16171a],['Or',0xc8a030],['Blanc',0xeeeeee],['Bronze',0x6a4a2a],['Bleu',0x2a5ab0],['Rouge',0xb02020]];
const PF={pop:1,gen:1.1,prem:1.3,sport:1.45};
const KIND_F={citadine:.9,berline:1,suv:1.1,utilitaire:1.05,sport:1.05};

/* ═══════════ 2. État et voitures ═══════════ */
function TS(){const s=MW.S;if(!s) return null;
 if(!s.tune||typeof s.tune!=='object') s.tune={};const t=s.tune;
 if(t.v!==1){t.v=1;}
 for(const k of ['cars','wear','panne','ct','ban','equip','nn']) if(!t[k]||typeof t[k]!=='object') t[k]={};
 if(!Array.isArray(t.orders)) t.orders=[];
 if(t.seq==null) t.seq=0;if(t.next==null) t.next=0;
 if(!t.stats) t.stats={done:0,earn:0,stars:0,fines:0,dyno:0,km:0};
 return t;}
const curCar=()=>{try{return MWC.getCar();}catch(e){return {id:'vieille',model:'p206',kind:'citadine',color:0x7c8a6a};}};
const keyOf=()=>{const c=curCar();return c.id||'vieille';};
const emptyCfg=()=>({p:{},paint:null,wrap:null,wheels:null,h:0,stiff:.5,neon:0x30c0ff});
function cfgOf(key,create){const t=TS();if(!t) return emptyCfg();key=key||keyOf();let c=t.cars[key];if(!c){c=emptyCfg();if(create) t.cars[key]=c;else return c;}
 if(!c.p) c.p={};if(c.h==null) c.h=0;if(c.stiff==null) c.stiff=.5;if(c.neon==null) c.neon=0x30c0ff;return c;}
const carOf=model=>{try{return carsOK()?MWCARS.get(model):null;}catch(e){return null;}};
const modelOfCur=()=>{const c=curCar();return c.model||'p206';};
const insideR=s=>{const m=/R(\d+)/.exec(s||'');return m?+m[1]:16;};
function spec(model){
 const c=carOf(model);
 if(!c) return {ch:70,nm:150,mass:1000,rpm:6000,asp:'atmo',drive:'fwd',ev:false,gb:'man',inch:15,gc:.13,cat:'pop',kind:'citadine',L:4,W:1.7,H:1.45,WB:2.5,fuel:'essence',gears:5};
 const e=c.eng||{};
 return {ch:e.ch||70,nm:e.nm||150,mass:c.mass||1100,rpm:e.rpm||6000,asp:e.asp||'atmo',drive:c.drive||'fwd',ev:!!(c.ev||e.ev),gb:c.gb||'man',inch:insideR(c.tyre),gc:c.gc||.13,cat:c.cat||'pop',kind:c.kind||'berline',
  L:c.L,W:c.W,H:c.H,WB:c.WB,fuel:e.fuel||'essence',gears:c.gears||5,nom:c.mk+' '+c.mo+(c.gen?' '+c.gen:'')+' '+(e.nom||'')};}
api.spec=spec;
const pf=sp=>(PF[sp.cat]||1)*(KIND_F[sp.kind]||1);
const priceOf=(model,id)=>{const p=PARTS[id];if(!p) return 0;return Math.round(p.prix*pf(spec(model))/5)*5;};
api.price=priceOf;
/* niveau minimal du poseur et prérequis */
function boosted(sp,cfg){return sp.asp==='turbo'||sp.asp==='biturbo'||!!(cfg.p.boost);}
function fit(model,cfg,id){
 const p=PARTS[id],sp=spec(model),why=[];if(!p) return {ok:false,why:['pièce inconnue']};
 if(sp.ev&&p.ice) why.push('voiture électrique : sans objet');
 if(p.cond){
  if(p.cond.asp&&sp.asp!==p.cond.asp&&!(p.cond.asp==='turbo'&&sp.asp==='biturbo')) why.push(p.cond.asp==='atmo'?'réservé aux moteurs atmosphériques':'réservé aux moteurs turbo');
  if(p.cond.boosted&&!boosted(sp,cfg)) why.push('réservé aux moteurs suralimentés');
  if(p.cond.noev&&sp.ev) why.push('sans objet sur une voiture électrique');}
 if(p.req){for(const sl in p.req){const have=cfg.p[sl];const need=p.req[sl];
   const okSlot=sl==='boost'?(boosted(sp,cfg)):sl==='ecu'?!!have&&(PARTS[have].id>='ecu'+need):sl==='clutch'?(!!have):!!have;
   if(!okSlot){const nm={adm:'une admission sport',exh:'un échappement sport',boost:'un turbo ou un compresseur',inter:'un intercooler',clutch:'un embrayage renforcé',ecu:'une reprogrammation stage '+need};why.push('demande '+(nm[sl]||SLOTS[sl]));}}}
 return {ok:why.length===0,why};}
api.fit=(model,cfg,id)=>fit(model,cfg||cfgOf(),id);
/* effets cumulés */
function sumFx(sp,cfg){
 const a={pw:0,tq:0,dm:0,grip:0,brk:0,turn:0,acc:0,vm:0,df:0,drag:0,cl:1,snd:0,db:0,rel:0,gc:0,wide:0,tint:1,trac:0,legal:[]};
 for(const sl in cfg.p){const p=PARTS[cfg.p[sl]];if(!p) continue;const f=p.fx;
  for(const k of ['pw','tq','dm','grip','brk','turn','acc','vm','df','drag','snd','db','rel','gc','wide','trac']) if(f[k]) a[k]+=f[k];
  if(f.cl) a.cl=Math.max(a.cl,f.cl);if(f.tint) a.tint=Math.min(a.tint,f.tint);}
 /* hauteur réglable (combinés filetés) */
 if(cfg.p.susp==='sus2') a.gc+=clamp(cfg.h,-6,1);else if(!cfg.p.susp) a.gc+=0;
 if(cfg.p.susp==='sus2') a.turn+=(cfg.stiff-.5)*.08;
 return a;}
function wheelInch(sp,cfg){return cfg.wheels?cfg.wheels.i:sp.inch;}
function wheelFx(sp,cfg){const d=wheelInch(sp,cfg)-sp.inch;return {dm:d*2.4,turn:d*.006,rel:d>2?(d-2)*.4:0};}
/* ─ calcul des performances ─ */
let stats=function(model,cfg){
 cfg=cfg||cfgOf();const sp=spec(model),fx=sumFx(sp,cfg),wf=wheelFx(sp,cfg);
 const pwr=clamp(fx.pw,0,.9),ch0=sp.ch,nm0=sp.nm;
 const ch=ch0*(1+pwr),nm=nm0*(1+clamp(fx.tq,0,.95));
 let mass=Math.max(sp.mass*.7,sp.mass+fx.dm+wf.dm);
 if(cfg.p.tint) mass+=0;
 /* embrayage : couple admissible */
 const cap=nm0*1.4*fx.cl,over=Math.max(0,nm/cap-1);
 let rel=fx.rel+wf.rel+over*16+Math.max(0,ch/ch0-1.3)*22;
 if(cfg.wheels&&cfg.wheels.i-sp.inch>3) rel+=1;
 const R=sp.ev?clamp(100-rel*1.5,5,100):clamp(Math.round(100-2.6*rel),5,100);
 const db=74+fx.db,gcN=sp.gc*100+fx.gc+(cfg.p.susp?0:0)+(cfg.p.arch?0:0); /* cm */
 const r=(ch/mass)/(ch0/sp.mass);
 const driveF=sp.drive==='awd'?1.22:sp.drive==='rwd'?.98:.9;
 const gripT=1+fx.grip+fx.trac;
 const accMax=1.38*gripT*driveF;
 const accRaw=Math.pow(r,.86)*(1+fx.acc);
 const accel=clamp(Math.min(accRaw,accMax),.55,2.4);
 const vmax=clamp(22*(1+(r-1)*.38)*(1+fx.vm)*(1-fx.drag)*(1+fx.df*.15),11,36);
 const brake=clamp((1+fx.brk+fx.grip*.8)*Math.pow(sp.mass/mass,.28),.6,2.2);
 const turnK=clamp(1+fx.turn+wf.turn+fx.grip*.85+fx.df*.6+(Math.pow(sp.mass/mass,.2)-1)+fx.wide*.6+(gcN<sp.gc*100?(sp.gc*100-gcN)*.004:0),.7,1.75);
 /* chiffres « réels » affichés */
 const t100=Math.max(2.2,Math.max(1.52*Math.pow(mass/ch,.834),2.9/(gripT*driveF)));
 const t100s=Math.max(2.2,Math.max(1.52*Math.pow(sp.mass/ch0,.834),2.9/(1*driveF)));
 const vreal=Math.min(320,30*Math.pow(ch,.4))*(1+fx.vm)*(1-fx.drag),vreal0=Math.min(320,30*Math.pow(ch0,.4));
 const legal=legalOf(sp,cfg,fx,{db,gcN,ch,ch0});
 const drv={vm:R2(vmax),acc:R2(accel),brk:R2(brake),turn:R2(turnK),eng:1};
 return {ch:Math.round(ch),nm:Math.round(nm),mass:Math.round(mass),t100:R2(t100),t100s:R2(t100s),vmax:Math.round(vreal),vmax0:Math.round(vreal0),grip:R2(gripT+fx.df),brake:R2(brake),turn:R2(turnK),rel:R,rel0:rel,db:Math.round(db),gc:R2(gcN),
  drv,legal,fx,over:R2(over),sp,cap:Math.round(cap),pwr:R2(ch/mass*1000)};}
const SMEMO=new Map();
const stats0=stats;
stats=(model,cfg)=>{cfg=cfg||cfgOf();const k=model+'|'+JSON.stringify(cfg);let r=SMEMO.get(k);if(!r){r=stats0(model,cfg);if(SMEMO.size>300) SMEMO.clear();SMEMO.set(k,r);}return r;};
api.stats=(model,cfg)=>stats(model,cfg);
function legalOf(sp,cfg,fx,o){
 const L=[];
 if(o.db>93) L.push({id:'bruit',txt:`Bruit excessif (${Math.round(o.db)} dB, limite 93 dB)`,fix:'Remplacez l’échappement par un modèle plus silencieux.',g:2});
 if(fx.tint<.3&&fx.tint>=.15) L.push({id:'vitres',txt:'Vitres teintées à la limite de la loi',fix:'Teinte plus claire (≥ 35 %).',g:1,soft:1});
 if(fx.tint<.15) L.push({id:'vitres',txt:'Vitres avant trop teintées (moins de 70 % de lumière)',fix:'Remplacez par une teinte légère.',g:2});
 if(o.gcN<8) L.push({id:'garde',txt:`Garde au sol insuffisante (${Math.round(o.gcN)} cm)`,fix:'Remontez la caisse (combinés filetés) ou changez les ressorts.',g:2});
 if(cfg.p.neon) L.push({id:'neon',txt:'Éclairage de plancher non homologué',fix:'Déposez les néons.',g:1});
 if(cfg.p.tyres==='tyr2') L.push({id:'pneus',txt:'Pneus non homologués pour la route',fix:'Remettez des pneus route ou sport.',g:2});
 if(o.ch/o.ch0>1.45) L.push({id:'puissance',txt:`Puissance non homologuée (+${Math.round((o.ch/o.ch0-1)*100)} %)`,fix:'Passage à la réception à titre isolé : réduisez la reprogrammation.',g:2});
 if(cfg.p.arch==='ar2') L.push({id:'carrosserie',txt:'Carrosserie modifiée sans homologation (kit large)',fix:'Déposez le kit large ou prenez des élargisseurs.',g:1});
 return L;}
api.legal=(model,cfg)=>stats(model,cfg).legal;

/* ═══════════ 3. Rendu : modifications dessinées sur le maillage (ancres et lancers de rayons de js/44) ═══════════ */
const MC=new Map();
function phong(c,o){o=o||{};const k=[c,o.sh,o.sp,o.em,o.op,o.vc?1:0,o.side].join('|');let m=MC.get(k);if(m) return m;
 m=new T.MeshPhongMaterial({color:c,shininess:o.sh==null?50:o.sh,specular:o.sp==null?0x444444:o.sp,side:o.side==null?T.DoubleSide:o.side});
 if(o.em!=null){m.emissive=new T.Color(o.em);m.emissiveIntensity=o.ei==null?.6:o.ei;}
 if(o.op!=null){m.transparent=true;m.opacity=o.op;m.depthWrite=false;}
 if(o.vc) m.vertexColors=true;
 if(o.po){m.polygonOffset=true;m.polygonOffsetFactor=-3;m.polygonOffsetUnits=-3;}
 MC.set(k,m);return m;}
const CARBON=0x15171a;
let carbonTex=null;
function carbonMat(){if(carbonTex) return carbonTex;
 const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');x.fillStyle='#16181c';x.fillRect(0,0,64,64);
 for(let i=0;i<8;i++) for(let j=0;j<8;j++){x.fillStyle=(i+j)%2?'#2c3036':'#0c0d10';x.fillRect(i*8,j*8,8,8);x.fillStyle='rgba(255,255,255,.07)';x.fillRect(i*8,j*8,8,2);}
 const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1,1);
 carbonTex=new T.MeshPhongMaterial({map:t,shininess:90,specular:0x666666,side:T.DoubleSide});return carbonTex;}
function mergeG(list){const pos=[],nor=[];
 for(const [g0,m] of list){const g=g0.index?g0.toNonIndexed():g0.clone();g.applyMatrix4(m);const p=g.attributes.position.array,n=g.attributes.normal?g.attributes.normal.array:null;
  for(let i=0;i<p.length;i++) pos.push(p[i]);if(n) for(let i=0;i<n.length;i++) nor.push(n[i]);else for(let i=0;i<p.length;i++) nor.push(0);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));return g;}
const M4=(x,y,z,rx,ry,rz)=>{const m=new T.Matrix4(),e=new T.Euler(rx||0,ry||0,rz||0);m.makeRotationFromEuler(e);m.setPosition(x||0,y||0,z||0);return m;};
const GEOC=new Map();
const cached=(k,f)=>{let g=GEOC.get(k);if(!g){g=f();GEOC.set(k,g);}return g;};

/* ─ roues : jantes de plusieurs modèles et tailles, pneu recalculé pour garder le diamètre extérieur ─ */
function wheelParts(rt,tw,inch,style){
 return cached(['w',rt.toFixed(3),tw.toFixed(3),inch,style].join('|'),()=>{
  const rimR=Math.min(inch*.0254/2,rt-.036),sw=rt-rimR,P=(r,y)=>new T.Vector2(r,y),w=tw;
  const prof=[P(rimR+.002,-w*.36),P(rimR+sw*.2,-w*.485),P(rimR+sw*.55,-w*.515),P(rt-.022,-w*.47),P(rt-.005,-w*.40),P(rt,-w*.30),P(rt,w*.30),P(rt-.005,w*.40),P(rt-.022,w*.47),P(rimR+sw*.55,w*.515),P(rimR+sw*.2,w*.485),P(rimR+.002,w*.36)];
  const tire=new T.LatheGeometry(prof,28);tire.rotateZ(-PI/2);
  const R=rimR-.004,rw=Math.min(w*.84,.3),yo=rw/2-.03,hub=.052,parts=[];
  const lip=style==='concave'?.05:0;
  const barrel=new T.LatheGeometry([P(R*.78,-rw/2),P(R*.96,-rw/2+.012),P(R,-rw/2+.03),P(R,rw/2-.02+lip),P(R*.995,rw/2-.006+lip),P(R*.97,rw/2+lip)],26);parts.push([barrel,new T.Matrix4()]);
  const spoke=(n,wid,len,r0,off,yaw,yy)=>{for(let i=0;i<n;i++){const a=i/n*TAU+(off||0),rc=(r0+len)/2;
    const m=new T.Matrix4().makeRotationY(-a);m.multiply(new T.Matrix4().makeTranslation(rc,yy==null?yo:yy,0));if(yaw) m.multiply(new T.Matrix4().makeRotationY(yaw));
    parts.push([new T.BoxGeometry(len-r0,.024,wid),m]);}};
  const ring=(r,th,y0,h)=>parts.push([new T.CylinderGeometry(r+th/2,r+th/2,h,28,1,true),new T.Matrix4().makeTranslation(0,y0,0)]);
  if(style==='etoile5') spoke(5,.07,R*.96,hub,0);
  else if(style==='multi10'){spoke(10,.03,R*.95,hub,0);spoke(10,.012,R*.88,hub+.01,TAU/20);}
  else if(style==='turbine'){spoke(12,.04,R*.95,hub,0,.5);}
  else if(style==='grille'){spoke(16,.016,R*.93,hub,0,.62);spoke(16,.016,R*.93,hub,TAU/32,-.62);ring(R*.55,.012,yo,.02);ring(R*.8,.014,yo,.02);}
  else if(style==='rally') spoke(4,.1,R*.97,hub,PI/4);
  else if(style==='concave'){spoke(6,.075,R*.94,hub,0,0,yo-.035);ring(R*.9,.02,yo-.03,.03);}
  parts.push([new T.CylinderGeometry(hub+.012,hub+.016,.034,18),new T.Matrix4().makeTranslation(0,yo,0)]);
  const rim=mergeG(parts);rim.rotateZ(-PI/2);
  return {tire,rim,rimR,rt};});}
function wheelSizeOK(model,inch){const c=carOf(model);if(!c) return true;const m=/(\d+)\/(\d+)\s*R(\d+)/.exec(c.tyre);if(!m) return true;const rt=insideR(c.tyre)*.0254/2+(+m[1]/1000)*(+m[2])/100;return inch*.0254/2<=rt-.04;}
function maxInch(model){for(let i=21;i>=12;i--) if(wheelSizeOK(model,i)) return i;return 16;}

/* ─ lancers de rayons sur la carrosserie (repère de la voiture) ─ */
const RC=new T.Raycaster(),V0=new T.Vector3(),V1=new T.Vector3();
function bodyList(mesh,noGlass){const l=[];
 const walk=o=>{for(const c of o.children){if(c.userData&&c.userData.tuneObj) continue;if(/^(w|brake)(FL|FR|RL|RR)$/.test(c.name)||c.name==='dessous'||c.name==='tune') continue;
   if(c.isMesh){const m=c.material;if(c.visible&&m&&!(noGlass&&m.transparent)&&c.geometry&&c.geometry.attributes.position.count>8) l.push(c);}else if(c.children&&c.children.length&&c.name!=='bay') walk(c);}};
 walk(mesh);return l;}
function rays(mesh,list){
 mesh.updateMatrixWorld(true);
 const hit=(ox,oy,oz,dx,dy,dz,far)=>{V0.set(ox,oy,oz);mesh.localToWorld(V0);V1.set(dx,dy,dz).transformDirection(mesh.matrixWorld);RC.set(V0,V1);RC.near=0;RC.far=far;
  const h=RC.intersectObjects(list,false);if(!h.length) return null;return mesh.worldToLocal(h[0].point.clone());};
 return {hit,top:(x,z,y0)=>hit(x,y0==null?3:y0,z,0,-1,0,6),front:(x,y)=>hit(x,y,6,0,0,-1,12),rear:(x,y)=>hit(x,y,-6,0,0,1,12),side:(y,z)=>hit(4,y,z,-1,0,0,8)};}

/* ─ peinture : matériaux, bicolore, nacré, carbone ─ */
const hsl=(c,dh,dl)=>{const o=new T.Color(c),h={};o.getHSL(h);o.setHSL((h.h+dh+1)%1,Math.min(1,h.s*1.05),clamp(h.l+dl,.05,.9));return o;};
function paintMaterial(finish,c,c2){
 const F=PAINTS[finish]||PAINTS.brillant;
 if(finish==='nacre') return new T.MeshPhongMaterial({color:0xffffff,vertexColors:true,shininess:F.sh,specular:0xbbbbbb,side:T.DoubleSide});
 return new T.MeshPhongMaterial({color:c,shininess:F.sh,specular:F.sp,side:T.DoubleSide});}
function pearlGeo(g,c){return cached(['pearl',g.uuid,c].join('|'),()=>{
 const gg=g.clone(),p=gg.attributes.position,n=gg.attributes.normal,col=new Float32Array(p.count*3),a=new T.Color(c),b=hsl(c,.065,.09),t=new T.Color();
 for(let i=0;i<p.count;i++){const s=.5+.5*Math.sin(p.getX(i)*2.3+p.getZ(i)*1.4+(n?n.getY(i):0)*2.6);t.copy(a).lerp(b,s);col[i*3]=t.r;col[i*3+1]=t.g;col[i*3+2]=t.b;}
 gg.setAttribute('color',new T.BufferAttribute(col,3));return gg;});}
function uvGeo(g){return cached(['uv',g.uuid].join('|'),()=>{const gg=g.clone(),p=gg.attributes.position,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)*2.2;uv[i*2+1]=p.getZ(i)*2.2;}gg.setAttribute('uv',new T.BufferAttribute(uv,2));return gg;});}
function splitRoof(g,yMin){return cached(['split',g.uuid,yMin.toFixed(2)].join('|'),()=>{
 const pos=g.attributes.position,idx=g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,i)=>i),a=[],b=[];
 for(let i=0;i+2<idx.length;i+=3){const y=(pos.getY(idx[i])+pos.getY(idx[i+1])+pos.getY(idx[i+2]))/3;(y>yMin?b:a).push(idx[i],idx[i+1],idx[i+2]);}
 const mk=ix=>{const gg=new T.BufferGeometry();gg.setAttribute('position',pos);if(g.attributes.normal) gg.setAttribute('normal',g.attributes.normal);gg.setIndex(ix);return gg;};
 return {rest:mk(a),roof:mk(b)};});}

/* ─ une voiture dessinée : restauration complète puis ajout ─ */
function clear(mesh){
 const u=mesh&&mesh.userData;if(!u||!u.tune) return;const st=u.tune;
 for(const f of st.undo.slice().reverse()){try{f();}catch(e){}}
 if(st.group){mesh.remove(st.group);st.group.traverse(o=>{if(o.isMesh&&o.userData.own){o.geometry.dispose();}});}
 delete u.tune;}
api.clear=clear;
function apply(mesh,cfg,opt){
 opt=opt||{};if(!mesh||!mesh.userData||!mesh.userData.L) return false;cfg=cfg||emptyCfg();
 clear(mesh);
 const u=mesh.userData,model=u.mdl||(opt.model)||'p206',sp=spec(model),st={undo:[],group:new T.Group(),sig:JSON.stringify(cfg)},grp=st.group;grp.name='tune';u.tune=st;
 const fx=sumFx(sp,cfg),undo=f=>st.undo.push(f);
 const L=u.L,W=u.W,H=u.H,hw=W/2;
 const kids=mesh.children.slice();
 const isWheel=o=>/^(w|brake)(FL|FR|RL|RR)$/.test(o.name),isBody=o=>!isWheel(o)&&o.name!=='tune'&&!(o.isObject3D&&/^@/.test(o.name));
 const meshes=kids.filter(o=>o.isMesh);
 const paintM=meshes[0]?meshes[0]:null,paintMat0=paintM?paintM.material:null;
 const byCol=(hex,tr)=>meshes.find(o=>o.material&&o.material.color&&o.material.color.getHex()===hex&&(tr==null||!!o.material.transparent===tr));
 const glassM=meshes.find(o=>o.material&&o.material.transparent&&Math.abs((o.material.opacity||1)-.6)<.05);
 const headM=byCol(0xdfe7ee,false),tailM=byCol(0x9a1018,false);
 const hood=u.hood||mesh.getObjectByName('hood');
 const hoodTop=hood&&hood.children.find(o=>o.isMesh&&o.material===paintMat0);
 const swap=(o,m)=>{if(!o) return;const old=o.material;o.material=m;undo(()=>{o.material=old;});};
 const hide=o=>{if(!o) return;const v=o.visible;o.visible=false;undo(()=>{o.visible=v;});};
 /* 1. hauteur de caisse : tout sauf roues, freins, ancres */
 const dy=(stats(model,cfg).gc-sp.gc*100)/100;
 if(Math.abs(dy)>.001) for(const o of kids) if(isBody(o)&&!o.isLight){const y0=o.position.y;o.position.y=y0+dy;undo(()=>{o.position.y=y0;});}
 /* 2. largeur : roues et freins déplacés vers l'extérieur */
 if(fx.wide>0) for(const o of kids) if(isWheel(o)){const x0=o.position.x,s=Math.sign(x0);o.position.x=x0+s*fx.wide;undo(()=>{o.position.x=x0;});}
 const R=rays(mesh,bodyList(mesh,false)),RN=rays(mesh,bodyList(mesh,true));
 const col0=cfg.paint?cfg.paint.c:(u.color!=null?u.color:0xb03030);
 const bodyMat=phong(cfg.paint?col0:col0,{sh:(PAINTS[cfg.paint&&cfg.paint.f]||PAINTS.brillant).sh,sp:0x333333});
 const dark=phong(0x0e0f12,{sh:30,sp:0x222222}),carb=phong(CARBON,{sh:80,sp:0x555555});
 const add=(g,m,x,y,z,rx,ry,rz,name)=>{const o=new T.Mesh(g,m);o.position.set(x||0,y||0,z||0);o.rotation.set(rx||0,ry||0,rz||0);o.userData.tuneObj=1;o.userData.own=0;if(name) o.name=name;grp.add(o);return o;};
 const BX=(w,h,d)=>cached('bx|'+w.toFixed(3)+'|'+h.toFixed(3)+'|'+d.toFixed(3),()=>new T.BoxGeometry(w,h,d));
 const box=(w,h,d,m,x,y,z,rx,ry,rz,name)=>add(BX(w,h,d),m,x,y,z,rx,ry,rz,name);
 /* 3. peinture, covering */
 const yRoof=H*.74,w=cfg.wrap,carbonHood=!!((w&&w.t==='carbone')||fx.cap);
 const setHood=(m,carbon)=>{if(!hoodTop) return;swap(hoodTop,m);if(carbon&&hoodTop.geometry&&!hoodTop.geometry.attributes.uv){const g0=hoodTop.geometry;hoodTop.geometry=uvGeo(g0);undo(()=>{hoodTop.geometry=g0;});}};
 const finish=cfg.paint?cfg.paint.f:'brillant',two=cfg.paint&&cfg.paint.c2!=null;
 if(paintM&&(cfg.paint||w)){
  let c1=col0,fin=finish;
  if(w&&w.t==='satin'){c1=w.c;fin='satin';}
  const main=w&&w.t==='chrome'?new T.MeshPhongMaterial({color:0xd6dae0,shininess:220,specular:0xffffff,emissive:0x2a2c30,side:T.DoubleSide}):paintMaterial(fin,c1);
  const addPaint=(g,m)=>{const o=new T.Mesh(g,m);o.userData.tuneObj=1;grp.add(o);return o;};
  if((two||(w&&w.t==='carbone'))&&paintM.geometry){
   const sg=splitRoof(paintM.geometry,yRoof);hide(paintM);
   addPaint(fin==='nacre'?pearlGeo(sg.rest,c1):sg.rest,main);
   if(w&&w.t==='carbone') addPaint(uvGeo(sg.roof),carbonMat());
   else addPaint(sg.roof,paintMaterial(fin==='nacre'?'brillant':fin,cfg.paint.c2));
   setHood(carbonHood?carbonMat():(two?paintMaterial(fin==='nacre'?'brillant':fin,cfg.paint.c2):main),carbonHood);
  }else if(fin==='nacre'&&paintM.geometry){
   addPaint(pearlGeo(paintM.geometry,c1),main);hide(paintM);setHood(carbonHood?carbonMat():paintMaterial('brillant',c1),carbonHood);
  }else{swap(paintM,main);setHood(carbonHood?carbonMat():main,carbonHood);}
 }else if(carbonHood) setHood(carbonMat(),true);
 /* bandes racing : rubans suivant la carrosserie (capot, toit, coffre) */
 if(cfg.wrap&&cfg.wrap.t==='bandes'){
  const sm=phong(w.c,{sh:40,sp:0x222222,po:1});
  for(const cx of [-.13,.13]) for(const seg of stripeSegs(RN,cx,L)){
   const pos=[],idx=[];seg.forEach((p,i)=>{pos.push(p.x-.085,p.y+.005,p.z,p.x+.085,p.y+.005,p.z);if(i){const a=(i-1)*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}});
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,sm);m.userData.tuneObj=1;m.userData.own=1;grp.add(m);}}
 /* 4. vitres, feux */
 if(cfg.p.tint&&glassM){const t=fx.tint;swap(glassM,new T.MeshPhongMaterial({color:0x06080b,shininess:120,specular:0x8899aa,transparent:true,opacity:clamp(1-t*.55,.62,.97),depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));}
 if(cfg.p.hlights&&headM) swap(headM,new T.MeshPhongMaterial({color:cfg.p.hlights==='hl1'?0xcfe6ff:0xf2f6ff,shininess:110,specular:0xffffff,emissive:cfg.p.hlights==='hl1'?0x6fa0ff:0xbfd6ff,emissiveIntensity:.55}));
 if(cfg.p.tlights==='tl1'&&tailM) swap(tailM,new T.MeshPhongMaterial({color:0x3a0608,shininess:90,specular:0x664444,emissive:0xff2020,emissiveIntensity:.12}));
 const AP=n=>{const o=u.anchors&&u.anchors[n];return o?o.position.clone():null;};
 if(cfg.p.hlights==='hl2'){const a=AP('headL');if(a){const fz=R.front(Math.abs(a.x),a.y-.07),z0=fz?fz.z:a.z+.1,led=phong(0xe8f4ff,{em:0xdff0ff,ei:1,sh:90});
   for(const s of [-1,1]) box(.34,.012,.012,led,s*Math.abs(a.x),a.y-.07,z0+.004,0,s*.12,0);}}
 if(cfg.p.tlights==='tl2'){const a=AP('tailL');if(a){const rz=R.rear(0,a.y),z0=rz?rz.z:a.z-.1,led=phong(0xff2a2a,{em:0xff1010,ei:1,sh:60});box(Math.abs(a.x)*1.7,.014,.012,led,0,a.y,z0-.004);}}
 /* 5. roues et freins */
 if(cfg.wheels||cfg.p.brakes){
  const wcol=cfg.wheels?cfg.wheels.c:0xc4c8ce,mat=phong(wcol,{sh:100,sp:0xdddddd}),tmat=phong(0x17181a,{sh:6,sp:0x111111});
  const tw=(()=>{const c=carOf(model);const m=c&&/(\d+)\/(\d+)\s*R(\d+)/.exec(c.tyre);return m?+m[1]/1000:.215;})();
  for(const o of kids) if(/^w(FL|FR|RL|RR)$/.test(o.name)){
   const rt=o.position.y,sgn=Math.sign(o.position.x)||1;
   if(cfg.wheels){const wp=wheelParts(rt,tw,cfg.wheels.i,cfg.wheels.m);
    const tg=new T.Mesh(wp.tire,tmat),rg=new T.Mesh(wp.rim,mat);tg.userData.tuneObj=1;rg.userData.tuneObj=1;if(sgn<0){tg.rotation.y=PI;rg.rotation.y=PI;}
    o.add(tg,rg);for(const c of o.children) if(c!==tg&&c!==rg&&c.isMesh) hide(c);undo(()=>{o.remove(tg);o.remove(rg);});}}
  else{}
  for(const o of kids) if(/^brake(FL|FR|RL|RR)$/.test(o.name)&&cfg.p.brakes){
   const disc=o.children[0],cal=o.children[1];
   if(cfg.p.brakes==='brk2'&&disc){const s0=disc.scale.clone();disc.scale.set(1,1.2,1.2);undo(()=>disc.scale.copy(s0));}
   if(cal&&cal.material){swap(cal,phong(cfg.p.brakes==='brk2'?0xf0c010:0xc0201c,{sh:70,sp:0x555555}));}}
 }
 /* 6. kits carrosserie et ailerons */
 buildKit(mesh,cfg,fx,{R,RN,box,add,BX,bodyMat,dark,carb,L,W,H,hw,u,sp,AP,col0,dy});
 /* 7. échappement visible, néons */
 if(cfg.p.tips&&!sp.ev){const a=AP('exhaust');if(a){const rz=R.rear(Math.min(.0,a.x),Math.max(.1,a.y)),z0=rz?rz.z:-L/2;const id=cfg.p.tips,mt=id==='tp1'?phong(0xdde1e6,{sh:140,sp:0xffffff}):id==='tp3'?phong(0x6f78c0,{sh:120,sp:0xaab8ff}):id==='tp4'?phong(0x15161a,{sh:60}):phong(0xc4c8ce,{sh:120,sp:0xeeeeee});
   const cy=(r,x,y)=>{const g=cached('tip|'+r,()=>new T.CylinderGeometry(r,r*.92,.2,14,1,true));add(g,mt,x,y,z0-.045,PI/2,0,0);
    const d=cached('tipd|'+r,()=>new T.CircleGeometry(r*.82,12));add(d,dark,x,y,z0+.04,0,PI,0);};
   if(id==='tp1') cy(.048,a.x,a.y);else if(id==='tp2'){cy(.042,a.x-.1,a.y);cy(.042,a.x+.1,a.y);}else if(id==='tp3'){cy(.05,a.x,a.y);}else{for(const dx of [-.2,-.07,.07,.2]) cy(.034,a.x+dx,a.y);}}}
 if(cfg.p.neon){const c=cfg.neon||0x30c0ff,gt=cached('neon|'+c,()=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,32);
   const cc=new T.Color(c),h='#'+cc.getHexString();g.addColorStop(0,h);g.addColorStop(.55,h+'aa');g.addColorStop(1,h+'00');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(cv);});
  const o=add(new T.PlaneGeometry(W*1.25,L*1.15),new T.MeshBasicMaterial({map:gt,transparent:true,opacity:.85,depthWrite:false,blending:T.AdditiveBlending}),0,.015,0,-PI/2,0,0,'neon');}
 if(grp.children.length) mesh.add(grp);else st.group=null; /* voiture d'origine : rien à ajouter */
 return true;}
api.apply=apply;
function stripeSegs(RN,x,L){const segs=[];let cur=[],py=null;
 for(let z=L/2-.05;z>-L/2+.04;z-=.05){const h=RN.top(x,z,3);if(!h||(py!=null&&Math.abs(h.y-py)>.1)){if(cur.length>2) segs.push(cur);cur=[];py=null;if(!h) continue;}
  cur.push(h);py=h.y;}
 if(cur.length>2) segs.push(cur);return segs;}

/* ─ kits carrosserie : tout est posé par rapport à des points retrouvés sur la carrosserie ─ */
function buildKit(mesh,cfg,fx,k){
 const {R,RN,box,add,bodyMat,dark,carb,L,W,H,hw,u,AP,col0}=k,p=cfg.p;
 const body=cfg.paint||cfg.wrap&&cfg.wrap.t==='satin'?phong(cfg.wrap&&cfg.wrap.t==='satin'?cfg.wrap.c:col0,{sh:(PAINTS[cfg.paint&&cfg.paint.f]||PAINTS.brillant).sh,sp:0x333333}):phong(col0,{sh:60,sp:0x333333});
 const hub=n=>{const a=AP(n);return a||new T.Vector3(n[3]==='L'?hw-.1:-hw+.1,.32,n[3]==='R'?0:0);};
 const hFL=hub('hubFL'),hRL=hub('hubRL');
 /* bas du pare-chocs avant : on monte jusqu'à toucher la carrosserie */
 let yb=.14;for(let y=.06;y<.6;y+=.02){const h=R.front(0,y);if(h){yb=y;break;}}
 const fz=(R.front(0,yb+.12)||{z:L/2}).z,rz=(R.rear(0,yb+.12)||{z:-L/2}).z;
 /* aileron : sommet de la malle ou fin du toit */
 if(p.spoiler){
  const id=p.spoiler,sedan=/^(sedan|coupe|mid|rear)$/.test((carOf(u.mdl)||{}).body||'');
  let zm,ym;
  if(sedan){zm=rz+.34;const h=RN.top(0,zm,3);ym=h?h.y:H*.78;}
  else{let top=0;for(let z=rz+.02;z<rz+L*.45;z+=.03){const h=RN.top(0,z,3);if(h) top=Math.max(top,h.y);}
   zm=rz+.2;for(let z=rz+.03;z<rz+L*.45;z+=.02){const h=RN.top(0,z,3);if(h&&h.y>top-.12){zm=z-.04;ym=h.y;break;}}
   if(ym==null){const h=RN.top(0,zm,3);ym=h?h.y:H*.9;}}
  const half=Math.min(hw*.86,(sedan?hw*.8:hw*.75));
  if(id==='sp1'){box(half*1.9,.034,.15,carb,0,ym+.012,zm-.035,-.16,0,0,'spoiler');}
  else if(id==='sp4'){box(half*1.95,.05,.22,body,0,ym+.032,zm-.04,-.34,0,0,'spoiler');for(const s of [-1,1]) box(.025,.09,.2,body,s*half*.97,ym+.03,zm-.04,-.34,0,0);}
  else if(id==='sp2'){const h=sedan?.17:.13;
   for(const s of [-1,1]){box(.05,h,.07,carb,s*half*.62,ym+h/2-.002,zm,0,0,0,'spoiler');box(.012,.14,.34,body,s*half*.99,ym+h+.02,zm-.08);}
   box(half*1.96,.035,.3,carb,0,ym+h+.015,zm-.08,-.1,0,0);}
  else if(id==='sp3'){const h=sedan?.3:.26;
   for(const s of [-1,1]){box(.05,h,.08,carb,s*half*.55,ym+h/2-.002,zm,0,0,0,'spoiler');box(.02,.24,.5,body,s*half,ym+h+.03,zm-.1);}
   box(half*1.96,.04,.4,carb,0,ym+h,zm-.1,-.14,0,0);box(half*1.96,.05,.05,carb,0,ym+h+.05,zm-.27,-.14,0,0);box(half*1.96,.03,.22,carb,0,ym+h+.1,zm-.02,-.28,0,0);}
 }
 /* pare-chocs avant */
 if(p.front){
  const w=p.front==='fr2'?hw*1.82:hw*1.7;
  box(w,.03,.2,carb,0,yb-.01,fz-.0,0,0,0,'splitter');
  if(p.front==='fr2'){
   for(const s of [-1,1]){const h=R.front(s*hw*.74,yb+.14);const z=h?h.z:fz-.1;box(.16,.012,.12,carb,s*hw*.74,yb+.05,z+.03,0,s*.5,0);
    const q=R.front(s*hw*.45,yb+.2);box(.34,.1,.012,dark,s*hw*.5,yb+.2,(q?q.z:fz)+.016);}
   box(hw*.56,.07,.012,dark,0,yb+.17,fz+.004);}
 }
 /* jupes latérales */
 if(p.skirt){
  const zc=(hFL.z+hRL.z)/2,len=Math.abs(hFL.z-hRL.z)*.8,sy=yb+.07;
  for(const s of [-1,1]){const hs=R.side(sy,zc);const x=(hs?hs.x:hw)*s;
   box(.07,.1,len,p.skirt==='sk2'?carb:body,x+s*.015,sy-.01,zc,0,0,0,'skirt');
   if(p.skirt==='sk2') box(.03,.05,len*.92,dark,x+s*.06,sy-.045,zc);}
 }
 /* diffuseur arrière */
 if(p.rear){
  const big=p.rear==='rr2',w=hw*(big?1.15:.95);
  box(w,.02,.26,dark,0,yb+.02,rz-.08,0,0,0,'diffuseur');
  const n=big?7:5;for(let i=0;i<n;i++){const x=(i-(n-1)/2)*(w/(n-1))*.92;box(.014,big?.13:.09,.25,dark,x,yb+.02+(big?.07:.05),rz-.075);}
  if(big) box(w,.016,.12,carb,0,yb+.16,rz-.18,.0,0,0);
 }
 /* élargisseurs d'ailes */
 if(p.arch){
  const wide=p.arch==='ar2',tube=wide?.05:.026;
  for(const n of ['hubFL','hubFR','hubRL','hubRR']){const a=AP(n);if(!a) continue;const s=Math.sign(a.x)||1,rt=(n[3]==='F'?u.wheelR:u.wheelRR)||.32;
   const hs=R.side(a.y+.12,a.z),x=(hs?hs.x:hw)*s,Rr=rt+.045+(wide?.02:0);
   const g=cached('arch|'+Rr.toFixed(3)+'|'+tube,()=>{const t=new T.TorusGeometry(Rr,tube,6,22,PI*1.02);t.rotateY(PI/2);return t;});
   add(g,body,x+s*(wide?.03:.012)+(s>0?fx.wide:-fx.wide)*.5*0,a.y,a.z,0,0,0,'arch');}
 }
 /* capot à ouïes (carbone) */
 if(p.hood==='hd1'){const hl=u.hoodLen||L*.28,zc=(u.bayZ!=null?u.bayZ:fz-hl/2);
  for(const s of [-1,1]) for(let i=0;i<3;i++){const z=zc-.1+i*.07,h=RN.top(s*hw*.32,z,3);if(h) box(.3,.01,.035,dark,s*hw*.32,h.y+.006,z,0,0,0);}
 }
}
/* ═══════════ 4. Achats, pose, conduite ═══════════ */
/* éléments commandables : pièce, peinture, covering, jantes */
const FINISH_NOM={brillant:'brillante',metal:'métallisée',nacre:'nacrée',mat:'mate',satin:'satinée'};
const colName=(c,l)=>{const f=(l||COLORS).find(x=>x[1]===c);return f?f[0].toLowerCase():'#'+c.toString(16).padStart(6,'0');};
function itemName(it){
 if(it.k==='part') return PARTS[it.id].nom;
 if(it.k==='paint') return `Peinture ${FINISH_NOM[it.f]||''} ${colName(it.c)}${it.c2!=null?', toit '+colName(it.c2):''}`;
 if(it.k==='wrap') return `Covering : ${WRAPS[it.t].nom.toLowerCase()}${it.t==='bandes'||it.t==='satin'?' '+colName(it.c):''}`;
 if(it.k==='wheels') return `Jantes ${WHEELS[it.m].nom.toLowerCase()} ${it.i} pouces ${colName(it.c,WCOLORS)}`;
 return 'Réglage';}
api.itemName=itemName;
function quote(model,cfg,it){
 const sp=spec(model),f=pf(sp);let q={nom:itemName(it),price:0,niv:1,mo:30,lieu:'both',booth:false,ok:true,why:[],fn:null,slot:null};
 if(it.k==='part'){const p=PARTS[it.id],ft=fit(model,cfg,it.id);q.price=priceOf(model,it.id);q.niv=p.niv;q.mo=p.mo;q.lieu=p.lieu;q.ok=ft.ok;q.why=ft.why;q.slot=p.slot;
  q.fn=c=>{c.p[p.slot]=p.id;if(p.slot==='susp'){if(p.id==='sus2') c.h=clamp(c.h,-6,1);else c.h=0;}return c;};}
 else if(it.k==='paint'){const F=PAINTS[it.f];if(!F){q.ok=false;return q;}q.price=Math.round((F.prix+(it.c2!=null?BICOLOR_PRIX:0))*f/5)*5;q.niv=F.niv+(it.c2!=null?1:0);q.mo=360+(it.c2!=null?120:0);q.lieu='style';q.booth=true;q.slot='paint';
  q.fn=c=>{c.paint={c:it.c,f:it.f,c2:it.c2==null?null:it.c2};if(c.wrap&&(c.wrap.t==='satin'||c.wrap.t==='chrome')) c.wrap=null;return c;};}
 else if(it.k==='wrap'){const W=WRAPS[it.t];if(!W){q.ok=false;return q;}q.price=Math.round(W.prix*f/5)*5;q.niv=W.niv;q.mo=W.mo;q.lieu='style';q.slot='wrap';q.fn=c=>{c.wrap={t:it.t,c:it.c==null?0x101114:it.c};return c;};}
 else if(it.k==='wheels'){const W=WHEELS[it.m];if(!W){q.ok=false;return q;}q.price=Math.round((W.base+it.i*38)*f/5)*5;q.niv=1+(it.i>=18?1:0)+(it.i>=20?1:0)+(it.i-sp.inch>=3?1:0);q.mo=90;q.lieu='both';q.slot='wheels';
  if(!wheelSizeOK(model,it.i)){q.ok=false;q.why=['trop grandes pour cette voiture ('+maxInch(model)+' pouces maximum)'];}
  if(it.i<14){q.ok=false;q.why=['taille trop petite'];}
  q.fn=c=>{c.wheels={m:it.m,i:it.i,c:it.c};return c;};}
 return q;}
api.quote=(model,it,cfg)=>quote(model,cfg||cfgOf(),it);
/* capacités du lieu : ce qu'on peut faire ici, taux horaire, et si le joueur y est chez lui (pose gratuite, pièces au prix de gros) */
function equipOf(zid){const t=TS();return (t&&t.equip[zid])||{};}
function workZone(){try{const c=MWC.state(),e=c.emp;if(e==='prepa') return 'tune1';if(e==='style') return 'tune2';
  if(e==='proprio'&&c.ownZone) return c.ownZone;if(e==='patron') return 'garage1';}catch(x){}return null;}
function isOwner(zid){try{return !!(typeof MWI!=='undefined'&&MWI.owned(zid));}catch(e){return false;}}
const TAUX={tune1:110,tune2:98};
function caps(zid){
 const z=zid&&MW.zone(zid),eq=equipOf(zid),own=isOwner(zid),wz=workZone();
 const base=zid==='tune1'?{sport:true,style:false,booth:false,bench:true}:zid==='tune2'?{sport:false,style:true,booth:true,bench:false}:{sport:false,style:false,booth:false,bench:false};
 const c={zone:zid,nom:z?z.nom:'',sport:base.sport||!!eq.banc,style:base.style||!!eq.cabine,booth:base.booth||!!eq.cabine,bench:base.bench||!!eq.banc,owner:own,diy:own||wz===zid,
  taux:TAUX[zid]||(()=>{try{return MWI.CAT.find(p=>p.id===zid).taux*1.1;}catch(e){return 85;}})(),equip:eq};
 c.any=c.sport||c.style;return c;}
api.caps=caps;
function offerOf(model,cfg,it,cp){
 const q=quote(model,cfg,it),lvl=level('preparation');
 const lieuOK=q.lieu==='both'?cp.any:(q.lieu==='sport'?cp.sport:cp.style);
 const why=q.why.slice();
 if(!lieuOK) why.push(q.lieu==='sport'?'se pose chez un préparateur équipé d’un banc de puissance':'se pose dans un atelier de style équipé d’une cabine');
 if(q.booth&&!cp.booth) why.push('demande une cabine de peinture');
 const diy=cp.diy&&lvl>=q.niv;
 const part=cp.owner?Math.round(q.price*.75):q.price;
 const labor=diy?0:Math.round(q.mo/60*cp.taux/5)*5;
 const stock=it.k==='part'&&cp.diy&&stk.count(it.id)>0;
 const total=(stock?0:part)+labor;
 return Object.assign(q,{lvl,diy,part,labor,total,stock,ok:q.ok&&lieuOK&&(!q.booth||cp.booth),why,time:diy?Math.max(15,Math.round(q.mo*Math.max(.55,1-.07*(lvl-q.niv)))):q.mo});}
api.offer=(it,zid)=>offerOf(modelOfCur(),cfgOf(),it,caps(zid||nearZone()));
function nearZone(){
 const pc=MW.playerCar(),pl=MW.player();let best=null,bd=1e9;
 for(const z of MW.zones){if(z.type!=='garage') continue;const d=Math.hypot(z.x-pc.x,z.z-pc.z);if(d<bd){bd=d;best=z;}}
 return best&&bd<best.w/2+best.d/2+30?best.id:(pl.zone||null);}
/* installation sur SA voiture */
function install(it,opt){
 opt=opt||{};const t=TS();if(!t) return {ok:false,msg:'Pas de partie.'};
 const model=modelOfCur(),key=keyOf(),cfg=cfgOf(key,true),cp=caps(opt.zone||nearZone());
 const o=offerOf(model,cfg,it,cp);
 if(!o.ok) return {ok:false,msg:o.why[0]?'Impossible : '+o.why[0]+'.':'Impossible.'};
 if(MW.S.money<o.total) return {ok:false,msg:`Il vous faut ${fmt(o.total)}.`};
 let credit=0;
 if(it.k==='part'){const old=cfg.p[PARTS[it.id].slot];if(old) credit=Math.round(priceOf(model,old)*.2);}
 if(o.stock){if(!stk.take(it.id,'perso')) return {ok:false,msg:'Pièce introuvable en stock.'};}
 MW.money(-o.total+credit,'Tuning : '+o.nom);
 o.fn(cfg);t.cars[key]=cfg;
 MW.addMin(o.time);
 if(o.diy) addXp('preparation',Math.round(o.niv*5+10));
 commit(key);
 return {ok:true,msg:`${o.nom} posé.`,total:o.total,time:o.time};}
api.install=install;
function removeSlot(slot,opt){
 const key=keyOf(),cfg=cfgOf(key,true),t=TS(),model=modelOfCur();
 if(slot==='paint'){if(!cfg.paint) return false;cfg.paint=null;}
 else if(slot==='wrap'){if(!cfg.wrap) return false;cfg.wrap=null;}
 else if(slot==='wheels'){if(!cfg.wheels) return false;cfg.wheels=null;}
 else{const id=cfg.p[slot];if(!id) return false;delete cfg.p[slot];if(slot==='susp') cfg.h=0;
  const g=Math.round(priceOf(model,id)*.2);if(g) MW.money(g,'Reprise : '+PARTS[id].nom);
  MW.addMin(Math.round(PARTS[id].mo*.4));
  /* pièces qui n'ont plus leurs prérequis : déposées avec */
  let chg=true;while(chg){chg=false;for(const sl in cfg.p){const rest=Object.assign({},cfg.p);delete rest[sl];const ft=fit(model,Object.assign({},cfg,{p:rest}),cfg.p[sl]);
    if(!ft.ok&&PARTS[cfg.p[sl]].req){say(`${PARTS[cfg.p[sl]].nom} déposé aussi : ${ft.why[0]}.`,'warn');delete cfg.p[sl];chg=true;break;}}}}
 t.cars[key]=cfg;commit(key);return true;}
api.remove=removeSlot;
api.setHeight=(h,st)=>{const key=keyOf(),cfg=cfgOf(key,true);if(cfg.p.susp!=='sus2') return false;cfg.h=clamp(Math.round(h),-6,1);if(st!=null) cfg.stiff=clamp(st,0,1);TS().cars[key]=cfg;commit(key);return true;};
api.setNeon=c=>{const key=keyOf(),cfg=cfgOf(key,true);cfg.neon=c;TS().cars[key]=cfg;commit(key);};
function commit(key){
 key=key||keyOf();if(key===keyOf()){visualNow();refreshDrv();}
 try{MW.emit('tuneChanged',key);}catch(e){}}
function visualNow(){
 const m=MW.playerCar().mesh;if(!m||!m.userData) return;const cfg=cfgOf(keyOf());
 const sig=JSON.stringify(cfg);
 if(!m.userData.tune||m.userData.tune.sig!==sig) apply(m,cfg,{model:modelOfCur()});}
/* réglages de conduite de la voiture du joueur */
function ctDays(key){const t=TS();return t&&t.ct[key]?t.ct[key]-MW.S.day:0;}
function refreshDrv(){
 const D=MW.drv;if(!D||!MW.S) return;const t=TS(),key=keyOf(),model=modelOfCur(),st=stats(model,cfgOf(key)),b=st.drv;
 let eng=1,vm=b.vm;const pn=t.panne[key];
 if(pn){eng=pn.eng;vm=Math.min(vm,22*.75);}
 if(t.ban[key]) eng=0;
 const Reff=relEff(key);if(Reff<30&&!pn) eng*=clamp(.6+Reff/75,.6,1);
 D.vm=vm;D.acc=b.acc;D.brk=b.brk;D.turn=b.turn;D.eng=eng;}
api.refreshDrv=refreshDrv;
api.drive=()=>Object.assign({},MW.drv);
api.status=()=>stats(modelOfCur(),cfgOf(keyOf()));

/* ─ usure, pannes, contrôles ─ */
function relEff(key){const t=TS(),st=stats(modelOfCur(),cfgOf(key));return clamp(st.rel-(t.wear[key]||0)*.6,0,100);}
api.wear=key=>{const t=TS();return t?t.wear[key||keyOf()]||0:0;};
api.reliability=key=>Math.round(relEff(key||keyOf()));
function kmTick(dt){
 const pc=MW.playerCar(),t=TS();if(!t||!MW.player().inCar) return;const v=Math.abs(pc.speed||0);if(v<.3) return;
 const key=keyOf(),st=stats(modelOfCur(),cfgOf(key)),d=v*dt/1000;
 t.stats.km=(t.stats.km||0)+d;
 t.wear[key]=Math.min(100,(t.wear[key]||0)+d*(0.4+Math.max(0,st.rel0)*.11));}
const PANNES=[
 {id:'turbo',when:c=>!!c.p.boost,w:3,nom:'Turbo fatigué',cost:1.6},
 {id:'patine',when:(c,st)=>st.over>0||!!c.p.ecu,w:3,nom:'Embrayage qui patine',cost:1.2},
 {id:'surchauffe',when:c=>!!c.p.ecu,w:2,nom:'Surchauffe moteur',cost:.9},
 {id:'bimasse',when:c=>c.p.fly==='fly',w:2,nom:'Volant moteur fatigué',cost:1.1},
 {id:'culasse',when:(c,st)=>st.rel<40,w:1,nom:'Joint de culasse',cost:2.2},
 {id:'cata',when:c=>c.p.exh==='exh2'||c.p.exh==='exh3',w:1,nom:'Catalyseur détruit',cost:.8}];
function sympOf(id){try{return MWP.SYMP.find(s=>s.id===id)||null;}catch(e){return null;}}
function breakdown(id,force){
 const t=TS();if(!t) return null;const key=keyOf(),cfg=cfgOf(key),st=stats(modelOfCur(),cfg);
 if(t.panne[key]&&!force) return t.panne[key];
 const cand=PANNES.filter(p=>id?p.id===id:p.when(cfg,st));if(!cand.length&&!id) return null;
 const p=id?(PANNES.find(x=>x.id===id)||PANNES[0]):(()=>{let tot=0;for(const c of cand) tot+=c.w;let r=rnd()*tot;for(const c of cand){r-=c.w;if(r<=0) return c;}return cand[0];})();
 const sy=sympOf(p.id),base=Math.round((300+st.ch*1.4)*p.cost/10)*10;
 t.panne[key]={id:p.id,nom:p.nom,txt:sy?sy.txt:p.nom,cost:base,eng:.42,j:MW.S.day};
 refreshDrv();
 say(`Panne : ${p.nom}. « ${t.panne[key].txt} » La voiture est en mode dégradé : réparation estimée ${fmt(base)}.`,'crit');
 try{MW.emit('tunePanne',key,t.panne[key]);}catch(e){}
 return t.panne[key];}
api.breakdown=breakdown;
function repair(opt){
 const t=TS(),key=keyOf(),pn=t.panne[key];if(!pn) return false;
 const cp=caps((opt&&opt.zone)||nearZone()),cost=Math.round(pn.cost*(cp.diy&&cp.owner?.7:1));
 if(MW.S.money<cost){say(`Réparation : il vous faut ${fmt(cost)}.`,'warn');return false;}
 MW.money(-cost,'Réparation : '+pn.nom);MW.addMin(120);delete t.panne[key];t.wear[key]=Math.max(0,(t.wear[key]||0)*.4);refreshDrv();say('Votre voiture est réparée.','good');return true;}
api.repair=repair;
function service(opt){ /* révision : remet l'usure à zéro */
 const t=TS(),key=keyOf(),w=t.wear[key]||0,cp=caps((opt&&opt.zone)||nearZone()),cost=Math.round((60+w*4)*(cp.owner?.7:1));
 if(MW.S.money<cost){say(`Révision : il vous faut ${fmt(cost)}.`,'warn');return false;}
 MW.money(-cost,'Révision de la voiture préparée');MW.addMin(90);t.wear[key]=0;refreshDrv();say('Révision faite : usure remise à zéro.','good');return true;}
api.service=service;
function tow(){
 let best=null,bd=1e9;const pc=MW.playerCar();
 for(const id of ['tune1','tune2']){const z=MW.zone(id);if(!z) continue;const d=Math.hypot(z.porte.x-pc.x,z.porte.z-pc.z);if(d<bd){bd=d;best=z;}}
 if(!best) return;const r=best.ry;
 MW.teleport(best.porte.x+Math.sin(r)*4,best.porte.z+Math.cos(r)*4,r+PI);say(`La dépanneuse remorque votre voiture devant ${best.court}.`,'info');}
api.tow=tow;
/* contrôle technique : valable 30 jours de jeu s'il n'y a aucune infraction grave */
function ct(){
 const t=TS(),key=keyOf(),st=stats(modelOfCur(),cfgOf(key)),bad=st.legal.filter(x=>!x.soft);
 if(MW.S.money<78){say('Contrôle technique : 78 € à prévoir.','warn');return {ok:false,legal:st.legal};}
 MW.money(-78,'Contrôle technique');MW.addMin(40);
 if(bad.length){say(`Contrôle technique refusé : ${bad[0].txt}.`,'crit');return {ok:false,legal:st.legal};}
 t.ct[key]=MW.S.day+30;say('Contrôle technique passé : valable 30 jours, la police vous laissera tranquille.','good');return {ok:true,legal:st.legal};}
api.ct=ct;
function police(force){
 const t=TS(),key=keyOf(),st=stats(modelOfCur(),cfgOf(key)),inf=st.legal;if(!inf.length&&!force) return null;
 const n=inf.reduce((a,x)=>a+x.g,0),valid=ctDays(key)>0;
 let fine=Math.round((68+55*n)*(valid?.5:1)*(.9+rnd()*.3));if(!inf.length) fine=0;
 const grave=n>=4&&!valid;
 t.stats.fines=R2((t.stats.fines||0)+fine);
 if(fine) MW.money(-Math.min(fine,Math.max(0,MW.S.money)),'Amende : contrôle de police');
 if(grave){t.ban[key]=MW.S.day;refreshDrv();}
 const h=`<p>Les gendarmes contrôlent votre voiture.</p>${inf.length?'<ul class="mw-cond">'+inf.map(x=>`<li class="no">${esc(x.txt)}<br><small>${esc(x.fix)}</small></li>`).join('')+'</ul>':'<p>Rien à signaler.</p>'}<p>Amende : <b>${esc(fmt(fine))}</b>${valid?' (réduite : contrôle technique valable)':''}.</p>${grave?'<p class="mw-soon">Voiture immobilisée : une dépanneuse la remorque à l’atelier. Remettez-la en conformité pour reprendre la route.</p>':''}<div class="mw-btns">${btn('close','Compris')}</div>`;
 MW.panel('Contrôle de police',h,{onClick:a=>{if(a==='close') MW.closePanel();},onClose:()=>{if(grave) setTimeout(tow,300);}});
 return {fine,grave,inf};}
api.police=police;
function banCheck(){const t=TS(),key=keyOf();if(!t||!t.ban[key]) return;
 const st=stats(modelOfCur(),cfgOf(key));if(!st.legal.some(x=>!x.soft&&x.g>=2)){delete t.ban[key];refreshDrv();say('Votre voiture est de nouveau en règle : vous pouvez reprendre la route.','good');}}
function onMinute(){
 const t=TS();if(!t||!MW.S) return;
 const pl=MW.player(),pc=MW.playerCar(),key=keyOf(),cfg=cfgOf(key);
 banCheck();
 if(api.hasard===false||!pl.inCar||Math.abs(pc.speed||0)<3) return; /* api.hasard=false : pas de panne ni de contrôle au hasard (tests) */
 const st=stats(modelOfCur(),cfg),R=relEff(key);
 if(!t.panne[key]&&R<85&&!t.ban[key]){const pb=(85-R)/85*.0045;if(rnd()<pb) breakdown();}
 if(st.legal.length&&!t.ban[key]&&!pl.zone&&!t.panne[key]){const n=st.legal.reduce((a,x)=>a+x.g,0),valid=ctDays(key)>0;if(rnd()<.006*n*(valid?.4:1)) police();}}

/* ═══════════ 5. Son du moteur (plus grave avec l'échappement sport), adaptateur de stock, banc de puissance ═══════════ */
let AU=null,AUinit=false;
function audio(){
 if(AU||AUinit) return AU;AUinit=true;
 try{const A=window.AudioContext||window.webkitAudioContext;if(!A) return null;const c=new A(),o1=c.createOscillator(),o2=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
  o1.type='sawtooth';o2.type='square';f.type='lowpass';f.frequency.value=400;g.gain.value=0;o1.connect(f);o2.connect(f);f.connect(g);g.connect(c.destination);o1.start();o2.start();AU={c,o1,o2,f,g};}catch(e){AU=null;}
 return AU;}
let sndNow={f:0,gain:0,snd:0};
function soundTick(dt){
 const pl=MW.player(),t=TS();if(!t) return;
 const on=pl.inCar&&!MW.paused&&MW.isOpen();
 const st=on?stats(modelOfCur(),cfgOf(keyOf())):null,snd=st?Math.min(1,st.fx.snd):0;
 const v=on?Math.abs(MW.playerCar().speed||0):0,th=on?1:0;
 const f=(34+v*3.4)*(1-.38*snd)*(t.panne[keyOf()]?.8:1);
 sndNow={f:Math.round(f*10)/10,gain:on?(.025+.03*Math.min(1,v/12)+.02*snd):0,snd:R2(snd)};
 if(!AU&&!on) return;
 const a=audio();if(!a) return;
 try{if(a.c.state==='suspended'&&on) a.c.resume();
  const tm=a.c.currentTime;a.o1.frequency.setTargetAtTime(f,tm,.06);a.o2.frequency.setTargetAtTime(f*.5,tm,.06);a.f.frequency.setTargetAtTime(240+420*(1-.5*snd)+v*12,tm,.1);a.g.gain.setTargetAtTime(sndNow.gain,tm,.1);}catch(e){}}
api.sound=()=>Object.assign({},sndNow);

const stk={
 m(){return typeof MWST!=='undefined'&&MWST?MWST:null;},
 f(names){const m=stk.m();if(!m) return null;for(const n of names) if(typeof m[n]==='function') return m[n].bind(m);return null;},
 count(id){try{const f=stk.f(['count','qty','have','stockOf']);return f?(+f('tune:'+id)||0):0;}catch(e){return 0;}},
 take(id,who){try{const f=stk.f(['take','use','remove']);if(!f) return false;const r=f('tune:'+id,1,who);return !!r;}catch(e){return false;}},
 order(id,n){try{const f=stk.f(['order','commander','buy']);if(!f) return false;f('tune:'+id,n||1);return true;}catch(e){return false;}},
 register(){try{const f=stk.f(['register','addCatalog','catalogue']);if(f) f(LIST.map(p=>({id:'tune:'+p.id,nom:p.nom,prix:p.prix,cat:'tuning',niv:p.niv})));}catch(e){}},
 has(){return !!stk.m();}};
api.stk=stk;

/* courbes de puissance et de couple (banc) : forme selon le type de moteur et les pièces */
function curves(model,cfg){
 const sp=spec(model),st=stats(model,cfg),n=40,red=sp.rpm*(1+(cfg.p.ecu?cfg.p.ecu==='ecu3'?.05:.03:0)),pts=[];
 const boost=sp.asp==='turbo'||sp.asp==='biturbo'||cfg.p.boost;
 const sh=x=>{ /* forme du couple, 0..1 */
  if(sp.ev) return x<.15?x/.15:Math.max(0,1-Math.pow(Math.max(0,x-.35)/.75,2));
  if(cfg.p.boost==='cmp') return clamp(.78+.22*Math.min(1,x*1.6)-Math.pow(Math.max(0,x-.74),2)*5.5,0,1);
  if(boost){const r=clamp((x-.17)/.2,0,1),rr=r*r*(3-2*r);return clamp(rr*(1-Math.pow(Math.max(0,x-.66)/.5,2)*1.4),0,1);}
  return clamp(1-Math.pow((x-.64)/.6,2)*1.5-(x<.25?(.25-x)*1.2:0),0,1);};
 let mxT=0,mxP=0,raw=[];
 for(let i=0;i<=n;i++){const x=.14+.86*i/n,rpm=x*red;let T=sh(x);if(cfg.p.exh&&x>.7) T*=1+(cfg.p.exh==='exh3'?.05:.025)*(x-.7)/.3;if(cfg.p.adm&&x>.6) T*=1+.02*(x-.6)/.4;
  raw.push([rpm,T,T*rpm]);mxT=Math.max(mxT,T);mxP=Math.max(mxP,T*rpm);}
 for(const [rpm,T,P] of raw) pts.push({rpm:Math.round(rpm),nm:Math.round(T/mxT*st.nm),ch:Math.round(P/mxP*st.ch)});
 let pk=pts[0],tk=pts[0];for(const p of pts){if(p.ch>pk.ch) pk=p;if(p.nm>tk.nm) tk=p;}
 return {pts,peakCh:pk.ch,peakChRpm:pk.rpm,peakNm:tk.nm,peakNmRpm:tk.rpm,red};}
api.curves=(model,cfg)=>curves(model||modelOfCur(),cfg||cfgOf());
function drawCurves(cv,a,b,prog){
 const x=cv.getContext('2d'),W=cv.width,H=cv.height,pad=34;x.clearRect(0,0,W,H);
 x.fillStyle='#0c1624';x.fillRect(0,0,W,H);
 const mxCh=Math.max(a.peakCh,b.peakCh)*1.12,mxNm=Math.max(a.peakNm,b.peakNm)*1.12,rmax=Math.max(a.red,b.red),X=r=>pad+r/rmax*(W-pad*2),YC=v=>H-pad-v/mxCh*(H-pad*2),YN=v=>H-pad-v/mxNm*(H-pad*2);
 x.strokeStyle='rgba(255,255,255,.1)';x.lineWidth=1;x.font='11px sans-serif';x.fillStyle='#8fa6c0';x.textAlign='center';
 for(let r=1000;r<rmax;r+=1000){x.beginPath();x.moveTo(X(r),pad/2);x.lineTo(X(r),H-pad);x.stroke();x.fillText(String(r),X(r),H-pad+14);}
 for(let i=0;i<=4;i++){const y=pad/2+(H-pad*1.5)*i/4;x.beginPath();x.moveTo(pad,y);x.lineTo(W-pad,y);x.stroke();}
 x.textAlign='left';x.fillStyle='#ffb800';x.fillText('ch',4,14);x.textAlign='right';x.fillStyle='#4ac8ff';x.fillText('Nm',W-4,14);
 const line=(c,key,Y,col,dash,w2)=>{x.beginPath();x.strokeStyle=col;x.lineWidth=w2||2;x.setLineDash(dash||[]);let first=true;const lim=Math.round(c.pts.length*prog);
  c.pts.forEach((p,i)=>{if(i>lim) return;const px=X(p.rpm),py=Y(p[key]);if(first){x.moveTo(px,py);first=false;}else x.lineTo(px,py);});x.stroke();x.setLineDash([]);};
 line(a,'ch',YC,'#7a6a30',[5,4],2);line(a,'nm',YN,'#2a6a88',[5,4],2);
 line(b,'ch',YC,'#ffb800',null,3);line(b,'nm',YN,'#4ac8ff',null,3);}
let dynoSt=null;
function dynoPanel(opt){
 opt=opt||{};const model=modelOfCur(),key=keyOf(),after=opt.cfg||cfgOf(key),before=emptyCfg(),a=curves(model,before),b=curves(model,after),st0=stats(model,before),st1=stats(model,after);
 const t=TS();t.stats.dyno=(t.stats.dyno||0)+1;
 const h=`<div class="tn-dyno"><canvas id="tnDyno" width="620" height="260"></canvas></div>
 <div class="mw-card"><div class="mw-row"><span>Puissance maxi</span><b>${a.peakCh} ch → <span class="tn-up">${b.peakCh} ch</span> (${b.peakChRpm} tr/min)</b></div>
 <div class="mw-row"><span>Couple maxi</span><b>${a.peakNm} Nm → <span class="tn-up">${b.peakNm} Nm</span> (${b.peakNmRpm} tr/min)</b></div>
 <div class="mw-row"><span>0 à 100 km/h</span><b>${st0.t100s.toFixed(1)} s → ${st1.t100.toFixed(1)} s</b></div>
 <div class="mw-row"><span>Poids</span><b>${st0.sp.mass} kg → ${st1.mass} kg</b></div>
 <div class="mw-row"><span>Niveau sonore</span><b>${st0.db} dB → ${st1.db} dB</b></div></div>
 <p class="hint">Trait plein : votre voiture préparée. Pointillés : d’origine.</p><div class="mw-btns">${btn('back','Retour au menu','ghost')}${btn('close','Fermer','ghost')}</div>`;
 MW.panel('Banc de puissance',h,{wide:true,onClick:a2=>{if(a2==='back'&&opt.back) opt.back();else if(a2==='close'||a2==='back') MW.closePanel();},onClose:()=>{if(dynoSt) cancelAnimationFrame(dynoSt.raf);dynoSt=null;}});
 const cv=document.getElementById('tnDyno');if(!cv) return {a,b,st0,st1};
 dynoSt={raf:0};let p0=null;
 const step=ts=>{if(!dynoSt||!document.body.contains(cv)) return;if(p0==null) p0=ts;const pr=Math.min(1,(ts-p0)/1600);drawCurves(cv,a,b,pr);if(pr<1) dynoSt.raf=requestAnimationFrame(step);};
 drawCurves(cv,a,b,.02);dynoSt.raf=requestAnimationFrame(step);
 return {a,b,st0,st1};}
api.dyno=dynoPanel;

/* ═══════════ 6. Menu de tuning avec aperçu 3D en direct ═══════════ */
let cssDone=false;
function css(){if(cssDone) return;cssDone=true;const s=document.createElement('style');s.textContent=`
.tn-wrap{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}
.tn-left{flex:1 1 300px;min-width:250px;display:flex;flex-direction:column;gap:8px}
.tn-right{flex:1.35 1 330px;min-width:270px;display:flex;flex-direction:column;gap:8px}
.tn-view{position:relative;width:100%;aspect-ratio:16/10;background:#16263c;border:1px solid #35506f;border-radius:4px;overflow:hidden;touch-action:none;cursor:grab}
.tn-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.tn-view i{position:absolute;left:8px;bottom:6px;font-size:11px;color:#9db3cc;font-style:normal;pointer-events:none}
.tn-views,.tn-tabs{display:flex;gap:4px;flex-wrap:wrap}
.tn-tab,.tn-vb{background:rgba(255,255,255,.06);color:#e8f0f8;border:1px solid #5a7697;border-radius:3px;padding:4px 9px;font:600 12.5px/1.2 inherit;cursor:pointer}
.tn-tab.on{background:#ffb800;color:#10233d;border-color:#ffb800}
.tn-vb{font-size:11.5px;padding:3px 7px}
.tn-list{display:flex;flex-direction:column;gap:6px;max-height:min(54vh,460px);overflow-y:auto;padding-right:2px}
.tn-h{margin:6px 0 0;font-size:13px;color:#ffd466;font-weight:700}
.tn-item{display:flex;gap:8px;align-items:center;justify-content:space-between;background:rgba(255,255,255,.05);border:1px solid #35506f;border-radius:4px;padding:6px 8px}
.tn-item.on{border-color:#3ccf6a;background:rgba(60,207,106,.1)}
.tn-item.no{opacity:.55}
.tn-item small{display:block;color:#9db3cc;line-height:1.3}
.tn-item .tn-btns{display:flex;gap:4px;flex:none;flex-wrap:wrap;justify-content:flex-end}
.tn-st{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center;font-size:12.5px}
.tn-st b{font-variant-numeric:tabular-nums;text-align:right}
.tn-bar{height:7px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;position:relative}
.tn-bar i{position:absolute;left:0;top:0;bottom:0;background:#3a8aff}
.tn-bar u{position:absolute;top:0;bottom:0;background:rgba(60,207,106,.9)}
.tn-bar u.dn{background:rgba(255,120,60,.9)}
.tn-up{color:#3ccf6a}.tn-dn{color:#ff8a4a}
.tn-sw{display:flex;gap:4px;flex-wrap:wrap}
.tn-sw button{width:26px;height:26px;border-radius:50%;border:2px solid #5a7697;cursor:pointer;padding:0}
.tn-sw button.on{border-color:#ffb800;box-shadow:0 0 0 2px #ffb800}
.tn-dyno canvas{width:100%;height:auto;display:block;border:1px solid #35506f;border-radius:4px}
.tn-ch{display:flex;gap:4px;flex-wrap:wrap}
.tn-ch button{background:rgba(255,255,255,.06);color:#e8f0f8;border:1px solid #5a7697;border-radius:3px;padding:3px 8px;font-size:12px;cursor:pointer}
.tn-ch button.on{background:#ffb800;color:#10233d;border-color:#ffb800}
.tn-range{width:100%}
`;document.head.appendChild(s);}

/* ─ visionneuse 3D : sa propre scène, indépendante du monde ─ */
function makeViewer(host,model,color,plate){
 const cv=document.createElement('canvas');host.appendChild(cv);
 let R=null;try{R=new T.WebGLRenderer({canvas:cv,antialias:true});}catch(e){return null;}
 R.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 const sc=new T.Scene();sc.background=new T.Color(0x24344a);
 sc.add(new T.HemisphereLight(0xdfeaff,0x4a4e56,.95));const d=new T.DirectionalLight(0xffffff,.85);d.position.set(5,8,6);sc.add(d);const d2=new T.DirectionalLight(0xaac4ff,.35);d2.position.set(-6,3,-5);sc.add(d2);
 const fl=new T.Mesh(new T.CircleGeometry(6,48),new T.MeshLambertMaterial({color:0x3a4048}));fl.rotation.x=-PI/2;sc.add(fl);
 const ring=new T.Mesh(new T.RingGeometry(3.3,3.4,48),new T.MeshBasicMaterial({color:0xffb800,side:T.DoubleSide}));ring.rotation.x=-PI/2;ring.position.y=.01;sc.add(ring);
 let car=MW.carMesh({model,color,plate:plate||'TU-NE-58',bay:false});sc.add(car);
 const cam=new T.PerspectiveCamera(38,1.6,.1,100);
 const V={R,sc,cam,car,az:.9,el:.2,dist:(car.userData.L||4.2)*1.4,tg:new T.Vector3(0,.6,0),goal:null,raf:0,auto:true,dead:false,drag:null};
 const upd=()=>{const w=Math.max(2,host.clientWidth),h=Math.max(2,host.clientHeight);R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();};
 const place=()=>{const c=Math.cos(V.el),x=V.tg.x+Math.sin(V.az)*c*V.dist,z=V.tg.z+Math.cos(V.az)*c*V.dist,y=V.tg.y+Math.sin(V.el)*V.dist;cam.position.set(x,y,z);cam.lookAt(V.tg);};
 const loop=()=>{if(V.dead) return;V.raf=requestAnimationFrame(loop);
  if(!document.body.contains(cv)){V.dispose();return;}
  if(V.goal){const g=V.goal,k=.12;V.az+=angd(V.az,g.az)*k;V.el+=(g.el-V.el)*k;V.dist+=(g.dist-V.dist)*k;V.tg.lerp(g.tg,k);if(Math.abs(angd(V.az,g.az))<.003&&Math.abs(g.el-V.el)<.003&&Math.abs(g.dist-V.dist)<.01) V.goal=null;}
  else if(V.auto&&!V.drag) V.az+=.004;
  upd();place();R.render(sc,cam);};
 const angd=(a,b)=>{let x=b-a;while(x>PI) x-=TAU;while(x<-PI) x+=TAU;return x;};
 host.addEventListener('pointerdown',e=>{V.drag={x:e.clientX,y:e.clientY};V.auto=false;V.goal=null;try{host.setPointerCapture(e.pointerId);}catch(x){}});
 host.addEventListener('pointermove',e=>{if(!V.drag) return;V.az-=(e.clientX-V.drag.x)*.01;V.el=clamp(V.el+(e.clientY-V.drag.y)*.006,-.05,1.3);V.drag={x:e.clientX,y:e.clientY};});
 const up=()=>{V.drag=null;};host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);
 host.addEventListener('wheel',e=>{e.preventDefault();V.dist=clamp(V.dist*(1+Math.sign(e.deltaY)*.08),3.2,11);},{passive:false});
 V.setCfg=c=>{apply(car,c,{model});};
 V.view=n=>{const u=car.userData,L=u.L||4.2,hub=u.anchors&&u.anchors.hubFL?u.anchors.hubFL.position:new T.Vector3(.8,.32,1.3);
  const G={'3q':{az:.9,el:.2,dist:L*1.4,tg:new T.Vector3(0,.6,0)},'avant':{az:0,el:.12,dist:L*1.3,tg:new T.Vector3(0,.6,0)},'arriere':{az:PI,el:.14,dist:L*1.3,tg:new T.Vector3(0,.65,0)},
   'cote':{az:PI/2,el:.05,dist:L*1.45,tg:new T.Vector3(0,.55,0)},'roue':{az:PI/2-.35,el:.08,dist:2.3,tg:new T.Vector3(hub.x,hub.y,hub.z)},'dessus':{az:.4,el:1.25,dist:L*1.9,tg:new T.Vector3(0,.3,0)}};
  V.goal=G[n]||G['3q'];V.auto=false;};
 V.dispose=()=>{if(V.dead) return;V.dead=true;cancelAnimationFrame(V.raf);try{clear(car);sc.remove(car);R.dispose();R.forceContextLoss&&R.forceContextLoss();}catch(e){}if(cv.parentNode) cv.parentNode.removeChild(cv);};
 upd();place();V.raf=requestAnimationFrame(loop);
 return V;}
api._viewer=()=>MS&&MS.v;
let MS=null;
const pctUp=(a,b,hi)=>{const d=b-a;return Math.abs(d)<1e-9?'':`<span class="${(d>0)===hi?'tn-up':'tn-dn'}">${d>0?'+':''}${Math.round(d*10)/10}</span>`;};
function statRows(model,cur,pre){
 const A=stats(model,cur),B=pre?stats(model,pre):A;
 const row=(nom,a,b,unit,hi,max)=>{const w1=clamp(a/max*100,0,100),w2=clamp(b/max*100,0,100),diff=b-a;
  return `<span>${nom}</span><div class="tn-bar"><i style="width:${Math.min(w1,w2)}%"></i>${diff?`<u class="${(diff>0)===hi?'':'dn'}" style="left:${Math.min(w1,w2)}%;width:${Math.abs(w2-w1)}%"></u>`:''}</div><b>${Math.round(b*10)/10}${unit} ${diff?pctUp(a,b,hi):''}</b>`;};
 return `<div class="tn-st">${row('Puissance',A.ch,B.ch,' ch',true,Math.max(350,B.ch*1.1))}${row('Couple',A.nm,B.nm,' Nm',true,Math.max(450,B.nm*1.1))}${row('Poids',A.mass,B.mass,' kg',false,2000)}${row('0 à 100',A.t100,B.t100,' s',false,16)}${row('Vitesse maxi',A.vmax,B.vmax,' km/h',true,330)}${row('Freinage',A.brake*100,B.brake*100,' %',true,220)}${row('Tenue',A.turn*100,B.turn*100,' %',true,175)}${row('Fiabilité',A.rel,B.rel,' %',true,100)}${row('Bruit',A.db,B.db,' dB',false,120)}</div>
 <p class="hint">Conduite en ville : accélération ${B.drv.acc>=1?'+':''}${Math.round((B.drv.acc-1)*100)} %, vitesse maxi ${Math.round(B.drv.vm*3.6)} km/h (d’origine ${Math.round(22*3.6)}), freinage ${B.drv.brk>=1?'+':''}${Math.round((B.drv.brk-1)*100)} %, tenue ${B.drv.turn>=1?'+':''}${Math.round((B.drv.turn-1)*100)} %.</p>${B.legal.length?`<p class="mw-soon">⚠ ${B.legal.length} point${B.legal.length>1?'s':''} non conforme${B.legal.length>1?'s':''} : ${esc(B.legal.map(x=>x.txt).join(' · '))}</p>`:''}`;}
const clone=o=>JSON.parse(JSON.stringify(o));
function previewCfg(){const cfg=clone(cfgOf());if(MS.prev){const q=quote(MS.model,cfg,MS.prev);if(q.fn) q.fn(cfg);}return cfg;}
function badge(txt,cls){return `<span class="mw-tag${cls?' '+cls:''}">${txt}</span>`;}
function partRow(model,cfg,p,cp){
 const it={k:'part',id:p.id},o=offerOf(model,cfg,it,cp),on=cfg.p[p.slot]===p.id,pv=MS.prev&&MS.prev.k==='part'&&MS.prev.id===p.id;
 const why=o.ok?'':o.why[0]||'';
 const tags=[];if(o.niv>o.lvl&&cp.diy) tags.push(badge('niveau '+o.niv+' requis pour la pose par vous','warn'));
 const price=on?'posée':(o.stock?`${esc(fmt(o.labor))} (pièce en stock)`:esc(fmt(o.total)));
 return `<div class="tn-item${on?' on':''}${o.ok||on?'':' no'}"><div><b>${esc(p.nom)}</b><small>${esc(p.txt)}</small><small>${on?'':`pièce ${esc(fmt(o.part))}${o.labor?' + pose '+esc(fmt(o.labor)):' · pose par vos soins'} · ${o.time} min · niveau ${p.niv}`}${why?` · <span class="tn-dn">${esc(why)}</span>`:''}</small></div>
  <div class="tn-btns">${on?btn('rm:'+p.slot,'Déposer','sm ghost'):btn('view:'+p.id,pv?'Masquer':'Voir','sm ghost',false)+btn('buy:'+p.id,esc(fmt(o.total)),'sm',!o.ok||MW.S.money<o.total)}</div></div>`;}
function slotBlock(model,cfg,slot,cp){
 const ps=LIST.filter(p=>p.slot===slot&&!(spec(model).ev&&p.ice));if(!ps.length) return '';
 return `<div class="tn-h">${esc(SLOTS[slot])}</div>`+ps.map(p=>partRow(model,cfg,p,cp)).join('');}
const swatches=(list,cur,pre)=>`<div class="tn-sw">${list.map(([n,c])=>`<button type="button" data-mw="${pre}:${c}" title="${esc(n)}" class="${c===cur?'on':''}" style="background:#${c.toString(16).padStart(6,'0')}"></button>`).join('')}</div>`;
function tabList(){
 const model=MS.model,cfg=cfgOf(),cp=MS.cp,t=MS.tab;let h='';
 if(t==='perf'){h+=cp.sport?'':`<p class="mw-soon">Cet atelier n’a pas de banc de puissance : les pièces moteur se posent chez un préparateur (Prépa Vallon) ou dans votre garage équipé.</p>`;
  for(const s of ORDER_PERF) h+=slotBlock(model,cfg,s,cp);
  if(cfg.p.susp==='sus2') h+=`<div class="tn-h">Réglage des combinés filetés</div><div class="mw-card"><label>Hauteur de caisse : <b id="tnHv">${cfg.h>0?'+':''}${cfg.h} cm</b><input class="tn-range" id="tnH" type="range" min="-6" max="1" step="1" value="${cfg.h}"></label><label>Dureté : <b id="tnSv">${Math.round(cfg.stiff*100)} %</b><input class="tn-range" id="tnS" type="range" min="0" max="100" step="5" value="${Math.round(cfg.stiff*100)}"></label></div>`;}
 else if(t==='style'){h+=cp.style?'':`<p class="mw-soon">Les kits et accessoires se posent à l’Atelier Éclat ou dans un garage équipé d’une cabine.</p>`;
  for(const s of ORDER_STYLE) h+=slotBlock(model,cfg,s,cp);
  if(cfg.p.neon) h+=`<div class="tn-h">Couleur des néons</div>${swatches(COLORS,cfg.neon,'neon')}`;}
 else if(t==='paint'){
  const P=MS.paint,F=PAINTS[P.f],o=offerOf(model,cfg,{k:'paint',f:P.f,c:P.c,c2:P.two?P.c2:null},cp);
  h+=`<div class="tn-h">Finition</div><div class="tn-ch">${Object.keys(PAINTS).map(f=>`<button type="button" data-mw="pf:${f}" class="${f===P.f?'on':''}">${PAINTS[f].nom}</button>`).join('')}</div>`;
  h+=`<div class="tn-h">Couleur</div>${swatches(COLORS,P.c,'pc')}`;
  h+=`<div class="tn-h">Bicolore</div><div class="tn-ch"><button type="button" data-mw="ptwo:${P.two?0:1}" class="${P.two?'on':''}">Toit et capot d’une autre couleur</button></div>${P.two?swatches(COLORS,P.c2,'pc2'):''}`;
  h+=`<div class="tn-item"><div><b>${esc(o.nom)}</b><small>${esc(fmt(o.part))}${o.labor?' + main-d’œuvre '+esc(fmt(o.labor)):''} · ${o.time} min · niveau ${o.niv} · cabine de peinture${cp.booth?'':' <span class="tn-dn">(absente ici)</span>'}</small>${o.ok?'':`<small class="tn-dn">${esc(o.why[0]||'')}</small>`}</div><div class="tn-btns">${cfg.paint?btn('rm:paint','Retirer','sm ghost'):''}${btn('buy:paint','Peindre · '+esc(fmt(o.total)),'sm',!o.ok||MW.S.money<o.total)}</div></div>`;
  h+=`<div class="tn-h">Covering (film adhésif)</div>`;
  for(const w in WRAPS){const W=WRAPS[w],ow=offerOf(model,cfg,{k:'wrap',t:w,c:MS.wrapC},cp),on=cfg.wrap&&cfg.wrap.t===w;
   h+=`<div class="tn-item${on?' on':''}${ow.ok?'':' no'}"><div><b>${esc(W.nom)}</b><small>${on?'posé':esc(fmt(ow.part))+(ow.labor?' + pose '+esc(fmt(ow.labor)):'')+' · '+ow.time+' min · niveau '+W.niv}</small></div><div class="tn-btns">${on?btn('rm:wrap','Retirer','sm ghost'):btn('wview:'+w,MS.prev&&MS.prev.k==='wrap'&&MS.prev.t===w?'Masquer':'Voir','sm ghost')+btn('wbuy:'+w,esc(fmt(ow.total)),'sm',!ow.ok||MW.S.money<ow.total)}</div></div>`;}
  h+=`<div class="tn-h">Couleur du film (satiné, bandes)</div>${swatches(COLORS,MS.wrapC,'wc')}`;}
 else if(t==='wheels'){
  const W=MS.wh,sp=spec(model),mx=maxInch(model),o=offerOf(model,cfg,{k:'wheels',m:W.m,i:W.i,c:W.c},cp);
  h+=`<div class="tn-h">Modèle de jantes</div><div class="tn-ch">${Object.keys(WHEELS).map(m=>`<button type="button" data-mw="wm:${m}" class="${m===W.m?'on':''}">${WHEELS[m].nom}</button>`).join('')}</div>`;
  h+=`<div class="tn-h">Taille (d’origine ${sp.inch} pouces)</div><div class="tn-ch">${[15,16,17,18,19,20].filter(i=>i<=mx&&i>=Math.max(14,sp.inch-2)).map(i=>`<button type="button" data-mw="wi:${i}" class="${i===W.i?'on':''}">${i}"</button>`).join('')}</div>`;
  h+=`<div class="tn-h">Couleur</div>${swatches(WCOLORS,W.c,'wcol')}`;
  h+=`<div class="tn-item"><div><b>${esc(o.nom)}</b><small>${esc(fmt(o.part))}${o.labor?' + pose '+esc(fmt(o.labor)):''} · ${o.time} min · niveau ${o.niv}</small>${o.ok?'':`<small class="tn-dn">${esc(o.why[0]||'')}</small>`}</div><div class="tn-btns">${cfg.wheels?btn('rm:wheels','Retirer','sm ghost'):''}${btn('buy:wheels','Monter · '+esc(fmt(o.total)),'sm',!o.ok||MW.S.money<o.total)}</div></div>`;
  h+=`<p class="hint">Plus les jantes sont grandes, plus le pneu est bas : look et tenue gagnent, le confort et le poids non suspendu aussi.</p>`;}
 else if(t==='bilan'){h+=bilan(model,cfg,cp);}
 return h;}
function bilan(model,cfg,cp){
 const st=stats(model,cfg),key=keyOf(),t=TS(),pn=t.panne[key],wear=Math.round(t.wear[key]||0),inst=[];
 for(const s of ORDER_PERF.concat(ORDER_STYLE)) if(cfg.p[s]) inst.push([s,PARTS[cfg.p[s]].nom]);
 if(cfg.paint) inst.push(['paint',itemName({k:'paint',f:cfg.paint.f,c:cfg.paint.c,c2:cfg.paint.c2})]);
 if(cfg.wrap) inst.push(['wrap',itemName({k:'wrap',t:cfg.wrap.t,c:cfg.wrap.c})]);
 if(cfg.wheels) inst.push(['wheels',itemName({k:'wheels',m:cfg.wheels.m,i:cfg.wheels.i,c:cfg.wheels.c})]);
 let h=`<div class="mw-card"><div class="mw-row"><span>Fiabilité</span><b>${Math.round(relEff(key))} % <small>(d’origine 100 %, usure ${wear} %)</small></b></div>
  <div class="mw-row"><span>Contrôle technique</span><b>${ctDays(key)>0?'valable encore '+ctDays(key)+' jours':'non passé'}</b></div>
  <div class="mw-row"><span>Conformité</span><b>${st.legal.length?`<span class="tn-dn">${st.legal.length} infraction${st.legal.length>1?'s':''}</span>`:'<span class="tn-up">en règle</span>'}</b></div></div>`;
 if(st.legal.length) h+='<ul class="mw-cond">'+st.legal.map(x=>`<li class="no">${esc(x.txt)}<br><small>${esc(x.fix)}</small></li>`).join('')+'</ul>';
 if(pn) h+=`<div class="mw-card"><b>Panne : ${esc(pn.nom)}</b><small>« ${esc(pn.txt)} »</small><div class="mw-btns">${btn('repair','Réparer · '+esc(fmt(pn.cost)),'sm')}</div></div>`;
 h+=`<div class="mw-btns">${btn('dyno','Banc de puissance','sm',!cp.bench)}${btn('ct','Contrôle technique · 78 €','sm ghost')}${btn('service','Révision','sm ghost')}</div>${cp.bench?'':'<p class="hint">Le banc de puissance est chez Prépa Vallon (ou dans un garage équipé).</p>'}`;
 h+=`<div class="tn-h">Pièces montées (${inst.length})</div>`+(inst.length?inst.map(([s,n])=>`<div class="tn-item"><div><b>${esc(n)}</b></div><div class="tn-btns">${btn('rm:'+s,'Déposer','sm ghost')}</div></div>`).join(''):'<small>Votre voiture est d’origine.</small>');
 return h;}
function renderMenu(){
 const el=id=>document.getElementById(id);if(!MS||!el('tnList')) return;
 const model=MS.model,cur=cfgOf();
 el('tnStats').innerHTML=statRows(model,cur,MS.prev?previewCfg():null);
 el('tnList').innerHTML=tabList();
 for(const b of document.querySelectorAll('.tn-tab')) b.classList.toggle('on',b.dataset.mw==='tab:'+MS.tab);
 el('tnInfo').innerHTML=`${esc(MS.cp.nom||'Garage')} · taux ${esc(fmt(MS.cp.taux))}/h · préparation niveau ${level('preparation')} · ${esc(fmt(MW.S.money))}${MS.cp.diy?' · <b>pose par vos soins possible</b>':''}${MS.msg?'<br><b>'+esc(MS.msg)+'</b>':''}`;
 const hr=el('tnH'),sr=el('tnS');
 if(hr) hr.oninput=()=>{const v=+hr.value;el('tnHv').textContent=(v>0?'+':'')+v+' cm';api.setHeight(v,null);MS.v&&MS.v.setCfg(previewCfg());el('tnStats').innerHTML=statRows(model,cfgOf(),MS.prev?previewCfg():null);};
 if(sr) sr.oninput=()=>{const v=+sr.value;el('tnSv').textContent=v+' %';api.setHeight(cfgOf().h,v/100);el('tnStats').innerHTML=statRows(model,cfgOf(),null);};
 if(MS.v) MS.v.setCfg(previewCfg());}
function menuClick(a){
 if(!MS) return;const [k,v]=[a.split(':')[0],a.slice(a.indexOf(':')+1)],model=MS.model;
 const redo=msg=>{MS.msg=msg||'';renderMenu();};
 if(k==='tab'){MS.tab=v;MS.prev=null;renderMenu();}
 else if(k==='vw'){MS.v&&MS.v.view(v);}
 else if(k==='view'){MS.prev=MS.prev&&MS.prev.k==='part'&&MS.prev.id===v?null:{k:'part',id:v};redo();}
 else if(k==='buy'){
  let it;if(v==='paint') it={k:'paint',f:MS.paint.f,c:MS.paint.c,c2:MS.paint.two?MS.paint.c2:null};else if(v==='wheels') it={k:'wheels',m:MS.wh.m,i:MS.wh.i,c:MS.wh.c};else it={k:'part',id:v};
  const r=install(it,{zone:MS.zone});MS.prev=null;redo(r.msg);}
 else if(k==='wview'){MS.prev=MS.prev&&MS.prev.k==='wrap'&&MS.prev.t===v?null:{k:'wrap',t:v,c:MS.wrapC};redo();}
 else if(k==='wbuy'){const r=install({k:'wrap',t:v,c:MS.wrapC},{zone:MS.zone});MS.prev=null;redo(r.msg);}
 else if(k==='rm'){removeSlot(v,{zone:MS.zone});MS.prev=null;redo('Déposé.');}
 else if(k==='pf'){MS.paint.f=v;MS.prev={k:'paint',f:MS.paint.f,c:MS.paint.c,c2:MS.paint.two?MS.paint.c2:null};redo();}
 else if(k==='pc'){MS.paint.c=+v;MS.prev={k:'paint',f:MS.paint.f,c:MS.paint.c,c2:MS.paint.two?MS.paint.c2:null};redo();}
 else if(k==='pc2'){MS.paint.c2=+v;MS.prev={k:'paint',f:MS.paint.f,c:MS.paint.c,c2:MS.paint.c2};redo();}
 else if(k==='ptwo'){MS.paint.two=v==='1';MS.prev={k:'paint',f:MS.paint.f,c:MS.paint.c,c2:MS.paint.two?MS.paint.c2:null};redo();}
 else if(k==='wc'){MS.wrapC=+v;if(MS.prev&&MS.prev.k==='wrap') MS.prev.c=+v;redo();}
 else if(k==='wm'){MS.wh.m=v;MS.prev={k:'wheels',m:MS.wh.m,i:MS.wh.i,c:MS.wh.c};redo();}
 else if(k==='wi'){MS.wh.i=+v;MS.prev={k:'wheels',m:MS.wh.m,i:MS.wh.i,c:MS.wh.c};redo();}
 else if(k==='wcol'){MS.wh.c=+v;MS.prev={k:'wheels',m:MS.wh.m,i:MS.wh.i,c:MS.wh.c};redo();}
 else if(k==='neon'){api.setNeon(+v);redo();}
 else if(k==='repair'){repair({zone:MS.zone});redo();}
 else if(k==='service'){service({zone:MS.zone});redo();}
 else if(k==='ct'){const r=ct();redo(r.ok?'Contrôle technique passé.':'Contrôle technique refusé.');}
 else if(k==='dyno'){const z=MS.zone;closeMenu(true);dynoPanel({back:()=>menu(z)});}
 else if(k==='close'){MW.closePanel();}}
function closeMenu(keepPanel){if(MS){if(MS.v) MS.v.dispose();MS=null;}if(!keepPanel) {}}
function menu(zid,opt){
 opt=opt||{};if(!MW.S) return false;css();
 const cur=curCar(),model=cur.model||'p206';
 const cp=caps(zid||nearZone());
 if(!cp.any){say('Il faut un atelier de préparation ou un garage équipé pour modifier votre voiture.','warn');return false;}
 const pc=MW.playerCar(),z=MW.zone(cp.zone);
 if(z&&Math.hypot(pc.x-z.x,pc.z-z.z)>z.w/2+z.d/2+45){say('Amenez votre voiture devant l’atelier pour la modifier.','warn');return false;}
 closeMenu();
 const sp=spec(model),wk=cfgOf().wheels;
 MS={zone:cp.zone,cp,model,tab:opt.tab||(cp.sport?'perf':'style'),prev:null,msg:'',paint:{f:'brillant',c:COLORS[1][1],c2:COLORS[12][1],two:false},wrapC:0x101114,wh:{m:wk?wk.m:'etoile5',i:wk?wk.i:Math.min(maxInch(model),sp.inch+1),c:wk?wk.c:WCOLORS[0][1]},v:null,back:opt.back};
 const html=`<div class="tn-wrap"><div class="tn-left"><div class="tn-view" id="tnView"><i>Glisser pour tourner · molette pour zoomer</i></div>
  <div class="tn-views">${[['3q','3/4'],['avant','Avant'],['arriere','Arrière'],['cote','Côté'],['roue','Roue'],['dessus','Dessus']].map(([a,n])=>`<button type="button" class="tn-vb" data-mw="vw:${a}">${n}</button>`).join('')}</div>
  <div id="tnStats"></div></div>
  <div class="tn-right"><small id="tnInfo"></small><div class="tn-tabs">${[['perf','Performances'],['style','Style'],['paint','Peinture'],['wheels','Jantes'],['bilan','Bilan']].map(([a,n])=>`<button type="button" class="tn-tab" data-mw="tab:${a}">${n}</button>`).join('')}</div><div class="tn-list" id="tnList"></div></div></div>
  <div class="mw-btns">${btn('close','Fermer','ghost')}</div>`;
 MW.panel('Tuning · '+(spec(model).nom||'votre voiture'),html,{wide:true,onClick:menuClick,onClose:()=>closeMenu(true)});
 const host=document.getElementById('tnView');
 if(host){MS.v=makeViewer(host,model,cur.color,(()=>{try{return pc.mesh.userData.plate;}catch(e){return null;}})());if(MS.v) MS.v.setCfg(cfgOf());}
 renderMenu();return true;}
api.menu=menu;
api.menuState=()=>MS?{tab:MS.tab,prev:MS.prev,zone:MS.zone,viewer:!!MS.v}:null;
api.menuClick=menuClick;
api.closeMenu=()=>{closeMenu();MW.closePanel();};

/* ═══════════ 7. Ateliers : accueil, emploi, équipement, décor (banc de puissance, cabine de peinture) ═══════════ */
const REQ={prepa:{niv:{moteur:3,liaison:3},rep:20,nom:'Prépa Vallon'},style:{niv:{liaison:2,entretien:3},rep:15,nom:'Atelier Éclat'}};
const COMP_NOM={entretien:'Entretien',freinage:'Freinage',liaison:'Liaison au sol',moteur:'Moteur',transmission:'Transmission',electricite:'Électricité',diagnostic:'Diagnostic',preparation:'Préparation'};
const EQUIP={banc:{nom:'Banc de puissance',prix:18000},cabine:{nom:'Cabine de peinture',prix:16000}};
function reqLines(r){const o=[];for(const k in r.niv) o.push({ok:level(k)>=r.niv[k],t:`${COMP_NOM[k]} : niveau ${r.niv[k]}`,now:'vous : '+level(k)});
 o.push({ok:(+MW.S.rep||0)>=r.rep,t:`Réputation : ${r.rep}`,now:'vous : '+Math.round(+MW.S.rep||0)});return o;}
const condHTML=l=>'<ul class="mw-cond">'+l.map(x=>`<li class="${x.ok?'ok':'no'}">${x.ok?'✓':'✗'} ${esc(x.t)} <small>(${esc(x.now)})</small></li>`).join('')+'</ul>';
const empOf=zid=>zid==='tune1'?'prepa':zid==='tune2'?'style':null;
function hire(zid){const e=empOf(zid),r=REQ[e];if(!e) return false;
 if(!reqLines(r).every(x=>x.ok)) return false;
 try{MWC.hire(e);}catch(x){return false;}return true;}
api.hire=hire;
api.quit=()=>{try{MWC.hire('aucun');}catch(e){}};
function doorPanel(z){
 if(!MW.S) return;const zid=z.id,cp=caps(zid),e=empOf(zid),emp=workZone()===zid,own=isOwner(zid),open=MW.S.min>=480&&MW.S.min<1140;
 const intro=zid==='tune1'?'Le préparateur sport et rallye : reprogrammation, échappements, turbo, freins, suspension. Le banc de puissance est au fond de l’atelier.':'L’atelier de style et de carrosserie : cabine de peinture, covering, jantes, kits et aileron.';
 let h=`<p>${esc(intro)}</p>`;
 if(emp) h+=`<p><b>Vous travaillez ici.</b> Les commandes de tuning des clients arrivent de 8 h à 19 h : approchez-vous du poste de travail devant la voiture.</p>`;
 const t=TS(),ods=t.orders.filter(o=>o.zone===zid);
 if(ods.length) h+=`<div class="mw-card">${ods.map(o=>`<div class="mw-row"><span>${esc(o.client)} · ${esc(o.nom)}<br><small>${esc(o.label)}</small></span>${btn('ord:'+o.id,'Voir','sm')}</div>`).join('')}</div>`;
 h+=`<div class="mw-btns v">${btn('menu','Modifier ma voiture (aperçu 3D)')}${cp.bench?btn('dyno','Banc de puissance'):''}`;
 if(e&&!emp&&!own){const r=REQ[e],ok=reqLines(r).every(x=>x.ok);h+=btn('job','Se faire embaucher','',!ok);}
 if(emp&&e) h+=btn('quit','Démissionner','ghost');
 if(own){for(const k in EQUIP) if(!cp[k==='banc'?'bench':'booth']) h+=btn('equip:'+k,`Installer : ${EQUIP[k].nom.toLowerCase()} (${esc(fmt(EQUIP[k].prix))})`,'ghost',cashNow()<EQUIP[k].prix);}
 h+=btn('fiche',own?'Mon bâtiment':'Acheter l’atelier','ghost');
 h+=btn('close','Fermer','ghost')+'</div>';
 if(e&&!emp&&!own) h=h.replace('<div class="mw-btns v">',`<p class="hint">Se faire embaucher ici demande :</p>${condHTML(reqLines(REQ[e]))}<div class="mw-btns v">`);
 MW.panel(z.nom,h,{onClick:a=>{
  if(a==='menu'){MW.closePanel();menu(zid);}
  else if(a==='dyno'){MW.closePanel();dynoPanel({back:()=>doorPanel(z)});}
  else if(a==='job'){if(hire(zid)){say(`Vous êtes embauché : ${REQ[e].nom}. Les clients vont arriver.`,'good');doorPanel(z);}}
  else if(a==='quit'){api.quit();say('Vous avez quitté votre poste.','warn');doorPanel(z);}
  else if(a.startsWith('equip:')){if(buyEquip(zid,a.slice(6))) doorPanel(z);}
  else if(a==='fiche'){try{MWI.fiche(z);}catch(x){MW.closePanel();}}
  else if(a.startsWith('ord:')){MW.closePanel();station(a.slice(4));}
  else if(a==='close') MW.closePanel();}});}
function buyEquip(zid,k){
 const t=TS(),E=EQUIP[k];if(!E||!isOwner(zid)) return false;const eq=t.equip[zid]||(t.equip[zid]={});if(eq[k]) return false;
 if(cashNow()<E.prix){say(`Il faut ${fmt(E.prix)}.`,'warn');return false;}
 biz(-E.prix,E.nom+' installé');eq[k]=1;buildDecor(zid);regSpots(zid);say(`${E.nom} installé : vous pouvez proposer ${k==='banc'?'la préparation moteur':'la peinture'} dans votre garage.`,'good');return true;}
api.equip=(zid,k)=>buyEquip(zid,k);
/* positions de travail dans un garage (repère local u,v du bâtiment) */
function spot(z,kind){const d=z._d,w=d.w,dp=d.d;
 if(kind==='banc') return Object.assign(z.loc(-w*.24,dp*.76),{ry:z.ry});
 if(kind==='cabine') return Object.assign(z.loc(w*.24,dp*.76),{ry:z.ry});
 return null;}
function slotsOf(zid){const z=MW.zone(zid);if(!z) return [];const cp=caps(zid),l=[];
 if(cp.bench) l.push(Object.assign({kind:'banc'},spot(z,'banc')));
 if(cp.booth) l.push(Object.assign({kind:'cabine'},spot(z,'cabine')));
 if(z.ponts&&z.ponts.length>1&&(zid==='tune1'||zid==='tune2')) l.push(Object.assign({kind:'pont'},z.ponts[z.ponts.length-1]));
 return l;}
/* décor : un seul groupe par atelier */
const DEC={};
function lam(c,o){return new T.MeshLambertMaterial(Object.assign({color:c},o||{}));}
function buildDecor(zid){
 const z=MW.zone(zid);if(!z||!MW.scene) return;const cp=caps(zid);let g=DEC[zid];
 if(g){MW.scene.remove(g);g.traverse(o=>{if(o.isMesh&&o.userData.own){o.geometry.dispose();}});}
 g=DEC[zid]=new T.Group();g.name='tune-decor-'+zid;
 const add=(geo,m,x,y,zz,ry)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,zz);if(ry) o.rotation.y=ry;g.add(o);return o;};
 const bx=(w,h,d)=>new T.BoxGeometry(w,h,d);
 const place=(p,fn)=>{const gg=new T.Group();gg.position.set(p.x,0,p.z);gg.rotation.y=p.ry;fn(gg);g.add(gg);};
 if(cp.bench) place(spot(z,'banc'),gg=>{
  const a=(geo,m,x,y,zz,rx)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,zz);if(rx) o.rotation.z=rx;gg.add(o);return o;};
  a(bx(2.7,.14,5.2),lam(0x24272c),0,.07,0);
  for(const s of [-1,1]){a(bx(.07,.03,5.2),lam(0xe8a020),s*1.3,.155,0);}
  for(const zz of [-.2,.2]) for(const s of [-.7,.7]){const r=a(new T.CylinderGeometry(.22,.22,.9,16),lam(0x5a5e66),s,.2,1.0+zz*1.2,PI/2);r.userData.own=0;}
  a(new T.CylinderGeometry(.5,.5,.12,18),lam(0x3a3d44),1.9,.07,-1.5);
  a(bx(.5,1.5,.5),lam(0x2c3036),1.9,.75,-2.1);a(bx(.9,.55,.08),lam(0x0c1118),1.9,1.55,-2.12);a(bx(.82,.46,.02),lam(0x23c56a,{emissive:0x0f6a36}),1.9,1.55,-2.07);
  a(new T.CylinderGeometry(.55,.55,.35,20),lam(0x4a4e56),0,.6,3.1,PI/2);
  const fan=a(new T.CylinderGeometry(.5,.5,.04,20),lam(0x15171a),0,.6,3.28);fan.rotation.x=PI/2;});
 if(cp.booth) place(spot(z,'cabine'),gg=>{
  const a=(geo,m,x,y,zz)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,zz);gg.add(o);return o;};
  const glass=new T.MeshLambertMaterial({color:0xdde8f0,transparent:true,opacity:.28,side:T.DoubleSide,depthWrite:false});
  a(bx(4.2,.06,6.4),lam(0x70747c),0,.03,0);
  for(const sx of [-2.1,2.1]) for(const sz of [-3.2,3.2]) a(bx(.12,3.4,.12),lam(0xd8dce2),sx,1.7,sz);
  a(bx(4.3,.12,6.5),lam(0xeceff2),0,3.45,0);a(bx(3.4,.03,5.6),lam(0xfffbe8,{emissive:0xfff2b0}),0,3.37,0);
  for(const sx of [-2.1,2.1]) a(bx(.04,3.3,6.4),glass,sx,1.7,0);
  a(bx(4.2,3.3,.04),glass,0,1.7,-3.2);
  const gun=a(bx(.08,.5,.08),lam(0xc02a2a),1.5,2.6,2.4);a(bx(.5,.04,.04),lam(0x15171a),1.5,2.85,2.4);gun.rotation.z=.2;
  for(let i=0;i<4;i++) a(new T.CylinderGeometry(.14,.14,.26,12),lam([0xc02a2a,0x2a5ab0,0x20a050,0xe8c020][i]),-1.9+i*.32,.2,-2.9);});
 MW.scene.add(g);}
function regSpots(zid){
 const z=MW.zone(zid);if(!z) return;
 MW.addInteract({id:'tn:post:'+zid,x:z.loc(0,z._d.d*.66).x,z:z.loc(0,z._d.d*.66).z,r:2.4,label:()=>'Poste de préparation · modifier ma voiture',when:()=>caps(zid).any&&!MW.paused,use:()=>menu(zid)});
 const b=spot(z,'banc'),c=spot(z,'cabine');
 if(caps(zid).bench){const p=z.loc(-z._d.w*.24+3.6,z._d.d*.76-2.3);MW.addInteract({id:'tn:dyno:'+zid,x:p.x,z:p.z,r:2.2,label:()=>'Banc de puissance',when:()=>caps(zid).bench,use:()=>{const pc=MW.playerCar(),zz=MW.zone(zid);if(Math.hypot(pc.x-zz.x,pc.z-zz.z)>zz.w/2+zz.d/2+45){say('Amenez votre voiture devant l’atelier.','warn');return;}dynoPanel({});}});}
 if(isOwner(zid)&&!empOf(zid)){const p=z.accueil?{x:z.accueil.x-z.n.x*1.2,z:z.accueil.z-z.n.z*1.2}:z.porte;
  MW.addInteract({id:'tn:eq:'+zid,x:p.x,z:p.z,r:2.6,label:'Équipement de préparation (banc, cabine)',when:()=>isOwner(zid),use:()=>equipPanel(zid)});}}
function equipPanel(zid){
 const z=MW.zone(zid),cp=caps(zid);
 let h='<p>Équipez votre garage pour proposer le tuning : vous modifiez votre voiture sur place et les clients de préparation viennent chez vous.</p><div class="mw-card">';
 for(const k in EQUIP){const has=cp[k==='banc'?'bench':'booth'];h+=`<div class="mw-row"><span><b>${esc(EQUIP[k].nom)}</b><br><small>${k==='banc'?'Reprogrammation, courbes de puissance, pièces moteur.':'Peinture, bicolore, nacré, mat.'}</small></span>${has?'<span class="mw-tag ok">installé</span>':btn('equip:'+k,esc(fmt(EQUIP[k].prix)),'sm',cashNow()<EQUIP[k].prix)}</div>`;}
 h+='</div>'+(cp.any?`<div class="mw-btns">${btn('menu','Modifier ma voiture')}${btn('close','Fermer','ghost')}</div>`:`<div class="mw-btns">${btn('close','Fermer','ghost')}</div>`);
 MW.panel((z?z.nom:'Garage')+' · Préparation',h,{onClick:a=>{if(a.startsWith('equip:')){if(buyEquip(zid,a.slice(6))) equipPanel(zid);}else if(a==='menu'){MW.closePanel();menu(zid);}else if(a==='close') MW.closePanel();}});}
api.equipPanel=equipPanel;

/* ═══════════ 8. Clients de tuning : commandes, poste de travail à étapes, facture, note, expérience ═══════════ */
const P_=id=>({k:'part',id}),PT=(f,c,c2)=>({k:'paint',f,c,c2:c2==null?null:c2}),WR=(t,c)=>({k:'wrap',t,c}),WH=(m,i,c)=>({k:'wheels',m,i,c});
const TPLS=[
 ['stage1','« Un stage 1, s’il vous plaît. »','sport',[P_('ecu1')]],
 ['stage1x','« Stage 1 et un échappement sport. »','sport',[P_('exh1'),P_('ecu1')]],
 ['admexh','« Admission et échappement, surtout pour le son. »','sport',[P_('adm1'),P_('exh1')]],
 ['stage2','« Stage 2 complet : je veux de la puissance ! »','sport',[P_('adm2'),P_('exh2'),P_('ecu2')]],
 ['frpn','« Freins et pneus sport pour la route. »','sport',[P_('brk1'),P_('tyr1')]],
 ['circuit','« Préparation circuit : semi-slicks et gros freins. »','sport',[P_('tyr2'),P_('brk2')]],
 ['allege','« Allégez-la : on sort les sièges arrière. »','sport',[P_('lt1')]],
 ['boite','« Une boîte courte et un autobloquant. »','sport',[P_('gear'),P_('lsd')]],
 ['rabarb','« Un rabaissement et des barres antiroulis. »','both',[P_('sus0'),P_('arb1')]],
 ['rabjan','« Un rabaissement et des jantes de 18 pouces. »','both',[P_('sus0'),WH('etoile5',18,0x3a3d44)]],
 ['suspsp','« Une suspension sport et des pneus sport. »','both',[P_('sus1'),P_('tyr1')]],
 ['mat','« Une peinture mate noire, toute la voiture. »','style',[PT('mat',0x101114)]],
 ['nacre','« Une peinture nacrée bleu nuit. »','style',[PT('nacre',0x1f3a8a)]],
 ['bicolore','« Bicolore : carrosserie rouge, toit noir. »','style',[PT('brillant',0xc4281c,0x101114)]],
 ['bandes','« Des bandes racing sur le capot et le toit. »','style',[WR('bandes',0x101114)]],
 ['vitres','« Vitres teintées et feux arrière fumés. »','style',[P_('tn1'),P_('tl1')]],
 ['kit','« Un kit carrosserie avec un aileron. »','style',[P_('fr1'),P_('sk1'),P_('sp2')]],
 ['jant','« Des jantes multi-branches et un échappement visible. »','style',[WH('multi10',18,0xc4c8ce),P_('tp2')]],
 ['led','« Des feux à LED, devant et derrière. »','style',[P_('hl2'),P_('tl2')]]];
const FIRST=[['M.','Lucas'],['M.','Maël'],['Mme','Inès'],['Mlle','Nina'],['M.','Yanis'],['Mme','Camille'],['M.','Théo'],['Mlle','Léa'],['M.','Hugo'],['Mlle','Jade'],['M.','Noé'],['Mme','Manon'],['M.','Enzo'],['Mme','Louise'],['M.','Karim'],['Mlle','Zoé']],LAST=['Dupuis','Lambert','Moreau','Fabre','Garnier','Roux','Lefèvre','Marchand','Perrin','Collet','Masson','Vidal','Girard','Noël','Blanc','Rey'];
const COLS=[0xb03030,0x2f5da8,0xe8e8e8,0x2a2a2e,0x3f8a4a,0xd8b22a,0x7a7f88,0xc86a1c,0x6a3a8a];
const absT=()=>{const s=MW.S;return s.day*1440+(s.min<360?s.min+1440:s.min);};
const openT=()=>{const s=MW.S;return s.day*660+(s.min<360?660:clamp(s.min-480,0,660));};
const NP=()=>{try{const n=MW.net;return n&&n.live&&n.players?n.players():1;}catch(e){return 1;}};
function tplKinds(zid){const cp=caps(zid);const k=[];if(cp.sport) k.push('sport');if(cp.style) k.push('style');if(cp.any) k.push('both');return k;}
function poolFor(kind){
 if(!carsOK()) return [];const L=MWCARS.list||[];
 if(kind==='sport') return L.filter(c=>c.cat==='sport'||c.cat==='gen'||(c.cat==='pop'&&c.kind!=='utilitaire'));
 return L.filter(c=>c.kind!=='utilitaire');}
function fixItems(model,items){ /* adapte les jantes à la voiture et vérifie que tout se monte, dans l'ordre */
 const cfg=emptyCfg(),out=[];
 for(const it0 of items){const it=Object.assign({},it0);
  if(it.k==='wheels'){const sp=spec(model);it.i=clamp(Math.min(it.i,maxInch(model)),Math.max(14,sp.inch),20);if(it.i<=sp.inch) it.i=Math.min(maxInch(model),sp.inch+1);}
  const q=quote(model,cfg,it);if(!q.ok) return null;q.fn(cfg);out.push(it);}
 return out;}
function spawnOrder(opt){
 opt=opt||{};const t=TS(),zid=opt.zone||workZone();if(!t||!zid) return null;const cp=caps(zid);if(!cp.any) return null;
 const sl=slotsOf(zid);if(!sl.length) return null;
 const used=new Set(t.orders.filter(o=>o.zone===zid).map(o=>o.slot));let slot=-1;for(let i=0;i<sl.length;i++) if(!used.has(i)){slot=i;break;}
 if(slot<0) return null;
 const kinds=tplKinds(zid);let list=TPLS.filter(x=>kinds.includes(x[2]));if(opt.tpl) list=TPLS.filter(x=>x[0]===opt.tpl);if(!list.length) return null;
 for(let tries=0;tries<20;tries++){
  const tp=pick(list),kind=tp[2]==='both'?(cp.sport?'sport':'style'):tp[2],pool=opt.model?[carOf(opt.model)].filter(Boolean):poolFor(kind);if(!pool.length) return null;
  const c=pick(pool),items=fixItems(c.id,tp[3]);if(!items) continue;
  const taux=cp.taux,qt=items.map(it=>quote(c.id,emptyCfg(),it));
  const parts=qt.reduce((a,q)=>a+q.price,0),labor=Math.round(qt.reduce((a,q)=>a+q.mo,0)/60*taux/5)*5;
  const o={id:'t'+(++t.seq),zone:zid,slot,client:(f=>f[0]+' '+f[1]+' '+pick(LAST))(pick(FIRST)),mdl:c.id,nom:c.mk+' '+c.mo,color:opt.color!=null?opt.color:pick(COLS),
   plaque:String.fromCharCode(65+rint(0,22))+String.fromCharCode(65+rint(0,22))+'-'+rint(100,999)+'-'+String.fromCharCode(65+rint(0,22))+String.fromCharCode(65+rint(0,22)),
   tpl:tp[0],label:tp[1],items,cfg:emptyCfg(),step:0,steps:null,status:'new',q:[],t0:absT(),ot0:openT(),devis:Math.round((parts*1.12+labor)/5)*5,parts:Math.round(parts),labor,taux,spent:0};
  t.orders.push(o);ordMesh(o);regOrder(o);hudTune();
  say(`${o.client} arrive à ${MW.zone(zid).court} avec sa ${o.nom} : ${o.label.replace(/[«»]/g,'').trim()}`,'info');
  try{MW.emit('tuneOrder',o);}catch(e){}
  return o;}
 return null;}
api.spawn=spawnOrder;
api.orders=()=>{const t=TS();return t?t.orders:[];};
const OM={};
function ordMesh(o){
 if(OM[o.id]){MW.scene.remove(OM[o.id]);delete OM[o.id];}
 const z=MW.zone(o.zone);if(!z||!MW.scene) return;const sl=slotsOf(o.zone)[o.slot];if(!sl) return;
 const m=MW.carMesh({model:o.mdl,color:o.color,plate:o.plaque,bay:false});m.position.set(sl.x,0,sl.z);m.rotation.y=sl.ry;
 MW.scene.add(m);OM[o.id]=m;apply(m,o.cfg,{model:o.mdl});}
function dropOrdMesh(id){const m=OM[id];if(m){try{clear(m);}catch(e){}MW.scene.remove(m);delete OM[id];}MW.removeInteract('tn:ord:'+id);}
function regOrder(o){
 const sl=slotsOf(o.zone)[o.slot];if(!sl) return;const z=MW.zone(o.zone),dx=Math.cos(sl.ry)*2.6,dz=-Math.sin(sl.ry)*2.6;
 MW.addInteract({id:'tn:ord:'+o.id,x:sl.x+dx,z:sl.z+dz,r:2.6,label:()=>`Commande de tuning · ${o.nom} (${o.client})`,when:()=>!MW.paused&&TS().orders.includes(o),use:()=>station(o.id)});}
function hudTune(){const t=TS();if(!t||!MW.S) return;const wz=workZone(),l=t.orders.filter(o=>o.zone===wz);
 MW.hud('tune',l.length?'<b>Commandes de tuning</b><br>'+l.map(o=>`${esc(o.client)} · ${esc(o.nom)} : ${o.status==='new'?'à accepter':'étape '+Math.min(o.step+1,o.steps.length)+'/'+o.steps.length}`).join('<br>'):'');}
const ordBy=id=>TS().orders.find(o=>o.id===id)||null;
api.order=ordBy;
/* étapes d'une commande */
function stepsFor(o){
 const S=[],model=o.mdl,cfg=emptyCfg();
 o.items.forEach((it,i)=>{const q=quote(model,cfg,it);q.fn(cfg);
  if(it.k==='part'){const p=PARTS[it.id];
   S.push({txt:`Déposer l’ancien équipement (${SLOTS[p.slot].toLowerCase()})`,mo:Math.max(10,Math.round(p.mo*.2)),kind:'dep',i});
   S.push({txt:`Monter : ${p.nom}`,mo:Math.round(p.mo*.55),kind:'pose',i,piece:it.id});
   if(p.slot==='ecu') S.push({txt:'Cartographie sur le banc de puissance',mo:Math.round(p.mo*.25),kind:'bench',i});
   else S.push({txt:'Réglages et contrôle',mo:Math.max(10,Math.round(p.mo*.2)),kind:'reg',i});}
  else if(it.k==='paint'){S.push({txt:'Poncer et appliquer l’apprêt',mo:100,kind:'prep',i});S.push({txt:'Peindre en cabine',mo:Math.round(q.mo*.35),kind:'paint',i,booth:1});S.push({txt:'Cuisson et séchage',mo:70,kind:'dry',i,booth:1});S.push({txt:'Polir et rendre brillante',mo:70,kind:'reg',i});}
  else if(it.k==='wrap'){S.push({txt:'Nettoyer et dégraisser',mo:30,kind:'prep',i});S.push({txt:`Poser le film (${WRAPS[it.t].nom.toLowerCase()})`,mo:Math.round(q.mo*.7),kind:'paint',i});}
  else if(it.k==='wheels'){S.push({txt:'Déposer les 4 roues',mo:25,kind:'dep',i});S.push({txt:`Monter les jantes et les pneus (${it.i} pouces)`,mo:45,kind:'pose',i});S.push({txt:'Équilibrer et serrer',mo:25,kind:'reg',i});}});
 return S;}
function orderQuality(o){return o.q.length?o.q.reduce((a,b)=>a+b,0)/o.q.length:.7;}
function stationHtml(o){
 const cp=caps(o.zone),lines=[];
 let h=`<p><b>${esc(o.client)}</b> · ${esc(o.nom)} <small>(${esc(o.plaque)})</small></p><p>${esc(o.label)}</p>`;
 h+=`<div class="mw-card">${o.items.map(it=>`<div class="mw-row"><span>${esc(itemName(it))}</span><small>${esc(fmt(quote(o.mdl,emptyCfg(),it).price))}</small></div>`).join('')}<div class="mw-row"><span><b>Devis</b> <small>(pièces + main-d’œuvre ${esc(fmt(o.taux))}/h)</small></span><b>${esc(fmt(o.devis))}</b></div></div>`;
 if(o.status==='new') h+=`<div class="mw-btns">${btn('accept','Accepter la commande')}${btn('refuse','Refuser','ghost')}${btn('close','Fermer','ghost')}</div>`;
 else{
  h+='<div class="tn-list">'+o.steps.map((s,i)=>{const cur=i===o.step,done=i<o.step;
   return `<div class="tn-item${done?' on':''}${!done&&!cur?' no':''}"><div><b>${done?'✓ ':''}${esc(s.txt)}</b><small>${s.mo} min${s.piece?' · pièce : '+esc(PARTS[s.piece].nom)+(pieceSrc(o,s)):''}${s.booth?' · cabine de peinture':''}</small></div><div class="tn-btns">${cur?btn('step:'+i,'Faire','sm',s.booth&&!cp.booth):''}</div></div>`;}).join('')+'</div>';
  const fin=o.step>=o.steps.length;
  h+=`<div class="mw-btns">${fin?btn('deliver','Rendre la voiture'):''}${btn('close','Fermer','ghost')}</div>`;}
 return h;}
function pieceSrc(o,s){const cp=caps(o.zone);if(stk.count(s.piece)>0) return ' (en stock)';if(cp.owner) return ' (achat au prix de gros)';return ' (fournie par l’atelier)';}
function station(id){
 const o=ordBy(id);if(!o) return false;
 MW.panel('Commande de tuning',stationHtml(o),{wide:true,onClick:a=>{
  if(a==='accept'){acceptOrder(id);station(id);}
  else if(a==='refuse'){dropOrder(id,'refus');MW.closePanel();}
  else if(a.startsWith('step:')){const r=step(id,+a.slice(5));if(r&&r.panel) return;station(id);}
  else if(a==='deliver'){MW.closePanel();deliver(id);}
  else if(a==='close') MW.closePanel();}});
 return true;}
api.station=station;
function acceptOrder(id){const o=ordBy(id);if(!o||o.status!=='new') return false;o.steps=stepsFor(o);o.status='wip';o.step=0;hudTune();return true;}
api.accept=acceptOrder;
function dropOrder(id,why){const t=TS(),i=t.orders.findIndex(o=>o.id===id);if(i<0) return;const o=t.orders[i];t.orders.splice(i,1);dropOrdMesh(id);hudTune();
 if(why==='attente'){MW.S.rep=clamp(R2((MW.S.rep||0)-1.5),0,100);say(`${o.client} est reparti avec sa ${o.nom} : trop d’attente.`,'warn');}
 else if(why==='refus'){MW.S.rep=clamp(R2((MW.S.rep||0)-.3),0,100);}}
api.drop=dropOrder;
/* pièce d'une étape : stock (MWST) sinon achat au prix de gros (propriétaire) ou fournie (employé) */
function takePiece(o,id){
 const cp=caps(o.zone);
 if(stk.count(id)>0&&stk.take(id,o.id)) return {ok:true,src:'stock',cost:0};
 if(stk.has()&&stk.order(id,1)&&stk.count(id)<=0&&!cp.owner) {/* commande passée : on continue avec la pièce de l'étagère */}
 if(cp.owner){const c=Math.round(priceOf(o.mdl,id)*.72);if(cashNow()<c){say(`Pièce « ${PARTS[id].nom} » : il faut ${fmt(c)} pour l’acheter au grossiste.`,'warn');return {ok:false};}
  biz(-c,'Pièce de tuning : '+PARTS[id].nom);o.spent+=c;return {ok:true,src:'achat',cost:c};}
 return {ok:true,src:'atelier',cost:0};}
function step(id,i){
 const o=ordBy(id);if(!o||o.status!=='wip'||i!==o.step) return {ok:false};
 const s=o.steps[i],cp=caps(o.zone);
 if(s.booth&&!cp.booth){say('Cette étape demande une cabine de peinture.','warn');return {ok:false};}
 const lvl=level('preparation'),it=o.items[s.i],niv=it?(it.k==='part'?PARTS[it.id].niv:quote(o.mdl,emptyCfg(),it).niv):1;
 if(s.kind==='pose'&&s.piece){const r=takePiece(o,s.piece);if(!r.ok) return {ok:false};}
 const f=Math.max(.55,1-.06*(lvl-niv)),mo=Math.max(5,Math.round(s.mo*f));
 let q=clamp(.62+.07*(lvl-niv)+rnd()*.28,.3,1);
 if(s.kind==='bench'&&!o.benchQ){o.benchPending=true;}
 MW.addMin(mo);
 o.q.push(q);o.step++;hudTune();
 /* les modifications apparaissent sur la voiture à la pose */
 if((s.kind==='pose'||s.kind==='paint')&&it){const c=clone(o.cfg);quote(o.mdl,c,it).fn(c);o.cfg=c;const m=OM[o.id];if(m) apply(m,c,{model:o.mdl});}
 if(s.kind==='bench'){benchGame(o);return {ok:true,panel:true};}
 return {ok:true,q,mo};}
api.step=step;
/* petit jeu de cartographie : trois réglages à trouver, trois essais au banc */
function benchGame(o){
 const h0=(s=>{let h=0;for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0;return Math.abs(h);})(o.id+o.mdl);
 const goal=[30+h0%40,30+(h0>>3)%40,35+(h0>>6)%35];let tries=3,best=0;const cur=[50,50,50];
 const render=(msg)=>{MW.panel('Cartographie sur le banc',`<p>Réglez l’avance, la richesse et la pression pour tirer le maximum du moteur de <b>${esc(o.nom)}</b>. Il vous reste <b>${tries}</b> essai${tries>1?'s':''}.</p>
  ${['Avance à l’allumage','Richesse du mélange','Pression / charge'].map((n,i)=>`<label class="mw-lab">${n} : <b id="tnb${i}">${cur[i]}</b><input class="tn-range" type="range" min="0" max="100" value="${cur[i]}" data-i="${i}"></label>`).join('')}
  ${msg?`<p class="mw-soon">${esc(msg)}</p>`:''}<div class="mw-btns">${btn('run','Lancer un essai au banc',tries?'':'ghost',!tries)}${btn('end','Valider la cartographie')}</div>`,{onClick:a=>{
   if(a==='run'&&tries){const e=cur.reduce((s,v,i)=>s+Math.abs(v-goal[i]),0)/3,sc=clamp(1-e/50,0,1);best=Math.max(best,sc);tries--;render(`Essai : ${Math.round(70+sc*30)} % du potentiel. ${sc>.85?'Excellent !':sc>.6?'Pas mal, affinez encore.':'Le moteur crache : changez les réglages.'}`);}
   else if(a==='end'){const qq=clamp(.5+best*.5,.4,1);o.q[o.q.length-1]=qq;MW.closePanel();say(`Cartographie validée : ${Math.round(qq*100)} % de réussite.`,qq>.8?'good':'info');station(o.id);}},onClose:()=>{}});
  for(const r of document.querySelectorAll('.tn-range[data-i]')) r.oninput=()=>{cur[+r.dataset.i]=+r.value;const b=document.getElementById('tnb'+r.dataset.i);if(b) b.textContent=r.value;};};
 render('');}
/* rendre la voiture : facture, note, expérience */
function deliver(id,force){
 const o=ordBy(id);if(!o||o.status!=='wip'||(!force&&o.step<o.steps.length)) return null;
 const t=TS(),q=orderQuality(o),late=Math.max(0,openT()-o.ot0-1100)/660;
 let stars=clamp(Math.round(1+q*4-late*1.2),1,5);
 const cp=caps(o.zone),emp=workZone()===o.zone&&!cp.owner;
 const facture=Math.round((o.parts*1.12+o.labor)*(.9+.1*q)/5)*5,tip=stars>=5?Math.round(facture*.1):stars===4?Math.round(facture*.04):0;
 let pay,cost=o.spent;
 if(cp.owner){biz(facture+tip,`Facture tuning : ${o.client}`);pay=facture+tip-cost;}
 else{pay=Math.round(o.labor*.5*(.7+.3*q))+tip;MW.money(pay,`Tuning : ${o.client} (${o.nom})`);}
 let xp=0;for(const it of o.items){const niv=it.k==='part'?PARTS[it.id].niv:quote(o.mdl,emptyCfg(),it).niv;xp+=8+niv*7;}
 xp=Math.round(xp*(.6+.5*q)*2);addXp('preparation',xp);
 if(o.items.some(it=>it.k==='part'&&PARTS[it.id].slot==='tyres'||it.k==='wheels')) try{MW.S.xp.liaison=(MW.S.xp.liaison||0)+Math.round(xp*.25);}catch(e){}
 if(o.items.some(it=>it.k==='part'&&['ecu','boost','adm','exh'].includes(PARTS[it.id].slot))) try{MW.S.xp.moteur=(MW.S.xp.moteur||0)+Math.round(xp*.25);}catch(e){}
 const dRep=stars>=4?.8:stars===3?.2:-1;MW.S.rep=clamp(R2((MW.S.rep||0)+dRep),0,100);
 t.stats.done++;t.stats.earn=R2(t.stats.earn+Math.max(0,pay));t.stats.stars+=stars;
 const rep={id:o.id,client:o.client,nom:o.nom,facture,tip,pay,stars,xp,q:R2(q),emp,cost,items:o.items.map(itemName)};
 t.orders.splice(t.orders.indexOf(o),1);dropOrdMesh(o.id);hudTune();
 const sx='★'.repeat(stars)+'☆'.repeat(5-stars);
 MW.panel('Voiture rendue',`<p><b>${esc(o.client)}</b> récupère sa ${esc(o.nom)}.</p><div class="mw-card">${rep.items.map(n=>`<div class="mw-row"><span>${esc(n)}</span></div>`).join('')}</div>
  <div class="mw-card"><div class="mw-row"><span>Note du client</span><b style="color:#ffb800;letter-spacing:2px">${sx}</b></div><div class="mw-row"><span>Facture</span><b>${esc(fmt(facture))}</b></div>${tip?`<div class="mw-row"><span>Pourboire</span><b>${esc(fmt(tip))}</b></div>`:''}<div class="mw-row"><span>${emp?'Votre part (paie)':'Bénéfice'}</span><b>${esc(fmt(pay))}</b></div><div class="mw-row"><span>Expérience « préparation »</span><b>+${xp}</b></div></div>
  <div class="mw-btns">${btn('close','Très bien')}</div>`,{onClick:a=>{if(a==='close') MW.closePanel();}});
 try{MW.emit('tuneDone',rep);}catch(e){}
 return rep;}
api.deliver=deliver;
function ordersMinute(){
 const t=TS();if(!t||!MW.S||(MW.net&&MW.net.live&&MW.net.guest)) return;
 const wz=workZone();
 for(const o of t.orders.slice()){
  if(o.status==='new'&&openT()-o.ot0>420) dropOrder(o.id,'attente');
  else if(o.status==='wip'&&openT()-o.ot0>2600) dropOrder(o.id,'attente');}
 if(!wz||!caps(wz).any||MW.S.min<480||MW.S.min>=1140||absT()<t.next) return;
 const o=spawnOrder({zone:wz});
 t.next=absT()+Math.round(rint(16,34)/NP());}

/* ═══════════ 9. Fiche de la voiture, partie à deux, cycle de vie ═══════════ */
function cleanCfg(c){
 const o=emptyCfg();if(!c||typeof c!=='object') return o;
 if(c.p&&typeof c.p==='object') for(const sl in c.p){const p=PARTS[c.p[sl]];if(p&&p.slot===sl) o.p[sl]=p.id;}
 const col=v=>typeof v==='number'&&isFinite(v)?(v>>>0)&0xffffff:null;
 if(c.paint&&PAINTS[c.paint.f]&&col(c.paint.c)!=null) o.paint={c:col(c.paint.c),f:c.paint.f,c2:c.paint.c2==null?null:col(c.paint.c2)};
 if(c.wrap&&WRAPS[c.wrap.t]) o.wrap={t:c.wrap.t,c:col(c.wrap.c)==null?0x101114:col(c.wrap.c)};
 if(c.wheels&&WHEELS[c.wheels.m]&&+c.wheels.i>=13&&+c.wheels.i<=21) o.wheels={m:c.wheels.m,i:Math.round(+c.wheels.i),c:col(c.wheels.c)==null?0xc4c8ce:col(c.wheels.c)};
 o.h=clamp(Math.round(+c.h||0),-6,3);o.stiff=clamp(+c.stiff||0,0,1);if(col(c.neon)!=null) o.neon=col(c.neon);
 return o;}
api.pack=key=>{const c=cfgOf(key||keyOf());const empty=!Object.keys(c.p).length&&!c.paint&&!c.wrap&&!c.wheels;return empty?'':JSON.stringify(c);};
api.unpack=(s,mesh)=>{try{if(!s){clear(mesh);return true;}const c=cleanCfg(JSON.parse(s));apply(mesh,c,{});return true;}catch(e){return false;}};
function carPanel(){
 if(!MW.S) return;css();const model=modelOfCur(),cfg=cfgOf(),st=stats(model,cfg),key=keyOf(),t=TS(),pn=t.panne[key];
 const inst=[];for(const s of ORDER_PERF.concat(ORDER_STYLE)) if(cfg.p[s]) inst.push(PARTS[cfg.p[s]].nom);
 if(cfg.paint) inst.push(itemName({k:'paint',f:cfg.paint.f,c:cfg.paint.c,c2:cfg.paint.c2}));if(cfg.wrap) inst.push(itemName({k:'wrap',t:cfg.wrap.t,c:cfg.wrap.c}));if(cfg.wheels) inst.push(itemName({k:'wheels',m:cfg.wheels.m,i:cfg.wheels.i,c:cfg.wheels.c}));
 const h=`<p>${esc(st.sp.nom||'Votre voiture')}</p>${statRows(model,cfg,null)}
  <div class="mw-card"><div class="mw-row"><span>Fiabilité</span><b>${Math.round(relEff(key))} %</b></div><div class="mw-row"><span>Contrôle technique</span><b>${ctDays(key)>0?'valable '+ctDays(key)+' jours':'non passé'}</b></div>${pn?`<div class="mw-row"><span class="tn-dn">Panne : ${esc(pn.nom)}</span><b>${esc(fmt(pn.cost))}</b></div>`:''}</div>
  <h3 class="mw-h3">Modifications (${inst.length})</h3>${inst.length?'<ul class="mw-cond">'+inst.map(n=>`<li class="ok">${esc(n)}</li>`).join('')+'</ul>':'<p class="hint">Voiture d’origine. Les ateliers de préparation sont Prépa Vallon (sport) et l’Atelier Éclat (style), Rue des Ateliers.</p>'}
  <div class="mw-btns">${btn('loc1','Repérer Prépa Vallon','sm ghost')}${btn('loc2','Repérer l’Atelier Éclat','sm ghost')}${pn?btn('tow','Dépanneuse · 60 €','sm'):''}${btn('close','Fermer','ghost')}</div>`;
 MW.panel('Ma voiture',h,{wide:true,onClick:a=>{if(a==='loc1'||a==='loc2'){const id=a==='loc1'?'tune1':'tune2';MW.closePanel();MW.setMarker(id,MW.zone(id).nom);say('Repère placé (carte : M).','info');}
  else if(a==='tow'){if(MW.S.money>=60){MW.money(-60,'Dépanneuse');MW.closePanel();tow();}}else if(a==='close') MW.closePanel();}});}
api.carPanel=carPanel;
let visT=0;
MW.on('tick',dt=>{
 if(!MW.S||!MW.isOpen()) return;
 if(!MW.paused) kmTick(dt);
 soundTick(dt);
 visT+=dt;if(visT>.4){visT=0;const k=keyOf();if(k!==lastKey){lastKey=k;refreshDrv();}visualNow();}});
MW.on('minute',()=>{try{onMinute();ordersMinute();}catch(e){console.error('MWTUNE minute :',e);}});
MW.on('key',k=>{if(k==='u'&&MW.S) carPanel();});
MW.addButton('tuning','Ma voiture (U)',()=>{if(MW.S) carPanel();});
let lastKey='';
function init(){
 const t=TS();if(!t) return;css();lastKey=keyOf();
 try{const D=window.__mwj&&window.__mwj.noirData;if(D){const m=k=>D.MODELS[k]||[];D.MODELS.tune1=m('garage4').concat(m('garage2'));D.MODELS.tune2=m('garage3').concat(m('garage2'));D.TAUX.tune1=TAUX.tune1;D.TAUX.tune2=TAUX.tune2;}}catch(e){}
 for(const id of ['tune1','tune2']){const z=MW.zone(id);if(z&&z.ponts) z.libres=Math.max(1,z.ponts.length-1);MW.setDoor(id,doorPanel);}
 for(const z of MW.zones) if(z.type==='garage') regSpots(z.id);
 for(const id of ['tune1','tune2']) buildDecor(id);
 for(const id in t.equip) if(t.equip[id]&&(t.equip[id].banc||t.equip[id].cabine)) buildDecor(id);
 for(const id in OM){MW.scene.remove(OM[id]);delete OM[id];}
 for(const o of t.orders){ordMesh(o);regOrder(o);}
 stk.register();refreshDrv();visualNow();hudTune();}
MW.on('start',init);
/* l'atelier de préparation d'un garage dont on n'est plus propriétaire ne propose plus l'équipement */
MW.on('employerChanged',()=>{try{refreshDrv();hudTune();}catch(e){}});
api.state=()=>TS();api.hasard=true;
api.keyOf=keyOf;api.model=modelOfCur;
api.PARTS=PARTS;api.LIST=LIST;api.SLOTS=SLOTS;api.PAINTS=PAINTS;api.WRAPS=WRAPS;api.WHEELS=WHEELS;api.COLORS=COLORS;api.cfg=cfgOf;api.TPLS=TPLS;api.EQUIP=EQUIP;
api.setCfg=(key,c)=>{const t=TS();t.cars[key||keyOf()]=cleanCfg(c);commit(key||keyOf());};
api.visual=visualNow;
window.__mwt=api;
return api;})();
