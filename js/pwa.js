'use strict';
/* Application installable : service hors connexion, bouton d'installation, avis de mise à jour. */
(()=>{
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  // service hors connexion
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
    addEventListener('load',()=>{
      navigator.serviceWorker.register('sw.js').then(reg=>{
        const offer=w=>{const t=document.getElementById('updToast');if(!t) return;t.hidden=false;document.getElementById('updBtn').onclick=()=>w.postMessage({type:'skip'});};
        if(reg.waiting&&navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w) return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller) offer(w);});});
        setInterval(()=>reg.update().catch(()=>{}),60*60*1000);
      }).catch(()=>{});
      let reloaded=false;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloaded) return;reloaded=true;location.reload();});
    });
  }
  // bouton d'installation
  const btn=document.getElementById('installBtn'),help=document.getElementById('installHelp');
  if(!btn||standalone) return;
  let deferred=null;
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;btn.hidden=false;});
  if(ios) btn.hidden=false;
  btn.addEventListener('click',async()=>{
    if(deferred){deferred.prompt();try{await deferred.userChoice;}catch(e){}deferred=null;btn.hidden=true;}
    else if(help) help.hidden=false;
  });
  if(help) help.addEventListener('click',e=>{if(e.target===help||e.target.closest('[data-close]')) help.hidden=true;});
  addEventListener('appinstalled',()=>{btn.hidden=true;});
})();
