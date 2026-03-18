'use client';

import React, { useMemo, useState, useRef, useCallback } from 'react';

// Color map for modalities (display names)
const modalityColors: Record<string, string> = {
  'Small Molecule': '#14b8a6',
  'Monoclonal Antibody': '#06b6d4',
  'ADC': '#8b5cf6',
  'Bispecific': '#f59e0b',
  'Cell Therapy': '#ec4899',
  'Gene Therapy': '#10b981',
  'RNA': '#6366f1',
  'Radiopharmaceutical': '#ef4444',
  'CAR-T': '#ec4899',
  'mRNA': '#6366f1',
  'RNAi': '#6366f1',
  'PROTAC': '#f97316',
  'Antibody': '#06b6d4',
  'Peptide': '#a855f7',
};
const defaultColor = '#14b8a6';

const modalityDisplayNames: Record<string, string> = {
  adc: 'ADC',
  car_t: 'CAR-T',
  bispecific_antibody: 'Bispecific',
  small_molecule: 'Small Molecule',
  gene_therapy: 'Gene Therapy',
  radiopharmaceutical: 'Radiopharmaceutical',
  monoclonal_antibody: 'Monoclonal Antibody',
  mrna: 'mRNA',
  rnai: 'RNAi',
  antibody: 'Antibody',
  peptide: 'Peptide',
  cell_therapy: 'Cell Therapy',
  protac: 'PROTAC',
};

