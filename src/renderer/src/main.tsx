import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { reportUnhandledErrors } from './app/lib/reportUnhandledErrors';
import { App } from './ui/App';
import './ui/styles/index.css';

reportUnhandledErrors();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
