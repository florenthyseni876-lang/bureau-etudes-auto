'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (finition) : détecte, sur toute la scène 3D statique, les surfaces superposées qui scintillent (z-fighting) :
//  1. faces coplanaires de même sens qui se recouvrent (écart < 2 mm) entre deux triangles ;
//  2. faces presque coplanaires (écart < 3 cm) dont la face du dessus n'a pas de décalage de polygone (polygonOffset) ;
//  3. objets enfouis sous le sol (tout le triangle sous y = -0,02 sans être le sol lui-même).
// Les voitures, piétons et objets instanciés (mobiles) sont ignorés.
module.exports = async function mecaTextures(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S, null, { timeout: 15000 });
  await attendre(1500);

  const r = await page.evaluate(() => {
    const T = __mw.THREE, scene = __mw.scene, tris = [];
    scene.updateMatrixWorld(true);
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3(), n = new T.Vector3();
    let id = 0; const meshes = [];
    scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position) return;
      let p = o, mobile = false; while (p) { if (/^dyn|voiture|pnj|car/i.test(p.name || '') || (p.userData && (p.userData.voiture || p.userData.car))) mobile = true; p = p.parent; }
      if (mobile || o.visible === false || o.name === 'ciel') return;
      const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (!mt || mt.visible === false || mt.transparent) return;
      const g = o.geometry, pos = g.attributes.position, ix = g.index, m = o.matrixWorld, nT = ix ? ix.count / 3 : pos.count / 3, mid = id++; meshes.push(o);
      const po = !!(mt.polygonOffset && mt.polygonOffsetFactor < 0) || !!(mt.userData && mt.userData.po);
      const nm = (o.name || o.type) + (mt.name ? '/' + mt.name : '');
      for (let t = 0; t < nT; t++) {
        const i0 = ix ? ix.getX(t * 3) : t * 3, i1 = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, i2 = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m); b.fromBufferAttribute(pos, i1).applyMatrix4(m); c.fromBufferAttribute(pos, i2).applyMatrix4(m);
        e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2); const l = n.length(); if (l < 1e-6) continue; const area = l / 2; n.multiplyScalar(1 / l);
        if (area < .02) continue;
        if (n.y < -.5) continue; // dessous : jamais vus d'en bas (toits, sols, plafonds)
        tris.push({ cx: (a.x + b.x + c.x) / 3, cy: (a.y + b.y + c.y) / 3, cz: (a.z + b.z + c.z) / 3, mid, nm, po, nx: n.x, ny: n.y, nz: n.z, d: n.dot(a), area,
          x0: Math.min(a.x, b.x, c.x), x1: Math.max(a.x, b.x, c.x), y0: Math.min(a.y, b.y, c.y), y1: Math.max(a.y, b.y, c.y), z0: Math.min(a.z, b.z, c.z), z1: Math.max(a.z, b.z, c.z) });
      }
    });
    // seaux par orientation et par plan (pas de 1 cm), puis balayage en x
    const B = new Map();
    for (let i = 0; i < tris.length; i++) { const t = tris[i], k = Math.round(t.nx * 20) + '|' + Math.round(t.ny * 20) + '|' + Math.round(t.nz * 20) + '|' + Math.round(t.d / .01); let l = B.get(k); if (!l) B.set(k, l = []); l.push(t); }
    const groupes = new Map(), enfouis = new Map();
    const noter = (cat, t, u, gap, ox, oy, oz, aire) => {
      const kk = cat + ' : ' + [t.nm, u.nm].sort().join(' ↔ '); const k = cat + ' : ' + [t.nm, u.nm].sort().join(' ↔ '); let g = groupes.get(k); if (!g) groupes.set(k, g = { n: 0, ex: '', gap }); (g.pts = g.pts || []); if (g.pts.length < 24 && (g.n % 7 === 0 || g.pts.length < 6)) { const q = t.area < u.area ? t : u; g.pts.push([q.cx, q.cy, q.cz, t.nx, t.ny, t.nz, t.mid, u.mid]); } g.bb = [t, u].map(q => [q.x0, q.x1, q.y0, q.y1, q.z0, q.z1].map(w => w.toFixed(2)).join(',')).join(' // '); g.n++; if (!g.ex || aire > (g.a || 0)) { g.a = aire; g.ex = `(${ox.toFixed(1)}, ${oy.toFixed(2)}, ${oz.toFixed(1)}) ${aire.toFixed(2)} m², écart ${(gap * 1000).toFixed(1)} mm n(${t.nx.toFixed(0)},${t.ny.toFixed(0)},${t.nz.toFixed(0)}) d=${t.d.toFixed(2)}`; } };
    for (const [k, l] of B) {
      const [ka, kb, kc] = k.split('|').map(Number);
      // seaux voisins (même orientation, plan à ±1 cm)
      const lst = l.slice(); const d0 = Math.round(+k.split('|')[3]);
      for (const dd of [1]) { const l2 = B.get([ka, kb, kc, d0 + dd].join('|')); if (l2) for (const t of l2) lst.push(t); }
      if (lst.length < 2 || lst.length > 40000) continue;
      lst.sort((p, q) => p.x0 - q.x0);
      for (let i = 0; i < lst.length; i++) { const t = lst[i];
        for (let j = i + 1; j < lst.length; j++) { const u = lst[j]; if (u.x0 > t.x1) break; if (u.mid === t.mid) continue;
          const ox0 = Math.max(t.x0, u.x0), ox1 = Math.min(t.x1, u.x1), oz0 = Math.max(t.z0, u.z0), oz1 = Math.min(t.z1, u.z1), oy0 = Math.max(t.y0, u.y0), oy1 = Math.min(t.y1, u.y1);
          if (oz1 <= oz0 || oy1 < oy0 - .001) continue;
          const aire = Math.max(0, ox1 - ox0) * Math.max(0, oz1 - oz0) + Math.max(0, ox1 - ox0) * Math.max(0, oy1 - oy0) + Math.max(0, oz1 - oz0) * Math.max(0, oy1 - oy0);
          if (aire < .05) continue;
          if ([ox1 - ox0, oy1 - oy0, oz1 - oz0].filter(q => q >= .05).length < 2) continue; // simple liseré : pas un vrai recouvrement
          { const ax = Math.abs(t.nx) > .98 ? 0 : Math.abs(t.ny) > .98 ? 1 : Math.abs(t.nz) > .98 ? 2 : -1, ov3 = [ox1 - ox0, oy1 - oy0, oz1 - oz0]; if (ov3.some((q, i) => i !== ax && q < .01)) continue; } // facettes voisines d'une surface courbe : elles se touchent, sans se recouvrir
          const gap = Math.abs(t.d - u.d); if (gap > .03) continue;
          if (t.nx * u.nx + t.ny * u.ny + t.nz * u.nz < .999) continue;
          const haut = t.d > u.d ? t : u, bas = haut === t ? u : t;
          if (t.po || u.po) continue; // un décalage de polygone tranche toujours : pas de scintillement
          if (gap < .002) noter('faces confondues', t, u, gap, (ox0 + ox1) / 2, (oy0 + oy1) / 2, (oz0 + oz1) / 2, aire);
          else if (!haut.po) noter('sans décalage de polygone', haut, bas, gap, (ox0 + ox1) / 2, (oy0 + oy1) / 2, (oz0 + oz1) / 2, aire);
        } } }
    // 4. fenêtres, vitrines, enseignes, panneaux et affiches ne doivent jamais être couchés à plat
    const verticaux = /win|shop|office|signs|dirs|posters|tsign|toolpanel|glass/, plats = new Map();
    for (const t of tris) if (verticaux.test(t.nm) && t.ny > .5 && t.area > .2) { const k = 'surface verticale couchée à plat : ' + t.nm; const g = plats.get(k) || { n: 0, ex: `(${t.cx.toFixed(1)}, ${t.cy.toFixed(2)}, ${t.cz.toFixed(1)})` }; g.n++; plats.set(k, g); }
    for (const [k, v] of plats) enfouis.set(k, v);
    for (const t of tris) if (t.y1 < -.02 && t.area > .5 && !/grass|sol|ground/i.test(t.nm)) { const k = 'sous le sol : ' + t.nm; const g = enfouis.get(k) || { n: 0, ex: `(${t.x0.toFixed(1)}, ${t.y1.toFixed(2)}, ${t.z0.toFixed(1)})` }; g.n++; enfouis.set(k, g); }
    // visibilité : un rayon lancé de 25 cm au-dessus de la face (selon sa normale) doit la toucher en premier ; sinon elle est cachée (toit, mur, sol)
    const rc = new T.Raycaster(), cibles = []; scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.visible && o.name !== 'ciel' && o.geometry && (!o.material || !o.material.transparent)) cibles.push(o); });
    const o3 = new T.Vector3(), d3 = new T.Vector3();
    const dessus = (v, dist) => { const [x, y, z, nx, ny, nz] = v; o3.set(x, y, z).addScaledVector(d3.set(nx, ny, nz), dist); d3.set(-nx, -ny, -nz); rc.set(o3, d3); rc.far = dist; const h = rc.intersectObjects(cibles, false); return h.length && h[0].distance < dist - .03; };
    const adosse = v => { // face plaquée dos à dos contre une face de sens opposé : invisible
      const [x, y, z, nx, ny, nz] = v, d = -(nx * x + ny * y + nz * z), k0 = Math.round(-nx * 20) + '|' + Math.round(-ny * 20) + '|' + Math.round(-nz * 20) + '|';
      for (const dd of [-1, 0, 1]) { const l = B.get(k0 + (Math.round(d / .01) + dd)); if (l) for (const t of l) if (x >= t.x0 - .03 && x <= t.x1 + .03 && y >= t.y0 - .03 && y <= t.y1 + .03 && z >= t.z0 - .03 && z <= t.z1 + .03) return true; }
      return false; };
    const visible = v => !adosse(v) && !dessus(v, .25);
    const gv = [...groupes].filter(([k, v]) => v.pts.some(visible));
    return { tris: tris.length, total: groupes.size, g: gv.map(([k, v]) => { const vp = v.pts.filter(visible); return k + ' ×' + v.n + ' ' + v.bb + ' visibles ' + vp.length + '/' + v.pts.length + ' ex (' + vp[0].slice(0, 3).map(q => q.toFixed(1)).join(', ') + ') n(' + vp[0].slice(3, 6).map(q => q.toFixed(0)).join(',') + ')'; }), e: [...enfouis].map(([k, v]) => k + ' ×' + v.n + ' ' + v.ex) };
  });
  const tous = r.g.concat(r.e);
  if (process.env.DIAG) console.log(r.tris + ' triangles\n' + tous.sort((p, q) => 0).slice(0, +process.env.DIAG || 40).join('\n'));
  verifier(r.tris > 20000, `scène trop vide pour l'analyse (${r.tris} triangles)`);
  verifier(tous.length === 0, `${tous.length} défaut(s) de surface : ${tous.slice(0, 5).join(' ; ')}`);
  return `${r.tris} triangles analysés : ni faces confondues, ni surfaces sans décalage, ni objets sous le sol`;
};
module.exports.titre = 'mécanicien (textures) : surfaces superposées, décalages, objets sous le sol';
module.exports.appareil = 'bureau';
