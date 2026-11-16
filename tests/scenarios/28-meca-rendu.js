'use strict';
const { attendre, attendreVisible, cliquer, verifier, attendreCondition } = require('../outils.js');

// Mode Mécanicien (rendu lisible) : capot ouvert sous la baladeuse, rien ne sature au blanc, la baie, le moteur et
// les bocaux se distinguent par leurs couleurs, le dessous de la voiture mêle plusieurs matières, et les appels
// de dessin restent sous le plafond.
module.exports = async function mecaRendu(page, env) {
  await page.goto(env.url);
  await attendreVisible(page, '#hMeca', "le bouton « Carrière de mécanicien » est absent de l'accueil");
  await cliquer(page, '#hMeca');
  await attendreVisible(page, '#mwRoot', "le mode Mécanicien ne s'ouvre pas");
  await page.waitForFunction(() => window.__mw && window.__mw.S && window.__mwj && window.__mwcars && typeof MWG !== 'undefined' && typeof MWF !== 'undefined', null, { timeout: 15000 });
  await attendre(300);
  const e = (f, a) => page.evaluate(f, a);
  await e(() => { MWC.hire('patron'); __mw.S.min = 600; __mw.S.flags.coinVu = true; __mwj.clear(); __mw.S.jobs.next = 1e12; });

  // l'éclairage ne doit plus écraser les couleurs
  const lum = await e(() => ({ expo: __mw.renderer().toneMappingExposure }));
  verifier(lum.expo <= 1.05, `exposition trop forte : ${lum.expo}`);

  // mesure des pixels d'une capture : part de pixels quasi blancs, plus grande zone saturée, contraste
  const mesure = async () => {
    const buf = await page.screenshot();
    return e(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
      const W = cv.width, H = cv.height, x0 = Math.round(W * .25), y0 = Math.round(H * .15), w = Math.round(W * .5), h = Math.round(H * .55);
      const d = x.getImageData(x0, y0, w, h).data;
      let blanc = 0, s1 = 0, s2 = 0; const n = w * h;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (Math.min(r, g, b) >= 240) blanc++;
        const l = .2126 * r + .7152 * g + .0722 * b; s1 += l; s2 += l * l;
      }
      // grandes surfaces : cases de 20 px presque entièrement blanches
      const C = 20; let cases = 0, saturees = 0;
      for (let cy = 0; cy + C <= h; cy += C) for (let cx = 0; cx + C <= w; cx += C) {
        let k = 0;
        for (let yy = 0; yy < C; yy += 2) for (let xx = 0; xx < C; xx += 2) { const o = ((cy + yy) * w + cx + xx) * 4; if (Math.min(d[o], d[o + 1], d[o + 2]) >= 240) k++; }
        cases++; if (k >= 90) saturees++;
      }
      const m = s1 / n;
      return { blanc: blanc / n, saturees: saturees / cases, ecart: Math.sqrt(Math.max(0, s2 / n - m * m)), moy: m };
    }, buf.toString('base64'));
  };

  const modeles = ['clio4', 'p911', 'bmw320d'];
  const bilan = [];
  for (const id of modeles) {
    const ok = await e((id) => {
      const D = __mwj.noirData.MODELS, t = __mwcars.tuple(__mwcars.get(id));
      for (const z in D) { D[z].length = 0; D[z].push(t); }
      for (let i = 0; i < 40; i++) {
        __mwj.clear(); __mwj.spawn({ tpl: 'vidange', force: true, rend: false, silencieux: true });
        const c = __mwj.jobs()[0];
        if (c && c.mdl === id && c.color !== 0xe8e8e8) return true; // carrosserie blanche exclue : on juge la baie, pas la peinture (sinon échec au hasard)
      }
      return false;
    }, id);
    verifier(ok, `la voiture ${id} n'arrive pas dans l'atelier`);
    await e(() => { const c = __mwj.jobs()[0], p = __mw.zone(c.zone).ponts[c.pont]; __mw.teleport(p.x + Math.cos(p.ry) * 1.7, p.z - Math.sin(p.ry) * 1.7, p.ry - Math.PI / 2, 0); MWG.ensure(c); });
    await attendre(1000);
    await e(() => MWJ.L.togCapot(__mwj.jobs()[0]));
    await attendreCondition(page, () => { const g = __mwj.mesh(__mwj.jobs()[0]); return g && g.userData.bay && MWF.lamp().on; }, `${id} : la baie ou la baladeuse n'apparaît pas`, 120000);
    await attendre(800);

    // couleurs de la baie : les trois bocaux ont des liquides de couleurs différentes, ombres de contact présentes
    const baie = await e(() => {
      const g = __mwj.mesh(__mwj.jobs()[0]), b = g.userData.bay, P = b.userData.parts, col = n => { let h = null; P[n].traverse(o => { if (o.isMesh && !h) h = o.material.color.getHex(); }); return h; };
      return { liq: [col('coolant'), col('washer'), col('brakeFluid')], ao: !!b.getObjectByName('bay_ao'), lampe: MWF.lamp().light.intensity };
    });
    verifier(new Set(baie.liq).size === 3, `${id} : les liquides des bocaux ne sont pas de couleurs différentes (${baie.liq})`);
    verifier(baie.ao, `${id} : pas d'ombres de contact dans la baie`);
    verifier(baie.lampe <= 2, `${id} : la baladeuse éclaire trop fort (${baie.lampe})`);

    // vues : face et en diagonale, capot ouvert
    const cam = async (lx, lz, pitch) => {
      await e(([lx, lz, pitch]) => {
        const g = __mwj.mesh(__mwj.jobs()[0]); g.updateMatrixWorld(true);
        const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(g.matrixWorld), bz = g.userData.anchors.bay.position.z;
        const t = new THREE.Vector3(0, 0, bz).applyMatrix4(g.matrixWorld);
        __mw.teleport(v.x, v.z, Math.atan2(t.x - v.x, t.z - v.z), pitch);
      }, [lx, lz, pitch]);
      await attendre(1200);
    };
    const bz = await e(() => __mwj.mesh(__mwj.jobs()[0]).userData.anchors.bay.position.z), s = bz >= 0 ? 1 : -1;
    for (const [nom, lx, lz, pitch] of [['face', 0, bz + s * 1.9, -0.55], ['diagonale', -1.5, bz + s * 1.4, -0.6]]) {
      await cam(lx, lz, pitch);
      const m = await mesure();
      const calls = await e(() => __mw.renderer().info.render.calls);
      bilan.push(`${id}/${nom} blanc ${(m.blanc * 100).toFixed(1)} % cases ${(m.saturees * 100).toFixed(1)} % écart ${m.ecart.toFixed(0)} appels ${calls}`);
      verifier(m.blanc < .05, `${id} (${nom}) : ${(m.blanc * 100).toFixed(1)} % de pixels quasi blancs, la baie sature`);
      verifier(m.saturees < .03, `${id} (${nom}) : de grandes surfaces saturent au blanc (${(m.saturees * 100).toFixed(1)} % des cases)`);
      verifier(m.ecart > 25, `${id} (${nom}) : image trop uniforme, écart de luminance ${m.ecart.toFixed(0)}`);
      // plafond d'appels de dessin : la mesure cumule la passe des mains ; la référence avant ce lot allait jusqu'à 570
      verifier(calls > 5 && calls < 620, `${id} (${nom}) : nombre d'appels de dessin inattendu : ${calls}`);
    }

    // dessous : plusieurs matières (plancher, berceau, bras, carter, échappement, réservoir)
    if (id === 'clio4') {
      const mats = await e(() => {
        const g = __mwj.mesh(__mwj.jobs()[0]), cols = new Set();
        for (const o of g.children) if (o.isMesh && o.material && o.material.color && !o.name) cols.add(o.material.color.getHex());
        const u = g.userData.under; if (u) { const c = u.geometry.attributes.color, k = new Set(); for (let i = 0; i < c.count; i++) k.add([c.getX(i), c.getY(i), c.getZ(i)].map(v => Math.round(v * 255)).join()); cols.add('dessous'); return cols.size - 1 + Math.min(k.size, 40); } /* le dessous (js/44c) est un seul maillage coloré par sommet : on compte ses couleurs */
        return cols.size;
      });
      verifier(mats >= 12, `le dessous et la carrosserie n'ont pas assez de matières distinctes (${mats})`);
    }
  }
  return 'baie lisible sans saturation (' + bilan.join(' ; ') + ')';
};

module.exports.titre = 'mécanicien (rendu) : baie lisible, pas de blanc saturé, bocaux colorés, appels de dessin';
module.exports.appareil = 'bureau';
