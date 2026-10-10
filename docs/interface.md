# The interface: structure, look, accessibility, motion and languages

The rules below are binding; `CLAUDE.md` sends you here before you change anything under `src/renderer/src/ui/` (a screen, a component, the styles, an animation), any text the user reads, or a language.

A change the interface shows is not done until it was audited in the running app: the steps are in `docs/audit.md`. State, writes and what redraws are in `docs/store.md`, forms in `docs/onboarding-form.md`, stories in `docs/storybook.md`.

## Rules

### Screens and components

A screen is a folder in `ui/screens/<Name>/`:

```
Game/
  index.tsx              the view: layout only, no state or effects of its own
  useGameController.ts   state, store access, derived values and handlers
  achievementList.ts     pure logic of the screen (tested)
  components/            what only this screen uses
    GameHeader.tsx
    AchievementCard/       index.tsx + useAchievementCardController.ts + GuideLinks.tsx
```

- **View and controller.** `index.tsx` calls `useXController()` and renders what it returns. The controller owns `useState`, `useEffect`, store selection and handlers, and returns them named `isX` for booleans and `handleX` for actions.
- **Who gets a controller:** anything with state or effects. A component that only draws its props (`GameHeader`) is a single file with no controller.
- **Where a component lives:** used by one screen → that screen's `components/`; by more than one → `ui/components/`. Move it up only when the second use appears.
- A component with parts is a folder with `index.tsx`; a simple one is a single `.tsx` file.
- Props are an interface named `I<Component>Props`, declared right above the component.
- Logic that needs no React goes into a plain function next to the screen (or into `shared/` when the main process needs it too) and gets a test.
- A form adds `schema.ts` to its folder (see `docs/onboarding-form.md`).

### Stack, theme and window

- The tab bar drags the window. A screen without it (onboarding, update, crash, or a new full-window screen) starts with `ui/components/WindowBar`.
- **Remote images always go through `ui/components/RemoteImage`**, never a bare `<img>` with a network URL: fixed-size box, skeleton while loading, fallback icon on failure, each instance tracking its own load.
- **Skeletons are for first loads only:** `GameSkeleton` the first time a game is opened, skeleton rows the first time the dashboard loads. A game that was opened before never shows a loading state.
- Anything that flips between "is a button" and "is not" keeps its element: change what is inside, not the element (`AccountCard` in `docs/accounts.md` is the example).

- **Stack:** Tailwind v4 (config in `src/renderer/src/ui/styles/index.css`, no `tailwind.config`), shadcn/ui components, Lucide icons.
- **New shadcn component:** `pnpm dlx shadcn@latest add <name>` (it lands in `ui/primitives`). The command tends to install a wrong `cn` package and import from it: remove it with `pnpm remove cn` and point the import to `@ui/utils/cn`.
- **Dark theme only**, with the Steam palette in the tokens in `ui/styles/index.css` (`--primary` light blue, `--success` green, `--warning` amber).
- **The window is narrow:** 600 px wide, never under 480. Check that toolbars and buttons fit that width **in every language**. Spanish and French labels are the longest; the Game toolbar is the tightest row.
- A row that cannot fit wraps, with the sort select taking the whole second row.
- **No library with runtime styling:** lightness is the priority.

### Accessibility

The automated audit (axe) of every screen reports zero violations; keep it that way.

- **Nothing clickable is a raw element.** Use `Button` (primitive), `IconButton` (icon only) or `Pressable` (the base of hand-made clickables such as tabs and rows); they carry the keyboard focus ring and the disabled state. A raw `<button>` or `<select>` in `ui/` fails the lint.
- The pointer cursor comes from a global rule in `styles/index.css`.
- **Every clickable has three visible states besides rest:** hover (normally a background tint, `hover:bg-accent/40`), pressed, and keyboard focus.
- Pressed comes from a global rule (`scale: 0.96` while `:active`). Wide elements such as rows and cards tone it down with `active:scale-[0.99]` and darken instead; list options use a tint (`active:bg-primary/25`).
- In the dark theme a `dark:` background class can silently cancel a `hover:` one: give it a `dark:hover:` too. (The destructive button and the select options in `primitives/` were hand-edited for this.)
- A destructive ghost button hovers with a red tint (`hover:bg-destructive/15`): red text on the usual hover tint fails contrast.
- **Icon-only buttons** use `IconButton`, whose `label` is mandatory: it is both the accessible name and the tooltip.
- Explain other controls with `Hint`, never with the native `title` (slow, and not shown on keyboard focus).
- **State is announced, not just drawn:** `aria-pressed` on toggles (Segmented, pin, always on top, hidden only), `aria-current="page"` on the current tab, `aria-expanded` on what opens a section.
- **Selects** go through `OptionSelect`, whose `label` is mandatory. A native `<select>` is forbidden by lint (its OS-level popup is slow to close under WSLg and cannot be themed).
- **Structure:** one `<main>` per window, `<nav>` with a label, and headings in order (`h1` for the screen, `h2` inside it).
- An element shown only on hover must also show on keyboard focus (`focus-visible:opacity-100`).
- **Motion** is turned off globally under `prefers-reduced-motion`; do not add animation that bypasses it.

### Motion

Transitions are CSS only (no animation library), short and small. The tokens are in `ui/styles/index.css`.

- `animate-screen-in` (fade + 6 px rise, 180 ms) on a main tab when it is shown.
- `animate-list-in` (fade, 160 ms) on a list keyed by its filter (Pending/Unlocked, In progress/Complete).
- `animate-step-forward` / `animate-step-backward` (20 px slide, 200 ms) on onboarding steps; `Stepper` tracks the direction.
- `collapsible` on a section that opens in place (the game details, a card's checklist and note): it grows to its height when it opens and shrinks back when it closes. Use it through `ui/components/Collapsible`, which keeps the section mounted only while the closing transition runs and then takes it out of the page.
- **What opens in place closes the same way:** a section that animates open must animate closed.
- Screens, lists and steps animate only their entry. Animating their exit needs an animation library: add one only if that becomes a real need.
- An animation that moves an element makes it overflow its parent while it runs. The parent must clip it (`overflow-hidden` on `<main>` in `AppShell`), or the window gets a scrollbar for the length of the transition.

### Languages

- One file per language in `src/shared/i18n/locales/`. `en.ts` is the reference: the `Messages` type comes from it, so a new key starts there and the compiler flags what is missing elsewhere.
- Messages are strings, or functions (`left: (n) => ...`) for interpolation and plurals. There is no translation library.
- **New language:** create the file and register it in `i18n/index.ts` with the name Steam uses (`steam`), the locale for dates and numbers (`locale`) and the store country.
- **The language changes the whole app:** texts and error messages (the main process translates with `SetupService.messages`; the box shown when the app cannot open, before there is a store, with `Store.languageIn`), achievement names, descriptions and game art (requested from Steam in that language), and the suffix of guide searches.
- **No user-facing text is hard-coded.** In the interface use `const t = useT()`; in the main process take `Messages` as a parameter. `SteamError` carries only the kind of error; the text comes from `error.describe(messages)`.
- The language lives in `settings.json`. Changing it drops the translated cache (games, achievement lists, art). `cache.json` records the language it was read in and is dropped on startup if it does not match.
- In Settings, changing the language saves and **reloads the window**. In the onboarding the change is immediate, with no reload.
- `navigationSlice` keeps the tab, the picked game and the already-seen running game in `sessionStorage`, so the reload does not lose them.
