import fs from 'node:fs';

const base = 'https://plataformaciudadanadefosas.org';
const html = (await (await fetch(base + '/')).text());
fs.writeFileSync('_tmp/pcdf.html', html);
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
console.log('refs', refs);
for (const ref of refs.filter((u) => u.endsWith('.js'))) {
  const url = new URL(ref, base).href;
  const r = await fetch(url);
  const text = await r.text();
  const name = url.split('/').pop();
  fs.writeFileSync(`_tmp/pcdf-${name}`, text);
  console.log('---', name, r.status, text.length);
  const hits = [...text.matchAll(/["'`](\/api\/[^"'`]+)["'`]/g)].map((m) => m[1]);
  console.log([...new Set(hits)].slice(0, 30));
}
