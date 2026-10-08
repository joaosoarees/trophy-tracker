import type { CheckResult, Profile, SteamIdCheck } from '../shared/types'
import { SteamClient, SteamError, type Fetch } from './steam/client'

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const message = (e: unknown): string =>
  e instanceof SteamError ? e.message : 'Erro inesperado ao falar com a Steam.'

/**
 * Passo 2: confere o SteamID pelo perfil público, sem precisar de chave.
 * A página da comunidade é instável; se ela não responder direito o usuário
 * segue adiante, porque o passo da chave valida o SteamID de novo pela API.
 */
export async function checkSteamId(steamId: string, fetchImpl: Fetch = fetch): Promise<SteamIdCheck> {
  const id = steamId.trim()
  if (!/^7656119\d{10}$/.test(id)) {
    return { status: 'invalid', error: 'O SteamID tem 17 dígitos e começa com 7656119.' }
  }
  const unconfirmed = (reason: string): SteamIdCheck => ({ status: 'unconfirmed', steamId: id, reason })

  let res: Response
  let xml: string
  try {
    res = await fetchImpl(`https://steamcommunity.com/profiles/${id}/?xml=1`)
    xml = await res.text()
  } catch {
    return unconfirmed('não foi possível falar com a Steam')
  }
  const tag = (name: string): string | null =>
    new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, 's').exec(xml)?.[1] ?? null

  const name = tag('steamID')
  if (name !== null) return { status: 'found', profile: { steamId: id, name, avatar: tag('avatarFull') ?? '' } }

  const steamError = tag('error')
  if (res.ok && steamError !== null && /could not be found/i.test(steamError)) {
    return { status: 'not-found', error: 'A Steam não encontrou nenhum perfil com esse SteamID.' }
  }
  if (!res.ok) return unconfirmed(`a Steam respondeu com erro ${res.status}`)
  return unconfirmed(steamError ? `a Steam respondeu: ${steamError}` : 'a Steam devolveu uma resposta inesperada')
}

/** Passo 3: a chave é válida se a Steam aceitar uma chamada autenticada. */
export async function checkApiKey(
  client: SteamClient,
  steamId: string,
  apiKey: string
): Promise<CheckResult<Profile>> {
  const key = apiKey.trim()
  if (!/^[0-9A-Fa-f]{32}$/.test(key)) {
    return fail('A chave da Web API tem 32 caracteres (letras de A a F e números).')
  }
  try {
    const p = await client.getPlayerSummary({ steamId, apiKey: key })
    return { ok: true, value: { steamId: p.steamid, name: p.personaname, avatar: p.avatarfull } }
  } catch (e) {
    return fail(message(e))
  }
}

/** Passo 4: biblioteca e conquistas precisam estar visíveis para a Web API. */
export async function checkPrivacy(
  client: SteamClient,
  steamId: string,
  apiKey: string
): Promise<CheckResult<{ gamesWithPlaytime: number }>> {
  const creds = { steamId, apiKey: apiKey.trim() }
  const privateMsg =
    'A Steam não deixou ler seus jogos. Deixe "Detalhes dos jogos" como Público nas configurações de privacidade.'
  try {
    const games = await client.getOwnedGames(creds)
    if (games === null) return fail(privateMsg)
    const played = games
      .filter((g) => g.playtime_forever > 0)
      .sort((a, b) => (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0))

    // Um jogo sem conquistas não prova nada; tenta os mais recentes até um responder.
    for (const game of played.slice(0, 5)) {
      try {
        await client.getPlayerAchievements(creds, game.appid)
        break
      } catch (e) {
        if (e instanceof SteamError && e.kind === 'no-stats') continue
        if (e instanceof SteamError && e.kind === 'private') return fail(privateMsg)
        throw e
      }
    }
    return { ok: true, value: { gamesWithPlaytime: played.length } }
  } catch (e) {
    return fail(message(e))
  }
}
