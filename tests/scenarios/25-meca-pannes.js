'use strict';
const { attendre, attendreVisible, cliquer, verifier, verifierTextes } = require('../outils.js');

// Mode Mécanicien : pannes réalistes (js/51). Pour des symptômes tirés au hasard : la panne se diagnostique (inspection, essai sur route,
// valise avec de vrais codes P), la bonne pièce est identifiable parmi les fausses pistes, et la réparation par gestes va jusqu'au bout.
module.exports = async function mecaPannes(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && typeof MWG !== 'undefined' && window.__mwcars && window.__mwp, null, { timeout: 15000 });
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => {
    MWG.set({ classic: false, aide: 'on' }); MWC.hire('patron');
    __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12;
    for (const k of __mwj.SKILLS) __mw.S.xp[k] = 5000;
    __mw.S.jobs.outils.cle_dyn = 1; __mw.S.jobs.outils.valise = 1;
  });

  // 1. catalogue : assez de symptômes, tous complets, vrais codes et textes non vides
  const cat = await e(() => {
    const err = [], S = __mwj.SYMP, P = __mwj.PARTS, E = __mwj.ESS_NOM, ids = new Set();
    const vide = t => typeof t !== 'string' || !t.trim() || /undefined|NaN/.test(t);
    for (const y of S) {
      if (ids.has(y.id)) err.push('doublon ' + y.id); ids.add(y.id);
      if (vide(y.txt) || vide(y.cause)) err.push(y.id + ' : texte ou cause vide');
      if (!P[y.c]) { err.push(y.id + ' : pièce coupable inconnue'); continue; }
      for (const id of [y.c, ...y.red, ...(y.ch || [])]) if (!P[id]) err.push(y.id + ' : pièce inconnue ' + id);
      if (y.red.includes(y.c)) err.push(y.id + ' : le coupable est aussi une fausse piste');
      if (y.red.some(id => (y.ch || []).includes(id)) || (y.ch || []).includes(y.c)) err.push(y.id + ' : fausse piste et dégât en chaîne confondus');
      if (!(y.dn >= 1 && y.dn <= 5)) err.push(y.id + ' : difficulté ' + y.dn);
      if (!y.ins || vide(y.ins[y.c])) err.push(y.id + ' : pas d\'inspection du coupable');
      for (const id of y.red) if (!y.ins || vide(y.ins[id])) err.push(y.id + ' : pas d\'inspection de la fausse piste ' + id);
      for (const id of (y.ch || [])) if (!y.ins || vide(y.ins[id])) err.push(y.id + ' : pas d\'inspection du dégât ' + id);
      for (const k in (y.ins || {})) if (vide(y.ins[k]) || ![y.c, ...y.red, ...(y.ch || [])].includes(k)) err.push(y.id + ' : inspection incohérente ' + k);
      for (const k in (y.ess || {})) if (!E[k] || vide(y.ess[k])) err.push(y.id + ' : essai incohérent ' + k);
      const res = P[y.c].hid ? 1 : 0;
      if (!y.ess && !res && !y.cod) err.push(y.id + ' : aucun indice d\'essai ni code');
      for (const t of (y.cod || []).concat(Object.values(y.fx || {}))) if (!/^P[0-3]\d{3} : \S/.test(t)) err.push(y.id + ' : code mal formé « ' + t + ' »');
      if (P[y.c].hid && !(y.cod && y.cod.length) && !P[y.c].code) err.push(y.id + ' : pièce invisible sans code');
    }
    for (const p of __mwj.PARTS_LIST) {
      for (const [k, v] of Object.entries({ nom: p.nom, ab: p.ab, usTxt: p.usTxt })) if (k !== 'usTxt' && vide(v)) err.push(p.id + ' : ' + k + ' vide');
      if (!(p.prix > 0 && p.mo > 0 && p.niv >= 1)) err.push(p.id + ' : prix, durée ou niveau absurde');
      if (!__mwj.TOOLS_FOR[p.id]) err.push(p.id + ' : pas d\'outils conseillés');
      if (!p.hid && vide(p.usTxt)) err.push(p.id + ' : texte d\'usure vide');
    }
    return { n: S.length, err, parts: __mwj.PARTS_LIST.length };
  });
  verifier(cat.n >= 35, `il faut au moins 35 symptômes (il y en a ${cat.n})`);
  verifier(cat.err.length === 0, 'catalogue des pannes incomplet : ' + cat.err.slice(0, 6).join(' | '));

  // 2. quelques symptômes tirés au hasard, diagnostic complet puis réparation par gestes
  const tires = await e(n => {
    const l = __mwj.SYMP.map(y => y.id), r = [];
    // toujours : une panne avec dégât en chaîne et une panne à code défaut
    const ch = __mwj.SYMP.filter(y => y.ch && y.dn <= 4).map(y => y.id), cod = __mwj.SYMP.filter(y => y.cod && y.cod.length && !(y.ch || []).length).map(y => y.id);
    r.push(ch[Math.floor(Math.random() * ch.length)], cod[Math.floor(Math.random() * cod.length)]);
    while (r.length < n) { const id = l[Math.floor(Math.random() * l.length)]; if (!r.includes(id)) r.push(id); }
    return r;
  }, 6);
  const rapport = [];
  for (const sid of tires) {
    const ok = await e(sid => {
      const y = __mwj.SYMP.find(q => q.id === sid);
      for (let i = 0; i < 80; i++) {
        __mwj.clear(); __mw.S.inv.length = 0; __mwj.spawn({ symp: sid, force: true, rend: false, silencieux: true });
        const c = __mwj.jobs()[0];
        if (!c) continue;
        const need = [y.c, ...(y.ch || [])];
        if (need.some(id => !c.parts[id] || c.parts[id].na)) continue;
        if (y.f && c.mdl && __mwcars.get(c.mdl).eng.fuel !== y.f) continue;
        return true;
      }
      return false;
    }, sid);
    verifier(ok, `aucune voiture adaptée au symptôme « ${sid} »`);

    // diagnostic : l'inspection, l'essai et la valise désignent la bonne pièce
    const d = await e(sid => {
      const y = __mwj.SYMP.find(q => q.id === sid), c = __mwj.jobs()[0], err = [];
      const suspects = [y.c, ...y.red, ...(y.ch || [])].filter(id => !c.parts[id].na);
      for (const id of suspects) {
        c.insp[id] = 1; c.ni = (c.ni || 0) + 1;
        const t = __mwj.inspLine(c, id);
        if (!t || /undefined|NaN/.test(t)) err.push('inspection vide ' + id);
        if (y.ins[id] && !t.includes(y.ins[id])) err.push('texte propre au symptôme absent pour ' + id);
      }
      if (c.parts[y.c].u < 75) err.push('le coupable n\'est pas assez usé (' + c.parts[y.c].u + ')');
      for (const id of y.red) if (!c.parts[id].na && c.parts[id].u >= 75) err.push('la fausse piste ' + id + ' semble défaillante');
      for (const id of (y.ch || [])) if (!c.parts[id].na && c.parts[id].u < 75) err.push('le dégât ' + id + ' n\'est pas visible');
      // essai sur route : tous les indices du symptôme sont ressentis dans leur situation
      const vus = [];
      for (const k of Object.keys(__mwj.ESS_NOM)) for (const t of __mwj.clueTxt(c, k)) { vus.push(t); if (!t || /undefined|NaN/.test(t)) err.push('indice vide'); }
      for (const k in (y.ess || {})) if (!vus.includes(y.ess[k])) err.push('indice d\'essai manquant : ' + k);
      // valise
      __mwj.act(c.id, 'cabine', 'valise');
      const codes = c.codes || [];
      if (!codes.length || codes.some(t => !t || /undefined|NaN/.test(t))) err.push('valise vide');
      for (const t of (y.cod || [])) if (!codes.includes(t)) err.push('code absent à la valise : ' + t);
      if (y.cod && !y.cod.length && codes.some(t => y.c && t === __mwj.PARTS[y.c].code)) err.push('code inattendu pour le coupable');
      for (const k in (y.fx || {})) if (c.parts[k] && !c.parts[k].na && c.parts[k].u >= 40 && !codes.includes(y.fx[k])) err.push('code trompeur absent : ' + k);
      const sources = (y.ess ? 1 : 0) + ((y.cod && y.cod.length) || __mwj.PARTS[y.c].code ? 1 : 0) + 1;
      if (sources < 2 && y.dn >= 2) err.push('un seul type d\'indice pour ' + y.id);
      return { err, codes: codes.length, indices: vus.length, suspects: suspects.length, ch: (y.ch || []).filter(id => !c.parts[id].na) };
    }, sid);
    verifier(d.err.length === 0, `diagnostic de « ${sid} » : ${d.err.join(' ; ')}`);

    // les panneaux s'affichent sans texte suspect
    await e(() => { const c = __mwj.jobs()[0]; c.st.capot = 1; __mwj.openPoint(c.id, 'capot'); });
    await verifierTextes(page, `capot, symptôme ${sid}`);
    await e(() => { const c = __mwj.jobs()[0]; c.st.capot = 0; __mwj.openPoint(c.id, 'cabine'); });
    await verifierTextes(page, `habitacle, symptôme ${sid}`);
    await e(() => __mw.closePanel());

    // réparation par gestes : la pièce coupable (puis les dégâts en chaîne), en laissant tourner le jeu entre deux séries de gestes (écoulement de l'huile…)
    await e(sid => {
      const y = __mwj.SYMP.find(q => q.id === sid), c = __mwj.jobs()[0], P = __mwj.PARTS;
      MWG.release(); c.st.capot = 0; __mw.S.inv.length = 0;
      const liste = [y.c, ...(y.ch || []).filter(id => !c.parts[id].na)];
      if (y.c === 'disq_av') liste.push('plaq_av'); // la dépose des disques sort aussi les plaquettes : il faut les remettre
      for (const id of liste) __mw.S.inv.push({ k: 'neuve', id, src: 'achat', paye: P[id].prix });
      const z = __mw.zone(c.zone), p = z.ponts[c.pont], x = p.x + Math.cos(p.ry) * 1.6, zz = p.z - Math.sin(p.ry) * 1.6;
      __mw.teleport(x, zz, Math.atan2(p.x - x, p.z - zz), .1);
      MWG.ensure(c);
      window.__rep = { log: [], err: null, fin: false, vides: 0, sid };
    }, sid);
    for (let k = 0; k < 80; k++) {
      const r = await e(() => {
        const R = window.__rep, c = __mwj.jobs()[0];
        MWG.ensure(c);
        for (let n = 0; n < 10 && !R.fin; n++) {
          MWG.skip();
          const h = MWG.nextHint();
          if (h && h.key === 'door') { R.fin = true; break; }
          if (!h) {
            const y = __mwj.SYMP.find(q => q.id === R.sid), need = [y.c, ...(y.ch || []).filter(id => !c.parts[id].na)];
            if (need.every(id => c.done[id])) { R.fin = true; break; }
            R.vides++; if (R.vides > 25) { R.fin = true; R.err = "plus d'étape proposée"; } break;
          }
          R.vides = 0;
          const r = MWG.run(h.id, h.key);
          R.log.push(h.key);
          if (r) { R.err = 'étape refusée « ' + h.lab + ' » : ' + r; R.fin = true; }
          if (R.log.length > 600) { R.err = "trop d'étapes"; R.fin = true; }
        }
        return R.fin;
      });
      if (r) break;
      await attendre(70);
    }
    const rep = await e(sid => {
      const y = __mwj.SYMP.find(q => q.id === sid), c = __mwj.jobs()[0], R = window.__rep;
      const ch = (y.ch || []).filter(id => !c.parts[id].na);
      for (const [id, key] of [['lift', 'lower'], ['hood', 'hclose']]) { const r = MWG.run(id, key); if (r && !/introuvable|aucune/.test(r)) R.fermer = r; }
      return { err: R.err || (R.fin ? null : 'jamais terminé'), done: Object.keys(c.done), coupable: !!c.done[y.c], ch: ch.map(id => !!c.done[id]), bloc: MWG.blocage(c).concat(c.st.lifted ? ['le pont est levé'] : [], c.st.capot ? ['le capot est ouvert'] : []), n: R.log.length, tout: !!c.done[y.c], last: JSON.stringify(MWG.nextHint()), acts: [], log: R.log.slice(-8).join(' ') };
    }, sid);
    verifier(!rep.err, `réparation de « ${sid} » : ${rep.err}`);
    verifier(rep.coupable && rep.tout, `la pièce coupable n'est pas remplacée pour « ${sid} » (${rep.done.join(', ')})`);
    verifier(rep.ch.every(Boolean), `un dégât en chaîne n'est pas réparé pour « ${sid} » : ${rep.last} ${rep.acts.join(' ; ')} / ${rep.log} / ${rep.done}`);
    verifier(rep.bloc.length === 0, `la voiture n'est pas prête à rendre pour « ${sid} » : ${rep.bloc.join(', ')} / ${rep.last} / ${rep.acts.join(' ; ')} / ${rep.log}`);
    // rendu : la panne est résolue, la cause est donnée
    const fin = await e(() => { const c = __mwj.jobs()[0], ev = __mwj.evalJob(c); return { resolu: !ev.nonResolu, note: ev.note, chain: ev.chain.length }; });
    verifier(fin.resolu && fin.note >= 4 && fin.chain === 0, `rendu de « ${sid} » anormal : ${JSON.stringify(fin)}`);
    rapport.push(`${sid} (${rep.n} gestes)`);
    await e(() => MWG.release());
  }

  // 3. un dégât en chaîne laissé en l'état fait baisser la note
  const lai = await e(() => {
    __mwj.clear(); __mw.S.inv.length = 0;
    for (let i = 0; i < 80; i++) {
      __mwj.clear(); __mwj.spawn({ symp: 'plaq_metal', force: true, rend: false, silencieux: true });
      const c = __mwj.jobs()[0];
      if (c && !c.parts.plaq_av.na && !c.parts.disq_av.na) { c.done.plaq_av = 1; c.parts.plaq_av.u = 0; const ev = __mwj.evalJob(c); return { chain: ev.chain, note: ev.note }; }
    }
    return null;
  });
  verifier(lai && lai.chain.includes('disq_av') && lai.note <= 4, `disques rayés laissés en l'état non sanctionnés : ${JSON.stringify(lai)}`);

  return `${cat.n} symptômes et ${cat.parts} pièces au catalogue ; diagnostic et réparation de : ${rapport.join(', ')}`;
};

module.exports.titre = 'mécanicien : pannes réalistes (catalogue, indices, codes P, dégâts en chaîne, gestes)';
module.exports.appareil = 'bureau';
