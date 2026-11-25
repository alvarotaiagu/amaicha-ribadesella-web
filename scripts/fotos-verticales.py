"""Endereza las verticales de las fotos de móvil (gran angular apuntando hacia arriba).

Receta de casa-juderia-olivenza-web/scripts/fotos.py (memoria feedback_corregir_verticales_fotos):
Canny + HoughLinesP, punto de fuga por RANSAC, homografía al 85 % con base fija, tope de apertura 1,4x
y 30 % de la apertura como estiramiento vertical. Recorte: solo el rectángulo que queda dentro.

Copiado de ../casa-benito-san-tirso-web/scripts/fotos-verticales.py; aquí las rutas son relativas a ref/
(ref/origen/… de su WordPress y ref/amenitiz/… de su motor de reservas).
Entrada: ref/<ruta>   (no se tocan)
Salida:  ref/enderezadas/<nombre del archivo> (máster JPG q95) + informe.json + hoja.jpg (antes / después)
Después: node scripts/fotos.mjs las toma si la foto lleva "enderezar": true en scripts/fotos-lista.json.
Las de exterior no se enderezan (la del hórreo de la portada, tampoco: se usa tal cual).

  python -I -X utf8 scripts/fotos-verticales.py            (las de la lista con enderezar)
  python -I -X utf8 scripts/fotos-verticales.py amenitiz/bhf4tm80s9qgnhtvswis.jpg
"""
import json, math, os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ORIGEN = os.path.join(RAIZ, 'ref')
DESTINO = os.path.join(RAIZ, 'ref', 'enderezadas')
os.makedirs(DESTINO, exist_ok=True)

FUERZA_VERTICAL = 0.85
TOPE_INCLINACION = 0.22
MIN_GRADOS = 0.6   # por debajo de esto no se nota: no se toca


def segmentos_verticales(bgr):
    H, W = bgr.shape[:2]
    esc = 1200 / H
    peq = cv2.resize(bgr, (round(W * esc), 1200), interpolation=cv2.INTER_CUBIC if esc > 1 else cv2.INTER_AREA)
    gris = cv2.GaussianBlur(cv2.cvtColor(peq, cv2.COLOR_BGR2GRAY), (3, 3), 0)
    bordes = cv2.Canny(gris, 40, 120)
    lineas = cv2.HoughLinesP(bordes, 1, np.pi / 720, threshold=60, minLineLength=110, maxLineGap=6)
    segs = []
    if lineas is None:
        return segs
    for x1, y1, x2, y2 in np.asarray(lineas).reshape(-1, 4):
        dy = y2 - y1
        if abs(dy) < 1: continue
        b = (x2 - x1) / dy
        if abs(b) > TOPE_INCLINACION: continue
        a = x1 + b * (600.0 - y1)
        segs.append((a / esc, b, math.hypot(x2 - x1, dy) / esc))
    return segs


def ajustar_fuga(segs, H):
    if len(segs) < 6:
        return None
    A = np.array(segs)
    a, b, w = A[:, 0], A[:, 1], A[:, 2]
    mejor, mejor_in = None, None
    rng = np.random.default_rng(7)
    tol = 0.006 * H
    for _ in range(400):
        i, j = rng.choice(len(A), 2, replace=False)
        if abs(b[i] - b[j]) < 1e-3: continue
        c1 = (a[i] - a[j]) / (b[i] - b[j]); c0 = a[i] - c1 * b[i]
        dentro = np.abs(a - (c0 + c1 * b)) < tol + np.abs(c1) * 0.004
        p = w[dentro].sum()
        if mejor is None or p > mejor:
            mejor, mejor_in = p, dentro
    if mejor_in is None or mejor_in.sum() < 5:
        return None
    X = np.c_[np.ones(mejor_in.sum()), b[mejor_in]]
    Wm = np.diag(w[mejor_in])
    c0, c1 = np.linalg.solve(X.T @ Wm @ X, X.T @ Wm @ a[mejor_in])
    return dict(c0=c0, c1=c1, n=int(mejor_in.sum()), b_medio=float(np.average(b[mejor_in], weights=w[mejor_in])))


def rect_interior(q, W, H):
    TL, TR, BR, BL = q
    x0 = max(0, TL[0], BL[0]); x1 = min(W, TR[0], BR[0])
    y0 = max(0, TL[1], TR[1]); y1 = min(H, BL[1], BR[1])
    def x_en(p, r, y):
        if abs(r[1] - p[1]) < 1e-6: return p[0]
        return p[0] + (r[0] - p[0]) * (y - p[1]) / (r[1] - p[1])
    for y in (y0, y1):
        x0 = max(x0, x_en(TL, BL, y)); x1 = min(x1, x_en(TR, BR, y))
    return (math.ceil(x0), math.ceil(y0), math.floor(x1), math.floor(y1))


def recorte_giro(W, H, grados):
    a = abs(math.radians(grados))
    s = 1 / (math.cos(a) + max(W, H) / min(W, H) * math.sin(a))
    w, h = W * s, H * s
    return (round((W - w) / 2), round((H - h) / 2), round((W + w) / 2), round((H + h) / 2))


