#!/usr/bin/env npx tsx
import { cover, ft, wrap, render } from './erc-pdf-lib';

// ═══════════════════════════════════════
// 2-PAGE TEASER
// ═══════════════════════════════════════
const teaser2 = wrap(`
<div class="pg" style="padding:0;display:flex;flex-direction:column">
<div style="background:linear-gradient(145deg,#1a1e42,#252a5e);padding:36px 48px">
<div style="display:inline-block;padding:3px 10px;border:1px solid rgba(20,184,166,.4);border-radius:3px;margin-bottom:12px"><span style="font-size:8px;font-weight:700;color:#14b8a6;text-transform:uppercase;letter-spacing:.2em">Sell-Side M&A Opportunity</span></div>
<h1 style="font-size:28px;font-weight:800;color:#fff;margin-bottom:6px">Life Sciences IP Portfolio</h1>
<p style="font-size:12px;color:#94a3b8">Four Proprietary Assets · Two-Track Strategic Process · Exclusive Mandate</p>
</div>
<div style="background:#14b8a6;padding:8px 48px;display:flex;justify-content:space-between"><span style="font-size:8px;color:#fff;font-weight:600">AMBROSIA VENTURES · Exclusive Sell-Side Advisor</span><span style="font-size:8px;color:#fff">June 2026</span></div>
<div style="padding:24px 48px;flex:1">
<p class="tag">Opportunity Overview</p>
<p class="sm sc mb3">A Delaware life sciences company owns four proprietary pharmaceutical and dermatology assets developed over 20+ years of R&D (47 publications, 17 inventions). Pursuing a structured two-track sale.</p>
<div class="g2 mb3">
<div class="card" style="border-left:4px solid #14b8a6">
<span class="bd bt mb2">Track 1</span>
<p class="h3 mt2">Non-Invasive Clinical Skin & Wellness Platform</p>
<p class="xs sc mb2">Three bundled OTC assets with clinical evidence, issued patents, and immediate revenue potential.</p>
<table class="dt"><tr><th>Metric</th><th style="text-align:right">Detail</th></tr>
<tr><td>Assets</td><td class="vc">3 bundled</td></tr>
<tr><td>Lead Efficacy</td><td class="vc">100% (363 pts)</td></tr>
<tr><td>Patents</td><td class="vc">2 issued (38 claims)</td></tr>
<tr><td>Regulatory</td><td class="vc">OTC monograph</td></tr>
<tr><td>Revenue Timeline</td><td class="vc">&lt;12 months</td></tr></table>
<p class="xs sc">Structure: Asset purchase or exclusive IP license</p>
</div>
<div class="card" style="border-left:4px solid #1a1e42">
<span class="bd bn mb2">Track 2</span>
<p class="h3 mt2">Oncology Development Asset</p>
<p class="xs sc mb2">Topical treatment for the two most common cancers in the U.S. (5.4M cases/yr). &lt;5 competing programs globally.</p>
<table class="dt"><tr><th>Metric</th><th style="text-align:right">Detail</th></tr>
<tr><td>Indication</td><td class="vc">BCC + SCC</td></tr>
<tr><td>Market</td><td class="vc">$8.2B global</td></tr>
<tr><td>Patent</td><td class="vc">Issued (U.S.)</td></tr>
<tr><td>Pipeline</td><td class="vc">&lt;5 programs</td></tr>
<tr><td>Dev Window</td><td class="vc">5-7 yr uncontested</td></tr></table>
<p class="xs sc">Structure: Co-dev license with option-to-acquire</p>
</div></div>
<div class="kr">
<div class="k"><div class="kv">4</div><div class="kl">Proprietary Assets</div></div>
<div class="k"><div class="kv">3</div><div class="kl">Issued Patents</div></div>
<div class="k"><div class="kv">41</div><div class="kl">Patent Claims</div></div>
<div class="k"><div class="kv">1,000+</div><div class="kl">Clinical Patients</div></div>
<div class="k"><div class="kv">$23.4B+</div><div class="kl">Addressable Markets</div></div>
</div></div>
${ft('1-Page Teaser',1)}
</div>

<div class="pg">
<p class="tag">Portfolio Metrics</p>
<table class="dt mb4">
<tr><th>Dimension</th><th>Asset A (Derm)</th><th>Asset B (Scalp)</th><th>Asset C (Women's)</th><th>Asset D (Onc)</th></tr>
<tr><td class="b">Therapeutic Area</td><td>OTC Dermatology</td><td>OTC Scalp/Hair</td><td>Women's Health</td><td>Oncology (Dev)</td></tr>
<tr><td class="b">Regulatory Path</td><td>OTC monograph</td><td>OTC monograph</td><td>OTC + NDA</td><td>IND/NDA</td></tr>
<tr><td class="b">Patent Status</td><td class="tc b">ISSUED (27 claims)</td><td>Pending</td><td class="tc b">ISSUED (11 claims)</td><td class="tc b">ISSUED (3 claims)</td></tr>
<tr><td class="b">Clinical Data</td><td>363 pts, 100% eff</td><td>In-vitro + in-vivo</td><td>488 pts, ~100% eff</td><td>Pre-IND</td></tr>
<tr><td class="b">Competitive Position</td><td class="tc b">First-in-class</td><td>Differentiated</td><td class="tc b">First-mover (white space)</td><td class="tc b">Disruptive (&lt;5 pipeline)</td></tr>
<tr><td class="b">Time to Revenue</td><td>&lt;12 months</td><td>&lt;12 months</td><td>&lt;6 months (supplement)</td><td>5-7 years</td></tr>
<tr><td class="b">Addressable Market</td><td class="vc">$1.2B</td><td class="vc">$12.2B</td><td class="vc">$2.8B</td><td class="vc">$8.2B</td></tr>
</table>

<p class="tag">Investment Highlights</p>
<div class="g2 mb3">
<div class="ch"><p class="h4 tc">1. First-in-Class Lead Asset</p><p class="xs sc">Only topical with 100% efficacy, zero pain, zero scarring, zero recurrence. No pipeline competitor matches.</p></div>
<div class="ch"><p class="h4 tc">2. Immediate Revenue Potential</p><p class="xs sc">Two OTC monograph-ready assets. Buyer generates revenue within 12 months of close. No NDA required.</p></div>
<div class="ch"><p class="h4 tc">3. Women's Health White Space</p><p class="xs sc">First-mover in condition affecting 50-60% of women. Zero FDA-approved Rx. 488-patient clinical trial.</p></div>
<div class="ch"><p class="h4 tc">4. Oncology Optionality</p><p class="xs sc">Issued patent, $8.2B market, &lt;5 competing programs. Co-dev structure with exit ramps at every gate.</p></div>
<div class="ch"><p class="h4 tc">5. Proprietary Delivery System</p><p class="xs sc">Trade-secret DST-1 platform underpins all 4 assets. Formulation moat beyond patent protection.</p></div>
<div class="ch"><p class="h4 tc">6. Transaction Flexibility</p><p class="xs sc">Two-track process — bid on Track 1, Track 2, or both. Competitive tension between buyer categories.</p></div>
</div>

<div class="ch">
<p class="h4 nc">Market Context</p>
<div class="g3">
<div><p class="xs sc">Consumer health M&A multiples</p><p class="sm b nc">11.0x – 14.3x EBITDA</p></div>
<div><p class="xs sc">Women's health Rx white space</p><p class="sm b nc">No approved treatment</p></div>
<div><p class="xs sc">Topical NMSC pipeline</p><p class="sm b nc">&lt;5 programs globally</p></div>
</div></div>

<div class="cn" style="display:flex;justify-content:space-between;align-items:center">
<div><p style="font-size:13px;font-weight:700">Issa Kildani · Managing Partner</p><p class="sm" style="color:#14b8a6">ikildani@ambrosiaventures.co</p></div>
<div style="text-align:right"><p class="xs" style="color:#94a3b8">All inquiries directed exclusively to Ambrosia Ventures.</p><p class="xs" style="color:#94a3b8">Company identity disclosed under NDA only.</p></div>
</div>
${ft('2-Page Teaser',2)}
</div>
`);

