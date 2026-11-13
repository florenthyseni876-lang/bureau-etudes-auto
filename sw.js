/* Service hors connexion : fichier généré par outils/build.py, ne pas modifier sw.js à la main. */
const VERSION='bea-1d5f98333c';
const FICHIERS=[
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'vendor/three.min.js',
  'js/00-outils.js',
  'js/00b-paysage.js',
  'js/01-donnees.js',
  'js/02-etat.js',
  'js/03-moteur.js',
  'js/04-vehicule.js',
  'js/05-dessin-voiture.js',
  'js/06-dessin-moteur.js',
  'js/07-moteur-3d.js',
  'js/08-banc.js',
  'js/09-son.js',
  'js/10-combustion.js',
  'js/11-roulage.js',
  'js/12-pannes.js',
  'js/13-rotatif.js',
  'js/14-resistance.js',
  'js/15-graphiques.js',
  'js/16-planche.js',
  'js/17-essais.js',
  'js/18-reglages.js',
  'js/20-epoques.js',
  'js/21-carriere.js',
  'js/22-carriere-ui.js',
  'js/23-sons-fx.js',
  'js/24-carrosserie-vues.js',
  'js/25-essais-scene.js',
  'js/26-endurance.js',
  'js/27-mes-moteurs.js',
  'js/28-atelier.js',
  'js/30-competition.js',
  'js/19-rendu.js',
  'js/pwa.js',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
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
