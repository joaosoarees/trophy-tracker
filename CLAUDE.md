# Conquistas da Steam

App desktop (Electron + React + TypeScript) que mostra, para o jogo aberto na Steam, as conquistas que faltam, as ocultas reveladas, contadores de progresso, checklists do usuário e atalhos para guias. Uso pessoal; pode virar produto. A interface tem dois idiomas, **inglês (padrão) e português do Brasil**; código, comentários, testes e commits são em português.

## Comandos

```bash
npm run dev         # app com recarga (janela via WSLg)
npm run build       # compila para out/
npm start           # roda o compilado
npm test            # Vitest
npm run typecheck   # tsc --noEmit
```

O Electron precisa de `libnss3 libnspr4 libasound2t64` instaladas no WSL.

## Ambiente: WSL falando com o Windows

O projeto roda no WSL, mas o cliente Steam roda no Windows. A ponte é `src/main/steam/windows.ts`, que chama executáveis do Windows por interop:

- `reg.exe`: jogo em execução (`HKCU\Software\Valve\Steam\RunningAppID`), conta logada (`ActiveProcess\ActiveUser`) e pasta da Steam (`SteamPath`).
- `rundll32.exe`: abre links no navegador do Windows.
- `powershell.exe`: notificação do Windows (notificações do Electron no WSLg não aparecem).

Não gera `.exe`; virar app nativo de Windows exige Node no Windows.

## Arquitetura

```
src/shared/     tipos e lógica pura usados pelos dois lados
  types.ts        modelo (Achievement, GameView, GameSummary...) e a interface Api do IPC
  checklist.ts    parseChecklist (texto colado → itens) e shownProgress (qual contador mostrar)
  view.ts         mergeView: junta leituras reaproveitando o que não mudou
  validation.ts   formatos de SteamID e chave, usados no formulário e no processo principal
  i18n/           idiomas: index.ts (cadastro) e locales/ (um arquivo por idioma)
src/main/       processo principal: única parte que fala com a Steam e com o disco
  steam/client.ts       chamadas HTTP à Web API; traduz erros em SteamError
  steam/achievements.ts buildGameView (junta as fontes), newlyUnlocked, guideUrl
  steam/vdf.ts          leitor do KeyValues binário do cache do cliente Steam
  steam/windows.ts      interop com o Windows
  tracker.ts            orquestração: cache, deduplicação, jogo, painel, capas
  store.ts              persistência em JSON (não confundir com o store da interface)
  onboarding.ts         validações de SteamID, chave e privacidade
  index.ts              janela, handlers de IPC, verificações periódicas
src/preload/    expõe `window.api` (contextBridge), tipado por `Api`
src/renderer/src/
  App.tsx, Onboarding.tsx, GameScreen.tsx, Dashboard.tsx
  components/     AchievementCard, Checklist, bits (ProgressBar, Segmented, SearchBox, Empty)
  components/Stepper/, StepHeader, FieldError, ControlledLanguageSelect   peças do formulário em etapas
  components/steps/<Etapa>Step/   uma pasta por etapa do onboarding: index.tsx + schema.ts
  components/ui/  componentes shadcn/ui (gerados; não editar à mão sem motivo)
  store/          estado da interface (Zustand)
  lib/            utils (cn, sessionStorage seguro), i18n (useT, useLocale), text (busca sem acento), saver (gravação com pausa)
test/           Vitest, com respostas reais da API em test/fixtures
```

Regra de fronteira: a interface nunca faz `fetch` para a Steam nem toca em arquivos; tudo passa por `window.api`. Para adicionar uma chamada: método em `Api` (`shared/types.ts`), handler em `main/index.ts`, nome na lista de `preload/index.ts`.

## Fontes de dados

| Dado | Origem | Chave? |
|---|---|---|
| Lista de conquistas, descrição das ocultas, alvo do contador, raridade | `IPlayerService/GetGameAchievements` (no idioma do app) | não |
| Desbloqueada ou não, e quando | `ISteamUserStats/GetPlayerAchievements` | sim |
| Valor atual dos contadores | `ISteamUserStats/GetUserStatsForGame` | sim |
| Qual stat alimenta cada contador | arquivo local `appcache/stats/UserGameStatsSchema_<appid>.bin` | — |
| Biblioteca e tempo de jogo | `IPlayerService/GetOwnedGames` | sim |
| Capas dos jogos | `IStoreBrowseService/GetItems` (em lote) | não |
| Nome e avatar no onboarding | `steamcommunity.com/profiles/<id>/?xml=1` | não |

