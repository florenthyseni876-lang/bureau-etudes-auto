'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien : habitacle et portières (js/44h). Le filtre d'habitacle est joué avec de vraies touches (viser, maintenir E)
// depuis une position de joueur réaliste ; contrôles de lisibilité : portière qui pivote, carrosserie découpée seulement côté
// portière, trappe de la boîte à gants qui s'abaisse, ampoule et balai d'essuie-glace posés sur la pièce dessinée.
module.exports = async function mecaHabitacle(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined' && window.__mwcars, null, { timeout: 15000 });
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => { MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    MWG.set({ aide: 'on', classic: false, zoom: false }); // ce scénario teste le geste direct (maintenir E) : pas de vue rapprochée
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison', 'electricite']) __mw.S.xp[k] = 2000; });

  const accueillir = (tpl, mdl) => e(([tpl, mdl]) => {
    MWG.release(); __mwj.clear(); __mw.S.inv.length = 0;
    const c = __mwj.spawn({ noir: { zone: 'cour', mod: __mwcars.tuple(mdl), color: 0xe8c020, client: 'Test', taux: 1, prix: 0 }, tpl, silencieux: true, force: true });
    if (!c) return false;
    for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'achat', paye: 1 });
    const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0);
    MWG.ensure(c); return c.ordre.join('+'); }, [tpl, mdl]);
  // position de joueur : à 0,9 m de la cible, côté voulu (s = côté gauche de la voiture, -s = côté passager), yeux à 1,7 m
  const viser = (id, cote) => e(([id, cote]) => {
    const R = MWG.rig(), t = R.tg.find(q => q.id === id), v = new THREE.Vector3(), o = typeof t.o === 'function' ? t.o() : t.o;
    o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
    const p = R.p, s = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry)).multiplyScalar(cote);
    const x = v.x + s.x * .9, z = v.z + s.z * .9, dx = v.x - x, dz = v.z - z;
    __mw.teleport(x, z, Math.atan2(dx, dz), Math.atan2(v.y - 1.7, Math.hypot(dx, dz))); }, [id, cote]);
  const etat = () => e(() => { const R = MWG.rig(), H = R.hab, gl = R.g.children.find(m => m.isMesh && m.geometry === R.u.G.glass), pa = R.g.children.find(m => m.isMesh && m.geometry === R.u.G.paint);
    return { ouv: R.F.pdoor ? 1 : 0, ang: H.door.rotation.y, flap: H.flap.rotation.x, coupe: !!(pa.material.clippingPlanes && pa.material.clippingPlanes.length), vitreCoupee: !!(gl.material.clippingPlanes && gl.material.clippingPlanes.length),
      coupeActive: pa.material.clipIntersection === true, dm: H.door.children[0].visible, h: MWG.nextHint() && MWG.nextHint().id }; });

  const ordre = await accueillir('filtres', 'clio4');
  verifier(ordre, 'aucune voiture pour le filtre d\'habitacle');
  await attendre(600);
  // lisibilité : ancres de la carrosserie (optique avant, feu arrière, balai) et portière fermée
  const anc = await e(() => { const R = MWG.rig(), a = n => R.A(n); const g = R.u.G, hw = g.hw;
    return { head: a('headL').toArray(), tail: a('tailL').toArray(), wip: a('wiperD').toArray(), hw, W: R.u.W, fuel: a('fuelCap').toArray(), dz: g.doorZ, hz: g.handleZ }; });
  verifier(anc.head[0] > 0 && Math.abs(anc.head[0]) < anc.hw && anc.head[2] > 0, `optique avant mal placée : ${anc.head}`);
  verifier(anc.tail[2] < 0 && anc.tail[0] > 0, `feu arrière mal placé : ${anc.tail}`);
  verifier(Math.abs(anc.wip[0]) < anc.hw && anc.wip[1] > .7, `balai d'essuie-glace mal placé : ${anc.wip}`);
  verifier(anc.fuel[2] < 0 && anc.fuel[0] < 0, `trappe à carburant mal placée : ${anc.fuel}`);
  verifier(anc.dz[0] > anc.hz && anc.hz > anc.dz[1], `poignée hors de la portière : ${anc.dz} / ${anc.hz}`);
  let s = await etat();
  verifier(!s.coupe && !s.dm && Math.abs(s.ang) < .01, 'portière fermée : la carrosserie ne devrait pas être découpée');

  // 1. vraie interaction : viser la portière passager, maintenir E (la portière s'ouvre)
  await e(() => MWG.setTool('main'));
  let log = [];
  for (let n = 0; n < 30; n++) {
    const h = await e(() => MWG.nextHint());
    if (!h || h.key === 'door') break;
    const reel = h.id === 'pdoor' || /filtre_hab/.test(h.id) || /^(pt|fx):filtre_hab/.test(h.id);
    if (!reel) { const r = await e(([h]) => MWG.run(h.id, h.key), [h]); verifier(!r, `étape refusée « ${h.lab} » : ${r}`); log.push(h.key); await attendre(120); continue; }
    await e(([h]) => { if (h.tool) MWG.setTool(h.tool, h.sock); }, [h]);
    await viser(h.id, h.id === 'pdoor' || h.id.startsWith('fx:') || h.id.startsWith('pt:') ? -1 : 1);
    await attendre(150);
    await attendreCondition(page, ([id, key]) => { const A = MWG.aim(); return A && A.t.id === id && A.a.key === key; }, 'cible non visée', 8000, [h.id, h.key])
      .catch(async () => { const d = await e(() => MWG.aimDbg().slice(0, 3)); throw new Error(`« ${h.lab} » (${h.id}) n'est pas visée depuis la position du joueur : ${JSON.stringify(d)}`); });
    await page.keyboard.down('e');
    await attendreCondition(page, ([id, key]) => { const hh = MWG.nextHint(); return !hh || hh.id !== id || hh.key !== key; }, `maintenir E ne termine pas « ${h.lab} »`, 30000, [h.id, h.key]);
    await page.keyboard.up('e');
    log.push(h.key);
    if (h.id === 'pdoor' && h.key === 'pdo') {
      await attendre(1200); s = await etat();
      for (let i = 0; i < 20 && s.ang <= 1; i++) { await attendre(400); s = await etat(); }   /* machine lente : la portière finit de s'ouvrir */
      verifier(s.ang > 1 && s.dm, `la portière ne pivote pas (angle ${s.ang})`);
      verifier(s.coupe && s.vitreCoupee && s.coupeActive, 'la carrosserie n\'est pas découpée côté portière');
      const cote = await e(() => { const R = MWG.rig(), H = R.hab, a = new THREE.Vector3(); H.door.getWorldPosition(a); const b = new THREE.Vector3(); R.g.getWorldPosition(b);
        return { ang: H.door.rotation.y, gv: R.g.children.find(m => m.isMesh && m.geometry === R.u.G.glass).material.clippingPlanes.length }; });
      verifier(cote.gv === 6, 'plans de coupe attendus : 6');
    }
  }
  await attendre(1500); s = await etat();
  for (let i = 0; i < 20 && (s.ouv || s.coupe || Math.abs(s.ang) >= .05); i++) { await attendre(500); s = await etat(); }   /* machine lente : la portière finit de se refermer */
  const fin = await e(() => { const c = __mwj.jobs()[0]; return { done: Object.keys(c.done).join('+'), bl: MWG.blocage(c).join(', ') }; });
  verifier(/filtre_hab/.test(fin.done), `le filtre d'habitacle n'a pas été changé : ${fin.done} (${log.join(' ')})`);
  verifier(!s.ouv && Math.abs(s.ang) < .05 && !s.coupe, `la portière est restée ouverte ou la coupe active (${JSON.stringify(s)})`);
  verifier(Math.abs(s.flap) < .05, 'la trappe de la boîte à gants est restée ouverte');
  verifier(log.some(k => /^fo/.test(k)) && log.includes('pdc'), `gestes attendus absents : ${log.join(' ')}`);

  // 2. la trappe s'abaisse quand les butées sont libérées (reprise du travail, mode direct)
  await e(() => { MWG.release(); __mwj.clear(); __mw.S.inv.length = 0; });
  await accueillir('filtres', 'p208'); await attendre(600);
  await e(() => { MWG.run('pdoor', 'pdo'); }); await attendre(1200);
  await e(() => { for (let i = 0; i < 2; i++) MWG.run('fx:filtre_hab:' + i); }); await attendre(1500);
  s = await etat();
  for (let i = 0; i < 20 && s.flap >= -1; i++) { await attendre(400); s = await etat(); }   /* machine lente : la trappe finit de s'abaisser */
  verifier(s.flap < -1, `la trappe ne s'abaisse pas (angle ${s.flap})`);

  // 3. ampoule et essuie-glace : cibles posées sur la pièce dessinée et visables depuis le sol
  for (const [tpl, id] of [['ampoule', 'pt:ampoules:0'], ['essuie', 'pt:essuie:0']]) {
    await e(() => { MWG.release(); __mwj.clear(); __mw.S.inv.length = 0; });
    const o = await accueillir(tpl, 'bmw320d'); verifier(o, 'aucune voiture pour ' + tpl);
    await attendre(500);
    const pos = await e((id) => { const R = MWG.rig(), t = R.tg.find(q => q.id === id); if (!t) return null; const v = new THREE.Vector3(); (t.o).getWorldPosition(v); const l = R.g.worldToLocal(v); return l.toArray(); }, id);
    verifier(pos, `cible introuvable : ${id}`);
    if (tpl === 'ampoule') verifier(pos[0] > .3 && pos[2] > 1 && pos[1] > .4 && pos[1] < 1, `l'ampoule n'est pas sur l'optique avant : ${pos}`);
    else verifier(Math.abs(pos[0]) < 1 && pos[1] > .8 && pos[2] > -.5, `le balai n'est pas sur le pare-brise : ${pos}`);
    await viser(id, 1); await attendre(200);
    const aim = await e(() => { const A = MWG.aim(); return A ? A.t.id : null; });
    verifier(aim, `${id} ne se vise pas depuis une position de joueur`);
  }
  return 'filtre d\'habitacle joué au clavier (' + log.join(' ') + ')';
};
module.exports.titre = 'mécanicien : habitacle, portière qui pivote, boîte à gants, ampoule, balai';
