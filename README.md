# Amaicha · «La greca»

Propuesta de web para **Amaicha**, hotel y apartamentos rurales en Camango 44 (33568 Ribadesella, Asturias). Tienen web
(WordPress, amaicha.es) y no han encargado esta. Una sola página (`index.html`) más legales y 404. **En local, sin
publicar y sin commits.** `noindex, nofollow` en todas las páginas. Solo castellano.

Datos: `ref/DATOS-AMAICHA.md` (lo que no está ahí va a `PENDIENTES.md` o se marca «por confirmar»). Encargo:
`ENCARGO.md`. El 3D («Del acantilado al hórreo») es del agente Lugar 3D: sus notas, en [`LUGAR.md`](LUGAR.md).

## El concepto

Su logo es una **greca**: un rombo de anillos concéntricos con cuatro ganchos. La web la convierte en la ventana de la
casa. En la portada, la greca entera, en su taupe, sobre el verde casi negro del monte; lo que en el logo es papel aquí
es **la foto del hórreo**. Al bajar, la greca **se abre escalón a escalón**: primero se recoge el cuadrado del centro,
luego el anillo medio sale hacia fuera y se funde con el de fuera, y después el anillo de fuera, con sus ganchos, da
pasos de una banda (cada paso, un «escalón» del dibujo) hasta que la foto llena la pantalla. La foto se aleja mientras
tanto (de 1,3 a 1) y se recoloca: hay profundidad, no una tarjeta encima de una foto. Lo que la portada abre, el **pie
lo cierra**: el logo del pie se cierra de fuera adentro al llegar.

El resto de la web hereda el rombo **con mesura**: el cuadrado girado que marca lo activo (pestaña, estancia, enlace
de la cabecera), los escalones de las distancias, las esquinas en escalón del foco del teclado y el logo. Nada de
empapelar.

Lectura de diseño (skill `design-taste-frontend`): web de alojamiento rural premium para quien decide y reserva, con
lenguaje de marca (la greca), moderna y sobria; dials 7 / 6 / 3. Una sola página clara con tres campos oscuros (la
portada, el lugar y el pie); arista viva en todo (radio 0, como la greca); sin modo oscuro (como sus hermanas).

### Las letras (Google Fonts, `display=swap`, tres y ninguna más)

Ninguna está en la cartera (`verificar.mjs` lo comprueba con un grep en `../*-web/*.html` y `../*-web/css`):

- **Encode Sans** (titulares): grotesca de ancho variable (75–125 %); se usa ancha (112–116 %) y en peso medio, que
  casa con la geometría de la greca sin imitarla.
- **Gantari** (texto): geométrica-humanista, legible a tamaños pequeños.
- **Sono** (cifras: habitaciones, notas, km, minutos, el calendario): monoespaciada de cifras tabulares.

### Los colores (cinco, ninguno más; el resto son mezclas `color-mix`)

| Token | Color | Uso |
|---|---|---|
| `--niebla` | `#EDEFEA` | fondo (frío, verdoso; no crema) |
| `--monte` | `#17211C` | texto y campos oscuros (portada, el lugar, el pie) |
| `--prado` | `#DFE4DC` | superficie: paneles, desayuno, reseñas, el buscador |
| `--greca` | `#836759` | **el taupe exacto del logo** (mediana de sus píxeles opacos): la greca, iconos, filetes |
| `--teja` | `#9C3324` | acento: el rojo de la casa roja y de la teja; botones de reservar y marcas activas |

Contrato con Lugar 3D: `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca` (= `--greca`), `--acento`
(= `--teja`), `--linea`, `--letra-titular`, `--letra-texto`, `--letra-cifras`, en `:root` de `css/base.css`.
La greca como texto pequeño usa `--marca-texto` (más oscura); sobre `--monte`, `--marca-clara`.

## Las secciones

