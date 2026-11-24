const target = process.argv[2];
const expression = process.argv[3];
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
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    console.log(JSON.stringify(result.result?.value ?? result, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    ws.close();
  }
});
