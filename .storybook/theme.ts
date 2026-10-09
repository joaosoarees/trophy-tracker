import { create } from 'storybook/theming';

// build/icon.svg, inlined: the manager is built apart from the app and
// cannot import a file from outside its folder.
const ICON =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%201024%201024%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22bg%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%22%20stop-color%3D%22%2322344a%22/%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23171a21%22/%3E%0A%20%20%20%20%3C/linearGradient%3E%0A%20%20%3C/defs%3E%0A%20%20%3Crect%20x%3D%2264%22%20y%3D%2264%22%20width%3D%22896%22%20height%3D%22896%22%20rx%3D%22200%22%20fill%3D%22url%28%23bg%29%22/%3E%0A%20%20%3Crect%20x%3D%2264%22%20y%3D%2264%22%20width%3D%22896%22%20height%3D%22896%22%20rx%3D%22200%22%20fill%3D%22none%22%20stroke%3D%22%2366c0f4%22%20stroke-opacity%3D%220.25%22%20stroke-width%3D%2212%22/%3E%0A%20%20%3C%21--%20Trophy%3A%20Lucide%20%22trophy%22%20outline%2C%20scaled%20from%20its%2024%20px%20grid%20--%3E%0A%20%20%3Cg%20transform%3D%22translate%28224%20224%29%20scale%2824%29%22%20fill%3D%22none%22%20stroke%3D%22%2366c0f4%22%20stroke-width%3D%221.7%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%0A%20%20%20%20%3Cpath%20d%3D%22M10%2014.66v1.626a2%202%200%200%201-.976%201.696A5%205%200%200%200%207%2021.978%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M14%2014.66v1.626a2%202%200%200%200%20.976%201.696A5%205%200%200%201%2017%2021.978%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M18%209h1.5a1%201%200%200%200%200-5H18%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M4%2022h16%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M6%209a6%206%200%200%200%2012%200V3a1%201%200%200%200-1-1H7a1%201%200%200%200-1%201z%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M6%209H4.5a1%201%200%200%201%200-5H6%22/%3E%0A%20%20%3C/g%3E%0A%3C/svg%3E%0A';

/**
 * Storybook itself in the app's own palette (DESIGN.md), for the panel
 * around the stories and for the documentation pages: a component is seen
 * against the tones it will sit among.
 */
export const theme = create({
  base: 'dark',
  brandTitle: 'Trophy Tracker',
  brandImage: ICON,
  colorPrimary: '#66c0f4',
  colorSecondary: '#66c0f4',
  appBg: '#171a21',
  appContentBg: '#171a21',
  appPreviewBg: '#171a21',
  appBorderColor: '#2b3544',
  appBorderRadius: 8,
  barBg: '#1d2530',
  barTextColor: '#8b98a8',
  barSelectedColor: '#66c0f4',
  barHoverColor: '#eaf5fd',
  textColor: '#dfe3e8',
  textMutedColor: '#8b98a8',
  inputBg: '#222b37',
  inputBorder: '#344154',
  inputTextColor: '#dfe3e8',
  fontBase: "system-ui, 'Segoe UI', Roboto, sans-serif",
});
