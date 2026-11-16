'use strict';
const J = require('../joueur.js');
module.exports = async function (page, env) {
  const { ev, prompt, photo, attendre } = J;
  await J.ouvrir(page, env);
  await J.espionner(page);
  await ev(page, () => { MWC.hire('meca'); __mw.S.min = 590; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; __mwj.spawn({ tpl: 'vidange', force: true }); });
  await attendre(500);
  console.log('job:', await ev(page, () => __mwj.jobs()[0].ordre.join(',')));
  await ev(page, () => { const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + 1.7, p.z, -Math.PI / 2, 0); MWG.ensure(c); });
  // étagère : les pièces neuves
  const ez = await ev(page, () => { const z = __mw.zone('garage1'), e = z.etagere, n = z.n; return [e.x - n.x * 1.1, e.z - n.z * 1.1, e.x, e.z]; });
  await J.marcher(page, [[ez[0], ez[1] - 1.5]]);
  await J.regarder(page, ez[2], ez[3], 1.0); await attendre(300);
  console.log('invite étagère:', await prompt(page));
  await page.keyboard.press('e'); await attendre(400);
  await photo(page, '40-etagere');
  console.log((await J.panneau(page) || 'pas de panneau').slice(0, 400).replace(/\n/g, ' / '));
  try { await J.ficheAction(page, 'need'); } catch (e) { console.log('pas de bouton need'); }
  await page.keyboard.press('Escape'); await attendre(300);
  console.log('toasts', await J.toasts(page));
  for (let n = 0; n < 60; n++) {
    const r = await J.etapeAide(page);
    if (r.fin) {
      // pas d'étape proposée : un joueur attend ; que lui dit l'écran ?
      let reprise = false;
      for (let w = 0; w < 12 && !reprise; w++) {
        console.log('  attente', w * 10, 's :', (await ev(page, () => ['mg-info', 'mg-hint', 'mg-aux'].map(c => (document.querySelector('.' + c) || {}).innerText || '').join(' | ').replace(/\n/g, ' '))).slice(0, 250));
        if (w === 1) await photo(page, '42-attente');
        await attendre(10000);
        reprise = !!(await ev(page, () => MWG.nextHint()));
      }
      if (!reprise) { console.log('ARRÊT : plus d\'aide après attente', await ev(page, () => JSON.stringify(MWG.blocage(__mwj.jobs()[0])))); break; }
      continue;
    }
    if (r.blocage) { console.log('ARRÊT', JSON.stringify(r)); break; }
    console.log(n, r.fait, r.change === false ? 'SANS EFFET' : '', r.invite || '', (r.toasts || []).join(' | ').slice(0, 160));
  }
  await photo(page, '41-fin');
  console.log('done', await ev(page, () => JSON.stringify(__mwj.jobs()[0].done)), 'inv', await ev(page, () => __mw.S.inv.map(i => i.k + ':' + i.id).join(',')));
};
module.exports.titre = 'vidange'; module.exports.appareil = 'bureau';
