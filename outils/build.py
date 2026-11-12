"""Construit l'application.

1. Regénère sw.js : liste des fichiers à garder hors connexion + numéro de version
   calculé à partir de leur contenu (chaque modification déclenche une mise à jour).
2. Assemble dist/bureau-etudes-auto.html : la même application en un seul fichier,
   pour la publier comme Artifact sur claude.ai.

Usage : python3 outils/build.py
"""
import hashlib, os, re
RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
lire = lambda p: open(os.path.join(RACINE, p), encoding='utf8').read()

index = lire('index.html')
scripts = re.findall(r'<script src="(js/[^"]+)"></script>', index)
fichiers = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'vendor/three.min.js'] + scripts + \
           ['icons/' + f for f in sorted(os.listdir(os.path.join(RACINE, 'icons')))]

# 1. service hors connexion
h = hashlib.sha256()
for f in fichiers[1:]:
    with open(os.path.join(RACINE, f), 'rb') as fh: h.update(fh.read())
version = h.hexdigest()[:10]
sw = lire('outils/sw.modele.js').replace('__VERSION__', version).replace('__FICHIERS__', ',\n  '.join(repr(f) for f in fichiers))
open(os.path.join(RACINE, 'sw.js'), 'w', encoding='utf8').write(sw)

# 2. version Artifact en un seul fichier
page = index
page = re.sub(r'\s*<!-- pwa:start -->.*?<!-- pwa:end -->', '', page, flags=re.S)
page = page.replace('<!-- three:start --><script src="vendor/three.min.js"></script><!-- three:end -->',
                    '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>')
code = '\n'.join(lire(s).replace("'use strict';\n", '', 1) for s in scripts)
page = re.sub(r'<!-- app:start -->.*?<!-- app:end -->', lambda m: "<script>\n(()=>{'use strict';\n" + code + "})();\n</script>", page, flags=re.S)
page = page.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + lire('css/style.css') + '</style>')
# l'enveloppe des Artifacts fournit doctype, html, head et body
corps = re.search(r'<head>(.*?)</head>\s*<body>(.*)</body>', page, flags=re.S)
tete = '\n'.join(l for l in corps.group(1).split('\n') if not re.match(r'\s*<meta (charset|name="viewport")', l))
os.makedirs(os.path.join(RACINE, 'dist'), exist_ok=True)
open(os.path.join(RACINE, 'dist', 'bureau-etudes-auto.html'), 'w', encoding='utf8').write(tete.strip() + '\n' + corps.group(2).strip() + '\n')
print(f'sw.js : version {version}, {len(fichiers)} fichiers gardés hors connexion')
print('dist/bureau-etudes-auto.html : version Artifact en un seul fichier')
