/* Favicons, iconos e imagen para compartir de Amaicha, a partir de la greca vectorizada (scripts/marca-greca.py).
   Uso: node scripts/marca.mjs   (necesita antes marca/greca.svg, marca/logo-blanco.svg e img/fotos/ de scripts/fotos.mjs)
   Escribe marca/favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png e img/og.jpg (1200×630):
   monte a la izquierda con el logo en claro y el hórreo dentro del rombo de la greca a la derecha. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MONTE = '#17211C', NIEBLA = '#EDEFEA';
const G = JSON.parse(fs.readFileSync(path.join(RAIZ, 'marca/greca.json'), 'utf8'));
const GRECA = G.colores.greca;
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8').replace(/<\?xml[^>]*\?>\s*/, '');
const interior = (s) => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const vbDe = (s) => /viewBox="([^"]+)"/.exec(s)[1].trim().split(/[\s,]+/).map(Number);

// el icono: la greca en el color del logo sobre monte (el cuadrado entero, sin redondear: arista viva)
const greca = leer('marca/greca.svg').replace(/currentColor/g, GRECA);
const vb = vbDe(greca);
function icono(tam, margen = 0.12) {
  const ancho = tam * (1 - 2 * margen), alto = ancho * vb[3] / vb[2];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}">
    <rect width="${tam}" height="${tam}" fill="${MONTE}"/>
    <svg x="${(tam - ancho) / 2}" y="${(tam - alto) / 2}" width="${ancho}" height="${alto}" viewBox="${vb.join(' ')}">${interior(greca)}</svg>
  </svg>`);
}
const png = async (t, m) => sharp(icono(t * 4, m), { density: 72 }).resize(t, t, { kernel: 'lanczos3' }).png().toBuffer();
fs.writeFileSync(path.join(RAIZ, 'marca/favicon-32.png'), await png(32, 0.06));
fs.writeFileSync(path.join(RAIZ, 'marca/apple-touch-icon.png'), await png(180, 0.14));
fs.writeFileSync(path.join(RAIZ, 'marca/icono-512.png'), await png(512, 0.16));
fs.writeFileSync(path.join(RAIZ, 'marca/favicon.svg'), icono(64, 0.06).toString());

// og:image 1200×630
const logo = leer('marca/logo-blanco.svg');
const lv = vbDe(logo);
const anchoLogo = 360, altoLogo = Math.round(anchoLogo * lv[3] / lv[2]);
const logoPng = await sharp(Buffer.from(logo.replace(/<svg([^>]*)>/, `<svg$1 width="${anchoLogo * 2}" height="${altoLogo * 2}">`))).resize(anchoLogo).png().toBuffer();
// el hórreo dentro del rombo (la ventana de la portada): rombo de 560 px de diagonal
const D = 560;
const FJ = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8')).find((f) => f.nombre === 'horreo');
const fuente = sharp(path.join(RAIZ, 'img/fotos/horreo-1200.jpg'));
const { width: fw, height: fh } = await fuente.metadata();
const lado = Math.min(fw, fh), fx = (FJ.foco || [0.5, 0.5])[0] * fw, fy = (FJ.foco || [0.5, 0.5])[1] * fh;
const izq = Math.round(Math.min(fw - lado, Math.max(0, fx - lado / 2))), arr = Math.round(Math.min(fh - lado, Math.max(0, fy - lado / 2)));
const foto = await fuente.extract({ left: izq, top: arr, width: lado, height: lado }).resize(D, D).png().toBuffer();   // centrado en el hórreo (foco)
const rombo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}"><path d="M${D / 2} 0L${D} ${D / 2}L${D / 2} ${D}L0 ${D / 2}Z" fill="#fff"/></svg>`);
const ventana = await sharp(foto).composite([{ input: rombo, blend: 'dest-in' }]).png().toBuffer();
const marco = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${D + 40}" height="${D + 40}"><path d="M${(D + 40) / 2} 4L${D + 36} ${(D + 40) / 2}L${(D + 40) / 2} ${D + 36}L4 ${(D + 40) / 2}Z" fill="none" stroke="${GRECA}" stroke-width="16"/></svg>`);
const base = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${MONTE}"/>
  <text x="72" y="${80 + altoLogo + 74}" font-family="Arial, sans-serif" font-weight="700" font-size="34" fill="${NIEBLA}">Hotel y apartamentos rurales</text>
  <text x="72" y="${80 + altoLogo + 118}" font-family="Arial, sans-serif" font-size="26" fill="${NIEBLA}">Camango, Ribadesella (Asturias)</text>
</svg>`;
await sharp(Buffer.from(base)).composite([
  { input: logoPng, left: 72, top: 80 },
  { input: marco, left: 1200 - D - 40 - 30, top: Math.round((630 - D - 40) / 2) },
  { input: ventana, left: 1200 - D - 20 - 30, top: Math.round((630 - D) / 2) },
]).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log('marca/ (favicon, iconos) e img/og.jpg listos');
