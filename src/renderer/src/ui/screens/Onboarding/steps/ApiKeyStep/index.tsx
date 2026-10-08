import { ExternalLink } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { SystemService } from '@app/services/SystemService';
import { Button } from '@ui/primitives/button';
import { Input } from '@ui/primitives/input';
import { Label } from '@ui/primitives/label';
import { FieldError } from '@ui/screens/Onboarding/components/FieldError';
import { StepHeader } from '@ui/screens/Onboarding/components/StepHeader';
import {
  StepperFooter,
  StepperNextButton,
  StepperPreviousButton,
} from '@ui/screens/Onboarding/components/Stepper';

import { useApiKeyStepController } from './useApiKeyStepController';

export function ApiKeyStep() {
  const t = useT();
  const { form, isVerifying, handleNextStep } = useApiKeyStepController();
  const [openPage, ...otherSteps] = t.onboarding.apiKey.steps;

  return (
    <div>
      <StepHeader
        title={t.onboarding.apiKey.title}
        description={t.onboarding.apiKey.description}
      />

      <ol className="list-decimal space-y-2 pl-5">
        <li>
          {openPage}{' '}
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => void SystemService.openExternal('apikey')}
          >
            <ExternalLink />
            {t.common.openInBrowser}
          </Button>
        </li>
        {otherSteps.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>

      <div className="mt-4 space-y-2">
        <Label htmlFor="apiKey">{t.onboarding.apiKey.label}</Label>
        <Input
          id="apiKey"
          type="password"
          autoComplete="off"
          placeholder={t.onboarding.apiKey.placeholder}
          {...form.register('apiKeyStep.apiKey')}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            void handleNextStep();
          }}
        />
        <FieldError name="apiKeyStep.apiKey" />
      </div>

      <StepperFooter>
        <StepperPreviousButton disabled={isVerifying} />
        <StepperNextButton disabled={isVerifying} onClick={handleNextStep}>
          {isVerifying
            ? t.onboarding.apiKey.verifying
            : t.onboarding.apiKey.verify}
        </StepperNextButton>
      </StepperFooter>
    </div>
  );
}
