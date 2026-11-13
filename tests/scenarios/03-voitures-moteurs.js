'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes, valeursNonFinies } = require('../outils.js');

// Les 6 voitures de base et tous les moteurs tout prêts donnent des valeurs finies.
module.exports = async function voituresMoteurs(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hFree', "impossible d'ouvrir le bureau d'études libre");
  await attendreVisible(page, '#tab_moteur', "l'onglet moteur n'apparaît pas");
  const presets = await page.$$eval('#preset option', os => os.map(o => o.value));
  verifier(presets.length === 6, `6 voitures de base attendues, ${presets.length} trouvées`);
  const problemes = [];
  for (const k of presets) {
    await page.selectOption('#preset', k);
    await attendre(350);
    const bad = await valeursNonFinies(page);
    if (bad.length) problemes.push(`voiture « ${k} » : ${bad.join(', ')} non fini(s)`);
    await verifierTextes(page, `voiture de base « ${k} »`);
  }
  verifier(!problemes.length, problemes[0]);

  await page.selectOption('#preset', 'coupe');
  await attendre(300);
  const moteurs = await page.$$eval('#c_engSel option', os => os.map(o => o.value).filter(Boolean));
  verifier(moteurs.length > 0, 'aucun moteur tout prêt proposé');
  const mauvais = [];
  for (const k of moteurs) {
    await page.selectOption('#c_engSel', k);
    await attendre(150);
    const bad = await valeursNonFinies(page);
    if (bad.length) mauvais.push(`moteur ${k} : ${bad.join(', ')}`);
  }
  verifier(!mauvais.length, `valeurs non finies, ${mauvais[0]}${mauvais.length > 1 ? ` (et ${mauvais.length - 1} autre(s))` : ''}`);
  await verifierTextes(page, 'moteurs tout prêts');
  return `${presets.length} voitures de base et ${moteurs.length} moteurs tout prêts`;
};
module.exports.titre = 'voitures de base et moteurs tout prêts : valeurs finies';
module.exports.appareil = 'bureau';
