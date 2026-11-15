'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (vidange) : l'huile s'écoule en jet dans le bac ouvert, le niveau monte, des ronds se forment à la surface,
// puis le filet se casse en gouttes qui continuent de tomber tant que le bouchon est retiré.
module.exports = async function mecaHuile(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined', null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => { MWG.set({ aide: 'off', classic: false }); MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; __mw.S.inv.length = 0;
    const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false }); for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'etagere' });
    const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); });
  await attendre(500);
  await e(() => MWG.run('lift', 'raise'));
  await attendreCondition(page, () => __mwj.meshY(__mwj.jobs()[0]) > 1.6, 'le pont ne monte pas', 60000);
  await e(() => { MWG.run('bac', 'bacon'); MWG.run('plug', 'pl1'); MWG.run('plug', 'pl0'); });
  // objets de l'écoulement : segments de jet (cylindres orientés), gouttes (sphères), ronds (tores) dans le groupe du sol
  const etat = () => e(() => { const R = MWG.rig(), o = { jet: 0, gouttes: 0, ronds: 0 };
    R.fl.traverse(m => { if (!m.isMesh || !m.visible) return; const t = m.geometry.type; if (t === 'CylinderGeometry' && m.geometry.parameters.radiusTop === 1) o.jet++; else if (t === 'SphereGeometry' && m.geometry.parameters.radius === 1) o.gouttes++; else if (t === 'TorusGeometry' && m.geometry.parameters.radius === 1) o.ronds++; });
    const c = __mwj.jobs()[0]; o.drain = c.g.o.drain; return o; });
  await attendreCondition(page, () => { const R = MWG.rig(); let n = 0; R.fl.traverse(m => { if (m.isMesh && m.visible && m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.radiusTop === 1) n++; }); return n >= 8; }, "le jet d'huile ne s'affiche pas", 8000);
  const a = await etat();
  await attendreCondition(page, () => { const R = MWG.rig(); let n = 0; R.fl.traverse(m => { if (m.isMesh && m.visible && m.geometry.type === 'TorusGeometry' && m.geometry.parameters.radius === 1) n++; }); return n >= 1; }, "aucun rond ne se forme à la surface de l'huile", 8000);
  // fin de vidange : plus de jet, des gouttes tant que le bouchon est retiré
  await e(() => MWG.skip());
  await attendre(300);
  verifier((await etat()).jet === 0, "le jet continue alors que le carter est vide");
  await attendreCondition(page, () => { const R = MWG.rig(); let n = 0; R.fl.traverse(m => { if (m.isMesh && m.visible && m.geometry.type === 'SphereGeometry' && m.geometry.parameters.radius === 1) n++; }); return n >= 1; }, "le bouchon retiré ne goutte pas", 12000);
  return `jet de ${a.jet} segments, ronds à la surface, gouttes en fin de vidange`;
};
module.exports.titre = "mécanicien : l'huile coule dans le bac (jet, ronds, gouttes)";
module.exports.appareil = 'bureau';
