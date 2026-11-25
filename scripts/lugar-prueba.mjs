/* Comprobación del módulo lugar (agente Lugar 3D). NO pinta el 3D.
   1. Funciones puras de js/lugar.js en Node (vm): sol y luna, el recorrido (sin pasarse de largo).
   2. Datos de img/lugar/: ficheros, cajas, lugares, recorrido, peso.
   3. Plan B en Chromium sin WebGL (--disable-3d-apis + navigator.webdriver): monta, imágenes, marcas,
      alturas PNG bien decodificadas (canvas 2D), sin errores, destruir() repone el respaldo.
   Uso: node scripts/lugar-prueba.mjs            (puerto 8961)
        node scripts/lugar-prueba.mjs --sin-navegador   (solo 1 y 2)
   Un solo navegador, ventanas pequeñas, escala 1, movimiento reducido. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8961;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) { bien++; console.log('  ok  ', txt); } else { fallos++; console.log('  MAL ', txt); } };

/* ---------- 1. funciones puras ---------- */
console.log('1. funciones puras');
const ctx = { window: {}, document: { currentScript: null }, location: { href: 'http://localhost/', search: '' }, URL, URLSearchParams, Intl, Math, Date, console };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/lugar.js'), 'utf8'), ctx, { filename: 'lugar.js' });
const L = ctx.Amaicha.lugar;
ok(typeof L.montar === 'function', 'expone Amaicha.lugar.montar');
// solsticio de verano a mediodía solar en Ribadesella: ~70° de altura, al sur
const s = L.sol(new Date('2026-06-21T12:20:00Z'));
ok(s.alt > 68 && s.alt < 71 && s.az > 170 && s.az < 195, `sol 21-jun 12:20 UTC: ${s.alt.toFixed(1)}° alt, ${s.az.toFixed(0)}° az`);
const s2 = L.sol(new Date('2026-12-21T12:20:00Z'));
ok(s2.alt > 22 && s2.alt < 25, `sol 21-dic 12:20 UTC: ${s2.alt.toFixed(1)}°`);
const l = L.luna(new Date('2026-11-24T22:00:00Z'));
ok(l.luz >= 0 && l.luz <= 1 && l.fase >= 0 && l.fase <= 1, `luna: ${(l.luz * 100).toFixed(0)} % iluminada, fase ${l.fase.toFixed(2)}`);
ok(/Ribadesella/.test(L.fraseCielo(new Date())), 'frase del cielo: ' + L.fraseCielo(new Date()));

const meta = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/lugar/lugar.json'), 'utf8'));
const ruta = L.camino(meta.recorrido);
let pasaDeLargo = 0, salto = 0, prev = null, minAlt = 1e9;
for (let i = 0; i <= 4000; i++) {
  const p = i / 4000, r = ruta(p);
  for (let k = 0; k < 3; k++) {
    const vs = meta.recorrido.map((x) => x.pos[k]);
    if (r.pos[k] < Math.min(...vs) - 0.01 || r.pos[k] > Math.max(...vs) + 0.01) pasaDeLargo++;
  }
  if (prev) salto = Math.max(salto, Math.hypot(r.pos[0] - prev[0], r.pos[1] - prev[1], r.pos[2] - prev[2]));
  prev = r.pos; minAlt = Math.min(minAlt, r.pos[1]);
}
ok(pasaDeLargo === 0, 'el recorrido no se sale del rango de sus puntos');
ok(salto < 12, `paso máximo entre 1/4000 de scroll: ${salto.toFixed(2)} m`);
const r0 = ruta(0), r1 = ruta(1);
ok(Math.abs(r0.pos[1] - meta.recorrido[0].pos[1]) < 0.01 && Math.abs(r1.pos[2] - meta.recorrido.at(-1).pos[2]) < 0.01, 'empieza y acaba en sus puntos');
ok(minAlt > meta.horreo.suelo + 4, `la cámara nunca baja de ${(minAlt - meta.horreo.suelo).toFixed(1)} m sobre el suelo del hórreo`);

