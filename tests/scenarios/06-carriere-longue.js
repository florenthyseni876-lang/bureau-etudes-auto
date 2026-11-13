'use strict';
const { verifier, verifierTextes, demarrerCarriere, concevoirPremiereVoiture, lancerModele } = require('../outils.js');

// Carrière longue : 40 ans simulés (160 trimestres), aucune valeur non finie.
// Lourd : ignoré en mode rapide.
module.exports = async function carriereLongue(page, env) {
  await page.goto(env.url);
  await demarrerCarriere(page);
  await concevoirPremiereVoiture(page);
  await lancerModele(page);

  const bilan = await page.evaluate(() => {
    const B = window.__bea;
    const G0 = B.G;
    const y0 = G0.y + G0.q / 4;
    const erreurs = [];
    const verifierG = () => {
      const G = B.G;
      for (const [k, v] of Object.entries(G)) {
        if (typeof v === 'number' && !isFinite(v)) erreurs.push(`G.${k}`);
      }
      for (const m of G.models) {
        for (const [k, v] of Object.entries(m.met || {})) {
          if (typeof v === 'number' && !isFinite(v)) erreurs.push(`${m.name}.${k}`);
        }
        if (!isFinite(m.sold) || !isFinite(m.price)) erreurs.push(`${m.name} ventes ou prix`);
      }
      return G;
    };
    let n = 0;
    for (let i = 0; i < 160 && !B.G.over && !erreurs.length; i++) {
      B.advance(1);
      n++;
      const G = verifierG();
      const l = document.querySelector('.lfx-close');
      if (l) l.click();
      if (erreurs.length) return { n, erreurs, y0, y1: G.y + G.q / 4, over: !!G.over };
    }
    const G = B.G;
    return { n, erreurs, y0, y1: G.y + G.q / 4, over: !!G.over, annee: G.y };
  });

  verifier(!bilan.erreurs.length, `valeur non finie après ${bilan.n} trimestres : ${bilan.erreurs[0]}`);
  if (!bilan.over) {
    const duree = bilan.y1 - bilan.y0;
    verifier(Math.abs(duree - 40) < 0.05, `40 ans attendus, ${duree.toFixed(2)} ans simulés`);
  }
  await page.evaluate(() => window.__bea.render());
  await verifierTextes(page, 'carrière longue, fin de partie');
  return bilan.over
    ? `partie terminée en ${bilan.annee} après ${bilan.n} trimestres, sans valeur non finie`
    : `40 ans simulés (jusqu'en ${bilan.annee}), sans valeur non finie`;
};
module.exports.titre = 'carrière longue : 40 ans simulés sans valeur non finie';
module.exports.appareil = 'bureau';
module.exports.lourd = true;