def corregir(rgb):
    H, W = rgb.shape[:2]
    fit = ajustar_fuga(segmentos_verticales(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)), H)
    if not fit:
        return rgb, dict(tipo='sin verticales fiables')
    vx, vy = fit['c0'], H / 2 - fit['c1']
    if abs(vy - H / 2) < 0.8 * H:
        return rgb, dict(tipo='fuga demasiado cerca', fuga=[round(vx), round(vy)])
    if abs(vy) > 60 * H:
        giro = -math.degrees(math.atan(fit['b_medio'])) * FUERZA_VERTICAL
        if abs(giro) < MIN_GRADOS:
            return rgb, dict(tipo='a plomo', grados=round(giro, 2))
        M = cv2.getRotationMatrix2D((W / 2, H / 2), giro, 1.0)
        out = cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        x0, y0, x1, y1 = recorte_giro(W, H, giro)
        return out[y0:y1, x0:x1], dict(tipo='giro', grados=round(giro, 2), n=fit['n'])
    b_por = lambda x0, y0: (x0 - vx) / (y0 - vy)
    arriba = vy < H / 2
    yb = H if arriba else 0
    yo = 0 if arriba else H
    bl, br = b_por(0, yb), b_por(W, yb)
    grados = max(abs(math.degrees(math.atan(bl))), abs(math.degrees(math.atan(br))))
    if grados < MIN_GRADOS:
        return rgb, dict(tipo='convergencia leve', grados=round(grados, 2))
    xl_o = bl * (yo - yb); xr_o = W + br * (yo - yb)
    Wo = xr_o - xl_o
    f = FUERZA_VERTICAL
    if Wo < W:
        f = min(f, 1 - (W - 1.4 * Wo) / (W - Wo))
    xl_d = (1 - f) * bl * (yo - yb); xr_d = W + (1 - f) * br * (yo - yb)
    src = np.float32([[0, yb], [W, yb], [xr_o, yo], [xl_o, yo]])
    dst = np.float32([[0, yb], [W, yb], [xr_d, yo], [xl_d, yo]])
    Hm = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(rgb, Hm, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT)
    esq = cv2.perspectiveTransform(np.float32([[[0, 0], [W, 0], [W, H], [0, H]]]), Hm)[0]
    x0, y0, x1, y1 = rect_interior(esq, W, H)
    rec = out[y0:y1, x0:x1]
    apertura = (xr_d - xl_d) / (xr_o - xl_o)
    k = 1 + 0.3 * (apertura - 1)
    if k > 1.005:
        rec = cv2.resize(rec, (rec.shape[1], round(rec.shape[0] * k)), interpolation=cv2.INTER_CUBIC)
    return rec, dict(tipo='homografia', grados=round(grados, 2), fuerza=round(f, 2), aspecto=round(k, 3),
                     recorte=[int(x0), int(y0), int(x1), int(y1)], n=fit['n'])


def main():
    lista = json.load(open(os.path.join(AQUI, 'fotos-lista.json'), encoding='utf-8'))
    pedidas = sys.argv[1:]
    origenes = sorted({f['ruta'] for f in lista if f.get('enderezar')})
    if pedidas:
        origenes = [o for o in origenes if o in pedidas] or pedidas
    inf_path = os.path.join(DESTINO, 'informe.json')
    informe = json.load(open(inf_path, encoding='utf-8')) if os.path.exists(inf_path) else {}
    pares = []
    for o in origenes:
        rgb = np.array(Image.open(os.path.join(ORIGEN, o)).convert('RGB'))
        out, info = corregir(rgb)
        info['tamano'] = [int(out.shape[1]), int(out.shape[0])]
        informe[o] = info
        Image.fromarray(out).save(os.path.join(DESTINO, os.path.basename(o).rsplit('.', 1)[0] + '.jpg'), quality=95, subsampling=0)
        print(f'{o:42s} {info}')
        pares.append((rgb, out, o))
    json.dump(informe, open(inf_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    if pares:  # hoja antes / después con rejilla a plomo, para revisar a ojo
        tw, th = 420, 263
        hoja = Image.new('RGB', (tw * 2 + 30, len(pares) * (th + 24) + 10), (30, 30, 30))
        d = ImageDraw.Draw(hoja)
        for i, (a, b, o) in enumerate(pares):
            y = 10 + i * (th + 24)
            for j, im in enumerate((a, b)):
                p = Image.fromarray(im); p.thumbnail((tw, th))
                x = 10 + j * (tw + 10)
                hoja.paste(p, (x, y))
                for gx in range(0, p.size[0], 42):
                    d.line([(x + gx, y), (x + gx, y + p.size[1])], fill=(255, 0, 0), width=1)
            d.text((12, y + th + 4), o + '  ' + informe[o]['tipo'] + ' ' + str(informe[o].get('grados', '')), fill=(240, 240, 240))
        hoja.save(os.path.join(DESTINO, 'hoja.jpg'), quality=82)


if __name__ == '__main__':
    main()
