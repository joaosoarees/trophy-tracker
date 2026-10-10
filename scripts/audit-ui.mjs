// Opens the built app and checks it the way a release should be checked by
// hand. Saves a capture of each screen and each step to .audit-ui/ and exits
// with an error when something fails.
//
//   pnpm audit:ui
//
// The app runs for real, against a fake Steam (scripts/fake-steam.mjs) that
// answers from the real responses in __tests__/fixtures, and a fake Steam client
// folder. Nothing of this computer's Trophy Tracker data, account or key is
// read. The audit runs once per language, as a new user each time, so that
// everything on screen (interface, errors, achievement names) is in that
// language from the first screen on:
// - the onboarding, with the SteamID found in the Steam client, through a
//   rejected key, a private profile and Steam being unreachable;
// - every screen, checked for accessibility (axe), no scrollbar on the
//   window, no sideways overflow, and a visible hover and keyboard focus on
//   every kind of clickable element, none wider than what holds it;
// - the screen shown when the interface fails to draw, and the way back.
// Then, in the first language, the flows no single capture shows: the game
// details opening and closing, a game starting, an achievement unlocked
// while playing, the game finished and closed, and Steam off the air with
// the app open, before it opens, and before it opens for the first time.
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

import {
  SECOND_STEAM_ID,
  startFakeSteam,
  writeFakeSteamFolder,
} from './fake-steam.mjs';

const PORT = 9333;
// In the order of the onboarding's language list, with Steam's name for each.
const LANGUAGES = ['en', 'pt-BR', 'es', 'fr'];
const STEAM_LANGUAGE = {
  en: 'english',
  'pt-BR': 'brazilian',
  es: 'spanish',
  fr: 'french',
};
const STEAM_ID = '76561198000000042';
const NIOH = 3681010;
const ONIMUSHA = 2638890;
const OUT = '.audit-ui';
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

// Outside Electron, the `electron` package exports the path of its binary.
const electronBinary = createRequire(import.meta.url)('electron');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

/**
 * Starts the built app on the given data folder, talking to the fake Steam
 * and reading the fake Steam client folder under `home`, and connects to its
 * window.
 */
async function launch(userData, steamUrl, home) {
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
      env: {
        ...process.env,
        TROPHY_TRACKER_FAKE_STEAM: steamUrl,
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
  // So would a focused one: a dialog puts the focus on its first button.
  await page.evaluate(`document.activeElement?.blur()`);
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

/** Waits for something to become true in the page; answers whether it did. */
async function waitFor(page, expression, timeout = 12_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(expression)) return true;
    await sleep(250);
  }
  return false;
}

/** Clicks the last button of the onboarding step: its own "advance". */
const advance = `[...document.querySelectorAll('main button')].filter((el) => el.offsetParent !== null).at(-1).click()`;

/**
 * "Verify". The form of the first account is verified by the step's own
 * forward button; one opened to add another account sits in a panel with its
 * own. With no form open, the same place holds "Add another account".
 */
const verifyAccount = `(() => {
  const shown = (el) => el.offsetParent !== null;
  const panel = document.querySelector('[id$="-steamId"]')?.closest('.rounded-lg.border');
  const own = [...document.querySelectorAll('main button')].filter((el) => shown(el) && !el.closest('footer'));
  const all = [...document.querySelectorAll('main button')].filter(shown);
  const target = panel
    ? [...panel.querySelectorAll('button')].filter(shown).at(-1)
    : document.querySelector('[id$="-steamId"]')
      ? all.at(-1)
      : own.at(-1);
  target.click();
})()`;
const accountCards = `document.querySelectorAll('main form ul[aria-label] > li').length`;

/**
 * Captures the screen with the pointer "over" an element. The checks only
 * say that a hover changes something; what it looks like has to be seen.
 */
async function captureHover(page, element, name) {
  await page.evaluate(`(() => {
    document.querySelectorAll('[data-audit-hover]').forEach((el) => el.removeAttribute('data-audit-hover'));
    (${element}).setAttribute('data-audit-hover', '');
  })()`);
  await page.send('DOM.enable');
  await page.send('CSS.enable');
  const { root } = await page.send('DOM.getDocument');
  const { nodeId } = await page.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '[data-audit-hover]',
  });
  await page.send('CSS.forcePseudoState', {
    nodeId,
    forcedPseudoClasses: ['hover'],
  });
  await sleep(250);
  await page.capture(name);
  await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
}

