'use strict';
const { attendre, attendreVisible, cliquer, verifier, attendreCondition } = require('../outils.js');

// Mode Mécanicien (usines) : visiter avant d'acheter, acheter, entrer par la porte, préparer la marque au bureau d'études,
// fondre la marque et vérifier le départ de la carrière de constructeur (niveau d'usine, capital, message d'accueil).
module.exports = async function mecaUsines(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await page.evaluate(() => { try { localStorage.removeItem('bea.meca.v1'); } catch (e) {} });
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && typeof MWC !== 'undefined' && window.__mwi && window.__mwu, null, { timeout: 15000 });
  await page.evaluate(() => { if (typeof MWG !== 'undefined') MWG.set({ classic: true }); });
  await attendre(500);
  const ev = (f, a) => page.evaluate(f, a);
  const devant = async id => {
    await ev(zid => { const z = __mw.zone(zid); __mw.teleport(z.porte.x, z.porte.z, Math.atan2(z.n.x, z.n.z)); }, id);
    await attendre(400);
  };

  // 1. devant la porte : l'intérieur est construit, mais masqué ; en rue, il ne coûte rien
  await devant('usine1');
  verifier(await ev(() => __mwu.built('usine1') && !__mwu.inside()), "l'intérieur de l'usine devrait être construit à l'approche de la porte, sans y être");
  verifier(await ev(() => __mw.scene.getObjectByName('usine-int-usine1').visible === false), "l'intérieur devrait être masqué tant qu'on est dehors");
  await ev(() => { __mw.teleport(0, 60, 0); });
  await attendre(500);
  verifier(await ev(() => !__mwu.built('usine1') && !__mwu.built('usine2')), "les intérieurs devraient être détruits loin des usines");

  // 2. visite avant l'achat : la porte propose « Visiter »
  await devant('usine1');
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "E devant l'usine n'ouvre pas de fiche");
  const txt = await ev(() => document.querySelector('.mw-pn').textContent);
  verifier(/niveau d.usine de départ/i.test(txt) && /voitures par an/.test(txt), "la fiche devrait annoncer le niveau d'usine de départ et la capacité");
  await cliquer(page, '[data-mw="visit"]');
  await attendreCondition(page, () => __mwu.inside() === 'usine1', "la visite ne mène pas dans l'usine");
  verifier(await ev(() => { const p = __mw.player(); return p.x > 200 && p.z < -250; }), "le joueur n'est pas dans la salle de l'usine");
  const calls = await ev(() => __mw.renderer().info.render.calls);
  await attendre(400);
  const c2 = await ev(() => __mw.renderer().info.render.calls);
  verifier(c2 < 300, `trop d'appels de dessin dans l'usine : ${c2} (${calls})`);

  // 3. le bureau d'études d'une usine non achetée propose la fiche d'achat ; sortie par la porte
  await ev(() => __mwu.bureau('usine1'));
  await attendreVisible(page, '[data-mw="fiche"]', "le bureau d'une usine à vendre devrait proposer la fiche d'achat");
  await ev(() => __mw.closePanel());
  await ev(() => { const S = __mwu.info('usine1'); const z = __mw.player(); __mw.teleport(245, -268 + 15 - 1.6, Math.PI); });
  await attendre(300);
  await page.keyboard.press('e');
  await attendreCondition(page, () => !__mwu.inside(), "la sortie de l'usine échoue");
  verifier(await ev(() => __mw.player().zone === 'usine1'), 'on devrait ressortir devant la porte de la façade');

  // 4. achat comptant, puis entrée directe par la porte
  await ev(() => { __mw.S.money = 4000000; __mw.S.rep = 70; __mw.S.xp = __mw.S.xp || {}; for (const k of MWJ.SKILLS) __mw.S.xp[k] = 5000; const c = MWC.state(); for (const k in MWC.DIPL) c.dipl[k] = true; MWC.hire('patron'); });
  await devant('usine1');
  await page.keyboard.press('e');
  await attendre(300);
  await attendreVisible(page, '[data-mw="cash"]', "la fiche d'achat n'est pas proposée : " + (await ev(() => (document.querySelector('.mw-pn') || {}).textContent)));
  await cliquer(page, '[data-mw="cash"]');
  await attendreCondition(page, () => __mwi.owned('usine1'), "l'achat de l'usine échoue");
  await ev(() => __mw.closePanel());
  await page.keyboard.press('e');
  await attendreCondition(page, () => __mwu.inside() === 'usine1', "la porte d'une usine achetée devrait mener à l'intérieur");

  // 5. au bureau d'études : choisir le nom de la marque, voir la capacité
  await ev(() => __mwu.bureau('usine1'));
  await attendreVisible(page, '#mwBrand', 'le champ du nom de la marque est absent du bureau');
  const b = await ev(() => document.querySelector('.mw-pn').textContent);
  verifier(/Capacité de production/.test(b) && /par semaine/.test(b), 'le bureau devrait montrer capacité et charges');
  await page.fill('#mwBrand', 'Marque Atelier');
  await cliquer(page, '[data-mw="name"]');
  verifier(await ev(() => __mwi.brand() === 'Marque Atelier'), 'le nom de la marque doit être enregistré');
  await ev(() => __mw.closePanel());
  await ev(() => __mwu.board('usine1'));
  await attendreVisible(page, '.mw-pn', 'le tableau de production ne s\'ouvre pas');
  await ev(() => __mw.closePanel());

  // 6. la grande usine : banc d'essai, intérieur lourd mais sous le budget
  await ev(() => { __mwu.leave(); });
  await ev(() => __mwu.enter('usine2'));
  await attendreCondition(page, () => __mwu.inside() === 'usine2', "l'entrée dans la grande usine échoue");
  await attendre(500);
  const c3 = await ev(() => __mw.renderer().info.render.calls);
  verifier(c3 < 300, `trop d'appels de dessin dans la grande usine : ${c3}`);
  await ev(() => { __mwu.leave(); });

  // 7. fonder la marque depuis le bureau : la carrière de constructeur démarre avec l'usine, le nom et le capital
  await ev(() => __mwu.enter('usine1'));
  await ev(() => __mwu.bureau('usine1'));
  await attendreVisible(page, '[data-mw="found"]', 'le bouton de fondation est absent du bureau');
  verifier(await ev(() => !document.querySelector('[data-mw="found"]').disabled), 'la fondation devrait être possible');
  await cliquer(page, '[data-mw="found"]');
  await attendreCondition(page, () => typeof G !== 'undefined' && G && G.fac === 3 && G.co === 'Marque Atelier', "la marque n'est pas fondée avec le nom choisi et une usine de niveau 3", 20000);
  verifier(await ev(() => G.cash > 1e6 && G.rep > 30), 'la marque devrait démarrer avec le capital de la fondation');
  verifier(await ev(() => !__mwi.owned('usine1') && MWC.state().foundedIn && MWC.state().foundedIn.fac === 3), "l'usine doit être notée comme siège de la marque");
  await attendreVisible(page, '#mwWelcome', "le message d'accueil de la marque n'apparaît pas");
  const w = await ev(() => document.querySelector('#mwWelcome').textContent);
  verifier(/Marque Atelier/.test(w) && /Carrière de mécanicien/.test(w), "le message d'accueil doit expliquer la fondation et le retour au mode Mécanicien");
  return 'visite avant achat, achat, bureau d’études, banc d’essai, fondation avec nom et niveau d’usine';
};
module.exports.titre = 'mécanicien (usines) : intérieurs, bureau d’études, fondation de la marque';
