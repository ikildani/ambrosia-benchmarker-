'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getHistory, CalculationHistoryItem } from '@/lib/history';

interface DatabaseCalculation {
  id: string;
  user_id: string | null;
  session_id: string | null;
  anonymous_id: string | null;
  modality: string;
  development_phase: string;
  indication_category: string | null;
  indication_specific: string | null;
  territory_scope: string | null;
  territories_included: string[] | null;
  exclusivity_type: string | null;
  deal_type: string | null;
  includes_manufacturing: boolean;
  includes_codev: boolean;
  includes_copromote: boolean;
  output_upfront_low: number | null;
  output_upfront_mid: number | null;
  output_upfront_high: number | null;
  output_milestones_total: number | null;
  output_royalty_low: number | null;
  output_royalty_high: number | null;
  output_total_deal_value_low: number | null;
  output_total_deal_value_high: number | null;
  calculation_version: string;
  created_at: string;
}

// Map modality codes to display labels
const MODALITY_LABELS: Record<string, string> = {
  smallMolecule: 'Small Molecule',
  adc: 'ADC',
  bispecific: 'Bispecific Antibody',
  car_t: 'CAR-T',
  radiopharm: 'Radiopharmaceutical',
  mrna: 'mRNA',
  gene_therapy: 'Gene Therapy',
  cell_therapy: 'Cell Therapy',
  monoclonal: 'Monoclonal Antibody',
  other: 'Other',
};

// Map phase codes to display labels
const PHASE_LABELS: Record<string, string> = {
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  approved: 'Approved',
};

// Map indication codes to display labels
const INDICATION_LABELS: Record<string, string> = {
  lung_nsclc: 'Lung Cancer (NSCLC)',
  lung_sclc: 'Lung Cancer (SCLC)',
  breast_her2: 'Breast Cancer (HER2+)',
  breast_tnbc: 'Breast Cancer (TNBC)',
  breast_hrpos: 'Breast Cancer (HR+)',
  colorectal: 'Colorectal Cancer',
  pancreatic: 'Pancreatic Cancer',
  gastric: 'Gastric Cancer',
  ovarian: 'Ovarian Cancer',
  prostate: 'Prostate Cancer',
  bladder: 'Bladder Cancer',
  renal: 'Renal Cell Carcinoma',
  melanoma: 'Melanoma',
  glioblastoma: 'Glioblastoma',
  aml: 'AML',
  all: 'ALL',
  cll: 'CLL',
  dlbcl: 'DLBCL',
  multiple_myeloma: 'Multiple Myeloma',
  solid_tumor_agnostic: 'Solid Tumor (Agnostic)',
  heme_other: 'Hematologic (Other)',
  rare_pediatric: 'Rare/Pediatric',
  other: 'Other',
};

function mapDatabaseToHistoryItem(calc: DatabaseCalculation): CalculationHistoryItem {
  const modalityLabel = MODALITY_LABELS[calc.modality] || calc.modality;
  const phaseLabel = PHASE_LABELS[calc.development_phase] || calc.development_phase;
  const indicationLabel = INDICATION_LABELS[calc.indication_specific || calc.indication_category || ''] ||
                          calc.indication_specific ||
                          calc.indication_category ||
                          'Not specified';

  return {
    id: calc.id,
    timestamp: calc.created_at,
    inputs: {
      phase: calc.development_phase,
      modality: calc.modality,
      indication: calc.indication_specific || calc.indication_category || '',
      territory: calc.territory_scope || 'global',
    },
    results: {
      upfrontLow: calc.output_upfront_low || 0,
      upfrontHigh: calc.output_upfront_high || 0,
      upfrontMedian: calc.output_upfront_mid || 0,
      totalValueLow: calc.output_total_deal_value_low || 0,
      totalValueHigh: calc.output_total_deal_value_high || 0,
      totalValueMedian: Math.round(
        ((calc.output_total_deal_value_low || 0) + (calc.output_total_deal_value_high || 0)) / 2
      ),
    },
    labels: {
      phase: phaseLabel,
      modality: modalityLabel,
      indication: indicationLabel,
    },
    hasPDF: false,
  };
}

interface UseCalculationHistoryResult {
  history: CalculationHistoryItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

export function useCalculationHistory(): UseCalculationHistoryResult {
  const { user, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      if (isAuthenticated && user?.id) {
        const response = await fetch(`/api/calculations?user_id=${encodeURIComponent(user.id)}&limit=50`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Failed to fetch calculation history');
        }

        const data = await response.json();
        const dbHistory = (data.calculations || []).map(mapDatabaseToHistoryItem);

        // Merge with localStorage to capture any calculations that failed to sync
        const localHistory = getHistory();
        const dbIds = new Set(dbHistory.map((h: CalculationHistoryItem) => h.id));
        const mergedHistory = [
          ...dbHistory,
          ...localHistory.filter(h => !dbIds.has(h.id)),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setHistory(mergedHistory);
      } else {
        // Fall back to localStorage for anonymous users
        setHistory(getHistory());
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Error fetching history:', err);
      setError('Failed to load calculation history');
      setHistory(getHistory());
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      if (isAuthenticated && user?.id) {
        // Delete from database
        const delController = new AbortController();
        setTimeout(() => delController.abort(), 15000);
        const response = await fetch(`/api/calculations?id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(user.id)}`, {
          method: 'DELETE',
          signal: delController.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to delete calculation');
        }
      }

      // Also remove from localStorage
      const localHistory = getHistory();
      const updatedLocal = localHistory.filter(h => h.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('calculation_history', JSON.stringify(updatedLocal));
      }

      // Update state
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error('Error deleting calculation:', err);
      throw err;
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    loading,
    error,
    refresh: fetchHistory,
    deleteItem,
  };
}
