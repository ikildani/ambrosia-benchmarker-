// Server-side SVG chart renderer for embeddable widgets.
// Pure string-based SVG generation — no external dependencies.

import { getBenchmarksSync } from '@/lib/benchmarks';

export interface ChartRenderParams {
  type: 'phase-upfront' | 'ta-comparison' | 'modality-premium' | 'territory-split';
  ta?: string;
  theme?: 'light' | 'dark';
}

interface BarItem {
  label: string;
  value: number;
  displayValue: string;
  highlight?: boolean;
}

// ── Theme colors ────────────────────────────────────────────────────────────

function getColors(theme: 'light' | 'dark') {
  return {
    bg: theme === 'dark' ? '#111827' : '#ffffff',
    text: theme === 'dark' ? '#e5e7eb' : '#374151',
    subtext: theme === 'dark' ? '#9ca3af' : '#6b7280',
    barFill: '#0EA5A5',
    barHighlight: '#2563eb',
    labelBg: theme === 'dark' ? '#1f2937' : '#f9fafb',
  };
}

// ── TA display names ────────────────────────────────────────────────────────

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
  womensHealth: "Women's Health",
};

// ── Phase baselines key mapping ─────────────────────────────────────────────

const TA_BASELINES_KEY: Record<string, string> = {
  oncology: 'phaseBaselines',
  neurology: 'neurologyPhaseBaselines',
  immunology: 'immunologyPhaseBaselines',
  metabolic: 'metabolicPhaseBaselines',
  cardiovascular: 'cardiovascularPhaseBaselines',
  infectiousDisease: 'infectiousDiseasePhaseBaselines',
  ophthalmology: 'ophthalmologyPhaseBaselines',
  womensHealth: 'womensHealthPhaseBaselines',
  rareDisease: 'rareDiseasePhaseBaselines',
  hematology: 'hematologyPhaseBaselines',
  dermatology: 'dermatologyPhaseBaselines',
  gastroenterology: 'gastroenterologyPhaseBaselines',
};

// ── Data extractors ─────────────────────────────────────────────────────────

function getPhaseUpfrontData(ta: string): BarItem[] {
  const benchmarks = getBenchmarksSync();
  const key = TA_BASELINES_KEY[ta] || 'phaseBaselines';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baselines = (benchmarks as any)[key] as Record<string, { upfront: { median: number } }>;

  const phases: { key: string; label: string }[] = [
    { key: 'preclinical', label: 'Preclinical' },
    { key: 'phase1', label: 'Phase 1' },
    { key: 'phase2', label: 'Phase 2' },
    { key: 'phase3', label: 'Phase 3' },
    { key: 'approved', label: 'Approved' },
  ];

  return phases.map((p, i) => {
    const val = baselines[p.key]?.upfront?.median ?? 0;
    return {
      label: p.label,
      value: val,
      displayValue: `$${val}M`,
      highlight: i === phases.length - 1, // highlight approved
    };
  });
}

function getTAComparisonData(): BarItem[] {
  const benchmarks = getBenchmarksSync();
  const keyTAs = [
    'oncology', 'neurology', 'immunology', 'rareDisease',
    'hematology', 'cardiovascular', 'metabolic', 'ophthalmology',
  ];

  return keyTAs.map((ta, i) => {
    const key = TA_BASELINES_KEY[ta] || 'phaseBaselines';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baselines = (benchmarks as any)[key] as Record<string, { upfront: { median: number } }>;
    const val = baselines.phase2?.upfront?.median ?? 0;
    return {
      label: TA_LABELS[ta] || ta,
      value: val,
      displayValue: `$${val}M`,
      highlight: i === 0, // highlight first (oncology)
    };
  });
}

function getModalityPremiumData(): BarItem[] {
  const benchmarks = getBenchmarksSync();
  const modalities: { key: string; label: string }[] = [
    { key: 'adc', label: 'ADC' },
    { key: 'bispecific', label: 'Bispecific' },
    { key: 'radiopharmaceutical', label: 'Radiopharm' },
    { key: 'carT_heme', label: 'CAR-T' },
    { key: 'mrna', label: 'mRNA' },
    { key: 'smallMolecule', label: 'Small Molecule' },
  ];

  return modalities.map((m, i) => {
    const mod = benchmarks.modalities[m.key];
    const val = mod?.multiplier ?? 1;
    return {
      label: m.label,
      value: val,
      displayValue: `${val.toFixed(2)}x`,
      highlight: i === 0, // highlight ADC
    };
  });
}

