'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes, verifierPasDeDebordement } = require('../outils.js');

// Mode Mécanicien (prise en main) : touches d'outils sur clavier AZERTY, pièces neuves à prendre annoncées dès le début,
// servante à outils, étagère « Prendre les pièces des ordres en cours », un seul inventaire (1 à 0, X, V), guide du mécanicien (H, niveaux 0 à 5).
module.exports = async function mecaGuide(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && window.__mwgd && typeof MWG !== 'undefined', null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  const touche = (key, code, shift) => e(([key, code, shift]) => window.dispatchEvent(new KeyboardEvent('keydown', { key, code, shiftKey: !!shift, bubbles: true })), [key, code, shift]);

  // 1. vidange en gestes réalistes, inventaire vide : le bandeau annonce les pièces à prendre AVANT de commencer
  await e(() => {
    MWG.set({ classic: false }); MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; __mw.S.inv.length = 0; __mwj.invUI();
    const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false }), p = __mw.zone(c.zone).ponts[c.pont];
    __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c);
  });
  const bandeau = () => { const h = document.querySelector('.mg-hint'); return h && !h.hidden ? h.textContent : ''; };
  await page.evaluate(`window.__bandeau = ${bandeau.toString()}`);
  await attendreCondition(page, () => /Pièce neuve à aller chercher : .*Huile.*Filtre à huile|Pièce neuve à aller chercher : .*Filtre à huile.*Huile/.test(__bandeau()),
    "le bandeau n'annonce pas l'huile et le filtre à prendre avant la vidange", 10000);

  // 2. pas d'outil dans les poches : on vise la servante (chariot rouge), E, « Prendre les outils de l'ordre »
  await touche('é', 'Digit2');
  verifier(await e(() => MWG.curTool()) === 'main', "un outil est en main alors que l'inventaire est vide");
  await e(() => { const r = MWG.rig(), v = new THREE.Vector3(); r.cart.getWorldPosition(v); v.y += .8; const p = r.p;
    const x = v.x + Math.sin(p.ry) * 1.2, z = v.z + Math.cos(p.ry) * 1.2; __mw.teleport(x, z, Math.atan2(v.x - x, v.z - z), Math.atan2(v.y - 1.7, Math.hypot(v.x - x, v.z - z))); });
  await attendreCondition(page, () => { const a = MWG.aim(); return a && a.t.id === 'servante'; }, 'la servante ne se vise pas', 8000);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn [data-mw="need"]', "la servante ne propose pas les outils de l'ordre");
  await cliquer(page, '.mw-pn [data-mw="need"]');
  const outils = await e(() => __mw.S.inv.filter(it => it.k === 'outil').map(it => it.id));
  verifier(['bac', 'cliquet', 'cle_dyn', 'entonnoir', 'bidon', 'cle_filtre'].every(t => outils.includes(t)), `les outils de la vidange ne sont pas pris (${outils})`);
  await page.keyboard.press('Escape');
  await attendreCondition(page, () => !__mw.paused, 'la servante ne se ferme pas', 8000);
  // clavier AZERTY : la touche « 2 » donne « é » sans Maj, elle prend quand même l'objet de la case 2 (position de la touche)
  await touche('é', 'Digit2');
  verifier(await e(() => MWG.curTool() === __mw.S.inv[1].id && __mwj.held() === __mw.S.inv[1]), "la touche 2 d'un clavier AZERTY ne prend pas l'outil de la case 2");
  await touche('(', 'Digit5');
  verifier(await e(() => MWG.curTool() === __mw.S.inv[4].id), "la touche 5 d'un clavier AZERTY ne prend pas l'outil de la case 5");
  await touche('v', 'KeyV');
  verifier(await e(() => MWG.curTool()) === 'main', 'V ne libère pas les mains');

  // 3. étagère : « Prendre les pièces des ordres en cours »
  await e(() => { const s = __mwj.shelf('garage1'); __mw.teleport(s.x, s.z, 0, 0); });
  await attendreCondition(page, () => { const p = document.getElementById('mwPrompt'); return p && !p.hidden && /Étagère/.test(p.textContent); }, "pas d'invite devant l'étagère", 10000);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "l'étagère ne s'ouvre pas");
  await cliquer(page, '.mw-pn [data-mw="need"]', 'bouton « Prendre les pièces des ordres en cours » absent');
  const inv = await e(() => __mw.S.inv.filter(it => it.k !== 'outil').map(it => it.k + ':' + it.id).sort().join(','));
  verifier(inv === 'neuve:filtre_huile,neuve:huile', `les pièces des ordres ne sont pas prises (${inv})`);
  await page.keyboard.press('Escape');
  await attendreCondition(page, () => !__mw.paused, "l'étagère ne se ferme pas", 8000);
  await e(() => { const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); });
  await attendreCondition(page, () => /Étape suivante/.test(__bandeau()) && !/Pièce neuve à aller chercher/.test(__bandeau()), 'le bandeau réclame encore des pièces déjà prises', 10000);

  // 4. objet en main : 1, X, V, et montage prioritaire de la pièce tenue
  await touche('&', 'Digit1');
  verifier(await e(() => __mwj.held() === __mw.S.inv[0]), "la touche 1 ne prend pas l'objet de la case 1");
  verifier(await e(() => /En main/.test(document.getElementById('mwRoot').textContent) && !!document.querySelector('.mw-slot.sel')), "la pièce en main n'est pas affichée");
  await touche('x', 'KeyX');
  verifier(await e(() => __mwj.held() === __mw.S.inv[1]), "X ne passe pas à l'objet suivant");
  await touche('v', 'KeyV');
  verifier(await e(() => __mwj.held() === null), 'V ne range pas la pièce');
  const pose = await e(() => {
    __mwj.clear(); MWG.set({ classic: true }); MWC.hire('patron'); __mw.S.xp.liaison = 50; __mw.S.inv.length = 0;
    const c = __mwj.spawn({ tpl: 'pneus', force: true, rend: false }); c.st = { capot: 0, lifted: 1, av: 1, ar: 1 }; c.rem.pneus = 1;
    __mw.S.inv.push({ k: 'neuve', id: 'pneus', src: 'achat', paye: 240 }, { k: 'usagee', id: 'pneus', u: 25, job: 'autre', pv: 240 });
    __mwj.take(1); __mwj.L.doPose(c, 'pneus');
    return { re: !!c.reemp.pneus, reste: __mw.S.inv.map(it => it.k).join(',') };
  });
  verifier(pose.re && pose.reste === 'neuve', `la pièce tenue en main n'est pas montée en priorité (${JSON.stringify(pose)})`);

  // 5. guide du mécanicien : H, six chapitres, la vidange pas à pas
  await touche('h', 'KeyH');
  await attendreVisible(page, '.mw-pn', 'la touche H n\'ouvre pas le guide');
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('Guide du mécanicien'), "le guide ne s'ouvre pas");
  for (let n = 0; n <= 5; n++) {
    await cliquer(page, `.mw-pn [data-mw="gd:${n}"]`, `onglet niveau ${n} absent`);
    await attendre(150);
    const t = await e(() => { document.querySelectorAll('.mw-pn details').forEach(d => { d.open = true; }); return document.querySelector('.mw-pn').textContent; });
    verifier(t.includes(`Niveau ${n}`), `le chapitre ${n} ne s'affiche pas`);
    if (n === 1) verifier(/Placer le bac sous le carter/.test(t) && /Verser l'huile/.test(t) && /Huile moteur \(5 l\)/.test(t), 'la vidange pas à pas manque au niveau 1');
    await verifierTextes(page, `guide niveau ${n}`);
    await verifierPasDeDebordement(page, `guide niveau ${n}`);
  }
  return 'touches AZERTY, pièces annoncées avant la vidange, étagère en un clic, servante, un seul inventaire (1 à 0, X, V), guide niveaux 0 à 5';
};

module.exports.titre = 'mécanicien : prise en main (guide 0 à 5, touches d\'inventaire, pièces à prendre)';
module.exports.appareil = 'bureau';
