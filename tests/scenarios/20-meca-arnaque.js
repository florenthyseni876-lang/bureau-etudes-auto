'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes } = require('../outils.js');

// Mode Mécanicien (arnaques) : pièce de réemploi montée et facturée −40 %, options malhonnêtes de la facture,
// découverte au comptoir, découverte plus tard (remboursement du double), échange discret, vol de stock et licenciement.
module.exports = async function mecaArnaque(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && window.__mwa && window.__mwo, null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);

  // à son compte (patron du Garage du Coin) : tout le surplus de facture est pour le joueur
  await e(() => {
    MWG.set({ classic: true }); MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    __mw.S.money = 3000; __mw.S.rep = 50; __mw.S.inv.length = 0; __mw.S.xp.freinage = 200; __mw.S.xp.electricite = 400;
  });
  // monte une pièce de réemploi sur une voiture neuve (pont levé, roues déposées)
  const voiture = (tpl, id, it) => e(([tpl, id, it]) => {
    const c = __mwj.spawn({ tpl, force: true, rend: false });
    c.st = { capot: 1, lifted: 1, av: 1, ar: 1 }; c.rem[id] = 1;
    __mw.S.inv.push(it);
    const ok = __mwj.L.doPose(c, id);
    c.st = { capot: 0, lifted: 0, av: 0, ar: 0 }; // tout remonté : la voiture peut être rendue
    return { id: c.id, ok, re: c.reemp[id], u: c.parts[id].u };
  }, [tpl, id, it]);

  // 1. réemploi : montée faute de neuve, facturée 40 % moins cher
  const v1 = await voiture('pneus', 'pneus', { k: 'usagee', id: 'pneus', u: 20, job: 'autre', pv: 240 });
  verifier(v1.ok && v1.re && v1.u === 20, `la pièce de réemploi ne se monte pas (${JSON.stringify(v1)})`);
  const f = await e(id => {
    const c = __mwj.jobs().find(x => x.id === id), l0 = __mwj.evalJob(c).lines[0];
    const f0 = __mwj.evalJob(c).facture;
    __mwa.toggle(c, 'neuf'); const f1 = __mwj.evalJob(c).facture;
    __mwa.toggle(c, 'neuf'); __mwa.toggle(c, 'mo'); const f2 = __mwj.evalJob(c).facture;
    __mwa.toggle(c, 'mo'); __mwa.toggle(c, 'fant:disq_av'); const ev3 = __mwj.evalJob(c);
    __mwa.toggle(c, 'fant:disq_av');
    return { nom: l0.nom, f0, f1, f2, f3: ev3.facture, k3: ev3.fraude.kinds, g3: ev3.fraude.gain, note3: ev3.note };
  }, v1.id);
  verifier(/réemploi/.test(f.nom), `la ligne de facture n'indique pas le réemploi (${f.nom})`);
  verifier(f.f1 > f.f0 && f.f2 > f.f0 && f.f3 > f.f0, `les options de facture ne gonflent pas la facture (${JSON.stringify(f)})`);
  verifier(f.k3.includes('fant') && f.g3 > 0 && f.note3 === 5, `pièce fantôme mal comptée (${JSON.stringify(f)})`);

  // 2. écran de rendu : la section « Arrondir la facture » et un clic sur une option
  await e(id => __mwj.rendre(__mwj.jobs().find(x => x.id === id)), v1.id);
  await attendreVisible(page, '.mw-pn', "l'écran de rendu ne s'ouvre pas");
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('Arrondir la facture'), 'les options de facturation sont absentes');
  await e(() => { const d = document.querySelector('.mw-fr-d'); if (d) d.open = true; });
  await cliquer(page, '.mw-pn [data-mw="fr:mo"]', 'option « main-d\'œuvre » absente');
  await attendreCondition(page, () => /Risque que le client/.test(document.querySelector('.mw-pn').textContent), "le risque n'est pas affiché", 5000);
  await verifierTextes(page, 'rendu (arnaque)');
  await page.keyboard.press('Escape');
  await attendreCondition(page, () => !__mw.paused, "l'écran de rendu ne se ferme pas", 8000);

  // 3. découverte au comptoir : note 1, réputation en baisse, seul le travail réel est payé
  const c1 = await e(id => {
    const c = __mwj.jobs().find(x => x.id === id); c.forceCaught = true;
    const hon = (() => { const k = c.fraud; c.fraud = null; const f = __mwj.evalJob(c).facture; c.fraud = k; return f; })();
    const m0 = __mw.S.money, r0 = __mw.S.rep, job = __mwj.done(c);
    return { note: job.note, rep: __mw.S.rep - r0, paye: __mw.S.money - m0, hon, pris: __mwa.state().pris };
  }, v1.id);
  verifier(c1.note === 1 && c1.rep < -5 && c1.pris === 1 && c1.paye <= c1.hon + 1 /* paie arrondie à l'euro */, `arnaque au comptoir mal traitée (${JSON.stringify(c1)})`);

  // 4. arnaque passée inaperçue, puis découverte quelques jours plus tard : remboursement du double
  const v2 = await voiture('pneus', 'pneus', { k: 'usagee', id: 'pneus', u: 30, job: 'autre', pv: 240 });
  const c2 = await e(id => {
    const c = __mwj.jobs().find(x => x.id === id); c.forceFree = true; __mwa.toggle(c, 'neuf'); __mwa.toggle(c, 'mo');
    const job = __mwj.done(c), p = __mwa.state().pend.slice(-1)[0];
    const m0 = __mw.S.money, r0 = __mw.S.rep, n = __mwa.day('pris');
    return { arn: job.arnaque, gain: p && p.gain, n, perte: m0 - __mw.S.money, rep: __mw.S.rep - r0 };
  }, v2.id);
  verifier(Array.isArray(c2.arn) && c2.gain > 0 && c2.n === 1, `l'arnaque n'est pas enregistrée (${JSON.stringify(c2)})`);
  verifier(Math.abs(c2.perte - c2.gain * 2) < 1 && c2.rep < 0, `la découverte tardive ne coûte pas le double (${JSON.stringify(c2)})`);

  // les consommables ne se réemploient pas (plaquettes d'occasion refusées)
  const cons = await e(() => { const c = __mwj.spawn({ tpl: 'plaq_av', force: true, rend: false }); __mw.S.inv.push({ k: 'usagee', id: 'plaq_av', u: 10, job: 'autre' });
    const r = __mwj.L.reempFind(c, 'plaq_av'); __mw.S.inv.pop(); __mwj.remove(c); return r; });
  verifier(cons === -1, 'des plaquettes d\'occasion peuvent être remontées');

  // 5. échange discret : on garde la batterie presque neuve du client, on lui monte une batterie usée, sans malus de note
  const c3 = await e(() => {
    const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false });
    c.st = { capot: 1, lifted: 0, av: 0, ar: 0 }; c.parts.batterie.u = 8; c.parts.batterie.u0 = 8;
    const d = __mwj.L.doDep(c, 'batterie');
    __mw.S.inv.push({ k: 'usagee', id: 'batterie', u: 45, job: 'autre', pv: 95 });
    const p = __mwj.L.doPose(c, 'batterie'), ev = __mwj.evalJob(c);
    return { d, p, vol: ev.fraude.vol, inut: ev.inut, garde: __mw.S.inv.some(it => it.id === 'batterie' && it.job === c.id && it.u === 8) };
  });
  verifier(c3.d && c3.p && c3.vol.includes('batterie') && !c3.inut.includes('batterie') && c3.garde, `échange discret incorrect (${JSON.stringify(c3)})`);

  // 6. salarié : revendre les pièces neuves de l'étagère, deux fois découvert → licencié
  const c4 = await e(() => {
    __mwj.clear(); MWC.hire('meca'); __mw.S.inv.length = 0; __mwa.state().avert = {};
    const out = [];
    for (let k = 0; k < 2; k++) {
      __mw.S.inv.push({ k: 'neuve', id: 'batterie', src: 'etagere' });
      const ok = __mwo.list(__mw.S.inv.length - 1, 'bas');
      __mwa.day('pris');
      out.push({ ok, emp: MWC.employer().id });
    }
    return out;
  });
  verifier(c4[0].ok && c4[0].emp === 'meca' && c4[1].emp === 'aucun', `le vol de stock n'est pas sanctionné (${JSON.stringify(c4)})`);
  await e(() => __mw.closePanel && __mw.closePanel());
  const carnet = await e(() => __mwa.carnetHTML());
  verifier(/Soupçons dans le quartier/.test(carnet), 'le carnet ne montre pas la section Honnêteté');
  return 'réemploi −40 %, options de facture, découverte au comptoir et tardive, échange discret, vol de stock et licenciement';
};

module.exports.titre = 'mécanicien : réemploi et arnaques (facture gonflée, échange discret, vol de stock)';
module.exports.appareil = 'bureau';
