// Formatting utilities for report generation
import { logoIconColor } from './logo';

// Values from the calculation engine are in MILLIONS (e.g., 150 = $150M, 1500 = $1.5B)
// This matches formatCurrency in lib/calculations.ts
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value as number)) return 'N/A';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(1)}B`;
  if (absValue >= 1) return `${sign}$${Math.round(absValue)}M`;
  if (absValue > 0) return `${sign}$${Math.round(absValue * 1000)}K`;
  return '$0';
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date?: Date): string {
  const d = date || new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatShortDate(date?: Date): string {
  const d = date || new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

// Parses deal value strings like "$1.2B" or "$500M" and returns value in MILLIONS
// to match the calculation engine convention
export function parseDealValue(valueStr: string): number | null {
  const cleaned = valueStr.replace(/[^0-9.BMK+]/gi, '');
  const match = cleaned.match(/([\d.]+)\s*(B|M|K)?/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'B') return num * 1000;     // $1.2B → 1200 (millions)
  if (suffix === 'M') return num;             // $500M → 500 (millions)
  if (suffix === 'K') return num / 1000;      // $500K → 0.5 (millions)
  return num;                                 // assume millions
}

export function generateReportId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AMB-${datePart}-${randomPart}`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Page header HTML for consistent branding across pages
export function pageHeader(pageNum: number, totalPages: number, reportTitle: string): string {
  return `
    <div style="margin-bottom: 22px;">
      <!-- Navy top bar -->
      <div style="background: #1a1e42; padding: 8px 16px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${logoIconColor(16)}
          <span style="font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.7); letter-spacing: 0.14em; text-transform: uppercase;">Ambrosia Ventures</span>
        </div>
        <div style="display: flex; align-items: center; gap: 14px;">
          <span style="font-size: 8px; color: rgba(255,255,255,0.4); letter-spacing: 0.03em;">${escapeHtml(reportTitle)}</span>
          <span style="font-size: 9px; font-weight: 700; color: #5eead4; background: rgba(94,234,212,0.1); padding: 2px 8px; border-radius: 3px;">${pageNum} / ${totalPages}</span>
        </div>
      </div>
    </div>
  `;
}

// Page footer HTML — uses absolute positioning at bottom of report-page
export function pageFooter(reportId: string): string {
  const now = formatDate();
  return `
    <div style="position: absolute; bottom: 24px; left: 48px; right: 48px; display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 2px solid #e2e8f0;">
      <span style="font-size: 7px; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600;">Confidential &middot; ${now}</span>
      <span style="font-size: 7px; color: #64748b; letter-spacing: 0.04em;">Powered by <span style="color: #0d9488; font-weight: 700;">Ambrosia Ventures</span> &middot; solidus.ambrosiaventures.co</span>
      <span style="font-size: 7px; color: #0d9488; font-weight: 700; letter-spacing: 0.04em;">${reportId}</span>
    </div>
  `;
}

// Label lookups
export const phaseLabels: Record<string, string> = {
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  approved: 'Approved',
};

export const territoryLabels: Record<string, string> = {
  global: 'Global (Worldwide)',
  us_only: 'US Only',
  us_eu: 'US + EU',
  ex_us: 'Ex-US',
  ex_china: 'Ex-China',
  japan_only: 'Japan Only',
  china_only: 'China Only',
  apac: 'Asia-Pacific',
};

export const modalityLabels: Record<string, string> = {
  smallMolecule: 'Small Molecule',
  mab: 'Monoclonal Antibody',
  bispecific: 'Bispecific Antibody',
  trispecificAntibody: 'Trispecific Antibody',
  adc: 'Antibody-Drug Conjugate',
  cellTherapy: 'Cell Therapy (CAR-T/NK)',
  geneTherapy: 'Gene Therapy',
  rnai: 'RNAi/siRNA',
  mrna: 'mRNA Therapeutic',
  peptide: 'Peptide/Cyclic Peptide',
  aso: 'Antisense Oligonucleotide',
  radiopharm: 'Radiopharmaceutical',
  vaccine: 'Cancer Vaccine',
  degrader: 'Molecular Glue/PROTAC',
  bbbPlatform: 'BBB Delivery Platform',
  psychedelic: 'Psychedelic/Neuroplastogen',
  tl1aInhibitor: 'TL1A Inhibitor',
  s1pModulator: 'S1P Modulator',
  jakInhibitor: 'JAK Inhibitor',
  fcrnAntagonist: 'FcRn Antagonist',
  dualAntagonist: 'BAFF/APRIL Antagonist',
  complementInhibitor: 'Complement Inhibitor',
  oralIntegrin: 'Oral Integrin Inhibitor',
  inVivoCarT: 'In Vivo CAR-T',
};

export const competitivePositionLabels: Record<string, string> = {
  firstInClass: 'First-in-Class',
  firstToPivotal: 'First to Pivotal',
  bestInClass: 'Best-in-Class',
  fastFollower: 'Fast Follower',
  racing: 'Racing',
  behind: 'Behind',
  crowded: 'Crowded',
};

