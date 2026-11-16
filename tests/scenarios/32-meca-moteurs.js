'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (moteurs) : pour plusieurs voitures réelles, capot ouvert, chaque cible d'une pièce du moteur doit
//  1. se trouver dans le compartiment moteur (jamais au centre de la voiture ni hors de la baie),
//  2. être posée sur une pièce dessinée (une surface du moteur ou de la baie à moins de 6 cm),
//  3. se voir depuis une position de joueur réaliste (face, côtés) : rien d'autre ne la cache.
const JOBS = [['bougies', /^bp:/], ['courroie_acc', /^cr:/], ['courroie_dist', /:courroie_dist/], ['alternateur', /:alternateur/], ['demarreur', /:demarreur/], ['injecteurs', /:injecteurs/],
  ['batterie', /:batterie/], ['filtre_air', /:filtre_air/], ['vanne_egr', /:vanne_egr/], ['turbo', /:turbo/], ['thermostat', /:thermostat/], ['pompe_eau', /:pompe_eau/], ['joint_cc', /:joint_cc/],
  ['capteur_pmh', /:capteur_pmh/], ['capteur_arbre', /:capteur_arbre/], ['debitmetre', /:debitmetre/], ['sonde_temp', /:sonde_temp/], ['liquide_frein', /:liquide_frein/], ['bobines', /:bobines/]];
module.exports = async function mecaMoteurs(page, env) {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot');
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined', null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => { MWG.set({ aide: 'on', classic: false }); MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mw.S.jobs.next = 1e12;
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison', 'electricite', 'transmission']) __mw.S.xp[k] = 2000; });
  const cars = (process.env.CARS || 'clio4,bmw320d,p911,tiguan2').split(',');
  const bad = [], bilan = [];
  for (const id of cars) {
    let n = 0;
    for (const [job, re] of JOBS) {
      const ok = await e(([id, job]) => { const D = __mwj.noirData.MODELS; for (const z of ['garage1', 'garage2', 'garage3', 'garage4']) { D[z].length = 0; D[z].push(MWCARS.tuple(id)); }
        MWG.release && MWG.release(); __mwj.clear(); const c = __mwj.spawn({ travaux: [job], force: true, rend: false }); if (!c || c.mdl !== id || !c.parts[job] || c.parts[job].na) return false;
        const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); MWG.run('hood', 'hopen'); return true; }, [id, job]);
      if (!ok) continue;
      await attendre(1200); await page.waitForFunction(() => { const R = MWG.rig(); return R && R.g.userData.bay && R.bayAt; }, null, { timeout: 8000 }).catch(() => {}); await attendre(500);
      const r = await e(([re]) => {
        const R = MWG.rig(); if (!R) return { err: 'pas de rig' };
        const g = R.g, bay = g.userData.bay; if (!bay) return { err: 'pas de moteur dans la baie' };
        g.updateMatrixWorld(true);
        const T = THREE, rc = new T.Raycaster(), res = [];
        // matières à double face le temps de la mesure
        const sides = []; bay.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) { sides.push([o.material, o.material.side]); o.material.side = T.DoubleSide; } });
        const occ = []; g.traverse(o => { if (!o.isMesh || !o.visible || o.name === 'bay_ao' || o.name === 'cover') return; for (let q = o; q; q = q.parent) if (q === R.root || q.visible === false) return; if (o.material && o.material.transparent) return; occ.push(o); });
        const bayM = occ.filter(o => { for (let q = o; q; q = q.parent) if (q === bay) return true; return false; });
        const U = g.userData, hw = U.W / 2, bz = MWCARS.anchorWorld(g, 'bay');
        const inv = g.matrixWorld.clone().invert();
        const f = new T.Vector3(Math.sin(R.p.ry), 0, Math.cos(R.p.ry)), s = new T.Vector3(Math.cos(R.p.ry), 0, -Math.sin(R.p.ry)), fs = bay.userData.anchors.bay.z >= 0 ? 1 : -1;
        for (const t of R.tg) {
          if (!re.test(t.id)) continue;
          if (t.vis && !t.vis()) { continue; }
          const o = typeof t.o === 'function' ? t.o() : t.o, v = new T.Vector3(); o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
          const l = v.clone().applyMatrix4(inv), r = { id: t.id, l: l.toArray().map(x => +x.toFixed(2)) };
          // 1. dans la baie
          const a = bay.userData.anchors.bay; r.inBay = Math.abs(l.x) <= hw && Math.abs(l.z - a.z) <= (U.hoodLen || 1) * .9 && l.y > .1 && l.y < 1.3;
          if (Math.abs(l.x) < .06 && Math.abs(l.z) < .06) r.centre = true;
          // 2. sur une pièce dessinée : rayons dans six directions
          let dm = 9; for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { rc.set(v, new T.Vector3(...d)); rc.far = .06; const h = rc.intersectObjects(bayM, false); if (h.length) dm = Math.min(dm, h[0].distance); }
          r.dist = +dm.toFixed(3);
          // 3. visible depuis quelques positions
          const eyes = [[0, 1.05], [.5, 1.0], [-.5, 1.0], [hw + .55, .1], [-(hw + .55), .1], [hw + .4, .6], [-(hw + .4), .6], [0, 0.6]];
          for (const a of [-.4, 0, .4]) for (const b of [-.3, .1, .5, .9]) eyes.push([a, b]);
          const top = [-.3, 0, .3].flatMap(a => [-.3, 0, .3].map(b => [a, b, 1.95])); // penché au-dessus de la baie
          r.vu = 0;
          for (const [ds, df, hh] of eyes.concat(top)) {
            const eye = new T.Vector3(bz.x + s.x * ds + f.x * df * fs, hh || 1.65, bz.z + s.z * ds + f.z * df * fs), d = v.clone().sub(eye), L = d.length(); d.normalize();
            rc.set(eye, d); rc.far = L; const h = rc.intersectObjects(occ, false);
            if (!h.length || h[0].distance > L - .075) r.vu++; }
          res.push(r);
        }
        for (const [m, sd] of sides) m.side = sd;
        return { res };
      }, [re]);
      if (r.err) { bad.push(`${id}/${job} : ${r.err}`); continue; }
      for (const t of r.res) {
        n++;
        if (!t.inBay) bad.push(`${id} : cible ${t.id} hors du compartiment moteur (${t.l})`);
        if (t.centre) bad.push(`${id} : cible ${t.id} au centre de la voiture`);
        if (t.dist > .06) bad.push(`${id} : cible ${t.id} flotte à ${Math.round(t.dist * 100)} cm de toute pièce dessinée (${t.l})`);
        // une fixation minuscule peut être cachée par le bord de la baie si la pièce elle-même se voit
        const frere = /^fx:/.test(t.id) && r.res.some(q => /^(pt|cv):/.test(q.id) && q.id.split(':')[1] === t.id.split(':')[1] && q.vu >= 1);
        if (t.vu < 1 && !frere) bad.push(`${id} : cible ${t.id} cachée (invisible depuis les positions de joueur) (${t.l})`);
      }
    }
    bilan.push(`${id} : ${n} cibles`);
  }
  if (bad.length) console.log('DETAIL32\n' + bad.join('\n'));
  verifier(!bad.length, `cibles du moteur mal placées (${bad.length}) :\n   ${bad.slice(0, 40).join('\n   ')}`);
  return bilan.join(', ');
};
module.exports.titre = 'mécanicien : cibles des pièces du moteur posées sur la pièce dessinée et visables';
module.exports.appareil = 'bureau';
