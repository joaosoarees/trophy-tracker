// Opens the built app and checks it the way a release should be checked by
// hand. Saves a capture of each screen and each step to .audit-ui/ and exits
// with an error when something fails.
//
//   pnpm audit:ui
//
// The app runs for real, against a fake Steam (scripts/fake-steam.mjs) that
// answers from the real responses in test/fixtures. Nothing of this
// computer's Trophy Tracker data, account or key is read. The audit:
// - goes through the onboarding as a new user, including a rejected key, a
//   private profile and Steam being unreachable;
// - checks every screen in each language: accessibility (axe), no scrollbar
//   on the window, no sideways overflow, and a visible hover and keyboard
//   focus on every kind of clickable element, none wider than what holds it;
// - runs the flows no single capture shows: the game details opening and
//   closing, an achievement being unlocked, a game being finished, and Steam
//   going off the air with the app open and before it opens.
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startFakeSteam } from './fake-steam.mjs';

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

/** Starts the built app on the given data folder and connects to its window. */
async function launch(userData, steamUrl) {
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
    {
      stdio: 'ignore',
      env: { ...process.env, TROPHY_TRACKER_FAKE_STEAM: steamUrl },
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
  await page.evaluate(
    `document.getElementById('audit-no-transition')?.remove()`,
  );
  return problems;
}

/**
 * Clicks the control that opens a section and samples the section's height
 * on every frame for a moment. Answers the heights seen, -1 where the section
 * was not in the page.
 */
const sampleHeights = (toggle, section) => `(async () => {
  document.querySelector(${JSON.stringify(toggle)}).click();
  const heights = [];
  const start = performance.now();
  while (performance.now() - start < 450) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const el = document.querySelector(${JSON.stringify(section)});
    heights.push(el ? Math.round(el.getBoundingClientRect().height) : -1);
  }
  return JSON.stringify(heights);
})()`;

/**
 * The game details as a flow, which no single capture shows: they have to
 * animate open and closed, leave the page once closed, and every row that
 * names an achievement has to lead to it, also with the hidden-only filter on.
 */
async function auditDetailsFlow(page) {
  const TOGGLE = 'header [aria-expanded]';
  const SECTION = 'header .collapsible';
  const problems = [];
  const fail = (problem) => {
    console.log(`       ${problem}`);
    problems.push(problem);
    failures.push(`details flow: ${problem}`);
  };

  const isOpen = await page.evaluate(
    `document.querySelector('${TOGGLE}').getAttribute('aria-expanded') === 'true'`,
  );
  if (isOpen) {
    await page.evaluate(`document.querySelector('${TOGGLE}').click()`);
    await sleep(500);
  }

  const opening = JSON.parse(
    await page.evaluate(sampleHeights(TOGGLE, SECTION)),
  );
  const full = opening.at(-1);
  if (!opening.some((height) => height > 0 && height < full)) {
    fail(
      `the details pop open instead of growing (heights: ${opening.slice(0, 8).join(', ')})`,
    );
  }
  await page.capture('flow-details-open');

  const closing = JSON.parse(
    await page.evaluate(sampleHeights(TOGGLE, SECTION)),
  );
  if (!closing.some((height) => height > 0 && height < full)) {
    fail(
      `the details vanish instead of shrinking (heights: ${closing.slice(0, 8).join(', ')})`,
    );
  }
  if (closing.at(-1) !== -1) fail('the closed details stay in the page');

  // Every row that names an achievement, with the filter that could hide it on.
  await page.evaluate(`document.querySelector('${TOGGLE}').click()`);
  await sleep(500);
  const rows = await page.evaluate(
    `document.querySelectorAll('${SECTION} li button').length`,
  );
  let usedHiddenFilter = false;
  for (let index = 0; index < rows; index++) {
    const turnedOn = await page.evaluate(`(() => {
      const group = [...document.querySelectorAll('[role="group"]')].find((el) => el.offsetParent !== null);
      const toggle = group?.parentElement.querySelector(':scope > button[aria-pressed]');
      if (!toggle) return false;
      if (toggle.getAttribute('aria-pressed') === 'false') toggle.click();
      return true;
    })()`);
    usedHiddenFilter ||= turnedOn;
    await sleep(200);

    const row = await page.evaluate(`(() => {
      const button = document.querySelectorAll('${SECTION} li button')[${index}];
      const label = button.innerText.replace(/\\s+/g, ' ').trim();
      button.click();
      return label;
    })()`);
    await sleep(600);
    const found = JSON.parse(
      await page.evaluate(`(() => {
        const search = [...document.querySelectorAll('input')].find((el) => el.offsetParent !== null);
        const titles = [...document.querySelectorAll('ul h2')].filter((el) => el.offsetParent !== null).map((el) => el.innerText.trim());
        return JSON.stringify({ query: search?.value ?? '', shown: titles.includes(search?.value ?? '') });
      })()`),
    );
    if (!found.shown) {
      fail(
        `"${row}" searches for "${found.query}" and shows no such achievement`,
      );
    }
    // Back to an empty search for the next row.
    await page.evaluate(`(() => {
      const search = [...document.querySelectorAll('input')].find((el) => el.offsetParent !== null);
      search?.parentElement.querySelector('button')?.click();
    })()`);
    await sleep(300);
  }
  await page.evaluate(`document.querySelector('${TOGGLE}').click()`);
  await sleep(400);

  console.log(
    `${problems.length === 0 ? 'ok  ' : 'FAIL'} flow: game details open, close and lead to ${rows} achievement(s)` +
      (usedHiddenFilter
        ? ', with the hidden-only filter on'
        : ' (this game has no hidden achievements: the filter was not exercised)'),
  );
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

/** A flow step that either holds or is reported. */
function expectThat(flow, condition, problem) {
  if (condition) return;
  console.log(`       ${problem}`);
  failures.push(`${flow}: ${problem}`);
}

const visibleText = (selector) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].filter((el) => el.offsetParent !== null).map((el) => el.innerText.trim()).join(' | ')`;

/** Clicks the last button of the onboarding step: its own "advance". */
const advance = `[...document.querySelectorAll('main button')].filter((el) => el.offsetParent !== null).at(-1).click()`;

async function type(page, selector, text) {
  await page.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).focus()`,
  );
  await page.send('Input.insertText', { text });
}

