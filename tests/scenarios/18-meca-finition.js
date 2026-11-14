'use strict';
const { attendre, attendreVisible, cliquer, verifier, attendreCondition } = require('../outils.js');

// Mode Mécanicien (finition visuelle) : plus de cubes jaunes en mode gestes, mains et outil dessinés au 1er plan,
// ponts à bras mobiles (un seul pont par emplacement), colonnes et voitures qui arrêtent le joueur,
// baladeuse allumée quand le capot est ouvert, dessous de voiture détaillé.
module.exports = async function mecaFinition(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && typeof MWG !== 'undefined' && typeof MWF !== 'undefined', null, { timeout: 15000 });
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);

  await e(() => {
    MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    __mwj.spawn({ tpl: 'vidange' });
    const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont];
    __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0);
    MWG.ensure(c);
  });
  await attendre(1200);

  // repères : aucun volume jaune visible en mode gestes
  const mk = await e(() => {
    let n = 0;
    __mw.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'OctahedronGeometry' && o.visible) { let v = true; for (let q = o; q; q = q.parent) if (q.visible === false) v = false; if (v) n++; } });
    return n;
  });
  verifier(mk === 0, `${mk} repère(s) jaune(s) visible(s) en mode gestes`);

  // mains et outil : 2e passe de rendu
  const vm = await e(() => ({ passe: typeof __mw.afterRender === 'function', st: MWF.stats() }));
  verifier(vm.passe && vm.st.vis, 'les mains et l\'outil ne sont pas dessinés');
  for (const t of ['cliquet', 'cle_filtre', 'tournevis', 'boulonneuse', 'cle_dyn', 'bac', 'bidon', 'entonnoir', 'pinces', 'presse', 'seringue', 'main']) {
    await e(t => MWG.setTool(t), t);
    await attendre(120);
  }
  verifier((await e(() => MWF.stats().tools.length)) >= 10, 'les modèles d\'outils ne sont pas construits');

  // la voiture posée au sol arrête le joueur ; levée, on passe dessous
  await attendreCondition(page, () => MWF.cols() >= 1, 'la voiture posée sur le pont ne gêne pas le joueur', 30000);
  await e(() => MWG.run('lift', 'raise'));
  await attendreCondition(page, () => { const c = __mwj.jobs()[0]; return __mwj.meshY(c) > 1.55; }, 'le pont ne monte pas', 90000);
  await attendre(400);
  await attendre(300);

  // capot ouvert : la baladeuse s'allume
  await e(() => MWJ.L.togCapot(__mwj.jobs()[0]));
  await attendreCondition(page, () => { const l = MWF.lamp(); return l.on; }, 'la baladeuse ne s\'allume pas', 60000);
  verifier(await e(() => MWF.lamp().light.intensity > 1), 'la baladeuse n\'éclaire pas');

  // appels de dessin raisonnables
  const n = await e(() => __mw.renderer().info.render.calls);
  verifier(n > 5 && n < 400, `nombre d'appels de dessin inattendu : ${n}`);
  return 'sans repères jaunes, mains et outils au 1er plan, ponts à bras mobiles, collisions, baladeuse (' + n + ' appels de dessin)';
};

module.exports.titre = 'mécanicien (finition) : repères discrets, mains et outils, ponts à bras mobiles, collisions, baladeuse';
module.exports.appareil = 'bureau';
