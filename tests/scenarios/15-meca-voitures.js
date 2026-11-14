'use strict';
const { attendre, attendreVisible, attendreCondition, cliquer, verifier } = require('../outils.js');

// Mode Mécanicien (voitures réelles, js/44) : catalogue, conversion vers l'état du jeu, maillages, moteur dans la baie,
// client avec une voiture réelle, vidange avec la bonne quantité d'huile, pièces adaptées (chaîne, diesel, électrique).
module.exports = async function mecaVoitures(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && window.__mwcars, null, { timeout: 15000 });
  await page.evaluate(() => { if (typeof MWG !== 'undefined') MWG.set({ classic: true }); }); // menus classiques de js/41 (gestes réalistes : scénario 16)
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);

  // 1. catalogue : au moins 30 voitures réelles, réparties par garage, fiches complètes
  const cat = await e(() => {
    const L = __mwcars.list, par = {};
    for (const c of L) par[c.cat] = (par[c.cat] || 0) + 1;
    const manque = [];
    for (const c of L) {
      for (const k of ['mk', 'mo', 'gen', 'y0', 'y1', 'body', 'kind', 'L', 'W', 'H', 'WB', 'mass', 'drive', 'gb', 'tyre', 'brk', 'eng'])
        if (c[k] == null || (c[k] === '' && k !== 'gen')) manque.push(c.id + '.' + k);
      const g = c.eng;
      for (const k of c.ev ? ['nom', 'fuel', 'ch', 'nm'] : ['nom', 'fuel', 'ch', 'nm', 'oilL', 'visc']) if (g[k] == null || g[k] === '') manque.push(c.id + '.eng.' + k);
      if (!c.ev) for (const k of ['n', 'lay', 'ccm', 'bore', 'stroke', 'asp', 'timing']) if (!g[k]) manque.push(c.id + '.eng.' + k);
      if (c.L < 3.4 || c.L > 5.1 || c.W < 1.55 || c.W > 2 || c.H < 1.1 || c.H > 1.9 || c.WB < 2.2 || c.WB > 3) manque.push(c.id + ' dimensions');
      if (!/^\d{3}\/\d{2} R\d{2}$/.test(c.tyre)) manque.push(c.id + ' pneus');
    }
    const ids = new Set(L.map(c => c.id));
    return { n: L.length, par, manque, uniques: ids.size === L.length, pools: ['garage1', 'garage2', 'garage3', 'garage4'].map(z => __mwcars.pool(z).length) };
  });
  verifier(cat.n >= 30 && cat.uniques, `le catalogue est trop petit ou contient des doublons (${cat.n} voitures)`);
  verifier(cat.manque.length === 0, `fiches incomplètes : ${cat.manque.slice(0, 5).join(', ')}`);
  verifier(cat.pools.every(n => n >= 5), `chaque garage doit avoir au moins 5 modèles (${cat.pools})`);
  const noms = await e(() => ['clio4', 'p308', 'c3', 'bmw320d', 'p911', 'a110', 'rs3', 'm3g80'].map(i => __mwcars.label(i, { year: 2016, km: 128400 })));
  verifier(noms[0].replace(/\s/g, ' ') === 'Renault Clio IV 1.5 dCi 90 · 2016 · 128 400 km', `libellé inattendu : ${noms[0]}`);

  // 2. toS : état de conception valide pour TOUS les moteurs (3, 4, 5, 6, 8, 10 cylindres ; ligne, V, à plat ; diesel, essence ; turbo)
  const ts = await e(() => {
    const bad = [], seen = { n: new Set(), lay: new Set(), fuel: new Set(), asp: new Set() };
    for (const c of __mwcars.list) {
      const r = __mwcars.checkS(c);
      if (c.ev) { if (!r.ev || __mwcars.toS(c) !== null) bad.push(c.id + ' (électrique)'); continue; }
      if (!r.ok) { bad.push(c.id + ' ' + (r.err || JSON.stringify(r.E))); continue; }
      seen.n.add(c.eng.n); seen.lay.add(c.eng.lay); seen.fuel.add(c.eng.fuel); seen.asp.add(c.eng.asp);
      const s = __mwcars.toS(c);
      if (!(s.bore > 60 && s.stroke > 60 && CFG[s.config] && CFG[s.config].n === c.eng.n)) bad.push(c.id + ' état incohérent');
      if ((c.eng.fuel === 'diesel') !== (s.fuel === 'diesel')) bad.push(c.id + ' carburant');
      if ((c.eng.timing === 'courroie') !== (s.timing === 'belt')) bad.push(c.id + ' distribution');
    }
    return { bad, n: [...seen.n].sort(), lay: [...seen.lay].sort(), fuel: [...seen.fuel].sort(), asp: [...seen.asp].sort(), disp: Math.round(S.bore * 100) };
  });
  verifier(ts.bad.length === 0, `toS invalide : ${ts.bad.slice(0, 4).join(' ; ')}`);
  verifier([3, 4, 5, 6, 8, 10].every(n => ts.n.includes(n)) && ts.lay.join() === 'F,I,V' && ts.fuel.includes('diesel') && ts.fuel.includes('essence') && ts.asp.includes('turbo') && ts.asp.includes('atmo'),
    `le catalogue ne couvre pas toutes les architectures (${ts.n} ${ts.lay} ${ts.fuel} ${ts.asp})`);

  // 3. toutes les voitures se construisent : roues, capot, ancres, plaque, peu d'appels de dessin
  const mesh = await e(() => {
    const bad = [], noms = ['bay', 'hubFL', 'hubFR', 'hubRL', 'hubRR', 'under', 'oilPlug', 'oilFilter', 'battery', 'airbox', 'exhaust', 'fuelCap'];
    let maxCalls = 0;
    for (const c of __mwcars.list) {
      const g = MW.carMesh({ model: c.id, color: 0x336699 });
      for (const n of ['wFL', 'wFR', 'wRL', 'wRR', 'hood']) if (!g.getObjectByName(n)) bad.push(c.id + ' sans ' + n);
      for (const n of noms) if (!__mwcars.anchor(g, n)) bad.push(c.id + ' sans ancre ' + n);
      if (g.userData.mdl !== c.id || Math.abs(g.userData.L - c.L) > 1e-6) bad.push(c.id + ' userData');
      let calls = 0, y0 = 1e9;
      const bb = new THREE.Box3().setFromObject(g);
      g.traverse(o => { if (o.isMesh && o.visible) calls++; });
      maxCalls = Math.max(maxCalls, calls);
      if (calls >= 60) bad.push(`${c.id} ${calls} maillages`);
      if (Math.abs(bb.min.y) > .02) bad.push(`${c.id} flotte ou s'enfonce (y min ${bb.min.y.toFixed(3)})`);
      const sz = bb.getSize(new THREE.Vector3());
      if (sz.z < c.L - .05 || sz.z > c.L + .45 || sz.x < c.W - .05 || sz.y < c.H * .9 - .05) bad.push(`${c.id} dimensions ${sz.x.toFixed(2)}x${sz.y.toFixed(2)}x${sz.z.toFixed(2)}`);
      // roues au sol : bas du pneu à y = 0
      const w = g.getObjectByName('wFL'), r = g.userData.wheelR;
      if (Math.abs(w.position.y - r) > .005) bad.push(c.id + ' roue qui flotte');
      if (!/^[A-Z]{2}-\d{3}-[A-Z]{2}$/.test(g.userData.plate)) bad.push(c.id + ' plaque ' + g.userData.plate);
    }
    const p = MW.carMesh({ model: 'clio4', plate: 'AB-123-CD' });
    if (p.userData.plate !== 'AB-123-CD') bad.push('plaque imposée');
    return { bad, maxCalls, stats: __mwcars.stats().geo };
  });
  verifier(mesh.bad.length === 0, `maillage invalide : ${mesh.bad.slice(0, 4).join(' ; ')}`);
  verifier(mesh.stats >= 30, `géométries non partagées par modèle (${mesh.stats})`);

  // ancien appel {color, kind} : toujours valide, un modèle réel de la bonne catégorie
  const kinds = await e(() => ['citadine', 'berline', 'suv', 'utilitaire', 'sport'].map(k => {
    const g = MW.carMesh({ color: 0xaa2222, kind: k });
    return { k, ok: !!g.getObjectByName('wFL') && !!g.getObjectByName('hood') && __mwcars.get(g.userData.mdl).kind === k, L: g.userData.L };
  }));
  verifier(kinds.every(x => x.ok && x.L > 3 && x.L < 5.1), `MW.carMesh({color,kind}) incompatible : ${JSON.stringify(kinds.filter(x => !x.ok))}`);

  // 4. le moteur réel de chaque architecture tient dans sa baie, orienté correctement ; baie à l'arrière pour les moteurs arrière / centraux
  const bay = await e(() => {
    const bad = [], res = [], seen = new Set();
    for (const c of __mwcars.list) {
      const k = c.eng.n + c.eng.lay + c.loc + c.ori + c.eng.asp + c.eng.fuel;
      if (seen.has(k) && !['p911', 'a110', 'huracan', 'cayman', 'mustang', 'a6c8', 'bmw320d', 'clio4', 'zoe'].includes(c.id)) continue;
      seen.add(k);
      const m = __mwcars.engineMesh(c), f = m.userData.fit;
      if (!f.ok) bad.push(`${c.id} ne tient pas : ${JSON.stringify(f.size)} dans ${JSON.stringify(f.bay)}`);
      const zb = __mwcars.geo(c).bayZ, rear = c.loc !== 'front';
      if (rear !== (zb < 0)) bad.push(`${c.id} baie du mauvais côté (${zb})`);
      if (!c.ev) {
        const bb = new THREE.Box3().setFromObject(m.getObjectByName('engine')), sz = bb.getSize(new THREE.Vector3());
        // transversal : le vilebrequin court selon x (plus long en x qu'en z pour un 4 cylindres en ligne) ; longitudinal : selon z
        if (c.eng.lay === 'I' && c.eng.n >= 4) { if ((c.ori === 'T') !== (sz.x > sz.z)) bad.push(`${c.id} mal orienté (${sz.x.toFixed(2)} × ${sz.z.toFixed(2)})`); }
        if (sz.y < .25 || sz.y > .8 || Math.max(sz.x, sz.z) < .4) bad.push(`${c.id} échelle du moteur (${sz.x.toFixed(2)} ${sz.y.toFixed(2)} ${sz.z.toFixed(2)})`);
        if (!m.getObjectByName('cover')) { if (c.eng.lay !== 'F') bad.push(c.id + ' sans cache-moteur'); }
        for (const n of ['oilCap', 'dipstick', 'alternator', 'battery', 'airbox', 'coolant', 'washer', 'brakeFluid']) if (!m.userData.anchors[n]) bad.push(`${c.id} sans ancre ${n}`);
      }
      res.push(`${c.id}:${(f.f || 1).toFixed(2)}`);
      m.userData.dispose();
    }
    return { bad, res, st: __mwcars.stats() };
  });
  verifier(bay.bad.length === 0, `baie invalide : ${bay.bad.slice(0, 3).join(' ; ')}`);
  verifier(bay.st.engines.length === 0, `les moteurs ne sont pas libérés (${bay.st.engines})`);

  // 5. pièces selon la voiture : chaîne sans courroie de distribution, diesel sans bougies d'allumage, électrique sans vidange
  const pieces = await e(() => {
    const A = __mwcars, bad = [];
    for (const c of A.list) {
      const chaine = !c.ev && c.eng.timing === 'chaîne';
      if (chaine && A.applies(c, 'courroie_dist')) bad.push(c.id + ' chaîne avec courroie');
      if (!chaine && !c.ev && !A.applies(c, 'courroie_dist')) bad.push(c.id + ' courroie absente');
      if (c.eng.fuel === 'diesel' && !/préchauffage/.test(A.partName(c, 'bougies'))) bad.push(c.id + ' diesel avec bougies d\'allumage');
      if (c.eng.fuel === 'essence' && !/allumage/.test(A.partName(c, 'bougies'))) bad.push(c.id + ' essence sans bougies d\'allumage');
      if (c.ev && (A.applies(c, 'huile') || A.applies(c, 'bougies') || A.applies(c, 'embrayage'))) bad.push(c.id + ' électrique avec vidange');
      if (c.gb !== 'man' && A.applies(c, 'embrayage')) bad.push(c.id + ' automatique avec embrayage');
      if (!c.ev && !new RegExp(String(c.eng.oilL).replace('.', ',') + ' l').test(A.partName(c, 'huile'))) bad.push(c.id + ' huile ' + A.partName(c, 'huile'));
    }
    const p1 = A.partPrice('clio4', 'huile', 35), p2 = A.partPrice('p911', 'huile', 35), pn1 = A.partPrice('clio4', 'pneus', 240), pn2 = A.partPrice('p911', 'pneus', 240);
    if (!(p2 > p1 * 1.5 && Math.abs(p1 - 35 * 4.5 / 5) < .01)) bad.push('prix de l\'huile ' + p1 + ' ' + p2);
    if (!(pn2 > pn1 * 1.8)) bad.push('prix des pneus ' + pn1 + ' ' + pn2);
    // aucun garage ne reçoit une voiture électrique pour une vidange
    const MJ = __mwj;
    for (let i = 0; i < 60; i++) { const m = MJ.modelFor('garage2', ['huile', 'filtre_huile']); if (m[3] === 'zoe') { bad.push('Zoé pour une vidange'); break; } const n = MJ.modelFor('garage1', ['courroie_dist']); if (A.get(n[3]).eng.timing !== 'courroie') { bad.push('chaîne pour une courroie de distribution'); break; } }
    return bad;
  });
  verifier(pieces.length === 0, `pièces mal adaptées : ${pieces.slice(0, 3).join(' ; ')}`);

  // 6. un client arrive avec une voiture réelle adaptée au garage, nom complet
  await e(() => { if (typeof MWC !== 'undefined') MWC.hire('meca'); __mw.S.min = 590; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; });
  const client = await e(() => {
    const c = __mwj.spawn({ tpl: 'vidange' });
    const m = __mwcars.get(c.mdl);
    return { zone: c.zone, mdl: c.mdl, cat: m && m.cat, marque: c.marque, modele: c.modele, an: c.an, km: c.km, y0: m.y0, y1: m.y1, lbl: __mwj.lbl(c), oilL: m.eng.oilL, nom: __mwcars.partName(m, 'huile') };
  });
  verifier(client.zone === 'garage1' && client.cat === 'pop', `le client du Garage du Coin n'a pas une voiture populaire (${client.cat})`);
  verifier(client.an >= client.y0 && client.an <= client.y1 && client.km > 0, `année ou kilométrage incohérents (${client.an}, ${client.km})`);
  verifier(client.lbl.startsWith(client.marque + ' ') && client.lbl.includes(String(client.an)) && /[0-9]/.test(client.modele), `nom affiché incorrect : ${client.lbl}`);
  const mod4 = await e(() => ['garage1', 'garage2', 'garage3', 'garage4'].map(z => __mwj.noirData.MODELS[z].map(t => __mwcars.get(t[3]).cat)));
  verifier(mod4.every((l, i) => l.length >= 5 && l.every(c => c === ['pop', 'gen', 'prem', 'sport'][i])), 'les modèles des garages ne suivent pas les catégories');

  // 7. vidange : la voiture reçoit la capacité d'huile de SON moteur, la facture en tient compte
  const v = await e(() => {
    const c = __mwj.jobs()[0], m = __mwcars.get(c.mdl);
    __mw.S.inv.length = 0;
    __mwj.act(c.id, 'FL', 'pont');
    __mwj.act(c.id, 'dessous', 'dep:huile'); __mwj.act(c.id, 'dessous', 'dep:filtre_huile');
    __mw.S.inv.push({ k: 'neuve', id: 'huile', src: 'etagere' }, { k: 'neuve', id: 'filtre_huile', src: 'etagere' });
    __mwj.act(c.id, 'dessous', 'pose:huile'); __mwj.act(c.id, 'dessous', 'pose:filtre_huile');
    const toast = [...document.querySelectorAll('#mwToasts .mw-t')].map(t => t.textContent).join(' | ');
    const ev = __mwj.evalJob(c), l = ev.lines.find(x => x.id === 'huile');
    const attendu = Math.round(35 * m.eng.oilL / 5 * 1.3 * c.fp * 100) / 100;
    return { done: c.done, ligne: l && l.nom, prix: l && l.prix, attendu, oilL: m.eng.oilL, toast, pnom: __mwj.pn(c, 'huile') };
  });
  verifier(v.done.huile === 1 && v.done.filtre_huile === 1, 'la vidange ne se fait pas sur la voiture réelle');
  verifier(v.ligne && v.ligne.includes(String(v.oilL).replace('.', ',') + ' l') && Math.abs(v.prix - v.attendu) < .02, `la facture ne tient pas compte de la capacité d'huile (${v.ligne} ${v.prix} / ${v.attendu})`);
  verifier(/l versés/.test(v.toast), `le message de vidange n'annonce pas la quantité d'huile (${v.toast})`);

  // 8. capot : le moteur réel n'est construit qu'à la 1re ouverture, libéré quand la voiture part
  await e(() => { window.__g0 = __mwcars.stats(); });
  const ouvert = await e(() => {
    const c = __mwj.jobs()[0];
    __mwj.act(c.id, 'FL', 'pont');       // redescend le pont
    __mwj.act(c.id, 'capot', 'capot');
    return { id: c.id, mdl: c.mdl, capot: c.st.capot };
  });
  verifier(ouvert.capot === 1, "le capot ne s'ouvre pas");
  await attendreCondition(page, () => { const g = MW.scene.children.find(o => o.userData && o.userData.mdl && o.userData.hood && o.userData.hood.rotation.x < -.9 && o.position.x !== 0); return g && __mwcars.bayBuilt(g); }, "le moteur de la baie n'est pas construit à l'ouverture du capot", 30000);
  const b = await e(() => {
    const g = MW.scene.children.find(o => o.userData && o.userData.mdl && o.userData.hood && o.userData.hood.rotation.x < -.9 && o.position.x !== 0), f = g.userData.bay.userData.fit;
    return { fit: f.ok, built: __mwcars.stats().built - window.__g0.built, rod: g.userData.rod.visible, engines: __mwcars.stats().engines };
  });
  verifier(b.fit && b.built === 1 && b.rod && b.engines.length === 1, `baie construite incorrecte ${JSON.stringify(b)}`);
  await e(() => __mwj.remove(__mwj.jobs()[0]));
  await attendreCondition(page, () => __mwcars.stats().freed > window.__g0.freed && __mwcars.stats().engines.length === 0, "le moteur n'est pas libéré quand la voiture part", 20000);

  // 9. voiture personnelle : un vrai modèle (Peugeot 206 au départ), changé chez le vendeur d'occasions
  const perso = await e(() => { const pc = MW.playerCar().mesh; return { mdl: pc.userData && pc.userData.mdl, roues: !!pc.getObjectByName('wFL') }; });
  verifier(perso.mdl === 'p206' && perso.roues, `la voiture du joueur n'est pas un modèle réel (${perso.mdl})`);
  return `${cat.n} voitures · ${bay.res.length} moteurs vérifiés dans la baie · ${mesh.maxCalls} maillages max par voiture fermée`;
};
module.exports.titre = 'mécanicien (voitures réelles) : catalogue, toS, maillages, moteur dans la baie, pièces, vidange';
module.exports.appareil = 'bureau';
