# «Del acantilado al hórreo» · datos del 3D de Amaicha (Camango, Ribadesella).
#
# Fuentes (todas abiertas):
#   - MDT05 y MDT25 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)            CC BY 4.0, © IGN
#   - Ortofoto PNOA por WMS (www.ign.es/wms-inspire/pnoa-ma)                         CC BY 4.0, © IGN
#   - Edificios y parcelas del Catastro INSPIRE (ovc.catastro.meh.es, WFS BU/CP)     © Dirección General del Catastro
#   - Lugares de OpenStreetMap (scripts/lugar-osm.py)                               ODbL, © colaboradores de OSM
# Todo se cachea en ref/raw/lugar-cache/ (no viaja a la web) y la salida va a img/lugar/.
#
# Coordenadas locales en metros desde el punto de la casa (nodo OSM 459894261): x al este, z al sur, y arriba.
# Alturas en PNG RGB: (R*256 + G) / 10 - 100 = metros sobre el mar (mar con fondo inventado, siempre < 0).
#
# Uso: python -I -X utf8 scripts/lugar-datos.py      (antes, una vez: scripts/lugar-osm.py)
import io, json, math, pathlib, re, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
OUT = R / 'img' / 'lugar'; OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (compatible; sitio-web-dev)'}

CASA = (43.4434463, -5.0125288)                       # nodo OSM 459894261 «Hotel rural Amaicha»
KX = 111320 * math.cos(math.radians(CASA[0])); KZ = 110950
def loc(lat, lon): return ((lon - CASA[1]) * KX, (CASA[0] - lat) * KZ)
def geo(x, z): return (CASA[0] - z / KZ, CASA[1] + x / KX)

# caja cercana (MDT05 + PNOA a ~2,9 m/px): de Ribadesella a Guadamía y del mar a la sierra
CS, CN, CO, CE = 43.418, 43.480, -5.078, -4.932
# caja lejana (MDT25), alineada con la cercana: celdas de 0,00365° x 0,0025833°
DLON, DLAT = (CE - CO) / 40, (CN - CS) / 24
LO, LE = CO - 95 * DLON, CE + 90 * DLON
LS, LN = CS - 125 * DLAT, CN + 35 * DLAT
# finca (ortofoto de detalle, 640 m)
FS, FN, FO, FE = 43.440426921901754, 43.44619528602974, -5.0164261441624, -5.008507730626095


