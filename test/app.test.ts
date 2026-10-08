import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import nioh from './fixtures/game-achievements-3681010.json'
import { checkApiKey, checkPrivacy, checkSteamId } from '../src/main/onboarding'
import { SteamClient } from '../src/main/steam/client'
import { Store } from '../src/main/store'
import { Tracker } from '../src/main/tracker'
import { clientWith, fakeFetch, FORBIDDEN_HTML, KEY, NO_STATS, NOT_PUBLIC, STEAM_ID, type Route } from './helpers'

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'stt-'))
const profile = { steamId: STEAM_ID, name: 'joao', avatar: '' }

const game = (appid: number, name: string, playtime: number, last = 0) => ({
  appid,
  name,
  playtime_forever: playtime,
  img_icon_url: 'abc',
  rtime_last_played: last
})
const owned = (...games: ReturnType<typeof game>[]): Route => ({ json: { response: { game_count: games.length, games } } })
const player = (unlocked: number, total: number): Route => ({
  json: {
    playerstats: {
      success: true,
      achievements: Array.from({ length: total }, (_, i) => ({ apiname: `A${i}`, achieved: i < unlocked ? 1 : 0, unlocktime: 0 }))
    }
  }
})

describe('onboarding: SteamID', () => {
  it('recusa formato errado sem ir à rede', async () => {
    const f = fakeFetch({})
    expect((await checkSteamId('12345', f)).status).toBe('invalid')
    expect(f.calls).toHaveLength(0)
  })

  it('confirma o perfil com nome e avatar', async () => {
    const f = fakeFetch({
      [`profiles/${STEAM_ID}`]: {
        text: '<profile><steamID64>76561198207154409</steamID64><steamID><![CDATA[João]]></steamID><avatarFull><![CDATA[https://a/b.jpg]]></avatarFull></profile>'
      }
    })
    expect(await checkSteamId(` ${STEAM_ID} `, f)).toEqual({
      status: 'found',
      profile: { steamId: STEAM_ID, name: 'João', avatar: 'https://a/b.jpg' }
    })
  })

  it('bloqueia só quando a Steam diz que o perfil não existe', async () => {
    const f = fakeFetch({ profiles: { text: '<response><error><![CDATA[The specified profile could not be found.]]></error></response>' } })
    expect((await checkSteamId(STEAM_ID, f)).status).toBe('not-found')
  })

  it.each([
    ['limite de requisições', { status: 429, text: '<html>Too Many Requests</html>' }, 'a Steam respondeu com erro 429'],
    ['página que não é o perfil', { text: '<html><body>Steam Community :: Error</body></html>' }, 'a Steam devolveu uma resposta inesperada'],
    ['outro erro da Steam', { text: '<response><error><![CDATA[Please try again later.]]></error></response>' }, 'a Steam respondeu: Please try again later.']
  ])('deixa seguir quando não consegue confirmar: %s', async (_caso, route, reason) => {
    expect(await checkSteamId(STEAM_ID, fakeFetch({ profiles: route }))).toEqual({ status: 'unconfirmed', steamId: STEAM_ID, reason })
  })

  it('deixa seguir quando a rede falha', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    expect(await checkSteamId(STEAM_ID, offline)).toMatchObject({ status: 'unconfirmed', reason: 'não foi possível falar com a Steam' })
  })
})

describe('onboarding: chave', () => {
  it('recusa formato errado', async () => {
    expect((await checkApiKey(clientWith({}), STEAM_ID, 'curta')).ok).toBe(false)
  })

  it('recusa chave que a Steam não aceita', async () => {
    const r = await checkApiKey(clientWith({ GetPlayerSummaries: FORBIDDEN_HTML }), STEAM_ID, KEY)
    expect(r).toEqual({ ok: false, error: 'A Steam recusou a chave da Web API.' })
  })

  it('aceita chave válida', async () => {
    const client = clientWith({
      GetPlayerSummaries: { json: { response: { players: [{ steamid: STEAM_ID, personaname: 'joao', avatarfull: 'x' }] } } }
    })
    expect((await checkApiKey(client, STEAM_ID, KEY)).ok).toBe(true)
  })
})

