import { NextRequest, NextResponse } from 'next/server';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';

const DIMENSION_CONTRIBUTIONS = [
  { name: 'rNPV Core', contribution_pct: 60 },
  { name: 'Monte Carlo', contribution_pct: 8 },
  { name: 'Real Options', contribution_pct: 5 },
  { name: 'Ensemble Valuation', contribution_pct: 4 },
  { name: 'Deal Structure Optimizer', contribution_pct: 3 },
  { name: 'Counterparty Premiums', contribution_pct: 5 },
  { name: 'RWE Auto-Tuning', contribution_pct: 2 },
  { name: 'Risk Decomposition', contribution_pct: 3 },
  { name: 'Macro Factors', contribution_pct: 2 },
  { name: 'Subpopulation', contribution_pct: 2 },
  { name: 'Patent Cliff', contribution_pct: 3 },
  { name: 'Combination Therapy', contribution_pct: 1 },
  { name: 'Geographic Decomposition', contribution_pct: 1 },
  { name: 'Time-Windowed PoS', contribution_pct: 1 },
] as const;

/** Reference asset: Phase 2 oncology mAb, $2B peak sales, racing competitive position */
function getBaselineValue(): number {
  try {
    const result = calculateRNPV({
      phase: 'phase2',
      therapeuticArea: 'oncology',
      modality: 'mab',
      indication: 'lung_nsclc',
      territory: 'global',
      peakSalesEstimate: { low: 1200, median: 2000, high: 3200 },
      competitivePosition: 'racing',
      dataQuality: 'moderate',
      regulatoryDesignations: {
        breakthrough: false,
        fastTrack: false,
        orphan: false,
        prime: false,
      },
      dealType: 'licensing',
    });
    return Math.round(result.riskAdjustedNPV);
  } catch {
    // Fallback if engine call fails for any reason
    return 485;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const enabledDimensions: string[] = body.enabledDimensions || DIMENSION_CONTRIBUTIONS.map((d) => d.name);

    const baseline = getBaselineValue();

    const dimensions = DIMENSION_CONTRIBUTIONS.map((d) => ({
      name: d.name,
      contribution_pct: d.contribution_pct,
      enabled: enabledDimensions.includes(d.name),
    }));

    return NextResponse.json({ baseline, dimensions });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
