import { CircleCheck, Lock, Plus, X } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { SystemService } from '@app/services/SystemService';
import { type IAccount } from '@shared/types/Account';
import { type IAppState } from '@shared/types/AppState';
import { AccountCard } from '@ui/components/AccountCard';
import { IconButton } from '@ui/components/IconButton';
import { KeyField } from '@ui/components/KeyField';
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
import { cn } from '@ui/utils/cn';

import { useAccountStepController } from './useAccountStepController';

interface IAccountStepProps {
  /** The accounts the app already has: verified, saved, shown above the form. */
  accounts: IAccount[];
  /** SteamIDs of the accounts verified in this visit. */
  addedHere: string[];
  onChange: (state: IAppState, added?: string) => void;
  /** The step was opened to add an account: its form starts open. */
  isInitiallyOpen: boolean;
  /** The setup is being finished: nothing else can be asked for meanwhile. */
  isFinishing: boolean;
  /** The way out when the step was opened only to add an account. */
  onCancel?: () => void;
}

/**
 * Everything about accounts happens here: the ones already verified are
 * listed, and one more can be verified below them. A verified account is
 * saved at once, so the step ends the setup: there is nothing left to
 * confirm after it.
 */
export function AccountStep({
  accounts,
  addedHere,
  onChange,
  isInitiallyOpen,
  isFinishing,
  onCancel,
}: IAccountStepProps) {
  const t = useT();
  const {
    form,
    isFormOpen,
    isFormOptional,
    isVerifying,
    problem,
    privacyProblem,
    isSteamIdLocked,
    isSteamIdNotFound,
    handleVerify,
    handleEnter,
    handleRemove,
    handleOpenForm,
    handleCloseForm,
    handleEditSteamId,
  } = useAccountStepController({ accounts, isInitiallyOpen, onChange });
  const text = t.onboarding.account;
  const hasAccounts = accounts.length > 0;
  const verifyLabel = isVerifying
    ? text.verifying
    : privacyProblem
      ? text.privacy.testAgain
      : text.verify;

  return (
    <div>
      <StepHeader title={text.title} description={text.description} />

      {hasAccounts && (
        <ul aria-label={t.accounts.title} className="mb-4 flex flex-col gap-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.steamId}
              account={account}
              status={
                <span className="text-success flex items-center gap-1 text-xs">
                  <CircleCheck className="size-3.5" aria-hidden />
                  {t.accounts.verified}
                </span>
              }
              action={
                // Only what was added in this visit is undone here, in one
                // click: an older account has notes, and Settings asks first.
                addedHere.includes(account.steamId) && (
                  <IconButton
                    type="button"
                    label={t.accounts.removeNamed(
                      account.name || account.steamId,
                    )}
                    className="-mr-1"
                    onClick={() => handleRemove(account.steamId)}
                  >
                    <X />
                  </IconButton>
                )
              }
            />
          ))}
        </ul>
      )}

      {isFormOpen ? (
        // Opened to add one more, the form is a thing of its own, with its
        // own way out: a panel holds it and its two buttons together.
        <div
          className={cn(
            'space-y-4',
            isFormOptional && 'bg-card/50 rounded-lg border p-3',
          )}
        >
          <div className="space-y-2">
            <Label htmlFor="steamId">{text.steamId.label}</Label>
            <div className="relative">
              <Input
                id="steamId"
                inputMode="numeric"
                placeholder="7656…"
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

            {isSteamIdLocked && (
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                {text.steamId.detected}
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
                {isSteamIdNotFound && !hasAccounts && (
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
            <KeyField
              id="apiKey"
              placeholder={text.key.placeholder}
              {...form.register('accountStep.apiKey')}
              onKeyDown={handleEnter}
            />
            <FieldError name="accountStep.apiKey" />
            <HelpList
              title={text.key.helpTitle}
              items={text.key.help}
              action={text.key.openPage}
              onAction={() => void SystemService.openExternal('apikey')}
            />
          </div>

          {problem && (
            <p role="alert" className="text-destructive">
              {problem}
            </p>
          )}

          {privacyProblem && (
            <div role="alert" className="space-y-2">
              <p className="text-destructive">{privacyProblem}</p>
              <HelpList
                open
                items={text.privacy.help}
                action={text.privacy.openSettings}
                onAction={() => void SystemService.openExternal('privacy')}
              />
            </div>
          )}

          {isFormOptional && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isVerifying}
                onClick={handleCloseForm}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isVerifying}
                onClick={handleVerify}
              >
                {verifyLabel}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={handleOpenForm}>
          <Plus />
          {t.accounts.addAnother}
        </Button>
      )}

      {hasAccounts && !isFormOpen && (
        <p className="text-muted-foreground mt-5">{t.onboarding.howItWorks}</p>
      )}

      <StepperFooter>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        ) : (
          <StepperPreviousButton disabled={isVerifying || isFinishing} />
        )}
        {isFormOpen && !isFormOptional ? (
          // The form is all there is to do here: verifying is the way forward.
          <StepperNextButton disabled={isVerifying} onClick={handleVerify}>
            {verifyLabel}
          </StepperNextButton>
        ) : (
          // With an account in, the setup can end. While one more is being
          // typed, its own "Verify" is the action and this one steps back.
          <Button
            type="submit"
            variant={isFormOpen ? 'secondary' : 'default'}
            disabled={isVerifying || isFinishing}
          >
            {isFinishing ? t.onboarding.finishing : t.onboarding.finish}
          </Button>
        )}
      </StepperFooter>
    </div>
  );
}
