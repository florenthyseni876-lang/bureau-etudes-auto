'use strict';
const { attendre, attendreVisible, verifier, verifierTextes, verifierPasDeDebordement } = require('../outils.js');

// Mode Mécanicien sur téléphone (iPhone 13, interface pivotée) : HUD dans l'écran, joystick tactile, panneau lisible.
module.exports = async function mecaTelephone(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil du téléphone");
  await attendre(400);
  await page.tap('#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas sur téléphone");
  await page.waitForFunction(() => window.__mw && window.__mw.S, null, { timeout: 15000 });
  await attendre(800);
  verifier(await page.evaluate(() => LAND.on), "l'interface n'est pas pivotée");
  await verifierPasDeDebordement(page, 'mode Mécanicien (téléphone)');
  await page.evaluate(() => { __mw.hud('job', 'Ordre en cours : vidange de la petite voiture bleue du client'); __mw.hud('career', 'Apprenti · Garage du Coin'); });
  await attendre(300);

  const hors = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight, res = [];
    for (const s of ['.mw-top', '.mw-zones', '.mw-tr', '.mw-joy', '.mw-acts', '.mw-toasts']) {
      const e = document.querySelector(s); if (!e) { res.push(s + ' absent'); continue; }
      const r = e.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) res.push(`${s} déborde (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)} dans ${W}x${H})`);
    }
    return res;
  });
  verifier(!hors.length, 'HUD hors de l\'écran : ' + hors.join(' ; '));
  await verifierTextes(page, 'HUD téléphone');

  // joystick au doigt : « vers le haut » de l'interface = vers la droite de l'écran
  const cdp = await page.context().newCDPSession(page);
  const c = await page.evaluate(() => { const r = document.querySelector('.mw-joy').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
  const p0 = await page.evaluate(() => __mw.player());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + c.w * 0.45, y: c.y }] });
  await page.waitForFunction(p => Math.hypot(__mw.player().x - p.x, __mw.player().z - p.z) > 2, p0, { timeout: 15000 })
    .catch(() => { throw new Error('le joystick tactile ne fait pas avancer le joueur'); });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // panneau (menu) : bien dans l'écran
  await page.tap('[data-b="menu"]');
  await attendreVisible(page, '.mw-pn', "le bouton Menu n'ouvre pas le panneau");
  const pn = await page.evaluate(() => { const r = document.querySelector('.mw-pn').getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
  verifier(pn, 'le panneau de pause déborde de l\'écran du téléphone');
  await verifierPasDeDebordement(page, 'panneau du mode Mécanicien');
  await page.tap('[data-mw="resume"]');
  await page.tap('[data-b="map"]');
  await attendreVisible(page, '#mwBig', 'la grande carte ne s\'ouvre pas');
  await attendre(300);
  await verifierPasDeDebordement(page, 'grande carte (téléphone)');
  return 'HUD dans l\'écran, joystick, menu et carte';
};

module.exports.titre = 'mécanicien (téléphone iPhone 13) : HUD, joystick tactile, menu, carte';
module.exports.appareil = 'iPhone 13';
