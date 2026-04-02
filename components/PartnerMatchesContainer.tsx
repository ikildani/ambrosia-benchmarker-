'use client';

import { useState, useEffect, useCallback } from 'react';
import { PartnerMatches } from './benchmarker/PartnerMatches';
import { useTracking } from './TrackingProvider';
import { useAuth } from '@/contexts/AuthContext';
import { captureClientError } from '@/lib/sentry-client';

export interface PartnerMatchForPDF {
  company_name: string;
  match_score: number;
  match_reasons: { reason: string; strength: string }[];
  deals_last_12mo: number;
  hq_country: string | null;
  strategic_context?: {
    patent_cliffs: { drug_name: string; indication: string | null; revenue_usd: number; expiry_year: number }[];
    revenue_at_risk: { year: number; amount: number }[];
    pipeline_gaps: string[];
    strategic_priorities: string[];
  } | null;
}

interface PartnerMatchesContainerProps {
  // Calculation inputs for matching
  modality: string;
  phase: string;
  indicationCategory: string | null;
  indicationSpecific: string | null;
  territory: string;
  therapeuticArea?: string;
  regulatoryDesignations?: {
    breakthrough?: boolean;
    fastTrack?: boolean;
    orphan?: boolean;
    prime?: boolean;
  };

  // User context
  tier: 'free' | 'pro' | 'report';
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
  therapeuticArea,
  regulatoryDesignations,
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
  const [serverTier, setServerTier] = useState<'free' | 'pro' | 'report'>(tier);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculationId, setCalculationId] = useState<string | undefined>();
  const [filterDealType, setFilterDealType] = useState<string>('all');
  const [filterTerritory, setFilterTerritory] = useState<string>('all');

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
          therapeutic_area: therapeuticArea,
          regulatory_designations: regulatoryDesignations,
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
      // Use server-verified tier (source of truth) for UI decisions
      if (data.user_tier) {
        setServerTier(data.user_tier);
      }

      // Notify parent of loaded matches for PDF export and Market Urgency
      if (onMatchesLoaded && fetchedMatches.length > 0) {
        onMatchesLoaded(fetchedMatches.map((m: any) => ({
          company_name: m.company_name,
          match_score: m.match_score,
          match_reasons: m.match_reasons || [],
          deals_last_12mo: m.deals_last_12mo || 0,
          hq_country: m.hq_country,
          strategic_context: m.strategic_context || null,
          pharma_intent: m.pharma_intent || null,
        })));
      }
    } catch (err) {
      captureClientError(err, 'PartnerMatchesContainer', { context: 'Partner matching error' });
      setError('Unable to find partner matches. Please try again.');
    }

    setLoading(false);
  }, [modality, phase, indicationCategory, indicationSpecific, territory, regulatoryDesignations, userId, sessionId, anonymousId, user?.email]);

  useEffect(() => {
    if (modality && phase) {
      fetchMatches();
    }
  }, [fetchMatches, modality, phase]);

  if (loading) {
    return (
      <div className="mt-8 border-t border-neutral-200 dark:border-slate-700 pt-8" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
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

  // Filter matches client-side based on user filter selections
  const filteredMatches = matches.filter((m: any) => {
    if (filterDealType !== 'all') {
      const reasons = (m.match_reasons || []).map((r: any) => r.reason?.toLowerCase() || '');
      const reasonsText = reasons.join(' ');
      if (filterDealType === 'licensing' && !reasonsText.includes('licens')) return false;
      if (filterDealType === 'acquisition' && !reasonsText.includes('acqui')) return false;
      if (filterDealType === 'collaboration' && !reasonsText.includes('collab') && !reasonsText.includes('co-develop')) return false;
    }
    if (filterTerritory !== 'all' && m.hq_country) {
      if (filterTerritory === 'us' && m.hq_country !== 'US' && m.hq_country !== 'United States') return false;
      if (filterTerritory === 'eu' && !['Germany', 'France', 'UK', 'United Kingdom', 'Switzerland', 'Denmark', 'Netherlands', 'Sweden', 'Belgium', 'Italy', 'Spain', 'Ireland', 'Austria', 'Finland', 'Norway'].includes(m.hq_country)) return false;
      if (filterTerritory === 'japan' && m.hq_country !== 'Japan' && m.hq_country !== 'JP') return false;
      if (filterTerritory === 'asia' && !['Japan', 'JP', 'China', 'CN', 'South Korea', 'KR', 'India', 'IN', 'Taiwan', 'TW', 'Singapore', 'SG'].includes(m.hq_country)) return false;
    }
    return true;
  });

  // Build user asset context for outreach generation
  const userAsset = {
    modality: mapModality(modality),
    phase: mapPhase(phase),
    indication_category: indicationCategory,
    indication_specific: indicationSpecific,
    territory: mapTerritory(territory),
  };

  return (
    <div>
      {/* Partner Filter Controls */}
      <div className="mt-8 border-t border-neutral-200 dark:border-slate-700 pt-6 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
          {/* Deal Type Filter — pill buttons */}
          {[
            { value: 'all', label: 'All Types' },
            { value: 'licensing', label: 'Licensing' },
            { value: 'acquisition', label: 'Acquisition' },
            { value: 'collaboration', label: 'Collaboration' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterDealType(opt.value)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all ${
                filterDealType === opt.value
                  ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/20'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          {/* Territory Filter — pill buttons */}
          {[
            { value: 'all', label: 'Global' },
            { value: 'us', label: 'US' },
            { value: 'eu', label: 'Europe' },
            { value: 'japan', label: 'Japan' },
            { value: 'asia', label: 'APAC' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterTerritory(opt.value)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all ${
                filterTerritory === opt.value
                  ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {(filterDealType !== 'all' || filterTerritory !== 'all') && (
            <button
              onClick={() => { setFilterDealType('all'); setFilterTerritory('all'); }}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
            >
              Clear filters
            </button>
          )}
          {(filterDealType !== 'all' || filterTerritory !== 'all') && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {filteredMatches.length} of {matches.length} partners
            </span>
          )}
        </div>
      </div>
      <PartnerMatches
        calculationId={calculationId}
        sessionId={sessionId}
        anonymousId={anonymousId}
        userId={userId}
        userEmail={user?.email}
        matches={filteredMatches}
        totalMatches={totalMatches}
        matchesShown={filteredMatches.length}
        userTier={serverTier}
        upgradeCta={upgradeCta}
        advisoryCta={advisoryCta}
        onUpgradeClick={onUpgrade}
        userAsset={userAsset}
        therapeuticArea={therapeuticArea}
      />
    </div>
  );
}

// Map frontend values to backend enum values
function mapModality(modality: string): string {
  const map: Record<string, string> = {
    // Core oncology modalities
    smallMolecule: 'small_molecule',
    protac: 'small_molecule',          // PROTACs are small molecule degraders
    molecularGlue: 'small_molecule',   // molecular glues are small molecule degraders
    antibody: 'antibody',
    mab: 'antibody',                   // monoclonal antibody
    adc: 'adc',
    bispecific: 'bispecific',
    tCellEngager: 'bispecific',        // T-cell engagers are bispecific-adjacent
    carT: 'car_t',
    carT_heme: 'car_t',               // CAR-T hematologic
    carT_solid: 'car_t',              // CAR-T solid tumor
    cellTherapy: 'cell_therapy',
    geneTherapy: 'gene_therapy',
    mrna: 'mrna',
    rnai: 'rnai',                      // RNAi / siRNA
    peptide: 'peptide',
    oligonucleotide: 'oligonucleotide',
    therapeuticVaccine: 'vaccine',      // non-mRNA therapeutic vaccine
    radiopharm: 'radiopharm',
    radiopharmaceutical: 'radiopharm',  // alternate frontend key
    oncolyticVirus: 'other',           // oncolytic virus
    other: 'other',
    // Neurology-specific
    aso: 'aso',
    bbbPlatform: 'bbb_platform',
    tauTargeting: 'tau_targeting',
    ionChannel: 'ion_channel',
    psychedelic: 'psychedelic',
    stemCell: 'stem_cell',
    // Immunology-specific
    carT_autoimmune: 'car_t',
    tl1aInhibitor: 'antibody',
    jak_tyk2Inhibitor: 'small_molecule',
    jakInhibitor: 'small_molecule',    // JAK / TYK2 inhibitor
    s1pModulator: 'small_molecule',    // S1P receptor modulator
    oralIntegrin: 'small_molecule',    // oral integrin inhibitor
    ilInhibitor: 'antibody',
    fcrnAntagonist: 'antibody',        // FcRn antagonist
    dualAntagonist: 'antibody',        // dual BAFF/APRIL antagonist
    complementInhibitor: 'antibody',   // complement inhibitor
    complement: 'antibody',
    sphingosine: 'small_molecule',
    btk_degrader: 'small_molecule',
    inVivoCarT: 'car_t',              // in vivo CAR-T (LNP)
    carTreg: 'cell_therapy',           // CAR-Treg / tolerizing
    // Metabolic-specific
    glp1Agonist: 'peptide',
    dualIncretin: 'peptide',
    tripleIncretin: 'peptide',
    oralPeptide: 'peptide',
    amylinAnalog: 'peptide',
    sglt2Inhibitor: 'small_molecule',
    antiActivin: 'antibody',
    microbiomeBased: 'other',
    // Cardiovascular-specific
    myosinInhibitor: 'small_molecule',     // cardiac myosin inhibitor
    anticoagulantNovel: 'small_molecule',  // novel anticoagulant (FXI/FXII)
    pcsk9Targeting: 'antibody',            // PCSK9-targeting (mAb/siRNA)
    rnaCardio: 'rnai',                     // RNA therapeutics for cardiovascular
    // Infectious disease-specific
    antiviral: 'small_molecule',           // small molecule antiviral
    antibioticNovel: 'small_molecule',     // novel antibiotic
    vaccinePreventive: 'vaccine',          // preventive vaccine (non-mRNA)
    phageTherapy: 'other',                // bacteriophage therapy
    // Ophthalmology-specific
    antiVegf: 'antibody',                 // anti-VEGF antibody/fragment
    topicalOphthalmic: 'small_molecule',  // topical eye drop
    intravitreal: 'other',               // intravitreal implant / depot
    geneTherapyOcular: 'gene_therapy',   // ocular gene therapy (AAV)
    // Women's health-specific
    gnrhAntagonist: 'small_molecule',     // GnRH antagonist (oral)
    hormoneTherapy: 'small_molecule',     // hormone therapy / HRT
    neuroactiveSteroid: 'small_molecule', // neuroactive steroid
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
