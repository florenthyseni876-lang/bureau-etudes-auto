'use strict';
const J = require('../joueur.js');
module.exports = async function (page, env) {
  const { ev, attendre } = J;
  await J.ouvrir(page, env);
  await J.allerPorte(page, 'garage1');
  const ac = await ev(page, () => __mw.zone('garage1').accueil);
  await J.marcher(page, [[ac.x, ac.z - 1.6]]);
  await J.regarder(page, ac.x, ac.z, 1.0); await attendre(300);
  await page.keyboard.press('e'); await attendre(400);
  await page.getByRole('button', { name: /Devenir apprenti/i }).click(); await attendre(800);
  console.log('paused', await ev(page, () => [__mw.paused, JSON.stringify(__mw.player().x), document.pointerLockElement && 1]));
  console.log(await J.marcher(page, [[-70, 13.4]]));
  await attendre(300);
  await page.keyboard.down('w');
  for (let i = 0; i < 8; i++) { await attendre(200); console.log(JSON.stringify(await ev(page, () => { const p = __mw.player(); return [p.x.toFixed(2), p.z.toFixed(2), p.ry.toFixed(2), __mw.paused]; }))); }
  await page.keyboard.up('w');
  const w = await ev(page, () => (__mw.walls || []).filter(b => Math.abs(b[0] + 62) < 6 && Math.abs(b[1] - 13) < 4).slice(0, 10));
  console.log('walls', JSON.stringify(w));
};
module.exports.titre = 'dbg'; module.exports.appareil = 'bureau';
