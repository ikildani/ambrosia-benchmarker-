import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { CalculationResult, formatCurrency } from './calculations';
import { getRelevantDeals, findComparableDeals } from './comparableDeals';
import type { CalculationInput } from './calculations';
import type { SensitivityData } from './sensitivity';

export interface PartnerForExcel {
  company_name: string;
  match_score: number;
  match_reasons: { reason: string; strength: string }[];
  deals_last_12mo: number;
  hq_country: string | null;
}

// Brand colors
const NAVY = '1A1E42';
const TEAL = '0D9488';
const CYAN = '06B6D4';
const WHITE = 'FFFFFF';
const GRAY_50 = 'F8FAFC';
const GRAY_100 = 'F1F5F9';
const GRAY_500 = '64748B';
const AMBER = 'F59E0B';
const ROSE = 'F43F5E';
const GREEN = '22C55E';

function navyFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
}
function tealFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
}
function grayFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_50 } };
}
function lightGrayFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_100 } };
}

function headerFont(size: number = 12): Partial<ExcelJS.Font> {
  return { bold: true, size, color: { argb: WHITE } };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
    left: { style: 'thin', color: { argb: 'E2E8F0' } },
    right: { style: 'thin', color: { argb: 'E2E8F0' } },
  };
}

function addSectionHeader(ws: ExcelJS.Worksheet, row: number, text: string, cols: number): void {
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = headerFont(14);
  cell.fill = navyFill();
  cell.alignment = { vertical: 'middle' };
  ws.mergeCells(row, 1, row, cols);
  for (let c = 1; c <= cols; c++) {
    ws.getCell(row, c).fill = navyFill();
  }
  ws.getRow(row).height = 28;
}

function addTableHeaders(ws: ExcelJS.Worksheet, row: number, headers: string[]): void {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = tealFill();
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
    cell.border = thinBorder();
  });
  ws.getRow(row).height = 22;
}

