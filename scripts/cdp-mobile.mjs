import fs from 'node:fs';

const target = process.argv[2];
const url = process.argv[3] || 'http://127.0.0.1:8080/';
const ws = new WebSocket(target);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });
}

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
});

async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`_tmp/${name}.png`, Buffer.from(result.data, 'base64'));
  console.log('SHOT', name);
}

async function scroll(y) {
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${y})` });
  await new Promise((resolve) => setTimeout(resolve, 900));
}

ws.addEventListener('open', async () => {
  try {
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await send('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, 14000));

    await scroll(0);
    await shot('m-hero');

    await scroll(620);
    await shot('m-search');

    await scroll(1050);
    await shot('m-map');

    await send('Runtime.evaluate', { expression: 'window.scrollTo(0,0); document.querySelector(".menu-toggle").click()' });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await shot('m-menu');
    await send('Runtime.evaluate', { expression: 'document.querySelector(".menu-toggle").click(); document.querySelector(".search-example").click()' });
    await new Promise((resolve) => setTimeout(resolve, 2200));
    await scroll(640);
    await shot('m-results');

    await send('Runtime.evaluate', { expression: 'document.querySelector(".result-card").click()' });
    await new Promise((resolve) => setTimeout(resolve, 900));
    await shot('m-sheet');

    const summary = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        width: innerWidth,
        results: document.querySelectorAll('.result-card').length,
        sheetOpen: document.querySelector('.sheet')?.classList.contains('is-open'),
        mapRect: (() => { const r = document.querySelector('#map')?.getBoundingClientRect(); return r ? {w:r.width,h:r.height} : null })(),
        overflowX: document.documentElement.scrollWidth > innerWidth,
        docWidth: document.documentElement.scrollWidth
      })`,
      returnByValue: true,
    });
    console.log('SUMMARY', summary.result?.value);
  } catch (error) {
    console.error('ERR', error);
  } finally {
    ws.close();
  }
});