describe('onboarding: privacidade', () => {
  it('recusa quando a biblioteca não está visível', async () => {
    expect((await checkPrivacy(clientWith({ GetOwnedGames: { json: { response: {} } } }), STEAM_ID, KEY)).ok).toBe(false)
  })

  it('recusa quando as conquistas não estão visíveis', async () => {
    const client = clientWith({ GetOwnedGames: owned(game(1, 'A', 10)), GetPlayerAchievements: NOT_PUBLIC })
    expect((await checkPrivacy(client, STEAM_ID, KEY)).ok).toBe(false)
  })

  it('pula jogos sem conquistas e conta os jogados', async () => {
    const client = clientWith({
      GetOwnedGames: owned(game(1, 'Sem conquistas', 10, 200), game(2, 'Com', 10, 100), game(3, 'Nunca aberto', 0)),
      'appid=1': NO_STATS,
      'appid=2': player(1, 2)
    })
    expect(await checkPrivacy(client, STEAM_ID, KEY)).toEqual({ ok: true, value: { gamesWithPlaytime: 2 } })
  })
})

describe('Store', () => {
  it('guarda a chave num arquivo só do usuário e a relê', () => {
    const dir = tempDir()
    new Store(dir).setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile)
    expect(statSync(join(dir, 'config.json')).mode & 0o777).toBe(0o600)
    const again = new Store(dir)
    expect(again.getCredentials()).toEqual({ steamId: STEAM_ID, apiKey: KEY })
    expect(again.getProfile()).toEqual(profile)
  })

  it('cifra a chave quando há cifra disponível', () => {
    const dir = tempDir()
    const cipher = { encrypt: (s: string) => `enc:${s}`, decrypt: (s: string) => s.slice(4) }
    new Store(dir, cipher).setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile)
    expect(new Store(dir).getCredentials()).toBeNull()
    expect(new Store(dir, cipher).getCredentials()?.apiKey).toBe(KEY)
  })

  it('persiste notas e fixadas, e remove entradas vazias', () => {
    const dir = tempDir()
    const store = new Store(dir)
    store.setUserData(10, 'A', { note: 'chefe do 3º mapa', pinned: true })
    store.setUserData(10, 'B', { note: '', pinned: true })
    store.setUserData(10, 'B', { note: ' ', pinned: false })
    expect(new Store(dir).getUserData(10)).toEqual({ A: { note: 'chefe do 3º mapa', pinned: true } })
  })

  it('mantém a entrada enquanto houver checklist e lembra do sempre no topo', () => {
    const dir = tempDir()
    const store = new Store(dir)
    const checklist = [{ id: '1', text: 'Kodama da ponte', done: true }]
    store.setUserData(10, 'A', { note: '', pinned: false, checklist })
    store.setAlwaysOnTop(true)
    const again = new Store(dir)
    expect(again.getUserData(10)).toEqual({ A: { note: '', pinned: false, checklist } })
    expect(again.getAlwaysOnTop()).toBe(true)
    again.setUserData(10, 'A', { note: '', pinned: false, checklist: [] })
    expect(new Store(dir).getUserData(10)).toEqual({})
  })
})

