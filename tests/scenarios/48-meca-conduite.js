'use strict';
const { attendre, attendreVisible, cliquer, verifier, attendreCondition } = require('../outils.js');

// Mode Mécanicien (conduite) : la masse, la puissance et la transmission réelles de chaque modèle changent l'accélération, le freinage,
// la tenue de route et les chocs ; le tuning (js/58) agit sur ce modèle ; roulis et tangage visibles.
module.exports = async function mecaConduite(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwphys && window.__mwfeel, null, { timeout: 15000 });
  await attendre(800);

  const r = await page.evaluate(() => {
    const P = __mwphys;
    const specDe = (id, drv, surcharge) => {
      const f = MWCARS.get(id);
      return Object.assign(P.spec({ L: f.L, W: f.W, H: f.H, WB: f.WB, mdl: id }, Object.assign({ vm: 55 }, drv || {})), surcharge || {});
    };
    const zeroCent = (p) => {
      const s = P.state(0, 0, 0);
      let t = 0;
      while (s.u < 100 / 3.6 && t < 40) {
        P.step(s, p, { gaz: 1, volant: 0, frein: false }, .01);
        t += .01;
      }
      return t;
    };
    const zeroCinquante = (p) => {
      const s = P.state(0, 0, 0);
      let t = 0;
      while (s.u < 50 / 3.6 && t < 40) {
        P.step(s, p, { gaz: 1, volant: 0, frein: false }, .01);
        t += .01;
      }
      return t;
    };
    // virage à pleine accélération : dérive maximale (m/s) après 1 s, et résultat d'un contre-braquage
    const virage = (p, volant) => {
      const s = P.state(0, 0, 0);
      s.u = 10;
      let wMax = 0;
      for (let t = 0; t < 4; t += .01) {
        P.step(s, p, { gaz: 1, volant, frein: false }, .01);
        if (t > 1) wMax = Math.max(wMax, Math.abs(s.w));
      }
      return { wMax, rayon: Math.hypot(s.u, s.w) / Math.max(1e-6, Math.abs(s.r)) };
    };
    const contreBraquage = (p) => {
      const s = P.state(0, 0, 0);
      s.u = 10;
      let reaction = null;
      for (let t = 0; t < 8; t += .01) {
        let volant = .8, gaz = 1;
        if (reaction == null && Math.abs(s.w) > 1.5) reaction = t + .25;
        if (reaction != null && t >= reaction) {
          volant = (s.r < 0 ? -.5 : .5) * Math.min(1, Math.abs(s.w) / 3);
          gaz = .15;
        }
        P.step(s, p, { gaz, volant, frein: false }, .01);
      }
      return { reaction, wFinal: Math.abs(s.w), uFinal: s.u };
    };
    const trois = ['fiat500', 'golf7', 'a6c8'].map((id) => {
      const p = specDe(id);
      return { id, m: p.m, ch: p.puissance / 735.5 / .88, trad: p.traction, t100: zeroCent(p), frein: P.simulerFreinage(p, 50 / 3.6) };
    });
    const m3 = (drive) => specDe('m3g80', {}, { traction: drive, a: 2.86 * (drive === 'fwd' ? .4 : .47), b: 2.86 * (drive === 'fwd' ? .6 : .53) });
    const trans = {};
    for (const d of ['fwd', 'rwd', 'awd']) {
      trans[d] = { t50: zeroCinquante(m3(d)), virage: virage(m3(d), .8) };
    }
    const contre = contreBraquage(m3('rwd'));
    // tuning : allègement, pneus, autobloquant
    const base = specDe('bmw320d');
    const allege = specDe('bmw320d', { mass: base.m - 120 });
    const pneus = specDe('bmw320d', { grip: 1.2 });
    const lsd = specDe('bmw320d', { trac: .12 });
    const tun = {
      t50: zeroCinquante(base), t50Allege: zeroCinquante(allege), t50Lsd: zeroCinquante(lsd),
      frein: P.simulerFreinage(base, 50 / 3.6), freinPneus: P.simulerFreinage(pneus, 50 / 3.6),
    };
    // chocs : une voiture légère est plus repoussée qu'une lourde par la même voiture
    const choc = (masseAutre) => {
      const s = P.state(0, 0, 0);
      s.u = 8;
      const res = P.chocVoiture(s, base, { x: 0, z: 3.5, vx: 0, vz: 0, m: masseAutre });
      return res ? Math.hypot(res.dvx, res.dvz) : 0;
    };
    return { trois, trans, contre, tun, chocLeger: choc(850), chocLourd: choc(2000) };
  });

  const [leger, moyen, lourd] = r.trois;
  const s1 = (v) => v.toFixed(1);
  const s2 = (v) => v.toFixed(2);
  for (const c of r.trois) {
    verifier(c.t100 > 3.5 && c.t100 < 16, `${c.id} : 0 à 100 km/h en ${s1(c.t100)} s (attendu entre 3,5 et 16 s)`);
    verifier(c.frein > 8.5 && c.frein < 14, `${c.id} : freinage 50 à 0 km/h sur ${s1(c.frein)} m (attendu entre 8,5 et 14 m)`);
  }
  verifier(leger.t100 > lourd.t100,
    `la citadine légère de 69 ch (${s1(leger.t100)} s) devrait être plus lente que la grande berline de 231 ch (${s1(lourd.t100)} s)`);
  const parMasse = r.trois.map((c) => `${c.m} kg ${s1(c.frein)} m`).join(', ');
  verifier(leger.frein < moyen.frein && moyen.frein < lourd.frein, `la distance de freinage doit croître avec la masse : ${parMasse}`);

  const { fwd, rwd, awd } = r.trans;
  const msgDepart = `4×4 ${s2(awd.t50)} s, propulsion ${s2(rwd.t50)} s, traction ${s2(fwd.t50)} s (le 4×4 doit gagner)`;
  verifier(awd.t50 < rwd.t50 && rwd.t50 <= fwd.t50 + .05, `motricité au départ : ${msgDepart}`);
  const msgDerive = `propulsion ${s1(rwd.virage.wMax)} m/s, traction ${s1(fwd.virage.wMax)}, 4×4 ${s1(awd.virage.wMax)}`;
  verifier(rwd.virage.wMax > 3 && fwd.virage.wMax < 1.2 && awd.virage.wMax < 1.2,
    `dérive en virage à pleine accélération : ${msgDerive} (la propulsion doit survirer)`);
  verifier(r.contre.reaction != null && r.contre.wFinal < 1.5,
    `le contre-braquage ne rattrape pas la glisse de la propulsion (dérive finale ${s1(r.contre.wFinal)} m/s)`);

  const t = r.tun;
  verifier(t.t50Allege < t.t50, `l'allègement n'accélère pas la voiture (${s2(t.t50Allege)} s contre ${s2(t.t50)} s)`);
  verifier(t.freinPneus < t.frein, `de meilleurs pneus ne raccourcissent pas le freinage (${s1(t.freinPneus)} m contre ${s1(t.frein)} m)`);
  verifier(t.t50Lsd <= t.t50, `l'autobloquant ne fait pas perdre de temps au départ (${s2(t.t50Lsd)} s contre ${s2(t.t50)} s)`);
  verifier(r.chocLeger > r.chocLourd * 1.3,
    `dans un choc, la voiture légère doit être nettement plus repoussée (${s2(r.chocLeger)} m/s contre ${s2(r.chocLourd)} m/s)`);

  // en jeu : roulis et tangage visibles au volant
  await page.evaluate(() => { __mwvie.setWant(0, 0); __mwvie.clear(); const c = __mw.playerCar(); __mw.teleport(c.x - 2.5, c.z, 0, 0); });
  await page.keyboard.press('f');
  await attendreCondition(page, () => __mw.player().inCar, 'on ne monte pas dans la voiture', 8000);
  await page.evaluate(() => { __mw.teleport(-26, -20, Math.PI, 0); });
  await page.keyboard.down('z');
  await attendreCondition(page, () => Math.abs(__mw.playerCar().speed) > 2.5, "la voiture n'accélère pas", 20000);
  await page.keyboard.down('d');
  await attendreCondition(page, () => Math.abs(__mwfeel.roulis()) > .004, 'aucun roulis visible en virage', 20000);
  await page.keyboard.up('d');
  await page.keyboard.up('z');
  const rot = await page.evaluate(() => {
    const m = __mw.playerCar().mesh;
    return [m.rotation.x, m.rotation.y, m.rotation.z].every(Number.isFinite);
  });
  verifier(rot, 'la caisse a une rotation non finie');
  const bilan = r.trois.map((c) => `${c.id} ${s1(c.t100)} s / ${s1(c.frein)} m`).join(', ');
  return `0–100 et freinage 50→0 : ${bilan} ; dérive à pleine accélération : ${msgDerive} m/s`;
};
module.exports.titre = 'mécanicien (conduite) : masse, puissance, transmission, tuning, chocs, roulis';
module.exports.appareil = 'bureau';
