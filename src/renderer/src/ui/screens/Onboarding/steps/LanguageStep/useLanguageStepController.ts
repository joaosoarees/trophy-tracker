import { useFormContext } from 'react-hook-form';
import { useShallow } from 'zustand/react/shallow';

import { useStore } from '@app/store';
import { DEFAULT_THEME, type ThemeId } from '@shared/themes';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';
import type { OnboardingFormData } from '@ui/screens/Onboarding/schema';

export function useLanguageStepController() {
  const { nextStep } = useStepper();
  const form = useFormContext<OnboardingFormData>();
  const { theme, pickTheme } = useStore(
    useShallow((state) => ({
      theme: state.settings.appState?.theme ?? DEFAULT_THEME,
      pickTheme: state.settings.pickTheme,
    })),
  );

  return {
    control: form.control,
    theme,
    // Saved as it is picked, like the language: the first account starts on it.
    handlePickTheme: (picked: ThemeId) => void pickTheme(picked),
    handleNextStep: async () => {
      const isValid = await form.trigger('languageStep', { shouldFocus: true });

      if (isValid) {
        nextStep();
      }
    },
  };
}
