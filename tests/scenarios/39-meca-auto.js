'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes } = require('../outils.js');

// Mode Mécanicien (travail automatique) : touche J près de la voiture, le mécanicien fait les gestes tout seul,
// pièces prises à l'étagère (salarié) ou achetées (à son compte), panne diagnostiquée, expérience divisée par deux,
// option « rendre la voiture » à la fin.
module.exports = async function mecaAuto(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && window.__mwauto && typeof MWG !== 'undefined', null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  const pres = () => e(() => { const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); });
  // 1. salarié : vidange automatique, déclenchée par la touche J, sans pièce ni outil en poche
  await e(() => { MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; __mw.S.inv.length = 0; __mwj.spawn({ tpl: 'vidange', force: true, rend: false }); });
  await pres(); await attendre(600);
  await page.keyboard.press('j');
  await attendreVisible(page, '.mw-pn [data-mw="auto:go"]', 'la touche J n\'ouvre pas le travail automatique');
  await verifierTextes(page, 'travail automatique');
  const m0 = await e(() => __mw.S.money);
  await cliquer(page, '.mw-pn [data-mw="auto:go"]');
  await attendreCondition(page, () => !__mwauto.busy(), 'le travail automatique ne se termine pas', 120000);
  const v = await e(() => { const c = __mwj.jobs()[0]; return { done: Object.keys(c.done).sort().join(','), bl: MWG.blocage(c), auto: c.auto, m: __mw.S.money }; });
  verifier(v.done === 'filtre_huile,huile' && v.bl.length === 0 && v.auto === 1, `vidange automatique incomplète (${JSON.stringify(v)})`);
  verifier(v.m === m0, "le salarié ne doit rien payer : les pièces viennent de l'étagère");
  // expérience divisée par deux par rapport au même travail fait à la main
  const xp = await e(() => { const c = __mwj.jobs()[0]; const a = __mwj.evalJob(c).comp; c.auto = 0; const b = __mwj.evalJob(c).comp; c.auto = 1; const s = o => Object.values(o).reduce((x, y) => x + y, 0); return [s(a), s(b)]; });
  verifier(xp[0] > 0 && xp[0] <= Math.ceil(xp[1] / 2) + 1, `l'expérience n'est pas divisée par deux (${xp})`);
  // 2. à son compte : une panne, pièces achetées, diagnostic, voiture rendue
  await e(() => { __mwj.clear(); MWC.hire('patron'); __mw.S.money = 5000; __mw.S.inv.length = 0; __mwj.spawn({ symp: 'feu', force: true, rend: false }); });
  await pres(); await attendre(600);
  const r0 = await e(() => ({ m: __mw.S.money, n: __mw.S.jobs.stats.rendues }));
  await e(() => __mwauto.start(true));
  await attendreCondition(page, () => !__mwauto.busy(), 'le travail automatique (panne) ne se termine pas', 120000);
  const r1 = await e(() => ({ m: __mw.S.money, n: __mw.S.jobs.stats.rendues, cars: __mwj.jobs().length }));
  verifier(r1.n === r0.n + 1 && r1.cars === 0, `la voiture n'est pas rendue automatiquement (${JSON.stringify(r1)})`);
  return `vidange en gestes automatiques (salarié), panne diagnostiquée et voiture rendue à son compte (${Math.round(r1.m - r0.m)} € net)`;
};
module.exports.titre = 'mécanicien : travail automatique (touche J)';
module.exports.appareil = 'bureau';
