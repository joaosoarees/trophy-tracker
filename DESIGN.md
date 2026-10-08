---
name: Trophy Tracker
description: A dark, dense companion panel that sits beside a Steam game and is read at a glance.
colors:
  signal-blue: '#66c0f4'
  ink-navy: '#0b1722'
  unlocked-green: '#a4d007'
  pin-amber: '#e8b84a'
  erase-red: '#e5534b'
  night-navy: '#171a21'
  panel-navy: '#1d2530'
  recessed-slate: '#222b37'
  control-slate: '#2a3544'
  hover-steel: '#2a3a4e'
  hairline-slate: '#2b3544'
  field-edge: '#344154'
  glance-white: '#dfe3e8'
  lit-white: '#eaf5fd'
  quiet-steel: '#8b98a8'
typography:
  headline:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: '20px'
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: '14px'
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: '12px'
    fontWeight: 500
    lineHeight: 1.33
  caption:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: '4px'
  md: '6px'
  lg: '8px'
  full: '9999px'
spacing:
  '1': '4px'
  '1.5': '6px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
components:
  button-primary:
    backgroundColor: '{colors.signal-blue}'
    textColor: '{colors.ink-navy}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '36px'
  button-primary-hover:
    backgroundColor: 'color-mix(in oklab, #66c0f4 90%, transparent)'
  button-secondary:
    backgroundColor: '{colors.control-slate}'
    textColor: '{colors.glance-white}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '36px'
  button-secondary-hover:
    backgroundColor: 'color-mix(in oklab, #2a3544 80%, transparent)'
  button-outline:
    backgroundColor: 'color-mix(in oklab, #344154 30%, transparent)'
    textColor: '{colors.glance-white}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
    height: '32px'
  button-outline-hover:
    backgroundColor: 'color-mix(in oklab, #344154 50%, transparent)'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.glance-white}'
    rounded: '{rounded.md}'
    padding: '8px 10px'
    height: '32px'
  button-ghost-hover:
    backgroundColor: 'color-mix(in oklab, #2a3a4e 50%, transparent)'
    textColor: '{colors.lit-white}'
  icon-button:
    backgroundColor: 'transparent'
    textColor: '{colors.glance-white}'
    rounded: '{rounded.md}'
    size: '32px'
  card:
    backgroundColor: '{colors.panel-navy}'
    textColor: '{colors.glance-white}'
    rounded: '{rounded.lg}'
    padding: '12px'
  input:
    backgroundColor: 'color-mix(in oklab, #344154 30%, transparent)'
    textColor: '{colors.glance-white}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '4px 12px'
    height: '36px'
  segmented:
    backgroundColor: '{colors.recessed-slate}'
    rounded: '{rounded.md}'
    padding: '2px'
  segmented-option-selected:
    backgroundColor: '{colors.hover-steel}'
    textColor: '{colors.lit-white}'
    typography: '{typography.label}'
    rounded: '5px'
    padding: '4px 10px'
  tab:
    backgroundColor: 'transparent'
    textColor: '{colors.quiet-steel}'
    typography: '{typography.body}'
    padding: '8px 10px'
  tab-current:
    textColor: '{colors.glance-white}'
  progress-track:
    backgroundColor: '{colors.control-slate}'
    rounded: '{rounded.full}'
    height: '6px'
  tooltip:
    backgroundColor: '{colors.glance-white}'
    textColor: '{colors.night-navy}'
    typography: '{typography.caption}'
    rounded: '{rounded.md}'
    padding: '6px 12px'
---

# Design System: Trophy Tracker

## Overview

**Creative North Star: "The Second Monitor"**

Trophy Tracker is a support panel, not a destination. It sits beside a game on a second screen, in a window 600 pixels wide, and is read in glances by someone whose attention is elsewhere. Everything in the system follows from that: a dark field that does not glow next to a game, dense rows that put a whole list in view, one accent that marks what can be acted on, and controls small enough to stay out of the way.

The palette is borrowed from the place the user already lives. The navy field, the light blue accent and the lime green of a finished achievement are Steam's own, so the panel reads as part of the same desk rather than a second product asking to be learned. The identity is in the restraint and the response: surfaces are flat and told apart by tone, and every control answers a touch at once.

Motion is short and small. A screen rises 6 pixels as it appears, a list fades in, a section grows to its height. Nothing loops for attention, with one exception: the dot that says a game is running.

**Key Characteristics:**

- Dark only, on a navy field that sits quietly beside a game.
- Dense and narrow: built for 600 pixels of width, never under 480.
- Flat surfaces separated by tone and a hairline border; shadow only on what floats.
- One accent, used for what can be acted on and what is in focus.
- Compact controls that respond to every touch: a tint on hover, a small push on press, a visible ring on keyboard focus.
- Numbers are tabular, so counters and percentages do not shift as they change.

## Colors

A cool navy ramp carries the whole interface; four signal colors each mean exactly one thing.

### Primary

- **Signal Blue** (`signal-blue`): the single accent. The primary button, the current tab's underline, the progress bar, the keyboard focus ring, the dot that says a new version exists. Its text partner is **Ink Navy** (`ink-navy`), used only on top of it.

