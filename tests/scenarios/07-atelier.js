'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes } = require('../outils.js');

// Atelier : enregistrer un moteur, prendre la place de l'ingénieur, saisir une pièce avec
// la touche E, la poser. En mode complet, le montage entier est terminé.
module.exports = async function atelier(page, env) {
  await page.goto(env.url);
  await cliquer(page, '#hFree', "impossible d'ouvrir le bureau d'études libre");
  await attendreVisible(page, '#tab_moteur', "l'onglet moteur n'apparaît pas");
  await cliquer(page, '#myEngSave', 'impossible d\'enregistrer le moteur et d\'ouvrir l\'atelier');
  await attendreVisible(page, '#atlTake', "l'atelier ne s'ouvre pas", 20000);
  await cliquer(page, '#atlTake', "impossible de prendre la place de l'ingénieur");
  await attendre(500);

  // Caméra de visée : place le regard sur un point du moteur (fonction de test dans la page).
  await page.evaluate(() => {
    window.__viser = v => {
      AT.mouse = null;
      const d = v.clone().sub(AT.pos);
      AT.yaw = Math.atan2(-d.x, -d.z);
      AT.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      AT.A.cam.position.copy(AT.pos);
      AT.A.cam.rotation.order = 'YXZ';
      AT.A.cam.rotation.set(AT.pitch, AT.yaw, 0);
      AT.A.cam.updateMatrixWorld(true);
    };
    window.__centre = q => new AT.T.Box3().setFromObject(q.g).getCenter(new AT.T.Vector3());
  });

  // 1. Saisir la pièce attendue avec la touche E.
  await page.evaluate(() => window.__viser(window.__centre(AT.steps[AT.step].parts[0])));
  await page.keyboard.press('e');
  await attendre(200);
  const saisie = await page.evaluate(() => AT.inv.includes(AT.steps[AT.step]));
  verifier(saisie, `la pièce « ${await page.evaluate(() => AT.steps[AT.step].parts[0].name)} » n'entre pas dans l'inventaire avec E`);

  // 2. La poser : viser l'emplacement fantôme, touche E.
  const k = await page.evaluate(() => AT.inv.indexOf(AT.steps[AT.step]));
  await page.keyboard.press(`Digit${k + 1}`);
  await attendre(150);
  const etape0 = await page.evaluate(() => AT.step);
  await page.evaluate(() => window.__viser(AT.ghost.position));
  await page.keyboard.press('e');
  await page.waitForFunction(e0 => AT.step !== e0 || AT.done, etape0, { timeout: 15000 })
    .catch(() => { throw new Error("la pièce saisie ne se pose pas avec la touche E"); });
  verifier(await page.evaluate(() => AT.step) === etape0 + 1 || await page.evaluate(() => AT.done),
    "la pose n'avance pas le montage");
  await verifierTextes(page, 'atelier');

  if (env.complet) {
    const fin = await page.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const log = [];
      const utiliser = () => {
        const r = AT.cv.getBoundingClientRect();
        atTap(r.left + r.width / 2, r.top + r.height / 2);
      };
      for (let n = 0; n < 120 && !AT.done; n++) {
        const s = AT.steps[AT.step], i0 = AT.step;
        if (AT.phase === 2) {
          const nb = AT.bolts.length;
          for (let q = 0; q < nb; q++) {
            const bo = AT.bolts.find(x => x.k === AT.boltI);
            if (!bo) break;
            window.__viser(bo.sp.position);
            utiliser();
          }
          if (AT.step === i0 && !AT.done) { log.push('vis ratées ' + s.parts[0].name); break; }
          continue;
        }
        let k = AT.inv.indexOf(s);
        if (k < 0) {
          for (const q of s.parts) q.g.visible = true;
          const c = window.__centre(s.parts[0]);
          if (Math.abs(c.x) > 1900) AT.pos.set(c.x - Math.sign(c.x) * 900, 1650, c.z);
          else AT.pos.set(c.x, 1650, Math.max(-1900, c.z + 1100));
          window.__viser(c);
          utiliser();
          AT.pos.set(0, 1650, 2100);
          k = AT.inv.indexOf(s);
          if (k < 0) {
            log.push('saisie ratée ' + s.parts[0].name);
            break;
          }
        }
        atSelect(k);
        window.__viser(AT.ghost.position);
        utiliser();
        for (let w = 0; w < 60 && AT.phase === 5; w++) await wait(60);
        if (AT.step === i0 && AT.phase !== 2 && !AT.done) {
          log.push('pose ratée ' + s.parts[0].name);
          break;
        }
      }
      return { done: AT.done, step: AT.step, of: AT.steps.length, log };
    });
    verifier(fin.done && !fin.log.length,
      `montage incomplet (étape ${fin.step} sur ${fin.of})${fin.log.length ? ' : ' + fin.log[0] : ''}`);
    await verifierTextes(page, 'atelier, montage terminé');
    return `montage complet (${fin.of} étapes)`;
  }
  return `pièce saisie et posée (${etape0 + 1} pièce(s) posée(s) sur ${await page.evaluate(() => AT.steps.length)})`;
};


module.exports.titre = "atelier : enregistrer un moteur, saisir et poser une pièce avec E";
module.exports.appareil = 'bureau';
