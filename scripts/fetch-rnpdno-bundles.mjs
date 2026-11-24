import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tmp = path.join(root, '_tmp');
const BASE = 'https://versionpublicarnpdno.segob.gob.mx';
const page = fs.readFileSync(path.join(tmp, 'dashboard.html'), 'utf8');
const refs = [...page.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);

for (const ref of refs.filter((u) => u.startsWith('/bundles/'))) {
  const url = BASE + ref;
  const r = await fetch(url, { headers: { 'user-agent': 'RastroResearch/1.0' } });
  const text = await r.text();
  const name = ref.split('?')[0].replaceAll('/', '_');
  fs.writeFileSync(path.join(tmp, `bundle${name}.js`), text);
  console.log(name, r.status, text.length);

  const hits = [...text.matchAll(/.{0,90}(?:GetEstados|GetMunicipios|GetDatos|Dashboard\/|Estadistic|jsonResult|ChartData|seriesData|data\s*:\s*\[).{0,120}/gi)]
    .map((m) => m[0].replace(/\s+/g, ' '))
    .slice(0, 12);
  if (hits.length) {
    console.log('  HITS');
    for (const h of hits) console.log('   ', h);
  }
}
