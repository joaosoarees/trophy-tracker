import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { useT } from '@app/hooks/useT';
import { OnboardingService } from '@app/services/OnboardingService';
import { SystemService } from '@app/services/SystemService';
import type { IProfile } from '@shared/types';
import { Button } from '@ui/primitives/button';
import { Input } from '@ui/primitives/input';
import { Label } from '@ui/primitives/label';
import type { OnboardingFormData } from '@ui/screens/Onboarding';
import { FieldError } from '@ui/screens/Onboarding/components/FieldError';
import { StepHeader } from '@ui/screens/Onboarding/components/StepHeader';
import {
  StepperFooter,
  StepperNextButton,
  StepperPreviousButton,
} from '@ui/screens/Onboarding/components/Stepper';
import { useStepper } from '@ui/screens/Onboarding/components/Stepper/useStepper';

export function AccountStep() {
  const t = useT();
  const { nextStep } = useStepper();
  const form = useFormContext<OnboardingFormData>();
  const [detected, setDetected] = useState(false);
  const [profile, setProfile] = useState<IProfile | null>(null);
  /** Why Steam did not confirm the profile; it does not block moving on. */
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Fill in the account signed in to the Steam client, without overwriting what was already typed.
  useEffect(() => {
    let active = true;

    void OnboardingService.detectSteamId().then((steamId) => {
      if (!active || !steamId) return;

      setDetected(true);
      if (!form.getValues('accountStep.steamId')) {
        form.setValue('accountStep.steamId', steamId);
      }
    });

    return () => {
      active = false;
    };
  }, [form]);

  // The SteamID changed: the previous confirmation no longer holds.
  useEffect(() => {
    const { unsubscribe } = form.watch((_formData, { name }) => {
      if (name === 'accountStep.steamId') {
        setProfile(null);
        setUnconfirmed(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [form]);

  async function handleVerify() {
    const isValid = await form.trigger('accountStep', { shouldFocus: true });
    if (!isValid) return;

    setIsVerifying(true);
    setUnconfirmed(null);
    const result = await OnboardingService.checkSteamId(
      form.getValues('accountStep.steamId'),
    );
    setIsVerifying(false);

    if (result.status === 'found') {
      setProfile(result.profile);
    } else if (result.status === 'unconfirmed') {
      setUnconfirmed(result.reason);
    } else {
      form.setError(
        'accountStep.steamId',
        { type: 'validate', message: result.error },
        { shouldFocus: true },
      );
    }
  }

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
          {profile.avatar && (
            <img src={profile.avatar} alt="" className="size-12 rounded-md" />
          )}
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
