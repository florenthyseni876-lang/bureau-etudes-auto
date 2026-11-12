/* Service hors connexion : fichier généré par outils/build.py, ne pas modifier sw.js à la main. */
const VERSION='bea-__VERSION__';
const FICHIERS=[
  __FICHIERS__
];
const POLICES='bea-polices';
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FICHIERS)));});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!==POLICES).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='skip') self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET') return;
  const url=new URL(req.url);
  // polices Google : gardées après le premier chargement
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open(POLICES).then(c=>c.match(req).then(r=>r||fetch(req).then(res=>{if(res.ok||res.type==='opaque') c.put(req,res.clone());return res;}))));
    return;
  }
  if(url.origin!==location.origin) return;
  // fichiers de l'application : depuis le cache, sinon le réseau
  e.respondWith(caches.open(VERSION).then(c=>c.match(req,{ignoreSearch:true}).then(r=>r||fetch(req).catch(()=>req.mode==='navigate'?c.match('index.html'):Response.error()))));
});
