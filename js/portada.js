/* =====================================================================
   Amaicha · portada «La greca» (módulo de la Web): Amaicha.portada.montar(el, { movimiento, densidad, webgl })
   El rombo de la greca del logo es la ventana a la foto del hórreo. Al bajar se abre escalón a escalón:
     1. el cuadrado del centro se recoge (y se ve el hórreo entero dentro del rombo);
     2. el anillo medio sale hacia fuera y se funde con el de fuera;
     3. el anillo de fuera, con sus ganchos, va dando pasos de una banda (un «escalón» de la greca) hasta que la foto
        llena la pantalla; la foto se aleja (escala 1,3 → 1) y se recoloca, y el dibujo se desvanece al final.
   Gesto (§5 bis): arrastrar en horizontal sobre la portada desplaza la foto dentro de la ventana («asomarse»); al
   soltar vuelve con un muelle. touch-action: pan-y, así que el scroll vertical sigue siendo de la página.
   Sin movimiento (movimiento reducido o versión sobria) no hace nada: se queda el respaldo del HTML (la ventana
   abierta hasta el anillo de fuera, sin fijar). Geometría: #datos-greca (marca/greca.json, scripts/marca-greca.py).
   El bucle solo corre con la portada en pantalla (IntersectionObserver) y no escribe nada si nada cambió.
   ===================================================================== */
