'use strict';
const { attendre, attendreVisible, cliquer, verifier, attendreCondition } = require('../outils.js');

// Mode Mécanicien (décor) : ville texturée, garages meublés, qualité graphique réglable, appels de dessin raisonnables.
module.exports = async function mecaDecor(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S, null, { timeout: 15000 });
  await attendre(800);

  const r0 = await page.evaluate(() => ({ decor: !!(__mw.decor && __mw.decor.build), groupes: !!__mw.scene.getObjectByName('decor-core'), ciel: !!__mw.scene.getObjectByName('ciel'), tris: typeof MWD !== 'undefined' ? MWD.tris : 0 }));
  verifier(r0.decor && r0.groupes && r0.ciel, 'le décor n\'est pas construit (groupes ou ciel absents)');
  verifier(r0.tris > 20000, `le décor est vide (${r0.tris} triangles)`);

  // appels de dessin dans la rue et dans un garage, de jour et de nuit
  const appels = async (x, z, ry, h) => {
    await page.evaluate(([x, z, ry, h]) => { __mw.S.min = h * 60; __mw.teleport(x, z, ry, 0); }, [x, z, ry, h]);
    await attendre(500);
    return page.evaluate(() => __mw.renderer().info.render.calls);
  };
  for (const [nom, x, z, ry, h] of [['rue', -26, 8, -1.57, 12], ['garage', -72, 14, 0, 11], ['nuit', 50, -14, 3.14, 22], ['carrefour', 0, -14, 0, 18.8]]) {
    const n = await appels(x, z, ry, h);
    verifier(n > 5 && n < 400, `nombre d'appels de dessin inattendu (${nom}) : ${n}`);
  }

  // le réglage de qualité graphique du menu pause : basse → moyenne → haute
  await page.keyboard.press('Escape');
  await attendreVisible(page, '.mw-pn', "la touche Échap n'ouvre pas le menu pause");
  const lib = () => page.evaluate(() => { const b = document.querySelector('.mw-pn [data-mw="quality"]'); return b ? b.textContent : ''; });
  const l0 = await lib();
  verifier(/Qualité graphique/.test(l0), `l'option « Qualité graphique » est absente du menu pause (${l0})`);
  const vus = new Set([l0.replace(/ \(auto\)/, '')]);
  for (let i = 0; i < 3; i++) {
    await cliquer(page, '.mw-pn [data-mw="quality"]', 'bouton de qualité absent');
    await attendre(200);
    vus.add((await lib()).replace(/ \(auto\)/, ''));
  }
  verifier(vus.size === 3, `le bouton ne parcourt pas les trois niveaux (${[...vus].join(' / ')})`);
  const q = await page.evaluate(() => ({ stock: localStorage.getItem('bea.meca.q'), niv: MWD.Q.level, ombre: __mw.renderer().shadowMap.enabled, enc: __mw.renderer().outputEncoding }));
  verifier(['basse', 'moyenne', 'haute'].includes(q.stock) && q.niv === q.stock, 'le niveau de qualité n\'est pas mémorisé');
  verifier(q.enc === 3001, 'le rendu n\'est pas en sRGB');
  await page.keyboard.press('Escape');
  await attendreCondition(page, () => !__mw.paused, 'le menu pause ne se ferme pas', 8000);

  // le jour et la nuit : lampadaires allumés la nuit, éteints le jour
  await page.evaluate(() => { __mw.S.min = 12 * 60; });
  await attendreCondition(page, () => MWD.mat('lamph').emissiveIntensity < .05, 'les lampadaires restent allumés en plein jour', 20000);
  await page.evaluate(() => { __mw.S.min = 22 * 60; });
  await attendreCondition(page, () => MWD.mat('lamph').emissiveIntensity > 1, "les lampadaires ne s'allument pas la nuit", 20000);
  return 'décor texturé, qualité réglable, appels de dessin < 400, cycle jour/nuit';
};

module.exports.titre = 'mécanicien (décor) : ville, garages, qualité graphique, appels de dessin';
module.exports.appareil = 'bureau';
