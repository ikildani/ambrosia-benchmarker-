#!/usr/bin/env npx tsx
import { cover, ft, wrap, render } from './erc-pdf-lib';

// ═══════════════════════════════════════
// DEAL TERMS VALUATION (14-Engine)
// ═══════════════════════════════════════
const dealTerms = wrap(`
${cover('Deal Terms Valuation','14-Engine Analysis — Powered by Ambrosia Ventures Proprietary Platform','Engine Report')}

<div class="pg">
<p class="tag">Track 1 — OTC Platform Bundle</p>
<p class="st">Engine Outputs: WartOlyze + DandrOheal + MastOnorm</p>
<p class="h3">Engine 1: Solidus Deal Intelligence</p>
<table class="dt mb3">
<tr><th>Component</th><th style="text-align:right">Low</th><th style="text-align:right">Median</th><th style="text-align:right">High</th></tr>
<tr><td class="b">Upfront Cash</td><td class="vc">$55M</td><td class="vc">$75M</td><td class="vc">$110M</td></tr>
<tr><td class="b">Development Earn-out</td><td class="vc">$15M</td><td class="vc">$25M</td><td class="vc">$40M</td></tr>
<tr><td class="b">Commercial Milestones</td><td class="vc">$25M</td><td class="vc">$40M</td><td class="vc">$65M</td></tr>
<tr style="background:#f0fdfa"><td class="b nc" style="font-size:12px">Total Deal Value</td><td class="vc" style="font-size:14px">$95M</td><td class="vc" style="font-size:14px">$140M</td><td class="vc" style="font-size:14px">$215M</td></tr>
<tr><td class="b">Royalty (tiered)</td><td class="vc">5-8%</td><td class="vc">7-10%</td><td class="vc">10-14%</td></tr>
</table>
<p class="h3">Engine 2: rNPV — Asset-Level Breakdown</p>
<table class="dt mb3">
<tr><th>Asset</th><th style="text-align:right">Unadj. NPV</th><th style="text-align:right">PoS</th><th style="text-align:right">Risk-Adj NPV</th></tr>
<tr><td class="b">WartOlyze (liquid)</td><td class="vc">$180M</td><td class="vc">85%</td><td class="vc">$153M</td></tr>
<tr><td class="b">WartOlyze (cream)</td><td class="vc">$95M</td><td class="vc">70%</td><td class="vc">$67M</td></tr>
<tr><td class="b">DandrOheal</td><td class="vc">$60M</td><td class="vc">55%</td><td class="vc">$33M</td></tr>
<tr><td class="b">MastOnorm (OTC)</td><td class="vc">$45M</td><td class="vc">65%</td><td class="vc">$29M</td></tr>
<tr><td class="b">MastOnorm (NDA)</td><td class="vc">$120M</td><td class="vc">15%</td><td class="vc">$18M</td></tr>
<tr style="background:#f0fdfa"><td class="b nc">Portfolio rNPV</td><td class="vc">$500M</td><td class="vc">-15% disc.</td><td class="vc" style="font-size:14px">$255M</td></tr>
</table>
<p class="h3">Engine 3: Monte Carlo (10,000 iterations)</p>
<div class="mb3">
<p class="xs b nc mb1">P10: $68M</p><div class="bar"><div class="bf" style="width:22%"></div></div>
<p class="xs b nc mb1 mt1">P25: $98M</p><div class="bar"><div class="bf" style="width:32%"></div></div>
<p class="xs b nc mb1 mt1">P50: $142M</p><div class="bar"><div class="bf" style="width:46%"></div></div>
<p class="xs b nc mb1 mt1">P75: $195M</p><div class="bar"><div class="bf" style="width:63%"></div></div>
<p class="xs b nc mb1 mt1">P90: $260M</p><div class="bar"><div class="bf" style="width:84%"></div></div>
<p class="xs b nc mb1 mt1">P95: $310M</p><div class="bar"><div class="bf" style="width:100%"></div></div>
</div>
<div class="g3">
<div class="k"><div class="kv">62%</div><div class="kl">Prob ≥$100M</div></div>
<div class="k"><div class="kv">45%</div><div class="kl">Prob ≥$150M</div></div>
<div class="k"><div class="kv">28%</div><div class="kl">Prob ≥$200M</div></div>
</div>
${ft('Deal Terms — Track 1 Engines',2)}
</div>

<div class="pg">
<p class="h3">Engine 4: Tornado Sensitivity — Top Value Drivers</p>
<div class="mb3">
<p class="xs b nc mb1">1. WartOlyze market penetration (±30%) → ±$48M</p><div class="bar"><div class="bf" style="width:100%"></div></div>
<p class="xs b nc mb1 mt1">2. Competitive entry timeline (±2yr) → ±$35M</p><div class="bar"><div class="bf" style="width:73%"></div></div>
<p class="xs b nc mb1 mt1">3. MastOnorm NDA probability (±10pp) → ±$22M</p><div class="bar"><div class="bf" style="width:46%"></div></div>
<p class="xs b nc mb1 mt1">4. OTC pricing power (±20%) → ±$18M</p><div class="bar"><div class="bf" style="width:38%"></div></div>
<p class="xs b nc mb1 mt1">5. DandrOheal patent issuance → ±$15M</p><div class="bar"><div class="bf" style="width:31%"></div></div>
<p class="xs b nc mb1 mt1">6. Cadmium reformulation cost → ±$8M</p><div class="bar"><div class="bf" style="width:17%"></div></div>
</div>
<p class="h3">Engine 8: Ensemble Valuation</p>
<table class="dt mb3">
<tr><th>Method</th><th style="text-align:right">Value</th><th style="text-align:right">Weight</th></tr>
<tr><td class="b">rNPV (Engine 2)</td><td class="vc">$255M</td><td class="vc">35%</td></tr>
<tr><td class="b">Comparable Transactions</td><td class="vc">$125M</td><td class="vc">45%</td></tr>
<tr><td class="b">Real Options (Engine 11)</td><td class="vc">$195M</td><td class="vc">20%</td></tr>
<tr style="background:#f0fdfa"><td class="b nc" style="font-size:12px">Ensemble Value</td><td class="vc" style="font-size:14px">$172M</td><td></td></tr>
<tr><td class="b">80% Confidence Range</td><td class="vc">$110M — $234M</td><td></td></tr>
</table>
<p class="h3">Engine 9: Deal Waterfall</p>
<table class="dt mb3">
<tr><th>Step</th><th style="text-align:right">Adjustment</th><th style="text-align:right">Running Total</th></tr>
<tr><td>1. Unadjusted NPV (sum of parts)</td><td></td><td class="vc">$380M</td></tr>
<tr><td>2. Risk adjustment (portfolio PoS)</td><td style="color:#e11d48;text-align:right;font-weight:700">-$125M</td><td class="vc">$255M</td></tr>
<tr><td>3. Strategic premium (first-in-class)</td><td class="vc">+$64M</td><td class="vc">$319M</td></tr>
<tr><td>4. Deal capture (acquisition 85%)</td><td style="color:#e11d48;text-align:right;font-weight:700">-$48M</td><td class="vc">$271M</td></tr>
<tr><td>5. Portfolio discount (IP risk)</td><td style="color:#e11d48;text-align:right;font-weight:700">-$41M</td><td class="vc">$230M</td></tr>
<tr style="background:#f0fdfa"><td class="b nc">6. Allocation → upfront</td><td></td><td class="vc" style="font-size:14px">$75M upfront</td></tr>
</table>
<p class="h3">Engine 11: Real Options (MastOnorm NDA)</p>
<div class="ch"><p class="xs"><span class="b tc">Option Value: $28M</span> · Underlying: $120M · Exercise: $15M · Volatility: 65% · Flexibility Premium: +156% over static rNPV. This option is "free" in the Track 1 bundle.</p></div>
<p class="h3">Engine 14: Buyer-Specific Valuation</p>
<table class="dt">
<tr><th>Buyer</th><th style="text-align:right">Generic TDV</th><th style="text-align:right">Premium</th><th style="text-align:right">Buyer-Specific TDV</th></tr>
<tr><td class="b">Incyte</td><td class="vc">$140M</td><td class="vc">+26%</td><td class="vc" style="font-size:13px">$176M</td></tr>
<tr><td class="b">Prestige Consumer</td><td class="vc">$140M</td><td class="vc">+18%</td><td class="vc">$165M</td></tr>
</table>
${ft('Deal Terms — Track 1 Engines (continued)',3)}
</div>

<div class="pg">
<p class="tag">Track 2 — Oncology Development Asset</p>
<p class="st">Engine Outputs: Lesion Free Skin</p>
<p class="h3">Engine 1: Deal Terms — Co-Development + Option</p>
<table class="dt mb3">
<tr><th>Component</th><th style="text-align:right">Low</th><th style="text-align:right">Median</th><th style="text-align:right">High</th></tr>
<tr><td class="b">Upfront License Fee</td><td class="vc">$5M</td><td class="vc">$10M</td><td class="vc">$18M</td></tr>
<tr><td class="b">IND Filing</td><td class="vc">$3M</td><td class="vc">$5M</td><td class="vc">$8M</td></tr>
<tr><td class="b">Phase 1</td><td class="vc">$5M</td><td class="vc">$8M</td><td class="vc">$12M</td></tr>
<tr><td class="b">Phase 2 Data</td><td class="vc">$10M</td><td class="vc">$18M</td><td class="vc">$30M</td></tr>
<tr><td class="b">Option Exercise Fee</td><td class="vc">$25M</td><td class="vc">$50M</td><td class="vc">$80M</td></tr>
<tr><td class="b">Phase 3 + NDA + Approval</td><td class="vc">$45M</td><td class="vc">$80M</td><td class="vc">$125M</td></tr>
<tr><td class="b">Commercial Milestones</td><td class="vc">$35M</td><td class="vc">$60M</td><td class="vc">$95M</td></tr>
<tr style="background:#f0fdfa"><td class="b nc" style="font-size:12px">Total Deal Value</td><td class="vc" style="font-size:14px">$103M</td><td class="vc" style="font-size:14px">$181M</td><td class="vc" style="font-size:14px">$288M</td></tr>
<tr><td class="b">Royalty (tiered)</td><td class="vc">3-5%</td><td class="vc">5-8%</td><td class="vc">8-12%</td></tr>
</table>
<p class="h3">Engine 2: rNPV</p>
<div class="g3 mb3">
<div class="k"><div class="kv">$850M</div><div class="kl">Unadjusted NPV</div></div>
<div class="k"><div class="kv">8.2%</div><div class="kl">Cumulative PoS</div></div>
<div class="k"><div class="kv">$70M</div><div class="kl">Risk-Adjusted NPV</div></div>
</div>
<p class="h3">Engine 11: Real Options (Compound Option)</p>
<div class="cn mb3" style="text-align:center;padding:20px">
<p style="font-size:28px;font-weight:800">$95M</p>
<p class="xs" style="color:#94a3b8">Compound Option Value (+36% flexibility premium over static rNPV)</p>
<p class="xs mt2" style="color:#14b8a6;font-weight:600">"You're paying $10M for a compound option on an $850M outcome with exit ramps at every gate."</p>
</div>
<p class="h3">Engine 14: Buyer-Specific Valuation</p>
<table class="dt mb3">
<tr><th>Buyer</th><th style="text-align:right">Generic TDV</th><th style="text-align:right">Premium</th><th style="text-align:right">Buyer-Specific</th></tr>
<tr><td class="b">Citius Pharmaceuticals</td><td class="vc">$85M</td><td class="vc">+27%</td><td class="vc" style="font-size:13px">$108M</td></tr>
<tr><td class="b">Incyte</td><td class="vc">$85M</td><td class="vc">+22%</td><td class="vc">$104M</td></tr>
</table>
${ft('Deal Terms — Track 2 Engines',4)}
</div>

<div class="pg">
<p class="tag">Combined Portfolio Summary</p>
<p class="st">Recommended Deal Structure</p>
<table class="dt mb3">
<tr><th></th><th>Track 1 (OTC Bundle)</th><th>Track 2 (Oncology)</th></tr>
<tr><td class="b">Structure</td><td>Asset Acquisition</td><td>Co-Dev + Option</td></tr>
<tr><td class="b">Upfront</td><td class="vc">$55M — $75M — $110M</td><td class="vc">$5M — $10M — $18M</td></tr>
<tr><td class="b">Milestones</td><td class="vc">$40M — $65M — $105M</td><td class="vc">$73M — $121M — $195M</td></tr>
<tr><td class="b">Option Exercise</td><td>N/A</td><td class="vc">$25M — $50M — $80M</td></tr>
<tr><td class="b">Royalty</td><td class="vc">5-14% tiered</td><td class="vc">3-12% tiered</td></tr>
<tr style="background:#f0fdfa"><td class="b nc" style="font-size:13px">Total Deal Value</td><td class="vc" style="font-size:14px">$95M — $140M — $215M</td><td class="vc" style="font-size:14px">$103M — $181M — $288M</td></tr>
</table>
<div class="cn" style="text-align:center;padding:24px">
<p class="xs" style="color:#14b8a6;text-transform:uppercase;letter-spacing:.15em;margin-bottom:12px">Combined Portfolio Value</p>
<div style="display:flex;justify-content:center;gap:32px">
<div><p class="xxs" style="color:#94a3b8">Low</p><p style="font-size:22px;font-weight:800">$198M</p></div>
<div style="width:1px;background:rgba(255,255,255,.15)"></div>
<div><p class="xxs" style="color:#94a3b8">Median</p><p style="font-size:28px;font-weight:800">$321M</p></div>
<div style="width:1px;background:rgba(255,255,255,.15)"></div>
<div><p class="xxs" style="color:#94a3b8">High</p><p style="font-size:22px;font-weight:800">$503M</p></div>
</div>
<p class="xs mt3" style="color:#94a3b8">With $1.2B+ headline milestone structure: see Strategic Valuation Roadmap</p>
</div>
<div class="card mt3" style="text-align:center"><p class="xxs sc">Valuation powered by Ambrosia Ventures proprietary platform (solidus.ambrosiaventures.co). 14 integrated engines · 1,900+ verified transactions · Calibrated quarterly. © 2026 Ambrosia Ventures.</p></div>
${ft('Deal Terms — Summary',5)}
</div>
`);

