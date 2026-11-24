import fs from 'node:fs';

const file = fs.readdirSync('_tmp').find((x) => x.startsWith('pcdf-app.'));
const text = fs.readFileSync(`_tmp/${file}`, 'utf8');
const marker = '"municipios_mx_feb2018"';
const mi = text.indexOf(marker);
console.log('marker', mi);
// El objeto TopoJSON empieza antes: buscar la primera "{" que abre el topología.
let start = text.lastIndexOf('{"type":"Topology"', mi);
console.log('start', start, text.slice(start, start + 80));
if (start < 0) throw new Error('topology not found');
let depth = 0;
let inString = false;
let escape = false;
let end = -1;
for (let i = start; i < text.length; i++) {
  const c = text[i];
  if (inString) {
    if (escape) escape = false;
    else if (c === '\\') escape = true;
    else if (c === '"') inString = false;
    continue;
  }
  if (c === '"') inString = true;
  else if (c === '{') depth++;
  else if (c === '}') {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
console.log('end', end, 'bytes', end - start);
const topo = JSON.parse(text.slice(start, end));
fs.writeFileSync('_tmp/municipios-topo.json', JSON.stringify(topo));
const geoms = topo.objects.municipios_mx_feb2018.geometries;
console.log('geoms', geoms.length);
console.log(geoms.slice(0, 3).map((g) => g.properties));
const names = geoms.map((g) => g.properties.NOMGEO);
console.log('sample', names.slice(0, 10));
