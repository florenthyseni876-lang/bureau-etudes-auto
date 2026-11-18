'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (écrous de roue) : chacun des écrous des 4 roues se vise depuis plusieurs positions et distances, voiture au sol
// (écrous serrés) puis pont levé (écrous desserrés) ; la cible visée est bien l'écrou regardé, jamais un voisin.
module.exports = async function mecaEcrous(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot');
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined');
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => { MWG.set({ aide: 'on', classic: false }); MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mw.S.jobs.next = 1e12;
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison']) __mw.S.xp[k] = 2000; __mw.S.jobs.outils.cle_dyn = 1; });
  const bilan = [];
  for (const modele of (process.env.CARS || 'clio4,bmw320d').split(',')) {
    await e((modele) => { MWG.release && MWG.release(); __mwj.clear(); __mw.S.inv.length = 0;
      const M = __mwj.noirData.MODELS.garage1; M.length = 0; M.push(MWCARS.tuple(modele));
      const c = __mwj.spawn({ travaux: ['pneus'], force: true, rend: false });
      for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'achat', paye: 1 });
      const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); }, modele);
    await attendre(400);
    const viser = async (etat) => {
      const bad = []; let n = 0;
      const ids = await e(() => MWG.rig().tg.filter(t => /^nut:/.test(t.id)).map(t => t.id));
      for (const id of ids) {
        const cote = id.split(':')[1][1] === 'L' ? 1 : -1;
        for (const [d, mode, crouch] of [[.5, 's', 0], [.8, 's', 0], [1.2, 's', 0], [1.8, 's', 0], [.8, 'f', 0], [.8, 'b', 0], [.8, 's', 1], [1.2, 'f', 1]]) {
          const vis = await e(([id, d, mode, cote, crouch]) => {
            const R = MWG.rig(), t = R.tg.find(q => q.id === id), v = new THREE.Vector3(), o = t.o;
            o.updateWorldMatrix(true, false); o.getWorldPosition(v);
            const p = R.p, s = new THREE.Vector3(Math.cos(p.ry) * cote, 0, -Math.sin(p.ry) * cote), f = new THREE.Vector3(Math.sin(p.ry), 0, Math.cos(p.ry));
            const dir = mode === 's' ? s : s.clone().add(f.clone().multiplyScalar(mode === 'f' ? 1 : -1)).normalize();
            const eye = crouch ? 1.08 : 1.7; MWF.crouch(!!crouch); __mw.eyeY = crouch ? 1.08 : 0;
            const x = v.x + dir.x * d, z = v.z + dir.z * d, dx = v.x - x, dz = v.z - z;
            __mw.teleport(x, z, Math.atan2(dx, dz), Math.atan2(v.y - eye, Math.hypot(dx, dz)));
            return null; }, [id, d, mode, cote, crouch]);
          await attendre(70);
          const A = await e(() => { const a = MWG.aim(); return a ? a.t.id : null; });
          n++;
          if (A !== id) bad.push(`${id} @${d} ${mode}${crouch ? ' accroupi' : ''} → ${A}`);
        }
      }
      verifier(!bad.length, `${modele} ${etat} : ${bad.length}/${n} visées ratées : ${bad.slice(0, 8).join(' ; ')}`);
      return n;
    };
    await e(() => MWG.setTool('boulonneuse', 17));
    const n1 = await viser('au sol, écrous serrés');
    await e(() => { const R = MWG.rig(); for (const t of R.tg.filter(t => /^nut:/.test(t.id))) { const a = MWG.acts(__mwj.jobs()[0]).find(x => x.id === t.id && /^nl/.test(x.key)); if (a) MWG.run(t.id, a.key); } MWG.run('lift', 'raise'); });
    for (let w = 0, y0 = -1; w < 40; w++) { const y = await e(() => __mwj.meshY(__mwj.jobs()[0])); if (Math.abs(y - y0) < .002) break; y0 = y; await attendre(120); }
    const n2 = await viser('pont levé, écrous desserrés');
    // l'écrou en surbrillance de l'aide doit se viser du premier coup
    const h = await e(() => { const x = MWG.nextHint(); return x && /^nut:/.test(x.id) ? x : null; });
    if (h) {
      await e(() => { MWF.crouch(false); __mw.eyeY = 0; }); await attendre(2500);
      await e((id) => { const R = MWG.rig(), t = R.tg.find(q => q.id === id), v = new THREE.Vector3(); t.o.getWorldPosition(v); const p = R.p, cote = id.split(':')[1][1] === 'L' ? 1 : -1;
        __mw.teleport(v.x + Math.cos(p.ry) * cote, v.z - Math.sin(p.ry) * cote, Math.atan2(-Math.cos(p.ry) * cote, Math.sin(p.ry) * cote), Math.atan2(v.y - __mw.cam.position.y, 1)); }, h.id);
      await attendre(120);
      const A = await e(() => { const a = MWG.aim(); return a ? a.t.id : null; });
      const dbg = A === h.id ? '' : await e(() => { const v = new THREE.Vector3(); return JSON.stringify({ cam: __mw.cam.position.toArray().map(x => +x.toFixed(2)), top: MWG.aimDbg().map(x => x.id + ':' + x.sc + ':' + x.d + ':' + x.acts.join('/')).slice(0, 6), pl: __mw.player() }); });
      verifier(A === h.id, `${modele} : l'écrou en surbrillance de l'aide (${h.id}) n'est pas celui qu'on vise (${A}) ${dbg}`);
    }
    bilan.push(`${modele} (${n1 + n2} visées)`);
  }
  return 'chaque écrou se vise : ' + bilan.join(', ');
};
module.exports.titre = 'mécanicien : chaque écrou des 4 roues se vise, au sol et pont levé';
module.exports.appareil = 'bureau';
