/* Verificación de la web de Amaicha (Playwright, UN navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs            (puerto 8967; todo)
        node verificar.mjs 3 4        (solo esos bloques, para depurar)
   Sin capturas: lo que hay que mirar a ojo va en el README. El 3D NO se pinta: el navegador arranca con
   --disable-3d-apis, la página se abre con ?sin-webgl y js/lugar.js y vendor/ se bloquean (del 3D solo se comprueba
   que existe su contenedor y que se ve el respaldo). El motor real (Amenitiz), Google Maps y las letras se sirven
   falsos: no se hace ninguna petición de verdad a terceros. Todo va con movimiento reducido salvo el bloque 12, una
   vez y al final. Mide comportamiento, no aspecto. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8967;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';
const MOTOR = 'https://amaicha-complejo-rural.amenitiz.io/es/booking/room';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle).slice(0, 700) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'amaicha-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const D = JSON.parse(leer('data/amaicha.json'));
const RUTAS = existe('ref/raw/rutas.json') ? JSON.parse(leer('ref/raw/rutas.json')) : null;
const kmTxt = (v) => String(Math.round(v * 10) / 10).replace('.', ',') + ' km';

/* ================= 1. archivos (sin navegador) ================= */
if (toca(1)) {
console.log('\n1. Archivos, textos y contrato');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
for (const f of htmls) {
  const s = leer(f);
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(s), `${f}: charset lo primero y noindex, nofollow justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
  comprobar(!/<!--parte:/.test(s) && !/<!-- sin partes\//.test(s) && !/\{\{[A-Z]+\}\}/.test(s) && !/<!--(formas|vistazo|estancias|alrededor|resenas|greca-[a-z]+|llegar|desayuno-lista|precarga-portada)-->/.test(s), `${f}: todas las partes y datos incluidos`);
  comprobar(!/[ÃÂ][\u0080-\u00BF]|\uFFFD/.test(s), `${f}: sin caracteres rotos`);
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'marca/greca.svg', 'marca/logo.svg', 'marca/logo-blanco.svg', 'marca/palabra.svg', 'marca/greca.json'].every(existe), 'están .nojekyll, 404, manifest, og, favicons y la greca vectorizada (greca, logo, logo blanco, palabra)');
const G = JSON.parse(leer('marca/greca.json'));
comprobar(G.colores.greca === '#836759' && G.iou.greca_limpia > 0.7 && G.iou.contra_logo_blanco > 0.7, `greca redibujada con rectas: color del logo ${G.colores.greca}, IoU ${G.iou.greca_limpia} con el PNG y ${G.iou.contra_logo_blanco} con el logo blanco`);
const greca = leer('marca/greca.svg');
comprobar(/viewBox="-9\.\d+ -7\.\d+ /.test(greca) && (greca.match(/<path/g) || []).length === 1 && !/[CcQqSs]/.test(greca.match(/ d="([^"]+)"/)[1].replace(/A[^A-Z]+/g, '')), 'marca/greca.svg: un solo trazado, solo rectas (y el arco del punto central), viewBox centrado');
const html = leer('index.html');
const fotosJson = JSON.parse(leer('img/fotos/fotos.json'));
const lista = JSON.parse(leer('scripts/fotos-lista.json'));
{
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r) && !/^(css\/lugar\.css|js\/lugar\.js)$/.test(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza (lugar.css y lugar.js, del otro agente, pueden faltar)`, faltan);
  if (!existe('js/lugar.js') || !existe('css/lugar.css')) nota('aún no están ' + ['css/lugar.css', 'js/lugar.js'].filter((f) => !existe(f)).join(' y ') + ' (Lugar 3D): la página usa el respaldo');

  /* fotos */
  const pedidas = [...new Set([...html.matchAll(/<picture data-foto="([^"]+)"/g)].map((m) => m[1]))];
  comprobar(pedidas.length >= 25 && pedidas.every((n) => fotosJson.some((f) => f.nombre === n)), `las ${pedidas.length} fotos de la página existen en img/fotos/fotos.json`, pedidas.filter((n) => !fotosJson.some((f) => f.nombre === n)));
  const faltanFotos = [];
  for (const f of fotosJson) for (const w of f.anchos) for (const e of ['avif', 'webp', 'jpg']) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanFotos.push(`${f.nombre}-${w}.${e}`);
  comprobar(faltanFotos.length === 0, 'cada foto existe en todos sus anchos y en AVIF, WebP y JPG', faltanFotos.slice(0, 5));
  const nit = existe('ref/raw/nitidez.json') ? JSON.parse(leer('ref/raw/nitidez.json')) : {};
  const amplia = fotosJson.filter((f) => { const o = nit[f.origen]; return !o || Math.max(...f.anchos) > o.ancho || f.ancho > o.ancho; });
  comprobar(amplia.length === 0, 'ninguna foto se amplía: ningún ancho pasa del de su original (ref/raw/nitidez.json)', amplia.map((f) => f.nombre));
  const blandas = fotosJson.filter((f) => { const o = nit[f.origen]; return o && o.cociente < 0.5 && f.ancho > o.ancho * 0.7; });
  comprobar(blandas.length === 0, 'las fotos ampliadas en origen (nitidez < 0,5) se sirven rebajadas a lo que tienen de verdad', blandas.map((f) => f.nombre));
  const hj = fotosJson.find((f) => f.nombre === 'horreo'), hn = nit[hj.origen];
  comprobar(hj && hn && hn.cociente >= 0.6 && hj.ancho === hn.ancho, `la portada (el hórreo) tiene resolución real: nitidez ${hn && hn.cociente} (≥ 0,6), ${hj.ancho}×${hj.alto} sin ampliar`);
  comprobar(/fetchpriority="high"/.test(html.match(/<section id="portada"[\s\S]*?<\/section>/)[0]) && /<link rel="preload" as="image"[^>]*horreo/.test(html), 'la foto de la portada lleva fetchpriority="high" y se precarga (es el LCP)');
  comprobar(new Set(lista.map((l) => l.ruta)).size === lista.length, 'cada original se usa una sola vez en la lista de fotos');

  /* textos: nada inventado, solo castellano, sin rayas */
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const alts = [...html.matchAll(/(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  comprobar(!/[—–]/.test(texto + alts), 'ni una raya (— ni –) en el texto visible, los alt ni las etiquetas');
  comprobar(/661 59 89 65/.test(texto) && /tel:\+34661598965/.test(html) && /cris@amaicha\.es/.test(texto) && /Camango 44/.test(texto) && /33568 Ribadesella/.test(texto), 'contacto: teléfono, correo y dirección de DATOS');
  comprobar(!/Tucum|calchaqu|Amaicha del Valle|pet friendly|mejor precio garantizado|siglo|centenari/i.test(texto + alts), 'nada que no esté en DATOS: ni el origen del nombre, ni «pet friendly», ni «mejor precio», ni siglos');
  comprobar(/>9,6</.test(html) && /<span class="cifra">198<\/span> reseñas/.test(html) && /query_place_id=ChIJjZLj6V7hSQ0RwYP4JGEfGzw/.test(html) && /9,9/.test(texto), 'reseñas: 9,6 con 198 reseñas en Google (recuento suficiente), 9,9 grupos y el enlace a la ficha');
  comprobar(!/\b(1|una)( sola| única)? reseña\b/i.test(texto) && !/clientes satisfechos|cientos de/i.test(texto), 'sin prueba social inventada');
  comprobar(/Es su motor de reservas real\./.test(texto) && /reservas que hagas dentro son de verdad/.test(texto), 'junto al motor, el aviso de que es su motor REAL');
  comprobar(!/<iframe/.test(html) && !/amenitiz\.io[^"]*\?start_date/.test(html), 'el iframe del motor no está en el HTML (se crea al pedirlo)');
  comprobar(/7 dobles y 1 individual|7<\/dd>[\s\S]{0,80}habitaciones dobles/.test(html) && /<dd class="cifra">4<\/dd>/.test(html.replace(/<dt>personas en cada uno<\/dt>/, '')) && /Sin eventos ni despedidas/.test(texto) && /No se admiten animales/.test(texto) && /Cancelación gratuita hasta 30 días antes/.test(texto), 'las tres formas con los datos de DATOS: 7 + 1 habitaciones, 2 apartamentos de 4, normas de la casa entera');
  comprobar((html.match(/<article class="forma"/g) || []).length === 3 && (html.match(/<svg class="ico" aria-hidden="true"><use href="#i-/g) || []).length >= 22 && !/<li>\s*•/.test(html), 'fichas diseñadas: tres, con servicios con icono propio (sprite #i-…), sin viñetas de texto');
  const iconosUsados = new Set([...html.matchAll(/use href="#(i-[a-z-]+)"/g)].map((m) => m[1]));
  comprobar([...iconosUsados].every((i) => new RegExp(`<symbol id="${i}"`).test(html)), `los ${iconosUsados.size} iconos que se usan existen en el sprite`, [...iconosUsados].filter((i) => !new RegExp(`<symbol id="${i}"`).test(html)));
  if (RUTAS) {
    const esc = html.match(/<div class="escalera">([\s\S]*?)<\/div>\s*<\/div>/);
    const ok = esc && RUTAS.llegar.every((id) => { const d = RUTAS.destinos[id].desde_casa; return new RegExp(`data-ruta="${id}"[\\s\\S]*?${kmTxt(d.km)}`).test(esc[1]); });
    comprobar(ok && (esc[1].match(/data-ruta=/g) || []).length === RUTAS.llegar.length, `Alrededor: las ${RUTAS.llegar.length} distancias son las de ref/raw/rutas.json (OSRM), ninguna a ojo`);
    comprobar(!/Ribadesella[^.]{0,40}(?<![\d,])[46] ?km|(?<![\d,])[46] ?km[^.]{0,30}Ribadesella/i.test(texto) && new RegExp(kmTxt(RUTAS.destinos.ribadesella.desde_casa.km)).test(texto), `conflicto 4/6 km resuelto con OSRM: Ribadesella a ${kmTxt(RUTAS.destinos.ribadesella.desde_casa.km)} por carretera (ni «4 km» ni «6 km»)`);
    comprobar(/data-q="43\.443446,-5\.012529"/.test(html), 'el mapa usa el punto OSM de la casa (rutas.json)');
  } else nota('sin ref/raw/rutas.json');

  /* contrato web ↔ módulos */
  const sitios = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/data-modulo="([^"]+)"/g)].map((m) => m[1]);
  comprobar(JSON.stringify(sitios) === JSON.stringify(['portada', 'lugar']), 'los huecos de los módulos: portada y lugar', sitios);
  comprobar(/<section id="lugar"[^>]*aria-labelledby="t-lugar">[\s\S]*?<div data-modulo="lugar">\s*<figure class="lugar__respaldo">[\s\S]*?jardin-horreo[\s\S]*?<\/figure>\s*<\/div>/.test(html), '#lugar: <div data-modulo="lugar"> con el respaldo (foto del jardín con el hórreo y texto)');
  const cabeza = html.split('</head>')[0];
  comprobar(/<link rel="stylesheet" href="css\/lugar\.css/.test(cabeza) && /<script src="js\/lugar\.js[^"]*" defer><\/script>/.test(html) && html.indexOf('js/lugar.js') < html.indexOf('js/main.js') && html.indexOf('js/portada.js') < html.indexOf('js/main.js'), 'carga css/lugar.css (en el <head>) y js/lugar.js (defer, antes de main.js) aunque aún no existan');
  comprobar(['js/portada.js', 'js/reserva.js', 'js/main.js'].every((s) => new RegExp(`<script src="${s}\\?v=[0-9a-f]+" defer>`).test(html)), 'los JS propios con defer y ?v=<huella>');
  comprobar(!/data-(partir|split|letras|chars?)\b/.test(html) && !/class="[^"]*\bcortina\b|id="cortina"/.test(html), 'ni letra a letra ni cortina');
}

/* CSS y JS: lo que no se negocia */
const base = leer('css/base.css'), css = leer('css/estilos.css');
comprobar(['--fondo', '--superficie', '--texto', '--texto-suave', '--marca', '--acento', '--linea', '--letra-titular', '--letra-texto', '--letra-cifras'].every((v) => new RegExp(`\\s${v}:`).test(base.split('}')[0])), 'las variables comunes del contrato, en :root de css/base.css');
comprobar(/--greca: #836759/.test(base) && /--marca: var\(--greca\)/.test(base) && (base.split('}')[0].match(/--[a-z]+: #[0-9A-F]{6};/g) || []).length === 5, 'cinco colores y ninguno más; --marca es el taupe exacto del logo (#836759)');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{\s*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css), 'cookies: display solo en :not([hidden])');
comprobar(/\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css), 'mando: display solo en :not([hidden])');
comprobar(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(base), '[hidden] siempre oculta');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css), 'menú móvil: altura 100dvh, nunca inset:0 (la cabecera lleva backdrop-filter)');
comprobar(!/\ddvh/.test(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\.menu-movil\s*\{[^}]*\}/, '')), 'fuera del menú fijo, ningún dvh (la barra del móvil no mueve nada)');
const js = ['js/main.js', 'js/reserva.js', 'js/portada.js'].map(leer).join('\n');
comprobar(!/cursor:\s*none/.test(base + css + js) && !/marquee/i.test(css + leer('index.html')) && !/li\s*\{[^}]*position:\s*sticky/.test(css), 'sin cursor propio, sin marquesina y sin pila sticky de tarjetas');
comprobar(/:focus-visible\s*\{\s*outline:\s*2px solid/.test(base) && /\.foco-greca path\s*\{[^}]*stroke-width:\s*2/.test(base), 'foco: contorno de 2 px y las esquinas en escalón (#foco-greca)');
const mainJs = leer('js/main.js');
comprobar(/raiz\.classList\.add\('con-movimiento'\)/.test(mainJs) && /const motion = !quieto;/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
comprobar(/if \(esBarra\(\)\) return;/.test(mainJs) && /if \(innerWidth === anchoVista\) return;/.test(leer('js/reserva.js')), 'el resize de la barra del móvil no rehace nada (main y el calendario)');
comprobar(/history\.scrollRestoration = 'manual'/.test(leer('partes/cabeza.html')) && /scrollTo\(0, 0\)/.test(mainJs), 'recargar a media página: scrollRestoration manual y vuelta arriba');
comprobar(!/(cdnjs|jsdelivr|unpkg|gsap)/i.test(leer('index.html').replace(/<!--[\s\S]*?-->/g, '')), 'ninguna librería de CDN en la página (sin GSAP ni Lenis): solo las letras de Google');
const fuentes = leer('index.html').match(/fonts\.googleapis\.com\/css2\?[^"]+/)[0];
const familias = [...fuentes.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1]);
comprobar(JSON.stringify(familias) === '["Encode+Sans","Gantari","Sono"]' && /display=swap/.test(fuentes), 'Google Fonts: Encode Sans, Gantari y Sono, display=swap, ninguna más');
{
  const otras = [];
  for (const d of fs.readdirSync(path.join(RAIZ, '..'))) {
    if (!/-web$/.test(d) || d === path.basename(RAIZ)) continue;
    const dir = path.join(RAIZ, '..', d);
    const ficheros = [...fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f)), ...(fs.existsSync(path.join(dir, 'css')) ? fs.readdirSync(path.join(dir, 'css')).filter((f) => f.endsWith('.css')).map((f) => path.join(dir, 'css', f)) : [])];
    for (const f of ficheros) { const s = fs.readFileSync(f, 'utf8'); for (const fam of familias) if (s.includes('family=' + fam) || new RegExp(`['"]${fam.replace(/\+/g, ' ')}['"]`).test(s)) otras.push(fam + ' en ' + d); }
  }
  comprobar(otras.length === 0, 'ninguna de las tres letras está ya en otra web de la cartera (grep en ../*-web)', [...new Set(otras)]);
}
// receta de borrado del mando (README), comprobada sobre copias en memoria
{
  const quitar = (s, re) => (re.test(s) ? s.replace(re, '') : null);
  const cab = quitar(leer('partes/cabeza.html').split('\r\n').join('\n'), /\s*\/\/ MANDO DE MAQUETA[^\n]*\n\s*if \(q\.has\('revision'\)\) \{[\s\S]*?\n    \}\n/);
  const pie = quitar(leer('partes/pie.html').split('\r\n').join('\n'), /<!-- MANDO DE MAQUETA[\s\S]*?<!-- fin del MANDO DE MAQUETA -->\n?/);
  const mj = quitar(mainJs.split('\r\n').join('\n'), /\s*\/\* =+ \d+\. MANDO DE MAQUETA[\s\S]*?\/\* fin del MANDO DE MAQUETA \*\//);
  let ok = !!(cab && pie && mj) && !/revision|densidad-sobria/.test(cab) && !/id="mando"|data-densidad/.test(pie) && !/data-densidad|pintarMando/.test(mj);
  try { new vm.Script(mj); new vm.Script(cab.match(/<script>([\s\S]*?)<\/script>/)[1]); } catch (e) { ok = false; }
  comprobar(ok, 'la receta de borrado del mando (README) quita los tres bloques y el JS sigue siendo válido');
}
}

/* ================= navegador: uno solo, sin WebGL ================= */
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'] });
try {
  async function nueva(op = {}, { script, abortar, con3d } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
    await ctx.route(/amenitiz\.io/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>motor de prueba</p>' }));
    await ctx.route(/googletagmanager|google-analytics|facebook\.com/, (r) => r.abort());
    // del 3D solo el contenedor y el respaldo: su JS y sus librerías no se cargan
    // (salvo en el bloque 11, que carga js/lugar.js de verdad: sin WebGL, el módulo se queda en su plan B 2D)
    if (!con3d) {
      await ctx.route(/\/js\/lugar\.js|\/vendor\//, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* sin 3D en las pruebas */' }));
      await ctx.route(/\/css\/lugar\.css/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    }
    if (abortar) await ctx.route(abortar, (r) => r.abort());
    if (script) await ctx.addInitScript(script);
    const page = await ctx.newPage();
    page._errores = [];
    page._noGet = [];
    page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|WebGL|webgl/.test(m.text())) page._errores.push('consola: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
    page.on('request', (r) => { if (r.method() !== 'GET') page._noGet.push(r.method() + ' ' + r.url()); });
    return { ctx, page };
  }
  const contrastes = (page, sel) => page.evaluate((sel) => {
    const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data]; };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const fondo = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/[, /] ?0\)$/.test(b)) return rgba(b).slice(0, 3); el = el.parentElement; } return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3); };
    return sel.map((s) => {
      const el = document.querySelector(s); if (!el) return [s, 'falta'];
      const f = fondo(el), c = rgba(getComputedStyle(el).color), a = c[3] / 255;
      const t = [0, 1, 2].map((i) => c[i] * a + f[i] * (1 - a));
      const x = L(t), y = L(f); return [s, Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100];
    });
  }, sel);

  /* ---------- 2. portada (respaldo) a cinco tamaños ---------- */
  if (toca(2)) {
  console.log('\n2. Portada (respaldo, movimiento reducido) a 360×640, 375×667, 390×844, 768×1024 y 1280×800');
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024], [1280, 800]]) {
    const movil = w < 1000;
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => { const i = document.querySelector('#portada img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      const cab = q('#cab'), t = q('.portada__texto'), h1 = q('#portada h1'), g = q('.portada__greca');
      const img = document.querySelector('#portada img');
      const b = [...document.querySelectorAll('#portada .btn')].map((x) => x.getBoundingClientRect());
      const sideBySide = innerWidth >= 900;
      return {
        foto: img.complete && img.naturalWidth > 0 && img.getBoundingClientRect().width > 50,
        h1BajoCab: h1.top >= cab.bottom - 1,
        noPisa: sideBySide ? (g.left >= t.right - 1 || g.right <= t.left + 1) : g.bottom <= t.top + 1,
        dentro: t.left >= 0 && t.right <= innerWidth + 1 && g.left >= -1 && g.right <= innerWidth + 1,
        botones: b.every((x) => x.right <= innerWidth + 1 && x.height >= 44),
        sinScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ctaVisible: b[0].bottom <= innerHeight || innerHeight < 700,
        respaldo: !document.getElementById('portada').classList.contains('es-greca') && getComputedStyle(document.querySelector('.portada__ventana')).display !== 'none',
      };
    });
    comprobar(Object.values(r).every(Boolean), `${w}×${h}: foto cargada, titular bajo la cabecera, greca y texto sin pisarse, botones ≥ 44 px dentro y sin scroll lateral`, r);
    comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 3. contraste y foco (escritorio) ---------- */
  if (toca(3)) {
  console.log('\n3. Contraste y foco (escritorio, movimiento reducido)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  await page.waitForTimeout(300);
  const sel = ['#portada h1', '.portada__sub', '#portada .btn--acento', '.portada__acc .btn--linea-clara',
    '#t-quedarse', '#quedarse .sec-txt', '.formas__sel [aria-selected="true"] b', '.formas__sel [aria-selected="false"] b', '.formas__sel [aria-selected="false"] small',
    '#forma-hotel .forma__tit', '#forma-hotel .forma__txt', '#forma-hotel .forma__cifras dd', '#forma-hotel .forma__cifras dt', '#forma-hotel .forma__serv b', '#forma-hotel .forma__serv span', '#forma-hotel .forma__cond li', '#forma-hotel .btn--oscuro',
    '#t-desayuno', '.desayuno__lista li', '.desayuno__nota', '.estancias__indice a', '.estancias__n', '.estancia__txt',
    '#t-lugar', '#lugar .sec-txt', '.lugar__respaldo figcaption', '.esc__tit', '.esc__tit small', '.esc__lista b', '.esc__km', '.esc__pie', '.alrededor__fino',
    '.resenas__sobre', '.resenas__dato', '.resenas__tipos span', '.resenas__tipos b', '.real', '.busca__eti', '.busca__resumen', '.chip span', '.chip input:checked + span', '.busca__pista', '.cal__tit', '.cal__dias button:not(:disabled)', '.motor__vacio p', '.reservar__alt', '#busca-ir',
    '.contacto__dir', '.contacto__fino', '.contacto__ruta', '.map-consent b', '.map-consent span:last-child', '.pie__h', '.pie__cols p', '.pie__cols a', '.pie__legal p', '.pie__legal a'];
  const cs = await contrastes(page, sel);
  const grandes = new Set(['#portada h1', '#t-quedarse', '#forma-hotel .forma__tit', '#forma-hotel .forma__cifras dd', '#t-desayuno', '.desayuno__lista li', '#t-lugar', '.esc__tit', '.resenas__tipos b', '.cal__tit']);
  const malos = cs.filter(([s, c]) => c === 'falta' || c < (grandes.has(s) ? 3 : 4.5));
  comprobar(malos.length === 0, `contraste WCAG ≥ 4,5:1 (3:1 en rótulos grandes) en ${cs.length} parejas de texto`, malos);
  nota('peores: ' + cs.filter(([, c]) => c !== 'falta').sort((a, b) => a[1] - b[1]).slice(0, 4).map(([s, c]) => `${s} ${c}`).join(' · '));
  // cabecera: clara sobre la portada; al bajar, fondo niebla
  const c0 = await page.evaluate(() => getComputedStyle(document.querySelector('.cab__nav a')).color);
  await page.evaluate(() => scrollTo(0, 900));
  await page.waitForFunction(() => document.getElementById('cab').classList.contains('sc'));
  const cb = await contrastes(page, ['.cab__nav a', '.cab__tel', '.cab__reservar']);
  comprobar(c0 === 'rgb(237, 239, 234)' && cb.every(([, c]) => c >= 4.5), 'cabecera: niebla sobre la portada; al bajar, fondo niebla con texto monte (≥ 4,5:1)', { c0, cb });
  // foco del teclado: contorno de 2 px + las esquinas en escalón, en claro y en oscuro
  const focos = [];
  for (const s of ['#portada .btn--acento', '.formas__sel [role="tab"]', '.estancias__indice a', '#mapa-btn', '.pie__cols a', '#busca-ir']) {
    await page.locator(s).first().scrollIntoViewIfNeeded();
    await page.locator(s).first().focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
    focos.push(await page.evaluate((s) => {
      const el = document.activeElement, c = getComputedStyle(el), m = document.getElementById('foco-greca');
      const r = el.getBoundingClientRect(), rm = m.getBoundingClientRect();
      return { s, el: el.matches(s), ancho: c.outlineWidth, estilo: c.outlineStyle, marco: m.classList.contains('es-visible') && rm.left < r.left && rm.right > r.right && rm.top < r.top && rm.bottom > r.bottom && /M1 11V6H6V1H11/.test(m.querySelector('path').getAttribute('d')) };
    }, s));
  }
  comprobar(focos.every((f) => f.ancho === '2px' && f.estilo === 'solid' && f.marco), 'foco del teclado: contorno de 2 px y el marco de esquinas en escalón alrededor (claro y oscuro)', focos);
  const cf = await page.evaluate(() => {
    const lz = document.createElement('canvas').getContext('2d');
    const rgb = (c) => { lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const k = (a, b) => { const x = L(rgb(a)), y = L(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    return { tejaNiebla: k('#9C3324', '#EDEFEA'), nieblaMonte: k('#EDEFEA', '#17211C'), tejaPrado: k('#9C3324', '#DFE4DC') };
  });
  comprobar(cf.tejaNiebla >= 3 && cf.nieblaMonte >= 3 && cf.tejaPrado >= 3, 'el color del foco llega a 3:1 contra los fondos (teja sobre niebla y prado, niebla sobre monte)', cf);
  // el pie, con movimiento reducido, ya está cerrado
  comprobar(await page.evaluate(() => document.querySelector('.pie__greca').classList.contains('es-cerrada') && getComputedStyle(document.querySelector('.pie__greca .pg-3')).opacity === '1'), 'pie: con movimiento reducido la greca ya está cerrada (estado final)');
  comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 4. tokens, letras, formas y estancias ---------- */
  if (toca(4)) {
  console.log('\n4. Tokens, letras, las tres formas y el índice de estancias');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  const tk = await page.evaluate(() => { const c = getComputedStyle(document.documentElement); return Object.fromEntries(['--niebla', '--monte', '--prado', '--greca', '--teja', '--letra-titular', '--letra-texto', '--letra-cifras'].map((n) => [n, c.getPropertyValue(n).trim()])); });
  comprobar(tk['--niebla'] === '#EDEFEA' && tk['--monte'] === '#17211C' && tk['--prado'] === '#DFE4DC' && tk['--greca'] === '#836759' && tk['--teja'] === '#9C3324', 'los cinco colores en :root', tk);
  const fam = await page.evaluate(() => ({ h1: getComputedStyle(document.querySelector('#portada h1')).fontFamily, cifra: getComputedStyle(document.querySelector('.forma__cifras dd')).fontFamily, p: getComputedStyle(document.querySelector('.forma__txt')).fontFamily }));
  comprobar(/Encode Sans/.test(fam.h1) && /Sono/.test(fam.cifra) && /Gantari/.test(fam.p), 'titulares en Encode Sans, cifras en Sono y texto en Gantari', fam);
  // pestañas
  const t0 = await page.evaluate(() => [...document.querySelectorAll('.forma')].map((f) => !f.hidden));
  await page.click('#tab-apartamentos');
  const t1 = await page.evaluate(() => ({ vis: [...document.querySelectorAll('.forma')].map((f) => !f.hidden), sel: document.getElementById('tab-apartamentos').getAttribute('aria-selected') }));
  await page.focus('#tab-apartamentos'); await page.keyboard.press('ArrowRight');
  const t2 = await page.evaluate(() => ({ foco: document.activeElement.id, vis: [...document.querySelectorAll('.forma')].map((f) => !f.hidden) }));
  comprobar(JSON.stringify(t0) === '[true,false,false]' && JSON.stringify(t1.vis) === '[false,true,false]' && t1.sel === 'true' && t2.foco === 'tab-casa' && JSON.stringify(t2.vis) === '[false,false,true]', 'las tres formas: pestañas que cambian la ficha (clic y flechas del teclado)', { t0, t1, t2 });
  // «Ver fechas» de una forma: baja a Reservar con ese tipo marcado
  await page.click('#forma-casa [data-reservar="casa"]');
  await page.waitForTimeout(300);
  const rv = await page.evaluate(() => ({ tipo: document.querySelector('input[name="tipo"]:checked').value, top: document.getElementById('reservar').getBoundingClientRect().top, pista: document.querySelector('[data-pista]').textContent }));
  comprobar(rv.tipo === 'casa' && rv.top > -10 && rv.top < 140 && /Casona Amaicha/.test(rv.pista), '«Ver fechas» de la casa entera baja a Reservar con «Casa entera» marcada', rv);
  // estancias: el índice marca la que se ve (filas de alturas iguales)
  const marcadas = [];
  for (const id of ['comun', 'habitaciones', 'apartamentos-fotos', 'jardin']) {
    await page.evaluate((id) => { const s = document.getElementById('est-' + id); scrollTo(0, s.getBoundingClientRect().top + scrollY - innerHeight * 0.3); }, id);
    await page.waitForTimeout(150);
    marcadas.push(await page.evaluate(() => (document.querySelector('.estancias__indice a[aria-current="true"]') || {}).dataset?.est));
  }
  comprobar(JSON.stringify(marcadas) === '["comun","habitaciones","apartamentos-fotos","jardin"]', 'la casa por estancias: el índice fijo marca la estancia que se ve (también con movimiento reducido)', marcadas);
  const filas = await page.evaluate(() => {
    const malas = [];
    document.querySelectorAll('.filas').forEach((f) => {
      const porFila = new Map();
      f.querySelectorAll('.foto').forEach((fig) => { const r = fig.getBoundingClientRect(); const k = Math.round(r.top); if (!porFila.has(k)) porFila.set(k, []); porFila.get(k).push(Math.round(r.height)); });
      porFila.forEach((hs) => { if (Math.max(...hs) - Math.min(...hs) > 2) malas.push(hs); });
    });
    const sticky = getComputedStyle(document.querySelector('.estancias__indice')).position;
    return { malas, sticky };
  });
  comprobar(filas.malas.length === 0 && filas.sticky === 'sticky', 'fotos sin marco con la misma altura en cada fila e índice fijo (sticky)', filas);
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 5. visor por NOMBRE ---------- */
  if (toca(5)) {
  console.log('\n5. El visor (abre por nombre de archivo)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  await page.click('#tab-hotel');
  const nombres = await page.evaluate(() => [...document.querySelectorAll('[data-visor]')].filter((b) => b.offsetParent).map((b) => b.dataset.visor));
  const fj = JSON.parse(leer('img/fotos/fotos.json')).map((f) => f.nombre);
  comprobar(nombres.length >= 25 && nombres.every((n) => fj.includes(n)), `${nombres.length} fotos con visor y todas existen`, nombres);
  const mal = [];
  for (const n of nombres) {
    const b = page.locator(`[data-visor="${n}"]:visible`).first();
    await b.scrollIntoViewIfNeeded();
    await b.click();
    const v = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre, src: document.getElementById('visor-img').getAttribute('src') }));
    if (!v.open || v.n !== n || !v.src.includes('/' + n + '-')) mal.push([n, v]);
    await page.keyboard.press('Escape');
  }
  comprobar(mal.length === 0, 'cada miniatura abre SU foto (nombre de archivo comprobado) y Escape cierra', mal.slice(0, 3));
  const api = await page.evaluate(() => { window.Amaicha.visor.abrir(['casona', 'horreo-jardin', 'porche'], 'horreo-jardin'); return { n: document.getElementById('visor-img').dataset.nombre, cuenta: document.getElementById('visor-n').textContent }; });
  comprobar(api.n === 'horreo-jardin' && api.cuenta === '2 / 3', 'Amaicha.visor.abrir(lista, nombre) abre por nombre', api);
  await page.keyboard.press('ArrowRight');
  comprobar(await page.evaluate(() => document.getElementById('visor-img').dataset.nombre === 'porche'), 'la flecha del teclado pasa a la siguiente');
  await page.keyboard.press('Escape');
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 6. reservar: el buscador y el iframe REAL que se crea solo al pedirlo ---------- */
  if (toca(6)) {
  console.log('\n6. Reservar: buscador propio + su motor real (Amenitiz) en iframe');
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const movil = w < 600;
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil }, { script: sinCookies });
    await page.goto(PAG);
    await page.locator('#busca').scrollIntoViewIfNeeded();
    comprobar(await page.evaluate(() => !document.querySelector('iframe')), `${w}: el iframe del motor no existe hasta pedirlo`);
    await page.click('#busca-ir');
    comprobar(await page.evaluate(() => !document.querySelector('iframe') && /Falta el día de llegada/.test(document.querySelector('[data-resumen]').textContent)), `${w}: sin fechas, «Buscar» no abre nada y dice lo que falta`);
    await page.click('.cal__flecha[data-nav="1"]');
    const par = await page.evaluate(() => { const b = [...document.querySelectorAll('.cal__dias button:not(:disabled)')]; return [b[10].dataset.k, b[13].dataset.k]; });
    await page.click(`.cal__dias button[data-k="${par[0]}"]`);
    await page.click(`.cal__dias button[data-k="${par[1]}"]`);
    for (let i = 0; i < 20 && !(await page.evaluate(() => document.querySelector('[data-paso="adultos"] [data-acc="mas"]').disabled)); i++) await page.click('[data-paso="adultos"] [data-acc="mas"]');
    const lim = await page.evaluate(() => ({ v: document.querySelector('[data-paso="adultos"] [data-valor]').textContent, dis: document.querySelector('[data-paso="adultos"] [data-acc="mas"]').disabled }));
    comprobar(lim.v === '12' && lim.dis, `${w}: adultos hasta 12 (el máximo de su motor)`, lim);
    for (let i = 0; i < 9; i++) await page.click('[data-paso="adultos"] [data-acc="menos"]');
    await page.click('[data-paso="ninos"] [data-acc="mas"]');
    await page.click('label.chip:has(input[value="apartamentos"])');
    const pista = await page.evaluate(() => document.querySelector('[data-pista]').textContent);
    comprobar(/Apartamento de 2 dormitorios/.test(pista), `${w}: el tipo cambia la pista (apartamento)`, pista);
    await page.click('#busca-ir');
    const ifr = await page.waitForFunction(() => { const f = document.getElementById('motor-iframe'); return f && f.src; }, null, { timeout: 5000 }).then((x) => x.jsonValue(), () => null);
    comprobar(ifr === `${MOTOR}?start_date=${par[0]}&end_date=${par[1]}&adults=3&children=1`, `${w}: al buscar se CREA el iframe de su Amenitiz con fechas y personas por URL`, ifr);
    await page.waitForFunction(() => /con tu búsqueda/.test(document.getElementById('motor-estado').textContent), null, { timeout: 5000 }).catch(() => {});
    const m = await page.evaluate(() => { const f = document.getElementById('motor-iframe').getBoundingClientRect(); return { alto: Math.round(f.height), ancho: Math.round(f.width), vista: innerHeight, dentro: f.left >= 0 && f.right <= innerWidth + 1, fuera: document.getElementById('motor-fuera').href, estado: document.getElementById('motor-estado').textContent, real: /su motor de reservas real/i.test(document.querySelector('.real').textContent) }; });
    comprobar(m.alto >= 640 && m.alto <= 1040 && m.dentro && m.fuera === ifr && /con tu búsqueda/.test(m.estado) && m.real, `${w}: el iframe mide ${m.alto} px de alto (entre 640 y 1040), cabe de ancho y lleva al lado «Abrir en otra pestaña» y el aviso de motor real`, m);
    await page.click('#motor-sin-fechas');
    comprobar(await page.evaluate((u) => document.getElementById('motor-iframe').src === u && document.querySelectorAll('iframe').length === 1, MOTOR), `${w}: «Abrir su calendario sin fechas» lleva el mismo iframe a la dirección base`);
    comprobar(page._noGet.length === 0, `${w}: el buscador no envía nada (ninguna petición que no sea GET)`, page._noGet);
    comprobar(page._errores.length === 0, `${w}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 7. cookies y mapa ---------- */
  if (toca(7)) {
  console.log('\n7. Cookies y mapa de Google');
  const { ctx, page } = await nueva();
  await page.goto(PAG);
  const vis = () => page.evaluate(() => { const c = document.getElementById('cookies'); return !c.hidden && getComputedStyle(c).display === 'flex' && c.getBoundingClientRect().height > 40; });
  await page.waitForTimeout(200);
  comprobar(await vis(), 'cookies: el aviso aparece en la primera visita');
  comprobar(await page.evaluate(() => /Google Fonts/.test(document.getElementById('cookies').textContent) && /mapa de Google/.test(document.getElementById('cookies').textContent) && /Amenitiz/.test(document.getElementById('cookies').textContent)), 'el aviso cita Google Fonts, el mapa de Google y el motor (Amenitiz)');
  await page.click('#ck-si');
  comprobar(!(await vis()) && await page.evaluate((k) => localStorage.getItem(k) === 'si', LLAVE), 'cookies: «Entendido» lo cierra y lo recuerda');
  await page.reload(); await page.waitForTimeout(300);
  comprobar(!(await vis()), 'cookies: no vuelve a salir tras aceptar');
  await page.locator('#abrir-cookies').scrollIntoViewIfNeeded();
  await page.click('#abrir-cookies');
  comprobar(await vis(), 'cookies: «Preferencias de cookies» lo vuelve a abrir');
  await page.click('#ck-no');
  comprobar(!(await vis()) && await page.evaluate((k) => localStorage.getItem(k) === 'no', LLAVE), 'cookies: «Solo lo necesario» lo cierra y lo recuerda');
  await page.evaluate((k) => localStorage.removeItem(k), LLAVE); await page.reload(); await page.waitForTimeout(300);
  comprobar(await vis(), 'cookies: si se borra la clave, vuelve a salir');
  const ckp = leer('cookies.html'), pr = leer('privacidad.html');
  comprobar(/Google Fonts/.test(ckp) && /Google Maps/.test(ckp) && /Amenitiz/.test(ckp) && /Google Tag Manager/.test(ckp) && /amaicha-cookies/.test(pr) && /Amenitiz/.test(pr), 'cookies y privacidad citan Google Fonts, Google Maps, Amenitiz (con GTM) y lo que se guarda');
  await page.locator('#mapa').scrollIntoViewIfNeeded();
  comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'el mapa de Google no se carga hasta pedirlo');
  await page.click('#mapa-btn');
  const m = await page.evaluate(() => { const f = document.querySelector('#mapa iframe'); return f && f.src; });
  comprobar(m && /output=embed/.test(m) && /maps\?q=43\.443446%2C-5\.012529/.test(m), 'al pulsar, el mapa se carga (maps?q=<punto OSM de la casa>&output=embed, sin clave)', m);
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 8. mando de densidades (solo con ?revision) ---------- */
  if (toca(8)) {
  console.log('\n8. Mando «Greca / Sobria»');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  const sin = await page.evaluate(() => ({ mando: !document.getElementById('mando').hidden, disp: getComputedStyle(document.getElementById('mando')).display, vistazo: getComputedStyle(document.getElementById('vistazo')).display }));
  comprobar(!sin.mando && sin.disp === 'none' && sin.vistazo === 'none', 'sin ?revision: ni mando ni tabla «De un vistazo»', sin);
  await page.goto(PAG + '&revision');
  await page.waitForTimeout(200);
  const con = await page.evaluate(() => ({ botones: [...document.querySelectorAll('#mando button')].map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')), vis: !document.getElementById('mando').hidden, izq: document.getElementById('mando').getBoundingClientRect().left < 40 }));
  comprobar(con.vis && con.izq && con.botones.join() === 'Greca:true,Sobria:false', 'con ?revision: el mando «Greca / Sobria» abajo a la izquierda, con Greca marcada', con);
  await page.click('#mando button[data-densidad="sobria"]');
  await page.waitForTimeout(200);
  const so = await page.evaluate(() => ({ clase: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, url: location.search, filas: document.querySelectorAll('.vistazo__tabla tbody tr').length, fichas: [...document.querySelectorAll('.forma')].filter((f) => getComputedStyle(f).display !== 'none').length, sel: getComputedStyle(document.querySelector('.formas__sel')).display, sc: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
  comprobar(so.clase && so.vistazo === 'block' && /densidad=sobria/.test(so.url) && so.filas === 8 && so.fichas === 3 && so.sel === 'none' && so.sc, 'en «Sobria»: sin pestañas (las tres fichas seguidas) y AÑADE la tabla «De un vistazo» (8 filas), sin scroll lateral', so);
  await page.click('#mando button[data-densidad="greca"]');
  comprobar(await page.evaluate(() => !document.documentElement.classList.contains('densidad-sobria') && getComputedStyle(document.getElementById('vistazo')).display === 'none'), 'volver a «Greca» la oculta');
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  const c2 = await nueva({});
  await c2.page.goto(PAG + '&revision');
  comprobar(await c2.page.evaluate(() => !(!document.getElementById('cookies').hidden && !document.getElementById('mando').hidden)), 'el mando se aparta mientras está el aviso de cookies');
  await c2.ctx.close();
  }

  /* ---------- 9. móvil: menú, visor con el dedo, barra del navegador, índice y buscador ---------- */
  if (toca(9)) {
  console.log('\n9. Móvil (390×844): menú, visor con el dedo, barra del navegador');
  const { ctx, page } = await nueva({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { script: sinCookies });
  await page.goto(PAG);
  await page.evaluate(() => scrollTo(0, 1600));
  await page.waitForFunction(() => document.getElementById('cab').classList.contains('sc'));
  await page.click('#menu-btn');
  const mm = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { top: r.top, alto: r.height, vista: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility, exp: document.getElementById('menu-btn').getAttribute('aria-expanded') }; });
  comprobar(mm.top === 0 && Math.abs(mm.alto - mm.vista) < 2 && mm.vis === 'visible' && mm.exp === 'true', 'menú móvil a pantalla completa con la cabecera ya fija (blur) y aria-expanded', mm);
  await page.click('#menu-btn');
  comprobar(await page.evaluate(() => !document.body.classList.contains('menu')), 'el botón del menú también lo cierra (no queda debajo de la cortina)');
  await page.click('#menu-btn');
  await page.click('#menu-movil a[href="#reservar"]');
  comprobar(await page.waitForFunction(() => !document.body.classList.contains('menu'), null, { timeout: 3000 }).then(() => true, () => false), 'el menú se cierra al elegir');
  // visor con el dedo
  const nombres = await page.evaluate(() => [...document.querySelectorAll('#est-jardin [data-visor]')].map((b) => b.dataset.visor));
  const mal = [];
  for (const n of nombres) {
    const b = page.locator(`[data-visor="${n}"]`);
    await b.scrollIntoViewIfNeeded(); await b.tap();
    const v = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre }));
    if (!v.open || v.n !== n) mal.push([n, v]);
    await page.click('#visor-cerrar');
  }
  comprobar(mal.length === 0 && nombres.length === 6, 'con el dedo, cada foto del jardín abre la suya', mal);
  await page.locator(`[data-visor="${nombres[0]}"]`).tap();
  const ok = await page.evaluate(() => ['.visor__btn--sig', '.visor__btn--ant'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); const x = r.left + r.width / 2; return [0.25, 0.5, 0.75, 0.9].map((f) => { const e = document.elementFromPoint(x, r.top + r.height * f); return !!e && !!e.closest(s); }).every(Boolean); }));
  comprobar(ok.every(Boolean), 'visor móvil: los botones ‹ › reciben el toque en toda su altura', ok);
  await page.click('#visor-cerrar');
  // índice de estancias en móvil: cuatro pestañas cortas que caben sin desbordar
  await page.locator('#est-comun').scrollIntoViewIfNeeded();
  const ind = await page.evaluate(() => { const o = document.querySelector('.estancias__indice ol'); return { cabe: o.scrollWidth <= o.clientWidth + 1, txt: [...document.querySelectorAll('.estancias__corto')].map((s) => getComputedStyle(s).display !== 'none' ? s.textContent : '').join(',') }; });
  comprobar(ind.cabe && ind.txt === 'Común,Hotel,Apartamentos,Jardín', 'índice de estancias en móvil: cuatro nombres cortos que caben', ind);
  // la barra del navegador: 6 cambios de alto → ningún «amaicha:resize» y nada se mueve
  await page.evaluate(() => document.querySelectorAll('main > section, footer').forEach((s) => { s.style.height = s.offsetHeight + 'px'; }));
  const n0 = await page.evaluate(() => { window.__res = 0; document.addEventListener('amaicha:resize', () => window.__res++); scrollTo(0, 5200); return document.getElementById('contacto').getBoundingClientRect().top + scrollY; });
  await page.waitForTimeout(150);
  for (const alto of [788, 844, 788, 844, 800, 844]) { await page.setViewportSize({ width: 390, height: alto }); await page.waitForTimeout(260); }
  const d = await page.evaluate(() => ({ res: window.__res, top: document.getElementById('contacto').getBoundingClientRect().top + scrollY }));
  comprobar(d.res === 0 && Math.abs(d.top - n0) < 1, 'barra del móvil: nada se rehace y la página no se mueve', { ...d, antes: n0 });
  await page.evaluate(() => document.querySelectorAll('main > section, footer').forEach((s) => { s.style.height = ''; }));
  const mo = await page.evaluate(() => { const b = document.getElementById('busca').getBoundingClientRect(); const dia = document.querySelector('.cal__dias button').getBoundingClientRect(); return { cabe: b.right <= innerWidth + 1 && b.left >= 0, meses: document.querySelectorAll('.cal__mes').length, dia: Math.round(dia.width) }; });
  comprobar(mo.cabe && mo.meses === 1 && mo.dia >= 38, 'el buscador cabe en 390 px, enseña un mes y los días miden ≥ 38 px', mo);
  comprobar(page._errores.length === 0, 'móvil: sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 10. legales ---------- */
  if (toca(10)) {
  console.log('\n10. Legales y 404');
  const { ctx, page } = await nueva();
  for (const f of ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', '404']) {
    page._errores.length = 0;
    await page.goto(BASE + f + '.html');
    comprobar((await page.locator('h1').count()) === 1 && page._errores.length === 0, `${f}.html se abre sin errores`, page._errores);
  }
  const av = leer('aviso-legal.html');
  comprobar(/Cristina Durand Zurdo/.test(av) && /02653919H/.test(av) && /Camango 44, 33568 Ribadesella/.test(av) && /Registro de turismo<\/dt><dd><span class="aviso-corto">por confirmar/.test(av) && /OSRM/.test(av) && /ODbL/.test(av) && /reservas que se hacen en él son reales/.test(av), 'aviso legal: el titular de DATOS (nombre, NIF y domicilio), registro «por confirmar», OSM/OSRM y el motor real');
  await ctx.close();
  }

  /* ---------- 11. el 3D: solo el contenedor y su respaldo (no se pinta) ---------- */
  if (toca(11)) {
  console.log('\n11. El lugar en 3D: el contenedor y el respaldo (sin pintar WebGL)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  await page.locator('#lugar').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const i = document.querySelector('[data-modulo="lugar"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 }).catch(() => {});
  const r = await page.evaluate(() => { const el = document.querySelector('[data-modulo="lugar"]'); const img = el.querySelector('img'); const r = img && img.getBoundingClientRect(); return { el: !!el, foto: !!img && img.complete && img.naturalWidth > 0 && r.width > 200, texto: /jardín/.test(el.textContent), canvas: !!el.querySelector('canvas') }; });
  comprobar(r.el && r.foto && r.texto && !r.canvas, 'el hueco #lugar [data-modulo="lugar"] existe y se ve el respaldo (foto del jardín con el hórreo y texto), sin canvas', r);
  comprobar(page._errores.length === 0, 'sin js/lugar.js la página no falla', page._errores.slice(0, 3));
  await ctx.close();
  // con js/lugar.js de verdad (sin WebGL: --disable-3d-apis): se monta en su plan B 2D (LUGAR.md, «Para Web»)
  if (existe('js/lugar.js')) {
    const c3 = await nueva({}, { script: sinCookies, con3d: true });
    await c3.page.goto(PAG);
    const anc = await c3.page.evaluate(() => { const r = []; for (let e = document.querySelector('[data-modulo="lugar"]').parentElement; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e); if (/(hidden|auto|scroll|clip)/.test(c.overflowX + ' ' + c.overflowY) || c.transform !== 'none' || c.filter !== 'none') r.push(e.tagName + '.' + e.className); } return { r, arriba: getComputedStyle(document.getElementById('lugar')).getPropertyValue('--lugar-arriba').trim() }; });
    comprobar(anc.r.length === 0 && anc.arriba !== '', 'el escenario sticky del 3D puede pegarse: ningún antepasado con overflow, transform ni filter, y --lugar-arriba puesto (el html lleva overflow-x: clip, que no crea caja de scroll)', anc);
    await c3.page.locator('#lugar').scrollIntoViewIfNeeded();
    const ok = await c3.page.waitForFunction(() => { const el = document.querySelector('[data-modulo="lugar"]'); return el.dataset.montado === '1' && el.dataset.modo === 'plano'; }, null, { timeout: 8000 }).then(() => true, () => false);
    await c3.page.waitForFunction(() => [...document.querySelectorAll('.lugar__vista img, .lugar__finca img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
    const p3 = await c3.page.evaluate(() => { const el = document.querySelector('[data-modulo="lugar"]'); const imgs = [...el.querySelectorAll('.lugar__vista img, .lugar__finca img')]; return { montado: el.dataset.montado, modo: el.dataset.modo, imgs: imgs.length, cargadas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, marcas: [...el.querySelectorAll('.lugar__marca')].filter((m) => !m.hidden && getComputedStyle(m).display !== 'none' && (m.querySelector('span') || m).getBoundingClientRect().width > 0).length, canvas3d: !!el.querySelector('canvas'), sc: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
    comprobar(ok && p3.imgs >= 2 && p3.cargadas === p3.imgs && p3.marcas > 0 && p3.sc, 'con js/lugar.js y sin WebGL: data-montado="1", data-modo="plano", cargan las imágenes del plan B y hay marcas visibles (sin scroll lateral)', p3);
    comprobar(c3.page._errores.length === 0, 'el módulo del 3D (plan B) no da errores', c3.page._errores.slice(0, 3));
    await c3.ctx.close();
  } else nota('aún no está js/lugar.js');
  }

  /* ---------- 12. con movimiento, una vez y al final ---------- */
  if (toca(12)) {
  console.log('\n12. Con movimiento (una vez): la greca, el gesto, la recarga a media página, titulares y el pie');
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('es-greca'), null, { timeout: 5000 }).catch(() => {});
    const leerG = () => page.evaluate(() => { const f = document.querySelector('.portada__foto'); const cp = f ? getComputedStyle(f).clipPath : ''; const n = (cp.match(/-?\d+(\.\d+)?/g) || []).map(Number); const e = window.Amaicha.web.montados.get(document.querySelector('[data-modulo="portada"]')); return { activa: document.getElementById('portada').classList.contains('es-greca'), D: n.length > 3 ? n[2] - n[0] : 0, est: e && e.inst && e.inst.estado, scroll: scrollY, alto: document.getElementById('portada').offsetHeight, foto: (() => { const i = document.querySelector('.portada__foto img'); return !!i && i.complete && i.naturalWidth > 0; })() }; });
    const g0 = await leerG();
    await page.mouse.move(640, 400);
    const pasos = [];
    for (let i = 0; i < 26; i++) { await page.mouse.wheel(0, 160); await page.waitForTimeout(60); if (i % 5 === 4) pasos.push(await leerG()); }
    const tramoFin = await page.evaluate(() => document.getElementById('portada').offsetHeight - innerHeight);
    await page.evaluate((y) => scrollTo(0, y), tramoFin);
    await page.waitForTimeout(200);
    const gF = await leerG();
    const Ds = [g0, ...pasos, gF].map((g) => Math.round(g.D));
    comprobar(g0.activa && g0.foto && g0.alto > 800 * 2 && g0.est && g0.est.p === 0, 'portada con movimiento: la greca se monta (escena fijada en una pista de scroll) y la foto está cargada', g0);
    comprobar(Ds.every((d, i) => i === 0 || d >= Ds[i - 1] - 1) && gF.D > g0.D * 3 && gF.est.p === 1 && gF.est.s === 1, `al bajar, la ventana crece escalón a escalón hasta cubrir la pantalla (diagonal ${Ds.join(' → ')})`, { Ds, fin: gF.est });
    const cubre = await page.evaluate(() => { const r = document.querySelector('.portada__fija').getBoundingClientRect(); const est = window.Amaicha.web.montados.get(document.querySelector('[data-modulo="portada"]')).inst.estado; return { est }; });
    comprobar(cubre.est.R >= cubre.est.K, 'al final de la pista la ventana pasa del último escalón (la foto llena la escena)', cubre);
    // recarga a media página → arriba
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(40); }
    await page.reload();
    await page.waitForTimeout(600);
    comprobar(await page.evaluate(() => scrollY) === 0, 'recargar a media página: vuelve arriba (scrollY === 0)', await page.evaluate(() => scrollY));
    comprobar(page._errores.length === 0, 'con movimiento no hay errores (escritorio)', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('es-greca'), null, { timeout: 5000 }).catch(() => {});
    const cdp = await ctx.newCDPSession(page);
    // el gesto: arrastrar en horizontal con el dedo (eventos táctiles de verdad) desplaza la foto; al soltar vuelve
    const est = () => page.evaluate(() => { const e = window.Amaicha.web.montados.get(document.querySelector('[data-modulo="portada"]')); return e && e.inst && e.inst.estado ? { dx: e.inst.estado.dx, tr: document.querySelector('.portada__foto img').style.transform } : null; });
    const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await t('touchStart', 120, 300);
    for (let i = 1; i <= 8; i++) { await t('touchMove', 120 + i * 18, 302); await page.waitForTimeout(30); }
    await page.waitForTimeout(80);
    const durante = await est();
    await t('touchEnd');
    await page.waitForTimeout(900);
    const despues = await est();
    comprobar(durante && durante.dx > 30 && despues && Math.abs(despues.dx) < 1, 'gesto táctil del hero: arrastrar con el dedo desplaza la foto dentro de la ventana y al soltar vuelve (muelle)', { durante, despues });
    const y0 = await page.evaluate(() => scrollY);
    // deslizar en vertical con el dedo sobre la portada (synthesizeScrollGesture no desplaza en chrome-headless-shell)
    await t('touchStart', 200, 700);
    for (let i = 1; i <= 10; i++) { await t('touchMove', 200, 700 - i * 40); await page.waitForTimeout(16); }
    await t('touchEnd');
    await page.waitForTimeout(500);
    const y1 = await page.evaluate(() => scrollY);
    comprobar(y1 > y0 + 200, 'y el scroll vertical con el dedo sigue siendo de la página (touch-action: pan-y)', { y0, y1 });
    // titulares en móvil con movimiento: todos aparecen al pasar
    const total = await page.evaluate(() => document.querySelectorAll('[data-aparece]').length);
    for (let pasada = 0; pasada < 2; pasada++) {
      const alto = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < alto; y += 500) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(60); }
    }
    await page.waitForTimeout(1300);
    const vistos = await page.evaluate(() => [...document.querySelectorAll('[data-aparece]')].map((h) => [h.id, h.classList.contains('es-visto'), getComputedStyle(h).opacity]));
    comprobar(vistos.length === total && vistos.every(([, v, o]) => v && o === '1'), `móvil con movimiento: los ${total} titulares aparecen al pasar`, vistos.filter(([, v]) => !v));
    // el pie: la greca se cierra al llegar (lo que la portada abrió)
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1900);
    const pie = await page.evaluate(() => ({ cerrada: document.querySelector('.pie__greca').classList.contains('es-cerrada'), op: [...document.querySelectorAll('.pie__greca .pg')].map((g) => getComputedStyle(g).opacity) }));
    comprobar(pie.cerrada && pie.op.every((o) => o === '1'), 'el objeto se completa en el pie: la greca se cierra (anillo, anillo medio, centro)', pie);
    comprobar(page._errores.length === 0, 'con movimiento no hay errores (móvil)', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    await page.goto(PAG);
    const r = await page.evaluate(() => ({ h1: !!document.querySelector('#portada h1').offsetParent, ventana: getComputedStyle(document.querySelector('.portada__ventana')).display !== 'none', tit: getComputedStyle(document.querySelector('#t-quedarse')).opacity, fichas: [...document.querySelectorAll('.forma')].filter((f) => getComputedStyle(f).display !== 'none').length, motor: !!document.querySelector('#cal noscript'), lugar: !!document.querySelector('[data-modulo="lugar"] img') }));
    comprobar(r.h1 && r.ventana && r.tit === '1' && r.fichas === 3 && r.motor && r.lugar, 'sin JavaScript: la portada en su respaldo, las tres fichas, el respaldo del 3D y el motor remite a su enlace y al teléfono', r);
    await ctx.close();
  }
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} comprobaciones bien, ${fallos.length} mal`);
if (fallos.length) { console.log('FALLOS:\n - ' + fallos.join('\n - ')); process.exitCode = 1; }
