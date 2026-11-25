/* Genera las páginas a partir de sus fuentes *.src.html (la arquitectura de Casa Benito y A Palleira):
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo (si falta, un comentario y la web sigue).
   2. Una sola fuente de datos, data/amaicha.json (de ref/DATOS-AMAICHA.md):
        · <!--formas--> las tres fichas (cifras, servicios con icono, condiciones) y su selector;
        · <!--vistazo--> la tabla «De un vistazo» (solo en la versión sobria);
        · <!--desayuno-lista-->, <!--estancias--> (la casa por estancias) y <!--resenas-->.
   3. <!--alrededor--> y <!--llegar-->: las distancias de ref/raw/rutas.json (OSRM, scripts/alrededor-rutas.mjs). Sin el
      fichero no se escribe ninguna cifra.
   4. La greca (marca/greca.json, de scripts/marca-greca.py): <!--greca-portada--> (el respaldo de la portada),
      <!--greca-pie--> (el logo del pie, por piezas) y {{GRECA}} (el JSON para js/portada.js).
   5. <img data-foto="nombre" ...> → <picture> con AVIF, WebP y JPG en todos los anchos de img/fotos/fotos.json.
      <!--precarga-portada--> → <link rel="preload"> de la foto de la portada (el LCP).
   6. Los <link>/<script> de CSS/JS propios que no existen se quitan con un aviso, SALVO los del 3D (css/lugar.css y
      js/lugar.js, del agente Lugar 3D): esos se dejan siempre, para que en cuanto existan se carguen sin reconstruir.
   7. Ejecuta versionar.mjs (?v=<huella> en CSS y JS).
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
const FOTOS = new Map(leerJson('img/fotos/fotos.json').map((f) => [f.nombre, f]));
const D = leerJson('data/amaicha.json');
const G = leerJson('marca/greca.json');
const num = (n) => String(n).replace('.', ',');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const r3 = (v) => { const s = (Math.round(v * 1000) / 1000).toString(); return s === '-0' ? '0' : s; };

/* ---------- fotos ---------- */
const sets = (nombre) => {
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  return { f, set };
};
function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const { f, set } = sets(nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  const foco = f.foco ? ` style="object-position:${(f.foco[0] * 100).toFixed(1)}% ${(f.foco[1] * 100).toFixed(1)}%"` : '';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${foco}${resto}>`
    + `</picture>`;
}
function precarga(html) {
  const m = /<img\b[^>]*data-foto="horreo"[^>]*>/.exec(html);
  if (!m) return html.replace('<!--precarga-portada-->', '');
  const sizes = /\bsizes="([^"]+)"/.exec(m[0])[1];
  const { set } = sets('horreo');
  return html.replace('<!--precarga-portada-->', `<link rel="preload" as="image" type="image/avif" imagesrcset="${set('avif')}" imagesizes="${sizes}" fetchpriority="high">`);
}
const razon = (n) => { const f = FOTOS.get(n); return (f.ancho / f.alto).toFixed(3); };

/* ---------- la greca ---------- */
const rect = (x0, y0, x1, y1, inv) => { const p = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; if (inv) p.reverse(); return 'M' + p.map(([x, y]) => r3(x) + ' ' + r3(y)).join(' ') + 'Z'; };
const anillo = (r0, r1) => rect(-r1, -r1, r1, r1) + rect(-r0, -r0, r0, r0, true);
const ganchos = () => G.rects.map((r) => rect(...r)).join('');
const macizo = () => { const h = G.macizo, p = G.punto; return rect(-h, -h, h, h) + `M${r3(p)} 0A${r3(p)} ${r3(p)} 0 0 0 ${r3(-p)} 0A${r3(p)} ${r3(p)} 0 0 0 ${r3(p)} 0Z`; };
const VB = `${r3(-G.semi.ancho)} ${r3(-G.semi.alto)} ${r3(2 * G.semi.ancho)} ${r3(2 * G.semi.alto)}`;
function grecaPortada() {
  const [[mi, mo], [a, E]] = G.anillos;
  return `      <svg class="portada__marco" viewBox="${VB}" aria-hidden="true" focusable="false"><g transform="rotate(45)">`
    + `<path class="pg-fuera" d="${anillo(a, E)}${ganchos()}"/>`
    + `<path class="pg-medio" d="${anillo(mi, mo)}"/>`
    + `<path class="pg-centro" d="${macizo()}"/></g></svg>`;
}
function grecaPie() {
  const [[mi, mo], [a, E]] = G.anillos;
  return `        <svg class="pie__greca" viewBox="${VB}" aria-hidden="true" focusable="false">`
    + `<g class="pg pg-1"><path transform="rotate(45)" d="${anillo(a, E)}${ganchos()}"/></g>`
    + `<g class="pg pg-2"><path transform="rotate(45)" d="${anillo(mi, mo)}"/></g>`
    + `<g class="pg pg-3"><path transform="rotate(45)" d="${macizo()}"/></g></svg>`;
}
// la ventana del respaldo: el rombo de dentro del anillo de fuera, en % de la caja de la greca
const ventanaVars = () => {
  const a = G.anillos[1][0] + 0.12;
  const sx = (a * Math.SQRT2) / G.semi.ancho * 100, sy = (a * Math.SQRT2) / G.semi.alto * 100;
  return `--g-razon:${r3(G.semi.ancho / G.semi.alto)};--v-an:${sx.toFixed(2)}%;--v-al:${sy.toFixed(2)}%`;
};

/* ---------- formas de quedarse ---------- */
const TAB = { hotel: ['8', 'habitaciones'], apartamentos: ['2', 'apartamentos'], casa: ['1', 'casona entera'] };
function formas() {
  const sel = `    <div class="formas__sel" role="tablist" aria-label="Formas de quedarse">\n` + D.formas.map((f, i) => `      <button type="button" role="tab" id="tab-${f.id}" aria-controls="forma-${f.id}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}><span class="formas__n cifra">${TAB[f.id][0]}</span><b>${esc(f.nombre)}</b><small>${TAB[f.id][1]}</small></button>`).join('\n') + '\n    </div>';
  const fichas = D.formas.map((f) => `    <article class="forma" id="forma-${f.id}" role="tabpanel" aria-labelledby="t-forma-${f.id}" data-forma="${f.id}">
      <figure class="forma__f"><button type="button" class="foto-btn" data-visor="${f.foto}" data-grupo="formas" aria-label="Ver más grande: ${esc(f.fotoAlt)}"><img data-foto="${f.foto}" alt="${esc(f.fotoAlt)}" sizes="(max-width: 899px) 92vw, 46vw"></button></figure>
      <div class="forma__cuerpo">
        <p class="forma__tipo">${esc(f.nombre)}</p>
        <h3 class="forma__tit" id="t-forma-${f.id}">${esc(f.titulo)}</h3>
        <p class="forma__txt">${esc(f.texto)}</p>
        <dl class="forma__cifras">
${f.cifras.map((c) => `          <div><dt>${esc(c.t)}</dt><dd class="cifra">${esc(c.v)}</dd></div>`).join('\n')}
        </dl>
        <ul class="forma__serv">
${f.servicios.map((s) => `          <li><svg class="ico" aria-hidden="true"><use href="#i-${s.icono}"/></svg><b>${esc(s.nombre)}</b>${s.detalle ? `<span>${esc(s.detalle)}</span>` : ''}</li>`).join('\n')}
        </ul>
        <div class="forma__cond">
          <h4>Condiciones</h4>
          <ul>${f.condiciones.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>
        <a class="btn btn--oscuro" href="#reservar" data-reservar="${f.id}">Ver fechas<span class="vh">: ${esc(f.nombre.toLowerCase())}</span></a>
      </div>
    </article>`).join('\n');
  return sel + '\n    <div class="formas">\n' + fichas + '\n    </div>';
}
function vistazo() {
  const filas = [
    ['Qué es', 'Una habitación de la casona', 'Un apartamento independiente', 'La casona entera'],
    ['Dormitorios', '7 dobles y 1 individual, a elegir', '2 dobles en cada uno', '7 dobles y 1 individual'],
    ['Personas', 'Según la habitación', 'Hasta 4 por apartamento', 'Por confirmar'],
    ['Baño', 'Privado en cada habitación', 'Completo, con ventana', 'Privado en cada habitación'],
    ['Cocina', 'No consta', 'Totalmente equipada', 'Equipada'],
    ['Fuera', 'El jardín', 'Terraza privada y jardín común', 'El jardín'],
    ['Animales', 'No consta', 'Pregunta antes', 'No se admiten'],
    ['Cancelación', 'La de su motor', 'La de su motor', 'Gratis hasta 30 días antes'],
  ];
  return `    <div class="vistazo" id="vistazo">
      <h3 class="vistazo__tit">De un vistazo</h3>
      <div class="vistazo__caja" role="group" aria-label="Tabla comparativa de las tres formas de quedarse">
        <table class="vistazo__tabla">
          <caption class="vh">Hotel, apartamentos y casa entera comparados</caption>
          <thead><tr><th scope="col"><span class="vh">Dato</span></th><th scope="col">Hotel</th><th scope="col">Apartamentos</th><th scope="col">Casa entera</th></tr></thead>
          <tbody>
${filas.map(([h, ...c]) => `            <tr><th scope="row">${h}</th>${c.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ---------- desayuno, estancias y reseñas ---------- */
const desayunoLista = () => `      <ul class="desayuno__lista">\n${D.desayuno.map((d) => `        <li>${esc(d[0].toUpperCase() + d.slice(1))}</li>`).join('\n')}\n      </ul>`;
function estancias() {
  const ind = `    <nav class="estancias__indice" aria-label="Estancias de la casa">
      <ol>
${D.estancias.map((e, i) => `        <li><a href="#est-${e.id}" data-est="${e.id}"${i === 0 ? ' aria-current="true"' : ''}><span class="estancias__largo">${esc(e.nombre)}</span><span class="estancias__corto" aria-hidden="true">${esc(e.corto)}</span><span class="estancias__n cifra" aria-hidden="true">${e.fotos.length}</span></a></li>`).join('\n')}
      </ol>
    </nav>`;
  const grupos = D.estancias.map((e) => `      <section class="estancia" id="est-${e.id}" aria-labelledby="t-est-${e.id}">
        <h3 class="estancia__tit" id="t-est-${e.id}">${esc(e.nombre)}</h3>
        <p class="estancia__txt">${esc(e.texto)}</p>
        <div class="filas">
${e.fotos.map((f) => `          <figure class="foto" style="--r:${razon(f.n)}"><button type="button" class="foto-btn" data-visor="${f.n}" data-grupo="casa" aria-label="Ver más grande: ${esc(f.alt)}"><img data-foto="${f.n}" alt="${esc(f.alt)}" sizes="(max-width: 699px) 92vw, (max-width: 1099px) 46vw, 30vw"></button></figure>`).join('\n')}
        </div>
      </section>`).join('\n');
  return `    <div class="estancias">\n${ind}\n      <div class="estancias__grupos">\n${grupos}\n      </div>\n    </div>`;
}
function resenas() {
  const R = D.resenas;
  return `    <div class="resenas__in">
      <p class="resenas__nota" aria-hidden="true"><span class="cifra">${R.nota}</span><span class="resenas__sobre">sobre 10</span></p>
      <div class="resenas__txt">
        <h2 id="t-resenas" class="sec-tit" data-aparece>${esc(R.etiqueta)}, en ${R.fuente}</h2>
        <p class="resenas__dato"><span class="vh">Nota de ${R.nota} sobre 10, </span>con <span class="cifra">${R.recuento}</span> reseñas en su ficha de ${R.fuente}.</p>
        <ul class="resenas__tipos" aria-label="Nota por forma de quedarse, como la enseña su web">
${R.porTipo.map((t) => `          <li><span>${esc(t.tipo)}</span><b class="cifra">${t.nota}</b></li>`).join('\n')}
        </ul>
        <p><a class="btn btn--oscuro" href="${esc(R.ficha)}" target="_blank" rel="noopener">Leer las reseñas en Google<span class="vh"> (se abre en otra pestaña)</span></a></p>
      </div>
    </div>`;
}

/* ---------- alrededor (ref/raw/rutas.json) ---------- */
function leerRutas() {
  const f = path.join(RAIZ, 'ref/raw/rutas.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
const tiempo = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');
const km = (v) => num(Math.round(v * 10) / 10) + ' km';
const GRUPOS = [['costa', 'La costa', 'Acantilados, playa y bufones'], ['pueblos', 'Los pueblos', 'Ribadesella y Llanes'], ['picos', 'Los Picos de Europa', 'Por Cangas de Onís'], ['aeropuertos', 'Aeropuertos', 'Para llegar']];
function alrededor() {
  const R = leerRutas();
  if (!R) { console.warn('  (sin ref/raw/rutas.json: «Alrededor» va sin distancias)'); return '    <p class="alrededor__fino" data-sin-rutas>Las distancias por carretera están por calcular.</p>'; }
  const fecha = new Date(R.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const cols = GRUPOS.map(([g, tit, sub], i) => {
    const ids = R.llegar.filter((id) => R.destinos[id].grupo === g);
    return `      <section class="esc esc--${i + 1}" aria-labelledby="t-esc-${g}">
        <h3 class="esc__tit" id="t-esc-${g}">${tit}<small>${sub}</small></h3>
        <ol class="esc__lista">
${ids.map((id) => { const d = R.destinos[id]; const c = d.desde_casa; const p = d.a_pie; return `          <li data-ruta="${id}"><b>${esc(d.nombre)}</b><span class="esc__coche"><svg class="ico" aria-hidden="true"><use href="#i-coche"/></svg><span class="cifra">${tiempo(c.minutos)}</span><span class="cifra esc__km">${km(c.km)}</span></span>${p ? `<span class="esc__pie"><svg class="ico" aria-hidden="true"><use href="#i-pie"/></svg><span class="vh">A pie: </span><span class="cifra">${tiempo(p.minutos)}</span><span class="cifra esc__km">${km(p.km)}</span></span>` : ''}</li>`; }).join('\n')}
        </ol>
      </section>`;
  }).join('\n');
  const rib = R.destinos.ribadesella;
  return `    <div class="alrededor__in">
      <figure class="alrededor__f"><button type="button" class="foto-btn" data-visor="aereo" data-grupo="alrededor" aria-label="Ver más grande: vista aérea de prados y bosque con el mar al fondo"><img data-foto="aereo" alt="Vista aérea de prados, bosques y casas con el mar al fondo" sizes="(max-width: 899px) 92vw, 40vw"></button></figure>
      <div class="escalera">
${cols}
      </div>
    </div>
    <p class="alrededor__fino">En coche, por carretera; a pie, por caminos. Calculado con OSRM sobre datos de © colaboradores de OpenStreetMap el ${fecha}: tiempos sin tráfico ni paradas, orientativos. Al centro de Ribadesella hay ${km(rib.desde_casa.km)} por carretera (${km(rib.recta_km)} en línea recta).</p>`;
}
function llegar() {
  const R = leerRutas();
  if (!R) return '';
  const d = R.destinos;
  return `      <p class="contacto__ruta">Desde Ribadesella, <span class="cifra">${km(d.ribadesella.desde_casa.km)}</span> y <span class="cifra">${tiempo(d.ribadesella.desde_casa.minutos)}</span> en coche; desde Llanes, <span class="cifra">${km(d.llanes.desde_casa.km)}</span> y <span class="cifra">${tiempo(d.llanes.desde_casa.minutos)}</span>. El aeropuerto de Asturias queda a <span class="cifra">${tiempo(d.ovd.desde_casa.minutos)}</span> y el de Santander a <span class="cifra">${tiempo(d.sdr.desde_casa.minutos)}</span>.</p>`;
}
function mapa(html) {
  const R = leerRutas();
  const q = R ? `${R.casa.lat.toFixed(6)},${R.casa.lon.toFixed(6)}` : 'Hotel Rural Amaicha, Camango 44, 33568 Ribadesella, Asturias';
  return html.replace('<div class="mapa" id="mapa">', `<div class="mapa" id="mapa" data-q="${esc(q)}">`);
}

/* ---------- partes y ausentes ---------- */
const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});
const DEL_3D = new Set(['css/lugar.css', 'js/lugar.js']);
const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (DEL_3D.has(r) || fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (DEL_3D.has(r) || fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));

for (const r of DEL_3D) if (!fs.existsSync(path.join(RAIZ, r))) console.warn(`  (aún no está ${r}, del agente Lugar 3D: la etiqueta se queda y la página usa el respaldo)`);
const datosGreca = () => JSON.stringify({ ...G, foco: FOTOS.get('horreo').foco || [0.5, 0.5], foto: { ancho: FOTOS.get('horreo').ancho, alto: FOTOS.get('horreo').alto } }).replace(/</g, '\\u003c');

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  html = html.replace('{{GRECA}}', datosGreca)
    .replace('<!--greca-portada-->', grecaPortada)
    .replace('<div class="portada__greca" data-modulo="portada">', () => `<div class="portada__greca" data-modulo="portada" style="${ventanaVars()}">`)
    .replace('<!--greca-pie-->', grecaPie)
    .replace('<!--formas-->', formas)
    .replace('<!--vistazo-->', vistazo)
    .replace('<!--desayuno-lista-->', desayunoLista)
    .replace('<!--estancias-->', estancias)
    .replace('<!--resenas-->', resenas)
    .replace('<!--alrededor-->', alrededor)
    .replace('<!--llegar-->', llegar);
  if (html.includes('<div class="mapa" id="mapa">')) html = mapa(html);
  html = precarga(html);
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
