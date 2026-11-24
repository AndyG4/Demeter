import fs from 'node:fs';

const target = process.argv[2];
const url = process.argv[3] || 'http://127.0.0.1:8080/';
const out = process.argv[4] || '_tmp/page.png';
const width = Number(process.argv[5] || 1440);
const height = Number(process.argv[6] || 1200);
const mobile = process.argv[7] === 'mobile';

const ws = new WebSocket(target);
let id = 0;
const pending = new Map();
const errors = [];

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
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(['EXCEPTION', message.params.exceptionDetails?.text, message.params.exceptionDetails?.exception?.description]);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(['CONSOLE', message.params.args?.map((a) => a.value ?? a.description).join(' ')]);
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    errors.push(['LOG', message.params.entry.text, message.params.entry.url]);
  }
});

ws.addEventListener('open', async () => {
  try {
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await send('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, 15000));
    const summary = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        title: document.title,
        inner: [innerWidth, innerHeight],
        mapRect: (() => { const r = document.querySelector('#map')?.getBoundingClientRect(); return r ? { w: r.width, h: r.height } : null })(),
        mapPaths: document.querySelectorAll('.leaflet-pane path').length,
        canvas: [...document.querySelectorAll('.leaflet-pane canvas')].map(c => [c.width, c.height]),
        results: document.querySelectorAll('.result-card').length,
        models: document.querySelectorAll('.model-card').length,
        reveal: [...document.querySelectorAll('.reveal')].map(e => getComputedStyle(e).opacity),
        errors: [...document.querySelectorAll('.inline-error')].map(e => e.innerText)
      })`,
      returnByValue: true,
    });
    console.log('SUMMARY', summary.result?.value);
    for (const error of errors) console.log(...error);

    const metrics = await send('Page.getLayoutMetrics');
    const content = metrics.cssContentSize || metrics.contentSize;
    const clipWidth = Math.min(width, Math.ceil(content.width));
    const clipHeight = Math.min(12000, Math.ceil(content.height));
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: clipWidth, height: clipHeight, scale: 1 },
    });
    fs.writeFileSync(out, Buffer.from(screenshot.data, 'base64'));
    console.log('SHOT', out, clipWidth, clipHeight);
  } catch (error) {
    console.error('ERR', error);
  } finally {
    ws.close();
  }
});
