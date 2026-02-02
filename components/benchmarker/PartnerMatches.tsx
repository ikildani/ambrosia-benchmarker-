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
  AlertTriangle,
  DollarSign,
  Clock,
  Pill,
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

interface PatentCliff {
  drug_name: string;
  indication: string;
  revenue_usd: number;
  expiry_year: number;
  expiry_date?: string;
}

interface CompanyProfile {
  company: {
    id: string;
    name: string;
    ticker?: string | null;
    company_type?: string | null;
    hq_country?: string | null;
    modalities_active?: string[];
    modalities_primary?: string[];
    indications_active?: string[];
    deals_last_12mo?: number;
    deals_last_24mo?: number;
    avg_upfront_usd?: number | null;
    median_upfront_usd?: number | null;
    last_deal_date?: string | null;
    patent_cliffs?: PatentCliff[];
    revenue_at_risk_2025?: number | null;
    revenue_at_risk_2026?: number | null;
    revenue_at_risk_2027?: number | null;
    [key: string]: any;
  };
  recent_deals: {
    id: string;
    asset_name: string;
    licensor: string;
    modality: string;
    indication?: string;
    phase: string;
    territory?: string;
    deal_type?: string;
    upfront_usd: number | null;
    milestones_usd: number | null;
    total_value_usd: number | null;
    announced_date: string;
    terms_disclosed: boolean;
  }[];
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
      params.set('tier', userTier); // Pass tier for access control

      const res = await fetch(`/api/partners/${match.company_id}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPartnerDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch partner details:', error);
    }

    setLoadingDetails(false);
  }, [expandedPartner, userId, sessionId, anonymousId, calculationId, onUpgradeClick, userTier]);

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
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            Potential Partners
          </h3>
        </div>
        <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded flex-shrink-0">
          {totalMatches} matches
        </span>
      </div>

      <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
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
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
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
                        icon={<DollarSign className="w-4 h-4" />}
                        value={formatCurrency(partnerDetails?.company?.avg_upfront_usd || match.avg_upfront_usd)}
                        label="Avg Upfront"
                        highlight={true}
                      />
                      <StatCard
                        icon={<Calendar className="w-4 h-4" />}
                        value={formatDate(partnerDetails?.company?.last_deal_date || match.last_deal_date)}
                        label="Last Deal"
                      />
                    </div>

                    {/* Patent Cliffs - Why They're Motivated */}
                    {partnerDetails?.company?.patent_cliffs && partnerDetails.company.patent_cliffs.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-medium text-amber-800 uppercase tracking-wide">
                            Patent Cliffs — Why They&apos;re Acquiring
                          </span>
                        </div>
                        <div className="space-y-2">
                          {partnerDetails.company.patent_cliffs.slice(0, 3).map((cliff: PatentCliff, i: number) => (
                            <div
                              key={i}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-sm bg-white border border-amber-100 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Pill className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                <span className="font-medium text-gray-900 truncate">{cliff.drug_name}</span>
                                {cliff.indication && (
                                  <>
                                    <span className="text-gray-300 hidden sm:inline">•</span>
                                    <span className="text-gray-600 truncate hidden sm:inline">{cliff.indication}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-5 sm:ml-0">
                                <span className="text-amber-700 font-medium text-xs sm:text-sm">
                                  {formatCurrency(cliff.revenue_usd)}/yr
                                </span>
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                                  LOE {cliff.expiry_year}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {(partnerDetails.company.revenue_at_risk_2025 ||
                          partnerDetails.company.revenue_at_risk_2026 ||
                          partnerDetails.company.revenue_at_risk_2027) && (
                          <div className="mt-3 pt-3 border-t border-amber-200 flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
                            <span className="text-amber-700 font-medium">Revenue at Risk:</span>
                            {partnerDetails.company.revenue_at_risk_2025 && (
                              <span className="text-gray-700">
                                2025: <strong>{formatCurrency(partnerDetails.company.revenue_at_risk_2025)}</strong>
                              </span>
                            )}
                            {partnerDetails.company.revenue_at_risk_2026 && (
                              <span className="text-gray-700">
                                2026: <strong>{formatCurrency(partnerDetails.company.revenue_at_risk_2026)}</strong>
                              </span>
                            )}
                            {partnerDetails.company.revenue_at_risk_2027 && (
                              <span className="text-gray-700">
                                2027: <strong>{formatCurrency(partnerDetails.company.revenue_at_risk_2027)}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Deals - Enhanced */}
                    {partnerDetails?.recent_deals && partnerDetails.recent_deals.length > 0 && (
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Recent Deals
                          </div>
                          {partnerDetails.company?.avg_upfront_usd && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <DollarSign className="w-3 h-3 text-green-600" />
                              <span className="text-gray-500">Avg:</span>
                              <span className="font-semibold text-green-600">
                                {formatCurrency(partnerDetails.company.avg_upfront_usd)}
                              </span>
                              {partnerDetails.company?.median_upfront_usd &&
                               partnerDetails.company.median_upfront_usd !== partnerDetails.company.avg_upfront_usd && (
                                <span className="text-gray-400 hidden sm:inline">
                                  (Med: {formatCurrency(partnerDetails.company.median_upfront_usd)})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {partnerDetails.recent_deals.slice(0, 5).map((deal, i: number) => (
                            <div
                              key={i}
                              className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 hover:border-gray-200 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-900 text-sm">
                                      {deal.asset_name}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                      {formatModality(deal.modality)}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                      {formatPhase(deal.phase)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                                    <span className="truncate">from {deal.licensor}</span>
                                    {deal.indication && (
                                      <>
                                        <span className="text-gray-300 hidden sm:inline">•</span>
                                        <span className="truncate hidden sm:inline">{deal.indication}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-0 flex-shrink-0">
                                  {deal.terms_disclosed ? (
                                    <div className="text-left sm:text-right">
                                      {deal.upfront_usd && (
                                        <div className="text-green-600 font-semibold text-xs sm:text-sm">
                                          {formatCurrency(deal.upfront_usd)} upfront
                                        </div>
                                      )}
                                      {deal.total_value_usd && (
                                        <div className="text-xs text-gray-500 hidden sm:block">
                                          {formatCurrency(deal.total_value_usd)} total
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">Undisclosed</span>
                                  )}
                                  <div className="text-xs text-gray-400">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {formatDate(deal.announced_date)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Therapeutic Focus */}
                    {(partnerDetails?.company?.modalities_primary?.length ?? 0) > 0 && (
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
function StatCard({
  icon,
  value,
  label,
  highlight = false,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 min-w-0 ${
      highlight
        ? 'bg-green-50 border border-green-200'
        : 'bg-white border border-gray-100'
    }`}>
      <div className={`flex-shrink-0 ${highlight ? 'text-green-600' : 'text-gray-400'}`}>{icon}</div>
      <div className="min-w-0">
        <div className={`text-xs sm:text-sm font-semibold truncate ${highlight ? 'text-green-700' : 'text-gray-900'}`}>
          {value || 'N/A'}
        </div>
        <div className="text-[10px] sm:text-xs text-gray-500 truncate">{label}</div>
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
