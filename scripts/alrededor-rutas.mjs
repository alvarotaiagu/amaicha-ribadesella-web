// Distancias por carretera de «Alrededor» con OSRM (servidor público, perfil coche, datos de OpenStreetMap ODbL).
// Receta de ../casa-benito-san-tirso-web/scripts/eo-rutas.mjs. Origen: el nodo OSM de la casa (DATOS).
// Destinos: nodos/vías/relaciones de OSM buscados por Overpass el 2026-11-25 (ids abajo).
//   node scripts/alrededor-rutas.mjs   → ref/raw/rutas.json   (lo lee construir.mjs; nada se escribe a ojo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { osrm, overpass, dormir, hav, UA } from './alrededor-util.mjs';

// a pie (perfil foot del servidor de FOSSGIS; el segmento dice «driving» pero el perfil va en la ruta del servidor)
async function aPie(a, b) {
  const u = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) }); if (r.ok) { const j = await r.json(); if (j.code === 'Ok') return { km: +(j.routes[0].distance / 1000).toFixed(1), minutos: Math.round(j.routes[0].duration / 60), snap_destino_m: Math.round(j.waypoints[1].distance) }; } } catch (e) {} await dormir(2000); }
  return null;
}

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASA = { lat: 43.4434463, lon: -5.0125288, fuente: 'OSM node/459894261 «Hotel rural Amaicha»' };
// los acantilados: el cabo más cercano al norte de la casa (punta Canto de Palo Verde) en el paraje «El Infierno»
// (place=locality, node/1242832095), como en el 3D de Lugar. Guadamía y los bufones de Pría quedan al ESTE.
const LUGARES = [
  { id: 'acantilados', nombre: 'Los acantilados (El Infierno)', grupo: 'costa', osm: 'node/6744467382', lat: 43.46010, lon: -5.01823 },
  { id: 'guadamia', nombre: 'Playa de Guadamía', grupo: 'costa', osm: 'relation/1563524', lat: 43.45588, lon: -4.98229 },
  { id: 'bufones', nombre: 'Bufones de Pría', grupo: 'costa', osm: 'node/13041281010', lat: 43.45871, lon: -4.97986 },
  { id: 'ribadesella', nombre: 'Ribadesella', grupo: 'pueblos', osm: 'node/29847633', lat: 43.46180, lon: -5.05886 },
  { id: 'llanes', nombre: 'Llanes', grupo: 'pueblos', osm: 'node/30157832', lat: 43.42112, lon: -4.75308 },
  { id: 'cangas', nombre: 'Cangas de Onís', grupo: 'picos', osm: null },
  { id: 'covadonga', nombre: 'Covadonga', grupo: 'picos', osm: 'relation/1373484', lat: 43.30847, lon: -5.05468 },
  { id: 'lagos', nombre: 'Lagos de Covadonga', grupo: 'picos', osm: 'node/2124894479', lat: 43.26992, lon: -4.98615 },
  { id: 'ovd', nombre: 'Aeropuerto de Asturias', grupo: 'aeropuertos', osm: 'way/35951935', lat: 43.56160, lon: -6.03307 },
  { id: 'sdr', nombre: 'Aeropuerto de Santander', grupo: 'aeropuertos', osm: 'way/167056577', lat: 43.42694, lon: -3.82050 },
  { id: 'bio', nombre: 'Aeropuerto de Bilbao', grupo: 'aeropuertos', osm: 'way/167055954', lat: 43.30173, lon: -2.91510 },
];
// Cangas de Onís: el nodo de la villa en OSM
{
  const j = await overpass('[out:json][timeout:40];node(43.30,-5.20,43.40,-5.05)["place"~"town|village"]["name"~"Cangas de On"];out;');
  const n = j.elements[0];
  const c = LUGARES.find((l) => l.id === 'cangas');
  Object.assign(c, { osm: 'node/' + n.id, lat: n.lat, lon: n.lon });
}
const resumen = (j) => {
  const r = j.routes[0];
  const carreteras = [];
  for (const leg of r.legs) for (const s of leg.steps) { const ref = (s.ref || '').split(';')[0].trim(); if (ref && s.distance > 200 && carreteras[carreteras.length - 1] !== ref) carreteras.push(ref); }
  return { km: +(r.distance / 1000).toFixed(1), minutos: Math.max(1, Math.round(r.duration / 60)), carreteras, snap_destino_m: Math.round(j.waypoints[1].distance) };
};
const salida = {
  fuente: 'OSRM (router.project-osrm.org, perfil coche, datos de OpenStreetMap ODbL)',
  fecha: new Date().toISOString().slice(0, 10),
  nota: 'Coche: OSRM público. A pie (solo costa y Ribadesella): routing.openstreetmap.de/routed-foot. Tiempos de OSRM con velocidades teóricas, sin tráfico ni paradas: orientativos. «snap_destino_m» = distancia del punto del lugar a la carretera más cercana (en la costa el coche llega hasta ahí y el resto es a pie).',
  casa: CASA,
  llegar: LUGARES.map((l) => l.id),
  destinos: {},
};
for (const l of LUGARES) {
  const ida = resumen(await osrm(CASA, l));
  await dormir(900);
  const pie = l.grupo === 'costa' || l.id === 'ribadesella' ? await aPie(CASA, l) : null;
  salida.destinos[l.id] = { nombre: l.nombre, grupo: l.grupo, osm: l.osm, lat: l.lat, lon: l.lon, recta_km: +(hav(CASA, l) / 1000).toFixed(1), desde_casa: ida, ...(pie ? { a_pie: pie } : {}) };
  if (pie) console.log('   a pie', pie.km, 'km', pie.minutos, 'min');
  console.log(l.id.padEnd(12), String(ida.km).padStart(6), 'km', String(ida.minutos).padStart(4), 'min | recta', salida.destinos[l.id].recta_km, 'km | snap', ida.snap_destino_m, 'm |', ida.carreteras.join('>'));
}
const rib = salida.destinos.ribadesella.desde_casa;
salida.contraste = {
  ribadesella: { portada_de_su_web: '4 km', localizacion_de_su_web: '6 km', osrm_km: rib.km, osrm_min: rib.minutos, veredicto: rib.km <= 5 ? 'cuadra con «4 km»' : rib.km <= 7 ? 'cuadra con «6 km»' : 'ninguna de las dos' },
  aeropuertos: { su_web: { ovd: '104 km, 1 h 3 min', sdr: '112 km, 1 h 7 min', bio: '211 km, 2 h 8 min' }, osrm: Object.fromEntries(['ovd', 'sdr', 'bio'].map((k) => [k, `${salida.destinos[k].desde_casa.km} km, ${salida.destinos[k].desde_casa.minutos} min`])) },
};
fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), JSON.stringify(salida, null, 1));
console.log('contraste', JSON.stringify(salida.contraste));
