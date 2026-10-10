const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 120 && !target; i++) {
  try {
    target = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(
      (t) => t.type === 'page',
    );
  } catch {
    await sleep(500);
  }
}
if (!target) {
  console.log('RESULT: app did not start');
  process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let n = 0;
const waiting = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id) waiting.get(d.id)?.(d);
};
const js = (e) =>
  new Promise((r) => {
    const id = ++n;
    waiting.set(id, (d) => r(d.result?.result?.value));
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression: e, awaitPromise: true, returnByValue: true },
      }),
    );
  });
await sleep(4000);
console.log('RESULT title:', await js('document.title'));
console.log(
  'RESULT screen:',
  await js(`document.querySelector('h1')?.textContent`),
  '| steps:',
  await js(
    `[...document.querySelectorAll('ol button')].map(b => b.textContent).join(',')`,
  ),
);
console.log(
  'RESULT state:',
  await js(
    `window.api.getState().then(s => JSON.stringify({ isConfigured: s.isConfigured, language: s.language }))`,
  ),
);
console.log(
  'RESULT SteamID read from the Linux Steam folder:',
  await js(`window.api.detectSteamId()`),
);
console.log(
  'RESULT current game with no setup:',
  await js(`window.api.getCurrentAppId().then(c => JSON.stringify(c))`),
);
ws.close();
