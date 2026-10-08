import { Toaster } from 'sonner';

import { AppShell } from './components/AppShell';
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
    <>
      <Content />
      <Toaster theme="dark" position="bottom-center" richColors />
    </>
  );
}
