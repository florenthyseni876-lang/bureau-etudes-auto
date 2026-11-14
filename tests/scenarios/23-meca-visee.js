'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (visée) : chaque étape proposée par l'aide doit pouvoir être visée par un joueur (cible au bon endroit,
// visible ou du moins visable, pas masquée par une cible voisine), du début à la fin de l'intervention.
module.exports = async function mecaVisee(page, env) {
  const bilan = [];
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot');
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined');
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => { MWG.set({ aide: 'on', classic: false }); MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mw.S.jobs.next = 1e12;
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison', 'electricite', 'transmission']) __mw.S.xp[k] = 2000; __mw.S.jobs.outils.cle_dyn = 1; });
  const out = [];
  for (const tpl of (process.env.AUDIT || 'vidange,batterie,embr').split(',')) {
    const ok = await e((tpl) => { MWG.release && MWG.release(); __mwj.clear(); __mw.S.inv.length = 0; const c = __mwj.spawn(tpl.startsWith('t:') ? { travaux: [tpl.slice(2)], force: true, rend: false } : { tpl, force: true, rend: false }); if (!c) return false;
      for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'achat', paye: 1 }); const p = __mw.zone(c.zone).ponts[c.pont];
      __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); return c.ordre.join('+'); }, tpl);
    verifier(ok, `aucune voiture pour « ${tpl} »`);
    await attendre(500);
    const bad = []; let n = 0, last = '', same = 0;
    for (; n < 160; n++) {
      const h = await e(() => { MWG.skip(); return MWG.nextHint(); });
      if (!h || h.key === 'door') break;
      if (h.key === last) { if (++same > 3) { bad.push('BOUCLE ' + h.key); break; } } else same = 0; last = h.key;
      // attendre que le pont ait fini de bouger (un joueur attend)
      for (let w = 0, y0 = -1; w < 40; w++) { const y = await e(() => __mwj.meshY(__mwj.jobs()[0])); if (Math.abs(y - y0) < .002) break; y0 = y; await attendre(120); }
      // viser la cible depuis plusieurs positions de joueur
      let vis = null;
      for (const [d, mode] of [[.45, 's'], [1.0, 's'], [1.0, 'f'], [.9, 'b'], [1.0, '-s'], [.3, 's']]) {
        await e(([h, d, mode]) => {
          const R = MWG.rig(), t = R.tg.find(q => q.id === h.id), v = new THREE.Vector3(), o = typeof t.o === 'function' ? t.o() : t.o;
          o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
          const p = R.p, s = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry)), f = new THREE.Vector3(Math.sin(p.ry), 0, Math.cos(p.ry));
          const dir = mode === 's' ? s : mode === '-s' ? s.clone().multiplyScalar(-1) : mode === 'f' ? f : f.clone().multiplyScalar(-1);
          const x = v.x + dir.x * d, z = v.z + dir.z * d, dx = v.x - x, dz = v.z - z;
          __mw.teleport(x, z, Math.atan2(dx, dz), Math.atan2(v.y - __mw.cam.position.y, Math.hypot(dx, dz)));
        }, [h, d, mode]);
        await attendre(90);
        await e(([h]) => { if (h.tool) MWG.setTool(h.tool); }, [h]);
        await attendre(60);
        vis = await e(([h]) => { const A = MWG.aim(); return A ? A.t.id + ':' + A.a.key : null; }, [h]);
        if (vis === h.id + ':' + h.key) break;
      }
      const loc = await e((h) => { const R = MWG.rig(), t = R.tg.find(q => q.id === h.id), o = typeof t.o === 'function' ? t.o() : t.o, v = new THREE.Vector3(); o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v); const l = R.g.worldToLocal(v.clone()); return [l.x, l.y, l.z]; }, h);
      if (Math.abs(loc[0]) < .06 && Math.abs(loc[2]) < .06 && loc[1] < .12 && h.id !== 'bac') bad.push(`MAL PLACÉ ${h.key} « ${h.lab} » (${h.id}) : centre de la voiture au sol`);
      if (vis !== h.id + ':' + h.key) { await attendre(1500); const dbg = await e((h) => { const R = MWG.rig(), t = R.tg.find(q => q.id === h.id), o = typeof t.o === 'function' ? t.o() : t.o, v = new THREE.Vector3(); o.getWorldPosition(v); const l = R.g.worldToLocal(v.clone()); return JSON.stringify({ local: [l.x, l.y, l.z].map(x => +x.toFixed(2)), cam: [__mw.cam.position.x, __mw.cam.position.y, __mw.cam.position.z].map(x => +x.toFixed(2)), world: [v.x, v.y, v.z].map(x => +x.toFixed(2)), L: R.u.L, top: MWG.aimDbg().slice(0, 2) }); }, h); bad.push(`${h.key} « ${h.lab} » (${h.id}) visé=${vis} | ${dbg}`); }
      const r = await e(([h]) => MWG.run(h.id, h.key), [h]);
      if (r) { bad.push('REFUS ' + h.key + ' : ' + r); break; }
      await attendre(30);
    }
    const fin = await e(() => { const c = __mwj.jobs()[0]; return { done: Object.keys(c.done).join('+'), bl: MWG.blocage(c).join(', ') }; });
    verifier(!bad.length && !fin.bl && fin.done, `${tpl} : étapes impossibles à viser pour un joueur :\n   ${bad.join('\n   ')}${fin.bl ? '\n   blocage : ' + fin.bl : ''}`);
    bilan.push(`${tpl} (${n} gestes)`);
  }
  return 'tout est visable : ' + bilan.join(', ');
};
module.exports.titre = 'mécanicien : chaque geste de l\'aide peut être visé par un joueur';
module.exports.appareil = 'bureau';
