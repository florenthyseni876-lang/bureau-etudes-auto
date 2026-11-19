'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes, attendreCondition } = require('../outils.js');

// Mode Mécanicien (immobilier) : bâtiments à vendre sur la carte, achat d'une maison (comptant), d'un garage (à crédit,
// puis travail à son compte avec un client), d'une usine (fondation de sa marque), charges hebdomadaires, revente.
module.exports = async function mecaImmo(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await page.evaluate(() => { try { localStorage.removeItem('bea.meca.v1'); } catch (e) {} });
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && typeof MWC !== 'undefined' && window.__mwi && window.__mwj, null, { timeout: 15000 });
  await page.evaluate(() => { if (typeof MWG !== 'undefined') MWG.set({ classic: true }); });
  await attendre(600);
  const ev = (f, a) => page.evaluate(f, a);
  const fermer = async () => { await ev(() => __mw.closePanel()); await attendre(100); };
  const ouvrir = async (id, bouton) => {
    await ev(zid => { const z = __mw.zone(zid), p = z.accueil || z.porte; __mw.teleport(p.x, p.z, Math.atan2(z.n.x, z.n.z)); }, id);
    await attendre(350);
    await page.keyboard.press('e');
    await attendreVisible(page, '.mw-pn', `E devant « ${id} » n'ouvre pas de panneau`);
    if (bouton) await cliquer(page, `[data-mw="${bouton}"]`, `bouton « ${bouton} » absent de la fiche de ${id}`);
  };

  // 1. les bâtiments existent, sont libres, sans chevauchement, avec leur équipement
  const info = await ev(() => {
    const ids = ['loge1', 'loge2', 'loge3', 'loge4', 'garage5', 'garage6', 'garage7', 'usine1', 'usine2'];
    const Z = __mw.zones, ov = [];
    for (const id of ids) {
      const z = __mw.zone(id);
      for (const q of Z) if (q !== z && Math.abs(z.x - q.x) < (z.w + q.w) / 2 + 2 && Math.abs(z.z - q.z) < (z.d + q.d) / 2 + 2) ov.push(id + '/' + q.id);
      for (const r of [-150, 0, 150]) {
        if (Math.abs(z.x - r) < z.w / 2 + 11 || Math.abs(z.z - r) < z.d / 2 + 11) ov.push(id + '/rue ' + r);
      }
    }
    return {
      ids: ids.map(id => !!__mw.zone(id)), ov, tags: ids.map(id => __mw.zone(id).mapTag), types: ids.map(id => __mw.zone(id).type),
      ponts: ['garage5', 'garage6', 'garage7'].map(id => { const z = __mw.zone(id); return [z.ponts.length, !!z.etabli, !!z.etagere, !!z.accueil]; }),
      nlog: __mwi.CAT.filter(p => p.kind === 'logement').length, ngar: __mwi.CAT.filter(p => p.kind === 'garage').length, nusi: __mwi.CAT.filter(p => p.kind === 'usine').length,
      sign: !!__mw.scene.getObjectByName('immo-panneaux'),
    };
  });
  verifier(info.ids.every(Boolean), 'une zone immobilière manque');
  verifier(!info.ov.length, `bâtiments qui chevauchent une rue ou un autre bâtiment : ${info.ov.join(', ')}`);
  verifier(info.tags.every(t => t === 'À vendre'), `étiquettes de carte inattendues : ${info.tags}`);
  verifier(info.nlog >= 3 && info.ngar >= 3 && info.nusi >= 2, `catalogue trop court : ${info.nlog} logements, ${info.ngar} garages, ${info.nusi} usines`);
  verifier(JSON.stringify(info.ponts.map(p => p[0])) === '[2,3,4]' && info.ponts.every(p => p[1] && p[2] && p[3]), `ponts, établi, étagère ou accueil manquants : ${JSON.stringify(info.ponts)}`);
  verifier(info.sign, 'les panneaux « À vendre » ne sont pas dans la scène');

  // la carte (touche M) s'ouvre et les panneaux n'ajoutent presque aucun appel de dessin
  await page.keyboard.press('m');
  await attendreVisible(page, '#mwMap', "la touche M n'ouvre pas la carte");
  await page.keyboard.press('m');
  await attendre(200);
  const calls = await ev(() => { __mw.teleport(-115, 150, 0, 0); return null; }).then(() => attendre(500)).then(() => ev(() => __mw.renderer().info.render.calls));
  verifier(calls > 5 && calls < 400, `nombre d'appels de dessin inattendu près des maisons : ${calls}`);

  // 2. se mettre en situation : de l'argent, de la réputation, les diplômes, des compétences
  await ev(() => {
    __mw.S.money = 4000000; __mw.S.rep = 70;
    const c = MWC.state(); c.dipl = { cap: 1, bts: 1, ing: 1 };
    for (const k of ['entretien', 'freinage', 'liaison', 'moteur', 'transmission', 'electricite', 'diagnostic']) __mw.S.xp[k] = 2600;
  });

  // 3. conditions : sans réputation, la villa est refusée
  await ev(() => { __mw.S.rep = 5; });
  await ouvrir('loge4');
  verifier(await ev(() => document.querySelector('[data-mw="cash"]').disabled), "la villa devrait être refusée sans réputation");
  await verifierTextes(page, 'fiche de la villa');
  await fermer();
  await ev(() => { __mw.S.rep = 70; });

  // 4. maison de ville achetée comptant par la porte
  const m0 = await ev(() => __mw.S.money);
  await ouvrir('loge1', 'cash');
  await attendreCondition(page, () => __mwi.owned('loge1'), "l'achat de la maison échoue");
  const m1 = await ev(() => __mw.S.money);
  verifier(Math.abs((m0 - m1) - 62000) < 1, `prix payé inattendu : ${m0 - m1}`);
  verifier(await ev(() => __mw.zone('loge1').mapTag === 'À vous' && __mwi.state().owned.loge1.mode === 'achat'), 'la carte ou MW.S.immo ne reflètent pas l\'achat');
  await verifierTextes(page, 'fiche de la maison achetée');
  await fermer();

  // coffre personnel : ranger une pièce puis la reprendre
  const st = await ev(() => {
    __mw.S.inv.length = 0; __mw.S.inv.push({ k: 'neuve', id: 'huile', src: 'achat' });
    __mwi.stockMove('loge1', 'in', 0);
    const a = [__mw.S.inv.length, __mwi.state().stock.loge1.length];
    __mwi.stockMove('loge1', 'out', 0);
    return [a, __mw.S.inv.length, __mwi.state().stock.loge1.length];
  });
  verifier(JSON.stringify(st) === '[[0,1],1,0]', `coffre inattendu : ${JSON.stringify(st)}`);
  // le panneau du coffre s'ouvre
  await ouvrir('loge1', 'stock');
  await verifierTextes(page, 'coffre');
  await fermer();

  // sommeil : réveil plus tôt que 7 h 30
  await ev(() => { __mw.S.min = 1200; });
  await ouvrir('loge1', 'sleep');
  await attendreCondition(page, () => !__mw.paused && __mw.S.min < 450 && __mw.S.min > 300, 'le sommeil dans la maison échoue', 15000);
  const wake = await ev(() => __mw.S.min);
  verifier(wake >= 420 && wake <= 425, `réveil attendu à 7 h (420), obtenu ${wake}`);

  // 5. charges hebdomadaires
  const c0 = await ev(() => { __mw.S.day += 7; const m = __mw.S.money; __mw.emit('day', __mw.S.day); return m; });
  const c1 = await ev(() => __mw.S.money);
  verifier(Math.abs((c0 - c1) - 80) < 1, `charges hebdomadaires inattendues : ${c0 - c1} au lieu de 80`);

  // 6. garage à crédit, puis travail à son compte et premier client
  await ev(() => { __mw.S.money = 100000; });
  await ouvrir('garage5', 'credit');
  await attendreCondition(page, () => __mwi.owned('garage5'), "l'achat du garage à crédit échoue");
  const cr = await ev(() => { const c = __mws.get('garage5'); return { prets: c.prets.length, dette: c.prets.reduce((a, l) => a + l.rest, 0), perso: MWC.state().loans.length, argent: __mw.S.money }; });
  verifier(cr.prets === 1 && cr.dette > 30000 && cr.perso === 0, `crédit inattendu (le prêt est celui de la société du garage) : ${JSON.stringify(cr)}`);
  verifier(Math.abs(cr.argent - (100000 - 7600)) < 1, `l'apport de 20 % n'est pas le seul décaissement : ${cr.argent}`);
  await cliquer(page, '[data-mw="work"]', 'bouton « Travailler ici » absent');
  await attendreCondition(page, () => MWC.employer().id === 'proprio' && MWC.employer().zone === 'garage5', 'le garage acheté ne devient pas le lieu de travail');
  await fermer();
  await ev(() => { __mw.S.min = 600; });
  const cl = await ev(() => {
    const c = __mwj.spawn({ silencieux: true });
    if (!c) return null;
    const z = __mw.zone('garage5'), m = __mwj.mesh(c);
    return { zone: c.zone, taux: c.taux, pont: c.pont, mesh: !!m, mx: m && Math.abs(m.position.x - z.ponts[c.pont].x) < 1.5, compte: MWC.employer().compte, nj: __mwj.jobs().length };
  });
  verifier(cl && cl.zone === 'garage5' && cl.taux === 70 && cl.mesh && cl.mx, `le client ne se présente pas dans le garage acheté : ${JSON.stringify(cl)}`);
  verifier(cl.compte, 'le patron de son propre garage devrait être à son compte');
  // l'étagère et l'établi sont actifs à ce garage
  const eq = await ev(() => { const z = __mw.zone('garage5'); return [z.etabli, z.etagere].every(p => p && isFinite(p.x) && isFinite(p.z)); });
  verifier(eq, 'établi ou étagère du garage acheté mal placés');
  await ev(() => { __mwj.clear(); });
  // charges du garage (380 par semaine) et prêt quotidien
  const g0 = await ev(() => { const m = __mws.get('garage5').compte; __mw.S.day += 7; __mw.emit('day', __mw.S.day); return m; });
  const g1 = await ev(() => __mws.get('garage5').compte);
  verifier(g0 - g1 >= 380 + 80, `les charges du garage ne sont pas prélevées sur le compte du garage (${g0 - g1})`);

  // 7. « Mes biens » (touche B)
  await page.keyboard.press('b');
  await attendreVisible(page, '.mw-pn', 'la touche B n\'ouvre pas « Mes biens »');
  const lst = await ev(() => document.querySelector('.mw-pn').textContent);
  verifier(/Maison de ville/.test(lst) && /Atelier de la Rue Basse/.test(lst) && /Patrimoine/.test(lst), `« Mes biens » incomplet : ${lst.slice(0, 160)}`);
  await verifierTextes(page, 'Mes biens');
  await fermer();

  // 8. revente avec décote : maison (−15 %) et garage (−20 %)
  const v0 = await ev(() => __mw.S.money);
  await ouvrir('loge1', 'sell');
  await attendreCondition(page, () => !__mwi.owned('loge1'), 'la revente de la maison échoue');
  const v1 = await ev(() => __mw.S.money);
  verifier(Math.abs((v1 - v0) - Math.round(62000 * .85)) < 1, `prix de revente inattendu : ${v1 - v0}`);
  await ouvrir('garage5', 'sell');
  await attendreCondition(page, () => !__mwi.owned('garage5'), 'la revente du garage échoue');
  verifier(await ev(() => MWC.employer().id !== 'proprio' && __mw.zone('garage5').mapTag === 'À vendre'), "après la revente, le joueur travaille encore dans le garage ou l'étiquette de carte est fausse");
  await fermer();

  // 9. usine : achat comptant, puis fondation de sa marque avec un niveau d'usine plus élevé
  await ev(() => { __mw.S.money = 3000000; MWC.hire('patron'); });
  await ouvrir('usine1', 'cash');
  await attendreCondition(page, () => __mwi.owned('usine1'), "l'achat de l'usine échoue");
  await verifierTextes(page, "fiche de l'usine");
  verifier(await ev(() => !document.querySelector('[data-mw="found"]').disabled), 'la fondation devrait être possible dans l\'usine (patron, moteur niveau 7, réputation 70)');
  await page.fill('#mwBrand', 'Marque Test');
  await cliquer(page, '[data-mw="found"]');
  await attendreCondition(page, () => typeof G !== 'undefined' && G && G.fac === 3 && G.co === 'Marque Test', "la marque n'est pas fondée avec une usine de niveau 3", 20000);
  verifier(await ev(() => !__mwi.owned('usine1')), "l'usine apportée à la marque devrait quitter la liste des biens");
  return 'zones, achat comptant et à crédit, garage avec client, usine et marque, charges, revente';
};
module.exports.titre = 'mécanicien (immobilier) : maisons, garages, usines, charges, revente';
module.exports.appareil = 'bureau';
