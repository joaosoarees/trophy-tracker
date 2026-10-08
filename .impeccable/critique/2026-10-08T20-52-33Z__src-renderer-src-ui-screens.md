---
target: all screens in src/renderer/src/ui/screens
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
target_identity: 'file:/home/joao/steam-trophy-tracker/src/renderer/src/ui/screens'
timestamp: 2026-10-08T20-52-33Z
slug: src-renderer-src-ui-screens
---

Method: dual-agent (A: design review with code and screenshots · B: detector and in-app inspection attempt)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                         |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | Nothing says when the data was last read; "hidden only" persists across games silently.           |
| 2         | Match System / Real World       | 3         | Rarity is an unlabeled "0.5%"; the button says "List" where the product fixed "checklist".        |
| 3         | User Control and Freedom        | 2         | Removing a checklist item is instant with no undo; the startup update cannot be deferred.         |
| 4         | Consistency and Standards       | 2         | Toggles borrow the primary fill; one Pin glyph has two meanings; dialogs change layout at 640 px. |
| 5         | Error Prevention                | 3         | Clicking a checklist item's text renames it instead of checking it.                               |
| 6         | Recognition Rather Than Recall  | 3         | A checklist starts closed every session, behind a "3/12" chip.                                    |
| 7         | Flexibility and Efficiency      | 2         | No keyboard shortcuts; no bulk checklist actions.                                                 |
| 8         | Aesthetic and Minimalist Design | 2         | The Game screen repeats a six-control row on every card.                                          |
| 9         | Error Recovery                  | 3         | In-app errors are a red line with no action; one message exposes the HTTP status.                 |
| 10        | Help and Documentation          | 2         | No help after onboarding; nothing explains why an achievement has no counter.                     |
| **Total** |                                 | **25/40** | **Acceptable**                                                                                    |

## Design Specificity Verdict

**LLM assessment.** The behaviour is authored for this product; the look is not. Hidden achievements revealed, a counter that says whether it comes from Steam or the user's checklist, "Paste list" and "Closest to 100%" as the default belong to this app. Visually it is stock shadcn dark with Steam's three colours: Settings, onboarding and the erase dialog could ship unchanged in any Electron utility. Nothing in the visual language expresses achievement hunting: rarity is a grey 12 px number, a pinned target is an amber hairline, a finished game is a grey empty state.

**Deterministic scan.** Three findings, all exceptions DESIGN.md already documents, treated as false positives: `design-system-font-size` at `screens/Dashboard/components/GameRow.tsx:66` (11px) and `screens/Game/components/AchievementCard/index.tsx:82` (10px), and `border-accent-on-rounded` at `components/AppShell/TabButton.tsx:18` (the tab underline). The detector caught none of the priority issues.

**Visual overlays.** None. The app's Content-Security-Policy blocks injecting the detector script; it was not worked around.

## Overall Impression

A solid, honest base with the best work in the onboarding. The problem is the most used screen: the north star is "dense and read at a glance", and the Game screen shows 5 cards of 80 with "Guides / YouTube / Google" as its heaviest repeated mark. The biggest opportunity is to strip the achievement card.

## What's Working

- The in-progress Dashboard row answers one question (how close am I) with a bold, tabular, right-aligned percentage that scans vertically.
- Verification in the Account step: the SteamID is detected, locked and says where it came from; errors about the pair sit at step level; the privacy failure opens the right help with a deep link.
- Honesty as interface: a checklist-driven counter carries an icon; "Paste list" shows a live "Add N items"; the erase dialog says exactly what survives.

## Priority Issues

