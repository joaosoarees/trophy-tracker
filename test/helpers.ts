import { SteamClient } from '../src/main/steam/client'

export interface Route {
  status?: number
  json?: unknown
  text?: string
}

/** `fetch` falso: a primeira rota cujo trecho aparece na URL responde. */
export function fakeFetch(routes: Record<string, Route | ((url: URL) => Route)>): typeof fetch & { calls: string[] } {
  const calls: string[] = []
  const impl = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(String(input))
    calls.push(url.toString())
    for (const [fragment, route] of Object.entries(routes)) {
      if (!url.toString().includes(fragment)) continue
      const r = typeof route === 'function' ? route(url) : route
      return new Response(r.text ?? JSON.stringify(r.json), { status: r.status ?? 200 })
    }
    return new Response('not found', { status: 404 })
  }
  return Object.assign(impl as typeof fetch, { calls })
}

export const clientWith = (routes: Parameters<typeof fakeFetch>[0]): SteamClient => new SteamClient(fakeFetch(routes))

export const KEY = '0123456789ABCDEF0123456789ABCDEF'
export const STEAM_ID = '76561198207154409'

export const FORBIDDEN_HTML: Route = {
  status: 403,
  text: '<html><head><title>Forbidden</title></head><body><h1>Forbidden</h1>Access is denied. Retrying will not help. Please verify your <pre>key=</pre> parameter.</body></html>'
}
export const NOT_PUBLIC: Route = { status: 403, json: { playerstats: { error: 'Profile is not public', success: false } } }
export const NO_STATS: Route = { status: 400, json: { playerstats: { error: 'Requested app has no stats', success: false } } }
