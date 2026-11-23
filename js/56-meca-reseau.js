'use strict';
/* ───────────── Mode « Mécanicien » — JOUER À DEUX EN LIGNE ─────────────
   Deux joueurs, chacun sur son écran (ordinateur ou téléphone), dans le MÊME garage, sans serveur à nous : les deux
   navigateurs se parlent en direct (WebRTC, via la bibliothèque PeerJS chargée seulement à l'ouverture du menu « Jouer à deux… »).
   Le jeu solo ne change pas et marche hors connexion ; rien n'est chargé tant qu'on n'ouvre pas ce menu.

   ═══ Fonctionnement ═══
   · L'HÔTE fait autorité : heure, clients, argent et réputation du garage, voitures. L'INVITÉ reçoit l'état et envoie ses actions.
   · Menu Échap → « Jouer à deux… » : l'hôte clique « Héberger » et reçoit un code de 6 lettres ; l'ami le saisit et rejoint le monde
     de l'hôte (il travaille dans le garage de l'hôte, avec SES propres compétences, son inventaire et ses outils).
   · L'invité garde sa partie solo : elle est mise de côté à l'arrivée (sauvegarde protégée : seuls son expérience, son inventaire et
     ses outils évoluent), puis rétablie au départ.
   · Les voitures sont répliquées par DIFFÉRENCES : chaque côté compare toutes les 100 ms ses voitures à ce que l'autre connaît et envoie
     les changements. L'hôte vérifie ceux de l'invité (« la valeur d'avant est-elle encore la même ? ») : si l'ami a déjà démonté la même
     pièce, le geste est refusé et annulé (voiture et inventaire remis comme avant). Deux joueurs peuvent donc travailler sur la même
     voiture (roues d'un côté, capot de l'autre), mais jamais sur la même pièce au même moment.
   · L'argent PERSONNEL de chacun reste dans sa propre sauvegarde (chacun touche sa paie) ; le compte du garage (js/57, société) est géré par l'hôte.
   · Le temps : MW.addMin de l'invité est exécuté par l'hôte ; dormir demande l'accord des deux (MW.sleep attend l'ami) ; le menu d'un
     joueur ne met en pause que SON écran (le monde continue).
   · L'état est envoyé à 10 Hz au plus, les positions de l'ami sont interpolées. Seul un prénom choisi dans le jeu est transmis.

   ═══ Transport (petite interface) ═══
   Un transport sait : listen(code, cb) pour l'hôte, join(code, cb) pour l'invité ; le lien renvoyé a send(objet) et close().
   cb = {onReady, onOpen(lien), onMsg(objet), onClose(raison), onErr(texte)}.
   MWNET.transports.peer (PeerJS, internet) et MWNET.transports.bc (BroadcastChannel, même navigateur : utilisé par les tests).

   ═══ API `MWNET` ═══
   MWNET.menu()                 ouvre le panneau « Jouer à deux »
   MWNET.host({name,transport}) → Promise(code) ; MWNET.join(code,{name,transport}) → Promise ; MWNET.leave()
   MWNET.live()                 vrai quand deux joueurs sont connectés ; MWNET.role() 'host' | 'guest' | null ; MWNET.partnerName()
   MWNET.remote()               {name,x,z,ry,inCar,…} position lissée de l'ami ; MWNET.chat(texte) ; MWNET.busyMsg(carId,cible)
   MW.net = {live, guest, players()} lu par js/40 (horloge) et js/41 (clients). Raccourci de test : window.__mwnet. */
