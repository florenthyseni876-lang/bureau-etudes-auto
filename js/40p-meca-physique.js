'use strict';
/* ───────────── Mode « Mécanicien » — PHYSIQUE DE CONDUITE de la voiture du joueur ─────────────
   Modèle « bicyclette » à deux essieux, simple mais fidèle dans ses effets :
     · inertie : la voiture garde sa vitesse, sa dérive et sa rotation d'une image à l'autre ;
     · adhérence : chaque essieu transmet une force latérale qui sature (tanh) selon l'adhérence des pneus ;
       le cercle d'adhérence est respecté (freiner ou accélérer fort réduit la force latérale disponible) ;
     · transfert de charge : au freinage l'avant s'alourdit, à l'accélération l'arrière ; en virage, la charge latérale
       réduit un peu l'adhérence totale ;
     · freinage : couple réparti sur les essieux, limité par l'adhérence (pas de blocage) ;
     · braquage : angle limité à bas régime (rayon de braquage = empattement / tan(angle)), de plus en plus faible à vitesse élevée ;
     · frein à main : l'essieu arrière perd l'essentiel de son adhérence (dérive) ;
     · chocs : la caisse est un rectangle (longueur × largeur du modèle) approché par trois cercles ; le rebond est doux
       (restitution 0,2) et fait tourner la voiture selon le point d'impact.

   Conventions (repère de js/40) : x vers l'est, z vers le sud ; le cap `ry` est l'angle de l'avant (sin ry, cos ry) ;
   la gauche de la voiture est (cos ry, −sin ry). `u` = vitesse vers l'avant (m/s), `w` = vitesse latérale vers la gauche (m/s),
   `r` = vitesse de rotation du cap (rad/s, positive vers la gauche). Le braquage est positif vers la gauche.

   ═══ API `MWPHYS` (aussi `window.__mwphys`) ═══
   MWPHYS.spec(userData, drv)          gabarit physique d'une voiture : userData = celui de MW.carMesh ({L, W, H, WB, mdl, kind}),
                                        drv = réglages de MW.drv (js/58, tuning) : {vm, acc, brk, turn, eng} et, si présents,
                                        {mass (kg, allègement compris), ch (puissance), grip (adhérence des pneus), trac (autobloquant),
                                        gc (garde au sol en cm)}
                                        → {m (kg), puissance (W), L, W, WB, a, b, Iz, h, vm, brk, mu, traction, lsd, deltaMax, …}
                                        La MASSE, la PUISSANCE et la TRANSMISSION (traction, propulsion, quatre roues motrices) de la fiche
                                        MWCARS décident de l'accélération, du freinage, de l'inertie en virage et du comportement à la limite.
   MWPHYS.state(x, z, ry)              état initial {x, z, ry, u, w, r, steer, ax, ay}
   MWPHYS.step(s, p, entree, dt)       fait avancer l'état de dt secondes ; entree = {gaz (−1..1), volant (−1..1, droite positive),
                                        frein (frein à main, vrai/faux)} ; s.slip (0..1+) = glissement des pneus à la limite
   MWPHYS.cercles(s, p)                3 cercles {x, z} de rayon p.W / 2 qui recouvrent le rectangle de la caisse
   MWPHYS.collisions(s, p, pousser)    repousse la voiture hors des obstacles ; pousser(x, z, r) → {x, z, hit} (comme pushOut de js/40) ;
                                        applique le rebond ; renvoie {hit, vitesse (vitesse d'approche de l'impact le plus fort)}
   MWPHYS.chocVoiture(s, p, autre)     choc entre la voiture s et une autre {x, z, vx, vz, m} : répartit l'impulsion selon les masses (la plus légère
                                        est davantage repoussée) ; renvoie {dvx, dvz, vitesse} (variation de vitesse de l'autre) ou null
   MWPHYS.rectangle(s, p, marge)       rectangle orienté de la caisse {cx, cz, fx, fz, lx, lz, demiL, demiW}
   MWPHYS.distanceRectangle(rect, x, z) distance d'un point à la caisse (0 à l'intérieur)
   MWPHYS.repousserPoint(rect, x, z, r) repousse un disque (le joueur à pied) hors de la caisse → {x, z, hit}
   MWPHYS.simulerFreinage(p, v0)       distance (m) pour passer de v0 (m/s) à l'arrêt, plein frein, ligne droite
   MWPHYS.simulerRayon(p, v)           rayon (m) du cercle décrit à vitesse constante v (m/s), volant à fond */
