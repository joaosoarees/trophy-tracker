import { useState } from 'react';

import { useT } from '@app/hooks/useT';
import { singleFlight } from '@app/lib/singleFlight';
import { AccountsService } from '@app/services/AccountsService';
import { useStore } from '@app/store';
import { type IAccount } from '@shared/types/Account';
import { API_KEY_PATTERN } from '@shared/validation';

export function useAccountDetailsController(account: IAccount) {
  const t = useT();
  const apply = useStore((state) => state.settings.apply);
  const removeAccount = useStore((state) => state.settings.removeAccount);

  // `null` until the user decides: a refused key is the one thing here that
  // needs doing, so its field is open, also when the key is refused with
  // this already on screen.
  const [isReplacingByChoice, setIsReplacingByChoice] = useState<
    boolean | null
  >(null);
  const isReplacing = isReplacingByChoice ?? account.status === 'rejected';
  const [key, setKey] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // One save at a time: Enter held down in the field asks again before the
  // button is drawn disabled.
  const [saveOnce] = useState(singleFlight);
  const [isChecking, setIsChecking] = useState(false);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);

  function handleToggleReplacing() {
    setIsReplacingByChoice(!isReplacing);
    setKey('');
    setProblem(null);
  }

  async function saveKey() {
    if (!API_KEY_PATTERN.test(key.trim())) {
      setProblem(t.validation.apiKeyFormat);
      return;
    }

    setIsSaving(true);
    setProblem(null);
    // A call that fails must not leave the button disabled for good.
    try {
      const result = await AccountsService.replaceKey(account.steamId, key);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      // The key is not kept here a moment longer than it takes to save it.
      setKey('');
      // Nor is the choice: a key refused again later opens the field again.
      setIsReplacingByChoice(null);
      apply(result.value);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRecheck() {
    setIsChecking(true);
    try {
      apply(await AccountsService.recheck(account.steamId));
    } finally {
      setIsChecking(false);
    }
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
    handleSaveKey: () => void saveOnce(saveKey),
    handleRecheck: () => void handleRecheck(),
    handleRemove,
  };
}
