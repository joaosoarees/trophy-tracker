import { useEffect, useState } from 'react'
import type { AppState, Profile } from '../../shared/types'

interface Props {
  notice: string | null
  onDone(state: AppState): void
  onCancel?: () => void
}

const STEPS = ['Boas-vindas', 'SteamID', 'Chave', 'Privacidade', 'Pronto']

export function Onboarding({ notice, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0)
  const [steamId, setSteamId] = useState('')
  const [detected, setDetected] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [games, setGames] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.detectSteamId().then((id) => {
      if (!id) return
      setSteamId((prev) => prev || id)
      setDetected(true)
    })
  }, [])

  const go = (n: number): void => {
    setError(null)
    setStep(n)
  }

  /** Só avança quando a verificação real passa. */
  async function check<T>(run: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>, then: (v: T) => void) {
    setBusy(true)
    setError(null)
    const result = await run()
    setBusy(false)
    if (result.ok) then(result.value)
    else setError(result.error)
  }

  const confirmSteamId = () => check(() => window.api.checkSteamId(steamId), setProfile)
  const confirmKey = () => check(() => window.api.checkApiKey(profile!.steamId, apiKey), () => void testPrivacy())
  const testPrivacy = async () => {
    setStep(3)
    setGames(null)
    await check(
      () => window.api.checkPrivacy(profile!.steamId, apiKey),
      (v) => setGames(v.gamesWithPlaytime)
    )
  }
  const finish = async () => {
    setBusy(true)
    const next = await window.api.saveConfig(profile!.steamId, apiKey)
    setBusy(false)
    if (next.configured) onDone(next)
    else setError('Não foi possível salvar a configuração. Volte e confira a chave.')
  }

  return (
    <div className="onboarding">
      <ol className="steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''}>
            {label}
          </li>
        ))}
      </ol>

      {notice && step === 0 && <p className="error">{notice} Refaça a configuração.</p>}

      {step === 0 && (
        <section>
          <h1>Conquistas da Steam</h1>
          <p>
            Este app mostra, para o jogo que você está jogando, quais conquistas faltam, o que são as ocultas, quanto
            falta nas que têm contador e atalhos para guias.
          </p>
          <p>Antes de usar, três coisas rápidas:</p>
          <ul>
            <li>confirmar qual é a sua conta (SteamID);</li>
            <li>gerar uma chave da Web API da Steam, gratuita;</li>
            <li>conferir se os detalhes dos seus jogos estão públicos.</li>
          </ul>
          <p className="muted">A chave fica guardada só neste computador.</p>
          <div className="actions">
            {onCancel && <button onClick={onCancel}>Cancelar</button>}
            <button className="primary" onClick={() => go(1)}>
              Começar
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1>Sua conta</h1>
          {detected ? (
            <p>Encontrei a conta logada no cliente Steam deste computador. Confirme se é a sua.</p>
          ) : (
            <p>
              Não encontrei uma conta logada no cliente Steam. Cole seu SteamID de 17 dígitos.{' '}
              <a onClick={() => void window.api.openExternal('steamid-help')}>Onde encontro meu SteamID?</a>
            </p>
          )}
          <label>
            SteamID
            <input
              value={steamId}
              inputMode="numeric"
              placeholder="7656119…"
              onChange={(e) => {
                setSteamId(e.target.value)
                setProfile(null)
              }}
            />
          </label>
          {profile && (
            <div className="profile">
              {profile.avatar && <img src={profile.avatar} alt="" />}
              <div>
                <strong>{profile.name}</strong>
                <small>Perfil encontrado</small>
              </div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button onClick={() => go(0)}>Voltar</button>
            {profile ? (
              <button className="primary" onClick={() => go(2)}>
                É a minha conta
              </button>
            ) : (
              <button className="primary" disabled={busy || steamId.trim() === ''} onClick={confirmSteamId}>
                {busy ? 'Verificando…' : 'Verificar'}
              </button>
            )}
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1>Chave da Web API</h1>
          <ol>
            <li>
              Abra a página de chaves da Steam.{' '}
              <button onClick={() => void window.api.openExternal('apikey')}>Abrir no navegador</button>
            </li>
            <li>
              Entre com a sua conta. Em “Nome de domínio”, digite qualquer coisa, por exemplo <code>localhost</code>.
            </li>
            <li>Aceite os termos, clique em Registrar e copie a chave de 32 caracteres.</li>
          </ol>
          <label>
            Chave
            <input
              type="password"
              value={apiKey}
              placeholder="Cole a chave aqui"
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button onClick={() => go(1)}>Voltar</button>
            <button className="primary" disabled={busy || apiKey.trim() === ''} onClick={confirmKey}>
              {busy ? 'Verificando…' : 'Verificar chave'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1>Privacidade do perfil</h1>
          {busy && <p>Testando o acesso às suas conquistas…</p>}
          {!busy && games !== null && <p className="success">Tudo certo: a Steam liberou a leitura das suas conquistas.</p>}
          {!busy && error && (
            <>
              <p className="error">{error}</p>
              <ol>
                <li>
                  Abra as configurações de privacidade.{' '}
                  <button onClick={() => void window.api.openExternal('privacy')}>Abrir no navegador</button>
                </li>
                <li>
                  Deixe “Meu perfil” e “Detalhes dos jogos” como <strong>Público</strong>.
                </li>
                <li>Volte aqui e teste de novo (a Steam pode levar um minuto para aplicar).</li>
              </ol>
            </>
          )}
          <div className="actions">
            <button onClick={() => go(2)}>Voltar</button>
            {games !== null && !error ? (
              <button className="primary" onClick={() => go(4)}>
                Continuar
              </button>
            ) : (
              <button className="primary" disabled={busy} onClick={() => void testPrivacy()}>
                Testar de novo
              </button>
            )}
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          <h1>Pronto</h1>
          <p>
            Encontrei <strong>{games}</strong> {games === 1 ? 'jogo já jogado' : 'jogos já jogados'} na sua conta.
          </p>
          <p>
            Abra um jogo na Steam e o app troca para ele sozinho. Sem jogo aberto, ele mostra o último que você jogou; o
            Painel lista todos.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button onClick={() => go(3)}>Voltar</button>
            <button className="primary" disabled={busy} onClick={() => void finish()}>
              {busy ? 'Salvando…' : 'Entrar no app'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
