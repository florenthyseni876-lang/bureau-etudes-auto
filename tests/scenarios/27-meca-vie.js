'use strict';
const { attendre, attendreVisible, cliquer, verifier, attendreCondition } = require('../outils.js');

// Mode Mécanicien (vie de la ville) : piétons et voitures présents, en mouvement, qui s'arrêtent devant le joueur,
// absents des garages, rares la nuit, et peu d'appels de dessin en plus.
module.exports = async function mecaVie(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwvie, null, { timeout: 15000 });

  // de jour, sur le trottoir : des piétons et des voitures apparaissent
  await page.evaluate(() => { MWD.setQuality('haute', false); __mw.S.min = 12 * 60; __mw.teleport(-26, 9, -1.57, 0); });
  await attendreCondition(page, () => { const s = __mwvie.stats(); return s.peds >= 5 && s.cars >= 4; }, 'aucun piéton ou aucune voiture dans la rue de jour', 60000);
  const pos = () => page.evaluate(() => [...__mwvie.peds, ...__mwvie.cars].map(o => o.on ? [o.x, o.z] : null));
  const avant = await pos();
  await page.evaluate(() => __mwvie.step(3));
  const apres = await pos();
  let deplaces = 0;
  for (let i = 0; i < avant.length; i++) if (avant[i] && apres[i] && Math.hypot(avant[i][0] - apres[i][0], avant[i][1] - apres[i][1]) > .5) deplaces++;
  verifier(deplaces >= 3, `les piétons et les voitures ne bougent pas (${deplaces} déplacés)`);

  // appels de dessin avec et sans PNJ (même vue)
  await page.evaluate(() => { __mw.teleport(-26, 9, -1.57, 0); });
  const calls = async () => { await attendre(700); return page.evaluate(() => __mw.renderer().info.render.calls); };
  const avec = await calls();
  await page.evaluate(() => { __mwvie.setWant(0, 0); __mwvie.clear(); });
  const sans = await calls();
  verifier(avec < 400, `trop d'appels de dessin avec les PNJ : ${avec}`);
  verifier(avec - sans <= 30, `les PNJ ajoutent trop d'appels de dessin : ${avec - sans} (${sans} → ${avec})`);

  // aucun PNJ dans un garage ni dans le terrain du travail au noir
  await page.evaluate(() => { __mwvie.setWant(48, 24); });
  await attendre(1500);
  await page.evaluate(() => { __mw.teleport(-72, 5, 0, 0); });
  let dedans = 0;
  for (let i = 0; i < 12; i++) {
    await attendre(500);
    dedans += await page.evaluate(() => {
      const zs = __mw.zones.filter(z => z.interior);
      const nogo = [-46, 28, -8, 54];
      let n = 0;
      for (const o of [...__mwvie.peds, ...__mwvie.cars]) if (o.on) {
        if (zs.some(z => Math.abs(o.x - z.x) < z.w / 2 && Math.abs(o.z - z.z) < z.d / 2)) n++;
        if (o.x > nogo[0] && o.x < nogo[2] && o.z > nogo[1] && o.z < nogo[3]) n++;
      }
      return n;
    });
  }
  verifier(dedans === 0, `des PNJ sont entrés dans un garage ou sur le terrain du travail au noir (${dedans} relevés)`);

  // une voiture arrive sur la voie du joueur à pied : elle s'arrête devant lui
  await page.evaluate(() => {
    __mwvie.clear(); __mwvie.setWant(0, 0);
    __mw.teleport(-75, 3.2, 1.57, 0);
    window.__vc = __mwvie.forceCar(0, 1, 1, -128, 11);
  });
  await page.evaluate(() => __mwvie.step(40));
  const stop = await page.evaluate(() => ({ v: window.__vc.v, on: window.__vc.on, x: window.__vc.x, why: window.__vc.why }));
  verifier(stop.on && stop.v < .2 && stop.x > -90, `la voiture ne s'arrête pas devant le joueur (${JSON.stringify(stop)})`);
  const arret = await page.evaluate(() => ({ cx: window.__vc.x, px: __mw.player().x }));
  verifier(arret.px - arret.cx > 2 && arret.px - arret.cx < 12, `la voiture s'est arrêtée à une distance inattendue du joueur (${(arret.px - arret.cx).toFixed(1)} m)`);

  // rares la nuit
  const dens = await page.evaluate(() => [__mwvie.density(12), __mwvie.density(3)]);
  verifier(dens[1][0] < dens[0][0] * .3 && dens[1][1] < dens[0][1] * .6, `la nuit n'est pas plus calme que le jour (${JSON.stringify(dens)})`);
  return 'piétons et voitures présents et mobiles, arrêt devant le joueur, aucun PNJ dans les garages, peu d\'appels de dessin';
};

module.exports.titre = 'mécanicien (vie de la ville) : piétons, circulation, arrêt devant le joueur, garages vides';
module.exports.appareil = 'bureau';
