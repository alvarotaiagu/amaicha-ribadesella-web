// Datos del mapa interactivo de «Alrededor»: costa, Picos de Europa, ciudades de referencia y el TRAZADO de cada ruta.
//   node scripts/alrededor-mapa.mjs   → data/alrededor-mapa.json   (lo pide js/alrededor.js al acercarse)
// Lee ref/raw/rutas.json (cifras de OSRM, scripts/alrededor-rutas.mjs): aquí solo se añaden las líneas.
// Fuentes: OpenStreetMap (ODbL) vía Overpass; rutas de OSRM (coche) y routing.openstreetmap.de (a pie).
// Proyección: metros alrededor de la casa (equirrectangular con cos(lat) de la casa); x al este, y al SUR (como SVG).
// Caché de las descargas en ref/raw/mapa-cache/ (se puede borrar para rehacer).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, dormir, UA } from './alrededor-util.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, 'ref/raw/mapa-cache');
fs.mkdirSync(CACHE, { recursive: true });
const R = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), 'utf8'));
const CASA = R.casa;

const RAD = Math.PI / 180, KX = 111320 * Math.cos(CASA.lat * RAD), KY = 110574;
const P = ([lon, lat]) => [(lon - CASA.lon) * KX, -(lat - CASA.lat) * KY];

async function cacheado(nombre, fn) {
  const f = path.join(CACHE, nombre);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const j = await fn();
  fs.writeFileSync(f, JSON.stringify(j));
  return j;
}
async function pedir(url) {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }); if (r.ok) { const j = await r.json(); if (j.code === 'Ok') return j; } } catch (e) { /* reintenta */ }
    await dormir(2500);
  }
  throw new Error('falla ' + url);
}

