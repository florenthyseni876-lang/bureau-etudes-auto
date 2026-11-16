'use strict';
const J = require('../joueur.js');
// Visite chaque lieu de la ville : on se téléporte devant la porte (signalé : raccourci), on regarde, E, et on note ce que voit le joueur.
module.exports = async function (page, env) {
  const { ev, prompt, photo, regarder, attendre } = J;
  await J.ouvrir(page, env);
  await J.espionner(page);
  const zs = await ev(page, () => __mw.zones.map(z => ({ id: z.id, nom: z.nom, type: z.type, porte: z.porte, n: z.n, acc: z.accueil })));
  console.log(zs.map(z => z.id + ':' + z.type).join(' '));
  for (const z of zs) {
    if (z.type === 'logement' && z.id !== 'appart') continue;
    const p = z.type === 'garage' ? z.acc : z.porte;
    // devant la porte, côté rue
    const out = z.type === 'garage' ? { x: z.acc.x - z.n.x * 1.6, z: z.acc.z - z.n.z * 1.6 } : { x: z.porte.x - z.n.x * 1.2, z: z.porte.z - z.n.z * 1.2 };
    await ev(page, o => __mw.teleport(o.x, o.z, 0, 0), out);
    await regarder(page, p.x, p.z, 1.0); await attendre(450);
    const inv = await prompt(page);
    await page.keyboard.press('e'); await attendre(500);
    const pn = await J.panneau(page);
    console.log(`--- ${z.id} (${z.nom}) invite=« ${inv} » panneau=`, pn ? pn.replace(/\n+/g, ' / ').slice(0, 500) : 'AUCUN');
    if (pn) {
      const btns = await ev(page, () => [...document.querySelectorAll('.mw-pn [data-mw]')].map(b => b.dataset.mw + '=' + b.innerText.trim().replace(/\n/g, ' ').slice(0, 40)).join(' ; '));
      console.log('   boutons:', btns.slice(0, 600));
      await photo(page, 'lieu-' + z.id);
      await page.keyboard.press('Escape'); await attendre(300);
    } else await photo(page, 'lieu-' + z.id);
  }
};
module.exports.titre = 'lieux'; module.exports.appareil = 'bureau';
