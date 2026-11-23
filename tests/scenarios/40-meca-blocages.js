'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien — blocages relevés par le testeur : étagère du Garage du Coin (pièces des gros travaux), raison du bouton
// « S'inscrire » grisé, valise annoncée, 2e voiture du tutoriel = vidange, remise en état rentable seulement, messages
// qui ne recouvrent pas la barre de boutons, aide « l'huile s'écoule », versement d'huile (repère maxi, aspiration).
module.exports = async function mecaBlocages(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined' && typeof MWO !== 'undefined', null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);

  // 1. gros travail accepté (embrayage) : l'atelier n'a pas la pièce, l'employeur la commande à l'arrivée du client (livraison le lendemain)
  const s1 = await e(() => {
    MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; MWST.R().cmd.length = 0;
    while (MWST.qty('garage1', 'embrayage') > 0) MWST.take('garage1', 'embrayage');
    __mwj.spawn({ travaux: ['embrayage'], silencieux: true });
    return { stock: MWST.qty('garage1', 'embrayage'), cmd: MWST.pendQty('garage1', 'embrayage'), autre: MWST.pendQty('garage1', 'alternateur') };
  });
  verifier(s1.stock === 0 && s1.cmd === 1, `la pièce du gros travail n'est pas commandée par l'employeur (${JSON.stringify(s1)})`);
  verifier(s1.autre === 0, "l'employeur commande une pièce que personne n'a demandée");

  // 2. centre de formation : la raison du bouton grisé est écrite
  await e(() => { __mw.S.money = 50; const z = __mw.zone('ecole'), p = z.accueil || z.porte; __mw.teleport(p.x + 1.3, p.z, -Math.PI / 2); });
  await attendre(350);
  await page.keyboard.press('e');
  await attendreVisible(page, '.mw-pn', "E devant le centre de formation n'ouvre pas de panneau");
  const s2 = await e(() => document.querySelector('.mw-pn').textContent);
  verifier(/Inscription impossible/.test(s2) && /il vous faut/.test(s2), "le centre de formation n'explique pas pourquoi « S'inscrire » est grisé : " + s2.slice(0, 160));
  await e(() => { __mw.closePanel && __mw.closePanel(); });

  // 3. valise de diagnostic : annoncée (bouton) avant l'achat
  const s3 = await e(() => {
    __mwj.clear(); __mw.S.jobs.next = 1e12; __mw.S.jobs.outils = { cles: 1 }; __mw.S.flags.valiseVue = false;
    const c = __mwj.spawn({ symp: 'feu', silencieux: false }); const toast = document.getElementById('mwToasts').textContent;
    return { toast, c: !!c };
  });
  verifier(/valise de diagnostic/i.test(s3.toast), "la première panne n'annonce pas la valise à acheter");

  // 4. tutoriel : la 2e voiture est une vidange tant qu'aucune n'a été une vidange
  const s4 = await e(() => {
    __mwj.clear(); const j = __mw.S.jobs; j.vidSeen = 0; j.stats.rendues = 1; j.next = 1e12;
    const c = __mwj.spawn({ silencieux: true }); return c ? c.nom : null;
  });
  verifier(s4 === 'Vidange', `la 2e voiture du tutoriel n'est pas une vidange (${s4})`);

  // 7. remise en état : proposée seulement si elle rapporte
  const s7 = await e(() => {
    const bat = { k: 'usagee', id: 'batterie', u: 80, pv: 95 }, alt = { k: 'usagee', id: 'alternateur', u: 80, pv: 180 };
    return { bat: MWO.renOK(bat), alt: MWO.renOK(alt) };
  });
  verifier(s7.bat === false, "la remise en état d'une batterie très usée est proposée alors qu'elle ne rapporte rien");

  // 10. messages : le conteneur ne recouvre pas la barre de boutons du haut
  await e(() => { for (let i = 0; i < 4; i++) __mw.toast('Message de test numéro ' + i + ' assez long pour occuper la largeur', 'info'); });
  await attendre(300);
  const s10 = await e(() => {
    const t = document.getElementById('mwToasts').getBoundingClientRect(), bs = [...document.querySelectorAll('#mwRoot button')].filter(b => b.offsetParent && b.getBoundingClientRect().top < 60 && b.getBoundingClientRect().width > 0);
    const rec = bs.filter(b => { const r = b.getBoundingClientRect(); return r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top; }).map(b => b.textContent.trim());
    return { rec, n: bs.length };
  });
  verifier(s10.rec.length === 0, 'les messages recouvrent des boutons : ' + s10.rec.join(', '));

  // 14 et 15. huile : aide pendant l'écoulement, repère maxi
  await e(() => { MWG.set({ aide: 'on', classic: false }); __mwj.clear(); __mw.S.inv.length = 0;
    const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false, silencieux: true }); for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'etagere' });
    const p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); });
  await attendre(500);
  await e(() => MWG.run('lift', 'raise'));
  await attendreCondition(page, () => __mwj.meshY(__mwj.jobs()[0]) > 1.6, 'le pont ne monte pas', 60000);
  await e(() => { MWG.run('bac', 'bacon'); MWG.run('plug', 'pl1'); MWG.run('plug', 'pl0'); });
  await attendreCondition(page, () => /s'écoule/.test((document.querySelector('.mg-hint') || {}).textContent || '') && /attendez/.test(document.querySelector('.mg-hint').textContent), "l'aide ne dit pas d'attendre pendant l'écoulement de l'huile", 20000);
  // 15 : trop d'huile versée (neuf litres) puis aspirée à la jauge, capot ouvert
  const p15 = await e(() => { const c = __mwj.jobs()[0], O = c.g.o; c.st.capot = 1; O.pour = 9; O.over = 1; MWG.run('dip', 'asp'); return { pour: O.pour, over: O.over }; });
  verifier(p15.over === 0 && p15.pour < 8, `l'excédent d'huile ne s'aspire pas (${JSON.stringify(p15)})`);
  return "étagère, formation, valise, tutoriel, remise en état, messages, huile (aide d'attente)";
};

module.exports.titre = 'mécanicien : blocages du testeur (étagère, formation, valise, tutoriel, occasion, messages, huile)';
