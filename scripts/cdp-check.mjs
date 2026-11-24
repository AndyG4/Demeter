const target = process.argv[2];
if (!target) throw new Error('missing ws url');

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
    events.push(['LOG', message.params.entry.level, message.params.entry.text, message.params.entry.url]);
  }
  if (message.method === 'Network.loadingFailed') {
    events.push(['NETFAIL', message.params.errorText, message.params.blockedReason, message.params.requestId]);
  }
});

ws.addEventListener('open', async () => {
  try {
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Network.enable');
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: true });
    await new Promise((resolve) => setTimeout(resolve, 9000));
    const result = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ text: document.body.innerText.slice(0, 400), appChildren: document.querySelector('#app')?.children.length, html: document.querySelector('#app')?.innerHTML.slice(0, 300), hasL: typeof window.L, hasGsap: typeof window.gsap, ready: document.readyState })`,
      returnByValue: true,
    });
    console.log('EVAL', result.result?.value);
    for (const event of events) console.log(...event);
  } catch (error) {
    console.error('ERR', error);
  } finally {
    ws.close();
  }
});
