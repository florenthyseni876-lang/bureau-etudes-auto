'use strict';
const { attendreVisible, attendreCondition, cliquer, verifier, verifierTextes } = require('../outils.js');

// Essai 400 m et essai d'endurance (150 000 km) vont au bout.
module.exports = async function essais(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hFree', "impossible d'ouvrir le bureau d'études libre");
  await attendreVisible(page, '#tab_essais', "l'onglet essais n'apparaît pas");
  await cliquer(page, '#tab_essais', "l'onglet essais n'est pas cliquable");
  await attendreVisible(page, '#run400', 'bouton « Lancer le 400 m » absent');

  await cliquer(page, '#run400', 'impossible de lancer le 400 m');
  await attendreCondition(page,
    () => { const t = (document.querySelector('#runMsg') || {}).textContent || ''; return !!t && !/en cours/.test(t); },
    'le 400 m ne se termine pas dans le temps imparti', 60000);
  const bilan400 = (await page.textContent('#runMsg')).trim();
  verifier(!/NaN|undefined|Infinity/.test(bilan400), `bilan du 400 m incohérent : « ${bilan400} »`);
  await verifierTextes(page, 'essai 400 m');

  await cliquer(page, '[data-ekm="150000"]', 'distance de 150 000 km non sélectionnable');
  await cliquer(page, '[data-esty="douce"]', 'conduite douce non sélectionnable');
  await cliquer(page, '#enduGo', "impossible de lancer l'endurance");
  await attendreVisible(page, '.endu-res', "l'endurance de 150 000 km ne rend pas de bilan", 90000);
  const bilan = (await page.textContent('.endu-res')).replace(/\s+/g, ' ').trim();
  verifier(bilan.length > 0, "bilan d'endurance vide");
  await verifierTextes(page, "essai d'endurance");
  return `400 m : ${bilan400.slice(0, 60)}`;
};
module.exports.titre = 'essais : 400 m et endurance 150 000 km';
module.exports.appareil = 'bureau';
