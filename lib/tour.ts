// ---------------------------------------------------------------------------
// Results Tour — state management
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ambrosia_results_tour';
const TOUR_VERSION = 1;

interface TourState {
  version: number;
  completed: boolean;
  skipped: boolean;
  completedAt?: string;
  skippedAt?: string;
  lastStepSeen?: number;
}

function getState(): TourState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: TourState = JSON.parse(raw);
    // If version mismatch, treat as fresh (allows re-showing on upgrades)
    if (parsed.version !== TOUR_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setState(patch: Partial<TourState>) {
  if (typeof window === 'undefined') return;
  const current = getState() ?? { version: TOUR_VERSION, completed: false, skipped: false };
  const next: TourState = { ...current, ...patch, version: TOUR_VERSION };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — silent fail
  }
}

/**
 * Returns true when the results tour should auto-launch.
 * Conditions:
 *  - User has not completed the tour
 *  - User has not previously skipped it
 */
export function shouldShowResultsTour(): boolean {
  const state = getState();
  if (!state) return true; // Never seen — show it
  return !state.completed && !state.skipped;
}

/**
 * Persist that the user completed the tour.
 */
export function markTourComplete(lastStep?: number) {
  setState({
    completed: true,
    completedAt: new Date().toISOString(),
    lastStepSeen: lastStep,
  });
}

/**
 * Persist that the user explicitly skipped the tour.
 */
export function markTourSkipped(lastStep?: number) {
  setState({
    skipped: true,
    skippedAt: new Date().toISOString(),
    lastStepSeen: lastStep,
  });
}

/**
 * Save progress (the last step the user viewed) without marking complete/skipped.
 */
export function saveTourProgress(step: number) {
  setState({ lastStepSeen: step });
}

/**
 * Clear tour state — useful for debugging or re-showing the tour.
 */
export function resetTour() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
