// Calculation history management

export interface RegulatoryDesignationsInput {
  breakthrough: boolean;
  fastTrack: boolean;
  orphan: boolean;
  prime: boolean;
}

export interface CalculationHistoryItem {
  id: string;
  timestamp: string;
  inputs: {
    phase: string;
    modality: string;
    indication: string;
    territory: string;
    // Extended inputs for full recalculation
    biomarker?: string;
    lineOfTherapy?: string;
    combinationPotential?: string;
    competitivePosition?: string;
    dataQuality?: string;
    regulatoryDesignations?: RegulatoryDesignationsInput;
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

// Default values for legacy history items missing extended inputs
export const DEFAULT_EXTENDED_INPUTS = {
  biomarker: 'unselected' as const,
  lineOfTherapy: '2L' as const,
  combinationPotential: 'some' as const,
  competitivePosition: 'racing' as const,
  dataQuality: 'promising' as const,
  regulatoryDesignations: {
    breakthrough: false,
    fastTrack: false,
    orphan: false,
    prime: false,
  },
};

// Get history item with defaults applied for legacy items
export function getHistoryItemWithDefaults(item: CalculationHistoryItem): CalculationHistoryItem {
  return {
    ...item,
    inputs: {
      ...item.inputs,
      biomarker: item.inputs.biomarker ?? DEFAULT_EXTENDED_INPUTS.biomarker,
      lineOfTherapy: item.inputs.lineOfTherapy ?? DEFAULT_EXTENDED_INPUTS.lineOfTherapy,
      combinationPotential: item.inputs.combinationPotential ?? DEFAULT_EXTENDED_INPUTS.combinationPotential,
      competitivePosition: item.inputs.competitivePosition ?? DEFAULT_EXTENDED_INPUTS.competitivePosition,
      dataQuality: item.inputs.dataQuality ?? DEFAULT_EXTENDED_INPUTS.dataQuality,
      regulatoryDesignations: item.inputs.regulatoryDesignations ?? DEFAULT_EXTENDED_INPUTS.regulatoryDesignations,
    },
  };
}
