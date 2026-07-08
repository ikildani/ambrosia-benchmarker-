#!/usr/bin/env npx tsx
import { cover, ft, wrap, render } from './erc-pdf-lib';

// ═══════════════════════════════════════
// COMPETITIVE LANDSCAPE
// ═══════════════════════════════════════
const compLandscape = wrap(`
${cover('Competitive Landscape Analysis','Powered by Ambrosia Ventures Proprietary Engine — 1,900+ Verified Transactions · 850+ Companies Scored','Ambrosia Engine Report')}

<div class="pg">
<p class="tag">Asset 1 — WartOlyze® · Viral Wart Treatment</p>
<p class="st">Market Overview & Competitive Position</p>
<div class="kr">
<div class="k"><div class="kv">$1.2B</div><div class="kl">Global Market</div></div>
<div class="k"><div class="kv">5.2%</div><div class="kl">CAGR</div></div>
<div class="k"><div class="kv">27.6M</div><div class="kl">U.S. Affected</div></div>
<div class="k"><div class="kv">730M</div><div class="kl">Global Affected</div></div>
</div>
<p class="h3">Head-to-Head Comparison</p>
<table class="dt mb3">
<tr><th>Treatment</th><th>Efficacy</th><th>Pain</th><th>Scarring</th><th>Recurrence</th><th>Setting</th></tr>
<tr><td>Salicylic Acid (OTC)</td><td>40-70%</td><td>Moderate</td><td>Minimal</td><td>30-50%</td><td>Home</td></tr>
<tr><td>Cryotherapy</td><td>60-80%</td><td><span class="bd br">HIGH</span></td><td>Common</td><td>20-40%</td><td>Clinic</td></tr>
<tr><td>Imiquimod (Aldara)</td><td>50-75%</td><td>Moderate</td><td>Minimal</td><td>15-30%</td><td>Rx</td></tr>
<tr><td>Laser Ablation</td><td>70-90%</td><td><span class="bd br">HIGH</span></td><td>Possible</td><td>10-25%</td><td>Clinic</td></tr>
<tr><td>Surgical Excision</td><td>95%+</td><td><span class="bd br">HIGH</span></td><td><span class="bd br">YES</span></td><td>&lt;10%</td><td>Clinic</td></tr>
<tr style="background:linear-gradient(90deg,#f0fdfa,#ecfeff)"><td class="b tc">★ WartOlyze® (ERC)</td><td class="b tc">100%</td><td class="b tc">NONE</td><td class="b tc">NONE</td><td class="b tc">~0%</td><td class="b tc">OTC/Clinic</td></tr>
</table>
<div class="ch"><p class="h4 tc">Engine Assessment: FIRST-IN-CLASS</p>
<p class="xs sc">No marketed or pipeline product occupies the 100% efficacy / zero pain / zero scarring / zero recurrence position. WartOlyze has a 5-7 year competitive window (Engine 12).</p></div>
<p class="h3">Partner Fit Scores (Engine 5)</p>
<table class="dt">
<tr><th>#</th><th>Acquirer</th><th>Score</th><th>Strategic Rationale</th></tr>
<tr><td>1</td><td class="b">Incyte</td><td class="vc">92/100</td><td>$678M Opzelura, derm sales force, $3.6B cash</td></tr>
<tr><td>2</td><td class="b">Prestige Consumer</td><td class="vc">88/100</td><td>OTC platform builder, branded derm roll-up</td></tr>
<tr><td>3</td><td class="b">Church & Dwight</td><td class="vc">85/100</td><td>Consumer health M&A (Zicam $75M)</td></tr>
<tr><td>4</td><td class="b">Bausch Health</td><td class="vc">83/100</td><td>Derm portfolio (Solta, Obagi)</td></tr>
<tr><td>5</td><td class="b">Galderma</td><td class="vc">79/100</td><td>Pure-play derm (post-IPO)</td></tr>
</table>
${ft('Competitive Landscape — WartOlyze',2)}
</div>

<div class="pg">
<p class="tag">Acquisition Probability (Engine 6 — Pharma Intent Score v3)</p>
<div class="mb3">
<p class="xs b nc mb1">Incyte — 87/100 <span class="bd bt">VERY HIGH</span></p><div class="bar"><div class="bf" style="width:87%"></div></div>
<p class="xs b nc mb1 mt2">Prestige Consumer — 72/100 <span class="bd bt">HIGH</span></p><div class="bar"><div class="bf" style="width:72%"></div></div>
<p class="xs b nc mb1 mt2">Church & Dwight — 68/100 <span class="bd ba">MOD-HIGH</span></p><div class="bar"><div class="bf" style="width:68%"></div></div>
<p class="xs b nc mb1 mt2">Bausch Health — 61/100 <span class="bd ba">MODERATE</span></p><div class="bar"><div class="bf" style="width:61%"></div></div>
</div>
<p class="h3">Competitive Erosion Timeline (Engine 12)</p>
<div class="mb3">
<p class="xs b nc mb1">Year 1-3: 100% — No competition</p><div class="bar"><div class="bf" style="width:100%"></div></div>
<p class="xs b nc mb1 mt2">Year 4-5: 88% — 1-2 entrants</p><div class="bar"><div class="bf" style="width:88%"></div></div>
<p class="xs b nc mb1 mt2">Year 6-7: 75% — Market matures</p><div class="bar"><div class="bf" style="width:75%"></div></div>
<p class="xs b nc mb1 mt2">Year 8-10: 62% — Generic pressure</p><div class="bar"><div class="bf" style="width:62%"></div></div>
</div>
<p class="h3">Comparable Transactions (Ambrosia Database)</p>
<table class="dt">
<tr><th>Transaction</th><th style="text-align:right">Value</th><th>Category</th></tr>
<tr><td>Galderma / Alastin Skincare</td><td class="vc">$550M</td><td>Premium derm brand</td></tr>
<tr><td>LEO Pharma / Bayer Derm Portfolio</td><td class="vc">$612M</td><td>Derm asset bundle</td></tr>
<tr><td>Church & Dwight / Zicam</td><td class="vc">$75M</td><td>Branded OTC product</td></tr>
<tr><td>Branded OTC Derm Multiples</td><td class="vc">11-14.3x</td><td>EBITDA standard</td></tr>
</table>

<p class="tag mt4">Asset 2 — DandrOheal® · Scalp & Dandruff Therapeutic</p>
<p class="st">Competitive Positioning</p>
<div class="kr">
<div class="k"><div class="kv">$12.2B</div><div class="kl">Global Market</div></div>
<div class="k"><div class="kv">7.8%</div><div class="kl">CAGR</div></div>
<div class="k"><div class="kv">$450M</div><div class="kl">Premium Segment</div></div>
</div>
<table class="dt">
<tr><th>Product</th><th>Active</th><th>Owner</th><th style="text-align:right">Revenue</th><th>Format</th></tr>
<tr><td>Head & Shoulders</td><td>Zinc Pyrithione</td><td>P&G</td><td class="vc">$2.5B+</td><td>Rinse-off</td></tr>
<tr><td>Nizoral</td><td>Ketoconazole</td><td>J&J</td><td class="vc">$400M+</td><td>Rinse-off</td></tr>
<tr><td>Selsun Blue</td><td>Selenium Sulfide</td><td>Sanofi</td><td class="vc">$150M+</td><td>Rinse-off</td></tr>
<tr style="background:linear-gradient(90deg,#f0fdfa,#ecfeff)"><td class="b tc">★ DandrOheal®</td><td class="tc">Climbazole+Melatonin+ZnPyr</td><td class="tc">ERC</td><td class="vc">Pre-rev</td><td class="b tc">Leave-on</td></tr>
</table>
<div class="card"><p class="xs sc"><span class="b nc">Engine Assessment: DIFFERENTIATED FORMULATION</span> — Only multi-active combo with DMSO delivery. But patent NOT ISSUED (continuation pending, original abandoned). HIGH competition market.</p></div>
${ft('Competitive Landscape — WartOlyze / DandrOheal',3)}
</div>

<div class="pg">
<p class="tag">Asset 3 — MastOnorm® · Fibrocystic Breast Disease</p>
<p class="st">White Space Opportunity</p>
<div class="cn mb3" style="text-align:center;padding:24px">
<p style="font-size:12px;font-weight:800;color:#14b8a6;text-transform:uppercase;letter-spacing:.15em;margin-bottom:8px">FDA-Approved Treatments for Fibrocystic Breast Disease</p>
<p style="font-size:36px;font-weight:800">NONE</p>
<p class="sm mt2" style="color:#94a3b8">No FDA-approved pharmacological treatment exists for a condition affecting 50-60% of women.</p>
<p class="sm" style="color:#94a3b8">MastOnorm is the ONLY product with a large clinical trial (488 patients) showing near-complete efficacy.</p>
</div>
<table class="dt mb3">
<tr><th>Treatment</th><th>Type</th><th>Efficacy</th><th>Limitation</th></tr>
<tr><td>NSAIDs</td><td>Symptomatic</td><td>Moderate</td><td>Pain only, not disease</td></tr>
<tr><td>Oral Contraceptives</td><td>Hormonal</td><td>Variable</td><td>Systemic side effects</td></tr>
<tr><td>Danazol</td><td>Androgen</td><td>Good</td><td>Significant side effects</td></tr>
<tr><td>Tamoxifen</td><td>Anti-estrogen</td><td>Good</td><td>Cancer drug (off-label)</td></tr>
<tr style="background:linear-gradient(90deg,#f0fdfa,#ecfeff)"><td class="b tc">★ MastOnorm®</td><td class="tc">Phytotherapeutic</td><td class="b tc">100% pain red. (488 pts)</td><td class="xs">30-yr-old trial, herbal NDA</td></tr>
</table>
<div class="ch"><p class="xs"><span class="b tc">Engine Assessment: FIRST-MOVER</span> — Competitive density: NONE. Issued patent (11 claims). Dual path: OTC supplement (immediate) + NDA (exclusivity). Embedded option value: $28M (Engine 11).</p></div>

<p class="tag mt4">Asset 4 — Lesion Free Skin · Topical BCC/SCC</p>
<p class="st">Oncology Pipeline Scarcity</p>
<div class="kr">
<div class="k"><div class="kv">$8.2B</div><div class="kl">Global NMSC Market</div></div>
<div class="k"><div class="kv">5.4M</div><div class="kl">U.S. Cases/Year</div></div>
<div class="k"><div class="kv">&lt;5</div><div class="kl">Topical Programs</div></div>
<div class="k"><div class="kv">5-7yr</div><div class="kl">Uncontested Window</div></div>
</div>
<table class="dt mb3">
<tr><th>Treatment</th><th>Type</th><th style="text-align:right">Cost/Procedure</th><th>Market Share</th></tr>
<tr><td>Mohs Surgery</td><td>Surgical</td><td class="vc">$2,500-5,000</td><td>~40% (gold standard)</td></tr>
<tr><td>Excisional Surgery</td><td>Surgical</td><td class="vc">$1,500-3,000</td><td>~25%</td></tr>
<tr><td>Radiation</td><td>Non-invasive</td><td class="vc">$5,000-15,000</td><td>~10%</td></tr>
<tr><td>Imiquimod (Aldara)</td><td>Topical (Rx)</td><td class="vc">$500-800</td><td>~8% (superficial only)</td></tr>
<tr style="background:linear-gradient(90deg,#f0fdfa,#ecfeff)"><td class="b tc">★ Lesion Free Skin</td><td class="tc">Topical</td><td class="vc">$500-1,000</td><td class="tc">Pre-IND</td></tr>
</table>
<p class="h3">Co-Development Partner Fit (Engine 5)</p>
<table class="dt">
<tr><th>#</th><th>Partner</th><th>Score</th><th>Rationale</th></tr>
<tr><td>1</td><td class="b">Citius Pharma</td><td class="vc">85/100</td><td>LYMPHIR synergy, topical expertise (Halo-Lido)</td></tr>
<tr><td>2</td><td class="b">Incyte</td><td class="vc">82/100</td><td>Derm + onc overlap, Opzelura cash funds co-dev</td></tr>
<tr><td>3</td><td class="b">Sun Pharma</td><td class="vc">78/100</td><td>Global derm + oncology pipeline</td></tr>
</table>
${ft('Competitive Landscape — MastOnorm / Lesion Free Skin',4)}
</div>

<div class="pg">
<p class="tag">Portfolio Summary</p>
<p class="st">Engine Composite Scores</p>
<table class="dt mb3">
<tr><th>Dimension</th><th>WartOlyze</th><th>DandrOheal</th><th>MastOnorm</th><th>Lesion Free Skin</th></tr>
<tr><td class="b">Market Size</td><td>$1.2B</td><td>$12.2B</td><td>$2.8B</td><td>$8.2B</td></tr>
<tr><td class="b">Competition</td><td class="tc b">LOW</td><td><span class="bd br">HIGH</span></td><td class="tc b">NONE</td><td class="tc b">VERY LOW</td></tr>
<tr><td class="b">IP Strength</td><td class="tc b">27 claims ISSUED</td><td><span class="bd ba">PENDING</span></td><td class="tc b">11 claims ISSUED</td><td>3 claims ISSUED</td></tr>
<tr><td class="b">Clinical Data</td><td>363 pts, 100%</td><td>In-vitro + in-vivo</td><td>488 pts, ~100%</td><td>Pre-IND</td></tr>
<tr><td class="b">Regulatory Path</td><td class="tc">OTC monograph</td><td class="tc">OTC monograph</td><td>OTC + NDA</td><td>IND required</td></tr>
<tr><td class="b">Time to Revenue</td><td>&lt;12 mo</td><td>&lt;12 mo</td><td>&lt;6 mo (suppl.)</td><td>5-7 years</td></tr>
<tr><td class="b">Overall Score</td><td class="vc" style="font-size:14px">92/100 ★★★★★</td><td class="vc">68/100 ★★★☆☆</td><td class="vc" style="font-size:14px">85/100 ★★★★☆</td><td class="vc">78/100 ★★★★☆</td></tr>
</table>

<div class="cn" style="text-align:center;padding:24px">
<p class="xs" style="color:#14b8a6;text-transform:uppercase;letter-spacing:.15em;margin-bottom:12px">Combined Portfolio Assessment</p>
<div style="display:flex;justify-content:center;gap:40px">
<div><p style="font-size:28px;font-weight:800">$23.4B+</p><p class="xxs" style="color:#94a3b8;margin-top:4px">ADDRESSABLE MARKETS</p></div>
<div style="width:1px;background:rgba(255,255,255,.15)"></div>
<div><p style="font-size:28px;font-weight:800">81/100</p><p class="xxs" style="color:#94a3b8;margin-top:4px">AVERAGE SCORE</p></div>
<div style="width:1px;background:rgba(255,255,255,.15)"></div>
<div><p style="font-size:28px;font-weight:800">3 of 4</p><p class="xxs" style="color:#94a3b8;margin-top:4px">LOW/NO COMPETITION</p></div>
</div></div>

<div class="card mt3" style="text-align:center">
<p class="xxs sc">Data Sources: Ambrosia Ventures proprietary database (1,900+ transactions), SEC EDGAR, FDA Orange Book, ClinicalTrials.gov, IQVIA, Grand View Research. Engine: calculator.ambrosiaventures.co — 14 integrated engines calibrated quarterly.</p>
<p class="xxs sc mt1">© 2026 Ambrosia Ventures. Strictly Confidential.</p>
</div>
${ft('Competitive Landscape — Portfolio Summary',5)}
</div>
`);

