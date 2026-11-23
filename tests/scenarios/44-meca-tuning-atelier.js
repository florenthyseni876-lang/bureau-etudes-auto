'use strict';
const os = require('os');
const path = require('path');
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien — tuning (js/58), suite du scénario 43 : fiabilité et pannes, contrôle technique et police, garage racheté puis équipé,
// client de tuning de bout en bout (embauche, commande, étapes, facture, note, expérience, peinture en cabine, client oublié),
// voiture modifiée visible par l'autre joueur (js/56). Les captures vont dans BEA_CAPTURES (sinon le dossier temporaire du système, jamais le dépôt).
module.exports = async function mecaTuningAtelier(page, env) {
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
  await e(() => { __mwt.hasard = false; }); // pas de panne ni de contrôle de police au hasard pendant le test
  const jeu = () => e(() => { __mw.S.money = 400000; __mw.S.rep = 80; __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; MWC.setCar({ id: 'sport', nom: 'Volkswagen Golf GTI', kind: 'sport', color: 0x2244aa, model: 'golfgti' }); });
  await jeu();
  await e(() => { Object.assign(__mw.S.xp, { preparation: 900, moteur: 900, liaison: 900, entretien: 900 }); });

  // voiture de sport préparée, pour les sections suivantes
  await e(() => { MWC.setCar({ id: 'sport', nom: 'Volkswagen Golf GTI', kind: 'sport', color: 0x2244aa, model: 'golfgti' }); __mwt.setCfg(null, { p: { adm1: 'adm1', ecu: 'ecu1', sus: undefined } }); });
  // 7. fiabilité, pannes, contrôle technique, police
  await e(() => { __mwt.setCfg(null, { p: { adm2: undefined, ecu: 'ecu3', boost: 'trbh', clutch: 'clt1', inter: 'inter', exh: 'exh3', tyres: 'tyr2', neon: 'nn1', tint: 'tn3', susp: 'sus2' }, wheels: null, h: -6 }); const t = __mw.S.tune; t.wear[__mwt.keyOf()] = 0; });
  const fia = await e(() => ({ st: __mwt.status(), rel: __mwt.reliability(), legal: __mwt.status().legal.map(x => x.id) }));
  verifier(fia.st.rel < 90 && fia.st.rel0 > 8, `une voiture très poussée devrait perdre en fiabilité (${fia.st.rel} %)`);
  for (const id of ['bruit', 'neon', 'pneus', 'vitres', 'garde']) verifier(fia.legal.includes(id), `infraction « ${id} » non détectée (${fia.legal})`);
  const usure = await e(() => { const k = __mwt.keyOf(), t = __mw.S.tune; t.wear[k] = 0; const w0 = t.wear[k]; return w0; });
  await e(() => { const D = __mw.drv; window.__km = new Promise(res => { let t = 0; const off = __mw.on('tick', dt => { if (__mw.paused) return; t += dt; if (t > .6) { off(); res(__mw.S.tune.stats.km); } }); }); });
  const km0 = await e(() => __mw.S.tune.stats.km);
  await e(() => { Object.assign(__mw.S.car, { x: -235, z: -150, ry: Math.PI / 2 }); __mw.teleport(-232.5, -150, 0); });
  await A.keyboard.press('f');
  await attendreCondition(A, () => __mw.player().inCar, 'le joueur ne monte pas dans sa voiture', 8000);
  await A.keyboard.down('z');
  await attendre(900);
  await A.keyboard.up('z');
  const km1 = await e(() => ({ km: __mw.S.tune.stats.km, wear: __mw.S.tune.wear[__mwt.keyOf()] }));
  verifier(km1.km > km0 && km1.wear > 0, `rouler n'use pas la voiture préparée (${JSON.stringify(km1)})`);
  await e(() => { __mw.teleport(-235, -150, Math.PI / 2); });
  const pan = await e(() => { const p = __mwt.breakdown('turbo'); return { p, drv: Object.assign({}, __mw.drv), eng: __mw.drv.eng }; });
  verifier(pan.p && pan.p.id === 'turbo' && pan.eng < .6 && pan.p.cost > 0 && /sifflement|puissance/i.test(pan.p.txt), `la panne du turbo ne dégrade pas la voiture : ${JSON.stringify(pan.p)}`);
  verifier(await e(() => { const m0 = __mw.S.money; const ok = __mwt.repair({ zone: 'tune1' }); return ok && __mw.S.money < m0 && __mw.drv.eng === 1 && !__mw.S.tune.panne[__mwt.keyOf()]; }), 'la réparation ne remet pas la voiture en état');
  const pol = await e(() => { const m0 = __mw.S.money; const r = __mwt.police(); return { fine: r && r.fine, grave: r && r.grave, d: m0 - __mw.S.money, panel: !!document.querySelector('#mwPb') && /gendarmes/.test(document.querySelector('#mwPb').textContent) }; });
  verifier(pol.fine > 100 && pol.d >= pol.fine - .01 && pol.panel, `le contrôle de police ne verbalise pas une voiture trop modifiée (${JSON.stringify(pol)})`);
  verifier(pol.grave && await e(() => __mw.drv.eng === 0), 'une voiture beaucoup trop modifiée n\'est pas immobilisée');
  await e(() => __mw.closePanel());
  await attendre(500);
  // remise en conformité : on dépose les pièces fautives, la voiture reprend la route
  await e(() => { for (const s of ['exh', 'tyres', 'neon', 'tint']) __mwt.remove(s); __mwt.setHeight(0); });
  await e(() => { __mwt.setCfg(null, Object.assign({}, __mwt.cfg(), { p: { ecu: 'ecu1' } })); __mw.emit('minute'); });
  verifier(await e(() => __mw.drv.eng > 0 && !__mw.S.tune.ban[__mwt.keyOf()]), 'la voiture remise en conformité reste immobilisée');
  verifier(await e(() => { const r = __mwt.ct(); return r.ok && __mw.S.tune.ct[__mwt.keyOf()] > __mw.S.day; }), 'le contrôle technique d\'une voiture en règle est refusé');
  await e(() => { const z = __mw.zone('tune1'); __mw.teleport(z.porte.x, z.porte.z, z.ry); });
  await A.keyboard.press('f');

  // 8. garage équipé : on rachète un garage, on y installe le banc et la cabine, on y modifie sa voiture et on y reçoit des clients
  verifier(await e(() => __mwi.buy('garage5', 'cash')), 'le garage ne s\'achète pas');
  await e(() => { MWC.workAt('garage5'); const z = __mw.zone('garage5'); Object.assign(__mw.S.car, { x: z.porte.x, z: z.porte.z - 8, ry: z.ry }); __mw.teleport(z.porte.x, z.porte.z - 3, z.ry); });
  verifier(!(await e(() => __mwt.caps('garage5').any)), 'un garage non équipé propose déjà le tuning');
  verifier(!(await e(() => __mwt.menu('garage5'))), 'le menu de tuning s\'ouvre dans un garage sans équipement');
  await e(() => { __mws.deposit('garage5', 60000); });
  verifier(await e(() => __mwt.equip('garage5', 'banc') && __mwt.equip('garage5', 'cabine')), 'le garage ne s\'équipe pas');
  const eq = await e(() => { const c = __mwt.caps('garage5'); return { bench: c.bench, booth: c.booth, diy: c.diy, owner: c.owner, decor: !!__mw.scene.getObjectByName('tune-decor-garage5') }; });
  verifier(eq.bench && eq.booth && eq.diy && eq.owner && eq.decor, `le garage équipé n'a pas banc, cabine ou décor : ${JSON.stringify(eq)}`);
  const chez = await e(() => { __mwt.setCfg(null, { p: {} }); const o = __mwt.offer({ k: 'part', id: 'ecu1' }, 'garage5'); const o2 = __mwt.offer({ k: 'paint', f: 'mat', c: 0x101114 }, 'garage5'); return { labor: o.labor, diy: o.diy, part: o.part, ret: __mwt.quote ? 1 : 0, paint: o2.ok, boothOk: o2.ok }; });
  verifier(chez.diy && chez.labor === 0 && chez.paint, `dans son garage équipé, la pose doit être gratuite et la peinture possible : ${JSON.stringify(chez)}`);
  verifier(await e(() => { const m = __mw.S.money; const r = __mwt.install({ k: 'part', id: 'adm1' }, { zone: 'garage5' }); return r.ok && __mw.S.money < m; }), 'on ne peut pas modifier sa voiture dans son garage équipé');

  // 9. client de tuning de bout en bout (Prépa Vallon, employé)
  await e(() => { MWC.stopWork(); __mw.S.min = 600; __mw.S.xp.preparation = 120; Object.assign(__mw.S.xp, { moteur: 900, liaison: 900, entretien: 900 }); __mw.S.rep = 80; });
  verifier(await e(() => __mwt.hire('tune1') && MWC.employer().id === 'prepa'), 'l\'embauche chez Prépa Vallon échoue malgré le niveau et la réputation');
  await e(() => { __mw.S.rep = 5; });
  verifier(!(await e(() => { MWC.hire('aucun'); return __mwt.hire('tune1'); })), 'on est embauché sans la réputation demandée');
  await e(() => { __mw.S.rep = 80; __mwt.hire('tune1'); __mw.S.min = 600; const t = __mwt.state(); t.next = 1e12; for (const o of t.orders.slice()) __mwt.drop(o.id, 'test'); });
  const cmd = await e(() => { const o = __mwt.spawn({ zone: 'tune1', tpl: 'stage1x', model: 'golfgti' }); return o && { id: o.id, label: o.label, devis: o.devis, status: o.status, mesh: !!__mw.scene.children.find(c => c.userData && c.userData.plate === o.plaque) }; });
  verifier(cmd && /Stage 1/.test(cmd.label) && cmd.devis > 200 && cmd.status === 'new', `le client de tuning n'arrive pas : ${JSON.stringify(cmd)}`);
  verifier(await e(() => !!__mw.scene.children.find(c => c.userData && c.userData.plate && c.userData.mdl === 'golfgti' && c.position.z < -100)), 'la voiture du client n\'est pas posée dans l\'atelier');
  const xp0 = await e(() => ({ xp: __mw.S.xp.preparation, money: __mw.S.money, rep: __mw.S.rep, done: __mw.S.tune.stats.done }));
  await e(id => { __mwt.station(id); }, cmd.id);
  await attendreVisible(A, '#mwPb [data-mw="accept"]', 'le poste de travail n\'offre pas « Accepter la commande »');
  await capturer(A, '5-commande');
  await A.click('#mwPb [data-mw="accept"]');
  const nSt = await e(id => __mwt.order(id).steps.length, cmd.id);
  verifier(nSt >= 6, `la commande ne comporte pas d'étapes (${nSt})`);
  verifier(!(await e(id => __mwt.step(id, 2).ok, cmd.id)), 'on peut sauter une étape');
  for (let i = 0; i < nSt; i++) {
    const m0 = await e(() => __mw.S.min);
    const r = await e(([id, k]) => { const x = __mwt.step(id, k); return { ok: x.ok, panel: !!x.panel }; }, [cmd.id, i]);
    verifier(r.ok, `l'étape ${i + 1} échoue`);
    if (r.panel) { await attendreVisible(A, '#mwPb [data-mw="run"]', 'le jeu de cartographie ne s\'ouvre pas'); await A.click('#mwPb [data-mw="run"]'); await A.click('#mwPb [data-mw="end"]'); await attendre(200); await e(() => __mw.closePanel()); }
  }
  verifier(await e(id => { const o = __mwt.order(id); return o.step >= o.steps.length; }, cmd.id), 'toutes les étapes ne sont pas faites');
  const vue = await e(id => { const o = __mwt.order(id), m = __mw.scene.children.find(c => c.userData && c.userData.plate === o.plaque); return { cfg: o.cfg.p, tune: !!m && !!m.userData.tune && m.userData.tune.sig.indexOf('exh1') > 0 }; }, cmd.id);
  verifier(vue.cfg.ecu === 'ecu1' && vue.cfg.exh === 'exh1' && vue.tune, `la voiture du client n'affiche pas ses modifications : ${JSON.stringify(vue)}`);
  const fin = await e(id => { const r = __mwt.deliver(id); return r; }, cmd.id);
  verifier(fin && fin.facture > 200 && fin.stars >= 1 && fin.stars <= 5 && fin.xp > 10 && fin.emp === true, `la facture ou la note du client est absente : ${JSON.stringify(fin)}`);
  const xp1 = await e(() => ({ xp: __mw.S.xp.preparation, money: __mw.S.money, done: __mw.S.tune.stats.done, orders: __mwt.orders().length, panel: document.querySelector('#mwPb') && document.querySelector('#mwPb').textContent }));
  verifier(xp1.xp > xp0.xp && xp1.money > xp0.money && xp1.done === xp0.done + 1 && xp1.orders === 0, `l'expérience, la paie ou le suivi ne sont pas mis à jour (${JSON.stringify({ xp0, xp1: { xp: xp1.xp, money: xp1.money, done: xp1.done } })})`);
  verifier(/Note du client/.test(xp1.panel) && /Facture/.test(xp1.panel) && /Expérience/.test(xp1.panel), 'le récapitulatif de la voiture rendue est incomplet');
  await capturer(A, '6-facture');
  await e(() => __mw.closePanel());
  // atelier de style : peinture en cabine
  await e(() => { MWC.hire('aucun'); __mw.S.xp.liaison = 900; __mw.S.xp.entretien = 900; });
  verifier(await e(() => __mwt.hire('tune2')), 'l\'embauche à l\'Atelier Éclat échoue');
  const cs = await e(() => { const o = __mwt.spawn({ zone: 'tune2', tpl: 'mat', model: 'clio4' }); __mwt.accept(o.id); return { id: o.id, n: o.steps.length, booth: o.steps.filter(s => s.booth).length }; });
  verifier(cs.booth >= 2, 'la peinture ne demande pas la cabine');
  for (let i = 0; i < cs.n; i++) verifier(await e(([id, k]) => __mwt.step(id, k).ok, [cs.id, i]), `étape de peinture ${i + 1} refusée`);
  const rs = await e(id => { const o = __mwt.order(id), cfg = JSON.parse(JSON.stringify(o.cfg)); const r = __mwt.deliver(id); return { cfg, r }; }, cs.id);
  verifier(rs.cfg.paint && rs.cfg.paint.f === 'mat' && rs.r && rs.r.pay > 0, `la peinture du client n'est pas faite ou payée : ${JSON.stringify(rs)}`);
  await e(() => __mw.closePanel());
  // une commande oubliée fait partir le client et coûte de la réputation
  const rp0 = await e(() => __mw.S.rep);
  await e(() => { const o = __mwt.spawn({ zone: 'tune2', tpl: 'bandes', model: 'clio4' }); o.ot0 = -1e6; __mw.emit('minute'); });
  await attendre(100);
  verifier(await e(r => __mwt.orders().length === 0 && __mw.S.rep < r, rp0), 'un client oublié ne repart pas');

  // 10. à deux : la voiture modifiée d'un joueur est visible par l'autre
  const B = await A.context().newPage();
  const erreursB = [];
  B.on('pageerror', er => erreursB.push(`erreur JS (invité) : ${String(er.message).split('\n')[0].slice(0, 160)}`));
  B.on('console', m => { if (m.type() === 'error') erreursB.push(`erreur console (invité) : ${m.text().split('\n')[0].slice(0, 160)}`); });
  await B.route('**/peerjs*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* faux PeerJS (tests) */' }));
  await B.goto(env.url);
  await attendreVisible(B, '#hMeca', 'accueil de l\'invité absent');
  await cliquer(B, '#hMeca');
  await B.waitForFunction(() => window.__mw && window.__mw.S && window.__mwt && window.__mwnet, null, { timeout: 20000 });
  await attendre(300);
  await A.route('**/peerjs*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* faux PeerJS (tests) */' }));
  await e(() => { MWC.hire('meca'); __mwt.setCfg(null, { p: { spoiler: 'sp3', front: 'fr2', tips: 'tp2' }, paint: { c: 0xe8701c, f: 'metal', c2: null }, wheels: { m: 'turbine', i: 19, c: 0xc8a030 } }); });
  const code = await e(() => __mwnet.host({ transport: 'bc', name: 'Léa' }));
  await B.evaluate(async c => { await __mwnet.join(c, { transport: 'bc', name: 'Tom' }); }, code);
  await attendreCondition(B, () => __mwnet.live() && !!__mwnet.avatar(), "l'invité ne voit pas son ami", 15000);
  await attendreCondition(B, () => { const a = __mwnet.avatar(); return a && !!a.car.getObjectByName('tune'); }, "l'invité ne voit pas la voiture préparée de l'hôte", 15000);
  const vB = await B.evaluate(() => { const a = __mwnet.avatar().car, g = a.getObjectByName('tune'); return { spoiler: g.children.some(c => c.name === 'spoiler'), jantes: a.getObjectByName('wFL').children.some(c => c.userData.tuneObj) }; });
  verifier(vB.spoiler && vB.jantes, `la voiture de l'ami n'a pas ses pièces : ${JSON.stringify(vB)}`);
  await e(() => { __mwt.setCfg(null, { p: {} }); });
  await attendreCondition(B, () => !__mwnet.avatar().car.getObjectByName('tune'), "l'invité voit encore les pièces déposées", 15000);
  await B.evaluate(() => __mwnet.leave());
  await B.close();
  verifier(erreursB.length === 0, erreursB[0] || '');
  await capturer(A, '7-fin');
  return 'pannes, police, garage équipé, client de bout en bout, peinture, à deux';
};
module.exports.titre = 'Mécanicien : tuning (pannes, police, garage équipé, clients, à deux)';
