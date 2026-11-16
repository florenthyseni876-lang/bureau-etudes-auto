'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (performance) : temps de calcul par image, part du rendu, appels de dessin et triangles dans trois
// situations types (rue en journée avec les passants, garage capot ouvert, carrefour). Les chiffres sont renvoyés dans le
// résultat pour comparer avant / après une optimisation. Sur l'ordinateur de test (rendu logiciel), seules les valeurs
// relatives comptent : les seuils sont larges.
module.exports = async function mecaPerf(page, env) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined', null, { timeout: 15000 });
  await attendre(800);
  const e = (f, a) => page.evaluate(f, a);
  // instrumentation : durée de chaque image (rappel de requestAnimationFrame) et durée de renderer.render
  await e(() => {
    const P = window.__perf = { f: [], r: 0, n: 0 };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => { const a = performance.now(); cb(t); P.f.push(performance.now() - a); });
    const R = __mw.renderer(), rr = R.render.bind(R);
    R.render = (s, c) => { const a = performance.now(); rr(s, c); P.r += performance.now() - a; P.n++; };
  });
  const mesure = async (nom, place, ms) => {
    await e(place);
    await attendre(1500);
    await e(() => { const P = window.__perf; P.f.length = 0; P.r = 0; P.n = 0; P.t0 = performance.now(); });
    await attendre(ms || 4000);
    return e((nom) => {
      const P = window.__perf, f = P.f.slice().sort((a, b) => a - b), n = f.length, s = f.reduce((a, b) => a + b, 0), info = __mw.renderer().info.render;
      return { nom, images: n, ips: +(n / ((performance.now() - P.t0) / 1000)).toFixed(1), msImage: +(s / Math.max(1, n)).toFixed(1), p95: +(f[Math.floor(n * .95)] || 0).toFixed(1),
        msRendu: +(P.r / Math.max(1, n)).toFixed(1), msLogique: +((s - P.r) / Math.max(1, n)).toFixed(1), appels: info.calls, triangles: info.triangles };
    }, nom);
  };
  const res = [];
  res.push(await mesure('rue', () => { __mw.S.min = 12 * 60; __mw.teleport(-26, 8, -1.57, 0); }));
  res.push(await mesure('carrefour', () => { __mw.S.min = 17 * 60; __mw.teleport(0, -14, 0, 0); }));
  res.push(await mesure('garage', () => {
    MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false }), p = __mw.zone(c.zone).ponts[c.pont];
    __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); MWG.run('hood', 'hopen');
  }));
  for (const r of res) {
    verifier(r.images > 0, `aucune image mesurée (${r.nom})`);
    verifier(r.appels < 400, `trop d'appels de dessin (${r.nom}) : ${r.appels}`);
  }
  return res.map(r => `${r.nom} : ${r.msImage} ms/image (rendu ${r.msRendu}, logique ${r.msLogique}, p95 ${r.p95}), ${r.ips} i/s, ${r.appels} appels, ${Math.round(r.triangles / 1000)} k triangles`).join(' | ');
};
module.exports.titre = 'mécanicien : performance (temps par image, rendu, logique, appels de dessin)';
module.exports.appareil = 'bureau';