/**
 * The onboarding as a new user meets it, with Steam answering badly before
 * it answers well. Leaves the app set up, on its first screen.
 */
async function auditOnboarding(page, steam) {
  const FLOW = 'onboarding';
  await audit(page, 'onboarding-language');
  await page.evaluate(advance);
  await sleep(1000);
  await audit(page, 'onboarding-account');

  await type(page, 'input[placeholder^="7656119"]', '76561198000000042');
  await type(
    page,
    'input[type="password"]',
    '0123456789ABCDEF0123456789ABCDEF',
  );

  const verify = async () => {
    await page.evaluate(advance);
    await sleep(1800);
    return page.evaluate(visibleText('main [role="alert"]'));
  };

  steam.state.mode = 'bad-key';
  let alert = await verify();
  expectThat(
    FLOW,
    /key/i.test(alert),
    `a rejected key shows no error about the key (shown: "${alert}")`,
  );
  await audit(page, 'onboarding-key-rejected');

  steam.state.mode = 'down';
  alert = await verify();
  expectThat(
    FLOW,
    /reach|connection/i.test(alert),
    `Steam being unreachable shows no error about it (shown: "${alert}")`,
  );
  await audit(page, 'onboarding-steam-down');

  steam.state.mode = 'private';
  alert = await verify();
  expectThat(
    FLOW,
    /privacy|public/i.test(alert),
    `a private profile shows no error about privacy (shown: "${alert}")`,
  );
  await audit(page, 'onboarding-profile-private');

  steam.state.mode = 'ok';
  alert = await verify();
  expectThat(
    FLOW,
    alert === '',
    `a good key still shows an error ("${alert}")`,
  );
  const verified = await page.evaluate(
    `document.querySelector('main').innerText`,
  );
  expectThat(
    FLOW,
    /Verified/.test(verified),
    'a good key is not shown as verified',
  );
  await audit(page, 'onboarding-verified');

  await page.evaluate(advance);
  await sleep(1000);
  await audit(page, 'onboarding-done');
  await page.evaluate(advance);
  await sleep(4000);
  const isInTheApp = await page.evaluate(
    `document.querySelector('nav') !== null`,
  );
  expectThat(FLOW, isInTheApp, 'finishing the setup does not open the app');
  console.log(
    `${isInTheApp ? 'ok  ' : 'FAIL'} flow: onboarding, through a rejected key, Steam down and a private profile`,
  );
}

