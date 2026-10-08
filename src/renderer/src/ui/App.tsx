import { AppShell } from './components/AppShell';
import { Onboarding } from './screens/Onboarding';
import { useAppController } from './useAppController';

export function App() {
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
