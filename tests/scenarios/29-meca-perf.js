'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer } = require('../outils.js');

// Mode Mécanicien (performance) : temps par image, part du rendu, appels de dessin, triangles et plus longue image dans
// les situations types du jeu, dans les trois qualités graphiques :
//   rue (circulation, passants) · garage capot fermé · garage CAPOT OUVERT · sous la voiture levée ·
//   atelier de tuning · garage avec employés · intérieur d'un logement.
// Il mesure aussi le PIC à l'ouverture du capot (la plus longue image pendant les deux secondes qui suivent le geste).
// Sur l'ordinateur de test le rendu est logiciel : seules les valeurs relatives comptent, les seuils sont donc larges.
// Seuils : moins de 300 appels de dessin partout ; capot ouvert au plus 20 % plus lent que capot fermé ;
// aucune image de plus de 50 ms à l'ouverture du capot (hors rendu logiciel, voir PIC_MAX).
const SEUIL_APPELS = 300;
const PIC_MAX = 50;
const RATIO_MAX = 1.2;

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

  // lit les mesures accumulées depuis la dernière remise à zéro
  const lire = (nom) => e((nom) => {
    const P = window.__perf, f = P.f.slice().sort((a, b) => a - b), n = f.length, s = f.reduce((a, b) => a + b, 0), info = __mw.renderer().info.render;
    return {
      nom, images: n, ips: +(n / ((performance.now() - P.t0) / 1000)).toFixed(1), msImage: +(s / Math.max(1, n)).toFixed(1),
      p95: +(f[Math.floor(n * .95)] || 0).toFixed(1), max: +(f[n - 1] || 0).toFixed(1), plus50: f.filter(x => x > 50).length,
      msRendu: +(P.r / Math.max(1, n)).toFixed(1), msLogique: +((s - P.r) / Math.max(1, n)).toFixed(1),
      appels: info.calls, triangles: info.triangles,
    };
  }, nom);
  const raz = () => e(() => { const P = window.__perf; P.f.length = 0; P.r = 0; P.n = 0; P.t0 = performance.now(); });

  // met en place la situation, laisse la scène se stabiliser, puis mesure
  const mesure = async (nom, place, ms) => {
    await e(place);
    await attendre(1500);
    await raz();
    await attendre(ms);
    return lire(nom);
  };

  // le garage : une voiture sur le premier pont, le joueur devant, capot fermé
  const garage = () => {
    MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false }), p = __mw.zone(c.zone).ponts[c.pont];
    __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c);
    window.__perfPont = { x: p.x, z: p.z, ry: p.ry };
  };
  const ouvrir = () => MWG.run('hood', 'hopen');
  const fermer = () => MWG.run('hood', 'hclose');

  const res = [];
  const pics = [];
  for (const niv of ['basse', 'moyenne', 'haute']) {
    const ms = niv === 'basse' ? 3000 : 2200;
    await e((n) => { MWD.Q.auto = false; MWD.setQuality(n, false); }, niv);

    res.push(await mesure(niv + ' rue', () => { __mw.S.min = 12 * 60; __mw.teleport(-26, 8, -1.57, 0); }, ms));
    // ouverture du capot, deux fois :
    //  (1) à froid, juste après l'arrivée de la voiture (le moteur n'est pas encore préparé : pire cas, mesuré mais non contrôlé) ;
    //  (2) à chaud, après la préparation à l'avance que le jeu fait image par image pendant que le joueur marche vers la voiture
    //      (sur le rendu logiciel de test les images sont trop lentes pour qu'elle se termine seule : on la termine d'un coup).
    // On remet les compteurs à zéro juste avant le geste, puis on lit la plus longue image.
    await e(garage);
    await attendre(1200);
    await raz();
    await e(ouvrir);
    await attendre(2200);
    pics.push(await lire(niv + ' ouverture à froid'));
    await e(fermer); await attendre(800);
    await e(() => { __mwj.clear(); });
    await e(garage);
    await attendre(1500);
    await e(() => __mwcars.prechauffer());
    await attendre(500);
    await raz();
    await attendre(ms);
    res.push(await lire(niv + ' garage capot fermé'));
    await raz();
    await e(ouvrir);
    await attendre(2200);
    pics.push(await lire(niv + ' ouverture préparée'));
    res.push(await mesure(niv + ' garage capot ouvert', () => { }, ms));

    // sous la voiture levée : on referme, on lève le pont, on se baisse et on regarde vers le haut
    await e(fermer); await attendre(600);
    res.push(await mesure(niv + ' sous la voiture', () => {
      MWG.run('lift', 'raise');
      const p = window.__perfPont;
      __mw.teleport(p.x + Math.cos(p.ry) * 1.2, p.z - Math.sin(p.ry) * 1.2, p.ry - Math.PI / 2, 0.9);
    }, ms + 1500));

    // atelier de tuning (intérieur, devant la porte)
    res.push(await mesure(niv + ' tuning', () => {
      __mw.S.min = 600; const z = __mw.zone('tune1');
      __mw.teleport(z.porte.x, z.porte.z + 3, z.ry != null ? z.ry : 0, 0);
    }, ms));

    // garage avec employés : deux employés embauchés au Garage du Coin, le joueur à l'intérieur
    res.push(await mesure(niv + ' employés', () => {
      MWC.hire('patron'); __mw.S.min = 600; MWS.ensure('garage1'); MWS.deposit('garage1', 30000, 'test');
      if (MWEMP.staff('garage1').length < 2) {
        MWEMP.publish('garage1', 'meca', 2000); MWEMP.arrive('garage1', 3);
        for (const cv of MWEMP.cvList('garage1').slice(0, 2)) { try { MWEMP.hire('garage1', cv.id, 2000); } catch (err) { } }
      }
      for (let i = 0; i < 5; i++) __mw.addMin(1);
      const z = __mw.zone('garage1'), p = z.ponts[0];
      __mw.teleport(p.x + 6, p.z - 6, 0, 0);
    }, ms));

    // intérieur d'un logement : on entre dans le studio
    await e(() => { const z = __mw.zone('appart'); __mw.teleport(z.porte.x, z.porte.z, Math.atan2(z.n.x, z.n.z)); });
    try { await attendreCondition(page, () => window.__mwl && __mwl.inside() === 'appart', 'entrée au studio', 8000); } catch (err) { /* mesuré quand même */ }
    res.push(await mesure(niv + ' logement', () => { }, ms));
    await e(() => { const z = __mw.zone('appart'); __mw.teleport(z.porte.x, z.porte.z - 2, Math.atan2(z.n.x, z.n.z) + Math.PI, 0); });
    await attendre(800);
  }

  // table lisible, renvoyée aussi en cas d'échec pour garder les chiffres
  const ligne = r => `${r.nom} : ${r.msImage} ms/image (rendu ${r.msRendu}, logique ${r.msLogique}, p95 ${r.p95}, max ${r.max}), ${r.ips} i/s, ${r.appels} appels, ${Math.round(r.triangles / 1000)} k triangles`;
  const table = res.map(ligne).join(' | ') + ' || PICS À L\'OUVERTURE : ' + pics.map(p => `${p.nom} max ${p.max} ms (${p.plus50} images > 50 ms)`).join(' ; ');

  // PERF_SORTIE=fichier : écrit la table complète (le lanceur coupe les messages d'échec)
  if (process.env.PERF_SORTIE) require('fs').writeFileSync(process.env.PERF_SORTIE, res.map(ligne).join('\n') + '\n' + pics.map(p => `${p.nom} max ${p.max} ms (${p.plus50} images > 50 ms)`).join('\n') + '\n');
  const echecs = [];
  for (const r of res) {
    if (!(r.images > 0)) echecs.push(`aucune image mesurée (${r.nom})`);
    if (!(r.appels < SEUIL_APPELS)) echecs.push(`trop d'appels de dessin (${r.nom}) : ${r.appels}`);
  }
  for (const niv of ['basse', 'moyenne', 'haute']) {
    const f = res.find(r => r.nom === niv + ' garage capot fermé'), o = res.find(r => r.nom === niv + ' garage capot ouvert');
    if (f && o && o.msImage > f.msImage * RATIO_MAX + 1) echecs.push(`capot ouvert trop lent en ${niv} : ${o.msImage} ms contre ${f.msImage} ms capot fermé`);
    if (o && f && o.appels > f.appels + 90) echecs.push(`capot ouvert : ${o.appels - f.appels} appels de dessin de plus en ${niv}`);
  }
  // le pic n'est contrôlé que si le rendu n'est pas logiciel (sur le rendu logiciel toute image est lente)
  const logiciel = await e(() => MWD.Q.soft);
  if (!logiciel) for (const p of pics.filter(p => /préparée/.test(p.nom))) if (p.max > PIC_MAX) echecs.push(`saccade à l'ouverture du capot (${p.nom}) : ${p.max} ms`);
  if (echecs.length) throw new Error(echecs.join(' ; ') + ' || ' + table);
  return table;
};
module.exports.titre = 'mécanicien : performance (temps par image, rendu, logique, appels de dessin, pic à l\'ouverture du capot)';
module.exports.appareil = 'bureau';