const MWNET=(()=>{
const T=THREE,PI=Math.PI;
const PREFIX='bea-meca-',PEER_URL='https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const TICK=100,TIMEOUT=12000,SAVE_KEY='bea.meca.v1',NAME_KEY='bea.meca.prenom',ALPHA='BCDFGHJKLMNPQRSTVWXZ';
const clone=o=>o===undefined?undefined:JSON.parse(JSON.stringify(o));
const r2=x=>Math.round(x*100)/100;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const esc2=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const N={live:false,guest:false,players:()=>N.live?2:1};
MW.net=N;
const api={transports:{}};

/* ═══════════ Différences entre deux états de voiture ═══════════ */
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function prune(v){ /* sans objets vides : « absent » et « {} » sont la même chose */
 if(!isObj(v)) return v;const o={};
 for(const k in v){const x=prune(v[k]);if(x===undefined||(isObj(x)&&!Object.keys(x).length)) continue;o[k]=x;}return o;}
const nz=v=>{const p=prune(v);return isObj(p)&&!Object.keys(p).length?undefined:p;};
const same=(a,b)=>JSON.stringify(nz(a))===JSON.stringify(nz(b));
function diff(a,b,path,out){
 if(isObj(a)||isObj(b)){const x=a===undefined?{}:a,y=b===undefined?{}:b;
  if(isObj(x)&&isObj(y)){const ks=new Set([...Object.keys(x),...Object.keys(y)]);for(const k of ks) diff(x[k],y[k],path.concat(k),out);return;}}
 if(same(a,b)) return;
 out.push({p:path,a:a===undefined?undefined:clone(a),b:b===undefined?undefined:clone(b)});}
/* compteurs additionnables (deux joueurs y touchent en même temps sans conflit) et valeurs « dernier écrit gagne » ; tout le reste est vérifié */
const SOFT_D=/^(g\.n|g\.min\..+|g\.bin\..+|comp\..+|ni|avance)$/,SOFT_W=/^(essai|clues|codes|autoDiag)$/;
/* 'f' : le responsable de la voiture (js/41, c.resp) : le premier qui la prend la garde, sans jamais faire refuser le geste de l'autre */
function kind(op){const k=op.p.join('.');if(k==='resp') return 'f';
 if(SOFT_D.test(k)&&(op.a===undefined||typeof op.a==='number')&&typeof op.b==='number') return 'd';
 if(SOFT_W.test(k)) return 'w';return 's';}
const getP=(c,p)=>{let o=c;for(const k of p){if(o==null) return undefined;o=o[k];}return o;};
function setP(c,p,v){let o=c;
 for(let i=0;i<p.length-1;i++){if(!isObj(o[p[i]])){if(v===undefined) return;o[p[i]]={};}o=o[p[i]];}
 const k=p[p.length-1];if(v===undefined) delete o[k];else o[k]=clone(v);}
function ensureG(c){const g=c.g;if(!isObj(g)) return;for(const k of ['w','k','p','bin','min']) if(!isObj(g[k])) g[k]={};if(typeof g.n!=='number') g.n=0;}
/* applique des différences ; check = vérification de l'hôte : refuse tout (et ne change rien) si une valeur d'avant a déjà bougé */
function applyOps(c,ops,check,keepG){
 if(check) for(const op of ops) if(kind(op)==='s'&&!same(getP(c,op.p),op.a)) return false;
 for(const op of ops){if(check&&kind(op)==='f'&&getP(c,op.p)!==undefined) continue;if(kind(op)==='d') setP(c,op.p,r2((getP(c,op.p)||0)+(op.b-(op.a||0))));else setP(c,op.p,op.b);}
 if(!keepG&&c.g) ensureG(c);return true;}

/* inventaire : on retire / on remet ce qui a changé pendant une fenêtre refusée */
function msDiff(x,y){const r=[],c={};for(const v of y) c[v]=(c[v]||0)+1;for(const v of x){if(c[v]>0) c[v]--;else r.push(v);}return r;}
function rollbackInv(before,after){const inv=MW.S&&MW.S.inv;if(!inv) return;const k=x=>JSON.stringify(x),b=before.map(k),a=after.map(k);
 for(const v of msDiff(a,b)){const i=inv.findIndex(x=>k(x)===v);if(i>=0) inv.splice(i,1);}
 for(const v of msDiff(b,a)) inv.push(JSON.parse(v));
 try{MWJ.invUI();}catch(e){}}

/* ═══════════ Transports ═══════════ */
const rid=()=>Math.random().toString(36).slice(2,10);
/* même navigateur : BroadcastChannel (tests, deux onglets) */
api.transports.bc={kind:'bc',
 listen(code,cb){const ch=new BroadcastChannel(PREFIX+code),self=rid();let guest=null,closed=false;
  const link={send(m){if(!closed&&guest) ch.postMessage({f:self,to:guest,m});},close(){if(closed) return;closed=true;try{if(guest) ch.postMessage({f:self,to:guest,m:{t:'bye'}});}catch(e){}ch.close();}};
  ch.onmessage=e=>{const d=e.data;if(!d||d.f===self||!d.m||(d.to&&d.to!==self)) return;
   if(!guest&&d.m.t==='hello'){guest=d.f;cb.onOpen(link);}
   if(d.f===guest) cb.onMsg(d.m);};
  setTimeout(()=>{if(!closed&&cb.onReady) cb.onReady();},0);return link;},
 join(code,cb){const ch=new BroadcastChannel(PREFIX+code),self=rid();let closed=false;
  const link={send(m){if(!closed) ch.postMessage({f:self,m});},close(){if(closed) return;closed=true;try{ch.postMessage({f:self,m:{t:'bye'}});}catch(e){}ch.close();}};
  ch.onmessage=e=>{const d=e.data;if(!d||d.f===self||!d.m||(d.to&&d.to!==self)) return;cb.onMsg(d.m);};
  setTimeout(()=>{if(!closed) cb.onOpen(link);},0);return link;}};
/* internet : PeerJS (WebRTC) */
let peerLoad=null;
function loadPeer(){
 if(window.Peer) return Promise.resolve();
 if(peerLoad) return peerLoad;
 peerLoad=new Promise((ok,ko)=>{const s=document.createElement('script');s.src=PEER_URL;s.async=true;
  s.onload=()=>window.Peer?ok():(peerLoad=null,ko(new Error('Peer absent')));s.onerror=()=>{peerLoad=null;ko(new Error('chargement'));};document.head.appendChild(s);});
 return peerLoad;}
api.transports.peer={kind:'peer',
 listen(code,cb){let peer=null,conn=null,closed=false;
  const link={send(m){try{if(conn&&conn.open) conn.send(m);}catch(e){}},close(){closed=true;try{if(conn) conn.close();}catch(e){}try{if(peer) peer.destroy();}catch(e){}}};
  loadPeer().then(()=>{if(closed) return;peer=new window.Peer(PREFIX+code,{debug:0});
   peer.on('open',()=>{if(cb.onReady) cb.onReady();});
   peer.on('error',e=>{if(!closed) cb.onErr((e&&e.type)||'erreur');});
   peer.on('connection',c=>{
    if(conn&&conn.open){c.on('open',()=>{try{c.send({t:'full'});}catch(e){}setTimeout(()=>{try{c.close();}catch(e){}},300);});return;} /* déjà deux joueurs */
    conn=c;c.on('open',()=>cb.onOpen(link));c.on('data',d=>cb.onMsg(d));c.on('close',()=>{if(conn===c&&!closed) cb.onClose('close');});c.on('error',()=>{});});
  }).catch(()=>{if(!closed) cb.onErr('lib');});
  return link;},
 join(code,cb){let peer=null,conn=null,closed=false;
  const link={send(m){try{if(conn&&conn.open) conn.send(m);}catch(e){}},close(){closed=true;try{if(conn) conn.close();}catch(e){}try{if(peer) peer.destroy();}catch(e){}}};
  loadPeer().then(()=>{if(closed) return;peer=new window.Peer({debug:0});
   peer.on('error',e=>{if(!closed) cb.onErr((e&&e.type)||'erreur');});
   peer.on('open',()=>{conn=peer.connect(PREFIX+code,{reliable:true,serialization:'json'});
    conn.on('open',()=>cb.onOpen(link));conn.on('data',d=>cb.onMsg(d));conn.on('close',()=>{if(!closed) cb.onClose('close');});conn.on('error',()=>{});});
  }).catch(()=>{if(!closed) cb.onErr('lib');});
  return link;}};

/* ═══════════ Session ═══════════ */
let role=null,link=null,status='idle',code='',myName='',other=null,backup=null,timer=0,lastRx=0,seq=0,frozen=false;
let lastN={},lastStr={},pend={},invPrev=[],lastFile='',lastSoc='',lastTn='',sw={me:0,he:0},swT=0,selfStart=false,lastChat=0,msgTxt='';
const jobs=()=>{try{return MWJ.state().cars;}catch(e){return [];}};
const carById=id=>jobs().find(c=>c.id===id)||null;
const send=m=>{if(link){try{link.send(m);}catch(e){}}};
const cleanName=s=>(String(s||'').replace(/[^A-Za-zÀ-ÿ0-9 '\-]/g,'').trim().slice(0,14))||'Mécano';
const savedName=()=>{try{return localStorage.getItem(NAME_KEY)||'';}catch(e){return '';}};
const saveName=n=>{try{localStorage.setItem(NAME_KEY,n);}catch(e){}};
const toast=(t,g)=>{try{MW.toast(t,g||'info');}catch(e){}};
const origAdd=MW.addMin,origSleep=MW.sleep,origSave=MW.save;

function makeCode(){let s='';for(let i=0;i<6;i++) s+=ALPHA[Math.floor(Math.random()*ALPHA.length)];return s;}
const myPos=()=>{const p=MW.player(),c=MW.playerCar(),w=typeof MWG!=='undefined'&&MWG.holding?MWG.holding():null;
 return {x:r2(p.x),z:r2(p.z),ry:r2(p.ry),ic:p.inCar?1:0,cx:r2(c.x),cz:r2(c.z),cr:r2(c.ry),cw:(MW.eyeY&&MW.eyeY<1.35)?1:0,ac:w||undefined};};

/* ── démarrage hôte / invité ── */
function trOf(o){const t=api.transports[(o&&o.transport)||'peer'];if(!t) throw new Error('transport inconnu');return t;}
const errTxt=e=>e==='peer-unavailable'?'Ce code ne correspond à aucun garage ouvert : vérifiez les 6 lettres (l\'ami doit avoir cliqué sur « Héberger »).'
 :(e==='lib'||e==='network'||e==='server-error'||e==='socket-error'||e==='socket-closed'||e==='webrtc')?'Impossible de joindre le service de rencontre (êtes-vous hors connexion ?). Le jeu solo reste disponible.'
 :e==='timeout'?'Pas de réponse : le code est-il bon, et votre ami a-t-il cliqué sur « Héberger » ?':e==='full'?'Ce garage a déjà deux joueurs.':e==='version'?'Les deux jeux ne sont pas à la même version : rechargez la page.':'Connexion impossible ('+e+').';
api.host=async function(o){
 o=o||{};if(!MW.S||!MW.isOpen()) throw new Error('Ouvrez d\'abord la carrière de mécanicien.');
 leave(null,{silent:true});const tr=trOf(o);myName=cleanName(o.name||savedName());saveName(myName);
 status='loading';refreshPanel();
 for(let n=0;n<6;n++){
  const c=makeCode();
  try{
   await new Promise((ok,ko)=>{link=tr.listen(c,{onReady:ok,onErr:ko,onOpen:onGuestOpen,onMsg:onMsg,onClose:()=>drop('Votre ami a quitté la partie.')});});
   role='host';code=c;status='hosting';msgTxt='';refreshPanel();return c;
  }catch(e){try{if(link) link.close();}catch(x){}link=null;
   if(e==='unavailable-id'&&n<5) continue;
   status='idle';role=null;msgTxt=errTxt(e);refreshPanel();throw new Error(errTxt(e));}}
 status='idle';throw new Error('Aucun code libre.');};
api.join=function(c,o){
 o=o||{};c=String(c||'').toUpperCase().replace(/[^A-Z]/g,'');
 if(!MW.S||!MW.isOpen()) return Promise.reject(new Error('Ouvrez d\'abord la carrière de mécanicien.'));
 if(c.length!==6) return Promise.reject(new Error('Le code a 6 lettres.'));
 leave(null,{silent:true});const tr=trOf(o);myName=cleanName(o.name||savedName());saveName(myName);
 role='guest';status='joining';code=c;msgTxt='';refreshPanel();
 return new Promise((ok,ko)=>{
  let done=false;const fin=(e)=>{if(done) return;done=true;clearTimeout(to);if(e){try{if(link) link.close();}catch(x){}link=null;role=null;status='idle';msgTxt=errTxt(e);refreshPanel();ko(new Error(errTxt(e)));}else ok();};
  const to=setTimeout(()=>fin('timeout'),15000);
  api._welcome=w=>{if(w.v!==1) return fin('version');becomeGuest(w);fin(null);};
  api._full=()=>fin('full');
  link=tr.join(c,{onOpen:l=>{l.send({t:'hello',name:myName,pid:MWS.pid(),v:1});},onMsg:onMsg,onErr:e=>fin(e),onClose:()=>{if(!done) fin('network');else drop('Connexion perdue.');}});});};

function onGuestOpen(l){ /* l'hôte : le 1er message « hello » arrive juste après */ }
function startLive(){
 N.live=true;N.guest=role==='guest';status='connected';lastRx=performance.now();
 lastN={};lastStr={};pend={};invPrev=clone(MW.S.inv)||[];lastFile='';lastTn='';sw={me:0,he:0};
 clearInterval(timer);timer=setInterval(netTick,TICK);
 buildAvatar();friendUI(true);
 MW.addButton('chat','Message (T)',()=>chatPanel());
 refreshPanel();}

/* ── l'hôte accepte l'invité ── */
function hostWelcome(m){
 if(N.live){send({t:'full'});return;}
 if(m.v!==1){send({t:'welcome',v:2});return;}
 other={name:cleanName(m.name)===myName?cleanName(m.name).slice(0,11)+' (2)':cleanName(m.name),pid:String(m.pid||'').slice(0,20),tgt:null,cur:null,seen:0,speed:0};
 const S=MW.S,C=(typeof MWC!=='undefined'&&MWC.state)?MWC.state():(S.career||{});
 const cars=jobs().filter(c=>!c.noir),J=MWJ.state(),pl=MW.player();
 startLive();
 for(const c of cars){lastN[c.id]=clone(c);lastStr[c.id]=JSON.stringify(c);}
 send({t:'welcome',v:1,name:myName,pid:MWS.pid(),day:S.day,min:S.min,rep:S.rep||0,soc:clone(S.soc||{}),seq:J.seq,next:J.next,file:clone(J.file)||[],cars:clone(cars),
  career:{emp:C.emp,grade:C.grade,ownZone:C.ownZone,founded:C.founded,everMeca:C.everMeca},px:pl.x,pz:pl.z,zone:(MWC&&MWC.employer?MWC.employer().zone:null)});
 {const due=MWS.flushDue(other.pid);if(due>0) send({t:'pay',dx:due,motif:'Versements de la société en attente'});}
 lastSoc=MWS.snapshot();
 toast(`${other.name} a rejoint votre garage. Les clients arrivent deux fois plus vite : chacun peut prendre une voiture.`,'good');}

/* ── l'invité rejoint le monde de l'hôte ── */
function becomeGuest(w){
 const S=MW.S;MWS.pid();backup=clone(S);selfStart=true;
 try{
  S.day=w.day;S.min=w.min;S.rep=w.rep;
  if(!isObj(S.career)) S.career={};Object.assign(S.career,w.career||{});
  const J=MWJ.state();J.seq=w.seq;J.next=w.next;J.file=w.file||[];J.cars=clone(w.cars)||[];
  other={name:cleanName(w.name),pid:String(w.pid||'').slice(0,20),tgt:null,cur:null,seen:0,speed:0};
  S.career.payFrom=w.day; /* sa paie à la semaine commence à son arrivée */
  startLive();MWS.setMirror(clone(w.soc||{}),other.pid,other.name);
  for(const c of J.cars){lastN[c.id]=clone(c);lastStr[c.id]=JSON.stringify(c);}
  MW.emit('start'); /* les modules reconstruisent le monde (voitures de l'hôte, employeur) */
  const z=w.zone&&MW.zone(w.zone);
  if(z){MW.setMarker(z.id);const p=z.accueil||z.porte;MW.teleport(p.x-(z.n?z.n.x:0)*1.5,p.z-(z.n?z.n.z:0)*1.5,z.ry);}
  else if(typeof w.px==='number') MW.teleport(w.px+1.5,w.pz,0);
 }finally{selfStart=false;}
 toast(`Vous avez rejoint le garage de ${other.name}. La réputation est partagée ; votre argent et votre expérience restent les vôtres.`,'good');}
function restoreSolo(){
 const S=MW.S;if(!S||!backup){backup=null;return;}
 const xp=S.xp,inv=(S.inv||[]),tools=S.jobs&&S.jobs.outils,gest=S.gest,money=S.money,copy=S.socCopy;
 const b=backup;backup=null;selfStart=true;
 try{
  for(const k of Object.keys(S)) delete S[k];Object.assign(S,b);
  S.xp=xp||S.xp||{};if(gest) S.gest=gest;if(typeof money==='number') S.money=money;if(copy) S.socCopy=copy;
  const ids=new Set(((S.jobs&&S.jobs.cars)||[]).map(c=>c.id));
  S.inv=inv.filter(it=>it.k!=='usagee'||ids.has(it.job));
  if(S.jobs&&tools) S.jobs.outils=Object.assign({},S.jobs.outils,tools);
  MW.applyState();MW.emit('start');
 }finally{selfStart=false;}}

/* ═══════════ Messages ═══════════ */
function onMsg(m){
 if(!m||typeof m!=='object') return;lastRx=performance.now();
 switch(m.t){
  case 'hello': if(role==='host') hostWelcome(m);break;
  case 'welcome': if(api._welcome) api._welcome(m);break;
  case 'full': if(api._full) api._full();break;
  case 'bye': drop(other?`${other.name} a quitté la partie.`:'Votre ami a quitté la partie.');break;
  case 'pos': case 'st': if(N.live) onState(m);break;
  case 'tn': if(N.live) onTune(m);break; /* [tuning] voiture préparée de l'ami (js/58) */
  case 'cars': if(N.live&&role==='guest') onCars(m);break;
  case 'cp': if(N.live) onCp(m);break;
  case 'rej': if(N.live&&role==='guest') onRej(m);break;
  case 'rm': if(N.live&&role==='host') onRm(m);break;
  case 'am': if(N.live&&role==='host') origAdd.call(MW,m.n);break;
  case 'so': if(N.live&&m.m){const k=m.m.k;if(k==='offer'||k==='offerok'||k==='offerno'){try{MWI.onSo(m.m);}catch(e){console.error(e);}}else if(role==='host') MWS.onGuestMsg(m.m,{pid:other.pid,name:other.name});}break;
  case 'pay': if(N.live&&role==='guest'&&isFinite(m.dx)) MW.money(+m.dx,String(m.motif||'').slice(0,120));break;
  case 'say': if(N.live) toast(String(m.txt||'').slice(0,200),m.g==='warn'||m.g==='good'||m.g==='crit'?m.g:'info');break;
  case 'soc': if(N.live&&role==='guest') MWS.setMirror(m.s,m.hp,m.hn);break;
  case 'stk': case 'stkq': if(N.live&&typeof MWST!=='undefined'&&(m.t==='stk'?role==='guest':role==='host')) MWST.onNet(m);break;
  case 'emp': if(N.live&&role==='guest'){Object.assign(MW.S.career,m.career||{});MW.emit('employerChanged',MW.S.career.emp);}break;
  case 'slq': if(N.live&&role==='host'){sw.he=m.on?(m.wk||1):0;swT=performance.now();toastSleep(m.on);swCheck();}break;
  case 'sleep': if(N.live&&role==='guest') runSleep(m.wk);break;
  case 'chat': if(N.live&&other) toast(`${other.name} : ${String(m.s||'').slice(0,80)}`,'good');break;}}
function onState(m){
 const p=m.t==='st'?m.p:m;if(!p||!other) return;
 other.tgt=p;other.seen=performance.now();if(!other.cur) other.cur={x:p.x,z:p.z,ry:p.ry,cx:p.cx,cz:p.cz,cr:p.cr};
 if(m.t==='st'&&role==='guest'){
  const S=MW.S,d0=S.day;S.day=m.day;S.min=m.min;S.rep=m.rep;
  if(m.day>d0&&m.day-d0<4) for(let d=d0+1;d<=m.day;d++) MW.emit('day',d); /* sa propre paie, ses prêts et ses charges personnelles */
  if(m.fl!==undefined){MWJ.state().file=m.fl;MWJ.rebuild(null);}
  sw.he=m.sw?m.sw[0]:0;sw.me=m.sw?m.sw[1]:0;showSleepHud();}}
/* [tuning] la voiture de l'ami garde ses modifications (peinture, jantes, kits…) */
function onTune(m){if(!other) return;other.tn=typeof m.s==='string'?m.s.slice(0,4000):null;applyTune();}
function applyTune(){try{if(av&&other&&typeof other.tn==='string'&&typeof MWTUNE!=='undefined') MWTUNE.unpack(other.tn,av.car);}catch(e){console.error(e);}}
function onCars(m){
 const J=MWJ.state();
 for(const id of m.del||[]){const c=carById(id);delete lastN[id];delete lastStr[id];if(c) MWJ.remove(c,true);}
 for(const f of m.add||[]){if(carById(f.id)) continue;const c=clone(f);J.cars.push(c);lastN[c.id]=clone(c);lastStr[c.id]=JSON.stringify(c);MWJ.rebuild(c);}
 if(m.seq!=null) J.seq=Math.max(J.seq,m.seq);if(m.next!=null) J.next=m.next;MWJ.rebuild(null);}
function afterRemote(c){
 try{MWJ.applyVisual(c,false);if(typeof MWG!=='undefined'&&MWG.refresh) MWG.refresh();MWJ.rebuild(null);}catch(e){console.error(e);}}
function onCp(m){
 const c=carById(m.id);
 if(role==='host'){ /* différences de l'invité : vérifiées par l'hôte */
  if(!c){send({t:'rej',id:m.id,seq:m.seq,gone:1});return;}
  if(applyOps(c,m.ops,true)){const ln=lastN[c.id]||(lastN[c.id]=clone(c));applyOps(ln,m.ops,false,true);afterRemote(c);}
  else{send({t:'rej',id:m.id,seq:m.seq,car:clone(c)});lastN[c.id]=clone(c);}
  return;}
 if(!c) return; /* l'invité applique sans discuter ce que décide l'hôte */
 const base=lastN[c.id];
 if(base&&m.ops.some(op=>kind(op)==='s'&&!same(getP(c,op.p),getP(base,op.p)))){
  /* l'ami a fait le même geste avant nous : on repart de l'état connu de l'hôte, on annule nos changements en attente (voiture et inventaire) */
  const nb=clone(base);applyOps(nb,m.ops,false);for(const k of Object.keys(c)) delete c[k];Object.assign(c,clone(nb));
  lastN[c.id]=clone(nb);lastStr[c.id]=JSON.stringify(c);
  const inv=clone(MW.S.inv)||[];rollbackInv(invPrev,inv);invPrev=clone(MW.S.inv)||[];
  afterRemote(c);toast(`Trop tard : ${other?other.name:'votre ami'} a déjà fait ce geste sur cette pièce. Le vôtre est annulé.`,'warn');return;}
 applyOps(c,m.ops,false);if(base) applyOps(base,m.ops,false,true);afterRemote(c);}
function onRej(m){
 const p=pend[m.seq];delete pend[m.seq];if(p) rollbackInv(p.before,p.after);
 const c=carById(m.id);
 if(m.gone||!m.car){if(c){delete lastN[m.id];delete lastStr[m.id];MWJ.remove(c,true);MWJ.rebuild(null);}return;}
 if(c){for(const k of Object.keys(c)) delete c[k];Object.assign(c,clone(m.car));lastN[c.id]=clone(c);lastStr[c.id]=JSON.stringify(c);afterRemote(c);}
 toast(`Trop tard : ${other?other.name:'votre ami'} a déjà fait ce geste sur cette pièce. Le vôtre est annulé.`,'warn');}
function onRm(m){
 const c=carById(m.id);if(c){MWJ.remove(c,true);}
 const S=MW.S;S.rep=clamp(r2((S.rep||0)+(+m.rep||0)),0,100);
 const J=MWJ.state();J.next=Math.max(J.next,MWJ.absT()+6);}

/* ═══════════ Boucle d'échange (10 Hz) ═══════════ */
function diffCar(c){
 const s=JSON.stringify(c);if(s===lastStr[c.id]) return null;
 lastStr[c.id]=s;const cur=JSON.parse(s),ops=[];
 if(!lastN[c.id]){lastN[c.id]=cur;return null;}
 diff(lastN[c.id],cur,[],ops);lastN[c.id]=cur;return ops.length?ops:null;}
function netTick(){
 if(!N.live||!MW.S) return;const now=performance.now();
 if(now-lastRx>TIMEOUT){drop('Connexion perdue : votre ami ne répond plus.');return;}
 if(frozen) return;
 const S=MW.S;
 try{if(typeof MWTUNE!=='undefined'){const tn=MWTUNE.pack();if(tn!==lastTn){lastTn=tn;send({t:'tn',s:tn});}}}catch(e){}
 if(role==='host'){
  const cars=jobs().filter(c=>!c.noir),ids=new Set(cars.map(c=>c.id));
  const add=cars.filter(c=>!(c.id in lastN)),del=Object.keys(lastN).filter(id=>!ids.has(id));
  const J=MWJ.state();
  if(add.length||del.length){for(const id of del){delete lastN[id];delete lastStr[id];}
   for(const c of add){lastN[c.id]=clone(c);lastStr[c.id]=JSON.stringify(c);}
   send({t:'cars',add:clone(add),del,seq:J.seq,next:J.next});}
  for(const c of cars){if(add.includes(c)) continue;const ops=diffCar(c);if(ops) send({t:'cp',id:c.id,ops});}
  const fl=JSON.stringify(J.file||[]),m={t:'st',day:S.day,min:S.min,rep:S.rep||0,p:myPos(),sw:[sw.me?1:0,sw.he?1:0]};
  if(fl!==lastFile){lastFile=fl;m.fl=J.file||[];}
  send(m);
  const sn=MWS.snapshot();if(sn!==lastSoc){lastSoc=sn;send({t:'soc',s:JSON.parse(sn),hp:MWS.pid(),hn:myName});}
  if(sw.me&&now-swT>90000){sw.me=0;showSleepHud();} if(sw.he&&now-swT>90000) sw.he=0;}
 else{
  send(Object.assign({t:'pos'},myPos()));
  const inv=clone(S.inv)||[];let any=false;
  for(const c of cars0()){const ops=diffCar(c);if(ops){any=true;const q=++seq;pend[q]={before:invPrev,after:inv,t:now};send({t:'cp',id:c.id,seq:q,ops});}}
  invPrev=inv;for(const q in pend) if(now-pend[q].t>15000) delete pend[q];}}
const cars0=()=>jobs().filter(c=>!c.noir);

/* ═══════════ Avatar de l'ami ═══════════ */
let av=null;
function nameTex(txt){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
 x.font='bold 34px sans-serif';x.textAlign='center';x.textBaseline='middle';x.lineWidth=7;x.strokeStyle='rgba(10,20,35,.9)';x.strokeText(txt,128,34);x.fillStyle='#8dffb0';x.fillText(txt,128,34);
 const t=new T.CanvasTexture(c);return t;}
function buildAvatar(){
 removeAvatar();if(!other) return;
 const g=new T.Group(),L=c=>new T.MeshLambertMaterial({color:c}),box=(w,h,d,c,x,y,z)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),L(c));m.position.set(x,y,z);return m;};
 const body=new T.Group();
 const legL=new T.Group(),legR=new T.Group();legL.position.set(-.12,.82,0);legR.position.set(.12,.82,0);
 legL.add(box(.17,.82,.2,0x2a3a5a,0,-.41,0));legR.add(box(.17,.82,.2,0x2a3a5a,0,-.41,0));
 const armL=new T.Group(),armR=new T.Group();armL.position.set(-.3,1.4,0);armR.position.set(.3,1.4,0);
 armL.add(box(.13,.6,.15,0xd8a030,0,-.28,0));armR.add(box(.13,.6,.15,0xd8a030,0,-.28,0));
 body.add(legL,legR,armL,armR,box(.46,.62,.26,0xd8a030,0,1.13,0),box(.24,.26,.24,0xe0b898,0,1.58,0),box(.26,.09,.26,0x2a2a2e,0,1.74,0));
 g.add(body);
 const car=MW.carMesh({color:0xd8a030,kind:'citadine'});
 const sp=new T.Sprite(new T.SpriteMaterial({map:nameTex(other.name),transparent:true,depthTest:false}));sp.scale.set(1.9,.475,1);sp.renderOrder=10;
 const root=new T.Group();root.add(g,car,sp);MW.scene.add(root);
 av={root,g,body,legL,legR,armL,armR,car,sp,ph:0};applyTune();}
function removeAvatar(){if(av){MW.scene.remove(av.root);av=null;}}
const lerpA=(a,b,k)=>{let d=b-a;while(d>PI) d-=PI*2;while(d<-PI) d+=PI*2;return a+d*k;};
function avatarFrame(dt){
 if(!av||!other||!other.tgt) return;const t=other.tgt,c=other.cur,k=1-Math.exp(-14*dt);
 const far=Math.hypot(t.x-c.x,t.z-c.z)>30;
 const ox=c.x,oz=c.z;
 if(far){c.x=t.x;c.z=t.z;c.cx=t.cx;c.cz=t.cz;}else{c.x+=(t.x-c.x)*k;c.z+=(t.z-c.z)*k;c.cx+=(t.cx-c.cx)*k;c.cz+=(t.cz-c.cz)*k;}
 c.ry=lerpA(c.ry,t.ry,k);c.cr=lerpA(c.cr,t.cr,k);
 const sp=Math.hypot(c.x-ox,c.z-oz)/Math.max(dt,.001);other.speed+=(sp-other.speed)*Math.min(1,dt*8);
 av.car.position.set(c.cx,0,c.cz);av.car.rotation.y=c.cr;
 const ic=!!t.ic;av.g.visible=!ic;
 av.g.position.set(c.x,0,c.z);av.g.rotation.y=c.ry;
 const cw=!!t.cw;av.body.scale.y=cw?.62:1;
 av.ph+=dt*Math.min(9,other.speed*2.4);const sw2=Math.min(1,other.speed/2.5)*Math.sin(av.ph)*.7;
 av.legL.rotation.x=sw2;av.legR.rotation.x=-sw2;av.armL.rotation.x=-sw2*.8;av.armR.rotation.x=sw2*.8;
 if(ic) av.sp.position.set(c.cx,2.6,c.cz);else av.sp.position.set(c.x,cw?1.5:2.1,c.z);
 other.cur=c;}
/* ── ami sur la mini-carte et sous elle ── */
function whereText(o){
 const z=MW.zoneAt(o.x,o.z);
 if(z&&z.ponts){let best=-1,bd=4.8;z.ponts.forEach((p,i)=>{const d=Math.hypot(p.x-o.x,p.z-o.z);if(d<bd){bd=d;best=i;}});if(best>=0) return `au pont ${best+1}`;}
 if(z) return (o.ic?'devant ':'à ')+z.court;
 return o.ic?'en voiture dans la ville':'dans la rue';}
let fEl=null,fTxt='';
function friendUI(on){
 const tr=document.querySelector('#mwRoot .mw-tr');
 if(!on){if(fEl){fEl.remove();fEl=null;}fTxt='';return;}
 if(!tr||fEl) return;fEl=document.createElement('div');fEl.className='mw-friend';fEl.id='mwFriend';fEl.setAttribute('role','status');
 const mini=tr.querySelector('#mwMini');tr.insertBefore(fEl,mini?mini.nextSibling:null);}
function friendTick(){
 if(!N.live||!other||!other.cur) return;if(!fEl) friendUI(true);if(!fEl) return;
 const t=other.cur,txt=`Votre ami est ${whereText({x:t.x,z:t.z,ic:other.tgt&&other.tgt.ic})}`;
 if(txt!==fTxt){fTxt=txt;fEl.textContent=txt;fEl.title=other.name;}}
MW.mapExtra=(x,X,Y,mini,fs)=>{
 if(!N.live||!other||!other.cur) return;const c=other.cur,px=X(c.x),py=Y(c.z),r=mini?4.5:Math.max(6,fs*.7);
 x.save();x.fillStyle='#3cd36a';x.strokeStyle='#0b2a16';x.lineWidth=2;x.beginPath();x.arc(px,py,r,0,7);x.fill();x.stroke();
 x.fillStyle='#07210f';x.font='bold '+(mini?8:Math.max(9,fs-1))+'px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(other.name[0].toUpperCase(),px,py+.5);
 if(!mini){x.lineWidth=3;x.strokeStyle='rgba(10,20,35,.9)';x.strokeText(other.name,px,py-r-7);x.fillStyle='#8dffb0';x.fillText(other.name,px,py-r-7);}
 x.restore();};
MW.on('tick',dt=>{if(N.live){avatarFrame(dt);friendTick();}});

/* ═══════════ Argent, temps, sommeil, sauvegarde ═══════════ */
function guestAdvance(n){const S=MW.S;let m=S.min;for(let i=0;i<n;i++){m++;if(m>=1440) m=0;if(m===360) S.day++;}S.min=m;}
MW.addMin=function(n){
 if(N.live&&role==='guest'){n=Math.max(0,Math.min(3000,Math.round(n)));if(N.sleeping){guestAdvance(n);return;}if(n) send({t:'am',n});return;}
 return origAdd.call(MW,n);};
function toastSleep(on){if(!other) return;if(on) toast(`${other.name} veut dormir. Allez dormir aussi (studio, touche E) : la nuit ne passe qu'à deux.`,'info');showSleepHud();}
function showSleepHud(){
 let h='';if(sw.he&&!sw.me&&other) h=`<b>${esc2(other.name)} veut dormir.</b> Allez dormir aussi pour passer la nuit.`;
 else if(sw.me&&!sw.he&&other) h=`En attente de <b>${esc2(other.name)}</b> pour dormir…`;
 try{MW.hud('netsleep',h);}catch(e){}}
function swCheck(){if(role==='host'&&sw.me&&sw.he){const wk=(typeof sw.me==='number'&&sw.me>1?sw.me:(typeof sw.he==='number'&&sw.he>1?sw.he:undefined));
 sw={me:0,he:0};send({t:'sleep',wk});runSleep(wk);}}
function runSleep(wk){N.sleeping=true;showSleepHud();origSleep.call(MW,wk);}
MW.on('slept',()=>{N.sleeping=false;try{MW.hud('netsleep','');}catch(e){}});
MW.sleep=function(wk){
 if(!N.live) return origSleep.call(MW,wk);
 if(sw.me){toast('Vous attendez déjà votre ami pour dormir.','info');return;}
 sw.me=(typeof wk==='number'&&wk>1)?wk:1;swT=performance.now();
 if(role==='guest') send({t:'slq',on:1,wk:typeof wk==='number'?wk:undefined});
 toast(`En attente de ${other?other.name:'votre ami'} : la nuit ne passe que si vous dormez tous les deux.`,'info');showSleepHud();
 if(role==='host') swCheck();};
/* la sauvegarde de l'invité reste SA partie solo (le monde de l'hôte n'y entre jamais) */
MW.save=function(){
 if(N.live&&role==='guest'&&backup){
  try{const o=clone(backup),S=MW.S;o.xp=clone(S.xp);o.money=S.money;if(S.socCopy) o.socCopy=clone(S.socCopy);o.inv=(S.inv||[]).filter(it=>it.k!=='usagee');if(o.jobs&&S.jobs&&S.jobs.outils) o.jobs.outils=clone(S.jobs.outils);
   localStorage.setItem(SAVE_KEY,JSON.stringify(o));return true;}catch(e){return false;}}
 return origSave.call(MW);};
/* voiture rendue par l'invité : l'hôte retire la voiture et applique la réputation */
MW.on('jobDone',job=>{if(N.live&&role==='guest'&&job){delete lastN[job.id];delete lastStr[job.id];send({t:'rm',id:job.id,rep:job.rep||0});}});

/* ═══════════ Messages courts (touche T) ═══════════ */
function sendChat(s){
 s=String(s||'').replace(/\s+/g,' ').trim().slice(0,80);if(!s||!N.live) return false;
 const now=performance.now();if(now-lastChat<800) return false;lastChat=now;
 send({t:'chat',s});toast('Vous : '+s,'info');return true;}
api.chat=sendChat;
function chatPanel(){
 if(!N.live) return;
 MW.panel('Message à '+(other?other.name:'votre ami'),`<p class="hint">Message court (80 lettres), vu par votre ami au-dessus de l'écran.</p><div class="mw-btns"><input id="mwNetChat" type="text" maxlength="80" autocomplete="off" placeholder="Votre message…" style="flex:1;min-width:180px;padding:8px;font-size:16px"><button type="button" class="btn" data-mw="send">Envoyer</button></div>`,
  {onClick:a=>{if(a==='send'){const i=document.getElementById('mwNetChat');if(i&&sendChat(i.value)) MW.closePanel();}}});
 const i=document.getElementById('mwNetChat');
 if(i){i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(sendChat(i.value)) MW.closePanel();}else if(e.key==='Escape'){e.preventDefault();MW.closePanel();}});setTimeout(()=>{try{i.focus();}catch(e){}},30);}}
