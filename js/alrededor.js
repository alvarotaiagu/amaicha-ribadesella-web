/* ------------------------------------------------------------------
   Amaicha · alrededor.js · el mapa de «Alrededor»
   La lista de sitios (con sus cifras de OSRM, que pone construir.mjs) es el mando: al pulsar uno, el mapa vuela hasta
   él, la ruta en coche se dibuja desde la casa y, si hay camino a pie, aparece en discontinua. Una ficha da tiempo,
   distancia, carreteras y el enlace a la ruta en Google Maps.
   Datos: data/alrededor-mapa.json (scripts/alrededor-mapa.mjs): metros alrededor de la casa, x al este, y al sur.
   Contrato de main.js: Amaicha.alrededor.montar(el, { movimiento, densidad, webgl }) → { destruir(), listo }.
   El respaldo (la foto aérea y la lista) es el HTML que trae el: si algo falla, main.js lo repone.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var A = window.Amaicha = window.Amaicha || {};
  var NS = 'http://www.w3.org/2000/svg';

  function svg(tag, at, padre) {
    var n = document.createElementNS(NS, tag);
    for (var k in at) n.setAttribute(k, at[k]);
    if (padre) padre.appendChild(n);
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lista(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }
  var suave = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  A.alrededor = {
    montar: function (el, op) {
      var movimiento = !!(op && op.movimiento);
      var hueco = el.querySelector('.mapa');
      var lis = [].slice.call(el.querySelectorAll('.esc__lista li[data-ruta]'));
      if (!hueco || !lis.length) return { destruir: function () {} };

      var vivo = true, datos = null, W = 0, H = 0, vb = null, destino = null, vuelo = 0, sel = null, primera = true;
      var limpiar = [];
      function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); limpiar.push(function () { t.removeEventListener(ev, fn, o); }); }

      /* ---------- la lista se vuelve mando ---------- */
      var botones = {};
      lis.forEach(function (li) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'esc__btn'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-controls', 'mapa-lienzo');
        while (li.firstChild) b.appendChild(li.firstChild);
        li.appendChild(b);
        botones[li.dataset.ruta] = b;
        on(b, 'click', function () { elegir(li.dataset.ruta, true); });
        on(b, 'pointerenter', function (e) { if (e.pointerType === 'mouse') vista(li.dataset.ruta, true); });
        on(b, 'pointerleave', function () { vista(li.dataset.ruta, false); });
      });

      /* ---------- el lienzo ---------- */
      hueco.innerHTML =
        '<div class="mapa__lienzo" id="mapa-lienzo">' +
          '<svg class="mapa__svg" role="img" aria-label="Mapa de los alrededores de Amaicha" preserveAspectRatio="none"></svg>' +
          '<ol class="mapa__marcas" aria-hidden="true"></ol>' +
        '</div>' +
        '<div class="mapa__ficha" aria-live="polite"></div>' +
        '<p class="mapa__fuente">Mapa: © colaboradores de OpenStreetMap (ODbL). Rutas: OSRM y routing.openstreetmap.de.</p>';
      var lienzo = hueco.querySelector('.mapa__lienzo'), raiz = hueco.querySelector('svg'), marcas = hueco.querySelector('.mapa__marcas'), ficha = hueco.querySelector('.mapa__ficha');
      el.classList.add('con-mapa');

      var capas = {}, rutasSvg = {}, selCoche, selPie, selCasco, marcasPorId = {}, marcaCasa, rotulosExtra = [];

      function pintar(d) {
        var gMar = svg('g', { class: 'm-mar' }, raiz);
        d.niveles.forEach(function (n) {
          var g = svg('g', { class: 'm-nivel', 'data-nivel': n.nombre }, gMar);
          svg('path', { d: n.d, class: 'm-agua' }, g);
          n.islas.forEach(function (i) { svg('path', { d: i, class: 'm-isla' }, g); });
          svg('path', { d: n.costa, class: 'm-costa' }, g);
          capas[n.nombre] = { g: g, n: n };
        });
        if (d.picos) svg('path', { d: d.picos, class: 'm-picos' }, raiz);
        var gR = svg('g', { class: 'm-rutas' }, raiz);
        Object.keys(d.rutas).forEach(function (id) {
          rutasSvg[id] = svg('path', { d: d.rutas[id].coche, class: 'm-ruta' }, gR);
        });
        selCasco = svg('path', { class: 'm-sel-casco', pathLength: 1 }, raiz);
        selPie = svg('path', { class: 'm-sel-pie' }, raiz);
        selCoche = svg('path', { class: 'm-sel', pathLength: 1 }, raiz);

        // marcas en HTML encima (tamaño fijo en pantalla aunque el mapa se acerque)
        function marca(cls, x, y, txt, id) {
          var li = document.createElement('li');
          li.className = 'mapa__marca ' + cls; li.dataset.x = x; li.dataset.y = y;
          li.innerHTML = '<span>' + esc(txt) + '</span>';
          if (id) li.dataset.ruta = id;
          marcas.appendChild(li);
          return li;
        }
        d.ciudades.forEach(function (c) { rotulosExtra.push({ li: marca('mapa__marca--ciudad', c.x, c.y, c.nombre), min: 45000 }); });
        var ps = d.cumbres.filter(function (c) { return /Peña Santa/.test(c.nombre); })[0] || d.cumbres[0];
        if (ps) rotulosExtra.push({ li: marca('mapa__marca--picos', ps.x, ps.y, 'Picos de Europa'), min: 14000 });
        lis.forEach(function (li) {
          var r = d.rutas[li.dataset.ruta]; if (!r) return;
          marcasPorId[li.dataset.ruta] = marca('mapa__marca--sitio', r.x, r.y, li.querySelector('b').textContent, li.dataset.ruta);
        });
        marcaCasa = marca('mapa__marca--casa', 0, 0, 'Amaicha');
      }

      /* ---------- encuadre ---------- */
      function medir() {
        var r = lienzo.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
      }
      function fichaArriba() {       // en escritorio la ficha va encima del mapa, arriba a la izquierda
        if (getComputedStyle(ficha).position !== 'absolute') return 0;
        return Math.min(.45, (ficha.offsetHeight + 24) / H);
      }
      function encuadre(id) {
        var c = datos.rutas[id].caja;
        var cx = (c[0] + c[2]) / 2, cy = (c[1] + c[3]) / 2;
        var pw = Math.max(c[2] - c[0], 1400) * 1.3, ph = Math.max(c[3] - c[1], 1400) * 1.3;
        var m = fichaArriba(), asp = W / (H * (1 - m));
        if (pw / ph > asp) ph = pw / asp; else pw = ph * asp;
        var h = ph / (1 - m);
        return { cx: cx, cy: cy - (m * h) / 2, w: pw };
      }
      function aplicar(v) {
        vb = v;
        var w = v.w, h = w * H / W, x = v.cx - w / 2, y = v.cy - h / 2;
        raiz.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
        raiz.style.setProperty('--px', w / W);
        // nivel de detalle de la costa: el más fino que cubra toda la vista
        var elegido = null;
        datos.niveles.forEach(function (n) {
          var k = n.caja; // [x0, y0, x1, y1]
          if (!elegido && w <= n.ancho_max && x >= k[0] && x + w <= k[2] && y + h <= k[3]) elegido = n.nombre;
        });
        if (!elegido) elegido = datos.niveles[datos.niveles.length - 1].nombre;
        for (var k in capas) capas[k].g.style.display = k === elegido ? '' : 'none';
        // marcas
        [].forEach.call(marcas.children, function (li) {
          var px = (li.dataset.x - x) / w * W, py = (li.dataset.y - y) / h * H;
          li.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
          li.classList.toggle('fuera', px < 6 || px > W - 6 || py < 6 || py > H - 6);
          li.classList.toggle('a-la-izq', px > W * .72);
        });
        rotulosExtra.forEach(function (r) { r.li.classList.toggle('oculta', w < r.min); });
      }
      function volar(hasta, animar) {
        cancelAnimationFrame(vuelo);
        if (!animar || !vb) { aplicar(hasta); return; }
        var de = vb, t0 = performance.now(), dur = 1100;
        var lw0 = Math.log(de.w), lw1 = Math.log(hasta.w);
        (function paso(t) {
          if (!vivo) return;
          var k = suave(Math.min(1, (t - t0) / dur));
          aplicar({ cx: de.cx + (hasta.cx - de.cx) * k, cy: de.cy + (hasta.cy - de.cy) * k, w: Math.exp(lw0 + (lw1 - lw0) * k) });
          if (k < 1) vuelo = requestAnimationFrame(paso);
        })(t0);
      }

      /* ---------- elegir un sitio ---------- */
      function vista(id, si) { if (rutasSvg[id]) rutasSvg[id].classList.toggle('es-vista', si && id !== sel); }
      function rellenarFicha(id) {
        var li = lis.filter(function (l) { return l.dataset.ruta === id; })[0], b = botones[id];
        var grupo = li.closest('.esc').querySelector('.esc__tit').firstChild.textContent.trim();
        var carr = (li.dataset.carreteras || '').split(' · ').filter(Boolean);
        var coche = b.querySelector('.esc__coche'), pie = b.querySelector('.esc__pie');
        var casa = datos.casa;
        var url = 'https://www.google.com/maps/dir/?api=1&origin=' + casa.lat + ',' + casa.lon + '&destination=' + li.dataset.lat + ',' + li.dataset.lon + '&travelmode=driving';
        ficha.innerHTML =
          '<p class="ficha__grupo">' + esc(grupo) + '</p>' +
          '<h3 class="ficha__tit">' + esc(li.querySelector('b').textContent) + '</h3>' +
          '<div class="ficha__datos"></div>' +
          (carr.length ? '<p class="ficha__por">Por ' + esc(lista(carr)) + '</p>' : '') +
          '<a class="ficha__ir" href="' + url + '" target="_blank" rel="noopener">Abrir la ruta en Google Maps<span aria-hidden="true"> ↗</span></a>';
        var dd = ficha.querySelector('.ficha__datos');
        dd.appendChild(coche.cloneNode(true));
        if (pie) dd.appendChild(pie.cloneNode(true));
      }
      function elegir(id, animar) {
        if (!datos || !datos.rutas[id]) return;
        var cambia = sel !== id;
        sel = id;
        Object.keys(botones).forEach(function (k) { botones[k].setAttribute('aria-pressed', String(k === id)); });
        Object.keys(rutasSvg).forEach(function (k) { rutasSvg[k].classList.remove('es-vista'); rutasSvg[k].classList.toggle('es-elegida', k === id); });
        Object.keys(marcasPorId).forEach(function (k) { marcasPorId[k].classList.toggle('es-elegida', k === id); });
        rellenarFicha(id);
        raiz.setAttribute('aria-label', 'Mapa: ruta de Amaicha a ' + lis.filter(function (l) { return l.dataset.ruta === id; })[0].querySelector('b').textContent);
        var r = datos.rutas[id];
        selCoche.setAttribute('d', r.coche); selCasco.setAttribute('d', r.coche);
        selPie.setAttribute('d', r.pie || ''); selPie.classList.remove('se-ve');
        volar(encuadre(id), animar && movimiento);
        if (!cambia && !primera) return;
        primera = false;
        if (movimiento && animar) {
          [selCoche, selCasco].forEach(function (p) {
            p.getAnimations && p.getAnimations().forEach(function (a) { a.cancel(); });
            p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1500, delay: 350, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'both' });
          });
          if (r.pie) setTimeout(function () { if (vivo && sel === id) selPie.classList.add('se-ve'); }, 1500);
        } else if (r.pie) selPie.classList.add('se-ve');
      }

      /* ---------- datos y arranque ---------- */
      var listo = fetch('data/alrededor-mapa.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('alrededor-mapa.json ' + r.status); return r.json(); })
        .then(function (d) {
          if (!vivo) return;
          datos = d;
          pintar(d);
          medir();
          var primero = lis[0].dataset.ruta;
          // la primera ruta se dibuja cuando el mapa entra en pantalla
          if ('IntersectionObserver' in window && movimiento) {
            elegir(primero, false);
            selCoche.style.strokeDashoffset = selCasco.style.strokeDashoffset = 1;
            var io = new IntersectionObserver(function (es) {
              if (!es[0].isIntersecting) return;
              io.disconnect();
              selCoche.style.strokeDashoffset = selCasco.style.strokeDashoffset = '';
              primera = true; elegir(sel, true);
            }, { threshold: .35 });
            io.observe(lienzo);
            limpiar.push(function () { io.disconnect(); });
          } else elegir(primero, false);
          if ('ResizeObserver' in window) {
            var anchoAntes = W, altoAntes = H;
            var ro = new ResizeObserver(function () {
              medir();
              if (Math.abs(W - anchoAntes) < 1 && Math.abs(H - altoAntes) < 1) return;
              anchoAntes = W; altoAntes = H;
              if (sel) volar(encuadre(sel), false);
            });
            ro.observe(lienzo);
            limpiar.push(function () { ro.disconnect(); });
          }
          // las marcas de los sitios también eligen
          on(marcas, 'click', function (e) { var li = e.target.closest('[data-ruta]'); if (li) elegir(li.dataset.ruta, true); });
          lienzo.dataset.listo = '';
        });

      return {
        listo: listo,
        destruir: function () {
          vivo = false;
          cancelAnimationFrame(vuelo);
          limpiar.forEach(function (f) { f(); });
          el.classList.remove('con-mapa');
        }
      };
    }
  };
})();
