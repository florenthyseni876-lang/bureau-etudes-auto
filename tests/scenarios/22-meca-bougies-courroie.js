'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes } = require('../outils.js');

// Mode Mécanicien : gestes détaillés des bougies (essence : bobine crayon, écartement, couple ; diesel : préchauffage)
// et de la courroie d'accessoires (schéma, tendeur, goupille, galets, alignement) ; menu : sauvegarder et revenir à l'accueil.
module.exports = async function mecaBougiesCourroie(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && typeof MWG !== 'undefined' && window.__mwcars, null, { timeout: 15000 });
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => {
    MWG.set({ classic: false, aide: 'on' }); MWC.hire('patron');
    __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison', 'electricite']) __mw.S.xp[k] = 900;
    __mw.S.jobs.outils.cle_dyn = 1;
  });
  const accueillir = async (tpl, carb, part) => {
    for (let i = 0; i < 60; i++) {
      const r = await e(([tpl, carb, part]) => {
        __mwj.clear(); __mw.S.inv.length = 0; __mwj.spawn({ tpl, force: true, rend: false });
        const c = __mwj.jobs()[0];
        if (!c || !c.parts[part] || c.parts[part].na) return false;
        const f = c.mdl ? __mwcars.get(c.mdl).eng.fuel : null;
        if (carb && f !== carb) return false;
        for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'achat', paye: 1 });
        return true;
      }, [tpl, carb, part]);
      if (r) return;
    }
    throw new Error('aucune voiture ' + carb + ' pour ' + tpl);
  };
  const pres = () => e(() => {
    const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont];
    const x = p.x + Math.cos(p.ry) * 1.6, z = p.z - Math.sin(p.ry) * 1.6;
    __mw.teleport(x, z, Math.atan2(p.x - x, p.z - z), .1); MWG.ensure(c);
  });
  const travail = async () => {
    const log = [];
    for (let n = 0; n < 200; n++) {
      const h = await e(() => { MWG.skip(); return MWG.nextHint(); });
      if (!h || h.key === 'door') break;
      const r = await e(([h]) => MWG.run(h.id, h.key), [h]);
      log.push(h.key);
      verifier(!r, `étape refusée « ${h.lab} » : ${r}`);
      await pres();
    }
    return log;
  };
  const bilan = (id) => e(id => { const c = __mwj.jobs()[0]; return { done: !!c.done[id], blocage: MWG.blocage(c), capot: c.st.capot, cyl: c.g.bp ? c.g.bp.st.length : 0, bin: Object.keys(c.g.bin || {}).length }; }, id);

  // 1. bougies d'allumage (essence) : bobine, écartement contrôlé, couple, remontage complet
  await accueillir('bougies', 'essence', 'bougies'); await pres();
  const l1 = await travail(), b1 = await bilan('bougies');
  verifier(b1.done && b1.blocage.length === 0 && b1.bin === 0, `bougies essence incomplètes : ${JSON.stringify(b1)} ${l1.join(' ')}`);
  verifier(l1.filter(k => /^bpg/.test(k)).length >= 1 && l1.filter(k => /^bp\d+_8$/.test(k)).length === b1.cyl, `gestes de bougie manquants (écartement, connecteurs) : ${l1.join(' ')}`);
  const i0 = l1.indexOf('bp0_0'), i3 = l1.indexOf('bp0_3'), i5 = l1.indexOf('bp0_5');
  verifier(i0 >= 0 && i0 < i3 && i3 < i5, `ordre des gestes de bougie anormal : ${l1.join(' ')}`);

  // 2. bougies de préchauffage (diesel) : cosse, bougie dévissée doucement, couple
  await e(() => MWG.release());
  await accueillir('bougies', 'diesel', 'bougies'); await pres();
  const l2 = await travail(), b2 = await bilan('bougies');
  verifier(b2.done && b2.blocage.length === 0 && b2.bin === 0, `bougies diesel incomplètes : ${JSON.stringify(b2)} ${l2.join(' ')}`);
  verifier(!l2.some(k => /^bpg/.test(k)) && l2.filter(k => /^bp\d+_6$/.test(k)).length === b2.cyl, `gestes de préchauffage anormaux : ${l2.join(' ')}`);

  // 3. courroie d'accessoires : schéma, tendeur, goupille, galets, passage, alignement
  await e(() => MWG.release());
  await accueillir('cr_acc', null, 'courroie_acc'); await pres();
  const sans = await e(() => MWG.acts(__mwj.jobs()[0]).find(a => a.key === 'cr1'));
  const l3 = await travail(), b3 = await bilan('courroie_acc');
  verifier(b3.done && b3.blocage.length === 0, `courroie incomplète : ${JSON.stringify(b3)} ${l3.join(' ')}`);
  const seq = ['crs', 'cr1', 'cr2', 'cr3', 'cr4', 'cr5', 'cr6', 'cr7'];
  let k = -1;
  for (const s of seq) { const i = l3.indexOf(s); verifier(i > k, `ordre des gestes de courroie anormal (${s}) : ${l3.join(' ')}`); k = i; }
  verifier(!sans || !!sans.why || l3[0] !== 'cr1', 'le tendeur se détend sans avoir repéré le passage de la courroie');

  // 4. menu : sauvegarder (confirmation dans le menu) et revenir à l'accueil
  await e(() => MWG.release());
  await cliquer(page, '#mwRoot [data-b="menu"]', 'bouton « Menu » absent');
  await attendreVisible(page, '.mw-pn [data-mw="save"]', 'le menu ne propose pas de sauvegarder');
  verifier(await e(() => !!document.querySelector('.mw-pn [data-mw="quit"]') && /accueil/i.test(document.querySelector('.mw-pn [data-mw="quit"]').textContent)), "le menu ne propose pas de revenir à l'accueil");
  await e(() => localStorage.removeItem('bea.meca.v1'));
  await cliquer(page, '.mw-pn [data-mw="save"]');
  await attendreCondition(page, () => !!document.querySelector('.mw-pn .mw-ok') && !!localStorage.getItem('bea.meca.v1'), "la sauvegarde n'est pas confirmée dans le menu", 8000);
  await verifierTextes(page, 'menu du mécanicien');
  await cliquer(page, '.mw-pn [data-mw="quit"]');
  await attendreCondition(page, () => { const r = document.getElementById('mwRoot'), h = document.getElementById('hMeca'); return (!r || r.hidden || getComputedStyle(r).display === 'none') && h && h.offsetParent !== null; }, "le menu ne revient pas à l'accueil", 10000);
  verifier(/Reprendre votre partie/.test(await e(() => document.getElementById('hMecaSub').textContent)), "l'accueil ne propose pas de reprendre la partie sauvegardée");
  return `bougies essence (${b1.cyl} cylindres) et diesel (${b2.cyl}), courroie en ${l3.length} gestes, menu : sauvegarde et accueil`;
};

module.exports.titre = 'mécanicien : gestes des bougies et de la courroie, menu (sauvegarde, accueil)';
module.exports.appareil = 'bureau';
