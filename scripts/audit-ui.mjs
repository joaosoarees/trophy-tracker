// Opens the built app and checks every screen the way a release should be
// checked by hand, in each interface language: accessibility (axe), no
// scrollbar on the window itself, no sideways overflow, and a visible hover
// and keyboard-focus state on every kind of clickable element, none of them
// wider than what contains it. Saves a capture of each screen to .audit-ui/
// and exits with an error when something fails.
//
//   pnpm audit:ui
//
// The onboarding is audited on an empty data folder. The screens that need
// Steam data are audited on a throwaway copy of this computer's data folder,
// when there is one; the copy is deleted afterwards and the Web API key in it
// is never read or printed by this script.
import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9333;
const LANGUAGES = ['en', 'pt-BR', 'es', 'fr'];
const OUT = '.audit-ui';
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

// Outside Electron, the `electron` package exports the path of its binary.
const electronBinary = createRequire(import.meta.url)('electron');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

function dataFolder() {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? '', 'trophy-tracker');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'trophy-tracker');
  }
  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'trophy-tracker',
  );
}

/** Starts the built app on the given data folder and connects to its window. */
async function launch(userData) {
  const isPortBusy = await fetch(`http://127.0.0.1:${PORT}/json`).then(
    () => true,
    () => false,
  );
  if (isPortBusy) {
    throw new Error(`Port ${PORT} is in use: close the app that holds it.`);
  }

  // The Electron binary itself, not a wrapper: killing a wrapper would leave
  // the app running and the next launch would end up auditing this one.
  const app = spawn(
    electronBinary,
    ['.', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userData}`],
    { stdio: 'ignore' },
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
  if (!target) {
    app.kill();
    throw new Error('The app did not start. Run `pnpm build` first.');
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (socket.onopen = resolve));
  let lastId = 0;
  const waiting = new Map();
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id) waiting.get(data.id)?.(data.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++lastId;
      waiting.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) =>
    (
      await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
    )?.result?.value;

  return {
    send,
    evaluate,
    capture: async (name) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    },
    close: async () => {
      socket.close();
      app.kill();
      // The port is free again once the app is really gone.
      let isGone = false;
      for (let attempt = 0; attempt < 40 && !isGone; attempt++) {
        try {
          await fetch(`http://127.0.0.1:${PORT}/json`);
          await sleep(250);
        } catch {
          isGone = true;
        }
      }
      if (!isGone) throw new Error('The app did not close.');
      // Electron may still be writing to the data folder as it exits; the
      // caller deletes that folder next.
      await sleep(500);
    },
  };
}

// The properties a state change may touch. If none of them differs between
// rest and a forced state, the element gives no sign of that state.
const STATE_STYLE = `(el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color, s.borderTopColor, s.boxShadow, s.outlineStyle + s.outlineWidth + s.outlineColor, s.opacity, s.textDecorationLine, s.scale, s.filter].join('|'); }`;

/**
 * Forces :hover and :focus-visible on every kind of clickable element on
 * screen and reports the ones that look the same as at rest, and the ones
 * that are wider than what contains them (a hover wash that spills out of its
 * row or section). Elements with the same tag and classes are checked once.
 */
async function auditInteraction(page) {
  // A state that is still animating reads as "no change".
  await page.evaluate(`(() => {
    if (document.getElementById('audit-no-transition')) return;
    const style = document.createElement('style');
    style.id = 'audit-no-transition';
    style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.append(style);
  })()`);
  // A really hovered element would already be in its hover state at "rest".
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 1,
    y: 1,
  });

  const elements = JSON.parse(
    await page.evaluate(`(() => {
      const styleOf = ${STATE_STYLE};
      const seen = new Set();
      const found = [];
      document.querySelectorAll('[data-audit]').forEach((el) => el.removeAttribute('data-audit'));
      for (const el of document.querySelectorAll('button, a[href], [role="switch"], [role="checkbox"], label[for]')) {
        if (el.offsetParent === null || el.disabled) continue;
        const kind = el.tagName + '|' + el.getAttribute('role') + '|' + el.className;
        if (seen.has(kind)) continue;
        seen.add(kind);
        const name = (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40);
        const box = el.getBoundingClientRect();
        const around = el.parentElement.getBoundingClientRect();
        const isPlaced = ['absolute', 'fixed'].includes(getComputedStyle(el).position);
        el.setAttribute('data-audit', String(found.length));
        found.push({
          name,
          rest: styleOf(el),
          // A label has no state of its own: its control shows it.
          hasOwnStates: el.tagName !== 'LABEL',
          spills: !isPlaced && (box.left < around.left - 1 || box.right > around.right + 1),
        });
      }
      return JSON.stringify(found);
    })()`),
  );

  await page.send('DOM.enable');
  await page.send('CSS.enable');
  const { root } = await page.send('DOM.getDocument');
  const problems = [];
  for (const [index, element] of elements.entries()) {
    if (element.spills) {
      problems.push(`wider than what contains it: "${element.name}"`);
    }
    if (!element.hasOwnStates) continue;

    const { nodeId } = await page.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: `[data-audit="${index}"]`,
    });
    const styleWhen = async (state) => {
      await page.send('CSS.forcePseudoState', {
        nodeId,
        forcedPseudoClasses: [state],
      });
      const style = await page.evaluate(
        `(${STATE_STYLE})(document.querySelector('[data-audit="${index}"]'))`,
      );
      await page.send('CSS.forcePseudoState', {
        nodeId,
        forcedPseudoClasses: [],
      });
      return style;
    };

    if ((await styleWhen('hover')) === element.rest) {
      problems.push(`no visible hover: "${element.name}"`);
    }
    if ((await styleWhen('focus-visible')) === element.rest) {
      problems.push(`no visible keyboard focus: "${element.name}"`);
    }
  }
  return problems;
}

