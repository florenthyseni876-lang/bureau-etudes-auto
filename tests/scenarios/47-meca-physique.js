'use strict';
const { attendre, attendreVisible, cliquer, verifier, attendreCondition } = require('../outils.js');

// Mode Mécanicien (physique et hitbox) : freinage réaliste, rayon de braquage, stabilité à haute vitesse, rebond doux contre un mur,
// collision exacte (on peut s'approcher d'une voiture garée à moins de 30 cm), conduite réelle sans valeur absurde.
module.exports = async function mecaPhysique(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwphys && window.__mw.carSpec, null, { timeout: 15000 });
  await attendre(800);

  // 1. physique pure
  const ph = await page.evaluate(() => {
    const p = __mw.carSpec(), P = __mwphys;
    const sain = Object.assign({}, p, { vm: 40 });
    const freinage = P.simulerFreinage(sain, 50 / 3.6);
    const freinageSport = P.simulerFreinage(Object.assign({}, sain, { brk: 1.3, mu: 1.2 }), 50 / 3.6);
    const rayonLent = P.simulerRayon(sain, 1);
    const deltaLent = sain.deltaMax * sain.mu / (1 + Math.pow(1 / 7, 2));
    const rayonCine = sain.WB / Math.tan(deltaLent);
    // virage à fond à 14 m/s pendant 4 s : la voiture ne part pas en tête-à-queue
    const s = P.state(0, 0, 0); s.u = 14;
    let wMax = 0, finite = true;
    for (let t = 0; t < 4; t += .01) {
      P.step(s, sain, { gaz: s.u < 14 ? .5 : 0, volant: 1, frein: false }, .01);
      wMax = Math.max(wMax, Math.abs(s.w));
      if (![s.x, s.z, s.ry, s.u, s.w, s.r].every(Number.isFinite)) finite = false;
    }
    // frein à main : l'arrière décroche (la dérive dépasse celle d'un virage normal)
    const d = P.state(0, 0, 0); d.u = 14;
    let wDerive = 0;
    for (let t = 0; t < 2; t += .01) { P.step(d, sain, { gaz: 0, volant: .7, frein: true }, .01); wDerive = Math.max(wDerive, Math.abs(d.w)); }
    // accélération : 0 → 50 km/h en un temps raisonnable
    const a = P.state(0, 0, 0); let t50 = 0;
    while (a.u < 50 / 3.6 && t50 < 30) { P.step(a, sain, { gaz: 1, volant: 0, frein: false }, .01); t50 += .01; }
    // rebond doux contre un mur à z = 10
    const c = P.state(0, 0, 0); c.u = 8;
    const mur = (x, z, r) => (z + r > 10 ? { x, z: 10 - r, hit: true } : { x, z, hit: false });
    let apres = null, dedans = false;
    for (let i = 0; i < 400; i++) {
      P.step(c, sain, { gaz: 0, volant: 0, frein: false }, .01);
      const res = P.collisions(c, sain, mur);
      if (res.hit && apres == null) apres = { u: c.u, v: res.vitesse };
      if (c.z + sain.W / 2 > 10.02) dedans = true;
    }
    return { m: sain.m, WB: sain.WB, L: sain.L, W: sain.W, freinage, freinageSport, rayonLent, rayonCine, wMax, finite, wDerive, t50, apres, dedans };
  });
  verifier(ph.freinage >= 9 && ph.freinage <= 16, `freinage de 50 à 0 km/h : ${ph.freinage.toFixed(1)} m (attendu entre 9 et 16 m)`);
  const msgSport = `${ph.freinageSport.toFixed(1)} m contre ${ph.freinage.toFixed(1)} m`;
  verifier(ph.freinageSport < ph.freinage, `de meilleurs freins ne raccourcissent pas le freinage (${msgSport})`);
  const msgRayon = `${ph.rayonLent.toFixed(1)} m (attendu ${ph.rayonCine.toFixed(1)} m ± 15 %)`;
  verifier(Math.abs(ph.rayonLent / ph.rayonCine - 1) < .15, `rayon de braquage à 3,6 km/h : ${msgRayon}`);
  verifier(ph.wMax < 2.5 && ph.finite, `la voiture part en tête-à-queue à pleine butée à 50 km/h (dérive ${ph.wMax.toFixed(1)} m/s)`);
  verifier(ph.wDerive > 2.5, `le frein à main ne fait pas décrocher l'arrière (dérive ${ph.wDerive.toFixed(1)} m/s)`);
  verifier(ph.t50 > 2 && ph.t50 < 8, `0 à 50 km/h en ${ph.t50.toFixed(1)} s (attendu entre 2 et 8 s)`);
  verifier(ph.apres && ph.apres.v > 5, `le choc contre le mur n'est pas détecté (${JSON.stringify(ph.apres)})`);
  verifier(ph.apres.u < 0 && ph.apres.u > -3.5, `pas de rebond doux : vitesse après le choc ${ph.apres.u.toFixed(2)} m/s (attendu entre −3,5 et 0)`);
  verifier(!ph.dedans, 'la voiture traverse le mur');

  // 2. hitbox : on s'approche d'une voiture garée à moins de 30 cm de sa carrosserie, à pied et en voiture
  const h = await page.evaluate(() => {
    const garees = MWD.rueGaree.filter(p => Math.abs(p.x) < 250 && Math.abs(p.z) < 250);
    const sp = __mw.carSpec();
    const rien = [], resultats = [];
    for (const p of garees.slice(0, 10)) {
      const lx = Math.cos(p.ry), lz = -Math.sin(p.ry);
      for (const cote of [1, -1]) {
        const libre = (t) => !__mw.footHits(p.x + lx * cote * t, p.z + lz * cote * t);
        if (!libre(4)) continue; // côté trottoir ou façade : on teste l'autre côté
        let t = 4;
        while (t > 0 && libre(t)) t -= .01;
        const pied = t - p.W / 2 - .42;                       // écart entre le bord du joueur et la carrosserie
        let u = 5;
        while (u > 0 && !__mw.carHits(p.x + lx * cote * u, p.z + lz * cote * u, p.ry)) u -= .01;
        const voiture = u - p.W / 2 - sp.W / 2;                // écart entre les deux carrosseries
        resultats.push({ id: p.id, pied: +pied.toFixed(2), voiture: +voiture.toFixed(2) });
        break;
      }
      if (!resultats.length) rien.push(p.id);
    }
    return { resultats, n: garees.length };
  });
  verifier(h.resultats.length >= 4, `trop peu de voitures garées testables (${h.resultats.length})`);
  const piedMax = Math.max(...h.resultats.map(r => r.pied)), voitMax = Math.max(...h.resultats.map(r => r.voiture));
  verifier(piedMax < .3, `à pied, on est arrêté à ${(piedMax * 100).toFixed(0)} cm d'une voiture garée (attendu moins de 30 cm)`);
  verifier(voitMax < .3, `en voiture, on est arrêté à ${(voitMax * 100).toFixed(0)} cm d'une voiture garée (attendu moins de 30 cm)`);

  // 3. la voiture du joueur est un obstacle exact à pied
  const pv = await page.evaluate(() => {
    const c = __mw.playerCar(), sp = __mw.carSpec();
    const lx = Math.cos(c.ry), lz = -Math.sin(c.ry);
    let t = 4;
    while (t > 0 && !__mw.footHits(c.x + lx * t, c.z + lz * t)) t -= .01;
    return t - sp.W / 2 - .42;
  });
  verifier(pv < .1, `à pied, on est arrêté à ${(pv * 100).toFixed(0)} cm de sa propre voiture (attendu moins de 10 cm)`);

  // 4. conduite réelle : monter, accélérer, freiner ; aucune valeur absurde
  await page.evaluate(() => { __mwvie.setWant(0, 0); __mwvie.clear(); const c = __mw.playerCar(); __mw.teleport(c.x - 2.5, c.z, 0, 0); });
  await page.keyboard.press('f');
  await attendreCondition(page, () => __mw.player().inCar, 'on ne monte pas dans la voiture', 8000);
  await page.evaluate(() => { __mw.teleport(-26, -20, Math.PI, 0); });
  await page.keyboard.down('z');
  await attendreCondition(page, () => Math.abs(__mw.playerCar().speed) > 3, 'la voiture n\'accélère pas', 20000);
  const vit = await page.evaluate(() => __mw.playerCar().speed);
  await page.keyboard.up('z');
  await page.keyboard.down('s');
  await attendreCondition(page, () => Math.abs(__mw.playerCar().speed) < .5, 'la voiture ne s\'arrête pas au freinage', 30000);
  await page.keyboard.up('s');
  const fin = await page.evaluate(() => { const c = __mw.playerCar(); return [c.x, c.z, c.ry, c.speed].every(Number.isFinite); });
  verifier(fin, 'la conduite produit une valeur non finie');
  const ecarts = `${(piedMax * 100).toFixed(0)} cm à pied / ${(voitMax * 100).toFixed(0)} cm en voiture`;
  const bilan = `freinage 50 km/h : ${ph.freinage.toFixed(1)} m, rayon ${ph.rayonLent.toFixed(1)} m`;
  return `${bilan}, écart à une voiture garée : ${ecarts}, ${vit.toFixed(1)} m/s atteints`;
};
module.exports.titre = 'mécanicien (physique et hitbox) : freinage, braquage, rebond, collision exacte';
module.exports.appareil = 'bureau';
