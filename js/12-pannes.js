'use strict';
/* ───────────── Pannes provoquées ───────────── */
const FAULTS={
  misfire:{n:E=>E.dz?'Injecteur HS (1 cylindre)':"Raté d'allumage (1 cylindre)",d:E=>`Un cylindre ne travaille plus : ${E.n-1} sur ${E.n} poussent encore. Moteur qui tremble, carburant imbrûlé qui surchauffe le catalyseur.`},
  boost:{n:()=>'Fuite de suralimentation',d:()=>"Une durit percée laisse fuir l'air comprimé : il ne reste qu'un cinquième de la pression.",ok:E=>E.boosted},
  coolant:{n:()=>'Pompe à eau HS',d:()=>"Le liquide ne circule plus : la température grimpe sans s'arrêter et le calculateur bride le moteur pour le protéger."},
  oilpump:{n:()=>'Pompe à huile usée',d:()=>"La pression d'huile s'effondre : le film ne tient plus dans les coussinets."},
  lambda:{n:()=>'Sonde lambda HS',d:()=>"Sans mesure d'oxygène, le calculateur enrichit par sécurité : moins de puissance, plus de consommation.",ok:E=>!E.dz&&S.fuelSys!=='carb'},
  cat:{n:()=>'Catalyseur colmaté',d:()=>"Les gaz ne s'évacuent plus : le moteur s'étouffe en haut et l'échappement surchauffe.",ok:()=>S.cat!=='none'},
  fuelpump:{n:()=>'Pompe à carburant faible',d:()=>"Le débit ne suit plus à forte demande : le moteur plafonne à 60 % de sa puissance."},
  timing:{n:()=>'Distribution décalée',d:()=>"La courroie ou la chaîne a sauté une dent : les soupapes s'ouvrent au mauvais moment, le moteur respire mal."},
  headgasket:{n:()=>'Joint de culasse claqué',d:()=>"Les gaz passent dans le circuit d'eau : perte de compression, surchauffe, fumée blanche."},
};
const faultOn=k=>!!ui.faults[k]&&(!FAULTS[k].ok||!M.E||FAULTS[k].ok(M.E));
function faultsUI(){
  const E=M.E,box=$('#faultChips');if(!box) return;
  for(const b of $$('[data-fault]',box)){const k=b.dataset.fault,f=FAULTS[k],ok=!f.ok||f.ok(E);b.textContent=f.n(E);b.disabled=!ok;b.setAttribute('aria-pressed',ok&&ui.faults[k]?'true':'false');}
  const act=Object.keys(FAULTS).filter(faultOn);
  $('#faultMsg').innerHTML=act.length?act.map(k=>`<li><b>${FAULTS[k].n(E)}</b> · ${FAULTS[k].d(E)}</li>`).join(''):'<li>Aucune panne active. Cliquez sur une panne pour la provoquer : le banc, le son, les chiffres en haut de page et l\'onglet Essais réagissent.</li>';
  $('#faultFix').hidden=!act.length;
}