MW.on('key',k=>{if(k==='t'&&N.live) chatPanel();});

/* ═══════════ Fin de partie à deux ═══════════ */
function drop(why){if(role) leave(why||'Connexion perdue.');}
function leave(why,o){
 o=o||{};const was=N.live,wasGuest=role==='guest'&&was,hadLink=!!link;
 clearInterval(timer);timer=0;
 if(link){if(hadLink&&!o.noBye){try{link.send({t:'bye'});}catch(e){}}try{link.close();}catch(e){}link=null;}
 N.live=false;N.guest=false;N.sleeping=false;role=null;status='idle';api._welcome=null;api._full=null;
 removeAvatar();friendUI(false);try{MW.removeButton('chat');MW.hud('netsleep','');}catch(e){}
 other=null;lastN={};lastStr={};pend={};sw={me:0,he:0};MWS.clearMirror();
 if(wasGuest&&!o.noRestore) restoreSolo();else backup=null;
 if(was&&why&&!o.silent) toast(why+(wasGuest?' Vous retrouvez votre partie solo.':' Vous continuez seul.'),'warn');
 refreshPanel();}
api.leave=()=>{leave(null,{silent:true});};
MW.on('employerChanged',()=>{if(N.live&&role==='host'){const C=MWC.state();send({t:'emp',career:{emp:C.emp,grade:C.grade,ownZone:C.ownZone,founded:C.founded}});}});
MW.on('close',()=>{if(role) leave('Partie à deux terminée.',{silent:true});});
MW.on('start',()=>{if(!selfStart&&role){leave('La partie a été remplacée.',{noRestore:true});}});
window.addEventListener('pagehide',()=>{if(link){try{link.send({t:'bye'});}catch(e){}}});

