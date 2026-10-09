import { useT } from '@app/hooks/useT';
import { type IAccount } from '@shared/types/Account';
import { Notice } from '@ui/components/Notice';
import { Button } from '@ui/primitives/button';

interface IKeyTroubleNoticeProps {
  /** The account in use, whose key Steam refused or is limiting. */
  account: IAccount;
  /** Leads to where the key is replaced. */
  onFix: () => void;
}

/**
 * Said over the Game and the Dashboard when the key of the account in use
 * stops working: what is on screen stays, and this says why it is no longer
 * being updated and where to fix it. The key itself is never named.
 */
export function KeyTroubleNotice({ account, onFix }: IKeyTroubleNoticeProps) {
  const t = useT();
  const name = account.name || account.steamId;
  const isRefused = account.status === 'rejected';

  return (
    <div className="px-4 pt-3">
      <Notice
        tone={isRefused ? 'problem' : 'info'}
        title={
          isRefused ? t.accounts.keyRefused(name) : t.accounts.keyLimited(name)
        }
        description={
          isRefused ? t.accounts.keyRefusedHint : t.accounts.keyLimitedHint
        }
      >
        {isRefused && (
          <Button size="sm" variant="secondary" onClick={onFix}>
            {t.accounts.replaceKey}
          </Button>
        )}
      </Notice>
    </div>
  );
}
