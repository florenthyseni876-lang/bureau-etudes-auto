'use strict';
const os = require('os');
const path = require('path');
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien à deux (js/56) : deux pages Playwright du même navigateur, reliées par BroadcastChannel (le serveur de
// rencontre PeerJS n'est pas joignable pendant les tests). Vérifie : le menu (la bibliothèque PeerJS n'est demandée qu'à
// l'ouverture du menu), la connexion par code, la vue de l'autre qui bouge, deux fois plus de clients et un pont par joueur,
// des gestes à deux sur la même voiture, le refus de la même pièce en même temps, l'argent commun, l'expérience propre à chacun,
// le sommeil à deux, les messages, le menu qui ne met en pause qu'un écran, la déconnexion propre.
async function mecaDeuxJoueurs(page, env) {
  const A = page;
  const ctx = A.context();
  const B = await ctx.newPage();
  const erreursB = [];
  B.on('pageerror', e => erreursB.push(`erreur JS (invité) : ${String(e.message).split('\n')[0].slice(0, 160)}`));
  B.on('console', m => { if (m.type() === 'error') erreursB.push(`erreur console (invité) : ${m.text().split('\n')[0].slice(0, 160)}`); });
  const dossier = process.env.BEA_CAPTURES || os.tmpdir();
  const capturer = async (p, nom) => { try { await p.screenshot({ path: path.join(dossier, `deux-joueurs-${nom}.png`) }); } catch (e) { /* capture facultative */ } };

  // la bibliothèque PeerJS n'est jamais chargée au démarrage : on compte les demandes et on la remplace par un faux fichier vide
  const demandesPeer = { A: [], B: [] };
  for (const [nom, p] of [['A', A], ['B', B]]) {
    await p.route('**/peerjs*', route => { demandesPeer[nom].push(route.request().url()); route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* faux PeerJS (tests) */' }); });
  }

  const ouvrir = async p => {
    await p.goto(env.url);
    await attendreVisible(p, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
    await cliquer(p, '#hMeca');
    await attendreVisible(p, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
    await p.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && typeof MWG !== 'undefined' && window.__mwcars && window.__mwnet, null, { timeout: 20000 });
    await attendre(300);
  };
  await ouvrir(A);
  await ouvrir(B);
  const ea = (f, a) => A.evaluate(f, a);
  const eb = (f, a) => B.evaluate(f, a);
  verifier(demandesPeer.A.length === 0 && demandesPeer.B.length === 0, 'PeerJS est chargé dès le démarrage du jeu');

  // état de départ : jour ouvré, aucun client, pas de sommeil ni d'arrivée spontanée
  const base = () => { MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; MWG.set({ aide: 'off' }); };
  await ea(base);
  await eb(() => { base2(); function base2() { __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; __mw.S.money = 777; MWG.set({ aide: 'off' }); } });
  const soloB = await eb(() => ({ money: __mw.S.money, day: __mw.S.day, emp: MWC.employer().id, x: __mw.player().x }));

  // 0. solo : un seul client à la fois tant que le niveau est bas
  await ea(() => { __mw.S.jobs.next = 0; __mw.addMin(40); });
  const nSolo = await ea(() => __mwj.jobs().length);
  verifier(nSolo === 1, `en solo, un niveau débutant ne devrait avoir qu'un pont (${nSolo} voitures)`);
  await ea(() => { __mwj.clear(); __mw.S.jobs.next = 1e12; });

  // 1. le menu « Jouer à deux… » : ouverture du menu = demande de la bibliothèque PeerJS
  await ea(() => __mw.menu());
  await attendreVisible(A, '#mwPb [data-mw="multi"]', 'le menu Échap n\'a pas de bouton « Jouer à deux… »');
  const libelle = await ea(() => document.querySelector('#mwPb [data-mw="multi"]').textContent);
  verifier(/Jouer à deux/.test(libelle), `bouton du menu inattendu : ${libelle}`);
  await A.click('#mwPb [data-mw="multi"]');
  await attendreVisible(A, '#mwNetName', 'le panneau « Jouer à deux » ne s\'ouvre pas');
  await attendre(600);
  verifier(demandesPeer.A.length === 1 && /cdn\.jsdelivr\.net\/npm\/peerjs@1\.5\.4\/dist\/peerjs\.min\.js/.test(demandesPeer.A[0]), `PeerJS n'est pas demandé à l'ouverture du menu avec la bonne adresse (${demandesPeer.A.join(',')})`);
  verifier(await ea(() => !!document.getElementById('mwNetJoin') && !!document.querySelector('#mwPb [data-mw="host"]')), 'le panneau n\'offre pas « Héberger » et « Rejoindre »');
  await capturer(A, '1-menu');
  await ea(() => MW.closePanel());

  // 2. connexion par code (transport BroadcastChannel)
  const code = await ea(() => __mwnet.host({ transport: 'bc', name: 'Léa' }));
  verifier(/^[B-Z]{6}$/.test(code) && !/[AEIOUY]/.test(code), `code d'hôte inattendu : ${code}`);
  verifier(await ea(() => __mwnet.status() === 'hosting' && !__mwnet.live()), "l'hôte n'attend pas son ami");
  await eb(async c => { await __mwnet.join(c, { transport: 'bc', name: 'Tom' }); }, code);
  await attendreCondition(A, () => __mwnet.live(), "l'hôte ne voit pas son ami arriver", 15000);
  await attendreCondition(B, () => __mwnet.live(), "l'invité n'est pas connecté", 15000);
  const [ra, rb] = [await ea(() => [__mwnet.role(), __mwnet.partnerName(), __mw.net.players(), __mw.net.guest]), await eb(() => [__mwnet.role(), __mwnet.partnerName(), __mw.net.players(), __mw.net.guest])];
  verifier(ra[0] === 'host' && ra[1] === 'Tom' && ra[2] === 2 && ra[3] === false, `côté hôte : ${JSON.stringify(ra)}`);
  verifier(rb[0] === 'guest' && rb[1] === 'Léa' && rb[2] === 2 && rb[3] === true, `côté invité : ${JSON.stringify(rb)}`);
  verifier(await eb(() => MWC.employer().id === 'meca'), "l'invité ne travaille pas dans le garage de l'hôte");
  verifier(await eb(() => __mw.S.day) === await ea(() => __mw.S.day), 'les deux jeux ne partagent pas le jour');

  // 3. chacun voit l'autre bouger, s'accroupir, conduire
  await ea(() => __mw.teleport(-60, 30, 1.2));
  await eb(() => __mw.teleport(-80, 40, -0.6));
  await attendreCondition(B, () => { const r = __mwnet.remote(); return r && Math.hypot(r.x + 60, r.z - 30) < 1.5; }, "l'invité ne voit pas l'hôte à sa place", 15000);
  await attendreCondition(A, () => { const r = __mwnet.remote(); return r && Math.hypot(r.x + 80, r.z - 40) < 1.5; }, "l'hôte ne voit pas l'invité à sa place", 15000);
  const avB = await eb(() => { const a = __mwnet.avatar(); return a && a.g.visible && a.root.parent === __mw.scene && a.sp.material.map ? 1 : 0; });
  verifier(avB === 1, "la silhouette de l'ami n'est pas dans la scène 3D");
  // il marche : la position de l'ami est interpolée (valeurs intermédiaires, jamais un bond), puis arrive à destination
  await eb(() => { window.__sm = []; const f = () => { const r = __mwnet.remote(); if (r) window.__sm.push(r.x); if (r && window.__sm.length < 400) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await ea(() => __mw.teleport(-52, 30, 1.2));
  await attendreCondition(B, () => { const r = __mwnet.remote(); return Math.abs(r.x + 52) < .6; }, "l'ami qui marche n'arrive pas à destination", 20000);
  const trace = await eb(() => window.__sm);
  const inter = trace.filter(x => x < -53 && x > -59.5);
  let recul = 0;
  for (let i = 1; i < trace.length; i++) if (trace[i] < trace[i - 1] - 1e-6) recul++;
  verifier(inter.length >= 2 && recul === 0, `le déplacement de l'ami n'est pas lissé (${inter.length} positions intermédiaires, ${recul} reculs)`);
  // accroupi
  await ea(() => { __mw.eyeY = 1.0; });
  await attendreCondition(B, () => __mwnet.remote().crouch === true, "l'ami accroupi n'est pas vu accroupi", 10000);
  await ea(() => { __mw.eyeY = 0; });
  // en voiture
  await ea(() => { const p = __mw.playerCar(); __mw.teleport(p.x + 1.2, p.z, 0); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })); });
  await attendreCondition(B, () => { const r = __mwnet.remote(); return r && r.inCar; }, "l'ami au volant n'est pas vu en voiture", 10000);
  await ea(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })); });
  await attendreCondition(B, () => { const r = __mwnet.remote(); return r && !r.inCar; }, "l'ami descendu de voiture est encore vu en voiture", 10000);
  await ea(() => __mw.teleport(-60, 40, 0));
  await eb(() => __mw.teleport(-67, 40, Math.PI / 2, 0.05));
  await attendreCondition(B, () => { const r = __mwnet.remote(); return r && Math.abs(r.x + 60) < .5 && Math.abs(r.z - 40) < .5; }, "l'ami ne se place pas devant l'invité", 20000);
  await attendre(500);
  await capturer(B, '3-vue-invite');

  // 4. deux fois plus de clients : un pont par joueur
  await ea(() => { __mwj.clear(); __mw.S.min = 600; __mw.S.jobs.next = 0; __mw.addMin(40); });
  const nDuo = await ea(() => __mwj.jobs().length);
  verifier(nDuo === 2, `à deux, il devrait y avoir un pont par joueur (${nDuo} voitures)`);
  await attendreCondition(B, () => __mwj.jobs().length === 2, "l'invité ne voit pas les voitures de l'hôte", 15000);
  const ids = await ea(() => __mwj.jobs().map(c => c.id).sort().join());
  verifier(ids === await eb(() => __mwj.jobs().map(c => c.id).sort().join()), 'les deux joueurs ne voient pas les mêmes voitures');
  verifier(await eb(() => __mwj.jobs().every(c => !!__mwj.mesh(c))), "l'invité n'a pas les voitures en 3D");
  await ea(() => { __mwj.clear(); __mw.S.jobs.next = 1e12; });
  await attendreCondition(B, () => __mwj.jobs().length === 0, "l'invité garde des voitures que l'hôte n'a plus", 15000);

  // 5. gestes à deux sur la même voiture : l'un lève le pont, l'autre ouvre le capot
  await ea(() => { for (const k of ['entretien', 'moteur', 'freinage', 'liaison']) __mw.S.xp[k] = 900; __mw.S.jobs.outils.cle_dyn = 1; });
  await eb(() => { for (const k of ['entretien', 'moteur', 'freinage', 'liaison']) __mw.S.xp[k] = 900; __mw.S.jobs.outils.cle_dyn = 1; });
  const xpA0 = await ea(() => JSON.stringify(__mw.S.xp));
  await ea(() => __mwj.spawn({ travaux: ['batterie', 'plaq_av'], silencieux: true }));
  await attendreCondition(B, () => __mwj.jobs().length === 1, "l'invité ne reçoit pas la voiture", 15000);
  const idV = await ea(() => __mwj.jobs()[0].id);
  const pres = async p => p.evaluate(() => { const c = __mwj.jobs()[0], q = __mw.zone(c.zone).ponts[c.pont]; const x = q.x + Math.cos(q.ry) * 1.6, z = q.z - Math.sin(q.ry) * 1.6; __mw.teleport(x, z, Math.atan2(q.x - x, q.z - z), .1); MWG.ensure(c); });
  await pres(A);
  await pres(B);
  await attendreCondition(B, () => /pont \d/.test(__mwnet.friendText()), "l'indication « Votre ami est au pont N » n'apparaît pas", 15000);
  const ami = await eb(() => document.getElementById('mwFriend') ? document.getElementById('mwFriend').textContent : '');
  verifier(/^Votre ami est au pont \d$/.test(ami), `indication de l'ami inattendue : ${ami}`);
  const r1 = await ea(() => MWG.run('lift', 'raise'));
  verifier(!r1, `l'hôte ne peut pas lever le pont : ${r1}`);
  const r2 = await eb(() => MWG.run('hood', 'hopen'));
  verifier(!r2, `l'invité ne peut pas ouvrir le capot : ${r2}`);
  await attendreCondition(A, () => { const c = __mwj.jobs()[0]; return c.st.lifted === 1 && c.st.capot === 1; }, "l'hôte ne voit pas à la fois le pont levé et le capot ouvert", 15000);
  await attendreCondition(B, () => { const c = __mwj.jobs()[0]; return c.st.lifted === 1 && c.st.capot === 1; }, "l'invité ne voit pas à la fois le pont levé et le capot ouvert", 15000);
  await capturer(A, '5-gestes-hote');
  await capturer(B, '5-gestes-invite');

  // 5b. l'ami tient un geste sur le capot : le même geste est refusé tout de suite à l'autre joueur
  await ea(() => { window.__h0 = MWG.holding; MWG.holding = () => ({ car: __mwj.jobs()[0].id, target: 'hood' }); });
  await attendreCondition(B, id => { const m = __mwnet.busyMsg(id, 'hood'); return !!m && /Léa/.test(m); }, "l'invité n'est pas prévenu que l'hôte travaille déjà sur le capot", 15000, idV);
  const refus = await eb(() => MWG.run('hood', 'hclose'));
  verifier(/déjà en train de travailler/.test(refus || ''), `le geste sur la même cible n'est pas refusé (${refus})`);
  await ea(() => { MWG.holding = window.__h0; });
  await attendreCondition(B, id => !__mwnet.busyMsg(id, 'hood'), "l'indication « déjà en train » ne disparaît pas", 15000, idV);

  // 6. la même pièce en même temps : le 2e geste est refusé et annulé (échanges retenus pour simuler deux gestes simultanés)
  await ea(() => __mwnet.freeze(true));
  await eb(() => __mwnet.freeze(true));
  const [da, db] = [await ea(() => { const c = __mwj.jobs()[0]; return MWJ.L.doDep(c, 'batterie'); }), await eb(() => { const c = __mwj.jobs()[0]; return MWJ.L.doDep(c, 'batterie'); })];
  verifier(da === true && db === true, `les deux dépôts simultanés auraient dû réussir localement (${da}, ${db})`);
  await ea(() => __mwnet.freeze(false));
  await eb(() => __mwnet.freeze(false));
  await attendreCondition(B, () => !__mw.S.inv.some(i => i.k === 'usagee' && i.id === 'batterie'), "l'invité garde la batterie que l'hôte a déjà démontée", 15000);
  verifier(await ea(() => __mw.S.inv.some(i => i.k === 'usagee' && i.id === 'batterie')), "l'hôte a perdu sa batterie démontée");
  verifier(await ea(() => __mwj.jobs()[0].rem.batterie === 1) && await eb(() => __mwj.jobs()[0].rem.batterie === 1), 'la batterie n\'est pas démontée des deux côtés');
  const toast = await eb(() => [...document.querySelectorAll('.mw-t')].map(e => e.textContent).join(' | '));
  verifier(/Trop tard/.test(toast), `l'invité n'est pas prévenu que son geste est annulé (${toast})`);
  // pièces différentes en même temps : tout passe
  await ea(() => __mwnet.freeze(true));
  await eb(() => __mwnet.freeze(true));
  const pb = await eb(() => { const c = __mwj.jobs()[0]; __mw.S.inv.push({ k: 'neuve', id: 'batterie', src: 'etagere' }); return MWJ.L.doPose(c, 'batterie'); });
  verifier(pb === true, 'l\'invité ne peut pas reposer une batterie neuve');
  await ea(() => __mwnet.freeze(false));
  await eb(() => __mwnet.freeze(false));
  await attendreCondition(A, () => __mwj.jobs()[0].done.batterie === 1, "l'hôte ne voit pas la batterie reposée par l'invité", 15000);

  // 7. argent commun, expérience propre
  const m0 = await ea(() => __mw.S.money);
  await eb(() => __mw.money(40, 'essai invité'));
  await attendreCondition(A, m => Math.abs(__mw.S.money - (m + 40)) < .01, "l'argent gagné par l'invité n'arrive pas dans la caisse de l'hôte", 15000, m0);
  await attendreCondition(B, m => Math.abs(__mw.S.money - (m + 40)) < .01, "l'invité ne voit pas la caisse commune", 15000, m0);
  await ea(() => __mw.money(-15, 'essai hôte'));
  await attendreCondition(B, m => Math.abs(__mw.S.money - (m + 25)) < .01, "la dépense de l'hôte n'est pas vue par l'invité", 15000, m0);
  // l'invité rend une voiture simple : paie dans la caisse commune, expérience pour lui seul
  await ea(() => { __mwj.clear(); __mw.S.inv.length = 0; });
  await attendreCondition(B, () => __mwj.jobs().length === 0, "l'invité garde l'ancienne voiture", 15000);
  await ea(() => __mwj.spawn({ tpl: 'essuie', silencieux: true }));
  await attendreCondition(B, () => __mwj.jobs().length === 1, "l'invité ne reçoit pas la 2e voiture", 15000);
  const xpB0 = await eb(() => JSON.stringify(__mw.S.xp));
  const xpA1 = await ea(() => JSON.stringify(__mw.S.xp));
  const mA = await ea(() => __mw.S.money);
  const rendu = await eb(() => {
    const c = __mwj.jobs()[0]; c.st.lifted = 0;
    __mw.S.inv.push({ k: 'neuve', id: 'essuie', src: 'etagere' });
    MWJ.L.doDep(c, 'essuie'); MWJ.L.doPose(c, 'essuie');
    return !!MWJ.done(c);
  });
  verifier(rendu, "l'invité n'arrive pas à rendre la voiture");
  await attendreCondition(A, () => __mwj.jobs().length === 0, "la voiture rendue par l'invité reste chez l'hôte", 15000);
  await attendreCondition(A, m => __mw.S.money > m + 1, "la paie de l'invité n'arrive pas dans la caisse commune", 15000, mA);
  verifier(await eb(() => JSON.stringify(__mw.S.xp)) !== xpB0, "l'invité n'a pas gagné d'expérience");
  verifier(await ea(() => JSON.stringify(__mw.S.xp)) === xpA1, "l'expérience de l'invité a fuité chez l'hôte");

  // 8. le temps : pas de sommeil sans l'accord des deux ; le menu ne met en pause qu'un écran
  await ea(() => { __mw.S.min = 1200; });
  await attendreCondition(B, () => __mw.S.min >= 1195, "l'heure de l'hôte n'arrive pas chez l'invité", 15000);
  await eb(() => __mw.sleep());
  await attendre(1800);
  const apres = await ea(() => __mw.S.min);
  verifier(apres >= 1195 && apres < 1300, `l'hôte a dormi alors qu'il n'avait pas donné son accord (${apres})`);
  verifier(await ea(() => { const h = document.querySelector('[data-h="netsleep"]'); return !!h && /veut dormir/.test(h.textContent); }), "l'hôte n'est pas prévenu que son ami veut dormir");
  await ea(() => __mw.sleep());
  await attendreCondition(A, () => __mw.S.min >= 440 && __mw.S.min <= 470, 'la nuit ne passe pas quand les deux dorment', 20000);
  await attendreCondition(B, () => __mw.S.min >= 440 && __mw.S.min <= 470, "l'invité ne se réveille pas avec l'hôte", 20000);
  // menu : pause locale seulement
  await ea(() => __mw.menu());
  const t0 = await ea(() => ({ paused: __mw.paused, min: __mw.S.min }));
  verifier(t0.paused, 'le menu ne met pas l\'écran en pause');
  await attendre(4000);
  const t1 = await ea(() => ({ min: __mw.S.min }));
  const dm = (t1.min - t0.min + 1440) % 1440;
  verifier(dm >= 1 && dm < 30, `le monde ne continue pas derrière le menu de l'hôte (${dm} min en 4 s)`);
  await attendreCondition(B, m => (__mw.S.min - m + 1440) % 1440 >= 1, "l'horloge de l'invité s'arrête quand l'hôte ouvre son menu", 15000, t0.min);
  await ea(() => __mw.closePanel());

  // 9. messages courts
  await ea(() => __mwnet.chat('Je prends le pont 2'));
  await attendreCondition(B, () => [...document.querySelectorAll('.mw-t')].some(e => /Léa : Je prends le pont 2/.test(e.textContent)), "le message n'arrive pas chez l'ami", 15000);
  await attendre(900);
  await eb(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT' })));
  await attendreVisible(B, '#mwNetChat', 'la touche T n\'ouvre pas la saisie du message');
  await B.fill('#mwNetChat', 'Bien reçu');
  await B.press('#mwNetChat', 'Enter');
  await attendreCondition(A, () => [...document.querySelectorAll('.mw-t')].some(e => /Tom : Bien reçu/.test(e.textContent)), "la réponse tapée avec T n'arrive pas", 15000);

  // 10. déconnexion propre : l'invité retrouve sa partie solo (avec son expérience), l'hôte continue seul
  const xpFin = await eb(() => JSON.stringify(__mw.S.xp));
  await eb(() => __mwnet.leave());
  const apresB = await eb(() => ({ live: __mwnet.live(), money: __mw.S.money, emp: MWC.employer().id, net: __mw.net.live, xp: JSON.stringify(__mw.S.xp), cars: __mwj.jobs().length, avatar: !!__mwnet.avatar(), restant: document.querySelectorAll('#mwFriend').length }));
  verifier(!apresB.live && !apresB.net, "l'invité est encore en ligne");
  verifier(apresB.money === soloB.money && apresB.emp === soloB.emp, `l'invité n'a pas retrouvé sa partie solo (${JSON.stringify(apresB)} / ${JSON.stringify(soloB)})`);
  verifier(apresB.xp === xpFin, "l'invité a perdu l'expérience gagnée à deux");
  verifier(!apresB.avatar && apresB.restant === 0, "l'invité garde la silhouette ou l'indication de l'ami");
  await attendreCondition(A, () => !__mwnet.live(), "l'hôte ne remarque pas le départ de son ami", 15000);
  const apresA = await ea(() => ({ players: __mw.net.players(), min: __mw.S.min, avatar: !!__mwnet.avatar() }));
  verifier(apresA.players === 1 && !apresA.avatar, "l'hôte croit encore être à deux");
  await attendre(1800);
  verifier(await ea(m => __mw.S.min !== m, apresA.min), "l'horloge de l'hôte s'arrête après le départ de l'ami");
  // l'hôte peut de nouveau accueillir quelqu'un
  const code2 = await ea(() => __mwnet.host({ transport: 'bc', name: 'Léa' }));
  verifier(/^[B-Z]{6}$/.test(code2), 'l\'hôte ne peut pas ouvrir une nouvelle partie à deux');
  await ea(() => __mwnet.leave());

  verifier(erreursB.length === 0, erreursB[0]);
  await B.close().catch(() => {});
  return 'connexion par code, vue de l\'ami, 2 clients, gestes à deux, même pièce refusée, argent commun, sommeil à deux, messages, déconnexion';
}
module.exports = async (page, env) => {
  try { return await mecaDeuxJoueurs(page, env); } catch (e) { if (process.env.DEBUG_MP) console.error(e.stack); throw e; }
};
module.exports.titre = 'Mécanicien : jouer à deux en ligne (2 joueurs)';
