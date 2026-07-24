#!/usr/bin/env npx tsx
/**
 * Generate ERC Deal Materials as World-Class PDFs
 * Uses the Ambrosia report styling system (same as solidus.ambrosiaventures.co)
 * Uploads to Google Drive VDR folder
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'tmp-erc-pdfs');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Brand colors matching the Ambrosia report system
const NAVY = '#0f172a';
const TEAL = '#14b8a6';
const DARK_NAVY = '#1a1e42';
const LIGHT_TEAL = '#ccfbf1';
const SLATE = '#64748b';
const LIGHT_SLATE = '#94a3b8';
const WHITE = '#ffffff';
const LIGHT_BG = '#f8fafc';

function baseStyles(): string {
  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
      line-height: 1.55;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      page-break-after: always;
      page-break-inside: avoid;
      padding: 40px 48px 52px 48px;
      position: relative;
      background: white;
    }
    .page:last-child { page-break-after: auto; }
    .cover-page { padding: 0; }

    /* Typography */
    .section-tag {
      font-size: 9px; font-weight: 700; color: ${TEAL};
      text-transform: uppercase; letter-spacing: 0.16em;
      margin-bottom: 10px; padding-bottom: 6px;
      border-bottom: 2px solid ${LIGHT_TEAL};
    }
    .section-title {
      font-size: 20px; font-weight: 800; color: ${DARK_NAVY};
      margin-bottom: 16px; letter-spacing: -0.03em; line-height: 1.15;
      padding-left: 12px; border-left: 4px solid ${TEAL};
    }
    .h3 { font-size: 13px; font-weight: 700; color: ${DARK_NAVY}; margin-bottom: 8px; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9px; }
    .text-teal { color: ${TEAL}; }
    .text-slate { color: ${SLATE}; }
    .text-navy { color: ${DARK_NAVY}; }
    .bold { font-weight: 700; }

    /* Cards */
    .card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 12px;
    }
    .card-highlight {
      background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
      border: 1px solid #99f6e4; border-left: 4px solid ${TEAL};
      border-radius: 6px; padding: 16px; margin-bottom: 12px;
    }
    .card-navy {
      background: linear-gradient(145deg, ${DARK_NAVY} 0%, #252a5e 100%);
      border: none; border-radius: 6px; padding: 18px; color: #fff;
      margin-bottom: 12px;
    }

    /* KPI */
    .kpi-row { display: flex; gap: 12px; margin-bottom: 16px; }
    .kpi {
      flex: 1; background: #fff; border: 1px solid #e2e8f0;
      border-top: 3px solid ${TEAL}; border-radius: 6px;
      padding: 16px 14px; text-align: center;
    }
    .kpi-value { font-size: 24px; font-weight: 800; color: ${TEAL}; line-height: 1.1; }
    .kpi-label {
      font-size: 8px; font-weight: 700; color: ${SLATE};
      text-transform: uppercase; letter-spacing: 0.12em; margin-top: 6px;
    }

    /* Tables */
    .data-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
    .data-table th {
      background: ${DARK_NAVY}; color: #fff; padding: 9px 12px; text-align: left;
      font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em;
    }
    .data-table th:first-child { border-radius: 4px 0 0 0; }
    .data-table th:last-child { border-radius: 0 4px 0 0; }
    .data-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .data-table .value-cell { font-weight: 700; color: ${TEAL}; text-align: right; }

    /* Badges */
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 3px;
      font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .badge-teal { background: ${LIGHT_TEAL}; color: ${TEAL}; }
    .badge-navy { background: ${DARK_NAVY}; color: #fff; }
    .badge-amber { background: #fef3c7; color: #b45309; }
    .badge-rose { background: #ffe4e6; color: #be123c; }

    /* Layout */
    .flex { display: flex; }
    .gap-3 { gap: 12px; }
    .gap-4 { gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }
    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 12px; }
    .mt-4 { margin-top: 16px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-3 { margin-bottom: 12px; }
    .mb-4 { margin-bottom: 16px; }

    /* Footer */
    .page-footer {
      position: absolute; bottom: 20px; left: 48px; right: 48px;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 7px; color: ${LIGHT_SLATE}; border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }

    /* Progress bars */
    .bar-container { background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; }
    .bar-teal { background: linear-gradient(90deg, ${TEAL}, #06b6d4); }
    .bar-navy { background: linear-gradient(90deg, ${DARK_NAVY}, #374191); }
  `;
}

function coverPage(title: string, subtitle: string, docType: string): string {
  return `
    <div class="page cover-page" style="display: flex; flex-direction: column;">
      <div style="background: linear-gradient(145deg, ${DARK_NAVY} 0%, #252a5e 50%, ${NAVY} 100%); flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 60px;">
        <div style="margin-bottom: 40px;">
          <div style="display: inline-block; padding: 4px 12px; border: 1px solid rgba(20,184,166,0.4); border-radius: 4px; margin-bottom: 24px;">
            <span style="font-size: 9px; font-weight: 700; color: ${TEAL}; text-transform: uppercase; letter-spacing: 0.2em;">${docType}</span>
          </div>
          <h1 style="font-size: 36px; font-weight: 800; color: #fff; line-height: 1.15; letter-spacing: -0.03em; margin-bottom: 16px;">${title}</h1>
          <p style="font-size: 15px; color: ${LIGHT_SLATE}; line-height: 1.6; max-width: 440px;">${subtitle}</p>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px; display: flex; gap: 40px;">
          <div>
            <p style="font-size: 8px; color: ${LIGHT_SLATE}; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Advisor</p>
            <p style="font-size: 13px; color: #fff; font-weight: 600;">Ambrosia Ventures</p>
            <p style="font-size: 10px; color: ${LIGHT_SLATE};">Exclusive Sell-Side Mandate</p>
          </div>
          <div>
            <p style="font-size: 8px; color: ${LIGHT_SLATE}; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Date</p>
            <p style="font-size: 13px; color: #fff; font-weight: 600;">June 2026</p>
          </div>
          <div>
            <p style="font-size: 8px; color: ${LIGHT_SLATE}; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Classification</p>
            <p style="font-size: 13px; color: #fff; font-weight: 600;">Strictly Confidential</p>
          </div>
        </div>
      </div>
      <div style="background: ${TEAL}; padding: 12px 60px; display: flex; justify-content: space-between;">
        <span style="font-size: 9px; color: #fff; font-weight: 600;">Powered by Ambrosia Ventures Proprietary Engine</span>
        <span style="font-size: 9px; color: #fff;">1,900+ Verified Transactions · 14 Integrated Engines · 850+ Companies Scored</span>
      </div>
    </div>
  `;
}

function footer(pageName: string, pageNum: number): string {
  return `
    <div class="page-footer">
      <span>Ambrosia Ventures · Strictly Confidential · For Discussion Purposes Only</span>
      <span>${pageName}</span>
      <span>June 2026 · Page ${pageNum}</span>
    </div>
  `;
}

function wrapDoc(styles: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${styles}</style></head><body>${body}</body></html>`;
}

// ═══════════════════════════════════════════════════
// 1-PAGE TEASER
// ═══════════════════════════════════════════════════

function build1PageTeaser(): string {
  const body = `
    <div class="page" style="padding: 0; display: flex; flex-direction: column;">
      <!-- Header bar -->
      <div style="background: linear-gradient(145deg, ${DARK_NAVY}, #252a5e); padding: 36px 48px;">
        <div style="display: inline-block; padding: 3px 10px; border: 1px solid rgba(20,184,166,0.4); border-radius: 3px; margin-bottom: 12px;">
          <span style="font-size: 8px; font-weight: 700; color: ${TEAL}; text-transform: uppercase; letter-spacing: 0.2em;">Sell-Side M&A Opportunity</span>
        </div>
        <h1 style="font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 6px; letter-spacing: -0.02em;">Life Sciences IP Portfolio</h1>
        <p style="font-size: 12px; color: ${LIGHT_SLATE};">Four Proprietary Assets · Two-Track Strategic Process · Exclusive Mandate</p>
      </div>
      <div style="background: ${TEAL}; padding: 8px 48px; display: flex; justify-content: space-between;">
        <span style="font-size: 8px; color: #fff; font-weight: 600;">AMBROSIA VENTURES · Exclusive Sell-Side Advisor</span>
        <span style="font-size: 8px; color: #fff;">June 2026</span>
      </div>

      <!-- Body -->
      <div style="padding: 28px 48px; flex: 1;">
        <div class="grid-2 mb-4">
          <!-- Track 1 -->
          <div class="card" style="border-left: 4px solid ${TEAL};">
            <div class="badge badge-teal mb-2">Track 1</div>
            <p class="h3">Non-Invasive Clinical Skin & Wellness Platform</p>
            <p class="text-sm text-slate mb-3">Three bundled OTC-commercializable assets with clinical evidence, issued patents, and immediate revenue potential via OTC monograph pathway.</p>
            <table class="data-table">
              <tr><th>Metric</th><th>Detail</th></tr>
              <tr><td>Assets</td><td class="value-cell">3 bundled</td></tr>
              <tr><td>Lead Efficacy</td><td class="value-cell">100% (363 pts)</td></tr>
              <tr><td>Patents</td><td class="value-cell">2 issued (38 claims)</td></tr>
              <tr><td>Regulatory</td><td class="value-cell">OTC monograph</td></tr>
              <tr><td>Time to Revenue</td><td class="value-cell">&lt;12 months</td></tr>
            </table>
            <p class="text-xs text-slate">Structure: Asset purchase or exclusive IP license</p>
            <p class="text-xs text-slate">Buyers: Consumer health strategics, PE, family offices</p>
          </div>

          <!-- Track 2 -->
          <div class="card" style="border-left: 4px solid ${DARK_NAVY};">
            <div class="badge badge-navy mb-2">Track 2</div>
            <p class="h3">Oncology Development Asset</p>
            <p class="text-sm text-slate mb-3">Topical treatment for the two most common cancers in the U.S. (5.4M cases/yr). Fewer than 5 competing topical programs globally.</p>
            <table class="data-table">
              <tr><th>Metric</th><th>Detail</th></tr>
              <tr><td>Indication</td><td class="value-cell">BCC + SCC</td></tr>
              <tr><td>Market Size</td><td class="value-cell">$8.2B global</td></tr>
              <tr><td>Patent</td><td class="value-cell">Issued (U.S.)</td></tr>
              <tr><td>Pipeline Density</td><td class="value-cell">&lt;5 programs</td></tr>
              <tr><td>Dev Window</td><td class="value-cell">5-7 yr uncontested</td></tr>
            </table>
            <p class="text-xs text-slate">Structure: Co-development license with option-to-acquire</p>
            <p class="text-xs text-slate">Buyers: Oncology pharma, specialty derm companies</p>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-value">4</div><div class="kpi-label">Proprietary Assets</div></div>
          <div class="kpi"><div class="kpi-value">3</div><div class="kpi-label">Issued Patents</div></div>
          <div class="kpi"><div class="kpi-value">41</div><div class="kpi-label">Patent Claims</div></div>
          <div class="kpi"><div class="kpi-value">1,000+</div><div class="kpi-label">Clinical Patients</div></div>
          <div class="kpi"><div class="kpi-value">$23.4B+</div><div class="kpi-label">Addressable Markets</div></div>
        </div>

        <!-- Market context -->
        <div class="card-highlight">
          <p class="text-sm bold text-navy mb-2">Market Context</p>
          <div class="grid-3">
            <div><p class="text-xs text-slate">Consumer health M&A</p><p class="text-sm bold">11-14x EBITDA</p></div>
            <div><p class="text-xs text-slate">Women's health Rx gap</p><p class="text-sm bold">No approved Rx</p></div>
            <div><p class="text-xs text-slate">Topical NMSC pipeline</p><p class="text-sm bold">&lt;5 programs</p></div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding: 16px 48px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p style="font-size: 11px; font-weight: 700; color: ${DARK_NAVY};">Issa Kildani · Managing Partner</p>
          <p style="font-size: 10px; color: ${TEAL};">ikildani@ambrosiaventures.co</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 8px; color: ${LIGHT_SLATE};">This document does not constitute an offer to sell. Company identity disclosed under NDA only.</p>
          <p style="font-size: 8px; color: ${LIGHT_SLATE};">© 2026 Ambrosia Ventures. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
  return wrapDoc(baseStyles(), body);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

async function generatePDF(html: string, filename: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const outputPath = path.join(OUTPUT_DIR, filename);
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await browser.close();
  console.log(`Generated: ${filename} (${(fs.statSync(outputPath).size / 1024).toFixed(0)}KB)`);
  return outputPath;
}

async function main() {
  console.log('Generating ERC Deal Materials PDFs...\n');

  // 1-Page Teaser
  await generatePDF(build1PageTeaser(), 'ERC_1Page_Teaser.pdf');

  console.log('\nDone. PDFs saved to:', OUTPUT_DIR);
  console.log('Upload to Google Drive VDR folder manually or via API.');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
