const STORAGE_KEY = 'deal_calculator_usage';
const FREE_TIER_LIMIT = 3;

interface UsageData {
  count: number;
  month: string;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getUsage(): UsageData {
  if (typeof window === 'undefined') {
    return { count: 0, month: getCurrentMonth() };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { count: 0, month: getCurrentMonth() };
    }

    const data: UsageData = JSON.parse(stored);
    const currentMonth = getCurrentMonth();

    // Reset if month has changed
    if (data.month !== currentMonth) {
      const newData = { count: 0, month: currentMonth };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      return newData;
    }

    return data;
  } catch {
    return { count: 0, month: getCurrentMonth() };
  }
}

export function setUsageCount(count: number): UsageData {
  if (typeof window === 'undefined') {
    return { count: 0, month: getCurrentMonth() };
  }

  const newUsage = { count, month: getCurrentMonth() };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUsage));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }

  return newUsage;
}

export function incrementUsage(): UsageData {
  if (typeof window === 'undefined') {
    return { count: 0, month: getCurrentMonth() };
  }

  const usage = getUsage();
  const newUsage = { ...usage, count: usage.count + 1 };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUsage));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }

  return newUsage;
}

export function canUseCalculator(tier: 'free' | 'pro'): boolean {
  if (tier === 'pro') {
    return true;
  }

  const usage = getUsage();
  return usage.count < FREE_TIER_LIMIT;
}

export function getRemainingUses(tier: 'free' | 'pro'): number {
  if (tier === 'pro') {
    return Infinity;
  }

  const usage = getUsage();
  return Math.max(0, FREE_TIER_LIMIT - usage.count);
}

export function resetUsage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}

// Sync usage from database for authenticated users
export async function syncUsageFromDatabase(userId: string): Promise<UsageData> {
  if (typeof window === 'undefined') {
    return { count: 0, month: getCurrentMonth() };
  }

  try {
    const response = await fetch(`/api/calculations?user_id=${encodeURIComponent(userId)}&count=true&month=true`);

    if (!response.ok) {
      console.error('Failed to sync usage from database');
      return getUsage(); // Fall back to localStorage
    }

    const data = await response.json();
    const count = data.count || 0;

    // Update localStorage with database count
    const newUsage = { count, month: getCurrentMonth() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUsage));

    return newUsage;
  } catch (error) {
    console.error('Error syncing usage from database:', error);
    return getUsage(); // Fall back to localStorage
  }
}

export const FREE_LIMIT = FREE_TIER_LIMIT;

const POWER_CALC_KEY = 'deal_calculator_power_used';

export function hasPowerCalcBeenUsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(POWER_CALC_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markPowerCalcUsed(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POWER_CALC_KEY, 'true');
  } catch {
    // Silently fail
  }
}

// ── Server-side usage tracking ──────────────────────────────────────────────

export interface ServerUsageResult {
  allowed: boolean;
  remaining: number;
  total: number;
  limit: number;
  tier: string;
}

/**
 * Check server-side usage status.
 * This is the source of truth -- localStorage is only a fast cache.
 */
export async function checkServerUsage(): Promise<ServerUsageResult> {
  try {
    const response = await fetch('/api/usage/calc');
    if (!response.ok) {
      throw new Error('Failed to check server usage');
    }
    const data = await response.json();
    return {
      allowed: data.allowed ?? true,
      remaining: data.remaining ?? FREE_TIER_LIMIT,
      total: data.total ?? 0,
      limit: data.limit ?? FREE_TIER_LIMIT,
      tier: data.tier ?? 'free',
    };
  } catch (error) {
    console.error('Server usage check failed, falling back to localStorage:', error);
    // Fall back to localStorage on network error
    const usage = getUsage();
    return {
      allowed: usage.count < FREE_TIER_LIMIT,
      remaining: Math.max(0, FREE_TIER_LIMIT - usage.count),
      total: usage.count,
      limit: FREE_TIER_LIMIT,
      tier: 'free',
    };
  }
}

/**
 * Increment usage on the server and update localStorage cache.
 * Returns the updated usage status from the server.
 */
export async function incrementServerUsage(): Promise<ServerUsageResult> {
  try {
    const response = await fetch('/api/usage/calc', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Failed to increment server usage');
    }
    const data = await response.json();
    const result: ServerUsageResult = {
      allowed: data.allowed ?? true,
      remaining: data.remaining ?? 0,
      total: data.total ?? 0,
      limit: data.limit ?? FREE_TIER_LIMIT,
      tier: data.tier ?? 'free',
    };

    // Sync localStorage cache with server state
    try {
      const newUsage = { count: result.total, month: getCurrentMonth() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUsage));
      // Also mark power calc as used if count >= 1
      if (result.total >= 1) {
        localStorage.setItem(POWER_CALC_KEY, 'true');
      }
    } catch {
      // localStorage unavailable
    }

    return result;
  } catch (error) {
    console.error('Server usage increment failed, falling back to localStorage:', error);
    // Fall back to localStorage
    const usage = incrementUsage();
    markPowerCalcUsed();
    return {
      allowed: usage.count < FREE_TIER_LIMIT,
      remaining: Math.max(0, FREE_TIER_LIMIT - usage.count),
      total: usage.count,
      limit: FREE_TIER_LIMIT,
      tier: 'free',
    };
  }
}

/**
 * Check server-side power calc status.
 * Returns true if this is the user's first-ever calculation (power calc available).
 */
export async function checkPowerCalcAvailable(): Promise<boolean> {
  try {
    const result = await checkServerUsage();
    // Power calc is available when the user has 0 calculations
    return result.total === 0;
  } catch {
    // Fall back to localStorage
    return !hasPowerCalcBeenUsed();
  }
}
