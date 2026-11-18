'use strict';
const J = require('../joueur.js');
// Parcours d'un nouveau joueur, aux touches : marcher jusqu'au Garage du Coin (Z), se faire embaucher au comptoir (E),
// prendre les pièces à l'étagère, changer les essuie-glaces en suivant l'aide (gestes, E maintenu), rendre la voiture et toucher la paie.
// Raccourci signalé : le client est choisi (essuie-glaces) pour que le parcours soit toujours le même.
module.exports = async function (page, env) {
  const { ev, verifier, attendre } = J;
  await J.ouvrir(page, env); await J.espionner(page);
  const bloque = await J.allerPorte(page, 'garage1');
  verifier(!bloque, 'impossible de marcher jusqu\'à la porte du Garage du Coin : bloqué en ' + JSON.stringify(bloque));
  const ac = await ev(page, () => __mw.zone('garage1').accueil);
  await J.marcher(page, [[ac.x, ac.z - 1.6]]);
  await J.regarder(page, ac.x, ac.z, 1.0); await attendre(400);
  verifier(/^\[E\]/.test(await J.prompt(page)), 'pas d\'invite [E] devant le comptoir');
  await page.keyboard.press('e'); await attendre(500);
  await page.getByRole('button', { name: /Devenir apprenti/i }).click();
  await attendre(600);
  verifier(await ev(page, () => MWC.employer().id === 'apprenti'), 'on n\'est pas embauché comme apprenti');
  await ev(page, () => { __mw.S.min = 590; __mw.S.jobs.next = 1e12; __mwj.clear(); const c = __mwj.spawn({ tpl: 'essuie', force: true }); const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + 2.2, p.z, -Math.PI / 2, 0); MWG.ensure(c); });
  await attendre(500);
  const e1 = await J.etagerePrendre(page);
  verifier(e1.besoin, 'l\'étagère ne propose pas les pièces de l\'ordre');
  const t = await J.travailler(page);
  verifier(t.ok, 'le travail ne va pas jusqu\'à l\'habitacle : ' + t.blocage);
  await J.ficheAction(page, 'rendre'); await attendre(500);
  await J.ficheAction(page, 'ok'); await attendre(1000);
  const pn = await J.panneau(page);
  verifier(pn && /VOITURE RENDUE/i.test(pn), 'l\'écran « Voiture rendue » n\'apparaît pas : ' + pn);
  verifier(await ev(page, () => __mw.S.money > 300), 'aucune paie versée');
  return 'embauche, étagère, essuie-glaces aux gestes, rendu et paie';
};
module.exports.titre = 'joueur : marcher, embauche, premier travail aux gestes, paie';
module.exports.appareil = 'bureau';
