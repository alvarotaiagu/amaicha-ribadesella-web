"""La greca de Amaicha, redibujada con rectas (memoria feedback_logo_jpg_redibujar_rectas).

El logo (ref/origen/logo-amaicha-color.png, 300 px, hecho a mano) es una greca girada 45°: en el espacio girado son
CUADRADOS concéntricos (un cuadrado macizo con un punto, un anillo medio y un anillo exterior) y cuatro GANCHOS
rectilíneos que salen de dos esquinas opuestas del anillo exterior. No se calca: se dibuja ese modelo con un
entramado regular (banda = 1, hueco = g) y se ajustan sus medidas y su colocación por IoU contra el alfa del logo
(Nelder-Mead). La palabra AMAICHA es letra a pincel: esa sí va con potrace (curvas, alphamax 1,1) sobre el alfa x8.
La versión blanca de su WordPress (ref/marca/logo-amaicha-blanco.png) es el mismo dibujo: sirve de control.

Uso: python -I -X utf8 scripts/marca-greca.py
Escribe marca/greca.svg (currentColor), marca/logo.svg (los dos marrones del logo), marca/logo-blanco.svg,
marca/palabra.svg (currentColor) y marca/greca.json (el entramado en unidades de banda, para js/portada.js y el pie).
"""
import json, math, pathlib
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize
import potrace

RAIZ = pathlib.Path(__file__).resolve().parent.parent
im = np.array(Image.open(RAIZ / 'ref/origen/logo-amaicha-color.png').convert('RGBA')).astype(np.float32)
alfa = im[..., 3] / 255
lum = im[..., :3].mean(2)
greca_a = alfa * (lum > 90)          # taupe de la greca
texto_a = alfa * (lum < 75)          # marrón oscuro de la palabra
opaco = alfa > 0.9
COLOR_GRECA = '#%02X%02X%02X' % tuple(int(v) for v in np.median(im[opaco & (lum > 90)][:, :3], 0))
COLOR_TEXTO = '#%02X%02X%02X' % tuple(int(v) for v in np.median(im[opaco & (lum < 75)][:, :3], 0))
print('colores del logo: greca', COLOR_GRECA, '/ palabra', COLOR_TEXTO)

ESC = 4
H, W = alfa.shape
obj = np.asarray(Image.fromarray(greca_a.astype(np.float32), mode='F').resize((W * ESC, H * ESC), Image.BICUBIC)) > 0.5
blanco = np.array(Image.open(RAIZ / 'ref/marca/logo-amaicha-blanco.png').convert('RGBA')).astype(np.float32)[..., 3] / 255


def piezas(p):
    """Rectángulos del modelo en el espacio girado (unidades de banda)."""
    h0, g, yb, rd = p['h0'], p['g'], p['yb'], p['rd']
    m_in, m_out = h0 + g, h0 + g + 1
    a, E = h0 + 2 * g + 1, h0 + 2 * g + 2
    sx0, sx1 = E + g, E + g + 1               # el palo del gancho
    bx0, bx1 = E + 2 * g + 1, E + 2 * g + 2   # el lado de fuera del gancho
    gancho = [(E, -E, bx1, -a),               # el lado de arriba del anillo, prolongado
              (bx0, -E, bx1, yb),             # baja por fuera
              (sx0, yb - 1, bx1, yb),         # vuelve por abajo
              (sx0, -a + g, sx1, yb)]         # y sube el palo
    rects = []
    for (x0, y0, x1, y1) in gancho:
        rects.append((x0, y0, x1, y1))                          # gancho horizontal (esquina de arriba a la derecha)
        rects.append((-y1, -x1, -y0, -x0))                      # su reflejo en y = -x (el que sube)
    rects += [(-x1, -y1, -x0, -y0) for (x0, y0, x1, y1) in list(rects)]   # los dos de la esquina opuesta (180°)
    return dict(rects=rects, anillos=[(m_in, m_out), (a, E)], macizo=h0, punto=rd, E=E, a=a, ext=bx1)


def transformar(p):
    th = math.radians(p['rot'])
    c, s = math.cos(th), math.sin(th)
    def f(x, y):
        X = (x * c - y * s) * p['esc']
        Y = (x * s + y * c) * p['esc'] * p['ky']
        return (p['cx'] + X, p['cy'] + Y)
    return f


def cuadrado(f, r):
    return [f(-r, -r), f(r, -r), f(r, r), f(-r, r)]


