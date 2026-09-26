import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveTherapeuticArea, resolvePhase, resolveIndication, resolveModality } from '@/lib/brief/intake-map';
import { getPeakSalesBaseline } from '@/components/calculator/peakSalesBaseline';
import { getCumulativePoS, PHASE_DURATION } from '@/lib/financial/pos-tables';
import epiData from '@/data/epidemiology.json';
import type { EpidemiologyData } from '@/lib/financial/types';

/**
 * What Solidus currently sees for a profile the client is describing at
 * intake: our peak-sales estimate, cumulative probability of success, years to
 * launch, how many comparable deals qualify, and the most active buyers at
 * that stage in that area. Shown next to the client's own fields so their
 * number sits beside ours before the brief is built.
 *
 * Public, read-only, no client data, cached 15 minutes per profile.
 */

export const dynamic = 'force-dynamic';

const PHASE_ORDER = ['discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved'];
const DB_PHASE: Record<string, string> = { discovery: 'discovery', preclinical: 'preclinical', phase1: 'phase_1', phase1_2: 'phase_1', phase2: 'phase_2', phase2_3: 'phase_2', phase3: 'phase_3', nda_filed: 'phase_3', approved: 'approved' };

export interface IntakeContext {
  ta: string;
  phase: string;
  indication: { key: string; label: string; matched: boolean };
  solidus: {
    peakSalesM: number | null;
    /** Cumulative PoS with the client's evidence answers applied. */
    cumulativePoSPct: number | null;
    /** Cumulative PoS with no designations, unselected population, default route: the reference the answers move from. */
    basePoSPct: number | null;
    yearsToLaunch: number | null;
  };
  comps: {
    eligible: number;
    window: string;
    /** Disclosed upfront and total quartiles of the eligible set, $M. */
    upfront: { p25: number; p50: number; p75: number } | null;
    total: { p25: number; p50: number; p75: number } | null;
  };
  topBuyers: Array<{ name: string; deals: number }>;
}

export interface EvidenceFlags { orphan: boolean; breakthrough: boolean; fastTrack: boolean; prime: boolean; biomarker: boolean; route: string }

function quartiles(values: number[]): { p25: number; p50: number; p75: number } | null {
  const v = values.filter(x => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length < 4) return null;
  const q = (f: number) => { const i = (v.length - 1) * f; const lo = Math.floor(i), hi = Math.ceil(i); return Math.round(v[lo] + (v[hi] - v[lo]) * (i - lo)); };
  return { p25: q(0.25), p50: q(0.5), p75: q(0.75) };
}

const REMAINING_STEPS: Record<string, string[]> = {
  discovery: ['discovery', 'preclinical', 'phase1', 'phase2', 'phase3', 'nda_filed'],
  preclinical: ['preclinical', 'phase1', 'phase2', 'phase3', 'nda_filed'],
  phase1: ['phase1', 'phase2', 'phase3', 'nda_filed'],
  phase1_2: ['phase1_2', 'phase3', 'nda_filed'],
  phase2: ['phase2', 'phase3', 'nda_filed'],
  phase2_3: ['phase2_3', 'nda_filed'],
  phase3: ['phase3', 'nda_filed'],
  nda_filed: ['nda_filed'],
  approved: [],
};

