# Storybook

How the catalogue of components is set up and how a story is written. The rules that follow from this are in `CLAUDE.md`; read this before writing a story or changing `.storybook/`.

`pnpm storybook` opens the catalogue of the interface's building blocks: each one alone, in every state, outside the app. It is where a component is looked at before it is put on a screen, and where a state that is hard to reach in the app (a refused key, a finished game, a name too long) is one click away.

```
.storybook/
  main.ts        what is built: where the stories are, the add-ons, the aliases and Tailwind
  preview.tsx    what every story runs inside: the app's styles, a stand-in for the main process,
                 and the language and window width picked in the toolbar
  manager.ts     the panel around the stories
  theme.ts       Storybook in the app's palette, for the panel and the documentation pages
src/renderer/src/stories/
  primitives/    Button, Badge, Checkbox, Input, Textarea, Skeleton, Dialog
  components/    everything in ui/components that is drawn
  screens/       the signature pieces of the screens: AchievementCard, GameHeader, GameComplete, GameRow
```

- **Stories live apart from the components**, in `src/renderer/src/stories/`, one `<Name>.stories.tsx` per component, titled `Primitives/…`, `Components/…` or `Screens/<Screen>/…`. The folders of `ui/` hold only what ships.
- **A story file** has a `meta` (`satisfies Meta<typeof X>`) with the default `args`, and `argTypes` that sort the props into categories (`Appearance`, `State`, `Accessibility`, `Event Listeners`, `Slots`) and give enums their options. Handlers are `fn()` from `storybook/test`, so each call shows in the Actions panel. Each story is one state, named for what it shows (`KeyRefused`, `WithAChecklist`), with a comment when the reason for the state is not obvious. A component that needs state to be seen working gets a `render` named `Render` with `useState`.
- **Every component gets a page**: generated from the stories and the props by default (`tags: ['autodocs']` in the preview), with what it is for in `parameters.docs.description.component`. A component with real guidance (when to use, anatomy, do and don't) has a hand-written `<Name>.mdx` beside its stories instead, and its meta carries `tags: ['!autodocs']` so there is one page, not two. The text comes from `DESIGN.md`, which stays the source: change the rule there and bring the page along.
- **Data comes from the test factories** (`makeAchievement`, `makeGameView`, `makeGameSummary`, through `@test`), as in the tests. Only those three are compiled for the interface; a factory that pulls in main-process code cannot be used in a story.
- **There is no main process in Storybook.** `preview.tsx` puts a stand-in at `window.api` that shows each call in the Actions panel and answers with nothing; events never arrive. A component that reads the store sees its initial state, plus the language of the toolbar. Screens that only make sense with a loaded store are not in the catalogue: the audit covers them.
- **The toolbar has what breaks layouts here:** the language (the four of the app) and the window width (480 and 600). There is no light theme to switch to. The accessibility panel runs axe on the story on screen.
- **Versions:** Storybook 10, where `addon-essentials` and `@storybook/blocks` no longer exist: controls, actions and viewport are part of `storybook` itself, and the documentation blocks come from `@storybook/addon-docs/blocks`. Its telemetry is turned off (`core.disableTelemetry`).
- **A new component in `ui/components`, or a new state of one, comes with its story.** Lint covers the stories (`eslint-plugin-storybook`), `pnpm typecheck` compiles them, and CI builds the catalogue (`pnpm build-storybook`), so a story that stops compiling fails the build. Storybook does not replace `pnpm audit:ui`: a story shows a component alone, the audit shows the app.