async function type(page, selector, text) {
  await page.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).select()`,
  );
  await page.send('Input.insertText', { text });
}

/**
 * Enter held down in a field: the key repeats before the screen is drawn
 * again, so whatever Enter starts is asked for several times at once.
 */
async function holdEnter(page, selector) {
  await page.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).focus()`,
  );
  const enter = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
  await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      page.send('Input.dispatchKeyEvent', {
        ...enter,
        type: 'keyDown',
        text: '\r',
        autoRepeat: index > 0,
      }),
    ),
  );
  await page.send('Input.dispatchKeyEvent', { ...enter, type: 'keyUp' });
}

/**
 * The onboarding as a new user meets it, in the language picked on its first
 * screen, with Steam answering badly before it answers well. Leaves the app
 * set up, on its first screen.
 */
async function auditOnboarding(page, steam, language) {
  const FLOW = `onboarding (${language})`;
  const failuresBefore = failures.length;
  const isFirst = language === LANGUAGES[0];
  await page.evaluate(
    `document.querySelectorAll('[role="radio"]')[${LANGUAGES.indexOf(language)}].click()`,
  );
  await sleep(600);
  await audit(page, `onboarding-language-${language}`);
  await page.evaluate(advance);
  await sleep(1000);

  const steamId = JSON.parse(
    await page.evaluate(
      `JSON.stringify({ value: document.querySelector('[id$="-steamId"]').value, locked: document.querySelector('[id$="-steamId"]').readOnly })`,
    ),
  );
  expectThat(
    FLOW,
    steamId.value === STEAM_ID && steamId.locked,
    `the SteamID of the Steam client is not filled in and locked (shown: "${steamId.value}")`,
  );
  await audit(page, `onboarding-account-${language}`);
  if (isFirst) {
    // The way out of the detected account: the field opens for typing.
    await page.evaluate(
      `document.querySelector('[id$="-steamId"]').closest('.space-y-2').querySelector('p button').click()`,
    );
    await sleep(500);
    expectThat(
      FLOW,
      !(await page.evaluate(
        `document.querySelector('[id$="-steamId"]').readOnly`,
      )),
      '"Use another account" does not open the SteamID for typing',
    );
    expectThat(
      FLOW,
      !/could not find an account/i.test(
        await page.evaluate(`document.querySelector('main').innerText`),
      ),
      '"Use another account" says no account was found in the Steam client, when one was',
    );
    await audit(page, `onboarding-account-typed-${language}`);
    await type(page, '[id$="-steamId"]', STEAM_ID);
  }
  const KEY = '0123456789ABCDEF0123456789ABCDEF';
  await type(page, '[id$="-apiKey"]', KEY);

  const verify = async ({ isEnterHeld = false } = {}) => {
    if (isEnterHeld) await holdEnter(page, '[id$="-apiKey"]');
    else await page.evaluate(verifyAccount);
    // Buttons are disabled while Steam is being asked, however long it takes.
    await sleep(300);
    await waitFor(
      page,
      `![...document.querySelectorAll('main button')].some((el) => el.offsetParent !== null && el.disabled)`,
    );
    await sleep(500);
    return page.evaluate(visibleText('main [role="alert"]'));
  };
  // Each answer of Steam has its own error; the words are checked in the
  // first language, and everywhere that the three are different and present.
  const alerts = [];
  const refuse = async (mode, words, capture, problem, how) => {
    steam.state.mode = mode;
    const alert = await verify(how);
    alerts.push(alert);
    expectThat(
      FLOW,
      isFirst ? words.test(alert) : alert !== '',
      `${problem} (shown: "${alert}"; on screen: "${(await page.evaluate(`document.querySelector('main').innerText`)).replace(/\s+/g, ' ').slice(0, 260)}")`,
    );
    await audit(page, `${capture}-${language}`);
  };
  await refuse(
    'bad-key',
    /key/i,
    'onboarding-key-rejected',
    'a rejected key shows no error about the key',
    // Enter in the key field is the step's "Verify", once however long it is held.
    { isEnterHeld: isFirst },
  );
  if (isFirst) {
    const asked = steam.asked('GetPlayerSummaries', KEY);
    expectThat(
      FLOW,
      asked === 1,
      `Enter held down in the key field asked Steam about the key ${asked} times, not once`,
    );
  }
  await refuse(
    'down',
    /reach|connection/i,
    'onboarding-steam-down',
    'Steam being unreachable shows no error about it',
  );
  await refuse(
    'private',
    /privacy|public/i,
    'onboarding-profile-private',
    'a private profile shows no error about privacy',
  );
  expectThat(
    FLOW,
    new Set(alerts).size === alerts.length,
    'two different answers of Steam show the same error',
  );

  if (isFirst) {
    // Steam accepts the key when it is checked and rejects it as the account
    // is saved: the form stays, with what was typed and the reason.
    steam.state.profilesAsked = 0;
    steam.state.mode = 'second-thoughts';
    const refusal = await verify();
    const kept = JSON.parse(
      await page.evaluate(
        `JSON.stringify({ cards: ${accountCards}, steamId: document.querySelector('[id$="-steamId"]')?.value ?? null, key: document.querySelector('[id$="-apiKey"]')?.value ?? null })`,
      ),
    );
    expectThat(
      FLOW,
      /key/i.test(refusal) &&
        kept.cards === 0 &&
        kept.steamId === STEAM_ID &&
        kept.key === KEY,
      `an account refused as it is saved does not leave the form open with what was typed and the reason (shown: "${refusal}"; found: ${JSON.stringify({ ...kept, key: kept.key === KEY ? 'kept' : 'lost' })})`,
    );
    await audit(page, `onboarding-refused-as-saved-${language}`);
  }

  steam.state.mode = 'ok';
  const alert = await verify();
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
    verified.includes('Audit Hunter'),
    'a good key does not show whose account it is',
  );
  expectThat(
    FLOW,
    (await page.evaluate(accountCards)) === 1 &&
      (await page.evaluate(`document.querySelector('[id$="-steamId"]')`)) ===
        null,
    'a verified account does not join the list with the form put away',
  );
  await audit(page, `onboarding-verified-${language}`);

  if (isFirst) {
    // The only account is removed while "Add another account" is open: the
    // step is back at its beginning, and the account can be verified again.
    await page.evaluate(verifyAccount);
    await sleep(700);
    await page.evaluate(
      `[...document.querySelectorAll('main form ul[aria-label] > li button')].at(-1).click()`,
    );
    await waitFor(page, `(${accountCards}) === 0`);
    await sleep(700);
    const restarted = JSON.parse(
      await page.evaluate(`JSON.stringify((() => {
        const field = document.querySelector('[id$="-steamId"]');
        const forward = [...document.querySelectorAll('main button')].filter((el) => el.offsetParent !== null).at(-1);
        return {
          cards: ${accountCards},
          value: field?.value ?? null,
          locked: field?.readOnly ?? null,
          key: document.querySelector('[id$="-apiKey"]')?.value ?? null,
          inPanel: Boolean(field?.closest('.rounded-lg.border')),
          forward: forward.type,
        };
      })())`),
    );
    expectThat(
      FLOW,
      restarted.cards === 0 &&
        restarted.value === STEAM_ID &&
        restarted.locked &&
        restarted.key === '' &&
        !restarted.inPanel &&
        restarted.forward === 'button',
      `removing the only account with "Add another account" open does not bring back the form of the first account, with the SteamID of the Steam client (found: ${JSON.stringify(restarted)})`,
    );
    await audit(page, `onboarding-last-account-removed-${language}`);
    await type(page, '[id$="-apiKey"]', KEY);
    expectThat(
      FLOW,
      (await verify()) === '' && (await page.evaluate(accountCards)) === 1,
      'the account removed in the step could not be verified again',
    );

    // One more account, without leaving the step that is about accounts.
    await captureHover(
      page,
      `[...document.querySelectorAll('main button')].filter((el) => el.offsetParent !== null && !el.closest('footer')).at(-1)`,
      'hover-onboarding-add-another',
    );
    await page.evaluate(verifyAccount);
    await sleep(700);
    const blank = await page.evaluate(
      `document.querySelector('[id$="-steamId"]').value + '|' + document.querySelector('[id$="-steamId"]').readOnly`,
    );
    expectThat(
      FLOW,
      blank === '|false',
      `adding another account does not start from an empty SteamID (shown: "${blank}")`,
    );
    await audit(page, `onboarding-add-another-${language}`);
    await type(page, '[id$="-steamId"]', SECOND_STEAM_ID);
    await type(page, '[id$="-apiKey"]', 'FEDCBA9876543210FEDCBA9876540000');
    expectThat(
      FLOW,
      (await verify()) === '',
      'the second account could not be verified',
    );
    expectThat(
      FLOW,
      (await page.evaluate(accountCards)) === 2,
      'the account step does not list both accounts',
    );
    await audit(page, `onboarding-two-accounts-${language}`);
  }

  // The account step ends the setup: its forward button enters the app.
  await page.evaluate(advance);
  const isInTheApp = await waitFor(
    page,
    `document.querySelector('nav') !== null && document.querySelector('header h1') !== null`,
  );
  expectThat(FLOW, isInTheApp, 'finishing the setup does not open the app');
  await sleep(1500);
  console.log(
    `${failures.length === failuresBefore ? 'ok  ' : 'FAIL'} flow: onboarding in ${language}, through a rejected key, Steam down and a private profile`,
  );
}