/* ═══════════ Menu « Jouer à deux » ═══════════ */
let panelOpen=false;
function inputVal(id){const e=document.getElementById(id);return e?e.value:'';}
function panelHTML(){
 if(N.live) return `<p>Vous jouez avec <b>${esc2(other.name)}</b> ${role==='host'?'dans <b>votre</b> garage (vous êtes l\'hôte).':'dans <b>son</b> garage.'}</p>
  <p class="hint">Réputation et compte du garage partagés · chacun son argent, son inventaire et son expérience · T : message · dormir demande l'accord des deux · le menu ne met en pause que votre écran.</p>
  <div class="mw-btns v"><button type="button" class="btn" data-mw="chat">Écrire un message (T)</button><button type="button" class="btn ghost" data-mw="leave">Quitter la partie à deux</button><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`;
 const m=msgTxt?`<p class="mw-soon" role="alert">${esc2(msgTxt)}</p>`:'';
 if(status==='hosting') return `<p>Donnez ce code à votre ami :</p><p class="mw-netcode" id="mwNetCode" style="font:700 40px/1.1 monospace;letter-spacing:.25em;text-align:center;margin:10px 0">${esc2(code)}</p>
  <p class="hint">En attente de votre ami… Il ouvre le jeu, Carrière de mécanicien, Échap, « Jouer à deux… », saisit ce code et clique « Rejoindre ». Vous pouvez fermer ce panneau et continuer à jouer.</p>${m}
  <div class="mw-btns"><button type="button" class="btn ghost" data-mw="leave">Annuler</button><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`;
 if(status==='loading'||status==='joining') return `<p>${status==='loading'?'Ouverture du garage partagé…':'Connexion au garage de votre ami…'}</p>${m}<div class="mw-btns"><button type="button" class="btn ghost" data-mw="leave">Annuler</button></div>`;
 return `<p>Jouez à deux en ligne, chacun sur son écran : l'un héberge et reçoit un code de 6 lettres, l'autre le saisit. Rien n'est envoyé à part le prénom ci-dessous.</p>
  <label class="hint" for="mwNetName">Votre prénom (visible par votre ami)</label>
  <div class="mw-btns"><input id="mwNetName" type="text" maxlength="14" autocomplete="off" value="${esc2(savedName())}" placeholder="Prénom" style="flex:1;min-width:160px;padding:8px;font-size:16px"></div>
  <div class="mw-btns v" style="margin-top:10px"><button type="button" class="btn" data-mw="host">Héberger (je reçois un code)</button></div>
  <label class="hint" for="mwNetJoin" style="display:block;margin-top:12px">Ou rejoindre un ami avec son code</label>
  <div class="mw-btns"><input id="mwNetJoin" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="CODE" style="width:9em;padding:8px;font-size:18px;text-transform:uppercase;letter-spacing:.2em"><button type="button" class="btn" data-mw="join">Rejoindre</button></div>${m}
  <p class="hint">Le jeu solo reste disponible hors connexion. La connexion passe par un service public de mise en relation (PeerJS), puis directement entre vos deux appareils.</p>
  <div class="mw-btns"><button type="button" class="btn ghost" data-mw="close">Fermer</button></div>`;}
