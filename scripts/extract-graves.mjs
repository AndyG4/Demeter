import fs from 'node:fs';

const url = 'https://data.adondevanlosdesaparecidos.org/page-data/index/page-data.json';
const r = await fetch(url);
const text = await r.text();
fs.writeFileSync('_tmp/avd-index.json', text);
const j = JSON.parse(text);
console.log('bytes', text.length);
const data = j.result.data;
console.log('top keys', Object.keys(data));
for (const [k, v] of Object.entries(data)) {
  const shape = Array.isArray(v) ? `array(${v.length})` : typeof v === 'object' && v ? `object(${Object.keys(v).slice(0, 8).join(',')})` : typeof v;
  console.log(' ', k, shape);
}
const states = data.allMxstatesJson?.edges ?? data.allMxstatesJson?.nodes ?? [];
console.log('states', states.length);
console.log(JSON.stringify(states[0]).slice(0, 1200));
fs.writeFileSync('_tmp/avd-states.json', JSON.stringify(states, null, 1));