const gameTitle = `document.querySelector('header h1')?.innerText ?? ''`;

/** Every screen of the app, and that what Steam sent is in the app's language. */
async function auditScreens(page, steam, language) {
  await page.evaluate(navButton(0));
  await sleep(900);
  await audit(page, `game-${language}`);

  // The game on screen is the last one played, with Steam's own texts.
  const FLOW = `language (${language})`;
  const names = new Set(steam.names(NIOH, STEAM_LANGUAGE[language]));
  const shown = JSON.parse(
    await page.evaluate(
      `JSON.stringify([...document.querySelectorAll('ul h2')].filter((el) => el.offsetParent !== null).map((el) => el.innerText.trim()))`,
    ),
  );
  const foreign = shown.filter((name) => !names.has(name));
  expectThat(
    FLOW,
    shown.length > 0 && foreign.length === 0,
    `achievement names are not the ones Steam has in this language (${shown.length} shown; e.g. "${foreign[0] ?? ''}")`,
  );
  const list = await page.evaluate(
    `[...document.querySelectorAll('ul')].find((el) => el.offsetParent !== null)?.innerText ?? ''`,
  );
  expectThat(
    FLOW,
    /\d\s?\/\s?\d/.test(list),
    'no achievement shows a counter, though Steam reports them',
  );
  const hasArt = await waitFor(
    page,
    `[...document.querySelectorAll('header img')].some((el) => el.naturalWidth > 0)`,
    6000,
  );
  if (!hasArt) {
    // The pictures come from Steam's real servers: not a fault of the app.
    console.log('note the game art did not load (no internet?)');
  }

  // Flows do not depend on the language: once is enough.
  if (language === LANGUAGES[0]) await auditDetailsFlow(page);
  // The details open from the header; they close again for the next screen.
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
  await page.evaluate(navButton(0));
  await sleep(600);
}

