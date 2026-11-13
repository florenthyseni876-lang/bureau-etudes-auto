'use strict';
const { attendre, verifier, verifierTextes, verifierPasDeDebordement } = require('../outils.js');

// Nouveaux écrans de carrière : concurrents (Marché), Compétition (inscription et course animée), Marketing.
module.exports = async function nouveautes(page, env) {
  await page.goto(env.url);
  await page.click('#hNew');
  await page.evaluate(() => { const r = document.querySelector('input[name=eraY][value="1950"]'); if (r) r.checked = true; });
  await page.click('#hFound');
  await attendre(500);
  // un modèle en vente, temps arrêté
  await page.evaluate(() => {
    const m = { id: G.mid++, name: 'Essai 50', y: G.y, q: G.q, price: 3000, snap: Object.assign({}, S), met: measure(M.E, M.C),
      st: 'prod', sold: 0, rev: 0, profit: 0, last: null, ly: yq() };
    G.models.push(m); G.spd = 0;
  });

  // Marché : classement des constructeurs
  await page.evaluate(() => __bea.setTab('marche')); await attendre(300);
  verifier(await page.$('.riv-l'), 'classement des concurrents absent de la page Marché');
  await verifierTextes(page, 'Marché'); await verifierPasDeDebordement(page, 'Marché');

  // Marketing : lancer une campagne
  await page.evaluate(() => __bea.setTab('marketing')); await attendre(300);
  const ch = await page.$('[data-mkch]');
  verifier(ch, 'aucun canal de publicité sur l\'écran Marketing');
  await ch.click(); await attendre(300);
  await verifierTextes(page, 'Marketing'); await verifierPasDeDebordement(page, 'Marketing');

  // Compétition : inscription puis course
  await page.evaluate(() => __bea.setTab('competition')); await attendre(300);
  await page.click('button[data-cp^="open:"]');
  await page.click('button[data-cp="go"]');
  verifier(await page.evaluate(() => Object.keys(G.comp.ent).length === 1), 'inscription à la course non enregistrée');
  let course = false, decisions = 0;
  for (let i = 0; i < 10 && !course; i++) {
    await page.evaluate(() => advance(1));
    const o = await page.$('[data-mkopt]');
    if (o && await o.isVisible()) { await o.click(); decisions++; }
    course = await page.evaluate(() => !LFX.hidden && !!document.querySelector('.rc'));
  }
  verifier(course, 'la course ne s\'est pas affichée');
  await page.click('.rc-skip'); await attendre(400);
  await page.click('.rc-close'); await attendre(300);
  verifier(await page.evaluate(() => G.comp.pal.length >= 1), 'palmarès vide après la course');
  await verifierTextes(page, 'Compétition'); await verifierPasDeDebordement(page, 'Compétition');

  // 10 ans de plus, en répondant aux décisions (trésorerie renflouée : on teste la mécanique, pas la gestion)
  await page.evaluate(() => { G.cash = 1e9; G.over = false; });
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => { advance(1); if (!LFX.hidden) closeLfx(); });
    const o = await page.$('[data-mkopt]');
    if (o && await o.isVisible()) { await o.click(); decisions++; }
  }
  const fini = await page.evaluate(() => isFinite(G.cash) && isFinite(G.rep) && isFinite(G.mk ? G.mk.aw ?? 0 : 0));
  verifier(fini, 'trésorerie, réputation ou notoriété non finie');
  verifier(await page.evaluate(() => G.y >= 1959), 'le temps n\'avance plus');
  const r = await page.evaluate(() => ({ y: G.y, riv: G.riv ? Object.keys(G.riv).length : 0, pal: G.comp.pal.length }));
  return `course jouée, ${decisions} décision(s), ${r.pal} résultat(s) au palmarès, jusqu'en ${r.y}`;
};

module.exports.titre = 'carrière : concurrents, marketing, compétition (course animée)';
module.exports.appareil = 'bureau';
