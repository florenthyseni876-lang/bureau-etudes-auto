'use strict';
const { attendre, attendreVisible, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (boîtes de vitesses) :
//  1. chaque voiture du catalogue a une boîte décrite (type, huile, intervalle) ; les voitures électriques n'ont pas les pièces de boîte ;
//  2. une vidange de boîte manuelle, une vidange de boîte automatique avec filtre, un remplacement d'embrayage (dépose de boîte), un
//     support de boîte et des câbles de commande se font de bout en bout, geste par geste (aide : prochaine étape) ;
//  3. une panne de boîte se diagnostique (inspection, essai sur route, fausses pistes) puis se répare ;
//  4. la protection sous moteur se dévisse, se dépose, se repose et se revisse ; le pont ne peut pas descendre tant qu'elle manque.
const TRAVAUX = [
  // [voiture, modèle de travail, pièces attendues]
  ['clio4', 'vid_boite', ['huile_boite']],
  ['bmw320d', 'vid_boite_auto', ['huile_boite', 'filtre_boite']],
  ['clio4', 'embr', ['embrayage']],
  ['clio4', 'supp_boite', ['support_boite']],
  ['clio4', 'cables_boite', ['cables_boite']],
];

module.exports = async function mecaBoites(page, env) {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(env.url);
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot');
  await page.waitForFunction(() => window.__mw && __mw.S && window.__mwj && typeof MWG !== 'undefined' && window.__mwcars && window.__mwp && typeof MWBOX !== 'undefined',
    null, { timeout: 15000 });
  await attendre(400);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => { MWG.set({ aide: 'on', classic: false }); MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mw.S.jobs.next = 1e12;
    for (const k of __mwj.SKILLS) __mw.S.xp[k] = 5000; __mw.S.jobs.outils.cle_dyn = 1; __mw.S.jobs.outils.valise = 1; });

  // 1. catalogue des boîtes
  const cat = await e(() => {
    const err = [], types = {};
    for (const car of MWCARS.list) {
      const sp = MWBOX.specOf(car);
      if (!sp) { err.push(car.id + ' : pas de boîte'); continue; }
      types[sp.type] = (types[sp.type] || 0) + 1;
      if (!(sp.huileL > 0 && sp.km > 0 && sp.huile)) err.push(car.id + ' : données d\'huile incomplètes');
      if ((car.gb === 'man') !== (sp.type === 'man')) err.push(car.id + ' : type de boîte différent de la fiche (' + car.gb + ' / ' + sp.type + ')');
      const a = __mwp.applies(car.id, 'huile_boite');
      if (car.ev === a) err.push(car.id + ' : huile de boîte ' + (car.ev ? 'sur une voiture électrique' : 'absente'));
      if (__mwp.applies(car.id, 'filtre_boite') !== (!car.ev && !!sp.filtre)) err.push(car.id + ' : filtre de boîte mal attribué');
    }
    return { err, types };
  });
  verifier(!cat.err.length, 'boîtes mal décrites : ' + cat.err.slice(0, 6).join(' | '));
  verifier(cat.types.man && cat.types.auto && cat.types.dct, 'il manque un type de boîte : ' + JSON.stringify(cat.types));

  // 2. travaux de bout en bout
  const bilan = [];
  for (const [id, tpl, pieces] of TRAVAUX) {
    const ok = await e(([id, tpl, pieces]) => {
      const D = __mwj.noirData.MODELS; for (const z of ['garage1', 'garage2', 'garage3', 'garage4']) { D[z].length = 0; D[z].push(MWCARS.tuple(id)); }
      MWG.release && MWG.release(); __mwj.clear(); __mw.S.inv.length = 0;
      const c = __mwj.spawn({ tpl, force: true, rend: false }); if (!c) return 'aucune voiture';
      if (pieces.some(p => !c.ordre.includes(p))) return 'pièces du travail : ' + c.ordre.join('+');
      for (const p of c.ordre) __mw.S.inv.push({ k: 'neuve', id: p, src: 'achat', paye: 1 });
      const pt = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(pt.x + Math.cos(pt.ry) * 1.7, pt.z - Math.sin(pt.ry) * 1.7, pt.ry - Math.PI / 2, 0); MWG.ensure(c);
      window.__bx = { fin: false, n: 0, err: null, vides: 0 }; return 'ok';
    }, [id, tpl, pieces]);
    verifier(ok === 'ok', `${tpl} (${id}) : ${ok}`);
    await attendre(1500);
    for (let k = 0; k < 120; k++) {
      const r = await e(() => {
        const B = window.__bx, c = __mwj.jobs()[0]; MWG.ensure(c);
        for (let i = 0; i < 12 && !B.fin; i++) {
          MWG.skip(); const h = MWG.nextHint();
          if (!h || h.key === 'door') { if (c.ordre.every(p => c.done[p])) B.fin = true; else if (++B.vides > 30) { B.fin = true; B.err = `plus d'étape proposée (${Object.keys(c.done).join('+')})`; } break; }
          B.vides = 0; const r = MWG.run(h.id, h.key); B.n++;
          if (r) { B.fin = true; B.err = `refus « ${h.lab} » (${h.id}) : ${r}`; break; }
        }
        return { fin: B.fin, err: B.err, n: B.n };
      });
      if (r.fin) { verifier(!r.err, `${tpl} (${id}) : ${r.err}`); bilan.push(`${tpl} ${id} (${r.n} gestes)`); break; }
      await attendre(400);
      verifier(k < 119, `${tpl} (${id}) : le travail ne se termine pas`);
    }
    const fin = await e(() => { const c = __mwj.jobs()[0]; return { done: c.ordre.every(p => c.done[p]), bl: MWG.blocage(c).join(', ') }; });
    verifier(fin.done, `${tpl} (${id}) : travail incomplet`);
  }

  // 3. une panne de boîte : diagnostic complet puis réparation
  for (const [sid, id] of [['craque', 'clio4'], ['acoups_auto', 'bmw320d']]) {
    const d = await e(([sid, id]) => {
      const D = __mwj.noirData.MODELS; for (const z of ['garage1', 'garage2', 'garage3', 'garage4']) { D[z].length = 0; D[z].push(MWCARS.tuple(id)); }
      MWG.release && MWG.release(); __mwj.clear(); __mw.S.inv.length = 0;
      const y = __mwj.SYMP.find(q => q.id === sid), c = __mwj.spawn({ symp: sid, force: true, rend: false }), err = [];
      if (!c || !c.symp || c.symp.id !== sid) return { err: ['symptôme non tiré'] };
      const suspects = [y.c, ...y.red, ...(y.ch || [])].filter(p => !c.parts[p].na);
      for (const p of suspects) { c.insp[p] = 1; const t = __mwj.inspLine(c, p); if (y.ins[p] && !t.includes(y.ins[p])) err.push('inspection de ' + p); }
      if (c.parts[y.c].u < 75) err.push('coupable peu usé');
      const vus = []; for (const k of Object.keys(__mwj.ESS_NOM)) for (const t of __mwj.clueTxt(c, k)) vus.push(t);
      for (const k in y.ess) if (!vus.includes(y.ess[k])) err.push('indice d\'essai manquant ' + k);
      for (const p of y.red) if (!c.parts[p].na && c.parts[p].u >= 75) err.push('fausse piste défaillante ' + p);
      const liste = [y.c, ...(y.ch || []).filter(p => !c.parts[p].na)];
      for (const p of liste) __mw.S.inv.push({ k: 'neuve', id: p, src: 'achat', paye: 1 });
      const pt = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(pt.x + Math.cos(pt.ry) * 1.7, pt.z - Math.sin(pt.ry) * 1.7, pt.ry - Math.PI / 2, 0); MWG.ensure(c);
      window.__bx = { fin: false, n: 0, err: null, vides: 0, liste }; return { err };
    }, [sid, id]);
    verifier(!d.err.length, `diagnostic de « ${sid} » : ${d.err.join(' ; ')}`);
    await attendre(1500);
    for (let k = 0; k < 120; k++) {
      const r = await e(() => {
        const B = window.__bx, c = __mwj.jobs()[0]; MWG.ensure(c);
        for (let i = 0; i < 12 && !B.fin; i++) {
          MWG.skip(); const h = MWG.nextHint();
          if (!h || h.key === 'door') { if (B.liste.every(p => c.done[p])) B.fin = true; else if (++B.vides > 30) { B.fin = true; B.err = 'plus d\'étape proposée'; } break; }
          B.vides = 0; const r = MWG.run(h.id, h.key); B.n++;
          if (r) { B.fin = true; B.err = `refus « ${h.lab} » (${h.id}) : ${r}`; break; }
        }
        return { fin: B.fin, err: B.err, n: B.n };
      });
      if (r.fin) { verifier(!r.err, `panne « ${sid} » : ${r.err}`); bilan.push(`panne ${sid} réparée (${r.n} gestes)`); break; }
      await attendre(400);
      verifier(k < 119, `panne « ${sid} » : la réparation ne se termine pas`);
    }
  }

  // 4. protection sous moteur
  const prot = await e(() => {
    const D = __mwj.noirData.MODELS; for (const z of ['garage1', 'garage2', 'garage3', 'garage4']) { D[z].length = 0; D[z].push(MWCARS.tuple('clio4')); }
    MWG.release && MWG.release(); __mwj.clear(); const c = __mwj.spawn({ tpl: 'vidange', force: true, rend: false }); const pt = __mw.zone(c.zone).ponts[c.pont];
    __mw.teleport(pt.x + Math.cos(pt.ry) * 1.7, pt.z - Math.sin(pt.ry) * 1.7, pt.ry - Math.PI / 2, 0); MWG.ensure(c); MWG.run('lift', 'raise'); return true;
  });
  await page.waitForFunction(() => { const R = MWG.rig(); return R && R.g.position.y > 1.5 && R.g.userData.bay && R.tg.some(t => /^sk:/.test(t.id)); }, null, { timeout: 30000 });
  await attendre(500);
  const etapes = await e(() => {
    const out = [], R = () => MWG.rig(), c = __mwj.jobs()[0];
    const faire = (id, key) => { const r = MWG.run(id, key); if (r) throw new Error(`refus ${key} : ${r}`); };
    const lower = () => MWG.run('lift', 'lower');
    for (let i = 0; i < 4; i++) faire('sk:vis:' + i, 'skvo' + i);
    out.push('vis dévissées');
    faire('sk:plaque', 'skoff'); out.push('protection déposée');
    const refus = lower(); out.push('descente refusée : ' + !!refus);
    faire('sk:plaque', 'skon');
    for (let i = 0; i < 4; i++) faire('sk:vis:' + i, 'skvr' + i);
    out.push('protection remontée', 'blocage : ' + MWG.blocage(c).filter(x => /protection/.test(x)).length);
    return { out, refus: !!refus, bl: MWG.blocage(c).filter(x => /protection/.test(x)).length };
  });
  verifier(etapes.refus, 'le pont descend alors que la protection sous moteur est déposée');
  verifier(etapes.bl === 0, 'la protection remontée est encore signalée comme manquante');
  bilan.push('protection sous moteur');
  return bilan.join(', ');
};
module.exports.titre = 'mécanicien : boîtes de vitesses (vidanges, embrayage, support, câbles, panne diagnostiquée, protection sous moteur)';
module.exports.appareil = 'bureau';