const IS_CRASHED = `document.querySelector('main [role="alert"] h1') !== null`;

/**
 * The interface fails to draw: the crash screen must take its place, the
 * error must reach the local log, and "Reload" must bring the app back.
 */
async function auditCrash(page, language, userData) {
  const FLOW = `crash screen (${language})`;
  const failuresBefore = failures.length;
  // Numbers are formatted while drawing; from here on, doing it throws.
  await page.evaluate(
    `Number.prototype.toLocaleString = () => { throw new Error('audit: forced render error'); }`,
  );
  // Showing the other list draws its cards, numbers included.
  await page.evaluate(
    `[...document.querySelectorAll('[role="group"] button')].filter((el) => el.offsetParent !== null).at(1).click()`,
  );
  const crashed = await waitFor(page, `(${IS_CRASHED})`, 5000);
  expectThat(
    FLOW,
    crashed,
    'an error while drawing does not show the crash screen',
  );
  if (crashed) await audit(page, `crash-${language}`);

  await sleep(500);
  const log = join(userData, 'logs', 'errors.log');
  expectThat(
    FLOW,
    existsSync(log) &&
      readFileSync(log, 'utf8').includes('audit: forced render error'),
    'the error did not reach logs/errors.log',
  );

  await page.evaluate(`document.querySelector('main button')?.click()`);
  const isBack = await waitFor(
    page,
    `document.querySelector('nav') !== null && !(${IS_CRASHED}) && (${gameTitle}) !== ''`,
  );
  expectThat(FLOW, isBack, '"Reload" does not bring the app back');
  await sleep(1500);
  console.log(
    `${failures.length === failuresBefore ? 'ok  ' : 'FAIL'} flow: the interface fails to draw in ${language}, and reloads`,
  );
}

const refreshGame = `document.querySelector('header [aria-label="Refresh"]').click()`;
const showList = (name) =>
  `[...document.querySelectorAll('[role="group"] button')].filter((el) => el.offsetParent !== null).find((el) => el.innerText.startsWith(${JSON.stringify(name)}))?.click()`;
const isOnGameTab = `document.querySelector('nav button')?.getAttribute('aria-current') === 'page'`;
const headerText = `document.querySelector('header')?.innerText ?? ''`;

/** Opens a game from the dashboard by its name. */
async function openGame(page, name) {
  await page.evaluate(navButton(1));
  await sleep(1000);
  await page.evaluate(
    `[...document.querySelectorAll('ul button')].find((el) => el.innerText.includes(${JSON.stringify(name)}))?.click()`,
  );
  await sleep(2500);
}

const visible = `(el) => el.offsetParent !== null`;
/** Clicks the visible button with exactly this text, inside `scope`. */
const clickButton = (scope, text) =>
  `[...document.querySelectorAll('${scope} button')].filter(${visible}).find((el) => el.innerText.trim() === ${JSON.stringify(text)})?.click()`;
