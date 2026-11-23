'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (stock de pièces) : l'étagère montre des quantités et prendre une pièce la retire du stock ; une pièce en rupture
// se commande à l'ordinateur du bureau (employeur, compte du garage, argent personnel chez soi), la livraison remplit le stock ;
// ce qu'on achète au magasin se range au stock ; le travail automatique commande la pièce manquante et laisse la voiture en attente.
module.exports = async function mecaStock(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWST !== 'undefined' && typeof MWAUTO !== 'undefined', null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  const pres = async (x, z, ry) => { await e(([x, z, ry]) => __mw.teleport(x, z, ry), [x, z, ry || 0]); await attendre(350); };

  // 1. étagère : quantités, prendre retire du stock
  await e(() => { MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; __mw.S.inv.length = 0; });
  const q0 = await e(() => MWST.qty('garage1', 'huile'));
  verifier(q0 >= 3, `stock initial du Garage du Coin trop faible (huile : ${q0})`);
  const et = await e(() => { const z = __mw.zone('garage1'), n = z.n; return { x: z.etagere.x - n.x * 1.1, z: z.etagere.z - n.z * 1.1 }; });
  await pres(et.x, et.z, 0);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "E devant l'étagère n'ouvre pas de panneau");
  verifier(/en stock/.test(await e(() => document.querySelector('.mw-pn').textContent)), "l'étagère n'affiche pas les quantités");
  await cliquer(page, '[data-mw="take:huile"]', 'bouton « Prendre » (huile) absent');
  verifier((await e(() => MWST.qty('garage1', 'huile'))) === q0 - 1, "prendre une pièce ne retire pas du stock");
  verifier(await e(() => __mw.S.inv.some(it => it.id === 'huile' && it.k === 'neuve')), 'la pièce prise n\'est pas dans l\'inventaire');
  // rupture : plus de bouton actif
  await e(() => { while (MWST.qty('garage1', 'huile') > 0) MWST.take('garage1', 'huile'); __mw.closePanel(); });
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "l'étagère ne se rouvre pas");
  verifier(await e(() => document.querySelector('[data-mw="take:huile"]').disabled), 'on peut prendre une pièce en rupture');
  await e(() => __mw.closePanel());

  // 2. commande par l'ordinateur (salarié : l'employeur paie, livraison le lendemain à 9 h)
  const pc = await e(() => { const z = __mw.zone('garage1'); return { x: z.pc.x, z: z.pc.z }; });
  await pres(pc.x, pc.z, 0);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "E devant l'ordinateur n'ouvre pas le site de commande");
  verifier(/Pièces Auto Express/.test(await e(() => document.querySelector('.mw-pn').textContent)), 'le site de commande ne s\'affiche pas');
  const m0 = await e(() => __mw.S.money);
  await cliquer(page, '[data-mw="add:embrayage"]', 'bouton « +1 » (embrayage) absent');
  await cliquer(page, '[data-mw="cmd"]', 'bouton « Commander » absent');
  const c1 = await e(() => ({ pend: MWST.pending('garage1').map(c => ({ items: c.items, mode: c.mode, cout: c.cout, texte: MWST.dueText(c.due) })), argent: __mw.S.money }));
  verifier(c1.pend.length === 1 && c1.pend[0].items.embrayage === 1 && c1.pend[0].cout === 0 && /demain à 9 h/.test(c1.pend[0].texte), `commande de l'employeur incorrecte (${JSON.stringify(c1)})`);
  verifier(c1.argent === m0, "le salarié paie la commande de l'employeur");
  await e(() => __mw.closePanel());
  // livraison : camionnette puis stock
  const l1 = await e(() => { const c = MWST.R().cmd[0]; c.due = 0; MWST.tick(); return { q: MWST.qty('garage1', 'embrayage'), reste: MWST.pending('garage1').length }; });
  verifier(l1.q === 1 && l1.reste === 0, `la livraison n'entre pas dans le stock (${JSON.stringify(l1)})`);

  // 3. patron : le compte du garage paie, express possible
  const p2 = await e(() => { MWC.hire('patron'); MWS.biz(5000, 'test'); const avant = MWS.cash(); const r = MWST.order('garage1', { huile: 2 }, 'express'); return { avant, apres: MWS.cash(), r: r.ok, cout: r.ord && r.ord.cout, mode: r.ord && r.ord.mode }; });
  verifier(p2.r && p2.mode === 'express' && p2.cout > 18 && Math.abs((p2.avant - p2.apres) - p2.cout) < .02, `commande du patron incorrecte (${JSON.stringify(p2)})`);

  // 4. magasin : ce qu'on achète se range au stock (patron : remboursé par le compte du garage)
  const p3 = await e(() => { const avant = MWST.qty('garage1', 'filtre_air'); __mw.S.inv.length = 0; __mw.S.inv.push({ k: 'neuve', id: 'filtre_air', src: 'achat', paye: 18 }); return avant; });
  await pres(et.x, et.z, 0);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "l'étagère ne s'ouvre pas (patron)");
  await cliquer(page, '[data-mw="rangeachat"]', 'bouton « Ranger mes pièces achetées » absent');
  verifier((await e(() => MWST.qty('garage1', 'filtre_air'))) === p3 + 1, "la pièce achetée n'est pas rangée dans le stock");
  await e(() => __mw.closePanel());

  // 5. chez soi : l'argent personnel paie, la livraison entre dans le coffre du logement
  const h = await e(() => { const m = __mw.S.money; const cap = MWST.cap('appart'); const r = MWST.order('appart', { huile: 1, bougies: 1 }, 'next'); const apres = __mw.S.money; MWST.R().cmd.forEach(c => { if (c.lieu === 'appart') c.due = 0; }); MWST.tick(); return { cap, ok: r.ok, paye: Math.round((m - apres) * 100) / 100, q: MWST.qty('appart', 'huile') + MWST.qty('appart', 'bougies') }; });
  verifier(h.cap > 0 && h.ok && h.paye > 6 && h.q === 2, `commande chez soi incorrecte (${JSON.stringify(h)})`);

  // 6. travail automatique : la pièce manquante est commandée, la voiture attend sa livraison
  await e(() => { MWC.hire('meca'); __mwj.clear(); __mw.S.jobs.next = 1e12; MWST.R().cmd.length = 0; while (MWST.qty('garage1', 'embrayage') > 0) MWST.take('garage1', 'embrayage');
    __mw.S.min = 600; const c = __mwj.spawn({ travaux: ['embrayage'], silencieux: true }); const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); });
  const a1 = await e(() => { const c = __mwj.jobs()[0]; return { pend: MWST.pendQty('garage1', 'embrayage'), niv: __mwj.level('transmission') }; });
  verifier(a1.pend === 1, "l'employeur ne commande pas la pièce du gros travail à l'arrivée du client");
  await e(() => { __mw.S.xp.transmission = 5000; __mw.S.xp.entretien = 5000; MWAUTO.start(false); });
  await attendre(1500);
  const a2 = await e(() => { const c = __mwj.jobs()[0]; return { att: c.attendLivraison > 0, occupe: MWAUTO.busy(), fait: !!c.done.embrayage }; });
  verifier(a2.att && !a2.occupe && !a2.fait, `le travail automatique ne laisse pas la voiture en attente de livraison (${JSON.stringify(a2)})`);
  // après la livraison, le travail se fait
  await e(() => { MWST.R().cmd.forEach(c => c.due = 0); MWST.tick(); const c = __mwj.jobs()[0]; c.attendLivraison = 0; MWAUTO.start(false); });
  await attendreCondition(page, () => MWAUTO.busy() || __mwj.jobs()[0].done.embrayage === 1, "le travail automatique ne reprend pas après la livraison", 20000);
  verifier(await e(() => MWST.qty('garage1', 'embrayage') === 0 && __mw.S.inv.some(it => it.id === 'embrayage' && it.k === 'neuve') || __mwj.jobs()[0].done.embrayage === 1), "la pièce livrée n'est pas prise dans le stock par le travail automatique");
  await e(() => MWAUTO.stop());
  return 'stock qui baisse, rupture, commande (employeur, patron express, chez soi), livraison, rangement des achats, travail automatique en attente de livraison';
};

module.exports.titre = 'mécanicien (stock) : étagère, rupture, ordinateur, livraison, magasin, travail automatique';