/* ---------- 2. datos ---------- */
console.log('2. datos de img/lugar/');
const dir = path.join(RAIZ, 'img/lugar');
const usados = new Set(['lugar.json', meta.orto.costa.archivo, ...meta.planB.vista.archivos, meta.planB.plano.archivo]);
Object.values(meta.rasters).forEach((r) => usados.add(r.archivo));
['cerca', 'finca', 'lejos'].forEach((k) => Object.values(meta.orto[k].archivos).forEach((a) => usados.add(a)));
usados.forEach((f) => ok(fs.existsSync(path.join(dir, f)), 'existe ' + f));
const sobran = fs.readdirSync(dir).filter((f) => !usados.has(f));
ok(sobran.length === 0, 'ningún fichero sin usar en img/lugar/' + (sobran.length ? ': ' + sobran.join(', ') : ''));
const peso = fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
ok(peso < 4.5e6, `peso de img/lugar/: ${(peso / 1048576).toFixed(2)} MB`);
const pesoEsc = ['lugar.json', 'alturas-cerca.png', 'alturas-medio.png', 'alturas-finca.png', 'alturas-lejos.png', 'costa.png', 'orto-cerca-4096.webp', 'orto-finca-2048.webp', 'orto-lejos-2048.webp', 'vista-mar-1600.webp'].reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0) + fs.statSync(path.join(RAIZ, 'vendor/three-0.160.0.module.min.js')).size;
const pesoMov = ['lugar.json', 'alturas-cerca.png', 'alturas-medio.png', 'alturas-finca.png', 'alturas-lejos.png', 'costa.png', 'orto-cerca-2048.webp', 'orto-finca-1024.webp', 'orto-lejos-2048.webp', 'vista-mar-960.webp'].reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0) + fs.statSync(path.join(RAIZ, 'vendor/three-0.160.0.module.min.js')).size;
console.log(`       lo que baja el 3D: escritorio ${(pesoEsc / 1048576).toFixed(2)} MB · móvil ${(pesoMov / 1048576).toFixed(2)} MB (Three.js incluido, sin gzip)`);
const C = meta.rasters.cerca;
const dentro = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
ok(dentro(meta.rasters.finca, meta.horreo.x, meta.horreo.z), 'el hórreo cae dentro del relieve de la finca');
ok(meta.edificios.some((e) => e.tipo === 'casona') && meta.edificios.some((e) => e.tipo === 'roja'), 'hay casona y casa roja');
for (const lu of meta.lugares) {
  if (lu.clave === 'picos') { ok(lu.z > 20000 && lu.z < 35000 && Math.abs(lu.x) < 20000, 'Picos de Europa al sur, a ' + (lu.z / 1000).toFixed(1) + ' km'); continue; }
  if (lu.clave === 'mar') { ok(lu.z < C.z0 + 1000 || lu.z < -3000, 'rótulo del mar sobre el mar'); continue; }
  ok(dentro(C, lu.x, lu.z), `${lu.nombre} dentro del relieve cercano (${lu.x.toFixed(0)}, ${lu.z.toFixed(0)}) [${lu.osm || lu.nota}]`);
}
const rib = meta.lugares.find((x) => x.clave === 'ribadesella'), gua = meta.lugares.find((x) => x.clave === 'guadamia');
ok(rib.x < -2500 && gua.x > 1500, 'Ribadesella al oeste y Guadamía/bufones al este de la casa (OSM)');
ok(Array.isArray(meta.arboles) && meta.arboles.length > 200, `árboles: ${meta.arboles.length}`);

