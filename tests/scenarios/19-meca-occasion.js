'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier, verifierTextes } = require('../outils.js');

// Mode Mécanicien (revente des pièces usagées) : ferraille selon la matière, annonces d'occasion à l'établi,
// remise en état, client qui veut récupérer ses anciennes pièces, aide « pièce neuve à aller chercher ».
module.exports = async function mecaOccasion(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && window.__mwo, null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  const clic = async (a) => { await cliquer(page, `.mw-pn [data-mw="${a}"]`, `bouton ${a} absent`); await attendre(150); };

  await e(() => {
    MWG.set({ classic: true }); MWC.hire('meca'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    __mw.S.money = 1000; __mw.S.inv.length = 0; __mw.S.xp.electricite = 400; // niveau 3 : remise en état d'un alternateur
    __mw.S.inv.push({ k: 'usagee', id: 'pneus', u: 30, pv: 240, car: 'Renault Clio' }, { k: 'usagee', id: 'alternateur', u: 95, pv: 180, car: 'Peugeot 208' }, { k: 'usagee', id: 'huile', u: 100, pv: 35 });
    __mwj.invUI();
  });

  // 1. ferraille réaliste : l'huile ne rapporte rien, l'alternateur rapporte sa consigne
  const f = await e(() => __mw.S.inv.map(it => ({ id: it.id, f: __mwo.scrap(it), o: __mwo.occV(it) })));
  verifier(f[2].f === 0 && f[0].f === 0 && f[1].f > 20, `valeurs de ferraille incorrectes (${JSON.stringify(f)})`);
  verifier(f[0].o > 50 && f[1].o === 0 && f[2].o === 0, `valeurs d'occasion incorrectes (${JSON.stringify(f)})`);

  // 2. établi : mise en vente des pneus au prix du marché
  await e(() => __mwj.etabli('garage1'));
  await attendreVisible(page, '.mw-pn', "l'établi ne s'ouvre pas");
  verifier((await e(() => document.querySelector('.mw-pn').textContent)).includes('Revendre les anciennes pièces'), "la section de revente est absente de l'établi");
  await clic('occ:pick:0');
  await clic('occ:list:0:juste');
  const a1 = await e(() => ({ ann: __mwo.state().ann.length, inv: __mw.S.inv.length, prix: __mwo.state().ann[0] && __mwo.state().ann[0].prix }));
  verifier(a1.ann === 1 && a1.inv === 2 && a1.prix === f[0].o, `la mise en vente a échoué (${JSON.stringify(a1)})`);

  // 3. remise en état de l'alternateur (électricité niveau 3) puis vente d'occasion
  await clic('occ:ren:0');
  const r = await e(() => { const it = __mw.S.inv.find(x => x.id === 'alternateur'); return { ren: it.ren, u: it.u, o: __mwo.occV(it), m: __mw.S.money }; });
  verifier(r.ren === 1 && r.u === 25 && r.o > 80 && r.m < 1000, `remise en état incorrecte (${JSON.stringify(r)})`);
  await verifierTextes(page, 'établi (revente)');
  await clic('occ:pick:0');
  await clic('occ:list:0:bas');
  const m0 = await e(() => __mw.S.money);
  const n = await e(() => __mwo.tick(true));
  const m1 = await e(() => ({ m: __mw.S.money, ann: __mwo.state().ann.length, v: __mwo.state().ventes }));
  verifier(n === 2 && m1.ann === 0 && m1.v === 2 && m1.m > m0 + 100, `les annonces ne se vendent pas (${n}, ${JSON.stringify(m1)})`);
  await page.keyboard.press('Escape');
  await attendreCondition(page, () => !__mw.paused, "l'établi ne se ferme pas", 8000);

  // 4. un client qui veut récupérer ses anciennes pièces : ni vente ni bac, malus s'il en manque, rendues avec la voiture
  const c = await e(() => {
    __mw.S.inv.length = 0;
    const c = __mwj.spawn({ tpl: 'vidange', rend: true, force: true });
    __mw.S.inv.push({ k: 'usagee', id: 'huile', u: 100, pv: 35, job: c.id, rend: 1 });
    c.done = { huile: 1, filtre_huile: 1 };
    const it = __mw.S.inv[0], bl = __mwj.rendBloq(it), vendu = __mwo.list(0, 'juste');
    const ev = __mwj.evalJob(c);
    return { rend: c.rend, bl, vendu, miss: ev.rendMiss };
  });
  verifier(c.rend && c.bl && !c.vendu, `les pièces à rendre au client ne sont pas protégées (${JSON.stringify(c)})`);
  verifier(c.miss.length === 1 && c.miss[0] === 'filtre_huile', `la pièce manquante n'est pas repérée (${JSON.stringify(c.miss)})`);
  const d = await e(() => { const job = __mwj.done(__mwj.jobs()[0]); return { rendues: job.rendues, reste: __mw.S.inv.length }; });
  verifier(d.rendues === 1 && d.reste === 0, `les anciennes pièces ne sont pas rendues au client (${JSON.stringify(d)})`);

  // 5. gestes : une pièce déposée sans pièce neuve en poche → l'aide dit d'aller la chercher
  await e(() => {
    MWG.set({ classic: false });
    const c = __mwj.spawn({ tpl: 'plaq_av', force: true }), p = __mw.zone(c.zone).ponts[c.pont];
    __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0);
    MWG.ensure(c); c.rem.plaq_av = 1;
  });
  await attendreCondition(page, () => /Pièce neuve à aller chercher/.test(document.getElementById('mwRoot').textContent), "l'aide n'indique pas d'aller chercher la pièce neuve", 10000);
  return 'ferraille selon la matière, annonces d\'occasion, remise en état, pièces rendues au client, aide pièce neuve';
};

module.exports.titre = 'mécanicien : revente des pièces usagées (ferraille, occasion, remise en état)';
module.exports.appareil = 'bureau';