### Secondary

- **Unlocked Green** (`unlocked-green`): done. The "running" indicator, a completed game's check and percentage, the progress bar of something finished. It is Steam's own achievement green.

### Tertiary

- **Pin Amber** (`pin-amber`): the user's own emphasis. A pinned achievement's border and pin, and the "hidden" badge.
- **Erase Red** (`erase-red`): destruction and failure only. The erase action, an error line, a field in error.

### Neutral

- **Night Navy** (`night-navy`): the window's field, behind everything.
- **Panel Navy** (`panel-navy`): cards, rows and the lists that open over the page.
- **Recessed Slate** (`recessed-slate`): wells that hold controls, such as the segmented toggle and the sort select.
- **Control Slate** (`control-slate`): the secondary button, the empty part of a progress bar, the scrollbar thumb.
- **Hover Steel** (`hover-steel`): the tint that answers a pointer, and the selected option of a segmented toggle.
- **Hairline Slate** (`hairline-slate`): every border and divider.
- **Field Edge** (`field-edge`): the border of text fields and outlined buttons, a step lighter than a divider so a field reads as editable.
- **Glance White** (`glance-white`): primary text. A cool off-white, never pure white.
- **Lit White** (`lit-white`): text on a hovered or selected control.
- **Quiet Steel** (`quiet-steel`): secondary text, such as counts, dates, hints, placeholders and inactive tabs.

### Named Rules

**The One Signal Rule.** Signal Blue is the only color that means "you can act here" or "you are here". If it appears on something that is neither, it is wrong.

**The One Meaning Rule.** Green is done, amber is the user's own mark, red is loss. None of them is ever used for decoration or to add variety to a list.

**The Tint Rule.** Hover is a translucent wash of Hover Steel (40 to 50 percent) over whatever is underneath, not a new opaque color. Red text never sits on that wash, because it fails contrast; a destructive control hovers on a 15 percent wash of Erase Red instead.

## Typography

**Body Font:** the system interface font (`system-ui`, with Segoe UI and Roboto as fallbacks)

**Character:** The app uses whatever the operating system uses, so it renders at native sharpness on every system and feels like part of the desktop. There is one family and no display face; hierarchy comes from two weights and a small step in size.

### Hierarchy

- **Headline** (600, 20px): the one title of a screen, such as the game's name or "Dashboard". Truncates rather than wraps.
- **Title** (600, 14px, tight leading): an achievement's name inside its card. The same size as body; only the weight sets it apart.
- **Body** (400, 14px): descriptions and everything read as a sentence. Descriptions sit at 75 percent opacity of the text color, a step back from the title above them.
- **Label** (500, 12px): the text of segmented options, small buttons and status words.
- **Caption** (400, 12px): counts, dates, rarity and hints, in Quiet Steel.

Two smaller sizes exist for a single badge and a single sub-label (10px and 11px). They are exceptions, not steps of the scale.

### Named Rules

**The Same Size Rule.** A title and its description share one size. Weight and opacity do the work, which keeps a card short enough for a list to stay in view.

**The Steady Numbers Rule.** Every number that can change (percentages, counters, counts, progress) is set in tabular figures.

## Layout

One column in a narrow window: 600 pixels wide by default, never under 480. There is no grid and there are no breakpoints. The layout is a fixed tab bar at the top and a single scrolling column below it.

- **Gutter:** 16px on each side of a screen's content.
- **Rhythm:** 8px between rows of a list and between controls in a toolbar; 12px between an image and the text beside it, and as the padding inside a card.
- **Toolbars** are a single row of controls that wraps when it cannot fit. The sort select takes whatever room is left, so when a narrow window pushes it down it fills the whole second row.
- **Lists** are one item per row, full width. Art sits at the left at a fixed size (48px for an achievement icon), so rows keep their height while images load.
- **Width is the constraint to design against.** Every label has to fit in Spanish and French, which run longest; the Game toolbar is the tightest row.

## Elevation & Depth

The system is flat. Surfaces are told apart by tone, stepping from Night Navy to Panel Navy to Recessed Slate, and by a one-pixel Hairline Slate border. Nothing that is part of the page casts a shadow.

Shadow is reserved for what floats above the page: a dialog, the open list of a select, a tooltip.

### Shadow Vocabulary

- **Floating** (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): a dialog, over a 50 percent black scrim.
- **Popover** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): the list that opens under a select.
- **Edge** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): a text field and an outlined button, barely visible, to seat them in the surface.

### Named Rules

**The Flat Page Rule.** If it scrolls with the page, it has no shadow. Tone and a hairline separate it from what is around it.

## Shapes

Gently rounded rectangles throughout, with one radius per kind of thing:

- **Containers** such as cards, rows and dialogs are softly rounded (8px).
- **Controls** such as buttons, fields, selects and art are a step tighter (6px).
- **Small targets inside controls** such as an inline button or a checklist row are tighter still (4px).
- **Pills and dots** are fully round: progress bars, the running indicator, the update dot, the scrollbar thumb.