def bajar(url, destino, intentos=5):
    if destino.exists() and destino.stat().st_size > 2000:
        return destino.read_bytes()
    for k in range(intentos):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
            if len(b) < 2000 and b'<' in b[:200]:
                raise IOError(b[:120])
            destino.write_bytes(b); print('bajado', destino.name, len(b) // 1024, 'KB'); return b
        except Exception as e:
            print('falla', destino.name, str(e)[:90]); time.sleep(3 + 4 * k)
    raise SystemExit('No se pudo bajar ' + destino.name)


def wms(S, O, N, E, w, h, nombre):
    url = ('https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage'
           f'&STYLES=&CRS=EPSG:4326&BBOX={S},{O},{N},{E}&WIDTH={w}&HEIGHT={h}&FORMAT=image/jpeg')
    return Image.open(io.BytesIO(bajar(url, CACHE / nombre))).convert('RGB')


def mosaico(S, O, N, E, W, H, nx, ny, base):
    f = CACHE / (base + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    im = Image.new('RGB', (W, H))
    for i in range(nx):
        for j in range(ny):
            o, e = O + (E - O) * i / nx, O + (E - O) * (i + 1) / nx
            n, s = N - (N - S) * j / ny, N - (N - S) * (j + 1) / ny
            im.paste(wms(s, o, n, e, W // nx, H // ny, f'{base}-{i}{j}.jpg'), (i * W // nx, j * H // ny))
    im.save(f); return im


def wmts_caja(S, O, N, E, zoom, W, nombre):
    """Ortofoto PNOA por teselas WMTS (GoogleMapsCompatible) recortada y llevada a la caja lat/lon (W x W)."""
    f = CACHE / (nombre + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    n = 2 ** zoom
    tx = lambda lon: (np.asarray(lon, np.float64) + 180) / 360 * n
    ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(np.asarray(lat, np.float64)))) / np.pi) / 2 * n
    x0, x1, y0, y1 = tx(O), tx(E), ty(N), ty(S)
    cols = range(int(x0), int(x1) + 1); filas = range(int(y0), int(y1) + 1)
    x0, y0 = float(x0), float(y0)
    lienzo = Image.new('RGB', (len(cols) * 256, len(filas) * 256))
    tdir = CACHE / f'wmts{zoom}'; tdir.mkdir(exist_ok=True)
    for i, c in enumerate(cols):
        for j, r in enumerate(filas):
            url = ('https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible'
                   f'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={c}&TileRow={r}')
            lienzo.paste(Image.open(io.BytesIO(bajar(url, tdir / f'{c}-{r}.jpg'))).convert('RGB'), (i * 256, j * 256))
    a = np.asarray(lienzo, np.float32)
    lat = N - (np.arange(W) + 0.5) / W * (N - S); lon = O + (np.arange(W) + 0.5) / W * (E - O)
    py = (ty(lat) - int(y0)) * 256 - 0.5; px = (tx(lon) - int(x0)) * 256 - 0.5
    PY, PX = np.meshgrid(py, px, indexing='ij')
    out = np.stack([ndimage.map_coordinates(a[..., k], [PY, PX], order=1) for k in range(3)], -1)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); im.save(f); return im


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    bajar(url, CACHE / nombre)
    return tifffile.imread(CACHE / nombre).astype(np.float32)


# ------------------------------------------------------------------ descargas
mdt5 = wcs('Elevacion4258_5', CS, CN, CO, CE, 'mdt5-cerca.tif')            # ~3,6 x 5 m, enteros
mdt25 = wcs('Elevacion4258_25', 43.10, 43.58, -5.42, -4.60, 'mdt25-lejos.tif')
orto_c = mosaico(CS, CO, CN, CE, 4096, 2392, 2, 2, 'pnoa-cerca')
orto_f = wmts_caja(FS, FO, FN, FE, 19, 2048, 'pnoa-finca-z19')
orto_l = wms(43.10, -5.42, 43.58, -4.60, 2048, 1622, 'pnoa-lejos.jpg')
print('MDT05', mdt5.shape, 'MDT25', mdt25.shape)


# ------------------------------------------------------------------ muestreo geográfico
def muestrea(a, caja, lat, lon, orden=1):
    """Muestrea el ráster `a` (fila 0 = norte) de caja (S, N, O, E) en lat/lon (arrays)."""
    S, N, O, E = caja
    fil = (N - lat) / (N - S) * a.shape[0] - 0.5
    col = (lon - O) / (E - O) * a.shape[1] - 0.5
    return ndimage.map_coordinates(a, [fil, col], order=orden, mode='nearest')


CAJA5 = (CS, CN, CO, CE); CAJA25 = (43.10, 43.58, -5.42, -4.60)

# el MDT viene en metros enteros: se suaviza para quitar escalones (en llano se verían de cerca)
mdt5_s = ndimage.gaussian_filter(mdt5, 1.3)
# mar: lo que está a 0 y toca el borde norte (incluye la ría del Sella)
mar5 = mdt5 <= 0.4
et, n = ndimage.label(mar5)
toca = set(np.unique(et[0, :])) - {0}
mar5 = np.isin(et, list(toca))
paso5 = ((CE - CO) * KX / mdt5.shape[1], (CN - CS) * KZ / mdt5.shape[0])
dist5 = ndimage.distance_transform_edt(mar5, sampling=(paso5[1], paso5[0]))     # metros hasta la costa (en el mar)
fondo5 = -2.0 - np.minimum(dist5 * 0.05, 45.0)
alt5 = np.where(mar5, fondo5, np.maximum(mdt5_s, 0.7))
mar25 = mdt25 <= 0.4
et, n = ndimage.label(mar25); toca = set(np.unique(et[0, :])) - {0}; mar25 = np.isin(et, list(toca))
dist25 = ndimage.distance_transform_edt(mar25, sampling=(25.0, 25.0))
alt25 = np.where(mar25, -30.0 - np.minimum(dist25 * 0.02, 60), np.maximum(mdt25, 0.7))


def alt_en(lat, lon, fina=True):
    """Altura (m) combinando el MDT05 (dentro de la caja cercana) y el MDT25 (fuera)."""
    lat = np.asarray(lat, np.float64); lon = np.asarray(lon, np.float64)
    a = muestrea(alt25, CAJA25, lat, lon)
    if fina:
        dentro = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
        if dentro.any():
            a = a.copy(); a[dentro] = muestrea(alt5, CAJA5, lat[dentro], lon[dentro])
    return a


def png_alturas(h, nombre):
    v = np.clip(np.round((h + 100.0) * 10), 0, 65535).astype(np.uint16)
    rgb = np.stack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), np.zeros_like(v, np.uint8)], -1)
    Image.fromarray(rgb, 'RGB').save(OUT / nombre, optimize=True)


def rejilla_local(x0, z0, x1, z1, paso):
    nx = int(round((x1 - x0) / paso)) + 1; nz = int(round((z1 - z0) / paso)) + 1
    xs = np.linspace(x0, x1, nx); zs = np.linspace(z0, z1, nz)
    X, Z = np.meshgrid(xs, zs)
    lat, lon = geo(X, Z)
    return X, Z, lat, lon, nx, nz


rasters = {}
cx0, cz0 = loc(CN, CO); cx1, cz1 = loc(CS, CE)                       # caja cercana en metros
for nombre, (x0, z0, x1, z1, paso) in {
    'cerca': (cx0, cz0, cx1, cz1, 20.0),
    'medio': (-1600.0, -2700.0, 1600.0, 700.0, 10.0),
    'finca': (-315.0, -305.0, 325.0, 335.0, 4.0),
}.items():
    X, Z, lat, lon, nx, nz = rejilla_local(x0, z0, x1, z1, paso)
    h = alt_en(lat, lon)
    png_alturas(h, f'alturas-{nombre}.png')
    rasters[nombre] = {'x0': round(x0, 2), 'z0': round(z0, 2), 'x1': round(x1, 2), 'z1': round(z1, 2), 'w': nx, 'h': nz,
                       'archivo': f'alturas-{nombre}.png'}
    print('alturas', nombre, nx, 'x', nz, round(float(h.min()), 1), round(float(h.max()), 1))

