'use strict';
const { attendre, attendreVisible, cliquer, verifier, attendreCondition } = require('../outils.js');

// Mode Mécanicien (ville) : rues nommées, panneaux de direction, places de stationnement, guidage vers le repère, carte lisible.
module.exports = async function mecaVille(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S, null, { timeout: 15000 });
  await attendre(800);

  // rues nommées et panneaux de direction (un atlas dessiné, un maillage fusionné)
  const v = await page.evaluate(() => ({
    rues: __mw.streets && __mw.streets.ns.length === 3 && __mw.streets.ew.length === 3,
    atlas: !!(MWD.dirsCanvas && MWD.dirsCanvas.width >= 1024),
    maillage: (() => { let n = 0; __mw.scene.traverse(o => { if (o.isMesh && /dirs/.test(o.name)) n++; }); return n; })(),
  }));
  verifier(v.rues, 'les six rues nommées sont absentes (MW.streets)');
  verifier(v.atlas, "l'atlas des panneaux de direction n'est pas dessiné");
  verifier(v.maillage >= 1, 'aucun panneau de direction dans la scène');

  // guidage : repère posé → flèche, nom et distance ; aucun repère → masqué
  await page.evaluate(() => { __mw.teleport(-26, 9, -1.57, 0); __mw.setMarker('banque'); });
  await attendreCondition(page, () => { const g = document.getElementById('mwGuide'); return g && !g.hidden && /Banque.*\d+ m/.test(g.textContent); }, 'le guidage vers la banque (nom + distance) ne s\'affiche pas', 8000);
  await page.evaluate(() => { __mw.setMarker(null); });
  // l'objectif en cours peut reposer aussitôt son propre repère (toutes les 0,6 s) : le guidage doit toujours suivre le repère affiché
  await attendreCondition(page, () => { const g = document.getElementById('mwGuide'), m = __mw.S.marker, z = m && __mw.zone(m);
    return m ? (!g.hidden && !/Banque/.test(g.textContent) && (!z || g.textContent.includes((z.court || z.nom).split(' ')[0]))) : g.hidden; }, 'le guidage ne suit pas le repère affiché', 8000);

  // carte : s'ouvre, se redessine sans erreur, avec le repère
  await page.evaluate(() => { __mw.setMarker('garage1'); });
  await page.keyboard.press('m');
  await attendreVisible(page, '#mwBig', "la carte ne s'ouvre pas");
  await attendre(600);
  const px = await page.evaluate(() => { const c = document.getElementById('mwBig'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let blanc = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 225) blanc++; return blanc; });
  verifier(px > 400, `la carte ne porte ni noms ni légende lisibles (${px} px clairs)`);
  await page.keyboard.press('m');

  // appels de dessin dans une rue à panneaux
  for (const [x, z, ry] of [[-9.9, -33, 0], [0, 100, 0]]) {
    await page.evaluate(([x, z, ry]) => { __mw.S.min = 12 * 60; __mw.teleport(x, z, ry, 0); }, [x, z, ry]);
    await attendre(700);
    const n = await page.evaluate(() => __mw.renderer().info.render.calls);
    verifier(n > 5 && n < 400, `nombre d'appels de dessin inattendu près des panneaux : ${n}`);
  }
  return 'rues nommées, panneaux de direction, guidage, carte lisible';
};

module.exports.titre = 'mécanicien (ville) : rues nommées, panneaux, guidage, carte';
module.exports.appareil = 'bureau';
