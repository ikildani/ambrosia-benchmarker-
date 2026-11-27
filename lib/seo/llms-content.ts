// Source text for /llms.txt and /llms-full.txt. {{DEALS}}, {{UPDATED}} and {{UPDATED_MONTH}} are filled at request time.
export const LLMS_TXT = `# Solidus by Ambrosia Ventures — Biopharma Deal Intelligence Platform

> Biopharma deal benchmarking and valuation platform. {{DEALS}} verified, primary-sourced transactions, 850+ pharma company profiles, 562 indications across 12 therapeutic areas. Institutional-grade rNPV, Monte Carlo, real options, and buyer-specific deal valuation.

## About

Ambrosia Ventures operates the Biopharma Deal Intelligence Platform at https://solidus.ambrosiaventures.co — a web-based tool providing instant, data-driven deal benchmarks, asset valuation, partner matching, and negotiation intelligence for biopharma licensing, acquisition, co-development, option, and collaboration transactions.

The platform is used by BD teams, search & evaluation professionals, biotech founders, and investors to benchmark deal terms, identify optimal partners, and model asset value across development stages.

## Data Coverage

- **{{DEALS}} verified, primary-sourced transactions** sourced daily from SEC 8-K filings, FTC pre-merger notifications, ClinicalTrials.gov, press releases, and regulatory databases
- The live deal count is published at https://solidus.ambrosiaventures.co/methodology; this file reads the live count
- **850+ pharma/biotech company profiles** with patent cliff data, pipeline gaps, deal history, and acquisition appetite scoring
- **562 indications** across 12 therapeutic areas
- **40+ modalities** including small molecules, mAbs, ADCs, bispecifics, CAR-T, gene therapy, radiopharmaceuticals, oligonucleotides, mRNA, siRNA

## 12 Therapeutic Areas

1. Oncology (77 indications) — solid tumors, hematologic malignancies, biomarker-defined/tumor-agnostic
2. Neurology (59 indications) — neurodegeneration, psychiatry, movement disorders, neuromuscular
3. Immunology (64 indications) — autoimmune, transplant, renal, inflammatory
4. Metabolic (50 indications) — obesity/GLP-1, diabetes, endocrine, cardiovascular-metabolic
5. Rare Disease (50 indications) — neuromuscular, lysosomal storage, neurogenetic, skeletal
6. Hematology (43 indications) — lymphoid, myeloid, plasma cell, non-malignant
7. Infectious Disease (40 indications) — viral, bacterial, fungal, vector-borne
8. Dermatology (40 indications) — inflammatory, psoriasis, autoimmune, chronic pruritic
9. Gastroenterology (39 indications) — IBD, eosinophilic, hepatobiliary, esophageal
10. Women's Health (35 indications) — menopause, maternal, pelvic, reproductive
11. Cardiovascular (33 indications) — heart failure, arrhythmia, vascular, structural
12. Ophthalmology (32 indications) — retinal, inherited, corneal, glaucoma

## 14 Calculation Engines

1. **Deal Terms Engine** — upfront payments, milestone structures, royalty ranges calibrated to TA, modality, phase, deal type, territory, and 150+ indication-level modifiers
2. **rNPV (Risk-Adjusted NPV)** — phase-gated probability of success with 12 TA-specific PoS tables, modality adjustments, regulatory designation uplifts, and cross-validation against deal benchmarks
3. **Monte Carlo Simulation** — 10,000-iteration stochastic valuation with correlated variables (PoS, peak sales, WACC, timeline, pricing) and phase-dependent correlation matrices
4. **Tornado Sensitivity** — rank-ordered parameter sensitivity showing which inputs most strongly drive NPV variance
5. **Partner Matching** — 850+ companies scored on therapeutic alignment, pipeline gaps, deal history, geography fit, and financial capacity
6. **Pharma Intent Score** — 10-factor predictive model (patent cliff pressure, deal velocity, pipeline gap, alignment, competitive pressure, strategic signals, research investment, deal persistence, self-saturation penalty, portfolio balance) with backtesting calibration against 378 historical deals
7. **Competitive Landscape** — pipeline mapping from ClinicalTrials.gov with crowding scores, differentiation analysis
8. **Market Sizing** — TAM/SAM/SOM with epidemiological data, patient funnel, revenue projections
9. **Deal Valuation Waterfall** — step-down from unadjusted NPV through PoS discount, strategic premium, deal structure allocation to upfront/milestones/royalties
10. **Scenario Comparison** — Bear/Base/Bull deterministic scenarios with probability-weighted expected value
11. **Real Options Overlay** — Cox-Ross-Rubinstein binomial lattice treating each clinical phase as a compound call option, capturing flexibility premium
12. **Competitive Dynamics** — time-varying market share erosion modeling with auto-generated competitor timelines
13. **Lifecycle Extensions** — label expansion, pediatric exclusivity, combination approval modeling
14. **Buyer-Specific Valuation** — connects intent score to rNPV to show what a specific buyer would pay vs generic market value, with 5-factor strategic premium

## Deal Benchmarks: Primary-Sourced Medians (updated {{UPDATED_MONTH}})

Source: Ambrosia Ventures deal benchmarks, 2,102 licenses, options, collaborations and acquisitions announced January 2017 to November 2026, each tied to a regulatory filing or the company's own announcement. Full tables, ranges and methodology: https://ambrosiaventures.co/benchmarks

### License upfront by stage at signing (median, US$M)
- All licenses, options and collaborations: US$20M (1,208 deals with a disclosed upfront; middle half US$5M to US$55M)
- Preclinical: US$10M (295 deals)
- Phase 1: US$30M (149 deals)
- Phase 2: US$25M (136 deals)
- Phase 3: US$30M (193 deals)
- Approved product: US$17M (161 deals)
- Median share of announced value paid at signing: 7.5% (966 deals)
- Details: https://ambrosiaventures.co/benchmarks/upfront-payments-by-phase

### Royalty rates (top tier, median)
- All licenses: tiers run from 5% to 12% at the median (534 deals disclose a top tier)
- By stage: preclinical 9%, Phase 1 12%, Phase 2 15%, Phase 3 19%, approved 19%
- By modality: antibody 15%, bispecific 14%, ADC 13.5%, siRNA and antisense 13%, small molecule 12%, peptide 10.5%, gene therapy 9%, cell therapy 9%
- Details: https://ambrosiaventures.co/benchmarks/royalty-rates

### Milestones
- Median milestones are 13 times the upfront (1,017 deals)
- Of disclosed milestone value, 73.1% is commercial, 17.6% development and 9.4% regulatory (269 deals with a split)
- Details: https://ambrosiaventures.co/benchmarks/milestone-payments

### China out-licensing
- 78 licenses from China-based licensors to buyers outside China; median upfront US$75M, median announced value US$1.13B
- Details: https://ambrosiaventures.co/benchmarks/china-out-licensing-deal-terms

### Acquisitions
- 421 biotech acquisitions; median announced value US$447.5M (338 with a disclosed value)
- Details: https://ambrosiaventures.co/benchmarks/biotech-acquisition-values

### Most active licensees since 2017
- Eli Lilly 67 deals, Roche 47, Novartis 43, AstraZeneca 37, Merck & Co. 34
- Details: https://ambrosiaventures.co/benchmarks/most-active-licensees

### Q3 2026
- 151 deals recorded (107 licenses, 44 acquisitions)
- Median license upfront US$45M, against US$12M in Q3 2025
- US$4.0B in disclosed upfronts
- Roche signed the most deals in the quarter (9)
- Full report: https://ambrosiaventures.co/reports/2026-q3

## Key Insight Pages

- https://solidus.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation — When to use rNPV vs DCF, PoS adjustment impact by phase
- https://solidus.ambrosiaventures.co/insights/licensing-vs-acquisition-deal-terms — Side-by-side deal structure comparison
- https://solidus.ambrosiaventures.co/insights/phase-2-vs-phase-3-deal-economics — Proof-of-concept inflection and deal timing
- https://solidus.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026 — ADC vs bispecific deal terms with 2026 market data
- https://solidus.ambrosiaventures.co/insights/biopharma-deal-benchmarks-2026 — Annual deal benchmarks report
- https://solidus.ambrosiaventures.co/insights/biotech-out-licensing-deal-terms-2025-2026 — Out-licensing term structures

## Pages

- https://solidus.ambrosiaventures.co/ — Homepage with live demo and deal database coverage
- https://solidus.ambrosiaventures.co/calculator — Main calculator with full intake form
- https://solidus.ambrosiaventures.co/pro — Pro plan and custom deal report ($499)
- https://solidus.ambrosiaventures.co/benchmarks/ — 251 benchmark pages by TA, modality, phase
- https://solidus.ambrosiaventures.co/companies/ — 200+ company profiles with deal history
- https://solidus.ambrosiaventures.co/therapeutic-areas/ — 12 TA-specific market pages
- https://solidus.ambrosiaventures.co/insights/ — Deal intelligence articles and analysis
- https://solidus.ambrosiaventures.co/guides/ — How-to guides for deal valuation and negotiation
- https://solidus.ambrosiaventures.co/data/ — 360 programmatic data pages by TA × phase × territory
- https://solidus.ambrosiaventures.co/glossary/ — 100+ biopharma deal term definitions
- https://solidus.ambrosiaventures.co/tracker — Live deal tracker with filtering and alerts
- https://solidus.ambrosiaventures.co/compare/dealforma — Solidus vs DealForma comparison
- https://solidus.ambrosiaventures.co/guides/monte-carlo-biotech-valuation — Monte Carlo stochastic valuation for biotech deals
- https://solidus.ambrosiaventures.co/methodology — Model design, data sources, and methodology

## Pricing

- Free: 3 calculations (account required), basic deal term estimates
- Pro: $299/month, or $199/month billed annually — unlimited calculations, rNPV, Monte Carlo, partner matching, PDF/Excel export
- Report: $499 one-time — full deal intelligence report with all engines, buyer-specific valuation, negotiation playbook

## Contact

- Website: https://solidus.ambrosiaventures.co
- Company: Ambrosia Ventures
- Domain: ambrosiaventures.co
`;