// ═══════════════════════════════════════
// STRATEGIC VALUATION ROADMAP
// ═══════════════════════════════════════
const roadmap = wrap(`
${cover('Strategic Valuation Roadmap','Path to $1B+ Total Deal Value — Investment Memo for ERC Leadership','Strategy Advisory')}

<div class="pg">
<p class="tag">Current State</p>
<p class="st">Where the Valuation Stands Today</p>
<div class="cn mb3" style="text-align:center;padding:24px">
<p class="xs" style="color:#94a3b8;text-transform:uppercase;letter-spacing:.15em;margin-bottom:8px">Current Combined TDV (as-is)</p>
<p style="font-size:36px;font-weight:800">$321M <span style="font-size:16px;color:#94a3b8">median</span></p>
<p class="xs mt1" style="color:#94a3b8">Track 1: $140M + Track 2: $181M</p>
</div>
<div style="display:flex;gap:12px;margin-bottom:16px">
<div class="cn" style="flex:1;text-align:center;padding:16px"><p class="xs" style="color:#94a3b8">Target TDV</p><p style="font-size:24px;font-weight:800;color:#14b8a6">$1.27B+</p></div>
<div class="cn" style="flex:1;text-align:center;padding:16px"><p class="xs" style="color:#94a3b8">Investment Required</p><p style="font-size:24px;font-weight:800;color:#14b8a6">$575K</p></div>
<div class="cn" style="flex:1;text-align:center;padding:16px"><p class="xs" style="color:#94a3b8">ROI</p><p style="font-size:24px;font-weight:800;color:#14b8a6">1,650x</p></div>
<div class="cn" style="flex:1;text-align:center;padding:16px"><p class="xs" style="color:#94a3b8">Timeline</p><p style="font-size:24px;font-weight:800;color:#14b8a6">6 months</p></div>
</div>
<p class="tag mt3">What Is Suppressing the Valuation</p>
<p class="st">Six Factors — Each With a Defined Solution</p>
<table class="dt">
<tr><th>#</th><th>Factor</th><th style="text-align:right">Discount</th><th style="text-align:right">Cost to Fix</th><th style="text-align:right">Value Unlocked</th></tr>
<tr><td>1</td><td class="b">IP Chain of Title</td><td style="color:#e11d48;text-align:right;font-weight:700">-15 to -25%</td><td class="vc">$30-50K</td><td class="vc">+$50-80M</td></tr>
<tr><td>2</td><td class="b">No FDA Engagement</td><td style="color:#e11d48;text-align:right;font-weight:700">-30 to -40%</td><td class="vc">$50-100K</td><td class="vc">+$120-250M</td></tr>
<tr><td>3</td><td class="b">Cadmium in WartOlyze</td><td style="color:#e11d48;text-align:right;font-weight:700">-5 to -15%</td><td class="vc">$15-25K</td><td class="vc">+$30-50M</td></tr>
<tr><td>4</td><td class="b">Reformulation Not Proven</td><td style="color:#e11d48;text-align:right;font-weight:700">-10 to -20%</td><td class="vc">$50-100K</td><td class="vc">+$80-120M</td></tr>
<tr><td>5</td><td class="b">Clinical Data Not GCP-Grade</td><td style="color:#e11d48;text-align:right;font-weight:700">-10 to -15%</td><td class="vc">$200-500K</td><td class="vc">+$40-60M</td></tr>
<tr><td>6</td><td class="b">DandrOheal Patent Abandoned</td><td style="color:#e11d48;text-align:right;font-weight:700">-5 to -10%</td><td class="vc">$10-20K</td><td class="vc">+$15-25M</td></tr>
<tr style="background:#f0fdfa"><td></td><td class="b nc" style="font-size:12px">TOTAL</td><td></td><td class="vc" style="font-size:12px">$355-795K</td><td class="vc" style="font-size:12px">+$385-625M</td></tr>
</table>
${ft('Roadmap — Current State',2)}
</div>

<div class="pg">
<p class="tag">Execution Actions</p>
<p class="st">6 Actions — All Outsourceable, No Sales Force Needed</p>
<div class="g2 mb3">
<div class="card" style="border-left:4px solid #14b8a6"><p class="h4 tc">Action 1: Clean IP Chain of Title</p><p class="xs sc mb1">Execute IP assignments from Sepper/Tubian/Navi → ERC entity. Sepper estate must execute.</p>
<div class="g3"><div><p class="xxs sc">Cost</p><p class="xs b nc">$30-50K</p></div><div><p class="xxs sc">Timeline</p><p class="xs b nc">4-6 weeks</p></div><div><p class="xxs sc">Value</p><p class="xs b tc">+$50-80M</p></div></div></div>
<div class="card" style="border-left:4px solid #14b8a6"><p class="h4 tc">Action 2: FDA Pre-IND Meetings (×2)</p><p class="xs sc mb1">File Type B pre-IND requests for MastOnorm + Lesion Free Skin. FDA responds in 60 days.</p>
<div class="g3"><div><p class="xxs sc">Cost</p><p class="xs b nc">$50-100K</p></div><div><p class="xxs sc">Timeline</p><p class="xs b nc">8-12 weeks</p></div><div><p class="xxs sc">Value</p><p class="xs b tc">+$120-250M</p></div></div></div>
<div class="card" style="border-left:4px solid #14b8a6"><p class="h4 tc">Action 3: Cadmium Tox Assessment</p><p class="xs sc mb1">Independent toxicologist assesses cadmium at clinical dose/route/duration.</p>
<div class="g3"><div><p class="xxs sc">Cost</p><p class="xs b nc">$15-25K</p></div><div><p class="xxs sc">Timeline</p><p class="xs b nc">4-6 weeks</p></div><div><p class="xxs sc">Value</p><p class="xs b tc">+$30-50M</p></div></div></div>
<div class="card" style="border-left:4px solid #14b8a6"><p class="h4 tc">Action 4: Reformulation Feasibility</p><p class="xs sc mb1">Contract lab tests copper/zinc/silver alternatives. Unlocks consumer OTC cream channel.</p>
<div class="g3"><div><p class="xxs sc">Cost</p><p class="xs b nc">$50-100K</p></div><div><p class="xxs sc">Timeline</p><p class="xs b nc">3-4 months</p></div><div><p class="xxs sc">Value</p><p class="xs b tc">+$80-120M</p></div></div></div>
<div class="card" style="border-left:4px solid #14b8a6"><p class="h4 tc">Action 5: GLP Preclinical Study</p><p class="xs sc mb1">CRO-run GLP study for Lesion Free Skin. Generates IND-enabling preclinical package.</p>
<div class="g3"><div><p class="xxs sc">Cost</p><p class="xs b nc">$200-500K</p></div><div><p class="xxs sc">Timeline</p><p class="xs b nc">4-6 months</p></div><div><p class="xxs sc">Value</p><p class="xs b tc">+$40-60M</p></div></div></div>
<div class="card" style="border-left:4px solid #14b8a6"><p class="h4 tc">Action 6: DandrOheal Patent Acceleration</p><p class="xs sc mb1">Request USPTO prioritized examination. Converts "pending" to "issued" in 6 months.</p>
<div class="g3"><div><p class="xxs sc">Cost</p><p class="xs b nc">$10-20K</p></div><div><p class="xxs sc">Timeline</p><p class="xs b nc">6-12 months</p></div><div><p class="xxs sc">Value</p><p class="xs b tc">+$15-25M</p></div></div></div>
</div>
<div class="ch"><p class="h4 tc">Dennis and John do NOT need to:</p>
<p class="xs sc">✗ Hire anyone · ✗ Build a sales force · ✗ Manufacture product · ✗ Generate revenue · ✗ Run clinical trials</p>
<p class="h4 tc mt2">Dennis and John DO need to:</p>
<p class="xs sc">✓ Sign IP assignments · ✓ Authorize checks to outside providers · ✓ Attend 2 FDA meetings (with counsel) · ✓ Provide formulation access</p></div>
${ft('Roadmap — Execution Actions',3)}
</div>

<div class="pg">
<p class="tag">Post-Execution</p>
<p class="st">The $1B+ Headline Structure</p>
<table class="dt mb3">
<tr><th>Component</th><th style="text-align:right">Track 1</th><th style="text-align:right">Track 2</th></tr>
<tr><td class="b">Upfront</td><td class="vc">$100-150M</td><td class="vc">$15-25M</td></tr>
<tr><td class="b">Development Milestones</td><td class="vc">$130M</td><td class="vc">$95M</td></tr>
<tr><td class="b">Option Exercise</td><td>N/A</td><td class="vc">$60-80M</td></tr>
<tr><td class="b">Commercial Milestones</td><td class="vc">$210M</td><td class="vc">$90M</td></tr>
<tr><td class="b">Royalty Value</td><td class="vc">$200M+</td><td class="vc">$240M+</td></tr>
<tr style="background:#f0fdfa"><td class="b nc" style="font-size:13px">Track TDV</td><td class="vc" style="font-size:14px">$655-705M</td><td class="vc" style="font-size:14px">$615-645M</td></tr>
</table>
<div class="cn" style="text-align:center;padding:28px">
<p class="xs" style="color:#14b8a6;text-transform:uppercase;letter-spacing:.2em;margin-bottom:12px">Combined Headline Total Deal Value</p>
<p style="font-size:42px;font-weight:800">$1.27B — $1.35B</p>
<p class="sm mt2" style="color:#94a3b8">Combined Upfront: $115M-$175M · Milestones: $525M-$605M · Royalty: $440M+</p>
</div>
<p class="tag mt3">Investment Summary for ERC</p>
<table class="dt">
<tr><th>Metric</th><th style="text-align:right">Value</th></tr>
<tr><td class="b">Total Investment Required</td><td class="vc" style="font-size:14px">$355K — $795K (midpoint: $575K)</td></tr>
<tr><td class="b">Current Combined TDV</td><td class="vc">$321M median</td></tr>
<tr><td class="b">Post-Execution TDV</td><td class="vc" style="font-size:14px;color:#14b8a6">$1.27B — $1.35B headline</td></tr>
<tr><td class="b">Value Created</td><td class="vc" style="font-size:14px">$950M — $1.03B</td></tr>
<tr><td class="b">ROI on Investment</td><td class="vc" style="font-size:14px;color:#14b8a6">1,650x — 1,790x</td></tr>
<tr><td class="b">Timeline</td><td class="vc">6 months</td></tr>
</table>
<div class="card mt3" style="text-align:center"><p class="xxs sc">© 2026 Ambrosia Ventures. Strictly Confidential. Powered by Ambrosia Ventures proprietary engine (solidus.ambrosiaventures.co).</p></div>
${ft('Roadmap — $1B+ Structure',4)}
</div>
`);

async function main() {
  console.log('Generating ERC Deal Material PDFs (Batch 3)...\n');
  await render(dealTerms, 'ERC_Deal_Terms_Valuation.pdf');
  await render(roadmap, 'ERC_Strategic_Valuation_Roadmap.pdf');
  console.log('\nBatch 3 complete.');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
