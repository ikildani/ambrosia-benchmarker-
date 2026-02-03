'use client';

import { useState, useEffect, useCallback } from 'react';
import { PartnerMatches } from './benchmarker/PartnerMatches';
import { useTracking } from './TrackingProvider';
import { useAuth } from '@/contexts/AuthContext';

export interface PartnerMatchForPDF {
  company_name: string;
  match_score: number;
  match_reasons: { reason: string; strength: string }[];
  deals_last_12mo: number;
  hq_country: string | null;
}

interface PartnerMatchesContainerProps {
  // Calculation inputs for matching
  modality: string;
  phase: string;
  indicationCategory: string | null;
  indicationSpecific: string | null;
  territory: string;

  // User context
  tier: 'free' | 'pro';
  onUpgrade: () => void;

  // Callback when matches are loaded (for PDF export)
  onMatchesLoaded?: (matches: PartnerMatchForPDF[]) => void;
}

export default function PartnerMatchesContainer({
  modality,
  phase,
  indicationCategory,
  indicationSpecific,
  territory,
  tier,
  onUpgrade,
  onMatchesLoaded,
}: PartnerMatchesContainerProps) {
  const { sessionId, anonymousId, userId } = useTracking();
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [matchesShown, setMatchesShown] = useState(0);
  const [upgradeCta, setUpgradeCta] = useState<any>(null);
  const [advisoryCta, setAdvisoryCta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculationId, setCalculationId] = useState<string | undefined>();

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/partners/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_email: user?.email, // Pass email for Pro verification
          session_id: sessionId,
          anonymous_id: anonymousId,
          modality: mapModality(modality),
          development_phase: mapPhase(phase),
          indication_category: indicationCategory,
          indication_specific: indicationSpecific,
          territory_scope: mapTerritory(territory),
          tier: tier, // Pass tier from frontend as fallback
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch partner matches');
      }

      const data = await res.json();
      const fetchedMatches = data.matches || [];
      setMatches(fetchedMatches);
      setTotalMatches(data.total_matches || 0);
      setMatchesShown(data.matches_shown || 0);
      setUpgradeCta(data.upgrade_cta || null);
      setAdvisoryCta(data.advisory_cta || null);
      setCalculationId(data.calculation_id);

      // Notify parent of loaded matches for PDF export
      if (onMatchesLoaded && fetchedMatches.length > 0) {
        onMatchesLoaded(fetchedMatches.map((m: any) => ({
          company_name: m.company_name,
          match_score: m.match_score,
          match_reasons: m.match_reasons || [],
          deals_last_12mo: m.deals_last_12mo || 0,
          hq_country: m.hq_country,
        })));
      }
    } catch (err) {
      console.error('Partner matching error:', err);
      setError('Unable to find partner matches. Please try again.');
    }

    setLoading(false);
  }, [modality, phase, indicationCategory, indicationSpecific, territory, userId, sessionId, anonymousId, user?.email]);

  useEffect(() => {
    if (modality && phase) {
      fetchMatches();
    }
  }, [fetchMatches, modality, phase]);

  if (loading) {
    return (
      <div className="mt-8 border-t border-neutral-200 dark:border-slate-700 pt-8">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-neutral-600 dark:text-slate-300">Finding potential partners...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 border-t border-neutral-200 dark:border-slate-700 pt-8">
        <div className="p-4 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchMatches}
            className="mt-2 text-sm text-red-700 dark:text-red-400 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (matches.length === 0 && !loading) {
    return (
      <div className="mt-8 border-t border-neutral-200 dark:border-slate-700 pt-8">
        <div className="p-4 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl">
          <p className="text-sm text-neutral-600 dark:text-slate-300">
            No partner matches found for this asset profile. Try adjusting the modality or indication.
          </p>
        </div>
      </div>
    );
  }

  // Build user asset context for outreach generation
  const userAsset = {
    modality: mapModality(modality),
    phase: mapPhase(phase),
    indication_category: indicationCategory,
    indication_specific: indicationSpecific,
    territory: mapTerritory(territory),
  };

  return (
    <PartnerMatches
      calculationId={calculationId}
      sessionId={sessionId}
      anonymousId={anonymousId}
      userId={userId}
      userEmail={user?.email}
      matches={matches}
      totalMatches={totalMatches}
      matchesShown={matchesShown}
      userTier={tier}
      upgradeCta={upgradeCta}
      advisoryCta={advisoryCta}
      onUpgradeClick={onUpgrade}
      userAsset={userAsset}
    />
  );
}

// Map frontend values to backend enum values
function mapModality(modality: string): string {
  const map: Record<string, string> = {
    smallMolecule: 'small_molecule',
    antibody: 'antibody',
    adc: 'adc',
    bispecific: 'bispecific',
    carT: 'car_t',
    cellTherapy: 'cell_therapy',
    geneTherapy: 'gene_therapy',
    mrna: 'mrna',
    peptide: 'peptide',
    oligonucleotide: 'oligonucleotide',
    radiopharm: 'radiopharm',
    other: 'other',
  };
  return map[modality] || modality;
}

function mapPhase(phase: string): string {
  const map: Record<string, string> = {
    discovery: 'discovery',
    preclinical: 'preclinical',
    phase1: 'phase_1',
    phase2: 'phase_2',
    phase3: 'phase_3',
    approved: 'approved',
  };
  return map[phase] || phase;
}

function mapTerritory(territory: string): string {
  const map: Record<string, string> = {
    global: 'global',
    us: 'us',
    exUs: 'ex_us',
    china: 'china',
    japan: 'japan',
    eu: 'eu',
    row: 'row',
  };
  return map[territory] || territory;
}