1. **Portada «La greca»** (`js/portada.js`, `Amaicha.portada`). Respaldo (sin JS, movimiento reducido y versión
   sobria): la ventana ya abierta hasta el anillo de fuera, con el hórreo dentro, sin fijar. Gesto (§5 bis):
   arrastrar en horizontal sobre la portada desplaza la foto dentro de la ventana («asomarse»); al soltar vuelve con
   un muelle (`touch-action: pan-y`: el scroll vertical sigue siendo de la página).
2. **Tres formas de quedarse**: hotel (7 dobles + 1 individual), apartamentos (2, de 4 personas), casa entera (para el
   grupo). Pestañas con la cifra grande; cada ficha con su foto sin marco, cifras grandes, servicios con **icono
   propio** (sprite `partes/iconos.html`, trazo 1,6 y arista viva) y condiciones aparte. «Ver fechas» baja al
   buscador con ese tipo marcado.
3. **Desayuno casero**: lo que hay, en grande, y lo de las intolerancias.
4. **La casa por estancias**: índice fijo que marca la estancia que se ve (en móvil, cuatro pestañas cortas), fotos sin
   marco en filas de la misma altura (cada foto crece en proporción a su ancho/alto) y el visor que abre por NOMBRE.
5. **Del acantilado al hórreo** (`#lugar`): el 3D de Lugar 3D. Respaldo de la Web: la foto del jardín con el hórreo.
6. **Alrededor**: la escalera de distancias (costa, pueblos, Picos, aeropuertos; cada grupo, un escalón más abajo),
   todas de OSRM; la costa también a pie. Con la vista aérea de su motor.
7. **Reseñas**: 9,6 sobre 10 con 198 reseñas en Google (hay recuento de sobra para decirlo), 9,6 / 9,6 / 9,9 por tipo
   y el enlace a la ficha.
8. **Reservar**: buscador propio (calendario, adultos 1–12, niños 0–12, tipo) que **crea** el iframe de su Amenitiz
   real al pulsar «Buscar en su motor». Aviso visible: «Es su motor de reservas real». Alternativa: teléfono y correo.
9. **Cómo llegar**: dirección, teléfono, correo, Facebook, las distancias clave y el mapa de Google tras pulsar.

Legales (aviso legal, privacidad, cookies, accesibilidad) con el titular de DATOS (Cristina Durand Zurdo, NIF
02653919H); registro turístico «por confirmar». Aviso de cookies. 404 con la greca.

## El motor de reservas (REAL)

**Amenitiz acepta la búsqueda por URL.** Comprobado con Playwright el 2026-11-25: al buscar en su motor, la dirección
pasa a `…/es/booking/room?start_date=2026-12-10&end_date=2026-12-12&adults=2&children=0`, y abriendo esa dirección
directamente (probado también con `adults=3&children=1`) el motor sale con las fechas y las personas puestas y enseña
los resultados. `js/reserva.js` monta esa URL; «Abrir su calendario sin fechas» abre la dirección base.

- El iframe **no existe** hasta que se pide (dentro van Google Tag Manager y las cookies de Amenitiz; lo dicen el aviso
  de cookies y la política). `x-frame-options: ALLOWALL`.
- Alto del iframe: `clamp(680px, 92svh, 1040px)` en escritorio y `clamp(640px, 88svh, 900px)` en móvil (el motor hace
  scroll dentro). Al lado, «Abrir su motor en otra pestaña» con la misma búsqueda.
- **Las reservas que se hagan dentro son reales.**
- El tipo (habitación, apartamento, casa entera) no se puede pasar por URL: cambia la pista que se enseña («en su motor
  sale como “Apartamento de 2 dormitorios”» / «Casona Amaicha»).

## Fotos

De su WordPress (`ref/origen/`, 1600 px como mucho) y **originales de su motor** (`ref/amenitiz/`: las URL de
`res.cloudinary.com/amenitiz` reconstruidas con `q_auto:best` dan 2048 px). Nitidez medida en todas
(`scripts/fotos-nitidez.py` → `ref/raw/nitidez.json`: cociente de detalle 1:1 / 1:2; ≲ 0,5 = ampliada).

