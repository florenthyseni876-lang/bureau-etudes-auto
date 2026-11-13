'use strict';
/* ───────────── Mes moteurs : bibliothèque de moteurs enregistrés ─────────────
   Un moteur enregistré garde tous les réglages de l'onglet Moteur. Il se recharge dans n'importe quel projet. */
const ENG_KEYS=()=>[...new Set(UI.moteur.flatMap(g=>g.items.map(i=>i.k)).filter(k=>k in DEF&&k!=='oilInt'&&k!=='kmYear'))];
function myEngines(){try{const a=JSON.parse(localStorage.getItem('bea.engines.v1')||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function saveMyEngines(a){try{localStorage.setItem('bea.engines.v1',JSON.stringify(a));return true;}catch(e){return false;}}
function engLabel(e){return `${e.name} · ${e.sum}`;}
function saveEngine(name){
  const E=M.E,s={};for(const k of ENG_KEYS()) s[k]=S[k];
  const list=myEngines(),nm=(name||'').trim()||`Moteur ${list.length+1}`;
  const rec={id:Date.now().toString(36),name:nm.slice(0,40),sum:`${E.c.lab} ${nf(E.L,1)} l · ${nf(E.peakP)} ch`,y:(typeof G!=='undefined'&&G)?G.y:null,s};
  const i=list.findIndex(x=>x.name===rec.name);if(i>=0) list[i]=rec;else list.unshift(rec);
  saveMyEngines(list.slice(0,60));return rec;
}
function loadEngine(id){
  const e=myEngines().find(x=>x.id===id);if(!e) return false;
  for(const k of ENG_KEYS()) if(e.s[k]!==undefined&&typeof e.s[k]===typeof DEF[k]) S[k]=e.s[k];
  S.injSize=e.s.injSize||0;S.ecuIdle=e.s.ecuIdle||0;S.oilInt=0;ui.broken=null;ui.dmg={};ui.sweep=null;ui.rpm=0;ui.load=0;
  return true;
}
// contrôle affiché dans l'onglet Moteur
function myEngCtl(){
  const wrap=el('div','f wide myeng',`<div class="f-top"><label for="myEngName">Mes moteurs</label><output id="myEngCount"></output></div>
   <div class="myeng-row"><input class="txt sm" type="text" id="myEngName" maxlength="40" placeholder="Nom du moteur" autocomplete="off"><button class="btn sm" type="button" id="myEngSave">Enregistrer et monter</button></div>
   <div class="myeng-row"><select id="myEngSel" class="sel" aria-label="Moteurs enregistrés"></select><button class="chip-btn" type="button" id="myEngLoad">Charger</button><button class="chip-btn" type="button" id="myEngBuild">Revoir le montage</button><button class="chip-btn" type="button" id="myEngDel">Supprimer</button></div>
   <p class="hint" id="myEngMsg">Enregistrez ce moteur pour le réutiliser dans d'autres voitures. À l'enregistrement, il est monté en atelier : regardez l'ingénieur, ou prenez sa place.</p>`);
  const sel=$('#myEngSel',wrap),msg=$('#myEngMsg',wrap),nameI=$('#myEngName',wrap);
  const fill=()=>{const L=myEngines();sel.innerHTML=L.length?L.map(e=>{const ok=!ERA||eraOK(e.s);return `<option value="${e.id}"${ok?'':' disabled'}>${engLabel(e).replace(/</g,'&lt;')}${ok?'':' (trop moderne)'}</option>`;}).join(''):'<option value="">Aucun moteur enregistré</option>';
    $('#myEngCount',wrap).textContent=L.length?`${L.length} enregistré${L.length>1?'s':''}`:'';for(const id of ['myEngLoad','myEngDel','myEngBuild']) $('#'+id,wrap).disabled=!L.length;};
  fill();
  wrap.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b) return;
    if(b.id==='myEngSave'){const rec=saveEngine(nameI.value||S.name);fill();sel.value=rec.id;msg.textContent=`« ${rec.name} » est enregistré.`;openAtelier(rec.name);}
    else if(b.id==='myEngLoad'&&sel.value){if(loadEngine(sel.value)){const e=myEngines().find(x=>x.id===sel.value);render();msg.textContent=`« ${e.name} » est monté dans ce projet.`;}}
    else if(b.id==='myEngBuild'&&sel.value){if(loadEngine(sel.value)){render();openAtelier(myEngines().find(x=>x.id===sel.value).name);}}
    else if(b.id==='myEngDel'&&sel.value){const e=myEngines().find(x=>x.id===sel.value);if(e&&confirm(`Supprimer le moteur « ${e.name} » ?`)){saveMyEngines(myEngines().filter(x=>x.id!==sel.value));fill();msg.textContent='Moteur supprimé.';}}
  });
  return wrap;
}
