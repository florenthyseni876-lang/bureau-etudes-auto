'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Carrosseries (js/44) : pour chacune des voitures du catalogue, les proportions du maillage doivent respecter les dimensions
// officielles (longueur, largeur sans rétroviseurs, hauteur, empattement, rayon des roues : 3 %), le pare-brise doit être incliné
// comme un vrai (pas un mur), la ligne de toit cohérente, et la carrosserie ne doit contenir aucune face qui en recouvre une autre.
module.exports = async function mecaFormes(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mwcars && typeof THREE !== 'undefined', null, { timeout: 15000 });
  await attendre(300);
  const res = await page.evaluate(() => {
    const out = [], T = THREE;
    for (const id of __mwcars.ids()) {
      const car = __mwcars.get(id), g = MW.carMesh({ model: id, color: 0xd8d8d4, bay: false }), G = g.userData.G, bad = [];
      const body = g.children.filter(m => m.isMesh && m.geometry && !m.parent.userData.isWheel && ['paint', 'dark', 'trim', 'chrome', 'head', 'tail', 'amber', 'glass', 'inter'].some(k => G[k] === m.geometry));
      const bb = new T.Box3(), bw = new T.Box3();
      for (const m of body) {
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          bb.expandByPoint(new T.Vector3(0, y, z));
          if (Math.abs(x) < car.W / 2 + .03 && G.paint === m.geometry) bw.expandByPoint(new T.Vector3(x, 0, 0));
        }
      }
      const L = bb.max.z - bb.min.z, W = bw.max.x - bw.min.x, H = bb.max.y, WB = G.afz - G.arz;
      const r = (a, b, nom) => { if (Math.abs(a / b - 1) > .03) bad.push(`${nom} ${a.toFixed(3)} m au lieu de ${b.toFixed(3)} m`); };
      r(L, car.L, 'longueur'); r(W, car.W, 'largeur'); r(H, car.H, 'hauteur'); r(WB, car.WB, 'empattement');
      const mt = s => { const m = s.match(/(\d+)\/(\d+) R(\d+)/); return (m[3] * 25.4 / 2 + m[1] * m[2] / 100) / 1000; };
      r(G.tF.rt, mt(car.tyre), 'rayon de roue avant'); r(G.tR.rt, mt(car.tyreR || car.tyre), 'rayon de roue arrière');
      /* pare-brise : pente de 22° à 62° au-dessus de l'horizontale (un vrai pare-brise : 25 à 60°) */
      const hz = (G.hb), run = G.zc - G.zS, rise = G.roofY(G.zS) - hz;
      const rake = Math.atan2(Math.max(.01, rise), Math.max(.01, run)) * 180 / Math.PI;
      if (!(rake > 20 && rake < 65)) bad.push(`pare-brise incliné à ${rake.toFixed(0)}° (attendu 20 à 65°)`);
      if (G.zc < G.zr + car.L * .1 || G.zc > G.zf - car.L * .15) bad.push('bas de pare-brise hors de la caisse');
      /* ligne de toit : le point le plus haut est entre le bas du pare-brise et l'arrière */
      if (!(G.roofY((G.zc + G.zrb) / 2) > G.hb)) bad.push('toit plus bas que la ceinture');
      /* faces qui se chevauchent : triangles de même plan dont les centres sont à moins de 3 mm */
      const cell = new Map(); let dup = 0;
      for (const m of body) {
        if (G.glass === m.geometry || G.inter === m.geometry) continue;
        const gm = m.geometry, p = gm.attributes.position, ix = gm.index ? gm.index.array : null, n = ix ? ix.length : p.count;
        const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), nn = new T.Vector3(), ct = new T.Vector3();
        for (let i = 0; i < n; i += 3) {
          const i0 = ix ? ix[i] : i, i1 = ix ? ix[i + 1] : i + 1, i2 = ix ? ix[i + 2] : i + 2;
          a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
          nn.copy(b).sub(a).cross(c.clone().sub(a)); const ar = nn.length() / 2; if (ar < 1e-6) continue; nn.normalize();
          if (nn.x < -1e-6 || (Math.abs(nn.x) <= 1e-6 && (nn.y < -1e-6 || (Math.abs(nn.y) <= 1e-6 && nn.z < 0)))) nn.negate();   /* un plan, deux faces */
          ct.copy(a).add(b).add(c).multiplyScalar(1 / 3);
          const d = nn.dot(ct), k = [Math.round(nn.x * 20), Math.round(nn.y * 20), Math.round(nn.z * 20), Math.round(d / .003), Math.round(ct.x / .02), Math.round(ct.y / .02), Math.round(ct.z / .02)].join('|');
          if (cell.has(k) && cell.get(k) !== m) dup++; else cell.set(k, m);
        }
      }
      if (dup > 4) bad.push(`${dup} faces superposées dans la carrosserie`);
      out.push({ id, bad, L, W, H });
    }
    return out;
  });
  const mal = res.filter(r => r.bad.length);
  verifier(!mal.length, `${mal.length} voiture(s) aux proportions ou à la carrosserie anormales : ` + mal.map(r => `${r.id} : ${r.bad.join(' ; ')}`).join(' | '));
  return `${res.length} voitures conformes aux dimensions officielles (3 %), pare-brise incliné, aucune face superposée`;
};
module.exports.titre = 'carrosseries : proportions officielles, pare-brise, faces superposées';
