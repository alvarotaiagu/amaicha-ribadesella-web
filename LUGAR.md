# Lugar 3D · «Del acantilado al hórreo»

Módulo `lugar` de la sección `#lugar` (agente Lugar 3D, 2026-11-25). Ficheros: `js/lugar.js`, `css/lugar.css`,
`img/lugar/`, `vendor/three-0.160.0.module.min.js`, `scripts/lugar-*`, `ref/raw/lugar-cache/` (caché de descargas,
no viaja a la web).

**Nadie lo ha visto pintado todavía.** El 3D no se prueba con Playwright; lo tiene que mirar Álvaro en su Chrome
(ver «Qué mirar»).

## Qué hace

Un recorrido en 3D que avanza con el scroll (sección fijada, `position: sticky`, sin GSAP):

| Scroll | Cámara | Rótulos |
|---|---|---|
| 0 – 22 % | sobre el Cantábrico, ~6,5 km mar adentro y a 430 m, mirando al sur: la costa, la sierra y los Picos detrás | Mar Cantábrico, Ribadesella, Los acantilados (El Infierno), Guadamía y bufones de Pría, Picos de Europa (Peña Santa) |
| 22 – 42 % | se acerca a la costa y baja a ~140 m | |
| 42 – 74 % | cruza el borde del acantilado, pasa sobre Camango y baja hacia la finca | Camango, Amaicha |
| 74 – 100 % | entra por encima de la casona y acaba girando despacio alrededor del hórreo, con la casona detrás | La casona, La casa roja, El hórreo |

Abajo, las cuatro paradas («Desde el mar», «Los acantilados», «Camango», «La finca») con el rombo de la greca como
índice; la actual se marca en `--marca`. Rótulos sin distancias (las pone Web en «Alrededor»).

- **Relieve**: MDT05 del IGN alrededor (de Ribadesella a Guadamía, del mar a la sierra, 11,8 × 6,9 km) con una rejilla
  que se aprieta en la finca (4 m) y se abre lejos (60 m); anillo lejano con MDT25 (66 × 53 km, ~290 m) que llega a los
  Picos. El relieve **lejano** está exagerado ×1,4 (de 3,5 a 12 km de la casa, en suave; la finca y la costa, a escala
  real). Se dice en el pie.
- **Ortofoto PNOA** encima: 2,9 m/px en la caja cercana, 0,31 m/px en la finca (640 m), ~30 m/px en el anillo lejano.
- **Mar**: plano con sombreado propio (olas por ruido, reflejo del cielo con Fresnel, brillo del sol o de la luna,
  color según la distancia a la costa real y espuma en la orilla, sacada del MDT).
- **La finca**: los edificios en un radio de 260 m se levantan sobre su **planta real del Catastro INSPIRE** con su
  número de plantas. Casona de piedra a dos aguas; casa roja (revoco rojo, zócalo de piedra, cuatro aguas, chimenea
  roja y corredor de madera hacia el hórreo); casa azul (planta baja de piedra, cuatro aguas, chimenea de piedra);
  vecinas en blanco con teja más apagada. Ventanas cada ~2,9 m por planta.
- **El hórreo** (no está en Catastro): situado sobre su tejado en la ortofoto (centro a 16,5 m al este y 19,8 m al sur
  del nodo OSM de la casa, girado −19°, tejado de ~5,6 m). Cuatro pegoyos de madera en tronco de pirámide sobre base
  de piedra, tazas y muelas, trabes que sobresalen, caja de tablas con esquinas y puerta hacia la casona, tejado de teja
  a cuatro aguas con pináculo y cuatro tentemozos. Dos mesas de merendero con sombrilla al sur (colocadas a ojo, como
  en las fotos).
- **Árboles**: 753 copas detectadas en la ortofoto de detalle (verde oscuro y rugoso) en 230 m alrededor; ninguno entre
  la cámara final y el hórreo.
- **El cielo de ahora** en Ribadesella: sol y luna en su posición real (SunCalc, en el navegador), color del cielo y
  de la luz según la altura del sol, sombras suaves de la casa, el hórreo y los árboles (mapa de sombras solo en la
  finca, recalculado solo cuando cambia el sol). De noche: estrellas, la luna con su fase, ventanas encendidas con halo
  dibujado y una luz cálida en el jardín. Texto «Ahora en Ribadesella son las…» (cada minuto).

### Plan B (en el mismo hueco)

Sin WebGL, con movimiento reducido, en densidad «sobria», con ahorro de datos, en el móvil antes de pulsar el botón y
en navegadores automatizados (Playwright): **la vista desde el mar dibujada** con los mismos datos (relieve + ortofoto,
render por columnas en Python, mismo encuadre que el arranque del 3D) con sus marcas, **la finca desde el aire**
(ortofoto de detalle con casona, casa roja y hórreo marcados), las cuatro paradas y el cielo de ahora. De noche, la
vista se oscurece y la marca de Amaicha brilla.