def pintar(p, esc=ESC, w=W, h=H):
    pz = piezas(p)
    f = transformar(p)
    img = Image.new('L', (w * esc, h * esc), 0)
    d = ImageDraw.Draw(img)
    S = lambda pts: [(x * esc, y * esc) for x, y in pts]
    for (r0, r1) in sorted(pz['anillos'], reverse=True):     # de fuera adentro: el hueco de uno no borra el de dentro
        d.polygon(S(cuadrado(f, r1)), fill=255)
        d.polygon(S(cuadrado(f, r0)), fill=0)
    d.polygon(S(cuadrado(f, pz['macizo'])), fill=255)
    for (x0, y0, x1, y1) in pz['rects']:
        d.polygon(S([f(x0, y0), f(x1, y0), f(x1, y1), f(x0, y1)]), fill=255)
    cx, cy = f(0, 0)
    r = pz['punto'] * p['esc'] * esc
    d.ellipse([cx * esc - r, cy * esc - r, cx * esc + r, cy * esc + r], fill=0)
    return np.asarray(img) > 127


CLAVES = ['h0', 'g', 'yb', 'rd', 'esc', 'cx', 'cy', 'rot', 'ky']
INI = dict(h0=1.15, g=0.9, yb=-0.25, rd=0.18, esc=15.3, cx=150, cy=104, rot=45, ky=1.0)


def coste(v):
    p = dict(zip(CLAVES, v))
    if p['g'] < 0.4 or p['h0'] < 0.5 or p['rd'] < 0.05:
        return 1
    m = pintar(p)
    return -(m & obj).sum() / (m | obj).sum()


# rejilla gruesa para colocar el centro y la escala antes de afinar
mejor = None
for esc in (14.6, 15.0, 15.4, 15.8):
    for cx in range(144, 157, 2):
        for cy in range(98, 111, 2):
            v = [INI['h0'], INI['g'], INI['yb'], INI['rd'], esc, cx, cy, 45, 1]
            c = coste(v)
            if mejor is None or c < mejor[0]:
                mejor = (c, v)
print(f'rejilla: IoU {-mejor[0]:.3f} con esc {mejor[1][4]}, centro {mejor[1][5]},{mejor[1][6]}')
INI.update(dict(zip(CLAVES, mejor[1])))
res = optimize.minimize(coste, [INI[k] for k in CLAVES], method='Nelder-Mead', options=dict(maxiter=1600, xatol=1e-3, fatol=1e-5))
P = dict(zip(CLAVES, res.x))
iou_libre = -res.fun
# versión limpia: giro exacto de 45° y sin aplastar (ky = 1), reajustando el resto
CL = [k for k in CLAVES if k not in ('rot', 'ky')]
res2 = optimize.minimize(lambda v: coste([*v, 45.0, 1.0]), [P[k] for k in CL], method='Nelder-Mead', options=dict(maxiter=1600, xatol=1e-3, fatol=1e-5))
P2 = dict(zip(CL, res2.x)); P2.update(rot=45.0, ky=1.0)
print(f'IoU libre {iou_libre:.3f} (giro {P["rot"]:.2f}°, ky {P["ky"]:.3f}) / IoU limpio (45°, ky=1) {-res2.fun:.3f}')
P = P2
pz = piezas(P)
mb = pintar(P, ESC)
ob = np.asarray(Image.fromarray(blanco.astype(np.float32), mode='F').resize((W * ESC, H * ESC), Image.BICUBIC)) > 0.5
ob[int(205 * ESC):] = False
iou_blanco = (mb & ob).sum() / (mb | ob).sum()
print({k: round(v, 3) for k, v in P.items()}, f'/ IoU contra el logo blanco {iou_blanco:.3f}')


def r2(v):
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def sub_rect(x0, y0, x1, y1, inverso=False):
    pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    if inverso:
        pts = pts[::-1]
    return 'M' + ' '.join(f'{r2(x)} {r2(y)}' for x, y in pts) + 'Z'


d = ''
for (r0, r1) in pz['anillos']:
    d += sub_rect(-r1, -r1, r1, r1) + sub_rect(-r0, -r0, r0, r0, True)
d += sub_rect(-pz['macizo'], -pz['macizo'], pz['macizo'], pz['macizo'])
rd = pz['punto']
d += f'M{r2(rd)} 0A{r2(rd)} {r2(rd)} 0 0 0 {r2(-rd)} 0A{r2(rd)} {r2(rd)} 0 0 0 {r2(rd)} 0Z'   # el punto, al revés: agujero
for (x0, y0, x1, y1) in pz['rects']:
    d += sub_rect(x0, y0, x1, y1)

