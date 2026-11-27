'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien : (1) aucun client ne demande un travail au-dessus du niveau du joueur ;
// (2) l'encadré « Étapes » liste ce qu'il reste à faire près de la voiture et coche au fur et à mesure ;
// (3) pour une panne, il rappelle les indices puis affiche la réparation dès que la pièce en cause est identifiée.
module.exports = async function mecaNiveauxPlan(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && window.__mwplan && typeof MWG !== 'undefined', null, { timeout: 20000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);

  // 1. niveaux : 120 clients tirés au hasard avec seulement Entretien 2, Diagnostic 2 et Électricité 1
  const trop = await e(() => {
    MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mw.S.jobs.next = 1e12; __mw.S.jobs.stats.rendues = 10;
    for (const k of __mwj.SKILLS) __mw.S.xp[k] = 0;
    __mw.S.xp.entretien = 60; __mw.S.xp.diagnostic = 60;
    const lv = k => __mwj.level(k), P = __mwj.PARTS, mauvais = [];
    for (let i = 0; i < 120; i++) {
      __mwj.clear();
      const c = __mwj.spawn({ silencieux: true });
      if (!c) continue;
      const ids = c.ordre.concat(c.symp ? [c.symp.c] : []);
      for (const id of ids) if (P[id].niv > lv(P[id].comp)) mauvais.push(`${c.nom} : ${id} niv ${P[id].niv} (${P[id].comp} ${lv(P[id].comp)})`);
      if (c.symp && c.symp.dn > lv('diagnostic')) mauvais.push(`panne ${c.symp.txt} : diagnostic ${c.symp.dn}`);
    }
    __mwj.clear();
    return mauvais;
  });
  verifier(trop.length === 0, `travaux au-dessus du niveau : ${trop.slice(0, 5).join(' | ')}`);

  // 2. étapes d'un ordre de travaux (vidange) : affichées près de la voiture, cochées au fur et à mesure
  const pres = () => e(() => { const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); });
  await e(() => { for (const k of __mwj.SKILLS) __mw.S.xp[k] = 400; __mwj.spawn({ tpl: 'vidange', force: true, rend: false }); });
  await pres();
  const hud = () => e(() => { const h = document.querySelector('.mw-z[data-h="plan"]'); return h ? h.textContent : ''; });
  await attendreCondition(page, () => { const h = document.querySelector('.mw-z[data-h="plan"]'); return h && /Lever le pont/.test(h.textContent); }, "l'encadré des étapes n'apparaît pas près de la voiture", 10000);
  const avant = await e(() => __mwplan.steps(__mwj.jobs()[0]).filter(s => s.ok).length);
  await e(() => MWG.run('lift', 'raise'));
  await attendre(700);
  const apres = await e(() => __mwplan.steps(__mwj.jobs()[0]).filter(s => s.ok).length);
  verifier(apres === avant + 1, `l'étape « Lever le pont » n'est pas cochée (${avant} → ${apres})`);
  // replié par défaut (écran allégé : prochaine étape seulement), la touche I déplie la liste complète
  verifier(await e(() => __mwplan.replie()), "l'encadré des étapes devrait être replié par défaut");
  await page.keyboard.press('i');
  await attendreCondition(page, () => { const h = document.querySelector('.mw-z[data-h="plan"]'); return h && /Poser la pièce neuve/.test(h.textContent); }, "la touche I ne déplie pas la liste des étapes", 5000);
  verifier(/Déposer : .*huile/i.test(await hud()), "les étapes de la vidange ne citent pas l'huile");
  verifier(await e(() => !document.querySelector('.mw-z[data-h="job"]') || getComputedStyle(document.querySelector('.mw-z[data-h="job"]')).display === 'none'), "le bloc « Ordres en cours » devrait être masqué quand les étapes sont affichées");

  // 3. panne : indices d'abord, puis la réparation dès que la pièce en cause est identifiée
  await e(() => { __mwj.clear(); __mwj.spawn({ symp: 'feu', force: true, rend: false }); });
  await pres();
  await attendreCondition(page, () => { const h = document.querySelector('.mw-z[data-h="plan"]'); return h && /Diagnostic en cours/.test(h.textContent); }, "l'encadré ne montre pas le diagnostic en cours", 10000);
  verifier(await e(() => __mwplan.steps(__mwj.jobs()[0]).length === 0), 'les étapes ne doivent pas apparaître avant le diagnostic');
  await e(() => { const c = __mwj.jobs()[0]; c.insp[c.symp.c] = 1; });
  await attendreCondition(page, () => { const h = document.querySelector('.mw-z[data-h="plan"]'); return h && /en cause/.test(h.textContent) && /Poser la pièce neuve/.test(h.textContent); }, "les étapes de la réparation n'apparaissent pas après le diagnostic", 10000);
  await e(() => __mwj.clear());
  return '120 clients au niveau du joueur, étapes cochées (vidange), diagnostic puis étapes de réparation (panne)';
};
module.exports.titre = 'mécanicien : niveaux des travaux et étapes à l\'écran';
module.exports.appareil = 'bureau';
