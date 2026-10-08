import { safeSessionStorageGetItem } from '@app/lib/safeSessionStorageGetItem';

import { type OnboardingFormData } from './schema';

/** What survives a window reload. The Web API key is never part of it. */
export type OnboardingDraft = Partial<
  Pick<OnboardingFormData, 'languageStep' | 'accountStep'>
>;

const DRAFT_KEY = 'onboarding-form';
const STEP_KEY = 'onboarding-step';
const API_KEY_STEP = 2;

export function loadDraft(): OnboardingDraft | null {
  return safeSessionStorageGetItem<OnboardingDraft>(DRAFT_KEY);
}

export function saveDraft({ languageStep, accountStep }: OnboardingDraft) {
  sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ languageStep, accountStep }),
  );
}

/** After a reload the key is gone, so the form cannot resume past the key step. */
export function loadStep(): number {
  const saved = Number(sessionStorage.getItem(STEP_KEY) ?? 0);

  return Math.min(Number.isInteger(saved) ? saved : 0, API_KEY_STEP);
}

export function saveStep(step: number) {
  sessionStorage.setItem(STEP_KEY, String(step));
}

export function clearDraft() {
  sessionStorage.removeItem(DRAFT_KEY);
  sessionStorage.removeItem(STEP_KEY);
}
