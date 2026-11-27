'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (dessous de la voiture) :
//  1. pour chacune des voitures du catalogue (les 38), le moteur, la boîte de vitesses, le berceau, la traverse de boîte, le tunnel et la
//     protection sous moteur ne se traversent pas (boîtes englobantes, marge de 1,5 cm) ;
//  2. voiture levée, le moteur est dessiné sans plancher ni coque au-dessus de lui (rien entre un joueur accroupi et le carter d'huile) ;
//  3. une lumière d'appoint éclaire le dessous (une lampe sous la voiture, assez proche du moteur) ;
//  4. les cibles du dessous (bouchon de vidange, filtre à huile, protection) se voient depuis une position de joueur accroupi.
module.exports = async function mecaDessous(page, env) {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot');
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined' && typeof MWUD !== 'undefined' && typeof MWBOX !== 'undefined',
    null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);

  // 1. intersections pour toutes les voitures
  const bilan = await e(() => {
    const res = [], vues = [];
    for (const car of MWCARS.list) {
      if (car.ev) continue;
      const g = MWCARS.build(car, {});
      const moteur = MWCARS.engineMesh(car, { group: g });
      g.add(moteur);
      g.userData.bay = moteur;
      const boites = MWUD.boites(g);
      const noms = Object.keys(boites);
      if (!boites.moteur || !noms.some(n => n.indexOf('boite.') === 0)) res.push(`${car.id} : moteur ou boîte absents (${noms.join(', ')})`);
      for (const [a, b, pen] of MWUD.contacts(g)) res.push(`${car.id} : « ${a} » traverse « ${b} » de ${Math.round(pen * 100)} cm`);
      vues.push(car.id);
      moteur.userData.dispose();
    }
    return { res, n: vues.length };
  });
  if (bilan.res.length) console.log('DETAIL33\n' + bilan.res.join('\n'));
  verifier(!bilan.res.length, `pièces du dessous qui se traversent ou manquent :\n   ${bilan.res.slice(0, 30).join('\n   ')}`);
  verifier(bilan.n >= 37, `trop peu de voitures contrôlées (${bilan.n})`);

  // 2 à 4. une voiture levée : plancher ouvert, lumière, cibles visibles
  await e(() => { MWG.set({ aide: 'on', classic: false }); MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mw.S.jobs.next = 1e12;
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison', 'electricite', 'transmission']) __mw.S.xp[k] = 2000; });
  const cas = [];
  for (const id of (process.env.CARS || 'clio4,bmw320d').split(',')) {
    await e((id) => { const D = __mwj.noirData.MODELS; for (const z of ['garage1', 'garage2', 'garage3', 'garage4']) { D[z].length = 0; D[z].push(MWCARS.tuple(id)); }
      MWG.release && MWG.release(); __mwj.clear(); const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false }); const p = __mw.zone(c.zone).ponts[c.pont];
      __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); MWG.run('lift', 'raise'); }, id);
    await page.waitForFunction(() => { const R = MWG.rig(); return R && R.g.position.y > 1.5; }, null, { timeout: 30000 });
    await attendre(1500);
    const r = await e(() => {
      const R = MWG.rig(), g = R.g, bay = g.userData.bay, T = THREE;
      if (!bay) return { err: 'le moteur de la baie n\'est pas construit quand la voiture est levée' };
      g.updateMatrixWorld(true);
      const rc = new T.Raycaster(), eg = bay.getObjectByName('engine'), bb = new T.Box3().setFromObject(eg), c = bb.getCenter(new T.Vector3());
      // rien entre le dessous du moteur et le sol : un rayon vers le bas ne touche que des pièces de la baie ou du châssis
      rc.set(new T.Vector3(c.x, bb.min.y + .02, c.z), new T.Vector3(0, -1, 0)); rc.far = 1;
      const bas = rc.intersectObject(g, true).filter(h => h.object.parent === g);
      // lumière : lampe ponctuelle proche du moteur, allumée
      let lumiere = null;
      __mw.scene.traverse(o => { if (o.isPointLight && o.intensity > .5) lumiere = lumiere && lumiere.intensity > o.intensity ? lumiere : o; });
      const dist = lumiere ? lumiere.position.distanceTo(c) : 99;
      // cibles du dessous : visibles depuis un joueur accroupi sous le moteur
      const f = new T.Vector3(Math.sin(R.p.ry), 0, Math.cos(R.p.ry)), s = new T.Vector3(Math.cos(R.p.ry), 0, -Math.sin(R.p.ry));
      const occ = []; g.traverse(o => { if (!o.isMesh || !o.visible || o.name === 'bay_ao') return; for (let q = o; q; q = q.parent) if (q === R.root || q.visible === false) return; if (o.material && o.material.transparent) return; occ.push(o); });
      const sides = []; bay.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) { sides.push([o.material, o.material.side]); o.material.side = T.DoubleSide; } });
      const vues = [];
      for (const t of R.tg) {
        if (!/^(sk:|filt$|plug$)/.test(t.id)) continue;
        if (t.vis && !t.vis()) continue;
        const o = typeof t.o === 'function' ? t.o() : t.o, v = new T.Vector3(); o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
        let vu = 0;
        for (const [a, b2] of [[0, 0], [.4, 0], [-.4, 0], [0, .5], [0, -.5], [.5, .4], [-.5, -.4], [.7, 0], [-.7, 0]]) {
          const eye = new T.Vector3(v.x + s.x * a + f.x * b2, 1.08, v.z + s.z * a + f.z * b2), d = v.clone().sub(eye), L = d.length(); d.normalize();
          rc.set(eye, d); rc.far = L; const h = rc.intersectObjects(occ, false);
          if (!h.length || h[0].distance > L - .075) vu++;
        }
        vues.push({ id: t.id, vu });
      }
      for (const [m, sd] of sides) m.side = sd;
      return { bas: bas.map(h => h.object.name || h.object.type), lumiere: !!lumiere, dist: +dist.toFixed(2), vues };
    });
    verifier(!r.err, `${id} : ${r.err}`);
    verifier(!r.bas.length, `${id} : un élément de la coque ferme le dessous du moteur (${r.bas.join(', ')})`);
    verifier(r.lumiere && r.dist < 2.2, `${id} : pas de lumière d'appoint sous le moteur (lumière : ${r.lumiere}, distance ${r.dist} m)`);
    verifier(r.vues.length >= 2, `${id} : cibles du dessous introuvables (${JSON.stringify(r.vues)})`);
    for (const t of r.vues) verifier(t.vu > 0, `${id} : la cible ${t.id} ne se voit depuis aucune position accroupie`);
    cas.push(`${id} (${r.vues.length} cibles, lampe à ${r.dist} m)`);
  }
  return `${bilan.n} voitures sans pièces qui se traversent ; ${cas.join(', ')}`;
};
module.exports.titre = 'mécanicien : dessous lisible (pièces qui ne se traversent pas, plancher ouvert, lumière, cibles visibles)';
module.exports.appareil = 'bureau';
