'use strict';
const { attendre, attendreVisible, verifier, verifierTextes, verifierPasDeDebordement } = require('../outils.js');

// Téléphone (iPhone 13) : interface pivotée, défilement au doigt, aucun débordement horizontal.
module.exports = async function telephone(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hFree', "l'accueil ne s'affiche pas sur téléphone");
  await attendre(500);
  const pivotee = await page.evaluate(() => !!(typeof LAND !== "undefined" && LAND.on));
  verifier(pivotee, "l'interface n'est pas pivotée en paysage sur téléphone en portrait");
  await verifierPasDeDebordement(page, 'accueil');
  await verifierTextes(page, 'accueil');

  await page.tap('#hFree');
  await attendreVisible(page, '#tabs .tab', "les onglets n'apparaissent pas sur téléphone");
  await attendre(700);
  await verifierPasDeDebordement(page, 'mode libre');

  // Défilement au doigt : glisser « vers le haut » de l'interface (vers la droite de l'écran si pivotée).
  const cdp = await page.context().newCDPSession(page);
  const sc = () => page.evaluate(() => (typeof LAND !== "undefined" && LAND.on ? LAND.scroll.scrollTop : window.scrollY));
  const avant = await sc();
  const vp = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
  const depart = { x: vp[0] * 0.3, y: vp[1] * 0.5 }, arrivee = { x: vp[0] * 0.85, y: vp[1] * 0.5 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [depart] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: depart.x + (arrivee.x - depart.x) * i / 10, y: depart.y + (arrivee.y - depart.y) * i / 10 }],
    });
    await attendre(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await attendre(900);
  const apres = await sc();
  verifier(Math.abs(apres - avant) > 10, `le défilement au doigt ne fait pas bouger la page (${Math.round(avant)} → ${Math.round(apres)})`);
  await verifierPasDeDebordement(page, 'mode libre après défilement');

  // Essais et carrière : pas de débordement sur ces écrans non plus.
  await page.evaluate(() => window.__bea.setTab('essais'));
  await attendre(700);
  await verifierPasDeDebordement(page, 'essais');
  await verifierTextes(page, 'essais');

  await page.tap('#homeBtn');
  await attendreVisible(page, '#hNew', "retour à l'accueil impossible");
  await page.tap('#hNew');
  await attendreVisible(page, '#hFound', "écran de fondation absent sur téléphone");
  await page.tap('#hFound');
  await attendreVisible(page, '[data-newcar]', 'quartier général absent sur téléphone');
  await verifierPasDeDebordement(page, 'quartier général');
  await verifierTextes(page, 'quartier général');
  return `interface pivotée, défilement de ${Math.round(apres - avant)} px`;
};


module.exports.titre = 'téléphone (iPhone 13) : pivoté, défilement au doigt, pas de débordement';
module.exports.appareil = 'iPhone 13';