// ═══════════════════════════════════════
// CADMIUM RISK BRIEF
// ═══════════════════════════════════════
const cadmium = wrap(`
${cover('Cadmium Risk Brief','WartOlyze® Composition — Proactive Assessment & Mitigation Strategy','Risk Advisory')}
<div class="pg">
<p class="tag">The Finding</p>
<p class="st">Cadmium Nitrate in WartOlyze® Formulation</p>
<div class="card" style="border-left:4px solid #e11d48">
<p class="h4" style="color:#e11d48">Material Identified</p>
<p class="sm sc">The WartOlyze® procedural liquid contains <span class="b nc">cadmium nitrate tetrahydrate [Cd(NO₃)₂·4H₂O]</span> — classified as an IARC Group 1 carcinogen. Primary toxicity concerns relate to chronic inhalation/ingestion (kidney, bone, lung cancer). Dermal absorption is the lowest-risk route.</p>
</div>
<p class="tag mt3">Contextual Factors — Risk Mitigation</p>
<div class="g2 mb3">
<div class="ch"><p class="h4 tc">Exposure Route & Dose</p><p class="xs sc">Topical, micro-quantity (0.05-0.1 mL), single application (&lt;1 min), &lt;4 cm² area. Dermal absorption of cadmium: &lt;0.5%. Not ingested, inhaled, or systemic.</p></div>
<div class="ch"><p class="h4 tc">Clinical Safety Record</p><p class="xs sc">363+ patients treated. Zero adverse events. Zero systemic toxicity. Zero skin cancer in treated patients. Inventor was a trained oncologist.</p></div>
<div class="ch"><p class="h4 tc">Medical Precedent</p><p class="xs sc">Silver nitrate (heavy metal salt) has long history of safe topical medical use. OTC wart monograph (M028) includes caustic agents. Concentration/duration fundamentally different from IARC scenarios.</p></div>
<div class="ch"><p class="h4 tc">Regulatory Relevance</p><p class="xs sc">Professional liquid (practitioner-applied): risk-benefit favors use. Consumer cream: HIGHEST regulatory risk — IARC carcinogen in consumer OTC requires reformulation.</p></div>
</div>
<p class="h3">Risk Assessment Matrix</p>
<table class="dt">
<tr><th>Risk Category</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th></tr>
<tr><td class="b">Regulatory rejection</td><td><span class="bd br">HIGH</span></td><td><span class="bd ba">MEDIUM</span></td><td>Reformulation; professional-use only; risk-benefit filing</td></tr>
<tr><td class="b">Product liability</td><td><span class="bd br">HIGH</span></td><td><span class="bd bt">LOW</span></td><td>Professional-use; informed consent; 363 pts, 0 AEs</td></tr>
<tr><td class="b">Consumer perception</td><td><span class="bd ba">MEDIUM</span></td><td><span class="bd ba">MEDIUM</span></td><td>Professional channel only; no consumer labeling</td></tr>
<tr><td class="b">Buyer diligence concern</td><td><span class="bd br">HIGH</span></td><td><span class="bd br">CERTAIN</span></td><td>This brief; independent tox; proactive disclosure</td></tr>
<tr><td class="b">Actual patient harm</td><td><span class="bd bt">LOW</span></td><td><span class="bd bt">VERY LOW</span></td><td>Micro-dose, single application, topical, 363 pts safety</td></tr>
</table>
${ft('Cadmium Risk Brief',2)}
</div>
<div class="pg">
<p class="tag">Recommended Mitigations</p>
<p class="st">Action Plan</p>
<div class="g2 mb3">
<div class="card"><p class="h4 nc">1. Independent Toxicology Assessment</p><p class="xs sc">Commission board-certified toxicologist. Assess cadmium at clinical dose/route/duration. Cost: $15-25K. Timeline: 4-6 weeks.</p></div>
<div class="card"><p class="h4 nc">2. Reformulation Feasibility Study</p><p class="xs sc">Contract lab tests copper/zinc/silver substitutes. If feasible, cadmium becomes solvable optimization. Cost: $50-100K. Timeline: 3-4 months.</p></div>
<div class="card"><p class="h4 nc">3. Proactive Buyer Disclosure</p><p class="xs sc">Present in management presentation BEFORE diligence. Frame with tox context + safety record + reformulation path. Builds credibility.</p></div>
<div class="card"><p class="h4 nc">4. Channel Strategy</p><p class="xs sc">Professional liquid: maintain current formulation (practitioner supervision). Consumer cream: reformulate before retail launch.</p></div>
</div>
<p class="h3">Valuation Impact</p>
<table class="dt mb3">
<tr><th>Scenario</th><th>Discount</th><th>Rationale</th></tr>
<tr><td class="b">Proactive disclosure + tox report + reformulation path</td><td class="vc" style="color:#14b8a6">3-5%</td><td>Quantified, solvable risk</td></tr>
<tr><td class="b">Proactive disclosure, no tox report</td><td class="vc" style="color:#d97706">5-15%</td><td>Unquantified but acknowledged</td></tr>
<tr><td class="b">Buyer discovers in diligence (no disclosure)</td><td class="vc" style="color:#e11d48">25-40% or deal termination</td><td>Trust destroyed</td></tr>
</table>
<div class="cn" style="text-align:center;padding:20px">
<p class="sm b">Recommended Narrative for Buyer Meetings</p>
<p class="xs mt2" style="color:#94a3b8;font-style:italic;line-height:1.7">"The original formulation includes cadmium nitrate as a virucidal metal salt. The inventor was a trained oncologist who selected it based on efficacy. Clinical safety across 363 patients shows zero adverse events. An independent toxicology assessment is in process, and a reformulation pathway to substitute alternative metal salts has been identified. This is a solvable formulation optimization, not a fundamental product risk."</p>
</div>
<div class="card mt3"><p class="h4 nc">Next Steps</p>
<p class="xs sc">□ Commission independent tox assessment ($15-25K, 4-6 weeks)</p>
<p class="xs sc">□ Commission reformulation feasibility ($50-100K, 3-4 months)</p>
<p class="xs sc">□ Include cadmium brief in management presentation</p>
<p class="xs sc">□ Prepare talking points for buyer Q&A</p></div>
${ft('Cadmium Risk Brief',3)}
</div>
`);

