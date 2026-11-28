'use strict';
const os = require('os');
const path = require('path');
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien — vue rapprochée (js/46z) : E sur un élément fait glisser la caméra vers un cadrage serré, la souris devient un
// viseur libre (clics réels sur la page), le retour est automatique quand la sous-tâche est finie ; étapes inutiles supprimées
// (bouchon et filtre dévissés d'un coup au cliquet, bougie vissée et serrée d'un coup). Captures dans BEA_CAPTURES (sinon dossier temporaire).
module.exports = async function mecaZoom(page, env) {
  const dossier = process.env.BEA_CAPTURES || os.tmpdir();
  const photo = nom => page.screenshot({ path: path.join(dossier, `zoom-${nom}.png`) });
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined' && typeof MWZ !== 'undefined' && window.__mwcars,
    null, { timeout: 15000 });
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);

  await e(() => {
    MWC.hire('meca');
    __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison']) __mw.S.xp[k] = 900;
    __mw.S.jobs.outils.cle_dyn = 1;
    MWG.set({ aide: 'on', classic: false, zoom: true });
    window.__g = [];                                   // gestes réussis (clé de chaque action), dans l'ordre
    MW.on('geste', (c, key) => window.__g.push(key));
  });
  verifier(await e(() => MWZ.state().on === false), 'la vue rapprochée est ouverte au départ');

  // ── aides ──
  const accueillir = async (tpl) => {
    await e(() => { MWG.release(); __mwj.clear(); __mw.S.inv.length = 0; });
    const ok = await e((tpl) => {
      for (let i = 0; i < 40; i++) {
        __mwj.clear(); __mwj.spawn({ tpl, force: true, rend: false });
        const c = __mwj.jobs()[0];
        if (!c) continue;
        if (tpl === 'bougies' && __mwcars.get(c.mdl).eng.fuel !== 'essence') continue;
        for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'etagere' });
        for (const t of ['cliquet', 'cle_filtre', 'cle_dyn', 'bidon', 'entonnoir', 'boulonneuse']) MWJ.toolTake(t);
        return true;
      }
      return false;
    }, tpl);
    verifier(ok, 'aucune voiture pour ' + tpl);
  };
  const pres = () => e(() => {   // près du pont, regard vers la voiture
    const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont];
    const x = p.x + Math.cos(p.ry) * 1.6, z = p.z - Math.sin(p.ry) * 1.6;
    __mw.teleport(x, z, Math.atan2(p.x - x, p.z - z), .1);
    MWG.ensure(c);
  });
  const viser = (id) => e((id) => {   // à côté de la cible, caméra braquée dessus
    const r = MWG.rig(), t = r.tg.find(q => q.id === id), v = new THREE.Vector3();
    const o = typeof t.o === 'function' ? t.o() : t.o;
    if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
    const p = r.p, side = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry));
    const x = v.x + side.x * .9, z = v.z + side.z * .9, dx = v.x - x, dz = v.z - z;
    __mw.teleport(x, z, Math.atan2(dx, dz), Math.atan2(v.y - 1.7, Math.hypot(dx, dz)));
  }, id);
  const attendreLevage = (haut) => attendreCondition(page, h => { const y = __mwj.meshY(__mwj.jobs()[0]); return h ? y > 1.6 : y < .3; },
    'le pont ne monte / ne descend pas', 60000, haut);
  // entre en vue rapprochée avec la touche E, la cible étant visée au centre de l'écran
  const entrerZoom = async (id) => {
    await viser(id);
    await attendreCondition(page, id => MWG.aim() && MWG.aim().t.id === id, `la cible « ${id} » n'est pas visée`, 20000, id);
    const avant = await e(() => ({ x: __mw.player().x, z: __mw.player().z }));
    await page.keyboard.press('e');
    await attendreCondition(page, () => MWZ.ready(), 'la caméra ne glisse pas vers le cadrage serré', 30000);
    await attendre(250);   // laisse dessiner les pastilles
    const q = await e(() => ({ cachees: MWZ.cachees(), chev: MWZ.chevauchements(), st: MWZ.state() }));
    verifier(q.cachees === 0, `vue rapprochée sur « ${id} » : la carrosserie cache ${q.cachees} point(s) du cadrage (angle ${JSON.stringify(q.st.zone)})`);
    verifier(q.chev === 0, `vue rapprochée sur « ${id} » : ${q.chev} paire(s) de pastilles se chevauchent`);
    return avant;
  };
  // clic réel sur une cible : le pointeur va sur sa position écran, appui maintenu jusqu'à ce que le geste soit fait
  const cliquerCible = async (id) => {
    const pos = await e(id => MWZ.screenOf(id), id);
    verifier(pos && !pos.derriere, `la cible « ${id} » n'est pas à l'écran`);
    await page.mouse.move(pos.x, pos.y);
    await attendreCondition(page, id => MWG.aim() && MWG.aim().t.id === id, `le pointeur ne vise pas « ${id} »`, 15000, id);
    const n0 = await e(() => window.__g.length);
    await page.mouse.down();
    await attendreCondition(page, n => window.__g.length > n, `le clic maintenu sur « ${id} » ne fait pas le geste`, 40000, n0);
    await page.mouse.up();
    return e(() => window.__g[window.__g.length - 1]);
  };
  const attendreRetour = (raison) => attendreCondition(page, () => !MWZ.active(), raison, 20000);
  const inactif = async (raison) => { await attendreRetour(raison); verifier(await e(() => !__mw.frozen), 'le joueur reste figé après le retour'); };

  // ═══ 1. VIDANGE COMPLÈTE EN VUE RAPPROCHÉE ═══
  await accueillir('vidange'); await pres();
  await attendre(400);
  await e(() => MWG.run('lift', 'raise'));
  await attendreLevage(true);
  await e(() => { MWG.run('bac', 'bacon'); });
  const avant = await entrerZoom('plug');
  const z1 = await e(() => ({ st: MWZ.state(), gele: __mw.frozen, pt: __mw.player(), points: document.querySelectorAll('.mgz-dot:not([hidden])').length,
    quitter: !!document.querySelector('.mgz-quit'), verrou: !!document.pointerLockElement }));
  verifier(z1.st.on && z1.st.k >= 1 && z1.gele, `entrée en vue rapprochée anormale (${JSON.stringify(z1.st)})`);
  verifier(Math.hypot(z1.pt.x - avant.x, z1.pt.z - avant.z) < .01, 'le joueur a bougé en entrant en vue rapprochée');
  verifier(z1.st.groupe.includes('plug') && z1.st.groupe.includes('filt'), `le groupe du cadrage ne contient pas le bouchon et le filtre : ${z1.st.groupe}`);
  verifier(z1.points >= 2 && z1.quitter, `points cliquables ou bouton « Retour » absents (${z1.points})`);
  await photo('vidange-1-cadrage');
  // un clic dans le vide ne fait rien ; le survol d'un point le met en évidence
  const pf = await e(() => MWZ.screenOf('filt'));
  await page.mouse.move(pf.x, pf.y);
  await attendreCondition(page, () => MWG.aim() && MWG.aim().t.id === 'filt' && document.querySelector('.mgz-dot.vise'), 'le point survolé n\'est pas mis en évidence', 15000);
  await photo('vidange-2-survol');
  // bouchon : UN seul clic maintenu le dévisse entièrement
  verifier(await cliquerCible('plug') === 'pl1', 'le bouchon ne se dévisse pas au premier clic');
  verifier(await e(() => __mwj.jobs()[0].g.o.plug === 0 && __mwj.jobs()[0].g.o.on === 1), 'le bouchon n\'est pas retiré d\'un coup au cliquet');
  verifier(await e(() => MWZ.active()), 'la vue rapprochée se ferme alors que le filtre reste à dévisser');
  // filtre : dévisser (un seul geste), huiler le joint, visser le neuf
  verifier(await cliquerCible('filt') === 'f1', 'le filtre ne se dévisse pas au premier clic');
  verifier(await e(() => __mwj.jobs()[0].g.o.filt === 'off'), 'le filtre n\'est pas déposé d\'un coup');
  verifier(await cliquerCible('filt') === 'fg', 'le joint du filtre neuf n\'est pas huilé');
  verifier(await cliquerCible('filt') === 'fs', 'le filtre neuf ne se visse pas');
  await photo('vidange-3-filtre-pose');
  // le bouchon attend la fin de l'écoulement (message), puis se revisse et se serre d'un seul geste
  await e(() => MWG.skip());
  await attendreCondition(page, () => __mwj.jobs()[0].g.o.on === 0, "l'huile ne finit pas de s'écouler", 20000);
  verifier(await cliquerCible('plug') === 'pl2', 'le bouchon ne se visse pas et ne se serre pas d\'un coup');
  await inactif('la vue rapprochée ne se ferme pas toute seule à la fin de la sous-tâche');
  await photo('vidange-4-retour');
  // le reste de la vidange, en vue normale, jusqu'au remplissage
  const reste = [];
  for (let n = 0; n < 40; n++) {
    const h = await e(() => { MWG.skip(); return MWG.nextHint(); });
    if (!h || h.key === 'door') break;
    verifier(!(await e(([i, k]) => MWG.run(i, k), [h.id, h.key])), `étape refusée : ${h.lab}`);
    reste.push(h.key);
    await pres();
    if (/^(raise|lower)$/.test(h.key)) await attendreLevage(h.key === 'raise');
  }
  const bil = await e(() => { const c = __mwj.jobs()[0]; return { done: c.done, bloc: MWG.blocage(c), gestes: window.__g.slice() }; });
  verifier(bil.done.huile === 1 && bil.done.filtre_huile === 1 && bil.bloc.length === 0, `vidange incomplète : ${JSON.stringify(bil)}`);
  const inutiles = bil.gestes.filter(k => ['pl0', 'pl3', 'f0'].includes(k));
  verifier(!inutiles.length, `des étapes supprimées reviennent : ${inutiles}`);
  const nVidange = bil.gestes.length;
  verifier(nVidange <= 17, `la vidange demande encore trop de gestes (${nVidange}) : ${bil.gestes.join(' ')}`);

  // ═══ 2. ROUE : écrous desserrés au sol, retour automatique, puis retirés et roue déposée ═══
  await accueillir('plaq_av'); await pres();
  await attendre(400);
  const nut = await e(() => MWG.rig().tg.filter(t => /^nut:FL:/.test(t.id)).map(t => t.id));
  verifier(nut.length >= 4, `écrous de la roue avant gauche introuvables (${nut.length})`);
  await entrerZoom(nut[0]);
  verifier((await e(() => MWZ.state().groupe)).length >= nut.length, 'tous les écrous ne sont pas dans le cadrage de la roue');
  await photo('roue-1-cadrage');
  for (const id of nut) await cliquerCible(id);
  await inactif('la vue rapprochée ne se ferme pas quand tous les écrous sont desserrés');
  verifier(await e(() => __mwj.jobs()[0].g.w.FL.n.every(x => x === 1)), 'les écrous ne sont pas tous desserrés');
  await e(() => MWG.run('lift', 'raise'));
  await attendreLevage(true);
  await pres();
  await entrerZoom(nut[0]);
  for (const id of nut) await cliquerCible(id);
  verifier(await cliquerCible('wheel:FL') === 'woFL', 'la roue ne se dépose pas au clic');
  verifier(await e(() => __mwj.jobs()[0].g.w.FL.o === 1), 'la roue n\'est pas déposée');
  await photo('roue-2-deposee');
  // clic droit : retour à la vue normale
  await page.mouse.click(300, 300, { button: 'right' });
  await inactif('le clic droit ne ramène pas la vue normale');

  // ═══ 3. BOUGIES : bobine + vis d'un geste, bougie vissée et serrée d'un geste, retour automatique ═══
  await accueillir('bougies'); await pres();
  await attendre(400);
  await e(() => MWG.run('hood', 'hopen'));
  await attendreCondition(page, () => !!MWG.rig().g.userData.bay && MWG.rig().tg.some(t => /^bp:/.test(t.id)), 'les bougies ne sont pas visées sous le capot', 20000);
  await attendre(500);
  const cyl = await e(() => MWG.rig().tg.filter(t => /^bp:/.test(t.id)).map(t => t.id));
  verifier(cyl.length >= 3, `bougies introuvables (${cyl.length})`);
  await e(() => { MWG.ensure(__mwj.jobs()[0]); });
  await entrerZoom(cyl[0]);
  await photo('bougies-1-cadrage');
  const cles = [];
  for (let tour = 0; tour < 40 && await e(() => MWZ.active()); tour++) {
    for (const id of cyl) {
      if (!await e(() => MWZ.active())) break;
      const encore = await e(id => MWG.acts(__mwj.jobs()[0]).some(a => a.id === id && !a.why && !/^bpi/.test(a.key) && a.exp), id);
      if (encore) cles.push(await cliquerCible(id));
    }
  }
  await inactif('la vue rapprochée ne se ferme pas à la fin des bougies');
  const bg = await e(() => { const c = __mwj.jobs()[0]; return { done: !!c.done.bougies, bloc: MWG.blocage(c), n: c.g.bp.st.length }; });
  verifier(bg.done && !bg.bloc.length, `bougies incomplètes : ${JSON.stringify(bg)} ${cles.join(' ')}`);
  verifier(cles.filter(k => /^bp\d+_5$/.test(k)).length === bg.n && !cles.some(k => /^bp\d+_[6-9]$/.test(k)), `gestes de bougie anormaux : ${cles.join(' ')}`);
  verifier(cles.length <= bg.n * 7, `trop de gestes pour les bougies (${cles.length} pour ${bg.n} cylindres)`);

  // ═══ 3 bis. AUTRES PIÈCES SOUS LE CAPOT : batterie, courroie d'accessoires, filtre à air (cadrage dégagé, pastilles lisibles) ═══
  const sousCapot = async (tpl, motif, nom) => {
    await accueillir(tpl); await pres();
    await attendre(400);
    await e(() => MWG.run('hood', 'hopen'));
    await attendreCondition(page, m => !!MWG.rig().g.userData.bay && MWG.rig().tg.some(t => new RegExp(m).test(t.id)), `${nom} : cibles introuvables sous le capot`, 20000, motif);
    await attendre(500);
    const id = await e(m => MWG.rig().tg.find(t => new RegExp(m).test(t.id)).id, motif);
    await entrerZoom(id);
    await photo('capot-' + nom);
    await page.keyboard.press('Escape');
    await inactif(`${nom} : Échap ne ramène pas la vue normale`);
  };
  await sousCapot('batterie', '^fx:batterie:0', 'batterie');
  await sousCapot('cr_acc', '^cr:belt', 'courroie');
  await sousCapot('filtres', '^fx:filtre_air:0', 'filtre-air');

  // ═══ 4. RÉGLAGE : mode classique, E fait le geste sans zoom ═══
  await accueillir('vidange'); await pres();
  await attendre(400);
  await e(() => { MWG.set({ zoom: false }); MWG.run('lift', 'raise'); });
  await attendreLevage(true);
  await e(() => MWG.run('bac', 'bacon'));
  await viser('plug');
  await attendreCondition(page, () => MWG.aim() && MWG.aim().t.id === 'plug', 'le bouchon n\'est pas visé (mode classique)', 20000);
  await page.keyboard.down('e');
  await attendreCondition(page, () => __mwj.jobs()[0].g.o.plug === 0, 'mode classique : maintenir E ne dévisse pas le bouchon', 60000);
  await page.keyboard.up('e');
  verifier(await e(() => !MWZ.active()), 'mode classique : la vue rapprochée s\'est ouverte malgré le réglage');
  return `vidange (${nVidange} gestes, bouchon et filtre d'un coup), roue (écrous, dépose), bougies (${cles.length} clics), retours automatique / clic droit, mode classique`;
};

module.exports.titre = 'mécanicien (vue rapprochée) : clics réels sur le bouchon, le filtre, la roue, les bougies ; retour automatique';
module.exports.appareil = 'bureau';
