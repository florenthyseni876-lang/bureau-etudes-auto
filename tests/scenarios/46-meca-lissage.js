'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Carrosseries lissées (js/44b) : pour chaque voiture du catalogue,
//  1. la caisse est faite d'assez de tranches (balayage de l'avant à l'arrière) ;
//  2. elle est lisse : l'angle moyen entre les normales de deux sommets voisins reste faible ;
//  3. aucune pièce de carrosserie n'en traverse une autre : feux, calandre, vitres, poignées, plaques et roues ne s'enfoncent
//     pas dans la tôle (profondeur d'enfoncement au plus 6 mm), et les vitres restent à l'extérieur de l'habitacle.
const TRANCHES_MIN = 60;
const ANGLE_MOYEN_MAX = 14;     // degrés (l'ancienne coque, à 20 points par section, en faisait 18)
const ENFONCEMENT_MAX = 0.006;  // mètres

module.exports = async function mecaLissage(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mwcars && typeof MWBODY !== 'undefined', null, { timeout: 15000 });
  await attendre(300);
  const res = await page.evaluate(({ ENFONCEMENT_MAX }) => {
    const T = THREE, out = [];
    for (const id of __mwcars.ids()) {
      const g = MW.carMesh({ model: id, color: 0xd8d8d4, bay: false }), G = g.userData.G, bad = [];
      /* 1. tranches */
      const nTr = G.S.nTranches;
      /* 2. lissage : angle moyen entre normales de sommets reliés par une arête (coque + habitacle) */
      const li = MWBODY.lissage(G.S), moy = li.moyenne, pire = li.pire;
      /* 3. pièces qui s'enfoncent dans la tôle */
      const enfonce = {};
      const pieces = ['glass', 'head', 'tail', 'amber', 'chrome'];
      for (const k of pieces) {
        const p = G[k].attributes.position;
        let pireProf = 0;
        for (let i = 0; i < p.count; i++) {
          const pr = MWBODY.profondeur(G.S, p.getX(i), p.getY(i), p.getZ(i), k);
          if (pr > pireProf) pireProf = pr;
        }
        if (pireProf > ENFONCEMENT_MAX) enfonce[k] = pireProf;
      }
      /* roues : le pneu ne doit pas entrer dans la tôle (le passage de roue est creusé dans la coque) */
      for (const nom of ['wFL', 'wFR', 'wRL', 'wRR']) {
        const w = g.getObjectByName(nom), tire = w.children[0].geometry.attributes.position;
        let pireProf = 0;
        for (let i = 0; i < tire.count; i += 3) {
          const x = tire.getX(i) * (w.position.x < 0 ? -1 : 1) + w.position.x, y = tire.getY(i) + w.position.y, z = tire.getZ(i) + w.position.z;
          const pr = MWBODY.profondeur(G.S, x, y, z, 'roue');
          if (pr > pireProf) pireProf = pr;
        }
        if (pireProf > ENFONCEMENT_MAX) enfonce[nom] = pireProf;
      }
      if (nTr < 60) bad.push(`${nTr} tranches (minimum 60)`);
      for (const k in enfonce) bad.push(`${k} s'enfonce de ${(enfonce[k] * 1000).toFixed(0)} mm dans la tôle`);
      out.push({ id, bad, nTr, moy, pire });
    }
    return out;
  }, { ENFONCEMENT_MAX });
  const lisses = res.filter(r => r.moy > ANGLE_MOYEN_MAX);
  verifier(!lisses.length, `caisses pas assez lisses (angle moyen > ${ANGLE_MOYEN_MAX}°) : ` + lisses.map(r => `${r.id} ${r.moy.toFixed(1)}°`).join(', '));
  const mal = res.filter(r => r.bad.length);
  verifier(!mal.length, `${mal.length} voiture(s) : ` + mal.map(r => `${r.id} : ${r.bad.join(' ; ')}`).join(' | '));
  const moyenne = res.reduce((s, r) => s + r.moy, 0) / res.length;
  const tmin = Math.min(...res.map(r => r.nTr));
  return `${res.length} caisses lisses (angle moyen ${moyenne.toFixed(1)}° entre normales voisines), ${tmin} tranches au minimum, aucune pièce enfoncée dans la tôle`;
};
module.exports.titre = 'carrosseries : tranches, lissage des normales, pièces qui se traversent';
