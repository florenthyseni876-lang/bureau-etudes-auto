'use strict';
const os = require('os');
const path = require('path');
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien — tuning (js/58, MWTUNE) : ateliers de préparation sur la carte et la mini-carte, achat et pose de pièces sur sa voiture
// (argent, temps, niveau, effet MESURÉ sur l'accélération et la vitesse maxi), son plus grave, banc de puissance, aperçu 3D (jantes, aileron,
// peinture) sans faces qui se chevauchent, fiabilité et pannes, contrôle technique et police, garage équipé, client de tuning de bout en bout
// (embauche, commande, étapes, facture, note, expérience), voiture modifiée visible par l'autre joueur (js/56).
// Les captures vont dans BEA_CAPTURES (sinon le dossier temporaire du système, jamais le dépôt).
module.exports = async function mecaTuning(page, env) {
  const A = page;
  const dossier = process.env.BEA_CAPTURES || os.tmpdir();
  const capturer = async (p, nom) => { try { await p.screenshot({ path: path.join(dossier, `tuning-${nom}.png`) }); } catch (e) { /* capture facultative */ } };
  await A.goto(env.url);
  await attendreVisible(A, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(A, '#hMeca');
  await attendreVisible(A, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await A.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && window.__mwt && window.__mwcars && window.__mwi, null, { timeout: 20000 });
  await attendre(300);
  const e = (f, a) => A.evaluate(f, a);
  const jeu = () => e(() => { __mw.S.money = 400000; __mw.S.rep = 80; __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; MWC.setCar({ id: 'sport', nom: 'Volkswagen Golf GTI', kind: 'sport', color: 0x2244aa, model: 'golfgti' }); });
  await jeu();
  await e(() => { Object.assign(__mw.S.xp, { preparation: 900, moteur: 900, liaison: 900, entretien: 900 }); });

  // 1. ateliers de préparation : dans la ville, sur la carte et la mini-carte, avec accueil et décor
  const ate = await e(() => ['tune1', 'tune2'].map(id => { const z = __mw.zone(id); return z ? { id, type: z.type, interior: z.interior, ponts: z.ponts.length, col: z.col, w: z.w, d: z.d, x: z.x, z: z.z, nom: z.nom, court: z.court } : null; }));
  verifier(ate.every(a => a && a.type === 'garage' && a.interior && a.ponts >= 2), `les deux ateliers de préparation sont absents ou incomplets : ${JSON.stringify(ate)}`);
  verifier(ate[0].nom !== ate[1].nom && ate[0].col !== ate[1].col, 'les deux ateliers ne se distinguent pas');
  const chevauche = await e(() => { const Z = __mw.zones, r = [];
    for (const a of Z) for (const b of Z) if (a.id < b.id && (a.id.startsWith('tune') || b.id.startsWith('tune')) && Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2) r.push(a.id + '/' + b.id);
    return r; });
  verifier(chevauche.length === 0, `un atelier de préparation chevauche un autre bâtiment : ${chevauche}`);
  // carte : la case de chaque atelier est de la couleur de son enseigne (grande carte) ; mini-carte autour du joueur
  await e(() => { document.querySelector('#mwBar [data-b="map"]').click(); });
  await attendre(500);
  const px = await e(() => { const c = document.getElementById('mwBig'), x = c.getContext('2d'), sc = c.width / 600, o = {};
    for (const id of ['tune1', 'tune2']) { const z = __mw.zone(id), cx = c.width / 2 + z.x * sc, cz = c.height / 2 + z.z * sc, col = z.col, r = col >> 16 & 255, g = col >> 8 & 255, b = col & 255; let ok = 0;
      for (const [dx, dz] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3], [0, .35], [0, -.35]]) { const d = x.getImageData(Math.round(cx + dx * z.w * sc), Math.round(cz + dz * z.d * sc), 1, 1).data; if (Math.abs(d[0] - r) < 14 && Math.abs(d[1] - g) < 14 && Math.abs(d[2] - b) < 14) ok++; }
      o[id] = ok; }
    return o; });
  verifier(px.tune1 >= 1 && px.tune2 >= 1, `les ateliers n'apparaissent pas sur la grande carte (${JSON.stringify(px)})`);
  await capturer(A, '1-carte');
  await e(() => { document.getElementById('mwMapX').click(); });
  await e(() => { const z = __mw.zone('tune1'); __mw.teleport(z.porte.x, z.porte.z - 5, z.ry); });
  await attendre(700);
  const mini = await e(() => { const c = document.getElementById('mwMini'), x = c.getContext('2d'), z = __mw.zone('tune1'), col = z.col, r = col >> 16 & 255, g = col >> 8 & 255, b = col & 255; let ok = 0;
    for (let dx = -40; dx <= 40; dx += 8) for (let dy = -40; dy <= 40; dy += 8) { const d = x.getImageData(70 + dx, 70 + dy, 1, 1).data; if (Math.abs(d[0] - r) < 14 && Math.abs(d[1] - g) < 14 && Math.abs(d[2] - b) < 14) ok++; }
    return ok; });
  verifier(mini >= 3, `l'atelier Prépa Vallon n'est pas dessiné sur la mini-carte (${mini} points)`);
  // l'accueil, l'intérieur : banc de puissance dessiné, panneau d'accueil
  const dec = await e(() => { const nb = n => { const g = __mw.scene.getObjectByName(n); let c = 0; if (g) g.traverse(() => c++); return c; }; return { banc: nb('tune-decor-tune1') > 8, cabine: nb('tune-decor-tune2') > 8 }; });
  verifier(dec.banc && dec.cabine, `le banc de puissance ou la cabine de peinture ne sont pas dessinés (${JSON.stringify(dec)})`);
  await e(() => __mw.useDoor('tune1'));
  await attendreVisible(A, '#mwPb [data-mw="menu"]', "l'accueil de Prépa Vallon n'offre pas « Modifier ma voiture »");
  verifier(await e(() => !!document.querySelector('#mwPb [data-mw="job"]') && !!document.querySelector('#mwPb [data-mw="dyno"]') && !!document.querySelector('#mwPb [data-mw="fiche"]')), "l'accueil n'offre pas l'emploi, le banc et l'achat du bâtiment");
  await capturer(A, '2-accueil');
  await e(() => __mw.closePanel());

  // 2. conduite de la voiture d'origine : accélération mesurée (temps de jeu pour atteindre 9 m/s) ; on reste au volant, la téléportation remet la vitesse à zéro
  await e(() => { Object.assign(__mw.S.car, { x: -235, z: -150, ry: Math.PI / 2 }); __mw.teleport(-232.5, -150, 0); });
  await A.keyboard.press('f');
  await attendreCondition(A, () => __mw.player().inCar, 'le joueur ne monte pas dans sa voiture', 8000);
  const mesure = async () => {
    await e(() => { __mw.teleport(-235, -150, Math.PI / 2); });
    await e(() => { window.__t = new Promise(res => { let t = 0; const off = __mw.on('tick', dt => { if (__mw.paused) return; t += dt; const v = Math.abs(__mw.playerCar().speed); if (v >= 9 || t > 14) { off(); res({ t, v }); } }); }); });
    await A.keyboard.down('z');
    const r = await e(() => window.__t);
    await A.keyboard.up('z');
    await e(() => { __mw.teleport(-235, -150, Math.PI / 2); });
    return r; };
  const base = await e(() => ({ drv: Object.assign({}, __mw.drv), st: __mwt.status() }));
  verifier(base.drv.vm === 22 && base.drv.acc === 1 && base.drv.brk === 1 && base.drv.turn === 1, `la voiture d'origine doit conduire comme avant (${JSON.stringify(base.drv)})`);
  const m0 = await mesure();
  verifier(m0.v >= 8.9, `la voiture d'origine n'atteint pas 9 m/s (${JSON.stringify(m0)})`);

  // 3. achat et pose d'une pièce : argent, temps, niveau requis, effet réel
  const avant = await e(() => ({ money: __mw.S.money, min: __mw.S.min, day: __mw.S.day, ch: __mwt.status().ch, db: __mwt.status().db }));
  const prix = await e(() => __mwt.offer({ k: 'part', id: 'ecu1' }, 'tune1'));
  verifier(prix.part > 0 && prix.mo === 90 && prix.niv === 2 && prix.labor > 0 && prix.total === prix.part + prix.labor, `devis de la reprogrammation incohérent : ${JSON.stringify({ part: prix.part, mo: prix.mo, niv: prix.niv, labor: prix.labor, total: prix.total })}`);
  const r1 = await e(() => __mwt.install({ k: 'part', id: 'ecu1' }, { zone: 'tune1' }));
  verifier(r1.ok && Math.abs(r1.total - prix.total) < .01, `la pose du stage 1 échoue : ${JSON.stringify(r1)}`);
  const apres = await e(() => ({ money: __mw.S.money, min: __mw.S.min, day: __mw.S.day, ch: __mwt.status().ch, cfg: __mwt.cfg().p }));
  verifier(Math.abs(avant.money - apres.money - prix.total) < .01, `l'argent débité (${avant.money - apres.money}) n'est pas le prix (${prix.total})`);
  verifier(((apres.day - avant.day) * 1440 + apres.min - avant.min + 1440) % 1440 >= 85, 'la pose ne prend pas de temps de jeu');
  verifier(apres.ch > avant.ch && apres.cfg.ecu === 'ecu1', `la puissance n'augmente pas (${avant.ch} → ${apres.ch})`);
  // prérequis : le stage 2 demande une admission et un échappement ; le stage 3 un turbo, un intercooler et un embrayage
  verifier(!(await e(() => __mwt.install({ k: 'part', id: 'ecu2' }, { zone: 'tune1' }))).ok, 'le stage 2 se pose sans admission ni échappement');
  verifier(!(await e(() => __mwt.install({ k: 'part', id: 'ecu3' }, { zone: 'tune1' }))).ok, 'le stage 3 se pose sans turbo ni intercooler');
  verifier(!(await e(() => __mwt.install({ k: 'part', id: 'cmp' }, { zone: 'tune1' }))).ok, 'un compresseur se pose sur un moteur déjà turbo');
  // niveau : sans le niveau « préparation », la pose par soi-même est refusée (l'atelier pose, la main-d'œuvre se paie) ; au niveau, elle est gratuite chez soi
  const niv = await e(() => { const lvl = MWJ.level('preparation'); __mw.S.xp.preparation = 0; const o = __mwt.offer({ k: 'part', id: 'ecu3' }, 'tune1'); __mw.S.xp.preparation = 900; return { lvl, niv: o.niv, diy: o.diy }; });
  verifier(niv.niv === 6 && niv.diy === false, `le niveau requis n'est pas pris en compte : ${JSON.stringify(niv)}`);
  // un jeu de pièces de performance
  for (const id of ['adm2', 'exh2', 'ecu2', 'tyr2', 'lt2', 'clt1']) {
    const r = await e(i => { const x = __mwt.install({ k: 'part', id: i }, { zone: 'tune1' }); return x; }, id);
    verifier(r.ok, `la pose de ${id} échoue : ${JSON.stringify(r)}`);
  }
  const tuned = await e(() => ({ drv: Object.assign({}, __mw.drv), st: __mwt.status() }));
  verifier(tuned.st.ch > base.st.ch * 1.3, `la préparation devrait donner plus de 30 % de puissance (${base.st.ch} → ${tuned.st.ch})`);
  verifier(tuned.drv.acc > 1.2 && tuned.drv.vm > 23.5, `la conduite ne change pas : ${JSON.stringify(tuned.drv)}`);
  const m1 = await mesure();
  verifier(m1.v >= 8.9 && m1.t < m0.t * .93, `l'accélération mesurée n'a pas progressé (${m0.t.toFixed(2)} s → ${m1.t.toFixed(2)} s pour 9 m/s)`);
  // vitesse maxi : la limite de la voiture est celle des réglages, et elle est atteignable (réglages directs pour ne pas dépendre de la vitesse de la machine)
  const vmax = await e(() => { const D = __mw.drv; const o = { vm: D.vm }; D.vm = 6; return o; });
  await e(() => { __mw.teleport(-235, -150, Math.PI / 2); window.__t2 = new Promise(res => { let t = 0, mx = 0; const off = __mw.on('tick', dt => { if (__mw.paused) return; t += dt; mx = Math.max(mx, Math.abs(__mw.playerCar().speed)); if (t > 2.4) { off(); res(mx); } }); }); });
  await A.keyboard.down('z');
  const mx = await e(() => window.__t2);
  await A.keyboard.up('z');
  verifier(mx <= 6.05 && mx > 4, `la vitesse maxi de la voiture n'est pas bornée par ses réglages (${mx.toFixed(2)} m/s pour 6)`);
  await e(() => { __mwt.refreshDrv(); __mw.teleport(-235, -150, Math.PI / 2); });
  verifier(vmax.vm > 23.5, `la vitesse maxi réglée n'a pas progressé (${vmax.vm})`);
  // freinage et tenue : les pièces dédiées changent MW.drv
  const fr = await e(() => { const a = Object.assign({}, __mw.drv); __mwt.install({ k: 'part', id: 'brk2' }, { zone: 'tune1' }); __mwt.install({ k: 'part', id: 'sus1' }, { zone: 'tune1' }); __mwt.install({ k: 'part', id: 'arb2' }, { zone: 'tune1' }); return { a, b: Object.assign({}, __mw.drv) }; });
  verifier(fr.b.brk > fr.a.brk + .2 && fr.b.turn > fr.a.turn + .08, `freins et suspension ne changent pas la conduite : ${JSON.stringify(fr)}`);
  // son : l'échappement sport rend le moteur plus grave
  const son = await e(() => { const t = __mwt.status().fx.snd; return { snd: t, exh: __mwt.cfg().p.exh }; });
  verifier(son.snd >= .6 && son.exh === 'exh2', `l'échappement sport ne change pas le son (${JSON.stringify(son)})`);
  const pitch = await e(() => { const ret = {}; const pc = __mw.playerCar(); const K = __mwt.cfg(); const save = JSON.stringify(K);
    const f = k => { __mwt.setCfg(null, k); return __mwt.status().fx.snd; };
    ret.sans = f({ p: {} }); ret.avec = f({ p: { exh: 'exh3' } }); __mwt.setCfg(null, JSON.parse(save)); return ret; });
  verifier(pitch.avec > pitch.sans + .5, `le son n'est pas plus grave avec un échappement racing (${JSON.stringify(pitch)})`);
  await e(() => { __mw.teleport(-235, -150, Math.PI / 2); });
  await A.keyboard.press('f');
  await attendreCondition(A, () => !__mw.player().inCar, 'le joueur ne descend pas de voiture', 8000);

  // 4. banc de puissance : ch et Nm avant et après
  const dyn = await e(() => { const r = __mwt.dyno({}); return { a: r.a.peakCh, b: r.b.peakCh, an: r.a.peakNm, bn: r.b.peakNm, pts: r.b.pts.length, canvas: !!document.getElementById('tnDyno'), txt: document.querySelector('#mwPb').textContent }; });
  verifier(dyn.canvas && dyn.pts > 20 && dyn.b > dyn.a && dyn.bn > dyn.an, `le banc de puissance n'affiche pas un gain (${JSON.stringify({ a: dyn.a, b: dyn.b, an: dyn.an, bn: dyn.bn })})`);
  verifier(/ch →/.test(dyn.txt) && /Nm →/.test(dyn.txt), 'le banc n\'affiche pas ch et Nm avant → après');
  await attendre(1900);
  await capturer(A, '3-banc');
  await e(() => __mw.closePanel());

  // 5. aperçu visuel : jantes, aileron, peinture sur plusieurs voitures, sans faces qui se chevauchent
  const vis = await e(() => {
    const models = ['golfgti', 'clio4', 'p911', 'a110', 'kangoo2', 'bmw320d', 'mustang', 'p3008'];
    const cfgs = [
      { p: { spoiler: 'sp1', front: 'fr1', skirt: 'sk1', rear: 'rr1', arch: 'ar1', tips: 'tp1', hood: 'hd1', tint: 'tn1', hlights: 'hl1', tlights: 'tl1', brakes: 'brk1', susp: 'sus0' }, paint: { c: 0xc4281c, f: 'brillant', c2: null }, wheels: { m: 'etoile5', i: 18, c: 0xc4c8ce } },
      { p: { spoiler: 'sp2', front: 'fr2', skirt: 'sk2', rear: 'rr2', arch: 'ar2', tips: 'tp4', hlights: 'hl2', tlights: 'tl2', brakes: 'brk2', susp: 'sus2', neon: 'nn1', tint: 'tn2' }, paint: { c: 0x1f3a8a, f: 'nacre', c2: 0x101114 }, wheels: { m: 'turbine', i: 19, c: 0x3a3d44 }, h: -4 },
      { p: { spoiler: 'sp3', tips: 'tp2', rear: 'rr1', front: 'fr1' }, wrap: { t: 'bandes', c: 0x101114 }, paint: { c: 0xe8701c, f: 'mat', c2: null }, wheels: { m: 'grille', i: 17, c: 0xc8a030 } },
      { p: { spoiler: 'sp4', tips: 'tp3', arch: 'ar1', hood: 'hd1' }, wrap: { t: 'carbone', c: 0 }, paint: { c: 0xeeeeee, f: 'metal', c2: null }, wheels: { m: 'rally', i: 17, c: 0xeeeeee } },
      { p: { tips: 'tp2' }, wrap: { t: 'chrome', c: 0 }, wheels: { m: 'concave', i: 18, c: 0x16171a } },
      { p: { spoiler: 'sp2' }, wrap: { t: 'satin', c: 0x3f8a4a }, wheels: { m: 'multi10', i: 18, c: 0xb02020 } }];
    const tris = m => { const out = []; m.updateMatrixWorld(true); m.traverse(o => { if (!o.isMesh || !o.userData.tuneObj || !o.visible) return; const g = o.geometry, p = g.attributes.position, ix = g.index, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(); const n = ix ? ix.count : p.count;
      for (let i = 0; i < n; i += 3) { const a = ix ? ix.getX(i) : i, b = ix ? ix.getX(i + 1) : i + 1, c = ix ? ix.getX(i + 2) : i + 2; A.fromBufferAttribute(p, a).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(p, b).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(p, c).applyMatrix4(o.matrixWorld);
        const nm = new THREE.Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A)); const l = nm.length(); if (l < 1e-9) continue; nm.divideScalar(l);
        const mat = Array.isArray(o.material) ? o.material[0] : o.material; if (mat.side !== THREE.DoubleSide) { /* faces visibles des deux côtés : on teste les deux sens */ }
        out.push({ o, A: A.clone(), B: B.clone(), C: C.clone(), n: nm, d: nm.dot(A), area: l / 2 }); } }); return out; };
    const inside = (P, t) => { const v0 = t.C.clone().sub(t.A), v1 = t.B.clone().sub(t.A), v2 = P.clone().sub(t.A); const d00 = v0.dot(v0), d01 = v0.dot(v1), d02 = v0.dot(v2), d11 = v1.dot(v1), d12 = v1.dot(v2); const iv = 1 / (d00 * d11 - d01 * d01); const u = (d11 * d02 - d01 * d12) * iv, v = (d00 * d12 - d01 * d02) * iv; return u > .02 && v > .02 && u + v < .98; };
    const pts = t => [t.A.clone().add(t.B).add(t.C).divideScalar(3), t.A.clone().lerp(t.B.clone().lerp(t.C, .5), .3), t.B.clone().lerp(t.A.clone().lerp(t.C, .5), .3), t.C.clone().lerp(t.A.clone().lerp(t.B, .5), .3)];
    const chev = list => { const B = new Map(); for (const t of list) { if (t.area < 1e-5) continue; const k = [Math.round(t.n.x * 40), Math.round(t.n.y * 40), Math.round(t.n.z * 40), Math.round(t.d / .0025)].join(','); (B.get(k) || B.set(k, []).get(k)).push(t); }
      const bad = []; for (const l of B.values()) { if (l.length < 2) continue; for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const a = l[i], b = l[j]; if (a.o === b.o) continue; if (a.n.dot(b.n) < .999 || Math.abs(a.d - b.d) > .0012) continue; if (pts(a).some(p => inside(p, b)) || pts(b).some(p => inside(p, a))) bad.push([a.o.name || a.o.type, b.o.name || b.o.type]); } } return bad; };
    const res = { n: 0, bad: [], sans: 0, roues: 0, peinture: 0, err: [] };
    for (const mdl of models) for (const [ci, cfg0] of cfgs.entries()) {
      try {
        const car = MW.carMesh({ model: mdl, color: 0x2a6acc, bay: false }); const cfg = Object.assign({ p: {}, paint: null, wrap: null, wheels: null, h: 0, stiff: .5, neon: 0x30c0ff }, JSON.parse(JSON.stringify(cfg0)));
        if (mdl === 'kangoo2' || mdl === 'p3008') { if (cfg.wheels && cfg.wheels.i > 17) cfg.wheels.i = 17; }
        const mat0 = car.children[0].material; __mwt.apply(car, cfg); res.n++;
        const grp = car.getObjectByName('tune'); if (!grp) { res.err.push(mdl + ' sans groupe'); continue; }
        if (cfg.wheels) { const w = car.getObjectByName('wFL'); const vis = w.children.filter(c => c.visible).length; if (vis < 2 || !w.children.some(c => c.userData.tuneObj)) res.err.push(mdl + ' jantes absentes'); else res.roues++; }
        if (cfg.paint) { const c = car.children[0].material; const col = c.color.getHex(), vc = c.vertexColors; const hid = !car.children[0].visible; if (!(hid || col !== mat0.color.getHex() || vc)) res.err.push(mdl + ' peinture inchangée'); else res.peinture++; }
        const b = chev(tris(car)); if (b.length) res.bad.push(mdl + '#' + ci + ' ' + JSON.stringify(b.slice(0, 3))); res.sans += b.length === 0 ? 1 : 0;
        __mwt.clear(car); if (car.getObjectByName('tune')) res.err.push(mdl + ' clear'); if (car.children[0].material !== mat0 || !car.children[0].visible) res.err.push(mdl + ' restauration');
      } catch (er) { res.err.push(mdl + '#' + ci + ' ' + (er && er.message)); } }
    return res; });
  verifier(vis.err.length === 0, `aperçu 3D : ${vis.err.slice(0, 4).join(' | ')}`);
  verifier(vis.n >= 40 && vis.roues >= 30 && vis.peinture >= 30, `aperçu 3D incomplet (${JSON.stringify({ n: vis.n, roues: vis.roues, peinture: vis.peinture })})`);
  verifier(vis.bad.length === 0, `faces qui se chevauchent (même plan, même sens) : ${vis.bad.slice(0, 3).join(' | ')}`);
  // la voiture du joueur porte réellement ses pièces (jantes, aileron, peinture), et les garde si on la change
  await e(() => { __mwt.install({ k: 'wheels', m: 'turbine', i: 19, c: 0x3a3d44 }, { zone: 'tune1' }); __mwt.install({ k: 'part', id: 'sp2' }, { zone: 'tune2' }); __mwt.install({ k: 'paint', f: 'nacre', c: 0x1f3a8a, c2: 0x101114 }, { zone: 'tune2' }); });
  const sur = await e(() => { const m = __mw.playerCar().mesh, g = m.getObjectByName('tune'); return { g: !!g, n: g ? g.children.length : 0, jantes: m.getObjectByName('wFL').children.some(c => c.userData.tuneObj), cfg: __mwt.cfg() }; });
  verifier(sur.g && sur.n >= 4 && sur.jantes && sur.cfg.wheels && sur.cfg.paint && sur.cfg.p.spoiler === 'sp2', `la voiture du joueur n'est pas redessinée : ${JSON.stringify(sur)}`);
  await e(() => { MWC.setCar({ id: 'berline', nom: 'Golf', kind: 'berline', color: 0x6a6f78, model: 'golf7' }); });
  await attendre(900);
  verifier(await e(() => !__mw.playerCar().mesh.getObjectByName('tune') && __mw.drv.vm === 22), 'une autre voiture hérite des modifications de la précédente');
  await e(() => { MWC.setCar({ id: 'sport', nom: 'Volkswagen Golf GTI', kind: 'sport', color: 0x2244aa, model: 'golfgti' }); });
  await attendre(900);
  verifier(await e(() => !!__mw.playerCar().mesh.getObjectByName('tune') && __mw.drv.vm > 23), 'la voiture retrouvée ne reprend pas ses modifications');

  // 6. menu avec aperçu 3D en direct
  await e(() => { const z = __mw.zone('tune2'); Object.assign(__mw.S.car, { x: z.porte.x, z: z.porte.z - 10, ry: z.ry }); __mw.teleport(z.porte.x + 3, z.porte.z - 3, z.ry); });
  verifier(await e(() => __mwt.menu('tune2')), 'le menu de tuning ne s\'ouvre pas devant l\'atelier');
  await attendreVisible(A, '#tnView canvas', 'le menu n\'a pas de visionneuse 3D');
  await attendre(900);
  verifier(await e(() => !!__mwt._viewer() && !!__mwt._viewer().car.getObjectByName('tune')), 'la visionneuse ne montre pas les modifications posées');
  await e(() => __mwt.menuClick('tab:style'));
  await e(() => __mwt.menuClick('view:sp3'));
  const prev = await e(() => { const v = __mwt._viewer(); const g = v.car.getObjectByName('tune'); return { prev: __mwt.menuState().prev, spoiler: !!g && g.children.some(c => c.name === 'spoiler'), posee: __mwt.cfg().p.spoiler }; });
  verifier(prev.prev && prev.prev.id === 'sp3' && prev.spoiler && prev.posee === 'sp2', `l'aperçu en direct ne montre pas la pièce avant l'achat : ${JSON.stringify(prev)}`);
  await e(() => __mwt.menuClick('tab:wheels')); await e(() => __mwt.menuClick('wm:grille')); await e(() => __mwt.menuClick('wi:18'));
  await e(() => __mwt.menuClick('tab:paint')); await e(() => __mwt.menuClick('pf:mat')); await e(() => __mwt.menuClick('pc:' + 0xe8701c));
  await attendre(900);
  verifier(await e(() => __mwt.cfg().paint.f === 'nacre' && __mwt.menuState().prev && __mwt.menuState().prev.f === 'mat'), "l'aperçu de peinture modifie la voiture avant l'achat");
  await capturer(A, '4-menu-peinture');
  await e(() => __mwt.menuClick('tab:bilan'));
  await attendre(300);
  await e(() => __mwt.closeMenu());
  verifier(await e(() => !document.querySelector('#tnView canvas') && !__mwt._viewer()), 'la visionneuse reste ouverte après fermeture du menu');

  await capturer(A, '4b-fin');
  return 'ateliers, carte, achat et pose, conduite mesurée, son, banc de puissance, aperçu 3D, menu en direct';
};
module.exports.titre = 'Mécanicien : tuning (ateliers sur la carte, pièces, conduite, banc, aperçu 3D)';