/** The cards under "Accounts" in Settings: one per account, and the one that adds. */
const ACCOUNT_CARDS = `[...[...document.querySelectorAll('main h2')].find((el) => el.innerText.trim() === 'Accounts').nextElementSibling.children]`;
const activeAccountCard = `${ACCOUNT_CARDS}.findIndex((el) => el.getAttribute('aria-current') === 'true')`;
/** Clicks the card of an account that is not in use, or the one that adds. */
const clickAccountCard = (index) =>
  `${ACCOUNT_CARDS}.at(${index}).querySelector('button').click()`;
const settingsText = `document.querySelector('main > div:last-child > section')?.innerText ?? ''`;

/**
 * Two accounts: switching between them by hand, the app following the one
 * signed in to Steam, a key that Steam starts refusing and its replacement,
 * adding an account from the app, and removing one.
 */
async function auditAccounts(page, steam, home) {
  const FLOW = 'accounts';
  const failuresBefore = failures.length;
  const openSettings = async () => {
    await page.evaluate(navButton(-1));
    await sleep(800);
  };

  // The setup added two; the app follows the one signed in to Steam.
  await openSettings();
  expectThat(
    FLOW,
    (await page.evaluate(`${ACCOUNT_CARDS}.length`)) === 3 &&
      (await page.evaluate(activeAccountCard)) === 0,
    'Settings does not show two accounts with the first one in use',
  );
  await audit(page, 'flow-accounts-settings');
  await captureHover(
    page,
    `${ACCOUNT_CARDS}[1].querySelector('button')`,
    'hover-account-card',
  );
  await captureHover(
    page,
    `${ACCOUNT_CARDS}.at(-1).querySelector('button')`,
    'hover-add-account',
  );

  // By hand: one click on the other card.
  await page.evaluate(clickAccountCard(1));
  const switched = await waitFor(page, `(${activeAccountCard}) === 1`);
  expectThat(FLOW, switched, 'clicking another account does not switch to it');
  expectThat(
    FLOW,
    (await page.evaluate(settingsText)).includes('Second Hunter'),
    'the details under the grid are not those of the account now in use',
  );
  await page.evaluate(navButton(0));
  const itsGame = await waitFor(
    page,
    `(${gameTitle}) === 'Onimusha: Way of the Sword' && (${headerText}).includes('42 left')`,
  );
  expectThat(
    FLOW,
    itsGame,
    `the Game tab does not show the other account's game and progress (header: "${(await page.evaluate(headerText)).replace(/\s+/g, ' ').slice(0, 80)}")`,
  );
  // The tab is still fading in, which reads as text with too little contrast.
  await sleep(900);
  await audit(page, 'flow-account-switched');

  // Steam signs in to the other account and back: the app follows the change.
  writeFakeSteamFolder(home, SECOND_STEAM_ID);
  await sleep(3500);
  writeFakeSteamFolder(home, STEAM_ID);
  const followed = await waitFor(page, `(${gameTitle}) === 'Nioh 3'`);
  expectThat(
    FLOW,
    followed,
    'the app does not follow the account that signed in to Steam',
  );
  const toast = await page.evaluate(
    `[...document.querySelectorAll('[data-sonner-toast]')].map((el) => el.innerText).join(' | ')`,
  );
  expectThat(
    FLOW,
    toast.includes('Now following Audit Hunter'),
    `the switch made by the app is not announced (toasts: "${toast}")`,
  );

  // Steam starts refusing the key in use with Settings open on its account:
  // the field that replaces it opens by itself, and closed by hand it stays so.
  const KEY_FIELD = `document.querySelector('main input[type="password"]')`;
  await openSettings();
  expectThat(
    FLOW,
    await page.evaluate(`${KEY_FIELD} === null`),
    'the field that replaces a key is open on an account whose key works',
  );
  steam.state.mode = 'bad-key';
  await page.evaluate(refreshGame);
  const refusedInSettings = await waitFor(
    page,
    `${ACCOUNT_CARDS}[0].innerText.includes('Key refused by Steam')`,
  );
  expectThat(
    FLOW,
    refusedInSettings && (await waitFor(page, `${KEY_FIELD} !== null`, 3000)),
    'the field that replaces a key does not open when the key is refused with Settings open',
  );
  await page.evaluate(clickButton('main', 'Replace key'));
  await sleep(1200);
  expectThat(
    FLOW,
    await page.evaluate(`${KEY_FIELD} === null`),
    'the field of a refused key, closed by hand, does not stay closed',
  );

  // On the other tabs the game stays, with a notice.
  await page.evaluate(navButton(0));
  const noticed = await waitFor(
    page,
    `(${visibleText('[role="alert"]')}).includes('Steam refused the key of Audit Hunter')`,
  );
  expectThat(FLOW, noticed, 'a refused key shows no notice over the app');
  expectThat(
    FLOW,
    (await page.evaluate(gameTitle)) === 'Nioh 3',
    'the game left the screen when its key was refused',
  );
  await sleep(900);
  await audit(page, 'flow-key-refused');

  // The notice leads to where the key is replaced, with the field open.
  await page.evaluate(clickButton('[role="alert"]', 'Replace key'));
  const fieldOpen = await waitFor(
    page,
    `document.querySelector('main input[type="password"]') !== null`,
  );
  expectThat(FLOW, fieldOpen, 'the notice does not lead to the key field');
  expectThat(
    FLOW,
    (await page.evaluate(`${ACCOUNT_CARDS}[0].innerText`)).includes(
      'Key refused by Steam',
    ),
    'the card of the account whose key was refused does not say so',
  );
  await sleep(400);
  await audit(page, 'flow-key-refused-settings');

  await type(page, 'main input[type="password"]', 'not-a-key');
  await page.evaluate(clickButton('main', 'Verify and save'));
  await sleep(500);
  expectThat(
    FLOW,
    /32/.test(await page.evaluate(visibleText('main [role="alert"]'))),
    'a key in the wrong format is not refused before Steam is asked',
  );
  // A key Steam refuses, with Enter held down in the field: asked once, and
  // the button is there again for the next try.
  const REFUSED_KEY = 'FFEEDDCCBBAA99887766554433221100';
  await type(page, 'main input[type="password"]', REFUSED_KEY);
  await holdEnter(page, 'main input[type="password"]');
  const refusedAgain = await waitFor(
    page,
    `/rejected/i.test(${visibleText('main [role="alert"]')}) && ![...document.querySelectorAll('main button')].some((el) => el.offsetParent !== null && el.disabled)`,
  );
  await sleep(500);
  const askedToReplace = steam.asked('GetPlayerSummaries', REFUSED_KEY);
  expectThat(
    FLOW,
    refusedAgain && askedToReplace === 1,
    `Enter held down in the new key's field asked Steam about it ${askedToReplace} times, not once, or left the button disabled`,
  );
  steam.state.mode = 'ok';
  await type(
    page,
    'main input[type="password"]',
    '00112233445566778899AABBCCDDEEFF',
  );
  await page.evaluate(clickButton('main', 'Verify and save'));
  const repaired = await waitFor(
    page,
    `(${settingsText}).includes('Key working') && (${settingsText}).includes('EEFF') && document.querySelector('main input[type="password"]') === null`,
  );
  expectThat(
    FLOW,
    repaired,
    'a new key that Steam accepts does not repair the account',
  );
  expectThat(
    FLOW,
    !(await page.evaluate(`document.body.innerText`)).includes(
      '00112233445566778899AABBCCDDEEFF',
    ),
    'the saved key is on screen in full',
  );

  // Adding an account from the app: the account step alone, and a way out.
  await page.evaluate(clickAccountCard(-1));
  const adding = await waitFor(
    page,
    `document.querySelector('[id$="-steamId"]') !== null`,
  );
  expectThat(FLOW, adding, 'the tile to add an account opens nothing');
  expectThat(
    FLOW,
    (await page.evaluate(
      `[...document.querySelectorAll('main form > div > ol > li')].filter((el) => el.offsetParent !== null).length`,
    )) === 0,
    'adding an account from the app shows steps, when there is only one thing to do',
  );
  await sleep(600);
  await audit(page, 'flow-add-account');
  await page.evaluate(clickButton('main', 'Cancel'));
  expectThat(
    FLOW,
    await waitFor(page, `document.querySelector('nav') !== null`),
    'cancelling does not bring the app back',
  );

  // A game is started on the account signed in to Steam while the other one,
  // picked by hand, is in use: the app has to go to the account that plays.
  await openSettings();
  await page.evaluate(clickAccountCard(1));
  await waitFor(page, `(${activeAccountCard}) === 1`);
  steam.play(NIOH);
  const wentToThePlayer = await waitFor(
    page,
    `(${gameTitle}) === 'Nioh 3' && /running/i.test(${headerText})`,
  );
  expectThat(
    FLOW,
    wentToThePlayer,
    `a game started on the other account is not shown with that account (on screen: "${await page.evaluate(gameTitle)}")`,
  );
  await sleep(900);
  await audit(page, 'flow-game-on-the-other-account');
  await openSettings();
  expectThat(
    FLOW,
    (await page.evaluate(activeAccountCard)) === 0,
    'the account playing the game is not the one in use',
  );
  expectThat(
    FLOW,
    (await page.evaluate(
      `${ACCOUNT_CARDS}[1].querySelector('button') === null`,
    )) && /stays on the account/.test(await page.evaluate(settingsText)),
    'another account can still be switched to while the game runs, or nothing says why not',
  );
  await audit(page, 'flow-accounts-locked-while-playing');
  steam.quit();
  expectThat(
    FLOW,
    await waitFor(page, `${ACCOUNT_CARDS}[1].querySelector('button') !== null`),
    'the other account stays locked after the game closed',
  );
  expectThat(
    FLOW,
    (await page.evaluate(activeAccountCard)) === 0,
    'closing the game took the app back to the account picked before',
  );

  // Removing: the question names the account, and can be backed out of.
  await openSettings();
  await page.evaluate(clickAccountCard(1));
  await waitFor(page, `(${activeAccountCard}) === 1`);
  const dialogText = `document.querySelector('[role="dialog"]')?.innerText ?? ''`;
  await page.evaluate(clickButton('main', 'Remove account'));
  await sleep(600);
  expectThat(
    FLOW,
    (await page.evaluate(dialogText)).includes('Remove Second Hunter?'),
    'the question before removing does not name the account',
  );
  await audit(page, 'flow-remove-account');
  await page.evaluate(clickButton('[role="dialog"]', 'Cancel'));
  await sleep(600);
  expectThat(
    FLOW,
    (await page.evaluate(dialogText)) === '' &&
      (await page.evaluate(`${ACCOUNT_CARDS}.length`)) === 3,
    'backing out of the question removed the account or left it open',
  );
  await page.evaluate(clickButton('main', 'Remove account'));
  await sleep(600);
  await page.evaluate(clickButton('[role="dialog"]', 'Remove'));
  const removed = await waitFor(
    page,
    `${ACCOUNT_CARDS}.length === 2 && (${activeAccountCard}) === 0`,
  );
  expectThat(
    FLOW,
    removed,
    'removing the account in use does not move on to the other one',
  );
  await page.evaluate(navButton(0));
  expectThat(
    FLOW,
    await waitFor(page, `(${gameTitle}) === 'Nioh 3'`),
    'after the removal the Game tab is not on the remaining account',
  );
  console.log(
    `${failures.length === failuresBefore ? 'ok  ' : 'FAIL'} flow: two accounts switched by hand and by Steam, a refused key replaced, one added, a game started on the other one, and one removed`,
  );
}

