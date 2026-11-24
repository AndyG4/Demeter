import fs from 'node:fs';

const target = process.argv[2];
const out = process.argv[3] || '_tmp/page.png';
const ws = new WebSocket(target);
let id = 0;
const pending = new Map();
const events = [];

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
    events.push(['EXCEPTION', message.params.exceptionDetails?.text, message.params.exceptionDetails?.exception?.description]);
  }
  if (message.method === 'Runtime.consoleAPICalled') {
    events.push(['CONSOLE', message.params.type, message.params.args?.map((a) => a.value ?? a.description).join(' ')]);
  }
  if (message.method === 'Log.entryAdded') {
    const entry = message.params.entry;
    if (entry.level === 'error') events.push(['LOG', entry.level, entry.text, entry.url]);
  }
  if (message.method === 'Network.loadingFailed' && message.params.blockedReason) {
    events.push(['NETFAIL', message.params.errorText, message.params.blockedReason]);
  }
});

ws.addEventListener('open', async () => {
  try {
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Network.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.reload', { ignoreCache: true });
    await new Promise((resolve) => setTimeout(resolve, 14000));
    const summary = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        title: document.title,
        text: document.body.innerText.slice(0, 220),
        results: document.querySelectorAll('.result-card').length,
        mapPaths: document.querySelectorAll('.leaflet-overlay-pane path').length,
        stats: [...document.querySelectorAll('.hero-stat__value')].map(n => n.textContent),
        geoLoaded: !!document.querySelector('.leaflet-container'),
        appHeight: document.querySelector('.page')?.scrollHeight,
        demo: document.querySelector('#demo-chip')?.innerText,
        modelCards: document.querySelectorAll('.model-card').length,
        errors: [...document.querySelectorAll('.inline-error')].map(n => n.innerText)
      })`,
      returnByValue: true,
    });
    console.log('SUMMARY', summary.result?.value);
    for (const event of events) console.log(...event);

    const metrics = await send('Page.getLayoutMetrics');
    const content = metrics.cssContentSize || metrics.contentSize;
    const width = Math.min(1440, Math.ceil(content.width));
    const height = Math.min(10000, Math.ceil(content.height));
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    fs.writeFileSync(out, Buffer.from(screenshot.data, 'base64'));
    console.log('SHOT', out, width, height);
  } catch (error) {
    console.error('ERR', error);
  } finally {
    ws.close();
  }
});
