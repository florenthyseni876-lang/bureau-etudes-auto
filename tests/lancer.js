#!/usr/bin/env node
'use strict';
// Point d'entrée des tests automatiques.
//   node tests/lancer.js [rapide|complet]     (rapide par défaut)
// Démarre un serveur local sur 127.0.0.1, lance Chromium, exécute les scénarios de
// tests/scenarios/, affiche un rapport en français et l'écrit dans tests/dernier-rapport.txt.
// Code de sortie 1 s'il y a au moins un échec.

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');

const RACINE = path.resolve(__dirname, '..');
const DOSSIER_SCENARIOS = path.join(__dirname, 'scenarios');
const RAPPORT = path.join(__dirname, 'dernier-rapport.txt');
const DELAI_SCENARIO_MS = 240000;
const PORT_MIN = 8900, PORT_MAX = 8999;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function formatDuree(ms) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace('.', ',')} s`;
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

function formatSecondes(ms) {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

// Choisit au hasard un port libre entre 8900 et 8999.
function portLibre() {
  const ports = [];
  for (let p = PORT_MIN; p <= PORT_MAX; p++) ports.push(p);
  for (let i = ports.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ports[i], ports[j]] = [ports[j], ports[i]];
  }
  const essayer = i => new Promise((resolve, reject) => {
    if (i >= ports.length) return reject(new Error(`aucun port libre entre ${PORT_MIN} et ${PORT_MAX}`));
    const s = net.createServer();
    s.once('error', () => essayer(i + 1).then(resolve, reject));
    s.listen(ports[i], '127.0.0.1', () => s.close(() => resolve(ports[i])));
  });
  return essayer(0);
}

// Serveur statique minimal, lié à 127.0.0.1, qui sert la racine du dépôt.
function demarrerServeur(port) {
  return new Promise((resolve, reject) => {
    const serveur = http.createServer((req, res) => {
      let chemin;
      try {
        chemin = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      } catch (e) {
        res.writeHead(400).end();
        return;
      }
      if (chemin.endsWith('/')) chemin += 'index.html';
      const fichier = path.normalize(path.join(RACINE, chemin));
      if (!fichier.startsWith(RACINE + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(fichier, (err, data) => {
        if (err) {
          res.writeHead(404).end('Introuvable');
          return;
        }
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    });
    serveur.once('error', reject);
    serveur.listen(port, '127.0.0.1', () => resolve(serveur));
  });
}

function avecDelai(promesse, ms, message) {
  let minuterie;
  const delai = new Promise((_, rejeter) => { minuterie = setTimeout(() => rejeter(new Error(message)), ms); });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuterie));
}

function chargerScenarios() {
  return fs.readdirSync(DOSSIER_SCENARIOS)
    .filter(f => f.endsWith('.js'))
    .sort()
    .map(f => {
      const fn = require(path.join(DOSSIER_SCENARIOS, f));
      return {
        fichier: f,
        fn,
        titre: fn.titre || f,
        appareil: fn.appareil || 'bureau',
        lourd: !!fn.lourd,
      };
    });
}

// Exécute un scénario dans un contexte neuf. Renvoie { echec, detail, duree }.
async function executer(navigateur, devices, s, env) {
  const options = s.appareil === 'bureau'
    ? { viewport: { width: 1280, height: 900 } }
    : devices[s.appareil];
  if (!options) return { echec: `appareil inconnu : ${s.appareil}`, duree: 0 };

  const contexte = await navigateur.newContext({ ...options, serviceWorkers: 'block' });
  const page = await contexte.newPage();
  page.setDefaultTimeout(15000);
  const erreursJs = [];
  page.on('pageerror', e => erreursJs.push(`erreur JS : ${String(e.message).split('\n')[0].slice(0, 160)}`));
  page.on('console', m => { if (m.type() === 'error') erreursJs.push(`erreur console : ${m.text().split('\n')[0].slice(0, 160)}`); });
  page.on('dialog', d => d.accept());

  const debut = Date.now();
  let echec = null, detail = '';
  try {
    const retour = await avecDelai(s.fn(page, env), DELAI_SCENARIO_MS, 'délai dépassé (plus de 4 minutes)');
    if (typeof retour === 'string') detail = retour;
  } catch (e) {
    echec = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 300);
  }
  if (!echec && erreursJs.length) {
    echec = erreursJs[0] + (erreursJs.length > 1 ? ` (et ${erreursJs.length - 1} autre(s))` : '');
  }
  const duree = Date.now() - debut;
  await contexte.close().catch(() => {});
  return { echec, detail, duree };
}

async function main() {
  const arg = (process.argv[2] || 'rapide').toLowerCase();
  if (arg !== 'rapide' && arg !== 'complet') {
    console.error('Usage : node tests/lancer.js [rapide|complet]');
    return 2;
  }
  const complet = arg === 'complet';

  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.error("Playwright est introuvable. Installez-le (npm install playwright) puis Chromium (npx playwright install chromium).");
    return 1;
  }

  const lignes = [];
  const sortir = l => { console.log(l); lignes.push(l); };
  const debutSuite = Date.now();
  const scenarios = chargerScenarios();
  const aExecuter = scenarios.filter(s => complet || !s.lourd);

  sortir(`Bureau d'Études Auto : tests « ${arg} » (${aExecuter.length} scénario(s) sur ${scenarios.length})`);
  sortir('');

  const port = await portLibre();
  const serveur = await demarrerServeur(port);
  const env = { url: `http://127.0.0.1:${port}/`, complet, rapide: !complet };

  let navigateur = null;
  let ok = 0, echecs = 0, ignores = 0;
  try {
    navigateur = await playwright.chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    });
  } catch (e) {
    sortir(`ÉCHEC : impossible de lancer Chromium (${String(e.message).split('\n')[0]})`);
    serveur.close();
    fs.writeFileSync(RAPPORT, lignes.join('\n') + '\n', 'utf8');
    return 1;
  }

  try {
    for (const s of scenarios) {
      if (!complet && s.lourd) {
        ignores++;
        sortir(`  IGNORÉ  ${s.titre} (mode rapide)`);
        continue;
      }
      const r = await executer(navigateur, playwright.devices, s, env);
      const duree = `(${formatSecondes(r.duree)})`;
      if (r.echec) {
        echecs++;
        sortir(`  ÉCHEC : ${s.titre} : ${r.echec} ${duree}`);
      } else {
        ok++;
        const info = r.detail ? ` : ${r.detail}` : '';
        sortir(`  OK      ${s.titre}${info} ${duree}`);
      }
    }
  } finally {
    await navigateur.close().catch(() => {});
    serveur.close();
  }

  const duree = Date.now() - debutSuite;
  sortir('');
  sortir(`Total : ${ok} OK, ${echecs} échec(s)${ignores ? `, ${ignores} ignoré(s)` : ''} — durée ${formatDuree(duree)}.`);
  fs.writeFileSync(RAPPORT, lignes.join('\n') + '\n', 'utf8');
  return echecs ? 1 : 0;
}

main().then(
  code => { process.exitCode = code; },
  e => { console.error('Erreur inattendue :', e); process.exitCode = 1; },
);
