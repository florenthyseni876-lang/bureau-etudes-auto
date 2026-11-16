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

// se place à côté d'une cible du rig et la regarde ; renvoie ce que le jeu considère comme visé
async function viser(page, id, opts = {}) {
  const essais = [[1.0, 0], [0.7, 0], [1.4, 0], [1.0, 1], [1.0, -1], [0.5, 0]];
  let aim = null;
  for (const [d, cote] of essais) {
    await page.evaluate(([id, d, cote]) => {
      const R = MWG.rig(), t = R.tg.find(q => q.id === id); if (!t) return;
      const v = new THREE.Vector3(), o = typeof t.o === 'function' ? t.o() : t.o;
      o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
      const c = new THREE.Vector3(); R.g.getWorldPosition(c);
      let ox = v.x - c.x, oz = v.z - c.z; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
      if (cote) { const t2 = ox; ox = -oz * cote; oz = t2 * cote; }
      const x = v.x + ox * d, z = v.z + oz * d, dx = v.x - x, dz = v.z - z;
      __mw.teleport(x, z, Math.atan2(dx, dz), Math.atan2(v.y - __mw.cam.position.y, Math.hypot(dx, dz)));
    }, [id, d, cote]);
    await attendre(120);
    await page.evaluate(([id]) => { const R = MWG.rig(), t = R.tg.find(q => q.id === id); if (!t) return; const v = new THREE.Vector3(), o = typeof t.o === 'function' ? t.o() : t.o; o.updateWorldMatrix(true, false); if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v); const p = __mw.player(), dx = v.x - p.x, dz = v.z - p.z; __mw.teleport(p.x, p.z, Math.atan2(dx, dz), Math.atan2(v.y - __mw.cam.position.y, Math.hypot(dx, dz))); }, [id]);
    await attendre(250);
    aim = await page.evaluate(() => { const A = MWG.aim(); return A ? A.t.id + ':' + A.a.key : null; });
    if (aim && aim.startsWith(id + ':')) return aim;
  }
  return aim;
}

// enregistre tous les messages affichés (toasts) pour les relire
async function espionner(page) {
  await page.evaluate(() => {
    if (window.__toasts) return; window.__toasts = [];
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('mw-t')) window.__toasts.push(n.className.replace('mw-t ', '') + ': ' + n.textContent); }))).observe(document.getElementById('mwRoot'), { childList: true, subtree: true });
  });
}
const toasts = async (page, vider = true) => page.evaluate(v => { const t = window.__toasts || []; if (v) window.__toasts = []; return t.slice(); }, vider);
const panneau = page => page.evaluate(() => { const p = document.querySelector('.mw-pn'); return p && !p.closest('[hidden]') ? p.innerText : null; });
const ficheAction = (page, a) => page.locator(`.mw-pn [data-mw="${a}"]`).click({ timeout: 4000 });