// ═══════════════════════════════════════
// CIM (condensed 6-page version)
// ═══════════════════════════════════════
const cim = wrap(`
${cover('Confidential Information Memorandum','Essential Remedium Corporation — Four Proprietary IP Assets in Dermatology, Oncology, and Women\'s Health','Sell-Side M&A Advisory')}

<div class="pg">
<p class="tag">Section I — Executive Summary</p>
<p class="st">Transaction Overview</p>
<p class="sm sc mb3">Ambrosia Ventures has been retained as the exclusive sell-side advisor to Essential Remedium Corporation ("ERC"), a Delaware corporation. ERC owns four proprietary IP assets — each with issued or pending U.S. patents, proprietary formulations, and clinical data packages developed over 20+ years.</p>
<div class="g2 mb3">
<div class="cn"><span class="bd bt mb2">Track 1</span><p style="font-size:15px;font-weight:700;margin:8px 0 4px">$95M — $140M — $215M</p><p class="xs" style="color:#94a3b8">Total Deal Value (upfront + earn-out + royalty)</p><p class="xs mt2" style="color:#94a3b8">WartOlyze® + DandrOheal® + MastOnorm® bundled</p><p class="xs" style="color:#94a3b8">Asset purchase or exclusive IP license</p></div>
<div class="cn"><span class="bd bn mb2" style="border:1px solid rgba(255,255,255,.3)">Track 2</span><p style="font-size:15px;font-weight:700;margin:8px 0 4px">$103M — $181M — $288M</p><p class="xs" style="color:#94a3b8">Total Deal Value (upfront + milestones + option)</p><p class="xs mt2" style="color:#94a3b8">Lesion Free Skin — topical BCC/SCC</p><p class="xs" style="color:#94a3b8">Co-development license with option-to-acquire</p></div>
</div>
<div class="kr">
<div class="k"><div class="kv">4</div><div class="kl">Assets</div></div>
<div class="k"><div class="kv">3</div><div class="kl">Issued Patents</div></div>
<div class="k"><div class="kv">1,000+</div><div class="kl">Patients</div></div>
<div class="k"><div class="kv">$23.4B+</div><div class="kl">Markets</div></div>
</div>
<p class="h3">Strategic Rationale</p>
<p class="sm sc mb2">The dual-track process creates competitive tension between buyer categories. Track 1 assets are near-commercial (OTC monograph). Track 2 is clinical-stage oncology with development optionality.</p>
<div class="ch"><p class="sm b nc">Market conditions favor execution:</p>
<p class="xs sc mt1">▸ Consumer health carve-outs at 11.0x–14.3x EBITDA</p>
<p class="xs sc">▸ NMSC treatment pipeline scarcity — &lt;5 topical programs globally</p>
<p class="xs sc">▸ Women's health NDA white space — no approved Rx exists</p></div>
${ft('CIM — Executive Summary',2)}
</div>

<div class="pg">
<p class="tag">Section II — Company Overview</p>
<p class="st">Essential Remedium Corporation</p>
<table class="dt mb3">
<tr><th>Detail</th><th>Information</th></tr>
<tr><td class="b">Jurisdiction</td><td>Delaware Corporation</td></tr>
<tr><td class="b">Headquarters</td><td>45 Rockefeller Plaza, Suite 2000, New York, NY 10111</td></tr>
<tr><td class="b">CEO / President</td><td>Dennis Tubian</td></tr>
<tr><td class="b">Key Executive</td><td>John Navi</td></tr>
<tr><td class="b">Lead Inventor</td><td>Dr. Alexander Sepper, MD, PhD (late VP R&D; 47 publications, 17 inventions)</td></tr>
<tr><td class="b">Asset Count</td><td class="vc">4 Proprietary IP / Pharma Assets</td></tr>
<tr><td class="b">Therapeutic Focus</td><td>Dermatology · Oncology · OTC Wellness · Women's Health</td></tr>
</table>
<p class="tag">Section III — Asset Portfolio</p>
<p class="st">WartOlyze® — Topical Viral Wart Treatment</p>
<div class="g2 mb2">
<div><p class="h4">Clinical Profile</p>
<table class="dt"><tr><th>Metric</th><th style="text-align:right">Value</th></tr>
<tr><td>Study Size</td><td class="vc">363 patients</td></tr>
<tr><td>Efficacy</td><td class="vc">100%</td></tr>
<tr><td>Pain</td><td class="vc">None</td></tr>
<tr><td>Scarring</td><td class="vc">None</td></tr>
<tr><td>Recurrence</td><td class="vc">~0%</td></tr></table></div>
<div><p class="h4">IP & Regulatory</p>
<table class="dt"><tr><th>Item</th><th style="text-align:right">Status</th></tr>
<tr><td>Patent</td><td class="vc">US12161661B2 (27 claims)</td></tr>
<tr><td>Trademarks</td><td class="vc">2 active registrations</td></tr>
<tr><td>Regulatory</td><td class="vc">OTC monograph</td></tr>
<tr><td>Market</td><td class="vc">$1.2B global</td></tr>
<tr><td>Position</td><td class="vc">First-in-class</td></tr></table></div>
</div>
<p class="st mt3">DandrOheal® — Scalp & Dandruff Therapeutic</p>
<div class="g2">
<div class="card"><p class="h4">Formulation</p><p class="xs sc">Climbazole + Melatonin + Zinc Pyrithione in DMSO delivery. Multi-mechanism. Leave-on format. OTC monograph compliant.</p></div>
<div class="card"><p class="h4">Status</p><p class="xs sc">Patent PENDING (continuation). In-vitro (BioScience Labs 2019) + in-vivo (Princeton Research). Market: $12.2B global.</p><p class="xs mt1" style="color:#be123c">⚠ Original patent ABANDONED</p></div>
</div>
${ft('CIM — Company & Assets',3)}
</div>

<div class="pg">
<p class="st">MastOnorm® — Fibrocystic Breast Disease Treatment</p>
<div class="ch mb3">
<p class="h4 tc">WHITE SPACE OPPORTUNITY</p>
<p class="sm sc">Zero FDA-approved pharmacological treatment exists for fibrocystic breast disease — a condition affecting 50-60% of women. MastOnorm is the only product with a large clinical trial (488 patients) showing near-complete efficacy.</p>
<div class="g3 mt2">
<div><p class="xxs sc">Pain Reduction</p><p class="b tc" style="font-size:18px">100%</p></div>
<div><p class="xxs sc">Swelling Reduction</p><p class="b tc" style="font-size:18px">97.5%</p></div>
<div><p class="xxs sc">Nodularity Reduction</p><p class="b tc" style="font-size:18px">95.3%</p></div>
</div></div>
<table class="dt mb3"><tr><th>Detail</th><th style="text-align:right">Status</th></tr>
<tr><td>Patent</td><td class="vc">US11571451B1 (11 claims) — ISSUED</td></tr>
<tr><td>Trademarks</td><td class="vc">2 active registrations</td></tr>
<tr><td>Clinical</td><td class="vc">488-patient trial (Georgian NCO, 1985-1994)</td></tr>
<tr><td>Market</td><td class="vc">$2.8B global fibrocystic breast care</td></tr>
<tr><td>Dual Path</td><td class="vc">OTC supplement (immediate) + NDA (first-mover)</td></tr></table>

<p class="st">Lesion Free Skin — Topical BCC/SCC Treatment</p>
<div class="cn mb3">
<p class="sm b">ONCOLOGY DEVELOPMENT ASSET — TRACK 2</p>
<p class="xs mt1" style="color:#94a3b8">Topical treatment for basal cell and squamous cell carcinoma — the two most common cancers in the U.S. (5.4M cases/yr). Issued patent. Non-invasive alternative to Mohs surgery ($2,500-5,000/procedure).</p>
<div class="g4 mt2">
<div><p class="xxs" style="color:#94a3b8">Market</p><p class="b" style="font-size:14px">$8.2B</p></div>
<div><p class="xxs" style="color:#94a3b8">Patent</p><p class="b" style="font-size:14px">Issued</p></div>
<div><p class="xxs" style="color:#94a3b8">Pipeline</p><p class="b" style="font-size:14px">&lt;5 programs</p></div>
<div><p class="xxs" style="color:#94a3b8">Window</p><p class="b" style="font-size:14px">5-7 years</p></div>
</div></div>
<table class="dt"><tr><th>Detail</th><th style="text-align:right">Status</th></tr>
<tr><td>Patent</td><td class="vc">US11730745B1 (3 claims) — ISSUED</td></tr>
<tr><td>Regulatory</td><td class="vc">Pre-IND (IND/NDA required)</td></tr>
<tr><td>Structure</td><td class="vc">Co-development + option-to-acquire</td></tr>
<tr><td>Upfront Range</td><td class="vc">$5M — $10M — $18M</td></tr>
<tr><td>Option Exercise</td><td class="vc">$50-80M at Phase 2 readout</td></tr></table>
${ft('CIM — Assets (continued)',4)}
</div>

<div class="pg">
<p class="tag">Section IV — Intellectual Property</p>
<p class="st">Patent & Trademark Portfolio</p>
<table class="dt mb3">
<tr><th>Asset</th><th>Patent / TM</th><th>Type</th><th>Status</th><th style="text-align:right">Claims</th></tr>
<tr><td class="b">WartOlyze</td><td>US12161661B2</td><td>Patent</td><td><span class="bd bt">ISSUED</span></td><td class="vc">27</td></tr>
<tr><td class="b">WartOlyze</td><td>US20230052709A1</td><td>Patent</td><td><span class="bd ba">PENDING</span></td><td class="vc">—</td></tr>
<tr><td class="b">DandrOheal</td><td>US20230390169A1</td><td>Patent</td><td><span class="bd ba">PENDING</span></td><td class="vc">—</td></tr>
<tr><td class="b">MastOnorm</td><td>US11571451B1</td><td>Patent</td><td><span class="bd bt">ISSUED</span></td><td class="vc">11</td></tr>
<tr><td class="b">Lesion Free Skin</td><td>US11730745B1</td><td>Patent</td><td><span class="bd bt">ISSUED</span></td><td class="vc">3</td></tr>
<tr><td class="b">WartOlyze</td><td>Reg. 5,601,583/585</td><td>Trademark</td><td><span class="bd bt">ACTIVE</span></td><td class="vc">Word+Design</td></tr>
<tr><td class="b">DandrOheal</td><td>Reg. 5,607,378/589</td><td>Trademark</td><td><span class="bd bt">ACTIVE</span></td><td class="vc">Word+Design</td></tr>
<tr><td class="b">MastOnorm</td><td>Reg. 5,607,372/584</td><td>Trademark</td><td><span class="bd bt">ACTIVE</span></td><td class="vc">Word+Design</td></tr>
</table>
<div class="ch"><p class="h4 tc">Trade Secret: DST-1 Delivery System</p><p class="xs sc">DMSO/PEG-400/Cluster Water formulation with proprietary penetration enhancers. Underpins transdermal delivery across all four assets. Maintained in restricted-access clean room.</p></div>

<p class="tag mt4">Section V — Transaction Structure</p>
<p class="st">Recommended Deal Terms</p>
<table class="dt">
<tr><th></th><th>Track 1 (OTC Bundle)</th><th>Track 2 (Oncology)</th></tr>
<tr><td class="b">Structure</td><td>Asset Acquisition</td><td>Co-Dev + Option</td></tr>
<tr><td class="b">Upfront</td><td class="vc">$55M — $75M — $110M</td><td class="vc">$5M — $10M — $18M</td></tr>
<tr><td class="b">Dev Milestones</td><td class="vc">$15M — $25M — $40M</td><td class="vc">$33M — $56M — $90M</td></tr>
<tr><td class="b">Comm Milestones</td><td class="vc">$25M — $40M — $65M</td><td class="vc">$35M — $60M — $95M</td></tr>
<tr><td class="b">Option Exercise</td><td>N/A</td><td class="vc">$25M — $50M — $80M</td></tr>
<tr><td class="b">Royalty</td><td class="vc">5-14% tiered</td><td class="vc">3-12% tiered</td></tr>
<tr><td class="b nc" style="font-size:12px">Total Deal Value</td><td class="vc" style="font-size:12px">$95M — $140M — $215M</td><td class="vc" style="font-size:12px">$103M — $181M — $288M</td></tr>
</table>
${ft('CIM — IP & Transaction',5)}
</div>

<div class="pg">
<p class="tag">Section VI — Process & Contact</p>
<p class="st">26-Week Indicative Timeline</p>
<table class="dt mb3">
<tr><th>Phase</th><th>Weeks</th><th>Activity</th></tr>
<tr><td class="b">Preparation</td><td>1-4</td><td>CIM finalization, data room, buyer list</td></tr>
<tr><td class="b">Phase 1 Outreach</td><td>5-8</td><td>Teaser distribution, NDA execution, CIM delivery</td></tr>
<tr><td class="b">Phase 2 Diligence</td><td>9-14</td><td>Data room access, management presentations, Q&A</td></tr>
<tr><td class="b">IOI</td><td>15-18</td><td>Non-binding Indications of Interest due</td></tr>
<tr><td class="b">Exclusivity</td><td>19-22</td><td>Binding offer, definitive agreement negotiation</td></tr>
<tr><td class="b">Close</td><td>23-26</td><td>IP transfer, regulatory, closing conditions</td></tr>
</table>

<div class="cn" style="text-align:center;padding:32px">
<p style="font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:#14b8a6;margin-bottom:12px">Exclusive Sell-Side Advisor</p>
<p style="font-size:20px;font-weight:800;margin-bottom:4px">Ambrosia Ventures</p>
<p class="sm" style="color:#94a3b8;margin-bottom:20px">Deal Intelligence Platform · 1,900+ Verified Transactions</p>
<div style="border-top:1px solid rgba(255,255,255,.15);padding-top:16px">
<p style="font-size:14px;font-weight:700">Issa Kildani</p>
<p class="sm" style="color:#14b8a6">Managing Partner</p>
<p class="sm" style="color:#94a3b8;margin-top:4px">ikildani@ambrosiaventures.co</p>
</div></div>

<div class="card mt3" style="text-align:center">
<p class="xxs sc">This Confidential Information Memorandum has been prepared by Ambrosia Ventures on behalf of Essential Remedium Corporation for informational purposes only. It does not purport to be all-inclusive or contain all information that a prospective acquirer may require. Neither Ambrosia Ventures nor ERC makes any representation or warranty regarding the information contained herein. This document is provided subject to the terms of a mutual non-disclosure agreement.</p>
<p class="xxs sc mt2">© 2026 Ambrosia Ventures. All rights reserved.</p>
</div>
${ft('CIM — Process & Contact',6)}
</div>
`);

// ═══════════════════════════════════════
// MAIN — Generate all PDFs
// ═══════════════════════════════════════
async function main() {
  console.log('Generating ERC Deal Material PDFs...\n');

  await render(teaser2, 'ERC_2Page_Teaser.pdf');
  await render(cim, 'ERC_CIM.pdf');

  console.log('\nAll PDFs saved to: /Users/issakildani/Desktop/ERC_Deal_Materials/');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
