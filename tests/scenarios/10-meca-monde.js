'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes, verifierPasDeDebordement } = require('../outils.js');

// Mode Mécanicien (socle) : ouvrir depuis l'accueil, marcher, conduire, carte, sauvegarde et reprise.
module.exports = async function mecaMonde(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S, null, { timeout: 15000 });
  await attendre(600);

  const s0 = await page.evaluate(() => ({ s: JSON.parse(JSON.stringify(__mw.S)), z: __mw.zones.map(z => z.id), p: __mw.player() }));
  verifier(s0.s.money === 300 && s0.s.day === 1 && s0.s.min >= 450, `départ inattendu : argent ${s0.s.money}, jour ${s0.s.day}, minute ${s0.s.min}`);
  for (const id of ['appart', 'garage1', 'pieces', 'garage2', 'garage3', 'garage4', 'ecole', 'bureau', 'banque', 'terrain', 'concess'])
    verifier(s0.z.includes(id), `zone absente : ${id}`);
  const g = await page.evaluate(() => { const z = __mw.zone('garage1'); return [z.ponts.length, !!z.etabli, !!z.etagere, __mw.zone('garage2').ponts.length]; });
  verifier(g[0] === 2 && g[1] && g[2] && g[3] === 3, 'les garages n\'exposent pas leurs ponts, établi et étagère');
  const rendu = await page.evaluate(() => { const c = document.getElementById('mwCv'); return c.width > 10 && c.height > 10; });
  verifier(rendu, 'le rendu 3D n\'a pas de taille');
  await verifierPasDeDebordement(page, 'mode Mécanicien');

  // 1. marcher quelques secondes avec Z
  await page.keyboard.down('z');
  await page.waitForFunction(p => Math.hypot(__mw.player().x - p.x, __mw.player().z - p.z) > 3, s0.p, { timeout: 15000 }).catch(() => {});
  await page.keyboard.up('z');
  const p1 = await page.evaluate(() => __mw.player());
  const d1 = Math.hypot(p1.x - s0.p.x, p1.z - s0.p.z);
  verifier(d1 > 3, `la marche avec Z ne déplace pas le joueur (${d1.toFixed(1)} m)`);
  const m1 = await page.evaluate(() => __mw.S.min);
  verifier(m1 > s0.s.min, "l'horloge du jeu n'avance pas");

  // 2. monter dans la voiture avec F, rouler
  await page.evaluate(() => { const c = __mw.playerCar(); __mw.teleport(c.x - 3, c.z + 3, 0); });
  await attendre(300);
  await page.keyboard.press('f');
  await attendre(200);
  verifier(await page.evaluate(() => __mw.player().inCar), "F ne fait pas monter dans la voiture");
  const c0 = await page.evaluate(() => { const c = __mw.playerCar(); return [c.x, c.z]; });
  await page.keyboard.down('z');
  await page.waitForFunction(c => Math.hypot(__mw.playerCar().x - c[0], __mw.playerCar().z - c[1]) > 8, c0, { timeout: 15000 }).catch(() => {});
  const v = await page.evaluate(() => __mw.playerCar().speed);
  await page.keyboard.up('z');
  const c1 = await page.evaluate(() => { const c = __mw.playerCar(); return [c.x, c.z]; });
  verifier(v > 1 && Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 5, `la voiture ne roule pas (vitesse ${v})`);
  await page.keyboard.down('s');
  await page.waitForFunction(() => Math.abs(__mw.playerCar().speed) < 2, null, { timeout: 15000 }).catch(() => {});
  await page.keyboard.up('s');
  await page.keyboard.press('f');
  await attendre(200);
  verifier(!(await page.evaluate(() => __mw.player().inCar)), "F ne fait pas descendre de la voiture");

  // 3. la carte
  await page.keyboard.press('m');
  await attendreVisible(page, '#mwMap', "la touche M n'ouvre pas la grande carte");
  verifier(await page.evaluate(() => __mw.paused), 'la carte ne met pas le jeu en pause');
  await page.keyboard.press('m');
  await attendre(200);
  verifier(!(await page.evaluate(() => __mw.paused)), 'M ne referme pas la carte');

  // 4. entrer dans un garage à pied, interaction, panneau
  await page.evaluate(() => { const z = __mw.zone('garage1'); const a = z.accueil; __mw.teleport(a.x - z.n.x * 1.3, a.z - z.n.z * 1.3, Math.atan2(z.n.x, z.n.z)); });
  await attendre(400);
  verifier((await page.evaluate(() => __mw.player().zone)) === 'garage1', "le joueur n'est pas détecté dans le Garage du Coin");
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "E devant l'accueil n'ouvre pas de panneau");
  await verifierTextes(page, 'panneau du garage');
  await page.keyboard.press('Escape');
  await attendre(200);
  verifier(!(await page.evaluate(() => __mw.paused)), 'Échap ne ferme pas le panneau');

  // 5. argent, sauvegarde, fermeture, réouverture
  await page.evaluate(() => { __mw.money(45, 'essai'); __mw.teleport(-40, 50, 1.2); __mw.S.flags.test = 'ok'; });
  const av = await page.evaluate(() => { __mw.save(); return __mw.player(); });
  verifier(await page.evaluate(() => __mw.S.money) === 345, "l'argent n'est pas mis à jour");
  await page.keyboard.press('Escape');
  await attendreVisible(page, '.mw-pn', "Échap n'ouvre pas le menu pause");
  await cliquer(page, '[data-mw="quit"]', 'bouton « Quitter vers l\'accueil » absent');
  await attendreVisible(page, '#hMeca', "l'accueil ne revient pas");
  await attendre(300);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', 'la réouverture échoue');
  await attendre(500);
  // rechargement complet : la position vient de la sauvegarde
  await page.reload();
  await attendreVisible(page, '#hMeca', 'accueil absent après rechargement');
  await cliquer(page, '#hMeca');
  await page.waitForFunction(() => window.__mw && window.__mw.S && document.getElementById('mwRoot') && !document.getElementById('mwRoot').hidden, null, { timeout: 15000 });
  await attendre(300);
  const ap = await page.evaluate(() => ({ p: __mw.player(), m: __mw.S.money, f: __mw.S.flags.test }));
  verifier(Math.hypot(ap.p.x - av.x, ap.p.z - av.z) < 1.5, `position non restaurée (${ap.p.x.toFixed(1)}, ${ap.p.z.toFixed(1)} au lieu de ${av.x.toFixed(1)}, ${av.z.toFixed(1)})`);
  verifier(ap.m === 345 && ap.f === 'ok', 'argent ou drapeaux non restaurés');

  // 6. sommeil : 6 h du jour suivant
  await page.evaluate(() => __mw.sleep());
  await page.waitForFunction(() => !__mw.paused, null, { timeout: 8000 });
  const j = await page.evaluate(() => [__mw.S.day, __mw.S.min]);
  verifier(j[0] === 2 && j[1] === 360, `dormir ne mène pas à 6 h le lendemain (jour ${j[0]}, minute ${j[1]})`);
  await verifierTextes(page, 'mode Mécanicien');
  return 'marche, voiture, carte, panneau, sauvegarde et sommeil';
};

module.exports.titre = 'mécanicien (socle) : marche, voiture, carte, sauvegarde, sommeil';
module.exports.appareil = 'bureau';
