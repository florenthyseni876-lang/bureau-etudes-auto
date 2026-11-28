'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (ville) : aucun obstacle (bâtiment, zone, clôture, objet du décor) ne déborde sur la chaussée des rues.
// Sont tolérés : marquages au sol (moins de 0,3 m), voitures (garées ou en circulation), objets transparents (faisceau du repère),
// éléments posés sur les trottoirs (feux, panneaux, lampadaires : ils n'atteignent pas la chaussée).
module.exports = async function mecaRoutesLibres(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwvie, null, { timeout: 15000 });
  await attendre(1500);

  // visite chaque lieu (porte puis intérieur) pour déclencher les constructions tardives des modules (ateliers, stock, employés…)
  await page.evaluate(async () => {
    const attendre = (ms) => new Promise(res => setTimeout(res, ms));
    for (const z of __mw.zones) {
      __mw.teleport(z.porte.x, z.porte.z, z.ry || 0, 0);
      await attendre(120);
      if (z.interior) { __mw.teleport(z.x, z.z, 0, 0); await attendre(120); }
    }
    __mw.teleport(-26, 9, -1.57, 0);
  });
  await attendre(1000);

  const r = await page.evaluate(() => {
    const T3 = __mw.THREE;
    const RX = [-150, 0, 150], RZ = [-150, 0, 150], DEMI = 7, E = 300, TOL = .08, out = [];
    const sur = (x0, z0, x1, z1) => { // le rectangle mord-il sur une chaussée ?
      for (const r of RX) if (x1 > r - DEMI + TOL && x0 < r + DEMI - TOL && z1 > -E && z0 < E) return 'avenue x=' + r;
      for (const r of RZ) if (z1 > r - DEMI + TOL && z0 < r + DEMI - TOL && x1 > -E && x0 < E) return 'rue z=' + r;
      return null;
    };
    const nom2 = (q) => Math.round(q.x * 10) / 10 + ', ' + Math.round(q.z * 10) / 10;
    const nom = (a) => a.map(v => Math.round(v * 10) / 10).join(', ');
    // 1. zones (bâtiments) : rectangle complet, sauf le terrain (parvis sans bâtiment)
    for (const z of __mw.zones) {
      const m = sur(z.x - z.w / 2, z.z - z.d / 2, z.x + z.w / 2, z.z + z.d / 2);
      if (m) out.push(`zone « ${z.id} » [${nom([z.x - z.w / 2, z.z - z.d / 2, z.x + z.w / 2, z.z + z.d / 2])}] empiète sur ${m}`);
      const p = z.porte; if (p) { const q = sur(p.x - .1, p.z - .1, p.x + .1, p.z + .1); if (q) out.push(`porte de « ${z.id} » (${nom([p.x, p.z])}) est sur ${q}`); }
    }
    // 2. colliders (hors voitures)
    __mw.walls.forEach((w, i) => { if (w._v || w._car || !isFinite(w[0])) return; const a = Math.min(w[2] - w[0], w[3] - w[1]), b = Math.max(w[2] - w[0], w[3] - w[1]); if (a >= 1.5 && a <= 2.8 && b >= 3.4 && b <= 6.6) return; /* empreinte de voiture ou de camionnette */ const m = sur(w[0], w[1], w[2], w[3]); if (m) out.push(`obstacle ${i} [${nom(w)}] sur ${m}`); });
    // 1 bis. contenus des modules récents : camionnette de livraison (js/59) dans la file de stationnement, postes des employés (js/60) hors chaussée
    const surChaussee = (x, z, demiX, demiZ) => sur(x - demiX, z - demiZ, x + demiX, z + demiZ);
    for (const z of __mw.zones) {
      if (!z.door) continue;
      if (window.MWST && MWST.vanSpot) {
        const v = MWST.vanSpot(z.id);
        if (v) {
          const longX = Math.abs(Math.sin(v.ry)) > .5, dx = (longX ? v.longueur : v.largeur) / 2, dz = (longX ? v.largeur : v.longueur) / 2;
          // la camionnette est un véhicule : elle peut être sur la chaussée, mais seulement dans la file de stationnement, hors carrefour
          const axe = v.horiz ? RZ.map(r => Math.abs(v.z - r)) : RX.map(r => Math.abs(v.x - r));
          const decalage = Math.min(...axe), le = v.horiz ? v.x : v.z, croisement = (v.horiz ? RX : RZ).map(r => Math.abs(le - r));
          const demiLong = v.longueur / 2;
          if (decalage < 4.3) out.push(`camionnette de livraison de « ${z.id} » au milieu de la chaussée (à ${decalage.toFixed(1)} m de l'axe)`);
          if (Math.min(...croisement) < 7 + demiLong) out.push(`camionnette de livraison de « ${z.id} » dans un carrefour`);
          if (!isFinite(dx + dz)) out.push(`camionnette de « ${z.id} » sans dimensions`);
        }
      }
      if (window.MWEMP && MWEMP.stationOf && z.loc && z.ponts) {
        for (const nom of ['outside', 'door', 'reception']) {
          const q = MWEMP.stationOf(z, nom, 0);
          const m = q && surChaussee(q.x, q.z, .3, .3);
          if (m) out.push(`poste « ${nom} » des employés de « ${z.id} » (${nom2(q)}) sur ${m}`);
        }
      }
    }
    // 2 bis. trottoirs : un obstacle ne doit pas laisser moins de 1,4 m de passage dans les 3 m du trottoir
    const trot = (x0, z0, x1, z1, lib) => { // lib = axe le long duquel on marche : 'z' (avenues) ou 'x' (rues)
      for (const r of (lib === 'z' ? RX : RZ)) for (const s of [-1, 1]) {
        const a = r + s * 7.12, b = r + s * 10.12, lo = Math.min(a, b), hi = Math.max(a, b);
        const [p0, p1, q0, q1] = lib === 'z' ? [x0, x1, z0, z1] : [z0, z1, x0, x1]; // p : axe transversal ; q : axe de marche
        if (p1 <= lo + .05 || p0 >= hi - .05) continue;
        if (lib === 'z' ? (q1 > -E && q0 < E) : (q1 > -E && q0 < E)) { const libre = Math.max(Math.max(p0, lo) - lo, hi - Math.min(p1, hi)); if (libre < 1.4) return (lib === 'z' ? 'avenue x=' : 'rue z=') + r + ' (passage ' + libre.toFixed(1) + ' m)'; }
      }
      return null;
    };
    __mw.walls.forEach((w, i) => { if (w._v || w._car || !isFinite(w[0])) return; const a = Math.min(w[2] - w[0], w[3] - w[1]), b = Math.max(w[2] - w[0], w[3] - w[1]); if (a >= 1.5 && a <= 2.8 && b >= 3.4 && b <= 6.6) return; if (b > 12) return; /* bâtiments : hors sujet ici */
      const m = trot(w[0], w[1], w[2], w[3], 'z') || trot(w[0], w[1], w[2], w[3], 'x'); if (m) out.push(`obstacle ${i} [${nom(w)}] barre le trottoir : ${m}`); });
    // 3. objets de la scène (maillages non fusionnés de petite taille)
    const B = new __mw.THREE.Box3(), vus = new Set();
    __mw.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.visible || !o.geometry) return;
      const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (mt && (mt.transparent || mt.visible === false)) return;
      B.setFromObject(o); if (!isFinite(B.min.x)) return;
      const lx = B.max.x - B.min.x, lz = B.max.z - B.min.z; if (lx > 60 || lz > 60 || /^(core|detail|far|dyn):/.test(o.name) || /car|voiture/i.test(o.name)) return; // sol, routes, ciel, lots fusionnés (testés via les colliders), voitures
      if (B.max.y < .3 || B.min.y > 3.2) return; // marquage au sol ou structure en hauteur
      let p = o, v = false; while (p) { if (p.userData && (p.userData.voiture || p.userData.car)) v = true; p = p.parent; } if (v) return;
      const m = sur(B.min.x, B.min.z, B.max.x, B.max.z); if (!m) return;
      const k = Math.round(B.min.x) + '|' + Math.round(B.min.z) + '|' + Math.round(lx) + '|' + Math.round(lz); if (vus.has(k)) return; vus.add(k);
      out.push(`objet « ${o.name || o.type} » [${nom([B.min.x, B.min.z, B.max.x, B.max.z])}] h ${nom([B.max.y])} sur ${m}`);
    });
    // 4. lots fusionnés du décor : aucun triangle d'objet (posé au sol, de plus de 0,45 m de haut) sur la chaussée, hors voitures
    {
      const va = new T3.Vector3(), vb = new T3.Vector3(), vc = new T3.Vector3(), vus2 = new Map();
      const estVoiture = (o) => { for (let p = o; p; p = p.parent) { if (p.userData && (p.userData.mdl || p.userData.kind || p.userData.L)) return true; if (/^dyn:|^vie$|ciel/.test(p.name || '')) return true; } return false; };
      __mw.scene.updateMatrixWorld(true);
      __mw.scene.traverse(o => {
        if (!o.isMesh || o.isInstancedMesh || !o.visible || !o.geometry || !o.geometry.attributes.position || estVoiture(o)) return;
        if (/dessous|glowm|mark|asph|walk|conc$/.test(o.name)) return;
        const pos = o.geometry.attributes.position, ix = o.geometry.index, n = ix ? ix.count / 3 : pos.count / 3, m = o.matrixWorld;
        for (let t = 0; t < n; t++) {
          const i0 = ix ? ix.getX(t * 3) : t * 3, i1 = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, i2 = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
          va.fromBufferAttribute(pos, i0).applyMatrix4(m); vb.fromBufferAttribute(pos, i1).applyMatrix4(m); vc.fromBufferAttribute(pos, i2).applyMatrix4(m);
          const hMax = Math.max(va.y, vb.y, vc.y), hMin = Math.min(va.y, vb.y, vc.y);
          if (hMax < .45 || hMin > 1.6) continue; // objets posés au sol (les couronnes d arbres et bras de lampadaires qui surplombent la chaussée sont tolérés)
          const cx = (va.x + vb.x + vc.x) / 3, cz = (va.z + vb.z + vc.z) / 3;
          const m2 = sur(cx - .01, cz - .01, cx + .01, cz + .01);
          if (!m2) continue;
          const k = (o.name || o.type) + ' ' + m2, g = vus2.get(k) || { n: 0, ex: `(${cx.toFixed(1)}, ${hMax.toFixed(1)}, ${cz.toFixed(1)})` };
          g.n++; vus2.set(k, g);
        }
      });
      for (const [k, g] of vus2) out.push(`lot fusionné « ${k} » : ${g.n} triangle(s) sur la chaussée, p. ex. ${g.ex}`);
    }
    return out;
  });
  if (process.env.DIAG) console.log(r.join('\n'));
  verifier(r.length === 0, `${r.length} obstacle(s) sur la chaussée : ${r.slice(0, 6).join(' ; ')}`);
  return 'zones, colliders et objets du décor : chaussée libre';
};
module.exports.titre = 'mécanicien (ville) : aucun obstacle sur la chaussée des rues';
module.exports.appareil = 'bureau';