function getTerritorySplitData(): BarItem[] {
  const benchmarks = getBenchmarksSync();
  const territories: { key: string; label: string }[] = [
    { key: 'global', label: 'Global' },
    { key: 'us_only', label: 'US' },
    { key: 'ex_us', label: 'Ex-US' },
    { key: 'europe', label: 'EU' },
    { key: 'japan', label: 'Japan' },
    { key: 'china', label: 'China' },
  ];

  return territories.map((t, i) => {
    const terr = benchmarks.territories[t.key];
    const pct = Math.round((terr?.multiplier ?? 0) * 100);
    return {
      label: t.label,
      value: pct,
      displayValue: `${pct}%`,
      highlight: i === 0, // highlight global
    };
  });
}

// ── Chart title ─────────────────────────────────────────────────────────────

function getChartTitle(type: ChartRenderParams['type'], ta?: string): string {
  switch (type) {
    case 'phase-upfront':
      return `Median Upfront by Phase — ${TA_LABELS[ta || 'oncology'] || ta || 'Oncology'}`;
    case 'ta-comparison':
      return 'Phase 2 Median Upfront by Therapeutic Area';
    case 'modality-premium':
      return 'Modality Premium Multipliers';
    case 'territory-split':
      return 'Territory Value as % of Global';
    default:
      return 'Biopharma Deal Benchmarks';
  }
}

// ── SVG renderer ────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderChartSVG(params: ChartRenderParams): string {
  const { type, ta = 'oncology', theme = 'light' } = params;
  const colors = getColors(theme);

  // Get data based on chart type
  let items: BarItem[];
  switch (type) {
    case 'phase-upfront':
      items = getPhaseUpfrontData(ta);
      break;
    case 'ta-comparison':
      items = getTAComparisonData();
      break;
    case 'modality-premium':
      items = getModalityPremiumData();
      break;
    case 'territory-split':
      items = getTerritorySplitData();
      break;
    default:
      items = getPhaseUpfrontData(ta);
  }

  const title = getChartTitle(type, ta);

  // Layout constants
  const width = 600;
  const height = 380;
  const marginLeft = 130;
  const marginRight = 80;
  const marginTop = 50;
  const marginBottom = 40;
  const barAreaWidth = width - marginLeft - marginRight;
  const barCount = items.length;
  const barSpacing = 8;
  const availableHeight = height - marginTop - marginBottom;
  const barHeight = Math.min(36, (availableHeight - barSpacing * (barCount - 1)) / barCount);
  const totalBarsHeight = barCount * barHeight + (barCount - 1) * barSpacing;
  const startY = marginTop + (availableHeight - totalBarsHeight) / 2;

  // Find max value for scale
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  // Build bar elements
  const bars = items
    .map((item, idx) => {
      const y = startY + idx * (barHeight + barSpacing);
      const barWidth = Math.max(4, (item.value / maxValue) * barAreaWidth);
      const fill = item.highlight ? colors.barHighlight : colors.barFill;
      const labelY = y + barHeight / 2 + 5;

      return `
    <text x="${marginLeft - 10}" y="${labelY}" text-anchor="end"
          font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="${colors.text}">
      ${escapeXml(item.label)}
    </text>
    <rect x="${marginLeft}" y="${y}" width="${barWidth}" height="${barHeight}"
          rx="3" ry="3" fill="${fill}" opacity="0.9"/>
    <text x="${marginLeft + barWidth + 8}" y="${labelY}" text-anchor="start"
          font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="${colors.text}">
      ${escapeXml(item.displayValue)}
    </text>`;
    })
    .join('\n');

  // Full SVG
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${colors.bg}" rx="8" ry="8"/>
  <text x="${width / 2}" y="30" text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="${colors.text}">
    ${escapeXml(title)}
  </text>
${bars}
  <text x="${width / 2}" y="${height - 12}" text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${colors.subtext}">
    Source: Ambrosia Ventures | solidus.ambrosiaventures.co
  </text>
</svg>`;
}
