import { useState } from 'react';

import { useT } from '@app/hooks/useT';
import { AccountsService } from '@app/services/AccountsService';
import { useStore } from '@app/store';
import { type IAccount } from '@shared/types/Account';
import { API_KEY_PATTERN } from '@shared/validation';

export function useAccountDetailsController(account: IAccount) {
  const t = useT();
  const apply = useStore((state) => state.settings.apply);
  const removeAccount = useStore((state) => state.settings.removeAccount);

  // A refused key is the one thing here that needs doing: its field is open.
  const [isReplacing, setIsReplacing] = useState(account.status === 'rejected');
  const [key, setKey] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);

  function handleToggleReplacing() {
    setIsReplacing((open) => !open);
    setKey('');
    setProblem(null);
  }

  async function handleSaveKey() {
    if (!API_KEY_PATTERN.test(key.trim())) {
      setProblem(t.validation.apiKeyFormat);
      return;
    }

    setIsSaving(true);
    setProblem(null);
    const result = await AccountsService.replaceKey(account.steamId, key);
    setIsSaving(false);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    // The key is not kept here a moment longer than it takes to save it.
    setKey('');
    setIsReplacing(false);
    apply(result.value);
  }

  async function handleRecheck() {
    setIsChecking(true);
    apply(await AccountsService.recheck(account.steamId));
    setIsChecking(false);
  }

  function handleRemove() {
    setIsConfirmingRemoval(false);
    void removeAccount(account.steamId);
  }

  return {
    isReplacing,
    key,
    problem,
    isSaving,
    isChecking,
    isConfirmingRemoval,
    setKey,
    setIsConfirmingRemoval,
    handleToggleReplacing,
    handleSaveKey: () => void handleSaveKey(),
    handleRecheck: () => void handleRecheck(),
    handleRemove,
  };
}
