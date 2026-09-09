# Asset Radar — Gap Register and World-Class Plan

Audit date: September 9, 2026. Five parallel audits (universe, scoring, thesis/feed/intel/creator layers, UI/UX, competitor and data-source benchmark) plus production database inspection. Branch `feat/radar-worldclass-p0` closes every P0 below; P1 and P2 are the build plan.

## Production state at audit time

| Metric | Value |
|---|---|
| Assets indexed | 5,932, all created Sep 4, none since |
| Companies covered | 335 of 1,465 |
| Assets with no therapeutic area | 2,290 |
| Assets with phase not_applicable or unknown | 1,424 |
| Licensing intent score | max 14, mean 0.9, nothing above 30 |
| Assets ever scored | ~1,148 of 5,932 |
| Deal theses ever written | 0 (table did not exist in prod; code also queried six non-existent columns) |
| Mandates table in prod | did not exist |
| Radar cron runs in the ingestion log | 0 (every module logged with wrong columns) |
| API routes without auth | 9 of 17, including two that call Opus per request |

## Root causes (all fixed on this branch)

1. **Universe froze.** The daily cron selected the 200 companies with the oldest `companies.updated_at`, which are exactly the companies with no trials because every other ingester bumps that column. Same 200 re-selected daily, zero inserts. Fixed with a dedicated `assets_indexed_at` cursor and an RPC that only returns companies with drug trials (migration 102).
2. **Universe built from buyers.** The trials ingester only crawls companies flagged `actively_acquiring`. Sellers were never the target. Partially fixed (cursor); the sponsor-first sweep is Phase 2.
3. **Phases collapsed.** `mapPhase` read `phases[0]`, so Phase 1/2 became Phase 1 and Phase 2/3 became Phase 2. Devices and observational studies became assets because the CT.gov query had no study-type filter. Fixed.
4. **TA classifier.** Emitted `infectious` while the mapper only knew `infectious_disease`; substring matches turned "small" into ALL and "hives" into HIV; no branches for ophthalmology, respiratory, renal, GI, pain, MSK, women's health, vaccines. Fixed with word boundaries and new branches.
5. **Score could not reach 100.** Each factor was multiplied by its confidence after weights already summed to 1, then by a phase multiplier, giving a ceiling around 66 and typical 5 to 8. Five of nine factors read tables that nothing writes (`press_releases`), or query trial statuses the ingester never fetches (terminated), or patents limited to 35 large-cap assignees. Aggregator fixed; confidence is now a separate column; availability factor added. Data sources are Phase 2.
6. **Theses never generated.** Migration 093 was never applied and the code selected `upfront_m`, `phase_at_deal`, `announcement_date` and three other columns that do not exist. Comps also bypassed the calculator's canonical/verification filters. Fixed: migration applied, comps come from `findEnrichedComparableDeals` with n>=5 floor.
7. **Mandates never matched on phase.** Matcher compared `'phase 2'` to `'phase_2'`. Table did not exist in prod. Fixed and applied.
8. **UI filters never matched.** Modality and phase pills used values the database does not contain. Fixed with `lib/radar/vocab.ts` as the single vocabulary; geography facet added.
9. **Silent failures everywhere.** Every Radar module logged with non-existent columns; every detector ignored Supabase errors. Fixed with `lib/radar/run-log.ts` and per-factor error counts; Radar crons registered in the health monitor.
10. **Security.** Nine unauthenticated routes, public `SELECT USING (true)` on every intelligence table, notes endpoint returning all users' notes and emails, raw query text interpolated into PostgREST filters and LLM prompts. Fixed (migration 101).

## P0 closed on this branch

| Area | Fix | Commit |
|---|---|---|
| Logging | Shared `logRadarRun`, correct schema, zero-output runs marked partial | 4cc4cfc |
| Universe | Cursor rotation, drug-only trials, combined phases, TA classifier, ISO-2 geography, batched upserts, paging, validation | f3a2a85 |
| UI vocabulary | Single vocab module, geography facet, sort resets page | 960548f |
| API security | Auth on all routes, tenant-scoped notes, zod validation, rate limits, narrative cache, RLS, server-side feature flag, noindex | 53b1d9b |
| Thesis / feed / creator / intel | Real deals columns, calculator comps engine, n>=5, relaxation + dispersion persisted, phase-key matching, TA mapping, cited narratives, k-anonymity | 55a03d4 |
| Scoring v2 | Reachable 0 to 100, availability factor, `last_scored_at` queue at 2,500 per run, all nine factors persisted, PostgREST-safe, snapshot trend, tests | d84b130 |
| Modal | Insufficient-comparables state and confidence | 55de458 |

