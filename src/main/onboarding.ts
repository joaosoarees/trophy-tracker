import type { Messages } from '../shared/i18n'
import type { CheckResult, Profile, SteamIdCheck } from '../shared/types'
import { API_KEY_PATTERN, STEAM_ID_PATTERN } from '../shared/validation'
import { SteamClient, SteamError, steamErrorMessage, type Fetch } from './steam/client'

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const message = (m: Messages, e: unknown): string =>
  e instanceof SteamError ? steamErrorMessage(m, e) : m.errors.unexpected


/**
 * Passo da conta: confere o SteamID pelo perfil público, sem precisar de chave.
 * A página da comunidade é instável; se ela não responder direito o usuário
 * segue adiante, porque o passo da chave valida o SteamID de novo pela API.
 */
export async function checkSteamId(m: Messages, steamId: string, fetchImpl: Fetch = fetch): Promise<SteamIdCheck> {
  const id = steamId.trim()
  if (!STEAM_ID_PATTERN.test(id)) return { status: 'invalid', error: m.validation.steamIdFormat }
  const unconfirmed = (reason: string): SteamIdCheck => ({ status: 'unconfirmed', steamId: id, reason })

  let res: Response
  let xml: string
  try {
    res = await fetchImpl(`https://steamcommunity.com/profiles/${id}/?xml=1`)
    xml = await res.text()
  } catch {
    return unconfirmed(m.check.reasonNetwork)
  }
  const tag = (name: string): string | null =>
    new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, 's').exec(xml)?.[1] ?? null

  const name = tag('steamID')
  if (name !== null) return { status: 'found', profile: { steamId: id, name, avatar: tag('avatarFull') ?? '' } }

  const steamError = tag('error')
  if (res.ok && steamError !== null && /could not be found/i.test(steamError)) {
    return { status: 'not-found', error: m.check.profileNotFound }
  }
  if (!res.ok) return unconfirmed(m.check.reasonStatus(res.status))
  return unconfirmed(steamError ? m.check.reasonSteamSaid(steamError) : m.check.reasonUnexpected)
}

/** Passo da chave: ela é válida se a Steam aceitar uma chamada autenticada. */
export async function checkApiKey(
  m: Messages,
  client: SteamClient,
  steamId: string,
  apiKey: string
): Promise<CheckResult<Profile>> {
  const key = apiKey.trim()
  if (!API_KEY_PATTERN.test(key)) return fail(m.validation.apiKeyFormat)
  try {
    const p = await client.getPlayerSummary({ steamId, apiKey: key })
    return { ok: true, value: { steamId: p.steamid, name: p.personaname, avatar: p.avatarfull } }
  } catch (e) {
    return fail(message(m, e))
  }
}

/** Passo da privacidade: biblioteca e conquistas precisam estar visíveis para a Web API. */
export async function checkPrivacy(
  m: Messages,
  client: SteamClient,
  steamId: string,
  apiKey: string
): Promise<CheckResult<{ gamesWithPlaytime: number }>> {
  const creds = { steamId, apiKey: apiKey.trim() }
  try {
    const games = await client.getOwnedGames(creds)
    if (games === null) return fail(m.check.privacyBlocked)
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
        if (e instanceof SteamError && e.kind === 'private') return fail(m.check.privacyBlocked)
        throw e
      }
    }
    return { ok: true, value: { gamesWithPlaytime: played.length } }
  } catch (e) {
    return fail(message(m, e))
  }
}
