import { useId } from 'react';

import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { type IAccount } from '@shared/types/Account';
import { Collapsible } from '@ui/components/Collapsible';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
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
 * What opens inside the card of the account in use: its key, always masked,
 * and the two things that can be done to the account. Replacing the key is
 * the way to fix one Steam refused.
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
    // On the field colour, inside the card: a well that holds the key and its
    // actions, and on which the red of "Remove" keeps its contrast.
    <div className="bg-background rounded-b-[7px] border-t px-3 py-2.5">
      {/* The key on its line, what can be done under it: the same in every language and width. */}
      <div className="flex flex-col gap-2">
        <p className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">
            {t.accounts.key}
          </span>
          <span className="flex flex-wrap items-center gap-x-2">
            {account.keyEnding && <MaskedKey ending={account.keyEnding} />}
            {account.checkedAt !== null && (
              <small className="text-muted-foreground text-xs">
                {t.accounts.checkedOn(
                  formatDate(account.checkedAt / 1000, locale),
                )}
              </small>
            )}
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setIsConfirmingRemoval(true)}
          >
            {t.accounts.remove}
          </Button>
        </div>
      </div>

      <Collapsible open={isReplacing}>
        <div className="space-y-2 pt-3 pb-0.5">
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

      <ConfirmDialog
        open={isConfirmingRemoval}
        onOpenChange={setIsConfirmingRemoval}
        title={t.accounts.removeTitle(name)}
        description={t.accounts.removeDescription(name)}
        confirmLabel={t.accounts.removeConfirm}
        onConfirm={handleRemove}
      />
    </div>
  );
}