- **Portada: `horreo`** = `IMG_20220926_091902_041-scaled-1.jpg`, **1600×1067, nitidez 0,83** (resolución real). Su
  motor no la tiene más grande. A pantalla completa en escritorio grande se estira un poco (1600 px): pedir el original.
- De Amenitiz, a 2048 px: el salón de la escalera (0,82), la casa roja (0,83 y 0,86), la vista aérea (0,86), el salón
  del apartamento (0,79), el jardín de la casona (0,77), la vista desde el corredor (0,75, vertical).
- **Ampliadas en origen** y servidas a lo que tienen de verdad (`maxAncho`): el desayuno (0,48 → 1000 px), el hórreo
  del jardín (0,52 → 1400), el jardín del respaldo del 3D (0,53 → 1600).
- **Verticales enderezadas** (receta de Casa Benito: Hough + homografía 85 %, tope 1,4×) solo donde la convergencia es
  moderada (2–8°): `hab-morada`, `hab-flores`, `apto-comedor`, `apto-cocina`, `apto-matrimonio`. Las de 12–19° se dejan
  tal cual: enderezarlas se comía media habitación.
- AVIF, WebP y JPG en 480, 800, 1200, 1600 y 1920 (si caben) más el ancho real; nunca se amplía.

## La marca

`scripts/marca-greca.py`: la greca **redibujada con rectas** (memoria «Logo de JPG: redibujar las rectas»). En el
espacio girado 45° son cuadrados concéntricos y ganchos rectilíneos: se dibuja ese modelo con un entramado regular
(banda 1, hueco 0,90) y se ajusta por IoU contra el alfa del logo (0,73 contra el PNG de 300 px, que es a mano alzada;
0,73 también contra el logo blanco de su WP). Giro exacto de 45°, sin aplastar. La palabra AMAICHA (letra a pincel) va
con potrace. Salen `marca/greca.svg` (currentColor), `logo.svg` (los dos marrones del logo, `#836759` y `#441F0B`),
`logo-blanco.svg`, `palabra.svg` y `greca.json` (la geometría, que usan la portada y el pie). `scripts/marca.mjs`:
favicons (la greca sobre monte) y `img/og.jpg` (1200×630).

## Cómo se trabaja

```
python -I -X utf8 scripts/fotos-nitidez.py      # nitidez real de todas las candidatas → ref/raw/nitidez.json
python -I -X utf8 scripts/fotos-verticales.py   # endereza las que llevan "enderezar" (ref/enderezadas/)
node scripts/fotos.mjs                          # img/fotos/<nombre>-<ancho>.{avif,webp,jpg} + fotos.json (nunca amplía)
python -I -X utf8 scripts/marca-greca.py        # la greca y la palabra en SVG + marca/greca.json
node scripts/marca.mjs                          # favicons e img/og.jpg
node scripts/alrededor-rutas.mjs                # distancias OSRM → ref/raw/rutas.json
node scripts/legales.mjs                        # *.src.html de las legales y el 404
node construir.mjs                              # partes, datos, fotos → *.html; versionar.mjs pone ?v=<huella>
node verificar.mjs                              # Playwright, puerto 8967 (sin capturas, sin pintar WebGL)
node scripts/rendimiento.mjs                    # LCP e INP en móvil de gama media, puerto 8968
```

Se edita SIEMPRE el `*.src.html` o la parte (`partes/`); el `.html` se regenera. **Una sola fuente de datos:**
`data/amaicha.json` (formas, servicios, condiciones, desayuno, estancias, reseñas, contacto, titular). Las distancias,
solo de `ref/raw/rutas.json` (sin él no se escribe ninguna cifra). `construir.mjs` quita los `<link>`/`<script>` de
ficheros que no existen, **salvo `css/lugar.css` y `js/lugar.js`**: esos se quedan siempre, para que el 3D entre en
cuanto Lugar 3D los deje (sin ellos, la página usa el respaldo y no falla).

### Módulos

