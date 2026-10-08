import { safeSessionStorageGetItem } from '@app/lib/safeSessionStorageGetItem';

/** What survives a window reload. The Web API key is never part of it. */
export interface IOnboardingDraft {
  language?: string;
  steamId?: string;
}

const DRAFT_KEY = 'onboarding-form';
const STEP_KEY = 'onboarding-step';
/** The step that asks for the key. */
const ACCOUNT_STEP = 1;

export function loadDraft(): IOnboardingDraft | null {
  return safeSessionStorageGetItem<IOnboardingDraft>(DRAFT_KEY);
}

export function saveDraft(draft: IOnboardingDraft) {
  sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ language: draft.language, steamId: draft.steamId }),
  );
}

/** After a reload the key is gone, so the form cannot resume past the step that asks for it. */
export function loadStep(): number {
  const saved = Number(sessionStorage.getItem(STEP_KEY) ?? 0);

  return Math.min(Number.isInteger(saved) ? saved : 0, ACCOUNT_STEP);
}

export function saveStep(step: number) {
  sessionStorage.setItem(STEP_KEY, String(step));
}

export function clearDraft() {
  sessionStorage.removeItem(DRAFT_KEY);
  sessionStorage.removeItem(STEP_KEY);
}
