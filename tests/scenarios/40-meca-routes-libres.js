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

  const r = await page.evaluate(() => {
    const RX = [-150, 0, 150], RZ = [-150, 0, 150], DEMI = 7, E = 300, TOL = .08, out = [];
    const sur = (x0, z0, x1, z1) => { // le rectangle mord-il sur une chaussée ?
      for (const r of RX) if (x1 > r - DEMI + TOL && x0 < r + DEMI - TOL && z1 > -E && z0 < E) return 'avenue x=' + r;
      for (const r of RZ) if (z1 > r - DEMI + TOL && z0 < r + DEMI - TOL && x1 > -E && x0 < E) return 'rue z=' + r;
      return null;
    };
    const nom = (a) => a.map(v => Math.round(v * 10) / 10).join(', ');
    // 1. zones (bâtiments) : rectangle complet, sauf le terrain (parvis sans bâtiment)
    for (const z of __mw.zones) {
      const m = sur(z.x - z.w / 2, z.z - z.d / 2, z.x + z.w / 2, z.z + z.d / 2);
      if (m) out.push(`zone « ${z.id} » [${nom([z.x - z.w / 2, z.z - z.d / 2, z.x + z.w / 2, z.z + z.d / 2])}] empiète sur ${m}`);
      const p = z.porte; if (p) { const q = sur(p.x - .1, p.z - .1, p.x + .1, p.z + .1); if (q) out.push(`porte de « ${z.id} » (${nom([p.x, p.z])}) est sur ${q}`); }
    }
    // 2. colliders (hors voitures)
    __mw.walls.forEach((w, i) => { if (w._v || w._car || !isFinite(w[0])) return; const a = Math.min(w[2] - w[0], w[3] - w[1]), b = Math.max(w[2] - w[0], w[3] - w[1]); if (a >= 1.5 && a <= 2.8 && b >= 3.4 && b <= 6.6) return; /* empreinte de voiture ou de camionnette */ const m = sur(w[0], w[1], w[2], w[3]); if (m) out.push(`obstacle ${i} [${nom(w)}] sur ${m}`); });
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
    return out;
  });
  if (process.env.DIAG) console.log(r.join('\n'));
  verifier(r.length === 0, `${r.length} obstacle(s) sur la chaussée : ${r.slice(0, 6).join(' ; ')}`);
  return 'zones, colliders et objets du décor : chaussée libre';
};
module.exports.titre = 'mécanicien (ville) : aucun obstacle sur la chaussée des rues';
module.exports.appareil = 'bureau';
