'use strict';
const J = require('../joueur.js');
// Chaque lieu de la ville s'ouvre avec E quand on se tient devant la porte et qu'on la regarde (invite [E], panneau lisible).
module.exports = async function (page, env) {
  const { ev, verifier, regarder, attendre } = J;
  await J.ouvrir(page, env);
  const zs = await ev(page, () => __mw.zones.filter(z => z.id !== 'cour').map(z => ({ id: z.id, type: z.type, porte: z.porte, n: z.n, acc: z.accueil })));
  const vus = [];
  for (const z of zs) {
    const p = z.type === 'garage' ? z.acc : z.porte;
    const o = z.type === 'garage' ? { x: z.acc.x - z.n.x * 1.6, z: z.acc.z - z.n.z * 1.6 } : { x: z.porte.x - z.n.x * 1.2, z: z.porte.z - z.n.z * 1.2 };
    await ev(page, o => { __mw.closePanel(); __mw.teleport(o.x, o.z, 0, 0); }, o);
    await regarder(page, p.x, p.z, 1.0); await attendre(350);
    verifier(/^\[E\]/.test(await J.prompt(page)), `pas d'invite [E] devant « ${z.id} »`);
    await page.keyboard.press('e'); await attendre(350);
    const pn = await J.panneau(page);
    verifier(pn && pn.length > 40, `E n'ouvre aucun panneau devant « ${z.id} »`);
    verifier(!/\b(NaN|undefined|Infinity)\b/.test(pn), `texte suspect dans « ${z.id} » : ${pn.slice(0, 80)}`);
    vus.push(z.id);
    await page.keyboard.press('Escape'); await attendre(200);
  }
  return vus.length + ' lieux ouverts';
};
module.exports.titre = 'joueur : tous les lieux de la ville s\'ouvrent devant leur porte';
module.exports.appareil = 'bureau';
