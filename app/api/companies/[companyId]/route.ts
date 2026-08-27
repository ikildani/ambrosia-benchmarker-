import { requireSingleSession } from "@/lib/auth/require-single-session";
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const { companyId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(companyId)) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    // Check user tier
    let userTier = 'free';
    if (userId && UUID_REGEX.test(userId)) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', userId)
        .single();
      if (profile?.tier) userTier = profile.tier;
    }

    const isPro = userTier === 'pro' || userTier === 'report' || userTier === 'portfolio';

    // Fetch company profile
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Sanitize company name for PostgREST filter safety (commas/dots could break .or() syntax)
    const companyName = (company.name || '').replace(/[,.()"'\\]/g, '').replace(/[%_]/g, '\\$&');
    const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Parallel queries for all data
    const [
      allDealsResult,
      trialsResult,
      allDealsForTrend,
    ] = await Promise.all([
      // Recent deals (last 12 months) — only real (non-synthetic) deals
      // R68 (2026-04-15): comment said "only real" but filter was missing.
      supabase
        .from('deals')
        .select('id, licensor_name, licensee_name, asset_name, modality, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, indication_category, therapeutic_area, deal_type, milestones_total_usd, royalty_low_pct, royalty_high_pct')
        .or(`licensee_id.eq.${companyId},licensor_id.eq.${companyId},licensee_name.eq.${companyName},licensor_name.eq.${companyName}`)
        .eq('is_synthetic', false)
        .gte('announced_date', oneYearAgo)
        .order('announced_date', { ascending: false })
        .limit(50),

      // Active trials (no limit — need accurate count for summary)
      supabase
        .from('company_trials')
        .select('nct_id, trial_title, phase, status, modality, indication_category, start_date, primary_completion_date, enrollment_count')
        .eq('company_id', companyId)
        .in('status', ['recruiting', 'active_not_recruiting', 'enrolling_by_invitation', 'not_yet_recruiting'])
        .order('start_date', { ascending: false }),

      // All deals for trend (3 years) — only real deals (R68: added filter)
      supabase
        .from('deals')
        .select('announced_date, modality, upfront_usd, indication_category')
        .or(`licensee_id.eq.${companyId},licensor_id.eq.${companyId},licensee_name.eq.${companyName},licensor_name.eq.${companyName}`)
        .eq('is_synthetic', false)
        .gte('announced_date', threeYearsAgo)
        .order('announced_date', { ascending: true }),
    ]);

    const deals = allDealsResult.data || [];
    const trials = trialsResult.data || [];
    const trendDeals = allDealsForTrend.data || [];

    // --- Computed: Deal flow trend (quarterly) ---
    const dealFlowTrend: { quarter: string; count: number; total_upfront: number | null }[] = [];
    const quarterMap = new Map<string, { count: number; upfront: number }>();
    for (const d of trendDeals) {
      const date = new Date(d.announced_date);
      const q = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
      const existing = quarterMap.get(q) || { count: 0, upfront: 0 };
      existing.count++;
      if (d.upfront_usd) existing.upfront += d.upfront_usd;
      quarterMap.set(q, existing);
    }
    // Fill in missing quarters
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
      const q = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      const data = quarterMap.get(q);
      dealFlowTrend.push({
        quarter: q,
        count: data?.count || 0,
        total_upfront: data?.upfront || null,
      });
    }
    // Deduplicate quarters
    const seenQuarters = new Set<string>();
    const uniqueTrend = dealFlowTrend.filter(t => {
      if (seenQuarters.has(t.quarter)) return false;
      seenQuarters.add(t.quarter);
      return true;
    });

    // --- Computed: Pipeline by phase ---
    const pipelineByPhase: Record<string, number> = {};
    for (const trial of trials) {
      const phase = trial.phase || 'unknown';
      pipelineByPhase[phase] = (pipelineByPhase[phase] || 0) + 1;
    }

    // --- Computed: Pipeline by indication ---
    const pipelineByIndication: Record<string, { count: number; phases: Record<string, number> }> = {};
    for (const trial of trials) {
      const indication = trial.indication_category || 'other';
      if (!pipelineByIndication[indication]) {
        pipelineByIndication[indication] = { count: 0, phases: {} };
      }
      pipelineByIndication[indication].count++;
      const phase = trial.phase || 'unknown';
      pipelineByIndication[indication].phases[phase] = (pipelineByIndication[indication].phases[phase] || 0) + 1;
    }

    // --- Computed: Deals by modality breakdown ---
    const dealsByModality: Record<string, number> = {};
    for (const d of deals) {
      const mod = d.modality || 'other';
      dealsByModality[mod] = (dealsByModality[mod] || 0) + 1;
    }

    // --- Computed: Competitive peers (companies with overlapping modalities) ---
    let competitivePeers: { id: string; name: string; company_type: string; overlap_score: number; shared_modalities: string[]; deal_count?: number; modalities_count?: number }[] = [];
    if (company.modalities_active && company.modalities_active.length > 0) {
      const { data: peerCandidates } = await supabase
        .from('companies')
        .select('id, name, company_type, modalities_active, indications_active')
        .neq('id', companyId)
        .limit(200);

      if (peerCandidates) {
        const myModalities = new Set<string>(company.modalities_active || []);
        const myIndications = new Set<string>(company.indications_active || []);
        // Max possible overlap = all modalities shared (×2 weight) + all indications shared
        const maxPossibleScore = myModalities.size * 2 + myIndications.size;

        competitivePeers = peerCandidates
          .map(peer => {
            const peerMods = new Set<string>(peer.modalities_active || []);
            const peerInds = new Set<string>(peer.indications_active || []);
            const sharedMods = [...myModalities].filter(m => peerMods.has(m));
            const sharedInds = [...myIndications].filter(i => peerInds.has(i));
            const rawScore = sharedMods.length * 2 + sharedInds.length;
            // Normalize to 0-1 range so the frontend can display as percentage
            const normalizedScore = maxPossibleScore > 0 ? rawScore / maxPossibleScore : 0;
            return {
              id: peer.id,
              name: peer.name,
              company_type: peer.company_type,
              overlap_score: Math.round(normalizedScore * 100) / 100,
              shared_modalities: sharedMods,
            };
          })
          .filter(p => p.overlap_score > 0)
          .sort((a, b) => b.overlap_score - a.overlap_score)
          .slice(0, 8);
      }
    }

    // --- Enrich top 3 peers with deal count and modality count for comparison view ---
    if (competitivePeers.length > 0) {
      const topPeerIds = competitivePeers.slice(0, 3).map((p) => p.id);
      // Fetch deals for each top peer in the last 12 months to derive stats
      const { data: peerDeals } = await supabase
        .from('deals')
        .select('licensee_id, licensor_id, modality')
        .or(topPeerIds.map(id => `licensee_id.eq.${id},licensor_id.eq.${id}`).join(','))
        .eq('is_synthetic', false)  // R68
        .gte('announced_date', oneYearAgo);

      if (peerDeals) {
        for (const peer of competitivePeers.slice(0, 3)) {
          const peerDealList = peerDeals.filter(
            (d: any) => d.licensee_id === peer.id || d.licensor_id === peer.id
          );
          peer.deal_count = peerDealList.length;
          const peerMods = new Set(peerDealList.map((d: any) => d.modality).filter(Boolean));
          peer.modalities_count = peerMods.size;
        }
      }
    }

    // --- Computed: Market position ---
    let marketPosition: { deal_volume_rank: number | null; total_companies: number; primary_modality: string | null; modality_rank: number | null } | null = null;
    {
      // Overall deal volume rank
      const { data: allCompanyDealCounts } = await supabase
        .from('companies')
        .select('id, deals_last_12mo')
        .order('deals_last_12mo', { ascending: false, nullsFirst: false });

      if (allCompanyDealCounts) {
        const rank = allCompanyDealCounts.findIndex(c => c.id === companyId) + 1;
        const primaryMod = Object.entries(dealsByModality).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

        marketPosition = {
          deal_volume_rank: rank > 0 ? rank : null,
          total_companies: allCompanyDealCounts.length,
          primary_modality: primaryMod,
          modality_rank: null,
        };
      }
    }

    // --- Computed: Benchmark comparison ---
    let benchmarkComparison = null;
    if (isPro && deals.length > 0) {
      const companyDealsWithUpfront = deals.filter(d => d.upfront_usd != null && d.upfront_usd > 0);
      const companyAvgUpfront = companyDealsWithUpfront.length > 0
        ? companyDealsWithUpfront.reduce((sum, d) => sum + d.upfront_usd, 0) / companyDealsWithUpfront.length
        : null;

      const { data: marketAvgData } = await supabase
        .from('deals')
        .select('upfront_usd')
        .eq('is_synthetic', false)  // R68
        .gte('announced_date', oneYearAgo)
        .not('upfront_usd', 'is', null)
        .gt('upfront_usd', 0);

      const marketDeals = marketAvgData || [];
      const marketAvg = marketDeals.length > 0
        ? marketDeals.reduce((sum, d) => sum + d.upfront_usd, 0) / marketDeals.length
        : null;

      benchmarkComparison = {
        company_avg_upfront: companyAvgUpfront,
        market_avg_upfront: marketAvg,
        company_deal_count: companyDealsWithUpfront.length,
        market_deal_count: marketDeals.length,
      };
    }

    // --- Computed: Auto-generated summary ---
    const totalDeals = trendDeals.length;
    const topModality = Object.entries(dealsByModality).sort(([, a], [, b]) => b - a)[0];
    const topIndication = Object.entries(pipelineByIndication).sort(([, a], [, b]) => b.count - a.count)[0];
    const typeLabel = ({ large_pharma: 'large pharmaceutical company', mid_pharma: 'mid-size pharmaceutical company', large_biotech: 'large biotechnology company', mid_biotech: 'biotechnology company' } as Record<string, string>)[company.company_type] || 'life sciences company';

    let summary = `${company.name} is a ${typeLabel}`;
    if (company.hq_country) summary += ` headquartered in ${company.hq_country}`;
    summary += '.';

    if (totalDeals > 0) {
      summary += ` Over the past 3 years, the company has been involved in ${totalDeals} licensing transaction${totalDeals !== 1 ? 's' : ''}`;
      if (topModality) summary += `, with particular focus on ${formatModality(topModality[0])} (${topModality[1]} deal${topModality[1] !== 1 ? 's' : ''})`;
      summary += '.';
    }

    if (trials.length > 0) {
      summary += ` The company currently has ${trials.length} active clinical trial${trials.length !== 1 ? 's' : ''}`;
      if (topIndication) summary += `, primarily in ${formatIndication(topIndication[0])}`;
      summary += '.';
    }

    if (isPro && company.acquisition_appetite) {
      const appetiteLabel = ({ aggressive: 'an aggressive', moderate: 'a moderate', selective: 'a selective' } as Record<string, string>)[company.acquisition_appetite] || 'an active';
      summary += ` ${company.name} demonstrates ${appetiteLabel} acquisition appetite based on recent deal activity.`;
    }

    // --- Build response ---
    const profile = {
      id: company.id,
      name: company.name,
      company_type: company.company_type,
      hq_country: company.hq_country,
      acquisition_appetite: isPro ? company.acquisition_appetite : null,
      modalities_active: company.modalities_active,
      indications_active: company.indications_active,
      deals_last_12mo: company.deals_last_12mo,
      active_trials_count: company.active_trials_count,
      patent_cliffs: isPro ? company.patent_cliffs : null,
      strategic_priorities: isPro ? company.strategic_priorities : null,
      last_deal_date: company.last_deal_date,
      actively_acquiring: company.actively_acquiring,
    };

    const gatedDeals = isPro
      ? deals
      : deals.slice(0, 3).map(d => ({ ...d, upfront_usd: null, total_deal_value_usd: null }));

    const gatedTrials = isPro ? trials : trials.slice(0, 5);

    // Compute licensing window from company data
    let licensingWindow = null;
    try {
      const { computeLicensingWindow } = await import('@/lib/services/licensing-window');
      const dealsLast12 = profile.deals_last_12mo || 0;
      const appetite = profile.acquisition_appetite || 'inactive';
      const simpleIntentScore =
        (dealsLast12 >= 3 ? 70 : dealsLast12 >= 1 ? 50 : 20) +
        (appetite === 'aggressive' ? 20 : appetite === 'moderate' ? 10 : 0);

      licensingWindow = computeLicensingWindow(
        {
          intentScore: Math.min(simpleIntentScore, 100),
          lastDealDate: profile.last_deal_date,
          activelyAcquiring: profile.actively_acquiring,
          acquisitionAppetite: appetite,
          indicationsActive: profile.indications_active || [],
        },
        undefined,
        undefined,
      );
    } catch {}

    return NextResponse.json({
      company: profile,
      summary,
      recent_deals: gatedDeals,
      active_trials: gatedTrials,
      pipeline_by_phase: pipelineByPhase,
      pipeline_by_indication: isPro ? pipelineByIndication : Object.fromEntries(
        Object.entries(pipelineByIndication).map(([k, v]) => [k, { count: v.count, phases: {} }])
      ),
      deal_flow_trend: uniqueTrend,
      deals_by_modality: dealsByModality,
      competitive_peers: competitivePeers.map(p => isPro ? p : { ...p, shared_modalities: [] }),
      market_position: marketPosition,
      benchmark_comparison: benchmarkComparison,
      licensingWindow,
      is_pro: isPro,
    });
  } catch (error) {
    console.error('Company profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatModality(m: string): string {
  const names: Record<string, string> = {
    adc: 'ADC', car_t: 'CAR-T', bispecific_antibody: 'bispecific antibodies',
    small_molecule: 'small molecules', gene_therapy: 'gene therapy',
    radiopharmaceutical: 'radiopharmaceuticals', monoclonal_antibody: 'monoclonal antibodies',
    mrna: 'mRNA therapeutics', rnai: 'RNAi', antibody: 'antibodies', peptide: 'peptides',
    cell_therapy: 'cell therapy', protac: 'PROTACs',
  };
  return names[m] || m.replace(/_/g, ' ');
}

function formatIndication(ind: string): string {
  const names: Record<string, string> = {
    solid_tumor: 'solid tumors', hematological: 'hematological malignancies',
    cns: 'CNS disorders', autoimmune: 'autoimmune diseases',
    cardiovascular: 'cardiovascular disease', infectious: 'infectious disease',
    metabolic: 'metabolic disorders', rare_disease: 'rare diseases',
    respiratory: 'respiratory disease', dermatology: 'dermatology',
    ophthalmology: 'ophthalmology',
  };
  return names[ind] || ind.replace(/_/g, ' ');
}
