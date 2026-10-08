import { ExternalLink, User } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { SystemService } from '@app/services/SystemService';
import { RemoteImage } from '@ui/components/RemoteImage';
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

import { useAccountStepController } from './useAccountStepController';

export function AccountStep() {
  const t = useT();
  const {
    form,
    nextStep,
    detected,
    profile,
    unconfirmed,
    isVerifying,
    handleVerify,
  } = useAccountStepController();

  return (
    <div>
      <StepHeader
        title={t.onboarding.account.title}
        description={t.onboarding.account.description}
      />

      <p>
        {detected
          ? t.onboarding.account.detected
          : t.onboarding.account.notDetected}
      </p>

      <details
        open={!detected}
        className="bg-card my-3 rounded-lg border px-3 py-2"
      >
        <summary className="text-primary cursor-pointer">
          {t.onboarding.account.helpTitle}
        </summary>
        <ol className="my-2 list-decimal space-y-1.5 pl-5">
          {t.onboarding.account.help.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          onClick={() => void SystemService.openExternal('account')}
        >
          <ExternalLink />
          {t.onboarding.account.openAccount}
        </Button>
      </details>

      <div className="space-y-2">
        <Label htmlFor="steamId">{t.onboarding.account.label}</Label>
        <Input
          id="steamId"
          inputMode="numeric"
          placeholder="7656119…"
          {...form.register('accountStep.steamId')}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (profile) nextStep();
            else void handleVerify();
          }}
        />
        <FieldError name="accountStep.steamId" />
      </div>

      {profile && (
        <div className="bg-card my-3 flex items-center gap-3 rounded-lg border p-3">
          <RemoteImage
            src={profile.avatar}
            fallback={<User className="size-5" />}
            className="size-12 flex-none"
          />
          <div>
            <strong className="block">{profile.name}</strong>
            <small className="text-muted-foreground">
              {t.onboarding.account.found}
            </small>
          </div>
        </div>
      )}

      {unconfirmed && (
        <p className="text-warning mt-3">
          {t.onboarding.account.unconfirmed(unconfirmed)}
        </p>
      )}

      <StepperFooter>
        <StepperPreviousButton />
        {unconfirmed && (
          <Button type="button" variant="secondary" onClick={nextStep}>
            {t.onboarding.account.continueAnyway}
          </Button>
        )}
        {profile ? (
          <StepperNextButton>{t.onboarding.account.mine}</StepperNextButton>
        ) : (
          <StepperNextButton disabled={isVerifying} onClick={handleVerify}>
            {isVerifying
              ? t.onboarding.account.verifying
              : unconfirmed
                ? t.common.retry
                : t.onboarding.account.verify}
          </StepperNextButton>
        )}
      </StepperFooter>
    </div>
  );
}