/** Every screen of the app, in every language. */
async function auditScreens(page) {
  for (const language of LANGUAGES) {
    await page.evaluate(
      `window.api.setLanguage(${JSON.stringify(language)}).then(() => location.reload())`,
    );
    await sleep(6000);
    await page.evaluate(navButton(0));
    await sleep(900);
    await audit(page, `game-${language}`);
    // Flows do not depend on the language: once is enough.
    if (language === LANGUAGES[0]) await auditDetailsFlow(page);
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
  await page.evaluate(
    `window.api.setLanguage(${JSON.stringify(LANGUAGES[0])}).then(() => location.reload())`,
  );
  await sleep(6000);
}

const refreshGame = `document.querySelector('header [aria-label="Refresh"]').click()`;
const gameTitle = `document.querySelector('header h1')?.innerText ?? ''`;
const showList = (name) =>
  `[...document.querySelectorAll('[role="group"] button')].filter((el) => el.offsetParent !== null).find((el) => el.innerText.startsWith(${JSON.stringify(name)}))?.click()`;

/** Opens a game from the dashboard by its name. */
async function openGame(page, name) {
  await page.evaluate(navButton(1));
  await sleep(1000);
  await page.evaluate(
    `[...document.querySelectorAll('ul button')].find((el) => el.innerText.includes(${JSON.stringify(name)}))?.click()`,
  );
  await sleep(2500);
}

/** An achievement is unlocked while the game is on screen, and then the last one. */
async function auditUnlocks(page, steam) {
  const FLOW = 'unlock';
  const failuresBefore = failures.length;
  const game = steam.games.find((g) => g.appid === 2638890);
  await openGame(page, game.name);
  // The app was last left on a list chosen by an earlier step.
  await page.evaluate(showList('Pending'));
  await sleep(600);
  const leftBefore = game.schema.length - game.unlocked;

  const unlocked = steam.unlockNext(game.appid);
  await page.evaluate(refreshGame);
  await sleep(2500);
  const notice = await page.evaluate(visibleText('section [role="status"]'));
  expectThat(
    FLOW,
    notice.includes(unlocked),
    `the notice does not name "${unlocked}" (shown: "${notice}")`,
  );
  const header = await page.evaluate(
    `document.querySelector('header').innerText`,
  );
  expectThat(
    FLOW,
    header.includes(`${leftBefore - 1} left`),
    `the header does not say ${leftBefore - 1} left`,
  );
  const stillPending = await page.evaluate(visibleText('ul h2'));
  expectThat(
    FLOW,
    !stillPending.split(' | ').includes(unlocked),
    `"${unlocked}" is still in the pending list`,
  );
  await audit(page, 'flow-unlocked-one');
  await page.evaluate(showList('Unlocked'));
  await sleep(700);
  const nowUnlocked = await page.evaluate(visibleText('ul h2'));
  expectThat(
    FLOW,
    nowUnlocked.split(' | ').includes(unlocked),
    `"${unlocked}" is not in the unlocked list`,
  );
  await page.evaluate(showList('Pending'));
  await sleep(600);

  steam.unlockNext(game.appid);
  await page.evaluate(refreshGame);
  await sleep(2500);
  const finished = await page.evaluate(
    `document.querySelector('main').innerText`,
  );
  expectThat(
    FLOW,
    /100%/.test(finished) && /Every achievement unlocked/.test(finished),
    'finishing the game does not show the completion state',
  );
  const lastNotice = await page.evaluate(
    visibleText('section [role="status"]'),
  );
  expectThat(
    FLOW,
    /Every achievement unlocked!/.test(lastNotice),
    `the last unlock is not announced as the end (shown: "${lastNotice}")`,
  );
  await audit(page, 'flow-game-finished');
  console.log(
    `${failures.length === failuresBefore ? 'ok  ' : 'FAIL'} flow: "${unlocked}" unlocked, then the last one`,
  );
}

/** Steam stops answering with the app open: what is on screen must stay, with an error. */
async function auditOutage(page, steam) {
  const FLOW = 'Steam down';
  const failuresBefore = failures.length;
  await openGame(page, 'Nioh 3');
  const title = await page.evaluate(gameTitle);
  const cards = await page.evaluate(
    `document.querySelectorAll('ul h2').length`,
  );

  steam.state.mode = 'down';
  await page.evaluate(refreshGame);
  await sleep(3000);
  expectThat(
    FLOW,
    (await page.evaluate(gameTitle)) === title,
    'the game left the screen when Steam stopped answering',
  );
  expectThat(
    FLOW,
    (await page.evaluate(`document.querySelectorAll('ul h2').length`)) ===
      cards,
    'the list changed when Steam stopped answering',
  );
  const error = await page.evaluate(visibleText('header .text-destructive'));
  expectThat(
    FLOW,
    /reach|connection/i.test(error),
    `no error says Steam cannot be reached (shown: "${error}")`,
  );
  await audit(page, 'flow-steam-down-game');

  await page.evaluate(navButton(1));
  await sleep(800);
  await page.evaluate(
    `document.querySelector('main [aria-label="Refresh everything"]')?.click()`,
  );
  await sleep(3000);
  const rows = await page.evaluate(
    `[...document.querySelectorAll('ul button')].filter((el) => el.offsetParent !== null).length`,
  );
  expectThat(
    FLOW,
    rows > 0,
    'the dashboard emptied when Steam stopped answering',
  );
  await audit(page, 'flow-steam-down-dashboard');
  console.log(
    `${failures.length === failuresBefore ? 'ok  ' : 'FAIL'} flow: Steam stops answering with the app open`,
  );
}

/** The app is opened while Steam is unreachable: it must come up with what it had. */
async function auditColdStartOffline(page) {
  const FLOW = 'Steam down at start';
  await sleep(7000);
  const title = await page.evaluate(gameTitle);
  expectThat(
    FLOW,
    title !== '',
    'opened with Steam unreachable, the app shows no game',
  );
  const body = await page.evaluate(
    `document.querySelector('main')?.innerText.slice(0, 200) ?? document.body.innerText.slice(0, 200)`,
  );
  await audit(page, 'flow-steam-down-at-start');
  console.log(
    `${title !== '' ? 'ok  ' : 'FAIL'} flow: the app opened with Steam unreachable (shows: "${(title || body).replace(/\s+/g, ' ').slice(0, 70)}")`,
  );
}

if (!existsSync('out/main/index.js')) {
  console.error('No build found. Run `pnpm build` first.');
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const steam = await startFakeSteam();
const userData = mkdtempSync(join(tmpdir(), 'tt-audit-'));
try {
  let page = await launch(userData, steam.url);
  try {
    await sleep(6000);
    await auditOnboarding(page, steam);
    await auditScreens(page);
    await auditUnlocks(page, steam);
    await auditOutage(page, steam);
  } finally {
    await page.close();
  }

  // Same data folder, Steam still off the air.
  page = await launch(userData, steam.url);
  try {
    await auditColdStartOffline(page);
  } finally {
    await page.close();
  }
} finally {
  await steam.stop();
  rmSync(userData, { recursive: true, force: true });
}

console.log(
  failures.length === 0
    ? `\nNo problems found. Captures are in ${OUT}/.`
    : `\n${failures.length} problem(s). Captures are in ${OUT}/.`,
);
process.exit(failures.length === 0 ? 0 : 1);
