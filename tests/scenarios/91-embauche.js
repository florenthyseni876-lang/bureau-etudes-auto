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
  await attendre(700);
  console.log('panneau après embauche:', await ev(page, () => (document.querySelector('.mw-pn') || {}).innerText));
  await photo(page, '10-apres-embauche');
  const hud = () => ev(page, () => [...document.querySelectorAll('#mwRoot .mw-hud, #mwRoot [class*=hud]')].map(x => x.innerText).join(' | ').slice(0, 600));
  console.log('HUD:', await hud());
  for (const [touche, nom] of [['m', 'carte'], ['Tab', 'carnet'], ['h', 'guide'], ['c', 'carriere'], ['g', 'gestes'], ['b', 'biens']]) {
    await page.keyboard.press(touche); await attendre(700);
    await photo(page, '11-' + nom);
    console.log(nom, '=>', (await ev(page, () => { const p = document.querySelector('.mw-pn:not([hidden])'); const pw = document.querySelector('.mw-pn').closest('[hidden]'); const m = document.getElementById('mwMap'); return (p && !pw && p.innerText.slice(0, 300)) || (m && !m.hidden ? '[carte]' : '[rien]'); })).replace(/\n+/g, ' / '));
    await page.keyboard.press('Escape'); await attendre(400);
    const ouvert = await ev(page, () => (!!document.querySelector('.mw-pn') && !document.querySelector('.mw-pn').closest('[hidden]')) || (document.getElementById('mwMap') && !document.getElementById('mwMap').hidden));
    if (ouvert) console.log('  !! Échap ne referme pas', nom);
  }
};
module.exports.titre = 'embauche'; module.exports.appareil = 'bureau';
