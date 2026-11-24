import fs from 'node:fs';

const r = await fetch('https://data.adondevanlosdesaparecidos.org/');
const html = await r.text();
fs.writeFileSync('_tmp/avd.html', html);
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
const js = refs.filter((u) => u.endsWith('.js'));
console.log(js.join('\n'));

for (const ref of js.slice(0, 12)) {
  const url = new URL(ref, 'https://data.adondevanlosdesaparecidos.org/').href;
  const res = await fetch(url);
  const text = await res.text();
  const name = url.split('/').pop();
  fs.writeFileSync(`_tmp/avd-${name}`, text);
  console.log('---', name, text.length);
  const hits = [...text.matchAll(/.{0,80}(?:api|json|fosa|graphql|datos).{0,100}/gi)]
    .map((m) => m[0].replace(/\s+/g, ' '))
    .slice(0, 8);
  for (const h of hits) console.log('  ', h);
}
