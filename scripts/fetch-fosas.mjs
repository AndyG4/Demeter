import fs from 'node:fs';

const base = 'https://raw.githubusercontent.com/Puma120/LAF_Mapa/main/';
for (const [path, dest] of [
  ['src/assets/Fosas_clandestinas_2.csv', '_tmp/fosas2.csv'],
  ['src/assets/Fosas_nuevas.csv', '_tmp/fosas_nuevas.csv'],
  ['README.md', '_tmp/laf-readme.md'],
]) {
  const r = await fetch(base + path);
  const text = await r.text();
  fs.writeFileSync(dest, text);
  console.log('---', path, r.status, text.length);
  console.log(text.slice(0, 900));
}
