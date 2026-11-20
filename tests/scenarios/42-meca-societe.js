'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes } = require('../outils.js');

// Mode Mécanicien (js/57) : société et compte du garage, joueur seul. Garage acheté à crédit (prêt de la société, pas du joueur),
// factures encaissées et pièces payées par le compte, charges du bâtiment, salaire taxé (brut + 45 % de charges patronales,
// net = brut − 22 %), dividendes (impôt sur les sociétés 15 % / 25 %, prélèvement forfaitaire 30 %), refus au-delà du distribuable
// ou du solde, bilan annuel, ancienne sauvegarde (compte à 0), revente.
module.exports = async function mecaSociete(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && window.__mwi && window.__mws && typeof MWC !== 'undefined', null, { timeout: 20000 });
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);

  await e(() => { __mw.S.money = 200000; __mw.S.rep = 70; __mw.S.xp.entretien = 900; __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; });

  // 1. achat à crédit : l'apport vient de l'argent personnel, le prêt est celui de la société
  verifier(await e(() => __mwi.buy('garage5', 'credit')), "l'achat du garage à crédit échoue");
  const a1 = await e(() => { const c = __mws.get('garage5'); return { money: __mw.S.money, loans: MWC.state().loans.length, parts: c.parts.map(p => p.pct), compte: c.compte, prets: c.prets.length, pret: c.prets[0] && c.prets[0].x }; });
  verifier(Math.abs(a1.money - (200000 - 7600)) < 1, `l'apport de 20 % n'est pas le seul décaissement personnel (${a1.money})`);
  verifier(a1.loans === 0 && a1.prets === 1 && a1.pret === 30400, `le prêt devrait être celui de la société (${JSON.stringify(a1)})`);
  verifier(a1.parts.length === 1 && a1.parts[0] === 100 && a1.compte === 0, `société inattendue : ${JSON.stringify(a1)}`);

  // 2. travail dans son garage : factures et pièces passent par le compte
  await e(() => { MWC.workAt('garage5'); __mws.deposit('garage5', 500); });
  verifier(await e(() => __mws.active() === 'garage5' && __mws.cash() === 500), "le joueur ne travaille pas pour le compte de son garage");
  const m0 = await e(() => __mw.S.money);
  const r = await e(() => {
    const c = __mwj.spawn({ tpl: 'essuie', silencieux: true }); if (!c) return null;
    c.st.lifted = 0;
    __mws.biz(-16, 'Pièces Auto Express : balais'); __mw.S.inv.push({ k: 'neuve', id: 'essuie', src: 'achat', paye: 16 });
    MWJ.L.doDep(c, 'essuie'); MWJ.L.doPose(c, 'essuie');
    const apres = __mws.get('garage5').compte; const j = MWJ.done(c);
    const cc = __mws.get('garage5');
    return { avant: apres, apres: cc.compte, ca: cc.ex.ca, ch: cc.ex.ch, pay: j && j.pay };
  });
  verifier(r && r.pay > 0 && Math.abs(r.apres - (r.avant + r.pay)) < .02, `la facture n'arrive pas dans le compte du garage (${JSON.stringify(r)})`);
  verifier(r.ca >= r.pay && r.ch >= 16, `le bilan ne compte pas la facture et les pièces (${JSON.stringify(r)})`);
  verifier(await e(m => Math.abs(__mw.S.money - m) < .01, m0), "l'argent personnel a bougé alors que tout passe par le compte du garage");

  // 3. charges du bâtiment (380 par semaine) et prêt, prélevés sur le compte
  const c0 = await e(() => { const m = __mw.S.money, k = __mws.get('garage5').compte; __mw.S.day += 7; __mw.emit('day', __mw.S.day); return { m, k }; });
  const c1 = await e(() => ({ m: __mw.S.money, k: __mws.get('garage5').compte, ops: __mws.get('garage5').ops.map(o => o.motif).join('|') }));
  verifier(Math.abs(c1.m - c0.m) < .01, `les charges du garage sont tombées sur l'argent personnel (${c1.m - c0.m})`);
  verifier(c0.k - c1.k >= 380 + 80 && /Charges du garage/.test(c1.ops) && /Remboursement du prêt/.test(c1.ops), `charges et prêt non prélevés sur le compte (${c0.k - c1.k} ; ${c1.ops})`);

  // 4. salaire : brut 1000, le garage paie 1450, l'associé reçoit 780 net
  await e(() => { __mws.deposit('garage5', 20000); const c = __mws.get('garage5'); __mws.salaire('garage5', __mws.pid(), 1000); });
  verifier(await e(() => __mws.get('garage5').sal[__mws.pid()] === 1000), 'le salaire seul devrait être appliqué tout de suite');
  const s0 = await e(() => ({ m: __mw.S.money, k: __mws.get('garage5').compte, ch: __mws.get('garage5').ex.ch }));
  await e(() => { const c = __mws.get('garage5'); __mw.S.day = c.next; __mw.emit('day', __mw.S.day); });
  const s1 = await e(() => ({ m: __mw.S.money, k: __mws.get('garage5').compte, ch: __mws.get('garage5').ex.ch }));
  verifier(Math.abs(s1.m - s0.m - 780) < .01, `le salaire net devrait être de 780 € (${s1.m - s0.m})`);
  verifier(Math.abs((s0.k - s1.k) - 1450 - 0) < 1 || (s0.k - s1.k) >= 1450, `le garage devrait payer 1450 € (brut + charges patronales) : ${s0.k - s1.k}`);
  verifier(s1.ch - s0.ch >= 1450 - .01, `les charges de salaire ne sont pas dans le bilan (${s1.ch - s0.ch})`);

  // 5. dividendes : bénéfice 2000 → impôt sur les sociétés 300 → distribuable 1700 ; on verse 1000 → net 700 après 30 %
  await e(() => { const c = __mws.get('garage5'); c.ex = { debut: __mw.S.day, ca: 2000, ch: 0, div: 0, pfu: 0, sal: 0, is: 0 }; c.compte = 10000; });
  const d0 = await e(() => __mws.distribuable('garage5'));
  verifier(d0.benefice === 2000 && d0.is === 300 && d0.dist === 1700, `distribuable inattendu : ${JSON.stringify(d0)}`);
  verifier(await e(() => __mws.isOf(50000)) === 8250, "l'impôt sur les sociétés n'a pas deux tranches (15 % puis 25 %)");
  const dm0 = await e(() => __mw.S.money);
  await e(() => __mws.dividendes('garage5', 2000));
  verifier(await e(m => __mw.S.money === m && __mws.get('garage5').compte === 10000, dm0), 'des dividendes supérieurs au bénéfice distribuable ont été versés');
  await e(() => __mws.dividendes('garage5', 1000));
  const d1 = await e(() => { const c = __mws.get('garage5'); return { m: __mw.S.money, k: c.compte, pfu: c.ex.pfu, div: c.ex.div }; });
  verifier(Math.abs(d1.m - dm0 - 700) < .01 && d1.k === 9000 && d1.pfu === 300 && d1.div === 1000, `dividendes mal calculés : ${JSON.stringify(d1)} (attendu +700 net, 300 de prélèvement)`);
  await e(() => { __mws.get('garage5').compte = 500; });
  await e(() => __mws.dividendes('garage5', 600));
  verifier(await e(() => __mws.get('garage5').compte === 500), 'des dividendes supérieurs au solde du compte ont été versés');

  // 6. panneau du compte, texte sans valeur absurde
  await e(() => __mws.panel('garage5'));
  await attendreVisible(page, '.mw-pn', 'le panneau « Compte du garage » ne s\'ouvre pas');
  const txt = await e(() => document.querySelector('.mw-pn').textContent);
  verifier(/Solde du compte/.test(txt) && /Dividendes/.test(txt) && /charges patronales/.test(txt) && /Bilan/.test(txt), `panneau incomplet : ${txt.slice(0, 200)}`);
  await verifierTextes(page, 'Compte du garage');
  await e(() => __mw.closePanel());
  // bouton du garage et « Mes biens » (touche B)
  await e(() => __mwi.fiche(__mw.zone('garage5')));
  await attendreVisible(page, '.mw-pn [data-mw="compte"]', 'la fiche du garage n\'a pas de bouton « Compte du garage »');
  await e(() => __mw.closePanel());
  await page.keyboard.press('b');
  await attendreVisible(page, '.mw-pn [data-mw="acct:garage5"]', '« Mes biens » n\'offre pas le compte du garage');
  await e(() => __mw.closePanel());

  // 7. clôture de l'exercice : bilan annuel et impôt sur les sociétés payé par le compte
  const y0 = await e(() => { const c = __mws.get('garage5'); c.compte = 50000; c.ex = { debut: __mw.S.day - 360, ca: 100000, ch: 20000, div: 0, pfu: 0, sal: 0, is: 0 }; __mw.emit('day', __mw.S.day); return c.compte; });
  const y1 = await e(() => { const c = __mws.get('garage5'); return { b: c.bilans.length && c.bilans[c.bilans.length - 1], k: c.compte, ca: c.ex.ca }; });
  const isAttendu = await e(b => __mws.isOf(b), y1.b && y1.b.benefice);
  verifier(y1.b && y1.b.ca === 100000 && Math.abs(y1.b.benefice - (100000 - y1.b.ch)) < .01 && y1.b.ch >= 20000 && y1.b.benefice > 79000 && Math.abs(y1.b.is - isAttendu) < .01 && y1.ca === 0, `bilan annuel inattendu : ${JSON.stringify(y1)}`);
  verifier(y1.k <= 50000 - y1.b.is + 1, `l'impôt sur les sociétés n'est pas payé par le compte (${y0} → ${y1.k})`);

  // 8. ancienne sauvegarde : un garage possédé sans société reçoit un compte à 0, sans rien perdre
  const m8 = await e(() => { delete __mw.S.soc; const m = __mw.S.money; const c = __mws.ensure('garage5'); return { m, m2: __mw.S.money, k: c && c.compte, p: c && c.parts.length }; });
  verifier(m8.k === 0 && m8.p === 1 && m8.m === m8.m2, `ancienne sauvegarde mal reprise : ${JSON.stringify(m8)}`);

  // 9. revente : la société est dissoute, le solde revient à l'associé
  await e(() => { MWC.stopWork(); __mws.deposit('garage5', 1000); });
  const v0 = await e(() => __mw.S.money);
  verifier(await e(() => __mwi.sell('garage5')), 'la revente du garage échoue');
  const v1 = await e(() => ({ m: __mw.S.money, soc: __mws.has('garage5') }));
  verifier(!v1.soc && v1.m > v0, `la société n'est pas dissoute à la revente (${JSON.stringify(v1)} / ${v0})`);

  // Garage du Coin repris en patron : une société aussi (reprise = apport, réserve versée sur le compte, loyer payé par le compte)
  const gc = await e(() => {
    MWC.hire('meca'); __mwj.clear(); __mw.S.jobs.next = 1e12; __mw.S.min = 600; __mw.S.rep = 60; __mw.S.money = 5000;
    for (const k of __mwj.SKILLS) __mw.S.xp[k] = 2000; delete (__mw.S.soc || {}).garage1;
    MWC.comptoir('garage1');
    return { panneau: !!document.querySelector('.mw-pn [data-mw="buy"]') };
  });
  verifier(gc.panneau, 'le comptoir du Garage du Coin ne propose pas la reprise');
  const achat = await e(() => {
    const b = document.querySelector('.mw-pn [data-mw="buy"]'); if (b) b.click();
    const c = __mws.get('garage1');
    return { emp: MWC.employer().id, perso: __mw.S.money, compte: c && c.compte, apport: c && c.parts[0].apport };
  });
  verifier(achat.emp === 'patron' && achat.compte === 500 && achat.apport === 1300 && achat.perso === 5000 - 1800, `reprise du Garage du Coin : société mal créée (${JSON.stringify(achat)})`);
  const gl = await e(() => { const k0 = __mws.get('garage1').compte, m0 = __mw.S.money; __mw.emit('day', __mw.S.day + 1);
    const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false }); c.done = { huile: 1, filtre_huile: 1 }; const k1 = __mws.get('garage1').compte; __mwj.done(c);
    return { loyer: Math.round(k0 - k1), facture: Math.round(__mws.get('garage1').compte - k1), perso: Math.round(__mw.S.money - m0) }; });
  verifier(gl.loyer === 200 && gl.facture > 0 && gl.perso === 0, `Garage du Coin : loyer ou facture pas sur le compte du garage (${JSON.stringify(gl)})`);
  return 'achat à crédit par la société, factures et pièces sur le compte, charges, salaire taxé, dividendes taxés, bilan annuel, revente ; Garage du Coin repris en patron (société, réserve, loyer et factures sur le compte)';
};
module.exports.titre = 'Mécanicien : société et compte du garage (joueur seul)';
