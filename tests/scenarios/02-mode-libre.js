'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes, verifierPasDeDebordement } = require('../outils.js');

const ONGLETS = ['moteur', 'carrosserie', 'transmission', 'trains', 'habitacle', 'essais'];

// Mode libre : les 6 onglets s'affichent et aucun texte suspect n'apparaît.
module.exports = async function modeLibre(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hFree', "impossible d'ouvrir le bureau d'études libre");
  await attendreVisible(page, '#tabs .tab', "les onglets n'apparaissent pas");
  const affiches = await page.$$eval('#tabs .tab', els => els.map(e => e.dataset.tab));
  verifier(affiches.length === 6 && ONGLETS.every(o => affiches.includes(o)),
    `6 onglets attendus, affichés : ${affiches.join(', ') || 'aucun'}`);
  for (const onglet of ONGLETS) {
    await cliquer(page, `#tab_${onglet}`, `onglet « ${onglet} » non cliquable`);
    await attendre(500);
    const actif = await page.getAttribute(`#tab_${onglet}`, 'aria-selected');
    verifier(actif === 'true', `l'onglet « ${onglet} » ne s'active pas`);
    await verifierTextes(page, `onglet « ${onglet} »`);
    await verifierPasDeDebordement(page, `onglet « ${onglet} »`);
  }
  // Vues du moteur et banc d'essai : mêmes contrôles de texte.
  await cliquer(page, '#tab_moteur', "retour à l'onglet moteur impossible");
  await attendre(400);
  for (const vue of ['cut', '2d', 'cyc', '3d']) {
    await cliquer(page, `[data-ev="${vue}"]`, `vue « ${vue} » du moteur non cliquable`);
    await attendre(400);
    await verifierTextes(page, `vue « ${vue} » du moteur`);
  }
  await cliquer(page, '#benchSweep', 'banc à inertie : bouton « Accélération à fond » absent');
  await attendre(2500);
  await verifierTextes(page, 'banc à inertie');
};
module.exports.titre = 'mode libre : 6 onglets, aucun texte suspect';
module.exports.appareil = 'bureau';
