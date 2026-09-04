/**
 * Asset Radar — Layer 5: Competitive Intelligence
 *
 * Answers "who else is circling this asset?" by mining 6 signal types:
 *
 * 1. User Interest — anonymized Solidus platform behavior (calculations,
 *    views, watchlist adds) on the same asset/company/indication. No PII
 *    exposed — just aggregate counts (N orgs looked at this).
 *
 * 2. Competitor Deals — recent deals in the same TA/modality/indication
 *    by other companies. If Pfizer just did an ADC deal in NSCLC, every
 *    other ADC-in-NSCLC asset's competitive heat rises.
 *
 * 3. Patent Overlap — companies filing patents in the same mechanism
 *    or target as this asset. IP arms race = deal urgency.
 *
 * 4. Conference Overlap — multiple companies presenting in the same
 *    indication at the same conference. Crowded stage = competitive.
 *
 * 5. Trial Crowding — how many other companies have active trials in
 *    the same indication × modality. More trials = more competitive.
 *
 * 6. Publication Race — multiple labs publishing on the same target
 *    or mechanism. Academic validation drives deal urgency.
 *
 * Output: competitive_intel rows per asset + updated competitive_heat
 * on clinical_assets.
 *
 * Run: daily at 10:30 AM UTC via /api/cron/competitive-intel-radar
 * Depends on: licensing-signals (8 AM) running first
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type IntelType =
  | 'user_interest'
  | 'competitor_deal'
  | 'patent_overlap'
  | 'conference_overlap'
  | 'trial_crowding'
  | 'publication_race';

interface IntelSignal {
  type: IntelType;
  intensity: number;
  competitorName?: string;
  competitorCompanyId?: string;
  evidence: string;
  metadata?: Record<string, unknown>;
  interestCount?: number;
  uniqueOrgs?: number;
}

interface AssetForIntel {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  phase: string | null;
  partnership_status: string | null;
  competitive_heat: number;
}

export interface CompetitiveIntelResult {
  assetsAnalyzed: number;
  signalsDetected: number;
  signalsInserted: number;
  heatScoresUpdated: number;
  errors: string[];
  timedOut: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL 1: USER INTEREST (anonymized platform behavior)
// ═══════════════════════════════════════════════════════════════════════

async function detectUserInterest(
  supabase: SupabaseClient,
  asset: AssetForIntel,
): Promise<IntelSignal | null> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Count unique users/sessions that ran calculations for this company
  // or indication (proxy for interest in this asset's space)
  const { count: calcCount } = await supabase
    .from('calculations')
    .select('id', { count: 'exact', head: true })
    .ilike('indication_category', asset.indication_category || '__none__')
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (!calcCount || calcCount < 3) return null;

  // Count calculations matching this asset's modality + indication (tighter match)
  const { count: exactCount } = await supabase
    .from('calculations')
    .select('id', { count: 'exact', head: true })
    .eq('modality', asset.modality || '__none__')
    .ilike('indication_category', asset.indication_category || '__none__')
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Count unique session_ids as proxy for unique orgs
  const { data: sessions } = await supabase
    .from('calculations')
    .select('session_id')
    .ilike('indication_category', asset.indication_category || '__none__')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .limit(100);

  const uniqueSessions = sessions ? new Set(sessions.map(s => s.session_id).filter(Boolean)).size : 0;

  let intensity = 0;
  if (exactCount && exactCount >= 10) intensity = 70;
  else if (exactCount && exactCount >= 5) intensity = 50;
  else if (calcCount >= 20) intensity = 40;
  else if (calcCount >= 10) intensity = 25;
  else intensity = 15;

  return {
    type: 'user_interest',
    intensity,
    evidence: `${calcCount} calculations in ${asset.indication_category || 'this space'} (${exactCount || 0} exact modality match) from ${uniqueSessions} unique sessions in 30 days`,
    interestCount: calcCount,
    uniqueOrgs: uniqueSessions,
    metadata: { calcCount, exactCount: exactCount || 0, uniqueSessions },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL 2: COMPETITOR DEALS (recent deals in same space)
// ═══════════════════════════════════════════════════════════════════════

async function detectCompetitorDeals(
  supabase: SupabaseClient,
  asset: AssetForIntel,
): Promise<IntelSignal[]> {
  if (!asset.indication_category) return [];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Find recent deals in the same indication
  const { data: deals } = await supabase
    .from('deals')
    .select('id, licensee_name, licensee_id, licensor_name, asset_name, modality, indication_category, announced_date, upfront_usd, total_deal_value_usd')
    .eq('indication_category', asset.indication_category)
    .eq('is_synthetic', false)
    .neq('licensor_name', asset.company_name)
    .gte('announced_date', sixMonthsAgo.toISOString().split('T')[0])
    .order('announced_date', { ascending: false })
    .limit(30);

  if (!deals || deals.length === 0) return [];

  const signals: IntelSignal[] = [];

  // Group by acquirer (licensee)
  const acquirerMap = new Map<string, typeof deals>();
  for (const deal of deals) {
    const key = deal.licensee_name || 'Unknown';
    if (!acquirerMap.has(key)) acquirerMap.set(key, []);
    acquirerMap.get(key)!.push(deal);
  }

  for (const [acquirer, acquirerDeals] of acquirerMap) {
    // Same modality = direct competitor
    const sameModality = acquirerDeals.filter(d => d.modality === asset.modality);
    const intensity = sameModality.length >= 2 ? 80
      : sameModality.length === 1 ? 60
      : acquirerDeals.length >= 3 ? 50
      : acquirerDeals.length >= 1 ? 30
      : 0;

    if (intensity > 0) {
      const dealDetail = sameModality.length > 0
        ? `${sameModality.length} same-modality deal(s) in ${asset.indication_category}`
        : `${acquirerDeals.length} deal(s) in ${asset.indication_category}`;

      signals.push({
        type: 'competitor_deal',
        intensity,
        competitorName: acquirer,
        competitorCompanyId: acquirerDeals[0].licensee_id || undefined,
        evidence: `${acquirer}: ${dealDetail} in last 6mo`,
        metadata: {
          dealCount: acquirerDeals.length,
          sameModalityCount: sameModality.length,
          latestDeal: acquirerDeals[0].asset_name,
        },
      });
    }
  }

  return signals.sort((a, b) => b.intensity - a.intensity).slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL 3: PATENT OVERLAP (same mechanism/target)
// ═══════════════════════════════════════════════════════════════════════

async function detectPatentOverlap(
  supabase: SupabaseClient,
  asset: AssetForIntel,
): Promise<IntelSignal | null> {
  if (!asset.therapeutic_area) return null;

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Count patent filings in the same TA by OTHER organizations
  const { data: patents } = await supabase
    .from('research_signals')
    .select('organization_name, title')
    .eq('source_type', 'patent')
    .eq('therapeutic_area', asset.therapeutic_area)
    .gte('published_date', twelveMonthsAgo.toISOString().split('T')[0])
    .not('organization_name', 'ilike', `%${asset.company_name.replace(/'/g, "''")}%`)
    .limit(50);

  if (!patents || patents.length === 0) return null;

  // Count unique organizations
  const orgSet = new Set<string>();
  for (const p of patents) {
    if (p.organization_name) orgSet.add(p.organization_name);
  }

  if (orgSet.size < 2) return null;

  // Asset-name-specific patent matches (highest signal)
  const assetPatents = patents.filter(p =>
    p.title?.toLowerCase().includes(asset.asset_name.toLowerCase())
  );

  const intensity = assetPatents.length >= 3 ? 80
    : assetPatents.length >= 1 ? 60
    : orgSet.size >= 10 ? 50
    : orgSet.size >= 5 ? 35
    : 20;

  return {
    type: 'patent_overlap',
    intensity,
    evidence: assetPatents.length > 0
      ? `${assetPatents.length} competing patent(s) directly referencing ${asset.asset_name} from ${orgSet.size} organizations`
      : `${patents.length} patents in ${asset.therapeutic_area} from ${orgSet.size} competing organizations in 12mo`,
    uniqueOrgs: orgSet.size,
    metadata: { totalPatents: patents.length, assetSpecific: assetPatents.length, uniqueOrgs: orgSet.size },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL 4: CONFERENCE OVERLAP
// ═══════════════════════════════════════════════════════════════════════

async function detectConferenceOverlap(
  supabase: SupabaseClient,
  asset: AssetForIntel,
): Promise<IntelSignal | null> {
  if (!asset.indication_category) return null;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const conferenceKeywords = [
    'asco', 'aacr', 'esmo', 'ash', 'sabcs', 'aha', 'aasld', 'eha',
    'poster', 'oral presentation', 'late-breaking', 'abstract',
  ];

  // Find press releases from OTHER companies presenting in same indication
  const { data: pressReleases } = await supabase
    .from('press_releases')
    .select('headline, companies_mentioned, published_at')
    .gte('published_at', threeMonthsAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(100);

  if (!pressReleases || pressReleases.length === 0) return null;

  const competitorPresentations = new Map<string, number>();
  const indicationLower = asset.indication_category.toLowerCase();

  for (const pr of pressReleases) {
    const h = pr.headline.toLowerCase();
    const isConference = conferenceKeywords.some(kw => h.includes(kw));
    const isRelevantIndication = h.includes(indicationLower.replace(/_/g, ' ')) || h.includes(indicationLower);

    if (isConference && isRelevantIndication) {
      const companies = (pr.companies_mentioned || []).filter(
        (c: string) => c !== asset.company_name
      );
      for (const company of companies) {
        competitorPresentations.set(company, (competitorPresentations.get(company) || 0) + 1);
      }
    }
  }

  if (competitorPresentations.size === 0) return null;

  const totalPresentations = Array.from(competitorPresentations.values()).reduce((a, b) => a + b, 0);

  const intensity = competitorPresentations.size >= 5 ? 70
    : competitorPresentations.size >= 3 ? 50
    : competitorPresentations.size >= 1 ? 30
    : 0;

  return {
    type: 'conference_overlap',
    intensity,
    evidence: `${competitorPresentations.size} competitors presenting in ${asset.indication_category} at recent conferences (${totalPresentations} total presentations)`,
    uniqueOrgs: competitorPresentations.size,
    metadata: { competitors: Object.fromEntries(competitorPresentations), totalPresentations },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL 5: TRIAL CROWDING (how many rivals in same space)
// ═══════════════════════════════════════════════════════════════════════

async function detectTrialCrowding(
  supabase: SupabaseClient,
  asset: AssetForIntel,
): Promise<IntelSignal | null> {
  if (!asset.indication_category) return null;

  // Count other assets in the same indication + modality that are active
  const baseQuery = supabase
    .from('clinical_assets')
    .select('id, company_name, asset_name, phase, modality', { count: 'exact' })
    .eq('indication_category', asset.indication_category)
    .neq('company_name', asset.company_name)
    .in('trial_status', ['active'])
    .limit(50);

  const { data: competitors, count: totalInIndication } = asset.modality
    ? await baseQuery
    : await baseQuery;

  if (!competitors || competitors.length === 0) return null;

  // Same modality competitors (direct competition)
  const sameModality = asset.modality
    ? competitors.filter(c => c.modality === asset.modality)
    : [];

  // Same phase competitors (competing for same acquirer attention)
  const samePhase = asset.phase
    ? competitors.filter(c => c.phase === asset.phase)
    : [];

  const intensity = sameModality.length >= 10 ? 85
    : sameModality.length >= 5 ? 65
    : sameModality.length >= 2 ? 45
    : (totalInIndication || 0) >= 20 ? 40
    : (totalInIndication || 0) >= 10 ? 30
    : (totalInIndication || 0) >= 5 ? 20
    : 0;

  if (intensity === 0) return null;

  const evidenceParts: string[] = [];
  if (sameModality.length > 0) {
    evidenceParts.push(`${sameModality.length} direct competitors (same ${asset.modality} modality)`);
  }
  evidenceParts.push(`${totalInIndication || competitors.length} total active assets in ${asset.indication_category}`);
  if (samePhase.length > 0) {
    evidenceParts.push(`${samePhase.length} at same phase (${asset.phase})`);
  }

  return {
    type: 'trial_crowding',
    intensity,
    evidence: evidenceParts.join('; '),
    uniqueOrgs: new Set(competitors.map(c => c.company_name)).size,
    metadata: {
      totalInIndication: totalInIndication || competitors.length,
      sameModality: sameModality.length,
      samePhase: samePhase.length,
      topCompetitors: competitors.slice(0, 5).map(c => ({ company: c.company_name, asset: c.asset_name, phase: c.phase })),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL 6: PUBLICATION RACE
// ═══════════════════════════════════════════════════════════════════════

async function detectPublicationRace(
  supabase: SupabaseClient,
  asset: AssetForIntel,
): Promise<IntelSignal | null> {
  if (!asset.therapeutic_area) return null;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: pubs } = await supabase
    .from('research_signals')
    .select('title, organization_name, published_date')
    .in('source_type', ['pubmed', 'preprint'])
    .eq('therapeutic_area', asset.therapeutic_area)
    .gte('published_date', sixMonthsAgo.toISOString().split('T')[0])
    .limit(50);

  if (!pubs || pubs.length < 5) return null;

  const orgSet = new Set<string>();
  for (const p of pubs) {
    if (p.organization_name) orgSet.add(p.organization_name);
  }

  if (orgSet.size < 3) return null;

  // Check for asset-specific publications from other groups
  const assetPubs = pubs.filter(p =>
    p.title?.toLowerCase().includes(asset.asset_name.toLowerCase()) &&
    p.organization_name &&
    !p.organization_name.toLowerCase().includes(asset.company_name.toLowerCase())
  );

  const intensity = assetPubs.length >= 3 ? 75
    : assetPubs.length >= 1 ? 55
    : pubs.length >= 30 ? 45
    : pubs.length >= 15 ? 30
    : 20;

  return {
    type: 'publication_race',
    intensity,
    evidence: assetPubs.length > 0
      ? `${assetPubs.length} publications from competing groups specifically on ${asset.asset_name}; ${pubs.length} total in ${asset.therapeutic_area} from ${orgSet.size} organizations`
      : `${pubs.length} publications in ${asset.therapeutic_area} from ${orgSet.size} organizations in 6mo — active research competition`,
    uniqueOrgs: orgSet.size,
    metadata: { totalPubs: pubs.length, assetSpecific: assetPubs.length, uniqueOrgs: orgSet.size },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITE COMPETITIVE HEAT
// ═══════════════════════════════════════════════════════════════════════

const INTEL_WEIGHTS: Record<IntelType, number> = {
  competitor_deal: 0.30,
  trial_crowding: 0.25,
  user_interest: 0.15,
  patent_overlap: 0.12,
  conference_overlap: 0.10,
  publication_race: 0.08,
};

function computeCompetitiveHeat(signals: IntelSignal[]): number {
  let weighted = 0;
  for (const s of signals) {
    weighted += s.intensity * (INTEL_WEIGHTS[s.type] ?? 0.05);
  }
  return Math.min(Math.round(weighted), 100);
}

// ═══════════════════════════════════════════════════════════════════════
// ANALYZE ONE ASSET
// ═══════════════════════════════════════════════════════════════════════

async function analyzeAsset(
  supabase: SupabaseClient,
  asset: AssetForIntel,
): Promise<IntelSignal[]> {
  const results = await Promise.all([
    detectUserInterest(supabase, asset),
    detectCompetitorDeals(supabase, asset),
    detectPatentOverlap(supabase, asset),
    detectConferenceOverlap(supabase, asset),
    detectTrialCrowding(supabase, asset),
    detectPublicationRace(supabase, asset),
  ]);

  const signals: IntelSignal[] = [];

  // Flatten: some detectors return arrays, some return single or null
  for (const r of results) {
    if (Array.isArray(r)) signals.push(...r);
    else if (r) signals.push(r);
  }

  return signals.filter(s => s.intensity > 0);
}

// ═══════════════════════════════════════════════════════════════════════
// PERSIST
// ═══════════════════════════════════════════════════════════════════════

async function persistIntel(
  supabase: SupabaseClient,
  asset: AssetForIntel,
  signals: IntelSignal[],
): Promise<number> {
  let inserted = 0;

  // Deactivate old signals for this asset
  await supabase
    .from('competitive_intel')
    .update({ is_active: false })
    .eq('asset_id', asset.id)
    .eq('is_active', true);

  // Insert new signals
  for (const signal of signals) {
    if (signal.intensity < 15) continue;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabase
      .from('competitive_intel')
      .insert({
        asset_id: asset.id,
        intel_type: signal.type,
        competitor_company_id: signal.competitorCompanyId || null,
        competitor_name: signal.competitorName || null,
        intensity: signal.intensity,
        evidence_text: signal.evidence.slice(0, 2000),
        evidence_metadata: signal.metadata || {},
        interest_count: signal.interestCount || 0,
        unique_orgs: signal.uniqueOrgs || 0,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

    if (!error) inserted++;
  }

  // Update competitive_heat on clinical_assets
  const heat = computeCompetitiveHeat(signals);
  await supabase
    .from('clinical_assets')
    .update({ competitive_heat: heat })
    .eq('id', asset.id);

  return inserted;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 240_000;
const BATCH_SIZE = 5;

export async function runCompetitiveIntel(
  supabase: SupabaseClient,
  options?: { batchSize?: number; assetIds?: string[] },
): Promise<CompetitiveIntelResult> {
  const startTime = Date.now();
  const batchSize = options?.batchSize ?? BATCH_SIZE;
  const errors: string[] = [];
  let assetsAnalyzed = 0;
  let signalsDetected = 0;
  let signalsInserted = 0;
  let heatScoresUpdated = 0;
  let timedOut = false;

  // Fetch assets to analyze (prioritize high licensing intent)
  let query = supabase
    .from('clinical_assets')
    .select('id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, partnership_status, competitive_heat')
    .gte('confidence_score', 20)
    .gt('licensing_intent_score', 0)
    .order('licensing_intent_score', { ascending: false });

  if (options?.assetIds?.length) {
    query = query.in('id', options.assetIds);
  }

  const { data: assets, error: assetError } = await query.limit(200);
  if (assetError || !assets) {
    return { assetsAnalyzed: 0, signalsDetected: 0, signalsInserted: 0, heatScoresUpdated: 0, errors: [assetError?.message || 'No assets found'], timedOut: false };
  }

  for (let i = 0; i < assets.length; i += batchSize) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    const batch = assets.slice(i, i + batchSize);

    for (const asset of batch) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

      try {
        const signals = await analyzeAsset(supabase, asset as AssetForIntel);
        signalsDetected += signals.length;

        const persisted = await persistIntel(supabase, asset as AssetForIntel, signals);
        signalsInserted += persisted;
        if (signals.length > 0) heatScoresUpdated++;
        assetsAnalyzed++;
      } catch (err) {
        errors.push(`Intel error ${asset.company_name}/${asset.asset_name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  await supabase.from('data_ingestion_log').insert({
    source: 'competitive_intel',
    status: errors.length > 0 ? 'partial' : 'success',
    records_processed: assetsAnalyzed,
    records_inserted: signalsInserted,
    records_updated: heatScoresUpdated,
    duration_seconds: duration,
    error_details: errors.length > 0 ? errors.slice(0, 20) : null,
    metadata: { signals_detected: signalsDetected, timed_out: timedOut },
  });

  console.log(`[competitive-intel] Done: ${assetsAnalyzed} assets, ${signalsDetected} signals, ${signalsInserted} inserted, ${heatScoresUpdated} heat scores updated, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { assetsAnalyzed, signalsDetected, signalsInserted, heatScoresUpdated, errors, timedOut };
}
