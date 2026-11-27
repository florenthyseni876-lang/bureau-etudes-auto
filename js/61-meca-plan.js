'use strict';
/* ───────────── Mode « Mécanicien » — PLAN DE RÉPARATION (liste des étapes à l'écran) ─────────────

   But : le joueur n'a pas à tout retenir. Près d'une voiture à réparer, un encadré « Étapes » liste ce qu'il reste à faire,
   et coche chaque étape au fur et à mesure.

   · Ordre de travaux (vidange, plaquettes…) : les étapes s'affichent tout de suite.
   · Panne à diagnostiquer : tant que la cause n'est pas trouvée, l'encadré rappelle les indices déjà recueillis
     (valise, essai, inspections) et les moyens de chercher. Dès que la pièce en cause est identifiée (inspectée et trouvée
     usée, ou diagnostic du travail automatique), les étapes de la réparation apparaissent, dégâts en chaîne compris.

   Les étapes sont déduites de l'état de la voiture (js/41) :
     c.st.capot / c.st.lifted / c.st.av / c.st.ar   capot ouvert, pont levé, roues avant / arrière déposées
     c.rem[id] / c.done[id]                         pièce déposée / pièce neuve posée
     c.insp[id]                                     pièce inspectée
   Rien n'est sauvegardé : tout est recalculé deux à trois fois par seconde.

   ═══ API `MWPLAN` (aussi `window.__mwplan`) ═══
   MWPLAN.steps(c)      → [{txt, ok}]  étapes de la voiture c (vide si la panne n'est pas encore diagnostiquée)
   MWPLAN.diagnosed(c)  → vrai si la cause de la panne est identifiée (ou s'il n'y a pas de panne)
   MWPLAN.refresh()     met l'encadré à jour tout de suite */
