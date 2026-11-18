'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (garages) : repères visibles (PIÈCES, ÉTABLI, OUTILS, ACCUEIL) dans les 7 garages, parcours libre
// de l'entrée jusqu'à l'étagère, l'établi, la servante, le comptoir et chaque pont, rythme des clients selon le prestige,
// file d'attente à l'accueil, voitures cohérentes avec la clientèle (garages de départ et garages achetés).
module.exports = async function mecaGarages(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && typeof MWT !== 'undefined', null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  const IDS = ['garage1', 'garage2', 'garage3', 'garage4', 'garage5', 'garage6', 'garage7'];

  // 1. repères posés dans chaque garage
  const rep = await e(ids => ids.map(id => [id, (MWT.REPERES[id] || []).map(r => r.cat).sort().join(',')]), IDS);
  for (const [id, cats] of rep) verifier(cats === 'accueil,etabli,outils,pieces', `${id} : repères attendus (accueil, établi, outils, pièces), trouvés « ${cats} »`);

  // 2. parcours : de l'entrée à chaque poste, sans obstacle (grille de 0,25 m, rayon du joueur 0,42 m)
  const bad = await e(ids => {
    const out = [];
    for (const id of ids) {
      const z = __mw.zone(id), d = z._d, W = __mw.walls, r = .42, g = .25;
      const x0 = z.x - d.w / 2, x1 = z.x + d.w / 2, z0 = z.z - d.d / 2, z1 = z.z + d.d / 2;
      const nx = Math.ceil((x1 - x0) / g), nz = Math.ceil((z1 - z0) / g), seen = new Uint8Array(nx * nz);
      const free = (x, zz) => { if (x < x0 + .5 || x > x1 - .5 || zz < z0 + .5 || zz > z1 - .5) return false; return MWT.libre(x, zz, r); };
      const dr = z.loc(0, 1.8), q = [[Math.round((dr.x - x0) / g), Math.round((dr.z - z0) / g)]];
      seen[q[0][1] * nx + q[0][0]] = 1;
      for (let i = 0; i < q.length; i++) {
        const [a, b] = q[i];
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const na = a + da, nb = b + db; if (na < 0 || nb < 0 || na >= nx || nb >= nz || seen[nb * nx + na]) continue;
          if (!free(x0 + na * g, z0 + nb * g)) continue; seen[nb * nx + na] = 1; q.push([na, nb]);
        }
      }
      if (q.length < 400) out.push(id + ' : zone accessible trop petite (' + q.length + ')');
      const atteint = (x, zz, rad) => { for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) if (seen[b * nx + a] && Math.hypot(x0 + a * g - x, z0 + b * g - zz) <= rad) return true; return false; };
      const n = z.n, cibles = [['étagère', z.etagere.x - n.x * 1.1, z.etagere.z - n.z * 1.1, 2.0], ['établi', z.etabli.x - n.x * 1.1, z.etabli.z - n.z * 1.1, 2.0],
        ['comptoir', z.accueil.x, z.accueil.z, 2.4], ['servante', z.loc(-d.w / 2 + 2.2, d.d * .3 + .8).x, z.loc(-d.w / 2 + 2.2, d.d * .3 + .8).z, 1.5]];
      z.ponts.forEach((p, i) => cibles.push(['pont ' + (i + 1), p.x, p.z, 4.0]));
      for (const [nom, x, zz, rad] of cibles) if (!atteint(x, zz, rad)) out.push(id + ' : ' + nom + ' inaccessible');
    }
    return out;
  }, IDS);
  verifier(!bad.length, 'parcours bloqué : ' + bad.join(' ; '));

  // 3. rythme des clients : le prestige reçoit moins souvent que le quartier
  const R = await e(() => { const r = __mwj.RYTHME; return { g1: r.garage1, g3: r.garage3, g4: r.garage4, g5: r.garage5, g7: r.garage7 }; });
  verifier(R.g3[0] > R.g1[1] / 2 && R.g3[0] > R.g1[0] && R.g4[0] > R.g1[0] && R.g7[0] > R.g5[0], 'les clients des garages de prestige ne sont pas plus espacés');

  // 4. file d'attente : un seul pont libre au niveau 1, le client suivant patiente puis passe
  const f = await e(() => {
    MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); const j = __mw.S.jobs; j.next = 1e12; j.file = [];
    __mwj.spawn({ tpl: 'vidange' });
    const un = __mwj.jobs().length; j.next = 0; __mw.emit('minute'); const enAttente = __mwj.filePending();
    __mwj.remove(__mwj.jobs()[0]); j.next = 1e12; __mw.emit('minute');
    return { un, enAttente, apres: __mwj.filePending(), voitures: __mwj.jobs().length };
  });
  verifier(f.un === 1 && f.enAttente === 1, `la file d'attente ne se forme pas (voitures ${f.un}, en attente ${f.enAttente})`);
  verifier(f.apres === 0 && f.voitures === 1, `le client en attente ne prend pas le pont libéré (file ${f.apres}, voitures ${f.voitures})`);
  // patience : un client en attente patiente plusieurs heures d'ouverture, garde sa place la nuit, puis repart s'il attend trop
  const pa = await e(() => {
    const j = __mw.S.jobs; __mw.S.min = 900; j.next = 1e12; j.file = [];
    j.next = 0; __mw.emit('minute'); j.next = 1e12; const w = j.file[0], la = () => j.file.includes(w) ? 1 : 0; const n0 = j.file.length;
    __mw.addMin(120); const apres5h = la(); // 17 h : toujours là
    __mw.addMin(120 + 660 + 240); j.next = 1e12; const lendemain = la(); // fermeture, nuit, lendemain 10 h (6 h d'ouverture d'attente) : revenu
    __mw.addMin(120); const parti = la(); // 12 h : plus de 7 h d'ouverture en tout, reparti
    return { n0, apres5h, lendemain, parti };
  });
  verifier(pa.n0 === 1 && pa.apres5h === 1 && pa.lendemain === 1 && pa.parti === 0, `patience des clients en attente incorrecte (${JSON.stringify(pa)})`);

  // 5. clientèle cohérente : dans chaque garage (achetés compris), la voiture vient du bon catalogue et le kilométrage suit le prestige
  const cl = await e(ids => {
    const out = [], sample = {};
    for (const id of ids) {
      __mwj.clear(); MWC.workAt(id); __mw.S.min = 600; __mw.S.jobs.next = 1e12;
      const mods = __mwj.noirData.MODELS[id] || __mwj.noirData.MODELS.garage1, kms = [];
      for (let i = 0; i < 4; i++) { const c = __mwj.spawn({ force: 1, silencieux: true }); if (!c) break; if (c.zone !== id) out.push(id + ' : voiture dans ' + c.zone);
        if (!mods.some(m => m[0] === c.marque)) out.push(id + ' : marque ' + c.marque + ' hors clientèle'); kms.push(c.km); __mwj.remove(c, true); }
      if (!kms.length) out.push(id + ' : aucun client');
      sample[id] = kms.length ? Math.max(...kms) : 0;
    }
    if (!(sample.garage4 < sample.garage1 * 1.1 || sample.garage4 < 90000)) out.push('Scuderia : kilométrages trop élevés');
    return out;
  }, IDS);
  verifier(!cl.length, 'clientèle incohérente : ' + cl.join(' ; '));

  // 6. rendu : appels de dessin raisonnables à l'intérieur du Grand Garage
  const calls = await e(() => { const z = __mw.zone('garage7'), q = z.loc(0, 3); __mw.teleport(q.x, q.z, z.ry, -.1); return 0; });
  await attendre(900);
  const n = await e(() => __mw.renderer().info.render.calls);
  verifier(n > 5 && n < 400, `nombre d'appels de dessin inattendu : ${n}`);
  return 'repères dans 7 garages, parcours libre vers 4 postes et tous les ponts, file d\'attente, clientèle cohérente (' + n + ' appels de dessin)';
};

module.exports.titre = 'mécanicien (garages) : repères, parcours, file d\'attente, clientèle, garages achetés';