// ═══════════════════════════════════════
// NDA TEMPLATE
// ═══════════════════════════════════════
const nda = wrap(`
${cover('Mutual Non-Disclosure Agreement','Essential Remedium Corporation — Transaction Evaluation','Legal Document')}
<div class="pg">
<p class="st">Mutual Non-Disclosure Agreement</p>
<p class="sm sc mb3">This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of _____________, 2026 by and between:</p>
<div class="ch mb2"><p class="sm b nc">Essential Remedium Corporation</p><p class="xs sc">Delaware corporation, 45 Rockefeller Plaza, Suite 2000, New York, NY 10111</p><p class="xs sc">Acting through its exclusive advisor, Ambrosia Ventures ("Disclosing Party")</p></div>
<div class="card mb3"><p class="sm b nc">_____________________________________________ ("Receiving Party")</p><p class="xs sc">Address: _____________________________________________</p></div>
<p class="h3">1. Definition of Confidential Information</p>
<p class="xs sc mb2">"Confidential Information" means all non-public information disclosed in connection with the Transaction, including: (a) trade secrets, formulations, manufacturing processes; (b) patent applications, IP strategy; (c) clinical data, regulatory submissions; (d) financial information, projections, valuations; (e) the existence and terms of the Transaction itself; (f) all derivative analyses prepared by the Receiving Party.</p>
<p class="h3">2. Exclusions</p>
<p class="xs sc mb2">Information that: (a) is publicly available through no fault of Receiving Party; (b) was known prior to disclosure; (c) is independently developed without reference to Confidential Information; (d) is rightfully obtained from a third party.</p>
<p class="h3">3. Obligations</p>
<p class="xs sc mb2">Receiving Party shall: (a) hold in strict confidence; (b) disclose only to Representatives with need-to-know under equivalent obligations; (c) use solely for evaluating the Transaction; (d) not reverse-engineer formulations; (e) not use to compete or develop competing products; (f) protect with reasonable care.</p>
<p class="h3">4. Non-Solicitation</p>
<p class="xs sc mb2">For 24 months, Receiving Party shall not solicit, recruit, or hire any employee or contractor of ERC.</p>
<p class="h3">5. Standstill</p>
<p class="xs sc mb2">For 12 months, unless invited in writing, Receiving Party shall not: (a) acquire securities/assets of ERC; (b) make public announcements; (c) contact ERC directly (all through Ambrosia Ventures).</p>
<p class="h3">6. Return or Destruction</p>
<p class="xs sc mb2">Upon request or decision not to proceed: return/destroy all Confidential Information and certify in writing.</p>
<p class="h3">7. Term & Governing Law</p>
<p class="xs sc mb2">3 years from Effective Date. Trade secret obligations survive indefinitely. Governed by New York law. Courts of New York County.</p>
<div class="g2 mt4">
<div class="card" style="min-height:120px"><p class="h4 nc">Essential Remedium Corporation</p><p class="xs sc">(through Ambrosia Ventures)</p><p class="xs sc mt3">By: ___________________________</p><p class="xs sc">Name: Issa Kildani</p><p class="xs sc">Title: Managing Partner, Ambrosia Ventures</p><p class="xs sc">Date: ___________________________</p></div>
<div class="card" style="min-height:120px"><p class="h4 nc">Receiving Party</p><p class="xs sc mt3">By: ___________________________</p><p class="xs sc">Name: ___________________________</p><p class="xs sc">Title: ___________________________</p><p class="xs sc">Date: ___________________________</p></div>
</div>
${ft('Mutual NDA',2)}
</div>
`);

