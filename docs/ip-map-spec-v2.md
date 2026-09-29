# IP Map — product spec v2

Status: scope approved for design, Sep 28 2026. Supersedes `docs/ip-map-rights-layer.md` (v1, Sep 25), which becomes section 6 of this document.
Owner: Issa Kildani. Evidence base: `docs/ip-map-research/` (landscape report plus seven research notes, copied from `~/Desktop/Ambrosia Ventures/IP Map/`). Mockup: https://claude.ai/artifact/Lk8NfAsncW9HA7r7WrNv7Z (four screens, illustrative data).

---

## 1. The decision in one paragraph

IP Map ranks **buyers**, not technology. Incumbents (PatentSight+, Derwent, PatSnap, Orbit, AcclaimIP) sell maps and value scores of technology; pharma tools (Cortellis, Evaluate, DrugPatentWatch, Pharsight) sell drug-to-patent lookups and loss-of-exclusivity (LOE) dates, which are now a commodity. None of the fifteen general platforms or the pharma tools reviewed ranks likely licensees or acquirers from citations in a transparent, validated way; none corrects citing activity for how much the citing company files; none links patent position to biopharma deal terms; none publishes backtested accuracy. IP Map does all four, because Solidus owns what they lack: a verified biotech deal ledger, a cleaned entity graph (28,011 canonical companies, 55,521 assets) and an outcome ledger that scores predictions against real events. IP Map has standalone value for anyone monetizing, buying or diligencing biotech IP, and every signal it produces is keyed to shared ids so Solidus, Augur and later Alaric can use it.

## 2. Who pays, for what job

| Segment | Job to be done | Size and budget signal | Price point (recommended) |
|---|---|---|---|
| Biotech asset owners (seller side) | "Who should I call, why now, and what do I ask for?" | Thousands of therapeutics biotechs; boutique partner-search advisors charge a reported $25–75K a month | Per-asset licensee report $2.5–7.5K; seat $12–20K/yr |
| Pharma BD / search & evaluation | "What should I in-license before a competitor does, and whose patents block us?" | Estimated 150–300 in-licensing organisations worldwide; DealForma lists $18K/yr for one user; Evaluate reported $10–20K per seat | Team $30–75K/yr |
| University and institute tech-transfer offices | "Which companies are building on our patents?" | 204 of 338 invited AUTM members answered FY2024; ~8,800 US university licences/options a year; FY2024 licensing income fell 24%, so price sensitive; Inteum lists from $200/month | Tiered by office size $5–25K/yr |
| Life-science investors (Augur) | "How strong and how long is this company's protection, and does it move my mark?" | FTO opinions reportedly $10–50K+ each | Bundled in Augur |
| IP counsel and licensing firms | Claim diligence, challenge risk, landscape | PatSnap / Derwent / Orbit reported $25–80K/yr | Seat $12–20K/yr |

Rough US serviceable market: $25–35M ARR, about double worldwide (estimate, segments note). Solidus bundle priced 25–40% below standalone. **No success fees**: patent brokers take 15–40% of proceeds, which shows willingness to pay for finding a buyer, but Ambrosia is retainer-only.

## 3. Positioning against incumbents

