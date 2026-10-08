import { CircleCheck, Lock, User } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { SystemService } from '@app/services/SystemService';
import { RemoteImage } from '@ui/components/RemoteImage';
import { Button } from '@ui/primitives/button';
import { Input } from '@ui/primitives/input';
import { Label } from '@ui/primitives/label';
import { FieldError } from '@ui/screens/Onboarding/components/FieldError';
import { HelpList } from '@ui/screens/Onboarding/components/HelpList';
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
    verified,
    isVerified,
    isVerifying,
    problem,
    privacyProblem,
    steamIdSource,
    isSteamIdLocked,
    handleVerify,
    handleChange,
    handleEditSteamId,
    handleNext,
  } = useAccountStepController();
  const text = t.onboarding.account;

  // Enter in a field checks the account instead of submitting the whole form.
  function handleEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (isVerified) handleNext();
    else handleVerify();
  }

  return (
    <div>
      <StepHeader title={text.title} description={text.description} />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="steamId">{text.steamId.label}</Label>
          <div className="relative">
            <Input
              id="steamId"
              inputMode="numeric"
              placeholder="7656119…"
              readOnly={isSteamIdLocked}
              className={isSteamIdLocked ? 'bg-muted pr-9' : undefined}
              {...form.register('accountStep.steamId')}
              onKeyDown={handleEnter}
            />
            {isSteamIdLocked && (
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2" />
            )}
          </div>
          <FieldError name="accountStep.steamId" />

          {isSteamIdLocked && !isVerified && (
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
              {steamIdSource === 'detected'
                ? text.steamId.detected
                : text.steamId.saved}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={handleEditSteamId}
              >
                {text.steamId.change}
              </Button>
            </p>
          )}

          {!isSteamIdLocked && (
            <>
              {steamIdSource === 'typed' && (
                <p className="text-muted-foreground text-xs">
                  {text.steamId.notDetected}
                </p>
              )}
              <HelpList
                title={text.steamId.helpTitle}
                items={text.steamId.help}
                action={text.steamId.openAccount}
                onAction={() => void SystemService.openExternal('account')}
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">{text.key.label}</Label>
          <Input
            id="apiKey"
            type="password"
            autoComplete="off"
            placeholder={text.key.placeholder}
            readOnly={isVerified}
            className={isVerified ? 'bg-muted' : undefined}
            {...form.register('accountStep.apiKey')}
            onKeyDown={handleEnter}
          />
          <FieldError name="accountStep.apiKey" />

          {!isVerified && (
            <HelpList
              title={text.key.helpTitle}
              items={text.key.help}
              action={text.key.openPage}
              onAction={() => void SystemService.openExternal('apikey')}
            />
          )}
        </div>
      </div>

      {problem && (
        <p role="alert" className="text-destructive mt-4">
          {problem}
        </p>
      )}

      {privacyProblem && (
        <div role="alert" className="mt-4 space-y-2">
          <p className="text-destructive">{privacyProblem}</p>
          <HelpList
            open
            items={text.privacy.help}
            action={text.privacy.openSettings}
            onAction={() => void SystemService.openExternal('privacy')}
          />
        </div>
      )}

      {verified && (
        <div className="bg-card expand-in mt-4 flex items-center gap-3 rounded-lg border p-3">
          <RemoteImage
            src={verified.avatar}
            fallback={<User className="size-5" />}
            className="size-12 flex-none"
          />
          <div className="min-w-0 flex-1">
            <strong className="block truncate">{verified.name}</strong>
            <small className="text-success flex items-center gap-1">
              <CircleCheck className="size-3.5" />
              {text.verified(verified.gamesWithPlaytime)}
            </small>
            <small className="text-muted-foreground block">{text.locked}</small>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleChange}
          >
            {text.change}
          </Button>
        </div>
      )}

      <FieldError name="accountStep.verified" />

      <StepperFooter>
        <StepperPreviousButton disabled={isVerifying} />
        {isVerified ? (
          <StepperNextButton />
        ) : (
          <StepperNextButton disabled={isVerifying} onClick={handleVerify}>
            {isVerifying
              ? text.verifying
              : privacyProblem
                ? text.privacy.testAgain
                : text.verify}
          </StepperNextButton>
        )}
      </StepperFooter>
    </div>
  );
}