# anillo lejano: vértices sobre la rejilla alineada (los bordes coinciden con la caja cercana)
nlx = int(round((LE - LO) / DLON)) + 1; nlz = int(round((LN - LS) / DLAT)) + 1
lons = LO + np.arange(nlx) * DLON; lats = LN - np.arange(nlz) * DLAT
LON_, LAT_ = np.meshgrid(lons, lats)
# para la silueta de los Picos: mezcla de media y máximo de la celda (si no, las cumbres se aplanan)
pasoL = (DLON * KX, DLAT * KZ)
k = max(1, int(round(pasoL[0] / 19.0)))
med = ndimage.uniform_filter(alt25, size=k); mx = ndimage.maximum_filter(alt25, size=k)
mezcla = np.where(alt25 > 0, 0.55 * med + 0.45 * mx, med)
hl = muestrea(mezcla, CAJA25, LAT_, LON_)
dentro = (LAT_ >= CS - 1e-9) & (LAT_ <= CN + 1e-9) & (LON_ >= CO - 1e-9) & (LON_ <= CE + 1e-9)
hl[dentro] = muestrea(alt5, CAJA5, LAT_[dentro], LON_[dentro])     # en el borde, la misma altura que la cercana
png_alturas(hl, 'alturas-lejos.png')
lx0, lz0 = loc(LN, LO); lx1, lz1 = loc(LS, LE)
rasters['lejos'] = {'x0': round(lx0, 2), 'z0': round(lz0, 2), 'x1': round(lx1, 2), 'z1': round(lz1, 2), 'w': nlx, 'h': nlz,
                    'archivo': 'alturas-lejos.png',
                    'hueco': [int(round((CO - LO) / DLON)), int(round((LN - CN) / DLAT)), int(round((CE - LO) / DLON)), int(round((LN - CS) / DLAT))]}
print('lejos', nlx, 'x', nlz, 'hueco', rasters['lejos']['hueco'])

# ------------------------------------------------------------------ costa (para el agua)
CW, CH = 1024, 600
fil = np.linspace(0, mdt5.shape[0] - 1, CH); col = np.linspace(0, mdt5.shape[1] - 1, CW)
F, C = np.meshgrid(fil, col, indexing='ij')
d = ndimage.map_coordinates(dist5, [F, C], order=1)
tierra = ndimage.map_coordinates((~mar5).astype(np.float32), [F, C], order=1)
# R: distancia a la costa (0..765 m, 3 m por unidad); G: 255 en tierra (para la espuma de la orilla)
costa = np.stack([np.clip(d / 3.0, 0, 255), np.clip(tierra * 255, 0, 255), np.zeros_like(d)], -1).astype(np.uint8)
Image.fromarray(costa, 'RGB').save(OUT / 'costa.png', optimize=True)

# ------------------------------------------------------------------ ortofotos
def gradua(img, ref_img, mascara_img=None, mascara_ref=None):
    """Iguala medias y contrastes por canal (lo lejano, al color de lo cercano)."""
    a = np.asarray(img, np.float32); b = np.asarray(ref_img, np.float32)
    ma = a.reshape(-1, 3) if mascara_img is None else a[mascara_img]
    mb = b.reshape(-1, 3) if mascara_ref is None else b[mascara_ref]
    out = (a - ma.mean(0)) / (ma.std(0) + 1e-3) * mb.std(0) + mb.mean(0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# máscara de mar a la resolución de cada ortofoto
def mar_a(w, h, caja):
    S, N, O, E = caja
    lat = N - (np.arange(h) + 0.5) / h * (N - S); lon = O + (np.arange(w) + 0.5) / w * (E - O)
    LON2, LAT2 = np.meshgrid(lon, lat)
    return alt_en(LAT2, LON2) < 0


oc = np.asarray(orto_c, np.float32)
marC = mar_a(oc.shape[1], oc.shape[0], CAJA5)
# bajo el agua no se ve, pero en la orilla sí: azul oscuro uniforme (y nada de huecos blancos sin foto)
oc[marC] = [28, 58, 72]
orto_c2 = Image.fromarray(oc.astype(np.uint8))
orto_c2.save(OUT / 'orto-cerca-4096.webp', quality=70, method=6)
orto_c2.resize((2048, 1196), Image.LANCZOS).save(OUT / 'orto-cerca-2048.webp', quality=72, method=6)

# lejos: graduado al color de la cercana, con el mar oscuro
ol = orto_l.copy()
S, N, O, E = CAJA25
i0 = int((CO - O) / (E - O) * ol.width); i1 = int((CE - O) / (E - O) * ol.width)
j0 = int((N - CN) / (N - S) * ol.height); j1 = int((N - CS) / (N - S) * ol.height)
marL = mar_a(ol.width, ol.height, CAJA25)
ref = orto_c2.resize((i1 - i0, j1 - j0), Image.LANCZOS)
marRef = mar_a(i1 - i0, j1 - j0, CAJA5)
recorte = ol.crop((i0, j0, i1, j1))
olg = np.asarray(gradua(ol, ref, ~marL & (np.asarray(ol).sum(-1) < 700), ~marRef), np.float32)
gris = olg.mean(-1, keepdims=True); olg = gris + (olg - gris) * 0.68          # la foto lejana viene muy saturada
olg[marL] = [28, 58, 72]
Image.fromarray(olg.astype(np.uint8)).save(OUT / 'orto-lejos-2048.webp', quality=70, method=6)


# ------------------------------------------------------------------ Catastro
def wfs(servicio, tipo, S, O, N, E, nombre):
    url = (f'https://ovc.catastro.meh.es/INSPIRE/{servicio}.aspx?service=WFS&version=2.0.0&request=GetFeature'
           f'&typenames={tipo}&srsname=EPSG::4258&bbox={S},{O},{N},{E}')
    return bajar(url, CACHE / nombre).decode('latin-1')


def poligonos(xml, patron_id):
    out = []
    for m in re.finditer(r'<(?:gml:featureMember|wfs:member|member)>(.*?)</(?:gml:featureMember|wfs:member|member)>', xml, re.S):
        f = m.group(1)
        lid = re.search(patron_id, f)
        pis = re.search(r'numberOfFloorsAboveGround>(\d+)', f)
        uso = re.search(r'currentUse>([^<]+)', f)
        anillos = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]+)</gml:posList>', f):
            v = list(map(float, pl.split()))
            anillos.append([(v[i], v[i + 1]) for i in range(0, len(v), 2)])     # lat lon (EPSG:4258)
        out.append({'id': lid.group(1) if lid else '?', 'pisos': int(pis.group(1)) if pis else None,
                    'uso': uso.group(1) if uso else None, 'anillos': anillos})
    return out


