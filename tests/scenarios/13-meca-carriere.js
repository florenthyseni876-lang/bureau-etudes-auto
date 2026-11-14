'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes, attendreCondition } = require('../outils.js');

// Mode Mécanicien (carrière) : apprenti, niveaux, paie au mois, entretien d'embauche, diplômes,
// mission d'ingénieur avec le bureau d'études, banque, voiture d'occasion, fondation de sa marque.
module.exports = async function mecaCarriere(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await page.evaluate(() => { try { localStorage.removeItem('bea.meca.v1'); } catch (e) {} });
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && typeof MWC !== 'undefined', null, { timeout: 15000 });
  await page.evaluate(() => { if (typeof MWG !== 'undefined') MWG.set({ classic: true }); }); // menus classiques de js/41 (gestes réalistes : scénario 16)
  await attendre(500);

  // se placer devant l'objet d'interaction d'une zone et appuyer sur E
  const ouvrir = async (id, bouton) => {
    await page.evaluate(zid => {
      const z = __mw.zone(zid), p = z.accueil || z.porte;
      __mw.teleport(p.x + 1.3, p.z, -Math.PI / 2);
    }, id);
    await attendre(350);
    await page.keyboard.press('e');
    await attendreVisible(page, '.mw-pn', `E devant « ${id} » n'ouvre pas de panneau`);
    if (bouton) await cliquer(page, `[data-mw="${bouton}"]`, `bouton « ${bouton} » absent du panneau de ${id}`);
  };
  const fermer = async () => { await page.evaluate(() => __mw.closePanel()); await attendre(100); };
  // répondre juste aux questions d'un QCM
  const repondreJuste = async () => {
    for (let i = 0; i < 12; i++) {
      const q = await page.evaluate(() => MWC.qcm());
      if (!q) break;
      await cliquer(page, `.mw-pb [data-mw="rep:${q.index}"]`, 'réponse du QCM introuvable');
      await attendre(80);
    }
    verifier(!(await page.evaluate(() => MWC.qcm())), 'le QCM ne se termine pas');
  };
  const poste = () => page.evaluate(() => MWC.employer());

  // 1. au départ : sans emploi, objectif affiché, embauche d'apprenti sans entretien
  verifier((await poste()).id === 'aucun', 'le joueur devrait être sans emploi au départ');
  const but = await page.evaluate(() => document.getElementById('mwZones').textContent);
  verifier(/Garage du Coin/.test(but), `l'objectif de départ ne parle pas du Garage du Coin : « ${but} »`);
  await ouvrir('garage1', 'join');
  await attendreCondition(page, () => MWC.employer().id === 'apprenti', "l'embauche d'apprenti échoue");
  const e1 = await poste();
  verifier(e1.zone === 'garage1' && e1.paie === 'tache' && e1.niveauxAutorises >= 1, `employeur apprenti inattendu : ${JSON.stringify(e1)}`);
  verifier(await page.evaluate(() => /Apprenti/.test(document.getElementById('mwZones').textContent)), "le HUD n'affiche pas le poste");
  await fermer();

  // 2. payFor et travaux simulés : l'expérience monte, la promotion arrive
  const pay = await page.evaluate(() => MWC.payFor({ facture: 120, mainOeuvre: 60 }));
  verifier(pay === 21, `part d'apprenti inattendue : ${pay}`);
  await page.evaluate(() => {
    __mw.S.xp.entretien = 480;
    for (let i = 0; i < 6; i++) __mw.emit('jobDone', { id: 'j' + i, client: 'Client', voiture: 'Citadine', travaux: ['Vidange'], facture: 90, mainOeuvre: 45, competences: ['entretien'] }, 4);
  });
  const niv = await page.evaluate(() => MWC.level('entretien'));
  verifier(niv >= 4, `niveau d'entretien attendu ≥ 4, obtenu ${niv}`);
  verifier((await poste()).id === 'meca', "la promotion de mécanicien n'a pas lieu après 6 voitures rendues");
  verifier(await page.evaluate(() => MWC.state().stats.vid >= 1), 'la première vidange n\'est pas comptée');

  // 3. panneau Carrière (touche C)
  await page.keyboard.press('c');
  await attendreVisible(page, '.mw-pn', 'la touche C n\'ouvre pas le panneau Carrière');
  verifier(await page.evaluate(() => document.querySelectorAll('.mw-sk').length >= 8), 'le panneau Carrière ne montre pas les compétences');
  await verifierTextes(page, 'panneau Carrière');
  await fermer();

  // 4. centre de formation : CAP (inscription, attente, examen)
  await page.evaluate(() => { __mw.money(5000, 'test'); __mw.S.rep = 30; });
  await ouvrir('ecole', 'enroll:cap');
  await attendre(200);
  await fermer();
  verifier(await page.evaluate(() => !!MWC.state().form && MWC.state().form.id === 'cap'), "l'inscription au CAP n'est pas enregistrée");
  await page.evaluate(() => { __mw.S.day += 3; });
  await ouvrir('ecole', 'exam');
  await repondreJuste();
  await attendreCondition(page, () => !!MWC.state().dipl.cap, "le CAP n'est pas obtenu après l'examen");
  await fermer();

  // 5. entretien d'embauche chez Ventoux
  await page.evaluate(() => { __mw.S.xp.entretien = 800; __mw.S.xp.freinage = 800; __mw.S.xp.moteur = 250; __mw.S.rep = 50; });
  await ouvrir('garage2', 'interview');
  await repondreJuste();
  await attendreCondition(page, () => MWC.employer().id === 'ventoux', "l'entretien réussi n'embauche pas chez Ventoux");
  await fermer();
  const ev = await poste();
  verifier(ev.zone === 'garage2' && ev.paie === 'mois' && ev.salaire > 1000 && ev.sem === ev.salaire, `employeur Ventoux inattendu : ${JSON.stringify(ev)}`);
  verifier(await page.evaluate(() => MWC.payFor({ facture: 500, mainOeuvre: 200 })) === 20, 'la prime de rendement des salariés (10 % de la main-d\'œuvre) est incorrecte');

  // 6. paie à la semaine : tous les 7 jours de jeu
  const m0 = await page.evaluate(() => { __mw.S.day = 35; __mw.S.min = 359; return __mw.S.money; });
  await page.evaluate(() => __mw.addMin(3));
  const m1 = await page.evaluate(() => __mw.S.money);
  verifier(m1 - m0 >= 1500, `la paie de la semaine n'est pas versée (${m0} puis ${m1})`);

  // 7. refus : un candidat trop faible chez Scuderia Brivio ne peut pas passer l'entretien
  await ouvrir('garage4');
  verifier(await page.evaluate(() => document.querySelector('[data-mw="interview"]').disabled), "l'entretien chez Brivio devrait être fermé");
  await fermer();

  // 8. banque : un prêt, remboursé chaque jour
  const b0 = await page.evaluate(() => __mw.S.money);
  await ouvrir('banque', 'loan:3000');
  await fermer();
  verifier(await page.evaluate(() => MWC.owed() > 3000), 'le prêt n\'est pas enregistré');
  const rest0 = await page.evaluate(() => MWC.owed());
  await page.evaluate(() => { __mw.S.min = 359; __mw.addMin(2); });
  verifier(await page.evaluate(() => MWC.owed()) < rest0, 'le prêt n\'est pas remboursé au jour suivant');
  verifier(await page.evaluate(() => __mw.S.money) > b0 - 3000, 'le prêt n\'a pas versé d\'argent');

  // 9. voiture d'occasion
  await page.evaluate(() => { __mw.money(10000, 'test'); });
  await ouvrir('concess', 'buy:citadine');
  await fermer();
  verifier(await page.evaluate(() => MWC.state().car && MWC.state().car.id === 'citadine'), "l'achat de voiture n'est pas enregistré");

  // 10. ingénieur : diplôme, candidature, mission, bureau d'études, soumission
  await page.evaluate(() => {
    const c = MWC.state(); c.dipl.bts = 1; c.dipl.ing = 1;
    __mw.S.xp.moteur = 1200; __mw.S.xp.diagnostic = 900; __mw.S.rep = 50;
  });
  await ouvrir('bureau', 'apply');
  await attendreCondition(page, () => MWC.employer().id === 'ing', "la candidature d'ingénieur n'aboutit pas");
  await attendreVisible(page, '[data-mw="new"]', 'le bouton « Demander une mission » est absent');
  await cliquer(page, '[data-mw="new"]');
  await attendreVisible(page, '[data-mw="studio"]', 'le bouton « Ouvrir le bureau d\'études » est absent');
  const mis = await page.evaluate(() => MWC.state().mission);
  verifier(mis && mis.cahier && mis.cahier.length >= 3, 'la mission n\'a pas de cahier des charges chiffré');
  await cliquer(page, '[data-mw="studio"]');
  await attendreVisible(page, '#mwMis', 'le bandeau de mission est absent du bureau d\'études');
  verifier(!(await page.evaluate(() => __mw.isOpen())), 'la ville devrait être masquée dans le bureau d\'études');
  await attendreCondition(page, () => document.querySelector('#mwMis .mw-mis-l').textContent.length > 10, 'le bandeau n\'affiche pas les mesures');
  await verifierTextes(page, 'bandeau de mission');
  // retour à la ville puis nouvelle visite
  await page.click('#mwMis [data-a="back"]');
  await attendreVisible(page, '#mwRoot', 'le retour à la ville ne fonctionne pas');
  verifier(!(await page.evaluate(() => document.getElementById('mwMis') && !document.getElementById('mwMis').hidden)), 'le bandeau reste affiché dans la ville');
  await page.evaluate(() => MWC.openStudio());
  await attendreVisible(page, '#mwMis', 'bandeau absent à la 2e ouverture');
  // soumission d'un projet qui ne respecte pas un cahier irréaliste → refus
  await page.evaluate(() => MWC.setMission({ id: 'x', titre: 'Mission impossible', grade: 0, essais: 0, cahier: [{ k: 'P', lo: 900, hi: 950 }, { k: 'mix', max: 1 }, { k: 'cost', max: 100 }] }));
  await page.click('#mwMis [data-a="sub"]');
  await attendreVisible(page, '#mwRoot', 'la soumission ne ramène pas à la ville');
  await attendreVisible(page, '.mw-pn', 'pas de verdict du chef de projet');
  verifier(await page.evaluate(() => /refus/i.test(document.querySelector('.mw-ph h2').textContent)), 'un cahier impossible devrait être refusé');
  await cliquer(page, '[data-mw="studio"]', 'le bouton « Retourner au bureau d\'études » est absent du refus');
  await attendreVisible(page, '#mwMis', 'le bandeau est absent au retour dans le bureau d\'études');
  // mission réalisable : cahier calé sur le projet courant → validée avec prime et promotion
  await page.evaluate(() => {
    const m = measure(M.E, M.C);
    MWC.setMission({ id: 'y', titre: 'Mission réalisable', grade: 0, essais: 0, cahier: [{ k: 'P', lo: Math.floor(m.P - 20), hi: Math.ceil(m.P + 20) }, { k: 'cyl', n: M.E.c.n }] });
    MWC.state().qual = 2;
  });
  const argent0 = await page.evaluate(() => __mw.S.money);
  await page.click('#mwMis [data-a="sub"]');
  await attendreVisible(page, '.mw-pn', 'pas de verdict pour la mission réalisable');
  verifier(await page.evaluate(() => /validée/i.test(document.querySelector('.mw-ph h2').textContent)), 'la mission réalisable devrait être validée');
  verifier(await page.evaluate(() => MWC.state().missions >= 1 && MWC.state().mission === null), 'la mission validée n\'est pas enregistrée');
  verifier(await page.evaluate(() => MWC.state().grade >= 1), 'aucune promotion après les missions requises');
  verifier(await page.evaluate(() => __mw.S.money) > argent0, 'aucune prime de mission');
  await fermer();

  // 11. fonder sa marque
  await ouvrir('terrain');
  verifier(await page.evaluate(() => document.querySelector('[data-mw="found"]').disabled), 'la fondation devrait être refusée sans capital');
  await fermer();
  await page.evaluate(() => { __mw.S.money = 80000; __mw.S.rep = 70; });
  await ouvrir('terrain');
  await page.fill('#mwBrand', 'Marque Essai');
  await cliquer(page, '[data-mw="found"]');
  await attendreCondition(page, () => window.__bea && window.__bea.G && window.__bea.G.co === 'Marque Essai', 'la carrière de constructeur ne démarre pas');
  const g = await page.evaluate(() => ({ y: __bea.G.y, cash: __bea.G.cash, co: __bea.G.co, debt: __bea.G.debt, fac: __bea.G.fac, rep: __bea.G.rep }));
  verifier(g.y >= 2024, `année de départ inattendue : ${g.y}`);
  verifier(g.cash >= 1.5e8 && g.cash <= 2.5e8, `capital inattendu (apport personnel + investisseurs) : ${g.cash}`);
  verifier(g.fac === 2 && g.rep > 30, `usine ou réputation de départ inattendues : niveau ${g.fac}, réputation ${g.rep}`);
  verifier(await page.evaluate(() => !document.getElementById('mwRoot') || document.getElementById('mwRoot').hidden), 'le mode Mécanicien devrait être fermé');
  await attendreVisible(page, '#cbar', 'la barre de carrière constructeur est absente');
  await verifierTextes(page, 'carrière constructeur fondée');
  return 'apprenti, promotion, CAP, entretien Ventoux, paie au mois, prêt, voiture, mission d\'ingénieur, fondation';
};

module.exports.titre = 'mécanicien (carrière) : emplois, diplômes, entretien, mission d\'ingénieur, fondation de sa marque';
module.exports.appareil = 'bureau';