// ---------- geometría ----------
function simplificar(pts, tol) {               // Ramer–Douglas–Peucker iterativo
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]], t2 = tol * tol;
  while (pila.length) {
    const [a, b] = pila.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let max = -1, im = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > max) { max = d; im = i; }
    }
    if (max > t2) { keep[im] = 1; pila.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// camino SVG compacto: M absoluto y luego l relativos, con la precisión que pida el nivel de detalle
function camino(pts, dec = 0, cerrar = false) {
  const f = 10 ** dec, r = (v) => Math.round(v * f) / f;
  let s = 'M' + r(pts[0][0]) + ' ' + r(pts[0][1]), px = r(pts[0][0]), py = r(pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const x = r(pts[i][0]), y = r(pts[i][1]), dx = r(x - px), dy = r(y - py);
    if (!dx && !dy) continue;
    s += 'l' + dx + (dy < 0 ? '' : ' ') + dy; px = x; py = y;
  }
  return s.replace(/ -/g, '-') + (cerrar ? 'z' : '');
}
const dentro = ([x, y], c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1;
const caja = (o, s, e, n) => { const [x0, y1] = P([o, s]), [x1, y0] = P([e, n]); return { x0, x1, y0, y1 }; };

// ---------- costa: une las vías de natural=coastline en cadenas ----------
const BB = { s: 43.0, o: -6.55, n: 43.85, e: -2.35 };   // holgada: la vista de Bilbao no puede salirse por el este
const costaOSM = await cacheado('costa.json', () => overpass(`[out:json][timeout:180];way["natural"="coastline"](${BB.s},${BB.o},${BB.n},${BB.e});out geom;`, { timeout: 200000 }));
const clave = (p) => p.lon.toFixed(7) + ',' + p.lat.toFixed(7);
let trozos = costaOSM.elements.filter((w) => w.geometry).map((w) => w.geometry.slice());
const cadenas = [];
while (trozos.length) {
  let c = trozos.pop(), creció = true;
  while (creció) {
    creció = false;
    for (let i = 0; i < trozos.length; i++) {
      const t = trozos[i];
      if (clave(t[0]) === clave(c[c.length - 1])) { c = c.concat(t.slice(1)); trozos.splice(i, 1); creció = true; break; }
      if (clave(t[t.length - 1]) === clave(c[0])) { c = t.concat(c.slice(1)); trozos.splice(i, 1); creció = true; break; }
    }
  }
  cadenas.push(c);
}
const abiertas = cadenas.filter((c) => clave(c[0]) !== clave(c[c.length - 1])).sort((a, b) => b.length - a.length);
const islas = cadenas.filter((c) => clave(c[0]) === clave(c[c.length - 1]) && c.length > 6);
const tierra = abiertas[0].map((p) => P([p.lon, p.lat]));   // va de este a oeste (en OSM la tierra queda a la izquierda)
console.log('costa:', costaOSM.elements.length, 'vías →', cadenas.length, 'cadenas;', abiertas.length, 'abiertas (la mayor,', tierra.length, 'puntos);', islas.length, 'islas');

// el mar de un nivel de detalle: el tramo de costa dentro de su caja, cerrado por el borde NORTE de la caja
function mar(c, tol) {
  let i0 = tierra.findIndex((p) => dentro(p, c)), i1 = tierra.length - 1 - [...tierra].reverse().findIndex((p) => dentro(p, c));
  const tramo = tierra.slice(Math.max(0, i0 - 1), Math.min(tierra.length, i1 + 2));
  const s = simplificar(tramo, tol);
  const ini = s[0], fin = s[s.length - 1];
  const anillo = s.concat([[fin[0], c.y0 - 2000], [ini[0], c.y0 - 2000]]);
  const isl = islas.map((c2) => c2.map((p) => P([p.lon, p.lat]))).filter((r) => r.some((p) => dentro(p, c))).map((r) => simplificar(r, tol)).filter((r) => r.length > 3);
  const dec = tol < 10 ? 1 : 0;
  return { caja: [c.x0, c.y0, c.x1, c.y1].map(Math.round), d: camino(anillo, dec, true), islas: isl.map((r) => camino(r, dec, true)), costa: camino(s, dec) };
}
const niveles = [
  { nombre: 'cerca', ancho_max: 9000, ...mar(caja(-5.16, 43.38, -4.70, 43.53), 4) },
  { nombre: 'medio', ancho_max: 70000, ...mar(caja(-5.40, 43.15, -4.55, 43.58), 22) },
  { nombre: 'lejos', ancho_max: Infinity, ...mar(caja(BB.o, BB.s, BB.e, BB.n), 140) },
];
niveles.forEach((n) => console.log('mar', n.nombre, Math.round(n.d.length / 1024), 'KB'));

// ---------- Picos de Europa: el parque nacional ----------
const picosOSM = await cacheado('picos.json', () => overpass('[out:json][timeout:120];relation["boundary"~"national_park|protected_area"]["name"~"Picos de Europa"](42.9,-5.4,43.4,-4.4);out geom;', { timeout: 150000 }));
console.log('picos, candidatas:', picosOSM.elements.map((e) => e.id + ' ' + e.tags.boundary + ' «' + e.tags.name + '» ' + e.members.length).join(' | '));
// el parque nacional (no la reserva de la biosfera ni los LIC): el de nombre «Parque Nacional…» o, si no, el de más vías
const rel = picosOSM.elements.find((e) => /^Parque Nacional/i.test(e.tags.name || '') || e.tags.boundary === 'national_park')
  || picosOSM.elements.sort((a, b) => b.members.length - a.members.length)[0];
if (!rel) { fs.unlinkSync(path.join(CACHE, 'picos.json')); throw new Error('sin relación de los Picos de Europa'); }
const piezas = rel.members.filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => m.geometry.slice());
const anillos = [];
while (piezas.length) {                         // une las vías exteriores en anillos
  let c = piezas.pop(), creció = true;
  while (creció) {
    creció = false;
    for (let i = 0; i < piezas.length; i++) {
      const t = piezas[i];
      if (clave(t[0]) === clave(c[c.length - 1])) { c = c.concat(t.slice(1)); piezas.splice(i, 1); creció = true; break; }
      if (clave(t[t.length - 1]) === clave(c[c.length - 1])) { c = c.concat(t.slice(0, -1).reverse()); piezas.splice(i, 1); creció = true; break; }
      if (clave(t[t.length - 1]) === clave(c[0])) { c = t.concat(c.slice(1)); piezas.splice(i, 1); creció = true; break; }
      if (clave(t[0]) === clave(c[0])) { c = t.slice(1).reverse().concat(c); piezas.splice(i, 1); creció = true; break; }
    }
  }
  anillos.push(c);
}
const picos = anillos.sort((a, b) => b.length - a.length).filter((a) => a.length > 30).map((a) => camino(simplificar(a.map((p) => P([p.lon, p.lat])), 120), 0, true)).join('');
const cumbre = await cacheado('pena-santa.json', () => overpass('[out:json][timeout:40];node["natural"="peak"]["name"~"^(Torre Cerredo|Peña Santa de Castilla)$"](43.0,-5.2,43.4,-4.6);out;'));
console.log('picos:', anillos.length, 'anillos,', Math.round(picos.length / 1024), 'KB; cumbres', cumbre.elements.map((e) => e.tags.name).join(', '));

// ---------- ciudades de referencia (solo para situarse en la vista de los aeropuertos) ----------
const QUIERO = ['Oviedo', 'Gijón', 'Avilés', 'Santander', 'Bilbao', 'Torrelavega'];
const ciudOSM = await cacheado('ciudades.json', () => overpass(`[out:json][timeout:60];node["place"~"city|town"](${BB.s},${BB.o},${BB.n},${BB.e});out;`));
const ciudades = QUIERO.map((n) => {
  const e = ciudOSM.elements.filter((x) => (x.tags.name || '').split(' / ').some((p) => p === n || p.startsWith(n))).sort((a, b) => (a.tags.place === 'city' ? -1 : 1))[0];
  if (!e) { console.warn('sin ciudad', n); return null; }
  const [x, y] = P([e.lon, e.lat]); return { nombre: n, x: Math.round(x), y: Math.round(y) };
}).filter(Boolean);

// ---------- las rutas ----------
const rutas = {};
for (const id of R.llegar) {
  const d = R.destinos[id];
  const coche = await cacheado(`coche-${id}.json`, () => pedir(`https://router.project-osrm.org/route/v1/driving/${CASA.lon},${CASA.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`));
  const largo = coche.routes[0].distance;
  const tol = Math.max(3, largo / 2500);         // ~2.500 tramos como mucho por ruta
  const pc = coche.routes[0].geometry.coordinates.map(P);
  const r = { coche: camino(simplificar(pc, tol), tol < 10 ? 1 : 0) };
  if (d.a_pie) {
    const pie = await cacheado(`pie-${id}.json`, () => pedir(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${CASA.lon},${CASA.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`));
    r.pie = camino(simplificar(pie.routes[0].geometry.coordinates.map(P), 3), 1);
  }
  const [x, y] = P([d.lon, d.lat]);
  // caja de la ruta (coche, pie y destino), para encuadrarla
  const todos = pc.concat([[x, y], [0, 0]]);
  rutas[id] = { x: Math.round(x), y: Math.round(y), caja: [Math.min(...todos.map((p) => p[0])), Math.min(...todos.map((p) => p[1])), Math.max(...todos.map((p) => p[0])), Math.max(...todos.map((p) => p[1]))].map(Math.round), ...r };
  console.log(id.padEnd(12), Math.round(largo / 1000), 'km;', Math.round(r.coche.length / 1024 * 10) / 10, 'KB', r.pie ? '+ a pie' : '');
  await dormir(700);
}

const salida = {
  fuente: 'Costa, Picos de Europa, ciudades y caminos: © colaboradores de OpenStreetMap (ODbL). Rutas: OSRM (coche) y routing.openstreetmap.de (a pie).',
  fecha: R.fecha,
  casa: { lat: CASA.lat, lon: CASA.lon },
  niveles, picos,
  cumbres: cumbre.elements.map((e) => { const [x, y] = P([e.lon, e.lat]); return { nombre: e.tags.name, x: Math.round(x), y: Math.round(y) }; }),
  ciudades, rutas,
};
fs.mkdirSync(path.join(RAIZ, 'data'), { recursive: true });
const txt = JSON.stringify(salida);
fs.writeFileSync(path.join(RAIZ, 'data/alrededor-mapa.json'), txt);
console.log('data/alrededor-mapa.json', Math.round(txt.length / 1024), 'KB');
