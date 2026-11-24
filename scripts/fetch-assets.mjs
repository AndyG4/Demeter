import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const staticDir = path.join(root, 'src/main/resources/static');
const vendor = path.join(staticDir, 'vendor');
const fonts = path.join(staticDir, 'fonts');
const dataDir = path.join(root, 'src/main/resources/data');
fs.mkdirSync(vendor, { recursive: true });
fs.mkdirSync(fonts, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

async function download(url, dest, { headers = {} } = {}) {
  const r = await fetch(url, { headers: { 'user-agent': 'Rastro/1.0 (public assets)', ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log('ok', buf.length, path.relative(root, dest));
  return buf;
}

// GeoJSON de estados (INEGI / angelnmara, licencia abierta; se cita en docs/DATOS.md)
await download(
  'https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json',
  path.join(dataDir, 'estados.geo.json')
);

// Leaflet
await download('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', path.join(vendor, 'leaflet.js'));
await download('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css', path.join(vendor, 'leaflet.css'));
for (const img of ['marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png', 'layers.png', 'layers-2x.png']) {
  await download(`https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/${img}`, path.join(vendor, 'images', img));
}

// GSAP + ScrollTrigger
await download('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', path.join(vendor, 'gsap.min.js'));
await download('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js', path.join(vendor, 'ScrollTrigger.min.js'));

// Tipografías libres (OFL): Fraunces (display) + Public Sans (texto)
const cssUrl =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Public+Sans:wght@400;500;600;700&display=swap';
const css = (await download(cssUrl, path.join(fonts, 'fonts.css'), {
  headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
})).toString('utf8');

const fontUrls = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
const unique = [...new Set(fontUrls)];
const localNames = [];
for (const [i, url] of unique.entries()) {
  const name = `f${i}.woff2`;
  await download(url, path.join(fonts, name));
  localNames.push([url, name]);
}
let localCss = css;
for (const [url, name] of localNames) {
  localCss = localCss.split(url).join(`./${name}`);
}
fs.writeFileSync(path.join(fonts, 'fonts.css'), localCss);

// Dataset público de la Plataforma Ciudadana de Fosas (API abierta) para comparación
const scatter = await download('https://plataformaciudadanadefosas.org/api/v1/scatter', path.join(root, '_tmp/scatter.json'));
console.log('scatter bytes', scatter.length);
