import fs from 'node:fs';

const target = process.argv[2];
const out = process.argv[3] || '_tmp/viewport.png';
const scrollY = Number(process.argv[4] || 0);
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
ws.addEventListener('open', async () => {
  try {
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${scrollY})` });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log('SHOT', out);
  } catch (error) {
    console.error(error);
  } finally {
    ws.close();
  }
});
