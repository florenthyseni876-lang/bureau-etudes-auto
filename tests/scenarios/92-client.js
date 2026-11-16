'use strict';
const J = require('../joueur.js');
module.exports = async function (page, env) {
  const { ev, prompt, photo, regarder, marcher, allerPorte, attendre, cliquer } = J;
  await J.ouvrir(page, env);
  await allerPorte(page, 'garage1');
  const ac = await ev(page, () => __mw.zone('garage1').accueil);
  await marcher(page, [[ac.x, ac.z - 1.6]]);
  await regarder(page, ac.x, ac.z, 1.0); await attendre(300);
  await page.keyboard.press('e'); await attendre(400);
  await page.getByRole('button', { name: /Devenir apprenti/i }).click();
  await attendre(800);
  const z = await ev(page, () => { const z = __mw.zone('garage1'); const c = __mwj.jobs()[0]; return { ponts: z.ponts, etabli: z.etabli, etagere: z.etagere, ac: z.accueil, c: c && { pont: c.pont, zone: c.zone, ordre: c.ordre } }; });
  console.log(JSON.stringify(z));
  const p = z.ponts[0];
  // marcher jusqu'à côté du pont
  console.log('bloqué:', await marcher(page, [[ac.x - 4, ac.z - 1.6], [ac.x - 4, ac.z + 3], [p.x + Math.cos(p.ry) * 2.5, p.z - Math.sin(p.ry) * 2.5]]));
  await regarder(page, p.x, p.z, 0.7); await attendre(800);
  await photo(page, '20-pont');
  console.log('visé:', await ev(page, () => { const A = MWG.aim(); return A && A.t.id + ':' + A.a.key; }), 'invite:', await prompt(page));
  console.log('infos:', await ev(page, () => ['mg-info', 'mg-hint', 'mg-tools'].map(c => (document.querySelector('.' + c) || {}).innerText).join(' || ')));
};
module.exports.titre = 'client'; module.exports.appareil = 'bureau';