bp = poligonos(wfs('wfsBU', 'BU:BuildingPart', FS, FO, FN, FE, 'bp-finca.xml'), r'localId>([^<]+)')
bu = poligonos(wfs('wfsBU', 'BU:Building', FS, FO, FN, FE, 'bu-finca.xml'), r'reference>([^<]+)')
usos = {b['id']: b['uso'] for b in bu}
print('Catastro: partes', len(bp), 'edificios', len(bu))


def rect_orientado(pts):
    """Rectángulo mínimo (por giro de 1°) que contiene el polígono: centro, lados y ángulo."""
    P = np.array(pts); mejor = None
    for g in np.radians(np.arange(0, 90, 1.0)):
        c, s = math.cos(g), math.sin(g)
        u = P[:, 0] * c + P[:, 1] * s; v = -P[:, 0] * s + P[:, 1] * c
        a = (u.max() - u.min()) * (v.max() - v.min())
        if mejor is None or a < mejor[0]:
            mejor = (a, g, (u.max() + u.min()) / 2, (v.max() + v.min()) / 2, u.max() - u.min(), v.max() - v.min())
    a, g, uc, vc, lu, lv = mejor
    c, s = math.cos(g), math.sin(g)
    cx, cz = uc * c - vc * s, uc * s + vc * c
    if lv > lu:                                  # el lado largo, siempre en «ancho»
        lu, lv, g = lv, lu, g + math.pi / 2
    return {'cx': round(cx, 2), 'cz': round(cz, 2), 'largo': round(lu, 2), 'fondo': round(lv, 2), 'ang': round(g, 4)}


def area(pts):
    return 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))


# Qué es cada edificio de la finca (por las fotos de su web y la ortofoto; ver LUGAR.md):
#   33056A06500034 = la casona de piedra (hotel; uso «comercial» en Catastro), dos cuerpos a dos aguas
#   33056A06500035 part3/part4 = la casa roja (dos plantas, escalera exterior, tejado a cuatro aguas)
#   33056A06500035 part2 = la casa azul (dos plantas, cuatro aguas, base de piedra)
TIPOS = {'33056A06500034': 'casona', '33056A06500035_part3': 'roja', '33056A06500035_part4': 'roja',
         '33056A06500035_part2': 'azul', '33056A06500035_part1': 'azul'}
edificios = []
for b in bp:
    if not b['anillos']:
        continue
    pts = [loc(la, lo) for la, lo in b['anillos'][0]]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    if area(pts) < 4:
        continue
    if math.hypot(*np.mean(pts, axis=0)) > 260:
        continue
    ref = b['id'].split('_')[0]
    tipo = TIPOS.get(b['id'], TIPOS.get(ref, 'vecina'))
    rc = rect_orientado(pts)
    lat = np.array([geo(x, z)[0] for x, z in pts]); lon = np.array([geo(x, z)[1] for x, z in pts])
    hs = alt_en(lat, lon)
    pisos = b['pisos'] or 1
    cub = '2' if (tipo == 'casona' or (tipo == 'vecina' and rc['largo'] > 1.6 * rc['fondo'])) else '4'
    edificios.append({'id': b['id'], 'tipo': tipo, 'uso': usos.get(ref), 'pisos': pisos, 'cubierta': cub,
                      'suelo': round(float(hs.min()), 2), 'suelo_max': round(float(hs.max()), 2),
                      'anillo': [[round(x, 2), round(z, 2)] for x, z in pts], 'rect': rc, 'area': round(area(pts), 1)})
edificios.sort(key=lambda e: (e['tipo'] == 'vecina', e['id']))
print('edificios', len(edificios), [(e['id'], e['tipo'], e['pisos']) for e in edificios if e['tipo'] != 'vecina'])

# El hórreo no está en Catastro: se sitúa sobre su tejado en la ortofoto PNOA (medido a mano, 2026-11-25,
# tejado cuadrado de ~5,6 m al sureste de la casona, girado ~19°; en la ortofoto WMTS casa con Catastro).
HORREO = {'x': 16.5, 'z': 19.8, 'ang': round(math.radians(-19.0), 4), 'caja': 4.3, 'tejado': 5.6}
la, lo = geo(HORREO['x'], HORREO['z'])
HORREO['suelo'] = round(float(alt_en(np.array([la]), np.array([lo]))[0]), 2)

