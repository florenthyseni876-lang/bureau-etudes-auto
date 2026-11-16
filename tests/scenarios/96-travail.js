'use strict';
const J = require('../joueur.js');
// Joue un type de travail (TPL=vidange,freins,…) de bout en bout comme un joueur suivant l'aide.
module.exports = async function (page, env) {
  const { ev, prompt, photo, attendre } = J;
  await J.ouvrir(page, env);
  await J.espionner(page);
  const tpls = (process.env.TPL || 'vidange').split(',');
  await ev(page, xp => { MWC.hire('meca'); __mw.S.flags.coinVu = true; __mw.S.min = 590; __mw.S.jobs.next = 1e12; for (const k of __mwj.SKILLS) __mw.S.xp[k] = xp; }, +(process.env.XP || 0) || 0);
  for (const tpl of tpls) {
    console.log('=== ', tpl);
    const ok = await ev(page, tpl => { __mwj.clear(); const c = __mwj.spawn(tpl.startsWith('t:') ? { travaux: [tpl.slice(2)], force: true } : { tpl, force: true }); if (!c) return false; const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + 2.2, p.z, -Math.PI / 2, 0); MWG.ensure(c); return c.ordre.join('+') + ' | ' + c.client + ' | ' + (c.symp ? 'SYMPTOME' : ''); }, tpl);
    console.log('job:', ok);
    if (!ok) continue;
    await attendre(500);
    const e1 = await J.etagerePrendre(page);
    console.log('étagère:', JSON.stringify(e1));
    const t = await J.travailler(page);
    console.log(t.log.join('\n'));
    console.log(t.ok ? 'JUSQU\'À L\'HABITACLE' : 'BLOCAGE : ' + t.blocage);
    if (!t.ok) console.log('état:', await ev(page, () => { const c = __mwj.jobs()[0]; return JSON.stringify({ ordre: c.ordre, done: c.done, rem: c.rem, hint: MWG.nextHint(), bl: MWG.blocage(c), st: c.st }); }));
    await photo(page, '50-' + tpl.replace(/[^a-z]/gi, '') + '-fin');
    if (t.ok) {
      console.log('habitacle:', (await J.panneau(page) || '').replace(/\n/g, ' / ').slice(0, 300));
      await J.ficheAction(page, 'rendre').catch(() => console.log('  !! pas de bouton rendre'));
      await attendre(600);
      await photo(page, '51-' + tpl.replace(/[^a-z]/gi, '') + '-facture');
      console.log('facture:', (await J.panneau(page) || '').replace(/\n/g, ' / ').slice(0, 700));
      console.log('toasts:', (await J.toasts(page)).join(' | ').slice(0, 400));
      await page.keyboard.press('Escape'); await attendre(300);
    }
    console.log('argent', await ev(page, () => Math.round(__mw.S.money)));
  }
};
module.exports.titre = 'travail'; module.exports.appareil = 'bureau';
