import { SteamClient } from '../src/main/steam/client';

export interface IRoute {
  status?: number;
  json?: unknown;
  text?: string;
}

/** Fake `fetch`: the first route whose fragment appears in the URL answers. */
export function fakeFetch(
  routes: Record<string, IRoute | ((url: URL) => IRoute)>,
): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const impl = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url.toString());
    for (const [fragment, route] of Object.entries(routes)) {
      if (!url.toString().includes(fragment)) continue;
      const r = typeof route === 'function' ? route(url) : route;
      return new Response(r.text ?? JSON.stringify(r.json), {
        status: r.status ?? 200,
      });
    }
    return new Response('not found', { status: 404 });
  };
  return Object.assign(impl, { calls });
}

export const clientWith = (
  routes: Parameters<typeof fakeFetch>[0],
): SteamClient => new SteamClient(fakeFetch(routes));

export const KEY = '0123456789ABCDEF0123456789ABCDEF';
/** A made-up account: nobody's real SteamID belongs in the repository. */
export const STEAM_ID = '76561198000000042';

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
