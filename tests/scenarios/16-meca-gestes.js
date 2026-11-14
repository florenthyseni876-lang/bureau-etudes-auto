'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (gestes réalistes, js/46) : vidange complète geste par geste sur une essence et sur un diesel
// (quantité d'huile conforme à la voiture), plaquettes avant avec écrous serrés en étoile, mauvais outil refusé,
// mode aide, un vrai geste « maintenir E ».
module.exports = async function mecaGestes(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && typeof MWG !== 'undefined' && window.__mwcars, null, { timeout: 15000 });
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);

  await e(() => {
    if (typeof MWC !== 'undefined') MWC.hire('meca');
    __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    for (const k of ['entretien', 'moteur', 'freinage', 'liaison']) __mw.S.xp[k] = 900;
    __mw.S.jobs.outils.cle_dyn = 1;
  });
  verifier(await e(() => MWG.on()), 'les gestes réalistes ne sont pas actifs par défaut');

  // un client dont le moteur a le carburant demandé
  const accueillir = async (tpl, carb) => {
    for (let i = 0; i < 40; i++) {
      const r = await e(([tpl, carb]) => {
        __mwj.clear(); __mwj.spawn({ tpl });
        const c = __mwj.jobs()[0];
        if (!c) return false;
        const f = c.mdl ? __mwcars.get(c.mdl).eng.fuel : null;
        if (carb && f !== carb) return false;
        for (const id of c.ordre) __mw.S.inv.push({ k: 'neuve', id, src: 'etagere' });
        return true;
      }, [tpl, carb]);
      if (r) return;
    }
    throw new Error('aucune voiture ' + carb + ' pour ' + tpl);
  };
  // se place près du pont, regarde vers la voiture
  const pres = () => e(() => {
    const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont];
    const x = p.x + Math.cos(p.ry) * 1.6, z = p.z - Math.sin(p.ry) * 1.6;
    __mw.teleport(x, z, Math.atan2(p.x - x, p.z - z), .1);
    MWG.ensure(c);
  });
  // vise une cible précise (position du joueur sous / à côté de la voiture, caméra braquée dessus)
  const viser = (id) => e((id) => {
    const r = MWG.rig(), t = r.tg.find(q => q.id === id), v = new THREE.Vector3();
    const o = typeof t.o === 'function' ? t.o() : t.o;
    if (t.off) v.copy(t.off).applyMatrix4(o.matrixWorld); else o.getWorldPosition(v);
    const p = r.p, side = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry));
    const x = v.x + side.x * .9, z = v.z + side.z * .9, dx = v.x - x, dz = v.z - z;
    __mw.teleport(x, z, Math.atan2(dx, dz), Math.atan2(v.y - 1.7, Math.hypot(dx, dz)));
  }, id);
  const attendreLevage = (haut) => attendreCondition(page, h => { const c = __mwj.jobs()[0], y = __mwj.meshY(c); return h ? y > 1.6 : y < .3; }, 'le pont ne monte / ne descend pas', 60000, haut);
  const travail = async (arret) => {
    const log = [];
    for (let n = 0; n < 160; n++) {
      const h = await e(() => { MWG.skip(); return MWG.nextHint(); });
      if (!h || h.key === 'door') break;
      const r = await e(([h]) => MWG.run(h.id, h.key), [h]);
      log.push(h.key);
      verifier(!r, `étape refusée « ${h.lab} » : ${r}`);
      if (arret && arret(h)) break;
      await pres();
    }
    return log;
  };

  // 1. mauvais outil et mauvaise douille : refus avec message clair ; mode aide
  await accueillir('vidange', 'essence');
  await pres();
  const aide0 = await e(() => MWG.nextHint());
  verifier(aide0 && aide0.key === 'raise', `l'aide n'indique pas de lever le pont d'abord (${JSON.stringify(aide0)})`);
  await e(() => MWG.set({ aide: 'off' }));
  verifier(!(await e(() => MWG.nextHint())), "l'aide désactivée indique encore une étape");
  await e(() => MWG.set({ aide: 'on' }));
  verifier(!!(await e(() => MWG.nextHint())), "l'aide réactivée n'indique rien");
  await e(() => MWG.run('lift', 'raise'));
  await attendreLevage(true);
  await e(() => MWG.run('bac', 'bacon'));
  const mauvais = await e(() => { MWG.setTool('main'); return MWG.run('plug', 'pl1', { strict: true }); });
  verifier(/Il faut .*cliquet/.test(mauvais || ''), `mauvais outil : message inattendu (${mauvais})`);
  const mauvaise = await e(() => { const a = MWG.acts(__mwj.jobs()[0]).find(x => x.id === 'plug' && x.key === 'pl1'); MWG.setTool('cliquet', a.sock === 8 ? 10 : 8); return MWG.run('plug', 'pl1', { strict: true }); });
  verifier(/douille de \d+/.test(mauvaise || ''), `mauvaise douille : message inattendu (${mauvaise})`);
  verifier(await e(() => __mwj.jobs()[0].g.o.plug === 2), 'un geste refusé a quand même desserré le bouchon');

  // 2. un vrai geste : maintenir E sur le bouchon avec le cliquet et la bonne douille
  await viser('plug');
  await e(() => { const a = MWG.acts(__mwj.jobs()[0]).find(x => x.id === 'plug' && x.key === 'pl1'); MWG.setTool('cliquet', a.sock); });
  await attendreCondition(page, () => MWG.aim() && MWG.aim().t.id === 'plug', "le bouchon de vidange n'est pas visé", 20000);
  await attendreCondition(page, () => /^\[E\]/.test(document.getElementById('mwPrompt').textContent), "aucune invite [E] devant le bouchon", 20000);
  await page.keyboard.down('e');
  await attendreCondition(page, () => __mwj.jobs()[0].g.o.plug === 1, 'maintenir E ne desserre pas le bouchon', 60000);
  await page.keyboard.up('e');
  const t0 = await e(() => __mw.S.min);

  // 3. suite de la vidange sur l'essence, guidée par l'aide
  const log1 = await travail();
  const f1 = await e(() => { const c = __mwj.jobs()[0], O = c.g.o; return { done: c.done, versé: O.pour, cap: __mwcars.oilL(c.mdl), blocage: MWG.blocage(c), min: __mw.S.min, cart: !!MWG.rig().tg.find(t => t.id === 'filt') }; });
  verifier(f1.done.huile === 1 && f1.done.filtre_huile === 1, `vidange incomplète (${JSON.stringify(f1.done)}) : ${log1.join(' ')}`);
  verifier(Math.abs(f1.versé - f1.cap) <= f1.cap * .13 && f1.versé >= f1.cap * .93, `quantité d'huile non conforme : ${f1.versé} l pour ${f1.cap} l`);
  verifier(f1.blocage.length === 0, 'la voiture ne peut pas être rendue : ' + f1.blocage.join(', '));
  const ordre = ['pl0', 'pl3', 'pl2', 'bacoff', 'lower', 'hopen', 'co', 'fu', 'pour'];
  let k = -1;
  for (const s of ordre) { const i = log1.indexOf(s, k + 1); verifier(i > k, `ordre des gestes de vidange anormal (${s}) : ${log1.join(' ')}`); k = i; }
  verifier(log1.includes('f1') && log1.includes('f0') && log1.includes('fg') && log1.includes('fs'), 'le filtre n\'est pas déposé / huilé / vissé : ' + log1.join(' '));
  verifier(f1.min - t0 >= 15, `les gestes n'avancent pas assez l'horloge (${f1.min - t0} min)`);

  // 4. même vidange sur un diesel (filtre cartouche), quantité propre à ce moteur
  await e(() => { MWG.release(); __mwj.clear(); __mw.S.inv.length = 0; });
  await accueillir('vidange', 'diesel');
  await pres();
  const type = await e(() => !!MWG.rig().tg.find(t => t.id === 'filt').name().match(/cartouche/));
  verifier(type, 'le diesel devrait avoir un filtre à cartouche');
  const log2 = await travail();
  const f2 = await e(() => { const c = __mwj.jobs()[0], O = c.g.o; return { done: c.done, versé: O.pour, cap: __mwcars.oilL(c.mdl), blocage: MWG.blocage(c) }; });
  verifier(f2.done.huile === 1 && f2.done.filtre_huile === 1, `vidange du diesel incomplète : ${log2.join(' ')}`);
  verifier(f2.versé >= f2.cap * .93 && f2.versé <= f2.cap * 1.12 && f2.blocage.length === 0, `quantité d'huile du diesel non conforme : ${f2.versé} l pour ${f2.cap} l (${f2.blocage})`);

  // 5. plaquettes avant : écrous desserrés au sol, roues déposées, serrage en étoile au sol
  await e(() => { MWG.release(); __mwj.clear(); __mw.S.inv.length = 0; });
  await accueillir('plaq_av', null);
  await pres();
  const nEcrous = await e(() => MWG.rig().wh.FL.N);
  const log3 = await travail();
  const f3 = await e(() => { const c = __mwj.jobs()[0]; return { done: c.done, st: c.st, blocage: MWG.blocage(c), nuts: ['FL', 'FR'].map(S => c.g.w[S].n.join('')) }; });
  verifier(f3.done.plaq_av === 1 && f3.blocage.length === 0 && f3.st.lifted === 0 && !f3.st.av, `plaquettes incomplètes : ${JSON.stringify(f3)} ${log3.join(' ')}`);
  const pos = s => log3.findIndex(x => x.startsWith(s));
  verifier(pos('nl') < pos('raise') && pos('raise') < pos('nr') && pos('nr') < pos('wo') && pos('wo') < pos('gb') && pos('gb') < pos('ct') && pos('ct') < pos('po')
    && pos('po') < pos('pr') && pos('pr') < pos('pn') && pos('pn') < pos('wp') && pos('wp') < pos('nv') && pos('nv') < pos('lower') && pos('lower') < pos('nq'), 'ordre des gestes des plaquettes anormal : ' + log3.join(' '));
  const etoile = nEcrous === 4 ? [0, 2, 1, 3] : [0, 2, 4, 1, 3];
  for (const S of ['FL', 'FR']) {
    const seq = log3.filter(x => x.startsWith('nq' + S)).map(x => +x.slice(4));
    verifier(JSON.stringify(seq) === JSON.stringify(etoile), `serrage pas en étoile sur ${S} : ${seq}`);
  }
  verifier(log3.includes('pump'), 'la pédale de frein n\'est pas pompée');
  return `vidange essence (${f1.cap} l) et diesel (${f2.cap} l), plaquettes avant (${nEcrous} écrous, étoile), mauvais outil refusé, aide, maintien de E`;
};

module.exports.titre = 'mécanicien (gestes réalistes) : vidange essence et diesel, plaquettes en étoile, mauvais outil, aide';
module.exports.appareil = 'bureau';
