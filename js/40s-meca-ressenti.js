'use strict';
/* ────────── Mode « Mécanicien » — RESSENTI DE CONDUITE : roulis, tangage, crissement, traces de pneus ──────────
   Lit l'état dynamique de la voiture du joueur (MW.carDyn, calculé par js/40p) et le rend visible et audible :
     · roulis : la caisse se penche vers l'extérieur du virage (environ 2° par g) ;
     · tangage : elle plonge du nez au freinage et se cabre à l'accélération (environ 1,2° par g) ;
       une suspension plus ferme (réglage de braquage de js/58) réduit les deux ;
     · crissement : un bruit de pneus filtré dont le volume suit le glissement, dès que les pneus approchent de la limite ;
     · traces : des marques noires au sol, derrière les roues arrière, quand la voiture glisse (160 marques au plus, un seul appel de dessin).

   ═══ API `MWFEEL` (aussi `window.__mwfeel`) ═══
   MWFEEL.roulis() / MWFEEL.tangage()   angles actuels de la caisse (rad)
   MWFEEL.crissement()                  volume actuel du crissement (0..1)
   MWFEEL.traces()                      nombre de traces posées depuis le début de la partie */
const MWFEEL = (() => {
  const T = THREE;
  const api = {};
  const G = 9.81;
  const ROULIS_PAR_G = 0.035;      /* rad par g d'accélération latérale */
  const TANGAGE_PAR_G = 0.021;     /* rad par g d'accélération longitudinale */
  const SEUIL_CRISSEMENT = 0.72;   /* glissement (0..1+) au-dessus duquel les pneus crissent */
  const NB_TRACES = 160;

  let roulis = 0;
  let tangage = 0;
  let volumeCrissement = 0;
  let tracesPosees = 0;
  let prochaineTrace = 0;
  let tempsTrace = 0;

  /* ═══════════ Roulis et tangage ═══════════ */
  function suivreCaisse(dt, dyn, mesh) {
    const drv = MW.drv || { turn: 1 };
    const fermete = Math.max(0.6, drv.turn || 1);
    const cibleRoulis = dyn.inCar ? ROULIS_PAR_G * (dyn.ay / G) / (fermete * fermete) : 0;
    const cibleTangage = dyn.inCar ? -TANGAGE_PAR_G * (dyn.ax / G) / fermete : 0;
    const k = 1 - Math.exp(-7 * dt);
    roulis += (cibleRoulis - roulis) * k;
    tangage += (cibleTangage - tangage) * k;
    if (!mesh) {
      return;
    }
    mesh.rotation.order = 'YXZ';
    mesh.rotation.x = tangage;
    mesh.rotation.z = roulis;
  }

  /* ═══════════ Traces de pneus ═══════════ */
  let traces = null;
  const matrice = new T.Matrix4();
  const quaternion = new T.Quaternion();
  const axeY = new T.Vector3(0, 1, 0);
  const echelle = new T.Vector3(1, 1, 1);
  const position = new T.Vector3();

  function creerTraces() {
    const geo = new T.PlaneGeometry(0.2, 0.8).rotateX(-Math.PI / 2);
    const mat = new T.MeshBasicMaterial({
      color: 0x0c0c0e,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    traces = new T.InstancedMesh(geo, mat, NB_TRACES);
    traces.frustumCulled = false;
    const cache = new T.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < NB_TRACES; i++) {
      traces.setMatrixAt(i, cache);
    }
    traces.instanceMatrix.needsUpdate = true;
    MW.scene.add(traces);
  }

  function poserTraces(dt, dyn, voiture) {
    tempsTrace += dt;
    if (!dyn.inCar || dyn.slip < 0.9 || Math.abs(dyn.u) < 3 || tempsTrace < 0.05) {
      return;
    }
    tempsTrace = 0;
    if (!traces) {
      creerTraces();
    }
    const ud = voiture.mesh.userData || {};
    const demiVoie = (ud.W || 1.75) / 2 - 0.14;
    const demiEmpattement = (ud.WB || 2.6) / 2;
    const cap = voiture.ry;
    const sin = Math.sin(cap);
    const cos = Math.cos(cap);
    quaternion.setFromAxisAngle(axeY, cap);
    for (const cote of [-1, 1]) {
      const lx = cote * demiVoie;
      const lz = -demiEmpattement;
      position.set(voiture.x + cos * lx + sin * lz, 0.07, voiture.z - sin * lx + cos * lz);
      matrice.compose(position, quaternion, echelle);
      traces.setMatrixAt(prochaineTrace, matrice);
      prochaineTrace = (prochaineTrace + 1) % NB_TRACES;
      tracesPosees++;
    }
    traces.instanceMatrix.needsUpdate = true;
  }

  /* ═══════════ Crissement des pneus ═══════════ */
  let audio = null;
  function preparerAudio() {
    try {
      const Contexte = window.AudioContext || window.webkitAudioContext;
      if (!Contexte) {
        return null;
      }
      const ctx = new Contexte();
      const longueur = ctx.sampleRate;
      const tampon = ctx.createBuffer(1, longueur, ctx.sampleRate);
      const donnees = tampon.getChannelData(0);
      for (let i = 0; i < longueur; i++) {
        donnees[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = tampon;
      source.loop = true;
      const filtre = ctx.createBiquadFilter();
      filtre.type = 'bandpass';
      filtre.frequency.value = 1500;
      filtre.Q.value = 3.2;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(filtre);
      filtre.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      return { ctx, filtre, gain };
    } catch (e) {
      return null;
    }
  }

  function crisser(dt, dyn) {
    const cible = dyn.inCar && Math.abs(dyn.u) > 2.5 && !MW.paused
      ? Math.min(1, Math.max(0, (dyn.slip - SEUIL_CRISSEMENT) / 0.5))
      : 0;
    volumeCrissement += (cible - volumeCrissement) * (1 - Math.exp(-10 * dt));
    if (volumeCrissement < 0.01 && !audio) {
      return;
    }
    if (!audio) {
      audio = preparerAudio();
    }
    if (!audio) {
      return;
    }
    if (audio.ctx.state === 'suspended') {
      audio.ctx.resume().catch(() => {});
    }
    audio.gain.gain.value = volumeCrissement * 0.1;
    audio.filtre.frequency.value = 1100 + 900 * Math.min(1, Math.abs(dyn.u) / 20);
  }

  /* ═══════════ Boucle ═══════════ */
  MW.on('tick', (dt) => {
    if (!MW.isOpen() || !MW.carDyn) {
      return;
    }
    const pas = Math.min(dt, 0.05);
    const dyn = MW.carDyn();
    const voiture = MW.playerCar();
    suivreCaisse(pas, dyn, voiture && voiture.mesh);
    if (!MW.paused) {
      poserTraces(pas, dyn, voiture);
    }
    crisser(pas, dyn);
  });

  api.roulis = () => roulis;
  api.tangage = () => tangage;
  api.crissement = () => volumeCrissement;
  api.traces = () => tracesPosees;
  return api;
})();
window.__mwfeel = MWFEEL;
