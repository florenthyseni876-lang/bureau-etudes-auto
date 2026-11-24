'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (employés) : annonce → CV reçus → tri → convocation → entretien en scène (choix de dialogue qui changent la réponse et
// l'issue) → embauche → l'employé, visible, marche jusqu'au pont et finit une voiture seul → salaire prélevé sur le compte du garage →
// le garage tourne pendant que le joueur est ailleurs.
module.exports = async function mecaEmployes(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWEMP !== 'undefined' && typeof MWPUP !== 'undefined', null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  const clic = async (a) => { await cliquer(page, `.mw-pn [data-mw="${a}"]`, `bouton ${a} absent`); await attendre(150); };

  // 0. patron du Garage du Coin, compte du garage approvisionné
  await e(() => { MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; MWS.ensure('garage1'); MWS.deposit('garage1', 30000, 'test'); });
  verifier(await e(() => MWEMP.canManage('garage1')), 'le Garage du Coin repris en patron devrait être gérable');
  verifier(!(await e(() => MWEMP.canManage('garage2'))), 'Ventoux ne devrait pas être gérable (pas à nous)');

  // 1. ordinateur du bureau : menu, annonce
  const pc = await e(() => { const z = __mw.zone('garage1'); return { x: z.pc.x, z: z.pc.z }; });
  await e(([x, z]) => __mw.teleport(x, z, 0), [pc.x, pc.z]);
  await attendre(400);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "E devant l'ordinateur n'ouvre pas le menu du bureau");
  verifier(/Recruter/.test(await e(() => document.querySelector('.mw-pn').textContent)), 'le menu du bureau ne propose pas de recruter');
  const solde0 = await e(() => MWS.solde('garage1'));
  await clic('ann');
  await clic('pub');
  verifier((await e(() => MWEMP.G('garage1').ann.length)) === 1, "l'annonce n'est pas publiée");
  verifier((await e(() => MWS.solde('garage1'))) < solde0, "les frais d'annonce ne sont pas prélevés sur le compte du garage");

  // 2. CV reçus et tri
  await e(() => { __mw.closePanel(); MWEMP.arrive('garage1', 4); });
  const n = await e(() => MWEMP.cvList('garage1').length);
  verifier(n === 4, `les CV n'arrivent pas (${n})`);
  const cv0 = await e(() => MWEMP.cvList('garage1').map(c => ({ ok: !!(c.nom && c.age && c.pret && c.decl && c.exp), decl: Object.keys(c.decl).length })));
  verifier(cv0.every(c => c.ok && c.decl >= 7), 'les CV sont incomplets');
  await e(() => { const z = __mw.zone('garage1'); __mw.teleport(z.pc.x, z.pc.z, 0); });
  await attendre(300);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', 'le menu du bureau ne se rouvre pas');
  await clic('cv');
  verifier((await e(() => document.querySelectorAll('.mw-pn .emp-cv').length)) === 4, "la liste des CV n'affiche pas les 4 candidats");
  verifier(await e(() => !!document.querySelector('.mw-pn .emp-av').src.startsWith('data:image')), "les avatars des CV sont absents");
  await clic('f:tri:comp');
  await clic('f:dom:moteur');
  const filtre = await e(() => document.querySelectorAll('.mw-pn .emp-cv').length);
  await clic('f:dom:tous');
  const cvId = await e(() => MWEMP.cvList('garage1')[0].id);
  await clic('open:' + cvId);
  verifier(/Expériences/.test(await e(() => document.querySelector('.mw-pn').textContent)), 'la fiche détaillée du CV ne s\'affiche pas');
  await clic('keep:' + cvId);
  verifier((await e(([id]) => MWEMP.cvList('garage1').find(c => c.id === id).statut, [cvId])) === 'garde', 'le CV n\'est pas mis de côté');
  const slot0 = await e(() => { const t = document.querySelector('.mw-pn [data-mw^="conv:"]'); return t ? t.dataset.mw : null; });
  verifier(slot0, 'aucun créneau de convocation proposé');
  await clic(slot0);
  verifier((await e(([id]) => MWEMP.cvList('garage1').find(c => c.id === id).statut, [cvId])) === 'convoque', 'le candidat n\'est pas convoqué');
  await e(() => __mw.closePanel());

  // 3. le candidat arrive à l'heure : visible, assis au bureau
  await e(() => { const g = MWEMP.G('garage1'); g.rdv[0].due = 0; __mw.addMin(1); });
  verifier((await e(() => MWEMP.G('garage1').rdv[0].etat)) === 'arrive', "le candidat n'arrive pas à l'heure du rendez-vous");
  await attendreCondition(page, () => Object.keys(MWEMP.CANDS).length === 1, "le candidat n'est pas dessiné (personnage 3D absent)", 10000);

  // 4. entretien interactif : deux candidats aux personnalités contrôlées, mêmes choix « piège » / « aimable » → réponses différentes
  const prep = async (stress, honnete) => { await e(([s, h]) => { const g = MWEMP.G('garage1'); const r = g.rdv[0], c = g.cv.find(x => x.id === r.cv); c.perso.stress = s; c.perso.honnete = h; c.perso.courtoisie = .6; c.perso.ponct = .8; c.perso.motiv = .8; c.faux = false; c.enj = false; }, [stress, honnete]); };
  await prep(.85, .8);
  await e(() => { const z = __mw.zone('garage1'); __mw.teleport(z.pc.x, z.pc.z, 0); });
  await attendre(300);
  await page.keyboard.press('e'); await attendreVisible(page, '.mw-pn', 'menu'); await clic('rdv');
  await clic('go:' + await e(() => MWEMP.G('garage1').rdv[0].id));
  await attendreVisible(page, '.emp-say', "la scène d'entretien ne démarre pas");
  const pos = await e(() => { const z = __mw.zone('garage1'), pl = __mw.player(), s = MWEMP.stationOf(z, 'seat'); return { d: Math.hypot(pl.x - s.x, pl.z - s.z), dlg: !!document.querySelector('.mw-pw.emp-dlg') }; });
  verifier(pos.d > 1.5 && pos.d < 4.5 && pos.dlg, `la caméra de dialogue n'est pas placée face au candidat (distance ${pos.d})`);
  // choix « piège » (4e) : un candidat stressé s'énerve
  await clic('ch:3');
  const rep1 = await e(() => document.querySelector('.emp-say').textContent);
  verifier(/énerve|regarde/.test(rep1), `un candidat stressé devrait s'énerver au choix piège (« ${rep1} »)`);
  const humeur1 = await e(() => MWEMP.IV().mood);
  // suite : parcours, deux questions techniques, mise en situation, motivation, salaire : 6 échanges
  for (let i = 0; i < 5; i++) { await clic('ch:0'); }
  verifier(/Salaire|salaire|Il\/elle maintient/.test(await e(() => document.querySelector('.mw-pn').textContent)) || await e(() => MWEMP.IV().step >= 6), 'l\'entretien ne suit pas ses étapes');
  // l'issue dépend des choix : salaire −20 % proposé à un candidat froissé → il/elle conteste puis décline
  await clic('ch:2');
  verifier(/trop bas|ne descendrai/.test(await e(() => document.querySelector('.emp-say').textContent)), "un salaire très bas ne provoque pas de contre-proposition");
  await clic('ch:1'); // maintenir l'offre
  verifier((await e(() => MWEMP.IV().step)) === 7, "l'entretien n'arrive pas à la conclusion");
  await clic('c:hire');
  await attendre(300);
  const issueA = await e(() => ({ staff: MWEMP.staff('garage1').length, rdv: MWEMP.G('garage1').rdv.length, pw: !!document.querySelector('.mw-pw.emp-dlg') }));
  verifier(issueA.staff === 0 && !issueA.pw, `le candidat froissé et sous-payé ne devrait pas accepter (équipe : ${issueA.staff})`);
  const pl = await e(() => __mw.player()); verifier(Math.hypot(pl.x - pc.x, pl.z - pc.z) < 1.2, 'le joueur n\'est pas replacé après l\'entretien');

  // 5. un second candidat, calme, accueilli aimablement, payé ce qu'il demande : embauché
  await e(() => { const g = MWEMP.G('garage1'); const c = g.cv.find(x => x.statut === 'nouveau' || x.statut === 'lu'); c.perso.stress = .2; c.perso.honnete = .9; c.perso.courtoisie = .8; c.perso.ponct = .9; c.perso.motiv = .8; c.enj = false; c.faux = false; window.__cvB = c.id; MWEMP.convoquer('garage1', c.id, 0); __mw.addMin(1); });
  await e(() => { const z = __mw.zone('garage1'); __mw.teleport(z.pc.x, z.pc.z, 0); });
  await attendre(300);
  await page.keyboard.press('e'); await attendreVisible(page, '.mw-pn', 'menu'); await clic('rdv');
  await clic('go:' + await e(() => MWEMP.G('garage1').rdv[0].id));
  await attendreVisible(page, '.emp-say', "la 2e scène d'entretien ne démarre pas");
  await clic('ch:0');
  const rep2 = await e(() => document.querySelector('.emp-say').textContent);
  verifier(rep2 !== rep1 && !/énerve/.test(rep2), `l'accueil aimable d'un candidat calme donne la même réponse (« ${rep2} »)`);
  for (let i = 0; i < 5; i++) await clic('ch:0');
  await clic('ch:0'); // salaire : « d'accord pour sa prétention »
  verifier((await e(() => MWEMP.IV().step)) === 7, 'le 2e entretien n\'arrive pas à la conclusion');
  const humeur2 = await e(() => MWEMP.IV().mood); verifier(humeur2 > humeur1, `l'entretien agréable devrait laisser une meilleure ambiance (${humeur2} contre ${humeur1})`);
  await clic('c:hire');
  await attendre(300);
  const emp = await e(() => { const l = MWEMP.staff('garage1'); return l.length ? { id: l[0].id, nom: l[0].nom, poste: l[0].poste, sal: l[0].salaire, sk: l[0].sk } : null; });
  verifier(emp, "le candidat calme et bien payé devrait être embauché");

  // 6. au travail : un client arrive, l'employé va au pont, prend les pièces au stock et rend la voiture seul
  await e(() => { const z = __mw.zone('garage1'), p = z.ponts[0]; __mw.teleport(p.x + 6, p.z - 6, 0); __mw.S.min = 540; __mw.S.jobs.next = 1e12; MWEMP.G('garage1').next = 0; });
  await attendre(300);
  const ca1 = await e(() => MWS.get('garage1').ex.ca);
  await attendreCondition(page, () => { __mw.addMin(1); return __mwj.jobs().some(c => c.staff); }, "aucun client ne vient chez l'équipe", 30000);
  const vis = await e(() => ({ pup: Object.keys(MWEMP.PUPS).length, mesh: __mwj.jobs().filter(c => c.staff).every(c => __mwj.L.hasMesh(c)) }));
  verifier(vis.pup === 1, `l'employé n'est pas dessiné dans l'atelier (${vis.pup} personnage)`);
  const pos0 = await e(() => { const o = Object.values(MWEMP.PUPS)[0].p.g.position; return [o.x, o.z]; });
  let moved = false;
  await attendreCondition(page, () => { __mw.addMin(1); const c = __mwj.jobs().find(x => x.staff); return !c || c.empl; }, "l'employé ne prend pas la voiture", 30000);
  for (let i = 0; i < 40 && !moved; i++) { await e(() => __mw.addMin(1)); await attendre(120); const o = await e(() => { const p = Object.values(MWEMP.PUPS)[0]; return p ? [p.p.g.position.x, p.p.g.position.z] : null; }); if (o && Math.hypot(o[0] - pos0[0], o[1] - pos0[1]) > 1.5) moved = true; }
  verifier(moved, "l'employé ne marche pas dans l'atelier");
  await attendreCondition(page, () => { __mw.addMin(1); const g = MWEMP.G('garage1'); return g.jour.n >= 1; }, "l'employé ne finit pas la voiture seul", 90000);
  const fin = await e(() => ({ caCompte: MWS.get('garage1').ex.ca, n: MWEMP.G('garage1').jour.n, ca: MWEMP.G('garage1').jour.ca }));
  verifier(fin.caCompte > ca1 && fin.ca > 0, `la voiture rendue par l'employé ne crédite pas le compte du garage (${JSON.stringify(fin)})`);

  // 7. salaire prélevé sur le compte du garage (paie hebdomadaire)
  const s2 = await e(() => { const avant = MWS.solde('garage1'); __mw.S.day = Math.ceil(__mw.S.day / 7) * 7; MWEMP.dayStep(); return { avant, apres: MWS.solde('garage1') }; });
  verifier(s2.apres < s2.avant - 100, `le salaire n'est pas prélevé sur le compte du garage (${JSON.stringify(s2)})`);

  // 8. le garage tourne seul : joueur loin, un client est servi sans personnage dessiné
  await e(() => { __mw.teleport(160, 160, 0); __mw.S.min = 540; });
  await attendre(400);
  const ca3 = await e(() => MWS.get('garage1').ex.ca);
  await e(() => { MWEMP.G('garage1').next = 0; MWEMP.G('garage1').jour.n = 0; });
  await attendreCondition(page, (c0) => { __mw.addMin(1); const g = MWEMP.G('garage1'); if (g.jour.n >= 1 && MWS.get('garage1').ex.ca <= c0) { MWEMP.G('garage1').jour.n = 0; MWEMP.G('garage1').next = 0; } return MWS.get('garage1').ex.ca > c0; }, "le garage ne tourne pas quand le joueur est ailleurs", 150000, ca3);
  const loin = await e(() => ({ pup: Object.keys(MWEMP.PUPS).length, ca: MWS.get('garage1').ex.ca }));
  verifier(loin.pup === 0, "des personnages sont dessinés alors que le joueur est loin");
  verifier(loin.ca > ca3, 'le garage ne rapporte rien quand le joueur est ailleurs');
  // 9. gestion : humeur au plus bas → démission ; réceptionniste à l'accueil ; licenciement avec indemnité
  const dem = await e(() => { const e0 = MWEMP.staff('garage1')[0]; e0.humeur = 5; e0.bas = 1; MWEMP.dayStep(); return MWEMP.staff('garage1').length; });
  verifier(dem === 0, "un employé à bout ne démissionne pas");
  const rec = await e(() => { const g = MWEMP.G('garage1'); const cv = MWEMP.genCV('garage1', 'receptionniste', 1800, .7); g.cv.push(cv); const r = MWEMP.hire('garage1', cv.id, 1800);
    const z = __mw.zone('garage1'); __mw.teleport(z.x, z.z + 6, 0); __mw.S.min = 600; __mw.addMin(1); return !!r; });
  verifier(rec, "la réceptionniste n'est pas embauchée");
  await attendre(500);
  const rp = await e(() => { __mw.addMin(1); const o = Object.values(MWEMP.PUPS)[0]; return o ? o.p.pose : null; });
  verifier(rp === 'clavier' || rp === 'idle', `la réceptionniste n'est pas visible à l'accueil (${rp})`);
  const lic = await e(() => { const e1 = MWEMP.staff('garage1')[0], avant = MWS.solde('garage1'), sal = e1.salaire; MWEMP.fire('garage1', e1.id); return { avant, apres: MWS.solde('garage1'), sal, n: MWEMP.staff('garage1').length }; });
  verifier(lic.n === 0 && Math.abs((lic.avant - lic.apres) - lic.sal) < .02, `le licenciement ne verse pas une indemnité d'un mois (${JSON.stringify(lic)})`);
  const n2 = await e(() => __mw.renderer().info.render.calls);
  return `annonce, ${n} CV, tri, 2 entretiens (issues différentes), embauche, employé visible qui marche et rend une voiture, salaire prélevé, garage autonome, démission, réceptionniste, licenciement (${n2} appels de dessin)`;
};
module.exports.titre = 'mécanicien (employés) : annonce, CV, entretien, embauche, travail visible, salaires, garage autonome';