# ------------------------------------------------------------------ ortofoto de la finca, sin tejados
of = np.asarray(orto_f, np.uint8).copy()
FW = of.shape[1]
fx0, fz0 = loc(FN, FO); fx1, fz1 = loc(FS, FE)
def a_px(x, z): return ((x - fx0) / (fx1 - fx0) * FW, (z - fz0) / (fz1 - fz0) * FW)
masc = Image.new('L', (FW, FW), 0); dm = ImageDraw.Draw(masc)
for e in edificios:
    rc = e['rect']; c, s = math.cos(rc['ang']), math.sin(rc['ang'])
    L, F = rc['largo'] / 2 + 1.6, rc['fondo'] / 2 + 1.6               # el alero y el desplome de la foto
    esq = [(rc['cx'] + u * c - v * s, rc['cz'] + u * s + v * c) for u, v in ((-L, -F), (L, -F), (L, F), (-L, F))]
    dm.polygon([a_px(x, z) for x, z in esq], fill=255)
    dm.polygon([a_px(x, z) for x, z in e['anillo']], fill=255)
c, s = math.cos(HORREO['ang']), math.sin(HORREO['ang']); L = HORREO['tejado'] / 2 + 0.8
dm.polygon([a_px(HORREO['x'] + u * c - v * s, HORREO['z'] + u * s + v * c) for u, v in ((-L, -L), (L, -L), (L, L), (-L, L))], fill=255)
masc = masc.filter(ImageFilter.MaxFilter(5))
# bajo cada edificio, el color medio de alrededor (convolución normalizada) con algo de grano: nada de manchas de tejado
m_ = np.asarray(masc, np.float32)[..., None] / 255.0
libre = 1.0 - m_
num = np.stack([ndimage.gaussian_filter(of[..., k] * libre[..., 0], 22) for k in range(3)], -1)
den = ndimage.gaussian_filter(libre[..., 0], 22)[..., None] + 1e-4
relleno = num / den * (0.93 + 0.07 * np.random.default_rng(3).random(of.shape[:2] + (1,)))
suave = ndimage.gaussian_filter(m_[..., 0], 2.5)[..., None]
of = np.clip(of * (1 - suave) + relleno * suave, 0, 255).astype(np.uint8)
orto_f2 = Image.fromarray(of)
orto_f2.save(OUT / 'orto-finca-2048.webp', quality=74, method=6)
orto_f2.resize((1024, 1024), Image.LANCZOS).save(OUT / 'orto-finca-1024.webp', quality=76, method=6)


# ------------------------------------------------------------------ árboles alrededor de la finca
def arboles():
    """Copas detectadas en la ortofoto de detalle (verde oscuro y rugoso), en ~260 m alrededor de la casa."""
    a = np.asarray(orto_f, np.float32)
    lum = a.mean(-1); verde = a[..., 1] - (a[..., 0] + a[..., 2]) / 2
    rug = ndimage.generic_filter(ndimage.zoom(lum, 0.25, order=1), np.std, size=5)
    rug = ndimage.zoom(rug, 4, order=1)[:lum.shape[0], :lum.shape[1]]
    lum_s = ndimage.gaussian_filter(lum, 3)
    copa = (lum_s < 92) & (rug > 9) & (ndimage.gaussian_filter(verde, 3) > -6)
    copa = ndimage.binary_opening(copa, iterations=3)
    copa &= ~(np.asarray(masc) > 0)
    paso_m = (fx1 - fx0) / FW
    rng = np.random.default_rng(7)
    lista = []
    ocup = []
    cand = np.argwhere(copa[::5, ::5]) * 5
    rng.shuffle(cand)
    for fy, fxp in cand:
        x = fx0 + fxp * paso_m; z = fz0 + fy * paso_m
        if math.hypot(x - 8, z - 15) > 230:
            continue
        r = 2.6 + rng.random() * 2.6
        if any((x - ox) ** 2 + (z - oz) ** 2 < (0.95 * (r + orr)) ** 2 for ox, oz, orr in ocup):
            continue
        # nada encima de los edificios ni pegado al hórreo
        if math.hypot(x - HORREO['x'], z - HORREO['z']) < 6:
            continue
        ocup.append((x, z, r))
        col = a[max(0, fy - 4):fy + 4, max(0, fxp - 4):fxp + 4].reshape(-1, 3).mean(0)
        la, lo = geo(x, z)
        h0 = float(alt_en(np.array([la]), np.array([lo]))[0])
        alto = r * (2.1 + rng.random() * 1.4)
        lista.append([round(x, 1), round(h0, 1), round(z, 1), round(r, 2), round(alto, 1), '#%02x%02x%02x' % tuple(int(v) for v in col)])
    return lista


arb = arboles()
print('árboles', len(arb))

# ------------------------------------------------------------------ lugares (OSM, comprobados)
osm = json.loads((CACHE / 'osm-lugares.json').read_text(encoding='utf-8'))['elements']


def busca(cond, cerca_de=None, max_m=None):
    mejor = None
    for e in osm:
        t = e.get('tags', {})
        lat = e.get('lat', e.get('center', {}).get('lat')); lon = e.get('lon', e.get('center', {}).get('lon'))
        if lat is None or not cond(t):
            continue
        x, z = loc(lat, lon)
        d = 0 if cerca_de is None else math.hypot(x - cerca_de[0], z - cerca_de[1])
        if max_m is not None and d > max_m:
            continue
        if mejor is None or d < mejor[0]:
            mejor = (d, e, x, z)
    if mejor is None:
        raise SystemExit('No encuentro en OSM un lugar que cumpla la condición')
    return mejor


def alt_xz(x, z):
    la, lo = geo(x, z); return float(alt_en(np.array([la]), np.array([lo]))[0])


