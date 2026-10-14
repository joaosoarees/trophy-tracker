import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { reportUnhandledErrors } from './app/lib/reportUnhandledErrors';
import { firstTheme, lastShownTheme, showTheme } from './app/lib/themeOnScreen';
import { App } from './ui/App';
import './ui/styles/index.css';

reportUnhandledErrors();
// Before anything is drawn: the first frame is already in the theme.
showTheme(firstTheme(window.location.search, lastShownTheme()));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