const MWPHYS = (() => {
  const G = 9.81;
  const api = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lisse = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* ═══════════ Gabarit physique ═══════════ */
  const PARAMETRES_DEFAUT = { L: 4.2, W: 1.75, H: 1.45, WB: 2.6 };

  /* part de la masse sur l'essieu avant selon l'architecture */
  function partAvant(fiche) {
    if (!fiche) {
      return 0.58;
    }
    if (fiche.loc === 'rear') {
      return 0.40;
    }
    if (fiche.loc === 'mid') {
      return 0.44;
    }
    return fiche.drive === 'rwd' ? 0.53 : 0.60;
  }

  api.spec = function (userData, drv) {
    const ud = Object.assign({}, PARAMETRES_DEFAUT, userData || {});
    const reglages = Object.assign({ vm: 22, acc: 1, brk: 1, turn: 1, eng: 1 }, drv || {});
    let fiche = null;
    try {
      fiche = ud.mdl ? MWCARS.get(ud.mdl) : null;
    } catch (e) {
      fiche = null;
    }
    const masse = reglages.mass || (fiche && fiche.mass) || 1250;
    const chevaux = reglages.ch || (fiche && fiche.eng && fiche.eng.ch) || 90;
    const avant = partAvant(fiche);
    const WB = ud.WB || ud.L * 0.62;
    const a = WB * (1 - avant);
    const b = WB - a;
    const traction = fiche && fiche.drive ? fiche.drive : 'fwd';
    /* adhérence : celle des pneus (js/58) ; à défaut, déduite des multiplicateurs de braquage et de freinage */
    const mu = reglages.grip
      ? clamp(0.95 * reglages.grip, 0.7, 1.6)
      : clamp(1 + 0.22 * (reglages.turn - 1) + 0.1 * (reglages.brk - 1), 0.7, 1.5);
    /* centre de gravité : plus bas si la caisse est abaissée (js/58) */
    const gcFiche = fiche && fiche.gc ? fiche.gc * 100 : null;
    const decalageGc = reglages.gc != null && gcFiche != null ? (reglages.gc - gcFiche) / 100 : 0;
    return {
      m: masse,
      puissance: chevaux * 735.5 * 0.88 * Math.max(0.05, reglages.eng) * (reglages.ch ? 1 : reglages.acc),   /* js/58 donne déjà la puissance réelle */
      rapportPuissance: chevaux / (masse / 1000),
      L: ud.L,
      W: ud.W,
      H: ud.H,
      WB,
      a,
      b,
      Iz: masse * (ud.L * ud.L + ud.W * ud.W) / 12 * 1.15,
      h: clamp(Math.max(0.45, ud.H * 0.34) + decalageGc, 0.35, 0.8),
      vm: reglages.vm,
      brk: reglages.brk,
      mu,
      lsd: clamp(reglages.trac || 0, 0, 0.3),
      raideur: 11 * clamp(reglages.turn, 0.7, 1.8),
      sousVirage: 1.18,   /* l'essieu arrière est un peu plus raide : la voiture sous-vire (stable) à la limite */
      traction,
      deltaMax: 0.56,
    };
  };

  api.state = (x, z, ry) => ({ x, z, ry, u: 0, w: 0, r: 0, steer: 0, ax: 0, ay: 0, slip: 0 });

  /* ═══════════ Efforts des pneus ═══════════ */
  /* force latérale d'un essieu : saturante, avec cercle d'adhérence (la part déjà prise par l'effort longitudinal est retirée) */
  function forceLaterale(raideur, fz, glissement, fx, mu) {
    const limite = mu * fz;
    const reste = Math.sqrt(Math.max(1, limite * limite - fx * fx));
    return -reste * Math.tanh(raideur * fz * glissement / reste);
  }

  /* un sous-pas d'intégration (h court : 4 ms) */
  function sousPas(s, p, entree, h) {
    const u = s.u;
    const vitesseAbs = Math.abs(u);
    const sens = u >= -0.2 ? 1 : -1;

    /* braquage : cible dépendant de la vitesse, vitesse de rotation du volant limitée */
    /* à pleine butée, l'accélération latérale visée reste proche de l'adhérence (≈ 0,8 g) à toutes les vitesses */
    const deltaMax = p.deltaMax * p.mu / (1 + Math.pow(vitesseAbs / 7, 2));
    const cible = -entree.volant * deltaMax;
    const pas = (Math.abs(cible) < Math.abs(s.steer) ? 4.5 : 2.6) * h;
    s.steer += clamp(cible - s.steer, -pas, pas);
    const delta = s.steer;

    /* charges sur les essieux : transfert longitudinal (frein, accélération) et réduction d'adhérence en virage */
    const fzAvant0 = p.m * G * p.b / p.WB;
    const fzArriere0 = p.m * G * p.a / p.WB;
    const transfert = p.m * s.ax * p.h / p.WB;
    const fzAvant = clamp(fzAvant0 - transfert, 0.15 * fzAvant0, 2 * fzAvant0);
    const fzArriere = clamp(fzArriere0 + transfert, 0.15 * fzArriere0, 2 * fzArriere0);
    const chargeLaterale = Math.min(1, Math.abs(s.ay) / (p.mu * G));
    const muEffectif = p.mu * (1 - 0.08 * chargeLaterale * chargeLaterale);
    const muArriere = muEffectif * (entree.frein ? 0.32 : 1);

    /* efforts longitudinaux demandés */
    let fxAvant = 0;
    let fxArriere = 0;
    if (entree.gaz > 0.05 && u > -0.3) {
      /* force motrice : couple limité à bas régime (selon le rapport poids/puissance), puis puissance constante P / v ;
         la vitesse maxi du jeu ferme progressivement la courbe */
      const aCouple = 2.6 + 0.012 * p.rapportPuissance;
      const fCouple = p.m * aCouple * Math.min(1.4, 0.55 + 0.45 * p.vm / 22);
      const fPuissance = p.puissance * 0.88 / Math.max(u, 1.5);
      const fermeture = 1 - Math.pow(clamp(u / p.vm, 0, 1), 3);
      const demande = Math.min(fCouple, fPuissance) * fermeture * entree.gaz;
      /* répartition : traction (avant), propulsion (arrière), quatre roues motrices (40 / 60) */
      const rep = p.traction === 'awd' ? [0.4, 0.6] : p.traction === 'rwd' ? [0, 1] : [1, 0];
      /* autobloquant : la roue qui patine transmet moins mal → meilleure motricité de l'essieu moteur */
      const motricite = 1 + p.lsd * 1.5;
      fxAvant = Math.min(demande * rep[0], motricite * muEffectif * fzAvant);
      fxArriere = Math.min(demande * rep[1], motricite * muArriere * fzArriere);
    } else if (entree.gaz < -0.05) {
      if (u > 0.4) {
        const aFrein = 10.2 * p.brk * Math.pow(1250 / p.m, 0.3) * -entree.gaz;   /* les gros freins d'une voiture lourde fatiguent plus vite */
        const demande = p.m * aFrein;
        fxAvant = -Math.min(demande * 0.62, muEffectif * fzAvant);
        fxArriere = -Math.min(demande * 0.38, muArriere * fzArriere);
      } else {
        const demande = p.m * 2.6 * -entree.gaz * (1 - Math.min(1, Math.abs(Math.min(u, 0)) / 6));
        fxAvant = (p.traction === 'rwd' ? 0 : -1) * Math.min(demande, muEffectif * fzAvant);
        fxArriere = (p.traction === 'fwd' ? 0 : -1) * Math.min(demande, muArriere * fzArriere);
      }
    }
    if (entree.frein) {
      fxArriere -= Math.sign(u) * Math.min(p.m * 6, 0.9 * fzArriere) * Math.min(1, vitesseAbs / 0.5);
    }
    /* résistance au roulement et à l'air (la vitesse maxi vient surtout de la courbe moteur) */
    const resistance = (0.012 * p.m * G + 0.4 * u * Math.abs(u)) * Math.sign(u) * Math.min(1, vitesseAbs / 0.3);

    /* angles de dérive des pneus ; en dessous de 1,5 m/s le modèle cinématique prend le relais (voir plus bas) */
    const uRef = sens * Math.max(vitesseAbs, 1.5);
    const alphaAvant = Math.atan2(s.w + p.a * s.r, Math.abs(uRef)) * sens - delta * sens;
    const alphaArriere = Math.atan2(s.w - p.b * s.r, Math.abs(uRef)) * sens;
    s.slip = Math.max(Math.abs(alphaAvant), Math.abs(alphaArriere)) / (muEffectif / p.raideur);
    const fyAvant = forceLaterale(p.raideur, fzAvant, alphaAvant, fxAvant, muEffectif);
    const fyArriere = forceLaterale(p.raideur * p.sousVirage, fzArriere, alphaArriere, fxArriere, muArriere);

    const cd = Math.cos(delta);
    const sd = Math.sin(delta);
    const forceAvantX = fxAvant * cd - fyAvant * sd;
    const forceAvantY = fyAvant * cd + fxAvant * sd;
    const accU = (forceAvantX + fxArriere - resistance) / p.m + s.w * s.r;
    const accW = (forceAvantY + fyArriere) / p.m - u * s.r;
    const accR = (p.a * forceAvantY - p.b * fyArriere) / p.Iz;
    s.ax += (accU - s.ax) * Math.min(1, h * 12);       /* accélération lissée pour le transfert de charge */
    s.ay += ((accW + u * s.r) - s.ay) * Math.min(1, h * 12);

    s.u += accU * h;
    s.w += accW * h;
    s.r += accR * h;

    /* arrêt propre : sans gaz, la résistance ne fait pas repartir la voiture en arrière */
    if (Math.abs(s.u) < 0.05 && entree.gaz === 0 && Math.abs(fxAvant + fxArriere) < 1) {
      s.u = 0;
    }

    /* mélange avec le modèle cinématique à basse vitesse (stabilité) */
    const poids = lisse(1.5, 4, vitesseAbs);
    if (poids < 1) {
      const rCine = s.u * Math.tan(delta) / p.WB;
      s.r = lerp(rCine, s.r, poids);
      s.w = lerp(rCine * p.b, s.w, poids);
    }

    /* déplacement dans le monde */
    const sin = Math.sin(s.ry);
    const cos = Math.cos(s.ry);
    s.x += (s.u * sin + s.w * cos) * h;
    s.z += (s.u * cos - s.w * sin) * h;
    s.ry += s.r * h;
  }

  api.step = function (s, p, entree, dt) {
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      sousPas(s, p, entree, h);
    }
  };

  /* ═══════════ Caisse et collisions ═══════════ */
  api.rectangle = function (s, p, marge) {
    const m = marge || 0;
    return {
      cx: s.x, cz: s.z,
      fx: Math.sin(s.ry), fz: Math.cos(s.ry),
      lx: Math.cos(s.ry), lz: -Math.sin(s.ry),
      demiL: p.L / 2 + m, demiW: p.W / 2 + m,
    };
  };

  api.distanceRectangle = function (rect, x, z) {
    const dx = x - rect.cx;
    const dz = z - rect.cz;
    const longi = Math.abs(dx * rect.fx + dz * rect.fz) - rect.demiL;
    const lat = Math.abs(dx * rect.lx + dz * rect.lz) - rect.demiW;
    const ex = Math.max(longi, 0);
    const ez = Math.max(lat, 0);
    if (longi < 0 && lat < 0) {
      return 0;
    }
    return Math.hypot(ex, ez);
  };

  /* repousse un disque de rayon r (le joueur à pied) hors de la caisse ; renvoie {x, z, hit} */
  api.repousserPoint = function (rect, x, z, r) {
    const dx = x - rect.cx;
    const dz = z - rect.cz;
    const longi = dx * rect.fx + dz * rect.fz;
    const lat = dx * rect.lx + dz * rect.lz;
    const pl = clamp(longi, -rect.demiL, rect.demiL);
    const pw = clamp(lat, -rect.demiW, rect.demiW);
    let nl = longi - pl;
    let nw = lat - pw;
    let d = Math.hypot(nl, nw);
    if (d >= r) {
      return { x, z, hit: false };
    }
    if (d < 1e-6) {
      /* centre dans la caisse : sortie par la face la plus proche */
      const sortieL = rect.demiL - Math.abs(longi);
      const sortieW = rect.demiW - Math.abs(lat);
      if (sortieL < sortieW) {
        nl = Math.sign(longi || 1);
        nw = 0;
      } else {
        nl = 0;
        nw = Math.sign(lat || 1);
      }
      d = 1;
    }
    const k = (r - Math.hypot(longi - pl, lat - pw)) / d;
    const poussL = nl * k;
    const poussW = nw * k;
    return { x: x + rect.fx * poussL + rect.lx * poussW, z: z + rect.fz * poussL + rect.lz * poussW, hit: true };
  };

  api.cercles = function (s, p) {
    const e = Math.max(0, p.L / 2 - p.W / 2);
    const fx = Math.sin(s.ry);
    const fz = Math.cos(s.ry);
    return [-e, 0, e].map((o) => ({ x: s.x + fx * o, z: s.z + fz * o }));
  };

  /* impulsion d'un choc de normale n (de l'obstacle vers la voiture) au point rc (relatif au centre de gravité) */
  function impulsion(s, p, n, rc, restitution) {
    const sin = Math.sin(s.ry);
    const cos = Math.cos(s.ry);
    let vx = s.u * sin + s.w * cos;
    let vz = s.u * cos - s.w * sin;
    const contactX = vx + s.r * rc.z;
    const contactZ = vz - s.r * rc.x;
    const vn = contactX * n.x + contactZ * n.z;
    if (vn >= 0) {
      return 0;
    }
    const bras = rc.z * n.x - rc.x * n.z;
    const j = -(1 + restitution) * vn / (1 / p.m + bras * bras / p.Iz);
    vx += j * n.x / p.m;
    vz += j * n.z / p.m;
    s.r = clamp(s.r + j * bras / p.Iz, -3.5, 3.5);
    /* frottement contre l'obstacle : on perd un peu de la vitesse tangentielle */
    const tx = -n.z;
    const tz = n.x;
    const vt = vx * tx + vz * tz;
    vx -= vt * 0.12 * tx;
    vz -= vt * 0.12 * tz;
    s.u = vx * sin + vz * cos;
    s.w = vx * cos - vz * sin;
    return -vn;
  }

  /* choc entre deux voitures : impulsion répartie selon les masses ; la voiture s est modifiée, la variation de vitesse de l'autre est renvoyée */
  api.chocVoiture = function (s, p, autre) {
    const dx = s.x - autre.x;
    const dz = s.z - autre.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) {
      return null;
    }
    const n = { x: dx / d, z: dz / d };
    const fx = Math.sin(s.ry);
    const fz = Math.cos(s.ry);
    const lx = Math.cos(s.ry);
    const lz = -Math.sin(s.ry);
    const portee = p.L / 2 * Math.abs(n.x * fx + n.z * fz) + p.W / 2 * Math.abs(n.x * lx + n.z * lz);
    const rc = { x: -n.x * portee, z: -n.z * portee };
    const vx = s.u * fx + s.w * lx;
    const vz = s.u * fz + s.w * lz;
    const relX = vx + s.r * rc.z - autre.vx;
    const relZ = vz - s.r * rc.x - autre.vz;
    const vn = relX * n.x + relZ * n.z;
    if (vn >= 0) {
      return null;
    }
    const bras = rc.z * n.x - rc.x * n.z;
    const j = -(1 + 0.25) * vn / (1 / p.m + 1 / autre.m + bras * bras / p.Iz);
    const nvx = vx + j * n.x / p.m;
    const nvz = vz + j * n.z / p.m;
    s.u = nvx * fx + nvz * fz;
    s.w = nvx * lx + nvz * lz;
    s.r = clamp(s.r + j * bras / p.Iz, -3.5, 3.5);
    return { dvx: -j * n.x / autre.m, dvz: -j * n.z / autre.m, vitesse: -vn };
  };

  api.collisions = function (s, p, pousser) {
    let meilleur = 0;
    let touche = false;
    for (let essai = 0; essai < 2; essai++) {
      const cercles = api.cercles(s, p);
      for (const c of cercles) {
        const res = pousser(c.x, c.z, p.W / 2);
        if (!res.hit) {
          continue;
        }
        const dx = res.x - c.x;
        const dz = res.z - c.z;
        const longueur = Math.hypot(dx, dz);
        s.x += dx;
        s.z += dz;
        touche = true;
        if (longueur < 1e-6) {
          continue;
        }
        const n = { x: dx / longueur, z: dz / longueur };
        const v = impulsion(s, p, n, { x: c.x - s.x, z: c.z - s.z }, 0.2);
        meilleur = Math.max(meilleur, v);
      }
    }
    return { hit: touche, vitesse: meilleur };
  };

  /* ═══════════ Simulations pour les tests ═══════════ */
  api.simulerFreinage = function (p, v0) {
    const s = api.state(0, 0, 0);
    s.u = v0;
    let distance = 0;
    let t = 0;
    while (s.u > 0.05 && t < 20) {
      const avant = s.z;
      api.step(s, p, { gaz: -1, volant: 0, frein: false }, 0.02);
      distance += s.z - avant;
      t += 0.02;
    }
    return distance;
  };

  api.simulerRayon = function (p, v) {
    const s = api.state(0, 0, 0);
    s.u = v;
    const entree = { gaz: 0.0, volant: 1, frein: false };
    let t = 0;
    while (t < 8) {
      /* gaz juste assez pour garder la vitesse */
      entree.gaz = s.u < v ? 0.5 : 0;
      api.step(s, p, entree, 0.01);
      t += 0.01;
    }
    const vitesse = Math.hypot(s.u, s.w);
    return Math.abs(s.r) > 1e-4 ? vitesse / Math.abs(s.r) : Infinity;
  };

  return api;
})();
window.__mwphys = MWPHYS;
