'use strict';
// Outils communs aux scénarios de test. Chaque échec se signale par une erreur
// dont le message est une raison lisible en français.

const attendre = ms => new Promise(r => setTimeout(r, ms));

function verifier(condition, raison) {
  if (!condition) throw new Error(raison);
}

// Première ligne du message d'une erreur Playwright, pour un rapport lisible.
function raisonCourte(e) {
  return String(e && e.message ? e.message : e).split('\n')[0].slice(0, 200);
}

async function estVisible(page, selecteur) {
  return page.locator(selecteur).first().isVisible().catch(() => false);
}

async function attendreVisible(page, selecteur, raison, delai = 15000) {
  try {
    await page.locator(selecteur).first().waitFor({ state: 'visible', timeout: delai });
  } catch (e) {
    throw new Error(raison || `élément absent de la page : ${selecteur}`);
  }
}

async function cliquer(page, selecteur, raison) {
  try {
    await page.click(selecteur, { timeout: 15000 });
  } catch (e) {
    throw new Error(raison || `impossible de cliquer sur ${selecteur} (${raisonCourte(e)})`);
  }
}

// Attend qu'une condition, évaluée dans la page, devienne vraie.
async function attendreCondition(page, fonction, raison, delai = 60000, arg) {
  try {
    await page.waitForFunction(fonction, arg, { timeout: delai });
  } catch (e) {
    throw new Error(raison);
  }
}

// Échoue si un texte visible contient NaN, undefined ou Infinity.
async function verifierTextes(page, ecran) {
  const trouves = await page.evaluate(() => {
    const motif = /\b(NaN|undefined|Infinity)\b/;
    const res = [];
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (!motif.test(n.textContent)) continue;
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript')) continue;
      if (!el.getClientRects().length) continue; // élément masqué
      res.push(n.textContent.trim().slice(0, 80));
      if (res.length >= 5) break;
    }
    return res;
  });
  if (trouves.length) throw new Error(`${ecran} : texte suspect affiché « ${trouves[0]} »`);
}

// Échoue si la page déborde horizontalement (défilement latéral).
async function verifierPasDeDebordement(page, ecran) {
  const d = await page.evaluate(() => Math.round(document.documentElement.scrollWidth - window.innerWidth));
  if (d > 1) throw new Error(`${ecran} : débordement horizontal de ${d} px`);
}

// Démarre une nouvelle carrière et la met en pause (le temps ne doit pas passer seul).
async function demarrerCarriere(page) {
  await attendreVisible(page, '#hNew', 'bouton « Nouvelle carrière » absent');
  await cliquer(page, '#hNew');
  await attendreVisible(page, '#hFound', 'écran de fondation absent');
  await cliquer(page, '#hFound');
  await attendreVisible(page, '[data-spd="0"]', 'quartier général de la carrière absent');
  await cliquer(page, '[data-spd="0"]');
  const fondee = await page.evaluate(() => !!window.__bea.G);
  verifier(fondee, "l'entreprise n'a pas été fondée");
  await verifierTextes(page, 'Quartier général');
}

// Conçoit la première voiture en suivant les 7 étapes guidées.
// Renvoie la liste des titres d'étapes parcourues.
async function concevoirPremiereVoiture(page, surEtape) {
  await cliquer(page, '[data-newcar]', 'bouton « Concevoir ma première voiture » absent');
  const etapes = [];
  for (let numero = 1; numero <= 7; numero++) {
    await attendreVisible(page, '.step-help b', `étape ${numero} : aide de l'étape absente`);
    const titre = (await page.textContent('.step-help b')).trim();
    verifier(titre.includes(`Étape ${numero} sur 7`), `étape ${numero} attendue, affichée : « ${titre} »`);
    etapes.push(titre);
    await verifierTextes(page, `conception, ${titre}`);
    if (surEtape) await surEtape(numero, titre);
    if (numero === 7) break;
    // Une étape avec des avertissements se valide en deux clics (« Valider quand même »).
    for (let essai = 0; essai < 2; essai++) {
      await attendreVisible(page, '#wizNext', `bouton de validation absent à l'étape ${numero}`);
      const bloquee = await page.$eval('#wizNext', b => b.disabled);
      if (bloquee) {
        const msg = await page.textContent('.wf-msg').catch(() => '');
        throw new Error(`étape ${numero} bloquée : ${msg.trim().slice(0, 150)}`);
      }
      await cliquer(page, '#wizNext');
      await attendre(350);
      const suivante = (await page.textContent('.step-help b').catch(() => '')).trim();
      if (suivante !== titre) break;
    }
    const apres = (await page.textContent('.step-help b').catch(() => '')).trim();
    verifier(apres !== titre, `étape ${numero} non validée (« ${titre} »)`);
  }
  // Mise en vente : le bouton de lancement doit être là et actif.
  await attendreVisible(page, '#launch', 'bouton « Lancer le développement » absent');
  const bloque = await page.$eval('#launch', b => b.disabled);
  if (bloque) {
    const msg = await page.textContent('#launchMsg').catch(() => '');
    throw new Error(`lancement impossible : ${msg.trim().slice(0, 150)}`);
  }
  return etapes;
}

// Lance le modèle et vérifie que le journal de presse s'ouvre, puis se ferme.
async function lancerModele(page) {
  await cliquer(page, '#launch', 'impossible de cliquer sur « Lancer le développement »');
  // La presse publie ses essais après quelques trimestres : on laisse passer le temps.
  let ouvert = false;
  for (let i = 0; i < 20 && !ouvert; i++) {
    if (await estVisible(page, '.lfx-close')) { ouvert = true; break; }
    if (await estVisible(page, '.lfx-skip')) { await cliquer(page, '.lfx-skip'); await attendre(400); continue; }
    if (await estVisible(page, '.lfx')) { await attendre(500); continue; }
    await cliquer(page, '#nextQ');
    await attendre(300);
  }
  verifier(ouvert, 'le journal de presse ne s\'ouvre pas après le lancement');
  await verifierTextes(page, 'journal de presse');
  await cliquer(page, '.lfx-close', 'bouton « Refermer le journal » non cliquable');
  await attendreCondition(page,
    () => { const l = document.querySelector('.lfx'); return !l || l.hidden; },
    'le journal de presse ne se ferme pas');
}

// Lit les nombres de haut niveau de M.E (moteur) et M.C (voiture) : renvoie ceux qui ne sont pas finis.
async function valeursNonFinies(page) {
  return page.evaluate(() => {
    const B = window.__bea;
    const out = [];
    for (const [nom, obj] of [['moteur', B.M.E], ['voiture', B.M.C]]) {
      if (!obj) { out.push(`${nom} absent`); continue; }
      for (const k of Object.keys(obj)) {
        if (typeof obj[k] === 'number' && !isFinite(obj[k])) out.push(`${nom}.${k}`);
      }
    }
    return out;
  });
}

module.exports = {
  attendre, verifier, raisonCourte, estVisible, attendreVisible, cliquer, attendreCondition,
  verifierTextes, verifierPasDeDebordement, demarrerCarriere, concevoirPremiereVoiture,
  lancerModele, valeursNonFinies,
};