esq = [(x, y) for (x0, y0, x1, y1) in pz['rects'] for x in (x0, x1) for y in (y0, y1)] + [(s * pz['E'], t * pz['E']) for s in (-1, 1) for t in (-1, 1)]
semi_w = max(abs(x - y) for x, y in esq) / math.sqrt(2)
semi_h = max(abs(x + y) for x, y in esq) / math.sqrt(2)
vb = f'{r2(-semi_w)} {r2(-semi_h)} {r2(2 * semi_w)} {r2(2 * semi_h)}'
(RAIZ / 'marca/greca.svg').write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Greca de Amaicha"><path fill="currentColor" transform="rotate(45)" d="{d}"/></svg>\n', encoding='utf-8')

# ---------- la palabra AMAICHA: potrace (curvas) sobre el alfa x8 ----------
E8 = 8
ys, xs = np.where(texto_a > 0.05)
x0, y0, x1, y1 = xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4
trozo = Image.fromarray(texto_a[y0:y1, x0:x1].astype(np.float32), mode='F').resize(((x1 - x0) * E8, (y1 - y0) * E8), Image.BICUBIC)
mask = ndimage.gaussian_filter(np.asarray(trozo), 0.45 * E8) > 0.5
curvas = potrace.Bitmap(~mask).trace(turdsize=E8 * E8 * 4, alphamax=1.1, opticurve=True, opttolerance=0.6)
cxg, cyg, sg = P['cx'], P['cy'], P['esc']
F = lambda pt: ((pt.x / E8 + x0 - cxg) / sg, (pt.y / E8 + y0 - cyg) / sg)
pd = ''
for c in curvas:
    sx, sy = F(c.start_point)
    pd += f'M{r2(sx)} {r2(sy)}'
    for s in c.segments:
        if s.is_corner:
            (ax, ay), (bx, by) = F(s.c), F(s.end_point)
            pd += f'L{r2(ax)} {r2(ay)}L{r2(bx)} {r2(by)}'
        else:
            (ax, ay), (bx, by), (ex, ey) = F(s.c1), F(s.c2), F(s.end_point)
            pd += f'C{r2(ax)} {r2(ay)} {r2(bx)} {r2(by)} {r2(ex)} {r2(ey)}'
    pd += 'Z'
pal_top, pal_bot = (y0 - cyg) / sg, (y1 - cyg) / sg
pal_x0, pal_x1 = (x0 - cxg) / sg, (x1 - cxg) / sg
vb_pal = f'{r2(pal_x0)} {r2(pal_top)} {r2(pal_x1 - pal_x0)} {r2(pal_bot - pal_top)}'
(RAIZ / 'marca/palabra.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb_pal}" role="img" aria-label="Amaicha"><path fill="currentColor" d="{pd}"/></svg>\n', encoding='utf-8')

top, bot = -semi_h, pal_bot
izq, der = min(-semi_w, pal_x0), max(semi_w, pal_x1)
vb_logo = f'{r2(izq)} {r2(top)} {r2(der - izq)} {r2(bot - top)}'


def logo(cg, ct):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb_logo}" role="img" aria-label="Amaicha">'
            f'<path fill="{cg}" transform="rotate(45)" d="{d}"/><path fill="{ct}" d="{pd}"/></svg>\n')


(RAIZ / 'marca/logo.svg').write_text(logo(COLOR_GRECA, COLOR_TEXTO), encoding='utf-8')
(RAIZ / 'marca/logo-blanco.svg').write_text(logo('#F4F5F1', '#F4F5F1'), encoding='utf-8')

json.dump(dict(
    nota='Entramado de la greca en unidades de banda, en el espacio girado 45° (cuadrados). Para dibujarla: rotate(45). '
         'macizo = semilado del cuadrado central; anillos = [semilado interior, exterior]; rects = los cuatro ganchos.',
    colores=dict(greca=COLOR_GRECA, palabra=COLOR_TEXTO),
    medidas={k: round(v, 4) for k, v in P.items() if k in ('h0', 'g', 'yb', 'rd')},
    macizo=round(pz['macizo'], 4), punto=round(pz['punto'], 4), anillos=[[round(a, 4), round(b, 4)] for a, b in pz['anillos']],
    rects=[[round(v, 4) for v in r] for r in pz['rects']],
    semi=dict(ancho=round(semi_w, 4), alto=round(semi_h, 4)),
    palabra=dict(arriba=round(pal_top, 4), abajo=round(pal_bot, 4)),
    iou=dict(greca_limpia=round(-res2.fun, 4), greca_libre=round(iou_libre, 4), contra_logo_blanco=round(float(iou_blanco), 4)),
    viewBox=dict(greca=vb, logo=vb_logo, palabra=vb_pal),
), open(RAIZ / 'marca/greca.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('marca/greca.svg, logo.svg, logo-blanco.svg, palabra.svg y greca.json escritos')