Coisas que já custaram tempo:

- A página de perfil da comunidade limita requisições (HTTP 429). Por isso o passo do SteamID só bloqueia quando a Steam diz que o perfil não existe; qualquer outra resposta vira "não confirmado" e deixa seguir.
- A Web API não diz qual stat alimenta um contador; só o arquivo local do cliente Steam diz. Sem o arquivo, a conquista aparece sem contador (nunca inventar valor).
- A Steam não informa quais conquistas são de DLC (`groupid` vem sempre 0) nem quais itens faltam num "colete todos"; para isso existe o checklist do usuário.
- Jogos novos não têm capa em caminho fixo (`header.jpg` dá 404); o caminho com hash vem só do serviço da loja.
- Erro de chave vem como HTML com status 403; perfil privado vem como JSON com 403.

## Idiomas

- Um arquivo por idioma em `src/shared/i18n/locales/`. `en.ts` é a referência: o tipo `Messages` sai dele, então uma chave nova começa lá e o compilador acusa o que faltar nos outros. Mensagens são textos ou funções (`left: (n) => ...`) para interpolação e plural; não há biblioteca de tradução.
- Novo idioma: criar o arquivo e registrá-lo em `i18n/index.ts` com o nome que a Steam usa (`steam`), a localidade para datas e números (`locale`) e o país da loja.
- O idioma muda **o app inteiro**: textos, mensagens de erro e notificação (o processo principal traduz com `messagesFor(store.getLanguage())`), nomes e descrições das conquistas e capas (pedidos à Steam no idioma), e o complemento das buscas de guia.
- Nenhum texto voltado ao usuário fica solto no código: na interface use `const t = useT()`; no processo principal, receba `Messages` por parâmetro. `SteamError` carrega só o tipo do erro; o texto sai de `steamErrorMessage(m, e)`.
- O idioma fica em `settings.json`. Trocar descarta o cache traduzido (jogos, listas de conquistas, capas); o `cache.json` guarda em que idioma foi lido e é descartado ao abrir se não bater.
- Na Configuração, trocar o idioma salva e **recarrega a janela**. No onboarding a troca é imediata, sem recarregar, porque ainda não há dado da Steam na tela.

## Formulários (react-hook-form + zod)

O onboarding é um formulário único em etapas:

- `Onboarding.tsx` é o dono do formulário: `useForm` com `zodResolver`, `FormProvider`, e o schema geral montado com um schema por etapa (`languageStep`, `accountStep`, `apiKeyStep`, `privacyStep`). `DoneStep` não tem schema: é só o envio.
- Cada etapa mora em `components/steps/<Etapa>Step/` com `index.tsx` e `schema.ts`, lê o formulário com `useFormContext<OnboardingFormData>()` e só avança depois de `form.trigger('<etapa>Step', { shouldFocus: true })`.
- `Stepper` guarda a etapa atual e expõe `previousStep`/`nextStep` por contexto (`useStepper`); `StepperFooter`, `StepperPreviousButton` e `StepperNextButton` montam o rodapé.
- Verificação na Steam é feita ao avançar: se falhar, `form.setError('<campo>', { message })` mostra o erro no próprio campo.
- Os schemas guardam a **chave** da mensagem (`'steamIdFormat'`), não o texto; `FieldError` traduz na hora de mostrar, para o erro acompanhar a troca de idioma. Toda chave usada num schema precisa existir em `validation` nos idiomas (há teste para isso).
- Campo que não é um `<input>` simples vira componente controlado com `useController` (ex.: `ControlledLanguageSelect`).
- Efeitos colaterais de um campo usam a assinatura do `form.watch` (ex.: trocar o idioma da tela, invalidar a confirmação do perfil quando o SteamID muda), sempre com `unsubscribe` na limpeza.
- A privacidade não tem campo digitado: o valor do formulário é preenchido quando a verificação passa, e o schema exige esse valor para concluir.
- O rascunho (idioma, SteamID e etapa) vai para o `sessionStorage` para sobreviver a um recarregamento. **A chave da Web API nunca entra no rascunho**; depois de recarregar, o formulário retoma no máximo na etapa da chave.
- Enter num campo não envia o formulário inteiro: cada etapa trata o Enter como o seu próprio "avançar".