function renderPanel(){
 panelOpen=true;
 MW.panel('Jouer à deux',panelHTML(),{onClick:a=>{
  if(a==='host'){const n=inputVal('mwNetName');api.host({name:n}).catch(()=>{});}
  else if(a==='join'){const n=inputVal('mwNetName'),c=inputVal('mwNetJoin');api.join(c,{name:n}).catch(e=>{msgTxt=e.message;refreshPanel();});}
  else if(a==='leave'){leave(null,{silent:true});msgTxt='';renderPanel();}
  else if(a==='chat'){MW.closePanel();setTimeout(chatPanel,0);}},
  onClose:()=>{panelOpen=false;}});
 const j=document.getElementById('mwNetJoin');if(j) j.addEventListener('input',()=>{j.value=j.value.toUpperCase().replace(/[^A-Z]/g,'');});
 for(const id of ['mwNetName','mwNetJoin']){const i=document.getElementById(id);if(i) i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const b=document.querySelector('#mwPb [data-mw="'+(id==='mwNetJoin'?'join':'host')+'"]');if(b) b.click();}});}}
function refreshPanel(){if(panelOpen) renderPanel();}
api.menu=function(){
 if(!MW.S) return;msgTxt='';renderPanel();
 if(!window.Peer&&!N.live) loadPeer().catch(()=>{}); /* la bibliothèque n'est chargée qu'à l'ouverture de ce menu */};