Migrations applied to production Sep 9: 092, 093, 101, 102, 103, 104 (plus 079 earlier the same night).

## P1 — build plan, in order

### Phase 2: universe to 30,000+ across every geography (weeks 1 to 4)

1. **Sponsor-agnostic ClinicalTrials.gov sweep.** Replace company-by-company `query.spons` with `pageSize=1000`, `sort=LastUpdatePostDate`, `AREA[LeadSponsorClass]INDUSTRY` plus `OTHER` for academic, persisted `lead_sponsor_name` and class, incremental cursor in `system_config`, chunked runs until the cursor reaches the present. CT.gov alone holds about 79,000 industry-led interventional drug trials and 200,000 total. Target: 15,000 to 20,000 active industry assets in two weeks.
2. **Trial interventions child table.** Store every intervention per trial with arm role, not `interventions[0]`; tag comparator and background arms so pembrolizumab in a biotech combo does not become the biotech's asset.
3. **Drug master entity.** One drug node with UNII (GSRS), ChEMBL ID, INN, code names, brands; assets keyed on it; owners as a link table. Resolves "MK-3475 (pembrolizumab)" versus "Pembrolizumab (MK-3475)", combos, and cross-company duplicates. Free sources: GSRS, ChEMBL synonyms, NCIt, DrugBank open vocabulary, PubChem.
4. **Sponsor to company resolution.** `sponsor_aliases` table (self, subsidiary, CRO, former name), GLEIF LEI for legal-entity country and parent; CROs never own assets; academic, government, hospital owners retained with a licensable flag.
5. **Ex-US registries.** Phase A: WHO ICTRP as an index only (non-commercial terms), bridging secondary IDs to source registries. Phase B: direct adapters for EU CTIS, ANZCTR, ISRCTN (CC BY), DRKS, Health Canada. Phase C: CDE (China drug trials, best asset field), ChiCTR, jRCT, CTRI, Korea MFDS and CRIS, Israel MyTrial, run off Vercel with Playwright. Country minimums: China needs CDE plus ChiCTR; Japan needs jRCT; Korea needs MFDS plus CRIS; Israel needs MyTrial; Switzerland needs SNCTP plus CTIS; UK needs ISRCTN plus CTIS; Australia needs ANZCTR; India needs CTRI.
6. **Status freshness.** Fetch all statuses including terminated, withdrawn, suspended, completed; emit `phase_history` events; this also unblocks the competitor-failure signal.
7. **Partnership detection.** Constrain deal matching to the asset's company; territory algebra over global/US/EU/Japan/China/RoW; industry collaborators on trials become `partnered_candidate` with the NCT as evidence; press-release parsing for "exclusive license".
8. **Target and mechanism extraction.** Sonnet 5 extraction over summaries and intervention descriptions into HGNC symbols and ChEMBL target classes; FDA orphan, breakthrough, and EMA PRIME lists joined by drug master.
9. **Preclinical disclosed programs.** 10-K/20-F pipeline tables, company pipeline pages, AACR/ASCO/ASH abstracts. About 40 percent of Pharmaprojects' active programs are preclinical.

### Phase 3: licensing intent score to world-class (weeks 3 to 8, overlaps)

1. **Data sources for the dead factors.** Persist every press-release item to `press_releases` with resolved `company_id` and a 24-month backfill from GlobeNewswire; PatentsView by assignee for every originator; terminated-trial sweep; deal terminations from 8-K and press.
2. **Company financial pressure from primary sources.** SEC XBRL frames for cash and burn, going-concern language, ATM and shelf filings, 8-K 2.05 and 5.02; KIND, EDINET, HKEX for Korea, Japan, Hong Kong; last raise date and size for private companies.
3. **Management intent language.** Classifier over 10-K/10-Q, earnings transcripts, and press for seeking-partner versus retaining-rights, with the quoted span and URL as evidence.
4. **Catalyst proximity and portfolio position.** Primary completion dates and phase transitions; the asset's rank within its company's pipeline and fit to the company's stated focus.
5. **Sponsor type and geography priors** learned from the deals table (China, Korea, Japan out-licensing base rates 2023 to 2026; academic Phase 1/2 out-license rates).
6. **Backtest.** Label = deal announced within 12 months of a monthly snapshot; reconstruct historical snapshots by running detectors with `as_of` cutoffs; gradient-boosted or monotone logistic model with temporal holdout; report AUC, precision at top 50/100, lift, Brier, calibration in-product. Reuse the metric functions in `lib/services/pharma-intent-backtest-v2.ts`.
7. **Output contract.** Probability, 80 percent interval, top five contributions with quoted evidence and URLs, trend over 30/90 days, peer percentile within phase by TA by modality, model version, last updated.
8. **Recency decay** per evidence item with factor-specific half-lives; retune detector ceilings after the backtest.

