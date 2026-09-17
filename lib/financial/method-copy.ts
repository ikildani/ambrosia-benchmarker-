/**
 * Method statement: plain-language account of how a published number was
 * produced. Used by the share page, the brief page, and the public
 * methodology page so every surface tells the same story.
 *
 * Voice: a peer dealmaker explaining their work. No engine plumbing words
 * ("backtest", "calibration corpus", "modifier stack"); say what was
 * compared, how many transactions, and how the methods were weighed.
 */

export type EnsembleMethodName = 'rNPV' | 'Comparable Transactions' | 'Real Options';

/** Optional valuation context embedded in a shared calculation. */
export interface ShareFinancialSummary {
  riskAdjustedNPV: number;
  confidenceInterval80: { low: number; high: number };
  cumulativePoS: number;
  yearsToMarket?: number;
  discountRate?: number;
  /** Projected peak annual sales used by the rNPV method ($M). */
  peakSalesMedianM?: number;
  /** rNPV-implied total deal value, median ($M). */
  rnpvImpliedTotalMedianM?: number;
  /** How the Monte Carlo distribution was aligned with the engine. */
  monteCarloRecentering?: 'scale' | 'shift' | 'none';
  ensemble?: {
    /** Blended fair value ($M). */
    valueM: number;
    /** Standard error of the blend ($M). */
    stdDevM: number;
    agreement: 'tight' | 'moderate' | 'wide';
    /** True before Phase 2, where comparables carry the blend by rule. */
    earlyPhasePrior?: boolean;
    methods: Array<{
      name: EnsembleMethodName;
      valueM: number;
      /** 0..1, all methods sum to 1 */
      weight: number;
      sampleSize?: number;
      confidence: 'high' | 'medium' | 'low';
    }>;
  };
}

export interface MethodStatementInput {
  summary?: ShareFinancialSummary | null;
  /** Number of disclosed transactions behind the deal-term range, when known. */
  benchmarkSampleSize?: number | null;
  /** Human phase label, e.g. "Phase 2". */
  phaseLabel?: string | null;
}

export interface MethodStatementLine {
  label: string;
  text: string;
}

const fmtM = (m: number): string => {
  if (!Number.isFinite(m)) return '';
  if (Math.abs(m) >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
};

const METHOD_LABEL: Record<EnsembleMethodName, string> = {
  rNPV: 'risk-adjusted cash flows',
  'Comparable Transactions': 'comparable transactions',
  'Real Options': 'option value of the remaining development gates',
};

/** Static copy shared with the public methodology page. */
export const METHOD_COPY = {
  heading: 'How this number was produced',
  range: (n: number | null | undefined, phaseLabel?: string | null): string =>
    n && n > 0
      ? `The deal-term range comes from ${n} disclosed transactions for assets at ${phaseLabel ? `${phaseLabel} ` : ''}this stage, adjusted for indication, modality and deal structure. It answers one question: what buyers have actually paid for assets like this one.`
      : 'The deal-term range comes from disclosed transactions for assets at this stage, adjusted for indication, modality and deal structure. It answers one question: what buyers have actually paid for assets like this one.',
  sourcing:
    'Comparable transactions are drawn only from records that survived dedupe and review. Rows flagged or rejected in verification are excluded, and every verified row carries a citation to the filing or press release it came from.',
  ensembleIntro:
    'The blended fair value weighs three independent methods by how tightly each one is known. A method with a wide spread gets less weight, so the headline leans on whichever method the evidence supports best.',
  earlyPhaseRule:
    'Before Phase 2, the risk-adjusted cash flow method has little signal: the probability of approval is in the single digits and launch is a decade away, so its value lands near zero however good the asset is. At those stages the blend is set to lean on comparable transactions, which are anchored in prices buyers paid.',
  rnpv: (s: ShareFinancialSummary): string => {
    const parts: string[] = [];
    if (Number.isFinite(s.cumulativePoS)) parts.push(`a ${(s.cumulativePoS * 100).toFixed(0)}% probability of reaching approval from here`);
    if (Number.isFinite(s.yearsToMarket as number)) parts.push(`${(s.yearsToMarket as number).toFixed(1)} years to market`);
    if (Number.isFinite(s.discountRate as number)) parts.push(`a ${((s.discountRate as number) * 100).toFixed(0)}% discount rate`);
    if (Number.isFinite(s.peakSalesMedianM as number) && (s.peakSalesMedianM as number) > 0) parts.push(`peak annual sales of ${fmtM(s.peakSalesMedianM as number)}`);
    const inputs = parts.length ? ` It assumes ${parts.join(', ')}.` : '';
    const mc = s.monteCarloRecentering && s.monteCarloRecentering !== 'none'
      ? ' The 80% band around it comes from ten thousand simulated outcomes centred on the same estimate.'
      : '';
    return `The risk-adjusted NPV discounts the asset's projected cash flows and weights them by the chance each development stage succeeds.${inputs}${mc}`;
  },
};

/**
 * Build the method statement lines for a published calculation. Lines are
 * omitted, never dashed, when the underlying value is absent.
 */
export function buildMethodStatement(input: MethodStatementInput): MethodStatementLine[] {
  const lines: MethodStatementLine[] = [];
  const s = input.summary ?? null;

  lines.push({ label: 'Deal-term range', text: METHOD_COPY.range(input.benchmarkSampleSize, input.phaseLabel) });

  if (s?.ensemble && s.ensemble.methods.length > 0) {
    const weighted = [...s.ensemble.methods]
      .filter(m => m.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .map(m => {
        const n = m.name === 'Comparable Transactions' && m.sampleSize ? ` from ${m.sampleSize} deals` : '';
        return `${METHOD_LABEL[m.name]} ${fmtM(m.valueM)}${n} at ${Math.round(m.weight * 100)}%`;
      });
    const agreement =
      s.ensemble.agreement === 'tight'
        ? 'The three methods agree closely.'
        : s.ensemble.agreement === 'moderate'
          ? 'The methods differ moderately; the range above is the safer reference.'
          : 'The methods differ widely; treat the blended figure as a midpoint and lean on the range above.';
    lines.push({
      label: 'Blended fair value',
      text: `${METHOD_COPY.ensembleIntro} Here: ${weighted.join('; ')}. ${agreement}${s.ensemble.earlyPhasePrior ? ` ${METHOD_COPY.earlyPhaseRule}` : ''}`,
    });
  }

  if (s && Number.isFinite(s.riskAdjustedNPV)) {
    lines.push({ label: 'Risk-adjusted NPV', text: METHOD_COPY.rnpv(s) });
  }

  lines.push({ label: 'Sourcing', text: METHOD_COPY.sourcing });
  return lines;
}
