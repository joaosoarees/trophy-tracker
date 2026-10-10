// Takes the pictures the README shows, from the built app running against
// the fake Steam: nothing in them is anyone's real account.
//
//   pnpm screenshots
//
// Writes docs/screenshots/*.png and unlock.gif (an achievement being unlocked
// while the game runs, and then the last one). The game art comes from
// Steam's servers, so this needs the internet.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import gifenc from 'gifenc';
import { PNG } from 'pngjs';

import {
  SECOND_STEAM_ID,
  startFakeSteam,
  writeFakeSteamFolder,
} from './fake-steam.mjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;
const PORT = 9337;
const OUT = 'docs/screenshots';
const STEAM_ID = '76561198000000042';
const ONIMUSHA = 2638890;
const WIDTH = 600;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!existsSync('out/main/index.js')) {
  console.error('No build found. Run `pnpm build` first.');
  process.exit(1);
}

/** A face for an account that has none: its initial on a colour. */
const avatar = (letter, colour) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${colour}"/><text x="32" y="43" font-family="system-ui,sans-serif" font-size="30" font-weight="600" text-anchor="middle" fill="#0b1722">${letter}</text></svg>`,
  )}`;

const account = (steamId, name, apiKey, face) => ({
  steamId,
  apiKey,
  keyEnding: apiKey.slice(-4),
  profile: { steamId, name, avatar: face },
  status: 'valid',
});

const steam = await startFakeSteam();
const home = mkdtempSync(join(tmpdir(), 'tt-shots-home-'));
const data = mkdtempSync(join(tmpdir(), 'tt-shots-'));
writeFakeSteamFolder(home, STEAM_ID);
// The app as someone with two accounts has it, skipping the setup.
writeFileSync(
  join(data, 'config.json'),
  JSON.stringify({
    version: 2,
    accounts: [
      account(
        STEAM_ID,
        'Hikari',
        '0123456789ABCDEF0123456789ABCDEF',
        avatar('H', '#66c0f4'),
      ),
      account(
        SECOND_STEAM_ID,
        'Hikari (second account)',
        'FEDCBA9876543210FEDCBA9876540000',
        avatar('H', '#a4d007'),
      ),
    ],
    activeSteamId: STEAM_ID,
  }),
);

const app = spawn(
  createRequire(import.meta.url)('electron'),
  ['.', `--remote-debugging-port=${PORT}`, `--user-data-dir=${data}`],
  {
    stdio: 'ignore',
    env: {
      ...process.env,
      TROPHY_TRACKER_FAKE_STEAM: steam.url,
      TROPHY_TRACKER_FAKE_STEAM_HOME: home,
    },
  },
);

let target;
for (let attempt = 0; attempt < 120 && !target; attempt++) {
  try {
    const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = pages.find((page) => page.type === 'page');
  } catch {
    await sleep(250);
  }
}
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => (socket.onopen = resolve));
let lastId = 0;
const waiting = new Map();
socket.onmessage = (message) => {
  const reply = JSON.parse(message.data);
  if (reply.id) waiting.get(reply.id)?.(reply.result);
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++lastId;
    waiting.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true }))?.result
    ?.value;
const shot = async (height) =>
  Buffer.from(
    (
      await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: WIDTH, height, scale: 1 },
      })
    ).data,
    'base64',
  );
const save = async (name, height = 860) => {
  writeFileSync(join(OUT, `${name}.png`), await shot(height));
  console.log(`${OUT}/${name}.png`);
};
const tab = (index) =>
  evaluate(`[...document.querySelectorAll('nav button')].at(${index}).click()`);
const until = async (expression, timeout = 15_000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await sleep(200);
  }
  throw new Error(`Never happened: ${expression}`);
};
const title = `document.querySelector('header h1')?.innerText`;

try {
  await until(`(${title}) === 'Nioh 3'`);
  // The art and the icons come from Steam; give them a moment.
  await sleep(4000);
  await evaluate(`document.activeElement?.blur()`);
  await save('game');

  await evaluate(`document.querySelector('header [aria-expanded]').click()`);
  await sleep(700);
  await save('game-details');
  await evaluate(`document.querySelector('header [aria-expanded]').click()`);

  await tab(1);
  await sleep(2500);
  // The demonstration library is short: only as tall as what it holds.
  await save('dashboard', 330);

  await tab(-1);
  await sleep(1200);
  await save('settings', 470);

  // An achievement unlocked while the game runs, and then the last one.
  // It starts on the game last played, before another one is opened.
  await tab(0);
  await sleep(1200);
  const HEIGHT = 520;
  const frames = [];
  let isRecording = true;
  const recording = (async () => {
    while (isRecording) {
      const started = Date.now();
      frames.push({ at: started, png: await shot(HEIGHT) });
      // Four pictures a second: enough to follow, and a file a README can carry.
      await sleep(Math.max(0, 250 - (Date.now() - started)));
    }
  })();

  await sleep(900);
  steam.play(ONIMUSHA);
  await until(`(${title}) === 'Onimusha: Way of the Sword'`);
  await sleep(2000);
  steam.unlockNext(ONIMUSHA);
  await until(`document.querySelector('section [role="status"]') !== null`);
  await sleep(2500);
  steam.unlockNext(ONIMUSHA);
  await until(`/100%/.test(document.querySelector('main').innerText)`);
  await sleep(2500);
  isRecording = false;
  await recording;
  await save('complete', 560);

  // Frames that show the same thing become one that lasts longer.
  const gif = GIFEncoder();
  let held = null;
  const flush = (until) => {
    if (!held) return;
    const { data } = PNG.sync.read(held.png);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), WIDTH, HEIGHT, {
      palette,
      delay: Math.max(250, until - held.at),
    });
  };
  for (const frame of frames) {
    if (held && frame.png.equals(held.png)) continue;
    flush(frame.at);
    held = frame;
  }
  flush(held.at + 2500);
  gif.finish();
  writeFileSync(join(OUT, 'unlock.gif'), gif.bytes());
  console.log(`${OUT}/unlock.gif (${frames.length} frames captured)`);
} finally {
  socket.close();
  app.kill();
  await steam.stop();
  await sleep(800);
  rmSync(data, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
}
process.exit(0);