// Un tour de « joueur suivant l'aide » : renvoie une description de ce qu'il a fait (ou du blocage rencontré).
async function etapeAide(page, log) {
  let h = await page.evaluate(() => MWG.nextHint());
  if (!h) { // trop loin de la voiture : on y retourne à pied
    const p = await page.evaluate(() => { const c = __mwj.jobs()[0]; return c && __mw.zone(c.zone).ponts[c.pont]; });
    if (p) { await marcher(page, [[p.x + 2.2, p.z]]); await regarder(page, p.x, p.z, 0.7); await attendre(700); h = await page.evaluate(() => MWG.nextHint()); }
  }
  if (!h) return { fin: true };
  const etat = await page.evaluate(h => ({ outil: h.tool && h.tool !== 'main' ? MWJ.toolIdx(h.tool) : 0, tenu: MWG.tool && MWG.tool(), inv: __mw.S.inv.length }), h);
  // l'outil manque : servante
  if (h.tool && h.tool !== 'main' && etat.outil < 0) {
    const a = await viser(page, 'servante');
    if (!a || !a.startsWith('servante')) return { blocage: 'servante impossible à viser (' + a + ')', h };
    await page.keyboard.press('e'); await attendre(300);
    try { await ficheAction(page, 'need'); } catch (e) { return { blocage: "bouton « Prendre les outils de l'ordre » absent : " + (await panneau(page) || '').slice(0, 120), h }; }
    await attendre(200); await page.keyboard.press('Escape'); await attendre(300);
    return { fait: 'outils pris', h, toasts: await toasts(page) };
  }
  const a = await viser(page, h.id);
  if (!a || !a.startsWith(h.id + ':')) return { blocage: `cible « ${h.id} » impossible à viser (visé : ${a})`, h };
  // outil en main : touche de la case
  if (h.tool === 'main') { await page.keyboard.press('v'); await attendre(120); }
  else if (h.tool) {
    const slot = await page.evaluate(h => MWJ.toolIdx(h.tool), h);
    const key = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ')', '='][slot];
    await page.keyboard.press(key === ')' ? 'Digit0' : key); await attendre(150);
  }
  const avant = await page.evaluate(() => JSON.stringify(MWG.nextHint()));
  const invite = await prompt(page);
  await page.keyboard.down('e');
  let t0 = Date.now(), change = false;
  while (Date.now() - t0 < 15000) {
    await attendre(200);
    const now = await page.evaluate(() => { try { return JSON.stringify(MWG.nextHint()); } catch (e) { return 'x'; } });
    if (now !== avant) { change = true; break; }
  }
  await page.keyboard.up('e'); await attendre(150);
  if (h.key === 'door' && await panneau(page)) return { habitacle: true, h };
  return { fait: `${h.key} ${h.id}`, change, invite, h, toasts: await toasts(page) };
}

// va à l'étagère, prend les pièces de l'ordre (bouton « need »), revient
async function etagerePrendre(page) {
  const ez = await page.evaluate(() => { const z = __mw.zone('garage1'), e = z.etagere, n = z.n; return [e.x - n.x * 1.1, e.z - n.z * 1.1, e.x, e.z]; });
  const bloque = await marcher(page, [[ez[0], ez[1] - 1.5]]);
  await regarder(page, ez[2], ez[3], 1.0); await attendre(300);
  const inv = await prompt(page);
  await page.keyboard.press('e'); await attendre(400);
  const pn = await panneau(page);
  let besoin = true;
  try { await ficheAction(page, 'need'); } catch (e) { besoin = false; }
  await page.keyboard.press('Escape'); await attendre(300);
  return { bloque, invite: inv, panneau: pn && pn.slice(0, 300), besoin };
}
// travail complet suivant l'aide, jusqu'à l'habitacle. Renvoie {ok, log, blocage}
async function travailler(page, opts = {}) {
  const log = []; const max = opts.max || 80;
  let vides = 0;
  for (let n = 0; n < max; n++) {
    const r = await etapeAide(page);
    if (r.habitacle) return { ok: true, log };
    if (r.fin) {
      if (++vides > 14) return { ok: false, log, blocage: "plus d'étape proposée (aide muette) : " + JSON.stringify(await page.evaluate(() => MWG.blocage(__mwj.jobs()[0]))) };
      await attendre(6000); continue;
    }
    vides = 0;
    if (r.blocage) return { ok: false, log, blocage: r.blocage, h: r.h };
    log.push(`${r.fait}${r.change === false ? ' (SANS EFFET)' : ''}${r.toasts && r.toasts.length ? ' → ' + r.toasts.join(' | ').slice(0, 140) : ''}`);
  }
  return { ok: false, log, blocage: 'trop d\'étapes' };
}
module.exports = { viser, etagerePrendre, travailler, espionner, toasts, panneau, ficheAction, etapeAide, SH, ouvrir, ev, prompt, photo, regarder, marcher, allerPorte, attendre, attendreVisible, attendreCondition, cliquer, verifier };