/**
 * A game is started, an achievement is unlocked while it runs, the last one
 * follows, and the game is closed. Nobody touches the app until the last
 * unlock: it has to notice by itself.
 */
async function auditPlaying(page, steam) {
  const FLOW = 'playing';
  const failuresBefore = failures.length;
  const game = steam.games.find((g) => g.appid === ONIMUSHA);
  const total = steam.names(ONIMUSHA, 'english').length;
  // From another tab, with another game as the last one seen.
  await page.evaluate(navButton(1));
  await sleep(800);

  steam.play(ONIMUSHA);
  const switched = await waitFor(
    page,
    `(${isOnGameTab}) && (${gameTitle}) === ${JSON.stringify(game.name)}`,
  );
  expectThat(
    FLOW,
    switched,
    `the app does not switch to the game that started (on screen: "${await page.evaluate(gameTitle)}")`,
  );
  await sleep(1500);
  expectThat(
    FLOW,
    /running/i.test(await page.evaluate(headerText)),
    'the header does not say the game is running',
  );
  await page.evaluate(showList('Pending'));
  await sleep(600);
  await audit(page, 'flow-game-running');
  const leftBefore = total - game.unlocked;

  const unlocked = steam.unlockNext(ONIMUSHA);
  const noticed = await waitFor(
    page,
    `(${visibleText('section [role="status"]')}).includes(${JSON.stringify(unlocked)})`,
  );
  expectThat(
    FLOW,
    noticed,
    `the app does not notice "${unlocked}" by itself (notice: "${await page.evaluate(visibleText('section [role="status"]'))}")`,
  );
  expectThat(
    FLOW,
    (await page.evaluate(headerText)).includes(`${leftBefore - 1} left`),
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

  // The last one, asked for with the refresh button.
  steam.unlockNext(ONIMUSHA);
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

  // On the dashboard before the game closes: closing reads the dashboard
  // again, and the date has to be on the row without that.
  await page.evaluate(navButton(1));
  await sleep(800);
  await page.evaluate(showList('Complete'));
  await sleep(700);
  const finishedRow = await page.evaluate(
    `[...document.querySelectorAll('ul button')].filter((el) => el.offsetParent !== null).find((el) => el.innerText.includes(${JSON.stringify(game.name)}))?.querySelector('small')?.innerText ?? ''`,
  );
  expectThat(
    FLOW,
    finishedRow.includes(' · '),
    `the game that was just finished has no completion date on the dashboard (its row says: "${finishedRow}")`,
  );
  await audit(page, 'flow-game-finished-dashboard');
  await page.evaluate(showList('In progress'));
  await page.evaluate(navButton(0));
  await sleep(800);

  steam.quit();
  const closed = await waitFor(page, `!/running/i.test(${headerText})`);
  expectThat(
    FLOW,
    closed,
    'the header still says running after the game closed',
  );
  expectThat(
    FLOW,
    (await page.evaluate(gameTitle)) === game.name,
    'the game that was just closed left the screen',
  );
  await audit(page, 'flow-game-closed');
  console.log(
    `${failures.length === failuresBefore ? 'ok  ' : 'FAIL'} flow: a game starts, "${unlocked}" is unlocked while playing, then the last one, and the game closes`,
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

/**
 * The app is opened with Steam unreachable and nothing kept from before: it
 * has nothing to show, and must say why and recover when Steam is back.
 */
async function auditFirstStartOffline(page, steam) {
  const FLOW = 'Steam down, nothing cached';
  const failuresBefore = failures.length;
  await sleep(7000);
  const mainText = `[...document.querySelectorAll('main section, main > div')].filter((el) => el.offsetParent !== null).map((el) => el.innerText).join(' ')`;
  const game = (await page.evaluate(mainText)).replace(/\s+/g, ' ');
  expectThat(
    FLOW,
    /reach|connection/i.test(game),
    `the Game tab does not say Steam cannot be reached (shown: "${game.slice(0, 120)}")`,
  );
  expectThat(
    FLOW,
    !/nothing has been played/i.test(game),
    'the Game tab says nothing was played, when it only could not ask',
  );
  await audit(page, 'flow-first-start-offline-game');

  await page.evaluate(navButton(1));
  await sleep(1500);
  const dashboard = (await page.evaluate(mainText)).replace(/\s+/g, ' ');
  expectThat(
    FLOW,
    /reach|connection/i.test(dashboard),
    `the dashboard does not say Steam cannot be reached (shown: "${dashboard.slice(0, 120)}")`,
  );
  await audit(page, 'flow-first-start-offline-dashboard');

  // Steam is back: the app must recover without being restarted.
  steam.state.mode = 'ok';
  await page.evaluate(navButton(0));
  await sleep(600);
  await page.evaluate(
    `[...document.querySelectorAll('main button')].filter((el) => el.offsetParent !== null).at(-1)?.click()`,
  );
  const recovered = await waitFor(page, `(${gameTitle}) !== ''`);
  expectThat(
    FLOW,
    recovered,
    'with Steam back, "Try again" does not bring a game to the screen',
  );
  await sleep(1500);
  await audit(page, 'flow-first-start-recovered');
  console.log(
    `${failures.length === failuresBefore ? 'ok  ' : 'FAIL'} flow: the app opened with Steam unreachable and nothing cached, then Steam came back`,
  );
}

if (!existsSync('out/main/index.js')) {
  console.error('No build found. Run `pnpm build` first.');
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// `AUDIT_LANGUAGES=en pnpm audit:ui` runs one language while working on it.
const languages = process.env.AUDIT_LANGUAGES?.split(',') ?? LANGUAGES;

for (const language of languages) {
  console.log(`\n== ${language} ==`);
  // Each language starts from nothing: its own Steam, client folder and data.
  const steam = await startFakeSteam();
  const home = mkdtempSync(join(tmpdir(), 'tt-audit-home-'));
  const userData = mkdtempSync(join(tmpdir(), 'tt-audit-'));
  writeFakeSteamFolder(home, STEAM_ID);
  const withApp = async (run) => {
    const page = await launch(userData, steam.url, home);
    try {
      await run(page);
    } finally {
      await page.close();
    }
  };

  try {
    await withApp(async (page) => {
      await sleep(6000);
      await auditOnboarding(page, steam, language);
      await auditScreens(page, steam, language);
      await auditCrash(page, language, userData);
      if (language !== LANGUAGES[0]) return;
      await auditAccounts(page, steam, home);
      await auditPlaying(page, steam);
      await auditOutage(page, steam);
    });
    if (language !== LANGUAGES[0]) continue;

    // Same data folder, Steam still off the air.
    await withApp((page) => auditColdStartOffline(page));
    // And once more with nothing kept from before.
    rmSync(join(userData, 'cache.json'), { force: true });
    await withApp((page) => auditFirstStartOffline(page, steam));
  } finally {
    await steam.stop();
    rmSync(userData, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
}

console.log(
  failures.length === 0
    ? `\nNo problems found. Captures are in ${OUT}/.`
    : `\n${failures.length} problem(s). Captures are in ${OUT}/.`,
);
process.exit(failures.length === 0 ? 0 : 1);
