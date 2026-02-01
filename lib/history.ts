// Calculation history management

export interface CalculationHistoryItem {
  id: string;
  timestamp: string;
  inputs: {
    phase: string;
    modality: string;
    indication: string;
    territory: string;
  };
  results: {
    upfrontLow: number;
    upfrontHigh: number;
    upfrontMedian: number;
    totalValueLow: number;
    totalValueHigh: number;
    totalValueMedian: number;
  };
  labels: {
    phase: string;
    modality: string;
    indication: string;
  };
  hasPDF: boolean;
  pdfGeneratedAt?: string;
}

const HISTORY_KEY = 'calculation_history';
const MAX_HISTORY_ITEMS = 50;

export function getHistory(): CalculationHistoryItem[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addToHistory(item: Omit<CalculationHistoryItem, 'id' | 'timestamp'>): CalculationHistoryItem {
  const history = getHistory();
  const newItem: CalculationHistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

  return newItem;
}

export function markPDFGenerated(id: string): void {
  const history = getHistory();
  const updated = history.map(item =>
    item.id === id
      ? { ...item, hasPDF: true, pdfGeneratedAt: new Date().toISOString() }
      : item
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function deleteHistoryItem(id: string): void {
  const history = getHistory();
  const updated = history.filter(item => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value}M`;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
