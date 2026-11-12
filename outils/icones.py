"""Génère les icônes de l'application (piston, bielle et vilebrequin sur fond de plan)."""
from PIL import Image, ImageDraw
import os, math
ICI = os.path.dirname(os.path.abspath(__file__))
DOSSIER = os.path.join(ICI, '..', 'icons')
NUIT, GRILLE, JAUNE, ACIER = (16, 35, 61), (34, 62, 98), (255, 184, 0), (205, 214, 224)

def dessiner(taille, marge):
    S = 1024
    im = Image.new('RGB', (S, S), NUIT)
    d = ImageDraw.Draw(im)
    for i in range(0, S, 64):
        d.line([(i, 0), (i, S)], fill=GRILLE, width=3)
        d.line([(0, i), (S, i)], fill=GRILLE, width=3)
    k = 1 - 2 * marge                      # zone utile (marge pour les icônes « maskable »)
    P = lambda x, y: (S / 2 + (x - 512) * k, S / 2 + (y - 512) * k)
    # cylindre
    d.rectangle([P(330, 150), P(694, 640)], outline=ACIER, width=int(18 * k))
    # vilebrequin : cercle + maneton
    cx, cy, r = 512, 760, 150
    d.ellipse([P(cx - 190, cy - 190), P(cx + 190, cy + 190)], outline=ACIER, width=int(18 * k))
    a = math.radians(-35)
    mx, my = cx + r * math.sin(a), cy - r * math.cos(a)
    # piston
    py = 330
    d.rectangle([P(352, py), P(672, py + 190)], fill=JAUNE)
    for f in (py + 45, py + 85):
        d.line([P(352, f), P(672, f)], fill=NUIT, width=int(14 * k))
    # bielle
    d.line([P(512, py + 150), P(mx, my)], fill=JAUNE, width=int(70 * k))
    d.ellipse([P(512 - 40, py + 110), P(512 + 40, py + 190)], fill=NUIT)
    d.ellipse([P(mx - 55, my - 55), P(mx + 55, my + 55)], fill=JAUNE)
    d.ellipse([P(cx - 45, cy - 45), P(cx + 45, cy + 45)], fill=ACIER)
    return im.resize((taille, taille), Image.LANCZOS)

os.makedirs(DOSSIER, exist_ok=True)
for nom, taille, marge in [('icon-192.png', 192, .04), ('icon-512.png', 512, .04),
                           ('icon-maskable-512.png', 512, .12), ('apple-touch-icon.png', 180, .06),
                           ('favicon-32.png', 32, .0)]:
    dessiner(taille, marge).save(os.path.join(DOSSIER, nom), optimize=True)
print('icônes générées dans', os.path.normpath(DOSSIER))
