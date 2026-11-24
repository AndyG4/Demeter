import fs from 'node:fs';

async function post(body) {
  const r = await fetch('https://plataformaciudadanadefosas.org/api/v1/map', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, text };
}

for (const body of [{ years: [2006, 2024] }, { years: [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] }, { years: [2024] }]) {
  const r = await post(body);
  console.log('body', body.years.length, r.status, r.text.length);
  if (r.status !== 200) {
    console.log(r.text.slice(0, 200));
    continue;
  }
  const arr = JSON.parse(r.text);
  const byMun = new Map();
  for (const row of arr) {
    const k = `${row.id_ent}-${row.id_mun}`;
    byMun.set(k, (byMun.get(k) || 0) + 1);
  }
  console.log('rows', arr.length, 'muns', byMun.size, 'sources', [...new Set(arr.map((x) => x.id_source))]);
  console.log('top', [...byMun.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
  console.log('sample', arr.slice(0, 3));
  fs.writeFileSync(`_tmp/pcdf-map-${body.years.length}.json`, r.text);
}