/* ═══════════ Lecture et outils de test ═══════════ */
Object.assign(api,{
 live:()=>N.live,role:()=>role,status:()=>status,code:()=>code,partnerName:()=>other?other.name:'',
 remote:()=>other&&other.cur?Object.assign({name:other.name,inCar:!!(other.tgt&&other.tgt.ic),crouch:!!(other.tgt&&other.tgt.cw),act:other.tgt&&other.tgt.ac||null,target:other.tgt},other.cur):null,
 avatar:()=>av,friendText:()=>fTxt,
 busyMsg:(carId,target)=>{const a=other&&other.tgt&&other.tgt.ac;if(!N.live||!a||performance.now()-other.seen>1500) return null;
  return a.car===carId&&a.target===target?`${other.name} est déjà en train de travailler sur cette pièce.`:null;},
 myName:()=>myName||savedName()||'Vous',partner:()=>other?{pid:other.pid,name:other.name}:null,
 sendSoc:m=>send({t:'so',m}),sendSo:m=>send({t:'so',m}),sendTo:m=>send(m),
 freeze:f=>{frozen=!!f;},      /* test : retarde les échanges pour simuler deux gestes simultanés */
 pending:()=>Object.keys(pend).length,
 swWant:()=>({me:sw.me,he:sw.he}),
 _diff:{diff,applyOps,prune,same}});
window.__mwnet=api;
return api;})();