| Módulo | Agente | Hueco | Ficheros |
|---|---|---|---|
| `portada` | Web | `#portada [data-modulo="portada"]` (respaldo: la ventana abierta, el LCP) | `js/portada.js` (CSS en `css/estilos.css`) |
| `lugar` | Lugar 3D | `#lugar [data-modulo="lugar"]` (respaldo: la foto `jardin-horreo` y un texto) | `js/lugar.js`, `css/lugar.css`, `img/lugar/`, `vendor/`, `scripts/lugar-*` → [`LUGAR.md`](LUGAR.md) |

Integración del 3D (LUGAR.md, «Para Web»): Three.js 0.160.0 va en `vendor/` y lo pide `js/lugar.js` con `import()`
(la Web no carga nada); su escenario es sticky, así que ningún antepasado de `[data-modulo="lugar"]` lleva overflow,
transform ni filter (el `html` lleva `overflow-x: clip`, que no crea caja de scroll; lo comprueba el bloque 11);
`#lugar { --lugar-arriba: var(--cabecera) }`; el div va a todo el ancho y en `[data-modo="plano"]` lleva el gutter.
Créditos del 3D (IGN CC BY 4.0, Catastro, OSM, Three.js MIT) en el aviso legal.

Contrato: `Amaicha.<mod>.montar(el, { movimiento, densidad, webgl })` → `{ destruir() }`. `main.js` monta la portada
al cargar y el lugar al acercarse (900 px). Eventos: `amaicha:resize` (solo los resize de verdad, no la barra del
móvil), `amaicha:densidad`. `Amaicha.reservar(tipo)`, `Amaicha.reserva` y `Amaicha.visor.abrir(lista, nombre)` los pone
la web.

## Mando de densidades (solo con `?revision`)

`index.html?revision` enseña el mando «Versión: **Greca** / **Sobria**» (abajo a la izquierda; se aparta mientras está
el aviso de cookies). Sin `?revision` no existe.

- **Greca** (cargada): la portada que se abre con el scroll, las pestañas de las tres formas, la escalera de distancias.
- **Sobria**: la portada quieta (ventana abierta), sin pestañas (las tres fichas seguidas), la escalera plana y
  **añade** la tabla «De un vistazo» (qué es, dormitorios, personas, baño, cocina, fuera, animales, cancelación).

No lleva mando de paleta: es una web de un negocio real con su marca (como Casa Benito), no una plantilla ficticia.

### Receta de borrado (antes de enseñársela al cliente como web suya)

1. `partes/cabeza.html`: borrar desde `// MANDO DE MAQUETA` hasta el cierre de su `if (q.has('revision')) { … }`.
2. `partes/pie.html`: borrar desde `<!-- MANDO DE MAQUETA` hasta `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: borrar el bloque `/* ===… 15. MANDO DE MAQUETA` … `/* fin del MANDO DE MAQUETA */`.
4. Si ya no hace falta la tabla de la sobria: quitar `.replace('<!--vistazo-->', vistazo)` y el `<!--vistazo-->`.
5. `node construir.mjs && node verificar.mjs` (el bloque 1 comprueba esta receta sobre copias en memoria).

## Lo que no se negocia (y su prueba en `verificar.mjs`)

Checklist de webs desde cero, para las piezas que lleva: menú móvil a 100dvh dentro de la cabecera con blur (bloque 9),
cookies con `:not([hidden])` (1 y 7), resize de la barra del móvil que no rehace nada (9), visor por NOMBRE con ratón
y con el dedo (5 y 9; botones del visor tocables en toda su altura), recargar a media página vuelve arriba (12),
titulares que aparecen observando el contenedor (12), hero en flujo sin pisarse a 360×640, 375×667, 390×844,
768×1024 y 1280×800 (2), `con-movimiento` solo sin movimiento reducido (1), contraste WCAG medido (3). Sin cursor
propio, sin pila sticky, sin marquesina, sin cortina, sin letra a letra (1).

§5 bis: **fórmula rota** (fuera cortina, pila, marquesina, cursor, letra a letra y botones magnéticos; **pieza
propia**: la greca que se abre escalón a escalón); **gesto del hero** (asomarse arrastrando, probado con eventos
táctiles reales en el bloque 12); **el objeto se completa en el pie** (la greca se cierra; con movimiento reducido ya
cerrada: 3 y 12); **foco con forma propia** (contorno de 2 px + las cuatro esquinas en escalón, `#foco-greca`: 3);
**rendimiento medido** (abajo). Menú §5 bis elegido: rótulo propio servido como trazado SVG (la greca y la palabra,
en la cabecera, el pie y el 404).