## Política de leitura (não disparar requests à toa)

- **Jogo aberto:** a cada 60 s relê só o estado do jogador (e contadores, se o jogo tem). A lista de conquistas fica em cache por 24 h; o botão ↻ força tudo.
- **Sem mudança, sem aviso:** `Tracker.getGame` devolve o mesmo objeto quando nada mudou, e o processo principal só emite `game-updated` se o objeto for outro.
- **Painel:** carrega ao abrir, no ↻ (`all`) e quando um jogo fecha (`changed`: só jogos cujo tempo de jogo mudou).
- **Pedidos idênticos simultâneos** compartilham uma leitura (`Tracker.once`).
- **Capas e nomes** são cacheados em disco; falha da loja nunca derruba a tela.

Ao mexer nisso, meça antes e depois: conte chamadas HTTP e de IPC na abertura, parado e trocando de aba.

## Estado da interface (Zustand)

Um único store em `src/renderer/src/store/`, dividido em slices com namespace:

```
store/
  Store.ts            tipo Store (um campo por slice) e o tipo StoreSlice<T>
  index.ts            create() com os middlewares devtools (só em dev) e immer
  connect.ts          liga o store aos eventos do processo principal
  slices/
    sessionSlice.ts   jogo atual e contador de falhas
    gamesSlice.ts     telas de jogo já lidas, por appid
    userDataSlice.ts  notas, fixadas e checklists
    dashboardSlice.ts painel
```

Convenções:

- Cada slice declara `XStore` (dados), `XActions` (ações) e `XSlice = XStore & XActions`, e exporta `createXSlice: StoreSlice<XSlice>`.
- O estado é namespaced: `state.games.entries`, `state.dashboard.load`. Um slice pode ler e alterar outro pelo `get()`/`set()` do store inteiro.
- Ações alteram o rascunho do Immer direto (`prevState.games.entries[appid].loading = true`) e passam um nome para o devtools: `set(fn, false, 'games/load')`.
- Componentes leem estado e ações juntos com `useStore(useShallow(state => ({ ... })))`. Valores padrão dentro do seletor precisam ser constantes estáveis (ex.: `NONE_UNLOCKED`), senão o componente redesenha sempre.
- Não usar `persist`: o que precisa sobreviver ao fechar o app é gravado pelo processo principal (`main/store.ts`).
- Estado só de tela (filtro, busca, campo aberto) fica em `useState` no componente.
- As abas Jogo e Painel ficam sempre montadas; trocar de aba só esconde a outra.
- Edições de notas e checklists atualizam a tela na hora e são gravadas meio segundo depois (`lib/saver.ts`), com descarga ao fechar a janela.

## Interface

- Tailwind v4 (config em `src/renderer/src/styles.css`, sem `tailwind.config`) + componentes shadcn/ui + ícones Lucide. Novo componente shadcn: `npx shadcn@latest add <nome>`; o comando costuma instalar um pacote `cn` errado e importar dele: remover com `npm uninstall cn` e apontar o import para `@/lib/utils`.
- Só tema escuro, com a paleta da Steam nos tokens de `styles.css` (`--primary` azul-claro, `--success` verde, `--warning` âmbar).
- A janela é estreita (cerca de 520 px, para o segundo monitor): conferir que barras e botões cabem nessa largura.
- Prioridade é leveza: nada de biblioteca com estilização em tempo de execução.

## Dados locais

`~/.config/steam-trophy-tracker/`: `config.json` (SteamID e chave, permissão 600; cifrado só se houver keyring), `cache.json`, `userdata.json` (notas, fixadas, checklists), `settings.json` (idioma, sempre no topo). Nunca copiar a chave para fora dessa pasta nem imprimi-la.

## Testes

- Lógica do processo principal e de `shared/` tem teste; a interface é validada rodando o app.
- `test/helpers.ts` tem o `fakeFetch` por rotas; as fixtures são respostas reais (Nioh 3 e Onimusha: Way of the Sword).
- Mudança de comportamento em `tracker`, `client`, `onboarding`, `store` (main) ou `shared/` vem com teste.

## Commits

- Commitar ao fim de cada mudança pedida, sem perguntar, um commit por mudança. Só commit local: push ou qualquer envio para fora depende de pedido explícito.
- Conventional Commits em português: `feat: checklist por conquista`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `perf: ...`, `test: ...`.
- Antes de commitar: `npm test` e `npm run typecheck`.
