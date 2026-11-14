'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes } = require('../outils.js');

// Mode Mécanicien (clients au noir) : annonce, demande acceptée, voiture dans la cour, travail payé en liquide,
// bruit (surtout la nuit, le dimanche), plainte de la voisine, cadeau, dénonciation (amende, saisie, interdiction,
// avertissement puis licenciement chez l'employeur), auto-entrepreneur (plus de dénonciation), ancienne sauvegarde.
module.exports = async function mecaNoir(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await page.evaluate(() => { try { localStorage.removeItem('bea.meca.v1'); } catch (e) {} });
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && window.__mwn && typeof MWC !== 'undefined', null, { timeout: 15000 });
  await page.evaluate(() => { if (typeof MWG !== 'undefined') MWG.set({ classic: true }); }); // menus classiques de js/41 (gestes réalistes : scénario 16)
  await attendre(400);

  const e = (f, a) => page.evaluate(f, a);
  const appuyer = async (t) => { await page.keyboard.press(t); };
  const fermer = async () => { await e(() => __mw.closePanel()); await attendre(80); };
  const clic = async (a) => { await cliquer(page, `.mw-pn [data-mw="${a}"]`, `bouton ${a} absent`); await attendre(120); };
  const texte = () => e(() => (document.querySelector('.mw-pn') || {}).textContent || '');
  const argent = () => e(() => __mw.S.money);
  const jauge = () => e(() => __mwn.gauge());
  const ouvrirPoint = async (c, kind) => {
    await e(([cid, k]) => { const car = __mwj.jobs().find(x => x.id === cid); const o = __mwj.point(car, k); __mw.teleport(o.x, o.z, 0); }, [c, kind]);
    await attendreCondition(page, () => { const p = document.getElementById('mwPrompt'); return p && !p.hidden && /^\[E\]/.test(p.textContent); }, `aucune invite au point « ${kind} » de la cour`, 15000);
    await appuyer('e');
    await attendreVisible(page, '.mw-pn', `E n'ouvre pas le panneau au point « ${kind} »`);
  };
  await e(() => { __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; __mw.S.money = 5000; });

  // 0. la zone, le jour de la semaine dans l'horloge, l'ancienne sauvegarde sans données « noir »
  const z0 = await e(() => { const z = __mw.zone('cour'); return { ok: !!z, dans: __mw.zones.includes(z), pl: z && z.ponts.length, lib: z && z.libres, type: z && z.type, hors: !!__mw.zoneAt(-30, 40) && __mw.zoneAt(-30, 40).id }; });
  verifier(z0.ok && z0.dans && z0.pl === 2 && z0.lib === 1 && z0.type === 'cour', `la zone « cour » est mal créée (${JSON.stringify(z0)})`);
  verifier(z0.hors === 'cour', `la cour n'est pas détectée par zoneAt (${z0.hors})`);
  verifier(/^(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)\. · Jour/.test(await e(() => document.getElementById('mwTime').textContent)), "le jour de la semaine n'apparaît pas dans l'horloge");
  verifier(await e(() => { delete __mw.S.noir; const n = __mwn.state(); return n.gauge === 0 && n.slots === 1 && Array.isArray(n.dem) && n.mat.chandelles === 0; }), 'les données « noir » ne se recréent pas à partir d\'une ancienne sauvegarde');

  // 1. les annonces ne sont pas disponibles avant la première paie, puis le panneau d'annonces
  verifier(!(await e(() => __mwn.unlocked())), 'le noir est débloqué dès le départ');
  await e(() => { MWC.state().stats.paid = 1; __mw.S.min = 660; __mw.S.day = 2; });
  verifier(await e(() => __mwn.unlocked()), "le noir ne se débloque pas après la première paie");
  await e(() => { const z = __mw.zone('pieces'); __mw.teleport(z.porte.x + 4.4, z.porte.z, 0); });
  await attendreCondition(page, () => /petites annonces/.test(document.getElementById('mwPrompt').textContent), "pas d'invite devant le panneau d'annonces", 15000);
  await appuyer('e');
  await attendreVisible(page, '.mw-pn', "le panneau d'annonces ne s'ouvre pas");
  const m0 = await argent();
  await clic('noir:ann1');
  verifier((await argent()) < m0, "l'annonce n'est pas facturée");
  verifier(await e(() => __mwn.state().annonce && __mwn.state().annonce.fin > __mw.S.day), "l'annonce n'est pas enregistrée");
  await fermer();

  // 2. une demande arrive, on l'accepte depuis le panneau du carnet, la voiture arrive dans la cour
  const r0 = await e(() => { const r = __mwn.gen({ tpl: 'essuie', rdvIn: 6 }); return r && { id: r.id, prix: r.prix, cout: r.cout, lift: r.lift }; });
  verifier(r0 && r0.prix > r0.cout, `le prix proposé (${r0 && r0.prix}) ne couvre pas les pièces (${r0 && r0.cout})`);
  const ref = await e(() => { const D = MWJ.noirData, q = MWJ.quote(['essuie'], 'citadine', D.TAUX.garage1); return q.facture; });
  verifier(r0.prix <= ref * 1.2, `le client paie plus cher qu'au garage (${r0.prix} contre ${ref})`);
  await e(() => MWJ.openCarnet());
  verifier((await texte()).includes('Travail au noir'), 'le carnet n\'a pas de section « Travail au noir »');
  await clic('noir:open');
  const t1 = await texte();
  verifier(t1.includes('Demandes') && t1.includes('Accepter'), 'la liste des demandes ne s\'affiche pas : ' + t1.slice(0, 300));
  await verifierTextes(page, 'panneau Travail au noir');
  await clic('noir:acc_' + r0.id);
  verifier(await e(() => __mwn.state().rdv.length === 1 && __mwn.state().dem.length === 0), 'la demande acceptée ne devient pas un rendez-vous');
  await fermer();
  await attendreCondition(page, () => { __mw.addMin(2); return __mwn.carsNoir().length >= 1; }, 'la voiture du client n\'arrive pas dans la cour', 30000);
  const c0 = await e(() => { const c = __mwn.carsNoir()[0]; return { id: c.id, zone: c.zone, prix: c.noir.prix, tpl: c.ordre.join() }; });
  verifier(c0.zone === 'cour' && c0.prix === r0.prix, `voiture mal placée ou prix altéré (${JSON.stringify(c0)})`);

  // 3. travail dans la cour : habitacle accessible, mais pas le dessous (pas de pont)
  const g0 = await jauge();
  await ouvrirPoint(c0.id, 'cabine');
  await clic('dep:essuie');
  await clic('pose:essuie').catch(() => {});   // pas de pièce neuve : le montage échoue, on l'achète juste après
  await fermer();
  await e(() => { const c = __mwj.jobs().find(x => x.noir); __mw.S.inv.push({ k: 'neuve', id: 'essuie', src: 'achat', paye: 16 }); });
  await ouvrirPoint(c0.id, 'cabine');
  await clic('pose:essuie');
  verifier(await e(() => __mwj.jobs().find(x => x.noir).done.essuie === 1), 'la pièce n\'est pas montée dans la cour');
  const g1 = await jauge();
  verifier(g1 > g0, `le travail ne fait pas monter la jauge (${g0} -> ${g1})`);
  await clic('rendre');
  await clic('ok');
  verifier((await texte()).includes('en liquide'), 'le rendu du travail au noir n\'indique pas la paie en liquide');
  const stats = await e(() => ({ jobs: MWC.state().stats.jobs, ledger: __mw.S.ledger.slice(-3).map(l => l.motif).join('|'), g: __mwn.state().gains.length }));
  verifier(/noir/i.test(stats.ledger), 'la paie en liquide n\'apparaît pas dans le livre de comptes');
  verifier(stats.jobs === 0, 'un travail au noir compte pour la carrière (tutoriel, promotions)');
  verifier(stats.g === 1, 'le gain au noir n\'est pas enregistré');
  await fermer();

  // 4. jauge visible dans la cour, jour de la semaine
  await e(() => __mw.teleport(-30, 38, 0));
  await attendreCondition(page, () => { const h = document.querySelector('.mw-z[data-h="noir"]'); return h && /agacement/.test(h.textContent); }, 'la jauge de la voisine n\'est pas affichée dans la cour', 15000);
  await e(() => __mw.teleport(-60, 5, 0));
  await attendreCondition(page, () => !document.querySelector('.mw-z[data-h="noir"]'), 'la jauge reste affichée hors de la cour', 15000);

  // 5. le bruit : plus fort la nuit (×3), tôt le matin ou tard le soir (×1,5), le dimanche (×2) ; la clé à la main est silencieuse
  const mu = await e(() => {
    const r = {}; __mw.S.day = 2; // jour 2 = mardi
    for (const [k, h] of [['jour', 11], ['soir', 21], ['nuit', 23], ['aube', 3], ['tot', 7.5]]) { __mw.S.min = h * 60; r[k] = __mwn.mult(); }
    __mw.S.day = 7; __mw.S.min = 660; r.dim = __mwn.dow() === 6 ? __mwn.mult() : -1;
    __mw.S.day = 7; __mw.S.min = 23 * 60; r.dimNuit = __mwn.mult();
    __mw.S.day = 2; return r;
  });
  verifier(mu.jour === 1 && mu.soir === 1.5 && mu.tot === 1.5 && mu.nuit === 3 && mu.aube === 3 && mu.dim === 2 && mu.dimNuit === 6, `multiplicateurs de bruit incorrects (${JSON.stringify(mu)})`);
  const dg = await e(() => { __mwn.setGauge(0); __mw.S.min = 660; const a = __mwn.bruit(1); __mwn.setGauge(0); __mw.S.min = 23 * 60; const b = __mwn.bruit(1); return [a, b]; });
  verifier(Math.abs(dg[1] / dg[0] - 3) < .05, `le bruit de nuit n'est pas triplé (${dg})`);
  // outil : la boulonneuse fait plus de bruit que la clé à la main (pour un même geste)
  const outil = await e(() => {
    const p = MWJ.PARTS.huile, c = { noir: { prix: 1 }, pont: 0 }, n = __mwn.state(); __mw.S.min = 660; __mw.S.day = 2;
    n.mat.boulonneuse = 1; n.mat.absorbant = 5;
    n.mode = 'main'; __mwn.setGauge(0); __mwn.geste(c, 'dep', MWJ.PARTS.plaq_av, 10); const a = __mwn.gauge();
    n.mode = 'pneu'; __mwn.setGauge(0); __mwn.geste(c, 'dep', MWJ.PARTS.plaq_av, 10); const b = __mwn.gauge();
    n.mat.boulonneuse = 0; n.mode = 'main'; return [a, b];
  });
  verifier(outil[1] > outil[0] * 2, `la boulonneuse n'est pas nettement plus bruyante (${outil})`);

  // 6. plainte à 30, mot à 60
  await e(() => { __mwn.state().pal = {}; __mwn.setGauge(29); __mw.S.min = 660; __mwn.bruit(2); });
  verifier(await e(() => __mwn.state().pal.p30 === true && __mwn.fig().visible), 'la voisine ne se plaint pas et n\'apparaît pas à sa fenêtre au palier 30');
  verifier((await e(() => document.getElementById('mwToasts').textContent)).includes('Ricard'), 'le message de plainte de la voisine ne s\'affiche pas');
  await e(() => { __mwn.setGauge(59); __mwn.bruit(3); });
  verifier(await e(() => __mwn.state().pal.p60 === true && __mwn.state().mots >= 1), 'pas de mot menaçant au palier 60');

  // 7. cadeau : la jauge baisse, l'argent aussi ; excuses de moins en moins efficaces
  await e(() => { __mwn.setGauge(50); __mwn.state().cadeaux = []; __mwn.state().excuses = 0; __mw.teleport(-14.2, 43, Math.PI / 2); });
  await attendreCondition(page, () => /Ricard/.test(document.getElementById('mwPrompt').textContent), "pas d'invite devant la porte de la voisine", 15000);
  await appuyer('e');
  await attendreVisible(page, '.mw-pn', 'la porte de la voisine ne s\'ouvre pas');
  const gA = await jauge(), mA = await argent();
  await clic('noir:v_fleurs');
  const gB = await jauge(), mB = await argent();
  verifier(gB < gA && mB < mA, `le cadeau ne baisse pas la jauge ou ne coûte rien (${gA}->${gB}, ${mA}->${mB})`);
  await clic('noir:v_chocolats');
  const gC = await jauge(), mC = await argent();
  verifier(gC < gB && (mB - mC) > (mA - mB), 'un cadeau plus cher ne coûte pas plus ou ne calme pas');
  await e(() => { __mwn.state().excuses = 0; __mwn.setGauge(50); });
  const ex = await e(() => { const r = []; for (let i = 0; i < 3; i++) { const a = __mwn.gauge(); __mw.closePanel(); __mwn.voisine(); document.querySelector('.mw-pn [data-mw="noir:v_exc"]').click(); r.push(Math.round((a - __mwn.gauge()) * 10) / 10); } return r; });
  verifier(ex[0] > ex[1] && ex[2] <= 0, `les excuses répétées ne perdent pas leur effet (${ex})`);
  await fermer();

  // 8. service rendu : la voiture de la voisine arrive, la réparer fait chuter la jauge
  await e(() => { __mwn.state().serviceT = -99; __mwn.setGauge(70); __mw.teleport(-14.2, 43, Math.PI / 2); });
  await e(() => { __mw.closePanel(); __mwn.voisine(); });
  await clic('noir:v_serv');
  const sv = await e(() => { const c = __mwn.carsNoir().find(x => x.noir.service); return c && { id: c.id, ordre: c.ordre.slice(), symp: !!c.symp }; });
  verifier(sv, 'la voiture de la voisine n\'arrive pas dans la cour');
  const gS = await e(() => { const c = __mwn.carsNoir().find(x => x.noir.service); if (c.ordre.length) { for (const id of c.ordre) { c.done[id] = 1; c.parts[id].u = 0; } } else if (c.symp) { c.done[c.symp.c] = 1; } return __mwn.gauge(); });
  const mS = await argent();
  await e(() => { MWJ.done(__mwn.carsNoir().find(x => x.noir.service)); });
  verifier((await jauge()) <= gS - 30 && (await argent()) === mS, 'le service rendu ne calme pas la voisine (ou il est payé)');

  // 9. matériel : pas de pont élévateur, chandelles nécessaires pour le dessous ; produit absorbant et flaques
  await e(() => { __mwj.clear(); __mw.S.inv.length = 0; const n = __mwn.state(); n.mat.chandelles = 0; n.mat.absorbant = 0; n.flaques = []; });
  const rl = await e(() => { const r = __mwn.gen({ tpl: 'vidange', rdvIn: 1 }); return { lift: r.lift, ok: __mwn.accept(r.id) }; });
  verifier(rl.lift && !rl.ok, 'une vidange (dessous) est acceptable sans chandelles');
  await e(() => { __mwn.state().mat.chandelles = 1; });
  verifier(await e(() => { const r = __mwn.state().dem.find(x => x.lift); return __mwn.accept(r.id); }), 'avec des chandelles, la demande reste refusée');
  await attendreCondition(page, () => { __mw.addMin(2); return __mwn.carsNoir().length >= 1; }, 'la voiture à vidanger n\'arrive pas', 30000);
  const cv = await e(() => __mwn.carsNoir()[0].id);
  await e(() => { __mwn.state().mat.chandelles = 0; });
  await ouvrirPoint(cv, 'FL');
  await clic('pont');
  verifier(await e(() => __mwj.jobs().find(x => x.noir).st.lifted === 0), 'on lève la voiture sans chandelles');
  await fermer();
  await e(() => { __mwn.state().mat.chandelles = 1; });
  await ouvrirPoint(cv, 'FL');
  const tL = await e(() => __mw.S.min);
  await clic('pont');
  verifier(await e(() => __mwj.jobs().find(x => x.noir).st.lifted === 1), 'avec des chandelles la voiture ne se lève pas');
  await fermer();
  // flaque d'huile à la dépose de l'huile (sans kit absorbant), puis nettoyage avec un kit
  await e(() => { const n = __mwn.state(); n.flaques = []; const c = __mwj.jobs().find(x => x.noir); __mwn.K.fuite = 1; __mwn.geste(c, 'dep', MWJ.PARTS.huile, 10); __mwn.K.fuite = .7; });
  verifier(await e(() => __mwn.state().flaques.length === 1), 'pas de flaque d\'huile après la vidange sans produit absorbant');
  await e(() => { __mwn.state().mat.absorbant = 1; const f = __mwn.state().flaques[0]; __mw.teleport(f.x, f.z, Math.PI); });
  await attendreCondition(page, () => /Nettoyer la flaque/.test(document.getElementById('mwPrompt').textContent), "pas d'invite pour nettoyer la flaque", 15000);
  await appuyer('e');
  await attendreCondition(page, () => __mwn.state().flaques.length === 0 && __mwn.state().mat.absorbant === 0, 'la flaque n\'est pas nettoyée', 8000);
  // encombrement : une voiture qui reste plus d'un jour fait monter la jauge à l'heure
  const enc = await e(() => { __mwn.setGauge(0); const c = __mwj.jobs().find(x => x.noir); c.arrive = __mwj.absT() - 2000; __mwn.onHour(14); return __mwn.gauge(); });
  verifier(enc > .3, `l'encombrement ne fait pas monter la jauge (${enc})`);
  await e(() => { __mwj.clear(); __mw.S.inv.length = 0; });

  // 10. magasin : onglet « Matériel du noir »
  await e(() => { __mwj.shop(); });
  await clic('tab:noir');
  verifier((await texte()).includes('Chandelles') && (await texte()).includes('absorbant'), 'l\'onglet « Matériel du noir » du magasin est vide');
  const mM = await argent();
  await clic('noir:b_absorbant');
  verifier((await argent()) < mM && (await e(() => __mwn.state().mat.absorbant)) >= 1, 'l\'achat du kit absorbant échoue');
  await fermer();

  // 11. dénonciation : amende, saisie, client parti, interdiction ; avertissement puis licenciement
  await e(() => {
    MWC.hire('ventoux'); __mw.S.money = 3000; __mw.S.rep = 40; const n = __mwn.state();
    n.gains = [{ j: __mw.S.day, x: 300, client: 'X', voiture: 'Y' }]; n.mat.chandelles = 1; n.mat.boulonneuse = 1; n.mode = 'pneu'; n.lastCtl = 0; n.ban = 0; n.avert = {}; n.offenses = 0;
    __mw.S.inv.push({ k: 'neuve', id: 'huile', src: 'achat', paye: 35 }, { k: 'usagee', id: 'bougies', u: 80 });
    __mwj.spawn({ noir: { zone: 'cour', prix: 50, client: 'M. Test' }, tpl: 'essuie', silencieux: true });
  });
  const av = await e(() => ({ m: __mw.S.money, rep: __mw.S.rep, u: __mwn.unit() }));
  await e(() => __mwn.denonce('voisine', { now: true }));
  const ap = await e(() => { const n = __mwn.state(); return { m: __mw.S.money, rep: __mw.S.rep, inv: __mw.S.inv.length, ch: n.mat.chandelles, bo: n.mat.boulonneuse, cars: __mwn.carsNoir().length, ban: n.ban, day: __mw.S.day, emp: MWC.employer().id, avert: n.avert.ventoux, amendes: n.amendes.length, g: n.gauge, pend: n.ctlPending }; });
  const amende = av.m - ap.m;
  verifier(amende >= av.u && amende >= av.u + 0.7 * 300 - 1, `l'amende (${amende}) n'est pas proportionnelle aux gains récents (unité ${av.u})`);
  verifier(ap.inv === 0 && ap.ch === 0 && ap.bo === 0, 'les pièces et outils ne sont pas saisis');
  verifier(ap.cars === 0, 'le client présent n\'est pas parti');
  verifier(ap.rep < av.rep && ap.ban >= ap.day + 5, `réputation ou interdiction incorrectes (${JSON.stringify(ap)})`);
  verifier(ap.emp === 'ventoux' && ap.avert === 1, 'l\'employeur de marque ne reçoit pas d\'avertissement à la première affaire');
  verifier(!ap.pend && ap.g <= 40, 'la jauge ne retombe pas après le contrôle');
  // 2e affaire pendant l'interdiction : amende doublée, licenciement
  await e(() => { const n = __mwn.state(); n.gains = [{ j: __mw.S.day, x: 300, client: 'X', voiture: 'Y' }]; __mw.S.money = 5000; n.lastCtl = 0; });
  const av2 = await argent();
  await e(() => __mwn.denonce('client', { now: true }));
  const am2 = await e(() => __mwn.state().amendes.slice(-1)[0]);
  verifier(/récidive/.test(am2.motif) && av2 - (await argent()) >= 2 * av.u - 1, `l'amende n'est pas doublée pendant l'interdiction (${JSON.stringify(am2)})`);
  verifier(await e(() => MWC.employer().id === 'aucun' && __mwn.state().ban > __mw.S.day + 7), 'la seconde affaire ne coûte pas son poste ou n\'allonge pas l\'interdiction');
  await fermer();
  // patron du Garage du Coin : amende supplémentaire
  await e(() => { MWC.hire('patron'); const n = __mwn.state(); n.gains = []; n.lastCtl = 0; n.ban = 0; __mw.S.money = 5000; });
  const av3 = await argent();
  await e(() => __mwn.denonce('voisine', { now: true }));
  verifier(av3 - (await argent()) >= av.u * 1.5, 'le patron du garage ne paie pas d\'amende supplémentaire');
  await fermer();
  await e(() => { MWC.hire('aucun'); });

  // 12. la scène du contrôleur : il arrive dans la cour, puis le rapport s'affiche (conditions, pas de durées)
  await e(() => { const n = __mwn.state(); n.ban = 0; n.gains = [{ j: __mw.S.day, x: 100, client: 'X', voiture: 'Y' }]; n.lastCtl = 0; __mwn.K.vitesseCtl = 30; __mw.teleport(-60, 5, 0); __mwn.denonce('voisine'); });
  verifier(await e(() => !!__mwn.state().ctlPending), 'la dénonciation sans effet immédiat n\'est pas mise en attente');
  await attendreCondition(page, () => { const t = document.querySelector('.mw-pn h2'); return t && /Contrôle de la cour/.test(t.textContent); }, 'le contrôleur n\'arrive pas dans la cour', 150000);
  verifier((await texte()).includes('Amende'), 'le rapport du contrôle n\'indique pas l\'amende');
  await verifierTextes(page, 'rapport de contrôle');
  await fermer();

  // 13. auto-entrepreneur : cotisations, plus de dénonciation (mairie seulement)
  await e(() => { const n = __mwn.state(); n.ban = 0; __mw.S.money = 5000; __mw.S.day = 3; __mwn.statut(); });
  const mAE = await argent();
  await clic('noir:ae_ok');
  verifier(await e(() => __mwn.state().ae === true) && (await argent()) < mAE, 'l\'inscription comme auto-entrepreneur échoue');
  await fermer();
  const cot = await e(() => { const m = __mw.S.money; MW.emit('jobDone', { noir: true, pay: 100, id: 'zz', client: 'Z', voiture: 'V' }, 5); return m - __mw.S.money; });
  const cotis = await e(() => __mwn.K.cotis);
  verifier(Math.abs(cot - 100 * cotis) < 1.01, `les cotisations ne valent pas ${Math.round(cotis * 100)} % de la paie (${cot})`);
  const ae = await e(() => { const n = __mwn.state(), a0 = n.amendes.length, c0 = __mw.S.money; __mwn.setGauge(95); __mwn.denonce('voisine', { now: true }); return { pend: n.ctlPending, am: n.amendes.length - a0, m: c0 - __mw.S.money, mairie: n.mairie, g: n.gauge }; });
  verifier(!ae.pend && ae.am === 0 && ae.m === 0 && ae.mairie === 1, `l'auto-entrepreneur subit une dénonciation (${JSON.stringify(ae)})`);
  const ae2 = await e(() => { const n = __mwn.state(); n.mairieT = -9; __mwn.setGauge(95); const c0 = __mw.S.money; __mwn.mairie(); return { m: c0 - __mw.S.money, am: n.amendes.length, ctl: n.stats.controles }; });
  verifier(ae2.m > 0, `la mairie n'inflige pas d'amende pour nuisances au second signalement (${JSON.stringify(ae2)})`);
  // plus aucune dénonciation, même avec une jauge pleine pendant de nombreuses heures
  const horaires = await e(() => { const n = __mwn.state(), c0 = n.stats.controles; for (let i = 0; i < 60; i++) { __mwn.setGauge(100); n.mairieT = day0(); __mwn.onHour(14); } return { pend: n.ctlPending, c: n.stats.controles - c0 }; function day0() { return __mw.S.day; } });
  verifier(!horaires.pend && horaires.c === 0, 'un auto-entrepreneur est contrôlé pour travail dissimulé');

  // 14. sauvegarde : les données « noir » reviennent, et une sauvegarde sans elles se charge sans erreur
  await e(() => { __mwn.setGauge(42); __mw.save(); });
  await page.reload();
  await attendreVisible(page, '#hMeca', "l'accueil ne revient pas après le rechargement");
  await e(() => { const s = JSON.parse(localStorage.getItem('bea.meca.v1')); const g = s.noir && s.noir.gauge; window.__g0 = g; });
  verifier(await e(() => window.__g0 === 42), 'la jauge n\'est pas sauvegardée');
  await e(() => { const s = JSON.parse(localStorage.getItem('bea.meca.v1')); delete s.noir; localStorage.setItem('bea.meca.v1', JSON.stringify(s)); });
  await cliquer(page, '#hMeca');
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwn, null, { timeout: 15000 });
  await page.evaluate(() => { if (typeof MWG !== 'undefined') MWG.set({ classic: true }); }); // menus classiques de js/41 (gestes réalistes : scénario 16)
  await attendre(500);
  verifier(await e(() => __mwn.state().gauge === 0 && __mwn.state().slots === 1 && !__mwn.state().ae), 'une sauvegarde sans données « noir » ne se charge pas proprement');
  await e(() => { __mw.S.flags.coinVu = true; });
  verifier(await e(() => { __mwj.openCarnet(); const t = document.querySelector('.mw-pn').textContent; __mw.closePanel(); return typeof t === 'string'; }), 'le carnet ne s\'ouvre pas avec une ancienne sauvegarde');
  return 'annonce, demande, cour, paie en liquide, bruit, voisine, cadeaux, dénonciation, auto-entrepreneur';
};
module.exports.titre = 'Mode Mécanicien : clients au noir, voisine et dénonciation';
