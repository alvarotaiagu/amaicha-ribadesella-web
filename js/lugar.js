/* ------------------------------------------------------------------
   Amaicha · lugar.js · «Del acantilado al hórreo»
   window.Amaicha.lugar.montar(el, { movimiento, densidad, webgl }) → { destruir() }

   Un recorrido en 3D que se mueve con el scroll: la cámara sale del
   Cantábrico frente a los acantilados con los Picos de Europa al fondo,
   cruza la costa, pasa por Camango, baja a la finca y acaba girando
   despacio alrededor del hórreo con la casona detrás.
   - Relieve MDT05/MDT25 y ortofoto PNOA del IGN (CC BY 4.0), edificios
     sobre su planta del Catastro, hórreo situado en la ortofoto, lugares
     de OpenStreetMap comprobados (scripts/lugar-datos.py).
   - El sol, la luna y la luz de este momento en Ribadesella (cálculo
     local, fórmulas de SunCalc). De noche, luces en las ventanas.
   - Three.js 0.160.0, copia propia en vendor/, pedido con import() solo
     cuando hace falta.
   - Plan B en el mismo hueco (sin WebGL, movimiento reducido, «sobria»,
     ahorro de datos, móvil antes de pulsar el botón, Playwright): la vista
     desde el mar dibujada con los mismos datos + la finca desde el aire.
   El HTML que trae `el` es el respaldo: se guarda y se repone al destruir.
   Parámetros: ?fps (fotogramas), ?sin-webgl (plan B), ?lugar=3d (fuerza
   el 3D aunque el navegador sea automatizado).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var A = (window.Amaicha = window.Amaicha || {});
  if (A.lugar && A.lugar.montar) return;

  var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var RAIZ = SCRIPT ? new URL('../', SCRIPT).href : (typeof location !== 'undefined' ? new URL('./', location.href).href : './');
  var BASE = RAIZ + 'img/lugar/';
  var THREE_URL = RAIZ + 'vendor/three-0.160.0.module.min.js';
  var LAT = 43.4434463, LON = -5.0125288, TZ = 'Europe/Madrid', RAD = Math.PI / 180;

  /* ============ utilidades ============ */
  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (a, b, x) { var t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var hexA = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); };
  var mezcla = function (a, b, t) { var x = hexA(a), y = hexA(b); return '#' + x.map(function (v, i) { return pad(Math.round(lim(lerp(v, y[i], t), 0, 255)).toString(16)); }).join(''); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  var rumbo = function (az) { return RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8]; };

  /* ============ el sol y la luna (fórmulas de SunCalc, V. Agafonkin) ============ */
  var J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  var dias = function (f) { return f.valueOf() / 864e5 - 0.5 + J1970 - J2000; };
  var ascRec = function (l, b) { return Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)); };
  var declin = function (l, b) { return Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)); };
  var sideral = function (d) { return RAD * (280.16 + 360.9856235 * d) - RAD * -LON; };
  function altAz(H, dec) {
    var phi = RAD * LAT;
    return {
      alt: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD,
      az: (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360, // desde el norte, hacia el este
    };
  }
  function solCoords(d) {
    var M = RAD * (357.5291 + 0.98560028 * d);
    var L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
    return { dec: declin(L, 0), ra: ascRec(L, 0) };
  }
  function lunaCoords(d) {
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
    return { ra: ascRec(l, b), dec: declin(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }
  function sol(f) { var d = dias(f), c = solCoords(d); return altAz(sideral(d) - c.ra, c.dec); }
  function luna(f) {
    var d = dias(f), m = lunaCoords(d), s = solCoords(d), p = altAz(sideral(d) - m.ra, m.dec);
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
    var ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { alt: p.alt, az: p.az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  }
  function nombreFase(f) {
    if (f < 0.03 || f >= 0.97) return 'nueva';
    if (f < 0.22) return 'creciente';
    if (f < 0.28) return 'en cuarto creciente';
    if (f < 0.47) return 'gibosa creciente';
    if (f < 0.53) return 'llena';
    if (f < 0.72) return 'gibosa menguante';
    if (f < 0.78) return 'en cuarto menguante';
    return 'menguante';
  }
  var fmtHora = null;
  function horaRibadesella(f) {
    try {
      fmtHora = fmtHora || new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      return fmtHora.format(f);
    } catch (e) { return pad(f.getHours()) + ':' + pad(f.getMinutes()); }
  }
  // la frase del cielo de ahora (se dice igual en el 3D y en el plano)
  function fraseCielo(f) {
    var s = sol(f), l = luna(f), h = horaRibadesella(f);
    if (s.alt > 0) return 'Ahora en Ribadesella son las ' + h + ' y el sol está a ' + Math.round(s.alt) + '° sobre el horizonte, al ' + rumbo(s.az) + '.';
    if (s.alt > -6) return 'Ahora en Ribadesella son las ' + h + ': ' + (s.az < 180 ? 'está amaneciendo' : 'está anocheciendo') + '.';
    var txt = 'Ahora en Ribadesella son las ' + h + ' y es de noche';
    if (l.alt > 0 && l.luz > 0.03) txt += '; la luna, ' + nombreFase(l.fase) + ', está a ' + Math.round(l.alt) + '° al ' + rumbo(l.az);
    return txt + '. En la casa hay luz en las ventanas.';
  }

  /* ============ el color del cielo según la altura del sol ============ */
  // [altura del sol, cenit, horizonte]
  var CIELO = [
    [-18, '#04070f', '#0c1222'],
    [-10, '#081028', '#1e2644'],
    [-4, '#1a2752', '#7a5562'],
    [0, '#34508c', '#e08a64'],
    [6, '#5279b8', '#efbf96'],
    [18, '#6893cc', '#d9e2e9'],
    [45, '#4c82c4', '#cddcea'],
  ];
  function cieloPara(alt) {
    if (alt <= CIELO[0][0]) return { cz: CIELO[0][1], ch: CIELO[0][2] };
    for (var i = 1; i < CIELO.length; i++) {
      if (alt <= CIELO[i][0]) {
        var a = CIELO[i - 1], b = CIELO[i], t = (alt - a[0]) / (b[0] - a[0]);
        return { cz: mezcla(a[1], b[1], t), ch: mezcla(a[2], b[2], t) };
      }
    }
    var u = CIELO[CIELO.length - 1];
    return { cz: u[1], ch: u[2] };
  }

  /* ============ el recorrido: interpolación monótona por componente ============ */
  // Hermite con tangentes de Fritsch-Butland: no se pasa de largo aunque los tramos
  // sean de kilómetros al principio y de metros al final. Empieza y acaba en reposo.
  function monotona(ps, vs) {
    var n = ps.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
      var h0 = ps[i] - ps[i - 1], h1 = ps[i + 1] - ps[i];
      m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
    }
    return function (p) {
      if (p <= ps[0]) return vs[0];
      if (p >= ps[n - 1]) return vs[n - 1];
      var k = 0; while (k < n - 2 && p > ps[k + 1]) k++;
      var h = ps[k + 1] - ps[k], t = (p - ps[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }
  function camino(rec) {
    var ps = rec.map(function (r) { return r.p; });
    var f = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.pos[k]; })); });
    var g = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.mira[k]; })); });
    return function (p) { return { pos: [f[0](p), f[1](p), f[2](p)], mira: [g[0](p), g[1](p), g[2](p)] }; };
  }

  /* ============ alturas: PNG RGB → metros ============ */
  function cargarAlturas(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('alturas ' + r.status); return r.blob(); })
      .then(function (b) {
        var op = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
        return (window.createImageBitmap ? createImageBitmap(b, op).catch(function () { return createImageBitmap(b); }) : Promise.reject(new Error('sin createImageBitmap')));
      })
      .then(function (bmp) {
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Float32Array(n);
        for (var i = 0; i < n; i++) out[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100;
        if (bmp.close) bmp.close();
        return { w: c.width, h: c.height, data: out };
      });
  }
  function muestreador(r) {
    var sx = (r.w - 1) / (r.x1 - r.x0), sz = (r.h - 1) / (r.z1 - r.z0), w = r.w, h = r.h, a = r.data;
    return function (x, z) {
      var fx = lim((x - r.x0) * sx, 0, w - 1.0001), fz = lim((z - r.z0) * sz, 0, h - 1.0001);
      var i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * w + i;
      return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + w] * (1 - u) + a[k + w + 1] * u) * v;
    };
  }
  // peso 0..1 de «dentro de la caja» con un borde de transición de b metros
  function pesoCaja(r, x, z, b) {
    var d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
    return lim(d / b, 0, 1);
  }

  /* ============ texturas dibujadas (ligeras) ============ */
  function azar(semilla) { var s = semilla >>> 0 || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function lienzo(lado, pintar) { var c = document.createElement('canvas'); c.width = c.height = lado; pintar(c.getContext('2d'), lado); return c; }
  function texPiedra(base, semilla) {       // mampostería: piedras irregulares con llaga clara
    return lienzo(512, function (g, L) {
      var r = azar(semilla);
      g.fillStyle = mezcla(base, '#ffffff', 0.35); g.fillRect(0, 0, L, L);
      var y = 0;
      while (y < L) {
        var hh = 26 + r() * 30, x = -r() * 40;
        while (x < L) {
          var ww = 34 + r() * 60, t = r();
          g.fillStyle = mezcla(mezcla(base, t < 0.5 ? '#8a7a66' : '#d8cdb8', 0.3 + r() * 0.4), '#000000', r() * 0.18);
          g.beginPath();
          var cx = x + ww / 2, cy = y + hh / 2, k = 9;
          for (var a = 0; a < k; a++) {
            var an = a / k * Math.PI * 2, rr = 0.88 + r() * 0.12;
            var px = cx + Math.cos(an) * ww / 2 * rr - 2, py = cy + Math.sin(an) * hh / 2 * rr - 2;
            if (a) g.lineTo(px, py); else g.moveTo(px, py);
          }
          g.closePath(); g.fill();
          x += ww + 2 + r() * 4;
        }
        y += hh + 3;
      }
      var im = g.getImageData(0, 0, L, L), d = im.data;
      for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(im, 0, 0);
    });
  }
  function texRevoco(base, semilla) {
    return lienzo(256, function (g, L) {
      var r = azar(semilla); g.fillStyle = base; g.fillRect(0, 0, L, L);
      var im = g.getImageData(0, 0, L, L), d = im.data;
      for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(im, 0, 0);
      for (var k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,' + (r() * 0.05).toFixed(3) + ')'; g.fillRect(r() * L, r() * L, 10 + r() * 40, 2 + r() * 30); }
    });
  }
  function texTeja(base, semilla) {          // teja árabe: hileras de canales con sombra
    return lienzo(256, function (g, L) {
      var r = azar(semilla), filas = 8, cols = 10, fh = L / filas, cw = L / cols;
      g.fillStyle = mezcla(base, '#000000', 0.35); g.fillRect(0, 0, L, L);
      for (var j = 0; j < filas; j++) {
        for (var i = 0; i < cols; i++) {
          var x = i * cw, y = j * fh, c = mezcla(mezcla(base, r() < 0.5 ? '#6b3b25' : '#d48a5c', r() * 0.45), '#3a3a30', r() * 0.15);
          var gr = g.createLinearGradient(x, 0, x + cw, 0);
          gr.addColorStop(0, mezcla(c, '#000000', 0.45)); gr.addColorStop(0.45, mezcla(c, '#ffffff', 0.12)); gr.addColorStop(1, mezcla(c, '#000000', 0.5));
          g.fillStyle = gr; g.fillRect(x + 1, y, cw - 2, fh + 3);
          g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 1, y + fh - 3, cw - 2, 3);
        }
      }
    });
  }
  function texMadera(base, semilla) {        // tablas verticales gastadas (el hórreo)
    return lienzo(256, function (g, L) {
      var r = azar(semilla), x = 0;
      while (x < L) {
        var w = 22 + r() * 22, c = mezcla(base, r() < 0.5 ? '#3c342c' : '#9c9286', r() * 0.45);
        g.fillStyle = c; g.fillRect(x, 0, w, L);
        for (var k = 0; k < 12; k++) { g.fillStyle = 'rgba(0,0,0,' + (0.05 + r() * 0.1).toFixed(2) + ')'; g.fillRect(x + r() * w, 0, 1 + r() * 1.5, L); }
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + w - 2, 0, 2, L);
        x += w;
      }
    });
  }

  /* ============ módulo ============ */
  function montar(el, opciones) {
    opciones = opciones || {};
    var q = new URLSearchParams(location.search);
    var reduce = opciones.movimiento === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opciones.densidad === 'sobria';
    var movil = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
    var ahorro = !!(navigator.connection && navigator.connection.saveData);
    var forzar3d = q.get('lugar') === '3d';                                         // solo para pruebas: intenta el 3D sin mirar
    var automatizado = !!navigator.webdriver && !forzar3d;                           // Playwright: nunca pinta el 3D
    var sinWebgl = opciones.webgl === false || q.has('sin-webgl') || automatizado;
    if (!sinWebgl && !sobria && !reduce && !forzar3d) {
      try { var cv0 = document.createElement('canvas'); sinWebgl = !(cv0.getContext('webgl2') || cv0.getContext('webgl')); } catch (e) { sinWebgl = true; }
    }
    var puede3d = !sinWebgl && !sobria && !reduce;
    var auto3d = puede3d && !movil && !ahorro;
    var respaldo = el.innerHTML;
    var estado = { modo: 'plano', destruido: false, error3d: null, cargado: false, p: 0, pVis: 0, calidad: 0 };
    var escuchas = [];
    var escucha = function (o, ev, fn, op) { o.addEventListener(ev, fn, op); escuchas.push(function () { o.removeEventListener(ev, fn, op); }); };
    var t3 = null, meta = null, cargando = null, intervalo = 0;

    /* ---------- DOM ---------- */
    el.classList.add('lugar');
    el.innerHTML =
      '<div class="lugar__pista">' +
        '<div class="lugar__escenario" role="img" aria-label="Recorrido en 3D desde el mar Cantábrico hasta el hórreo de Amaicha, con el relieve real y la luz de este momento">' +
          '<img class="lugar__poster" alt="" decoding="async" src="' + BASE + 'vista-mar-1600.webp" srcset="' + BASE + 'vista-mar-960.webp 960w, ' + BASE + 'vista-mar-1600.webp 1600w" sizes="100vw">' +
          '<div class="lugar__rotulos" aria-hidden="true"></div>' +
          '<ol class="lugar__paradas"></ol>' +
          '<div class="lugar__pie3d"><p class="lugar__ahora" data-l="ahora3d"></p>' +
          '<button type="button" class="lugar__btn lugar__btn--suave" data-l="aplano">Ver en plano</button></div>' +
          '<p class="lugar__aviso" data-l="aviso" role="status" hidden></p>' +
        '</div>' +
      '</div>' +
      '<div class="lugar__planob">' +
        '<figure class="lugar__vista">' +
          '<div class="lugar__marco"><img alt="El relieve real visto desde el mar: los acantilados de la costa, la sierra y, al fondo, los Picos de Europa" decoding="async" loading="lazy" src="' + BASE + 'vista-mar-960.webp" srcset="' + BASE + 'vista-mar-960.webp 960w, ' + BASE + 'vista-mar-1600.webp 1600w" sizes="(max-width: 820px) 100vw, 66vw">' +
          '<i class="lugar__noche" aria-hidden="true"></i><ul class="lugar__marcas" aria-hidden="true"></ul></div>' +
          '<figcaption>Desde el mar: la costa de acantilados, la sierra y, detrás, los Picos de Europa. Dibujado con el relieve y la ortofoto del IGN.</figcaption>' +
        '</figure>' +
        '<figure class="lugar__finca">' +
          '<div class="lugar__marco lugar__marco--finca"><img alt="La finca desde el aire: la casona, la casa roja y el hórreo en el jardín, entre árboles" decoding="async" loading="lazy" src="' + BASE + 'plano-finca-900.webp" width="900" height="900">' +
          '<ul class="lugar__marcas lugar__marcas--finca" aria-hidden="true"></ul></div>' +
          '<figcaption>La finca desde el aire (ortofoto PNOA).</figcaption>' +
        '</figure>' +
        '<ol class="lugar__pasos"></ol>' +
        '<p class="lugar__ahora" data-l="ahora2d"></p>' +
        '<p class="lugar__acciones"><button type="button" class="lugar__btn" data-l="a3d" hidden>Ver el recorrido en 3D</button></p>' +
      '</div>' +
      '<p class="lugar__fuente" data-l="fuente">Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0) · Planta de los edificios © Dirección General del Catastro · Lugares © colaboradores de OpenStreetMap. El relieve lejano está exagerado ×1,4 para que se lean los Picos. El sol y la luna se calculan en tu navegador para Ribadesella.</p>';
    var $ = function (k) { return el.querySelector('[data-l="' + k + '"]'); };
    var pista = el.querySelector('.lugar__pista'), escenario = el.querySelector('.lugar__escenario');
    var poster = el.querySelector('.lugar__poster'), capaRot = el.querySelector('.lugar__rotulos');
    var aviso = $('aviso');
    var avisar = function (t) { aviso.textContent = t || ''; aviso.hidden = !t; };

    /* ---------- paradas (las mismas en el 3D y en el plano) ---------- */
    var PARADAS = [
      { desde: 0, t: 'Desde el mar', d: 'El Cantábrico delante; detrás de la costa, la sierra y los Picos de Europa.' },
      { desde: 0.25, t: 'Los acantilados', d: 'La rasa costera cae al mar en acantilados. A un lado, Ribadesella; al otro, Guadamía y los bufones de Pría.' },
      { desde: 0.5, t: 'Camango', d: 'Entre prados y arboledas, la aldea de Camango.' },
      { desde: 0.76, t: 'La finca', d: 'La casona de piedra, la casa roja y, en el jardín, el hórreo asturiano sobre sus cuatro pegoyos.' },
    ];
    var htmlParadas = PARADAS.map(function (p, i) { return '<li data-i="' + i + '"><b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></li>'; }).join('');
    el.querySelector('.lugar__paradas').innerHTML = htmlParadas;
    el.querySelector('.lugar__pasos').innerHTML = htmlParadas;
    var lisParadas = el.querySelectorAll('.lugar__paradas li');
    var paradaActual = -1;
    function marcarParada(p) {
      var i = 0; for (var k = 0; k < PARADAS.length; k++) if (p >= PARADAS[k].desde - 0.001) i = k;
      if (i === paradaActual) return;
      paradaActual = i;
      lisParadas.forEach(function (li, k) { li.classList.toggle('es-actual', k === i); li.classList.toggle('es-pasada', k < i); });
    }

    /* ---------- el cielo de ahora, en texto (y la noche en el plano) ---------- */
    function cieloTexto() {
      var f = new Date(), txt = fraseCielo(f), s = sol(f);
      $('ahora2d').textContent = txt; $('ahora3d').textContent = txt;
      el.style.setProperty('--lugar-noche', String(lim((-s.alt - 1) / 10, 0, 1).toFixed(2)));
      if (t3) t3.luces(f);
    }

    /* ---------- plan B: marcas sobre las dos imágenes ---------- */
    function montarPlano(m) {
      var nombres = {}; m.lugares.forEach(function (l) { nombres[l.clave] = l; });
      var ulV = el.querySelector('.lugar__vista .lugar__marcas');
      ulV.innerHTML = m.planB.vista.marcas.map(function (k) {
        var l = nombres[k.clave]; if (!l) return '';
        return '<li class="lugar__marca' + (k.clave === 'amaicha' ? ' lugar__marca--casa' : '') + '" data-x="' + k.x + '" data-y="' + k.y + '"><span>' + esc(l.nombre) + '</span></li>';
      }).join('');
      var pl = m.planB.plano, x0 = pl.cx - pl.lado / 2, z0 = pl.cz - pl.lado / 2;
      var ulF = el.querySelector('.lugar__marcas--finca');
      ulF.innerHTML = ['casona', 'roja', 'horreo'].map(function (c) {
        var l = nombres[c]; if (!l) return '';
        return '<li class="lugar__marca lugar__marca--finca" style="left:' + ((l.x - x0) / pl.lado * 100).toFixed(2) + '%;top:' + ((l.z - z0) / pl.lado * 100).toFixed(2) + '%"><span>' + esc(l.nombre) + '</span></li>';
      }).join('');
      colocarMarcas();
    }
    // la vista del mar se recorta con object-fit: cover; las marcas siguen al recorte y se ocultan si quedan fuera
    function colocarMarcas() {
      var marco = el.querySelector('.lugar__vista .lugar__marco'); if (!marco || !meta) return;
      var W = marco.clientWidth, H = marco.clientHeight; if (!W || !H) return;
      var iw = meta.planB.vista.ancho, ih = meta.planB.vista.alto, k = Math.max(W / iw, H / ih);
      var ox = (W - iw * k) / 2, oy = (H - ih * k) * 0.62;
      el.querySelectorAll('.lugar__vista .lugar__marca').forEach(function (li) {
        var x = ox + (+li.dataset.x) / 100 * iw * k, y = oy + (+li.dataset.y) / 100 * ih * k;
        var fuera = x < 12 || x > W - 12 || y < 8 || y > H - 8;
        li.hidden = fuera;
        li.style.left = x.toFixed(1) + 'px'; li.style.top = y.toFixed(1) + 'px';
        li.classList.toggle('a-la-izq', x > W * 0.7);
      });
      // si dos rótulos se pisan (los acantilados y Amaicha están a pocos metros), el de la izquierda se va a su izquierda
      var vis = [].filter.call(el.querySelectorAll('.lugar__vista .lugar__marca'), function (li) { return !li.hidden; })
        .sort(function (a, b) { return parseFloat(a.style.left) - parseFloat(b.style.left); });
      for (var i = 0; i < vis.length; i++) for (var j = i + 1; j < vis.length; j++) {
        var a = vis[i].firstElementChild.getBoundingClientRect(), b = vis[j].firstElementChild.getBoundingClientRect();
        if (a.right > b.left - 6 && a.left < b.right + 6 && a.bottom > b.top - 2 && a.top < b.bottom + 2) vis[i].classList.add('a-la-izq');
      }
    }

    function ponModo(m) {
      estado.modo = m;
      el.dataset.modo = m;
      $('a3d').hidden = !(puede3d && m === 'plano' && !estado.error3d);
      if (t3) t3.activo(m === '3d');
    }

    /* ---------- datos ---------- */
    var pMeta = fetch(BASE + 'lugar.json').then(function (r) { if (!r.ok) throw new Error('lugar.json ' + r.status); return r.json(); })
      .then(function (m) { meta = m; if (!estado.destruido) montarPlano(m); return m; });
    pMeta.catch(function (e) { console.warn('Lugar: sin datos', e); });

    /* ---------- el 3D ---------- */
    function cargar3d() {
      if (t3) return Promise.resolve(t3);
      if (cargando) return cargando;
      avisar('Cargando el relieve…');
      var hiDef = !movil && !ahorro;
      cargando = pMeta.then(function (m) {
        return Promise.all([
          import(THREE_URL),
          cargarAlturas(BASE + m.rasters.cerca.archivo), cargarAlturas(BASE + m.rasters.medio.archivo),
          cargarAlturas(BASE + m.rasters.finca.archivo), cargarAlturas(BASE + m.rasters.lejos.archivo),
        ]).then(function (r) {
          if (estado.destruido) return null;
          var R = {};
          ['cerca', 'medio', 'finca', 'lejos'].forEach(function (k, i) { var b = r[i + 1], o = m.rasters[k]; R[k] = Object.assign({}, o, { w: b.w, h: b.h, data: b.data }); });
          return crear3d(r[0], m, R, hiDef);
        });
      }).then(function (t) { avisar(''); return t; }, function (e) {
        estado.error3d = String((e && e.message) || e);
        console.warn('Lugar: el 3D no está disponible:', e);
        avisar(''); cargando = null; ponModo('plano');
        return null;
      });
      return cargando;
    }

    function crear3d(THREE, m, R, hiDef) {
      var cv = document.createElement('canvas');
      cv.className = 'lugar__lienzo'; cv.setAttribute('aria-hidden', 'true');
      escenario.insertBefore(cv, capaRot);
      var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: hiDef, powerPreference: 'high-performance', alpha: false, stencil: false });
      var topeDPR = function () { return estado.calidad >= 1 ? 1 : (movil ? 1.25 : 1.5); };
      ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
      ren.outputColorSpace = THREE.SRGBColorSpace;
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.shadowMap.autoUpdate = false;
      var anis = Math.min(8, ren.capabilities.getMaxAnisotropy());
      var esc3 = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(40, 1.6, 1, 160000);
      var disponer = [];
      var guarda = function (o) { disponer.push(o); return o; };

      /* --- alturas combinadas: finca 4 m, medio 10 m, cerca 20 m, lejos ~290 m --- */
      var hC = muestreador(R.cerca), hM = muestreador(R.medio), hF = muestreador(R.finca), hL = muestreador(R.lejos);
      var EX = m.exag;
      var exag = function (x, z) { return 1 + (EX.lejos - 1) * suave(EX.desde, EX.hasta, Math.sqrt(x * x + z * z)); };
      function altura(x, z) {                  // metros (sin exagerar); el mar, negativo
        var wc = pesoCaja(R.cerca, x, z, 1);
        if (wc <= 0) return hL(x, z);
        var h = hC(x, z);
        var wm = pesoCaja(R.medio, x, z, 80); if (wm > 0) h = lerp(h, hM(x, z), wm);
        var wf = pesoCaja(R.finca, x, z, 40); if (wf > 0) h = lerp(h, hF(x, z), wf);
        return h;
      }
      var yDe = function (x, z) { var h = altura(x, z); return h > 0 ? h * exag(x, z) : h; };

      /* --- materiales del suelo --- */
      var ldr = new THREE.TextureLoader();
      var cargaTex = function (url, alListo) {
        return ldr.load(url, function (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; t.needsUpdate = true; if (alListo) alListo(t); pedir(true); },
          undefined, function () { console.warn('Lugar: no carga', url); });
      };
      var O = m.orto, calidadTex = hiDef ? 'alta' : 'baja';
      var uFinca = { mapFinca: { value: null }, fincaCaja: { value: new THREE.Vector4(O.finca.x0, O.finca.z0, O.finca.x1, O.finca.z1) }, fincaListo: { value: 0 } };
      var matCerca = guarda(new THREE.MeshLambertMaterial({ color: '#6b7660' }));
      matCerca.onBeforeCompile = function (sh) {
        Object.assign(sh.uniforms, uFinca);
        sh.vertexShader = 'varying vec2 vXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vXZ = position.xz;');
        sh.fragmentShader = 'varying vec2 vXZ;\nuniform sampler2D mapFinca;\nuniform vec4 fincaCaja;\nuniform float fincaListo;\n' +
          sh.fragmentShader.replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec4 texel = texture2D(map, vMapUv);',
            '  vec2 fu = (vXZ - fincaCaja.xy) / (fincaCaja.zw - fincaCaja.xy);',
            '  if (fincaListo > 0.5 && fu.x > 0.0 && fu.x < 1.0 && fu.y > 0.0 && fu.y < 1.0) {',
            '    vec4 tf = texture2D(mapFinca, vec2(fu.x, 1.0 - fu.y));',
            '    float b = smoothstep(0.0, 0.1, min(min(fu.x, 1.0 - fu.x), min(fu.y, 1.0 - fu.y)));',
            '    texel = mix(texel, tf, b);',
            '  }',
            '  diffuseColor *= texel;',
            '#endif'].join('\n'));
      };
      cargaTex(BASE + O.cerca.archivos[calidadTex], function (t) { matCerca.map = t; matCerca.color.set('#ffffff'); matCerca.needsUpdate = true; });
      cargaTex(BASE + O.finca.archivos[calidadTex], function (t) { uFinca.mapFinca.value = t; uFinca.fincaListo.value = 1; });
      var matLejos = guarda(new THREE.MeshLambertMaterial({ color: '#5c6658', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }));
      cargaTex(BASE + O.lejos.archivos.alta, function (t) { matLejos.map = t; matLejos.color.set('#ffffff'); matLejos.needsUpdate = true; });

      /* --- relieve cercano: rejilla densa en la finca y más abierta lejos --- */
      var pasos = hiDef ? [4, 8, 20, 60] : [6, 14, 32, 80];
      var pasoEn = function (d) { return d < 230 ? pasos[0] : d < 720 ? pasos[1] : d < 2100 ? pasos[2] : pasos[3]; };
      function ejes(a0, a1, c) {
        var out = [a0], v = a0;
        while (v < a1 - 0.01) {
          var s = pasoEn(Math.abs(v - c));
          s = pasoEn(Math.min(Math.abs(v - c), Math.abs(v + s - c)));
          v = Math.min(a1, v + s); out.push(v);
        }
        return out;
      }
      var C = R.cerca;
      var xs = ejes(C.x0, C.x1, 8), zs = ejes(C.z0, C.z1, 0);
      var nx = xs.length, nz = zs.length;
      function rejilla(xs, zs, yFn, uvCaja, hueco, faldon) {
        var nx = xs.length, nz = zs.length, n = nx * nz;
        var nF = faldon ? 2 * (nx + nz) : 0;
        var pos = new Float32Array((n + nF) * 3), uv = new Float32Array((n + nF) * 2);
        var k = 0;
        for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++, k++) {
          var x = xs[i], z = zs[j];
          pos[k * 3] = x; pos[k * 3 + 1] = yFn(x, z, i, j); pos[k * 3 + 2] = z;
          uv[k * 2] = (x - uvCaja.x0) / (uvCaja.x1 - uvCaja.x0); uv[k * 2 + 1] = 1 - (z - uvCaja.z0) / (uvCaja.z1 - uvCaja.z0);
        }
        var idx = [];
        for (j = 0; j < nz - 1; j++) for (i = 0; i < nx - 1; i++) {
          if (hueco && i >= hueco[0] && i < hueco[2] && j >= hueco[1] && j < hueco[3]) continue;
          var a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
        if (faldon) {                                     // el borde baja como una pared: tapa las rendijas entre mallas
          var borde = [], f0 = n;
          for (i = 0; i < nx; i++) borde.push(i);
          for (j = 1; j < nz; j++) borde.push(j * nx + nx - 1);
          for (i = nx - 2; i >= 0; i--) borde.push((nz - 1) * nx + i);
          for (j = nz - 2; j > 0; j--) borde.push(j * nx);
          borde.forEach(function (v, q) {
            var w = f0 + q;
            pos[w * 3] = pos[v * 3]; pos[w * 3 + 1] = Math.min(pos[v * 3 + 1], 0) - faldon; pos[w * 3 + 2] = pos[v * 3 + 2];
            uv[w * 2] = uv[v * 2]; uv[w * 2 + 1] = uv[v * 2 + 1];
          });
          for (var qq = 0; qq < borde.length; qq++) {
            var v0 = borde[qq], v1 = borde[(qq + 1) % borde.length], w0 = f0 + qq, w1 = f0 + (qq + 1) % borde.length;
            idx.push(v0, w0, v1, v1, w0, w1, v0, v1, w0, v1, w1, w0);     // por las dos caras
          }
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(n + nF > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeVertexNormals();
        return guarda(g);
      }
      var geoCerca = rejilla(xs, zs, function (x, z) { return yDe(x, z); }, O.cerca, null, 160);
      var cerca = new THREE.Mesh(geoCerca, matCerca);
      cerca.receiveShadow = true;
      esc3.add(cerca);

      var L = R.lejos, xsL = [], zsL = [], i, j;
      for (i = 0; i < L.w; i++) xsL.push(L.x0 + i * (L.x1 - L.x0) / (L.w - 1));
      for (j = 0; j < L.h; j++) zsL.push(L.z0 + j * (L.z1 - L.z0) / (L.h - 1));
      var lejos = new THREE.Mesh(rejilla(xsL, zsL, function (x, z, i, j) { var h = L.data[j * L.w + i]; return h > 0 ? h * exag(x, z) : h; }, O.lejos, L.hueco, 500), matLejos);
      esc3.add(lejos);

      /* --- el mar --- */
      var costaTex = cargaTex(BASE + O.costa.archivo, function (t) { t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; });
      costaTex.colorSpace = THREE.NoColorSpace;
      var uAgua = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        tiempo: { value: 0 }, costa: { value: costaTex }, costaCaja: { value: new THREE.Vector4(C.x0, C.z0, C.x1, C.z1) },
        dirSol: { value: new THREE.Vector3(0, 1, 0) }, colSol: { value: new THREE.Color('#ffffff') }, brilloSol: { value: 1 },
        dirLuna: { value: new THREE.Vector3(0, 1, 0) }, brilloLuna: { value: 0 },
        cZ: { value: new THREE.Color('#5a82bf') }, cH: { value: new THREE.Color('#d9e2e9') },
        profundo: { value: new THREE.Color('#123a4f') }, somero: { value: new THREE.Color('#2f7d86') }, luzAgua: { value: 1 },
        olas: { value: reduce ? 0 : 1 }, cajaLejos: { value: new THREE.Vector4(R.lejos.x0, R.lejos.z0, R.lejos.x1, R.lejos.z1) },
      }]);
      uAgua.costa.value = costaTex;
      var matAgua = guarda(new THREE.ShaderMaterial({
        uniforms: uAgua, fog: true, toneMapped: false,
        vertexShader: [
          'varying vec3 vW;', '#include <fog_pars_vertex>',
          'void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;', '#include <fog_vertex>', '}'].join('\n'),
        fragmentShader: [
          'uniform float tiempo; uniform sampler2D costa; uniform vec4 costaCaja; uniform vec3 dirSol; uniform vec3 colSol; uniform float brilloSol;',
          'uniform vec3 dirLuna; uniform float brilloLuna; uniform vec3 cZ; uniform vec3 cH; uniform vec3 profundo; uniform vec3 somero; uniform float luzAgua; uniform float olas; uniform vec4 cajaLejos;',
          'varying vec3 vW;', '#include <fog_pars_fragment>',
          'float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
          '  float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5), b = fract(sin(dot(i+vec2(1,0), vec2(127.1,311.7)))*43758.5);',
          '  float c = fract(sin(dot(i+vec2(0,1), vec2(127.1,311.7)))*43758.5), d = fract(sin(dot(i+vec2(1,1), vec2(127.1,311.7)))*43758.5);',
          '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }',
          'void main(){',
          '  if ((vW.x < cajaLejos.x || vW.x > cajaLejos.z || vW.z > cajaLejos.w) && vW.z > -3000.0) discard;',
          '  vec2 p = vW.xz; float t = tiempo * olas;',
          '  vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);',
          '  float fade = 1.0 - smoothstep(600.0, 9000.0, dist);',
          '  vec2 g = vec2(0.0);',
          '  g += vec2(0.35, 0.94) * cos(dot(p, vec2(0.35, 0.94)) * 0.055 - t * 0.9) * 0.55;',
          '  g += vec2(-0.6, 0.8) * cos(dot(p, vec2(-0.6, 0.8)) * 0.11 - t * 1.3) * 0.35;',
          '  g += vec2(0.9, 0.42) * cos(dot(p, vec2(0.9, 0.42)) * 0.23 - t * 1.9) * 0.22;',
          '  float e = 0.6; vec2 q = p * 0.09 + vec2(t * 0.15, t * 0.08);',
          '  g += vec2(ruido(q + vec2(e, 0.0)) - ruido(q - vec2(e, 0.0)), ruido(q + vec2(0.0, e)) - ruido(q - vec2(0.0, e))) * 0.9;',
          '  vec3 N = normalize(vec3(-g.x * 0.11 * fade, 1.0, -g.y * 0.11 * fade));',
          '  vec2 cu = (p - costaCaja.xy) / (costaCaja.zw - costaCaja.xy);',
          '  float dc = 800.0; float tierra = 0.0;',
          '  if (cu.x > 0.0 && cu.x < 1.0 && cu.y > 0.0 && cu.y < 1.0) { vec4 c = texture2D(costa, vec2(cu.x, 1.0 - cu.y)); dc = c.r * 765.0; tierra = c.g; }',
          '  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);',
          '  vec3 Rf = reflect(-V, N); Rf.y = abs(Rf.y);',
          '  vec3 cielo = mix(cH, cZ, smoothstep(0.0, 0.45, Rf.y));',
          '  vec3 cuerpo = mix(somero, profundo, smoothstep(10.0, 260.0, dc)) * luzAgua;',
          '  vec3 col = mix(cuerpo, cielo, fres * 0.85);',
          '  col += colSol * brilloSol * (pow(max(dot(Rf, dirSol), 0.0), 380.0) * 6.0 + pow(max(dot(Rf, dirSol), 0.0), 30.0) * 0.18);',
          '  col += vec3(0.75, 0.82, 1.0) * brilloLuna * pow(max(dot(Rf, dirLuna), 0.0), 120.0) * 2.5;',
          '  float banda = 0.5 + 0.5 * sin(dc * 0.35 - t * 1.6 + ruido(p * 0.05) * 6.0);',
          '  float esp = (1.0 - smoothstep(4.0, 34.0, dc)) * (0.55 + 0.45 * banda) + (1.0 - smoothstep(0.0, 8.0, dc)) * 0.6;',
          '  esp *= 0.55 + 0.45 * ruido(p * 0.35 + t * 0.3);',
          '  col = mix(col, vec3(0.92, 0.94, 0.93) * max(luzAgua, 0.08), clamp(esp, 0.0, 1.0) * (1.0 - tierra * 0.0));',
          '  gl_FragColor = vec4(col, 1.0);',
          '  #include <fog_fragment>',
          '  #include <colorspace_fragment>',
          '}'].join('\n'),
      }));
      var agua = new THREE.Mesh(guarda(new THREE.PlaneGeometry(300000, 300000).rotateX(-Math.PI / 2)), matAgua);
      esc3.add(agua);

      /* --- cielo: cúpula con degradado y brillo hacia el sol --- */
      var uCielo = { cZ: { value: new THREE.Color() }, cH: { value: new THREE.Color() }, dirSol: { value: new THREE.Vector3(0, 1, 0) }, brillo: { value: 0 }, cLuz: { value: new THREE.Color('#ffb070') } };
      var cielo = new THREE.Mesh(guarda(new THREE.SphereGeometry(120000, 40, 20)), guarda(new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false, uniforms: uCielo,
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: ['uniform vec3 cZ; uniform vec3 cH; uniform vec3 dirSol; uniform float brillo; uniform vec3 cLuz; varying vec3 vP;',
          'void main(){ float h = vP.y; vec3 c = mix(cH, cZ, smoothstep(0.0, 0.55, h)); if (h < 0.0) c = cH;',
          ' float s = max(dot(normalize(vP), dirSol), 0.0); float vel = 1.0 - smoothstep(0.0, 0.45, abs(h));',
          ' c += cLuz * brillo * (pow(s, 6.0) * 0.5 + pow(s, 60.0) * 0.45) * vel;',
          ' gl_FragColor = vec4(c, 1.0);', ' #include <colorspace_fragment>', '}'].join('\n'),
      })));
      cielo.renderOrder = -10; cielo.frustumCulled = false;
      esc3.add(cielo);
      esc3.fog = new THREE.FogExp2('#d9e2e9', 1 / 46000);

      // estrellas
      var rnd = azar(23), nE = hiDef ? 900 : 500, ePos = new Float32Array(nE * 3);
      for (i = 0; i < nE; i++) {
        var a = rnd() * Math.PI * 2, hh = Math.asin(0.03 + rnd() * 0.96);
        ePos[i * 3] = Math.cos(hh) * Math.sin(a) * 100000; ePos[i * 3 + 1] = Math.sin(hh) * 100000; ePos[i * 3 + 2] = -Math.cos(hh) * Math.cos(a) * 100000;
      }
      var eGeo = guarda(new THREE.BufferGeometry()); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
      var estrellas = new THREE.Points(eGeo, guarda(new THREE.PointsMaterial({ color: '#f3eee4', size: movil ? 1.4 : 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })));
      estrellas.frustumCulled = false; esc3.add(estrellas);
      // sol y luna como discos en su dirección real
      var texDe = function (lado, f) { var c = lienzo(lado, f), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return guarda(t); };
      var solS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(128, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,246,222,1)'); r.addColorStop(0.14, 'rgba(255,232,180,1)'); r.addColorStop(0.32, 'rgba(255,205,140,.35)'); r.addColorStop(1, 'rgba(255,205,140,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); }), fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      solS.scale.set(9000, 9000, 1); esc3.add(solS);
      var lunaCv = document.createElement('canvas'); lunaCv.width = lunaCv.height = 128;
      var lunaTex = guarda(new THREE.CanvasTexture(lunaCv)); lunaTex.colorSpace = THREE.SRGBColorSpace;
      var lunaS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: lunaTex, fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      lunaS.scale.set(3600, 3600, 1); esc3.add(lunaS);
      function pintarLuna(fase) {
        var g = lunaCv.getContext('2d'), Ld = 128, r = Ld * 0.36, c = Ld / 2;
        g.clearRect(0, 0, Ld, Ld); g.save(); g.translate(c, c);
        g.fillStyle = 'rgba(40,50,70,.5)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        var crec = fase < 0.5, p = crec ? fase : 1 - fase; if (!crec) g.scale(-1, 1);
        var k = Math.cos(2 * Math.PI * p);
        g.shadowColor = 'rgba(242,236,227,.55)'; g.shadowBlur = Ld * 0.1; g.fillStyle = '#f1ebdc';
        g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        g.ellipse(0, 0, Math.max(0.01, Math.abs(k)) * r, r, 0, Math.PI / 2, k >= 0 ? -Math.PI / 2 : 3 * Math.PI / 2, k >= 0);
        g.fill(); g.restore(); lunaTex.needsUpdate = true;
      }

      /* --- luces --- */
      var FINCA = new THREE.Vector3(6, yDe(6, 18), 18);
      var luzSol = new THREE.DirectionalLight('#ffffff', 2.6);
      luzSol.castShadow = true;
      var SM = hiDef ? 2048 : 1024;
      luzSol.shadow.mapSize.set(SM, SM);
      Object.assign(luzSol.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 1600 });
      luzSol.shadow.camera.updateProjectionMatrix();
      luzSol.shadow.bias = -0.0004; luzSol.shadow.normalBias = 0.05;
      luzSol.target.position.copy(FINCA);
      var luzLuna = new THREE.DirectionalLight('#a8bce0', 0);
      luzLuna.target.position.copy(FINCA);
      var hemi = new THREE.HemisphereLight('#dfe8f0', '#5d5444', 1.5);
      var luzCasa = new THREE.PointLight('#ffc27a', 0, 55, 2);      // siempre está: si no, cambiaría el programa al anochecer
      esc3.add(luzSol, luzSol.target, luzLuna, luzLuna.target, hemi, luzCasa);

      /* --- la finca: edificios sobre su planta del Catastro --- */
      var matTeja = guarda(new THREE.MeshLambertMaterial({ map: (function () { var t = new THREE.CanvasTexture(texTeja('#b5583b', 5)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anis; return guarda(t); })() }));
      var matTejaV = guarda(new THREE.MeshLambertMaterial({ map: matTeja.map, color: '#d9cfc6' }));
      var texRep = function (c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anis; return guarda(t); };
      var MAT = {
        piedra: guarda(new THREE.MeshLambertMaterial({ map: texRep(texPiedra('#b9ab92', 11)) })),
        roja: guarda(new THREE.MeshLambertMaterial({ map: texRep(texRevoco('#a3313a', 12)) })),
        azul: guarda(new THREE.MeshLambertMaterial({ map: texRep(texRevoco('#3f7fc0', 13)) })),
        blanca: guarda(new THREE.MeshLambertMaterial({ map: texRep(texRevoco('#e9e3d6', 14)) })),
        zocalo: guarda(new THREE.MeshLambertMaterial({ map: texRep(texPiedra('#a49c8e', 15)) })),
        madera: guarda(new THREE.MeshLambertMaterial({ color: '#6a4a33' })),
        alero: guarda(new THREE.MeshLambertMaterial({ color: '#5b3a28' })),
      };
      var ESTILO = {      // muro, zócalo (m sobre el suelo), altura de planta, luces de noche
        casona: { muro: 'piedra', zocalo: 0, planta: 3.0, luz: 0.75 },
        roja: { muro: 'roja', zocalo: 0.9, planta: 2.9, luz: 0.6 },
        azul: { muro: 'azul', zocalo: 2.9, planta: 2.9, luz: 0.5 },
        vecina: { muro: 'blanca', zocalo: 0.5, planta: 2.8, luz: 0.3 },
      };
      var finca = new THREE.Group(); esc3.add(finca);
      var geoMuros = {}, ventanas = [];
      function añadeMuro(clave, a, b, y0, y1, u0) {
        var g = geoMuros[clave] || (geoMuros[clave] = { p: [], uv: [] });
        var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), u1 = u0 + l / 2.4;
        g.p.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
        g.uv.push(u0, y0 / 2.4, u1, y0 / 2.4, u1, y1 / 2.4, u0, y0 / 2.4, u1, y1 / 2.4, u0, y1 / 2.4);
      }
      function dentro(pt, anillo) {
        var c = false;
        for (var i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
          var a = anillo[i], b = anillo[j];
          if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
        }
        return c;
      }
      function tejado(rc, y0, tipo, alero, mat, matGab) {
        var c = Math.cos(rc.ang), s = Math.sin(rc.ang);
        var Lh = rc.largo / 2 + alero, Fh = rc.fondo / 2 + alero, pend = Math.tan(27 * RAD), sube = (rc.fondo / 2 + alero) * pend;
        var P = function (u, v, y) { return [rc.cx + u * c - v * s, y, rc.cz + u * s + v * c]; };
        var tris = [], uvs = [];
        var cara = function (pts, uvsC) {                 // se invierte cada triángulo: la cara buena mira al cielo
          for (var t = 0; t < pts.length; t += 3) {
            [pts[t], pts[t + 2], pts[t + 1]].forEach(function (v) { tris.push(v[0], v[1], v[2]); });
            [uvsC[t], uvsC[t + 2], uvsC[t + 1]].forEach(function (v) { uvs.push(v[0], v[1]); });
          }
        };
        var Y0 = y0, Y1 = y0 + sube, lg = Math.hypot(Fh, sube);
        if (tipo === '4') {
          var cr = Math.max(0, Lh - Fh);           // media cumbrera
          cara([P(-Lh, -Fh, Y0), P(Lh, -Fh, Y0), P(cr, 0, Y1), P(-Lh, -Fh, Y0), P(cr, 0, Y1), P(-cr, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [(Lh + cr) / 1.6, lg / 1.6], [0, 0], [(Lh + cr) / 1.6, lg / 1.6], [(Lh - cr) / 1.6, lg / 1.6]]);
          cara([P(Lh, Fh, Y0), P(-Lh, Fh, Y0), P(-cr, 0, Y1), P(Lh, Fh, Y0), P(-cr, 0, Y1), P(cr, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [(Lh + cr) / 1.6, lg / 1.6], [0, 0], [(Lh + cr) / 1.6, lg / 1.6], [(Lh - cr) / 1.6, lg / 1.6]]);
          var lgL = Math.hypot(Lh - cr, sube);
          cara([P(Lh, -Fh, Y0), P(Lh, Fh, Y0), P(cr, 0, Y1)], [[0, 0], [2 * Fh / 1.6, 0], [Fh / 1.6, lgL / 1.6]]);
          cara([P(-Lh, Fh, Y0), P(-Lh, -Fh, Y0), P(-cr, 0, Y1)], [[0, 0], [2 * Fh / 1.6, 0], [Fh / 1.6, lgL / 1.6]]);
        } else {
          cara([P(-Lh, -Fh, Y0), P(Lh, -Fh, Y0), P(Lh, 0, Y1), P(-Lh, -Fh, Y0), P(Lh, 0, Y1), P(-Lh, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [2 * Lh / 1.6, lg / 1.6], [0, 0], [2 * Lh / 1.6, lg / 1.6], [0, lg / 1.6]]);
          cara([P(Lh, Fh, Y0), P(-Lh, Fh, Y0), P(-Lh, 0, Y1), P(Lh, Fh, Y0), P(-Lh, 0, Y1), P(Lh, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [2 * Lh / 1.6, lg / 1.6], [0, 0], [2 * Lh / 1.6, lg / 1.6], [0, lg / 1.6]]);
          // hastiales (piñones) con el material del muro, sin alero
          var Lw = rc.largo / 2, Fw = rc.fondo / 2, Yw = y0 + (Fw + alero) * pend - alero * pend;
          var gb = [P(Lw, -Fw, Y0 + alero * pend * 0), P(Lw, Fw, Y0), P(Lw, 0, Y1 - 0.05), P(-Lw, Fw, Y0), P(-Lw, -Fw, Y0), P(-Lw, 0, Y1 - 0.05)];
          var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], gb), 3));
          gg.setAttribute('uv', new THREE.Float32BufferAttribute([0, Y0 / 2.4, Fw / 1.2, Y0 / 2.4, Fw / 2.4, Yw / 2.4, 0, Y0 / 2.4, Fw / 1.2, Y0 / 2.4, Fw / 2.4, Yw / 2.4], 2));
          gg.computeVertexNormals();
          var mg = new THREE.Mesh(guarda(gg), matGab); mg.material.side = THREE.DoubleSide; mg.castShadow = true; mg.receiveShadow = true; finca.add(mg);
        }
        // el grueso del alero
        var tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); tg.computeVertexNormals();
        var mt = new THREE.Mesh(guarda(tg), mat); mt.castShadow = true; mt.receiveShadow = true; finca.add(mt);
        var canto = new THREE.Mesh(guarda(new THREE.BoxGeometry(2 * Lh, 0.16, 2 * Fh)), MAT.alero);
        canto.position.set(rc.cx, y0 - 0.1, rc.cz); canto.rotation.y = -rc.ang; canto.castShadow = true; finca.add(canto);
        return Y1;
      }
      var tops = {};
      m.edificios.forEach(function (e) {
        var est = ESTILO[e.tipo] || ESTILO.vecina;
        var suelo = Math.min(e.suelo, yDe(e.rect.cx, e.rect.cz)) - 0.6;
        var arriba = e.suelo + 0.25 + e.pisos * est.planta;
        var an = e.anillo, u = 0, area2 = 0;
        for (var k = 0; k < an.length; k++) { var a = an[k], b = an[(k + 1) % an.length]; area2 += a[0] * b[1] - b[0] * a[1]; }
        for (k = 0; k < an.length; k++) {
          var A0 = an[k], B0 = an[(k + 1) % an.length], l = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]);
          if (l < 0.05) continue;
          var zt = e.suelo + est.zocalo;
          if (est.zocalo > 0) { añadeMuro('zocalo', A0, B0, suelo, Math.min(zt, arriba), u); añadeMuro(est.muro, A0, B0, Math.min(zt, arriba), arriba, u); }
          else añadeMuro(est.muro, A0, B0, suelo, arriba, u);
          u += l / 2.4;
          // ventanas: una cada ~2,9 m por planta, centradas; fuera = la normal que sale del polígono
          if (l >= 2.6 && e.rect.fondo >= 1.6) {
            var nxv = (B0[1] - A0[1]) / l, nzv = -(B0[0] - A0[0]) / l, mid = [(A0[0] + B0[0]) / 2 + nxv * 0.3, (A0[1] + B0[1]) / 2 + nzv * 0.3];
            if (dentro(mid, an)) { nxv = -nxv; nzv = -nzv; }
            var nV = Math.max(1, Math.floor((l - 1.0) / 2.9));
            for (var pi = 0; pi < e.pisos; pi++) for (var w = 0; w < nV; w++) {
              var t = (w + 0.5) / nV, wx = A0[0] + (B0[0] - A0[0]) * t, wz = A0[1] + (B0[1] - A0[1]) * t;
              var hseed = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233 + pi * 3.1) * 43758.5453) % 1;
              ventanas.push({ x: wx + nxv * 0.03, z: wz + nzv * 0.03, y: e.suelo + 0.25 + pi * est.planta + 1.55, ang: Math.atan2(nxv, nzv), luz: hseed < est.luz, tipo: e.tipo });
            }
          }
        }
        // tejado: las tiras muy estrechas (paredes medianeras, porches) solo llevan muro
        if (e.rect.fondo >= 1.6) {
          var mat = e.tipo === 'vecina' ? matTejaV : matTeja;
          var cima = tejado(e.rect, arriba, e.cubierta, e.tipo === 'vecina' ? 0.45 : 0.6, mat, MAT[est.muro]);
          tops[e.id] = { y: arriba, cima: cima };
        }
      });
      Object.keys(geoMuros).forEach(function (k) {
        var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(geoMuros[k].p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(geoMuros[k].uv, 2)); g.computeVertexNormals();
        var mm = MAT[k].clone(); guarda(mm); mm.side = THREE.DoubleSide;
        var me = new THREE.Mesh(guarda(g), mm); me.castShadow = true; me.receiveShadow = true; finca.add(me);
      });
      // chimeneas que se ven en las fotos: la roja (encalada en rojo) y la de piedra de la casa azul
      [['roja', MAT.roja, 0.25], ['azul', MAT.zocalo, -0.3]].forEach(function (d) {
        var e = m.edificios.filter(function (x) { return x.tipo === d[0] && x.rect.fondo >= 1.6; }).sort(function (a, b) { return b.area - a.area; })[0];
        if (!e || !tops[e.id]) return;
        var rc = e.rect, ch = new THREE.Mesh(guarda(new THREE.BoxGeometry(0.75, 1.6, 0.75)), d[1]);
        ch.position.set(rc.cx + Math.cos(rc.ang) * rc.largo * d[2], tops[e.id].cima + 0.35, rc.cz + Math.sin(rc.ang) * rc.largo * d[2]);
        ch.rotation.y = -rc.ang; ch.castShadow = true; finca.add(ch);
        var cap = new THREE.Mesh(guarda(new THREE.BoxGeometry(1.0, 0.14, 1.0)), matTeja); cap.position.copy(ch.position); cap.position.y += 0.85; cap.rotation.y = -rc.ang; finca.add(cap);
      });
      // el corredor de madera de la casa roja (balcón corrido en la planta alta, como en las fotos)
      (function () {
        var e = m.edificios.filter(function (x) { return x.tipo === 'roja' && x.rect.fondo >= 1.6; }).sort(function (a, b) { return b.area - a.area; })[0];
        if (!e) return;
        var rc = e.rect, c = Math.cos(rc.ang), s = Math.sin(rc.ang);
        // la fachada larga que mira al hórreo
        var hx = m.horreo.x - rc.cx, hz = m.horreo.z - rc.cz, lado = (-s * hx + c * hz) > 0 ? 1 : -1;
        var g = new THREE.Group(), y = e.suelo + 0.25 + 2.9;
        var losa = new THREE.Mesh(guarda(new THREE.BoxGeometry(rc.largo * 0.62, 0.14, 1.1)), MAT.madera); losa.position.set(0, y, 0); g.add(losa);
        var bar = new THREE.Mesh(guarda(new THREE.BoxGeometry(rc.largo * 0.62, 0.08, 0.08)), MAT.madera); bar.position.set(0, y + 1.0, 0.5); g.add(bar);
        for (var k = 0; k <= 14; k++) { var b = new THREE.Mesh(guarda(new THREE.BoxGeometry(0.05, 1.0, 0.05)), MAT.madera); b.position.set(-rc.largo * 0.31 + k * rc.largo * 0.62 / 14, y + 0.5, 0.5); g.add(b); }
        g.position.set(rc.cx - s * (rc.fondo / 2 + 0.55) * lado, 0, rc.cz + c * (rc.fondo / 2 + 0.55) * lado);
        g.rotation.y = -rc.ang + (lado < 0 ? Math.PI : 0);
        g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        finca.add(g);
      })();
      // ventanas: cristal oscuro de día; de noche, unas cuantas encendidas
      var nVen = ventanas.length;
      var vidrio = new THREE.InstancedMesh(guarda(new THREE.PlaneGeometry(0.85, 1.1)), guarda(new THREE.MeshLambertMaterial({ color: '#2a2622', side: THREE.DoubleSide })), nVen);
      var marco = new THREE.InstancedMesh(guarda(new THREE.BoxGeometry(1.05, 1.3, 0.08)), guarda(new THREE.MeshLambertMaterial({ color: '#5a3d2a' })), nVen);
      var encendidas = ventanas.filter(function (v) { return v.luz; });
      var luzV = new THREE.InstancedMesh(guarda(new THREE.PlaneGeometry(0.8, 1.05)), guarda(new THREE.MeshBasicMaterial({ color: '#ffc77a', toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })), Math.max(1, encendidas.length));
      var mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3();
      ventanas.forEach(function (v, k) {
        qt.setFromAxisAngle(eje, v.ang);
        ps.set(v.x, v.y, v.z); mtx.compose(ps, qt, sc); vidrio.setMatrixAt(k, mtx);
        ps.set(v.x - Math.sin(v.ang) * 0.02, v.y, v.z - Math.cos(v.ang) * 0.02); mtx.compose(ps, qt, sc); marco.setMatrixAt(k, mtx);
      });
      encendidas.forEach(function (v, k) { qt.setFromAxisAngle(eje, v.ang); ps.set(v.x + Math.sin(v.ang) * 0.015, v.y, v.z + Math.cos(v.ang) * 0.015); mtx.compose(ps, qt, sc); luzV.setMatrixAt(k, mtx); });
      luzV.count = encendidas.length; luzV.visible = false;
      marco.castShadow = false; finca.add(marco, vidrio, luzV);
      // halos cálidos delante de las ventanas encendidas de la finca (dibujados, sin bloom)
      var haloTex = texDe(64, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,196,120,.85)'); r.addColorStop(0.3, 'rgba(255,190,110,.25)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); });
      var halos = [];
      encendidas.filter(function (v) { return v.tipo !== 'vecina'; }).forEach(function (v) {
        var h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
        guarda(h.material); h.position.set(v.x + Math.sin(v.ang) * 0.4, v.y, v.z + Math.cos(v.ang) * 0.4); h.scale.set(3.2, 3.2, 1); h.visible = false; finca.add(h); halos.push(h);
      });
      var cas = m.edificios.find(function (e) { return e.tipo === 'casona'; });
      luzCasa.position.set(cas.rect.cx + 6, cas.suelo + 3, cas.rect.cz + 9);

      /* --- el hórreo asturiano: cuatro pegoyos con muelas, caja de madera, tejado a cuatro aguas --- */
      var H = m.horreo, horreo = new THREE.Group();
      var hy0 = yDe(H.x, H.z);
      horreo.position.set(H.x, hy0, H.z); horreo.rotation.y = -H.ang;
      var mPiedra = MAT.zocalo, mMad = guarda(new THREE.MeshLambertMaterial({ map: texRep(texMadera('#6f655a', 31)) }));
      var mMadO = guarda(new THREE.MeshLambertMaterial({ color: '#4b4239' }));
      var cajaL = H.caja, sep = cajaL / 2 - 0.45, alturaPeg = 1.55, yMuela = alturaPeg + 0.3, yTrabe = yMuela + 0.12, ySuelo = yTrabe + 0.28, yAlto = ySuelo + 2.05;
      var add = function (geo, mat, x, y, z, ry) { var me = new THREE.Mesh(guarda(geo), mat); me.position.set(x, y, z); if (ry) me.rotation.y = ry; me.castShadow = true; me.receiveShadow = true; horreo.add(me); return me; };
      // suelo empedrado bajo el hórreo
      add(new THREE.BoxGeometry(cajaL + 2.6, 0.12, cajaL + 2.6), mPiedra, 0, 0.0, 0);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
        var x = s[0] * sep, z = s[1] * sep;
        add(new THREE.CylinderGeometry(0.62, 0.7, 0.32, 14), mPiedra, x, 0.16, z);                       // la base de piedra
        add(new THREE.CylinderGeometry(0.23, 0.36, alturaPeg, 4, 1), mMadO, x, 0.3 + alturaPeg / 2, z, Math.PI / 4);   // pegoyo (tronco de pirámide)
        add(new THREE.BoxGeometry(0.42, 0.12, 0.42), mMadO, x, yMuela - 0.06, z);                         // taza
        add(new THREE.BoxGeometry(0.82, 0.12, 0.82), mPiedra, x, yMuela + 0.06, z);                       // muela (la losa contra los ratones)
      });
      // trabes: el bastidor sobre las muelas, que sobresale en las esquinas
      add(new THREE.BoxGeometry(cajaL + 0.5, 0.28, 0.3), mMadO, 0, yTrabe + 0.14, -sep);
      add(new THREE.BoxGeometry(cajaL + 0.5, 0.28, 0.3), mMadO, 0, yTrabe + 0.14, sep);
      add(new THREE.BoxGeometry(0.3, 0.28, cajaL + 0.5), mMadO, -sep, yTrabe + 0.14 + 0.02, 0);
      add(new THREE.BoxGeometry(0.3, 0.28, cajaL + 0.5), mMadO, sep, yTrabe + 0.14 + 0.02, 0);
      // la caja de tablas (colondras) con sus esquinas
      var hC2 = yAlto - ySuelo;
      add(new THREE.BoxGeometry(cajaL, hC2, 0.09), mMad, 0, ySuelo + hC2 / 2, -cajaL / 2 + 0.05);
      add(new THREE.BoxGeometry(cajaL, hC2, 0.09), mMad, 0, ySuelo + hC2 / 2, cajaL / 2 - 0.05);
      add(new THREE.BoxGeometry(0.09, hC2, cajaL), mMad, -cajaL / 2 + 0.05, ySuelo + hC2 / 2, 0);
      add(new THREE.BoxGeometry(0.09, hC2, cajaL), mMad, cajaL / 2 - 0.05, ySuelo + hC2 / 2, 0);
      add(new THREE.BoxGeometry(cajaL - 0.2, 0.08, cajaL - 0.2), mMadO, 0, ySuelo + 0.04, 0);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) { add(new THREE.BoxGeometry(0.2, hC2 + 0.1, 0.2), mMadO, s[0] * (cajaL / 2 - 0.08), ySuelo + hC2 / 2, s[1] * (cajaL / 2 - 0.08)); });
      // la puerta, en la cara que mira a la casona
      add(new THREE.BoxGeometry(0.95, 1.6, 0.05), mMadO, 0, ySuelo + 0.85, -cajaL / 2 - 0.01);
      // vigas de arriba (las «trabes» del tejado)
      add(new THREE.BoxGeometry(cajaL + 0.3, 0.18, 0.2), mMadO, 0, yAlto + 0.09, -cajaL / 2 + 0.1);
      add(new THREE.BoxGeometry(cajaL + 0.3, 0.18, 0.2), mMadO, 0, yAlto + 0.09, cajaL / 2 - 0.1);
      // tejado a cuatro aguas de teja, con su pináculo
      var Lr = H.tejado / 2, subeR = 1.65, yR = yAlto + 0.18;
      (function () {
        var p = [], uv = [], sl = Math.hypot(Lr, subeR);
        var esq = [[-Lr, -Lr], [Lr, -Lr], [Lr, Lr], [-Lr, Lr]];
        for (var k = 0; k < 4; k++) {
          var a = esq[k], b = esq[(k + 1) % 4];
          p.push(a[0], yR, a[1], 0, yR + subeR, 0, b[0], yR, b[1]);
          uv.push(0, 0, Lr / 1.6, sl / 1.6, 2 * Lr / 1.6, 0);
        }
        var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        var me = new THREE.Mesh(guarda(g), matTeja); me.castShadow = true; me.receiveShadow = true; horreo.add(me);
        var bajo = new THREE.Mesh(guarda(new THREE.BoxGeometry(2 * Lr, 0.1, 2 * Lr)), MAT.alero); bajo.position.y = yR - 0.04; bajo.castShadow = true; horreo.add(bajo);
      })();
      add(new THREE.ConeGeometry(0.13, 0.5, 6), mPiedra, 0, yR + subeR + 0.2, 0);
      // tentemozos: los puntales en diagonal desde las trabes hasta las esquinas del alero
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
        var a = new THREE.Vector3(s[0] * (cajaL / 2 + 0.2), yTrabe + 0.1, s[1] * (cajaL / 2 + 0.2));
        var b = new THREE.Vector3(s[0] * (Lr - 0.25), yR - 0.05, s[1] * (Lr - 0.25));
        var l = a.distanceTo(b), me = add(new THREE.BoxGeometry(0.13, l, 0.13), mMadO, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      });
      esc3.add(horreo);
      // mesas de merendero y sombrillas al sur del hórreo (como en las fotos del jardín; colocadas a ojo)
      [[-2.4, 5.4, 0.1], [3.1, 5.0, -0.12]].forEach(function (d) {
        var g = new THREE.Group(), mm = guarda(new THREE.MeshLambertMaterial({ color: '#b08a5c' }));
        var tab = new THREE.Mesh(guarda(new THREE.BoxGeometry(1.9, 0.07, 0.8)), mm); tab.position.y = 0.74; g.add(tab);
        [-0.62, 0.62].forEach(function (z) { var b = new THREE.Mesh(guarda(new THREE.BoxGeometry(1.9, 0.05, 0.28)), mm); b.position.set(0, 0.45, z); g.add(b); });
        [-0.8, 0.8].forEach(function (x) { var p = new THREE.Mesh(guarda(new THREE.BoxGeometry(0.08, 0.74, 1.5)), mm); p.position.set(x, 0.37, 0); g.add(p); });
        var palo = new THREE.Mesh(guarda(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6)), MAT.alero); palo.position.y = 1.2; g.add(palo);
        var lona = new THREE.Mesh(guarda(new THREE.ConeGeometry(1.35, 0.42, 8, 1, true)), guarda(new THREE.MeshLambertMaterial({ color: '#efe6d4', side: THREE.DoubleSide }))); lona.position.y = 2.3; g.add(lona);
        g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        g.position.set(d[0], 0.05, d[1]); g.rotation.y = d[2]; horreo.add(g);
      });

      /* --- árboles alrededor de la finca (copas detectadas en la ortofoto) --- */
      var arb = m.arboles.filter(function (a, k) {
        if (!hiDef && k % 2) return false;
        var dx = a[0] - H.x, dz = a[2] - H.z, d = Math.hypot(dx, dz), az = (Math.atan2(dx, -dz) / RAD + 360) % 360;
        return !(d < 34 && az > 60 && az < 250);                     // nada entre la cámara final y el hórreo
      });
      var copaGeo = new THREE.IcosahedronGeometry(1, 1), cp = copaGeo.attributes.position, rr = azar(77);
      for (i = 0; i < cp.count; i++) {                         // por posición: los vértices repetidos se mueven igual (sin grietas)
        var vx = cp.getX(i), vy = cp.getY(i), vz = cp.getZ(i), hsh = Math.abs(Math.sin(vx * 12.99 + vy * 78.23 + vz * 37.72) * 43758.55) % 1, f = 0.8 + hsh * 0.34;
        cp.setXYZ(i, vx * f, vy * f, vz * f);
      }
      copaGeo.computeVertexNormals(); guarda(copaGeo);
      var copas = new THREE.InstancedMesh(copaGeo, guarda(new THREE.MeshLambertMaterial({ color: '#ffffff' })), arb.length);
      var troncos = new THREE.InstancedMesh(guarda(new THREE.CylinderGeometry(0.18, 0.28, 1, 5)), guarda(new THREE.MeshLambertMaterial({ color: '#4a3d30' })), arb.length);
      var col = new THREE.Color(), base = new THREE.Color('#4f6b3a');
      arb.forEach(function (a, k) {
        var x = a[0], z = a[2], r = a[3], alto = a[4], y0 = yDe(x, z);
        qt.setFromAxisAngle(eje, rr() * 6.28);
        ps.set(x, y0 + alto - r * 0.95, z); sc.set(r, r * (0.85 + rr() * 0.3), r); mtx.compose(ps, qt, sc); copas.setMatrixAt(k, mtx);
        col.set(a[5]); col.lerp(base, 0.45); col.multiplyScalar(1.15 + rr() * 0.2); copas.setColorAt(k, col);
        ps.set(x, y0 + (alto - r) / 2, z); sc.set(1, Math.max(0.5, alto - r), 1); mtx.compose(ps, qt, sc); troncos.setMatrixAt(k, mtx);
      });
      sc.set(1, 1, 1);
      copas.castShadow = troncos.castShadow = true; copas.receiveShadow = true;
      esc3.add(copas, troncos);

      /* --- rótulos (HTML encima del lienzo) --- */
      var rotulos = m.lugares.map(function (l) {
        var li = document.createElement('span');
        li.className = 'lugar__rotulo' + (l.clave === 'amaicha' ? ' lugar__rotulo--casa' : '') + (['casona', 'roja', 'horreo'].indexOf(l.clave) >= 0 ? ' lugar__rotulo--finca' : '');
        li.innerHTML = '<span><b>' + esc(l.nombre) + '</b>' + (l.sub ? '<small>' + esc(l.sub) + '</small>' : '') + '</span>';
        capaRot.appendChild(li);
        var y = l.clave === 'mar' ? l.dy : Math.max(0, altura(l.x, l.z)) * exag(l.x, l.z) + l.dy;
        return { el: li, l: l, v: new THREE.Vector3(l.x, y, l.z), visto: false };
      });
      function tapado(a, b) {                     // ¿el relieve tapa la línea de la cámara al rótulo?
        for (var k = 1; k < 24; k++) {
          var t = k / 24, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
          if (yDe(x, z) > y + 2) return true;
        }
        return false;
      }

      /* --- el cielo de ahora: luces, colores, astros --- */
      var dirSol = new THREE.Vector3(), dirLuna = new THREE.Vector3(), noche = 0;
      var dirDe = function (az, alt, v) { return v.set(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD)); };
      var faseLuna = -1;
      function luces(f) {
        f = f || new Date();
        var s = sol(f), l = luna(f), c = cieloPara(s.alt);
        noche = lim((-s.alt - 2) / 10, 0, 1);
        var dia = lim((s.alt + 4) / 14, 0, 1);
        uCielo.cZ.value.set(c.cz); uCielo.cH.value.set(c.ch);
        dirDe(s.az, s.alt, dirSol); dirDe(l.az, l.alt, dirLuna);
        uCielo.dirSol.value.copy(dirSol);
        uCielo.brillo.value = lim(1 - Math.abs(s.alt - 1) / 14, 0, 1);
        esc3.fog.color.set(mezcla(c.ch, c.cz, 0.12));
        // sol
        luzSol.position.copy(FINCA).addScaledVector(dirSol, 700);
        luzSol.intensity = 2.7 * suave(-1, 10, s.alt);
        luzSol.color.set(mezcla('#fff6ea', '#ff9d5c', lim(1 - s.alt / 22, 0, 1)));
        solS.visible = s.alt > -3; solS.material.opacity = lim((s.alt + 3) / 4, 0, 1);
        // luna
        luzLuna.position.copy(FINCA).addScaledVector(dirLuna, 700);
        luzLuna.intensity = l.alt > 0 ? (0.25 + 0.9 * l.luz) * noche : 0;
        lunaS.visible = l.alt > -1.5 && l.luz > 0.03;
        if (lunaS.visible) { var fk = Math.round(l.fase * 100); if (fk !== faseLuna) { faseLuna = fk; pintarLuna(l.fase); } lunaS.material.opacity = lim((l.alt + 1.5) / 3, 0, 1); }
        // ambiente
        hemi.intensity = lerp(0.45, 1.55, dia);
        hemi.color.set(mezcla('#3c4f86', '#dfe8f0', dia)); hemi.groundColor.set(mezcla('#15131c', '#5d5444', dia));
        estrellas.material.opacity = noche * noche;
        // el mar
        uAgua.cZ.value.set(c.cz); uAgua.cH.value.set(c.ch); uAgua.dirSol.value.copy(dirSol); uAgua.dirLuna.value.copy(dirLuna);
        uAgua.colSol.value.copy(luzSol.color); uAgua.brilloSol.value = suave(-2, 6, s.alt);
        uAgua.brilloLuna.value = l.alt > 0 ? l.luz * noche : 0;
        uAgua.luzAgua.value = lerp(0.1, 1, dia);
        // la casa de noche
        var enc = noche > 0.05;
        luzV.visible = enc; luzV.material.opacity = lim(noche * 1.4, 0, 1);
        halos.forEach(function (h) { h.visible = enc; h.material.opacity = noche * 0.9; });
        luzCasa.intensity = noche * 60;
        ren.shadowMap.needsUpdate = true;
        pedir(true);
      }

      /* --- cámara: el recorrido con el scroll --- */
      var ruta = camino(m.recorrido);
      var vista = { w: 0, h: 0 };
      var hProm = 0;
      function ajustar() {
        var w = escenario.clientWidth, h = escenario.clientHeight;
        if (!w || !h) return;
        if (vista.w === w && Math.abs(vista.h - h) < 160 && vista.h) { if (vista.h !== h) { vista.h = h; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); pedir(true); } return; }
        vista.w = w; vista.h = h;
        ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
        ren.setSize(w, h, false);
        cam.aspect = w / h;
        cam.fov = w / h < 1 ? 56 : w / h < 1.3 ? 46 : 40;          // en vertical se abre para que quepa la costa
        cam.updateProjectionMatrix();
        pedir(true);
      }
      var pAnt = -1, tAgua = 0;
      function situar(p) {
        var r = ruta(p);
        cam.position.set(r.pos[0], r.pos[1], r.pos[2]);
        cam.lookAt(r.mira[0], r.mira[1], r.mira[2]);
        var sobre = Math.max(2, r.pos[1] - Math.max(0, yDe(r.pos[0], r.pos[2])));
        var cerca = lim(sobre * 0.12, 0.4, 25);
        if (Math.abs(cerca - cam.near) / cam.near > 0.1) { cam.near = cerca; cam.updateProjectionMatrix(); }
        hProm = sobre;
      }
      var v3 = new THREE.Vector3();
      function colocarRotulos(p) {
        var w = vista.w, h = vista.h;
        rotulos.forEach(function (r) {
          var ok = p >= r.l.fase[0] && p <= r.l.fase[1];
          if (ok) {
            v3.copy(r.v).project(cam);
            ok = v3.z < 1 && Math.abs(v3.x) < 0.94 && v3.y > -0.9 && v3.y < 0.92;
            if (ok && r.l.clave !== 'mar' && r.l.clave !== 'picos') ok = !tapado(cam.position, r.v);
          }
          if (ok) r.el.style.transform = 'translate3d(' + ((v3.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v3.y) / 2 * h).toFixed(1) + 'px,0)';
          if (ok !== r.visto) { r.visto = ok; r.el.classList.toggle('es-visible', ok); }
        });
      }

      /* --- bucle: pinta solo si hace falta; se para fuera de pantalla --- */
      var raf = 0, tPrev = 0, activo = false, visible = true, sucio = true, primero = true;
      var fpsEl = null, fN = 0, fT0 = 0, tAc = 0, nAc = 0;
      if (q.has('fps')) { fpsEl = document.createElement('p'); fpsEl.className = 'lugar__fps'; escenario.appendChild(fpsEl); }
      function leerScroll() {
        var r = pista.getBoundingClientRect(), recorrido = pista.offsetHeight - escenario.offsetHeight;
        estado.p = recorrido > 0 ? lim(-r.top / recorrido, 0, 1) : 0;
      }
      function paso(t) {
        raf = 0;
        if (estado.destruido || !activo || !visible) return;
        var dt = tPrev ? Math.min(0.1, (t - tPrev) / 1000) : 0.016; tPrev = t;
        leerScroll();
        var k = reduce ? 1 : 1 - Math.exp(-dt * 5.5);                  // inercia suave, independiente de los fps
        var pV = estado.pVis + (estado.p - estado.pVis) * k;
        if (Math.abs(estado.p - pV) < 0.00005) pV = estado.p;
        var mueve = Math.abs(pV - pAnt) > 0.00001;
        estado.pVis = pV;
        var aguaViva = !reduce && pV < 0.62;
        if (mueve || sucio || aguaViva) {
          tAgua += dt; uAgua.tiempo.value = tAgua;
          situar(pV);
          cielo.position.copy(cam.position); estrellas.position.copy(cam.position);
          solS.position.copy(cam.position).addScaledVector(dirSol, 100000);
          lunaS.position.copy(cam.position).addScaledVector(dirLuna, 100000);
          ren.render(esc3, cam);
          colocarRotulos(pV); marcarParada(pV);
          pAnt = pV; sucio = false;
          if (primero) { primero = false; escenario.classList.add('lugar--listo'); estado.cargado = true; }
          if (fpsEl) { fN++; if (!fT0) fT0 = t; if (t - fT0 > 500) { fpsEl.textContent = (fN * 1000 / (t - fT0)).toFixed(0) + ' fps · calidad ' + estado.calidad + ' · DPR ' + ren.getPixelRatio().toFixed(2) + ' · ' + Math.round(hProm) + ' m'; fN = 0; fT0 = t; } }
          tAc += dt; nAc++;
          if (nAc >= 50) { var media = tAc / nAc; tAc = 0; nAc = 0; if (media > 0.03 && estado.calidad < 2 && !document.hidden) bajarCalidad(); }
        }
        raf = requestAnimationFrame(paso);
      }
      function pedir(ensuciar) { if (ensuciar) sucio = true; if (!raf && activo && visible && !estado.destruido) { tPrev = 0; raf = requestAnimationFrame(paso); } }
      function bajarCalidad() {
        estado.calidad++;
        if (estado.calidad === 1) { ren.setPixelRatio(1); ren.setSize(vista.w, vista.h, false); }
        if (estado.calidad === 2) { ren.shadowMap.enabled = false; luzSol.castShadow = false; ren.setPixelRatio(0.8); ren.setSize(vista.w, vista.h, false); esc3.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
        pedir(true);
      }
      var alRedim = new ResizeObserver(function () { ajustar(); });
      alRedim.observe(escenario);
      var io = new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) pedir(true); else { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '120px' });
      io.observe(pista);
      var alScroll = function () { pedir(false); };
      escucha(window, 'scroll', alScroll, { passive: true });
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); estado.error3d = 'contexto perdido'; ponModo('plano'); });

      ajustar();
      luces();
      // compila antes de enseñar (evita el tirón del primer fotograma)
      try { ren.compile(esc3, cam); } catch (e) { /* sin compilación previa */ }

      t3 = {
        luces: luces,
        activo: function (si) { activo = si; cv.hidden = !si; if (si) { vista.w = 0; ajustar(); pedir(true); } else { cancelAnimationFrame(raf); raf = 0; } },
        estado: function () { return { p: estado.p, pVis: estado.pVis, calidad: estado.calidad, near: cam.near, fov: cam.fov, triangulos: ren.info.render.triangles, llamadas: ren.info.render.calls, ventanas: nVen, arboles: arb.length }; },
        destruir: function () {
          cancelAnimationFrame(raf); raf = 0; alRedim.disconnect(); io.disconnect();
          disponer.forEach(function (o) { try { o.dispose(); } catch (e) { /* ya */ } });
          esc3.traverse(function (o) { if (o.material && o.material.dispose) o.material.dispose(); });
          try { ren.dispose(); ren.forceContextLoss(); } catch (e) { /* ya */ }
          cv.remove();
        },
      };
      return t3;
    }

    /* ---------- mandos ---------- */
    function activar3d(desdeBoton) {
      ponModo('3d');
      if (desdeBoton) el.scrollIntoView({ block: 'start', behavior: 'auto' });
      cargar3d().then(function (t) { if (t && !estado.destruido && estado.modo === '3d') t.activo(true); });
    }
    $('a3d').addEventListener('click', function () { activar3d(true); });
    $('aplano').addEventListener('click', function () { ponModo('plano'); el.scrollIntoView({ block: 'start', behavior: 'auto' }); });
    var alRedimPlano = new ResizeObserver(function () { colocarMarcas(); });
    alRedimPlano.observe(el);
    escuchas.push(function () { alRedimPlano.disconnect(); });

    cieloTexto();
    intervalo = setInterval(function () { if (!document.hidden) cieloTexto(); }, 60000);
    marcarParada(0);
    if (auto3d) activar3d(false); else ponModo('plano');
    el.dataset.montado = '1';

    return {
      destruir: function () {
        estado.destruido = true;
        clearInterval(intervalo);
        escuchas.forEach(function (f) { f(); });
        if (t3) t3.destruir();
        t3 = null;
        el.classList.remove('lugar'); delete el.dataset.modo; delete el.dataset.montado;
        el.style.removeProperty('--lugar-noche');
        el.innerHTML = respaldo;
      },
      estado: function () { return { modo: estado.modo, puede3d: puede3d, auto3d: auto3d, error3d: estado.error3d, cargado: estado.cargado, t3: t3 ? t3.estado() : null }; },
      ver3d: function () { activar3d(false); },
      verPlano: function () { ponModo('plano'); },
    };
  }

  A.lugar = { montar: montar, sol: sol, luna: luna, fraseCielo: fraseCielo, cieloPara: cieloPara, camino: camino, monotona: monotona };
})();
