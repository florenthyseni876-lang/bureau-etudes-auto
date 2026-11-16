'use strict';
const J = require('../joueur.js');
module.exports = async function (page, env) {
  const { ev, prompt, photo, regarder, marcher, allerPorte, attendre, viser } = J;
  await J.ouvrir(page, env);
  await ev(page, () => { MWC.hire('meca'); __mw.S.min = 590; __mw.S.flags.coinVu = true; __mw.addMin(3); });
  await attendre(500);
  console.log('job:', await ev(page, () => { const c = __mwj.jobs()[0]; return c && c.ordre.join(','); }));
  await ev(page, () => { const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + 1.7, p.z, -Math.PI / 2, 0); MWG.ensure(c); });
  await attendre(500);
  console.log('cibles:', await ev(page, () => MWG.rig().tg.map(t => t.id).join(' ')));
  console.log('acts:', JSON.stringify(await ev(page, () => MWG.acts(__mwj.jobs()[0]).slice(0, 8).map(a => [a.id, a.key, a.lab, a.tool, a.why]))));
  console.log('viser servante:', await viser(page, 'servante'), await prompt(page));
  await photo(page, '30-servante');
  await page.keyboard.press('e'); await attendre(500);
  await photo(page, '31-servante-panneau');
  console.log(await ev(page, () => document.querySelector('.mw-pn').innerText.slice(0, 700)));
};
module.exports.titre = 'pneus'; module.exports.appareil = 'bureau';
