import { useId } from 'react';

import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { type IAccount } from '@shared/types/Account';
import { AccountStatus } from '@ui/components/AccountStatus';
import { Collapsible } from '@ui/components/Collapsible';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { DetailRow } from '@ui/components/DetailList';
import { KeyField } from '@ui/components/KeyField';
import { MaskedKey } from '@ui/components/MaskedKey';
import { Button } from '@ui/primitives/button';
import { Label } from '@ui/primitives/label';
import { formatDate } from '@ui/utils/format';

import { useAccountDetailsController } from './useAccountDetailsController';

interface IAccountDetailsProps {
  account: IAccount;
}

/**
 * The account in use, under the grid: who it is, what is known about its
 * key, and the two things that can be done to it. The key is only ever shown
 * masked; replacing it is the way to fix one Steam refused.
 */
export function AccountDetails({ account }: IAccountDetailsProps) {
  const t = useT();
  const locale = useLocale();
  const keyId = useId();
  const {
    isReplacing,
    key,
    problem,
    isSaving,
    isChecking,
    isConfirmingRemoval,
    setKey,
    setIsConfirmingRemoval,
    handleToggleReplacing,
    handleSaveKey,
    handleRecheck,
    handleRemove,
  } = useAccountDetailsController(account);
  const name = account.name || account.steamId;

  return (
    <>
      <DetailRow
        label={<strong className="font-semibold">{name}</strong>}
        description={
          <span className="tabular-nums">
            {t.settings.steamId(account.steamId)}
          </span>
        }
      >
        <AccountStatus status={account.status} />
      </DetailRow>

      <li>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span>{t.accounts.key}</span>
            <small className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
              {account.keyEnding && <MaskedKey ending={account.keyEnding} />}
              {account.checkedAt !== null && (
                <span>
                  {t.accounts.checkedOn(
                    formatDate(account.checkedAt / 1000, locale),
                  )}
                </span>
              )}
            </small>
          </span>
          <span className="flex flex-none items-center gap-2">
            {account.status !== 'valid' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={isChecking}
                onClick={handleRecheck}
              >
                {t.accounts.recheck}
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              aria-expanded={isReplacing}
              onClick={handleToggleReplacing}
            >
              {t.accounts.replaceKey}
            </Button>
          </span>
        </div>

        <Collapsible open={isReplacing}>
          <div className="space-y-2 px-2 pb-3">
            <Label htmlFor={keyId}>{t.accounts.newKey}</Label>
            <KeyField
              id={keyId}
              value={key}
              aria-invalid={problem !== null}
              placeholder={t.onboarding.account.key.placeholder}
              onChange={(event) => setKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSaveKey();
              }}
            />
            {problem && (
              <p role="alert" className="text-destructive text-xs">
                {problem}
              </p>
            )}
            <div className="flex justify-end">
              <Button size="sm" disabled={isSaving} onClick={handleSaveKey}>
                {isSaving ? t.onboarding.account.verifying : t.accounts.saveKey}
              </Button>
            </div>
          </div>
        </Collapsible>
      </li>

      <DetailRow label={t.accounts.remove}>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setIsConfirmingRemoval(true)}
        >
          {t.accounts.removeConfirm}
        </Button>
      </DetailRow>

      <ConfirmDialog
        open={isConfirmingRemoval}
        onOpenChange={setIsConfirmingRemoval}
        title={t.accounts.removeTitle(name)}
        description={t.accounts.removeDescription(name)}
        confirmLabel={t.accounts.removeConfirm}
        onConfirm={handleRemove}
      />
    </>
  );
}