### Phase 4: UI to committee grade (weeks 4 to 8, overlaps)

1. **Mandate-first home.** First screen creates a mandate; the feed is its ranked matches; "All assets" is the escape hatch. Full mandate form: phase range, geography, partnership status, deal-size fit, notification preferences, live match count, edit mode.
2. **Ranked feed with inline "why now".** Score, 30-day delta sparkline, top two sourced drivers, next catalyst date, owner with country, rights available. Dense virtualized table with card toggle, cursor pagination, estimated counts.
3. **Facet rail with counts.** Region and country, TA, indication, modality, phase, target, partnership, score band, trial status, sponsor type; multi-select; one search box with typeahead where natural-language parsing applies chips to the same state.
4. **Asset page at `/radar/[id]` as a one-page deal brief.** Ownership and rights block, mechanism and target, all nine score factors with evidence links and a waterfall to the composite, predicted terms in the DealTransparency row format with n, confidence, and relaxation rung, full trial table, catalyst timeline, acquirers, notes. Replaces the modal.
5. **Score trend and audit.** Snapshot line with factor decomposition and a changelog of moves with sources.
6. **Geography map view** by originator country.
7. **Compare up to five** using the existing compare API.
8. **Committee-ready export.** PDF brief through the existing print pipeline, CSV/XLSX of any list, share link.
9. **Team layer.** Org-scoped watchlists with priority and owner, notes with mentions, activity feed.
10. **Alerts.** Daily mandate digest email, Slack webhook, threshold alerts on score and partnership changes.
11. **Honest scoring UX.** Legend, confidence next to every predicted number, custom weights either applied server-side from `factor_scores` or removed.
12. **Design parity.** `neutral-*` tokens, Heroicons instead of emoji, Headless dialog and tabs, focus management, AA contrast, reduced-motion, mobile bottom sheet, error states with retry, first-run guidance.

## P2 — polish backlog

- Acquirer view passes the acquirer into the opportunities query.
- `radar_phase_breakdown` RPC ordering uses slugs.
- `first_posted_date` mapped from `StudyFirstPostDate`.
- Modality vote across trials with suffix rules (-mab, -tinib, -siran, -cel).
- Conference keyword list word-boundaried (`ada`, `acc`, `ash` currently match ordinary words).
- Trigram index on `research_signals.abstract`.
- Thesis and opportunity versioning with model and engine version.
- Documented `NEXT_PUBLIC_RADAR_ENABLED` in `.env.example`.
- Duplicate `deriveTA` in deal-creator once asset-universe exports it.

## Competitive position

No incumbent (Cortellis, GlobalData, Citeline, Evaluate, DealForma, Biotechgate, Inpart) sells a licensing-intent score; they sell probability-of-success and self-declared availability flags. Asset-level predicted deal terms with shown comps do not exist anywhere. The two AI-native entrants closest to this positioning are One Zyme (China-forward partnerable signal) and Tribal Bio (pre-seed, fit score). The capabilities that move a Cortellis customer, in order: backtested intent score, predicted terms with comps, primary-registry China/Japan/Korea coverage, evidenced acquirer matching, citable AI theses, sub-second faceted search, transparent sub-$30K pricing, event-driven watchlists, visible freshness, unpunitive export.

## Operating rules going forward

- Every Radar cron logs through `logRadarRun`; a run that processes input and produces nothing is `partial` and alerts.
- Every new query on `clinical_assets` uses `lib/radar/vocab.ts` values; every comparison across vocabularies goes through `lib/comparables/match-normalize.ts`.
- Predicted terms only ever come from the calculator's comps engine.
- No intelligence table is readable by the anon key.
- Migrations are applied to production the day they merge; the migration list in this document is the checklist.