Borders are always one pixel. A tab is the one shape that breaks the pattern: rounded on top, square at the bottom, with a 2px underline that marks the current one.

## Components

Compact and responsive: small, dense, and every touch answers.

### Buttons

- **Shape:** softly rounded (6px), 36px tall by default, 32px in toolbars and cards.
- **Primary:** Signal Blue with Ink Navy text. One per view at most, for the action that moves the user forward.
- **Secondary:** Control Slate with Glance White text, for an alternative that is not destructive.
- **Outline:** a 30 percent wash of Field Edge with a Field Edge border, for an action that sits beside others without competing.
- **Ghost:** no background until hovered, for actions inside a card, such as opening a guide, a checklist or a note.
- **Destructive:** an outlined button with Erase Red text and border, hovering on a 15 percent red wash.
- **Hover / Press / Focus:** hover adds a wash; pressing scales the control to 96 percent; keyboard focus draws a 3px ring of Signal Blue at half opacity. Wide elements such as rows and cards scale to 99 percent instead, and darken.

### Icon buttons

A 32px square ghost button holding one 16px icon. It always has a label, which is both its accessible name and its tooltip. A toggle that is on takes the color of what it means (Signal Blue, or Pin Amber for a pin) and fills its icon.

### Cards / Containers

- **Corner Style:** softly rounded (8px).
- **Background:** Panel Navy on the Night Navy field.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** one pixel of Hairline Slate. A pinned achievement's border turns Pin Amber at 60 percent.
- **Internal Padding:** 12px, with 12px between the art and the text.
- A card that can be clicked as a whole (a game row) hovers with a Signal Blue border at 60 percent and a 40 percent wash.

### Inputs / Fields

- **Style:** a 30 percent wash of Field Edge, a Field Edge border, softly rounded (6px), 36px tall (32px for the search box).
- **Focus:** the border turns Signal Blue and a 3px ring of it at half opacity appears.
- **Error:** the border turns Erase Red; the message sits under the field in red.
- **Search** carries a magnifier on the left and, once there is text, a clear button on the right.

### Segmented toggle

Two or three options in a Recessed Slate well with 2px of padding. The selected option is a raised chip of Hover Steel with Lit White text; the others are Quiet Steel and take a wash on hover. Each option carries its count ("Pending 80").

### Select

A compact field (32px, 12px text) in Recessed Slate with a chevron. Its list is drawn inside the page, on Panel Navy with the Popover shadow, never by the operating system.

### Navigation

A single bar across the top with a hairline under it. Tabs are text with a small icon, in Quiet Steel; the current one is Glance White with a 2px Signal Blue underline. Utility actions sit at the right as icon buttons. Switching tabs fades the new screen in with a 6px rise over 180ms.

### Progress bar

A fully round track of Control Slate, 6px tall (8px in a header), filled with Signal Blue, or Unlocked Green when it stands for something finished. Its number sits beside it in tabular caption text, not inside it.

### Achievement card (signature)

The unit the whole app is built around. A 48px icon at the left; to its right the name in title weight, with the rarity percentage in caption text at the far end and an amber "hidden" badge when it applies; the description below at 75 percent opacity; then, when there is one, a progress bar with its count; and a last row of ghost buttons, with guide searches at the left and the user's own tools (checklist, note, pin) at the right. A checklist or a note opens inside the card, growing to its height over 180ms.

### Game header

The game's art fills the header at 35 percent opacity with a slight blur, under a gradient that fades to the field color, so the title stays readable over any image. The title, a "running" indicator in Unlocked Green with a pulsing dot, the overall progress bar and the count sit on top.

### Tooltip

The inverse of the page: Glance White with Night Navy text, softly rounded, with a small arrow. Used for every icon button and for any control that needs a word of explanation.

## Do's and Don'ts

### Do:

- **Do** keep every screen readable at 600 pixels and usable at 480, and check it in Spanish and French before calling it done.
- **Do** separate surfaces with tone and a one-pixel Hairline Slate border.
- **Do** give every clickable element three visible states besides rest: a wash on hover, a push on press (96 percent, or 99 percent for wide elements), and a focus ring.
- **Do** use Signal Blue only for what can be acted on or what is current.
- **Do** set every number that can change in tabular figures.
- **Do** show remote images in a fixed-size box with a skeleton while loading and an icon on failure.
- **Do** animate only entrances, in 200ms or less, and let the reduced-motion preference turn them off.

### Don't:

- **Don't** add a light theme or a pure white or pure black surface.
- **Don't** put a shadow on anything that scrolls with the page.
- **Don't** use green, amber or red for decoration or to tell list items apart.
- **Don't** place red text on the usual hover wash; use the red wash.
- **Don't** use a native select or the native `title` tooltip: the first opens a system popup that cannot be themed, the second is slow and never shows on keyboard focus.
- **Don't** introduce a second typeface or a display size above 20px.
- **Don't** make a control that only appears on hover unreachable by keyboard; it must also appear on focus.
- **Don't** animate an exit, loop an animation for attention, or move anything more than 20 pixels.
