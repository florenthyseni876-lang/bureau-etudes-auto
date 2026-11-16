'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes, attendreCondition } = require('../outils.js');

// Mode Mécanicien (intérieurs des logements) : entrer par la porte (studio, maison, pavillon, villa), lit (dormir),
// coffre (ranger et reprendre), bureau (carrière, biens, carnet), garage privé (voitures visibles, prendre une voiture,
// grille pour un logement loué), décor qui suit la progression, fiche d'achat avec plan, sortie, appels de dessin.
module.exports = async function mecaLogements(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await page.evaluate(() => { try { localStorage.removeItem('bea.meca.v1'); } catch (e) {} });
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && typeof MWC !== 'undefined' && window.__mwi && window.__mwl && window.__mwj, null, { timeout: 15000 });
  await page.evaluate(() => { if (typeof MWG !== 'undefined') MWG.set({ classic: true }); });
  await attendre(600);
  const ev = (f, a) => page.evaluate(f, a);
  const fermer = async () => { await ev(() => __mw.closePanel()); await attendre(100); };
  const prompt = () => ev(() => document.getElementById('mwPrompt').textContent);

  // se placer devant un meuble d'un intérieur (à 1,4 m, face au meuble) ; renvoie la distance réelle
  const devant = async (id, type, rang = 0, dist = 1.4, lat = 0) => {
    await ev(([id, type, rang, dist, lat]) => {
      const L = __mwl.lay[id], it = L.items.filter(i => i[0] === type)[rang], z = __mw.zone(id), n = z.n, ry0 = Math.atan2(n.x, n.z), t = { x: Math.cos(ry0), z: -Math.sin(ry0) };
      const fr = [[0, 1], [1, 0], [0, -1], [-1, 0]][it[3]], lx = it[1] + fr[0] * dist - fr[1] * lat, lz = it[2] + fr[1] * dist + fr[0] * lat;
      const x = z.door.x + t.x * lx + n.x * lz, zz = z.door.z + t.z * lx + n.z * lz;
      const dx = it[1] - lx, dz = it[2] - lz, wx = t.x * dx + n.x * dz, wz = t.z * dx + n.z * dz;
      __mw.teleport(x, zz, Math.atan2(wx, wz), 0.05);
    }, [id, type, rang, dist, lat]);
    await attendre(450);
  };

  // 1. situation : de l'argent, de la réputation, des diplômes, quelques trophées
  await ev(() => {
    __mw.S.money = 4000000; __mw.S.rep = 70;
    const c = MWC.state(); c.dipl = { cap: 1, bts: 1 }; c.stats.jobs = 12;
    for (const k of ['entretien', 'freinage', 'liaison', 'moteur', 'transmission', 'electricite', 'diagnostic']) __mw.S.xp[k] = 2600;
  });

  // 2. fiche d'achat : plan, surface, avantages chiffrés, charges
  await ev(() => { const z = __mw.zone('loge4'); __mw.teleport(z.porte.x, z.porte.z, Math.atan2(z.n.x, z.n.z)); });
  await attendre(350);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "la porte de la villa n'ouvre pas la fiche");
  const fiche = await ev(() => ({ img: !!document.querySelector('.mw-pn img.mw-plan, .mw-pn .mw-plan img'), w: document.querySelector('.mw-pn .mw-plan img') ? document.querySelector('.mw-pn .mw-plan img').naturalWidth : 0, txt: document.querySelector('.mw-pn').textContent }));
  verifier(fiche.img && fiche.w > 100, 'la fiche de la villa ne montre pas le plan du logement');
  verifier(/Surface/.test(fiche.txt) && /m²/.test(fiche.txt) && /Charges par semaine/.test(fiche.txt) && /Garage privé : 4 voitures/.test(fiche.txt) && /Prestige/.test(fiche.txt), `fiche d'achat incomplète : ${fiche.txt.slice(0, 200)}`);
  await verifierTextes(page, 'fiche de la villa');
  await fermer();
  verifier(await ev(() => { const o = __mwl.info('loge4'), p = __mwl.info('loge1'), s = __mwl.info('appart'); return o.surface > p.surface && p.surface > s.surface && o.pieces > p.pieces && o.places === 4; }), "les surfaces ne croissent pas du studio à la villa");

  // 3. le studio : entrer par la porte
  verifier(await ev(() => !__mwl.state('appart').built), "l'intérieur du studio est construit avant qu'on y entre");
  await ev(() => { const z = __mw.zone('appart'); __mw.teleport(z.porte.x, z.porte.z, Math.atan2(z.n.x, z.n.z)); });
  await attendre(350);
  await page.keyboard.press('e');
  await attendreVisible(page, '[data-mw="enter"]', "la porte du studio ne propose pas d'entrer");
  await cliquer(page, '[data-mw="enter"]');
  await attendreCondition(page, () => __mwl.inside() === 'appart', "on n'entre pas dans le studio", 8000);
  const st = await ev(() => { const s = __mwl.state('appart'); return { vis: s.visible, built: s.built, inter: s.inter.join(','), col: s.colliders, eye: __mw.eyeY }; });
  verifier(st.built && st.vis && /bed/.test(st.inter) && /chest/.test(st.inter) && /desk/.test(st.inter) && /out/.test(st.inter), `studio mal équipé : ${JSON.stringify(st)}`);
  verifier(st.col > 20 && st.eye > 2, `colliders ou hauteur des yeux du studio inattendus : ${JSON.stringify(st)}`);
  verifier(await ev(() => { const z = __mw.zone('appart'), p = __mw.player(); return p.zone === 'appart' && Math.hypot(p.x - z.door.x, p.z - z.door.z) < 4; }), 'le joueur entré n\'est pas dans l\'emprise du studio');

  // studio : coffre (ranger puis reprendre), bureau, lit
  await devant('appart', 'chest');
  verifier(/Coffre/.test(await prompt()), `pas d'invite devant le coffre du studio : « ${await prompt()} »`);
  await ev(() => { __mw.S.inv.length = 0; __mw.S.inv.push({ k: 'neuve', id: 'huile', src: 'achat' }); });
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "E devant le coffre du studio n'ouvre pas de panneau");
  await verifierTextes(page, 'coffre du studio');
  await fermer();
  const cf = await ev(() => { __mwi.stockMove('appart', 'in', 0); const a = [__mw.S.inv.length, __mwi.state().stock.appart.length]; __mwi.stockMove('appart', 'out', 0); return [a, __mw.S.inv.length, __mwi.state().stock.appart.length]; });
  verifier(JSON.stringify(cf) === '[[0,1],1,0]', `coffre du studio inattendu : ${JSON.stringify(cf)}`);
  await devant('appart', 'desk');
  verifier(/Bureau/.test(await prompt()), `pas d'invite devant le bureau : « ${await prompt()} »`);
  await page.keyboard.press('e');
  await attendreVisible(page, '[data-mw="biens"]', 'le bureau du studio ne propose pas « Mes biens »');
  verifier(await ev(() => !!document.querySelector('[data-mw="car"]') && !!document.querySelector('[data-mw="carnet"]')), 'le bureau ne propose pas la carrière et le carnet');
  await cliquer(page, '[data-mw="biens"]');
  await attendreCondition(page, () => /Mes biens/.test(document.querySelector('.mw-pn').textContent), '« Mes biens » ne s\'ouvre pas depuis le bureau');
  await fermer();
  await devant('appart', 'bed', 0, .3, -1.5);
  verifier(/Lit/.test(await prompt()), `pas d'invite devant le lit : « ${await prompt()} »`);
  await ev(() => { __mw.S.min = 1250; });
  await page.keyboard.press('e');
  await attendreVisible(page, '[data-mw="sleep"]', 'le lit ne propose pas de dormir le soir');
  await cliquer(page, '[data-mw="sleep"]');
  await attendreCondition(page, () => !__mw.paused && __mw.S.min >= 440 && __mw.S.min <= 460, 'le sommeil dans le studio échoue (réveil à 7 h 30 attendu)', 15000);
  // décor : 2 diplômes, des trophées (12 voitures rendues), la maquette de la voiture actuelle
  const dc = await ev(() => __mwl.state('appart').decor);
  verifier(dc.diplomes === 2 && dc.trophees >= 2 && dc.maquettes >= 1, `décor du studio inattendu : ${JSON.stringify(dc)}`);
  // sortie par la porte
  await ev(() => { const z = __mw.zone('appart'), n = z.n, ry0 = Math.atan2(n.x, n.z); __mw.teleport(z.door.x + n.x * 1.5, z.door.z + n.z * 1.5, ry0 + Math.PI, 0); });
  await attendre(450);
  verifier(/Sortir/.test(await prompt()), `pas d'invite « Sortir » à l'intérieur : « ${await prompt()} »`);
  await page.keyboard.press('e');
  await attendreCondition(page, () => __mwl.inside() === null, 'la sortie du studio échoue', 5000);
  verifier(await ev(() => { const z = __mw.zone('appart'), p = __mw.player(); return Math.hypot(p.x - z.porte.x, p.z - z.porte.z) < 1.5 && !__mwl.state('appart').visible && !__mw.eyeY; }), 'après la sortie : mauvaise position, intérieur encore visible ou yeux restés en hauteur');

  // 4. achats : on n'entre pas dans un logement qui n'est pas à soi
  verifier(await ev(() => __mwl.enter('loge1') === false && __mwl.inside() === null), 'on peut entrer dans un logement non acheté');
  await ev(() => { for (const id of ['loge1', 'loge3']) __mwi.buy(id, 'cash'); __mwi.buy('loge2', 'rent'); });
  verifier(await ev(() => __mwi.owned('loge1') && __mwi.owned('loge2') && __mwi.owned('loge3')), "les achats et la location échouent");

  // 5. maison de ville : bouton « Entrer chez moi » de la fiche, coffre, garage privé d'une place
  await ev(() => { const z = __mw.zone('loge1'); __mw.teleport(z.porte.x, z.porte.z, Math.atan2(z.n.x, z.n.z)); });
  await attendre(350);
  await page.keyboard.press('e');
  await attendreVisible(page, '[data-mw="enter"]', "la fiche de la maison achetée ne propose pas d'entrer");
  await cliquer(page, '[data-mw="enter"]');
  await attendreCondition(page, () => __mwl.inside() === 'loge1', "on n'entre pas dans la maison de ville", 8000);
  await devant('loge1', 'chest');
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', 'le coffre de la maison ne s\'ouvre pas');
  { const tx = await ev(() => document.querySelector('.mw-pn').textContent); verifier(/0\/8/.test(tx), 'le coffre de la maison devrait avoir 8 places : ' + tx.slice(0, 120)); }
  await fermer();
  verifier(await ev(() => __mwl.state('loge1').nbVoitures === 0), 'des voitures garées alors que le garage est vide');

  // 6. pavillon : deux places, voitures visibles, on prend celle qu'on veut
  await ev(() => {
    const o = __mwi.state();
    o.cars.length = 0;
    o.cars.push({ id: 'a', nom: 'Citadine rouge', kind: 'citadine', color: 0xb03030 }, { id: 'b', nom: 'Berline bleue', kind: 'berline', color: 0x2a4a8a });
    MWC.setCar({ id: 'x', nom: 'Utilitaire', kind: 'utilitaire', color: 0xe0e0e0 });
  });
  await ev(() => __mwl.leave());
  await ev(() => { const z = __mw.zone('loge3'); __mw.teleport(z.porte.x, z.porte.z, Math.atan2(z.n.x, z.n.z)); });
  await attendre(350);
  await page.keyboard.press('e');
  await attendreVisible(page, '[data-mw="enter"]', "la fiche du pavillon ne propose pas d'entrer");
  await cliquer(page, '[data-mw="enter"]');
  await attendreCondition(page, () => __mwl.inside() === 'loge3', "on n'entre pas dans le pavillon", 8000);
  // la maison de ville (1 place) garde la 1re voiture garée, le pavillon la 2e
  const gar = await ev(() => ({ idx: __mwi.garageOf('loge3'), cars: __mwl.state('loge3').nbVoitures, inter: __mwl.state('loge3').inter.join(',') }));
  verifier(JSON.stringify(gar.idx) === '[1,2]' && gar.cars === 1 && /car0/.test(gar.inter) && /car1/.test(gar.inter), `garage privé du pavillon inattendu : ${JSON.stringify(gar)}`);
  const bay = await ev(() => { const L = __mwl.lay.loge3, z = __mw.zone('loge3'), n = z.n, ry0 = Math.atan2(n.x, n.z), t = { x: Math.cos(ry0), z: -Math.sin(ry0) }, b = L.bays[0];
    const lx = b[0], lz = b[1] - 3.0; /* au pied de la place, côté porte */
    __mw.teleport(z.door.x + t.x * lx + n.x * lz, z.door.z + t.z * lx + n.z * lz, Math.atan2(n.x, n.z), 0.05); return b; });
  await attendre(450);
  const pr = await prompt();
  // une voiture garée est devant la place 2 (indice 1 -> 1re place de ce garage = voiture 'b')
  verifier(/Prendre : Berline bleue/.test(pr), `invite de prise de voiture inattendue : « ${pr} »`);
  await page.keyboard.press('e');
  await attendreCondition(page, () => MWC.getCar().nom === 'Berline bleue' && __mwi.state().cars[1].nom === 'Utilitaire', 'la voiture garée n\'est pas échangée avec la voiture actuelle', 6000);
  await attendre(300);
  verifier(await ev(() => __mwl.state('loge3').nbVoitures === 1), 'la voiture rendue au garage n\'est pas visible');
  // la place libre (2e) permet de garer la voiture actuelle (on reprend la vieille voiture)
  await ev(() => { const L = __mwl.lay.loge3, z = __mw.zone('loge3'), n = z.n, ry0 = Math.atan2(n.x, n.z), t = { x: Math.cos(ry0), z: -Math.sin(ry0) }, b = L.bays[1];
    const lx = b[0], lz = b[1] - 3.0; __mw.teleport(z.door.x + t.x * lx + n.x * lz, z.door.z + t.z * lx + n.z * lz, Math.atan2(n.x, n.z), 0.05); });
  await attendre(450);
  const pl = await prompt();
  verifier(/garer ma Berline bleue/.test(pl), `invite de la place libre inattendue : « ${pl} »`);
  await page.keyboard.press('e');
  await attendreCondition(page, () => MWC.getCar().id === 'vieille' && __mwi.state().cars.length === 3, 'la voiture actuelle n\'est pas garée dans la place libre', 6000);
  await attendre(300);
  verifier(await ev(() => __mwl.state('loge3').nbVoitures === 2), 'la 2e voiture garée n\'est pas visible dans le garage');
  await ev(() => __mwl.leave());

  // 7. appartement loué : pas de garage privé (grille), mais coffre réduit et lit
  await ev(() => __mwl.enter('loge2'));
  await attendreCondition(page, () => __mwl.inside() === 'loge2', "on n'entre pas dans l'appartement loué", 8000);
  const lo = await ev(() => ({ inter: __mwl.state('loge2').inter.join(','), cars: __mwl.state('loge2').nbVoitures }));
  verifier(/gate/.test(lo.inter) && !/car0/.test(lo.inter) && lo.cars === 0, `appartement loué : le garage devrait être fermé : ${JSON.stringify(lo)}`);
  await devant('loge2', 'chest');
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', 'le coffre de l\'appartement ne s\'ouvre pas');
  { const tx = await ev(() => document.querySelector('.mw-pn').textContent); verifier(/0\/6/.test(tx), 'le coffre loué devrait avoir 6 places (moitié de 12) : ' + tx.slice(0, 120)); }
  await fermer();

  // 8. appels de dessin dedans : peu d'objets ajoutés
  const calls = await ev(() => __mw.renderer().info.render.calls);
  verifier(calls > 5 && calls < 400, `nombre d'appels de dessin inattendu dans l'appartement : ${calls}`);
  await verifierTextes(page, 'intérieur');
  await ev(() => __mwl.leave());

  // 9. la villa : pièces, 4 places, trophées et diplômes
  await ev(() => { __mwi.buy('loge4', 'cash'); const o = __mwi.state(); o.cars.length = 0; for (let i = 0; i < 4; i++) o.cars.push({ id: 'v' + i, nom: 'Voiture ' + i, kind: ['citadine', 'berline', 'suv', 'sport'][i], color: 0x808080 + i * 0x101010 }); });
  await ev(() => __mwl.enter('loge4'));
  await attendreCondition(page, () => __mwl.inside() === 'loge4', "on n'entre pas dans la villa", 8000);
  const vi = await ev(() => ({ s: __mwl.state('loge4'), ip: __mwl.info('loge4') }));
  verifier(vi.s.nbVoitures === 1 && /car0/.test(vi.s.inter) && /car3/.test(vi.s.inter) && vi.s.decor.diplomes === 2 && vi.ip.pieces >= 8, `villa inattendue : ${JSON.stringify(vi)}`);
  await ev(() => __mwl.leave());
  return 'entrer, dormir, coffre, bureau, garage privé, décor, fiche avec plan';
};
module.exports.titre = 'mécanicien (logements) : intérieurs, lit, coffre, bureau, garage privé';
module.exports.appareil = 'bureau';
