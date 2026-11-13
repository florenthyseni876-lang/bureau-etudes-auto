'use strict';
const { attendreVisible, verifierTextes } = require('../outils.js');

// Accueil : la page se charge et propose les deux modes.
module.exports = async function accueil(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hNew', "l'accueil ne s'affiche pas (« Nouvelle carrière » absent)");
  await attendreVisible(page, '#hFree', "l'accueil ne s'affiche pas (« Bureau d'études libre » absent)");
  await verifierTextes(page, 'Accueil');
};
module.exports.titre = "accueil s'affiche sans erreur";
module.exports.appareil = 'bureau';