async function computeContext(taLabel: string, phaseLabel: string, indicationText: string, modalityLabel: string, flagsJson: string): Promise<IntakeContext> {
  let flags: EvidenceFlags = { orphan: false, breakthrough: false, fastTrack: false, prime: false, biomarker: false, route: '' };
  try { flags = { ...flags, ...(JSON.parse(flagsJson || '{}') as Partial<EvidenceFlags>) }; } catch { /* defaults */ }
  const ta = resolveTherapeuticArea(taLabel);
  const phase = resolvePhase(phaseLabel);
  const modality = resolveModality(modalityLabel || null, 'smallMolecule');
  const ind = resolveIndication(indicationText, ta);
  const dbPhase = DB_PHASE[phase] ?? 'phase_2';
  const idx = PHASE_ORDER.indexOf(dbPhase);
  const window = PHASE_ORDER.slice(Math.max(0, idx - 1), Math.min(PHASE_ORDER.length, idx + 2));

  const peak = getPeakSalesBaseline({
    indication: ind.key, phase, totalDealValueMedian: null,
    epidemiologyDataset: (epiData as { indications: Record<string, EpidemiologyData> }).indications, territory: 'global', competitivePosition: 'racing', therapeuticArea: ta,
  });
  let pos: number | null = null;
  let basePos: number | null = null;
  const noDesignations = { breakthrough: false, fastTrack: false, orphan: false, prime: false };
  try { basePos = getCumulativePoS(phase, ta, modality, 'none', noDesignations, ind.key).cumulativePoS; } catch { basePos = null; }
  try {
    pos = getCumulativePoS(phase, ta, modality, flags.biomarker ? 'selected' : 'none', { breakthrough: flags.breakthrough, fastTrack: flags.fastTrack, orphan: flags.orphan, prime: flags.prime }, ind.key, undefined, undefined, flags.route || undefined).cumulativePoS;
  } catch { pos = basePos; }
  const durations = PHASE_DURATION[ta] ?? PHASE_DURATION.oncology;
  const years = (REMAINING_STEPS[phase] ?? REMAINING_STEPS.phase2).reduce((sum, p) => sum + (durations[p] ?? 0), 0);

  let eligible = 0;
  const buyers = new Map<string, number>();
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('deals')
      .select('licensee_name, announced_date, upfront_usd, total_deal_value_usd')
      .eq('terms_disclosed', true)
      .eq('is_synthetic', false)
      .or('is_canonical.is.null,is_canonical.eq.true')
      .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
      .or('verification_status.eq.verified,confidence_score.is.null,confidence_score.gte.75')
      .eq('therapeutic_area', ta)
      .in('phase_at_signing', window)
      .gt('total_deal_value_usd', 0)
      .order('announced_date', { ascending: false })
      .limit(1000);
    const cutoff = new Date().getUTCFullYear() - 6;
    const display = new Map<string, string>();
    const upfronts: number[] = [];
    const totals: number[] = [];
    for (const d of (data ?? []) as Array<{ licensee_name: string | null; announced_date: string | null; upfront_usd: number | null; total_deal_value_usd: number | null }>) {
      eligible++;
      if (d.upfront_usd) upfronts.push(d.upfront_usd / 1e6);
      if (d.total_deal_value_usd) totals.push(d.total_deal_value_usd / 1e6);
      const y = d.announced_date ? Number(d.announced_date.slice(0, 4)) : 0;
      if (!d.licensee_name || y < cutoff) continue;
      const k = buyerKey(d.licensee_name);
      if (!display.has(k)) display.set(k, d.licensee_name.trim());
      buyers.set(k, (buyers.get(k) ?? 0) + 1);
    }
    const topBuyers = [...buyers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, deals]) => ({ name: display.get(k) ?? k, deals }));
    return finish(topBuyers, quartiles(upfronts), quartiles(totals));
  } catch { /* count stays 0 */ }
  return finish([], null, null);

  function finish(topBuyers: Array<{ name: string; deals: number }>, upfront: IntakeContext['comps']['upfront'], total: IntakeContext['comps']['total']): IntakeContext {
    const pct = (x: number | null) => (x != null ? Math.round(x * 1000) / 10 : null);
    return {
      ta, phase,
      indication: { key: ind.key, label: ind.label, matched: ind.how !== 'default' },
      solidus: { peakSalesM: peak?.median ?? null, cumulativePoSPct: pct(pos), basePoSPct: pct(basePos), yearsToLaunch: years > 0 ? Math.round(years * 10) / 10 : null },
      comps: { eligible, window: window.join(', '), upfront, total },
      topBuyers,
    };
  }
}

/** "Eli Lilly and Company", "Eli Lilly", "Eli Lilly & Co." → one buyer. */
function buyerKey(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/[.,]/g, ' ')
    .replace(/\b(and company|and co|company|inc|incorporated|ltd|limited|plc|corporation|corp|co|sa|ag|nv|gmbh|holdings|pharmaceuticals?|pharma|therapeutics|biosciences|sciences)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();

}

const cached = unstable_cache(computeContext, ['intake-context-v3'], { revalidate: 900 });

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const ta = (sp.get('ta') ?? '').slice(0, 60);
  const phase = (sp.get('phase') ?? '').slice(0, 40);
  const indication = (sp.get('indication') ?? '').slice(0, 160);
  const modality = (sp.get('modality') ?? '').slice(0, 40);
  const flags = (sp.get('flags') ?? '').slice(0, 200);
  if (!ta || !phase) return NextResponse.json({ error: 'ta and phase required' }, { status: 400 });
  try {
    const ctx = await cached(ta, phase, indication, modality, flags);
    return NextResponse.json(ctx, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
