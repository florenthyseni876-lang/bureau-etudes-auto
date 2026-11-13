'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes } = require('../outils.js');

// Mode Mécanicien (travaux) : client, vidange de bout en bout, paie et expérience, magasin, ferraille,
// diagnostic d'un symptôme, essai sur route, rendu avec une mauvaise réparation.
module.exports = async function mecaTravaux(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj, null, { timeout: 15000 });
  await attendre(400);

  const e = (f, a) => page.evaluate(f, a);
  const appuyer = async (touche) => { await page.keyboard.press(touche); };
  // se place sur un point d'interaction (voiture du pont 0) et ouvre son panneau avec E
  const ouvrirPoint = async (kind, texte) => {
    await e(k => { const c = __mwj.jobs()[0]; const o = __mwj.point(c, k); __mw.teleport(o.x, o.z, 0); }, kind);
    await attendreCondition(page, () => { const p = document.getElementById('mwPrompt'); return p && !p.hidden && /^\[E\]/.test(p.textContent); }, `aucune invite d'interaction au point « ${kind} »`, 15000);
    await appuyer('e');
    await attendreVisible(page, '.mw-pn', `E n'ouvre pas le panneau au point « ${kind} »`);
    if (texte) verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes(texte), `le panneau du point « ${kind} » n'affiche pas « ${texte} »`);
  };
  const clic = async (a) => { await cliquer(page, `.mw-pn [data-mw="${a}"]`, `bouton ${a} absent`); await attendre(120); };
  const fermer = async () => { await appuyer('Escape'); await attendreCondition(page, () => !__mw.paused, 'le panneau ne se ferme pas', 8000); };

  // 1. un client arrive pendant les heures d'ouverture, avec un travail simple pour le niveau 1
  await e(() => { __mw.S.min = 590; __mw.S.flags.coinVu = true; });
  await attendreCondition(page, () => { __mw.addMin(2); return __mwj.jobs().length >= 1; }, "aucun client n'arrive au garage", 20000);
  const c0 = await e(() => { const c = __mwj.jobs()[0]; return { z: c.zone, ordre: c.ordre, type: c.type, niv: c.ordre.map(id => __mwj.PARTS[id].niv), mesh: !!__mw.scene.children.length }; });
  verifier(c0.z === 'garage1', `la voiture cliente n'est pas au Garage du Coin (${c0.z})`);
  verifier(c0.type === 'travaux' && c0.niv.every(n => n === 1), 'les premiers travaux ne sont pas des travaux simples de niveau 1');
  verifier(await e(() => Object.keys(__mwj.PARTS).length >= 20 && __mwj.level('moteur') === 1 && __mwj.skillOf('plaq_av') === 'freinage'), 'MWJ.PARTS / level / skillOf incorrects');
  // hors des heures d'ouverture : pas de client
  const nuit = await e(() => { __mwj.clear(); __mw.S.jobs.next = 0; __mw.S.min = 1200; __mw.addMin(5); return __mwj.jobs().length; });
  verifier(nuit === 0, 'des clients arrivent la nuit');

  // 2. vidange complète, étape par étape, par l'interface
  await e(() => { __mw.S.min = 610; __mwj.clear(); __mw.S.jobs.next = 1e12; __mwj.spawn({ tpl: 'vidange' }); window.__jd = null; __mw.on('jobDone', (j, n) => { window.__jd = { j, n }; }); });
  const av = await e(() => ({ argent: __mw.S.money, xp: __mw.S.xp.entretien || 0, rep: __mw.S.rep, t: __mw.S.min }));
  await ouvrirPoint('FL', 'Lever le pont');
  await clic('pont');
  await attendreCondition(page, () => __mwj.jobs()[0].st.lifted === 1, 'le pont ne se lève pas');
  await fermer();
  await attendreCondition(page, () => __mwj.meshY(__mwj.jobs()[0]) > 1.1, 'la voiture ne monte pas réellement avec le pont', 30000);
  await ouvrirPoint('dessous', 'Huile moteur');
  await clic('insp:huile');
  await verifierTextes(page, 'panneau du dessous');
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('Usure'), "l'inspection n'affiche pas l'usure");
  await clic('dep:huile');
  await clic('dep:filtre_huile');
  const inv1 = await e(() => __mw.S.inv.map(i => i.k + ':' + i.id));
  verifier(inv1.includes('usagee:huile') && inv1.includes('usagee:filtre_huile'), `les pièces usagées ne sont pas dans l'inventaire (${inv1})`);
  await fermer();
  // sans pièce neuve : le montage est refusé
  await ouvrirPoint('dessous');
  verifier(await e(() => document.querySelector('[data-mw="pose:huile"]').disabled), 'le montage devrait être impossible sans pièce neuve');
  await fermer();
  // étagère de l'atelier
  await e(() => { const p = __mwj.shelf('garage1'); __mw.teleport(p.x, p.z, 0); });
  await attendreCondition(page, () => /Étagère/.test(document.getElementById('mwPrompt').textContent), "pas d'invite devant l'étagère");
  await appuyer('e');
  await attendreVisible(page, '.mw-pn', "l'étagère ne s'ouvre pas");
  await clic('take:huile');
  await clic('take:filtre_huile');
  await fermer();
  verifier((await e(() => __mw.S.inv.filter(i => i.k === 'neuve').length)) === 2, 'les pièces neuves ne sont pas prises à l\'étagère');
  await ouvrirPoint('dessous');
  await clic('pose:huile');
  await clic('pose:filtre_huile');
  verifier(await e(() => { const c = __mwj.jobs()[0]; return c.done.huile === 1 && c.done.filtre_huile === 1 && Object.keys(c.rem).length === 0; }), 'les pièces ne sont pas montées');
  await fermer();
  // la voiture doit être remontée avant d'être rendue
  await ouvrirPoint('cabine');
  await clic('rendre');
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('Impossible de rendre'), 'on peut rendre une voiture sur le pont');
  await fermer();
  await ouvrirPoint('FL');
  await clic('pont');
  await fermer();
  await ouvrirPoint('cabine');
  await clic('rendre');
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('Total'), 'la facture ne s\'affiche pas');
  await clic('ok');
  await attendreCondition(page, () => window.__jd && window.__jd.j, "l'événement jobDone n'est pas émis", 8000);
  const ap = await e(() => ({ argent: __mw.S.money, xp: __mw.S.xp.entretien || 0, rep: __mw.S.rep, jd: window.__jd, rendues: __mw.S.jobs.stats.rendues, cars: __mwj.jobs().length, t: __mw.S.min }));
  verifier(ap.jd.j.facture > 0 && ap.jd.j.mainOeuvre > 0 && ap.jd.j.travaux.length === 2, 'facture ou travaux incohérents');
  verifier(ap.jd.j.pay > 0 && Math.abs((ap.argent - av.argent) - (ap.jd.j.pay + ap.jd.j.avance)) < .02, `paie incorrecte : argent ${av.argent} -> ${ap.argent}, paie ${ap.jd.j.pay}`);
  verifier(ap.jd.n >= 4 && ap.xp > av.xp && ap.jd.j.competences.entretien > 0, `expérience ou note anormales (note ${ap.jd.n}, xp ${av.xp} -> ${ap.xp})`);
  verifier(ap.rep > av.rep && ap.rendues === 1 && ap.cars === 0, `réputation ou compteur incorrects (réputation ${av.rep} -> ${ap.rep})`);
  verifier(ap.t - av.t >= 40, `les gestes n'avancent pas assez l'horloge (${ap.t - av.t} min)`);
  await fermer().catch(() => {});

  // 3. magasin Pièces Auto Express : achat, outil, ferraille
  await e(() => { const z = __mw.zone('pieces'); __mw.teleport(z.porte.x, z.porte.z, Math.atan2(z.n.x, z.n.z)); });
  await attendreCondition(page, () => /Pièces Auto|Entrer/.test(document.getElementById('mwPrompt').textContent), "pas d'invite à la porte du magasin");
  await appuyer('e');
  await attendreVisible(page, '.mw-pn', 'le magasin ne s\'ouvre pas');
  const m0 = await e(() => __mw.S.money);
  await clic('buy:disq_av');
  const m1 = await e(() => ({ m: __mw.S.money, inv: __mw.S.inv.filter(i => i.k === 'neuve' && i.id === 'disq_av').length }));
  verifier(m1.inv === 1 && Math.abs(m0 - m1.m - 110) < .01, `achat de disques incorrect (inventaire ${m1.inv}, argent ${m0} -> ${m1.m})`);
  await clic('tab:outils');
  await clic('tool:cle_dyn');
  verifier(await e(() => __mw.S.jobs.outils.cle_dyn === 1), 'la clé dynamométrique n\'est pas achetée');
  await clic('tab:ferraille');
  const f0 = await e(() => __mw.S.money);
  await clic('sellall');
  const f1 = await e(() => ({ m: __mw.S.money, us: __mw.S.inv.filter(i => i.k === 'usagee').length }));
  verifier(f1.m > f0 && f1.us === 0, 'la ferraille ne rapporte rien');
  await verifierTextes(page, 'magasin');
  await fermer();

  // 4. diagnostic : une mauvaise pièce remplacée, la panne reste -> client très mécontent
  await e(() => { __mw.S.min = 700; __mwj.clear(); __mwj.spawn({ symp: 'feu' }); __mw.S.inv.length = 0; __mw.S.inv.push({ k: 'neuve', id: 'essuie', src: 'etagere' }, { k: 'neuve', id: 'ampoules', src: 'etagere' }); });
  await ouvrirPoint('cabine', 'feu arrière');
  await clic('dep:essuie');
  await clic('pose:essuie');
  verifier(await e(() => __mwj.jobs()[0].done.essuie === 1), "le mauvais remplacement n'est pas enregistré");
  await clic('rendre');
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('n\'est pas réparée'), "le rendu n'avertit pas d'une panne non réparée");
  await clic('back');
  // puis la bonne réparation
  await clic('dep:ampoules');
  await clic('pose:ampoules');
  await clic('rendre');
  await clic('ok');
  const d2 = await e(() => window.__jd);
  verifier(d2.j.resolu === true && d2.j.travaux.includes('ampoules') && d2.n >= 3 && d2.j.competences.diagnostic > 0, `diagnostic mal noté (note ${d2.n}, résolu ${d2.j.resolu})`);
  await fermer().catch(() => {});

  // 5. essai sur route avec la voiture du client
  await e(() => { __mwj.clear(); __mwj.spawn({ symp: 'sifflet' }); });
  const o0 = await e(() => ({ x: __mw.S.car.x, z: __mw.S.car.z }));
  await ouvrirPoint('cabine');
  await clic('essai');
  await attendreCondition(page, () => __mw.player().inCar && !__mw.paused, "l'essai sur route ne démarre pas (le joueur n'est pas au volant)", 20000);
  const es = await e(() => ({ d: Math.hypot(__mw.S.car.x - 0, __mw.S.car.z - 0), vis: __mw.playerCar().mesh.visible, clues: __mwj.jobs()[0].clues.length }));
  verifier(!es.vis, 'la voiture du joueur reste visible pendant l\'essai');
  verifier(es.clues >= 1, 'aucun indice textuel pendant l\'essai');
  await e(() => { __mw.S.car.x += 0; });
  await appuyer('f');
  await attendreCondition(page, () => !__mw.player().inCar && __mwj.jobs()[0].essai === 1, "l'essai ne se termine pas", 20000);
  const o1 = await e(() => ({ x: __mw.S.car.x, z: __mw.S.car.z, vis: __mw.playerCar().mesh.visible }));
  verifier(Math.hypot(o1.x - o0.x, o1.z - o0.z) < .5 && o1.vis, 'la voiture du joueur n\'est pas remise à sa place après l\'essai');
  await attendre(400);
  await fermer().catch(() => {});

  // 6. valise de diagnostic (électricité niveau 2 + achat), carnet
  await e(() => { __mw.S.xp.electricite = 60; __mw.S.jobs.outils.valise = 1; __mwj.jobs()[0].parts.courroie_acc.u = 30; __mwj.jobs()[0].parts.batterie.u = 90; });
  await ouvrirPoint('cabine');
  await clic('valise');
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('batterie faible'), 'la valise ne lit pas la batterie faible');
  await fermer();
  await appuyer('Tab');
  await attendreVisible(page, '.mw-pn', 'Tab n\'ouvre pas le carnet');
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('Ordres en cours'), 'le carnet est vide');
  await verifierTextes(page, 'carnet');
  await fermer();
  verifier(await e(() => document.querySelectorAll('#mwInv .mw-slot').length === 12), "la barre d'inventaire n'a pas 12 places");
  return 'client, vidange complète, paie et expérience, magasin, ferraille, diagnostic, essai sur route, valise, carnet';
};

module.exports.titre = 'mécanicien (travaux) : client, vidange, paie, magasin, diagnostic, essai';
module.exports.appareil = 'bureau';
