/**
 * Visual rendering of the Zone of Possible Agreement.
 * Shows licensor floor, buyer ceiling, ZOPA band, and recommended ask/fallback.
 */

interface ZOPAChartProps {
  floorUpfront: number;
  buyerTop: number;
  recommendedOpening: number;
  recommendedFallback: number;
  currency?: string;
}

function fmtMoney(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
}

export function ZOPAChart({
  floorUpfront,
  buyerTop,
  recommendedOpening,
  recommendedFallback,
}: ZOPAChartProps) {
  const zopaWidth = buyerTop - floorUpfront;
  const agreement = zopaWidth > 0;

  // Scale: axis runs from 0 to max(recommendedOpening, buyerTop) × 1.15
  const axisMax = Math.max(recommendedOpening, buyerTop) * 1.15;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / axisMax) * 100)).toFixed(1)}%`;

  return (
    <div className="space-y-4">
      <div className="relative h-20 rounded-lg border border-slate-700/50 bg-slate-900/30 p-3">
        {/* Axis track */}
        <div className="relative h-8 rounded-full bg-slate-950/60">
          {/* ZOPA band */}
          {agreement ? (
            <div
              className="absolute top-0 h-full rounded-full bg-gradient-to-r from-teal-500/20 to-cyan-500/20"
              style={{
                left: pct(floorUpfront),
                width: `calc(${pct(buyerTop)} - ${pct(floorUpfront)})`,
              }}
            />
          ) : (
            <div
              className="absolute top-0 h-full rounded-full bg-amber-500/10"
              style={{
                left: pct(buyerTop),
                width: `calc(${pct(floorUpfront)} - ${pct(buyerTop)})`,
              }}
              title="No overlap — buyer max is below licensor floor"
            />
          )}

          {/* Licensor floor marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-slate-400"
            style={{ left: pct(floorUpfront) }}
          />
          {/* Buyer top marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-cyan-400"
            style={{ left: pct(buyerTop) }}
          />
          {/* Recommended opening */}
          <div
            className="absolute top-0 h-full w-1 bg-teal-500"
            style={{ left: pct(recommendedOpening) }}
          />
          {/* Recommended fallback */}
          <div
            className="absolute top-0 h-full w-0.5 border-l border-dashed border-teal-400/60"
            style={{ left: pct(recommendedFallback) }}
          />
        </div>
      </div>

      {/* Axis labels */}
      <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div className="rounded border border-slate-700/50 bg-slate-950/40 p-2">
          <div className="text-slate-500">Licensor floor (BATNA)</div>
          <div className="mt-0.5 font-mono text-slate-300">{fmtMoney(floorUpfront)}</div>
        </div>
        <div className="rounded border border-cyan-500/30 bg-cyan-500/5 p-2">
          <div className="text-slate-500">Buyer ceiling</div>
          <div className="mt-0.5 font-mono text-cyan-300">{fmtMoney(buyerTop)}</div>
        </div>
        <div className="rounded border border-teal-500/30 bg-teal-500/5 p-2">
          <div className="text-slate-500">Recommended opening</div>
          <div className="mt-0.5 font-mono text-teal-300">{fmtMoney(recommendedOpening)}</div>
        </div>
        <div className="rounded border border-slate-700/50 bg-slate-950/40 p-2">
          <div className="text-slate-500">Fallback anchor</div>
          <div className="mt-0.5 font-mono text-slate-300">{fmtMoney(recommendedFallback)}</div>
        </div>
      </div>

      {!agreement && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300">
          <strong>No zone of agreement</strong> — buyer&rsquo;s typical ceiling is below the
          licensor&rsquo;s BATNA. Either widen BATNA acceptance, find a different buyer, or
          restructure the deal (e.g., co-development shifts cash-now to retained upside).
        </div>
      )}
    </div>
  );
}
