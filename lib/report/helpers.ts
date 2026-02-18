// Formatting utilities for report generation

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString('en-US')}`;
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

export function parseDealValue(valueStr: string): number | null {
  const cleaned = valueStr.replace(/[^0-9.BMK+]/gi, '');
  const match = cleaned.match(/([\d.]+)\s*(B|M|K)?/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'B') return num * 1_000_000_000;
  if (suffix === 'M') return num * 1_000_000;
  if (suffix === 'K') return num * 1_000;
  return num;
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
    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #0d9488, #06b6d4); border-radius: 4px;"></div>
        <span style="font-size: 10px; font-weight: 600; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase;">Ambrosia Ventures</span>
      </div>
      <div style="font-size: 9px; color: #94a3b8;">
        ${escapeHtml(reportTitle)} &mdash; Page ${pageNum} of ${totalPages}
      </div>
    </div>
  `;
}

// Page footer HTML for consistent branding across pages
export function pageFooter(reportId: string): string {
  const now = formatDate();
  return `
    <div style="position: absolute; bottom: 30px; left: 50px; right: 50px; display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #e2e8f0;">
      <span style="font-size: 8px; color: #94a3b8;">CONFIDENTIAL &mdash; ${now}</span>
      <span style="font-size: 8px; color: #94a3b8;">Report ID: ${reportId}</span>
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
    default:
      return { primary: COLORS.teal, light: COLORS.tealLight, label: ta };
  }
}
