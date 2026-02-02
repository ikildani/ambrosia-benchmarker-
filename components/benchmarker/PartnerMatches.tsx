'use client';

import { useState, useCallback } from 'react';
import {
  Lock,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Building2,
  TrendingUp,
  FlaskConical,
  Calendar,
  Target,
  Globe,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface MatchReason {
  category: string;
  reason: string;
  strength: 'strong' | 'moderate' | 'weak';
}

interface PartnerMatch {
  rank: number;
  company_id: string;
  company_name: string;
  company_type: string | null;
  ticker?: string | null;
  hq_country?: string | null;
  match_score: number;
  match_reasons: MatchReason[] | null;
  modalities_active: string[] | null;
  modalities_primary?: string[] | null;
  indications_active: string[] | null;
  indications_specific?: string[] | null;
  deals_last_12mo: number | null;
  deals_last_24mo?: number | null;
  last_deal_date: string | null;
  last_deal_modality?: string | null;
  active_trials_count: number | null;
  avg_upfront_usd: number | null;
  median_upfront_usd?: number | null;
  phase_preference_min?: string | null;
  phase_preference_max?: string | null;
  acquisition_appetite?: string | null;
  data_quality_score?: number;
  profile_locked: boolean;
}

interface UpgradeCTA {
  type: string;
  message: string;
  remaining_hidden: number;
  features: string[];
}

interface AdvisoryCTA {
  message: string;
  cta_text: string;
  cta_url: string;
  features?: string[];
}

interface CompanyProfile {
  company: any;
  recent_deals: any[];
  pipeline: {
    by_indication: Record<string, number>;
    by_modality: Record<string, number>;
    by_phase: Record<string, number>;
    total_active_trials: number;
  };
}

interface PartnerMatchesProps {
  calculationId?: string;
  sessionId?: string;
  anonymousId?: string;
  userId?: string;
  matches: PartnerMatch[];
  totalMatches: number;
  matchesShown: number;
  userTier: 'free' | 'pro';
  upgradeCta?: UpgradeCTA | null;
  advisoryCta?: AdvisoryCTA | null;
  onUpgradeClick: () => void;
}

export function PartnerMatches({
  calculationId,
  sessionId,
  anonymousId,
  userId,
  matches,
  totalMatches,
  matchesShown,
  userTier,
  upgradeCta,
  advisoryCta,
  onUpgradeClick,
}: PartnerMatchesProps) {
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [partnerDetails, setPartnerDetails] = useState<CompanyProfile | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handlePartnerClick = useCallback(async (match: PartnerMatch) => {
    // Track click event
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        anonymous_id: anonymousId,
        event_type: 'partner_clicked',
        event_data: {
          company_id: match.company_id,
          company_name: match.company_name,
          calculation_id: calculationId,
          match_score: match.match_score,
        },
      }),
    }).catch(console.error);

    if (match.profile_locked) {
      onUpgradeClick();
      return;
    }

    if (expandedPartner === match.company_id) {
      setExpandedPartner(null);
      setPartnerDetails(null);
      return;
    }

    setExpandedPartner(match.company_id);
    setLoadingDetails(true);

    try {
      const params = new URLSearchParams();
      if (userId) params.set('user_id', userId);
      if (sessionId) params.set('session_id', sessionId);
      if (anonymousId) params.set('anonymous_id', anonymousId);

      const res = await fetch(`/api/partners/${match.company_id}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPartnerDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch partner details:', error);
    }

    setLoadingDetails(false);
  }, [expandedPartner, userId, sessionId, anonymousId, calculationId, onUpgradeClick]);

  const handleUpgradeCtaClick = useCallback(async () => {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        anonymous_id: anonymousId,
        event_type: 'partner_upgrade_cta_clicked',
        event_data: {
          calculation_id: calculationId,
          matches_shown: matchesShown,
          total_matches: totalMatches,
        },
      }),
    }).catch(console.error);

    onUpgradeClick();
  }, [userId, sessionId, anonymousId, calculationId, matchesShown, totalMatches, onUpgradeClick]);

  const handleAdvisoryCtaClick = useCallback(async () => {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        anonymous_id: anonymousId,
        event_type: 'partner_advisory_cta_clicked',
        event_data: {
          calculation_id: calculationId,
          company_context: expandedPartner,
        },
      }),
    }).catch(console.error);
  }, [userId, sessionId, anonymousId, calculationId, expandedPartner]);

  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Potential Partners
          </h3>
        </div>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {totalMatches} matches
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Companies actively acquiring or licensing assets similar to yours, ranked by fit.
      </p>

      {/* Partner List */}
      <div className="space-y-3">
        {matches.map((match) => (
          <div
            key={match.company_id}
            className={`border rounded-xl transition-all duration-200 ${
              match.profile_locked
                ? 'bg-gray-50/50 border-gray-200 cursor-pointer hover:bg-gray-100/50'
                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
            }`}
          >
            {/* Main Row */}
            <div
              className="p-4 flex items-center justify-between"
              onClick={() => handlePartnerClick(match)}
            >
              <div className="flex items-center gap-4">
                {/* Rank Badge */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                  match.rank === 1
                    ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white'
                    : match.rank === 2
                    ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                    : match.rank === 3
                    ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {match.rank}
                </div>

                {/* Company Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{match.company_name}</span>
                    {match.ticker && (
                      <span className="text-xs text-gray-400">({match.ticker})</span>
                    )}
                    {match.profile_locked && (
                      <Lock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-gray-500">
                      {formatCompanyType(match.company_type)}
                    </span>
                    {match.hq_country && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-sm text-gray-500">{match.hq_country}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Score & Expand */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <div className={`text-sm font-semibold ${
                      match.match_score >= 70 ? 'text-green-600' :
                      match.match_score >= 50 ? 'text-blue-600' :
                      match.match_score >= 30 ? 'text-amber-600' :
                      'text-gray-600'
                    }`}>
                      {match.match_score}%
                    </div>
                    <span className="text-xs text-gray-400">match</span>
                  </div>
                  {!match.profile_locked && match.deals_last_12mo !== null && match.deals_last_12mo > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {match.deals_last_12mo} deal{match.deals_last_12mo > 1 ? 's' : ''} in 12mo
                    </div>
                  )}
                </div>
                {expandedPartner === match.company_id ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Profile (Pro Only) */}
            {expandedPartner === match.company_id && !match.profile_locked && (
              <div className="border-t border-gray-100 px-4 py-4 bg-gradient-to-b from-gray-50/50 to-white">
                {loadingDetails ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading details...
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Match Reasons */}
                    {match.match_reasons && match.match_reasons.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Why They Match
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {match.match_reasons.map((reason, i) => (
                            <span
                              key={i}
                              className={`px-2.5 py-1 text-xs rounded-full ${
                                reason.strength === 'strong'
                                  ? 'bg-green-100 text-green-700'
                                  : reason.strength === 'moderate'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {reason.reason}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard
                        icon={<TrendingUp className="w-4 h-4" />}
                        value={partnerDetails?.company?.deals_last_24mo || match.deals_last_24mo || 0}
                        label="Deals (24mo)"
                      />
                      <StatCard
                        icon={<FlaskConical className="w-4 h-4" />}
                        value={partnerDetails?.pipeline?.total_active_trials || match.active_trials_count || 0}
                        label="Active Trials"
                      />
                      <StatCard
                        icon={<Building2 className="w-4 h-4" />}
                        value={formatCurrency(partnerDetails?.company?.avg_upfront_usd || match.avg_upfront_usd)}
                        label="Avg Upfront"
                      />
                      <StatCard
                        icon={<Calendar className="w-4 h-4" />}
                        value={formatDate(partnerDetails?.company?.last_deal_date || match.last_deal_date)}
                        label="Last Deal"
                      />
                    </div>

                    {/* Recent Deals */}
                    {partnerDetails?.recent_deals && partnerDetails.recent_deals.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Recent Deals
                        </div>
                        <div className="space-y-2">
                          {partnerDetails.recent_deals.slice(0, 3).map((deal: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm bg-white border border-gray-100 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {deal.asset_name}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600">{formatModality(deal.modality)}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600">{formatPhase(deal.phase)}</span>
                              </div>
                              <div className="text-right">
                                {deal.terms_disclosed && deal.upfront_usd ? (
                                  <span className="text-green-600 font-medium">
                                    {formatCurrency(deal.upfront_usd)} upfront
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">Terms undisclosed</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Therapeutic Focus */}
                    {partnerDetails?.company?.modalities_primary?.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Primary Focus Areas
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {partnerDetails?.company?.modalities_primary?.map((m: string) => (
                            <span key={m} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                              {formatModality(m)}
                            </span>
                          ))}
                          {partnerDetails?.company?.indications_active?.slice(0, 3).map((i: string) => (
                            <span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded">
                              {formatIndicationCategory(i)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Free Tier: Upgrade CTA */}
      {userTier === 'free' && upgradeCta && (
        <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <p className="font-semibold text-gray-900">
                  {upgradeCta.remaining_hidden}+ more potential partners
                </p>
              </div>
              <p className="text-sm text-gray-600">
                {upgradeCta.message}
              </p>
              <ul className="mt-3 space-y-1">
                {upgradeCta.features.slice(0, 3).map((feature, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={handleUpgradeCtaClick}
              className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              Upgrade to Pro
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pro Tier: Advisory CTA */}
      {userTier === 'pro' && advisoryCta && (
        <div className="mt-6 p-5 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-xl border border-amber-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-5 h-5 text-amber-600" />
                <p className="font-semibold text-gray-900">
                  Need deeper partner analysis?
                </p>
              </div>
              <p className="text-sm text-gray-600">
                {advisoryCta.message}
              </p>
            </div>
            <a
              href={advisoryCta.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleAdvisoryCtaClick}
              className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              {advisoryCta.cta_text}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
      <div className="text-gray-400">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-gray-900">{value || 'N/A'}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

// Formatting helpers
function formatCompanyType(type: string | null): string {
  if (!type) return '';
  const labels: Record<string, string> = {
    'large_pharma': 'Large Pharma',
    'mid_pharma': 'Mid-Cap Pharma',
    'large_biotech': 'Large Biotech',
    'mid_biotech': 'Mid-Cap Biotech',
    'specialty': 'Specialty Pharma',
  };
  return labels[type] || type;
}

function formatModality(modality: string | null): string {
  if (!modality) return '';
  const labels: Record<string, string> = {
    'adc': 'ADC',
    'bispecific': 'Bispecific',
    'small_molecule': 'Small Molecule',
    'antibody': 'Antibody',
    'car_t': 'CAR-T',
    'cell_therapy': 'Cell Therapy',
    'gene_therapy': 'Gene Therapy',
    'mrna': 'mRNA',
    'radiopharm': 'Radiopharm',
    'oligonucleotide': 'Oligo',
    'peptide': 'Peptide',
  };
  return labels[modality] || modality;
}

function formatPhase(phase: string | null): string {
  if (!phase) return '';
  const labels: Record<string, string> = {
    'discovery': 'Discovery',
    'preclinical': 'Preclinical',
    'phase_1': 'Phase 1',
    'phase_2': 'Phase 2',
    'phase_3': 'Phase 3',
    'approved': 'Approved',
  };
  return labels[phase] || phase;
}

function formatIndicationCategory(category: string | null): string {
  if (!category) return '';
  const labels: Record<string, string> = {
    'solid_tumor': 'Solid Tumors',
    'hematological': 'Heme Malignancies',
    'autoimmune': 'Autoimmune',
    'cns': 'CNS',
    'rare_disease': 'Rare Disease',
    'infectious': 'Infectious',
    'metabolic': 'Metabolic',
  };
  return labels[category] || category;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default PartnerMatches;