const MWPLAN = (() => {

  const PERIODE_MS = 400;   /* fréquence de mise à jour de l'encadré */
  const MAX_LIGNES = 12;    /* au-delà, on n'affiche que les prochaines étapes */

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  /* ── Voiture devant le joueur : celle sur laquelle portent les gestes (js/46) ── */
  function voitureProche() {
    if (typeof MWG === 'undefined' || !MWG.rig) return null;
    const rig = MWG.rig();
    if (!rig || !rig.c) return null;
    return MWJ.jobs().includes(rig.c) ? rig.c : null;
  }

  const nomPiece = (c, id) => MWJ.pn(c, MWJ.PARTS[id]);

  /* ── Diagnostic ── */
  function diagnosed(c) {
    if (!c.symp) return true;
    return !!(c.autoDiag || (c.insp && c.insp[c.symp.c]));
  }

  /* pièces abîmées par la panne d'origine (js/51), une fois inspectées */
  function piecesEnChaine(c) {
    const def = MWJ.symDef ? MWJ.symDef(c) : null;
    if (!def || !def.ch) return [];
    return def.ch.filter(id => c.insp[id] && c.parts[id] && !c.parts[id].na);
  }

  /* toutes les pièces à remplacer, dans l'ordre */
  function piecesARemplacer(c) {
    const ids = c.ordre.slice();
    if (c.symp && diagnosed(c)) {
      if (!ids.includes(c.symp.c)) ids.push(c.symp.c);
      for (const id of piecesEnChaine(c)) if (!ids.includes(id)) ids.push(id);
    }
    return ids.filter(id => MWJ.PARTS[id]);
  }

  /* ── Étapes d'accès : capot, pont, roues ── */
  function etapesAcces(c, ids) {
    const zones = new Set(ids.map(id => MWJ.PARTS[id].zone));
    const essieux = new Set(ids.filter(id => MWJ.PARTS[id].zone === 'roue').map(id => MWJ.PARTS[id].ax));
    const pasFini = ids.some(id => !c.done[id]);
    const out = [];
    if (zones.has('capot')) out.push({ txt: 'Ouvrir le capot', ok: !!c.st.capot || !pasFini });
    if (zones.has('dessous') || zones.has('roue')) {
      const lever = c.noir ? 'Mettre la voiture sur chandelles' : 'Lever le pont';
      out.push({ txt: lever, ok: !!c.st.lifted || !pasFini });
    }
    const roues = (cote, deposees) => out.push({ txt: `Déposer les roues ${cote}`, ok: !!deposees || !pasFini });
    if (essieux.has('av') || essieux.has('*')) roues('avant', c.st.av);
    if (essieux.has('ar') || essieux.has('*')) roues('arrière', c.st.ar);
    return out;
  }

  /* ── Étapes complètes d'une voiture ── */
  function steps(c) {
    if (!c || !diagnosed(c)) return [];
    const ids = piecesARemplacer(c);
    const out = etapesAcces(c, ids);
    for (const id of ids) {
      const nom = nomPiece(c, id);
      const chaine = c.symp && id !== c.symp.c && !c.ordre.includes(id) ? ' (dégât en chaîne)' : '';
      out.push({ txt: `Déposer : ${nom}${chaine}`, ok: !!(c.rem[id] || c.done[id]) });
      out.push({ txt: `Poser la pièce neuve : ${nom}`, ok: !!c.done[id] });
    }
    const toutPose = ids.every(id => c.done[id]);
    const blocages = typeof MWG !== 'undefined' && MWG.blocage ? MWG.blocage(c) : [];
    out.push({ txt: 'Tout remonter et refermer (roues, pont, capot)', ok: toutPose && !blocages.length });
    if (c.symp) out.push({ txt: 'Essai sur route pour confirmer (facultatif)', ok: !!c.essai });
    out.push({ txt: 'Rendre la voiture (portière conducteur)', ok: false });
    return out;
  }

  /* ── Encadré « Diagnostic en cours » : indices déjà recueillis ── */
  function htmlDiagnostic(c) {
    const lignes = [];
    if (c.codes && c.codes.length) lignes.push(`Valise : ${c.codes.map(esc).join(' ; ')}`);
    if (c.clues && c.clues.length) lignes.push(`Indices : ${c.clues.map(esc).join(' ')}`);
    const vues = Object.keys(c.insp || {}).filter(id => MWJ.PARTS[id]).map(id => esc(nomPiece(c, id)));
    if (vues.length) lignes.push(`Déjà inspecté : ${vues.join(', ')}`);
    if (!lignes.length) lignes.push('Lisez la valise de diagnostic (habitacle), faites un essai sur route, puis inspectez les pièces suspectes.');
    return `<b>Diagnostic en cours</b> · « ${esc(c.symp.txt)} »<br><small>${lignes.join('<br>')}</small>` +
      '<br><small class="hint">Les étapes de la réparation s\'afficheront dès que la pièce en cause sera identifiée (inspectez-la).</small>';
  }

  /* ── Encadré des étapes ── */
  function htmlEtapes(c, liste) {
    const prochaine = liste.findIndex(e => !e.ok);
    let debut = 0;
    if (liste.length > MAX_LIGNES) debut = Math.max(0, Math.min(prochaine - 2, liste.length - MAX_LIGNES));
    const lignes = liste.slice(debut, debut + MAX_LIGNES).map((e, i) => {
      const n = debut + i;
      const style = e.ok ? ' style="opacity:.55;text-decoration:line-through"' : n === prochaine ? ' style="color:#ffd23a;font-weight:700"' : '';
      return `<div${style}>${e.ok ? '✓' : '☐'} ${n + 1}. ${esc(e.txt)}</div>`;
    });
    const titre = c.symp ? `Réparation : ${esc(nomPiece(c, c.symp.c))} en cause` : `Étapes : ${esc(c.nom)}`;
    return `<b>${titre}</b><small>${lignes.join('')}</small>`;
  }

  function refresh() {
    if (!MW.S) return;
    const c = voitureProche();
    if (!c) { MW.hud('plan', ''); return; }
    if (c.symp && !diagnosed(c)) { MW.hud('plan', htmlDiagnostic(c)); return; }
    MW.hud('plan', htmlEtapes(c, steps(c)));
  }

  let dernier = 0;
  MW.on('tick', () => {
    const t = performance.now();
    if (t - dernier < PERIODE_MS) return;
    dernier = t;
    refresh();
  });
  MW.on('close', () => MW.hud('plan', ''));

  return { steps, diagnosed, refresh };
})();
window.__mwplan = MWPLAN;