### Cuándo sale cada cosa

| Caso | Qué se ve |
|---|---|
| Escritorio con WebGL | el 3D se carga al montar (Web monta a ~900 px); mientras, el póster (la vista dibujada) en el mismo hueco |
| Móvil (≤ 820 px o puntero grueso) o ahorro de datos | plan B + botón **«Ver el recorrido en 3D»** |
| `prefers-reduced-motion`, `movimiento: false`, `densidad: 'sobria'`, sin WebGL, `?sin-webgl` | plan B, sin botón |
| `navigator.webdriver` (Playwright) | plan B siempre; `?lugar=3d` lo fuerza (no usarlo en pruebas) |
| En 3D | botón «Ver en plano» abajo a la derecha |
| Si falla la carga o se pierde el contexto WebGL | vuelve solo al plan B |

## Para Web

1. **HTML** (en `index.src.html`, dentro de `#lugar`; el contenido del div es tu respaldo y se repone al destruir):

```html
<section id="lugar" aria-labelledby="lugar-titulo">
  <!-- tu título y entradilla -->
  <div data-modulo="lugar">
    <!-- RESPALDO: foto del jardín con el hórreo + texto -->
  </div>
</section>
```

2. **CSS y JS** en el `<head>` (con tu `?v=` de `versionar.mjs`):

```html
<link rel="stylesheet" href="css/lugar.css">
<script src="js/lugar.js" defer></script>
```

   **Three.js no lo cargas tú**: `lugar.js` lo pide con `import()` a `vendor/three-0.160.0.module.min.js` (copia
   propia, MIT) solo cuando hace falta. Sin import map, sin CDN.

3. **Montar** desde `main.js`: `Amaicha.lugar.montar(el, { movimiento, densidad, webgl })`. `webgl: false` fuerza el
   plan B; si no lo pasas, lo detecta él.

4. **Sticky**: el escenario va con `position: sticky`. Ningún antepasado de `[data-modulo="lugar"]` puede llevar
   `overflow: hidden|auto|clip` ni `transform`/`filter`. Si hay **cabecera fija**, pon su alto en
   `--lugar-arriba` (p. ej. `#lugar { --lugar-arriba: 64px; }`). Para que luzca, el div a **todo el ancho** (sin el
   `max-width` del texto); el plan B ya lleva su propio respiro si le das `padding` lateral al div cuando
   `[data-modo="plano"]`.

5. **Variables que lee**: `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca`, `--acento`, `--linea`,
   `--letra-titular`, `--letra-texto`, `--letra-cifras`. No define colores de página.

6. **`verificar.mjs`**: el módulo no pinta WebGL bajo Playwright (mira `navigator.webdriver`); aun así, arranca
   Chromium con `--disable-3d-apis`. Comprueba solo: `[data-modulo="lugar"][data-montado="1"]`,
   `[data-modo="plano"]`, que `.lugar__vista img` y `.lugar__finca img` cargan y que hay `.lugar__marca` visibles.
   Mi prueba propia: `node scripts/lugar-prueba.mjs` (ver abajo).

7. **Créditos**: el pie del módulo ya cita IGN (CC BY 4.0), Catastro y OSM. Si la web tiene página de créditos o el
   aviso legal los lista, añade esas tres fuentes.

8. **Peso**: con `defer` y la carga diferida, nada de esto entra en el LCP. El 3D baja ~3,2 MB en escritorio
   (Three.js 655 KB incluido) y ~2,0 MB en móvil al pulsar el botón; el plan B, ~100 KB.

## Datos (cómo se hicieron)

```
python -I -X utf8 scripts/lugar-osm.py     # lugares de OSM (Overpass con espejos) → ref/raw/lugar-cache/osm-lugares.json
python -I -X utf8 scripts/lugar-datos.py   # descargas (en caché), alturas, ortofotos, Catastro, árboles, plan B, lugar.json
node scripts/lugar-prueba.mjs              # 72 comprobaciones: funciones, datos, plan B sin WebGL y la escena 3D
                                           # montada con Three.js real y un WebGLRenderer FALSO que no pinta
                                           # (--sin-navegador: solo las de Node)
```

| Fuente | Servicio | Resolución usada |
|---|---|---|
| MDT05 IGN | WCS `servicios.idee.es/wcs-inspire/mdt`, `Elevacion4258_5` | nativo ~3,6 × 5 m → rejillas de 4 m (finca), 10 m (costa y Camango), 20 m (caja cercana) |
| MDT25 IGN | mismo WCS, `Elevacion4258_25` | anillo lejano a ~290 m, mezcla de media y máximo para no aplanar las cumbres |
| PNOA | WMS `www.ign.es/wms-inspire/pnoa-ma` (caja cercana y lejana); **WMTS** `www.ign.es/wmts/pnoa-ma` zoom 19 para la finca (el WMS daba 502 en zoom alto) | 2,9 m/px · 0,31 m/px · ~30 m/px |
| Catastro INSPIRE | WFS `wfsBU.aspx` (`BU:Building`, `BU:BuildingPart`, con plantas) y `wfsCP.aspx` | 85 partes de edificio a < 260 m |
| OSM | Overpass (UA genérico; con UA de navegador da 406) | nodos y vías con sus etiquetas |

