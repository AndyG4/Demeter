import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tmp = path.join(root, '_tmp');
fs.mkdirSync(tmp, { recursive: true });

const BASE = 'https://versionpublicarnpdno.segob.gob.mx';

async function get(url, opts = {}) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'RastroResearch/1.0 (+public-data-audit; contact: local)' },
    ...opts,
  });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, url: r.url, buf, text: buf.toString('utf8'), headers: r.headers };
}

const page = await get(`${BASE}/Dashboard/Index`);
fs.writeFileSync(path.join(tmp, 'dashboard.html'), page.text);
console.log('dashboard', page.status, page.text.length);

const refs = [...page.text.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
console.log('refs', refs);

const jsRefs = refs.filter((u) => u.includes('.js') || u.includes('/api/') || u.includes('Dashboard'));
for (const ref of jsRefs) {
  try {
    const url = new URL(ref, BASE).href;
    const r = await get(url);
    const name = url.split('/').pop().split('?')[0] || 'asset';
    fs.writeFileSync(path.join(tmp, `rnpdno-${name}`), r.text);
    console.log('saved', name, r.status, r.text.length, url);
    const endpoints = [...r.text.matchAll(/["'`](\/?[A-Za-z0-9_\-/]*(?:Dashboard|Estadistic|Consulta|Busqueda|Reporte|Grafica|Mapa|Datos)[A-Za-z0-9_\-/]*)["'`]/gi)]
      .map((m) => m[1])
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 80);
    if (endpoints.length) console.log('  endpoints:', endpoints);
  } catch (e) {
    console.log('ERR', ref, e.message);
  }
}

// Try the documented public API paths seen in the ecosystem.
const guesses = [
  '/api/Dashboard/GetEstados',
  '/api/Dashboard/GetMunicipios',
  '/Dashboard/GetEstados',
  '/Dashboard/GetDatos',
  '/api/consulta',
  '/api/v1/consulta',
];
for (const g of guesses) {
  try {
    const r = await get(BASE + g);
    console.log('probe', g, r.status, r.headers.get('content-type'), r.text.slice(0, 120).replace(/\s+/g, ' '));
  } catch (e) {
    console.log('probe ERR', g, e.message);
  }
}
