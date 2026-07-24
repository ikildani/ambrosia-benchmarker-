/**
 * Weekly SEO content suggestions cron job.
 * Queries the deals database and ClinicalTrials.gov for trending topics,
 * generates 3 insight page topic suggestions, and sends them to Slack.
 *
 * Schedule: Wednesdays at 7AM UTC (vercel.json)
 * Auth: Bearer token matched against CRON_SECRET
 *
 * This cron does NOT auto-create pages — it only suggests topics for manual review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { GSCClient, type GSCPerformanceRow } from '@/lib/seo/gsc-client';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ── TA labels ────────────────────────────────────────────────────────────────

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
  womensHealth: "Women's Health",
};

const MODALITY_LABELS: Record<string, string> = {
  adc: 'ADC',
  bispecific: 'Bispecific Antibody',
  smallMolecule: 'Small Molecule',
  monoclonalAntibody: 'Monoclonal Antibody',
  geneTherapy: 'Gene Therapy',
  cellTherapy: 'Cell Therapy',
  rnai: 'RNAi',
  mrna: 'mRNA',
  protac: 'PROTAC',
  carT_heme: 'CAR-T (Hematologic)',
  peptide: 'Peptide',
  radiopharmaceutical: 'Radiopharmaceutical',
  aso: 'ASO',
  glp1Agonist: 'GLP-1 Agonist',
};

const PHASE_LABELS: Record<string, string> = {
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  approved: 'Approved',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface TrendingTA {
  ta: string;
  label: string;
  dealCount: number;
  priorCount: number;
  changePercent: number;
}

interface TrendingModality {
  modality: string;
  label: string;
  currentCount: number;
  priorCount: number;
  changePercent: number;
}

interface MegaDeal {
  licensor: string;
  licensee: string;
  asset: string;
  totalValue: number;
  ta: string;
  announcedDate: string;
}

interface PhaseActivity {
  phase: string;
  label: string;
  dealCount: number;
}

interface ClinicalTrialTrend {
  ta: string;
  phase3Starts: number;
  terminations: number;
  topConditions: string[];
}

interface ContentSuggestion {
  title: string;
  keywords: string[];
  slug: string;
  persona: 'Report Buyer' | 'Pro Subscriber';
  dataHook: string;
  outline: string[];
}

interface LowPerformingPage {
  url: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

// ── ClinicalTrials.gov helpers ───────────────────────────────────────────────

const CT_GOV_BASE = 'https://clinicaltrials.gov/api/v2';

// Map our TA keys to ClinicalTrials.gov condition terms
const TA_TO_CONDITION: Record<string, string> = {
  oncology: 'cancer OR neoplasm OR tumor',
  neurology: 'neurological OR neurodegenerative OR alzheimer OR parkinson',
  immunology: 'autoimmune OR immunological OR lupus OR rheumatoid',
  metabolic: 'diabetes OR obesity OR metabolic',
  cardiovascular: 'cardiovascular OR heart failure OR atherosclerosis',
  rareDisease: 'rare disease OR orphan',
  hematology: 'hematologic OR leukemia OR lymphoma OR myeloma',
  infectiousDisease: 'infectious disease OR bacterial OR viral OR HIV',
  ophthalmology: 'ophthalmic OR retinal OR macular degeneration',
  dermatology: 'dermatologic OR psoriasis OR atopic dermatitis',
  gastroenterology: 'gastrointestinal OR crohn OR colitis',
  womensHealth: 'endometriosis OR ovarian OR uterine',
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCTGovTrials(
  conditionQuery: string,
  phase: string,
  status: string,
  minDate: string,
  maxDate: string,
): Promise<number> {
  const params = new URLSearchParams({
    'query.cond': conditionQuery,
    'filter.overallStatus': status,
    'filter.phase': phase,
    'filter.advanced': `AREA[StartDate]RANGE[${minDate},${maxDate}]`,
    countTotal: 'true',
    pageSize: '1',
    format: 'json',
  });

  try {
    const res = await fetch(`${CT_GOV_BASE}/studies?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return 0;
    }

    const data = await res.json();
    return data.totalCount || 0;
  } catch (err) {
    return 0;
  }
}

async function fetchTerminatedTrials(
  conditionQuery: string,
  minDate: string,
  maxDate: string,
): Promise<{ count: number; conditions: string[] }> {
  const params = new URLSearchParams({
    'query.cond': conditionQuery,
    'filter.overallStatus': 'TERMINATED',
    'filter.advanced': `AREA[StatusVerifiedDate]RANGE[${minDate},${maxDate}]`,
    countTotal: 'true',
    pageSize: '5',
    format: 'json',
    'fields': 'OfficialTitle,Condition',
  });

  try {
    const res = await fetch(`${CT_GOV_BASE}/studies?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return { count: 0, conditions: [] };

    const data = await res.json();
    const conditions: string[] = [];
    if (data.studies) {
      for (const study of data.studies.slice(0, 5)) {
        const conds = study.protocolSection?.conditionsModule?.conditions;
        if (conds) {
          conditions.push(...conds.slice(0, 2));
        }
      }
    }

    return {
      count: data.totalCount || 0,
      conditions: [...new Set(conditions)].slice(0, 5),
    };
  } catch {
    return { count: 0, conditions: [] };
  }
}

// ── Supabase queries ─────────────────────────────────────────────────────────

async function getTrendingTAs(supabase: ReturnType<typeof createServiceClient>): Promise<TrendingTA[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Current 30 days
  const { data: currentDeals } = await supabase
    .from('deals')
    .select('therapeutic_area')
    .gte('announced_date', thirtyDaysAgo.split('T')[0])
    .not('therapeutic_area', 'is', null)
    .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")');

  // Prior 30 days
  const { data: priorDeals } = await supabase
    .from('deals')
    .select('therapeutic_area')
    .gte('announced_date', sixtyDaysAgo.split('T')[0])
    .lt('announced_date', thirtyDaysAgo.split('T')[0])
    .not('therapeutic_area', 'is', null)
    .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")');

  const currentCounts: Record<string, number> = {};
  const priorCounts: Record<string, number> = {};

  for (const d of currentDeals || []) {
    const ta = d.therapeutic_area;
    currentCounts[ta] = (currentCounts[ta] || 0) + 1;
  }

  for (const d of priorDeals || []) {
    const ta = d.therapeutic_area;
    priorCounts[ta] = (priorCounts[ta] || 0) + 1;
  }

  const results: TrendingTA[] = [];
  for (const ta of Object.keys(TA_LABELS)) {
    const current = currentCounts[ta] || 0;
    const prior = priorCounts[ta] || 0;
    if (current > 0) {
      results.push({
        ta,
        label: TA_LABELS[ta] || ta,
        dealCount: current,
        priorCount: prior,
        changePercent: prior > 0 ? Math.round(((current - prior) / prior) * 100) : current > 0 ? 100 : 0,
      });
    }
  }

  return results.sort((a, b) => b.dealCount - a.dealCount);
}

async function getTrendingModalities(supabase: ReturnType<typeof createServiceClient>): Promise<TrendingModality[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: currentDeals } = await supabase
    .from('deals')
    .select('modality')
    .gte('announced_date', thirtyDaysAgo.split('T')[0])
    .not('modality', 'is', null);

  const { data: priorDeals } = await supabase
    .from('deals')
    .select('modality')
    .gte('announced_date', sixtyDaysAgo.split('T')[0])
    .lt('announced_date', thirtyDaysAgo.split('T')[0])
    .not('modality', 'is', null);

  const currentCounts: Record<string, number> = {};
  const priorCounts: Record<string, number> = {};

  for (const d of currentDeals || []) {
    currentCounts[d.modality] = (currentCounts[d.modality] || 0) + 1;
  }
  for (const d of priorDeals || []) {
    priorCounts[d.modality] = (priorCounts[d.modality] || 0) + 1;
  }

  const results: TrendingModality[] = [];
  for (const [mod, count] of Object.entries(currentCounts)) {
    const prior = priorCounts[mod] || 0;
    results.push({
      modality: mod,
      label: MODALITY_LABELS[mod] || mod,
      currentCount: count,
      priorCount: prior,
      changePercent: prior > 0 ? Math.round(((count - prior) / prior) * 100) : count > 0 ? 100 : 0,
    });
  }

  return results.sort((a, b) => b.changePercent - a.changePercent);
}

async function getMegaDeals(supabase: ReturnType<typeof createServiceClient>): Promise<MegaDeal[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data } = await supabase
    .from('deals')
    .select('licensor_name, licensee_name, asset_name, total_deal_value_usd, therapeutic_area, announced_date')
    .gte('announced_date', thirtyDaysAgo)
    .gte('total_deal_value_usd', 1_000_000_000)
    .order('total_deal_value_usd', { ascending: false })
    .limit(10);

  return (data || []).map((d) => ({
    licensor: d.licensor_name || 'Unknown',
    licensee: d.licensee_name || 'Unknown',
    asset: d.asset_name || 'Undisclosed',
    totalValue: d.total_deal_value_usd || 0,
    ta: d.therapeutic_area || 'other',
    announcedDate: d.announced_date || '',
  }));
}

async function getPhaseActivity(supabase: ReturnType<typeof createServiceClient>): Promise<PhaseActivity[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data } = await supabase
    .from('deals')
    .select('development_phase')
    .gte('announced_date', thirtyDaysAgo)
    .not('development_phase', 'is', null);

  const counts: Record<string, number> = {};
  for (const d of data || []) {
    const phase = d.development_phase;
    counts[phase] = (counts[phase] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([phase, count]) => ({
      phase,
      label: PHASE_LABELS[phase] || phase,
      dealCount: count,
    }))
    .sort((a, b) => b.dealCount - a.dealCount);
}

// ── ClinicalTrials.gov queries ───────────────────────────────────────────────

async function getClinicalTrialTrends(): Promise<ClinicalTrialTrend[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const minDate = thirtyDaysAgo.toISOString().split('T')[0];
  const maxDate = now.toISOString().split('T')[0];

  const trends: ClinicalTrialTrend[] = [];

  // Only query top 6 TAs to stay within time budget and rate limits
  const topTAs = ['oncology', 'neurology', 'immunology', 'metabolic', 'hematology', 'rareDisease'];

  for (const ta of topTAs) {
    const condition = TA_TO_CONDITION[ta];
    if (!condition) continue;

    // Phase 3 starts
    await sleep(350); // Rate limit: 350ms between requests
    const phase3Count = await fetchCTGovTrials(condition, 'PHASE3', 'RECRUITING', minDate, maxDate);

    // Terminations
    await sleep(350);
    const termResult = await fetchTerminatedTrials(condition, minDate, maxDate);

    trends.push({
      ta,
      phase3Starts: phase3Count,
      terminations: termResult.count,
      topConditions: termResult.conditions,
    });
  }

  return trends;
}

// ── Suggestion generation ────────────────────────────────────────────────────

function generateSuggestions(
  trendingTAs: TrendingTA[],
  trendingModalities: TrendingModality[],
  megaDeals: MegaDeal[],
  phaseActivity: PhaseActivity[],
  clinicalTrends: ClinicalTrialTrend[],
): ContentSuggestion[] {
  const suggestions: ContentSuggestion[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;

  // ── Suggestion 1: Top trending TA ──────────────────────────────────────────
  const topTA = trendingTAs[0];
  if (topTA) {
    const taLabel = topTA.label;
    const changeDir = topTA.changePercent > 0 ? 'surge' : topTA.changePercent < 0 ? 'decline' : 'steady activity';
    const ctTrend = clinicalTrends.find((t) => t.ta === topTA.ta);

    suggestions.push({
      title: `${taLabel} Deal Activity ${monthName} ${year}: ${topTA.dealCount} Deals and What They Signal`,
      keywords: [
        `${taLabel.toLowerCase()} licensing deals ${year}`,
        `${taLabel.toLowerCase()} deal benchmarks ${quarter} ${year}`,
        `${taLabel.toLowerCase()} pharma partnerships`,
        `${taLabel.toLowerCase()} upfront payment trends`,
        `biopharma ${taLabel.toLowerCase()} deals`,
      ],
      slug: `${topTA.ta.toLowerCase()}-deal-activity-${monthName.toLowerCase()}-${year}`,
      persona: 'Report Buyer',
      dataHook: `${topTA.dealCount} ${taLabel} deals in the last 30 days (${topTA.changePercent > 0 ? '+' : ''}${topTA.changePercent}% vs prior month)${ctTrend && ctTrend.phase3Starts > 0 ? ` — ${ctTrend.phase3Starts} Phase 3 trials started` : ''}`,
      outline: [
        `${taLabel} deal volume: ${monthName} ${year} snapshot (${topTA.dealCount} deals, ${changeDir})`,
        'Upfront payment trends and total deal value benchmarks for recent transactions',
        `Key deals driving the ${changeDir}: company names, asset details, deal structure`,
        ctTrend && ctTrend.phase3Starts > 0
          ? `Phase 3 pipeline activity: ${ctTrend.phase3Starts} new trials signal upcoming deal catalysts`
          : `Phase activity breakdown: where buyers are placing bets`,
        `What this means for ${taLabel.toLowerCase()} licensors and deal negotiators`,
      ],
    });
  }

  // ── Suggestion 2: Trending modality or mega-deal ───────────────────────────
  const topModality = trendingModalities.find((m) => m.changePercent > 20 && m.currentCount >= 3);
  const hasMegaDeal = megaDeals.length > 0;

  if (hasMegaDeal && megaDeals[0].totalValue >= 5_000_000_000) {
    // Mega-deal story
    const deal = megaDeals[0];
    const valueStr = deal.totalValue >= 1e9 ? `$${(deal.totalValue / 1e9).toFixed(1)}B` : `$${(deal.totalValue / 1e6).toFixed(0)}M`;
    const taLabel = TA_LABELS[deal.ta] || deal.ta;

    suggestions.push({
      title: `${deal.licensee}–${deal.licensor} ${valueStr} Deal: What It Means for ${taLabel} Valuations`,
      keywords: [
        `${deal.licensee} ${deal.licensor} deal`,
        `${deal.asset} licensing deal`,
        `${taLabel.toLowerCase()} mega deal ${year}`,
        `${valueStr} pharma deal analysis`,
        `biopharma deal valuation ${year}`,
      ],
      slug: `${deal.licensee.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${deal.licensor.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-deal-analysis-${year}`,
      persona: 'Pro Subscriber',
      dataHook: `${valueStr} total deal value — the largest ${taLabel} transaction in the last 30 days`,
      outline: [
        `Deal structure breakdown: upfront, milestones, royalties for the ${valueStr} transaction`,
        `How this deal compares to ${taLabel} benchmarks (upfront as % of TDV, phase-adjusted)`,
        `Impact on ${taLabel} deal valuations: will this reset pricing expectations?`,
        'Comparable transactions: similar deals by TA, modality, and development stage',
        `Implications for licensors and buyers in ${taLabel} — the ripple effects`,
      ],
    });
  } else if (topModality) {
    // Modality trend story
    const modLabel = topModality.label;

    suggestions.push({
      title: `${modLabel} Deals Are Surging: ${quarter} ${year} Benchmarks and What's Driving Demand`,
      keywords: [
        `${modLabel.toLowerCase()} deal terms ${year}`,
        `${modLabel.toLowerCase()} licensing benchmarks`,
        `${modLabel.toLowerCase()} upfront payments`,
        `${modLabel.toLowerCase()} pharma partnerships ${quarter} ${year}`,
        `${modLabel.toLowerCase()} deal activity`,
      ],
      slug: `${topModality.modality.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-deal-surge-${quarter.toLowerCase()}-${year}`,
      persona: 'Report Buyer',
      dataHook: `${modLabel} deals up ${topModality.changePercent}% month-over-month (${topModality.currentCount} deals vs ${topModality.priorCount} prior)`,
      outline: [
        `${modLabel} deal volume trend: the ${quarter} ${year} acceleration`,
        `Upfront and total deal value benchmarks for recent ${modLabel.toLowerCase()} transactions`,
        'What is driving the surge: clinical catalysts, commercial validation, or platform scalability?',
        'Key deals to watch and their structural characteristics',
        `Outlook: where ${modLabel.toLowerCase()} deal economics are heading next`,
      ],
    });
  } else {
    // Fallback: phase activity story
    const topPhase = phaseActivity[0];
    if (topPhase) {
      suggestions.push({
        title: `${topPhase.label} Deals Dominate ${quarter} ${year}: Where Pharma Is Placing Its Bets`,
        keywords: [
          `${topPhase.label.toLowerCase()} deal terms ${year}`,
          `${topPhase.label.toLowerCase()} licensing benchmarks`,
          `pharma deal activity by phase ${year}`,
          `${topPhase.label.toLowerCase()} upfront payments`,
          `biopharma deal timing ${year}`,
        ],
        slug: `${topPhase.phase.toLowerCase()}-deal-activity-${quarter.toLowerCase()}-${year}`,
        persona: 'Report Buyer',
        dataHook: `${topPhase.dealCount} deals at ${topPhase.label} in the last 30 days — the most active development stage`,
        outline: [
          `Phase distribution of recent deals: why ${topPhase.label} leads`,
          `${topPhase.label} deal economics: upfront payments, milestones, and royalties`,
          'Phase-specific risk premiums and how they affect deal structure',
          'Which TAs are most active at this stage',
          `Strategic implications for companies with ${topPhase.label.toLowerCase()} assets`,
        ],
      });
    }
  }

  // ── Suggestion 3: Clinical trial signal (terminations or hot areas) ────────
  const trialsWithTerminations = clinicalTrends.filter((t) => t.terminations >= 3).sort((a, b) => b.terminations - a.terminations);
  const trialsWithPhase3 = clinicalTrends.filter((t) => t.phase3Starts >= 5).sort((a, b) => b.phase3Starts - a.phase3Starts);

  if (trialsWithTerminations.length > 0) {
    const topTerm = trialsWithTerminations[0];
    const taLabel = TA_LABELS[topTerm.ta] || topTerm.ta;
    const conditions = topTerm.topConditions.slice(0, 3).join(', ');

    suggestions.push({
      title: `${taLabel} Trial Terminations Signal M&A Opportunities: ${monthName} ${year} Analysis`,
      keywords: [
        `${taLabel.toLowerCase()} trial failures ${year}`,
        `${taLabel.toLowerCase()} acquisition targets`,
        `pharma m&a pipeline ${year}`,
        `${taLabel.toLowerCase()} clinical trial terminations`,
        `distressed biotech ${taLabel.toLowerCase()}`,
      ],
      slug: `${topTerm.ta.toLowerCase()}-trial-terminations-ma-signal-${monthName.toLowerCase()}-${year}`,
      persona: 'Pro Subscriber',
      dataHook: `${topTerm.terminations} ${taLabel} trial terminations in 30 days${conditions ? ` (including ${conditions})` : ''} — historically correlated with acquisition activity`,
      outline: [
        `${taLabel} trial termination trends: ${topTerm.terminations} failures in the last 30 days`,
        'Which programs failed and why — mechanisms, endpoints, safety signals',
        'Historical pattern: how trial failures lead to fire-sale acquisitions within 6-12 months',
        `Current ${taLabel.toLowerCase()} acquisition landscape: who is buying and at what multiples`,
        'Actionable signals for deal professionals tracking distressed assets',
      ],
    });
  } else if (trialsWithPhase3.length > 0) {
    const topPhase3 = trialsWithPhase3[0];
    const taLabel = TA_LABELS[topPhase3.ta] || topPhase3.ta;

    suggestions.push({
      title: `${topPhase3.phase3Starts} New Phase 3 Trials in ${taLabel}: ${quarter} ${year} Pipeline Catalyst Preview`,
      keywords: [
        `${taLabel.toLowerCase()} phase 3 trials ${year}`,
        `${taLabel.toLowerCase()} pipeline catalysts`,
        `${taLabel.toLowerCase()} late-stage clinical trials`,
        `pharma pipeline ${taLabel.toLowerCase()} ${quarter} ${year}`,
        `${taLabel.toLowerCase()} deal catalysts`,
      ],
      slug: `${topPhase3.ta.toLowerCase()}-phase-3-pipeline-catalysts-${quarter.toLowerCase()}-${year}`,
      persona: 'Pro Subscriber',
      dataHook: `${topPhase3.phase3Starts} new Phase 3 trials started in ${taLabel} in the last 30 days — potential deal catalysts ahead`,
      outline: [
        `Phase 3 pipeline surge in ${taLabel}: what is driving the late-stage investment`,
        'Key trials to watch: sponsors, mechanisms, expected readout timelines',
        `How Phase 3 catalysts historically affect deal valuations in ${taLabel.toLowerCase()}`,
        'Pre-data deal patterns: licensing deals that get done before pivotal readouts',
        `${taLabel} deal outlook: which Phase 3 programs are most likely to generate transactions`,
      ],
    });
  } else {
    // Fallback: second-most active TA
    const secondTA = trendingTAs[1];
    if (secondTA) {
      const taLabel = secondTA.label;
      suggestions.push({
        title: `${taLabel} Deal Benchmarks ${quarter} ${year}: Upfronts, TDVs, and Competitive Positioning`,
        keywords: [
          `${taLabel.toLowerCase()} deal benchmarks ${year}`,
          `${taLabel.toLowerCase()} licensing terms`,
          `${taLabel.toLowerCase()} upfront payment data`,
          `${taLabel.toLowerCase()} pharma deals ${quarter} ${year}`,
          `${taLabel.toLowerCase()} competitive landscape`,
        ],
        slug: `${secondTA.ta.toLowerCase()}-deal-benchmarks-${quarter.toLowerCase()}-${year}`,
        persona: 'Report Buyer',
        dataHook: `${secondTA.dealCount} ${taLabel} deals tracked in the last 30 days — fresh benchmark data available`,
        outline: [
          `${taLabel} deal landscape: ${quarter} ${year} overview`,
          'Upfront payment benchmarks by phase and modality',
          'Total deal value trends and how they compare to prior quarters',
          'Competitive positioning: which companies are most active',
          `Key takeaways for ${taLabel.toLowerCase()} deal negotiators`,
        ],
      });
    }
  }

  return suggestions.slice(0, 3);
}

// ── Low-performing page detection ────────────────────────────────────────────

async function getLowPerformingInsightPages(): Promise<LowPerformingPage[]> {
  try {
    const gsc = new GSCClient();
    if (!gsc.isConfigured()) {
      await gsc.initOAuth2();
    }
    if (!gsc.isConfigured()) {
      return [];
    }

    const rows: GSCPerformanceRow[] = await gsc.getPerformanceData(28);
    if (rows.length === 0) return [];

    // Filter to insight pages only
    const insightRows = rows.filter((r) => r.page.includes('/insights/'));

    // Aggregate by page (a page can have multiple queries)
    const pageMap = new Map<string, { impressions: number; clicks: number; positions: number[]; ctr: number[] }>();
    for (const row of insightRows) {
      const existing = pageMap.get(row.page) || { impressions: 0, clicks: 0, positions: [], ctr: [] };
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.positions.push(row.position);
      existing.ctr.push(row.ctr);
      pageMap.set(row.page, existing);
    }

    // Find pages with high impressions but low CTR (opportunity pages)
    const results: LowPerformingPage[] = [];
    for (const [url, data] of pageMap) {
      if (data.impressions < 50) continue; // Skip very low traffic pages
      const avgPosition = data.positions.reduce((a, b) => a + b, 0) / data.positions.length;
      const avgCtr = data.impressions > 0 ? data.clicks / data.impressions : 0;

      // Flag pages ranking on page 1-2 (position < 20) with CTR below 3%
      if (avgPosition < 20 && avgCtr < 0.03) {
        results.push({
          url: url.replace('https://solidus.ambrosiaventures.co', ''),
          impressions: data.impressions,
          clicks: data.clicks,
          ctr: avgCtr,
          position: Math.round(avgPosition * 10) / 10,
        });
      }
    }

    return results.sort((a, b) => b.impressions - a.impressions).slice(0, 3);
  } catch (err) {
    return [];
  }
}

// ── Slack notification ───────────────────────────────────────────────────────

async function sendSlackNotification(
  suggestions: ContentSuggestion[],
  lowPerformingPages: LowPerformingPage[],
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const date = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let suggestionLines = suggestions.map((s, i) => {
    const keywordsStr = s.keywords.slice(0, 4).join(', ');
    return [
      `*${i + 1}. "${s.title}"*`,
      `   Keywords: ${keywordsStr}`,
      `   Slug: \`/insights/${s.slug}\``,
      `   Persona: ${s.persona}`,
      `   Data hook: ${s.dataHook}`,
      `   Outline:`,
      ...s.outline.map((o) => `   • ${o}`),
    ].join('\n');
  }).join('\n\n');

  if (lowPerformingPages.length > 0) {
    const updateLines = lowPerformingPages.map((p) => {
      return `• \`${p.url}\` — ${p.impressions} impressions, ${p.clicks} clicks, ${(p.ctr * 100).toFixed(1)}% CTR, pos ${p.position}`;
    }).join('\n');

    suggestionLines += `\n\n:mag: *Pages to update (high impressions, low CTR):*\n${updateLines}`;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:memo: Weekly SEO Content Suggestions — ${date}`,
        attachments: [{
          color: '#6366f1',
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `Weekly SEO Content Suggestions — ${date}` },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: suggestionLines },
            },
            {
              type: 'context',
              elements: [{
                type: 'mrkdwn',
                text: 'Review and approve at your next content session.',
              }],
            },
          ],
        }],
      }),
    });
  } catch (err) {
    console.error('[seo-suggestions] Slack notification error:', err instanceof Error ? err.message : 'unknown');
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Auth — same pattern as qa-health-check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // 2. Query deals database in parallel
    const [trendingTAs, trendingModalities, megaDeals, phaseActivity] = await Promise.all([
      getTrendingTAs(supabase),
      getTrendingModalities(supabase),
      getMegaDeals(supabase),
      getPhaseActivity(supabase),
    ]);

    // 3. Query ClinicalTrials.gov (sequential with rate limiting)
    const clinicalTrends = await getClinicalTrialTrends();

    // 4. Generate suggestions
    const suggestions = generateSuggestions(trendingTAs, trendingModalities, megaDeals, phaseActivity, clinicalTrends);

    // 5. Check GSC for low-performing pages
    const lowPerformingPages = await getLowPerformingInsightPages();

    // 6. Send Slack notification
    await sendSlackNotification(suggestions, lowPerformingPages);

    const durationMs = Date.now() - startTime;

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'seo-content-suggestions', {
        processed: suggestions.length,
        inserted: 0,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      durationMs,
      suggestions,
      lowPerformingPages,
      data: {
        trendingTAs: trendingTAs.slice(0, 5),
        trendingModalities: trendingModalities.slice(0, 5),
        megaDeals: megaDeals.length,
        phaseActivity: phaseActivity.slice(0, 5),
        clinicalTrends: clinicalTrends.map((t) => ({
          ta: t.ta,
          phase3Starts: t.phase3Starts,
          terminations: t.terminations,
        })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[seo-suggestions] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
