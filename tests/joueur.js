'use strict';
// Aides pour jouer au mode Mécanicien comme un joueur (clavier réel, regard placé comme une souris).
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('./outils.js');
const SH = process.env.SHOTS || '/tmp/shots';

async function ouvrir(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined', null, { timeout: 20000 });
  await attendre(1200);
}
const ev = (page, f, a) => page.evaluate(f, a);
const prompt = page => page.evaluate(() => { const p = document.getElementById('mwPrompt'); return p && !p.hidden ? p.textContent : ''; });
const photo = (page, nom) => page.screenshot({ path: `${SH}/${nom}.png` });
// regarde un point du monde (x, z, hauteur y) depuis la position actuelle
const regarder = (page, x, z, y) => page.evaluate(([x, z, y]) => {
  const p = __mw.player(), dx = x - p.x, dz = z - p.z;
  __mw.teleport(p.x, p.z, Math.atan2(dx, dz), Math.atan2((y == null ? 1.5 : y) - 1.7, Math.hypot(dx, dz)));
}, [x, z, y]);
// marche au clavier (Z) vers une suite de points, en tournant la tête vers chacun ; s'arrête si bloqué
async function marcher(page, points, opts = {}) {
  const run = opts.courir;
  if (run) await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  let bloque = null;
  try {
    for (const [x, z] of points) {
      let last = null, fixe = 0, contourne = 0;
      for (let i = 0; i < 400; i++) {
        const r = await page.evaluate(([x, z]) => { const p = __mw.player(), dx = x - p.x, dz = z - p.z; __mw.teleport(p.x, p.z, Math.atan2(dx, dz), 0); return { x: p.x, z: p.z, d: Math.hypot(dx, dz) }; }, [x, z]);
        if (r.d < 1) break;
        if (process.env.DBGW) console.log('  w', r.x.toFixed(2), r.z.toFixed(2), r.d.toFixed(1)); if (last && Math.hypot(r.x - last.x, r.z - last.z) < .05) fixe++; else fixe = 0;
        if (fixe > 4) {
          if (++contourne > 6) { bloque = { vers: [x, z], pos: [+r.x.toFixed(1), +r.z.toFixed(1)] }; break; }
          const k = contourne % 2 ? 'd' : 'a'; await page.keyboard.down(k); await attendre(700 + 300 * contourne); await page.keyboard.up(k); fixe = 0;
        }
        last = r;
        await attendre(150);
      }
      if (bloque) break;
    }
  } finally { await page.keyboard.up('w'); if (run) await page.keyboard.up('Shift'); }
  return bloque;
}
// va au comptoir/point d'une zone en passant par la porte
async function allerPorte(page, zoneId) {
  const z = await page.evaluate(id => { const z = __mw.zone(id); return { porte: z.porte, n: z.n, door: z.door }; }, zoneId);
  return marcher(page, [[z.porte.x - z.n.x * 2, z.porte.z - z.n.z * 2], [z.porte.x + z.n.x * 1.5, z.porte.z + z.n.z * 1.5]]);
}
module.exports = { SH, ouvrir, ev, prompt, photo, regarder, marcher, allerPorte, attendre, attendreVisible, attendreCondition, cliquer, verifier };
