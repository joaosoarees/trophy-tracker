import { Toaster } from 'sonner';

import { AppShell } from './components/AppShell';
import { TooltipProvider } from './primitives/tooltip';
import { Onboarding } from './screens/Onboarding';
import { useAppController } from './useAppController';

function Content() {
  const {
    appState,
    showOnboarding,
    canCancelOnboarding,
    handleOnboardingDone,
    handleOnboardingCancel,
  } = useAppController();

  if (!appState) {
    return null;
  }

  if (showOnboarding) {
    return (
      <Onboarding
        state={appState}
        onDone={handleOnboardingDone}
        onCancel={canCancelOnboarding ? handleOnboardingCancel : undefined}
      />
    );
  }

  return <AppShell />;
}

export function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <Content />
      <Toaster theme="dark" position="bottom-center" richColors />
    </TooltipProvider>
  );
}