lugares = []
def pon(clave, nombre, sub, e, x, z, dy, fase, nota):
    lugares.append({'clave': clave, 'nombre': nombre, 'sub': sub, 'x': round(x, 1), 'z': round(z, 1),
                    'y': round(max(alt_xz(x, z), 0) + dy, 1), 'dy': dy, 'fase': fase,
                    'osm': f"{e['type']}/{e['id']}" if e else None, 'nota': nota})


# Ribadesella: el nodo place=town (no un hotel ni una calle que se llame igual)
_, e, x, z = busca(lambda t: t.get('place') == 'town' and t.get('name', '').startswith('Ribadesella'))
pon('ribadesella', 'Ribadesella', None, e, x, z, 60, [0.0, 0.62], 'place=town')
# Guadamía y los bufones: el bufón (natural=blowhole) y la playa (natural=beach) deben estar a < 600 m entre sí
_, eb, xb, zb = busca(lambda t: t.get('natural') == 'blowhole' and 'Bufones' in t.get('name', ''))
_, eg, xg, zg = busca(lambda t: t.get('natural') == 'beach' and 'Guadam' in t.get('name', ''), (xb, zb), 600)
pon('guadamia', 'Guadamía y bufones de Pría', None, eb, (xb + xg) / 2, (zb + zg) / 2, 45, [0.0, 0.62],
    f'natural=blowhole {eb["id"]} + natural=beach {eg["id"]}')
# los acantilados justo al norte: el cabo más cercano a la vertical de la casa y el paraje «El Infierno»
_, ec, xc, zc = busca(lambda t: t.get('natural') == 'cape', (0, -1900), 900)
_, ei, xi, zi = busca(lambda t: t.get('place') == 'locality' and t.get('name') == 'El Infierno', (xc, zc), 1500)
pon('acantilados', 'Los acantilados', 'El Infierno', ei, (xc + xi) / 2, (zc + zi) / 2 - 120, 40, [0.0, 0.58],
    f'natural=cape {ec["id"]} ({ec["tags"].get("name")}) + place=locality {ei["id"]}')
# Picos de Europa: la Peña Santa (macizo occidental, el que se ve de frente) — natural=peak con ele > 2500
_, ep, xp, zp = busca(lambda t: t.get('natural') == 'peak' and t.get('name') == 'Peña Santa' and float(t.get('ele', 0)) > 2500)
pon('picos', 'Picos de Europa', 'Peña Santa', ep, xp, zp, 220, [0.0, 0.5], 'natural=peak ele=' + ep['tags'].get('ele', ''))
lugares.append({'clave': 'mar', 'nombre': 'Mar Cantábrico', 'sub': None, 'x': -1400.0, 'y': 30.0, 'z': -3900.0, 'dy': 30,
                'fase': [0.0, 0.42], 'osm': None, 'nota': 'rótulo en el mar'})
# Camango: el nodo place=hamlet «Camangu» (OSM usa el nombre asturiano)
_, ecm, xcm, zcm = busca(lambda t: t.get('place') in ('hamlet', 'village') and t.get('name') == 'Camangu', (0, 0), 1500)
pon('camango', 'Camango', None, ecm, xcm, zcm, 35, [0.38, 0.74], 'place=hamlet «Camangu»')
cas = next(e for e in edificios if e['tipo'] == 'casona')
lugares.append({'clave': 'amaicha', 'nombre': 'Amaicha', 'sub': None, 'x': cas['rect']['cx'], 'z': cas['rect']['cz'],
                'y': round(cas['suelo'] + 15, 1), 'dy': 15, 'fase': [0.40, 0.84], 'osm': 'node/459894261', 'nota': 'la casona'})
for clave, nombre, tipo in (('casona', 'La casona', 'casona'), ('roja', 'La casa roja', 'roja')):
    es = [e for e in edificios if e['tipo'] == tipo]
    big = max(es, key=lambda e: e['area'])
    lugares.append({'clave': clave, 'nombre': nombre, 'sub': None, 'x': big['rect']['cx'], 'z': big['rect']['cz'],
                    'y': round(big['suelo'] + big['pisos'] * 2.9 + 4.2, 1), 'dy': round(big['pisos'] * 2.9 + 4.2, 1), 'fase': [0.84, 1.01], 'osm': None, 'nota': 'Catastro'})
lugares.append({'clave': 'horreo', 'nombre': 'El hórreo', 'sub': None, 'x': HORREO['x'], 'z': HORREO['z'],
                'y': round(HORREO['suelo'] + 7.4, 1), 'dy': 7.4, 'fase': [0.84, 1.01], 'osm': None, 'nota': 'ortofoto'})
for l in lugares:
    print('lugar', l['clave'], l['x'], l['z'], l['y'], l['nota'])

# ------------------------------------------------------------------ recorrido de la cámara
# costa justo al norte (borde del acantilado sobre x≈-300) para la entrada
def costa_norte(x):
    for z in np.arange(-200, -4000, -5.0):
        if alt_xz(x, z) < 0:
            return z + 5
    return -1900.0


