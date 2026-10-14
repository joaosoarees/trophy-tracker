# Roadmap

What was decided to do and is not done yet, in the order it is meant to be done. An item leaves this file when it ships; why a choice was made stays in `DECISIONS.md`.

## The tab bar adapts to its texts

At 480 px, beside the 138 px of buttons Windows draws, the tab bar has 342 px, and in French it needs nearly all of them: it takes no other button, and a longer label in a new language would push the last one under the system's buttons. It is kept whole by a measurement in the audit, which since 2026-10-13 runs in English only.

The bar should give way by itself when its texts do not fit, for example by dropping the tabs' labels and keeping their icons, with the label as the tooltip. After the themes.