function formatModality(m: string): string {
  return (
    modalityDisplayNames[m] ||
    m
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function getModalityColor(modality: string): string {
  const displayName = formatModality(modality);
  return modalityColors[displayName] || defaultColor;
}

function formatUsd(amount: number | null): string {
  if (amount == null) return 'Undisclosed';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

function formatPhase(phase: string): string {
  const map: Record<string, string> = {
    discovery: 'Discovery',
    preclinical: 'Preclinical',
    phase_1: 'Phase 1',
    phase_1_2: 'Phase 1/2',
    phase_2: 'Phase 2',
    phase_2_3: 'Phase 2/3',
    phase_3: 'Phase 3',
    approved: 'Approved',
  };
  return map[phase] || phase;
}

interface DealTimelineProps {
  deals: any[];
  companyName: string;
  isPro: boolean;
}

interface TooltipData {
  deal: any;
  x: number;
  y: number;
}

const DealTimeline = React.memo(function DealTimeline({
  deals,
  companyName,
  isPro,
}: DealTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const sortedDeals = useMemo(() => {
    return [...deals]
      .filter((d) => d.announced_date)
      .sort(
        (a, b) =>
          new Date(a.announced_date).getTime() -
          new Date(b.announced_date).getTime()
      )
      .slice(-12);
  }, [deals]);

  // Compute date range, year markers, and node positions
  const { yearMarkers, nodes, minDate, maxDate } = useMemo(() => {
    if (sortedDeals.length === 0) {
      return { yearMarkers: [], nodes: [], minDate: 0, maxDate: 0 };
    }

    const dates = sortedDeals.map((d) => new Date(d.announced_date).getTime());
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    // Add 5% padding on each side
    const range = max - min || 86400000 * 30; // at least 30 days
    const paddedMin = min - range * 0.05;
    const paddedMax = max + range * 0.05;
    const paddedRange = paddedMax - paddedMin;

    // SVG dimensions
    const svgWidth = 800;
    const leftPad = 40;
    const rightPad = 40;
    const usableWidth = svgWidth - leftPad - rightPad;

    // Year markers
    const startYear = new Date(paddedMin).getFullYear();
    const endYear = new Date(paddedMax).getFullYear();
    const markers: { x: number; year: number }[] = [];
    for (let y = startYear; y <= endYear + 1; y++) {
      const jan1 = new Date(y, 0, 1).getTime();
      if (jan1 >= paddedMin && jan1 <= paddedMax) {
        const x = leftPad + ((jan1 - paddedMin) / paddedRange) * usableWidth;
        markers.push({ x, year: y });
      }
    }

    // Deal value range for radius scaling
    const values = sortedDeals
      .map((d) => d.total_deal_value_usd)
      .filter((v): v is number => v != null && v > 0);
    const minVal = values.length > 0 ? Math.min(...values) : 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 0;
    const valRange = maxVal - minVal;

    const nodeData = sortedDeals.map((deal, idx) => {
      const t = new Date(deal.announced_date).getTime();
      const x = leftPad + ((t - paddedMin) / paddedRange) * usableWidth;
      // Radius: 8-20px proportional to deal value
      let r = 8;
      if (deal.total_deal_value_usd != null && deal.total_deal_value_usd > 0 && valRange > 0) {
        r = 8 + ((deal.total_deal_value_usd - minVal) / valRange) * 12;
      }
      const color = getModalityColor(deal.modality);
      const above = idx % 2 === 0; // even indices above, odd below
      return { deal, x, r, color, above, idx };
    });

    return {
      yearMarkers: markers,
      nodes: nodeData,
      minDate: paddedMin,
      maxDate: paddedMax,
    };
  }, [sortedDeals]);

  const handleMouseEnter = useCallback(
    (node: (typeof nodes)[0], event: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      // Position tooltip relative to container
      const scaleX = svgRect.width / 800;
      const scaleY = svgRect.height / 180;
      const x = (node.x * scaleX) + svgRect.left - rect.left;
      const y = (90 * scaleY) + svgRect.top - rect.top;
      setTooltip({ deal: node.deal, x, y });
      setHoveredIndex(node.idx);
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredIndex(null);
  }, []);

  if (sortedDeals.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Deal Timeline
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {companyName}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300 text-sm mb-1">No deal history available</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Deal timeline will appear when deal data is available for this company
          </p>
        </div>
      </div>
    );
  }

  // Build unique modalities for legend
  const legendModalities = Array.from(
    new Set(sortedDeals.map((d) => d.modality).filter(Boolean))
  ).slice(0, 6);

  return (
    <div
      ref={containerRef}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-6"
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Deal Timeline
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {companyName} &mdash; {sortedDeals.length} most recent deal
          {sortedDeals.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {legendModalities.map((m) => (
          <div key={m} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getModalityColor(m) }}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatModality(m)}
            </span>
          </div>
        ))}
      </div>

      {/* Horizontal timeline (sm and above) */}
      <div className="hidden sm:block relative">
        <svg
          ref={svgRef}
          viewBox="0 0 800 180"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto"
        >
          {/* Horizontal axis line */}
          <line
            x1={30}
            y1={90}
            x2={770}
            y2={90}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-600"
            strokeWidth={1.5}
          />

          {/* Year marker vertical lines */}
          {yearMarkers.map(({ x, year }) => (
            <g key={year}>
              <line
                x1={x}
                y1={25}
                x2={x}
                y2={155}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-600"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={x}
                y={170}
                textAnchor="middle"
                className="text-slate-500 dark:text-slate-400 fill-current"
                fontSize={11}
                fontWeight={500}
              >
                {year}
              </text>
            </g>
          ))}

          {/* Deal nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredIndex === node.idx;
            return (
              <g key={node.deal.id || node.idx}>
                {/* Connector line from node to label area */}
                <line
                  x1={node.x}
                  y1={node.above ? 90 - node.r - 2 : 90 + node.r + 2}
                  x2={node.x}
                  y2={node.above ? 50 : 130}
                  stroke={node.color}
                  strokeWidth={0.8}
                  opacity={0.4}
                />
                {/* Label */}
                <text
                  x={node.x}
                  y={node.above ? 45 : 143}
                  textAnchor="middle"
                  className="fill-current text-slate-600 dark:text-slate-300"
                  fontSize={9}
                  fontWeight={500}
                >
                  {(node.deal.asset_name || node.deal.licensee_name || '').slice(0, 16)}
                </text>
                {/* Date sub-label */}
                <text
                  x={node.x}
                  y={node.above ? 35 : 155}
                  textAnchor="middle"
                  className="fill-current text-slate-500 dark:text-slate-400"
                  fontSize={8}
                >
                  {new Date(node.deal.announced_date).toLocaleDateString(
                    'en-US',
                    { month: 'short', year: '2-digit' }
                  )}
                </text>
                {/* Circle node */}
                <circle
                  cx={node.x}
                  cy={90}
                  r={isHovered ? node.r + 2 : node.r}
                  fill={node.color}
                  opacity={isHovered ? 1 : 0.85}
                  stroke={isHovered ? '#fff' : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={(e) => handleMouseEnter(node, e)}
                  onMouseLeave={handleMouseLeave}
                />
              </g>
            );
          })}
        </svg>

        {/* HTML tooltip overlay */}
        {tooltip && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-slate-900 dark:bg-slate-700 text-white rounded-lg shadow-xl px-3 py-2 text-xs max-w-[220px]">
              <div className="font-semibold mb-1">
                {tooltip.deal.licensor_name} &rarr; {tooltip.deal.licensee_name}
              </div>
              {tooltip.deal.asset_name && (
                <div className="text-slate-300 mb-1">{tooltip.deal.asset_name}</div>
              )}
              <div className="flex items-center gap-2 text-slate-300">
                <span>
                  {new Date(tooltip.deal.announced_date).toLocaleDateString(
                    'en-US',
                    { month: 'short', day: 'numeric', year: 'numeric' }
                  )}
                </span>
                <span>&middot;</span>
                <span>{formatPhase(tooltip.deal.phase_at_signing)}</span>
              </div>
              <div className="mt-1 font-semibold">
                {isPro ? (
                  <span className="text-blue-300">
                    {formatUsd(tooltip.deal.total_deal_value_usd)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="blur-sm select-none text-slate-400">$XXM</span>
                    <span className="text-[10px] font-bold bg-navy-900 dark:bg-slate-900 text-white px-1.5 py-0.5 rounded">
                      PRO
                    </span>
                  </span>
                )}
              </div>
              {/* Arrow */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900 dark:border-t-slate-700" />
            </div>
          </div>
        )}
      </div>

      {/* Vertical timeline (mobile, below sm breakpoint) */}
      <div className="sm:hidden">
        <div className="relative ml-4 border-l-2 border-slate-200 dark:border-slate-600">
          {sortedDeals.map((deal, idx) => {
            const color = getModalityColor(deal.modality);
            return (
              <div key={deal.id || idx} className="relative pl-6 pb-5 last:pb-0">
                {/* Node circle on the line */}
                <div
                  className="absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800"
                  style={{ backgroundColor: color }}
                />
                {/* Deal card */}
                <div className="text-xs">
                  <div className="text-slate-500 dark:text-slate-400 mb-0.5">
                    {new Date(deal.announced_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {deal.licensor_name} &rarr; {deal.licensee_name}
                  </div>
                  {deal.asset_name && (
                    <div className="text-slate-500 dark:text-slate-400">
                      {deal.asset_name}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {formatModality(deal.modality)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {formatPhase(deal.phase_at_signing)}
                    </span>
                    {isPro ? (
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatUsd(deal.total_deal_value_usd)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="blur-sm select-none text-slate-300">
                          $XXM
                        </span>
                        <span className="text-[10px] font-bold bg-navy-900 dark:bg-slate-900 text-white px-1 py-0.5 rounded">
                          PRO
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default DealTimeline;