zc_ = costa_norte(-250); hc_ = alt_xz(-250, zc_ + 20)
H = HORREO; hy = H['suelo']
print('costa al norte', round(zc_), 'm, borde a', round(hc_), 'm')
rec = [  # p: progreso del scroll (0..1); pos y mira en metros locales (y = altura sobre el mar)
    {'p': 0.00, 'pos': [-500, 430, zc_ - 6500], 'mira': [-950, -310, zc_ + 7700]},
    {'p': 0.22, 'pos': [-640, 230, zc_ - 2400], 'mira': [-150, 40, zc_ + 1400]},
    {'p': 0.42, 'pos': [-330, 140, zc_ - 120], 'mira': [-20, 35, -150]},
    {'p': 0.60, 'pos': [-140, 92, -560], 'mira': [8, hy + 2, 10]},
    {'p': 0.74, 'pos': [-6, hy + 46, -95], 'mira': [H['x'], hy + 2, H['z']]},
    {'p': 0.84, 'pos': [H['x'] + 34, hy + 19, H['z'] - 2], 'mira': [H['x'], hy + 3.2, H['z']]},
]
# órbita final alrededor del hórreo, con la casona detrás (la cámara al sur, mirando al norte)
for i, az in enumerate((100, 128, 156, 184, 208)):
    rr = 26 - i * 1.6; yy = 12 - i * 1.1
    a = math.radians(az)
    rec.append({'p': round(0.88 + i * 0.03, 3), 'pos': [round(H['x'] + math.sin(a) * rr, 2), round(hy + yy, 2), round(H['z'] - math.cos(a) * rr, 2)],
                'mira': [H['x'] - 2.0 * math.sin(a), hy + 3.0, H['z'] + 2.0 * math.cos(a)]})
for r_ in rec:
    r_['pos'] = [round(float(v), 2) for v in r_['pos']]; r_['mira'] = [round(float(v), 2) for v in r_['mira']]

# ------------------------------------------------------------------ plan B: la vista desde el mar, dibujada
def vista_desde_mar(W, Hh, pos, mira, fov=42.0):
    """Render por columnas (voxel space): relieve real + ortofoto, con bruma, mar y cielo. Sin WebGL."""
    px_, py_, pz_ = pos
    yaw = math.atan2(mira[0] - px_, mira[2] - pz_)
    pitch = math.atan2(mira[1] - py_, math.hypot(mira[0] - px_, mira[2] - pz_))
    f = (Hh / 2) / math.tan(math.radians(fov / 2))
    K = 2600
    d = 40.0 * (90000 / 40.0) ** (np.arange(K) / (K - 1))
    cols = np.arange(W) - W / 2 + 0.5
    ang = yaw + np.arctan(cols / f)
    cosd = np.cos(ang - yaw)
    X = px_ + np.outer(d, np.sin(ang)); Z = pz_ + np.outer(d, np.cos(ang))
    lat, lon = geo(X, Z)
    h = alt_en(lat, lon)
    dist_casa = np.hypot(X, Z)
    ex = 1 + 0.4 * np.clip((dist_casa - 3500) / 8500, 0, 1) ** 2 * (3 - 2 * np.clip((dist_casa - 3500) / 8500, 0, 1))
    agua = h < 0
    hv = np.where(agua, 0.0, h * ex)
    prof = d[:, None] * cosd[None, :]
    y = Hh / 2 - f * (hv - py_) / prof - f * math.tan(pitch)
    # color: ortofoto cercana dentro de su caja, lejana fuera; sombreado por la pendiente (luz de la tarde, del oeste)
    oc_ = np.asarray(orto_c2, np.float32); ol_ = olg
    def col_de(img, caja):
        S, N, O, E = caja
        fy = (N - lat) / (N - S) * img.shape[0] - 0.5; fx = (lon - O) / (E - O) * img.shape[1] - 0.5
        return np.stack([ndimage.map_coordinates(img[..., c], [fy, fx], order=1, mode='nearest') for c in range(3)], -1)
    color = col_de(ol_, CAJA25)
    dentro = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
    cc = col_de(oc_, CAJA5); color[dentro] = cc[dentro]
    e = 12.0
    hx = alt_en(*geo(X + e, Z)) ; hz = alt_en(*geo(X, Z + e))
    nx_, nz_ = -(hx - h) / e * ex, -(hz - h) / e * ex
    luz = np.array([-0.62, 0.55, 0.3]); luz /= np.linalg.norm(luz)           # oeste-suroeste, 33°
    sh = (nx_ * luz[0] + luz[1] + nz_ * luz[2]) / np.sqrt(nx_ ** 2 + nz_ ** 2 + 1)
    color *= np.clip(0.55 + 0.75 * sh, 0.35, 1.25)[..., None]
    # mar: degradado por distancia a la costa y reflejo del cielo hacia el horizonte
    dc = np.where(dentro, ndimage.map_coordinates(dist5, [(CN - lat) / (CN - CS) * dist5.shape[0], (lon - CO) / (CE - CO) * dist5.shape[1]], order=1, mode='nearest'), 2000)
    somero = np.clip(1 - dc / 260, 0, 1)
    mar_c = np.array([22, 62, 84], np.float32) * (1 - somero[..., None]) + np.array([48, 118, 128], np.float32) * somero[..., None]
    rasante = np.clip(1 - (py_ / prof) * 6, 0, 1)[..., None]
    mar_c = mar_c * (1 - 0.55 * rasante) + np.array([196, 206, 214], np.float32) * 0.55 * rasante
    espuma = (dc < 14) & agua
    mar_c[espuma] = [236, 240, 238]
    color = np.where(agua[..., None], mar_c, color)
    bruma = np.array([206, 214, 222], np.float32)
    kf = 1 - np.exp(-(d / 42000.0) ** 2 * 1.6)
    color = color * (1 - kf[:, None, None]) + bruma * kf[:, None, None]
    # visibilidad por columnas: el primer paso que tapa cada fila
    img = np.zeros((Hh, W, 3), np.float32)
    filas = np.arange(Hh)
    yy = np.minimum.accumulate(np.minimum(y, Hh), axis=0)
    cielo_t = np.array([118, 158, 204], np.float32); cielo_h = np.array([226, 230, 232], np.float32)
    for c_ in range(W):
        col_y = yy[:, c_]
        # para cada fila r: primer k con col_y[k] <= r
        idx = np.searchsorted(-col_y, -filas, side='left')
        ok = idx < K
        img[ok, c_] = color[idx[ok], c_]
        t = np.clip(filas[~ok] / (Hh * 0.55), 0, 1)[:, None]
        img[~ok, c_] = cielo_t * (1 - t) + cielo_h * t
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), (f, yaw, pitch)


