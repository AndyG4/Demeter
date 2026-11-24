import fs from 'node:fs';

const url = 'https://raw.githubusercontent.com/marianafdz465/municipalities_mx/main/data_raw/df_mexico.csv';
const r = await fetch(url);
if (!r.ok) throw new Error(`${r.status} ${url}`);
const text = await r.text();
fs.mkdirSync('_tmp', { recursive: true });
fs.writeFileSync('_tmp/df_mexico.csv', text);
console.log('ok df_mexico.csv', text.length);
