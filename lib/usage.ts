const STORAGE_KEY = 'deal_calculator_usage';
const FREE_TIER_LIMIT = Infinity; // Unlimited free calculations — gate output, not input

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
