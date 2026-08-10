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
    therapeuticArea?: string;
    phase: string;
    modality: string;
    indication: string;
    territory: string;
    // Extended inputs for full recalculation
    biomarker?: string;
    lineOfTherapy?: string;
    treatmentApproach?: string;
    combinationPotential?: string;
    competitivePosition?: string;
    dataQuality?: string;
    dealType?: string;
    regulatoryDesignations?: RegulatoryDesignationsInput;
    // Custom model assumptions (Pro feature)
    customAssumptions?: Record<string, unknown>;
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
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    // Handle localStorage access errors (private browsing, disabled, etc.)
    console.warn('Unable to access localStorage for history:', error);
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

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    // Handle quota exceeded or other storage errors
    console.warn('Unable to save to localStorage:', error);
    // Try to clear old items and retry
    try {
      const trimmedHistory = updatedHistory.slice(0, Math.floor(MAX_HISTORY_ITEMS / 2));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
    } catch {
      // Storage completely unavailable
      console.error('localStorage unavailable, history will not persist');
    }
  }

  return newItem;
}

export function markPDFGenerated(id: string): void {
  try {
    const history = getHistory();
    const updated = history.map(item =>
      item.id === id
        ? { ...item, hasPDF: true, pdfGeneratedAt: new Date().toISOString() }
        : item
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Unable to mark PDF as generated:', error);
  }
}

export function deleteHistoryItem(id: string): void {
  try {
    const history = getHistory();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Unable to delete history item:', error);
  }
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
  therapeuticArea: 'oncology' as const,
  biomarker: 'unselected' as const,
  lineOfTherapy: '2L' as const,
  treatmentApproach: 'symptomatic' as const,
  combinationPotential: 'some' as const,
  competitivePosition: 'racing' as const,
  dataQuality: 'promising' as const,
  dealType: 'licensing' as const,
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
      therapeuticArea: item.inputs.therapeuticArea ?? DEFAULT_EXTENDED_INPUTS.therapeuticArea,
      biomarker: item.inputs.biomarker ?? DEFAULT_EXTENDED_INPUTS.biomarker,
      lineOfTherapy: item.inputs.lineOfTherapy ?? DEFAULT_EXTENDED_INPUTS.lineOfTherapy,
      treatmentApproach: item.inputs.treatmentApproach ?? DEFAULT_EXTENDED_INPUTS.treatmentApproach,
      combinationPotential: item.inputs.combinationPotential ?? DEFAULT_EXTENDED_INPUTS.combinationPotential,
      competitivePosition: item.inputs.competitivePosition ?? DEFAULT_EXTENDED_INPUTS.competitivePosition,
      dataQuality: item.inputs.dataQuality ?? DEFAULT_EXTENDED_INPUTS.dataQuality,
      regulatoryDesignations: item.inputs.regulatoryDesignations ?? DEFAULT_EXTENDED_INPUTS.regulatoryDesignations,
    },
  };
}
