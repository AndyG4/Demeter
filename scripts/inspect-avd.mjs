import fs from 'node:fs';

const html = fs.readFileSync('_tmp/avd.html', 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
console.log('REFS');
for (const r of refs) console.log(r);

const app = fs.readFileSync('_tmp/avd-app-0417dd41b7206b6255c8.js', 'utf8');
for (const term of ['estado', 'aguascalientes', 'page-data', 'path:', 'matchPath']) {
  const i = app.indexOf(term);
  if (i >= 0) console.log(`\nAPP ${term} @${i}:`, app.slice(Math.max(0, i - 200), i + 400).replace(/\s+/g, ' '));
}
