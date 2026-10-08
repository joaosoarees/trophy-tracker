import { ExternalLink } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { SystemService } from '@app/services/SystemService';
import { Button } from '@ui/primitives/button';
import { StepHeader } from '@ui/screens/Onboarding/components/StepHeader';
import {
  StepperFooter,
  StepperNextButton,
  StepperPreviousButton,
} from '@ui/screens/Onboarding/components/Stepper';

import { usePrivacyStepController } from './usePrivacyStepController';

export function PrivacyStep() {
  const t = useT();
  const { isTesting, verified, problem, test } = usePrivacyStepController();

  return (
    <div>
      <StepHeader
        title={t.onboarding.privacy.title}
        description={t.onboarding.privacy.description}
      />

      {isTesting && <p>{t.onboarding.privacy.testing}</p>}
      {verified && <p className="text-success">{t.onboarding.privacy.ok}</p>}

      {!isTesting && problem && (
        <>
          <p className="text-destructive">{problem}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {t.onboarding.privacy.steps.map((item, index) => (
              <li key={item}>
                {item}
                {index === 0 && (
                  <>
                    {' '}
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      onClick={() => void SystemService.openExternal('privacy')}
                    >
                      <ExternalLink />
                      {t.common.openInBrowser}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <StepperFooter>
        <StepperPreviousButton disabled={isTesting} />
        {verified ? (
          <StepperNextButton />
        ) : (
          <StepperNextButton disabled={isTesting} onClick={() => void test()}>
            {t.onboarding.privacy.testAgain}
          </StepperNextButton>
        )}
      </StepperFooter>
    </div>
  );
}
