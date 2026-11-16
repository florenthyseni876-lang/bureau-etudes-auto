'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes, verifierPasDeDebordement } = require('../outils.js');

// Mode Mécanicien (administrateur) : depuis le menu, argent illimité et niveaux au maximum ; faire venir une panne,
// prendre les pièces, finir les gestes automatiquement ; filtre d'habitacle par la portière passager (vue « écorché »).
module.exports = async function mecaAdmin(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && window.__mwadm && typeof MWG !== 'undefined', null, { timeout: 15000 });
  await attendre(500);
  const e = (f, a) => page.evaluate(f, a);
  // menu → mode administrateur → activer
  await page.keyboard.press('Escape');
  await attendreVisible(page, '.mw-pn [data-mw="admin"]', "le menu ne propose pas le mode administrateur");
  await cliquer(page, '.mw-pn [data-mw="admin"]');
  await cliquer(page, '.mw-pn [data-mw="adm:on"]', "le bouton d'activation est absent");
  const a = await e(() => ({ m: __mw.S.money, lv: __mwj.SKILLS.map(k => __mwj.level(k)), rep: __mw.S.rep, dyn: __mw.S.jobs.outils.cle_dyn, dipl: Object.keys(MWC.state().dipl).length }));
  verifier(a.m >= 9e6 && a.lv.every(l => l === 10) && a.rep === 100 && a.dyn === 1 && a.dipl >= 2, `le mode administrateur ne donne pas tout (${JSON.stringify(a)})`);
  await verifierTextes(page, 'mode administrateur'); await verifierPasDeDebordement(page, 'mode administrateur');
  // argent illimité : une grosse dépense est aussitôt compensée
  await e(() => __mw.money(-8e6, 'test'));
  await attendreCondition(page, () => __mw.S.money >= 9e6, "l'argent n'est pas illimité", 5000);
  // faire venir les filtres et finir les gestes automatiquement (portière passager, boîte à gants)
  await e(() => { const s = document.getElementById('admTpl'); s.value = 'filtres'; });
  await cliquer(page, '.mw-pn [data-mw="adm:tpl"]');
  await e(() => { __mw.S.min = 600; });
  await cliquer(page, '.mw-pn [data-mw="adm:parts"]');
  await e(() => { const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont]; __mw.closePanel(); __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); __mwadm.finish(); });
  const f = await e(() => { const c = __mwj.jobs()[0]; return { done: Object.keys(c.done).sort().join(','), bl: MWG.blocage(c) }; });
  verifier(f.done === 'filtre_air,filtre_hab' && f.bl.length === 0, `les gestes automatiques ne finissent pas les filtres (${JSON.stringify(f)})`);
  // une panne au hasard parmi la liste du panneau
  await e(() => { __mwj.clear(); MWADM.open(); const s = document.getElementById('admSym'); s.selectedIndex = Math.floor(Math.random() * s.options.length); });
  await cliquer(page, '.mw-pn [data-mw="adm:sym"]');
  verifier(await e(() => __mwj.jobs().length === 1 && !!__mwj.jobs()[0].symp), "la panne choisie n'arrive pas");
  return `argent ${Math.round(a.m)} €, compétences au niveau 10, filtres finis par la portière passager, panne de test`;
};
module.exports.titre = 'mécanicien : mode administrateur (argent illimité, niveaux, panneau de test) et filtre d\'habitacle';
module.exports.appareil = 'bureau';
