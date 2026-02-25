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
const BLUE = '3B82F6';

// Chart component colors (for Deal Value Composition bars)
const CHART_COLORS: Record<string, string> = {
  upfront: TEAL,
  dev: BLUE,
  reg: AMBER,
  comm: GREEN,
};

// Conditional formatting colors for positive/negative values
const POS_FILL = 'DCFCE7';
const POS_FONT = '166534';
const NEG_FILL = 'FFE4E6';
const NEG_FONT = '9F1239';

// Number format strings
const CURRENCY_FMT = '$#,##0.0"M"';
const PERCENT_FMT = '0.0%';

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
function positiveFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: POS_FILL } };
}
function negativeFill(): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: NEG_FILL } };
}

/** Apply conditional green/red styling to a cell based on a numeric value */
function applyConditionalStyle(cell: ExcelJS.Cell, value: number, baseFontSize: number = 10): void {
  if (value > 0) {
    cell.fill = positiveFill();
    cell.font = { ...cell.font, size: baseFontSize, bold: true, color: { argb: POS_FONT } };
  } else if (value < 0) {
    cell.fill = negativeFill();
    cell.font = { ...cell.font, size: baseFontSize, bold: true, color: { argb: NEG_FONT } };
  }
}

/** Set print area on a worksheet given row/col bounds */
function setPrintArea(ws: ExcelJS.Worksheet, lastRow: number, lastCol: number): void {
  const colLetter = String.fromCharCode(64 + Math.min(lastCol, 26));
  ws.pageSetup = {
    ...ws.pageSetup,
    printArea: `A1:${colLetter}${lastRow}`,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
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

/** Build a visual horizontal bar string using Unicode block characters.
 *  Returns a string of repeated '█' proportional to `value / maxValue`, capped at `maxBlocks`. */
function buildBarString(value: number, maxValue: number, maxBlocks: number = 25): string {
  if (maxValue <= 0 || value <= 0) return '\u2014'; // em-dash for zero values
  const blocks = Math.max(1, Math.round((value / maxValue) * maxBlocks));
  return '\u2588'.repeat(blocks);
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
  const ws1 = wb.addWorksheet('Executive Summary', {
    properties: { tabColor: { argb: TEAL } },
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
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
    ['Therapeutic Area', therapeuticArea === 'neurology' ? 'Neurology / CNS' : therapeuticArea === 'immunology' ? 'Immunology / Autoimmune' : therapeuticArea === 'metabolic' ? 'Metabolic / Obesity' : therapeuticArea === 'cardiovascular' ? 'Cardiovascular' : therapeuticArea === 'infectiousDisease' ? 'Infectious Disease' : therapeuticArea === 'ophthalmology' ? 'Ophthalmology' : therapeuticArea === 'womensHealth' ? "Women's Health" : 'Oncology'],
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
  const upfrontCell = ws1.getCell(r, 2);
  upfrontCell.value = dealRecommendation.upfrontPercent / 100;
  upfrontCell.numFmt = '0%';
  upfrontCell.font = { bold: true, size: 12, color: { argb: TEAL } };
  r++;
  ws1.getCell(r, 1).value = 'Milestone Allocation';
  ws1.getCell(r, 1).font = { bold: true, size: 10 };
  const milestoneCell = ws1.getCell(r, 2);
  milestoneCell.value = dealRecommendation.milestonePercent / 100;
  milestoneCell.numFmt = '0%';
  milestoneCell.font = { bold: true, size: 12, color: { argb: TEAL } };
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

  // Print area for Executive Summary
  setPrintArea(ws1, r, 2);

  // ── Sheet 2: Deal Terms ──
  const ws2 = wb.addWorksheet('Deal Terms', {
    properties: { tabColor: { argb: CYAN } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws2.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 38 }];

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
      const cell = ws2.getCell(rr, ci + 2);
      cell.value = v; // raw numeric value (in $M)
      cell.numFmt = CURRENCY_FMT;
      cell.font = {
        bold: ci === 1 || isTotal,
        size: 10,
        color: { argb: ci === 1 ? TEAL : NAVY },
      };
      cell.fill = fill;
      cell.alignment = { horizontal: 'right' };
      cell.border = thinBorder();
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
    const lowCell = ws2.getCell(rr, 2);
    lowCell.value = ro.low / 100; // convert percentage to decimal for Excel
    lowCell.numFmt = PERCENT_FMT;
    lowCell.font = { size: 10 };
    lowCell.fill = fill;
    lowCell.alignment = { horizontal: 'center' };
    lowCell.border = thinBorder();
    const highCell = ws2.getCell(rr, 3);
    highCell.value = ro.high / 100; // convert percentage to decimal for Excel
    highCell.numFmt = PERCENT_FMT;
    highCell.font = { size: 10, bold: true, color: { argb: TEAL } };
    highCell.fill = fill;
    highCell.alignment = { horizontal: 'center' };
    highCell.border = thinBorder();
    ws2.getCell(rr, 4).value = ro.threshold;
    ws2.getCell(rr, 4).font = { size: 9, color: { argb: GRAY_500 } };
    ws2.getCell(rr, 4).fill = fill;
    ws2.getCell(rr, 4).border = thinBorder();
    rr++;
  });

  // ── Deal Value Composition (visual bar chart) ──
  rr += 2;
  addSectionHeader(ws2, rr, 'DEAL VALUE COMPOSITION (Median)', 5);
  rr++;
  addTableHeaders(ws2, rr, ['Component', 'Value', 'Visual', '', '% of Total']);
  rr++;

  const compositionComponents = [
    { label: 'Upfront Payment', value: terms.upfront.median, colorKey: 'upfront' },
    { label: 'Dev Milestones', value: terms.devMilestones.median, colorKey: 'dev' },
    { label: 'Reg Milestones', value: terms.regMilestones.median, colorKey: 'reg' },
    { label: 'Comm Milestones', value: terms.commMilestones.median, colorKey: 'comm' },
  ];
  const totalMedian = terms.totalDealValue.median;
  const maxComponentValue = Math.max(...compositionComponents.map(c => c.value));

  compositionComponents.forEach((comp, i) => {
    const fill = i % 2 === 0 ? grayFill() : lightGrayFill();
    const barColor = CHART_COLORS[comp.colorKey] || TEAL;
    const pctOfTotal = totalMedian > 0 ? comp.value / totalMedian : 0;
    const barString = buildBarString(comp.value, maxComponentValue, 25);

    // Column A: Component name
    ws2.getCell(rr, 1).value = comp.label;
    ws2.getCell(rr, 1).font = { bold: true, size: 10 };
    ws2.getCell(rr, 1).fill = fill;
    ws2.getCell(rr, 1).border = thinBorder();

    // Column B: Value ($XM)
    const valCell = ws2.getCell(rr, 2);
    valCell.value = comp.value;
    valCell.numFmt = CURRENCY_FMT;
    valCell.font = { size: 10, bold: true, color: { argb: barColor } };
    valCell.fill = fill;
    valCell.alignment = { horizontal: 'right' };
    valCell.border = thinBorder();

    // Columns C-D: Visual bar (merged) with colored font
    ws2.mergeCells(rr, 3, rr, 4);
    const barCell = ws2.getCell(rr, 3);
    barCell.value = barString;
    barCell.font = { size: 11, color: { argb: barColor } };
    barCell.fill = fill;
    barCell.alignment = { vertical: 'middle' };
    barCell.border = thinBorder();
    // Apply border to the merged end cell too
    ws2.getCell(rr, 4).border = thinBorder();

    // Column E: % of Total
    const pctCell = ws2.getCell(rr, 5);
    pctCell.value = pctOfTotal;
    pctCell.numFmt = '0.0%';
    pctCell.font = { size: 10, bold: true, color: { argb: barColor } };
    pctCell.fill = fill;
    pctCell.alignment = { horizontal: 'center' };
    pctCell.border = thinBorder();

    rr++;
  });

  // Total row for composition
  const totalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  ws2.getCell(rr, 1).value = 'Total Deal Value';
  ws2.getCell(rr, 1).font = { bold: true, size: 10, color: { argb: WHITE } };
  ws2.getCell(rr, 1).fill = totalFill;
  ws2.getCell(rr, 1).border = thinBorder();

  const totalValCell = ws2.getCell(rr, 2);
  totalValCell.value = totalMedian;
  totalValCell.numFmt = CURRENCY_FMT;
  totalValCell.font = { bold: true, size: 10, color: { argb: WHITE } };
  totalValCell.fill = totalFill;
  totalValCell.alignment = { horizontal: 'right' };
  totalValCell.border = thinBorder();

  ws2.mergeCells(rr, 3, rr, 4);
  ws2.getCell(rr, 3).value = '\u2588'.repeat(25); // full bar for total
  ws2.getCell(rr, 3).font = { size: 11, color: { argb: WHITE } };
  ws2.getCell(rr, 3).fill = totalFill;
  ws2.getCell(rr, 3).alignment = { vertical: 'middle' };
  ws2.getCell(rr, 3).border = thinBorder();
  ws2.getCell(rr, 4).border = thinBorder();

  const totalPctCell = ws2.getCell(rr, 5);
  totalPctCell.value = 1;
  totalPctCell.numFmt = '0.0%';
  totalPctCell.font = { bold: true, size: 10, color: { argb: WHITE } };
  totalPctCell.fill = totalFill;
  totalPctCell.alignment = { horizontal: 'center' };
  totalPctCell.border = thinBorder();

  ws2.getRow(rr).height = 22;
  rr++;

  // Print area for Deal Terms (landscape)
  setPrintArea(ws2, rr - 1, 5);

  // ── Sheet 3: Sensitivity Analysis ──
  if (sensitivityData && sensitivityData.parameters.length > 0) {
    const ws3 = wb.addWorksheet('Sensitivity', {
      properties: { tabColor: { argb: AMBER } },
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws3.columns = [{ width: 24 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 22 }, { width: 16 }];

    addSectionHeader(ws3, 1, 'SENSITIVITY ANALYSIS', 6);

    // Top value driver
    const td = sensitivityData.topValueDriver;
    ws3.getCell(3, 1).value = 'Top Value Driver:';
    ws3.getCell(3, 1).font = { bold: true, size: 10 };
    ws3.getCell(3, 2).value = td.parameterLabel;
    ws3.getCell(3, 2).font = { bold: true, size: 10, color: { argb: TEAL } };
    ws3.getCell(4, 1).value = td.insightText;
    ws3.mergeCells(4, 1, 4, 6);
    ws3.getCell(4, 1).font = { size: 10, italic: true };
    ws3.getCell(4, 1).alignment = { wrapText: true };
    ws3.getRow(4).height = 35;

    // Parameter table
    addTableHeaders(ws3, 6, ['Parameter', 'Current', 'Best Alternative', 'Potential Gain', 'Gain/Loss Visual', 'Impact']);

    // Calculate max absolute delta across all parameters for scaling the visual bars
    const maxAbsDelta = Math.max(
      ...sensitivityData.parameters.slice(0, 10).map(p => {
        const bestOpt = p.options.reduce((best, opt) => opt.delta > best.delta ? opt : best, p.options[0]);
        return Math.abs(bestOpt?.delta || 0);
      }),
      1 // prevent division by zero
    );

    let sensitivityLastRow = 6;
    sensitivityData.parameters.slice(0, 10).forEach((p, i) => {
      const row = 7 + i;
      sensitivityLastRow = row;
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

      // Potential Gain cell with conditional formatting (green/red)
      const gainCell = ws3.getCell(row, 4);
      if (bestOpt && bestOpt.delta !== 0) {
        gainCell.value = bestOpt.delta; // raw numeric value in $M
        gainCell.numFmt = '+$#,##0.0"M";-$#,##0.0"M"';
        gainCell.font = { size: 10, bold: true };
        gainCell.border = thinBorder();
        gainCell.alignment = { horizontal: 'right' };
        applyConditionalStyle(gainCell, bestOpt.delta, 10);
      } else {
        gainCell.value = 'N/A';
        gainCell.font = { size: 10, bold: true, color: { argb: GRAY_500 } };
        gainCell.fill = fill;
        gainCell.border = thinBorder();
        gainCell.alignment = { horizontal: 'right' };
      }

      // Column 5: Gain/Loss Visual sparkline bar
      const sparkCell = ws3.getCell(row, 5);
      if (bestOpt && bestOpt.delta !== 0) {
        const absVal = Math.abs(bestOpt.delta);
        const isPositive = bestOpt.delta > 0;
        const arrow = isPositive ? '\u25B2' : '\u25BC'; // ▲ or ▼
        const barStr = buildBarString(absVal, maxAbsDelta, 15);
        sparkCell.value = `${arrow} ${barStr}`;
        sparkCell.font = {
          size: 10,
          bold: true,
          color: { argb: isPositive ? POS_FONT : NEG_FONT },
        };
        sparkCell.fill = isPositive ? positiveFill() : negativeFill();
      } else {
        sparkCell.value = '\u2500'; // — (horizontal dash for no change)
        sparkCell.font = { size: 10, color: { argb: GRAY_500 } };
        sparkCell.fill = fill;
      }
      sparkCell.alignment = { vertical: 'middle' };
      sparkCell.border = thinBorder();

      // Column 6: Impact level
      const impactColors: Record<string, string> = { 'VERY HIGH': ROSE, 'HIGH': AMBER, 'MEDIUM': CYAN, 'LOW': GREEN };
      ws3.getCell(row, 6).value = p.impactLevel;
      ws3.getCell(row, 6).font = { size: 9, bold: true, color: { argb: impactColors[p.impactLevel] || GRAY_500 } };
      ws3.getCell(row, 6).fill = fill;
      ws3.getCell(row, 6).alignment = { horizontal: 'center' };
      ws3.getCell(row, 6).border = thinBorder();
    });

    // Add detail rows showing all options with conditional delta coloring
    sensitivityLastRow += 2;
    addSectionHeader(ws3, sensitivityLastRow, 'PARAMETER OPTIONS DETAIL', 6);
    sensitivityLastRow++;
    addTableHeaders(ws3, sensitivityLastRow, ['Parameter', 'Option', 'Total Value ($M)', 'Delta ($M)', 'Delta Visual', 'Delta (%)']);
    sensitivityLastRow++;

    // Calculate max absolute delta across all detail options for scaling
    const maxAbsDetailDelta = Math.max(
      ...sensitivityData.parameters.slice(0, 10).flatMap(p =>
        p.options.map(opt => Math.abs(opt.delta))
      ),
      1
    );

    sensitivityData.parameters.slice(0, 10).forEach((p) => {
      p.options.forEach((opt) => {
        const row = sensitivityLastRow;
        const fill = (sensitivityLastRow % 2 === 0) ? grayFill() : lightGrayFill();

        ws3.getCell(row, 1).value = p.label;
        ws3.getCell(row, 1).font = { size: 9 };
        ws3.getCell(row, 1).fill = fill;
        ws3.getCell(row, 1).border = thinBorder();

        ws3.getCell(row, 2).value = opt.label;
        ws3.getCell(row, 2).font = { size: 9 };
        ws3.getCell(row, 2).fill = fill;
        ws3.getCell(row, 2).border = thinBorder();

        const tvCell = ws3.getCell(row, 3);
        tvCell.value = opt.resultingTotalValue;
        tvCell.numFmt = CURRENCY_FMT;
        tvCell.font = { size: 9 };
        tvCell.fill = fill;
        tvCell.alignment = { horizontal: 'right' };
        tvCell.border = thinBorder();

        // Delta value with conditional formatting
        const deltaCell = ws3.getCell(row, 4);
        deltaCell.value = opt.delta;
        deltaCell.numFmt = '+$#,##0.0"M";-$#,##0.0"M"';
        deltaCell.font = { size: 9, bold: true };
        deltaCell.alignment = { horizontal: 'right' };
        deltaCell.border = thinBorder();
        if (opt.delta !== 0) {
          applyConditionalStyle(deltaCell, opt.delta, 9);
        } else {
          deltaCell.fill = fill;
          deltaCell.font = { size: 9, color: { argb: GRAY_500 } };
        }

        // Delta Visual sparkline bar (column 5)
        const detailSparkCell = ws3.getCell(row, 5);
        if (opt.delta !== 0) {
          const absVal = Math.abs(opt.delta);
          const isPos = opt.delta > 0;
          const arrow = isPos ? '\u25B2' : '\u25BC';
          const detailBar = buildBarString(absVal, maxAbsDetailDelta, 12);
          detailSparkCell.value = `${arrow} ${detailBar}`;
          detailSparkCell.font = { size: 9, bold: true, color: { argb: isPos ? POS_FONT : NEG_FONT } };
          detailSparkCell.fill = isPos ? positiveFill() : negativeFill();
        } else {
          detailSparkCell.value = '\u25CF current'; // ● current
          detailSparkCell.font = { size: 9, color: { argb: GRAY_500 } };
          detailSparkCell.fill = fill;
        }
        detailSparkCell.alignment = { vertical: 'middle' };
        detailSparkCell.border = thinBorder();

        // Delta percent with conditional formatting (column 6)
        const pctCell = ws3.getCell(row, 6);
        pctCell.value = opt.deltaPercent / 100; // convert to decimal for Excel %
        pctCell.numFmt = '+0.0%;-0.0%';
        pctCell.font = { size: 9, bold: true };
        pctCell.alignment = { horizontal: 'right' };
        pctCell.border = thinBorder();
        if (opt.deltaPercent !== 0) {
          applyConditionalStyle(pctCell, opt.deltaPercent, 9);
        } else {
          pctCell.fill = fill;
          pctCell.font = { size: 9, color: { argb: GRAY_500 } };
        }

        sensitivityLastRow++;
      });
    });

    // Print area for Sensitivity
    setPrintArea(ws3, sensitivityLastRow - 1, 6);
  }

  // ── Sheet 4: Comparable Deals ──
  const comparableDeals = getRelevantDeals(
    (therapeuticArea as 'oncology' | 'neurology' | 'immunology') || 'oncology',
    labels.modality,
    labels.indication
  );
  if (comparableDeals.length > 0) {
    const ws4 = wb.addWorksheet('Comparable Deals', {
      properties: { tabColor: { argb: NAVY } },
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws4.columns = [{ width: 24 }, { width: 24 }, { width: 18 }, { width: 12 }, { width: 50 }];

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

    // Print area for Comparable Deals
    setPrintArea(ws4, 3 + comparableDeals.length, 5);
  }

  // ── Sheet 5: Partners ──
  if (partners && partners.length > 0) {
    const ws5 = wb.addWorksheet('Partners', {
      properties: { tabColor: { argb: TEAL } },
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws5.columns = [{ width: 28 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 44 }];

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
      const scoreCell = ws5.getCell(row, 2);
      scoreCell.value = p.match_score / 100; // decimal for Excel %
      scoreCell.numFmt = '0%';
      scoreCell.font = { size: 11, bold: true, color: { argb: scoreColor } };
      scoreCell.fill = fill;
      scoreCell.alignment = { horizontal: 'center' };
      scoreCell.border = thinBorder();
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

    // Print area for Partners
    setPrintArea(ws5, 3 + partners.length, 5);
  }

  // ── Sheet 6: Methodology ──
  const ws6 = wb.addWorksheet('Methodology', {
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws6.columns = [{ width: 85 }];

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

  // Print area for Methodology
  setPrintArea(ws6, 1 + methLines.length, 1);

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

export async function generateDealsExcel(deals: DealForExcel[], filters?: Record<string, string>): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ambrosia Ventures';
  wb.created = new Date();

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
  const ws1 = wb.addWorksheet('Deals');
  ws1.columns = [
    { width: 25 }, { width: 25 }, { width: 30 }, { width: 18 }, { width: 18 },
    { width: 12 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 15 },
    { width: 12 }, { width: 14 },
  ];
  ws1.addRow(['Biotech Deal Database Export']);
  ws1.addRow(['Generated by Ambrosia Ventures']);
  ws1.addRow([`Export Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`]);
  ws1.addRow([`Total Deals: ${deals.length}`]);
  ws1.addRow([]);
  ws1.addRow(['Licensor', 'Licensee', 'Asset', 'Modality', 'Indication', 'Phase', 'Deal Type', 'Upfront', 'Total Milestones', 'Total Deal Value', 'Royalties', 'Announced Date']);
  deals.forEach(deal => {
    ws1.addRow([
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
    ]);
  });

  // Sheet 2: Applied Filters (if any)
  if (filters && Object.keys(filters).length > 0) {
    const ws2 = wb.addWorksheet('Filters');
    ws2.columns = [{ width: 20 }, { width: 40 }];
    ws2.addRow(['APPLIED FILTERS']);
    ws2.addRow([]);
    Object.entries(filters)
      .filter(([_, value]) => value)
      .forEach(([key, value]) => {
        ws2.addRow([key.replace(/_/g, ' ').toUpperCase(), value]);
      });
  }

  // Sheet 3: Data Notes
  const ws3 = wb.addWorksheet('Notes');
  ws3.columns = [{ width: 70 }];
  [
    'DATA NOTES', '',
    'Source: Ambrosia Ventures Deal Database',
    'Data includes publicly disclosed licensing deals, collaborations, and acquisitions.',
    '', 'Financial Terms:',
    '\u2022 Upfront: Cash payment at deal signing',
    '\u2022 Milestones: Development, regulatory, and commercial milestone payments',
    '\u2022 Total Deal Value: Upfront + all potential milestones',
    '\u2022 Royalties: Percentage of net sales paid to licensor',
    '', 'Coverage: 2019-2026', 'Updates: Weekly', '',
    'DISCLAIMER',
    'This data is for informational purposes only.',
    'Deal terms are based on publicly available information.',
    'Some financial details may be undisclosed or estimated.',
    '', '\u00A9 Ambrosia Ventures - calculator.ambrosiaventures.co',
  ].forEach(line => ws3.addRow([line]));

  // Generate and download
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `biotech-deals-${timestamp}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
}