describe('Tracker', () => {
  const setup = (routes: Parameters<typeof fakeFetch>[0], statMap = new Map<string, string>()) => {
    const store = new Store(tempDir())
    store.setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile)
    const fetchImpl = fakeFetch(routes)
    let now = 1_000_000
    const tracker = new Tracker({
      store,
      client: new SteamClient(fetchImpl),
      readStatMap: async () => statMap,
      now: () => now
    })
    return { tracker, store, fetchImpl, advance: (ms: number) => (now += ms) }
  }

  it('monta a tela do jogo com contadores vindos dos stats', async () => {
    const { tracker } = setup(
      {
        GetOwnedGames: owned(game(3681010, 'Nioh 3', 500)),
        GetGameAchievements: { json: nioh },
        GetPlayerAchievements: { json: { playerstats: { achievements: [{ apiname: 'ACH_002', achieved: 1, unlocktime: 9 }] } } },
        GetUserStatsForGame: { json: { playerstats: { stats: [{ name: 'ACH_001_PROGRESS', value: 12 }] } } }
      },
      new Map([['ACH_001', 'ACH_001_PROGRESS']])
    )
    const view = await tracker.getGame(3681010)
    expect(view.name).toBe('Nioh 3')
    expect(view.unlockedCount).toBe(1)
    expect(view.achievements.find((a) => a.id === 'ACH_001')?.progress).toEqual({ current: 12, target: 39 })
  })

  it('mantém a lista quando os contadores falham', async () => {
    const { tracker } = setup(
      {
        GetOwnedGames: owned(game(3681010, 'Nioh 3', 500)),
        GetGameAchievements: { json: nioh },
        GetPlayerAchievements: { json: { playerstats: { achievements: [] } } },
        GetUserStatsForGame: { status: 500, text: 'erro' }
      },
      new Map([['ACH_001', 'ACH_001_PROGRESS']])
    )
    const view = await tracker.getGame(3681010)
    expect(view.total).toBe(64)
    expect(view.achievements.find((a) => a.id === 'ACH_001')?.progress).toBeNull()
  })

  it('usa o cache por um minuto e refaz a leitura quando forçado', async () => {
    const { tracker, fetchImpl, advance } = setup({
      GetOwnedGames: owned(game(7, 'Jogo', 5)),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetPlayerAchievements: player(0, 0)
    })
    const count = () => fetchImpl.calls.filter((u) => u.includes('GetPlayerAchievements')).length
    await tracker.getGame(7)
    await tracker.getGame(7)
    expect(count()).toBe(1)
    await tracker.getGame(7, true)
    expect(count()).toBe(2)
    advance(61_000)
    await tracker.getGame(7)
    expect(count()).toBe(3)
  })

  it('na verificação periódica relê só o estado do jogador e devolve o mesmo objeto se nada mudou', async () => {
    let unlocked = 1
    const { tracker, fetchImpl, advance } = setup({
      GetOwnedGames: owned(game(3681010, 'Nioh 3', 500)),
      GetGameAchievements: { json: nioh },
      GetPlayerAchievements: () => ({
        json: { playerstats: { achievements: nioh.response.achievements.slice(0, unlocked).map((a) => ({ apiname: a.internal_name, achieved: 1, unlocktime: 9 })) } }
      })
    })
    const count = (name: string) => fetchImpl.calls.filter((u) => u.includes(name)).length
    const first = await tracker.getGame(3681010)
    advance(60_000)
    const second = await tracker.getGame(3681010, 'poll')
    expect(second).toBe(first)
    expect(count('GetGameAchievements')).toBe(1)
    expect(count('GetPlayerAchievements')).toBe(2)

    unlocked = 2
    advance(60_000)
    const third = await tracker.getGame(3681010, 'poll')
    expect(third).not.toBe(first)
    expect(third.unlockedCount).toBe(2)
    expect(third.achievements[5]).toBe(first.achievements[5])
    expect(count('GetGameAchievements')).toBe(1)

    await tracker.getGame(3681010, true)
    expect(count('GetGameAchievements')).toBe(2)
  })

  it('junta pedidos idênticos simultâneos numa leitura só', async () => {
    const { tracker, fetchImpl } = setup({
      GetOwnedGames: owned(game(1, 'A', 10), game(2, 'B', 10)),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetPlayerAchievements: player(1, 4)
    })
    const count = (name: string) => fetchImpl.calls.filter((u) => u.includes(name)).length
    const [a, b] = await Promise.all([tracker.getGame(1), tracker.getGame(1)])
    expect(a).toBe(b)
    expect(count('GetPlayerAchievements')).toBe(1)
    expect(count('GetOwnedGames')).toBe(1)
    await Promise.all([tracker.getDashboard(), tracker.getDashboard()])
    expect(count('GetPlayerAchievements')).toBe(1 + 1)
  })

  it('escolhe o último jogo jogado quando não há jogo aberto', async () => {
    const { tracker } = setup({ GetOwnedGames: owned(game(1, 'Antigo', 10, 100), game(2, 'Recente', 10, 900), game(3, 'Nunca', 0, 0)) })
    expect(await tracker.lastPlayedAppId()).toBe(2)
  })

  it('ordena o painel pelo mais perto dos 100%, completos por último, só jogos jogados com conquistas', async () => {
    const { tracker } = setup({
      GetOwnedGames: owned(
        game(1, 'Metade', 10),
        game(2, 'Completo', 10),
        game(3, 'Quase', 10),
        game(4, 'Sem conquistas', 10),
        game(5, 'Nunca aberto', 0)
      ),
      'appid=1': player(5, 10),
      'appid=2': player(10, 10),
      'appid=3': player(9, 10),
      'appid=4': NO_STATS
    })
    const progress: number[] = []
    const list = await tracker.getDashboard('cached', (done) => progress.push(done))
    expect(list.map((g) => g.name)).toEqual(['Quase', 'Metade', 'Completo'])
    expect(list[0]).toMatchObject({ unlocked: 9, total: 10 })
    expect(progress.sort()).toEqual([1, 2, 3, 4])
  })

  it('no painel, só relê jogos cujo tempo de jogo mudou', async () => {
    let playtime = 10
    const { tracker, fetchImpl, advance } = setup({
      GetOwnedGames: () => owned(game(1, 'A', playtime), game(2, 'B', 20)),
      GetPlayerAchievements: player(1, 4)
    })
    const count = () => fetchImpl.calls.filter((u) => u.includes('GetPlayerAchievements')).length
    await tracker.getDashboard()
    expect(count()).toBe(2)
    advance(11 * 60_000)
    await tracker.getDashboard()
    expect(count()).toBe(2)
    playtime = 15
    advance(11 * 60_000)
    await tracker.getDashboard()
    expect(count()).toBe(3)
    await tracker.getDashboard('all')
    expect(count()).toBe(5)
  })

  it('anexa as capas da loja e não pergunta de novo pelo que já sabe', async () => {
    const { tracker, fetchImpl } = setup({
      GetOwnedGames: owned(game(1, 'A', 10), game(2, 'B', 10)),
      GetPlayerAchievements: player(1, 4),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetItems: (url) => {
        const ids = JSON.parse(url.searchParams.get('input_json')!).ids.map((i: { appid: number }) => i.appid)
        return {
          json: {
            response: {
              store_items: ids
                .filter((appid: number) => appid === 1)
                .map((appid: number) => ({
                  appid,
                  assets: { asset_url_format: 'steam/apps/1/${FILENAME}?t=9', header: 'abc/header.jpg', small_capsule: 'def/capsule_231x87.jpg' }
                }))
            }
          }
        }
      }
    })
    const list = await tracker.getDashboard()
    expect(list.find((g) => g.appid === 1)?.capsule).toBe(
      'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/def/capsule_231x87.jpg?t=9'
    )
    expect(list.find((g) => g.appid === 2)?.capsule).toBe('')
    expect((await tracker.getGame(1)).header).toContain('/abc/header.jpg')
    await tracker.getDashboard('all')
    expect(fetchImpl.calls.filter((u) => u.includes('GetItems'))).toHaveLength(1)
  })

  it('mostra o jogo mesmo quando a loja falha ao dar a capa', async () => {
    const { tracker } = setup({
      GetOwnedGames: owned(game(1, 'A', 10)),
      GetPlayerAchievements: player(1, 4),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetItems: { status: 500, text: 'erro' }
    })
    expect(await tracker.getDashboard()).toHaveLength(1)
    expect((await tracker.getGame(1)).header).toBe('')
  })

  it('propaga perfil privado em vez de mostrar painel vazio', async () => {
    const { tracker } = setup({ GetOwnedGames: owned(game(1, 'A', 10)), GetPlayerAchievements: NOT_PUBLIC })
    await expect(tracker.getDashboard()).rejects.toMatchObject({ kind: 'private' })
  })
})
