'use strict';
/* ─────────── Mode « Mécanicien » — VOITURES DE LA VILLE : une carrosserie simplifiée par modèle ───────────
   Les voitures de la circulation (js/53, instanciées) et les voitures garées (js/45b, fusionnées dans le décor) ne reprennent plus
   quelques gabarits génériques : chaque modèle du catalogue MWCARS (js/44) a sa propre carrosserie simplifiée, construite à partir de
   sa fiche (longueur, largeur, hauteur, empattement, type de carrosserie). Tout est opaque : aucune voiture transparente.

   Une carrosserie = deux volumes lissés :
     · la caisse basse (capot, ailes, coffre, pare-chocs), construite par tranches le long de la voiture ;
     · l'habitacle (pare-brise, toit peint, lunette arrière, vitres latérales), plus étroit en haut qu'en bas.
   S'y ajoutent des pare-chocs, des rétroviseurs, des phares et des feux arrière.

   ═══ API `MWVC` (aussi `window.__mwvc`) ═══
   MWVC.spec(id | fiche)        gabarit d'un modèle : {id, L, W, H, WB, body, kind, wheelR, trackW}
   MWVC.parts(spec)             parties de la carrosserie, en repère de la voiture (avant vers +z, pieds à y = 0) :
                                {paint, glass, dark, head, tail} : géométries indexées (position, normal) ; mêmes objets à chaque appel
   MWVC.merged(spec)            une seule géométrie (paint + glass + dark) avec couleurs et attribut aPaint (1 = reçoit la couleur
                                de l'instance, 0 = couleur fixe) : pour un InstancedMesh avec MWVC.material()
   MWVC.material()              matériau partagé des voitures instanciées (la couleur d'instance ne teinte que la peinture)
   MWVC.linear(hex)             [r, v, b] linéaires d'une couleur 0xRRGGBB (pour les lots fusionnés du décor)
   MWVC.colors                  {glass, dark, head, tail, rubber, hub} couleurs fixes (linéaires)
   MWVC.wheelPositions(spec)    4 centres de roues [x, y, z] (avant gauche, avant droite, arrière gauche, arrière droite)
   MWVC.count()                 nombre de carrosseries construites (un test vérifie « une forme par modèle »)
   MWVC.signature(spec)         empreinte de la forme (sert au test : deux modèles différents ont des formes différentes) */