export const dataQualityLabels: Record<string, string> = {
  pivotalReady: 'Pivotal-Ready',
  strongPhase2: 'Strong Phase 2',
  promising: 'Promising',
  mixed: 'Mixed',
  limited: 'Limited',
};

export function getLabel(value: string, map: Record<string, string>): string {
  return map[value] || value;
}

// Brand colors
export const COLORS = {
  navy: '#1a1e42',
  teal: '#0d9488',
  cyan: '#06b6d4',
  tealLight: '#ccfbf1',
  tealMid: '#5eead4',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  rose: '#f43f5e',
  roseLight: '#ffe4e6',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
  blue: '#3b82f6',
  blueLight: '#dbeafe',
  green: '#22c55e',
  greenLight: '#dcfce7',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  white: '#ffffff',
};

// Therapeutic area accent colors
export function getTAColors(ta: string): { primary: string; light: string; label: string } {
  switch (ta) {
    case 'oncology':
      return { primary: COLORS.rose, light: COLORS.roseLight, label: 'Oncology' };
    case 'neurology':
      return { primary: COLORS.purple, light: COLORS.purpleLight, label: 'Neurology' };
    case 'immunology':
      return { primary: COLORS.blue, light: COLORS.blueLight, label: 'Immunology' };
    case 'metabolic':
      return { primary: COLORS.green, light: COLORS.greenLight, label: 'Metabolic / Obesity' };
    case 'cardiovascular':
      return { primary: COLORS.rose, light: COLORS.roseLight, label: 'Cardiovascular' };
    case 'infectiousDisease':
      return { primary: '#f97316', light: '#fff7ed', label: 'Infectious Disease' };
    case 'ophthalmology':
      return { primary: COLORS.teal, light: COLORS.tealLight, label: 'Ophthalmology' };
    case 'womensHealth':
      return { primary: '#ec4899', light: '#fdf2f8', label: "Women's Health" };
    default:
      return { primary: COLORS.teal, light: COLORS.tealLight, label: ta };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Brief v3 format helpers — every Brief page uses these so the document reads
// as one system: same title, same section head, same source line, same empty
// state. Do not hand-roll these in page files.
// ═══════════════════════════════════════════════════════════════════════════

/** Report title printed in every page header. */
export const BRIEF_TITLE = 'Deal Intelligence Brief';

/** Large section head with the one-line question the page answers. */
export function sectionHead(title: string, question: string): string {
  return `
    <div class="section-title-lg" style="margin-bottom: 6px;">${escapeHtml(title)}</div>
    <div style="font-size: 10px; color: ${COLORS.gray500}; margin: 0 0 14px 16px; font-style: italic;">${escapeHtml(question)}</div>
  `;
}

/** Source line under a chart or table: "Source · n · as of". */
export function chartSource(note: { source: string; n: number; asOf: string; note?: string }): string {
  const asOf = formatShortDate(new Date(note.asOf));
  return `
    <div style="font-size: 7.5px; color: ${COLORS.gray400}; margin-top: 6px; letter-spacing: 0.02em;">
      Source: ${escapeHtml(note.source)} &middot; n = ${note.n.toLocaleString()} &middot; as of ${asOf}${note.note ? ` &middot; ${escapeHtml(note.note)}` : ''}
    </div>
  `;
}

/** Honest empty state when a section has no data. Never render placeholder numbers. */
export function emptyState(title: string, message: string): string {
  return `
    <div class="card" style="text-align: center; padding: 28px 20px; border-style: dashed;">
      <div style="font-size: 11px; font-weight: 700; color: ${COLORS.gray500}; margin-bottom: 4px;">${escapeHtml(title)}</div>
      <div style="font-size: 9.5px; color: ${COLORS.gray400}; line-height: 1.5;">${escapeHtml(message)}</div>
    </div>
  `;
}

/** Compact $M formatter for chart labels: 12 → "$12M", 1400 → "$1.4B", null → "—". */
export function fmtM(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value.toFixed(digits)}M`;
}

/** Percent formatter for shares: 0.42 → "42%". */
export function fmtShare(share: number | null | undefined, digits = 0): string {
  if (share == null || !Number.isFinite(share)) return '—';
  return `${(share * 100).toFixed(digits)}%`;
}

/** Small uppercase label used above KPI values and table groups. */
export function microLabel(text: string): string {
  return `<div style="font-size: 7px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${COLORS.gray400}; margin-bottom: 3px;">${escapeHtml(text)}</div>`;
}

/** Phase label lookup tolerant of deals-table keys (phase_1) and calc keys (phase1). */
export function phaseLabelAny(phase: string | null | undefined): string {
  if (!phase) return 'Unknown';
  const k = phase.replace(/_/g, '').toLowerCase();
  const map: Record<string, string> = {
    discovery: 'Discovery', preclinical: 'Preclinical', phase1: 'Phase 1', phase12: 'Phase 1/2',
    phase2: 'Phase 2', phase23: 'Phase 2/3', phase3: 'Phase 3', approved: 'Approved', nda: 'NDA/BLA', unknown: 'Unknown',
  };
  return map[k] ?? phase;
}
