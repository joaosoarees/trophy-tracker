import { type Decorator, type Preview } from '@storybook/react-vite';
import { type ReactNode, useEffect, useState } from 'react';
import { action } from 'storybook/actions';

import { useStore } from '@app/store';
import {
  isLanguage,
  LANGUAGE_CODES,
  LANGUAGES,
  type Language,
} from '@shared/i18n';
import { type IApi } from '@shared/types/Api';
import { TooltipProvider } from '@ui/primitives/tooltip';

import { theme } from './theme';

import '../src/renderer/src/ui/styles/index.css';

// There is no main process here. Whatever a component asks of it is shown in
// the Actions panel and answered with nothing; events never arrive.
window.api = new Proxy({} as IApi, {
  get: (_api, name: string) =>
    name.startsWith('on')
      ? () => () => {}
      : (...args: unknown[]) => {
          action(`window.api.${name}`)(...args);
          return Promise.resolve(undefined);
        },
});

document.documentElement.classList.add('dark');

/** Puts the app in the language picked in the toolbar before drawing the story. */
function InLanguage({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const [applied, setApplied] = useState<Language | null>(null);

  useEffect(() => {
    useStore.setState((state) => {
      state.session.language = language;
    });
    document.documentElement.lang = language;
    setApplied(language);
  }, [language]);

  return applied === language ? children : null;
}

const withApp: Decorator = (Story, context) => {
  const { locale } = context.globals;

  return (
    <InLanguage language={isLanguage(locale) ? locale : 'en'}>
      <TooltipProvider delayDuration={300}>
        <Story />
      </TooltipProvider>
    </InLanguage>
  );
};

const preview: Preview = {
  // Every component gets a page with its props and its stories.
  tags: ['autodocs'],
  decorators: [withApp],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    docs: { theme },
    // The two widths the layout is built for: the window never gets
    // narrower than the first and opens at the second.
    viewport: {
      options: {
        narrowest: {
          name: 'Narrowest window (480)',
          styles: { width: '480px', height: '860px' },
        },
        standard: {
          name: 'Window as it opens (600)',
          styles: { width: '600px', height: '860px' },
        },
      },
    },
  },
  globalTypes: {
    locale: {
      description: 'Language of the app',
      toolbar: {
        icon: 'globe',
        dynamicTitle: true,
        items: LANGUAGE_CODES.map((code) => ({
          value: code,
          title: LANGUAGES[code].label,
        })),
      },
    },
  },
  initialGlobals: {
    locale: 'en',
    viewport: { value: 'standard', isRotated: false },
  },
};

export default preview;