export async function generateExcelReport(
  result: CalculationResult,
  inputs?: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
  },
  partners?: PartnerForExcel[],
  therapeuticArea?: string,
  treatmentApproach?: string,
  sensitivityData?: SensitivityData
): Promise<void> {
  const { terms, tieredRoyalties, dealRecommendation, negotiationInsight, modifiers, labels } = result;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ambrosia Ventures';
  wb.created = new Date();

  // ── Sheet 1: Executive Summary ──
  const ws1 = wb.addWorksheet('Executive Summary', { properties: { tabColor: { argb: TEAL } } });
  ws1.columns = [{ width: 28 }, { width: 45 }];

  addSectionHeader(ws1, 1, 'DEAL VALUATION REPORT', 2);

  ws1.getCell(2, 1).value = 'Ambrosia Ventures';
  ws1.getCell(2, 1).font = { size: 10, color: { argb: GRAY_500 } };
  ws1.getCell(2, 2).value = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  ws1.getCell(2, 2).font = { size: 10, color: { argb: GRAY_500 } };
  ws1.getCell(2, 2).alignment = { horizontal: 'right' };

  // Asset profile
  let r = 4;
  addSectionHeader(ws1, r, 'ASSET PROFILE', 2);
  r++;
  const profileRows: [string, string][] = [
    ['Therapeutic Area', therapeuticArea === 'neurology' ? 'Neurology / CNS' : therapeuticArea === 'immunology' ? 'Immunology / Autoimmune' : 'Oncology'],
    ['Development Phase', labels.phase],
    ['Modality', labels.modality],
    ['Indication', labels.indication],
    ['Territory', inputs?.territory || 'Not specified'],
  ];
  profileRows.forEach(([key, val], i) => {
    const fill = i % 2 === 0 ? grayFill() : lightGrayFill();
    ws1.getCell(r, 1).value = key;
    ws1.getCell(r, 1).font = { bold: true, size: 10 };
    ws1.getCell(r, 1).fill = fill;
    ws1.getCell(r, 1).border = thinBorder();
    ws1.getCell(r, 2).value = val;
    ws1.getCell(r, 2).font = { size: 10, color: { argb: TEAL } };
    ws1.getCell(r, 2).fill = fill;
    ws1.getCell(r, 2).border = thinBorder();
    r++;
  });

  // Deal recommendation
  r++;
  addSectionHeader(ws1, r, 'RECOMMENDED STRUCTURE', 2);
  r++;
  ws1.getCell(r, 1).value = 'Upfront Allocation';
  ws1.getCell(r, 1).font = { bold: true, size: 10 };
  ws1.getCell(r, 2).value = `${dealRecommendation.upfrontPercent}%`;
  ws1.getCell(r, 2).font = { bold: true, size: 12, color: { argb: TEAL } };
  r++;
  ws1.getCell(r, 1).value = 'Milestone Allocation';
  ws1.getCell(r, 1).font = { bold: true, size: 10 };
  ws1.getCell(r, 2).value = `${dealRecommendation.milestonePercent}%`;
  ws1.getCell(r, 2).font = { bold: true, size: 12, color: { argb: TEAL } };
  r++;
  ws1.getCell(r, 1).value = 'Rationale';
  ws1.getCell(r, 1).font = { bold: true, size: 10 };
  ws1.getCell(r, 2).value = dealRecommendation.rationale;
  ws1.getCell(r, 2).font = { size: 10 };
  ws1.getCell(r, 2).alignment = { wrapText: true };
  ws1.getRow(r).height = 40;
  r += 2;

  // Negotiation insight
  addSectionHeader(ws1, r, 'NEGOTIATION INSIGHT', 2);
  r++;
  ws1.getCell(r, 1).value = negotiationInsight;
  ws1.mergeCells(r, 1, r, 2);
  ws1.getCell(r, 1).font = { size: 10, italic: true, color: { argb: NAVY } };
  ws1.getCell(r, 1).alignment = { wrapText: true };
  ws1.getRow(r).height = 50;

  // ── Sheet 2: Deal Terms ──
  const ws2 = wb.addWorksheet('Deal Terms', { properties: { tabColor: { argb: CYAN } } });
  ws2.columns = [{ width: 26 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 35 }];

  addSectionHeader(ws2, 1, 'ESTIMATED DEAL TERMS', 5);
  addTableHeaders(ws2, 3, ['Metric', 'Low', 'Median', 'High', 'Notes']);

  const termRows = [
    { label: 'Upfront Payment', vals: terms.upfront, note: 'Guaranteed payment at signing' },
    { label: 'Dev Milestones', vals: terms.devMilestones, note: 'Upon clinical milestones' },
    { label: 'Reg Milestones', vals: terms.regMilestones, note: 'Upon FDA/EMA approval' },
    { label: 'Comm Milestones', vals: terms.commMilestones, note: 'Upon sales thresholds' },
    { label: 'Total Deal Value', vals: terms.totalDealValue, note: 'If all milestones achieved' },
  ];

  termRows.forEach((t, i) => {
    const rr = 4 + i;
    const fill = i % 2 === 0 ? grayFill() : lightGrayFill();
    const isTotal = i === termRows.length - 1;

    ws2.getCell(rr, 1).value = t.label;
    ws2.getCell(rr, 1).font = { bold: isTotal, size: 10 };
    ws2.getCell(rr, 1).fill = fill;
    ws2.getCell(rr, 1).border = thinBorder();

    [t.vals.low, t.vals.median, t.vals.high].forEach((v, ci) => {
      ws2.getCell(rr, ci + 2).value = formatCurrency(v);
      ws2.getCell(rr, ci + 2).font = {
        bold: ci === 1 || isTotal,
        size: 10,
        color: { argb: ci === 1 ? TEAL : NAVY },
      };
      ws2.getCell(rr, ci + 2).fill = fill;
      ws2.getCell(rr, ci + 2).alignment = { horizontal: 'right' };
      ws2.getCell(rr, ci + 2).border = thinBorder();
    });

    ws2.getCell(rr, 5).value = t.note;
    ws2.getCell(rr, 5).font = { size: 9, color: { argb: GRAY_500 } };
    ws2.getCell(rr, 5).fill = fill;
    ws2.getCell(rr, 5).border = thinBorder();
  });

  // Royalties
  let rr = 10;
  addSectionHeader(ws2, rr, 'TIERED ROYALTIES', 5);
  rr++;
  addTableHeaders(ws2, rr, ['Sales Tier', 'Low Rate', 'High Rate', 'Threshold', '']);
  rr++;
  const royaltyRows = [
    { tier: 'Base', ...tieredRoyalties.base, threshold: '<$500M annual sales' },
    { tier: 'Mid-Tier', ...tieredRoyalties.midTier, threshold: '$500M - $1B annual sales' },
    { tier: 'High-Tier', ...tieredRoyalties.highTier, threshold: '>$1B annual sales' },
  ];
  royaltyRows.forEach((ro, i) => {
    const fill = i % 2 === 0 ? grayFill() : lightGrayFill();
    ws2.getCell(rr, 1).value = ro.tier;
    ws2.getCell(rr, 1).font = { bold: true, size: 10 };
    ws2.getCell(rr, 1).fill = fill;
    ws2.getCell(rr, 1).border = thinBorder();
    ws2.getCell(rr, 2).value = `${ro.low}%`;
    ws2.getCell(rr, 2).font = { size: 10 };
    ws2.getCell(rr, 2).fill = fill;
    ws2.getCell(rr, 2).alignment = { horizontal: 'center' };
    ws2.getCell(rr, 2).border = thinBorder();
    ws2.getCell(rr, 3).value = `${ro.high}%`;
    ws2.getCell(rr, 3).font = { size: 10, bold: true, color: { argb: TEAL } };
    ws2.getCell(rr, 3).fill = fill;
    ws2.getCell(rr, 3).alignment = { horizontal: 'center' };
    ws2.getCell(rr, 3).border = thinBorder();
    ws2.getCell(rr, 4).value = ro.threshold;
    ws2.getCell(rr, 4).font = { size: 9, color: { argb: GRAY_500 } };
    ws2.getCell(rr, 4).fill = fill;
    ws2.getCell(rr, 4).border = thinBorder();
    rr++;
  });

  // ── Sheet 3: Sensitivity Analysis ──
  if (sensitivityData && sensitivityData.parameters.length > 0) {
    const ws3 = wb.addWorksheet('Sensitivity', { properties: { tabColor: { argb: AMBER } } });
    ws3.columns = [{ width: 22 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 14 }];

    addSectionHeader(ws3, 1, 'SENSITIVITY ANALYSIS', 5);

    // Top value driver
    const td = sensitivityData.topValueDriver;
    ws3.getCell(3, 1).value = 'Top Value Driver:';
    ws3.getCell(3, 1).font = { bold: true, size: 10 };
    ws3.getCell(3, 2).value = td.parameterLabel;
    ws3.getCell(3, 2).font = { bold: true, size: 10, color: { argb: TEAL } };
    ws3.getCell(4, 1).value = td.insightText;
    ws3.mergeCells(4, 1, 4, 5);
    ws3.getCell(4, 1).font = { size: 10, italic: true };
    ws3.getCell(4, 1).alignment = { wrapText: true };
    ws3.getRow(4).height = 35;

    // Parameter table
    addTableHeaders(ws3, 6, ['Parameter', 'Current', 'Best Alternative', 'Potential Gain', 'Impact']);

    sensitivityData.parameters.slice(0, 10).forEach((p, i) => {
      const row = 7 + i;
      const fill = i % 2 === 0 ? grayFill() : lightGrayFill();
      const bestOpt = p.options.reduce((best, opt) => opt.delta > best.delta ? opt : best, p.options[0]);

      ws3.getCell(row, 1).value = p.label;
      ws3.getCell(row, 1).font = { size: 10, bold: true };
      ws3.getCell(row, 1).fill = fill;
      ws3.getCell(row, 1).border = thinBorder();

      ws3.getCell(row, 2).value = p.currentLabel;
      ws3.getCell(row, 2).font = { size: 10 };
      ws3.getCell(row, 2).fill = fill;
      ws3.getCell(row, 2).border = thinBorder();

      ws3.getCell(row, 3).value = bestOpt?.label || 'N/A';
      ws3.getCell(row, 3).font = { size: 10 };
      ws3.getCell(row, 3).fill = fill;
      ws3.getCell(row, 3).border = thinBorder();

      const gain = bestOpt && bestOpt.delta > 0 ? `+${formatCurrency(bestOpt.delta)}` : 'N/A';
      ws3.getCell(row, 4).value = gain;
      ws3.getCell(row, 4).font = { size: 10, bold: true, color: { argb: gain !== 'N/A' ? TEAL : GRAY_500 } };
      ws3.getCell(row, 4).fill = fill;
      ws3.getCell(row, 4).alignment = { horizontal: 'right' };
      ws3.getCell(row, 4).border = thinBorder();

      const impactColors: Record<string, string> = { 'VERY HIGH': ROSE, 'HIGH': AMBER, 'MEDIUM': CYAN, 'LOW': GREEN };
      ws3.getCell(row, 5).value = p.impactLevel;
      ws3.getCell(row, 5).font = { size: 9, bold: true, color: { argb: impactColors[p.impactLevel] || GRAY_500 } };
      ws3.getCell(row, 5).fill = fill;
      ws3.getCell(row, 5).alignment = { horizontal: 'center' };
      ws3.getCell(row, 5).border = thinBorder();
    });
  }

  // ── Sheet 4: Comparable Deals ──
  const comparableDeals = getRelevantDeals(
    (therapeuticArea as 'oncology' | 'neurology' | 'immunology') || 'oncology',
    labels.modality,
    labels.indication
  );
  if (comparableDeals.length > 0) {
    const ws4 = wb.addWorksheet('Comparable Deals', { properties: { tabColor: { argb: NAVY } } });
    ws4.columns = [{ width: 22 }, { width: 22 }, { width: 16 }, { width: 10 }, { width: 50 }];

    addSectionHeader(ws4, 1, 'COMPARABLE TRANSACTIONS', 5);
    addTableHeaders(ws4, 3, ['Licensor', 'Licensee', 'Deal Value', 'Year', 'Relevance']);

    comparableDeals.forEach((deal, i) => {
      const row = 4 + i;
      const fill = i % 2 === 0 ? grayFill() : lightGrayFill();
      ws4.getCell(row, 1).value = deal.licensor;
      ws4.getCell(row, 1).font = { size: 10, bold: true };
      ws4.getCell(row, 1).fill = fill;
      ws4.getCell(row, 1).border = thinBorder();
      ws4.getCell(row, 2).value = deal.licensee;
      ws4.getCell(row, 2).font = { size: 10 };
      ws4.getCell(row, 2).fill = fill;
      ws4.getCell(row, 2).border = thinBorder();
      ws4.getCell(row, 3).value = deal.value;
      ws4.getCell(row, 3).font = { size: 10, bold: true, color: { argb: TEAL } };
      ws4.getCell(row, 3).fill = fill;
      ws4.getCell(row, 3).alignment = { horizontal: 'right' };
      ws4.getCell(row, 3).border = thinBorder();
      ws4.getCell(row, 4).value = deal.year;
      ws4.getCell(row, 4).font = { size: 10 };
      ws4.getCell(row, 4).fill = fill;
      ws4.getCell(row, 4).alignment = { horizontal: 'center' };
      ws4.getCell(row, 4).border = thinBorder();
      ws4.getCell(row, 5).value = deal.relevance;
      ws4.getCell(row, 5).font = { size: 9, color: { argb: GRAY_500 } };
      ws4.getCell(row, 5).fill = fill;
      ws4.getCell(row, 5).border = thinBorder();
    });
  }

  // ── Sheet 5: Partners ──
  if (partners && partners.length > 0) {
    const ws5 = wb.addWorksheet('Partners', { properties: { tabColor: { argb: TEAL } } });
    ws5.columns = [{ width: 28 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 40 }];

    addSectionHeader(ws5, 1, 'POTENTIAL PARTNERS', 5);
    addTableHeaders(ws5, 3, ['Company', 'Match Score', 'Deals (12mo)', 'HQ Country', 'Key Match Reasons']);

    partners.forEach((p, i) => {
      const row = 4 + i;
      const fill = i % 2 === 0 ? grayFill() : lightGrayFill();
      const scoreColor = p.match_score >= 80 ? TEAL : p.match_score >= 60 ? CYAN : AMBER;

      ws5.getCell(row, 1).value = p.company_name;
      ws5.getCell(row, 1).font = { size: 10, bold: true };
      ws5.getCell(row, 1).fill = fill;
      ws5.getCell(row, 1).border = thinBorder();
      ws5.getCell(row, 2).value = `${p.match_score}%`;
      ws5.getCell(row, 2).font = { size: 11, bold: true, color: { argb: scoreColor } };
      ws5.getCell(row, 2).fill = fill;
      ws5.getCell(row, 2).alignment = { horizontal: 'center' };
      ws5.getCell(row, 2).border = thinBorder();
      ws5.getCell(row, 3).value = p.deals_last_12mo;
      ws5.getCell(row, 3).font = { size: 10 };
      ws5.getCell(row, 3).fill = fill;
      ws5.getCell(row, 3).alignment = { horizontal: 'center' };
      ws5.getCell(row, 3).border = thinBorder();
      ws5.getCell(row, 4).value = p.hq_country || 'N/A';
      ws5.getCell(row, 4).font = { size: 10 };
      ws5.getCell(row, 4).fill = fill;
      ws5.getCell(row, 4).alignment = { horizontal: 'center' };
      ws5.getCell(row, 4).border = thinBorder();
      ws5.getCell(row, 5).value = p.match_reasons.slice(0, 3).map(r => r.reason).join('; ');
      ws5.getCell(row, 5).font = { size: 9, color: { argb: GRAY_500 } };
      ws5.getCell(row, 5).fill = fill;
      ws5.getCell(row, 5).border = thinBorder();
    });
  }

  // ── Sheet 6: Methodology ──
  const ws6 = wb.addWorksheet('Methodology');
  ws6.columns = [{ width: 80 }];

  addSectionHeader(ws6, 1, 'METHODOLOGY & DISCLAIMER', 1);

  const methLines = [
    '',
    'This analysis was generated using Ambrosia Ventures\' proprietary benchmarking model.',
    '',
    'Data Sources:',
    '  - Publicly disclosed deal terms (SEC filings, press releases)',
    '  - Industry benchmark reports and market intelligence',
    '  - ClinicalTrials.gov trial registry data',
    '  - Recent transaction activity and emerging trends',
    '',
    'The algorithm weighs multiple factors including:',
    '  - Development phase and clinical data quality',
    '  - Therapeutic modality and mechanism of action',
    '  - Indication, patient population, and unmet need',
    '  - Territory scope and competitive landscape',
    '  - Regulatory designations and market dynamics',
    '',
    'IMPORTANT DISCLAIMER',
    '',
    'These estimates are for informational and planning purposes only.',
    'This does not constitute financial, legal, investment, or professional advice.',
    'Actual deal terms vary based on asset-specific factors, market conditions,',
    'negotiation dynamics, and other variables not captured in this model.',
    '',
    'Consult qualified professionals before making business decisions.',
    '',
    '\u00A9 Ambrosia Ventures - calculator.ambrosiaventures.co',
  ];
  methLines.forEach((line, i) => {
    ws6.getCell(2 + i, 1).value = line;
    ws6.getCell(2 + i, 1).font = {
      size: 10,
      bold: line === 'IMPORTANT DISCLAIMER' || line === 'Data Sources:' || line.startsWith('The algorithm'),
      color: { argb: line === 'IMPORTANT DISCLAIMER' ? ROSE : NAVY },
    };
  });

  // Generate and download
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `deal-analysis-${labels.modality.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
}

// Deal type for export
export interface DealForExcel {
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  modality: string;
  indication_category: string | null;
  phase_at_signing: string;
  territory: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  announced_date: string;
  terms_disclosed: boolean;
}

export function generateDealsExcel(deals: DealForExcel[], filters?: Record<string, string>): void {
  const wb = XLSX.utils.book_new();

  // Format currency for deals
  const formatDealCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A';
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${value.toLocaleString()}`;
  };

  // Format royalty
  const formatRoyalty = (low: number | null, high: number | null): string => {
    if (low === null && high === null) return 'N/A';
    if (low === high || high === null) return `${low}%`;
    return `${low}%-${high}%`;
  };

  // Sheet 1: Deals Data
  const dealsData = [
    ['Biotech Deal Database Export'],
    ['Generated by Ambrosia Ventures'],
    [`Export Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`],
    [`Total Deals: ${deals.length}`],
    [''],
    ['Licensor', 'Licensee', 'Asset', 'Modality', 'Indication', 'Phase', 'Deal Type', 'Upfront', 'Total Milestones', 'Total Deal Value', 'Royalties', 'Announced Date'],
    ...deals.map(deal => [
      deal.licensor_name,
      deal.licensee_name,
      deal.asset_name || 'N/A',
      deal.modality || 'N/A',
      deal.indication_category || 'N/A',
      deal.phase_at_signing || 'N/A',
      deal.deal_type || 'N/A',
      formatDealCurrency(deal.upfront_usd),
      formatDealCurrency(deal.milestones_total_usd),
      formatDealCurrency(deal.total_deal_value_usd),
      formatRoyalty(deal.royalty_low_pct, deal.royalty_high_pct),
      deal.announced_date ? new Date(deal.announced_date).toLocaleDateString() : 'N/A',
    ]),
  ];

  const dealsSheet = XLSX.utils.aoa_to_sheet(dealsData);
  dealsSheet['!cols'] = [
    { wch: 25 }, // Licensor
    { wch: 25 }, // Licensee
    { wch: 30 }, // Asset
    { wch: 18 }, // Modality
    { wch: 18 }, // Indication
    { wch: 12 }, // Phase
    { wch: 15 }, // Deal Type
    { wch: 12 }, // Upfront
    { wch: 15 }, // Total Milestones
    { wch: 15 }, // Total Deal Value
    { wch: 12 }, // Royalties
    { wch: 14 }, // Announced Date
  ];
  XLSX.utils.book_append_sheet(wb, dealsSheet, 'Deals');

  // Sheet 2: Applied Filters (if any)
  if (filters && Object.keys(filters).length > 0) {
    const filtersData = [
      ['APPLIED FILTERS'],
      [''],
      ...Object.entries(filters)
        .filter(([_, value]) => value)
        .map(([key, value]) => [key.replace(/_/g, ' ').toUpperCase(), value]),
    ];
    const filtersSheet = XLSX.utils.aoa_to_sheet(filtersData);
    filtersSheet['!cols'] = [{ wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, filtersSheet, 'Filters');
  }

  // Sheet 3: Data Notes
  const notesData = [
    ['DATA NOTES'],
    [''],
    ['Source: Ambrosia Ventures Deal Database'],
    ['Data includes publicly disclosed licensing deals, collaborations, and acquisitions.'],
    [''],
    ['Financial Terms:'],
    ['• Upfront: Cash payment at deal signing'],
    ['• Milestones: Development, regulatory, and commercial milestone payments'],
    ['• Total Deal Value: Upfront + all potential milestones'],
    ['• Royalties: Percentage of net sales paid to licensor'],
    [''],
    ['Coverage: 2019-2026'],
    ['Updates: Weekly'],
    [''],
    ['DISCLAIMER'],
    ['This data is for informational purposes only.'],
    ['Deal terms are based on publicly available information.'],
    ['Some financial details may be undisclosed or estimated.'],
    [''],
    ['© Ambrosia Ventures - calculator.ambrosiaventures.co'],
  ];

  const notesSheet = XLSX.utils.aoa_to_sheet(notesData);
  notesSheet['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, notesSheet, 'Notes');

  // Generate filename
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `biotech-deals-${timestamp}.xlsx`;

  XLSX.writeFile(wb, filename);
}