| What the market sells | What IP Map sells instead |
|---|---|
| Patent value / importance scores (PatentSight Patent Asset Index, Orbit, AcclaimIP, Innography) | Probability that a named company licenses or acquires this asset, with a timing window and the evidence |
| Citing-assignee lists that users rank by hand (Orbit, Derwent, See-the-Forest, Lens PatCite) | A ranked Buyer Board, normalized for filer volume, family-deduplicated, examiner-weighted |
| One LOE date per country without derivation (Cortellis, DrugPatentWatch) | An LOE probability distribution with the binding constraint shown |
| Maps that need manual set-up before they say anything | Visuals built around a decision, each paired with a ranked, exportable list |
| Unpublished methods (Ambercite licensing index, PatSnap's 2017 Licensee Locator) | Published accuracy from the outcome ledger |

## 4. The core: Buyer Propensity

### 4.1 The four-part score

`Buyer Propensity = f(Adjacency, Need, Appetite, Timing)`, reported 0–100 with the top three to five contributing factors for every company. A transparent, weighted model first; learned weights only after the backtest (section 7). Evidence that the transparent version is also the stronger one: the MASS portfolio-similarity model beats a graph neural network (LightGCN) in most settings on 547 acquisition pairs (arXiv 2404.07179).

| Part | Question | Signals | Source |
|---|---|---|---|
| **Adjacency** | Is the company building on this IP? | Citation Lift (4.2); portfolio text similarity (MASS-style); backward-citation overlap; examiner rejections of its applications over our patents | USPTO/EPO citations, full text, Office Action data |
| **Need** | Does it need what we have? | Its own LOE calendar from IP Map runway (section 6); pipeline gaps in the therapeutic area and modality; competitor pressure | IP Map rights layer, Solidus/Terrain pipelines |
| **Appetite** | Does it buy things like this? | Pharma Intent Score v3 (already backtested on 378 deals); in-licensing and M&A history by TA, phase, modality, geography (incl. China-originated assets) | Solidus deal ledger |
| **Timing** | When? | Filing velocity in the space; deal cadence; LOE proximity; recent reorganisations and conveyances | Filings, USPTO assignment data, Solidus |

Evidence: anticipated patent expirations and pipeline gaps predict big-pharma M&A (Danzon et al.; Higgins & Rodriguez "desperation index", 160 deals); technological similarity and complementarity both raise acquirer–target match likelihood; citations between target and acquirer drive acquisition premiums (Long Range Planning 2025). The literature supports *who* more strongly than *when*, so Timing is published as a window (0–12, 6–18, 12–24, 18–36 months), never a date.

### 4.2 Citation Lift (Issa's metric 1, made rigorous)

For a patent family set F and company c (ultimate parent, via the entity resolver):

`Citation Lift(c, F) = observed share of citations to F that come from c ÷ expected share given c's filing volume in the same CPC groups and years`

Rules:
- **Family-level, not publication-level.** One citing family counts once; no double counting across US/EP/CN publications of the same invention.
- **Examiner citations weighted higher than applicant citations.** Examiner-added citations predict value better (Hegde & Sampat 2009); a citation used in a rejection of the company's own application is the strongest signal, shown separately as a *blocking citation*.
- **Similarity weighting.** Citations are now concentrated in a few applications and less similar to the cited patent than before (Kuhn, Younge & Marco 2020); weighting each citation by text similarity restores predictive power.
- **Pre-deal window only.** Citations rise after a licence is signed, so every backtest and every live ranking uses citations dated before the as-of date.
- **Self-citations excluded** from Lift, shown separately.
- **Ultimate-parent roll-up** through `companies.merged_into` and the subsidiary map, so Genentech and Chugai land on Roche, Kite on Gilead.
- Citations predict **whether** a licence happens, not **how much** it is worth (university licensing evidence). Value comes from section 4.5.

### 4.3 Cold start: young patents and pending applications

Most assets clients monetize are young, and forward citations take years. Lift is weakest exactly where the clients are. For families under ~4 years old or still pending, Adjacency falls back to signals available on day one:
- portfolio text similarity between our claims and each company's recent filings;
- backward-citation overlap (both cite the same prior art);
- examiner citations during prosecution of either side;
- age-normalized network centrality (rescaled PageRank spots significant patents earlier than raw counts);
- the backward-looking "novelty" half of the Kelly–Papanikolaou–Seru–Taddy text measure (the forward half needs later patents).
The Buyer Board shows which regime a ranking is in ("citation-led" vs "similarity-led"). Truncation bias in recent patents is corrected per Lerner & Seru (RFS 2022).

### 4.4 Buy side: the same engine, reversed

For pharma BD: "Which external families sit closest to our pipeline and portfolio, which of them block our applications (examiner citations against us), and which owners are likely to sell (section 7, out-licensing likelihood)?" Same data, same views, different anchor.

### 4.5 IP-adjusted value

Comparable deals from the Solidus ledger set the price range; IP Map adjusts it for claim strength (section 5), effective runway (section 6) and challenge risk (section 7). Output: an ask range on the outreach packet, logged as a prediction and scored when the deal closes.

## 5. Claim Strength (Issa's metric 2, made defensible)

Reported as a profile, never one number, and always framed as indicators for counsel, not a legal opinion.

### 5.1 Breadth
- Word count (and character count, which beat word count in Ragot's self-information study) of the **shortest independent claim**, as a percentile within CPC group and grant year (Kuhn & Thompson 2019; Marco, Sarnoff & deGrazia 2019).
- Number of independent claims and dependency depth (fallback positions).
- Open vs closed transitions ("comprising" vs "consisting of").
- Kuhn & Thompson find citation counts, claim counts and class counts uninformative about scope, so none of those enter breadth.

### 5.2 Prosecution narrowing
Application claims vs granted claims from the USPTO Patent Claims Research Dataset: limitations added, words added. Examination narrows claims on average, more so in longer or harder prosecution.

### 5.3 Indefiniteness, tiered
Legal standard: "reasonable certainty" (Nautilus 2014). Terms of degree are not fatal when the specification gives an objective anchor (Interval Licensing); subjective terms fail without one ("unobtrusive"; "optimal"/"best" in Akamai v. MediaPointe, Nov 2025).
- **Low**: terms of degree anchored to a number or comparator ("about 10 mg/kg").
- **Medium**: terms of degree with a weak anchor ("substantially enhances … relative to").
- **High**: subjective or evaluative terms ("optimal", "effective amount" without definition) and **measured parameters without a stated test method** (Teva v. Sandoz molecular weight; Forest v. Teva PK profile) — the real risk in formulation and PK claims.
Raw counts of "about/around/approximately" are shown for transparency but do not drive the tier.

### 5.4 Biotech validity risk (Amgen v. Sanofi and after)
Scored as **text vulnerability**, kept separate from likely litigation outcome, because the same text wins or loses by forum (Teva v. Lilly, Apr 2026, upheld method claims on one disclosed antibody before a jury).
Signals (derived from the case law; to be validated, section 7):
1. Product defined only by function, no sequence or structure (Amgen: 26 antibodies exemplified vs a class of "millions").
2. Gap between claimed genus size (Markush combinations, variable positions) and species exemplified (Juno v. Kite: ≤5 CD19 binders; Seagen v. Daiichi, Dec 2025: 47M+ tetrapeptides).
3. Whether the specification states a common structural feature (the opening Amgen left).
4. Open percent-identity ranges, and which region they cover (CDRs vs framework); no numeric safe harbour exists.
5. Claimed subgenus the priority document never points to.
6. Method-of-treatment modifiers: specific indication plus data lowers risk; "treating a patient" with no disease raises it (In re Xencor, Mar 2025).
7. Jepson format (preamble needs its own written description, Xencor).
8. Measured parameters without a test method.
9. §101 detect-and-correlate pattern (CareDx v. Natera).
10. Double-patenting and term flags (In re Cellect 2023; Allergan v. MSN 2024 carve-out).
11. Issue date (pre- or post-Amgen prosecution).
12. Score the **best surviving dependent claim**, not just claim 1.
EPO note: post-filed data can support inventive step only if the effect is derivable from the application as filed (G 2/21).

## 6. Rights layer and Exclusivity Runway (v1 spec, kept and extended)

For every asset: all layers of protection, the binding constraint, and an effective-LOE **probability distribution**.
- US: Orange Book and Purple Book, patent term extension (PTE), NCE/orphan/pediatric/BPCIA 12-year exclusivity, Paragraph IV and PTAB activity.
- EU: SPCs, 8+2(+1) data and market exclusivity, EP families and legal status.
- China: NMPA patent-linkage register (2021), patent term compensation (operational Jan 20 2024; first 5-year grant to telitacicept, June 2025), NMPA data exclusivity (6 years, effective May 15 2026).
- Why a distribution: a backtest of a rule-based method on 170 drugs found only 59% entered inside the predicted window (23% late, 18% early); for drugs protected only by secondary patents it predicted 16.0 years vs 8.25 actual (Value in Health 2018). US biosimilars launch ~34 months after FDA approval on average, vs 4.7–7.4 months in the UK and Canada.
- Purple Book caveat: since the 2020 Continuity Act it lists only patents disclosed in the patent dance, so biologic runways need the sequence/claim join (Phase 4).
- Replaces the hand-filled `companies.patent_cliffs` (83 companies) and `indication_patent_cliffs` (23 rows); the Need signal in 4.1 reads from it.

## 7. Predictive models and how each scores itself

Every prediction is frozen with its inputs, model version and as-of date, written to the outcome ledger, and resolved by a public event. Accuracy is published per model. This is what makes IP Map transformative rather than informative, and it is Alaric's training signal.

| # | Prediction | Method (v1) | Resolves on | Metric | Evidence / prior art |
|---|---|---|---|---|---|
| P1 | Buyer propensity + timing window per company | Transparent four-part score; learned weights after backtest | Licence, option or acquisition involving the asset/family; or 36 months pass | Precision@k, Hit@5/10, MRR; calibration of window | MASS beats Jaffe similarity on Precision@500 and Hit@5 (547 deals); no pharma-specific validation exists — the Phase 1 backtest is the go/no-go |
| P2 | IP-adjusted deal value range | Solidus comps × claim strength × runway × challenge risk | Deal closes with disclosed terms | Interval coverage, pinball loss | Citations predict licensing, not revenue — comps must set price |
| P3 | Effective LOE / first generic or biosimilar entry, distribution | Constraint model + empirical priors by exclusivity type and challenge history | First approval and launch of a generic/biosimilar | CRPS, interval coverage | 59% in-window for rule-based point estimates (Value in Health 2018); Hemphill & Sampat effective market life ≈12.2 years |
| P4 | PTAB challenge within 3 years, and outcome | Features: litigation-likeness, claim type, owner, commercial value; **regime flag** for 2025–26 discretionary-denial changes | IPR/PGR petition; institution; final decision | Brier, log loss, reliability | IPR institution fell from ~65% (Oct 2024) to ~37% (Feb 2026); biologic patents historically worse than Orange Book patents (70% vs 45% all claims unpatentable); no published accuracy benchmark |
| P5 | Grant probability and final claim scope for pending applications | Examiner and art-unit allowance rates as of the prediction date; prosecution features; claim text | Grant or abandonment; granted claims compared | Brier; claim-scope error | Best published: 0.854 ROC-AUC, 77% accuracy (Yao & Ni 2023); PatentAdvisor/Juristat publish no accuracy |
| P6 | Out-licensing likelihood per asset (find sellers early) | Cash runway, phase transitions, pipeline breadth, equity-market conditions | Asset partnered within 12/24 months | Brier, Precision@k | Biotechs partner more, on worse terms, when equity markets are closed (Lerner, Shane & Tsai 2003); distressed small biotechs exit via M&A (Danzon et al.); no asset-level model published |
| P7 | New entrants in a claim space (24 months) | Filing-surge detection on first publications by new assignees | New assignee publications; first trials | Precision, lead time | Vendor/practitioner claims only; IP Map validates it itself |
| P8 | §112 vulnerability of biotech genus claims | Section 5.4 signals, weighted by counsel labels | Decisions in litigation/PTAB/examination on comparable claims | AUC once labels exist | No published model; counsel annotations become the labelled set |

Metrics follow the prediction type: Brier/log loss for yes/no events, CRPS or pinball loss with coverage for dates and values, Precision@k/Hit@k/MRR for shortlists.

**Point-in-time discipline** (non-negotiable): examiner rates only from actions before the prediction date; archived Orange/Purple Book snapshots; citations only if dated before the as-of date; assignments as recorded at that date; every prediction's inputs frozen in the ledger. Without this, backtests are dishonest and Alaric learns from information that did not exist yet.

## 8. Visual-first interface

The map is the interface; every view pairs a visual with a ranked, exportable list and the reasons behind each rank. Nine views, four shipped in Phase 1 (mockup screens 1–4).

| View | What it shows | Decision it drives | Phase |
|---|---|---|---|
| **Constellation** (screen 1) | Patent families at the centre; companies orbit at a distance set by Buyer Propensity; node size = citing volume; edges split examiner (orange) vs applicant (blue) | Who to approach first | 1 |
| **Buyer Board** (screen 1) | Ranked companies with score, Lift, window and a four-factor breakdown | The call list | 1 |
| **Claim Anatomy** (screen 2) | Each independent claim read element by element, with functional-genus, sequence-identity and indefiniteness tiers highlighted | What counsel will attack | 1 |
| **Claim Strength Grid** (screen 2) | Every independent claim in one grid: breadth percentile, narrowing, indefiniteness, enablement | Which claims carry the asset | 1 |
| **Exclusivity Runway** (screen 3) | Every protection layer on a timeline, US/EU/CN, with the LOE distribution and the derivation in words | How long the asset earns | 2 (US v1 in Phase 1) |
| **Chain of Title** (screen 3) | Assignments, licences, security interests on a timeline | Clean title; distress | 2 |
| **Citation Flow** | Sankey of citations between companies across a space | Who depends on whom | 3 |
| **Topography** | Text embeddings → UMAP clusters; portfolios overlaid; white space marked; Solidus deal pins on the map | Where the gaps and prices are | 3 |
| **Thicket Heatmap** | Mutually blocking triples per target/indication (von Graevenitz, Wagner & Harhoff 2011) | FTO triage and buyer objections | 3 |

Design rules: dark institutional theme, pill controls, colour pairs that differ in lightness (orange/blue, never red/green alone), every chart has a text equivalent, and every score shows its top contributing factors.

## 9. Workflow: from ranking to a closed deal

- **Outreach packet** per buyer (screen 4): why them (blocking citations), why now (their LOE gap), how they buy (deal history), comparable deals from Solidus, the IP-adjusted ask, and the evidence appendix (citing patents, Claim Anatomy, Runway). Exports to PDF and feeds the Deal Intelligence Brief.
- **Contact and outcome tracking**: each contact logged with status (queued, sent, meeting, passed, term sheet, closed). This is proprietary ground truth nobody else has and it trains P1.
- **Alerts**: new blocking citation against a buyer's application; buyer filing surge in the space; new conveyance on a competitor family; PTAB petition on a relevant family; LOE distribution shifts.
- **Money metric**: meetings booked per packet, licences and acquisitions closed, dollars closed per asset, days from first contact to term sheet. Published internally per model version.

## 10. Data stack and licences

| Source | What we take | Licence / limit | Phase |
|---|---|---|---|
| USPTO Open Data Portal bulk (PatentsView tables) | Citations with examiner/applicant category, claims, assignee disambiguation, CPC | Free; **PatentsView API shut down Mar 20 2026**; bulk files capped at 20 downloads per file per key per year → mirror once, refresh on schedule | 1 |
| USPTO Patent Claims Research Dataset | Application vs grant claims, breadth measures | Free | 1 |
| USPTO Office Action / PatEx (Public PAIR) | Rejections, examiner/art-unit history, action dates | Free | 1–2 |
| USPTO assignment dataset | ~6M conveyances: assignment, merger, licence, security interest | Free | 2 |
| USPTO PTAB API (ODP 3.0, full since Nov 2025) | Petitions, institution, decisions | Free | 2 |
| FDA Orange Book / Purple Book (+ archived snapshots) | Listed patents, exclusivities | Free | 1 |
| Google Patents Public Datasets (BigQuery) | Worldwide bibliographic data, families, CN titles/abstracts with English machine translation, original-language assignees | CC BY 4.0 (commercial use and redistribution with attribution); claims/description documented as US-only — verify | 1 |
| EPO DOCDB / INPADOC bulk; OPS | Families, citations, legal events worldwide | Bulk free since early 2025; OPS allows in-product use, not raw republishing; **check bulk licence before redistributing derived fields** | 1 |
| NMPA patent-linkage register, CN term-compensation records | China pharma protections | Public | 2 |
| KIPRIS Plus (Korea) / JPO bulk (Japan) | KR/JP data | $1,783/yr / free by application | 3 |
| Paid CN English full-text claims (Lens, IFI CLAIMS or similar) | English CN claims for Claim Anatomy | Quote needed | 3 |
| OpenAlex | Patent-to-paper linkage for the TTO segment | Free (CC0) | 3 |
| Reliance on Science (Marx–Fuegi) | Patent-to-paper pairs | **Non-commercial only — do not ship** | — |
| Lens API | Scholarly/patent linkage | **Commercial use requires paid plan** | optional |
| Unified Patents portal | PTAB/district-court analytics | Free portal; check terms for derived use | 2 |
| Solidus deal ledger, entity graph, outcome ledger, Pharma Intent Score | Appetite, deal comps, backtests, resolution | Internal | 1 |

**China from Phase 1, not Phase 3.** China-originated assets were 21% of global out-licensing value in 2023–24 and 32% in H1 2025 (Jefferies); 28% of innovator drugs large pharma in-licensed in 2024 (GlobalData); Chinese companies were licensor in 44% of 2025 megadeals (Intralinks/PharmCube). Only ~1% of CNIPA patents have US or EP family members, so CN citations are attached through families where they exist, and Adjacency for China-only families runs in the similarity regime (4.3). The standardized assignee field covers under one in five CNIPA patents, so we build and own a curated table of ~300–500 Chinese biopharma groups, universities and hospitals keyed to the entity graph — a defensible asset no free source provides.

## 11. Data model (entity graph additions)

New first-class entity: **patent family**. All tables carry validity dates for point-in-time reads.

| Table | Key columns | Notes |
|---|---|---|
| `ip_families` | id, docdb_family_id, earliest_priority_date, title, cpc_main, jurisdictions[] | canonical family id; entity kind `family` in `/api/entities/resolve` |
| `ip_publications` | id, family_id, publication_number, office, kind, filing_date, grant_date, status, expiry_date_est | US/EP/CN/JP/KR |
| `ip_family_owners` | family_id, company_id, role (assignee, licensee, security holder), valid_from, valid_to, source | from assignments; company_id via entity resolver, ultimate parent materialised |
| `ip_citations` | citing_family_id, cited_family_id, category (examiner, applicant, other, search_report), cited_on, rejection (bool), similarity | family-to-family, dated |
| `ip_claims` | publication_id, claim_no, independent, text, words, chars, elements, transition, tiers jsonb, version (application/grant) | Claim Strength inputs and outputs |
| `ip_family_assets` | family_id, asset_id (drug_master.id), link_type (composition, method, formulation, sequence), confidence, source | the patent→asset bridge; early assets via sequence/target/structure matching |
| `ip_exclusivity` | asset_id, jurisdiction, layer (patent, PTE, SPC, NCE, orphan, BPCIA, data, pediatric, linkage), start, end, source, as_of | Runway |
| `ip_events` | family_id, type (ptab_petition, institution, decision, litigation, conveyance, office_action), date, payload | catalysts and resolution events |
| `ip_scores` | family_id or asset_id, company_id, score_type (lift, propensity, claim_strength, …), value, factors jsonb, model_version, as_of | every score reproducible |
| `ip_contacts` | asset_id, company_id, status, contact_date, notes, user_id | outreach ledger; client-private (RLS) |

Outcome ledger: `predictions` today is deal-shaped (upfront/total/royalty ranges, `predicted_buyers`). Add `prediction_kind` (buyer_propensity, deal_value, loe_entry, ptab, grant, out_licensing, new_entrant, genus_risk) and `payload jsonb` plus `resolution_event`, so IP Map writes to the same ledger and the same resolver scores it.

API: `/api/entities/{asset|company|family}/{id}/rights` (runway, owners, events), `/api/ip/families/{id}/buyers` (Buyer Board with factors), `/api/ip/claims/{publication}` (Claim Strength), all keyed on entity-graph ids.

## 12. Alaric data contract

What IP Map guarantees to Alaric, and why each matters:
1. **Canonical ids only** — family, asset, company, deal. No name strings cross the boundary.
2. **As-of snapshots** of every input and score, so Alaric trains without look-ahead.
3. **Every prediction with its resolution** (section 7), including misses — the calibration signal.
4. **Proprietary outcomes** — contacts, responses, passes, closes from `ip_contacts` (anonymised and aggregated across clients, never one client's data exposed to another).
5. **Expert labels** — counsel annotations on claim tiers and genus risk, versioned, as training data for P8.
6. **Provenance on every number** — source, retrieval date, licence.
Alaric's cross-platform leverage: IP Map's Need and Runway feed Solidus buyer maps and Augur marks; Solidus deals resolve IP Map predictions; Terrain demand sizes the value range. Each platform stays useful alone.

## 13. Trust, legal, security

- Every claim and FTO output carries "indicator for counsel, not a legal opinion". No infringement conclusions; AI claim charting (Phase 4) is triage only.
- Client portfolios and contact logs are private (row-level security); uploads never enter shared models without consent; advisory data never flows into the platform.
- Licences in section 10 are respected per field; derived fields from EPO bulk are not redistributed until the licence is confirmed.
- Retainer and subscription pricing only; no success fees.

## 14. Build phases, each with an exit test

**Phase 1 — Spine, two metrics, the go/no-go (≈8–10 weeks).**
Mirror USPTO bulk (citations, claims, assignees, CPC), PCRD, Orange/Purple Book with snapshots, Google Patents CN/EP bibliographic data and families. Resolve owners into the entity graph with ultimate-parent roll-up and the curated China table. Ship Citation Lift v1 (family-level, filer-normalized, examiner-weighted, pre-deal window), Adjacency cold-start regime, Need from runway, Appetite from Solidus, Timing window; Claim Strength v1 (breadth, independent count, narrowing, tiered indefiniteness). Ship Constellation, Buyer Board, Claim Anatomy, Claim Strength Grid, US Runway v1, and the outreach packet. Log every ranking to the ledger.
*Exit test:* historical backtest of P1 on Solidus licences and acquisitions with a strict pre-deal cut-off, published as Hit@10 and Precision@10 against a filer-volume baseline. If IP Map does not beat the baseline, redesign before further spend.

**Phase 2 — Signals counsel and buyers ask about (≈8 weeks).**
Blocking-citation alerts (Office Action data), Chain of Title and M&A radar (assignments), PTAB model with regime flag (P4), LOE distributions (P3), grant prediction for pending applications (P5), text-similarity weighting in Lift and a MASS-style portfolio term, EU runway, China linkage and term compensation. Re-run and publish the backtest.
*Exit test:* calibration curves for P3–P5; P1 lift over Phase 1.

**Phase 3 — Landscape and early signals (≈8 weeks).**
Topography with Solidus deal pins, Citation Flow, Thicket Heatmap, out-licensing likelihood (P6), new-entrant detection (P7), TTO science linkage via OpenAlex, JP/KR data, CN English claims.
*Exit test:* P6/P7 precision measured; first TTO pilots.

**Phase 4 — Biotech depth and Alaric (≈8 weeks).**
Claim-type tagging and genus-risk scoring (P8) with counsel labels, sequence/CDR join to assets for biologic runways, AI claim charting framed as triage, Alaric feeds per section 12.
*Exit test:* P8 AUC on labelled set; Alaric consuming IP Map snapshots.

## 15. Open risks and unknowns

- No study shows citations predict **pharma in-licensing partners** specifically; the Phase 1 backtest decides.
- PTAB behaviour changed sharply in 2025–26; any model trained earlier needs the regime flag.
- No labelled dataset links claim text to §112 outcomes; P8 depends on building one with counsel.
- EPO bulk licence terms for redistribution unconfirmed; Google BigQuery claims coverage outside the US unverified; CN English full-text needs a vendor quote.
- Pricing rests partly on reported, not published, figures; buyer interviews (five sellers, five pharma BD, five TTOs) should precede final pricing.
- Solidus deal coverage bounds the backtest: the more verified licences with known patents, the stronger P1's evidence.

## 16. Sources

Research notes with inline citations for every figure above, in `docs/ip-map-research/`:
- `landscape-report.md` (round 1 synthesis)
- `general_platforms.md`, `pharma_specific_tools.md`, `methods_data_visuals.md` (round 1)
- `genus_claim_legal_risk.md`, `china_asia_patent_data.md`, `segments_pricing.md`, `predictive_methods.md` (round 2)

Related repo docs: `docs/alaric-outcomes-program.md`, `docs/entity-graph.md`, `docs/augur-narrow-build.md`.
