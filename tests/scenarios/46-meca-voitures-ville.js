'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (voitures de la ville) : chaque modèle du catalogue a sa carrosserie simplifiée (js/53c), opaque et aux dimensions de
// la fiche ; la circulation et les voitures garées les utilisent ; aucune voiture transparente.
module.exports = async function mecaVoituresVille(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwvie && window.__mwvc, null, { timeout: 15000 });
  await attendre(800);

  // 1. une forme par modèle, opaque, aux dimensions de la fiche
  const r = await page.evaluate(() => {
    const out = { modeles: 0, sansForme: [], transparent: [], dimensions: [], formes: new Set() };
    const mat = MWVC.material();
    out.matTransparent = !!(mat.transparent || mat.opacity < 1);
    for (const fiche of MWCARS.list) {
      const spec = MWVC.spec(fiche.id);
      const p = MWVC.parts(spec);
      const g = MWVC.merged(spec);
      out.modeles++;
      if (!p.paint.index.count || !p.glass.index.count || !g.index.count) out.sansForme.push(fiche.id);
      g.computeBoundingBox();
      const b = g.boundingBox;
      const L = b.max.z - b.min.z, W = b.max.x - b.min.x, H = b.max.y;
      const ecart = Math.abs(L - spec.L) > .35 || Math.abs(W - spec.W) > .35 || Math.abs(H - spec.H) > .12;
      if (ecart) {
        const mesure = `${L.toFixed(2)}×${W.toFixed(2)}×${H.toFixed(2)}`;
        out.dimensions.push(`${fiche.id} : ${mesure} pour ${spec.L}×${spec.W}×${spec.H}`);
      }
      if (!g.attributes.aPaint || !g.attributes.color) out.transparent.push(fiche.id);
    }
    out.geometries = MWVC.count();
    return { ...out, formes: undefined };
  });
  verifier(r.modeles >= 20, `catalogue trop petit pour le test (${r.modeles} modèles)`);
  verifier(!r.matTransparent, 'le matériau des voitures de la ville est transparent');
  verifier(r.sansForme.length === 0, `modèles sans carrosserie complète (peinture + vitres) : ${r.sansForme.slice(0, 5).join(', ')}`);
  verifier(r.dimensions.length === 0, `carrosseries aux mauvaises dimensions : ${r.dimensions.slice(0, 3).join(' ; ')}`);
  verifier(r.geometries >= r.modeles, `une forme par modèle attendue : ${r.geometries} formes pour ${r.modeles} modèles`);

  // 2. la circulation : une carrosserie par modèle de la flotte, matériau opaque, voitures présentes
  await page.evaluate(() => { MWD.setQuality('haute', false); __mw.S.min = 12 * 60; __mw.teleport(-26, 9, -1.57, 0); });
  await page.waitForFunction(() => __mwvie.stats().cars >= 4, null, { timeout: 60000 });
  const f = await page.evaluate(() => {
    const flotte = __mwvie.fleet();
    const corps = [];
    __mw.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.attributes.aPaint) corps.push({ transparent: !!o.material.transparent, n: o.count }); });
    return { flotte, corps, ids: new Set(flotte.map(m => m.id)).size };
  });
  verifier(f.flotte.length >= 6 && f.flotte.length <= 12, `flotte de la circulation inattendue : ${f.flotte.length} modèles`);
  verifier(f.ids === f.flotte.length, 'deux voitures de la flotte partagent le même modèle');
  verifier(f.corps.length === f.flotte.length, `un maillage de carrosserie par modèle attendu : ${f.corps.length} pour ${f.flotte.length}`);
  verifier(f.corps.every(c => !c.transparent), 'une carrosserie de la circulation est transparente');

  // 3. voitures garées : des modèles du catalogue, collider aux dimensions réelles
  const g = await page.evaluate(() => {
    const ids = new Set(MWCARS.list.map(c => c.id));
    const garees = MWD.rueGaree || [];
    const mauvais = garees.filter(p => !ids.has(p.id)).length;
    let excès = 0, manque = 0;
    for (const p of garees) {
      const longX = Math.abs(Math.sin(p.ry)) > .5;
      const demiX = (longX ? p.L : p.W) / 2, demiZ = (longX ? p.W : p.L) / 2;
      const murs = __mw.walls.filter(w => !w._v && w[0] <= p.x && w[2] >= p.x && w[1] <= p.z && w[3] >= p.z && (w[2] - w[0]) < 7 && (w[3] - w[1]) < 7);
      if (!murs.length) { manque++; continue; }
      for (const w of murs) { if ((w[2] - w[0]) / 2 - demiX > .3 || (w[3] - w[1]) / 2 - demiZ > .3) excès++; }
    }
    return { n: garees.length, mauvais, excès, manque };
  });
  verifier(g.n >= 8, `trop peu de voitures garées dans la rue (${g.n})`);
  verifier(g.mauvais === 0, `${g.mauvais} voiture(s) garée(s) sans modèle du catalogue`);
  verifier(g.manque === 0, `${g.manque} voiture(s) garée(s) sans collider`);
  verifier(g.excès === 0, `${g.excès} collider(s) de voiture garée dépassent de plus de 30 cm la carrosserie`);

  // 4. appels de dessin : la flotte reste dans le budget
  const n = await page.evaluate(() => {
    __mw.teleport(-26, 9, -1.57, 0);
    return new Promise(res => setTimeout(() => res(__mw.renderer().info.render.calls), 800));
  });
  verifier(n < 400, `trop d'appels de dessin avec la flotte : ${n}`);
  return `${r.modeles} modèles, ${f.flotte.length} dans la circulation, ${g.n} garées, ${n} appels de dessin`;
};
module.exports.titre = 'mécanicien (voitures de la ville) : une forme par modèle, opaques, collider exact';
module.exports.appareil = 'bureau';