- **[P1] The Game screen is neither dense nor glanceable.** Header and toolbar take 30% of a 600x860 window and 5 cards fit. The three guide links are filled chips (DESIGN.md says ghost), fifteen per viewport. The game's name is the headline; "80 left" is 12 px muted text. **Fix:** one ghost "Guide" button that opens the last-used site with the others behind a chevron; the user's tools shown only when they hold content or on hover/focus; "80 left" as the header's prominent figure. Files: `screens/Game/components/AchievementCard/GuideLinks.tsx:35`, `screens/Game/components/AchievementCard/index.tsx:131-165`, `screens/Game/components/GameHeader.tsx:44-77`. **Suggested command:** /impeccable distill
- **[P1] Finishing a game has no designed moment.** 100% is the generic Empty component in grey ("Nothing pending. 100%!") under a live toolbar for an empty list; the banner is the generic unlock one. **Fix:** a completion state replacing the pending list: unblurred header art, 100% in Unlocked Green at headline size, completion date, one action "See unlocked"; one entrance, nothing looping. Files: `screens/Game/index.tsx:71-109`, `screens/Game/components/GameHeader.tsx:64-77`. **Suggested command:** /impeccable delight
- **[P1] The checklist works against its most frequent action.** Only the 16 px checkbox checks an item; clicking the text opens rename. Remove is an 18 px hover-only target that deletes with no undo. The list starts closed every session. **Fix:** the whole row toggles; rename on double-click or a hover/focus pencil; remove at least 24 px with an Undo toast; open a checklist that has unchecked items. Files: `screens/Game/components/Checklist/ChecklistRow.tsx:33-75`, `screens/Game/components/AchievementCard/useAchievementCardController.ts:27-28`. **Suggested command:** /impeccable harden
- **[P2] Filters that persist silently and a search that under-reports.** "Hidden only" is shared by every game; Game search says "Nothing found" for an achievement that is in the other tab, a case the Dashboard already handles with a link. **Fix:** reset "hidden only" when the game changes and hide the control at 0; port the other-list link to the Game screen. Files: `screens/Game/useGameController.ts:46-48`, `screens/Game/components/AchievementToolbar.tsx:56-67`. **Suggested command:** /impeccable harden
- **[P2] The implementation departs from DESIGN.md where the user can see it.** Dialogs switch layout at `sm:` (640 px), so at the default 600 px every dialog is in its mobile layout; the erase confirm is a filled red button where the system says outlined; on-toggles ("Hidden", open "List") use the solid primary fill; native `title` is used twice on the card (rarity, counter source). Files: `primitives/dialog.tsx:64,88,106`, `screens/Settings/components/EraseDialog.tsx:36`, `screens/Game/components/AchievementCard/index.tsx:91,104,137`, `screens/Game/components/AchievementToolbar.tsx:59`. **Suggested command:** /impeccable polish

## Persona Red Flags

**Alex (Power User):** no keyboard shortcuts anywhere; three guide buttons force a choice on every lookup; the startup Update screen cannot be deferred.

**Sam (Accessibility):** rarity and counter source are native `title`s on non-focusable elements; `ProgressBar` is a bare div with no role or value; the unlock banner is a button with `role="status"`; each checklist row has two controls with the same accessible name; remove-item (18 px) and search clear (~22 px) are under the 24 px minimum.

**Rafa (100% hunter glancing mid-fight):** the number he looks for is the quietest text in the header; five cards per glance and no "pinned only" view; his collectible checklist is closed and "3/12" does not say which nine are left; the update-ready dialog covers the panel while he plays; locked icons are near-black on the dark card.

## Minor Observations

- One Pin glyph means "always on top" in the nav and "pin achievement" in a card, with different on colours.
- The h1s "Dashboard" and "Settings" repeat the tab directly above them.
- Voice slips to first person ("I could not find…", "I found…").
- Unlocked cards are dimmed (`opacity-90`): what was earned is quieter than what was not.
- Settings does not say where data lives or mention "local and private".
- The duplicate-item warning is amber, reserved for the user's own mark.
- DESIGN.md contradicts itself: amber is "the user's own mark" and also the "hidden" badge, which is Steam's property.

## Questions to Consider

- The user knows the game's name. Why is the name the headline and "80 left" the footnote?
- Should the default view be all 80 pending at equal weight, when pins already say "these are my targets"?
- Would a visual treatment for the rarest tier make this recognisably an achievement app, or break the One Meaning Rule?

## Limits of this run

Screenshots were English at 600 px only; Spanish, French and 480 px were not checked. The Update screen, the Done step, empty and error states were judged from code. Focus-ring contrast figures are estimates.
