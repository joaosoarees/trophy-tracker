import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { AppState, Profile } from '../../shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
  /** Motivo de a Steam não ter confirmado o perfil; não impede de seguir. */
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null)
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

  const confirmSteamId = async () => {
    setBusy(true)
    setError(null)
    setUnconfirmed(null)
    const result = await window.api.checkSteamId(steamId)
    setBusy(false)
    if (result.status === 'found') setProfile(result.profile)
    else if (result.status === 'unconfirmed') setUnconfirmed(result.reason)
    else setError(result.error)
  }
  /** Segue sem nome e avatar; o passo da chave valida o SteamID pela API oficial. */
  const skipConfirmation = () => {
    setProfile({ steamId: steamId.trim(), name: '', avatar: '' })
    setUnconfirmed(null)
    go(2)
  }
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
    <div className="mx-auto max-w-lg p-5 [&_h1]:mb-2.5 [&_h1]:text-2xl [&_h1]:font-semibold [&_section_li]:my-2 [&_section_ol]:list-decimal [&_section_ol]:pl-5 [&_section_p]:my-2 [&_section_ul]:list-disc [&_section_ul]:pl-5">
      <ol className="mb-6 flex gap-1.5">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              'flex-1 border-t-[3px] pt-1.5 text-xs',
              i === step ? 'border-primary text-foreground' : i < step ? 'border-success text-muted-foreground' : 'text-muted-foreground'
            )}
          >
            {label}
          </li>
        ))}
      </ol>

      {notice && step === 0 && <p className="text-destructive">{notice} Refaça a configuração.</p>}

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
          <p className="text-muted-foreground">A chave fica guardada só neste computador.</p>
          <div className="mt-6 flex justify-end gap-2">
            {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
            <Button onClick={() => go(1)}>
              Começar
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1>Sua conta</h1>
          {detected ? (
            <p>Encontrei a conta logada no cliente Steam deste computador. Confirme se é a sua.</p>
          ) : (
            <p>Não encontrei uma conta logada no cliente Steam. Cole abaixo o seu SteamID de 17 dígitos.</p>
          )}
          <details open={!detected} className="bg-card my-3 rounded-lg border px-3 py-2">
            <summary className="text-primary cursor-pointer">Onde encontro meu SteamID?</summary>
            <ol>
              <li>No cliente Steam, clique no seu nome no canto superior direito.</li>
              <li>Escolha “Detalhes da conta”.</li>
              <li>
                O número de 17 dígitos em “ID Steam”, logo abaixo do nome da conta, é o seu SteamID. Não é o código de
                amigo nem o nome de usuário.
              </li>
            </ol>
            <Button size="xs" variant="secondary" onClick={() => void window.api.openExternal('account')}>
                <ExternalLink />
                Abrir “Detalhes da conta” no navegador
              </Button>
          </details>
          <label className="text-muted-foreground mt-4 mb-1.5 block">
            SteamID
            <Input
              value={steamId}
              inputMode="numeric"
              className="text-foreground mt-1"
              placeholder="7656119…"
              onChange={(e) => {
                setSteamId(e.target.value)
                setProfile(null)
                setUnconfirmed(null)
              }}
            />
          </label>
          {profile && (
            <div className="bg-card my-3 flex items-center gap-3 rounded-lg border p-3">
              {profile.avatar && <img src={profile.avatar} alt="" className="size-12 rounded-md" />}
              <div>
                <strong className="block">{profile.name}</strong>
                <small className="text-muted-foreground">Perfil encontrado</small>
              </div>
            </div>
          )}
          {error && <p className="text-destructive">{error}</p>}
          {unconfirmed && (
            <p className="text-warning">
              Não consegui confirmar este perfil agora ({unconfirmed}). Você pode tentar de novo ou continuar: o próximo
              passo confere o SteamID junto com a chave.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => go(0)}>Voltar</Button>
            {unconfirmed && <Button variant="secondary" onClick={skipConfirmation}>Continuar mesmo assim</Button>}
            {profile ? (
              <Button onClick={() => go(2)}>
                É a minha conta
              </Button>
            ) : (
              <Button disabled={busy || steamId.trim() === ''} onClick={confirmSteamId}>
                {busy ? 'Verificando…' : unconfirmed ? 'Tentar de novo' : 'Verificar'}
              </Button>
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
              <Button size="xs" variant="secondary" onClick={() => void window.api.openExternal('apikey')}>
                <ExternalLink />
                Abrir no navegador
              </Button>
            </li>
            <li>
              Entre com a sua conta. Em “Nome de domínio”, digite qualquer coisa, por exemplo <code className="bg-muted rounded px-1.5 py-0.5">localhost</code>.
            </li>
            <li>Aceite os termos, clique em Registrar e copie a chave de 32 caracteres.</li>
          </ol>
          <label className="text-muted-foreground mt-4 mb-1.5 block">
            Chave
            <Input
              type="password"
              className="text-foreground mt-1"
              value={apiKey}
              placeholder="Cole a chave aqui"
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          {error && <p className="text-destructive">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => go(1)}>Voltar</Button>
            <Button disabled={busy || apiKey.trim() === ''} onClick={confirmKey}>
              {busy ? 'Verificando…' : 'Verificar chave'}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1>Privacidade do perfil</h1>
          {busy && <p>Testando o acesso às suas conquistas…</p>}
          {!busy && games !== null && <p className="text-success">Tudo certo: a Steam liberou a leitura das suas conquistas.</p>}
          {!busy && error && (
            <>
              <p className="text-destructive">{error}</p>
              <ol>
                <li>
                  Abra as configurações de privacidade.{' '}
                  <Button size="xs" variant="secondary" onClick={() => void window.api.openExternal('privacy')}>
                <ExternalLink />
                Abrir no navegador
              </Button>
                </li>
                <li>
                  Deixe “Meu perfil” e “Detalhes dos jogos” como <strong>Público</strong>.
                </li>
                <li>Volte aqui e teste de novo (a Steam pode levar um minuto para aplicar).</li>
              </ol>
            </>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => go(2)}>Voltar</Button>
            {games !== null && !error ? (
              <Button onClick={() => go(4)}>
                Continuar
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void testPrivacy()}>
                Testar de novo
              </Button>
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
          {error && <p className="text-destructive">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => go(3)}>Voltar</Button>
            <Button disabled={busy} onClick={() => void finish()}>
              {busy ? 'Salvando…' : 'Entrar no app'}
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
