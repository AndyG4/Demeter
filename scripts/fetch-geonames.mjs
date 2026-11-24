import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tmp = path.join(root, '_tmp');
fs.mkdirSync(tmp, { recursive: true });
const targets = [
  ['https://download.geonames.org/export/dump/MX.zip', 'MX.zip'],
  ['https://download.geonames.org/export/dump/admin2Codes.txt', 'admin2Codes.txt'],
  ['https://download.geonames.org/export/dump/admin1CodesASCII.txt', 'admin1CodesASCII.txt'],
];
for (const [url, name] of targets) {
  const dest = path.join(tmp, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log('cached', name);
    continue;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log('ok', name, buf.length);
}