def proyecta(pt, pos, f, yaw, pitch, W, Hh):
    dx, dz = pt[0] - pos[0], pt[2] - pos[2]
    fr = dx * math.sin(yaw) + dz * math.cos(yaw); la = dx * math.cos(yaw) - dz * math.sin(yaw)
    if fr <= 0:
        return None
    return (W / 2 + f * la / fr, Hh / 2 - f * (pt[1] - pos[1]) / fr - f * math.tan(pitch))


WB, HB = 1600, 1000
p0 = rec[0]
vista, (fB, yawB, pitchB) = vista_desde_mar(WB, HB, p0['pos'], p0['mira'])
vista.save(OUT / 'vista-mar-1600.webp', quality=74, method=6)
vista.resize((960, 600), Image.LANCZOS).save(OUT / 'vista-mar-960.webp', quality=76, method=6)
marcas_b = []
for l in lugares:
    if l['fase'][0] > 0.01:
        continue
    pt = (l['x'], l['y'] * (1 + 0.4 * min(1, max(0, (math.hypot(l['x'], l['z']) - 3500) / 8500))), l['z'])
    pr = proyecta(pt, p0['pos'], fB, yawB, pitchB, WB, HB)
    if pr and 0 < pr[0] < WB and 0 < pr[1] < HB:
        marcas_b.append({'clave': l['clave'], 'x': round(pr[0] / WB * 100, 2), 'y': round(pr[1] / HB * 100, 2)})
casaB = proyecta((0, alt_xz(0, 0) + 10, 0), p0['pos'], fB, yawB, pitchB, WB, HB)
if casaB:
    marcas_b.append({'clave': 'amaicha', 'x': round(casaB[0] / WB * 100, 2), 'y': round(casaB[1] / HB * 100, 2)})
print('plan B, marcas', marcas_b)

# plan B: la finca desde arriba (ortofoto con los tejados borrados; los edificios se dibujan en SVG)
PL = 150.0                                         # lado en metros, centrado entre la casona y el hórreo
pcx, pcz = 6.0, 18.0
i0, j0 = a_px(pcx - PL / 2, pcz - PL / 2); i1, j1 = a_px(pcx + PL / 2, pcz + PL / 2)
orto_f.crop((int(i0), int(j0), int(i1), int(j1))).resize((900, 900), Image.LANCZOS).save(OUT / 'plano-finca-900.webp', quality=76, method=6)

# ------------------------------------------------------------------ metadatos
meta = {
    'version': 1,
    'origen': {'lat': CASA[0], 'lon': CASA[1], 'osm': 'node/459894261'},
    'kx': round(KX, 3), 'kz': KZ,
    'exag': {'lejos': 1.4, 'desde': 3500, 'hasta': 12000},
    'rasters': rasters,
    'orto': {
        'cerca': {'x0': rasters['cerca']['x0'], 'z0': rasters['cerca']['z0'], 'x1': rasters['cerca']['x1'], 'z1': rasters['cerca']['z1'],
                  'archivos': {'alta': 'orto-cerca-4096.webp', 'baja': 'orto-cerca-2048.webp'}},
        'finca': {'x0': round(fx0, 2), 'z0': round(fz0, 2), 'x1': round(fx1, 2), 'z1': round(fz1, 2),
                  'archivos': {'alta': 'orto-finca-2048.webp', 'baja': 'orto-finca-1024.webp'}},
        'lejos': {'x0': round(loc(43.58, -5.42)[0], 2), 'z0': round(loc(43.58, -5.42)[1], 2), 'x1': round(loc(43.10, -4.60)[0], 2),
                  'z1': round(loc(43.10, -4.60)[1], 2), 'archivos': {'alta': 'orto-lejos-2048.webp', 'baja': 'orto-lejos-2048.webp'}},
        'costa': {'archivo': 'costa.png', 'metros_por_unidad': 3.0},
    },
    'edificios': edificios,
    'horreo': HORREO,
    'arboles': arb,
    'lugares': lugares,
    'recorrido': rec,
    'planB': {'vista': {'archivos': ['vista-mar-960.webp', 'vista-mar-1600.webp'], 'ancho': WB, 'alto': HB, 'marcas': marcas_b},
              'plano': {'archivo': 'plano-finca-900.webp', 'cx': pcx, 'cz': pcz, 'lado': PL}},
    'fuentes': {
        'ign': 'Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0)',
        'catastro': 'Planta de los edificios © Dirección General del Catastro',
        'osm': 'Lugares © colaboradores de OpenStreetMap (ODbL)',
    },
    'fecha_datos': time.strftime('%Y-%m-%d'),
}
(OUT / 'lugar.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
tot = 0
for f in sorted(OUT.iterdir()):
    tot += f.stat().st_size; print(f'{f.name:28s} {f.stat().st_size // 1024:6d} KB')
print('total img/lugar', tot // 1024, 'KB')