Alturas en PNG RGB: `(R·256 + G) / 10 − 100` m. Coordenadas locales en metros desde el nodo OSM 459894261
(x al este, z al sur).

### Comprobaciones hechas (y lo que no es como se suponía)

- **Guadamía y los bufones de Pría están al ESTE de Amaicha** (~2,5 km), no al oeste: `natural=blowhole` «Bufones de
  Pría» (node 13041281010) y `natural=beach` «Playa de Guadamía» (relation 1563524), a ~370 m entre sí. Ribadesella
  (`place=town`, node 29847633) sí está al oeste-noroeste.
- **Los acantilados de enfrente**: el cabo más cercano a la vertical de la casa es «Punta Canto de Palo Verde»
  (`natural=cape`, node 6744467382) y el paraje es «El Infierno» (`place=locality`, node 1242832095). El rótulo dice
  «Los acantilados · El Infierno»; no afirma el nombre turístico «Acantilados del Infierno».
- **Camango** es «Camangu» en OSM (`place=hamlet`, node 282780522).
- **Picos de Europa**: el rótulo va sobre la Peña Santa (2.596 m, macizo occidental, el que se ve de frente). La vista
  dibujada confirma que los Picos asoman por encima de la sierra desde el mar.
- **Qué edificio es cada cosa** (por las fotos 00, 07, 13, 30, 33 y la ortofoto): casona = `33056A06500034`
  (uso «comercial» en Catastro, 2 plantas); casa roja = `33056A06500035` partes 3 y 4 (2 plantas); casa azul =
  `33056A06500035` parte 2. **Supuesto razonado; Álvaro o la dueña deben confirmarlo**, igual que qué edificio son los
  apartamentos.
- La costa queda a ~1,7–1,9 km en línea recta al norte según el MDT (su web dice «1 km»; las distancias de «Alrededor»
  son de OSRM y las pone Web).
- La parcela catastral que contiene el nodo de la casa es `33056A06500032` (jardín); los edificios van en las 034/035.

## Rendimiento

Sin `transmission`, sin `RectAreaLight`, sin bloom (halos dibujados con sprites aditivos), colores en sRGB (`'#hex'`),
DPR ≤ 1,5 (1,25 en móvil) con bajada automática (DPR 1 y luego sin sombras si los fotogramas pasan de 30 ms), sombras
PCF suaves solo en 160 m alrededor de la finca y recalculadas solo cuando cambia el sol, bucle que pinta solo si hay
cambio (el mar anima mientras se ve, hasta el 62 % del recorrido), pausa fuera de pantalla, `near` de la cámara según
la altura. ~200 000 vértices de relieve en escritorio (~80 000 en móvil); en total ~610 000 triángulos en
escritorio (relieve cercano ~400 000, anillo lejano, 738 árboles de 80 triángulos, 85 edificios, 908 ventanas).
La prueba con el renderizador falso **no compila los shaders**: un error de GLSL solo se vería en Chrome, en la
consola (`THREE.WebGLProgram: Shader Error`), con el mar, el cielo o el suelo en negro o sin pintar.

## Qué mirar (Álvaro, en su Chrome)

1. Abrir con **`?fps`**: arriba a la derecha salen fps, calidad, DPR y altura de la cámara. Si la calidad baja a 1 o 2
   sola, va justo; decirlo.
2. Recorrer el scroll entero despacio y deprisa: que no haya saltos, que el arranque coincida con el póster, que el
   hórreo se reconozca de cerca y que la casona quede detrás al final.
3. Ver si las **etiquetas** caen en su sitio (Ribadesella a la izquierda, Guadamía a la derecha, Peña Santa) y no se
   montan.
4. **De noche** (o cambiando la hora del sistema): ventanas encendidas, luna, estrellas.
5. **Móvil real**: el botón «Ver el recorrido en 3D», que el scroll no se trabe y que el escenario no salte al
   esconderse la barra del navegador.
6. Si va a menos de 5 fps: Chrome sin aceleración por hardware (`chrome://settings/system`).

## Pendiente

- Confirmar qué edificio es la casa roja / los apartamentos y la casa azul (afecta solo a los rótulos «La casona» y
  «La casa roja» y a los colores).
- El tejado de la casa roja en la ortofoto es más largo hacia el sur que su planta de Catastro (porche o corredor
  cubierto): se ha dejado la planta de Catastro.
- Las mesas y sombrillas del jardín están colocadas a ojo.
