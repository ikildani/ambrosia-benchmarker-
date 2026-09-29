/**
 * AI spend mode. "lean" (the default until AI_BUDGET_MODE=full is set) keeps
 * every quality gate on its current model but trims bulk spend:
 *
 *   - deal extraction (SEC EDGAR, exchange filings): Opus 4.6 → Sonnet 5.
 *     The deal verifier stays on Opus, so every extracted deal is still
 *     checked against its source before it counts.
 *   - Perplexity discovery: runs twice a day instead of six times, and its
 *     extraction step uses Sonnet 5.
 *   - per-run caps: preclinical filings $1 (was $5), management intent $1.
 *
 * Unchanged in lean mode: deal verification (Opus), asset classification
 * (Sonnet 5, only spends when new assets arrive), the deal gate (Haiku), and
 * every free source. Set AI_BUDGET_MODE=full in Vercel to restore the old
 * behaviour; explicit env overrides (EXTRACTION_MODEL, *_COST_CAP_USD) still
 * win in either mode.
 */

export type AiBudgetMode = 'lean' | 'full';

export function aiBudgetMode(env: NodeJS.ProcessEnv = process.env): AiBudgetMode {
  return (env.AI_BUDGET_MODE ?? '').trim().toLowerCase() === 'full' ? 'full' : 'lean';
}

export const isLean = (env: NodeJS.ProcessEnv = process.env) => aiBudgetMode(env) === 'lean';

/** Explicit override, else the full or lean choice. */
export function budgetModel(override: string | undefined, full: string, lean: string, env: NodeJS.ProcessEnv = process.env): string {
  if (override && override.trim()) return override.trim();
  return isLean(env) ? lean : full;
}

/** Per-run dollar cap: the explicit env value or the full default, bounded by the lean cap in lean mode. */
export function budgetCap(envValue: string | undefined, fullDefault: number, leanCap: number, env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(envValue);
  const base = envValue !== undefined && envValue !== '' && Number.isFinite(parsed) ? parsed : fullDefault;
  return isLean(env) ? Math.min(base, leanCap) : base;
}

/** In lean mode, true when this invocation should be skipped (keeps only runs whose UTC hour is a multiple of everyHours). */
export function leanSkip(now: Date, everyHours: number, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isLean(env)) return false;
  return now.getUTCHours() % everyHours !== 0;
}

export const LEAN_EXTRACTION_MODEL = 'claude-sonnet-5';
export const FULL_EXTRACTION_MODEL = 'claude-opus-4-6';
