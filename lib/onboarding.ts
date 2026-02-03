const STORAGE_KEY = 'deal_calculator_onboarding';
const CURRENT_VERSION = 1;

interface OnboardingState {
  completed: boolean;
  skipped: boolean;
  completedAt?: string;
  skippedAt?: string;
  version: number;
}

function getOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') {
    return { completed: false, skipped: false, version: CURRENT_VERSION };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { completed: false, skipped: false, version: CURRENT_VERSION };
    }

    const state: OnboardingState = JSON.parse(stored);

    // If version is outdated, show onboarding again
    if (state.version < CURRENT_VERSION) {
      return { completed: false, skipped: false, version: CURRENT_VERSION };
    }

    return state;
  } catch {
    return { completed: false, skipped: false, version: CURRENT_VERSION };
  }
}

export function shouldShowOnboarding(): boolean {
  const state = getOnboardingState();
  return !state.completed && !state.skipped;
}

export function markOnboardingComplete(): void {
  if (typeof window === 'undefined') return;

  const state: OnboardingState = {
    completed: true,
    skipped: false,
    completedAt: new Date().toISOString(),
    version: CURRENT_VERSION,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail if localStorage unavailable
  }
}

export function markOnboardingSkipped(): void {
  if (typeof window === 'undefined') return;

  const state: OnboardingState = {
    completed: false,
    skipped: true,
    skippedAt: new Date().toISOString(),
    version: CURRENT_VERSION,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail
  }
}

export function resetOnboarding(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}