/* ---------- 3. plan B en el navegador, sin WebGL ---------- */
if (process.argv.includes('--sin-navegador')) { console.log(`
${bien} bien, ${fallos} mal (sin navegador)`); process.exit(fallos ? 1 : 0); }
console.log('3. plan B en Chromium sin WebGL');
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(PUERTO, r));
const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
try {
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const ctxB = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctxB.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('requestfailed', (r) => errores.push('falla ' + r.url()));
    await page.goto(`http://localhost:${PUERTO}/scripts/lugar-prueba.html`);
    await page.waitForFunction(() => document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
    await page.locator('#lugar').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.lugar__vista .lugar__marca').length > 0, null, { timeout: 8000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.lugar__planob img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-modulo="lugar"]');
      const pista = el.querySelector('.lugar__pista');
      const vis = (s) => { const n = el.querySelector(s); return !!n && n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== 'none'; };
      return {
        modo: el.dataset.modo, est: window.__lugar.estado(), pistaVisible: getComputedStyle(pista).display !== 'none',
        planob: vis('.lugar__planob'), vista: vis('.lugar__vista img'), finca: vis('.lugar__finca img'),
        marcasVista: [...el.querySelectorAll('.lugar__vista .lugar__marca')].filter((m) => !m.hidden).map((m) => m.textContent),
        marcasFinca: [...el.querySelectorAll('.lugar__finca .lugar__marca')].map((m) => m.textContent),
        pasos: el.querySelectorAll('.lugar__pasos li').length, ahora: el.querySelector('[data-l="ahora2d"]').textContent,
        boton: !el.querySelector('[data-l="a3d"]').hidden, lienzo: !!el.querySelector('canvas'),
        anchoDoc: document.documentElement.scrollWidth, anchoVista: innerWidth,
      };
    });
    console.log(`   ${w}×${h}`);
    ok(r.modo === 'plano' && !r.pistaVisible && !r.lienzo, 'plan B, sin pista y sin lienzo (no se pinta WebGL)');
    ok(r.planob && r.vista && r.finca, 'se ven la vista desde el mar y la finca');
    ok(r.marcasVista.length >= (w > 800 ? 5 : 3), 'marcas en la vista: ' + r.marcasVista.join(' · '));
    ok(r.marcasFinca.length === 3, 'marcas en la finca: ' + r.marcasFinca.join(' · '));
    ok(r.pasos === 4 && /Ribadesella/.test(r.ahora), 'cuatro paradas y el cielo de ahora');
    ok(!r.boton, 'sin botón 3D cuando no hay WebGL');
    ok(r.anchoDoc <= r.anchoVista, `sin scroll horizontal (${r.anchoDoc} ≤ ${r.anchoVista})`);
    if (w === 1280) {
      // alturas: la casa debe quedar a ~50-60 m y el mar en negativo (decodificación del PNG en canvas 2D)
      const alt = await page.evaluate(async () => {
        const m = await (await fetch('../img/lugar/lugar.json')).json();
        const dec = async (r) => {
          const b = await (await fetch('../img/lugar/' + r.archivo)).blob();
          const bmp = await createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
          const at = (x, z) => { const i = Math.round((x - r.x0) / (r.x1 - r.x0) * (c.width - 1)), j = Math.round((z - r.z0) / (r.z1 - r.z0) * (c.height - 1)); const k = (j * c.width + i) * 4; return (d[k] * 256 + d[k + 1]) / 10 - 100; };
          return { at, w: c.width, h: c.height };
        };
        const f = await dec(m.rasters.finca), c = await dec(m.rasters.cerca), l = await dec(m.rasters.lejos);
        return { casa: f.at(0, 0), horreo: f.at(m.horreo.x, m.horreo.z), mar: c.at(0, -3500), picos: l.at(4061, 26798), dims: [f.w, f.h, m.rasters.finca.w, m.rasters.finca.h] };
      });
      ok(alt.dims[0] === alt.dims[2] && alt.dims[1] === alt.dims[3], 'tamaño del PNG de alturas = el del JSON');
      ok(alt.casa > 40 && alt.casa < 75, `altura en la casa: ${alt.casa.toFixed(1)} m`);
      ok(Math.abs(alt.horreo - meta.horreo.suelo) < 1.5, `altura en el hórreo: ${alt.horreo.toFixed(1)} m`);
      ok(alt.mar < 0, `el mar, en negativo: ${alt.mar.toFixed(1)} m`);
      ok(alt.picos > 2200, `Peña Santa en el anillo lejano: ${alt.picos.toFixed(0)} m`);
      // destruir repone el respaldo
      const rep = await page.evaluate(() => { window.__lugar.destruir(); const el = document.querySelector('[data-modulo="lugar"]'); return { resp: !!el.querySelector('figure.respaldo'), clase: el.classList.contains('lugar') }; });
      ok(rep.resp && !rep.clase, 'destruir() repone el HTML de respaldo');
    }
    ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await ctxB.close();
  }

  /* ---------- 4. la escena 3D se construye y se recorre, SIN WebGL ----------
     Three.js real, pero con un WebGLRenderer falso que no pinta (solo cuenta triángulos). Así se prueban
     el montaje de la escena, el recorrido, los rótulos y las paradas sin gastar CPU en swiftshader.
     Los shaders (GLSL) NO se compilan aquí: eso solo se ve en el Chrome de Álvaro. */
  console.log('4. escena 3D con renderizador falso (no pinta)');
  const ENVOLTORIO = `import * as T from '/vendor/three-0.160.0.module.min.js?real';
export * from '/vendor/three-0.160.0.module.min.js?real';
export class WebGLRenderer {
  constructor(o) { this.domElement = o.canvas; this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    this.capabilities = { getMaxAnisotropy: () => 8 }; this.info = { render: { triangles: 0, calls: 0 } }; this._pr = 1; window.__pintadas = 0; }
  setPixelRatio(v) { this._pr = v; } getPixelRatio() { return this._pr; } setSize() {} compile() {}
  render(esc, cam) {
    window.__pintadas++; let tri = 0, calls = 0;
    esc.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.visible && o.geometry) { calls++; const g = o.geometry; const n = g.index ? g.index.count : g.attributes.position.count; tri += n / 3 * (o.isInstancedMesh ? o.count : 1);
      const pa = g.attributes.position && g.attributes.position.array; if (pa && !window.__nan) { for (let i = 0; i < pa.length; i += 97) if (!Number.isFinite(pa[i])) { window.__nan = (o.name || o.type) + ' ' + i; break; } } } });
    this.info.render.triangles = tri; this.info.render.calls = calls;
    if (![cam.position.x, cam.position.y, cam.position.z].every(Number.isFinite)) throw new Error('cámara con NaN');
    window.__cam = [cam.position.x, cam.position.y, cam.position.z, cam.near, cam.fov];
  }
  dispose() {} forceContextLoss() {}
}`;
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx3.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Lugar/.test(m.text()))) errores.push(m.text()); });
  await page.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'),
    (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO }));
  await page.goto(`http://localhost:${PUERTO}/scripts/lugar-prueba.html?lugar=3d`);
  await page.waitForFunction(() => window.__lugar && window.__lugar.estado().t3 && window.__pintadas > 0, null, { timeout: 30000 });
  const e0 = await page.evaluate(() => ({ est: window.__lugar.estado(), modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, nan: window.__nan || null, listo: document.querySelector('.lugar__escenario').classList.contains('lugar--listo') }));
  ok(e0.modo === '3d' && e0.listo, 'modo 3D montado y primer fotograma «pintado»');
  ok(!e0.nan, 'ninguna geometría con NaN' + (e0.nan ? ': ' + e0.nan : ''));
  console.log('       triángulos', Math.round(e0.est.t3.triangulos), '· objetos', e0.est.t3.llamadas, '· ventanas', e0.est.t3.ventanas, '· árboles', e0.est.t3.arboles);
  ok(e0.est.t3.triangulos > 100000 && e0.est.t3.triangulos < 2500000, 'triángulos en un rango razonable');
  const tramos = [[0, ['Mar Cantábrico', 'Picos de Europa'], 'Desde el mar'], [0.32, [], 'Los acantilados'], [0.6, ['Amaicha'], 'Camango'], [0.995, ['El hórreo'], 'La finca']];
  for (const [p, esperados, parada] of tramos) {
    await page.evaluate((p) => { const pista = document.querySelector('.lugar__pista'); const esc = document.querySelector('.lugar__escenario');
      const y0 = pista.getBoundingClientRect().top + scrollY; scrollTo(0, y0 + p * (pista.offsetHeight - esc.offsetHeight)); }, p);
    await page.waitForFunction((p) => { const t = window.__lugar.estado().t3; return t && Math.abs(t.pVis - p) < 0.004; }, p, { timeout: 15000 });
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), par: (document.querySelector('.lugar__paradas li.es-actual b') || {}).textContent, cam: window.__cam }));
    const faltan = esperados.filter((x) => !r.rot.includes(x));
    ok(faltan.length === 0 && r.par === parada, `p=${p}: parada «${r.par}», rótulos: ${r.rot.join(' · ') || '(ninguno)'} · cámara a ${r.cam[1].toFixed(0)} m, near ${r.cam[3].toFixed(2)}`);
  }
  await page.waitForTimeout(1500);
  const fin = await page.evaluate(() => { const a = window.__pintadas; return new Promise((res) => setTimeout(() => res(window.__pintadas - a), 600)); });
  ok(fin < 8, `al final, quieto, casi no repinta (${fin} en 0,6 s; el mar ya no se ve)`);
  await page.evaluate(() => document.querySelector('[data-l="aplano"]').click());
  const pl = await page.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden }));
  ok(pl.modo === 'plano' && pl.boton, '«Ver en plano» vuelve al plan B y ofrece volver al 3D');
  const rep = await page.evaluate(() => { window.__lugar.destruir(); return !!document.querySelector('[data-modulo="lugar"] figure.respaldo'); });
  ok(rep, 'destruir() con el 3D montado repone el respaldo');
  ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await ctx3.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(`\n${bien} bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);