// ═══════════════════════════════════════
// PROCESS LETTER
// ═══════════════════════════════════════
const processLetter = wrap(`
${cover('Process Letter','Structured Sale Process — Confidential','Transaction Advisory')}
<div class="pg">
<p class="st">Process Letter</p>
<p class="sm sc mb3">Ambrosia Ventures has been retained as the exclusive sell-side advisor to Essential Remedium Corporation ("ERC") in connection with a structured process to explore strategic alternatives for four proprietary IP assets.</p>
<p class="h3">1. Transaction Overview</p>
<div class="g2 mb3">
<div class="ch"><p class="h4 tc">Track 1 — OTC Platform Bundle</p><p class="xs sc">WartOlyze® + DandrOheal® + MastOnorm®</p><p class="xs sc">Asset purchase or exclusive IP license</p><p class="xs sc b">Indicative: $75–125M upfront + earn-out + royalty</p></div>
<div class="ch"><p class="h4 tc">Track 2 — Oncology Development</p><p class="xs sc">Lesion Free Skin (topical BCC/SCC)</p><p class="xs sc">Co-development license with option-to-acquire</p><p class="xs sc b">Structure: upfront + milestones + option</p></div>
</div>
<p class="h3">2. Process Timeline</p>
<table class="dt mb3">
<tr><th>Phase</th><th>Timeline</th><th>Activity</th></tr>
<tr><td class="b">NDA Execution</td><td>Upon receipt</td><td>Mutual NDA in form provided by Ambrosia</td></tr>
<tr><td class="b">CIM Delivery</td><td>+3 business days</td><td>Confidential Information Memorandum</td></tr>
<tr><td class="b">Data Room Access</td><td>+5 business days</td><td>Virtual data room (Track 1 and/or Track 2)</td></tr>
<tr><td class="b">Q&A Period</td><td>4 weeks</td><td>Written Q&A through Ambrosia Ventures</td></tr>
<tr><td class="b">Management Presentation</td><td>Weeks 9-14</td><td>By appointment</td></tr>
<tr><td class="b">Non-Binding IOI</td><td>Week 15</td><td>Indication of Interest due (date TBD)</td></tr>
<tr><td class="b">Shortlist</td><td>Week 16</td><td>Selected parties advance</td></tr>
<tr><td class="b">Exclusivity & Definitive</td><td>Weeks 19-22</td><td>Binding offer + agreement negotiation</td></tr>
<tr><td class="b">Target Close</td><td>Week 26</td><td>IP transfer + closing conditions</td></tr>
</table>
<p class="h3">3. IOI Requirements</p>
<p class="xs sc mb2">Non-binding IOIs should include: (a) Track(s) identified; (b) Transaction structure; (c) Indicative valuation and assumptions; (d) Consideration structure; (e) Key diligence items; (f) Timeline to definitive agreement; (g) Financing sources; (h) Strategic rationale.</p>
<div class="cn mt3" style="text-align:center;padding:24px">
<p class="sm b">All communications directed exclusively to:</p>
<p style="font-size:16px;font-weight:700;margin:8px 0 4px">Issa Kildani · Managing Partner</p>
<p class="sm" style="color:#14b8a6">ikildani@ambrosiaventures.co</p>
<p class="xs mt2" style="color:#94a3b8">Ambrosia Ventures · Exclusive Sell-Side Advisor</p>
</div>
${ft('Process Letter',2)}
</div>
`);

async function main() {
  console.log('Generating ERC Deal Material PDFs (Batch 2)...\n');
  await render(compLandscape, 'ERC_Competitive_Landscape.pdf');
  await render(cadmium, 'ERC_Cadmium_Risk_Brief.pdf');
  await render(nda, 'ERC_NDA_Template.pdf');
  await render(processLetter, 'ERC_Process_Letter.pdf');
  console.log('\nBatch 2 complete.');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
