import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUT = '/Users/issakildani/Desktop/ERC_Deal_Materials';
const NAVY = '#0f172a';
const TEAL = '#14b8a6';
const DN = '#1a1e42';
const LT = '#ccfbf1';
const SL = '#64748b';
const LSL = '#94a3b8';

export const css = `
@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:11px;line-height:1.55}
.pg{width:210mm;min-height:297mm;page-break-after:always;page-break-inside:avoid;padding:40px 48px 52px;position:relative;background:#fff}
.pg:last-child{page-break-after:auto}
.cover{padding:0;display:flex;flex-direction:column}
.tag{font-size:9px;font-weight:700;color:${TEAL};text-transform:uppercase;letter-spacing:.16em;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${LT}}
.st{font-size:20px;font-weight:800;color:${DN};margin-bottom:16px;letter-spacing:-.03em;line-height:1.15;padding-left:12px;border-left:4px solid ${TEAL}}
.h3{font-size:13px;font-weight:700;color:${DN};margin-bottom:8px}
.h4{font-size:11px;font-weight:700;color:${DN};margin-bottom:6px}
.sm{font-size:10px}.xs{font-size:9px}.xxs{font-size:8px}
.tc{color:${TEAL}}.sc{color:${SL}}.nc{color:${DN}}.wc{color:#fff}
.b{font-weight:700}.sb{font-weight:600}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:12px}
.ch{background:linear-gradient(135deg,#f0fdfa,#ecfeff);border:1px solid #99f6e4;border-left:4px solid ${TEAL};border-radius:6px;padding:16px;margin-bottom:12px}
.cn{background:linear-gradient(145deg,${DN},#252a5e);border:none;border-radius:6px;padding:18px;color:#fff;margin-bottom:12px}
.kr{display:flex;gap:12px;margin-bottom:16px}
.k{flex:1;background:#fff;border:1px solid #e2e8f0;border-top:3px solid ${TEAL};border-radius:6px;padding:14px 12px;text-align:center}
.kv{font-size:22px;font-weight:800;color:${TEAL};line-height:1.1}
.kl{font-size:7px;font-weight:700;color:${SL};text-transform:uppercase;letter-spacing:.12em;margin-top:5px}
table.dt{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px}
table.dt th{background:${DN};color:#fff;padding:8px 10px;text-align:left;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.1em}
table.dt th:first-child{border-radius:4px 0 0 0}table.dt th:last-child{border-radius:0 4px 0 0}
table.dt td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155}
table.dt tr:nth-child(even) td{background:#f8fafc}
.vc{font-weight:700;color:${TEAL};text-align:right}
.bd{display:inline-block;padding:2px 8px;border-radius:3px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.bt{background:${LT};color:${TEAL}}.bn{background:${DN};color:#fff}.ba{background:#fef3c7;color:#b45309}.br{background:#ffe4e6;color:#be123c}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px}
.mt1{margin-top:4px}.mt2{margin-top:8px}.mt3{margin-top:12px}.mt4{margin-top:16px}
.mb1{margin-bottom:4px}.mb2{margin-bottom:8px}.mb3{margin-bottom:12px}.mb4{margin-bottom:16px}
.ft{position:absolute;bottom:20px;left:48px;right:48px;display:flex;justify-content:space-between;font-size:7px;color:${LSL};border-top:1px solid #e2e8f0;padding-top:8px}
.bar{background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;margin-top:4px}
.bf{height:100%;border-radius:4px;background:linear-gradient(90deg,${TEAL},#06b6d4)}
.bfn{height:100%;border-radius:4px;background:linear-gradient(90deg,${DN},#374191)}
`;

export function cover(title: string, sub: string, type: string): string {
  return `<div class="pg cover">
<div style="background:linear-gradient(145deg,${DN},#252a5e 50%,${NAVY});flex:1;display:flex;flex-direction:column;justify-content:center;padding:60px">
<div style="margin-bottom:40px">
<div style="display:inline-block;padding:4px 12px;border:1px solid rgba(20,184,166,.4);border-radius:4px;margin-bottom:24px"><span style="font-size:9px;font-weight:700;color:${TEAL};text-transform:uppercase;letter-spacing:.2em">${type}</span></div>
<h1 style="font-size:34px;font-weight:800;color:#fff;line-height:1.15;letter-spacing:-.03em;margin-bottom:14px">${title}</h1>
<p style="font-size:14px;color:${LSL};line-height:1.6;max-width:440px">${sub}</p>
</div>
<div style="border-top:1px solid rgba(255,255,255,.1);padding-top:24px;display:flex;gap:40px">
<div><p class="xxs" style="color:${LSL};text-transform:uppercase;letter-spacing:.15em;margin-bottom:4px">Advisor</p><p style="font-size:13px;color:#fff;font-weight:600">Ambrosia Ventures</p><p class="sm" style="color:${LSL}">Exclusive Sell-Side Mandate</p></div>
<div><p class="xxs" style="color:${LSL};text-transform:uppercase;letter-spacing:.15em;margin-bottom:4px">Date</p><p style="font-size:13px;color:#fff;font-weight:600">June 2026</p></div>
<div><p class="xxs" style="color:${LSL};text-transform:uppercase;letter-spacing:.15em;margin-bottom:4px">Classification</p><p style="font-size:13px;color:#fff;font-weight:600">Strictly Confidential</p></div>
</div></div>
<div style="background:${TEAL};padding:12px 60px;display:flex;justify-content:space-between">
<span style="font-size:9px;color:#fff;font-weight:600">Powered by Ambrosia Ventures Proprietary Engine</span>
<span style="font-size:9px;color:#fff">1,900+ Verified Transactions · 14 Engines · 850+ Companies</span>
</div></div>`;
}

export function ft(label: string, n: number): string {
  return `<div class="ft"><span>Ambrosia Ventures · Strictly Confidential</span><span>${label}</span><span>June 2026 · Page ${n}</span></div>`;
}

export function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${body}</body></html>`;
}

export async function render(html: string, name: string): Promise<void> {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const p = path.join(OUT, name);
  await page.pdf({ path: p, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await browser.close();
  console.log(`✓ ${name} (${(fs.statSync(p).size / 1024).toFixed(0)}KB)`);
}