const MWVC = (() => {
  const T = THREE;
  const api = {};
  const GARDE_AU_SOL = 0.2;       /* hauteur du dessous de caisse (m) */
  const cache = new Map();

  /* ═══════════ Couleurs fixes (linéaires) ═══════════ */
  const lin = (hex) => {
    const c = new T.Color(hex);
    c.convertSRGBToLinear();
    return [c.r, c.g, c.b];
  };
  api.linear = lin;
  api.colors = {
    glass: lin(0x2c4052),
    dark: lin(0x16181b),
    head: lin(0xf4eed2),
    tail: lin(0xa01418),
    rubber: lin(0x121214),
    hub: lin(0xb4b8be),
  };

  /* ═══════════ Profils de carrosserie ═══════════
     Hauteurs en fraction de la hauteur utile (de la garde au sol au toit), positions en fraction de la longueur (1 = avant, 0 = arrière).
     nose : hauteur de l'avant · cowl : hauteur du capot au pied du pare-brise · zCowl : position du pied du pare-brise
     zRoofF / zRoofR : début et fin du toit · zRear : pied de la lunette arrière · rearY : hauteur du coffre · tailY : hauteur de l'arrière */
  const PROFILS = {
    hatch: { nose: 0.50, cowl: 0.60, zCowl: 0.70, zRoofF: 0.56, zRoofR: 0.20, zRear: 0.04, rearY: 0.74, tailY: 0.70 },
    mini: { nose: 0.52, cowl: 0.60, zCowl: 0.72, zRoofF: 0.58, zRoofR: 0.18, zRear: 0.04, rearY: 0.78, tailY: 0.72 },
    sedan: { nose: 0.48, cowl: 0.58, zCowl: 0.68, zRoofF: 0.55, zRoofR: 0.32, zRear: 0.20, rearY: 0.62, tailY: 0.62 },
    wagon: { nose: 0.50, cowl: 0.60, zCowl: 0.70, zRoofF: 0.56, zRoofR: 0.08, zRear: 0.03, rearY: 0.80, tailY: 0.78 },
    suv: { nose: 0.56, cowl: 0.64, zCowl: 0.72, zRoofF: 0.58, zRoofR: 0.12, zRear: 0.03, rearY: 0.86, tailY: 0.84 },
    coupe: { nose: 0.50, cowl: 0.56, zCowl: 0.62, zRoofF: 0.50, zRoofR: 0.30, zRear: 0.12, rearY: 0.60, tailY: 0.62 },
    mid: { nose: 0.44, cowl: 0.52, zCowl: 0.62, zRoofF: 0.50, zRoofR: 0.36, zRear: 0.14, rearY: 0.62, tailY: 0.60 },
    rear: { nose: 0.54, cowl: 0.60, zCowl: 0.66, zRoofF: 0.52, zRoofR: 0.26, zRear: 0.05, rearY: 0.68, tailY: 0.66 },
    van: { nose: 0.50, cowl: 0.60, zCowl: 0.82, zRoofF: 0.72, zRoofR: 0.64, zRear: 0.64, rearY: 1.0, tailY: 1.0, cargo: 0.64 },
  };

  /* ═══════════ Gabarit d'un modèle ═══════════ */
  const KIND_BODY = { citadine: 'hatch', berline: 'sedan', sport: 'coupe', suv: 'suv', utilitaire: 'van' };
  const KIND_DIM = {
    citadine: [3.9, 1.72, 1.48, 2.5],
    berline: [4.6, 1.8, 1.45, 2.75],
    sport: [4.4, 1.85, 1.3, 2.65],
    suv: [4.5, 1.86, 1.68, 2.7],
    utilitaire: [4.8, 1.9, 1.95, 2.9],
  };

  /* rayon d'une roue (m) d'après les pneus « 195/55 R16 » : largeur × rapport + demi-jante */
  function rayonRoue(tyre, kind) {
    const m = /(\d+)\/(\d+)\s*R(\d+)/.exec(tyre || '');
    if (!m) return kind === 'suv' ? 0.36 : kind === 'utilitaire' ? 0.34 : 0.30;
    return (Number(m[1]) * Number(m[2]) / 100 + Number(m[3]) * 25.4 / 2) / 1000;
  }

  api.spec = function (modele) {
    let fiche = modele;
    if (typeof modele === 'string') {
      try {
        fiche = MWCARS.get(modele);
      } catch (e) {
        fiche = null;
      }
    }
    const kind = (fiche && fiche.kind) || 'berline';
    const dim = KIND_DIM[kind] || KIND_DIM.berline;
    const L = (fiche && fiche.L) || dim[0];
    const body = (fiche && fiche.body && PROFILS[fiche.body]) ? fiche.body : (KIND_BODY[kind] || 'sedan');
    return {
      id: (fiche && fiche.id) || body,
      L,
      W: (fiche && fiche.W) || dim[1],
      H: (fiche && fiche.H) || dim[2],
      WB: (fiche && fiche.WB) || L * 0.62,
      body,
      kind,
      wheelR: rayonRoue(fiche && fiche.tyre, kind),
      trackW: (fiche && fiche.W) || dim[1],
    };
  };

  api.wheelPositions = function (spec) {
    const x = spec.W / 2 - 0.12;
    const z = spec.WB / 2;
    const y = spec.wheelR;
    return [[x, y, z], [-x, y, z], [x, y, -z], [-x, y, -z]];
  };

  /* ═══════════ Constructeur de géométrie ═══════════ */
  function nouveauLot() {
    return { pos: [], nor: [], idx: [] };
  }

  /* quadrilatère a-b-c-d : la normale est orientée vers l'extérieur (loin du centre de la voiture) */
  function ajouterQuad(lot, centre, a, b, c, d) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = d[0] - a[0];
    const vy = d[1] - a[1];
    const vz = d[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) {
      return;
    }
    nx /= l;
    ny /= l;
    nz /= l;
    const mx = (a[0] + b[0] + c[0] + d[0]) / 4 - centre[0];
    const my = (a[1] + b[1] + c[1] + d[1]) / 4 - centre[1];
    const mz = (a[2] + b[2] + c[2] + d[2]) / 4 - centre[2];
    const sens = nx * mx + ny * my + nz * mz < 0 ? -1 : 1;
    const base = lot.pos.length / 3;
    for (const p of [a, b, c, d]) {
      lot.pos.push(p[0], p[1], p[2]);
      lot.nor.push(nx * sens, ny * sens, nz * sens);
    }
    if (sens > 0) {
      lot.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    } else {
      lot.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }

  /* éventail de triangles autour du barycentre d'un contour (bouchon d'une tranche) */
  function ajouterBouchon(lot, centre, contour) {
    const g = [0, 0, 0];
    for (const p of contour) {
      g[0] += p[0] / contour.length;
      g[1] += p[1] / contour.length;
      g[2] += p[2] / contour.length;
    }
    for (let i = 0; i < contour.length; i++) {
      const suivant = contour[(i + 1) % contour.length];
      ajouterQuad(lot, centre, g, contour[i], suivant, suivant);
    }
  }

  function ajouterBoite(lot, centre, x0, x1, y0, y1, z0, z1) {
    const p = (x, y, z) => [x, y, z];
    const s = [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)];
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    for (const f of faces) {
      ajouterQuad(lot, centre, s[f[0]], s[f[1]], s[f[2]], s[f[3]]);
    }
  }

  /* interpolation linéaire d'une ligne brisée [[z, y], …] triée par z décroissant */
  function surLigne(ligne, z) {
    if (z >= ligne[0][0]) {
      return ligne[0][1];
    }
    for (let i = 1; i < ligne.length; i++) {
      if (z >= ligne[i][0]) {
        const a = ligne[i - 1];
        const b = ligne[i];
        const t = (a[0] - z) / (a[0] - b[0] || 1);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return ligne[ligne.length - 1][1];
  }

  /* ═══════════ Construction d'une carrosserie ═══════════ */
  function construire(spec) {
    const P = PROFILS[spec.body] || PROFILS.sedan;
    const L = spec.L;
    const hw = spec.W / 2;
    const y0 = GARDE_AU_SOL;
    const hu = spec.H - y0;
    const lots = { paint: nouveauLot(), glass: nouveauLot(), dark: nouveauLot(), head: nouveauLot(), tail: nouveauLot() };
    const centre = [0, spec.H * 0.45, 0];
    const Y = (f) => y0 + f * hu;                 /* hauteur réelle d'une fraction */
    const Z = (f) => (f - 0.5) * L;               /* position réelle d'une fraction de longueur */

    /* ligne du dessus de la caisse basse (avant → arrière) */
    const dessus = [[1.0, P.nose * 0.88], [0.965, P.nose], [P.zCowl, P.cowl], [P.zRear, P.rearY], [0.035, P.tailY], [0.0, P.tailY * 0.9]];
    if (P.cargo) {
      dessus.length = 0;
      dessus.push([1.0, P.nose * 0.88], [0.965, P.nose], [P.zCowl, P.cowl], [P.cargo + 0.001, P.cowl]);
    }
    const largeurBout = (f) => (f > 0.9 ? 0.86 + (1 - f) * 1.4 : f < 0.08 ? 0.9 + f * 1.25 : 1);

    /* anneau de la caisse basse à la position f */
    const anneau = (f, yTop) => {
      const z = Z(f);
      const k = largeurBout(f);
      const w = hw * k;
      const wb = w * 0.88;
      const wt = w * 0.94;
      return [
        [-wb, y0, z], [-w, y0 + 0.14, z], [-w, yTop - 0.06, z], [-wt, yTop, z],
        [wt, yTop, z], [w, yTop - 0.06, z], [w, y0 + 0.14, z], [wb, y0, z],
      ];
    };
    const categorieSegment = ['dark', 'paint', 'paint', 'paint', 'paint', 'paint', 'dark', 'dark'];
    const stationsBasse = dessus.map((d) => d[0]);
    const anneaux = stationsBasse.map((f) => anneau(f, Y(surLigne(dessus, f))));
    for (let i = 0; i < anneaux.length - 1; i++) {
      for (let k = 0; k < 8; k++) {
        const a = anneaux[i];
        const b = anneaux[i + 1];
        ajouterQuad(lots[categorieSegment[k]], centre, a[k], a[(k + 1) % 8], b[(k + 1) % 8], b[k]);
      }
    }
    /* avant : bas sombre (pare-chocs), haut peint ; arrière : tout peint sauf le bas */
    const av = anneaux[0];
    ajouterBouchon(lots.dark, centre, [av[0], av[1], av[6], av[7]]);
    ajouterBouchon(lots.paint, centre, [av[1], av[2], av[3], av[4], av[5], av[6]]);
    const ar = anneaux[anneaux.length - 1];
    ajouterBouchon(lots.dark, centre, [ar[0], ar[1], ar[6], ar[7]]);
    ajouterBouchon(lots.paint, centre, [ar[1], ar[2], ar[3], ar[4], ar[5], ar[6]]);

    /* habitacle : (z, hauteur de base, hauteur du dessus) */
    const cabine = [];
    cabine.push([P.zCowl, surLigne(dessus, P.zCowl), surLigne(dessus, P.zCowl)]);
    cabine.push([P.zRoofF, surLigne(dessus, P.zRoofF), 1.0]);
    cabine.push([P.zRoofR, surLigne(dessus, P.zRoofR), 1.0]);
    cabine.push([P.zRear, surLigne(dessus, P.zRear), P.cargo ? 1.0 : P.rearY]);
    const bas = hw * 0.9;
    const haut = hw * 0.74;
    const cabAnneau = (c) => {
      const z = Z(c[0]);
      return [[-bas, Y(c[1]), z], [-haut, Y(c[2]), z], [haut, Y(c[2]), z], [bas, Y(c[1]), z]];
    };
    const cabs = cabine.map(cabAnneau);
    for (let i = 0; i < cabs.length - 1; i++) {
      const a = cabs[i];
      const b = cabs[i + 1];
      const toit = cabine[i][2] >= 0.999 && cabine[i + 1][2] >= 0.999;
      ajouterQuad(lots.glass, centre, a[0], a[1], b[1], b[0]);          /* vitre gauche */
      ajouterQuad(lots.glass, centre, a[3], a[2], b[2], b[3]);          /* vitre droite */
      ajouterQuad(lots[toit ? 'paint' : 'glass'], centre, a[1], a[2], b[2], b[1]);   /* toit, pare-brise ou lunette */
    }
    const derniere = cabs[cabs.length - 1];
    ajouterQuad(lots.paint, centre, derniere[0], derniere[1], derniere[2], derniere[3]);

    /* utilitaire : caisse de chargement peinte derrière la cabine */
    if (P.cargo) {
      const zc = Z(P.cargo);
      ajouterBoite(lots.paint, centre, -hw * 0.98, hw * 0.98, y0, spec.H - 0.03, -L / 2, zc);
    }

    /* pare-chocs, rétroviseurs */
    const bumperH = y0 + 0.3;
    ajouterBoite(lots.dark, centre, -hw * 0.96, hw * 0.96, y0, bumperH, L / 2 - 0.12, L / 2 + 0.03);
    ajouterBoite(lots.dark, centre, -hw * 0.94, hw * 0.94, y0, bumperH, -L / 2 - 0.03, -L / 2 + 0.12);
    const zMir = Z(P.zCowl) - 0.12;
    const yMir = Y(surLigne(dessus, P.zCowl)) + 0.05;
    for (const s of [-1, 1]) {
      ajouterBoite(lots.paint, centre, s > 0 ? hw * 0.9 : -hw - 0.1, s > 0 ? hw + 0.1 : -hw * 0.9, yMir, yMir + 0.12, zMir - 0.1, zMir + 0.1);
    }

    /* phares et feux arrière : petits panneaux sur les faces avant et arrière */
    const yPhare = y0 + (Y(P.nose) - y0) * 0.7 + 0.02;
    const yFeu = y0 + (Y(P.tailY) - y0) * 0.62;
    for (const s of [-1, 1]) {
      const x0 = s * hw * 0.52;
      const x1 = s * hw * 0.86;
      ajouterQuad(lots.head, centre, [x0, yPhare - 0.07, L / 2 + 0.035], [x1, yPhare - 0.07, L / 2 + 0.035],
        [x1, yPhare + 0.07, L / 2 + 0.035], [x0, yPhare + 0.07, L / 2 + 0.035]);
      ajouterQuad(lots.tail, centre, [x0, yFeu - 0.08, -L / 2 - 0.035], [x1, yFeu - 0.08, -L / 2 - 0.035],
        [x1, yFeu + 0.08, -L / 2 - 0.035], [x0, yFeu + 0.08, -L / 2 - 0.035]);
    }
    return lots;
  }

  function versGeometrie(lot) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(lot.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(lot.nor, 3));
    g.setIndex(lot.idx);
    g.computeBoundingSphere();
    return g;
  }

  api.parts = function (spec) {
    const cle = spec.id + '|' + spec.body + '|' + spec.L + '|' + spec.W + '|' + spec.H;
    let e = cache.get(cle);
    if (!e) {
      const lots = construire(spec);
      e = { parts: {}, merged: null, lots, spec };
      for (const k of Object.keys(lots)) {
        e.parts[k] = versGeometrie(lots[k]);
      }
      cache.set(cle, e);
    }
    return e.parts;
  };

  /* ═══════════ Géométrie fusionnée pour l'instanciation ═══════════ */
  api.merged = function (spec) {
    const cle = spec.id + '|' + spec.body + '|' + spec.L + '|' + spec.W + '|' + spec.H;
    api.parts(spec);
    const e = cache.get(cle);
    if (e.merged) {
      return e.merged;
    }
    const pos = [];
    const nor = [];
    const col = [];
    const paint = [];
    const idx = [];
    const ajouter = (lot, couleur, peinture) => {
      const base = pos.length / 3;
      for (let i = 0; i < lot.pos.length; i += 3) {
        pos.push(lot.pos[i], lot.pos[i + 1], lot.pos[i + 2]);
        nor.push(lot.nor[i], lot.nor[i + 1], lot.nor[i + 2]);
        col.push(couleur[0], couleur[1], couleur[2]);
        paint.push(peinture);
      }
      for (const i of lot.idx) {
        idx.push(base + i);
      }
    };
    ajouter(e.lots.paint, [1, 1, 1], 1);
    ajouter(e.lots.glass, api.colors.glass, 0);
    ajouter(e.lots.dark, api.colors.dark, 0);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setAttribute('aPaint', new T.Float32BufferAttribute(paint, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    e.merged = g;
    return g;
  };

  let materiauPartage = null;
  api.material = function () {
    if (materiauPartage) {
      return materiauPartage;
    }
    const m = new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    m.userData = { lin: 1 };
    m.onBeforeCompile = (shader) => {
      /* la couleur de l'instance ne teinte que les sommets de peinture (aPaint = 1) : vitres et pièces sombres gardent leur teinte */
      const couleurs = [
        '#if defined( USE_COLOR )',
        '  vColor = color;',
        '#else',
        '  vColor = vec3( 1.0 );',
        '#endif',
        '#ifdef USE_INSTANCING_COLOR',
        '  vColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, aPaint );',
        '#endif',
      ].join('\n');
      shader.vertexShader = 'attribute float aPaint;\n' + shader.vertexShader.replace('#include <color_vertex>', couleurs);
    };
    m.customProgramCacheKey = () => 'mwvc-peinture';
    materiauPartage = m;
    return m;
  };

  api.count = () => cache.size;

  /* empreinte de forme : longueur, hauteur du toit et position du toit mesurées sur les sommets de la peinture */
  api.signature = function (spec) {
    const g = api.merged(spec);
    const p = g.attributes.position;
    let zToitMin = 1e9;
    let zToitMax = -1e9;
    let yMax = -1e9;
    for (let i = 0; i < p.count; i++) {
      yMax = Math.max(yMax, p.getY(i));
    }
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > yMax - 0.01) {
        zToitMin = Math.min(zToitMin, p.getZ(i));
        zToitMax = Math.max(zToitMax, p.getZ(i));
      }
    }
    return [spec.L, spec.W, yMax, zToitMin, zToitMax].map((v) => v.toFixed(2)).join('/');
  };

  return api;
})();
window.__mwvc = MWVC;