/** Runs every check on what is on screen now. */
async function audit(page, name) {
  await page.evaluate(axeSource);
  const result = JSON.parse(
    await page.evaluate(`axe.run(document, { resultTypes: ['violations'] }).then((r) => JSON.stringify({
      violations: r.violations.map((v) => v.id + ' (' + v.nodes.length + '): ' + v.nodes[0].html.slice(0, 120)),
      windowScrolls: document.documentElement.scrollHeight > innerHeight,
      overflowsSideways: document.documentElement.scrollWidth > innerWidth,
    }))`),
  );
  await page.capture(name);

  const problems = [...result.violations, ...(await auditInteraction(page))];
  if (result.windowScrolls) problems.push('the window itself scrolls');
  if (result.overflowsSideways) problems.push('content overflows sideways');
  console.log(`${problems.length === 0 ? 'ok  ' : 'FAIL'} ${name}`);
  for (const problem of problems) {
    console.log(`       ${problem}`);
    failures.push(`${name}: ${problem}`);
  }
}

const detailsToggle = `document.querySelector('header [aria-expanded]')?.click()`;

const navButton = (index) =>
  `[...document.querySelectorAll('nav button')].at(${index}).click()`;

async function auditOnboarding() {
  const userData = mkdtempSync(join(tmpdir(), 'tt-audit-'));
  const page = await launch(userData);
  try {
    await sleep(6000);
    await audit(page, 'onboarding-language');
    // The step's own "advance" is its last button.
    await page.evaluate(
      `[...document.querySelectorAll('main button')].at(-1).click()`,
    );
    await sleep(1000);
    await audit(page, 'onboarding-account');
  } finally {
    await page.close();
    rmSync(userData, { recursive: true, force: true });
  }
}

async function auditApp() {
  const source = dataFolder();
  if (!existsSync(join(source, 'config.json'))) {
    console.log(
      'skip the app screens: this computer has no Trophy Tracker setup to copy',
    );
    return;
  }

  const userData = mkdtempSync(join(tmpdir(), 'tt-audit-'));
  for (const file of [
    'config.json',
    'cache.json',
    'userdata.json',
    'settings.json',
  ]) {
    if (existsSync(join(source, file))) {
      cpSync(join(source, file), join(userData, file));
    }
  }

  const page = await launch(userData);
  try {
    await sleep(7000);
    // Without this the loop below would happily audit the onboarding.
    const isSetUp = await page.evaluate(
      `window.api.getState().then((state) => state.configured)`,
    );
    if (!isSetUp) {
      throw new Error('The copy of the data folder did not open as set up.');
    }
    for (const language of LANGUAGES) {
      await page.evaluate(
        `window.api.setLanguage(${JSON.stringify(language)}).then(() => location.reload())`,
      );
      await sleep(6000);
      await page.evaluate(navButton(0));
      await sleep(900);
      await audit(page, `game-${language}`);
      // The details open from the header; they close again for the next pass.
      await page.evaluate(detailsToggle);
      await sleep(500);
      await audit(page, `game-details-${language}`);
      await page.evaluate(detailsToggle);
      await page.evaluate(navButton(1));
      await sleep(1200);
      await audit(page, `dashboard-${language}`);
      await page.evaluate(navButton(-1));
      await sleep(800);
      await audit(page, `settings-${language}`);
      // Settings is taller than the window: capture its end as well.
      await page.evaluate(
        `document.querySelector('main > div:last-child > section').scrollTo(0, 99999)`,
      );
      await sleep(300);
      await audit(page, `settings-end-${language}`);
    }
  } finally {
    await page.close();
    rmSync(userData, { recursive: true, force: true });
  }
}

if (!existsSync('out/main/index.js')) {
  console.error('No build found. Run `pnpm build` first.');
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await auditOnboarding();
await auditApp();

console.log(
  failures.length === 0
    ? `\nNo problems found. Captures are in ${OUT}/.`
    : `\n${failures.length} problem(s). Captures are in ${OUT}/.`,
);
process.exit(failures.length === 0 ? 0 : 1);
