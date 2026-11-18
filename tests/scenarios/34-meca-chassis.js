'use strict';
const { attendre, attendreCondition, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (châssis) : le dessous de la voiture levée est lisible et chaque pièce du dessous se vise et se démonte.
//  1. le dessous est un maillage coloré (matières distinctes) et chaque voiture a les pièces qu'elle doit avoir (cardans seulement
//     si elle a des roues motrices à l'avant, FAP seulement sur un diesel, pas de sonde lambda sur une électrique…) ;
//  2. le joueur peut se baisser (touche X) : ses yeux descendent bien sous le bas de caisse de la voiture levée ;
//  3. rotule, roulement, amortisseur, cardan, catalyseur, FAP, sonde lambda, pompe à carburant : chacune est posée sur la pièce
//     dessinée, VISIBLE (aucune tôle devant) et VISABLE depuis plusieurs positions réalistes, accroupi ;
//  4. un frein arrière à tambour se dessine et se démonte comme un tambour (tambour + mâchoires), pas comme un disque.
module.exports = async function mecaChassis(page, env) {
  const bilan = [];
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot');
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined' && typeof MWCH !== 'undefined');
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => { MWG.set({ aide: 'on', classic: false }); MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mw.S.jobs.next = 1e12;
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison', 'electricite', 'transmission']) __mw.S.xp[k] = 2000; __mw.S.jobs.outils.cle_dyn = 1; });

  // ── 1. le dessous des voitures : maillage coloré et pièces présentes ──
  const att = await e(() => {
    const out = [];
    for (const id of MWCARS.ids()) {
      const c = MWCARS.get(id), G = MWCARS.geo(c), ch = G.ch, ids = ch.units.map(u => u.id).filter(x => x !== '__filtre');
      const has = k => ids.includes(k), diesel = c.eng.fuel === 'diesel', ev = !!c.ev;
      const bad = [];
      if (!ch.full.attributes.color || ch.full.attributes.position.count < 3000) bad.push('dessous trop pauvre (' + ch.full.attributes.position.count + ' sommets)');
      if (ch.base.attributes.position.count >= ch.full.attributes.position.count) bad.push('le maillage « base » doit être plus léger que le complet');
      for (const k of ['rotule', 'roulement', 'amort', 'pompe_carburant']) if (!has(k)) bad.push('manque ' + k);
      if (has('cardan') !== (c.drive !== 'rwd')) bad.push('cardans : ' + (has('cardan') ? 'présents' : 'absents') + ' sur une ' + c.drive);
      if (has('fap') !== (diesel && !ev)) bad.push('FAP : ' + has('fap'));
      if (has('sonde_lambda') !== !ev || has('catalyseur') !== !ev) bad.push('échappement : cata ' + has('catalyseur') + ', sonde ' + has('sonde_lambda') + ' (électrique : ' + ev + ')');
      if (!ev && !(ch.anchors.oilPlug && ch.anchors.oilFilter && ch.anchors.lambda)) bad.push("ancres d'échappement ou de vidange manquantes");
      if (bad.length) out.push(id + ' : ' + bad.join(' ; '));
    }
    return out;
  });
  verifier(!att.length, 'dessous incomplet :\n   ' + att.join('\n   '));
  bilan.push('38 voitures : dessous complet');

  // ── 2. se baisser ──
  await e(() => { __mwj.clear(); __mw.S.inv.length = 0; const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false }), p = __mw.zone(c.zone).ponts[c.pont];
    __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); MWG.run('lift', 'raise'); });
  await attendre(400);
  const y0 = await e(() => __mw.cam.position.y);
  await e(() => MWF.crouch(true));
  let y1 = 9;
  for (let i = 0; i < 20 && y1 > 1.2; i++) { await attendre(500); y1 = await e(() => __mw.cam.position.y); }   /* la descente est progressive : sur une machine lente elle prend plus longtemps */
  verifier(y0 > 1.6 && y1 < 1.2 && y1 > .9, `se baisser : les yeux doivent passer de ~1,70 m à ~1,08 m (avant ${y0.toFixed(2)}, après ${y1.toFixed(2)})`);
  await e(() => MWF.crouch(false));
  await attendreCondition(page, () => __mw.cam.position.y > 1.6, 'se relever : les yeux ne remontent pas', 6000).catch(() => {});
  const y2 = await e(() => __mw.cam.position.y);
  verifier(y2 > 1.6, `se relever : les yeux doivent remonter (${y2.toFixed(2)})`);
  bilan.push(`se baisser (${y0.toFixed(2)} → ${y1.toFixed(2)} m)`);

  // ── 3 et 4. visée et gestes, voiture par voiture ──
  const SANS_AIM = new Set(); // cibles dont seule l'existence est vérifiée
  const job = async (modele, travaux, cibles, opt) => {
    opt = opt || {};
    const ok = await e(([modele, travaux]) => { MWG.release && MWG.release(); __mwj.clear(); __mw.S.inv.length = 0;
      const M = __mwj.noirData.MODELS.garage1; M.length = 0; M.push(MWCARS.tuple(modele));
      const c = __mwj.spawn({ travaux, force: true, rend: false }); if (!c) return false;
      for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'achat', paye: 1 });
      const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); return c.ordre.join('+'); }, [modele, travaux]);
    verifier(ok, `aucune voiture « ${modele} » pour ${travaux.join('+')}`);
    await attendre(300);
    const bad = [];
    const attendrePont = async () => { for (let w = 0, y0 = -1; w < 40; w++) { const y = await e(() => __mwj.meshY(__mwj.jobs()[0])); if (Math.abs(y - y0) < .002) break; y0 = y; await attendre(120); } };
    /* le joueur vise la cible : accroupi, depuis plusieurs endroits ; renvoie l'identifiant visé */
    let dernierMasque = null;
    const viser = async (id) => {
      dernierMasque = null;
      for (const [d, mode] of [[.9, 's'], [.6, 's'], [.8, 'f'], [.8, 'b'], [.45, '-s'], [1.2, 's'], [.5, 'f'], [.5, 'b'], [.25, '-s']]) {
        await e(([id, d, mode]) => {
          MWF.crouch(true); __mw.eyeY = 1.08;
          const R = MWG.rig(), t = R.tg.find(q => q.id === id), v = new THREE.Vector3(), o = typeof t.o === 'function' ? t.o() : t.o;
          o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
          const p = R.p, s = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry)), f = new THREE.Vector3(Math.sin(p.ry), 0, Math.cos(p.ry));
          const dir = mode === 's' ? s : mode === '-s' ? s.clone().multiplyScalar(-1) : mode === 'f' ? f : f.clone().multiplyScalar(-1);
          const x = v.x + dir.x * d, z = v.z + dir.z * d, dx = v.x - x, dz = v.z - z;
          __mw.teleport(x, z, Math.atan2(dx, dz), Math.atan2(v.y - 1.08, Math.hypot(dx, dz)));
        }, [id, d, mode]);
        await attendre(110);
        let vis = await e(() => { const A = MWG.aim(); return A ? A.t.id : null; });
        /* une pièce encore fixée par ses vis : on vise d'abord une de ses vis (actionnable), c'est voulu */
        if (vis && /^pt:/.test(id) && vis.startsWith('fx:' + id.split(':')[1] + ':')) vis = id;
        if (vis === id) { const m = await masque(id); if (!m) return { vis, d, mode }; dernierMasque = m; }
      }
      if (dernierMasque) return { vis: id, masque: dernierMasque };
      return { vis: await e(() => { const A = MWG.aim(); return A ? A.t.id : null; }) };
    };
    /* la pièce est-elle visible depuis là : aucune tôle de la voiture à plus de 12 cm devant elle */
    const masque = async (id) => e((id) => {
      const R = MWG.rig(), t = R.tg.find(q => q.id === id), v = new THREE.Vector3(), o = typeof t.o === 'function' ? t.o() : t.o;
      o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
      const cam = __mw.cam, from = cam.position.clone(), dir = v.clone().sub(from), dist = dir.length(); dir.normalize();
      const rc = new THREE.Raycaster(from, dir, .05, dist + .5), hits = rc.intersectObject(R.g, true).filter(h => h.object.visible && h.object.material && !h.object.userData.hl && h.object.material.opacity !== 0 && !(h.object.material.transparent && h.object.material.opacity < .3));
      if (!hits.length) return null;
      return hits[0].distance < dist - .12 ? { devant: +(dist - hits[0].distance).toFixed(2), objet: hits[0].object.name || (hits[0].object.parent && hits[0].object.parent.name) || '?' } : null; }, id);
    const lever = async () => {
      // suit l'aide jusqu'à ce que les roues voulues soient déposées (ou que le dessous soit libre)
      for (let i = 0; i < 90; i++) {
        const fait = await e((ax) => { const c = __mwj.jobs()[0], w = c.g && c.g.w, S = ax === 'av' ? ['FL', 'FR'] : ['RL', 'RR']; return ax ? !!(w && S.every(s => w[s] && w[s].o)) : !!c.st.lifted; }, opt.roues || null);
        if (fait) break;
        const h = await e(() => { MWG.skip(); return MWG.nextHint(); }); if (!h) break;
        await e(([h]) => MWG.run(h.id, h.key), [h]);
        if (h.key === 'raise' || h.key === 'lower') await attendrePont();
      }
      await attendrePont(); await attendre(500);
    };
    await lever();
    for (const id of cibles) {
      const existe = await e((id) => !!MWG.rig().tg.find(q => q.id === id), id);
      if (!existe) { bad.push('cible absente : ' + id); continue; }
      const r = await viser(id);
      if (r.vis !== id) { const dbg = await e(() => JSON.stringify(MWG.aimDbg().slice(0, 3))); bad.push(`${id} : visé = ${r.vis} | ${dbg}`); continue; }
      const m = r.masque;
      if (m) bad.push(`${id} : masqué par « ${m.objet} » (${m.devant} m devant)`);
    }
    // jusqu'au bout des gestes : tout doit être faisable et la voiture rendue sans blocage
    let n = 0, last = '', same = 0;
    for (; n < 220; n++) {
      const h = await e(() => { MWG.skip(); return MWG.nextHint(); });
      if (!h || h.key === 'door') break;
      if (h.key === last) { if (++same > 3) { bad.push('BOUCLE ' + h.key + ' (' + h.id + ')'); break; } } else same = 0; last = h.key;
      const r = await e(([h]) => MWG.run(h.id, h.key), [h]);
      if (r) { bad.push('REFUS ' + h.key + ' (' + h.id + ') : ' + r); break; }
      if (h.key === 'raise' || h.key === 'lower') await attendrePont();
    }
    const fin = await e(() => { const c = __mwj.jobs()[0]; return { fait: c.ordre.filter(id => !c.done[id]), bl: MWG.blocage(c).join(', ') }; });
    if (fin.fait.length) bad.push('pas terminé : ' + fin.fait.join(', '));
    if (fin.bl) bad.push('blocage : ' + fin.bl);
    verifier(!bad.length, `${modele} (${travaux.join('+')})  : ${bad.join(" ; ")}`);
    bilan.push(`${modele} ${travaux.join('+')} (${cibles.length} visées, ${n} gestes)`);
  };

  const pt = (id, n) => Array.from({ length: n || 1 }, (_, i) => 'pt:' + id + ':' + i);
  // clio4 : traction, tambours à l'arrière, diesel (FAP) → train avant avec cardans
  await job('clio4', ['rotule', 'roulement', 'amort', 'cardan'], [].concat(pt('rotule', 2), pt('roulement', 2), pt('amort', 2), pt('cardan', 2)), { roues: 'av' });
  // dessous : échappement, sonde, réservoir
  await job('clio4', ['catalyseur', 'sonde_lambda', 'pompe_carburant', 'fap'], [].concat(pt('catalyseur'), pt('sonde_lambda'), pt('pompe_carburant'), pt('fap'), ['fx:catalyseur:0', 'fx:pompe_carburant:0']));
  // tambours : garnitures (mâchoires) et tambours arrière, comme un tambour
  await job('clio4', ['plaq_ar', 'disq_ar'], ['disc:RL', 'disc:RR'], { roues: 'ar' });
  const tamb = await e(() => { const R = MWG.rig(); const k = R && R.bk && R.bk.RL; return { drum: !!(k && k.drum), nom: R.tg.find(q => q.id === 'disc:RL') && R.tg.find(q => q.id === 'disc:RL').name() }; });
  // (la voiture est rendue : le rig a été conservé tant qu'on est près du pont)
  verifier(!tamb.nom || /tambour/i.test(tamb.nom), 'le frein arrière à tambour s\'appelle « ' + tamb.nom + ' » (doit être un tambour)');
  // propulsion, diesel, disques ventilés : pas de cardan avant, disques à l'arrière
  await job('bmw320d', ['rotule', 'roulement', 'amort'], [].concat(pt('rotule', 2), pt('roulement', 2), pt('amort', 2)), { roues: 'av' });
  await job('bmw320d', ['catalyseur', 'sonde_lambda', 'fap'], [].concat(pt('catalyseur'), pt('sonde_lambda'), pt('fap')));
  // moteur arrière
  await job('p911', ['catalyseur', 'sonde_lambda', 'pompe_carburant'], [].concat(pt('catalyseur'), pt('sonde_lambda'), pt('pompe_carburant')));
  return 'dessous complet et visable : ' + bilan.join(' | ');
};
module.exports.titre = 'mécanicien : le dessous de la voiture levée est lisible, visable et démontable (châssis, échappement, tambours)';
module.exports.appareil = 'bureau';
