import { Suspense } from 'react';
import { Toaster } from 'sonner';

import { namedLazyLoad } from '@app/lib/namedLazyLoad';

import { AppShell } from './components/AppShell';
import { CrashScreen } from './components/CrashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './primitives/skeleton';
import { TooltipProvider } from './primitives/tooltip';
import { useAppController } from './useAppController';

// Most launches never show the onboarding, so its code (and the form
// libraries it brings) is only loaded when it is needed.
const { Onboarding } = namedLazyLoad(() => import('./screens/Onboarding'));

function OnboardingFallback() {
  return (
    <main className="mx-auto max-w-lg space-y-4 p-5" aria-busy="true">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </main>
  );
}

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
      <Suspense fallback={<OnboardingFallback />}>
        <Onboarding
          state={appState}
          onDone={handleOnboardingDone}
          onCancel={canCancelOnboarding ? handleOnboardingCancel : undefined}
        />
      </Suspense>
    );
  }

  return <AppShell />;
}

export function App() {
  return (
    <ErrorBoundary fallback={<CrashScreen />}>
      <TooltipProvider delayDuration={300}>
        <Content />
        <Toaster theme="dark" position="bottom-center" richColors />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
