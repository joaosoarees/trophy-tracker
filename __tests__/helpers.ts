import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

export interface IRoute {
  status?: number;
  json?: unknown;
  text?: string;
}

/**
 * Fake `fetch`: the first route whose fragment appears in the URL answers. A
 * request no route answers throws, so a call the test did not provide for is
 * never taken for an answer from Steam. `calls` lists the URL of every request
 * made, and `inits` the options each was made with, in the same order.
 */
export function fakeFetch(
  routes: Record<string, IRoute | ((url: URL) => IRoute)>,
): typeof fetch & { calls: string[]; inits: (RequestInit | undefined)[] } {
  const calls: string[] = [];
  const inits: (RequestInit | undefined)[] = [];
  const impl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url.toString());
    inits.push(init);
    for (const [fragment, route] of Object.entries(routes)) {
      if (!url.toString().includes(fragment)) continue;
      const r = typeof route === 'function' ? route(url) : route;
      return new Response(r.text ?? JSON.stringify(r.json), {
        status: r.status ?? 200,
      });
    }
    throw new Error(`fakeFetch: no route answers ${url.toString()}`);
  };
  return Object.assign(impl, { calls, inits });
}

/**
 * A folder of its own in the temp directory, removed when the test ends. Call
 * it inside a test (or a function a test calls), not at the top of a file.
 */
export function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tt-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

export const KEY = '0123456789ABCDEF0123456789ABCDEF';
/** A made-up account: nobody's real SteamID belongs in the repository. */
export const STEAM_ID = '76561198000000042';
/** A second made-up account, for what happens between two. */
export const OTHER_STEAM_ID = '76561198000000043';
/** A made-up account nobody saved in the app. */
export const UNKNOWN_STEAM_ID = '76561198000000099';
export const OTHER_KEY = 'FEDCBA9876543210FEDCBA9876540000';

export const FORBIDDEN_HTML: IRoute = {
  status: 403,
  text: '<html><head><title>Forbidden</title></head><body><h1>Forbidden</h1>Access is denied. Retrying will not help. Please verify your <pre>key=</pre> parameter.</body></html>',
};
export const NOT_PUBLIC: IRoute = {
  status: 403,
  json: { playerstats: { error: 'Profile is not public', success: false } },
};
export const NO_STATS: IRoute = {
  status: 400,
  json: {
    playerstats: { error: 'Requested app has no stats', success: false },
  },
};