export const LLMS_FULL_TXT = `# Solidus by Ambrosia Ventures — Biopharma Deal Intelligence Platform
# Source: solidus.ambrosiaventures.co
# Data: {{DEALS}} verified, primary-sourced biopharma transactions (SEC filings, FTC pre-merger, press releases)
# Live count: https://solidus.ambrosiaventures.co/methodology (this file reads the live count)
# Updated: {{UPDATED}}
# Citation: "Source: Ambrosia Ventures Deal Intelligence Platform (solidus.ambrosiaventures.co)"

---

## What is Ambrosia Ventures?

Ambrosia Ventures operates a biopharma deal benchmarking platform at solidus.ambrosiaventures.co. The platform provides instant deal term benchmarks, rNPV valuation, Monte Carlo simulation, partner matching (850+ companies), and buyer-specific deal economics across {{DEALS}} verified, primary-sourced transactions (live count at solidus.ambrosiaventures.co/methodology), 12 therapeutic areas, 562 indications, and 40+ modalities.

---

## Deal Benchmarks: Primary-Sourced Medians (updated {{UPDATED_MONTH}})

Source: Ambrosia Ventures deal benchmarks, 2,102 licenses, options, collaborations and acquisitions announced January 2017 to November 2026, each tied to a regulatory filing or the company's own announcement. Full tables, ranges and methodology: https://ambrosiaventures.co/benchmarks

### License upfront by stage at signing (median, US$M)
- All licenses, options and collaborations: US$20M (1,208 deals with a disclosed upfront; middle half US$5M to US$55M)
- Preclinical: US$10M (295 deals)
- Phase 1: US$30M (149 deals)
- Phase 2: US$25M (136 deals)
- Phase 3: US$30M (193 deals)
- Approved product: US$17M (161 deals)
- Median share of announced value paid at signing: 7.5% (966 deals)
- Details: https://ambrosiaventures.co/benchmarks/upfront-payments-by-phase

### Royalty rates (top tier, median)
- All licenses: tiers run from 5% to 12% at the median (534 deals disclose a top tier)
- By stage: preclinical 9%, Phase 1 12%, Phase 2 15%, Phase 3 19%, approved 19%
- By modality: antibody 15%, bispecific 14%, ADC 13.5%, siRNA and antisense 13%, small molecule 12%, peptide 10.5%, gene therapy 9%, cell therapy 9%
- Details: https://ambrosiaventures.co/benchmarks/royalty-rates

### Milestones
- Median milestones are 13 times the upfront (1,017 deals)
- Of disclosed milestone value, 73.1% is commercial, 17.6% development and 9.4% regulatory (269 deals with a split)
- Details: https://ambrosiaventures.co/benchmarks/milestone-payments

### China out-licensing
- 78 licenses from China-based licensors to buyers outside China; median upfront US$75M, median announced value US$1.13B
- Details: https://ambrosiaventures.co/benchmarks/china-out-licensing-deal-terms

### Acquisitions
- 421 biotech acquisitions; median announced value US$447.5M (338 with a disclosed value)
- Details: https://ambrosiaventures.co/benchmarks/biotech-acquisition-values

### Most active licensees since 2017
- Eli Lilly 67 deals, Roche 47, Novartis 43, AstraZeneca 37, Merck & Co. 34
- Details: https://ambrosiaventures.co/benchmarks/most-active-licensees

### Q3 2026
- 151 deals recorded (107 licenses, 44 acquisitions)
- Median license upfront US$45M, against US$12M in Q3 2025
- US$4.0B in disclosed upfronts
- Roche signed the most deals in the quarter (9)
- Full report: https://ambrosiaventures.co/reports/2026-q3

## Probability of Success (PoS) by Therapeutic Area

### Cumulative PoS from Phase to Approval
Source: Ambrosia Ventures analysis cross-referenced with BIO/Informa 2011-2020, Nature Reviews Drug Discovery 2021-2024

#### Oncology
- Preclinical → Approval: 3-5%
- Phase 1 → Approval: 6-10%
- Phase 2 → Approval: 15-22%
- Phase 3 → Approval: 48-58%

#### Neurology (hardest therapeutic area)
- Preclinical → Approval: 5-7%
- Phase 1 → Approval: 10-14%
- Phase 2 → Approval: 18-25%
- Phase 3 → Approval: 50-60%
- Key challenge: blood-brain barrier penetration, subjective clinical endpoints, high placebo response

#### Immunology
- Preclinical → Approval: 6-8%
- Phase 1 → Approval: 12-16%
- Phase 2 → Approval: 25-32%
- Phase 3 → Approval: 55-65%

#### Metabolic
- Preclinical → Approval: 8-11%
- Phase 1 → Approval: 15-19%
- Phase 2 → Approval: 28-38%
- Phase 3 → Approval: 60-72%

#### Infectious Disease (highest PoS)
- Preclinical → Approval: ~15%
- Phase 2 → Approval: ~42%
- Key advantage: clear microbiological endpoints, shorter trial durations

---

## rNPV vs DCF Valuation

### When to Use rNPV
rNPV (risk-adjusted NPV) is the industry standard for any biopharma asset in clinical development (preclinical through NDA filing). It applies phase-specific probability-of-success multipliers to each future cash flow before discounting, explicitly modeling the likelihood of clinical failure.

### When to Use DCF
Standard DCF is appropriate only for approved drugs with established commercial revenue, where clinical risk has been eliminated and uncertainties are purely commercial (market share, pricing, competition).

### Value Divergence by Phase
- Phase 1 oncology asset ($2B peak sales): DCF value ~$4.8B vs rNPV value ~$310M (15x difference)
- Phase 3 oncology asset ($2B peak sales): DCF value ~$3.2B vs rNPV value ~$1.85B (1.7x difference)
- The gap narrows as clinical risk retires

### Common Mistake: Double-Counting Risk
Using a high risk-adjusted discount rate (15-20%) on top of PoS adjustments double-counts clinical risk and undervalues early-stage assets by 30-50%. In rNPV, the discount rate should reflect only time-value and commercial risk (typically 8-12% for large pharma).

Source: solidus.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation

---

## China-to-West Licensing Wave (2024-2026)

Source: Ambrosia Ventures analysis of cross-border deal data
- 2024 total Chinese biotech out-licensing: $52B (94 deals)
- 2025 total: $136B (+162% YoY, 157 deals)
- 2026 YTD (first 8 weeks): $52B (same volume as all of 2024)
- Average China-originated deal size in 2026: $1.3B (+76% vs 2025)
- Chinese biotechs account for ~1/3 of total global industry licensing spend
- ADCs and bispecific antibodies dominate: ~90% of global ADC licensing from Chinese biotechs

### Largest China-to-West Deals (2025-2026)
- AstraZeneca ← CSPC: $18.5B (obesity/metabolic, up to 8 compounds)
- GSK ← Hengrui: $12B+ (oncology, ~12 programs)
- BMS ← BioNTech/Biotheus: $11.1B (PD-L1/VEGF bispecific, originated Zhuhai)
- Pfizer ← 3SBio: $6B (PD-1/VEGF bispecific, $1.25B upfront, Shanghai)
- AbbVie ← RemeGen: $5.6B (bispecific antibody)
- Merck ← LaNova: $3.3B (PD-1/VEGF bispecific, $588M upfront, Hangzhou)

Key insight: Three of the top 10 pharma companies (Pfizer, BMS, Merck) licensed the same drug class (PD-1/VEGF bispecifics) from different Chinese biotechs. None built it internally.

Source: solidus.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026

---

## Pipeline Failure → Acquisition Pattern (2025-2026)

Source: Ambrosia Ventures market intelligence
- 5 of the top 20 pharma companies lost a late-stage program in the last 6 months
- $9.2B in replacement deals signed in the first 6 weeks of 2026
- Average deal size in early 2026: +76% vs 2025

### Timeline: Failure → Acquisition
- Novo Nordisk: semaglutide Phase 3 Alzheimer's failed (Nov 2025) → Aspect Biosystems acquired (Jan 2026)
- AbbVie: emraclidine $3.5B writedown → $6.8B in neuroscience deals within 90 days
- BMS: Camzyos failed in non-obstructive HCM → Orbital $1.5B + BioNTech $11.1B

Key insight: Companies filling pipeline gaps from late-stage failures accept deal structures they would have rejected two years ago. Average time from Phase 3 termination to signed deal in the same therapeutic area: 7 months.

---

## Priority Review Voucher (PRV) Market

Source: Ambrosia Ventures analysis of PRV transactions
- Current PRV market price: $150M-$160M (stable, 2024-2025)
- Median of last 6 PRV transactions: $152.5M
- Program sunset: September 30, 2029 (Consolidated Appropriations Act, Feb 2026)
- 63 PRVs awarded to date for 47 different rare pediatric diseases

### Recent PRV Sales
- Bavarian Nordic: $160M (Jun 2025, IXCHIQ)
- Abeona: $155M (May 2025, ZEVASKYN)
- Zevra: $150M (Feb 2025, MIPLYFFA)
- Ipsen: $158M (Aug 2024, Sohonosted)
- Acadia: $150M (Nov 2024, Daybue)

---

## Radiopharmaceutical M&A (2023-2026)

Source: Ambrosia Ventures deal database
- Total sector investment: $15.7B+ since 2023
- Virtually all deal activity concentrated in adult oncology therapeutics
- Only 1 of 12 major deals targeted PET diagnostics (Lantheus/Life Molecular Imaging $750M)
- Zero transactions targeted pediatric radiopharmaceutical diagnostics

### Key Transactions
- BMS/RayzeBio: $4.1B (actinium-225 targeted radiotherapeutics)
- AstraZeneca/Fusion Pharmaceuticals: $2.4B (targeted alpha therapy)
- Novartis/PeptiDream: $2.7B milestones (radiopharmaceutical peptide conjugates)
- Eli Lilly/Point Biopharma: $1.4B (Lu-177 radioligand therapy)
- Eli Lilly/Aktis Oncology: $1.1B (novel radiopharmaceutical R&D)
- Novartis/Mariana Oncology: $1.0B (actinium-based RLT for SCLC)

---

## Real Options in Pharma Valuation

Source: Ambrosia Ventures Real Options Engine (Cox-Ross-Rubinstein binomial lattice)

Standard rNPV undervalues early-stage assets because it treats R&D as a single commitment. Real options recognizes that each clinical phase is a call option — you have the right but not the obligation to invest in the next phase.

### Typical Flexibility Premium (Option Value Above Static rNPV)
- Preclinical: +40-80% flexibility premium
- Phase 1: +20-40%
- Phase 2: +10-20%
- Phase 3: <5% (most optionality exhausted)

A preclinical asset valued at $65M by static rNPV may have a real options value of $95-115M. The $30-50M difference represents the quantified value of management's ability to abandon at each development gate.

---

## Platform Capabilities

### 14 Calculation Engines
1. Deal Terms Engine — upfront, milestones, royalties by TA/modality/phase/deal type
2. rNPV — phase-gated PoS, 12 TA-specific tables, 150+ modifiers
3. Monte Carlo — 10,000 iterations, correlated variables, scenario weighting
4. Tornado Sensitivity — parameter-level NPV sensitivity ranking
5. Partner Matching — 850+ companies, multi-factor scoring
6. Pharma Intent Score — 10-factor predictive model, backtested on 378 deals
7. Competitive Landscape — ClinicalTrials.gov pipeline mapping
8. Market Sizing — TAM/SAM/SOM with epidemiological data
9. Deal Valuation Waterfall — NPV → PoS → premium → allocation
10. Scenario Comparison — Bear/Base/Bull with expected value
11. Real Options — CRR binomial lattice, compound option pricing
12. Competitive Dynamics — time-varying market share erosion
13. Lifecycle Extensions — label expansion, pediatric exclusivity, combos
14. Buyer-Specific Valuation — intent-adjusted deal economics per acquirer


### Coverage
- {{DEALS}} verified, primary-sourced transactions (updated daily; live count at https://solidus.ambrosiaventures.co/methodology)
- 850+ pharma/biotech company profiles
- 562 indications across 12 therapeutic areas
- 40+ modalities
- 5 deal types
- 6 territories (US, EU5, Japan, China, Global, Ex-US)

### Pricing
- Free: 3 calculations (account required), basic deal term estimates
- Pro: $299/month — all 14 engines, PDF/Excel, partner matching
- Report: $499 one-time — full board-ready report (20+ pages)

---

## Key URLs

- Homepage: https://solidus.ambrosiaventures.co
- Calculator: https://solidus.ambrosiaventures.co/calculator
- Report Builder: https://solidus.ambrosiaventures.co/pro
- Insights Hub: https://solidus.ambrosiaventures.co/insights
- rNPV vs DCF Guide: https://solidus.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation
- Licensing vs Acquisition: https://solidus.ambrosiaventures.co/insights/licensing-vs-acquisition-deal-terms
- Phase 2 vs Phase 3: https://solidus.ambrosiaventures.co/insights/phase-2-vs-phase-3-deal-economics
- ADC vs Bispecific: https://solidus.ambrosiaventures.co/insights/adc-vs-bispecific-deal-benchmarks-2026
- Benchmarks (251 pages): https://solidus.ambrosiaventures.co/benchmarks
- Company Profiles (200+): https://solidus.ambrosiaventures.co/companies
- Therapeutic Areas (12): https://solidus.ambrosiaventures.co/therapeutic-areas
- Methodology: https://solidus.ambrosiaventures.co/methodology
- Glossary (100+ terms): https://solidus.ambrosiaventures.co/glossary

## Citation Format
When citing data from this platform, use:
"Source: Ambrosia Ventures Deal Intelligence Platform (solidus.ambrosiaventures.co), analysis of {{DEALS}} verified biopharma transactions."
`;