(function () {
  'use strict';
  const A = (window.Amaicha = window.Amaicha || {});
  const SQ2 = Math.SQRT2;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const suave = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const tramo = (p, a, b) => suave((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const acotar = (v, a, b) => Math.min(b, Math.max(a, v));
  const rect = (x0, y0, x1, y1, inv) => { const p = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; if (inv) p.reverse(); return 'M' + p.map(([x, y]) => r3(x) + ' ' + r3(y)).join(' ') + 'Z'; };
  const anillo = (r0, r1) => rect(-r1, -r1, r1, r1) + rect(-r0, -r0, r0, r0, true);

  function datos() {
    try { return JSON.parse(document.getElementById('datos-greca').textContent); } catch (e) { return null; }
  }

  function montar(el, op) {
    const G = datos();
    const sec = el.closest('.portada');
    const fija = sec && sec.querySelector('.portada__fija');
    const ventana = el.querySelector('.portada__ventana');
    const svg = el.querySelector('.portada__marco');
    const grupo = svg && svg.querySelector('g');
    const pic = ventana && ventana.querySelector('picture');
    const img = pic && pic.querySelector('img');
    const puede = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('clip-path', 'path("M0 0L1 0L1 1Z")');
    el.dataset.montado = '1';
    if (!G || !fija || !grupo || !img || !op || !op.movimiento || !puede) return { destruir() { delete el.dataset.montado; }, activa: false };

    const texto = fija.querySelector('.portada__texto');
    const [[, mo], [a]] = G.anillos;
    const paso = 1 + G.medidas.g;          // un escalón = una banda y un hueco
    const S0 = 1.3;                        // la foto empieza cerca y se aleja
    const grupoAntes = grupo.innerHTML;

    /* ---- capas: la foto pasa a ocupar la escena entera, recortada por el rombo ---- */
    const foto = document.createElement('div');
    foto.className = 'portada__foto';
    foto.setAttribute('aria-hidden', 'false');
    fija.prepend(foto);
    foto.appendChild(pic);
    const velo = document.createElement('div');
    velo.className = 'portada__velo';
    const pie = document.createElement('p');
    pie.className = 'portada__pie';
    pie.textContent = 'El hórreo, en el jardín de la casa.';
    fija.append(velo, pie);

    // el dibujo: anillo de fuera, los dos pares de ganchos (cada uno se mueve con su esquina), anillo medio y centro
    const enEsquinaA = (r) => (r[0] + r[2]) / 2 - (r[1] + r[3]) / 2 > 0;
    const gA = G.rects.filter(enEsquinaA).map((r) => rect(...r)).join('');
    const gB = G.rects.filter((r) => !enEsquinaA(r)).map((r) => rect(...r)).join('');
    const h = G.macizo, pt = G.punto;
    const centro = rect(-h, -h, h, h) + `M${r3(pt)} 0A${r3(pt)} ${r3(pt)} 0 0 0 ${r3(-pt)} 0A${r3(pt)} ${r3(pt)} 0 0 0 ${r3(pt)} 0Z`;
    grupo.innerHTML = `<path class="pg-fuera" d="${anillo(a, a + 1)}"/><path class="pg-gancho" d="${gA}"/><path class="pg-gancho" d="${gB}"/>`
      + `<path class="pg-medio" d="${anillo(mo - 1, mo)}"/><path class="pg-centro" d="${centro}"/>`;
    const [pFuera, pGA, pGB, pMedio, pCentro] = grupo.querySelectorAll('path');
    sec.classList.add('es-greca');

    /* ---- medidas (al montar y en los resize de verdad; la barra del móvil no cuenta: lo filtra main.js) ---- */
    let M = null;
    function medir() {
      const W = fija.clientWidth, H = fija.clientHeight;
      const fr = fija.getBoundingClientRect(), br = el.getBoundingClientRect();
      const cx = br.left - fr.left + br.width / 2, cy = br.top - fr.top + br.height / 2;
      const unidad = br.width / (2 * G.semi.ancho);
      const Rmax = (Math.max(cx, W - cx) + Math.max(cy, H - cy)) / (unidad * SQ2) + 0.4;
      const K = Math.max(3, Math.ceil((Rmax - a) / paso));
      // la pista: unos 14 svh por escalón, entre 180 y 300
      sec.style.setProperty('--pista', acotar(110 + K * 14, 180, 300) + 'svh');
      const iw = G.foto.ancho, ih = G.foto.alto;
      const c = Math.max(W / iw, H / ih), dw = iw * c, dh = ih * c, ox = (W - dw) / 2, oy = (H - dh) / 2;
      const fx = ox + G.foco[0] * dw, fy = oy + G.foco[1] * dh;
      const lim = (s) => ({ x0: W - s * (ox + dw), x1: -s * ox, y0: H - s * (oy + dh), y1: -s * oy });
      const L0 = lim(S0);
      const tx0 = acotar(cx - S0 * fx, L0.x0, L0.x1), ty0 = acotar(cy - S0 * fy, L0.y0, L0.y1);
      M = { W, H, cx, cy, unidad, K, Rmax, tx0, ty0, lim };
      ultimo = -1;
    }

    /* ---- el gesto: arrastrar en horizontal desplaza la foto («asomarse»); al soltar, muelle ---- */
    let dx = 0, vx = 0, tocando = false, x0 = 0, dx0 = 0, idPuntero = null;
    const abajo = (e) => {
      if (e.button > 0 || idPuntero !== null) return;
      idPuntero = e.pointerId; tocando = true; x0 = e.clientX; dx0 = dx; vx = 0;
      despertar();
    };
    const mover = (e) => {
      if (!tocando || e.pointerId !== idPuntero) return;
      const tope = M.W * 0.14;
      const bruto = dx0 + (e.clientX - x0) * 0.7;
      const nuevo = Math.abs(bruto) > tope ? Math.sign(bruto) * (tope + (Math.abs(bruto) - tope) * 0.25) : bruto;   // goma al final
      vx = nuevo - dx; dx = nuevo;
      despertar();
    };
    const arriba = (e) => { if (e.pointerId !== idPuntero) return; tocando = false; idPuntero = null; despertar(); };
    fija.addEventListener('pointerdown', abajo);
    addEventListener('pointermove', mover, { passive: true });
    addEventListener('pointerup', arriba);
    addEventListener('pointercancel', arriba);

    /* ---- un fotograma ---- */
    let ultimo = -1, raf = 0, visible = true;
    const escalon = (f) => suave(acotar((f - 0.22) / 0.78, 0, 1));   // cada paso: un rato quieto y luego avanza
    function progreso() {
      const r = sec.getBoundingClientRect();
      const pista = sec.offsetHeight - M.H;
      return pista > 0 ? acotar(-r.top / pista, 0, 1) : 0;
    }
    function pintar(p) {
      const s1 = tramo(p, 0.03, 0.15), s2 = tramo(p, 0.17, 0.31), u = acotar((p - 0.35) / 0.58, 0, 1);
      let R = a;
      if (u > 0) { const s = u * M.K, k = Math.floor(s); R = a + (k >= M.K ? M.K : k + escalon(s - k)) * paso; }
      const D = R * M.unidad * SQ2 + 0.5;
      const { cx, cy } = M;
      foto.style.clipPath = `path('M${r3(cx)} ${r3(cy - D)}L${r3(cx + D)} ${r3(cy)}L${r3(cx)} ${r3(cy + D)}L${r3(cx - D)} ${r3(cy)}Z')`;
      pCentro.setAttribute('transform', `scale(${r3(Math.max(0.0001, 1 - s1))})`);
      pCentro.style.opacity = String(1 - s1);
      pMedio.setAttribute('transform', `scale(${r3(1 + s2 * ((a + 1) / mo - 1))})`);
      pMedio.style.opacity = String(1 - s2);
      pFuera.setAttribute('d', anillo(R, R + 1));
      const d = r3(R - a);
      pGA.setAttribute('transform', `translate(${d} ${-d})`);
      pGB.setAttribute('transform', `translate(${-d} ${d})`);
      svg.style.opacity = String(1 - tramo(u, 0.6, 0.97));
      // la foto: de cerca y con el hórreo en el centro de la ventana a la foto entera
      const t = suave(u);
      const s = lerp(S0, 1, t);
      const L = M.lim(s);
      const tx = acotar(lerp(M.tx0, 0, t) + dx, L.x0, L.x1), ty = acotar(lerp(M.ty0, 0, t), L.y0, L.y1);
      img.style.transform = `translate(${r3(tx)}px, ${r3(ty)}px) scale(${r3(s)})`;
      const ot = 1 - tramo(p, 0.3, 0.42);
      texto.style.opacity = String(ot);
      texto.style.transform = ot < 1 ? `translateY(${r3(-28 * (1 - ot))}px)` : '';
      texto.style.visibility = ot < 0.02 ? 'hidden' : '';
      const fin = tramo(p, 0.9, 1);
      velo.style.opacity = pie.style.opacity = String(fin);
      inst.estado = { p, R, K: M.K, s, dx };
    }
    function bucle() {
      raf = 0;
      if (!M) return;
      // muelle del gesto
      let moviendo = false;
      if (!tocando && Math.abs(dx) > 0.3) { vx = vx * 0.8 - dx * 0.12; dx += vx; moviendo = true; } else if (!tocando) { dx = 0; vx = 0; }
      const p = progreso();
      const clave = r3(p) + '|' + r3(dx);
      if (clave !== ultimo) { ultimo = clave; pintar(p); }
      if (visible || moviendo || tocando) raf = requestAnimationFrame(bucle);
    }
    function despertar() { if (!raf) raf = requestAnimationFrame(bucle); }

    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) despertar(); }, { rootMargin: '200px 0px' });
    io.observe(sec);
    const alResize = () => { medir(); despertar(); };
    document.addEventListener('amaicha:resize', alResize);
    // las letras cambian la altura del texto en móvil (y con ello el sitio de la greca): se vuelve a medir
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (M) alResize(); });

    const inst = {
      activa: true,
      estado: null,
      destruir() {
        cancelAnimationFrame(raf); raf = 0;
        io.disconnect();
        document.removeEventListener('amaicha:resize', alResize);
        fija.removeEventListener('pointerdown', abajo);
        removeEventListener('pointermove', mover);
        removeEventListener('pointerup', arriba);
        removeEventListener('pointercancel', arriba);
        img.style.transform = '';
        ventana.appendChild(pic);
        foto.remove(); velo.remove(); pie.remove();
        grupo.innerHTML = grupoAntes;
        svg.style.opacity = '';
        texto.style.opacity = texto.style.transform = texto.style.visibility = '';
        sec.classList.remove('es-greca');
        sec.style.removeProperty('--pista');
        delete el.dataset.montado;
      },
    };
    medir();
    pintar(progreso());
    despertar();
    return inst;
  }

  A.portada = { montar };
})();
