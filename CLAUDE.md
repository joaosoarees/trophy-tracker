# Conquistas da Steam

App desktop (Electron + React + TypeScript) que mostra, para o jogo aberto na Steam, as conquistas que faltam, as ocultas reveladas, contadores de progresso, checklists do usuário e atalhos para guias. Uso pessoal; pode virar produto. Tudo voltado ao usuário é em **português do Brasil**.

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
  components/ui/  componentes shadcn/ui (gerados; não editar à mão sem motivo)
  store/          estado da interface (Zustand)
  lib/            utils (cn), text (busca sem acento), saver (gravação com pausa)
test/           Vitest, com respostas reais da API em test/fixtures
```

Regra de fronteira: a interface nunca faz `fetch` para a Steam nem toca em arquivos; tudo passa por `window.api`. Para adicionar uma chamada: método em `Api` (`shared/types.ts`), handler em `main/index.ts`, nome na lista de `preload/index.ts`.

## Fontes de dados

| Dado | Origem | Chave? |
|---|---|---|
| Lista de conquistas, descrição das ocultas, alvo do contador, raridade | `IPlayerService/GetGameAchievements` (`language=brazilian`) | não |
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

- Tailwind v4 (config em `src/renderer/src/styles.css`, sem `tailwind.config`) + componentes shadcn/ui + ícones Lucide. Novo componente shadcn: `npx shadcn@latest add <nome>` e conferir que o import de `cn` aponta para `@/lib/utils`.
- Só tema escuro, com a paleta da Steam nos tokens de `styles.css` (`--primary` azul-claro, `--success` verde, `--warning` âmbar).
- A janela é estreita (cerca de 520 px, para o segundo monitor): conferir que barras e botões cabem nessa largura.
- Prioridade é leveza: nada de biblioteca com estilização em tempo de execução.

## Dados locais

`~/.config/steam-trophy-tracker/`: `config.json` (SteamID e chave, permissão 600; cifrado só se houver keyring), `cache.json`, `userdata.json` (notas, fixadas, checklists), `settings.json`. Nunca copiar a chave para fora dessa pasta nem imprimi-la.

## Testes

- Lógica do processo principal e de `shared/` tem teste; a interface é validada rodando o app.
- `test/helpers.ts` tem o `fakeFetch` por rotas; as fixtures são respostas reais (Nioh 3 e Onimusha: Way of the Sword).
- Mudança de comportamento em `tracker`, `client`, `onboarding`, `store` (main) ou `shared/` vem com teste.

## Commits

- Commitar ao fim de cada mudança pedida, sem perguntar, um commit por mudança. Só commit local: push ou qualquer envio para fora depende de pedido explícito.
- Conventional Commits em português: `feat: checklist por conquista`, `fix: ...`, `chore: ...`, `docs: ...`, `refactor: ...`, `perf: ...`, `test: ...`.
- Antes de commitar: `npm test` e `npm run typecheck`.
