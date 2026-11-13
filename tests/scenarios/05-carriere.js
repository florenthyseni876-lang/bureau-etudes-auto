'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes, verifierPasDeDebordement,
  demarrerCarriere, concevoirPremiereVoiture, lancerModele } = require('../outils.js');

// Carrière : fonder l'entreprise, concevoir une voiture en 7 étapes, la lancer, lire le journal.
module.exports = async function carriere(page, env) {
  await page.goto(env.url);
  await demarrerCarriere(page);
  await verifierPasDeDebordement(page, 'quartier général');

  const etapes = await concevoirPremiereVoiture(page);
  verifier(etapes.length === 7, `7 étapes attendues, ${etapes.length} parcourues`);

  await lancerModele(page);
  await verifierTextes(page, 'après le lancement');

  // Le quartier général reste utilisable après le journal.
  await attendreVisible(page, '[data-go="gamme"]', 'onglet « Ma gamme » absent après le lancement');
  await cliquer(page, '[data-go="gamme"]', 'onglet « Ma gamme » non cliquable');
  await attendre(400);
  await verifierTextes(page, 'Ma gamme');
  await verifierPasDeDebordement(page, 'Ma gamme');
  return `7 étapes, lancement de « ${await page.evaluate(() => window.__bea.G.models[0].name)} »`;
};


module.exports.titre = 'carrière : fondation, conception en 7 étapes, lancement, journal de presse';
module.exports.appareil = 'bureau';
