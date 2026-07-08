'use client';

import { useMemo, useState } from 'react';
import { Shield, Lock, AlertTriangle, Clock, Award } from 'lucide-react';
import type { RegulatoryRiskResult } from '@/lib/financial/regulatory-risk';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RegulatoryRiskPanelProps {
  regulatoryRisk: RegulatoryRiskResult;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the arc color class based on CRL probability thresholds. */
function crlArcColor(probability: number): string {
  if (probability < 0.10) return 'stroke-green-500';
  if (probability <= 0.20) return 'stroke-amber-500';
  return 'stroke-rose-500';
}

/** Return text color class based on CRL probability thresholds. */
function crlTextColor(probability: number): string {
  if (probability < 0.10) return 'text-green-600 dark:text-green-400';
  if (probability <= 0.20) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

/** Return a semantic label for CRL risk level. */
function crlRiskLabel(probability: number): string {
  if (probability < 0.10) return 'Low Risk';
  if (probability <= 0.20) return 'Moderate Risk';
  return 'Elevated Risk';
}

/** Return badge class for CRL risk level. */
function crlBadgeClass(probability: number): string {
  if (probability < 0.10)
    return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300';
  if (probability <= 0.20)
    return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300';
  return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300';
}

/** Return color for timeline impact. */
function timelineColor(years: number): string {
  if (years < -0.10) return 'text-green-600 dark:text-green-400';
  if (years > 0.10) return 'text-red-600 dark:text-red-400';
  return 'text-slate-600 dark:text-slate-300';
}

/** Format years to months with sign. */
function formatTimelineMonths(years: number): string {
  const months = Math.abs(years * 12);
  const rounded = months < 1 ? months.toFixed(1) : Math.round(months).toString();
  if (years < -0.01) return `-${rounded}mo`;
  if (years > 0.01) return `+${rounded}mo`;
  return '0mo';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegulatoryRiskPanel({
  regulatoryRisk,
  tier,
  onUpgrade,
  onBuyReport,
}: RegulatoryRiskPanelProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [gaugeHovered, setGaugeHovered] = useState(false);

  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';
  const rr = regulatoryRisk;

  // --- Memoized arc computation for CRL gauge ---
  const gaugeArc = useMemo(() => {
    const crlPct = rr.crlProbability;
    // Semicircle: 180 degrees, radius 80, center at (100, 100)
    const radius = 80;
    const cx = 100;
    const cy = 100;
    const circumference = Math.PI * radius; // half-circle arc length
    const filledLength = circumference * Math.min(crlPct, 1);
    const bgLength = circumference;
    return { radius, cx, cy, circumference, filledLength, bgLength };
  }, [rr.crlProbability]);

  // --- PDUFA segment data ---
  const pdufahSegments = useMemo(() => {
    return [
      {
        key: 'onTime',
        label: 'On Time',
        pct: rr.pdufahRisk.onTime,
        color: 'bg-teal-500 dark:bg-teal-400',
        textColor: 'text-white dark:text-slate-900',
      },
      {
        key: 'delay3mo',
        label: '3mo Delay',
        pct: rr.pdufahRisk.delay3mo,
        color: 'bg-amber-400 dark:bg-amber-500',
        textColor: 'text-amber-900 dark:text-amber-100',
      },
      {
        key: 'delay6mo',
        label: '6mo+ Delay',
        pct: rr.pdufahRisk.delay6mo,
        color: 'bg-rose-500 dark:bg-rose-400',
        textColor: 'text-white dark:text-slate-900',
      },
    ];
  }, [rr.pdufahRisk]);

  // --- AdComm bar width ---
  const adcommBarPct = useMemo(() => {
    return Math.max(rr.adcommFavorableVoteProbability * 100, 2);
  }, [rr.adcommFavorableVoteProbability]);

  const crlPctDisplay = (rr.crlProbability * 100).toFixed(1);
  const adcommStatusText = rr.adcommRequired ? 'AdComm likely' : 'AdComm unlikely';

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* ---------------------------------------------------------------- */}
          {/* Header                                                           */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  FDA Regulatory Risk
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  CRL {crlPctDisplay}% &middot; {adcommStatusText}
                </p>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Blurred wrapper for non-pro users                                */}
          {/* ---------------------------------------------------------------- */}
          <div
            className={
              !hasAccess
                ? 'blur-[6px] pointer-events-none transition-all'
                : 'transition-all'
            }
          >
            {/* -------------------------------------------------------------- */}
            {/* 1. CRL PROBABILITY GAUGE — Semicircle SVG                      */}
            {/* -------------------------------------------------------------- */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Complete Response Letter Risk
                </h5>
              </div>

              <div className="relative bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 p-4 flex flex-col items-center">
                <div
                  className="relative cursor-default"
                  onMouseEnter={() => setGaugeHovered(true)}
                  onMouseLeave={() => setGaugeHovered(false)}
                >
                  <svg
                    width="200"
                    height="120"
                    viewBox="0 0 200 120"
                    className="overflow-visible"
                  >
                    {/* Background arc */}
                    <path
                      d={`M ${gaugeArc.cx - gaugeArc.radius} ${gaugeArc.cy} A ${gaugeArc.radius} ${gaugeArc.radius} 0 0 1 ${gaugeArc.cx + gaugeArc.radius} ${gaugeArc.cy}`}
                      fill="none"
                      className="stroke-slate-200 dark:stroke-slate-600"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    {/* Filled arc */}
                    <path
                      d={`M ${gaugeArc.cx - gaugeArc.radius} ${gaugeArc.cy} A ${gaugeArc.radius} ${gaugeArc.radius} 0 0 1 ${gaugeArc.cx + gaugeArc.radius} ${gaugeArc.cy}`}
                      fill="none"
                      className={`${crlArcColor(rr.crlProbability)} transition-all duration-500`}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${gaugeArc.filledLength} ${gaugeArc.bgLength}`}
                    />
                    {/* Center text */}
                    <text
                      x={gaugeArc.cx}
                      y={gaugeArc.cy - 20}
                      textAnchor="middle"
                      className={`text-3xl font-bold fill-current ${crlTextColor(rr.crlProbability)}`}
                      style={{ fontSize: '28px', fontWeight: 700 }}
                    >
                      {crlPctDisplay}%
                    </text>
                    <text
                      x={gaugeArc.cx}
                      y={gaugeArc.cy - 2}
                      textAnchor="middle"
                      className="fill-slate-500 dark:fill-slate-400"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                    >
                      CRL Probability
                    </text>
                  </svg>

                  {/* Hover tooltip */}
                  {gaugeHovered && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-10 bg-slate-800 dark:bg-slate-600 text-white text-[10px] leading-tight rounded px-2.5 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
                      <div className="font-semibold">
                        {crlPctDisplay}% probability of CRL issuance
                      </div>
                      <div className="text-slate-300 mt-0.5">
                        FDA CDER 2015-2024 base rates
                      </div>
                    </div>
                  )}
                </div>

                {/* Risk badge below gauge */}
                <span
                  className={`mt-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${crlBadgeClass(
                    rr.crlProbability
                  )}`}
                >
                  {crlRiskLabel(rr.crlProbability)}
                </span>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* 2. PDUFA TIMING BAR — Segmented horizontal bar                 */}
            {/* -------------------------------------------------------------- */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  PDUFA Timing Distribution
                </h5>
              </div>

              <div className="relative bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 p-3">
                <div className="flex h-8 rounded-md overflow-hidden">
                  {pdufahSegments.map((seg) => {
                    const widthPct = Math.max(seg.pct * 100, 3);
                    const isHovered = hoveredSegment === seg.key;

                    return (
                      <div
                        key={seg.key}
                        className={`relative flex items-center justify-center transition-all duration-200 cursor-default ${seg.color} ${
                          isHovered ? 'opacity-100 scale-y-110' : 'opacity-90 hover:opacity-100'
                        }`}
                        style={{ width: `${widthPct}%` }}
                        onMouseEnter={() => setHoveredSegment(seg.key)}
                        onMouseLeave={() => setHoveredSegment(null)}
                      >
                        {widthPct > 12 && (
                          <span
                            className={`text-[10px] sm:text-xs font-semibold ${seg.textColor} drop-shadow-sm`}
                          >
                            {(seg.pct * 100).toFixed(0)}%
                          </span>
                        )}

                        {/* Hover tooltip */}
                        {isHovered && (
                          <div className="absolute bottom-full mb-2 z-10 bg-slate-800 dark:bg-slate-600 text-white text-[10px] leading-tight rounded px-2 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
                            <div className="font-semibold">{seg.label}</div>
                            <div className="text-slate-300 mt-0.5">
                              {(seg.pct * 100).toFixed(1)}% probability
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between mt-2 px-0.5">
                  {pdufahSegments.map((seg) => (
                    <div key={seg.key} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-sm ${seg.color}`} />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {seg.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* 3. ADVISORY COMMITTEE SECTION                                   */}
            {/* -------------------------------------------------------------- */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Advisory Committee Assessment
              </h5>

              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        rr.adcommRequired
                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {rr.adcommRequired ? 'Required' : 'Not Required'}
                    </span>
                  </div>
                  {rr.adcommRequired && (
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {(rr.adcommFavorableVoteProbability * 100).toFixed(0)}% favorable
                    </span>
                  )}
                </div>

                {rr.adcommRequired && (
                  <>
                    {/* AdComm probability bar */}
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 w-8 flex-shrink-0">
                        Vote
                      </span>
                      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-500 dark:from-blue-500 dark:to-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${adcommBarPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Bar labels */}
                    <div className="flex justify-between mt-1 px-11">
                      <span className="text-[10px] text-red-500 dark:text-red-400">
                        Unfavorable
                      </span>
                      <span className="text-[10px] text-green-500 dark:text-green-400">
                        Favorable
                      </span>
                    </div>
                  </>
                )}

                {!rr.adcommRequired && (
                  <p className="text-xs text-neutral-500 dark:text-slate-400 leading-relaxed">
                    Based on FDA precedent, an Advisory Committee is unlikely
                    to be convened for this therapeutic area and mechanism class.
                  </p>
                )}
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* 4 & 5. PRV CALLOUT + TIMELINE IMPACT — Metric Grid             */}
            {/* -------------------------------------------------------------- */}
            <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Timeline Impact */}
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <p className="text-[10px] font-bold text-slate-500/70 dark:text-slate-400/70 uppercase tracking-wider mb-1">
                  Timeline Impact
                </p>
                <p className={`text-sm font-bold ${timelineColor(rr.timelineImpact_years)}`}>
                  {formatTimelineMonths(rr.timelineImpact_years)}
                </p>
                <p className="text-[10px] text-slate-500/50 dark:text-slate-400/40 mt-0.5">
                  {rr.timelineImpact_years < -0.10
                    ? 'Net acceleration'
                    : rr.timelineImpact_years > 0.10
                    ? 'Expected delay'
                    : 'Neutral timeline'}
                </p>
              </div>

              {/* PDUFA On-Time Rate */}
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <p className="text-[10px] font-bold text-slate-500/70 dark:text-slate-400/70 uppercase tracking-wider mb-1">
                  PDUFA On-Time
                </p>
                <p
                  className={`text-sm font-bold ${
                    rr.pdufahRisk.onTime >= 0.85
                      ? 'text-teal-700 dark:text-teal-400'
                      : rr.pdufahRisk.onTime >= 0.75
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {(rr.pdufahRisk.onTime * 100).toFixed(0)}%
                </p>
                <p className="text-[10px] text-slate-500/50 dark:text-slate-400/40 mt-0.5">
                  First-cycle action
                </p>
              </div>

              {/* PRV Value */}
              <div
                className={`p-3 rounded-lg border ${
                  rr.prvEligible
                    ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                }`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    rr.prvEligible
                      ? 'text-teal-500/70 dark:text-teal-400/70'
                      : 'text-slate-500/70 dark:text-slate-400/70'
                  }`}
                >
                  PRV Value
                </p>
                <div className="flex items-center gap-1">
                  {rr.prvEligible && (
                    <Award className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  )}
                  <p
                    className={`text-sm font-bold ${
                      rr.prvEligible
                        ? 'text-teal-700 dark:text-teal-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {rr.prvEligible ? `$${rr.prvValue_M}M` : 'N/A'}
                  </p>
                </div>
                <p
                  className={`text-[10px] mt-0.5 ${
                    rr.prvEligible
                      ? 'text-teal-500/50 dark:text-teal-400/40'
                      : 'text-slate-500/50 dark:text-slate-400/40'
                  }`}
                >
                  {rr.prvEligible ? 'Voucher eligible' : 'Not eligible'}
                </p>
              </div>

              {/* Accelerated Approval Risk */}
              <div
                className={`p-3 rounded-lg border ${
                  rr.acceleratedApprovalRisk.eligible
                    ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                }`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    rr.acceleratedApprovalRisk.eligible
                      ? 'text-purple-500/70 dark:text-purple-400/70'
                      : 'text-slate-500/70 dark:text-slate-400/70'
                  }`}
                >
                  Accel. Approval
                </p>
                <p
                  className={`text-sm font-bold ${
                    rr.acceleratedApprovalRisk.eligible
                      ? rr.acceleratedApprovalRisk.confirmatoryFailureProbability > 0.20
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-purple-700 dark:text-purple-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {rr.acceleratedApprovalRisk.eligible
                    ? `${(rr.acceleratedApprovalRisk.confirmatoryFailureProbability * 100).toFixed(0)}% fail`
                    : 'N/A'}
                </p>
                <p
                  className={`text-[10px] mt-0.5 ${
                    rr.acceleratedApprovalRisk.eligible
                      ? 'text-purple-500/50 dark:text-purple-400/40'
                      : 'text-slate-500/50 dark:text-slate-400/40'
                  }`}
                >
                  {rr.acceleratedApprovalRisk.eligible
                    ? 'Confirmatory trial risk'
                    : 'Standard pathway'}
                </p>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* 6. NARRATIVE — Callout div                                      */}
            {/* -------------------------------------------------------------- */}
            <div className="p-3 sm:p-4 bg-gradient-to-r from-rose-50/50 to-orange-50/50 dark:from-rose-500/5 dark:to-orange-500/5 rounded-lg border border-rose-100 dark:border-rose-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <h5 className="text-sm font-semibold text-navy-800 dark:text-white">
                  Regulatory Assessment
                </h5>
              </div>
              <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">
                {rr.narrative}
              </p>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Pro Gate Overlay                                                  */}
          {/* ---------------------------------------------------------------- */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() =>
                  onBuyReport ? onBuyReport() : onUpgrade?.()
                }
                aria-label="Unlock Regulatory Risk Analysis"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <Lock className="w-4 h-4" />
                Unlock Regulatory Risk Analysis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