## Rendimiento

**Medido el 2026-11-25** con `scripts/rendimiento.mjs` (Pixel 7 emulado: 412×915, DPR 2,625, 4G lento 1,6 Mb/s y
150 ms, CPU ×4; sin el 3D, que tiene su propio presupuesto): **LCP 1,82–1,85 s** (la foto de la portada,
`horreo-1200.avif`, en las cuatro pasadas, también con movimiento reducido), 16 peticiones y ~545 KB hasta `load`,
una tarea larga de 50 ms como mucho, **INP aproximado 64–104 ms** (un toque en la portada y otro en una pestaña).
Presupuesto: LCP ≤ 2,5 s, INP ≤ 200 ms. La portada no usa canvas (no hay tope de DPR que poner).

La portada: el bucle de la greca solo corre con la portada en pantalla (IntersectionObserver) y no escribe nada si el
progreso no cambió; anima `clip-path` de la foto, `transform` de la foto y atributos de cinco trazados SVG. Sin
librerías (ni GSAP ni Lenis). El 3D tiene su propio presupuesto (`LUGAR.md`).

## Verificación y «no repetir»

`node verificar.mjs` (2026-11-25, con el módulo de Lugar 3D ya dentro): **163 comprobaciones bien, 0 mal**, en 12
bloques: archivos y contrato (69), portada a los cinco tamaños, contraste y foco, tokens/formas/estancias, visor por
nombre, el buscador y el iframe real (escritorio y móvil, con Amenitiz servido falso), cookies y mapa, mando de
densidades, móvil, legales, el 3D (solo contenedor, respaldo y plan B 2D sin WebGL) y, una vez, con movimiento (la
greca que se abre, el gesto con eventos táctiles reales, recarga a media página, titulares y el pie que se cierra).

`node ../plantillas-negocios-web/scripts/repeticion.mjs ../amaicha-ribadesella-web` (2026-11-25): en las últimas
diez webs no domina ninguna pieza (marquesina 0/10; letra a letra, cursor, cortina, serif y crema con acento 2/10).
**Amaicha usa ninguna del kit** («crema + acento chillón: fondo #EDEFEA» sale como nota: es la niebla fría, no crema)
→ **repite 0 de las dominantes (tope 2)**.

## Qué mirar en Chrome

Abrir con un servidor local (p. ej. `npx serve` en esta carpeta) `index.html` y `index.html?revision`. Nadie ha visto
todavía el aspecto: las pruebas miden comportamiento.

1. **Portada**: que la greca se lea como su logo con el hórreo dentro; bajar despacio y ver los tres pasos (centro,
   anillo medio, y los escalones del anillo de fuera hasta llenar la pantalla); que la foto no se vea blanda a
   pantalla completa (es de 1600 px). Arrastrar en horizontal (ratón o dedo) para asomarse.
2. **Cabecera**: clara sobre la portada y, al bajar, niebla con blur; el rombo teja bajo la sección en la que estás.
3. **Tres formas**: que las cifras grandes respiren, que los iconos propios se lean como de la misma familia y que la
   pestaña activa se entienda.
4. **La casa por estancias**: las filas de alturas iguales con fotos de proporciones distintas; el índice fijo.
5. **Alrededor**: la escalera de cuatro escalones en escritorio.
6. **Reservar**: elegir fechas y personas y pulsar «Buscar en su motor»: debe abrirse SU motor con la búsqueda hecha.
   No completar una reserva (son reales).
7. **Pie**: la greca que se cierra de fuera adentro.
8. El **foco del teclado** (Tab): el contorno con las esquinas en escalón, en teja sobre claro y en niebla sobre oscuro.
9. `?revision` → **Sobria**: la tabla «De un vistazo».
